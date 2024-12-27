const Logger = require("./logging");
const logger = new Logger("discord");
const path = require("path");
const fs = require("fs");
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require("discord.js");
const commandPath = path.join(__dirname, "commands");

class SylvendClient extends Client {
    constructor(configManager) {
        super({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent ] });
        this.commands = new Collection();
        this.configManager = configManager;
        let commands = fs.readdirSync(commandPath);
        for(let commandName of commands) {
            const command = require(path.join(commandPath, commandName));
            if ('data' in command && 'execute' in command) {
			    this.commands.set(command.data.name, command);
		    }
            else {
		        logger.log(`Invalid command module '${commandName}'. Ignoring...`);
            }
        }
        this.on(Events.InteractionCreate, async interaction => {
            if(interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
                let command = this.commands.get(interaction.commandName);
                if(!command) return;
                try {
                    await command.execute(interaction, configManager);
                }
                catch(err) {
                    await interaction[(interaction.deferred || interaction.replied) ? "followUp" : "reply"]({
                        content: `Failed to execute command. sylvend has logged the error.`,
                        ephemeral: true
                    });
                    logger.log(err);
                }
            }
        });
        this.login(configManager.secret.token);
    }
}

async function deployCommands(client, guild) {
    logger.log(`Deploying commands ${guild ? `for guild id ${guild}` : "globally"}...`);
    let rest = new REST().setToken(client.token);
    await rest.put(Routes.applicationGuildCommands(client.application.id, guild), { body: client.commands.map(c => c.data) });
    logger.log("Success.");
}

module.exports = { SylvendClient, deployCommands };
logger.ready();
