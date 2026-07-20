import type { Message, PartialMessage, TextChannel } from "discord.js";
import type { Database } from "../database.js";
import { colors, embed } from "../utils.js";

export async function onMessageDelete(message: Message | PartialMessage, db: Database): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  const cfg = await db.ensureGuild(message.guild.id);
  const channel = cfg.logChannelId ? message.guild.channels.cache.get(cfg.logChannelId) : null;
  if (!channel?.isTextBased() || channel.id === message.channelId) return;
  const content = message.content?.slice(0, 1500) || "*Content unavailable or message contained only attachments.*";
  await (channel as TextChannel).send({ embeds: [embed(
    "Message deleted",
    `**Author:** ${message.author ?? "Unknown"}\n**Channel:** <#${message.channelId}>\n\n${content}`,
    colors.danger,
  )] }).catch(() => undefined);
}

export async function onMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage, db: Database): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const cfg = await db.ensureGuild(newMessage.guild.id);
  const channel = cfg.logChannelId ? newMessage.guild.channels.cache.get(cfg.logChannelId) : null;
  if (!channel?.isTextBased() || channel.id === newMessage.channelId) return;
  await (channel as TextChannel).send({ embeds: [embed(
    "Message edited",
    `**Author:** ${newMessage.author ?? "Unknown"}\n**Channel:** <#${newMessage.channelId}>\n[Jump to message](${newMessage.url})\n\n**Before**\n${oldMessage.content?.slice(0, 700) || "*Unavailable*"}\n\n**After**\n${newMessage.content?.slice(0, 700) || "*Empty*"}`,
    colors.warning,
  )] }).catch(() => undefined);
}
