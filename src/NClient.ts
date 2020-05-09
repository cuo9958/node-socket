/**
 * 客户端
 */
import net from "net";
import { CronJob } from "cron";
import uuid from "uuid";
import { ICommandData, CommandEnum, ToBuff, ToData, createLog, ICallBackData } from "./utils";

interface IClientOpts {
    /**
     * 所属房间
     */
    group?: string;
    debug?: boolean;
}
interface IClientCfg extends IClientOpts {
    port: number;
    host: string;
    /**
     * 鉴权使用的key
     */
    token: string;
}

interface IClientInfo {
    uid: string;
    closed: boolean;
    retryCount: number;
    connect: boolean;
}

export class NClient {
    constructor(opts?: IClientOpts) {
        if (opts) {
            for (const key in opts) {
                const v = opts[key];
                this.cfg[key] = v;
            }
        }
        this.loger = createLog(this.cfg.debug);
        this.timer = new CronJob("*/5 * * * * *", this._heart).start();
    }

    cfg: IClientCfg = {
        debug: false,
        port: 3000,
        host: "127.0.0.1",
        token: "",
        group: "",
    };

    info: IClientInfo = {
        uid: "",
        closed: true,
        retryCount: 0,
        connect: false,
    };
    private loger = (arg1: any, arg2?: any, arg3?: any) => {};
    private noticeEvent: any;
    private events: Map<string, any> = new Map();
    private callEvents: Map<string, any> = new Map();
    /**
     * 内部的socket对象
     */
    private socket: net.Socket | undefined;
    private timer = null;
    /**
     * 开始监听远程服务
     * @param port 端口
     * @param host ip
     */
    listen(port = 3000, host?: string) {
        this.cfg.port = port;
        if (host) this.cfg.host = host;
        this.start();
    }

    private start() {
        const socket = net.connect(this.cfg.port, this.cfg.host);
        socket.setKeepAlive(true);
        socket.on("connect", this.onConnect);
        socket.on("data", (data: Buffer) => this.onMessage(data));
        socket.on("close", this.onClosed);
        socket.on("error", this.onError);
        socket.on("timeout", this.onTimeOut);

        this.info.uid = "";
        this.info.closed = true;
        this.socket = socket;
    }
    private _heart = () => {
        if (this.info.closed) return;
        if (!this.info.connect) {
            return this.sendToken();
        }
        this.loger("发送心跳");
        this.send(CommandEnum.HEART, "");
    };

    /**
     * 重试
     */
    retry() {
        if (!this.info.closed) return;
        this.loger("重试", this.info.retryCount);
        this.info.retryCount++;
        this.clearSocket();
        this.start();
    }
    private clearSocket() {
        this.socket.removeAllListeners();
        this.socket.end();
        this.socket.destroy();
    }
    private onConnect = () => {
        this.loger("已连接");
        this.info.closed = false;
        this.info.retryCount = 0;
        this.sendToken();
    };
    private onError = (err: Error) => {
        this.loger("错误", err);
    };
    private onClosed = (had_err: boolean) => {
        this.loger("关闭", had_err);
        this.info.closed = true;
        setTimeout(() => {
            this.retry();
        }, 3000);
    };
    private onTimeOut = () => {
        this.loger("超时");
    };
    /**
     * 接收到消息
     */
    private onMessage = (buf: Buffer) => {
        const data = ToData(buf);
        //收到确认消息
        if (data.command === CommandEnum.ACK) {
            return this.setInfo(data.data);
        }
        if (data.command === CommandEnum.NOTICE) {
            return this._execNotice(data.data);
        }
        if (data.command === CommandEnum.CALL) {
            return this._callBack(data.data);
        }
        this.execRoute(data);
    };
    /**
     * 发送鉴权申请
     */
    private sendToken() {
        this.loger("进行内部鉴权");
        this.info.connect = false;
        this.send(CommandEnum.TOKEN, {
            token: this.cfg.token,
            group: this.cfg.group,
        });
    }
    /**
     * 登录成功,设置当前信息
     * @param data 数据
     */
    private setInfo(data: any) {
        this.loger("设置信息", data);
        this.info.uid = data.uid;
        this.info.connect = true;
    }
    /**
     * 发送命令和数据
     * @param command 命令
     * @param data 数据
     */
    send(command: string, data: any, group?) {
        this.socket.write(ToBuff(command, data, group));
    }
    /**
     * 向同组成员发送命令,不会向自己发送
     * @param data 数据
     */
    sendGroup(data: any) {
        this.send(CommandEnum.NOTICE, data, this.cfg.group);
    }
    /**
     * 设置房间名称
     * @param group 房间
     */
    setGroup(group: string) {
        this.cfg.group = group;
    }
    /**
     * 添加对命令的路由内容
     * @param routeName 路由名
     * @param fn 执行方法
     */
    use(routeName: string, fn: any) {
        const list: any[] = this.events.get(routeName) || [];
        list.push(fn);
        this.events.set(routeName, list);
    }
    /**
     * 执行路由中间件
     * @param data 数据
     */
    private execRoute(data: ICommandData) {
        const list: any[] = this.events.get(data.command) || [];
        this.execFn(list, data.data);
    }
    private async execFn(list: any[], data: any) {
        if (list.length === 0) return;
        const fn: any = list.shift();
        const data2 = await fn(data);
        if (list.length > 0) {
            await this.execFn(list, data2);
        }
    }
    /**
     * 收到通知消息
     * @param data 数据
     */
    private _execNotice(data: any) {
        this.noticeEvent && this.noticeEvent(data);
    }
    /**
     * 设置收到通知之后的回调
     * @param fn 方法
     */
    onNotice(fn: any) {
        this.noticeEvent = fn;
    }
    /**
     * 远程调用
     * @param method 方法名
     */
    call(method: string, params?: any): Promise<any> {
        const eventId: string = uuid.v4() + "";
        return new Promise((resolve, reject) => {
            this.send(CommandEnum.CALL, { method, eventId, params });
            this.callEvents.set(eventId, { resolve, reject });
        });
    }
    /**
     * 远程调用的回调
     * @param data 数据
     */
    private _callBack(data: ICallBackData) {
        const eventId = data.eventId;
        if (!eventId) return;
        const promiseData = this.callEvents.get(eventId);
        if (!promiseData) return;
        if (data.error) {
            promiseData.reject(data.error);
        } else {
            promiseData.resolve(data.success);
        }
        this.callEvents.delete(eventId);
    }
}
export default NClient;
