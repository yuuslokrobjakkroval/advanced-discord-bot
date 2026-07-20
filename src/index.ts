import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { commands } from "./commands/index.js";
import { config } from "./config.js";
import { Database } from "./database.js";
import { onGuildMemberAdd, onGuildMemberRemove } from "./events/guild.js";
import { onInteraction } from "./events/interactions.js";
import { onMessageCreate } from "./events/message-create.js";
import { onMessageDelete, onMessageUpdate } from "./events/message-logs.js";
import { startReminderWorker } from "./services/reminders.js";
import { startGiveawayWorker } from "./services/giveaways.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
  allowedMentions: { parse: ["users", "roles"], repliedUser: false },
});
const db = new Database();
await db.connect();
const commandMap = new Collection(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, (ready) => {
  console.log(`Ready as ${ready.user.tag} in ${ready.guilds.cache.size} guild(s).`);
  ready.user.setActivity("/help · Advanced Bot V2");
  startReminderWorker(client, db);
  startGiveawayWorker(client, db);
});
client.on(Events.InteractionCreate, (interaction) => onInteraction(interaction, commandMap, db, client));
client.on(Events.MessageCreate, (message) => onMessageCreate(message, db).catch(console.error));
client.on(Events.MessageDelete, (message) => onMessageDelete(message, db).catch(console.error));
client.on(Events.MessageUpdate, (oldMessage, newMessage) => onMessageUpdate(oldMessage, newMessage, db).catch(console.error));
client.on(Events.GuildMemberAdd, (member) => onGuildMemberAdd(member, db).catch(console.error));
client.on(Events.GuildMemberRemove, (member) => onGuildMemberRemove(member, db).catch(console.error));
client.on(Events.Error, console.error);
process.on("unhandledRejection", console.error);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    client.destroy();
    await db.close();
    process.exit(0);
  });
}

await client.login(config.DISCORD_TOKEN);
