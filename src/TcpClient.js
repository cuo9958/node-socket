const net = require('net');

function createClient(socket) {
    return {
        socket,
        uid: '',
        send: function(...args) {
            socket.write(cmd.push(...args));
        }
    };
}

const def = {
    port: 8080,
    timeout: 1000,
    token: '123456'
};

function createClient(opts) {
    const socket = net.connect(opts.port);
    socket.setEncoding('utf8');
    socket.on('connect', function() {
        console.log('connect');
    });
    socket.on('data', function(data) {
        console.log('data', data);
    });
    //当写入缓冲区变为空时触发。可以用来做上传节流
    socket.on('drain', function() {
        console.log('drain');
    });
    socket.on('end', function() {
        console.log('end');
    });
    socket.on('close', function(had_err) {
        console.log('close', had_err);
    });
    socket.on('error', function(err) {
        console.log('error', err);
    });
    //在找到主机之后创建连接之前触发。不可用于 Unix socket。
    socket.on('lookup', function(err, address, family, host) {
        console.log('lookup', err, address, family, host);
    });
    socket.on('timeout', function() {
        console.log('timeout');
    });
}

createClient({
    port: 18000
});
