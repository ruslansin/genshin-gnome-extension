import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {NotifyGuard, fmtTimer} from './util.js';

export const key = 'expeditions';
export const label = 'Expeditions';
export const notifications = true;

export default class ExpeditionsModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._guard = new NotifyGuard();
        this._expanded = false;
    }

    build() {
        this._header = new PopupMenu.PopupMenuItem('Expeditions');
        this._header.activate = () => {};
        this._header.connect('button-press-event', () => {
            this._expanded = !this._expanded;
            this._updateLabel();
            return Clutter.EVENT_STOP;
        });
        this._menu.addMenuItem(this._header);
        this._items.push(this._header);

        this._expItems = [];
        for (let i = 0; i < 5; i++) {
            const item = new PopupMenu.PopupMenuItem('', {reactive: false});
            this._expItems.push(item);
            this._menu.addMenuItem(item);
            this._items.push(item);
        }
    }

    update(data) {
        this._data = data;
        this._updateLabel();
    }

    _updateLabel() {
        const data = this._data;
        if (!data) return;

        const exps = data.expeditions || [];
        const arrow = this._expanded ? '\u25BE' : '\u25B8';
        this._header.label.text =
            `Expeditions: ${data.current_expedition_num || 0}/${data.max_expedition_num || 5} ${arrow}`;

        for (let i = 0; i < 5; i++) {
            if (i < exps.length && this._expanded) {
                const e = exps[i];
                const remain = parseInt(e.remained_time, 10) || 0;
                const done = e.status === 'Finished';
                this._expItems[i].label.text =
                    `   ${done ? '\u2713' : '\u23F3'} ${done ? 'Done' : fmtTimer(remain)}`;
                this._expItems[i].visible = true;
            } else {
                this._expItems[i].visible = false;
            }
        }

        const allDone = exps.length > 0
            && exps.every(e => e.status === 'Finished');

        const notifyOn = this._account?.modules?.notify_expeditions !== false;
        this._guard.check('done', allDone,
            'Expeditions done', 'All expeditions have returned', notifyOn);
        this._guard.arm();
    }
}
