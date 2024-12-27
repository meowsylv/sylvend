const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('pong.'),
	async execute(interaction) {
        let startTimestamp = Date.now();
		await interaction.reply({ ephemeral: true, content: 'pong.' });
        await interaction.editReply({ ephemeral: true, content: `pong. took me ${Date.now() - startTimestamp}ms to send that message.` });
	},
};

