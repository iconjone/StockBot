// import data collector
const express = require('express');
const dataCollector = require('./dataCollector');
const websocketServer = require('./websocketServer');

dataCollector.collectData('ETH');

dataCollector.emitter.on('tickerClose', (data) => {
  websocketServer.wss.broadcast({ tickerClose: data });
});

websocketServer.emitter.on('request', async (request) => {
  const data = await dataCollector.getPricesData(request.tradingSymbol, request.interval);
  websocketServer.emitter.emit('requestResponse', data);
});

// setting middleware
const app = express();
app.use(express.static('./web')); // Serves resources from public folder

app.listen(5000); // const server = app.listen(5000);
