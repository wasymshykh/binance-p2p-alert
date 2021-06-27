// price setup alert
const ALERT = { price: { amount: 164, or_below: true}, limit: { amount: 10000, or_above: true} };

// delay (in second) to request the API
const TIME = 3;

// BASE_UBIT -> type of fiat currency
const BASE_UNIT = "PKR";
// ASSET_UNIT -> type of currency to buy
const ASSET_UNIT = "USDT";

const BINANCE_APP = true;

const REQUEST_TIMEOUT = 4000;

// assets/sound folder must contain the following files
const SOUNDS = {
    gilfoyle: 'gilfoyle_alert.mp3',
    reward: 'reward_alert.wav'
}

module.exports = { ALERT, TIME, BASE_UNIT, ASSET_UNIT, BINANCE_APP, REQUEST_TIMEOUT, SOUNDS }
