#!/usr/bin/env bash
# Render a real nhl94online.com coach page with the userscript injected, using headless Chrome.
# Usage: dev/preview.sh [team_ID] [view] [width] [height]
#   team_ID  defaults to 6714 (Calgary, SNES-CD, Classic '94-2026 Fall)
#   view     classic | v1 | ...  (defaults to newest)
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

curl -sL "https://nhl94online.com/html/coachpage.php?lg=$LG&sublg=$SUBLG&team_ID=$TEAM" -o "$OUT/page.html"

python3 - "$ROOT/nhl94-its-in-the-script.user.js" "$OUT/page.html" "$OUT/test.html" "$VIEW" <<'EOF'
import sys, json
js_path, src, out, view = sys.argv[1:5]
js = open(js_path, encoding='utf-8').read()
s = open(src, encoding='latin-1').read()
s = s.replace('charset=iso-8859-1', 'charset=utf-8').replace('<head>', '<head><base href="https://nhl94online.com/html/">', 1)
pre = 'localStorage.clear();' + (f'localStorage.setItem("nx:view",{json.dumps(json.dumps(view))});' if view else '')
s = s.replace('</body>', '<script>' + pre + 'window.addEventListener("load",()=>{try{' + js +
              '}catch(e){document.title="SCRIPT ERROR: "+e.message}});</script></body>')
open(out, 'w', encoding='utf-8').write(s)
EOF

NAME="preview-$TEAM-${VIEW:-default}.png"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="$W,$H" --virtual-time-budget=6000 \
  --screenshot="$OUT/$NAME" "file://$OUT/test.html" >/dev/null 2>&1
TITLE=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 --dump-dom "file://$OUT/test.html" 2>/dev/null | grep -o '<title>[^<]*</title>' || true)
echo "$TITLE"
echo "$OUT/$NAME"
