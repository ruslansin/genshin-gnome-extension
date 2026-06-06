import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SUPPORTED = [
    'en', 'ru', 'zh_cn', 'zh_tw', 'ja', 'ko', 'th', 'vi',
    'de', 'fr', 'es', 'pt', 'id', 'tr', 'it',
];
const API_LANG_MAP = {
    en: 'en-us', ru: 'ru-ru', zh_cn: 'zh-cn', zh_tw: 'zh-tw',
    ja: 'ja-jp', ko: 'ko-kr', th: 'th-th', vi: 'vi-vn',
    de: 'de-de', fr: 'fr-fr', es: 'es-es', pt: 'pt-pt',
    id: 'id-id', tr: 'tr-tr', it: 'it-it',
};

let _lang = 'en';
let _cache = {};
let _inited = false;

function _detectSystemLang() {
    const names = GLib.get_language_names();
    for (const name of names) {
        const parts = name.split(/[_.@]/);
        const short = parts[0];
        // Chinese locales have region suffix: zh_CN, zh_TW
        if (short === 'zh' && parts[1]) {
            const full = short + '_' + parts[1].toLowerCase();
            if (SUPPORTED.includes(full))
                return full;
        }
        if (SUPPORTED.includes(short))
            return short;
    }
    return 'en';
}

function _loadFromDisk(lang) {
    const dir = GLib.build_filenamev(
        [import.meta.url.replace('file://', '').replace('/modules/i18n.js', ''),
            'translations', lang]);
    const d = Gio.File.new_for_path(dir);
    try {
        const e = d.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        const result = {};
        while ((info = e.next_file(null)) !== null) {
            const name = info.get_name();
            if (!name.endsWith('.json')) continue;
            const mod = name.replace('.json', '');
            const file = Gio.File.new_for_path(GLib.build_filenamev([dir, name]));
            const [ok, contents] = file.load_contents(null);
            if (ok) {
                try {
                    result[mod] = JSON.parse(new TextDecoder().decode(contents));
                } catch (_) {}
            }
        }
        e.close(null);
        _cache = result;
        return result;
    } catch (_) {
        return {};
    }
}

function _init() {
    const lang = _detectSystemLang();
    _lang = lang;
    _cache = _loadFromDisk(lang);
    _inited = true;
}

_init();

export function setLanguage(value) {
    let lang;
    if (value === 'system')
        lang = _detectSystemLang();
    else if (SUPPORTED.includes(value))
        lang = value;
    else
        lang = 'en';

    if (lang !== _lang) {
        _lang = lang;
        _cache = _loadFromDisk(lang);
    }
}

export function apiLang() {
    return API_LANG_MAP[_lang] || 'en-us';
}

export function T(key, fallback) {
    const [mod, str] = key.split('.');
    return _cache[mod]?.[str] || fallback || key;
}

export function currentLang() {
    return _lang;
}
