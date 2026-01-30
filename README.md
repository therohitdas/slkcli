# slk — Slack CLI

Session-based Slack CLI for macOS. Extracts auth from the Slack desktop app automatically — no tokens to copy, no Slack app to install.

## Install

```bash
npm i -g slkcli
```

## Agent Skill

Add to your AI agent (Claude Code, Codex, Moltbot, etc.):

```bash
npx skills add therohitdas/slk
```

Or install via [ClawdHub](https://clawhub.ai).

## How it works

1. Reads the `xoxc-` token from Slack's LevelDB (`Local Storage`)
2. Decrypts the `d` cookie from Slack's SQLite cookie store using the macOS Keychain encryption key
3. Pairs both for authenticated API calls
4. Auto-refreshes if session expires (requires Slack app to be running)

## Usage

```bash
slk auth                              # Test authentication
slk channels                          # List channels
slk read <channel> [count]            # Read recent messages
slk send <channel> <message>          # Send a message
slk search <query> [count]            # Search messages
slk thread <channel> <ts> [count]     # Read a thread
slk users                             # List workspace users
slk react <channel> <ts> <emoji>      # React to a message
slk activity                          # Show all channel activity
slk unread                            # Only channels with unreads (respects mute)
slk starred                           # VIP users + starred items
slk pins <channel>                    # Pinned items in a channel
```

### Drafts (synced to Slack editor)

```bash
slk draft <channel> <message>         # Draft a channel message
slk draft thread <ch> <ts> <message>  # Draft a thread reply
slk draft user <user_id> <message>    # Draft a DM
slk drafts                            # List active drafts
slk draft drop <draft_id>             # Delete a draft
```

Channel can be a name (`ai-coding`) or ID (`C08A8AQ2AFP`).

## Requirements

- macOS (uses Keychain + Electron storage paths)
- Slack desktop app installed and logged in
- Node.js 18+
