// The automatic and agentic layer for Sales and customer service ("VG" and "Daniels").
// Every rule here is plain code: scores, groups and suggestions are explained by their reasons,
// never by a model's say-so. Drafts are suggestions a person edits and approves before anything is sent.
import {
  Campaign, Company, Contact, CrmData, Id, ISODate, Priority, SegmentRule, Task, Ticket, eur, followUps, openPipeline, winRate,
} from './domain';

const DAY = 86_400_000;
const days = (from: ISODate, to: ISODate) => Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY);

// ---------- customer facts ----------

export interface CompanyFacts {
  company: Company;
  wonValue: number;
  openValue: number;
  lostRecent: number; // lost deals in the last 90 days
  daysSinceTouch: number | null; // null = never touched
  openTickets: number;
  urgentTickets: number;
  overdueTasks: number;
  isCustomer: boolean;
}

export function companyFacts(data: CrmData, companyId: Id, today: ISODate): CompanyFacts {
  const company = data.companies.find((c) => c.id === companyId)!;
  const deals = data.deals.filter((d) => d.companyId === companyId);
  const contactIds = new Set(data.contacts.filter((c) => c.companyId === companyId).map((c) => c.id));
  const dealIds = new Set(deals.map((d) => d.id));
  const touches = data.activities
    .filter((a) => a.companyId === companyId || (a.contactId && contactIds.has(a.contactId)) || (a.dealId && dealIds.has(a.dealId)))
    .map((a) => a.at)
    .concat((data.tickets ?? []).filter((t) => t.companyId === companyId).flatMap((t) => t.messages.map((m) => m.at)))
    .sort();
  const last = touches.at(-1);
  const tickets = (data.tickets ?? []).filter((t) => t.companyId === companyId && t.status !== 'solved');
  const won = deals.filter((d) => d.stage === 'won');
  return {
    company,
    wonValue: won.reduce((s, d) => s + d.value, 0),
    openValue: deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0),
    lostRecent: deals.filter((d) => d.stage === 'lost' && d.closedAt && days(d.closedAt, today) <= 90).length,
    daysSinceTouch: last ? days(last, today) : null,
    openTickets: tickets.length,
    urgentTickets: tickets.filter((t) => t.priority === 'high' || slaState(t, today).breached).length,
    overdueTasks: data.tasks.filter((t) => !t.done && t.companyId === companyId && t.due < today.slice(0, 10)).length,
    isCustomer: won.length > 0,
  };
}

// ---------- health check ----------

export type HealthBand = 'healthy' | 'watch' | 'at_risk';
export interface Health { score: number; band: HealthBand; reasons: { text: string; impact: number }[] }
export const HEALTH_LABEL: Record<HealthBand, string> = { healthy: 'Healthy', watch: 'Watch', at_risk: 'At risk' };

/**
 * A 0–100 score that starts at 70 and moves with each signal. Every move is kept as a reason,
 * so the page can say exactly why a customer is at risk.
 */
