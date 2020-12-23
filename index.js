//process.env.NODE_ENV == "development"
require("dotenv").config();
const chalk = require("chalk");
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
const helper = require("./helper");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

mode = undefined; // If mode is true, we are in buy mode, else if it is in false we are in sell mode
min_profit_percent_per_trade = 3;
max_allocation = 15;
const krakenWebSocket = new KrakenWebSocketClient(key, secret);
const krakenRest = new KrakenRestClient(key, secret);

//Algo 1 Idea
//Get money balance(startTrading)
//  if there is money somehwere besides ZUSD,Hard Set as ETH for now
//    go thru trades, find the last bought price for the matching pair
//       run best Sell Function -> mode = false
//        On sell -> get money balance(Loop)
//  else get USD
//    Watch markets, for now choose ETH
//      Run best Buying function
//      On Buy -> Get Money Balance (loop)
//krakenWebSocket.api("subscribe", "openOrders");
startTrading();
function startTrading() {
  tradingSymbol = "";
  sellableVolume = 0;
  krakenRest.api("Balance").then((data) => {
    let balance = data.result;
    let balanceArr = Object.entries(balance);
    console.log(chalk.bgCyan.underline.bold("Starting Balance: "));
    balanceArr.forEach((item, i) => {
      if (parseFloat(item[1]) != 0) {
        console.log(
          chalk.bgCyan(`${item[0].substring(1, item[0].length)} - ${item[1]}`)
        );
      }
      if (item[0] != "ZUSD" && parseFloat(item[1]) != 0) {
        mode = false;
        tradingSymbol = item[0].substring(1, item[0].length); //get tradingSymbol
        sellableVolume = parseFloat(item[1]);
      } else {
        mode = true;
      }
    });
    //Figured out the mode
    // //force mode to be false for Selling Mode
    // mode = false;
    //Force tradingSymbol for Selling or Buying
    tradingSymbol = "ETH";
    if (mode) {
      //Figure out best market to trade in - We chose ETH
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc

      //Buy mode
      //run best buying mode
      console.log("Should be in this mode");
    } else {
      //Sell mode
      foundPrice = false;
      priceBought = 0;
      costBought = 0;
      wantedPrice = 0;
      krakenRest.api("TradesHistory").then((trades) => {
        trades = Object.entries(trades.result.trades);
        trades.forEach((item, i) => {
          item = item[1];
          if (
            item.pair.substring(1, 4) == tradingSymbol &&
            item.type == "buy" &&
            !foundPrice
          ) {
            foundPrice = true;
            priceBought = parseFloat(item.price);
            costBought = parseFloat(item.cost) + parseFloat(item.fee);
            wantedPrice =
              priceBought * (1 + min_profit_percent_per_trade * 0.001);
          }
        });
        console.log(
          chalk.bold.bgGreen(
            `Bought at: ${priceBought} - $${costBought} | Wanted Price: ${
              priceBought * (1 + min_profit_percent_per_trade * 0.001)
            } - $${
              costBought * (1 + min_profit_percent_per_trade * 0.001)
            } | Estimated Profit $${
              costBought * (1 + min_profit_percent_per_trade * 0.001) -
              costBought
            }`
          )
        );
      });
    }
  });
}

//Watch the market -

// helper.updateBalance(krakenRest);
// console.log(helper.balance);

// krakenWebSocket.ws.on("message", (data) => {
//   data = JSON.parse(data);
//   //console.log("WebSocket", data);
//
//   if (data[2])
//     if (data[2].includes("ohlc")) {
//       console.log(
//         data[1][5] - data[1][2],
//         data[1][5] - data[1][2] >= 0 ? "Climbing" : "Falling",
//         "|",
//         data[1][3] - data[1][4],
//         Math.abs(data[1][3] - data[1][4]) != Math.abs(data[1][5] - data[1][2])
//           ? "IMPORTANT"
//           : "",
//         data[3],
//         ": " + data[1][6]
//       );
//       if (
//         Math.abs(data[1][3] - data[1][4]) ==
//           Math.abs(data[1][5] - data[1][2]) &&
//         Math.abs(data[1][3] - data[1][4]) == 0
//       ) {
//         console.log(
//           "------------------------------------------------------------Switch"
//         );
//       }
//     } // else if (data[2].includes("ticker")) {
//   //   console.log(data);
//   // }
// });
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
