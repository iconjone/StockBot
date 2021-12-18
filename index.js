// import data collector
const express = require('express');
const krakenData = require('./krakenData');
const websocketServer = require('./websocketServer');

krakenData.collectData('ETH');

krakenData.emitter.on('tickerClose', (data) => {
  // console.log("there's data", data);
  websocketServer.wss.broadcast({ tickerClose: data });
});
const limit = 3950;

websocketServer.emitter.on('request', async (request) => {
  if (request.type === 'ticker') {
    const data = await krakenData.getPricesData(request.tradingSymbol, request.interval);
    websocketServer.emitter.emit('requestResponse', { prices: data, limit });
  }
});

// setting middleware
const app = express();
app.use(express.static('./web')); // Serves resources from public folder

app.listen(5000); // const server = app.listen(5000);
