require("dotenv").config();
const KrakenRestClient = require("./KrakenRestClient");
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
let krakenRest = new KrakenRestClient(key, secret);
const tradingSymbol = "ETH"
const scaler = require('minmaxscaler')
const Taira = require('taira');
const plotlib = require('nodeplotlib');




const tf = require('@tensorflow/tfjs-node');



//Use the high and low to create a lstm data set





async function test(){

    let unit = 5
     data = await krakenRest.api("OHLC", { pair: `${tradingSymbol}/USD`, interval: "15" })
        let dataSet =[];
        let secondDataSet =[];
        let time = [] //0
        let open = [] //1
        // let high = [] //2
        // let low = [] //3
        let close = [] //4
        // let average = [] //5
        // let volume = [] //6
        for(let i = 0; i < data.result[`${tradingSymbol}/USD`].length; i++){
            // time.push(data.result[`${tradingSymbol}/USD`][i][0])
            time.push(i)
            open.push(data.result[`${tradingSymbol}/USD`][i][1])
            // high.push(data.result[`${tradingSymbol}/USD`][i][2])
            // low.push(data.result[`${tradingSymbol}/USD`][i][3])
            close.push(data.result[`${tradingSymbol}/USD`][i][4])
            // average.push(data.result[`${tradingSymbol}/USD`][i][5])
            // volume.push(data.result[`${tradingSymbol}/USD`][i][6])
        }
        //get the min and max of both open and close to normalize the data
        let minMax = scaler.fit_transform(open.concat(close))
        let openNormalized = scaler.transform(open)
        let closeNormalized = scaler.transform(close)
        //create the data set split into unit size
        console.log(openNormalized.length / unit)
        for(let i = 0; i < openNormalized.length / unit; i++){
            let tempOpen = []
            let tempClose = []
            for(let j = 0; j < unit; j++){
                tempOpen.push(openNormalized[i * unit + j])
                tempClose.push(closeNormalized[i * unit + j])
            }
            dataSet.push([[time[i]],...tempOpen,...tempClose])
            secondDataSet.push(tempOpen)
            // dataSet.push([[time[i]],[openNormalized[i]], [closeNormalized[i]]])
            // secondDataSet.push([[openNormalized[i]], [closeNormalized[i]]])
        }
        console.log("Length of data set: " + dataSet.length)
       console.log( dataSet.slice(0,5))

       tf.tensor(dataSet[0]).print()

        const input = tf.input({shape: [3,5]});
        const lstm = tf.layers.lstm({units: 5, returnSequences:false}).apply(input)
        console.log(JSON.stringify(lstm.shape));
        const output = tf.layers.dense({units: 1, activation: 'linear'}).apply(lstm)
      

        const model = tf.model({inputs: input, outputs: lstm})
        

        model.compile({optimizer: 'adam', loss: 'meanSquaredError'});
        // 

        model.summary()
        
        const xs = tf.tensor(dataSet.slice(0,5));
        console.log(xs.shape)
        const ys = tf.tensor(secondDataSet.slice(1,6));
        // const ys = tf.tensor(onlyData)  //().map(x => cleanData(x)));

        
        // // Train model with fit().
        await model.fit(xs, ys, {epochs: 100});
        
        // // Run inference with predict().
        tf.tensor(dataSet.slice(250,275)).print()
        test = model.predict(tf.tensor(dataSet.slice(250,275)))
        test.print()
        expected = tf.tensor(openNormalized.slice(251,276))
        expected.print()
        }

        // console.log()








test();
