const { EventEmitter } = require('events');
const algoAO = require('./algoAO');
const reactive = require('./reactive');

const emitter = new EventEmitter();

const intervals = [1, 5, 15, 30, 60, 240];

const Taira = require('taira');

const trajectory = {
  1: { motion: '', slope: 0, crossIndex: 0 },
  5: { motion: '', slope: 0, crossIndex: 0 },
  15: { motion: '', slope: 0, crossIndex: 0 },
  30: { motion: '', slope: 0, crossIndex: 0 },
  60: { motion: '', slope: 0, crossIndex: 0 },
  240: { motion: '', slope: 0, crossIndex: 0 },
};

async function determineMode(tradingSymbol) {
  emitter.emit('data', { request: 'balance' });
  return new Promise((resolve) => {
    emitter.once('balanceResponse', (balance) => {
      if (balance[tradingSymbol] !== undefined) {
        resolve('sell');
      }
      resolve('buy');
    });
  });
}

async function calculateBreakEvenBeforeSell(tradingSymbol) {
  emitter.emit('data', { request: 'lastTrade', tradingSymbol });
  return new Promise((resolve) => {
    emitter.once('lastTradeResponse', (lastTrade) => {
      //   console.log(lastTrade);
      resolve((lastTrade.fee + lastTrade.cost) / lastTrade.amount);
    });
  });
}

async function getOHLCData() {
  return new Promise((resolve) => {
    emitter.emit('data', { request: 'ohlc' });
    emitter.once('ohlcResponse', (ohlc) => {
      if (Object.keys(ohlc).length > 0) {
        resolve(ohlc);
      } else {
        // wait 25 ms and try again
        setTimeout(() => {
          resolve(getOHLCData());
        }, 25);
      }
    });
  });
}

async function getPricesData() {
  return new Promise((resolve) => {
    emitter.emit('data', { request: 'ticker' });
    emitter.once('tickerResponse', (data) => {
      resolve(data);
    });
  });
}

function AOcalculator(AO) {
  intervals.forEach((interval) => {
    const AOdata = AO[`ohlc-${interval}`];
    let indexOfCross = 0;
    for (let i = AOdata.length - 1; i > 0; i -= 1) {
      if (
        (AOdata[i] < 0 && AOdata[i - 1] > 0)
        || (AOdata[i] > 0 && AOdata[i - 1] < 0)
      ) {
        indexOfCross = i;
        break;
      }
    }
    // Find min or max between cross and current index
    if (indexOfCross !== AOdata.length - 1) {
      const min = Math.min(...AOdata.slice(indexOfCross, AOdata.length));
      const max = Math.max(...AOdata.slice(indexOfCross, AOdata.length));
      const minIndex = AOdata.indexOf(min);
      const maxIndex = AOdata.indexOf(max);
      if (AOdata[AOdata.length - 1] > 0 && maxIndex !== AOdata.length - 1) {
        indexOfCross = maxIndex;
      }
      if (AOdata[AOdata.length - 1] < 0 && minIndex !== AOdata.length - 1) {
        indexOfCross = minIndex;
      }
    }
    if (indexOfCross === AOdata.length - 1) {
      indexOfCross -= 1;
      // console.log('no cross');
      trajectory[interval].motion = 'na';
      trajectory[interval].slope = 0;
      trajectory[interval].crossIndex = indexOfCross;
    }
    if (AOdata[indexOfCross] > AOdata[AOdata.length - 1]) {
      trajectory[interval].motion = 'bearish';
      trajectory[interval].slope = (AOdata[AOdata.length - 1] - AOdata[indexOfCross])
        / (AOdata.length - indexOfCross);
      trajectory[interval].crossIndex = indexOfCross;
    }
    if (AOdata[indexOfCross] < AOdata[AOdata.length - 1]) {
      trajectory[interval].motion = 'bullish';
      trajectory[interval].slope = (AOdata[AOdata.length - 1] - AOdata[indexOfCross])
        / (AOdata.length - indexOfCross);
      trajectory[interval].crossIndex = indexOfCross;
    }

    // Pure buy or sell
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
  console.log(trajectory);
}

function OHLCCalculator(ohlc) {
  intervals.forEach((interval) => {
    const ohlcData = ohlc[`ohlc-${interval}`];
    // console.log(ohlcData);
    const ohlcPrices = ohlcData.data.map((item) => item.close);
    // use taira to smooth the data
    let smoothedData = Taira.smoothen(
      ohlcPrices,
      Taira.ALGORITHMS.GAUSSIAN,
      10,
      10,
      false,
    );
    // remove the last 10 values from the smoothed data
    smoothedData = smoothedData.slice(0, smoothedData.length - 10);
    const OHLCPeaksValleys = [];
    // get all peaks and valleys of smoothedDataTrimmed and
    // push a peak and valley pair as object into OHLCPeaksValleys
    let isPeakFound = false;
    let isValleyFound = false;
    let peak = -1;
    let valley = -1;
    for (let i = 1; i < smoothedData.length - 2; i += 1) {
      if (
        smoothedData[i] < smoothedData[i + 1]
        && smoothedData[i] < smoothedData[i - 1]
        && !isValleyFound
      ) {
        isValleyFound = true;
        valley = smoothedData[i];
      }
      if (
        smoothedData[i] > smoothedData[i + 1]
        && smoothedData[i] > smoothedData[i - 1]
        && !isPeakFound
        && isValleyFound
      ) {
        isPeakFound = true;
        peak = smoothedData[i];
      }
      if (isPeakFound && isValleyFound) {
        OHLCPeaksValleys.push({ peak, valley, difference: peak - valley });
        isPeakFound = false;
        isValleyFound = false;
      }
    }

    // console.log(OHLCPeaksValleys);
    const differences = OHLCPeaksValleys.map((item) => item.difference);
    const averageDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    console.log(averageDifference, interval);
  });
}

algoAO.emitter.on('limitPredict', (prediction) => {
  reactive.emitter.emit('limitPredict', prediction);
  console.log('Limit Predict', prediction);
  // average any limits that are not -1
  let average = 0;
  let count = 0;
  intervals.forEach((interval) => {
    if (prediction[interval].price !== -1) {
      average += prediction[interval].price;
      count += 1;
    }
  });
  average /= count;
  if (count !== 0) {
    emitter.emit('limitPredict', average);
  }
});

async function startCalculations(tradingSymbol) {
  console.log('Starting calculations...');
  emitter.on('ohlcUpdate', async () => {
    // console.log('OHLC Update');
    const ohlc = await getOHLCData();
    const allAOs = algoAO.getAllAOs(ohlc);
    emitter.emit('AOupdate', allAOs);
    AOcalculator(allAOs);
    OHLCCalculator(ohlc);
    reactive.emitter.emit('ohlcUpdate', ohlc);
    reactive.emitter.emit('AOupdate', allAOs);
  });
  emitter.on('tickerClose', async (data) => {
    reactive.emitter.emit('tickerUpdate', data);
  });
  reactive.emitter.on('dataPrices', async () => {
    const prices = await getPricesData();
    reactive.emitter.emit('dataPricesResponse', prices);
  });
  const mode = await determineMode(tradingSymbol);
  reactive.passMode(mode);
  reactive.startReactive();
  algoAO.passMode(mode);
  algoAO.startMLAO(tradingSymbol);
}

module.exports = {
  emitter,
  determineMode,
  calculateBreakEvenBeforeSell,
  startCalculations,
};
