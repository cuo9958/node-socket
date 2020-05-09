"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 命令json化
 */
exports.Command = {
    /**
     * 将命令转成字符串
     * @param command 命令
     * @param data 数据
     */
    encode: function (command, data, group = "") {
        let obj = {
            command,
            data,
            time: Date.now(),
        };
        if (group) {
            obj.group = group;
        }
        return JSON.stringify(obj);
    },
    /**
     * 将字符串格式化成命令、数据
     * @param str 字符串
     */
    decode: function (str) {
        try {
            return JSON.parse(str);
        }
        catch (error) {
            console.log(error, str);
            return {
                command: "",
                time: 0,
            };
        }
    },
};
/**
 * 命令枚举
 */
var CommandEnum;
(function (CommandEnum) {
    /**
     * 鉴权成功回复,服务端发送
     */
    CommandEnum["ACK"] = "_ack";
    /**
     * token鉴权,客户端发送
     */
    CommandEnum["TOKEN"] = "_token";
    /**
     * 心跳,双端
     */
    CommandEnum["HEART"] = "_heart";
    /**
     * 房间的通知消息,双端
     */
    CommandEnum["NOTICE"] = "_notice";
})(CommandEnum = exports.CommandEnum || (exports.CommandEnum = {}));
/**
 * 把命令转成字节
 * @param command 命令
 * @param data 数据
 * @param group 房间组
 */
function ToBuff(command, data, group) {
    const str = exports.Command.encode(command, data, group);
    const len = Buffer.byteLength(str);
    const buf = Buffer.alloc(5 + len);
    buf.writeInt16LE(len, 0);
    buf.fill(str, 5);
    return buf;
}
exports.ToBuff = ToBuff;
/**
 * 将字节转成对象
 * @param data 字节
 */
function ToData(data) {
    const head = data.slice(0, 5);
    const len = head.readInt16LE(0);
    const str = data.slice(5, len + 5).toString();
    const cmd = exports.Command.decode(str);
    return cmd;
}
exports.ToData = ToData;
/**
 * 自定义日志
 * @param debug 开关
 */
function createLog(debug) {
    if (debug) {
        return function (...args) {
            console.log(...args);
        };
    }
    else {
        return function () { };
    }
}
exports.createLog = createLog;
