// audio/vocoderDebug.ts
// Liest Meter-Werte aus den Vocoder-Nodes aus. getVocoderAnalysisLevels
// speist die Live-Pegelanzeige in VocoderAnalysisNode.tsx, ist also aktiv
// im Einsatz. getVocoderSynthDebugInfo diente ursprünglich einem
// Konsolen-Debug-Log, der inzwischen entfernt wurde -- aktuell ohne
// Aufrufer. Absichtlich noch nicht gelöscht, falls eine Live-Anzeige für
// die Synth-Seite (analog zur Analysis-Seite) später gewünscht ist.

import { registry } from "./registry";

export function getVocoderAnalysisLevels(id: string): number[] | null {
  const node = registry.get(id);
  if (node?.type !== "vocoderAnalysis") return null;
  return node.bands.map((band) => band.meter.getValue() as number);
}

export function getVocoderAnalysisInputLevel(id: string): number | null {
  const node = registry.get(id);
  if (node?.type !== "vocoderAnalysis") return null;
  return node.inputMeter.getValue() as number;
}

/** @deprecated Aktuell ohne Aufrufer, s. Kommentar am Dateianfang. */
export function getVocoderSynthDebugInfo(
  id: string,
): { carrier: number; bands: number[]; output: number } | null {
  const node = registry.get(id);
  if (node?.type !== "vocoderSynth") return null;
  return {
    carrier: node.carrierMeter.getValue() as number,
    bands: node.bands.map((band) => band.cvMeter.getValue() as number),
    output: node.outputMeter.getValue() as number,
  };
}
