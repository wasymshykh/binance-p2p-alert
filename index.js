const axios = require('axios');
const sound = require('sound-play');
const path = require('path');

const BINANCE_P2P_API = 'https://c2c.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// price setup alert
const ALERT = { price: { amount: 162.5, or_below: true}, limit: { amount: 5000, or_above: true} };

// delay (in second) to request the API
const TIME = 2;

// BASE_UBIT -> type of fiat currency
const BASE_UNIT = "PKR";
// ASSET_UNIT -> type of currency to buy
const ASSET_UNIT = "USDT";

const REQUEST_BODY = {"page": 1, "rows": 10, "payTypes": [], "asset": ASSET_UNIT, "tradeType": "BUY", "fiat": BASE_UNIT, "publisherType": null, "merchantCheck": false};

// recording already played alerts. It should be once in 5 minutes.
    // { advNo: datetime of played }
const ALERT_HANDLED = {};

const fa = num => `${Number(num).toLocaleString()} ${ASSET_UNIT}`;
const fb = num => `${Number(num).toLocaleString()} ${BASE_UNIT}`;
const handle_error = error => { console.log((error.code !== undefined ? (`Error Code: ${error.code}`): (error.toJSON !== undefined ? error.toJSON().message : error.toString()))); }

const play_sound = (volumne = 0.5, type = 'reward') => {
    if (type === 'gilfoyle') {
        sound.play(path.join(__dirname, 'sound', 'gilfoyle_alert.mp3'), volumne);
    }
    if (type === 'reward') {
        sound.play(path.join(__dirname, 'sound', 'reward_alert.wav'), volumne);
    }
}

const check_condition = (data, filtered_index) => {
    let satisfies = true;
    
    if (ALERT.price.or_below && (data.price > ALERT.price.amount)) { satisfies = false; }
    
    if (satisfies) {
        if (ALERT.limit.or_above && (data.min_limit_base > ALERT.limit.amount)) { satisfies = false; }
    }
    
    if (satisfies) {
        return {status: true, data: filtered_index};
    }
    return {status: false};
}

const process_p2p = (response, cb) => {
    let { data } = response;
    if (data == undefined || data == '') {
        cb ({status: false, data: 'body is not returned by the API'});
    }
    // {data: { data: {} }}
    data = data.data;
    if (data == undefined || data == '') {
        cb ({status: false, data: 'data is not returned by the API'});
    }

    // @Todo -> check for limited orders

    // sorting the data for useful properties
    let filtered = [];
    let alerts = [];
    data.forEach(({adv, advertiser}) => {
        // { adv: {}, advertiser: {} }
        let d = {
            'advNo': adv.advNo,
            'name': advertiser.nickName,
            'rating': (Number(advertiser.monthFinishRate)*100).toFixed(2),
            'price': Number(adv.price),
            'min_limit_base': Number(adv.minSingleTransAmount), 'max_limit_base': Number(adv.maxSingleTransAmount),
            'min_limit_asset': Number(adv.minSingleTransQuantity), 'max_limit_asset': Number(adv.maxSingleTransQuantity),
            'payment_methods': adv.tradeMethods.map(t => t.payType),
            'nice_text': "" 
        }
        d.nice_text = `${d.name} (${d.rating}%) selling ${ASSET_UNIT} for ${fb(d.price)} limit ${fb(d.min_limit_base)} - ${fb(d.max_limit_base)} (${fa(d.min_limit_asset)} - ${fa(d.max_limit_asset)})`;
        
        // checking for satisfied conditions for alert
        let check = check_condition(d, filtered.length);
        if (check.status) { alerts.push(check.data); }

        filtered.push(d);
    });

    cb({status: true, data: {filtered: filtered, alerts: alerts}});
}

axios.defaults.timeout = 5000;

axios.post(BINANCE_P2P_API, REQUEST_BODY).then((r) => process_p2p(r, ({status, data}) => {
    
    if (status) {

        let {filtered, alerts} = data;

        if (alerts.length > 0) {
            play_sound();
            alerts.forEach (index => {
                let d = filtered[index];
                ALERT_HANDLED[d.advNo] = Date.now();
            });
        }

    } else {
        console.log(`Error Message: ${data}`);
    }

})).catch(handle_error);
