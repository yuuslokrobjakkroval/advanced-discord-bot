import type { GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import type { Database } from "../database.js";
import { colors, messageComponentsV2 } from "../utils.js";

function format(template: string, member: GuildMember | PartialGuildMember): string {
  return template.replaceAll("{user}", `<@${member.id}>`).replaceAll("{server}", member.guild.name);
}

export async function onGuildMemberAdd(member: GuildMember, db: Database): Promise<void> {
  const cfg = await db.ensureGuild(member.guild.id);
  const channel = cfg.welcomeChannelId ? member.guild.channels.cache.get(cfg.welcomeChannelId) : null;
  if (channel?.isTextBased()) await (channel as TextChannel).send(
    messageComponentsV2("Welcome! 👋", `${format(cfg.welcomeMessage, member)}\n\nYou are member **#${member.guild.memberCount}**.`, colors.success),
  );
  await sendLog(member, db, "Member joined", colors.success);
}

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember, db: Database): Promise<void> {
  const cfg = await db.ensureGuild(member.guild.id);
  const channel = cfg.leaveChannelId ? member.guild.channels.cache.get(cfg.leaveChannelId) : null;
  if (channel?.isTextBased()) await (channel as TextChannel).send(messageComponentsV2("Goodbye", format(cfg.leaveMessage, member), colors.warning));
  await sendLog(member, db, "Member left", colors.warning);
}

async function sendLog(member: GuildMember | PartialGuildMember, db: Database, title: string, color: number): Promise<void> {
  const cfg = await db.ensureGuild(member.guild.id);
  const channel = cfg.logChannelId ? member.guild.channels.cache.get(cfg.logChannelId) : null;
  if (channel?.isTextBased()) await (channel as TextChannel).send(messageComponentsV2(title, `${member.user} (\`${member.id}\`)`, color)).catch(() => undefined);
}
