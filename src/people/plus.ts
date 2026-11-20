import { tr } from '../platform/i18n';
import { HrDocument, ISODate, Id, PeopleData, Person, addDays, docsToAcknowledge, leaveBalance, lvFixedHolidays } from './domain';
// People+ phase 1 (Onboard): journeys, the IT desk and Ask HR. Pure rules, unit-tested; pages only call these.
// The "agents" here are deterministic rules that draft work for a person to approve. Hosted tenants can swap
// the Ask HR matcher for a Claude call with the same inputs and outputs; the page and the log stay the same.

// ---------- journeys ----------

export type JourneyOwner = 'hr' | 'manager' | 'it' | 'buddy' | 'newcomer';
export type StepKind = 'task' | 'sign' | 'training' | 'meet' | 'kit' | 'goal';
export type JourneyPhase = 'preboard' | 'day1' | 'first90';
export const PHASES: JourneyPhase[] = ['preboard', 'day1', 'first90'];
export const JOURNEY_DAYS = 90;

export interface StepTemplate { text: string; owner: JourneyOwner; day: number; kind: StepKind; minutes?: number }
export interface JourneyTemplate { id: Id; name: string; teams: string[]; steps: StepTemplate[] } // teams empty = any team
export interface JourneyStep extends StepTemplate { id: Id; done: boolean; doneAt?: ISODate; doneBy?: string; docId?: Id; kitId?: Id }
export interface Journey { id: Id; personId: Id; templateId: Id; startDate: ISODate; buddyId?: Id; steps: JourneyStep[]; builtFrom: string[] }

export const DEFAULT_JOURNEY: StepTemplate[] = [
  { text: tr('Send the welcome page and first-week plan'), owner: 'hr', day: -10, kind: 'task' },
  { text: tr('Pick a buddy and plan the first week'), owner: 'manager', day: -7, kind: 'task' },
  { text: tr('Create accounts and set up the laptop'), owner: 'it', day: -3, kind: 'task' },
  { text: tr('Welcome, tour and meet the team'), owner: 'manager', day: 0, kind: 'meet' },
  { text: tr('Check that the laptop and logins work'), owner: 'it', day: 0, kind: 'task' },
  { text: tr('Coffee with your buddy'), owner: 'buddy', day: 0, kind: 'meet' },
  { text: tr('Company story and values'), owner: 'newcomer', day: 1, kind: 'training', minutes: 20 },
  { text: tr('GDPR basics'), owner: 'newcomer', day: 2, kind: 'training', minutes: 12 },
  { text: tr('Safety briefing'), owner: 'hr', day: 2, kind: 'training', minutes: 15 },
  { text: tr('Agree 30, 60 and 90-day goals'), owner: 'manager', day: 5, kind: 'goal' },
  { text: tr('First week check-in'), owner: 'manager', day: 7, kind: 'meet' },
  { text: tr('30-day check-in'), owner: 'manager', day: 30, kind: 'meet' },
  { text: tr('Tell us how onboarding went'), owner: 'newcomer', day: 30, kind: 'task', minutes: 5 },
  { text: tr('End of probation talk'), owner: 'manager', day: 85, kind: 'meet' },
];

export const STUDIO_JOURNEY: StepTemplate[] = [
  ...DEFAULT_JOURNEY,
  { text: tr('Design system and file structure walkthrough'), owner: 'buddy', day: 1, kind: 'training', minutes: 45 },
  { text: tr('Shadow a client meeting'), owner: 'newcomer', day: 10, kind: 'meet' },
  { text: tr('Own a first small client task'), owner: 'newcomer', day: 21, kind: 'goal' },
];

export const SALES_JOURNEY: StepTemplate[] = [
  ...DEFAULT_JOURNEY,
  { text: tr('CRM walkthrough: deals, follow-ups and service'), owner: 'buddy', day: 1, kind: 'training', minutes: 40 },
  { text: tr('Listen in on five client calls'), owner: 'newcomer', day: 10, kind: 'meet' },
  { text: tr('Take over your first accounts'), owner: 'manager', day: 30, kind: 'goal' },
];

export const phaseOf = (day: number): JourneyPhase => (day < 0 ? 'preboard' : day === 0 ? 'day1' : 'first90');
export const byDay = (a: { day: number }, b: { day: number }) => a.day - b.day;

