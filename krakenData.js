require('dotenv').config();
const { EventEmitter } = require('events');

const chalk = require('chalk');

const KrakenRestClient = require('./kraken/KrakenRestClient');
const KrakenWebSocketClient = require('./kraken/KrakenWebSocketClient');

const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

const emitter = new EventEmitter();

const krakenRest = new KrakenRestClient(key, secret);
const krakenWebSocket = new KrakenWebSocketClient(key, secret);
const dataStorage = { prices: [], ohlc: {} };

async function getPricesData(tradingSymbol, interval) {
  const data = await krakenRest.api('OHLC', {
    pair: `${tradingSymbol}/USD`,
    interval,
  }).catch((err) => {
    console.log(chalk.red(err));
    return getPricesData(tradingSymbol, interval);
  });
  if (data.result === undefined) {
    return getPricesData(tradingSymbol, interval);
  }
  if (data.result[`${tradingSymbol}/USD`] === undefined) {
    // console.log('Error - trying again');

    return getPricesData(tradingSymbol, interval);
  }

  // console.log(data.result[`${tradingSymbol}/USD`].map(item=>{return parseFloat(item[4])}));
  return data.result[`${tradingSymbol}/USD`].map((item) => parseFloat(item[4]));
}

async function getOHLCData(tradingSymbol, interval) {
  const data = await krakenRest.api('OHLC', {
    pair: `${tradingSymbol}/USD`,
    interval,
  });
  if (data.result === undefined) {
    return getOHLCData(tradingSymbol, interval);
  }
  if (data.result[`${tradingSymbol}/USD`] === undefined) {
    // console.log('Error - trying again');
    return getOHLCData(tradingSymbol, interval);
  }
  return data.result[`${tradingSymbol}/USD`].map((item) => ({
    time: item[0],
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[6]),
  }));
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
        price: parseFloat(data.result.closed[closeKey].price),
        amount: parseFloat(data.result.closed[closeKey].vol_exec),
        time: data.result.closed[closeKey].closetm,
        fee: parseFloat(data.result.closed[closeKey].fee),
        cost: parseFloat(data.result.closed[closeKey].cost), // total cost is cost + fee
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

async function collectData(tradingSymbol) {
  console.log(chalk.blue('Subscribing to OHLC/Ticker data'));
  krakenWebSocket.api('subscribe', 'ticker', [`${tradingSymbol}/USD`]); // Subscribe to ticker
  krakenWebSocket.api('subscribe', 'spread', [`${tradingSymbol}/USD`]); // Subscribe to Spread
  const getOHLCIntervals = [1, 5, 15, 30, 60, 240];
  getOHLCIntervals.forEach((interval) => {
    krakenWebSocket.api('subscribe', 'ohlc', [`${tradingSymbol}/USD`], {
      interval,
    }); // Subscribe to ohlc
  });
  console.log(chalk.blue('Initializing data collection'));
  const getPrices = await getPricesData(tradingSymbol, '1');
  dataStorage.prices.push(...getPrices);

  const getOHLCDatas = await Promise.all(
    getOHLCIntervals.map((interval) => getOHLCData(tradingSymbol, interval)),
  );
  getOHLCIntervals.forEach((interval, ite) => {
    dataStorage.ohlc[`ohlc-${interval}`] = { time: getOHLCDatas[ite][getOHLCDatas[ite].length - 1], data: getOHLCDatas[ite] };
  });

  krakenWebSocket.ws.on('message', (data) => {
    const messageData = JSON.parse(data);

    // console.log(data);
    if (messageData.event === undefined) {
      // console.log(data[2])
      if (messageData[2].includes('ticker')) {
        emitter.emit('tickerClose', messageData[1].c[0]);
        dataStorage.prices.push(messageData[1].c[0]);
        // console.log(data[1].c[0]);
        // console.log('ticker');
      }
      if (messageData[2].includes('ohlc')) {
        emitter.emit('ohlcUpdate', messageData[2]);
        // console.log(messageData[2]);
        if (dataStorage.ohlc[messageData[2]].time.time < parseFloat(messageData[1][1])) {
          const newData = {
            time: parseFloat(messageData[1][1]),
            open: parseFloat(messageData[1][2]),
            high: parseFloat(messageData[1][3]),
            low: parseFloat(messageData[1][4]),
            close: parseFloat(messageData[1][5]),
            volume: parseFloat(messageData[1][7]),
          };
          dataStorage.ohlc[messageData[2]].time = newData;
          dataStorage.ohlc[messageData[2]].data.push(
            newData,
          );
        } else {
          dataStorage.ohlc[messageData[2]]
            .data[dataStorage.ohlc[messageData[2]].data.length - 1] = {
              time: parseFloat(messageData[1][1]),
              open: parseFloat(messageData[1][2]),
              high: parseFloat(messageData[1][3]),
              low: parseFloat(messageData[1][4]),
              close: parseFloat(messageData[1][5]),
              volume: parseFloat(messageData[1][7]),
            };
        }
      }
      if (messageData[2].includes('spread')) {
        // console.log(messageData[1]);
        emitter.emit('spreadUpdate', messageData[1]);
      }
    }
  });
}

// Clean dataStorage when memory is low
function cleanDataStorage() {
  if (dataStorage.prices.length > 1000) {
    dataStorage.prices = dataStorage.prices.splice(dataStorage.prices.length - 1000);
  }
  Object.keys(dataStorage.ohlc).forEach((key) => {
    if (dataStorage.ohlc[key].data.length > 1000) {
      dataStorage.ohlc[key].data = dataStorage.ohlc[key].data.splice(dataStorage.ohlc[key].data.length - 1000);
    }
  });
}

module.exports = {
  collectData,
  emitter,
  getPricesData,
  getBalance,
  getLastTrade,
  dataStorage,
};
