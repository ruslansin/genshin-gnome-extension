import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const API_BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api';
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';
const RESIN_SECONDS = 480;
const COIN_SECONDS = 900;
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

function fmtDuration(seconds) {
    if (seconds <= 0) return 'Done';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function fmtCompact(seconds) {
    if (seconds <= 0) return 'Full';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m}m`;
    return `${m}m`;
}

function fmtTimer(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default class GenshinResinExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._session = new Soup.Session();
        this._cachedData = null;
        this._cachedTimestamp = 0;

        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        const box = new St.BoxLayout({vertical: false});

        const iconFile = Gio.File.new_for_path(this.path + '/assets/resin.svg');
        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            style_class: 'genshin-resin-icon',
            icon_size: 16,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._icon);

        this._label = new St.Label({
            text: '--/--',
            style_class: 'genshin-resin-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        this._indicator.add_child(box);

        const position = this._settings.get_int('panel-position');
        const boxSide = this._settings.get_string('panel-box') || 'right';
        Main.panel.addToStatusArea(this.uuid, this._indicator, position, boxSide);

        this._buildMenu();
        this._updateLabel();

        const pollInterval = this._settings.get_int('poll-interval') || 300;
        this._pollSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, pollInterval,
            () => { this._fetchNotes(); return GLib.SOURCE_CONTINUE; });

        this._labelSource = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 60,
            () => { this._updateLabel(); return GLib.SOURCE_CONTINUE; });

        this._tickSource = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1000,
            () => { this._updateNextTick(); return GLib.SOURCE_CONTINUE; });

        this._fetchNotes();
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

        this._icon?.destroy();
        this._label?.destroy();
        this._resinItem?.destroy();
        this._nextTickItem?.destroy();
        this._commItem?.destroy();
        this._bossItem?.destroy();
        this._expHeader?.destroy();
        this._coinItem?.destroy();
        this._transformerItem?.destroy();
        this._errorItem?.destroy();
        this._expItems?.forEach(i => i?.destroy());
        this._indicator?.destroy();

        this._icon = null;
        this._label = null;
        this._resinItem = null;
        this._nextTickItem = null;
        this._commItem = null;
        this._bossItem = null;
        this._expHeader = null;
        this._coinItem = null;
        this._transformerItem = null;
        this._errorItem = null;
        this._expItems = null;
        this._indicator = null;
        this._session = null;
        this._settings = null;
        this._cachedData = null;
        this._cachedTimestamp = 0;
    }

    _buildMenu() {
        const menu = this._indicator.menu;

        this._resinItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._resinItem);

        this._nextTickItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._nextTickItem);

        this._commItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._commItem);

        this._bossItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._bossItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._expHeader = new PopupMenu.PopupMenuItem('Expeditions', {reactive: false});
        menu.addMenuItem(this._expHeader);
        this._expItems = [];
        for (let i = 0; i < 5; i++) {
            const item = new PopupMenu.PopupMenuItem('', {reactive: false});
            this._expItems.push(item);
            menu.addMenuItem(item);
        }

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._coinItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._coinItem);

        this._transformerItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._transformerItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._errorItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._errorItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        menu.addAction('Refresh Now', () => this._fetchNotes());
        menu.addAction('Preferences', () => this.openPreferences());
    }

    _fetchNotes() {
        const uidStr = this._settings.get_string('uid');
        const server = this._settings.get_string('server');
        const ltuid = this._settings.get_string('ltuid');
        const ltoken = this._settings.get_string('ltoken');
        const ltmid = this._settings.get_string('ltmid');
        const accountId = this._settings.get_string('account-id');
        const cookieToken = this._settings.get_string('cookie-token');

        if (!uidStr || uidStr === '0') {
            this._updateError('No UID configured');
            return;
        }
        if (!ltoken || !ltuid) {
            this._updateError('Missing ltuid_v2 / ltoken_v2');
            return;
        }

        try {
            const ds = generateDS();
            const url = `${API_BASE}/dailyNote?role_id=${uidStr}&server=${server}`;
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

            this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null,
                (session, result) => this._onResponse(session, result, msg));
        } catch (e) {
            console.error(`[genshin-resin] fetch error: ${e.message}`);
            this._updateError(`Request failed: ${e.message}`);
        }
    }

    _onResponse(session, result, msg) {
        try {
            const bytes = session.send_and_read_finish(result);
            const status = msg.get_status();

            if (!bytes || status !== Soup.Status.OK) {
                this._updateError(`HTTP ${status}`);
                return;
            }

            const body = new TextDecoder().decode(bytes.get_data());
            const data = JSON.parse(body);

            if (data.retcode !== 0) {
                this._updateError(`${data.message} (${data.retcode})`);
                return;
            }

            const d = data.data;

            this._settings.set_int('last-resin', d.current_resin);
            this._settings.set_int('max-resin', d.max_resin);
            this._settings.set_value('last-update-ts',
                GLib.Variant.new_int64(Math.floor(Date.now() / 1000)));

            this._cachedData = d;
            this._cachedTimestamp = Math.floor(Date.now() / 1000);

            this._updateError('');
            this._updateLabel();
            this._updateMenu(d);
            this._updateNextTick();
        } catch (e) {
            console.error(`[genshin-resin] parse error: ${e.message}`);
            this._updateError(`Parse error: ${e.message}`);
        }
    }

    _updateMenu(d) {
        if (!d) return;

        const resin = d.current_resin;
        const maxResin = d.max_resin;
        const resinSec = Math.max(0, parseInt(d.remaining_resin_recovery_time, 10) || 0);

        if (this._resinItem)
            this._resinItem.label.text = `\u25C6 Resin: ${resin}/${maxResin}  \u2192 ${fmtDuration(resinSec)}`;

        const done = d.finished_task_num || 0;
        const total = d.total_task_num || 4;
        const claimed = d.is_extra_task_reward_received;
        if (this._commItem)
            this._commItem.label.text = `\u2714 Commissions: ${done}/${total}${claimed ? ' (claimed)' : ''}`;

        const disc = d.remain_resin_discount_num || 0;
        const discMax = d.resin_discount_num_limit || 3;
        if (this._bossItem)
            this._bossItem.label.text = `\u2694 Weekly Bosses: ${disc}/${discMax} remaining`;

        const exps = d.expeditions || [];
        for (let i = 0; i < 5; i++) {
            if (!this._expItems[i]) continue;
            if (i < exps.length) {
                const e = exps[i];
                const remain = parseInt(e.remained_time, 10) || 0;
                const done = e.status === 'Finished';
                this._expItems[i].label.text =
                    `   ${done ? '\u2713' : '\u23F3'} ${done ? 'Done' : fmtTimer(remain)}`;
                this._expItems[i].visible = true;
            } else {
                this._expItems[i].visible = false;
            }
        }
        if (this._expHeader)
            this._expHeader.label.text = `Expeditions: ${d.current_expedition_num || 0}/${d.max_expedition_num || 5}`;

        const coin = d.current_home_coin || 0;
        const maxCoin = d.max_home_coin || 2400;
        const coinSec = Math.max(0, parseInt(d.home_coin_recovery_time, 10) || 0);
        if (this._coinItem)
            this._coinItem.label.text = `\u2302 Realm Currency: ${coin}/${maxCoin}  \u2192 ${fmtDuration(coinSec)}`;

        if (this._transformerItem) {
            const tr = d.transformer;
            if (tr && tr.obtained) {
                const rt = tr.recovery_time || {};
                if (rt.reached) {
                    this._transformerItem.label.text = '\u2697 Transformer: Ready!';
                } else {
                    const h = rt.Hour || 0;
                    const m = rt.Minute || 0;
                    const s = rt.Second || 0;
                    this._transformerItem.label.text =
                        `\u2697 Transformer: ${h}h ${m}m ${s}s`;
                }
            } else {
                this._transformerItem.label.text = '\u2697 Transformer: Not obtained';
            }
        }
    }

    _getEstimatedResin() {
        const maxResin = this._settings.get_int('max-resin') || 200;
        const lastResin = this._settings.get_int('last-resin') || 0;

        let lastUpdate = 0;
        try {
            lastUpdate = this._settings.get_value('last-update-ts').get_int64();
        } catch (_) {
            return {current: 0, max: maxResin, remaining: 0};
        }

        if (lastUpdate === 0)
            return {current: lastResin, max: maxResin, remaining: 0};

        const elapsed = Math.floor(Date.now() / 1000) - lastUpdate;
        const regenerated = Math.floor(elapsed / RESIN_SECONDS);
        const current = Math.min(lastResin + regenerated, maxResin);
        const remaining = Math.max(0,
            (maxResin - current) * RESIN_SECONDS - (elapsed % RESIN_SECONDS));
        const nextTick = current >= maxResin ? 0 :
            Math.max(0, RESIN_SECONDS - (elapsed % RESIN_SECONDS));

        return {current, max: maxResin, remaining, nextTick};
    }

    _updateError(msg) {
        if (!this._errorItem) return;
        if (msg) {
            this._errorItem.label.text = msg;
            this._errorItem.visible = true;
            this._label.style = 'color: #cc0000';
        } else {
            this._errorItem.visible = false;
        }
    }

    _updateLabel() {
        const {current, max, remaining} = this._getEstimatedResin();
        this._label.text = `${current}/${max}`;

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

        if (this._errorItem && !this._errorItem.visible) {
            if (current >= max)
                this._label.style = 'color: #4e9a06';
            else if (current >= max * 0.9)
                this._label.style = 'color: #fce94f';
            else
                this._label.style = '';
        }
    }

    _updateNextTick() {
        const {nextTick} = this._getEstimatedResin();
        if (!this._nextTickItem) return;
        this._nextTickItem.label.text = nextTick > 0
            ? `\u21BB Next resin: ${fmtTimer(nextTick)}`
            : '';
        this._nextTickItem.visible = nextTick > 0;
    }
}
