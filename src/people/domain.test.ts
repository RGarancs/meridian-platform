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
