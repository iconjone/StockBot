//import data collector
const dataCollector = require('./dataCollector');
const websocketServer = require('./websocketServer');
dataCollector.collectData("ETH");

dataCollector.emitter.on('tickerClose', (data) => {
    console.log(data);
    websocketServer.wss.broadcast(data);
});