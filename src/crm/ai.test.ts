import { describe, expect, it } from 'vitest';
import { audience, clusterCompanies, draftReply, healthCheck, insights5B, slaState, suggestions, triage, validateCampaign, validateProps } from './ai';
import { CrmData, Ticket, emptyCrm } from './domain';
import { seedCrm } from './seed';

const T = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

function base(): CrmData {
  return {
    ...emptyCrm(),
    companies: [
      { id: 'a', name: 'A', size: '50-249', createdAt: '2025-01-01' },
      { id: 'b', name: 'B', size: '1-9', createdAt: '2025-01-01' },
    ],
    contacts: [
      { id: 'c1', firstName: 'Ann', lastName: 'A', email: 'ann@a.example', companyId: 'a', source: 'x', lawfulBasis: 'legitimate_interest', createdAt: '2025-01-01' },
      { id: 'c2', firstName: 'Ben', lastName: 'B', email: 'ben@b.example', companyId: 'b', source: 'x', lawfulBasis: 'legitimate_interest', createdAt: '2025-01-01' },
      { id: 'c3', firstName: 'Cy', lastName: 'B', email: 'cy@b.example', companyId: 'b', source: 'x', lawfulBasis: 'consent', consentDate: '2026-01-01', createdAt: '2025-01-01' },
      { id: 'c4', firstName: 'Di', lastName: 'A', companyId: 'a', source: 'x', lawfulBasis: 'contract', createdAt: '2025-01-01' },
    ],
    deals: [{ id: 'd1', title: 'A won', companyId: 'a', stage: 'won', value: 10000, currency: 'EUR', createdAt: '2025-01-01', closedAt: '2025-02-01' }],
    activities: [{ id: 'x1', kind: 'call', text: 'hi', at: now, by: 'me', companyId: 'a' }],
  };
}

describe('health check', () => {
  it('scores a recently touched customer as healthy, with reasons', () => {
    const h = healthCheck(base(), 'a', T);
    expect(h.band).toBe('healthy');
    expect(h.reasons.map((r) => r.text).join(' ')).toMatch(/Customer/);
  });
  it('marks a never-contacted company with an urgent ticket as at risk', () => {
    const d = base();
    d.tickets = [{ id: 't', subject: 's', companyId: 'b', channel: 'email', status: 'open', priority: 'high', createdAt: now, messages: [] }];
    const h = healthCheck(d, 'b', T);
    expect(h.band).toBe('at_risk');
    expect(h.reasons[0].impact).toBeLessThan(0);
  });
});

describe('clustering', () => {
  it('puts every company in exactly one named group, the same way every time', () => {
    const d = seedCrm();
    const a = clusterCompanies(d, T), b = clusterCompanies(d, T);
    expect(a).toEqual(b);
    const ids = a.flatMap((c) => c.companyIds);
    expect(ids.length).toBe(d.companies.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.every((c) => c.label && c.why && c.action)).toBe(true);
  });
});

describe('service', () => {
  it('reads topic, priority and tone from the words', () => {
    expect(triage('Urgent, I cannot log in again').priority).toBe('high');
    expect(triage('Urgent, I cannot log in again').topic).toBe('Access');
    expect(triage('We want to cancel the contract').priority).toBe('high');
    expect(triage('It would be great if you could add exports').topic).toBe('Feature request');
    expect(triage('This is unacceptable').tone).toBe('upset');
  });
  it('flags a late first reply and never an answered one', () => {
    const t: Ticket = { id: 't', subject: 's', channel: 'email', status: 'open', priority: 'high', createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString(), messages: [] };
    expect(slaState(t, now).breached).toBe(true);
    expect(slaState({ ...t, firstReplyAt: now }, now).breached).toBe(false);
  });
  it('drafts a reply addressed to the person, signed by the user', () => {
    const d = base();
    const t: Ticket = { id: 't', subject: 's', contactId: 'c1', channel: 'email', status: 'open', priority: 'normal', topic: 'Billing', createdAt: now, messages: [{ at: now, from: 'customer', text: 'wrong invoice' }] };
    const r = draftReply(d, t, 'Rihards');
    expect(r.startsWith('Hi Ann')).toBe(true);
    expect(r.endsWith('Rihards')).toBe(true);
  });
});

describe('newsletter audience', () => {
  it('includes consent and existing customers, excludes the rest with a reason', () => {
    const d = base();
    const a = audience(d, {}, T);
    expect(a.included.map((c) => c.id).sort()).toEqual(['c1', 'c3']);
    const why = Object.fromEntries(a.excluded.map((x) => [x.contact.id, x.reason]));
    expect(why.c2).toBe('No consent and not a customer');
    expect(why.c4).toBe('No email address');
  });
  it('never includes someone who unsubscribed', () => {
    const d = base();
    d.contacts[0].unsubscribed = true;
    expect(audience(d, {}, T).included.map((c) => c.id)).not.toContain('c1');
  });
  it('needs an unsubscribe line and someone to send to', () => {
    expect(validateCampaign({ name: 'n', subject: 's', body: 'x'.repeat(50) }, 3)).toContain('Add an unsubscribe line: the law needs one in every newsletter.');
    expect(validateCampaign({ name: 'n', subject: 's', body: `${'x'.repeat(50)} unsubscribe` }, 0)).toContain('Nobody in this segment may receive it.');
  });
});

describe('properties', () => {
  it('checks numbers and choices', () => {
    const d = base();
    d.properties = [{ id: 'seats', entity: 'company', label: 'Seats', type: 'number' }, { id: 'plan', entity: 'company', label: 'Plan', type: 'select', options: ['A', 'B'] }];
    expect(validateProps(d, 'company', { seats: 'ten', plan: 'C' })).toHaveLength(2);
    expect(validateProps(d, 'company', { seats: '10', plan: 'A' })).toHaveLength(0);
  });
});

describe('autopilot and 5B', () => {
  it('suggests actions with reasons and drops dismissed ones', () => {
    const d = seedCrm();
    const s = suggestions(d, now);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.why && (x.task || x.open))).toBe(true);
    d.dismissed = [s[0].id];
    expect(suggestions(d, now).map((x) => x.id)).not.toContain(s[0].id);
  });
  it('gives every insight all five parts', () => {
    for (const i of insights5B(seedCrm(), T)) {
      expect(i.brevity && i.ballpark && i.benchmark && i.bespoke).toBeTruthy();
      expect(Array.isArray(i.breakdown)).toBe(true);
    }
  });
});
