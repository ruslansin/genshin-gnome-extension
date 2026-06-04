#!/bin/bash
set -e

EXT_UUID="genshin-resin@snql"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"

echo "==> Disabling extension..."
gnome-extensions disable "$EXT_UUID" 2>/dev/null || true

echo "==> Removing extension directory..."
rm -rf "$EXT_DIR"

echo "==> Uninstalled. Restart GNOME Shell to complete."
