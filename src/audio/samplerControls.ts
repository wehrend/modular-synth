// audio/samplerControls.ts
// Sampler-spezifische Steuerung, die über das generische update()-Patch-
// Muster hinausgeht -- Aufnahme-Start/Stop liefern ein asynchrones
// Ergebnis (den aufgenommenen Blob), das nicht in ein normales, synchrones
// Parameter-Update passt.

import { registry } from "./registry";

export async function startSamplerRecording(id: string): Promise<void> {
  const node = registry.get(id);
  if (node?.type !== "sampler") return;

  // Mikro nur öffnen, wenn es nicht schon offen ist -- unnötiges
  // erneutes getUserMedia() bei jeder Aufnahme vermeiden.
  if (node.mic.state !== "started") {
    await node.mic.open(); // fragt bei Bedarf nach Mikrofonberechtigung
  }

  // Falls der Recorder aus irgendeinem Grund schon läuft (z.B. State
  // durch einen vorherigen Fehler nicht sauber zurückgesetzt), nicht
  // nochmal start() aufrufen -- das würde einen Assert werfen.
  if (node.recorder.state === "started") return;

  await node.recorder.start();
}

export async function stopSamplerRecording(id: string): Promise<Blob | null> {
  const node = registry.get(id);
  if (node?.type !== "sampler") return null;

  // Wurde nie erfolgreich gestartet (z.B. weil startSamplerRecording
  // vorher geworfen hat) -- nichts zu stoppen, sonst Assert-Fehler.
  if (node.recorder.state !== "started") return null;

  await node.pendingLoad;

  const blob = await node.recorder.stop();
  const url = URL.createObjectURL(blob);
  await node.player.load(url);
  URL.revokeObjectURL(url);
  return blob;
}

export function triggerSamplerPlayback(id: string): void {
  const node = registry.get(id);
  if (node?.type !== "sampler") return;
  if (!node.player.loaded) {
    return;
  }
  if (node.player.state === "started") node.player.stop();
  node.player.start();
}

/**
 * Wartet, bis der aktuell zugewiesene Sample-Buffer des Sampler-Nodes
 * fertig geladen ist (lokal oder remote, z.B. von Supabase). Wichtig für
 * die UI: "hasSample" im Patch sagt nur, dass IRGENDWANN eine Aufnahme
 * existierte -- nicht, ob der Tone.Player den Buffer JETZT schon geladen
 * hat. Play-Klicks vor Ladeende sind sonst stumm, ohne Fehler.
 */
export async function waitForSamplerReady(id: string): Promise<void> {
  const node = registry.get(id);
  if (node?.type !== "sampler") return;
  await node.pendingLoad;
}

export function isSamplerReady(id: string): boolean {
  const node = registry.get(id);
  if (node?.type !== "sampler") return false;
  return node.player.loaded;
}
