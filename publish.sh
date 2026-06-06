#!/bin/bash
set -e

EXT_UUID="genshin-resin@snql"
ZIP_FILE="${EXT_UUID}.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$(mktemp -d)"

echo "==> Compiling GSettings schema and generating module metadata..."
"$SCRIPT_DIR/build.sh"

echo "==> Copying files to staging..."
cp "$SCRIPT_DIR/metadata.json"      "$BUILD_DIR/"
cp "$SCRIPT_DIR/extension.js"       "$BUILD_DIR/"
cp "$SCRIPT_DIR/prefs.js"           "$BUILD_DIR/"
cp "$SCRIPT_DIR/accountWidget.js"   "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/modules"         "$BUILD_DIR/"
cp "$SCRIPT_DIR/stylesheet.css"     "$BUILD_DIR/"
cp -r "$SCRIPT_DIR/translations"    "$BUILD_DIR/"
mkdir -p "$BUILD_DIR/schemas"
cp "$SCRIPT_DIR/schemas"/*.xml  "$BUILD_DIR/schemas/"
mkdir -p "$BUILD_DIR/assets"
cp "$SCRIPT_DIR/assets/resin.svg" "$BUILD_DIR/assets/"

echo "==> Creating $ZIP_FILE..."
rm -f "$SCRIPT_DIR/$ZIP_FILE"
(cd "$BUILD_DIR" && zip -r "$SCRIPT_DIR/$ZIP_FILE" .)

echo "==> Cleaning up..."
rm -rf "$BUILD_DIR"

if command -v shexli &>/dev/null || [ -x "$SCRIPT_DIR/venv/bin/shexli" ]; then
    echo "==> Running shexli lint..."
    shexli_cmd="${SCRIPT_DIR}/venv/bin/shexli"
    command -v shexli &>/dev/null && shexli_cmd="shexli"
    set +e
    "$shexli_cmd" "$SCRIPT_DIR/$ZIP_FILE"
    set -e
fi

echo ""
echo "==> Done! Upload $ZIP_FILE to https://extensions.gnome.org/upload/"
