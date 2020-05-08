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
    encode: function (command, data): string {
        return JSON.stringify({
            command,
            data,
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
