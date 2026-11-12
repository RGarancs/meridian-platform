import { useMemo, useState } from 'react';
import {
  CANDIDATE_LABEL, CANDIDATE_STAGES, CandidateStage, LeaveKind, LeaveRequest, PeopleData, Person, ReviewGoal,
  addDays, averageScore, bonusMultiplier, candidatesToDelete, directReports, leaveBalance, lvFixedHolidays, moveCandidate,
  onboardingProgress, reviewScore, startOnboarding, teamClashes, tenureMonths, validateGoals, validateLeave, whoIsAway, workingDays,
} from './domain';
import { loadJson, saveJson } from '../platform/jsonStore';
import { seedPeople } from './seed';

const today = () => new Date().toISOString().slice(0, 10);
const KIND: Record<LeaveKind, string> = { vacation: 'Vacation', sick: 'Sick', unpaid: 'Unpaid', parental: 'Parental', study: 'Study' };
const OWNER = { hr: 'HR', manager: 'Manager', it: 'IT', newcomer: 'Newcomer' } as const;
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const range = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} to ${fmtDay(b)}`);
let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export function usePeople(user: string) {
  const [data, setData] = useState<PeopleData>(() => loadJson('people', seedPeople));
  return useMemo(() => {
    const commit = (next: PeopleData) => { saveJson('people', next); setData(next); };
    return {
      data, user,
      requestLeave(r: Omit<LeaveRequest, 'id' | 'status'>) { commit({ ...data, leave: [...data.leave, { ...r, id: nid('lv'), status: 'pending' }] }); },
      decideLeave(id: string, status: 'approved' | 'declined') { commit({ ...data, leave: data.leave.map((r) => (r.id === id ? { ...r, status, decidedBy: user } : r)) }); },
      toggleTask(onbId: string, taskId: string) {
        commit({ ...data, onboarding: data.onboarding.map((o) => (o.id === onbId ? { ...o, tasks: o.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) } : o)) });
      },
      moveCandidate(id: string, to: CandidateStage, reason?: string) {
        commit({ ...data, candidates: data.candidates.map((c) => (c.id === id ? moveCandidate(c, to, reason) : c)) });
      },
      scoreCandidate(id: string, score: number) { commit({ ...data, candidates: data.candidates.map((c) => (c.id === id ? { ...c, scores: [...c.scores, score] } : c)) }); },
      deleteCandidates(ids: string[]) { commit({ ...data, candidates: data.candidates.filter((c) => !ids.includes(c.id)) }); },
      hire(candidateId: string) {
        const c = data.candidates.find((x) => x.id === candidateId)!;
        const op = data.openings.find((o) => o.id === c.openingId)!;
        const start = addDays(today(), 30);
        const person: Person = { id: nid('p'), name: c.name, email: c.email ?? '', title: op.title, team: op.team, managerId: op.hiringManagerId, startDate: start, location: 'Riga', leaveAllowance: 20 };
        commit({
          ...data,
          people: [...data.people, person],
          candidates: data.candidates.map((x) => (x.id === candidateId ? { ...x, stage: 'hired' } : x)),
          openings: data.openings.map((o) => (o.id === op.id ? { ...o, open: false } : o)),
          onboarding: [...data.onboarding, startOnboarding(person.id, start, nid('ob'))],
        });
      },
      scoreGoal(reviewId: string, i: number, score: number) {
        commit({ ...data, reviews: data.reviews.map((r) => (r.id === reviewId ? { ...r, goals: r.goals.map((g, j) => (j === i ? { ...g, score } : g)) } : r)) });
      },
      setGoals(reviewId: string, goals: ReviewGoal[]) { commit({ ...data, reviews: data.reviews.map((r) => (r.id === reviewId ? { ...r, goals } : r)) }); },
      finishManager(reviewId: string) { commit({ ...data, reviews: data.reviews.map((r) => (r.id === reviewId ? { ...r, managerDone: true } : r)) }); },
    };
  }, [data, user]);
}
export type People = ReturnType<typeof usePeople>;
const nameOf = (d: PeopleData, id?: string) => d.people.find((p) => p.id === id)?.name ?? '—';

// ---------------- Overview ----------------

export function PeopleToday({ hr, go }: { hr: People; go: (page: string) => void }) {
  const { data } = hr;
  const t = today();
  const away = whoIsAway(data, t);
  const pending = data.leave.filter((r) => r.status === 'pending');
  const onb = data.onboarding.map((o) => ({ o, p: onboardingProgress(o, t) })).filter((x) => x.p.done < x.p.total);
  const reviewsOpen = data.reviews.filter((r) => !r.managerDone).length;
  const purge = candidatesToDelete(data, t);
  const asks = pending.length + onb.reduce((s, x) => s + x.p.overdue, 0) + (purge.length ? 1 : 0);
  return (
    <div className="page">
      <h1 className="headline">{asks === 0 ? 'Nothing needs you in People today.' : `${asks} thing${asks > 1 ? 's' : ''} need${asks > 1 ? '' : 's'} you in People today.`}</h1>
      <div className="grid">
        <Stat label="People" value={String(data.people.filter((p) => p.startDate <= t).length)} sub={`${data.people.filter((p) => p.startDate > t).length} starting soon`} />
        <Stat label="Away today" value={String(away.length)} sub={away.map((a) => a.person.name.split(' ')[0]).join(', ') || 'Everyone in'} />
        <Stat label="Open roles" value={String(data.openings.filter((o) => o.open).length)} sub={`${data.candidates.filter((c) => !['hired', 'rejected'].includes(c.stage)).length} candidates in process`} />
        <Stat label="Reviews to finish" value={String(reviewsOpen)} sub={data.reviews[0]?.cycle ?? ''} />
      </div>
      <div className="grid">
        <div className="card span-8">
          <h2>Needs you</h2>
          <div className="table-wrap"><table className="list"><tbody>
            {pending.map((r) => (
              <tr key={r.id} className="row" onClick={() => go('leave')}>
                <td>{nameOf(data, r.personId)}<div className="sub">{KIND[r.kind]}, {range(r.from, r.to)}</div></td>
                <td><span className="pill accent">Leave to approve</span></td>
                <td className="num">{workingDays(r.from, r.to, lvFixedHolidays(Number(r.from.slice(0, 4))))} days</td>
              </tr>
            ))}
            {onb.filter((x) => x.p.overdue).map(({ o, p }) => (
              <tr key={o.id} className="row" onClick={() => go('onboarding')}>
                <td>{nameOf(data, o.personId)}<div className="sub">Starts {fmtDay(o.startDate)}. Next: {p.nextTask?.text}</div></td>
                <td><span className="pill neg">{p.overdue} onboarding task{p.overdue > 1 ? 's' : ''} overdue</span></td><td />
              </tr>
            ))}
            {purge.length > 0 && (
              <tr className="row" onClick={() => go('hiring')}>
                <td>{purge.length} candidate record{purge.length > 1 ? 's' : ''} past the keep-until date<div className="sub">Delete to stay within your privacy notice</div></td>
                <td><span className="pill neg">Privacy</span></td><td />
              </tr>
            )}
          </tbody></table></div>
          {asks === 0 && <div className="empty">All clear.</div>}
        </div>
        <div className="card span-4">
          <h2>Away in the next two weeks</h2>
          {data.leave.filter((r) => r.status === 'approved' && r.to >= t && r.from <= addDays(t, 14)).map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--ink)' }}>{nameOf(data, r.personId)}</span><span className="sub">{KIND[r.kind]} · {range(r.from, r.to)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card span-3"><div className="stat-label">{label}</div><div className="stat">{value}</div><div className="stat-sub">{sub}</div></div>;
}

// ---------------- Directory ----------------

export function Directory({ hr }: { hr: People }) {
  const { data } = hr;
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const t = today();
  const teams = [...new Set(data.people.map((p) => p.team))].sort();
  const rows = data.people.filter((p) => (!team || p.team === team) && `${p.name} ${p.title}`.toLowerCase().includes(q.toLowerCase()));
  const person = data.people.find((p) => p.id === open);
  return (
    <div className="page">
      <div className="toolbar">
        <input className="btn" style={{ textAlign: 'left', width: 240 }} placeholder="Find a person or role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person" id="dir-q" />
        <select className="btn" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team" id="dir-team"><option value="">All teams</option>{teams.map((x) => <option key={x}>{x}</option>)}</select>
        <div className="spacer" /><span className="sub">{rows.length} people</span>
      </div>
      <div className="card"><div className="table-wrap"><table className="list">
        <thead><tr><th>Name</th><th>Role</th><th>Team</th><th>Manager</th><th>Location</th><th className="num">Vacation left</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id} className="row" onClick={() => setOpen(p.id)}>
            <td>{p.name}{p.startDate > t && <> <span className="pill accent">Starts {fmtDay(p.startDate)}</span></>}<div className="sub">{p.email}</div></td>
            <td>{p.title}</td><td>{p.team}</td><td>{nameOf(data, p.managerId)}</td><td>{p.location}</td>
            <td className="num">{leaveBalance(data, p.id, Number(t.slice(0, 4)), t).left} days</td>
          </tr>
        ))}</tbody>
      </table></div></div>
      {person && <PersonPanel hr={hr} person={person} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PersonPanel({ hr, person, onClose }: { hr: People; person: Person; onClose: () => void }) {
  const { data } = hr;
  const t = today();
  const b = leaveBalance(data, person.id, Number(t.slice(0, 4)), t);
  const review = data.reviews.find((r) => r.personId === person.id);
  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label={person.name}>
        <div className="panel-head"><div><div className="sub">{person.title} · {person.team}</div><h2 style={{ fontSize: 20 }}>{person.name}</h2></div><button className="btn ghost small" onClick={onClose}>Close</button></div>
        <div className="panel-body">
          <dl className="facts">
            <dt>Email</dt><dd>{person.email}</dd>
            <dt>Manager</dt><dd>{nameOf(data, person.managerId)}</dd>
            <dt>Reports</dt><dd>{directReports(data, person.id).map((p) => p.name).join(', ') || '—'}</dd>
            <dt>Started</dt><dd>{person.startDate}{person.startDate <= t ? ` (${tenureMonths(person, t)} months)` : ' (not yet)'}</dd>
            <dt>Location</dt><dd>{person.location}</dd>
          </dl>
          <div>
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Vacation this year</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[['Allowance', b.allowance], ['Taken', b.taken], ['Booked', b.booked + b.pending], ['Left', b.left]].map(([l, v]) => (
                <div key={l as string} className="card" style={{ padding: 10 }}><div className="stat-label">{l}</div><div style={{ font: '24px var(--font-serif)', color: 'var(--ink)' }}>{v}</div></div>
              ))}
            </div>
          </div>
          {review && <div><h3 style={{ fontSize: 13, marginBottom: 6 }}>Review {review.cycle}</h3><div>{reviewScore(review) ?? 'Not scored yet'}{reviewScore(review) !== null && <span className="sub"> of 5 · bonus {Math.round(bonusMultiplier(reviewScore(review)) * 100)}% of target</span>}</div></div>}
        </div>
      </aside>
    </>
  );
}

// ---------------- Leave ----------------

export function Leave({ hr }: { hr: People }) {
  const { data } = hr;
  const t = today();
  const [f, setF] = useState({ personId: data.people[2]?.id ?? '', kind: 'vacation' as LeaveKind, from: addDays(t, 7), to: addDays(t, 8), note: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState('');
  const pending = data.leave.filter((r) => r.status === 'pending');
  const days = workingDays(f.from, f.to, lvFixedHolidays(Number(f.from.slice(0, 4))));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = { personId: f.personId, kind: f.kind, from: f.from, to: f.to, note: f.note || undefined };
    const errs = validateLeave(data, r, t);
    setErrors(errs);
    if (errs.length) return;
    hr.requestLeave(r);
    setDone(`Sent to ${nameOf(data, data.people.find((p) => p.id === f.personId)?.managerId)} for approval.`);
  };
  return (
    <div className="page">
      <div className="grid">
        <div className="card span-6">
          <h2>Leave waiting for a decision</h2>
          {pending.length === 0 ? <div className="empty">Nothing waiting.</div> : pending.map((r) => {
            const clashes = teamClashes(data, r);
            return (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{nameOf(data, r.personId)}</b><span className="sub">{KIND[r.kind]} · {range(r.from, r.to)} · {workingDays(r.from, r.to, lvFixedHolidays(Number(r.from.slice(0, 4))))} days</span></div>
                {r.note && <div className="sub">“{r.note}”</div>}
                {r.kind === 'vacation' && <div className="sub">{leaveBalance(data, r.personId, Number(r.from.slice(0, 4)), t).left} days left this year, including this request</div>}
                {clashes.length > 0 && <div><span className="pill neg">Also away: {clashes.map((p) => p.name).join(', ')}</span></div>}
                <div className="toolbar"><button className="btn small primary" onClick={() => hr.decideLeave(r.id, 'approved')}>Approve</button><button className="btn small" onClick={() => hr.decideLeave(r.id, 'declined')}>Decline</button></div>
              </div>
            );
          })}
        </div>
        <form className="card span-6 form" onSubmit={submit}>
          <h2>Request leave</h2>
          {errors.length > 0 && <ul className="errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
          {done && !errors.length && <div className="pill pos" style={{ alignSelf: 'flex-start' }}>{done}</div>}
          <div className="row2">
            <div className="field"><label htmlFor="lv-p">Who</label><select id="lv-p" value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })}>{data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="lv-k">Kind</label><select id="lv-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LeaveKind })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="lv-f">First day</label><input id="lv-f" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
            <div className="field"><label htmlFor="lv-t">Last day</label><input id="lv-t" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="lv-n">Note (optional)</label><input id="lv-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <div className="toolbar"><button className="btn primary" type="submit">Send request</button><span className="sub">{days} working day{days === 1 ? '' : 's'}, public holidays excluded</span></div>
        </form>
      </div>
      <div className="card">
        <h2>All leave</h2>
        <div className="table-wrap"><table className="list">
          <thead><tr><th>Who</th><th>Kind</th><th>Dates</th><th className="num">Days</th><th>Status</th></tr></thead>
          <tbody>{[...data.leave].sort((a, b) => b.from.localeCompare(a.from)).map((r) => (
            <tr key={r.id}><td>{nameOf(data, r.personId)}</td><td>{KIND[r.kind]}</td><td>{range(r.from, r.to)}</td>
              <td className="num">{workingDays(r.from, r.to, lvFixedHolidays(Number(r.from.slice(0, 4))))}</td>
              <td><span className={`pill ${r.status === 'approved' ? 'pos' : r.status === 'declined' ? 'neg' : 'accent'}`}>{r.status === 'pending' ? 'Waiting' : r.status === 'approved' ? 'Approved' : 'Declined'}</span>{r.decidedBy && <span className="sub"> by {r.decidedBy}</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

// ---------------- Onboarding ----------------

export function OnboardingPage({ hr }: { hr: People }) {
  const { data } = hr;
  const t = today();
  if (data.onboarding.length === 0) return <div className="page"><div className="empty">Nobody is onboarding. Hiring a candidate starts a checklist here.</div></div>;
  return (
    <div className="page">
      {data.onboarding.map((o) => {
        const p = onboardingProgress(o, t);
        const person = data.people.find((x) => x.id === o.personId);
        return (
          <div key={o.id} className="card">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{person?.name}</h2><span className="sub">{person?.title} · starts {fmtDay(o.startDate)}</span>
              <div className="spacer" /><span className="pill">{p.done} of {p.total} done</span>{p.overdue > 0 && <span className="pill neg">{p.overdue} overdue</span>}
            </div>
            <div className="table-wrap"><table className="list"><tbody>
              {o.tasks.map((task) => {
                const due = addDays(o.startDate, task.dueDay);
                const late = !task.done && due < t;
                return (
                  <tr key={task.id}>
                    <td style={{ width: 36 }}><input type="checkbox" id={`t-${task.id}`} checked={task.done} onChange={() => hr.toggleTask(o.id, task.id)} /></td>
                    <td><label htmlFor={`t-${task.id}`} style={{ textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--muted)' : 'var(--ink)', cursor: 'pointer' }}>{task.text}</label></td>
                    <td className="sub">{OWNER[task.owner]}</td>
                    <td className="num"><span className={late ? 'pill neg' : 'sub'}>{task.dueDay === 0 ? 'First day' : task.dueDay < 0 ? `${-task.dueDay} days before` : `Day ${task.dueDay}`} · {fmtDay(due)}</span></td>
                  </tr>
                );
              })}
            </tbody></table></div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Hiring ----------------

export function Hiring({ hr }: { hr: People }) {
  const { data } = hr;
  const t = today();
  const [opening, setOpening] = useState(data.openings[0]?.id ?? '');
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);
  const [error, setError] = useState('');
  const purge = candidatesToDelete(data, t);
  const op = data.openings.find((o) => o.id === opening);
  const cs = data.candidates.filter((c) => c.openingId === opening);
  const move = (id: string, to: CandidateStage) => {
    setError('');
    if (to === 'rejected') return setReject({ id, reason: '' });
    if (to === 'hired') return hr.hire(id);
    try { hr.moveCandidate(id, to); } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="page">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Opening">{data.openings.map((o) => <button key={o.id} aria-pressed={o.id === opening} onClick={() => setOpening(o.id)}>{o.title}{!o.open && ' (filled)'}</button>)}</div>
        {op?.salaryFrom && <span className="sub">€{op.salaryFrom.toLocaleString('en-GB')} to €{op.salaryTo?.toLocaleString('en-GB')} gross a month · hiring manager {nameOf(data, op.hiringManagerId)}</span>}
      </div>
      {purge.length > 0 && (
        <div className="card toolbar"><span className="pill neg">Privacy</span><span>{purge.length} rejected candidate record{purge.length > 1 ? 's are' : ' is'} past the keep-until date in your privacy notice.</span><div className="spacer" /><button className="btn small danger" onClick={() => hr.deleteCandidates(purge.map((c) => c.id))}>Delete {purge.length}</button></div>
      )}
      {error && <ul className="errors"><li>{error}</li></ul>}
      {reject && (
        <form className="card note-box" onSubmit={(e) => { e.preventDefault(); if (reject.reason.trim()) { hr.moveCandidate(reject.id, 'rejected', reject.reason.trim()); setReject(null); } }}>
          <input className="btn" id="rej" style={{ textAlign: 'left' }} autoFocus placeholder="Why not further? (kept for the candidate's feedback)" value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} />
          <button className="btn primary" type="submit">Reject</button><button className="btn ghost" type="button" onClick={() => setReject(null)}>Cancel</button>
        </form>
      )}
      <div className="board">
        {CANDIDATE_STAGES.map((s) => (
          <div key={s} className="col">
            <div className="col-head"><b>{CANDIDATE_LABEL[s]}</b><span className="sub">{cs.filter((c) => c.stage === s).length}</span></div>
            {cs.filter((c) => c.stage === s).map((c) => {
              const avg = averageScore(c);
              const i = CANDIDATE_STAGES.indexOf(s);
              return (
                <div key={c.id} className="deal" style={{ cursor: 'default' }}>
                  <div className="deal-title">{c.name}</div>
                  <div className="deal-meta"><span>{c.source}</span><span>{avg === null ? 'No score' : `${avg.toFixed(1)} / 5`}</span></div>
                  {c.rejectReason && <div className="sub" style={{ marginTop: 4 }}>{c.rejectReason}</div>}
                  {s !== 'hired' && s !== 'rejected' && (
                    <div className="toolbar" style={{ marginTop: 8, gap: 6 }}>
                      {s === 'interview' && <select className="btn small" aria-label="Add score" value="" onChange={(e) => hr.scoreCandidate(c.id, Number(e.target.value))}><option value="">Score</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>}
                      <button className="btn small primary" onClick={() => move(c.id, CANDIDATE_STAGES[i + 1])}>{s === 'offer' ? 'Hire' : 'Next'}</button>
                      <button className="btn small ghost" onClick={() => move(c.id, 'rejected')}>Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="sub">Hiring a candidate adds them to People, closes the role and starts their onboarding checklist.</p>
    </div>
  );
}

// ---------------- Reviews ----------------

export function Reviews({ hr }: { hr: People }) {
  const { data } = hr;
  const [open, setOpen] = useState<string | null>(data.reviews.find((r) => !r.managerDone)?.id ?? null);
  return (
    <div className="page">
      <div className="card"><div className="table-wrap"><table className="list">
        <thead><tr><th>Person</th><th>Cycle</th><th>Self review</th><th>Manager review</th><th className="num">Score</th><th className="num">Bonus of target</th></tr></thead>
        <tbody>{data.reviews.map((r) => {
          const s = reviewScore(r);
          return (
            <tr key={r.id} className="row" onClick={() => setOpen(r.id)} aria-selected={open === r.id}>
              <td>{nameOf(data, r.personId)}</td><td>{r.cycle}</td>
              <td><span className={`pill ${r.selfDone ? 'pos' : ''}`}>{r.selfDone ? 'Done' : 'Waiting'}</span></td>
              <td><span className={`pill ${r.managerDone ? 'pos' : 'accent'}`}>{r.managerDone ? 'Done' : 'To do'}</span></td>
              <td className="num">{s ?? '—'}</td><td className="num">{s === null ? '—' : `${Math.round(bonusMultiplier(s) * 100)}%`}</td>
            </tr>
          );
        })}</tbody>
      </table></div></div>
      {open && <ReviewEditor key={open} hr={hr} id={open} />}
      <p className="sub">Bonus rule: below 3 pays nothing, 3 pays 50% of target, 4 pays 100%, 5 pays 150%, in straight lines between. Change it per company.</p>
    </div>
  );
}

function ReviewEditor({ hr, id }: { hr: People; id: string }) {
  const r = hr.data.reviews.find((x) => x.id === id)!;
  const errs = validateGoals(r.goals);
  const s = reviewScore(r);
  return (
    <div className="card form">
      <div className="toolbar"><h2 style={{ margin: 0 }}>{nameOf(hr.data, r.personId)}, {r.cycle}</h2><div className="spacer" />{s !== null && <span className="pill accent">{s} of 5 · bonus {Math.round(bonusMultiplier(s) * 100)}%</span>}</div>
      <div className="table-wrap"><table className="list">
        <thead><tr><th>Goal</th><th className="num">Weight</th><th>Score (1 to 5)</th></tr></thead>
        <tbody>{r.goals.map((g, i) => (
          <tr key={i}><td>{g.text}</td><td className="num">{g.weight}%</td>
            <td><div className="seg" role="group" aria-label={`Score for ${g.text}`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={g.score === n} onClick={() => hr.scoreGoal(r.id, i, n)} disabled={r.managerDone}>{n}</button>)}</div></td></tr>
        ))}</tbody>
      </table></div>
      {errs.length > 0 && <ul className="errors">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
      {!r.managerDone && <div className="toolbar"><button className="btn primary" disabled={s === null || errs.length > 0} onClick={() => hr.finishManager(r.id)}>Finish manager review</button>{s === null && <span className="sub">Score every goal first.</span>}</div>}
    </div>
  );
}
