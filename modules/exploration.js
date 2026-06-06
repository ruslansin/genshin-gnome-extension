import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from './module.js';

export const key = 'exploration';
export const label = 'Exploration Progress';

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

function childName(parent, child) {
    const prefix = parent + ': ';
    if (child.startsWith(prefix))
        return child.substring(prefix.length);
    return child;
}

const MAX_ITEMS = 20;

export default class ExplorationModule extends Module {
    constructor(menu, session, account) {
        super(menu, session, account);
        this._data = null;
        this._lastFetch = 0;
    }

    get _hideDone() {
        return this._account?.modules?.hide_exploration_done === true;
    }

    build() {
        this._header = new PopupMenu.PopupMenuItem('Exploration', {reactive: false});
        this._menu.addMenuItem(this._header);
        this._items.push(this._header);

        this._regionItems = [];
        for (let i = 0; i < MAX_ITEMS; i++) {
            const item = new PopupMenu.PopupMenuItem('', {reactive: false});
            this._regionItems.push(item);
            this._menu.addMenuItem(item);
            this._items.push(item);
        }
    }

    update(_d) {
        const now = Math.floor(Date.now() / 1000);
        if (now - this._lastFetch > 300)
            this._fetch();

        this._render();
    }

    _fetch() {
        if (!this._session || !this._account) return;

        const {uid, server, ltuid, ltoken, ltmid, accountId, cookieToken} =
            this._account;

        if (!uid || uid === '0' || !ltoken || !ltuid) return;

        try {
            const ds = genDS();
            const url = `${API_BASE}/index?role_id=${uid}&server=${server}`;
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
            this._render();
        } catch (_) {}
    }

    _render() {
        const regions = this._data?.world_explorations || [];

        if (regions.length === 0) {
            this._header.label.text = 'Exploration: No data';
            for (const item of this._regionItems)
                item.visible = false;
            return;
        }

        // Build id->region and parent->children maps
        const byId = new Map();
        const children = new Map();
        for (const r of regions) {
            byId.set(r.id, r);
            if (r.parent_id > 0) {
                if (!children.has(r.parent_id))
                    children.set(r.parent_id, []);
                children.get(r.parent_id).push(r);
            }
        }

        // Sort roots newest-first for stable display
        const roots = [...regions.filter(r => r.parent_id === 0)];
        roots.sort((a, b) => b.id - a.id);

        // Flatten: each parent followed by its children indented
        const display = [];
        let completed = 0;
        let totalPct = 0;

        for (const r of roots) {
            const pct = (r.exploration_percentage || 0) / 10;
            totalPct += pct;
            if (pct >= 100)
                completed++;

            const kids = children.get(r.id) || [];
            const kidEntries = [];
            for (const kid of kids) {
                const kp = (kid.exploration_percentage || 0) / 10;
                totalPct += kp;
                if (kp >= 100)
                    completed++;
                if (!this._hideDone || kp < 100)
                    kidEntries.push({name: `   ${childName(r.name, kid.name)}`, pct: kp});
            }

            if (!this._hideDone || pct < 100 || kidEntries.length > 0) {
                if (!this._hideDone || pct < 100)
                    display.push({name: r.name, pct});
                for (const ke of kidEntries)
                    display.push(ke);
            }
        }

        const all = regions.length;
        const avg = all > 0 ? (totalPct / all).toFixed(1) : '0';
        this._header.label.text =
            `Exploration: ${completed}/${all} complete (avg ${avg}%)`;

        for (let i = 0; i < this._regionItems.length; i++) {
            if (i < display.length) {
                const d = display[i];
                this._regionItems[i].label.text =
                    `${d.name}: ${d.pct.toFixed(1)}%`;
                this._regionItems[i].visible = true;
            } else {
                this._regionItems[i].visible = false;
            }
        }
    }

    clear() {
        this._data = null;
        this._lastFetch = 0;
    }
}
