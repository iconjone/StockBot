const { EventEmitter } = require('events');
const algoAO = require('./algoAO');
const reactive = require('./reactive');

const emitter = new EventEmitter();

const intervals = [1, 5, 15, 30, 60, 240];

async function determineMode(tradingSymbol) {
  emitter.emit('data', { request: 'balance' });
  return new Promise((resolve) => {
    emitter.once('balanceResponse', (balance) => {
      if (balance[tradingSymbol] !== undefined) {
        resolve('sell');
      }
      resolve('buy');
    });
  });
}

async function calculateBreakEvenBeforeSell(tradingSymbol) {
  emitter.emit('data', { request: 'lastTrade', tradingSymbol });
  return new Promise((resolve) => {
    emitter.once('lastTradeResponse', (lastTrade) => {
    //   console.log(lastTrade);
      resolve((lastTrade.fee + lastTrade.cost) / lastTrade.amount);
    });
  });
}

async function getOHLCData() {
  return new Promise((resolve) => {
    emitter.emit('data', { request: 'ohlc' });
    emitter.once('ohlcResponse', (ohlc) => {
      if (Object.keys(ohlc).length > 0) {
        resolve(ohlc);
      } else {
        // wait 25 ms and try again
        setTimeout(() => {
          resolve(getOHLCData());
        }, 25);
      }
    });
  });
}

async function getPricesData() {
  return new Promise((resolve) => {
    emitter.emit('data', { request: 'ticker' });
    emitter.once('tickerResponse', (data) => {
      resolve(data);
    });
  });
}

algoAO.emitter.on('limitPredict', (prediction) => {
  reactive.emitter.emit('limitPredict', prediction);
  console.log('Limit Predict', prediction);
  // average any limits that are not -1
  let average = 0;
  let count = 0;
  intervals.forEach((interval) => {
    if (prediction[interval].price !== -1) {
      average += prediction[interval].price;
      count += 1;
    }
  });
  average /= count;
  if (count !== 0) {
    emitter.emit('limitPredict', average);
  }
});

async function startCalculations(tradingSymbol) {
  console.log('Starting calculations...');
  emitter.on('ohlcUpdate', async () => {
    console.log('OHLC Update');
    const ohlc = await getOHLCData();
    const allAOs = algoAO.getAllAOs(ohlc);
    emitter.emit('AOupdate', allAOs);
    reactive.emitter.emit('ohlcUpdate', ohlc);
    reactive.emitter.emit('AOupdate', allAOs);
  });
  emitter.on('tickerClose', async (data) => {
    reactive.emitter.emit('tickerUpdate', data);
  });
  reactive.emitter.on('dataPrices', async () => {
    const prices = await getPricesData();
    reactive.emitter.emit('dataPricesResponse', prices);
  });
  const mode = await determineMode(tradingSymbol);
  reactive.passMode(mode);
  reactive.startReactive();
  algoAO.passMode(mode);
  algoAO.startMLAO(tradingSymbol);
}

module.exports = {
  emitter, determineMode, calculateBreakEvenBeforeSell, startCalculations,
};
