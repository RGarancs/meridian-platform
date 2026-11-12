import { useCallback, useMemo, useState } from 'react';
import { Activity, ActivityKind, Company, Contact, CrmData, Deal, Stage, eraseContact, moveDeal } from './domain';
import { Repository, newId } from '../platform/store';

/** All CRM writes go through here so every change is saved and audited the same way. */
export function useCrm(repo: Repository, user: string) {
  const [data, setData] = useState<CrmData>(() => repo.load());

  const commit = useCallback((next: CrmData, audit?: string) => {
    repo.save(next);
    if (audit) repo.audit(`${new Date().toISOString()} ${user} ${audit}`);
    setData(next);
  }, [repo, user]);

  const now = () => new Date().toISOString();

  return useMemo(() => ({
    data,
    addCompany(c: Omit<Company, 'id' | 'createdAt'>) {
      const company: Company = { ...c, id: newId('co'), createdAt: now() };
      commit({ ...data, companies: [...data.companies, company] }, `created company ${company.id}`);
      return company;
    },
    addContact(c: Omit<Contact, 'id' | 'createdAt'>) {
      const contact: Contact = { ...c, id: newId('ct'), createdAt: now() };
      commit({ ...data, contacts: [...data.contacts, contact] }, `created contact ${contact.id}`);
      return contact;
    },
    addDeal(d: Omit<Deal, 'id' | 'createdAt' | 'currency'>) {
      const deal: Deal = { ...d, id: newId('dl'), currency: 'EUR', createdAt: now() };
      const created: Activity = { id: newId('ac'), kind: 'created', text: `Deal created in ${d.stage}`, at: deal.createdAt, by: user, dealId: deal.id, companyId: deal.companyId, contactId: deal.contactId };
      commit({ ...data, deals: [...data.deals, deal], activities: [...data.activities, created] }, `created deal ${deal.id}`);
      return deal;
    },
    updateDeal(id: string, patch: Partial<Deal>) {
      commit({ ...data, deals: data.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) }, `updated deal ${id}`);
    },
    moveDeal(id: string, to: Stage, lostReason?: string) {
      const deal = data.deals.find((d) => d.id === id);
      if (!deal || deal.stage === to) return;
      const r = moveDeal(deal, to, user, now(), newId('ac'), lostReason);
      commit({ ...data, deals: data.deals.map((d) => (d.id === id ? r.deal : d)), activities: [...data.activities, r.activity] }, `moved deal ${id} to ${to}`);
    },
    log(kind: ActivityKind, text: string, ref: { dealId?: string; contactId?: string; companyId?: string }) {
      const a: Activity = { id: newId('ac'), kind, text, at: now(), by: user, ...ref };
      commit({ ...data, activities: [...data.activities, a] }, `logged ${kind}`);
    },
    erase(contactId: string) {
      const r = eraseContact(data, contactId, user, now());
      repo.audit(r.log);
      commit(r.data);
    },
  }), [data, commit, repo, user]);
}

export type Crm = ReturnType<typeof useCrm>;
