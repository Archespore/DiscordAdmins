import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import fs from 'node:fs';

export class BotContext {
    constructor(client, config, guildsConfig, psql) {
        this.client = client;
        this.config = config;
        this.guildsConfig = guildsConfig;
        this.psql = psql;
    }
}

//Client setup
const config = JSON.parse(fs.readFileSync('./config.json'));
config.downloaders = new Set(config.downloaders);
const guildsConfig = JSON.parse(fs.readFileSync('./guilds-config.json'));
const client = new Client({ intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });

//PSQL & BotContext setup
const psql = new Pool({
    user: config.psql.user,
    password: config.psql.password,
    host: config.psql.host,
    port: config.psql.port,
    database: config.psql.database,
});
const botContext = new BotContext(client, config, guildsConfig, psql);

//Command setup
client.commands = new Collection();
client.audio = new Collection();
async function loadCommandDir(dirPath) {
    const directoryFiles = fs.readdirSync(dirPath, { withFileTypes: true });

    const promises = directoryFiles.map(async file => {
        const fileName = file.name;
        const fullFilePath = join(dirPath, fileName);

        //If the file is a directory, recursive call, otherwise add it to the command collection
        if (file.isDirectory()) { return loadCommandDir(fullFilePath); }
        else if (!fileName.startsWith('#') && fileName.endsWith('.js')) {
            const command = (await import(pathToFileURL(fullFilePath).href)).default;
            if (command.data !== undefined) {
                client.commands.set(command.data.name, command);
            }
        }
    });

    await Promise.all(promises);
}
await loadCommandDir('./commands');

//Client login
client.once(Events.ClientReady, () => {
    console.log('Client is ready');
});
client.login(config.token);

//Command Handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    await command.execute(botContext, interaction);
});