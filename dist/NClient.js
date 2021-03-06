"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 客户端
 */
const net_1 = __importDefault(require("net"));
const cron_1 = require("cron");
const uuid_1 = __importDefault(require("uuid"));
const utils_1 = require("./utils");
class NClient {
    constructor(opts) {
        this.cfg = {
            debug: false,
            port: 3000,
            host: "127.0.0.1",
            token: "",
            group: "",
        };
        this.info = {
            uid: "",
            closed: true,
            retryCount: 0,
            connect: false,
        };
        this.loger = (arg1, arg2, arg3) => { };
        this.events = new Map();
        this.callEvents = new Map();
        this._heart = () => {
            if (this.info.closed)
                return;
            if (!this.info.connect) {
                return this.sendToken();
            }
            this.loger("发送心跳");
            this.send(utils_1.CommandEnum.HEART, "");
        };
        this.onConnect = () => {
            this.loger("已连接");
            this.info.closed = false;
            this.info.retryCount = 0;
            this.sendToken();
        };
        this.onError = (err) => {
            this.loger("错误", err);
        };
        this.onClosed = (had_err) => {
            this.loger("关闭", had_err);
            this.info.closed = true;
            setTimeout(() => {
                this.retry();
            }, 3000);
        };
        this.onTimeOut = () => {
            this.loger("超时");
        };
        /**
         * 接收到消息
         */
        this.onMessage = (buf) => {
            const data = utils_1.ToData(buf);
            //收到确认消息
            if (data.command === utils_1.CommandEnum.ACK) {
                return this.setInfo(data.data);
            }
            if (data.command === utils_1.CommandEnum.NOTICE) {
                return this._execNotice(data.data);
            }
            if (data.command === utils_1.CommandEnum.CALL) {
                return this._callBack(data.data);
            }
            this.execRoute(data);
        };
        /**
         * 定时清除超时的调用事件
         */
        this._checkCall = () => {
            const now = Date.now();
            this.callEvents.forEach((v, k) => {
                if (now - v.time > 30000) {
                    const promiseData = v;
                    promiseData.reject("等待超时");
                    this.callEvents.delete(k);
                }
            });
        };
        if (opts) {
            for (const key in opts) {
                const v = opts[key];
                this.cfg[key] = v;
            }
        }
        this.loger = utils_1.createLog(this.cfg.debug);
        new cron_1.CronJob("*/5 * * * * *", this._heart).start();
        new cron_1.CronJob("0 * * * * *", this._checkCall).start();
    }
    // private timer = null;
    /**
     * 开始监听远程服务
     * @param port 端口
     * @param host ip
     */
    listen(port = 3000, host) {
        this.cfg.port = port;
        if (host)
            this.cfg.host = host;
        this.start();
    }
    start() {
        const socket = net_1.default.connect(this.cfg.port, this.cfg.host);
        socket.setKeepAlive(true);
        socket.on("connect", this.onConnect);
        socket.on("data", (data) => this.onMessage(data));
        socket.on("close", this.onClosed);
        socket.on("error", this.onError);
        socket.on("timeout", this.onTimeOut);
        this.info.uid = "";
        this.info.closed = true;
        this.socket = socket;
    }
    /**
     * 重试
     */
    retry() {
        if (!this.info.closed)
            return;
        this.loger("重试", this.info.retryCount);
        this.info.retryCount++;
        this.clearSocket();
        this.start();
    }
    clearSocket() {
        this.socket.removeAllListeners();
        this.socket.end();
        this.socket.destroy();
    }
    /**
     * 发送鉴权申请
     */
    sendToken() {
        this.loger("进行内部鉴权");
        this.info.connect = false;
        this.send(utils_1.CommandEnum.TOKEN, {
            token: this.cfg.token,
            group: this.cfg.group,
        });
    }
    /**
     * 登录成功,设置当前信息
     * @param data 数据
     */
    setInfo(data) {
        this.loger("设置信息", data);
        this.info.uid = data.uid;
        this.info.connect = true;
    }
    /**
     * 发送命令和数据
     * @param command 命令
     * @param data 数据
     */
    send(command, data, group) {
        this.socket.write(utils_1.ToBuff(command, data, group));
    }
    /**
     * 向同组成员发送命令,不会向自己发送
     * @param data 数据
     */
    sendGroup(data) {
        this.send(utils_1.CommandEnum.NOTICE, data, this.cfg.group);
    }
    /**
     * 设置房间名称
     * @param group 房间
     */
    setGroup(group) {
        this.cfg.group = group;
    }
    /**
     * 添加对命令的路由内容
     * @param routeName 路由名
     * @param fn 执行方法
     */
    use(routeName, fn) {
        const list = this.events.get(routeName) || [];
        list.push(fn);
        this.events.set(routeName, list);
    }
    /**
     * 执行路由中间件
     * @param data 数据
     */
    execRoute(data) {
        const list = this.events.get(data.command) || [];
        this.execFn(list, data.data);
    }
    async execFn(list, data) {
        if (list.length === 0)
            return;
        const fn = list.shift();
        const data2 = await fn(data);
        if (list.length > 0) {
            await this.execFn(list, data2);
        }
    }
    /**
     * 收到通知消息
     * @param data 数据
     */
    _execNotice(data) {
        this.noticeEvent && this.noticeEvent(data);
    }
    /**
     * 设置收到通知之后的回调
     * @param fn 方法
     */
    onNotice(fn) {
        this.noticeEvent = fn;
    }
    /**
     * 远程调用
     * @param method 方法名
     */
    call(method, params) {
        const eventId = uuid_1.default.v4() + "";
        this.loger("远程调用", method);
        return new Promise((resolve, reject) => {
            this.send(utils_1.CommandEnum.CALL, { method, eventId, params });
            this.callEvents.set(eventId, { resolve, reject, time: Date.now() });
        });
    }
    /**
     * 远程调用的回调
     * @param data 数据
     */
    _callBack(data) {
        const eventId = data.eventId;
        if (!eventId)
            return;
        const promiseData = this.callEvents.get(eventId);
        if (!promiseData)
            return;
        if (data.error) {
            promiseData.reject(data.error);
        }
        else {
            promiseData.resolve(data.success);
        }
        this.callEvents.delete(eventId);
    }
}
exports.NClient = NClient;
exports.default = NClient;
