import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {AccountWidget} from './accountWidget.js';

export default class GenshinResinExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new Soup.Session();
        this._widgets = [];

        this._loadAccounts();

        const position = this._settings.get_int('panel-position');
        const boxSide = this._settings.get_string('panel-box') || 'right';

        for (let i = 0; i < this._accounts.length; i++) {
            this._addWidget(i, position, boxSide);
        }

        this._accountsChangedId = this._settings.connect(
            'changed::accounts', () => this._onAccountsChanged());

        const pollInterval = this._settings.get_int('poll-interval') || 300;
        this._pollSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, pollInterval,
            () => { this._fetchAll(); return GLib.SOURCE_CONTINUE; });

        this._labelSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 60,
            () => { this._updateAllLabels(); return GLib.SOURCE_CONTINUE; });

        this._tickSource = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1000,
            () => { this._updateAllTicks(); return GLib.SOURCE_CONTINUE; });

        this._fetchAll();
    }

    disable() {
        if (this._pollSource) {
            GLib.source_remove(this._pollSource);
            this._pollSource = null;
        }
        if (this._labelSource) {
            GLib.source_remove(this._labelSource);
            this._labelSource = null;
        }
        if (this._tickSource) {
            GLib.source_remove(this._tickSource);
            this._tickSource = null;
        }

        this._session?.abort();
        this._session = null;

        if (this._settings && this._accountsChangedId) {
            this._settings.disconnect(this._accountsChangedId);
            this._accountsChangedId = null;
        }

        this._destroyWidgets();

        this._settings = null;
        this._accounts = null;
    }

    _addWidget(index, position, boxSide) {
        const acc = this._accounts[index];
        const widget = new AccountWidget(acc, this.path, this._session,
            () => this.openPreferences());
        this._widgets.push(widget);

        Main.panel.addToStatusArea(
            `${this.uuid}-${index}`, widget.indicator,
            position >= 0 ? position + index : position, boxSide);

        widget.fetch();
    }

    _destroyWidgets() {
        for (const widget of this._widgets)
            widget.destroy();
        this._widgets.length = 0;
    }

    _fetchAll() {
        for (const widget of this._widgets)
            widget.fetch();
    }

    _updateAllLabels() {
        for (const widget of this._widgets)
            widget.updateLabel();
    }

    _updateAllTicks() {
        for (const widget of this._widgets)
            widget.updateTick();
    }

    _loadAccounts() {
        try {
            this._accounts = JSON.parse(this._settings.get_string('accounts'));
        } catch (_) {
            this._accounts = [];
        }
        if (!Array.isArray(this._accounts))
            this._accounts = [];

        if (this._accounts.length === 0) {
            const uid = this._settings.get_string('uid');
            if (uid && uid !== '0') {
                const acc = {
                    name: 'Default',
                    uid,
                    server: this._settings.get_string('server') || 'os_euro',
                    ltuid: this._settings.get_string('ltuid') || '',
                    ltoken: this._settings.get_string('ltoken') || '',
                    ltmid: this._settings.get_string('ltmid') || '',
                    accountId: this._settings.get_string('account-id') || '',
                    cookieToken: this._settings.get_string('cookie-token') || '',
                };
                this._accounts.push(acc);
                this._settings.set_string('accounts', JSON.stringify(this._accounts));
            }
        }
    }

    _onAccountsChanged() {
        const oldCount = this._widgets.length;
        this._loadAccounts();

        if (this._accounts.length === oldCount) {
            this._fetchAll();
            return;
        }

        this._destroyWidgets();

        const position = this._settings.get_int('panel-position');
        const boxSide = this._settings.get_string('panel-box') || 'right';
        for (let i = 0; i < this._accounts.length; i++)
            this._addWidget(i, position, boxSide);
    }
}
