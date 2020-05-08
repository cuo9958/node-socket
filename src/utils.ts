export interface ICommandData {
    command: string;
    data?: any;
    time: number;
}
export const Command = {
    /**
     * 将命令转成字符串
     * @param command 命令
     * @param data 数据
     */
    encode: function (command, data, group = ""): string {
        return JSON.stringify({
            command,
            data,
            group,
            time: Date.now(),
        });
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
     * 心跳，双端
     */
    HEART = "_heart",
}
/**
 * 组别枚举
 */
export enum CommandGroup {
    /**
     * 同房间其他人
     */
    GROUP = "_group",
}
