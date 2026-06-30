#!/bin/bash
# Builds ArchIpelago.app — a standalone, double-clickable agent app.
set -e
cd "$(dirname "$0")"

swift build -c release

APP="ArchIpelago.app"
BIN_DIR="$APP/Contents/MacOS"
RES_DIR="$APP/Contents/Resources"
rm -rf "$APP"
mkdir -p "$BIN_DIR" "$RES_DIR"

cp ".build/release/ArchIpelago" "$BIN_DIR/ArchIpelago"
# Bundle.module finds the resource bundle next to the executable.
cp -R ".build/release/ArchIpelago_ArchIpelago.bundle" "$BIN_DIR/"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>ArchIpelago</string>
  <key>CFBundleIdentifier</key><string>com.jorge.archipelago</string>
  <key>CFBundleName</key><string>ArchIpelago</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>ArchIpelago</string>
</dict>
</plist>
PLIST

# Ad-hoc codesign so the bundle is launchable.
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "Built $APP"
