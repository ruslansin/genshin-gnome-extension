#!/bin/bash
set -e

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/genshin-resin@snql"

echo "==> Generating module metadata..."

{
    echo 'export const MODULE_KEYS = ['
    # Default order matching the static imports in index.js
    for key in resin commissions bosses expeditions currency transformer; do
        echo "  '$key',"
    done
    echo '];'
    echo

    echo 'export const MODULE_LABELS = {'
    for f in modules/*.js; do
        name=$(basename "$f" .js)
        case "$name" in
            index|module|util|account-name|error|metadata) continue ;;
        esac
        k=$(grep "^export const key " "$f" | sed "s/.*'\(.*\)';/\1/")
        l=$(grep "^export const label " "$f" | sed "s/.*'\(.*\)';/\1/")
        [ -n "$k" ] && [ -n "$l" ] && echo "  $k: '$l',"
    done
    echo '};'
} > modules/metadata.js

echo "==> Compiling GSettings schema..."
glib-compile-schemas schemas/

echo "==> Schema compiled. To install, run ./install.sh"
