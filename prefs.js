import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {MODULE_KEYS, MODULE_LABELS} from './modules/metadata.js';

const SERVER_KEYS = ['os_euro', 'os_usa', 'os_asia', 'os_cht'];
const SERVER_LABELS = {
    'os_euro': 'Europe',
    'os_usa': 'America',
    'os_asia': 'Asia',
    'os_cht': 'TW/HK/MO',
};
const SERVER_NAMES = SERVER_KEYS.map(k => SERVER_LABELS[k]);

export default class GenshinResinPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        this._accounts = this._loadAccounts();
        this._loading = true;

        this._buildGeneralPage(window);
        this._buildAccountsPage(window);
        this._buildModulesPage(window);

        this._rebuildAccountList();
        this._rebuildModuleAccountList();

        if (this._accounts.length > 0) {
            this._populateFields(this._accounts[0]);
            this._buildModuleRows(this._accounts[0]);
            this._moduleAccountCombo.selected = 0;
        }

        window.connect('close-request', () => {
            this._accounts = null;
            this._accountList = null;
            this._moduleAccountList = null;
            this._accountCombo = null;
            this._moduleAccountCombo = null;
            this._nameRow = null;
            this._uidRow = null;
            this._serverRow = null;
            this._ltuidRow = null;
            this._ltokenRow = null;
            this._ltmidRow = null;
            this._accountIdRow = null;
            this._cookieTokenRow = null;
            this._moduleRows = null;
            this._loading = false;
        });

        this._loading = false;
    }

    /* ---- General page ---- */

    _buildGeneralPage(window) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const displayGroup = new Adw.PreferencesGroup({
            title: _('Panel Display'),
            description: _('Changes apply after restarting GNOME Shell'),
        });
        page.add(displayGroup);

        const boxRow = new Adw.ComboRow({
            title: _('Panel Section'),
            model: Gtk.StringList.new(['Right', 'Center', 'Left']),
        });
        const boxMap = {0: 'right', 1: 'center', 2: 'left'};
        const boxStr = window._settings.get_string('panel-box') || 'right';
        boxRow.selected = Object.values(boxMap).indexOf(boxStr);
        boxRow.connect('notify::selected', () => {
            const sel = boxRow.selected;
            if (sel >= 0 && sel < 3)
                window._settings.set_string('panel-box', boxMap[sel]);
        });
        displayGroup.add(boxRow);

        const posRow = new Adw.SpinRow({
            title: _('Position'),
            subtitle: _('Order within the section (-1 = end, 0 = start)'),
            adjustment: new Gtk.Adjustment({
                value: window._settings.get_int('panel-position'),
                lower: -1,
                upper: 50,
                step_increment: 1,
            }),
        });
        window._settings.bind('panel-position', posRow.adjustment, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(posRow);

        const showNameRow = new Adw.SwitchRow({
            title: _('Show Account Name'),
            subtitle: _('Show the account name before the resin count'),
        });
        window._settings.bind('show-account-name', showNameRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showNameRow);

        const advancedGroup = new Adw.PreferencesGroup({title: _('Advanced')});
        page.add(advancedGroup);

        const pollRow = new Adw.SpinRow({
            title: _('Poll Interval (seconds)'),
            subtitle: _('How often to fetch from the HoYoLAB API'),
            adjustment: new Gtk.Adjustment({
                value: window._settings.get_int('poll-interval'),
                lower: 60,
                upper: 3600,
                step_increment: 30,
            }),
        });
        window._settings.bind('poll-interval', pollRow.adjustment, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        advancedGroup.add(pollRow);
    }

    /* ---- Accounts page ---- */

    _buildAccountsPage(window) {
        const page = new Adw.PreferencesPage({
            title: _('Accounts'),
            icon_name: 'system-users-symbolic',
        });
        window.add(page);

        const selGroup = new Adw.PreferencesGroup({title: _('Manage Accounts')});
        page.add(selGroup);

        this._accountList = Gtk.StringList.new([]);
        this._accountCombo = new Adw.ComboRow({
            title: _('Select Account'),
            model: this._accountList,
        });

        const btnBox = new Gtk.Box({spacing: 0});
        btnBox.add_css_class('linked');
        const addBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            tooltip_text: _('Add new account'),
            valign: Gtk.Align.CENTER,
        });
        const delBtn = new Gtk.Button({
            icon_name: 'list-remove-symbolic',
            tooltip_text: _('Remove current account'),
            valign: Gtk.Align.CENTER,
        });
        btnBox.append(addBtn);
        btnBox.append(delBtn);
        this._accountCombo.add_suffix(btnBox);
        selGroup.add(this._accountCombo);

        addBtn.connect('clicked', () => {
            const modules = {};
            for (const k of MODULE_KEYS)
                modules[k] = true;
            this._accounts.push({
                name: `Account ${this._accounts.length + 1}`,
                uid: '',
                server: 'os_euro',
                ltuid: '',
                ltoken: '',
                ltmid: '',
                accountId: '',
                cookieToken: '',
                modules,
                moduleOrder: [...MODULE_KEYS],
            });
            this._saveAccounts();
            this._rebuildAccountList();
            this._rebuildModuleAccountList();
            this._accountCombo.selected = this._accounts.length - 1;
        });

        delBtn.connect('clicked', () => {
            const idx = this._accountCombo.selected;
            if (idx < 0 || idx >= this._accounts.length) return;
            this._accounts.splice(idx, 1);
            this._saveAccounts();
            this._rebuildAccountList();
            this._rebuildModuleAccountList();
            this._accountCombo.selected = Math.min(idx, this._accounts.length - 1);
        });

        this._accountCombo.connect('notify::selected', () => {
            if (this._loading) return;
            const idx = this._accountCombo.selected;
            if (idx < 0 || idx >= this._accounts.length) return;
            this._populateFields(this._accounts[idx]);
            delBtn.sensitive = this._accounts.length > 1;
        });

        const detailGroup = new Adw.PreferencesGroup({title: _('Account Details')});
        page.add(detailGroup);

        this._nameRow = new Adw.EntryRow({title: _('Account Name')});
        this._nameRow.connect('changed', () => this._onFieldChanged());
        detailGroup.add(this._nameRow);

        this._uidRow = new Adw.EntryRow({title: _('Genshin UID')});
        this._uidRow.connect('changed', () => this._onFieldChanged());
        detailGroup.add(this._uidRow);

        this._serverRow = new Adw.ComboRow({
            title: _('Server'),
            model: Gtk.StringList.new(SERVER_NAMES),
        });
        this._serverRow.connect('notify::selected', () => this._onFieldChanged());
        detailGroup.add(this._serverRow);

        const cookieGroup = new Adw.PreferencesGroup({
            title: _('HoYoLAB Cookies (v2)'),
            description: _(
                'Open <a href="https://www.hoyolab.com">hoyolab.com</a>, log in, '
                + 'then F12 → Application → Cookies → https://www.hoyolab.com.\n'
                + 'Copy the <b>value</b> for each cookie named with _v2 suffix.'),
        });
        page.add(cookieGroup);

        this._ltuidRow = this._addCookieRow(cookieGroup, 'ltuid_v2');
        this._ltokenRow = this._addCookieRow(cookieGroup, 'ltoken_v2');
        this._ltmidRow = this._addCookieRow(cookieGroup, 'ltmid_v2 (optional)');
        this._accountIdRow = this._addCookieRow(cookieGroup, 'account_id_v2');
        this._cookieTokenRow = this._addCookieRow(cookieGroup, 'cookie_token_v2');
    }

    /* ---- Modules page ---- */

    _buildModulesPage(window) {
        const page = new Adw.PreferencesPage({
            title: _('Modules'),
            icon_name: 'application-x-addon-symbolic',
        });
        window.add(page);

        const selGroup = new Adw.PreferencesGroup({title: _('Select Account')});
        page.add(selGroup);

        this._moduleAccountList = Gtk.StringList.new([]);
        this._moduleAccountCombo = new Adw.ComboRow({
            title: _('Account'),
            model: this._moduleAccountList,
        });
        selGroup.add(this._moduleAccountCombo);

        this._moduleAccountCombo.connect('notify::selected', () => {
            if (this._loading) return;
            const idx = this._moduleAccountCombo.selected;
            if (idx < 0 || idx >= this._accounts.length) return;
            this._buildModuleRows(this._accounts[idx]);
        });

        this._moduleGroup = new Adw.PreferencesGroup({
            title: _('Feature Modules'),
            description: _('Enable, disable, or reorder features in the popup menu'),
        });
        page.add(this._moduleGroup);

        this._moduleRows = {};
    }

    _rebuildModuleAccountList() {
        if (!this._moduleAccountList) return;
        while (this._moduleAccountList.get_n_items() > 0)
            this._moduleAccountList.remove(0);
        for (const acc of this._accounts)
            this._moduleAccountList.append(acc.name);
    }

    _buildModuleRows(acc) {
        if (!this._moduleGroup) return;

        for (const row of Object.values(this._moduleRows))
            this._moduleGroup.remove(row);
        this._moduleRows = {};

        const order = acc ? (acc.moduleOrder || MODULE_KEYS) : [];
        const enabled = acc ? (acc.modules || {}) : {};

        for (let i = 0; i < order.length; i++) {
            const key = order[i];
            const row = new Adw.SwitchRow({title: MODULE_LABELS[key] || key});
            row.active = enabled[key] !== false;

            const arrowBox = new Gtk.Box({spacing: 0});
            arrowBox.add_css_class('linked');
            arrowBox.valign = Gtk.Align.CENTER;

            const upBtn = Gtk.Button.new_with_label('\u25B2');
            upBtn.tooltip_text = _('Move up');
            upBtn.valign = Gtk.Align.CENTER;

            const downBtn = Gtk.Button.new_with_label('\u25BC');
            downBtn.tooltip_text = _('Move down');
            downBtn.valign = Gtk.Align.CENTER;

            upBtn.sensitive = i > 0;
            downBtn.sensitive = i < order.length - 1;

            upBtn.connect('clicked', () => this._moveModule(key, -1));
            downBtn.connect('clicked', () => this._moveModule(key, 1));

            arrowBox.append(upBtn);
            arrowBox.append(downBtn);
            row.add_suffix(arrowBox);

            row.connect('notify::active', () => this._onModuleToggled());
            this._moduleGroup.add(row);
            this._moduleRows[key] = row;
        }
    }

    _moveModule(key, direction) {
        const idx = this._moduleAccountCombo.selected;
        if (idx < 0 || idx >= this._accounts.length) return;
        const acc = this._accounts[idx];
        const order = acc.moduleOrder || [...MODULE_KEYS];
        const pos = order.indexOf(key);
        if (pos < 0) return;

        const newPos = pos + direction;
        if (newPos < 0 || newPos >= order.length) return;

        [order[pos], order[newPos]] = [order[newPos], order[pos]];
        acc.moduleOrder = order;
        this._saveAccounts();
        this._buildModuleRows(acc);
    }

    _onModuleToggled() {
        if (this._loading) return;
        const idx = this._moduleAccountCombo.selected;
        if (idx < 0 || idx >= this._accounts.length) return;
        const acc = this._accounts[idx];
        if (!acc.modules) acc.modules = {};
        for (const key of Object.keys(this._moduleRows))
            acc.modules[key] = this._moduleRows[key].active;
        this._saveAccounts();
    }

    /* ---- Shared helpers ---- */

    _populateFields(acc) {
        this._loading = true;
        this._nameRow.text = acc ? acc.name || '' : '';
        this._uidRow.text = acc ? acc.uid || '' : '';
        const si = acc ? SERVER_KEYS.indexOf(acc.server) : -1;
        this._serverRow.selected = si >= 0 ? si : 0;
        this._ltuidRow.text = acc ? acc.ltuid || '' : '';
        this._ltokenRow.text = acc ? acc.ltoken || '' : '';
        this._ltmidRow.text = acc ? acc.ltmid || '' : '';
        this._accountIdRow.text = acc ? acc.accountId || '' : '';
        this._cookieTokenRow.text = acc ? acc.cookieToken || '' : '';
        this._loading = false;
    }

    _onFieldChanged() {
        if (this._loading) return;
        const idx = this._accountCombo.selected;
        if (idx < 0 || idx >= this._accounts.length) return;
        const acc = this._accounts[idx];
        acc.name = this._nameRow.text;
        acc.uid = this._uidRow.text;
        acc.server = SERVER_KEYS[this._serverRow.selected] || 'os_euro';
        acc.ltuid = this._ltuidRow.text;
        acc.ltoken = this._ltokenRow.text;
        acc.ltmid = this._ltmidRow.text;
        acc.accountId = this._accountIdRow.text;
        acc.cookieToken = this._cookieTokenRow.text;
        this._saveAccounts();
        if (this._accountList.get_string(idx) !== acc.name) {
            this._accountList.splice(idx, 1, acc.name);
            this._rebuildModuleAccountList();
        }
    }

    _addCookieRow(group, title) {
        const row = new Adw.PasswordEntryRow({title});
        row.connect('changed', () => this._onFieldChanged());
        group.add(row);
        return row;
    }

    _loadAccounts() {
        try {
            const accounts = JSON.parse(this.getSettings().get_string('accounts'));
            if (Array.isArray(accounts)) return accounts;
        } catch (_) {}
        return [];
    }

    _saveAccounts() {
        this.getSettings().set_string('accounts', JSON.stringify(this._accounts));
    }

    _rebuildAccountList() {
        if (!this._accountList) return;
        while (this._accountList.get_n_items() > 0)
            this._accountList.remove(0);
        for (const acc of this._accounts)
            this._accountList.append(acc.name);
    }
}
