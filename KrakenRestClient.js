//Custom Kraken for REST API that just works... - Based off of https://github.com/nothingisdead/npm-kraken-api
const got = require("got");
const fetch = require("node-fetch");

const crypto = require("crypto");
const qs = require("qs");

// Public/Private method names
const methods = {
  public: [
    "Time",
    "Assets",
    "AssetPairs",
    "Ticker",
    "Depth",
    "Trades",
    "Spread",
    "OHLC",
  ],
  private: [
    "Balance",
    "TradeBalance",
    "OpenOrders",
    "ClosedOrders",
    "QueryOrders",
    "TradesHistory",
    "QueryTrades",
    "OpenPositions",
    "Ledgers",
    "QueryLedgers",
    "TradeVolume",
    "AddOrder",
    "CancelOrder",
    "DepositMethods",
    "DepositAddresses",
    "DepositStatus",
    "WithdrawInfo",
    "Withdraw",
    "WithdrawStatus",
    "WithdrawCancel",
    "GetWebSocketsToken",
  ],
};

// Default options
const defaults = {
  url: "https://api.kraken.com",
  version: 0,
  timeout: 5000,
};

// Create a signature for a request
const getMessageSignature = (path, request, secret, nonce) => {
  const message = qs.stringify(request);
  const secret_buffer = new Buffer.from(secret, "base64");
  const hash = new crypto.createHash("sha256");
  const hmac = new crypto.createHmac("sha512", secret_buffer);
  const hash_digest = hash.update(nonce + message).digest("binary");
  const hmac_digest = hmac
    .update(path + hash_digest, "binary")
    .digest("base64");

  return hmac_digest;
};

// Send an API request
const rawRequest = async (url, headers, data, timeout) => {
  // Set custom User-Agent string
  headers["User-Agent"] = "Kraken Javascript API Client";
  headers["Content-Type"] = "application/x-www-form-urlencoded"; //Important for some reason with the Kraken API UGH

  // const options = { headers, timeout };
  const customOptions = {
    headers,
    timeout,
    body: qs.stringify(data),
    method: "POST",
  };
  // Object.assign(options, {
  //   method: "POST",
  //   body: qs.stringify(data),
  // });

  const response = await fetch(url, customOptions);
  const body = await response.text();
  return await JSON.parse(body);
  // fetch(url, customOptions)
  //   .then((res) => res.text())
  //   .then(async (text) => {
  //     data = JSON.parse(text);
  //     console.log(data);
  //     return await data;
  //   });

  // return "";
  // console.log(options);
  // const { body } = await got(url, options);
  //
  // const response = JSON.parse(body);
  // console.log(JSON.stringify(response), "Request Response");

  // if (response.error && response.error.length) {
  //   const error = response.error
  //     .filter((e) => e.startsWith("E"))
  //     .map((e) => e.substr(1));
  //
  //   if (!error.length) {
  //     throw new Error("Kraken API returned an unknown error");
  //   }
  //
  //   throw new Error(error.join(", "));
  // }
};

/**
 * KrakenClient connects to the Kraken.com API
 * @param {String}        key               API Key
 * @param {String}        secret            API Secret
 * @param {String|Object} [options={}]      Additional options. If a string is passed, will default to just setting `options.otp`.
 * @param {String}        [options.otp]     Two-factor password (optional) (also, doesn't work)
 * @param {Number}        [options.timeout] Maximum timeout (in milliseconds) for all API-calls (passed to `request`)
 */
class KrakenRestClient {
  constructor(key, secret, options) {
    // Allow passing the OTP as the third argument for backwards compatibility
    if (typeof options === "string") {
      options = { otp: options };
    }

    this.config = Object.assign({ key, secret }, defaults, options);
  }

  /**
   * This method makes a public or private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  api(method, params, callback) {
    // Default params to empty object
    if (typeof params === "function") {
      callback = params;
      params = {};
    }

    if (methods.public.includes(method)) {
      return this.publicMethod(method, params, callback);
    } else if (methods.private.includes(method)) {
      return this.privateMethod(method, params, callback);
    } else {
      throw new Error(method + " is not a valid API method.");
    }
  }

  /**
   * This method makes a public API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  publicMethod(method, params, callback) {
    params = params || {};

    // Default params to empty object
    if (typeof params === "function") {
      callback = params;
      params = {};
    }

    const path = "/" + this.config.version + "/public/" + method;
    const url = this.config.url + path;
    const response = rawRequest(url, {}, params, this.config.timeout);

    // if (typeof callback === "function") {
    //   response
    //     .then((result) => callback(null, result))
    //     .catch((error) => callback(error, null));
    // }

    return response;
  }

  /**
   * This method makes a private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  privateMethod(method, params, callback) {
    params = params || {};

    // Default params to empty object
    if (typeof params === "function") {
      callback = params;
      params = {};
    }

    const path = "/" + this.config.version + "/private/" + method;
    const url = this.config.url + path;

    if (!params.nonce) {
      params.nonce = new Date() * 1000; // spoof microsecond
    }

    if (this.config.otp !== undefined) {
      params.otp = this.config.otp;
    }

    const signature = getMessageSignature(
      path,
      params,
      this.config.secret,
      params.nonce
    );

    const headers = {
      "API-Key": this.config.key,
      "API-Sign": signature,
    };

    const response = rawRequest(url, headers, params, this.config.timeout);
    //console.log(response, "this?");

    return response;
    // response
    //   .then((result) => {
    //     console.log(result, "the result");
    //     return result;
    //   })
    //   .catch((error) => {
    //     return error;
    //   });
  }
}

module.exports = KrakenRestClient;
