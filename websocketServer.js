const { EventEmitter } = require('events');

const emitter = new EventEmitter();

// create a websocket server
const WebSocketServer = require('ws').Server;
// const WebSocket = require('ws').Client;

const wss = new WebSocketServer({
  port: 8080,
});
// send a message to all websocket clients
wss.broadcast = function broadcast(data) {
  const sendData = JSON.stringify(data);
  wss.clients.forEach((client) => {
    // if (client.readyState === WebSocket.OPEN) {
    client.send(sendData);
    // console.log('sending');
  });
};
wss.clientsMap = new Map();
// on wss message, send back same message to same client
wss.on('connection', (ws) => {
  wss.clientsMap.set(ws, ws);
  ws.on('message', (message) => {
    const clientMessage = JSON.parse(message);
    if (clientMessage.request !== undefined) {
      emitter.emit('request', clientMessage.request);
      emitter.once('requestResponse', (data) => {
        ws.send(JSON.stringify({ requestResponse: { data } }));
      });
    }
    // console.log(message);
    // ws.send(message);
  });
});

module.exports = { wss, emitter };
