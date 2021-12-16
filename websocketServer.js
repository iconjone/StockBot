const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

//create a websocket server
const WebSocketServer = require('ws').Server;
const WebSocket = require('ws').Client;
const wss = new WebSocketServer({
    port: 8080
});
//send a message to all websocket clients
wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        // if (client.readyState === WebSocket.OPEN) {
            client.send(data);
            console.log("sending")
        
    });
};

emitter.on('data', function(data) {
    console.log(data, "test")
});


module.exports = { wss, emitter };