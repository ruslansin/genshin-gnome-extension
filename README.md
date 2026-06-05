# Genshin Resin Tracker

GNOME Shell extension that shows your Genshin Impact real-time resources in the top panel using the official HoYoLAB API. Supports multiple accounts simultaneously.

## Features

- **Multi-account support** — track all your accounts at once, each with its own panel indicator
- **Per-account region** — Europe, America, Asia, TW/HK/MO selectable per account
- **Resin counter** in the GNOME top panel — `28/200` with time-to-full
- **Optional account name** on panel — toggle `Show Account Name` on or off
- **Color coding**: green (full), yellow (≥90%), red (error), default
- **Click menu** with full game resource overview:
  - Account name (when hidden on panel)
  - Resin count + time until full
  - Live next-resin countdown (per-second timer)
  - Daily commissions status
  - Weekly boss discount claims remaining
  - Expedition countdown timers per character
  - Realm currency + time until cap
  - Parametric Transformer status
- **Automatic refresh** via HoYoLAB Battle Chronicle API
- **Local interpolation** between API calls (1 resin per 8 minutes)
- **Modular architecture** — each feature is an independent module, easily toggled or extended

## Screenshots

Panel indicator (with name):
```
◆ Main: 28/200
```

Panel indicator (name hidden):
```
◆ 28/200
```

Click menu:
```
Main
───────────────────
◆ Resin: 28/200  → 22h 48m
↻ Next resin: 00:03:24
✔ Commissions: 4/4 (claimed)
⚔ Weekly Bosses: 3/3 remaining
───────────────────
Expeditions: 5/5
   ⏳ 02:34:11
   ⏳ 02:34:11
   ⏳ 02:34:11
   ⏳ 02:34:11
   ⏳ 02:34:11
───────────────────
⌂ Realm Currency: 630/2400  → 58h 20m
⚗ Transformer: Ready!
───────────────────
Refresh Now
Preferences
```

## Requirements

- GNOME Shell 49 or 50
- A HoYoLAB account with Battle Chronicle enabled

## Installation

```bash
git clone https://github.com/ruslansin/genshin-gnome-extension
cd genshin-gnome-extension
./install.sh
```

Then:
- **Wayland**: Log out and back in
- **X11**: Press `Alt+F2`, type `restart`, press Enter

## Setup

1. Open extension preferences:
   ```bash
   gnome-extensions prefs genshin-resin@snql
   ```

2. Navigate to the **Accounts** page

3. Click `+` to add an account, then fill in:
   - **Account Name** — display name for this account
   - **Genshin UID** — your in-game UID
   - **Server** — Europe / America / Asia / TW-HK-MO
   - **Cookies** — see below

4. Get HoYoLAB cookies:
   - Go to [hoyolab.com](https://www.hoyolab.com) and log in
   - Press `F12` → **Application** → **Cookies** → `https://www.hoyolab.com`
   - Copy the **values** for these cookies:
     - `ltuid_v2`
     - `ltoken_v2`
     - `ltmid_v2` (optional)
     - `account_id_v2`
     - `cookie_token_v2`
   - Paste them into the preferences fields

5. On the **General** page, optionally:
   - Toggle **Show Account Name** to hide names from the panel
   - Adjust panel section and position
   - Change the API poll interval

6. The indicator should show your resin count within ~30 seconds

## Development

### Commands

```bash
# Build GSettings schema
./build.sh

# Install locally
./install.sh

# Package for extensions.gnome.org
./publish.sh

# Run static analysis before uploading
python3 -m venv venv && . venv/bin/activate && pip install -U shexli && shexli genshin-resin@snql.zip

# Development with nested GNOME Shell session
./dev.sh
```

### Architecture

```
extension.js         — Thin controller, manages AccountWidgets + shared timers
accountWidget.js     — Per-account panel button + popup menu + API fetch
modules.js           — Feature modules (Resin, Commissions, Bosses, etc.)
prefs.js             — Preferences UI with multi-account management
```

Each module in `modules.js` extends the `Module` base class and owns its popup menu items. To disable a feature, set `module.enabled = false`.

## API

Uses the official HoYoLAB Battle Chronicle API with DS signature authentication. No third-party proxies — your cookies go directly to HoYoverse servers. The `server` query parameter routes requests to the correct game region.

## License

MIT
