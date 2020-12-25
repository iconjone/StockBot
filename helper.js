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

module.exports = { buy, sell };
