const chalk = require('chalk');

const format_number = (num, sym) => { 
    return `${Number(num).toLocaleString()} ${sym}` 
}

const handle_request_error = (error) => { 
    l((error.code !== undefined ? (`Error Code: ${error.code}`): (error.toJSON !== undefined ? error.toJSON().message : error.toString()))); 
}

const l = console.log;

module.exports = { format_number, handle_request_error, l, chalk }
