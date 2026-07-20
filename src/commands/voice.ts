import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { colors, componentsV2, requirePermission } from "../utils.js";

async function ownedChannel(interaction: Parameters<Command["execute"]>[0], db: Parameters<Command["execute"]>[1]["db"]) {
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  if (!channel) {
    await interaction.reply(componentsV2("Voice channel required", "Join your temporary voice channel first.", colors.danger, true));
    return null;
  }
  const record = await db.tempVoices.findOne({ channelId: channel.id });
  if (!record) {
    await interaction.reply(componentsV2("Not a temporary channel", "This voice channel is not managed by join-to-create.", colors.danger, true));
    return null;
  }
  if (record.ownerId !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply(componentsV2("Owner only", "Only the channel owner or a server manager can use this control.", colors.danger, true));
    return null;
  }
  return { channel: channel as VoiceChannel, record };
}

export const voiceCommand: Command = {
  data: new SlashCommandBuilder().setName("voice").setDescription("Configure or control temporary voice channels")
    .addSubcommand((sub) => sub.setName("setup").setDescription("Configure join-to-create")
      .addChannelOption((option) => option.setName("lobby").setDescription("Existing join-to-create channel").addChannelTypes(ChannelType.GuildVoice))
      .addChannelOption((option) => option.setName("category").setDescription("Category for temporary channels").addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand((sub) => sub.setName("rename").setDescription("Rename your voice channel")
      .addStringOption((option) => option.setName("name").setDescription("New channel name").setRequired(true).setMaxLength(100)))
    .addSubcommand((sub) => sub.setName("limit").setDescription("Set the user limit")
      .addIntegerOption((option) => option.setName("users").setDescription("0 disables the limit").setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand((sub) => sub.setName("lock").setDescription("Lock your channel"))
    .addSubcommand((sub) => sub.setName("unlock").setDescription("Unlock your channel"))
    .addSubcommand((sub) => sub.setName("permit").setDescription("Allow a user into your channel")
      .addUserOption((option) => option.setName("user").setDescription("User to permit").setRequired(true)))
    .addSubcommand((sub) => sub.setName("reject").setDescription("Block and disconnect a user")
      .addUserOption((option) => option.setName("user").setDescription("User to reject").setRequired(true)))
    .addSubcommand((sub) => sub.setName("transfer").setDescription("Transfer channel ownership")
      .addUserOption((option) => option.setName("user").setDescription("New owner").setRequired(true))),
  async execute(interaction, { db }) {
    const sub = interaction.options.getSubcommand();
    if (sub === "setup") {
      if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
      await db.ensureGuild(interaction.guildId!);
      const suppliedLobby = interaction.options.getChannel("lobby");
      const suppliedCategory = interaction.options.getChannel("category");
      const category = suppliedCategory ?? await interaction.guild!.channels.create({
        name: "Temporary Voice", type: ChannelType.GuildCategory, reason: `Voice setup by ${interaction.user.tag}`,
      });
      const lobby = suppliedLobby ?? await interaction.guild!.channels.create({
        name: "➕ Join to Create", type: ChannelType.GuildVoice, parent: category.id, reason: `Voice setup by ${interaction.user.tag}`,
      });
      await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: { voiceLobbyId: lobby.id, voiceCategoryId: category.id } });
      await interaction.reply(componentsV2("Join-to-create configured", `**Lobby:** ${lobby}\n**Category:** ${category}\nJoining the lobby now creates a private controllable room.`, colors.success, true));
      return;
    }

    const owned = await ownedChannel(interaction, db);
    if (!owned) return;
    const { channel, record } = owned;
    if (sub === "rename") await channel.setName(interaction.options.getString("name", true), `Renamed by ${interaction.user.tag}`);
    if (sub === "limit") await channel.setUserLimit(interaction.options.getInteger("users", true), `Changed by ${interaction.user.tag}`);
    if (sub === "lock") await channel.permissionOverwrites.edit(interaction.guildId!, { Connect: false });
    if (sub === "unlock") await channel.permissionOverwrites.edit(interaction.guildId!, { Connect: true });
    if (sub === "permit") {
      const user = interaction.options.getUser("user", true);
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, Connect: true });
    }
    if (sub === "reject") {
      const user = interaction.options.getUser("user", true);
      if (user.id === record.ownerId) {
        await interaction.reply(componentsV2("Cannot reject owner", "Transfer ownership first.", colors.danger, true));
        return;
      }
      await channel.permissionOverwrites.edit(user.id, { Connect: false });
      const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
      if (member?.voice.channelId === channel.id) await member.voice.disconnect(`Rejected by ${interaction.user.tag}`).catch(() => undefined);
    }
    if (sub === "transfer") {
      const user = interaction.options.getUser("user", true);
      const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
      if (!member || member.voice.channelId !== channel.id) {
        await interaction.reply(componentsV2("Transfer failed", "The new owner must be connected to this voice channel.", colors.danger, true));
        return;
      }
      await db.tempVoices.updateOne({ _id: record._id }, { $set: { ownerId: user.id } });
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, Connect: true, ManageChannels: true, MoveMembers: true });
    }
    await interaction.reply(componentsV2("Voice channel updated", `The **${sub}** action was applied to ${channel}.`, colors.success, true));
  },
};

export const voiceCommands = [voiceCommand];
