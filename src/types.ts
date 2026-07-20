import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from "discord.js";
import type { Database } from "./database.js";

export interface BotContext {
  client: Client;
  db: Database;
}

export interface Command {
  data: {
    readonly name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, context: BotContext): Promise<void>;
}

export type ComponentInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction;
