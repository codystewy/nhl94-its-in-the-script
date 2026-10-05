# NHL94 – It's In The Script 🏒

A Tampermonkey userscript that redesigns the [nhl94online.com](https://nhl94online.com) coach pages. The look mixes NHL 26 with 16-bit, and it fixes the thing that started this project: **the schedule never told you who coaches each team.**

## Install (one click)

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click **[Install the script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**, then click **Install** on the Tampermonkey screen that opens.
3. Open any coach page, for example `nhl94online.com/html/coachpage.php?...&team_ID=...`.

Updates install automatically. Tampermonkey checks this repo for a newer version.

## Switching views

A **VIEW** switcher sits in the bottom-right corner of every coach page:

| View | What it is |
| --- | --- |
| **Classic** | The original nhl94online.com page, untouched |
| **V1** | *Rink Night*: a dark NHL 26 broadcast look with 16-bit touches |

The page remembers your choice. Press **Alt + Shift + V** to cycle through the views. New designs are added as new versions; old ones stay available.

## What V1 gives you

- **Coach names everywhere:** on the schedule, standings, filters and league list.
- **Schedule grouped by opponent:** one header per opponent with their logo, coach, your record against them, a box per game for wins and losses, and games left. Click a header to collapse it.
- **Filters:** All / To Play / Final tabs, plus coach pills you can switch on and off. Both are saved per coach page.
- **Checkpoint tracker:** games left, a progress bar and a countdown that turns red as the deadline gets close.
- **Quick actions:** **Log Game** and **Box Score** sit right next to each game.
- **Clear home and away rows:** home rows are lighter and away rows are darker.
- **Team info at a glance:** division rank, record splits, goal difference, and the full league directory with coaches.

## Development

- `nhl94-its-in-the-script.user.js`: the whole script (shared data scraping, one `renderVN()` per design version, and the version switcher).
- `dev/preview.sh [team_ID] [view]`: draws a live coach page with the script injected using headless Chrome, and saves a screenshot to `dev/out/`.
- Local live editing: install a small Tampermonkey script that `@require`s `file:///path/to/nhl94-its-in-the-script.user.js`. In Chrome you also need to turn on *Allow access to file URLs* for Tampermonkey. Edits then show up when you refresh the page.

**Releasing:** raise `@version` in the script header (semver) with every change you push to `main`. That's how Tampermonkey knows to update.

*Fan-made and not affiliated with EA Sports, the NHL or nhl94online.com.*
