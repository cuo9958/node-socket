# node-socket

使用 nodejs 开发的 socket 通讯,目前支持 tcp 协议。

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

## 包含的功能

1. 客户端/服务端创建
2. TCP 协议连接和断开
3. 心跳检测
4. 路由
