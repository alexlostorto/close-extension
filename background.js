const API_KEY = 'YOUR_CLOSE_API_KEY_HERE'; // Settings → API Keys → generate one
const BASE    = 'https://api.close.com/api/v1';
const AUTH    = 'Basic ' + btoa(API_KEY + ':');
const HEADS   = { 'Authorization': AUTH, 'Accept': 'application/json' };

const STALE_MS      = 5000;
const DEFAULT_TZ    = 'Europe/London';

// ── Duplicate-lead GraphQL (runs in service worker so it's visible there) ────
const DUPE_GQL = `query DupeCheck($organizationId:ID!,$q:SortedLimitedSearchQueryInput!){
  organization(id:$organizationId){
    contactsQuery:searchQuery(query:$q){
      ...on ValidatedSearchQuery{
        results(first:10){
          edges{node{...on Contact{id displayName lead{id name}}}}
        }
      }
    }
  }
}`;

function makeDupeVars(orgId, relatedType, fieldName, value) {
  return {
    organizationId: orgId,
    q: {
      query: {
        bool: {
          operator: 'AND',
          queries: [
            {
              bool: {
                operator: 'OR',
                negate: false,
                queries: [{
                  hasRelated: {
                    thisObjectType: 'CONTACT',
                    relatedObjectType: relatedType,
                    negate: false,
                    relatedQuery: {
                      bool: {
                        operator: 'OR',
                        negate: false,
                        queries: [{
                          fieldCondition: {
                            negate: false,
                            field: { regularField: { objectType: relatedType, fieldName } },
                            condition: { text: { mode: 'BEGINNING_OF_WORDS', stringValue: value } },
                          },
                        }],
                      },
                    },
                  },
                }],
              },
            },
            { objectType: { objectType: 'CONTACT' } },
          ],
        },
      },
      sort: [{ field: { regularField: { objectType: 'CONTACT', fieldName: 'date_updated' } }, direction: 'DESC' }],
    },
  };
}

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
  let dials = 0, talkSeconds = 0, convos = 0;
  for (const c of calls) {
    if (c.direction === 'outbound') dials++;
    talkSeconds += c.duration || 0;
    if ((c.duration || 0) >= 300) convos++; // 5 min+ = real conversation
  }
  return { dials, talkSeconds: Math.round(talkSeconds), convos };
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
      convos: mine.convos,
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

// ── WhatsApp batch checker ────────────────────────────────────────────────────
// Injects into the open WhatsApp Web tab and uses its internal webpack modules
// to call queryExist() for each number. Returns an array of booleans (or null
// if the number could not be determined).
async function checkWhatsappBatch(waNumbers) {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (!tabs.length) return waNumbers.map(() => null); // WA Web not open

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: async (jids) => {
        try {
          let queryExist = null;

          // ── Approach 1: window.require (older WA Web) ──────────────────────
          if (typeof window.require === 'function') {
            const knownNames = [
              'WAWebQueryExistingWid',
              'WAWebQueryExist',
              'WAWebPhoneWid',
            ];
            for (const name of knownNames) {
              try {
                const m = window.require(name);
                const fn = m?.queryExist ?? m?.default?.queryExist;
                if (typeof fn === 'function') { queryExist = fn; break; }
              } catch (_) {}
            }
            if (!queryExist) {
              for (const id of Object.keys(window.require.m || {})) {
                try {
                  const m = window.require(id);
                  const fn = m?.queryExist ?? m?.default?.queryExist;
                  if (typeof fn === 'function') { queryExist = fn; break; }
                } catch (_) {}
              }
            }
          }

          // ── Approach 2: webpackChunk global (WA Web 2023+) ─────────────────
          // Modern WA Web no longer exposes window.require; instead it exposes
          // a global webpackChunk array. Push a dummy chunk to grab require().
          if (!queryExist) {
            const chunkKey = Object.keys(window).find(
              k => k.startsWith('webpackChunk') && Array.isArray(window[k])
            );
            if (chunkKey) {
              try {
                let _req = null;
                window[chunkKey].push([
                  ['__st_probe_' + Date.now()],
                  {},
                  (r) => { _req = r; },
                ]);
                if (_req) {
                  for (const id of Object.keys(_req.m || {})) {
                    try {
                      const m = _req(id);
                      const fn = m?.queryExist ?? m?.default?.queryExist;
                      if (typeof fn === 'function') { queryExist = fn; break; }
                    } catch (_) {}
                  }
                }
              } catch (_) {}
            }
          }

          if (!queryExist) return jids.map(() => null);

          // ── Step 2: check each JID ──────────────────────────────────────────
          return Promise.all(jids.map(async jid => {
            try {
              const r = await queryExist(jid);
              if (r === null || r === undefined) return false;
              // Newer WA versions return a numeric status (200 = exists)
              if (typeof r === 'number') return r === 200;
              // Older versions return an object with a .wid property
              return r?.wid != null;
            } catch (_) {
              return null; // network error / indeterminate
            }
          }));

        } catch (_) {
          return jids.map(() => null);
        }
      },
      args: [waNumbers.map(n => `${n}@c.us`)],
    });

    return results?.[0]?.result ?? waNumbers.map(() => null);
  } catch (err) {
    console.warn('WA check failed:', err.message);
    return waNumbers.map(() => null);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'ping') {
    fetchStats().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.action === 'fetch_lead') {
    fetch(`${BASE}/lead/${msg.leadId}/?_fields=contacts`, { headers: HEADS })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.action === 'check_whatsapp_batch') {
    checkWhatsappBatch(msg.waNumbers).then(results => sendResponse({ results }));
    return true;
  }
  if (msg.action === 'check_dupes') {
    (async () => {
      try {
        const me    = await getMe();
        const orgId = (me.organizations || [])[0]?.id;
        if (!orgId) { sendResponse({ ok: false, error: 'no org id' }); return; }
        const vars = makeDupeVars(orgId, msg.relatedType, msg.fieldName, msg.value);
        const r = await fetch(
          'https://app.close.com/api/v1/graphql/?operationName=DupeCheck',
          {
            method: 'POST',
            headers: { ...HEADS, 'Content-Type': 'application/json', 'x-organization-id': orgId },
            body: JSON.stringify({ operationName: 'DupeCheck', variables: vars, query: DUPE_GQL }),
          }
        );
        const d = await r.json();
        if (!r.ok) { sendResponse({ ok: false, error: `HTTP ${r.status}`, raw: d }); return; }
        const contacts = (d?.data?.organization?.contactsQuery?.results?.edges || [])
          .map(e => e.node)
          .filter(n => n?.id && n?.lead?.id);
        sendResponse({ ok: true, contacts });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (msg.action === 'get_org_id') {
    getMe()
      .then(me => sendResponse({ orgId: (me.organizations || [])[0]?.id || null }))
      .catch(() => sendResponse({ orgId: null }));
    return true;
  }
  if (msg.action === 'search_contacts') {
    // Search contacts by phone or email. Include phones+emails so the caller
    // can verify the contact actually has the matched value (not a text false-positive).
    fetch(
      `${BASE}/contact/?query=${encodeURIComponent(msg.query)}&_fields=lead_id,name&_limit=20`,
      { headers: HEADS }
    )
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => sendResponse({ ok: true, data: data.data || [] }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});

fetchStats();
