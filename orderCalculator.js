const { EventEmitter } = require('events');
const algoAO = require('./algoAO');

const emitter = new EventEmitter();

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

async function getBuyLimit(tradingSymbol) {
  return new Promise((resolve) => {
    resolve(3500);
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

async function startCalculations() {
  console.log('Starting calculations...');
  emitter.on('ohlcUpdate', async () => {
    emitter.emit('AOupdate', algoAO.getAllAOs(await getOHLCData()));
  });
  setTimeout(async () => {
    algoAO.startMLAO();
  }, 3000);
  console.log('wait');
//   console.log(a.slice(650));
}

module.exports = {
  emitter, determineMode, calculateBreakEvenBeforeSell, getBuyLimit, startCalculations,
};
