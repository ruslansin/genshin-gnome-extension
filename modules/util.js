import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const RESIN_SECONDS = 480;

export function fmtDuration(seconds) {
    if (seconds <= 0) return 'Done';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export function fmtCompact(seconds) {
    if (seconds <= 0) return 'Full';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m}m`;
    return `${m}m`;
}

export function fmtTimer(seconds) {
    if (seconds <= 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class NotifyGuard {
    constructor() {
        this._flags = {};
        this._armed = false;
    }

    arm() {
        this._armed = true;
    }

    check(key, condition, title, message, enabled = true) {
        if (!this._armed || !enabled) return;
        if (condition && !this._flags[key]) {
            this._flags[key] = true;
            Main.notify(title, message);
        }
        if (!condition)
            this._flags[key] = false;
    }
}
