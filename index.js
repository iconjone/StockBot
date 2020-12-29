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

max_allocation = 15;

//Testing for watching trade

let trade = [];

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
function startTrading(overRideMode) {
  let krakenRest = new KrakenRestClient(key, secret);
  let krakenWebSocket = new KrakenWebSocketClient(key, secret);

  krakenWebSocket.api("subscribe", "openOrders"); // Subscribe to orders
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
      if (item[0] != "ZUSD" && parseFloat(item[1]) >= 0.001) {
        mode = false;
        tradingSymbol = item[0].substring(1, item[0].length); //get tradingSymbol
        sellableVolume = parseFloat(item[1]);
      } else {
        mode = true;
      }
    });
    if (overRideMode) mode = overRideMode;
    //Figured out the mode
    // //force mode to be false for Selling Mode
    //mode = false;
    // //Force mode to be true for Buying Mode
    //  mode = true;
    //Force tradingSymbol for Selling or Buying
    tradingSymbol = "ETH";
    if (mode) {
      bought = false;
      console.log(chalk.bold.underline.bgCyan("Buying Mode"));
      //Figure out best market to trade in - We prechose ETH
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
      krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ticker
      //  krakenWebSocket.api("subscribe", "openOrders"); // Subscribe to orders
      krakenRest.api("OHLC", { pair: `${tradingSymbol}/USD` }).then((data) => {
        data = data.result[`${tradingSymbol}/USD`];
        if (data == undefined) return startTrading();
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
        if (true) {
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
          console.log(
            "Reccomended Maximum Buy Rate:",
            chalk.bgMagenta(
              helper.getBuyRateEqualizer(
                highs.reduce((a, b) => a + b, 0) / highs.length
              )
            )
          );
        }
        dropStart = helper.getBuyRateEqualizer(
          highs.reduce((a, b) => a + b, 0) / highs.length
        );
        //Start reading the Wewsocket connections

        ohlcStore = [];
        watchingSlope = [];
        watchingPrice = [];

        previousBid = 0;

        orderID = null;

        krakenWebSocket.ws.on("message", (data) => {
          data = JSON.parse(data);
          if (data[2]) {
            if (data[2].includes("ohlc")) {
              if (data[1][5] != 0) ohlcStore.push(data[1]);
              //console.log(watchingSlope);
              watchingSlope.push(parseFloat(data[1][5] - data[1][2]));
              watchingPrice.push(parseFloat(data[1][6]));

              if (watchingSlope.length % 45 == 0) {
                newDrop = helper.getBuyRateEqualizer(
                  helper.getAverageHighSlopePrices(
                    ohlcStore.slice(
                      ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                      ohlcStore.length
                    )
                  ) //I feel like this should be average Low slope prices - Maybe change it back we'll see - We did this because we are looking at the average high and then going from there
                );

                if (newDrop) {
                  dropStart = (dropStart + newDrop) / 2;
                  console.log(
                    "New Reccomended Maximum Buy Rate:",
                    chalk.bgMagenta(dropStart)
                  );
                }
              }

              console.log(
                "Slope:",
                chalk.bgYellow(data[1][5] - data[1][2]),
                "% Change:",
                chalk.bgYellow(
                  ((parseFloat(data[1][5]) - parseFloat(data[1][2])) /
                    ((parseFloat(data[1][5]) + parseFloat(data[1][2])) / 2)) *
                    100
                ),
                "Price:",
                chalk.bgWhite.black(data[1][6]),
                "| Avg Buy:",
                chalk.green(
                  helper.getBuyRateEqualizer(
                    helper.getAverageHighSlopePrices(
                      ohlcStore.slice(
                        ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                        ohlcStore.length
                      )
                    )
                  )
                ),
                "Avg Sell:",
                chalk.red(
                  helper.getSellRateEqualizer(
                    helper.getAverageLowSlopePrices(
                      ohlcStore.slice(
                        ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                        ohlcStore.length
                      )
                    )
                  )
                )
              );

              if (
                watchingSlope[watchingSlope.length - 1] <= 0 &&
                data[1][6] <= dropStart - process.env.MIN_PROFIT
              ) {
                console.log(
                  chalk.bgGreen("Dropping and Waiting for Buy Signal..")
                );
              } else if (watchingSlope[watchingSlope.length - 1] <= 0) {
                console.log(chalk.bgGreen("Going down :)"));
              } else {
                //if it goes up but the percentage increase is small wait...
                console.log(chalk.bgRed("Going up :("), trade);
              }
            } else if (data[2].includes("ticker")) {
              if (
                previousBid < data[1].b[0] &&
                watchingSlope[watchingSlope.length - 1] <= 0 &&
                -0.45 < watchingSlope[watchingSlope.length - 1] &&
                parseFloat(data[1].b[0]) <
                  helper.getSellRateEqualizer(dropStart) -
                    process.env.MIN_PROFIT &&
                -0.5 < helper.getAverageEndOfArray(watchingSlope, 5) &&
                watchingSlope.length > 20 &&
                !bought
              ) {
                bought = true;
                boughtValue = (parseFloat(data[1].b[0]) + 0.01).toFixed(2);
                console.log(
                  chalk.bgCyan("BUY AT") +
                    chalk.bgMagenta(" $" + boughtValue) +
                    chalk.bgCyan(" Equalizer: ") +
                    chalk.bgMagenta(
                      " $" +
                        helper.getSellRateEqualizer(parseFloat(boughtValue))
                    )
                );
                trade.push({
                  type: "buy",
                  bought_at: parseFloat(data[1].b[0]) + 0.01,
                  equalize_at: helper.getSellRateEqualizer(
                    parseFloat(boughtValue)
                  ),
                });
                if (process.env.LIVE)
                  helper.buy(
                    krakenWebSocket,
                    `${tradingSymbol}/USD`,
                    boughtValue,
                    process.env.COST_PER_BUY / boughtValue
                  );
              }
              console.log(
                "Best Ask",
                chalk.red(data[1].a[0]),
                "Best Bid",
                chalk.green(data[1].b[0])
              );
              previousBid = data[1].b[0];
              if (orderID) {
                console.log(orderID);
                setTimeout(() => {
                  krakenRest
                    .api("QueryOrders", { txid: orderID })
                    .then((data) => {
                      console.log(data);
                      if (data)
                        if (data.result[orderID].status == "open") {
                          krakenRest
                            .api("CancelOrder", { txid: orderID })
                            .then((data) => {
                              console.log("Canceled Order", data);
                              orderID = null;
                            });
                        }
                    });
                }, 15000);
              }
            }
          }
        });
        krakenWebSocket.wsAuth.on("message", (data) => {
          data = JSON.parse(data);
          if (data.event != "heartbeat") {
            console.log(JSON.stringify(data));
            if (data[1] == "openOrders") {
              if (bought) {
                console.log("Order Placed");
                if (data[0][0]) {
                  id = Object.entries(data[0][0])[0];
                  if (data[0][0][id]) {
                    orderID = id;
                    if (data[0][0][id].status == "canceled") {
                      bought = false;
                      trade.pop();
                    }
                  }
                }
                //Check if the order was fulfilled in 15 seconds, if not, cancel and try again
              }
            } else if (data[1] == "ownTrades") {
              if (bought) {
                console.log("Order confirmed..", JSON.stringify(data[0]));
                krakenWebSocket.api("unsubscribe", "ohlc", [
                  `${tradingSymbol}/USD`,
                ]); //Subscribe to ohlc
                krakenWebSocket.api("unsubscribe", "ticker", [
                  `${tradingSymbol}/USD`,
                ]); //Subscribe to ticker
                orderID = null;
                delete krakenRest;
                delete krakenWebSocket;
                return startTrading();
              }
            }
          }
        });
      });
    } else {
      console.log(chalk.bold.underline.bgCyan("Selling Mode"));
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
      krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ticker
      //Sell mode
      foundPrice = false;
      priceBought = 0;
      wantedPrice = 0;
      krakenRest.api("TradesHistory").then((trades) => {
        if (trades == undefined) {
          return startTrading();
        }
        trades = Object.entries(trades.result.trades);
        trades.forEach((item, i) => {
          item = item[1];

          if (
            item.pair.substring(1, 4) == tradingSymbol &&
            item.type == "buy" &&
            !foundPrice
          ) {
            console.log(item);
            foundPrice = true;
            priceBought = parseFloat(item.price);
            wantedPrice = helper.getSellRateEqualizer(priceBought);
            volume = parseFloat(item.vol);
          }
        });
        console.log(
          chalk.bold.bgGreen(
            `Bought at: ${priceBought} | Wanted Price: ${wantedPrice} | Estimated Jump $${
              wantedPrice - priceBought
            } | Estimated Profit ${
              sellableVolume * (wantedPrice - priceBought)
            } - Volume: ${sellableVolume}${tradingSymbol}`
          )
        );
        krakenRest
          .api("OHLC", { pair: `${tradingSymbol}/USD` })
          .then((data) => {
            data = data.result[`${tradingSymbol}/USD`];
            if (data == undefined) {
              return startTrading();
            }
            data = data.slice(data.length - 45, data.length - 1); //Get data from the last 45 minutes

            pricesList = [];
            slopeList = [];
            lows = [];
            highs = [];

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
            if (true) {
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
              console.log(
                "Reccomended Minumum Sell Rate:",
                chalk.bgMagenta(
                  helper.getSellRateEqualizer(
                    lows.reduce((a, b) => a + b, 0) / lows.length
                  )
                )
              );
            }
            riseStart = helper.getSellRateEqualizer(
              lows.reduce((a, b) => a + b, 0) / lows.length
            );

            //Start reading the Wewsocket connections

            ohlcStore = [];
            watchingSlope = [];
            watchingPrice = [];

            previousAsk = 0;
            sold = false;
            orderID = null;

            krakenWebSocket.ws.on("message", (data) => {
              data = JSON.parse(data);
              if (data[2]) {
                if (data[2].includes("ohlc")) {
                  if (data[1][5] != 0) ohlcStore.push(data[1]);
                  //console.log(watchingSlope);
                  watchingSlope.push(parseFloat(data[1][5] - data[1][2]));
                  watchingPrice.push(parseFloat(data[1][6]));

                  if (watchingSlope.length % 45 == 0) {
                    newStart = helper.getSellRateEqualizer(
                      helper.getAverageLowSlopePrices(
                        ohlcStore.slice(
                          ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                          ohlcStore.length
                        )
                      )
                    );
                    if (newStart < wantedPrice) {
                      riseStart = wantedPrice;
                      console.log(
                        "New Reccomended Minumum Buy Rate:",
                        chalk.bgMagenta(riseStart)
                      );
                    } else if (
                      newStart &&
                      newStart < watchingPrice[watchingPrice.length - 1]
                    ) {
                      riseStart = (riseStart + newStart) / 2;
                      console.log(
                        "New Reccomended Minumum Buy Rate:",
                        chalk.bgMagenta(riseStart)
                      );
                    }
                  }

                  console.log(
                    "Slope:",
                    chalk.bgYellow(data[1][5] - data[1][2]),
                    "% Change:",
                    chalk.bgYellow(
                      ((parseFloat(data[1][5]) - parseFloat(data[1][2])) /
                        ((parseFloat(data[1][5]) + parseFloat(data[1][2])) /
                          2)) *
                        100
                    ),
                    "Price:",
                    chalk.bgWhite.black(data[1][6]),
                    "| Avg Buy:",
                    chalk.green(
                      helper.getBuyRateEqualizer(
                        helper.getAverageHighSlopePrices(
                          ohlcStore.slice(
                            ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                            ohlcStore.length
                          )
                        )
                      )
                    ),
                    "Avg Sell:",
                    chalk.red(
                      helper.getSellRateEqualizer(
                        helper.getAverageLowSlopePrices(
                          ohlcStore.slice(
                            ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                            ohlcStore.length
                          )
                        )
                      )
                    )
                  );

                  if (
                    watchingSlope[watchingSlope.length - 1] >= 0 &&
                    data[1][6] >= riseStart + process.env.MIN_PROFIT
                  ) {
                    console.log(
                      chalk.bgRed("Raising and Waiting for Sell Signal..")
                    );
                  } else if (watchingSlope[watchingSlope.length - 1] <= 0) {
                    console.log(chalk.bgGreen("Going down :("));
                  } else {
                    //if it goes up but the percentage increase is small wait...
                    console.log(chalk.bgRed("Going up :)"), trade);
                  }
                } else if (data[2].includes("ticker")) {
                  // if (wantedPrice < riseStart) { //either do this in the averaging of the rise start or something else to keep it done we'll see
                  //   riseStart = (wantedPrice + riseStart) / 2;
                  // }
                  //readjust parts
                  if (
                    previousAsk >= data[1].a[0] &&
                    watchingSlope[watchingSlope.length - 1] >= 0 &&
                    0.75 > watchingSlope[watchingSlope.length - 1] &&
                    1.3 > helper.getAverageEndOfArray(watchingSlope, 5) &&
                    parseFloat(data[1].a[0]) >=
                      parseFloat(wantedPrice) +
                        parseFloat(process.env.MIN_PROFIT) &&
                    watchingSlope.length > 20 &&
                    !sold
                  ) {
                    sold = true;
                    soldValue = (parseFloat(data[1].a[0]) - 0.01).toFixed(2);
                    console.log(
                      chalk.bgCyan("SOLD AT") +
                        chalk.bgMagenta(" $" + soldValue) +
                        chalk.bgCyan(" Equalizer: ") +
                        chalk.bgMagenta(
                          " $" +
                            helper.getBuyRateEqualizer(parseFloat(soldValue))
                        )
                    );
                    trade.push({
                      type: "sell",
                      bought_at: soldValue,
                      equalize_at: helper.getBuyRateEqualizer(
                        parseFloat(soldValue)
                      ),
                    });
                    if (process.env.LIVE) {
                      helper.sell(
                        krakenWebSocket,
                        `${tradingSymbol}/USD`,
                        soldValue,
                        sellableVolume
                      );
                    }
                  }
                  console.log(
                    "Best Ask",
                    chalk.red(data[1].a[0]),
                    "Best Bid",
                    chalk.green(data[1].b[0])
                  );
                  previousAsk = data[1].a[0];
                  if (orderID) {
                    console.log(orderID);
                    setTimeout(() => {
                      krakenRest
                        .api("QueryOrders", { txid: orderID })
                        .then((data) => {
                          console.log(data);
                          if (data.result[orderID].status == "open") {
                            krakenRest
                              .api("CancelOrder", { txid: orderID })
                              .then((data) => {
                                console.log("Canceled Order", data);
                                orderID = null;
                              });
                          }
                        });
                    }, 15000);
                  }
                }
              }
            });
            krakenWebSocket.wsAuth.on("message", (data) => {
              data = JSON.parse(data);
              if (data.event != "heartbeat") {
                console.log(JSON.stringify(data));
                if (data[1] == "openOrders") {
                  if (sold) {
                    console.log("Order Placed");
                    if (data[0][0]) {
                      id = Object.entries(data[0][0])[0];
                      if (data[0][0][id]) {
                        orderID = id;
                        if (data[0][0][id].status == "canceled") {
                          sold = false;
                          trade.POP;
                        }
                      }
                    }
                  }
                } else if (data[1] == "ownTrades") {
                  if (sold) {
                    console.log("Order confirmed..", JSON.stringify(data[0]));
                    krakenWebSocket.api("unsubscribe", "ohlc", [
                      `${tradingSymbol}/USD`,
                    ]); //Subscribe to ohlc
                    krakenWebSocket.api("unsubscribe", "ticker", [
                      `${tradingSymbol}/USD`,
                    ]); //Subscribe to ticker
                    delete krakenRest;
                    delete krakenWebSocket;
                    return startTrading();
                  }
                }
              }
            });
          });
      });
    }
  });
}
