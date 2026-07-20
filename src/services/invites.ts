import type { Client, Guild, GuildMember, Invite, PartialGuildMember, TextChannel } from "discord.js";
import type { Database } from "../database.js";
import { colors, embed } from "../utils.js";

export async function syncGuildInvites(guild: Guild, db: Database): Promise<void> {
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return;
  const codes = [...invites.keys()];
  if (codes.length) {
    await db.inviteSnapshots.bulkWrite(invites.map((invite) => ({
      updateOne: {
        filter: { guildId: guild.id, code: invite.code },
        update: { $set: {
          uses: invite.uses ?? 0,
          inviterId: invite.inviterId ?? undefined,
          expiresAt: invite.expiresTimestamp ? new Date(invite.expiresTimestamp) : undefined,
        }, $setOnInsert: { guildId: guild.id, code: invite.code } },
        upsert: true,
      },
    })));
    await db.inviteSnapshots.deleteMany({ guildId: guild.id, code: { $nin: codes } });
  } else {
    await db.inviteSnapshots.deleteMany({ guildId: guild.id });
  }
}

export async function primeInviteCache(client: Client, db: Database): Promise<void> {
  for (const guild of client.guilds.cache.values()) await syncGuildInvites(guild, db);
}

export async function attributeMemberJoin(member: GuildMember, db: Database): Promise<void> {
  const before = await db.inviteSnapshots.find({ guildId: member.guild.id }).toArray();
  const current = await member.guild.invites.fetch().catch(() => null);
  const used = current
    ? [...current.values()]
      .filter((invite) => (invite.uses ?? 0) > (before.find((old) => old.code === invite.code)?.uses ?? 0))
      .sort((a, b) => ((b.uses ?? 0) - (before.find((old) => old.code === b.code)?.uses ?? 0))
        - ((a.uses ?? 0) - (before.find((old) => old.code === a.code)?.uses ?? 0)))[0]
    : undefined;
  const cfg = await db.ensureGuild(member.guild.id);
  const minimumAge = (cfg.inviteFakeAccountDays ?? 7) * 86_400_000;
  const fake = Date.now() - member.user.createdTimestamp < minimumAge;
  await db.inviteAttributions.updateOne(
    { guildId: member.guild.id, memberId: member.id },
    { $set: {
      inviterId: used?.inviterId ?? undefined,
      code: used?.code,
      joinedAt: new Date(),
      fake,
    }, $unset: { leftAt: "" } },
    { upsert: true },
  );
  await syncGuildInvites(member.guild, db);
  await sendInviteLog(member, db, used, fake);
}

export async function attributeMemberLeave(member: GuildMember | PartialGuildMember, db: Database): Promise<void> {
  await db.inviteAttributions.updateOne(
    { guildId: member.guild.id, memberId: member.id },
    { $set: { leftAt: new Date() } },
  );
}

async function sendInviteLog(member: GuildMember, db: Database, invite: Invite | undefined, fake: boolean): Promise<void> {
  const cfg = await db.ensureGuild(member.guild.id);
  const channelId = cfg.inviteLogChannelId ?? cfg.logChannelId;
  const channel = channelId ? member.guild.channels.cache.get(channelId) : null;
  if (!channel?.isTextBased()) return;
  const inviter = invite?.inviterId ? `<@${invite.inviterId}>` : "**Unknown** (vanity URL, missing permission, or concurrent join)";
  await (channel as TextChannel).send({ embeds: [embed(
    "Invite attribution",
    `${member} joined using ${invite ? `\`${invite.code}\`` : "an unknown invite"}.\n**Inviter:** ${inviter}\n**Account classification:** ${fake ? "⚠️ Fake/suspicious" : "✅ Valid"}`,
    fake ? colors.warning : colors.success,
  )] }).catch(() => undefined);
}

export async function inviteStats(db: Database, guildId: string, userId: string) {
  const [valid, left, fake, bonus] = await Promise.all([
    db.inviteAttributions.countDocuments({ guildId, inviterId: userId, fake: false, leftAt: { $exists: false } }),
    db.inviteAttributions.countDocuments({ guildId, inviterId: userId, leftAt: { $exists: true } }),
    db.inviteAttributions.countDocuments({ guildId, inviterId: userId, fake: true }),
    db.inviteBonuses.findOne({ guildId, userId }),
  ]);
  return { valid, left, fake, bonus: bonus?.bonus ?? 0, total: valid + (bonus?.bonus ?? 0) };
}
