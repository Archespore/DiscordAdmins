// @ts-check
import { ChatInputCommandInteraction } from "discord.js";
import { awardTypes } from "../award.js";
import { buildAwardEmbed } from "./list.js"
import tokens from "../../../src/data/user-token-accessor.js";

const giveQuery =   `INSERT INTO awards(user_id, guild_id, awarded_by, award_type, award_data) 
                    VALUES($1, $2, $3, $4, $5)
                    RETURNING *;`;

export default {
    /***
     * Execute function for this subcommand
     * @param {ChatInputCommandInteraction} interaction 
     */
    async execute(botContext, interaction) {
        const awardType = interaction.options.getString('type', true);
        const awardeeUserId = interaction.user.id;
        const awardGuild = interaction.guild;
        const awardGuildId = awardGuild?.id;
        if (awardGuildId === undefined) {
            interaction.editReply({content: "You must use this command in a guild!"});
            return;
        }

        const awardData = awardTypes.find(type => type.value === awardType);
        if (awardData === undefined) {
            interaction.editReply({content: "The award type you provided is not valid!"});
            return;
        }

        const awardeeTokenData = await tokens.updateUserTokens(botContext, awardeeUserId, awardGuildId, tokens.TOKEN_TYPES.AWARD_TOKENS, -awardData.cost);
        const awardeeTokensLeft = awardeeTokenData.rows[0][tokens.TOKEN_TYPES.AWARD_TOKENS];
        if (!awardeeTokenData.validTokens) { interaction.editReply({content: `You do not have enough award tokens for a **${awardData.name}** award.
                                                                         \nThis award costs ${awardData.cost} award token(s).
                                                                         \nYou currently have ${awardeeTokensLeft} award token(s).`}); }

        const awardedUserId = interaction.options.getUser('user', true).id;
        const award = await botContext.psql.query(giveQuery, [awardedUserId, awardGuildId, awardeeUserId, awardType, { reason: interaction.options.getString('reason') ?? '' }]);
        if ("announceChannel" in botContext.guildsConfig[awardGuildId]) {
            const announceChannelId = botContext.guildsConfig[awardGuildId].announceChannel;
            const announceChannel = await awardGuild?.channels.resolve(announceChannelId);
            if (announceChannel?.isSendable()) {
                    /** @type {import('discord.js').SendableChannels} */ 
                    const sendableChannel = announceChannel;
                    interaction.editReply({content: `<@${awardedUserId}> was given an award!
                                                \n<@${awardeeUserId}> has ${awardeeTokensLeft} award token(s) left.`});
                    sendableChannel.send({content:  `<@${awardeeUserId}> gave <@${awardedUserId}> a ${awardData.name} award!`,
                                                    embeds: [await buildAwardEmbed(botContext, award.rows[0])]});
            }
        }
        else {
            interaction.editReply({content: `<@${awardeeUserId}> gave <@${awardedUserId}> a ${awardData.name} award!
                                        \nYou have ${awardeeTokensLeft} award token(s) left.`,
                                        embeds: [await buildAwardEmbed(botContext, award.rows[0])]});
        }
    }
}