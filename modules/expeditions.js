import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {NotifyGuard, fmtTimer} from './util.js';
import {T} from './i18n.js';

export const key = 'expeditions';
export const label = 'Expeditions';
export const notifications = true;

export default class ExpeditionsModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._guard = new NotifyGuard();
    }

    build() {
        this._header = new PopupMenu.PopupSubMenuMenuItem('');
        this._menu.addMenuItem(this._header);
        this._items.push(this._header);

        this._itemsInSub = [];
    }

    update(data) {
        this._data = data;
        this._render();
    }

    _render() {
        const data = this._data;
        if (!data) return;

        const exps = data.expeditions || [];
        const count = data.current_expedition_num || 0;
        const total = data.max_expedition_num || 5;

        let nearest = '';
        if (exps.length > 0) {
            let minRemain = Infinity;
            for (const e of exps) {
                if (e.status === 'Finished') {
                    nearest = ' \u00B7 ' + T('expeditions.done', 'Done!');
                    minRemain = -1;
                    break;
                }
                const r = parseInt(e.remained_time, 10) || 0;
                if (r < minRemain)
                    minRemain = r;
            }
            if (minRemain > 0)
                nearest = ` \u00B7 ${fmtTimer(minRemain)}`;
        }

        this._header.label.text = T('expeditions.label', 'Expeditions') + ` (${count}/${total})${nearest}`;

        // Clear submenu
        for (const item of this._itemsInSub)
            item.destroy();
        this._itemsInSub.length = 0;

        const sub = this._header.menu;
        if (!sub)
            return;

        for (let i = 0; i < exps.length; i++) {
            const e = exps[i];
            const remain = parseInt(e.remained_time, 10) || 0;
            const done = e.status === 'Finished';
            const text = `   ${done ? '\u2713' : '\u23F3'} ${done ? T('expeditions.done', 'Done') : fmtTimer(remain)}`;
            const item = new PopupMenu.PopupMenuItem(text, {reactive: false});
            sub.addMenuItem(item);
            this._itemsInSub.push(item);
        }

        const allDone = exps.length > 0
            && exps.every(e => e.status === 'Finished');

        const notifyOn = this._account?.modules?.notify_expeditions !== false;
        this._guard.check('done', allDone,
            T('expeditions.notification_title', 'Expeditions done'),
            T('expeditions.notification_body', 'All expeditions have returned'), notifyOn);
        this._guard.arm();
    }
}
