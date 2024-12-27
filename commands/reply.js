const { ActionRowBuilder, ModalBuilder, TextInputStyle, TextInputBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

module.exports = {
    data: new ContextMenuCommandBuilder()
	.setName('Reply to suggestion/bug report')
	.setType(ApplicationCommandType.Message),
    async execute(interaction, configManager) {
        if(!interaction.member.roles.cache.get(configManager.config.inboxPermsRoleId)) {
            await interaction.reply({ ephemeral: true, content: `Only users with the <@&${configManager.config.inboxPermsRoleId}> role may execute this command.` });
            return;
        }
        let suggestionEmbed = interaction.targetMessage.embeds[0];
        let suggestion = parseSuggestion(suggestionEmbed);
        if(!suggestion) {
            await interaction.reply({ ephemeral: true, content: "Failed to parse suggestion. Please ensure you are executing this command on a suggestion with an author field." });
            return;
        }
        let suggestionAuthor = await interaction.client.users.fetch(suggestion.userId);
        if(!suggestionAuthor) {
            await interaction.reply({ ephemeral: true, content: "Failed to fetch suggestion author." });
            return;

        }
        const modal = new ModalBuilder()
            .setCustomId("reply")
            .setTitle(`Replying to suggestion/bug report`);
        
        const replyInput = new TextInputBuilder()
            .setCustomId("responseInput")
            .setLabel("Response")
            .setStyle(TextInputStyle.Paragraph);
        
        const actionRow = new ActionRowBuilder().addComponents(replyInput);
        
        modal.addComponents(actionRow);
        
        await interaction.showModal(modal);

        let modalInteraction;
        try {
            modalInteraction  = await interaction.awaitModalSubmit({ filter: i => i.customId === "reply", time: 5 * 60 * 1000 });
        }
        catch {
            await interaction.followUp({ ephemeral: true, content: "Timed out." });
            return;
        }
        let response = modalInteraction.fields.getTextInputValue("responseInput");
        try {
            await suggestionAuthor.send({
                embeds: [
                    {
                        title: "Suggestion response",
                        description: `<@${interaction.user.id}> has replied to your suggestion.`,
                        fields: [
                            {
                                name: "Your suggestion",
                                value: `_"${suggestion.content}"_`
                            },
                            {
                                name: "Response",
                                value: `_"${response}"_`
                            }
                        ]
                    }
                ]
            });
        }
        catch {
            await modalInteraction.reply({ ephemeral: true, content: "Failed to message suggestion author." });
        }
        await modalInteraction.reply({ ephemeral: true, content: "Success." });
    }
};

function parseSuggestion(embed) {
    let { data } = embed;
    console.log(data);
    if(!data?.author) return;
    let userId = data.author.name.slice(data.author.name.lastIndexOf("(") + 1, -1).split(", ")[1];
    let content = data.description.slice(2, -2);
    return { userId, content };
}