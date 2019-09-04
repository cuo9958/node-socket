/**
 * 使用tcp来做通讯
 */
const net = require('net');
const uuid = require('uuid');
const cmd = require('./cmd');

class TcpServer {
    constructor(port, type = 'json') {
        const server = net.createServer();
        this.server = server;
        this.clients = new Map();
        this.cmd = cmd.get(type);
        this.count = 0;
        server.on('listening', this.onListen.bind(this));
        server.on('error', this.onError.bind(this));
        server.on('close', this.onClose.bind(this));
        server.on('connection', this.onConnection.bind(this));
        server.listen(port);
    }
    //  server
    //  clients
    //  count
    onListen() {
        console.log('监听开始，端口', this.server.address().port);
    }
    onError(error) {
        console.log('tcp服务错误', error);
    }
    onClose() {
        console.log('关闭tcp服务');
    }
    onConnection(socket) {
        this._pushClient(socket);
        this.server.getConnections((err, count) => {
            if (!err) this.count = count;
            console.log('已连接客户端', this.count);
        });
    }
    onMessage(str) {
        console.log(str);
    }
    onClientClose(uid) {
        console.log('客户端退出', uid);
        this.clients.delete(uid);
    }

    _pushClient(socket) {
        const client = {
            socket,
            uid: uuid.v4(),
            send: (command, data) =>
                socket.write(this.cmd.encode(command, data))
        };
        socket.setEncoding(this.cmd.encoding);
        console.log('客户端连接', client.uid);
        this.clients.set(client.uid, client);
        socket.on('data', data => this.onMessage(this.cmd.decode(data)));
        socket.on('close', () => this.onClientClose(client.uid));
        client.send('auth', client.uid);
    }

    sendTo(uid, command, data) {
        const client = this.clients.get(uid);
        if (client) {
            client.send(command, data);
        }
    }
    sendAll(command, data) {
        this.clients.forEach(client => {
            client.send(command, data);
        });
    }
    sendNot(uid, command, data) {
        this.clients.forEach(client => {
            if (client.uid !== uid) client.send(command, data);
        });
    }
}

module.exports = {
    factoryTcpServer: function(port) {
        return new TcpServer(port);
    },
    TcpServer
};