/** The template for a person's team, or the one for any team. */
export function pickTemplate(templates: JourneyTemplate[], person: Person): JourneyTemplate | undefined {
  return templates.find((t) => t.teams.includes(person.team)) ?? templates.find((t) => t.teams.length === 0);
}

/**
 * The Journey builder: the team's template, a "read and sign" step for each document the person still owes,
 * and an IT step for each piece of their role kit. Due days count from the start date.
 */
export function buildJourney(data: PeopleData, person: Person, template: JourneyTemplate, id: Id, buddyId?: Id): Journey {
  const docs = docsToAcknowledge(data, person.id);
  const kit = data.kitRequests.filter((k) => k.personId === person.id && k.status !== 'returned');
  const steps: JourneyStep[] = [
    ...template.steps.map((s, i) => ({ ...s, id: `${id}_t${i}`, done: false })),
    ...docs.map((d, i) => ({
      id: `${id}_d${i}`, text: tr('Read and sign: {0}', { 0: d.title }), owner: 'newcomer' as const, day: d.kind === 'contract' ? -7 : 3,
      kind: 'sign' as const, done: false, docId: d.id,
    })),
    ...kit.map((k, i) => ({
      id: `${id}_k${i}`, text: tr('Get ready: {0}', { 0: itemName(data, k.itemId) }), owner: 'it' as const, day: dayBetween(person.startDate, k.neededBy),
      kind: 'kit' as const, done: false, kitId: k.id,
    })),
  ].sort(byDay);
  const builtFrom = [tr('Template: {0}', { 0: template.name })];
  if (docs.length) builtFrom.push(tr('{0} to sign', { 0: docs.length === 1 ? tr('1 document') : tr('{0} documents', { 0: docs.length }) }));
  if (kit.length) builtFrom.push(tr('{0} from the role kit', { 0: kit.length === 1 ? tr('1 item') : tr('{0} items', { 0: kit.length }) }));
  return { id, personId: person.id, templateId: template.id, startDate: person.startDate, buddyId, steps, builtFrom };
}

/** Whole days from a to b (negative when b is earlier). */
export function dayBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export const stepDue = (j: Journey, s: StepTemplate) => addDays(j.startDate, s.day);

/** A sign step is done once the current version is acknowledged; a kit step once the item is ready or delivered. */
export function isStepDone(data: PeopleData, s: JourneyStep): boolean {
  if (s.docId) {
    const doc = data.documents.find((d) => d.id === s.docId);
    if (doc) return doc.acks.some((a) => a.personId === journeyPersonOf(data, s) && a.version === doc.version);
  }
  if (s.kitId) {
    const k = data.kitRequests.find((x) => x.id === s.kitId);
    if (k) return k.status === 'ready' || k.status === 'delivered';
  }
  return s.done;
}
function journeyPersonOf(data: PeopleData, s: JourneyStep) { return data.journeys.find((j) => j.steps.some((x) => x.id === s.id))?.personId; }

/** "Day 3 of 90": the start date is day 1. Before the start it is the days still to go, as a negative number. */
export function journeyDay(j: Journey, today: ISODate): number {
  const d = dayBetween(j.startDate, today);
  return d >= 0 ? d + 1 : d;
}

export interface JourneyProgress { done: number; total: number; overdue: JourneyStep[]; phase: JourneyPhase; next?: JourneyStep; percent: number; day: number; finished: boolean }
export function journeyProgress(data: PeopleData, j: Journey, today: ISODate): JourneyProgress {
  const open = j.steps.filter((s) => !isStepDone(data, s));
  const done = j.steps.length - open.length;
  const day = journeyDay(j, today);
  const offset = dayBetween(j.startDate, today);
  return {
    done, total: j.steps.length, day,
    overdue: open.filter((s) => stepDue(j, s) < today),
    phase: phaseOf(offset < 0 ? -1 : offset === 0 ? 0 : 1),
    next: [...open].sort(byDay)[0],
    percent: j.steps.length ? Math.round((done / j.steps.length) * 100) : 100,
    finished: open.length === 0 || offset >= JOURNEY_DAYS,
  };
}

