const { EventEmitter } = require('events');
const fetch = require('node-fetch');

const emitter = new EventEmitter();
const interpolator = require('natural-spline-interpolator');

let mode = '';
const intervals = [1, 5, 15, 30, 60, 240];

const AOs = {
  'ohlc-1': [],
  'ohlc-5': [],
  'ohlc-15': [],
  'ohlc-30': [],
  'ohlc-60': [],
  'ohlc-240': [],
  'ohlc-1-predict': [],
  'ohlc-5-predict': [],
  'ohlc-15-predict': [],
  'ohlc-30-predict': [],
  'ohlc-60-predict': [],
  'ohlc-240-predict': [],
};

const priceLimits = [];

function passMode(pass) {
  mode = pass;
}

function sendDiscordMessage(username, message) {
  fetch(
    'https://discord.com/api/webhooks/929162198012538941/1_iTlZpngELQq9721fXZfLaM9ZKmpdSASYvLduAXJOon0AK85ArWo31WYYwfHWeWyrC9',
    {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // the username to be displayed
        username,
        // contents of the message to be sent
        content: message,
      }),
    },
  );
}

let oldLimit = 0;
let lastPrice = 0;
function limitDiscordMessage(price, stabilizer, momentums, newLimit) {
  // if the price is different than the old price by $5 or more
  if (Math.abs(price - oldLimit) >= 5) {
    sendDiscordMessage(
      `Limit Predict - ${mode}`,
      `${mode} at $${price}, Last Price: $${lastPrice}, Stabilizer Interval: ${stabilizer}, Momentum Intervals: ${momentums.join(
        ', ',
      )}, New Limit(smoothed): $${newLimit}`,
    );
    oldLimit = price;
  }
}
let orderFlag = false;
function priceConditioning(limit) {
  const newLimit = limit;
  newLimit.initPrice = limit.limitPrice;

  // Look at the monentum intervals and see how far the slopes are off from the predicted slopes
  // If the slopes are off by more than a certain amount, recalculate the limit price
  // If the slopes are off by less than a certain amount, recalculate the limit price
  const slopeDifferences = [];
  if (limit.extraIntervals !== undefined) {
    limit.extraIntervals.forEach((interval) => {
      const { slope } = limit.trajectory[interval];
      const predictedSlope = limit.peaksAndValleys[interval].averageSlope;
      const slopeDifference = Math.abs(slope - predictedSlope);
      slopeDifferences.push(slopeDifference);
    });
    const averageSlopeDifference = slopeDifferences.reduce((a, b) => a + b, 0) / slopeDifferences.length;

    if (mode === 'buy') {
      newLimit.limitPrice += averageSlopeDifference;
    } else if (mode === 'sell') {
      newLimit.limitPrice -= averageSlopeDifference;
    }
  }

  if (
    (mode === 'buy' && limit.limitPrice > lastPrice)
    || (mode === 'sell' && limit.limitPrice < lastPrice)
  ) {
    // recalculate limit price to be lower or higher than the last price depending on the mode -
    // Might just need to make it the actual last price
    newLimit.limitPrice = 2 * lastPrice - newLimit.limitPrice;
    // ot lastPrice + (lastPrice - limit.limitPrice);
  }
  console.log(newLimit.limitPrice);
  // if new limit price is close to the last price by .01% send a message
  if (!orderFlag && Math.abs(newLimit.limitPrice - lastPrice) / lastPrice < 0.001) {
    orderFlag = true;
    sendDiscordMessage('Order fill Simulation', `Order: ${mode} at ${newLimit.limitPrice}`);
  }
  if (limit.OHLCpredictedLimit !== undefined) {
    limitDiscordMessage(
      newLimit.initPrice,
      limit.OHLCpredictedLimit.interval,
      limit.extraIntervals,
      newLimit.limitPrice,
    );
  }

  // Smooth the limit
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
  intervalState = {};
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
    priceConditioning(limit);
  });
  emitter.on('AOupdate', (AO) => {
    // console.log(AO);
    AOreact(AO);
  });
  emitter.on('tickerUpdate', (ticker) => {
    console.log(ticker);
    emitter.emit('dataPrices');
    // use this for price projection
    emitter.once('dataPricesResponse', (dataPricesResponse) => {
      //   console.log(dataPricesResponse);
    });
    lastPrice = ticker;
  });
}

module.exports = { emitter, passMode, startReactive };
