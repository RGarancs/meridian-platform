import { tr, locale } from '../platform/i18n';
import { useMemo, useState } from 'react';
import {
  LeaveKind, OrgNode, Person, activePeople, addDays, candidatesToDelete, compaRatio, directReports, docsToAcknowledge, enps, expiringSoon,
  goalProgress, leaveBalance, lvFixedHolidays, onboardingProgress, orgTree, reviewScore, skillGaps, teamClashes, tenureMonths,
  unusedVacationOnLeaving, validateLeave, whoIsAway, workingDays,
} from './domain';
import { People } from './usePeople';
import { KIND, OWNER, PersonSelect, money, nameOf, range } from './shared';
import { Avatar, Bar, Empty, Field, Head, Icon, Menu, Panel, SearchInput, Seg, fmtDay, fmtDayYear, plural, todayIso, useToast } from '../platform/ui';

type Go = (page: string) => void;

// ---------------- Overview ----------------

export function PeopleOverview({ hr, go, onPerson }: { hr: People; go: Go; onPerson: (id: string) => void }) {
  const { data } = hr;
  const t = todayIso();
  const active = activePeople(data, t);
  const away = whoIsAway(data, t);
  const pending = data.leave.filter((r) => r.status === 'pending');
  const unsigned = data.documents.filter((d) => d.requiresAck).reduce((s, d) => s + active.filter((p) => (!d.personId || d.personId === p.id) && !d.acks.some((a) => a.personId === p.id && a.version === d.version)).length, 0);
  const overdueTasks = [...data.onboarding, ...data.offboarding].reduce((s, o) => s + onboardingProgress(o, t).overdue, 0);
  const reviewsWaiting = data.reviews.filter((r) => !r.managerDone).length;
  const toDelete = candidatesToDelete(data, t).length;
  const expiring = expiringSoon(data, t, 45);
  const starting = data.people.filter((p) => p.startDate > t && p.startDate <= addDays(t, 45));
  const leaving = data.people.filter((p) => p.lastDay && p.lastDay >= t && p.lastDay <= addDays(t, 60));
  const pulse = [...data.pulses].sort((a, b) => b.period.localeCompare(a.period))[0];
  const score = pulse ? enps(pulse.scores) : null;
  const asks = [
    pending.length && { n: pending.length, text: tr('{0} to decide', { 0: plural(pending.length, 'time-off request') }), page: 'timeoff', icon: 'calendar' },
    unsigned && { n: unsigned, text: tr("{0} missing on documents", { 0: plural(unsigned, 'signature') }), page: 'documents', icon: 'doc' },
    overdueTasks && { n: overdueTasks, text: tr("{0} overdue", { 0: plural(overdueTasks, 'joiner or leaver task') }), page: 'moves', icon: 'door' },
    reviewsWaiting && { n: reviewsWaiting, text: tr("{0} waiting for a manager", { 0: plural(reviewsWaiting, 'review') }), page: 'reviews', icon: 'star' },
    expiring.length && { n: expiring.length, text: tr("{0} expiring", { 0: plural(expiring.length, 'certificate or course', 'certificates or courses') }), page: 'skills', icon: 'skill' },
    toDelete && { n: toDelete, text: tr("{0} past the GDPR keep date", { 0: plural(toDelete, 'candidate') }), page: 'hiring', icon: 'hire' },
  ].filter(Boolean) as { n: number; text: string; page: string; icon: string }[];

  return (
    <div className="page">
      <Head eyebrow={tr("People")} title={asks.length === 0 ? tr("Nothing needs you today.") : tr("{0} need{1} you today.", { 0: plural(asks.length, 'thing'), 1: asks.length === 1 ? 's' : '' })} />
      <div className="hero">
        <div><div className="sub">{tr("Team")}</div><div className="big">{active.length}</div><div className="sub" style={{ marginTop: 6 }}>{plural(away.length, 'person', 'people')} {tr("away today")}</div></div>
        <div>
          <div className="sub" data-tip={tr("Employee Net Promoter Score: % who would recommend working here (9–10) minus % who would not (0–6). Hidden below 5 answers.")} tabIndex={0}>{tr("eNPS")}</div>
          <div className="big" style={{ color: 'var(--accent)' }}>{score === null ? '—' : score > 0 ? `+${score}` : score}</div>
          <div className="sub" style={{ marginTop: 6 }}>{pulse ? `${pulse.period.replace('-', ' ')} · ${plural(pulse.scores.length, 'answer')}` : tr("No pulse yet")}</div>
        </div>
      </div>
      <div className="grid">
        <div className="card tight s7">
          <div className="card-head"><h2>{tr("Needs you")}</h2></div>
          {asks.length === 0 ? <Empty title={tr("All clear")} text={tr("No requests, signatures or reviews are waiting.")} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {asks.map((a) => (
                <div key={a.page} className="row" onClick={() => go(a.page)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(a.page)}>
                  <span className="avatar sm co" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name={a.icon} size={14} /></span>
                  <div className="grow"><div className="t">{a.text}</div></div>
                  <Icon name="arrow" size={16} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card tight s5">
          <div className="card-head"><h2>{tr("Away today")}</h2><div className="spacer" /><button className="btn sm ghost" onClick={() => go('timeoff')}>{tr("Calendar")} <Icon name="arrow" size={14} /></button></div>
          {away.length === 0 ? <Empty title={tr("Everyone is in")} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {away.map(({ person, request }) => (
                <div key={request.id} className="row" onClick={() => onPerson(person.id)}>
                  <Avatar name={person.name} size="sm" />
                  <div className="grow"><div className="t">{person.name}</div><div className="sub">{tr("Back")} {fmtDay(addDays(request.to, 1))}</div></div>
                  <span className={`pill ${request.kind === 'sick' ? 'neg' : 'accent'}`}>{KIND[request.kind]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid">
        <div className="card tight s6">
          <div className="card-head"><h2>{tr("Joining and leaving")}</h2><div className="spacer" /><button className="btn sm ghost" onClick={() => go('moves')}>{tr("Checklists")} <Icon name="arrow" size={14} /></button></div>
          {starting.length + leaving.length === 0 ? <Empty title={tr("No one joining or leaving soon")} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {starting.map((p) => (
                <div key={p.id} className="row" onClick={() => onPerson(p.id)}>
                  <Avatar name={p.name} size="sm" /><div className="grow"><div className="t">{p.name}</div><div className="sub">{p.title} · {p.team}</div></div>
                  <span className="pill pos">{tr("Starts")} {fmtDay(p.startDate)}</span>
                </div>
              ))}
              {leaving.map((p) => (
                <div key={p.id} className="row" onClick={() => onPerson(p.id)}>
                  <Avatar name={p.name} size="sm" /><div className="grow"><div className="t">{p.name}</div><div className="sub">{p.title} · {p.team}</div></div>
                  <span className="pill warn">{tr("Last day")} {fmtDay(p.lastDay!)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card s6">
          <div className="card-head"><h2>{tr("Company goals")}</h2><div className="spacer" /><button className="btn sm ghost" onClick={() => go('goals')}>{tr("All goals")} <Icon name="arrow" size={14} /></button></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.goals.filter((g) => g.level === 'company').map((g) => {
              const p = goalProgress(data, g.id);
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 6 }}><span className="ink">{g.title}</span><b className="ink num">{p}%</b></div>
                  <Bar value={p} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Directory ----------------

export function Directory({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const { data } = hr;
  const t = todayIso();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'list' | 'org'>('list');
  const [team, setTeam] = useState('all');
  const [adding, setAdding] = useState(false);
  const teams = [...new Set(data.people.map((p) => p.team))].sort();
  const shown = data.people.filter((p) => (team === 'all' || p.team === team) && (!q || `${p.name} ${p.title} ${p.team} ${p.location}`.toLowerCase().includes(q.toLowerCase())));
  const away = new Set(whoIsAway(data, t).map((a) => a.person.id));
  const status = (p: Person) => (p.startDate > t ? <span className="pill pos">{tr("Starts")} {fmtDay(p.startDate)}</span> : p.lastDay && p.lastDay < t ? <span className="pill">{tr("Left")}</span> : p.lastDay ? <span className="pill warn">{tr("Leaving")} {fmtDay(p.lastDay)}</span> : away.has(p.id) ? <span className="pill accent">{tr("Away")}</span> : null);

  const Node = ({ n }: { n: OrgNode }) => (
    <div>
      <div className="org-node" onClick={() => onPerson(n.person.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPerson(n.person.id)} style={{ cursor: 'pointer' }}>
        <Avatar name={n.person.name} size="sm" /><div><div className="ink">{n.person.name}</div><div className="sub">{n.person.title}</div></div>
        {n.reports.length > 0 && <span className="pill">{n.reports.length}</span>}
      </div>
      {n.reports.length > 0 && <div className="org-kids">{n.reports.map((r) => <Node key={r.person.id} n={r} />)}</div>}
    </div>
  );

  return (
    <div className="page">
      <Head eyebrow={tr("People")} title={tr("{0} in {1}.", { 0: plural(activePeople(data, t).length, 'person', 'people'), 1: plural(teams.length, 'team') })}>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr("Add person")}</button>
      </Head>
      <div className="toolbar">
        <SearchInput id="dir-q" value={q} onChange={setQ} placeholder={tr("Find by name, role, team or city")} />
        <select className="input" style={{ width: 'auto' }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label={tr("Team")}><option value="all">{tr("All teams")}</option>{teams.map((x) => <option key={x}>{x}</option>)}</select>
        <div className="spacer" />
        <Seg label={tr("View")} value={view} onChange={setView} options={[{ id: 'list', label: tr("List") }, { id: 'org', label: tr("Org chart") }]} />
      </div>
      {view === 'org' ? (
        <div className="card"><div className="org">{orgTree(data, t).map((n) => <Node key={n.person.id} n={n} />)}</div></div>
      ) : (
        <div className="card tight">
          {shown.length === 0 ? <Empty title={tr("No one matches")} text={tr("Try another name or team.")} /> : (
            <div style={{ overflowX: 'auto' }}><table className="list click">
              <thead><tr><th>{tr("Name")}</th><th>{tr("Role")}</th><th>{tr("Team")}</th><th>{tr("Manager")}</th><th>{tr("Started")}</th><th /></tr></thead>
              <tbody>{shown.map((p) => (
                <tr key={p.id} onClick={() => onPerson(p.id)}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={p.name} size="sm" /><div><div className="ink">{p.name}</div><div className="sub">{p.location}</div></div></div></td>
                  <td>{p.title}</td><td>{p.team}</td><td className="muted">{p.managerId ? nameOf(data, p.managerId) : '—'}</td>
                  <td className="muted">{fmtDayYear(p.startDate)}</td><td className="num">{status(p)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
      {adding && <PersonForm hr={hr} onClose={() => setAdding(false)} />}
    </div>
  );
}

export function PersonForm({ hr, person, onClose }: { hr: People; person?: Person; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({
    name: person?.name ?? '', email: person?.email ?? '', title: person?.title ?? '', team: person?.team ?? '', managerId: person?.managerId ?? '',
    startDate: person?.startDate ?? addDays(todayIso(), 14), location: person?.location ?? 'Riga', leaveAllowance: String(person?.leaveAllowance ?? 20),
    salary: person?.salary ? String(person.salary) : '', bonusTarget: person?.bonusTarget ? String(Math.round(person.bonusTarget * 100)) : '',
  });
  const [err, setErr] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = [!f.name.trim() && tr("Add a name."), !f.title.trim() && tr("Add a role."), !f.team.trim() && tr("Add a team."), Number(f.leaveAllowance) < 20 && 'Latvian law needs at least 20 working days of paid leave.'].filter(Boolean) as string[];
    if (errs.length) return setErr(errs);
    const v = { name: f.name.trim(), email: f.email.trim(), title: f.title.trim(), team: f.team.trim(), managerId: f.managerId || undefined, startDate: f.startDate, location: f.location, leaveAllowance: Number(f.leaveAllowance), salary: f.salary ? Number(f.salary) : undefined, bonusTarget: f.bonusTarget ? Number(f.bonusTarget) / 100 : undefined };
    if (person) toast(tr("Saved {0}", { 0: v.name }), hr.updatePerson(person.id, v));
    else { const r = hr.addPerson(v); toast(tr("Added {0}{1}", { 0: v.name, 1: v.startDate > todayIso() ? ' and started their onboarding checklist' : '' }), r.undo); }
    onClose();
  };
  return (
    <Panel title={person ? tr("Edit {0}", { 0: person.name }) : tr("Add a person")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err.length > 0 && <ul className="errors">{err.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="row2"><Field label={tr("Name")} id="pf-n"><input id="pf-n" autoFocus value={f.name} onChange={set('name')} /></Field><Field label={tr("Work email")} id="pf-e"><input id="pf-e" type="email" value={f.email} onChange={set('email')} /></Field></div>
        <div className="row2"><Field label={tr("Role")} id="pf-t"><input id="pf-t" value={f.title} onChange={set('title')} list="pf-titles" /></Field><Field label={tr("Team")} id="pf-tm"><input id="pf-tm" value={f.team} onChange={set('team')} list="pf-teams" /></Field></div>
        <datalist id="pf-titles">{[...new Set(data.people.map((p) => p.title))].map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="pf-teams">{[...new Set(data.people.map((p) => p.team))].map((x) => <option key={x} value={x} />)}</datalist>
        <div className="row2"><Field label={tr("Manager")} id="pf-m"><PersonSelect id="pf-m" people={data.people.filter((p) => p.id !== person?.id)} value={f.managerId} onChange={(v) => setF({ ...f, managerId: v })} none="No manager" /></Field><Field label={tr("Start date")} id="pf-s"><input id="pf-s" type="date" value={f.startDate} onChange={set('startDate')} /></Field></div>
        <div className="row2"><Field label={tr("Location")} id="pf-l"><input id="pf-l" value={f.location} onChange={set('location')} /></Field><Field label={tr("Paid leave a year")} id="pf-a" tip={tr("Working days. Latvia's minimum is 4 weeks, which is 20 working days.")}><input id="pf-a" type="number" min="20" value={f.leaveAllowance} onChange={set('leaveAllowance')} /></Field></div>
        <div className="row2"><Field label={tr("Monthly salary, gross (€)")} id="pf-sa" tip={tr("Only HR and the line manager see pay.")}><input id="pf-sa" type="number" min="0" value={f.salary} onChange={set('salary')} /></Field><Field label={tr("Bonus target (% of year's pay)")} id="pf-b" tip={tr("Paid in full when the review score is 4 of 5.")}><input id="pf-b" type="number" min="0" max="100" value={f.bonusTarget} onChange={set('bonusTarget')} /></Field></div>
        <div className="toolbar"><button className="btn primary" type="submit">{person ? tr("Save") : tr("Add person")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

const LEVEL = ['None', 'Learning', tr("Can do"), 'Expert', 'Teaches'];

export function PersonPanel({ hr, id, onClose, onPerson, go }: { hr: People; id: string; onClose: () => void; onPerson: (id: string) => void; go: Go }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const p = data.people.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [timeOff, setTimeOff] = useState(false);
  const [lastDay, setLastDay] = useState(addDays(t, 30));
  if (!p) return null;
  const year = Number(t.slice(0, 4));
  const bal = leaveBalance(data, p.id, year, t);
  const reports = directReports(data, p.id);
  const goals = data.goals.filter((g) => g.ownerId === p.id);
  const toSign = docsToAcknowledge(data, p.id);
  const gaps = skillGaps(data, p.id);
  const review = data.reviews.filter((r) => r.personId === p.id).slice(-1)[0];
  const feedback = data.feedback.filter((f) => f.aboutId === p.id).slice(-3).reverse();
  const cr = compaRatio(data, p);
  const months = tenureMonths(p, t);

  return (
    <Panel title={p.name} eyebrow={`${p.title} · ${p.team}`} lead={<Avatar name={p.name} size="lg" />} onClose={onClose}
      actions={<Menu items={[
        { label: tr("Edit"), icon: 'edit', onClick: () => setEditing(true) },
        { label: tr("Book time off"), icon: 'calendar', onClick: () => setTimeOff(true) },
        'divider',
        { label: p.lastDay ? tr("Change last day") : tr("Start leaving"), icon: 'door', onClick: () => setLeaving(true), danger: !p.lastDay },
      ]} />}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub" data-tip={tr("Paid vacation days left this year after taken, booked and pending days.")} tabIndex={0}>{tr("Vacation left")}</div><div className="big" style={{ fontSize: 40 }}>{bal.left}</div><div className="sub">{tr("of")} {bal.allowance} {tr("days")}</div></div>
        <div><div className="sub">{tr("With us")}</div><div className="big" style={{ fontSize: 40 }}>{months < 0 ? tr("New") : months >= 12 ? `${Math.floor(months / 12)}y ${months % 12}m` : `${months}m`}</div><div className="sub">{tr("since")} {fmtDayYear(p.startDate)}</div></div>
      </div>
      {leaving && (
        <div className="card flat tight">
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); toast(tr("{0} leaves on {1}. Leaving checklist started.", { 0: p.name, 1: fmtDay(lastDay) }), hr.startLeaving(p.id, lastDay)); setLeaving(false); }}>
            <label htmlFor="pp-ld" className="sub">{tr("Last day")}</label><input id="pp-ld" className="input" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            <button className="btn primary sm" type="submit">{tr("Start leaving")}</button><button className="btn ghost sm" type="button" onClick={() => setLeaving(false)}>{tr("Cancel")}</button>
          </form>
          <p className="sub" style={{ margin: '8px 0 0' }}>{tr("Vacation owed on that day:")} <b className="ink">{unusedVacationOnLeaving(data, p.id, lastDay)} {tr("days")}</b>{tr(", paid with the final salary.")}</p>
        </div>
      )}
      <dl className="facts">
        <dt>{tr("Manager")}</dt><dd>{p.managerId ? <button className="link" onClick={() => onPerson(p.managerId!)}>{nameOf(data, p.managerId)}</button> : '—'}</dd>
        <dt>{tr("Email")}</dt><dd>{p.email || '—'}</dd>
        <dt>{tr("Location")}</dt><dd>{p.location}</dd>
        {p.salary !== undefined && <><dt><span data-tip={tr("Only HR and the line manager see pay.")} tabIndex={0}>{tr("Salary")}</span></dt><dd>{money(p.salary)} {tr("a month")}{cr !== null && <span className="sub"> · <span data-tip={tr("Salary against the middle of the role's pay band. 1.00 is the middle.")} tabIndex={0}>{tr("compa-ratio")} {cr.toFixed(2)}</span></span>}</dd></>}
        {p.lastDay && <><dt>{tr("Last day")}</dt><dd>{fmtDayYear(p.lastDay)}</dd></>}
      </dl>
      {reports.length > 0 && (<div><div className="section-title">{tr("Team (")}{reports.length})</div><div className="rows">{reports.map((r) => <div key={r.id} className="row" onClick={() => onPerson(r.id)}><Avatar name={r.name} size="sm" /><div className="grow"><div className="t">{r.name}</div><div className="sub">{r.title}</div></div></div>)}</div></div>)}
      {toSign.length > 0 && (
        <div><div className="section-title">{tr("Waiting for signature")}</div><div className="rows">{toSign.map((d) => (
          <div key={d.id} className="row" style={{ cursor: 'default' }}><Icon name="doc" /><div className="grow"><div className="t">{d.title}</div><div className="sub">{tr("Version")} {d.version}</div></div><button className="btn sm" onClick={() => toast(tr("{0} signed {1}", { 0: p.name, 1: d.title }), hr.acknowledge(d.id, p.id))}>{tr("Mark signed")}</button></div>
        ))}</div></div>
      )}
      {goals.length > 0 && (
        <div><div className="section-title">{tr("Goals")}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{goals.map((g) => (
          <div key={g.id} role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => { onClose(); go('goals'); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 6 }}><span className="ink">{g.title}</span><b className="num ink">{goalProgress(data, g.id)}%</b></div>
            <Bar value={goalProgress(data, g.id)} tone={g.status === 'off_track' ? 'neg' : g.status === 'at_risk' ? 'warn' : ''} />
          </div>
        ))}</div></div>
      )}
      {review && (<div><div className="section-title">{tr("Review ·")} {review.cycle}</div><div className="rows"><div className="row" onClick={() => { onClose(); go('reviews'); }}><Icon name="star" /><div className="grow"><div className="t">{review.managerDone ? tr("Score {0} of 5", { 0: reviewScore(review) ?? '—' }) : review.selfDone ? tr("Waiting for the manager") : tr("Waiting for the self-review")}</div><div className="sub">{plural(review.goals.length, 'goal')}</div></div><Icon name="arrow" size={16} /></div></div></div>)}
      {gaps.length > 0 && (<div><div className="section-title">{tr("Skills to grow for the role")}</div><div className="rows">{gaps.map((g) => <div key={g.skill.id} className="row" style={{ cursor: 'default' }}><div className="grow"><div className="t">{g.skill.name}</div><div className="sub">{tr("Has")} {LEVEL[g.have]}{tr(", role needs")} {LEVEL[g.need]}</div></div><span className="pill warn">{tr("Gap")} {g.gap}</span></div>)}</div></div>)}
      {feedback.length > 0 && (<div><div className="section-title">{tr("Recent feedback")}</div><ul className="tl">{feedback.map((f) => <li key={f.id} className={f.kind === 'praise' ? 'stage_change' : ''}><div className="ink">{f.text}</div><div className="when">{f.kind === 'praise' ? tr("Praise") : tr("To grow")} · {f.from} · {fmtDay(f.at)}{f.private ? tr(" · private") : ''}</div></li>)}</ul></div>)}
      {editing && <PersonForm hr={hr} person={p} onClose={() => setEditing(false)} />}
      {timeOff && <LeaveForm hr={hr} personId={p.id} onClose={() => setTimeOff(false)} />}
    </Panel>
  );
}

// ---------------- Time off ----------------

export function LeaveForm({ hr, personId, onClose }: { hr: People; personId?: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [f, setF] = useState({ personId: personId ?? data.people[0]?.id ?? '', kind: 'vacation' as LeaveKind, from: addDays(t, 7), to: addDays(t, 11), note: '' });
  const errs = validateLeave(data, { personId: f.personId, kind: f.kind, from: f.from, to: f.to, note: f.note || undefined }, t);
  const days = f.from && f.to && f.to >= f.from ? workingDays(f.from, f.to, lvFixedHolidays(Number(f.from.slice(0, 4)))) : 0;
  const clashes = f.from && f.to ? teamClashes(data, { id: '_', personId: f.personId, kind: f.kind, from: f.from, to: f.to, status: 'pending' }) : [];
  const bal = f.personId ? leaveBalance(data, f.personId, Number(t.slice(0, 4)), t) : null;
  const [tried, setTried] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTried(true);
    if (errs.length) return;
    toast(tr("Asked for {0} off for {1}", { 0: plural(days, 'day'), 1: nameOf(data, f.personId) }), hr.requestLeave({ personId: f.personId, kind: f.kind, from: f.from, to: f.to, note: f.note || undefined }));
    onClose();
  };
  return (
    <Panel title={tr("Book time off")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {tried && errs.length > 0 && <ul className="errors">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="row2">
          <Field label={tr("Who")} id="lf-p"><PersonSelect id="lf-p" people={activePeople(data, t)} value={f.personId} onChange={(v) => setF({ ...f, personId: v })} /></Field>
          <Field label={tr("Kind")} id="lf-k"><select id="lf-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LeaveKind })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div className="row2">
          <Field label={tr("First day")} id="lf-f"><input id="lf-f" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></Field>
          <Field label={tr("Last day")} id="lf-t"><input id="lf-t" type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <Field label={tr("Note (optional)")} id="lf-n"><input id="lf-n" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="card flat tight" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div className="sub" data-tip={tr("Monday to Friday, without Latvian public holidays.")} tabIndex={0}>{tr("Working days")}</div><div className="ink" style={{ fontSize: 22, fontWeight: 600 }}>{days}</div></div>
          {f.kind === 'vacation' && bal && <div><div className="sub">{tr("Left after this")}</div><div className="ink" style={{ fontSize: 22, fontWeight: 600 }}>{bal.left - days}</div></div>}
          {clashes.length > 0 && <div className="grow"><div className="sub">{tr("Also away from")} {data.people.find((x) => x.id === f.personId)?.team}</div><div className="ink">{clashes.map((c) => c.name).join(', ')}</div></div>}
        </div>
        <div className="toolbar"><button className="btn primary" type="submit">{tr("Send request")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

export function TimeOff({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [booking, setBooking] = useState(false);
  const [start, setStart] = useState(() => { const d = new Date(`${t}T00:00:00Z`); const wd = (d.getUTCDay() + 6) % 7; return addDays(t, -wd); });
  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(start, i)), [start]);
  const pending = data.leave.filter((r) => r.status === 'pending').sort((a, b) => a.from.localeCompare(b.from));
  const people = activePeople(data, t).concat(data.people.filter((p) => p.startDate > t));
  const year = Number(t.slice(0, 4));
  const holidays = new Set(lvFixedHolidays(year).concat(lvFixedHolidays(year + 1)));
  const cell = (pid: string, d: string) => data.leave.find((r) => r.personId === pid && r.status !== 'declined' && r.from <= d && d <= r.to);

  return (
    <div className="page">
      <Head eyebrow={tr("People")} title={pending.length ? tr("{0} wait{1} for you.", { 0: plural(pending.length, 'request'), 1: pending.length === 1 ? 's' : '' }) : tr("No requests to decide.")}>
        <button className="btn primary" onClick={() => setBooking(true)}><Icon name="plus" size={16} />{tr("Book time off")}</button>
      </Head>
      {pending.length > 0 && (
        <div className="card tight">
          <div className="rows">{pending.map((r) => {
            const p = data.people.find((x) => x.id === r.personId)!;
            const clash = teamClashes(data, r);
            const n = workingDays(r.from, r.to, lvFixedHolidays(Number(r.from.slice(0, 4))));
            const b = r.kind === 'vacation' ? leaveBalance(data, p.id, Number(r.from.slice(0, 4)), t) : null;
            return (
              <div key={r.id} className="row" style={{ cursor: 'default', flexWrap: 'wrap' }}>
                <Avatar name={p.name} size="sm" />
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="t"><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button> · {KIND[r.kind]} · {range(r.from, r.to)}</div>
                  <div className="sub">{plural(n, 'working day')}{b ? tr(" · {0} left after", { 0: b.left + b.pending - n }) : ''}{r.note ? ` · ${r.note}` : ''}</div>
                </div>
                {clash.length > 0 && <span className="pill warn" data-tip={tr("Also away: {0}", { 0: clash.map((c) => c.name).join(', ') })} tabIndex={0}>{plural(clash.length, 'clash', 'clashes')}</span>}
                <button className="btn sm ghost" onClick={() => toast(tr("Declined {0}'s request", { 0: p.name }), hr.decideLeave(r.id, 'declined'))}>{tr("Decline")}</button>
                <button className="btn sm primary" onClick={() => toast(tr("Approved {0}'s {1}", { 0: p.name, 1: KIND[r.kind].toLowerCase() }), hr.decideLeave(r.id, 'approved'))}><Icon name="check" size={14} />{tr("Approve")}</button>
              </div>
            );
          })}</div>
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <h2>{new Date(`${start}T00:00:00Z`).toLocaleDateString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
          <div className="spacer" />
          <span className="sub hide-phone" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span><i className="dot" style={{ background: 'var(--accent)' }} /> {tr("Vacation")}</span><span><i className="dot" style={{ background: 'var(--neg)' }} /> {tr("Sick")}</span><span><i className="dot" style={{ background: 'var(--warn)' }} /> {tr("Other")}</span><span><i className="dot" style={{ border: '1.5px dashed var(--accent)' }} /> {tr("Waiting")}</span>
          </span>
          <button className="btn sm icon ghost" aria-label={tr("Earlier")} onClick={() => setStart(addDays(start, -14))}><Icon name="chevron" size={16} className="rot90" /></button>
          <button className="btn sm ghost" onClick={() => { const d = new Date(`${t}T00:00:00Z`); setStart(addDays(t, -((d.getUTCDay() + 6) % 7))); }}>{tr("Today")}</button>
          <button className="btn sm icon ghost" aria-label={tr("Later")} onClick={() => setStart(addDays(start, 14))}><Icon name="chevron" size={16} className="rot-90" /></button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div className="cal" style={{ ['--days' as string]: days.length }}>
            <div className="who sub">{tr("Person")}</div>
            {days.map((d) => { const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); return <div key={d} className={`d ${wd === 0 || wd === 6 || holidays.has(d) ? 'we' : ''} ${d === t ? 'today' : ''}`} title={holidays.has(d) ? tr("Public holiday") : undefined}>{Number(d.slice(8))}</div>; })}
            {people.map((p) => (
              <FragmentRow key={p.id}>
                <div className="who"><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button></div>
                {days.map((d) => {
                  const r = cell(p.id, d); const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); const off = wd === 0 || wd === 6 || holidays.has(d);
                  return <div key={d} className={`cell ${off ? 'we' : ''} ${r && !off ? `${r.kind} ${r.status}` : ''}`} title={r && !off ? `${p.name}: ${KIND[r.kind]}${r.status === 'pending' ? ' (waiting)' : ''}` : undefined}>{r && !off && <i />}</div>;
                })}
              </FragmentRow>
            ))}
          </div>
        </div>
      </div>
      <div className="card tight">
        <div className="card-head"><h2>{tr("Vacation balances")} {year}</h2><div className="spacer" /><span className="sub" data-tip={tr("Taken: days already past. Booked: approved future days. Waiting: requests not yet decided.")} tabIndex={0}>{tr("How we count")}</span></div>
        <div style={{ overflowX: 'auto' }}><table className="list click">
          <thead><tr><th>{tr("Person")}</th><th className="num">{tr("Allowance")}</th><th className="num">{tr("Taken")}</th><th className="num">{tr("Booked")}</th><th className="num">{tr("Waiting")}</th><th className="num">{tr("Left")}</th><th style={{ width: 160 }} /></tr></thead>
          <tbody>{activePeople(data, t).map((p) => { const b = leaveBalance(data, p.id, year, t); return (
            <tr key={p.id} onClick={() => onPerson(p.id)}>
              <td className="ink">{p.name}</td><td className="num">{b.allowance}</td><td className="num">{b.taken}</td><td className="num">{b.booked}</td><td className="num">{b.pending}</td>
              <td className="num"><b className="ink">{b.left}</b></td><td><Bar value={((b.taken + b.booked) / b.allowance) * 100} tone={b.left > b.allowance * 0.6 && Number(t.slice(5, 7)) >= 10 ? 'warn' : ''} /></td>
            </tr>
          ); })}</tbody>
        </table></div>
        <p className="sub" style={{ margin: '10px 4px 0' }}>{tr("Amber bar: more than 60% of the year's vacation still unused late in the year.")}</p>
      </div>
      {booking && <LeaveForm hr={hr} onClose={() => setBooking(false)} />}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

// ---------------- Joiners and leavers ----------------

export function Moves({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [owner, setOwner] = useState<'all' | keyof typeof OWNER>('all');
  const lists = [
    ...data.onboarding.map((o) => ({ o, kind: 'onboarding' as const })),
    ...data.offboarding.map((o) => ({ o, kind: 'offboarding' as const })),
  ].filter(({ o }) => onboardingProgress(o, t).done < o.tasks.length || o.startDate >= addDays(t, -14));
  return (
    <div className="page">
      <Head eyebrow={tr("People")} title={lists.length ? tr("{0} in progress.", { 0: plural(lists.length, 'checklist') }) : tr("No one joining or leaving.")} lede={tr("Each step has an owner and a day relative to the start or last day. Add a person with a future start date and their checklist starts by itself.")} />
      <div className="toolbar"><Seg label={tr("Owner")} value={owner} onChange={setOwner} options={[{ id: 'all', label: tr("Everyone") }, { id: 'hr', label: tr("HR") }, { id: 'manager', label: tr("Manager") }, { id: 'it', label: tr("IT") }, { id: 'newcomer', label: tr("Newcomer") }]} /></div>
      {lists.length === 0 && <div className="card"><Empty title={tr("Nothing in progress")} text={tr("Start a leaving checklist from a person's ⋯ menu.")} /></div>}
      <div className="grid">
        {lists.map(({ o, kind }) => {
          const p = data.people.find((x) => x.id === o.personId);
          if (!p) return null;
          const pr = onboardingProgress(o, t);
          const owed = kind === 'offboarding' ? unusedVacationOnLeaving(data, p.id, o.startDate) : null;
          return (
            <div key={o.id} className="card s6">
              <div className="card-head">
                <Avatar name={p.name} />
                <div className="grow"><h2 style={{ fontSize: 16 }}><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button></h2><div className="sub">{kind === 'onboarding' ? tr("Starts {0}", { 0: fmtDay(o.startDate) }) : tr("Last day {0}", { 0: fmtDay(o.startDate) })} · {p.title}</div></div>
                <div className="ring" style={{ ['--p' as string]: Math.round((pr.done / pr.total) * 100) }} data-v={`${pr.done}/${pr.total}`} />
              </div>
              {owed !== null && <p className="sub" style={{ margin: '0 0 8px' }}>{tr("Unused vacation to pay out:")} <b className="ink">{owed} {tr("days")}</b></p>}
              <div className="rows">
                {o.tasks.filter((x) => owner === 'all' || x.owner === owner).map((task) => {
                  const due = addDays(o.startDate, task.dueDay);
                  const late = !task.done && due < t;
                  return (
                    <label key={task.id} className="row" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={task.done} onChange={() => toast(task.done ? tr("Reopened") : tr("Done"), hr.toggleTask(kind, o.id, task.id))} />
                      <div className="grow"><div className="t" style={task.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{task.text}</div><div className="sub">{OWNER[task.owner]} · {fmtDay(due)}</div></div>
                      {late && <span className="pill neg">{tr("Late")}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
