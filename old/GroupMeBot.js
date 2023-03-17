const express = require('express');
const bodyParser = require('body-parser');

const port = process.env.PORT || 3000;
const jsonParser = bodyParser.json();

const fetch = require('node-fetch');

const pm2 = require('pm2');

const { exec } = require('child_process');

// var http = require("http");

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

    fetch('https://api.groupme.com/v3/bots/post', {
      method: 'POST',
      body: params,
    });
  }

  sendImage(message, image) {
    let params = {
      bot_id: this.botID,
      text: message.trim(),
      attachments: [
        {
          type: 'image',
          url: image,
        },
      ],
    };
    params = JSON.stringify(params);

    fetch('https://api.groupme.com/v3/bots/post', {
      method: 'POST',
      body: params,
    });
  }
}

module.exports = GroupMeBot;
