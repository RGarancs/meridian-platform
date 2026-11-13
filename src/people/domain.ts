// People (HR) domain: pure rules, unit-tested. Pages only call these.
// Latvian defaults where a law sets them (4 weeks = 20 working days paid leave), editable per tenant.

export type Id = string;
export type ISODate = string; // YYYY-MM-DD

export interface Person {
  id: Id;
  name: string;
  email: string;
  title: string;
  team: string;
  managerId?: Id;
  startDate: ISODate;
  location: string;
  leaveAllowance: number; // working days a year
  salary?: number; // gross a month, EUR (visible to HR and the line manager only)
  bonusTarget?: number; // share of annual salary at a full (100%) payout, e.g. 0.1
  lastDay?: ISODate; // set when leaving
}

export type LeaveKind = 'vacation' | 'sick' | 'unpaid' | 'parental' | 'study';
export type LeaveStatus = 'pending' | 'approved' | 'declined';

export interface LeaveRequest {
  id: Id;
  personId: Id;
  kind: LeaveKind;
  from: ISODate;
  to: ISODate; // inclusive
  status: LeaveStatus;
  note?: string;
  decidedBy?: string;
}

export interface ChecklistTask { id: Id; text: string; owner: 'hr' | 'manager' | 'it' | 'newcomer'; dueDay: number; done: boolean }
export interface Onboarding { id: Id; personId: Id; startDate: ISODate; tasks: ChecklistTask[] }

