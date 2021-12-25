/* eslint-disable no-undef */
/* eslint-disable no-console */
// const Plotly = require('./plotly');

// Connect to websocket server

const ws = new WebSocket(`ws://${window.location.hostname}:80`);
console.log(ws);
ws.onopen = function onOpen() {
  console.log('Connected to server');
  ws.send(
    JSON.stringify({
      request: { type: 'ticker', interval: 1 },
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

// on ws error check for connection and reload page
ws.onclose = function onClose(evt) {
  console.log('Error/Close occured');
  console.log(evt.data);
  ws.close();
  location.reload();
};

let breakEven = 0;
let amount = 0;
let limit = 0;
let cnt = 0;
let mode = '';

const ticker = document.getElementById('ticker');
const AO = document.getElementById('AO');
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
    traceNum = mode === 'buy' ? 1 : 2;
    console.log(traceNum);
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
  } else if (data.AO !== undefined) {
    const AOdata = [];
    const AOintervals = [1, 5, 15, 30, 60, 240];
    AOintervalsColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];

    AOintervals.forEach((interval, ite) => {
      const trace = {
        y: data.AO[`ohlc-${interval}`].slice(data.AO[`ohlc-${interval}`].length - 100),
        type: 'bar',
        name: `${interval}m<br>${data.AO[`ohlc-${interval}`][data.AO[`ohlc-${interval}`].length - 1].toFixed(2)}`,
        yaxis: `y${ite + 1}`,
        xaxis: `x${ite + 1}`,
      };
      if (data.AO[`ohlc-${interval}-predict`] !== undefined) {
        trace.y.push(...data.AO[`ohlc-${interval}-predict`]);
        trace.marker = {};
        trace.marker.color = [...Array(100).fill(AOintervalsColors[ite]), ...Array(10).fill('#c3ff0e')];
      }

      AOdata.push(trace);
    });

    Plotly.react(AO, AOdata, {
      title: 'AO Chart',
      xaxis: {
        title: 'Time',
        dtick: 10,
      },
      yaxis: {
        title: 'AO Value',
      },
      paper_bgcolor: '#161f27',
      plot_bgcolor: '#161f27',
      font: {
        color: '#dbdbdb',
      },
      height: 800,
      grid: {
        rows: 6,
        columns: 1,
        pattern: 'independent',
        roworder: 'top to bottom',
      },
    });
  }
};
