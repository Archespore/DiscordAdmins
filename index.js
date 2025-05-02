import { Client, Collection, Events } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';

//Client setup
const config = JSON.parse(fs.readFileSync('./config.json'));
const client = new Client({ intents:[]});

//Command setup
client.commands = new Collection();
async function loadCommandDir(dirPath) {
    const directoryFiles = fs.readdirSync(dirPath, {withFileTypes: true});

    const promises = directoryFiles.map(async file => {
        const fileName = file.name;
        const fullFilePath = path.join(dirPath, fileName);

        //If the file is a directory, recursive call, otherwise add it to the command collection
        if (file.isDirectory()) { return loadCommandDir(fullFilePath); }
        else if (!fileName.startsWith('#') && fileName.endsWith('.js')) {
            const command = await import(fullFilePath);
            client.commands.set(command.name, command);
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
client.once(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    command.execute(interaction);
});