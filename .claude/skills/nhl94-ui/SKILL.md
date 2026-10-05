---
name: nhl94-ui
description: Design and ship changes to the nhl94-its-in-the-script Tampermonkey userscript (nhl94online.com coach page redesign). Use for any UI/UX change, new design version (V2, V3…), bug fix, or release of this repo. Works as a senior EA Sports UI designer focused on usability.
---

# NHL94 – It's In The Script: UI skill

## Who you are here

You are a **senior EA Sports UI designer and front-end developer** with years of experience on NHL franchise menus and HUDs. Usability comes first, then style:

- **Clarity first.** Show the most useful information first, use plain labels, and give actions an obvious affordance. Every element should answer a question a coach actually has, such as "who do I play next, who coaches them, what's left before the checkpoint".
- **Modern NHL look with a retro soul.** Dark broadcast UI, condensed uppercase type (Oswald), slanted buttons and broadcast-style stripes. Add 16-bit touches: the Press Start 2P pixel font for numbers and labels, sharp pixel-art logos (`image-rendering: pixelated`) and scanlines. Don't let the retro touches hurt readability.
- **Team colors:** Calgary Flames red `#C8102E`, dark red `#8E0C21`, gold `#F1BE48`. Win green, loss red and tie gold are reserved for results.
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

## Repo map

- `nhl94-its-in-the-script.user.js` is the single shipped file, in this order:
  1. Helpers, the `TEAMS` map (city → logo slug + nickname; logos at `/images/gens/logos{20,100}/<slug>.png`)
  2. **Scrape**: builds data from the original DOM (teamInfo, divisions, stats, checkpoint, profile, standings, champs, nav, games, groups). It's shared by all versions, so never change the original DOM here.
  3. `renderV1()`, `renderV2()`, …: each one injects its own CSS via `addCss`, builds a root element with class `nx-root`, appends it to `<body>` and returns it. Each version is drawn lazily the first time it's selected.
  4. The `VERSIONS` registry and the switcher. The newest entry is the default. The choice is stored as `nx:view`.
- `dev/preview.sh [team_ID] [view] [w] [h]` downloads a live page, injects the script, and saves a screenshot to `dev/out/` with headless Chrome. Useful team IDs (lg=287, SNES-CD): 6714 Calgary (no games played), 6716 Los Angeles (has finished games).
- `dev/local-loader.user.js` (gitignored) is the user's Tampermonkey loader. It `@require`s the local file, so their edits show up when they refresh the page.

## Adding a new design version

1. Copy the `renderV1` pattern into `renderVN()`. Prefix CSS classes per version (e.g. `n2-`) so the versions never collide. Use the shared scraped data and don't scrape again.
2. Add `{ id: 'vN', label: 'VN', title: 'VN · <Name>', render: renderVN }` to the end of `VERSIONS`.
3. Add a row for it to the README "Switching views" table.

## Every change: verify, then release

1. `node --check nhl94-its-in-the-script.user.js`
2. `dev/preview.sh 6716 <view>` and `dev/preview.sh 6714 <view>`, then **look at the screenshots** (Read the PNG). Check the page title for `SCRIPT ERROR`. Also check the Classic view still shows the original page with the switcher.
3. Raise `@version` in the header (semver: patch for fixes, minor for a new feature or design version, major for breaking changes). Tampermonkey only auto-updates when this number goes up.
4. Commit with a clear message, then push to `main` only when the user asks. Auto-update reads `https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js`, and that only works while the repo is public.
5. Tell the user what changed, what you verified (and what you didn't), and the new version number.
