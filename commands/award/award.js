// @ts-check
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const awardTypes = [
    { name: '🤨 Cringe Moment', value: 'cringe', color: 0xF7AB5E, cost: 1 },
    { name: '😬 GIGA Cringe Moment', value: 'giga_cringe', color: 0xF7825E, cost: 2 },
    { name: '😎 Gamer Moment', value: 'gamer', color: 0x9CF78B, cost: 1 },
    { name: '🤯 GIGA Gamer Moment', value: 'giga_gamer', color: 0x8BF7C1, cost: 2 }
];

export default {
    data: new SlashCommandBuilder()
        .setName('award')
        .setDescription('Award related commands')
        .addSubcommand(subcommand => subcommand
            .setName('give')
            .setDescription('Gives an award to another user')
            .addUserOption(user => user
                .setName('user')
                .setDescription('The user to give the award to')
                .setRequired(true)
            )
            .addStringOption(type => type
                .setName('type')
                .setDescription('The type of award to give')
                .addChoices(awardTypes)
                .setRequired(true)
            )
            .addStringOption(reason => reason
                .setName('reason')
                .setDescription('The reason for the award')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('Lists the awards of a user')
            .addUserOption(user => user
                .setName('user')
                .setDescription('The user to list the awards of')
                .setRequired(true)
            )
        ),
    /***
     * Execute function for this command
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        const subcommandType = interaction.options.getSubcommand();
        await interaction.deferReply();
        try {
            const subcommand = (await import(`./subcommands/${subcommandType}.js`)).default;
            await subcommand.execute(botContext, interaction);
        }
        catch(error) {
            interaction.editReply({content: "Sorry, there was an error running your command."});
            console.log(`Encountered an error when attempting to run the subcommand, ${subcommandType} for the award command.`);
            console.log(error.message);
        }
    }
}