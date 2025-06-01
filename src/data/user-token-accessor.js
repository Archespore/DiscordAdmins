export const TOKEN_TYPES = {
    AWARD_TOKENS: 'award_tokens',
    DISCORD_MINUTES: 'discord_minutes'
}

const tokenUpdateQueries = Object.fromEntries(
    Object.entries(TOKEN_TYPES).map(([type, column]) => {
        return [column, `UPDATE user_tokens
                        SET ${column} = ${column} + $3
                        WHERE user_id = $1 AND guild_id = $2 AND ($4::boolean = true OR ${column} >= ABS($3))
                        RETURNING *;`];
    })
);

const getQuery =    `WITH updated AS (
                        UPDATE user_tokens
                        SET award_tokens = 3, last_reset = $3
                        WHERE user_id = $1 AND guild_id = $2 AND last_reset < $3
                        RETURNING *
                    ),
                    inserted AS (
                        INSERT INTO user_tokens (user_id, guild_id, award_tokens, last_reset)
                        VALUES($1, $2, 3, $3)
                        ON CONFLICT DO NOTHING
                        RETURNING *
                    )
                    SELECT * FROM updated
                    UNION
                    SELECT * FROM inserted
                    UNION
                    SELECT * FROM user_tokens WHERE user_id = $1 AND guild_id = $2;`;

/**
 * Gets all current values of the specified user's tokens
 * @param {import('../../index.js').BotContext} botContext the BotContext to make the query from
 * @param {string} userId the id of the user to decrease
 * @param {string} guildId the id of the guild to decrease the user from
 * @returns {Promise<import('pg').QueryArrayResult<any[]>>} the result of the query
 */
export async function getUserTokens(botContext, userId, guildId) {
    const response = await botContext.psql.query(getQuery, [userId, guildId, getCurrentWeek()]);

    //Don't know how this could happen, but just in case.
    if (response.rows.length != 1) {
        throw new Error(`A getUserTokens response returned zero rows for ${userId}!`);
    }

    return response;
}

/**
 * Updates the specified token type of the user by the provided amount.
 * @param {import('../../index.js').BotContext} botContext the BotContext to make the query from
 * @param {string} userId the id of the user to decrease
 * @param {string} guildId the id of the guild to decrease the user from
 * @param {string} token the name of token to decrease
 * @param {int} amount the amount to decrease the token by
 * @returns {Promise<response:import('pg').QueryArrayResult<any[]>>} the result of the query
 */
export async function updateUserTokens(botContext, userId, guildId, token, amount) {
    const isAddition = amount > 0;
    const updateQuery = tokenUpdateQueries[token];
    if (!updateQuery) {
        console.log("An invalid token type was provided to decreaseUserTokens()!");
        return undefined;
    }

    const getResponse = await getUserTokens(botContext, userId, guildId);
    const getResponseRows = getResponse.rows;
    if (!isAddition && getResponseRows[0][token] < Math.abs(amount)) {
        getResponse.validTokens = false;
        return getResponse;
    }

    const updateResponse = await botContext.psql.query(updateQuery, [userId, guildId, amount, isAddition]);
    updateResponse.validTokens = true;
    return updateResponse;
}

//345,600,000 epoch offset to reset @ sunday 12:00AM (+ this to date.now())
//604,800,000 milliseconds per week
export function getCurrentWeek() {
    return Math.floor((Date.now() + 345_600_000) / 604_800_000);
}

export default {
    TOKEN_TYPES,
    getUserTokens,
    updateUserTokens,
    getCurrentWeek
};