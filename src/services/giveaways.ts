import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type Client,
  type TextChannel,
} from "discord.js";
import type { Database, Giveaway } from "../database.js";
import { colors } from "../utils.js";

export function giveawayComponents(giveaway: Pick<Giveaway, "prize" | "hostId" | "endsAt" | "winnerCount" | "participants" | "ended" | "winnerIds">) {
  const winners = giveaway.winnerIds?.length ? giveaway.winnerIds.map((id) => `<@${id}>`).join(", ") : "No eligible entries";
  const content = giveaway.ended
    ? `# 🎉 Giveaway ended\n## ${giveaway.prize}\n**Winner${giveaway.winnerCount > 1 ? "s" : ""}:** ${winners}\n**Entries:** ${giveaway.participants.length}`
    : `# 🎉 Giveaway\n## ${giveaway.prize}\nHosted by <@${giveaway.hostId}>\nEnds <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R> · **${giveaway.winnerCount} winner(s)**\n**${giveaway.participants.length} entries**`;
  const container = new ContainerBuilder().setAccentColor(giveaway.ended ? colors.success : colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  if (!giveaway.ended) container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("giveaway:join").setLabel("Enter Giveaway").setEmoji("🎉").setStyle(ButtonStyle.Success),
    ),
  );
  return [container];
}

export async function finishGiveaway(client: Client, db: Database, giveaway: Giveaway): Promise<string[]> {
  if (giveaway.ended) return giveaway.winnerIds ?? [];
  const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
  const winnerIds = shuffled.slice(0, giveaway.winnerCount);
  await db.giveaways.updateOne({ _id: giveaway._id, ended: false }, { $set: { ended: true, winnerIds } });
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    const message = await (channel as TextChannel).messages.fetch(giveaway.messageId).catch(() => null);
    const ended = { ...giveaway, ended: true, winnerIds };
    await message?.edit({ components: giveawayComponents(ended), flags: MessageFlags.IsComponentsV2 }).catch(() => undefined);
    await (channel as TextChannel).send(winnerIds.length
      ? `Congratulations ${winnerIds.map((id) => `<@${id}>`).join(", ")}! You won **${giveaway.prize}**.`
      : `The giveaway for **${giveaway.prize}** ended without eligible entries.`,
    ).catch(() => undefined);
  }
  return winnerIds;
}

export function startGiveawayWorker(client: Client, db: Database): NodeJS.Timeout {
  return setInterval(async () => {
    const due = await db.giveaways.find({ ended: false, endsAt: { $lte: new Date() } }).limit(25).toArray();
    for (const giveaway of due) await finishGiveaway(client, db, giveaway);
  }, 15_000);
}
