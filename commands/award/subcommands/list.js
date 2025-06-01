// @ts-check
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { awardTypes } from "../award.js";

const msgRegex = /^https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/\d+\/(\d+)\/(\d+)$/;

const listQuery =  `SELECT * FROM awards
                    WHERE user_id = $1 AND guild_id = $2
                    ORDER BY award_id DESC
                    LIMIT 5`;

export default {
    isSubcommand: true,
    /***
     * Execute function for this subcommand
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        const awardUserId = interaction.options.getUser('user', true).id;
        const response = await botContext.psql.query(listQuery, [awardUserId, interaction.guildId]);
        const awardCount = response.rows.length;

        if (awardCount <= 0) {
            await interaction.editReply({content: `**<@${awardUserId}> has no awards!**`});
            return;
        }

        const embeds = [];
        const displayCount = Math.min(5, awardCount);
        for (let i = 0; i < displayCount; i++) {
            embeds.push(await buildAwardEmbed(botContext, response.rows[i]));
        }

        interaction.editReply({content: `**<@${awardUserId}>'s Last 5 awards:**`, embeds: embeds});
    }
}

/**
 * Created an embed for the provided award data
 * @param {import('../../../index.js').BotContext} botContext the BotContext to make the embed from
 * @param {Object} award The award to build the embed for
 * @returns {Promise<EmbedBuilder>} The embed builder
 */
export async function buildAwardEmbed(botContext, award) {
    const awardReason = award.award_data.reason;
    let awardDesc = undefined;
    let awardImage = undefined;

    //Fetch message content if reason provided is a link to a message in the guild.
    //Begin by checking if the reason matches the discord message regex, and then destructuring the match if so.
    const awardReasonURL = awardReason?.match(msgRegex);
    if (awardReasonURL) {
        let awardReasonURLValid = true;
        const [, channelId, messageId] = awardReasonURL;
        const messageChannel = await botContext.client.channels.fetch(channelId);

        if (messageChannel?.isTextBased()) {
            /** @type {import('discord.js').TextBasedChannel} */ 
            const textChannel = messageChannel;

            try {
                //Parse reason message for a description
                const awardReasonMessage = await textChannel.messages.fetch(messageId);
                const awardReasonContent = awardReasonMessage?.content;

                //Parse message content for description and image
                const parsedDesc = await parseDesc(awardReasonContent);
                awardDesc = parsedDesc.awardDesc;
                awardImage = parsedDesc.awardImage;

                //Parse reason message attachments for an image if it's not already set
                if (awardImage === undefined) {
                    const awardReasonAttachments = awardReasonMessage.attachments;
                    if (awardReasonAttachments.size > 0) {
                        const awardMessageAttachment = awardReasonAttachments.first();
                        if (awardMessageAttachment?.contentType?.startsWith('image')) {
                            awardImage = awardMessageAttachment.url;
                        }
                    }
                }
            }
            catch (error) {
                if (error.code === 10008) awardReasonURLValid = false;
                else console.log("There was an error when attempting to fetch message contents for an award!");
            }
        }
        if (!awardReasonURLValid) awardDesc = '*Linked message not found.*';
        else awardDesc = '*Original Message: *' + awardReasonURL[0] + '\n\n' + (awardDesc ?? '');
    }
    else {
        //Parse provided reason for description and image
        const parsedDesc = await parseDesc(awardReason);
        awardDesc = parsedDesc.awardDesc;
        awardImage = parsedDesc.awardImage;
    }

    const awardType = awardTypes.find(item => item.value === award.award_type);
    const awardeeUser = await botContext.client.users.fetch(award.awarded_by);

    //Build the embeds for the reply
    const builder = new EmbedBuilder();
    builder.setTitle(awardType?.name ?? 'Unknown Award');
    builder.setColor(awardType?.color ?? 0xFFFFFF);
    builder.setDescription(awardDesc?.trimEnd() ?? null);
    builder.setImage(awardImage ?? null)
    builder.setFooter({ 
        text: `Awarded by: ${awardeeUser?.displayName}`,
        iconURL: awardeeUser?.displayAvatarURL()
    });
    builder.setTimestamp(award.created_at);
    return builder;
}

/***
 * Parses the provided description for embeded building
 * @param {string} description the description to parse the embed description and image for
 * @returns {Promise<{awardDesc:string | undefined, awardImage:string | undefined}>} an object containing the parsed description and image
 */
async function parseDesc(description) {
    let awardDesc = undefined;
    let awardImage = undefined;

    if (description !== undefined && description !== '') {
        const descriptionURL = description.match(/https?:\/\/\S+/);
        if (descriptionURL) {
            const response = await fetch(descriptionURL[0], { method: "HEAD" });
            if (response.headers.get('Content-type')?.startsWith('image')) {
                awardImage = descriptionURL[0];
                awardDesc = description.replace(descriptionURL[0], '').trim();
            }
        }
        else {
            awardDesc = description;
        }
    }

    return {
        awardDesc: awardDesc,
        awardImage: awardImage
    }
}