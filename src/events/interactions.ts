import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Interaction,
  type TextChannel,
} from "discord.js";
import type { Database } from "../database.js";
import type { Command } from "../types.js";
import { colors, embed } from "../utils.js";

export async function onInteraction(
  interaction: Interaction,
  commands: Map<string, Command>,
  db: Database,
  client: Client,
): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) await command.execute(interaction, { client, db });
      return;
    }
    if (!interaction.isButton() || !interaction.guild) return;
    if (interaction.customId === "ticket:create") {
      const cfg = await db.ensureGuild(interaction.guild.id);
      const existing = await db.tickets.findOne({ guildId: interaction.guild.id, ownerId: interaction.user.id, status: "open" });
      if (existing) {
        await interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
        return;
      }
      const permissions = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ];
      if (cfg.ticketSupportRoleId) permissions.push({
        id: cfg.ticketSupportRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      } as typeof permissions[number]);
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
        type: ChannelType.GuildText,
        parent: cfg.ticketCategoryId,
        permissionOverwrites: permissions,
        topic: `Support ticket for ${interaction.user.tag} (${interaction.user.id})`,
      });
      await db.tickets.insertOne({ channelId: channel.id, guildId: interaction.guild.id, ownerId: interaction.user.id, status: "open", createdAt: new Date() });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ticket:close").setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
      );
      await channel.send({ content: `${interaction.user}${cfg.ticketSupportRoleId ? ` <@&${cfg.ticketSupportRoleId}>` : ""}`, embeds: [embed("Ticket opened", "Describe your issue clearly and the support team will respond soon.", colors.success)], components: [row] });
      await interaction.reply({ content: `Your ticket is ready: ${channel}`, ephemeral: true });
      return;
    }
    if (interaction.customId === "ticket:close") {
      const ticket = await db.tickets.findOne({ channelId: interaction.channelId, status: "open" });
      if (!ticket) {
        await interaction.reply({ content: "This is not an open ticket.", ephemeral: true });
        return;
      }
      const channel = interaction.channel as TextChannel;
      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = [...messages.values()].reverse()
        .map((message) => `[${message.createdAt.toISOString()}] ${message.author.tag}: ${message.cleanContent}`)
        .join("\n").slice(0, 500_000);
      await db.tickets.updateOne({ _id: ticket._id }, { $set: { status: "closed", closedAt: new Date(), transcript } });
      const cfg = await db.ensureGuild(interaction.guild.id);
      const log = cfg.logChannelId ? interaction.guild.channels.cache.get(cfg.logChannelId) : null;
      if (log?.isTextBased()) await (log as TextChannel).send({
        content: `Ticket transcript · ${channel.name}`,
        files: [{ attachment: Buffer.from(transcript || "No messages."), name: `${channel.name}.txt` }],
      }).catch(() => undefined);
      await interaction.reply({ embeds: [embed("Ticket closed", `Closed by ${interaction.user}. This channel will be deleted in 5 seconds.`, colors.warning)] });
      setTimeout(() => (interaction.channel as TextChannel)?.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => undefined), 5_000);
    }
  } catch (error) {
    console.error("Interaction error:", error);
    const payload = { content: "Something went wrong while running that action.", ephemeral: true };
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => undefined);
      else await interaction.reply(payload).catch(() => undefined);
    }
  }
}
