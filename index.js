const axios = require('axios');

const BINANCE_P2P_API = 'https://c2c.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

// BASE_UBIT -> type of fiat currency
const BASE_UNIT = "PKR";
// ASSET_UNIT -> type of currency to buy
const ASSET_UNIT = "USDT";

const REQUEST_BODY = {"page":1, "rows":10, "payTypes":[], "asset": ASSET_UNIT, "tradeType":"BUY", "fiat": BASE_UNIT, "publisherType": null, "merchantCheck": false};

const fa = num => `${Number(num).toLocaleString()} ${ASSET_UNIT}`;
const fb = num => `${Number(num).toLocaleString()} ${BASE_UNIT}`;
const handle_error = error => { console.log(`Error Code: ${error.code}`); }

const process_p2p = (response, cb) => {

    let { data } = response;
    if (data == undefined || data == '') {
        cb ({'status': false, 'data': 'body is not returned by the API'});
    }
    // {data: { data: {} }}
    data = data.data;
    if (data == undefined || data == '') {
        cb ({'status': false, 'data': 'data is not returned by the API'});
    }

    // @Todo -> check for limited orders

    // sorting the data for useful properties
    let filtered = [];
    data.forEach(({adv, advertiser}) => {
        // { adv: {}, advertiser: {} }
        let d = {
            'name': advertiser.nickName,
            'rating': (Number(advertiser.monthFinishRate)*100).toFixed(2),
            'price': adv.price,
            'min_limit_base': adv.minSingleTransAmount, 'max_limit_base': adv.maxSingleTransAmount,
            'min_limit_asset': adv.minSingleTransQuantity, 'max_limit_asset': adv.maxSingleTransQuantity,
            'payment_methods': adv.tradeMethods.map(t => t.payType),
            'nice_text': "" 
        }
        d.nice_text = `${d.name} (${d.rating}%) selling ${ASSET_UNIT} for ${fb(d.price)} limit ${fb(d.min_limit_base)} - ${fb(d.max_limit_base)} (${fa(d.min_limit_asset)} - ${fa(d.max_limit_asset)})`;
        filtered.push(d);
    });

    cb({'status': true, 'data': filtered});
}

axios.defaults.timeout = 5000;

axios.post(BINANCE_P2P_API, REQUEST_BODY).then((r) => process_p2p(r, ({status, data}) => {
    
    if (status) {

        console.log(data);

    } else {
        console.log(`Error Message: ${data}`);
    }

})).catch(handle_error);
