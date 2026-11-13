import { useCallback, useMemo, useRef, useState } from 'react';
import { Activity, ActivityKind, Company, Contact, CrmData, Deal, Stage, Task, emptyCrm, eraseContact, moveDeal } from './domain';
import { Repository, newId } from '../platform/store';

/**
 * All CRM writes go through here: each change is saved, audited, and returns an undo
 * function that puts the data back exactly as it was.
 */
export function useCrm(repo: Repository, user: string) {
  const [data, setData] = useState<CrmData>(() => ({ ...emptyCrm(), ...repo.load() }));
  const ref = useRef(data);
  ref.current = data;

  const commit = useCallback((next: CrmData, audit?: string) => {
    const prev = ref.current;
    repo.save(next);
    if (audit) repo.audit(`${new Date().toISOString()} ${user} ${audit}`);
    ref.current = next;
    setData(next);
    return () => { repo.save(prev); repo.audit(`${new Date().toISOString()} ${user} undid: ${audit ?? 'change'}`); ref.current = prev; setData(prev); };
  }, [repo, user]);

  const now = () => new Date().toISOString();

  return useMemo(() => ({
    data,
    user,
    addCompany(c: Omit<Company, 'id' | 'createdAt'>) {
      const company: Company = { ...c, id: newId('co'), createdAt: now() };
      return { company, undo: commit({ ...data, companies: [...data.companies, company] }, `created company ${company.id}`) };
    },
    updateCompany(id: string, patch: Partial<Company>) {
      return commit({ ...data, companies: data.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, `updated company ${id}`);
    },
    deleteCompany(id: string) {
      return commit({
        ...data,
        companies: data.companies.filter((c) => c.id !== id),
        contacts: data.contacts.map((c) => (c.companyId === id ? { ...c, companyId: undefined } : c)),
        deals: data.deals.map((d) => (d.companyId === id ? { ...d, companyId: undefined } : d)),
      }, `deleted company ${id}`);
    },
    addContact(c: Omit<Contact, 'id' | 'createdAt'>) {
      const contact: Contact = { ...c, id: newId('ct'), createdAt: now() };
      return { contact, undo: commit({ ...data, contacts: [...data.contacts, contact] }, `created contact ${contact.id}`) };
    },
    /** Import: creates the named companies that don't exist yet and links each contact to its company by name. */
    addContacts(rows: { contact: Omit<Contact, 'id' | 'createdAt'>; companyName?: string }[]) {
      const byName = new Map(data.companies.map((c) => [c.name.toLowerCase(), c.id]));
      const companies: Company[] = [];
      for (const r of rows) {
        const n = r.companyName?.trim();
        if (n && !byName.has(n.toLowerCase())) { const co: Company = { id: newId('co'), name: n, createdAt: now() }; companies.push(co); byName.set(n.toLowerCase(), co.id); }
      }
      const contacts: Contact[] = rows.map((r) => ({ ...r.contact, companyId: r.companyName ? byName.get(r.companyName.trim().toLowerCase()) : r.contact.companyId, id: newId('ct'), createdAt: now() }));
      return { added: contacts.length, newCompanies: companies.length, undo: commit({ ...data, companies: [...data.companies, ...companies], contacts: [...data.contacts, ...contacts] }, `imported ${contacts.length} contacts`) };
    },
    updateContact(id: string, patch: Partial<Contact>) {
      return commit({ ...data, contacts: data.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, `updated contact ${id}`);
    },
    addDeal(d: Omit<Deal, 'id' | 'createdAt' | 'currency'>) {
      const deal: Deal = { ...d, id: newId('dl'), currency: 'EUR', createdAt: now() };
      const created: Activity = { id: newId('ac'), kind: 'created', text: `Deal created in ${d.stage}`, at: deal.createdAt, by: user, dealId: deal.id, companyId: deal.companyId, contactId: deal.contactId };
      return { deal, undo: commit({ ...data, deals: [...data.deals, deal], activities: [...data.activities, created] }, `created deal ${deal.id}`) };
    },
    updateDeal(id: string, patch: Partial<Deal>) {
      return commit({ ...data, deals: data.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) }, `updated deal ${id}`);
    },
    deleteDeal(id: string) {
      return commit({ ...data, deals: data.deals.filter((d) => d.id !== id), tasks: data.tasks.filter((t) => t.dealId !== id) }, `deleted deal ${id}`);
    },
    moveDeal(id: string, to: Stage, lostReason?: string) {
      const deal = data.deals.find((d) => d.id === id);
      if (!deal || deal.stage === to) return undefined;
      const r = moveDeal(deal, to, user, now(), newId('ac'), lostReason);
      return commit({ ...data, deals: data.deals.map((d) => (d.id === id ? r.deal : d)), activities: [...data.activities, r.activity] }, `moved deal ${id} to ${to}`);
    },
    log(kind: ActivityKind, text: string, ref: { dealId?: string; contactId?: string; companyId?: string }) {
      const a: Activity = { id: newId('ac'), kind, text, at: now(), by: user, ...ref };
      return commit({ ...data, activities: [...data.activities, a] }, `logged ${kind}`);
    },
    addTask(t: Omit<Task, 'id' | 'done' | 'owner'>) {
      const task: Task = { ...t, id: newId('tk'), done: false, owner: user };
      return commit({ ...data, tasks: [...data.tasks, task] }, `added task ${task.id}`);
    },
    toggleTask(id: string) {
      return commit({ ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }, `toggled task ${id}`);
    },
    deleteTask(id: string) {
      return commit({ ...data, tasks: data.tasks.filter((t) => t.id !== id) }, `deleted task ${id}`);
    },
    erase(contactId: string) {
      const r = eraseContact(data, contactId, user, now());
      repo.audit(r.log);
      commit(r.data);
    },
  }), [data, commit, repo, user]);
}

export type Crm = ReturnType<typeof useCrm>;
