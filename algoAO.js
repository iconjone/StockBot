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
const ohlcStore = {};

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

async function predictAO(interval) {
  console.log('Started predicting AO for interval:', interval);
  const child = fork('mlAO.js', [AOs[`ohlc-${interval}`], interval]);
  child.on('message', (message) => {
    if (message.MLAO) {
      console.log('Received MLAO for interval:', message.MLAO.interval);
      AOs[`ohlc-${message.MLAO.interval}-predict`] = message.MLAO.AO;
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
    // predictAO('1');
    // predictAO('5');

    intervals.forEach((interval) => {
      predictAO(interval);
    });

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
    }, 1000 * 60 * 15); // every 10 minutes predict Interval 30

    setInterval(() => {
      predictAO('60');
    }, 1000 * 60 * 20); // every 32 minutes predict Interval 60

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

function predictLimit(interval, predictAO) {
  // get max or min depending on mode, using that predict the price it will be at the limit if the
  let limit = 0;
  if (predictAO) {
    limit = Math.max(...AOs[`ohlc-${interval}-predict`]);
  }
  return limit;
}

module.exports = {
  getAO, getAllAOs, AOs, predictAO, startMLAO,
};
