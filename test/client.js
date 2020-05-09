const { NClient } = require("../dist/NClient");

const ct = new NClient();

ct.listen(18000);
console.log("监听端口", 18000);
const sleep = (time) => new Promise((resolve) => setTimeout(() => resolve(), time));
ct.use("test", async function (data) {
    console.log("1", data);
    await sleep(3000);
    console.log("1_end");
    return data + 1;
});

// ct.use("test", async function (data) {
//     console.log("2", data);
//     await sleep(2000);
//     console.log("2_end");
//     return data + 1;
// });
