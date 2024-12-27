const express = require("express");
const crypto = require("crypto");
const path = require("path");
const mysql = require("mysql");
const templates = require("./templates");
const proxy = require("./proxy");
const fs = require("fs");
const Logger = require("./logging");
const logger = new Logger("blog");
const package = require("./package.json");
let urlCharacters = "abcdefghijklmnopqrstuvwxyz-";
let configManager;

function formatContent(thumb, content) {
    return `<img src="${thumb}" />${content}`;
}
function urlify(date, name, includeRoot = true) {
    let root = includeRoot ? configManager.config.blog.root : "";
    return `${root}${root.endsWith("/") ? "" : "/"}blog/${date.getUTCFullYear()}/${zero(date.getUTCMonth() + 1)}/${Array.from(name.toLowerCase().replaceAll(" ", "-")).filter(c => urlCharacters.includes(c)).join("")}`;
    return ;
}

function parseRSS(data, host) {
    let post = { ...data };
    post.pubDate = new Date(post.published * 1000).toUTCString();
    post.guid = post.uuid;
    post.author = configManager.secret.users.find(u => u.username === post.author).atom.name;
    let publicationDate = new Date(post.published * 1000);
    post.link = urlify(publicationDate, post.title);
    post.description = `<![CDATA[${formatContent(post.thumb, post.content)}]]>`;
    delete post.content;
    delete post.updated;
    delete post.published;
    delete post.uuid;
    delete post.thumb;
    delete post.contributors;
    return { item: post };
}
function parseAtom(data, host) {
    let post = { ...data };
    post.updated = new Date(post.updated * 1000).toISOString();
    post.author = configManager.secret.users.find(u => u.username === post.author).atom;
    let publicationDate = new Date(post.published * 1000);
    post.link = {
        params: {
            href: urlify(publicationDate, post.title),
            rel: "alternate",
            type: "text/html"
        },
        value: null
    };
    post.id = post.link.params.href;
    post.published = new Date(post.published * 1000).toISOString();
    post.summary = `<![CDATA[${formatContent(post.thumb, post.content)}]]>`;
    /*post.content = {
        params: {
            type: "xhtml",
        },
        value: {
            div: {
                params: {
                    xmlns: "http://www.w3.org/1999/xhtml",
                },
                value: formatContent(post.thumb, post.content)
            }
        }
    };*/
    post.contributor = post.contributors;
    delete post.uuid;
    delete post.contributors;
    delete post.thumb;
    delete post.content;
    return { entry: post };
}
function parsePost(data, host) {
    let post = { ...data };
    post.published *= 1000;
    post.updated *= 1000;
    post.author = configManager.secret.users.find(u => u.username === post.author).atom.name;
    let publicationDate = new Date(post.published);
    post.relLink = urlify(publicationDate, post.title, false);
    post.link = urlify(publicationDate, post.title);
    return post;
}
function loadPage(filename) {
    return fs.readFileSync(path.join(configManager.config.blog.path, filename)).toString();
}

