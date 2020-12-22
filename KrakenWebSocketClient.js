const WebSocket = require("ws");
const KrakenRestClient = require("./KrakenRestClient");

// Public/Private method names
const methods = {
  public: ["ticker", "ohlc", "trade", "spread", "book"],
  private: [
    "ownTrades",
    "openOrders",
    "addOrder",
    "cancelOrder",
    "cancelAll",
    "cancelAllOrdersAfter",
  ],
};

const getToken = (krakenRest) => {
  krakenRest.api("GetWebSocketsToken").then((token) => {
    retToken = token.result.token;
    return retToken;
  });
};

class KrakenWebSocketClient {
  constructor(key, secret) {
    this.wsAuth = new WebSocket("wss://ws-auth.kraken.com");
    this.ws = new WebSocket("wss://ws.kraken.com");
    this.authToken = "Not Set Up";

    const krakenRest = new KrakenRestClient(key, secret);
    //    console.log(getToken(krakenRest));
    this.wsAuth.on("open", (open) => {
      console.log("WebSocket Auth Opened");
      this.wsAuth.send(JSON.stringify({ event: "ping" }));
      krakenRest.api("GetWebSocketsToken").then((token) => {
        this.authToken = token.result.token;
        this.wsAuth.send(
          JSON.stringify({
            event: "subscribe",
            subscription: {
              name: "ownTrades",
              token: this.authToken,
            },
          })
        );
      });
    });

    this.ws.on("open", (open) => {
      console.log("WebSocket Opened");
      this.ws.send(JSON.stringify({ event: "ping" }));
    });
    this.wsAuth.on("message", (data) => {
      data = JSON.parse(data);
      //console.log("WebSocket Auth", data);
    });

    this.ws.on("message", (data) => {
      data = JSON.parse(data);
      //console.log("WebSocket", data);

      if (data[2])
        if (data[2].includes("ohlc")) {
          console.log(
            data[1][5] - data[1][2],
            data[1][5] - data[1][2] >= 0 ? "Climbing" : "Falling",
            "|",
            data[1][3] - data[1][4],
            Math.abs(data[1][3] - data[1][4]) !=
              Math.abs(data[1][5] - data[1][2])
              ? "IMPORTANT"
              : "",
            data[3]
          );
        }
    });
  }
  api(eventPass, method, pair, params) {
    if (methods.public.includes(method)) {
      return this.publicMethod(eventPass, method, pair, params);
    } else if (methods.private.includes(method)) {
      return this.privateMethod(eventPass, method, pair, params);
    } else {
      throw new Error(method + " is not a valid WS method.");
    }
  }
  async publicMethod(eventPass, method, pair, params) {
    let payload = {};
    payload.event = eventPass;
    payload.subscription = params || {};
    payload.subscription.name = method;
    payload.pair = pair;

    if (this.ws._readyState == 0) {
      // if the WebSocket is not ready, run recursive
      await new Promise((r) => setTimeout(r, 2000));
      this.publicMethod(eventPass, method, pair, params);
    } else {
      this.ws.send(JSON.stringify(payload));
    }
  }

  // ws.send(
  //   JSON.stringify({
  //     event: "subscribe",
  //     pair: ["XBT/USD", "XBT/EUR"],
  //     subscription: {
  //       name: "ticker",
  //     },
  //   })
  // );
}
module.exports = KrakenWebSocketClient;
