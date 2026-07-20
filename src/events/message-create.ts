import { PermissionFlagsBits, type Message, type TextChannel } from "discord.js";
import type { Database } from "../database.js";
import { colors, messageComponentsV2, xpForLevel } from "../utils.js";

const spam = new Map<string, number[]>();

export async function onMessageCreate(message: Message, db: Database): Promise<void> {
  if (!message.guild || message.author.bot) return;
  const cfg = await db.ensureGuild(message.guild.id);
  const isModerator = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
  const normalized = message.content.toLowerCase();
  const now = Date.now();

  const autoReaction = await db.autoReactions.findOne({ guildId: message.guild.id, channelId: message.channelId });
  if (autoReaction) {
    for (const emoji of autoReaction.emojis) await message.react(emoji).catch(() => undefined);
  }

  if (cfg.automodEnabled && !isModerator) {
    const emojiCount = message.content.match(/<a?:\w+:\d+>|[\p{Extended_Pictographic}]/gu)?.length ?? 0;
    const key = `${message.guild.id}:${message.author.id}`;
    const recent = [...(spam.get(key) ?? []), now].filter((time) => now - time < 5_000);
    spam.set(key, recent);
    const reason =
      cfg.badWords.some((word) => normalized.includes(word)) ? "blocked language" :
      cfg.antiPing && message.mentions.users.size + message.mentions.roles.size > cfg.maxMentions ? "mass mentions" :
      cfg.antiMassEmoji && emojiCount > 10 ? "mass emojis" :
      cfg.antiSpam && recent.length >= 6 ? "spam" : null;
    if (reason) {
      await message.delete().catch(() => undefined);
      const warning = await message.reply({ content: `${message.author}, your message was removed for **${reason}**.` }).catch(() => null);
      if (warning) setTimeout(() => warning.delete().catch(() => undefined), 5_000);
      if (cfg.logChannelId) {
        const log = message.guild.channels.cache.get(cfg.logChannelId);
        if (log?.isTextBased()) await (log as TextChannel).send(messageComponentsV2("Automod action", `${message.author} in ${message.channel}\n**Reason:** ${reason}`, colors.warning)).catch(() => undefined);
      }
      return;
    }
  }

  const afk = await db.afk.findOne({ guildId: message.guild.id, userId: message.author.id });
  if (afk) {
    await db.afk.deleteOne({ _id: afk._id });
    await message.reply("Welcome back! I removed your AFK status.").catch(() => undefined);
  }
  for (const [, user] of message.mentions.users) {
    const away = await db.afk.findOne({ guildId: message.guild.id, userId: user.id });
    if (away) await message.reply(`${user.username} is AFK: **${away.reason}** · <t:${Math.floor(away.since.getTime() / 1000)}:R>`).catch(() => undefined);
  }

  const responders = await db.autoresponders.find({ guildId: message.guild.id }).toArray();
  const match = responders.find((item) => item.exact ? normalized === item.trigger : normalized.includes(item.trigger));
  if (match) await message.reply({ content: match.response, allowedMentions: { parse: [] } }).catch(() => undefined);

  if (!cfg.levelEnabled) return;
  const current = await db.levels.findOne({ guildId: message.guild.id, userId: message.author.id });
  if (current && now - current.lastXpAt.getTime() < 60_000) return;
  let xp = (current?.xp ?? 0) + 15 + Math.floor(Math.random() * 11);
  let level = current?.level ?? 0;
  let leveled = false;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    leveled = true;
  }
  await db.levels.updateOne(
    { guildId: message.guild.id, userId: message.author.id },
    { $set: { xp, level, lastXpAt: new Date() } },
    { upsert: true },
  );
  if (leveled) {
    const channel = cfg.levelChannelId ? message.guild.channels.cache.get(cfg.levelChannelId) : message.channel;
    if (channel?.isTextBased()) await (channel as TextChannel).send(messageComponentsV2("Level up! 🎉", `${message.author} reached **level ${level}**!`, colors.success)).catch(() => undefined);
  }
}
