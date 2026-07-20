import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { multiplayerComponents } from "../services/multiplayer.js";
import { colors, componentsV2 } from "../utils.js";

export const multiplayerCommand: Command = {
  cooldown: 5_000,
  data: new SlashCommandBuilder().setName("multiplayer").setDescription("Play button-controlled games against another member")
    .addSubcommand((sub) => sub.setName("challenge").setDescription("Challenge another player")
      .addUserOption((option) => option.setName("opponent").setDescription("Opponent").setRequired(true))
      .addStringOption((option) => option.setName("game").setDescription("Game").setRequired(true)
        .addChoices({ name: "Tic-Tac-Toe", value: "tic-tac-toe" }, { name: "Connect 4", value: "connect-4" })))
    .addSubcommand((sub) => sub.setName("resign").setDescription("Resign your active match")),
  async execute(interaction, { db }) {
    const sub = interaction.options.getSubcommand();
    if (sub === "resign") {
      const session = await db.gameSessions.findOne({
        guildId: interaction.guildId!, status: { $in: ["pending", "active"] },
        $or: [{ playerOneId: interaction.user.id }, { playerTwoId: interaction.user.id }],
      });
      if (!session) { await interaction.reply(componentsV2("No active match", "You do not have a match to resign.", colors.warning, true)); return; }
      const winnerId = interaction.user.id === session.playerOneId ? session.playerTwoId : session.playerOneId;
      await db.gameSessions.updateOne({ _id: session._id }, { $set: { status: "finished", winnerId } });
      await interaction.reply(componentsV2("Match resigned", `<@${winnerId}> wins by resignation.`, colors.warning));
      return;
    }
    const opponent = interaction.options.getUser("opponent", true);
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply(componentsV2("Invalid opponent", "Challenge another human member.", colors.danger, true)); return;
    }
    const game = interaction.options.getString("game", true) as "tic-tac-toe" | "connect-4";
    const busy = await db.gameSessions.findOne({
      guildId: interaction.guildId!, status: { $in: ["pending", "active"] },
      $or: [
        { playerOneId: { $in: [interaction.user.id, opponent.id] } },
        { playerTwoId: { $in: [interaction.user.id, opponent.id] } },
      ],
    });
    if (busy) { await interaction.reply(componentsV2("Player busy", "One of these players already has an active match.", colors.warning, true)); return; }
    const result = await db.gameSessions.insertOne({
      guildId: interaction.guildId!, channelId: interaction.channelId, game,
      playerOneId: interaction.user.id, playerTwoId: opponent.id, turnId: interaction.user.id,
      status: "pending", board: Array(game === "tic-tac-toe" ? 9 : 42).fill(0),
      createdAt: new Date(), expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    const session = await db.gameSessions.findOne({ _id: result.insertedId });
    const response = await interaction.reply({ components: multiplayerComponents(session!), flags: MessageFlags.IsComponentsV2, withResponse: true });
    const message = response.resource?.message ?? await interaction.fetchReply();
    await db.gameSessions.updateOne({ _id: result.insertedId }, { $set: { messageId: message.id } });
  },
};

export const multiplayerCommands = [multiplayerCommand];
