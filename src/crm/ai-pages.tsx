// Sales pages for the automatic and agentic layer: customer health and segments, the service inbox,
// newsletters and Autopilot. Every suggestion shows its reasons; nothing is sent without approval.
import { useMemo, useState } from 'react';
import {
  Cluster, HEALTH_LABEL, HealthBand, SLA_LABEL, Suggestion, audience, clusterCompanies, companyFacts, draftNewsletter, draftReply, healthCheck,
  insights5B, personalise, serviceStats, slaState, suggestions, triage, validateCampaign,
} from './ai';
import { Campaign, Priority, RecordRef, SegmentRule, Ticket, TicketStatus, eur } from './domain';
import { Crm } from './useCrm';
import { showProp } from './props';
import { Avatar, Disclose, Empty, Field, Head, Icon, Menu, MenuItem, Panel, SearchInput, Seg, ShowMore, Stat, fmtDay, plural, todayIso, useContextMenu, useToast } from '../platform/ui';

type Open = (r: RecordRef) => void;
const nowIso = () => new Date().toISOString();
const ago = (iso: string) => { const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000); return h < 1 ? 'just now' : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`; };

// ---------------- 5B insight cards ----------------

export function InsightCards({ crm, only }: { crm: Crm; only?: string[] }) {
  const cards = insights5B(crm.data, todayIso()).filter((c) => !only || only.includes(c.id));
  return (
    <div className="grid">
      {cards.map((c) => (
        <div key={c.id} className="card insight s6">
          <div className="stat-label"><span data-tip="5B: Ballpark, Benchmark, Brevity, Breakdown, Bespoke insight." tabIndex={0}>{c.brevity}</span></div>
          <div className="ball">{c.ballpark}</div>
          <div className="sub">{c.benchmark}</div>
          {c.breakdown.length > 0 && <div className="bd">{c.breakdown.map((b) => <span key={b.label} className="chip">{b.label} <b className="ink num">{b.value}</b></span>)}</div>}
          <div className="bespoke"><Icon name="sparkle" size={14} /> {c.bespoke}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Customers: health and automatic segments ----------------

export function Customers({ crm, onOpen }: { crm: Crm; onOpen: Open }) {
  const { data } = crm;
  const t = todayIso();
  const ctx = useContextMenu();
  const [view, setView] = useState<'health' | 'segments'>('health');
  const [band, setBand] = useState<'all' | HealthBand>('all');
  const [q, setQ] = useState('');
  const rows = useMemo(() => data.companies.map((c) => ({ c, h: healthCheck(data, c.id, t), f: companyFacts(data, c.id, t) })).sort((a, b) => a.h.score - b.h.score), [data, t]);
  const clusters = useMemo(() => clusterCompanies(data, t), [data, t]);
  const clusterOf = (id: string) => clusters.find((c) => c.companyIds.includes(id));
  const shown = rows.filter((r) => (band === 'all' || r.h.band === band) && (!q || r.c.name.toLowerCase().includes(q.toLowerCase())));
  const risk = rows.filter((r) => r.h.band === 'at_risk').length;
  const plan = data.properties.find((p) => p.id === 'plan');
  const renewal = data.properties.find((p) => p.entity === 'company' && p.type === 'date' && /renew/i.test(p.label));
  const menu = (id: string, name: string): MenuItem[] => [
    { label: 'Open', icon: 'arrow', onClick: () => onOpen({ kind: 'company', id }) },
    { label: 'Book a check-in call', icon: 'task', onClick: () => { crm.addTask({ title: `Check-in call with ${name}`, due: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10), companyId: id }); } },
  ];
  return (
    <div className="page">
      <Head eyebrow="Sales" title={risk ? `${plural(risk, 'customer')} at risk.` : 'Every customer looks healthy.'} lede={<>Health is checked automatically from contact, deals, support and renewal dates. Segments are found automatically from how customers behave. <span data-tip="Starts at 70; recent contact, won and open deals add points; silence, losses, late tickets, overdue tasks and a quiet renewal take them away." tabIndex={0} style={{ textDecoration: 'underline dotted' }}>How the score works</span></>} />
      <div className="toolbar">
        <Seg label="View" value={view} onChange={setView} options={[{ id: 'health', label: 'Health' }, { id: 'segments', label: 'Segments' }]} />
        {view === 'health' && <>
          <Seg small label="Health" value={band} onChange={setBand} options={[{ id: 'all', label: 'All' }, { id: 'at_risk', label: 'At risk' }, { id: 'watch', label: 'Watch' }, { id: 'healthy', label: 'Healthy' }]} />
          <div className="spacer" />
          <SearchInput id="cu-q" value={q} onChange={setQ} placeholder="Find a customer" />
        </>}
      </div>
      {view === 'health' ? (
        <div className="card tight">
          {shown.length === 0 ? <Empty title="No customers match" /> : (
            <div style={{ overflowX: 'auto' }}><table className="list click">
              <thead><tr><th>Company</th><th>Health</th><th className="hide-phone">Why</th><th className="hide-phone">Segment</th>{plan && <th className="hide-phone">{plan.label}</th>}{renewal && <th className="hide-phone">{renewal.label}</th>}<th className="num">Won</th><th /></tr></thead>
              <tbody>{shown.map(({ c, h, f }) => (
                <tr key={c.id} onClick={() => onOpen({ kind: 'company', id: c.id })} tabIndex={0} {...ctx(menu(c.id, c.name), c.name)}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={c.name} size="sm" company /><div><div className="ink">{c.name}</div><div className="sub">{c.industry} · {c.country}</div></div></div></td>
                  <td><span className={`health ${h.band}`} data-tip={h.reasons.map((r) => `${r.impact > 0 ? '+' : ''}${r.impact} ${r.text}`).join('\n')}><i /><b className="ink num">{h.score}</b> {HEALTH_LABEL[h.band]}</span></td>
                  <td className="hide-phone muted" style={{ maxWidth: 260 }}>{h.reasons.find((r) => r.impact < 0)?.text ?? h.reasons[0]?.text}</td>
                  <td className="hide-phone">{clusterOf(c.id) && <span className="chip">{clusterOf(c.id)!.label}</span>}</td>
                  {plan && <td className="hide-phone">{showProp(plan, c.props?.[plan.id])}</td>}
                  {renewal && <td className="hide-phone">{showProp(renewal, c.props?.[renewal.id])}</td>}
                  <td className="num">{f.wonValue ? eur(f.wonValue) : '—'}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={menu(c.id, c.name)} /></span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ) : (
        <div className="grid">
          {clusters.map((cl) => (
            <div key={cl.id} className="card s6" {...ctx([{ label: 'Write a newsletter to this segment', icon: 'mail', onClick: () => { location.hash = `sales-newsletters`; sessionStorage.setItem('meridian:newsletter-cluster', cl.id); } }], cl.label)}>
              <div className="card-head"><h2>{cl.label}</h2><div className="spacer" /><span className="pill accent">{plural(cl.companyIds.length, 'company', 'companies')}</span></div>
              <p className="sub" style={{ margin: '0 0 6px' }}>{cl.why}</p>
              <p style={{ margin: '0 0 10px', color: 'var(--ink)' }}><Icon name="sparkle" size={14} /> {cl.action}</p>
              <div className="rows">
                <ShowMore items={cl.companyIds} n={4} noun="more companies" render={(id) => { const c = data.companies.find((x) => x.id === id)!; const h = healthCheck(data, id, t); return (
                  <div key={id} className="row" onClick={() => onOpen({ kind: 'company', id })}><Avatar name={c.name} size="sm" company /><div className="grow"><div className="t">{c.name}</div></div><span className={`health ${h.band}`}><i />{h.score}</span></div>
                ); }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="sub" style={{ margin: 0 }}>Tip: right-click any customer for quick actions.</p>
    </div>
  );
}

// ---------------- Service inbox ----------------

const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', waiting: 'Waiting on customer', solved: 'Solved' };
const PRIO_TONE: Record<Priority, string> = { high: 'neg', normal: '', low: '' };

export function Service({ crm, onOpen, focus }: { crm: Crm; onOpen: Open; focus?: string }) {
  const toast = useToast();
  const ctx = useContextMenu();
  const { data } = crm;
  const now = nowIso();
  const [filter, setFilter] = useState<'mine' | 'open' | 'waiting' | 'solved'>('open');
  const list = data.tickets.filter((t) => filter === 'open' ? t.status === 'open' : filter === 'mine' ? t.status !== 'solved' : t.status === filter)
    .sort((a, b) => Number(slaState(b, now).breached) - Number(slaState(a, now).breached) || (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0) || b.createdAt.localeCompare(a.createdAt));
  const [sel, setSel] = useState<string | null>(focus ?? list[0]?.id ?? null);
  const [logging, setLogging] = useState(false);
  const stats = serviceStats(data, now);
  const t = data.tickets.find((x) => x.id === sel);
  const menu = (x: Ticket): MenuItem[] => [
    { label: 'Open', icon: 'arrow', onClick: () => setSel(x.id) },
    x.status !== 'solved' ? { label: 'Mark solved', icon: 'check', onClick: () => toast('Solved', crm.setTicket(x.id, { status: 'solved' })) } : { label: 'Reopen', icon: 'arrow', onClick: () => toast('Reopened', crm.setTicket(x.id, { status: 'open' })) },
    { label: x.priority === 'high' ? 'Normal priority' : 'High priority', icon: 'up', onClick: () => toast('Priority changed', crm.setTicket(x.id, { priority: x.priority === 'high' ? 'normal' : 'high' })) },
  ];
  return (
    <div className="page">
      <Head eyebrow="Sales" title={stats.late ? `${plural(stats.late, 'customer')} waiting too long.` : stats.open ? `${plural(stats.open, 'open ticket')}, all on time.` : 'Inbox zero.'} lede={<>Each message is sorted automatically by topic, priority and tone, and gets a drafted reply. You edit and approve every reply. <span data-tip={SLA_LABEL} tabIndex={0} style={{ textDecoration: 'underline dotted' }}>Reply targets</span></>}>
        <button className="btn primary" onClick={() => setLogging(true)}><Icon name="plus" size={16} />Log a request</button>
      </Head>
      <div className="grid">
        <Stat label="Open" value={String(stats.open)} sub={`${stats.late} past the reply target`} span="s4" />
        <Stat label="First reply, median" value={stats.medianFirstReply === null ? '—' : `${stats.medianFirstReply} h`} sub={`${stats.withinSla ?? '—'}% within target`} span="s4" tip={SLA_LABEL} />
        <Stat label="Top topic" value={stats.byTopic[0]?.topic ?? '—'} sub={stats.byTopic.slice(1, 3).map((x) => `${x.topic} ${x.count}`).join(' · ') || ' '} span="s4" />
      </div>
      <div className="inbox">
        <div className="card tight">
          <Seg small label="Show" value={filter} onChange={(v) => setFilter(v)} options={[{ id: 'open', label: 'Open' }, { id: 'waiting', label: 'Waiting' }, { id: 'solved', label: 'Solved' }, { id: 'mine', label: 'All active' }]} />
          <div className="rows" style={{ marginTop: 8 }}>
            {list.length === 0 && <Empty title="Nothing here" />}
            {list.map((x) => {
              const s = slaState(x, now);
              const c = data.contacts.find((y) => y.id === x.contactId);
              return (
                <div key={x.id} className="row" aria-current={x.id === sel} style={x.id === sel ? { background: 'var(--accent-soft)' } : undefined} onClick={() => setSel(x.id)} tabIndex={0} {...ctx(menu(x), x.subject)}>
                  <Avatar name={c ? `${c.firstName} ${c.lastName}` : '?'} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}><div className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.subject}</div><div className="sub">{c?.firstName} · {x.topic ?? 'Question'} · {ago(x.createdAt)}</div></div>
                  {s.breached ? <span className="pill neg">Late</span> : x.priority === 'high' && x.status !== 'solved' ? <span className="pill warn">High</span> : null}
                </div>
              );
            })}
          </div>
        </div>
        {t ? <TicketView key={t.id} crm={crm} t={t} onOpen={onOpen} /> : <div className="card"><Empty title="Pick a conversation" /></div>}
      </div>
      {logging && <LogRequest crm={crm} onClose={() => setLogging(false)} onDone={(id) => { setFilter('open'); setSel(id); }} />}
    </div>
  );
}

function TicketView({ crm, t, onOpen }: { crm: Crm; t: Ticket; onOpen: Open }) {
  const toast = useToast();
  const { data } = crm;
  const c = data.contacts.find((x) => x.id === t.contactId);
  const co = data.companies.find((x) => x.id === t.companyId);
  const s = slaState(t, nowIso());
  const tri = triage(t.messages.filter((m) => m.from === 'customer').map((m) => m.text).join(' '));
  const [draft, setDraft] = useState(() => (t.status === 'solved' ? '' : draftReply(data, t, crm.user === 'You' ? 'Rihards' : crm.user)));
  const h = co ? healthCheck(data, co.id, todayIso()) : null;
  const deal = data.deals.find((d) => d.companyId === t.companyId && d.stage !== 'won' && d.stage !== 'lost');
  return (
    <div className="card">
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h2 style={{ fontSize: 18 }}>{t.subject}</h2>
          <div className="sub">{c && <button className="link" onClick={() => onOpen({ kind: 'contact', id: c.id })}>{c.firstName} {c.lastName}</button>}{co && <> · <button className="link" onClick={() => onOpen({ kind: 'company', id: co.id })}>{co.name}</button></>} · {t.channel} · {STATUS_LABEL[t.status]}</div>
        </div>
        <Menu items={[
          t.status !== 'solved' ? { label: 'Mark solved', icon: 'check', onClick: () => toast('Solved', crm.setTicket(t.id, { status: 'solved' })) } : { label: 'Reopen', icon: 'arrow', onClick: () => toast('Reopened', crm.setTicket(t.id, { status: 'open' })) },
          { label: t.priority === 'high' ? 'Normal priority' : 'High priority', icon: 'up', onClick: () => toast('Priority changed', crm.setTicket(t.id, { priority: t.priority === 'high' ? 'normal' : 'high' })) },
        ]} />
      </div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <span className="chip" data-tip={tri.because.length ? `Read from: ${tri.because.join(', ')}` : 'No strong signal words'}><Icon name="sparkle" size={12} />{t.topic ?? tri.topic}</span>
        <span className={`pill ${PRIO_TONE[t.priority]}`}>{t.priority === 'high' ? 'High priority' : t.priority === 'low' ? 'Low priority' : 'Normal priority'}</span>
        {tri.tone === 'upset' && <span className="pill warn" data-tip="The wording sounds frustrated. The draft opens with an apology.">Upset</span>}
        {t.status !== 'solved' && !s.answered && <span className={`pill ${s.breached ? 'neg' : ''}`} data-tip={SLA_LABEL}>{s.breached ? `Reply was due ${fmtDay(s.dueAt)}` : `Reply within ${s.hoursLeft} h`}</span>}
        {h && <span className={`health ${h.band}`} data-tip={h.reasons.map((r) => r.text).join(', ')}><i />Customer {HEALTH_LABEL[h.band].toLowerCase()}</span>}
        {deal && <span className="chip" data-tip="An open deal with this customer: handle with care.">Open deal {eur(deal.value)}</span>}
      </div>
      <div className="thread">
        {t.messages.map((m, i) => <div key={i} className={`bubble ${m.from === 'us' ? 'us' : ''}`}><span className="who">{m.from === 'us' ? m.by : c?.firstName ?? 'Customer'} · {ago(m.at)}</span>{m.text}</div>)}
      </div>
      {t.status !== 'solved' && (
        <div className="draft" style={{ marginTop: 14 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="sparkle" size={14} />Suggested reply · edit before sending</div>
          <textarea className="input" style={{ height: 170, padding: 12, background: 'var(--surface)' }} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Reply" />
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn primary" disabled={!draft.trim() || /\[add /.test(draft)} data-tip={/\[add /.test(draft) ? 'Fill in the parts in [brackets] first' : 'Sends as you, logged on the customer timeline'} onClick={() => toast('Reply approved and sent', crm.replyTicket(t.id, draft.trim(), false))}><Icon name="check" size={16} />Approve and send</button>
            <button className="btn" disabled={!draft.trim() || /\[add /.test(draft)} onClick={() => toast('Sent and solved', crm.replyTicket(t.id, draft.trim(), true))}>Send and solve</button>
            <button className="btn ghost" onClick={() => setDraft(draftReply(data, t, crm.user === 'You' ? 'Rihards' : crm.user))}>Redraft</button>
          </div>
          <p className="sub" style={{ margin: '8px 0 0' }}>In this demo the draft comes from templates. When hosted, Claude writes it from the customer’s history, and a person still approves it.</p>
        </div>
      )}
    </div>
  );
}

function LogRequest({ crm, onClose, onDone }: { crm: Crm; onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const { data } = crm;
  const [f, setF] = useState({ contactId: data.contacts[0]?.id ?? '', subject: '', text: '', channel: 'email' as Ticket['channel'] });
  const tri = triage(`${f.subject} ${f.text}`);
  return (
    <Panel title="Log a customer request" onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault(); if (!f.subject.trim() || !f.text.trim()) return;
        const c = data.contacts.find((x) => x.id === f.contactId);
        const r = crm.addTicket({ subject: f.subject.trim(), contactId: c?.id, companyId: c?.companyId, channel: f.channel, priority: tri.priority, topic: tri.topic, messages: [{ at: nowIso(), from: 'customer', text: f.text.trim() }] });
        toast(`Logged as ${tri.topic}, ${tri.priority} priority`, r.undo); onDone(r.ticket.id); onClose();
      }}>
        <div className="row2">
          <Field label="From" id="lr-c"><select id="lr-c" value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })}>{data.contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></Field>
          <Field label="Channel" id="lr-ch"><select id="lr-ch" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as Ticket['channel'] })}><option value="email">Email</option><option value="chat">Chat</option><option value="phone">Phone</option></select></Field>
        </div>
        <Field label="Subject" id="lr-s"><input id="lr-s" autoFocus value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="What they said" id="lr-t"><textarea id="lr-t" className="input" style={{ height: 110, padding: 12 }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        {(f.subject || f.text) && <div className="toolbar"><span className="sub">Sorted automatically:</span><span className="chip"><Icon name="sparkle" size={12} />{tri.topic}</span><span className={`pill ${PRIO_TONE[tri.priority]}`}>{tri.priority} priority</span>{tri.tone === 'upset' && <span className="pill warn">Upset</span>}</div>}
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.subject.trim() || !f.text.trim()}>Log request</button><button className="btn ghost" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Newsletters ----------------

export function Newsletters({ crm }: { crm: Crm }) {
  const toast = useToast();
  const ctx = useContextMenu();
  const { data } = crm;
  const t = todayIso();
  const clusters = useMemo(() => clusterCompanies(data, t), [data, t]);
  const [startCluster] = useState<string | undefined>(() => {
    try { const c = sessionStorage.getItem('meridian:newsletter-cluster'); sessionStorage.removeItem('meridian:newsletter-cluster'); return c ?? undefined; } catch { return undefined; }
  });
  const [editing, setEditing] = useState<Campaign | 'new' | null>(startCluster ? 'new' : null);
  const sent = data.campaigns.filter((c) => c.status === 'sent');
  const segLabel = (r: SegmentRule) => r.cluster ? clusters.find((c) => c.id === r.cluster)?.label ?? 'Segment' : r.health ? `${HEALTH_LABEL[r.health]} customers` : r.customersOnly ? 'All customers' : 'Everyone allowed';
  return (
    <div className="page">
      <Head eyebrow="Sales" title={data.campaigns.some((c) => c.status !== 'sent') ? `${plural(data.campaigns.filter((c) => c.status !== 'sent').length, 'newsletter')} waiting.` : 'No newsletter waiting.'} lede="Write once for a segment. The audience is checked for consent automatically, every email is personalised, and nothing goes out until a person approves it.">
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />New newsletter</button>
      </Head>
      <div className="card tight">
        {data.campaigns.length === 0 ? <Empty title="No newsletters yet" /> : (
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>Newsletter</th><th>Segment</th><th>Status</th><th className="num">Sent to</th><th /></tr></thead>
            <tbody>{data.campaigns.map((c) => {
              const items: MenuItem[] = [
                { label: c.status === 'sent' ? 'View' : 'Edit', icon: 'edit', onClick: () => setEditing(c) },
                { label: 'Duplicate', icon: 'plus', onClick: () => { const r = crm.saveCampaign({ name: `${c.name} (copy)`, segment: c.segment, subject: c.subject, body: c.body }); toast('Duplicated', r.undo); } },
                'divider',
                { label: 'Delete', icon: 'trash', danger: true, onClick: () => toast(`Deleted ${c.name}`, crm.deleteCampaign(c.id)) },
              ];
              return (
                <tr key={c.id} onClick={() => setEditing(c)} tabIndex={0} {...ctx(items, c.name)}>
                  <td><div className="ink">{c.name}</div><div className="sub">{c.subject}</div></td>
                  <td>{segLabel(c.segment)}</td>
                  <td>{c.status === 'sent' ? <span className="pill pos">Sent {fmtDay(c.sentAt!)}</span> : c.status === 'approved' ? <span className="pill accent">Approved</span> : <span className="pill">Draft</span>}</td>
                  <td className="num">{c.recipients ?? '—'}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={items} /></span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      {sent.length > 0 && <p className="sub" style={{ margin: 0 }}>{plural(sent.reduce((s, c) => s + (c.recipients ?? 0), 0), 'email')} sent so far. Each one is logged on the contact’s timeline.</p>}
      {editing && <CampaignEditor crm={crm} campaign={editing === 'new' ? undefined : editing} clusters={clusters} startCluster={startCluster} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CampaignEditor({ crm, campaign, clusters, startCluster, onClose }: { crm: Crm; campaign?: Campaign; clusters: Cluster[]; startCluster?: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = crm;
  const t = todayIso();
  const [seg, setSeg] = useState<string>(campaign ? (campaign.segment.cluster ?? (campaign.segment.health ? `h:${campaign.segment.health}` : campaign.segment.customersOnly ? 'customers' : 'all')) : startCluster ?? clusters.find((c) => c.label.startsWith('Quiet'))?.id ?? 'customers');
  const rule: SegmentRule = seg.startsWith('cl_') ? { cluster: seg } : seg.startsWith('h:') ? { health: seg.slice(2) as HealthBand } : seg === 'customers' ? { customersOnly: true } : {};
  const cl = clusters.find((c) => c.id === rule.cluster);
  const seed = campaign ?? { name: cl ? `${cl.label}: ${new Date().toLocaleDateString('en-GB', { month: 'long' })}` : 'Customer update', ...draftNewsletter(cl, 'Rihards') };
  const [f, setF] = useState({ name: seed.name, subject: seed.subject, body: seed.body });
  const aud = audience(data, rule, t);
  const errs = validateCampaign(f, aud.included.length);
  const locked = campaign?.status === 'sent';
  const sample = aud.included[0];
  const save = (approve = false) => crm.saveCampaign({ id: campaign?.id, name: f.name, segment: rule, subject: f.subject, body: f.body }, approve);
  return (
    <Panel title={campaign ? campaign.name : 'New newsletter'} eyebrow={locked ? `Sent ${fmtDay(campaign!.sentAt!)} to ${campaign!.recipients}` : campaign?.status === 'approved' ? `Approved by ${campaign.approvedBy}` : 'Draft'} onClose={onClose}>
      <div className="form">
        <Field label="Segment" id="nl-s" tip="Segments come from the automatic grouping on the Customers page, or from health.">
          <select id="nl-s" disabled={locked} value={seg} onChange={(e) => { setSeg(e.target.value); if (!campaign) { const c2 = clusters.find((c) => c.id === e.target.value); setF({ name: `${c2 ? c2.label : e.target.value === 'customers' ? 'Customer update' : e.target.value.startsWith('h:') ? `${HEALTH_LABEL[e.target.value.slice(2) as HealthBand]} customers` : 'Update'}: ${new Date().toLocaleDateString('en-GB', { month: 'long' })}`, ...draftNewsletter(c2, 'Rihards') }); } }}>
            <optgroup label="Found automatically">{clusters.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.companyIds.length})</option>)}</optgroup>
            <optgroup label="By health"><option value="h:at_risk">At-risk customers</option><option value="h:watch">Customers to watch</option><option value="h:healthy">Healthy customers</option></optgroup>
            <optgroup label="Everyone"><option value="customers">All customers</option><option value="all">Everyone allowed</option></optgroup>
          </select>
        </Field>
        <div className="card flat tight">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><b className="ink" style={{ fontSize: 22 }}>{aud.included.length}</b><span className="sub">may receive it</span>{aud.excluded.length > 0 && <span className="sub">· {aud.excluded.length} left out</span>}</div>
          {aud.excluded.length > 0 && <Disclose title="Who is left out and why"><div className="rows">{aud.excluded.map((x) => <div key={x.contact.id} className="row" style={{ cursor: 'default' }}><div className="grow"><div className="t">{x.contact.firstName} {x.contact.lastName}</div></div><span className="pill">{x.reason}</span></div>)}</div></Disclose>}
        </div>
        <Field label="Internal name" id="nl-n"><input id="nl-n" disabled={locked} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Subject" id="nl-sub" tip="Under 70 characters. {first_name} and {company} are filled in for each person."><input id="nl-sub" disabled={locked} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="Message" id="nl-b"><textarea id="nl-b" className="input" disabled={locked} style={{ height: 200, padding: 12 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        {sample && <Disclose title={`Preview for ${sample.firstName}`}><div className="bubble" style={{ maxWidth: '100%' }}><b>{personalise(f.subject, sample, data.companies.find((c) => c.id === sample.companyId)?.name)}</b>{'\n\n'}{personalise(f.body, sample, data.companies.find((c) => c.id === sample.companyId)?.name)}</div></Disclose>}
        {!locked && errs.length > 0 && <ul className="errors">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
        {!locked && (
          <div className="toolbar">
            {campaign?.status === 'approved'
              ? <button className="btn primary" onClick={() => { toast(`Sent to ${plural(aud.included.length, 'person', 'people')}`, crm.sendCampaign(campaign.id, aud.included.map((c) => c.id))); onClose(); }}><Icon name="mail" size={16} />Send to {aud.included.length}</button>
              : <button className="btn primary" disabled={errs.length > 0} onClick={() => { const r = save(true); toast('Approved. Send it when ready.', r.undo); onClose(); }} data-tip="A second step sends it, so nothing goes out by accident"><Icon name="check" size={16} />Approve</button>}
            <button className="btn" onClick={() => { const r = save(); toast('Draft saved', r.undo); onClose(); }}>Save draft</button>
            {!campaign && <button className="btn ghost" onClick={() => setF({ ...f, ...draftNewsletter(cl, 'Rihards') })}><Icon name="sparkle" size={14} />Redraft</button>}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------- Autopilot ----------------

const KIND: Record<Suggestion['kind'], { label: string; icon: string }> = {
  service: { label: 'Service', icon: 'mail' }, health: { label: 'Customer health', icon: 'heart' }, deal: { label: 'Deals', icon: 'deals' },
  consent: { label: 'Privacy', icon: 'doc' }, newsletter: { label: 'Newsletter', icon: 'mail' },
};

export function Autopilot({ crm, go }: { crm: Crm; go: (page: string, arg?: string) => void }) {
  const toast = useToast();
  const ctx = useContextMenu();
  const { data } = crm;
  const list = suggestions(data, nowIso());
  const accept = (s: Suggestion) => {
    if (s.task) toast(`Task added: ${s.task.title}`, crm.acceptTask(s.id, s.task));
    else if (s.open) {
      if (s.open.clusterId) { try { sessionStorage.setItem('meridian:newsletter-cluster', s.open.clusterId); } catch { /* ignore */ } }
      go(s.open.page, s.open.ticketId);
    }
  };
  return (
    <div className="page">
      <Head eyebrow="Sales" title={list.length ? `${plural(list.length, 'suggestion')} for you.` : 'Autopilot has nothing to suggest.'} lede="Autopilot reads deals, customers, support and consent dates, and proposes the next action with its reason. Accept turns it into a task or opens the draft. Nothing is sent on its own." />
      {list.length === 0 ? <div className="card"><Empty title="All caught up" text="New suggestions appear as things change." /></div> : (
        <div className="card tight"><div className="rows">
          {list.map((s) => {
            const items: MenuItem[] = [{ label: s.task ? 'Accept as task' : 'Open', icon: 'check', onClick: () => accept(s) }, { label: 'Dismiss', icon: 'close', onClick: () => toast('Dismissed', crm.dismiss(s.id)) }];
            return (
              <div key={s.id} className="row" style={{ cursor: 'default', flexWrap: 'wrap' }} tabIndex={0} {...ctx(items, s.title)}>
                <span className="avatar sm co" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name={KIND[s.kind].icon} size={14} /></span>
                <div className="grow" style={{ minWidth: 220 }}><div className="t">{s.title}</div><div className="sub">{KIND[s.kind].label} · {s.why}</div></div>
                <button className="btn sm ghost" onClick={() => toast('Dismissed', crm.dismiss(s.id))}>Dismiss</button>
                <button className="btn sm primary" onClick={() => accept(s)}>{s.task ? <><Icon name="check" size={14} />Add task</> : <>Open <Icon name="arrow" size={14} /></>}</button>
              </div>
            );
          })}
        </div></div>
      )}
      <InsightCards crm={crm} only={['health', 'service']} />
    </div>
  );
}

export { audience };
