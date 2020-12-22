//process.env.NODE_ENV == "development"
require("dotenv").config();
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

const krakenWebSocket = new KrakenWebSocketClient(key, secret);
krakenWebSocket.api("subscribe", "ohlc", ["XBT/USD", "ETH/USD"]);

// InitateWebSocket();
//
// function InitateWebSocket() {
//   krakenRest.api("TradeVolume").then((token) => {
//     console.log(token.result, "got the time");
//   });
//   krakenRest.api("GetWebSocketsToken").then((token) => {
//     console.log(token.result.token, "got the token");
//   });
// }
