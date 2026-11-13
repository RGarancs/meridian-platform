import { useEffect, useMemo, useRef, useState } from 'react';
import { MODULES } from './platform/modules';
import { LocalRepository } from './platform/store';
import { clearJson } from './platform/jsonStore';
import { RecordRef, followUps, openTasks, search } from './crm/domain';
import { seedCrm } from './crm/seed';
import { useCrm } from './crm/useCrm';
import { Companies, Contacts, Deals, Reports, SalesToday, TasksPage } from './crm/pages';
import { Autopilot, Customers, Newsletters, Service } from './crm/ai-pages';
import { PropertySettings } from './crm/props';
import { slaState, suggestions } from './crm/ai';
import { RecordPanel } from './crm/RecordPanel';
import { usePeople } from './people/usePeople';
import { Directory, Moves, PeopleOverview, PersonPanel, TimeOff } from './people/pages';
import { Hiring } from './people/hiring';
import { Bonuses, Documents, Goals, Pay, Pulse, Reviews, Skills } from './people/growth';
import { Head, Icon, Kbd, Panel, Seg, Tabs, useEscape, todayIso } from './platform/ui';

// Navigation follows the NordStreet pattern: a module sidebar, page tabs (overflow in a dropdown),
// and a secondary sidebar inside pages with sections (Settings).
type Page = { id: string; label: string; icon: string; tip?: string };
const SALES: Page[] = [
  { id: 'today', label: 'Today', icon: 'today' }, { id: 'deals', label: 'Deals', icon: 'deals' },
  { id: 'customers', label: 'Customers', icon: 'heart', tip: 'Health checked automatically, segments found automatically' },
  { id: 'service', label: 'Service', icon: 'mail', tip: 'Support inbox with drafted replies you approve' },
  { id: 'newsletters', label: 'Newsletters', icon: 'mail' }, { id: 'autopilot', label: 'Autopilot', icon: 'sparkle', tip: 'Suggested next actions, each with its reason' },
  { id: 'contacts', label: 'Contacts', icon: 'contact' }, { id: 'companies', label: 'Companies', icon: 'company' },
  { id: 'tasks', label: 'Tasks', icon: 'task' }, { id: 'reports', label: 'Reports', icon: 'chart' },
];
const PEOPLE: Page[] = [
  { id: 'overview', label: 'Overview', icon: 'today' }, { id: 'directory', label: 'Directory', icon: 'people' }, { id: 'timeoff', label: 'Time off', icon: 'calendar' },
  { id: 'documents', label: 'Documents', icon: 'doc' }, { id: 'hiring', label: 'Hiring', icon: 'hire' }, { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'reviews', label: 'Reviews', icon: 'star' }, { id: 'moves', label: 'Joiners and leavers', icon: 'door' }, { id: 'bonuses', label: 'Bonuses', icon: 'coin' },
  { id: 'skills', label: 'Skills and training', icon: 'skill' }, { id: 'pay', label: 'Pay bands', icon: 'chart' }, { id: 'pulse', label: 'Pulse', icon: 'heart' },
];
const GROUPS = [
  { id: 'sales', label: 'Sales', icon: 'deals', key: 's', pages: SALES },
  { id: 'people', label: 'People', icon: 'people', key: 'p', pages: PEOPLE },
];
const SETTINGS = [
  { id: 'brand', label: 'Brand', icon: 'sparkle' }, { id: 'properties', label: 'Customer properties', icon: 'grid' },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'settings' }, { id: 'log', label: 'Activity log', icon: 'doc' }, { id: 'data', label: 'Demo data', icon: 'trash' },
];

