import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { Command } from "../types.js";
import { colors, embed } from "../utils.js";
import { helpComponents } from "../services/help-ui.js";

export const helpCommand: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("View the bot command center"),
  async execute(interaction) {
    await interaction.reply({
      components: helpComponents("home", interaction.client.user.displayName, interaction.guild?.name),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  async execute(interaction) {
    const response = await interaction.reply({ content: "Measuring…", withResponse: true });
    const sent = response.resource?.message ?? await interaction.fetchReply();
    await interaction.editReply(`Pong! API: **${interaction.client.ws.ping}ms** · Round trip: **${sent.createdTimestamp - interaction.createdTimestamp}ms**`);
  },
};

export const pollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a yes/no community poll")
    .addStringOption((o) => o.setName("question").setDescription("Question to ask").setRequired(true).setMaxLength(200)),
  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const response = await interaction.reply({
      embeds: [embed("📊 Community Poll", question).setFooter({ text: `Started by ${interaction.user.username}` })],
      withResponse: true,
    });
    const message = response.resource?.message ?? await interaction.fetchReply();
    await message.react("👍");
    await message.react("👎");
  },
};

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the ticket system")
    .addSubcommand((s) => s.setName("panel").setDescription("Post the ticket creation panel"))
    .addSubcommand((s) => s.setName("add-user").setDescription("Add a user to this ticket")
      .addUserOption((option) => option.setName("user").setDescription("User to add").setRequired(true)))
    .addSubcommand((s) => s.setName("remove-user").setDescription("Remove a user from this ticket")
      .addUserOption((option) => option.setName("user").setDescription("User to remove").setRequired(true))),
  async execute(interaction, { db }) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "panel") {
      const ticket = await db.tickets.findOne({ channelId: interaction.channelId, status: "open" });
      if (!ticket) {
        await interaction.reply({ content: "This command can only be used inside an open ticket.", ephemeral: true });
        return;
      }
      const cfg = await db.ensureGuild(interaction.guildId!);
      const member = interaction.member as import("discord.js").GuildMember;
      const isStaff = member.permissions.has(PermissionFlagsBits.ManageChannels)
        || Boolean(cfg.ticketSupportRoleId && member.roles.cache.has(cfg.ticketSupportRoleId));
      if (ticket.ownerId !== interaction.user.id && !isStaff) {
        await interaction.reply({ content: "Only the ticket owner or support staff can manage ticket users.", ephemeral: true });
        return;
      }
      const user = interaction.options.getUser("user", true);
      const channel = interaction.channel as import("discord.js").TextChannel;
      if (subcommand === "add-user") {
        await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        await interaction.reply({ content: `✅ ${user} was added to this ticket.` });
      } else {
        if (user.id === ticket.ownerId) {
          await interaction.reply({ content: "The ticket owner cannot be removed.", ephemeral: true });
          return;
        }
        await channel.permissionOverwrites.delete(user.id);
        await interaction.reply({ content: `✅ ${user} was removed from this ticket.` });
      }
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need **Manage Server** to post this panel.", ephemeral: true });
      return;
    }
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:create").setLabel("Create Ticket").setEmoji("🎟️").setStyle(ButtonStyle.Primary),
    );
    const panel = new ContainerBuilder().setAccentColor(colors.primary)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Support Center\nNeed help? Press the button below to open a private support ticket."))
      .addActionRowComponents(row);
    await interaction.reply({ components: [panel], flags: MessageFlags.IsComponentsV2 });
  },
};

export const generalCommands = [helpCommand, pingCommand, pollCommand, ticketCommand];
