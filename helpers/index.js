const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs-extra')

const format_number = (num, sym) => { 
    return `${Number(num).toLocaleString()} ${sym}` 
}

const handle_request_error = (error) => { 
    let message = JSON.stringify({
        dt: Date.now(),
        error: (error.code !== undefined ? (`Error Code: ${error.code}`): (error.toJSON !== undefined ? error.toJSON().message : error.toString()))
    })+'\n';
    
    fs.outputFile('logs/errors.log', message, { flag: 'a' }, err => {
        if(err) { return }
    }); 
}

// text -> any string, width -> number of characters allowed in column
const column_str = (text, width) => {
    text = text.toString();
    if (text.length > width) {
        return text.slice(0, width-2)+'..';
    }
    let total_spaces = width-text.length;
    let spaces_left = spaces_right = total_spaces/2;
    if (total_spaces%2 !== 0) { spaces_left = Math.floor(total_spaces/2); spaces_right = Math.ceil(total_spaces/2); }
    
    return ' '.repeat(spaces_left)+text+' '.repeat(spaces_right);

}

// columns -> [], values -> [[],[]]

const config_last = {
    lines: 0
}

const print_table = (columns , values, alerts, {BASE_UNIT, ASSET_UNIT}) => {

    let tbl_width = 1;
    let column_refs = [];

    let tbl_header = '│';
    for (let column in columns) {
        tbl_width += columns[column].width+1;
        column_refs.push({ ref: columns[column].ref, width: columns[column].width });
        tbl_header += column_str(column, columns[column].width) + '│';
    }

    // header -> 3, footer -> 1, alert header -> 3, alert footer -> 1
    let lines = 4 + values.length + 4;

    let tbl_body = '';
    if (values.length === 0) {
        tbl_body += '│'+column_str("No listing is available", tbl_width-2)+'│\n';
    } else {

        values.forEach (d => {
            let row_str = '│';
            column_refs.forEach (column => {

                let str_data = d[column.ref];

                if (column.ref == 'min_limit_base' || column.ref == 'max_limit_base' || column.ref == 'price') { 
                    str_data = format_number(str_data, BASE_UNIT); 
                } else  
                if (column.ref == 'rating') { 
                    str_data = Math.round(str_data) + '%'; 
                } if (column.ref == 'name') {
                    str_data = str_data.replace(/[^\x00-\x7F]/g, "");
                }
                
                let col_str = column_str(str_data, column.width);
                
                if (column.ref == 'price') {
                    col_str = chalk.bold(col_str);
                }
                if (d.qualifies != undefined && d.qualifies) { 
                    col_str = chalk.green(col_str);
                }
                
                row_str += col_str+'│';
            })

            tbl_body += row_str+'\n';
        });

    }

    let str = draw_line (tbl_width, 'start');
    str += `${tbl_header}\n`;
    str += draw_line (tbl_width);
    str += `${tbl_body}`;
    str += draw_line (tbl_width, 'end');
    readline.moveCursor(process.stdout, 0, -config_last.lines);
    process.stdout.write(str);
    

    // last 3 alerts
    let alerts_tbl = draw_line (tbl_width, 'start');
    alerts_tbl += '│'+column_str('⏰ Last 3 Alerts', tbl_width-3)+'│\n';
    alerts_tbl += draw_line (tbl_width);
    if (alerts.length === 0) {
        lines += 1;
        alerts_tbl += '│'+column_str("No alert is invoked yet.", tbl_width-2)+'│\n';
    } else {
        let max = alerts.length;
        if (max > 3) { max = 3; }
        lines += max;
        for (let i = 0; i < max; i++) {
            alerts_tbl += '│'+column_str(alerts[i].nice_text, tbl_width-2)+'│\n';
        }
    }
    alerts_tbl += draw_line (tbl_width, 'end');

    if (config_last.lines > lines) {

        let lines_diff = config_last.lines - lines;
        for (let i = 0; i < lines_diff; i++) {
            alerts_tbl += ' '.repeat(tbl_width) + '\n';
        }
        
    } else {
        config_last.lines = lines;
    }

    process.stdout.write(alerts_tbl);

}

const reset_table_lines = () => {
    config_last.lines = 0;
}

const draw_line = (width, type = 'mid') => {
    let line = '├' + '─'.repeat(width-2) + '┤\n';
    if (type === 'start') {
        line = '┌' + '─'.repeat(width-2) + '┐\n';
    } else if (type === 'end') {
        line = '└' + '─'.repeat(width-2) + '┘\n';
    }
    return line;
}

const l = console.log;

const clear_screen = () => {
    const blank = '\n'.repeat(process.stdout.rows);
    l(blank);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
}

module.exports = { chalk, format_number, handle_request_error, l, print_table, clear_screen, reset_table_lines }
