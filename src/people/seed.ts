// Invented example team for "Kalna Studio". No real people.
import { PeopleData, addDays, startOnboarding } from './domain';

export function seedPeople(): PeopleData {
  const today = new Date().toISOString().slice(0, 10);
  const d = (n: number) => addDays(today, n);
  const year = today.slice(0, 4);
  const onb = startOnboarding('p_10', d(4), 'ob_1');
  onb.tasks[0].done = true;
  return {
    people: [
      { id: 'p_1', name: 'Ilze Kalnina', email: 'ilze@kalna.example', title: 'Managing director', team: 'Leadership', startDate: '2019-02-01', location: 'Riga', leaveAllowance: 25 },
      { id: 'p_2', name: 'Martins Ozols', email: 'martins@kalna.example', title: 'Head of studio', team: 'Studio', managerId: 'p_1', startDate: '2020-05-04', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_3', name: 'Laura Liepa', email: 'laura@kalna.example', title: 'Senior designer', team: 'Studio', managerId: 'p_2', startDate: '2021-09-01', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_4', name: 'Edgars Vitols', email: 'edgars@kalna.example', title: 'Developer', team: 'Studio', managerId: 'p_2', startDate: '2023-03-13', location: 'Remote, Liepaja', leaveAllowance: 20 },
      { id: 'p_5', name: 'Kadri Tamm', email: 'kadri@kalna.example', title: 'Account manager', team: 'Sales', managerId: 'p_1', startDate: '2022-01-10', location: 'Tallinn', leaveAllowance: 20 },
      { id: 'p_6', name: 'Tomas Petraitis', email: 'tomas@kalna.example', title: 'Sales lead', team: 'Sales', managerId: 'p_1', startDate: '2021-04-19', location: 'Vilnius', leaveAllowance: 20 },
      { id: 'p_7', name: 'Agnese Berzina', email: 'agnese@kalna.example', title: 'People and office', team: 'Operations', managerId: 'p_1', startDate: '2022-08-22', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_8', name: 'Rolands Krumins', email: 'rolands@kalna.example', title: 'Finance', team: 'Operations', managerId: 'p_1', startDate: '2024-02-05', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_9', name: 'Signe Eglite', email: 'signe@kalna.example', title: 'Designer', team: 'Studio', managerId: 'p_2', startDate: '2025-06-02', location: 'Riga', leaveAllowance: 20 },
      { id: 'p_10', name: 'Aleksis Upitis', email: 'aleksis@kalna.example', title: 'Junior developer', team: 'Studio', managerId: 'p_2', startDate: d(4), location: 'Riga', leaveAllowance: 20 },
    ],
    leave: [
      { id: 'lv_1', personId: 'p_3', kind: 'vacation', from: `${year}-07-13`, to: `${year}-07-24`, status: 'approved', decidedBy: 'Martins Ozols' },
      { id: 'lv_2', personId: 'p_4', kind: 'vacation', from: d(-1), to: d(1), status: 'approved', decidedBy: 'Martins Ozols' },
      { id: 'lv_3', personId: 'p_5', kind: 'sick', from: d(0), to: d(0), status: 'approved', decidedBy: 'Ilze Kalnina' },
      { id: 'lv_4', personId: 'p_9', kind: 'vacation', from: d(12), to: d(16), status: 'pending', note: 'Family trip' },
      { id: 'lv_5', personId: 'p_3', kind: 'vacation', from: d(13), to: d(14), status: 'pending' },
      { id: 'lv_6', personId: 'p_6', kind: 'study', from: d(20), to: d(21), status: 'pending', note: 'Exam at SSE Riga' },
    ],
    onboarding: [onb],
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
  };
}
