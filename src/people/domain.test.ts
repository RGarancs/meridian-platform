import {
  PeopleData, averageScore, bonusMultiplier, candidatesToDelete, emptyPeople, hiringFunnel, leaveBalance, lvFixedHolidays,
  moveCandidate, onboardingProgress, reviewScore, startOnboarding, teamClashes, tenureMonths, validateGoals, validateLeave,
  whoIsAway, workingDays,
} from './domain';

function fx(): PeopleData {
  const d = emptyPeople();
  d.people.push(
    { id: 'p1', name: 'Anna', email: 'a@x.example', title: 'Designer', team: 'Studio', startDate: '2024-03-15', location: 'Riga', leaveAllowance: 20 },
    { id: 'p2', name: 'Janis', email: 'j@x.example', title: 'Developer', team: 'Studio', managerId: 'p1', startDate: '2025-01-01', location: 'Riga', leaveAllowance: 20 },
    { id: 'p3', name: 'Liga', email: 'l@x.example', title: 'Sales', team: 'Sales', startDate: '2025-06-01', location: 'Riga', leaveAllowance: 20 },
  );
  d.leave.push(
    { id: 'l1', personId: 'p1', kind: 'vacation', from: '2026-07-06', to: '2026-07-10', status: 'approved' }, // 5 days, past
    { id: 'l2', personId: 'p1', kind: 'vacation', from: '2026-12-14', to: '2026-12-18', status: 'approved' }, // 5 days, future
    { id: 'l3', personId: 'p1', kind: 'vacation', from: '2026-11-23', to: '2026-11-24', status: 'pending' }, // 2 days
    { id: 'l4', personId: 'p2', kind: 'vacation', from: '2026-12-16', to: '2026-12-17', status: 'approved' },
    { id: 'l5', personId: 'p3', kind: 'sick', from: '2026-12-16', to: '2026-12-16', status: 'approved' },
  );
  return d;
}

describe('working days', () => {
  it('skips weekends and holidays', () => {
    expect(workingDays('2026-11-16', '2026-11-22')).toBe(5);
    expect(workingDays('2026-11-16', '2026-11-22', lvFixedHolidays(2026))).toBe(4); // 18 Nov
    expect(workingDays('2026-11-20', '2026-11-19')).toBe(0);
  });
});

