if (!document.getElementById('st-bar')) {
  (function () {
    const POLL_MS    = 7000;
    const TALL       = 46;
    const SHORT      = 30;
    const DEFAULT_TZ = 'Europe/London';

    const TZ_OPTIONS = [
      { value: 'Europe/London',      label: '🇬🇧 UK' },
      { value: 'UTC',                label: 'UTC' },
      { value: 'America/New_York',   label: '🇺🇸 New York' },
      { value: 'America/Los_Angeles',label: '🇺🇸 Los Angeles' },
      { value: 'America/Toronto',    label: '🇨🇦 Toronto' },
      { value: 'Asia/Dubai',         label: '🇦🇪 Dubai' },
      { value: 'Asia/Karachi',       label: '🇵🇰 Pakistan' },
      { value: 'Africa/Cairo',       label: '🇪🇬 Egypt' },
      { value: 'Australia/Sydney',   label: '🇦🇺 Sydney' },
      { value: 'Asia/Tokyo',         label: '🇯🇵 Japan' },
    ];

    // ── DOM ────────────────────────────────────────────────────────────────────
    const bar = document.createElement('div');
    bar.id = 'st-bar';
    bar.innerHTML = `
      <div id="st-full">
        <div class="st-brand">CLOSE CRM</div>
        <div class="st-sep"></div>

        <div class="st-group">
          <span class="st-label">My Dials</span>
          <span id="st-dials" class="st-num st-blue">—</span>
        </div>

        <div class="st-sep"></div>

        <div class="st-group">
          <span class="st-label">Total Talk</span>
          <span id="st-time" class="st-num st-green">—</span>
        </div>

        <div class="st-sep"></div>

        <div class="st-group" id="st-top-group">
          <span class="st-trophy">🏆</span>
          <span id="st-top-name" class="st-top-name">—</span>
          <span id="st-top-dials" class="st-num st-amber">—</span>
        </div>

        <div class="st-spacer"></div>

        <select id="st-tz" class="st-select" title="Timezone for 'today'">
          ${TZ_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>

        <span class="st-live-chip">
          <span class="st-dot" id="st-dot"></span>
          <span id="st-live-lbl">connecting…</span>
        </span>
        <button class="st-btn st-dim" id="st-hide">▲ Hide</button>
      </div>

      <div id="st-mini">
        <span class="st-brand" style="font-size:9px;letter-spacing:1px;">CLOSE</span>
        <span class="st-sep" style="height:14px;"></span>
        <span id="st-mini-dials" class="st-num st-blue" style="font-size:14px;">—</span>
        <span class="st-label">dials</span>
        <span class="st-sep" style="height:14px;"></span>
        <span id="st-mini-time" class="st-num st-green" style="font-size:14px;">—</span>
        <span class="st-sep" style="height:14px;"></span>
        <span style="font-size:13px;">🏆</span>
        <span id="st-mini-top-name" class="st-top-name" style="font-size:11px;">—</span>
        <span id="st-mini-top-dials" class="st-num st-amber" style="font-size:14px;">—</span>
        <span class="st-dot" id="st-mini-dot" style="margin-left:4px;"></span>
        <div class="st-spacer"></div>
        <button class="st-btn st-dim" id="st-show" style="font-size:10px;padding:2px 7px;">▼ Show</button>
      </div>
    `;
    document.documentElement.prepend(bar);
    document.body.style.marginTop = TALL + 'px';

    // ── Helpers ────────────────────────────────────────────────────────────────
    function fmtTime(sec) {
      if (!sec || sec <= 0) return '0m';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
      return `${s}s`;
    }

    // ── Timezone select ────────────────────────────────────────────────────────
    const tzSel = document.getElementById('st-tz');

    // Init select from storage
    chrome.storage.local.get('timezone', ({ timezone }) => {
      tzSel.value = timezone || DEFAULT_TZ;
    });

    tzSel.addEventListener('change', () => {
      chrome.storage.local.set({ timezone: tzSel.value });
      // background.js will detect the change and re-fetch automatically
    });

    // ── Render ─────────────────────────────────────────────────────────────────
    function render(state) {
      const dot     = document.getElementById('st-dot');
      const miniDot = document.getElementById('st-mini-dot');
      const lbl     = document.getElementById('st-live-lbl');

      if (!state?.status || state.status === 'loading') {
        [dot, miniDot].forEach(d => { d.className = 'st-dot st-dot-loading'; });
        lbl.textContent = 'loading…';
        return;
      }

      if (state.status === 'error') {
        [dot, miniDot].forEach(d => { d.className = 'st-dot st-dot-error'; });
        lbl.textContent = state.errorMsg || 'API error';
        ['st-dials','st-time','st-top-name','st-top-dials',
         'st-mini-dials','st-mini-time','st-mini-top-name','st-mini-top-dials']
          .forEach(id => { document.getElementById(id).textContent = '—'; });
        return;
      }

      const dials    = state.dials ?? 0;
      const timeStr  = fmtTime(state.talkSeconds ?? 0);
      const topName  = state.topName  || '—';
      const topDials = state.topDials ?? 0;

      document.getElementById('st-dials').textContent          = dials;
      document.getElementById('st-time').textContent           = timeStr;
      document.getElementById('st-top-name').textContent       = topName;
      document.getElementById('st-top-dials').textContent      = topDials || '—';
      document.getElementById('st-mini-dials').textContent     = dials;
      document.getElementById('st-mini-time').textContent      = timeStr;
      document.getElementById('st-mini-top-name').textContent  = topName;
      document.getElementById('st-mini-top-dials').textContent = topDials || '—';

      document.getElementById('st-top-group').classList.toggle('st-top-is-me', !!state.topIsMe);

      // Keep select in sync if another tab changed the timezone
      if (state.timezone && tzSel.value !== state.timezone) {
        tzSel.value = state.timezone;
      }

      [dot, miniDot].forEach(d => { d.className = 'st-dot st-dot-live'; });
      lbl.textContent = 'Live';
    }

    // ── Storage → UI ───────────────────────────────────────────────────────────
    chrome.storage.onChanged.addListener((_c, area) => {
      if (area === 'local') chrome.storage.local.get(null, render);
    });
    chrome.storage.local.get(null, render);

    // ── Ping every 7 s ─────────────────────────────────────────────────────────
    function ping() {
      try { chrome.runtime.sendMessage({ action: 'ping' }); } catch (_) {}
    }
    ping();
    setInterval(ping, POLL_MS);

    // ── Minimize / expand ──────────────────────────────────────────────────────
    document.getElementById('st-hide').addEventListener('click', () => {
      document.getElementById('st-full').style.display = 'none';
      document.getElementById('st-mini').style.display = 'flex';
      document.body.style.marginTop = SHORT + 'px';
    });
    document.getElementById('st-show').addEventListener('click', () => {
      document.getElementById('st-full').style.display = 'flex';
      document.getElementById('st-mini').style.display = 'none';
      document.body.style.marginTop = TALL + 'px';
    });
  })();
}
