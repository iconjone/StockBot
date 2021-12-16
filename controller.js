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
// //when a client connects
// wss.on('connection', function connection(ws) {
//     ws.on('message', function incoming(data) {
//         //send the message to all clients
//         wss.broadcast(data);
//     });
// });
// //# sourceMappingURL=controller.js.map
// function sendToAll(message) {
//     wss.connections.forEach(function(connection) {
//         connection.sendUTF(message);
//     });
// }


//every 5 seconds send a message to all websocket clients
setInterval(function() {
    wss.broadcast(JSON.stringify({num: Math.random()}));
}, 500);