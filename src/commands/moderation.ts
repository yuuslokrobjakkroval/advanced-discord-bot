import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { colors, embed, requirePermission } from "../utils.js";

export const moderationCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("moderation")
    .setDescription("Moderate server members")
    .addSubcommand((s) => s.setName("ban").setDescription("Ban a member")
      .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(400)))
    .addSubcommand((s) => s.setName("kick").setDescription("Kick a member")
      .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(400)))
    .addSubcommand((s) => s.setName("mute").setDescription("Timeout a member")
      .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
      .addIntegerOption((o) => o.setName("minutes").setDescription("Duration").setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setMaxLength(400)))
    .addSubcommand((s) => s.setName("unmute").setDescription("Remove a member timeout")
      .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)))
    .addSubcommand((s) => s.setName("warn").setDescription("Warn a member")
      .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(400))),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;
    const action = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? `Action by ${interaction.user.tag}`;
    const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "That member is not in this server.", ephemeral: true });
      return;
    }
    if (!member.moderatable && ["mute", "unmute"].includes(action) || !member.bannable && action === "ban" || !member.kickable && action === "kick") {
      await interaction.reply({ content: "I cannot moderate that member. Check my role position and permissions.", ephemeral: true });
      return;
    }
    if (action === "ban") await member.ban({ reason });
    if (action === "kick") await member.kick(reason);
    if (action === "mute") await member.timeout(interaction.options.getInteger("minutes", true) * 60_000, reason);
    if (action === "unmute") await member.timeout(null);
    if (action === "warn") {
      await db.warnings.insertOne({ guildId: interaction.guildId!, userId: user.id, moderatorId: interaction.user.id, reason, createdAt: new Date() });
      await user.send({ embeds: [embed(`Warning from ${interaction.guild!.name}`, reason, colors.warning)] }).catch(() => undefined);
    }
    await interaction.reply({ embeds: [embed("Moderation action complete", `**${action.toUpperCase()}** applied to ${user}\n**Reason:** ${reason}`, colors.success)] });
  },
};

export const purgeCommand: Command = {
  data: new SlashCommandBuilder().setName("purge").setDescription("Bulk delete recent messages")
    .addIntegerOption((o) => o.setName("amount").setDescription("Messages to delete").setRequired(true).setMinValue(1).setMaxValue(100)),
  async execute(interaction) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageMessages)) return;
    const amount = interaction.options.getInteger("amount", true);
    const deleted = await (interaction.channel as TextChannel).bulkDelete(amount, true);
    await interaction.reply({ content: `🧹 Deleted **${deleted.size}** messages.`, ephemeral: true });
  },
};

export const slowmodeCommand: Command = {
  data: new SlashCommandBuilder().setName("slowmode").setDescription("Set channel slow mode")
    .addIntegerOption((o) => o.setName("seconds").setDescription("0 disables it").setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageChannels)) return;
    const seconds = interaction.options.getInteger("seconds", true);
    await (interaction.channel as TextChannel).setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    await interaction.reply({ content: seconds ? `Slow mode set to **${seconds}s**.` : "Slow mode disabled.", ephemeral: true });
  },
};

export const warningsCommand: Command = {
  data: new SlashCommandBuilder().setName("warnings").setDescription("View a member's warnings")
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true)),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;
    const user = interaction.options.getUser("user", true);
    const rows = await db.warnings.find({ guildId: interaction.guildId!, userId: user.id }).sort({ createdAt: -1 }).limit(20).toArray();
    const text = rows.length ? rows.map((w, i) => `**#${i + 1}** ${w.reason} — <@${w.moderatorId}> <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join("\n") : "No warnings.";
    await interaction.reply({ embeds: [embed(`Warnings · ${user.username}`, text)], ephemeral: true });
  },
};

export const moderationCommands = [moderationCommand, purgeCommand, slowmodeCommand, warningsCommand];
