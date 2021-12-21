const brain = require('brain.js');
const scaler = require('minmaxscaler');
// const plotlib = require('nodeplotlib');

function formatData(data, size) {
  // get remainder of dat and size
  const remainder = data.length % size;
  // remove remainder elements from beginning of data
  const newData = data.slice(remainder);

  const output = [];
  for (let i = 0; i < newData.length; i += size) {
    output.push([...newData.slice(i, i + size)]);
  }

  return output;
}

const AO = process.argv[2].split(',');
const interval = process.argv[3];
console.log(`Running Prediction for interval: ${interval}`);
const net = new brain.recurrent.LSTMTimeStep({
  inputSize: 10,
  hiddenLayers: [20, 30, 20],
  outputSize: 10,
});
const scaledData = scaler.fit_transform(AO);
const formattedData = formatData(scaledData, 10);
// testing accuracy of model
// formattedData.pop();
//   console.log(formattedData[formattedData.length - 1]);
// const trainingOutput = [];

net.train(formattedData, {
  learningRate: 0.0003,
  momentum: 0.075,
  errorThresh: 0.025,
  log: false, // (stats) => {
  //   console.log(stats);
  //   trainingOutput.push(Number.parseFloat(stats.split('training error: ')[1]));
  // },
  iterations: 25000,
});
// log minimum error
// console.log(trainingOutput.reduce((a, b) => Math.min(a, b)));
// plotlib.stack([{ x: Array.from(Array(trainingOutput.length).keys()), y: trainingOutput, type: 'scatter' }]);
// // plotlib.plot();

const forecastedData = net.forecast(formattedData, 2);
// console.log(scaler.inverse_transform(formattedData[formattedData.length - 1]));
const scaledForecastedData = scaler.inverse_transform([...forecastedData[0], ...forecastedData[1]]);

process.send({ MLAO: { interval, AO: scaledForecastedData } });
