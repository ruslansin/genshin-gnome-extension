import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    fmtCompact,
    MODULE_REGISTRY,
    MODULE_KEYS,
    AccountNameModule,
    ErrorModule,
} from './modules/index.js';
import {T, apiLang} from './modules/i18n.js';

const API_BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api';
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++)
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function generateDS() {
    const t = Math.floor(Date.now() / 1000);
    const r = randomString(6);
    const hash = GLib.compute_checksum_for_string(
        GLib.ChecksumType.MD5, `salt=${DS_SALT}&t=${t}&r=${r}`, -1);
    return `${t},${r},${hash}`;
}

export class AccountWidget {
    constructor(account, extensionPath, session, settings, prefsCallback, showName) {
        this._account = account;
        this._session = session;
        this._settings = settings;
        this._prefsCallback = prefsCallback;
        this._showName = showName;
        this._enabled = account.modules || {};
        this._order = this._normalizeOrder(account.moduleOrder);
        this._instances = {};
        this._cachedData = null;
        this._cacheAge = null;

        this._loadCachedData();

        this._indicator = new PanelMenu.Button(0.0, 'Genshin Resin', false);

        const box = new St.BoxLayout({vertical: false});

        const iconFile = Gio.File.new_for_path(extensionPath + '/assets/resin.svg');
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            style_class: 'genshin-resin-icon',
            icon_size: 16,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(icon);

        this._label = new St.Label({
            text: this._labelText(),
            style_class: 'genshin-resin-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        this._indicator.add_child(box);
        this._buildMenu();
    }

    _moduleEnabled(key) {
        return this._enabled[key] !== false;
    }

    _normalizeOrder(order) {
        const result = order ? [...order] : [...MODULE_KEYS];
        const have = new Set(result);
        for (const k of MODULE_KEYS) {
            if (!have.has(k))
                result.push(k);
        }
        return result;
    }

    _buildMenu() {
        const menu = this._indicator.menu;

        this._accountName = new AccountNameModule(menu);
        this._accountName.build();
        this._accountName.setName(this._account.name);
        this._accountName._item.visible = !this._showName;

        this._instances = {};
        for (const key of this._order) {
            if (!this._moduleEnabled(key)) continue;
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const M = MODULE_REGISTRY[key];
            if (!M) continue;
            const inst = new M(menu, this._session, this._account);
            inst.build();
            this._instances[key] = inst;
        }

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._error = new ErrorModule(menu);
        this._error.build();

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        menu.addAction(T('common.copy_uid', 'Copy UID'), () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this._account.uid);
        });
        menu.addAction(T('common.refresh_now', 'Refresh Now'), () => this.fetch());
        menu.addAction(T('common.preferences', 'Preferences'), () => this._prefsCallback?.());
    }

    get indicator() {
        return this._indicator;
    }

    updateAccount(account, showName) {
        this._account = account;
        this._enabled = account.modules || {};
        this._order = this._normalizeOrder(account.moduleOrder);
        this._cachedData = null;
        this._cacheAge = null;
        this._loadCachedData();

        if (showName !== undefined) {
            this._showName = showName;
            if (this._accountName)
                this._accountName._item.visible = !showName;
        }
        if (this._accountName)
            this._accountName.setName(account.name);
    }

    _loadCachedData() {
        try {
            const raw = JSON.parse(this._settings.get_string('last-data'));
            const entry = raw[this._account.uid];
            if (entry && entry.data) {
                this._cachedData = entry.data;
                this._cacheAge = Math.floor(Date.now() / 1000) - (entry.ts || 0);
            }
        } catch (_) {
            this._cacheAge = null;
        }
    }

    _saveCachedData(data) {
        try {
            const raw = JSON.parse(this._settings.get_string('last-data'));
            raw[this._account.uid] = {data, ts: Math.floor(Date.now() / 1000)};
            this._settings.set_string('last-data', JSON.stringify(raw));
            this._cacheAge = null;
        } catch (_) {}
    }

    _labelText() {
        const namePrefix = this._showName ? `${this._account.name}: ` : '';
        const resin = this._instances['resin'];
        if (!resin)
            return `${namePrefix}--/--`;
        const {current, max} = resin.getEstimate();
        const count = `${current}/${max}`;
        const suffix = this._cacheAge !== null ? ` (${T('common.cached', 'cached')})` : '';
        return `${namePrefix}${count}${suffix}`;
    }

