import {
  ActionRowBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { colors } from "../utils.js";

export type HelpCategory = "home" | "community" | "moderation" | "systems" | "games" | "configuration";

const pages: Record<HelpCategory, { title: string; emoji: string; description: string }> = {
  home: {
    title: "Command Center",
    emoji: "✨",
    description: [
      "A modern multi-purpose Discord toolkit powered by **Bun, TypeScript, MongoDB, and Components v2**.",
      "",
      "### Quick start",
      "Use the menu below to browse commands by category. Discord will show every option and required argument while you type.",
      "",
      "🛡️ **Moderation & Automod** · 🎟️ **Tickets** · 🔊 **Temporary Voice**",
      "🎭 **Reaction Roles** · 🎉 **Giveaways** · 📈 **Levels** · 🎮 **Arcade**",
    ].join("\n"),
  },
  community: {
    title: "Community & Utility",
    emoji: "👥",
    description: [
      "`/afk` — Set your AFK status",
      "`/poll` — Create a community poll",
      "`/remind` — Schedule a reminder",
      "`/rank` · `/leaderboard` — View XP progress",
      "`/review submit|list` — Community reviews",
      "`/invites user|leaderboard` — Invite statistics",
      "`/user-info` · `/server-info` — Server insights",
      "`/auto-react set|remove` — Channel auto reactions",
    ].join("\n"),
  },
  moderation: {
    title: "Moderation & Safety",
    emoji: "🛡️",
    description: [
      "`/moderation ban|kick|mute|unmute|warn`",
      "`/warnings` — View member warning history",
      "`/purge` — Bulk-delete recent messages",
      "`/slowmode` — Configure channel rate limits",
      "`/automod status|toggle|protections`",
      "`/automod badword-add|badword-remove`",
      "",
      "Automod covers spam, mass mentions, blocked language, and mass emojis. Actions can be sent to the configured log channel.",
    ].join("\n"),
  },
  systems: {
    title: "Advanced Systems",
    emoji: "🧩",
    description: [
      "`/ticket panel|add-user|remove-user` — Private support",
      "`/giveaway create|end|reroll` — Persistent giveaways",
      "`/voice setup|rename|limit|lock|unlock`",
      "`/voice permit|reject|transfer` — Voice ownership",
      "`/reaction-role create|add|remove|refresh|delete|list`",
      "`/autoresponder add|remove|list` — FAQ automation",
      "`/invites add|remove|reset|config` — Invite administration",
    ].join("\n"),
  },
  games: {
    title: "Arcade",
    emoji: "🎮",
    description: [
      "`/games 2048` · `/games connect-4`",
      "`/games hangman` · `/games minesweeper`",
      "`/games pokemon` · `/games snake`",
      "`/games trivia` · `/games wordle`",
      "`/games tic-tac-toe` · `/games rps`",
      "`/games slots` · `/games coinflip` · `/games dice`",
      "`/multiplayer challenge` — Button-controlled Tic-Tac-Toe or Connect 4",
      "",
      "Game sessions are scoped to you and the current server.",
    ].join("\n"),
  },
  configuration: {
    title: "Setup & Configuration",
    emoji: "⚙️",
    description: [
      "`/setup` — Logs, onboarding, ticket category, and support role",
      "`/automod protections` — Tune server safeguards",
      "`/voice setup` — Create the join-to-create system",
      "`/invites config` — Attribution logs and fake-account age",
      "`/ticket panel` — Publish the support entry point",
      "`/reaction-role create` — Publish a role menu",
      "",
      "Most configuration commands require **Manage Server** or **Manage Roles**.",
    ].join("\n"),
  },
};

export function helpComponents(category: HelpCategory = "home", botName = "Advanced Bot V2", guildName?: string) {
  const page = pages[category];
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help:category")
    .setPlaceholder("Browse a command category")
    .addOptions((Object.entries(pages) as Array<[HelpCategory, typeof page]>).map(([value, item]) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(item.title)
        .setDescription(value === "home" ? "Overview and quick start" : `Browse ${item.title.toLowerCase()} commands`)
        .setEmoji(item.emoji)
        .setValue(value)
        .setDefault(value === category),
    ));
  return [new ContainerBuilder().setAccentColor(colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ${page.emoji} ${botName} · ${page.title}\n${page.description}`,
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `-# ${guildName ? `Viewing help in ${guildName} · ` : ""}Use \`/ping\` to check latency · Select another category below`,
    ))];
}

export function isHelpCategory(value: string): value is HelpCategory {
  return value in pages;
}
