import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';

export const key = 'transformer';
export const label = 'Parametric Transformer';

export default class TransformerModule extends Module {
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
