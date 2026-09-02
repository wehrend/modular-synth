import type { AppNode } from "./types";

export type ModuleCatalogEntry = {
  type: AppNode["type"];
  idPrefix: string;
  labelKey: string; // i18next-Schlüssel, z.B. "modules.catalog.osc" -- Katalog liegt im
  // Modul-Scope (kein Hook-Kontext), deshalb wird hier NICHT übersetzt,
  // sondern erst beim Rendern in App.tsx via t(entry.labelKey).
  basePosition: { x: number; y: number };
  defaults: () => AppNode["data"];
};

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    type: "osc",
    idPrefix: "osc",
    labelKey: "modules.catalog.osc",
    basePosition: { x: 60, y: 320 },
    // moduleCatalog.ts
    defaults: () => ({
      frequency: 440,
      waveform: "sine",
      running: false,
      cvAmount: 1,
    }),
  },
  {
    type: "mixer",
    idPrefix: "mixer",
    labelKey: "modules.catalog.mixer",
    basePosition: { x: 300, y: 320 },
    defaults: () => ({ ch1: 0.8, ch2: 0.8, ch3: 0.8, master: 0.8 }),
  },
  {
    type: "vcf",
    idPrefix: "filter",
    labelKey: "modules.catalog.vcf",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      cutoff: 1200,
      resonance: 2,
      filterType: "lowpass",
      cutoffAmount: 2000,
      resonanceAmount: 1,
    }),
  },
  {
    type: "envelope",
    idPrefix: "envelope",
    labelKey: "modules.catalog.envelope",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 }),
  },
  {
    type: "ringmod",
    idPrefix: "ringmod",
    labelKey: "modules.catalog.ringmod",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({}),
  },
  {
    type: "wasp",
    idPrefix: "wasp",
    labelKey: "modules.catalog.wasp",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      cutoff: 1200,
      resonance: 0.3,
      drive: 0.4,
      cutoffAmount: 2000,
    }),
  },
  {
    type: "lfo",
    idPrefix: "lfo",
    labelKey: "modules.catalog.lfo",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ rate: 4.4, waveform: "sawtooth" }),
  },
  {
    type: "noise",
    idPrefix: "noise",
    labelKey: "modules.catalog.noise",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ whiteVolume: -20, pinkVolume: -20, brownVolume: -20 }),
  },
  {
    type: "vca",
    idPrefix: "vca",
    labelKey: "modules.catalog.vca",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ gain: 0.5 }),
  },
  {
    type: "sequencer",
    idPrefix: "sequencer",
    labelKey: "modules.catalog.sequencer",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      steps: 8,
      bpm: 120,
      running: false,
      cvValues: [220, 262, 294, 330, 349, 330, 294, 262],
    }),
  },
  {
    type: "sampler",
    idPrefix: "sampler",
    labelKey: "modules.catalog.sampler",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      recording: false,
      hasSample: false,
      playbackRate: 1,
      gain: 1,
      sampleUrl: null,
    }),
  },
  {
    type: "vocoderAnalysis",
    idPrefix: "vocoderAnalysis",
    labelKey: "modules.catalog.vocoderAnalysis",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ sensitivity: 0.02 }),
  },
  {
    type: "vocoderSynth",
    idPrefix: "vocoderSynth",
    labelKey: "modules.catalog.vocoderSynth",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({}),
  },
  {
    type: "voicedUnvoiced",
    idPrefix: "voicedUnvoiced",
    labelKey: "modules.catalog.voicedUnvoiced",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ gain: 1, trebleBoost: 6 }),
  },
  {
    type: "panner",
    idPrefix: "panner",
    labelKey: "modules.catalog.panner",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ pan: 0, panAmount: 0 }),
  },
  {
    type: "evenvco",
    idPrefix: "evenvco",
    labelKey: "modules.catalog.evenvco",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      octave: 5,
      fineTune: 0,
      slaveFreq: 440,
    }),
  },
];
