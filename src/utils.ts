import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

export const colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
} as const;

export function embed(title: string, description: string, color: number = colors.primary) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

export async function requirePermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
): Promise<boolean> {
  const member = interaction.member as GuildMember | null;
  if (member?.permissions.has(permission)) return true;
  await interaction.reply({
    embeds: [embed("Permission denied", "You do not have permission to use this command.", colors.danger)],
    ephemeral: true,
  });
  return false;
}

export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export const moderatorPermission = PermissionFlagsBits.ModerateMembers;
