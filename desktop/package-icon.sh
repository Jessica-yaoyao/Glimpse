#!/usr/bin/env bash
set -euo pipefail
GLIMPSE_ICON_ROOT="$(cd "$(dirname "$0")" && pwd)"
GLIMPSE_ICON_OUTPUT="${1:?Provide the AppIcon.icns output path}"
GLIMPSE_ICON_WORK="${2:?Provide the icon build directory}"
mkdir -p "$GLIMPSE_ICON_WORK/AppIcon.iconset"
# Use the supplied square image intact: no crop, recoloring, or new artwork.
sips -z 1024 1024 "$GLIMPSE_ICON_ROOT/resources/AppIcon-source.png" --out "$GLIMPSE_ICON_WORK/icon.png" >/dev/null
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$GLIMPSE_ICON_WORK/icon.png" --out "$GLIMPSE_ICON_WORK/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$GLIMPSE_ICON_WORK/icon.png" --out "$GLIMPSE_ICON_WORK/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$GLIMPSE_ICON_WORK/AppIcon.iconset" -o "$GLIMPSE_ICON_OUTPUT"
