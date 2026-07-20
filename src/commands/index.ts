import type { Command } from "../types.js";
import { communityCommands } from "./community.js";
import { configurationCommands } from "./configuration.js";
import { generalCommands } from "./general.js";
import { extraCommands } from "./extras.js";
import { gameCommands } from "./games.js";
import { giveawayCommands } from "./giveaway.js";
import { voiceCommands } from "./voice.js";
import { reactionRoleCommands } from "./reaction-role.js";
import { moderationCommands } from "./moderation.js";

export const commands: Command[] = [
  ...generalCommands,
  ...communityCommands,
  ...moderationCommands,
  ...configurationCommands,
  ...extraCommands,
  ...gameCommands,
  ...giveawayCommands,
  ...voiceCommands,
  ...reactionRoleCommands,
];
