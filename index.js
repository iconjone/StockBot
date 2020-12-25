//process.env.NODE_ENV == "development"
require("dotenv").config();
const chalk = require("chalk");
const asciichart = require("asciichart");

//const asciichartConfig = { colors: [asciichart.red, asciichart.green] };
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
const helper = require("./helper");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

mode = undefined; // If mode is true, we are in buy mode, else if it is in false we are in sell mode
min_profit_percent_per_trade = 0.5;
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
    // //Force mode to be true for Buying Mode
    mode = true;
    //Force tradingSymbol for Selling or Buying
    tradingSymbol = "ETH";
    if (mode) {
      console.log(chalk.bold.underline.bgCyan("Buying Mode"));
      //Figure out best market to trade in - We prechose ETH
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
      krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
      krakenRest
        .api("Ticker", { pair: `${tradingSymbol}/USD` })
        .then((ticker) => {
          averagePrice =
            (parseFloat(ticker.result[`${tradingSymbol}/USD`].l[1]) +
              parseFloat(ticker.result[`${tradingSymbol}/USD`].h[1])) /
            2;
          averageAdjustedLowPrice =
            (parseFloat(ticker.result[`${tradingSymbol}/USD`].l[1]) * 0.97 +
              parseFloat(ticker.result[`${tradingSymbol}/USD`].h[1])) /
            2;
          averageWeightedPrice = parseFloat(
            ticker.result[`${tradingSymbol}/USD`].p[1]
          );
          averageAdjustedWeightedPrice = averageWeightedPrice * 1.02;
          guaranteedReach = (averagePrice + averageAdjustedLowPrice) / 2;
          console.log(
            "Average price:",
            chalk.bgRed(averagePrice),
            "Guess of low Average Price:",
            chalk.bgRed(averageAdjustedLowPrice),
            "Guaranteed Reach:",
            chalk.bgMagenta(guaranteedReach)
          );
          console.log(
            "Weighted Price:",
            chalk.bgGreen(averageWeightedPrice),
            "Guess of high Weighted Price:",
            chalk.bgGreen(averageAdjustedWeightedPrice),
            "Recommended Sell Rate:",
            chalk.bgMagenta(
              (averageWeightedPrice + averageAdjustedWeightedPrice) / 2
            ),
            "Potential:",
            chalk.bgYellow(
              (averageWeightedPrice + averageAdjustedWeightedPrice) / 2 -
                (averagePrice + averageAdjustedLowPrice) / 2
            )
          );
          krakenRest
            .api("OHLC", { pair: `${tradingSymbol}/USD` })
            .then((data) => {
              data = data.result[`${tradingSymbol}/USD`];

              data = data.slice(data.length - 45, data.length - 1); //Get data from the last 45 minutes

              pricesList = [];
              slopeList = [];
              lows = [];
              highs = [];
              //high, low = 0;
              //averageHigh, (averageLow = 0);
              //we technically want the average of the slope list to be 0

              data.forEach((item, i) => {
                if (item[5] != 0) {
                  pricesList.push(parseFloat(item[5]));
                  slopeList.push(parseFloat(item[4] - item[1]));
                  if (parseFloat(item[4] - item[1]) < 0)
                    lows.push(parseFloat(item[3]));
                  if (parseFloat(item[4] - item[1]) > 0)
                    highs.push(parseFloat(item[2]));
                }
              });

              console.log(
                asciichart.plot(pricesList, {
                  colors: [asciichart.cyan],
                })
              );
              console.log("-------------------");
              console.log(
                asciichart.plot(slopeList, {
                  colors: [asciichart.magenta],
                })
              );
              console.log("-------------------");
              console.log(
                asciichart.plot(lows, {
                  colors: [asciichart.red],
                })
              );
              console.log("-------------------");
              console.log(
                asciichart.plot(highs, {
                  colors: [asciichart.green],
                })
              );
              console.log("-------------------");
              console.log(
                "Average Slope:",
                chalk.bgYellow(
                  slopeList.reduce((a, b) => a + b, 0) / slopeList.length
                )
              );
              console.log(
                "Average Low Slope Prices:",
                chalk.bgRed(lows.reduce((a, b) => a + b, 0) / lows.length),
                "Low Target:",
                chalk.bgRed(
                  lows
                    .sort()
                    .slice(0, 5)
                    .reduce((a, b) => a + b, 0) / 5
                )
              );
              console.log(
                "Average High Slope Prices:",
                chalk.bgGreen(highs.reduce((a, b) => a + b, 0) / highs.length),
                "High Target:",
                chalk.bgGreen(
                  highs
                    .sort()
                    .slice(highs.length - 5, highs.length)
                    .reduce((a, b) => a + b, 0) / 5
                )
              );
              //  console.log(lows, highs);
              // console.log(JSON.stringify(slopeList));
              // console.log(JSON.stringify(pricesList));
            });

          //Calculated Base
          let orderId = null;
          //Submit Order for Automatic order
          // helper.buy(
          //   krakenWebSocket,
          //   `${tradingSymbol}/USD`,
          //   automaticOrder.toFixed(2),
          //   (max_allocation / automaticOrder).toFixed(2)
          // );
          krakenWebSocket.wsAuth.on("message", (data) => {
            data = JSON.parse(data);
            if (data.event != "heartbeat") {
              //console.log(data);
            }
          });
        });
      watchingSlope = [];
      watchingPrice = [];
      slope45 = [];
      price45 = [];
      previousBid = 0;

      krakenWebSocket.ws.on("message", (data) => {
        data = JSON.parse(data);
        if (data[2]) {
          if (data[2].includes("ohlc")) {
            //console.log(watchingSlope);
            watchingSlope.push(parseFloat(data[1][5] - data[1][2]));
            watchingPrice.push(parseFloat(data[1][6]));
            slope45 = watchingSlope.slice(
              watchingSlope.length <= 45 ? 0 : watchingSlope.length - 45,
              watchingSlope.length
            );
            price45 = watchingPrice.slice(
              watchingPrice.length <= 45 ? 0 : watchingPrice.length - 45,
              watchingPrice.length
            );

            //  console.log(watchingPrice, watchingSlope);

            console.log(
              asciichart.plot(slope45, {
                colors: [asciichart.cyan],
              })
            );
            console.log("--------");
            console.log(
              asciichart.plot(price45, {
                colors: [asciichart.magenta],
              })
            );
            console.log(
              data[1][5] - data[1][2],
              "%" +
                ((parseFloat(data[1][5]) - parseFloat(data[1][2])) /
                  ((parseFloat(data[1][5]) + parseFloat(data[1][2])) / 2)) *
                  100,
              data[1][6]
            );

            if (watchingSlope[watchingSlope.length - 1] <= 0) {
              console.log("Wait");
            } else {
              //if it goes up but the percentage increase is small wait...
              console.log("going up :/");
            }
          } else if (data[2].includes("ticker")) {
            if (
              previousBid < data[1].b[0] &&
              watchingSlope[watchingSlope.length - 1] <= 0
            ) {
              console.log(chalk.bgCyan("BUY"));
            }
            console.log("Best Ask", data[1].a[0], "Best Bid", data[1].b[0]);
            previousBid = data[1].b[0];
          }
        }
      });
      //buy must be between average price and weighted price

      //Buy guess low price
      // if the buy goes thru re do Loop
      //Watch for Low, and if it's close enough, buy it anyways
      // krakenWebSocket.ws.on("message", (data) => {
      //   data = JSON.parse(data);
      //   //console.log("WebSocket", data);
      //
      //   if (data[2])
      //     if (data[2].includes("ohlc")) {
      //       console.log(
      //         "We would need " +
      //           parseFloat(data[1][6]) *
      //             (1 + min_profit_percent_per_trade * 0.001)
      //       );
      //       console.log(
      //         data[1][5] - data[1][2],
      //         data[1][5] - data[1][2] >= 0 ? "Climbing" : "Falling",
      //         "|",
      //         data[1][3] - data[1][4],
      //         Math.abs(data[1][3] - data[1][4]) !=
      //           Math.abs(data[1][5] - data[1][2])
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
      //Buy mode
      //run best buying mode
    } else {
      console.log(chalk.bold.underline.bgCyan("Selling Mode"));
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
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
            `Bought at: ${priceBought} - $${costBought} | Wanted Price: ${wantedPrice} - $${
              costBought * (1 + min_profit_percent_per_trade * 0.001)
            } | Estimated Profit $${
              costBought * (1 + min_profit_percent_per_trade * 0.001) -
              costBought
            }`
          )
        );
        krakenWebSocket.wsAuth.on("message", (data) => {
          data = JSON.parse(data);
          if (data.event != "heartbeat") {
            console.log(chalk.red(JSON.stringify(data)));
          }
        });
        krakenWebSocket.ws.on("message", (data) => {
          data = JSON.parse(data);
          //console.log("WebSocket", data);

          if (data[2])
            if (data[2].includes("ohlc")) {
              console.log(
                "We would need " + (wantedPrice - parseFloat(data[1][6]))
              );

              if (data[1][6] > wantedPrice) {
                console.log("hit the goal");
                // helper.sell(
                //   krakenWebSocket,
                //   `${tradingSymbol}/USD`,
                //   data[1][6].toFixed(2),
                //   sellableVolume
                // );
                console.log(chalk.red("I WANT TO SELL"));
              }
              console.log(
                data[1][5] - data[1][2],
                data[1][5] - data[1][2] >= 0 ? "Climbing" : "Falling",
                "|",
                data[1][3] - data[1][4],
                Math.abs(data[1][3] - data[1][4]) !=
                  Math.abs(data[1][5] - data[1][2])
                  ? "IMPORTANT"
                  : "",
                data[3],
                ": " + data[1][6]
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
