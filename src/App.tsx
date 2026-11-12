import { useEffect, useMemo, useRef, useState } from 'react';
import { MODULES } from './platform/modules';
import { LocalRepository } from './platform/store';
import { clearJson } from './platform/jsonStore';
import { RecordRef, search } from './crm/domain';
import { seedCrm } from './crm/seed';
import { useCrm } from './crm/useCrm';
import { Companies, Contacts, Deals, Today } from './crm/pages';
import { RecordPanel } from './crm/RecordPanel';
import { Directory, Hiring, Leave, OnboardingPage, PeopleToday, Reviews, usePeople } from './people/pages';

const PEOPLE_PAGES = [
  { id: 'overview', label: 'Overview' }, { id: 'directory', label: 'Directory' }, { id: 'leave', label: 'Leave' },
  { id: 'onboarding', label: 'Onboarding' }, { id: 'hiring', label: 'Hiring' }, { id: 'reviews', label: 'Reviews' },
];

type SalesPage = 'today' | 'deals' | 'companies' | 'contacts';
type Route = { module: 'sales'; page: SalesPage } | { module: string; page?: string };

const SALES_PAGES: { id: SalesPage; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'deals', label: 'Deals' }, { id: 'companies', label: 'Companies' }, { id: 'contacts', label: 'Contacts' },
];

// White label: a partner's name and accent replace Meridian's. Everything else stays.
interface Branding { name: string; accent: string; theme: 'dark' | 'light' }
const DEFAULT_BRAND: Branding = { name: 'Meridian', accent: '', theme: 'dark' };
const loadBrand = (): Branding => { try { return { ...DEFAULT_BRAND, ...JSON.parse(localStorage.getItem('meridian:brand') ?? '{}') }; } catch { return DEFAULT_BRAND; } };

