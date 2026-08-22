// audio/index.ts
// Öffentliche API der Audio-Engine -- 1:1 identisch mit dem, was vorher
// aus der einzelnen audio.ts exportiert wurde. Jede Datei im Projekt
// importiert weiterhin unverändert von "../audio" bzw. "./audio"; dass
// dahinter jetzt sechs Dateien statt einer stehen, ist reines
// Implementierungsdetail.
//
// Bewusst explizite Re-Exports statt `export *`: so bleibt die öffentliche
// Oberfläche exakt kontrolliert -- interne Helfer wie `registry`,
// `MODULE_HANDLERS`, `gateKey`, `gateRoutes` sind absichtlich NICHT Teil
// der Barrel, auch wenn sie modulintern zwischen den audio/*-Dateien
// importiert werden.

export type { VcfEntry, OutEntry, NoiseEntry, SamplerEntry } from "./registry";
export {
  resumeAudio,
  createAudioNode,
  updateAudioNode,
  removeAudioNode,
} from "./registry";

export { gateOn, gateOff, fireGate } from "./gateRouting";

export { connectAudio, disconnectAudio } from "./connections";

export {
  startSamplerRecording,
  stopSamplerRecording,
  triggerSamplerPlayback,
  waitForSamplerReady,
  isSamplerReady,
} from "./samplerControls";

export {
  getVocoderAnalysisLevels,
  getVocoderAnalysisInputLevel,
  getVocoderSynthDebugInfo,
} from "./vocoderDebug";

import "./hmr"; // reiner Seiteneffekt, keine Exporte