function blog(client, templateManager, cfg, peopleManager, errorManager, databaseManager) {
    configManager = cfg;
    
    if(!configManager.config.blog.atom) {
        configManager.config.blog.atom = {};
        logger.log("Atom config initialized.");
        configManager.update();
    }
    if(!configManager.config.blog.atom.id) {
        configManager.config.blog.atom.id = `urn:uuid:${crypto.randomUUID()}`;
        logger.log("Atom UUID initialized.");
        configManager.update();
    }
    
    const router = express.Router();
    router.get("/pfps/:filename", async (req, res, next) => {
        if(!req.params?.filename) {
            res.status(404).send(errorManager.getErrorPage(404, peopleManager));
            return;
        }
        let [ uuid ] = req.params.filename.toString().split(".");
        try {
            let results = await databaseManager.select("comments", { uuid }, ["author_id"]);
            if(results.length === 0) {
                next();
                return;
            }
            let id = results[0].author_id;
            let author = client.users.cache.get(id) || await client.users.fetch(id);
            await proxy(res, author.avatarURL({ size: 128 }), errorManager, peopleManager);
        }
        catch(err) {
            logger.log(err);
            res.status(500).send(errorManager.getErrorPage(500, peopleManager));
        }
    });
    router.get("/rss.xml", async (req, res) => {
        try {
            let results = await databaseManager.select("posts"); 
            let feedData = { ...configManager.config.blog.feed };
            feedData.generator = `${package.name} v${package.version}`;
            feedData.lastBuildDate = new Date().toUTCString();
            res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
${toXML(feedData)}
${results.map(p => toXML(parseRSS(p))).join("\n")}
</channel>
</rss>`);
        }
        catch(err) {
            logger.log(err);
            res.status(500).send(errorManager.getErrorPage(500, peopleManager));
        }
    });
    router.get("/atom.xml", async (req, res) => {
        try {
            let results = await databaseManager.select("posts");
            let feedData = { ...configManager.config.blog.feed, ...configManager.config.blog.atom };
            if(feedData.author) feedData.author = configManager.secret.users.find(u => u.username === feedData.author).atom;
            if(feedData.link) {
                feedData.link = {
                    params: {
                        rel: "self",
                        type: "application/atom+xml",
                        href: feedData.link + (feedData.link.endsWith("/") ? "" : "/") + "atom.xml"
                    },
                    value: null
                };
                feedData.id = feedData.link.params.href;
            }
            feedData.updated = new Date(Math.max(...results.map(r => r.updated)) * 1000).toISOString();
            feedData.generator = {
                params: {
                    uri: package.homepage,
                    version: package.version
                },
                value: package.name
            };
            feedData.subtitle = feedData.description;
            delete feedData.description;
            delete feedData.uuid;
            res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="https://www.w3.org/2005/Atom" xml:lang="en">
${toXML(feedData)}
${results.map(p => toXML(parseAtom(p))).join("\n")}
</feed>`);
        }
        catch(err) {
            logger.log(err);
            res.status(500).send(errorManager.getErrorPage(500, peopleManager));
        }
    });
    router.get("/:year/:month/:title", async (req, res, next) => {
        let { year, month } = req.params;
        try {
            let results = await databaseManager.select("posts");
            let post = results.find(p => {
                let date = new Date(p.published * 1000);
                return urlify(date, p.title) === urlify(new Date(year, month - 1, 1), req.params.title);
            });
            if(!post) {
                next();
                return;
            }
            res.send(templates.getPage(replaceKeys(loadPage("post.html"), parsePost(post, req.get("host"))), templateManager.template, peopleManager, configManager, req));
        }
        catch(err) {
            logger.log(err);
            res.status(500).send(errorManager.getErrorPage(500, peopleManager));
        }
    });
    router.get("/", async (req, res) => {
        let page = loadPage("index.html");
        let item = loadPage("item.html");
        let feed = "";
        try {
            let results = (await databaseManager.select("posts")).sort((a, b) => b.published - a.published);
            for(let data of results) {
                feed += replaceKeys(item, parsePost(data, req.get("host")));
            }
            
            page = page.replace(/\{feed\}/g, feed);
        
            res.send(templates.getPage(page, templateManager.template, peopleManager, configManager, req));
        }
        catch(err) {
            logger.log(err);
            res.status(500).send(errorManager.getErrorPage(500, peopleManager));
        }
    });
    return router;
}

function toXML(obj) {
    let keys = Object.keys(obj).filter(k => obj[k]);
    return keys.map(k => {
        let v = obj[k];
        if(Array.isArray(v)) {
            let val = [];
            for(let i = 0; i < v.length; i++) {
                let o = {};
                o[k] = v[i];
                val.push(toXML(o));
            }
            return val.join("\n");
        }
        let params = [];
        let vk = Object.keys(v);
        let pks = [];
        if(vk.length === 2 && vk.includes("value") && vk.includes("params")) {
            params = v.params;
            pks = Object.keys(params);
            v = v.value;
        }
        return `<${k}${pks.length > 0 ? ` ${pks.map(pk => `${pk}="${params[pk]}"`).join(" ")}` : ""}${!(v?.toString()) ? " /" : `>${typeof v === "object" ? `\n${toXML(v)}\n` : v}</${k}`}>`
    }).join("\n");
}

function replaceKeys(page, obj) {
    let keys = Object.keys(obj);
    let output = page;
    for(let key of keys) {
        output = output.replaceAll(`{${key}}`, obj[key]);
    }
    return output;
}

function zero(n, c = 2) {
    let str = n.toString();
    return `${"0".repeat(2 - str.length)}${str}`;
}

module.exports = blog;
logger.ready();
