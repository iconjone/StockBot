// import data collector
require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
// const mdns = require('mdns');

const krakenData = require('./krakenData');
const websocketServer = require('./websocketServer');
const orderCalculator = require('./orderCalculator');

const tradingSymbol = process.env.TRADING_SYMBOL;

const spreadHolder = [];

function startEmitters() {
  krakenData.emitter.on('tickerClose', (data) => {
  // console.log("there's data", data);
    lastPrice = data;
    websocketServer.wss.broadcast({ tickerClose: data });
    orderCalculator.emitter.emit('tickerClose', data);
  });

  krakenData.emitter.on('ohlcUpdate', (data) => {
    if (data === 'ohlc-240') {
      orderCalculator.emitter.emit('ohlcUpdate');
    }
  });
  const multiplier = 50;
  const big = multiplier * 45;
  const small = multiplier * 5;

  krakenData.emitter.on('spreadUpdate', (data) => {
    const average = (parseFloat(data[0]) + parseFloat(data[1])) / 2;
    if (spreadHolder.length > big) {
      spreadHolder.shift();
      spreadHolder.push(average);
    } else {
      spreadHolder.push(average);
    }
    // calculate average of last 34 spread values - average of last 5 spread values
    const spreadAverageBig = spreadHolder.reduce((a, b) => a + b, 0) / spreadHolder.length;
    const spreadAverageSmall = spreadHolder.slice(small * -1).reduce((a, b) => a + b, 0) / small;
    // console.log();
    if (spreadHolder.length > big) {
      websocketServer.wss.broadcast({ spreadMomentum: spreadAverageBig - spreadAverageSmall });
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
    const limit = data;
    fs.readFile('limitPredictions.txt', (err, data) => {
      const newData = { price: limit, time: moment().format('MMMM Do YYYY, h:mm:ss a'), mode: orderCalculator.mode };
      data += `${JSON.stringify(newData)}\n`;
      fs.writeFile('limitPredictions.txt', data, ((err) => { }));
    });
    websocketServer.wss.broadcast({ limit });
  });

  orderCalculator.emitter.on('react', (data) => {
    websocketServer.wss.broadcast({ react: data });
  });
}

function startWebServer() {
// setting middleware
  const app = express();
  app.use(express.static('./web')); // Serves resources from web folder
  // use mdns to name the server crypto

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
