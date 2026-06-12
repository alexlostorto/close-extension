if (!document.getElementById('st-bar')) {
  (function () {
    const POLL_MS         = 7000;
    const TALL            = 46;
    const SHORT           = 30;
    const PHONE_H         = 28; // height per phone row
    const DUPE_H          = 26; // height per duplicate row (header + each match)
    const TRIAGE_H        = 26; // height per triage row (header + each alert)
    const TRIAGE_POLL_MS  = 2 * 60 * 1000; // refresh triage every 2 minutes
    const DEFAULT_TZ      = 'Europe/London';

    const TZ_OPTIONS = [
      { value: 'Europe/London',       label: '🇬🇧 UK' },
      { value: 'UTC',                 label: 'UTC' },
      { value: 'America/New_York',    label: '🇺🇸 New York' },
      { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles' },
      { value: 'America/Toronto',     label: '🇨🇦 Toronto' },
      { value: 'Asia/Dubai',          label: '🇦🇪 Dubai' },
      { value: 'Asia/Karachi',        label: '🇵🇰 Pakistan' },
      { value: 'Africa/Cairo',        label: '🇪🇬 Egypt' },
      { value: 'Australia/Sydney',    label: '🇦🇺 Sydney' },
      { value: 'Asia/Tokyo',          label: '🇯🇵 Japan' },
    ];

    // ── Country prefix lookup (longest first to avoid false matches) ──────────
    const PREFIXES = [
      ['+1242','🇧🇸','Bahamas'],['+1246','🇧🇧','Barbados'],['+1264','🇦🇮','Anguilla'],
      ['+1268','🇦🇬','Antigua'],['+1284','🇻🇬','British Virgin Islands'],
      ['+1340','🇻🇮','US Virgin Islands'],['+1345','🇰🇾','Cayman Islands'],
      ['+1441','🇧🇲','Bermuda'],['+1473','🇬🇩','Grenada'],['+1649','🇹🇨','Turks & Caicos'],
      ['+1664','🇲🇸','Montserrat'],['+1670','🇲🇵','N. Mariana Islands'],
      ['+1671','🇬🇺','Guam'],['+1684','🇦🇸','American Samoa'],
      ['+1721','🇸🇽','Sint Maarten'],['+1758','🇱🇨','Saint Lucia'],
      ['+1767','🇩🇲','Dominica'],['+1784','🇻🇨','St Vincent'],
      ['+1787','🇵🇷','Puerto Rico'],['+1809','🇩🇴','Dominican Republic'],
      ['+1868','🇹🇹','Trinidad & Tobago'],['+1869','🇰🇳','Saint Kitts'],
      ['+1876','🇯🇲','Jamaica'],['+1939','🇵🇷','Puerto Rico'],
      ['+212','🇲🇦','Morocco'],['+213','🇩🇿','Algeria'],['+216','🇹🇳','Tunisia'],
      ['+218','🇱🇾','Libya'],['+220','🇬🇲','Gambia'],['+221','🇸🇳','Senegal'],
      ['+222','🇲🇷','Mauritania'],['+223','🇲🇱','Mali'],['+224','🇬🇳','Guinea'],
      ['+225','🇨🇮','Ivory Coast'],['+226','🇧🇫','Burkina Faso'],['+227','🇳🇪','Niger'],
      ['+228','🇹🇬','Togo'],['+229','🇧🇯','Benin'],['+230','🇲🇺','Mauritius'],
      ['+231','🇱🇷','Liberia'],['+232','🇸🇱','Sierra Leone'],['+233','🇬🇭','Ghana'],
      ['+234','🇳🇬','Nigeria'],['+235','🇹🇩','Chad'],['+236','🇨🇫','Central African Rep.'],
      ['+237','🇨🇲','Cameroon'],['+238','🇨🇻','Cape Verde'],['+239','🇸🇹','São Tomé'],
      ['+240','🇬🇶','Equatorial Guinea'],['+241','🇬🇦','Gabon'],['+242','🇨🇬','Congo'],
      ['+243','🇨🇩','DR Congo'],['+244','🇦🇴','Angola'],['+245','🇬🇼','Guinea-Bissau'],
      ['+246','🇮🇴','British Indian Ocean'],['+248','🇸🇨','Seychelles'],
      ['+249','🇸🇩','Sudan'],['+250','🇷🇼','Rwanda'],['+251','🇪🇹','Ethiopia'],
      ['+252','🇸🇴','Somalia'],['+253','🇩🇯','Djibouti'],['+254','🇰🇪','Kenya'],
      ['+255','🇹🇿','Tanzania'],['+256','🇺🇬','Uganda'],['+257','🇧🇮','Burundi'],
      ['+258','🇲🇿','Mozambique'],['+260','🇿🇲','Zambia'],['+261','🇲🇬','Madagascar'],
      ['+262','🇷🇪','Réunion'],['+263','🇿🇼','Zimbabwe'],['+264','🇳🇦','Namibia'],
      ['+265','🇲🇼','Malawi'],['+266','🇱🇸','Lesotho'],['+267','🇧🇼','Botswana'],
      ['+268','🇸🇿','Eswatini'],['+269','🇰🇲','Comoros'],['+290','🇸🇭','Saint Helena'],
      ['+291','🇪🇷','Eritrea'],['+297','🇦🇼','Aruba'],['+298','🇫🇴','Faroe Islands'],
      ['+299','🇬🇱','Greenland'],['+350','🇬🇮','Gibraltar'],['+351','🇵🇹','Portugal'],
      ['+352','🇱🇺','Luxembourg'],['+353','🇮🇪','Ireland'],['+354','🇮🇸','Iceland'],
      ['+355','🇦🇱','Albania'],['+356','🇲🇹','Malta'],['+357','🇨🇾','Cyprus'],
      ['+358','🇫🇮','Finland'],['+359','🇧🇬','Bulgaria'],['+370','🇱🇹','Lithuania'],
      ['+371','🇱🇻','Latvia'],['+372','🇪🇪','Estonia'],['+373','🇲🇩','Moldova'],
      ['+374','🇦🇲','Armenia'],['+375','🇧🇾','Belarus'],['+376','🇦🇩','Andorra'],
      ['+377','🇲🇨','Monaco'],['+378','🇸🇲','San Marino'],['+380','🇺🇦','Ukraine'],
      ['+381','🇷🇸','Serbia'],['+382','🇲🇪','Montenegro'],['+383','🇽🇰','Kosovo'],
      ['+385','🇭🇷','Croatia'],['+386','🇸🇮','Slovenia'],['+387','🇧🇦','Bosnia'],
      ['+389','🇲🇰','North Macedonia'],['+420','🇨🇿','Czech Republic'],
      ['+421','🇸🇰','Slovakia'],['+423','🇱🇮','Liechtenstein'],
      ['+500','🇫🇰','Falkland Islands'],['+501','🇧🇿','Belize'],
      ['+502','🇬🇹','Guatemala'],['+503','🇸🇻','El Salvador'],['+504','🇭🇳','Honduras'],
      ['+505','🇳🇮','Nicaragua'],['+506','🇨🇷','Costa Rica'],['+507','🇵🇦','Panama'],
      ['+508','🇵🇲','St Pierre & Miquelon'],['+509','🇭🇹','Haiti'],
      ['+590','🇬🇵','Guadeloupe'],['+591','🇧🇴','Bolivia'],['+592','🇬🇾','Guyana'],
      ['+593','🇪🇨','Ecuador'],['+594','🇬🇫','French Guiana'],['+595','🇵🇾','Paraguay'],
      ['+596','🇲🇶','Martinique'],['+597','🇸🇷','Suriname'],['+598','🇺🇾','Uruguay'],
      ['+599','🇨🇼','Curaçao'],['+670','🇹🇱','Timor-Leste'],['+672','🇳🇫','Norfolk Island'],
      ['+673','🇧🇳','Brunei'],['+674','🇳🇷','Nauru'],['+675','🇵🇬','Papua New Guinea'],
      ['+676','🇹🇴','Tonga'],['+677','🇸🇧','Solomon Islands'],['+678','🇻🇺','Vanuatu'],
      ['+679','🇫🇯','Fiji'],['+680','🇵🇼','Palau'],['+681','🇼🇫','Wallis & Futuna'],
      ['+682','🇨🇰','Cook Islands'],['+683','🇳🇺','Niue'],['+685','🇼🇸','Samoa'],
      ['+686','🇰🇮','Kiribati'],['+687','🇳🇨','New Caledonia'],['+688','🇹🇻','Tuvalu'],
      ['+689','🇵🇫','French Polynesia'],['+690','🇹🇰','Tokelau'],['+691','🇫🇲','Micronesia'],
      ['+692','🇲🇭','Marshall Islands'],['+850','🇰🇵','North Korea'],['+852','🇭🇰','Hong Kong'],
      ['+853','🇲🇴','Macau'],['+855','🇰🇭','Cambodia'],['+856','🇱🇦','Laos'],
      ['+880','🇧🇩','Bangladesh'],['+886','🇹🇼','Taiwan'],['+960','🇲🇻','Maldives'],
      ['+961','🇱🇧','Lebanon'],['+962','🇯🇴','Jordan'],['+963','🇸🇾','Syria'],
      ['+964','🇮🇶','Iraq'],['+965','🇰🇼','Kuwait'],['+966','🇸🇦','Saudi Arabia'],
      ['+967','🇾🇪','Yemen'],['+968','🇴🇲','Oman'],['+970','🇵🇸','Palestine'],
      ['+971','🇦🇪','UAE'],['+972','🇮🇱','Israel'],['+973','🇧🇭','Bahrain'],
      ['+974','🇶🇦','Qatar'],['+975','🇧🇹','Bhutan'],['+976','🇲🇳','Mongolia'],
      ['+977','🇳🇵','Nepal'],['+992','🇹🇯','Tajikistan'],['+993','🇹🇲','Turkmenistan'],
      ['+994','🇦🇿','Azerbaijan'],['+995','🇬🇪','Georgia'],['+996','🇰🇬','Kyrgyzstan'],
      ['+998','🇺🇿','Uzbekistan'],
      // 2-digit
      ['+20','🇪🇬','Egypt'],['+27','🇿🇦','South Africa'],['+30','🇬🇷','Greece'],
      ['+31','🇳🇱','Netherlands'],['+32','🇧🇪','Belgium'],['+33','🇫🇷','France'],
      ['+34','🇪🇸','Spain'],['+36','🇭🇺','Hungary'],['+39','🇮🇹','Italy'],
      ['+40','🇷🇴','Romania'],['+41','🇨🇭','Switzerland'],['+43','🇦🇹','Austria'],
      ['+44','🇬🇧','UK'],['+45','🇩🇰','Denmark'],['+46','🇸🇪','Sweden'],
      ['+47','🇳🇴','Norway'],['+48','🇵🇱','Poland'],['+49','🇩🇪','Germany'],
      ['+51','🇵🇪','Peru'],['+52','🇲🇽','Mexico'],['+53','🇨🇺','Cuba'],
      ['+54','🇦🇷','Argentina'],['+55','🇧🇷','Brazil'],['+56','🇨🇱','Chile'],
      ['+57','🇨🇴','Colombia'],['+58','🇻🇪','Venezuela'],['+60','🇲🇾','Malaysia'],
      ['+61','🇦🇺','Australia'],['+62','🇮🇩','Indonesia'],['+63','🇵🇭','Philippines'],
      ['+64','🇳🇿','New Zealand'],['+65','🇸🇬','Singapore'],['+66','🇹🇭','Thailand'],
      ['+81','🇯🇵','Japan'],['+82','🇰🇷','South Korea'],['+84','🇻🇳','Vietnam'],
      ['+86','🇨🇳','China'],['+90','🇹🇷','Turkey'],['+91','🇮🇳','India'],
      ['+92','🇵🇰','Pakistan'],['+93','🇦🇫','Afghanistan'],['+94','🇱🇰','Sri Lanka'],
      ['+95','🇲🇲','Myanmar'],['+98','🇮🇷','Iran'],
      // 1-digit (last)
      ['+1','🇺🇸','US / Canada'],['+7','🇷🇺','Russia'],
    ];

    function lookupCountry(phone) {
      const norm = (phone || '').replace(/[\s\-().]/g, '');
      for (const [prefix, , name] of PREFIXES) {
        if (norm.startsWith(prefix)) return name;
      }
      return '';
    }

    function toWaNumber(phone) {
      return (phone || '').replace(/[^\d]/g, '');
    }

    // ── Pace tracker ──────────────────────────────────────────────────────────
    // Shift: 09:00 – 19:00  •  KPI: 300 dials
    // Returns { expected, diff } during shift hours, null outside.
    function getPaceStatus(dials, tz) {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz || DEFAULT_TZ,
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now);
      const [h, m] = fmt.split(':').map(Number);
      const nowMins    = h * 60 + m;
      const shiftStart = 9 * 60;    // 09:00
      const shiftEnd   = 19 * 60;   // 19:00
      if (nowMins < shiftStart || nowMins >= shiftEnd) return null;
      const elapsed  = nowMins - shiftStart;
      const expected = Math.floor((elapsed / (shiftEnd - shiftStart)) * 300);
      return { expected, diff: dials - expected };
    }

    // ── DOM: stats bar ────────────────────────────────────────────────────────
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
          <span class="st-label" id="st-pace-lbl">PACE</span>
          <span id="st-pace-num" class="st-num st-pace-off">—</span>
        </div>
        <div class="st-sep"></div>
        <div class="st-group">
          <span class="st-label">Total Talk</span>
          <span id="st-time" class="st-num st-green">—</span>
        </div>
        <div class="st-sep"></div>
        <div class="st-group">
          <span class="st-label">5m+ Convos</span>
          <span id="st-convos" class="st-num st-purple">—</span>
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
        <span id="st-mini-convos" class="st-num st-purple" style="font-size:14px;">—</span>
        <span class="st-label">convos</span>
        <span class="st-sep" style="height:14px;"></span>
        <span style="font-size:13px;">🏆</span>
        <span id="st-mini-top-name" class="st-top-name" style="font-size:11px;">—</span>
        <span id="st-mini-top-dials" class="st-num st-amber" style="font-size:14px;">—</span>
        <span class="st-sep" style="height:14px;"></span>
        <span id="st-mini-pace" style="font-size:13px; font-weight:700; font-variant-numeric:tabular-nums;"></span>
        <span class="st-dot" id="st-mini-dot" style="margin-left:4px;"></span>
        <div class="st-spacer"></div>
        <button class="st-btn st-dim" id="st-show" style="font-size:10px;padding:2px 7px;">▼ Show</button>
      </div>

      <div id="st-triage"></div>
      <div id="st-dupes"></div>
      <div id="st-phones"></div>
    `;
    document.documentElement.prepend(bar);

    // ── Body margin helpers ───────────────────────────────────────────────────
    let barExpanded  = true;
    let phoneRows    = 0;
    let dupeRows     = 0;
    let triageRows   = 0;

    function updateMargin() {
      const base = barExpanded ? TALL : SHORT;
      document.body.style.marginTop =
        (base + triageRows * TRIAGE_H + dupeRows * DUPE_H + phoneRows * PHONE_H) + 'px';
    }
    updateMargin();

    // ── Stats helpers ─────────────────────────────────────────────────────────
    function fmtTime(sec) {
      if (!sec || sec <= 0) return '0m';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
      return `${s}s`;
    }

    // ── Timezone select ───────────────────────────────────────────────────────
    const tzSel = document.getElementById('st-tz');
    chrome.storage.local.get('timezone', ({ timezone }) => {
      tzSel.value = timezone || DEFAULT_TZ;
    });
    tzSel.addEventListener('change', () => {
      chrome.storage.local.set({ timezone: tzSel.value });
    });

    // ── Stats render ──────────────────────────────────────────────────────────
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
        ['st-dials','st-time','st-convos','st-top-name','st-top-dials',
         'st-mini-dials','st-mini-time','st-mini-convos','st-mini-top-name','st-mini-top-dials']
          .forEach(id => { document.getElementById(id).textContent = '—'; });
        return;
      }
      const dials    = state.dials ?? 0;
      const timeStr  = fmtTime(state.talkSeconds ?? 0);
      const topName  = state.topName  || '—';
      const topDials = state.topDials ?? 0;
      const convos   = state.convos ?? 0;

      document.getElementById('st-dials').textContent          = dials;
      document.getElementById('st-time').textContent           = timeStr;
      document.getElementById('st-convos').textContent         = convos;
      document.getElementById('st-top-name').textContent       = topName;
      document.getElementById('st-top-dials').textContent      = topDials || '—';
      document.getElementById('st-mini-dials').textContent     = dials;
      document.getElementById('st-mini-time').textContent      = timeStr;
      document.getElementById('st-mini-convos').textContent    = convos;
      document.getElementById('st-mini-top-name').textContent  = topName;
      document.getElementById('st-mini-top-dials').textContent = topDials || '—';

      document.getElementById('st-top-group').classList.toggle('st-top-is-me', !!state.topIsMe);
      if (state.timezone && tzSel.value !== state.timezone) tzSel.value = state.timezone;

      // ── Pace tracking ───────────────────────────────────────────────────────
      const pace     = getPaceStatus(dials, state.timezone || DEFAULT_TZ);
      const paceLbl  = document.getElementById('st-pace-lbl');
      const paceNum  = document.getElementById('st-pace-num');
      const miniPace = document.getElementById('st-mini-pace');
      if (!pace) {
        // Outside shift hours (before 9am or after 7pm)
        paceLbl.textContent  = 'PACE';
        paceNum.textContent  = '—';
        paceNum.className    = 'st-num st-pace-off';
        miniPace.textContent = '';
      } else if (pace.diff >= 0) {
        const txt = pace.diff === 0 ? '✓' : `+${pace.diff}`;
        paceLbl.textContent       = 'ON TRACK';
        paceNum.textContent       = txt;
        paceNum.className         = 'st-num st-green';
        miniPace.textContent      = txt;
        miniPace.style.color      = '#5ae87a';
      } else {
        paceLbl.textContent       = `BEHIND`;
        paceNum.textContent       = String(pace.diff); // e.g. "−12"
        paceNum.className         = 'st-num st-amber';
        miniPace.textContent      = String(pace.diff);
        miniPace.style.color      = '#f59e0b';
      }

      [dot, miniDot].forEach(d => { d.className = 'st-dot st-dot-live'; });
      lbl.textContent = 'Live';
    }

    chrome.storage.onChanged.addListener((_c, area) => {
      if (area === 'local') chrome.storage.local.get(null, render);
    });
    chrome.storage.local.get(null, render);

    function ping() {
      try { chrome.runtime.sendMessage({ action: 'ping' }); } catch (_) {}
    }
    ping();
    setInterval(ping, POLL_MS);

    // ── Minimize / expand ─────────────────────────────────────────────────────
    document.getElementById('st-hide').addEventListener('click', () => {
      document.getElementById('st-full').style.display = 'none';
      document.getElementById('st-mini').style.display = 'flex';
      barExpanded = false;
      updateMargin();
    });
    document.getElementById('st-show').addEventListener('click', () => {
      document.getElementById('st-full').style.display = 'flex';
      document.getElementById('st-mini').style.display = 'none';
      barExpanded = true;
      updateMargin();
    });

    // ── Phone panel ───────────────────────────────────────────────────────────
    let currentLeadId = null;

    function renderPhones(phones) {
      const panel = document.getElementById('st-phones');
      if (!phones.length) {
        panel.innerHTML = '';
        phoneRows = 0;
        updateMargin();
        return;
      }

      phoneRows = phones.length;
      updateMargin();

      panel.innerHTML = phones.map(({ formatted, type, country, waNum, isWa }, i) => `
        <div class="st-phone-row" data-idx="${i}">
          ${country ? `<span class="st-ph-country">${country}</span>` : ''}
          <span class="st-ph-num">${formatted}</span>
          ${type ? `<span class="st-ph-type">${type}</span>` : ''}
          <button class="st-ph-copy" data-num="${formatted}" title="Copy number">⎘</button>
          ${isWa
            ? `<span class="st-ph-wa st-ph-wa-yes" data-wa="${i}">✓ WA</span>`
            : `<span class="st-ph-wa st-ph-wa-checking" data-wa="${i}" data-href="https://wa.me/${waNum}">…</span>`
          }
        </div>
      `).join('');

      // Copy buttons
      panel.querySelectorAll('.st-ph-copy').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.num).then(() => {
            const orig = btn.textContent;
            btn.textContent = '✓';
            btn.classList.add('st-ph-copy-done');
            setTimeout(() => {
              btn.textContent = orig;
              btn.classList.remove('st-ph-copy-done');
            }, 1500);
          });
        });
      });
    }

    function applyWaResults(results, phones) {
      results.forEach((isOnWA, i) => {
        const el = document.querySelector(`#st-phones [data-wa="${i}"]`);
        if (!el) return;

        const waNum = phones[i]?.waNum || '';
        const href  = waNum ? `https://wa.me/${waNum}` : '';

        if (isOnWA === true) {
          el.outerHTML = `<a class="st-ph-wa st-ph-wa-yes" href="${href}" target="_blank" rel="noopener" data-wa="${i}">✓ WA</a>`;
        } else if (isOnWA === false) {
          el.outerHTML = `<span class="st-ph-wa st-ph-wa-no" data-wa="${i}">✗ WA</span>`;
        } else {
          // null = WA Web not open or check failed — show a dim "?" that
          // links to wa.me so the user can verify manually
          el.outerHTML = href
            ? `<a class="st-ph-wa st-ph-wa-unknown" href="${href}" target="_blank" rel="noopener" data-wa="${i}" title="Could not check — click to try on WhatsApp">? WA</a>`
            : `<span class="st-ph-wa st-ph-wa-unknown" data-wa="${i}">?</span>`;
        }
      });
    }

    // ── Triage panel ─────────────────────────────────────────────────────────
    // Shows leads where: (a) you are the Triage Setter, (b) there is an upcoming
    // meeting task, and (c) no call has been logged in the past 2 hours.
    // Refreshes every 2 minutes so the list stays live.

    function fmtMeetingTime(iso) {
      const d          = new Date(iso);
      const now        = new Date();
      const todayStr   = now.toLocaleDateString('en-CA');
      const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA');
      const meetStr    = d.toLocaleDateString('en-CA');
      const timeStr    = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if (meetStr === todayStr)    return `Today ${timeStr}`;
      if (meetStr === tomorrowStr) return `Tomorrow ${timeStr}`;
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + timeStr;
    }

    function renderTriage(items) {
      const panel = document.getElementById('st-triage');
      if (!items.length) {
        panel.innerHTML = '';
        triageRows = 0;
        updateMargin();
        return;
      }
      triageRows = 1 + items.length; // header + one row per lead
      updateMargin();
      panel.innerHTML = `
        <div class="st-triage-header">
          <span class="st-triage-icon">⏰</span>
          <span>TRIAGE — call required (${items.length} lead${items.length > 1 ? 's' : ''})</span>
        </div>
        ${items.map(item => `
          <a class="st-triage-row" href="/lead/${item.id}/" target="_blank" rel="noopener">
            <span class="st-triage-name">${item.name}</span>
            <span class="st-triage-meeting">Meeting: ${fmtMeetingTime(item.meetingAt)}</span>
            <span class="st-triage-badge">No call 2h+</span>
            <span class="st-triage-open">↗ Open</span>
          </a>
        `).join('')}
      `;
    }

    function refreshTriage() {
      chrome.runtime.sendMessage({ action: 'fetch_triage' }, r => {
        if (r?.ok) renderTriage(r.items || []);
        else console.error('[ST] fetch_triage error:', r?.error);
      });
    }

    // Initial fetch + recurring refresh every 2 minutes
    refreshTriage();
    setInterval(refreshTriage, TRIAGE_POLL_MS);

    // ── Duplicate lead checker ────────────────────────────────────────────────
    // All GraphQL fetches run in background.js (service worker) so they are
    // visible in the extension's service-worker DevTools Network tab and use
    // the stored API key — no CSRF / session-cookie dependency.

    function dupeSendMessage(relatedType, fieldName, value) {
      return new Promise(resolve =>
        chrome.runtime.sendMessage(
          { action: 'check_dupes', relatedType, fieldName, value },
          r => {
            if (r?.ok) resolve(r.contacts || []);
            else {
              console.error('[ST] check_dupes error:', r?.error, r?.raw);
              resolve([]);
            }
          }
        )
      );
    }

    function renderDupes(dupes) {
      const panel = document.getElementById('st-dupes');
      if (!dupes.length) {
        panel.innerHTML = '';
        dupeRows = 0;
        updateMargin();
        return;
      }
      dupeRows = 1 + dupes.length; // 1 header row + N match rows
      updateMargin();
      panel.innerHTML = `
        <div class="st-dupe-header">
          <span class="st-dupe-icon">⚠</span>
          <span>DUPLICATE LEADS — merge &amp; delete duplicate opportunities</span>
        </div>
        ${dupes.map(d => `
          <a class="st-dupe-row" href="/lead/${d.id}/" target="_blank" rel="noopener">
            <span class="st-dupe-name">${d.displayName}</span>
            <span class="st-dupe-reason">same ${d.matchType}: ${d.matchValue}</span>
            <span class="st-dupe-open">↗ Open</span>
          </a>
        `).join('')}
      `;
    }

    async function checkDuplicates(phones, emails, leadId) {
      const panel = document.getElementById('st-dupes');
      panel.innerHTML = '<div class="st-dupe-checking">Checking for duplicates…</div>';
      dupeRows = 1;
      updateMargin();

      try {
        // Build one search per phone (using the raw E.164 value stored in Close)
        // and one per email. background.js supplies orgId and makes the GQL fetch.
        const searches = [
          ...phones.map(p => ({
            call:    () => dupeSendMessage('CONTACT_PHONE', 'phone', p.raw),
            type:    'phone',
            display: p.formatted,
          })),
          ...emails.map(e => ({
            call:    () => dupeSendMessage('CONTACT_EMAIL', 'email', e),
            type:    'email',
            display: e,
          })),
        ];

        const batches = await Promise.all(
          searches.map(({ call, type, display }) =>
            call().then(contacts =>
              contacts
                .filter(c => c.lead.id !== leadId)
                .map(c => ({
                  id:          c.lead.id,
                  displayName: c.lead.name || c.displayName,
                  matchType:   type,
                  matchValue:  display,
                }))
            )
          )
        );

        if (leadId !== currentLeadId) return;

        const seen  = new Set();
        const dupes = batches.flat().filter(d => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        });

        renderDupes(dupes);
      } catch (err) {
        console.error('[ST] checkDuplicates failed:', err);
        if (leadId !== currentLeadId) return;
        panel.innerHTML = ''; dupeRows = 0; updateMargin();
      }
    }

    async function loadLeadPhones(leadId) {
      if (leadId === currentLeadId) return;
      currentLeadId = leadId;

      const panel = document.getElementById('st-phones');
      panel.innerHTML = `<div class="st-ph-loading">Loading phones…</div>`;
      phoneRows = 1;
      updateMargin();

      try {
        const res = await new Promise(resolve =>
          chrome.runtime.sendMessage({ action: 'fetch_lead', leadId }, resolve)
        );
        if (!res?.ok) throw new Error(res?.error || 'failed');
        const lead = res.data;

        const phones     = [];
        const emails     = [];
        const seen       = new Set();
        const seenEmails = new Set();
        for (const contact of lead.contacts || []) {
          for (const p of contact.phones || []) {
            const num = p.phone || '';
            if (!num || seen.has(num)) continue;
            seen.add(num);
            const waNum  = toWaNumber(num);
            const type   = (p.type || '').toLowerCase();
            const isWa   = type.includes('whatsapp');
            const country = lookupCountry(num);
            phones.push({
              formatted: p.phone_formatted || num,
              raw:       num,   // original E.164 value from API — used for GQL search
              type:      p.type || '',
              country, waNum, isWa,
            });
          }
          for (const e of contact.emails || []) {
            const email = (e.email || '').toLowerCase().trim();
            if (email && !seenEmails.has(email)) {
              seenEmails.add(email);
              emails.push(email);
            }
          }
        }

        if (leadId !== currentLeadId) return; // navigated away mid-fetch
        renderPhones(phones);
        if (phones.length || emails.length) checkDuplicates(phones, emails, leadId);

        // Async WA check — only for numbers not already confirmed via type field
        const toCheck = phones.map(p => p.waNum);
        if (toCheck.length) {
          chrome.runtime.sendMessage(
            { action: 'check_whatsapp_batch', waNumbers: toCheck },
            res => {
              if (leadId !== currentLeadId) return; // navigated away
              if (res?.results) applyWaResults(res.results, phones);
            }
          );
        }

      } catch (e) {
        if (leadId !== currentLeadId) return;
        panel.innerHTML = `<div class="st-ph-loading" style="color:#ef4444;">Failed to load phones</div>`;
        phoneRows = 1;
        updateMargin();
      }
    }

    function clearPhones() {
      currentLeadId = null;
      document.getElementById('st-phones').innerHTML = '';
      document.getElementById('st-dupes').innerHTML  = '';
      phoneRows = 0;
      dupeRows  = 0;
      updateMargin();
    }

    // ── SPA navigation watcher ────────────────────────────────────────────────
    function checkUrl() {
      const match = location.pathname.match(/\/lead\/(lead_[^/?#]+)/);
      if (match) {
        loadLeadPhones(match[1]);
      } else {
        clearPhones();
      }
    }

    // Intercept history API
    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState    = (...a) => { _push(...a);    setTimeout(checkUrl, 150); };
    history.replaceState = (...a) => { _replace(...a); setTimeout(checkUrl, 150); };
    window.addEventListener('popstate', () => setTimeout(checkUrl, 150));

    // Interval fallback — catches any navigation the history hook misses
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        checkUrl();
      }
    }, 500);

    checkUrl();

  })();
}
