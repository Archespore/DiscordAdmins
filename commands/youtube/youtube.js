// @ts-check
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const downloadTypes = [
    { name: 'Highest both', value: 'highest' },
    { name: 'Highest audio only', value: 'highestaudio' },
    { name: 'Highest video only', value: 'highestvideo' }
];

export default {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Youtube related commands')
        .addSubcommand(subcommand => subcommand
            .setName('play')
            .setDescription('Plays the specified youtube video in your current, or provided voice channel')
            .addStringOption(url => url
                .setName('url')
                .setDescription('The url of the youtube video to play')
                .setRequired(true)
            )
            .addChannelOption(channel => channel
                .setName('channel')
                .setDescription('The voice channel to play the audio to')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('download')
            .setDescription('Downloads the specified youtube video as an mp4')
            .addStringOption(url => url
                .setName('url')
                .setDescription('The url of the youtube video to download')
                .setRequired(true)
            )
            .addStringOption(downloadType => downloadType
                .setName('downloadtype')
                .setDescription('The type of download to perform')
                .addChoices(downloadTypes)
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('stop')
            .setDescription('Stops any currently playing audio from the play subcommand')
        ),
    /***
     * Execute function for this command
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        const subcommandType = interaction.options.getSubcommand();
        try {
            const subcommand = (await import(`./subcommands/${subcommandType}.js`)).default;
            await subcommand.execute(botContext, interaction);
        }
        catch(error) {
            interaction.editReply({content: "Sorry, there was an error running your command."});
            console.log(`Encountered an error when attempting to run the subcommand, ${subcommandType} for the youtube command.`);
            console.log(error.message);
        }
    }
}