// import data collector
require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const krakenData = require('./krakenData');
const websocketServer = require('./websocketServer');
const orderCalculator = require('./orderCalculator');

const tradingSymbol = process.env.TRADINGSYMBOL;

function startEmitters() {
  krakenData.emitter.on('tickerClose', (data) => {
  // console.log("there's data", data);
    websocketServer.wss.broadcast({ tickerClose: data });
    orderCalculator.emitter.emit('tickerClose', data);
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
      // websocketServer.wss.broadcast({ limit: 3900 });
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
    } else if (data.request === 'ticker') {
      const prices = await krakenData.dataStorage.prices;
      orderCalculator.emitter.emit('tickerResponse', prices);
    }
  });

  orderCalculator.emitter.on('AOupdate', (data) => {
    websocketServer.wss.broadcast({ AO: data });
  });

  orderCalculator.emitter.on('limitPredict', (data) => {
    websocketServer.wss.broadcast({ limit: data });
  });
}

function startWebServer() {
// setting middleware
  const app = express();
  app.use(express.static('./web')); // Serves resources from web folder

  app.listen(80); // const server = app.listen(5000);
  app.listen(443);
}

async function start() {
  console.log(chalk.green('Starting... Trading on: '), chalk.yellow(tradingSymbol));
  krakenData.collectData(tradingSymbol);

  startEmitters();
  startWebServer();

  orderCalculator.startCalculations(tradingSymbol);

  // after 1 minute send a limit
  // setInterval(() => {
  // random number between 3940 and 3990
  // const limitRand = Math.floor(Math.random() * (3990 - 3940 + 1)) + 3940;
  // console.log(chalk.green('Sending limit: '), chalk.yellow(limitRand));

  // websocketServer.wss.broadcast({ limit: limitRand });
  // }, 12000);
}
start();
