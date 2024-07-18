const util = require("util");
let tabLength = 15;

class Logger {
    constructor(name) {
        this.name = name;
    }
    log(...data) {
        let str = data.map(d => {
            if(typeof d === "string") {
                return d;
            }
            else {
                return util.inspect(d);
            }
        }).join(" ");
        let split = str.split("\n");
        split.forEach((s, i) => {
            if(!s && i === split.length - 1) return;
            process.stdout.write(tab(`[${this.name}]`) + ": ");
            console.log(`${s}`);
        });
    }
    ready() {
        this.log("Ready.");
    }
}

function tab(txt) {
    return txt + " ".repeat(txt.length > tabLength ? 0 : (tabLength - txt.length));
}

module.exports = Logger;
