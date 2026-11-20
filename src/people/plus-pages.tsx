import { tr } from '../platform/i18n';
import { useMemo, useState } from 'react';
import { addDays, goalProgress, leaveBalance } from './domain';
import {
  HrQuestion, JourneyOwner, JourneyPhase, KIT_FLOW, KitRequest, KitStatus, PHASES, StepKind, greeting, hrInbox, isStepDone, itemName,
  journeyProgress, kitCost, kitFor, kitRisk, kitToReturn, myToday, needsJourney, nextKitStatus, phaseOf, pickTemplate, stepDue, suggestBuddy, topTopics,
} from './plus';
import { People } from './usePeople';
import { PersonSelect, money, nameOf } from './shared';
import { Avatar, Bar, Disclose, Empty, Field, Head, Icon, Menu, Panel, Stat, fmtDay, plural, todayIso, useToast } from '../platform/ui';

type Go = (page: string) => void;

export const JOURNEY_OWNER: Record<JourneyOwner, string> = { hr: tr('HR'), manager: tr('Manager'), it: tr('IT'), buddy: tr('Buddy'), newcomer: tr('Newcomer') };
const PHASE_LABEL: Record<JourneyPhase, string> = { preboard: tr('Before day one'), day1: tr('Day one'), first90: tr('First 90 days') };
const KIT_LABEL: Record<KitStatus, string> = { requested: tr('Requested'), ordered: tr('Ordered'), ready: tr('Ready'), delivered: tr('Handed over'), returned: tr('Returned') };
const STEP_ICON: Record<StepKind | 'ack', string> = { task: 'task', sign: 'doc', ack: 'doc', training: 'skill', meet: 'people', kit: 'laptop', goal: 'target' };
const firstName = (n: string) => n.split(' ')[0];
const AI_NOTE = tr('Answers are drafted by AI from your company’s own policies and your records, with the source. Anything it cannot answer goes to a person in HR.');

// ---------------- My Meridian (the employee's home) ----------------

