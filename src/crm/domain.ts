// CRM domain: types and pure rules. No I/O here, so every rule is unit-tested.
// Object shapes follow Meridian OS (contacts, companies, deals, one timeline per record)
// and carry GDPR fields on every contact.

export type Id = string;
export type ISODate = string; // YYYY-MM-DD or full ISO timestamp

export type LawfulBasis = 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation';

export interface Company {
  id: Id;
  name: string;
  domain?: string;
  industry?: string;
  size?: '1-9' | '10-49' | '50-249' | '250+';
  country?: string;
  ownerId?: Id;
  createdAt: ISODate;
}

export interface Contact {
  id: Id;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
  companyId?: Id;
  ownerId?: Id;
  source: string; // where the contact came from: event, referral, website form, import...
  lawfulBasis: LawfulBasis;
  consentDate?: ISODate; // required when lawfulBasis is consent
  createdAt: ISODate;
}

export const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

// Default win likelihood per stage, used for the weighted pipeline.
export const STAGE_PROBABILITY: Record<Stage, number> = {
  lead: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  won: 1,
  lost: 0,
};

export interface Deal {
  id: Id;
  title: string;
  companyId?: Id;
  contactId?: Id;
  ownerId?: Id;
  stage: Stage;
  value: number; // in minor units? No: whole euros, to keep forms simple
  currency: 'EUR';
  expectedClose?: ISODate;
  nextStep?: string;
  nextStepDue?: ISODate;
  lostReason?: string;
  createdAt: ISODate;
  closedAt?: ISODate;
}

export type ActivityKind = 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'created';

export interface Activity {
  id: Id;
  kind: ActivityKind;
  text: string;
  at: ISODate;
  by: string; // person name or named agent
  contactId?: Id;
  companyId?: Id;
  dealId?: Id;
}

export interface CrmData {
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
}

export const emptyCrm = (): CrmData => ({ companies: [], contacts: [], deals: [], activities: [] });

// ---------- validation ----------

export function validateContact(c: Partial<Contact>): string[] {
  const errors: string[] = [];
  if (!c.firstName?.trim()) errors.push('First name is required.');
  if (!c.lastName?.trim()) errors.push('Last name is required.');
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors.push('Email does not look right.');
  if (!c.source?.trim()) errors.push('Say where this contact came from.');
  if (!c.lawfulBasis) errors.push('Choose the lawful basis for keeping this contact.');
  if (c.lawfulBasis === 'consent' && !c.consentDate) errors.push('Consent needs the date it was given.');
  return errors;
}

export function validateDeal(d: Partial<Deal>): string[] {
  const errors: string[] = [];
  if (!d.title?.trim()) errors.push('Give the deal a name.');
  if (d.value === undefined || Number.isNaN(d.value) || d.value < 0) errors.push('Value must be zero or more.');
  if (d.stage && !STAGES.includes(d.stage)) errors.push('Unknown stage.');
  return errors;
}

// ---------- pipeline ----------

export interface StageSummary {
  stage: Stage;
  count: number;
  value: number;
  weighted: number;
}

export function pipelineSummary(deals: Deal[]): StageSummary[] {
  return STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    const value = inStage.reduce((s, d) => s + d.value, 0);
    return { stage, count: inStage.length, value, weighted: Math.round(value * STAGE_PROBABILITY[stage]) };
  });
}

export function openPipeline(deals: Deal[]) {
  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const value = open.reduce((s, d) => s + d.value, 0);
  const weighted = open.reduce((s, d) => s + d.value * STAGE_PROBABILITY[d.stage], 0);
  return { count: open.length, value, weighted: Math.round(weighted) };
}

export function winRate(deals: Deal[]): number | null {
  const closed = deals.filter((d) => d.stage === 'won' || d.stage === 'lost');
  if (closed.length === 0) return null;
  return closed.filter((d) => d.stage === 'won').length / closed.length;
}

/** Moves a deal to a stage and returns the updated deal plus the timeline entry. */
export function moveDeal(deal: Deal, to: Stage, by: string, now: ISODate, id: Id, lostReason?: string): { deal: Deal; activity: Activity } {
  if (to === 'lost' && !lostReason?.trim()) throw new Error('Say why the deal was lost.');
  const closing = to === 'won' || to === 'lost';
  const next: Deal = {
    ...deal,
    stage: to,
    closedAt: closing ? now : undefined,
    lostReason: to === 'lost' ? lostReason : undefined,
  };
  const activity: Activity = {
    id,
    kind: 'stage_change',
    text: `${STAGE_LABEL[deal.stage]} → ${STAGE_LABEL[to]}${to === 'lost' ? `: ${lostReason}` : ''}`,
    at: now,
    by,
    dealId: deal.id,
    companyId: deal.companyId,
    contactId: deal.contactId,
  };
  return { deal: next, activity };
}

// ---------- follow-ups (the Today list) ----------

export interface FollowUp {
  deal: Deal;
  due: ISODate;
  overdue: boolean;
  reason: 'next_step_due' | 'no_next_step' | 'gone_quiet';
}

