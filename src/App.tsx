import { useEffect, useMemo, useRef, useState } from 'react';
import { MODULES } from './platform/modules';
import { LocalRepository } from './platform/store';
import { clearJson } from './platform/jsonStore';
import { RecordRef, followUps, openTasks, search } from './crm/domain';
import { seedCrm } from './crm/seed';
import { useCrm } from './crm/useCrm';
import { Companies, Contacts, Deals, Reports, SalesToday, TasksPage } from './crm/pages';
import { RecordPanel } from './crm/RecordPanel';
import { usePeople } from './people/usePeople';
import { Directory, Moves, PeopleOverview, PersonPanel, TimeOff } from './people/pages';
import { Hiring } from './people/hiring';
import { Bonuses, Documents, Goals, Pay, Pulse, Reviews, Skills } from './people/growth';
import { Head, Icon, Seg, useEscape, todayIso } from './platform/ui';

type Page = { id: string; label: string; icon: string };
const SALES: Page[] = [
  { id: 'today', label: 'Today', icon: 'today' }, { id: 'deals', label: 'Deals', icon: 'deals' }, { id: 'companies', label: 'Companies', icon: 'company' },
  { id: 'contacts', label: 'Contacts', icon: 'contact' }, { id: 'tasks', label: 'Tasks', icon: 'task' }, { id: 'reports', label: 'Reports', icon: 'chart' },
];
const PEOPLE: Page[] = [
  { id: 'overview', label: 'Overview', icon: 'today' }, { id: 'directory', label: 'Directory', icon: 'people' }, { id: 'timeoff', label: 'Time off', icon: 'calendar' },
  { id: 'documents', label: 'Documents', icon: 'doc' }, { id: 'hiring', label: 'Hiring', icon: 'hire' }, { id: 'moves', label: 'Joiners and leavers', icon: 'door' },
  { id: 'goals', label: 'Goals', icon: 'target' }, { id: 'reviews', label: 'Reviews and feedback', icon: 'star' }, { id: 'bonuses', label: 'Bonuses', icon: 'coin' },
  { id: 'skills', label: 'Skills and training', icon: 'skill' }, { id: 'pay', label: 'Pay bands', icon: 'chart' }, { id: 'pulse', label: 'Pulse', icon: 'heart' },
];
const GROUPS = [{ id: 'sales', label: 'Sales', icon: 'deals', pages: SALES }, { id: 'people', label: 'People', icon: 'people', pages: PEOPLE }];

// White label: a partner's name and accent replace Meridian's. Everything else stays.
type Accent = 'ultramarine' | 'blue' | 'mono' | 'custom';
interface Branding { name: string; accent: Accent; custom: string; theme: 'dark' | 'light' }
const ACCENTS: Record<Exclude<Accent, 'custom'>, { label: string; dark: [string, string]; light: [string, string] }> = {
  ultramarine: { label: 'Ultramarine', dark: ['#3D4BFF', '#FFFFFF'], light: ['#1F3BFF', '#FFFFFF'] },
  blue: { label: 'Blue', dark: ['#0A84FF', '#FFFFFF'], light: ['#0071E3', '#FFFFFF'] },
  mono: { label: 'Mono', dark: ['#F5F7FF', '#03050C'], light: ['#000000', '#FFFFFF'] },
};
const prefersLight = () => { try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; } };
const DEFAULT_BRAND = (): Branding => ({ name: 'Meridian', accent: 'ultramarine', custom: '#7C5CFF', theme: prefersLight() ? 'light' : 'dark' });
const loadBrand = (): Branding => {
  try { const b = JSON.parse(localStorage.getItem('meridian:brand:v2') ?? 'null'); return b ? { ...DEFAULT_BRAND(), ...b } : DEFAULT_BRAND(); } catch { return DEFAULT_BRAND(); }
};

