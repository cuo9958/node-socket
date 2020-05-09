# node-socket

使用 nodejs 开发的 socket 通讯,目前支持 tcp 协议。

支持客户端监听服务端的通知、事件。使用路由方式在客户端监听。

支持远程调用。服务端注册方法，客户端调用方法即可。

## 功能

1. tcp 的 server 和 client 互相发送消息
2. 消息格式处理，目前支持 json

## 功能说明

1. 心跳。客户端发起，5 秒一次。10 秒没有响应就断开连接。
2. 连接。客户端和服务端建立连接之后发送校验 token，token 验证成功则发送成功 ack。

## 使用

可以查看`test`目录下的文件

```javascript
import NClient from "../src/NClient";

const ct = new NClient();

ct.listen(18000);

const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(), time));

ct.use("test", async function (data) {
    console.log("1", data);
    await sleep(3000);
    console.log("1_end");
    return data + 1;
});

ct.use("test", async function (data) {
    console.log("2", data);
    await sleep(2000);
    console.log("2_end");
    return data + 1;
});
```

## 服务端 API

1. `cfg`。服务端的配置，保存了使用到的配置内容。
2. `listen(port = 4000, host?: string)`。启动服务端的监听，传入监听的端口，可选的 hostname。
3. `notice(uid: string, group: string, data: any)`。主动通知除 uid 之外该房间的所有人。
4. `sendTo(uid: string, command: string, data?: any)`。给 uid 对应的客户端发送消息。
5. `sendAll(command: string, data?: any)`。给所有人发送消息

## 客户端 API

1. `cfg`。配置信息。
2. `info`。当前状态信息
3. `listen(port = 3000, host?: string)`。启动监听服务。
4. `retry`。重新连接服务端。
5. `send(command, data, group?)`。发送消息。
6. `sendGroup(data:any)`。给房间群组发送消息。
7. `setGroup(group: string)`。设置房间/群组的名称
8. `onNotice(fn: any)`。当收到群体通知的时候。
9. `use(routeName:string, fn:any)`。路由事件。
10. `call(method: string)`。远程调用方法

## 包含的功能

1. 客户端/服务端创建
2. TCP 协议连接和断开
3. 心跳检测
4. 路由
5. 组/房间标记
6. 双队列服务，标记准备中和准备好的客户端
7. 客户端发送消息到客户端，发送房间消息
8. 远程调用。服务端注册方法，客户端调用
