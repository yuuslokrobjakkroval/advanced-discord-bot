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
- Reviews, invite statistics, and configurable auto reactions
- Ticket add/remove-user controls
- `/user-info`, `/server-info`, and `/games rps|slots|coinflip|dice`
- MongoDB indexes, environment validation, and graceful shutdown

The repository is an extensible, launch-ready core. Large optional modules such as the
full game suite, giveaways, reaction roles, persistent invite attribution, and
join-to-create voice controls are not represented as completed features.

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

## Initial server setup

1. Invite the bot with the `bot` and `applications.commands` scopes.
2. Put its role above roles it needs to moderate.
3. Run `/setup` to select log, welcome, leave, ticket category, and support role.
4. Run `/automod status`, then customize the blocked-word list.
5. Run `/ticket panel` in the channel where members should open tickets.

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
- `/review submit|list`, `/invites`, `/auto-react set|remove`
- `/user-info`, `/server-info`
- `/games rps|slots|coinflip|dice`

Never commit `.env`. Restrict the bot to only the Discord and MongoDB permissions it
needs. Commands live in `src/commands`, events in `src/events`, and recurring workers
in `src/services`.
