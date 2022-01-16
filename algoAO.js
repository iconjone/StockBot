/* eslint-disable max-len */
const { fork } = require('child_process');
const { EventEmitter } = require('events');

const emitter = new EventEmitter();

const technicalindicators = require('technicalindicators');

const helper = require('./helper');

// const mlAO = require('./mlAO');
const timer = null;

let mode = '';

const { AwesomeOscillator } = technicalindicators;

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
let ohlcStore = {};

function passMode(pass) {
  mode = pass;
}

function getAO(ohlc) {
  let high = [];
  let low = [];

  ({ high, low } = helper.getHighsLowsOHLC(ohlc.data));

  const AO = AwesomeOscillator.calculate({
    high, low, fastPeriod: 5, slowPeriod: 34,
  });
  return AO;
}

function getAllAOs(ohlc) {
  ohlcStore = ohlc;
  const allAOs = intervals.map((interval) => getAO(ohlc[`ohlc-${interval}`]));
  intervals.forEach((interval, ite) => {
    AOs[`ohlc-${interval}`] = allAOs[ite];
  });

  return AOs;
}

function predictLimit(mode) {
  // most recent price

  const lastPrice = ohlcStore['ohlc-1'].data[ohlcStore['ohlc-1'].data.length - 1].close;
  // get max or min depending on mode, using that predict the price it will be at the limit if the
  const intervalLimits = {
    1: { price: -1, time: -1 }, 5: { price: -1, time: -1 }, 15: { price: -1, time: -1 }, 30: { price: -1, time: -1 }, 60: { price: -1, time: -1 }, 240: { price: -1, time: -1 },
  };
  // Let's assume mode is in buy
  // start from highest interval and work our way down
  for (let i = intervals.length - 1; i >= 0; i -= 1) {
    const interval = intervals[i];
    const AO = AOs[`ohlc-${interval}`];
    const AOpredict = AOs[`ohlc-${interval}-predict`];
    // get the minimum or maximum, and the index of the value depending on mode of AOpredict
    const predictTOR = { index: 0, value: AOpredict[0] };
    for (let j = 1; j < AOpredict.length; j += 1) {
      if (mode === 'buy') {
        if (AOpredict[j] < predictTOR.value) {
          predictTOR.value = AOpredict[j];
          predictTOR.index = j;
        }
      } else if (mode === 'sell') {
        if (AOpredict[j] > predictTOR.value) {
          predictTOR.value = AOpredict[j];
          predictTOR.index = j;
        }
      }
    }

    // console.log('predictTOR', predictTOR);
    // if the val is negative and we are in buy mode, or is positive and we are in sell mode, we can move on
    if ((predictTOR.value < 0 && mode === 'buy') || (predictTOR.value > 0 && mode === 'sell')) {
      // console.log('Predicted TOR is', (predictTOR.index + 1) * interval, 'minutes from now');
      // get percentage difference of predictTor.value and each element of predictAO array
      const percentageDiff = AOpredict
        .map((val) => {
          const diff = val - predictTOR.value;
          const percentage = Math.abs(diff / predictTOR.value);
          return percentage;
        });
        // get surrouding values of the index of the minimum or maximum
      const surroundingValuesPercentageDiff = [];
      for (let k = 0; k < percentageDiff.length; k += 1) {
        if (k === predictTOR.index - 1 || k === predictTOR.index + 1) {
          surroundingValuesPercentageDiff.push(percentageDiff[k]);
        }
      }

      // get the average of the surrounding values
      const average = surroundingValuesPercentageDiff.reduce((acc, val) => (acc + val) / surroundingValuesPercentageDiff.length, 0);
      // console.log(average, 'average of surrounding values');
      // if the average is greater than 0.01, (1%) we can move on
      if (average > 0.01) {
        console.log('Viable DATA, we can move on');
        // find the closest value in AO array to the predictTOR.value
        const closestValue = AO.reduce(
          (acc, val, index) => {
            const diff = Math.abs(val - predictTOR.value);
            if (diff < acc.diff) {
              return { diff, value: val, index };
            }
            return acc;
          },
          { diff: Infinity, value: 0, index: 0 },
        );
        const closestOHLC = ohlcStore[`ohlc-${interval}`].data[ohlcStore[`ohlc-${interval}`].data.length - (AO.length - closestValue.index)];
        // console.log('closestOHLC', closestOHLC);
        // get the extrapolated price at the tor
        let extrapolatedPrice = 0;
        for (let k = 0; k < predictTOR.index - 1; k += 1) {
          extrapolatedPrice += AOpredict[k + 1] - AOpredict[k];
        }
        if (mode === 'buy') {
          extrapolatedPrice += ohlcStore[`ohlc-${interval}`].data[ohlcStore[`ohlc-${interval}`].data.length - 1].low;
        } else if (mode === 'sell') {
          extrapolatedPrice += ohlcStore[`ohlc-${interval}`].data[ohlcStore[`ohlc-${interval}`].data.length - 1].high;
        }
        // depending on mode, if the extrapolated price is greater or less than the lastPrice by 1 percent, we can move on
        // if ((mode === 'buy' && extrapolatedPrice < lastPrice * (1 - (0.75 / 100))) || (mode === 'sell' && extrapolatedPrice > lastPrice * (1 + (0.75 / 100)))) {
        intervalLimits[interval].price = extrapolatedPrice;
        intervalLimits[interval].time = (predictTOR.index + 1) * interval;
        // }
      }
    }
  }
  // console.log('intervalLimits', intervalLimits);
  return intervalLimits;
}

