import {
  EmbedBuilder,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
  type MessageCreateOptions,
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

export function componentsV2(title: string, description: string, color: number = colors.primary, ephemeral = false): InteractionReplyOptions {
  return {
    components: [new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${title}\n${description}`),
    )],
    flags: ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
  };
}

export function messageComponentsV2(title: string, description: string, color: number = colors.primary): MessageCreateOptions {
  return {
    components: [new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${title}\n${description}`),
    )],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function requirePermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
): Promise<boolean> {
  const member = interaction.member as GuildMember | null;
  if (member?.permissions.has(permission)) return true;
  await interaction.reply(componentsV2("Permission denied", "You do not have permission to use this command.", colors.danger, true));
  return false;
}

export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export const moderatorPermission = PermissionFlagsBits.ModerateMembers;
