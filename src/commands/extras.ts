import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { colors, componentsV2, requirePermission } from "../utils.js";

const userInfo: Command = {
  data: new SlashCommandBuilder().setName("user-info").setDescription("Display information about a server member")
    .addUserOption((option) => option.setName("user").setDescription("Member to inspect")),
  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
    const roles = member?.roles.cache.filter((role) => role.id !== interaction.guildId).map(String).slice(0, 15).join(" ") || "None";
    await interaction.reply(componentsV2(`User Info · ${user.tag}`, [
      `**User ID:** \`${user.id}\``,
      `**Account created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
      `**Joined server:** ${member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown"}`,
      `**Roles:** ${roles}`,
    ].join("\n")));
  },
};

const serverInfo: Command = {
  data: new SlashCommandBuilder().setName("server-info").setDescription("Display information about this server"),
  async execute(interaction) {
    const guild = interaction.guild!;
    await guild.members.fetch().catch(() => undefined);
    const bots = guild.members.cache.filter((member) => member.user.bot).size;
    await interaction.reply(componentsV2(guild.name, [
      `**Owner:** <@${guild.ownerId}>`,
      `**Members:** ${guild.memberCount - bots} humans · ${bots} bots`,
      `**Channels:** ${guild.channels.cache.size}`,
      `**Roles:** ${guild.roles.cache.size - 1}`,
      `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
      `**Server ID:** \`${guild.id}\``,
    ].join("\n")));
  },
};

const invites: Command = {
  data: new SlashCommandBuilder().setName("invites").setDescription("Show invite statistics")
    .addUserOption((option) => option.setName("user").setDescription("Inviter to inspect")),
  async execute(interaction) {
    if (!interaction.guild!.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "I need **Manage Server** to read invite statistics.", ephemeral: true });
      return;
    }
    const user = interaction.options.getUser("user") ?? interaction.user;
    const all = await interaction.guild!.invites.fetch();
    const owned = all.filter((invite) => invite.inviterId === user.id);
    const uses = owned.reduce((total, invite) => total + (invite.uses ?? 0), 0);
    await interaction.reply(componentsV2(`Invites · ${user.username}`, `Tracked uses: **${uses}**\nActive links: **${owned.size}**`));
  },
};

const review: Command = {
  data: new SlashCommandBuilder().setName("review").setDescription("Submit or browse server reviews")
    .addSubcommand((sub) => sub.setName("submit").setDescription("Submit your review")
      .addIntegerOption((option) => option.setName("rating").setDescription("Rating from 1 to 5").setRequired(true).setMinValue(1).setMaxValue(5))
      .addStringOption((option) => option.setName("text").setDescription("Your review").setRequired(true).setMaxLength(500)))
    .addSubcommand((sub) => sub.setName("list").setDescription("View recent reviews")),
  async execute(interaction, { db }) {
    if (interaction.options.getSubcommand() === "submit") {
      const rating = interaction.options.getInteger("rating", true);
      const text = interaction.options.getString("text", true);
      await db.reviews.updateOne(
        { guildId: interaction.guildId!, userId: interaction.user.id },
        { $set: { rating, text, createdAt: new Date() } },
        { upsert: true },
      );
      await interaction.reply(componentsV2("Review saved", `${"⭐".repeat(rating)}\n${text}`, colors.success));
      return;
    }
    const rows = await db.reviews.find({ guildId: interaction.guildId! }).sort({ createdAt: -1 }).limit(10).toArray();
    const body = rows.length ? rows.map((item) => `${"⭐".repeat(item.rating)} <@${item.userId}>\n${item.text}`).join("\n\n") : "No reviews yet.";
    await interaction.reply(componentsV2("Community reviews", body));
  },
};

const autoReact: Command = {
  data: new SlashCommandBuilder().setName("auto-react").setDescription("Configure automatic message reactions")
    .addSubcommand((sub) => sub.setName("set").setDescription("Set reactions for a channel")
      .addChannelOption((option) => option.setName("channel").setDescription("Text channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption((option) => option.setName("emojis").setDescription("Space-separated emojis, maximum 5").setRequired(true)))
    .addSubcommand((sub) => sub.setName("remove").setDescription("Disable reactions in a channel")
      .addChannelOption((option) => option.setName("channel").setDescription("Text channel").setRequired(true).addChannelTypes(ChannelType.GuildText))),
  async execute(interaction, { db }) {
    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    const channel = interaction.options.getChannel("channel", true);
    if (interaction.options.getSubcommand() === "remove") {
      await db.autoReactions.deleteOne({ guildId: interaction.guildId!, channelId: channel.id });
      await interaction.reply({ content: "✅ Auto reactions disabled for that channel.", ephemeral: true });
      return;
    }
    const emojis = interaction.options.getString("emojis", true).trim().split(/\s+/).slice(0, 5);
    await db.autoReactions.updateOne(
      { guildId: interaction.guildId!, channelId: channel.id },
      { $set: { emojis } }, { upsert: true },
    );
    await interaction.reply({ content: `✅ I will react with ${emojis.join(" ")} in ${channel}.`, ephemeral: true });
  },
};

export const extraCommands = [userInfo, serverInfo, review, autoReact];
