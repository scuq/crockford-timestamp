#!/bin/bash
# build.sh - builds the release archive of the Crockford Clock extension.
#
# Usage: [VERSION=X.Y.Z] ./build.sh
# Exit status: 0 if the archive is complete, 2 if VERSION is not valid,
# other nonzero values if a step failed.
#
# The build writes crockford-clock@scuq.github.io.shell-extension.zip.
# To install the archive, run: gnome-extensions install --force ARCHIVE
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${VERSION:-0.0.0}"
UUID="crockford-clock@scuq.github.io"
ARCHIVE="$PWD/$UUID.shell-extension.zip"

# The key "version-name" accepts letters, numbers, spaces, and periods.
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION \"$VERSION\" is not valid. Use the form X.Y.Z, for example 1.2.3." >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# install.sh tests the codec and copies the files of the extension.
# Thus the archive holds the same files as a local installation.
XDG_DATA_HOME="$WORK" ./install.sh > /dev/null
cd "$WORK/gnome-shell/extensions/$UUID"

python3 - metadata.json "$VERSION" <<'PY'
import json
import sys

path, version = sys.argv[1:]
with open(path, encoding="utf-8") as file:
    metadata = json.load(file)
metadata["version-name"] = version
with open(path, "w", encoding="utf-8") as file:
    json.dump(metadata, file, indent=2)
    file.write("\n")
PY

rm -f "$ARCHIVE"
python3 -m zipfile -c "$ARCHIVE" ./*

echo "Built $(basename "$ARCHIVE") $VERSION."
