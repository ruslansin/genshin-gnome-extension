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

export default class GenshinResinPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const accountGroup = new Adw.PreferencesGroup({
            title: _('Account'),
            description: _('Your Genshin Impact account details'),
        });
        page.add(accountGroup);

        const uidRow = new Adw.EntryRow({
            title: _('Genshin UID'),
        });
        uidRow.text = window._settings.get_string('uid') !== '0'
            ? window._settings.get_string('uid') : '';
        uidRow.connect('changed', () => {
            window._settings.set_string('uid', uidRow.text);
        });
        accountGroup.add(uidRow);

        const serverRow = new Adw.ComboRow({
            title: _('Server'),
            model: Gtk.StringList.new(SERVER_KEYS.map(k => SERVER_LABELS[k])),
        });
        const serverStr = window._settings.get_string('server');
        let idx = SERVER_KEYS.indexOf(serverStr);
        if (idx < 0) idx = 0;
        serverRow.selected = idx;
        serverRow.connect('notify::selected', () => {
            const sel = serverRow.selected;
            if (sel >= 0 && sel < SERVER_KEYS.length)
                window._settings.set_string('server', SERVER_KEYS[sel]);
        });
        accountGroup.add(serverRow);

        const cookieGroup = new Adw.PreferencesGroup({
            title: _('HoYoLAB Cookies (v2)'),
            description: _(
                'Open <a href="https://www.hoyolab.com">hoyolab.com</a>, log in, then F12 → Application → Cookies → https://www.hoyolab.com.\nCopy the <b>value</b> for each cookie named with _v2 suffix below.'),
        });
        page.add(cookieGroup);

        const ltuidRow = this._addCookieRow(cookieGroup, 'ltuid_v2', 'ltuid');
        const ltokenRow = this._addCookieRow(cookieGroup, 'ltoken_v2', 'ltoken');
        const ltmidRow = this._addCookieRow(cookieGroup, 'ltmid_v2 (optional)', 'ltmid');
        const accountIdRow = this._addCookieRow(cookieGroup, 'account_id_v2', 'account-id');
        const cookieTokenRow = this._addCookieRow(cookieGroup, 'cookie_token_v2', 'cookie-token');

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

        const advancedGroup = new Adw.PreferencesGroup({
            title: _('Advanced'),
        });
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

    _addCookieRow(group, title, key) {
        const row = new Adw.PasswordEntryRow({title});
        row.text = this.getSettings().get_string(key);
        row.connect('changed', () => {
            this.getSettings().set_string(key, row.text);
        });
        group.add(row);
        return row;
    }
}
