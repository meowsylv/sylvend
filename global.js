const package = require("./package.json")
const Logger = require("./logging");
const logger = new Logger("global");

function global(req, res, next) {
    res.set("X-Powered-By", `${package.name} v${package.version}, Node.js ${process.version}`);
    logger.log(`${req.method} ${req.url} from ${req.ip} (${req.get("user-agent")})`);
    next();
}

module.exports = global;
logger.ready();
