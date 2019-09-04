const { TcpServer } = require('../index');

const test = TcpServer.factoryTcpServer(18000);
setTimeout(() => {
    test.sendAll('aaa', 'adwadw');
    console.log(test.count);
}, 5000);
