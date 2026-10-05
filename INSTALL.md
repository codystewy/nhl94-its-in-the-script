# How to install

It takes about two minutes. You install **Tampermonkey** (a free browser extension that runs userscripts), then install this script with one click. It updates itself after that.

Jump to: [Pick a channel](#pick-a-channel) · [Chrome](#google-chrome) · [Brave](#brave) · [Firefox](#firefox) · [Microsoft Edge](#microsoft-edge) · [Switching channels](#switching-channels)

---

## Pick a channel

The script comes in three flavours. They all look and work the same way. The difference is how often they change. **Install just one.**

| Channel | Who it's for | Install |
| --- | --- | --- |
| 🥅 **Stable** (recommended) | Most people. You only get updates when a new version is released. | **[Install Stable](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/stable/nhl94-its-in-the-script.user.js)** |
| ⚡ **Latest** | You want every new feature and fix the moment it's made. Might wobble now and then. | **[Install Latest](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/latest/nhl94-its-in-the-script.latest.user.js)** |
| 🎉 **Fun** | Everything in Latest, plus playful extras we try out first. | **[Install Fun](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/fun/nhl94-its-in-the-script.fun.user.js)** |

Not sure? Pick **Stable**. You can switch any time.

---

## Google Chrome

1. **Install Tampermonkey.** Open the [Tampermonkey page on the Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) and click **Add to Chrome**, then **Add extension**.
2. **Pin it (optional, but handy).** Click the puzzle-piece icon 🧩 in the toolbar, then the pin next to Tampermonkey.
3. **Turn on "Allow User Scripts".** This step is required on Chrome 138 and newer; without it the script won't run.
   - Right-click the Tampermonkey icon, then click **Manage extension**. You can also go to `chrome://extensions` and click **Details** under Tampermonkey.
   - Turn on **Allow User Scripts**.
   - On older Chrome versions that don't have this toggle, turn on **Developer mode** (top-right of `chrome://extensions`) instead.
4. **Install the script.** Click the install link for [your channel](#pick-a-channel). Most people want **[Install Stable](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/stable/nhl94-its-in-the-script.user.js)**. Tampermonkey opens an install screen. Click **Install**.
5. **Check it works.** Open [nhl94online.com](https://www.nhl94online.com). You should see the new look and a **VIEW · Classic · V1** switcher in the bottom-right corner.

## Brave

Brave is built on Chrome, so the steps are almost the same.

1. Open the [Tampermonkey page on the Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) in Brave and click **Add to Brave**, then **Add extension**.
2. Go to `brave://extensions`, click **Details** under Tampermonkey, and turn on **Allow User Scripts**. On older versions, turn on **Developer mode** in the top-right instead.
3. Click the install link for [your channel](#pick-a-channel) (most people want **[Stable](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/stable/nhl94-its-in-the-script.user.js)**), then **Install**.
4. Open [nhl94online.com](https://www.nhl94online.com).

> **Brave Shields:** the script runs on nhl94online.com itself, so Shields don't need to be lowered. If the page fonts look plain, Shields may be blocking Google Fonts. Everything still works.

## Firefox

Firefox doesn't need an extra toggle.

1. Open [Tampermonkey on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) and click **Add to Firefox**, then **Add**.
2. Optional: when Firefox asks, allow Tampermonkey to run in private windows if you browse that way.
3. Click the install link for [your channel](#pick-a-channel) (most people want **[Stable](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/stable/nhl94-its-in-the-script.user.js)**), then **Install**.
4. Open [nhl94online.com](https://www.nhl94online.com).

## Microsoft Edge

1. Open [Tampermonkey on Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) and click **Get**, then **Add extension**.
2. Go to `edge://extensions`, click **Details** under Tampermonkey, and turn on **Allow User Scripts**. If you don't see that toggle, turn on **Developer mode** in the left sidebar instead.
3. Click the install link for [your channel](#pick-a-channel) (most people want **[Stable](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/stable/nhl94-its-in-the-script.user.js)**), then **Install**.

---

## Using it

- **Switch looks:** use the **VIEW** switcher in the bottom-right corner (**Classic** is the original site), or press **Alt + Shift + V**.
- **Pin your team:** on your coach page, press **☆ Set as my team**. The home page then shows a shortcut to your schedule.
- **Which channel am I on?** Look at the far right of the VIEW switcher. Stable shows just the version (`v1.4.1`). Latest and Fun show a longer number plus a gold **LATEST** or **FUN** tag (`v1.4.1.57 LATEST`).
- **Updates** arrive on their own. Tampermonkey checks for a new version about once a day. To check right away, open the Tampermonkey dashboard and do one of these:
  - On the **Installed userscripts** tab, click the date in the **Last updated** column next to the script.
  - Or go to **Utilities** and click **Check for userscript updates**.

## Switching channels

Each channel shows up in Tampermonkey as its own script: *NHL94 – It's In The Script*, *… (Latest)* or *… (Fun)*. To switch:

1. Open the Tampermonkey dashboard (click the Tampermonkey icon → **Dashboard**).
2. Turn **off** the channel you're leaving with its toggle, or delete it with the trash-can icon.
3. Click the install link for the new channel in [Pick a channel](#pick-a-channel), then **Install**.
4. Reload nhl94online.com and check the label at the right end of the VIEW switcher.

Your saved stuff (My Leagues, filters, Day/Night, view) is shared, so it comes with you when you switch.

> If two channels are switched on at once, only one of them runs. It's still cleaner to keep just one on.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The site looks unchanged and there's no VIEW switcher | Chrome, Brave or Edge: turn on **Allow User Scripts** (step 3 above), then reload the page. Also check the script is switched **on** in the Tampermonkey dashboard. |
| Tampermonkey's icon shows a warning about Developer mode | Same fix: turn on **Allow User Scripts** for Tampermonkey. |
| Clicking the install link just shows code | Tampermonkey isn't installed or is turned off. Install it, then click the link again. |
| Only some pages look different | That's expected. Pages are redesigned one at a time, and the rest stay classic for now. |
| I want the old site back | Click **Classic** in the VIEW switcher. Or turn the script off in Tampermonkey. |
| I switched channels but nothing changed | Make sure only one channel is switched on in the dashboard, then reload. The label at the right end of the VIEW switcher shows which one is running. |
| Uninstall | Tampermonkey dashboard → trash-can icon next to the script. |
