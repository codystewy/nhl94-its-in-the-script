// ==UserScript==
// @name         NHL94 – It's In The Script
// @namespace    https://github.com/codystewy/nhl94-its-in-the-script
// @version      1.0.0
// @description  Redesigns nhl94online.com coach pages: coach names on the schedule, grouped by opponent, saved filters, and a switchable NHL 26 x 16-bit look.
// @author       codystewy
// @homepageURL  https://github.com/codystewy/nhl94-its-in-the-script
// @supportURL   https://github.com/codystewy/nhl94-its-in-the-script/issues
// @updateURL    https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js
// @downloadURL  https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js
// @match        https://nhl94online.com/html/coachpage.php*
// @match        http://nhl94online.com/html/coachpage.php*
// @match        https://www.nhl94online.com/html/coachpage.php*
// @match        http://www.nhl94online.com/html/coachpage.php*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (document.querySelector('.nx-root, .nx-switch')) return;

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

  // Division standings
  let standings = null;
  const stTable = leafTables().find((t) => /^\S+\s+W L T DNP Pts/.test(firstRowText(t)));
  if (stTable) {
    standings = { division: norm(stTable.rows[0].cells[0].textContent), rows: [] };
    [...stTable.rows].slice(1).forEach((r) => {
      const c = [...r.cells].map((x) => norm(x.textContent));
      if (c.length >= 6) standings.rows.push({ team: c[0], w: c[1], l: c[2], t: c[3], dnp: c[4], pts: c[5] });
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
  // VERSION 1 — "Rink Night": dark NHL 26 broadcast look with 16-bit touches
  // ============================================================
  function renderV1() {
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Press+Start+2P&display=swap';
    document.head.appendChild(fonts);

    const css = `
    :root {
      --nx-red: #C8102E; --nx-red-d: #8E0C21; --nx-gold: #F1BE48; --nx-gold-d: #b8892a;
      --nx-bg: #0a0c11; --nx-bg2: #11141b; --nx-card: #151922; --nx-card2: #1b202b; --nx-line: #262c39; --nx-line2: #323a4a;
      --nx-text: #eef1f6; --nx-mute: #9aa3b5; --nx-dim: #6b7487;
      --nx-win: #2ecc71; --nx-loss: #ff4d5e; --nx-tie: #f1be48;
      --nx-px: "Press Start 2P", monospace; --nx-cond: Oswald, "Arial Narrow", sans-serif; --nx-ui: Inter, "Segoe UI", system-ui, sans-serif;
    }

    #nx-app, #nx-app * { box-sizing: border-box; }
    #nx-app { font-family: var(--nx-ui); font-size: 14px; color: var(--nx-text); min-height: 100vh; line-height: 1.4; text-align: left;
      background:
        radial-gradient(1200px 500px at 15% -10%, rgba(200,16,46,.22), transparent 60%),
        radial-gradient(900px 400px at 100% 0%, rgba(241,190,72,.08), transparent 60%),
        linear-gradient(180deg, #0d1017 0%, var(--nx-bg) 400px); }
    #nx-app a { color: inherit; text-decoration: none; }
    #nx-app img { border: 0; }
    #nx-app select { font: inherit; font-size: 13px; color: var(--nx-text); background-color: var(--nx-card2); border: 1px solid var(--nx-line2);
      border-radius: 6px; padding: 6px 28px 6px 10px; cursor: pointer; appearance: none; -webkit-appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, var(--nx-gold) 50%), linear-gradient(135deg, var(--nx-gold) 50%, transparent 50%);
      background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
    #nx-app select:focus-visible, #nx-app button:focus-visible, #nx-app a:focus-visible { outline: 2px solid var(--nx-gold); outline-offset: 2px; }

    /* ---------- Ticker ---------- */
    .nx-ticker { display: flex; align-items: center; height: 30px; background: #000; border-bottom: 1px solid var(--nx-line); overflow: hidden; font-size: 12px; }
    .nx-ticker-tag { flex: none; height: 100%; display: flex; align-items: center; padding: 0 18px 0 12px; background: var(--nx-gold); color: #111;
      font-family: var(--nx-px); font-size: 8px; letter-spacing: .5px; clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%); position: relative; z-index: 1; }
    .nx-ticker-track { display: flex; gap: 28px; white-space: nowrap; padding-left: 20px; animation: nx-scroll 45s linear infinite; }
    .nx-ticker:hover .nx-ticker-track { animation-play-state: paused; }
    .nx-ticker-item { display: inline-flex; align-items: center; gap: 6px; color: var(--nx-mute); }
    .nx-ticker-item b { color: var(--nx-text); font-weight: 600; }
    .nx-ticker-item img { width: 18px; height: 18px; image-rendering: pixelated; }
    .nx-ticker-item a:hover b { color: var(--nx-gold); }
    @keyframes nx-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    @media (prefers-reduced-motion: reduce) { .nx-ticker-track { animation: none; } }

    /* ---------- Top bar ---------- */
    .nx-top { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 22px; padding: 0 24px; height: 58px;
      background: rgba(10,12,17,.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--nx-line); }
    .nx-brand { display: flex; align-items: baseline; gap: 8px; flex: none; }
    .nx-brand-a { font-family: var(--nx-px); font-size: 15px; color: #fff; text-shadow: 3px 3px 0 var(--nx-red); letter-spacing: 1px; }
    .nx-brand-b { font-family: var(--nx-px); font-size: 9px; color: var(--nx-gold); }
    .nx-nav { display: flex; align-items: stretch; height: 100%; flex: 1; min-width: 0; justify-content: flex-end; }
    .nx-nav > div { position: relative; display: flex; }
    .nx-nav > div > a { display: flex; align-items: center; padding: 0 11px; font-family: var(--nx-cond); font-weight: 500; font-size: 14px;
      text-transform: uppercase; letter-spacing: .6px; color: var(--nx-mute); border-bottom: 3px solid transparent; white-space: nowrap; }
    .nx-nav > div:hover > a, .nx-nav > div:focus-within > a { color: #fff; border-bottom-color: var(--nx-red); }
    .nx-nav .nx-sub { display: none; position: absolute; top: 100%; left: 0; min-width: 220px; padding: 6px; background: var(--nx-card);
      border: 1px solid var(--nx-line2); border-top: 2px solid var(--nx-red); border-radius: 0 0 8px 8px; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
    .nx-nav > div:hover .nx-sub, .nx-nav > div:focus-within .nx-sub { display: block; }
    .nx-sub a { display: block; padding: 7px 10px; border-radius: 5px; color: var(--nx-text); font-size: 13px; }
    .nx-sub a:hover { background: var(--nx-card2); color: var(--nx-gold); }
    .nx-sub .nx-sub-h { padding: 8px 10px 4px; font-family: var(--nx-px); font-size: 7px; color: var(--nx-dim); letter-spacing: .5px; }
    .nx-league { display: flex; align-items: center; gap: 8px; flex: none; font-size: 12px; color: var(--nx-mute); }
    .nx-league select { max-width: 230px; }

    /* ---------- Layout ---------- */
    .nx-main { max-width: 1320px; margin: 0 auto; padding: 22px 24px 60px; }
    .nx-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 22px; align-items: start; margin-top: 22px; }
    @media (max-width: 1100px) { .nx-grid { grid-template-columns: 1fr; } .nx-league { display: none; } }
    @media (max-width: 1280px) { .nx-nav > div > a { padding: 0 7px; font-size: 13px; letter-spacing: .3px; } .nx-top { gap: 14px; padding: 0 16px; } }
    @media (max-width: 760px) { .nx-nav { display: none; } .nx-main { padding: 14px; } }

    /* ---------- Hero ---------- */
    .nx-hero { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid var(--nx-line2);
      background: linear-gradient(105deg, var(--nx-red) 0%, var(--nx-red-d) 42%, #2a0710 70%, #120509 100%); }
    .nx-hero::before { content: ""; position: absolute; inset: 0; pointer-events: none;
      background: repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px); }
    .nx-hero-in::after { content: ""; position: absolute; z-index: -1; right: -130px; top: 0; bottom: 0; width: 340px; pointer-events: none;
      background: linear-gradient(100deg, transparent 0 30%, rgba(241,190,72,.85) 30% 34%, transparent 34% 44%, rgba(241,190,72,.35) 44% 46%, transparent 46%); }
    .nx-hero-in { position: relative; z-index: 1; isolation: isolate; overflow: hidden; display: flex; align-items: center; gap: 28px; padding: 26px 30px 22px; }
    .nx-hero-logo { flex: none; width: 128px; height: 128px; display: grid; place-items: center; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.18), rgba(0,0,0,.25) 70%); box-shadow: 0 0 0 3px rgba(241,190,72,.6), 0 0 40px rgba(241,190,72,.25); }
    .nx-hero-logo img { width: 100px; height: 100px; image-rendering: pixelated; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
    .nx-hero-txt { min-width: 0; flex: 1; }
    .nx-eyebrow { display: inline-flex; gap: 8px; align-items: center; font-family: var(--nx-px); font-size: 8px; letter-spacing: .5px; color: var(--nx-gold);
      background: rgba(0,0,0,.35); padding: 6px 10px; border-radius: 3px; line-height: 1.6; }
    .nx-team { margin: 10px 0 2px; font-family: var(--nx-cond); font-weight: 700; font-size: clamp(34px, 5vw, 58px); line-height: .95;
      text-transform: uppercase; letter-spacing: 1px; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35); }
    .nx-coach { font-family: var(--nx-cond); font-size: 18px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.8); }
    .nx-coach b { color: var(--nx-gold); font-weight: 600; }
    .nx-hero-rank { flex: none; text-align: center; padding: 14px 20px; background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px; margin-right: 120px; }
    .nx-hero-rank .big { font-family: var(--nx-px); font-size: 24px; color: #fff; text-shadow: 3px 3px 0 var(--nx-red-d); }
    .nx-hero-rank .lab { font-family: var(--nx-cond); font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--nx-gold); margin-top: 8px; }
    @media (max-width: 900px) { .nx-hero-rank { margin-right: 0; } .nx-hero-in::after { display: none; } }
    @media (max-width: 640px) { .nx-hero-in { flex-wrap: wrap; padding: 18px; } .nx-hero-logo { width: 88px; height: 88px; } .nx-hero-logo img { width: 70px; height: 70px; } }

    .nx-statbar { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      background: rgba(0,0,0,.5); border-top: 1px solid rgba(255,255,255,.1); }
    .nx-stat { padding: 10px 14px; border-right: 1px solid rgba(255,255,255,.07); }
    .nx-stat:last-child { border-right: 0; }
    .nx-stat .k { font-family: var(--nx-cond); font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; color: var(--nx-mute); }
    .nx-stat .v { font-family: var(--nx-cond); font-weight: 600; font-size: 22px; color: #fff; font-variant-numeric: tabular-nums; }
    .nx-stat .v.pos { color: var(--nx-win); } .nx-stat .v.neg { color: var(--nx-loss); }

    .nx-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .nx-btn { display: inline-flex; align-items: center; padding: 8px 16px; font-family: var(--nx-cond); font-weight: 600; font-size: 14px;
      text-transform: uppercase; letter-spacing: 1px; color: #fff !important; background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2);
      transform: skewX(-12deg); border-radius: 3px; cursor: pointer; transition: background .15s, border-color .15s; }
    .nx-btn > span { display: inline-block; transform: skewX(12deg); }
    .nx-btn:hover { background: var(--nx-red-d); border-color: var(--nx-gold); }
    .nx-btn.gold { background: var(--nx-gold); border-color: var(--nx-gold); color: #111 !important; }
    .nx-btn.gold:hover { background: #ffd36b; }

    /* ---------- Cards ---------- */
    .nx-card { background: var(--nx-card); border: 1px solid var(--nx-line); border-radius: 12px; overflow: clip; }
    .nx-card + .nx-card { margin-top: 18px; }
    .nx-card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px;
      background: linear-gradient(90deg, rgba(200,16,46,.18), transparent 70%); border-bottom: 1px solid var(--nx-line); }
    .nx-card-h h2 { margin: 0; font-family: var(--nx-cond); font-weight: 600; font-size: 18px; text-transform: uppercase; letter-spacing: 1.5px; color: #fff;
      display: flex; align-items: center; gap: 12px; }
    .nx-card-h h2::before { content: ""; width: 4px; height: 18px; background: var(--nx-red); box-shadow: 5px 0 0 var(--nx-gold); }
    .nx-card-h .nx-meta { font-size: 12px; color: var(--nx-mute); }
    .nx-card-h .nx-link { font-size: 12px; color: var(--nx-gold); font-weight: 600; }
    .nx-card-h .nx-link:hover { text-decoration: underline; }

    /* ---------- Checkpoint ---------- */
    .nx-cp { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--nx-line); background: var(--nx-bg2); }
    .nx-cp-num { font-family: var(--nx-px); font-size: 20px; color: var(--nx-gold); text-shadow: 2px 2px 0 var(--nx-red-d); }
    .nx-cp-txt { font-size: 13px; color: var(--nx-mute); }
    .nx-cp-txt b { color: var(--nx-text); }
    .nx-cp-bar { flex: 1; min-width: 160px; height: 10px; background: #0b0d12; border: 1px solid var(--nx-line2); border-radius: 2px; overflow: hidden; }
    .nx-cp-bar > i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--nx-gold) 0 8px, var(--nx-gold-d) 8px 10px); }
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
    .nx-seg button:hover { color: #fff; }
    .nx-seg button.on { background: var(--nx-red); color: #fff; }
    .nx-seg button .n { opacity: .65; margin-left: 5px; }
    .nx-lab { font-family: var(--nx-px); font-size: 7px; color: var(--nx-dim); letter-spacing: .5px; margin-right: 4px; }
    .nx-pill { display: inline-flex; align-items: center; gap: 6px; font: 500 12px var(--nx-ui); color: var(--nx-text); background: var(--nx-bg2);
      border: 1px solid var(--nx-line2); border-radius: 999px; padding: 3px 11px 3px 4px; cursor: pointer; white-space: nowrap; transition: border-color .15s, background .15s; }
    .nx-pill .nx-logo { width: 20px; height: 20px; image-rendering: pixelated; }
    .nx-pill small { color: var(--nx-dim); font-size: 11px; }
    .nx-pill:hover { border-color: var(--nx-gold); }
    .nx-pill.on { background: var(--nx-red); border-color: var(--nx-gold); box-shadow: inset 0 0 0 1px var(--nx-gold); }
    .nx-pill.on small { color: rgba(255,255,255,.75); }
    .nx-clear { font: 600 12px var(--nx-ui); color: var(--nx-gold); background: none; border: 0; cursor: pointer; padding: 3px 6px; }
    .nx-clear[hidden] { display: none; }

    /* ---------- Schedule table ---------- */
    table.nx-sched { border-collapse: collapse; width: 100%; font-size: 13px; }
    table.nx-sched th { position: sticky; top: 58px; z-index: 2; background: #0e1118; color: var(--nx-mute); text-align: left;
      font: 500 11px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.3px; padding: 8px 12px; border-bottom: 2px solid var(--nx-red); white-space: nowrap; }
    table.nx-sched td { padding: 6px 12px; border-bottom: 1px solid var(--nx-line); white-space: nowrap; }
    table.nx-sched td.gm { width: 1%; font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); text-align: center; }
    table.nx-sched td.act, table.nx-sched td.ha, table.nx-sched td.sc, table.nx-sched td.rs { width: 1%; }
    table.nx-sched td.sc { text-align: right; font-family: var(--nx-cond); font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    table.nx-sched td.rs { text-align: center; }
    table.nx-sched td.tm { color: var(--nx-mute); font-size: 12px; }
    table.nx-sched tr.g-row.home td { background: rgba(255,255,255,.04); }
    table.nx-sched tr.g-row.away td { background: rgba(0,0,0,.3); }
    table.nx-sched tr.g-row:hover td { background: rgba(241,190,72,.09); }

    tr.nx-grp td { padding: 0; border-bottom: 1px solid var(--nx-line2); background: linear-gradient(90deg, #1f2433, #151922 65%); }
    tr.nx-grp:not(:first-child) td { border-top: 6px solid var(--nx-card); }
    .nx-grp-in { display: flex; align-items: center; gap: 12px; padding: 9px 12px; cursor: pointer; user-select: none; }
    .nx-grp-in .nx-logo { width: 30px; height: 30px; image-rendering: pixelated; flex: none; }
    .nx-grp-name { font-family: var(--nx-cond); font-size: 17px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #fff; line-height: 1.2; }
    .nx-grp-name a:hover { color: var(--nx-gold); }
    .nx-grp-coach { font-size: 12px; color: var(--nx-gold); font-weight: 600; }
    .nx-grp-div { font-size: 11px; color: var(--nx-dim); }
    .nx-grp-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
    .nx-pips { display: inline-flex; gap: 3px; }
    .nx-pips i { width: 10px; height: 10px; background: #0b0d12; border: 1px solid var(--nx-line2); }
    .nx-pips i.W { background: var(--nx-win); border-color: var(--nx-win); }
    .nx-pips i.L { background: var(--nx-loss); border-color: var(--nx-loss); }
    .nx-pips i.T { background: var(--nx-tie); border-color: var(--nx-tie); }
    .nx-grp-rec { font-family: var(--nx-cond); font-size: 15px; font-weight: 600; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
    .nx-grp-left { font-size: 11px; color: var(--nx-mute); min-width: 54px; text-align: right; }
    .nx-grp-left.done { color: var(--nx-win); }
    .nx-chev { width: 10px; color: var(--nx-dim); transition: transform .15s; font-size: 10px; }
    tr.nx-grp.collapsed .nx-chev { transform: rotate(-90deg); }
    @media (max-width: 640px) { .nx-pips { display: none; } .nx-grp-div { display: none; } }

    .nx-ha { display: inline-block; font: 600 10px var(--nx-cond); letter-spacing: 1px; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; }
    .nx-ha.h { background: rgba(255,255,255,.12); color: #fff; }
    .nx-ha.a { color: var(--nx-mute); border: 1px solid var(--nx-line2); }
    .nx-res { display: inline-grid; place-items: center; width: 24px; height: 24px; font-family: var(--nx-px); font-size: 9px; border-radius: 3px; }
    .nx-res.W { background: var(--nx-win); color: #062b15; } .nx-res.L { background: var(--nx-loss); color: #3a040b; } .nx-res.T { background: var(--nx-tie); color: #3a2a04; }
    .nx-go { display: inline-flex; align-items: center; justify-content: center; min-width: 92px; padding: 4px 10px; font: 600 11px var(--nx-cond); text-transform: uppercase;
      letter-spacing: 1px; border-radius: 3px; transform: skewX(-12deg); }
    .nx-go > span { display: inline-block; transform: skewX(12deg); }
    .nx-go.log { background: var(--nx-red); color: #fff !important; }
    .nx-go.log:hover { background: #e3173a; }
    .nx-go.box { color: var(--nx-gold) !important; border: 1px solid rgba(241,190,72,.45); }
    .nx-go.box:hover { background: rgba(241,190,72,.12); }
    .nx-empty { padding: 30px; text-align: center; color: var(--nx-mute); }

    /* ---------- Sidebar ---------- */
    table.nx-st { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.nx-st th { font: 500 11px var(--nx-cond); text-transform: uppercase; letter-spacing: 1.2px; color: var(--nx-mute); padding: 8px 6px; text-align: right; border-bottom: 1px solid var(--nx-line2); }
    table.nx-st th:nth-child(2) { text-align: left; }
    table.nx-st td { padding: 6px; border-bottom: 1px solid var(--nx-line); text-align: right; font-variant-numeric: tabular-nums; }
    table.nx-st td.pos { text-align: center; font-family: var(--nx-px); font-size: 8px; color: var(--nx-dim); width: 24px; }
    table.nx-st td.tm { text-align: left; }
    table.nx-st td.pts { font-family: var(--nx-cond); font-weight: 600; font-size: 15px; color: #fff; padding-right: 12px; }
    table.nx-st tr.me td { background: rgba(200,16,46,.22); }
    table.nx-st tr.me td.pos { color: var(--nx-gold); }
    table.nx-st tbody tr:hover td { background: rgba(241,190,72,.08); }
    .nx-tmcell { display: flex; align-items: center; gap: 8px; }
    .nx-tmcell .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; flex: none; }
    .nx-tmcell .n { font-weight: 600; color: var(--nx-text); line-height: 1.2; }
    .nx-tmcell .c { font-size: 11px; color: var(--nx-mute); line-height: 1.2; }
    .nx-tmcell:hover .n { color: var(--nx-gold); }

    .nx-prof { padding: 4px 16px 10px; }
    .nx-prof div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--nx-line); font-size: 13px; }
    .nx-prof div:last-child { border-bottom: 0; }
    .nx-prof span { color: var(--nx-mute); flex: none; }
    .nx-prof b { font-weight: 600; text-align: right; }

    .nx-level + .nx-level { border-top: 0; margin-top: -1px; }
    .nx-level { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--nx-line); font-size: 12px; color: var(--nx-mute); }
    .nx-level select { flex: 1; min-width: 0; }
    .nx-level { white-space: nowrap; }
    .nx-dir-h { padding: 10px 16px 4px; font-family: var(--nx-px); font-size: 8px; color: var(--nx-gold); letter-spacing: .5px; }
    .nx-dir a { display: flex; align-items: center; gap: 10px; padding: 5px 16px; font-size: 13px; }
    .nx-dir a:hover { background: var(--nx-card2); }
    .nx-dir a:hover .n { color: var(--nx-gold); }
    .nx-dir a.me { background: rgba(200,16,46,.2); }
    .nx-dir .nx-logo { width: 22px; height: 22px; image-rendering: pixelated; flex: none; }
    .nx-dir .n { flex: 1; font-weight: 500; }
    .nx-dir .c { color: var(--nx-mute); font-size: 12px; }

    .nx-foot { margin-top: 30px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      color: var(--nx-dim); font-size: 12px; border-top: 1px solid var(--nx-line); padding-top: 16px; }
    .nx-foot .nx-px { font-family: var(--nx-px); font-size: 8px; animation: nx-blink 1.2s steps(2) infinite; }
    @keyframes nx-blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .nx-foot .nx-px { animation: none; } }
    `;
    addCss(css);

    // ============================================================
    // 3. Render
    // ============================================================
    const gfN = parseInt(stats.gf, 10) || 0, gaN = parseInt(stats.ga, 10) || 0, diff = gfN - gaN;

    const tickerItems = champs.map((c) =>
      `<span class="nx-ticker-item">${c.img ? `<img src="${esc(c.img)}" alt="">` : ''}${esc(c.level)} <a href="${esc(c.href)}"><b>${esc(c.coach)}</b></a></span>`).join('');

    const navHtml = navItems.map((n) => {
      const sub = n.sub.length ? `<div class="nx-sub">${n.sub.map((s) => /^-{2,}/.test(s.text)
        ? `<div class="nx-sub-h">${esc(s.text.replace(/-/g, '').trim().toUpperCase())}</div>`
        : `<a href="${esc(s.href)}"${s.target ? ` target="${esc(s.target)}"` : ''}>${esc(s.text)}</a>`).join('')}</div>` : '';
      return `<div><a href="${esc(n.href)}"${n.target ? ` target="${esc(n.target)}"` : ''}>${esc(n.text)}${n.sub.length ? '&nbsp;▾' : ''}</a>${sub}</div>`;
    }).join('');

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

    const pillsHtml = groups.map((g) => {
      const info = teamInfo[g.opp];
      return `<button type="button" class="nx-pill" data-opp="${esc(g.opp)}">${logoImg(g.opp)}${esc(info ? info.coach : g.opp)}<small>${esc(g.opp)}</small></button>`;
    }).join('');

    const schedRows = groups.map((g) => {
      const info = teamInfo[g.opp] || {};
      const pips = g.games.map((x) => `<i class="${x.result}" title="Gm ${esc(x.gm)} · ${x.isHome ? 'Home' : 'Away'}${x.played ? ' · ' + x.result + ' ' + esc(x.score) : ''}"></i>`).join('');
      const fullName = esc(fullTeamName(g.opp));
      const head = `<tr class="nx-grp" data-opp="${esc(g.opp)}"><td colspan="6"><div class="nx-grp-in" title="Click to collapse / expand">
          <span class="nx-chev">▼</span>${logoImg(g.opp)}
          <div><div class="nx-grp-name">${info.href ? `<a href="${esc(info.href)}">${fullName}</a>` : fullName}</div>
            <div><span class="nx-grp-coach">${esc(info.coach || '')}</span>${info.division ? ` <span class="nx-grp-div">· ${esc(info.division)}</span>` : ''}</div></div>
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

    const dirHtml = divisions.length ? `
      <div class="nx-card"><div class="nx-card-h"><h2>League</h2></div>
        ${leagueOpts.length ? `<div class="nx-level">Season <select id="nx-lg">${leagueOpts.map((o) => `<option value="${esc(o.v)}"${o.sel ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select></div>` : ''}
        ${levelOpts.length ? `<div class="nx-level">Level <select id="nx-level">${levelOpts.map((o) => `<option value="${esc(o.v)}"${o.sel ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select></div>` : ''}
        ${divisions.map((d) => `<div class="nx-dir"><div class="nx-dir-h">${esc(d.name.toUpperCase())}</div>
          ${d.teams.map((t) => `<a class="${t === myTeam ? 'me' : ''}" href="${esc(teamInfo[t].href)}">${logoImg(t)}<span class="n">${esc(t)}</span><span class="c">${esc(teamInfo[t].coach)}</span></a>`).join('')}
        </div>`).join('')}
        <div style="height:8px"></div>
      </div>` : '';

    const app = document.createElement('div');
    app.id = 'nx-app';
    app.className = 'nx-root';
    app.innerHTML = `
      ${champs.length ? `<div class="nx-ticker"><div class="nx-ticker-tag">${esc((champTitle || 'Champions').toUpperCase())}</div>
        <div class="nx-ticker-track">${tickerItems.repeat(4)}</div></div>` : ''}
      <header class="nx-top">
        <a class="nx-brand" href="http://www.nhl94online.com/"><span class="nx-brand-a">NHL'94</span><span class="nx-brand-b">ONLINE</span></a>
        <nav class="nx-nav">${navHtml}</nav>
      </header>

      <main class="nx-main">
        <section class="nx-hero">
          <div class="nx-hero-in">
            <div class="nx-hero-logo">${bigLogo ? `<img src="${esc(bigLogo.src)}" alt="">` : ''}</div>
            <div class="nx-hero-txt">
              <div class="nx-eyebrow">${esc(levelName)} <span style="opacity:.5">|</span> ${esc(leagueName.toUpperCase())}</div>
              <div class="nx-team">${esc(teamFullName || myTeam)}</div>
              <div class="nx-coach">Head Coach <b>${esc(coachName)}</b></div>
              <div class="nx-actions">
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
                </div>
                <div class="nx-ctrl-row"><span class="nx-lab">COACH</span>${pillsHtml}<button type="button" class="nx-clear" id="nx-clear" hidden>Clear</button></div>
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
            ${dirHtml}
          </aside>
        </div>

        <footer class="nx-foot"><span class="nx-px">PRESS START</span><span>NHL94Online.com · Classic '94</span></footer>
      </main>
    `;
    document.body.appendChild(app);

    // ============================================================
    // 4. Behavior
    // ============================================================
    const lg = $('#nx-lg', app);
    if (lg) lg.addEventListener('change', () => { location.href = '?lg=' + encodeURIComponent(lg.value); });
    const lvl = $('#nx-level', app);
    if (lvl) lvl.addEventListener('change', () => { location.href = '?lg=' + encodeURIComponent(params.get('lg') || '') + '&sublg=' + encodeURIComponent(lvl.value); });

    if (!games.length) return app;

    // Filters + collapsed groups (saved per coach page)
    const selected = new Set(store.get('opp:' + pageKey, []));
    const collapsed = new Set(store.get('collapsed:' + pageKey, []));
    let mode = store.get('mode:' + pageKey, 'all');
    const tbody = $('table.nx-sched tbody', app);
    const seg = $('#nx-seg', app);
    const clearBtn = $('#nx-clear', app);

    function apply() {
      $$('.nx-pill', app).forEach((b) => b.classList.toggle('on', selected.has(b.dataset.opp)));
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
      const pill = e.target.closest('.nx-pill');
      if (pill) {
        const o = pill.dataset.opp;
        if (selected.has(o)) selected.delete(o); else selected.add(o);
        store.set('opp:' + pageKey, [...selected]);
        return apply();
      }
      if (e.target === clearBtn) { selected.clear(); store.set('opp:' + pageKey, []); return apply(); }
      const sb = e.target.closest('#nx-seg button');
      if (sb) { mode = sb.dataset.v; store.set('mode:' + pageKey, mode); return apply(); }
      const grp = e.target.closest('tr.nx-grp');
      if (grp && !e.target.closest('a')) {
        const o = grp.dataset.opp;
        if (collapsed.has(o)) collapsed.delete(o); else collapsed.add(o);
        store.set('collapsed:' + pageKey, [...collapsed]);
        return apply();
      }
    });

    apply();
    return app;
  }

  // ============================================================
  // Version registry + View switcher
  // ------------------------------------------------------------
  // To add a new design: write renderV2() (returns its root element with class
  // "nx-root") and add it here. The newest entry is the default view.
  // ============================================================
  const VERSIONS = [
    { id: 'classic', label: 'Classic', title: 'Original nhl94online.com page' },
    { id: 'v1', label: 'V1', title: 'V1 · Rink Night', render: renderV1 },
  ];
  const DEFAULT_VIEW = VERSIONS[VERSIONS.length - 1].id;

  addCss(`
  body[data-nx-view]:not([data-nx-view="classic"]) { margin: 0 !important; background: #0a0c11 !important; }
  body[data-nx-view]:not([data-nx-view="classic"]) > *:not(.nx-root):not(.nx-switch) { display: none !important; }
  .nx-root:not(.nx-active) { display: none !important; }
  .nx-switch { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; display: flex; align-items: center; gap: 2px; padding: 3px;
    font: 600 12px Inter, "Segoe UI", system-ui, sans-serif; background: rgba(17,20,27,.94); border: 1px solid #323a4a; border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,.45); backdrop-filter: blur(8px); }
  .nx-switch-lab { padding: 0 8px 0 6px; font: 400 7px "Press Start 2P", monospace; letter-spacing: .5px; color: #6b7487; }
  .nx-switch button { font: inherit; color: #9aa3b5; background: none; border: 0; border-radius: 7px; padding: 6px 11px; cursor: pointer; }
  .nx-switch button:hover { color: #fff; background: rgba(255,255,255,.06); }
  .nx-switch button[aria-pressed="true"] { color: #111; background: #F1BE48; }
  .nx-switch button:focus-visible { outline: 2px solid #F1BE48; outline-offset: 1px; }
  `);

  const rendered = {};
  const sw = document.createElement('div');
  sw.className = 'nx-switch';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Page view');
  sw.title = 'Switch view (Alt+Shift+V)';
  sw.innerHTML = '<span class="nx-switch-lab">VIEW</span>' + VERSIONS.map((v) =>
    `<button type="button" data-view="${v.id}" title="${esc(v.title)}">${esc(v.label)}</button>`).join('');
  document.body.appendChild(sw);

  function setView(id) {
    if (!VERSIONS.some((v) => v.id === id)) id = DEFAULT_VIEW;
    const v = VERSIONS.find((x) => x.id === id);
    if (v.render && !rendered[id]) {
      try { rendered[id] = v.render(); } catch (e) { console.error('[nhl94-its-in-the-script]', e); id = 'classic'; }
    }
    Object.entries(rendered).forEach(([k, el]) => el && el.classList.toggle('nx-active', k === id));
    document.body.setAttribute('data-nx-view', id);
    $$('button', sw).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === id)));
    store.set('view', id);
  }
  sw.addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
  document.addEventListener('keydown', (e) => {
    if (!(e.altKey && e.shiftKey && e.code === 'KeyV')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    e.preventDefault();
    const i = VERSIONS.findIndex((v) => v.id === document.body.getAttribute('data-nx-view'));
    setView(VERSIONS[(i + 1) % VERSIONS.length].id);
  });

  // Users of the pre-switcher build who chose "Classic view" stay on classic.
  setView(store.get('view', store.get('classic', false) ? 'classic' : DEFAULT_VIEW));
})();
