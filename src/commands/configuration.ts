import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { colors, embed, requirePermission } from "../utils.js";

export const automodCommand: Command = {
  data: new SlashCommandBuilder().setName("automod").setDescription("Configure automatic moderation")
    .addSubcommand((s) => s.setName("status").setDescription("View configuration"))
    .addSubcommand((s) => s.setName("toggle").setDescription("Enable or disable automod")
      .addBooleanOption((o) => o.setName("enabled").setDescription("New status").setRequired(true)))
    .addSubcommand((s) => s.setName("protections").setDescription("Configure individual protections")
      .addBooleanOption((o) => o.setName("anti-spam").setDescription("Enable spam protection"))
      .addBooleanOption((o) => o.setName("anti-ping").setDescription("Enable mass-mention protection"))
      .addBooleanOption((o) => o.setName("anti-emoji").setDescription("Enable mass-emoji protection"))
      .addIntegerOption((o) => o.setName("max-mentions").setDescription("Allowed mentions per message").setMinValue(1).setMaxValue(25)))
    .addSubcommand((s) => s.setName("badword-add").setDescription("Add a blocked word")
      .addStringOption((o) => o.setName("word").setDescription("Word or phrase").setRequired(true).setMaxLength(50)))
    .addSubcommand((s) => s.setName("badword-remove").setDescription("Remove a blocked word")
      .addStringOption((o) => o.setName("word").setDescription("Word or phrase").setRequired(true).setMaxLength(50))),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    const cfg = await db.ensureGuild(interaction.guildId!);
    const sub = interaction.options.getSubcommand();
    if (sub === "status") {
      await interaction.reply({ embeds: [embed("Automod Status", `Enabled: **${cfg.automodEnabled}**\nAnti-spam: **${cfg.antiSpam}**\nAnti-ping: **${cfg.antiPing}**\nMax mentions: **${cfg.maxMentions}**\nBlocked words: **${cfg.badWords.length}**`)], ephemeral: true });
      return;
    }
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: { automodEnabled: enabled } });
      await interaction.reply({ embeds: [embed("Automod updated", `Automod is now **${enabled ? "enabled" : "disabled"}**.`, colors.success)], ephemeral: true });
      return;
    }
    if (sub === "protections") {
      const values = {
        antiSpam: interaction.options.getBoolean("anti-spam") ?? undefined,
        antiPing: interaction.options.getBoolean("anti-ping") ?? undefined,
        antiMassEmoji: interaction.options.getBoolean("anti-emoji") ?? undefined,
        maxMentions: interaction.options.getInteger("max-mentions") ?? undefined,
      };
      const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
      if (!Object.keys(updates).length) {
        await interaction.reply({ content: "Provide at least one protection setting to update.", ephemeral: true });
        return;
      }
      await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: updates });
      await interaction.reply({ content: "✅ Automod protection settings updated.", ephemeral: true });
      return;
    }
    const word = interaction.options.getString("word", true).trim().toLowerCase();
    const badWords = sub === "badword-add"
      ? [...new Set([...cfg.badWords, word])]
      : cfg.badWords.filter((item) => item !== word);
    await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: { badWords } });
    await interaction.reply({ content: "✅ Blocked-word list updated.", ephemeral: true });
  },
};

export const autoresponderCommand: Command = {
  data: new SlashCommandBuilder().setName("autoresponder").setDescription("Manage automatic replies")
    .addSubcommand((s) => s.setName("add").setDescription("Add a response")
      .addStringOption((o) => o.setName("trigger").setDescription("Trigger text").setRequired(true).setMaxLength(100))
      .addStringOption((o) => o.setName("response").setDescription("Bot response").setRequired(true).setMaxLength(1500))
      .addBooleanOption((o) => o.setName("exact").setDescription("Require an exact match")))
    .addSubcommand((s) => s.setName("remove").setDescription("Remove a response")
      .addStringOption((o) => o.setName("trigger").setDescription("Trigger text").setRequired(true).setMaxLength(100)))
    .addSubcommand((s) => s.setName("list").setDescription("List responses")),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const trigger = interaction.options.getString("trigger")?.trim().toLowerCase();
    if (sub === "add") {
      await db.autoresponders.updateOne({ guildId, trigger: trigger! }, { $set: {
        response: interaction.options.getString("response", true),
        exact: interaction.options.getBoolean("exact") ?? false,
      } }, { upsert: true });
      await interaction.reply({ content: "✅ Autoresponder saved.", ephemeral: true });
    } else if (sub === "remove") {
      const result = await db.autoresponders.deleteOne({ guildId, trigger: trigger! });
      await interaction.reply({ content: result.deletedCount ? "✅ Autoresponder removed." : "That trigger was not found.", ephemeral: true });
    } else {
      const rows = await db.autoresponders.find({ guildId }).sort({ trigger: 1 }).limit(50).toArray();
      await interaction.reply({ embeds: [embed("Autoresponders", rows.length ? rows.map((r) => `• \`${r.trigger}\`${r.exact ? " (exact)" : ""}`).join("\n") : "None configured.")], ephemeral: true });
    }
  },
};

export const setupCommand: Command = {
  data: new SlashCommandBuilder().setName("setup").setDescription("Configure server channels and roles")
    .addChannelOption((o) => o.setName("logs").setDescription("Moderation and server log channel"))
    .addChannelOption((o) => o.setName("welcome").setDescription("Welcome message channel"))
    .addChannelOption((o) => o.setName("leave").setDescription("Goodbye message channel"))
    .addChannelOption((o) => o.setName("tickets").setDescription("Ticket category"))
    .addRoleOption((o) => o.setName("support-role").setDescription("Role that can access tickets"))
    .addStringOption((o) => o.setName("welcome-message").setDescription("Supports {user} and {server}").setMaxLength(1000))
    .addStringOption((o) => o.setName("leave-message").setDescription("Supports {user} and {server}").setMaxLength(1000)),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    await db.ensureGuild(interaction.guildId!);
    const values = {
      logChannelId: interaction.options.getChannel("logs")?.id,
      welcomeChannelId: interaction.options.getChannel("welcome")?.id,
      leaveChannelId: interaction.options.getChannel("leave")?.id,
      ticketCategoryId: interaction.options.getChannel("tickets")?.id,
      ticketSupportRoleId: interaction.options.getRole("support-role")?.id,
      welcomeMessage: interaction.options.getString("welcome-message") ?? undefined,
      leaveMessage: interaction.options.getString("leave-message") ?? undefined,
    };
    const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
    await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: updates });
    await interaction.reply({ embeds: [embed("Setup saved", "Your provided server settings have been updated.", colors.success)], ephemeral: true });
  },
};

export const configurationCommands = [automodCommand, autoresponderCommand, setupCommand];
