import { useEffect, useState } from 'react';
import { ActivityKind, RecordRef, STAGES, STAGE_LABEL, Stage, eur, exportContact, timeline } from './domain';
import { Crm } from './useCrm';

const KIND_LABEL: Record<ActivityKind, string> = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting', stage_change: 'Stage', created: 'Created' };
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const BASIS: Record<string, string> = { consent: 'Consent', contract: 'Contract', legitimate_interest: 'Legitimate interest', legal_obligation: 'Legal obligation' };

export function RecordPanel({ crm, refr, onClose, onOpen }: { crm: Crm; refr: RecordRef; onClose: () => void; onOpen: (r: RecordRef) => void }) {
  const { data } = crm;
  const [kind, setKind] = useState<ActivityKind>('note');
  const [text, setText] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [pendingLost, setPendingLost] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const company = refr.kind === 'company' ? data.companies.find((c) => c.id === refr.id) : undefined;
  const contact = refr.kind === 'contact' ? data.contacts.find((c) => c.id === refr.id) : undefined;
  const deal = refr.kind === 'deal' ? data.deals.find((d) => d.id === refr.id) : undefined;
  const record = company ?? contact ?? deal;
  if (!record) return null;

  const companyOf = (id?: string) => data.companies.find((c) => c.id === id);
  const contactOf = (id?: string) => data.contacts.find((c) => c.id === id);
  const link = (r: RecordRef, label: string) => <a href="#" onClick={(e) => { e.preventDefault(); onOpen(r); }}>{label}</a>;

  const title = company?.name ?? (contact ? `${contact.firstName} ${contact.lastName}` : deal!.title);
  const items = timeline(data, refr);
  const ref = deal ? { dealId: deal.id, companyId: deal.companyId, contactId: deal.contactId }
    : contact ? { contactId: contact.id, companyId: contact.companyId } : { companyId: company!.id };

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    crm.log(kind, text.trim(), ref);
    setText('');
  };

  const [copied, setCopied] = useState(false);
  const download = () => {
    const json = JSON.stringify(exportContact(data, contact!.id), null, 2);
    navigator.clipboard?.writeText(json).then(() => setCopied(true), () => setCopied(false));
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contact-export-${contact!.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const changeStage = (to: Stage) => {
    if (to === 'lost') { setPendingLost(true); return; }
    crm.moveDeal(deal!.id, to);
  };

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label={title}>
        <div className="panel-head">
          <div>
            <div className="sub">{refr.kind === 'company' ? 'Company' : refr.kind === 'contact' ? 'Contact' : 'Deal'}</div>
            <h2 style={{ fontSize: 20 }}>{title}</h2>
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="panel-body">
          {company && (
            <>
              <dl className="facts">
                <dt>Website</dt><dd>{company.domain ?? '—'}</dd>
                <dt>Industry</dt><dd>{company.industry ?? '—'}</dd>
                <dt>Size</dt><dd>{company.size ? `${company.size} people` : '—'}</dd>
                <dt>Country</dt><dd>{company.country ?? '—'}</dd>
              </dl>
              <div>
                <h3 style={{ fontSize: 13, marginBottom: 6 }}>People</h3>
                {data.contacts.filter((c) => c.companyId === company.id).map((c) => (
                  <div key={c.id}>{link({ kind: 'contact', id: c.id }, `${c.firstName} ${c.lastName}`)} <span className="sub">{c.role}</span></div>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: 13, marginBottom: 6 }}>Deals</h3>
                {data.deals.filter((d) => d.companyId === company.id).map((d) => (
                  <div key={d.id}>{link({ kind: 'deal', id: d.id }, d.title)} <span className="sub">{STAGE_LABEL[d.stage]} · {eur(d.value)}</span></div>
                ))}
              </div>
            </>
          )}
          {contact && (
            <>
              <dl className="facts">
                <dt>Role</dt><dd>{contact.role ?? '—'}</dd>
                <dt>Company</dt><dd>{contact.companyId ? link({ kind: 'company', id: contact.companyId }, companyOf(contact.companyId)?.name ?? '') : '—'}</dd>
                <dt>Email</dt><dd>{contact.email ?? '—'}</dd>
                <dt>Phone</dt><dd>{contact.phone ?? '—'}</dd>
                <dt>Source</dt><dd>{contact.source}</dd>
                <dt>Lawful basis</dt><dd>{BASIS[contact.lawfulBasis]}{contact.consentDate ? `, given ${contact.consentDate.slice(0, 10)}` : ''}</dd>
              </dl>
              <div className="toolbar">
                <button className="btn small" onClick={download}>{copied ? 'Copied as JSON' : 'Export their data'}</button>
                {!confirmErase
                  ? <button className="btn small danger" onClick={() => setConfirmErase(true)}>Delete forever</button>
                  : <>
                      <span className="sub">Deletes the person and their notes. Deals stay. Can't be undone.</span>
                      <button className="btn small danger" onClick={() => { crm.erase(contact.id); onClose(); }}>Yes, delete</button>
                      <button className="btn small ghost" onClick={() => setConfirmErase(false)}>Keep</button>
                    </>}
              </div>
            </>
          )}
          {deal && (
            <>
              <dl className="facts">
                <dt>Value</dt><dd>{eur(deal.value)}</dd>
                <dt>Stage</dt>
                <dd>
                  <select value={deal.stage} onChange={(e) => changeStage(e.target.value as Stage)} aria-label="Stage" style={{ height: 32, borderRadius: 8, background: 'var(--inset)', border: '1px solid var(--line)' }}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                </dd>
                <dt>Company</dt><dd>{deal.companyId ? link({ kind: 'company', id: deal.companyId }, companyOf(deal.companyId)?.name ?? '') : '—'}</dd>
                <dt>Contact</dt><dd>{deal.contactId ? link({ kind: 'contact', id: deal.contactId }, `${contactOf(deal.contactId)?.firstName} ${contactOf(deal.contactId)?.lastName}`) : '—'}</dd>
                <dt>Expected close</dt><dd>{deal.expectedClose ?? '—'}</dd>
                {deal.lostReason && <><dt>Lost because</dt><dd>{deal.lostReason}</dd></>}
              </dl>
              {pendingLost && (
                <form className="note-box" onSubmit={(e) => { e.preventDefault(); if (lostReason.trim()) { crm.moveDeal(deal.id, 'lost', lostReason.trim()); setPendingLost(false); setLostReason(''); } }}>
                  <input className="btn" style={{ textAlign: 'left' }} autoFocus placeholder="Why was it lost?" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                  <button className="btn small primary" type="submit">Mark lost</button>
                  <button className="btn small ghost" type="button" onClick={() => setPendingLost(false)}>Cancel</button>
                </form>
              )}
              <NextStep crm={crm} dealId={deal.id} nextStep={deal.nextStep} due={deal.nextStepDue} />
            </>
          )}

          <div>
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Timeline</h3>
            <form className="note-box" onSubmit={addEntry} style={{ marginBottom: 12 }}>
              <select className="btn small" value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} aria-label="Kind">
                {(['note', 'call', 'email', 'meeting'] as ActivityKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              <input className="btn small" style={{ textAlign: 'left' }} placeholder="What happened?" value={text} onChange={(e) => setText(e.target.value)} aria-label="Timeline entry" />
              <button className="btn small primary" type="submit">Add</button>
            </form>
            {items.length === 0 ? <div className="sub">Nothing yet.</div> : (
              <ul className="tl">
                {items.map((a) => (
                  <li key={a.id} className={a.kind}>
                    <div className="when">{KIND_LABEL[a.kind]} · {fmt(a.at)} · {a.by}</div>
                    <div style={{ color: 'var(--ink)' }}>{a.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function NextStep({ crm, dealId, nextStep, due }: { crm: Crm; dealId: string; nextStep?: string; due?: string }) {
  const [step, setStep] = useState(nextStep ?? '');
  const [date, setDate] = useState(due ?? '');
  useEffect(() => { setStep(nextStep ?? ''); setDate(due ?? ''); }, [nextStep, due, dealId]);
  const dirty = step !== (nextStep ?? '') || date !== (due ?? '');
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); crm.updateDeal(dealId, { nextStep: step || undefined, nextStepDue: date || undefined }); }}>
      <div className="row2">
        <div className="field"><label htmlFor="ns">Next step</label><input id="ns" value={step} onChange={(e) => setStep(e.target.value)} placeholder="e.g. Send revised offer" /></div>
        <div className="field"><label htmlFor="nsd">Due</label><input id="nsd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {dirty && <div><button className="btn small primary" type="submit">Save next step</button></div>}
    </form>
  );
}