export function healthCheck(data: CrmData, companyId: Id, today: ISODate): Health {
  const f = companyFacts(data, companyId, today);
  const reasons: { text: string; impact: number }[] = [];
  const add = (impact: number, text: string) => reasons.push({ impact, text });
  if (f.daysSinceTouch === null) add(-20, 'Never contacted');
  else if (f.daysSinceTouch <= 14) add(+10, `In touch ${f.daysSinceTouch === 0 ? 'today' : `${f.daysSinceTouch} days ago`}`);
  else if (f.daysSinceTouch <= 30) add(-5, `Quiet for ${f.daysSinceTouch} days`);
  else if (f.daysSinceTouch <= 60) add(-15, `Quiet for ${f.daysSinceTouch} days`);
  else add(-30, `Quiet for ${f.daysSinceTouch} days`);
  if (f.isCustomer) add(+10, `Customer, ${eur(f.wonValue)} won`);
  if (f.openValue > 0) add(+10, `${eur(f.openValue)} in open deals`);
  if (f.lostRecent) add(-15 * f.lostRecent, `Lost ${f.lostRecent === 1 ? 'a deal' : `${f.lostRecent} deals`} in the last 90 days`);
  if (f.urgentTickets) add(-15 * f.urgentTickets, `${f.urgentTickets} urgent or late support ${f.urgentTickets === 1 ? 'ticket' : 'tickets'}`);
  else if (f.openTickets) add(-5, `${f.openTickets} open support ${f.openTickets === 1 ? 'ticket' : 'tickets'}`);
  // a renewal date kept as a custom property: quiet before a renewal is the classic churn signal
  const renewalDef = data.properties.find((p) => p.entity === 'company' && p.type === 'date' && /renew/i.test(p.label));
  const renewal = renewalDef ? f.company.props?.[renewalDef.id] : undefined;
  if (typeof renewal === 'string') {
    const left = days(today, renewal);
    if (left >= 0 && left <= 45 && (f.daysSinceTouch ?? 999) > 30) add(-20, `Renews in ${left} days and has gone quiet`);
    else if (left >= 0 && left <= 45) add(0, `Renews in ${left} days`);
  }
  if (f.overdueTasks) add(-5 * f.overdueTasks, `${f.overdueTasks} overdue ${f.overdueTasks === 1 ? 'task' : 'tasks'}`);
  const score = Math.max(0, Math.min(100, 70 + reasons.reduce((s, r) => s + r.impact, 0)));
  return { score, band: score >= 70 ? 'healthy' : score >= 45 ? 'watch' : 'at_risk', reasons: reasons.sort((a, b) => a.impact - b.impact) };
}

// ---------- automatic clustering ----------

export interface Cluster { id: string; label: string; why: string; action: string; companyIds: Id[] }

const SIZE_RANK: Record<string, number> = { '1-9': 0, '10-49': 1, '50-249': 2, '250+': 3 };

/**
 * k-means on four plain features (won value, open value, days since touch, company size),
 * scaled 0–1, with a fixed start so the same data always gives the same groups.
 * Each group is then named from where its centre sits, so the label explains itself.
 */
export function clusterCompanies(data: CrmData, today: ISODate, k = 5): Cluster[] {
  const facts = data.companies.map((c) => companyFacts(data, c.id, today));
  if (facts.length === 0) return [];
  const raw = facts.map((f) => [Math.log1p(f.wonValue), Math.log1p(f.openValue), Math.min(f.daysSinceTouch ?? 120, 120), SIZE_RANK[f.company.size ?? ''] ?? 1]);
  const max = raw[0].map((_, j) => Math.max(...raw.map((r) => r[j]), 1e-9));
  const min = raw[0].map((_, j) => Math.min(...raw.map((r) => r[j])));
  const W = [1, 1, 1.6, 0.6]; // recent contact matters most, size least
  const X = raw.map((r) => r.map((v, j) => (max[j] === min[j] ? 0 : ((v - min[j]) / (max[j] - min[j])) * W[j])));
  const kk = Math.min(k, X.length);
  // farthest-point start: deterministic and spreads the centres
  const centres = [X[0]];
  while (centres.length < kk) {
    let best = 0, bestD = -1;
    X.forEach((x, i) => { const d = Math.min(...centres.map((c) => dist(x, c))); if (d > bestD) { bestD = d; best = i; } });
    centres.push(X[best]);
  }
  let assign = X.map(() => 0);
  for (let it = 0; it < 30; it++) {
    const next = X.map((x) => centres.reduce((bi, c, i) => (dist(x, c) < dist(x, centres[bi]) ? i : bi), 0));
    centres.forEach((_, ci) => {
      const members = X.filter((_, i) => next[i] === ci);
      if (members.length) centres[ci] = members[0].map((_, j) => members.reduce((s, m) => s + m[j], 0) / members.length);
    });
    if (next.every((a, i) => a === assign[i]) && it > 0) break;
    assign = next;
  }
  // Name each group from what its members have in common, in plain units, so the label explains itself.
  const seen = new Map<string, number>();
  return centres.map((_, ci) => {
    const m = facts.filter((_, i) => assign[i] === ci);
    if (!m.length) return null;
    const share = m.filter((f) => f.isCustomer).length / m.length;
    const withOpen = m.filter((f) => f.openValue > 0).length / m.length;
    const quiet = m.reduce((s, f) => s + Math.min(f.daysSinceTouch ?? 120, 120), 0) / m.length;
    const key: keyof typeof NAMES = share >= 0.5
      ? (quiet > 45 ? 'quietCustomers' : withOpen >= 0.5 ? 'growing' : 'loyal')
      : quiet > 90 ? (withOpen >= 0.5 ? 'early' : 'cold') : withOpen >= 0.5 ? (quiet <= 25 ? 'hot' : 'warm') : 'cold';
    const n = (seen.get(key) ?? 0) + 1; seen.set(key, n);
    return { id: `cl_${ci}`, ...NAMES[key], label: n > 1 ? `${NAMES[key].label} ${n}` : NAMES[key].label, companyIds: m.map((f) => f.company.id) };
  }).filter((c): c is Cluster => !!c).sort((a, b) => b.companyIds.length - a.companyIds.length);
}