const DAY = 86_400_000;

/** Open deals that need a person today: a next step due, no next step at all, or no activity for 14 days. */
export function followUps(data: CrmData, today: ISODate): FollowUp[] {
  const t = Date.parse(today.slice(0, 10));
  const out: FollowUp[] = [];
  for (const deal of data.deals) {
    if (deal.stage === 'won' || deal.stage === 'lost') continue;
    if (deal.nextStepDue) {
      const due = Date.parse(deal.nextStepDue);
      if (due <= t) out.push({ deal, due: deal.nextStepDue, overdue: due < t, reason: 'next_step_due' });
      continue;
    }
    if (!deal.nextStep) {
      out.push({ deal, due: today.slice(0, 10), overdue: false, reason: 'no_next_step' });
      continue;
    }
    const last = lastTouch(data, deal);
    if (t - Date.parse(last) >= 14 * DAY) out.push({ deal, due: today.slice(0, 10), overdue: false, reason: 'gone_quiet' });
  }
  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due.localeCompare(b.due));
}

export function lastTouch(data: CrmData, deal: Deal): ISODate {
  const times = data.activities.filter((a) => a.dealId === deal.id).map((a) => a.at);
  return times.sort().at(-1) ?? deal.createdAt;
}

// ---------- timeline ----------

export type RecordRef = { kind: 'company' | 'contact' | 'deal'; id: Id };

/** Newest first. A company's timeline includes its contacts' and deals' activity. */
export function timeline(data: CrmData, ref: RecordRef): Activity[] {
  let match: (a: Activity) => boolean;
  if (ref.kind === 'deal') match = (a) => a.dealId === ref.id;
  else if (ref.kind === 'contact') match = (a) => a.contactId === ref.id;
  else {
    const contactIds = new Set(data.contacts.filter((c) => c.companyId === ref.id).map((c) => c.id));
    const dealIds = new Set(data.deals.filter((d) => d.companyId === ref.id).map((d) => d.id));
    match = (a) => a.companyId === ref.id || (!!a.contactId && contactIds.has(a.contactId)) || (!!a.dealId && dealIds.has(a.dealId));
  }
  return data.activities.filter(match).sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- search ----------

export type SearchHit = { ref: RecordRef; label: string; sub: string };

export function search(data: CrmData, q: string, limit = 12): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  const companyName = (id?: Id) => data.companies.find((c) => c.id === id)?.name ?? '';
  for (const c of data.companies)
    if ([c.name, c.domain, c.industry].some((v) => v?.toLowerCase().includes(needle)))
      hits.push({ ref: { kind: 'company', id: c.id }, label: c.name, sub: 'Company' });
  for (const c of data.contacts)
    if ([`${c.firstName} ${c.lastName}`, c.email, c.role].some((v) => v?.toLowerCase().includes(needle)))
      hits.push({ ref: { kind: 'contact', id: c.id }, label: `${c.firstName} ${c.lastName}`, sub: ['Contact', companyName(c.companyId)].filter(Boolean).join(' · ') });
  for (const d of data.deals)
    if (d.title.toLowerCase().includes(needle))
      hits.push({ ref: { kind: 'deal', id: d.id }, label: d.title, sub: `Deal · ${STAGE_LABEL[d.stage]}` });
  return hits.slice(0, limit);
}

// ---------- GDPR ----------

/** Everything held about one contact, for a subject access request. */
export function exportContact(data: CrmData, contactId: Id) {
  const contact = data.contacts.find((c) => c.id === contactId);
  if (!contact) throw new Error('No such contact.');
  return {
    exportedFor: `${contact.firstName} ${contact.lastName}`,
    contact,
    company: data.companies.find((c) => c.id === contact.companyId) ?? null,
    deals: data.deals.filter((d) => d.contactId === contactId),
    activities: data.activities.filter((a) => a.contactId === contactId),
  };
}

/**
 * Deletes a contact for good: the record and every activity tied only to them.
 * Deals stay (they belong to the company) but lose the link. Returns a log line
 * that names no personal data.
 */
export function eraseContact(data: CrmData, contactId: Id, by: string, now: ISODate): { data: CrmData; log: string } {
  if (!data.contacts.some((c) => c.id === contactId)) throw new Error('No such contact.');
  const removed = data.activities.filter((a) => a.contactId === contactId && !a.dealId).length;
  return {
    data: {
      companies: data.companies,
      contacts: data.contacts.filter((c) => c.id !== contactId),
      deals: data.deals.map((d) => (d.contactId === contactId ? { ...d, contactId: undefined } : d)),
      activities: data.activities
        .filter((a) => !(a.contactId === contactId && !a.dealId))
        .map((a) => (a.contactId === contactId ? { ...a, contactId: undefined } : a)),
    },
    log: `${now} ${by} erased contact ${contactId} and ${removed} activities`,
  };
}

// ---------- formatting ----------

export function eur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `€${(n / 1000).toFixed(1)}K`;
  return `€${n.toLocaleString('en-GB')}`;
}
