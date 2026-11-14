// Interface language. English is the source text and the key; other languages map English to their text.
// The language is read once when the app starts, so switching saves the choice and reloads the page.
// A missing translation falls back to English, so a new string never breaks a page.
import { LV } from './lang-lv';

export type Lang = 'en' | 'lv';
export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: 'en', label: 'English', locale: 'en-GB' },
  { id: 'lv', label: 'Latviešu', locale: 'lv-LV' },
];
const KEY = 'meridian:lang';
// English needs entries only where one word has two meanings, e.g. the verb "Open" and the status "Open".
const EN: Record<string, string> = { 'Open (status)': 'Open' };
const DICTS: Record<Lang, Record<string, string>> = { en: EN, lv: LV };

const read = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'lv' || v === 'en' ? v : 'en';
  } catch { return 'en'; }
};
let current: Lang = read();

export const lang = () => current;
export const locale = () => LANGS.find((l) => l.id === current)!.locale;
export function setLang(l: Lang, reload = true) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private window */ }
  try { document.documentElement.lang = l; } catch { /* not in a browser */ }
  if (reload) location.reload();
}
try { document.documentElement.lang = current; } catch { /* not in a browser */ }

/** Translate an English interface string. `{name}` placeholders are filled from vars. */
export function tr(s: string, vars?: Record<string, string | number | null | undefined>): string {
  const out = DICTS[current][s] ?? s;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** "3 deals" / "3 darījumi". Latvian: 1, 21, 31… take the singular; 11 does not. */
export function count(n: number, one: string, many: string = `${one}s`): string {
  const lvOne = n % 10 === 1 && n % 100 !== 11;
  const word = current === 'lv' ? (lvOne ? tr(one) : tr(many)) : n === 1 ? one : many;
  return `${n} ${word}`;
}

/** Put the euro sign where the language puts it: €12,400 in English, 12 400 € in Latvian. */
export const euro = (num: string) => (current === 'lv' ? `${num} €` : `€${num}`);
/** Decimal comma in Latvian. */
export const dec = (n: number, digits: number) => n.toFixed(digits).replace('.', current === 'lv' ? ',' : '.');
