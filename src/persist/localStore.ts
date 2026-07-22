// persist/localStore.ts
import { parsePatchDocument, type PatchDocument } from "./serialize";

const PREFIX = "modular-synth:preset:";

export type PresetMeta = { name: string; savedAt: string };

export function listPresets(): PresetMeta[] {
  const out: PresetMeta[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key)!) as {
        savedAt: string;
      };
      out.push({ name: key.slice(PREFIX.length), savedAt: parsed.savedAt });
    } catch {
      // korrupten Eintrag überspringen statt die ganze Liste zu sprengen
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function savePreset(name: string, doc: PatchDocument): void {
  localStorage.setItem(
    PREFIX + name,
    JSON.stringify({ ...doc, savedAt: new Date().toISOString() }),
  );
}

export function loadPreset(name: string): PatchDocument {
  const raw = localStorage.getItem(PREFIX + name);
  if (!raw) throw new Error(`Preset "${name}" nicht gefunden.`);
  return parsePatchDocument(JSON.parse(raw));
}

export function deletePreset(name: string): void {
  localStorage.removeItem(PREFIX + name);
}
