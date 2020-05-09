export interface ICommandData {
    command: string;
    data?: any;
    group?: string;
    time: number;
}
/**
 * 命令json化
 */
export const Command = {
    /**
     * 将命令转成字符串
     * @param command 命令
     * @param data 数据
     */
    encode: function (command, data, group = ""): string {
        let obj: any = {
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
    decode: function (str): ICommandData {
        try {
            return JSON.parse(str);
        } catch (error) {
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
export enum CommandEnum {
    /**
     * 鉴权成功回复,服务端发送
     */
    ACK = "_ack",
    /**
     * token鉴权,客户端发送
     */
    TOKEN = "_token",
    /**
     * 心跳,双端
     */
    HEART = "_heart",
    /**
     * 房间的通知消息,双端
     */
    NOTICE = "_notice",
    /**
     * 远程调用方法
     */
    CALL = "_call",
}

/**
 * 把命令转成字节
 * @param command 命令
 * @param data 数据
 * @param group 房间组
 */
export function ToBuff(command: string, data: any, group?: string): Buffer {
    const str = Command.encode(command, data, group);
    const len = Buffer.byteLength(str);
    const buf = Buffer.alloc(5 + len);
    buf.writeInt16LE(len, 0);
    buf.fill(str, 5);
    return buf;
}
/**
 * 将字节转成对象
 * @param data 字节
 */
export function ToData(data: Buffer): ICommandData {
    const head = data.slice(0, 5);
    const len = head.readInt16LE(0);
    const str = data.slice(5, len + 5).toString();
    const cmd = Command.decode(str);
    return cmd;
}
/**
 * 自定义日志
 * @param debug 开关
 */
export function createLog(debug: boolean) {
    if (debug) {
        return function (...args) {
            console.log(...args);
        };
    } else {
        return function () {};
    }
}

export interface ICallBackData {
    eventId: string;
    success?: any;
    error?: any;
}
