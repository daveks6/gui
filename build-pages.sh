#!/bin/bash
# Builds the static site published via GitHub Pages (served from ./docs).
#
# This mirrors what release_web.sh already does for the official web build
# (main.html -> index.html, chrome_serial.js blanked out so the Chrome-App-only
# chrome.storage/chrome.serial calls it guards never run in a plain browser
# tab) and additionally carries over the PWA files (manifest, service worker,
# icons) and the WebUSB fallback needed for Android Chrome.
#
# Re-run this after any change under css/, content/, js/, i18n/, images/,
# main.html, manifest.webmanifest or sw.js, then commit the resulting docs/.
set -euo pipefail
cd "$(dirname "$0")"

OUT="docs"
rm -rf "$OUT"
mkdir -p "$OUT"

cp -r css content js i18n images "$OUT"/
cp main.html "$OUT"/index.html
cp main.js manifest.json manifest.webmanifest sw.js cordova.js LICENSE presets.json PRESET_PID.txt "$OUT"/

# Chrome-App-only bridge; must be empty in the web build (see comment above).
: > "$OUT/js/chrome_serial.js"

touch "$OUT/.nojekyll"

# Visible build marker so a stale cache/CDN copy is obvious at a glance
# instead of having to guess from behavior. Shown top-right of the page.
BUILD_STAMP="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)-$(date -u +%Y%m%dT%H%M%SZ)"
BUILD_MARKER="<div style='position:fixed;top:0;right:0;z-index:99999;background:#000;color:#0f0;font:10px monospace;padding:2px 6px;opacity:.85;'>build $BUILD_STAMP</div></body>"
sed -i "s|</body>|$BUILD_MARKER|" "$OUT/index.html"

echo "Built $OUT/ - review with git status, then commit."
