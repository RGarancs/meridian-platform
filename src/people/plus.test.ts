import { describe, expect, it } from 'vitest';
import { PeopleData, emptyPeople } from './domain';
import {
  DEFAULT_JOURNEY, JourneyTemplate, advanceKit, askHr, buildJourney, dayBetween, draftKitRequests, isStepDone, journeyDay, journeyProgress,
  kitFor, kitRisk, kitToReturn, myToday, needsJourney, nextKitStatus, phaseOf, pickTemplate, searchPolicies, stepsFor, suggestBuddy, terms, topTopics,
} from './plus';
import { seedPeople } from './seed';

const TODAY = '2026-11-20';
const T_ALL: JourneyTemplate = { id: 't_all', name: 'Everyone', teams: [], steps: DEFAULT_JOURNEY };
const T_STUDIO: JourneyTemplate = {
  id: 't_st', name: 'Studio', teams: ['Studio'],
  steps: [{ text: 'Welcome', owner: 'manager', day: 0, kind: 'meet' }, { text: 'Order laptop', owner: 'it', day: -5, kind: 'task' }, { text: 'Values course', owner: 'newcomer', day: 1, kind: 'training', minutes: 20 }],
};

function fx(): PeopleData {
  const d = emptyPeople();
  d.people.push(
    { id: 'm', name: 'Mara', email: '', title: 'Head of studio', team: 'Studio', startDate: '2020-01-01', location: 'Riga', leaveAllowance: 20 },
    { id: 'b1', name: 'Juris', email: '', title: 'Designer', team: 'Studio', managerId: 'm', startDate: '2023-01-01', location: 'Riga', leaveAllowance: 20 },
    { id: 'b2', name: 'Ieva', email: '', title: 'Designer', team: 'Studio', managerId: 'm', startDate: '2024-05-01', location: 'Riga', leaveAllowance: 20 },
    { id: 'new', name: 'Anna', email: '', title: 'UX designer', team: 'Studio', managerId: 'm', startDate: '2026-11-24', location: 'Riga', leaveAllowance: 20 },
    { id: 'old', name: 'Rolands', email: '', title: 'Finance', team: 'Ops', startDate: '2022-01-01', location: 'Riga', leaveAllowance: 20, lastDay: '2026-12-05' },
  );
  d.journeyTemplates.push(T_ALL, T_STUDIO);
  d.kitItems.push(
    { id: 'lap', name: 'Laptop', category: 'laptop', cost: 2000, leadDays: 10 },
    { id: 'scr', name: 'Screen', category: 'screen', cost: 300, leadDays: 2 },
    { id: 'mail', name: 'Email', category: 'access', leadDays: 0 },
  );
  d.roleKits.push({ team: '*', itemIds: ['mail'] }, { team: 'Studio', itemIds: ['lap', 'scr', 'mail'] });
  d.documents.push(
    { id: 'hb', title: 'Employee handbook', kind: 'policy', version: 2, updatedAt: TODAY, requiresAck: true, acks: [], body: 'You get 20 working days of paid vacation a year. If you are sick, tell your manager before 10:00.' },
    { id: 'ct', title: 'Employment contract', kind: 'contract', personId: 'new', version: 1, updatedAt: TODAY, requiresAck: true, acks: [] },
    { id: 'ex', title: 'Expenses and equipment', kind: 'policy', version: 1, updatedAt: TODAY, requiresAck: false, acks: [], body: 'Client dinners are paid up to 40 euro a person. Work equipment up to 150 euro, such as a keyboard, needs no approval.' },
  );
  return d;
}

const anna = (d: PeopleData) => d.people.find((p) => p.id === 'new')!;
let n = 0;
const id = () => `k${n++}`;

