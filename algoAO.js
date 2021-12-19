const technicalindicators = require('technicalindicators');

const helper = require('./helper');

const { AwesomeOscillator } = technicalindicators;

const intervals = [1, 5, 15, 30, 60, 240];
const AOs = {
  'ohlc-1': [], 'ohlc-5': [], 'ohlc-15': [], 'ohlc-30': [], 'ohlc-60': [], 'ohlc-240': [],
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

module.exports = { getAO, getAllAOs, AOs };
