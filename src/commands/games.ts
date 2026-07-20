import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { colors, embed } from "../utils.js";

const rpsChoices = ["rock", "paper", "scissors"] as const;
const emoji: Record<string, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const words = ["discord", "mongodb", "typescript", "component", "giveaway", "community"];
const pokemon = ["pikachu", "charizard", "bulbasaur", "squirtle", "eevee", "gengar"];
const hangman = new Map<string, { word: string; guessed: Set<string>; misses: number }>();
const wordle = new Map<string, { word: string; attempts: number }>();
const connect4 = new Map<string, number[][]>();
const tictactoe = new Map<string, string[]>();
const mines = new Map<string, Set<number>>();
const boards2048 = new Map<string, number[]>();
const snake = new Map<string, { x: number; y: number; foodX: number; foodY: number; score: number }>();
const key = (guildId: string | null, userId: string) => `${guildId}:${userId}`;
const random = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;

function board2048(cells: number[]): string {
  return cells.map((cell, index) => `${cell ? String(cell).padStart(4) : "   ·"}${index % 4 === 3 ? "\n" : " "}`).join("");
}

function move2048(cells: number[], direction: string): number[] {
  const result = [...cells];
  const lines = direction === "left" || direction === "right"
    ? [0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) => row * 4 + col))
    : [0, 1, 2, 3].map((col) => [0, 1, 2, 3].map((row) => row * 4 + col));
  if (direction === "right" || direction === "down") lines.forEach((line) => line.reverse());
  for (const line of lines) {
    const values = line.map((index) => result[index]!).filter(Boolean);
    for (let i = 0; i < values.length - 1; i++) if (values[i] === values[i + 1]) {
      values[i]! *= 2; values.splice(i + 1, 1);
    }
    while (values.length < 4) values.push(0);
    line.forEach((index, i) => { result[index] = values[i]!; });
  }
  const empty = result.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
  if (empty.length) result[random(empty)] = Math.random() < 0.9 ? 2 : 4;
  return result;
}

