import { useState } from 'react';
import {
  DocKind, Goal, GoalLevel, ReviewGoal, activePeople, ackRate, addDays, bonusMultiplier, bonusPool, childGoals, compaRatio, enps,
  expiringSoon, goalProgress, periodShare, reviewScore, skillGaps, suggestStatus, validateGoals,
} from './domain';
import { People } from './usePeople';
import { PersonSelect, Score, currentCycle, currentQuarter, money, nameOf } from './shared';
import { Avatar, Bar, Empty, Field, Head, Icon, Menu, Panel, Seg, Stat, fmtDay, fmtDayYear, plural, todayIso, useToast } from '../platform/ui';

type OpenPerson = (id: string) => void;

// ---------------- Documents ----------------

const DOC_KIND: Record<DocKind, string> = { policy: 'Policy', contract: 'Contract', certificate: 'Certificate', form: 'Form' };

export function Documents({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [kind, setKind] = useState<'all' | DocKind>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const docs = data.documents.filter((d) => kind === 'all' || d.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const missing = data.documents.filter((d) => d.requiresAck).reduce((s, d) => { const r = ackRate(data, d, t); return s + r.total - r.done; }, 0);
  const expiring = data.documents.filter((d) => d.expires && d.expires <= addDays(t, 60));
  return (
    <div className="page">
      <Head eyebrow="People" title={missing ? `${plural(missing, 'signature')} missing.` : 'Every document is signed.'} lede="Policies, contracts, certificates and forms in one place. A new version asks everyone to read and sign again.">
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add document</button>
      </Head>
      <div className="grid">
        <Stat label="Documents" value={String(data.documents.length)} sub={`${data.documents.filter((d) => d.kind === 'policy').length} company policies`} span="s4" />
        <Stat label="Missing signatures" value={String(missing)} sub="Current versions only" span="s4" tip="People who have not acknowledged the current version of a document that needs it." />
        <Stat label="Expiring in 60 days" value={String(expiring.length)} sub={expiring[0] ? `${expiring[0].title} first` : 'Nothing soon'} span="s4" />
      </div>
      <div className="toolbar"><Seg label="Kind" value={kind} onChange={setKind} options={[{ id: 'all', label: 'All' }, ...Object.entries(DOC_KIND).map(([id, label]) => ({ id: id as DocKind, label: label === 'Policy' ? 'Policies' : `${label}s` }))]} /></div>
      <div className="card tight">
        {docs.length === 0 ? <Empty title="No documents of this kind" /> : (
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>Document</th><th>For</th><th>Version</th><th style={{ width: 180 }}>Signed</th><th /></tr></thead>
            <tbody>{docs.map((d) => {
              const r = ackRate(data, d, t);
              return (
                <tr key={d.id} onClick={() => setOpen(d.id)}>
                  <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="doc" /><div><div className="ink">{d.title}</div><div className="sub">{DOC_KIND[d.kind]} · updated {fmtDay(d.updatedAt)}</div></div></div></td>
                  <td>{d.personId ? nameOf(data, d.personId) : <span className="muted">Everyone</span>}</td>
                  <td className="num">v{d.version}</td>
                  <td>{d.requiresAck ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, minWidth: 90 }}><Bar value={(r.done / Math.max(1, r.total)) * 100} tone={r.done === r.total ? 'pos' : ''} /></div><span className="num sub">{r.done}/{r.total}</span></div> : d.expires ? <span className={`pill ${d.expires < t ? 'neg' : d.expires <= addDays(t, 60) ? 'warn' : ''}`}>{d.expires < t ? 'Expired' : `Expires ${fmtDay(d.expires)}`}</span> : <span className="muted">No signature needed</span>}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={[
                    { label: 'Open', icon: 'arrow', onClick: () => setOpen(d.id) },
                    { label: 'Publish a new version', icon: 'upload', onClick: () => toast(`${d.title} is now v${d.version + 1}. Everyone signs again.`, hr.newVersion(d.id)) },
                    'divider',
                    { label: 'Delete', icon: 'trash', danger: true, onClick: () => toast(`Deleted ${d.title}`, hr.deleteDocument(d.id)) },
                  ]} /></span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      {open && <DocPanel hr={hr} id={open} onClose={() => setOpen(null)} onPerson={onPerson} />}
      {adding && <DocForm hr={hr} onClose={() => setAdding(false)} />}
    </div>
  );
}

function DocPanel({ hr, id, onClose, onPerson }: { hr: People; id: string; onClose: () => void; onPerson: OpenPerson }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const d = data.documents.find((x) => x.id === id);
  if (!d) return null;
  const people = d.personId ? data.people.filter((p) => p.id === d.personId) : activePeople(data, t);
  const signed = (pid: string) => d.acks.find((a) => a.personId === pid && a.version === d.version);
  const r = ackRate(data, d, t);
  return (
    <Panel title={d.title} eyebrow={`${DOC_KIND[d.kind]} · version ${d.version} · ${fmtDayYear(d.updatedAt)}`} onClose={onClose}
      actions={<Menu items={[{ label: 'Publish a new version', icon: 'upload', onClick: () => toast(`${d.title} is now v${d.version + 1}`, hr.newVersion(d.id)) }, { label: 'Remind who hasn’t signed', icon: 'mail', onClick: () => toast(`Reminder sent to ${plural(r.total - r.done, 'person', 'people')}`) }]} />}>
      {d.body && <div className="card flat"><p style={{ margin: 0 }}>{d.body}</p></div>}
      {d.requiresAck ? (
        <div>
          <div className="section-title">Signed {r.done} of {r.total}</div>
          <div className="rows">{people.map((p) => {
            const s = signed(p.id);
            return (
              <div key={p.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={p.name} size="sm" /><div className="grow"><div className="t"><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button></div><div className="sub">{s ? `Signed ${fmtDay(s.at)}` : 'Not yet'}</div></div>
                {s ? <span className="pill pos"><Icon name="check" size={12} />Signed</span> : <button className="btn sm" onClick={() => toast(`${p.name} signed`, hr.acknowledge(d.id, p.id))}>Mark signed</button>}
              </div>
            );
          })}</div>
        </div>
      ) : <p className="sub" style={{ margin: 0 }}>This document doesn't need a signature.{d.expires ? ` It expires on ${fmtDayYear(d.expires)}.` : ''}</p>}
    </Panel>
  );
}

function DocForm({ hr, onClose }: { hr: People; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({ title: '', kind: 'policy' as DocKind, personId: '', requiresAck: true, expires: '', body: '' });
  return (
    <Panel title="Add a document" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return; toast(`Added ${f.title}`, hr.addDocument({ title: f.title.trim(), kind: f.kind, personId: f.personId || undefined, requiresAck: f.requiresAck, expires: f.expires || undefined, body: f.body || undefined })); onClose(); }}>
        <Field label="Title" id="df-t"><input id="df-t" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row2">
          <Field label="Kind" id="df-k"><select id="df-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DocKind })}>{Object.entries(DOC_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="For" id="df-p"><PersonSelect id="df-p" people={data.people} value={f.personId} onChange={(v) => setF({ ...f, personId: v })} none="Everyone" /></Field>
        </div>
        <div className="row2">
          <Field label="Expires" id="df-e"><input id="df-e" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 24 }}><input type="checkbox" checked={f.requiresAck} onChange={(e) => setF({ ...f, requiresAck: e.target.checked })} /> Needs a signature</label>
        </div>
        <Field label="Summary" id="df-b"><textarea id="df-b" className="input" style={{ height: 90, padding: 12 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.title.trim()}>Add document</button><button className="btn ghost" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Goals ----------------

const STATUS = { on_track: ['On track', 'pos'], at_risk: ['At risk', 'warn'], off_track: ['Off track', 'neg'], done: ['Done', 'accent'] } as const;

export function Goals({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const { data } = hr;
  const t = todayIso();
  const q = currentQuarter(t);
  const periods = [...new Set([q, ...data.goals.map((g) => g.period)])].sort().reverse();
  const [period, setPeriod] = useState(q);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ parentId?: string } | null>(null);
  const goals = data.goals.filter((g) => g.period === period);
  const share = periodShare(period, t);
  const status = (g: Goal) => (childGoals(data, g.id).length ? suggestStatus(goalProgress(data, g.id), share) : g.status);
  const risky = goals.filter((g) => ['at_risk', 'off_track'].includes(status(g))).length;
  const roots = goals.filter((g) => !g.parentId || !goals.some((x) => x.id === g.parentId));

  const Row = ({ g, depth }: { g: Goal; depth: number }) => {
    const p = goalProgress(data, g.id);
    const s = status(g);
    const kids = childGoals(data, g.id).filter((k) => k.period === period);
    return (
      <>
        <div className="row goal-row" onClick={() => setOpen(g.id)} style={{ ['--d' as string]: depth }}>
          {g.ownerId ? <Avatar name={nameOf(data, g.ownerId)} size="sm" /> : <span className="avatar sm co"><Icon name="target" size={14} /></span>}
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="t">{g.title}</div>
            <div className="sub">{g.level === 'company' ? 'Company' : g.level === 'team' ? `Team · ${g.team ?? ''}` : nameOf(data, g.ownerId)}{kids.length ? ` · ${plural(kids.length, 'goal')} under it` : ''}{g.checkIns.length ? ` · checked in ${fmtDay(g.checkIns[g.checkIns.length - 1].at)}` : ''}</div>
          </div>
          <div style={{ width: 140 }} className="hide-phone"><Bar value={p} tone={s === 'off_track' ? 'neg' : s === 'at_risk' ? 'warn' : ''} /></div>
          <b className="ink num" style={{ width: 44, textAlign: 'right' }}>{p}%</b>
          <span style={{ width: 84, textAlign: 'right' }}><span className={`pill ${STATUS[s][1]}`}>{STATUS[s][0]}</span></span>
        </div>
        {kids.map((k) => <Row key={k.id} g={k} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="page">
      <Head eyebrow="People" title={risky ? `${plural(risky, 'goal')} need${risky === 1 ? 's' : ''} attention.` : 'Every goal is on track.'} lede={<>Company goals break into team goals and then personal ones. A goal with goals under it takes their average. <span data-tip="We compare progress with how far through the quarter we are: 10 points behind is at risk, 25 behind is off track." tabIndex={0} style={{ textDecoration: 'underline dotted' }}>How status works</span></>}>
        <button className="btn primary" onClick={() => setAdding({})}><Icon name="plus" size={16} />Add goal</button>
      </Head>
      <div className="toolbar">
        <Seg label="Period" value={period} onChange={setPeriod} options={periods.map((p) => ({ id: p, label: p.replace('-', ' ') }))} />
        <div className="spacer" />
        <span className="sub">{Math.round(share * 100)}% of the quarter gone</span>
      </div>
      <div className="card tight">
        {roots.length === 0 ? <Empty title="No goals for this period" action={<button className="btn primary" onClick={() => setAdding({})}>Add the first goal</button>} /> : <div className="rows">{roots.map((g) => <Row key={g.id} g={g} depth={0} />)}</div>}
      </div>
      {open && <GoalPanel hr={hr} id={open} onClose={() => setOpen(null)} onAddUnder={(id) => setAdding({ parentId: id })} onPerson={onPerson} />}
      {adding && <GoalForm hr={hr} period={period} parentId={adding.parentId} onClose={() => setAdding(null)} />}
    </div>
  );
}

function GoalPanel({ hr, id, onClose, onAddUnder, onPerson }: { hr: People; id: string; onClose: () => void; onAddUnder: (id: string) => void; onPerson: OpenPerson }) {
  const toast = useToast();
  const { data } = hr;
  const g = data.goals.find((x) => x.id === id);
  const [p, setP] = useState(g?.progress ?? 0);
  const [note, setNote] = useState('');
  if (!g) return null;
  const kids = childGoals(data, g.id);
  const parent = data.goals.find((x) => x.id === g.parentId);
  const prog = goalProgress(data, g.id);
  return (
    <Panel title={g.title} eyebrow={`${g.level === 'company' ? 'Company goal' : g.level === 'team' ? `${g.team} team goal` : 'Personal goal'} · ${g.period.replace('-', ' ')}`} onClose={onClose}
      actions={<Menu items={[{ label: 'Add a goal under this', icon: 'plus', onClick: () => onAddUnder(g.id) }, 'divider', { label: 'Delete', icon: 'trash', danger: true, onClick: () => { toast(`Deleted ${g.title}`, hr.deleteGoal(g.id)); onClose(); } }]} />}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub">Progress</div><div className="big" style={{ fontSize: 48 }}>{prog}%</div></div>
        {g.ownerId && <div><div className="sub">Owner</div><div className="ink" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><Avatar name={nameOf(data, g.ownerId)} size="sm" /><button className="link" onClick={() => onPerson(g.ownerId!)}>{nameOf(data, g.ownerId)}</button></div></div>}
      </div>
      {parent && <p className="sub" style={{ margin: 0 }}>Supports: <b className="ink">{parent.title}</b></p>}
      {kids.length > 0 ? (
        <div><div className="section-title">Goals under it</div><div className="rows">{kids.map((k) => <div key={k.id} className="row" style={{ cursor: 'default' }}><div className="grow"><div className="t">{k.title}</div><div className="sub">{nameOf(data, k.ownerId)}</div></div><b className="num ink">{goalProgress(data, k.id)}%</b></div>)}</div></div>
      ) : (
        <div className="card flat tight">
          <div className="section-title">Check in</div>
          <form className="form" onSubmit={(e) => { e.preventDefault(); toast(`Checked in at ${p}%`, hr.checkIn(g.id, p, note.trim())); setNote(''); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><input type="range" min={0} max={100} step={5} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Progress" style={{ flex: 1, accentColor: 'var(--accent)' }} /><b className="ink num" style={{ width: 44 }}>{p}%</b></div>
            <div className="inline-form"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What moved, what's blocking" aria-label="Note" /><button className="btn primary sm" type="submit">Save</button></div>
          </form>
        </div>
      )}
      {g.checkIns.length > 0 && <div><div className="section-title">Check-ins</div><ul className="tl">{[...g.checkIns].reverse().map((c, i) => <li key={i} className="stage_change"><div className="ink">{c.progress}% · {c.note || 'No note'}</div><div className="when">{c.by} · {fmtDay(c.at)}</div></li>)}</ul></div>}
    </Panel>
  );
}

function GoalForm({ hr, period, parentId, onClose }: { hr: People; period: string; parentId?: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const parent = data.goals.find((g) => g.id === parentId);
  const [f, setF] = useState({ title: '', level: (parent ? (parent.level === 'company' ? 'team' : 'person') : 'company') as GoalLevel, ownerId: '', team: parent?.team ?? '', parentId: parentId ?? '' });
  return (
    <Panel title="Add a goal" eyebrow={period.replace('-', ' ')} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return; toast(`Added ${f.title}`, hr.addGoal({ title: f.title.trim(), level: f.level, ownerId: f.ownerId || undefined, team: f.team || undefined, parentId: f.parentId || undefined, period })); onClose(); }}>
        <Field label="Goal" id="gf-t" tip="Say the outcome, with a number: 'Win €300K of new business', not 'Do more sales'."><input id="gf-t" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row2">
          <Field label="Level" id="gf-l"><select id="gf-l" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as GoalLevel })}><option value="company">Company</option><option value="team">Team</option><option value="person">Personal</option></select></Field>
          <Field label="Owner" id="gf-o"><PersonSelect id="gf-o" people={activePeople(data, todayIso())} value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} none="No owner" /></Field>
        </div>
        <div className="row2">
          {f.level === 'team' && <Field label="Team" id="gf-tm"><input id="gf-tm" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} /></Field>}
          <Field label="Supports" id="gf-p"><select id="gf-p" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}><option value="">Nothing above it</option>{data.goals.filter((g) => g.period === period && g.level !== 'person').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
        </div>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.title.trim()}>Add goal</button><button className="btn ghost" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Reviews and feedback ----------------

export function Reviews({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const cycles = [...new Set([currentCycle(t), ...data.reviews.map((r) => r.cycle)])];
  const [cycle, setCycle] = useState(cycles[0]);
  const [tab, setTab] = useState<'reviews' | 'feedback'>('reviews');
  const [open, setOpen] = useState<string | null>(null);
  const [giving, setGiving] = useState(false);
  const rs = data.reviews.filter((r) => r.cycle === cycle);
  const done = rs.filter((r) => r.managerDone).length;
  const scores = rs.map(reviewScore).filter((x): x is number => x !== null);
  const dist = [1, 2, 3, 4, 5].map((n) => rs.filter((r) => r.managerDone && Math.round(reviewScore(r) ?? 0) === n).length);
  const dmax = Math.max(1, ...dist);
  const people = activePeople(data, t).filter((p) => !p.lastDay);
  const missing = people.filter((p) => !rs.some((r) => r.personId === p.id));
  return (
    <div className="page">
      <Head eyebrow="People" title={tab === 'feedback' ? `${plural(data.feedback.length, 'piece')} of feedback.` : rs.length ? `${done} of ${rs.length} reviews finished.` : 'No reviews in this cycle yet.'} lede="Each person agrees weighted goals, scores themselves, then their manager scores each goal from 1 to 5. The weighted score sets the bonus.">
        {tab === 'feedback' ? <button className="btn primary" onClick={() => setGiving(true)}><Icon name="heart" size={16} />Give feedback</button>
          : missing.length > 0 ? <button className="btn primary" onClick={() => { const r = hr.startCycle(cycle); toast(`Started ${plural(r.added, 'review')} for ${cycle}`, r.undo); }}><Icon name="plus" size={16} />Start reviews for {plural(missing.length, 'person', 'people')}</button> : null}
      </Head>
      <div className="toolbar">
        <Seg label="Show" value={tab} onChange={setTab} options={[{ id: 'reviews', label: 'Reviews' }, { id: 'feedback', label: 'Feedback' }]} />
        {tab === 'reviews' && cycles.length > 1 && <Seg label="Cycle" value={cycle} onChange={setCycle} options={cycles.map((c) => ({ id: c, label: c }))} small />}
      </div>
      {tab === 'reviews' ? (
        <>
          <div className="grid">
            <Stat label="Finished" value={`${done}/${rs.length}`} sub={`${rs.filter((r) => !r.selfDone).length} waiting for a self-review`} span="s4" />
            <Stat label="Average score" value={scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : '—'} sub="Weighted by goal" span="s4" />
            <div className="card s4">
              <div className="stat-label"><span data-tip="How many finished reviews landed on each score. Use it to calibrate managers who score high or low." tabIndex={0}>Spread</span></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64, marginTop: 10 }}>
                {dist.map((n, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: (n / dmax) * 48 + 2, borderRadius: 6, background: n ? 'var(--accent)' : 'var(--surface-3)' }} /><div className="sub" style={{ marginTop: 4 }}>{i + 1}</div></div>)}
              </div>
            </div>
          </div>
          <div className="card tight">
            {rs.length === 0 ? <Empty title="No reviews yet" /> : (
              <div style={{ overflowX: 'auto' }}><table className="list click">
                <thead><tr><th>Person</th><th>Goals</th><th>Self</th><th>Manager</th><th className="num">Score</th><th className="num" data-tip="Share of the bonus target the score earns.">Bonus</th></tr></thead>
                <tbody>{rs.map((r) => { const s = reviewScore(r); const p = data.people.find((x) => x.id === r.personId); return (
                  <tr key={r.id} onClick={() => setOpen(r.id)}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={p?.name ?? '?'} size="sm" /><div><div className="ink">{p?.name}</div><div className="sub">{p?.title}</div></div></div></td>
                    <td>{r.goals.length || <span className="pill warn">Set goals</span>}</td>
                    <td>{r.selfDone ? <span className="pill pos">Done</span> : <span className="pill">Waiting</span>}</td>
                    <td>{r.managerDone ? <span className="pill pos">Done</span> : <span className="pill">Waiting</span>}</td>
                    <td className="num"><b className="ink">{r.managerDone && s !== null ? s.toFixed(1) : '—'}</b></td>
                    <td className="num">{r.managerDone ? `${Math.round(bonusMultiplier(s) * 100)}%` : '—'}</td>
                  </tr>
                ); })}</tbody>
              </table></div>
            )}
          </div>
        </>
      ) : (
        <div className="card tight">
          {data.feedback.length === 0 ? <Empty title="No feedback yet" /> : (
            <div className="rows">{[...data.feedback].sort((a, b) => b.at.localeCompare(a.at)).map((f) => (
              <div key={f.id} className="row" onClick={() => onPerson(f.aboutId)}>
                <Avatar name={nameOf(data, f.aboutId)} size="sm" />
                <div className="grow"><div className="t">{f.text}</div><div className="sub">For {nameOf(data, f.aboutId)} · from {f.from} · {fmtDay(f.at)}</div></div>
                {f.private && <span className="pill" data-tip="Only the person and their manager see it.">Private</span>}
                <span className={`pill ${f.kind === 'praise' ? 'accent' : 'warn'}`}>{f.kind === 'praise' ? 'Praise' : 'To grow'}</span>
              </div>
            ))}</div>
          )}
        </div>
      )}
      {open && <ReviewPanel hr={hr} id={open} onClose={() => setOpen(null)} />}
      {giving && <FeedbackForm hr={hr} onClose={() => setGiving(false)} />}
    </div>
  );
}

function ReviewPanel({ hr, id, onClose }: { hr: People; id: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const r = data.reviews.find((x) => x.id === id);
  const [draft, setDraft] = useState<ReviewGoal[] | null>(r && r.goals.length === 0 ? [{ text: '', weight: 50 }, { text: '', weight: 50 }] : null);
  if (!r) return null;
  const p = data.people.find((x) => x.id === r.personId)!;
  const s = reviewScore(r);
  const errs = draft ? validateGoals(draft.filter((g) => g.text.trim())) : [];
  return (
    <Panel title={p.name} eyebrow={`Review · ${r.cycle}`} lead={<Avatar name={p.name} size="lg" />} onClose={onClose}
      actions={r.goals.length > 0 && !draft ? <Menu items={[{ label: 'Edit goals', icon: 'edit', onClick: () => setDraft(r.goals.map((g) => ({ ...g }))) }]} /> : undefined}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub">Score</div><div className="big" style={{ fontSize: 48 }}>{s === null ? '—' : s.toFixed(1)}</div><div className="sub">of 5</div></div>
        <div><div className="sub" data-tip="Below 3 pays no bonus. 3 pays half the target, 4 pays it in full, 5 pays 150%." tabIndex={0}>Bonus earned</div><div className="big" style={{ fontSize: 48, color: 'var(--accent)' }}>{Math.round(bonusMultiplier(s) * 100)}%</div><div className="sub">of target</div></div>
      </div>
      {draft ? (
        <div className="form">
          <div className="section-title">Goals for this cycle</div>
          {draft.map((g, i) => (
            <div key={i} className="inline-form">
              <input className="input" value={g.text} placeholder={`Goal ${i + 1}`} aria-label={`Goal ${i + 1}`} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input className="input" style={{ width: 80, flex: 'none' }} type="number" min={0} max={100} value={g.weight} aria-label="Weight %" onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} /><span className="sub">%</span>
            </div>
          ))}
          {errs.length > 0 && <p className="sub" style={{ color: 'var(--warn)', margin: 0 }}>{errs[0]}</p>}
          <div className="toolbar">
            <button className="btn primary" disabled={errs.length > 0} onClick={() => { toast('Goals saved', hr.setReviewGoals(r.id, draft.filter((g) => g.text.trim()))); setDraft(null); }}>Save goals</button>
            <button className="btn ghost" onClick={() => setDraft([...draft, { text: '', weight: 0 }])}><Icon name="plus" size={14} />Add goal</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="section-title">Goals, scored by the manager</div>
          <div className="rows">{r.goals.map((g, i) => (
            <div key={i} className="row" style={{ cursor: 'default', flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 180 }}><div className="t">{g.text}</div><div className="sub">Weight {g.weight}%</div></div>
              <Score label={`Score for ${g.text}`} value={g.score} onChange={(n) => toast(`Scored ${n}`, hr.scoreReviewGoal(r.id, i, n))} />
            </div>
          ))}</div>
        </div>
      )}
      {!draft && (
        <div className="toolbar">
          {!r.selfDone && <button className="btn" onClick={() => toast('Self-review marked done', hr.finishSelf(r.id))}>Mark self-review done</button>}
          {!r.managerDone && <button className="btn primary" disabled={s === null} data-tip={s === null ? 'Score every goal first' : undefined} onClick={() => toast(`${p.name}'s review is finished`, hr.finishManager(r.id))}><Icon name="check" size={16} />Finish review</button>}
        </div>
      )}
    </Panel>
  );
}

function FeedbackForm({ hr, onClose }: { hr: People; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({ aboutId: activePeople(data, todayIso())[0]?.id ?? '', kind: 'praise' as 'praise' | 'growth', text: '', private: false });
  return (
    <Panel title="Give feedback" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.text.trim()) return; toast(`Feedback saved for ${nameOf(data, f.aboutId)}`, hr.giveFeedback({ ...f, text: f.text.trim() })); onClose(); }}>
        <div className="row2">
          <Field label="For" id="ff-p"><PersonSelect id="ff-p" people={activePeople(data, todayIso())} value={f.aboutId} onChange={(v) => setF({ ...f, aboutId: v })} /></Field>
          <Field label="Kind" id="ff-k"><select id="ff-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'praise' | 'growth', private: e.target.value === 'growth' })}><option value="praise">Praise</option><option value="growth">Something to grow</option></select></Field>
        </div>
        <Field label="What happened and why it mattered" id="ff-t" tip="Name the moment and its effect. 'The Birch brand book landed and the client asked for you' beats 'Great job'."><textarea id="ff-t" className="input" style={{ height: 110, padding: 12 }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.private} onChange={(e) => setF({ ...f, private: e.target.checked })} /> Private: only they and their manager see it</label>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.text.trim()}>Save feedback</button><button className="btn ghost" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Bonuses ----------------

export function Bonuses({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const { data } = hr;
  const cycles = [...new Set(data.reviews.map((r) => r.cycle))];
  const [cycle, setCycle] = useState(cycles[0] ?? currentCycle(todayIso()));
  const [budget, setBudget] = useState('');
  const pool = bonusPool(data, cycle, budget ? Number(budget) : undefined);
  const target = pool.lines.reduce((s, l) => s + l.target, 0);
  return (
    <div className="page">
      <Head eyebrow="People" title={`${money(pool.total)} in bonuses for ${cycle}.`} lede="Each bonus is a year's salary × the person's target × what their review score earns. Set a budget and every amount scales down by the same share." />
      <div className="toolbar">
        {cycles.length > 1 && <Seg label="Cycle" value={cycle} onChange={setCycle} options={cycles.map((c) => ({ id: c, label: c }))} />}
        <input className="input" style={{ maxWidth: 240 }} type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget cap in € (optional)" aria-label="Budget cap in euro" />
      </div>
      <div className="grid">
        <Stat label="Total to pay" value={money(pool.total)} sub={pool.scale < 1 ? `Scaled to ${Math.round(pool.scale * 100)}% to fit the budget` : 'No scaling'} span="s4" />
        <Stat label="At 100% for everyone" value={money(target)} sub="The sum of all targets" span="s4" tip="What the pool would cost if every finished review scored exactly 4." />
        <Stat label="Waiting for a score" value={String(pool.waiting)} sub="Pay nothing until the review is finished" span="s4" />
      </div>
      <div className="card tight">
        {pool.lines.length === 0 ? <Empty title="No reviews in this cycle" /> : (
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>Person</th><th className="num">Score</th><th className="num">Earns</th><th className="num">Target</th><th className="num">Bonus</th></tr></thead>
            <tbody>{pool.lines.map((l) => (
              <tr key={l.person.id} onClick={() => onPerson(l.person.id)}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={l.person.name} size="sm" /><div><div className="ink">{l.person.name}</div><div className="sub">{Math.round((l.person.bonusTarget ?? 0) * 100)}% target</div></div></div></td>
                <td className="num">{l.score === null ? <span className="pill">Waiting</span> : l.score.toFixed(1)}</td>
                <td className="num">{l.score === null ? '—' : `${Math.round(l.multiplier * 100)}%`}</td>
                <td className="num muted">{money(l.target)}</td>
                <td className="num"><b className="ink">{money(l.amount)}</b></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ---------------- Skills and training ----------------

const LEVEL = ['—', 'Learning', 'Can do', 'Expert', 'Teaches'];

export function Skills({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [tab, setTab] = useState<'matrix' | 'training'>('matrix');
  const [area, setArea] = useState('all');
  const [adding, setAdding] = useState(false);
  const areas = [...new Set(data.skills.map((s) => s.area))];
  const skills = data.skills.filter((s) => area === 'all' || s.area === area);
  const people = activePeople(data, t).filter((p) => data.skillLevels.some((l) => l.personId === p.id) || data.roleSkills.some((r) => r.title === p.title));
  const gaps = people.reduce((s, p) => s + skillGaps(data, p.id).length, 0);
  const exp = expiringSoon(data, t, 60).filter((e) => data.training.some((x) => x.course === e.title));
  const lvl = (pid: string, sid: string) => data.skillLevels.find((l) => l.personId === pid && l.skillId === sid)?.level ?? 0;
  const need = (title: string, sid: string) => data.roleSkills.find((r) => r.title === title && r.skillId === sid)?.level ?? 0;
  return (
    <div className="page">
      <Head eyebrow="People" title={tab === 'matrix' ? `${plural(gaps, 'skill gap')} against what roles need.` : exp.length ? `${plural(exp.length, 'course')} to renew soon.` : 'All training is current.'} lede={tab === 'matrix' ? 'Click a cell to change a level. A ring marks what the role needs; amber means below it.' : undefined}>
        {tab === 'training' && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Log training</button>}
      </Head>
      <div className="toolbar">
        <Seg label="Show" value={tab} onChange={setTab} options={[{ id: 'matrix', label: 'Skills matrix' }, { id: 'training', label: 'Training' }]} />
        {tab === 'matrix' && <Seg small label="Area" value={area} onChange={setArea} options={[{ id: 'all', label: 'All' }, ...areas.map((a) => ({ id: a, label: a }))]} />}
      </div>
      {tab === 'matrix' ? (
        <div className="card tight"><div style={{ overflowX: 'auto' }}>
          <table className="list matrix">
            <thead><tr><th>Person</th>{skills.map((s) => <th key={s.id} className="num" style={{ minWidth: 92 }}>{s.name}</th>)}</tr></thead>
            <tbody>{people.map((p) => (
              <tr key={p.id}>
                <td><button className="link ink" onClick={() => onPerson(p.id)}>{p.name}</button><div className="sub">{p.title}</div></td>
                {skills.map((s) => {
                  const have = lvl(p.id, s.id), n = need(p.title, s.id);
                  return (
                    <td key={s.id} className="num">
                      <button className={`lvl l${have} ${n ? 'need' : ''} ${have < n ? 'gap' : ''}`} data-tip={`${LEVEL[have] === '—' ? 'None' : LEVEL[have]}${n ? ` · role needs ${LEVEL[n]}` : ''}. Click to change.`}
                        onClick={() => toast(`${p.name}: ${s.name} ${LEVEL[(have + 1) % 5] === '—' ? 'cleared' : `→ ${LEVEL[(have + 1) % 5]}`}`, hr.setSkillLevel(p.id, s.id, (have + 1) % 5))}>{have || ''}</button>
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div><p className="sub" style={{ margin: '10px 4px 0' }}>1 Learning · 2 Can do · 3 Expert · 4 Teaches others</p></div>
      ) : (
        <div className="card tight">
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>Course</th><th>Person</th><th>Done</th><th>Valid until</th></tr></thead>
            <tbody>{[...data.training].sort((a, b) => (a.expires ?? '9').localeCompare(b.expires ?? '9')).map((x) => (
              <tr key={x.id} onClick={() => onPerson(x.personId)}>
                <td className="ink">{x.course}</td><td>{nameOf(data, x.personId)}</td><td className="muted">{fmtDayYear(x.done)}</td>
                <td>{x.expires ? <span className={`pill ${x.expires < t ? 'neg' : x.expires <= addDays(t, 60) ? 'warn' : ''}`}>{x.expires < t ? `Expired ${fmtDay(x.expires)}` : fmtDayYear(x.expires)}</span> : <span className="muted">No expiry</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      {adding && <TrainingForm hr={hr} onClose={() => setAdding(false)} />}
    </div>
  );
}

function TrainingForm({ hr, onClose }: { hr: People; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [f, setF] = useState({ personId: activePeople(data, t)[0]?.id ?? '', course: '', done: t, expires: '' });
  return (
    <Panel title="Log training" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.course.trim()) return; toast(`Logged ${f.course}`, hr.addTraining({ ...f, course: f.course.trim(), expires: f.expires || undefined })); onClose(); }}>
        <div className="row2"><Field label="Person" id="tf-p"><PersonSelect id="tf-p" people={activePeople(data, t)} value={f.personId} onChange={(v) => setF({ ...f, personId: v })} /></Field><Field label="Course" id="tf-c"><input id="tf-c" autoFocus value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} /></Field></div>
        <div className="row2"><Field label="Completed" id="tf-d"><input id="tf-d" type="date" value={f.done} onChange={(e) => setF({ ...f, done: e.target.value })} /></Field><Field label="Valid until (optional)" id="tf-e" tip="Certificates like first aid or fire safety must be renewed. We remind you 60 days before."><input id="tf-e" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field></div>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.course.trim()}>Log training</button><button className="btn ghost" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Pay ----------------

export function Pay({ hr, onPerson }: { hr: People; onPerson: OpenPerson }) {
  const { data } = hr;
  const t = todayIso();
  const people = activePeople(data, t).filter((p) => p.salary);
  const payroll = people.reduce((s, p) => s + (p.salary ?? 0), 0);
  const outside = people.filter((p) => { const c = compaRatio(data, p); return c !== null && (c < 0.9 || c > 1.1); });
  const lo = Math.min(...data.bands.map((b) => b.min)) * 0.85, hi = Math.max(...data.bands.map((b) => b.max)) * 1.05;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="page">
      <Head eyebrow="People" title={outside.length ? `${plural(outside.length, 'person', 'people')} paid outside the middle of their band.` : 'Everyone sits near the middle of their band.'} lede="Bands are what a role pays, from entry to fully grown. The EU pay transparency directive asks for them, and for a reason when two people in one role are paid differently." />
      <div className="grid">
        <Stat label="Monthly payroll" value={money(payroll)} sub={`Gross, ${plural(people.length, 'person', 'people')}`} span="s4" />
        <Stat label="Year, with bonus targets" value={money(people.reduce((s, p) => s + (p.salary ?? 0) * 12 * (1 + (p.bonusTarget ?? 0)), 0))} sub="Before employer taxes" span="s4" />
        <Stat label="Outside 0.90–1.10" value={String(outside.length)} sub="Compa-ratio" tip="Salary against the middle of the band. Below 0.90 risks losing someone; above 1.10 needs a reason." span="s4" />
      </div>
      <div className="card">
        <div className="card-head"><h2>Where each person sits in their band</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.bands.map((b) => {
            const ps = people.filter((p) => p.title === b.title);
            return (
              <div key={b.title} className="band-row">
                <div className="band-label"><div className="ink">{b.title}</div><div className="sub num">{money(b.min)}–{money(b.max)}</div></div>
                <div className="band-track">
                  <span className="band" style={{ left: x(b.min), width: `calc(${x(b.max)} - ${x(b.min)})` }} />
                  <span className="band-mid" style={{ left: x((b.min + b.max) / 2) }} />
                  {ps.map((p) => <button key={p.id} className="band-dot" style={{ left: x(p.salary!) }} data-tip={`${p.name} · ${money(p.salary!)} · ${compaRatio(data, p)?.toFixed(2)}`} aria-label={`${p.name}, ${money(p.salary!)}`} onClick={() => onPerson(p.id)}><Avatar name={p.name} size="sm" /></button>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Pulse ----------------

export function Pulse({ hr }: { hr: People }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const q = currentQuarter(t);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const sorted = [...data.pulses].sort((a, b) => a.period.localeCompare(b.period));
  const now = data.pulses.find((p) => p.period === q);
  const last = sorted[sorted.length - 1];
  const val = last ? enps(last.scores) : null;
  return (
    <div className="page">
      <Head eyebrow="People" title={val === null ? 'Not enough answers yet.' : `eNPS is ${val > 0 ? '+' : ''}${val} in ${last.period.replace('-', ' ')}.`} lede="One anonymous question each quarter: how likely are you to recommend working here, 0 to 10? Results stay hidden until 5 people answer." />
      <div className="grid">
        <div className="card s7">
          <div className="card-head"><h2>Over time</h2></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 160 }}>
            {sorted.map((p) => { const v = enps(p.scores); return (
              <div key={p.id} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <b className="ink num">{v === null ? '—' : v > 0 ? `+${v}` : v}</b>
                <div style={{ height: v === null ? 4 : Math.max(4, ((v + 100) / 200) * 110), borderRadius: 10, background: v === null ? 'var(--surface-3)' : 'var(--accent)', margin: '6px 0' }} />
                <div className="sub">{p.period.replace('-', ' ')} · {p.scores.length}</div>
              </div>
            ); })}
          </div>
          {last && last.comments.length > 0 && <div style={{ marginTop: 18 }}><div className="section-title">What people said in {last.period.replace('-', ' ')}</div><ul className="tl">{last.comments.map((c, i) => <li key={i}><div className="ink">“{c}”</div></li>)}</ul></div>}
        </div>
        <div className="card s5">
          <div className="card-head"><h2>Answer for {q.replace('-', ' ')}</h2></div>
          <p className="sub" style={{ marginTop: 0 }}>Anonymous. {now ? `${plural(now.scores.length, 'answer')} so far.` : 'Be the first.'}</p>
          <div className="nps" role="group" aria-label="Score from 0 to 10">{Array.from({ length: 11 }, (_, i) => <button key={i} aria-pressed={score === i} onClick={() => setScore(i)}>{i}</button>)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="sub"><span>Not likely</span><span>Very likely</span></div>
          <textarea className="input" style={{ height: 80, padding: 12, marginTop: 12 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="One thing that would make work better (optional)" aria-label="Comment" />
          <button className="btn primary" style={{ marginTop: 12 }} disabled={score === null} onClick={() => { toast('Thanks, your answer is in', hr.answerPulse(q, score!, comment.trim())); setScore(null); setComment(''); }}>Send anonymously</button>
        </div>
      </div>
    </div>
  );
}
