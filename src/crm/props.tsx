import { tr } from '../platform/i18n';
// Custom properties: each tenant adds its own fields to companies and contacts (plan, renewal date, seats...).
import { useState } from 'react';
import { PropValue, PropertyDef } from './domain';
import { Crm } from './useCrm';
import { Field, Icon, Panel, fmtDayYear, useToast } from '../platform/ui';

export const showProp = (d: PropertyDef, v?: PropValue) => (v === undefined || v === '' ? '—' : d.type === 'yes_no' ? (v ? 'Yes' : 'No') : d.type === 'date' ? fmtDayYear(String(v)) : String(v));

export function PropFacts({ defs, values }: { defs: PropertyDef[]; values?: Record<string, PropValue> }) {
  return <>{defs.map((d) => <FactPair key={d.id} label={d.label} value={showProp(d, values?.[d.id])} />)}</>;
}
function FactPair({ label, value }: { label: string; value: string }) { return <><dt>{label}</dt><dd>{value}</dd></>; }

/** Inputs for the custom properties of one record, inside an existing form. */
export function PropInputs({ defs, values, onChange }: { defs: PropertyDef[]; values: Record<string, PropValue>; onChange: (v: Record<string, PropValue>) => void }) {
  if (!defs.length) return null;
  const set = (id: string, v: PropValue) => onChange({ ...values, [id]: v });
  return (
    <div className="row2" style={{ flexWrap: 'wrap' }}>
      {defs.map((d) => (
        <Field key={d.id} label={d.label} id={`pp-${d.id}`} tip={tr("A custom property your team added.")}>
          {d.type === 'select' ? <select id={`pp-${d.id}`} value={String(values[d.id] ?? '')} onChange={(e) => set(d.id, e.target.value)}><option value="">—</option>{d.options?.map((o) => <option key={o}>{o}</option>)}</select>
            : d.type === 'yes_no' ? <select id={`pp-${d.id}`} value={values[d.id] === undefined ? '' : values[d.id] ? 'yes' : 'no'} onChange={(e) => set(d.id, e.target.value === 'yes')}><option value="">—</option><option value="yes">{tr("Yes")}</option><option value="no">{tr("No")}</option></select>
            : <input id={`pp-${d.id}`} type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'} value={String(values[d.id] ?? '')} onChange={(e) => set(d.id, d.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} />}
        </Field>
      ))}
    </div>
  );
}

const TYPE_LABEL: Record<PropertyDef['type'], string> = { text: tr("Text"), number: 'Number', select: tr("Choice list"), date: 'Date', yes_no: tr("Yes or no") };

/** Settings section: add and remove properties. */
export function PropertySettings({ crm }: { crm: Crm }) {
  const toast = useToast();
  const [f, setF] = useState({ label: '', entity: 'company' as PropertyDef['entity'], type: 'text' as PropertyDef['type'], options: '' });
  const [adding, setAdding] = useState(false);
  return (
    <div className="card tight">
      <div className="card-head"><h2>{tr("Customer properties")}</h2><div className="spacer" /><button className="btn sm primary" onClick={() => setAdding(true)}><Icon name="plus" size={14} />{tr("Add property")}</button></div>
      <p className="sub" style={{ margin: '0 4px 8px' }}>{tr("Your own fields on companies and contacts. A date property with “renew” in its name feeds the automatic health check.")}</p>
      <div className="rows">{crm.data.properties.map((p) => (
        <div key={p.id} className="row" style={{ cursor: 'default' }}>
          <div className="grow"><div className="t">{p.label}</div><div className="sub">{p.entity === 'company' ? tr("Company") : tr("Contact")} · {TYPE_LABEL[p.type]}{p.options ? `: ${p.options.join(', ')}` : ''}</div></div>
          <span className="reveal"><button className="btn sm ghost danger" onClick={() => toast(tr("Removed {0}", { 0: p.label }), crm.deleteProperty(p.id))}><Icon name="trash" size={14} />{tr("Remove")}</button></span>
        </div>
      ))}</div>
      {adding && (
        <Panel title={tr("Add a property")} onClose={() => setAdding(false)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.label.trim()) return; toast(tr("Added {0}", { 0: f.label }), crm.addProperty({ label: f.label.trim(), entity: f.entity, type: f.type, options: f.type === 'select' ? f.options.split(',').map((x) => x.trim()).filter(Boolean) : undefined })); setAdding(false); }}>
            <Field label={tr("Name")} id="np-l"><input id="np-l" autoFocus value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={tr("Renewal date, Seats, Plan...")} /></Field>
            <div className="row2">
              <Field label={tr("On")} id="np-e"><select id="np-e" value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value as PropertyDef['entity'] })}><option value="company">{tr("Companies")}</option><option value="contact">{tr("Contacts")}</option></select></Field>
              <Field label={tr("Kind")} id="np-t"><select id="np-t" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PropertyDef['type'] })}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            {f.type === 'select' && <Field label={tr("Choices, separated by commas")} id="np-o"><input id="np-o" value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></Field>}
            <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.label.trim()}>{tr("Add property")}</button><button className="btn ghost" type="button" onClick={() => setAdding(false)}>{tr("Cancel")}</button></div>
          </form>
        </Panel>
      )}
    </div>
  );
}
