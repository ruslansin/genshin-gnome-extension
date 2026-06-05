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
