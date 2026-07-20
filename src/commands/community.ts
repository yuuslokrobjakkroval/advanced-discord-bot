import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { colors, componentsV2, xpForLevel } from "../utils.js";

export const afkCommand: Command = {
  data: new SlashCommandBuilder().setName("afk").setDescription("Set your AFK status")
    .addStringOption((o) => o.setName("reason").setDescription("Why are you away?").setMaxLength(200)),
  async execute(interaction, { db }) {
    const reason = interaction.options.getString("reason") ?? "AFK";
    await db.afk.updateOne(
      { guildId: interaction.guildId!, userId: interaction.user.id },
      { $set: { reason, since: new Date() } },
      { upsert: true },
    );
    await interaction.reply(componentsV2("AFK enabled", `I'll let people know you're away: **${reason}**`, colors.success, true));
  },
};

export const rankCommand: Command = {
  data: new SlashCommandBuilder().setName("rank").setDescription("View a member's level")
    .addUserOption((o) => o.setName("user").setDescription("Member to inspect")),
  async execute(interaction, { db }) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const row = await db.levels.findOne({ guildId: interaction.guildId!, userId: user.id });
    await interaction.reply(componentsV2(`${user.username}'s Rank`, `Level **${row?.level ?? 0}**\nXP **${row?.xp ?? 0} / ${xpForLevel(row?.level ?? 0)}**`));
  },
};

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("View the server XP leaderboard"),
  async execute(interaction, { db }) {
    const rows = await db.levels.find({ guildId: interaction.guildId! }).sort({ level: -1, xp: -1 }).limit(10).toArray();
    const body = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r.userId}> — Level ${r.level} (${r.xp} XP)`).join("\n")
      : "No one has earned XP yet.";
    await interaction.reply(componentsV2("🏆 Leaderboard", body));
  },
};

export const remindCommand: Command = {
  data: new SlashCommandBuilder().setName("remind").setDescription("Set a reminder")
    .addIntegerOption((o) => o.setName("minutes").setDescription("Minutes from now").setRequired(true).setMinValue(1).setMaxValue(43200))
    .addStringOption((o) => o.setName("message").setDescription("What to remember").setRequired(true).setMaxLength(500)),
  async execute(interaction, { db }) {
    const dueAt = new Date(Date.now() + interaction.options.getInteger("minutes", true) * 60_000);
    await db.reminders.insertOne({
      userId: interaction.user.id, channelId: interaction.channelId,
      text: interaction.options.getString("message", true), dueAt, delivered: false,
    });
    await interaction.reply({ content: `⏰ I'll remind you <t:${Math.floor(dueAt.getTime() / 1000)}:R>.`, ephemeral: true });
  },
};

export const communityCommands = [afkCommand, rankCommand, leaderboardCommand, remindCommand];
