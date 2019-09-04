const { TcpServer } = require('../index');

const test = TcpServer.factoryTcpServer(18000);

test.on('join', function(data) {
    console.log('消息', data);
});
setTimeout(() => {
    test.sendAll('aaa', 'adwadw');
    console.log(test.count);
}, 5000);
