import { ChatInputCommandInteraction } from "discord.js";
import process from "node:child_process";
import ytdl from "@distube/ytdl-core";
import { randomInt } from "node:crypto";

const ffmpegConfigs = [
    { value: 'highest', 
        ffmpegArgs: [
            "-loglevel", "0",
            "-progress", "pipe:1",
            "-i", "pipe:3",
            "-i", "pipe:4",
            "-map", "0:a",
            "-map", "1:v",
            "-c:a", "aac",
            "-c:v", "libx264",
            "-f", "mp4",
            "-y"
        ],
        stdioArgs: [
            undefined, "pipe", undefined, "pipe", "pipe"
        ],
        format: "mp4"
    },
    {   value: 'highestaudio',
        ffmpegArgs: [
            "-loglevel", "0",
            "-progress", "pipe:1",
            "-i", "pipe:0",
            "-map", "0:a:0",
            "-c:a", "aac",
            "-f", "mp4",
            "-y"
        ],
        stdioArgs: [
            "pipe", "pipe", "inherit"
        ],
        format: "mp4"
    },
    {   value: 'highestvideo',
        ffmpegArgs: [
            "-loglevel", "0",
            "-progress", "pipe:1",
            "-i", "pipe:0",
            "-map", "0:v",
            "-c:v", "libx264",
            "-movflags", "use_metadata_tags+faststart+frag_keyframe+empty_moov",
            "-f", "mp4",
            "-y"
        ],
        stdioArgs: [
            "pipe", "pipe", "inherit"
        ],
        format: "mp4"
    }
];

export default {
    /***
     * Execute function for this subcommand
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        if (!botContext.config.downloaders.has(interaction.user.id)) {
            interaction.reply({content: "You are not authorized to use this command."});
            return;
        }
        interaction.updateCount = 0;
        interaction.complete = false;

        const youtubeURL = interaction.options.getString('url', true);
        interaction.reply({content: `Attempting to download: ${youtubeURL}`});
        
        const downloadName = (await ytdl.getInfo(youtubeURL)).videoDetails.title;
        const youtubeDLType = interaction.options.getString('downloadtype', false) ?? 'highest';

        //Get argument details, if this is a video only or audio & video, append the file name
        const config = ffmpegConfigs.find(type => { return type.value == youtubeDLType });
        const ffmpegArgs = config?.ffmpegArgs ?? [];
        ffmpegArgs.push(`./downloads/${downloadName.replaceAll(/[^\p{L}\p{N}]/gu, '')}.${config.format}`);
        const stdioArgs = config?.stdioArgs ?? [];

        // stdioArgs is defined in ffmpegConfigs, values are safe to assume as correct.
        // Create the ffmpeg process, setup the data gatherer, and then start piping in the data.
        // @ts-ignore
        const ffmpegStream = process.spawn('ffmpeg', ffmpegArgs, { stdio: stdioArgs });
        // @ts-ignore
        ffmpegStream.on('close', () => {
            interaction.complete = true;
            interaction.editReply({content: `Your download is complete! ${youtubeURL}`});
        });

        let audioStream, videoStream;
        switch (youtubeDLType) {
            case 'highest':
                audioStream = getYoutubeAudioStream(youtubeURL);
                videoStream = getYoutubeVideoStream(youtubeURL);

                // These are Writeable streams due to ffmpeg args, ignore the errors saying otherwise
                // @ts-ignore
                audioStream.pipe(ffmpegStream.stdio[3]);
                // @ts-ignore
                videoStream.pipe(ffmpegStream.stdio[4]);
                break;
            case 'highestaudio':
                audioStream = getYoutubeAudioStream(youtubeURL);

                // @ts-ignore
                audioStream.pipe(ffmpegStream.stdin);

                // For audio only files, upload them to discord. (NOTE!) Decided to just download
                // all types to disk instead, keeping this here though, just in case.
                // @ts-ignore
                // ffmpegStream.on('close', async () => {
                //     const buffer = Buffer.concat(ffmpegBuffer);
                //     const attachment = new AttachmentBuilder(buffer).setName(`${downloadName}.${config.format}`);
                //     interaction.editReply({content: `Successfully downloaded: ${youtubeURL}`, files: [attachment]});
                // });
                break;
            case 'highestvideo':
                videoStream = getYoutubeVideoStream(youtubeURL);

                // @ts-ignore
                videoStream.pipe(ffmpegStream.stdin);
                break;
            default:
                interaction.editReply({content: "The download type provided is invalid."});
                return;
        }

        setTimeout(() => processingReminder(interaction, youtubeURL), 12000);
    }
}

/**
 * Gets the audio stream from a youtube video
 * @param {String} url Youtube URL to download
 * @returns {import("node:stream").Stream.Readable} stream of downloaded data
 */
function getYoutubeAudioStream(url) {
    return ytdl(url, { 
        quality: 'highestaudio',
        filter: 'audioonly'
    });
}

/**
 * Gets the video stream from a youtube video
 * NOTE: VIDEO IS LIMITED TO 1080, EVEN IF HIGHER QUALITIES ARE
 * AVAILABLE, TAKES TOO LONG TO DOWNLOAD OTHERWISE!
 * @param {String} url Youtube URL to download
 * @returns {import("node:stream").Stream} stream of downloaded data
 */
function getYoutubeVideoStream(url) {
    return ytdl(url, { 
        quality: 'highestvideo',
        filter: format => {
            return !format.hasAudio &&
            format.mimeType.startsWith('video') &&
            parseInt(format.qualityLabel.replaceAll('p', '')) <= 1080;
        }
    });
}

const quirkyMessages = {
    initial: [
        "🧠 Still thinking… really hard.",
        "🕵️‍♂️ Sneaking into the data’s secrets...",
        "🐢 Slow and steady decrypts the data.",
        "🛠️ Assembling ones and zeros like IKEA furniture.",
        "🧃 Juicing the bits... almost done squeezing.",
        "🐙 Wrestling an octopus of information... it's slippery.",
        "📡 Beaming signals to the data gods... awaiting prophecy.",
        "🐇 Chasing rabbits down logic holes... please stand by.",
        "🔄 Spinning wheels... hopefully not in vain.",
        "☕ Brewing results... do not disturb the data barista.",
        "🖥️ Thank ChatGPT for these quirky lines!"
    ],
    extended: [
        "🧟 Still running… might’ve become self-aware.",
        "🏝️ Stranded on a deserted CPU… send snacks.",
        "🍞 Toasting data on a potato-powered server.",
        "🐓 Powered by carrier pigeon. One packet at a time."
    ],
    eons: [
        "💀 If you're reading this, the task may have outlived us all.",
        "🖥️ Process is either running... or just pretending really well."
    ]
}

/**
 * Too lazy to implement an overall progress, so instead, we'll periodically
 * update the original message to some quirky lines to let the user know we're
 * still downloading & processing
 * @param {ChatInputCommandInteraction} interaction Youtube URL to download
 */
function processingReminder(interaction, url) {
    if (interaction.complete) return;

    // Quick for-fun method to put out quirky lines while you wait for download
    let messageGroup;
    if (++interaction.updateCount > 20) {
        messageGroup = quirkyMessages.eons;
    }
    else if (++interaction.updateCount > 10) {
        messageGroup = quirkyMessages.extended;
    }
    else {
        messageGroup = quirkyMessages.initial;
    }
    
    interaction.editReply({content: `${messageGroup[randomInt(messageGroup.length)]} ${url}`});
    setTimeout(() => processingReminder(interaction, url), 12000); // Update every 12 seconds
}