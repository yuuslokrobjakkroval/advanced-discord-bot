import type { Command } from "../types.js";
import { communityCommands } from "./community.js";
import { configurationCommands } from "./configuration.js";
import { generalCommands } from "./general.js";
import { extraCommands } from "./extras.js";
import { gameCommands } from "./games.js";
import { moderationCommands } from "./moderation.js";

export const commands: Command[] = [
  ...generalCommands,
  ...communityCommands,
  ...moderationCommands,
  ...configurationCommands,
  ...extraCommands,
  ...gameCommands,
];