describe('journey builder', () => {
  it('picks the team template, else the one for any team', () => {
    const d = fx();
    expect(pickTemplate(d.journeyTemplates, anna(d))?.id).toBe('t_st');
    expect(pickTemplate(d.journeyTemplates, d.people.find((p) => p.id === 'old')!)?.id).toBe('t_all');
  });
  it('adds a sign step per owed document and a kit step per requested item, sorted by day', () => {
    const d = fx();
    d.kitRequests = draftKitRequests(d, anna(d), TODAY, id, 'Kit agent');
    const j = buildJourney(d, anna(d), T_STUDIO, 'j1', 'b1');
    expect(j.steps.filter((s) => s.kind === 'sign').map((s) => s.docId).sort()).toEqual(['ct', 'hb']);
    expect(j.steps.filter((s) => s.kind === 'kit')).toHaveLength(3);
    expect(j.steps.find((s) => s.docId === 'ct')!.day).toBe(-7); // contracts before the start
    expect(j.steps.map((s) => s.day)).toEqual([...j.steps.map((s) => s.day)].sort((a, b) => a - b));
    expect(j.builtFrom).toHaveLength(3);
  });
  it('counts days from the start: day 1 is the first day, before it the days to go', () => {
    const d = fx();
    const j = buildJourney(d, anna(d), T_STUDIO, 'j1');
    expect(journeyDay(j, '2026-11-24')).toBe(1);
    expect(journeyDay(j, '2026-11-26')).toBe(3);
    expect(journeyDay(j, '2026-11-20')).toBe(-4);
    expect(dayBetween('2026-11-24', '2026-11-20')).toBe(-4);
    expect([phaseOf(-3), phaseOf(0), phaseOf(4)]).toEqual(['preboard', 'day1', 'first90']);
  });
  it('marks a sign step done when the document is acknowledged and a kit step when the item is ready', () => {
    const d = fx();
    d.kitRequests = draftKitRequests(d, anna(d), TODAY, id, 'Kit agent');
    const j = buildJourney(d, anna(d), T_STUDIO, 'j1');
    d.journeys.push(j);
    const sign = j.steps.find((s) => s.docId === 'ct')!;
    const kit = j.steps.find((s) => s.kitId)!;
    expect(isStepDone(d, sign)).toBe(false);
    d.documents = d.documents.map((x) => (x.id === 'ct' ? { ...x, acks: [{ personId: 'new', version: 1, at: TODAY }] } : x));
    expect(isStepDone(d, sign)).toBe(true);
    d.kitRequests = d.kitRequests.map((r) => (r.id === kit.kitId ? { ...r, status: 'ready' } : r));
    expect(isStepDone(d, kit)).toBe(true);
  });
  it('reports progress, overdue steps and the next step', () => {
    const d = fx();
    const j = buildJourney(d, anna(d), T_STUDIO, 'j1');
    d.journeys.push(j);
    const p = journeyProgress(d, j, '2026-11-21'); // 3 days before the start
    expect(p.phase).toBe('preboard');
    expect(p.overdue.map((s) => s.text)).toEqual(['Read and sign: Employment contract', 'Order laptop']);
    expect(p.next?.text).toBe('Read and sign: Employment contract');
    expect(p.done).toBe(0);
  });
  it('lists open steps by owner within a window, late first', () => {
    const d = fx();
    d.journeys.push(buildJourney(d, anna(d), T_STUDIO, 'j1'));
    expect(stepsFor(d, 'it', '2026-11-21').map((x) => x.late)).toEqual([true]);
    expect(stepsFor(d, 'newcomer', TODAY, 7).map((x) => x.step.text)).toEqual(['Read and sign: Employment contract', 'Values course', 'Read and sign: Employee handbook']);
    expect(stepsFor(d, 'newcomer', TODAY, 2)).toHaveLength(1);
  });
  it('finds joiners without a journey and suggests a buddy who is not the manager and has fewest buddy jobs', () => {
    const d = fx();
    expect(needsJourney(d, TODAY).map((p) => p.id)).toEqual(['new']);
    expect(suggestBuddy(d, anna(d), TODAY)?.id).toBe('b2'); // most recent of the two, both free
    d.journeys.push({ ...buildJourney(d, anna(d), T_STUDIO, 'jx', 'b2'), personId: 'someone', startDate: '2026-11-01' });
    expect(suggestBuddy(d, anna(d), TODAY)?.id).toBe('b1');
    d.journeys.push(buildJourney(d, anna(d), T_STUDIO, 'j1'));
    expect(needsJourney(d, TODAY)).toEqual([]);
  });
});

