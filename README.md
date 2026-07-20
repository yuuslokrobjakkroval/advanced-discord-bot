# Advanced Multi-Purpose Discord Bot

A modular Discord bot foundation built with Bun, TypeScript, MongoDB, slash commands,
and Discord Components v2.

## Included

- Advanced automod: spam, mass mentions, blocked words, and mass emoji protection
- Moderation: ban, kick, timeout, warn, purge, slow mode, and warning history
- Community: AFK, polls, reminders, autoresponders, XP levels, and leaderboard
- Configurable embed-based welcome and goodbye messages
- Button-based private tickets with support roles and text transcripts
- Automod, join/leave, and ticket transcript logging
- Message edit and deletion logging
- Components v2 help and ticket panels
- Persistent Components v2 giveaways with entry buttons, automatic ending, manual ending, and rerolls
- Join-to-create voice rooms with automatic creation and cleanup
- Components v2 voice panel with lock, unlock, rename, and delete actions
- Voice limits, permit/reject, disconnect, and ownership transfer controls
- Persistent Components v2 reaction-role panels with select menus
- Role hierarchy, managed-role, duplicate, and option-limit validation
- Persistent invite snapshots and join-to-inviter attribution
- Invite leaderboards, leave/fake tracking, bonuses, resets, and attribution logs
- Persistent button-controlled Tic-Tac-Toe and Connect 4 multiplayer
- Per-command cooldowns, component burst limits, and escalating anti-abuse penalties
- Native Components v2 onboarding, invite, automod, level, and message logs
- Automated game-logic and rate-limit tests
- Multi-stage Bun Docker image, MongoDB Compose stack, and health endpoint
- Reviews, invite statistics, and configurable auto reactions
- Ticket add/remove-user controls
- `/user-info`, `/server-info`, and an expanded stateful arcade
- MongoDB indexes, environment validation, and graceful shutdown

The repository is an extensible, launch-ready core. Production-grade multiplayer game
matchmaking and some Discord edge cases such as exact vanity-URL attribution remain
future modules.

## Requirements

- [Bun](https://bun.sh/) 1.1 or newer
- MongoDB 7+ (local MongoDB or MongoDB Atlas)
- A Discord application and bot token
- `Server Members Intent` and `Message Content Intent` enabled in the Developer Portal

## Launch

```powershell
bun install
Copy-Item .env.example .env
```

Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `MONGODB_URI`. During development,
set `DISCORD_GUILD_ID` so command updates appear immediately.

```powershell
bun run deploy
bun run dev
```

Production:

```powershell
bun run typecheck
bun start
```

Validation:

```powershell
bun run typecheck
bun run test
bun run validate:live
```

`validate:live` performs a MongoDB ping and a read-only Discord REST identity check.

## Docker

```powershell
docker compose up -d --build
docker compose ps
```

Compose starts the bot and MongoDB 7 with persistent database storage. The bot exposes
`GET /health` on `127.0.0.1:3000` and the container health check waits for Discord
gateway readiness.

## Initial server setup

1. Invite the bot with the `bot` and `applications.commands` scopes.
2. Put its role above roles it needs to moderate.
3. Run `/setup` to select log, welcome, leave, ticket category, and support role.
4. Run `/automod status`, then customize the blocked-word list.
5. Run `/ticket panel` in the channel where members should open tickets.
6. Run `/voice setup` to create the join-to-create lobby and voice category.

## Commands

- `/help`, `/ping`, `/poll`, `/remind`
- `/afk`, `/rank`, `/leaderboard`
- `/moderation ban|kick|mute|unmute|warn`, `/warnings`
- `/purge`, `/slowmode`
- `/automod status|toggle|badword-add|badword-remove`
- `/autoresponder add|remove|list`
- `/setup`
- `/ticket panel`
- `/ticket add-user|remove-user`
- `/review submit|list`, `/auto-react set|remove`
- `/user-info`, `/server-info`
- `/games rps|slots|coinflip|dice`
- `/games 2048|connect-4|hangman|minesweeper|pokemon|snake|trivia|wordle|tic-tac-toe`
- `/giveaway create|end|reroll`
- `/voice setup|rename|limit|lock|unlock|permit|reject|transfer`
- `/reaction-role create|add|remove|refresh|delete|list`
- `/invites user|leaderboard|add|remove|reset|config`
- `/multiplayer challenge|resign`

Never commit `.env`. Restrict the bot to only the Discord and MongoDB permissions it
needs. Commands live in `src/commands`, events in `src/events`, and recurring workers
in `src/services`.
