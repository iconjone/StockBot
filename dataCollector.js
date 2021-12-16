require("dotenv").config();
const KrakenRestClient = require("./kraken/KrakenRestClient");
const KrakenWebSocketClient = require("./kraken/KrakenWebSocketClient");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

let krakenRest = new KrakenRestClient(key, secret);
let krakenWebSocket = new KrakenWebSocketClient(key, secret);

tradingSymbol = "ETH";


function collectData(tradingSymbol) {

    krakenWebSocket.api("subscribe", "ohlc", [`${tradingSymbol}/USD`]); //Subscribe to ohlc
    krakenWebSocket.api("subscribe", "ticker", [`${tradingSymbol}/USD`]); //Subscribe to ticker

    krakenWebSocket.ws.on("message", data => {
        data = JSON.parse(data);

        // console.log(data);
        if(data.event == undefined){
            // console.log(data[2])
            if(data[2].includes("ticker")){
            emitter.emit('tickerClose', data[1].c[0]);

                // console.log(data[1].c[0]);
            }
        }

    })

}

// collectData(tradingSymbol);

module.exports = { collectData, emitter };