const axios = require('axios');
const { stdin, stdout } = require('process');

// local modules
const { BINANCE_APP, TIME, BASE_UNIT, ASSET_UNIT, REQUEST_TIMEOUT } = require('./config');
const { play_sound, process_p2p, send_notification } = require('./functions');
const { chalk, l, handle_request_error, print_table } = require('./helpers');

const BINANCE_P2P_API = 'https://c2c.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const REQUEST_BODY = {"page": 1, "rows": 10, "payTypes": [], "asset": ASSET_UNIT, "tradeType": "BUY", "fiat": BASE_UNIT, "publisherType": null, "merchantCheck": false};
const BINANCE_P2P_BUY_URL = `https://p2p.binance.com/en/trade/buy/${ASSET_UNIT}?fiat=${BASE_UNIT}`;

// recording already played alerts. It should be once in 5 minutes.
    // { advNo: datetime of played }
const ALERT_HANDLED = {};
const RECENT_ALERTS = [];

axios.defaults.timeout = REQUEST_TIMEOUT;

// listening for user typing
stdout.write('\x1Bc'); 
if (stdin.isTTY) {
    stdin.setRawMode(true).resume().setEncoding('utf8');
}
stdin.on('data', (key) => {
    if (key === '\u0003' || key.toString().toLowerCase() === 'q') {  l('\n👋 Bye bye!'); process.exit(); }
});

l(`${chalk.bold('👀 Watching...')} ${chalk.bold.red('🗙')}Press Q or ctrl+C to exit...\n`);

setInterval(() => {
    
    axios.post(BINANCE_P2P_API, REQUEST_BODY).then((r) => process_p2p(r, ALERT_HANDLED, ({status, data}) => {
        
        if (status) {
            
            let {filtered, alerts} = data;
            
            if (alerts.length > 0) {
                play_sound();
                alerts.forEach (index => {
                    let d = filtered[index];
                    ALERT_HANDLED[d.advNo] = Date.now();
                    filtered[index]['qualifies'] = true;
                    RECENT_ALERTS.unshift(d);
                });
                // @Todo -> any other way to display multiple in one alert
                send_notification (filtered[alerts[0]].nice_text, BINANCE_P2P_BUY_URL, BINANCE_APP);
            }
            
            const table_columns = {
                "Trader": {width: 20, ref: 'name'}, 
                "Rating": {width: 8, ref: 'rating'},
                "💰Rate": {width: 15, ref: 'price'},
                "Min.": {width: 15, ref: 'min_limit_base'},
                "Max.": {width: 16, ref: 'max_limit_base'},
                "Payment": {width: 16, ref: 'payment_methods'},
            }
            
            print_table (table_columns, filtered, RECENT_ALERTS, { BASE_UNIT, ASSET_UNIT });
            
        } else {
            l(`Error Message: ${data}`);
        }

        
    })).catch(handle_request_error);

}, (TIME*1000));