export const gamesCommand: Command = {
  data: new SlashCommandBuilder().setName("games").setDescription("Play community games")
    .addSubcommand((sub) => sub.setName("rps").setDescription("Play rock paper scissors").addStringOption((option) => option.setName("choice").setDescription("Your move").setRequired(true).addChoices(...rpsChoices.map((choice) => ({ name: choice, value: choice })))))
    .addSubcommand((sub) => sub.setName("slots").setDescription("Spin the slot machine"))
    .addSubcommand((sub) => sub.setName("coinflip").setDescription("Flip a coin").addStringOption((option) => option.setName("choice").setDescription("Heads or tails").setRequired(true).addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })))
    .addSubcommand((sub) => sub.setName("dice").setDescription("Roll dice").addIntegerOption((option) => option.setName("sides").setDescription("Number of sides").setMinValue(2).setMaxValue(100).setRequired(true)))
    .addSubcommand((sub) => sub.setName("hangman").setDescription("Start or continue Hangman").addStringOption((option) => option.setName("letter").setDescription("Guess one letter")))
    .addSubcommand((sub) => sub.setName("wordle").setDescription("Start or continue Wordle").addStringOption((option) => option.setName("guess").setDescription("Guess the hidden word")))
    .addSubcommand((sub) => sub.setName("trivia").setDescription("Answer a trivia question").addStringOption((option) => option.setName("answer").setDescription("Your answer")))
    .addSubcommand((sub) => sub.setName("pokemon").setDescription("Guess the Pokémon").addStringOption((option) => option.setName("guess").setDescription("Pokémon name")))
    .addSubcommand((sub) => sub.setName("connect-4").setDescription("Play Connect 4 against the bot").addIntegerOption((option) => option.setName("column").setDescription("Column 1-7").setMinValue(1).setMaxValue(7)))
    .addSubcommand((sub) => sub.setName("tic-tac-toe").setDescription("Play Tic-Tac-Toe against the bot").addIntegerOption((option) => option.setName("square").setDescription("Square 1-9").setMinValue(1).setMaxValue(9)))
    .addSubcommand((sub) => sub.setName("minesweeper").setDescription("Reveal a Minesweeper cell").addIntegerOption((option) => option.setName("cell").setDescription("Cell 1-25").setMinValue(1).setMaxValue(25)))
    .addSubcommand((sub) => sub.setName("2048").setDescription("Play 2048").addStringOption((option) => option.setName("direction").setDescription("Move direction").addChoices({ name: "Up", value: "up" }, { name: "Down", value: "down" }, { name: "Left", value: "left" }, { name: "Right", value: "right" })))
    .addSubcommand((sub) => sub.setName("snake").setDescription("Move the snake").addStringOption((option) => option.setName("direction").setDescription("Move direction").addChoices({ name: "Up", value: "up" }, { name: "Down", value: "down" }, { name: "Left", value: "left" }, { name: "Right", value: "right" }))),
  async execute(interaction) {
    const game = interaction.options.getSubcommand();
    const sessionKey = key(interaction.guildId, interaction.user.id);
    if (game === "rps") {
      const player = interaction.options.getString("choice", true);
      const bot = random(rpsChoices);
      const win = (player === "rock" && bot === "scissors") || (player === "paper" && bot === "rock") || (player === "scissors" && bot === "paper");
      await interaction.reply({ embeds: [embed("Rock Paper Scissors", `You: ${emoji[player]} **${player}**\nBot: ${emoji[bot]} **${bot}**\n\n**${player === bot ? "Draw!" : win ? "You win!" : "Bot wins!"}**`, win ? colors.success : colors.primary)] }); return;
    }
    if (game === "slots") {
      const symbols = ["🍒", "🍋", "🍉", "⭐", "💎"]; const roll = [random(symbols), random(symbols), random(symbols)];
      await interaction.reply({ embeds: [embed("Slot Machine", `# ${roll.join(" │ ")}\n\n${new Set(roll).size === 1 ? "**JACKPOT!**" : new Set(roll).size === 2 ? "**A pair!**" : "Try again."}`)] }); return;
    }
    if (game === "coinflip") {
      const choice = interaction.options.getString("choice", true); const result = Math.random() < 0.5 ? "heads" : "tails";
      await interaction.reply({ embeds: [embed("Coin Flip", `It landed on **${result}**. ${choice === result ? "🎉 You win!" : "You lose."}`)] }); return;
    }
    if (game === "dice") {
      const sides = interaction.options.getInteger("sides", true);
      await interaction.reply({ embeds: [embed(`D${sides} Roll`, `🎲 You rolled **${Math.floor(Math.random() * sides) + 1}**.`)] }); return;
    }
    if (game === "hangman") {
      let state = hangman.get(sessionKey);
      if (!state) { state = { word: random(words), guessed: new Set(), misses: 0 }; hangman.set(sessionKey, state); }
      const letter = interaction.options.getString("letter")?.toLowerCase()[0];
      if (letter && !state.guessed.has(letter)) { state.guessed.add(letter); if (!state.word.includes(letter)) state.misses++; }
      const display = [...state.word].map((char) => state!.guessed.has(char) ? char : "＿").join(" ");
      const won = [...state.word].every((char) => state!.guessed.has(char)); const lost = state.misses >= 6;
      if (won || lost) hangman.delete(sessionKey);
      await interaction.reply({ embeds: [embed("Hangman", `${display}\n\nWrong guesses: **${state.misses}/6**${won ? "\n🎉 You won!" : lost ? `\n💀 The word was **${state.word}**.` : "\nUse `/games hangman letter:x`."}`)] }); return;
    }
    if (game === "wordle") {
      let state = wordle.get(sessionKey); if (!state) { state = { word: random(words), attempts: 0 }; wordle.set(sessionKey, state); }
      const guess = interaction.options.getString("guess")?.toLowerCase();
      if (!guess) { await interaction.reply({ content: `Wordle started: the word has **${state.word.length} letters**.`, ephemeral: true }); return; }
      state.attempts++; const marks = [...guess].map((char, i) => state!.word[i] === char ? "🟩" : state!.word.includes(char) ? "🟨" : "⬛").join("");
      const won = guess === state.word; const lost = state.attempts >= 6; if (won || lost) wordle.delete(sessionKey);
      await interaction.reply({ embeds: [embed("Wordle", `${marks}\n\`${guess}\`\nAttempt **${state.attempts}/6**${won ? "\n🎉 Correct!" : lost ? `\nThe word was **${state.word}**.` : ""}`)] }); return;
    }
    if (game === "trivia") {
      const answer = interaction.options.getString("answer")?.toLowerCase();
      await interaction.reply({ embeds: [embed("Trivia", answer ? `Your answer is **${answer === "typescript" ? "correct" : "incorrect"}**.\nThe answer is **TypeScript**.` : "What language powers this bot?\nUse `/games trivia answer:...`")] }); return;
    }
    if (game === "pokemon") {
      const hidden = random(pokemon); const guess = interaction.options.getString("guess")?.toLowerCase();
      await interaction.reply({ embeds: [embed("Who's That Pokémon?", guess ? `${guess === hidden ? "🎉 Correct!" : "Not this time."} It was **${hidden}**.` : `Hint: **${hidden[0]!.toUpperCase()}${"•".repeat(hidden.length - 1)}**\nSubmit a guess to reveal it.`)] }); return;
    }
    if (game === "connect-4") {
      let board = connect4.get(sessionKey) ?? Array.from({ length: 6 }, () => Array<number>(7).fill(0)); connect4.set(sessionKey, board);
      const column = interaction.options.getInteger("column");
      const drop = (col: number, player: number) => { for (let row = 5; row >= 0; row--) if (!board[row]![col]) { board[row]![col] = player; return true; } return false; };
      if (column) { drop(column - 1, 1); const open = [...Array(7).keys()].filter((col) => board[0]![col] === 0); if (open.length) drop(random(open), 2); }
      await interaction.reply({ embeds: [embed("Connect 4", `${board.map((row) => row.map((cell) => cell === 1 ? "🔴" : cell === 2 ? "🟡" : "⚫").join("")).join("\n")}\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\nUse the column option for your next move.`)] }); return;
    }
    if (game === "tic-tac-toe") {
      const board = tictactoe.get(sessionKey) ?? Array<string>(9).fill("▫️"); tictactoe.set(sessionKey, board);
      const square = interaction.options.getInteger("square"); if (square && board[square - 1] === "▫️") board[square - 1] = "❌";
      const empty = board.map((cell, i) => cell === "▫️" ? i : -1).filter((i) => i >= 0); if (square && empty.length) board[random(empty)] = "⭕";
      await interaction.reply({ embeds: [embed("Tic-Tac-Toe", `${board.slice(0, 3).join("")}\n${board.slice(3, 6).join("")}\n${board.slice(6).join("")}\n\nChoose an empty square from 1–9.`)] }); return;
    }
    if (game === "minesweeper") {
      let bombs = mines.get(sessionKey); if (!bombs) { bombs = new Set<number>(); while (bombs.size < 5) bombs.add(Math.floor(Math.random() * 25)); mines.set(sessionKey, bombs); }
      const cell = interaction.options.getInteger("cell"); const hit = cell ? bombs.has(cell - 1) : false;
      if (hit) mines.delete(sessionKey);
      const grid = Array.from({ length: 25 }, (_, i) => hit ? (bombs!.has(i) ? "💣" : "▫️") : i === (cell ?? 0) - 1 ? "✅" : "⬜").map((v, i) => v + (i % 5 === 4 ? "\n" : "")).join("");
      await interaction.reply({ embeds: [embed("Minesweeper", `${grid}${hit ? "\n💥 Game over!" : "\nChoose a cell from 1–25."}`)] }); return;
    }
    if (game === "2048") {
      let board = boards2048.get(sessionKey) ?? [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
      const direction = interaction.options.getString("direction"); if (direction) board = move2048(board, direction); boards2048.set(sessionKey, board);
      await interaction.reply({ embeds: [embed("2048", `\`\`\`\n${board2048(board)}\`\`\`\nChoose a direction to continue.`)] }); return;
    }
    let state = snake.get(sessionKey) ?? { x: 2, y: 2, foodX: 4, foodY: 4, score: 0 };
    const direction = interaction.options.getString("direction"); if (direction === "up") state.y--; if (direction === "down") state.y++; if (direction === "left") state.x--; if (direction === "right") state.x++;
    const dead = state.x < 0 || state.x > 4 || state.y < 0 || state.y > 4;
    if (state.x === state.foodX && state.y === state.foodY) { state.score++; state.foodX = Math.floor(Math.random() * 5); state.foodY = Math.floor(Math.random() * 5); }
    if (dead) snake.delete(sessionKey); else snake.set(sessionKey, state);
    const grid = Array.from({ length: 25 }, (_, i) => i === state.y * 5 + state.x ? "🐍" : i === state.foodY * 5 + state.foodX ? "🍎" : "⬛").map((v, i) => v + (i % 5 === 4 ? "\n" : "")).join("");
    await interaction.reply({ embeds: [embed("Snake", `${grid}\nScore: **${state.score}**${dead ? "\n💥 You hit the wall!" : ""}`)] });
  },
};

export const gameCommands = [gamesCommand];
