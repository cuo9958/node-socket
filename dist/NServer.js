"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 服务端
 */
const net_1 = __importDefault(require("net"));
const uuid_1 = __importDefault(require("uuid"));
const cron_1 = require("cron");
const utils_1 = require("./utils");
class NServer {
    constructor(opts) {
        this.cfg = {
            debug: false,
            token: "",
        };
        this.loger = (arg1, arg2, arg3) => { };
        //预加载客户端队列
        this.preClients = new Map();
        //客户端队列
        this.clients = new Map();
        //注册的方法
        this.callEvents = new Map();
        /**
         * 建立新的连接时
         */
        this.onConnect = () => {
            if (this.server) {
                const addr = this.server.address();
                this.loger("监听开始，端口", typeof addr === "string" ? addr : addr.port);
            }
        };
        /**
         * 错误处理
         * @param {*} error err
         */
        this.onError = (error) => {
            this.loger("tcp服务错误", error);
        };
        /**
         * 关闭tcp服务，一般没啥用
         */
        this.onClose = () => {
            this.loger("关闭tcp服务");
        };
        /**
         * 客户端消息连接
         * @param {*} socket
         */
        this.onConnection = (socket) => {
            if (!this.server)
                return;
            this._pushClient(socket);
            this.server.getConnections((err, count) => {
                if (!err) {
                    this.loger("现有客户端连接", count);
                }
            });
        };
        /**
         * 检查客户端健康
         */
        this._checks = () => {
            const now = Date.now();
            this.clients.forEach((client) => {
                if (now - client.date > 10000) {
                    client.end();
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
        this.timer = new cron_1.CronJob("*/5 * * * * *", this._checks).start();
    }
    /**
     * 启动监听
     * @param port 端口
     * @param host ip
     */
    listen(port = 4000, host) {
        const server = net_1.default.createServer();
        server.on("listening", this.onConnect);
        server.on("error", this.onError);
        server.on("close", this.onClose);
        server.on("connection", this.onConnection);
        server.listen(port, host);
        this.loger("完成监听", port);
        this.server = server;
    }
    /**
     * 处理新加入的客户端
     * @param socket 客户端实例
     */
    _pushClient(socket) {
        const client = new OneClient(socket);
        socket.on("close", () => this.onClientClose(client.uid));
        client.setMessage((uid, data) => this.onMessage(uid, data));
        this.preClients.set(client.uid, client);
        this.loger("客户端连接", client.uid);
    }
    /**
     * 收到客户端的消息
     * @param data buffer
     */
    onMessage(uid, data) {
        this.loger("收到消息", data);
        if (data.command === utils_1.CommandEnum.HEART)
            return;
        if (data.command === utils_1.CommandEnum.TOKEN) {
            return this.checkToken(uid, data.data);
        }
        if (data.command === utils_1.CommandEnum.NOTICE) {
            return this.notice(uid, data.group, data.data);
        }
        if (data.command === utils_1.CommandEnum.CALL) {
            return this.onCall(uid, data.data);
        }
    }
    /**
     * 去掉客户端
     * @param uid uid
     */
    onClientClose(uid) {
        this.clients.delete(uid);
        this.preClients.delete(uid);
    }
    /**
     * 检查token的合法性
     * @param uid uid
     * @param data 数据
     */
    checkToken(uid, data) {
        if (this.cfg.token === data.token) {
            this.loger("鉴权", data);
            this.readClient(uid);
            this.sendTo(uid, utils_1.CommandEnum.ACK, { uid });
        }
        else {
            this.onClientClose(uid);
        }
    }
    /**
     * 转移客户端队列到正式队列
     * @param uid uid
     */
    readClient(uid) {
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
    sendTo(uid, command, data) {
        const client = this.clients.get(uid);
        client.send(command, data);
    }
    /**
     * 给除uid之外的所有人发送消息
     * @param uid uid
     * @param command 命令
     * @param data 数据
     */
    sendNot(uid, command, data) {
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
    sendAll(command, data) {
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
    notice(uid, group, data) {
        if (!group)
            return;
        this.clients.forEach((client) => {
            if (client.uid !== uid && client.group === group) {
                client.send(utils_1.CommandEnum.NOTICE, data);
            }
        });
    }
    /**
     * 当客户端要远程调用服务端注册的方法的时候
     * @param data 数据
     */
    async onCall(uid, data) {
        const method = data.method;
        const eventId = data.eventId;
        const params = data.params;
        if (!method || !eventId)
            return;
        const fn = this.callEvents.get(method);
        if (!fn) {
            return this.callBack(uid, eventId, null, "方法不存在");
        }
        try {
            const res = await fn(params);
            this.callBack(uid, eventId, res);
        }
        catch (error) {
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
    callBack(uid, eventId, success, error) {
        if (error) {
            this.sendTo(uid, utils_1.CommandEnum.CALL, {
                eventId,
                error,
            });
        }
        else {
            this.sendTo(uid, utils_1.CommandEnum.CALL, {
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
    regMethod(method, fn) {
        this.callEvents.set(method, fn);
    }
}
exports.NServer = NServer;
exports.default = NServer;
/**
 * 单独的客户端管理类
 */
class OneClient {
    constructor(socket) {
        this.uid = uuid_1.default.v4();
        this.socket = socket;
        this.create = this.date = Date.now();
        socket.on("data", (data) => this.onMessage(data));
    }
    onMessage(data) {
        this.date = Date.now();
        const cmd = utils_1.ToData(data);
        if (cmd.group) {
            this.group = cmd.group;
        }
        this.msgEvent && this.msgEvent(this.uid, cmd);
    }
    setMessage(fn) {
        this.msgEvent = fn;
    }
    /**
     * 收到token消息
     */
    ack() {
        this.send(utils_1.CommandEnum.ACK, this.uid);
    }
    end() {
        this.socket.end();
    }
    /**
     * 发送字节数据
     * @param command 命令
     * @param data 数据
     */
    send(command, data) {
        this.socket.write(utils_1.ToBuff(command, data));
    }
}
