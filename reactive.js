const { EventEmitter } = require('events');

const emitter = new EventEmitter();
const interpolator = require('natural-spline-interpolator');

let mode = '';
const intervals = [1, 5, 15, 30, 60, 240];

function passMode(pass) {
  mode = pass;
}

function ohlcExtrapolate(data) {
  intervals.forEach((interval) => {
    const ohlc = data[`ohlc-${interval}`];
    const highOhlc = ohlc.data.map((item, index) => [item.high]);
    const lowOhlc = ohlc.data.map((item, index) => [item.low]);
    const closeOhlc = ohlc.data.map((item, index) => [item.close]);
    const openOhlc = ohlc.data.map((item, index) => [item.open]);
  });
}

function AOreact(AO) {
  intervals.forEach((interval) => {
    const AOdata = AO[`ohlc-${interval}`];

    // Pure buy or sell - Move to reactive
    if (
      AOdata[AOdata.length - 1] < 0
        && AOdata[AOdata.length - 2] < AOdata[AOdata.length - 1]
        && AOdata[AOdata.length - 3] > AOdata[AOdata.length - 2]
    ) {
      console.log('buy', interval, Date.now());
    }
    if (
      AOdata[AOdata.length - 1] > 0
        && AOdata[AOdata.length - 2] > AOdata[AOdata.length - 1]
        && AOdata[AOdata.length - 3] < AOdata[AOdata.length - 2]
    ) {
      console.log('sell', interval, Date.now());
    }
  });
}

function startReactive() {
  console.log('startReactive');
  emitter.on('ohlcUpdate', (ohlc) => {
    // console.log(ohlc);
    ohlcExtrapolate(ohlc);
  });
  emitter.on('limitPredict', (limit) => {
    // console.log(limit);
  });
  emitter.on('AOupdate', (AO) => {
    // console.log(AO);
    AOreact(AO);
  });
  emitter.on('tickerUpdate', (ticker) => {
    console.log(ticker);
    emitter.emit('dataPrices');
    emitter.once('dataPricesResponse', (dataPricesResponse) => {
      //   console.log(dataPricesResponse);
    });
  });
}

module.exports = { emitter, passMode, startReactive };
