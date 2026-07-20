import {
  ActionRowBuilder,
  ContainerBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { ReactionRolePanel } from "../database.js";
import { colors } from "../utils.js";

export function reactionRoleComponents(panel: ReactionRolePanel) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`reaction-role:${panel._id}`)
    .setPlaceholder("Select the roles you want")
    .setMinValues(0)
    .setMaxValues(panel.options.length)
    .addOptions(panel.options.map((option) => {
      const item = new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.roleId);
      if (option.description) item.setDescription(option.description);
      if (option.emoji) item.setEmoji(option.emoji);
      return item;
    }));
  return [new ContainerBuilder().setAccentColor(colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${panel.title}\n${panel.description}`))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu))];
}
