//process.env.NODE_ENV == "development"
require("dotenv").config();
const chalk = require("chalk");
const asciichart = require("asciichart");

//const asciichartConfig = { colors: [asciichart.red, asciichart.green] };
const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");
const GroupMeBot = require("./GroupMeBot");

const helper = require("./helper");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const botID = process.env.BOT_ID; // GroupMeBot ID

bot = new GroupMeBot(botID);
bot.send("Stock Bot Restarting");

const pm2 = require("pm2");
restart = true;
if (process.env.NODE_ENV != "development")
  setTimeout(() => {
    pm2.connect(() => {
      setInterval(function shouldRestart() {
        if (restart) {
          bot.send("Restarting due to hanged process");
          pm2.restart("index");
        } else {
          restart = true;
        }
      }, 60000);
    });
  }, 15000);

mode = true; // If mode is true, we are in buy mode, else if it is in false we are in sell mode - set to true as default

if (process.env.NODE_ENV == "development"){
  process.env.LIVE = 0
}



//Testing for watching trade

let trade = [];

pricesList = [];
slopeList = [];
ohlcStore = [];

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
  balanceCash = 0;
  krakenRest.api("Balance").then(data => {
    let balance = data.result;
    if (balance == undefined) {
      return startTrading();
    }
    let balanceArr = Object.entries(balance);
    console.log(chalk.bgCyan.underline.bold("Starting Balance: "));
    foundSelling = false;
    balanceArr.forEach((item, i) => {
      if (parseFloat(item[1]) != 0) {
        console.log(
          chalk.bgCyan(`${item[0].substring(1, item[0].length)} - ${item[1]}`)
        );
      }

      if (item[0] != "ZUSD" && parseFloat(item[1]) >= 0.001) {
        console.log(item);
        mode = false;
        foundSelling = true;
        tradingSymbol = item[0].substring(1, item[0].length); //get tradingSymbol
        if (tradingSymbol == "XBT") tradingSymbol = "BTC";
        sellableVolume = parseFloat(item[1]);
        if (sellableVolume < 0.02) {
          mode = true;
          foundSelling = false;
        } // for low Balance
      } else if (!foundSelling) {
        tradingSymbol = "ETH";
        // crete function to determine best crypto to trade -> must make min_profit a calcualtable thingy
        if (item[0] == "ZUSD") {
          balanceCash = item[1];
        }
      }
    });
    if (overRideMode) mode = overRideMode;
    //Figured out the mode
    // //force mode to be false for Selling Mode
    //mode = false;
    // //Force mode to be true for Buying Mode
    //mode = true;
    //Force tradingSymbol for Selling or Buying

    if (mode) {
      bought = false;
      console.log(chalk.bold.underline.bgCyan("Buying Mode"));

      //Figure out best market to trade in - We prechose ETH
      krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
      krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ticker
      //  krakenWebSocket.api("subscribe", "openOrders"); // Subscribe to orders
      krakenRest.api("OHLC", { pair: `${tradingSymbol}/USD` }).then(data => {
        data = data.result[`${tradingSymbol}/USD`];
        if (data == undefined) return startTrading();
        data = data.slice(data.length - 180, data.length - 1); //Get data from the last 45 minutes

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
        if (process.env.NODE_ENV == "development") {
          console.log(
            asciichart.plot(pricesList, {
              colors: [asciichart.cyan]
            })
          );
          console.log("-------------------");
          console.log(
            asciichart.plot(slopeList, {
              colors: [asciichart.magenta]
            })
          );
          console.log("-------------------");
          console.log(
            asciichart.plot(lows, {
              colors: [asciichart.red]
            })
          );
          console.log("-------------------");
          console.log(
            asciichart.plot(highs, {
              colors: [asciichart.green]
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

          console.log(
            "Reccomended Maximum Buy Rate:",
            chalk.bgMagenta(
              (helper.getBuyRateEqualizer(
                highs.reduce((a, b) => a + b, 0) / highs.length
              ) +
                helper.getBuyRateEqualizer(
                  lows.reduce((a, b) => a + b, 0) / lows.length
                )) /
                2
            )
          );
        }

        dropStart =
          helper.getBuyRateEqualizer(
            highs.reduce((a, b) => a + b, 0) / highs.length
          ) *
            0.75 +
          helper.getBuyRateEqualizer(
            lows.reduce((a, b) => a + b, 0) / lows.length
          ) *
            0.25;
        bot.send(
          `Buying Mode - Low Target: $${lows
            .sort()
            .slice(0, 5)
            .reduce((a, b) => a + b, 0) / 5} High Target: $${highs
            .sort()
            .slice(highs.length - 5, highs.length)
            .reduce((a, b) => a + b, 0) /
            5} - Reccomended Maximum Buy Rate: $${helper.getBuyRateEqualizer(
            highs.reduce((a, b) => a + b, 0) / highs.length
          )} - Current Price: $${pricesList[pricesList.length - 1]}`
        );
        //Start reading the Wewsocket connections
        if (ohlcStore.length < 1) ohlcStore = [];
        watchingSlope = [];
        watchingPrice = [];
        watchingAO = [];
        watchingAOBig = [];

        previousBid = 0;

        orderID = null;

        krakenWebSocket.ws.on("message", data => {
          data = JSON.parse(data);
          if (data[2]) {
            if (data[2].includes("ohlc")) {
              if (data[1][5] != 0) ohlcStore.push(data[1]);

              watchingSlope.push(parseFloat(data[1][5] - data[1][2]));
              watchingPrice.push(parseFloat(data[1][6]));
              if (ohlcStore.length > 35)
                watchingAO.push(helper.getA0(ohlcStore, 5));
              if (ohlcStore.length > 175)
                watchingAOBig.push(helper.getA0(ohlcStore, 25));

              if (watchingSlope.length % 45 == 0) {
                newDropHigh = helper.getBuyRateEqualizer(
                  helper.getAverageHighSlopePrices(
                    ohlcStore.slice(
                      ohlcStore.length <= 180 ? 0 : ohlcStore.length - 180,
                      ohlcStore.length
                    )
                  ) //I feel like this should be average Low slope prices - Maybe change it back we'll see - We did this because we are looking at the average high and then going from there
                );
                newDropLow = helper.getBuyRateEqualizer(
                  helper.getAverageLowSlopePrices(
                    ohlcStore.slice(
                      ohlcStore.length <= 180 ? 0 : ohlcStore.length - 180,
                      ohlcStore.length
                    )
                  )
                );
                if (newDropHigh && newDropLow) {
                  dropStart =
                    dropStart * 0.5 + newDropHigh * 0.15 + newDropLow * 0.35;
                  //  if (process.env.NODE_ENV == "development")
                  console.log(
                    "New Reccomended Maximum Buy Rate:",
                    chalk.bgMagenta(dropStart)
                  );
                  bot.send(
                    `New Reccomended Max Buy Rate: $${dropStart} | Current Price: $${
                      watchingPrice[watchingPrice.length - 1]
                    }  | AO: ${watchingAO[watchingAO.length - 1]} | BIG AO: ${
                      watchingAOBig[watchingAOBig.length - 1]
                    }`
                  );
                }
              }
              if (watchingSlope.length > 750) {
                watchingSlope = watchingSlope.slice(500, watchingSlope.length);
                watchingPrice = watchingPrice.slice(500, watchingPrice.length);
                ohlcStore = ohlcStore.slice(500, ohlcStore.length);
                watchingAO = watchingAO.slice(
                  watchingAO.length <= 500 ? 0 : watchingAO.length - 500,
                  watchingAO.length
                );
                watchingAOBig = watchingAOBig.slice(
                  watchingAOBig.length <= 500 ? 0 : watchingAOBig.length - 500,
                  watchingAOBig.length
                );
              }

              if (process.env.NODE_ENV == "development")
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
                  ),
                  "AO: ",
                  chalk.bgYellow(watchingAO[watchingAO.length - 1]),
                  "BIG AO:",
                  chalk.bgYellow(watchingAOBig[watchingAOBig.length - 1])
                );

              if (process.env.NODE_ENV == "development") {
                if (
                  watchingSlope[watchingSlope.length - 1] <= 0 &&
                  data[1][6] <= dropStart - process.env.MIN_PROFIT &&
                  watchingAOBig[watchingAOBig.length - 1] < -6
                ) {
                  console.log(
                    chalk.bgGreen("Dropping and Waiting for Buy Signal..")
                  );
                  bot.send("WAITING FOR BUY SIGNAL: $" + data[1][6]);
                } else if (watchingSlope[watchingSlope.length - 1] <= 0) {
                  console.log(chalk.bgGreen("Going down :)"));
                } else {
                  //if it goes up but the percentage increase is small wait...
                  console.log(chalk.bgRed("Going up :("), trade);
                }
              }
            } else if (data[2].includes("ticker")) {
              restart = false;
              highRange = helper.getBuyRateEqualizer(
                helper.getAverageHighSlopePrices(
                  ohlcStore.slice(
                    ohlcStore.length <= 90 ? 0 : ohlcStore.length - 90,
                    ohlcStore.length
                  )
                )
              );
              lowRange = helper.getSellRateEqualizer(
                helper.getAverageLowSlopePrices(
                  ohlcStore.slice(
                    ohlcStore.length <= 90 ? 0 : ohlcStore.length - 90,
                    ohlcStore.length
                  )
                )
              );

              range = highRange - lowRange;
              //Range is about 4

              //was .45 and .5 for the higher, but i want a more graceful
              //Need to make those numbers dynamic, basedd on the range of the high and low prices....
              if (process.env.NODE_ENV == "development") {
                console.log(highRange, lowRange, range);
                console.log(
                  parseFloat(data[1].b[0]) < dropStart - process.env.MIN_PROFIT, //the profit might need to be range/2
                  previousBid <= data[1].b[0],
                  watchingSlope[watchingSlope.length - 1] <= -2.5,
                  watchingSlope[watchingSlope.length - 1] >=
                    helper.getAverageEndOfArray(watchingSlope, 5), //ff
                  -1.5 > watchingAO[watchingAO.length - 1], //Just in case kinda thing (means it has to be at least 3)
                  watchingAO[watchingAO.length - 1] >
                    helper.getAverageEndOfArray(watchingAO, 2), //failed was 5, 10
                  watchingPrice[watchingPrice.length - 1] <
                    helper.getAverageEndOfArray(watchingPrice, 5), // failed
                  watchingPrice[watchingPrice.length - 1] <
                    helper.getAverageEndOfArray(watchingPrice, 50),
                  watchingSlope.length > 175,
                  watchingAOBig[watchingAOBig.length - 1] < -6,
                  !bought,
                  "Need to be all true"
                );
              }
              if (
                parseFloat(data[1].b[0]) < dropStart - process.env.MIN_PROFIT && //the profit might need to be range/2
                previousBid <= data[1].b[0] &&
                watchingSlope[watchingSlope.length - 1] <= -2.5 &&
                watchingSlope[watchingSlope.length - 1] >=
                  helper.getAverageEndOfArray(watchingSlope, 5) && //ff
                -1.5 > watchingAO[watchingAO.length - 1] && //Just in case kinda thing (means it has to be at least 3)
                watchingAO[watchingAO.length - 1] >
                  helper.getAverageEndOfArray(watchingAO, 2) && //failed was 5, 10
                watchingPrice[watchingPrice.length - 1] <
                  helper.getAverageEndOfArray(watchingPrice, 5) && // failed
                watchingPrice[watchingPrice.length - 1] <
                  helper.getAverageEndOfArray(watchingPrice, 50) &&
                watchingSlope.length > 175 &&
                watchingAOBig[watchingAOBig.length - 1] < -6 &&
                !bought
              ) {
                bought = true;
                boughtValue = (
                  parseFloat(data[1].b[0]) * 0.6 +
                  watchingPrice[watchingPrice.length - 1] * 0.4
                ).toFixed(2);
                console.log(
                  chalk.bgCyan("BUY AT") +
                    chalk.bgMagenta(" $" + boughtValue) +
                    chalk.bgCyan(" Equalizer: ") +
                    chalk.bgMagenta(
                      " $" +
                        helper.getSellRateEqualizer(parseFloat(boughtValue))
                    )
                );
                bot.send(
                  "BUY AT $" +
                    boughtValue +
                    " Equalizer: $" +
                    helper.getSellRateEqualizer(parseFloat(boughtValue))
                );
                trade.push({
                  type: "buy",
                  bought_at: boughtValue,
                  equalize_at: helper.getSellRateEqualizer(
                    parseFloat(boughtValue)
                  )
                });
                if (parseInt(process.env.LIVE))
                  //change to allow buy again
                  helper.buy(
                    krakenWebSocket,
                    `${tradingSymbol}/USD`,
                    boughtValue,
                    ((process.env.PERCENTAGE_PER_BUY / 100) * balanceCash) /
                      boughtValue
                  );
              }
              if (process.env.NODE_ENV == "development")
                console.log(
                  "Best Ask",
                  chalk.red(data[1].a[0]),
                  "Best Bid",
                  chalk.green(data[1].b[0])
                );
              previousBid = data[1].b[0];
            }
          }
        });
        boughtTimeout = null;
        krakenWebSocket.wsAuth.on("message", data => {
          data = JSON.parse(data);
          if (data.event != "heartbeat") {
            console.log(JSON.stringify(data));
            if (data[1] == "openOrders") {
              if (bought) {
                console.log("Order Placed");
                if (data[0][0]) {
                  id = Object.entries(data[0][0])[0][0];
                  if (data[0][0][id]) {
                    if (orderID != id) {
                      clearTimeout(boughtTimeout);
                    }
                    orderID = id;
                    if (data[0][0][id].status == "canceled") {
                      bot.send("ORDER Failed - Canceled");
                      bought = false;
                      trade.pop();
                    }
                    if (orderID) {
                      boughtTimeout = setTimeout(() => {
                        krakenRest
                          .api("QueryOrders", { txid: orderID })
                          .then(data => {
                            console.log(data);
                            if (data && bought)
                              if (data.result[orderID].status == "open") {
                                krakenRest
                                  .api("CancelOrder", { txid: orderID })
                                  .then(data => {
                                    console.log("Canceled Order", data);
                                    bot.send("ORDER Timeout - Canceled");
                                    orderID = null;
                                  });
                              }
                          });
                      }, 45000);
                    }
                  }
                }
                //Check if the order was fulfilled in 15 seconds, if not, cancel and try again
              }
            } else if (data[1] == "ownTrades") {
              if (bought) {
                console.log("Order confirmed..", JSON.stringify(data[0]));
                bought = false;
                krakenWebSocket.api("unsubscribe", "ohlc", [
                  `${tradingSymbol}/USD`
                ]); //Subscribe to ohlc
                krakenWebSocket.api("unsubscribe", "ticker", [
                  `${tradingSymbol}/USD`
                ]); //Subscribe to ticker
                bot.send("ORDER confirmed");
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
      krakenRest.api("TradesHistory").then(trades => {
        if (trades.result == undefined) {
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
          //If you need to manually do it
          // if (tradingSymbol != "ETH") {
          //   priceBought = 29830;
          //   wantedPrice = helper.getSellRateEqualizer(priceBought);
          //   volume = sellableVolume;
          // }
        });
        console.log(
          chalk.bold.bgGreen(
            `Selling Mode - Bought at: ${priceBought} | Wanted Price: ${wantedPrice} | Estimated Jump $${wantedPrice -
              priceBought} | Estimated Profit ${sellableVolume *
              (wantedPrice -
                priceBought)} - Volume: ${sellableVolume}${tradingSymbol}`
          )
        );

        //get the last trade and if it's been a while and the price is nowhere near it calculate a new wantedPrice to have it make it's money back
        krakenRest.api("OHLC", { pair: `${tradingSymbol}/USD` }).then(data => {
          data = data.result[`${tradingSymbol}/USD`];
          if (data == undefined) {
            return startTrading();
          }
          data = data.slice(data.length - 180, data.length - 1); //Get data from the last 45 minutes

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

          if (process.env.NODE_ENV == "development") {
            console.log(
              asciichart.plot(pricesList, {
                colors: [asciichart.cyan]
              })
            );
            console.log("-------------------");
            console.log(
              asciichart.plot(slopeList, {
                colors: [asciichart.magenta]
              })
            );
            console.log("-------------------");
            console.log(
              asciichart.plot(lows, {
                colors: [asciichart.red]
              })
            );
            console.log("-------------------");
            console.log(
              asciichart.plot(highs, {
                colors: [asciichart.green]
              })
            );
            console.log("-------------------");
          }
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
          //rise start averager was edited from pure average to 3/4s
          console.log(
            "Reccomended Minumum Sell Rate:",
            chalk.bgMagenta(
              helper.getSellRateEqualizer(
                (highs.reduce((a, b) => a + b, 0) / highs.length) * 0.75
              ) +
                helper.getSellRateEqualizer(
                  (lows.reduce((a, b) => a + b, 0) / lows.length) * 0.25
                )
            )
          );

          riseStart =
            helper.getSellRateEqualizer(
              (highs.reduce((a, b) => a + b, 0) / highs.length) * 0.75
            ) +
            helper.getSellRateEqualizer(
              (lows.reduce((a, b) => a + b, 0) / lows.length) * 0.25
            );

          text = `Bought at: ${priceBought} | Breakeven Price: ${wantedPrice} | Estimated Sell Price: $${riseStart} | Estimated Jump $${riseStart -
            priceBought} | Estimated Profit ${sellableVolume *
            (riseStart -
              priceBought)} - Volume: ${sellableVolume}${tradingSymbol} - Current Price: ${
            pricesList[pricesList.length - 1]
          }`;

          image = helper.generateChartPoint(
            pricesList.slice(
              pricesList.length <= 30 ? 0 : pricesList.length - 30,
              pricesList.length
            ),
            parseInt(wantedPrice)
          );

          bot.sendImage(text, image);

          //Start reading the Wewsocket connections

          if (ohlcStore.length < 1) ohlcStore = [];
          watchingSlope = [];
          watchingPrice = [];
          watchingAO = [];
          watchingAOBig = [];

          previousAsk = 0;
          sold = false;
          orderID = null;

          krakenWebSocket.ws.on("message", data => {
            data = JSON.parse(data);
            if (data[2]) {
              if (data[2].includes("ohlc")) {
                if (data[1][5] != 0) ohlcStore.push(data[1]);

                watchingSlope.push(parseFloat(data[1][5] - data[1][2]));
                watchingPrice.push(parseFloat(data[1][6]));
                if (ohlcStore.length > 35)
                  watchingAO.push(helper.getA0(ohlcStore, 5));
                if (ohlcStore.length > 175)
                  watchingAOBig.push(helper.getA0(ohlcStore, 25));

                if (watchingSlope.length % 45 == 0) {
                  newStart = 0;
                  newStartLow = helper.getSellRateEqualizer(
                    helper.getAverageLowSlopePrices(
                      ohlcStore.slice(
                        ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                        ohlcStore.length
                      )
                    )
                  );
                  newStartHigh = helper.getSellRateEqualizer(
                    helper.getAverageHighSlopePrices(
                      ohlcStore.slice(
                        ohlcStore.length <= 45 ? 0 : ohlcStore.length - 45,
                        ohlcStore.length
                      )
                    )
                  );
                  newStart =
                    riseStart * 0.5 + newStartLow * 0.2 + newStartHigh * 0.3; //edited aversge code

                  if (newStart && newStart < wantedPrice) {
                    riseStart = wantedPrice;
                    if (process.env.NODE_ENV == "development")
                      console.log(
                        "Default Minumum Buy Rate:",
                        chalk.bgMagenta(riseStart)
                      );
                  } else if (
                    newStart &&
                    newStart < watchingPrice[watchingPrice.length - 1]
                  ) {
                    riseStart = newStart;
                    if (process.env.NODE_ENV == "development")
                      console.log(
                        "New Reccomended Minumum Sell Rate:",
                        chalk.bgMagenta(riseStart)
                      );
                    bot.send(
                      `New Reccomended Min Sell Rate: $${riseStart} | Current Price: $${
                        watchingPrice[watchingPrice.length - 1]
                      } | AO: ${watchingAO[watchingAO.length - 1]} | BIG AO: ${
                        watchingAOBig[watchingAOBig.length - 1]
                      }`
                    );
                  }
                }
                if (watchingSlope.length > 750) {
                  watchingSlope = watchingSlope.slice(
                    500,
                    watchingSlope.length
                  );
                  watchingPrice = watchingPrice.slice(
                    500,
                    watchingPrice.length
                  );
                  ohlcStore = ohlcStore.slice(500, ohlcStore.length);
                  watchingAO = watchingAO.slice(500, watchingAO.length);
                  watchingAOBig = watchingAOBig.slice(
                    500,
                    watchingAOBig.length
                  );
                }

                if (process.env.NODE_ENV == "development") {
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
                    ),
                    "AO: ",
                    chalk.bgYellow(watchingAO[watchingAO.length - 1]),
                    "BIG AO:",
                    chalk.bgYellow(watchingAOBig[watchingAOBig.length - 1])
                  );

                  if (
                    watchingSlope[watchingSlope.length - 1] >= 0 &&
                    data[1][6] >= riseStart + process.env.MIN_PROFIT
                  ) {
                    if (!sold)
                      bot.send("WAITING FOR SELL SIGNAL: $" + data[1][6]);
                    console.log(
                      chalk.bgRed("Raising and Waiting for Sell Signal..")
                    );
                  } else if (watchingSlope[watchingSlope.length - 1] <= 0) {
                    console.log(chalk.bgGreen("Going down :("));
                  } else {
                    //if it goes up but the percentage increase is small wait...
                    console.log(chalk.bgRed("Going up :)"), trade);
                  }
                }
              } else if (data[2].includes("ticker")) {
                restart = false;
                // if (wantedPrice < riseStart) { //either do this in the averaging of the rise start or something else to keep it done we'll see
                //   riseStart = (wantedPrice + riseStart) / 2;
                // }
                //readjust parts
                if (process.env.NODE_ENV == "development")
                  console.log(
                    previousAsk >= data[1].a[0],
                    watchingSlope[watchingSlope.length - 1] >= 0,
                    0.75 > watchingSlope[watchingSlope.length - 1],
                    1.3 > helper.getAverageEndOfArray(watchingSlope, 5),
                    parseFloat(data[1].a[0]) >=
                      parseFloat(wantedPrice) +
                        parseFloat(process.env.MIN_PROFIT),
                    watchingAO[watchingAO.length - 1] >= 1.5,
                    watchingSlope.length > 35,
                    !sold,
                    "Must be all true"
                  );
                if (
                  previousAsk >= data[1].a[0] &&
                  watchingSlope[watchingSlope.length - 1] >= 0 &&
                  0.75 > watchingSlope[watchingSlope.length - 1] &&
                  1.3 > helper.getAverageEndOfArray(watchingSlope, 5) &&
                  parseFloat(data[1].a[0]) >=
                    parseFloat(wantedPrice) +
                      parseFloat(process.env.MIN_PROFIT) &&
                  watchingAO[watchingAO.length - 1] >= 1.5 &&
                  watchingSlope.length > 35 &&
                  !sold
                ) {
                  sold = true;
                  soldValue = (parseFloat(data[1].a[0]) - 0.01).toFixed(2);
                  if (
                    (soldValue + watchingPrice[watchingPrice.length - 1]) / 2 >=
                    parseFloat(wantedPrice) + parseFloat(process.env.MIN_PROFIT)
                  )
                    soldValue =
                      (soldValue + watchingPrice[watchingPrice.length - 1]) / 2;
                  console.log(
                    chalk.bgCyan("SOLD AT") +
                      chalk.bgMagenta(" $" + soldValue) +
                      chalk.bgCyan(" Equalizer: ") +
                      chalk.bgMagenta(
                        " $" + helper.getBuyRateEqualizer(parseFloat(soldValue))
                      )
                  );
                  bot.send(
                    "SOLD AT $" +
                      soldValue +
                      " Equalizer: $" +
                      helper.getBuyRateEqualizer(parseFloat(soldValue)) +
                      " Profit: $" +
                      (soldValue - priceBought) * sellableVolume +
                      " AO: " +
                      watchingAO[watchingAO.length - 1]
                  );
                  trade.push({
                    type: "sell",
                    bought_at: soldValue,
                    equalize_at: helper.getBuyRateEqualizer(
                      parseFloat(soldValue)
                    )
                  });
                  if (parseInt(process.env.LIVE)) {
                    helper.sell(
                      krakenWebSocket,
                      `${tradingSymbol}/USD`,
                      soldValue,
                      sellableVolume
                    );
                  }
                }
                if (process.env.NODE_ENV == "development")
                  console.log(
                    "Best Ask",
                    chalk.red(data[1].a[0]),
                    "Best Bid",
                    chalk.green(data[1].b[0])
                  );
                previousAsk = data[1].a[0];
                if (orderID) {
                  console.log(orderID);
                }
              }
            }
          });
          soldTimeout = null;
          krakenWebSocket.wsAuth.on("message", data => {
            data = JSON.parse(data);
            if (data.event != "heartbeat") {
              console.log(JSON.stringify(data));
              if (data[1] == "openOrders") {
                if (sold) {
                  console.log("Order Placed");
                  if (data[0][0]) {
                    id = Object.entries(data[0][0])[0][0];
                    if (data[0][0][id]) {
                      if (orderID != id) {
                        clearTimeout(soldTimeout);
                      }
                      orderID = id;
                      if (data[0][0][id].status == "canceled") {
                        bot.send("ORDER Failed - Canceled");
                        sold = false;
                        trade.POP;
                      }
                      soldTimeout = setTimeout(() => {
                        krakenRest
                          .api("QueryOrders", { txid: orderID })
                          .then(data => {
                            console.log(data);
                            if (data && sold)
                              if (data.result[orderID].status == "open") {
                                krakenRest
                                  .api("CancelOrder", { txid: orderID })
                                  .then(data => {
                                    console.log("Canceled Order", data);
                                    bot.send("ORDER Timeout - Canceled");
                                    orderID = null;
                                  });
                              }
                          });
                      }, 25000);
                    }
                  }
                }
              } else if (data[1] == "ownTrades") {
                if (sold) {
                  console.log("Order confirmed..", JSON.stringify(data[0]));

                  bot.send("ORDER Confirmed");
                  krakenWebSocket.api("unsubscribe", "ohlc", [
                    `${tradingSymbol}/USD`
                  ]); //Subscribe to ohlc
                  krakenWebSocket.api("unsubscribe", "ticker", [
                    `${tradingSymbol}/USD`
                  ]); //Subscribe to ticker
                  delete krakenRest;
                  delete krakenWebSocket;
                  //sold = false;
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

const express = require("express");
var bodyParser = require("body-parser");

const port = process.env.PORT || 3000;
var jsonParser = bodyParser.json();

const { exec } = require("child_process");

app = express();
app.get("/", (req, res) => {
  res.send("Hey! this is the website for my Stock Bot");
});
app.post("/", jsonParser, (req, res) => {
  var request = req.body;
  if (request.sender_type != "bot") {
    if (request.text.toLowerCase() == "!restart") {
      pm2.connect(() => {
        pm2.restart("index");
      });
    } else if (request.text.toLowerCase() == "!status") {
      pm2.connect(() => {
        pm2.describe("index", (err, description) => {
          var descriptionVal = description[0];
          bot.send(
            `Status: ${descriptionVal.pm2_env.status} - Restarts: ${descriptionVal.pm2_env.restart_time} - Memory: ${descriptionVal.monit.memory} - CPU usage: ${descriptionVal.monit.cpu}%`
          );
        });
      });
    } else if (request.text.toLowerCase() == "!price") {
      var text = `The current price is: $${pricesList[pricesList.length - 1]}`;
      var image = helper.generateChart(
        pricesList.slice(
          pricesList.length <= 30 ? 0 : pricesList.length - 30,
          pricesList.length
        )
      );
      bot.sendImage(text, image);
    } else if (request.text.toLowerCase() == "!help") {
      bot.send("Get !status, !restart, !price or !update");
    } else if (request.text.toLowerCase() == "!update") {
      bot.send("Updating... Restart will occur automatically");
      exec("update.bat", (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          bot.send("Something failed");
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          bot.send("Update Succesful.. Restarting");
          pm2.connect(() => {
            pm2.restart("index");
          });
          return;
        }
        console.log(`stdout: ${stdout}`);
      });
    }
  }
});

app.listen(port, () => {
  console.log("Bot Server Ready");
});
