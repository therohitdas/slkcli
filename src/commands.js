/**
 * CLI command implementations.
 */

import { slackApi, slackPaginate } from "./api.js";
import { getCredentials } from "./auth.js";

// ── Helpers ──────────────────────────────────────────────

let userCache = null;

async function getUsers() {
  if (userCache) return userCache;
  const data = await slackPaginate("users.list", {}, "members");
  if (!data.ok) return {};
  userCache = {};
  for (const u of data.members) {
    userCache[u.id] = u.real_name || u.profile?.display_name || u.name;
  }
  return userCache;
}

function userName(users, id) {
  return users[id] || id;
}

async function resolveChannel(nameOrId) {
  if (nameOrId.startsWith("C") || nameOrId.startsWith("D") || nameOrId.startsWith("G")) {
    return nameOrId; // Already an ID
  }
  const name = nameOrId.replace(/^#/, "");
  const data = await slackPaginate("conversations.list", {
    types: "public_channel,private_channel,mpim,im",
  });
  if (!data.ok) throw new Error(`Failed to list channels: ${data.error}`);
  const ch = data.channels.find(
    (c) => c.name === name || c.name_normalized === name
  );
  if (!ch) throw new Error(`Channel not found: ${nameOrId}`);
  return ch.id;
}

function formatTs(ts) {
  return new Date(parseFloat(ts) * 1000).toLocaleString();
}

// ── Commands ─────────────────────────────────────────────

export async function auth() {
  const data = await slackApi("auth.test");
  if (data.ok) {
    console.log(`✅ Authenticated as ${data.user} @ ${data.team}`);
    console.log(`   Team ID: ${data.team_id}`);
    console.log(`   User ID: ${data.user_id}`);
    console.log(`   URL: ${data.url}`);
  } else {
    console.error(`❌ Auth failed: ${data.error}`);
    process.exit(1);
  }
}

export async function channels() {
  const data = await slackPaginate("conversations.list", {
    types: "public_channel,private_channel",
    exclude_archived: true,
  });
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }
  for (const ch of data.channels) {
    const prefix = ch.is_private ? "🔒" : "#";
    const members = ch.num_members || 0;
    console.log(`${prefix} ${ch.name}  (${members} members, id: ${ch.id})`);
  }
}

export async function read(channelRef, count = 20) {
  const channel = await resolveChannel(channelRef);
  const users = await getUsers();
  const data = await slackApi("conversations.history", {
    channel,
    limit: count,
  });
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  const messages = data.messages.reverse();
  for (const msg of messages) {
    const who = userName(users, msg.user);
    const time = formatTs(msg.ts);
    const thread = msg.reply_count ? ` [${msg.reply_count} replies]` : "";
    console.log(`[${time}] ${who}${thread}:`);
    console.log(`  ${msg.text}`);
    if (msg.files?.length) {
      for (const f of msg.files) {
        console.log(`  📎 ${f.name} (${f.mimetype})`);
      }
    }
    console.log();
  }
}

export async function send(channelRef, text) {
  const channel = await resolveChannel(channelRef);
  const data = await slackApi("chat.postMessage", { channel, text });
  if (data.ok) {
    console.log(`✅ Sent to ${channelRef} (ts: ${data.ts})`);
  } else {
    console.error(`❌ Failed: ${data.error}`);
    process.exit(1);
  }
}

export async function search(query, count = 20) {
  const data = await slackApi("search.messages", { query, count });
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  const matches = data.messages?.matches || [];
  console.log(`Found ${data.messages?.total || 0} results\n`);

  const users = await getUsers();
  for (const msg of matches) {
    const who = userName(users, msg.user);
    const time = formatTs(msg.ts);
    const ch = msg.channel?.name || msg.channel?.id || "?";
    console.log(`[${time}] #${ch} — ${who}:`);
    console.log(`  ${msg.text}`);
    console.log();
  }
}

export async function thread(channelRef, ts, count = 50) {
  const channel = await resolveChannel(channelRef);
  const users = await getUsers();
  const data = await slackApi("conversations.replies", {
    channel,
    ts,
    limit: count,
  });
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  for (const msg of data.messages) {
    const who = userName(users, msg.user);
    const time = formatTs(msg.ts);
    console.log(`[${time}] ${who}:`);
    console.log(`  ${msg.text}`);
    console.log();
  }
}

export async function users() {
  const data = await slackPaginate("users.list", {}, "members");
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  for (const u of data.members) {
    if (u.deleted || u.is_bot) continue;
    const name = u.real_name || u.name;
    const display = u.profile?.display_name || "";
    const status = u.profile?.status_text ? ` — ${u.profile.status_text}` : "";
    console.log(`${name}${display ? ` (@${display})` : ""} (${u.id})${status}`);
  }
}

async function getMutedChannels() {
  const prefs = await slackApi("users.prefs.get", {});
  if (!prefs.ok) return new Set();

  const allNotifs = prefs.prefs?.all_notifications_prefs;
  if (!allNotifs) return new Set();

  const parsed = typeof allNotifs === "string" ? JSON.parse(allNotifs) : allNotifs;
  const muted = new Set();
  for (const [chId, chPrefs] of Object.entries(parsed.channels || {})) {
    if (chPrefs.muted) muted.add(chId);
  }
  return muted;
}

