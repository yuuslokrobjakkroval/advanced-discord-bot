import type { Client, TextChannel } from "discord.js";
import type { Database } from "../database.js";

export function startReminderWorker(client: Client, db: Database): NodeJS.Timeout {
  return setInterval(async () => {
    const reminders = await db.reminders.find({ delivered: false, dueAt: { $lte: new Date() } }).limit(50).toArray();
    for (const reminder of reminders) {
      const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({
          content: `<@${reminder.userId}> ⏰ **Reminder:** ${reminder.text}`,
          allowedMentions: { users: [reminder.userId] },
        }).catch(() => undefined);
      }
      await db.reminders.updateOne({ _id: reminder._id }, { $set: { delivered: true } });
    }
  }, 15_000);
}
