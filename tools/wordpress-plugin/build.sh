#!/usr/bin/env bash
# Package the Immortel Schema Bridge plugin into public/downloads/ for customers to install.
#
# Usage: tools/wordpress-plugin/build.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_SLUG="immortel-schema-bridge"
OUT_DIR="$REPO_ROOT/public/downloads"
OUT_FILE="$OUT_DIR/$PLUGIN_SLUG.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

# Zip from the parent so the archive contains a single top-level plugin directory,
# which is what WordPress's plugin uploader expects.
cd "$SCRIPT_DIR"
zip -r -q -X "$OUT_FILE" "$PLUGIN_SLUG" \
  -x '*.DS_Store' -x '__MACOSX/*'

echo "Built $OUT_FILE"
unzip -l "$OUT_FILE"