describe('IT desk', () => {
  it('merges the everyone kit and the team kit', () => {
    const d = fx();
    expect(kitFor(d, anna(d)).map((i) => i.id)).toEqual(['lap', 'scr', 'mail']);
  });
  it('drafts requests only for items the person does not have, accounts needed on the first day', () => {
    const d = fx();
    d.kitRequests = draftKitRequests(d, anna(d), TODAY, id, 'Kit agent').filter((r) => r.itemId === 'lap');
    const more = draftKitRequests(d, anna(d), TODAY, id, 'Kit agent');
    expect(more.map((r) => r.itemId)).toEqual(['scr', 'mail']);
    expect(more.find((r) => r.itemId === 'mail')!.neededBy).toBe('2026-11-24');
    expect(more.find((r) => r.itemId === 'scr')!.neededBy).toBe('2026-11-23');
  });
  it('moves through the flow with history and flags late and at-risk items', () => {
    const d = fx();
    const [lap, scr] = draftKitRequests(d, anna(d), TODAY, id, 'Kit agent');
    expect(nextKitStatus('requested')).toBe('ordered');
    expect(nextKitStatus('delivered')).toBeUndefined();
    expect(kitRisk(d, lap, TODAY)).toBe('at_risk'); // 10-day lead time, needed in 3 days
    expect(kitRisk(d, scr, TODAY)).toBe('ok');
    expect(kitRisk(d, scr, '2026-11-25')).toBe('late');
    const moved = advanceKit(lap, 'ordered', TODAY, 'Agnese');
    expect(moved.history.map((h) => h.status)).toEqual(['requested', 'ordered']);
    expect(kitRisk(d, moved, TODAY)).toBe('ok');
  });
  it('lists kit to collect from people leaving soon', () => {
    const d = fx();
    d.kitRequests.push({ id: 'r1', personId: 'old', itemId: 'lap', status: 'delivered', neededBy: '2022-01-01', history: [] });
    d.kitRequests.push({ id: 'r2', personId: 'b1', itemId: 'lap', status: 'delivered', neededBy: '2023-01-01', history: [] });
    expect(kitToReturn(d, TODAY).map((x) => x.request.id)).toEqual(['r1']);
    expect(kitToReturn(d, TODAY, 5)).toEqual([]);
  });
});

describe('Ask HR', () => {
  it('folds case, accents and word endings so Latvian and English forms match', () => {
    expect(terms('Atvaļinājuma dienas?')).toEqual(['atval', 'diena']);
    expect(terms('keyboards')).toEqual(terms('keyboard'));
  });
  it('answers vacation questions from the person’s own balance, citing the policy', () => {
    const d = fx();
    const a = askHr(d, 'b1', 'How many vacation days do I have left?', TODAY);
    expect(a.kind).toBe('personal');
    expect(a.text).toContain('20');
    expect(a.sources[0]?.docId).toBe('hb');
  });
  it('understands the same question in Latvian', () => {
    const d = fx();
    expect(askHr(d, 'b1', 'Cik atvaļinājuma dienu man ir palicis?', TODAY).kind).toBe('personal');
    expect(askHr(d, 'new', 'Kas ir mans vadītājs?', TODAY).text).toContain('Mara');
  });
  it('does not answer sick leave with the vacation balance', () => {
    const a = askHr(fx(), 'b1', 'What do I do if I am sick?', TODAY);
    expect(a.kind).toBe('policy');
    expect(a.sources[0].quote).toContain('sick');
  });
  it('answers policy questions with the sentence, document and version', () => {
    const a = askHr(fx(), 'b1', 'Can I expense a new keyboard?', TODAY);
    expect(a.kind).toBe('policy');
    expect(a.sources[0]).toMatchObject({ docId: 'ex', version: 1 });
    expect(a.text).toContain('150 euro');
  });
  it('says so and offers HR when nothing fits', () => {
    expect(askHr(fx(), 'b1', 'Is there a bike-to-work benefit?', TODAY).kind).toBe('none');
    expect(searchPolicies(fx().documents, 'the and of')).toEqual([]);
  });
  it('names the buddy from the journey', () => {
    const d = fx();
    d.journeys.push(buildJourney(d, anna(d), T_STUDIO, 'j1', 'b2'));
    expect(askHr(d, 'new', 'Who is my buddy?', TODAY).text).toContain('Ieva');
  });
  it('counts the topics people ask about more than once', () => {
    const d = fx();
    const q = (text: string, i: number) => ({ id: `q${i}`, personId: 'b1', q: text, at: TODAY, status: 'answered' as const, answer: askHr(d, 'b1', text, TODAY) });
    d.hrQuestions = ['Expenses for dinners?', 'Expense a keyboard', 'Remote days'].map(q);
    expect(topTopics(d)).toEqual([{ term: 'expen', word: 'expense', n: 2 }]);
  });
});

describe('My Meridian', () => {
  it('lists the newcomer’s own steps and documents without duplicates', () => {
    const d = fx();
    d.journeys.push(buildJourney(d, anna(d), T_STUDIO, 'j1'));
    const items = myToday(d, 'new', TODAY);
    expect(items.filter((i) => i.docId === 'hb')).toHaveLength(1);
    expect(items.find((i) => i.text === 'Values course')?.sub).toBe('20 min');
  });
});

describe('example data', () => {
  it('gives both joiners a journey and every seeded question an answer', () => {
    const d = seedPeople();
    expect(d.journeys.map((j) => j.personId).sort()).toEqual(['p_10', 'p_11']);
    expect(d.hrQuestions.every((q) => q.answer.text.length > 0)).toBe(true);
    expect(d.hrQuestions.filter((q) => q.status === 'to_hr').every((q) => q.answer.kind === 'none')).toBe(true);
  });
});
