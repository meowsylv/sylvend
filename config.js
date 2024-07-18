const fs = require("fs");
const path = require("path");
const Logger = require("./logging");
const logger = new Logger("config");

class ConfigManager {
    constructor({ config, secret }) {
        this.configFilename = toModulePath(config);
        this.secretFilename = toModulePath(secret);
        this.reload();
        logger.log(`ConfigManager ready (${this.configFilename}, ${this.secretFilename}).`);
    }
    reload() {
        this.config = require(this.configFilename);
        this.secret = require(this.secretFilename);
        logger.log("config reloaded.");
    }
    update() {
        jsonUpdate(this.configFilename, this.config);
        jsonUpdate(this.secretFilename, this.secret);
        logger.log("config updated.");
    }
}

function jsonUpdate(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4));
}

function toModulePath(filename) {
    return filename.startsWith("/") ? filename : path.join(__dirname, filename);
}

module.exports = ConfigManager;
logger.ready();
