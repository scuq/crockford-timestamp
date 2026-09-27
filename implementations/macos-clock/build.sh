#!/bin/bash
# build.sh - builds CrockfordBar.app and CrockfordClock.app.
#
# Usage: [VERSION=X.Y.Z] ./build.sh
# Exit status: 0 if the build is complete, 2 if VERSION is not valid,
# other nonzero values if a step failed.
#
# The build uses the Command Line Tools and does not need Xcode.
# Each app is a universal binary for arm64 and x86_64.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${VERSION:-0.0.0}"
MACOS="13.0"

# CFBundleShortVersionString accepts only three numbers.
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION \"$VERSION\" is not valid. Use the form X.Y.Z, for example 1.2.3." >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Builds one app bundle. Arguments: name, source file, bundle identifier,
# and "true" for an app without a Dock icon or "false" for a usual app.
build_app() {
  local name="$1" source="$2" identifier="$3" agent="$4"
  local app="$name.app"
  local arch

  rm -rf "$app"
  mkdir -p "$app/Contents/MacOS"

  for arch in arm64 x86_64; do
    swiftc -parse-as-library -O -target "$arch-apple-macos$MACOS" \
      "$source" -o "$WORK/$name-$arch"
  done
  lipo -create "$WORK/$name-arm64" "$WORK/$name-x86_64" \
    -output "$app/Contents/MacOS/$name"

  cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>$name</string>
  <key>CFBundleIdentifier</key><string>$identifier</string>
  <key>CFBundleName</key><string>$name</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>$MACOS</string>
  <key>LSUIElement</key><$agent/>
</dict>
</plist>
PLIST

  # Ad-hoc signature so macOS accepts the local bundle.
  codesign --force --sign - "$app"

  echo "Built $app $VERSION. Start it with: open $app"
}

build_app CrockfordBar CrockfordBar.swift local.crockford.bar true
build_app CrockfordClock CrockfordClockApp.swift local.crockford.clock false
