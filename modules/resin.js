import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {NotifyGuard, RESIN_SECONDS, fmtDuration, fmtTimer} from './util.js';

export const key = 'resin';
export const label = 'Resin';
export const notifications = true;

export default class ResinModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._cache = {maxResin: 200, lastResin: 0, lastUpdate: 0};
        this._guard = new NotifyGuard();
    }

    build() {
        this._resinItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._resinItem);
        this._items.push(this._resinItem);

        this._nextTickItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._nextTickItem);
        this._items.push(this._nextTickItem);
    }

    update(data) {
        this._cache = {
            maxResin: data.max_resin,
            lastResin: data.current_resin,
            lastUpdate: Math.floor(Date.now() / 1000),
        };

        const resinSec = Math.max(0,
            parseInt(data.remaining_resin_recovery_time, 10) || 0);
        this._resinItem.label.text =
            `\u25C6 Resin: ${data.current_resin}/${data.max_resin}  \u2192 ${fmtDuration(resinSec)}`;

        const notifyOn = this._account?.modules?.notify_resin !== false;
        this._guard.check('full', data.current_resin >= data.max_resin,
            'Resin is full!', `${data.current_resin}/${data.max_resin}`, notifyOn);
        this._guard.arm();
    }

    getEstimate() {
        const {maxResin, lastResin, lastUpdate} = this._cache;
        if (lastUpdate === 0)
            return {current: 0, max: maxResin, remaining: 0, nextTick: 0};

        const elapsed = Math.floor(Date.now() / 1000) - lastUpdate;
        const regenerated = Math.floor(elapsed / RESIN_SECONDS);
        const current = Math.min(lastResin + regenerated, maxResin);
        const remaining = Math.max(0,
            (maxResin - current) * RESIN_SECONDS - (elapsed % RESIN_SECONDS));
        const nextTick = current >= maxResin ? 0 :
            Math.max(0, RESIN_SECONDS - (elapsed % RESIN_SECONDS));

        return {current, max: maxResin, remaining, nextTick};
    }

    get panelText() {
        const {current, max} = this.getEstimate();
        return `${current}/${max}`;
    }

    updateTick() {
        const {nextTick} = this.getEstimate();
        if (!this._nextTickItem) return;
        this._nextTickItem.label.text = nextTick > 0
            ? `\u21BB Next resin: ${fmtTimer(nextTick)}`
            : '';
        this._nextTickItem.visible = nextTick > 0;
    }

    clear() {
        this._cache = {maxResin: 200, lastResin: 0, lastUpdate: 0};
    }
}
