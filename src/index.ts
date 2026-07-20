import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { createServer } from "node:http";
import { commands } from "./commands/index.js";
import { config } from "./config.js";
import { Database } from "./database.js";
import { onGuildMemberAdd, onGuildMemberRemove } from "./events/guild.js";
import { onInteraction } from "./events/interactions.js";
import { onMessageCreate } from "./events/message-create.js";
import { onMessageDelete, onMessageUpdate } from "./events/message-logs.js";
import { startReminderWorker } from "./services/reminders.js";
import { startGiveawayWorker } from "./services/giveaways.js";
import { onVoiceStateUpdate } from "./events/voice.js";
import {
  attributeMemberJoin,
  attributeMemberLeave,
  primeInviteCache,
  syncGuildInvites,
} from "./services/invites.js";

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
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.User,
  ],
  allowedMentions: { parse: ["users", "roles"], repliedUser: false },
});
const db = new Database();
await db.connect();
const commandMap = new Collection(
  commands.map((command) => [command.data.name, command]),
);
const startedAt = Date.now();
const healthServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end("Not found");
    return;
  }
  const ready = client.isReady();
  response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      status: ready ? "ready" : "starting",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      guilds: client.guilds.cache.size,
      websocketPing: client.ws.ping,
    }),
  );
});
healthServer.listen(config.HEALTH_PORT, "0.0.0.0", () => {
  console.log(
    `Health endpoint listening on http://localhost:${config.HEALTH_PORT}/health`,
  );
});

client.once(Events.ClientReady, async (ready) => {
  console.log(
    `Ready as ${ready.user.tag} in ${ready.guilds.cache.size} guild(s).`,
  );
  ready.user.setActivity("/help - Advanced Bot V2", {
    type: 4,
  });
  await primeInviteCache(client, db);
  startReminderWorker(client, db);
  startGiveawayWorker(client, db);
});
client.on(Events.InteractionCreate, (interaction) =>
  onInteraction(interaction, commandMap, db, client),
);
client.on(Events.MessageCreate, (message) =>
  onMessageCreate(message, db).catch(console.error),
);
client.on(Events.MessageDelete, (message) =>
  onMessageDelete(message, db).catch(console.error),
);
client.on(Events.MessageUpdate, (oldMessage, newMessage) =>
  onMessageUpdate(oldMessage, newMessage, db).catch(console.error),
);
client.on(Events.GuildMemberAdd, (member) =>
  onGuildMemberAdd(member, db).catch(console.error),
);
client.on(Events.GuildMemberRemove, (member) =>
  onGuildMemberRemove(member, db).catch(console.error),
);
client.on(Events.GuildMemberAdd, (member) =>
  attributeMemberJoin(member, db).catch(console.error),
);
client.on(Events.GuildMemberRemove, (member) =>
  attributeMemberLeave(member, db).catch(console.error),
);
client.on(Events.InviteCreate, (invite) => {
  const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : null;
  if (guild) syncGuildInvites(guild, db).catch(console.error);
});
client.on(Events.InviteDelete, (invite) => {
  const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : null;
  if (guild) syncGuildInvites(guild, db).catch(console.error);
});
client.on(Events.GuildCreate, (guild) =>
  syncGuildInvites(guild, db).catch(console.error),
);
client.on(Events.VoiceStateUpdate, (oldState, newState) =>
  onVoiceStateUpdate(oldState, newState, db).catch(console.error),
);
client.on(Events.Error, console.error);
process.on("unhandledRejection", console.error);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    client.destroy();
    healthServer.close();
    await db.close();
    process.exit(0);
  });
}

await client.login(config.DISCORD_TOKEN);
