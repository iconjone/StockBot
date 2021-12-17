require('dotenv').config();
const plotlib = require('nodeplotlib');
const Taira = require('taira');
const brain = require('brain.js');
const scaler = require('minmaxscaler');

const net = new brain.recurrent.LSTMTimeStep({
  inputSize: 10,
  hiddenLayers: [20, 20, 20],
  outputSize: 10,
});

const KrakenRestClient = require('./KrakenRestClient');

const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

const krakenRest = new KrakenRestClient(key, secret);

const tradingSymbol = 'ETH';

krakenRest.api('OHLC', { pair: `${tradingSymbol}/USD`, interval: '15' }).then((data) => {
  // console.log(data.result[`${tradingSymbol}/USD`]);

  // get an array of all the high prices
  const highPrices = data.result[`${tradingSymbol}/USD`].map((item) => item[2]);

  // get an array of all the low prices
  const lowPrices = data.result[`${tradingSymbol}/USD`].map((item) => item[3]);

  let avgPrices = data.result[`${tradingSymbol}/USD`].map((item) => item[5]);

  // make an array from 0 to length of highPrices
  const x = Array.from(Array(highPrices.length).keys());

  plotlib.stack([{ x, y: highPrices, type: 'scatter' }, { x, y: lowPrices, type: 'scatter' }, { x, y: avgPrices, type: 'scatter' }]);

  plotlib.stack([{ x, y: Taira.smoothen(avgPrices, Taira.ALGORITHMS.GAUSSIAN, 5, 5, false), type: 'scatter' }]);

  avgPrices = scaler.fit_transform(Taira.smoothen(avgPrices, Taira.ALGORITHMS.GAUSSIAN, 10, 10, false));

  // let formattedData = formatData(avgPrices, 10);

  const formattedData = formatData(avgPrices.slice(0, 710), 10);

  trainingOutput = [];
  net.train(formattedData, {
    learningRate: 0.005,
    momentum: 0.005,
    errorThresh: 0.07,
    log: (stats) => {
      console.log(stats);
      trainingOutput.push(Number.parseFloat(stats.split('training error: ')[1]));
    },
    iterations: 50000,
  });
  forecastedData = net.forecast(formattedData, 12);

  aggregatedData = [...scaler.inverse_transform(avgPrices.slice(0, 710)), ...scaler.inverse_transform(forecastedData[0]), ...scaler.inverse_transform(forecastedData[1]), ...scaler.inverse_transform(forecastedData[2]), ...scaler.inverse_transform(forecastedData[3]), ...scaler.inverse_transform(forecastedData[4]), ...scaler.inverse_transform(forecastedData[5]), ...scaler.inverse_transform(forecastedData[6]), ...scaler.inverse_transform(forecastedData[7]), ...scaler.inverse_transform(forecastedData[8]), ...scaler.inverse_transform(forecastedData[9]), ...scaler.inverse_transform(forecastedData[10]), ...scaler.inverse_transform(forecastedData[11])];
  plotlib.stack([{ x: Array.from(Array(aggregatedData.length).keys()), y: aggregatedData, type: 'scatter' }, { x: Array.from(Array(avgPrices.slice(0, 710).length).keys()), y: scaler.inverse_transform(avgPrices.slice(0, 710)), type: 'scatter' }, { x: [600, 600], y: [3800, 4600], type: 'line' }]);

  plotlib.stack([{ x: Array.from(Array(trainingOutput.length).keys()), y: trainingOutput, type: 'scatter' }]);
  plotlib.stack([{ x: Array.from(Array(forecastedData.length).keys()), y: forecastedData, type: 'scatter' }]);

  plotlib.plot();
});

function formatData(highPrices, size) {
  output = [];
  for (let i = 0; i < highPrices.length; i += size) {
    output.push([...highPrices.slice(i, i + size)]);
  }
  return output;
}
