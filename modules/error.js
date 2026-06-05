import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';

export default class ErrorModule extends Module {
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