// return limit;
const live = false;
async function predictAO(interval) {
  console.log('Started predicting AO for interval:', interval);
  let data = AOs[`ohlc-${interval}`];
  if (interval === '240') { // HACKY SOLUTION TO WIERD ML RESULTS MAY NEED TO BE FIXED
    // remove 1/4 of beginning of data due to extreme time
    data = data.slice(data.length - (3 * (data.length / 4)));
  }
  if (live) {
    const child = fork('mlAO.js', [data, interval]);
    child.on('message', (message) => {
      if (message.MLAO) {
        console.log('Received MLAO for interval:', message.MLAO.interval);
        // clean up message.MLAO.AO and format it to the correct levels
        const predictedAO = [AOs[`ohlc-${interval}`][0]];
        for (let i = 1; i < message.MLAO.AO.length; i += 1) {
          predictedAO.push(message.MLAO.AO[i] - message.MLAO.AO[i - 1] + predictedAO[i - 1]);
        }

        AOs[`ohlc-${message.MLAO.interval}-predict`] = predictedAO;
        emitter.emit('predictAO', AOs);
        emitter.emit('limitPredict', predictLimit(mode));

      // console.log('Predicted AO for interval: ', message.MLAO.interval, '\n', message.MLAO.AO);
      }
    });

    child.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });
  } else {
    console.log('Received MLAO for interval:', interval);
    // make fake predict data
    const fakeData = [];
    for (let i = 0; i < 20; i += 1) {
      fakeData.push(data[data.length - (i + 1)] - (data[data.length - (i + 2)] - data[data.length - (i + 1)]));
    }
    AOs[`ohlc-${interval}-predict`] = fakeData;
    emitter.emit('predictAO', AOs);
    emitter.emit('limitPredict', predictLimit(mode));
  }
  // const prediction = await mlAO.predict(AOs[`ohlc-${interval}`]);
  // AOs[`ohlc-${interval}-predict`] = prediction;

  // const prediction = await mlAO.predict(AOs['ohlc-15']);
  // return prediction;
}

function startMLAO() {
  if (AOs['ohlc-1'].length > 0 && AOs['ohlc-5'].length > 0 && AOs['ohlc-15'].length > 0 && AOs['ohlc-30'].length > 0 && AOs['ohlc-60'].length > 0 && AOs['ohlc-240'].length > 0) {
    console.log('Started MLAO');
    // predictAO('1');
    // // predictAO('5');
    // predictAO('15');
    // predictAO('60');

    intervals.forEach((interval) => {
      predictAO(interval);
    });

    // timer = setInterval(() => {
    //   predictAO('1');
    // }, 1000 * 60 * 5); // every 5 minutes predict AO for interval 1

    // setInterval(() => {
    //   predictAO('5');
    // }, 1000 * 60 * 7); // every 7 minutes predict Interval 5

    // setInterval(() => {
    //   predictAO('15');
    // }, 1000 * 60 * 7); // every 7 minutes predict Interval 15

    // setInterval(() => {
    //   predictAO('30');
    // }, 1000 * 60 * 15); // every 15 minutes predict Interval 30

    // setInterval(() => {
    //   predictAO('60');
    // }, 1000 * 60 * 17); // every 17 minutes predict Interval 60

    // setInterval(() => {
    //   predictAO('240');
    // }, 1000 * 60 * 20); // every 20 minutes predict Interval 240
  } else {
    console.log('No data to predict AO, waiting for data...');
    // wait for data to be loaded
    setTimeout(() => {
      startMLAO();
    }, 2500);
  }
}

module.exports = {
  getAO, getAllAOs, AOs, predictAO, startMLAO, passMode, predictLimit, emitter,
};
