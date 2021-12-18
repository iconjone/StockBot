require('dotenv').config();
const { EventEmitter } = require('events');

const KrakenRestClient = require('./kraken/KrakenRestClient');
const KrakenWebSocketClient = require('./kraken/KrakenWebSocketClient');

const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

const emitter = new EventEmitter();

const krakenRest = new KrakenRestClient(key, secret);
const krakenWebSocket = new KrakenWebSocketClient(key, secret);

function collectData(tradingSymbol) {
  krakenWebSocket.api('subscribe', 'ohlc', [`${tradingSymbol}/USD`]); // Subscribe to ohlc
  krakenWebSocket.api('subscribe', 'ticker', [`${tradingSymbol}/USD`]); // Subscribe to ticker

  krakenWebSocket.ws.on('message', (data) => {
    const messageData = JSON.parse(data);

    // console.log(data);
    if (messageData.event === undefined) {
      // console.log(data[2])
      if (messageData[2].includes('ticker')) {
        emitter.emit('tickerClose', messageData[1].c[0]);

        // console.log(data[1].c[0]);
      }
    }
  });
}

async function getPricesData(tradingSymbol, interval) {
  const data = await krakenRest.api('OHLC', {
    pair: `${tradingSymbol}/USD`,
    interval,
  });
  if (data.result[`${tradingSymbol}/USD`] === undefined) {
    // console.log('Error - trying again');

    return getPricesData(tradingSymbol, interval);
  }

  // console.log(data.result[`${tradingSymbol}/USD`].map(item=>{return parseFloat(item[4])}));
  return data.result[`${tradingSymbol}/USD`].map((item) => parseFloat(item[4]));
}

async function getBalance() {
  const data = await krakenRest.api('Balance', {});
  if (data.result === undefined) {
    return getBalance();
  }
  const ret = {};
  // remove the first letter (ZUSD -> USD, XETH -> ETH)
  const currencies = Object.keys(data.result).map((currency) => [
    currency.slice(1),
    data.result[currency],
  ]);
  currencies.forEach((currency) => {
    if (parseFloat(currency[1]) > 0.00001) {
      // Make sure small amounts get disregarded
      ret[currency[0]] = parseFloat(currency[1]);
    }
  });
  return ret;
}

async function getLastTrade(tradingSymbol, offset = 0) {
  const data = await krakenRest.api('ClosedOrders', { ofs: offset * 50 });
  if (data.result === undefined) {
    return getLastTrade(tradingSymbol);
  }
  // console.log(data);
  const closedKeys = Object.keys(data.result.closed);

  for (let i = 0; i < closedKeys.length; i += 1) {
    const closeKey = closedKeys[i];
    if (
      data.result.closed[closeKey].status === 'closed'
      && data.result.closed[closeKey].descr.pair === `${tradingSymbol}USD`
      && data.result.closed[closeKey].descr.type === 'buy'
    ) {
      return {
        ordertype: data.result.closed[closeKey].descr.ordertype,
        price: data.result.closed[closeKey].price,
        amount: data.result.closed[closeKey].vol_exec,
        time: data.result.closed[closeKey].closetm,
        fee: data.result.closed[closeKey].fee,
        cost: data.result.closed[closeKey].cost, // total cost is cost + fee
      };
    }
  }
  const newOffset = offset + 1; // Use pagination to go back 50 orders recursively
  return getLastTrade(tradingSymbol, newOffset);
}
// Testing Async Functions
// async function test() {
//   const data = await getLastTrade('ETH');
//   console.log(data);
// }
// test();
module.exports = {
  collectData,
  emitter,
  getPricesData,
  getBalance,
  getLastTrade,
};
