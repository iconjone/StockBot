const { EventEmitter } = require('events');

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
      console.log(lastTrade);
      resolve((lastTrade.fee + lastTrade.cost) / lastTrade.amount);
    });
  });
}
module.exports = { emitter, determineMode, calculateBreakEvenBeforeSell };
