import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {NotifyGuard} from './util.js';
import {T} from './i18n.js';

export const key = 'transformer';
export const label = 'Parametric Transformer';
export const notifications = true;

export default class TransformerModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._guard = new NotifyGuard();
    }

    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(data) {
        const tr = data.transformer;
        let ready = false;
        if (tr && tr.obtained) {
            const rt = tr.recovery_time || {};
            if (rt.reached) {
                this._item.label.text = '\u2697 ' + T('transformer.label', 'Transformer') + ': ' + T('transformer.ready', 'Ready!');
                ready = true;
            } else {
                const h = rt.Hour || 0;
                const m = rt.Minute || 0;
                const s = rt.Second || 0;
                this._item.label.text = `\u2697 ${T('transformer.label', 'Transformer')}: ${h}h ${m}m ${s}s`;
            }
        } else {
            this._item.label.text = '\u2697 ' + T('transformer.label', 'Transformer') + ': ' + T('transformer.not_obtained', 'Not obtained');
        }

        const notifyOn = this._account?.modules?.notify_transformer !== false;
        this._guard.check('ready', ready,
            T('transformer.notification_title', 'Transformer ready'),
            T('transformer.notification_body', 'Parametric Transformer is available'), notifyOn);
        this._guard.arm();
    }
}
