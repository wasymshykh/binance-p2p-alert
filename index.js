const axios = require('axios');
const { stdin, stdout } = require('process');
const readline = require('readline');

// local modules
const { BINANCE_APP, TIME, BASE_UNIT, ASSET_UNIT, REQUEST_TIMEOUT, ALERT } = require('./config');
const { play_sound, process_p2p, send_notification } = require('./functions');
const { chalk, l, handle_request_error, print_table, clear_screen, reset_table_lines } = require('./helpers');

const BINANCE_P2P_API = 'https://c2c.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const REQUEST_BODY = {"page": 1, "rows": 10, "payTypes": [], "asset": ASSET_UNIT, "tradeType": "BUY", "fiat": BASE_UNIT, "publisherType": null, "merchantCheck": false};
const BINANCE_P2P_BUY_URL = `https://p2p.binance.com/en/trade/buy/${ASSET_UNIT}?fiat=${BASE_UNIT}`;

// recording already played alerts. It should be once in 5 minutes.
    // { advNo: datetime of played }
const ALERT_HANDLED = {};
const RECENT_ALERTS = [];

axios.defaults.timeout = REQUEST_TIMEOUT;

let interval = null;

const application_state = {
    page: 'setting',
    key_strokes: [],
    pending_request: false
}
// listening for user typing
if (stdin.isTTY) {
    stdin.setRawMode(true).resume().setEncoding('utf8');
}

// is number
function validate_number (num) {
    let patn = new RegExp(/([0-9\.])/);
    return patn.test(num);
}

function line_info_message (message) {
    return `← ${message}    `;
}
function default_line_info_message () {
    return chalk.grey(line_info_message("write ('Enter' to save or 'Ctrl+W' to go back)"));
}
function line_input_enter (inp) {
    return chalk.bold.green(inp) + chalk.grey(' '+BASE_UNIT+' '.repeat(50));
}

// some important lengths
const important_lengths = {
    setting: {
        height: 6,
        price: {
            row: 2,
            input_start: 20,
            input_length: function () {
                return ALERT.price.amount.toString().length;
            },
            input_value: function () {
                return ALERT.price.amount;
            },
            page: 'setting.price',
            t: function () {
                return this.input_start + this.input_length() + 1;
            }
        },
        limit: {
            row: 4,
            input_start: 20,
            input_length:  function () {
                return ALERT.limit.amount.toString().length;
            },
            input_value: function () {
                return ALERT.limit.amount;
            },
            page: 'setting.limit',
            t: function () {
                return this.input_start + this.input_length() + 1;
            }
        }
    }
}

function back_to_setting (obj) {
    readline.cursorTo(stdout, obj.input_start, obj.row);
    stdout.write(line_input_enter(obj.input_value()));
    application_state.page = 'setting';
    application_state.key_strokes = [];
    readline.cursorTo(stdout, 0, important_lengths.setting.height);
}

function write_setting_input (obj) {
    readline.cursorTo(stdout, obj.input_start, obj.row);
    stdout.write(`${chalk.bold.blue(application_state.key_strokes.join(""))} ${default_line_info_message()}`);
    readline.cursorTo(stdout, obj.input_start+application_state.key_strokes.length, obj.row);
}

function validate_number_keystrokes () {
    let {key_strokes} = application_state;
    if (key_strokes.length === 0) { return false; }
    // validating number
    let num = key_strokes.join('');
    if (isNaN(num)) { return false; }
    if (Number(num) <= 0) { return false; }
    return true;
}

stdin.on('data', (key) => {
    if (key === '\u0003' || key.toString().toLowerCase() === 'q') {  l('\n👋 Bye bye!'); process.exit(); }
    let pre = key.toString().toLowerCase();
    

    if (application_state.page === 'main') {
        if (pre === 's') {
            clear_screen();
            reset_table_lines();
            application_state.page = 'setting';
            return open_configuration();
        }
    } else if (application_state.page === 'setting') {

        if (pre === '\r') {
            application_state.page = 'main';
            clear_screen();
            l(`${chalk.bold('👀 Watching...')} ${chalk.grey('🞮')+chalk.grey.italic("Press 'Q' or 'Ctrl+C' to exit | Press 'S' to open configuration")}\n`);
            start_interval();
        } else if (pre === 'p') {
            activate_configuration_input (important_lengths.setting.price);
        } else if (pre === 'l') {
            activate_configuration_input (important_lengths.setting.limit);
        }

    } else if (application_state.page === 'setting.price') {

        if (pre !== '\b') {
            if (validate_number(pre)) { application_state.key_strokes.push(pre); } 
            else if (pre === '\r' || pre === '\x17') {
                // enter is pressed / '\x17' -> for ctrl+w
                if (pre === '\r' && validate_number_keystrokes()) { ALERT.price.amount = Number(application_state.key_strokes.join("")); }
                back_to_setting(important_lengths.setting.price); return;
            }
        } else if (application_state.key_strokes.length !== 0) { application_state.key_strokes.pop(); }
        return write_setting_input(important_lengths.setting.price);

    } else if (application_state.page === 'setting.limit') {

        if (pre !== '\b') {
            if (validate_number(pre)) { application_state.key_strokes.push(pre); } 
            else if (pre === '\r' || pre === '\x17') {
                if (pre === '\r' && validate_number_keystrokes()) { ALERT.limit.amount = Number(application_state.key_strokes.join("")); }
                back_to_setting(important_lengths.setting.limit); return;
            }
        } else if (application_state.key_strokes.length !== 0) { application_state.key_strokes.pop(); }
        return write_setting_input(important_lengths.setting.limit);

    }
    
});

function activate_configuration_input (obj) {
    readline.cursorTo(stdout, obj.t(), obj.row);
    stdout.write(default_line_info_message());
    readline.cursorTo(stdout, obj.input_start, obj.row);
    application_state.page = obj.page;
}

function open_configuration () {
    clean_interval(); clear_screen();
    
    let default_amount_text = `${chalk.bold.green(ALERT.price.amount)} ${chalk.grey.italic(BASE_UNIT)}`;
    let default_limit_text = `${chalk.bold.green(ALERT.limit.amount)} ${chalk.grey.italic(BASE_UNIT)}`;

    stdout.write(`${chalk.red("⚙️ Configuration "+'─'.repeat(12))}\n`);
    stdout.write(`${chalk.red('─'.repeat(29))}\n`);
    stdout.write(`(Press '${chalk.bold('P')}') Price - ${default_amount_text}\n`);
    stdout.write(`${chalk.grey('─'.repeat(29))}\n`);
    stdout.write(`(Press '${chalk.bold('L')}') Limit - ${default_limit_text}\n`);
    stdout.write(`${chalk.red('─'.repeat(29))}\n`);
    stdout.write(`Press 'Enter' to start\n`);
}
open_configuration();

function start_interval () {
    interval = setInterval(() => {
        
        if (!application_state.pending_request) {
            
            application_state.pending_request = true;

            axios.post(BINANCE_P2P_API, REQUEST_BODY).then((r) => process_p2p(r, ALERT_HANDLED, ({status, data}) => {

                if (interval !== null) {
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
                        
                        // drawing table
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
                        handle_request_error(`Error Message: ${data}`)
                    }
                }
                
            })).catch(handle_request_error).finally(() => {
                application_state.pending_request = false;
            });
        
        }
    
    }, (TIME*1000));
}

function clean_interval () {
    
    if (interval !== null) {
        clearInterval(interval);
        interval = null;
    }

}
