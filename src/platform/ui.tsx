// Shared building blocks. Every module page uses these, so the platform behaves one way everywhere:
// one primary action per page, secondary actions behind ⋯, a toast (with Undo where possible) after every change,
// Escape closes the top-most layer, tooltips explain feature words.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- icons (stroke icons, 20px grid) ----------
const P: Record<string, string> = {
  today: 'M3 12h4l3-8 4 16 3-8h4',
  deals: 'M4 6h16M4 12h10M4 18h6',
  company: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M3 21h18',
  contact: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.8 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.2 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2',
  hire: 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21a7 7 0 0 1 11-5.7M19 14v6M16 17h6',
  door: 'M14 3H6v18h8M10 12h11M18 9l3 3-3 3',
  skill: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  org: 'M9 3h6v5H9zM4 16h6v5H4zM14 16h6v5h-6zM12 8v4M7 16v-4h10v4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  task: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};
export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.more} />
    </svg>
  );
}

// ---------- toasts ----------
type Toast = { id: number; text: string; undo?: () => void };
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, undo?: () => void) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, undo }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), undo ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.text}</span>
            {t.undo && <button onClick={() => { t.undo!(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>Undo</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Escape stack: the top-most layer closes first ----------
const stack: (() => void)[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1](); } });
}
export function useEscape(onClose: () => void, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const fn = () => ref.current();
    stack.push(fn);
    return () => { const i = stack.lastIndexOf(fn); if (i >= 0) stack.splice(i, 1); };
  }, [active]);
}

// ---------- ⋯ menu ----------
export type MenuItem = { label: string; icon?: string; onClick: () => void; danger?: boolean } | 'divider';
export function Menu({ items, label = 'More actions', className }: { items: MenuItem[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEscape(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector('button')?.focus();
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btn.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 200, window.innerWidth - 208)) });
    setOpen(!open);
  };
  return (
    <>
      <button ref={btn} className={`btn sm icon ghost ${className ?? ''}`} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle}><Icon name="more" /></button>
      {open && (
        <div ref={box} className="menu" role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const bs = [...(box.current?.querySelectorAll('button') ?? [])];
            const i = bs.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
          }}>
          {items.map((it, i) => it === 'divider' ? <hr key={i} /> : (
            <button key={it.label} role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>
              {it.icon && <Icon name={it.icon} size={16} />}{it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- side panel ----------
export function Panel({ title, eyebrow, lead, actions, onClose, children }: { title: ReactNode; eyebrow?: string; lead?: ReactNode; actions?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="panel-head">
          {lead}
          <div className="grow">
            {eyebrow && <div className="sub">{eyebrow}</div>}
            <h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{title}</h2>
          </div>
          {actions}
          <button className="btn sm icon ghost" onClick={onClose} aria-label="Close" data-tip="Close (Esc)"><Icon name="close" /></button>
        </div>
        <div className="panel-body">{children}</div>
      </aside>
    </>
  );
}

// ---------- small parts ----------
export function Head({ eyebrow, title, lede, children }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <div className="head">
      <div className="titles">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="title">{title}</h1>
        {lede && <p className="lede" style={{ margin: 0 }}>{lede}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tip, span = 's3' }: { label: string; value: ReactNode; sub?: ReactNode; tip?: string; span?: string }) {
  return (
    <div className={`card stat-card ${span}`}>
      <div className="stat-label"><span data-tip={tip} tabIndex={tip ? 0 : undefined}>{label}</span></div>
      <div className="stat">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const HUES = [['#3D4BFF', '#8A5CFF'], ['#0A84FF', '#3DD6C8'], ['#FF5E7E', '#FF9F5A'], ['#2BB673', '#9BD94A'], ['#7C5CFF', '#FF6AD5'], ['#00A3FF', '#5B6BFF']];
export function Avatar({ name, size = '', company = false }: { name: string; size?: '' | 'sm' | 'lg'; company?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const h = HUES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
  return <span className={`avatar ${size} ${company ? 'co' : ''}`} style={{ ['--a1' as string]: h[0], ['--a2' as string]: h[1] }} aria-hidden="true">{initials}</span>;
}

export function Seg<T extends string>({ value, options, onChange, label, small }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`seg ${small ? 'sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function Field({ label, id, children, tip }: { label: string; id: string; children: ReactNode; tip?: string }) {
  return <div className="field"><label htmlFor={id}><span data-tip={tip}>{label}</span></label>{children}</div>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="empty"><Icon name="sparkle" size={22} /><div className="ink">{title}</div>{text && <div>{text}</div>}{action}</div>;
}

export function SearchInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder: string; id: string }) {
  return <label className="search-in"><Icon name="search" size={16} /><input id={id} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} /></label>;
}

export function Bar({ value, tone = '' }: { value: number; tone?: '' | 'pos' | 'warn' | 'neg' }) {
  return <div className={`bar ${tone}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export const fmtDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtDayYear = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
