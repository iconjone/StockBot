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

module.exports = { buy, sell };
