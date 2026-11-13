import { useState } from 'react';
import { ActivityKind, RecordRef, STAGES, STAGE_LABEL, Stage, eur, exportContact, tasksFor, timeline } from './domain';
import { Crm } from './useCrm';
import { BASIS_LABEL, CompanyForm, ContactForm, DealForm, LostDialog } from './forms';
import { Avatar, Icon, Menu, Panel, Seg, fmtDay, todayIso, useToast } from '../platform/ui';

const KIND_LABEL: Record<ActivityKind, string> = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting', stage_change: 'Stage', created: 'Created' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function RecordPanel({ crm, refr, onClose, onOpen }: { crm: Crm; refr: RecordRef; onClose: () => void; onOpen: (r: RecordRef) => void }) {
  const { data } = crm;
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [lost, setLost] = useState(false);
  const [newDeal, setNewDeal] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [copied, setCopied] = useState(false);

  const company = refr.kind === 'company' ? data.companies.find((c) => c.id === refr.id) : undefined;
  const contact = refr.kind === 'contact' ? data.contacts.find((c) => c.id === refr.id) : undefined;
  const deal = refr.kind === 'deal' ? data.deals.find((d) => d.id === refr.id) : undefined;
  if (!company && !contact && !deal) return null;

  if (editing && company) return <CompanyForm crm={crm} company={company} onClose={() => setEditing(false)} />;
  if (editing && contact) return <ContactForm crm={crm} contact={contact} onClose={() => setEditing(false)} />;
  if (editing && deal) return <DealForm crm={crm} deal={deal} onClose={() => setEditing(false)} />;
  if (lost && deal) return <LostDialog onClose={() => setLost(false)} onSave={(r) => { toast(`${deal.title} marked lost`, crm.moveDeal(deal.id, 'lost', r)); setLost(false); }} />;
  if (newDeal) return <DealForm crm={crm} preset={{ companyId: company?.id ?? contact?.companyId, contactId: contact?.id }} onClose={() => setNewDeal(false)} />;

  const companyOf = (id?: string) => data.companies.find((c) => c.id === id);
  const contactOf = (id?: string) => data.contacts.find((c) => c.id === id);
  const link = (r: RecordRef, label: string) => <a href="#" onClick={(e) => { e.preventDefault(); onOpen(r); }}>{label}</a>;
  const title = company?.name ?? (contact ? `${contact.firstName} ${contact.lastName}` : deal!.title);
  const ref = deal ? { dealId: deal.id, companyId: deal.companyId, contactId: deal.contactId } : contact ? { contactId: contact.id, companyId: contact.companyId } : { companyId: company!.id };

  const del = () => {
    if (company) { const undo = crm.deleteCompany(company.id); onClose(); toast(`Deleted ${company.name}`, undo); }
    if (deal) { const undo = crm.deleteDeal(deal.id); onClose(); toast(`Deleted ${deal.title}`, undo); }
  };

  const exportData = () => {
    const json = JSON.stringify(exportContact(data, contact!.id), null, 2);
    navigator.clipboard?.writeText(json).then(() => { setCopied(true); toast('Copied their data as JSON'); }, () => setCopied(false));
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `contact-export-${contact!.id}.json`;
      a.click();
    } catch { /* downloads blocked: the clipboard copy is enough */ }
  };

  return (
    <Panel
      title={title}
      eyebrow={company ? [company.industry, company.country].filter(Boolean).join(' · ') || 'Company' : contact ? [contact.role, companyOf(contact.companyId)?.name].filter(Boolean).join(' at ') || 'Contact' : `Deal · ${STAGE_LABEL[deal!.stage]}`}
      lead={deal ? <span className="avatar co" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="deals" size={16} /></span> : <Avatar name={title} company={!!company} />}
      actions={<Menu items={[
        { label: 'Edit', icon: 'edit', onClick: () => setEditing(true) },
        ...(deal ? [] : [{ label: 'New deal', icon: 'plus', onClick: () => setNewDeal(true) }]),
        ...(contact ? [] : ['divider' as const, { label: 'Delete', icon: 'trash', danger: true, onClick: del }]),
      ]} />}
      onClose={onClose}>

      {deal && (
        <>
          <div className="hero" style={{ gap: 28 }}>
            <div><div className="sub">Value</div><div className="stat" style={{ fontSize: 34 }}>{eur(deal.value)}</div></div>
            <div><div className="sub">Expected close</div><div className="ink" style={{ fontWeight: 600, marginTop: 6 }}>{deal.expectedClose ? fmtDay(deal.expectedClose) : 'Not set'}</div></div>
          </div>
          <div>
            <div className="section-title">Stage</div>
            <div style={{ overflowX: 'auto' }}>
              <Seg small label="Stage" value={deal.stage} options={STAGES.map((s) => ({ id: s, label: STAGE_LABEL[s] }))}
                onChange={(s: Stage) => { if (s === 'lost') setLost(true); else toast(`Moved to ${STAGE_LABEL[s]}`, crm.moveDeal(deal.id, s)); }} />
            </div>
          </div>
          <dl className="facts">
            <dt>Company</dt><dd>{deal.companyId ? link({ kind: 'company', id: deal.companyId }, companyOf(deal.companyId)?.name ?? '') : '—'}</dd>
            <dt>Contact</dt><dd>{deal.contactId ? link({ kind: 'contact', id: deal.contactId }, `${contactOf(deal.contactId)?.firstName} ${contactOf(deal.contactId)?.lastName}`) : '—'}</dd>
            <dt>Next step</dt><dd>{deal.nextStep ?? <span className="muted">None. Add one so the deal keeps moving.</span>}{deal.nextStepDue && <span className="sub"> · {fmtDay(deal.nextStepDue)}</span>}</dd>
            {deal.lostReason && <><dt>Lost because</dt><dd>{deal.lostReason}</dd></>}
          </dl>
        </>
      )}

      {company && (
        <>
          <dl className="facts">
            <dt>Website</dt><dd>{company.domain ?? '—'}</dd>
            <dt>Size</dt><dd>{company.size ? `${company.size} people` : '—'}</dd>
            <dt>Country</dt><dd>{company.country ?? '—'}</dd>
          </dl>
          <div>
            <div className="section-title">People</div>
            <div className="card flat tight"><div className="rows">
              {data.contacts.filter((c) => c.companyId === company.id).map((c) => (
                <div key={c.id} className="row" onClick={() => onOpen({ kind: 'contact', id: c.id })}><Avatar name={`${c.firstName} ${c.lastName}`} size="sm" /><div className="grow"><div className="t">{c.firstName} {c.lastName}</div><div className="sub">{c.role}</div></div></div>
              ))}
              {!data.contacts.some((c) => c.companyId === company.id) && <div className="row muted" style={{ cursor: 'default' }}>No people yet.</div>}
            </div></div>
          </div>
          <div>
            <div className="section-title">Deals</div>
            <div className="card flat tight"><div className="rows">
              {data.deals.filter((d) => d.companyId === company.id).map((d) => (
                <div key={d.id} className="row" onClick={() => onOpen({ kind: 'deal', id: d.id })}><div className="grow"><div className="t">{d.title}</div><div className="sub">{STAGE_LABEL[d.stage]}</div></div><div className="end ink num">{eur(d.value)}</div></div>
              ))}
              {!data.deals.some((d) => d.companyId === company.id) && <div className="row muted" style={{ cursor: 'default' }}>No deals yet.</div>}
            </div></div>
          </div>
        </>
      )}

      {contact && (
        <>
          <div className="toolbar">
            {contact.email && <a className="btn sm" href={`mailto:${contact.email}`}><Icon name="mail" size={16} />{contact.email}</a>}
            {contact.phone && <span className="btn sm" style={{ cursor: 'text', userSelect: 'all' }}><Icon name="phone" size={16} />{contact.phone}</span>}
          </div>
          <dl className="facts">
            <dt>Company</dt><dd>{contact.companyId ? link({ kind: 'company', id: contact.companyId }, companyOf(contact.companyId)?.name ?? '') : '—'}</dd>
            <dt>Source</dt><dd>{contact.source}</dd>
            <dt><span data-tip="The GDPR reason you may keep this person on file." tabIndex={0}>Lawful basis</span></dt><dd>{BASIS_LABEL[contact.lawfulBasis]}{contact.consentDate ? `, given ${fmtDay(contact.consentDate)}` : ''}</dd>
          </dl>
        </>
      )}

      <Tasks crm={crm} refr={refr} refIds={ref} />
      <Timeline crm={crm} refr={refr} refIds={ref} />

      {contact && (
        <div>
          <div className="section-title">Their data</div>
          <div className="toolbar">
            <button className="btn sm" onClick={exportData} data-tip="Copies everything held about this person, for a subject access request."><Icon name="upload" size={16} />{copied ? 'Copied' : 'Export their data'}</button>
            {!confirmErase
              ? <button className="btn sm danger" onClick={() => setConfirmErase(true)}><Icon name="trash" size={16} />Delete forever</button>
              : <>
                  <button className="btn sm" style={{ background: 'var(--neg)', color: '#fff' }} onClick={() => { crm.erase(contact.id); onClose(); toast('Deleted for good. The log keeps no personal data.'); }}>Yes, delete for good</button>
                  <button className="btn sm ghost" onClick={() => setConfirmErase(false)}>Keep</button>
                </>}
          </div>
          {confirmErase && <p className="sub" style={{ marginTop: 8 }}>Deletes the person, their notes and their own tasks. Deals stay with the company. This can't be undone.</p>}
        </div>
      )}
    </Panel>
  );
}