function parseHash(): Route {
  // Plain #name hashes (e.g. #sales-deals, #people, #brand) so links work inside an artifact too.
  const [module, page] = location.hash.replace(/^#\/?/, '').split(/[-/]/);
  if (!module || module === 'sales') return { module: 'sales', page: (SALES_PAGES.some((p) => p.id === page) ? page : 'today') as SalesPage };
  if (module === 'people') return { module, page: PEOPLE_PAGES.some((p) => p.id === page) ? page : 'overview' };
  return { module };
}

export default function App() {
  const repo = useMemo(() => new LocalRepository('demo', seedCrm), []);
  const crm = useCrm(repo, 'You');
  const hr = usePeople('You');
  const [route, setRoute] = useState<Route>(parseHash);
  const [openRec, setOpenRec] = useState<RecordRef | null>(null);
  const [brand, setBrand] = useState<Branding>(loadBrand);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = brand.theme;
    if (brand.accent) { root.style.setProperty('--accent', brand.accent); root.style.setProperty('--accent-soft', `${brand.accent}29`); }
    else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); }
    document.title = brand.name;
    try { localStorage.setItem('meridian:brand', JSON.stringify(brand)); } catch { /* ignore */ }
  }, [brand]);

  const go = (hash: string) => { location.hash = hash.replace(/^\//, '').replace('/', '-'); };
  const mod = MODULES.find((m) => m.id === route.module);
  const crumb = route.module === 'sales' ? `Sales › ${SALES_PAGES.find((p) => p.id === route.page)!.label}` : route.module === 'people' ? `People › ${PEOPLE_PAGES.find((p) => p.id === route.page)?.label}` : route.module === 'brand' ? 'Settings › Brand' : mod?.name ?? '';

  return (
    <div className="app">
      <nav className="side" aria-label="Modules">
        <div className="brand"><span className="brand-mark" aria-hidden />{brand.name}</div>
        <div className="side-label">Sales</div>
        {SALES_PAGES.map((p) => (
          <button key={p.id} className="nav" aria-current={route.module === 'sales' && route.page === p.id ? 'page' : undefined} onClick={() => go(`/sales/${p.id}`)}>{p.label}</button>
        ))}
        <div className="side-label">People</div>
        {PEOPLE_PAGES.map((p) => (
          <button key={p.id} className="nav" aria-current={route.module === 'people' && route.page === p.id ? 'page' : undefined} onClick={() => go(`/people/${p.id}`)}>{p.label}</button>
        ))}
        <div className="side-label">Modules</div>
        {MODULES.filter((m) => m.status !== 'live').map((m) => (
          <button key={m.id} className="nav" aria-current={route.module === m.id ? 'page' : undefined} onClick={() => go(`/${m.id}`)}>
            <span>{m.name}</span><span className={`pill ${m.status === 'next' ? 'accent' : ''}`}>{m.status === 'next' ? 'Next' : 'Planned'}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav" aria-current={route.module === 'brand' ? 'page' : undefined} onClick={() => go('/brand')}>Settings</button>
      </nav>
      <div className="main">
        <header className="top">
          <span className="crumb">{crumb}</span>
          <div className="spacer" />
          <Search crm={crm} onOpen={setOpenRec} />
          <button className="btn small ghost" onClick={() => setBrand({ ...brand, theme: brand.theme === 'dark' ? 'light' : 'dark' })} aria-label="Switch light or dark">{brand.theme === 'dark' ? 'Light' : 'Dark'}</button>
        </header>
        <main className="content">
          {route.module === 'sales' && route.page === 'today' && <Today crm={crm} onOpen={setOpenRec} />}
          {route.module === 'sales' && route.page === 'deals' && <Deals crm={crm} onOpen={setOpenRec} />}
          {route.module === 'sales' && route.page === 'companies' && <Companies crm={crm} onOpen={setOpenRec} />}
          {route.module === 'sales' && route.page === 'contacts' && <Contacts crm={crm} onOpen={setOpenRec} />}
          {route.module === 'brand' && <BrandSettings brand={brand} setBrand={setBrand} onReset={() => { repo.reset(); clearJson('people'); location.reload(); }} audit={repo.auditLog()} />}
          {route.module === 'people' && route.page === 'overview' && <PeopleToday hr={hr} go={(pg) => go(`/people/${pg}`)} />}
          {route.module === 'people' && route.page === 'directory' && <Directory hr={hr} />}
          {route.module === 'people' && route.page === 'leave' && <Leave hr={hr} />}
          {route.module === 'people' && route.page === 'onboarding' && <OnboardingPage hr={hr} />}
          {route.module === 'people' && route.page === 'hiring' && <Hiring hr={hr} />}
          {route.module === 'people' && route.page === 'reviews' && <Reviews hr={hr} />}
          {mod && mod.status !== 'live' && (
            <div className="page coming">
              <h1 className="headline">{mod.name}: {mod.oneLine.toLowerCase()}.</h1>
              <p>{mod.status === 'next' ? 'This module is being built next.' : 'This module is planned.'} It brings together work that already exists:</p>
              <ul>{mod.buildsOn.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
        </main>
      </div>
      {openRec && <RecordPanel crm={crm} refr={openRec} onClose={() => setOpenRec(null)} onOpen={setOpenRec} />}
    </div>
  );
}

function Search({ crm, onOpen }: { crm: ReturnType<typeof useCrm>; onOpen: (r: RecordRef) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = search(crm.data, q);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const pick = (i: number) => { const h = hits[i]; if (h) { onOpen(h.ref); setQ(''); input.current?.blur(); } };
  return (
    <div className="search">
      <input ref={input} value={q} placeholder="Search people, companies, deals  ⌘K" aria-label="Search"
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(sel + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
          if (e.key === 'Enter') pick(sel);
          if (e.key === 'Escape') setQ('');
        }} />
      {q.trim() && (
        <div className="search-results" role="listbox">
          {hits.length === 0 ? <div className="sub" style={{ padding: 10 }}>No matches.</div> : hits.map((h, i) => (
            <button key={`${h.ref.kind}${h.ref.id}`} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
              <div style={{ color: 'var(--ink)' }}>{h.label}</div><div className="sub">{h.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandSettings({ brand, setBrand, onReset, audit }: { brand: Branding; setBrand: (b: Branding) => void; onReset: () => void; audit: string[] }) {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="headline">Your brand on the platform.</h1>
      <p>Partners sell this platform as their own. Change the name and accent colour and every page follows. Approvals, sources and the audit log stay the same under any brand.</p>
      <div className="card form">
        <div className="field"><label htmlFor="bn">Platform name</label><input id="bn" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value || 'Meridian' })} /></div>
        <div className="field">
          <label htmlFor="ba">Accent colour</label>
          <div className="toolbar">
            <input id="ba" type="color" value={brand.accent || (brand.theme === 'dark' ? '#D08A52' : '#B8692F')} onChange={(e) => setBrand({ ...brand, accent: e.target.value })} style={{ width: 60, padding: 2 }} />
            {['#D08A52', '#5C5CFC', '#2F9E7A', '#C2416B'].map((c) => <button key={c} className="btn small" style={{ background: c, width: 38 }} aria-label={`Use ${c}`} onClick={() => setBrand({ ...brand, accent: c })} />)}
            <button className="btn small ghost" onClick={() => setBrand({ ...DEFAULT_BRAND, theme: brand.theme })}>Back to Meridian</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Activity log</h2>
        <p className="sub">Every change is recorded with who made it. Deleting a person is logged without their personal data.</p>
        {audit.length === 0 ? <div className="sub">Nothing yet.</div> : <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 240, overflow: 'auto' }}>{audit.slice(-30).reverse().join('\n')}</pre>}
      </div>
      <div><button className="btn danger" onClick={onReset}>Reset the example data</button></div>
    </div>
  );
}