/** Open steps one owner has across journeys, due within `days` from today (late ones first). */
export function stepsFor(data: PeopleData, owner: JourneyOwner, today: ISODate, days = 7, onlyPersonId?: Id) {
  const limit = addDays(today, days);
  return data.journeys
    .filter((j) => !onlyPersonId || j.personId === onlyPersonId)
    .flatMap((j) => j.steps.filter((s) => s.owner === owner && !isStepDone(data, s) && stepDue(j, s) <= limit).map((s) => ({ journey: j, step: s, due: stepDue(j, s), late: stepDue(j, s) < today })))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Steps a buddy owns belong to the buddy named on the journey. */
export function buddySteps(data: PeopleData, buddyId: Id, today: ISODate, days = 7) {
  return stepsFor(data, 'buddy', today, days).filter((x) => x.journey.buddyId === buddyId);
}

/** People who start in the next `ahead` days or started in the last 90 and have no journey yet. */
export function needsJourney(data: PeopleData, today: ISODate, ahead = 60): Person[] {
  const has = new Set(data.journeys.map((j) => j.personId));
  return data.people.filter((p) => !has.has(p.id) && !p.lastDay && p.startDate <= addDays(today, ahead) && p.startDate >= addDays(today, -JOURNEY_DAYS));
}

/** Suggest a buddy: same team, not the manager, here at least 6 months, fewest current buddy jobs. */
export function suggestBuddy(data: PeopleData, person: Person, today: ISODate): Person | undefined {
  const load = (id: Id) => data.journeys.filter((j) => j.buddyId === id && dayBetween(j.startDate, today) < JOURNEY_DAYS).length;
  return data.people
    .filter((p) => p.id !== person.id && p.id !== person.managerId && p.team === person.team && !p.lastDay && p.startDate <= addDays(today, -182))
    .sort((a, b) => load(a.id) - load(b.id) || b.startDate.localeCompare(a.startDate))[0];
}

// ---------- IT desk ----------

export type KitCategory = 'laptop' | 'screen' | 'phone' | 'access' | 'other';
export type KitStatus = 'requested' | 'ordered' | 'ready' | 'delivered' | 'returned';
export const KIT_FLOW: KitStatus[] = ['requested', 'ordered', 'ready', 'delivered'];
export interface KitItem { id: Id; name: string; category: KitCategory; cost?: number; leadDays: number }
export interface RoleKit { team: string; itemIds: Id[] } // team '*' = everyone
export interface KitRequest { id: Id; personId: Id; itemId: Id; status: KitStatus; neededBy: ISODate; history: { status: KitStatus; at: ISODate; by: string }[]; serial?: string }

export const itemName = (data: PeopleData, itemId: Id) => data.kitItems.find((i) => i.id === itemId)?.name ?? '—';

/** The everyone kit plus the team kit, without duplicates. */
export function kitFor(data: PeopleData, person: Person): KitItem[] {
  const ids = new Set(data.roleKits.filter((k) => k.team === '*' || k.team === person.team).flatMap((k) => k.itemIds));
  return data.kitItems.filter((i) => ids.has(i.id));
}

/** The Kit agent: one request per kit item the person does not already have, needed by the day before the start (accounts: the start). */
export function draftKitRequests(data: PeopleData, person: Person, today: ISODate, newId: (i: number) => Id, by: string): KitRequest[] {
  const have = new Set(data.kitRequests.filter((r) => r.personId === person.id && r.status !== 'returned').map((r) => r.itemId));
  return kitFor(data, person).filter((i) => !have.has(i.id)).map((i, n) => ({
    id: newId(n), personId: person.id, itemId: i.id, status: 'requested' as const,
    neededBy: i.category === 'access' ? person.startDate : addDays(person.startDate, -1),
    history: [{ status: 'requested' as const, at: today, by }],
  }));
}

export function nextKitStatus(s: KitStatus): KitStatus | undefined {
  const i = KIT_FLOW.indexOf(s);
  return i >= 0 && i < KIT_FLOW.length - 1 ? KIT_FLOW[i + 1] : undefined;
}
export function advanceKit(r: KitRequest, to: KitStatus, at: ISODate, by: string): KitRequest {
  return { ...r, status: to, history: [...r.history, { status: to, at, by }] };
}

/** Late: not ready by the day it is needed. At risk: the supplier lead time no longer fits. */
export function kitRisk(data: PeopleData, r: KitRequest, today: ISODate): 'late' | 'at_risk' | 'ok' {
  if (r.status === 'ready' || r.status === 'delivered' || r.status === 'returned') return 'ok';
  if (r.neededBy < today) return 'late';
  const lead = data.kitItems.find((i) => i.id === r.itemId)?.leadDays ?? 0;
  return r.status === 'requested' && addDays(today, lead) > r.neededBy ? 'at_risk' : 'ok';
}

/** Kit and access to take back from people who are leaving within `days` (or already left). */
export function kitToReturn(data: PeopleData, today: ISODate, days = 30): { person: Person; request: KitRequest }[] {
  const limit = addDays(today, days);
  return data.kitRequests
    .filter((r) => r.status === 'delivered' || r.status === 'ready')
    .map((r) => ({ person: data.people.find((p) => p.id === r.personId)!, request: r }))
    .filter((x) => x.person?.lastDay && x.person.lastDay <= limit)
    .sort((a, b) => a.person.lastDay!.localeCompare(b.person.lastDay!));
}

export function kitCost(data: PeopleData, requests: KitRequest[]): number {
  return requests.reduce((s, r) => s + (data.kitItems.find((i) => i.id === r.itemId)?.cost ?? 0), 0);
}

// ---------- Ask HR ----------

export interface Source { docId: Id; title: string; version: number; quote: string }
export interface HrAnswer { kind: 'personal' | 'policy' | 'none'; text: string; sources: Source[] }
export interface HrQuestion {
  id: Id; personId: Id; q: string; at: ISODate; answer: HrAnswer;
  status: 'answered' | 'helpful' | 'to_hr' | 'closed'; hrReply?: string; repliedBy?: string;
}

const STOP = new Set(('the a an and or of to in on for is are do does i my me we our can how what when where who which much many with at by be it '
  + 'this that from as if have has am not no yes es man mans mana mani manas ir un vai kā ko kad kur kas cik par uz ar no pie lai to tas tā ' + 'vari varu var drīkst jā nē').split(' '));
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Lower case, no accents, the first 5 letters: enough to match Latvian word endings and English plurals. */
export const terms = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, 5));

