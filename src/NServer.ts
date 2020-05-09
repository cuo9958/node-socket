/**
 * 服务端
 */
import net from "net";
import uuid from "uuid";
import { CronJob } from "cron";
import { ICommandData, CommandEnum, ToBuff, ToData, createLog } from "./utils";

interface IServerCfg {
    token?: string;
    debug?: boolean;
}
interface ICheckToken {
    token: string;
}
export class NServer {
    constructor(opts?: IServerCfg) {
        if (opts) {
            for (const key in opts) {
                const v = opts[key];
                this.cfg[key] = v;
            }
        }
        this.loger = createLog(this.cfg.debug);
        this.timer = new CronJob("*/5 * * * * *", this._checks).start();
    }

    cfg: IServerCfg = {
        debug: false,
        token: "",
    };
    private loger = (arg1: any, arg2?: any, arg3?: any) => {};
    //定时任务
    private timer: any;
    //服务端实例
    private server: net.Server | undefined;
    //预加载客户端队列
    private preClients: Map<string, OneClient> = new Map();
    //客户端队列
    private clients: Map<string, OneClient> = new Map();
    //注册的方法
    private callEvents: Map<string, any> = new Map();
    /**
     * 启动监听
     * @param port 端口
     * @param host ip
     */
    listen(port = 4000, host?: string) {
        const server = net.createServer();
        server.on("listening", this.onConnect);
        server.on("error", this.onError);
        server.on("close", this.onClose);
        server.on("connection", this.onConnection);
        server.listen(port, host);
        this.loger("完成监听", port);
        this.server = server;
    }
    /**
     * 建立新的连接时
     */
    private onConnect = () => {
        if (this.server) {
            const addr = this.server.address();
            this.loger("监听开始，端口", typeof addr === "string" ? addr : addr.port);
        }
    };
    /**
     * 错误处理
     * @param {*} error err
     */
    private onError = (error) => {
        this.loger("tcp服务错误", error);
    };
    /**
     * 关闭tcp服务，一般没啥用
     */
    private onClose = () => {
        this.loger("关闭tcp服务");
    };
    /**
     * 客户端消息连接
     * @param {*} socket
     */
    private onConnection = (socket: net.Socket) => {
        if (!this.server) return;
        this._pushClient(socket);
        this.server.getConnections((err: Error, count: number) => {
            if (!err) {
                this.loger("现有客户端连接", count);
            }
        });
    };
    /**
     * 处理新加入的客户端
     * @param socket 客户端实例
     */
    private _pushClient(socket: net.Socket) {
        const client = new OneClient(socket);
        socket.on("close", () => this.onClientClose(client.uid));
        client.setMessage((uid: string, data: ICommandData) => this.onMessage(uid, data));
        this.preClients.set(client.uid, client);
        this.loger("客户端连接", client.uid);
    }
    /**
     * 收到客户端的消息
     * @param data buffer
     */
    private onMessage(uid, data: ICommandData) {
        this.loger("收到消息", data);
        if (data.command === CommandEnum.HEART) return;

        if (data.command === CommandEnum.TOKEN) {
            return this.checkToken(uid, data.data);
        }
        if (data.command === CommandEnum.NOTICE) {
            return this.notice(uid, data.group, data.data);
        }
        if (data.command === CommandEnum.CALL) {
            return this.onCall(uid, data.data);
        }
    }
    /**
     * 去掉客户端
     * @param uid uid
     */
    private onClientClose(uid: string) {
        this.clients.delete(uid);
        this.preClients.delete(uid);
    }
    /**
     * 检查token的合法性
     * @param uid uid
     * @param data 数据
     */
    private checkToken(uid: string, data: ICheckToken) {
        if (this.cfg.token === data.token) {
            this.loger("鉴权", data);
            this.readClient(uid);
            this.sendTo(uid, CommandEnum.ACK, { uid });
        } else {
            this.onClientClose(uid);
        }
    }
    /**
     * 转移客户端队列到正式队列
     * @param uid uid
     */
    private readClient(uid: string) {
        const client = this.preClients.get(uid);
        if (client) {
            this.preClients.delete(uid);
            this.clients.set(uid, client);
        }
    }
    /**
     * 检查客户端健康
     */
    _checks = () => {
        const now = Date.now();
        this.clients.forEach((client) => {
            if (now - client.date > 10000) {
                client.end();
            }
        });
    };
    /**
     * 给对应的客户端发送数据
     * @param uid uid
     * @param command 命令
     * @param data 数据
     */
    sendTo(uid: string, command: string, data?: any) {
        const client = this.clients.get(uid);
        client.send(command, data);
    }
    /**
     * 给除uid之外的所有人发送消息
     * @param uid uid
     * @param command 命令
     * @param data 数据
     */
    sendNot(uid: string, command: string, data?: any) {
        this.clients.forEach((client) => {
            if (client.uid !== uid) {
                client.send(command, data);
            }
        });
    }
    /**
     * 发送消息
     * @param command 命令
     * @param data 数据
     */
    sendAll(command: string, data?: any) {
        this.clients.forEach((client) => {
            client.send(command, data);
        });
    }
    /**
     * 通知房间下，除uid之外的所有人
     * @param uid uid
     * @param group 房间
     * @param data 数据
     */
    notice(uid: string, group: string, data: any) {
        if (!group) return;
        this.clients.forEach((client) => {
            if (client.uid !== uid && client.group === group) {
                client.send(CommandEnum.NOTICE, data);
            }
        });
    }
    /**
     * 当客户端要远程调用服务端注册的方法的时候
     * @param data 数据
     */
    private async onCall(uid: string, data: ICallData) {
        const method = data.method;
        const eventId = data.eventId;
        const params = data.params;
        if (!method || !eventId) return;
        const fn = this.callEvents.get(method);
        if (!fn) {
            return this.callBack(uid, eventId, null, "方法不存在");
        }
        try {
            const res = await fn(params);
            this.callBack(uid, eventId, res);
        } catch (error) {
            this.callBack(uid, eventId, null, error.message);
        }
    }
    /**
     * 调起回调方法
     * @param uid uid
     * @param eventId 事件id
     * @param success 成功结果
     * @param error 失败结果
     */
    private callBack(uid: string, eventId: string, success: any, error?: any) {
        if (error) {
            this.sendTo(uid, CommandEnum.CALL, {
                eventId,
                error,
            });
        } else {
            this.sendTo(uid, CommandEnum.CALL, {
                eventId,
                success,
            });
        }
    }
    /**
     * 注册方法
     * @param method 方法名
     * @param fn 方法
     */
    regMethod(method: string, fn: any) {
        this.callEvents.set(method, fn);
    }
}
export default NServer;
interface ICallData {
    method: string;
    eventId: string;
    params?: any;
}
/**
 * 单独的客户端管理类
 */
class OneClient {
    constructor(socket: net.Socket) {
        this.uid = uuid.v4();
        this.socket = socket;
        this.create = this.date = Date.now();
        socket.on("data", (data) => this.onMessage(data));
    }
    create: number;
    date: number;
    uid: string;
    group: string;
    private socket: net.Socket;

    private msgEvent: any;
    private onMessage(data: Buffer) {
        this.date = Date.now();
        const cmd = ToData(data);
        if (cmd.group) {
            this.group = cmd.group;
        }
        this.msgEvent && this.msgEvent(this.uid, cmd);
    }
    setMessage(fn: any) {
        this.msgEvent = fn;
    }

    /**
     * 收到token消息
     */
    ack() {
        this.send(CommandEnum.ACK, this.uid);
    }
    end() {
        this.socket.end();
    }
    /**
     * 发送字节数据
     * @param command 命令
     * @param data 数据
     */
    send(command: string, data: any) {
        this.socket.write(ToBuff(command, data));
    }
}