const NAMES = {
  growing: { label: 'Growing customers', why: 'Customers with a new deal open.', action: 'Close the add-on before the renewal.' },
  loyal: { label: 'Loyal customers', why: 'Have bought and are in regular touch.', action: 'Ask for a referral or a case study.' },
  quietCustomers: { label: 'Quiet customers', why: 'Have bought before but nobody has talked to them lately.', action: 'Send a check-in or the customer newsletter.' },
  hot: { label: 'Hot prospects', why: 'Large open deals and recent contact.', action: 'Keep a dated next step on every deal.' },
  warm: { label: 'Warm prospects', why: 'Some open value, contact is thinning.', action: 'Book a call before they go cold.' },
  cold: { label: 'Cold leads', why: 'No deals moving and no recent contact.', action: 'Nurture with the newsletter, or close them out.' },
  bigNew: { label: 'Big new names', why: 'Large companies early in the relationship.', action: 'Find a second contact and a first meeting.' },
  early: { label: 'New leads', why: 'New, with a deal opened but no conversation logged yet.', action: 'Book the first call and qualify: budget, need, timing.' },
};

function dist(a: number[], b: number[]) { return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0); }

// ---------- custom properties ----------

export function validateProps(data: CrmData, entity: 'company' | 'contact', props: Record<string, unknown>): string[] {
  const errs: string[] = [];
  for (const def of data.properties.filter((p) => p.entity === entity)) {
    const v = props[def.id];
    if (v === undefined || v === '') continue;
    if (def.type === 'number' && Number.isNaN(Number(v))) errs.push(`${def.label} must be a number.`);
    if (def.type === 'select' && def.options && !def.options.includes(String(v))) errs.push(`${def.label} must be one of: ${def.options.join(', ')}.`);
    if (def.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errs.push(`${def.label} must be a date.`);
  }
  return errs;
}

// ---------- customer service ----------

const SLA_HOURS: Record<Priority, number> = { high: 4, normal: 24, low: 72 };
export const SLA_LABEL = 'First reply within 4 hours (high), 24 hours (normal) or 3 days (low).';

/** When the first reply is due and whether it is late. Solved or answered tickets are never late. */
export function slaState(t: Ticket, now: ISODate) {
  const dueAt = new Date(Date.parse(t.createdAt) + SLA_HOURS[t.priority] * 3_600_000).toISOString();
  const answered = !!t.firstReplyAt || t.status === 'solved';
  const nowMs = Date.parse(now.length <= 10 ? `${now}T12:00:00Z` : now);
  return { dueAt, answered, breached: !answered && nowMs > Date.parse(dueAt), hoursLeft: Math.round((Date.parse(dueAt) - nowMs) / 3_600_000) };
}

const TOPICS: { topic: string; words: string[] }[] = [
  { topic: 'Billing', words: ['invoice', 'bill', 'payment', 'charge', 'refund', 'price', 'vat'] },
  { topic: 'Access', words: ['login', 'log in', 'password', 'access', 'locked', 'invite'] },
  { topic: 'Bug', words: ['error', 'broken', 'bug', 'crash', 'not working', "doesn't work", 'fails', 'wrong'] },
  { topic: 'Cancel', words: ['cancel', 'terminate', 'stop the contract', 'leave', 'switch to'] },
  { topic: 'How to', words: ['how do', 'how can', 'where can', 'is it possible', 'can i'] },
  { topic: 'Feature request', words: ['would be great', 'could you add', 'feature', 'wish'] },
];
const URGENT = ['urgent', 'asap', 'immediately', 'today', 'down', 'cannot work', "can't work", 'angry', 'unacceptable'];
const NEGATIVE = ['disappointed', 'angry', 'unacceptable', 'frustrated', 'again', 'still', 'worst', 'cancel'];

/** Reads a message and suggests a topic, a priority and the tone, with the words that decided it. */
export function triage(text: string): { topic: string; priority: Priority; tone: 'calm' | 'upset'; because: string[] } {
  const s = text.toLowerCase();
  const hit = TOPICS.map((t) => ({ ...t, found: t.words.filter((w) => s.includes(w)) })).sort((a, b) => b.found.length - a.found.length)[0];
  const urgent = URGENT.filter((w) => s.includes(w));
  const neg = NEGATIVE.filter((w) => s.includes(w));
  const topic = hit && hit.found.length ? hit.topic : 'Question';
  const priority: Priority = urgent.length || topic === 'Cancel' ? 'high' : topic === 'Feature request' ? 'low' : 'normal';
  return { topic, priority, tone: neg.length ? 'upset' : 'calm', because: [...(hit?.found ?? []), ...urgent, ...neg].filter((w, i, a) => a.indexOf(w) === i).slice(0, 5) };
}

const OPENERS: Record<string, string> = {
  Billing: 'thanks for flagging the invoice question. I have checked your account and',
  Access: 'sorry you are locked out. I have sent a fresh sign-in link to this address, and',
  Bug: 'thank you for the details, that helps a lot. We have reproduced the problem and',
  Cancel: 'thank you for telling us directly. Before anything changes, I would like to understand what is not working, and',
  'How to': 'good question.',
  'Feature request': 'thank you for the idea. I have added it to our list with your use case, and',
  Question: 'thanks for getting in touch.',
};
const NEXT: Record<string, string> = {
  Billing: 'will send a corrected invoice today.',
  Access: 'you should be back in within a few minutes. If not, reply here and I will call you.',
  Bug: 'a fix is on its way. I will write again as soon as it is live.',
  Cancel: 'could we take 15 minutes this week? I can call at a time that suits you.',
  'How to': 'Here are the steps: [add the steps]. If it is easier, I can walk you through it on a short call.',
  'Feature request': 'I will tell you when it is planned.',
  Question: 'Here is what I found: [add the answer].',
};

/** A first draft in the team's voice. A person edits and approves it; nothing is sent from here. */
export function draftReply(data: CrmData, t: Ticket, signer: string): string {
  const c = data.contacts.find((x) => x.id === t.contactId);
  const topic = t.topic ?? triage(t.messages.map((m) => m.text).join(' ')).topic;
  const tone = triage(t.messages.filter((m) => m.from === 'customer').map((m) => m.text).join(' ')).tone;
  const sorry = tone === 'upset' && topic !== 'Access' ? 'I am sorry this has been frustrating. ' : '';
  return `Hi ${c?.firstName ?? 'there'},\n\n${sorry}${cap(OPENERS[topic] ?? OPENERS.Question)} ${NEXT[topic] ?? NEXT.Question}\n\nBest,\n${signer}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function serviceStats(data: CrmData, now: ISODate) {
  const ts = data.tickets ?? [];
  const open = ts.filter((t) => t.status !== 'solved');
  const replied = ts.filter((t) => t.firstReplyAt);
  const hours = replied.map((t) => (Date.parse(t.firstReplyAt!) - Date.parse(t.createdAt)) / 3_600_000);
  return {
    open: open.length,
    late: open.filter((t) => slaState(t, now).breached).length,
    medianFirstReply: hours.length ? Math.round(median(hours) * 10) / 10 : null,
    withinSla: replied.length ? Math.round((replied.filter((t) => (Date.parse(t.firstReplyAt!) - Date.parse(t.createdAt)) / 3_600_000 <= SLA_HOURS[t.priority]).length / replied.length) * 100) : null,
    byTopic: [...new Set(ts.map((t) => t.topic ?? 'Question'))].map((topic) => ({ topic, count: ts.filter((t) => (t.topic ?? 'Question') === topic).length })).sort((a, b) => b.count - a.count),
  };
}
function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// ---------- newsletters ----------

/** Companies that match a segment rule. */
export function segmentCompanies(data: CrmData, rule: SegmentRule, today: ISODate, clusters = clusterCompanies(data, today)): Company[] {
  const inCluster = rule.cluster ? new Set(clusters.find((c) => c.id === rule.cluster)?.companyIds ?? []) : null;
  return data.companies.filter((co) =>
    (!inCluster || inCluster.has(co.id))
    && (!rule.health || healthCheck(data, co.id, today).band === rule.health)
    && (!rule.customersOnly || data.deals.some((d) => d.companyId === co.id && d.stage === 'won'))
    && (!rule.industry || co.industry === rule.industry)
    && (!rule.country || co.country === rule.country));
}

/**
 * Who a newsletter may go to. GDPR and the ePrivacy rules: consent, or an existing customer
 * (the "soft opt-in"), never someone who unsubscribed, and only with an email address.
 */
export function audience(data: CrmData, rule: SegmentRule, today: ISODate) {
  const companies = new Set(segmentCompanies(data, rule, today).map((c) => c.id));
  const customers = new Set(data.deals.filter((d) => d.stage === 'won' && d.companyId).map((d) => d.companyId!));
  const included: Contact[] = [];
  const excluded: { contact: Contact; reason: string }[] = [];
  for (const c of data.contacts.filter((x) => x.companyId && companies.has(x.companyId))) {
    if (!c.email) excluded.push({ contact: c, reason: 'No email address' });
    else if (c.unsubscribed) excluded.push({ contact: c, reason: 'Unsubscribed' });
    else if (c.lawfulBasis === 'consent' && c.consentDate) included.push(c);
    else if (customers.has(c.companyId!) && c.lawfulBasis !== 'legal_obligation') included.push(c);
    else excluded.push({ contact: c, reason: 'No consent and not a customer' });
  }
  return { included, excluded };
}

export function validateCampaign(c: Pick<Campaign, 'name' | 'subject' | 'body'>, recipients: number): string[] {
  const e: string[] = [];
  if (!c.name.trim()) e.push('Name the newsletter.');
  if (!c.subject.trim()) e.push('Write a subject line.');
  if (c.subject.length > 70) e.push('Keep the subject under 70 characters so it fits on a phone.');
  if (c.body.trim().length < 40) e.push('The message is too short to send.');
  if (!/unsubscribe/i.test(c.body)) e.push('Add an unsubscribe line: the law needs one in every newsletter.');
  if (recipients === 0) e.push('Nobody in this segment may receive it.');
  return e;
}

export function personalise(body: string, c: Contact, companyName?: string) {
  return body.replace(/\{first_name\}/g, c.firstName).replace(/\{company\}/g, companyName ?? 'your company');
}

/** A starting text for a segment: short, one idea, one ask. */
export function draftNewsletter(cluster: Cluster | undefined, sender: string): { subject: string; body: string } {
  const label = cluster?.label ?? 'Everyone';
  const ask = cluster?.action ?? 'Reply if you want to talk.';
  return {
    subject: label === 'Quiet customers' ? 'A quick check-in, {first_name}' : label === 'Loyal customers' ? 'What we built with you this year' : 'One idea for {company} this month',
    body: `Hi {first_name},\n\nOne short idea for {company} this month: [one useful idea in two sentences].\n\nWhy it matters: [one number or example].\n\n${label === 'Quiet customers' ? 'It has been a while. Is there anything we could do better?' : label === 'Loyal customers' ? 'Would you be open to sharing your story as a case study?' : `Next step: ${ask.toLowerCase()}`} Just reply to this email.\n\n${sender}\n\nDon't want these emails? Reply "unsubscribe" and we will stop.`,
  };
}

