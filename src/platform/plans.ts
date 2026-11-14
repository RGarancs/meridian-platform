// Pricing options for Corta Meridian. Three ways to charge, so they can be compared on one customer.
// Draft numbers for Rihards to decide on; nothing here bills anyone.
import { tr } from './i18n';

export type ModelId = 'seats' | 'bundles' | 'partner';
export interface Need { users: number; employees: number; clients: number }

export const SEAT = { sales: 19, people: 6 }; // € a month: per Sales user, per employee in People
export const BUNDLES = [
  { id: 'starter', name: 'Starter', price: 149, users: 10, employees: 25 },
  { id: 'growth', name: 'Growth', price: 399, users: 30, employees: 100 },
  { id: 'scale', name: 'Scale', price: 899, users: Infinity, employees: Infinity },
] as const;
export const PARTNER = { base: 490, perClient: 49 };
export const ANNUAL_DISCOUNT = 0.15;

/** Monthly price in euro for one customer under each model. */
export function quote(model: ModelId, n: Need): { monthly: number; detail: string } {
  if (model === 'seats') {
    const monthly = n.users * SEAT.sales + n.employees * SEAT.people;
    return { monthly, detail: tr('{0} users × €{1} + {2} employees × €{3}', { 0: n.users, 1: SEAT.sales, 2: n.employees, 3: SEAT.people }) };
  }
  if (model === 'bundles') {
    const b = BUNDLES.find((x) => n.users <= x.users && n.employees <= x.employees) ?? BUNDLES[BUNDLES.length - 1];
    return { monthly: b.price, detail: tr('{0} plan', { 0: b.name }) };
  }
  const monthly = PARTNER.base + n.clients * PARTNER.perClient;
  return { monthly, detail: tr('€{0} platform + {1} client workspaces × €{2}', { 0: PARTNER.base, 1: n.clients, 2: PARTNER.perClient }) };
}

export const yearly = (monthly: number) => Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
