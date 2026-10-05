#!/usr/bin/env bash
# Build an installable channel file from the main script.
# Usage: dev/build-channel.sh <latest|fun> [outdir]
# Output: <outdir>/nhl94-its-in-the-script.<channel>.user.js (default outdir: dev/out)
# Version is <@version>.<commit count>, so every push is newer than the last and newer than stable.
set -euo pipefail

CH="${1:?usage: dev/build-channel.sh <latest|fun> [outdir]}"
case "$CH" in latest) NAME="Latest" ;; fun) NAME="Fun" ;; *) echo "unknown channel: $CH" >&2; exit 1 ;; esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTDIR="${2:-$ROOT/dev/out}"
mkdir -p "$OUTDIR"
SRC="$ROOT/nhl94-its-in-the-script.user.js"
OUT="$OUTDIR/nhl94-its-in-the-script.$CH.user.js"

BASE=$(grep -m1 '^// @version' "$SRC" | awk '{print $3}')
COUNT=$(git -C "$ROOT" rev-list --count HEAD)
VER="$BASE.$COUNT"
URL="https://raw.githubusercontent.com/codystewy/nhl94-its-in-the-script/$CH/nhl94-its-in-the-script.$CH.user.js"

sed -E \
  -e "s|^(// @name +.*)$|\1 ($NAME)|" \
  -e "s|^(// @version +).*$|\1$VER|" \
  -e "s|^(// @updateURL +).*$|\1$URL|" \
  -e "s|^(// @downloadURL +).*$|\1$URL|" \
  -e "s|^(  const SCRIPT_VERSION = ').*(';)$|\1$VER\2|" \
  -e "s|^(  const CHANNEL = ').*(';)$|\1$CH\2|" \
  "$SRC" > "$OUT"

# Every stamp must have landed.
for want in "@name .*($NAME)" "@version +$VER" "@updateURL +$URL" "@downloadURL +$URL" "SCRIPT_VERSION = '$VER'" "CHANNEL = '$CH'"; do
  grep -Eq "$want" "$OUT" || { echo "build-channel: missing stamp: $want" >&2; exit 1; }
done
node --check "$OUT"
echo "$OUT ($VER)"
