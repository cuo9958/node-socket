import NServer from "../src/NServer";

const server = new NServer({
    debug: true,
});

server.listen(18000);
