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

  krakenData.emitter.on('ohlcUpdate', (data) => {
    if (data === 'ohlc-240') {
      orderCalculator.emitter.emit('ohlcUpdate');
    }
  });

  websocketServer.emitter.on('request', async (request) => {
    if (request.type === 'ticker') {
      const data = await krakenData.getPricesData(tradingSymbol, request.interval);
      const mode = await orderCalculator.determineMode(tradingSymbol);
      // mode = 'buy';

      let breakEven;
      let lastTrade;
      if (mode === 'sell') {
        lastTrade = await krakenData.getLastTrade(tradingSymbol);
        breakEven = await orderCalculator.calculateBreakEvenBeforeSell(tradingSymbol);
      }
      websocketServer.emitter.emit('requestResponse', {
        prices: data, breakEven, mode, lastTrade,
      });
      websocketServer.wss.broadcast({ limit: 4150 });
    }
  });

  orderCalculator.emitter.on('data', async (data) => {
    if (data.request === 'balance') {
      const balance = await krakenData.getBalance();
      orderCalculator.emitter.emit('balanceResponse', balance);
    } else if (data.request === 'lastTrade') {
      const lastTrade = await krakenData.getLastTrade(data.tradingSymbol);
      orderCalculator.emitter.emit('lastTradeResponse', lastTrade);
    } else if (data.request === 'ohlc') {
      const ohlc = await krakenData.dataStorage.ohlc;
      orderCalculator.emitter.emit('ohlcResponse', ohlc);
    }
  });

  orderCalculator.emitter.on('AOupdate', (data) => {
    websocketServer.wss.broadcast({ AO: data });
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

  orderCalculator.startCalculations();

  // after 1 minute send a limit
  setTimeout(() => {
    console.log('Sending limit');
    websocketServer.wss.broadcast({ limit: 4000 });
  }, 12000);
}
start();