// ---------- autopilot: suggested actions ----------

export type Suggestion = {
  id: string; // stable, so a dismissed suggestion stays dismissed
  kind: 'health' | 'deal' | 'service' | 'consent' | 'newsletter';
  title: string; why: string;
  task?: Omit<Task, 'id' | 'done' | 'owner'>;
  open?: { page: string; ticketId?: Id; companyId?: Id; clusterId?: string };
};

/** What the team should do next, worked out from the data. A person approves each one. */
export function suggestions(data: CrmData, today: ISODate): Suggestion[] {
  const out: Suggestion[] = [];
  const t = today.slice(0, 10);
  const due = (n: number) => new Date(Date.parse(t) + n * DAY).toISOString().slice(0, 10);
  for (const t2 of (data.tickets ?? []).filter((x) => x.status !== 'solved' && slaState(x, today).breached)) {
    out.push({ id: `sla:${t2.id}`, kind: 'service', title: `Reply to “${t2.subject}”`, why: `First reply is late (${t2.priority} priority). A draft is ready to edit.`, open: { page: 'service', ticketId: t2.id } });
  }
  for (const co of data.companies) {
    const h = healthCheck(data, co.id, today);
    if (h.band === 'at_risk' && !data.tasks.some((x) => !x.done && x.companyId === co.id && x.title.startsWith('Check-in'))) {
      const c = data.contacts.find((x) => x.companyId === co.id);
      out.push({ id: `health:${co.id}`, kind: 'health', title: `Check-in call with ${co.name}`, why: `Health ${h.score}/100: ${h.reasons.filter((r) => r.impact < 0).map((r) => r.text.toLowerCase()).slice(0, 2).join(', ')}.`,
        task: { title: `Check-in call with ${c ? `${c.firstName} at ` : ''}${co.name}`, due: due(2), companyId: co.id, contactId: c?.id } });
    }
  }
  for (const f of followUps(data, today).filter((x) => x.reason !== 'next_step_due')) {
    out.push({ id: `deal:${f.deal.id}:${f.reason}`, kind: 'deal', title: f.reason === 'no_next_step' ? `Set a next step on ${f.deal.title}` : `Nudge ${f.deal.title}`,
      why: f.reason === 'no_next_step' ? 'Open deals without a dated next step stall.' : 'No activity for 14 days.',
      task: { title: f.reason === 'no_next_step' ? `Agree the next step for ${f.deal.title}` : `Follow up on ${f.deal.title}`, due: due(1), dealId: f.deal.id, companyId: f.deal.companyId, contactId: f.deal.contactId } });
  }
  for (const c of data.contacts.filter((x) => x.lawfulBasis === 'consent' && x.consentDate && days(x.consentDate, today) > 700)) {
    out.push({ id: `consent:${c.id}`, kind: 'consent', title: `Ask ${c.firstName} ${c.lastName} to renew consent`, why: 'Consent is almost 2 years old. Renew it or move them off the newsletter.',
      task: { title: `Renew consent: ${c.firstName} ${c.lastName}`, due: due(7), contactId: c.id, companyId: c.companyId } });
  }
  const quiet = clusterCompanies(data, today).find((c) => c.label.startsWith('Quiet customers'));
  const sentRecently = (data.campaigns ?? []).some((c) => c.segment.cluster === quiet?.id && c.sentAt && days(c.sentAt, today) < 30);
  if (quiet && !sentRecently) {
    out.push({ id: `news:${quiet.id}:${t.slice(0, 7)}`, kind: 'newsletter', title: quiet.companyIds.length === 1 ? 'Send a check-in newsletter to your quiet customer' : `Send a check-in newsletter to ${quiet.companyIds.length} quiet customers`, why: quiet.why, open: { page: 'newsletters', clusterId: quiet.id } });
  }
  return out.filter((s) => !(data.dismissed ?? []).includes(s.id));
}

