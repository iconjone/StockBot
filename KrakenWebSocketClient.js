const WebSocket = require("ws");
const KrakenRestClient = require("./KrakenRestClient");
const chalk = require("chalk");

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
      console.log(chalk.green.underline("WebSocket Auth Opened"));
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
      console.log(chalk.green.underline("WebSocket Opened"));
      this.ws.send(JSON.stringify({ event: "ping" }));
    });

    // this.ws.on("message", (data) => {
    //   data = JSON.parse(data);
    //   //console.log("WebSocket", data);
    // });
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
  async privateMethod(eventPass, method, pair, params) {
    if (pair && typeof pair == "object") {
      pair = pair[0];
    }

    let payload = {};
    if (eventPass == "subscribe") {
      payload.subscription = params || {};
      payload.subscription.name = method;
      payload.subscription.token = this.authToken;
    } else {
      payload = params || {};
      payload.token = this.authToken;
      if (pair) payload.pair = pair;
      if (payload.price && typeof payload.price == "number")
        payload.price = payload.price.toString();
      if (payload.volume && typeof payload.volume == "number")
        payload.volume = payload.volume.toString();
    }
    payload.event = eventPass;

    if (this.wsAuth._readyState == 0 || this.authToken == "Not Set Up") {
      // if the WebSocket is not ready, run recursive
      await new Promise((r) => setTimeout(r, 2000));
      this.privateMethod(eventPass, method, pair, params);
    } else {
      this.wsAuth.send(JSON.stringify(payload));
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
