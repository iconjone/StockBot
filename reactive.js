const { EventEmitter } = require('events');

const emitter = new EventEmitter();
const interpolator = require('natural-spline-interpolator');
const { bullish, bearish } = require('technicalindicators');

let mode = '';
const intervals = [1, 5, 15, 30, 60, 240];

function passMode(pass) {
  mode = pass;
}

function ohlcExtrapolate(data) {
  //   const ohlc = data[`ohlc-${intervals[0]}`];
  //   const highOhlc = ohlc.data.map((item, index) => [index, item.high]);
  //   const lowOhlc = ohlc.data.map((item, index) => [index, item.low]);
  //   //   console.log(highOhlc);
  //   //   console.log(lowOhlc);
  //   highOhlc.push([800, 3956]);
  //   lowOhlc.push([800, 3956]);
  //   highFunction = interpolator(highOhlc);
  //   lowFunction = interpolator(lowOhlc);
  //   console.log(highFunction(721), highFunction(722), highFunction(723));
  //   console.log(lowFunction(721), lowFunction(722), lowFunction(723));
  intervals.forEach((interval) => {
    const ohlc = data[`ohlc-${interval}`];
    const highOhlc = ohlc.data.map((item, index) => [item.high]);
    const lowOhlc = ohlc.data.map((item, index) => [item.low]);
    const closeOhlc = ohlc.data.map((item, index) => [item.close]);
    const openOhlc = ohlc.data.map((item, index) => [item.open]);
    // console.log(closeOhlc.slice(-15));
    const isBull = bullish({
      open: openOhlc.slice(-50),
      high: highOhlc.slice(-50),
      low: lowOhlc.slice(-50),
      close: closeOhlc.slice(-50),
    });
    const isBear = bearish({
      open: openOhlc.slice(-50),
      high: highOhlc.slice(-50),
      low: lowOhlc.slice(-50),
      close: closeOhlc.slice(-50),
    });
    // console.log(isBull, isBear);
    // console.log(isBull);
    // console.log(isBull ? `bullish: ${interval}` : '');
    // console.log(isBear ? `bearish: ${interval}` : '');
    // if (isBull) {
    //   console.log(`bullish: ${interval}`);
    // }
    // if (isBear) {
    //   console.log(`bearish: ${interval}`);
    // }
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
