const API_KEY = 'YOUR_CLOSE_API_KEY_HERE'; // Settings → API Keys → generate one
const BASE    = 'https://api.close.com/api/v1';
const AUTH    = 'Basic ' + btoa(API_KEY + ':');
const HEADS   = { 'Authorization': AUTH, 'Accept': 'application/json' };

const STALE_MS      = 5000;
const DEFAULT_TZ    = 'Europe/London';

let meCache    = null;
let usersCache = null;

async function getMe() {
  if (meCache) return meCache;
  const r = await fetch(`${BASE}/me/`, { headers: HEADS });
  if (!r.ok) throw new Error(`/me/ → ${r.status}`);
  meCache = await r.json();
  return meCache;
}

async function getUsers() {
  if (usersCache) return usersCache;
  usersCache = {};
  let skip = 0;
  while (true) {
    const r = await fetch(
      `${BASE}/user/?_limit=100&_skip=${skip}&_fields=id,first_name,last_name`,
      { headers: HEADS }
    );
    if (!r.ok) throw new Error(`/user/ → ${r.status}`);
    const d = await r.json();
    for (const u of (d.data || [])) {
      usersCache[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    }
    if ((d.data || []).length < 100) break;
    skip += 100;
  }
  return usersCache;
}

async function resolveUnknownUsers(uids, users) {
  await Promise.all(uids.map(async uid => {
    if (users[uid]) return;
    try {
      const r = await fetch(`${BASE}/user/${uid}/`, { headers: HEADS });
      if (!r.ok) return;
      const u = await r.json();
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (name) { users[uid] = name; usersCache[uid] = name; }
    } catch (_) {}
  }));
}

// Returns the UTC ISO string for midnight in the given IANA timezone.
// Probes at noon UTC to safely determine the DST-aware offset.
function midnightInTz(tz) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // "YYYY-MM-DD"

  // Ask: what time does noon UTC look like in the target TZ?
  const probe  = new Date(`${dateStr}T12:00:00Z`);
  const tzTime = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(probe);

  const [h, m]   = tzTime.split(':').map(Number);
  const offsetMs = ((h - 12) * 60 + m) * 60_000; // positive = east of UTC

  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - offsetMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function paginate(urlBase) {
  const results = [];
  let skip = 0;
  while (true) {
    const r = await fetch(`${urlBase}&_limit=100&_skip=${skip}`, { headers: HEADS });
    if (!r.ok) throw new Error(`${urlBase} → ${r.status}`);
    const page = await r.json();
    const data = page.data || [];
    results.push(...data);
    if (data.length < 100) break;
    skip += 100;
  }
  return results;
}

async function fetchMyCalls(userId, since) {
  const calls = await paginate(
    `${BASE}/activity/call/?user_id=${userId}&date_created__gt=${since}&_fields=duration,direction`
  );
  let dials = 0, talkSeconds = 0;
  for (const c of calls) {
    if (c.direction === 'outbound') dials++;
    talkSeconds += c.duration || 0;
  }
  return { dials, talkSeconds: Math.round(talkSeconds) };
}

async function fetchTeamDialCounts(since) {
  const calls = await paginate(
    `${BASE}/activity/call/?direction=outbound&date_created__gt=${since}&_fields=user_id`
  );
  const counts = {};
  for (const c of calls) {
    if (c.user_id) counts[c.user_id] = (counts[c.user_id] || 0) + 1;
  }
  return counts;
}

function shortName(full) {
  if (!full) return '?';
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

async function fetchStats() {
  const stored = await chrome.storage.local.get(['updatedAt', 'timezone']);
  if (stored.updatedAt && Date.now() - stored.updatedAt < STALE_MS) return;

  await chrome.storage.local.set({ status: 'loading' });

  try {
    const tz    = stored.timezone || DEFAULT_TZ;
    const me    = await getMe();
    const since = midnightInTz(tz);

    const [mine, teamCounts, users] = await Promise.all([
      fetchMyCalls(me.id, since),
      fetchTeamDialCounts(since),
      getUsers(),
    ]);

    const sorted = Object.entries(teamCounts).sort((a, b) => b[1] - a[1]);
    const top5   = sorted.slice(0, 5);

    const unknownUids = top5.map(([uid]) => uid).filter(uid => !users[uid]);
    if (unknownUids.length) await resolveUnknownUsers(unknownUids, users);

    const leaderboard = top5.map(([uid, count]) => ({
      name: users[uid] || uid, count, isMe: uid === me.id,
    }));

    const [topUid, topDials] = sorted[0] || [null, 0];
    const topIsMe = topUid === me.id;
    const topName = topUid
      ? (topIsMe ? 'You' : shortName(users[topUid] || topUid))
      : null;

    await chrome.storage.local.set({
      status: 'ok', dials: mine.dials, talkSeconds: mine.talkSeconds,
      topName, topDials: topDials || 0, topIsMe, leaderboard,
      updatedAt: Date.now(),
    });

  } catch (err) {
    meCache = null; usersCache = null;
    await chrome.storage.local.set({
      status: 'error', errorMsg: err.message, updatedAt: Date.now(),
    });
  }
}

// When timezone changes, wipe updatedAt and re-fetch immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.timezone) {
    chrome.storage.local.set({ updatedAt: 0 }).then(fetchStats);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'ping') {
    fetchStats().then(() => sendResponse({ ok: true }));
    return true;
  }
});

fetchStats();