type Route = { module: string; page: string };
function parseHash(): Route {
  // Plain #name hashes (#sales-deals, #people-timeoff, #brand) so links also work inside an artifact.
  const h = location.hash.replace(/^#\/?/, '');
  const [module, ...rest] = h.split('-');
  const page = rest.join('-');
  const g = GROUPS.find((x) => x.id === (module || 'sales'));
  if (g) return { module: g.id, page: g.pages.some((p) => p.id === page) ? page : g.pages[0].id };
  return { module, page: '' };
}

export default function App() {
  const repo = useMemo(() => new LocalRepository('demo', seedCrm), []);
  const crm = useCrm(repo, 'You');
  const hr = usePeople('You');
  const [route, setRoute] = useState<Route>(parseHash);
  const [rec, setRec] = useState<RecordRef | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [brand, setBrand] = useState<Branding>(loadBrand);
  const [palette, setPalette] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const on = () => { setRoute(parseHash()); main.current?.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((x) => !x); } };
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

  const go = (module: string, page?: string) => { location.hash = page ? `${module}-${page}` : module; };
  const openPerson = (id: string) => { setRec(null); setPerson(id); };
  const openRec = (r: RecordRef) => { setPerson(null); setRec(r); };
  const t = todayIso();
  const counts: Record<string, number> = {
    'sales-today': followUps(crm.data, t).length + openTasks(crm.data, t).filter((x) => x.overdue || x.dueToday).length,
    'people-timeoff': hr.data.leave.filter((r) => r.status === 'pending').length,
  };
  const group = GROUPS.find((g) => g.id === route.module);
  const pageLabel = group?.pages.find((p) => p.id === route.page)?.label;
  const mod = MODULES.find((m) => m.id === route.module);
  const toggleTheme = () => setBrand({ ...brand, theme: brand.theme === 'dark' ? 'light' : 'dark' });

  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="brand"><span className="brand-mark" aria-hidden />{brand.name}</div>
        <button className="find" onClick={() => setPalette(true)}><Icon name="search" size={16} />Search or jump to<kbd>⌘K</kbd></button>
        {GROUPS.map((g) => (
          <div key={g.id} style={{ display: 'contents' }}>
            <button className="group" aria-expanded={!closed[g.id]} onClick={() => setClosed({ ...closed, [g.id]: !closed[g.id] })}>
              <Icon name={g.icon} />{g.label}<Icon name="chevron" size={14} className="chev" />
            </button>
            {!closed[g.id] && g.pages.map((p) => (
              <button key={p.id} className={`nav ${route.module === g.id ? '' : 'other-group'}`} aria-current={route.module === g.id && route.page === p.id ? 'page' : undefined} onClick={() => go(g.id, p.id)}>
                <span>{p.label}</span>{counts[`${g.id}-${p.id}`] ? <span className="count">{counts[`${g.id}-${p.id}`]}</span> : null}
              </button>
            ))}
          </div>
        ))}
        <div className="side-label">Coming</div>
        {MODULES.filter((m) => m.status !== 'live').map((m) => (
          <button key={m.id} className="nav module" aria-current={route.module === m.id ? 'page' : undefined} onClick={() => go(m.id)}>
            <span>{m.name}</span><span className="soon">{m.status === 'next' ? 'Next' : 'Planned'}</span>
          </button>
        ))}
        <div className="side-foot">
          <button className="nav module" aria-current={route.module === 'brand' ? 'page' : undefined} onClick={() => go('brand')}><Icon name="settings" size={16} /><span>Brand and settings</span></button>
        </div>
      </nav>
      <div className="main">
        <header className="top">
          <span className="crumb">{group ? <>{group.label} <Icon name="chevron" size={12} className="rot-90" /> <b>{pageLabel}</b></> : <b>{route.module === 'brand' ? 'Brand and settings' : mod?.name}</b>}</span>
          <div className="spacer" />
          <div className="only-phone"><Seg small label="Module" value={route.module === 'people' ? 'people' : 'sales'} onChange={(m) => go(m)} options={[{ id: 'sales', label: 'Sales' }, { id: 'people', label: 'People' }]} /></div>
          <button className="btn sm icon ghost only-phone" aria-label="Search" onClick={() => setPalette(true)}><Icon name="search" /></button>
          <button className="btn sm icon ghost" onClick={toggleTheme} aria-label={brand.theme === 'dark' ? 'Switch to light' : 'Switch to dark'} data-tip={brand.theme === 'dark' ? 'Light' : 'Dark'}><Icon name={brand.theme === 'dark' ? 'sun' : 'moon'} /></button>
        </header>
        <main className="content" ref={main}>
          {route.module === 'sales' && route.page === 'today' && <SalesToday crm={crm} onOpen={openRec} go={(p) => go('sales', p)} />}
          {route.module === 'sales' && route.page === 'deals' && <Deals crm={crm} onOpen={openRec} />}
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
          {route.module === 'brand' && <BrandSettings brand={brand} setBrand={setBrand} audit={repo.auditLog()} onReset={() => { repo.reset(); clearJson('people'); location.reload(); }} />}
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
    </div>
  );
}

