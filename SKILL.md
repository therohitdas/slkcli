---
name: slack-personal
description: Read, send, search, and manage Slack messages via the slk CLI. Use when the user asks to check Slack, read channels, send Slack messages, search Slack, check unreads, manage drafts, view saved items, or interact with Slack workspace. Also use for heartbeat Slack checks. Triggers on "check slack", "any slack messages", "send on slack", "slack unreads", "search slack".
homepage: https://www.npmjs.com/package/slkcli
metadata: {"moltbot":{"emoji":"💬","requires":{"bins":["slk"]},"install":[{"id":"npm","kind":"node","package":"slkcli","bins":["slk"],"label":"Install slk (npm)"}],"os":["darwin"]}}
---

# slk — Slack CLI

Session-based Slack CLI for macOS. Auto-authenticates from the Slack desktop app — no tokens or app installs needed.

## Auth

Automatic — extracts session token from Slack desktop app's LevelDB + decrypts cookie from macOS Keychain. Caches in `~/.local/slk/token-cache.json`.

**First run:** macOS Keychain dialog → choose "Always Allow" for convenience.

If auth fails (token rotated):
```bash
rm ~/.local/slk/token-cache.json
slk auth
```

## Commands

```bash
# Auth
slk auth                              # Test authentication

# Read
slk channels                          # List channels (alias: ch)
slk read <channel> [count]            # Read recent messages (alias: r)
slk thread <channel> <ts> [count]     # Read a thread (alias: t)
slk search <query> [count]            # Search messages
slk users                             # List workspace users (alias: u)

# Activity
slk activity                          # All channels with unread indicators (alias: a)
slk unread                            # Only channels with unreads, excludes muted (alias: ur)
slk starred                           # VIP users + starred items (alias: star)
slk saved [count] [--all]             # Saved for later items (alias: sv)
slk pins <channel>                    # Pinned items in a channel (alias: pin)

# Write
slk send <channel> <message>          # Send a message (alias: s)
slk react <channel> <ts> <emoji>      # React to a message

# Drafts (synced to Slack editor)
slk draft <channel> <message>         # Draft a channel message
slk draft thread <ch> <ts> <message>  # Draft a thread reply
slk draft user <user_id> <message>    # Draft a DM
slk drafts                            # List active drafts
slk draft drop <draft_id>             # Delete a draft
```

Channel accepts name (`ai-coding`) or ID (`C08A8AQ2AFP`).

## Heartbeat Usage

Use `slk unread` to get channels with unreads (respects mute). Follow up with `slk read <channel>` for important ones.

## Limitations

- **macOS only** — uses Keychain + Electron storage paths
- **Draft drop** may fail with `draft_has_conflict` if Slack has that conversation open
- **Session token** expires on logout — keep Slack app running
