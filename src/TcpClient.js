/**
 * 客户端调用方法
 */
const net = require('net');
const cmd = require('./cmd');

class TcpClient {
    constructor(port, type = 'json') {
        const socket = net.connect(port);
        this.socket = socket;
        this.cmd = cmd.get(type);
        this.event = {};
        this.retry = 5;
        this.timer = null;
        this.uid = '';
        socket.setEncoding(this.cmd.encoding);
        socket.on('connect', this.onConnect.bind(this));
        socket.on('data', data => this.onMessage(this.cmd.decode(data)));
        socket.on('close', this.onClosed.bind(this));
        socket.on('error', this.onError.bind(this));
        socket.on('timeout', this.onTimeOut.bind(this));
    }

    onConnect() {
        this.retry = 5;
        console.log('已连接');
    }
    onMessage(data) {
        switch (data.command) {
            case '_auth':
                this._auth(data.data);
                break;
            default:
                this.emit(data.command, data.data, data.time);
                break;
        }
    }
    onClosed(had_err) {
        console.log('关闭', had_err);
    }
    onError(err) {
        console.log('错误', err);
    }
    onTimeOut() {
        console.log('超时');
    }

    send(command, data) {
        this.socket.write(this.cmd.encode(command, data));
    }

    on(key, fn) {
        if (!this.event[key]) this.event[key] = [];
        this.event[key].push(fn);
    }
    off(key, fn) {
        if (this.event[key]) {
            this.event[key] = this.event[key].filter(item => item !== fn);
        }
    }
    emit(key, data) {
        const list = this.event[key];
        if (list && list.constructor === Array) {
            list.forEach(fn => {
                fn(data);
            });
        }
    }

    runHeartBeat() {
        this.timer = setInterval(() => {
            this.send('_heart', this.uid);
        }, 1000);
    }
    _auth(uid) {
        this.uid = uid;
        this.runHeartBeat();
    }
}

module.exports = {
    factoryTcpClient: function(port) {
        return new TcpClient(port);
    },
    TcpClient
};
