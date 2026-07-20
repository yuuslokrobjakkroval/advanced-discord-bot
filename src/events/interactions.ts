import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Interaction,
  type TextChannel,
} from "discord.js";
import type { Database } from "../database.js";
import type { Command } from "../types.js";
import { colors, embed } from "../utils.js";
import { giveawayComponents } from "../services/giveaways.js";
import { ObjectId } from "mongodb";
import { helpComponents, isHelpCategory } from "../services/help-ui.js";
import { interactionLimiter } from "../services/rate-limit.js";
import { handleMultiplayerButton } from "../services/multiplayer.js";

export async function onInteraction(
  interaction: Interaction,
  commands: Map<string, Command>,
  db: Database,
  client: Client,
): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        const cooldown = command.cooldown ?? 3_000;
        const result = interactionLimiter.check(`command:${interaction.guildId ?? "dm"}:${interaction.user.id}:${interaction.commandName}`, 1, cooldown);
        if (!result.allowed) {
          await interaction.reply({
            content: `Slow down — try this command again in **${Math.ceil(result.retryAfterMs / 1000)}s**.`,
            ephemeral: true,
          });
          return;
        }
        await command.execute(interaction, { client, db });
      }
      return;
    }
    if (interaction.isMessageComponent()) {
      const result = interactionLimiter.check(`component:${interaction.user.id}:${interaction.customId}`, 3, 2_000);
      if (!result.allowed) {
        if (interaction.isRepliable()) await interaction.reply({
          content: `You're using controls too quickly. Try again in **${Math.ceil(result.retryAfterMs / 1000)}s**.`,
          ephemeral: true,
        }).catch(() => undefined);
        return;
      }
    }
    if (interaction.isStringSelectMenu() && interaction.customId === "help:category") {
      const category = interaction.values[0];
      if (!category || !isHelpCategory(category)) return;
      await interaction.update({
        components: helpComponents(category, interaction.client.user.displayName, interaction.guild?.name),
      });
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reaction-role:") && interaction.guild) {
      const rawId = interaction.customId.slice("reaction-role:".length);
      const panel = ObjectId.isValid(rawId)
        ? await db.reactionRoles.findOne({ _id: new ObjectId(rawId), guildId: interaction.guild.id })
        : null;
      if (!panel) {
        await interaction.reply({ content: "This reaction-role panel is no longer configured.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const managedIds = new Set(panel.options.map((option) => option.roleId));
      const selectedIds = new Set(interaction.values.filter((roleId) => managedIds.has(roleId)));
      const added: string[] = [];
      const removed: string[] = [];
      const failed: string[] = [];
      for (const option of panel.options) {
        const hasRole = member.roles.cache.has(option.roleId);
        try {
          if (selectedIds.has(option.roleId) && !hasRole) {
            await member.roles.add(option.roleId, `Reaction-role panel ${panel._id}`);
            added.push(option.roleId);
          } else if (!selectedIds.has(option.roleId) && hasRole) {
            await member.roles.remove(option.roleId, `Reaction-role panel ${panel._id}`);
            removed.push(option.roleId);
          }
        } catch {
          failed.push(option.roleId);
        }
      }
      const lines = [
        added.length ? `**Added:** ${added.map((id) => `<@&${id}>`).join(", ")}` : "",
        removed.length ? `**Removed:** ${removed.map((id) => `<@&${id}>`).join(", ")}` : "",
        failed.length ? `**Could not update:** ${failed.map((id) => `<@&${id}>`).join(", ")}` : "",
        !added.length && !removed.length && !failed.length ? "Your roles were already up to date." : "",
      ].filter(Boolean);
      await interaction.editReply({ content: lines.join("\n"), allowedMentions: { parse: [] } });
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === "voice:rename-modal" && interaction.guild) {
      if (!interaction.channelId) {
        await interaction.reply({ content: "The voice channel could not be resolved.", ephemeral: true });
        return;
      }
      const voice = await db.tempVoices.findOne({ channelId: interaction.channelId });
      if (!voice) {
        await interaction.reply({ content: "This temporary channel no longer exists.", ephemeral: true });
        return;
      }
      const member = interaction.member as import("discord.js").GuildMember;
      if (voice.ownerId !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "Only the voice channel owner can rename it.", ephemeral: true });
        return;
      }
      const channel = interaction.guild.channels.cache.get(voice.channelId);
      if (channel?.isVoiceBased()) await channel.setName(interaction.fields.getTextInputValue("name"), `Renamed by ${interaction.user.tag}`);
      await interaction.reply({ content: "✅ Voice channel renamed.", ephemeral: true });
      return;
    }
    if (!interaction.isButton() || !interaction.guild) return;
    if (await handleMultiplayerButton(interaction, db)) return;
    if (interaction.customId.startsWith("voice:")) {
      const voice = await db.tempVoices.findOne({ channelId: interaction.channelId });
      if (!voice) {
        await interaction.reply({ content: "This temporary voice channel no longer exists.", ephemeral: true });
        return;
      }
      const member = interaction.member as import("discord.js").GuildMember;
      if (voice.ownerId !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "Only the voice channel owner can use this panel.", ephemeral: true });
        return;
      }
      const channel = interaction.guild.channels.cache.get(voice.channelId);
      if (!channel?.isVoiceBased()) return;
      if (interaction.customId === "voice:rename") {
        const input = new TextInputBuilder().setCustomId("name").setLabel("New channel name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
        const modal = new ModalBuilder().setCustomId("voice:rename-modal").setTitle("Rename voice channel")
          .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      if (interaction.customId === "voice:lock") await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      if (interaction.customId === "voice:unlock") await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: true });
      if (interaction.customId === "voice:delete") {
        await db.tempVoices.deleteOne({ _id: voice._id });
        await interaction.reply({ content: "Deleting this voice channel…", ephemeral: true });
        await channel.delete(`Deleted by owner ${interaction.user.tag}`).catch(() => undefined);
        return;
      }
      await interaction.reply({ content: `✅ Voice channel ${interaction.customId === "voice:lock" ? "locked" : "unlocked"}.`, ephemeral: true });
      return;
    }
    if (interaction.customId === "giveaway:join") {
      const giveaway = await db.giveaways.findOne({ messageId: interaction.message.id, ended: false });
      if (!giveaway) {
        await interaction.reply({ content: "This giveaway is no longer active.", ephemeral: true });
        return;
      }
      const joined = giveaway.participants.includes(interaction.user.id);
      const participants = joined
        ? giveaway.participants.filter((id) => id !== interaction.user.id)
        : [...giveaway.participants, interaction.user.id];
      await db.giveaways.updateOne({ _id: giveaway._id }, { $set: { participants } });
      await interaction.update({ components: giveawayComponents({ ...giveaway, participants }) });
      await interaction.followUp({ content: joined ? "You left the giveaway." : "You entered the giveaway! 🎉", ephemeral: true });
      return;
    }
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
