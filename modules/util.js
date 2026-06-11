import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import {T} from './i18n.js';

export const RESIN_SECONDS = 480;

export function fmtDuration(seconds) {
    if (seconds <= 0) return T('common.done', 'Done');
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}${T('common.hour', 'h')} ${m}${T('common.min', 'm')}`;
    return `${m}${T('common.min', 'm')}`;
}

export function fmtCompact(seconds) {
    if (seconds <= 0) return T('common.full', 'Full');
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}${T('common.hour', 'h')}${m}${T('common.min', 'm')}`;
    return `${m}${T('common.min', 'm')}`;
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

    checkAction(key, condition, title, message, enabled, callback) {
        if (!this._armed || !enabled) return;
        if (condition && !this._flags[key]) {
            this._flags[key] = true;
            const source = new MessageTray.Source({
                title,
                'icon-name': 'dialog-information-symbolic',
            });
            Main.messageTray.add(source);
            const notification = new MessageTray.Notification({
                source,
                title,
                body: message,
            });
            notification.connect('activated', () => {
                callback();
            });
            source.addNotification(notification);
        }
        if (!condition)
            this._flags[key] = false;
    }
}
