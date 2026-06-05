import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    fmtCompact,
    ResinModule,
    CommissionsModule,
    BossesModule,
    ExpeditionsModule,
    CurrencyModule,
    TransformerModule,
    ErrorModule,
} from './modules.js';

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
    constructor(account, extensionPath) {
        this._account = account;

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
            text: `${account.name}: --/--`,
            style_class: 'genshin-resin-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        this._indicator.add_child(box);
        this._buildMenu();

        this._cachedData = null;
    }

    _buildMenu() {
        const menu = this._indicator.menu;

        this._resin = new ResinModule(menu);
        this._commissions = new CommissionsModule(menu);
        this._bosses = new BossesModule(menu);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._expeditions = new ExpeditionsModule(menu);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._currency = new CurrencyModule(menu);
        this._transformer = new TransformerModule(menu);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._error = new ErrorModule(menu);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        menu.addAction('Refresh Now', () => this.fetch());

        this._resin.build();
        this._commissions.build();
        this._bosses.build();
        this._expeditions.build();
        this._currency.build();
        this._transformer.build();
        this._error.build();
    }

    get indicator() {
        return this._indicator;
    }

    fetch(session) {
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
            headers.append('x-rpc-language', 'en-us');
            headers.append('x-rpc-lang', 'en-us');
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
            this._showError('');
            this.updateDisplay(data.data);
        } catch (e) {
            console.error(`[genshin-resin] parse error: ${e.message}`);
            this._showError(`Parse error: ${e.message}`);
        }
    }

    updateDisplay(d) {
        this._resin.update(d);
        this._commissions.update(d);
        this._bosses.update(d);
        this._expeditions.update(d);
        this._currency.update(d);
        this._transformer.update(d);
        this.updateLabel();
        this._resin.updateTick();
    }

    updateLabel() {
        const {current, max, remaining} = this._resin.getEstimate();
        this._label.text = `${this._account.name}: ${current}/${max}`;

        let tooltip = `Resin: ${current}/${max} \u2192 ${fmtCompact(remaining)}`;

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
            if (current >= max)
                this._label.style = 'color: #4e9a06';
            else if (current >= max * 0.9)
                this._label.style = 'color: #fce94f';
            else
                this._label.style = '';
        }
    }

    updateTick() {
        this._resin.updateTick();
    }

    clear() {
        this._cachedData = null;
        this._resin.clear();
    }

    _showError(msg) {
        if (msg) {
            this._error.show(msg);
            this._label.style = 'color: #cc0000';
        } else {
            this._error.hide();
        }
    }

    destroy() {
        this._resin.destroy();
        this._commissions.destroy();
        this._bosses.destroy();
        this._expeditions.destroy();
        this._currency.destroy();
        this._transformer.destroy();
        this._error.destroy();
        this._indicator.destroy();
    }
}
