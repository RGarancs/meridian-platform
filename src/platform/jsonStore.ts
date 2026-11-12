// Per-module browser storage for the demo (hosted tenants use Supabase instead).
export function loadJson<T>(key: string, seed: () => T): T {
  try { const raw = localStorage.getItem(`meridian:demo:${key}`); if (raw) return { ...seed(), ...JSON.parse(raw) }; } catch { /* blocked */ }
  return seed();
}
export function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(`meridian:demo:${key}`, JSON.stringify(value)); } catch { /* private window */ }
}
export function clearJson(key: string) { try { localStorage.removeItem(`meridian:demo:${key}`); } catch { /* ignore */ } }