    fetch() {
        const session = this._session;
        const {uid, server, ltuid, ltoken, ltmid, accountId, cookieToken} =
            this._account;

        if (!uid || uid === '0') {
            this._showError('No UID configured');
            return;
        }
        if (!ltoken || !ltuid) {
            this._showError('Missing ltuid_v2 / ltoken_v2');
            return;
        }

        try {
            const ds = generateDS();
            const url = `${API_BASE}/dailyNote?role_id=${uid}&server=${server}`;
            const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const msg = Soup.Message.new_from_uri('GET', uri);

            const headers = msg.get_request_headers();
            headers.append('DS', ds);
            headers.append('x-rpc-app_version', '1.5.0');
            headers.append('x-rpc-client_type', '5');
            headers.append('x-rpc-language', apiLang());
            headers.append('x-rpc-lang', apiLang());
            headers.append('Referer', 'https://act.hoyolab.com/');
            headers.append('User-Agent', USER_AGENT);

            const cookies = [];
            if (ltuid) cookies.push(`ltuid_v2=${ltuid}`);
            if (ltoken) cookies.push(`ltoken_v2=${ltoken}`);
            if (ltmid) cookies.push(`ltmid_v2=${ltmid}`);
            if (accountId) cookies.push(`account_id_v2=${accountId}`);
            if (cookieToken) cookies.push(`cookie_token_v2=${cookieToken}`);
            if (cookies.length > 0)
                headers.append('Cookie', cookies.join('; '));

            session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null,
                (s, result) => this._onResponse(s, result, msg));
        } catch (e) {
            console.error(`[genshin-resin] fetch error: ${e.message}`);
            this._showError(`Request failed: ${e.message}`);
        }
    }

    _onResponse(session, result, msg) {
        try {
            const bytes = session.send_and_read_finish(result);
            const status = msg.get_status();

            if (!bytes || status !== Soup.Status.OK) {
                this._showError(`HTTP ${status}`);
                return;
            }

            const body = new TextDecoder().decode(bytes.get_data());
            const data = JSON.parse(body);

            if (data.retcode !== 0) {
                this._showError(`${data.message} (${data.retcode})`);
                return;
            }

            this._cachedData = data.data;
            this._cacheAge = null;
            this._showError('');
            this.updateDisplay(data.data);
            this._saveCachedData(data.data);
        } catch (e) {
            console.error(`[genshin-resin] parse error: ${e.message}`);
            this._showError(`Parse error: ${e.message}`);
        }
    }

    updateDisplay(d) {
        for (const inst of Object.values(this._instances))
            inst.update(d);
        this.updateLabel();
        this._instances['resin']?.updateTick();
    }

    updateLabel() {
        this._label.text = this._labelText();

        const resin = this._instances['resin'];
        if (!resin) return;

        const {current, max, remaining} = resin.getEstimate();

        let tooltip = `Resin: ${current}/${max} \u2192 ${fmtCompact(remaining)}`;
        if (this._cacheAge !== null)
            tooltip += `  (from ${fmtCompact(this._cacheAge)} ago)`;

        const d = this._cachedData;
        if (d) {
            const done = d.finished_task_num || 0;
            const total = d.total_task_num || 4;
            tooltip += `\nCommissions: ${done}/${total}`;

            const disc = d.remain_resin_discount_num || 0;
            tooltip += `\nWeekly Bosses: ${disc}/${d.resin_discount_num_limit || 3}`;

            const coin = d.current_home_coin || 0;
            const maxCoin = d.max_home_coin || 2400;
            tooltip += `\nRealm Currency: ${coin}/${maxCoin}`;
        }

        this._indicator.tooltip_text = tooltip;

        if (!this._error.visible) {
            if (this._cacheAge !== null)
                this._label.style = 'color: #c4a000';
            else if (current >= max)
                this._label.style = 'color: #4e9a06';
            else if (current >= max * 0.9)
                this._label.style = 'color: #fce94f';
            else
                this._label.style = '';
        }
    }

    updateTick() {
        this._instances['resin']?.updateTick();
    }

    clear() {
        this._cachedData = null;
        this._cacheAge = null;
        for (const inst of Object.values(this._instances))
            inst.clear();
    }

    _showError(msg) {
        if (!this._error) return;
        if (msg) {
            this._error.show(msg);
            this._label.style = this._cachedData ? 'color: #c4a000' : 'color: #cc0000';
        } else {
            this._error.hide();
        }
    }

    destroy() {
        this._accountName?.destroy();
        for (const inst of Object.values(this._instances))
            inst.destroy();
        this._error?.destroy();
        this._indicator.destroy();
    }
}
