# Architecture

GNOME Shell extension (`genshin-resin@snql`) that displays Genshin Impact resin and other game data in the top panel, fetched from the HoYoLAB API.

Targets GNOME Shell 49-50. Pure JavaScript (ESM), no TypeScript, no bundlers.

## Directory Structure

```
.
├── extension.js            # Entry point: enable() / disable()
├── accountWidget.js        # Per-account panel indicator + menu
├── prefs.js                # GTK preferences dialog
├── metadata.json           # Extension metadata (uuid, shell-version)
├── stylesheet.css          # Panel indicator styles
├── modules/
│   ├── index.js            # Re-exports + MODULE_REGISTRY
│   ├── module.js           # Base Module class
│   ├── util.js             # NotifyGuard, time formatters
│   ├── metadata.js         # MODULE_KEYS, MODULE_LABELS, MODULE_NOTIFICATIONS
│   ├── i18n.js             # Translation (15 languages)
│   ├── resin.js            # Resin tracker
│   ├── commissions.js      # Daily commissions
│   ├── bosses.js           # Weekly bosses
│   ├── expeditions.js      # Expeditions
│   ├── currency.js         # Realm currency
│   ├── transformer.js      # Parametric transformer
│   ├── daily.js            # Daily check-in (separate API)
│   ├── abyss.js            # Spiral Abyss (separate API)
│   ├── exploration.js      # Exploration progress (separate API)
│   ├── theater.js          # Imaginarium Theater (separate API)
│   ├── error.js            # Error display in menu
│   └── account-name.js     # Account name label in menu
├── schemas/
│   └── org.gnome.shell.extensions.genshin-resin.gschema.xml
├── translations/           # JSON locale files
├── assets/
│   └── resin.svg           # Panel icon
├── build.sh                # Compile GSettings schema
├── install.sh              # Install locally
├── publish.sh              # Package for extensions.gnome.org
└── dev.sh                  # Nested GNOME Shell session
```

## Entry Point & Lifecycle

`extension.js` — class `GenshinResinExtension` extends `Extension`.

### enable()

1. Creates a `Soup.Session` for HTTP
2. Loads accounts from GSettings JSON
3. For each account, creates an `AccountWidget` and adds it to `Main.panel` via `addToStatusArea()`
4. Sets up three GLib timeouts:
   - **Poll** (default 300s): `_fetchAll()` — fetches fresh data from API
   - **Label** (60s): `_updateAllLabels()` — recalculates panel label text
   - **Tick** (1s): `_updateAllTicks()` — updates countdown timers
5. Connects to settings changes (accounts, show-account-name, language)

### disable()

Removes all timeouts, aborts pending HTTP requests, disconnects settings signals, destroys widgets.

## Core Architecture

### AccountWidget (`accountWidget.js`)

One per configured account. Owns:
- A `PanelMenu.Button` indicator shown in the top panel (icon + label)
- A popup menu with `PopupMenu.PopupMenuItem` items, one per module
- An `AccountNameModule` at the top and `ErrorModule` for errors at the bottom
- Menu actions: "Refresh Now", "Preferences"

**Panel label** shows `name: current/max` (e.g. `160/200`). Color-coded: yellow at ≥90%, green at full, default otherwise. Amber when showing cached data.

### Module System

Each game feature is a `Module` subclass (`modules/module.js`):

```js
class Module {
    constructor(menu, session, account)
    build()       // create PopupMenuItem, add to menu
    update(data)  // receive API response data, update label
    clear()       // reset state
    destroy()     // destroy menu items
}
```

**Module registry** (`modules/index.js`): `MODULE_REGISTRY` maps keys → constructors. `MODULE_KEYS` defines the default display order. The `_normalizeOrder()` method in `AccountWidget` respects user-configured ordering, appending any missing modules at the end.

**Per-account toggles**: Each module can be individually disabled via `account.modules[moduleKey] = false`.

### Data Flow

```
GLib timeout (300s)
  └─ extension._fetchAll()
        └─ widget.fetch() for each AccountWidget
              └─ HTTP GET → HoYoLAB dailyNote API
              └─ _onResponse() → parse JSON → updateDisplay(data)
                    └─ For each module instance: inst.update(data)
                          └─ Module builds label text from data
                          └─ NotifyGuard.check() may fire notification
                    └─ _saveCachedData() to GSettings
```

**Caching**: Last successful API response is stored per-UID in the `last-data` GSettings key. On startup or account change, cached data is loaded immediately so the panel shows values before the first API response arrives. The label is tinted amber when showing cached data.

### Module-Specific API Calls

Most modules use the `dailyNote` API data passed through `update(data)`. Three modules fetch their own APIs:

| Module | API Base | Endpoint | Rate Limit |
|--------|----------|----------|------------|
| `daily.js` | `sg-hk4e-api.hoyolab.com/event/sol` | `/info` | Fetched every 1200s |
| `abyss.js` | `sg-public-api.hoyolab.com/event/game_record/genshin/api` | `/spiralAbyss` | Fetched every 3600s |
| `exploration.js` | `sg-public-api.hoyolab.com/event/game_record/genshin/api` | `/index` | Fetched every 3600s |
| `theater.js` | `sg-public-api.hoyolab.com/event/game_record/genshin/api` | `/role_combat` | Fetched every 3600s |

Each uses a DS (Dynamic Secret) header generated from `MD5(salt=...&t=&r=)` for request signing.

## Notification System

`modules/util.js` — `NotifyGuard` class implements one-shot fire-once semantics:

- **`arm()`** — enables notifications (called after first successful data load)
- **`check(key, condition, title, body, enabled)`** — if condition is true and guard hasn't fired for this key yet, calls `Main.notify()`. The flag resets when condition becomes false, allowing re-fire.
- **`checkAction(key, condition, title, body, enabled, callback)`** — same as `check()` but creates a `MessageTray.Notification` with an `activated` signal handler. Only `daily.js` uses this (click to open HoYoLAB check-in page).

**Modules with notifications**: resin, expeditions, currency, transformer, daily.

## APIs Used

All requests go through `Soup.Session` with:
- `x-rpc-app_version: 1.5.0`
- `x-rpc-client_type: 5`
- `Referer: https://act.hoyolab.com/`
- Cookie: `ltuid_v2`, `ltoken_v2`, `ltmid_v2`, `account_id_v2`, `cookie_token_v2`
- DS header (MD5-based dynamic secret)

## Preferences

`prefs.js` — GTK4/Adw preferences dialog. Configure:

- Accounts (add/edit/remove) with cookies, UID, server region
- Per-account module toggles and sort order
- Notification bell toggles for each notifiable module
- Poll interval, panel position, language, show-account-name

Settings stored in GSettings schema `org.gnome.shell.extensions.genshin-resin`.

## Build & Install

```bash
./build.sh    # Compile GSettings schema
./install.sh  # Install to ~/.local/share/gnome-shell/extensions/
./publish.sh  # Package into genshin-resin@snql.zip
./dev.sh      # Launch nested GNOME Shell for testing
```
