/* eslint-disable no-undef */
/* eslint-disable no-console */
// const Plotly = require('./plotly');

// Connect to websocket server
const ws = new WebSocket('ws://localhost:8080');
console.log(ws);
ws.onopen = function onOpen() {
  console.log('Connected to server');
  ws.send(
    JSON.stringify({
      request: { type: 'ticker', interval: 5 },
    }),
  );

  // keep websocket alive, send ping every 5 minutes
  setInterval(
    () => {
      ws.send(JSON.stringify({ ping: true }));
    },
    5 * 60 * 1000,
  );
};

let breakEven = 0;
let amount = 0;
let limit = 0;
let cnt = 0;
let mode = '';

const ticker = document.getElementById('ticker');
const modeText = document.getElementById('mode');
const profitText = document.getElementById('profit');

// On message
ws.onmessage = function onMessage(evt) {
  // console.log(evt.data)
  const data = JSON.parse(evt.data);
  console.log(data);
  if (data.requestResponse !== undefined) {
    if (data.requestResponse.ticker !== undefined) {
      breakEven = data.requestResponse.ticker.breakEven;
      mode = data.requestResponse.ticker.mode;
      modeText.innerHTML = `Mode: ${mode.toUpperCase()}`;

      const tickerData = data.requestResponse.ticker.prices.slice(720 - 200);
      limit = 0;
      cnt = 200;
      Plotly.newPlot(
        ticker,
        [
          {
            y: tickerData,
            type: 'line',
            name: 'Ticker Close Prices',
          },
        ],
        {
          title: 'Ticker Chart',
          xaxis: {
            title: 'Time',
            dtick: 25,
          },
          yaxis: {
            title: 'Price',
          },
          paper_bgcolor: '#161f27',
          plot_bgcolor: '#161f27',
          font: {
            color: '#dbdbdb',
          },
        },
      );
      if (mode === 'sell') {
        amount = data.requestResponse.ticker.lastTrade.amount;
        profitText.innerHTML = `Real Time Profit: ~$${((data.requestResponse.ticker.prices[719] - breakEven) * amount).toFixed(2)}`;

        Plotly.addTraces(ticker, {
          y: Array(200).fill(breakEven),
          type: 'line',
          name: `Break Even Price <br>$${breakEven.toFixed(2)}`,
        });
      }
    }
  } else if (data.tickerClose !== undefined) {
    const newTicker = parseFloat(data.tickerClose);
    if (mode === 'sell') {
      profitText.innerHTML = `Real Time Profit: ~$${((newTicker - breakEven) * amount).toFixed(2)}`;
      Plotly.extendTraces(ticker, { y: [[breakEven]] }, [1]);
      if (limit !== 0) {
        Plotly.extendTraces(ticker, { y: [[limit]] }, [2]);
      }
    } else if (limit !== 0) { // if mode is buy and limit has been set
      Plotly.extendTraces(ticker, { y: [[limit]] }, [1]);
    }
    Plotly.extendTraces(ticker, { y: [[newTicker]] }, [0]);

    cnt += 1;
    if (cnt > 200) {
      Plotly.relayout(ticker, {
        xaxis: {
          range: [cnt - 200, cnt],
          title: 'Time',
          dtick: 25,
        },
        title: `Ticker Chart - $${newTicker.toFixed(2)}`,
      });
    }
  } else if (data.limit !== undefined) {
    traceNum = data.limit.type === 'buy' ? 1 : 2;
    if (limit !== 0) {
      Plotly.deleteTraces(ticker, [traceNum]);
    }
    limit = parseFloat(data.limit);
    if (mode === 'sell') {
      Plotly.addTraces(ticker, {
        y: Array(cnt).fill(limit),
        type: 'line',
        name: `Limit Price<br>$${limit.toFixed(2)}<br>Profit: ~$${((limit - breakEven) * amount).toFixed(2)}`,
      });
    } else {
      Plotly.addTraces(ticker, {
        y: Array(cnt).fill(limit),
        type: 'line',
        name: `Limit Price<br>$${limit.toFixed(2)}`,
      });
    }
  }
};