// White label: a partner's names and accent replace Corta Meridian's. Everything else stays.
type Accent = 'ultramarine' | 'blue' | 'mono' | 'custom';
interface Branding { name: string; short: string; accent: Accent; custom: string; theme: 'dark' | 'light' }
const ACCENTS: Record<Exclude<Accent, 'custom'>, { label: string; dark: [string, string]; light: [string, string] }> = {
  ultramarine: { label: 'Ultramarine', dark: ['#3D4BFF', '#FFFFFF'], light: ['#1F3BFF', '#FFFFFF'] },
  blue: { label: 'Blue', dark: ['#0A84FF', '#FFFFFF'], light: ['#0071E3', '#FFFFFF'] },
  mono: { label: 'Mono', dark: ['#F5F7FF', '#03050C'], light: ['#000000', '#FFFFFF'] },
};
const prefersLight = () => { try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; } };
const DEFAULT_BRAND = (): Branding => ({ name: 'Corta Meridian', short: 'Meridian', accent: 'ultramarine', custom: '#7C5CFF', theme: prefersLight() ? 'light' : 'dark' });
const loadBrand = (): Branding => {
  try {
    const b = JSON.parse(localStorage.getItem('meridian:brand:v2') ?? 'null');
    if (!b) return DEFAULT_BRAND();
    const old = !b.name || b.name === 'Meridian';
    return { ...DEFAULT_BRAND(), ...b, name: old ? 'Corta Meridian' : b.name, short: b.short ?? (old ? 'Meridian' : b.name) };
  } catch { return DEFAULT_BRAND(); }
};

