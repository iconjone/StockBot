require("dotenv").config();
const KrakenRestClient = require("./kraken/KrakenRestClient");
const KrakenWebSocketClient = require("./kraken/KrakenWebSocketClient");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

let krakenRest = new KrakenRestClient(key, secret);
let krakenWebSocket = new KrakenWebSocketClient(key, secret);

tradingSymbol = "ETH";

krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ticker

krakenWebSocket.ws.on("message", data => {
    data = JSON.parse(data);

    // console.log(data);
    if(data.event == undefined){
        console.log(data)
    }

})


