fee = 0.0016;

function buy(krakenWebSocket, pair, price, volume) {
  krakenWebSocket.api("addOrder", "addOrder", [pair], {
    ordertype: "limit",
    type: "buy",
    price: price,
    volume: volume,
    oflags: "fcib,post",
  });
}
function sell(krakenWebSocket, pair, price, volume) {
  krakenWebSocket.api("addOrder", "addOrder", [pair], {
    ordertype: "limit",
    type: "sell",
    price: price,
    volume: volume,
    oflags: "fciq,post",
  });
}

function sellingEstimatorsOHLC(prices, open, close, low, high) {
  prices = prices.map(Number);
  open = open.map(Number);
  close = close.map(Number);
  low = low.map(Number);
  high = high.map(Number);

  slope = high;
  priceSlope = [];
  slope.map((ele, index) => {
    return ele - low[index];
  });
  console.log(price, open, close, low, high);
  console.log(
    asciichart.plot(prices, {
      colors: [asciichart.cyan],
    })
  );
  console.log("-------------------");
  console.log(
    asciichart.plot(slope, {
      colors: [asciichart.magenta],
    })
  );
  console.log("-------------------");
  console.log(
    asciichart.plot(low, {
      colors: [asciichart.red],
    })
  );
  console.log("-------------------");
  console.log(
    asciichart.plot(high, {
      colors: [asciichart.green],
    })
  );
  console.log("-------------------");
}

function getSellRateEqualizer(input) {
  return (input + input * fee) / (1 - fee);
}

function getBuyRateEqualizer(input) {
  return (312 / 313) * input;
}

function getAverageHighSlopePrices(ohlc) {
  highs = [];
  ohlc.forEach((item, i) => {
    if (item[5] && item[2] && parseFloat(item[5] - item[2]) > 0)
      highs.push(parseFloat(item[3]));
  });
  return highs.reduce((a, b) => a + b, 0) / highs.length;
}

function getAverageLowSlopePrices(ohlc) {
  lows = [];
  ohlc.forEach((item, i) => {
    if (item[5] && item[2] && parseFloat(item[5] - item[2]) < 0)
      lows.push(parseFloat(item[4]));
  });
  return lows.reduce((a, b) => a + b, 0) / lows.length;
}

function getAverageEndOfArray(arr, length) {
  arr = arr.slice(arr.length - length, arr.length);
  sum = arr.reduce((a, b) => a + b, 0);
  return sum / length;
}

function getSMA(ohlcStore, length) {
  ohlcStore = ohlcStore.slice(ohlcStore.length - length);
  ohlcStore = ohlcStore.map((x) => parseFloat(x[6]));
  sum = ohlcStore.reduce((a, b) => a + b, 0);
  return sum / length;
}

function getA0(ohlcStore, period) {
  period35 = getSMA(ohlcStore, period * 7);
  period5 = getSMA(ohlcStore, period * 1);
  return period5 - period35;
}

module.exports = {
  buy,
  sell,
  getSellRateEqualizer,
  getBuyRateEqualizer,
  getAverageHighSlopePrices,
  getAverageLowSlopePrices,
  getAverageEndOfArray,
  getA0,
};
