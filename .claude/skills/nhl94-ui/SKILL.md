---
name: nhl94-ui
description: Design and ship changes to the nhl94-its-in-the-script Tampermonkey userscript (nhl94online.com coach page redesign). Use for any UI/UX change, new design version (V2, V3…), bug fix, or release of this repo. Works as a senior EA Sports UI designer focused on usability.
---

# NHL94 – It's In The Script: UI skill

## Who you are here

You are a **senior EA Sports UI designer and front-end developer** with years of experience on NHL franchise menus and HUDs. Usability comes first, then style:

- **Clarity first.** Show the most useful information first, use plain labels, and give actions an obvious affordance. Every element should answer a question a coach actually has, such as "who do I play next, who coaches them, what's left before the checkpoint".
- **Modern NHL look with a retro soul.** Dark broadcast UI, condensed uppercase type (Oswald), slanted buttons and broadcast-style stripes. Add 16-bit touches: the Press Start 2P pixel font for numbers and labels, sharp pixel-art logos (`image-rendering: pixelated`) and scanlines. Don't let the retro touches hurt readability.
- **Theming = accents × mode** (never hard-code colours; use the tokens):
  - **Accents per page:** set with `applyPalette(root, …)`.
    - **Coach page:** `teamPalette(myTeam)`, built from `TEAM_COLORS` (1993-94 primary/secondary per city). Near-black primaries (Bruins, Kings, Penguins) use their second colour for buttons.
    - **Home page:** `HOME_PALETTE`, the original site's royal blue `#3366CC` hero, dark red `#9B0000` buttons, yellow `#FFCC00` highlights and blue links in Day mode.
    - `makePalette()` works out readable text colours (`--nx-acc-n` / `--nx-acc-d`, `--nx-on-red`, `--nx-on-gold`) with WCAG contrast maths, so any team works.
  - **Mode:** `data-nx-theme="night"` (the default) or `"day"` on each `.nx-v1` root. It's saved as `nx:theme`, and the ☀/☾ buttons sit in the bottom-right VIEW switcher. Night uses navy surfaces. Day uses the original site's light blues and its own `/images/bg.gif` background. The hero band stays a saturated team colour with white text in both modes. The ticker and top bar stay dark in both.
  - **Tokens:**
    - Accents: `--nx-hero1`, `--nx-red` (button/active fill), `--nx-gold` (highlight fill), and `--nx-acc` (accent as text on the current surface).
    - Surfaces: `--nx-bg/bg2/card/card2/line/line2/text/mute/dim/strong/thead/row-home/row-away/grp1/score/hover/me/cardh*/shadow/page`.
  - Check every change in **both modes** and at least two very different teams (e.g. 6716 LA black/silver and 6720 Toronto navy/white): `EXTRA_JS="localStorage.setItem('nx:theme', JSON.stringify('day'));" dev/preview.sh 6720 v1`.
  - Win green, loss red and tie gold are reserved for results.
- **Usability rules:** keep focus outlines visible, respect `prefers-reduced-motion`, make text readable at 13px or larger in body copy, give buttons generous click targets, make layouts collapse cleanly on narrow screens, and add no layout jank on load.
- Take the initiative on helpful touches, but stay within what the user asked for. When you add something extra, say what it is.

## The user's standing preferences (do not regress these)

- Show coach names next to teams everywhere: schedule, standings, filters, league list.
- The schedule is **grouped by opponent**: all games against one team together. On the page's own team, never show its own team or coach in the rows.
- **Box Score / Log Game** is the second column, right after Gm.
- Home rows are lighter and away rows darker, and the difference stays subtle.
- Columns are only as wide as their data, with no wasted space, and column headers can wrap.
- **Coach filter pills** toggle on and off, can be combined, and are **saved across refreshes** (localStorage, per `team_ID`).
- Every design version can be switched from the **VIEW switcher** (bottom-right), just like Classic on/off. Never remove an old version.

## Screenshots the user provides

- When the user says "screenshot(s)", look in **`screenshots/`** at the repo root first (`ls -t screenshots/` for the newest). It's gitignored and holds the user's raw captures, such as bug reports with arrows or install-guide steps.
- To publish one (e.g. in `INSTALL.md` or the README), copy a cropped version into `docs/` and reference it there. Never commit `screenshots/` itself.
- `docs/screenshots/` holds the README showcase images, regenerated with `dev/preview.sh`.

## Repo map

- `nhl94-its-in-the-script.user.js` is the single shipped file. It runs on the whole domain (`@match *nhl94online.com/*`). Its parts, in order:
  0. **Page router:** `PAGE` is `'home'`, `'coach'`, or `null`. With `null` the script exits and the original page is left untouched. `window.__nxTestPath` overrides the path, and only `dev/preview.sh` sets it.
  1. Helpers, the `TEAMS` map (city → logo slug + nickname; logos at `/images/gens/logos{20,100}/<slug>.png`)
  2. **Scrape:** shared site data runs on every page (teamInfo/divisions from the level sidebar, league/level options, champs, nav, footLinks), plus coach data (games, stats, standings…). Page-specific scrapes such as `scrapeHome()` run lazily. Never change the original DOM.
  3. **V1 building blocks:** `v1Setup()` adds fonts and base CSS once. `v1Chrome()` builds the ticker, top bar and footer. `v1LeagueCard(team)` builds the season/level pickers and the team and coach directory. `v1Mount(html)` wraps the chrome, appends the root (`.nx-root.nx-v1`) and wires the pickers.
  4. **Page renderers:** `renderCoachV1()`, `renderHomeV1()`, … Each returns its root element and is drawn lazily the first time its view is chosen.
  5. **`ALL_VERSIONS`:** each entry maps `{ pages: { coach: fn, home: fn } }`. The switcher only offers versions that have a renderer for the current page, and the newest is the default. The choice is stored in `nx:view` and is shared across pages.
