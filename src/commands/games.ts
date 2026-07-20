import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types.js";
import { colors, embed } from "../utils.js";

const rpsChoices = ["rock", "paper", "scissors"] as const;
const emoji: Record<string, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };

export const gamesCommand: Command = {
  data: new SlashCommandBuilder().setName("games").setDescription("Play community games")
    .addSubcommand((sub) => sub.setName("rps").setDescription("Play rock paper scissors")
      .addStringOption((option) => option.setName("choice").setDescription("Your move").setRequired(true)
        .addChoices(...rpsChoices.map((choice) => ({ name: choice, value: choice })))))
    .addSubcommand((sub) => sub.setName("slots").setDescription("Spin the slot machine"))
    .addSubcommand((sub) => sub.setName("coinflip").setDescription("Flip a coin")
      .addStringOption((option) => option.setName("choice").setDescription("Heads or tails").setRequired(true)
        .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })))
    .addSubcommand((sub) => sub.setName("dice").setDescription("Roll dice")
      .addIntegerOption((option) => option.setName("sides").setDescription("Number of sides").setMinValue(2).setMaxValue(100).setRequired(true))),
  async execute(interaction) {
    const game = interaction.options.getSubcommand();
    if (game === "rps") {
      const player = interaction.options.getString("choice", true);
      const bot = rpsChoices[Math.floor(Math.random() * rpsChoices.length)]!;
      const win = (player === "rock" && bot === "scissors") || (player === "paper" && bot === "rock") || (player === "scissors" && bot === "paper");
      const result = player === bot ? "It's a draw!" : win ? "You win!" : "I win!";
      await interaction.reply({ embeds: [embed("Rock Paper Scissors", `You: ${emoji[player]} **${player}**\nBot: ${emoji[bot]} **${bot}**\n\n**${result}**`, win ? colors.success : player === bot ? colors.warning : colors.danger)] });
      return;
    }
    if (game === "slots") {
      const symbols = ["🍒", "🍋", "🍉", "⭐", "💎"];
      const roll = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]!);
      const jackpot = new Set(roll).size === 1;
      const pair = new Set(roll).size === 2;
      await interaction.reply({ embeds: [embed("Slot Machine", `# ${roll.join(" │ ")}\n\n${jackpot ? "**JACKPOT!**" : pair ? "**You found a pair!**" : "Better luck next time."}`, jackpot ? colors.success : colors.primary)] });
      return;
    }
    if (game === "coinflip") {
      const choice = interaction.options.getString("choice", true);
      const result = Math.random() < 0.5 ? "heads" : "tails";
      await interaction.reply({ embeds: [embed("Coin Flip", `The coin landed on **${result}**.\n${choice === result ? "🎉 You guessed correctly!" : "You missed this time."}`)] });
      return;
    }
    const sides = interaction.options.getInteger("sides", true);
    await interaction.reply({ embeds: [embed(`D${sides} Roll`, `🎲 You rolled **${Math.floor(Math.random() * sides) + 1}**.`)] });
  },
};

export const gameCommands = [gamesCommand];
