import { tr } from '../platform/i18n';
import { useState } from 'react';
import { Company, Contact, Deal, LawfulBasis, PropValue, STAGES, STAGE_LABEL, Stage, validateContact, validateDeal } from './domain';
import { Crm } from './useCrm';
import { Field, Panel, useToast } from '../platform/ui';
import { PropInputs } from './props';
import { validateProps } from './ai';

const SIZES = ['1-9', '10-49', '50-249', '250+'] as const;
export const BASIS_LABEL: Record<LawfulBasis, string> = { consent: 'Consent', contract: 'Contract', legitimate_interest: tr("Legitimate interest"), legal_obligation: tr("Legal obligation") };
const BASIS_TIP = tr("The GDPR reason you may keep this person on file. Consent needs the date it was given.");

export function CompanyForm({ crm, company, onClose }: { crm: Crm; company?: Company; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: company?.name ?? '', domain: company?.domain ?? '', industry: company?.industry ?? '', size: company?.size ?? '', country: company?.country ?? '' });
  const [err, setErr] = useState('');
  const [props, setProps] = useState<Record<string, PropValue>>(company?.props ?? {});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr(tr("Give the company a name."));
    const pe = validateProps(crm.data, 'company', props);
    if (pe.length) return setErr(pe[0]);
    const v = { name: f.name.trim(), domain: f.domain || undefined, industry: f.industry || undefined, size: (f.size || undefined) as Company['size'], country: f.country || undefined, props };
    if (company) { const undo = crm.updateCompany(company.id, v); toast(tr("Saved {0}", { 0: v.name }), undo); }
    else { const r = crm.addCompany(v); toast(tr("Added {0}", { 0: v.name }), r.undo); }
    onClose();
  };
  return (
    <Panel title={company ? tr("Edit {0}", { 0: company.name }) : tr("New company")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err && <ul className="errors"><li>{err}</li></ul>}
        <Field label={tr("Name")} id="co-name"><input id="co-name" autoFocus value={f.name} onChange={set('name')} /></Field>
        <div className="row2">
          <Field label={tr("Website")} id="co-domain"><input id="co-domain" value={f.domain} onChange={set('domain')} placeholder={tr("example.com")} /></Field>
          <Field label={tr("Industry")} id="co-ind"><input id="co-ind" value={f.industry} onChange={set('industry')} /></Field>
        </div>
        <div className="row2">
          <Field label={tr("Size")} id="co-size"><select id="co-size" value={f.size} onChange={set('size')}><option value="">{tr("Unknown")}</option>{SIZES.map((s) => <option key={s} value={s}>{s} {tr("people")}</option>)}</select></Field>
          <Field label={tr("Country")} id="co-country"><input id="co-country" value={f.country} onChange={set('country')} placeholder={tr("LV")} /></Field>
        </div>
        <PropInputs defs={crm.data.properties.filter((p) => p.entity === 'company')} values={props} onChange={setProps} />
        <div className="toolbar"><button className="btn primary" type="submit">{company ? tr("Save") : tr("Add company")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

export function ContactForm({ crm, contact, onClose, companyId }: { crm: Crm; contact?: Contact; onClose: () => void; companyId?: string }) {
  const toast = useToast();
  const [f, setF] = useState({
    firstName: contact?.firstName ?? '', lastName: contact?.lastName ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '', role: contact?.role ?? '',
    companyId: contact?.companyId ?? companyId ?? '', source: contact?.source ?? '', lawfulBasis: contact?.lawfulBasis ?? ('legitimate_interest' as LawfulBasis), consentDate: contact?.consentDate?.slice(0, 10) ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [props, setProps] = useState<Record<string, PropValue>>(contact?.props ?? {});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = { ...f, props, email: f.email || undefined, phone: f.phone || undefined, role: f.role || undefined, companyId: f.companyId || undefined, consentDate: f.lawfulBasis === 'consent' ? f.consentDate || undefined : undefined };
    const errs = [...validateContact(c), ...validateProps(crm.data, 'contact', props)];
    if (errs.length) return setErrors(errs);
    if (contact) toast(tr("Saved {0} {1}", { 0: c.firstName, 1: c.lastName }), crm.updateContact(contact.id, c));
    else toast(tr("Added {0} {1}", { 0: c.firstName, 1: c.lastName }), crm.addContact(c).undo);
    onClose();
  };
  return (
    <Panel title={contact ? tr("Edit {0} {1}", { 0: contact.firstName, 1: contact.lastName }) : tr("New contact")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {errors.length > 0 && <ul className="errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="row2">
          <Field label={tr("First name")} id="ct-fn"><input id="ct-fn" autoFocus value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label={tr("Last name")} id="ct-ln"><input id="ct-ln" value={f.lastName} onChange={set('lastName')} /></Field>
        </div>
        <div className="row2">
          <Field label={tr("Email")} id="ct-em"><input id="ct-em" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label={tr("Phone")} id="ct-ph"><input id="ct-ph" value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="row2">
          <Field label={tr("Role")} id="ct-ro"><input id="ct-ro" value={f.role} onChange={set('role')} /></Field>
          <Field label={tr("Company")} id="ct-co"><select id="ct-co" value={f.companyId} onChange={set('companyId')}><option value="">{tr("None")}</option>{crm.data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <Field label={tr("Where they came from")} id="ct-so"><input id="ct-so" value={f.source} onChange={set('source')} placeholder={tr("Event, referral, website form, LinkedIn")} /></Field>
        <div className="row2">
          <Field label={tr("Why we may keep them")} id="ct-lb" tip={BASIS_TIP}><select id="ct-lb" value={f.lawfulBasis} onChange={set('lawfulBasis')}>{Object.entries(BASIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {f.lawfulBasis === 'consent' && <Field label={tr("Consent given on")} id="ct-cd"><input id="ct-cd" type="date" value={f.consentDate} onChange={set('consentDate')} /></Field>}
        </div>
        <PropInputs defs={crm.data.properties.filter((p) => p.entity === 'contact')} values={props} onChange={setProps} />
        <div className="toolbar"><button className="btn primary" type="submit">{contact ? tr("Save") : tr("Add contact")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

export function DealForm({ crm, deal, onClose, preset }: { crm: Crm; deal?: Deal; onClose: () => void; preset?: { companyId?: string; contactId?: string } }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: deal?.title ?? '', value: deal ? String(deal.value) : '', stage: deal?.stage ?? ('lead' as Stage),
    companyId: deal?.companyId ?? preset?.companyId ?? '', contactId: deal?.contactId ?? preset?.contactId ?? '',
    expectedClose: deal?.expectedClose ?? '', nextStep: deal?.nextStep ?? '', nextStepDue: deal?.nextStepDue ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = {
      title: f.title.trim(), value: Number(f.value || 0), stage: f.stage, companyId: f.companyId || undefined, contactId: f.contactId || undefined,
      expectedClose: f.expectedClose || undefined, nextStep: f.nextStep || undefined, nextStepDue: f.nextStepDue || undefined,
    };
    const errs = validateDeal(d);
    if (errs.length) return setErrors(errs);
    if (deal) toast(tr("Saved {0}", { 0: d.title }), crm.updateDeal(deal.id, d));
    else toast(tr("Added {0}", { 0: d.title }), crm.addDeal(d).undo);
    onClose();
  };
  return (
    <Panel title={deal ? tr("Edit {0}", { 0: deal.title }) : tr("New deal")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {errors.length > 0 && <ul className="errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
        <Field label={tr("Deal")} id="dl-t"><input id="dl-t" autoFocus value={f.title} onChange={set('title')} placeholder={tr("Company: what they buy")} /></Field>
        <div className="row2">
          <Field label={tr("Value (€)")} id="dl-v"><input id="dl-v" type="number" min="0" inputMode="numeric" value={f.value} onChange={set('value')} /></Field>
          {!deal && <Field label={tr("Stage")} id="dl-s"><select id="dl-s" value={f.stage} onChange={set('stage')}>{STAGES.filter((s) => s !== 'lost').map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></Field>}
          {deal && <Field label={tr("Expected close")} id="dl-ec"><input id="dl-ec" type="date" value={f.expectedClose} onChange={set('expectedClose')} /></Field>}
        </div>
        <div className="row2">
          <Field label={tr("Company")} id="dl-co"><select id="dl-co" value={f.companyId} onChange={set('companyId')}><option value="">{tr("None")}</option>{crm.data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label={tr("Contact")} id="dl-ct"><select id="dl-ct" value={f.contactId} onChange={set('contactId')}><option value="">{tr("None")}</option>{crm.data.contacts.filter((c) => !f.companyId || c.companyId === f.companyId).map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></Field>
        </div>
        {!deal && <Field label={tr("Expected close")} id="dl-ec2"><input id="dl-ec2" type="date" value={f.expectedClose} onChange={set('expectedClose')} /></Field>}
        <div className="row2">
          <Field label={tr("Next step")} id="dl-ns" tip={tr("Every open deal should have one. Deals without a next step show on Today.")}><input id="dl-ns" value={f.nextStep} onChange={set('nextStep')} /></Field>
          <Field label={tr("Next step due")} id="dl-nd"><input id="dl-nd" type="date" value={f.nextStepDue} onChange={set('nextStepDue')} /></Field>
        </div>
        <div className="toolbar"><button className="btn primary" type="submit">{deal ? tr("Save") : tr("Add deal")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

export function LostDialog({ onSave, onClose }: { onSave: (reason: string) => void; onClose: () => void }) {
  const [r, setR] = useState('');
  const reasons = ['Price', tr("Chose a competitor"), tr("No budget"), 'Timing', tr("Went quiet")];
  return (
    <Panel title={tr("Why was it lost?")} eyebrow={tr("Mark as lost")} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{tr("The reason feeds the win-rate review. Pick one or write your own.")}</p>
      <div className="toolbar">{reasons.map((x) => <button key={x} className="btn sm" aria-pressed={r === x} onClick={() => setR(x)} style={r === x ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}>{x}</button>)}</div>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (r.trim()) onSave(r.trim()); }}>
        <Field label={tr("Reason")} id="lost-r"><input id="lost-r" autoFocus value={r} onChange={(e) => setR(e.target.value)} /></Field>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!r.trim()}>{tr("Mark lost")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}
