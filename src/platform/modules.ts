// The one list of platform modules. The sidebar, the module map and the
// tenant's plan all read from here, so a module is added in one place.

export type ModuleStatus = 'live' | 'next' | 'planned';

export interface ModuleDef {
  id: string;
  name: string;
  oneLine: string;
  status: ModuleStatus;
  /** What already exists elsewhere and gets folded in. */
  buildsOn: string[];
}

export const MODULES: ModuleDef[] = [
  { id: 'sales', name: 'Sales', oneLine: 'CRM, follow-ups and support in one timeline', status: 'live', buildsOn: ['Meridian OS Pipeline', 'Meridian Growth pipeline'] },
  { id: 'people', name: 'People', oneLine: 'Hiring, onboarding, leave, reviews and growth', status: 'next', buildsOn: ['HPT Index', 'vakances-lv salary data'] },
  { id: 'marketing', name: 'Marketing', oneLine: 'From brand to campaign to results, with sources', status: 'planned', buildsOn: ['Meridian Marketing', 'Meridian OS', 'Meridian Motion', 'Meridian Growth'] },
  { id: 'work', name: 'Work', oneLine: "Goals down to today's tasks, and the updates in between", status: 'planned', buildsOn: ['Cockpit goals'] },
  { id: 'insights', name: 'Insights', oneLine: 'Your numbers explained, with the decision they point to', status: 'planned', buildsOn: ['Mantinieks', 'datalab analytics'] },
  { id: 'strategy', name: 'Strategy', oneLine: 'Research, options and a team workbook', status: 'planned', buildsOn: ['Where AI belongs', 'Decision coach', 'Proving Ground'] },
  { id: 'academy', name: 'Academy', oneLine: 'Courses and AI coaching inside the work', status: 'planned', buildsOn: ['Applied AI Academy', 'miniMBA LMS'] },
  { id: 'studio', name: 'Studio', oneLine: 'Presentations, boards, processes, documents', status: 'planned', buildsOn: ['NS Board v3', 'presentation tools'] },
  { id: 'ledger', name: 'Ledger', oneLine: 'Small-team finance, invoices and runway', status: 'planned', buildsOn: ['FIRE app', 'HPT invoices'] },
  { id: 'harness', name: 'Harness', oneLine: 'Build with AI the safe way: plugins, design system, cockpit', status: 'planned', buildsOn: ['conductor', 'rihards-protocol', 'ai-native-kit', 'Meridian design system'] },
];
