// @ts-check
import { ChannelType, ChatInputCommandInteraction } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioResource, StreamType, createAudioPlayer, VoiceConnectionStatus } from "@discordjs/voice";
import process from "node:child_process";
import ytdl from "@distube/ytdl-core";

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

        //Channel validation, use user's channel if no channel, or an invalid channel was provided.
        let youtubeChannel = interaction.options.getChannel('channel', false, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
        const youtubeUserChannel = (await youtubeGuild.members.fetch(interaction.user)).voice.channel;
        if (youtubeChannel === null || !youtubeChannel.isVoiceBased()) {
            if (youtubeUserChannel === null) {
                interaction.editReply({content: "You must specify a voice channel, or be in a voice channel to use this command!"});
                return;
            }
            youtubeChannel = youtubeUserChannel;
        }

        const youtubeURL = interaction.options.getString('url', true);
        const youtubeAudioStream = ytdl(youtubeURL, { 
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        })
        interaction.editReply({content: "Attempting to play audio..."});

        const ffmpegStream = process.spawn('ffmpeg', [
            "-analyzeduration", "0",
            "-loglevel", "0",
            "-i", "pipe:0",
            "-f", "s16le",
            "-ar", "48000",
            "-ac", "2",
            "pipe:1"
        ], {
            stdio: ["pipe", "pipe", "inherit"]
        });

        youtubeAudioStream.pipe(ffmpegStream.stdin);

        const audioPlayer = createAudioPlayer();
        audioPlayer.on('error', error => {
            console.error('Audio Player Error:', error);
        });

        const audioResource = createAudioResource(ffmpegStream.stdout, {
            inputType: StreamType.Raw
        });

        let voiceConnection = getVoiceConnection(youtubeGuildId);
        if (voiceConnection === undefined) {
            voiceConnection = joinVoiceChannel({
                guildId: youtubeGuildId,
                channelId: youtubeChannel.id,
                adapterCreator: youtubeChannel.guild.voiceAdapterCreator
            });
        }

        voiceConnection.on(VoiceConnectionStatus.Ready, () => {
            interaction.editReply({content: "Playing audio..."});
            console.log("Playing now!")
            voiceConnection.subscribe(audioPlayer);
            audioPlayer.play(audioResource);
        });
    }
}