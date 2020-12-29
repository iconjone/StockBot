require("dotenv").config();

const KrakenRestClient = require("./KrakenRestClient");
const KrakenWebSocketClient = require("./KrakenWebSocketClient");

const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key

let krakenRest = new KrakenRestClient(key, secret);
let krakenWebSocket = new KrakenWebSocketClient(key, secret);

orderID = "OO37G6-QK5ZY-Y2236E";
console.log("wait 15 seconds");
