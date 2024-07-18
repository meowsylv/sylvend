const stream = require("stream");
const util = require("util");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const streamPipeline = util.promisify(stream.pipeline);
const Logger = require("./logging");
const logger = new Logger("proxy");

async function proxy(res, url, errorManager, peopleManager) {
    logger.log(`Proxying ${url}...`);
    let rs;
    try {
        rs = await fetch(url);
    }   
    catch(err) {
        logger.log(`Request failed (${err.message}).`);
        res.status(502).send(errorManager.getErrorPage(502, peopleManager, `Failed to load <a href="${url}">page</a>. <code>${err.name}: ${err.message}</code>`));
        return;
    }
    logger.log(`${rs.status} ${rs.statusText} (Content-Length: ${rs.headers.get("Content-Length")})`);
    if(!rs.ok) {
        res.status(rs.status).send(errorManager.getErrorPage(rs.status, peopleManager, `This error page was shown because the proxied server returned a ${rs.status} ${rs.statusText} status code. Here's the <a href="${rs.url}">actual page.</a>`));
        return;
    }
    logger.log("Sending data...");
    res.contentType(rs.headers.get("Content-Type"));
    let readableStream = rs.body;
    try {
        await streamPipeline(readableStream, res);
        logger.log("Success.");
    }
    catch(err) {
        logger.log(`Failed to stream data (${err.message})`);
        //trust me this lil try-catch statement is WAYYY more important than you think.
    }
}

module.exports = proxy;
logger.ready();
