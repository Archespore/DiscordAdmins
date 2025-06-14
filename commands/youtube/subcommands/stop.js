// @ts-check
import { ChatInputCommandInteraction } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
    /***
     * Execute function for this subcommand
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        await interaction.deferReply();

        //Guild validation
        const youtubeGuild = interaction.guild;
        if (youtubeGuild === null) {
            interaction.editReply({content: "You must use this command in a guild!"});
            return;
        }
        const youtubeGuildId = youtubeGuild.id;

        const voiceConnection = getVoiceConnection(youtubeGuildId);
        if (voiceConnection === undefined) {
            interaction.editReply({content: "There is no audio playing in this guild!"});
            return;
        }
        else {
            interaction.editReply({content: "Stopping any audio and leaving voice..."});
            voiceConnection.destroy();

            const currentAudioData = botContext.client.audio.get(youtubeGuildId);
            if (currentAudioData === undefined) return;

            //Delete the audioData entry from the client first and then cleanup other resources if they exist.
            botContext.client.audio.delete(youtubeGuildId);
            currentAudioData.player?.stop();
            currentAudioData.timeout?.close();
        }
    }
}