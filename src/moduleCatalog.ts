import type { AppNode } from "./types";

export type ModuleCatalogEntry = {
  type: AppNode["type"];
  idPrefix: string;
  label: string;
  basePosition: { x: number; y: number };
  defaults: () => AppNode["data"];
};

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    type: "osc",
    idPrefix: "osc",
    label: "+ Oszillator",
    basePosition: { x: 60, y: 320 },
    defaults: () => ({ frequency: 440, waveform: "sine", running: false }),
  },
  {
    type: "mixer",
    idPrefix: "mixer",
    label: "+ Mixer",
    basePosition: { x: 300, y: 320 },
    defaults: () => ({ ch1: 0.8, ch2: 0.8, ch3: 0.8, master: 0.8 }),
  },
  {
    type: "vcf",
    idPrefix: "filter",
    label: "+ Filter",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      cutoff: 1200,
      resonance: 2,
      filterType: "lowpass",
      cutoffAmount: 2000,
      resonanceAmount: 0,
    }),
  },
  {
    type: "envelope",
    idPrefix: "envelope",
    label: "+ ADSR / Envelope",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 }),
  },
  {
    type: "ringmod",
    idPrefix: "ringmod",
    label: "+ Ring Mod",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({}),
  },
  {
    type: "wasp",
    idPrefix: "wasp",
    label: "+ Wasp Filter",
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
    label: "+ LFO",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ rate: 4.4, waveform: "sawtooth" }),
  },
  {
    type: "noise",
    idPrefix: "noise",
    label: "+ Noise",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ whiteVolume: -20, pinkVolume: -20, brownVolume: -20 }),
  },
  {
    type: "vca",
    idPrefix: "vca",
    label: "+ VCA",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({ gain: 0.5 }),
  },
  {
    type: "sequencer",
    idPrefix: "sequencer",
    label: "+ Sequencer",
    basePosition: { x: 440, y: 460 },
    defaults: () => ({
      steps: 8,
      bpm: 120,
      running: false,
      cvValues: [220, 262, 294, 330, 349, 330, 294, 262],
    }),
  },
];
