import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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

        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(generalPage);

        const displayGroup = new Adw.PreferencesGroup({
            title: _('Panel Display'),
            description: _('Changes apply after restarting GNOME Shell'),
        });
        generalPage.add(displayGroup);

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

        const advancedGroup = new Adw.PreferencesGroup({title: _('Advanced')});
        generalPage.add(advancedGroup);

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

        const accountsPage = new Adw.PreferencesPage({
            title: _('Accounts'),
            icon_name: 'system-users-symbolic',
        });
        window.add(accountsPage);

        const selGroup = new Adw.PreferencesGroup({title: _('Manage Accounts')});
        accountsPage.add(selGroup);

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
            this._accounts.push({
                name: `Account ${this._accounts.length + 1}`,
                uid: '',
                server: 'os_euro',
                ltuid: '',
                ltoken: '',
                ltmid: '',
                accountId: '',
                cookieToken: '',
            });
            this._saveAccounts();
            this._rebuildAccountList();
            this._accountCombo.selected = this._accounts.length - 1;
        });

        delBtn.connect('clicked', () => {
            const idx = this._accountCombo.selected;
            if (idx < 0 || idx >= this._accounts.length) return;
            this._accounts.splice(idx, 1);
            this._saveAccounts();
            this._rebuildAccountList();
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
        accountsPage.add(detailGroup);

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
        accountsPage.add(cookieGroup);

        this._ltuidRow = this._addCookieRow(cookieGroup, 'ltuid_v2');
        this._ltokenRow = this._addCookieRow(cookieGroup, 'ltoken_v2');
        this._ltmidRow = this._addCookieRow(cookieGroup, 'ltmid_v2 (optional)');
        this._accountIdRow = this._addCookieRow(cookieGroup, 'account_id_v2');
        this._cookieTokenRow = this._addCookieRow(cookieGroup, 'cookie_token_v2');

        this._rebuildAccountList();
        if (this._accounts.length > 0)
            this._populateFields(this._accounts[0]);
        else
            this._populateFields(null);

        window.connect('close-request', () => {
            this._accounts = null;
            this._accountList = null;
            this._accountCombo = null;
            this._nameRow = null;
            this._uidRow = null;
            this._serverRow = null;
            this._ltuidRow = null;
            this._ltokenRow = null;
            this._ltmidRow = null;
            this._accountIdRow = null;
            this._cookieTokenRow = null;
            this._loading = false;
        });

        this._loading = false;
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
        while (this._accountList.get_n_items() > 0)
            this._accountList.remove(0);
        for (const acc of this._accounts)
            this._accountList.append(acc.name);
    }

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
        this._rebuildAccountList();
        this._accountCombo.selected = idx;
    }

    _addCookieRow(group, title) {
        const row = new Adw.PasswordEntryRow({title});
        row.connect('changed', () => this._onFieldChanged());
        group.add(row);
        return row;
    }
}
