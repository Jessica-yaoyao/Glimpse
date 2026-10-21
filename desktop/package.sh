#!/usr/bin/env bash
set -euo pipefail
GLIMPSE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GLIMPSE_OUTPUT="${1:-$GLIMPSE_ROOT/.build/macos}"
GLIMPSE_APP="$GLIMPSE_OUTPUT/灵感显影 Glimpse.app"
GLIMPSE_BUILD="$GLIMPSE_ROOT/.build/desktop"
mkdir -p "$GLIMPSE_APP/Contents/MacOS" "$GLIMPSE_APP/Contents/Resources/WebAssets" "$GLIMPSE_BUILD/AppIcon.iconset"
if command -v node >/dev/null 2>&1; then GLIMPSE_NODE="$(command -v node)"; else GLIMPSE_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
"$GLIMPSE_NODE" "$GLIMPSE_ROOT/desktop/build-web.cjs" "$GLIMPSE_APP/Contents/Resources/WebAssets"
cp "$GLIMPSE_ROOT/desktop/Info.plist" "$GLIMPSE_APP/Contents/Info.plist"
cp "$GLIMPSE_ROOT/desktop/resources/mainland-map-region.json" "$GLIMPSE_APP/Contents/Resources/"
cp "$GLIMPSE_ROOT/desktop/resources/glimpse-photo-grounding-v1.md" "$GLIMPSE_APP/Contents/Resources/"
cp "$GLIMPSE_ROOT/desktop/resources/Xiaolai-Regular.ttf" "$GLIMPSE_APP/Contents/Resources/"
mkdir -p "$GLIMPSE_APP/Contents/Resources/Licenses"
cp "$GLIMPSE_ROOT/desktop/licenses/"*.txt "$GLIMPSE_APP/Contents/Resources/Licenses/"
for arch in x86_64 arm64; do
  xcrun swiftc -O -target "$arch-apple-macosx13.0" -framework AppKit -framework WebKit -framework Security -framework ImageIO -framework CryptoKit -framework MapKit -framework CoreLocation -framework Vision -framework AVFoundation "$GLIMPSE_ROOT/desktop/Glimpse.swift" "$GLIMPSE_ROOT/desktop/Camera.swift" "$GLIMPSE_ROOT/desktop/Presentation.swift" "$GLIMPSE_ROOT/desktop/KimiSettings.swift" "$GLIMPSE_ROOT/desktop/KimiUsage.swift" "$GLIMPSE_ROOT/desktop/KimiReveal.swift" "$GLIMPSE_ROOT/desktop/ContourExtractor.swift" "$GLIMPSE_ROOT/desktop/ContourInstructions.swift" "$GLIMPSE_ROOT/desktop/InspirationStore.swift" "$GLIMPSE_ROOT/desktop/MapLocation.swift" "$GLIMPSE_ROOT/desktop/MapCoordinates.swift" -o "$GLIMPSE_BUILD/Glimpse-$arch"
done
lipo -create "$GLIMPSE_BUILD/Glimpse-x86_64" "$GLIMPSE_BUILD/Glimpse-arm64" -output "$GLIMPSE_APP/Contents/MacOS/Glimpse"
bash "$GLIMPSE_ROOT/desktop/package-icon.sh" "$GLIMPSE_APP/Contents/Resources/AppIcon.icns" "$GLIMPSE_BUILD"
xattr -dr com.apple.FinderInfo "$GLIMPSE_APP" 2>/dev/null || true
xattr -dr com.apple.ResourceFork "$GLIMPSE_APP" 2>/dev/null || true
codesign --force --deep --sign - "$GLIMPSE_APP"
plutil -lint "$GLIMPSE_APP/Contents/Info.plist"
echo "$GLIMPSE_APP"
