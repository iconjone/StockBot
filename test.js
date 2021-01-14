const ImageCharts = require("image-charts");
require("dotenv").config();
const botID = process.env.BOT_ID; // GroupMeBot ID
const GroupMeBot = require("./GroupMeBot");
bot = new GroupMeBot(botID);

value = [1256, 1263, 1356, 1284, 1263, 1235, 1257, 1236, 1343, 1293, 1285];

bot.sendImage("This is a graph", generateChartPoint(value, 1275));

function generateChart(value) {
  index = [...Array(value.length).keys()];

  const chart = ImageCharts()
    .cht("lxy")
    .chd("t:" + index.join(",") + "|" + value.join(","))
    .chxt("y")
    .chxr("0," + (Math.min(...value) - 10) + "," + (Math.max(...value) + 10))
    .chdlp("t")
    .chm("s,000000,0,-1,5|s,000000,1,-1,5")
    .chls("3")
    .chof(".png")
    .chs("999x200");

  return chart.toURL();
}

function generateChartPoint(value, point) {
  index = [...Array(value.length).keys()];
  pointArr = Array(value.length).fill(point);

  const chart = ImageCharts()
    .cht("lxy")
    .chd(
      "t:" +
        index.join(",") +
        "|" +
        value.join(",") +
        "|" +
        index.join(",") +
        "|" +
        pointArr.join(",")
    )
    .chxt("y")
    .chxr("0," + (Math.min(...value) - 10) + "," + (Math.max(...value) + 10))
    .chdlp("t")
    .chm("s,000000,0,-1,5|s,000000,1,-1,5")
    .chls("3|2,4,1")
    .chof(".png")
    .chs("999x200");

  return chart.toURL();
}
