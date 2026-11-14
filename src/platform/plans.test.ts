import { describe, expect, it } from 'vitest';
import { quote, yearly } from './plans';

describe('pricing options', () => {
  it('charges per user and per employee', () => {
    expect(quote('seats', { users: 8, employees: 40, clients: 0 }).monthly).toBe(8 * 19 + 40 * 6);
  });
  it('picks the smallest plan that fits both limits', () => {
    expect(quote('bundles', { users: 10, employees: 25, clients: 0 }).monthly).toBe(149);
    expect(quote('bundles', { users: 5, employees: 26, clients: 0 }).monthly).toBe(399);
    expect(quote('bundles', { users: 31, employees: 10, clients: 0 }).monthly).toBe(899);
  });
  it('charges a partner a base fee plus each client workspace', () => {
    expect(quote('partner', { users: 0, employees: 0, clients: 10 }).monthly).toBe(490 + 10 * 49);
  });
  it('takes 15% off a year paid up front', () => {
    expect(yearly(100)).toBe(1020);
  });
});
