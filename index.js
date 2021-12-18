// import data collector
const express = require('express');
const krakenData = require('./krakenData');
const websocketServer = require('./websocketServer');
const orderCalculator = require('./orderCalculator');

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

orderCalculator.emitter.on('data', async (data) => {
  if (data.request === 'balance') {
    const balance = await krakenData.getBalance();
    orderCalculator.emitter.emit('balanceResponse', balance);
  } else if (data.request === 'lastTrade') {
    const lastTrade = await krakenData.getLastTrade(data.tradingSymbol);
    orderCalculator.emitter.emit('lastTradeResponse', lastTrade);
  }
});
// Testing Async functions
async function test() {
  console.log(await orderCalculator.determineMode('ETH'));
  console.log('after');
  console.log(await orderCalculator.calculateBreakEvenBeforeSell('ETH'));
}
test();

// setting middleware
const app = express();
app.use(express.static('./web')); // Serves resources from web folder

app.listen(5000); // const server = app.listen(5000);
