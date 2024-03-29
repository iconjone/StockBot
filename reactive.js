const { EventEmitter } = require('events');
const fetch = require('node-fetch');

const emitter = new EventEmitter();
const interpolator = require('natural-spline-interpolator');

let mode = '';
const intervals = [1, 5, 15, 30, 60, 240];

let ohlcStore = {};

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

let trajectory = {
  1: { motion: '', slope: 0, crossIndex: 0 },
  5: { motion: '', slope: 0, crossIndex: 0 },
  15: { motion: '', slope: 0, crossIndex: 0 },
  30: { motion: '', slope: 0, crossIndex: 0 },
  60: { motion: '', slope: 0, crossIndex: 0 },
  240: { motion: '', slope: 0, crossIndex: 0 },
};

let peaksAndValleys = {
  1: { average: 0, data: [], averageSlope: 0 },
  5: { average: 0, data: [], averageSlope: 0 },
  15: { average: 0, data: [], averageSlope: 0 },
  30: { average: 0, data: [], averageSlope: 0 },
  60: { average: 0, data: [], averageSlope: 0 },
  240: { average: 0, data: [], averageSlope: 0 },
};

const priceLimits = [];

const chainData = [];

function passMode(pass) {
  mode = pass;
}

function sendDiscordMessage(username, message) {
  if (true) {
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
  if (
    !orderFlag
    && Math.abs(newLimit.limitPrice - lastPrice) / lastPrice < 0.001
  ) {
    orderFlag = true;
    sendDiscordMessage(
      'Order fill Simulation',
      `Order: ${mode} at ${newLimit.limitPrice}`,
    );
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

// // interpolate the data and see if reversals occur
// lastData = lastData.map((item, index) => [index, item]);
// const lastDataInterpolated = interpolator(lastData);
// // iterate from 21 to 40
// for (let i = 31; i < 50; i += 1) {
//   // console.log(lastDataInterpolated(i));
// }
// if (lastDataInterpolated(45) > 0 && lastData[lastData.length - 1] < 0) {
//   console.log('thinks it will reverse', interval);
// }
function AOreact(AO) {
  const intervalState = {};
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
    const lastData = AOdata.slice(-20);
    // get average difference between the last 20 data points
    const differences = [];
    for (let i = 0; i < lastData.length - 2; i += 1) {
      differences.push(Math.abs(lastData[i] - lastData[i + 1]));
    }
    const averageDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    const lastDifference = lastData[lastData.length - 1] - lastData[lastData.length - 2];
    const percentageDiff = (Math.abs(lastDifference) - Math.abs(averageDifference))
      / averageDifference;
    const immediateMotion = lastDifference > 0 ? 'bullish' : 'bearish';
    const { motion } = trajectory[interval];
    const type = {};
    if (motion !== immediateMotion) {
      type.motion = 'reversal';
    } else {
      type.motion = 'continue';
    }
    if (Math.abs(percentageDiff) > 0.15) {
      // Over 20% changes means not moderate
      if (averageDifference > Math.abs(lastDifference)) {
        if (Math.abs(percentageDiff) > 0.75) {
          type.strength = 'weakest';
        } else if (Math.abs(percentageDiff) > 0.3) {
          type.strength = 'weaker';
        } else {
          type.strength = 'weak';
        }
      } else if (Math.abs(percentageDiff) > 0.75) {
        type.strength = 'strongest';
      } else if (Math.abs(percentageDiff) > 0.3) {
        type.strength = 'stronger';
      } else {
        type.strength = 'strong';
      }
    } else {
      type.strength = 'moderate';
    }

    intervalState[interval] = {
      averageDifference,
      lastDifference,
      percentageDiff,
      immediateMotion,
      motion,
      type,
    };
  });
  const reactData = intervals.map((interval) => ({
    interval,
    motion: intervalState[interval].motion,
    averageDifference: intervalState[interval].averageDifference,
    lastDifference: intervalState[interval].lastDifference,
    percentageDiff: intervalState[interval].percentageDiff,
    immediateMotion: intervalState[interval].immediateMotion,
    type: intervalState[interval].type,
    averagePriceDifference: peaksAndValleys[interval].average,
  }));
  emitter.emit('react', reactData);
  // console.log(reactData);
  // depending on the type of reaction determine if safe to buy or sell

  let chain = [{ beginning: 0, end: -1, motion: reactData[0].immediateMotion }];
  // find borders of the react data in which it changes

  for (let i = 1; i < reactData.length; i += 1) {
    if (reactData[i].immediateMotion !== chain[chain.length - 1].motion) {
      chain[chain.length - 1].end = i - 1;
      chain.push({ beginning: i, end: i, motion: reactData[i].immediateMotion });
    } else if (i === reactData.length - 1) {
      chain[chain.length - 1].end = i;
    }
  }
  const maxDifference = reactData[5].averagePriceDifference;
  chain = chain.map((item) => {
    const tempItem = item;
    tempItem.description = `${item.motion} from ${intervals[item.beginning]} to ${intervals[item.end]}`;
    // get max pricedifference in the chain
    const maxDifferenceInChain = reactData
      .slice(item.beginning, item.end + 1)
      .reduce((a, b) => Math.max(a, b.averagePriceDifference), 0);

    let sum = 0;
    for (let x = item.beginning; x <= item.end; x += 1) {
      sum += reactData[x].percentageDiff;
    }
    tempItem.averagePercentageDiff = sum / (item.end - item.beginning + 1);
    return tempItem;
  });
  // push into chainData and ensure never gets longer than 750
  chainData.push(chain);
  if (chainData.length > 750) {
    chainData.shift();
  }
  // console.log(chainData);
  const numbers = [];
  chainData.forEach((chain) => {
    numbers.push(chain[chain.length - 1].averagePercentageDiff);
  });
  console.log(numbers);
}

function startReactive() {
  console.log('startReactive');
  emitter.on('ohlcUpdate', (ohlc) => {
    // console.log(ohlc);
    ohlcStore = ohlc;
    ohlcExtrapolate(ohlc);
  });
  emitter.on('limitPredict', (limit) => {
    trajectory = limit.trajectory;
    peaksAndValleys = limit.peaksAndValleys;
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
