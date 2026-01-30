# slk — session-based Slack CLI for macOS

`slk` is a fast Slack CLI that extracts auth from the Slack desktop app automatically. Read messages, send messages, search, manage drafts, and track unread activity — all from your terminal.

Built for agents and humans. Zero dependencies. Zero config.

> **Disclaimer:** This project is **not affiliated with, endorsed by, or associated with Slack Technologies or Salesforce**. It is an independent CLI tool built for personal productivity and agent automation, and works only on macOS.

## Install

```bash
npm install -g slkcli
```

One-shot (no install):

```bash
npx slkcli auth
```

**Requirements:** macOS, Slack desktop app (installed and logged in), Node.js 18+.

## Quickstart

```bash
# Verify your session works
slk auth

# List channels
slk channels

# Read the last 20 messages in a channel
slk read general
slk read C08A8AQ2AFP        # by channel ID

# Send a message
slk send general "Hello from slk"

# Search across the workspace
slk search "deployment failed"

# Check what's unread
slk unread

# Read a thread
slk thread general 1234567890.123456

# React to a message
slk react general 1234567890.123456 thumbsup
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `slk auth` | | Test authentication, show user/team info |
| `slk channels` | `ch` | List all channels with member counts |
| `slk users` | `u` | List workspace users with statuses |
| `slk read <channel> [count]` | `r` | Read recent messages (default: 20) |
| `slk send <channel> <message>` | `s` | Send a message to a channel |
| `slk search <query> [count]` | | Search messages across the workspace |
| `slk thread <channel> <ts> [count]` | `t` | Read thread replies (default: 50) |
| `slk react <channel> <ts> <emoji>` | | Add an emoji reaction to a message |
| `slk activity` | `a` | Show all channel activity with unread/mention counts |
| `slk unread` | `ur` | Show only channels with unreads (excludes muted) |

### Drafts

Drafts sync to Slack — they appear in the Slack editor UI.

| Command | Description |
|---------|-------------|
| `slk draft <channel> <message>` | Draft a channel message |
| `slk draft thread <channel> <ts> <message>` | Draft a thread reply |
| `slk draft user <user_id> <message>` | Draft a DM |
| `slk drafts` | List all active drafts |
| `slk draft drop <draft_id>` | Delete a draft |

### Channel resolution

Channels can be specified by **name** or **ID** in any command:

```bash
slk read general           # by name
slk read ai-coding         # by name
slk read C08A8AQ2AFP       # by ID
```

## Authentication

`slk` uses the credentials already stored by the Slack desktop app. No OAuth flows, no manual token management.

### How it works

1. **Cookie decryption** — Reads the encrypted `d` cookie from Slack's SQLite cookie store (`~/Library/Application Support/Slack/Cookies`). Decrypts it using the "Slack Safe Storage" key from the macOS Keychain via PBKDF2 + AES-128-CBC.

2. **Token extraction** — Scans Slack's LevelDB storage (`~/Library/Application Support/Slack/Local Storage/leveldb/`) for `xoxc-` session tokens. Uses both direct regex scanning and a Python fallback for Snappy-compressed entries.

3. **Validation** — Tests each candidate token against `auth.test` with the decrypted cookie. The first valid pair is used.

4. **Auto-refresh** — On `invalid_auth`, credentials are re-extracted and the request is retried once automatically.

### Token caching

Validated tokens are cached to avoid re-extracting on every invocation:

| | |
|---|---|
| **Cache file** | `~/.local/slk/token-cache.json` |
| **Format** | `{ "token": "xoxc-...", "ts": 1706000000000 }` |
| **Behavior** | Load cache → validate with Slack API → use if valid, otherwise re-extract from LevelDB |
| **In-memory** | Within a single process, credentials are cached in memory after first load |

### Credential resolution order

```
1. In-memory cache (same process)
2. Disk cache (~/.local/slk/token-cache.json) → validate → use if ok
3. Fresh extraction from Slack desktop app → validate → cache → use
```

### What it reads from your system

| Data | Source | Purpose |
|------|--------|---------|
| Keychain password | `security find-generic-password -s "Slack Safe Storage"` | Derive AES key for cookie decryption |
| Encrypted cookie | `~/Library/Application Support/Slack/Cookies` (SQLite) | Decrypt the `d` session cookie (`xoxd-`) |
| Session token | `~/Library/Application Support/Slack/Local Storage/leveldb/` | Extract `xoxc-` token |

## Agent usage patterns

`slk` is designed to be used by AI agents. Common patterns:

```bash
# Check auth before doing anything
slk auth

# Get channel list, find the right one
slk channels

# Read recent context from a channel
slk read engineering 50

# Search for something specific
slk search "PR review needed"

# Check what needs attention
slk unread

# Send a message
slk send engineering "Build passed on main"

# Read a thread for full context
slk thread engineering 1706000000.000000

# Draft a message for human review (appears in Slack UI)
slk draft engineering "Here's the summary of today's standup..."
```

**Exit codes:** `0` on success, `1` on error. Errors are printed to stderr.

## How it was installed

The `bin` field in `package.json` maps `slk` to `./bin/slk.js`:

```json
{ "bin": { "slk": "./bin/slk.js" } }
```

Running `npm install -g` creates a symlink in your PATH:

```
/opt/homebrew/bin/slk -> ../lib/node_modules/slkcli/bin/slk.js
```

## Development

```bash
git clone https://github.com/therohitdas/slk.git
cd slk
node bin/slk.js auth       # run directly
npm link                   # symlink globally for development
```

## Notes

- **macOS only** — uses Keychain and Electron storage paths specific to macOS.
- **Slack desktop app required** — must be installed and logged in. The app does not need to be running for cached tokens.
- **Zero dependencies** — uses only Node.js built-in modules (`crypto`, `fs`, `child_process`, `fetch`).
- **Session-based** — uses `xoxc-` tokens (user session), not bot tokens. This means you act as yourself.
- **Mute-aware** — `activity` and `unread` commands respect your mute settings.
