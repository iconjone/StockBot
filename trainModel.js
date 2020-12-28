require("dotenv").config();
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
//import * as tf from "@tensorflow/tfjs";
const tf = require("@tensorflow/tfjs-node");
const plotly = require("plotly")(
  process.env.PLOTLY_USER,
  process.env.PLOTLY_KEY
);
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const krakenWebSocket = new KrakenWebSocketClient(key, secret);
const krakenRest = new KrakenRestClient(key, secret);
const tradingSymbol = "ETH";
krakenRest.api("OHLC", { pair: `${tradingSymbol}/USD` }).then((data) => {
  data = data.result[`${tradingSymbol}/USD`];

  data = data.map((ohlc) => {
    return ohlc.map((values) => {
      return parseFloat(values);
    });
  });
  data = data.filter((ohlc) => parseFloat(ohlc[5]) != 0); //Filter out any wierd 0 things
  price = data.map((ohlc) => ohlc[5]);
  data = data.filter((ohlc) => [...ohlc.slice(0, 4), ...ohlc.slice(6, 7)]);

  date = data.map((ohlc) => ohlc[0]);
  price = data.map((ohlc) => ohlc[5]);

  var data = [
    {
      x: date,
      y: price,
      type: "scatter",
    },
  ];
  console.log(date[0]);
  var graphOptions = { filename: "date-axes", fileopt: "overwrite" };
  plotly.plot(data, graphOptions, function (err, msg) {
    console.log(msg);
  });

  const xs = tf.tensor2d(data);
  xs.print();

  //   const model = tf.sequential();
  //   console.log(model);
});
