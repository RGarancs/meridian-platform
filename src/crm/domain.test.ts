import {
  CrmData, Deal, emptyCrm, eraseContact, exportContact, followUps, moveDeal, openPipeline, openTasks, tasksFor, forecastByMonth, sourceReport, parseContactsCsv, splitCsvLine,
  pipelineSummary, search, timeline, validateContact, validateDeal, winRate, eur,
} from './domain';

const deal = (over: Partial<Deal>): Deal => ({
  id: 'd1', title: 'Deal', stage: 'lead', value: 1000, currency: 'EUR', createdAt: '2026-11-01', ...over,
});

function fixture(): CrmData {
  const d = emptyCrm();
  d.companies.push({ id: 'co1', name: 'Kalna Bakery', domain: 'kalna.example', createdAt: '2026-10-01' });
  d.contacts.push(
    { id: 'c1', firstName: 'Anna', lastName: 'Ozola', email: 'anna@kalna.example', companyId: 'co1', source: 'Event', lawfulBasis: 'legitimate_interest', createdAt: '2026-10-01' },
    { id: 'c2', firstName: 'Janis', lastName: 'Berzins', companyId: 'co1', source: 'Referral', lawfulBasis: 'consent', consentDate: '2026-10-02', createdAt: '2026-10-02' },
  );
  d.deals.push(
    deal({ id: 'd1', companyId: 'co1', contactId: 'c1', stage: 'proposal', value: 4000, nextStep: 'Send offer', nextStepDue: '2026-11-10' }),
    deal({ id: 'd2', companyId: 'co1', stage: 'won', value: 2000 }),
    deal({ id: 'd3', stage: 'lost', value: 500, lostReason: 'Budget' }),
    deal({ id: 'd4', stage: 'qualified', value: 1000 }),
    deal({ id: 'd5', stage: 'lead', value: 800, nextStep: 'Call', createdAt: '2026-10-01' }),
  );
  d.activities.push(
    { id: 'a1', kind: 'note', text: 'Met at fair', at: '2026-10-05T10:00:00Z', by: 'Rihards', contactId: 'c1' },
    { id: 'a2', kind: 'call', text: 'Scoping call', at: '2026-11-03T10:00:00Z', by: 'Rihards', dealId: 'd1', contactId: 'c1', companyId: 'co1' },
    { id: 'a3', kind: 'note', text: 'Owner retiring', at: '2026-10-06T10:00:00Z', by: 'Rihards', companyId: 'co1' },
  );
  return d;
}

describe('validation', () => {
  it('requires names, source and lawful basis', () => {
    expect(validateContact({})).toHaveLength(4);
  });
  it('requires a consent date when the basis is consent', () => {
    const errs = validateContact({ firstName: 'A', lastName: 'B', source: 'Form', lawfulBasis: 'consent' });
    expect(errs).toEqual(['Consent needs the date it was given.']);
  });
  it('rejects a bad email', () => {
    expect(validateContact({ firstName: 'A', lastName: 'B', source: 'x', lawfulBasis: 'contract', email: 'nope' })).toContain('Email does not look right.');
  });
  it('checks deals', () => {
    expect(validateDeal({ title: '', value: -1 })).toHaveLength(2);
    expect(validateDeal({ title: 'Ok', value: 0, stage: 'lead' })).toEqual([]);
  });
});

describe('pipeline', () => {
  it('sums each stage and weights it', () => {
    const s = pipelineSummary(fixture().deals);
    expect(s.find((x) => x.stage === 'proposal')).toEqual({ stage: 'proposal', count: 1, value: 4000, weighted: 2000 });
    expect(s).toHaveLength(6);
  });
  it('counts only open deals in the open pipeline', () => {
    expect(openPipeline(fixture().deals)).toEqual({ count: 3, value: 5800, weighted: 2000 + 250 + 80 });
  });
  it('computes win rate on closed deals only', () => {
    expect(winRate(fixture().deals)).toBe(0.5);
    expect(winRate([deal({})])).toBeNull();
  });
});

describe('moveDeal', () => {
  it('logs the change and sets closedAt on won', () => {
    const { deal: d, activity } = moveDeal(deal({ stage: 'negotiation' }), 'won', 'Rihards', '2026-11-12', 'a9');
    expect(d.stage).toBe('won');
    expect(d.closedAt).toBe('2026-11-12');
    expect(activity.text).toBe('Negotiation → Won');
  });
  it('refuses lost without a reason', () => {
    expect(() => moveDeal(deal({}), 'lost', 'R', '2026-11-12', 'a9')).toThrow();
  });
  it('clears closedAt when reopened', () => {
    const { deal: d } = moveDeal(deal({ stage: 'won', closedAt: '2026-11-01' }), 'proposal', 'R', '2026-11-12', 'a9');
    expect(d.closedAt).toBeUndefined();
  });
});

