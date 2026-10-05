# How to install

It takes about two minutes. You install **Tampermonkey** (a free browser extension that runs userscripts), then install this script with one click. It updates itself after that.

Jump to your browser: [Chrome](#google-chrome) · [Brave](#brave) · [Firefox](#firefox) · [Microsoft Edge](#microsoft-edge)

---

## Google Chrome

1. **Install Tampermonkey.** Open the [Tampermonkey page on the Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) and click **Add to Chrome**, then **Add extension**.
2. **Pin it (optional, but handy).** Click the puzzle-piece icon 🧩 in the toolbar, then the pin next to Tampermonkey.
3. **Turn on "Allow User Scripts".** This step is required on Chrome 138 and newer; without it the script won't run.
   - Right-click the Tampermonkey icon, then click **Manage extension**. You can also go to `chrome://extensions` and click **Details** under Tampermonkey.
   - Turn on **Allow User Scripts**.
   - On older Chrome versions that don't have this toggle, turn on **Developer mode** (top-right of `chrome://extensions`) instead.
4. **Install the script.** Click **[Install NHL94 – It's In The Script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**. Tampermonkey opens an install screen. Click **Install**.
5. **Check it works.** Open [nhl94online.com](https://www.nhl94online.com). You should see the new look and a **VIEW · Classic · V1** switcher in the bottom-right corner.

## Brave

Brave is built on Chrome, so the steps are almost the same.

1. Open the [Tampermonkey page on the Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) in Brave and click **Add to Brave**, then **Add extension**.
2. Go to `brave://extensions`, click **Details** under Tampermonkey, and turn on **Allow User Scripts**. On older versions, turn on **Developer mode** in the top-right instead.
3. Click **[Install the script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**, then **Install**.
4. Open [nhl94online.com](https://www.nhl94online.com).

> **Brave Shields:** the script runs on nhl94online.com itself, so Shields don't need to be lowered. If the page fonts look plain, Shields may be blocking Google Fonts. Everything still works.

## Firefox

Firefox doesn't need an extra toggle.

1. Open [Tampermonkey on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) and click **Add to Firefox**, then **Add**.
2. Optional: when Firefox asks, allow Tampermonkey to run in private windows if you browse that way.
3. Click **[Install the script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**, then **Install**.
4. Open [nhl94online.com](https://www.nhl94online.com).

## Microsoft Edge

1. Open [Tampermonkey on Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) and click **Get**, then **Add extension**.
2. Go to `edge://extensions`, click **Details** under Tampermonkey, and turn on **Allow User Scripts**. If you don't see that toggle, turn on **Developer mode** in the left sidebar instead.
3. Click **[Install the script](https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/main/nhl94-its-in-the-script.user.js)**, then **Install**.

---

## Using it

- **Switch looks:** use the **VIEW** switcher in the bottom-right corner (**Classic** is the original site), or press **Alt + Shift + V**.
- **Pin your team:** on your coach page, press **☆ Set as my team**. The home page then shows a shortcut to your schedule.
- **Updates** arrive on their own. Tampermonkey checks for a new version about once a day. To check right away: open the Tampermonkey dashboard, go to the **Installed userscripts** tab, and click the version number.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The site looks unchanged and there's no VIEW switcher | Chrome, Brave or Edge: turn on **Allow User Scripts** (step 3 above), then reload the page. Also check the script is switched **on** in the Tampermonkey dashboard. |
| Tampermonkey's icon shows a warning about Developer mode | Same fix: turn on **Allow User Scripts** for Tampermonkey. |
| Clicking the install link just shows code | Tampermonkey isn't installed or is turned off. Install it, then click the link again. |
| Only some pages look different | That's expected. Pages are redesigned one at a time, and the rest stay classic for now. |
| I want the old site back | Click **Classic** in the VIEW switcher. Or turn the script off in Tampermonkey. |
| Uninstall | Tampermonkey dashboard → trash-can icon next to the script. |
