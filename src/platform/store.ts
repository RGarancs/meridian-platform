// Storage behind one small interface. LocalRepository keeps a tenant's data in the
// browser for the demo; SupabaseRepository (supabase/migrations) replaces it for
// hosted tenants without any page changing.

import { CrmData, emptyCrm } from '../crm/domain';

export interface Repository {
  load(): CrmData;
  save(data: CrmData): void;
  audit(line: string): void;
  auditLog(): string[];
}

export class LocalRepository implements Repository {
  constructor(private tenant: string, private seed: () => CrmData) {}
  private key(k: string) { return `meridian:${this.tenant}:${k}`; }

  load(): CrmData {
    try {
      const raw = localStorage.getItem(this.key('crm'));
      if (raw) return { ...emptyCrm(), ...JSON.parse(raw) };
    } catch { /* storage blocked or corrupt: fall back to seed */ }
    const data = this.seed();
    this.save(data);
    return data;
  }
  save(data: CrmData) {
    try { localStorage.setItem(this.key('crm'), JSON.stringify(data)); } catch { /* private window */ }
  }
  audit(line: string) {
    const log = this.auditLog();
    log.push(line);
    try { localStorage.setItem(this.key('audit'), JSON.stringify(log.slice(-500))); } catch { /* ignore */ }
  }
  auditLog(): string[] {
    try { return JSON.parse(localStorage.getItem(this.key('audit')) ?? '[]'); } catch { return []; }
  }
  reset() {
    try { localStorage.removeItem(this.key('crm')); localStorage.removeItem(this.key('audit')); } catch { /* ignore */ }
  }
}

let n = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
