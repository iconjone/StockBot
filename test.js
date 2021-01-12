const express = require("express");
var bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

data = { "This Is the high level of the server": "WOW" };
var jsonParser = bodyParser.json();

app.get("/", (req, res) => {
  res.json(data);
});
app.post("/", jsonParser, function (req, res) {
  console.log(req.body);
  request = req.body;
  if (request.sender_type != "bot") {
    console.log("we can respons");
  }
});

app.listen(port, () => {
  console.log("Ready");
});