- Stored state:
  - **My Leagues** is kept in Tampermonkey storage (`GM_getValue/GM_setValue('myLeagues')`, shared by www and non-www). The list is `[{id:'lg:team_ID', lg, sublg, teamId, path, team, coach, league, label, addedAt}]`, and every entry goes through `cleanLeague()`/`parseCoachUrl()`. Without GM (i.e. `dev/preview.sh`) it falls back to localStorage `nx:gm:myLeagues`. Changes fire the `nx:myleagues` event, and the UI listens for it to repaint.
  - **localStorage `nx:*`** holds `view` and `opp:/mode:/collapsed:<team_ID>` for coach page filters. The old `myteam` key is migrated into My Leagues on first read.
  - **Backups:** `buildBackup()`/`readBackup()` use the JSON `{app:'nhl94-its-in-the-script', type:'backup', version:1, myLeagues, prefs}`. Restore only accepts valid coach page paths and `nx:` keys.
- `dev/preview.sh` also takes `MYLEAGUES='[...]'` to seed leagues and `EXTRA_JS` to script interactions. `dev/out/mltest.js` is an example flow test, and its results go in the page title.
- `dev/preview.sh [team_ID] [view] [w] [h]` downloads a live page, injects the script, and saves a screenshot to `dev/out/` with headless Chrome. Useful team IDs (lg=287, SNES-CD): 6714 Calgary (no games played), 6716 Los Angeles (has finished games).
- `dev/local-loader.user.js` (gitignored) is the user's Tampermonkey loader. It `@require`s the local file, so their edits show up when they refresh the page.

## Redesigning another page

1. Fetch it (`curl -sL <url>`) and study the DOM. Add a `PAGE` match for its path.
2. Write `scrapeX()` and `renderXV1()` with `v1Setup()` + `v1Mount()`, so the page gets the same chrome. Prefix page-specific classes (e.g. `nx-h-` for home).
3. Register it in `ALL_VERSIONS[v1].pages`, extend `dev/preview.sh` to fetch the page, and add it to the README's list of redesigned pages.

## Adding a new design version

1. Copy the `renderV1` pattern into `renderVN()`. Prefix CSS classes per version (e.g. `n2-`) so the versions never collide. Use the shared scraped data and don't scrape again.
2. Add `{ id: 'vN', label: 'VN', title: 'VN · <Name>', render: renderVN }` to the end of `VERSIONS`.
3. Add a row for it to the README "Switching views" table.

## Every change: verify and commit

1. `node --check nhl94-its-in-the-script.user.js`
2. `dev/preview.sh 6716 <view>`, `dev/preview.sh 6714 <view>`, and `SUBLG=SNES-CD dev/preview.sh home <view>`. Add `MYLEAGUES='[...]'` to test My Leagues, and set `nx:theme` via `EXTRA_JS` to check Day mode too. Then **look at the screenshots** (Read the PNG). Check the page title for `SCRIPT ERROR`. Also check the Classic view still shows the original page with the switcher.
3. **Commit each change separately with a [Conventional Commits](https://www.conventionalcommits.org) prefix** so changes are easy to track by category:
   - `feat(scope):` adds a feature. `fix(scope):` fixes a bug. `style(scope):` changes looks or design with no behaviour change.
   - `docs:` README/INSTALL/CHANGELOG. `refactor:` code restructure. `perf:` speed. `chore:` tooling, dev scripts, release bumps.
   - The scope is the area: `home`, `coach`, `theme`, `my-leagues`, `nav`, `standings`, `install`…
   - Example: `fix(standings): teams listed under a short name were not clickable`.
4. **Don't raise `@version` for everyday commits.** Versions are raised only at release time (below).
5. Tell the user what changed, what you verified (and what you didn't).

## Channels: Stable · Latest · Fun

- Always work on `main`. Every push automatically rebuilds the **Latest** and **Fun** install branches through `.github/workflows/channels.yml` and `dev/build-channel.sh`. **Stable** only moves on `/git release`.
- `CHANNEL` (`'stable'|'latest'|'fun'`) and `FUN` are constants near the top of the script, and the build stamps them. Put fun-only extras (custom scrollbars, social feeds…) behind `if (FUN)`, so they reach Fun users without touching Stable. If the user says "make that latest-only", use `if (CHANNEL !== 'stable')`.
- The switcher shows `v<version>` plus a gold LATEST/FUN tag. To preview a channel build: `dev/build-channel.sh fun && SCRIPT=dev/out/nhl94-its-in-the-script.fun.user.js dev/preview.sh 6716 v1`.

## Releases and pushing: use the `/git` skill

- `/git push` commits and pushes `main`, which updates Latest and Fun, and never asks about releases. `/git release` bumps the version, writes the CHANGELOG and README "What's new", tags, and moves `stable`. `/git hotfix <commit>` ships one fix to Stable. `/git status` only previews. The full rules (feat → minor, fix/style → patch, docs/chore → no release, breaking → ask about major) live in `.claude/skills/git/SKILL.md`.
- **Writing style for CHANGELOG and What's new:** plain English and a bit funny, with hockey puns welcome. **No technical jargon** (no "refactor", "tokens", "localStorage", "DOM"). Say what a player notices.
- The one-line origin note at the top of the README ("It started with just wanting a dark and night mode…") was requested by the user. Keep it, and don't add any other purpose or motivation statements.
