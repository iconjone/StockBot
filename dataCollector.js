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
  const data = await krakenRest.api('OHLC', { pair: `${tradingSymbol}/USD`, interval });
  if (data.result[`${tradingSymbol}/USD`] === undefined) {
    // console.log('Error - trying again');

    return getPricesData(tradingSymbol, interval);
  }

  // console.log(data.result[`${tradingSymbol}/USD`].map(item=>{return parseFloat(item[4])}));
  return data.result[`${tradingSymbol}/USD`].map((item) => parseFloat(item[4]));
}

module.exports = { collectData, emitter, getPricesData };
