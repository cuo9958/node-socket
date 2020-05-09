/**
 * 客户端
 */
import net from "net";
import { CronJob } from "cron";
import { ICommandData, CommandEnum, CommandGroup, ToBuff, ToData } from "./utils";

interface IClientOpts {
    encoding?: string;
    /**
     * 所属房间
     */
    group: string;
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
    group: string;
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
        this.timer = new CronJob("*/5 * * * * *", this._heart).start();
        this.info.group = this.cfg.group;
    }

    cfg: IClientCfg = {
        port: 3000,
        host: "127.0.0.1",
        encoding: "utf8",
        token: "test",
        group: "",
    };

    info: IClientInfo = {
        uid: "",
        closed: true,
        retryCount: 0,
        group: "",
        connect: false,
    };
    events: Map<string, any> = new Map();
    /**
     * 内部的socket对象
     */
    socket: net.Socket | undefined;
    timer = null;
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
        // socket.setEncoding(this.cfg.encoding);
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
        console.log("发送心跳");
        this.send(CommandEnum.HEART, "");
    };

    /**
     * 重试
     */
    retry() {
        if (!this.info.closed) return;
        console.log("重试", this.info.retryCount);
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
        console.log("已连接");
        this.info.closed = false;
        this.info.retryCount = 0;
        this.sendToken();
    };
    private onError = (err: Error) => {
        console.log("错误", err);
    };
    private onClosed = (had_err: boolean) => {
        console.log("关闭", had_err);
        this.info.closed = true;
        setTimeout(() => {
            this.retry();
        }, 3000);
    };
    private onTimeOut = () => {
        console.log("超时");
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
        this.execRoute(data);
    };
    /**
     * 发送鉴权申请
     */
    private sendToken() {
        console.log("进行内部鉴权");
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
        console.log("设置信息", data);
        this.info.uid = data.uid;
        this.info.connect = true;
    }
    /**
     * 发送命令和数据
     * @param command 命令
     * @param data 数据
     */
    send(command, data, group?) {
        this.socket.write(ToBuff(command, data, group));
    }
    /**
     * 向同组成员发送命令,不会向自己发送
     * @param command 命令
     * @param data 数据
     */
    sendGroup(command, data) {
        this.send(command, data, CommandGroup.GROUP);
    }
    /**
     * 设置房间名称
     * @param group 房间
     */
    setGroup(group: string) {
        this.info.group = group;
    }
    /**
     * 添加对命令的路由内容
     * @param routeName 路由名
     * @param fn 执行方法
     */
    use(routeName, fn) {
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
}
export default NClient;
