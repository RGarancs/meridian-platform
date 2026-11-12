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

export interface PeopleData {
  people: Person[];
  leave: LeaveRequest[];
  onboarding: Onboarding[];
  openings: Opening[];
  candidates: Candidate[];
  reviews: Review[];
}

export const emptyPeople = (): PeopleData => ({ people: [], leave: [], onboarding: [], openings: [], candidates: [], reviews: [] });

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
