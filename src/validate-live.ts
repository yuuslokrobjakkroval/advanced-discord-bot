import { REST, Routes, type APIUser } from "discord.js";
import { MongoClient } from "mongodb";
import { config } from "./config.js";

const mongo = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
try {
  await mongo.connect();
  await mongo.db(config.MONGODB_DATABASE).command({ ping: 1 });
  console.log(`MongoDB: OK (${config.MONGODB_DATABASE})`);
} finally {
  await mongo.close();
}

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const bot = await rest.get(Routes.user("@me")) as APIUser;
if (bot.id !== config.DISCORD_CLIENT_ID) {
  throw new Error(`DISCORD_CLIENT_ID belongs to a different application (token user: ${bot.id})`);
}
console.log(`Discord REST: OK (${bot.username} / ${bot.id})`);
console.log("Live validation passed.");
