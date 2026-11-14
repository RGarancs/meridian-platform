import { useState } from 'react';
import { tr, euro, locale } from './i18n';
import { ANNUAL_DISCOUNT, BUNDLES, ModelId, Need, PARTNER, SEAT, quote, yearly } from './plans';
import { Disclose, Icon } from './ui';

const money = (n: number) => euro(n.toLocaleString(locale()));

const MODELS: { id: ModelId; title: string; who: string; pros: string[]; cons: string[]; like: string }[] = [
  {
    id: 'bundles', title: tr('Plans by size'), who: tr('Small and mid-size companies buying for themselves'),
    pros: [tr('One clear price a month, easy to say yes to'), tr('Every module included, so customers use more of it'), tr('AI included up to a fair limit')],
    cons: [tr('A company at the top of a plan pays the same as one at the bottom')],
    like: tr('Like Apple One or Revolut plans: a few tiers, everything inside'),
  },
  {
    id: 'seats', title: tr('Per user'), who: tr('Teams that want to start small'),
    pros: [tr('Grows with the customer'), tr('Familiar from Pipedrive and HubSpot')],
    cons: [tr('Teams share logins to save money'), tr('The bill changes every month')],
    like: tr('Like Pipedrive or HubSpot Starter, around €15–€20 a user'),
  },
  {
    id: 'partner', title: tr('Partner (white label)'), who: tr('Agencies and consultancies who resell it under their name'),
    pros: [tr('One partner brings many customers'), tr('The brand settings already exist'), tr('The partner does the selling and support')],
    cons: [tr('Lower price per customer'), tr('Needs a partner programme and contracts')],
    like: tr('Like GoHighLevel, which agencies resell from about $97 to $497 a month'),
  },
];

export function Plans() {
  const [n, setN] = useState<Need>({ users: 8, employees: 40, clients: 10 });
  const num = (k: keyof Need, label: string) => (
    <div className="field"><label htmlFor={`pl-${k}`}>{label}</label>
      <input id={`pl-${k}`} className="input" type="number" min={0} value={n[k]} onChange={(e) => setN({ ...n, [k]: Math.max(0, Number(e.target.value) || 0) })} /></div>
  );
  return (
    <>
      <div className="card">
        <p className="sub" style={{ marginTop: 0 }}>{tr('Three ways to charge for Corta Meridian. Try a customer below and compare what they would pay. These are draft prices for you to decide on; nothing is billed.')}</p>
        <div className="row2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {num('users', tr('Sales users'))}{num('employees', tr('Employees in People'))}{num('clients', tr('Clients, for a partner'))}
        </div>
      </div>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {MODELS.map((m) => {
          const q = quote(m.id, n);
          const best = m.id === 'bundles';
          return (
            <div key={m.id} className="card" style={best ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{m.title}</span>{best && <span className="pill" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>{tr('Suggested')}</span>}
              </div>
              <div style={{ fontSize: 32, fontWeight: 650, letterSpacing: '-.02em', margin: '8px 0 2px' }}>{money(q.monthly)}<span className="sub" style={{ fontSize: 14, fontWeight: 400 }}> {tr('a month')}</span></div>
              <div className="sub" data-tip={tr('{0}% off when paid for a year', { 0: ANNUAL_DISCOUNT * 100 })} tabIndex={0}>{q.detail} · {money(yearly(q.monthly))} {tr('a year')}</div>
              <p style={{ margin: '12px 0 8px' }}>{m.who}</p>
              <div className="rows" style={{ gap: 4, display: 'grid' }}>
                {m.pros.map((p) => <div key={p} className="sub" style={{ display: 'flex', gap: 6 }}><Icon name="check" size={14} />{p}</div>)}
                {m.cons.map((p) => <div key={p} className="sub" style={{ display: 'flex', gap: 6, color: 'var(--muted)' }}><Icon name="close" size={14} />{p}</div>)}
              </div>
              <Disclose title={tr('Compared with')}><p className="sub" style={{ margin: 0 }}>{m.like}</p></Disclose>
            </div>
          );
        })}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{tr('Suggestion')}</h3>
        <p style={{ marginTop: 0 }}>{tr('Sell plans by size to companies, and offer the partner price to agencies from day one, since that is how the white label earns. Keep per-user pricing out of the price list and use it only to quote very small teams.')}</p>
        <div className="rows" style={{ display: 'grid', gap: 6 }}>
          {BUNDLES.map((b) => (
            <div key={b.id} className="sub" style={{ display: 'flex', gap: 8 }}><b style={{ minWidth: 70, color: 'var(--ink)' }}>{b.name}</b>{money(b.price)} {tr('a month')} · {b.users === Infinity ? tr('any size, SSO and a named contact') : tr('up to {0} Sales users and {1} employees', { 0: b.users, 1: b.employees })}</div>
          ))}
          <div className="sub" style={{ display: 'flex', gap: 8 }}><b style={{ minWidth: 70, color: 'var(--ink)' }}>{tr('Partner')}</b>{tr('{0} a month, then {1} for each client workspace', { 0: money(PARTNER.base), 1: money(PARTNER.perClient) })}</div>
        </div>
        <Disclose title={tr('Pilots and AI use')}>
          <p className="sub" style={{ margin: 0 }}>{tr('SSE Riga, NordStreet and Tenax: free for 3 months, then half price for the first year in return for a case study and a monthly feedback call. AI is included up to a fair monthly limit; above it, customers pay what it costs us plus 20%.')}</p>
          <p className="sub" style={{ marginBottom: 0 }}>{tr('Per-user ballpark: {0} a Sales user and {1} an employee a month.', { 0: money(SEAT.sales), 1: money(SEAT.people) })}</p>
        </Disclose>
      </div>
    </>
  );
}