describe('leave balance', () => {
  it('splits taken, booked and pending', () => {
    expect(leaveBalance(fx(), 'p1', 2026, '2026-11-12')).toEqual({ allowance: 20, taken: 5, booked: 5, pending: 2, left: 8 });
  });
  it('refuses more days than are left', () => {
    const errs = validateLeave(fx(), { personId: 'p1', kind: 'vacation', from: '2026-08-03', to: '2026-08-14' }, '2026-11-12');
    expect(errs).toEqual(['That is 10 days and only 8 are left this year.']);
  });
  it('refuses overlaps and backwards dates', () => {
    expect(validateLeave(fx(), { personId: 'p1', kind: 'sick', from: '2026-12-15', to: '2026-12-15' }, '2026-11-12')).toContain('This overlaps leave already requested.');
    expect(validateLeave(fx(), { personId: 'p1', kind: 'sick', from: '2026-12-02', to: '2026-12-01' }, '2026-11-12')).toContain('The last day is before the first day.');
  });
  it('shows team clashes to the approver, not other teams', () => {
    const r = fx().leave.find((x) => x.id === 'l2')!;
    expect(teamClashes(fx(), r).map((p) => p.id)).toEqual(['p2']);
  });
  it('lists who is away on a day', () => {
    expect(whoIsAway(fx(), '2026-12-16').map((x) => x.person.id)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('onboarding', () => {
  it('counts overdue tasks against the start date', () => {
    const o = startOnboarding('p3', '2026-11-16', 'o1');
    expect(o.tasks).toHaveLength(8);
    const p = onboardingProgress(o, '2026-11-12'); // tasks due day -14 and -7 are past
    expect(p).toMatchObject({ done: 0, total: 8, overdue: 2 });
    o.tasks[0].done = true;
    expect(onboardingProgress(o, '2026-11-12').overdue).toBe(1);
  });
});

describe('hiring', () => {
  const c = { id: 'c1', openingId: 'o1', name: 'X', source: 'LinkedIn', stage: 'interview' as const, appliedAt: '2026-10-01', scores: [] as number[], retainUntil: '2027-04-01' };
  it('needs a reason to reject and a score to offer', () => {
    expect(() => moveCandidate(c, 'rejected')).toThrow();
    expect(() => moveCandidate(c, 'offer')).toThrow();
    expect(moveCandidate({ ...c, scores: [4, 5] }, 'offer').stage).toBe('offer');
    expect(averageScore({ ...c, scores: [4, 5] })).toBe(4.5);
  });
  it('finds unhired candidates past their retention date', () => {
    const d = emptyPeople();
    d.candidates.push({ ...c, retainUntil: '2026-11-01' }, { ...c, id: 'c2', stage: 'hired', retainUntil: '2026-11-01' }, { ...c, id: 'c3' });
    expect(candidatesToDelete(d, '2026-11-12').map((x) => x.id)).toEqual(['c1']);
    expect(hiringFunnel(d).find((x) => x.stage === 'interview')?.count).toBe(2);
  });
});

describe('reviews and bonus', () => {
  it('validates weights', () => {
    expect(validateGoals([{ text: 'a', weight: 60 }, { text: 'b', weight: 30 }])).toEqual(['Goal weights add up to 90%, not 100%.']);
  });
  it('scores and maps to bonus', () => {
    const r = { id: 'r', personId: 'p1', cycle: 'H2 2026', selfDone: true, managerDone: true, goals: [{ text: 'a', weight: 60, score: 4 }, { text: 'b', weight: 40, score: 5 }] };
    expect(reviewScore(r)).toBe(4.4);
    expect(bonusMultiplier(4.4)).toBeCloseTo(1.2);
    expect(bonusMultiplier(3)).toBe(0.5);
    expect(bonusMultiplier(2.9)).toBe(0);
    expect(bonusMultiplier(5)).toBe(1.5);
    expect(reviewScore({ ...r, goals: [{ text: 'a', weight: 100 }] })).toBeNull();
  });
});

describe('tenure', () => {
  it('counts whole months', () => {
    expect(tenureMonths(fx().people[0], '2026-11-12')).toBe(31);
  });
});

import {
  ackRate, bonusPool, checkIn, compaRatio, docsToAcknowledge, enps, expiringSoon, goalProgress, orgTree, periodShare,
  publishNewVersion, skillGaps, startOffboarding, suggestStatus, unusedVacationOnLeaving,
} from './domain';

describe('documents', () => {
  const d = fx();
  d.documents.push(
    { id: 'h', title: 'Handbook', kind: 'policy', version: 2, updatedAt: '2026-10-01', requiresAck: true, acks: [{ personId: 'p1', version: 2, at: '2026-10-02' }, { personId: 'p2', version: 1, at: '2026-01-01' }] },
    { id: 'c', title: 'Contract', kind: 'contract', personId: 'p3', version: 1, updatedAt: '2025-06-01', requiresAck: false, acks: [], expires: '2026-12-01' },
  );
  d.training.push({ id: 't', personId: 'p2', course: 'First aid', done: '2024-11-01', expires: '2026-11-01' });
  it('asks only for the current version', () => {
    expect(docsToAcknowledge(d, 'p1')).toEqual([]);
    expect(docsToAcknowledge(d, 'p2').map((x) => x.id)).toEqual(['h']);
    expect(ackRate(d, d.documents[0], '2026-11-12')).toEqual({ done: 1, total: 3 });
  });
  it('a new version needs everyone again', () => {
    const v3 = publishNewVersion(d.documents[0], '2026-11-12');
    expect(v3.version).toBe(3);
    expect(docsToAcknowledge({ ...d, documents: [v3] }, 'p1')).toHaveLength(1);
  });
  it('lists expiring documents and training', () => {
    expect(expiringSoon(d, '2026-11-12').map((x) => [x.title, x.expired])).toEqual([['First aid', true], ['Contract', false]]);
  });
});

describe('goals', () => {
  const d = fx();
  d.goals.push(
    { id: 'g1', title: 'Grow', level: 'company', period: '2026-Q4', progress: 0, status: 'on_track', checkIns: [] },
    { id: 'g2', title: 'Sales', level: 'team', team: 'Sales', parentId: 'g1', period: '2026-Q4', progress: 80, status: 'on_track', checkIns: [] },
    { id: 'g3', title: 'Studio', level: 'team', team: 'Studio', parentId: 'g1', period: '2026-Q4', progress: 0, status: 'on_track', checkIns: [] },
    { id: 'g4', title: 'Anna', level: 'person', ownerId: 'p1', parentId: 'g3', period: '2026-Q4', progress: 40, status: 'on_track', checkIns: [] },
  );
  it('rolls progress up from children', () => {
    expect(goalProgress(d, 'g3')).toBe(40);
    expect(goalProgress(d, 'g1')).toBe(60);
  });
  it('knows how far through the quarter we are', () => {
    expect(periodShare('2026-Q4', '2026-10-01')).toBe(0);
    expect(periodShare('2026-Q4', '2026-12-31')).toBe(1);
    expect(periodShare('2026-Q4', '2026-11-15')).toBeCloseTo(0.49, 1);
  });
  it('suggests status against time elapsed', () => {
    expect(suggestStatus(45, 0.5)).toBe('on_track');
    expect(suggestStatus(30, 0.5)).toBe('at_risk');
    expect(suggestStatus(10, 0.5)).toBe('off_track');
    expect(suggestStatus(100, 0.2)).toBe('done');
  });
  it('records a check-in', () => {
    const g = checkIn(d.goals[3], 120, 'Shipped', 'Anna', '2026-11-12', 0.5);
    expect([g.progress, g.status, g.checkIns.length]).toEqual([100, 'done', 1]);
  });
});

describe('skills, pay and bonus', () => {
  const d = fx();
  d.people[0].salary = 3000; d.people[0].bonusTarget = 0.1;
  d.people[1].salary = 2000; d.people[1].bonusTarget = 0.1;
  d.bands.push({ title: 'Designer', min: 2500, max: 3500 });
  d.skills.push({ id: 's1', name: 'Figma', area: 'Design' }, { id: 's2', name: 'Copy', area: 'Design' });
  d.roleSkills.push({ title: 'Designer', skillId: 's1', level: 3 }, { title: 'Designer', skillId: 's2', level: 2 });
  d.skillLevels.push({ personId: 'p1', skillId: 's1', level: 2 });
  d.reviews.push(
    { id: 'r1', personId: 'p1', cycle: 'H2', selfDone: true, managerDone: true, goals: [{ text: 'a', weight: 100, score: 4 }] },
    { id: 'r2', personId: 'p2', cycle: 'H2', selfDone: true, managerDone: true, goals: [{ text: 'a', weight: 100, score: 5 }] },
    { id: 'r3', personId: 'p3', cycle: 'H2', selfDone: false, managerDone: false, goals: [{ text: 'a', weight: 100 }] },
  );
  it('finds skill gaps, biggest first', () => {
    expect(skillGaps(d, 'p1').map((g) => [g.skill.name, g.gap])).toEqual([['Copy', 2], ['Figma', 1]]);
  });
  it('computes compa-ratio', () => {
    expect(compaRatio(d, d.people[0])).toBe(1);
    expect(compaRatio(d, d.people[1])).toBeNull();
  });
  it('builds the bonus pool and scales to budget', () => {
    const full = bonusPool(d, 'H2');
    expect(full.lines.map((l) => l.amount)).toEqual([3600, 3600, 0]);
    expect(full.waiting).toBe(1);
    const capped = bonusPool(d, 'H2', 3600);
    expect(capped.scale).toBe(0.5);
    expect(capped.total).toBe(3600);
  });
});

describe('leaving, engagement, org chart', () => {
  it('starts offboarding and owes unused vacation', () => {
    const d = fx();
    expect(startOffboarding('p1', '2026-12-31', 'o').tasks).toHaveLength(7);
    // p1: 20 days earned by year end, 10 taken or booked → 10 owed
    expect(unusedVacationOnLeaving(d, 'p1', '2026-12-31')).toBe(10);
  });
  it('hides eNPS below five answers', () => {
    expect(enps([10, 9, 8])).toBeNull();
    expect(enps([10, 9, 8, 6, 3])).toBe(0);
    expect(enps([10, 10, 9, 9, 7])).toBe(80);
  });
  it('builds the org tree from managers', () => {
    const t = orgTree(fx(), '2026-11-12');
    expect(t.map((n) => [n.person.id, n.reports.map((r) => r.person.id)])).toEqual([['p1', ['p2']], ['p3', []]]);
  });
});
