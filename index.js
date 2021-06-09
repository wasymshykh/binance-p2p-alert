const axios = require('axios');
const sound = require('sound-play');
const path = require('path');
const open = require('open');
const notifier = require('node-notifier');
const chalk = require('chalk');
const { stdin } = require('process');

const BINANCE_P2P_API = 'https://c2c.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// price setup alert
const ALERT = { price: { amount: 162, or_below: true}, limit: { amount: 20000, or_above: true} };

// delay (in second) to request the API
const TIME = 5;

// BASE_UBIT -> type of fiat currency
const BASE_UNIT = "PKR";
// ASSET_UNIT -> type of currency to buy
const ASSET_UNIT = "USDT";

const BINANCE_P2P_BUY_URL = `https://p2p.binance.com/en/trade/buy/${ASSET_UNIT}?fiat=${BASE_UNIT}`;

// we want notification click to be opened in binance desktop app -> true
const BINANCE_APP = false;

const REQUEST_BODY = {"page": 1, "rows": 10, "payTypes": [], "asset": ASSET_UNIT, "tradeType": "BUY", "fiat": BASE_UNIT, "publisherType": null, "merchantCheck": false};

// recording already played alerts. It should be once in 5 minutes.
    // { advNo: datetime of played }
const ALERT_HANDLED = {};

axios.defaults.timeout = 5000;
const l = console.log;

stdin.setRawMode(true).resume().setEncoding('utf8');
stdin.on( 'data', (key) => {
    if (key === '\u0003' || key.toString().toLowerCase() === 'q') {  l('\n👋 Bye bye!'); process.exit(); }
});

const fa = num => `${Number(num).toLocaleString()} ${ASSET_UNIT}`;
const fb = num => `${Number(num).toLocaleString()} ${BASE_UNIT}`;
const handle_error = error => { l((error.code !== undefined ? (`Error Code: ${error.code}`): (error.toJSON !== undefined ? error.toJSON().message : error.toString()))); }

const play_sound = (volumne = 0.5, type = 'reward') => {
    if (type === 'gilfoyle') {
        sound.play(path.join(__dirname, 'sound', 'gilfoyle_alert.mp3'), volumne);
    }
    if (type === 'reward') {
        sound.play(path.join(__dirname, 'sound', 'reward_alert.wav'), volumne);
    }
}

const generate_notification = function (message) {
    notifier.notify({
        title: '⚠️ P2P Alert',
        message: message,
        icon: path.join(__dirname, 'icons','binance-logo.png'),
        sound: true,
        wait: true,
    });
    notifier.on('click', async function (obj, options, event) {
        if (BINANCE_APP) {
            await open(BINANCE_P2P_BUY_URL, { app: { name: path.join('C:', 'Program Files', 'Binance', 'Binance.exe') } });
        } else {
            await open(BINANCE_P2P_BUY_URL);
        }
    });
}

const check_condition = (data, filtered_index) => {
    let satisfies = true;
    
    if (ALERT.price.or_below && (data.price > ALERT.price.amount)) { satisfies = false; }
    
    if (satisfies) {
        if (ALERT.limit.or_above && (data.min_limit_base > ALERT.limit.amount)) { satisfies = false; }
    }

    // checking if the data exists
    let now = Date.now();
    if (ALERT_HANDLED[data.advNo] !== undefined) {
        // adding 1 minute (60 seconds = 60000 ms) to old alert time to check for next alert
        if (now <= (ALERT_HANDLED[data.advNo] + 60000)) { satisfies = false; }
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
            'nice_text': "",
            'nice_console': ""
        }
        d.nice_text = `${d.name} (${BASE_UNIT} → ${ASSET_UNIT}) 💰 ${fb(d.price)} `;
        
        d.nice_console = `${chalk.black.bgRed('⚠️  ALERT! ')} ${chalk.bold.green(d.name)} (${BASE_UNIT} → ${ASSET_UNIT}) 💰 ${chalk.bold.green(fb(d.price))} ${chalk.white.dim.bgBlackBright(` limit ${fb(d.min_limit_base)} - ${fb(d.max_limit_base)} (${fa(d.min_limit_asset)} - ${fa(d.max_limit_asset)})`)}`;

        // checking for satisfied conditions for alert
        let check = check_condition(d, filtered.length);
        if (check.status) { alerts.push(check.data); }

        filtered.push(d);
    });

    cb({status: true, data: {filtered: filtered, alerts: alerts}});
}

l(`${chalk.bold('👀 Watching...')} ${chalk.bold.red('🗙')}Press Q or ctrl+C to exit...\n`);

setInterval(() => {
    
    axios.post(BINANCE_P2P_API, REQUEST_BODY).then((r) => process_p2p(r, ({status, data}) => {
        
        if (status) {
            
            let {filtered, alerts} = data;
            
            if (alerts.length > 0) {
                play_sound();
                alerts.forEach (index => {
                    let d = filtered[index];
                    ALERT_HANDLED[d.advNo] = Date.now();
                    l(d.nice_console);
                });
                // @Todo -> any other way to display multiple in one alert
                generate_notification(filtered[alerts[0]].nice_text);
            }
    
        } else {
            l(`Error Message: ${data}`);
        }
        
    })).catch(handle_error);

}, (TIME*1000));
