import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';
import {fmtDuration} from './util.js';

export const key = 'abyss';
export const label = 'Spiral Abyss';

const API_BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api';
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

function randStr(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let r = '';
    for (let i = 0; i < len; i++)
        r += chars.charAt(Math.floor(Math.random() * chars.length));
    return r;
}

function genDS() {
    const t = Math.floor(Date.now() / 1000);
    const r = randStr(6);
    const h = GLib.compute_checksum_for_string(
        GLib.ChecksumType.MD5, `salt=${DS_SALT}&t=${t}&r=${r}`, -1);
    return `${t},${r},${h}`;
}

export default class AbyssModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._data = null;
        this._lastFetch = 0;
    }

    build() {
        this._item = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._menu.addMenuItem(this._item);
        this._items.push(this._item);
    }

    update(_d) {
        const now = Math.floor(Date.now() / 1000);
        if (now - this._lastFetch > 300)
            this._fetch();

        this._item.label.text = this._labelText();
    }

    _fetch() {
        if (!this._session || !this._account) return;

        const {uid, server, ltuid, ltoken, ltmid, accountId, cookieToken} =
            this._account;

        if (!uid || uid === '0' || !ltoken || !ltuid) return;

        try {
            const ds = genDS();
            const url = `${API_BASE}/spiralAbyss?role_id=${uid}&server=${server}&schedule_type=1`;
            const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const msg = Soup.Message.new_from_uri('GET', uri);

            const headers = msg.get_request_headers();
            headers.append('DS', ds);
            headers.append('x-rpc-app_version', '1.5.0');
            headers.append('x-rpc-client_type', '5');
            headers.append('x-rpc-language', 'en-us');
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

            this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null,
                (s, result) => this._onResponse(s, result, msg));
        } catch (_) {}
    }

    _onResponse(session, result, msg) {
        try {
            const bytes = session.send_and_read_finish(result);
            if (!bytes || msg.get_status() !== Soup.Status.OK) return;

            const body = new TextDecoder().decode(bytes.get_data());
            const data = JSON.parse(body);
            if (data.retcode !== 0) return;

            this._data = data.data;
            this._lastFetch = Math.floor(Date.now() / 1000);
            this._item.label.text = this._labelText();
        } catch (_) {}
    }

    _labelText() {
        const d = this._data;
        if (!d || !d.is_unlock)
            return '\u2694 Spiral Abyss: Not unlocked yet';

        const floor = d.max_floor || '?-?';
        const stars = d.total_star ?? 0;
        const maxStars = (d.floors || []).length * 3 || 36;

        let text = `\u2694 Spiral Abyss: Floor ${floor}  \u2605 ${stars}/${maxStars}`;

        if (d.end_time) {
            const endTs = parseInt(d.end_time, 10);
            const remain = Math.max(0, endTs - Math.floor(Date.now() / 1000));
            text += `  \u2192 ${fmtDuration(remain)}`;
        }

        return text;
    }

    clear() {
        this._data = null;
        this._lastFetch = 0;
    }
}
