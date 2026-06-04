# Genshin Resin Tracker

GNOME Shell extension that shows your Genshin Impact real-time resources in the top panel using the official HoYoLAB API.

## Features

- **Resin counter** in the GNOME top panel — `28/200` with time-to-full
- **Color coding**: green (full), yellow (≥90%), default
- **Click menu** with full game resource overview:
  - Resin count + time until full
  - Daily commissions status
  - Weekly boss discount claims remaining
  - Expedition countdown timers per character
  - Realm currency + time until cap
  - Parametric Transformer status
- **Automatic refresh** via HoYoLAB Battle Chronicle API
- **Local interpolation** between API calls (1 resin per 8 minutes)
- **Configurable position** — left, center, or right panel section

## Screenshots

Panel indicator:

```
◆ 28/200
```

Click menu:

```
◆ Resin: 28/200  → 22h 48m
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

- GNOME Shell 45+
- A HoYoLAB account with Battle Chronicle enabled

## Installation

```bash
git clone https://github.com/ruslansin/genshin-extension
cd genshin-extension
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

2. Enter your **Genshin UID** and **Server** (Europe / America / Asia / TW-HK-MO)

3. Get HoYoLAB cookies:
   - Go to [hoyolab.com](https://www.hoyolab.com) and log in
   - Press `F12` → **Application** → **Cookies** → `https://www.hoyolab.com`
   - Copy the **values** for these cookies:
     - `ltuid_v2`
     - `ltoken_v2`
     - `ltmid_v2` (optional)
     - `account_id_v2`
     - `cookie_token_v2`
   - Paste them into the preferences fields

4. The indicator should show your resin count within ~30 seconds

## Development

Run a nested GNOME Shell session for instant reloads:

```bash
./dev.sh
```

Then in the nested window, open a terminal and:

```bash
gnome-extensions enable genshin-resin@snql
# After code changes:
gnome-extensions disable genshin-resin@snql
gnome-extensions enable genshin-resin@snql
```

## API

Uses the official [HoYoLAB Battle Chronicle API](https://sg-public-api.hoyolab.com/event/game_record/genshin/api/dailyNote) with DS signature authentication. No third-party proxies or scraping — your cookies go directly to HoYoverse servers.

## License

MIT
