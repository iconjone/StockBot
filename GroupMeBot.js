const express = require("express");
var bodyParser = require("body-parser");

const port = process.env.PORT || 3000;
var jsonParser = bodyParser.json();

const fetch = require("node-fetch");

const pm2 = require("pm2");

// var http = require("http");

class GroupMeBot {
  constructor(botID) {
    this.botID = botID;
    this.app = express();
    this.app.get("/", (req, res) => {
      res.send("Hey! this is the website for my Stock Bot");
    });
    this.app.post("/", jsonParser, (req, res) => {
      var request = req.body;
      if (request.sender_type != "bot") {
        if (request.text.min.toLowerCase() == "!restart" || "!start") {
          pm2.connect(() => {
            pm2.restart("index");
          });
        }
      }
    });

    this.app.listen(port, () => {
      console.log("Bot Server Ready");
    });
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