export function MyMeridian({ hr, go, onPerson }: { hr: People; go: Go; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const fallback = useMemo(() => {
    const live = data.journeys.find((j) => j.startDate <= t) ?? data.journeys[0];
    return live?.personId ?? data.people[0]?.id ?? '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [as, setAs] = useState(fallback);
  const me = data.people.find((p) => p.id === as);
  if (!me) return <div className="page"><Empty title={tr('No people yet')} /></div>;
  const journey = data.journeys.find((j) => j.personId === me.id);
  const pr = journey && journeyProgress(data, journey, t);
  const items = myToday(data, me.id, t);
  const manager = data.people.find((p) => p.id === me.managerId);
  const buddy = data.people.find((p) => p.id === journey?.buddyId);
  const goals = data.goals.filter((g) => g.ownerId === me.id && g.level === 'person');
  const kit = data.kitRequests.filter((r) => r.personId === me.id && r.status !== 'returned');
  const balance = leaveBalance(data, me.id, Number(t.slice(0, 4)), t);
  const lede = !pr ? tr('Your tasks, your people and answers to your HR questions, in one place.')
    : pr.day < 0 ? tr('You start in {0}. Here is what happens before then.', { 0: plural(-pr.day, 'day') })
      : pr.finished ? tr('Your first 90 days are behind you.') : tr('Day {0} of 90. {1} of your journey done.', { 0: pr.day, 1: `${pr.percent}%` });

  return (
    <div className="page">
      <div className="toolbar">
        <span className="sub" data-tip={tr('This is the page each employee sees. Pick a person to see it as they do.')} tabIndex={0}>{tr('Viewing as')}</span>
        <div className="field" style={{ minWidth: 220 }}><PersonSelect id="me-as" people={data.people.filter((p) => !p.lastDay)} value={me.id} onChange={setAs} /></div>
      </div>
      <Head eyebrow={tr('My Meridian')} title={`${greeting(new Date().getHours())}, ${firstName(me.name)}.`} lede={lede} />
      <div className="grid">
        <div className="card tight s7">
          <div className="card-head"><h2>{tr('This week')}</h2><div className="spacer" />{items.length > 0 && <span className="chip">{plural(items.length, 'thing')}</span>}</div>
          {items.length === 0 ? <Empty title={tr('Nothing to do this week')} text={tr('New steps from your journey show up here when they are due.')} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {items.map((it) => (
                <div key={it.key} className="row" style={{ cursor: 'default' }}>
                  <span className="avatar sm co" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name={STEP_ICON[it.kind]} size={14} /></span>
                  <div className="grow"><div className="t">{it.text}</div><div className="sub">{[it.due && fmtDay(it.due), it.sub].filter(Boolean).join(' · ')}</div></div>
                  {it.late && <span className="pill neg">{tr('Late')}</span>}
                  {it.docId
                    ? <button className="btn sm" onClick={() => toast(tr('Signed'), hr.acknowledge(it.docId!, me.id))}>{tr('Read and sign')}</button>
                    : it.stepRef && <button className="btn sm" onClick={() => toast(tr('Done'), hr.toggleStep(it.stepRef!.journeyId, it.stepRef!.stepId))}><Icon name="check" size={14} />{tr('Done')}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card s5">
          <div className="card-head"><h2>{tr('Your people')}</h2></div>
          <div className="rows">
            {manager && <div className="row" onClick={() => onPerson(manager.id)}><Avatar name={manager.name} size="sm" /><div className="grow"><div className="t">{manager.name}</div><div className="sub">{tr('Your manager')} · {manager.title}</div></div></div>}
            {buddy && <div className="row" onClick={() => onPerson(buddy.id)}><Avatar name={buddy.name} size="sm" /><div className="grow"><div className="t">{buddy.name}</div><div className="sub">{tr('Your buddy for the first 90 days')}</div></div></div>}
            {!manager && !buddy && <Empty title={tr('No manager or buddy set')} />}
          </div>
          <div className="section-title" style={{ marginTop: 18 }}>{tr('Ask HR')}</div>
          <AskBox hr={hr} personId={me.id} />
        </div>
      </div>
      <div className="grid">
        <div className="card s6">
          <div className="card-head"><h2>{tr('Your goals')}</h2><div className="spacer" /><button className="btn sm ghost" onClick={() => go('goals')}>{tr('All goals')} <Icon name="arrow" size={14} /></button></div>
          {goals.length === 0 ? <Empty title={tr('No goals yet')} text={tr('You agree your 30, 60 and 90-day goals with your manager in the first week.')} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {goals.map((g) => {
                const p = goalProgress(data, g.id);
                const parent = data.goals.find((x) => x.id === g.parentId);
                return (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 6 }}><span className="ink">{g.title}</span><b className="ink num">{p}%</b></div>
                    <Bar value={p} />
                    {parent && <div className="sub" style={{ marginTop: 4 }}>{tr('Counts toward: {0}', { 0: parent.title })}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card tight s6">
          <div className="card-head"><h2>{tr('Your kit')}</h2></div>
          {kit.length === 0 ? <Empty title={tr('No kit on record')} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {kit.map((r) => {
                const risk = kitRisk(data, r, t);
                return (
                  <div key={r.id} className="row" style={{ cursor: 'default' }}>
                    <Icon name={data.kitItems.find((i) => i.id === r.itemId)?.category === 'access' ? 'grid' : 'laptop'} />
                    <div className="grow"><div className="t">{itemName(data, r.itemId)}</div><div className="sub">{r.status === 'delivered' || r.status === 'ready' ? KIT_LABEL[r.status] : tr('Needed by {0}', { 0: fmtDay(r.neededBy) })}</div></div>
                    <span className={`pill ${r.status === 'delivered' || r.status === 'ready' ? 'pos' : risk === 'late' ? 'neg' : risk === 'at_risk' ? 'warn' : ''}`}>{r.status === 'delivered' || r.status === 'ready' ? tr('Ready') : risk === 'late' ? tr('Late') : tr('On the way')}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }} onClick={() => go('timeoff')} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('timeoff')}>
            <Icon name="calendar" /><div className="grow"><div className="t">{tr('{0} vacation days left this year', { 0: balance.left })}</div><div className="sub">{tr('Book time off')}</div></div><Icon name="arrow" size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ask a question and see the answer with its source. Used on My Meridian and on the Ask HR page. */
export function AskBox({ hr, personId }: { hr: People; personId: string }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  const last = hr.data.hrQuestions.find((x) => x.id === lastId && x.personId === personId);
  const ask = () => {
    if (!q.trim()) return;
    const r = hr.ask(personId, q.trim());
    setLastId(r.question.id); setQ('');
    if (r.question.status === 'to_hr') toast(tr('Sent to HR. A person will answer.'), r.undo);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); ask(); }} style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('How many vacation days do I have?')} aria-label={tr('Your question for HR')} style={{ flex: 1 }} />
        <button className="btn" type="submit" disabled={!q.trim()}><Icon name="sparkle" size={16} />{tr('Ask')}</button>
      </form>
      {last && <Answer hr={hr} q={last} />}
      {!last && <p className="sub" style={{ margin: 0 }}>{AI_NOTE}</p>}
    </div>
  );
}

function Answer({ hr, q }: { hr: People; q: HrQuestion }) {
  const toast = useToast();
  return (
    <div className="thread">
      <div className="bubble us">{q.q}</div>
      <div className="draft">
        <div className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><Icon name="sparkle" size={14} />{tr('Ask HR · AI answer')}</div>
        <div className="ink" style={{ whiteSpace: 'pre-wrap' }}>{q.answer.text}</div>
        {q.answer.sources.length > 0 && <div className="sub" style={{ marginTop: 8 }}>{tr('Source')}: {q.answer.sources.map((s) => `${s.title}, v${s.version}`).join('; ')}</div>}
        {q.hrReply && <div className="bubble" style={{ marginTop: 10, maxWidth: '100%' }}><span className="who">{q.repliedBy} · {tr('HR')}</span>{q.hrReply}</div>}
        {q.status === 'answered' && (
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => toast(tr('Thanks'), hr.rateAnswer(q.id, true))}><Icon name="check" size={14} />{tr('That helps')}</button>
            <button className="btn sm ghost" onClick={() => toast(tr('Sent to HR. A person will answer.'), hr.rateAnswer(q.id, false))}>{tr('Ask a person instead')}</button>
          </div>
        )}
        {q.status === 'to_hr' && !q.hrReply && <div className="sub" style={{ marginTop: 8 }}>{tr('Sent to HR. A person will answer.')}</div>}
      </div>
    </div>
  );
}

// ---------------- Journeys ----------------

export function Journeys({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [owner, setOwner] = useState<'all' | JourneyOwner>('all');
  const [start, setStart] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const active = data.journeys.filter((j) => !journeyProgress(data, j, t).finished);
  const done = data.journeys.filter((j) => journeyProgress(data, j, t).finished);
  const missing = needsJourney(data, t);
  const late = active.reduce((s, j) => s + journeyProgress(data, j, t).overdue.length, 0);
  return (
    <div className="page">
      <Head eyebrow={tr('People+ · Onboard')} title={active.length ? tr('{0} in progress, {1} late.', { 0: plural(active.length, 'journey'), 1: plural(late, 'step') }) : tr('No one is onboarding right now.')}
        lede={tr('One journey per new hire, from the welcome page to the end of probation. Every step has an owner and a day counted from the start date. Hire someone and their journey starts by itself.')}>
        <button className="btn primary" onClick={() => setStart(missing[0]?.id ?? '')}><Icon name="plus" size={16} />{tr('Start a journey')}</button>
      </Head>
      {missing.length > 0 && (
        <div className="card tight">
          <div className="card-head"><h2>{tr('Joining soon without a journey')}</h2></div>
          <div className="rows">
            {missing.map((p) => (
              <div key={p.id} className="row" style={{ cursor: 'default' }}>
                <Avatar name={p.name} size="sm" /><div className="grow"><div className="t">{p.name}</div><div className="sub">{p.title} · {tr('Starts {0}', { 0: fmtDay(p.startDate) })}</div></div>
                <button className="btn sm" onClick={() => setStart(p.id)}>{tr('Start journey')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="seg" role="group" aria-label={tr('Owner')}>
          {(['all', 'hr', 'manager', 'it', 'buddy', 'newcomer'] as const).map((o) => <button key={o} aria-pressed={owner === o} onClick={() => setOwner(o)}>{o === 'all' ? tr('Everyone') : JOURNEY_OWNER[o]}</button>)}
        </div>
      </div>
      {active.length === 0 && <div className="card"><Empty title={tr('No journeys in progress')} text={tr('Start one for a new hire, or hire someone from the Hiring board.')} /></div>}
      {active.map((j) => {
        const p = data.people.find((x) => x.id === j.personId);
        if (!p) return null;
        const pr = journeyProgress(data, j, t);
        const now = pr.phase;
        return (
          <div key={j.id} className="card">
            <div className="card-head">
              <Avatar name={p.name} />
              <div className="grow">
                <h2 style={{ fontSize: 16 }}><button className="link" onClick={() => onPerson(p.id)}>{p.name}</button></h2>
                <div className="sub">{p.title} · {pr.day < 0 ? tr('Starts {0}', { 0: fmtDay(j.startDate) }) : tr('Day {0} of 90', { 0: pr.day })} · {tr('Buddy')}: {nameOf(data, j.buddyId)}</div>
              </div>
              {pr.overdue.length > 0 && <span className="pill neg">{plural(pr.overdue.length, 'late step')}</span>}
              <div className="ring" style={{ ['--p' as string]: pr.percent }} data-v={`${pr.done}/${pr.total}`} />
              <Menu items={[
                { label: tr('Add a step'), icon: 'plus', onClick: () => setAddTo(j.id) },
                ...data.people.filter((x) => x.team === p.team && x.id !== p.id && x.id !== j.buddyId && !x.lastDay).slice(0, 4).map((x) => ({ label: tr('Make {0} the buddy', { 0: firstName(x.name) }), icon: 'people', onClick: () => toast(tr('Buddy changed'), hr.setBuddy(j.id, x.id)) })),
                'divider',
                { label: tr('Remove journey'), icon: 'trash', danger: true, onClick: () => toast(tr('Journey removed'), hr.deleteJourney(j.id)) },
              ]} />
            </div>
            <div className="chip" style={{ marginBottom: 12 }} data-tip={tr('The Journey builder picks the template for the team, adds a step for each document to sign and each kit item to get ready. You can change any step.')} tabIndex={0}><Icon name="sparkle" size={14} />{tr('Journey builder')}: {j.builtFrom.join(' · ')}</div>
            <div className="grid">
              {PHASES.map((ph) => {
                const steps = j.steps.filter((s) => phaseOf(s.day) === ph && (owner === 'all' || s.owner === owner));
                return (
                  <div key={ph} className="s4" style={{ minWidth: 0 }}>
                    <div className="section-title" style={{ color: ph === now ? 'var(--accent)' : undefined }}>{PHASE_LABEL[ph]}</div>
                    {steps.length === 0 ? <div className="sub">{tr('Nothing here')}</div> : (
                      <div className="rows">
                        {steps.map((s) => {
                          const isDone = isStepDone(data, s);
                          const due = stepDue(j, s);
                          const auto = Boolean(s.docId || s.kitId);
                          return (
                            <label key={s.id} className="row" style={{ cursor: auto ? 'default' : 'pointer' }} data-tip={auto ? (s.docId ? tr('Ticks itself when the document is signed') : tr('Ticks itself when the IT desk marks the item ready')) : undefined}>
                              <input type="checkbox" checked={isDone} disabled={auto} onChange={() => toast(s.done ? tr('Reopened') : tr('Done'), hr.toggleStep(j.id, s.id))} />
                              <div className="grow"><div className="t" style={isDone ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{s.text}</div><div className="sub">{JOURNEY_OWNER[s.owner]} · {fmtDay(due)}</div></div>
                              {!isDone && due < t && <span className="pill neg">{tr('Late')}</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <Disclose title={tr('Templates')}>
        <div className="rows">
          {data.journeyTemplates.map((tpl) => (
            <div key={tpl.id} className="row" style={{ cursor: 'default' }}>
              <Icon name="route" /><div className="grow"><div className="t">{tpl.name}</div><div className="sub">{tpl.teams.length ? tpl.teams.join(', ') : tr('Any team')} · {plural(tpl.steps.length, 'step')}</div></div>
            </div>
          ))}
        </div>
      </Disclose>
      {done.length > 0 && <Disclose title={tr('Finished journeys ({0})', { 0: done.length })}><div className="rows">{done.map((j) => <div key={j.id} className="row" onClick={() => onPerson(j.personId)}><Avatar name={nameOf(data, j.personId)} size="sm" /><div className="grow"><div className="t">{nameOf(data, j.personId)}</div><div className="sub">{tr('Started {0}', { 0: fmtDay(j.startDate) })}</div></div></div>)}</div></Disclose>}
      {start !== null && <StartJourney hr={hr} personId={start} onClose={() => setStart(null)} />}
      {addTo && <AddStep hr={hr} journeyId={addTo} onClose={() => setAddTo(null)} />}
    </div>
  );
}

function StartJourney({ hr, personId, onClose }: { hr: People; personId: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const candidates = data.people.filter((p) => !p.lastDay && p.startDate >= addDays(t, -90));
  const [pid, setPid] = useState(personId || candidates[0]?.id || '');
  const person = data.people.find((p) => p.id === pid);
  const [tpl, setTpl] = useState('');
  const [buddy, setBuddy] = useState<string | null>(null);
  const template = data.journeyTemplates.find((x) => x.id === tpl) ?? (person && pickTemplate(data.journeyTemplates, person));
  const suggested = person && suggestBuddy(data, person, t);
  const buddyId = buddy ?? suggested?.id ?? '';
  const kit = person ? kitFor(data, person).filter((i) => !data.kitRequests.some((r) => r.personId === person.id && r.itemId === i.id && r.status !== 'returned')) : [];
  const replaces = data.journeys.some((j) => j.personId === pid);
  return (
    <Panel title={tr('Start a journey')} eyebrow={tr('People+ · Onboard')} onClose={onClose}>
      <div className="form">
        <Field label={tr('New hire')} id="sj-p"><PersonSelect id="sj-p" people={candidates} value={pid} onChange={(v) => { setPid(v); setTpl(''); setBuddy(null); }} /></Field>
        <Field label={tr('Template')} id="sj-t"><select id="sj-t" value={template?.id ?? ''} onChange={(e) => setTpl(e.target.value)}>{data.journeyTemplates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label={tr('Buddy')} id="sj-b" tip={tr('Suggested: same team, not their manager, here six months or more, with the fewest buddy jobs right now.')}>
          <PersonSelect id="sj-b" people={data.people.filter((p) => p.id !== pid && !p.lastDay)} value={buddyId} onChange={setBuddy} none={tr('No buddy')} />
        </Field>
        {person && template && (
          <div className="draft">
            <div className="sub" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><Icon name="sparkle" size={14} />{tr('Journey builder')}</div>
            <div className="ink">{tr('{0} from the {1} template, starting {2}.', { 0: plural(template.steps.length, 'step'), 1: template.name, 2: fmtDay(person.startDate) })}</div>
            {kit.length > 0 && <div className="sub" style={{ marginTop: 6 }}>{tr('The Kit agent will request: {0}.', { 0: kit.map((i) => i.name).join(', ') })}</div>}
            {replaces && <div className="sub" style={{ marginTop: 6, color: 'var(--warn)' }}>{tr('This replaces their current journey.')}</div>}
          </div>
        )}
        <div><button className="btn primary" disabled={!person || !template} onClick={() => { toast(tr('Journey started for {0}', { 0: person!.name }), hr.startJourney(pid, template!.id, buddyId)); onClose(); }}><Icon name="check" size={16} />{tr('Start journey')}</button></div>
      </div>
    </Panel>
  );
}

function AddStep({ hr, journeyId, onClose }: { hr: People; journeyId: string; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [owner, setOwner] = useState<JourneyOwner>('manager');
  const [day, setDay] = useState('7');
  return (
    <Panel title={tr('Add a step')} eyebrow={nameOf(hr.data, hr.data.journeys.find((j) => j.id === journeyId)?.personId)} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; toast(tr('Step added'), hr.addStep(journeyId, { text: text.trim(), owner, day: Number(day) || 0, kind: 'task' })); onClose(); }}>
        <Field label={tr('What')} id="as-t"><input id="as-t" className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="row2">
          <Field label={tr('Owner')} id="as-o"><select id="as-o" value={owner} onChange={(e) => setOwner(e.target.value as JourneyOwner)}>{(Object.keys(JOURNEY_OWNER) as JourneyOwner[]).map((o) => <option key={o} value={o}>{JOURNEY_OWNER[o]}</option>)}</select></Field>
          <Field label={tr('Day')} id="as-d" tip={tr('Days from the start date. Use a minus for before the first day.')}><input id="as-d" className="input" type="number" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        </div>
        <div><button className="btn primary" type="submit" disabled={!text.trim()}><Icon name="plus" size={16} />{tr('Add step')}</button></div>
      </form>
    </Panel>
  );
}

// ---------------- IT desk ----------------

export function ItDesk({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const [asking, setAsking] = useState(false);
  const open = data.kitRequests.filter((r) => r.status !== 'returned' && r.status !== 'delivered');
  const risky = open.filter((r) => kitRisk(data, r, t) !== 'ok');
  const collect = kitToReturn(data, t);
  const month = data.kitRequests.filter((r) => r.history[0]?.at >= addDays(t, -30));
  const need = risky.length + collect.length;
  const tile = (r: KitRequest) => {
    const risk = kitRisk(data, r, t);
    const next = nextKitStatus(r.status);
    return (
      <div key={r.id} className="tile" style={{ cursor: 'default' }}>
        <div className="tt">{itemName(data, r.itemId)}</div>
        <div className="meta"><button className="link" onClick={() => onPerson(r.personId)}>{nameOf(data, r.personId)}</button><span>{tr('by {0}', { 0: fmtDay(r.neededBy) })}</span></div>
        <div className="meta">
          {risk === 'late' ? <span className="pill neg">{tr('Late')}</span> : risk === 'at_risk' ? <span className="pill warn" data-tip={tr('The supplier lead time no longer fits before the day it is needed.')} tabIndex={0}>{tr('At risk')}</span> : <span />}
          {next && <button className="btn sm" onClick={() => toast(KIT_LABEL[next], hr.moveKit(r.id, next))}>{KIT_LABEL[next]} <Icon name="arrow" size={12} /></button>}
        </div>
        <div className="menu-at"><Menu items={[
          ...KIT_FLOW.filter((s) => s !== r.status).map((s) => ({ label: tr('Mark as {0}', { 0: KIT_LABEL[s].toLowerCase() }), onClick: () => toast(KIT_LABEL[s], hr.moveKit(r.id, s)) })),
          'divider',
          { label: tr('Cancel request'), icon: 'trash', danger: true, onClick: () => toast(tr('Request cancelled'), hr.cancelKit(r.id)) },
        ]} /></div>
      </div>
    );
  };
  return (
    <div className="page">
      <Head eyebrow={tr('People+ · Onboard')} title={need ? tr('{0} need you.', { 0: plural(need, 'item') }) : tr('All kit is on time.')}
        lede={tr('When someone is hired, the Kit agent requests their role kit and accounts, due before their first day. Move each item along as it is ordered, ready and handed over. Leavers’ kit and access come back here too.')}>
        <button className="btn primary" onClick={() => setAsking(true)}><Icon name="plus" size={16} />{tr('Request an item')}</button>
      </Head>
      <div className="grid">
        <Stat label={tr('Open requests')} value={open.length} sub={risky.length ? tr('{0} late or at risk', { 0: risky.length }) : tr('All on time')} span="s4" />
        <Stat label={tr('Spent in 30 days')} value={money(kitCost(data, month))} sub={plural(month.length, 'item')} span="s4" tip={tr('List price of everything requested in the last 30 days.')} />
        <Stat label={tr('To collect')} value={collect.length} sub={tr('From people leaving in 30 days')} span="s4" />
      </div>
      <div className="board" role="list" aria-label={tr('Kit requests by status')}>
        {KIT_FLOW.map((s) => {
          const xs = data.kitRequests.filter((r) => r.status === s && (s !== 'delivered' || (r.history.at(-1)?.at ?? '') >= addDays(t, -14)));
          return (
            <div key={s} className="col" role="listitem">
              <div className="col-head"><b>{KIT_LABEL[s]}</b><span className="sub">{xs.length}</span></div>
              {xs.length === 0 ? <div className="sub" style={{ padding: 4 }}>{tr('Nothing here')}</div> : xs.map(tile)}
            </div>
          );
        })}
      </div>
      <div className="grid">
        <div className="card tight s6">
          <div className="card-head"><h2>{tr('To collect from leavers')}</h2></div>
          {collect.length === 0 ? <Empty title={tr('No one is leaving soon')} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {collect.map(({ person, request }) => (
                <div key={request.id} className="row" style={{ cursor: 'default' }}>
                  <Avatar name={person.name} size="sm" />
                  <div className="grow"><div className="t">{itemName(data, request.itemId)}{request.serial ? ` · ${request.serial}` : ''}</div><div className="sub">{person.name} · {tr('Last day {0}', { 0: fmtDay(person.lastDay!) })}</div></div>
                  <button className="btn sm" onClick={() => toast(data.kitItems.find((i) => i.id === request.itemId)?.category === 'access' ? tr('Access removed') : tr('Returned'), hr.moveKit(request.id, 'returned'))}>
                    {data.kitItems.find((i) => i.id === request.itemId)?.category === 'access' ? tr('Remove access') : tr('Mark returned')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card tight s6">
          <div className="card-head"><h2>{tr('Role kits')}</h2></div>
          <div className="rows" style={{ marginTop: 8 }}>
            {data.roleKits.map((k) => (
              <div key={k.team} className="row" style={{ cursor: 'default' }}>
                <Icon name="laptop" /><div className="grow"><div className="t">{k.team === '*' ? tr('Everyone') : k.team}</div><div className="sub">{k.itemIds.map((id) => itemName(data, id)).join(', ')}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {asking && <RequestItem hr={hr} onClose={() => setAsking(false)} />}
    </div>
  );
}

function RequestItem({ hr, onClose }: { hr: People; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const people = data.people.filter((p) => !p.lastDay);
  const [pid, setPid] = useState(people[0]?.id ?? '');
  const [item, setItem] = useState(data.kitItems[0]?.id ?? '');
  const [by, setBy] = useState(addDays(todayIso(), 7));
  return (
    <Panel title={tr('Request an item')} eyebrow={tr('IT desk')} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); toast(tr('Requested'), hr.requestKit(pid, item, by)); onClose(); }}>
        <Field label={tr('For')} id="ri-p"><PersonSelect id="ri-p" people={people} value={pid} onChange={setPid} /></Field>
        <Field label={tr('Item')} id="ri-i"><select id="ri-i" value={item} onChange={(e) => setItem(e.target.value)}>{data.kitItems.map((i) => <option key={i.id} value={i.id}>{i.name}{i.cost ? ` · ${money(i.cost)}` : ''}</option>)}</select></Field>
        <Field label={tr('Needed by')} id="ri-d"><input id="ri-d" className="input" type="date" value={by} onChange={(e) => setBy(e.target.value)} /></Field>
        <div><button className="btn primary" type="submit" disabled={!pid || !item}><Icon name="check" size={16} />{tr('Request')}</button></div>
      </form>
    </Panel>
  );
}

// ---------------- Ask HR ----------------

const Q_LABEL: Record<HrQuestion['status'], string> = { answered: tr('Answered'), helpful: tr('Helped'), to_hr: tr('For HR'), closed: tr('HR replied') };

export function AskHr({ hr, onPerson }: { hr: People; onPerson: (id: string) => void }) {
  const toast = useToast();
  const { data } = hr;
  const inbox = hrInbox(data);
  const [as, setAs] = useState(data.journeys[0]?.personId ?? data.people[0]?.id ?? '');
  const [reply, setReply] = useState<Record<string, string>>({});
  const topics = topTopics(data);
  const answered = data.hrQuestions.filter((q) => q.answer.kind !== 'none').length;
  const all = [...data.hrQuestions].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="page">
      <Head eyebrow={tr('People+ · Onboard')} title={inbox.length ? tr('{0} waiting for HR.', { 0: plural(inbox.length, 'question') }) : tr('Ask HR answered everything.')} lede={AI_NOTE} />
      <div className="grid">
        <div className="card tight s7">
          <div className="card-head"><h2>{tr('Waiting for HR')}</h2></div>
          {inbox.length === 0 ? <Empty title={tr('Nothing waiting')} text={tr('Questions Ask HR could not answer, or that someone wanted a person for, land here.')} /> : (
            <div className="rows" style={{ marginTop: 8 }}>
              {inbox.map((q) => (
                <div key={q.id} className="row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <Avatar name={nameOf(data, q.personId)} size="sm" />
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div><div className="t">{q.q}</div><div className="sub"><button className="link" onClick={() => onPerson(q.personId)}>{nameOf(data, q.personId)}</button> · {fmtDay(q.at)}</div></div>
                    <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); const text = reply[q.id]?.trim(); if (!text) return; toast(tr('Reply sent'), hr.replyHr(q.id, text)); setReply({ ...reply, [q.id]: '' }); }}>
                      <input className="input" style={{ flex: 1 }} value={reply[q.id] ?? ''} onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} placeholder={tr('Your answer')} aria-label={tr('Your answer')} />
                      <button className="btn sm" type="submit" disabled={!reply[q.id]?.trim()}>{tr('Reply')}</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card s5">
          <div className="card-head"><h2>{tr('Try it')}</h2></div>
          <div className="toolbar" style={{ marginBottom: 10 }}><span className="sub">{tr('Ask as')}</span><div className="field" style={{ minWidth: 200, flex: 1 }}><PersonSelect id="ah-as" people={data.people.filter((p) => !p.lastDay)} value={as} onChange={setAs} /></div></div>
          <AskBox key={as} hr={hr} personId={as} />
        </div>
      </div>
      <div className="grid">
        <Stat label={tr('Answered with a source')} value={data.hrQuestions.length ? `${Math.round((answered / data.hrQuestions.length) * 100)}%` : '—'} sub={tr('{0} of {1}', { 0: answered, 1: data.hrQuestions.length })} span="s4" />
        <div className="card s8">
          <div className="card-head"><h2 data-tip={tr('Words that come up in more than one question. A topic here may need a clearer policy.')} tabIndex={0}>{tr('What people ask about')}</h2></div>
          {topics.length === 0 ? <div className="sub">{tr('Not enough questions yet.')}</div> : <div className="toolbar">{topics.map((x) => <span key={x.term} className="chip">{x.word} · {x.n}</span>)}</div>}
        </div>
      </div>
      <Disclose title={tr('All questions ({0})', { 0: all.length })}>
        <div className="rows">
          {all.map((q) => (
            <div key={q.id} className="row" style={{ cursor: 'default' }}>
              <Icon name="chat" />
              <div className="grow"><div className="t">{q.q}</div><div className="sub">{nameOf(data, q.personId)} · {fmtDay(q.at)}{q.answer.sources[0] ? ` · ${q.answer.sources[0].title}` : ''}</div></div>
              <span className={`pill ${q.status === 'to_hr' ? 'warn' : q.status === 'helpful' || q.status === 'closed' ? 'pos' : ''}`}>{Q_LABEL[q.status]}</span>
            </div>
          ))}
        </div>
      </Disclose>
    </div>
  );
}
