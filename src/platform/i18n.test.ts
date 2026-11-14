import { describe, expect, it, afterEach } from 'vitest';
import { LV } from './lang-lv';
import { count, euro, setLang, tr } from './i18n';

// Vite reads every source file as text, so this test needs no Node file APIs.
const SOURCES = (import.meta as unknown as { glob: (p: string, o: object) => Record<string, string> })
  .glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

/** Every English string passed to tr(), plural() or count() in the app. */
function sourceKeys(): string[] {
  const keys = new Set<string>();
  const unq = (s: string) => JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"` : s);
  for (const [f, src] of Object.entries(SOURCES)) {
    if (/\.test\.|seed|lang-lv/.test(f)) continue;
    for (const m of src.matchAll(/\btr\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) keys.add(unq(m[1]));
    for (const m of src.matchAll(/\b(?:plural|count)\([^,]+,\s*('(?:[^'\\]|\\.)*')(?:,\s*('(?:[^'\\]|\\.)*'))?\)/g)) {
      const one = unq(m[1]);
      keys.add(one); keys.add(m[2] ? unq(m[2]) : `${one}s`);
    }
  }
  return [...keys];
}

afterEach(() => setLang('en', false));

describe('Latvian interface text', () => {
  it('has a Latvian text for every interface string', () => {
    const keys = sourceKeys();
    expect(keys.length).toBeGreaterThan(500);
    const missing = keys.filter((k) => !(k in LV));
    expect(missing).toEqual([]);
  });
  it('keeps the same {placeholders} as the English', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const off = Object.entries(LV).filter(([en, lv]) => ph(lv) !== ph(en) && !/\{1\}/.test(en)).map(([en]) => en);
    expect(off).toEqual([]);
  });
});

describe('tr and count', () => {
  it('falls back to English and fills placeholders', () => {
    setLang('lv', false);
    expect(tr('Deals')).toBe('Darījumi');
    expect(tr('Not a key {0}', { 0: 5 })).toBe('Not a key 5');
    expect(tr('Quiet for {0} days', { 0: 40 })).toBe('Klusums 40 dienas');
  });
  it('uses the Latvian singular for 1, 21, 31 but not 11', () => {
    setLang('lv', false);
    expect(count(1, 'deal')).toBe('1 darījums');
    expect(count(21, 'deal')).toBe('21 darījums');
    expect(count(11, 'deal')).toBe('11 darījumi');
    expect(count(3, 'deal')).toBe('3 darījumi');
    setLang('en', false);
    expect(count(1, 'deal')).toBe('1 deal');
    expect(count(21, 'deal')).toBe('21 deals');
  });
  it('puts the euro sign where each language puts it', () => {
    expect(euro('1,200')).toBe('€1,200');
    setLang('lv', false);
    expect(euro('1 200')).toBe('1 200 €');
  });
});
