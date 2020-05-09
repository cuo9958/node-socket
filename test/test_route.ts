import { NClient } from "../src/NClient";

const ct = new NClient({
    debug: true,
});

ct.listen(18000);

const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(), time));

//服务端通知路由方式
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

