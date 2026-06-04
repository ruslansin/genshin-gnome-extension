#!/bin/bash
set -e

EXT_UUID="genshin-resin@snql"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Disabling extension (if enabled)..."
gnome-extensions disable "$EXT_UUID" 2>/dev/null || true

echo "==> Removing old installation..."
rm -rf "$EXT_DIR"

echo "==> Creating directory: $EXT_DIR"
mkdir -p "$EXT_DIR"

echo "==> Copying files..."
cp "$SCRIPT_DIR/metadata.json" "$EXT_DIR/"
cp "$SCRIPT_DIR/extension.js" "$EXT_DIR/"
cp "$SCRIPT_DIR/prefs.js" "$EXT_DIR/"
cp "$SCRIPT_DIR/stylesheet.css" "$EXT_DIR/"
cp -r "$SCRIPT_DIR/schemas" "$EXT_DIR/"

echo "==> Compiling GSettings schema..."
glib-compile-schemas "$EXT_DIR/schemas/"

echo "==> Enabling extension..."
gnome-extensions enable "$EXT_UUID" 2>/dev/null || true

echo ""
echo "==> Installation complete!"
echo "    Restart GNOME Shell (Alt+F2 → 'restart' on X11, or log out/in on Wayland)"
echo "    Then configure cookies via: gnome-extensions prefs $EXT_UUID"
