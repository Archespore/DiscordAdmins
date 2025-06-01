import { REST, Routes } from "discord.js";
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

//Setup
const config = JSON.parse(fs.readFileSync('./config.json'));
const rest = new REST().setToken(config.token);

//Command setup
const commands = [];
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
                commands.push(command.data.toJSON());
            }
        }
    });

    await Promise.all(promises);
}
await loadCommandDir('./commands');

rest.put(Routes.applicationCommands(config.clientId), { body: commands })
    .then(() => {
        console.log(`Registered application commands for the following id: ${config.clientId}.`);
        rest.get(Routes.applicationCommands(config.clientId))
            .then(commandData => {
                fs.writeFile(`./logs/commands_${config.clientId}.json`, JSON.stringify(commandData), (error) => {
                        if (error) throw error;
                });
            })
            .catch(console.error);
    })
    .catch(console.error);