function Tasks({ crm, refr, refIds }: { crm: Crm; refr: RecordRef; refIds: { dealId?: string; contactId?: string; companyId?: string } }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayIso());
  const tasks = tasksFor(crm.data, refr);
  const t = todayIso();
  return (
    <div>
      <div className="section-title">Tasks</div>
      <div className="card flat tight">
        <div className="rows">
          {tasks.map((x) => (
            <div key={x.id} className="row" style={{ cursor: 'default', minHeight: 48 }}>
              <input type="checkbox" id={`tk-${x.id}`} checked={x.done} onChange={() => toast(x.done ? 'Reopened' : 'Done', crm.toggleTask(x.id))} aria-label={x.title} />
              <label htmlFor={`tk-${x.id}`} className="grow" style={{ cursor: 'pointer' }}><div className="t" style={{ textDecoration: x.done ? 'line-through' : undefined, color: x.done ? 'var(--muted)' : undefined }}>{x.title}</div></label>
              <span className={`pill ${!x.done && x.due < t ? 'neg' : !x.done && x.due === t ? 'accent' : ''}`}>{x.due === t ? 'Today' : fmtDay(x.due)}</span>
            </div>
          ))}
          <form className="row" style={{ cursor: 'default', gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; toast('Task added', crm.addTask({ title: title.trim(), due, ...refIds })); setTitle(''); }}>
            <Icon name="plus" size={16} className="muted" />
            <input className="input" style={{ flex: 1, border: 0, background: 'transparent', padding: 0, boxShadow: 'none' }} placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New task" id={`new-task-${refr.id}`} />
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" style={{ width: 150, height: 32 }} id={`new-task-due-${refr.id}`} />
            <button className="btn sm primary" type="submit" disabled={!title.trim()}>Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Timeline({ crm, refr, refIds }: { crm: Crm; refr: RecordRef; refIds: { dealId?: string; contactId?: string; companyId?: string } }) {
  const toast = useToast();
  const [kind, setKind] = useState<ActivityKind>('note');
  const [text, setText] = useState('');
  const items = timeline(crm.data, refr);
  return (
    <div>
      <div className="section-title">Timeline</div>
      <form className="form" style={{ gap: 8, marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; toast(`${KIND_LABEL[kind]} logged`, crm.log(kind, text.trim(), refIds)); setText(''); }}>
        <Seg small label="Kind" value={kind} onChange={setKind} options={(['note', 'call', 'email', 'meeting'] as ActivityKind[]).map((k) => ({ id: k, label: KIND_LABEL[k] }))} />
        <div className="inline-form">
          <input className="input" placeholder="What happened?" value={text} onChange={(e) => setText(e.target.value)} aria-label="Timeline entry" id={`tl-${refr.id}`} />
          <button className="btn primary" type="submit" disabled={!text.trim()}>Log</button>
        </div>
      </form>
      {items.length === 0 ? <div className="sub">Nothing logged yet.</div> : (
        <ul className="tl">
          {items.map((a) => (
            <li key={a.id} className={a.kind}>
              <div className="when">{KIND_LABEL[a.kind]} · {when(a.at)} · {a.by}</div>
              <div className="ink">{a.text}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
