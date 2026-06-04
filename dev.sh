#!/bin/bash
set -e
# Run a nested GNOME Shell session for testing the extension
# Changes to extension.js load immediately - just disable/enable in the nested session

echo "==> Starting nested GNOME Shell for development..."
echo "    In the nested window, open a terminal and run:"
echo "      gnome-extensions enable genshin-resin@snql"
echo "    To reload after code changes: disable + enable the extension."
echo "    Close the nested window to exit."

dbus-run-session gnome-shell --devkit --wayland
