// audio/gateRouting.ts
// Gate-Routing läuft parallel zum Audiographen, aber ohne echte
// Tone.js-Verbindung -- ein Gate-Kabel im Flow-Graph triggert hier direkt
// Funktionsaufrufe (triggerAttack/triggerRelease, Sample-Start) statt
// Audiosignale zu verbinden.

import { registry } from "./registry";

// sourceId -> Menge der Ziel-IDs, die dieses Gate-Signal empfangen.
// Schlüssel "sourceId::sourceHandle" statt nur "sourceId" -- ein Knoten
// kann mehrere unabhängige Gate-Ausgänge haben (CD4017: bis zu 10).
export const gateRoutes = new Map<string, Set<string>>();

export function gateKey(sourceId: string, sourceHandle: string): string {
  return `${sourceId}::${sourceHandle}`;
}

/** Gate an: Attack-Phase starten (Taste gedrückt). */
export function gateOn(id: string): void {
  const node = registry.get(id);
  if (node?.type === "envelope") node.env.triggerAttack();
  if (node?.type === "sampler") {
    if (node.player.state === "started") node.player.stop();
    node.player.start();
  }
}

/** Gate aus: Release-Phase starten (Taste losgelassen). */
export function gateOff(id: string): void {
  const node = registry.get(id);
  if (node?.type === "envelope") node.env.triggerRelease();
}

export function fireGate(
  sourceId: string,
  sourceHandle: string,
  on: boolean,
): void {
  gateRoutes.get(gateKey(sourceId, sourceHandle))?.forEach((targetId) => {
    if (on) gateOn(targetId);
    else gateOff(targetId);
  });
}
