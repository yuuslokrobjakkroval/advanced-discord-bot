import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Role,
  type TextChannel,
} from "discord.js";
import { ObjectId } from "mongodb";
import type { Command } from "../types.js";
import { reactionRoleComponents } from "../services/reaction-roles.js";
import { colors, componentsV2, requirePermission } from "../utils.js";

function panelId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

async function validateRole(interaction: Parameters<Command["execute"]>[0], role: Role): Promise<string | null> {
  if (role.id === interaction.guildId) return "The `@everyone` role cannot be assigned.";
  if (role.managed) return "Managed integration roles cannot be assigned.";
  const bot = interaction.guild!.members.me;
  if (!bot || role.position >= bot.roles.highest.position) return "That role is above or equal to my highest role.";
  return null;
}

export const reactionRoleCommand: Command = {
  data: new SlashCommandBuilder().setName("reaction-role").setDescription("Manage select-menu reaction roles")
    .addSubcommand((sub) => sub.setName("create").setDescription("Create and publish a role panel")
      .addChannelOption((option) => option.setName("channel").setDescription("Panel channel").setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((option) => option.setName("title").setDescription("Panel title").setRequired(true).setMaxLength(100))
      .addStringOption((option) => option.setName("description").setDescription("Panel instructions").setRequired(true).setMaxLength(1000))
      .addRoleOption((option) => option.setName("role").setDescription("First selectable role").setRequired(true))
      .addStringOption((option) => option.setName("label").setDescription("Option label").setMaxLength(100))
      .addStringOption((option) => option.setName("emoji").setDescription("Unicode or custom emoji")))
    .addSubcommand((sub) => sub.setName("add").setDescription("Add a role to a panel")
      .addStringOption((option) => option.setName("panel-id").setDescription("Panel ID from create/list").setRequired(true))
      .addRoleOption((option) => option.setName("role").setDescription("Role to add").setRequired(true))
      .addStringOption((option) => option.setName("label").setDescription("Option label").setMaxLength(100))
      .addStringOption((option) => option.setName("description").setDescription("Option description").setMaxLength(100))
      .addStringOption((option) => option.setName("emoji").setDescription("Unicode or custom emoji")))
    .addSubcommand((sub) => sub.setName("remove").setDescription("Remove a role from a panel")
      .addStringOption((option) => option.setName("panel-id").setDescription("Panel ID").setRequired(true))
      .addRoleOption((option) => option.setName("role").setDescription("Role to remove").setRequired(true)))
    .addSubcommand((sub) => sub.setName("refresh").setDescription("Refresh a published panel")
      .addStringOption((option) => option.setName("panel-id").setDescription("Panel ID").setRequired(true)))
    .addSubcommand((sub) => sub.setName("delete").setDescription("Delete a panel and its message")
      .addStringOption((option) => option.setName("panel-id").setDescription("Panel ID").setRequired(true)))
    .addSubcommand((sub) => sub.setName("list").setDescription("List configured panels")),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageRoles)) return;
    const sub = interaction.options.getSubcommand();
    if (sub === "list") {
      const panels = await db.reactionRoles.find({ guildId: interaction.guildId! }).sort({ createdAt: -1 }).limit(20).toArray();
      const body = panels.length ? panels.map((panel) =>
        `**${panel.title}** · \`${panel._id}\`\n<#${panel.channelId}> · ${panel.options.length} roles`,
      ).join("\n\n") : "No reaction-role panels configured.";
      await interaction.reply(componentsV2("Reaction-role panels", body, colors.primary, true));
      return;
    }

    if (sub === "create") {
      const role = interaction.options.getRole("role", true) as Role;
      const problem = await validateRole(interaction, role);
      if (problem) { await interaction.reply(componentsV2("Invalid role", problem, colors.danger, true)); return; }
      const channel = interaction.options.getChannel("channel", true);
      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        await interaction.reply(componentsV2("Invalid channel", "Choose a text or announcement channel.", colors.danger, true)); return;
      }
      const result = await db.reactionRoles.insertOne({
        guildId: interaction.guildId!, channelId: channel.id,
        title: interaction.options.getString("title", true),
        description: interaction.options.getString("description", true),
        options: [{ roleId: role.id, label: interaction.options.getString("label") ?? role.name, emoji: interaction.options.getString("emoji") ?? undefined }],
        createdBy: interaction.user.id, createdAt: new Date(),
      });
      const panel = await db.reactionRoles.findOne({ _id: result.insertedId });
      const message = await (channel as TextChannel).send({ components: reactionRoleComponents(panel!), flags: MessageFlags.IsComponentsV2 });
      await db.reactionRoles.updateOne({ _id: result.insertedId }, { $set: { messageId: message.id } });
      await interaction.reply(componentsV2("Panel created", `Published in ${channel}\nPanel ID: \`${result.insertedId}\``, colors.success, true));
      return;
    }

    const id = panelId(interaction.options.getString("panel-id", true));
    const panel = id ? await db.reactionRoles.findOne({ _id: id, guildId: interaction.guildId! }) : null;
    if (!panel) { await interaction.reply(componentsV2("Panel not found", "Check the panel ID with `/reaction-role list`.", colors.danger, true)); return; }
    if (sub === "add") {
      if (panel.options.length >= 25) { await interaction.reply(componentsV2("Panel full", "Discord allows at most 25 select options.", colors.danger, true)); return; }
      const role = interaction.options.getRole("role", true) as Role;
      const problem = await validateRole(interaction, role);
      if (problem) { await interaction.reply(componentsV2("Invalid role", problem, colors.danger, true)); return; }
      if (panel.options.some((option) => option.roleId === role.id)) { await interaction.reply(componentsV2("Duplicate role", "That role is already in the panel.", colors.danger, true)); return; }
      panel.options.push({
        roleId: role.id, label: interaction.options.getString("label") ?? role.name,
        description: interaction.options.getString("description") ?? undefined,
        emoji: interaction.options.getString("emoji") ?? undefined,
      });
      await db.reactionRoles.updateOne({ _id: panel._id }, { $set: { options: panel.options } });
    }
    if (sub === "remove") {
      const role = interaction.options.getRole("role", true);
      panel.options = panel.options.filter((option) => option.roleId !== role.id);
      if (!panel.options.length) { await interaction.reply(componentsV2("Cannot empty panel", "Delete the panel instead.", colors.danger, true)); return; }
      await db.reactionRoles.updateOne({ _id: panel._id }, { $set: { options: panel.options } });
    }
    if (sub === "delete") {
      const channel = await interaction.guild!.channels.fetch(panel.channelId).catch(() => null);
      if (channel?.isTextBased() && panel.messageId) await (channel as TextChannel).messages.delete(panel.messageId).catch(() => undefined);
      await db.reactionRoles.deleteOne({ _id: panel._id });
      await interaction.reply(componentsV2("Panel deleted", "The configuration and published message were removed.", colors.success, true));
      return;
    }
    const channel = await interaction.guild!.channels.fetch(panel.channelId).catch(() => null);
    const message = channel?.isTextBased() && panel.messageId ? await (channel as TextChannel).messages.fetch(panel.messageId).catch(() => null) : null;
    await message?.edit({ components: reactionRoleComponents(panel), flags: MessageFlags.IsComponentsV2 });
    await interaction.reply(componentsV2("Panel updated", "The published role menu is up to date.", colors.success, true));
  },
};

export const reactionRoleCommands = [reactionRoleCommand];
