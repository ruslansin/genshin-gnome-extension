import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {NotifyGuard, fmtDuration} from './util.js';

export const key = 'currency';
export const label = 'Realm Currency';
export const notifications = true;

export default class CurrencyModule extends Module {
    constructor(menu) {
        super(menu);
        this._guard = new NotifyGuard();
    }

    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(data) {
        const coin = data.current_home_coin || 0;
        const maxCoin = data.max_home_coin || 2400;
        const coinSec = Math.max(0,
            parseInt(data.home_coin_recovery_time, 10) || 0);
        this._item.label.text =
            `\u2302 Realm Currency: ${coin}/${maxCoin}  \u2192 ${fmtDuration(coinSec)}`;

    this._guard.arm();
    const notifyOn = this._account?.modules?.notify_currency !== false;
    this._guard.check('capped', coin >= maxCoin,
        'Realm Currency reached', `${coin}/${maxCoin}`, notifyOn);
    }
}
