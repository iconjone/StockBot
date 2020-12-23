//process.env.NODE_ENV == "development"
require("dotenv").config();
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
const helper = require("./helper");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

const krakenWebSocket = new KrakenWebSocketClient(key, secret);
const krakenRest = new KrakenRestClient(key, secret);
let xbtBalance = 0;
krakenRest.api("Balance").then((balance) => {
  console.log(balance.result);
  //xbtBalance = balance.result.XXBT;
});
krakenWebSocket.api("subscribe", "ohlc", ["ETH/USD"]);
krakenWebSocket.api("subscribe", "openOrders");
//helper.sell(krakenWebSocket, "ETH/USD", 625, 0.03994201);
//krakenWebSocket.api("subscribe", "ticker", ["LTC/USD", "ETH/USD"]);
// krakenWebSocket.api("addOrder", "addOrder", ["ETH/USD"], {
//   ordertype: "limit",
//   type: "buy",
//   price: 627,
//   volume: 0.02,
//   oflags: "fcib,post",
// });
// krakenWebSocket.api("addOrder", "addOrder", ["ETH/USD"], {
//   ordertype: "limit",
//   type: "sell",
//   price: 629,
//   volume: 0.03993,
//   oflags: "fciq,post",
// });
krakenWebSocket.ws.on("message", (data) => {
  data = JSON.parse(data);
  //console.log("WebSocket", data);

  if (data[2])
    if (data[2].includes("ohlc")) {
      console.log(
        data[1][5] - data[1][2],
        data[1][5] - data[1][2] >= 0 ? "Climbing" : "Falling",
        "|",
        data[1][3] - data[1][4],
        Math.abs(data[1][3] - data[1][4]) != Math.abs(data[1][5] - data[1][2])
          ? "IMPORTANT"
          : "",
        data[3],
        ": " + data[1][6] + "-$" + data[1][6] * xbtBalance
      );
      if (
        Math.abs(data[1][3] - data[1][4]) ==
          Math.abs(data[1][5] - data[1][2]) &&
        Math.abs(data[1][3] - data[1][4]) == 0
      ) {
        console.log(
          "------------------------------------------------------------Switch"
        );
      }
    } // else if (data[2].includes("ticker")) {
  //   console.log(data);
  // }
});
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
