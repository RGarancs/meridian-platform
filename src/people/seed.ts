// Invented example team for "Kalna Studio". No real people.
import { PeopleData, addDays, startOffboarding } from './domain';
import { DEFAULT_JOURNEY, HrQuestion, KitRequest, KitStatus, SALES_JOURNEY, STUDIO_JOURNEY, askHr, buildJourney } from './plus';

export function seedPeople(): PeopleData {
  const base = seedBase();
  return withPeoplePlus(base);
}

function seedBase(): Omit<PeopleData, 'journeyTemplates' | 'journeys' | 'kitItems' | 'roleKits' | 'kitRequests' | 'hrQuestions'> {
  const today = new Date().toISOString().slice(0, 10);
  const d = (n: number) => addDays(today, n);
  const year = today.slice(0, 4);
  const q = `${year}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  // Joiners get a People+ journey (see withPeoplePlus) instead of the older onboarding checklist.
  const off = startOffboarding('p_8', d(18), 'of_1');
  off.tasks[0].done = true;
  return {
    people: [
      { id: 'p_1', salary: 5200, bonusTarget: 0.2, name: 'Ilze Kalnina', email: 'ilze@kalna.example', title: 'Managing director', team: 'Leadership', startDate: '2019-02-01', location: 'Riga', leaveAllowance: 25 },
      { id: 'p_2', salary: 4100, bonusTarget: 0.15, name: 'Martins Ozols', email: 'martins@kalna.example', title: 'Head of studio', team: 'Studio', managerId: 'p_1', startDate: '2020-05-04', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_3', salary: 3300, bonusTarget: 0.1, name: 'Laura Liepa', email: 'laura@kalna.example', title: 'Senior designer', team: 'Studio', managerId: 'p_2', startDate: '2021-09-01', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_4', salary: 2900, bonusTarget: 0.1, name: 'Edgars Vitols', email: 'edgars@kalna.example', title: 'Developer', team: 'Studio', managerId: 'p_2', startDate: '2023-03-13', location: 'Remote, Liepaja', leaveAllowance: 20 },
      { id: 'p_5', salary: 2400, bonusTarget: 0.15, name: 'Kadri Tamm', email: 'kadri@kalna.example', title: 'Account manager', team: 'Sales', managerId: 'p_1', startDate: '2022-01-10', location: 'Tallinn', leaveAllowance: 20 },
      { id: 'p_6', salary: 3000, bonusTarget: 0.2, name: 'Tomas Petraitis', email: 'tomas@kalna.example', title: 'Sales lead', team: 'Sales', managerId: 'p_1', startDate: '2021-04-19', location: 'Vilnius', leaveAllowance: 20 },
      { id: 'p_7', salary: 2200, bonusTarget: 0.08, name: 'Agnese Berzina', email: 'agnese@kalna.example', title: 'People and office', team: 'Operations', managerId: 'p_1', startDate: '2022-08-22', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_8', lastDay: d(18), salary: 2700, bonusTarget: 0.08, name: 'Rolands Krumins', email: 'rolands@kalna.example', title: 'Finance', team: 'Operations', managerId: 'p_1', startDate: '2024-02-05', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_9', salary: 2100, bonusTarget: 0.08, name: 'Signe Eglite', email: 'signe@kalna.example', title: 'Designer', team: 'Studio', managerId: 'p_2', startDate: '2025-06-02', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_10', salary: 1700, bonusTarget: 0.05, name: 'Aleksis Upitis', email: 'aleksis@kalna.example', title: 'Junior developer', team: 'Studio', managerId: 'p_2', startDate: d(4), location: 'Riga', leaveAllowance: 20 },
      { id: 'p_11', salary: 2200, bonusTarget: 0.05, name: 'Anna Strautina', email: 'anna@kalna.example', title: 'UX designer', team: 'Studio', managerId: 'p_2', startDate: d(-2), location: 'Riga', leaveAllowance: 20 },
    ],
    leave: [
      { id: 'lv_1', personId: 'p_3', kind: 'vacation', from: `${year}-07-13`, to: `${year}-07-24`, status: 'approved', decidedBy: 'Martins Ozols' },
      { id: 'lv_2', personId: 'p_4', kind: 'vacation', from: d(-1), to: d(1), status: 'approved', decidedBy: 'Martins Ozols' },
      { id: 'lv_3', personId: 'p_5', kind: 'sick', from: d(0), to: d(0), status: 'approved', decidedBy: 'Ilze Kalnina' },
      { id: 'lv_4', personId: 'p_9', kind: 'vacation', from: d(12), to: d(16), status: 'pending', note: 'Family trip' },
      { id: 'lv_5', personId: 'p_3', kind: 'vacation', from: d(13), to: d(14), status: 'pending' },
      { id: 'lv_6', personId: 'p_6', kind: 'study', from: d(20), to: d(21), status: 'pending', note: 'Exam at SSE Riga' },
    ],
    onboarding: [],
    offboarding: [off],
    openings: [
      { id: 'op_1', title: 'Senior developer', team: 'Studio', hiringManagerId: 'p_2', open: true, salaryFrom: 3200, salaryTo: 4200 },
      { id: 'op_2', title: 'Marketing specialist', team: 'Sales', hiringManagerId: 'p_6', open: true, salaryFrom: 1900, salaryTo: 2500 },
    ],
    candidates: [
      { id: 'cd_1', openingId: 'op_1', name: 'Candidate A', source: 'LinkedIn', stage: 'interview', appliedAt: d(-20), scores: [4, 4], retainUntil: d(160) },
      { id: 'cd_2', openingId: 'op_1', name: 'Candidate B', source: 'Referral', stage: 'offer', appliedAt: d(-25), scores: [5, 4, 5], retainUntil: d(155) },
      { id: 'cd_3', openingId: 'op_1', name: 'Candidate C', source: 'CV.lv', stage: 'screen', appliedAt: d(-6), scores: [], retainUntil: d(174) },
      { id: 'cd_4', openingId: 'op_1', name: 'Candidate D', source: 'CV.lv', stage: 'rejected', appliedAt: d(-30), scores: [2], rejectReason: 'Not enough backend experience', retainUntil: d(-2) },
      { id: 'cd_5', openingId: 'op_2', name: 'Candidate E', source: 'Website', stage: 'applied', appliedAt: d(-2), scores: [], retainUntil: d(178) },
      { id: 'cd_6', openingId: 'op_2', name: 'Candidate F', source: 'LinkedIn', stage: 'interview', appliedAt: d(-12), scores: [3], retainUntil: d(168) },
    ],
    reviews: [
      { id: 'rv_1', personId: 'p_3', cycle: `H2 ${year}`, selfDone: true, managerDone: true, goals: [{ text: 'Ship Birch brand book', weight: 50, score: 5 }, { text: 'Mentor Signe', weight: 30, score: 4 }, { text: 'Cut revision rounds to 2', weight: 20, score: 3 }] },
      { id: 'rv_2', personId: 'p_4', cycle: `H2 ${year}`, selfDone: true, managerDone: false, goals: [{ text: 'Launch client portal', weight: 70 }, { text: 'Test coverage above 80%', weight: 30 }] },
      { id: 'rv_3', personId: 'p_5', cycle: `H2 ${year}`, selfDone: false, managerDone: false, goals: [{ text: 'EUR 120K new business', weight: 80 }, { text: 'Two case studies', weight: 20 }] },
      { id: 'rv_4', personId: 'p_9', cycle: `H2 ${year}`, selfDone: true, managerDone: true, goals: [{ text: 'Own two client projects', weight: 60, score: 3 }, { text: 'Learn motion tools', weight: 40, score: 4 }] },
    ],
    documents: [
      { id: 'dc_1', title: 'Employee handbook', kind: 'policy', version: 3, updatedAt: d(-9), requiresAck: true, acks: ['p_1', 'p_2', 'p_3', 'p_6', 'p_7'].map((id) => ({ personId: id, version: 3, at: d(-6) })), body: 'Core hours are 10:00 to 16:00; plan the rest of your day with your team. Summer weeks from June to August are four days long, with Fridays off. You get 20 working days of paid vacation a year: book it in Meridian at least two weeks ahead and your manager approves it. If you are sick, tell your manager before 10:00 and book a sick day in Meridian. From the second day of sick leave the studio pays sick pay as Latvian law sets, and from day 11 the State Social Insurance Agency (VSAA) pays. Your laptop, screen and headset belong to the studio: return them on your last day. Every newcomer gets a buddy for the first 90 days and a 30-day check-in with their manager. Probation is three months and ends with a talk with your manager.' },
      { id: 'dc_2', title: 'Data protection and GDPR', kind: 'policy', version: 2, updatedAt: d(-120), requiresAck: true, acks: ['p_1', 'p_2', 'p_3', 'p_4', 'p_5', 'p_6', 'p_7', 'p_8', 'p_9'].map((id) => ({ personId: id, version: 2, at: d(-100) })), body: 'What personal data we hold about clients and colleagues, who may see it and how long we keep it.' },
      { id: 'dc_3', title: 'Remote work rules', kind: 'policy', version: 1, updatedAt: d(-40), requiresAck: true, acks: ['p_1', 'p_2', 'p_4', 'p_7'].map((id) => ({ personId: id, version: 1, at: d(-30) })), body: 'Up to three remote days a week. Working from another country is possible for up to 20 working days a year: ask your manager and HR at least two weeks ahead so we can check tax and insurance. Do the work safety self-check for your home desk once a year.' },
      { id: 'dc_4', title: 'Employment contract', kind: 'contract', personId: 'p_10', version: 1, updatedAt: d(-10), requiresAck: true, acks: [], body: 'Junior developer, full time, probation 3 months.' },
      { id: 'dc_5', title: 'Work safety briefing', kind: 'certificate', personId: 'p_4', version: 1, updatedAt: d(-350), requiresAck: false, acks: [], expires: d(15) },
      { id: 'dc_6', title: 'Vacation request form', kind: 'form', version: 1, updatedAt: d(-200), requiresAck: false, acks: [] },
      { id: 'dc_7', title: 'Employment contract', kind: 'contract', personId: 'p_3', version: 2, updatedAt: d(-300), requiresAck: true, acks: [{ personId: 'p_3', version: 2, at: d(-298) }] },
      { id: 'dc_8', title: 'Expenses and equipment', kind: 'policy', version: 1, updatedAt: d(-60), requiresAck: false, acks: [], body: 'Client lunches and dinners are paid up to 40 euro a person, with the receipt uploaded within 30 days. Work equipment up to 150 euro, such as a keyboard, mouse or cables, needs no approval; above that, ask your manager first. Travel is booked by the office: ask Agnese. Approved expenses are paid with the next salary.' },
      { id: 'dc_9', title: 'Employment contract', kind: 'contract', personId: 'p_11', version: 1, updatedAt: d(-20), requiresAck: true, acks: [{ personId: 'p_11', version: 1, at: d(-15) }], body: 'UX designer, full time, probation 3 months.' },
    ],
    goals: [
      { id: 'g_1', title: 'Grow revenue to EUR 1.2M this year', level: 'company', ownerId: 'p_1', period: q, progress: 0, status: 'on_track', checkIns: [] },
      { id: 'g_2', title: 'Win EUR 300K of new business', level: 'team', team: 'Sales', ownerId: 'p_6', parentId: 'g_1', period: q, progress: 0, status: 'on_track', checkIns: [] },
      { id: 'g_3', title: 'Close 3 retainers above EUR 4K a month', level: 'person', ownerId: 'p_6', parentId: 'g_2', period: q, progress: 66, status: 'on_track', checkIns: [{ at: d(-14), by: 'Tomas Petraitis', progress: 33, note: 'Harbour signed' }, { at: d(-3), by: 'Tomas Petraitis', progress: 66, note: 'Birch signed, Lumen in proposal' }] },
      { id: 'g_4', title: 'Book 20 discovery calls', level: 'person', ownerId: 'p_5', parentId: 'g_2', period: q, progress: 45, status: 'at_risk', checkIns: [{ at: d(-5), by: 'Kadri Tamm', progress: 45, note: '9 of 20, events slow in November' }] },
      { id: 'g_5', title: 'Deliver every project on budget', level: 'team', team: 'Studio', ownerId: 'p_2', parentId: 'g_1', period: q, progress: 0, status: 'on_track', checkIns: [] },
      { id: 'g_6', title: 'Cut revision rounds to two', level: 'person', ownerId: 'p_3', parentId: 'g_5', period: q, progress: 80, status: 'on_track', checkIns: [{ at: d(-7), by: 'Laura Liepa', progress: 80, note: 'Brief template in use on 4 of 5 projects' }] },
      { id: 'g_7', title: 'Launch the client portal', level: 'person', ownerId: 'p_4', parentId: 'g_5', period: q, progress: 30, status: 'off_track', checkIns: [{ at: d(-10), by: 'Edgars Vitols', progress: 30, note: 'Login done, invoices next' }] },
      { id: 'g_8', title: 'Keep eNPS above 30', level: 'company', ownerId: 'p_7', period: q, progress: 70, status: 'on_track', checkIns: [] },
    ],
    feedback: [
      { id: 'fb_1', aboutId: 'p_3', from: 'Martins Ozols', kind: 'praise', text: 'The Birch brand book landed perfectly and the client asked for you by name.', at: d(-4), private: false },
      { id: 'fb_2', aboutId: 'p_4', from: 'Martins Ozols', kind: 'growth', text: 'Flag blockers on the portal earlier, even half-formed ones.', at: d(-9), private: true },
      { id: 'fb_3', aboutId: 'p_9', from: 'Laura Liepa', kind: 'praise', text: 'Great motion work on the Lumen pitch.', at: d(-2), private: false },
      { id: 'fb_4', aboutId: 'p_5', from: 'Tomas Petraitis', kind: 'praise', text: 'Your follow-ups after the Tallinn event brought in two calls.', at: d(-12), private: false },
    ],
    skills: [
      { id: 'sk_1', name: 'Brand identity', area: 'Design' }, { id: 'sk_2', name: 'UI design', area: 'Design' }, { id: 'sk_3', name: 'Motion', area: 'Design' },
      { id: 'sk_4', name: 'React', area: 'Engineering' }, { id: 'sk_5', name: 'Testing', area: 'Engineering' },
      { id: 'sk_6', name: 'Discovery calls', area: 'Sales' }, { id: 'sk_7', name: 'Proposals', area: 'Sales' }, { id: 'sk_8', name: 'Client care', area: 'Sales' },
    ],
    skillLevels: [
      ['p_3', 'sk_1', 4], ['p_3', 'sk_2', 3], ['p_3', 'sk_3', 1], ['p_9', 'sk_1', 1], ['p_9', 'sk_2', 2], ['p_9', 'sk_3', 3],
      ['p_4', 'sk_4', 3], ['p_4', 'sk_5', 1], ['p_10', 'sk_4', 1], ['p_5', 'sk_6', 2], ['p_5', 'sk_7', 1], ['p_5', 'sk_8', 3], ['p_6', 'sk_6', 4], ['p_6', 'sk_7', 3],
    ].map(([personId, skillId, level]) => ({ personId: personId as string, skillId: skillId as string, level: level as number })),
    roleSkills: [
      ['Senior designer', 'sk_1', 3], ['Senior designer', 'sk_2', 3], ['Designer', 'sk_1', 2], ['Designer', 'sk_2', 2], ['Developer', 'sk_4', 3], ['Developer', 'sk_5', 2],
      ['Junior developer', 'sk_4', 2], ['Account manager', 'sk_6', 2], ['Account manager', 'sk_7', 2], ['Account manager', 'sk_8', 2], ['Sales lead', 'sk_6', 3], ['Sales lead', 'sk_7', 3],
    ].map(([title, skillId, level]) => ({ title: title as string, skillId: skillId as string, level: level as number })),
    training: [
      { id: 'tr_1', personId: 'p_4', course: 'First aid', done: d(-700), expires: d(30) },
      { id: 'tr_2', personId: 'p_7', course: 'Fire safety officer', done: d(-340), expires: d(25) },
      { id: 'tr_3', personId: 'p_9', course: 'After Effects advanced', done: d(-60) },
      { id: 'tr_4', personId: 'p_5', course: 'Consultative selling', done: d(-90) },
      { id: 'tr_5', personId: 'p_3', course: 'Data protection basics', done: d(-400), expires: d(-35) },
    ],
    bands: [
      { title: 'Managing director', min: 4500, max: 6500 }, { title: 'Head of studio', min: 3600, max: 4800 }, { title: 'Senior designer', min: 2800, max: 3600 },
      { title: 'Designer', min: 1900, max: 2600 }, { title: 'UX designer', min: 1900, max: 2700 }, { title: 'Developer', min: 2600, max: 3400 }, { title: 'Junior developer', min: 1500, max: 2000 },
      { title: 'Account manager', min: 2000, max: 2800 }, { title: 'Sales lead', min: 2800, max: 3800 }, { title: 'People and office', min: 1900, max: 2600 }, { title: 'Finance', min: 2300, max: 3000 },
    ],
    pulses: [
      { id: 'pu_1', period: `${year}-Q2`, scores: [9, 8, 10, 7, 6, 9, 8, 9], comments: ['More focus time please', 'Love the team'] },
      { id: 'pu_2', period: `${year}-Q3`, scores: [9, 9, 10, 8, 6, 9, 10, 7, 9], comments: ['Summer Fridays were great', 'Unclear priorities in the studio'] },
    ],
  };
}

/** People+ example data: role kits, two joiners on their journeys, a leaver's kit to collect, and Ask HR questions. */
function withPeoplePlus(base: ReturnType<typeof seedBase>): PeopleData {
  const today = new Date().toISOString().slice(0, 10);
  const d = (n: number) => addDays(today, n);
  const data: PeopleData = {
    ...base,
    journeyTemplates: [
      { id: 'jt_1', name: 'Everyone', teams: [], steps: DEFAULT_JOURNEY },
      { id: 'jt_2', name: 'Studio', teams: ['Studio'], steps: STUDIO_JOURNEY },
      { id: 'jt_3', name: 'Sales', teams: ['Sales'], steps: SALES_JOURNEY },
    ],
    kitItems: [
      { id: 'ki_1', name: 'MacBook Air 13"', category: 'laptop', cost: 1250, leadDays: 7 },
      { id: 'ki_2', name: 'MacBook Pro 14"', category: 'laptop', cost: 2300, leadDays: 10 },
      { id: 'ki_3', name: 'Monitor 27"', category: 'screen', cost: 320, leadDays: 5 },
      { id: 'ki_4', name: 'Headset', category: 'other', cost: 90, leadDays: 3 },
      { id: 'ki_5', name: 'Work phone', category: 'phone', cost: 700, leadDays: 5 },
      { id: 'ki_6', name: 'Google Workspace account', category: 'access', leadDays: 0 },
      { id: 'ki_7', name: 'Slack', category: 'access', leadDays: 0 },
      { id: 'ki_8', name: 'Figma seat', category: 'access', cost: 15, leadDays: 0 },
      { id: 'ki_9', name: 'GitHub seat', category: 'access', cost: 4, leadDays: 0 },
      { id: 'ki_10', name: 'Meridian Sales seat', category: 'access', cost: 19, leadDays: 0 },
    ],
    roleKits: [
      { team: '*', itemIds: ['ki_6', 'ki_7', 'ki_4'] },
      { team: 'Studio', itemIds: ['ki_2', 'ki_3', 'ki_8', 'ki_9'] },
      { team: 'Sales', itemIds: ['ki_1', 'ki_5', 'ki_10'] },
      { team: 'Operations', itemIds: ['ki_1'] },
      { team: 'Leadership', itemIds: ['ki_1', 'ki_5'] },
    ],
    kitRequests: [],
    journeys: [],
    hrQuestions: [],
  };
  const req = (id: string, personId: string, itemId: string, status: KitStatus, neededBy: string, since: number, serial?: string): KitRequest => {
    const flow: KitStatus[] = ['requested', 'ordered', 'ready', 'delivered'];
    const upto = flow.slice(0, flow.indexOf(status) + 1);
    return { id, personId, itemId, status, neededBy, serial, history: upto.map((s, i) => ({ status: s, at: d(since + i * 2), by: i === 0 ? 'Kit agent' : 'Agnese Berzina' })) };
  };
  data.kitRequests = [
    // Anna started two days ago: everything is there except the screen, which is late.
    req('kr_1', 'p_11', 'ki_2', 'delivered', d(-3), -12, 'C02XK1'), req('kr_2', 'p_11', 'ki_3', 'ordered', d(-3), -12),
    req('kr_3', 'p_11', 'ki_8', 'delivered', d(-2), -9), req('kr_4', 'p_11', 'ki_6', 'delivered', d(-2), -9), req('kr_5', 'p_11', 'ki_7', 'delivered', d(-2), -9),
    req('kr_6', 'p_11', 'ki_4', 'ready', d(-3), -7),
    // Aleksis starts in four days: the laptop is ordered, the screen is not yet and its lead time no longer fits.
    req('kr_7', 'p_10', 'ki_2', 'ordered', d(3), -6), req('kr_8', 'p_10', 'ki_3', 'requested', d(3), -1),
    req('kr_9', 'p_10', 'ki_9', 'requested', d(4), -1), req('kr_10', 'p_10', 'ki_6', 'requested', d(4), -1), req('kr_11', 'p_10', 'ki_7', 'requested', d(4), -1),
    // Rolands leaves in 18 days: his kit and accounts come back.
    req('kr_12', 'p_8', 'ki_1', 'delivered', '2024-02-04', -1000, 'C02RT7'), req('kr_13', 'p_8', 'ki_6', 'delivered', '2024-02-05', -1000), req('kr_14', 'p_8', 'ki_7', 'delivered', '2024-02-05', -1000),
  ];
  const person = (id: string) => data.people.find((p) => p.id === id)!;
  const studio = data.journeyTemplates[1];
  const anna = buildJourney(data, person('p_11'), studio, 'jr_1', 'p_9');
  for (const s of anna.steps) if (!s.docId && !s.kitId && s.day <= 1) { s.done = true; s.doneAt = addDays(anna.startDate, Math.max(s.day, -10)); s.doneBy = 'Kalna Studio'; }
  const aleksis = buildJourney(data, person('p_10'), studio, 'jr_2', 'p_4');
  for (const s of aleksis.steps) if (s.day <= -7 && s.owner !== 'newcomer') { s.done = true; s.doneAt = d(-6); s.doneBy = 'Agnese Berzina'; }
  data.journeys = [anna, aleksis];
  const asked: [string, string, number, HrQuestion['status'], string?][] = [
    ['p_9', 'How many vacation days do I have left?', -6, 'helpful'],
    ['p_4', 'Can I expense a new keyboard?', -5, 'helpful'],
    ['p_11', 'Who is my buddy?', -2, 'helpful'],
    ['p_5', 'Can I work from Tallinn for two weeks in January?', -4, 'answered'],
    ['p_6', 'How do expenses work for client dinners?', -3, 'answered'],
    ['p_3', 'Is there a bike-to-work benefit?', -1, 'to_hr'],
    ['p_11', 'Can my partner come to the Christmas party?', 0, 'to_hr'],
  ];
  data.hrQuestions = asked.map(([personId, q, at, status], i) => ({ id: `hq_${i + 1}`, personId, q, at: d(at), status, answer: askHr(data, personId, q, d(at)) }));
  return data;
}
