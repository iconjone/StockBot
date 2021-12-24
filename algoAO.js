/* eslint-disable max-len */
const { fork } = require('child_process');

const technicalindicators = require('technicalindicators');

const helper = require('./helper');

// const mlAO = require('./mlAO');
let timer = null;

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
  // get max or min depending on mode, using that predict the price it will be at the limit if the
  const intervalLimits = {
    1: -1, 5: -1, 15: -1, 30: -1, 60: -1, 240: -1,
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

    console.log('predictTOR', predictTOR);
    // if the val is negative and we are in buy mode, or is positive and we are in sell mode, we can move on
    if ((predictTOR.value < 0 && mode === 'buy') || (predictTOR.value > 0 && mode === 'sell')) {
      console.log('Predicted TOR is', (predictTOR.index + 1) * interval, 'minutes from now');
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
      console.log('surroundingValuesPercentageDiff', surroundingValuesPercentageDiff);

      // get the average of the surrounding values
      const average = surroundingValuesPercentageDiff.reduce((acc, val) => (acc + val) / surroundingValuesPercentageDiff.length, 0);
      console.log(average, 'average of surrounding values');
      // if the average is greater than 0.01, (1%) we can move on
      if (average > 0.01) {
        console.log("let's calculate");
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
        console.log('closestValue', closestValue);
        const suggestedPrice = ohlcStore[`ohlc-${interval}`].data[ohlcStore[`ohlc-${interval}`].data.length - (AO.length - closestValue.index)];
        console.log('suggestedPrice', suggestedPrice);
      }
    }
  }
}

// return limit;

async function predictAO(interval) {
  console.log('Started predicting AO for interval:', interval);
  const child = fork('mlAO.js', [AOs[`ohlc-${interval}`], interval]);
  child.on('message', (message) => {
    if (message.MLAO) {
      console.log('Received MLAO for interval:', message.MLAO.interval);
      AOs[`ohlc-${message.MLAO.interval}-predict`] = message.MLAO.AO;
      console.log('Sell prediction');
      console.log('Limit Predict', predictLimit('sell'));
      console.log('Buy prediction');
      console.log('Limit Predict', predictLimit('buy'));

      // console.log('Predicted AO for interval: ', message.MLAO.interval, '\n', message.MLAO.AO);
    }
  });

  child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
  // const prediction = await mlAO.predict(AOs[`ohlc-${interval}`]);
  // AOs[`ohlc-${interval}-predict`] = prediction;

  // const prediction = await mlAO.predict(AOs['ohlc-15']);
  // return prediction;
}

function startMLAO() {
  if (AOs['ohlc-1'].length > 0 && AOs['ohlc-5'].length > 0 && AOs['ohlc-15'].length > 0 && AOs['ohlc-30'].length > 0 && AOs['ohlc-60'].length > 0 && AOs['ohlc-240'].length > 0) {
    console.log('Started MLAO');
    predictAO('1');
    predictAO('5');

    // intervals.forEach((interval) => {
    //   predictAO(interval);
    // });

    timer = setInterval(() => {
      predictAO('1');
    }, 1000 * 60 * 5); // every 5 minutes predict AO for interval 1

    setInterval(() => {
      predictAO('5');
    }, 1000 * 60 * 7); // every 7 minutes predict Interval 5

    setInterval(() => {
      predictAO('15');
    }, 1000 * 60 * 7); // every 7 minutes predict Interval 15

    setInterval(() => {
      predictAO('30');
    }, 1000 * 60 * 15); // every 15 minutes predict Interval 30

    setInterval(() => {
      predictAO('60');
    }, 1000 * 60 * 17); // every 17 minutes predict Interval 60

    setInterval(() => {
      predictAO('240');
    }, 1000 * 60 * 20); // every 20 minutes predict Interval 240
  } else {
    console.log('No data to predict AO, waiting for data...');
    // wait for data to be loaded
    setTimeout(() => {
      startMLAO();
    }, 2500);
  }
}

module.exports = {
  getAO, getAllAOs, AOs, predictAO, startMLAO,
};
