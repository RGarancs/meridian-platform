import { LeaveKind, PeopleData, Person } from './domain';
import { fmtDay } from '../platform/ui';

export const KIND: Record<LeaveKind, string> = { vacation: 'Vacation', sick: 'Sick', unpaid: 'Unpaid', parental: 'Parental', study: 'Study' };
export const OWNER = { hr: 'HR', manager: 'Manager', it: 'IT', newcomer: 'Newcomer' } as const;
export const nameOf = (d: PeopleData, id?: string) => d.people.find((p) => p.id === id)?.name ?? '—';
export const range = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);
export const money = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;
export const currentQuarter = (t: string) => `${t.slice(0, 4)}-Q${Math.floor((Number(t.slice(5, 7)) - 1) / 3) + 1}`;
export const currentCycle = (t: string) => `${Number(t.slice(5, 7)) <= 6 ? 'H1' : 'H2'} ${t.slice(0, 4)}`;

export function PersonSelect({ id, people, value, onChange, none }: { id: string; people: Person[]; value: string; onChange: (v: string) => void; none?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {none !== undefined && <option value="">{none}</option>}
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

/** 1 to 5 picker used for interview scores and review goals. */
export function Score({ value, onChange, label }: { value?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="seg sm" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={value === n} onClick={() => onChange(n)}>{n}</button>)}
    </div>
  );
}
