import { MongoClient, type Collection, type Document, type OptionalId } from "mongodb";
import { config } from "./config.js";

export interface GuildConfig extends Document {
  guildId: string;
  logChannelId?: string;
  welcomeChannelId?: string;
  welcomeMessage: string;
  leaveChannelId?: string;
  leaveMessage: string;
  ticketCategoryId?: string;
  ticketSupportRoleId?: string;
  voiceLobbyId?: string;
  voiceCategoryId?: string;
  inviteLogChannelId?: string;
  inviteFakeAccountDays?: number;
  levelChannelId?: string;
  levelEnabled: boolean;
  automodEnabled: boolean;
  antiSpam: boolean;
  antiPing: boolean;
  antiMassEmoji: boolean;
  maxMentions: number;
  badWords: string[];
}

export interface Warning extends Document { guildId: string; userId: string; moderatorId: string; reason: string; createdAt: Date }
export interface Afk extends Document { guildId: string; userId: string; reason: string; since: Date }
export interface Autoresponder extends Document { guildId: string; trigger: string; response: string; exact: boolean }
export interface Level extends Document { guildId: string; userId: string; xp: number; level: number; lastXpAt: Date }
export interface Ticket extends Document { channelId: string; guildId: string; ownerId: string; status: "open" | "closed"; createdAt: Date; closedAt?: Date; transcript?: string }
export interface Reminder extends Document { userId: string; channelId: string; text: string; dueAt: Date; delivered: boolean }
export interface Review extends Document { guildId: string; userId: string; rating: number; text: string; createdAt: Date }
export interface AutoReaction extends Document { guildId: string; channelId: string; emojis: string[] }
export interface Giveaway extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  prize: string;
  winnerCount: number;
  participants: string[];
  endsAt: Date;
  ended: boolean;
  winnerIds?: string[];
}
export interface TempVoice extends Document {
  guildId: string;
  channelId: string;
  ownerId: string;
  createdAt: Date;
}
export interface ReactionRoleOption {
  roleId: string;
  label: string;
  description?: string;
  emoji?: string;
}
export interface ReactionRolePanel extends Document {
  guildId: string;
  channelId: string;
  messageId?: string;
  title: string;
  description: string;
  options: ReactionRoleOption[];
  createdBy: string;
  createdAt: Date;
}
export interface InviteSnapshot extends Document {
  guildId: string;
  code: string;
  uses: number;
  inviterId?: string;
  expiresAt?: Date;
}
export interface InviteAttribution extends Document {
  guildId: string;
  memberId: string;
  inviterId?: string;
  code?: string;
  joinedAt: Date;
  leftAt?: Date;
  fake: boolean;
}
export interface InviteBonus extends Document {
  guildId: string;
  userId: string;
  bonus: number;
}
export interface GameSession extends Document {
  guildId: string;
  channelId: string;
  messageId?: string;
  game: "tic-tac-toe" | "connect-4";
  playerOneId: string;
  playerTwoId: string;
  turnId: string;
  status: "pending" | "active" | "finished";
  board: number[];
  winnerId?: string;
  createdAt: Date;
  expiresAt: Date;
}

const guildDefaults: Omit<GuildConfig, "guildId"> = {
  welcomeMessage: "Welcome {user} to **{server}**!",
  leaveMessage: "**{user}** left the server.",
  levelEnabled: true,
  automodEnabled: true,
  antiSpam: true,
  antiPing: true,
  antiMassEmoji: true,
  maxMentions: 5,
  badWords: [],
};

export class Database {
  private readonly client = new MongoClient(config.MONGODB_URI);
  guilds!: Collection<GuildConfig>;
  warnings!: Collection<Warning>;
  afk!: Collection<Afk>;
  autoresponders!: Collection<Autoresponder>;
  levels!: Collection<Level>;
  tickets!: Collection<Ticket>;
  reminders!: Collection<Reminder>;
  reviews!: Collection<Review>;
  autoReactions!: Collection<AutoReaction>;
  giveaways!: Collection<Giveaway>;
  tempVoices!: Collection<TempVoice>;
  reactionRoles!: Collection<ReactionRolePanel>;
  inviteSnapshots!: Collection<InviteSnapshot>;
  inviteAttributions!: Collection<InviteAttribution>;
  inviteBonuses!: Collection<InviteBonus>;
  gameSessions!: Collection<GameSession>;

  async connect(): Promise<void> {
    await this.client.connect();
    const db = this.client.db(config.MONGODB_DATABASE);
    this.guilds = db.collection("guilds");
    this.warnings = db.collection("warnings");
    this.afk = db.collection("afk");
    this.autoresponders = db.collection("autoresponders");
    this.levels = db.collection("levels");
    this.tickets = db.collection("tickets");
    this.reminders = db.collection("reminders");
    this.reviews = db.collection("reviews");
    this.autoReactions = db.collection("auto_reactions");
    this.giveaways = db.collection("giveaways");
    this.tempVoices = db.collection("temp_voices");
    this.reactionRoles = db.collection("reaction_role_panels");
    this.inviteSnapshots = db.collection("invite_snapshots");
    this.inviteAttributions = db.collection("invite_attributions");
    this.inviteBonuses = db.collection("invite_bonuses");
    this.gameSessions = db.collection("game_sessions");
    await Promise.all([
      this.guilds.createIndex({ guildId: 1 }, { unique: true }),
      this.warnings.createIndex({ guildId: 1, userId: 1, createdAt: -1 }),
      this.afk.createIndex({ guildId: 1, userId: 1 }, { unique: true }),
      this.autoresponders.createIndex({ guildId: 1, trigger: 1 }, { unique: true }),
      this.levels.createIndex({ guildId: 1, userId: 1 }, { unique: true }),
      this.tickets.createIndex({ channelId: 1 }, { unique: true }),
      this.tickets.createIndex({ guildId: 1, ownerId: 1, status: 1 }),
      this.reminders.createIndex({ delivered: 1, dueAt: 1 }),
      this.reviews.createIndex({ guildId: 1, userId: 1 }, { unique: true }),
      this.autoReactions.createIndex({ guildId: 1, channelId: 1 }, { unique: true }),
      this.giveaways.createIndex({ messageId: 1 }, { unique: true }),
      this.giveaways.createIndex({ ended: 1, endsAt: 1 }),
      this.tempVoices.createIndex({ channelId: 1 }, { unique: true }),
      this.tempVoices.createIndex({ guildId: 1, ownerId: 1 }),
      this.reactionRoles.createIndex({ guildId: 1, messageId: 1 }),
      this.inviteSnapshots.createIndex({ guildId: 1, code: 1 }, { unique: true }),
      this.inviteAttributions.createIndex({ guildId: 1, memberId: 1 }, { unique: true }),
      this.inviteAttributions.createIndex({ guildId: 1, inviterId: 1, leftAt: 1, fake: 1 }),
      this.inviteBonuses.createIndex({ guildId: 1, userId: 1 }, { unique: true }),
      this.gameSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.gameSessions.createIndex({ guildId: 1, playerOneId: 1, status: 1 }),
      this.gameSessions.createIndex({ guildId: 1, playerTwoId: 1, status: 1 }),
    ]);
  }

  async ensureGuild(guildId: string): Promise<GuildConfig> {
    await this.guilds.updateOne({ guildId }, { $setOnInsert: { guildId, ...guildDefaults } }, { upsert: true });
    return (await this.guilds.findOne({ guildId }))!;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