type Hit = { key: string; group: string; label: string; sub?: string; icon: string; run: () => void };

function Palette({ crm, hr, onClose, onRec, onPerson, go, toggleTheme }: {
  crm: ReturnType<typeof useCrm>; hr: ReturnType<typeof usePeople>; onClose: () => void; onRec: (r: RecordRef) => void; onPerson: (id: string) => void; go: (m: string, p?: string) => void; toggleTheme: () => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  useEscape(onClose);
  const s = q.trim().toLowerCase();
  const hits: Hit[] = useMemo(() => {
    const pages = GROUPS.flatMap((g) => g.pages.map((p) => ({ key: `${g.id}-${p.id}`, group: 'Go to', label: `${g.label} › ${p.label}`, icon: p.icon, run: () => go(g.id, p.id) })));
    const extra: Hit[] = [{ key: 'brand', group: 'Go to', label: 'Brand and settings', icon: 'settings', run: () => go('brand') }, { key: 'theme', group: 'Do', label: 'Switch light or dark', icon: 'sun', run: toggleTheme }];
    if (!s) return [...pages.slice(0, 6), ...pages.slice(6, 9), ...extra];
    const people = hr.data.people.filter((p) => `${p.name} ${p.title} ${p.team}`.toLowerCase().includes(s)).slice(0, 6)
      .map((p) => ({ key: `p${p.id}`, group: 'People', label: p.name, sub: `${p.title} · ${p.team}`, icon: 'contact', run: () => onPerson(p.id) }));
    const recs = search(crm.data, q).slice(0, 8).map((h) => ({ key: `${h.ref.kind}${h.ref.id}`, group: 'Sales', label: h.label, sub: h.sub, icon: h.ref.kind === 'deal' ? 'deals' : h.ref.kind === 'company' ? 'company' : 'contact', run: () => onRec(h.ref) }));
    return [...people, ...recs, ...[...pages, ...extra].filter((p) => p.label.toLowerCase().includes(s))];
  }, [s, q, crm.data, hr.data, go, onPerson, onRec, toggleTheme]);
  const pick = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  let lastGroup = '';
  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus value={q} placeholder="Search people, deals, companies or pages" aria-label="Search"
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
      </div>
    </div>
  );
}

function BrandSettings({ brand, setBrand, onReset, audit }: { brand: Branding; setBrand: (b: Branding) => void; onReset: () => void; audit: string[] }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <Head eyebrow="Settings" title="Your brand on the platform." lede="Partners sell this platform under their own name. Change the name and accent and every page follows. Approvals, sources and the activity log stay the same under any brand." />
      <div className="card">
        <div className="form">
          <div className="field"><label htmlFor="bn">Platform name</label><input id="bn" className="input" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value || 'Meridian' })} /></div>
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
          <div><button className="btn ghost" onClick={() => setBrand({ ...DEFAULT_BRAND(), theme: brand.theme })}>Back to Meridian</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Activity log</h2></div>
        <p className="sub" style={{ marginTop: 0 }}>Every Sales change is recorded with who made it. Erasing a contact is logged without their personal data.</p>
        {audit.length === 0 ? <div className="sub">Nothing yet.</div> : <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 240, overflow: 'auto', margin: 0, color: 'var(--body)' }}>{audit.slice(-30).reverse().join('\n')}</pre>}
      </div>
      <div className="toolbar">
        {confirm ? <><span className="sub">Every change you made in this demo will be lost.</span><button className="btn danger" onClick={onReset}>Reset now</button><button className="btn ghost" onClick={() => setConfirm(false)}>Keep my changes</button></>
          : <button className="btn ghost danger" onClick={() => setConfirm(true)}>Reset the example data</button>}
      </div>
    </div>
  );
}
