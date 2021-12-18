// import data collector
const express = require('express');
const chalk = require('chalk');
const krakenData = require('./krakenData');
const websocketServer = require('./websocketServer');
const orderCalculator = require('./orderCalculator');

const tradingSymbol = 'ETH';

function startEmitters() {
  krakenData.emitter.on('tickerClose', (data) => {
  // console.log("there's data", data);
    websocketServer.wss.broadcast({ tickerClose: data });
  });

  websocketServer.emitter.on('request', async (request) => {
    if (request.type === 'ticker') {
      const data = await krakenData.getPricesData(tradingSymbol, request.interval);
      const breakEven = await orderCalculator.calculateBreakEvenBeforeSell(tradingSymbol);
      const mode = await orderCalculator.determineMode(tradingSymbol);
      let lastTrade;
      if (mode === 'sell') {
        lastTrade = await krakenData.getLastTrade(tradingSymbol);
      }
      websocketServer.emitter.emit('requestResponse', {
        prices: data, breakEven, mode, lastTrade,
      });
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
}

function startWebServer() {
// setting middleware
  const app = express();
  app.use(express.static('./web')); // Serves resources from web folder

  app.listen(5000); // const server = app.listen(5000);
}

async function start() {
  console.log(chalk.green('Starting... Trading on: '), chalk.yellow(tradingSymbol));
  krakenData.collectData(tradingSymbol);

  startEmitters();
  startWebServer();

  // after 1 minute send a limit
  setTimeout(() => {
    console.log('Sending limit');
    websocketServer.wss.broadcast({ limit: 4000 });
  }, 6000);
}
start();
