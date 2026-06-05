import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';

export const key = 'bosses';
export const label = 'Weekly Bosses';

export default class BossesModule extends Module {
    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(data) {
        const disc = data.remain_resin_discount_num || 0;
        const discMax = data.resin_discount_num_limit || 3;
        this._item.label.text = `\u2694 Weekly Bosses: ${disc}/${discMax} remaining`;
    }
}
