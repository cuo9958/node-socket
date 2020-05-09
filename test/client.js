const { NClient } = require("../dist/NClient");

const ct = new NClient({
    debug: true,
});

ct.listen(18000);
console.log("监听端口", 18000);
//远程调用服务端方式
async function main() {
    const data = await ct.call("test.test");
    console.log("远程调用", data);
}
setTimeout(() => {
    main();
}, 3000);
