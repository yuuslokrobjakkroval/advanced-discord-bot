import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { inviteStats, syncGuildInvites } from "../services/invites.js";
import { colors, componentsV2, requirePermission } from "../utils.js";

export const invitesCommand: Command = {
  data: new SlashCommandBuilder().setName("invites").setDescription("Persistent invite attribution and statistics")
    .addSubcommand((sub) => sub.setName("user").setDescription("View a member's invite statistics")
      .addUserOption((option) => option.setName("member").setDescription("Inviter to inspect")))
    .addSubcommand((sub) => sub.setName("leaderboard").setDescription("View the invite leaderboard"))
    .addSubcommand((sub) => sub.setName("add").setDescription("Add bonus invites")
      .addUserOption((option) => option.setName("member").setDescription("Member").setRequired(true))
      .addIntegerOption((option) => option.setName("amount").setDescription("Bonus amount").setRequired(true).setMinValue(1).setMaxValue(10000)))
    .addSubcommand((sub) => sub.setName("remove").setDescription("Remove bonus invites")
      .addUserOption((option) => option.setName("member").setDescription("Member").setRequired(true))
      .addIntegerOption((option) => option.setName("amount").setDescription("Amount to remove").setRequired(true).setMinValue(1).setMaxValue(10000)))
    .addSubcommand((sub) => sub.setName("reset").setDescription("Reset invite data for a member or the server")
      .addUserOption((option) => option.setName("member").setDescription("Omit to reset the whole server")))
    .addSubcommand((sub) => sub.setName("config").setDescription("Configure invite attribution")
      .addChannelOption((option) => option.setName("log-channel").setDescription("Invite log channel").addChannelTypes(ChannelType.GuildText))
      .addIntegerOption((option) => option.setName("fake-days").setDescription("Accounts younger than this are fake").setMinValue(0).setMaxValue(90))),
  async execute(interaction, { db }) {
    const sub = interaction.options.getSubcommand();
    if (sub === "user") {
      const user = interaction.options.getUser("member") ?? interaction.user;
      const stats = await inviteStats(db, interaction.guildId!, user.id);
      await interaction.reply(componentsV2(`Invites · ${user.username}`, [
        `**Total:** ${stats.total}`,
        `**Valid active:** ${stats.valid}`,
        `**Left:** ${stats.left}`,
        `**Fake/suspicious:** ${stats.fake}`,
        `**Bonus:** ${stats.bonus}`,
      ].join("\n")));
      return;
    }
    if (sub === "leaderboard") {
      const joined = await db.inviteAttributions.aggregate<{ _id: string; count: number }>([
        { $match: { guildId: interaction.guildId!, fake: false, leftAt: { $exists: false }, inviterId: { $exists: true } } },
        { $group: { _id: "$inviterId", count: { $sum: 1 } } },
      ]).toArray();
      const bonuses = await db.inviteBonuses.find({ guildId: interaction.guildId! }).toArray();
      const totals = new Map<string, number>();
      joined.forEach((row) => totals.set(row._id, row.count));
      bonuses.forEach((row) => totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.bonus));
      const rows = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const body = rows.length ? rows.map(([id, total], index) => `**${index + 1}.** <@${id}> — **${total}** invites`).join("\n") : "No attributed invites yet.";
      await interaction.reply(componentsV2("Invite leaderboard", body));
      return;
    }

    if (!await requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;
    if (sub === "config") {
      await db.ensureGuild(interaction.guildId!);
      const channel = interaction.options.getChannel("log-channel");
      const days = interaction.options.getInteger("fake-days");
      const values = {
        inviteLogChannelId: channel?.id,
        inviteFakeAccountDays: days ?? undefined,
      };
      const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
      if (!Object.keys(updates).length) {
        await interaction.reply(componentsV2("Invite configuration", "Provide a log channel or fake-account age.", colors.warning, true));
        return;
      }
      await db.guilds.updateOne({ guildId: interaction.guildId! }, { $set: updates });
      await syncGuildInvites(interaction.guild!, db);
      await interaction.reply(componentsV2("Invite tracking configured", "Settings saved and the invite cache was refreshed.", colors.success, true));
      return;
    }
    const user = interaction.options.getUser("member");
    if (sub === "add" || sub === "remove") {
      const amount = interaction.options.getInteger("amount", true) * (sub === "add" ? 1 : -1);
      await db.inviteBonuses.updateOne(
        { guildId: interaction.guildId!, userId: user!.id },
        { $inc: { bonus: amount } },
        { upsert: true },
      );
      const stats = await inviteStats(db, interaction.guildId!, user!.id);
      await interaction.reply(componentsV2("Invite bonus updated", `${user} now has **${stats.bonus}** bonus invites and **${stats.total}** total.`, colors.success, true));
      return;
    }
    if (user) {
      await Promise.all([
        db.inviteAttributions.deleteMany({ guildId: interaction.guildId!, inviterId: user.id }),
        db.inviteBonuses.deleteOne({ guildId: interaction.guildId!, userId: user.id }),
      ]);
    } else {
      await Promise.all([
        db.inviteAttributions.deleteMany({ guildId: interaction.guildId! }),
        db.inviteBonuses.deleteMany({ guildId: interaction.guildId! }),
      ]);
    }
    await syncGuildInvites(interaction.guild!, db);
    await interaction.reply(componentsV2("Invite data reset", user ? `Invite data for ${user} was reset.` : "All server invite attribution data was reset.", colors.success, true));
  },
};

export const inviteCommands = [invitesCommand];
