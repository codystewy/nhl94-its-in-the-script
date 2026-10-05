#!/usr/bin/env bash
# Render a real nhl94online.com coach page with the userscript injected, using headless Chrome.
# Usage: dev/preview.sh [team_ID|home] [view] [width] [height]
#   team_ID  a coach page team_ID (default 6714 = Calgary, SNES-CD, Classic '94-2026 Fall), or "home"
#            for the home page (set SUBLG=SNES-CD etc. to pick the scores level)
#   view     classic | v1 | ...  (defaults to newest)
#   SCRIPT=path  inject a different build (e.g. dev/out/nhl94-its-in-the-script.latest.user.js)
#   EXTRA_JS='...' runs before the script (e.g. preset filters: localStorage.setItem("nx:mode:", '"done"'))
#   INTRO=1  show the first-visit My Leagues intro; INTRO=dc the Discord DM intro (both skipped by default so screenshots stay clean)
#   MYLEAGUES='[{"path":"/html/coachpage.php?lg=287&sublg=SNES-CD&team_ID=6714","team":"Calgary","coach":"Stewy","league":"Classic \'94-2026 Fall"}]'
#            seeds My Leagues (stored via the localStorage fallback, since there's no Tampermonkey here)
# Output: dev/out/preview-<team_ID>-<view>.png
set -euo pipefail

TEAM="${1:-6714}"
VIEW="${2:-}"
W="${3:-1440}"
H="${4:-1600}"
LG="${LG:-287}"
SUBLG="${SUBLG:-SNES-CD}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dev/out"
mkdir -p "$OUT"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [ "$TEAM" = "home" ]; then
  URL="https://www.nhl94online.com/index.php?lg=$LG&sublg=$SUBLG"; TPATH="/index.php"; BASE="https://www.nhl94online.com/"
else
  URL="https://nhl94online.com/html/coachpage.php?lg=$LG&sublg=$SUBLG&team_ID=$TEAM"; TPATH="/html/coachpage.php"; BASE="https://nhl94online.com/html/"
fi
curl -sL "$URL" -o "$OUT/page.html"

python3 - "${SCRIPT:-$ROOT/nhl94-its-in-the-script.user.js}" "$OUT/page.html" "$OUT/test.html" "$VIEW" "$TPATH" "$BASE" "${MYLEAGUES:-}" "$URL" <<'EOF'
import sys, json, os
js_path, src, out, view, tpath, base, myleagues, url = sys.argv[1:9]
js = open(js_path, encoding='utf-8').read()
s = open(src, encoding='latin-1').read()
s = s.replace('charset=iso-8859-1', 'charset=utf-8').replace('<head>', f'<head><base href="{base}">', 1)
pre = f'window.__nxTestPath={json.dumps(tpath)};window.__nxTestHref={json.dumps(url)};localStorage.clear();' + ('' if os.environ.get('INTRO') == '1' else 'localStorage.setItem("nx:mlIntro","true");') + ('' if os.environ.get('INTRO') == 'dc' else 'localStorage.setItem("nx:dcIntro","true");') + (f'localStorage.setItem("nx:view",{json.dumps(json.dumps(view))});' if view else '')
if myleagues:
    pre += f'localStorage.setItem("nx:gm:myLeagues",{json.dumps(myleagues)});'
import os
pre += os.environ.get('EXTRA_JS', '')
s = s.replace('</body>', '<script>' + pre + 'window.addEventListener("load",()=>{try{' + js +
              '}catch(e){document.title="SCRIPT ERROR: "+e.message}});</script></body>')
open(out, 'w', encoding='utf-8').write(s)
EOF

NAME="preview-$TEAM-${VIEW:-default}.png"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$W,$H" --virtual-time-budget="${VTIME:-6000}" \
  --screenshot="$OUT/$NAME" "file://$OUT/test.html" >/dev/null 2>&1
TITLE=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 --dump-dom "file://$OUT/test.html" 2>/dev/null | grep -o '<title>[^<]*</title>' || true)
echo "$TITLE"
echo "$OUT/$NAME"
