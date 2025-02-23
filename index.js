const child_process = require("child_process");
const package = require("./package.json");
let sylvend;
let newLine = true;
let outage = process.argv.includes("--outage");

start();

function handleError(code) {
    let handler = "crash handler";
    log(`${package.name} has crashed!
Node.js quit with a non-zero code. A log file has been generated containing the error stack trace. Aborting...\n`, handler, true);
    process.exit(code);
}

function start() {
    log(`Starting ${package.name}${outage ? " in outage mode" : ""}...\n`);
    sylvend = child_process.fork(outage ? "outage.js" : "sylvend.js", process.argv.slice(2), {
        silent: true
    });
    sylvend.on("close", code => {
        if(code !== 0) handleError(code);
    });
    sylvend.stdout.on("data", chunk => {
        let date = new Date();
        log(chunk, `${package.name}${outage ? " (outage)" : ""}`);
    });
    
    sylvend.stderr.on("data", chunk => {
        let date = new Date();
        log(chunk, `${package.name}${outage ? " (outage)" : ""}`, true);
    });
    
    sylvend.on("message", message => {
        switch(message) {
            case "restart" :
                log(`Restart request received.\n`);
                start();
            break;
        }
    });
}

function log(data, from, error) {
    let date = new Date();
    let split = data.toString().split("\n");
    split.forEach((d, i) => {
        if(isBlank(d) && i === split.length - 1 && split.length !== 1) {
            return;
        }
        process[error ? "stderr" : "stdout"].write(`${newLine ? `[${zero(date.getDate(), 2)}/${zero(date.getMonth() + 1, 2)}/${date.getFullYear()} ${zero(date.getHours(), 2)}:${zero(date.getMinutes(), 2)}:${zero(date.getSeconds(), 2)}.${zero(date.getMilliseconds(), 3)}] [${from || "main"}] ${d}` : d }${i === split.length - 1 ? "" : "\n"}`);
        newLine = true;
    });
    newLine = !split[split.length - 1];
}

function isBlank(data) {
    return ["\r", ""].includes(data);
}

function zero(n, c) {
    let s = n.toString();
    return "0".repeat(c - s.length) + s;
}
