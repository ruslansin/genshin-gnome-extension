# AGENTS.md

GNOME Shell extension for Genshin Impact resin tracking.

## Commands

```bash
# Build GSettings schema
./build.sh

# Install locally
./install.sh

# Package for extensions.gnome.org
./publish.sh

# Run static analysis before uploading
python3 -m venv venv && . venv/bin/activate && pip install -U shexli && shexli genshin-resin@snql.zip

# Development (nested GNOME Shell session)
./dev.sh
```

## Conventions

- Pure JavaScript (ESM), no TypeScript
- No npm, no bundlers — just `glib-compile-schemas`
- Follow GNOME Shell extension review guidelines (gjs.guide/extensions/review-guidelines)
- Always run `shexli` on the ZIP before uploading to e.g.o.
