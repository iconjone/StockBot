const express = require("express");
var bodyParser = require("body-parser");

const port = process.env.PORT || 3000;
var jsonParser = bodyParser.json();

const pm2 = require("pm2");

const { exec } = require("child_process");

class StockServer {
  constructor(GroupMeBot, pricesList) {
    this.bot = GroupMeBot;
    this.pricesList = pricesList;
    this.app = express();
    this.app.get("/", (req, res) => {
      res.send("Hey! this is the website for my Stock Bot");
    });
    this.app.post("/", jsonParser, (req, res) => {
      var request = req.body;
      if (request.sender_type != "bot") {
        if (request.text.toLowerCase() == "!restart") {
          pm2.connect(() => {
            pm2.restart("index");
          });
        } else if (request.text.toLowerCase() == "!status") {
          pm2.connect(() => {
            pm2.describe("index", (err, description) => {
              var descriptionVal = description[0];
              this.bot.send(
                `Status: ${descriptionVal.pm2_env.status} - Restarts: ${descriptionVal.pm2_env.restart_time} - Memory: ${descriptionVal.monit.memory} - CPU usage: ${descriptionVal.monit.cpu}%`
              );
            });
          });
        } else if (request.text.toLowerCase() == "!help") {
          this.bot.send("Get !status, !restart or !update");
        } else if (request.text.toLowerCase() == "!update") {
          this.bot.send("Updating... Restart will occur automatically");
          exec("update.bat", (error, stdout, stderr) => {
            if (error) {
              console.log(`error: ${error.message}`);
              this.bot.send("Something failed");
              return;
            }
            if (stderr) {
              console.log(`stderr: ${stderr}`);
              this.bot.send("Update Succesful.. Restarting");
              pm2.connect(() => {
                pm2.restart("index");
              });
              return;
            }
            console.log(`stdout: ${stdout}`);
          });
        }
      }
    });

    this.app.listen(port, () => {
      console.log("Bot Server Ready");
    });
  }
}

module.exports = StockServer;