const PERSONAL: { id: 'vacation' | 'manager' | 'buddy' | 'holiday' | 'start'; words: string[] }[] = [
  { id: 'vacation', words: ['vacat', 'holid', 'leave', 'days', 'atval', 'brivd'] },
  { id: 'holiday', words: ['publi', 'svetk', 'bank'] },
  { id: 'manager', words: ['manag', 'boss', 'vadit', 'prieks'] },
  { id: 'buddy', words: ['buddy', 'mento', 'palig', 'budij'] },
  { id: 'start', words: ['start', 'first', 'sakum', 'pirma'] },
];

/** Split a policy body into sentences. */
const sentences = (body: string) => body.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/** Best matching sentences across the policies this person can see, most overlapping words first. */
export function searchPolicies(docs: HrDocument[], q: string, max = 2): (Source & { score: number })[] {
  const want = new Set(terms(q));
  if (!want.size) return [];
  const hits: (Source & { score: number })[] = [];
  for (const d of docs) {
    if (!d.body) continue;
    const title = new Set(terms(d.title));
    for (const s of sentences(d.body)) {
      const have = new Set(terms(s));
      const inText = [...want].filter((w) => have.has(w));
      const matched = [...want].filter((w) => have.has(w) || title.has(w));
      // One shared word is not enough when the question has more: "bike to work" must not match every "work".
      if (!inText.length || matched.length < Math.min(2, want.size)) continue;
      hits.push({ docId: d.id, title: d.title, version: d.version, quote: s, score: inText.length * 2 + matched.length });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, max);
}

/**
 * Ask HR: answers about the person's own numbers first (vacation days, manager, buddy, holidays), then
 * from the company's policies, always with the source and version. If nothing fits it says so and offers HR.
 */
export function askHr(data: PeopleData, personId: Id, q: string, today: ISODate): HrAnswer {
  const person = data.people.find((p) => p.id === personId);
  const words = terms(q);
  const asks = (id: (typeof PERSONAL)[number]['id']) => PERSONAL.find((x) => x.id === id)!.words.some((w) => words.some((x) => x.startsWith(w.slice(0, 5))));
  const policyDocs = data.documents.filter((d) => d.kind === 'policy' && (!d.personId || d.personId === personId));
  const policy = searchPolicies(policyDocs, q);
  const policyText = (hits: Source[]) => hits.map((h) => h.quote).join(' ');

  if (person) {
    if (asks('holiday')) {
      const next = [...lvFixedHolidays(Number(today.slice(0, 4))), ...lvFixedHolidays(Number(today.slice(0, 4)) + 1)].find((d) => d >= today);
      if (next) return { kind: 'personal', text: tr('The next public holiday in Latvia is {0}.', { 0: next }), sources: [] };
    }
    if (asks('vacation') && !words.some((w) => w.startsWith('sick') || w.startsWith('slim'))) {
      const b = leaveBalance(data, personId, Number(today.slice(0, 4)), today);
      const text = tr('You have {0} vacation days left this year: {1} a year, {2} taken, {3} booked and {4} waiting for approval.', { 0: b.left, 1: b.allowance, 2: b.taken, 3: b.booked, 4: b.pending });
      return { kind: 'personal', text: policy.length ? `${text} ${policyText(policy.slice(0, 1))}` : text, sources: policy.slice(0, 1) };
    }
    if (asks('buddy')) {
      const j = data.journeys.find((x) => x.personId === personId);
      const b = data.people.find((p) => p.id === j?.buddyId);
      return { kind: 'personal', text: b ? tr('Your buddy is {0}, {1}.', { 0: b.name, 1: b.title }) : tr('You have no buddy yet. Your manager picks one before your first day.'), sources: [] };
    }
    if (asks('manager')) {
      const m = data.people.find((p) => p.id === person.managerId);
      return { kind: 'personal', text: m ? tr('Your manager is {0}, {1}.', { 0: m.name, 1: m.title }) : tr('You report to the board.'), sources: [] };
    }
    if (asks('start') && !policy.length) {
      return { kind: 'personal', text: tr('Your first day is {0}. Your journey lists what happens before and after it.', { 0: person.startDate }), sources: [] };
    }
  }
  if (policy.length) return { kind: 'policy', text: policyText(policy), sources: policy };
  return { kind: 'none', text: tr('I could not find this in your policies. Send it to HR and a person will answer.'), sources: [] };
}

/** Questions HR should look at: sent on, or answered without a source. */
export const hrInbox = (data: PeopleData) => data.hrQuestions.filter((q) => q.status === 'to_hr');

/** Topics people ask about most, from the words in their questions: a hint about which policy to write or clarify. */
export function topTopics(data: PeopleData, max = 5): { term: string; word: string; n: number }[] {
  const n = new Map<string, number>();
  const word = new Map<string, string>(); // the shortest full word seen for each stem, to show people
  for (const q of data.hrQuestions) {
    const seen = new Set<string>();
    for (const w of q.q.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const [t] = terms(w);
      if (!t || seen.has(t)) continue;
      seen.add(t); n.set(t, (n.get(t) ?? 0) + 1);
      if (!word.has(t) || w.length < word.get(t)!.length) word.set(t, w);
    }
  }
  return [...n].map(([term, c]) => ({ term, word: word.get(term)!, n: c })).filter((x) => x.n > 1).sort((a, b) => b.n - a.n || a.term.localeCompare(b.term)).slice(0, max);
}

// ---------- My Meridian ----------

export interface TodayItem { key: string; text: string; sub: string; kind: StepKind | 'ack'; due?: ISODate; late: boolean; stepRef?: { journeyId: Id; stepId: Id }; docId?: Id }

/** The employee's own list: their journey steps due within a week, and documents they still need to sign. */
export function myToday(data: PeopleData, personId: Id, today: ISODate): TodayItem[] {
  const steps = stepsFor(data, 'newcomer', today, 7, personId).map(({ journey, step, due, late }) => ({
    key: step.id, text: step.text, sub: step.minutes ? tr('{0} min', { 0: step.minutes }) : '', kind: step.kind, due, late,
    stepRef: step.docId ? undefined : { journeyId: journey.id, stepId: step.id }, docId: step.docId,
  }));
  const inJourney = new Set(steps.map((s) => s.docId).filter(Boolean));
  const docs = docsToAcknowledge(data, personId).filter((d) => !inJourney.has(d.id)).map((d) => ({
    key: `doc_${d.id}`, text: tr('Read and sign: {0}', { 0: d.title }), sub: tr('Version {0}', { 0: d.version }), kind: 'ack' as const, late: false, docId: d.id,
  }));
  return [...steps, ...docs];
}

export function greeting(hour: number): string {
  return hour < 12 ? tr('Good morning') : hour < 18 ? tr('Good afternoon') : tr('Good evening');
}
