import { tr } from '../platform/i18n';
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
      <Head eyebrow={tr("People")} title={missing ? tr("{0} missing.", { 0: plural(missing, 'signature') }) : tr("Every document is signed.")} lede={tr("Policies, contracts, certificates and forms in one place. A new version asks everyone to read and sign again.")}>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("Add document")}</button>
      </Head>
      <div className="grid">
        <Stat label={tr("Documents")} value={String(data.documents.length)} sub={tr("{0} company policies", { 0: data.documents.filter((d) => d.kind === 'policy').length })} span="s4" />
        <Stat label={tr("Missing signatures")} value={String(missing)} sub={tr("Current versions only")} span="s4" tip={tr("People who have not acknowledged the current version of a document that needs it.")} />
        <Stat label={tr("Expiring in 60 days")} value={String(expiring.length)} sub={expiring[0] ? tr("{0} first", { 0: expiring[0].title }) : tr("Nothing soon")} span="s4" />
      </div>
      <div className="toolbar"><Seg label={tr("Kind")} value={kind} onChange={setKind} options={[{ id: 'all', label: tr("All") }, ...Object.entries(DOC_KIND).map(([id, label]) => ({ id: id as DocKind, label: label === 'Policy' ? tr("Policies") : `${label}s` }))]} /></div>
      <div className="card tight">
        {docs.length === 0 ? <Empty title={tr("No documents of this kind")} /> : (
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>{tr("Document")}</th><th>{tr("For")}</th><th>{tr("Version")}</th><th style={{ width: 180 }}>{tr("Signed")}</th><th /></tr></thead>
            <tbody>{docs.map((d) => {
              const r = ackRate(data, d, t);
              return (
                <tr key={d.id} onClick={() => setOpen(d.id)}>
                  <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="doc" /><div><div className="ink">{d.title}</div><div className="sub">{DOC_KIND[d.kind]} {tr("· updated")} {fmtDay(d.updatedAt)}</div></div></div></td>
                  <td>{d.personId ? nameOf(data, d.personId) : <span className="muted">{tr("Everyone")}</span>}</td>
                  <td className="num">v{d.version}</td>
                  <td>{d.requiresAck ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, minWidth: 90 }}><Bar value={(r.done / Math.max(1, r.total)) * 100} tone={r.done === r.total ? 'pos' : ''} /></div><span className="num sub">{r.done}/{r.total}</span></div> : d.expires ? <span className={`pill ${d.expires < t ? 'neg' : d.expires <= addDays(t, 60) ? 'warn' : ''}`}>{d.expires < t ? tr("Expired") : tr("Expires {0}", { 0: fmtDay(d.expires) })}</span> : <span className="muted">{tr("No signature needed")}</span>}</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}><span className="reveal"><Menu items={[
                    { label: tr("Open"), icon: 'arrow', onClick: () => setOpen(d.id) },
                    { label: tr("Publish a new version"), icon: 'upload', onClick: () => toast(tr("{0} is now v{1}. Everyone signs again.", { 0: d.title, 1: d.version + 1 }), hr.newVersion(d.id)) },
                    'divider',
                    { label: tr("Delete"), icon: 'trash', danger: true, onClick: () => toast(tr("Deleted {0}", { 0: d.title }), hr.deleteDocument(d.id)) },
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
    <Panel title={d.title} eyebrow={tr("{0} · version {1} · {2}", { 0: DOC_KIND[d.kind], 1: d.version, 2: fmtDayYear(d.updatedAt) })} onClose={onClose}
      actions={<Menu items={[{ label: tr("Publish a new version"), icon: 'upload', onClick: () => toast(tr("{0} is now v{1}", { 0: d.title, 1: d.version + 1 }), hr.newVersion(d.id)) }, { label: tr("Remind who hasn’t signed"), icon: 'mail', onClick: () => toast(tr("Reminder sent to {0}", { 0: plural(r.total - r.done, 'person', 'people') })) }]} />}>
      {d.body && <div className="card flat"><p style={{ margin: 0 }}>{d.body}</p></div>}
      {d.requiresAck ? (
        <div>
          <div className="section-title">{tr("Signed")} {r.done} {tr("of")} {r.total}</div>
          <div className="rows">{people.map((p) => {
            const s = signed(p.id);
            return (
              <div key={p.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={p.name} size="sm" /><div className="grow"><div className="t"><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button></div><div className="sub">{s ? tr("Signed {0}", { 0: fmtDay(s.at) }) : tr("Not yet")}</div></div>
                {s ? <span className="pill pos"><Icon name="check" size={12} />{tr("Signed")}</span> : <button className="btn sm" onClick={() => toast(tr("{0} signed", { 0: p.name }), hr.acknowledge(d.id, p.id))}>{tr("Mark signed")}</button>}
              </div>
            );
          })}</div>
        </div>
      ) : <p className="sub" style={{ margin: 0 }}>{tr("This document doesn't need a signature.")}{d.expires ? tr(" It expires on {0}.", { 0: fmtDayYear(d.expires) }) : ''}</p>}
    </Panel>
  );
}

function DocForm({ hr, onClose }: { hr: People; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({ title: '', kind: 'policy' as DocKind, personId: '', requiresAck: true, expires: '', body: '' });
  return (
    <Panel title={tr("Add a document")} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return; toast(tr("Added {0}", { 0: f.title }), hr.addDocument({ title: f.title.trim(), kind: f.kind, personId: f.personId || undefined, requiresAck: f.requiresAck, expires: f.expires || undefined, body: f.body || undefined })); onClose(); }}>
        <Field label={tr("Title")} id="df-t"><input id="df-t" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row2">
          <Field label={tr("Kind")} id="df-k"><select id="df-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DocKind })}>{Object.entries(DOC_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label={tr("For")} id="df-p"><PersonSelect id="df-p" people={data.people} value={f.personId} onChange={(v) => setF({ ...f, personId: v })} none="Everyone" /></Field>
        </div>
        <div className="row2">
          <Field label={tr("Expires")} id="df-e"><input id="df-e" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 24 }}><input type="checkbox" checked={f.requiresAck} onChange={(e) => setF({ ...f, requiresAck: e.target.checked })} /> {tr("Needs a signature")}</label>
        </div>
        <Field label={tr("Summary")} id="df-b"><textarea id="df-b" className="input" style={{ height: 90, padding: 12 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.title.trim()}>{tr("Add document")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Goals ----------------

const STATUS = { on_track: [tr("On track"), 'pos'], at_risk: [tr("At risk"), 'warn'], off_track: [tr("Off track"), 'neg'], done: ['Done', 'accent'] } as const;

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
            <div className="sub">{g.level === 'company' ? tr("Company") : g.level === 'team' ? tr("Team · {0}", { 0: g.team ?? '' }) : nameOf(data, g.ownerId)}{kids.length ? tr(" · {0} under it", { 0: plural(kids.length, 'goal') }) : ''}{g.checkIns.length ? tr(" · checked in {0}", { 0: fmtDay(g.checkIns[g.checkIns.length - 1].at) }) : ''}</div>
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
      <Head eyebrow={tr("People")} title={risky ? tr("{0} need{1} attention.", { 0: plural(risky, 'goal'), 1: risky === 1 ? 's' : '' }) : tr("Every goal is on track.")} lede={<>{tr("Company goals break into team goals and then personal ones. A goal with goals under it takes their average.")} <span data-tip={tr("We compare progress with how far through the quarter we are: 10 points behind is at risk, 25 behind is off track.")} tabIndex={0} style={{ textDecoration: 'underline dotted' }}>{tr("How status works")}</span></>}>
        <button className="btn primary" onClick={() => setAdding({})}><Icon name="plus" size={16} />{tr("Add goal")}</button>
      </Head>
      <div className="toolbar">
        <Seg label={tr("Period")} value={period} onChange={setPeriod} options={periods.map((p) => ({ id: p, label: p.replace('-', ' ') }))} />
        <div className="spacer" />
        <span className="sub">{Math.round(share * 100)}{tr("% of the quarter gone")}</span>
      </div>
      <div className="card tight">
        {roots.length === 0 ? <Empty title={tr("No goals for this period")} action={<button className="btn primary" onClick={() => setAdding({})}>{tr("Add the first goal")}</button>} /> : <div className="rows">{roots.map((g) => <Row key={g.id} g={g} depth={0} />)}</div>}
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
    <Panel title={g.title} eyebrow={`${g.level === 'company' ? tr("Company goal") : g.level === 'team' ? `${g.team} team goal` : tr("Personal goal")} · ${g.period.replace('-', ' ')}`} onClose={onClose}
      actions={<Menu items={[{ label: tr("Add a goal under this"), icon: 'plus', onClick: () => onAddUnder(g.id) }, 'divider', { label: tr("Delete"), icon: 'trash', danger: true, onClick: () => { toast(tr("Deleted {0}", { 0: g.title }), hr.deleteGoal(g.id)); onClose(); } }]} />}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub">{tr("Progress")}</div><div className="big" style={{ fontSize: 48 }}>{prog}%</div></div>
        {g.ownerId && <div><div className="sub">{tr("Owner")}</div><div className="ink" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><Avatar name={nameOf(data, g.ownerId)} size="sm" /><button className="link" onClick={() => onPerson(g.ownerId!)}>{nameOf(data, g.ownerId)}</button></div></div>}
      </div>
      {parent && <p className="sub" style={{ margin: 0 }}>{tr("Supports:")} <b className="ink">{parent.title}</b></p>}
      {kids.length > 0 ? (
        <div><div className="section-title">{tr("Goals under it")}</div><div className="rows">{kids.map((k) => <div key={k.id} className="row" style={{ cursor: 'default' }}><div className="grow"><div className="t">{k.title}</div><div className="sub">{nameOf(data, k.ownerId)}</div></div><b className="num ink">{goalProgress(data, k.id)}%</b></div>)}</div></div>
      ) : (
        <div className="card flat tight">
          <div className="section-title">{tr("Check in")}</div>
          <form className="form" onSubmit={(e) => { e.preventDefault(); toast(tr("Checked in at {0}%", { 0: p }), hr.checkIn(g.id, p, note.trim())); setNote(''); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><input type="range" min={0} max={100} step={5} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label={tr("Progress")} style={{ flex: 1, accentColor: 'var(--accent)' }} /><b className="ink num" style={{ width: 44 }}>{p}%</b></div>
            <div className="inline-form"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("What moved, what's blocking")} aria-label={tr("Note")} /><button className="btn primary sm" type="submit">{tr("Save")}</button></div>
          </form>
        </div>
      )}
      {g.checkIns.length > 0 && <div><div className="section-title">{tr("Check-ins")}</div><ul className="tl">{[...g.checkIns].reverse().map((c, i) => <li key={i} className="stage_change"><div className="ink">{c.progress}% · {c.note || tr("No note")}</div><div className="when">{c.by} · {fmtDay(c.at)}</div></li>)}</ul></div>}
    </Panel>
  );
}

function GoalForm({ hr, period, parentId, onClose }: { hr: People; period: string; parentId?: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const parent = data.goals.find((g) => g.id === parentId);
  const [f, setF] = useState({ title: '', level: (parent ? (parent.level === 'company' ? 'team' : 'person') : 'company') as GoalLevel, ownerId: '', team: parent?.team ?? '', parentId: parentId ?? '' });
  return (
    <Panel title={tr("Add a goal")} eyebrow={period.replace('-', ' ')} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.title.trim()) return; toast(tr("Added {0}", { 0: f.title }), hr.addGoal({ title: f.title.trim(), level: f.level, ownerId: f.ownerId || undefined, team: f.team || undefined, parentId: f.parentId || undefined, period })); onClose(); }}>
        <Field label={tr("Goal")} id="gf-t" tip={tr("Say the outcome, with a number: 'Win €300K of new business', not 'Do more sales'.")}><input id="gf-t" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row2">
          <Field label={tr("Level")} id="gf-l"><select id="gf-l" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as GoalLevel })}><option value="company">{tr("Company")}</option><option value="team">{tr("Team")}</option><option value="person">{tr("Personal")}</option></select></Field>
          <Field label={tr("Owner")} id="gf-o"><PersonSelect id="gf-o" people={activePeople(data, todayIso())} value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} none="No owner" /></Field>
        </div>
        <div className="row2">
          {f.level === 'team' && <Field label={tr("Team")} id="gf-tm"><input id="gf-tm" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} /></Field>}
          <Field label={tr("Supports")} id="gf-p"><select id="gf-p" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}><option value="">{tr("Nothing above it")}</option>{data.goals.filter((g) => g.period === period && g.level !== 'person').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
        </div>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.title.trim()}>{tr("Add goal")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
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
      <Head eyebrow={tr("People")} title={tab === 'feedback' ? tr("{0} of feedback.", { 0: plural(data.feedback.length, 'piece') }) : rs.length ? tr("{0} of {1} reviews finished.", { 0: done, 1: rs.length }) : tr("No reviews in this cycle yet.")} lede={tr("Each person agrees weighted goals, scores themselves, then their manager scores each goal from 1 to 5. The weighted score sets the bonus.")}>
        {tab === 'feedback' ? <button className="btn primary" onClick={() => setGiving(true)}><Icon name="heart" size={16} />{tr("Give feedback")}</button>
          : missing.length > 0 ? <button className="btn primary" onClick={() => { const r = hr.startCycle(cycle); toast(tr("Started {0} for {1}", { 0: plural(r.added, 'review'), 1: cycle }), r.undo); }}><Icon name="plus" size={16} />{tr("Start reviews for")} {plural(missing.length, 'person', 'people')}</button> : null}
      </Head>
      <div className="toolbar">
        <Seg label={tr("Show")} value={tab} onChange={setTab} options={[{ id: 'reviews', label: tr("Reviews") }, { id: 'feedback', label: tr("Feedback") }]} />
        {tab === 'reviews' && cycles.length > 1 && <Seg label={tr("Cycle")} value={cycle} onChange={setCycle} options={cycles.map((c) => ({ id: c, label: c }))} small />}
      </div>
      {tab === 'reviews' ? (
        <>
          <div className="grid">
            <Stat label={tr("Finished")} value={`${done}/${rs.length}`} sub={tr("{0} waiting for a self-review", { 0: rs.filter((r) => !r.selfDone).length })} span="s4" />
            <Stat label={tr("Average score")} value={scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : '—'} sub={tr("Weighted by goal")} span="s4" />
            <div className="card s4">
              <div className="stat-label"><span data-tip={tr("How many finished reviews landed on each score. Use it to calibrate managers who score high or low.")} tabIndex={0}>{tr("Spread")}</span></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64, marginTop: 10 }}>
                {dist.map((n, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: (n / dmax) * 48 + 2, borderRadius: 6, background: n ? 'var(--accent)' : 'var(--surface-3)' }} /><div className="sub" style={{ marginTop: 4 }}>{i + 1}</div></div>)}
              </div>
            </div>
          </div>
          <div className="card tight">
            {rs.length === 0 ? <Empty title={tr("No reviews yet")} /> : (
              <div style={{ overflowX: 'auto' }}><table className="list click">
                <thead><tr><th>{tr("Person")}</th><th>{tr("Goals")}</th><th>{tr("Self")}</th><th>{tr("Manager")}</th><th className="num">{tr("Score")}</th><th className="num" data-tip={tr("Share of the bonus target the score earns.")}>{tr("Bonus")}</th></tr></thead>
                <tbody>{rs.map((r) => { const s = reviewScore(r); const p = data.people.find((x) => x.id === r.personId); return (
                  <tr key={r.id} onClick={() => setOpen(r.id)}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={p?.name ?? '?'} size="sm" /><div><div className="ink">{p?.name}</div><div className="sub">{p?.title}</div></div></div></td>
                    <td>{r.goals.length || <span className="pill warn">{tr("Set goals")}</span>}</td>
                    <td>{r.selfDone ? <span className="pill pos">{tr("Done")}</span> : <span className="pill">{tr("Waiting")}</span>}</td>
                    <td>{r.managerDone ? <span className="pill pos">{tr("Done")}</span> : <span className="pill">{tr("Waiting")}</span>}</td>
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
          {data.feedback.length === 0 ? <Empty title={tr("No feedback yet")} /> : (
            <div className="rows">{[...data.feedback].sort((a, b) => b.at.localeCompare(a.at)).map((f) => (
              <div key={f.id} className="row" onClick={() => onPerson(f.aboutId)}>
                <Avatar name={nameOf(data, f.aboutId)} size="sm" />
                <div className="grow"><div className="t">{f.text}</div><div className="sub">{tr("For")} {nameOf(data, f.aboutId)} {tr("· from")} {f.from} · {fmtDay(f.at)}</div></div>
                {f.private && <span className="pill" data-tip={tr("Only the person and their manager see it.")}>{tr("Private")}</span>}
                <span className={`pill ${f.kind === 'praise' ? 'accent' : 'warn'}`}>{f.kind === 'praise' ? tr("Praise") : tr("To grow")}</span>
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
    <Panel title={p.name} eyebrow={tr("Review · {0}", { 0: r.cycle })} lead={<Avatar name={p.name} size="lg" />} onClose={onClose}
      actions={r.goals.length > 0 && !draft ? <Menu items={[{ label: tr("Edit goals"), icon: 'edit', onClick: () => setDraft(r.goals.map((g) => ({ ...g }))) }]} /> : undefined}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub">{tr("Score")}</div><div className="big" style={{ fontSize: 48 }}>{s === null ? '—' : s.toFixed(1)}</div><div className="sub">{tr("of 5")}</div></div>
        <div><div className="sub" data-tip={tr("Below 3 pays no bonus. 3 pays half the target, 4 pays it in full, 5 pays 150%.")} tabIndex={0}>{tr("Bonus earned")}</div><div className="big" style={{ fontSize: 48, color: 'var(--accent)' }}>{Math.round(bonusMultiplier(s) * 100)}%</div><div className="sub">{tr("of target")}</div></div>
      </div>
      {draft ? (
        <div className="form">
          <div className="section-title">{tr("Goals for this cycle")}</div>
          {draft.map((g, i) => (
            <div key={i} className="inline-form">
              <input className="input" value={g.text} placeholder={tr("Goal {0}", { 0: i + 1 })} aria-label={tr("Goal {0}", { 0: i + 1 })} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input className="input" style={{ width: 80, flex: 'none' }} type="number" min={0} max={100} value={g.weight} aria-label={tr("Weight %")} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} /><span className="sub">%</span>
            </div>
          ))}
          {errs.length > 0 && <p className="sub" style={{ color: 'var(--warn)', margin: 0 }}>{errs[0]}</p>}
          <div className="toolbar">
            <button className="btn primary" disabled={errs.length > 0} onClick={() => { toast(tr("Goals saved"), hr.setReviewGoals(r.id, draft.filter((g) => g.text.trim()))); setDraft(null); }}>{tr("Save goals")}</button>
            <button className="btn ghost" onClick={() => setDraft([...draft, { text: '', weight: 0 }])}><Icon name="plus" size={14} />{tr("Add goal")}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="section-title">{tr("Goals, scored by the manager")}</div>
          <div className="rows">{r.goals.map((g, i) => (
            <div key={i} className="row" style={{ cursor: 'default', flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 180 }}><div className="t">{g.text}</div><div className="sub">{tr("Weight")} {g.weight}%</div></div>
              <Score label={tr("Score for {0}", { 0: g.text })} value={g.score} onChange={(n) => toast(tr("Scored {0}", { 0: n }), hr.scoreReviewGoal(r.id, i, n))} />
            </div>
          ))}</div>
        </div>
      )}
      {!draft && (
        <div className="toolbar">
          {!r.selfDone && <button className="btn" onClick={() => toast(tr("Self-review marked done"), hr.finishSelf(r.id))}>{tr("Mark self-review done")}</button>}
          {!r.managerDone && <button className="btn primary" disabled={s === null} data-tip={s === null ? tr("Score every goal first") : undefined} onClick={() => toast(tr("{0}'s review is finished", { 0: p.name }), hr.finishManager(r.id))}><Icon name="check" size={16} />{tr("Finish review")}</button>}
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
    <Panel title={tr("Give feedback")} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.text.trim()) return; toast(tr("Feedback saved for {0}", { 0: nameOf(data, f.aboutId) }), hr.giveFeedback({ ...f, text: f.text.trim() })); onClose(); }}>
        <div className="row2">
          <Field label={tr("For")} id="ff-p"><PersonSelect id="ff-p" people={activePeople(data, todayIso())} value={f.aboutId} onChange={(v) => setF({ ...f, aboutId: v })} /></Field>
          <Field label={tr("Kind")} id="ff-k"><select id="ff-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'praise' | 'growth', private: e.target.value === 'growth' })}><option value="praise">{tr("Praise")}</option><option value="growth">{tr("Something to grow")}</option></select></Field>
        </div>
        <Field label={tr("What happened and why it mattered")} id="ff-t" tip={tr("Name the moment and its effect. 'The Birch brand book landed and the client asked for you' beats 'Great job'.")}><textarea id="ff-t" className="input" style={{ height: 110, padding: 12 }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.private} onChange={(e) => setF({ ...f, private: e.target.checked })} /> {tr("Private: only they and their manager see it")}</label>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.text.trim()}>{tr("Save feedback")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
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
      <Head eyebrow={tr("People")} title={tr("{0} in bonuses for {1}.", { 0: money(pool.total), 1: cycle })} lede={tr("Each bonus is a year's salary × the person's target × what their review score earns. Set a budget and every amount scales down by the same share.")} />
      <div className="toolbar">
        {cycles.length > 1 && <Seg label={tr("Cycle")} value={cycle} onChange={setCycle} options={cycles.map((c) => ({ id: c, label: c }))} />}
        <input className="input" style={{ maxWidth: 240 }} type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={tr("Budget cap in € (optional)")} aria-label={tr("Budget cap in euro")} />
      </div>
      <div className="grid">
        <Stat label={tr("Total to pay")} value={money(pool.total)} sub={pool.scale < 1 ? tr("Scaled to {0}% to fit the budget", { 0: Math.round(pool.scale * 100) }) : tr("No scaling")} span="s4" />
        <Stat label={tr("At 100% for everyone")} value={money(target)} sub={tr("The sum of all targets")} span="s4" tip={tr("What the pool would cost if every finished review scored exactly 4.")} />
        <Stat label={tr("Waiting for a score")} value={String(pool.waiting)} sub={tr("Pay nothing until the review is finished")} span="s4" />
      </div>
      <div className="card tight">
        {pool.lines.length === 0 ? <Empty title={tr("No reviews in this cycle")} /> : (
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>{tr("Person")}</th><th className="num">{tr("Score")}</th><th className="num">{tr("Earns")}</th><th className="num">{tr("Target")}</th><th className="num">{tr("Bonus")}</th></tr></thead>
            <tbody>{pool.lines.map((l) => (
              <tr key={l.person.id} onClick={() => onPerson(l.person.id)}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={l.person.name} size="sm" /><div><div className="ink">{l.person.name}</div><div className="sub">{Math.round((l.person.bonusTarget ?? 0) * 100)}{tr("% target")}</div></div></div></td>
                <td className="num">{l.score === null ? <span className="pill">{tr("Waiting")}</span> : l.score.toFixed(1)}</td>
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

const LEVEL = ['—', 'Learning', tr("Can do"), 'Expert', 'Teaches'];

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
      <Head eyebrow={tr("People")} title={tab === 'matrix' ? tr("{0} against what roles need.", { 0: plural(gaps, 'skill gap') }) : exp.length ? tr("{0} to renew soon.", { 0: plural(exp.length, 'course') }) : tr("All training is current.")} lede={tab === 'matrix' ? tr("Click a cell to change a level. A ring marks what the role needs; amber means below it.") : undefined}>
        {tab === 'training' && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("Log training")}</button>}
      </Head>
      <div className="toolbar">
        <Seg label={tr("Show")} value={tab} onChange={setTab} options={[{ id: 'matrix', label: tr("Skills matrix") }, { id: 'training', label: tr("Training") }]} />
        {tab === 'matrix' && <Seg small label={tr("Area")} value={area} onChange={setArea} options={[{ id: 'all', label: tr("All") }, ...areas.map((a) => ({ id: a, label: a }))]} />}
      </div>
      {tab === 'matrix' ? (
        <div className="card tight"><div style={{ overflowX: 'auto' }}>
          <table className="list matrix">
            <thead><tr><th>{tr("Person")}</th>{skills.map((s) => <th key={s.id} className="num" style={{ minWidth: 92 }}>{s.name}</th>)}</tr></thead>
            <tbody>{people.map((p) => (
              <tr key={p.id}>
                <td><button className="link ink" onClick={() => onPerson(p.id)}>{p.name}</button><div className="sub">{p.title}</div></td>
                {skills.map((s) => {
                  const have = lvl(p.id, s.id), n = need(p.title, s.id);
                  return (
                    <td key={s.id} className="num">
                      <button className={`lvl l${have} ${n ? 'need' : ''} ${have < n ? 'gap' : ''}`} data-tip={tr("{0}{1}. Click to change.", { 0: LEVEL[have] === '—' ? 'None' : LEVEL[have], 1: n ? ` · role needs ${LEVEL[n]}` : '' })}
                        onClick={() => toast(`${p.name}: ${s.name} ${LEVEL[(have + 1) % 5] === '—' ? 'cleared' : `→ ${LEVEL[(have + 1) % 5]}`}`, hr.setSkillLevel(p.id, s.id, (have + 1) % 5))}>{have || ''}</button>
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div><p className="sub" style={{ margin: '10px 4px 0' }}>{tr("1 Learning · 2 Can do · 3 Expert · 4 Teaches others")}</p></div>
      ) : (
        <div className="card tight">
          <div style={{ overflowX: 'auto' }}><table className="list click">
            <thead><tr><th>{tr("Course")}</th><th>{tr("Person")}</th><th>{tr("Done")}</th><th>{tr("Valid until")}</th></tr></thead>
            <tbody>{[...data.training].sort((a, b) => (a.expires ?? '9').localeCompare(b.expires ?? '9')).map((x) => (
              <tr key={x.id} onClick={() => onPerson(x.personId)}>
                <td className="ink">{x.course}</td><td>{nameOf(data, x.personId)}</td><td className="muted">{fmtDayYear(x.done)}</td>
                <td>{x.expires ? <span className={`pill ${x.expires < t ? 'neg' : x.expires <= addDays(t, 60) ? 'warn' : ''}`}>{x.expires < t ? tr("Expired {0}", { 0: fmtDay(x.expires) }) : fmtDayYear(x.expires)}</span> : <span className="muted">{tr("No expiry")}</span>}</td>
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
    <Panel title={tr("Log training")} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.course.trim()) return; toast(tr("Logged {0}", { 0: f.course }), hr.addTraining({ ...f, course: f.course.trim(), expires: f.expires || undefined })); onClose(); }}>
        <div className="row2"><Field label={tr("Person")} id="tf-p"><PersonSelect id="tf-p" people={activePeople(data, t)} value={f.personId} onChange={(v) => setF({ ...f, personId: v })} /></Field><Field label={tr("Course")} id="tf-c"><input id="tf-c" autoFocus value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} /></Field></div>
        <div className="row2"><Field label={tr("Completed")} id="tf-d"><input id="tf-d" type="date" value={f.done} onChange={(e) => setF({ ...f, done: e.target.value })} /></Field><Field label={tr("Valid until (optional)")} id="tf-e" tip={tr("Certificates like first aid or fire safety must be renewed. We remind you 60 days before.")}><input id="tf-e" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field></div>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.course.trim()}>{tr("Log training")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
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
      <Head eyebrow={tr("People")} title={outside.length ? tr("{0} paid outside the middle of their band.", { 0: plural(outside.length, 'person', 'people') }) : tr("Everyone sits near the middle of their band.")} lede={tr("Bands are what a role pays, from entry to fully grown. The EU pay transparency directive asks for them, and for a reason when two people in one role are paid differently.")} />
      <div className="grid">
        <Stat label={tr("Monthly payroll")} value={money(payroll)} sub={tr("Gross, {0}", { 0: plural(people.length, 'person', 'people') })} span="s4" />
        <Stat label={tr("Year, with bonus targets")} value={money(people.reduce((s, p) => s + (p.salary ?? 0) * 12 * (1 + (p.bonusTarget ?? 0)), 0))} sub={tr("Before employer taxes")} span="s4" />
        <Stat label={tr("Outside 0.90–1.10")} value={String(outside.length)} sub={tr("Compa-ratio")} tip={tr("Salary against the middle of the band. Below 0.90 risks losing someone; above 1.10 needs a reason.")} span="s4" />
      </div>
      <div className="card">
        <div className="card-head"><h2>{tr("Where each person sits in their band")}</h2></div>
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
      <Head eyebrow={tr("People")} title={val === null ? tr("Not enough answers yet.") : tr("eNPS is {0}{1} in {2}.", { 0: val > 0 ? '+' : '', 1: val, 2: last.period.replace('-', ' ') })} lede={tr("One anonymous question each quarter: how likely are you to recommend working here, 0 to 10? Results stay hidden until 5 people answer.")} />
      <div className="grid">
        <div className="card s7">
          <div className="card-head"><h2>{tr("Over time")}</h2></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 160 }}>
            {sorted.map((p) => { const v = enps(p.scores); return (
              <div key={p.id} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <b className="ink num">{v === null ? '—' : v > 0 ? `+${v}` : v}</b>
                <div style={{ height: v === null ? 4 : Math.max(4, ((v + 100) / 200) * 110), borderRadius: 10, background: v === null ? 'var(--surface-3)' : 'var(--accent)', margin: '6px 0' }} />
                <div className="sub">{p.period.replace('-', ' ')} · {p.scores.length}</div>
              </div>
            ); })}
          </div>
          {last && last.comments.length > 0 && <div style={{ marginTop: 18 }}><div className="section-title">{tr("What people said in")} {last.period.replace('-', ' ')}</div><ul className="tl">{last.comments.map((c, i) => <li key={i}><div className="ink">“{c}”</div></li>)}</ul></div>}
        </div>
        <div className="card s5">
          <div className="card-head"><h2>{tr("Answer for")} {q.replace('-', ' ')}</h2></div>
          <p className="sub" style={{ marginTop: 0 }}>{tr("Anonymous.")} {now ? tr("{0} so far.", { 0: plural(now.scores.length, 'answer') }) : tr("Be the first.")}</p>
          <div className="nps" role="group" aria-label={tr("Score from 0 to 10")}>{Array.from({ length: 11 }, (_, i) => <button key={i} aria-pressed={score === i} onClick={() => setScore(i)}>{i}</button>)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="sub"><span>{tr("Not likely")}</span><span>{tr("Very likely")}</span></div>
          <textarea className="input" style={{ height: 80, padding: 12, marginTop: 12 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr("One thing that would make work better (optional)")} aria-label={tr("Comment")} />
          <button className="btn primary" style={{ marginTop: 12 }} disabled={score === null} onClick={() => { toast(tr("Thanks, your answer is in"), hr.answerPulse(q, score!, comment.trim())); setScore(null); setComment(''); }}>{tr("Send anonymously")}</button>
        </div>
      </div>
    </div>
  );
}
