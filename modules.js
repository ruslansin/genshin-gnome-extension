import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const RESIN_SECONDS = 480;
const COIN_SECONDS = 900;

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class Module {
    constructor(menu) {
        this._menu = menu;
        this._items = [];
        this.enabled = true;
    }

    build() {}

    update(_data) {}

    clear() {}

    destroy() {
        this._items.forEach(i => i.destroy());
        this._items.length = 0;
    }
}

export class ResinModule extends Module {
    constructor(menu) {
        super(menu);
        this._cache = {maxResin: 200, lastResin: 0, lastUpdate: 0};
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

export class CommissionsModule extends Module {
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
            `\u2714 Commissions: ${done}/${total}${claimed ? ' (claimed)' : ''}`;
    }
}

export class BossesModule extends Module {
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

export class ExpeditionsModule extends Module {
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

export class CurrencyModule extends Module {
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
    }
}

export class TransformerModule extends Module {
    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(data) {
        const tr = data.transformer;
        if (tr && tr.obtained) {
            const rt = tr.recovery_time || {};
            if (rt.reached) {
                this._item.label.text = '\u2697 Transformer: Ready!';
            } else {
                const h = rt.Hour || 0;
                const m = rt.Minute || 0;
                const s = rt.Second || 0;
                this._item.label.text = `\u2697 Transformer: ${h}h ${m}m ${s}s`;
            }
        } else {
            this._item.label.text = '\u2697 Transformer: Not obtained';
        }
    }
}

export class ErrorModule extends Module {
    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    get visible() {
        return this._item ? this._item.visible : false;
    }

    show(msg) {
        if (!this._item) return;
        this._item.label.text = msg;
        this._item.visible = true;
    }

    hide() {
        if (!this._item) return;
        this._item.visible = false;
    }
}

export class AccountNameModule extends Module {
    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._item.style_class = 'genshin-resin-account-name';
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    setName(name) {
        if (!this._item) return;
        this._item.label.text = name;
    }
}
