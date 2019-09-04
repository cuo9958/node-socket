const { TcpClient } = require('../index');

const client = TcpClient.factoryTcpClient(18000);

setTimeout(() => {
    client.send('join', '连接');
}, 5000);
