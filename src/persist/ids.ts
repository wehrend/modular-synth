// persist/ids.ts
const counters = new Map<string, number>();

export function nextId(moduleType: string): string {
  const n = (counters.get(moduleType) ?? 0) + 1;
  counters.set(moduleType, n);
  return `${moduleType}-${n}`;
}

/** Zähler an einen geladenen Knotensatz anpassen. */
export function seedIds(ids: string[]): void {
  counters.clear();
  for (const id of ids) {
    const match = /^(.+)-(\d+)$/.exec(id);
    if (!match) continue;
    const [, type, numStr] = match;
    const n = Number(numStr);
    if ((counters.get(type) ?? 0) < n) counters.set(type, n);
  }
}