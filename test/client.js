const { TcpClient } = require('../index');

const client = TcpClient.factoryTcpClient(18000);

client.on('aaa', function(data) {
    console.log('消息', data);
});

setTimeout(() => {
    client.send('join', '连接');
}, 5000);
