#!/bin/bash
# install.sh - installs the Crockford Clock extension for the current user.
#
# Usage: ./install.sh
# Exit status: 0 if the installation is complete, nonzero if a step failed.
set -euo pipefail
cd "$(dirname "$0")"

UUID="crockford-clock@scuq.github.io"
TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"

# Do not install a codec that fails its tests.
gjs -m test.js > /dev/null || {
  echo "The codec tests failed. Run: gjs -m test.js" >&2
  exit 1
}

rm -rf "$TARGET"
mkdir -p "$TARGET"
cp metadata.json extension.js codec.js \
  layout.css stylesheet-dark.css stylesheet-light.css "$TARGET/"

echo "Installed $UUID in $TARGET."
echo "Log out and log in again. Then run: gnome-extensions enable $UUID"
