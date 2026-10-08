// ==UserScript==
// @name         NHL94 – It's In The Script (Fun)
// @namespace    https://github.com/codystewy/nhl94-its-in-the-script
// @version      2.2.0.56
// @description  Redesigns nhl94online.com (home, coach, standings, stats, records and box score pages): coach names on the schedule, grouped by opponent, saved filters, and a switchable NHL 26 x 16-bit look.
// @author       codystewy
// @homepageURL  https://github.com/codystewy/nhl94-its-in-the-script
// @supportURL   https://github.com/codystewy/nhl94-its-in-the-script/issues
// @updateURL    https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/fun/nhl94-its-in-the-script.fun.user.js
// @downloadURL  https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/fun/nhl94-its-in-the-script.fun.user.js
// @match        https://nhl94online.com/*
// @match        http://nhl94online.com/*
// @match        https://www.nhl94online.com/*
// @match        http://www.nhl94online.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (document.querySelector('.nx-root, .nx-switch')) return;

  // Keep in sync with @version above (GM_info would report the dev loader's version).
  const SCRIPT_VERSION = '2.2.0.56';
  // Release channel: 'stable' here; dev/build-channel.sh stamps 'latest' or 'fun'.
  const CHANNEL = 'fun';
  const FUN = CHANNEL === 'fun';
  // Fun-only extras: they run on the Fun channel only and never reach Latest or Stable.
  // Gate each one with `if (funOn('id'))`. To retire one, delete its entry and every funOn('id') block.
  // `/git summary` lists these with their age.
  const FUN_EXTRAS = {
    // id: { name: 'Custom scrollbars', added: 'YYYY-MM-DD' },
  };
  const funOn = (id) => FUN && Object.prototype.hasOwnProperty.call(FUN_EXTRAS, id);

  // ============================================================
  // Helpers
  // ============================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leafTables = () => $$('table').filter((t) => !t.querySelector('table'));
  const rowText = (r) => norm([...r.cells].map((c) => c.textContent).join(' '));
  const firstRowText = (t) => (t.rows[0] ? rowText(t.rows[0]) : '');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('nx:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('nx:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  // Which page are we on? Pages without a redesign are left untouched.
  const PATH = window.__nxTestPath || location.pathname; // __nxTestPath / __nxTestHref: set by dev/preview.sh only
  const HREF = window.__nxTestHref || location.href;
  const STAT_PAGES = { standings: 'standings', roster_stats: 'roster', records: 'records', player_stats: 'players',
    allstats: 'allstats', site_records: 'siterecords', box_score: 'boxscore',
    pl_box_score: 'boxscore', playoffs: 'playoffs' };
  const statPage = (/^\/html\/([a-z_]+)\.php$/i.exec(PATH) || [])[1];
  const PAGE = /\/html\/coachpage\.php$/i.test(PATH) ? 'coach'
    : /^\/(index\.php)?$/i.test(PATH) ? 'home'
    : STAT_PAGES[(statPage || '').toLowerCase()] || null;
  if (!PAGE) return;

  const params = new URLSearchParams(location.search);
  const pageKey = params.get('team_ID') || location.search;

  // City -> [logo slug, nickname] for the '94 teams (logos live at /images/gens/logosNN/<slug>.png)
  const TEAMS = {
    'Anaheim': ['ana_mighty_ducks', 'Mighty Ducks'], 'Boston': ['bos_bruins', 'Bruins'], 'Buffalo': ['buf_sabres', 'Sabres'],
    'Calgary': ['cal_flames', 'Flames'], 'Chicago': ['chi_blackhawks', 'Blackhawks'], 'Dallas': ['dal_stars', 'Stars'],
    'Detroit': ['det_red_wings', 'Red Wings'], 'Edmonton': ['edm_oilers', 'Oilers'], 'Florida': ['flo_panthers', 'Panthers'],
    'Hartford': ['har_whalers', 'Whalers'], 'Los Angeles': ['los_kings', 'Kings'], 'Montreal': ['mon_canadiens', 'Canadiens'],
    'New Jersey': ['new_devils', 'Devils'], 'NY Islanders': ['new_islanders', 'Islanders'], 'NY Rangers': ['new_rangers', 'Rangers'],
    'Ottawa': ['ott_senators', 'Senators'], 'Philadelphia': ['phi_flyers', 'Flyers'], 'Pittsburgh': ['pit_penguins', 'Penguins'],
    'Quebec': ['que_nordiques', 'Nordiques'], 'San Jose': ['san_sharks', 'Sharks'], 'St. Louis': ['st._blues', 'Blues'],
    'St Louis': ['st._blues', 'Blues'], 'Tampa Bay': ['tam_lightning', 'Lightning'], 'Toronto': ['tor_maple_leafs', 'Maple Leafs'],
    'Vancouver': ['van_canucks', 'Canucks'], 'Washington': ['was_capitals', 'Capitals'], 'Winnipeg': ['win_jets', 'Jets'],
  };
  const fullTeamName = (team) => {
    if (!TEAMS[team]) return team;
    const nick = TEAMS[team][1];
    if (/^NY /.test(team)) return 'New York ' + nick;
    return team + ' ' + nick;
  };
  const logo = (team, size = 20) => (TEAMS[team] ? `/images/gens/logos${size}/${TEAMS[team][0]}.png` : '');
  const logoImg = (team, cls = 'nx-logo') =>
    TEAMS[team] ? `<img class="${cls}" src="${logo(team, 20)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls}"></span>`;

  // ============================================================
  // 1. Scrape everything we need from the original page
  // ============================================================

  // Team -> { coach, href, division } from the left sidebar
  const teamInfo = {};
  const divisions = [];
  leafTables().filter((t) => /Coach$/.test(firstRowText(t)) && t.rows.length > 2).forEach((t) => {
    let div = null;
    [...t.rows].forEach((r) => {
      if (r.cells.length < 2) return;
      const a = r.cells[0].querySelector('a');
      if (!a) {
        if (/Coach$/.test(rowText(r))) { div = { name: norm(r.cells[0].textContent), teams: [] }; divisions.push(div); }
        return;
      }
      const name = norm(a.textContent);
      teamInfo[name] = { coach: norm(r.cells[1].textContent), href: a.href, division: div ? div.name : '' };
      if (div) div.teams.push(name);
    });
  });

  // League / level selectors
  const lgSel = $('select[name="lg"]');
  const sublgSel = $('select[name="sublg"]');
  const leagueOpts = lgSel ? [...lgSel.options].map((o) => ({ v: o.value, t: norm(o.text), sel: o.selected })) : [];
  const levelOpts = sublgSel ? [...sublgSel.options].map((o) => ({ v: o.value, t: norm(o.text), sel: o.selected })) : [];
  const leagueName = (leagueOpts.find((o) => o.sel) || {}).t || '';
  const levelName = params.get('sublg') || (levelOpts.find((o) => o.sel) || {}).t || '';

  // Header: coach + team
  const headWhite = $('.heading_white');
  const coachName = headWhite ? norm((headWhite.innerHTML.split(/<br\s*\/?>/i)[0] || '').replace(/<[^>]+>/g, '').replace(/^Coach:\s*/i, '')) : '';
  const bigLogo = $$('img').find((i) => /logos100\//.test(i.getAttribute('src') || ''));
  const teamFullName = bigLogo ? bigLogo.alt : '';

  // Record block
  const statVal = (label) => {
    const lab = $$('.small_black_bold').find((s) => norm(s.textContent).replace(/:$/, '') === label);
    return lab ? norm(lab.parentNode.textContent.replace(lab.textContent, '')) : '';
  };
  const stats = {
    record: statVal('Record'), home: statVal('Home'), away: statVal('Away'), streak: statVal('Streak'),
    gf: statVal('Goals For'), gfg: statVal('GF/G'), ga: statVal('Goals Against'), gag: statVal('GA/G'),
  };
  const rosterLink = $$('a').find((a) => /View Roster Stats/i.test(a.textContent));
  const standingsLink = $$('a').find((a) => /View Full League Standings/i.test(a.textContent));

  // Checkpoint line: "8 Games left to satisfy Checkpoint ( 1 ) by Oct. 12th, 2026."
  let checkpoint = null;
  const cpNode = $$('td, p').reverse().find((n) => /Games left to satisfy Checkpoint/i.test(n.textContent) && !n.querySelector('table'));
  if (cpNode) {
    const m = norm(cpNode.textContent).match(/(\d+)\s*Games left to satisfy Checkpoint\s*\(\s*(\d+)\s*\)\s*by\s*([^,]+,\s*\d{4})/i);
    if (m) {
      const due = new Date(m[3].replace(/\./g, '').replace(/(\d+)(st|nd|rd|th)/, '$1'));
      const days = isNaN(due) ? null : Math.ceil((due - new Date(new Date().toDateString())) / 86400000);
      checkpoint = { left: +m[1], num: m[2], dateText: m[3], days };
    }
  }

  // User settings
  const profile = [];
  leafTables().filter((t) => /^Username:/.test(firstRowText(t))).forEach((t) => {
    [...t.rows].forEach((r) => { if (r.cells.length >= 2) profile.push([norm(r.cells[0].textContent).replace(/:$/, ''), norm(r.cells[1].textContent)]); });
  });

  // The site isn't consistent with team names (e.g. "New York" in standings vs "NY Rangers"
  // in the team list), so map any variant onto a known team, preferring the given division.
  function resolveTeam(name, division) {
    name = norm(name);
    if (!name || teamInfo[name]) return name;
    const key = (t) => t.toLowerCase().replace(/^ny\b/, 'new york').replace(/[^a-z]/g, '');
    const want = key(name);
    let cands = Object.keys(teamInfo).filter((t) => {
      const k = key(t), full = key(fullTeamName(t));
      return k === want || full === want || k.startsWith(want) || full.startsWith(want) || want.startsWith(k);
    });
    if (cands.length > 1 && division) {
      const inDiv = cands.filter((t) => teamInfo[t].division === division);
      if (inDiv.length) cands = inDiv;
    }
    return cands.length === 1 ? cands[0] : name;
  }

  // Division standings
  let standings = null;
  const stTable = leafTables().find((t) => /^\S+\s+W L T DNP Pts/.test(firstRowText(t)));
  if (stTable) {
    standings = { division: norm(stTable.rows[0].cells[0].textContent), rows: [] };
    [...stTable.rows].slice(1).forEach((r) => {
      const c = [...r.cells].map((x) => norm(x.textContent));
      if (c.length >= 6) standings.rows.push({ team: resolveTeam(c[0], standings.division), w: c[1], l: c[2], t: c[3], dnp: c[4], pts: c[5] });
    });
  }

  // Previous champions (top-right box on the original page)
  const champs = [];
  const champTitle = norm(($$('.bold_black').find((s) => /Champs/i.test(s.textContent)) || {}).textContent || '');
  const champTable = leafTables().find((t) => t.querySelector('a[href*="coachpage"]') && /:\s*$/.test(norm((t.rows[0] && t.rows[0].cells[0] || {}).textContent || '')));
  if (champTable) {
    $$('td', champTable).forEach((td) => {
      const a = td.querySelector('a');
      if (!a) return;
      const prev = td.previousElementSibling;
      champs.push({ level: norm(prev ? prev.textContent : '').replace(/:$/, ''), coach: norm(a.textContent), href: a.href, img: (td.querySelector('img') || {}).src || '' });
    });
  }

  // Nav menu
  const nav = $('#nav');
  const navItems = nav ? $$(':scope > li', nav).map((li) => {
    const a = li.querySelector(':scope > a');
    return {
      text: norm(a ? a.textContent : ''), href: a ? a.getAttribute('href') : '#', target: a ? a.getAttribute('target') : '',
      sub: $$(':scope > ul > li > a', li).map((s) => ({ text: norm(s.textContent), href: s.getAttribute('href'), target: s.getAttribute('target') })),
    };
  }) : [];

  // Site footer links
  const footLinks = $$('a.link5').filter((a) => !a.closest('#nav') && a.closest('table') && /Homepage|About|Rules|FAQs|Contact/i.test(a.closest('table').textContent))
    .map((a) => ({ text: norm(a.textContent), href: a.getAttribute('href') }))
    .filter((l, i, arr) => l.text && arr.findIndex((x) => x.text === l.text) === i && !/NHL94\.com|NHL94 Forums/i.test(l.text));

  // ---------- Coach page ----------
  // Schedule
  const sched = leafTables().find((t) => /^Gm Away @ Home SCORE/i.test(firstRowText(t)));
  const games = sched ? [...sched.rows].slice(1).filter((r) => r.cells.length >= 7).map((r) => {
    const c = r.cells;
    const logLink = c[4].querySelector('a');
    const played = !logLink;
    let score = '', winAbbr = '';
    if (played) {
      const span = c[4].querySelector('span');
      winAbbr = span ? norm(span.textContent) : '';
      score = norm(c[4].textContent.replace(winAbbr, ''));
    }
    const box = c[6].querySelector('a');
    return {
      gm: norm(c[0].textContent), away: norm(c[1].textContent), home: norm(c[3].textContent), played, score, winAbbr,
      href: played ? (box ? box.href : '') : logLink.href, time: norm(c[5].textContent),
    };
  }) : [];

  // Which team does this page belong to? (appears in every game)
  let myTeam = '';
  if (games.length) {
    const counts = {};
    games.forEach((g) => { counts[g.away] = (counts[g.away] || 0) + 1; counts[g.home] = (counts[g.home] || 0) + 1; });
    myTeam = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  } else {
    myTeam = Object.keys(teamInfo).find((k) => teamInfo[k].coach === coachName) || '';
  }

  // Winner abbreviation ("WPG", "LA", "NYR") -> which team
  function abbrScore(abbr, name) {
    const A = abbr.toUpperCase().replace(/[^A-Z]/g, '');
    const N = name.toUpperCase().replace(/[^A-Z ]/g, '');
    if (!A || A[0] !== N[0]) return 0;
    let i = 0;
    for (const ch of N) if (ch === A[i]) i++;
    if (i < A.length) return 0;
    const initials = N.split(' ').map((w) => w[0]).join('');
    return initials === A ? 3 : N.replace(/ /g, '').startsWith(A) ? 2 : 1;
  }
  games.forEach((g) => {
    g.opp = g.away === myTeam ? g.home : g.away;
    g.isHome = g.home === myTeam;
    g.result = '';
    if (!g.played) return;
    if (!g.winAbbr) { g.result = 'T'; return; }
    g.result = abbrScore(g.winAbbr, myTeam) >= abbrScore(g.winAbbr, g.opp) ? 'W' : 'L';
  });

  // Group by opponent, in order of first appearance
  const groups = [...new Set(games.map((g) => g.opp))].map((o) => {
    const gs = games.filter((g) => g.opp === o);
    return {
      opp: o, games: gs,
      w: gs.filter((g) => g.result === 'W').length, l: gs.filter((g) => g.result === 'L').length, t: gs.filter((g) => g.result === 'T').length,
      left: gs.filter((g) => !g.played).length,
    };
  });
  const playedCount = games.filter((g) => g.played).length;

  // Division rank of this team
  let rank = null;
  if (standings) {
    const i = standings.rows.findIndex((r) => r.team === myTeam);
    if (i >= 0) rank = { pos: i + 1, pts: standings.rows[i].pts };
  }
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  const addCss = (css) => {
    if (typeof GM_addStyle === 'function') GM_addStyle(css);
    else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
  };

  // ============================================================
  // Colour palettes: team colours on coach pages, the original site's red/white/blue on home.
  // Readable text colours are computed so any team works in Day and Night mode.
  // ============================================================
  // City -> [primary, secondary] (1993-94 era colours)
  const TEAM_COLORS = {
    'Anaheim': ['#4E2A84', '#00877C'], 'Boston': ['#111111', '#FFB81C'], 'Buffalo': ['#00338D', '#FDBB30'],
    'Calgary': ['#C8102E', '#F1BE48'], 'Chicago': ['#CF0A2C', '#E8E8E8'], 'Dallas': ['#006341', '#C4A15A'],
    'Detroit': ['#CE1126', '#E8E8E8'], 'Edmonton': ['#00205B', '#FC4C02'], 'Florida': ['#C8102E', '#B9975B'],
    'Hartford': ['#003DA5', '#00A651'], 'Los Angeles': ['#111111', '#A2AAAD'], 'Montreal': ['#AF1E2D', '#4A6FE3'],
    'New Jersey': ['#CE1126', '#E8E8E8'], 'NY Islanders': ['#00539B', '#F47D30'], 'NY Rangers': ['#0038A8', '#CE1126'],
    'Ottawa': ['#C52032', '#C2912C'], 'Philadelphia': ['#F74902', '#E8E8E8'], 'Pittsburgh': ['#111111', '#FCB514'],
    'Quebec': ['#00539F', '#E4002B'], 'San Jose': ['#006D75', '#A2AAAD'], 'St. Louis': ['#002F87', '#FCB514'],
    'St Louis': ['#002F87', '#FCB514'], 'Tampa Bay': ['#002868', '#A2AAAD'], 'Toronto': ['#00205B', '#E8E8E8'],
    'Vancouver': ['#A6192E', '#FFB81C'], 'Washington': ['#C8102E', '#6E8FD6'], 'Winnipeg': ['#003DA5', '#CE1126'],
  };
  const hexRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a) + 0.05, y = lum(b) + 0.05; return x > y ? x / y : y / x; };
  const mixHex = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(v * (1 - t) + hexRgb(b)[i] * t).toString(16).padStart(2, '0')).join('');
  const onColor = (bg) => (contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#fff' : '#111');
  // Nudge a colour toward white (on dark) or black (on light) until it reads as text on that background.
  function readableOn(bg, color, min) {
    const target = lum(bg) < 0.2 ? '#ffffff' : '#000000';
    let c = color;
    for (let t = 0.1; t <= 1.0001 && contrast(c, bg) < min; t += 0.1) c = mixHex(color, target, t);
    return c;
  }
  function makePalette(hero, btn, gold, acc = {}) {
    return {
      '--nx-hero1': hero, '--nx-red': btn, '--nx-on-red': onColor(btn),
      '--nx-gold': gold, '--nx-on-gold': onColor(gold),
      '--nx-acc-n': acc.n || readableOn('#141C2F', gold, 4.5),
      '--nx-acc-d': acc.d || readableOn('#E3EBF5', gold, 5.5), // checked on the darkest Day surface (team header rows), with room to spare for small text
    };
  }
  // Home: the original site's royal blue, dark red and yellow (links stay the site's blue in Day mode).
  const HOME_PALETTE = makePalette('#3366CC', '#9B0000', '#FFCC00', { n: '#FFCC00', d: '#2A57B0' });
  function teamPalette(team) {
    const c = TEAM_COLORS[team];
    if (!c) return HOME_PALETTE;
    const [p, s] = c;
    return makePalette(p, lum(p) < 0.01 ? s : p, s); // near-black teams (Bruins, Kings, Penguins) use their 2nd colour for buttons
  }
  const applyPalette = (el, vars) => Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

  // Day / Night mode, shared by every page (Night is the default).
  const getMode = () => (store.get('theme', 'night') === 'day' ? 'day' : 'night');
  function setMode(mode) {
    store.set('theme', mode);
    $$('.nx-v1').forEach((el) => el.setAttribute('data-nx-theme', mode));
  }

  // ============================================================
  // VERSION 1 — "Rink Night": dark NHL 26 broadcast look with 16-bit touches
  // ============================================================
  let v1Ready = false;
  function v1Setup() {
    if (v1Ready) return;
    v1Ready = true;
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Press+Start+2P&display=swap';
    document.head.appendChild(fonts);

    const css = `
    :root { --nx-px: "Press Start 2P", monospace; --nx-cond: Oswald, "Arial Narrow", sans-serif; --nx-ui: Inter, "Segoe UI", system-ui, sans-serif; }

    /* ===== Theme tokens =====
       Accents come per page from JS (team colors on coach pages, red/white/blue on home):
         --nx-hero1 hero colour · --nx-red button/active fill (+ --nx-on-red text) · --nx-gold highlight fill (+ --nx-on-gold)
         --nx-acc-n / --nx-acc-d highlight as readable TEXT on night / day surfaces.
       Surfaces come from the Day / Night mode (data-nx-theme on the root). */
    .nx-v1 {
      --nx-hero1: #C8102E; --nx-red: #C8102E; --nx-red-d: #8E0C21; --nx-on-red: #fff; --nx-gold: #F1BE48; --nx-on-gold: #111;
      --nx-acc-n: #F1BE48; --nx-acc-d: #8A6512;
      --nx-win: #2ecc71; --nx-loss: #ff4d5e; --nx-tie: #f1be48;
      --nx-hero2: color-mix(in srgb, var(--nx-hero1) 62%, #000); --nx-hero3: color-mix(in srgb, var(--nx-hero1) 22%, #05070d);
    }
    .nx-v1, .nx-v1[data-nx-theme="night"] {
      --nx-bg: #0B1020; --nx-bg2: #10172A; --nx-card: #141C2F; --nx-card2: #1A2440; --nx-line: #232E48; --nx-line2: #314166;
      --nx-text: #EEF2F8; --nx-mute: #A0ABC3; --nx-dim: #6F7B95; --nx-strong: #fff; --nx-acc: var(--nx-acc-n);
      --nx-thead: #0F1628; --nx-row-home: rgba(255,255,255,.035); --nx-row-away: rgba(0,0,0,.30); --nx-grp1: #1C2640; --nx-score: #070B16;
      --nx-hover: color-mix(in srgb, var(--nx-gold) 11%, transparent); --nx-me: color-mix(in srgb, var(--nx-red) 26%, transparent);
      --nx-cardh: linear-gradient(90deg, color-mix(in srgb, var(--nx-hero1) 30%, transparent), transparent 72%); --nx-cardh-text: #fff; --nx-cardh-meta: var(--nx-mute); --nx-cardh-line: var(--nx-line);
      --nx-shadow: 0 10px 30px rgba(0,0,0,.35);
      --nx-page: radial-gradient(1200px 500px at 15% -10%, color-mix(in srgb, var(--nx-hero1) 30%, transparent), transparent 60%),
                 radial-gradient(900px 400px at 100% 0%, color-mix(in srgb, var(--nx-gold) 9%, transparent), transparent 60%),
                 linear-gradient(180deg, #0D1326 0%, #0B1020 420px);
    }
    .nx-v1[data-nx-theme="day"] {
      --nx-bg: #E5EEF6; --nx-bg2: #EEF4FA; --nx-card: #FFFFFF; --nx-card2: #F2F7FC; --nx-line: #D3E2EA; --nx-line2: #B4C8DD;
      --nx-text: #1E1E1E; --nx-mute: #4A5A70; --nx-dim: #75839A; --nx-strong: #111; --nx-acc: var(--nx-acc-d);
      --nx-thead: #F2F7FC; --nx-row-home: #FFFFFF; --nx-row-away: #EDF2F8; --nx-grp1: #E3EBF5; --nx-score: #1E1E1E;
      --nx-hover: color-mix(in srgb, var(--nx-hero1) 8%, #fff); --nx-me: color-mix(in srgb, var(--nx-hero1) 16%, #fff);
      --nx-cardh: linear-gradient(180deg, color-mix(in srgb, var(--nx-hero1) 72%, #fff), var(--nx-hero1)); --nx-cardh-text: #fff; --nx-cardh-meta: rgba(255,255,255,.85);
      --nx-cardh-line: color-mix(in srgb, var(--nx-hero1) 70%, #000);
      --nx-shadow: 0 2px 10px rgba(30,60,110,.10);
      --nx-page: url(/images/bg.gif) repeat-x fixed, #6699CC; /* the original site's own background: white fading to steel blue */
    }

    .nx-v1, .nx-v1 * { box-sizing: border-box; }
    .nx-v1 { font-family: var(--nx-ui); font-size: 14px; color: var(--nx-text); min-height: 100vh; line-height: 1.4; text-align: left; background: var(--nx-page); }
    .nx-v1 a { color: inherit; text-decoration: none; }
    .nx-v1 img { border: 0; }
    .nx-v1 select { font: inherit; font-size: 13px; color: var(--nx-text); background-color: var(--nx-card2); border: 1px solid var(--nx-line2);
      border-radius: 6px; padding: 6px 28px 6px 10px; cursor: pointer; appearance: none; -webkit-appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, var(--nx-acc) 50%), linear-gradient(135deg, var(--nx-acc) 50%, transparent 50%);
      background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
    .nx-v1 select:focus-visible, .nx-v1 button:focus-visible, .nx-v1 a:focus-visible, .nx-v1 input:focus-visible { outline: 2px solid var(--nx-acc); outline-offset: 2px; }

    /* ---------- Ticker + top bar (dark in both modes, like the original site's black menu bar) ---------- */
    .nx-ticker { display: flex; align-items: center; height: 30px; background: #05070D; border-bottom: 1px solid #1b2236; overflow: hidden; font-size: 12px; }
    .nx-ticker-tag { flex: none; height: 100%; display: flex; align-items: center; padding: 0 18px 0 12px; background: var(--nx-gold); color: var(--nx-on-gold);
      font-family: var(--nx-px); font-size: 8px; letter-spacing: .5px; clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%); position: relative; z-index: 1; }
    .nx-ticker-track { display: flex; gap: 28px; white-space: nowrap; padding-left: 20px; animation: nx-scroll 45s linear infinite; }
    .nx-ticker:hover .nx-ticker-track { animation-play-state: paused; }
    .nx-ticker-item { display: inline-flex; align-items: center; gap: 6px; color: #98A6BF; }
    .nx-ticker-item b { color: #fff; font-weight: 600; }
    .nx-ticker-item img { width: 18px; height: 18px; image-rendering: pixelated; }
    .nx-ticker-item a:hover b { color: var(--nx-acc-n); }
    @keyframes nx-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @media (prefers-reduced-motion: reduce) { .nx-ticker-track { animation: none; } }

    .nx-top { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 18px; padding: 0 24px; height: 58px;
      background: rgba(10,13,24,.94); backdrop-filter: blur(10px); border-bottom: 3px solid var(--nx-red); color: #fff; }
    .nx-brand { display: flex; align-items: baseline; gap: 8px; flex: none; }
    .nx-brand-a { font-family: var(--nx-px); font-size: 15px; color: #fff; text-shadow: 3px 3px 0 var(--nx-red); letter-spacing: 1px; }
    .nx-brand-b { font-family: var(--nx-px); font-size: 9px; color: var(--nx-acc-n); }
    .nx-nav { display: flex; align-items: stretch; height: 100%; flex: 1; min-width: 0; justify-content: flex-end; order: 2; }
    .nx-nav > div { position: relative; display: flex; }
    .nx-nav > div > a { display: flex; align-items: center; padding: 0 11px; font-family: var(--nx-cond); font-weight: 500; font-size: 14px;
      text-transform: uppercase; letter-spacing: .6px; color: #B9C4D8; border-bottom: 3px solid transparent; margin-bottom: -3px; white-space: nowrap; }
    .nx-nav > div:hover > a, .nx-nav > div:focus-within > a { color: #fff; border-bottom-color: var(--nx-gold); }
    .nx-nav .nx-sub { display: none; position: absolute; top: 100%; left: 0; min-width: 220px; padding: 6px; background: var(--nx-card);
      border: 1px solid var(--nx-line2); border-top: 2px solid var(--nx-red); border-radius: 0 0 8px 8px; box-shadow: 0 16px 40px rgba(0,0,0,.45); }
    .nx-nav > div:hover .nx-sub, .nx-nav > div:focus-within .nx-sub { display: block; }
    .nx-sub a { display: block; padding: 7px 10px; border-radius: 5px; color: var(--nx-text); font-size: 13px; }
    .nx-sub a:hover { background: var(--nx-card2); color: var(--nx-acc); }
    .nx-sub .nx-sub-h { padding: 8px 10px 4px; font-family: var(--nx-px); font-size: 7px; color: var(--nx-dim); letter-spacing: .5px; }
    .nx-topbtn { display: inline-flex; align-items: center; gap: 7px; font: 600 14px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase;
      color: #fff; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 7px 12px; cursor: pointer; white-space: nowrap; }
    .nx-topbtn:hover, .nx-topbtn[aria-expanded="true"] { border-color: var(--nx-acc-n); color: var(--nx-acc-n); }
    .nx-menu-btn { display: none; order: 5; }

    /* ---------- Layout ---------- */
    .nx-main { max-width: 1320px; margin: 0 auto; padding: 22px 24px 60px; }
    .nx-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 22px; align-items: start; margin-top: 22px; }
    @media (max-width: 1100px) { .nx-grid { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 1360px) { .nx-nav > div > a { padding: 0 7px; font-size: 13px; letter-spacing: .3px; } .nx-top { gap: 12px; padding: 0 16px; } }
    @media (max-width: 1240px) {
      .nx-menu-btn { display: inline-flex; }
      .nx-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; height: auto; flex-direction: column; align-items: stretch; justify-content: flex-start;
        max-height: calc(100vh - 58px); overflow-y: auto; padding: 8px 16px 16px; background: var(--nx-card); border-bottom: 2px solid var(--nx-red);
        box-shadow: 0 20px 40px rgba(0,0,0,.45); }
      .nx-nav.open { display: flex; }
      .nx-nav > div { flex-direction: column; }
      .nx-nav > div > a { padding: 12px 6px; margin: 0; font-size: 15px; color: var(--nx-text); border-bottom: 1px solid var(--nx-line); }
      .nx-nav > div:hover > a, .nx-nav > div:focus-within > a { color: var(--nx-acc); border-bottom-color: var(--nx-line); }
      .nx-nav .nx-sub { display: block; position: static; min-width: 0; padding: 2px 0 6px 12px; background: none; border: 0; box-shadow: none; }
      .nx-ml { margin-left: auto; }
    }
    @media (max-width: 760px) { .nx-main { padding: 14px; } .nx-top { gap: 8px; padding: 0 10px; } .nx-brand-b { display: none; } }

    /* ---------- Hero (always a saturated colour band, white text, in both modes) ---------- */
    .nx-hero { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--nx-hero1) 55%, #000);
      background: linear-gradient(105deg, var(--nx-hero1) 0%, var(--nx-hero2) 42%, var(--nx-hero3) 72%, #06080f 100%); box-shadow: var(--nx-shadow); color: #fff; }
    .nx-hero::before { content: ""; position: absolute; inset: 0; pointer-events: none;
      background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px); }
    .nx-hero-in::after { content: ""; position: absolute; z-index: -1; right: -130px; top: 0; bottom: 0; width: 340px; pointer-events: none;
      background: linear-gradient(100deg, transparent 0 30%, var(--nx-gold) 30% 34%, transparent 34% 44%, color-mix(in srgb, var(--nx-gold) 45%, transparent) 44% 46%, transparent 46%); opacity: .85; }
    .nx-hero-in { position: relative; z-index: 1; isolation: isolate; overflow: hidden; display: flex; align-items: center; gap: 28px; padding: 26px 30px 22px; }
    .nx-hero-logo { flex: none; width: 128px; height: 128px; display: grid; place-items: center; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.2), rgba(0,0,0,.25) 70%); box-shadow: 0 0 0 3px var(--nx-gold), 0 0 40px color-mix(in srgb, var(--nx-gold) 30%, transparent); }
    .nx-hero-logo img { width: 100px; height: 100px; image-rendering: pixelated; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
    .nx-hero-txt { min-width: 0; flex: 1; }
    .nx-eyebrow { display: inline-flex; gap: 8px; align-items: center; font-family: var(--nx-px); font-size: 8px; letter-spacing: .5px; color: var(--nx-acc-n);
      background: rgba(0,0,0,.38); padding: 6px 10px; border-radius: 3px; line-height: 1.6; }
    .nx-team { margin: 10px 0 2px; font-family: var(--nx-cond); font-weight: 700; font-size: clamp(34px, 5vw, 58px); line-height: .95;
      text-transform: uppercase; letter-spacing: 1px; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35); }
    .nx-coach { font-family: var(--nx-cond); font-size: 18px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.82); }
    .nx-coach b { color: var(--nx-acc-n); font-weight: 600; }
    .nx-hero-rank { flex: none; text-align: center; padding: 14px 20px; background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.14);
      border-radius: 10px; margin-right: 120px; }
    .nx-hero-rank .big { font-family: var(--nx-px); font-size: 24px; color: #fff; text-shadow: 3px 3px 0 rgba(0,0,0,.55); }
    .nx-hero-rank .lab { font-family: var(--nx-cond); font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--nx-acc-n); margin-top: 8px; }
    @media (max-width: 900px) { .nx-hero-rank { margin-right: 0; } .nx-hero-in::after { display: none; } }
    @media (max-width: 640px) {
      .nx-hero-in { flex-direction: column; align-items: flex-start; gap: 14px; padding: 18px; }
      .nx-hero-txt { width: 100%; }
      .nx-hero-rank { align-self: stretch; margin: 0; }
      .nx-hero-logo { width: 88px; height: 88px; } .nx-hero-logo img { width: 70px; height: 70px; }
      table.nx-sched td, table.nx-sched th { padding-left: 6px; padding-right: 6px; }
      table.nx-sched td.tm { white-space: normal; font-size: 11px; }
      .nx-go { min-width: 0; }
      .nx-cp-bar { min-width: 100%; order: 5; }
    }

    .nx-statbar { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      background: rgba(0,0,0,.5); border-top: 1px solid rgba(255,255,255,.1); }
    .nx-stat { padding: 10px 14px; border-right: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.05); }
    .nx-stat:last-child { border-right: 0; }
    .nx-stat .k { font-family: var(--nx-cond); font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; color: rgba(255,255,255,.62); }
    .nx-stat .v { font-family: var(--nx-cond); font-weight: 600; font-size: 22px; color: #fff; font-variant-numeric: tabular-nums; }
    .nx-stat .v.pos { color: var(--nx-win); } .nx-stat .v.neg { color: var(--nx-loss); }

    .nx-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .nx-btn { display: inline-flex; align-items: center; padding: 8px 16px; font-family: var(--nx-cond); font-weight: 600; font-size: 14px;
      text-transform: uppercase; letter-spacing: 1px; color: #fff !important; background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.25);
      transform: skewX(-12deg); border-radius: 3px; cursor: pointer; transition: background .15s, border-color .15s; }
    .nx-btn > span { display: inline-block; transform: skewX(12deg); }
    .nx-btn:hover { background: rgba(0,0,0,.55); border-color: var(--nx-gold); }
    .nx-btn.gold { background: var(--nx-gold); border-color: var(--nx-gold); color: var(--nx-on-gold) !important; }
    .nx-btn.gold:hover { filter: brightness(1.08); }
    button.nx-btn { font-family: var(--nx-cond); }

    /* ---------- Cards ---------- */
    .nx-card { background: var(--nx-card); border: 1px solid var(--nx-line); border-radius: 12px; overflow: clip; box-shadow: var(--nx-shadow); }
    .nx-card + .nx-card { margin-top: 18px; }
    .nx-card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px;
      background: var(--nx-cardh); border-bottom: 2px solid var(--nx-cardh-line); }
    .nx-card-h h2 { margin: 0; font-family: var(--nx-cond); font-weight: 600; font-size: 18px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--nx-cardh-text);
      display: flex; align-items: center; gap: 12px; text-shadow: 0 1px 0 rgba(0,0,0,.2); }
    .nx-card-h h2::before { content: ""; width: 4px; height: 18px; background: var(--nx-red); box-shadow: 5px 0 0 var(--nx-gold); }
    .nx-card-h .nx-meta { font-size: 12px; color: var(--nx-cardh-meta); }
    .nx-card-h .nx-link { font-size: 12px; color: var(--nx-cardh-text); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }

    /* ---------- Checkpoint ---------- */
    .nx-cp { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--nx-line); background: var(--nx-bg2); }
    .nx-cp-num { font-family: var(--nx-px); font-size: 20px; color: var(--nx-acc); }
    .nx-cp-txt { font-size: 13px; color: var(--nx-mute); }
    .nx-cp-txt b { color: var(--nx-text); }
    .nx-cp-bar { flex: 1; min-width: 160px; height: 10px; background: var(--nx-score); border: 1px solid var(--nx-line2); border-radius: 2px; overflow: hidden; }
    .nx-cp-bar > i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--nx-gold) 0 8px, color-mix(in srgb, var(--nx-gold) 70%, #000) 8px 10px); }
    .nx-cp-due { font-family: var(--nx-cond); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; padding: 3px 10px; border-radius: 3px; background: var(--nx-card2); }
    .nx-cp.urgent .nx-cp-num { color: var(--nx-loss); }
    .nx-cp.urgent .nx-cp-due { background: var(--nx-loss); color: #fff; }
    .nx-cp.done .nx-cp-num { color: var(--nx-win); }

    /* ---------- Schedule controls ---------- */
    .nx-ctrl { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--nx-line); }
    .nx-ctrl-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .nx-seg { display: inline-flex; background: var(--nx-bg2); border: 1px solid var(--nx-line2); border-radius: 6px; padding: 2px; }
    .nx-seg button { font: 600 12px var(--nx-cond); text-transform: uppercase; letter-spacing: 1px; color: var(--nx-mute); background: none; border: 0;
      padding: 6px 14px; border-radius: 4px; cursor: pointer; }
    .nx-seg button:hover { color: var(--nx-strong); }
    .nx-seg button.on { background: var(--nx-red); color: var(--nx-on-red); }
    .nx-seg button .n { opacity: .65; margin-left: 5px; }
    .nx-lab { font-family: var(--nx-px); font-size: 7px; color: var(--nx-dim); letter-spacing: .5px; margin-right: 4px; }
    .nx-ctrl-row { gap: 12px; }
    .nx-cf { position: relative; display: flex; align-items: center; gap: 6px; }
    .nx-cf-btn { display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 4px 12px 4px 12px; font: 600 14px var(--nx-ui); color: var(--nx-text);
      background: color-mix(in srgb, var(--nx-red) 16%, var(--nx-bg2)); border: 2px solid var(--nx-red); border-radius: 6px; cursor: pointer; white-space: nowrap;
      box-shadow: 3px 3px 0 rgba(0,0,0,.3); transition: background .15s, transform .1s; }
    .nx-cf-btn .nx-lab { margin-right: 0; font-size: 8px; color: var(--nx-acc); }
    .nx-cf-btn:hover, .nx-cf-btn[aria-expanded="true"] { background: color-mix(in srgb, var(--nx-red) 30%, var(--nx-bg2)); }
    .nx-cf-btn:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 rgba(0,0,0,.3); }
    .nx-cf-btn.on { color: var(--nx-on-red); background: var(--nx-red); border-color: var(--nx-gold); box-shadow: 3px 3px 0 rgba(0,0,0,.3), inset 0 0 0 1px var(--nx-gold); }
    .nx-cf-btn.on .nx-lab { color: inherit; opacity: .8; }
    .nx-cf-val .logos.hint .nx-logo { opacity: .85; }
    .nx-cf-btn:focus-visible { outline: 2px solid var(--nx-gold); outline-offset: 2px; }
    .nx-cf-val { display: inline-flex; align-items: center; gap: 7px; }
    .nx-cf-val .logos { display: inline-flex; }
    .nx-cf-val .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; }
    .nx-cf-val .logos { gap: 3px; }
    .nx-cf-car { width: 0; height: 0; margin-left: 2px; border: 5px solid transparent; border-top: 6px solid currentColor; border-bottom: 0; font-size: 0; transition: transform .15s; }
    .nx-card:has(.nx-cf-menu:not([hidden])) { overflow: visible; } /* let the open menu hang past a short schedule */
    .nx-cf-btn[aria-expanded="true"] .nx-cf-car { transform: rotate(180deg); }
    .nx-cf-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; width: 320px; max-width: calc(100vw - 32px); max-height: 420px; overflow-y: auto;
      padding: 6px; background: var(--nx-card); border: 1px solid var(--nx-line2); border-top: 3px solid var(--nx-red); border-radius: 0 0 10px 10px;
      box-shadow: 0 18px 40px rgba(0,0,0,.45); }
    .nx-cf-menu[hidden] { display: none; }
    .nx-cf-item { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
    .nx-cf-item:hover, .nx-cf-item:focus-visible { background: var(--nx-card2); outline: none; }
    .nx-cf-item:focus-visible { box-shadow: inset 0 0 0 2px var(--nx-gold); }
    .nx-cf-item.all { border-bottom: 1px solid var(--nx-line); border-radius: 6px 6px 0 0; margin-bottom: 4px; }
    .nx-cf-item .nx-logo { width: 26px; height: 26px; image-rendering: pixelated; flex: none; }
    .nx-cf-item .nm { flex: 1; min-width: 0; font: 600 14px var(--nx-ui); color: var(--nx-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nx-cf-item .nx-dc-slot { margin-left: auto; flex: none; }
    .nx-cf-box { flex: none; width: 16px; height: 16px; display: grid; place-items: center; border: 2px solid var(--nx-line2); border-radius: 2px;
      font: 400 8px/1 var(--nx-px); color: var(--nx-on-red); }
    .nx-cf-item[aria-checked="true"] .nx-cf-box { background: var(--nx-red); border-color: var(--nx-gold); }
    .nx-cf-item[aria-checked="true"] .nx-cf-box::after { content: '✓'; font: 700 11px var(--nx-ui); }
    .nx-cf-item[aria-checked="true"] { background: var(--nx-card2); }
    .nx-cf-item .nx-dc { min-width: 78px; justify-content: center; }
    .nx-cf-item .nx-dc-edit { display: none; }
    @media (max-width: 560px) { .nx-cf-menu { right: auto; left: 0; } }
    .nx-clear { font: 600 12px var(--nx-ui); color: var(--nx-acc); background: none; border: 0; cursor: pointer; padding: 3px 6px; }
    .nx-clear[hidden] { display: none; }

    /* ---------- Schedule table ---------- */
    table.nx-sched { border-collapse: collapse; width: 100%; font-size: 13px; }
    table.nx-sched th { position: sticky; top: 58px; z-index: 2; background: var(--nx-thead); color: var(--nx-mute); text-align: left;
      font: 500 11px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.3px; padding: 8px 12px; border-bottom: 2px solid var(--nx-red); white-space: nowrap; }
    table.nx-sched td { padding: 6px 12px; border-bottom: 1px solid var(--nx-line); white-space: nowrap; }
    table.nx-sched td.gm { width: 1%; font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); text-align: center; }
    table.nx-sched td.act, table.nx-sched td.ha, table.nx-sched td.sc, table.nx-sched td.rs { width: 1%; }
    table.nx-sched td.sc { text-align: right; font-family: var(--nx-cond); font-size: 16px; font-weight: 600; color: var(--nx-strong); font-variant-numeric: tabular-nums; }
    table.nx-sched td.rs { text-align: center; }
    table.nx-sched td.tm { color: var(--nx-mute); font-size: 12px; }
    table.nx-sched tr.g-row.home td { background: var(--nx-row-home); }
    table.nx-sched tr.g-row.away td { background: var(--nx-row-away); }
    table.nx-sched tr.g-row:hover td { background: var(--nx-hover); }

    tr.nx-grp td { padding: 0; border-bottom: 1px solid var(--nx-line2); background: linear-gradient(90deg, var(--nx-grp1), var(--nx-card) 65%); }
    tr.nx-grp:not(:first-child) td { border-top: 6px solid var(--nx-card); }
    .nx-grp-in { display: flex; align-items: center; gap: 12px; padding: 9px 12px; cursor: pointer; user-select: none; }
    .nx-grp-in .nx-logo { width: 30px; height: 30px; image-rendering: pixelated; flex: none; }
    .nx-grp-name { font-family: var(--nx-cond); font-size: 17px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--nx-strong); line-height: 1.2; }
    .nx-grp-name a:hover { color: var(--nx-acc); }
    .nx-grp-coach { font-size: 12px; color: var(--nx-acc); font-weight: 600; }
    .nx-grp-div { font-size: 11px; color: var(--nx-dim); }
    .nx-grp-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
    .nx-pips { display: inline-flex; gap: 3px; }
    .nx-pips i { width: 10px; height: 10px; background: var(--nx-bg2); border: 1px solid var(--nx-line2); }
    .nx-pips i.W { background: var(--nx-win); border-color: var(--nx-win); }
    .nx-pips i.L { background: var(--nx-loss); border-color: var(--nx-loss); }
    .nx-pips i.T { background: var(--nx-tie); border-color: var(--nx-tie); }
    .nx-grp-rec { font-family: var(--nx-cond); font-size: 15px; font-weight: 600; min-width: 44px; text-align: right; color: var(--nx-strong); font-variant-numeric: tabular-nums; }
    .nx-grp-left { font-size: 11px; color: var(--nx-mute); min-width: 54px; text-align: right; }
    .nx-grp-left.done { color: var(--nx-win); }
    .nx-chev { width: 10px; color: var(--nx-dim); transition: transform .15s; font-size: 10px; }
    tr.nx-grp.collapsed .nx-chev { transform: rotate(-90deg); }
    @media (max-width: 640px) { .nx-pips { display: none; } .nx-grp-div { display: none; } }

    .nx-ha { display: inline-block; font: 600 10px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; }
    .nx-ha.h { background: var(--nx-card2); color: var(--nx-strong); border: 1px solid var(--nx-line2); }
    .nx-ha.a { color: var(--nx-mute); border: 1px dashed var(--nx-line2); }
    .nx-res { display: inline-grid; place-items: center; width: 24px; height: 24px; font-family: var(--nx-px); font-size: 9px; border-radius: 3px; }
    .nx-res.W { background: var(--nx-win); color: #062b15; } .nx-res.L { background: var(--nx-loss); color: #3a040b; } .nx-res.T { background: var(--nx-tie); color: #3a2a04; }
    .nx-go { display: inline-flex; align-items: center; justify-content: center; min-width: 92px; padding: 4px 10px; font: 600 11px var(--nx-cond); text-transform: uppercase;
      letter-spacing: 1px; border-radius: 3px; transform: skewX(-12deg); }
    .nx-go > span { display: inline-block; transform: skewX(12deg); }
    .nx-go.log { background: var(--nx-red); color: var(--nx-on-red) !important; }
    .nx-go.log:hover { filter: brightness(1.15); }
    .nx-go.box { color: var(--nx-acc) !important; border: 1px solid color-mix(in srgb, var(--nx-acc) 55%, transparent); }
    .nx-go.box:hover { background: color-mix(in srgb, var(--nx-acc) 14%, transparent); }
    .nx-empty { padding: 30px; text-align: center; color: var(--nx-mute); }

    /* ---------- Sidebar ---------- */
    table.nx-st { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.nx-st th { font: 500 11px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.2px; color: var(--nx-mute); padding: 8px 6px; text-align: right; border-bottom: 1px solid var(--nx-line2); }
    table.nx-st th:nth-child(2) { text-align: left; }
    table.nx-st td { padding: 6px; border-bottom: 1px solid var(--nx-line); text-align: right; font-variant-numeric: tabular-nums; }
    table.nx-st td.pos { text-align: center; font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); width: 24px; }
    table.nx-st td.tm { text-align: left; }
    table.nx-st td.pts { font-family: var(--nx-cond); font-weight: 600; font-size: 15px; color: var(--nx-strong); padding-right: 12px; }
    table.nx-st tr.me td { background: var(--nx-me); }
    table.nx-st tr.me td.pos { color: var(--nx-acc); }
    table.nx-st tbody tr:hover td { background: var(--nx-hover); }
    .nx-tmcell { display: flex; align-items: center; gap: 8px; }
    .nx-tmcell .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; flex: none; }
    .nx-tmcell .n { font-weight: 600; color: var(--nx-text); line-height: 1.2; }
    .nx-tmcell .c { font-size: 11px; color: var(--nx-mute); line-height: 1.2; }
    .nx-tmcell:hover .n { color: var(--nx-acc); }

    .nx-prof { padding: 4px 16px 10px; }
    .nx-prof div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--nx-line); font-size: 13px; }
    .nx-prof div:last-child { border-bottom: 0; }
    .nx-prof span { color: var(--nx-mute); flex: none; }
    .nx-prof b { font-weight: 600; text-align: right; }

    .nx-lgbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 22px; margin: -8px 0 16px; padding: 8px 14px;
      background: var(--nx-card); border: 1px solid var(--nx-line); border-left: 4px solid var(--nx-red); border-radius: 8px; box-shadow: var(--nx-shadow); }
    .nx-lgbar-f { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .nx-lgbar-f .nx-lab { margin: 0; font-size: 8px; color: var(--nx-mute); }
    .nx-lgbar { position: relative; z-index: 20; }
    .nx-lgbar-f.lg { flex: 0 1 400px; }
    .nx-pk { position: relative; flex: 1; min-width: 0; }
    .nx-pk-btn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 6px 12px; font: 600 14px var(--nx-ui); color: var(--nx-text);
      text-align: left; background: var(--nx-card2); border: 1px solid var(--nx-line2); border-radius: 6px; cursor: pointer; }
    .nx-lgbar-f.lv .nx-pk-btn { min-width: 120px; }
    .nx-pk-btn .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nx-pk-btn .car { flex: none; width: 0; height: 0; border: 5px solid transparent; border-top: 6px solid var(--nx-acc); border-bottom: 0; margin-top: 3px; transition: transform .15s; }
    .nx-pk-btn:hover, .nx-pk.open .nx-pk-btn { border-color: var(--nx-acc); }
    .nx-pk.open .nx-pk-btn .car { transform: rotate(180deg); }
    .nx-pk-pop { position: absolute; left: 0; top: calc(100% + 6px); width: max(100%, 300px); max-width: calc(100vw - 32px); padding: 6px;
      background: var(--nx-card); border: 1px solid var(--nx-line2); border-top: 3px solid var(--nx-red); border-radius: 0 0 10px 10px; box-shadow: 0 18px 40px rgba(0,0,0,.45); }
    .nx-pk-pop[hidden] { display: none; }
    .nx-pk-qw { position: relative; margin-bottom: 6px; }
    .nx-pk-qw::before { content: ''; position: absolute; left: 11px; top: 50%; width: 9px; height: 9px; margin-top: -7px; border: 2px solid var(--nx-mute); border-radius: 50%; }
    .nx-pk-qw::after { content: ''; position: absolute; left: 20px; top: 50%; width: 2px; height: 6px; margin-top: 1px; background: var(--nx-mute); transform: rotate(-45deg); }
    .nx-pk-q { width: 100%; min-height: 36px; padding: 6px 10px 6px 32px; font: 500 14px var(--nx-ui); color: var(--nx-text); background: var(--nx-bg2);
      border: 1px solid var(--nx-line2); border-radius: 6px; }
    .nx-pk-q:focus { outline: none; border-color: var(--nx-gold); box-shadow: 0 0 0 1px var(--nx-gold); }
    .nx-pk-q::-webkit-search-cancel-button { cursor: pointer; }
    .nx-pk-list { list-style: none; margin: 0; padding: 0; max-height: min(360px, 55vh); overflow-y: auto; outline: none; }
    .nx-pk-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; font: 500 14px var(--nx-ui); color: var(--nx-text); cursor: pointer; }
    .nx-pk-list li[hidden] { display: none; }
    .nx-pk-list li .n { flex: 1; min-width: 0; }
    .nx-pk-list li.act { background: var(--nx-card2); box-shadow: inset 3px 0 0 var(--nx-gold); }
    .nx-pk-list li[aria-selected="true"] { font-weight: 700; color: var(--nx-acc); }
    .nx-pk-list li[aria-selected="true"]::after { content: '✓'; font-weight: 700; color: var(--nx-acc); }
    .nx-pk-list li .star { color: var(--nx-acc); font-size: 13px; }
    .nx-pk-empty { padding: 10px; font-size: 13px; color: var(--nx-mute); }
    @media (max-width: 760px) { .nx-lgbar { margin-top: 0; } }
    @media (max-width: 560px) { .nx-lgbar-f.lg { flex-basis: 100%; } .nx-pk-pop { width: 100%; } }
    .nx-dir-h { padding: 10px 16px 4px; font-family: var(--nx-px); font-size: 8px; color: var(--nx-acc); letter-spacing: .5px; }
    .nx-dir a { display: flex; align-items: center; gap: 10px; padding: 5px 16px; font-size: 13px; }
    .nx-dir a:hover { background: var(--nx-hover); }
    .nx-dir a:hover .n { color: var(--nx-acc); }
    .nx-dir a.me { background: var(--nx-me); }
    .nx-dir .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; flex: none; }
    .nx-dir .n { flex: 1; font-weight: 500; }
    .nx-dir .c { color: var(--nx-mute); font-size: 12px; }

    .nx-foot { margin-top: 30px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      color: var(--nx-mute); font-size: 12px; border-top: 1px solid var(--nx-line2); padding-top: 16px; }
    .nx-v1[data-nx-theme="day"] .nx-foot { color: #1B2F55; }
    .nx-foot-links { display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: center; }
    .nx-foot-links a:hover { color: var(--nx-strong); text-decoration: underline; }
    .nx-foot .nx-px { font-family: var(--nx-px); font-size: 8px; color: var(--nx-red); animation: nx-blink 1.2s steps(2) infinite; }
    .nx-v1[data-nx-theme="night"] .nx-foot .nx-px { color: var(--nx-acc); }
    @keyframes nx-blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .nx-foot .nx-px { animation: none; } }
    `;
    addCss(css);
  }

  // Shared V1 site chrome: champions ticker + sticky top bar, and the footer.
  function v1Chrome() {
    const tickerItems = champs.map((c) =>
      `<span class="nx-ticker-item">${c.img ? `<img src="${esc(c.img)}" alt="">` : ''}${esc(c.level)} <a href="${esc(c.href)}"><b>${esc(c.coach)}</b></a></span>`).join('');

    const navHtml = navItems.map((n) => {
      const sub = n.sub.length ? `<div class="nx-sub">${n.sub.map((s) => /^-{2,}/.test(s.text)
        ? `<div class="nx-sub-h">${esc(s.text.replace(/-/g, '').trim().toUpperCase())}</div>`
        : `<a href="${esc(s.href)}"${s.target ? ` target="${esc(s.target)}"` : ''}>${esc(s.text)}</a>`).join('')}</div>` : '';
      return `<div><a href="${esc(n.href)}"${n.target ? ` target="${esc(n.target)}"` : ''}>${esc(n.text)}${n.sub.length ? '&nbsp;▾' : ''}</a>${sub}</div>`;
    }).join('');

    return {
      head: `
      ${champs.length ? `<div class="nx-ticker"><div class="nx-ticker-tag">${esc((champTitle || 'Champions').toUpperCase())}</div>
        <div class="nx-ticker-track">${tickerItems.repeat(4)}</div></div>` : ''}
      <header class="nx-top">
        <a class="nx-brand" href="/"><span class="nx-brand-a">NHL'94</span><span class="nx-brand-b">ONLINE</span></a>
        <div class="nx-ml"><button type="button" class="nx-topbtn nx-ml-btn" aria-expanded="false" aria-haspopup="true" title="Your teams in each league"><span class="nx-star">★</span><span class="lbl">My Leagues</span><span class="nx-ml-count"></span></button><button type="button" class="nx-ml-help" title="What is My Leagues?" aria-label="What is My Leagues?" hidden>?</button><div class="nx-ml-menu" hidden></div></div>
        <button type="button" class="nx-topbtn nx-menu-btn" aria-expanded="false" aria-controls="nx-nav">☰ Menu</button>
        <nav class="nx-nav" id="nx-nav">${navHtml}</nav>
      </header>`,
      foot: `<footer class="nx-foot">
        <span class="nx-px">PRESS START</span>
        <nav class="nx-foot-links">${footLinks.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join('')}</nav>
        <span>NHL94Online.com · Classic '94</span>
      </footer>`,
    };
  }

  // League bar: season + level pickers under the top bar on every page, where the original site keeps its
  // "League Selection" box. Seasons are listed newest first.
  function v1LeagueBar() {
    if (!leagueOpts.length && !levelOpts.length) return '';
    const curLg = leagueOpts.find((o) => o.sel) || {}, curLv = levelOpts.find((o) => o.sel) || {};
    // Dropdown in the page's style. `search` adds a filter box (the league list is long).
    const picker = (kind, label, opts, cur, search) => `<div class="nx-lgbar-f ${kind}"><span class="nx-lab" id="nx-pk-${kind}-l">${label}</span>
      <div class="nx-pk" data-kind="${kind}">
        <button type="button" class="nx-pk-btn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="nx-pk-${kind}-l nx-pk-${kind}-t">
          <span class="t" id="nx-pk-${kind}-t">${esc(cur.t || 'Choose…')}</span><span class="car" aria-hidden="true"></span></button>
        <div class="nx-pk-pop" hidden>
          ${search ? `<div class="nx-pk-qw"><input class="nx-pk-q" type="search" autocomplete="off" spellcheck="false" placeholder="Search ${opts.length} leagues…"
            role="combobox" aria-expanded="true" aria-controls="nx-pk-${kind}-list" aria-label="Search leagues"></div>` : ''}
          <ul class="nx-pk-list" id="nx-pk-${kind}-list" role="listbox" aria-labelledby="nx-pk-${kind}-l">
            ${opts.map((o, i) => `<li role="option" id="nx-pk-${kind}-${i}" data-v="${esc(o.v)}" aria-selected="${o.sel}"${o.mine ? ' class="mine"' : ''}>
              <span class="n">${esc(o.t)}</span>${o.mine ? '<span class="star" title="You have a team here (My Leagues)">★</span>' : ''}</li>`).join('')}
          </ul>
          ${search ? '<div class="nx-pk-empty" hidden></div>' : ''}
        </div></div></div>`;
    const mine = new Set(myLeagues.all().map((x) => x.lg));
    return `<div class="nx-lgbar" role="group" aria-label="League selection">
      ${leagueOpts.length ? picker('lg', 'LEAGUE', [...leagueOpts].reverse().map((o) => ({ ...o, mine: mine.has(o.v) })), curLg, true) : ''}
      ${levelOpts.length ? picker('lv', 'LEVEL', levelOpts, curLv, false) : ''}
      ${PAGE === 'coach' && lgLinkKey(currentLg(), curSublg()) ? (setSetup(), `<div class="nx-lgbar-f dc"><span class="nx-lgdc-slot">${lgdcInner()}</span></div>`) : ''}
    </div>`;
  }

  // League card: every team with its coach.
  function v1LeagueCard(highlightTeam) {
    if (!divisions.length) return '';
    return `
      <div class="nx-card"><div class="nx-card-h"><h2>League</h2>${levelName ? `<span class="nx-meta">${esc(levelName)}</span>` : ''}</div>
        ${divisions.map((d) => `<div class="nx-dir"><div class="nx-dir-h">${esc(d.name.toUpperCase())}</div>
          ${d.teams.map((t) => `<a class="${t === highlightTeam ? 'me' : ''}" href="${esc(teamInfo[t].href)}">${logoImg(t)}<span class="n">${esc(t)}</span><span class="c">${esc(teamInfo[t].coach)}</span></a>`).join('')}
        </div>`).join('')}
        <div style="height:8px"></div>
      </div>`;
  }

  // Wire the season / level pickers (same URLs the original selects used).
  function v1WirePickers(app) {
    const go = { lg: (v) => '?lg=' + encodeURIComponent(v),
      lv: (v) => '?lg=' + encodeURIComponent(params.get('lg') || (leagueOpts.find((o) => o.sel) || {}).v || '') + '&sublg=' + encodeURIComponent(v) };
    const fold = (t) => t.toLowerCase().replace(/[’'`]/g, '').replace(/\s+/g, ' ');
    $$('.nx-pk', app).forEach((pk) => {
      const btn = $('.nx-pk-btn', pk), pop = $('.nx-pk-pop', pk), q = $('.nx-pk-q', pk), empty = $('.nx-pk-empty', pk);
      const items = $$('li', pk), shown = () => items.filter((li) => !li.hidden);
      let active = null;
      const setActive = (li) => {
        if (active) active.classList.remove('act');
        active = li;
        if (li) { li.classList.add('act'); li.scrollIntoView({ block: 'nearest' }); }
        (q || btn).setAttribute('aria-activedescendant', li ? li.id : '');
      };
      const filter = () => {
        const words = fold(q.value).split(' ').filter(Boolean);
        items.forEach((li) => { const t = fold(li.textContent); li.hidden = !words.every((w) => t.includes(w)); });
        const n = shown().length;
        empty.hidden = !!n;
        if (!n) empty.textContent = `No league matches “${q.value.trim()}”.`;
        setActive(shown()[0] || null);
      };
      const open = (on) => {
        pop.hidden = !on;
        btn.setAttribute('aria-expanded', String(on));
        pk.classList.toggle('open', on);
        if (!on) return;
        if (q) { q.value = ''; filter(); }
        const cur = $('li[aria-selected="true"]', pk);
        setActive(cur || items[0]);
        (q || $('.nx-pk-list', pk)).focus();
      };
      const pick = (li) => { if (!li) return; open(false); $('.t', btn).textContent = $('.n', li).textContent; location.href = go[pk.dataset.kind](li.dataset.v); };
      $('.nx-pk-list', pk).tabIndex = -1;
      btn.addEventListener('click', () => open(pop.hidden));
      btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); } });
      if (q) q.addEventListener('input', filter);
      pk.addEventListener('keydown', (e) => {
        if (pop.hidden) return;
        const list = shown(), i = list.indexOf(active);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]); }
        else if (e.key === 'Home' && !q) { e.preventDefault(); setActive(list[0]); }
        else if (e.key === 'End' && !q) { e.preventDefault(); setActive(list[list.length - 1]); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); open(false); btn.focus(); }
        else if (e.key === 'Tab') open(false);
      });
      pk.addEventListener('mousemove', (e) => { const li = e.target.closest('li'); if (li && li !== active) setActive(li); });
      pk.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) pick(li); });
      document.addEventListener('click', (e) => { if (!pop.hidden && !pk.contains(e.target)) open(false); });
    });
  }

  // ============================================================
  // My Leagues: the user's own coach pages, one per league/level.
  // Saved with Tampermonkey storage (GM_*) so nhl94online.com and
  // www.nhl94online.com share it; falls back to localStorage.
  // ============================================================
  const gmStore = {
    get(k, d) {
      try { if (typeof GM_getValue === 'function') { const v = GM_getValue(k); return v === undefined ? d : v; } } catch (e) {}
      return store.get('gm:' + k, d);
    },
    set(k, v) {
      try { if (typeof GM_setValue === 'function') { GM_setValue(k, v); return; } } catch (e) {}
      store.set('gm:' + k, v);
    },
  };
  const coachPath = (lg, sublg, teamId) =>
    `/html/coachpage.php?lg=${encodeURIComponent(lg)}&sublg=${encodeURIComponent(sublg)}&team_ID=${encodeURIComponent(teamId)}`;
  function parseCoachUrl(url) {
    try {
      const u = new URL(String(url || '').trim(), 'https://www.nhl94online.com');
      if (!/(^|\.)nhl94online\.com$/i.test(u.hostname) || !/\/html\/coachpage\.php$/i.test(u.pathname)) return null;
      const lg = u.searchParams.get('lg'), sublg = u.searchParams.get('sublg') || '', teamId = u.searchParams.get('team_ID');
      if (!/^\d+$/.test(lg || '') || !/^\d+$/.test(teamId || '')) return null;
      return { id: lg + ':' + teamId, lg, sublg, teamId, path: coachPath(lg, sublg, teamId) };
    } catch (e) { return null; }
  }
  const str = (v, max = 80) => String(v == null ? '' : v).slice(0, max);
  function cleanLeague(x) {
    const p = x && parseCoachUrl(x.path || x.href);
    return p ? { ...p, team: str(x.team), coach: str(x.coach), league: str(x.league), label: str(x.label), addedAt: +x.addedAt || Date.now() } : null;
  }
  const myLeagues = {
    all() {
      let list = gmStore.get('myLeagues', null);
      if (!Array.isArray(list)) {
        list = [];
        const old = store.get('myteam', null); // migrate the earlier single "my team" pin
        const rec = old && cleanLeague({ ...old, league: old.league, path: old.href });
        if (rec) list.push(rec);
        gmStore.set('myLeagues', list);
      }
      return list.map(cleanLeague).filter(Boolean);
    },
    save(list) { gmStore.set('myLeagues', list.map(cleanLeague).filter(Boolean)); document.dispatchEvent(new CustomEvent('nx:myleagues')); },
    has(id) { return this.all().some((x) => x.id === id); },
    toggle(rec) {
      const l = this.all(), i = l.findIndex((x) => x.id === rec.id);
      if (i >= 0) l.splice(i, 1); else l.push(rec);
      this.save(l);
    },
  };
  // Coach → Discord DM, so a coach name opens a private chat with them.
  // New links must be a DM link: discord.com/channels/@me/<chat id>, or a message link from that DM
  // (…/@me/<chat id>/<message id>, trimmed to the chat). Discord can't open a DM from a profile link
  // (discord.com/users/<id>); those are still read from older saves and open the profile.
  // Saved next to My Leagues (GM storage) as { [lower-case coach]: { coach, url, addedAt } }.
  function parseDiscordUrl(url) {
    try {
      const u = new URL(String(url || '').trim());
      if (!/^(www\.|canary\.|ptb\.)?discord(app)?\.com$/i.test(u.hostname)) return '';
      const m = u.pathname.match(/^\/(users|channels\/@me)\/(\d{15,21})(\/\d{15,21})?\/?$/);
      return m && !(m[1] === 'users' && m[3]) ? `https://discord.com/${m[1]}/${m[2]}` : '';
    } catch (e) { return ''; }
  }
  const isDmUrl = (url) => url.startsWith('https://discord.com/channels/@me/');
  const coachKey = (c) => norm(c).toLowerCase();
  function cleanLinks(raw) {
    const out = {};
    if (raw && typeof raw === 'object') Object.values(raw).forEach((x) => {
      const url = x && parseDiscordUrl(x.url), coach = x && str(norm(x.coach), 60);
      if (url && coach) out[coachKey(coach)] = { coach, url, addedAt: +x.addedAt || Date.now() };
    });
    return out;
  }
  const coachLinks = {
    all() { return cleanLinks(gmStore.get('coachLinks', {})); },
    get(coach) { return coach ? this.all()[coachKey(coach)] || null : null; },
    save(map) { gmStore.set('coachLinks', map); document.dispatchEvent(new CustomEvent('nx:coachlinks')); },
    // Returns '' when saved, otherwise a message saying what's wrong with the link.
    set(coach, url) {
      const m = this.all(), u = parseDiscordUrl(url);
      if (!norm(coach)) return 'Type the coach name first.';
      if (!u) return "That's not a Discord DM link.";
      if (!isDmUrl(u)) return "That's a profile link, and Discord can't open a DM from it. Copy a message link from your DM with them instead.";
      m[coachKey(coach)] = { coach: str(norm(coach), 60), url: u, addedAt: Date.now() };
      this.save(m);
      return '';
    },
    remove(coach) { const m = this.all(); delete m[coachKey(coach)]; this.save(m); },
  };
  // League → its Discord server, one per season + level (lg + sublg in the URL).
  // Takes an invite (discord.gg/<code>, discord.com/invite/<code>) or a server channel link
  // (discord.com/channels/<server>/<channel>, a message link is trimmed to the channel).
  // Saved next to My Leagues (GM storage) as { 'lg:sublg': { lg, sublg, url, addedAt } }.
  function parseServerUrl(url) {
    try {
      const raw = String(url || '').trim(), u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'discord.gg') { const m = u.pathname.match(/^\/([\w-]{2,32})\/?$/); return m ? 'https://discord.gg/' + m[1] : ''; }
      if (!/^(canary\.|ptb\.)?discord(app)?\.com$/.test(host)) return '';
      const inv = u.pathname.match(/^\/invite\/([\w-]{2,32})\/?$/);
      if (inv) return 'https://discord.gg/' + inv[1];
      const ch = u.pathname.match(/^\/channels\/(\d{15,21})(\/\d{15,21})?(\/\d{15,21})?\/?$/);
      return ch ? `https://discord.com/channels/${ch[1]}${ch[2] || ''}` : '';
    } catch (e) { return ''; }
  }
  const curSublg = () => params.get('sublg') || (levelOpts.find((o) => o.sel) || {}).v || '';
  const lgLinkKey = (lg, sublg) => (lg && sublg ? lg + ':' + sublg : '');
  function cleanLgLinks(raw) {
    const out = {};
    if (raw && typeof raw === 'object') Object.values(raw).forEach((x) => {
      const url = x && parseServerUrl(x.url), lg = x && str(x.lg, 12), sublg = x && str(x.sublg, 40);
      if (url && /^\d+$/.test(lg) && sublg) out[lgLinkKey(lg, sublg)] = { lg, sublg, league: str(x.league), url, addedAt: +x.addedAt || Date.now() };
    });
    return out;
  }
  const leagueLinks = {
    all() { return cleanLgLinks(gmStore.get('leagueLinks', {})); },
    get(lg, sublg) { return this.all()[lgLinkKey(lg, sublg)] || null; },
    save(map) { gmStore.set('leagueLinks', map); document.dispatchEvent(new CustomEvent('nx:leaguelinks')); },
    // Returns '' when saved, otherwise a message saying what's wrong with the link.
    set(lg, sublg, league, url) {
      const m = this.all(), u = parseServerUrl(url);
      if (!lgLinkKey(lg, sublg)) return 'No league and level on this page.';
      if (!u) return "That's not a Discord invite or server channel link.";
      m[lgLinkKey(lg, sublg)] = { lg, sublg, league: str(league), url: u, addedAt: Date.now() };
      this.save(m);
      return '';
    },
    remove(lg, sublg) { const m = this.all(); delete m[lgLinkKey(lg, sublg)]; this.save(m); },
  };

  const defName = (x) => (x.team ? fullTeamName(x.team) : 'Team #' + x.teamId);
  const mlTitle = (x) => x.label || (x.team ? fullTeamName(x.team) : 'Team #' + x.teamId);
  const mlSub = (x) => [x.coach, x.sublg, x.league].filter(Boolean).join(' · ');
  const currentLg = () => params.get('lg') || (leagueOpts.find((o) => o.sel) || {}).v || '';

  // Read team / coach / season from any coach page (used when adding by link).
  async function fetchCoachInfo(p) {
    const res = await fetch(location.origin + p.path, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(new TextDecoder('windows-1252').decode(await res.arrayBuffer()), 'text/html');
    const hw = doc.querySelector('.heading_white');
    if (!hw) throw new Error('not a coach page');
    const link = [...doc.querySelectorAll('a[href*="coachpage.php"]')].find((a) => new RegExp('team_ID=' + p.teamId + '(\\D|$)').test(a.getAttribute('href') || ''));
    const opt = doc.querySelector('select[name="lg"] option[selected]');
    return {
      team: link ? norm(link.textContent) : '',
      coach: norm((hw.innerHTML.split(/<br\s*\/?>/i)[0] || '').replace(/<[^>]+>/g, '').replace(/^Coach:\s*/i, '')),
      league: opt ? norm(opt.textContent) : '',
    };
  }

  // Backup file: My Leagues plus every saved setting (nx:* keys) for this browser.
  function buildBackup() {
    const prefs = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nx:') && !k.startsWith('nx:gm:') && k !== 'nx:myteam') prefs[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return { app: 'nhl94-its-in-the-script', type: 'backup', version: 1, exportedAt: new Date().toISOString(), myLeagues: myLeagues.all(), coachLinks: coachLinks.all(), leagueLinks: leagueLinks.all(), prefs };
  }
  function downloadBackup() {
    const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nhl94-my-leagues-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Replaces leagues, Discord links (when the backup has them) and settings with a readBackup() result.
  function applyBackup(b) {
    myLeagues.save(b.leagues);
    if (b.coachLinks) coachLinks.save(b.coachLinks);
    if (b.leagueLinks) leagueLinks.save(b.leagueLinks);
    clearPrefs();
    Object.entries(b.prefs).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (err) {} });
  }
  function readBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error("That isn't a valid backup file (not JSON)."); }
    if (!data || data.app !== 'nhl94-its-in-the-script' || !Array.isArray(data.myLeagues)) throw new Error("That file isn't an NHL94 – It's In The Script backup.");
    const leagues = data.myLeagues.map(cleanLeague).filter(Boolean);
    const prefs = {};
    Object.entries(data.prefs || {}).forEach(([k, v]) => { if (/^nx:[\w:.-]+$/.test(k) && !k.startsWith('nx:gm:') && typeof v === 'string' && v.length < 5000) prefs[k] = v; });
    // Older backups have no Discord links (null): restoring them keeps the current ones.
    const links = data.coachLinks && typeof data.coachLinks === 'object' ? cleanLinks(data.coachLinks) : null;
    const lgLinks = data.leagueLinks && typeof data.leagueLinks === 'object' ? cleanLgLinks(data.leagueLinks) : null;
    return { leagues, coachLinks: links, leagueLinks: lgLinks, prefs, exportedAt: data.exportedAt || '' };
  }
  function resetAll() { myLeagues.save([]); coachLinks.save({}); leagueLinks.save({}); clearPrefs(); }
  function clearPrefs() {
    try { Object.keys(localStorage).filter((k) => k.startsWith('nx:') && !k.startsWith('nx:gm:')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  }

  let mlCssDone = false;
  function mlSetup() {
    if (mlCssDone) return;
    mlCssDone = true;
    addCss(`
    .nx-star { font-family: var(--nx-ui); }
    .nx-ml { position: relative; flex: none; order: 3; }
    .nx-top .nx-nav { order: 2; }
    .nx-top .nx-menu-btn { order: 4; }
    .nx-ml-btn .nx-star { color: var(--nx-gold); }
    .nx-ml-count { font: 400 8px var(--nx-px); background: var(--nx-red); color: var(--nx-on-red); padding: 3px 5px; border-radius: 3px; }
    .nx-ml-count:empty { display: none; }
    .nx-ml-menu { position: absolute; right: 0; top: calc(100% + 10px); width: 340px; max-width: calc(100vw - 24px); z-index: 60; padding: 6px;
      background: var(--nx-card); color: var(--nx-text); border: 1px solid var(--nx-line2); border-top: 3px solid var(--nx-red); border-radius: 0 0 10px 10px;
      box-shadow: 0 18px 40px rgba(0,0,0,.45); }
    .nx-ml-menu[hidden] { display: none; }
    .nx-ml-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; }
    .nx-ml-item:hover { background: var(--nx-card2); }
    .nx-ml-item.cur { box-shadow: inset 3px 0 0 var(--nx-red); }
    .nx-ml-item .nx-logo { width: 26px; height: 26px; image-rendering: pixelated; flex: none; }
    .nx-ml-item b { display: block; font: 600 15px var(--nx-cond); text-transform: uppercase; letter-spacing: .5px; color: var(--nx-text); line-height: 1.2; }
    .nx-ml-item small { display: block; font-size: 12px; color: var(--nx-mute); }
    .nx-ml-empty { padding: 12px 10px; font-size: 13px; color: var(--nx-mute); }
    .nx-ml-manage { display: block; width: 100%; margin-top: 4px; padding: 9px 10px; text-align: left; font: 600 13px var(--nx-ui); color: var(--nx-acc);
      background: none; border: 0; border-top: 1px solid var(--nx-line); cursor: pointer; }
    .nx-ml-manage:hover { background: var(--nx-card2); }
    @media (max-width: 760px) { .nx-ml-btn .lbl { display: none; } }
    .nx-top .nx-ml-btn { border-color: var(--nx-gold); background: rgba(255,255,255,.08); box-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 0 14px -2px var(--nx-gold); }
    .nx-top .nx-ml-btn .nx-star { font-size: 15px; text-shadow: 0 0 8px var(--nx-gold); }
    .nx-ml-help { position: absolute; top: -7px; right: -9px; z-index: 2; width: 22px; height: 22px; display: grid; place-items: center; padding: 0;
      font: 400 9px/1 var(--nx-px); color: var(--nx-on-gold); background: var(--nx-gold); border: 2px solid #0a0d18; border-radius: 50%; cursor: pointer; }
    .nx-ml-help[hidden] { display: none; }
    .nx-ml-help:hover { filter: brightness(1.12); transform: scale(1.1); }
    .nx-ml-help:focus-visible, .nx-ml-btn:focus-visible { outline: 2px solid var(--nx-gold); outline-offset: 2px; }
    .nx-ml-help.pop { animation: nx-pop .5s cubic-bezier(.3,1.8,.5,1) both; }
    .nx-ml-btn.hit { animation: nx-hit .45s steps(6) both; }
    @keyframes nx-pop { from { transform: scale(0) rotate(-200deg); } to { transform: none; } }
    @keyframes nx-hit { 0% { transform: translate(0,0); background: #fff; color: #111; } 20% { transform: translate(-5px,3px) rotate(-3deg); }
      40% { transform: translate(5px,-3px) rotate(3deg); background: var(--nx-gold); } 60% { transform: translate(-3px,1px); } 80% { transform: translate(2px,-1px); } 100% { transform: none; } }

    /* "★ Add to My Leagues" on the coach hero: ice-white so it stands apart from the team-coloured buttons. */
    .nx-btn.nx-ml-add { background: #F4F7FB; border-color: #fff; color: #0A0D18 !important; box-shadow: 0 0 0 0 rgba(255,255,255,.6); }
    .nx-btn.nx-ml-add:hover { background: #fff; border-color: var(--nx-gold); }
    .nx-btn.nx-ml-add .nx-star { font-size: 14px; color: #D4A017; margin-right: 6px; }
    .nx-btn.nx-ml-add[aria-pressed="false"] { animation: nx-ping 1.6s ease-out .8s 3; }
    .nx-btn.nx-ml-add[aria-pressed="true"] { background: rgba(0,0,0,.35); border-color: var(--nx-gold); color: var(--nx-gold) !important; }
    .nx-btn.nx-ml-add[aria-pressed="true"] .nx-star { color: var(--nx-gold); }
    @keyframes nx-ping { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.7); } 100% { box-shadow: 0 0 0 14px rgba(255,255,255,0); } }

    /* My Leagues intro: dimmed overlay, spotlight on the button, puck, shards, callout. */
    .nx-mli { position: fixed; inset: 0; z-index: 2147482000; overflow: hidden; }
    .nx-mli.fx::after { display: none; }
    .nx-mli::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px); }
    .nx-mli-dim { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .nx-mli-spot { position: fixed; border-radius: 10px; pointer-events: none; }
    .nx-mli-spot.on { outline: 3px dashed var(--nx-gold); outline-offset: 4px; animation: nx-spot 1s steps(2) infinite; }
    @keyframes nx-spot { 50% { outline-color: #fff; } }
    .nx-mli-puck { position: fixed; left: 0; top: 0; width: 36px; height: 24px; margin: -12px 0 0 -18px; pointer-events: none; image-rendering: pixelated; }
    .nx-mli-puck svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 8px var(--nx-gold)); }
    .nx-mli-bit { position: fixed; left: 0; top: 0; width: 6px; height: 6px; pointer-events: none; }
    .nx-mli-flash { position: fixed; inset: 0; background: #fff; pointer-events: none; opacity: 0; }
    .nx-mli-pow { position: fixed; pointer-events: none; font: 400 14px var(--nx-px); color: var(--nx-gold); white-space: nowrap;
      text-shadow: 3px 3px 0 var(--nx-red), -1px -1px 0 #000, 1px 1px 0 #000; }
    .nx-mli-card { position: fixed; width: 340px; max-width: calc(100vw - 24px); padding: 16px 18px 14px; color: #fff;
      background: #0B1022; border: 3px solid var(--nx-gold); border-radius: 4px; box-shadow: 6px 6px 0 rgba(0,0,0,.6), 0 0 0 3px #0B1022 inset;
      animation: nx-card-in .35s steps(5) both; }
    .nx-mli-card::before { content: ""; position: absolute; top: -12px; right: var(--arrow, 40px); width: 18px; height: 18px; background: #0B1022;
      border: 3px solid var(--nx-gold); border-right: 0; border-bottom: 0; transform: rotate(45deg); }
    @keyframes nx-card-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
    .nx-mli-card h2 { margin: 0 0 10px; font: 400 11px/1.5 var(--nx-px); color: var(--nx-gold); letter-spacing: .5px; }
    .nx-mli-card p { margin: 0 0 10px; font: 400 14px/1.45 var(--nx-ui); color: #DDE4F0; }
    .nx-mli-card ol { margin: 0 0 12px; padding: 0; list-style: none; counter-reset: s; }
    .nx-mli-card .nx-star { font-size: 1.3em; line-height: 1; }
    .nx-mli-card li { counter-increment: s; display: flex; gap: 10px; align-items: baseline; padding: 4px 0; font: 400 14px/1.4 var(--nx-ui); color: #fff; }
    .nx-mli-card li::before { content: counter(s); flex: none; font: 400 9px var(--nx-px); color: #0B1022; background: var(--nx-gold); padding: 4px 5px; border-radius: 2px; }
    .nx-mli-card .tip { font-size: 12px; color: #9AA6BC; }
    .nx-mli-card .tip b { display: inline-grid; place-items: center; width: 18px; height: 18px; font: 400 8px var(--nx-px); color: #111; background: var(--nx-gold); border-radius: 50%; vertical-align: middle; }
    .nx-mli-row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
    .nx-mli-row button { font: 400 9px var(--nx-px); letter-spacing: .5px; padding: 10px 12px; border-radius: 2px; cursor: pointer;
      color: #fff; background: transparent; border: 2px solid rgba(255,255,255,.45); }
    .nx-mli-row button.go { color: #111; background: var(--nx-gold); border-color: var(--nx-gold); box-shadow: 3px 3px 0 #000; }
    .nx-mli-row button:hover { filter: brightness(1.12); border-color: #fff; }
    .nx-mli-row button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .nx-btn.nx-ml-add[aria-pressed="false"], .nx-mli-spot.on, .nx-mli-card, .nx-ml-help.pop, .nx-ml-btn.hit { animation: none; }
    }

    .nx-modal { position: fixed; inset: 0; z-index: 2147483100; display: grid; place-items: center; padding: 16px; background: rgba(5,8,14,.66); backdrop-filter: blur(3px); }
    .nx-modal[hidden] { display: none; }
    .nx-modal-box { width: min(640px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; overflow: hidden;
      background: var(--nx-card); color: var(--nx-text); border: 1px solid var(--nx-line2); border-top: 4px solid var(--nx-red); border-radius: 12px; box-shadow: 0 30px 80px rgba(0,0,0,.55); }
    .nx-modal-h { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--nx-line); }
    .nx-modal-h h2 { margin: 0; font: 600 20px var(--nx-cond); letter-spacing: 1.5px; text-transform: uppercase; }
    .nx-x { font-size: 18px; line-height: 1; color: var(--nx-mute); background: none; border: 0; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
    .nx-x:hover { color: var(--nx-text); background: var(--nx-card2); }
    .nx-modal-b { padding: 14px 18px; overflow-y: auto; font-size: 14px; }
    .nx-modal-f { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--nx-line); background: var(--nx-bg2); }
    .nx-mm-dirty { margin-right: auto; font-size: 13px; color: var(--nx-mute); }
    .nx-mm-dirty.warn { color: var(--nx-red); font-weight: 600; }
    .nx-mm-help { margin: 0 0 12px; color: var(--nx-mute); font-size: 13px; }
    .nx-mm-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--nx-line); }
    .nx-mm-row .nx-logo { width: 28px; height: 28px; image-rendering: pixelated; flex: none; }
    .nx-mm-row .info { flex: 1; min-width: 0; }
    .nx-mm-row input { width: 100%; font: 600 14px var(--nx-ui); color: var(--nx-text); background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 4px 6px; }
    .nx-mm-row input:hover { border-color: var(--nx-line2); }
    .nx-mm-row input:focus { border-color: var(--nx-gold); background: var(--nx-bg2); outline: none; }
    .nx-mm-row small { display: block; padding: 0 7px; font-size: 12px; color: var(--nx-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-mm-row .acts { display: flex; gap: 4px; flex: none; }
    .nx-ib { width: 32px; height: 32px; display: grid; place-items: center; font-size: 14px; color: var(--nx-mute); background: var(--nx-bg2);
      border: 1px solid var(--nx-line2); border-radius: 6px; cursor: pointer; }
    .nx-ib:hover:not(:disabled) { color: var(--nx-text); border-color: var(--nx-gold); }
    .nx-ib:disabled { opacity: .35; cursor: default; }
    .nx-ib.del:hover { color: #fff; background: var(--nx-red); border-color: var(--nx-red); }
    .nx-mm-empty { padding: 14px 0; color: var(--nx-mute); }
    .nx-mm-add { display: flex; gap: 8px; margin-top: 12px; }
    .nx-mm-add input, .nx-mm-sec textarea { flex: 1; min-width: 0; font: 13px var(--nx-ui); color: var(--nx-text); background: var(--nx-bg2);
      border: 1px solid var(--nx-line2); border-radius: 6px; padding: 8px 10px; }
    .nx-mm-sec textarea { width: 100%; margin: 8px 0; resize: vertical; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    .nx-mm-add input:focus, .nx-mm-sec textarea:focus { outline: 2px solid var(--nx-gold); outline-offset: 0; }
    .nx-mm-msg { min-height: 20px; margin-top: 8px; font-size: 13px; }
    .nx-mm-msg.ok { color: var(--nx-win); } .nx-mm-msg.err { color: var(--nx-loss); }
    .nx-v1[data-nx-theme="day"] .nx-mm-msg.ok { color: #0a7a35; } .nx-v1[data-nx-theme="day"] .nx-mm-msg.err { color: #b00020; }
    .nx-mm-sec { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--nx-line2); }
    .nx-mm-sec h3 { margin: 0 0 4px; font: 600 14px var(--nx-cond); letter-spacing: 1.2px; text-transform: uppercase; }
    .nx-mm-sec p { margin: 0 0 10px; font-size: 12px; color: var(--nx-mute); }
    .nx-mm-sec .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .nx-mm-sec summary { cursor: pointer; margin-top: 10px; font-size: 13px; color: var(--nx-gold); }
    .nx-mm-box { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--nx-line2); border-left: 4px solid var(--nx-gold); border-radius: 6px; background: var(--nx-bg2); font-size: 13px; }
    .nx-mm-box.danger { border-left-color: var(--nx-red); }
    .nx-mm-box[hidden] { display: none; }
    .nx-mm-box .row { margin-top: 8px; }
    .nx-mbtn { font: 600 13px var(--nx-ui); color: var(--nx-text); background: var(--nx-bg2); border: 1px solid var(--nx-line2); border-radius: 6px; padding: 8px 14px; cursor: pointer; }
    .nx-mbtn:hover:not(:disabled) { border-color: var(--nx-gold); }
    .nx-mbtn.primary { color: #fff; background: var(--nx-red); border-color: var(--nx-red); }
    .nx-mbtn.primary:hover:not(:disabled) { filter: brightness(1.12); }
    .nx-mbtn.primary:disabled { opacity: .45; cursor: default; }
    .nx-mbtn.danger { color: #fff; background: var(--nx-red); border-color: var(--nx-red); }
    `);
  }

  function mlMenuHtml() {
    const l = myLeagues.all();
    const cur = PAGE === 'coach' ? (parseCoachUrl(HREF) || {}).id : '';
    return (l.length
      ? l.map((x) => `<a class="nx-ml-item${x.id === cur ? ' cur' : ''}" href="${esc(x.path)}">${logoImg(x.team)}<span><b>${esc(mlTitle(x))}</b><small>${esc(mlSub(x))}</small></span></a>`).join('')
      : '<div class="nx-ml-empty">No leagues yet. Open one of your coach pages and press <b>★ Add to My Leagues</b>.</div>')
      + '<button type="button" class="nx-ml-manage">⚙ Manage, back up &amp; restore…</button>';
  }

  // Top-bar menu + manager dialog, wired once per V1 root.
  function mlWire(app) {
    mlSetup();
    const btn = $('.nx-ml-btn', app), menu = $('.nx-ml-menu', app), count = $('.nx-ml-count', app);
    const paint = () => { menu.innerHTML = mlMenuHtml(); const n = myLeagues.all().length; count.textContent = n ? String(n) : ''; };
    const setOpen = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) paint(); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nx-ml')) setOpen(false); });
    menu.addEventListener('click', (e) => { if (e.target.closest('.nx-ml-manage')) { setOpen(false); openManager(app); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('nx:myleagues', paint);
    paint();
    app.addEventListener('click', (e) => { if (e.target.closest('[data-ml-manage]')) { e.preventDefault(); openManager(app); } });

    // "?" badge replays the intro. It shows once the intro has run (or the user already has leagues).
    const help = $('.nx-ml-help', app);
    help.hidden = !(store.get('mlIntro', false) || myLeagues.all().length);
    help.addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); mlIntro(app); });
    if (mlIntroDue()) {
      setTimeout(() => { if (app.classList.contains('nx-active') && !$('.nx-mli') && !$('.nx-modal:not([hidden])')) { setOpen(false); mlIntro(app); } }, 1200);
    }
  }

  // First visit: the puck intro, once per browser. Settings › "Show again" stores false to replay it even with leagues saved.
  function mlIntroDue() {
    const f = store.get('mlIntro', null);
    return f === false || (f == null && !myLeagues.all().length);
  }

  // ---------- My Leagues: puck + smash effects ----------
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const PUCK_SVG = '<svg viewBox="0 0 12 8" shape-rendering="crispEdges" aria-hidden="true">'
    + '<rect x="2" y="0" width="8" height="1" fill="#4b5263"/><rect x="0" y="1" width="12" height="2" fill="#2b303b"/>'
    + '<rect x="3" y="1" width="4" height="1" fill="#6b7487"/><rect x="0" y="3" width="12" height="3" fill="#0d0f14"/>'
    + '<rect x="1" y="4" width="10" height="1" fill="#22262f"/><rect x="2" y="6" width="8" height="1" fill="#0d0f14"/></svg>';
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  // Slap shot along a curve from `a` to `b`, with a fading pixel trail. Resolves on impact.
  function mlPuck(layer, a, b, ms = 700) {
    const c = { x: b.x - (b.x - a.x) * 0.15, y: a.y - (a.y - b.y) * 0.95 };
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x, y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${t * 900}deg) scale(${1.7 - t * 0.8})`, offset: t });
    }
    const pucks = [0, 1, 2, 3].map((i) => {
      const p = document.createElement('div');
      p.className = 'nx-mli-puck';
      p.innerHTML = PUCK_SVG;
      p.style.opacity = String(1 - i * 0.28);
      layer.appendChild(p);
      p.animate(frames, { duration: ms, delay: i * 28, easing: 'linear', fill: 'both' });
      return p;
    });
    return wait(ms).then(() => { pucks.forEach((p) => p.remove()); });
  }

  // Impact: the button shakes, the screen flashes, pixel shards fly and a word pops.
  function mlSmash(layer, btn, word) {
    const { x, y } = centerOf(btn);
    btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
    setTimeout(() => btn.classList.remove('hit'), 500);
    const flash = document.createElement('div');
    flash.className = 'nx-mli-flash';
    layer.appendChild(flash);
    flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 180 }).onfinish = () => flash.remove();
    const cs = getComputedStyle(btn);
    const colors = ['#fff', cs.getPropertyValue('--nx-gold') || '#F1BE48', cs.getPropertyValue('--nx-red') || '#C8102E', '#9AA6BC'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('div');
      s.className = 'nx-mli-bit';
      s.style.background = colors[i % colors.length];
      layer.appendChild(s);
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.4, d = 40 + Math.random() * 80;
      const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d;
      s.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy * 0.6}px) rotate(180deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x + dx * 1.2}px, ${y + dy * 0.6 + 50}px) rotate(270deg)`, opacity: 0 },
      ], { duration: 700, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => s.remove();
    }
    const pow = document.createElement('div');
    pow.className = 'nx-mli-pow';
    pow.textContent = word;
    layer.appendChild(pow);
    const r = btn.getBoundingClientRect();
    pow.style.left = Math.max(8, r.left - pow.offsetWidth - 18) + 'px';
    pow.style.top = (r.top + r.height / 2 - 10) + 'px';
    pow.animate([
      { transform: 'scale(0) rotate(-12deg)', opacity: 1 }, { transform: 'scale(1.35) rotate(-6deg)', opacity: 1, offset: 0.2 },
      { transform: 'scale(1) rotate(-6deg)', opacity: 1, offset: 0.75 }, { transform: 'scale(1) rotate(-6deg) translateY(-8px)', opacity: 0 },
    ], { duration: 1100, easing: 'ease-out', fill: 'both' }).onfinish = () => pow.remove();
  }

  // Coach page: after "★ Add to My Leagues", a puck flies from that button into the top-bar button.
  function mlShoot(app, fromEl, word) {
    const btn = $('.nx-ml-btn', app);
    if (reducedMotion() || !btn.getBoundingClientRect().width || !fromEl.getBoundingClientRect().width) return;
    const layer = document.createElement('div');
    layer.className = 'nx-mli';
    layer.style.pointerEvents = 'none';
    layer.classList.add('fx');
    app.appendChild(layer);
    mlPuck(layer, centerOf(fromEl), centerOf(btn), 600).then(() => { mlSmash(layer, btn, word); setTimeout(() => layer.remove(), 1200); });
  }

  // The intro: spotlight the top-bar button, shoot a puck at it, then explain My Leagues.
  async function mlIntro(app) {
    const btn = $('.nx-ml-btn', app), help = $('.nx-ml-help', app);
    if (!btn.getBoundingClientRect().width || $('.nx-mli:not(.fx)', app)) return;
    store.set('mlIntro', true);
    const add = $('.nx-ml-add:not([hidden])', app);
    const canAdd = add && add.getAttribute('aria-pressed') === 'false';
    const ov = document.createElement('div');
    ov.className = 'nx-mli';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'nx-mli-title');
    // Dim everything except the top-bar button (and, on a coach page not yet saved, the Add button).
    const lit = canAdd ? [btn, add] : [btn];
    ov.innerHTML = `<svg class="nx-mli-dim" aria-hidden="true"><defs><mask id="nx-mli-mask"><rect width="100%" height="100%" fill="#fff"/>
      ${lit.map(() => '<rect rx="10" fill="#000"/>').join('')}</mask></defs><rect width="100%" height="100%" fill="rgba(5,8,14,.8)" mask="url(#nx-mli-mask)"/></svg>`
      + lit.map(() => '<div class="nx-mli-spot"></div>').join('');
    const spots = $$('.nx-mli-spot', ov), holes = $$('mask rect[rx]', ov);
    const place = () => {
      lit.forEach((el, i) => {
        const r = el.getBoundingClientRect(), box = { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 };
        Object.assign(spots[i].style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
        holes[i].setAttribute('x', box.x); holes[i].setAttribute('y', box.y); holes[i].setAttribute('width', box.w); holes[i].setAttribute('height', box.h);
      });
      const r = btn.getBoundingClientRect();
      const card = $('.nx-mli-card', ov);
      if (!card) return;
      const cx = r.left + r.width / 2, w = card.offsetWidth;
      const left = Math.min(innerWidth - 12 - w, Math.max(12, cx - w + 48));
      card.style.left = left + 'px';
      card.style.top = r.bottom + 22 + 'px';
      card.style.setProperty('--arrow', Math.max(10, Math.min(w - 30, left + w - cx - 12)) + 'px');
    };
    place();
    app.appendChild(ov);
    const htmlEl = document.documentElement, prevOverflow = htmlEl.style.overflow;
    htmlEl.style.overflow = 'hidden';
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      ov.remove();
      htmlEl.style.overflow = prevOverflow;
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey, true);
      btn.focus();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = $$('.nx-mli-card button', ov);
        if (!f.length) { e.preventDefault(); return; }
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', (e) => { if (!e.target.closest('.nx-mli-card')) close(); });

    if (!reducedMotion()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      await wait(450);
      if (done) return;
      await mlPuck(ov, { x: innerWidth * 0.2, y: innerHeight + 30 }, centerOf(btn));
      if (done) return;
      mlSmash(ov, btn, 'BAR DOWN!');
      await wait(380);
      if (done) return;
    }
    help.hidden = false;
    help.classList.remove('pop'); void help.offsetWidth; help.classList.add('pop');
    spots.forEach((x) => x.classList.add('on'));
    const card = document.createElement('div');
    card.className = 'nx-mli-card';
    card.innerHTML = `<h2 id="nx-mli-title"><span class="nx-star">★</span> NEW! MY LEAGUES</h2>
      <p>Keep your coach page from every league and level right up here, one click away.</p>
      <ol><li><span>Open your coach page.</span></li><li><span>Press <b><span class="nx-star">★</span> Add to My Leagues</b>${canAdd ? ' (lit up on this page)' : ''}.</span></li>
        <li><span>Jump back any time from this button.</span></li></ol>
      <div class="tip">Lost? Press <b>?</b> to see this again.</div>
      <div class="nx-mli-row">${canAdd ? '<button type="button" data-act="ok">Got it</button><button type="button" class="go" data-act="add"><span class="nx-star">★</span> Add this team</button>'
        : '<button type="button" class="go" data-act="ok">Got it</button>'}</div>`;
    ov.appendChild(card);
    place();
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      close();
      if (b.dataset.act === 'add') add.click();
    });
    $('.go', card).focus();
  }

  function openManager(app) {
    let modal = $('.nx-modal', app);
    if (!modal) modal = buildManager(app);
    modal.nxOpen();
  }

  function buildManager(app) {
    const modal = document.createElement('div');
    modal.className = 'nx-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'nx-mm-title');
    modal.innerHTML = `
      <div class="nx-modal-box">
        <div class="nx-modal-h"><h2 id="nx-mm-title">★ My Leagues</h2><button type="button" class="nx-x" data-act="close" aria-label="Close">✕</button></div>
        <div class="nx-modal-b">
          <p class="nx-mm-help">Your own coach pages, one per league. They're saved only in this browser, with no account. Rename, reorder or remove them, then press <b>Save</b>.</p>
          <div class="nx-mm-list"></div>
          <form class="nx-mm-add"><input type="text" inputmode="url" placeholder="Paste a coach page link to add it…" aria-label="Coach page link"><button type="submit" class="nx-mbtn">Add</button></form>
          <div class="nx-mm-msg" role="status" aria-live="polite"></div>

          <div class="nx-mm-sec">
            <h3>Backup &amp; restore</h3>
            <p>Download a backup file of your leagues, coach Discord links and settings (view, filters). Restore it on another browser or computer.</p>
            <div class="row">
              <button type="button" class="nx-mbtn" data-act="export">⬇ Download backup</button>
              <button type="button" class="nx-mbtn" data-act="import">⬆ Restore from file…</button>
              <input type="file" accept=".json,application/json" hidden>
            </div>
            <details><summary>…or paste backup text</summary>
              <textarea rows="4" placeholder='{"app":"nhl94-its-in-the-script", …}' aria-label="Backup text"></textarea>
              <button type="button" class="nx-mbtn" data-act="paste">Check pasted backup</button>
            </details>
            <div class="nx-mm-box" data-box="restore" hidden></div>
          </div>

          <div class="nx-mm-sec">
            <h3>Clear history</h3>
            <p>Remove your saved leagues, or wipe everything this script has saved in this browser.</p>
            <div class="row">
              <button type="button" class="nx-mbtn" data-act="clear">Clear My Leagues</button>
              <button type="button" class="nx-mbtn" data-act="reset">Reset everything</button>
            </div>
            <div class="nx-mm-box danger" data-box="confirm" hidden></div>
          </div>
        </div>
        <div class="nx-modal-f"><span class="nx-mm-dirty"></span>
          <button type="button" class="nx-mbtn" data-act="close">Close</button>
          <button type="button" class="nx-mbtn primary" data-act="save" disabled>Save</button>
        </div>
      </div>`;
    app.appendChild(modal);

    const list = $('.nx-mm-list', modal), msgEl = $('.nx-mm-msg', modal), dirtyEl = $('.nx-mm-dirty', modal);
    const saveBtn = $('[data-act="save"]', modal), fileIn = $('input[type="file"]', modal), restoreBox = $('[data-box="restore"]', modal);
    const confirmBox = $('[data-box="confirm"]', modal), addForm = $('.nx-mm-add', modal), addIn = $('input', addForm);
    let draft = [], dirty = false, closeWarned = false, pending = null, lastFocus = null;

    const msg = (text, kind = '') => { msgEl.textContent = text; msgEl.className = 'nx-mm-msg ' + kind; };
    const setDirty = (d) => {
      dirty = d; closeWarned = false; saveBtn.disabled = !d;
      dirtyEl.className = 'nx-mm-dirty'; dirtyEl.textContent = d ? 'Unsaved changes' : '';
    };
    const renderList = () => {
      list.innerHTML = draft.length ? draft.map((x, i) => `
        <div class="nx-mm-row" data-i="${i}">
          ${logoImg(x.team)}
          <div class="info"><input value="${esc(x.label || defName(x))}" placeholder="${esc(defName(x))}" aria-label="Name for this league" data-f="label" title="Click to rename">
            <small>${esc(mlSub(x) || x.path)}</small></div>
          <div class="acts">
            <button type="button" class="nx-ib" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up">↑</button>
            <button type="button" class="nx-ib" data-act="down" ${i === draft.length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down">↓</button>
            <button type="button" class="nx-ib del" data-act="del" aria-label="Remove" title="Remove">✕</button>
          </div>
        </div>`).join('') : '<div class="nx-mm-empty">No leagues yet. Add one with <b>★ Add to My Leagues</b> on a coach page, or paste a coach page link below.</div>';
    };
    const showConfirm = (html) => { confirmBox.innerHTML = html; confirmBox.hidden = !html; };
    const showRestore = (html) => { restoreBox.innerHTML = html; restoreBox.hidden = !html; };

    modal.nxOpen = () => {
      draft = myLeagues.all(); setDirty(false); msg(''); showConfirm(''); showRestore(''); pending = null;
      renderList();
      lastFocus = document.activeElement;
      modal.hidden = false;
      (addIn).focus();
    };
    const close = (force) => {
      if (dirty && !force && !closeWarned) {
        closeWarned = true;
        dirtyEl.className = 'nx-mm-dirty warn';
        dirtyEl.textContent = 'You have unsaved changes. Press Save, or Close again to discard them.';
        return;
      }
      modal.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    list.addEventListener('input', (e) => {
      const row = e.target.closest('.nx-mm-row');
      if (row && e.target.dataset.f === 'label') {
        const x = draft[+row.dataset.i], v = e.target.value.trim().slice(0, 80);
        x.label = v === defName(x) ? '' : v; // empty label = use the team name
        setDirty(true);
      }
    });

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = parseCoachUrl(addIn.value);
      if (!p) return msg('That doesn\'t look like a coach page link. It should contain "coachpage.php?lg=…&team_ID=…".', 'err');
      if (draft.some((x) => x.id === p.id)) return msg('That team is already in your list.', 'err');
      msg('Looking up that coach page…');
      let info = {};
      try { info = await fetchCoachInfo(p); } catch (err) { info = {}; }
      draft.push(cleanLeague({ ...p, ...info, label: '', addedAt: Date.now() }));
      addIn.value = '';
      renderList(); setDirty(true);
      msg(info.team ? `Added ${fullTeamName(info.team)}${info.coach ? ' (' + info.coach + ')' : ''}. Press Save to keep it.`
        : "Added, but I couldn't read the team name from that page. You can name it yourself. Press Save to keep it.", info.team ? 'ok' : 'err');
    });

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (f) previewRestore(await f.text());
    });

    function previewRestore(text) {
      showConfirm('');
      try {
        pending = readBackup(text);
        const names = pending.leagues.map((x) => esc(mlTitle(x))).join(', ') || 'no leagues';
        const when = pending.exportedAt ? new Date(pending.exportedAt).toLocaleString() : 'unknown date';
        showRestore(`<b>Backup from ${esc(when)}</b><br>${pending.leagues.length} league${pending.leagues.length === 1 ? '' : 's'}: ${names}<br>
          ${pending.coachLinks ? Object.keys(pending.coachLinks).length + ' Discord link(s), ' : ''}${Object.keys(pending.prefs).length} saved settings. Restoring <b>replaces</b> your current ${myLeagues.all().length} league(s) and settings.
          <div class="row"><button type="button" class="nx-mbtn primary" data-act="restore-yes">Restore</button><button type="button" class="nx-mbtn" data-act="restore-no">Cancel</button></div>`);
      } catch (err) { pending = null; showRestore(''); msg(err.message, 'err'); }
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) return close(false);
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      const row = b.closest('.nx-mm-row');
      const i = row ? +row.dataset.i : -1;
      if (act === 'close') close(false);
      else if (act === 'up' && i > 0) { [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; renderList(); setDirty(true); }
      else if (act === 'down' && i < draft.length - 1) { [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; renderList(); setDirty(true); }
      else if (act === 'del') { const gone = draft.splice(i, 1)[0]; renderList(); setDirty(true); msg(`Removed ${mlTitle(gone)}. Press Save to confirm.`); }
      else if (act === 'save') { myLeagues.save(draft); draft = myLeagues.all(); renderList(); setDirty(false); msg('Saved ✓', 'ok'); }
      else if (act === 'export') {
        if (dirty) return msg('Save your changes first, then download the backup.', 'err');
        downloadBackup();
        msg('Backup downloaded ✓ Keep that file somewhere safe.', 'ok');
      }
      else if (act === 'import') fileIn.click();
      else if (act === 'paste') previewRestore($('textarea', modal).value);
      else if (act === 'restore-no') { pending = null; showRestore(''); }
      else if (act === 'restore-yes' && pending) {
        applyBackup(pending);
        pending = null; showRestore('');
        draft = myLeagues.all(); renderList(); setDirty(false);
        msg('Restored ✓ Reload the page to apply restored filters and view.', 'ok');
      }
      else if (act === 'clear') {
        showRestore('');
        showConfirm(`Remove all ${myLeagues.all().length} saved league(s) from this browser? This can't be undone unless you have a backup.
          <div class="row"><button type="button" class="nx-mbtn danger" data-act="clear-yes">Yes, clear My Leagues</button><button type="button" class="nx-mbtn" data-act="confirm-no">Cancel</button></div>`);
      }
      else if (act === 'reset') {
        showRestore('');
        showConfirm(`Remove My Leagues, coach Discord links <b>and</b> every setting this script saved (view choice, filters, collapsed groups)? The page will reload.
          <div class="row"><button type="button" class="nx-mbtn danger" data-act="reset-yes">Yes, reset everything</button><button type="button" class="nx-mbtn" data-act="confirm-no">Cancel</button></div>`);
      }
      else if (act === 'confirm-no') showConfirm('');
      else if (act === 'clear-yes') { myLeagues.save([]); draft = []; renderList(); setDirty(false); showConfirm(''); msg('My Leagues cleared.', 'ok'); }
      else if (act === 'reset-yes') { resetAll(); location.reload(); }
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = $$('button:not(:disabled), input:not([type="file"]), textarea, summary, [href]', modal).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    return modal;
  }

  function v1Mount(innerHtml) {
    const app = document.createElement('div');
    app.className = 'nx-root nx-v1';
    app.setAttribute('data-nx-theme', getMode());
    const chrome = v1Chrome();
    app.innerHTML = chrome.head + `<main class="nx-main">${v1LeagueBar()}${innerHtml}${chrome.foot}</main>`;
    document.body.appendChild(app);
    v1WirePickers(app);
    mlWire(app);
    // Collapsed menu (narrow windows): toggle, close on outside click or Escape.
    const menuBtn = $('.nx-menu-btn', app), menu = $('.nx-nav', app);
    const setMenu = (open) => { menu.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nx-nav, .nx-menu-btn')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    return app;
  }

  // ---------- V1 · Coach page ----------
  function renderCoachV1() {
    v1Setup();
    const gfN = parseInt(stats.gf, 10) || 0, gaN = parseInt(stats.ga, 10) || 0, diff = gfN - gaN;

    const streakShort = stats.streak.replace(/^Won\s*/i, 'W').replace(/^Lost\s*/i, 'L').replace(/^Tied?\s*/i, 'T');
    const statCells = [
      ['Record', stats.record], ['Home', stats.home], ['Away', stats.away], ['Streak', streakShort],
      ['GF', stats.gf], ['GA', stats.ga], ['Diff', (diff > 0 ? '+' : '') + diff, diff > 0 ? 'pos' : diff < 0 ? 'neg' : ''], ['GF/G', stats.gfg], ['GA/G', stats.gag],
    ].map(([k, v, cls]) => `<div class="nx-stat"><div class="k">${k}</div><div class="v ${cls || ''}">${esc(v || '–')}</div></div>`).join('');

    const cpHtml = checkpoint ? (() => {
      const need = checkpoint.left + playedCount;
      const pct = need ? Math.min(100, Math.round((playedCount / need) * 100)) : 100;
      const urgent = checkpoint.left > 0 && checkpoint.days != null && checkpoint.days <= 3;
      const dueTxt = checkpoint.left === 0 ? 'Complete' : checkpoint.days == null ? checkpoint.dateText
        : checkpoint.days < 0 ? 'Past due' : checkpoint.days === 0 ? 'Due today' : `${checkpoint.days} day${checkpoint.days === 1 ? '' : 's'} left`;
      return `<div class="nx-cp${urgent ? ' urgent' : ''}${checkpoint.left === 0 ? ' done' : ''}">
        <div class="nx-cp-num">${checkpoint.left}</div>
        <div class="nx-cp-txt"><b>Games left</b> for Checkpoint ${esc(checkpoint.num)}<br>Due ${esc(checkpoint.dateText)}</div>
        <div class="nx-cp-bar" title="${playedCount} of ${need} played"><i style="width:${pct}%"></i></div>
        <div class="nx-cp-due">${esc(dueTxt)}</div>
      </div>`;
    })() : '';

    // Coach filter dropdown: logo + coach + their Discord DM button, pick one or more.
    const coachOf = (opp) => (teamInfo[opp] && teamInfo[opp].coach) || opp;
    const coachFilterHtml = `<div class="nx-cf">
        <button type="button" class="nx-cf-btn" aria-haspopup="true" aria-expanded="false" title="Show games against these coaches"><span class="nx-lab">FILTER BY COACH</span><span class="nx-cf-val"></span><span class="nx-cf-car" aria-hidden="true"></span></button>
        <button type="button" class="nx-clear" id="nx-clear" hidden>Clear</button>
        <div class="nx-cf-menu" role="menu" aria-label="Filter by coach" hidden>
          <div class="nx-cf-item all" role="menuitemradio" tabindex="-1" data-opp=""><span class="nx-cf-box" aria-hidden="true"></span><span class="nm">All coaches</span></div>
          ${groups.map((g) => `<div class="nx-cf-item" role="menuitemcheckbox" tabindex="-1" data-opp="${esc(g.opp)}" title="${esc(fullTeamName(g.opp))}">
            <span class="nx-cf-box" aria-hidden="true"></span>${logoImg(g.opp)}<span class="nm">${esc(coachOf(g.opp))}</span>${dcSlot(teamInfo[g.opp] && teamInfo[g.opp].coach)}</div>`).join('')}
        </div></div>`;

    const schedRows = groups.map((g) => {
      const info = teamInfo[g.opp] || {};
      const pips = g.games.map((x) => `<i class="${x.result}" title="Gm ${esc(x.gm)} · ${x.isHome ? 'Home' : 'Away'}${x.played ? ' · ' + x.result + ' ' + esc(x.score) : ''}"></i>`).join('');
      const fullName = esc(fullTeamName(g.opp));
      const head = `<tr class="nx-grp" data-opp="${esc(g.opp)}"><td colspan="6"><div class="nx-grp-in" title="Click to collapse / expand">
          <span class="nx-chev">▼</span>${logoImg(g.opp)}
          <div><div class="nx-grp-name">${info.href ? `<a href="${esc(info.href)}">${fullName}</a>` : fullName}</div>
            <div><span class="nx-grp-coach">${esc(info.coach || '')}</span>${dcSlot(info.coach)}${info.division ? ` <span class="nx-grp-div">· ${esc(info.division)}</span>` : ''}</div></div>
          <div class="nx-grp-right"><span class="nx-pips">${pips}</span><span class="nx-grp-rec">${g.w}-${g.l}-${g.t}</span>
            <span class="nx-grp-left${g.left ? '' : ' done'}">${g.left ? g.left + ' to play' : 'Done ✓'}</span></div>
        </div></td></tr>`;
      const rows = g.games.map((x) => {
        const action = x.href
          ? `<a class="nx-go ${x.played ? 'box' : 'log'}" href="${esc(x.href)}"${x.played ? ' target="_blank"' : ''}><span>${x.played ? 'Box Score' : 'Log Game'}</span></a>` : '';
        return `<tr class="g-row ${x.isHome ? 'home' : 'away'}" data-opp="${esc(g.opp)}" data-played="${x.played ? 1 : 0}">
          <td class="gm">${esc(x.gm)}</td>
          <td class="act">${action}</td>
          <td class="ha"><span class="nx-ha ${x.isHome ? 'h' : 'a'}">${x.isHome ? 'Home' : 'Away'}</span></td>
          <td class="sc">${x.played ? esc(x.score) : ''}</td>
          <td class="rs">${x.result ? `<span class="nx-res ${x.result}">${x.result}</span>` : ''}</td>
          <td class="tm">${x.time && x.time !== '-' ? esc(x.time) : ''}</td>
        </tr>`;
      }).join('');
      return head + rows;
    }).join('');

    const standingsHtml = standings ? `
      <div class="nx-card">
        <div class="nx-card-h"><h2>${esc(standings.division)}</h2>${standingsLink ? `<a class="nx-link" href="${esc(standingsLink.href)}">Full standings →</a>` : ''}</div>
        <table class="nx-st"><thead><tr><th></th><th>Team</th><th>W</th><th>L</th><th>T</th><th>DNP</th><th>Pts</th></tr></thead><tbody>
        ${standings.rows.map((r, i) => {
          const info = teamInfo[r.team] || {};
          return `<tr class="${r.team === myTeam ? 'me' : ''}"><td class="pos">${i + 1}</td>
            <td class="tm"><a class="nx-tmcell" href="${esc(info.href || '#')}">${logoImg(r.team)}<span><div class="n">${esc(r.team)}</div><div class="c">${esc(info.coach || '')}</div></span></a></td>
            <td>${esc(r.w)}</td><td>${esc(r.l)}</td><td>${esc(r.t)}</td><td>${esc(r.dnp)}</td><td class="pts">${esc(r.pts)}</td></tr>`;
        }).join('')}
        </tbody></table>
      </div>` : '';

    const profileHtml = profile.length ? `
      <div class="nx-card"><div class="nx-card-h"><h2>Coach Profile</h2></div>
        <div class="nx-prof">${profile.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>` : '';

    const app = v1Mount(`
        <section class="nx-hero">
          <div class="nx-hero-in">
            <div class="nx-hero-logo">${bigLogo ? `<img src="${esc(bigLogo.src)}" alt="">` : ''}</div>
            <div class="nx-hero-txt">
              <div class="nx-eyebrow">${esc(levelName)} <span style="opacity:.5">|</span> ${esc(leagueName.toUpperCase())}</div>
              <div class="nx-team">${esc(teamFullName || myTeam)}</div>
              <div class="nx-coach">Head Coach <b>${esc(coachName)}</b>${dcSlot(coachName, true)}</div>
              <div class="nx-actions">
                <button type="button" class="nx-btn nx-ml-add" hidden><span><span class="nx-star">★</span><span class="t"></span></span></button>
                ${rosterLink ? `<a class="nx-btn gold" href="${esc(rosterLink.href)}" target="_blank"><span>Roster Stats</span></a>` : ''}
                ${standingsLink ? `<a class="nx-btn" href="${esc(standingsLink.href)}"><span>Standings</span></a>` : ''}
                <a class="nx-btn" href="/html/matchup.php"><span>Head to Head</span></a>
              </div>
            </div>
            ${rank ? `<div class="nx-hero-rank"><div class="big">${ordinal(rank.pos).toUpperCase()}</div><div class="lab">${esc(standings.division)} · ${esc(rank.pts)} pts</div></div>` : ''}
          </div>
          <div class="nx-statbar">${statCells}</div>
        </section>

        <div class="nx-grid">
          <div>
            <div class="nx-card">
              <div class="nx-card-h"><h2>Schedule</h2><span class="nx-meta">${playedCount} / ${games.length} played</span></div>
              ${cpHtml}
              ${games.length ? `
              <div class="nx-ctrl">
                <div class="nx-ctrl-row">
                  <div class="nx-seg" id="nx-seg">
                    <button type="button" data-v="all">All<span class="n">${games.length}</span></button>
                    <button type="button" data-v="todo">To Play<span class="n">${games.length - playedCount}</span></button>
                    <button type="button" data-v="done">Final<span class="n">${playedCount}</span></button>
                  </div>
                  ${coachFilterHtml}
                </div>
              </div>
              <table class="nx-sched">
                <thead><tr><th>Gm</th><th></th><th>H/A</th><th style="text-align:right">Score</th><th style="text-align:center">Res</th><th>Played</th></tr></thead>
                <tbody>${schedRows}</tbody>
              </table>` : '<div class="nx-empty">No schedule on this page.</div>'}
            </div>
          </div>
          <aside>
            ${standingsHtml}
            ${profileHtml}
            ${v1LeagueCard(myTeam)}
          </aside>
        </div>

    `);
    applyPalette(app, teamPalette(myTeam));

    // ============================================================
    // 4. Behavior
    // ============================================================
    // "★ Add to My Leagues": saves this coach page to the user's league list.
    const addBtn = $('.nx-ml-add', app);
    const thisLeague = parseCoachUrl(HREF);
    if (thisLeague) {
      const rec = { ...thisLeague, team: myTeam, coach: coachName, league: (leagueOpts.find((o) => o.sel) || {}).t || '', label: '', addedAt: Date.now() };
      const paintAdd = () => {
        const on = myLeagues.has(rec.id);
        $('.t', addBtn).textContent = on ? 'In My Leagues' : 'Add to My Leagues';
        addBtn.setAttribute('aria-pressed', String(on));
        addBtn.title = on ? 'This team is in your My Leagues list. Click to remove it.' : 'Save this team to My Leagues (top bar) for one-click access';
      };
      addBtn.hidden = false;
      addBtn.addEventListener('click', () => { const was = myLeagues.has(rec.id); myLeagues.toggle(rec); if (!was) mlShoot(app, addBtn, 'SCORES!'); });
      document.addEventListener('nx:myleagues', paintAdd);
      paintAdd();
    }
    if (dcIntroDue()) {
      setTimeout(() => { if (app.classList.contains('nx-active') && !$('.nx-mli') && !$('.nx-modal:not([hidden])') && !$('.nx-set')) dcIntro(app); }, 1500);
    }

    if (!games.length) return app;

    // Filters + collapsed groups (saved per coach page)
    const selected = new Set(store.get('opp:' + pageKey, []));
    const collapsed = new Set(store.get('collapsed:' + pageKey, []));
    let mode = store.get('mode:' + pageKey, 'all');
    const tbody = $('table.nx-sched tbody', app);
    const seg = $('#nx-seg', app);
    const clearBtn = $('#nx-clear', app);

    const cfMenu = $('.nx-cf-menu', app), cfBtn = $('.nx-cf-btn', app);
    const setCf = (open) => {
      cfMenu.hidden = !open;
      cfBtn.setAttribute('aria-expanded', String(open));
      if (open) ($('.nx-cf-item[aria-checked="true"]', cfMenu) || $('.nx-cf-item', cfMenu)).focus();
    };
    // "All coaches" clears; a coach toggles on/off (several can be on). The menu stays open for more picks.
    const pickCoach = (o) => {
      if (!o) selected.clear(); else if (selected.has(o)) selected.delete(o); else selected.add(o);
      store.set('opp:' + pageKey, [...selected]);
      apply();
    };
    document.addEventListener('click', (e) => { if (!cfMenu.hidden && !e.target.closest('.nx-cf') && !e.target.closest('.nx-set')) setCf(false); });
    cfMenu.addEventListener('keydown', (e) => {
      const items = $$('.nx-cf-item', cfMenu), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && i >= 0 && e.target === items[i]) { e.preventDefault(); pickCoach(items[i].dataset.opp); }
      else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') { e.stopPropagation(); cfBtn.focus(); } setCf(false); }
    });

    function apply() {
      $$('.nx-cf-item', app).forEach((it) => it.setAttribute('aria-checked', String(it.dataset.opp ? selected.has(it.dataset.opp) : !selected.size)));
      const picked = groups.filter((g) => selected.has(g.opp));
      $('.nx-cf-val', app).innerHTML = !picked.length ? `<span class="logos hint">${groups.slice(0, 4).map((g) => logoImg(g.opp)).join('')}</span><span class="nm">All coaches</span>`
        : `<span class="logos">${picked.slice(0, 3).map((g) => logoImg(g.opp)).join('')}</span><span class="nm">${picked.length === 1 ? esc(coachOf(picked[0].opp)) : picked.length + ' coaches'}</span>`;
      $('.nx-cf-btn', app).classList.toggle('on', !!picked.length);
      $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
      clearBtn.hidden = !selected.size;
      $$('tr.nx-grp', tbody).forEach((h) => {
        const o = h.dataset.opp;
        const oppOk = !selected.size || selected.has(o);
        let any = false;
        $$('tr.g-row', tbody).filter((r) => r.dataset.opp === o).forEach((r) => {
          const modeOk = mode === 'all' || (mode === 'todo' ? r.dataset.played === '0' : r.dataset.played === '1');
          if (oppOk && modeOk) any = true;
          r.style.display = oppOk && modeOk && !collapsed.has(o) ? '' : 'none';
        });
        h.style.display = any ? '' : 'none';
        h.classList.toggle('collapsed', collapsed.has(o));
      });
    }

    app.addEventListener('click', (e) => {
      if (e.target.closest('.nx-cf-btn')) return setCf(cfMenu.hidden);
      const it = !e.target.closest('.nx-dc-slot') && e.target.closest('.nx-cf-item');
      if (it) return pickCoach(it.dataset.opp);
      if (e.target === clearBtn) { selected.clear(); store.set('opp:' + pageKey, []); return apply(); }
      const sb = e.target.closest('#nx-seg button');
      if (sb) { mode = sb.dataset.v; store.set('mode:' + pageKey, mode); return apply(); }
      const grp = e.target.closest('tr.nx-grp');
      if (grp && !e.target.closest('a, button')) {
        const o = grp.dataset.opp;
        if (collapsed.has(o)) collapsed.delete(o); else collapsed.add(o);
        store.set('collapsed:' + pageKey, [...collapsed]);
        return apply();
      }
    });

    apply();
    return app;
  }

  // ---------- Home page data ----------
  function scrapeHome() {
    const imgP = (alt) => { const i = $$('img').find((x) => new RegExp(alt, 'i').test(x.alt || '')); return i ? i.closest('td') : null; };

    // Welcome copy: the left-aligned paragraphs next to the "Welcome" banner (site's own markup, kept as-is)
    const welcomeTd = imgP('^Welcome to the Online');
    const welcome = welcomeTd ? $$('p[align="left"]', welcomeTd).map((p) => p.innerHTML) : [];
    const discord = $$('a[href*="discord.gg"]')[0];

    // Notes box
    const notesTd = imgP('^Notes$');
    const notes = notesTd ? $$('p', notesTd).map((p) => norm(p.textContent)).filter((t) => t.length > 20).join(' ') : '';

    // Latest 10 scores for the selected level
    const scoreTable = leafTables().find((t) => /^\S+ Away @ Home Timestamp$/.test(firstRowText(t)));
    const scoresLevel = scoreTable ? norm(scoreTable.rows[0].cells[0].textContent) : '';
    const scores = scoreTable ? [...scoreTable.rows].slice(1).filter((r) => r.cells.length >= 5).map((r) => {
      const a = r.cells[0].querySelector('a');
      const txt = norm(r.cells[0].textContent);
      const m = txt.match(/^(\d+)\s*-\s*(\d+)\s+([A-Za-z.]+)?\s*(OT)?/i) || [];
      const away = resolveTeam(r.cells[1].textContent), home = resolveTeam(r.cells[3].textContent);
      const hi = +m[1] || 0, lo = +m[2] || 0, abbr = m[3] || '';
      let winner = '';
      if (abbr && hi !== lo) winner = abbrScore(abbr, home) > abbrScore(abbr, away) ? home : away;
      return {
        away, home, winner, ot: !!m[4] || /\bOT\b/.test(txt), href: a ? a.href : '', time: norm(r.cells[4].textContent),
        awayG: winner === home ? lo : hi, homeG: winner === home ? hi : lo,
      };
    }) : [];
    const levelTabs = $$('a[href*="index.php?lg="]').map((a) => {
      const u = new URL(a.href, location.href);
      return { label: norm(a.textContent), href: a.href, sublg: u.searchParams.get('sublg') };
    }).filter((t, i, arr) => t.sublg && arr.findIndex((x) => x.sublg === t.sublg) === i);

    // Downloads, grouped by their section header rows
    const dlGroups = [];
    leafTables().filter((t) => t.querySelector('a[href*="/downloads/"]')).forEach((t) => {
      let g = null;
      [...t.rows].forEach((r) => {
        const link = r.querySelector('a[href*="/downloads/"]');
        if (!link) { const h = norm(r.textContent); if (h) { g = { name: h, items: [] }; dlGroups.push(g); } return; }
        if (!g) { g = { name: 'Downloads', items: [] }; dlGroups.push(g); }
        g.items.push({ label: norm(r.cells[0].textContent), href: link.href });
      });
    });
    const dlNote = norm(($$('.small_red').find((s) => /RetroArch packages/i.test(s.textContent)) || {}).textContent || '');
    const dlUpdated = norm(($$('.text_red').find((s) => /Updated/i.test(s.textContent)) || {}).textContent || '').replace(/\*/g, '');
    const gettingStarted = $$('a').find((a) => /getting-started\.php/.test(a.getAttribute('href') || ''));

    return { welcome, discord: discord ? discord.href : '', notes, scores, scoresLevel, levelTabs, dlGroups, dlNote, dlUpdated,
      gettingStarted: gettingStarted ? gettingStarted.href : '/html/getting-started.php' };
  }

  // ---------- V1 · Home page ----------
  function renderHomeV1() {
    v1Setup();
    const H = scrapeHome();
    const lgNow = currentLg();
    const mineIds = () => new Set(myLeagues.all().map((x) => x.id));
    const myHereTeam = (myLeagues.all().find((x) => x.lg === lgNow && x.sublg === levelName) || {}).team || '';

    addCss(`
    .nx-v1 .nx-h-hero .nx-hero-in { align-items: center; }
    .nx-h-word { margin: 12px 0 6px; font-family: var(--nx-px); font-size: clamp(22px, 4vw, 40px); line-height: 1.15; color: #fff;
      text-shadow: 4px 4px 0 var(--nx-red), 0 0 24px rgba(255,255,255,.12); letter-spacing: 1px; }
    .nx-h-word span { color: var(--nx-gold); }
    .nx-h-sub { font-size: 15px; color: rgba(255,255,255,.86); max-width: 560px; }
    .nx-h-mine { flex: none; width: 290px; margin-right: 110px; padding: 14px; background: rgba(0,0,0,.34); border: 1px solid rgba(255,255,255,.2); border-radius: 12px; color: #fff; }
    .nx-h-mine .lab { font-family: var(--nx-px); font-size: 7px; color: var(--nx-gold); letter-spacing: .5px; margin-bottom: 10px; }
    .nx-star { font-family: var(--nx-ui); font-size: 11px; }
    .nx-h-ml { display: flex; align-items: center; gap: 10px; padding: 7px 8px; margin: 0 -8px; border-radius: 6px; color: #fff; }
    .nx-h-ml:hover { background: rgba(255,255,255,.1); }
    .nx-h-ml .nx-logo { width: 28px; height: 28px; image-rendering: pixelated; flex: none; }
    .nx-h-ml > span:nth-child(2) { flex: 1; min-width: 0; }
    .nx-h-ml .t { display: block; font: 600 16px var(--nx-cond); text-transform: uppercase; letter-spacing: .5px; line-height: 1.15; color: #fff; }
    .nx-h-ml .c { display: block; font-size: 12px; color: rgba(255,255,255,.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-h-ml .go { color: var(--nx-gold); font-weight: 700; }
    .nx-h-ml-manage { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,.85) !important; text-decoration: underline !important; text-underline-offset: 2px; }
    @media (max-width: 900px) { .nx-h-mine { margin-right: 0; width: 100%; } .nx-v1 .nx-h-hero .nx-hero-in { flex-wrap: wrap; } }

    .nx-h-note { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 18px; padding: 12px 16px; background: var(--nx-card);
      border: 1px solid var(--nx-line2); border-left: 4px solid var(--nx-red); border-radius: 10px; box-shadow: var(--nx-shadow); }
    .nx-h-note .tag { font-family: var(--nx-px); font-size: 8px; color: var(--nx-on-gold); background: var(--nx-gold); padding: 6px 8px; border-radius: 3px; }
    .nx-h-note p { margin: 0; flex: 1; min-width: 240px; font-size: 13px; color: var(--nx-text); }
    .nx-h-note .acts { display: flex; gap: 8px; flex-wrap: wrap; }
    .nx-h-note .nx-btn { background: var(--nx-score); border-color: var(--nx-line2); }
    .nx-h-note .nx-btn:hover { background: var(--nx-red); border-color: var(--nx-red); color: var(--nx-on-red) !important; }

    .nx-h-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--nx-line); }
    .nx-h-tab { font: 600 12px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; padding: 5px 11px; border-radius: 4px;
      color: var(--nx-acc); background: var(--nx-bg2); border: 1px solid var(--nx-line2); }
    .nx-h-tab:hover { color: var(--nx-strong); border-color: var(--nx-acc); }
    .nx-h-tab.on { color: var(--nx-on-red); background: var(--nx-red); border-color: var(--nx-red); }
    .nx-h-tab .star { color: var(--nx-gold); margin-left: 4px; }
    .nx-h-tab:not(.on) .star { color: var(--nx-acc); }

    .nx-h-game { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto; align-items: center; gap: 14px; padding: 9px 16px; border-bottom: 1px solid var(--nx-line); }
    .nx-h-game:nth-child(even) { background: var(--nx-row-away); }
    .nx-h-game:hover { background: var(--nx-hover); }
    .nx-h-tm { display: flex; align-items: center; gap: 10px; min-width: 0; color: var(--nx-mute); }
    .nx-h-tm.away { flex-direction: row-reverse; text-align: right; }
    .nx-h-tm img, .nx-h-tm .nx-logo { width: 28px; height: 28px; image-rendering: pixelated; flex: none; }
    .nx-h-tm .n { font-family: var(--nx-cond); font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: .5px; line-height: 1.15;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-h-tm .c { font-size: 11px; color: var(--nx-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nx-h-tm.win { color: var(--nx-strong); }
    .nx-h-tm.win .n { font-weight: 700; }
    .nx-h-tm.win .c { color: var(--nx-acc); }
    .nx-h-tm.mine .n::after { content: " ★"; color: var(--nx-acc); }
    .nx-h-score { display: flex; align-items: center; gap: 6px; font-family: var(--nx-px); font-size: 15px; color: #8A96A8; padding: 6px 10px;
      background: var(--nx-score); border: 1px solid var(--nx-line2); border-radius: 4px; min-width: 96px; justify-content: center; }
    .nx-h-score b { color: #fff; font-weight: 400; }
    .nx-h-score .ot { font-family: var(--nx-cond); font-size: 10px; letter-spacing: 1px; color: var(--nx-on-gold); background: var(--nx-gold); padding: 1px 4px; border-radius: 2px; margin-left: 2px; }
    .nx-h-meta { display: flex; align-items: center; gap: 10px; justify-content: flex-end; }
    .nx-h-meta .time { font-size: 11px; color: var(--nx-mute); text-align: right; white-space: nowrap; }
    @media (max-width: 760px) { .nx-h-game { grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); } .nx-h-meta { grid-column: 1 / -1; justify-content: center; } }

    .nx-h-copy { padding: 6px 18px 16px; font-size: 14px; line-height: 1.6; color: var(--nx-text); }
    .nx-h-copy p { margin: 12px 0 0; }
    .nx-h-copy p a { color: var(--nx-acc) !important; text-decoration: underline !important; text-underline-offset: 2px; }
    .nx-h-copy .nx-btn { margin-top: 16px; }

    .nx-h-dl-h { padding: 12px 16px 6px; font-family: var(--nx-px); font-size: 8px; color: var(--nx-acc); letter-spacing: .5px; }
    .nx-h-dl a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; font-size: 13px; border-bottom: 1px solid var(--nx-line); }
    .nx-h-dl a:hover { background: var(--nx-hover); }
    .nx-h-dl a:hover .get { background: var(--nx-red); color: var(--nx-on-red); border-color: var(--nx-red); }
    .nx-h-dl .get { flex: none; font: 600 11px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; padding: 3px 9px; border-radius: 3px;
      color: var(--nx-acc); border: 1px solid color-mix(in srgb, var(--nx-acc) 55%, transparent); }
    .nx-h-dl-note { padding: 10px 16px 14px; font-size: 12px; color: var(--nx-mute); }
    `);

    const teamSide = (team, side, isWin) => {
      const info = teamInfo[team] || {};
      const isMine = !!info.href && mineIds().has((parseCoachUrl(info.href) || {}).id);
      return `<a class="nx-h-tm ${side}${isWin ? ' win' : ''}${isMine ? ' mine' : ''}" href="${esc(info.href || '#')}">
        ${logoImg(team)}<span style="min-width:0"><div class="n">${esc(team)}</div><div class="c">${esc(info.coach || '')}</div></span></a>`;
    };

    const scoresHtml = H.scores.map((g) => `
      <div class="nx-h-game">
        ${teamSide(g.away, 'away', g.winner === g.away)}
        <div class="nx-h-score">${g.winner === g.away ? `<b>${g.awayG}</b>` : g.awayG}<span>-</span>${g.winner === g.home ? `<b>${g.homeG}</b>` : g.homeG}${g.ot ? '<span class="ot">OT</span>' : ''}</div>
        ${teamSide(g.home, 'home', g.winner === g.home)}
        <div class="nx-h-meta"><span class="time">${esc(g.time)}</span>${g.href ? `<a class="nx-go box" href="${esc(g.href)}" target="_blank"><span>Box Score</span></a>` : ''}</div>
      </div>`).join('');

    const tabsHtml = H.levelTabs.map((t) =>
      `<a class="nx-h-tab${t.sublg === H.scoresLevel ? ' on' : ''}" href="${esc(t.href)}">${esc(t.label)}${myLeagues.all().some((x) => x.lg === lgNow && x.sublg === t.sublg) ? '<span class="star" title="You have a team here">★</span>' : ''}</a>`).join('');

    const dl = H.dlGroups.map((g) => `<div class="nx-h-dl"><div class="nx-h-dl-h">${esc(g.name.toUpperCase())}</div>
      ${g.items.map((i) => `<a href="${esc(i.href)}"><span>${esc(i.label)}</span><span class="get">Download</span></a>`).join('')}</div>`).join('');
    const ra = (H.dlGroups.find((g) => /RetroArch/i.test(g.name)) || { items: [] }).items;
    const raBtn = (re, label) => { const i = ra.find((x) => re.test(x.label)); return i ? `<a class="nx-btn" href="${esc(i.href)}"><span>${label}</span></a>` : ''; };

    // Hero card: the user's leagues (hidden until they add one).
    const myLeaguesHtml = () => {
      const l = myLeagues.all();
      if (!l.length) return '';
      return `<div class="nx-h-mine"><div class="lab"><span class="nx-star">★</span> MY LEAGUES</div>
        ${l.slice(0, 5).map((x) => `<a class="nx-h-ml" href="${esc(x.path)}">${logoImg(x.team)}<span><span class="t">${esc(mlTitle(x))}</span><span class="c">${esc([x.sublg, x.league].filter(Boolean).join(' · '))}</span></span><span class="go">→</span></a>`).join('')}
        <a class="nx-h-ml-manage" href="#" data-ml-manage>${l.length > 5 ? `+${l.length - 5} more · ` : ''}Manage</a>
      </div>`;
    };

    const leagueName0 = (leagueOpts.find((o) => o.sel) || {}).t || '';
    const app = v1Mount(`
      <section class="nx-hero nx-h-hero">
        <div class="nx-hero-in">
          <div class="nx-hero-txt">
            <div class="nx-eyebrow">${esc(leagueName0.toUpperCase() || 'CLASSIC \'94')}</div>
            <div class="nx-h-word">NHL'94 <span>ONLINE</span></div>
            <div class="nx-h-sub">Play the classic online against coaches from across North America.</div>
            <div class="nx-actions">
              <a class="nx-btn gold" href="${esc(H.gettingStarted)}"><span>Getting Started</span></a>
              <a class="nx-btn" href="/html/about.php"><span>About</span></a>
              <a class="nx-btn" href="/html/rules.php"><span>Rules</span></a>
              ${H.discord ? `<a class="nx-btn" href="${esc(H.discord)}" target="_blank"><span>Join Discord</span></a>` : ''}
            </div>
          </div>
          <div class="nx-h-mlwrap">${myLeaguesHtml()}</div>
        </div>
      </section>

      ${H.notes ? `<div class="nx-h-note"><span class="tag">NOTE</span><p>${esc(H.notes)}</p>
        <div class="acts">${raBtn(/Windows/i, 'RetroArch · Windows')}${raBtn(/Mac/i, 'RetroArch · Mac')}</div></div>` : ''}

      <div class="nx-grid">
        <div>
          <div class="nx-card">
            <div class="nx-card-h"><h2>Latest Scores</h2><span class="nx-meta">${esc(H.scoresLevel)} · last ${H.scores.length}</span></div>
            ${tabsHtml ? `<div class="nx-h-tabs">${tabsHtml}</div>` : ''}
            ${scoresHtml || '<div class="nx-empty">No games logged yet.</div>'}
          </div>
          ${H.welcome.length ? `<div class="nx-card"><div class="nx-card-h"><h2>Welcome</h2></div>
            <div class="nx-h-copy">${H.welcome.map((p) => `<p>${p}</p>`).join('')}
              ${H.discord ? `<a class="nx-btn gold" href="${esc(H.discord)}" target="_blank"><span>Join us on Discord</span></a>` : ''}</div></div>` : ''}
        </div>
        <aside>
          ${v1LeagueCard(myHereTeam)}
          ${dl ? `<div class="nx-card"><div class="nx-card-h"><h2>Downloads</h2>${H.dlUpdated ? `<span class="nx-meta">${esc(H.dlUpdated)}</span>` : ''}</div>
            ${dl}${H.dlNote ? `<div class="nx-h-dl-note">${esc(H.dlNote)}</div>` : ''}</div>` : ''}
        </aside>
      </div>
    `);
    applyPalette(app, HOME_PALETTE);
    document.addEventListener('nx:myleagues', () => { const w = $('.nx-h-mlwrap', app); if (w) w.innerHTML = myLeaguesHtml(); });
    return app;
  }

  // ============================================================
  // Stats pages: standings, team rosters, player leaders, league records, all-time standings,
  // site records and box scores.
  // ------------------------------------------------------------
  // scrapeContent() reads the page's content area in order (headings, level tabs, dropdowns,
  // page buttons, tables) and each page lays those pieces out in V1's cards. The original
  // dropdowns and page buttons stay on the (hidden) page and ours drive them, so every sort,
  // filter and page link works exactly as before.
  // ============================================================
  const pageUrl = new URL(HREF, location.href);
  const qp = (k) => pageUrl.searchParams.get(k) || '';
  // The level the sidebar says is showing (stats pages pick a default level when the URL has none).
  const curLevel = qp('sublg') || norm((($$('td').find((c) => /^Current Level:?$/.test(norm(c.textContent))) || {}).nextElementSibling || {}).textContent || '');
  const TEAM_ABBR = {
    ANA: 'Anaheim', BOS: 'Boston', BUF: 'Buffalo', CGY: 'Calgary', CHI: 'Chicago', DAL: 'Dallas', DET: 'Detroit', EDM: 'Edmonton',
    FLA: 'Florida', HFD: 'Hartford', LA: 'Los Angeles', LAK: 'Los Angeles', MTL: 'Montreal', NJ: 'New Jersey', NJD: 'New Jersey',
    NYI: 'NY Islanders', NYR: 'NY Rangers', OTT: 'Ottawa', PHI: 'Philadelphia', PIT: 'Pittsburgh', QUE: 'Quebec', SJ: 'San Jose',
    SJS: 'San Jose', STL: 'St. Louis', TB: 'Tampa Bay', TBL: 'Tampa Bay', TOR: 'Toronto', VAN: 'Vancouver', WSH: 'Washington', WPG: 'Winnipeg',
  };
  const teamIdOf = (href) => { const m = /team_ID=(\d+)/i.exec(href || ''); return m ? m[1] : ''; };
  const teamById = {};
  Object.entries(teamInfo).forEach(([t, i]) => { const id = teamIdOf(i.href); if (id) teamById[id] = t; });
  const teamFromFull = (name) => Object.keys(TEAMS).find((k) => fullTeamName(k).toLowerCase() === norm(name).toLowerCase().replace(/\.png$/, '')) || resolveTeam(name);
  // Rows that belong to the viewer (a team or coach from My Leagues) get highlighted.
  const mine = () => {
    const l = myLeagues.all();
    return { ids: new Set(l.map((x) => String(x.teamId))), coaches: new Set(l.map((x) => (x.coach || '').toLowerCase()).filter(Boolean)) };
  };

  // Text + links + team logos of an original element, rebuilt safely (no inline handlers or styles).
  function richText(node) {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += esc(c.textContent.replace(/\s+/g, ' '));
      else if (c.nodeType !== 1 || /^(SCRIPT|STYLE|SELECT|INPUT|BUTTON)$/.test(c.tagName)) return;
      else if (c.tagName === 'BR') out += ' ';
      else if (c.tagName === 'A') {
        const h = c.getAttribute('href') || '';
        out += !h || /^\s*(javascript|data):/i.test(h) ? richText(c) : `<a href="${esc(c.href)}"${c.target ? ` target="${esc(c.target)}"` : ''}>${richText(c)}</a>`;
      } else if (c.tagName === 'IMG') {
        const s = c.getAttribute('src') || '';
        if (/\/logos\d+\//.test(s)) out += `<img class="nx-logo" src="${esc(s.replace(/logos\d+\//, 'logos20/'))}" alt="${esc((c.alt || '').replace(/\.png$/, ''))}">`;
      } else if (/^(ACRONYM|ABBR)$/.test(c.tagName) && c.title) out += `<abbr title="${esc(c.title)}">${richText(c)}</abbr>`;
      else out += richText(c);
    });
    return out.replace(/\s+/g, ' ').trim();
  }
  const ownText = (el) => norm([...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' '));

  function scrapeContent() {
    const start = $$('img').find((i) => /user-records|\/standings\.gif|heading-stats|gamelog/i.test(i.getAttribute('src') || ''));
    const blocks = [];
    let on = !start, done = false;
    const walk = (n) => {
      if (done || n.nodeType !== 1 || /^(SCRIPT|STYLE|NOSCRIPT|HEAD)$/.test(n.tagName)) return;
      if (n === start) { on = true; return; }
      if (!on) { [...n.children].forEach(walk); return; }
      const tag = n.tagName, cls = n.className || '', txt = norm(n.textContent);
      if (/^It.s our goal to keep this website/.test(txt)) { done = true; return; }
      if (tag === 'TABLE' && !n.querySelector('table, select, input')) {
        if (n.rows.length && (txt || n.querySelector('img'))) blocks.push({ type: 'table', el: n });
        return;
      }
      if (tag === 'SELECT') { if (!/^(lg|sublg)$/.test(n.name)) blocks.push({ type: 'select', el: n }); return; }
      if (tag === 'IMG') { const s = n.getAttribute('src') || ''; if (/\/logos(100|150)\//.test(s)) blocks.push({ type: 'logo', src: s, alt: (n.alt || '').replace(/\.png$/, '') }); return; }
      if (!n.querySelector('table, select, img[src*="/logos1"]')) {
        const btns = $$('input[type="button"], input[type="submit"]', n);
        if (btns.length) { blocks.push({ type: 'pager', label: ownText(n).replace(/:$/, ''), btns }); return; }
        if (/^(P|SPAN|DIV|H\d|FONT|B|STRONG)$/.test(tag) && !n.querySelector('p, div')) {
          const links = $$('a', n);
          if (links.length >= 2) {
            blocks.push({ type: 'tabs', label: norm(ownText(n).replace(/\|/g, '')).replace(/:$/, ''), links: links.map((a) => ({ text: norm(a.textContent), href: a.href })) });
            return;
          }
          if (txt) {
            if (/:$/.test(txt) && txt.length < 40) blocks.push({ type: 'label', text: txt.replace(/:$/, '') });
            else if (/^H\d$/.test(tag)) blocks.push({ type: 'h', level: 'sub', text: txt });
            else if (/heading_team/.test(cls)) blocks.push({ type: 'h', level: 'team', text: txt });
            else if (/heading(_black|2_black)/.test(cls)) blocks.push({ type: 'h', level: 'sec', text: txt });
            else if (/heading_blue/.test(cls)) blocks.push({ type: 'value', text: txt });
            else blocks.push({ type: 'text', text: txt, html: richText(n), red: /red/.test(cls) });
            return;
          }
          return;
        }
      } else if (/^(P|SPAN|DIV|TD)$/.test(n.tagName) && n.querySelector('select') && ownText(n).length > 1) {
        blocks.push({ type: 'label', text: ownText(n).replace(/:$/, '') });
      }
      [...n.children].forEach(walk);
    };
    walk(document.body);
    // "Label:" + dropdown, and "Label:" + value ("Current Sort: PCT ↑"), belong together.
    const out = [];
    blocks.forEach((b) => {
      const prev = out[out.length - 1];
      if (prev && prev.type === 'label' && (b.type === 'select' || b.type === 'value')) { out.pop(); b.label = prev.text; }
      if (b.type === 'value' && !b.label) b = { type: 'text', text: b.text, html: esc(b.text) };
      out.push(b);
    });
    out.forEach((b) => { if (b.type === 'tabs') markTabs(b.links); });
    return out.filter((b) => b.type !== 'label' || out.indexOf(b) === out.length - 1 || out[out.indexOf(b) + 1].type !== 'pager');
  }

  // Which tab is the page showing? Compare the URL parameter that differs between the tabs.
  function markTabs(links) {
    const qs = links.map((l) => new URL(l.href, location.href).searchParams);
    const keys = [...new Set(qs.flatMap((q) => [...q.keys()]))].filter((k) => new Set(qs.map((q) => q.get(k))).size > 1);
    const DEF = { sublg: curLevel, sys: 'GENS', type: 'sco' };
    links.key = keys.join(',');
    links.forEach((l, i) => { l.on = keys.length > 0 && keys.every((k) => (qp(k) || DEF[k] || '') === (qs[i].get(k) || '')); });
  }

  // ---------- Original table -> rows of title / header / data cells ----------
  const isNum = (t) => /^[-+]?(\d[\d,]*\.?\d*|\.\d+)(%|dB)?$|^\d+[-/:]\d+([-/:]\d+)?( \(\d+%\))?$|^-$/.test(t);
  function tableModel(t) {
    const rows = [...t.rows].filter((r) => r.cells.length);
    const span = (r) => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0);
    const ncols = Math.max(1, ...rows.map(span));
    const out = [];
    let carry = 0, afterTitle = false;
    rows.forEach((r, ri) => {
      const cells = [...r.cells];
      const allHead = cells.every((c) => c.tagName === 'TH' || /white_bold/.test(c.className) || c.hasAttribute('background'));
      const head = /headrow/.test(r.className) || allHead || afterTitle;
      const texts = cells.filter((c) => norm(c.textContent));
      const isTitle = head && texts.length === 1 && (texts[0].colSpan || 1) >= ncols - 2 && ncols > 2 && !texts[0].querySelector('a');
      const mk = (c) => ({ html: richText(c), text: norm(c.textContent), cs: c.colSpan || 1, l: /alignleft/.test(c.className) || /text-align:\s*left/i.test(c.getAttribute('style') || '') });
      if (isTitle) {
        const img = cells.map((c) => c.querySelector('img')).find(Boolean);
        out.push({ kind: 'title', text: norm(texts[0].textContent), logo: img ? img.getAttribute('src') : '' });
        carry = cells.filter((c) => c.rowSpan > 1).reduce((s, c) => s + c.colSpan, 0);
        afterTitle = true;
        return;
      }
      const cs = cells.map(mk);
      if (carry && cs[0]) { cs[0].cs += carry; carry = 0; }
      out.push({ kind: head ? 'head' : 'data', cells: cs, el: r });
      afterTitle = false;
      if (!head && ri === 0) out[out.length - 1].kind = 'data';
    });
    // Column alignment from the data: words on the left, numbers centred.
    const colL = {};
    out.filter((r) => r.kind === 'data').forEach((r) => {
      let col = 0;
      r.cells.forEach((c) => {
        if (c.cs === 1 && c.text) { const k = colL[col] || (colL[col] = { w: 0, n: 0 }); if (!isNum(c.text) && c.text.length > 4) k.w++; else k.n++; }
        col += c.cs;
      });
    });
    out.forEach((r) => {
      if (!r.cells) return;
      let col = 0;
      r.cells.forEach((c) => { c.col = col; c.left = c.l || (colL[col] && colL[col].w > colL[col].n); col += c.cs; });
    });
    return { ncols, rows: out, title: (out.find((r) => r.kind === 'title') || {}).text || '' };
  }

  // A team code cell ("PHI", or a coach page link) becomes logo + code.
  function teamCell(c, linkEl) {
    const t = TEAM_ABBR[c.text] || (linkEl && teamById[teamIdOf(linkEl.getAttribute('href'))]);
    if (!t || !TEAMS[t] || c.text.length > 4) return '';
    const inner = `${logoImg(t)}<span>${esc(c.text)}</span>`;
    return linkEl ? `<a class="nx-tmab" href="${esc(linkEl.href)}" title="${esc(fullTeamName(t))}">${inner}</a>` : `<span class="nx-tmab" title="${esc(fullTeamName(t))}">${inner}</span>`;
  }

  // Render a table model as a V1 table. opts: { skipTitle, sortCol (header text), valFirst, badges }
  function dtHtml(m, opts = {}) {
    const me = mine();
    const h0 = m.rows.find((r) => r.kind === 'head');
    const rankFirst = !h0 || /^(|#|rank|pos)$/i.test(h0.cells[0].text);
    let firstHead = true, sortIdx = -1;
    const body = m.rows.map((r) => {
      if (r.kind === 'title') {
        if (opts.skipTitle && r === m.rows[0]) return '';
        return `<tr class="sub"><th colspan="${m.ncols}">${r.logo ? `<img class="nx-logo" src="${esc(r.logo)}" alt="">` : ''}${esc(r.text)}</th></tr>`;
      }
      if (r.kind === 'head') {
        const ths = r.cells.map((c) => {
          const sorted = opts.sortCol && c.text.toLowerCase() === opts.sortCol.toLowerCase();
          if (sorted) sortIdx = c.col;
          return `<th${c.cs > 1 ? ` colspan="${c.cs}"` : ''} class="${c.left ? 'l' : ''}${sorted ? ' sorted' : ''}">${c.html}</th>`;
        }).join('');
        const tr = `<tr class="hd${firstHead ? ' first' : ''}">${ths}</tr>`;
        firstHead = false;
        return tr;
      }
      const links = $$('a', r.el);
      const isMe = links.some((a) => me.ids.has(teamIdOf(a.getAttribute('href')))) || r.cells.some((c) => me.coaches.has(c.text.toLowerCase()));
      const tds = r.cells.map((c, i) => {
        const cellEl = r.el.cells[i];
        const a = cellEl && cellEl.querySelectorAll('a').length === 1 && norm(cellEl.querySelector('a').textContent) === c.text ? cellEl.querySelector('a') : null;
        let html = teamCell(c, a) || c.html;
        const cls = [c.left ? 'l' : ''];
        if (i === 0 && rankFirst && /^\d+$/.test(c.text) && r.cells.length > 2) cls.push('rk');
        else if (i === 0 && opts.valFirst && !rankFirst) cls.push('val');
        if (c.col === sortIdx && c.cs === 1) cls.push('sorted');
        if (opts.badges && /^(PP|SH|EN|PS|SO)$/.test(c.text)) html = `<span class="nx-s-badge">${esc(c.text)}</span>`;
        if (/^(Won|W)\s*\d+$/.test(c.text)) cls.push('win'); else if (/^(Lost|L)\s*\d+$/.test(c.text)) cls.push('loss');
        return `<td${c.cs > 1 ? ` colspan="${c.cs}"` : ''} class="${cls.join(' ').trim()}">${html}</td>`;
      }).join('');
      return `<tr class="${isMe ? 'me' : ''}">${tds}</tr>`;
    }).join('');
    return `<div class="nx-dt-wrap"><table class="nx-dt">${body}</table></div>`;
  }

  // Our controls drive the page's own (hidden) dropdowns and page buttons.
  let ctlSeq = 0;
  const ctlEls = {};
  const ctlId = (el) => { const id = 'c' + (++ctlSeq); ctlEls[id] = el; return id; };
  function selectHtml(b) {
    return `<label class="nx-s-f"><span class="nx-lab">${esc((b.label || b.el.name).toUpperCase())}</span>
      <select data-nx-ctl="${ctlId(b.el)}">${[...b.el.options].map((o, i) => `<option value="${i}"${o.selected ? ' selected' : ''}>${esc(norm(o.text))}</option>`).join('')}</select></label>`;
  }
  function tabsHtml(b) {
    return `<div class="nx-s-f">${b.label ? `<span class="nx-lab">${esc(b.label.toUpperCase())}</span>` : ''}
      <nav class="nx-seg nx-s-tabs"${b.links.key ? ` data-key="${esc(b.links.key)}"` : ''}>${b.links.map((l) => `<a href="${esc(l.href)}"${l.on ? ' class="on" aria-current="page"' : ''}>${esc(l.text)}</a>`).join('')}</nav></div>`;
  }
  function pagerHtml(b) {
    return `<div class="nx-s-pager"><span class="nx-lab">${esc((b.label || 'Page').toUpperCase())}</span>${b.btns.map((x) => {
      const v = x.value, cur = !x.getAttribute('onclick');
      return `<button type="button"${cur ? ' class="on" aria-current="page"' : ` data-nx-ctl="${ctlId(x)}"`} aria-label="${v === '>' ? 'Next page' : v === '<' ? 'Previous page' : 'Page ' + esc(v)}">${v === '>' ? '›' : v === '<' ? '‹' : esc(v)}</button>`;
    }).join('')}</div>`;
  }
  function wireCtls(app) {
    app.addEventListener('change', (e) => {
      const s = e.target.closest('select[data-nx-ctl]');
      const orig = s && ctlEls[s.dataset.nxCtl];
      if (!orig) return;
      orig.selectedIndex = +s.value;
      orig.dispatchEvent(new Event('change', { bubbles: true }));
    });
    app.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-nx-ctl]');
      if (b && ctlEls[b.dataset.nxCtl]) ctlEls[b.dataset.nxCtl].click();
    });
  }

  const STAT_NAMES = { GF: 'Goals For', GA: 'Goals Against', 'GF/G': 'Goals For / Game', 'GA/G': 'Goals Against / Game', PCT: 'Win %', PTS: 'Points', W: 'Wins', L: 'Losses', T: 'Ties' };
  const cardHtml = (title, meta, body, cls = '') => `<div class="nx-card nx-s-card ${cls}">${title ? `<div class="nx-card-h"><h2>${title}</h2>${meta ? `<span class="nx-meta">${meta}</span>` : ''}</div>` : ''}${body}</div>`;

  // Lay out content blocks as cards. A section heading followed by one table titles that table's card;
  // one followed by several becomes a heading over a grid of small cards.
  function blocksHtml(blocks, opts = {}) {
    let html = '', grid = [], pendingTitle = '', pendingMeta = '', secOpen = false;
    const flush = () => { if (grid.length) html += `<div class="nx-s-grid">${grid.join('')}</div>`; grid = []; };
    const tablesAfter = (i) => { let n = 0; for (let j = i + 1; j < blocks.length && !(blocks[j].type === 'h' && blocks[j].level === 'sec'); j++) if (blocks[j].type === 'table') n++; return n; };
    blocks.forEach((b, i) => {
      if (b.type === 'h' && b.level === 'sec') {
        flush();
        if (tablesAfter(i) === 1) { pendingTitle = b.text; return; }
        const note = blocks[i + 1] && blocks[i + 1].type === 'text' ? blocks[i + 1].text : '';
        if (note) blocks[i + 1].used = true;
        html += `<div class="nx-s-sec"><h2>${esc(b.text)}</h2>${note ? `<span>${esc(note)}</span>` : ''}</div>`;
        secOpen = true;
        return;
      }
      if (b.type === 'h') { pendingTitle = b.text; return; }
      if (b.type === 'text' && !b.used && pendingTitle) { pendingMeta = b.text; return; }
      if (b.type === 'pager') { const last = grid.length ? null : html.lastIndexOf('</div><!--card-->'); if (last != null && last >= 0) html = html.slice(0, last) + `<div class="nx-s-foot">${pagerHtml(b)}</div>` + html.slice(last); return; }
      if (b.type !== 'table') return;
      const m = tableModel(b.el);
      const big = m.rows.length > 14 || m.ncols > 6;
      let title = pendingTitle, logoSrc = '';
      const t0 = m.rows[0] && m.rows[0].kind === 'title' ? m.rows[0] : null;
      if (!title && t0) { title = t0.text; logoSrc = t0.logo; }
      const firstHead = m.rows.find((r) => r.kind === 'head');
      if (!title && firstHead) title = STAT_NAMES[firstHead.cells[0].text] || '';
      if (!title) title = opts.defaultTitle || '';
      const card = cardHtml(`${logoSrc ? `<img class="nx-logo" src="${esc(logoSrc)}" alt="">` : ''}${esc(title)}`, esc(pendingMeta),
        dtHtml(m, { skipTitle: !!t0 && (title === t0.text), sortCol: opts.sortCol, badges: opts.badges, valFirst: !big }), big ? 'big' : 'small') + '<!--card-->';
      pendingTitle = ''; pendingMeta = '';
      if (big || !secOpen) { flush(); html += card; } else grid.push(card);
    });
    flush();
    return html.replace(/<!--card-->/g, '');
  }

  // Controls bar: level tabs, dropdowns and "Label: value" facts above the tables.
  function ctlBarHtml(blocks) {
    const parts = blocks.map((b) => b.type === 'tabs' ? tabsHtml(b) : b.type === 'select' ? selectHtml(b)
      : b.type === 'value' ? `<div class="nx-s-f"><span class="nx-lab">${esc(b.label.toUpperCase())}</span><span class="nx-s-val">${esc(b.text)}</span></div>` : '').filter(Boolean);
    return parts.length ? `<div class="nx-s-bar">${parts.join('')}</div>` : '';
  }

  // Shared hero for stats pages (the same colour band as the coach and home pages).
  function statHeroHtml({ eyebrow, title, sub, logo: lg, side, actions, bar }) {
    return `<section class="nx-hero nx-s-hero"><div class="nx-hero-in">
      ${lg ? `<div class="nx-hero-logo"><img src="${esc(lg)}" alt=""></div>` : ''}
      <div class="nx-hero-txt">
        ${eyebrow ? `<div class="nx-eyebrow">${esc(eyebrow.toUpperCase())}</div>` : ''}
        <h1 class="nx-team">${esc(title)}</h1>
        ${sub ? `<div class="nx-s-sub">${sub}</div>` : ''}
        ${actions ? `<div class="nx-actions">${actions}</div>` : ''}
      </div>
      ${side || ''}
    </div>${bar || ''}</section>`;
  }

  let statReady = false;
  function statSetup() {
    v1Setup();
    if (statReady) return;
    statReady = true;
    addCss(`
    .nx-s-hero .nx-team { font-size: clamp(30px, 4.4vw, 50px); margin-bottom: 6px; }
    .nx-s-hero .nx-statbar { grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); }
    .nx-s-sub { font-size: 14px; color: rgba(255,255,255,.86); max-width: 720px; }
    .nx-s-sub p { margin: 6px 0 0; }
    .nx-s-sub a { color: #fff; text-decoration: underline; text-underline-offset: 2px; }
    .nx-s-hero .nx-hero-logo img[src*="logos150"] { width: 100px; height: 100px; }
    .nx-s-hero .nx-actions select { color: #fff; background-color: rgba(0,0,0,.4); border-color: rgba(255,255,255,.3); min-height: 38px; font-weight: 600; }
    .nx-s-hero .nx-actions .nx-lab { color: rgba(255,255,255,.75); }
    .nx-s-hero .nx-actions select option { color: #111; background: #fff; }
    .nx-s-hero .nx-hero-rank .who { font-family: var(--nx-cond); font-size: 15px; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; color: #fff; }

    .nx-s-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 26px; margin-top: 18px; padding: 12px 16px; background: var(--nx-card);
      border: 1px solid var(--nx-line); border-radius: 10px; box-shadow: var(--nx-shadow); }
    .nx-s-f { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
    .nx-s-f .nx-lab { margin: 0; font-size: 8px; color: var(--nx-mute); }
    .nx-s-f select { min-height: 36px; font-weight: 600; max-width: 100%; }
    .nx-s-val { font: 600 15px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; color: var(--nx-acc); }
    .nx-s-tabs { flex-wrap: wrap; }
    .nx-s-tabs a { font: 600 12px var(--nx-cond); text-transform: uppercase; letter-spacing: 1px; color: var(--nx-mute); padding: 6px 12px; border-radius: 4px; }
    .nx-s-tabs a:hover { color: var(--nx-strong); }
    .nx-s-tabs a.on { background: var(--nx-red); color: var(--nx-on-red); }

    .nx-s-sec { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 14px; margin: 28px 0 12px; }
    .nx-s-sec h2 { margin: 0; display: flex; align-items: center; gap: 12px; font: 600 22px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.5px; color: var(--nx-strong); }
    .nx-s-sec h2::before { content: ""; width: 5px; height: 22px; background: var(--nx-red); box-shadow: 6px 0 0 var(--nx-gold); margin-right: 6px; }
    .nx-v1[data-nx-theme="day"] .nx-s-sec h2 { color: #10264d; }
    .nx-s-sec span { font-size: 12px; color: var(--nx-mute); }
    .nx-v1[data-nx-theme="day"] .nx-s-sec span { color: #1B2F55; }
    .nx-s-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; align-items: start; }
    .nx-s-grid .nx-card + .nx-card { margin-top: 0; }
    .nx-main > .nx-s-card, .nx-s-cols > div > .nx-card:first-child { margin-top: 18px; }
    .nx-s-card .nx-card-h h2 .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; }
    .nx-s-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 22px; align-items: start; }
    @media (max-width: 1000px) { .nx-s-cols { grid-template-columns: minmax(0, 1fr); } }
    .nx-s-foot { display: flex; justify-content: flex-end; padding: 10px 14px; border-top: 1px solid var(--nx-line); background: var(--nx-bg2); }
    .nx-s-pager { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .nx-s-pager .nx-lab { margin-right: 6px; font-size: 8px; color: var(--nx-mute); }
    .nx-s-pager button { min-width: 34px; height: 32px; padding: 0 8px; font: 600 14px var(--nx-cond); color: var(--nx-text); background: var(--nx-card2);
      border: 1px solid var(--nx-line2); border-radius: 4px; cursor: pointer; }
    .nx-s-pager button:hover { border-color: var(--nx-acc); color: var(--nx-acc); }
    .nx-s-pager button.on { background: var(--nx-red); border-color: var(--nx-red); color: var(--nx-on-red); cursor: default; }
    .nx-s-intro { margin-top: 18px; padding: 12px 16px; font-size: 13px; color: var(--nx-text); background: var(--nx-card); border: 1px solid var(--nx-line2);
      border-left: 4px solid var(--nx-red); border-radius: 10px; box-shadow: var(--nx-shadow); }
    .nx-s-intro p { margin: 0; } .nx-s-intro p + p { margin-top: 6px; }

    /* ---------- Stats tables ---------- */
    .nx-dt-wrap { overflow-x: auto; }
    table.nx-dt { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
    table.nx-dt th { background: var(--nx-thead); color: var(--nx-mute); font: 500 11px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.2px;
      padding: 8px 9px; border-bottom: 2px solid var(--nx-red); text-align: center; vertical-align: bottom; white-space: nowrap; }
    table.nx-dt th abbr { text-decoration: none; cursor: help; }
    table.nx-dt th a { color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; }
    table.nx-dt th a:hover { color: var(--nx-acc); }
    table.nx-dt th.sorted { color: var(--nx-acc); border-bottom-color: var(--nx-gold); }
    table.nx-dt tr.hd:not(.first) th { border-top: 6px solid var(--nx-card); }
    table.nx-dt tr.sub th { text-align: left; font: 600 14px var(--nx-cond); letter-spacing: 1.5px; color: var(--nx-strong); padding: 9px 12px;
      background: linear-gradient(90deg, var(--nx-grp1), var(--nx-card) 75%); border-bottom: 1px solid var(--nx-line2); }
    table.nx-dt tr.sub th .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; vertical-align: middle; margin-right: 8px; }
    table.nx-dt td { padding: 6px 9px; border-bottom: 1px solid var(--nx-line); text-align: center; white-space: nowrap; }
    table.nx-dt .l { text-align: left; }
    .nx-s-card.small table.nx-dt td.l:not(:has(a)) { white-space: normal; }
    table.nx-dt tr:not(.hd):not(.sub):nth-child(even) td { background: var(--nx-row-away); }
    table.nx-dt tr:not(.hd):not(.sub):hover td { background: var(--nx-hover); }
    table.nx-dt tr.me td { background: var(--nx-me) !important; }
    table.nx-dt tr.me td:first-child { box-shadow: inset 4px 0 0 var(--nx-gold); }
    table.nx-dt td.val { font: 600 17px var(--nx-cond); color: var(--nx-strong); }
    table.nx-dt tr:first-child + tr td.val, table.nx-dt tr.hd + tr td.val { color: var(--nx-acc); }
    table.nx-dt td.rk { width: 1%; font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); }
    table.nx-dt td.sorted { font-weight: 700; color: var(--nx-strong); background-image: linear-gradient(color-mix(in srgb, var(--nx-gold) 9%, transparent), color-mix(in srgb, var(--nx-gold) 9%, transparent)); }
    table.nx-dt td.win { color: var(--nx-win); font-weight: 600; } table.nx-dt td.loss { color: var(--nx-loss); font-weight: 600; }
    .nx-v1[data-nx-theme="day"] table.nx-dt td.win { color: #13803f; } .nx-v1[data-nx-theme="day"] table.nx-dt td.loss { color: #c3192b; }
    table.nx-dt td a { color: var(--nx-acc); font-weight: 600; }
    table.nx-dt td a:hover { text-decoration: underline; text-underline-offset: 2px; }
    table.nx-dt .nx-logo { width: 20px; height: 20px; image-rendering: pixelated; vertical-align: middle; }
    .nx-tmab { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--nx-text) !important; }
    a.nx-tmab:hover span { color: var(--nx-acc); }
    .nx-s-badge { display: inline-block; font: 600 10px var(--nx-cond); letter-spacing: 1px; padding: 1px 6px; border-radius: 3px; background: var(--nx-gold); color: var(--nx-on-gold); }
    `);
  }

  // Mount a stats page: palette, controls wiring, and the original page title kept for the tab.
  function statMount(html, palette) {
    const app = v1Mount(html);
    applyPalette(app, palette || HOME_PALETTE);
    wireCtls(app);
    // The page's own level tabs replace the league bar's level picker (one way to switch, not two).
    // A box score's sidebar shows a default level, not the game's, so it gets no level picker either.
    if ($('.nx-s-tabs[data-key="sublg"]', app) || PAGE === 'boxscore' || PAGE === 'playoffs') { const lv = $('.nx-lgbar-f.lv', app); if (lv) lv.remove(); }
    return app;
  }
  const levelTitle = (lv) => lv || 'All Levels';
  const heroSideMine = (team, label) => team ? `<div class="nx-hero-rank"><div class="lab">★ MY TEAM</div><div class="who">${esc(team)}</div>${label ? `<div class="lab">${esc(label)}</div>` : ''}</div>` : '';

  // ---------- V1 · Standings ----------
  function renderStandingsV1() {
    statSetup();
    const B = scrapeContent();
    const info = (B.find((b) => b.type === 'text' && /League:/.test(b.text)) || {}).text || '';
    const pick = (re) => (info.match(re) || [])[1] || '';
    const lgTxt = pick(/League:\s*(.*?)\s*Level:/) || leagueName;
    const lvTxt = pick(/Level:\s*(.*?)\s*(League Description:|$)/) || curLevel;
    const desc = pick(/League Description:\s*(.*)$/);
    const me = mine();
    let conf = '', myRow = null;
    const cards = [];
    B.filter((b) => b.type === 'table').forEach((b) => {
      const t = b.el;
      if (t.rows.length === 1) { const c = norm(t.textContent); if (/Conference|League/i.test(c)) conf = c; return; }
      let pos = 0, div = '', rows0 = 0, ptsAt = 3;
      const rows = [...t.rows].map((r) => {
        const cells = [...r.cells];
        if (cells.every((c) => /white_bold/.test(c.className) || c.hasAttribute('background'))) {
          div = norm(cells[0].textContent); pos = 0;
          ptsAt = cells.slice(2).findIndex((c) => /^PTS$/i.test(norm(c.textContent)));
          return `<tr class="hd${rows0++ ? '' : ' first'}"><th></th><th class="l">${esc(div)}</th>${cells.slice(2).map((c) => {
            const a = c.querySelector('a'), sorted = a && qp('sort') && new URL(a.href, location.href).searchParams.get('sort') === qp('sort');
            return `<th class="${sorted ? 'sorted' : ''}${/^PTS$/i.test(norm(c.textContent)) ? ' pts' : ''}">${richText(c)}</th>`;
          }).join('')}</tr>`;
        }
        if (cells.length < 5) return '';
        pos++;
        const team = resolveTeam(cells[2].textContent, div), coachA = cells[3].querySelector('a'), coach = norm(cells[3].textContent);
        const href = coachA ? coachA.href : (teamInfo[team] || {}).href || '#';
        const isMe = me.ids.has(teamIdOf(href));
        if (isMe) myRow = { team, pos, div };
        const stats = cells.slice(4).map((c, i) => {
          const v = norm(c.textContent);
          const cls = i === ptsAt ? 'pts' : /^Won [1-9]/.test(v) ? 'win' : /^Lost [1-9]/.test(v) ? 'loss' : '';
          return `<td class="${cls}">${esc(v.replace(/^Won /, 'W').replace(/^Lost /, 'L').replace(/^Tied? /, 'T'))}</td>`;
        }).join('');
        return `<tr class="${isMe ? 'me' : ''}"><td class="rk">${pos}</td><td class="l"><a class="nx-tmcell" href="${esc(href)}">${logoImg(team)}
          <span><div class="n">${esc(team)}</div><div class="c">${esc(coach)}</div></span></a></td>${stats}</tr>`;
      });
      cards.push(cardHtml(esc(conf || 'Standings'), esc(levelTitle(curLevel)), `<div class="nx-dt-wrap"><table class="nx-dt nx-s-st">${rows.join('')}</table></div>`, 'big'));
    });
    const tabs = B.find((b) => b.type === 'tabs');
    addCss(`
    table.nx-s-st td.pts { font: 600 15px var(--nx-cond); color: var(--nx-strong); }
    table.nx-s-st th.pts { color: var(--nx-acc); }
    table.nx-s-st .nx-tmcell .nx-logo { width: 24px; height: 24px; }
    table.nx-s-st .nx-tmcell .c { color: var(--nx-acc); font-weight: 600; }
    table.nx-s-st tr.hd th:nth-child(2) { font: 600 14px var(--nx-cond); letter-spacing: 1.5px; color: var(--nx-strong); }
    `);
    return statMount(`
      ${statHeroHtml({ eyebrow: `Standings · ${lgTxt}`, title: lvTxt || 'Standings', sub: desc ? esc(desc) : '',
        side: myRow ? heroSideMine(myRow.team, `${ordinal(myRow.pos)} in ${myRow.div}`) : '' })}
      ${tabs ? `<div class="nx-s-bar">${tabsHtml({ ...tabs, label: 'Level' })}</div>` : ''}
      ${cards.join('') || '<div class="nx-card nx-s-card"><div class="nx-empty">No standings for this level yet.</div></div>'}
    `);
  }

  // "Player Statistics Leaders - Classic '94-2026 Fall - GENS-A Season" -> title + eyebrow
  const splitHeading = (t) => { const p = (t || '').split(/\s+-\s+/); return { title: p[0] || '', rest: p.slice(1).join(' · ') }; };

  // ---------- V1 · Team roster ----------
  function renderRosterV1() {
    statSetup();
    const B = scrapeContent();
    const teamH = B.find((b) => b.type === 'h' && b.level === 'team');
    const team = teamH ? teamFromFull(teamH.text) : '';
    const head = splitHeading((B.find((b) => b.type === 'h' && b.level === 'sec') || {}).text);
    const lg = B.find((b) => b.type === 'logo');
    const statsB = B.find((b) => b.type === 'table' && /^GP W L T/.test(firstRowText(b.el)));
    let bar = '';
    if (statsB && statsB.el.rows[1]) {
      const ks = [...statsB.el.rows[0].cells].map((c) => norm(c.textContent)), vs = [...statsB.el.rows[1].cells].map((c) => norm(c.textContent));
      bar = `<div class="nx-statbar">${ks.map((k, i) => {
        const v = vs[i] || '', n = parseFloat(v), cls = k === 'GDIF' && n ? (n > 0 ? 'pos' : 'neg') : '';
        return `<div class="nx-stat"><div class="k">${esc(k)}</div><div class="v ${cls}">${esc(k === 'GDIF' && n > 0 ? '+' + v : v || '–')}</div></div>`;
      }).join('')}</div>`;
    }
    const teamSel = B.find((b) => b.type === 'select' && b.el.name === 'id');
    const info = teamInfo[team] || {};
    const used = new Set([teamH, statsB, teamSel, lg].filter(Boolean));
    const cut = statsB ? B.indexOf(statsB) + 1 : B.findIndex((b) => b.type === 'table');
    const ctl = B.slice(0, cut).filter((b) => !used.has(b) && /^(tabs|select)$/.test(b.type));
    const body = B.slice(Math.max(cut, 0)).filter((b) => !used.has(b));
    return statMount(`
      ${statHeroHtml({ eyebrow: head.rest || 'Team Roster', title: teamH ? teamH.text : 'Team Roster', logo: lg ? lg.src : (team ? logo(team, 100) : ''),
        sub: info.coach ? `<div class="nx-coach">Coach <b>${esc(info.coach)}</b>${dcSlot(info.coach)}</div>` : '',
        actions: (teamSel ? selectHtml({ ...teamSel, label: 'Team' }) : '')
          + (info.href ? `<a class="nx-btn gold" href="${esc(info.href)}"><span>Coach Page</span></a>` : ''),
        bar })}
      ${ctlBarHtml(ctl)}
      ${blocksHtml(body, { defaultTitle: 'Roster' })}
    `, team ? teamPalette(team) : HOME_PALETTE);
  }

  // ---------- V1 · Lists: player leaders, all-time user standings, league records, site records ----------
  const LIST_PAGES = {
    players: { heroHeading: true, defaultTitle: 'Player Stats Leaders', sortSel: 'sort' },
    allstats: { heroHeading: true, defaultTitle: 'All-Time Standings', sortVal: true, eyebrow: 'Site Stats · All-time' },
    records: { title: 'League Records', eyebrow: () => [leagueName, curLevel].filter(Boolean).join(' · ') },
    siterecords: { title: 'Site Records', eyebrow: (tab) => 'All-time' + (tab ? ' · ' + tab : '') },
  };
  function renderListV1(kind) {
    statSetup();
    const cfg = LIST_PAGES[kind];
    const B = scrapeContent();
    const heroH = cfg.heroHeading ? B.find((b) => b.type === 'h') : null;
    const firstSec = B.findIndex((b) => b.type === 'h' && b !== heroH);
    const firstTable = B.findIndex((b) => b.type === 'table');
    const cut = [firstSec, firstTable].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), B.length);
    const head = B.slice(0, cut), pagers = B.filter((b) => b.type === 'pager');
    const body = B.slice(cut).filter((b) => b.type !== 'pager');
    // Page buttons go under the last table, wherever the original put them.
    let lastT = -1;
    body.forEach((b, i) => { if (b.type === 'table') lastT = i; });
    if (lastT >= 0) body.splice(lastT + 1, 0, ...pagers);
    const intro = head.filter((b) => b.type === 'text');
    const ctl = head.filter((b) => /^(tabs|select|value)$/.test(b.type));
    const sortSel = cfg.sortSel && ctl.find((b) => b.type === 'select' && b.el.name === cfg.sortSel);
    const sortVal = cfg.sortVal && ctl.find((b) => b.type === 'value' && /sort/i.test(b.label || ''));
    const sortCol = sortSel ? norm((sortSel.el.options[sortSel.el.selectedIndex] || {}).text).replace(/\s*[↑↓]$/, '')
      : sortVal ? sortVal.text.replace(/\s*[↑↓]$/, '') : '';
    const onTab = ((ctl.find((b) => b.type === 'tabs') || { links: [] }).links.find((l) => l.on) || {}).text || '';
    const h = splitHeading(heroH && heroH.text);
    const eyebrow = typeof cfg.eyebrow === 'function' ? cfg.eyebrow(onTab) : cfg.eyebrow || h.rest || leagueName;
    return statMount(`
      ${statHeroHtml({ eyebrow, title: cfg.title || h.title || cfg.defaultTitle, sub: intro.map((b) => `<p>${b.html}</p>`).join('') })}
      ${ctlBarHtml(ctl)}
      ${blocksHtml(body, { defaultTitle: cfg.defaultTitle, sortCol })}
    `);
  }

  // ---------- V1 · Box score ----------
  function renderBoxScoreV1() {
    statSetup();
    const B = scrapeContent();
    const T = B.filter((b) => b.type === 'table').map((b) => b.el);
    const titled = (re) => T.find((t) => re.test(norm(t.rows[0].textContent)));
    const gs = titled(/^Game Stats$/);
    if (!gs) return renderListV1Generic(B);
    const line = T.find((t) => /box_table/.test(t.className));
    const per = titled(/^Period Stats/), scoring = titled(/^Scoring Summary/), pens = titled(/^Penalty Summary/);
    const players = T.filter((t) => /Player Stats/.test(norm(t.rows[0].textContent)));
    const subm = norm((T.find((t) => /Game Submitted by/i.test(t.textContent)) || {}).textContent || '').replace(/^Game Submitted by:\s*/i, '');
    const vals = (r) => [...r.cells].map((c) => norm(c.textContent));
    const gr = [...gs.rows];
    const names = vals(gr[1]);
    const logos = B.filter((b) => b.type === 'logo');
    const side = (i) => {
      const nm = i ? names[names.length - 1] : names[0];
      const team = TEAMS[nm] ? nm : teamFromFull((logos[i] || {}).alt || nm);
      return { team, name: nm };
    };
    const A = side(0), H = side(1);
    const row = (label) => gr.find((r) => r.cells.length === 3 && norm(r.cells[1].textContent) === label);
    const coachR = row('Coach'), scoreR = row('Score');
    A.coach = coachR ? vals(coachR)[0] : ''; H.coach = coachR ? vals(coachR)[2] : '';
    A.goals = scoreR ? +vals(scoreR)[0] : 0; H.goals = scoreR ? +vals(scoreR)[2] : 0;
    [A, H].forEach((s) => {
      const t = Object.keys(teamInfo).find((k) => teamInfo[k].coach === s.coach);
      s.href = t ? teamInfo[t].href : '';
      s.logo = TEAMS[s.team] ? logo(s.team, 100) : (logos[s === A ? 0 : 1] || {}).src || '';
      s.color = TEAM_COLORS[s.team] ? (lum(TEAM_COLORS[s.team][0]) < 0.01 ? mixHex(TEAM_COLORS[s.team][1], '#000000', 0.45) : TEAM_COLORS[s.team][0]) : '#3366CC';
      const c = TEAM_COLORS[s.team] || ['#3366CC', '#9B0000'];
      s.bar = (bg) => contrast(c[0], bg) >= 2 ? c[0] : contrast(c[1], bg) >= 2 ? c[1] : readableOn(bg, c[0], 2.5);
    });
    const winner = A.goals > H.goals ? A : H.goals > A.goals ? H : null;
    const lineRows = line ? [...line.rows].map(vals) : [];
    const ot = lineRows[0] && lineRows[0].length > 4;
    const linescore = lineRows.length ? `<table class="nx-bx-line"><tr>${lineRows[0].map((c, i) => `<th>${i ? esc(c) : ''}</th>`).join('')}<th>T</th></tr>
      ${lineRows.slice(1).map((r, i) => `<tr>${r.map((c, j) => `<td>${j ? esc(c) : `${logoImg((i ? H : A).team)}${esc(c)}`}</td>`).join('')}<td class="t">${(i ? H : A).goals}</td></tr>`).join('')}</table>` : '';
    const teamHtml = (s, cls) => {
      const nick = (TEAMS[s.team] || [])[1] || '';
      const inner = `<div class="nx-hero-logo"><img src="${esc(s.logo)}" alt=""></div>
        <div class="nm">${esc(s.team || s.name)}</div>${nick ? `<div class="nk">${esc(nick)}</div>` : ''}`;
      return `<div class="nx-bx-tm ${cls}${winner === s ? ' win' : winner ? ' lose' : ''}">
        ${s.href ? `<a href="${esc(s.href)}" title="${esc(s.coach)}'s coach page">${inner}</a>` : inner}
        <div class="co">${esc(s.coach)}${dcSlot(s.coach)}</div></div>`;
    };
    // Game stats: away | label + split bar | home
    const num = (v) => { const m = /^(\d+):(\d+)$/.exec(v); if (m) return +m[1] * 60 + +m[2]; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const cmp = gr.filter((r) => r.cells.length === 3 && !/^(Coach|Score|vs\.?)$/i.test(norm(r.cells[1].textContent)) && norm(r.cells[1].textContent)).map((r) => {
      const [a, label, h] = vals(r), na = num(a), nh = num(h), tot = na + nh;
      return `<div class="nx-bx-row"><span class="v a${na > nh ? ' lead' : ''}">${esc(a)}</span>
        <div class="mid"><div class="lab">${esc(label)}</div><div class="bars${tot ? '' : ' none'}"><i class="a" style="flex:${tot ? na : 1}"></i><i class="h" style="flex:${tot ? nh : 1}"></i></div></div>
        <span class="v h${nh > na ? ' lead' : ''}">${esc(h)}</span></div>`;
    }).join('');
    const tblCard = (t, title, opts = {}) => (t ? cardHtml(title, opts.meta || '', dtHtml(tableModel(t), { skipTitle: true, badges: true })) : '');
    const teamTitle = (s) => `${logoImg(s.team)}${esc(fullTeamName(s.team) || s.name)}`;
    addCss(`
    .nx-bx-hero { background: linear-gradient(100deg, var(--bx-ah) 0%, color-mix(in srgb, var(--bx-ah) 40%, #06080f) 30%, #06080f 50%, color-mix(in srgb, var(--bx-hh) 40%, #06080f) 70%, var(--bx-hh) 100%); }
    .nx-bx-sb { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 20px; padding: 26px 30px 18px; }
    .nx-bx-tm { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; min-width: 0; }
    .nx-bx-tm > a { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .nx-bx-tm .nx-hero-logo { width: 116px; height: 116px; margin-bottom: 8px; }
    .nx-bx-tm .nm { font: 700 clamp(22px, 3vw, 34px)/1 var(--nx-cond); text-transform: uppercase; letter-spacing: 1px; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35); }
    .nx-bx-tm .nk { font: 500 15px var(--nx-cond); text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.75); }
    .nx-bx-tm .co { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; margin-top: 6px; font: 600 15px var(--nx-cond);
      letter-spacing: 1px; text-transform: uppercase; color: var(--nx-acc-n); }
    .nx-bx-tm.lose .nx-hero-logo { box-shadow: 0 0 0 3px rgba(255,255,255,.25); }
    .nx-bx-tm.lose .nx-hero-logo img { filter: grayscale(.5) brightness(.85); }
    .nx-bx-tm.lose .nm { color: rgba(255,255,255,.7); }
    .nx-bx-tm > a:hover .nm { color: var(--nx-acc-n); }
    .nx-bx-mid { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .nx-bx-score { display: flex; align-items: center; gap: 14px; font-family: var(--nx-px); font-size: clamp(34px, 5vw, 56px); color: rgba(255,255,255,.55);
      padding: 14px 22px; background: rgba(0,0,0,.55); border: 2px solid rgba(255,255,255,.15); border-radius: 6px; text-shadow: 4px 4px 0 rgba(0,0,0,.6); }
    .nx-bx-score b { font-weight: 400; } .nx-bx-score b.w { color: #fff; } .nx-bx-score span { font-size: .5em; }
    table.nx-bx-line { border-collapse: collapse; font-size: 13px; background: rgba(0,0,0,.45); border-radius: 4px; overflow: hidden; font-variant-numeric: tabular-nums; }
    table.nx-bx-line th { font: 500 11px var(--nx-cond); letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,.65); padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,.15); }
    table.nx-bx-line td { padding: 4px 10px; text-align: center; color: #fff; }
    table.nx-bx-line td:first-child { text-align: left; font-weight: 600; white-space: nowrap; }
    table.nx-bx-line td:first-child .nx-logo { width: 18px; height: 18px; image-rendering: pixelated; vertical-align: middle; margin-right: 6px; }
    table.nx-bx-line td.t { font-family: var(--nx-px); font-size: 10px; color: var(--nx-acc-n); border-left: 1px solid rgba(255,255,255,.15); }
    .nx-bx-meta { position: relative; z-index: 1; padding: 9px 30px; font-size: 12px; color: rgba(255,255,255,.75); background: rgba(0,0,0,.45); border-top: 1px solid rgba(255,255,255,.1); text-align: center; }
    @media (max-width: 700px) {
      .nx-bx-sb { grid-template-columns: 1fr 1fr; padding: 18px; }
      .nx-bx-mid { grid-column: 1 / -1; order: 3; }
      .nx-bx-tm .nx-hero-logo { width: 80px; height: 80px; } .nx-bx-tm .nx-hero-logo img { width: 64px; height: 64px; }
    }
    .nx-bx { --bx-a: var(--bx-a-n); --bx-h: var(--bx-h-n); }
    .nx-v1[data-nx-theme="day"] .nx-bx { --bx-a: var(--bx-a-d); --bx-h: var(--bx-h-d); }
    .nx-bx-keys { display: flex; justify-content: space-between; padding: 10px 16px 0; font: 600 13px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; color: var(--nx-mute); }
    .nx-bx-keys span { display: inline-flex; align-items: center; gap: 6px; }
    .nx-bx-keys .nx-logo { width: 20px; height: 20px; image-rendering: pixelated; }
    .nx-bx-rows { padding: 6px 16px 14px; }
    .nx-bx-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 92px; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--nx-line); }
    .nx-bx-row:last-child { border-bottom: 0; }
    .nx-bx-row .v { font: 500 16px var(--nx-cond); color: var(--nx-mute); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .nx-bx-row .v.h { text-align: right; }
    .nx-bx-row .v.lead { color: var(--nx-strong); font-weight: 700; }
    .nx-bx-row .lab { text-align: center; font: 500 11px var(--nx-cond); letter-spacing: 1.3px; text-transform: uppercase; color: var(--nx-mute); margin-bottom: 5px; }
    .nx-bx-row .bars { display: flex; gap: 3px; height: 8px; }
    .nx-bx-row .bars i { display: block; min-width: 3px; border-radius: 1px; }
    .nx-bx-row .bars i.a { background: var(--bx-a); } .nx-bx-row .bars i.h { background: var(--bx-h); }
    .nx-bx-row .bars.none i { background: var(--nx-line2); }
    @media (max-width: 500px) { .nx-bx-row { grid-template-columns: 70px minmax(0, 1fr) 70px; gap: 8px; } }
    `);
    const app = statMount(`
      <section class="nx-hero nx-bx-hero" style="--bx-ah:${A.color};--bx-hh:${H.color}">
        <div class="nx-bx-sb">
          ${teamHtml(A, 'away')}
          <div class="nx-bx-mid">
            <div class="nx-eyebrow">${winner ? 'FINAL' : 'FINAL · TIE'}${ot ? ' · OT' : ''}</div>
            <div class="nx-bx-score" aria-label="${esc(`${A.team} ${A.goals}, ${H.team} ${H.goals}`)}"><b class="${winner === A ? 'w' : ''}">${A.goals}</b><span>-</span><b class="${winner === H ? 'w' : ''}">${H.goals}</b></div>
            ${linescore}
          </div>
          ${teamHtml(H, 'home')}
        </div>
        ${subm ? `<div class="nx-bx-meta">Game logged by ${esc(subm)}</div>` : ''}
      </section>
      <div class="nx-s-cols">
        <div>
          <div class="nx-card nx-s-card nx-bx" style="--bx-a-n:${A.bar('#141C2F')};--bx-a-d:${A.bar('#FFFFFF')};--bx-h-n:${H.bar('#141C2F')};--bx-h-d:${H.bar('#FFFFFF')}">
            <div class="nx-card-h"><h2>Game Stats</h2><span class="nx-meta">Away · Home</span></div>
            <div class="nx-bx-keys"><span>${logoImg(A.team)}${esc(A.team)}</span><span>${esc(H.team)}${logoImg(H.team)}</span></div>
            <div class="nx-bx-rows">${cmp}</div>
          </div>
        </div>
        <div>
          ${tblCard(scoring, 'Scoring Summary')}
          ${tblCard(pens, 'Penalty Summary')}
          ${tblCard(per, 'Period Stats', { meta: 'Goals-Shots' })}
        </div>
      </div>
      <div class="nx-s-cols">
        ${players.map((t, i) => `<div>${cardHtml(teamTitle(i ? H : A), 'Player Stats', dtHtml(tableModel(t), { skipTitle: true }))}</div>`).join('')}
      </div>
    `, winner ? teamPalette(winner.team) : HOME_PALETTE);
    return app;
  }
  // A page we only partly understand still gets the V1 look: hero + every block as cards.
  function renderListV1Generic(B) {
    const h = B.find((b) => b.type === 'h');
    return statMount(`${statHeroHtml({ eyebrow: leagueName, title: h ? h.text : document.title })}${ctlBarHtml(B.filter((b) => /^(tabs|select|value)$/.test(b.type)))}
      ${blocksHtml(B.filter((b) => b !== h && !/^(tabs|select|value)$/.test(b.type)))}`);
  }

  // ---------- V1 · Playoffs ----------
  // The original lists rounds newest first, each series as a matchup table + a game table.
  // We rebuild it as a bracket: Round 1 on the left, the final on the right.
  function scrapePlayoffs() {
    const tabs = $$('a[href*="playoffs.php"]').filter((a) => /playslg=/.test(a.getAttribute('href') || '') && /link4/.test(a.className))
      .map((a) => ({ text: norm(a.textContent), href: a.href, v: new URL(a.href, location.href).searchParams.get('playslg') }));
    const curTab = qp('playslg') || (tabs[0] || {}).v || '';
    tabs.forEach((t) => { t.on = t.v === curTab; });
    const descL = $$('span.text_black_it').find((s) => /^Playoff Description:?$/.test(norm(s.textContent)));
    const desc = descL ? norm((($$('span.text_black_it').filter((s) => s !== descL && descL.compareDocumentPosition(s) & 4))[0] || {}).textContent || '') : '';
    const rounds = [];
    let round = null, conf = '';
    $$('span.heading_black, table.small_black').forEach((el) => {
      if (el.tagName === 'SPAN') {
        const t = norm(el.textContent), m = /^ROUND\s+(\d+)\s*(.*?)\s*\|\s*(.*)$/i.exec(t);
        if (m) { round = { n: +m[1], level: m[2], name: m[3] || 'Round ' + m[1], series: [] }; rounds.push(round); conf = ''; }
        else if (round && t) conf = t;
        return;
      }
      const hd = el.rows[0] && [...el.rows[0].cells].map((c) => norm(c.textContent));
      if (!round || !hd || !/^Best of \d+/i.test(hd[0] || '')) return;
      const mt = el.previousElementSibling;
      if (!mt || mt.tagName !== 'TABLE' || mt.rows.length < 2) return;
      const side = (i) => {
        const img = mt.rows[0].cells[i] && mt.rows[0].cells[i].querySelector('img'), c = mt.rows[1].cells[i];
        if (!c) return null;
        const a = c.querySelector('a'), name = norm(a ? a.textContent : (c.firstChild || {}).textContent || '');
        const texts = [...c.childNodes].filter((n) => n.nodeType === 3).map((n) => norm(n.textContent)).filter(Boolean);
        return { team: name, href: a ? a.href : '', id: teamIdOf(a && a.href), seed: ((/\((\d+)\)/.exec(c.textContent)) || [])[1] || '',
          coach: texts.filter((x) => !/^\(\d+\)$/.test(x)).pop() || '', logo: img ? img.getAttribute('src') : '' };
      };
      const A = side(0), H = side(2);
      if (!A || !H) return;
      const games = [...el.rows].slice(1).filter((r) => r.cells.length >= 3).map((r) => {
        const v = [...r.cells].map((c) => norm(c.textContent));
        const box = r.cells[0].querySelector('a'), log = r.cells[2].querySelector('a');
        const m = /^(\d+)-(\d+)\s*([A-Za-z.]+)?\s*(OT)?/i.exec(v[2]);
        return { n: v[0].replace(/^Game\s*/i, ''), at: v[1].replace(/^@\s*/, ''), when: v[3] && v[3] !== '-' ? v[3] : '',
          box: box ? box.href : '', log: log ? log.href : '', played: !!m, hi: m ? +m[1] : 0, lo: m ? +m[2] : 0,
          win: m ? (m[3] || '') : '', ot: !!(m && m[4]), ifNec: /if nec/i.test(v[2]) };
      });
      // Abbreviations ("EDM", "ASE") -> which side. Game 1 is at the higher seed's (left team's) rink.
      const sideOf = (ab) => {
        const a = abbrScore(ab, A.team), h = abbrScore(ab, H.team);
        if (a !== h) return a > h ? 'a' : 'h';
        return games[0] && games[0].at === ab ? 'a' : 'h';
      };
      games.forEach((g) => { if (g.played && g.win) g.side = sideOf(g.win); });
      const status = hd[1] || '', sm = /^(\S+)\s+wins\b/i.exec(status);
      const wa = games.filter((g) => g.side === 'a').length, wh = games.filter((g) => g.side === 'h').length;
      const winner = sm ? sideOf(sm[1]) : '';
      round.series.push({ A, H, games, wa, wh, best: hd[0], status, winner, conf });
    });
    rounds.sort((a, b) => a.n - b.n);
    // Bracket order: walk back from the latest round so each series sits next to where its teams came from.
    for (let i = rounds.length - 2; i >= 0; i--) {
      const left = [...rounds[i].series], out = [];
      rounds[i + 1].series.forEach((s) => [s.A, s.H].forEach((t) => {
        const k = left.findIndex((x) => x.A.team === t.team || x.H.team === t.team);
        if (k >= 0) out.push(left.splice(k, 1)[0]);
      }));
      rounds[i].series = out.concat(left);
    }
    // A finished one-series round after a two-series round is the final.
    const last = rounds[rounds.length - 1], prev = rounds[rounds.length - 2];
    const fin = last && last.series.length === 1 && (!prev || prev.series.length === 2) && rounds.length > 1 ? last.series[0] : null;
    const champ = fin && fin.winner ? (fin.winner === 'a' ? fin.A : fin.H) : null;
    return { tabs, curTab, desc, rounds, champ };
  }

  function renderPlayoffsV1() {
    statSetup();
    const P = scrapePlayoffs();
    const me = mine();
    const isMine = (t) => me.ids.has(String(t.id)) || me.coaches.has((t.coach || '').toLowerCase());
    const all = P.rounds.flatMap((r) => r.series.map((s) => ({ ...s, r })));
    const played = all.flatMap((s) => s.games.filter((g) => g.played));
    const confsIn = (r) => new Set(r.series.map((s) => s.conf).filter(Boolean)).size > 1;
    const teamRow = (s, k) => {
      const t = k === 'a' ? s.A : s.H, w = k === 'a' ? s.wa : s.wh;
      const cls = (s.winner ? (s.winner === k ? ' win' : ' out') : '') + (isMine(t) ? ' me' : '');
      return `<div class="nx-po-tm${cls}" data-tm="${esc(t.team)}">
        ${t.logo ? `<img class="nx-logo" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : logoImg(t.team)}
        <span class="sd" title="Seed ${esc(t.seed)}">${esc(t.seed)}</span>
        <span class="who">${t.href ? `<a class="n" href="${esc(t.href)}" title="${esc(t.team)}">${esc(t.team)}</a>` : `<span class="n" title="${esc(t.team)}">${esc(t.team)}</span>`}
          <span class="c"><span title="${esc(t.coach)}">${esc(t.coach)}</span>${dcSlot(t.coach)}</span></span>
        <span class="w" aria-label="${w} ${w === 1 ? 'win' : 'wins'}">${w}</span></div>`;
    };
    const gameChip = (g) => {
      const tip = `Game ${g.n} @ ${g.at}${g.when ? ' · ' + g.when : ''}`;
      if (g.played) {
        const inner = `<span class="g">G${esc(g.n)}</span><span class="r"><b>${esc(g.win)}</b> ${g.hi}-${g.lo}${g.ot ? ' <em>OT</em>' : ''}</span>`;
        return g.box ? `<a class="nx-po-g" href="${esc(g.box)}" title="${esc(tip)} · Box score">${inner}</a>` : `<span class="nx-po-g" title="${esc(tip)}">${inner}</span>`;
      }
      if (g.log) return `<a class="nx-po-g log" href="${esc(g.log)}" title="${esc(tip)} · Log this game"><span class="g">G${esc(g.n)}</span><span class="r">Log</span></a>`;
      return `<span class="nx-po-g nec" title="${esc(tip)}${g.ifNec ? ' · if necessary' : ''}"><span class="g">G${esc(g.n)}</span><span class="r">${g.ifNec ? 'If nec.' : '–'}</span></span>`;
    };
    const seriesCard = (s) => {
      const state = s.winner ? 'done' : s.wa + s.wh ? 'live' : 'new';
      const mineS = isMine(s.A) || isMine(s.H);
      return `<article class="nx-po-s ${state}${mineS ? ' me' : ''}" data-win="${esc(s.winner ? (s.winner === 'a' ? s.A : s.H).team : '')}">
        <div class="nx-po-h"><span>${esc(s.best)}</span><b>${esc(s.status)}</b></div>
        ${teamRow(s, 'a')}${teamRow(s, 'h')}
        <div class="nx-po-gs">${s.games.map(gameChip).join('')}</div>
      </article>`;
    };
    const roundCol = (r) => {
      let lastConf = null;
      const body = r.series.map((s) => {
        const h = confsIn(r) && s.conf !== lastConf ? `<div class="nx-po-conf">${esc(s.conf)}</div>` : '';
        lastConf = s.conf;
        return h + seriesCard(s);
      }).join('');
      return `<section class="nx-po-r${r === P.rounds[P.rounds.length - 1] ? ' last' : ''}" style="--n:${r.n}">
        <header><span class="k">Round ${r.n}</span><h2>${esc(r.name)}</h2></header>
        <div class="nx-po-col">${body}</div></section>`;
    };
    // Hero side: the champion, else where my team stands.
    const myS = [...all].reverse().find((s) => isMine(s.A) || isMine(s.H));
    let side = '';
    if (P.champ) {
      side = `<div class="nx-hero-rank nx-po-champ"><div class="lab">🏆 Champion</div>
        ${P.champ.logo ? `<img src="${esc(P.champ.logo.replace(/logos\d+\//, 'logos100/'))}" alt="" onerror="this.src='${esc(P.champ.logo)}'">` : ''}
        <div class="who">${esc(P.champ.team)}</div><div class="lab">${esc(P.champ.coach)}</div></div>`;
    } else if (myS) {
      const t = isMine(myS.A) ? myS.A : myS.H, k = t === myS.A ? 'a' : 'h';
      const w = k === 'a' ? myS.wa : myS.wh, l = k === 'a' ? myS.wh : myS.wa;
      const st = myS.winner ? (myS.winner === k ? `Won ${myS.r.name}` : `Out in ${myS.r.name}`) : `${myS.r.name} · ${w > l ? 'leads' : w < l ? 'trails' : 'tied'} ${w}-${l}`;
      side = heroSideMine(t.team, st);
    }
    const cur = P.rounds[P.rounds.length - 1];
    const stat = (k, v) => `<div class="nx-stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const bar = P.rounds.length ? `<div class="nx-statbar">${stat('Round', `${cur.n}<small> / ${esc(cur.name)}</small>`)}
      ${stat('Series Left', all.filter((s) => !s.winner).length)}${stat('Games Played', played.length)}
      ${stat('OT Games', played.filter((g) => g.ot).length)}${stat('Sweeps', all.filter((s) => s.winner && !Math.min(s.wa, s.wh)).length)}</div>` : '';
    addCss(`
    .nx-po-hero .nx-stat .v small { font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,.7); }
    .nx-po-champ img { display: block; width: 72px; height: 72px; margin: 8px auto 2px; image-rendering: pixelated; filter: drop-shadow(0 3px 4px rgba(0,0,0,.5)); }
    .nx-po-champ .lab:last-child { margin-top: 2px; }
    .nx-po { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(240px, 1fr); gap: 20px; margin-top: 18px; padding-bottom: 6px; overflow-x: auto; }
    .nx-po-r { display: flex; flex-direction: column; min-width: 0; }
    .nx-po-r header { padding: 0 2px 8px; margin-bottom: 10px; border-bottom: 2px solid var(--nx-red); }
    .nx-po-r header .k { font-family: var(--nx-px); font-size: 8px; color: var(--nx-acc); }
    .nx-po-r header h2 { margin: 5px 0 0; font: 600 17px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.3px; color: var(--nx-strong); }
    .nx-v1[data-nx-theme="day"] .nx-po-r header h2 { color: #10264d; }
    .nx-po-r.last header { border-bottom-color: var(--nx-gold); }
    .nx-po-col { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 10px; }
    .nx-po-conf { font: 500 11px var(--nx-cond); letter-spacing: 1.4px; text-transform: uppercase; color: var(--nx-mute); margin-bottom: -4px; }
    .nx-po-s { position: relative; background: var(--nx-card); border: 1px solid var(--nx-line); border-radius: 8px; box-shadow: var(--nx-shadow); }
    .nx-po { position: relative; }
    .nx-po-r { position: relative; z-index: 1; }
    svg.nx-po-lines { position: absolute; left: 0; top: 0; z-index: 0; pointer-events: none; overflow: visible; }
    svg.nx-po-lines path { fill: none; stroke: color-mix(in srgb, var(--nx-mute) 55%, transparent); stroke-width: 2; }
    svg.nx-po-lines path.champ { stroke: var(--nx-acc); stroke-width: 2.5; }
    svg.nx-po-lines path.me { stroke: var(--nx-gold); stroke-width: 2.5; }
    .nx-po-s.me { border-color: var(--nx-gold); box-shadow: 0 0 0 1px var(--nx-gold), var(--nx-shadow); }
    .nx-po-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 10px; font: 500 11px var(--nx-cond);
      letter-spacing: 1.2px; text-transform: uppercase; color: var(--nx-mute); background: var(--nx-thead); border-radius: 8px 8px 0 0; border-bottom: 1px solid var(--nx-line); }
    .nx-po-h b { font-weight: 600; color: var(--nx-strong); }
    .nx-po-s.done .nx-po-h b { color: var(--nx-acc); }
    .nx-po-s.new .nx-po-h b { color: var(--nx-mute); }
    .nx-po-tm { display: grid; grid-template-columns: 20px 14px minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 4px 10px; min-height: 30px; border-bottom: 1px solid var(--nx-line); }
    .nx-po-tm .nx-logo { width: 20px; height: 20px; image-rendering: pixelated; }
    .nx-po-tm .sd { font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); text-align: center; }
    .nx-po-tm .who { display: flex; align-items: center; gap: 8px; min-width: 0; white-space: nowrap; }
    .nx-po-tm .n { font: 600 14px/1.2 var(--nx-cond); text-transform: uppercase; letter-spacing: .5px; color: var(--nx-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; min-width: 0; }
    .nx-po-tm a.n:hover { color: var(--nx-acc); }
    .nx-po-tm .c { display: inline-flex; align-items: center; flex: 0 1 auto; min-width: 0; font-size: 12px; font-weight: 600; color: var(--nx-acc); }
    .nx-po-tm .w { font-family: var(--nx-px); font-size: 12px; color: var(--nx-mute); min-width: 18px; text-align: right; }
    .nx-po-tm.win { background: color-mix(in srgb, var(--nx-gold) 10%, transparent); }
    .nx-po-tm.win .n { color: var(--nx-strong); } .nx-po-tm.win .w { color: var(--nx-acc); }
    .nx-po-tm.out .n, .nx-po-tm.out .w { color: var(--nx-dim); }
    .nx-po-tm.out .nx-logo { filter: grayscale(.7); opacity: .7; }
    .nx-po-tm.me { box-shadow: inset 4px 0 0 var(--nx-gold); }
    .nx-po-tm .c > span:first-child { overflow: hidden; text-overflow: ellipsis; }
    .nx-po-tm .nx-dc-slot { margin-left: 5px; flex: none; } .nx-po-tm .nx-dc { height: 20px; width: 24px; padding: 0; justify-content: center; } .nx-po-tm .nx-dc span { display: none; } .nx-po-tm .nx-dc svg { width: 12px; height: 12px; }
    .nx-po-tm .nx-dc-edit { width: 20px; height: 20px; }
    .nx-po-gs { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 8px 7px; }
    .nx-po-g { display: flex; align-items: baseline; gap: 5px; padding: 3px 6px; border: 1px solid var(--nx-line2); border-radius: 4px; background: var(--nx-bg2);
      font-variant-numeric: tabular-nums; color: var(--nx-text); white-space: nowrap; }
    .nx-po-g .g { font-size: 10px; color: var(--nx-dim); }
    .nx-po-g .r { font: 500 13px var(--nx-cond); white-space: nowrap; } .nx-po-g .r b { font-weight: 700; color: var(--nx-strong); }
    .nx-po-g .r em { font-style: normal; font-size: 10px; font-weight: 600; color: var(--nx-tie); }
    .nx-v1[data-nx-theme="day"] .nx-po-g .r em { color: #8a6100; }
    a.nx-po-g:hover { border-color: var(--nx-acc); }
    .nx-po-g.log { background: var(--nx-red); border-color: var(--nx-red); }
    .nx-po-g.log .g, .nx-po-g.log .r { color: var(--nx-on-red); } .nx-po-g.log .r { font-weight: 600; text-transform: uppercase; letter-spacing: .6px; font-size: 12px; }
    .nx-po-g.log:hover { filter: brightness(1.12); }
    .nx-po-g.nec { border-style: dashed; background: none; } .nx-po-g.nec .r { color: var(--nx-dim); }
    @media (max-width: 1000px) {
      .nx-po { grid-auto-flow: row; grid-auto-columns: auto; overflow: visible; }
      .nx-po-r { order: calc(-1 * var(--n)); }
      .nx-po-col { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      svg.nx-po-lines { display: none; }
      .nx-po-conf { grid-column: 1 / -1; margin: 0; }
    }
    `);
    const tabsB = P.tabs.length > 1 ? { label: 'Level', links: Object.assign(P.tabs, { key: 'playslg' }) } : null;
    const app = statMount(`
      ${statHeroHtml({ eyebrow: ['Playoffs', leagueName, P.curTab].filter(Boolean).join(' · '), title: `${P.curTab ? P.curTab + ' ' : ''}Playoffs`,
        sub: P.desc ? esc(P.desc) : '', side, bar }).replace('nx-s-hero', 'nx-s-hero nx-po-hero')}
      ${tabsB ? `<div class="nx-s-bar">${tabsHtml(tabsB)}</div>` : ''}
      ${P.rounds.length ? `<div class="nx-po">${P.rounds.map(roundCol).join('')}</div>`
        : '<div class="nx-card nx-s-card" style="margin-top:18px"><div class="nx-empty">No playoff series for this level yet.</div></div>'}
    `, P.champ && TEAM_COLORS[P.champ.team] ? teamPalette(P.champ.team) : HOME_PALETTE);
    const po = $('.nx-po', app);
    if (po && window.ResizeObserver) new ResizeObserver(() => drawPlayoffLines(po, P.champ && P.champ.team)).observe(po);
    return app;
  }

  // Bracket lines: from a series winner's row to that team's row in the next round (elbow in the gap).
  // The champion's run is traced in the accent colour, my team's in gold. Stacked (phone) layout has no lines.
  function drawPlayoffLines(po, champ) {
    let svg = $('svg.nx-po-lines', po);
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'nx-po-lines'); svg.setAttribute('aria-hidden', 'true'); po.prepend(svg); }
    const cols = $$('.nx-po-r', po), base = po.getBoundingClientRect();
    if (!base.width || getComputedStyle(svg).display === 'none') return;
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - base.left + po.scrollLeft, r: r.right - base.left + po.scrollLeft, y: r.top - base.top + r.height / 2 }; };
    const plain = [], hi = []; // highlighted runs go last so they sit on top
    for (let i = 1; i < cols.length; i++) {
      $$('.nx-po-tm', cols[i]).forEach((to) => {
        const team = to.dataset.tm;
        const from = $$('.nx-po-s', cols[i - 1]).find((s) => s.dataset.win === team);
        const fromRow = from && $$('.nx-po-tm', from).find((r) => r.dataset.tm === team);
        if (!fromRow) return;
        const a = box(fromRow), b = box(to), ar = box(from).r, mx = (ar + b.l) / 2;
        const cls = team === champ ? 'champ' : to.classList.contains('me') ? 'me' : '';
        (cls ? hi : plain).push(`<path${cls ? ` class="${cls}"` : ''} d="M${ar} ${a.y}H${mx}V${b.y}H${b.l}"/>`);
      });
    }
    svg.setAttribute('width', po.scrollWidth); svg.setAttribute('height', po.scrollHeight);
    svg.innerHTML = plain.join('') + hi.join('');
  }

  // ============================================================
  // Coach Discord chips + the retro Settings screen (⚙ in the VIEW switcher)
  // ------------------------------------------------------------
  // A chip next to a coach name opens their Discord, or lets you link it.
  // Settings lists everything the script saves and clears one part at a time.
  // ============================================================
  const DC_ICON = '<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" '
    + 'd="M1 0h6v1h1v4h-1v1h-2l-2 1v-1h-2v-1h-1v-4h1zM2 2h1v2h-1zM5 2h1v2h-1z"/></svg>';
  // Inner HTML of a .nx-dc-slot: "Chat" when the coach has a link, otherwise "+ DM" to add one.
  function dcInner(coach, full) {
    const l = coachLinks.get(coach), n = esc(coach);
    if (l) {
      const dm = isDmUrl(l.url);
      return `<a class="nx-dc on" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${dm ? `Open your Discord DM with ${n}` : `Opens ${n}'s Discord profile. Press ✎ to swap in a DM link.`}">${DC_ICON}<span>${dm ? 'Chat' : 'Profile'}</span></a>`
        + `<button type="button" class="nx-dc-edit" data-dc-link title="Change ${n}'s Discord link" aria-label="Change ${n}'s Discord link">✎</button>`;
    }
    return `<button type="button" class="nx-dc add" data-dc-link title="Link ${n}'s Discord DM" aria-label="Link ${n}'s Discord DM">${DC_ICON}<span>${full ? '+ Discord DM' : '+ DM'}</span></button>`;
  }
  // League Discord button in the league bar, for this page's lg + sublg.
  function lgdcInner() {
    const l = leagueLinks.get(currentLg(), curSublg()), lv = esc(curSublg());
    if (l) return `<a class="nx-dc on" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="Open the ${lv} league Discord">${DC_ICON}<span>League Discord</span></a>`
      + `<button type="button" class="nx-dc-edit" data-lgdc-link title="Change the ${lv} league Discord link" aria-label="Change the ${lv} league Discord link">✎</button>`;
    return `<button type="button" class="nx-dc add" data-lgdc-link title="Add the Discord for this league and level" aria-label="Add the ${lv} league Discord link">${DC_ICON}<span>+ League Discord</span></button>`;
  }
  const dcSlot = (coach, full) => (coach ? `<span class="nx-dc-slot" data-coach="${esc(coach)}"${full ? ' data-full="1"' : ''}>${dcInner(coach, full)}</span>` : '');

  let setReady = false;
  function setSetup() {
    if (setReady) return;
    setReady = true;
    if (!document.querySelector('link[href*="Press+Start+2P"]')) {
      const f = document.createElement('link');
      f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Press+Start+2P&display=swap';
      document.head.appendChild(f);
    }
    addCss(`
    .nx-lgbar-f.dc { margin-left: auto; }
    .nx-lgdc-slot { display: inline-flex; align-items: center; gap: 2px; }
    .nx-lgdc-slot .nx-dc { height: 36px; padding: 0 14px; }
    .nx-lgdc-slot:hover .nx-dc-edit { opacity: 1; }
    @media (max-width: 560px) { .nx-lgbar-f.dc { margin-left: 0; } }
    .nx-dc-slot { display: inline-flex; align-items: center; gap: 2px; margin-left: 8px; vertical-align: middle; }
    .nx-dc { display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 10px; font: 400 8px/1 "Press Start 2P", monospace;
      letter-spacing: .5px; text-transform: uppercase; text-decoration: none; border: 0; border-radius: 3px; cursor: pointer; white-space: nowrap; }
    .nx-dc svg { width: 14px; height: 12px; flex: none; }
    .nx-dc.on { color: #fff; background: #5865F2; box-shadow: inset -2px -2px 0 rgba(0,0,0,.3), inset 2px 2px 0 rgba(255,255,255,.25), 0 0 12px rgba(88,101,242,.55); }
    .nx-dc.on:hover { background: #6d78ff; }
    .nx-dc.add { color: var(--nx-text, #fff); background: rgba(88,101,242,.16); border: 2px solid #5865F2; box-shadow: 2px 2px 0 rgba(0,0,0,.35); }
    .nx-dc.add svg { color: #5865F2; }
    .nx-dc.add:hover, .nx-dc.add:focus-visible { color: #fff; background: #5865F2; }
    .nx-dc.add:hover svg, .nx-dc.add:focus-visible svg { color: #fff; }
    .nx-hero .nx-dc.add { color: #fff; background: #5865F2; border-color: rgba(255,255,255,.8); }
    .nx-hero .nx-dc.add svg { color: #fff; }
    .nx-hero .nx-dc.add:hover { background: #6d78ff; border-color: #fff; }
    .nx-dc-edit { width: 24px; height: 24px; padding: 0; font-size: 12px; color: var(--nx-mute, #9aa3b5); background: none; border: 0; border-radius: 3px; cursor: pointer; opacity: 0; }
    .nx-dc-slot:hover .nx-dc-edit, .nx-dc-edit:focus-visible { opacity: 1; }
    .nx-hero .nx-dc-edit { color: rgba(255,255,255,.8); }
    .nx-dc:focus-visible, .nx-dc-edit:focus-visible { outline: 2px solid var(--nx-gold, #F1BE48); outline-offset: 2px; }
    @media (hover: none) { .nx-dc-edit { opacity: 1; } }

    .nx-dci-cursor { position: fixed; left: 0; top: 0; width: 24px; height: 38px; pointer-events: none; transform-origin: 0 0; z-index: 2;
      filter: drop-shadow(2px 2px 0 rgba(0,0,0,.6)); }
    .nx-dci-cursor svg { width: 100%; height: 100%; display: block; }
    .nx-dci-fake { position: fixed; display: flex; align-items: center; pointer-events: none; }
    .nx-dci-fake .nx-dc { height: 100%; }
    .nx-dci-card { width: 380px; }
    .nx-dci-card h2 { display: flex; align-items: center; gap: 8px; }
    .nx-dci-card h2 svg { width: 16px; height: 14px; color: #8b96ff; }
    .nx-dci-card .nx-dc { height: 22px; padding: 0 7px; vertical-align: middle; cursor: default; }
    .nx-dci-card .nx-dc.add { color: #fff; }
    .nx-dci-card .tip b.gear { width: auto; height: auto; padding: 1px 4px; font: 13px/1 system-ui, sans-serif; border-radius: 3px; }
    .nx-mli-card.up::before { top: auto; bottom: -12px; border: 3px solid var(--nx-gold); border-left: 0; border-top: 0; }

    /* Settings: RetroArch's RGUI menu (checkerboard, gold frame, "> " cursor). Same look on every page, team and mode. */
    .nx-sw-gear svg { width: 16px; height: 16px; display: block; transition: transform .3s steps(4); }
    .nx-sw-gear[aria-expanded="true"] svg { transform: rotate(90deg); }
    .nx-set { position: fixed; inset: 0; z-index: 2147483200; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: 12px;
      background: rgba(0,0,0,.72); }
    .nx-rg { width: min(820px, 100%); height: min(600px, calc(100vh - 24px)); padding: 14px; outline: none; image-rendering: pixelated;
      background: repeating-conic-gradient(#c07f2c 0 25%, #6b4215 0 50%) 0 0 / 8px 8px; box-shadow: 0 24px 70px rgba(0,0,0,.7);
      font: 400 24px/1.15 "VT323", "Courier New", monospace; color: #e6e6e6; text-align: left; letter-spacing: .5px; }
    .nx-rg-in { height: 100%; display: flex; flex-direction: column; padding: 12px 22px 10px;
      background: repeating-conic-gradient(#272727 0 25%, #333 0 50%) 0 0 / 8px 8px; }
    .nx-rg-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; color: #e8a838; }
    .nx-rg-head h2 { margin: 0; font: inherit; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; color: #e8a838; white-space: nowrap; }
    .nx-rg-back { justify-self: start; font: inherit; font-size: 20px; color: #8a8a8a; background: none; border: 0; padding: 0 4px; cursor: pointer; }
    .nx-rg-back:hover, .nx-rg-back:focus-visible { color: #e8a838; outline: none; }
    .nx-rg-ver { justify-self: end; font-size: 20px; }
    .nx-rg-list { flex: 1; min-height: 0; overflow-y: auto; margin: 10px 0 8px; scrollbar-width: thin; scrollbar-color: #e8a838 transparent; }
    .nx-rg-row { position: relative; display: flex; align-items: baseline; gap: 16px; padding: 1px 6px 1px 30px; cursor: pointer; white-space: nowrap; }
    .nx-rg-row .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .nx-rg-row .v { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; color: #e6e6e6; }
    .nx-rg-row .v.dots { color: #6e6e6e; letter-spacing: 4px; }
    .nx-rg-row.sel, .nx-rg-row.sel .v { color: #e8a838; }
    .nx-rg-row.sel::before { content: '>'; position: absolute; left: 8px; }
    .nx-rg-row.off { color: #7d7d7d; cursor: default; }
    .nx-rg-row.armed .v { color: #ff7a5c; animation: nx-rg-blink .6s steps(1) infinite; }
    @keyframes nx-rg-blink { 50% { opacity: 0; } }
    .nx-rg-text { margin: 0 0 10px; padding-left: 30px; font-size: 21px; line-height: 1.1; color: #b9b9b9; white-space: normal; }
    .nx-rg-text b { font-weight: 400; color: #e6e6e6; }
    .nx-rg-field { display: flex; align-items: baseline; gap: 10px; margin: 4px 0 12px; padding-left: 30px; }
    .nx-rg-field input { flex: 1; min-width: 0; font: inherit; color: #fff; background: #1b1b1b; border: 0; border-bottom: 2px solid #e8a838;
      padding: 2px 6px; caret-color: #e8a838; }
    .nx-rg-field input:focus { outline: none; background: #111; }
    .nx-rg-field input::placeholder { color: #6e6e6e; }
    .nx-rg-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; min-height: 2.3em; color: #e8a838; }
    .nx-rg-foot .help { flex: 1; min-width: 0; white-space: normal; line-height: 1.1; }
    .nx-rg-foot .help.err { color: #ff7a5c; }
    .nx-rg-foot .clock { flex: none; }
    @media (max-width: 560px) {
      .nx-rg { padding: 10px; font-size: 21px; }
      .nx-rg-in { padding: 10px 12px 8px; }
      .nx-rg-head { grid-template-columns: auto 1fr auto; }
      .nx-rg-head h2 { font-size: 23px; text-align: center; }
      .nx-rg-row { padding-left: 24px; gap: 10px; }
      .nx-rg-row.sel::before { left: 4px; }
      .nx-rg-text, .nx-rg-field { padding-left: 24px; }
    }
    @media (prefers-reduced-motion: reduce) { .nx-rg-row.armed .v { animation: none; } .nx-sw-gear svg { transition: none; } }
    `);
    // Chips repaint whenever a link changes; one click handler serves every chip on the page.
    document.addEventListener('nx:coachlinks', () => $$('.nx-dc-slot').forEach((el) => { el.innerHTML = dcInner(el.dataset.coach, !!el.dataset.full); }));
    document.addEventListener('nx:leaguelinks', () => $$('.nx-lgdc-slot').forEach((el) => { el.innerHTML = lgdcInner(); }));
    document.addEventListener('click', (e) => {
      const lb = e.target.closest('.nx-lgdc-slot [data-lgdc-link]');
      if (lb) { e.preventDefault(); e.stopPropagation(); openSettings(lb, { id: 'lgInput', lg: currentLg(), sublg: curSublg(), only: true }); return; }
      const b = e.target.closest('.nx-dc-slot [data-dc-link]');
      if (b) { e.preventDefault(); e.stopPropagation(); openDcDialog(b.closest('.nx-dc-slot').dataset.coach, b); }
    });
  }

  // ---------- Discord DM intro: a pixel cursor clicks "+ DM" and it turns into "Chat" ----------
  const CURSOR_SVG = '<svg viewBox="0 0 12 19" shape-rendering="crispEdges" aria-hidden="true">'
    + '<path fill="#fff" stroke="#000" stroke-width="1" d="M.5.5v15l4-4 3 6.5 2.5-1.2-3-6.3h5.5z"/></svg>';
  // Due on a coach page once My Leagues' intro is out of the way: first visit (no links yet), or "Show again" in Settings.
  function dcIntroDue() {
    const f = store.get('dcIntro', null);
    return f === false || (f == null && !mlIntroDue() && !Object.keys(coachLinks.all()).length);
  }
  async function dcIntro(app) {
    const visible = (el) => el.getClientRects().length > 0;
    const target = $$('.nx-grp .nx-dc.add', app).find(visible) || $$('.nx-dc.add', app).find(visible) || $$('.nx-dc', app).find(visible);
    if (!target || $('.nx-mli:not(.fx)')) return;
    store.set('dcIntro', true);
    const coach = target.closest('.nx-dc-slot').dataset.coach;
    target.scrollIntoView({ block: 'center' });
    await wait(60);
    const ov = document.createElement('div');
    ov.className = 'nx-mli';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'nx-dci-title');
    ov.innerHTML = `<svg class="nx-mli-dim" aria-hidden="true"><defs><mask id="nx-dci-mask"><rect width="100%" height="100%" fill="#fff"/><rect rx="8" fill="#000"/></mask></defs>
      <rect width="100%" height="100%" fill="rgba(5,8,14,.8)" mask="url(#nx-dci-mask)"/></svg><div class="nx-mli-spot"></div>`;
    const spot = $('.nx-mli-spot', ov), hole = $('mask rect[rx]', ov);
    // Spotlight the chip; the card sits below it, or above when there's no room.
    const place = () => {
      const r = target.getBoundingClientRect(), box = { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 };
      Object.assign(spot.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
      hole.setAttribute('x', box.x); hole.setAttribute('y', box.y); hole.setAttribute('width', box.w); hole.setAttribute('height', box.h);
      const card = $('.nx-mli-card', ov);
      if (!card) return;
      const cx = r.left + r.width / 2, w = card.offsetWidth, h = card.offsetHeight;
      const left = Math.min(innerWidth - 12 - w, Math.max(12, cx - 60));
      const up = r.bottom + 22 + h > innerHeight - 12 && r.top - 22 - h > 12;
      card.classList.toggle('up', up);
      card.style.left = left + 'px';
      card.style.top = (up ? r.top - 22 - h : r.bottom + 22) + 'px';
      card.style.setProperty('--arrow', Math.max(10, Math.min(w - 30, left + w - cx - 12)) + 'px');
    };
    place();
    app.appendChild(ov);
    const htmlEl = document.documentElement, prevOverflow = htmlEl.style.overflow;
    htmlEl.style.overflow = 'hidden';
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      ov.remove();
      htmlEl.style.overflow = prevOverflow;
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey, true);
      if (target.isConnected) target.focus();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = $$('.nx-mli-card button', ov);
        e.preventDefault();
        if (f.length) f[(f.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', (e) => { if (!e.target.closest('.nx-mli-card')) close(); });

    if (!reducedMotion()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      await wait(400);
      if (done) return;
      // The cursor glides in and clicks the chip...
      const cur = document.createElement('div');
      cur.className = 'nx-dci-cursor';
      cur.innerHTML = CURSOR_SVG;
      ov.appendChild(cur);
      const c = centerOf(target), from = { x: Math.min(innerWidth - 30, c.x + 260), y: Math.min(innerHeight + 30, c.y + 220) };
      cur.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${c.x}px, ${c.y}px)` }],
        { duration: 850, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      await wait(850);
      if (done) return;
      cur.animate([{ transform: `translate(${c.x}px, ${c.y}px) scale(1)` }, { transform: `translate(${c.x}px, ${c.y}px) scale(.8)` },
        { transform: `translate(${c.x}px, ${c.y}px) scale(1)` }], { duration: 220, fill: 'forwards' });
      await wait(220);
      if (done) return;
      // ...and it becomes a "Chat" button.
      const r = target.getBoundingClientRect(), fake = document.createElement('div');
      fake.className = 'nx-dci-fake';
      fake.innerHTML = `<span class="nx-dc on">${DC_ICON}<span>Chat</span></span>`;
      Object.assign(fake.style, { left: r.left + 'px', top: r.top + 'px', height: r.height + 'px' });
      ov.insertBefore(fake, cur);
      fake.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 300, easing: 'steps(4)' });
      mlSmash(ov, target, 'DM READY!');
      await wait(1300);
      if (done) return;
      [fake, cur].forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }));
      await wait(250);
      fake.remove(); cur.remove();
      if (done) return;
    }
    spot.classList.add('on');
    const card = document.createElement('div');
    card.className = 'nx-mli-card nx-dci-card';
    card.innerHTML = `<h2 id="nx-dci-title">${DC_ICON} NEW! DM ANY COACH</h2>
      <p>Link a coach once. After that, one click opens your Discord DM with them.</p>
      <ol><li><span>Press <span class="nx-dc add">${DC_ICON}<span>+ DM</span></span> next to a coach.</span></li>
        <li><span>In Discord, open your DM with them, right-click any message and pick <b>Copy Message Link</b>.</span></li>
        <li><span>Paste it. The button turns into <span class="nx-dc on">${DC_ICON}<span>Chat</span></span></span></li></ol>
      <div class="tip">Change or remove links any time in <b class="gear">⚙</b> Settings, bottom right.</div>
      <div class="nx-mli-row"><button type="button" data-act="ok">Got it</button><button type="button" class="go" data-act="link">Link ${esc(coach)}</button></div>`;
    ov.appendChild(card);
    place();
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      close();
      if (b.dataset.act === 'link') openDcDialog(coach, target);
    });
    $('.go', card).focus();
  }

  // ---------- Settings: a RetroArch-style (RGUI) menu ----------
  // Menus are pages of rows. ↑/↓ or the mouse picks a row, Enter / → / click opens it, ← / Esc / Backspace goes back.
  // Rows that delete something ask for a second press ("Press again").
  const GEAR_SVG = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="'
    + 'M7 0h2v3h-2zM7 13h2v3h-2zM0 7h3v2h-3zM13 7h3v2h-3zM2 2h2v2h-2zM12 2h2v2h-2zM2 12h2v2h-2zM12 12h2v2h-2z'
    + 'M4 3h8v1h1v8h-1v1h-8v-1h-1v-8h1zM6 6h4v4h-4z"/></svg>';
  const OLD_KEYS = { 'nx:classic': 'Old Classic view switch', 'nx:myteam': 'Old "my team" pin' };
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

  // Link (or change / remove) one coach's Discord DM: opens the menu straight on that page.
  function openDcDialog(coach, opener) { openSettings(opener, { id: 'dcInput', coach, only: true }); }

  function openSettings(opener, start) {
    setSetup();
    if (!document.querySelector('link[href*="VT323"]')) {
      const f = document.createElement('link');
      f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
      document.head.appendChild(f);
    }
    const el = document.createElement('div');
    el.className = 'nx-set';
    el.innerHTML = '<div class="nx-rg" role="dialog" aria-modal="true" aria-labelledby="nx-rg-title" tabindex="-1"><div class="nx-rg-in"></div></div>';
    document.body.appendChild(el);
    const box = $('.nx-rg', el), inner = $('.nx-rg-in', el), fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = '.json,application/json';
    if (opener && opener.matches('.nx-sw-gear')) opener.setAttribute('aria-expanded', 'true');

    const stack = [start ? { ...start, sel: 0 } : { id: 'root', sel: 0 }];
    let armedAt = '', armTimer = 0, flash = { text: '', err: false }, flashTimer = 0, items = [];
    const top = () => stack[stack.length - 1];
    const say = (text, err) => { flash = { text, err: !!err }; clearTimeout(flashTimer); flashTimer = setTimeout(() => { flash = { text: '' }; paint(); }, 3500); paint(); };
    const go = (id, args = {}) => { stack.push({ id, sel: 0, ...args }); armedAt = ''; flash = { text: '' }; paint(); };
    const back = () => { if (stack.length > 1 && !top().only) { stack.pop(); armedAt = ''; flash = { text: '' }; paint(); } else close(); };

    const ls = () => { const o = {}; try { Object.keys(localStorage).forEach((k) => { if (k.startsWith('nx:') && !k.startsWith('nx:gm:')) o[k] = localStorage.getItem(k); }); } catch (e) {} return o; };
    const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
    const teamFor = (id) => {
      const l = myLeagues.all().find((x) => x.teamId === id);
      if (l) return mlTitle(l) + (l.sublg ? ' · ' + l.sublg : '');
      if (PAGE === 'coach' && id === pageKey && myTeam) return fullTeamName(myTeam);
      return 'Team #' + id;
    };
    const filters = () => {
      const f = {}, p = ls();
      Object.keys(p).forEach((k) => {
        const m = k.match(/^nx:(opp|mode|collapsed):(.*)$/);
        if (m) (f[m[2]] = f[m[2]] || {})[m[1]] = (() => { try { return JSON.parse(p[k]); } catch (e) { return null; } })();
      });
      return f;
    };
    const otherKeys = () => Object.keys(ls()).filter((k) => !/^nx:(theme|view|lastView|mlIntro|dcIntro)$/.test(k) && !/^nx:(opp|mode|collapsed):/.test(k));
    const replayIntro = (ml) => {
      store.set(ml ? 'mlIntro' : 'dcIntro', false); // false = replay on the next V1 page, even if already set up
      const app = $('.nx-root.nx-active');
      const ready = app && (ml ? $$('.nx-ml-btn', app) : $$('.nx-dc', app)).some((x) => x.getClientRects().length);
      if (ready) { close(); if (ml) mlIntro(app); else dcIntro(app); }
      else say(ml ? 'It plays next time you open a V1 page.' : 'It plays next time you open a coach page in V1.');
    };
    const BACK = { label: 'Back', help: 'Go back.', act: back };
    const flipMode = () => { setMode(getMode() === 'day' ? 'night' : 'day'); paint(); };

    // Each page: { title, text?, field?, items: [{ label, val, sub, help, act, confirm, cycle, off }] }
    function page(p) {
      const leagues = myLeagues.all(), links = Object.values(coachLinks.all()).sort((a, b) => a.coach.localeCompare(b.coach));
      const lgLinks = Object.values(leagueLinks.all()).sort((a, b) => b.lg - a.lg || a.sublg.localeCompare(b.sublg));
      switch (p.id) {
        case 'root': {
          const nf = Object.keys(filters()).length, other = otherKeys().length;
          return { title: 'Settings', items: [
            { label: 'My Leagues', val: leagues.length ? `${leagues.length} saved` : '', sub: true, help: 'Your coach pages, one per league. Saved as myLeagues (Tampermonkey).', act: () => go('leagues') },
            { label: 'Discord DMs', val: links.length ? `${links.length} linked` : '', sub: true, help: 'Coaches you can DM in one click. Saved as coachLinks (Tampermonkey).', act: () => go('dms') },
            { label: 'League Discords', val: lgLinks.length ? `${lgLinks.length} linked` : '', sub: true, help: 'One Discord server per league and level. Saved as leagueLinks (Tampermonkey).', act: () => go('lgdcs') },
            { label: 'Colour Mode', val: cap(getMode()), help: 'Enter or ← → switches Day / Night on every page. Saved as nx:theme.', act: flipMode, cycle: flipMode },
            { label: 'Tips & Intros', sub: true, help: 'Replay the My Leagues and Discord DM walkthroughs.', act: () => go('intros') },
            { label: 'Schedule Filters', val: nf ? `${nf} page${nf === 1 ? '' : 's'}` : '', sub: true, help: 'Coach picks, tabs and folded opponents, remembered per coach page.', act: () => go('filters') },
            ...(other ? [{ label: 'Other Saved Bits', val: String(other), sub: true, help: 'Leftovers from older versions.', act: () => go('other') }] : []),
            { label: 'Backup & Restore', sub: true, help: 'Save everything to one file, or load it on another browser.', act: () => go('backup') },
            { label: 'Reset Everything', confirm: true, help: 'Clears My Leagues, Discord links and every setting, then reloads.', act: () => { resetAll(); location.reload(); } },
            { label: 'Close', help: 'Back to the page. (Esc)', act: close },
          ] };
        }
        case 'leagues': return { title: 'My Leagues', items: [
          ...(leagues.length ? leagues.map((x) => ({ label: mlTitle(x), val: x.sublg, help: `${mlSub(x)} · Enter opens it.`, act: () => { location.href = x.path; } }))
            : [{ label: 'No leagues saved yet', off: true, help: 'Press ★ Add to My Leagues on one of your coach pages.' }]),
          ...(leagues.length ? [{ label: 'Clear My Leagues', confirm: true, help: `Removes all ${leagues.length} saved league(s).`, act: () => { myLeagues.save([]); say('My Leagues cleared.'); } }] : []),
          BACK,
        ] };
        case 'dms': return { title: 'Discord DMs', items: [
          { label: 'Link a Coach', sub: true, help: 'Pick a coach, then paste a message link from your DM with them.', act: () => go('dcPick') },
          ...links.map((l) => ({ label: l.coach, val: isDmUrl(l.url) ? 'Chat' : 'Profile', sub: true,
            help: isDmUrl(l.url) ? 'Opens your DM. Enter for options.' : 'Profile link only: change it to a DM link.', act: () => go('dcCoach', { coach: l.coach }) })),
          ...(links.length ? [{ label: 'Clear All Links', confirm: true, help: `Removes all ${links.length} Discord link(s).`, act: () => { coachLinks.save({}); say('Discord links cleared.'); } }] : []),
          BACK,
        ] };
        case 'lgdcs': {
          const here = PAGE === 'coach' && lgLinkKey(currentLg(), curSublg());
          return { title: 'League Discords', items: [
            ...(here ? [{ label: `This League · ${curSublg()}`, val: leagueLinks.get(currentLg(), curSublg()) ? 'Linked' : '', sub: true, help: 'Link the Discord for the league and level on this page.',
              act: () => go('lgInput', { lg: currentLg(), sublg: curSublg() }) }] : []),
            ...lgLinks.map((l) => ({ label: (l.league || 'League ' + l.lg) + ' · ' + l.sublg, val: 'Linked', sub: true, help: l.url.replace('https://', ''),
              act: () => go('lgInput', { lg: l.lg, sublg: l.sublg }) })),
            ...(!here && !lgLinks.length ? [{ label: 'None linked yet', off: true, help: 'Press + League Discord next to the level picker on a coach page.' }] : []),
            ...(lgLinks.length ? [{ label: 'Clear All', confirm: true, help: `Removes all ${lgLinks.length} league Discord link(s).`, act: () => { leagueLinks.save({}); say('League Discord links cleared.'); } }] : []),
            BACK,
          ] };
        }
        case 'lgInput': {
          const cur = leagueLinks.get(p.lg, p.sublg);
          const name = cur && cur.league ? cur.league : (p.lg === currentLg() && (leagueOpts.find((o) => o.sel) || {}).t) || 'League ' + p.lg;
          return { title: 'League Discord', field: { ph: 'Paste an invite or channel link…', label: `Discord link for ${name} ${p.sublg}`, value: cur ? cur.url : '' },
            text: [`League: <b>${esc(name)}</b> · Level: <b>${esc(p.sublg)}</b>`,
              '1. In Discord, right-click the league server and pick <b>Invite People</b>, then copy the invite link.',
              '   Or right-click the league channel and pick <b>Copy Link</b>.', '2. Paste it here and press Enter.'],
            items: [
              { label: 'Save', help: 'The button turns blue. One click opens the league Discord.', act: () => submit() },
              ...(cur ? [{ label: 'Open Discord', help: cur.url.replace('https://', ''), act: () => window.open(cur.url, '_blank', 'noopener') },
                { label: 'Remove Link', confirm: true, help: `Forget the ${p.sublg} league Discord.`, act: () => { leagueLinks.remove(p.lg, p.sublg); back(); } }] : []),
              { label: p.only ? 'Cancel' : 'Back', help: 'Leave without saving.', act: back },
            ] };
        }
        case 'dcPick': {
          const coaches = [...new Set(Object.values(teamInfo).map((t) => t.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b));
          return { title: 'Link a Coach', items: [
            ...coaches.map((c) => ({ label: c, val: coachLinks.get(c) ? 'Linked' : '', sub: true, help: `Link ${c}'s Discord DM.`, act: () => go('dcInput', { coach: c }) })),
            { label: 'Type a Name', sub: true, help: 'For a coach who is not in this league.', act: () => go('dcName') },
            BACK,
          ] };
        }
        case 'dcName': return { title: 'Coach Name', field: { ph: 'Coach name', label: 'Coach name' },
          text: ['Type the coach name exactly as the site shows it.'],
          items: [{ label: 'Next', help: 'Then paste their Discord link.', act: () => submit() }, BACK] };
        case 'dcCoach': {
          const l = coachLinks.get(p.coach);
          if (!l) return { title: p.coach, items: [{ label: 'Not linked', off: true }, BACK] };
          return { title: p.coach, items: [
            { label: isDmUrl(l.url) ? 'Open DM' : 'Open Profile', help: l.url.replace('https://', ''), act: () => window.open(l.url, '_blank', 'noopener') },
            { label: 'Change Link', sub: true, help: 'Paste a new message link from your DM.', act: () => go('dcInput', { coach: p.coach }) },
            { label: 'Remove Link', confirm: true, help: `Forget ${p.coach}'s Discord link.`, act: () => { coachLinks.remove(p.coach); back(); say('Link removed.'); } },
            BACK,
          ] };
        }
        case 'dcInput': {
          const cur = coachLinks.get(p.coach);
          return { title: 'Link Discord', field: { ph: 'Paste a message link from your DM…', label: `Discord DM link for ${p.coach}`, value: cur ? cur.url : '' },
            text: [`Coach: <b>${esc(p.coach)}</b>`, '1. In Discord, open your DM with them (message them once if you never have).',
              '2. Right-click any message and pick <b>Copy Message Link</b>.', '3. Paste it here and press Enter.'],
            items: [
              { label: 'Save', help: 'The button turns into CHAT. One click opens your DM.', act: () => submit() },
              ...(cur ? [{ label: 'Remove Link', confirm: true, help: `Forget ${p.coach}'s Discord link.`, act: () => { coachLinks.remove(p.coach); back(); } }] : []),
              { label: p.only ? 'Cancel' : 'Back', help: 'Leave without saving.', act: back },
            ] };
        }
        case 'intros': {
          const ml = store.get('mlIntro', null), dc = store.get('dcIntro', null);
          return { title: 'Tips & Intros', items: [
            { label: 'My Leagues Intro', val: ml ? 'Seen' : 'Next visit', help: 'The puck that shows how to add a team to My Leagues. Enter plays it. Saved as nx:mlIntro.', act: () => replayIntro(true) },
            { label: 'Discord DM Intro', val: dc ? 'Seen' : 'Next visit', help: 'The cursor that shows how to link a coach\'s DM. Enter plays it. Saved as nx:dcIntro.', act: () => replayIntro(false) },
            BACK,
          ] };
        }
        case 'filters': {
          const f = Object.entries(filters());
          return { title: 'Schedule Filters', items: [
            ...(f.length ? f.map(([id, x]) => {
              const bits = [];
              if (Array.isArray(x.opp) && x.opp.length) bits.push(`${x.opp.length} coach${x.opp.length === 1 ? '' : 'es'}`);
              if (x.mode && x.mode !== 'all') bits.push(x.mode === 'todo' ? 'To play' : 'Played');
              if (Array.isArray(x.collapsed) && x.collapsed.length) bits.push(`${x.collapsed.length} folded`);
              return { label: teamFor(id), val: bits.join(', ') || 'Defaults', confirm: true, help: `Enter clears this page's filters. Saved as nx:opp/mode/collapsed:${id}.`,
                act: () => { ['opp', 'mode', 'collapsed'].forEach((k) => lsDel(`nx:${k}:${id}`)); say('Cleared. Reload the page to see it.'); } };
            }) : [{ label: 'No saved filters', off: true, help: 'Coach picks, tabs and folded opponents are remembered per coach page.' }]),
            ...(f.length > 1 ? [{ label: 'Clear All Filters', confirm: true, help: 'Clears the filters on every coach page.', act: () => { Object.keys(ls()).filter((k) => /^nx:(opp|mode|collapsed):/.test(k)).forEach(lsDel); say('All filters cleared. Reload to see it.'); } }] : []),
            BACK,
          ] };
        }
        case 'other': return { title: 'Other Saved Bits', items: [
          ...otherKeys().map((k) => ({ label: OLD_KEYS[k] || k.slice(3), val: String(ls()[k]).slice(0, 30), confirm: true, help: `Enter clears it. Saved as ${k}.`, act: () => { lsDel(k); say('Cleared.'); } })),
          BACK,
        ] };
        case 'backup': return { title: 'Backup & Restore', items: [
          { label: 'Download Backup', help: 'Leagues, Discord links and settings in one file.', act: () => { downloadBackup(); say('Backup downloaded. Keep it somewhere safe.'); } },
          { label: 'Restore from File', sub: true, help: 'Load a backup file. You get to check it first.', act: () => fileIn.click() },
          BACK,
        ] };
        case 'restore': {
          const b = p.pending;
          return { title: 'Restore Backup', text: [`From <b>${esc(b.exportedAt ? new Date(b.exportedAt).toLocaleString() : 'an unknown date')}</b>:`,
            `${b.leagues.length} league(s), ${b.coachLinks ? Object.keys(b.coachLinks).length : 'no'} Discord link(s), ${b.leagueLinks ? Object.keys(b.leagueLinks).length : 'no'} league Discord(s), ${Object.keys(b.prefs).length} setting(s).`],
          items: [
            { label: 'Restore', confirm: true, help: 'Replaces what is saved now, then reloads.', act: () => { applyBackup(b); location.reload(); } },
            { label: 'Cancel', help: 'Keep what you have.', act: back },
          ] };
        }
        default: return { title: '', items: [BACK] };
      }
    }

    function submit() {
      const p = top(), input = $('.nx-rg-field input', inner), v = input ? input.value : '';
      if (p.id === 'dcName') {
        if (!norm(v)) return say('Type the coach name first.', true);
        stack.pop(); return go('dcInput', { coach: norm(v) });
      }
      if (p.id === 'lgInput') {
        const name = p.lg === currentLg() ? (leagueOpts.find((o) => o.sel) || {}).t || '' : (leagueLinks.get(p.lg, p.sublg) || {}).league || '';
        const e2 = leagueLinks.set(p.lg, p.sublg, name, v);
        if (e2) return say(e2, true);
        if (p.only) return close();
        back(); return say('League Discord linked!');
      }
      const err = coachLinks.set(p.coach, v);
      if (err) return say(err, true);
      if (p.only) return close();
      back(); say(`Linked ${p.coach}!`);
    }

    function activate(i) {
      const it = items[i];
      if (!it || it.off || !it.act) return;
      const key = top().id + ':' + i;
      if (it.confirm && armedAt !== key) {
        armedAt = key; clearTimeout(armTimer);
        armTimer = setTimeout(() => { armedAt = ''; paint(); }, 3000);
        return paint();
      }
      armedAt = '';
      it.act();
    }
    function move(d) {
      const p = top(), n = items.length;
      for (let k = 1; k <= n; k++) { const j = (p.sel + d * k + n * 2) % n; if (!items[j].off) { p.sel = j; break; } }
      armedAt = ''; paint();
    }

    function paint() {
      if (!el.isConnected) return;
      const p = top(), pg = page(p);
      items = pg.items;
      if (p.sel >= items.length) p.sel = items.length - 1;
      if (items[p.sel] && items[p.sel].off) p.sel = Math.max(0, items.findIndex((x) => !x.off));
      const old = $('.nx-rg-field input', inner), keepVal = old && old.dataset.page === stack.length + p.id ? old.value : null;
      const help = flash.text ? flash.text : (items[p.sel] || {}).help || '';
      const t = new Date(), clock = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
      inner.innerHTML = `<div class="nx-rg-head"><button type="button" class="nx-rg-back" data-rg="back">${stack.length > 1 && !p.only ? '‹ Back' : '✕ Close'}</button>
          <h2 id="nx-rg-title">${esc(pg.title)}</h2><span class="nx-rg-ver">v${esc(SCRIPT_VERSION)}${CHANNEL === 'stable' ? '' : ' ' + CHANNEL.toUpperCase()}</span></div>
        <div class="nx-rg-list" role="menu" aria-label="${esc(pg.title)}">
          ${(pg.text || []).map((x) => `<p class="nx-rg-text">${x}</p>`).join('')}
          ${pg.field ? `<label class="nx-rg-field"><input type="text" autocomplete="off" spellcheck="false" data-page="${stack.length + p.id}"
            aria-label="${esc(pg.field.label)}" placeholder="${esc(pg.field.ph)}" value="${esc(keepVal != null ? keepVal : pg.field.value || '')}"></label>` : ''}
          ${items.map((it, i) => `<div class="nx-rg-row${i === p.sel ? ' sel' : ''}${it.off ? ' off' : ''}${armedAt === p.id + ':' + i ? ' armed' : ''}" role="menuitem" data-i="${i}"${it.off ? ' aria-disabled="true"' : ''}>
            <span class="l">${esc(it.label)}</span>${armedAt === p.id + ':' + i ? '<span class="v">Press again</span>'
              : it.val ? `<span class="v">${esc(it.val)}</span>` : it.sub ? '<span class="v dots">...</span>' : ''}</div>`).join('')}
        </div>
        <div class="nx-rg-foot"><span class="help${flash.err ? ' err' : ''}" role="status" aria-live="polite">${esc(help)}</span><span class="clock">${clock}</span></div>`;
      const row = $('.nx-rg-row.sel', inner);
      if (row) row.scrollIntoView({ block: 'nearest' });
      const input = $('.nx-rg-field input', inner);
      if (input && document.activeElement !== input) {
        input.focus();
        if (keepVal == null) input.select(); else input.setSelectionRange(input.value.length, input.value.length);
      }
      else if (!input && !box.contains(document.activeElement)) box.focus();
    }

    inner.addEventListener('mousemove', (e) => {
      const r = e.target.closest('.nx-rg-row');
      if (!r || r.classList.contains('off') || +r.dataset.i === top().sel) return;
      top().sel = +r.dataset.i;
      if (!armedAt) { $$('.nx-rg-row', inner).forEach((x) => x.classList.toggle('sel', x === r)); const h = $('.nx-rg-foot .help', inner); if (h && !flash.text) h.textContent = items[top().sel].help || ''; }
      else { armedAt = ''; paint(); }
    });
    inner.addEventListener('click', (e) => {
      if (e.target.closest('[data-rg="back"]')) return back();
      const r = e.target.closest('.nx-rg-row');
      if (r) { top().sel = +r.dataset.i; activate(+r.dataset.i); }
    });
    el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
    const onKey = (e) => {
      if ($$('.nx-set').pop() !== el) return;
      const inInput = e.target.matches && e.target.matches('.nx-rg-field input');
      const it = items[top().sel] || {};
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return back(); }
      if (inInput) { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'ArrowDown') { e.preventDefault(); box.focus(); } return; }
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); move(k === 'ArrowDown' ? 1 : -1); }
      else if (k === 'Home' || k === 'End') {
        e.preventDefault();
        const on = items.map((x, i) => (x.off ? -1 : i)).filter((i) => i >= 0);
        top().sel = k === 'Home' ? on[0] : on[on.length - 1]; armedAt = ''; paint();
      }
      else if (k === 'ArrowRight' && it.cycle) { e.preventDefault(); it.cycle(1); }
      else if (k === 'ArrowLeft' && it.cycle) { e.preventDefault(); it.cycle(-1); }
      else if (k === 'Enter' || k === ' ' || k === 'ArrowRight') { e.preventDefault(); activate(top().sel); }
      else if (k === 'ArrowLeft' || k === 'Backspace') { e.preventDefault(); back(); }
      else if (k === 'Tab') { e.preventDefault(); const f = $$('.nx-rg-field input, .nx-rg-back', inner); const i = f.indexOf(document.activeElement); (f[(i + 1) % f.length] || box).focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (!f) return;
      try { go('restore', { pending: readBackup(await f.text()) }); } catch (err) { say(err.message, true); }
    });
    const repaint = () => paint(), clockTimer = setInterval(repaint, 30000);
    ['nx:myleagues', 'nx:coachlinks'].forEach((ev) => document.addEventListener(ev, repaint));
    function close() {
      if (!el.isConnected) return;
      el.remove();
      clearInterval(clockTimer); clearTimeout(armTimer); clearTimeout(flashTimer);
      document.removeEventListener('keydown', onKey, true);
      ['nx:myleagues', 'nx:coachlinks'].forEach((ev) => document.removeEventListener(ev, repaint));
      if (opener && opener.isConnected) { opener.removeAttribute('aria-expanded'); opener.focus(); }
    }
    paint();
    if (!$('.nx-rg-field input', inner)) box.focus();
    // The menu grows out of the button that opened it, in chunky steps.
    if (opener && !reducedMotion()) {
      const o = opener.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (o.width) {
        box.style.transformOrigin = `${o.left + o.width / 2 - b.left}px ${o.top + o.height / 2 - b.top}px`;
        box.animate([{ transform: 'scale(.03)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 280, easing: 'steps(7, end)' });
      }
    }
  }

  // ============================================================
  // Version registry + View switcher
  // ------------------------------------------------------------
  // Each version maps page -> renderer. A renderer returns its root element
  // (class "nx-root"). To redesign another page, add it to PAGE detection at the
  // top and give it a renderer here. The newest version is the default view.
  // ============================================================
  const ALL_VERSIONS = [
    { id: 'classic', label: 'Classic', title: 'Original nhl94online.com page' },
    { id: 'v1', label: 'V1', title: 'V1 · Rink Night', pages: {
      coach: renderCoachV1, home: renderHomeV1, standings: renderStandingsV1, roster: renderRosterV1, boxscore: renderBoxScoreV1, playoffs: renderPlayoffsV1,
      records: () => renderListV1('records'), players: () => renderListV1('players'), allstats: () => renderListV1('allstats'), siterecords: () => renderListV1('siterecords'),
    } },
  ];
  // Only offer versions that have a design for this page.
  const VERSIONS = ALL_VERSIONS.filter((v) => !v.pages || v.pages[PAGE]).map((v) => ({ ...v, render: v.pages && v.pages[PAGE] }));
  const DEFAULT_VIEW = VERSIONS[VERSIONS.length - 1].id;

  addCss(`
  body[data-nx-view]:not([data-nx-view="classic"]) { margin: 0 !important; background: #0a0c11 !important; }
  body[data-nx-view]:not([data-nx-view="classic"]) > *:not(.nx-root):not(.nx-switch):not(.nx-set) { display: none !important; }
  .nx-root:not(.nx-active) { display: none !important; }
  .nx-switch { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; display: flex; align-items: center; gap: 4px; padding: 4px;
    font: 600 12px Inter, "Segoe UI", system-ui, sans-serif; background: rgba(17,20,27,.94); border: 1px solid #323a4a; border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,.45); backdrop-filter: blur(8px); }
  .nx-switch button { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; font: inherit; color: #9aa3b5; background: none; border: 0;
    border-radius: 7px; padding: 4px 10px; cursor: pointer; }
  .nx-switch button:hover { color: #fff; background: rgba(255,255,255,.06); }
  .nx-switch button:focus-visible { outline: 2px solid #F1BE48; outline-offset: 1px; }
  /* On/off switch: the redesign (on) or the original site (off). */
  .nx-sw-tog .lab { font: 400 8px "Press Start 2P", monospace; letter-spacing: .5px; }
  .nx-sw-tog .track { position: relative; width: 36px; height: 20px; border-radius: 10px; background: #3a4252; transition: background .15s; }
  .nx-sw-tog .track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #c9d0dc;
    transition: transform .15s; }
  .nx-sw-tog[aria-checked="true"] { color: #fff; }
  .nx-sw-tog[aria-checked="true"] .track { background: #F1BE48; }
  .nx-sw-tog[aria-checked="true"] .track::after { transform: translateX(16px); background: #111; }
  .nx-sw-gear { padding: 4px 9px !important; border-left: 1px solid #323a4a !important; border-radius: 0 7px 7px 0 !important; }
  @media (prefers-reduced-motion: reduce) { .nx-sw-tog .track, .nx-sw-tog .track::after { transition: none; } }
  `);

  const rendered = {};
  const sw = document.createElement('div');
  sw.className = 'nx-switch';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Page view');
  // The switch turns the newest design (or the last one picked) on, or goes back to the original site.
  const onView = () => { const v = store.get('lastView', DEFAULT_VIEW); return VERSIONS.some((x) => x.id === v && v !== 'classic') ? v : DEFAULT_VIEW; };
  const onLabel = () => 'v' + SCRIPT_VERSION.split('.')[0]; // the script's major version (v2), not the design's name
  sw.innerHTML = `<button type="button" class="nx-sw-tog" role="switch" aria-checked="false" title="Turn the new look on or off (Alt+Shift+V)">
      <span class="lab">${esc(onLabel())}</span><span class="track" aria-hidden="true"></span></button>`
    + `<button type="button" class="nx-sw-gear" data-settings title="Settings" aria-label="Settings" aria-haspopup="dialog">${GEAR_SVG}</button>`;
  document.body.appendChild(sw);
  setSetup();
  const tog = $('.nx-sw-tog', sw);
  tog.setAttribute('aria-label', 'New look (' + onLabel() + ')');
  tog.addEventListener('click', () => setView(document.body.getAttribute('data-nx-view') === 'classic' ? onView() : 'classic'));
  $('[data-settings]', sw).addEventListener('click', (e) => openSettings(e.currentTarget));

  function setView(id) {
    if (!VERSIONS.some((v) => v.id === id)) id = DEFAULT_VIEW;
    const v = VERSIONS.find((x) => x.id === id);
    if (v.render && !rendered[id]) {
      try { rendered[id] = v.render(); } catch (e) { console.error('[nhl94-its-in-the-script]', e); id = 'classic'; }
    }
    Object.entries(rendered).forEach(([k, el]) => el && el.classList.toggle('nx-active', k === id));
    document.body.setAttribute('data-nx-view', id);
    let vp = document.querySelector('meta[name="viewport"][data-nx]');
    if (id !== 'classic' && !vp && !document.querySelector('meta[name="viewport"]')) {
      vp = document.createElement('meta'); vp.name = 'viewport'; vp.content = 'width=device-width, initial-scale=1'; vp.dataset.nx = '1';
      document.head.appendChild(vp);
    } else if (id === 'classic' && vp) vp.remove();
    tog.setAttribute('aria-checked', String(id !== 'classic'));
    store.set('view', id);
    if (id !== 'classic') store.set('lastView', id);
  }
  document.addEventListener('keydown', (e) => {
    if (!(e.altKey && e.shiftKey && e.code === 'KeyV')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    e.preventDefault();
    tog.click();
  });

  // Users of the pre-switcher build who chose "Classic view" stay on classic.
  setView(store.get('view', store.get('classic', false) ? 'classic' : DEFAULT_VIEW));
})();