// ---------- 5B insights ----------

/** Ballpark, Benchmark, Brevity, Breakdown, Bespoke insight: one card per question that matters. */
export interface Insight5B { id: string; brevity: string; ballpark: string; benchmark: string; breakdown: { label: string; value: string }[]; bespoke: string }

export function insights5B(data: CrmData, today: ISODate): Insight5B[] {
  const out: Insight5B[] = [];
  const open = openPipeline(data.deals);
  const t = today.slice(0, 10);
  const recent = (d?: string, from = 0, to = 90) => !!d && days(d, t) >= from && days(d, t) < to;
  const wonNow = data.deals.filter((d) => d.stage === 'won' && recent(d.closedAt, 0, 90));
  const wonBefore = data.deals.filter((d) => d.stage === 'won' && recent(d.closedAt, 90, 180));
  const wv = wonNow.reduce((s, d) => s + d.value, 0), wb = wonBefore.reduce((s, d) => s + d.value, 0);
  out.push({
    id: 'pipeline', brevity: open.weighted >= wv ? 'The pipeline covers last quarter’s sales.' : 'The pipeline is thinner than last quarter’s sales.',
    ballpark: eur(open.weighted), benchmark: `vs ${eur(wv)} won in the last 90 days${wb ? ` (${eur(wb)} the 90 days before)` : ''}`,
    breakdown: (['lead', 'qualified', 'proposal', 'negotiation'] as const).map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: eur(data.deals.filter((d) => d.stage === s).reduce((x, d) => x + d.value, 0)) })),
    bespoke: open.weighted >= wv ? 'Push the negotiation-stage deals over the line first: they carry the most weight.' : 'Add qualified leads now: the next quarter depends on them.',
  });
  const rate = winRate(data.deals);
  const lost = data.deals.filter((d) => d.stage === 'lost');
  const reasons = [...new Set(lost.map((d) => d.lostReason ?? 'No reason'))];
  out.push({
    id: 'winrate', brevity: rate === null ? 'Not enough closed deals to judge.' : rate >= 0.3 ? 'We win often enough.' : 'We lose more than we should.',
    ballpark: rate === null ? '—' : `${Math.round(rate * 100)}%`, benchmark: 'vs 20–30%, a common B2B services range',
    breakdown: reasons.map((r) => ({ label: r, value: String(lost.filter((d) => (d.lostReason ?? 'No reason') === r).length) })),
    bespoke: reasons[0] ? `The top loss reason is “${reasons[0]}”. Address it in the proposal before price comes up.` : 'Log a reason on every lost deal so this card can learn.',
  });
  const health = data.companies.map((c) => healthCheck(data, c.id, today));
  const risk = health.filter((h) => h.band === 'at_risk').length;
  out.push({
    id: 'health', brevity: risk ? `${risk} of ${health.length} companies need${risk === 1 ? 's' : ''} attention.` : 'Every company looks healthy.',
    ballpark: `${Math.round(health.reduce((s, h) => s + h.score, 0) / Math.max(1, health.length))}/100`, benchmark: 'vs 70, the line for healthy',
    breakdown: (['healthy', 'watch', 'at_risk'] as const).map((b) => ({ label: HEALTH_LABEL[b], value: String(health.filter((h) => h.band === b).length) })),
    bespoke: risk ? 'Autopilot has a check-in call ready for each one at risk.' : 'Use the calm: ask a loyal customer for a referral.',
  });
  const s = serviceStats(data, today);
  out.push({
    id: 'service', brevity: s.late ? `${s.late} customers are waiting too long.` : 'Support answers on time.',
    ballpark: s.medianFirstReply === null ? '—' : `${s.medianFirstReply} h`, benchmark: `first reply, median · ${s.withinSla ?? '—'}% within target`,
    breakdown: s.byTopic.slice(0, 4).map((x) => ({ label: x.topic, value: String(x.count) })),
    bespoke: s.byTopic[0] ? `“${s.byTopic[0].topic}” is the top topic: one help article could remove a share of these tickets.` : 'No tickets yet.',
  });
  return out;
}
