const sound = require('sound-play');
const path = require('path');
const open = require('open');
const notifier = require('node-notifier');

const { ALERT, BASE_UNIT, ASSET_UNIT, SOUNDS, BLOCKED_ADS } = require('../config');
const { format_number, chalk } = require('../helpers');

const play_sound = (volume = 0.5, type) => {
    if (type === undefined) {
        Object.entries(SOUNDS).forEach(([k, v]) => {
            if (v.default !== undefined && v.default) { type = k; }
        });
    }
    if (SOUNDS[type] === undefined) return false;
    let sound_file = SOUNDS[type].source;
    sound.play(path.join(__dirname, '../', 'assets', 'sound', sound_file), volume);
}

const send_notification = (message, link, app) => {
    let icon = path.join(__dirname, 'assets', 'icons', 'binance-logo.png')
    notifier.notify({ title: '⚠️ P2P Alert', message, icon, sound: true, wait: true });
    notifier.on('click', async (obj, options, event) => {
        if (app)
            await open(link, { app: { name: path.join('C:', 'Program Files', 'Binance', 'Binance.exe') } });
        else
            await open(link);
    });
}

const process_p2p = (response, ALERT_HANDLED, cb) => {
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
    data.forEach(({ adv, advertiser }) => {
        // { adv: {}, advertiser: {} }
        let d = details_extract(adv, advertiser);

        if (!BLOCKED_ADS.includes(adv.advNo)) { 
            // checking for satisfied conditions for alert
            let check = check_condition(d, ALERT_HANDLED, filtered.length);
            if (check.status) { alerts.push(check.data); }
            else {
                d['qualifies'] = check.qualifies;
            }
            filtered.push(d);
        }

    });

    cb({ status: true, data: { filtered, alerts } });
}

const details_extract = (adv, advertiser) => {

    const d = {
        advNo: adv.advNo,
        name: advertiser.nickName,
        rating: (Number(advertiser.monthFinishRate)*100).toFixed(2),
        price: Number(adv.price),
        min_limit_base: Number(adv.minSingleTransAmount), max_limit_base: Number(adv.maxSingleTransAmount),
        min_limit_asset: Number(adv.minSingleTransQuantity), max_limit_asset: Number(adv.maxSingleTransQuantity),
        payment_methods: adv.tradeMethods.map(t => t.identifier),
    }
    
    d.nice_text = `${d.name} (${BASE_UNIT} → ${ASSET_UNIT}) 💰 ${format_number(d.price, BASE_UNIT)} `;

    d.nice_console = `${chalk.black.bgRed('⚠️  ALERT! ')} ${chalk.bold.green(d.name)} (${BASE_UNIT} → ${ASSET_UNIT}) 💰 ${chalk.bold.green(format_number(d.price, BASE_UNIT))} ${chalk.white.dim.bgBlackBright(` limit ${format_number(d.min_limit_base, BASE_UNIT)} - ${format_number(d.max_limit_base, BASE_UNIT)} (${format_number(d.min_limit_asset, ASSET_UNIT)} - ${format_number(d.max_limit_asset, ASSET_UNIT)})`)}`;

    return d;
}

const check_condition = (data, ALERT_HANDLED, filtered_index) => {
    let satisfies = true;
    let qualifies = true;
    
    if (ALERT.price.or_below && (data.price > ALERT.price.amount)) { satisfies = false; qualifies = false; }
    
    if (satisfies) {
        /**
         * 100 >= 100 && 100 <= 150 = true = true
         * 1000 >= 100 && 1000 <= 1000 = false = true
         * 1000 >= 2000 && 1000 <= 2000 = false = true
         * 100 >= 1 && 100 <= 99 = false = true
         */
        if (ALERT.limit.or_above && (ALERT.limit.amount >= data.min_limit_base && ALERT.limit.amount <= data.max_limit_base)) { 
            satisfies = false; 
            qualifies = false; 
        } else if ((!ALERT.limit.or_above) && (data.min_limit_base > ALERT.limit.amount)) {
            satisfies = false;
            qualifies = false;
        }

    }

    // checking if the data exists
    let now = Date.now();
    if (ALERT_HANDLED[data.advNo] !== undefined) {
        // adding 1 minute (60 seconds = 60000 ms) to old alert time to check for next alert
        if (now <= (ALERT_HANDLED[data.advNo] + (60000*5))) { satisfies = false; }
    }
    
    if (satisfies) {
        return { status: true, data: filtered_index };
    }
    return { status: false, qualifies };
}

module.exports = { play_sound, send_notification, process_p2p };
