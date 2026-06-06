import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {T} from './i18n.js';

export const key = 'commissions';
export const label = 'Daily Commissions';

export default class CommissionsModule extends Module {
    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(data) {
        const done = data.finished_task_num || 0;
        const total = data.total_task_num || 4;
        const claimed = data.is_extra_task_reward_received;
        this._item.label.text =
            `\u2714 ${T('commissions.label', 'Commissions')}: ${done}/${total}${claimed ? ` (${T('commissions.claimed', 'claimed')})` : ''}`;
    }
}
