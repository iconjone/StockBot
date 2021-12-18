// import data collector
const express = require('express');
const dataCollector = require('./dataCollector');
const websocketServer = require('./websocketServer');

dataCollector.collectData('ETH');

dataCollector.emitter.on('tickerClose', (data) => {
  // console.log("there's data", data);
  websocketServer.wss.broadcast({ tickerClose: data });
});

websocketServer.emitter.on('request', async (request) => {
  if (request.type === 'ticker') {
    const data = await dataCollector.getPricesData(request.tradingSymbol, request.interval);
    websocketServer.emitter.emit('requestResponse', data);
  }
});

//Testing limit moving
setTimeout(() => {
  websocketServer.wss.broadcast({ limit: 3950 });
}, 1 * 60 * 1000);

// setting middleware
const app = express();
app.use(express.static('./web')); // Serves resources from public folder

app.listen(5000); // const server = app.listen(5000);
