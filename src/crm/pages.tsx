import { tr, locale } from '../platform/i18n';
import { useMemo, useState } from 'react';
import {
  LawfulBasis, RecordRef, STAGES, STAGE_LABEL, STAGE_PROBABILITY, Stage, eur, followUps, forecastByMonth, lastTouch, openPipeline, openTasks,
  parseContactsCsv, pipelineSummary, sourceReport, winRate,
} from './domain';
import { Crm } from './useCrm';
import { InsightCards } from './ai-pages';
import { BASIS_LABEL, CompanyForm, ContactForm, DealForm, LostDialog } from './forms';
import { Avatar, Bar, Empty, Head, Icon, Menu, Panel, SearchInput, Seg, Stat, fmtDay, plural, todayIso, useToast } from '../platform/ui';

type Open = (r: RecordRef) => void;
const REASON = { next_step_due: tr("Next step due"), no_next_step: tr("No next step"), gone_quiet: tr('Quiet 14+ days') } as const;
const monthName = (m: string) => (m === 'No date' ? tr("No date") : new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale(), { month: 'short', year: '2-digit', timeZone: 'UTC' }));

// ---------------- Today ----------------

export function SalesToday({ crm, onOpen, go }: { crm: Crm; onOpen: Open; go: (p: string) => void }) {
  const toast = useToast();
  const { data } = crm;
  const t = todayIso();
  const open = openPipeline(data.deals);
  const rate = winRate(data.deals);
  const due = followUps(data, t);
  const tasks = openTasks(data, t).filter((x) => x.overdue || x.dueToday);
  const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
  const wonQ = data.deals.filter((d) => d.stage === 'won' && d.closedAt && d.closedAt >= quarterStart.toISOString().slice(0, 10));
  const forecast = forecastByMonth(data.deals).slice(0, 5);
  const fmax = Math.max(1, ...forecast.map((f) => f.value));
  const asks = due.length + tasks.length;

  return (
    <div className="page">
      <Head eyebrow={tr("Sales")} title={asks === 0 ? tr("Nothing needs you today.") : tr("{0} need{1} you today.", { 0: plural(asks, 'thing'), 1: asks === 1 ? 's' : '' })} />
      <div className="hero">
        <div>
          <div className="sub" data-tip={tr("All open deals at full value.")} tabIndex={0}>{tr("Open pipeline")}</div>
          <div className="big">{eur(open.value)}</div>
          <div className="sub" style={{ marginTop: 6 }}>{plural(open.count, 'open deal')}</div>
        </div>
        <div>
          <div className="sub" data-tip={tr("Each open deal times its stage's chance to close: Lead 10%, Qualified 25%, Proposal 50%, Negotiation 75%.")} tabIndex={0}>{tr("Likely to close")}</div>
          <div className="big" style={{ color: 'var(--accent)' }}>{eur(open.weighted)}</div>
          <div className="sub" style={{ marginTop: 6 }}>{tr("Weighted by stage")}</div>
        </div>
      </div>
      <div className="grid">
        <Stat label={tr("Won this quarter")} value={eur(wonQ.reduce((s, d) => s + d.value, 0))} sub={plural(wonQ.length, 'deal')} span="s4" />
        <Stat label={tr("Win rate")} tip={tr("Won deals divided by all closed deals.")} value={rate === null ? '—' : `${Math.round(rate * 100)}%`} sub={tr("Of closed deals")} span="s4" />
        <Stat label={tr("Open tasks")} value={String(openTasks(data, t).length)} sub={tr("{0} overdue", { 0: openTasks(data, t).filter((x) => x.overdue).length })} span="s4" />
      </div>
      <div className="grid">
        <div className="card tight s7">
          <div className="card-head"><h2>{tr("Needs you")}</h2><div className="spacer" /><button className="btn sm ghost" onClick={() => go('tasks')}>{tr("All tasks")} <Icon name="arrow" size={14} /></button></div>
          {asks === 0 ? <Empty title={tr("All clear")} text={tr("Every open deal has a next step and no task is due.")} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {tasks.map(({ task, overdue }) => (
                <div key={task.id} className="row" onClick={() => task.dealId && onOpen({ kind: 'deal', id: task.dealId })}>
                  <input type="checkbox" checked={false} onClick={(e) => e.stopPropagation()} onChange={() => toast(tr("Done"), crm.toggleTask(task.id))} aria-label={tr("Mark {0} done", { 0: task.title })} />
                  <div className="grow"><div className="t">{task.title}</div><div className="sub">{tr("Task")}{task.dealId ? ` · ${data.deals.find((d) => d.id === task.dealId)?.title}` : ''}</div></div>
                  <span className={`pill ${overdue ? 'neg' : 'accent'}`}>{overdue ? tr("Overdue · {0}", { 0: fmtDay(task.due) }) : tr("Today")}</span>
                </div>
              ))}
              {due.map((f) => (
                <div key={f.deal.id} className="row" onClick={() => onOpen({ kind: 'deal', id: f.deal.id })}>
                  <span className="avatar sm co" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="deals" size={14} /></span>
                  <div className="grow"><div className="t">{f.deal.title}</div><div className="sub">{f.deal.nextStep ?? tr("Set a next step")} · {STAGE_LABEL[f.deal.stage]}</div></div>
                  <span className={`pill ${f.overdue ? 'neg' : 'warn'}`}>{f.overdue ? tr("Overdue") : REASON[f.reason]}</span>
                  <span className="end ink num" style={{ width: 70 }}>{eur(f.deal.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card s5">
          <div className="card-head"><h2>{tr("Forecast")}</h2><div className="spacer" /><span className="sub">{tr("by expected close")}</span></div>
          {forecast.length === 0 ? <Empty title={tr("No open deals")} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {forecast.map((f) => (
                <div key={f.month}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span className="ink">{monthName(f.month)} <span className="sub">· {plural(f.count, 'deal')}</span></span>
                    <span className="num"><b className="ink">{eur(f.weighted)}</b> <span className="sub">{tr("of")} {eur(f.value)}</span></span>
                  </div>
                  <div className="bar" style={{ position: 'relative' }}>
                    <i style={{ width: `${(f.value / fmax) * 100}%`, background: 'var(--accent-soft)', position: 'absolute', inset: 0 }} />
                    <i style={{ width: `${(f.weighted / fmax) * 100}%`, position: 'relative' }} />
                  </div>
                </div>
              ))}
              <p className="sub" style={{ margin: 0 }}>{tr("Solid bar: likely to close. Light bar: full value.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Deals ----------------

export function Deals({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const toast = useToast();
  const { data } = crm;
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const summary = pipelineSummary(data.deals);
  const companyName = (id?: string) => data.companies.find((c) => c.id === id)?.name ?? '';
  const deals = data.deals.filter((d) => `${d.title} ${companyName(d.companyId)}`.toLowerCase().includes(q.toLowerCase()));
  const move = (id: string, s: Stage) => {
    setOver(null);
    if (s === 'lost') return setLostFor(id);
    const undo = crm.moveDeal(id, s);
    if (undo) toast(tr("Moved to {0}", { 0: STAGE_LABEL[s] }), undo);
  };
  const menu = (id: string) => [
    { label: tr("Open"), icon: 'arrow', onClick: () => onOpen({ kind: 'deal', id }) },
    { label: tr("Mark won"), icon: 'check', onClick: () => move(id, 'won') },
    { label: tr("Mark lost"), icon: 'close', onClick: () => move(id, 'lost') },
    'divider' as const,
    { label: tr("Delete"), icon: 'trash', danger: true, onClick: () => toast(tr("Deal deleted"), crm.deleteDeal(id)) },
  ];

  return (
    <div className="page" style={{ maxWidth: 1480 }}>
      <Head eyebrow={tr("Sales")} title={tr("Deals")} lede={tr("{0} open across {1}. Drag a card to change its stage.", { 0: eur(openPipeline(data.deals).value), 1: plural(openPipeline(data.deals).count, 'deal') })}>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("New deal")}</button>
      </Head>
      <div className="toolbar">
        <SearchInput id="deal-q" value={q} onChange={setQ} placeholder={tr("Find a deal or company")} />
        <div className="spacer" />
        <Seg label={tr("View")} value={view} onChange={setView} options={[{ id: 'board', label: tr("Board") }, { id: 'list', label: tr("List") }]} />
      </div>
      {adding && <DealForm crm={crm} onClose={() => setAdding(false)} />}
      {lostFor && <LostDialog onClose={() => setLostFor(null)} onSave={(r) => { toast(tr("Marked lost"), crm.moveDeal(lostFor, 'lost', r)); setLostFor(null); }} />}
      {view === 'board' ? (
        <div className="board">
          {STAGES.map((s) => {
            const sm = summary.find((x) => x.stage === s)!;
            return (
              <div key={s} className={`col ${over === s ? 'drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)} onDrop={(e) => move(e.dataTransfer.getData('text/plain'), s)}>
                <div className="col-head"><b>{STAGE_LABEL[s]} <span className="sub">{sm.count}</span></b><span className="sub num" data-tip={s === 'won' || s === 'lost' ? undefined : tr("Chance to close: {0}%", { 0: STAGE_PROBABILITY[s] * 100 })}>{eur(sm.value)}</span></div>
                {deals.filter((d) => d.stage === s).map((d) => (
                  <div key={d.id} className="tile" draggable tabIndex={0} onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)} onClick={() => onOpen({ kind: 'deal', id: d.id })} onKeyDown={(e) => e.key === 'Enter' && onOpen({ kind: 'deal', id: d.id })}>
                    <div className="tt">{d.title}</div>
                    <div className="meta"><span>{companyName(d.companyId)}</span><span className="ink num">{eur(d.value)}</span></div>
                    {d.nextStepDue && d.stage !== 'won' && d.stage !== 'lost' && <div className="meta"><span className={d.nextStepDue < todayIso() ? 'pill neg' : 'pill'}>{fmtDay(d.nextStepDue)}</span></div>}
                    <div className="menu-at reveal" onClick={(e) => e.stopPropagation()}><Menu items={menu(d.id)} /></div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card tight"><div className="table-wrap"><table className="list">
          <thead><tr><th>{tr("Deal")}</th><th>{tr("Stage")}</th><th>{tr("Expected close")}</th><th>{tr("Last touch")}</th><th className="num">{tr("Value")}</th><th /></tr></thead>
          <tbody>{[...deals].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)).map((d) => (
            <tr key={d.id} className="click" onClick={() => onOpen({ kind: 'deal', id: d.id })}>
              <td><div>{d.title}</div><div className="sub">{companyName(d.companyId)}</div></td>
              <td><span className={`pill dot ${d.stage === 'won' ? 'pos' : d.stage === 'lost' ? 'neg' : 'accent'}`}>{STAGE_LABEL[d.stage]}</span></td>
              <td className="muted">{d.expectedClose ? fmtDay(d.expectedClose) : '—'}</td>
              <td className="muted">{fmtDay(lastTouch(data, d))}</td>
              <td className="num">{eur(d.value)}</td>
              <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={menu(d.id)} /></span></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
  );
}

// ---------------- Companies ----------------

export function Companies({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const toast = useToast();
  const { data } = crm;
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const rows = data.companies.filter((c) => `${c.name} ${c.industry ?? ''} ${c.domain ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <Head eyebrow={tr("Sales")} title={tr("Companies")} lede={plural(data.companies.length, 'company', 'companies')}>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("New company")}</button>
      </Head>
      <div className="toolbar"><SearchInput id="co-q" value={q} onChange={setQ} placeholder={tr("Find a company")} /></div>
      {adding && <CompanyForm crm={crm} onClose={() => setAdding(false)} />}
      {editing && <CompanyForm crm={crm} company={data.companies.find((c) => c.id === editing)} onClose={() => setEditing(null)} />}
      <div className="card tight">
        {rows.length === 0 ? <Empty title={q ? tr("No match") : tr("No companies yet")} text={q ? tr("Try another name.") : tr("Add the first company you sell to.")} /> : (
          <div className="table-wrap"><table className="list">
            <thead><tr><th>{tr("Company")}</th><th>{tr("Industry")}</th><th>{tr("Size")}</th><th>{tr("People")}</th><th className="num">{tr("Open deals")}</th><th /></tr></thead>
            <tbody>{rows.map((c) => {
              const open = openPipeline(data.deals.filter((d) => d.companyId === c.id));
              return (
                <tr key={c.id} className="click" onClick={() => onOpen({ kind: 'company', id: c.id })}>
                  <td><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Avatar name={c.name} company size="sm" /><div><div>{c.name}</div><div className="sub">{c.domain}</div></div></div></td>
                  <td className="muted">{c.industry ?? '—'}</td><td className="muted">{c.size ?? '—'}</td>
                  <td className="muted">{data.contacts.filter((x) => x.companyId === c.id).length}</td>
                  <td className="num">{open.count ? <>{eur(open.value)} <span className="sub">· {open.count}</span></> : <span className="muted">—</span>}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={[
                    { label: tr("Open"), icon: 'arrow', onClick: () => onOpen({ kind: 'company', id: c.id }) },
                    { label: tr("Edit"), icon: 'edit', onClick: () => setEditing(c.id) },
                    'divider', { label: tr("Delete"), icon: 'trash', danger: true, onClick: () => toast(tr("Deleted {0}", { 0: c.name }), crm.deleteCompany(c.id)) },
                  ]} /></span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ---------------- Contacts ----------------

export function Contacts({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const { data } = crm;
  const [q, setQ] = useState('');
  const [basis, setBasis] = useState<'all' | LawfulBasis>('all');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const companyName = (id?: string) => data.companies.find((c) => c.id === id)?.name ?? '';
  const rows = data.contacts.filter((c) => (basis === 'all' || c.lawfulBasis === basis) && `${c.firstName} ${c.lastName} ${c.email ?? ''} ${companyName(c.companyId)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <Head eyebrow={tr("Sales")} title={tr("Contacts")} lede={tr("Every contact records where they came from and why you may keep them.")}>
        <button className="btn" onClick={() => setImporting(true)}><Icon name="upload" size={16} />{tr("Import")}</button>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("New contact")}</button>
      </Head>
      <div className="toolbar">
        <SearchInput id="ct-q" value={q} onChange={setQ} placeholder={tr("Find a person, email or company")} />
        <select className="input" value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} aria-label={tr("Lawful basis")} id="ct-basis">
          <option value="all">{tr("Any lawful basis")}</option>{Object.entries(BASIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="spacer" /><span className="sub">{plural(rows.length, 'person', 'people')}</span>
      </div>
      {adding && <ContactForm crm={crm} onClose={() => setAdding(false)} />}
      {importing && <ImportPanel crm={crm} onClose={() => setImporting(false)} />}
      {editing && <ContactForm crm={crm} contact={data.contacts.find((c) => c.id === editing)} onClose={() => setEditing(null)} />}
      <div className="card tight">
        {rows.length === 0 ? <Empty title={tr("No contacts match")} /> : (
          <div className="table-wrap"><table className="list">
            <thead><tr><th>{tr("Name")}</th><th>{tr("Company")}</th><th>{tr("Source")}</th><th>{tr("Lawful basis")}</th><th /></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className="click" onClick={() => onOpen({ kind: 'contact', id: c.id })}>
                <td><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Avatar name={`${c.firstName} ${c.lastName}`} size="sm" /><div><div>{c.firstName} {c.lastName}</div><div className="sub">{c.role ?? c.email}</div></div></div></td>
                <td className="muted">{companyName(c.companyId) || '—'}</td><td className="muted">{c.source}</td>
                <td><span className="pill">{BASIS_LABEL[c.lawfulBasis]}</span></td>
                <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={[
                  { label: tr("Open"), icon: 'arrow', onClick: () => onOpen({ kind: 'contact', id: c.id }) },
                  { label: tr("Edit"), icon: 'edit', onClick: () => setEditing(c.id) },
                ]} /></span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

const SAMPLE_CSV = 'first_name,last_name,email,company,role,source,lawful_basis\nEva,Kalnina,eva@example.com,Birch & Co Furniture,COO,Event,legitimate_interest\nOliver,Kask,oliver@example.com,Harbour Tech,CTO,Referral,legitimate_interest';

function ImportPanel({ crm, onClose }: { crm: Crm; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const rows = useMemo(() => parseContactsCsv(text, crm.data), [text, crm.data]);
  const ok = rows.filter((r) => r.errors.length === 0 && !r.duplicate);
  const read = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result ?? '')); r.readAsText(f); };
  const run = () => {
    const r = crm.addContacts(ok.map((x) => ({ contact: x.contact, companyName: x.companyName })));
    toast(tr("Imported {0}{1}", { 0: plural(r.added, 'contact'), 1: r.newCompanies ? ` and ${plural(r.newCompanies, 'company', 'companies')}` : '' }), r.undo);
    onClose();
  };
  return (
    <Panel title={tr("Import contacts")} eyebrow={tr("From a CSV file")} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{tr("Columns we read: first_name, last_name (or name), email, phone, role, company, source, lawful_basis, consent_date. Rows with problems or an email already on file are shown and skipped.")}</p>
      <div className="toolbar">
        <label className="btn"><Icon name="upload" size={16} />{tr("Choose file")}<input type="file" accept=".csv,text/csv" hidden onChange={(e) => read(e.target.files?.[0])} /></label>
        <button className="btn ghost" onClick={() => setText(SAMPLE_CSV)}>{tr("Use an example")}</button>
      </div>
      <textarea className="input" style={{ height: 120, padding: 12, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Or paste CSV here")} aria-label={tr("CSV")} id="import-csv" />
      {rows.length > 0 && (
        <div className="card flat tight"><div className="rows">
          {rows.map((r) => (
            <div key={r.line} className="row" style={{ cursor: 'default' }}>
              <div className="grow"><div className="t">{r.contact.firstName} {r.contact.lastName} {r.companyName && <span className="sub">· {r.companyName}</span>}</div><div className="sub">{r.errors[0] ?? (r.duplicate ? tr("Already on file (same email)") : r.contact.email)}</div></div>
              <span className={`pill ${r.errors.length ? 'neg' : r.duplicate ? 'warn' : 'pos'}`}>{r.errors.length ? tr("Fix") : r.duplicate ? tr("Skip") : tr("Ready")}</span>
            </div>
          ))}
        </div></div>
      )}
      <div className="toolbar"><button className="btn primary" disabled={ok.length === 0} onClick={run}>{tr("Import")} {ok.length > 0 ? plural(ok.length, 'contact') : ''}</button><button className="btn ghost" onClick={onClose}>{tr("Cancel")}</button></div>
    </Panel>
  );
}

// ---------------- Tasks ----------------

export function TasksPage({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const toast = useToast();
  const { data } = crm;
  const t = todayIso();
  const [show, setShow] = useState<'open' | 'done'>('open');
  const label = (x: { dealId?: string; contactId?: string; companyId?: string }) =>
    data.deals.find((d) => d.id === x.dealId)?.title ?? (x.contactId ? `${data.contacts.find((c) => c.id === x.contactId)?.firstName ?? ''} ${data.contacts.find((c) => c.id === x.contactId)?.lastName ?? ''}` : data.companies.find((c) => c.id === x.companyId)?.name) ?? '';
  const list = data.tasks.filter((x) => (show === 'open' ? !x.done : x.done)).sort((a, b) => a.due.localeCompare(b.due));
  const groups = show === 'open'
    ? [['Overdue', list.filter((x) => x.due < t)], ['Today', list.filter((x) => x.due === t)], [tr("Coming up"), list.filter((x) => x.due > t)]] as const
    : [['Done', list]] as const;
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Head eyebrow={tr("Sales")} title={tr("Tasks")} lede={tr("Add tasks from any deal, person or company.")}>
        <Seg label={tr("Show")} value={show} onChange={setShow} options={[{ id: 'open', label: tr("Open") }, { id: 'done', label: tr("Done") }]} />
      </Head>
      {list.length === 0 && <div className="card"><Empty title={show === 'open' ? tr("No open tasks") : tr("Nothing done yet")} /></div>}
      {groups.map(([name, xs]) => xs.length > 0 && (
        <div key={name}>
          <div className="section-title">{name} · {xs.length}</div>
          <div className="card tight"><div className="rows">
            {xs.map((x) => (
              <div key={x.id} className="row" onClick={() => { if (x.dealId) onOpen({ kind: 'deal', id: x.dealId }); else if (x.contactId) onOpen({ kind: 'contact', id: x.contactId }); else if (x.companyId) onOpen({ kind: 'company', id: x.companyId }); }}>
                <input type="checkbox" checked={x.done} onClick={(e) => e.stopPropagation()} onChange={() => toast(x.done ? tr("Reopened") : tr("Done"), crm.toggleTask(x.id))} aria-label={x.title} />
                <div className="grow"><div className="t">{x.title}</div><div className="sub">{label(x)}</div></div>
                <span className={`pill ${!x.done && x.due < t ? 'neg' : ''}`}>{x.due === t ? tr("Today") : fmtDay(x.due)}</span>
                <span className="reveal" onClick={(e) => e.stopPropagation()}><Menu items={[{ label: tr("Delete"), icon: 'trash', danger: true, onClick: () => toast(tr("Task deleted"), crm.deleteTask(x.id)) }]} /></span>
              </div>
            ))}
          </div></div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Reports ----------------

export function Reports({ crm }: { crm: Crm }) {
  const { data } = crm;
  const summary = pipelineSummary(data.deals);
  const sources = sourceReport(data);
  const lost = data.deals.filter((d) => d.stage === 'lost');
  const reasons = [...lost.reduce((m, d) => m.set(d.lostReason ?? tr("No reason"), (m.get(d.lostReason ?? tr("No reason")) ?? 0) + 1), new Map<string, number>())];
  const max = Math.max(1, ...summary.map((s) => s.value));
  return (
    <div className="page">
      <Head eyebrow={tr("Sales")} title={tr("Four numbers that matter, each with what to do.")} lede={tr("Every card follows 5B: a ballpark number, a benchmark, one short line, the breakdown and a bespoke next step. The detail is below.")} />
      <InsightCards crm={crm} />
      <div className="section-title" style={{ marginTop: 8 }}>{tr("Detail")}</div>
      <div className="grid">
        <div className="card s6">
          <div className="card-head"><h2>{tr("Pipeline by stage")}</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {summary.map((s) => (
              <div key={s.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span className="ink">{STAGE_LABEL[s.stage]} <span className="sub">· {s.count}</span></span><span className="num ink">{eur(s.value)}</span></div>
                <Bar value={(s.value / max) * 100} tone={s.stage === 'won' ? 'pos' : s.stage === 'lost' ? 'neg' : ''} />
              </div>
            ))}
          </div>
        </div>
        <div className="card tight s6">
          <div className="card-head"><h2>{tr("Lead sources")}</h2><div className="spacer" /><span className="sub">{tr("sorted by won value")}</span></div>
          <div className="table-wrap"><table className="list">
            <thead><tr><th>{tr("Source")}</th><th className="num">{tr("Contacts")}</th><th className="num">{tr("Won")}</th><th className="num">{tr("Won value")}</th></tr></thead>
            <tbody>{sources.map((s) => <tr key={s.source}><td>{s.source}</td><td className="num">{s.contacts}</td><td className="num">{s.won}</td><td className="num">{s.wonValue ? eur(s.wonValue) : '—'}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card s12">
          <div className="card-head"><h2>{tr("Why deals are lost")}</h2><div className="spacer" /><span className="sub">{plural(lost.length, 'lost deal')}</span></div>
          {reasons.length === 0 ? <Empty title={tr("No lost deals yet")} /> : <div className="toolbar">{reasons.map(([r, n]) => <span key={r} className="pill neg">{r} · {n}</span>)}</div>}
        </div>
      </div>
    </div>
  );
}