export async function activity(unreadOnly = false) {
  const users = await getUsers();

  // Get unread counts + muted channels in parallel
  const [counts, mutedSet] = await Promise.all([
    slackApi("client.counts", {}),
    getMutedChannels(),
  ]);

  if (!counts.ok) {
    console.error(`Error: ${counts.error}`);
    process.exit(1);
  }

  // Build channel name map
  const chData = await slackPaginate("conversations.list", {
    types: "public_channel,private_channel,mpim,im",
    exclude_archived: true,
  });
  const chMap = {};
  if (chData.ok) {
    for (const ch of chData.channels) {
      chMap[ch.id] = ch.name || (ch.user ? `DM:${userName(users, ch.user)}` : ch.id);
    }
  }

  // Merge all conversation types
  const all = [
    ...(counts.channels || []).map((c) => ({ ...c, type: "channel" })),
    ...(counts.mpims || []).map((c) => ({ ...c, type: "group" })),
    ...(counts.ims || []).map((c) => ({ ...c, type: "dm" })),
  ];

  // Threads summary
  if (counts.threads?.has_unreads || counts.threads?.mention_count > 0) {
    console.log(`🧵 Threads — ${counts.threads.mention_count} mentions, unreads: ${counts.threads.has_unreads}`);
    console.log();
  }

  // Filter: unreads only, and exclude muted channels
  let filtered = all;
  if (unreadOnly) {
    filtered = filtered.filter(
      (c) => (c.has_unreads || c.mention_count > 0) && !mutedSet.has(c.id)
    );
  }

  if (filtered.length === 0) {
    console.log(unreadOnly ? "No unreads! 🎉" : "No activity.");
    return;
  }

  for (const ch of filtered) {
    const name = chMap[ch.id] || ch.id;
    const isMuted = mutedSet.has(ch.id);
    const prefix = ch.type === "dm" ? "💬" : ch.type === "group" ? "👥" : "#";
    const mentions = ch.mention_count > 0 ? ` (${ch.mention_count} mentions)` : "";
    const unread = ch.has_unreads ? " •" : "";
    const muted = isMuted ? " 🔇" : "";
    console.log(`${prefix} ${name}${unread}${mentions}${muted}`);
  }
}

export async function starred() {
  const users = await getUsers();

  // Get VIP users from prefs
  const prefs = await slackApi("users.prefs.get", {});
  const vipIds = prefs.ok ? (prefs.prefs?.vip_users || "").split(",").filter(Boolean) : [];

  if (vipIds.length > 0) {
    console.log("👑 VIP Users:");
    for (const uid of vipIds) {
      console.log(`   ${userName(users, uid)} (${uid})`);
    }
    console.log();
  }

  // Build channel name map
  const chData = await slackPaginate("conversations.list", {
    types: "public_channel,private_channel,mpim,im",
    exclude_archived: true,
  });
  const chMap = {};
  if (chData.ok) {
    for (const ch of chData.channels) {
      chMap[ch.id] = ch.name || (ch.user ? `DM:${userName(users, ch.user)}` : ch.id);
    }
  }

  // Get starred items
  const stars = await slackApi("stars.list", { count: 50 });
  if (!stars.ok) {
    console.error(`Error: ${stars.error}`);
    process.exit(1);
  }

  if (stars.items?.length > 0) {
    console.log("⭐ Starred:");
    for (const item of stars.items) {
      if (item.type === "message") {
        const msg = item.message || {};
        const ch = chMap[item.channel] || item.channel;
        const who = userName(users, msg.user);
        console.log(`   #${ch} — ${who}: ${(msg.text || "").substring(0, 100)}`);
      } else if (item.type === "channel") {
        console.log(`   #${chMap[item.channel] || item.channel}`);
      } else if (item.type === "im") {
        console.log(`   💬 ${chMap[item.channel] || item.channel}`);
      } else if (item.type === "file") {
        console.log(`   📎 ${item.file?.name || "?"}`);
      }
    }
  } else {
    console.log("⭐ No starred items.");
  }
}

export async function pins(channelRef) {
  const channel = await resolveChannel(channelRef);
  const users = await getUsers();

  const data = await slackApi("pins.list", { channel });
  if (!data.ok) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  if (!data.items?.length) {
    console.log("No pinned items.");
    return;
  }

  console.log(`📌 ${data.items.length} pinned items:\n`);
  for (const item of data.items) {
    const msg = item.message || {};
    const who = userName(users, msg.user);
    const time = formatTs(msg.ts);
    console.log(`[${time}] ${who}:`);
    console.log(`  ${(msg.text || "").substring(0, 200)}`);
    console.log();
  }
}

export async function react(channelRef, ts, emoji) {
  const channel = await resolveChannel(channelRef);
  const data = await slackApi("reactions.add", {
    channel,
    timestamp: ts,
    name: emoji.replace(/:/g, ""),
  });
  if (data.ok) {
    console.log(`✅ Reacted with :${emoji.replace(/:/g, "")}:`);
  } else {
    console.error(`❌ Failed: ${data.error}`);
    process.exit(1);
  }
}
