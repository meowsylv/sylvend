const express = require("express");
const path = require("path");
const Logger = require("./logging");
const logger = new Logger("management");

function management(configManager, templateManager) {
    let live = templateManager.serve(path.join(configManager.config.htmlPath, "management"));
    let static = express.static(configManager.config.managementPath);
    return (req, res, next) => {
        live(req, res, () => {
            static(req, res, next);
        });
    }
}

module.exports = management;
logger.ready();