type Route = { module: string; page: string; arg?: string };
function parseHash(): Route {
  // Plain #name hashes (#sales-deals, #people-timeoff, #settings-brand) so links also work inside an artifact.
  const [h, arg] = location.hash.replace(/^#\/?/, '').split('~');
  const [module, ...rest] = h.split('-');
  const page = rest.join('-');
  const g = GROUPS.find((x) => x.id === (module || 'sales'));
  if (g) return { module: g.id, page: g.pages.some((p) => p.id === page) ? page : g.pages[0].id, arg };
  if (module === 'settings' || module === 'brand') return { module: 'settings', page: SETTINGS.some((s) => s.id === page) ? page : 'brand' };
  return { module, page: '' };
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search people, deals, customers and pages'], [['/'], 'Search'], [['G', 'S'], 'Go to Sales'], [['G', 'P'], 'Go to People'], [['G', ','], 'Go to settings'],
  [['['], 'Previous tab'], [[']'], 'Next tab'], [['N'], 'The page’s main action (new deal, book time off…)'], [['T'], 'Switch light or dark'],
  [['Right-click'], 'Actions for any row, tile or card'], [['Shift', 'F10'], 'Same actions from the keyboard'], [['Esc'], 'Close the top-most panel or menu'], [['?'], 'This list'],
];

export default function App() {
  const repo = useMemo(() => new LocalRepository('demo', seedCrm), []);
  const crm = useCrm(repo, 'You');
  const hr = usePeople('You');
  const [route, setRoute] = useState<Route>(parseHash);
  const [rec, setRec] = useState<RecordRef | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [brand, setBrand] = useState<Branding>(loadBrand);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const main = useRef<HTMLElement>(null);
  const routeRef = useRef(route); routeRef.current = route;

  const go = (module: string, page?: string, arg?: string) => { location.hash = `${page ? `${module}-${page}` : module}${arg ? `~${arg}` : ''}`; };
  const toggleTheme = () => setBrand((b) => ({ ...b, theme: b.theme === 'dark' ? 'light' : 'dark' }));

  useEffect(() => {
    const on = () => { setRoute(parseHash()); main.current?.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    let gPressed = 0;
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((x) => !x); return; }
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable]') || document.querySelector('.panel, .palette, .menu')) return;
      const r = routeRef.current;
      const g = GROUPS.find((x) => x.id === r.module);
      if (Date.now() - gPressed < 900) {
        gPressed = 0;
        const target = GROUPS.find((x) => x.key === e.key.toLowerCase());
        if (target) { e.preventDefault(); go(target.id); } else if (e.key === ',') { e.preventDefault(); go('settings'); }
        return;
      }
      if (e.key === 'g') { gPressed = Date.now(); return; }
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
      else if (e.key === '?') { e.preventDefault(); setHelp(true); }
      else if (e.key === 't') toggleTheme();
      else if (e.key === 'n') { const b = document.querySelector('.content .head .btn.primary') as HTMLButtonElement | null; if (b) { e.preventDefault(); b.click(); } }
      else if ((e.key === '[' || e.key === ']') && g) {
        const i = g.pages.findIndex((p) => p.id === r.page);
        const n = g.pages[(i + (e.key === ']' ? 1 : -1) + g.pages.length) % g.pages.length];
        go(g.id, n.id);
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('keydown', key); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = brand.theme;
    const [a, ink] = brand.accent === 'custom' ? [brand.custom, '#FFFFFF'] : ACCENTS[brand.accent][brand.theme];
    root.style.setProperty('--accent', a); root.style.setProperty('--accent-ink', ink);
    document.title = brand.name;
    try { localStorage.setItem('meridian:brand:v2', JSON.stringify(brand)); } catch { /* private window */ }
  }, [brand]);

  const openPerson = (id: string) => { setRec(null); setPerson(id); };
  const openRec = (r: RecordRef) => { setPerson(null); setRec(r); };
  const t = todayIso();
  const now = new Date().toISOString();
  const counts: Record<string, number> = {
    'sales-today': followUps(crm.data, t).length + openTasks(crm.data, t).filter((x) => x.overdue || x.dueToday).length,
    'sales-service': crm.data.tickets.filter((x) => x.status === 'open' && (slaState(x, now).breached || x.priority === 'high')).length,
    'sales-autopilot': suggestions(crm.data, now).length,
    'people-timeoff': hr.data.leave.filter((r) => r.status === 'pending').length,
  };
  const moduleCount = (id: string) => Object.entries(counts).filter(([k]) => k.startsWith(`${id}-`)).reduce((s, [, v]) => s + v, 0);
  const group = GROUPS.find((g) => g.id === route.module);
  const page = group?.pages.find((p) => p.id === route.page);
  const mod = MODULES.find((m) => m.id === route.module);

  return (
    <div className="app">
      <nav className="side" aria-label="Modules">
        <div className="brand" data-tip={brand.name}><span className="brand-mark" aria-hidden />{brand.short}</div>
        <button className="find" onClick={() => setPalette(true)}><Icon name="search" size={16} />Search or jump to<kbd>⌘K</kbd></button>
        {GROUPS.map((g) => (
          <button key={g.id} className="mod" aria-current={route.module === g.id ? 'page' : undefined} onClick={() => go(g.id)} data-tip={`G then ${g.key.toUpperCase()}`}>
            <Icon name={g.icon} />{g.label}{moduleCount(g.id) ? <span className="count">{moduleCount(g.id)}</span> : null}
          </button>
        ))}
        <div className="side-label">Coming</div>
        {MODULES.filter((m) => m.status !== 'live').map((m) => (
          <button key={m.id} className="mod planned" aria-current={route.module === m.id ? 'page' : undefined} onClick={() => go(m.id)} style={{ color: 'var(--muted)', fontWeight: 400 }}>
            <Icon name="grid" size={16} />{m.name}<span className="soon">{m.status === 'next' ? 'Next' : 'Planned'}</span>
          </button>
        ))}
        <div className="side-foot">
          <button className="mod" aria-current={route.module === 'settings' ? 'page' : undefined} onClick={() => go('settings')} style={{ fontWeight: 400 }}><Icon name="settings" size={16} />Settings</button>
          <button className="mod" onClick={() => setHelp(true)} style={{ fontWeight: 400, color: 'var(--muted)' }}><Icon name="sparkle" size={16} />Shortcuts<span className="soon"><Kbd>?</Kbd></span></button>
        </div>
      </nav>
      <div className="main">
        <header className="top">
          <span className="crumb">{group ? <>{group.label} <Icon name="chevron" size={12} className="rot-90" /> <b>{page?.label}</b></> : <b>{route.module === 'settings' ? 'Settings' : mod?.name}</b>}</span>
          <div className="spacer" />
          <button className="btn sm icon ghost" aria-label="Search" onClick={() => setPalette(true)} data-tip="Search (⌘K)"><Icon name="search" /></button>
          <button className="btn sm icon ghost" onClick={toggleTheme} aria-label={brand.theme === 'dark' ? 'Switch to light' : 'Switch to dark'} data-tip={`${brand.theme === 'dark' ? 'Light' : 'Dark'} (T)`}><Icon name={brand.theme === 'dark' ? 'sun' : 'moon'} /></button>
        </header>
        <main className="content" ref={main}>
          {group && (
            <div className="page" style={{ paddingBottom: 0, gap: 0 }}>
              <Tabs label={`${group.label} pages`} value={route.page} onChange={(id) => go(group.id, id)} max={7}
                items={group.pages.map((p) => ({ id: p.id, label: p.label, count: counts[`${group.id}-${p.id}`], tip: p.tip }))} />
            </div>
          )}
          {route.module === 'sales' && route.page === 'today' && <SalesToday crm={crm} onOpen={openRec} go={(p) => go('sales', p)} />}
          {route.module === 'sales' && route.page === 'deals' && <Deals crm={crm} onOpen={openRec} />}
          {route.module === 'sales' && route.page === 'customers' && <Customers crm={crm} onOpen={openRec} />}
          {route.module === 'sales' && route.page === 'service' && <Service key={route.arg ?? 'inbox'} crm={crm} onOpen={openRec} focus={route.arg} />}
          {route.module === 'sales' && route.page === 'newsletters' && <Newsletters crm={crm} />}
          {route.module === 'sales' && route.page === 'autopilot' && <Autopilot crm={crm} go={(p, arg) => go('sales', p, arg)} />}
          {route.module === 'sales' && route.page === 'companies' && <Companies crm={crm} onOpen={openRec} />}
          {route.module === 'sales' && route.page === 'contacts' && <Contacts crm={crm} onOpen={openRec} />}
          {route.module === 'sales' && route.page === 'tasks' && <TasksPage crm={crm} onOpen={openRec} />}
          {route.module === 'sales' && route.page === 'reports' && <Reports crm={crm} />}
          {route.module === 'people' && route.page === 'overview' && <PeopleOverview hr={hr} go={(p) => go('people', p)} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'directory' && <Directory hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'timeoff' && <TimeOff hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'documents' && <Documents hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'hiring' && <Hiring hr={hr} />}
          {route.module === 'people' && route.page === 'moves' && <Moves hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'goals' && <Goals hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'reviews' && <Reviews hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'bonuses' && <Bonuses hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'skills' && <Skills hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'pay' && <Pay hr={hr} onPerson={openPerson} />}
          {route.module === 'people' && route.page === 'pulse' && <Pulse hr={hr} />}
          {route.module === 'settings' && <Settings section={route.page} go={(s) => go('settings', s)} brand={brand} setBrand={setBrand} crm={crm} audit={repo.auditLog()} onReset={() => { repo.reset(); clearJson('people'); location.reload(); }} />}
          {mod && mod.status !== 'live' && (
            <div className="page">
              <Head eyebrow={mod.status === 'next' ? 'Building next' : 'Planned'} title={`${mod.name}: ${mod.oneLine.toLowerCase()}.`} lede="It folds in tools that already exist, on the same design and the same rules as Sales and People." />
              <div className="card tight"><div className="rows">{mod.buildsOn.map((b) => <div key={b} className="row" style={{ cursor: 'default' }}><Icon name="check" /><div className="grow"><div className="t">{b}</div></div></div>)}</div></div>
            </div>
          )}
        </main>
      </div>
      {rec && <RecordPanel crm={crm} refr={rec} onClose={() => setRec(null)} onOpen={openRec} />}
      {person && <PersonPanel hr={hr} id={person} onClose={() => setPerson(null)} onPerson={openPerson} go={(p) => go('people', p)} />}
      {palette && <Palette crm={crm} hr={hr} onClose={() => setPalette(false)} onRec={openRec} onPerson={openPerson} go={go} toggleTheme={toggleTheme} />}
      {help && <Panel title="Keyboard shortcuts" eyebrow="Faster without the mouse" onClose={() => setHelp(false)}><ShortcutList /></Panel>}
    </div>
  );
}

function ShortcutList() {
  return <div className="keys">{SHORTCUTS.map(([k, d]) => <div key={d} style={{ display: 'contents' }}><span>{d}</span><span className="k">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</span></div>)}</div>;
}

type Hit = { key: string; group: string; label: string; sub?: string; icon: string; run: () => void };

function Palette({ crm, hr, onClose, onRec, onPerson, go, toggleTheme }: {
  crm: ReturnType<typeof useCrm>; hr: ReturnType<typeof usePeople>; onClose: () => void; onRec: (r: RecordRef) => void; onPerson: (id: string) => void; go: (m: string, p?: string, a?: string) => void; toggleTheme: () => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  useEscape(onClose);
  const s = q.trim().toLowerCase();
  const hits: Hit[] = useMemo(() => {
    const pages = GROUPS.flatMap((g) => g.pages.map((p) => ({ key: `${g.id}-${p.id}`, group: 'Go to', label: `${g.label} › ${p.label}`, icon: p.icon, run: () => go(g.id, p.id) })));
    const extra: Hit[] = [
      ...SETTINGS.map((x) => ({ key: `settings-${x.id}`, group: 'Go to', label: `Settings › ${x.label}`, icon: 'settings', run: () => go('settings', x.id) })),
      { key: 'theme', group: 'Do', label: 'Switch light or dark', icon: 'sun', run: toggleTheme },
    ];
    if (!s) return [...pages.filter((p) => ['sales-today', 'sales-autopilot', 'sales-service', 'people-overview', 'people-timeoff'].includes(p.key)), extra[extra.length - 1]];
    const people = hr.data.people.filter((p) => `${p.name} ${p.title} ${p.team}`.toLowerCase().includes(s)).slice(0, 6)
      .map((p) => ({ key: `p${p.id}`, group: 'People', label: p.name, sub: `${p.title} · ${p.team}`, icon: 'contact', run: () => onPerson(p.id) }));
    const recs = search(crm.data, q).slice(0, 8).map((h) => ({ key: `${h.ref.kind}${h.ref.id}`, group: 'Sales', label: h.label, sub: h.sub, icon: h.ref.kind === 'deal' ? 'deals' : h.ref.kind === 'company' ? 'company' : 'contact', run: () => onRec(h.ref) }));
    const tickets = crm.data.tickets.filter((t) => t.subject.toLowerCase().includes(s)).slice(0, 4).map((t) => ({ key: `t${t.id}`, group: 'Service', label: t.subject, sub: t.status, icon: 'mail', run: () => go('sales', 'service', t.id) }));
    return [...people, ...recs, ...tickets, ...[...pages, ...extra].filter((p) => p.label.toLowerCase().includes(s))];
  }, [s, q, crm.data, hr.data, go, onPerson, onRec, toggleTheme]);
  const pick = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  let lastGroup = '';
  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus value={q} placeholder="Search people, deals, customers, tickets or pages" aria-label="Search"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
            if (e.key === 'Enter') pick(hits[sel]);
          }} />
        <div className="results" role="listbox">
          {hits.length === 0 && <div className="sub" style={{ padding: 16 }}>Nothing matches “{q}”.</div>}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? <div className="grp">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={h.key}>
                {head}
                <button className="hit" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => pick(h)}>
                  <Icon name={h.icon} size={16} /><span className="grow">{h.label}</span>{h.sub && <span className="sub">{h.sub}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="sub" style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 14 }}><span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span><span><Kbd>↵</Kbd> open</span><span><Kbd>Esc</Kbd> close</span><span style={{ marginLeft: 'auto' }}><Kbd>?</Kbd> all shortcuts</span></div>
      </div>
    </div>
  );
}