export const CANDIDATE_STAGES = ['applied', 'screen', 'interview', 'offer', 'hired', 'rejected'] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];
export const CANDIDATE_LABEL: Record<CandidateStage, string> = { applied: 'Applied', screen: 'Screen', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' };

export interface Opening { id: Id; title: string; team: string; hiringManagerId?: Id; open: boolean; salaryFrom?: number; salaryTo?: number }
export interface Candidate {
  id: Id; openingId: Id; name: string; email?: string; source: string; stage: CandidateStage;
  appliedAt: ISODate; scores: number[]; // 1 to 5 from each interviewer
  rejectReason?: string;
  retainUntil: ISODate; // GDPR: delete unhired candidates after this date
}

export interface ReviewGoal { text: string; weight: number; score?: number } // weight in %, score 1 to 5
export interface Review { id: Id; personId: Id; cycle: string; goals: ReviewGoal[]; selfDone: boolean; managerDone: boolean }

export type DocKind = 'policy' | 'contract' | 'certificate' | 'form';
export interface HrDocument {
  id: Id; title: string; kind: DocKind; personId?: Id; // no personId = applies to everyone
  version: number; updatedAt: ISODate; requiresAck: boolean; acks: { personId: Id; version: number; at: ISODate }[];
  expires?: ISODate; body?: string;
}

export type GoalLevel = 'company' | 'team' | 'person';
export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'done';
export interface Goal {
  id: Id; title: string; level: GoalLevel; ownerId?: Id; team?: string; parentId?: Id; period: string;
  progress: number; // 0 to 100, own progress when the goal has no children
  status: GoalStatus; checkIns: { at: ISODate; by: string; progress: number; note: string }[];
}

export interface Feedback { id: Id; aboutId: Id; from: string; kind: 'praise' | 'growth'; text: string; at: ISODate; private: boolean }

export interface Skill { id: Id; name: string; area: string }
export interface Training { id: Id; personId: Id; course: string; done: ISODate; expires?: ISODate }
export interface PayBand { title: string; min: number; max: number }
export interface Pulse { id: Id; period: string; scores: number[]; comments: string[] } // eNPS scores 0 to 10, anonymous

export interface PeopleData {
  people: Person[];
  leave: LeaveRequest[];
  onboarding: Onboarding[];
  offboarding: Onboarding[];
  openings: Opening[];
  candidates: Candidate[];
  reviews: Review[];
  documents: HrDocument[];
  goals: Goal[];
  feedback: Feedback[];
  skills: Skill[];
  skillLevels: { personId: Id; skillId: Id; level: number }[]; // 0 none, 1 learning, 2 can do, 3 expert, 4 teaches
  roleSkills: { title: string; skillId: Id; level: number }[]; // what a role needs
  training: Training[];
  bands: PayBand[];
  pulses: Pulse[];
}

export const emptyPeople = (): PeopleData => ({
  people: [], leave: [], onboarding: [], offboarding: [], openings: [], candidates: [], reviews: [], documents: [], goals: [],
  feedback: [], skills: [], skillLevels: [], roleSkills: [], training: [], bands: [], pulses: [],
});

// ---------- dates ----------

const toDate = (d: ISODate) => new Date(`${d.slice(0, 10)}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: ISODate, n: number) => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + n); return iso(x); };

/** Working days (Mon to Fri) between two dates, inclusive, minus the given holidays. */
export function workingDays(from: ISODate, to: ISODate, holidays: ISODate[] = []): number {
  if (to < from) return 0;
  const off = new Set(holidays);
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = toDate(d).getUTCDay();
    if (wd !== 0 && wd !== 6 && !off.has(d)) n++;
  }
  return n;
}

/** Latvian public holidays with fixed dates (Easter-based days are added per year by the tenant). */
export function lvFixedHolidays(year: number): ISODate[] {
  return ['01-01', '05-01', '05-04', '06-23', '06-24', '11-18', '12-24', '12-25', '12-26', '12-31'].map((md) => `${year}-${md}`);
}

// ---------- leave ----------

export interface LeaveBalance { allowance: number; taken: number; booked: number; pending: number; left: number }

/** Vacation balance for a year: approved days already past count as taken, approved future days as booked. */
export function leaveBalance(data: PeopleData, personId: Id, year: number, today: ISODate, holidays: ISODate[] = lvFixedHolidays(year)): LeaveBalance {
  const person = data.people.find((p) => p.id === personId);
  if (!person) throw new Error('No such person.');
  let taken = 0, booked = 0, pending = 0;
  for (const r of data.leave) {
    if (r.personId !== personId || r.kind !== 'vacation') continue;
    const from = r.from < `${year}-01-01` ? `${year}-01-01` : r.from;
    const to = r.to > `${year}-12-31` ? `${year}-12-31` : r.to;
    const days = workingDays(from, to, holidays);
    if (r.status === 'pending') pending += days;
    else if (r.status === 'approved') {
      const past = workingDays(from, to < today ? to : addDays(today, -1), holidays);
      taken += Math.min(past, days);
      booked += days - Math.min(past, days);
    }
  }
  return { allowance: person.leaveAllowance, taken, booked, pending, left: person.leaveAllowance - taken - booked - pending };
}

export function validateLeave(data: PeopleData, r: Omit<LeaveRequest, 'id' | 'status'>, today: ISODate): string[] {
  const errors: string[] = [];
  if (!r.from || !r.to) return ['Choose the first and last day.'];
  if (r.to < r.from) errors.push('The last day is before the first day.');
  if (workingDays(r.from, r.to) === 0) errors.push('These dates hold no working days.');
  const overlap = data.leave.some((x) => x.personId === r.personId && x.status !== 'declined' && x.from <= r.to && r.from <= x.to);
  if (overlap) errors.push('This overlaps leave already requested.');
  if (r.kind === 'vacation') {
    const year = Number(r.from.slice(0, 4));
    const b = leaveBalance(data, r.personId, year, today);
    const days = workingDays(r.from, r.to, lvFixedHolidays(year));
    if (days > b.left) errors.push(`That is ${days} days and only ${b.left} are left this year.`);
  }
  return errors;
}

/** Who else in the same team is away on any of these days: shown to the approver. */
export function teamClashes(data: PeopleData, r: LeaveRequest): Person[] {
  const me = data.people.find((p) => p.id === r.personId);
  if (!me) return [];
  const ids = new Set(
    data.leave.filter((x) => x.id !== r.id && x.status === 'approved' && x.from <= r.to && r.from <= x.to).map((x) => x.personId),
  );
  return data.people.filter((p) => p.id !== me.id && p.team === me.team && ids.has(p.id));
}

export function whoIsAway(data: PeopleData, day: ISODate): { person: Person; request: LeaveRequest }[] {
  return data.leave
    .filter((r) => r.status === 'approved' && r.from <= day && day <= r.to)
    .map((r) => ({ person: data.people.find((p) => p.id === r.personId)!, request: r }))
    .filter((x) => x.person);
}

// ---------- onboarding ----------

export const DEFAULT_ONBOARDING: Omit<ChecklistTask, 'id' | 'done'>[] = [
  { text: 'Send contract and collect signed copy', owner: 'hr', dueDay: -14 },
  { text: 'Order laptop and accounts', owner: 'it', dueDay: -7 },
  { text: 'Pick a buddy and book a first-day lunch', owner: 'manager', dueDay: -3 },
  { text: 'Welcome, tour, meet the team', owner: 'manager', dueDay: 0 },
  { text: 'Safety and data-protection briefing', owner: 'hr', dueDay: 1 },
  { text: 'Agree 30, 60 and 90-day goals', owner: 'manager', dueDay: 5 },
  { text: 'First week check-in', owner: 'manager', dueDay: 7 },
  { text: 'Feedback on onboarding', owner: 'newcomer', dueDay: 30 },
];

export function startOnboarding(personId: Id, startDate: ISODate, id: Id, template = DEFAULT_ONBOARDING): Onboarding {
  return { id, personId, startDate, tasks: template.map((t, i) => ({ ...t, id: `${id}_${i}`, done: false })) };
}

export function onboardingProgress(o: Onboarding, today: ISODate) {
  const done = o.tasks.filter((t) => t.done).length;
  const overdue = o.tasks.filter((t) => !t.done && addDays(o.startDate, t.dueDay) < today);
  return { done, total: o.tasks.length, overdue: overdue.length, nextTask: o.tasks.find((t) => !t.done) };
}

// ---------- hiring ----------

export function moveCandidate(c: Candidate, to: CandidateStage, rejectReason?: string): Candidate {
  if (to === 'rejected' && !rejectReason?.trim()) throw new Error('Say why the candidate was not taken further.');
  if (to === 'offer' && c.scores.length === 0) throw new Error('Score at least one interview before making an offer.');
  return { ...c, stage: to, rejectReason: to === 'rejected' ? rejectReason : undefined };
}

export const averageScore = (c: Candidate) => (c.scores.length ? c.scores.reduce((s, x) => s + x, 0) / c.scores.length : null);

export function hiringFunnel(data: PeopleData, openingId?: Id) {
  const cs = data.candidates.filter((c) => !openingId || c.openingId === openingId);
  return CANDIDATE_STAGES.map((stage) => ({ stage, count: cs.filter((c) => c.stage === stage).length }));
}

/** Candidates whose retention date has passed and who were not hired: delete these. */
export function candidatesToDelete(data: PeopleData, today: ISODate): Candidate[] {
  return data.candidates.filter((c) => c.stage !== 'hired' && c.retainUntil < today);
}

// ---------- reviews ----------

export function validateGoals(goals: ReviewGoal[]): string[] {
  const errors: string[] = [];
  if (goals.length === 0) errors.push('Add at least one goal.');
  const total = goals.reduce((s, g) => s + g.weight, 0);
  if (total !== 100) errors.push(`Goal weights add up to ${total}%, not 100%.`);
  if (goals.some((g) => g.score !== undefined && (g.score < 1 || g.score > 5))) errors.push('Scores run from 1 to 5.');
  return errors;
}

/** Weighted score 1 to 5, or null until every goal is scored. */
export function reviewScore(r: Review): number | null {
  if (r.goals.length === 0 || r.goals.some((g) => g.score === undefined)) return null;
  return Math.round((r.goals.reduce((s, g) => s + g.weight * (g.score ?? 0), 0) / 100) * 10) / 10;
}

/** Bonus as a share of a target: below 3 pays nothing, 3 pays 50%, 4 pays 100%, 5 pays 150%, straight lines between. */
export function bonusMultiplier(score: number | null): number {
  if (score === null || score < 3) return 0;
  if (score <= 4) return 0.5 + (score - 3) * 0.5;
  return Math.min(1.5, 1 + (score - 4) * 0.5);
}

// ---------- directory ----------

export function directReports(data: PeopleData, managerId: Id) { return data.people.filter((p) => p.managerId === managerId); }

export function tenureMonths(p: Person, today: ISODate) {
  const a = toDate(p.startDate), b = toDate(today);
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0));
}

// ---------- documents ----------

/** Documents this person still has to read and acknowledge (current version only). */
export function docsToAcknowledge(data: PeopleData, personId: Id): HrDocument[] {
  return data.documents.filter((d) => d.requiresAck && (!d.personId || d.personId === personId)
    && !d.acks.some((a) => a.personId === personId && a.version === d.version));
}

/** Share of active people who acknowledged the current version of a company-wide document. */
export function ackRate(data: PeopleData, doc: HrDocument, today: ISODate): { done: number; total: number } {
  const people = doc.personId ? data.people.filter((p) => p.id === doc.personId) : activePeople(data, today);
  return { done: people.filter((p) => doc.acks.some((a) => a.personId === p.id && a.version === doc.version)).length, total: people.length };
}

export function expiringSoon(data: PeopleData, today: ISODate, days = 60) {
  const limit = addDays(today, days);
  const docs = data.documents.filter((d) => d.expires && d.expires <= limit).map((d) => ({ title: d.title, personId: d.personId, expires: d.expires!, expired: d.expires! < today }));
  const courses = data.training.filter((t) => t.expires && t.expires <= limit).map((t) => ({ title: t.course, personId: t.personId, expires: t.expires!, expired: t.expires! < today }));
  return [...docs, ...courses].sort((a, b) => a.expires.localeCompare(b.expires));
}

/** A new version clears earlier acknowledgements: everyone reads it again. */
export function publishNewVersion(doc: HrDocument, today: ISODate, body?: string): HrDocument {
  return { ...doc, version: doc.version + 1, updatedAt: today, body: body ?? doc.body };
}

// ---------- goals ----------

export function childGoals(data: PeopleData, id: Id) { return data.goals.filter((g) => g.parentId === id); }

/** A goal with children takes the average of its children's progress; a leaf uses its own. */
export function goalProgress(data: PeopleData, id: Id, seen = new Set<Id>()): number {
  const g = data.goals.find((x) => x.id === id);
  if (!g || seen.has(id)) return 0;
  seen.add(id);
  const kids = childGoals(data, id);
  if (kids.length === 0) return g.progress;
  return Math.round(kids.reduce((s, k) => s + goalProgress(data, k.id, seen), 0) / kids.length);
}

/** Status from progress against how far through the period we are. */
export function suggestStatus(progress: number, periodShare: number): GoalStatus {
  if (progress >= 100) return 'done';
  const gap = periodShare * 100 - progress;
  return gap <= 10 ? 'on_track' : gap <= 25 ? 'at_risk' : 'off_track';
}

/** "2026-Q4" → how far through the quarter `today` is, 0 to 1. */
export function periodShare(period: string, today: ISODate): number {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) return 0;
  const start = `${m[1]}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, '0')}-01`;
  const end = addDays(Number(m[2]) === 4 ? `${Number(m[1]) + 1}-01-01` : `${m[1]}-${String(Number(m[2]) * 3 + 1).padStart(2, '0')}-01`, -1);
  if (today <= start) return 0;
  if (today >= end) return 1;
  const span = (toDate(end).getTime() - toDate(start).getTime()) / 86_400_000;
  return Math.round(((toDate(today).getTime() - toDate(start).getTime()) / 86_400_000 / span) * 100) / 100;
}

export function checkIn(g: Goal, progress: number, note: string, by: string, at: ISODate, share: number): Goal {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  return { ...g, progress: p, status: suggestStatus(p, share), checkIns: [...g.checkIns, { at, by, progress: p, note }] };
}

// ---------- skills ----------

/** Skills where a person is below what their role needs, biggest gap first. */
export function skillGaps(data: PeopleData, personId: Id) {
  const p = data.people.find((x) => x.id === personId);
  if (!p) return [];
  return data.roleSkills.filter((r) => r.title === p.title).map((r) => {
    const have = data.skillLevels.find((l) => l.personId === personId && l.skillId === r.skillId)?.level ?? 0;
    return { skill: data.skills.find((s) => s.id === r.skillId)!, need: r.level, have, gap: r.level - have };
  }).filter((x) => x.skill && x.gap > 0).sort((a, b) => b.gap - a.gap);
}

// ---------- pay and bonus ----------

/** Salary against the middle of the role's band: 1.0 is the midpoint. */
export function compaRatio(data: PeopleData, p: Person): number | null {
  const band = data.bands.find((b) => b.title === p.title);
  if (!band || !p.salary) return null;
  return Math.round((p.salary / ((band.min + band.max) / 2)) * 100) / 100;
}

export interface BonusLine { person: Person; score: number | null; multiplier: number; target: number; amount: number }

/**
 * Bonus for one review cycle: annual salary × target × multiplier from the review score.
 * When the sum is above the budget, every amount is scaled down by the same factor.
 */
export function bonusPool(data: PeopleData, cycle: string, budget?: number) {
  const lines: BonusLine[] = data.reviews.filter((r) => r.cycle === cycle).map((r) => {
    const person = data.people.find((p) => p.id === r.personId)!;
    const score = r.managerDone ? reviewScore(r) : null;
    const target = Math.round((person?.salary ?? 0) * 12 * (person?.bonusTarget ?? 0));
    const multiplier = bonusMultiplier(score);
    return { person, score, multiplier, target, amount: Math.round(target * multiplier) };
  }).filter((l) => l.person);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const scale = budget !== undefined && total > budget && total > 0 ? budget / total : 1;
  const scaled = lines.map((l) => ({ ...l, amount: Math.round(l.amount * scale) }));
  return { lines: scaled, total: scaled.reduce((s, l) => s + l.amount, 0), unscaledTotal: total, scale: Math.round(scale * 1000) / 1000, waiting: lines.filter((l) => l.score === null).length };
}

// ---------- leaving ----------

export const DEFAULT_OFFBOARDING: Omit<ChecklistTask, 'id' | 'done'>[] = [
  { text: 'Confirm last day and notice in writing', owner: 'hr', dueDay: -20 },
  { text: 'Plan handover of clients and projects', owner: 'manager', dueDay: -14 },
  { text: 'Exit conversation', owner: 'hr', dueDay: -5 },
  { text: 'Final pay with unused vacation', owner: 'hr', dueDay: -2 },
  { text: 'Collect laptop, cards and keys', owner: 'it', dueDay: 0 },
  { text: 'Close accounts and forward email', owner: 'it', dueDay: 0 },
  { text: 'Employment certificate', owner: 'hr', dueDay: 1 },
];

export function startOffboarding(personId: Id, lastDay: ISODate, id: Id): Onboarding {
  return { id, personId, startDate: lastDay, tasks: DEFAULT_OFFBOARDING.map((t, i) => ({ ...t, id: `${id}_${i}`, done: false })) };
}

/** Vacation days owed on leaving: allowance earned to the last day minus days taken and booked before it. */
export function unusedVacationOnLeaving(data: PeopleData, personId: Id, lastDay: ISODate): number {
  const p = data.people.find((x) => x.id === personId);
  if (!p) return 0;
  const year = Number(lastDay.slice(0, 4));
  const yearStart = p.startDate > `${year}-01-01` ? p.startDate : `${year}-01-01`;
  const share = (toDate(lastDay).getTime() - toDate(yearStart).getTime() + 86_400_000) / (365 * 86_400_000);
  const earned = Math.round(p.leaveAllowance * Math.min(1, share) * 10) / 10;
  const b = leaveBalance(data, personId, year, addDays(lastDay, 1));
  return Math.max(0, Math.round((earned - b.taken - b.booked) * 10) / 10);
}

export function activePeople(data: PeopleData, today: ISODate) {
  return data.people.filter((p) => p.startDate <= today && (!p.lastDay || p.lastDay >= today));
}

// ---------- engagement ----------

/** eNPS: % promoters (9 to 10) minus % detractors (0 to 6). Hidden below 5 answers to keep people anonymous. */
export function enps(scores: number[]): number | null {
  if (scores.length < 5) return null;
  const pro = scores.filter((s) => s >= 9).length, det = scores.filter((s) => s <= 6).length;
  return Math.round(((pro - det) / scores.length) * 100);
}

// ---------- org chart ----------

export interface OrgNode { person: Person; reports: OrgNode[] }
export function orgTree(data: PeopleData, today: ISODate): OrgNode[] {
  const people = data.people.filter((p) => !p.lastDay || p.lastDay >= today);
  const ids = new Set(people.map((p) => p.id));
  const build = (p: Person, seen: Set<Id>): OrgNode => ({
    person: p,
    reports: people.filter((r) => r.managerId === p.id && !seen.has(r.id)).map((r) => build(r, new Set([...seen, r.id]))),
  });
  return people.filter((p) => !p.managerId || !ids.has(p.managerId)).map((p) => build(p, new Set([p.id])));
}
