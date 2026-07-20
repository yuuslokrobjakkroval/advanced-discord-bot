import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { config } from "./config.js";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const body = commands.map((command) => command.data.toJSON());
const route = config.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)
  : Routes.applicationCommands(config.DISCORD_CLIENT_ID);

await rest.put(route, { body });
console.log(`Deployed ${body.length} slash commands ${config.DISCORD_GUILD_ID ? "to the development guild" : "globally"}.`);
