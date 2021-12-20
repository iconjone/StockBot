const technicalindicators = require('technicalindicators');

const helper = require('./helper');

const mlAO = require('./mlAO');

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
  const allAOs = intervals.map((interval) => getAO(ohlc[`ohlc-${interval}`]));
  intervals.forEach((interval, ite) => {
    AOs[`ohlc-${interval}`] = allAOs[ite];
  });

  return AOs;
}

async function predictAO(interval) {
  console.log('Started predicting AO for interval: ', interval);
  fork(mlAO.predictAO, [AOs[`ohlc-${interval}`], interval]);
  const prediction = await mlAO.predict(AOs[`ohlc-${interval}`]);
  AOs[`ohlc-${interval}-predict`] = prediction;

  // const prediction = await mlAO.predict(AOs['ohlc-15']);
  // return prediction;
}

function startMLAO() {
  if (AOs['ohlc-1'].length > 0 && AOs['ohlc-5'].length > 0 && AOs['ohlc-15'].length > 0 && AOs['ohlc-30'].length > 0 && AOs['ohlc-60'].length > 0 && AOs['ohlc-240'].length > 0) {
    console.log('Started MLAO');
    intervals.forEach((interval) => {
      predictAO(interval);
    });

    setInterval(() => {
      predictAO('1');
    }, 1000 * 60 * 2); // every 2 minutes predict Interval 1

    setInterval(() => {
      predictAO('5');
    }, 1000 * 60 * 4); // every 4 minutes predict Interval 5

    setInterval(() => {
      predictAO('15');
    }, 1000 * 60 * 5); // every 5 minutes predict Interval 15

    setInterval(() => {
      predictAO('30');
    }, 1000 * 60 * 10); // every 10 minutes predict Interval 30

    setInterval(() => {
      predictAO('60');
    }, 1000 * 60 * 15); // every 32 minutes predict Interval 60

    setInterval(() => {
      predictAO('240');
    }, 1000 * 60 * 20); // every 20 minutes predict Interval 240
  } else {
    console.log('No data to predict AO, waiting for data...');
    // wait for data to be loaded
    setTimeout(() => {
      startMLAO();
    }, 1000);
  }
}

module.exports = {
  getAO, getAllAOs, AOs, predictAO, startMLAO,
};
