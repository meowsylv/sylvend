/*sylvend - A custom JS website backend made specifically for meow.sylv.cat

Copyright 2024 Kamil Alejandro

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

const Logger = require("./logging");
const logger = new Logger("main");
const fs = require("fs");
const package = require("./package.json");
const os = require("os");
const path = require("path");

process.on("uncaughtExceptionMonitor", (err, origin) => {
    logger.log("Uncaught exception. Creating log file...");
    let crashCauses = {
        "uncaughtException": `${package.name} encountered an error it did not handle.`,
        "unhandledRejection": `A Promise object rejected with an error, and ${package.name} did not handle it.`
    };
    let messages = [
        "i guess piwate can't make his pfps anymore",
        "well i hope i didn't push that into the main branch",
        "buggy ass web server, 0/10 would not recommend",
        "there's a 50% chance this was caused because I said to myself: \"why wouldn't it work\" and proceeded to push untested code into the main branch",
        "it's quite the 502 bad gateway evening isn't it",
        "this log file was likely created 2 hours ago and you just realized, shame on you.",
        "this really puts the \"end\" in sylvend doesn't it"
    ];
    let date = new Date();
    let data = `${package.name} v${package.version} crash log

Node.js version: ${process.version}
Date: ${date.toString()}
Cause: ${origin} (${crashCauses[origin]})
Stack trace:

${err.stack}

"${messages[Math.floor(Math.random() * messages.length)]}"

- potato
`;
    fs.writeFileSync(path.join(os.homedir(), `${package.name}-crash-${[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(d => zero(d, 2)).join("-")}.log`), data);
    logger.log("Done. Aborting...");
});

const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const api = require("./api");
const rateLimits = require("./rate-limits.js");
const { SylvendClient, deployCommands } = require("./discord.js");
const util = require("util");
const stream = require("stream");
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath);
const streamPipeline = util.promisify(stream.pipeline);
const discordAuth = require("./discord-auth");
const errors = require("./errors");
const auth = require("./auth");
const templates = require("./templates");
const global = require("./global");
const management = require("./management");
const ConfigManager = require("./config");
let template;
const PeopleManager = require("./people");
const DatabaseManager = require("./database");
const configManager = new ConfigManager({
    config: "/etc/sylvend/config.json",
    secret: "/etc/sylvend/secret.json"
});
const client = new SylvendClient(configManager);
const peopleManager = new PeopleManager(configManager.config.people, client);
const templateManager = new templates.TemplateManager(peopleManager, configManager);
const errorManager = new errors.ErrorManager(configManager, templateManager);
const databaseManager = new DatabaseManager(configManager.secret.blog);
const proxy = require("./proxy");
const blog = require("./blog");

templateManager.errorManager = errorManager;

app.enable("trust proxy");

let argIndex;

if((argIndex = process.argv.indexOf("--deploy-commands")) !== -1) {
    client.once("ready", () => deployCommands(client, process.argv[argIndex + 1]));
}

if(process.argv.includes("--wait-for-pplmgr")) {
    peopleManager.once("ready", init);
}
else {
    init();
}

function init() {
    try {
        setUpTemplate();
    }
    catch(err) {
        console.error(err);
        logger.log("Failed to load template. No files will be updated. Loading fallback...");
        setUpTemplate("fallback", false);
    }
    errorManager.generateErrorPages();
    app.use(cookieParser());
    app.use(global);
    app.use(rateLimits([
        { methods: ["POST"], path: "/api/suggestions", duration: 15 * 60 * 1000 }, //15 minutes.
        { methods: ["POST"], path: /^\/api\/blog\/.*\/comments/g, duration: 5 * 1000 } //5 seconds.
    ]));
    app.use("/api/management", auth(configManager, { errorCode: 40100, errorMessage: "Unauthorized." }, user => user.managementAPIAccess));
    app.use("/api", api(configManager, peopleManager, databaseManager, client));
    app.use("/auth", discordAuth(configManager));
    app.use("/blog", blog(client, templateManager, configManager, peopleManager, errorManager, databaseManager));
    app.use("/management", auth(configManager, errorManager.getErrorPage(401, peopleManager)));
    app.use("/management", management(configManager, templateManager));
    app.use("/.well-known", express.static(configManager.config.domainVerificationPath));
    
    app.get("/lgbtq/flags/:flag", async (req, res) => {
        await proxy(res, `https://en.pronouns.page/flags/${req.params.flag}`, errorManager, peopleManager);
    });
    
    app.get("/lgbtq/images/:image", async (req, res) => {
        await proxy(res, `https://dclu0bpcdglik.cloudfront.net/images/${req.params.image}`, errorManager, peopleManager);
    });
    
    if(configManager.config.tryToBrewCoffee) {
        app.get("/coffee", (req, res) => {
            res.status(418).send(errorManager.getErrorPage(418, peopleManager));
        });
    }

/*app.get("/pfps/:name", async (req, res) => {
    let id = configManager.config.people[`${req.params.name.replaceAll(".webp", "")}`];
    if(!id) {
        res.status(404).json({
            errorCode: 40400,
            errorMessage: "Not Found."
        });
        return;
    }
    let user = client.users.cache.get(id) || await client.users.fetch(id);
    await pipeData(res, user.avatarURL({ size: 512 }), "image/webp");
});*/
    
    app.use("/pfps", peopleManager.pfps({ size: 512 }, errorManager));
    app.use(templateManager.serve(configManager.config.htmlPath));
    app.use(errorManager.getMiddleware(404, peopleManager));
    app.listen(8001, () => logger.log("Server started!"));
}

function zero(n, c) {
    let length = c - n.toString().length;
    return `${"0".repeat(length < 0 ? 0 : length)}${n}`;
}

function setUpTemplate(templateName, save = true) {
    let t = templateName || configManager.config.template;
    template = new templates.Template(path.join(configManager.config.templatePath, t));
    let info = template.getInfo();
    logger.log(`Loading template ${t}...`);
    logger.log(`\n> Name: ${info.name}\n> Description: ${info.description}`);
    if(save) {
        logger.log(`Generating pages...`);
        templates.parseAndSave(template, configManager.config.htmlPath, configManager.config.webPath, configManager.config.managementPath, peopleManager, configManager);
    }
    templateManager.setTemplate(template);
}

