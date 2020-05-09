const { NServer } = require("../dist/NServer");

const server = new NServer({
    debug: true,
});

server.listen(18000);
const sleep = (time) => new Promise((resolve) => setTimeout(() => resolve(), time));

async function test(data) {
    console.log(data);
    await sleep(1000);
    return "test_123";
}
//注册远程调用
server.regMethod("test.test", test);
