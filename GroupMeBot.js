// //const http = require("http");
// const hostname = "127.0.0.1";
// const port = process.env.PORT || 3000;

const fetch = require("node-fetch");

var http = require("http");

class GroupMeBot {
  constructor(botID) {
    this.botID = botID;
    this.server = http.createServer(function (req, res) {
      if (req.url == "/") {
        //check the URL of the current request

        // set response header
        res.writeHead(200, { "Content-Type": "text/json" });

        // set response content
        res.write('{"PRETTY COOL": "WOW"}');
        res.end();
      }
      // 2 - creating server

      console.log(req, res);
    });
    this.server.listen(5000);
  }

  send(message) {
    let params = {
      bot_id: this.botID,
      text: message.trim(),
    };
    params = JSON.stringify(params);

    fetch("https://api.groupme.com/v3/bots/post", {
      method: "POST",
      body: params,
    });
  }
}

module.exports = GroupMeBot;
