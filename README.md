# NHL94 – It's In The Script 🏒

A Tampermonkey userscript that redesigns [nhl94online.com](https://nhl94online.com) page by page. The look mixes NHL 26 with 16-bit.

![V1 home page](docs/screenshots/home-v1.png)

## Before & after

| Classic (original site) | V1 · Rink Night |
| --- | --- |
| ![Original home page](docs/screenshots/home-classic.png) | ![V1 home page](docs/screenshots/home-v1.png) |
| ![Original coach page](docs/screenshots/coach-classic.png) | ![V1 coach page](docs/screenshots/coach-v1-final.png)<br><sub>Coach page with the Final filter on: grouped by opponent, with coach names, results and OT tags</sub> |

<details>
<summary><b>Phone view</b></summary>

<img src="docs/screenshots/coach-v1-mobile.png" alt="V1 coach page on a phone" width="320">

</details>

## Install (one click)

**New to Tampermonkey?** Follow the **[step-by-step install guide](INSTALL.md)** for Chrome, Brave, Firefox and Edge.

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser. On Chrome, Brave or Edge, also turn on **Allow User Scripts** in the extension's details.
2. Click **[Install the script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**, then click **Install** on the Tampermonkey screen that opens.
3. Open [nhl94online.com](https://www.nhl94online.com) or any coach page.

**Redesigned pages so far:** Home and Coach pages. Pages that haven't been redesigned yet look exactly like the original site.

Updates install automatically. Tampermonkey checks this repo for a newer version.

## Switching views

A **VIEW** switcher sits in the bottom-right corner of every redesigned page:

| View | What it is |
| --- | --- |
| **Classic** | The original nhl94online.com page, untouched |
| **V1** | *Rink Night*: a dark NHL 26 broadcast look with 16-bit touches |

The page remembers your choice. Press **Alt + Shift + V** to cycle through the views. New designs are added as new versions; old ones stay available.

## What V1 gives you

**Home page**

- **Latest Scores** for each level, with team logos, coach names, the winner highlighted, OT tags and Box Score buttons.
- **★ My Team:** pin your team from its coach page and it shows up on the home page with a one-click link to your schedule. Your level is starred in the score tabs.
- The RetroArch notice comes with direct Windows and Mac download buttons, and every league download is in one tidy list.
- League card: switch season and level, and see every team with its coach.

**Coach page**

- **Coach names everywhere:** on the schedule, standings, filters and league list.
- **Schedule grouped by opponent:** one header per opponent with their logo, coach, your record against them, a box per game for wins and losses, and games left. Click a header to collapse it.
- **Filters:** All / To Play / Final tabs, plus coach pills you can switch on and off. Both are saved per coach page.
- **Checkpoint tracker:** games left, a progress bar and a countdown that turns red as the deadline gets close.
- **Quick actions:** **Log Game** and **Box Score** sit right next to each game.
- **Clear home and away rows:** home rows are lighter and away rows are darker.
- **Team info at a glance:** division rank, record splits, goal difference, and the full league directory with coaches.

## Development

- `nhl94-its-in-the-script.user.js`: the whole script. It has a page router (`PAGE`), shared data scraping, one renderer per page and version (`renderHomeV1`, `renderCoachV1`, …), and the version switcher.
- `dev/preview.sh [team_ID|home] [view]`: draws a live coach page with the script injected using headless Chrome, and saves a screenshot to `dev/out/`.
- Local live editing: install a small Tampermonkey script that `@require`s `file:///path/to/nhl94-its-in-the-script.user.js`. In Chrome you also need to turn on *Allow access to file URLs* for Tampermonkey. Edits then show up when you refresh the page.

**Releasing:** raise `@version` in the script header (semver) with every change you push to `main`. That's how Tampermonkey knows to update.

*Fan-made and not affiliated with EA Sports, the NHL or nhl94online.com.*