describe('followUps', () => {
  it('lists overdue, missing next step and gone quiet', () => {
    const f = followUps(fixture(), '2026-11-12');
    expect(f.map((x) => [x.deal.id, x.reason, x.overdue])).toEqual([
      ['d1', 'next_step_due', true],
      ['d4', 'no_next_step', false],
      ['d5', 'gone_quiet', false],
    ]);
  });
});

describe('timeline', () => {
  it('rolls contact and deal activity up to the company, newest first', () => {
    expect(timeline(fixture(), { kind: 'company', id: 'co1' }).map((a) => a.id)).toEqual(['a2', 'a3', 'a1']);
  });
  it('shows only a deal its own entries', () => {
    expect(timeline(fixture(), { kind: 'deal', id: 'd1' }).map((a) => a.id)).toEqual(['a2']);
  });
});

describe('search', () => {
  it('finds across companies, contacts and deals', () => {
    const hits = search(fixture(), 'kalna');
    expect(hits.map((h) => h.ref.kind)).toEqual(['company', 'contact']);
    expect(search(fixture(), '  ')).toEqual([]);
  });
});

describe('GDPR', () => {
  it('exports everything about a contact', () => {
    const e = exportContact(fixture(), 'c1');
    expect(e.deals.map((d) => d.id)).toEqual(['d1']);
    expect(e.activities.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
  it('erases a contact, keeps deals, and logs no personal data', () => {
    const { data, log } = eraseContact(fixture(), 'c1', 'Rihards', '2026-11-12');
    expect(data.contacts.map((c) => c.id)).toEqual(['c2']);
    expect(data.deals.find((d) => d.id === 'd1')?.contactId).toBeUndefined();
    expect(data.activities.map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(data.activities.find((a) => a.id === 'a2')?.contactId).toBeUndefined();
    expect(log).not.toMatch(/Anna|Ozola|anna@/);
  });
});

describe('eur', () => {
  it('formats compactly', () => {
    expect(eur(950)).toBe('€950');
    expect(eur(12500)).toBe('€12.5K');
    expect(eur(2_400_000)).toBe('€2.40M');
  });
});

describe('tasks and reports', () => {
  const d = fixture();
  d.tasks.push(
    { id: 't1', title: 'Send deck', due: '2026-11-10', done: false, owner: 'R', dealId: 'd1', contactId: 'c1' },
    { id: 't2', title: 'Call', due: '2026-11-12', done: false, owner: 'R', contactId: 'c1' },
    { id: 't3', title: 'Old', due: '2026-11-01', done: true, owner: 'R', companyId: 'co1' },
  );
  it('orders open tasks and flags overdue', () => {
    expect(openTasks(d, '2026-11-12').map((x) => [x.task.id, x.overdue, x.dueToday])).toEqual([['t1', true, false], ['t2', false, true]]);
    expect(tasksFor(d, { kind: 'contact', id: 'c1' }).map((t) => t.id)).toEqual(['t1', 't2']);
  });
  it('erases contact-only tasks with the contact', () => {
    const { data } = eraseContact(d, 'c1', 'R', '2026-11-12');
    expect(data.tasks.map((t) => [t.id, t.contactId])).toEqual([['t1', undefined], ['t3', undefined]]);
  });
  it('forecasts open deals by month', () => {
    const f = forecastByMonth([deal({ id: 'a', stage: 'proposal', value: 1000, expectedClose: '2026-12-05' }), deal({ id: 'b', stage: 'lead', value: 500 }), deal({ id: 'c', stage: 'won', value: 9, expectedClose: '2026-12-01' })]);
    expect(f).toEqual([{ month: '2026-12', value: 1000, weighted: 500, count: 1 }, { month: 'No date', value: 500, weighted: 50, count: 1 }]);
  });
  it('reports sources', () => {
    const r = sourceReport(fixture());
    expect(r.find((x) => x.source === 'Event')).toEqual({ source: 'Event', contacts: 1, won: 0, wonValue: 0, lost: 0 });
  });
});

describe('CSV import', () => {
  it('reads quoted fields, full names, flags errors and duplicates', () => {
    const csv = 'Name,Email,Company,Lawful basis\n"Ozola, Anna",anna@kalna.example,Kalna,consent\nPeter Smith,peter@x.example,"Acme, Inc",Legitimate interest\n,,,\n';
    const rows = parseContactsCsv(csv, fixture());
    expect(rows).toHaveLength(2);
    expect(rows[0].duplicate).toBe(true);
    expect(rows[0].errors).toContain('Consent needs the date it was given.');
    expect(rows[1].contact).toMatchObject({ firstName: 'Peter', lastName: 'Smith', lawfulBasis: 'legitimate_interest', source: 'Import' });
    expect(rows[1].companyName).toBe('Acme, Inc');
    expect(rows[1].errors).toEqual([]);
  });
  it('splits on semicolons too', () => {
    expect(splitCsvLine('a;"b;c";d')).toEqual(['a', 'b;c', 'd']);
  });
});
