const express = require("express");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const querystring = require("querystring");
const basicAuth = require("./basicAuth.js");
const Logger = require("./logging");
const logger = new Logger("discord-auth");
const package = require("./package.json");

function discordAuth(configManager) {
    const router = express.Router();
    let { config, secret } = configManager;
    router.get("/link", (req, res) => {
        res.status(301).location(`https://discord.com/oauth2/authorize?client_id=${secret.client_id}&response_type=code&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=identify`).end();
    });
    
    router.get("/callback", async (req, res) => {
        if(req.query.code) {
            let credentials = await (await fetch("https://discord.com/api/v10/oauth2/token", {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": basicAuth(secret.client_id, secret.client_secret)
                },
                method: "post",
                body: querystring.encode({
                    grant_type: "authorization_code",
                    code: req.query.code,
                    redirect_uri: config.redirect_uri
                })
            })).json();
            res.cookie("access_token", credentials.access_token);
            res.type("text/html").send(`<!DOCTYPE html>
<html>
<head>
    <title>${package.name} Discord auth callback page</title>
</head>
<body>
    <h1>Authentication successful.</h1>
    <script>opener.postMessage("auth"); window.close();</script>
</body>
</html>`);
        }
        else {
            res.send("Failed.");
        }
    });
    return router;
}



module.exports = discordAuth;
logger.ready();
