const crypto = require("crypto");
const Logger = require("./logging");
const logger = new Logger("auth");
const { getErrorPage } = require("./errors");

function auth(configManager, errorPage) {
    let { config, secret } = configManager;
    return (req, res, next) => {
        logger.log(`Authorization attempt from ${req.ip}`);
        let authHeader = req.get("Authorization");
        if(!authHeader || !authHeader.startsWith("Basic ")) {
            logger.log(`Authorization header missing. Rejecting...`);
            rejectAuth(res, errorPage, config);
            return;
        }
        
        let authData = authHeader.replace(/^Basic /, "");
        
        
        if(!isAuthData(authData)) {
            logger.log(`Invalid plaintext auth data. Base64 decoding...`);
            authData = Buffer.from(authData, "base64").toString();
            if(!isAuthData(authData)) {
                logger.log("Invalid base64 auth data. Rejecting...");
                rejectAuth(res, errorPage, config);
                return;
            }
        }
        
        let [ username, password ] = authData.split(":");
        
        logger.log(`Successfully decoded credentials (${username}, ${"*".repeat(password.length)}).`);
        
        if(!secret.users.find(u => u.username === username && u.password === crypto.createHash("sha256").update(password).digest().toString("base64"))) {
            logger.log(`Incorrect login. Rejecting...`);
            rejectAuth(res, errorPage, config);
            return;
        }
        logger.log(`Authorization successful. Access granted.`);
        next();
    };
}

function isAuthData(data) {
    return data.split(":").length === 2;
}

function rejectAuth(res, errorPage, config) {
    res.status(401).set("WWW-Authenticate", `Basic realm="${config.authRealm}", charset="UTF-8"`).send(errorPage);
}

module.exports = auth;
logger.ready();
