import { useState } from 'react';
import {
  Contact, LawfulBasis, RecordRef, STAGES, STAGE_LABEL, Stage, eur, followUps, lastTouch, openPipeline,
  pipelineSummary, validateContact, validateDeal, winRate,
} from './domain';
import { Crm } from './useCrm';

type Open = (r: RecordRef) => void;
const REASON = { next_step_due: 'Next step due', no_next_step: 'No next step set', gone_quiet: 'Quiet for 14+ days' } as const;

// ---------------- Today ----------------

export function Today({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const { data } = crm;
  const today = new Date().toISOString().slice(0, 10);
  const open = openPipeline(data.deals);
  const rate = winRate(data.deals);
  const due = followUps(data, today);
  const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
  const wonQ = data.deals.filter((d) => d.stage === 'won' && d.closedAt && d.closedAt >= quarterStart.toISOString().slice(0, 10));
  const biggest = data.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').sort((a, b) => b.value - a.value)[0];

  const headline = due.length === 0
    ? 'Nothing needs you today. Every open deal has a next step.'
    : `${due.length} deal${due.length > 1 ? 's' : ''} need${due.length > 1 ? '' : 's'} you today${due.some((f) => f.overdue) ? ', and some are overdue' : ''}.`;

  return (
    <div className="page">
      <h1 className="headline">{headline}</h1>
      <div className="grid">
        <Stat label="Open pipeline" value={eur(open.value)} sub={`${open.count} open deal${open.count === 1 ? '' : 's'}`} />
        <Stat label="Likely to close" value={eur(open.weighted)} sub="Weighted by stage" />
        <Stat label="Win rate" value={rate === null ? '—' : `${Math.round(rate * 100)}%`} sub="Of closed deals" />
        <Stat label="Won this quarter" value={eur(wonQ.reduce((s, d) => s + d.value, 0))} sub={`${wonQ.length} deal${wonQ.length === 1 ? '' : 's'}`} />
      </div>
      <div className="grid">
        <div className="card span-8">
          <h2>Needs you</h2>
          {due.length === 0 ? <div className="empty">All clear.</div> : (
            <div className="table-wrap"><table className="list">
              <thead><tr><th>Deal</th><th>Why</th><th>Next step</th><th className="num">Value</th></tr></thead>
              <tbody>
                {due.map((f) => (
                  <tr key={f.deal.id} className="row" onClick={() => onOpen({ kind: 'deal', id: f.deal.id })}>
                    <td>{f.deal.title}<div className="sub">{STAGE_LABEL[f.deal.stage]}</div></td>
                    <td><span className={`pill ${f.overdue ? 'neg' : 'accent'}`}>{f.overdue ? 'Overdue' : REASON[f.reason]}</span></td>
                    <td>{f.deal.nextStep ?? <span className="sub">Set one</span>}{f.deal.nextStepDue && <div className="sub">{f.deal.nextStepDue}</div>}</td>
                    <td className="num">{eur(f.deal.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
        <div className="card span-4">
          <h2>Pipeline by stage</h2>
          <Bars crm={crm} />
          {biggest && <p className="sub" style={{ marginTop: 14 }}>Largest open deal: <a href="#" onClick={(e) => { e.preventDefault(); onOpen({ kind: 'deal', id: biggest.id }); }}>{biggest.title}</a>, {eur(biggest.value)}.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card span-3"><div className="stat-label">{label}</div><div className="stat">{value}</div><div className="stat-sub">{sub}</div></div>;
}

function Bars({ crm }: { crm: Crm }) {
  const rows = pipelineSummary(crm.data.deals).filter((r) => r.stage !== 'won' && r.stage !== 'lost');
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <div key={r.stage}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{STAGE_LABEL[r.stage]} <span className="sub">({r.count})</span></span><span style={{ color: 'var(--ink)' }}>{eur(r.value)}</span></div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--inset)', marginTop: 4 }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Deals ----------------

export function Deals({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const [view, setView] = useState<'board' | 'list'>('board');
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const { data } = crm;
  const summary = pipelineSummary(data.deals);
  const companyName = (id?: string) => data.companies.find((c) => c.id === id)?.name ?? '';

  const drop = (stage: Stage, id: string) => {
    setOver(null);
    if (stage === 'lost') { setLostFor(id); return; }
    crm.moveDeal(id, stage);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
        <span className="sub">Drag a deal to change its stage.</span>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setAdding(true)}>New deal</button>
      </div>
      {lostFor && <LostReason onCancel={() => setLostFor(null)} onSave={(r) => { crm.moveDeal(lostFor, 'lost', r); setLostFor(null); }} />}
      {adding && <NewDeal crm={crm} onDone={() => setAdding(false)} />}
      {view === 'board' ? (
        <div className="board">
          {STAGES.map((s) => {
            const sm = summary.find((x) => x.stage === s)!;
            return (
              <div key={s} className={`col ${over === s ? 'drop' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(s); }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => drop(s, e.dataTransfer.getData('text/plain'))}>
                <div className="col-head"><b>{STAGE_LABEL[s]}</b><span className="sub">{eur(sm.value)}</span></div>
                {data.deals.filter((d) => d.stage === s).map((d) => (
                  <div key={d.id} className="deal" draggable tabIndex={0}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)}
                    onClick={() => onOpen({ kind: 'deal', id: d.id })}
                    onKeyDown={(e) => e.key === 'Enter' && onOpen({ kind: 'deal', id: d.id })}>
                    <div className="deal-title">{d.title}</div>
                    <div className="deal-meta"><span>{companyName(d.companyId)}</span><span>{eur(d.value)}</span></div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="list">
            <thead><tr><th>Deal</th><th>Company</th><th>Stage</th><th>Last touch</th><th className="num">Value</th></tr></thead>
            <tbody>
              {[...data.deals].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)).map((d) => (
                <tr key={d.id} className="row" onClick={() => onOpen({ kind: 'deal', id: d.id })}>
                  <td>{d.title}</td><td>{companyName(d.companyId)}</td>
                  <td><span className={`pill ${d.stage === 'won' ? 'pos' : d.stage === 'lost' ? 'neg' : ''}`}>{STAGE_LABEL[d.stage]}</span></td>
                  <td className="sub">{lastTouch(data, d).slice(0, 10)}</td>
                  <td className="num">{eur(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function LostReason({ onSave, onCancel }: { onSave: (r: string) => void; onCancel: () => void }) {
  const [r, setR] = useState('');
  return (
    <form className="card note-box" onSubmit={(e) => { e.preventDefault(); if (r.trim()) onSave(r.trim()); }}>
      <input className="btn" style={{ textAlign: 'left' }} autoFocus placeholder="Why was it lost? (helps the win-rate review)" value={r} onChange={(e) => setR(e.target.value)} />
      <button className="btn primary" type="submit">Mark lost</button>
      <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function NewDeal({ crm, onDone }: { crm: Crm; onDone: () => void }) {
  const [f, setF] = useState({ title: '', value: '', stage: 'lead' as Stage, companyId: '', contactId: '', nextStep: '', nextStepDue: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const deal = { title: f.title, value: Number(f.value || 0), stage: f.stage, companyId: f.companyId || undefined, contactId: f.contactId || undefined, nextStep: f.nextStep || undefined, nextStepDue: f.nextStepDue || undefined };
    const errs = validateDeal(deal);
    if (errs.length) return setErrors(errs);
    crm.addDeal(deal);
    onDone();
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>New deal</h2>
      {errors.length > 0 && <ul className="errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="row2">
        <Field label="Name" id="dt"><input id="dt" autoFocus value={f.title} onChange={set('title')} /></Field>
        <Field label="Value (€)" id="dv"><input id="dv" type="number" min="0" value={f.value} onChange={set('value')} /></Field>
      </div>
      <div className="row2">
        <Field label="Company" id="dc"><select id="dc" value={f.companyId} onChange={set('companyId')}><option value="">—</option>{crm.data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Contact" id="dp"><select id="dp" value={f.contactId} onChange={set('contactId')}><option value="">—</option>{crm.data.contacts.filter((c) => !f.companyId || c.companyId === f.companyId).map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></Field>
      </div>
      <div className="row2">
        <Field label="Next step" id="dn"><input id="dn" value={f.nextStep} onChange={set('nextStep')} /></Field>
        <Field label="Due" id="dd"><input id="dd" type="date" value={f.nextStepDue} onChange={set('nextStepDue')} /></Field>
      </div>
      <div className="toolbar"><button className="btn primary" type="submit">Create deal</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

// ---------------- Companies ----------------

export function Companies({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const [adding, setAdding] = useState(false);
  const { data } = crm;
  return (
    <div className="page">
      <div className="toolbar"><span className="sub">{data.companies.length} companies</span><div className="spacer" /><button className="btn primary" onClick={() => setAdding(true)}>New company</button></div>
      {adding && <NewCompany crm={crm} onDone={() => setAdding(false)} />}
      <div className="card">
        {data.companies.length === 0 ? <div className="empty">No companies yet. Add the first one.</div> : (
          <div className="table-wrap"><table className="list">
            <thead><tr><th>Company</th><th>Industry</th><th>Size</th><th>Country</th><th className="num">Open deals</th></tr></thead>
            <tbody>
              {data.companies.map((c) => {
                const open = openPipeline(data.deals.filter((d) => d.companyId === c.id));
                return (
                  <tr key={c.id} className="row" onClick={() => onOpen({ kind: 'company', id: c.id })}>
                    <td>{c.name}<div className="sub">{c.domain}</div></td><td>{c.industry ?? '—'}</td><td>{c.size ?? '—'}</td><td>{c.country ?? '—'}</td>
                    <td className="num">{open.count ? `${open.count} · ${eur(open.value)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function NewCompany({ crm, onDone }: { crm: Crm; onDone: () => void }) {
  const [f, setF] = useState({ name: '', domain: '', industry: '', size: '', country: '' });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card form" onSubmit={(e) => {
      e.preventDefault();
      if (!f.name.trim()) return setErr('Give the company a name.');
      crm.addCompany({ name: f.name.trim(), domain: f.domain || undefined, industry: f.industry || undefined, size: (f.size || undefined) as never, country: f.country || undefined });
      onDone();
    }}>
      <h2>New company</h2>
      {err && <ul className="errors"><li>{err}</li></ul>}
      <div className="row2">
        <Field label="Name" id="cn"><input id="cn" autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label="Website" id="cd"><input id="cd" value={f.domain} onChange={set('domain')} placeholder="example.com" /></Field>
      </div>
      <div className="row2">
        <Field label="Industry" id="ci"><input id="ci" value={f.industry} onChange={set('industry')} /></Field>
        <Field label="Size" id="cs"><select id="cs" value={f.size} onChange={set('size')}><option value="">—</option>{['1-9', '10-49', '50-249', '250+'].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <div className="toolbar"><button className="btn primary" type="submit">Create company</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

// ---------------- Contacts ----------------

export function Contacts({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const [adding, setAdding] = useState(false);
  const { data } = crm;
  const companyName = (id?: string) => data.companies.find((c) => c.id === id)?.name ?? '—';
  return (
    <div className="page">
      <div className="toolbar"><span className="sub">{data.contacts.length} people. Every contact records where they came from and why we may keep them.</span><div className="spacer" /><button className="btn primary" onClick={() => setAdding(true)}>New contact</button></div>
      {adding && <NewContact crm={crm} onDone={() => setAdding(false)} />}
      <div className="card">
        {data.contacts.length === 0 ? <div className="empty">No contacts yet.</div> : (
          <div className="table-wrap"><table className="list">
            <thead><tr><th>Name</th><th>Company</th><th>Role</th><th>Source</th><th>Basis</th></tr></thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c.id} className="row" onClick={() => onOpen({ kind: 'contact', id: c.id })}>
                  <td>{c.firstName} {c.lastName}<div className="sub">{c.email}</div></td><td>{companyName(c.companyId)}</td><td>{c.role ?? '—'}</td><td>{c.source}</td>
                  <td><span className="pill">{c.lawfulBasis === 'legitimate_interest' ? 'Legit. interest' : c.lawfulBasis[0].toUpperCase() + c.lawfulBasis.slice(1).replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function NewContact({ crm, onDone }: { crm: Crm; onDone: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '', companyId: '', source: '', lawfulBasis: 'legitimate_interest' as LawfulBasis, consentDate: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c: Omit<Contact, 'id' | 'createdAt'> = { ...f, email: f.email || undefined, phone: f.phone || undefined, role: f.role || undefined, companyId: f.companyId || undefined, consentDate: f.consentDate || undefined };
    const errs = validateContact(c);
    if (errs.length) return setErrors(errs);
    crm.addContact(c);
    onDone();
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>New contact</h2>
      {errors.length > 0 && <ul className="errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="row2">
        <Field label="First name" id="fn"><input id="fn" autoFocus value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name" id="ln"><input id="ln" value={f.lastName} onChange={set('lastName')} /></Field>
      </div>
      <div className="row2">
        <Field label="Email" id="em"><input id="em" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Role" id="ro"><input id="ro" value={f.role} onChange={set('role')} /></Field>
      </div>
      <div className="row2">
        <Field label="Company" id="co"><select id="co" value={f.companyId} onChange={set('companyId')}><option value="">—</option>{crm.data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Where they came from" id="so"><input id="so" value={f.source} onChange={set('source')} placeholder="Event, referral, website form…" /></Field>
      </div>
      <div className="row2">
        <Field label="Why we may keep them" id="lb">
          <select id="lb" value={f.lawfulBasis} onChange={set('lawfulBasis')}>
            <option value="legitimate_interest">Legitimate interest</option><option value="consent">Consent</option><option value="contract">Contract</option><option value="legal_obligation">Legal obligation</option>
          </select>
        </Field>
        {f.lawfulBasis === 'consent' && <Field label="Consent given on" id="cdt"><input id="cdt" type="date" value={f.consentDate} onChange={set('consentDate')} /></Field>}
      </div>
      <div className="toolbar"><button className="btn primary" type="submit">Create contact</button><button className="btn ghost" type="button" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}

