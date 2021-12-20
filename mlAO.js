const brain = require('brain.js');
const scaler = require('minmaxscaler');

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

async function predict(AO) {
  console.log('Running Prediction');
  const net = new brain.recurrent.LSTMTimeStep({
    inputSize: 10,
    hiddenLayers: [20, 20, 20],
    outputSize: 10,
  });
  const scaledData = scaler.fit_transform(AO);
  const formattedData = formatData(scaledData, 10);
  //   console.log(formattedData[formattedData.length - 1]);
  return new Promise((resolve) => {
    net.train(formattedData, {
      learningRate: 0.005,
      momentum: 0.005,
      errorThresh: 0.07,
      log: false,
      iterations: 10000,
    });
    const forecastedData = net.forecast(formattedData, 1);
    // console.log(scaler.inverse_transform(formattedData[formattedData.length - 1]));
    const scaledForecastedData = scaler.inverse_transform(forecastedData[0]);
    resolve([
      scaledForecastedData[0],
      scaledForecastedData[1],
      scaledForecastedData[2],
      scaledForecastedData[3],
      scaledForecastedData[4],
      scaledForecastedData[5],
      scaledForecastedData[6],
      scaledForecastedData[7],
      scaledForecastedData[8],
      scaledForecastedData[9],
    ]);
  });
}

module.exports = { predict };
