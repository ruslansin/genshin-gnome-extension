import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {fmtTimer} from './util.js';

export const key = 'expeditions';
export const label = 'Expeditions';

export default class ExpeditionsModule extends Module {
    build() {
        this._header = new PopupMenu.PopupMenuItem('Expeditions', {reactive: false});
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
        const exps = data.expeditions || [];
        for (let i = 0; i < 5; i++) {
            if (i < exps.length) {
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
        this._header.label.text =
            `Expeditions: ${data.current_expedition_num || 0}/${data.max_expedition_num || 5}`;
    }
}
