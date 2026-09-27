#!/bin/bash
# Builds CrockfordBar.app with the Command Line Tools (no Xcode needed).
set -euo pipefail
cd "$(dirname "$0")"

APP="CrockfordBar.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"

swiftc -parse-as-library -O CrockfordBar.swift \
  -o "$APP/Contents/MacOS/CrockfordBar"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>CrockfordBar</string>
  <key>CFBundleIdentifier</key><string>local.crockford.bar</string>
  <key>CFBundleName</key><string>CrockfordBar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

# Ad-hoc signature so macOS accepts the local bundle.
codesign --force --sign - "$APP"

echo "Built $APP. Start it with: open $APP"
