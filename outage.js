const fs = require("fs");
let key = getParam("--key-file");
let cert = getParam("--cert-file");
let port = parseInt(getParam("--port"));
let redirect = getParam("--redirect");
let enableHttps = process.argv.includes("--https");
let httpRedirect = getParam("--http-redirect");
const https = enableHttps ? require("https") : require("http");
const http = require("http");
const package = require("./package.json");
let options = {};

if(enableHttps) console.log(`HTTPS enabled.`);
if(httpRedirect) console.log(`HTTP redirect: ${httpRedirect}`);

if(enableHttps) {
    options.key = fs.readFileSync(key);
    options.cert = fs.readFileSync(cert);
}

if(httpRedirect) {
    let redirectServer = http.createServer((req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Location", httpRedirect);
        res.setHeader("X-Powered-By", "sylvend outage module");
        res.writeHead(301);
        res.write("Redirecting...");
        res.end();
    });
    redirectServer.listen(80, () => console.log("Redirect server started."));
}

const server = https.createServer(options, (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Powered-By", "sylvend outage module");
    res.writeHead(503);
    res.write(fs.readFileSync("/usr/share/sylvend/outage.html").toString().replace(/\{reason\}/g, `${getParam("--reason")}` || "").replace(/\{name\}/g, package.name).replace(/\{version\}/g, package.version));
    res.end();
});

server.listen(port, () => console.log("Server started."));

function getParam(name) {
    let index = process.argv.indexOf(name);
    if(index === -1) return;
    return process.argv[index + 1];
}
