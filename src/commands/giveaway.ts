import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { giveawayComponents, finishGiveaway } from "../services/giveaways.js";
import { requirePermission } from "../utils.js";

export const giveawayCommand: Command = {
  data: new SlashCommandBuilder().setName("giveaway").setDescription("Create and manage giveaways")
    .addSubcommand((sub) => sub.setName("create").setDescription("Start a giveaway")
      .addStringOption((option) => option.setName("prize").setDescription("Prize description").setRequired(true).setMaxLength(200))
      .addIntegerOption((option) => option.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(43200))
      .addIntegerOption((option) => option.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(10)))
    .addSubcommand((sub) => sub.setName("end").setDescription("End a giveaway immediately")
      .addStringOption((option) => option.setName("message-id").setDescription("Giveaway message ID").setRequired(true)))
    .addSubcommand((sub) => sub.setName("reroll").setDescription("Select new winners")
      .addStringOption((option) => option.setName("message-id").setDescription("Giveaway message ID").setRequired(true))),
  async execute(interaction, { db, client }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    const sub = interaction.options.getSubcommand();
    if (sub === "create") {
      const endsAt = new Date(Date.now() + interaction.options.getInteger("minutes", true) * 60_000);
      const giveaway = {
        guildId: interaction.guildId!, channelId: interaction.channelId, messageId: "",
        hostId: interaction.user.id, prize: interaction.options.getString("prize", true),
        winnerCount: interaction.options.getInteger("winners") ?? 1,
        participants: [], endsAt, ended: false,
      };
      const response = await interaction.reply({ components: giveawayComponents(giveaway), flags: 32768, withResponse: true });
      const message = response.resource?.message ?? await interaction.fetchReply();
      await db.giveaways.insertOne({ ...giveaway, messageId: message.id });
      return;
    }
    const messageId = interaction.options.getString("message-id", true);
    const giveaway = await db.giveaways.findOne({ guildId: interaction.guildId!, messageId });
    if (!giveaway) {
      await interaction.reply({ content: "Giveaway not found.", ephemeral: true });
      return;
    }
    if (sub === "end") {
      if (giveaway.ended) {
        await interaction.reply({ content: "That giveaway has already ended.", ephemeral: true });
        return;
      }
      const winners = await finishGiveaway(client, db, giveaway);
      await interaction.reply({ content: `Giveaway ended with **${winners.length}** winner(s).`, ephemeral: true });
      return;
    }
    if (!giveaway.ended || !giveaway.participants.length) {
      await interaction.reply({ content: "Only ended giveaways with entries can be rerolled.", ephemeral: true });
      return;
    }
    const winnerIds = [...giveaway.participants].sort(() => Math.random() - 0.5).slice(0, giveaway.winnerCount);
    await db.giveaways.updateOne({ _id: giveaway._id }, { $set: { winnerIds } });
    await interaction.reply({ content: `🎉 New winner(s): ${winnerIds.map((id) => `<@${id}>`).join(", ")}` });
  },
};

export const giveawayCommands = [giveawayCommand];
