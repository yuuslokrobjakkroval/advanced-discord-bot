import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  PermissionFlagsBits,
  TextDisplayBuilder,
  type VoiceState,
} from "discord.js";
import type { Database } from "../database.js";
import { colors } from "../utils.js";

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState, db: Database): Promise<void> {
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const temporary = await db.tempVoices.findOne({ channelId: oldState.channelId });
    if (temporary) {
      const channel = oldState.guild.channels.cache.get(oldState.channelId);
      if (!channel || (channel.isVoiceBased() && channel.members.size === 0)) {
        await db.tempVoices.deleteOne({ _id: temporary._id });
        await channel?.delete("Temporary voice channel is empty").catch(() => undefined);
      }
    }
  }

  if (!newState.channelId || newState.channelId === oldState.channelId || !newState.member) return;
  const cfg = await db.ensureGuild(newState.guild.id);
  if (!cfg.voiceLobbyId || newState.channelId !== cfg.voiceLobbyId) return;

  const existing = await db.tempVoices.findOne({ guildId: newState.guild.id, ownerId: newState.member.id });
  if (existing) {
    const channel = newState.guild.channels.cache.get(existing.channelId);
    if (channel?.isVoiceBased()) {
      await newState.setChannel(channel, "Returning member to their temporary voice channel").catch(() => undefined);
      return;
    }
    await db.tempVoices.deleteOne({ _id: existing._id });
  }

  const channel = await newState.guild.channels.create({
    name: `${newState.member.displayName}'s Room`.slice(0, 100),
    type: ChannelType.GuildVoice,
    parent: cfg.voiceCategoryId,
    permissionOverwrites: [
      { id: newState.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: newState.member.id, allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak,
        PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers,
      ] },
    ],
    reason: `Join-to-create channel for ${newState.member.user.tag}`,
  });
  await db.tempVoices.insertOne({ guildId: newState.guild.id, channelId: channel.id, ownerId: newState.member.id, createdAt: new Date() });
  await newState.setChannel(channel, "Join-to-create").catch(async () => {
    await db.tempVoices.deleteOne({ channelId: channel.id });
    await channel.delete().catch(() => undefined);
  });

  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("voice:lock").setLabel("Lock").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice:unlock").setLabel("Unlock").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice:rename").setLabel("Rename").setEmoji("✏️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("voice:delete").setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
  );
  const panel = new ContainerBuilder().setAccentColor(colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# Voice Control Panel\nOwner: ${newState.member}\nUse these controls or the \`/voice\` command to manage members, limits, and ownership.`,
    )).addActionRowComponents(controls);
  await channel.send({ components: [panel], flags: 32768 }).catch(() => undefined);
}
