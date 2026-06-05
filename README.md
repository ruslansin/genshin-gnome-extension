# Genshin Resin Tracker

GNOME Shell extension that shows your Genshin Impact real-time resources in the top panel using the official HoYoLAB API. Supports multiple accounts simultaneously.

## Features

- **Multi-account support** — track all your accounts at once, each with its own panel indicator
- **Per-account region** — Europe, America, Asia, TW/HK/MO selectable per account
- **Resin counter** in the GNOME top panel — `28/200` with time-to-full
- **Optional account name** on panel — toggle `Show Account Name` on or off
- **Color coding**: green (full), yellow (>=90%), amber (cached), red (error)
- **Persistent cache** — last known data survives restarts and network outages
- **Click menu** with full game resource overview:
  - Account name (when hidden on panel)
  - Resin count + time until full
  - Live next-resin countdown (per-second timer)
  - Daily commissions status
  - Weekly boss discount claims remaining
  - Expedition countdown timers per character
  - Realm currency + time until cap
  - Parametric Transformer status
  - Copy UID to clipboard
- **Automatic refresh** via HoYoLAB Battle Chronicle API
- **Local interpolation** between API calls (1 resin per 8 minutes)
- **Modular architecture** — each feature is an independent module; reorder, enable, or disable per account in preferences
- **Plugin-style modules** — self-contained files in `modules/`, each exports its own key and label

## Screenshots

Panel indicator (with name):
```
◆ Main: 28/200
```

Panel indicator (name hidden):
```
◆ 28/200
```

Panel indicator (cached, offline):
```
◆ Main: 28/200 (cached)
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
Copy UID
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
   - Press `F12` -> **Application** -> **Cookies** -> `https://www.hoyolab.com`
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

6. Under **Feature Modules**, per account:
   - Toggle individual modules on or off
   - Use up/down arrows to reorder modules in the popup menu

7. The indicator should show your resin count within ~30 seconds

## Development

### Commands

```bash
# Build GSettings schema and generate module metadata
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
prefs.js             — Preferences UI with multi-account and module management
modules/             — Plugin-style feature modules
  index.js           —   Module registry (aggregates all modules)
  metadata.js        —   Auto-generated keys/labels (no shell deps)
  module.js          —   Base Module class
  util.js            —   Formatting helpers and constants
  resin.js           —   Resin counter + countdown
  commissions.js     —   Daily commissions
  bosses.js          —   Weekly boss discounts
  expeditions.js     —   Expedition timers
  currency.js        —   Realm currency
  transformer.js     —   Parametric transformer
  error.js           —   Error display
  account-name.js    —   Account name in menu
```

### Adding a new module

1. Create `modules/yourname.js`:
   ```js
   import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
   import {Module} from './module.js';

   export const key = 'yourname';
   export const label = 'Your Feature';

   export default class YourModule extends Module {
       build() { /* create menu items */ }
       update(data) { /* update from API data */ }
   }
   ```

2. Add the import to `modules/index.js` and register it in `MODULE_REGISTRY`.

3. Add the key to the ordering list in `build.sh`.

4. Run `./build.sh` to regenerate `metadata.js`.

## API

Uses the official HoYoLAB Battle Chronicle API with DS signature authentication. No third-party proxies -- your cookies go directly to HoYoverse servers. The `server` query parameter routes requests to the correct game region.

## License

MIT
