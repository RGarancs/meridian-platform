import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Candidate, CandidateStage, DocKind, Feedback, Goal, GoalLevel, HrDocument, LeaveRequest, Opening, PeopleData, Person, ReviewGoal,
  activePeople, checkIn, moveCandidate, periodShare, publishNewVersion, startOffboarding, startOnboarding,
} from './domain';
import { loadJson, saveJson } from '../platform/jsonStore';
import { seedPeople } from './seed';

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * All People writes go through here. Every change is saved and returns an undo function
 * that puts the data back exactly as it was, so the page can offer Undo in its toast.
 */
export function usePeople(user: string) {
  const [data, setData] = useState<PeopleData>(() => loadJson('people', seedPeople));
  const ref = useRef(data);
  ref.current = data;

  const commit = useCallback((next: PeopleData) => {
    const prev = ref.current;
    saveJson('people', next); ref.current = next; setData(next);
    return () => { saveJson('people', prev); ref.current = prev; setData(prev); };
  }, []);

  return useMemo(() => {
    const d = data;
    const mapIn = <K extends keyof PeopleData>(key: K, id: string, fn: (x: PeopleData[K][number]) => PeopleData[K][number]) =>
      commit({ ...d, [key]: (d[key] as { id?: string }[]).map((x) => (x.id === id ? fn(x as PeopleData[K][number]) : x)) } as PeopleData);
    return {
      data: d, user,

      // people
      addPerson(p: Omit<Person, 'id'>) {
        const person: Person = { ...p, id: nid('p') };
        const onb = p.startDate > today() ? [startOnboarding(person.id, p.startDate, nid('ob'))] : [];
        return { person, undo: commit({ ...d, people: [...d.people, person], onboarding: [...d.onboarding, ...onb] }) };
      },
      updatePerson(id: string, patch: Partial<Person>) { return commit({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }); },
      startLeaving(personId: string, lastDay: string) {
        return commit({
          ...d,
          people: d.people.map((p) => (p.id === personId ? { ...p, lastDay } : p)),
          offboarding: [...d.offboarding.filter((o) => o.personId !== personId), startOffboarding(personId, lastDay, nid('of'))],
        });
      },

      // time off
      requestLeave(r: Omit<LeaveRequest, 'id' | 'status'>) { return commit({ ...d, leave: [...d.leave, { ...r, id: nid('lv'), status: 'pending' }] }); },
      decideLeave(id: string, status: 'approved' | 'declined') { return mapIn('leave', id, (r) => ({ ...r, status, decidedBy: user })); },
      cancelLeave(id: string) { return commit({ ...d, leave: d.leave.filter((r) => r.id !== id) }); },

      // joiners and leavers
      toggleTask(list: 'onboarding' | 'offboarding', listId: string, taskId: string) {
        return commit({ ...d, [list]: d[list].map((o) => (o.id === listId ? { ...o, tasks: o.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) } : o)) });
      },

      // hiring
      addOpening(o: Omit<Opening, 'id' | 'open'>) { return commit({ ...d, openings: [...d.openings, { ...o, id: nid('op'), open: true }] }); },
      closeOpening(id: string) { return mapIn('openings', id, (o) => ({ ...o, open: false })); },
      addCandidate(c: Omit<Candidate, 'id' | 'stage' | 'scores' | 'appliedAt' | 'retainUntil'>) {
        const at = today();
        const retain = new Date(`${at}T00:00:00Z`); retain.setUTCMonth(retain.getUTCMonth() + 6);
        return commit({ ...d, candidates: [...d.candidates, { ...c, id: nid('cd'), stage: 'applied', scores: [], appliedAt: at, retainUntil: retain.toISOString().slice(0, 10) }] });
      },
      moveCandidate(id: string, to: CandidateStage, reason?: string) { return mapIn('candidates', id, (c) => moveCandidate(c, to, reason)); },
      scoreCandidate(id: string, score: number) { return mapIn('candidates', id, (c) => ({ ...c, scores: [...c.scores, score] })); },
      deleteCandidates(ids: string[]) { return commit({ ...d, candidates: d.candidates.filter((c) => !ids.includes(c.id)) }); },
      hire(candidateId: string, startDate: string, salary?: number) {
        const c = d.candidates.find((x) => x.id === candidateId)!;
        const op = d.openings.find((o) => o.id === c.openingId)!;
        const person: Person = { id: nid('p'), name: c.name, email: c.email ?? '', title: op.title, team: op.team, managerId: op.hiringManagerId, startDate, location: 'Riga', leaveAllowance: 20, salary, bonusTarget: 0.05 };
        return {
          person,
          undo: commit({
            ...d,
            people: [...d.people, person],
            candidates: d.candidates.map((x) => (x.id === candidateId ? { ...x, stage: 'hired' } : x)),
            openings: d.openings.map((o) => (o.id === op.id ? { ...o, open: false } : o)),
            onboarding: [...d.onboarding, startOnboarding(person.id, startDate, nid('ob'))],
          }),
        };
      },

      // documents
      addDocument(doc: { title: string; kind: DocKind; personId?: string; requiresAck: boolean; expires?: string; body?: string }) {
        return commit({ ...d, documents: [...d.documents, { ...doc, id: nid('dc'), version: 1, updatedAt: today(), acks: [] }] });
      },
      newVersion(id: string, body?: string) { return mapIn('documents', id, (x) => publishNewVersion(x as HrDocument, today(), body)); },
      acknowledge(id: string, personId: string) {
        return mapIn('documents', id, (x) => ({ ...x, acks: [...x.acks.filter((a) => a.personId !== personId), { personId, version: x.version, at: today() }] }));
      },
      deleteDocument(id: string) { return commit({ ...d, documents: d.documents.filter((x) => x.id !== id) }); },

      // goals
      addGoal(g: { title: string; level: GoalLevel; ownerId?: string; team?: string; parentId?: string; period: string }) {
        const goal: Goal = { ...g, id: nid('g'), progress: 0, status: 'on_track', checkIns: [] };
        return commit({ ...d, goals: [...d.goals, goal] });
      },
      checkIn(id: string, progress: number, note: string) { return mapIn('goals', id, (g) => checkIn(g, progress, note, user, today(), periodShare(g.period, today()))); },
      deleteGoal(id: string) { return commit({ ...d, goals: d.goals.filter((g) => g.id !== id).map((g) => (g.parentId === id ? { ...g, parentId: undefined } : g)) }); },

      // performance
      giveFeedback(f: Omit<Feedback, 'id' | 'at' | 'from'>) { return commit({ ...d, feedback: [...d.feedback, { ...f, id: nid('fb'), at: today(), from: user }] }); },
      startCycle(cycle: string) {
        const have = new Set(d.reviews.filter((r) => r.cycle === cycle).map((r) => r.personId));
        const fresh = activePeople(d, today()).filter((p) => !have.has(p.id) && !p.lastDay).map((p) => ({ id: nid('rv'), personId: p.id, cycle, goals: [], selfDone: false, managerDone: false }));
        return { added: fresh.length, undo: commit({ ...d, reviews: [...d.reviews, ...fresh] }) };
      },
      setReviewGoals(id: string, goals: ReviewGoal[]) { return mapIn('reviews', id, (r) => ({ ...r, goals })); },
      scoreReviewGoal(id: string, i: number, score: number) { return mapIn('reviews', id, (r) => ({ ...r, goals: r.goals.map((g, j) => (j === i ? { ...g, score } : g)) })); },
      finishSelf(id: string) { return mapIn('reviews', id, (r) => ({ ...r, selfDone: true })); },
      finishManager(id: string) { return mapIn('reviews', id, (r) => ({ ...r, managerDone: true })); },

      // skills and training
      setSkillLevel(personId: string, skillId: string, level: number) {
        return commit({ ...d, skillLevels: [...d.skillLevels.filter((l) => !(l.personId === personId && l.skillId === skillId)), { personId, skillId, level }] });
      },
      addTraining(t: { personId: string; course: string; done: string; expires?: string }) { return commit({ ...d, training: [...d.training, { ...t, id: nid('tr') }] }); },

      // pay
      setBand(title: string, min: number, max: number) { return commit({ ...d, bands: [...d.bands.filter((b) => b.title !== title), { title, min, max }] }); },

      // pulse
      answerPulse(period: string, score: number, comment: string) {
        const has = d.pulses.find((p) => p.period === period);
        const pulses = has
          ? d.pulses.map((p) => (p.period === period ? { ...p, scores: [...p.scores, score], comments: comment ? [...p.comments, comment] : p.comments } : p))
          : [...d.pulses, { id: nid('pu'), period, scores: [score], comments: comment ? [comment] : [] }];
        return commit({ ...d, pulses });
      },
    };
  }, [data, user, commit]);
}

export type People = ReturnType<typeof usePeople>;
