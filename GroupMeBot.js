// //const http = require("http");
// const hostname = "127.0.0.1";
// const port = process.env.PORT || 3000;

const fetch = require("node-fetch");

class GroupMeBot {
  constructor(botID) {
    this.botID = botID;
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
