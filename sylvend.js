/*sylvend - A custom JS website backend made specifically for www.papaproductions.cc

Copyright 2024 Kamil Alejandro

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const api = require("./api");
const rateLimits = require("./rate-limits.js");
const { Client, Collection, Events, GatewayIntentBits, Options } = require('discord.js');
const util = require("util");
const stream = require("stream");
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath);
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds],
});
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
const configManager = new ConfigManager({
    config: "/etc/sylvend/config.json",
    secret: "/etc/sylvend/secret.json"
});
const peopleManager = new PeopleManager(configManager.config.people, client);
const templateManager = new templates.TemplateManager(peopleManager, configManager);
const errorManager = new errors.ErrorManager(configManager, templateManager);
const Logger = require("./logging");
const logger = new Logger("main");
const proxy = require("./proxy");
client.commands = new Collection();

templateManager.errorManager = errorManager;

client.once(Events.ClientReady, readyClient => {
	logger.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(configManager.secret.token);

//just realized how this still goes unused. whatever.
for(let commandName of commandFiles) {
    let command = require(path.join(commandsPath, commandName));
    client.commands.set(command.data.name, command);
}


app.enable("trust proxy");

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
    app.use(global);
    app.use(rateLimits([
        { methods: ["POST"], path: "/api/suggestions", duration: 15 * 60 * 1000 } //15 minutes.
    ]));
    app.use("/api/management", auth(configManager, { errorCode: 40100, errorMessage: "Unauthorized." }, user => user.managementAPIAccess));
    app.use("/api", api(configManager, peopleManager, client));
    app.use("/auth", discordAuth(configManager));
    app.use("/management", auth(configManager, errorManager.getErrorPage(401, peopleManager)));
    app.use("/management", management(configManager, templateManager));
    
    app.get("/lgbtq/flags/:flag", async (req, res) => {
        await proxy(res, `https://en.pronouns.page/flags/${req.params.flag}`);
    });
    
    app.get("/lgbtq/images/:image", async (req, res) => {
        await proxy(res, `https://dclu0bpcdglik.cloudfront.net/images/${req.params.image}`);
    });

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

app.listen(8001, () => logger.log("Server started!"));
