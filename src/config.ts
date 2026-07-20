import "dotenv/config";
import { z } from "zod";

const discordSecret = (label: string) => z.string().trim().min(1, `${label} is required`)
  .refine((value) => !value.startsWith("replace_with_"), `${label} still contains the .env.example placeholder`);

const schema = z.object({
  DISCORD_TOKEN: discordSecret("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: discordSecret("DISCORD_CLIENT_ID").refine((value) => /^\d{17,20}$/.test(value), "DISCORD_CLIENT_ID must be a Discord snowflake"),
  DISCORD_GUILD_ID: z.string().trim().optional().transform((value) => value || undefined)
    .refine((value) => value === undefined || /^\d{17,20}$/.test(value), "DISCORD_GUILD_ID must be a Discord snowflake"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017"),
  MONGODB_DATABASE: z.string().min(1).default("advanced_discord_bot"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export const config = schema.parse(process.env);
