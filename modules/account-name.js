import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';

export default class AccountNameModule extends Module {
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
