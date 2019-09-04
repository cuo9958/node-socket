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
        this.event = {};
        server.on('listening', this.onListen.bind(this));
        server.on('error', err => this.onError(err));
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
    /**
     * 错误处理
     * @param {*} error
     */
    onError(error) {
        console.log('tcp服务错误', error);
    }
    /**
     * 关闭tcp服务，一般没啥用
     */
    onClose() {
        console.log('关闭tcp服务');
    }
    /**
     * 客户端消息连接
     * @param {*} socket
     */
    onConnection(socket) {
        this._pushClient(socket);
        this.server.getConnections((err, count) => {
            if (!err) this.count = count;
            console.log('已连接客户端', this.count);
        });
    }
    /**
     * 客户端消息监听
     * @param {*} data
     * @param {*} uid
     */
    onMessage(data, uid) {
        switch (data.command) {
            case '_heart':
                this._heart(data.data, data.time, uid);
                break;
            default:
                this.emit(data.command, data.data, data.time);
                break;
        }
    }
    /**
     * 客户端退出监听，
     * @param {*} uid
     */
    onClientClose(uid) {
        console.log('客户端退出', uid);
        this.clients.delete(uid);
        this.count = this.clients.size;
    }
    /**
     * 加入对应的客户端，修饰一次客户端
     * @param {*} socket
     */
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
        socket.on('data', data =>
            this.onMessage(this.cmd.decode(data), client.uid)
        );
        socket.on('close', () => this.onClientClose(client.uid));
        client.send('_auth', client.uid);
    }
    /**
     * 发送给对应的人
     * @param {*} uid
     * @param {*} command
     * @param {*} data
     */
    sendTo(uid, command, data) {
        const client = this.clients.get(uid);
        if (client) {
            client.send(command, data);
        }
    }
    /**
     * 发送给所有人
     * @param {*} command
     * @param {*} data
     */
    sendAll(command, data) {
        this.clients.forEach(client => {
            client.send(command, data);
        });
    }
    /**
     * 发送给uid以外的人
     * @param {*} uid
     * @param {*} command
     * @param {*} data
     */
    sendNot(uid, command, data) {
        this.clients.forEach(client => {
            if (client.uid !== uid) client.send(command, data);
        });
    }
    /**
     * 创建一个固定命令的发送消息方法
     * @param {*} command
     */
    createSendTo(command) {
        return (uid, data) => {
            this.sendTo(uid, command, data);
        };
    }
    /**
     * 事件监听
     * @param {*} key
     * @param {*} fn
     */
    on(key, fn) {
        if (!this.event[key]) this.event[key] = [];
        this.event[key].push(fn);
    }
    /**
     * 删除事件监听
     * @param {*} key
     * @param {*} fn
     */
    off(key, fn) {
        if (this.event[key]) {
            this.event[key] = this.event[key].filter(item => item !== fn);
        }
    }
    /**
     * 触发事件
     * @param {*} key
     * @param {*} data
     */
    emit(key, data) {
        const list = this.event[key];
        if (list && list.constructor === Array) {
            list.forEach(fn => {
                fn(data);
            });
        }
    }
    /**
     * 收到心跳消息，消息有问题则关闭，更新存活时间
     * @param {*} data
     * @param {*} time
     * @param {*} uid
     */
    _heart(data, time, uid) {
        console.log('收到心跳', data, uid);
        if (data !== uid) return this.close(uid);
    }
    /**
     * 关闭对应uid的客户端连接
     * @param {*} uid
     */
    close(uid) {
        console.log('主动关闭', uid);
        const client = this.clients.get(uid);
        if (client) client.socket.end();
    }
}

module.exports = {
    factoryTcpServer: function(port) {
        return new TcpServer(port);
    },
    TcpServer
};