function Settings({ section, go, brand, setBrand, crm, audit, onReset }: { section: string; go: (s: string) => void; brand: Branding; setBrand: (b: Branding) => void; crm: ReturnType<typeof useCrm>; audit: string[]; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const cur = SETTINGS.find((s) => s.id === section) ?? SETTINGS[0];
  return (
    <div className="page">
      <Head eyebrow="Settings" title={cur.id === 'brand' ? 'Your brand on the platform.' : cur.label} />
      <div className="split">
        <nav className="subnav" aria-label="Settings sections">
          <div className="sub-label">Workspace</div>
          {SETTINGS.slice(0, 2).map((s) => <button key={s.id} aria-current={s.id === cur.id} onClick={() => go(s.id)}><Icon name={s.icon} size={16} />{s.label}</button>)}
          <div className="sub-label">You</div>
          {SETTINGS.slice(2).map((s) => <button key={s.id} aria-current={s.id === cur.id} onClick={() => go(s.id)}><Icon name={s.icon} size={16} />{s.label}</button>)}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {cur.id === 'brand' && (
            <div className="card">
              <p className="sub" style={{ marginTop: 0 }}>Partners sell this platform under their own name. Change the names and accent and every page follows. Approvals, sources and the activity log stay the same under any brand.</p>
              <div className="form">
                <div className="row2">
                  <div className="field"><label htmlFor="bn"><span data-tip="Page titles, emails and documents." tabIndex={0}>Full name</span></label><input id="bn" className="input" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value || 'Corta Meridian' })} /></div>
                  <div className="field"><label htmlFor="bs"><span data-tip="The sidebar and tight spaces." tabIndex={0}>Short name</span></label><input id="bs" className="input" value={brand.short} onChange={(e) => setBrand({ ...brand, short: e.target.value || 'Meridian' })} /></div>
                </div>
                <div className="field"><label>Appearance</label><Seg label="Appearance" value={brand.theme} onChange={(v) => setBrand({ ...brand, theme: v })} options={[{ id: 'dark', label: 'Dark navy' }, { id: 'light', label: 'Black and white' }]} /></div>
                <div className="field">
                  <label>Accent</label>
                  <div className="toolbar">
                    {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map((k) => (
                      <button key={k} className="btn" aria-pressed={brand.accent === k} onClick={() => setBrand({ ...brand, accent: k })} style={brand.accent === k ? { borderColor: 'var(--accent)' } : undefined}>
                        <span className="swatch" style={{ width: 16, height: 16, background: ACCENTS[k][brand.theme][0], cursor: 'inherit' }} />{ACCENTS[k].label}
                      </button>
                    ))}
                    <label className="btn" style={brand.accent === 'custom' ? { borderColor: 'var(--accent)' } : undefined}>
                      <input type="color" value={brand.custom} onChange={(e) => setBrand({ ...brand, accent: 'custom', custom: e.target.value })} style={{ width: 18, height: 18, padding: 0, border: 0, background: 'none' }} aria-label="Partner colour" />Partner colour
                    </label>
                  </div>
                </div>
                <div><button className="btn ghost" onClick={() => setBrand({ ...DEFAULT_BRAND(), theme: brand.theme })}>Back to Corta Meridian</button></div>
              </div>
            </div>
          )}
          {cur.id === 'properties' && <PropertySettings crm={crm} />}
          {cur.id === 'shortcuts' && <div className="card"><ShortcutList /></div>}
          {cur.id === 'log' && (
            <div className="card">
              <p className="sub" style={{ marginTop: 0 }}>Every Sales change is recorded with who made it. Erasing a contact is logged without their personal data.</p>
              {audit.length === 0 ? <div className="sub">Nothing yet.</div> : <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 420, overflow: 'auto', margin: 0, color: 'var(--body)' }}>{audit.slice(-60).reverse().join('\n')}</pre>}
            </div>
          )}
          {cur.id === 'data' && (
            <div className="card">
              <p className="sub" style={{ marginTop: 0 }}>All names and companies in this demo are invented. Changes you make stay in this browser only.</p>
              <div className="toolbar">
                {confirm ? <><span className="sub">Every change you made in this demo will be lost.</span><button className="btn danger" onClick={onReset}>Reset now</button><button className="btn ghost" onClick={() => setConfirm(false)}>Keep my changes</button></>
                  : <button className="btn ghost danger" onClick={() => setConfirm(true)}>Reset the example data</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
