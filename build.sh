#!/bin/bash
set -e

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/genshin-resin@snql"

echo "==> Compiling GSettings schema..."
glib-compile-schemas schemas/

echo "==> Schema compiled. To install, run ./install.sh"
