const express = require("express");
const { WebhookClient, Client, Events, GatewayIntentBits, Embed, EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const basicAuth = require("./basicAuth");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
const querystring = require("querystring");
const EMBED_FIELD_MAX = 4096;
const Logger = require("./logging");
const logger = new Logger("api");
let channelTypes = ["suggestion", "bugreport"]
let typeNames = {
    "suggestion": "suggestion",
    "bugreport": "bug report"
};
let restartKeys = [];
let restartTimeout = 10 * 60 * 1000;
let keyBase = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
let keyLength = 32;



module.exports = (configManager, peopleManager, client) => {
    const router = express.Router();
    router.use(express.json());
    let webhooks;
    
    router.get("/util/ip", (req, res) => {
        res.json({ ip: req.ip });
    });
    
    router.get("/management/restart", (req, res) => {
        let key = "";
        for(let i = 0; i < keyLength; i++) {
            key += keyBase.charAt(Math.floor(Math.random() * keyLength));
        }
        restartKeys.push(key);
        setTimeout(() => restartKeys.slice(restartKeys.indexOf(key), 1), restartTimeout);
        res.json({ key, timeout: restartTimeout });
    });

    router.post("/management/restart/confirm", (req, res) => {
        if(!req.body?.key) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Missing parameters." });
            return;
        }
        if(restartKeys.includes(req.body.key)) {
            logger.log("Restart requested. Aborting...");
            res.status(204).end();
            process.send("restart");
            process.exit(0);
        }
        else {
            res.status(401).json({ errorCode: 40101, errorMessage: "No such key." });
        }
    });
    
    router.get("/ping", (req, res) => {
        res.json("pong.");
    });
    
    router.put("/management/people/:name", (req, res) => {
        if(!req.body?.id || !req.params.name) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Missing parameters." });
            return;
        }
        
        configManager.config.people[req.params.name] = req.body.id;
        configManager.update();
        res.status(204).end();
    });
    
    router.put("/management/quotes/:name", (req, res) => {
        if(!req.body?.quote) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Missing parameters." });
            return;
        }
        if(!configManager.config.people[req.params.name]) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Unknown user." });
            return;
        }
        
        let quoteIndex = configManager.config.quotes.findIndex(q => q.author === req.params.name);
        if(quoteIndex === -1) {
            configManager.config.quotes.push({ quote: req.body.quote, author: req.params.name });
        }
        else {
            configManager.config.quotes[quoteIndex].quote = req.body.quote;
        }
        configManager.update();
        res.status(204).end();
    });
    
    router.delete("/management/people/:name", (req, res) => {
        if(!configManager.config.people[req.params.name]) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Unknown user." });
            return;
        }
        delete configManager.config.people[req.params.name];
        configManager.update();
        res.status(204).end();
    });
    
    /*router.get("/management/people/reload", async (req, res) => {
        logger.log("User cache reload requested.");
        let keys = Object.keys(configManager.config.people);
        for(let person of keys) {
            let user = await client.users.fetch(configManager.config.people[person]);
            logger.log(`Successfully reloaded ${person}'s user data. (${user.globalName || user.username}, ${user.avatarURL()})`);
        }
        res.status(204).end();
    });*/
    
    router.get("/management/people", (req, res) => {
        res.json(configManager.config.people);
    });
    
    router.get("/management/stats", (req, res) => {
        let lsb = child_process.execSync("lsb_release -d").toString().replace(/^Description\:/, "").trim();
        let uptime = child_process.execSync("uptime").toString().trim();
        res.json({ lsb, uptime });
    });

    router.delete("/management/quotes/:author", (req, res) => {
        let quoteIndex = configManager.config.quotes.findIndex(q => req.params.author === q.author);
        if(quoteIndex === -1) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Unknown quote." });
            return;
        }
        
        configManager.config.quotes.splice(quoteIndex, 1);
        configManager.update();
        res.status(204).end();
    });
    
    router.get("/cow", (req, res) => {
        child_process.exec("fortune | cowsay", (error, stdout, stderr) => {
            if(error) {
                res.status(500).json({ errorCode: "50000", errorMessage: "Failed to run command." });
                return;
            }
            res.json({ data: stdout });
        });
    });

    router.post("/revoke", async (req, res) => {
        let response = await fetch("https://discord.com/api/v10/oauth2/token/revoke", {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": basicAuth(configManager.config.client_id, configManager.config.client_secret)
            },
            method: "post",
            body: querystring.encode({
                token: req.body.token,
                token_type_hint: "access_token"
            })
        });
        res.status(response.status).json(await response.json());
    });
    router.get("/quotes", (req, res) => {
        let quotes = [];
        for(let quote of configManager.config.quotes) {
            let author = peopleManager.get(quote.author);
            if(!author) {
                res.status(500).json({ errorCode: 50000, errorMessage: "Internal Server Error" });
                return;
            }
            quotes.push({
                quote: quote.quote,
                authorName: author.name,
                authorAvatar: `/pfps/${quote.author}.webp`,
                author: quote.author
            });
        }
        res.json(quotes);
    });

    router.post("/lgbtq/search", async (req, res) => {
        //the kys list :3
        let blockedTerms = ["minor", "zoo", "zoosexual", "zoophile", "map", "pedophile"];
        let query = req.body?.query?.trim();
        if(!query) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Missing parameters." });
            return;
        }
        let r = await fetch(`https://en.pronouns.page/api/terms/search/${encodeURIComponent(query.toString())}`);
        if(!r.ok) {
            res.status(500).json({ errorCode: 50001, errorMessage: "pronouns.page request unsuccessful." });
            return;
        }
        for(let t of blockedTerms) {
            if(query.includes(t)) {
                res.status(400).json({ errorCode: 40099, errorMessage: "Kill yourself." });
                return;
            }
        }
        let results = (await r.json()).filter(d => d.locale === "en").map(data => {
            let out = {};
            out.names = data.term.split("|");
            
            let flags = data.flags.replace(/^\[/, "").replace(/\]$/, "").split(",");
            if(flags.length === 1 && flags[0].length === 0) flags = [];
            flags = flags.map(f => `/lgbtq/flags/${f.replace(/^\"/, "").replace(/\"$/, "")}.png`);
            /}`/ //This is literally just here so vim doesn't go crazy
            
            let images = (data.images ? data.images.split(",").map(i => `/lgbtq/images/${i}-flag.png`) : []);
            
            out.images = flags.concat(images);
            
            //If it's an exact match, bump it up!
            if(out.names.map(n => n.toLowerCase()).includes(query.toLowerCase())) {
                out.order = -1;
            }
            else {
                out.order = 0;
            }
            return out;
        }).filter(d => d.images.length > 0).sort((a, b) => a.order - b.order);
        results.forEach(d => {
            delete d.order;
        });
        res.json(results);
    });
    
    router.post("/suggestions", async (req, res) => {
        if(!req.body?.message || !req.body?.type) {
            res.status(400).json({ errorCode: 40000, errorMessage: "Missing parameters." });
            res.cancelRateLimit();
            return;
        }
        
        if(!webhooks) loadWebhooks();
        if(!channelTypes.includes(req.body.type)) {
            res.status(400).json({
                errorCode: 40001,
                errorMessage: "Invalid Message Type."
            });
            res.cancelRateLimit();
            return;
        }
        if(req.body.message.toString().length >= EMBED_FIELD_MAX) {
            res.status(400).json({
                errorCode: 40002,
                errorMessage: `Message length goes above limit (${EMBED_FIELD_MAX}) so yeah FUCK YOU PLAYFULL >:3`
            });
            res.cancelRateLimit();
            return;
        }
        let embed = EmbedBuilder.from(new Embed({
            title: `New ${typeNames[req.body.type]}`,
            description: `_"${req.body.message}"_`,
            fields: [
                {
                    "name": "Status",
                    "value": "-"
                }
            ]
        }));
        if(req.body.access_token) {
            let userReq = await fetch("https://discord.com/api/v10/users/@me", {
                headers: {
                    "Authorization": `Bearer ${req.body.access_token}`
                }
            });
            if(userReq.ok) {
                let user = await userReq.json();
                embed.setAuthor({
                    name: `${user.global_name} (${user.username}#${user.discriminator}, ${user.id})`,
                    iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp`
                });
            }
        }
        await webhooks[req.body.type].send({ embeds: [embed] });
        res.status(204).end();
    });
    
    router.use((req, res, next) => { return res.status(404).json({ errorCode: 40400, errorMessage: "Not Found." }) })
    
    function loadWebhooks() {
        webhooks = {};
        for(let key of channelTypes) {
            webhooks[key] = new WebhookClient({ url: configManager.secret.webhooks[key] });
        }
    }
    return router;
};
logger.ready();
