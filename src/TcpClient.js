/**
 * 客户端调用方法
 */
const net = require('net');
const cmd = require('./cmd');
/**
 * 重试次数
 */
const RETRY_COUNT = 10;

class TcpClient {
    constructor(port, type = 'json') {
        this.port = port;
        this.type = type;
        this.retryCount = RETRY_COUNT;
        this.init();
    }

    init() {
        const socket = net.connect(this.port);
        this.socket = socket;
        this.cmd = cmd.get(this.type);
        this.event = {};
        this.timer = null;
        this.uid = '';
        socket.setEncoding(this.cmd.encoding);
        socket.on('connect', this.onConnect.bind(this));
        socket.on('data', data => this.onMessage(this.cmd.decode(data)));
        socket.on('close', this.onClosed.bind(this));
        socket.on('error', this.onError.bind(this));
        socket.on('timeout', this.onTimeOut.bind(this));
    }
    retry() {
        console.log('重试', this.retryCount);
        this.retryCount--;
        this.socket.removeAllListeners();
        this.socket.end();
        this.socket.destroy();
        this.socket = null;
        this.event = [];
        if (this.retryCount < 0) return;
        this.init();
    }
    onConnect() {
        this.retryCount = RETRY_COUNT;
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
    /**
     * 监听到错误的时候出发重试
     * @param {*} err
     */
    onError(err) {
        console.log('错误', err);
        setTimeout(() => {
            this.retry();
        }, 3000);
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
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.timer = setInterval(() => {
            console.log('发送一次心跳');
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
