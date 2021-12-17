/* eslint-disable no-undef */
/* eslint-disable no-console */
// const Plotly = require('./plotly');

// Connect to websocket server
const ws = new WebSocket('ws://localhost:8080');
console.log(ws);
ws.onopen = function onOpen() {
  console.log('Connected to server');
  ws.send(JSON.stringify({ request: { type: 'ticker', tradingSymbol: 'ETH', interval: 1 } }));
};

let tickerData = [];
let limit = 0;

// On message
ws.onmessage = function onMessage(evt) {
  // console.log(evt.data)
  const data = JSON.parse(evt.data);
  console.log(data);
  if (data.requestResponse !== undefined) {
    limit = data.requestResponse.limit;
    tickerData = data.requestResponse.prices.slice(720-150);
    Plotly.newPlot('ticker', [{
      y: tickerData,
      type: 'line',
      name: 'Ticker Close Prices',
    },
    {
      y: Array(150).fill(data.requestResponse.limit),
      type: 'line',
      name: 'Limit',
    }], {
      title: 'Ticker Chart',
      xaxis: {
        title: 'Time',
      },
      yaxis: {
        title: 'Price',

      },
      paper_bgcolor: '#161f27',
      plot_bgcolor: '#161f27',
      font: {
        color: '#dbdbdb',
      },
    });
  } else if (data.tickerClose !== undefined) {
    Plotly.extendTraces('ticker', { y: [[data.tickerClose]] }, [0]);
    Plotly.extendTraces('ticker', { y: [[limit]] }, [1]);

    cnt += 1;
    if (cnt > 150) {
      Plotly.relayout('ticker', {
        xaxis: {
          range: [cnt - 150, cnt],
        },
      }, { title: 'Ticker Chart' });
    }
  } else if (data.limit !== undefined) {
    limit = data.limit;
    Plotly.deleteTraces('ticker', [1]);
    Plotly.addTraces('ticker', {
      y: Array(150).fill(data.limit),
      type: 'line',
      name: 'Limit',
    });
  }
};
