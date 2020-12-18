require("dotenv").config();
const Alpaca = require("@alpacahq/alpaca-trade-api");
//process.env.;
const alpaca = new Alpaca({
  keyId:
    process.env.NODE_ENV == "development"
      ? process.env.PAPER_KEY_ID
      : process.env.KEY_ID,
  secretKey:
    process.env.NODE_ENV == "development"
      ? process.env.PAPER_SECRET_KEY
      : process.env.SECRET_KEY,
  paper: process.env.NODE_ENV == "development" ? true : false,
  usePolygon: false,
});

// const client = alpaca.data_ws;
// client.onConnect(function () {
//   console.log("Connected");
//   client.subscribe([
//     "alpacadatav1/T.FB",
//     "alpacadatav1/Q.AAPL",
//     "alpacadatav1/AM.AAPL",
//   ]); // when using alpaca ws
//   client.subscribe(["alpacadatav1/T.FB", "Q.AAPL", "A.FB", "AM.AAPL"]); // when using polygon ws
// });
// client.onDisconnect(() => {
//   console.log("Disconnected");
// });
// client.onStateChange((newState) => {
//   console.log(`State changed to ${newState}`);
// });
// client.onStockTrades(function (subject, data) {
//   console.log(`Stock trades: ${subject}, price: ${data.price}`);
// });
// client.onStockQuotes(function (subject, data) {
//   console.log(
//     `Stock quotes: ${subject}, bid: ${data.bidprice}, ask: ${data.askprice}`
//   );
// });
// client.onStockAggSec(function (subject, data) {
//   console.log(`Stock agg sec: ${subject}, ${data}`);
// });
// client.onStockAggMin(function (subject, data) {
//   console.log(`Stock agg min: ${subject}, ${data}`);
// });
// client.connect();
