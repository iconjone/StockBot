function getHighsLowsOHLC(data) {
  const high = [];
  const low = [];

  for (let i = 0; i < data.length - 1; i += 1) {
    high.push(data[i].high);
    low.push(data[i].low);
  }
  if (data[data.length - 1].close > data[data.length - 1].open) {
    high.push(data[data.length - 1].close);
    low.push(data[data.length - 1].open); // Could make it last price
  } else {
    high.push(data[data.length - 1].open);
    low.push(data[data.length - 1].close); // Could make it last price
  }

  return {
    high,
    low,
  };
}

module.exports = { getHighsLowsOHLC };
