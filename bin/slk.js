#!/usr/bin/env node

/**
 * slk — Slack CLI with auto-auth from macOS Slack desktop app.
 */

import * as cmd from "../src/commands.js";
import * as drafts from "../src/drafts.js";

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
slk — Slack CLI (session-based auth, macOS)

Usage:
  slk auth                              Test authentication
  slk channels                          List channels
  slk read <channel> [count]            Read recent messages
  slk send <channel> <message>          Send a message
  slk search <query> [count]            Search messages
  slk thread <channel> <ts> [count]     Read a thread
  slk users                             List workspace users
  slk react <channel> <ts> <emoji>      React to a message
  slk activity                          Show all channel activity
  slk unread                            Show only channels with unreads
  slk starred                           Show VIP users + starred items
  slk pins <channel>                    Show pinned items in a channel

Drafts (synced to Slack):
  slk draft <channel> <message>         Draft a channel message
  slk draft thread <ch> <ts> <message>  Draft a thread reply
  slk draft user <user_id> <message>    Draft a DM
  slk drafts                            List active drafts
  slk draft drop <draft_id>             Delete a draft

Channel can be a name (e.g. "ai-coding") or ID (e.g. "C08A8AQ2AFP").
`;

async function main() {
  try {
    switch (command) {
      case "auth":
        await cmd.auth();
        break;

      case "channels":
      case "ch":
        await cmd.channels();
        break;

      case "read":
      case "r":
        if (!args[1]) { console.error("Usage: slk read <channel> [count]"); process.exit(1); }
        await cmd.read(args[1], parseInt(args[2]) || 20);
        break;

      case "send":
      case "s":
        if (!args[1] || !args[2]) { console.error("Usage: slk send <channel> <message>"); process.exit(1); }
        await cmd.send(args[1], args.slice(2).join(" "));
        break;

      case "search":
        if (!args[1]) { console.error("Usage: slk search <query> [count]"); process.exit(1); }
        await cmd.search(args.slice(1).join(" "), parseInt(args[args.length - 1]) || 20);
        break;

      case "thread":
      case "t":
        if (!args[1] || !args[2]) { console.error("Usage: slk thread <channel> <ts>"); process.exit(1); }
        await cmd.thread(args[1], args[2], parseInt(args[3]) || 50);
        break;

      case "users":
      case "u":
        await cmd.users();
        break;

      case "react":
        if (!args[1] || !args[2] || !args[3]) {
          console.error("Usage: slk react <channel> <ts> <emoji>");
          process.exit(1);
        }
        await cmd.react(args[1], args[2], args[3]);
        break;

      case "activity":
      case "a":
        await cmd.activity(false);
        break;

      case "unread":
      case "ur":
        await cmd.activity(true);
        break;

      case "starred":
      case "star":
        await cmd.starred();
        break;

      case "pins":
      case "pin":
        if (!args[1]) { console.error("Usage: slk pins <channel>"); process.exit(1); }
        await cmd.pins(args[1]);
        break;

      case "drafts":
        await drafts.listDrafts();
        break;

      case "draft": {
        const sub = args[1];
        if (sub === "thread") {
          if (!args[2] || !args[3] || !args[4]) {
            console.error("Usage: slk draft thread <channel> <ts> <message>");
            process.exit(1);
          }
          await drafts.draftThread(args[2], args[3], args.slice(4).join(" "));
        } else if (sub === "user") {
          if (!args[2] || !args[3]) {
            console.error("Usage: slk draft user <user_id> <message>");
            process.exit(1);
          }
          await drafts.draftUser(args[2], args.slice(3).join(" "));
        } else if (sub === "drop") {
          if (!args[2]) { console.error("Usage: slk draft drop <draft_id>"); process.exit(1); }
          await drafts.dropDraft(args[2]);
        } else {
          // slk draft <channel> <message>
          if (!sub || !args[2]) {
            console.error("Usage: slk draft <channel> <message>");
            process.exit(1);
          }
          await drafts.draftChannel(sub, args.slice(2).join(" "));
        }
        break;
      }

      case "help":
      case "-h":
      case "--help":
      case undefined:
        console.log(HELP);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
