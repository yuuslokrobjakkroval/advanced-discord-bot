import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type ButtonInteraction,
} from "discord.js";
import { ObjectId } from "mongodb";
import type { Database, GameSession } from "../database.js";
import { colors } from "../utils.js";

export function winningPlayer(board: number[], game: GameSession["game"]): number {
  if (game === "tic-tac-toe") {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]!;
    return 0;
  }
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const player = board[row * 7 + col]!;
    if (!player) continue;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      let count = 1;
      for (let step = 1; step < 4; step++) {
        const r = row + dr * step, c = col + dc * step;
        if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r * 7 + c] !== player) break;
        count++;
      }
      if (count === 4) return player;
    }
  }
  return 0;
}

export function multiplayerComponents(session: GameSession) {
  const id = String(session._id);
  const player = session.winnerId ? `<@${session.winnerId}>` : null;
  const heading = session.status === "pending"
    ? `# 🎮 ${session.game === "tic-tac-toe" ? "Tic-Tac-Toe" : "Connect 4"} Challenge\n<@${session.playerOneId}> challenged <@${session.playerTwoId}>.`
    : session.status === "finished"
      ? `# 🏁 Match finished\n${player ? `${player} won the match!` : "The match ended in a draw."}`
      : `# 🎮 ${session.game === "tic-tac-toe" ? "Tic-Tac-Toe" : "Connect 4"}\n<@${session.turnId}>, it is your turn.`;
  const container = new ContainerBuilder().setAccentColor(session.status === "finished" ? colors.success : colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(heading));
  if (session.status === "pending") {
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`mp:${id}:accept`).setLabel("Accept").setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mp:${id}:decline`).setLabel("Decline").setEmoji("✖️").setStyle(ButtonStyle.Danger),
    ));
  } else if (session.game === "tic-tac-toe") {
    for (let row = 0; row < 3; row++) container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...[0,1,2].map((col) => {
        const index = row * 3 + col, value = session.board[index];
        return new ButtonBuilder().setCustomId(`mp:${id}:move:${index}`)
          .setLabel(value === 1 ? "X" : value === 2 ? "O" : "·")
          .setStyle(value === 1 ? ButtonStyle.Danger : value === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(session.status === "finished" || Boolean(value));
      })),
    );
  } else {
    const symbols = session.board.map((value) => value === 1 ? "🔴" : value === 2 ? "🟡" : "⚫");
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      symbols.map((symbol, index) => symbol + (index % 7 === 6 ? "\n" : "")).join(""),
    ));
    if (session.status !== "finished") {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...[0,1,2,3].map((col) =>
          new ButtonBuilder().setCustomId(`mp:${id}:move:${col}`).setLabel(String(col + 1)).setStyle(ButtonStyle.Secondary).setDisabled(Boolean(session.board[col])),
        )),
        new ActionRowBuilder<ButtonBuilder>().addComponents(...[4,5,6].map((col) =>
          new ButtonBuilder().setCustomId(`mp:${id}:move:${col}`).setLabel(String(col + 1)).setStyle(ButtonStyle.Secondary).setDisabled(Boolean(session.board[col])),
        )),
      );
    }
  }
  return [container];
}

export async function handleMultiplayerButton(interaction: ButtonInteraction, db: Database): Promise<boolean> {
  if (!interaction.customId.startsWith("mp:")) return false;
  const [, rawId, action, rawMove] = interaction.customId.split(":");
  if (!rawId || !ObjectId.isValid(rawId)) return true;
  const session = await db.gameSessions.findOne({ _id: new ObjectId(rawId) });
  if (!session || session.status === "finished") {
    await interaction.reply({ content: "This match has expired or already finished.", ephemeral: true });
    return true;
  }
  if (![session.playerOneId, session.playerTwoId].includes(interaction.user.id)) {
    await interaction.reply({ content: "You are not a player in this match.", ephemeral: true });
    return true;
  }
  if (action === "decline") {
    if (interaction.user.id !== session.playerTwoId) { await interaction.reply({ content: "Only the challenged player can decline.", ephemeral: true }); return true; }
    session.status = "finished"; await db.gameSessions.updateOne({ _id: session._id }, { $set: { status: "finished" } });
    await interaction.update({ components: multiplayerComponents(session) }); return true;
  }
  if (action === "accept") {
    if (interaction.user.id !== session.playerTwoId) { await interaction.reply({ content: "Only the challenged player can accept.", ephemeral: true }); return true; }
    session.status = "active"; await db.gameSessions.updateOne({ _id: session._id, status: "pending" }, { $set: { status: "active" } });
    await interaction.update({ components: multiplayerComponents(session) }); return true;
  }
  if (session.status !== "active" || interaction.user.id !== session.turnId) {
    await interaction.reply({ content: "It is not your turn.", ephemeral: true }); return true;
  }
  const move = Number(rawMove);
  const player = interaction.user.id === session.playerOneId ? 1 : 2;
  if (session.game === "tic-tac-toe") {
    if (!Number.isInteger(move) || move < 0 || move > 8 || session.board[move]) {
      await interaction.reply({ content: "That square is unavailable.", ephemeral: true }); return true;
    }
    session.board[move] = player;
  } else {
    if (!Number.isInteger(move) || move < 0 || move > 6) return true;
    let placed = false;
    for (let row = 5; row >= 0; row--) if (!session.board[row * 7 + move]) {
      session.board[row * 7 + move] = player; placed = true; break;
    }
    if (!placed) { await interaction.reply({ content: "That column is full.", ephemeral: true }); return true; }
  }
  const winner = winningPlayer(session.board, session.game);
  const draw = session.board.every(Boolean);
  if (winner || draw) {
    session.status = "finished";
    session.winnerId = winner === 1 ? session.playerOneId : winner === 2 ? session.playerTwoId : undefined;
  } else session.turnId = interaction.user.id === session.playerOneId ? session.playerTwoId : session.playerOneId;
  await db.gameSessions.updateOne({ _id: session._id }, { $set: {
    board: session.board, turnId: session.turnId, status: session.status, winnerId: session.winnerId,
  } });
  await interaction.update({ components: multiplayerComponents(session) });
  return true;
}
