require("dotenv").config();
const GroupMeBot = require("./GroupMeBot");
const botID = process.env.BOT_ID; // GroupMeBot ID
console.log("fixing it?");
bot = new GroupMeBot(botID);

if (parseInt(process.env.LIVE)) {
  console.log(typeof process.env.LIVE);
  console.log("it's live");
}
