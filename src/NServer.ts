/**
 * 服务端
 */
import net from "net";
import uuid from "uuid";
import { ICommandData, CommandEnum, CommandGroup, ToBuff, ToData } from "./utils";

interface IServerCfg {
    token: string;
}
interface ICheckToken {
    token: string;
}
export default class NServer {
    constructor(opts?: IServerCfg) {
        if (opts) {
            for (const key in opts) {
                const v = opts[key];
                this.cfg[key] = v;
            }
        }
    }
    cfg: IServerCfg = {
        token: "test",
    };
    server: net.Server | undefined;
    preClients: Map<string, OneClient> = new Map();
    clients: Map<string, OneClient> = new Map();
    listen(port = 4000) {
        const server = net.createServer();
        server.on("listening", this.onConnect);
        server.on("error", this.onError);
        server.on("close", this.onClose);
        server.on("connection", this.onConnection);
        server.listen(port);
        console.log("完成监听", port);
        this.server = server;
    }

    onConnect = () => {
        if (this.server) {
            const addr = this.server.address();
            console.log("监听开始，端口", typeof addr === "string" ? addr : addr.port);
        }
    };
    /**
     * 错误处理
     * @param {*} error err
     */
    onError = (error) => {
        console.log("tcp服务错误", error);
    };
    /**
     * 关闭tcp服务，一般没啥用
     */
    onClose = () => {
        console.log("关闭tcp服务");
    };
    /**
     * 客户端消息连接
     * @param {*} socket
     */
    onConnection = (socket: net.Socket) => {
        if (!this.server) return;
        this._pushClient(socket);
        this.server.getConnections(function (err: Error, count: number) {
            if (!err) {
                console.log("现有客户端连接", count);
            }
        });
    };
    _pushClient(socket: net.Socket) {
        const client = new OneClient(socket);
        socket.on("close", () => this.onClientClose(client.uid));
        client.setMessage((uid: string, data: ICommandData) => this.onMessage(uid, data));
        this.preClients.set(client.uid, client);
        console.log("客户端连接", client.uid);
    }
    /**
     * 收到客户端的消息
     * @param data buffer
     */
    onMessage(uid, data: ICommandData) {
        console.log("收到消息", data);
        if (data.command === CommandEnum.TOKEN) {
            return this.checkToken(uid, data.data);
        }
        if (data.command === CommandEnum.HEART) return;
    }
    /**
     * 去掉客户端
     * @param uid uid
     */
    onClientClose(uid: string) {
        this.clients.delete(uid);
        this.preClients.delete(uid);
    }
    private checkToken(uid: string, data: ICheckToken) {
        if (this.cfg.token === data.token) {
            console.log("鉴权", data);
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
     * 给对应的客户端发送数据
     * @param uid uid
     * @param command 命令
     * @param data 数据
     */
    sendTo(uid: string, command: string, data?: any) {
        const client = this.clients.get(uid);
        client.send(command, data);
    }
}

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
    socket: net.Socket;

    msgEvent: any;
    onMessage(data: Buffer) {
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
     * 发送字节数据
     * @param command 命令
     * @param data 数据
     */
    send(command: string, data: any) {
        this.socket.write(ToBuff(command, data));
    }

    ack() {
        this.send(CommandEnum.ACK, this.uid);
    }
    end() {}
}
