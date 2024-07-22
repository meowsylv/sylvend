const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { STATUS_CODES } = require("http");
const templates = require("./templates");
const Logger = require("./logging");
const logger = new Logger("errors");

/*router.get("/:code", (req, res) => {
    if(isNaN(parseInt(req.params.code))) {
        res.status(404).send("that's not even a number");
        return;
    }
    else if(!STATUS_CODES[req.params.code]) {
        res.status(404).send("that's not a status code i know of");
        return;
    }
    res.send(errorTemplate.replace(/\{code\}/g, req.params.code).replace(/\{message\}/g, STATUS_CODES[req.params.code]).replace(/{flavortext}/g, config.errors[req.params.code] || config.fallbackError));
});*/
class ErrorManager {
    constructor(configManager, templateManager) {
        this.templateManager = templateManager;
        this.configManager = configManager;
    }
    generateErrorPages() {
        logger.log(`Creating error pages...`);
        let codes = Object.keys(this.configManager.config.errors);
        for(let code of codes) {
            fs.writeFileSync(path.join(this.configManager.config.errorPath, `${code}.html`), this.getErrorPage(code));
            logger.log(`HTTP ${code} error page created.`);
        }
    }
    
    getErrorPage(code, peopleManager, extraInfo = "") {
        let errorTemplate = fs.readFileSync(this.configManager.config.errorTemplatePath).toString();
        let errorPage = templates.getPage(errorTemplate, this.templateManager.template, peopleManager, this.configManager);
        return errorPage.replace(/\{code\}/g, code).replace(/\{message\}/g, STATUS_CODES[code]).replace(/\{flavortext\}/g, this.configManager.config.errors[code]).replace(/\{extrainfo\}/g, extraInfo ? `${extraInfo}` : "");
    }
    
    getMiddleware(code, peopleManager) {
        return (req, res, next) => res.status(code).type("text/html").send(this.getErrorPage(code, peopleManager));
    }
}

module.exports = { ErrorManager };
logger.ready();
