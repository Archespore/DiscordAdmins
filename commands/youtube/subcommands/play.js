// @ts-check
import { ChannelType, ChatInputCommandInteraction } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioResource, StreamType, createAudioPlayer, VoiceConnectionStatus, AudioResource, AudioPlayerStatus } from "@discordjs/voice";
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
        });
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

        const audioResource = createAudioResource(ffmpegStream.stdout, {
            inputType: StreamType.Raw
        });

        playAudio(botContext, youtubeChannel, audioResource, () => {
            interaction.editReply({content: `Now playing: ${youtubeURL} in <#${youtubeChannel.id}>`});
        });
    }
}

/**
 * Plays the provided audio resource on the provided VoiceBasedChannel
 * @param {import('../../../index.js').BotContext} botContext
 * @param {import("discord.js").VoiceBasedChannel} channel
 * @param {AudioResource} audioResource
 * @param {() => void} onPlay
 */
export function playAudio(botContext, channel, audioResource, onPlay) {
    const guild = channel.guild;

    const audioPlayer = createAudioPlayer();
    audioPlayer.on('error', error => {
        console.error('Audio Player Error:', error);
    });

    //Get or create voice connection and subscribe to new audio player
    let voiceConnection = getVoiceConnection(guild.id);
    if (voiceConnection === undefined) {
        voiceConnection = joinVoiceChannel({
            guildId: guild.id,
            channelId: channel.id,
            adapterCreator: guild.voiceAdapterCreator
        });
    }
    voiceConnection.subscribe(audioPlayer);

    //Destroy existing audio player and insert new audio player into audio tracker
    const existingAudioData = botContext.client.audio.get(guild.id);
    botContext.client.audio.set(guild.id, {
        player: audioPlayer,
        timeout: undefined
    });
    if (existingAudioData !== undefined) {
        existingAudioData.player?.stop();
        existingAudioData.timeout?.close();
    }

    //Play the audio and perform the provided function
    if (voiceConnection.state.status === VoiceConnectionStatus.Ready) {
        startAudio(botContext, guild.id, voiceConnection, audioPlayer, audioResource, onPlay);
    }
    else {
        voiceConnection.on(VoiceConnectionStatus.Ready, () => {
            startAudio(botContext, guild.id, voiceConnection, audioPlayer, audioResource, onPlay);
        });
    }
}

//Function called from VoiceConnectionStatus.Ready state to actually play audio.
//Separate function to avoid code duplication.
function startAudio(botContext, guildId, voiceConnection, audioPlayer, audioResource, onPlay) {
    audioPlayer.play(audioResource);

    //Wait for the player to actually transition to playing status, and then start waiting for Idle
    audioPlayer.once(AudioPlayerStatus.Playing, () => {
        audioPlayer.once(AudioPlayerStatus.Idle, () => {
            //When player transitions to Idle from Playing, First, check if the current registered audio player is the
            //Aame as the one initially passed. If so, destroy it, and the connection after 15 seconds.
            const currentAudioData = botContext.client.audio.get(guildId);
            if (currentAudioData?.player === audioPlayer) {
                const timeout = setTimeout(() => {
                    audioPlayer.stop();
                    voiceConnection.destroy();
                    botContext.client.audio.delete(guildId);
                }, 15000);
                currentAudioData.timeout = timeout;
            }
        });

        onPlay();
    });
}