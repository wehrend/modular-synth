// types.ts
// Zentrale Typdefinitionen — die "Sprache", die UI und Audio-Engine teilen.
// Bewusst `type`-Aliase, keine Interfaces: React Flows Node<TData> verlangt
// `TData extends Record<string, unknown>`, und nur Typ-Aliase erfüllen das.

import type { Node } from "@xyflow/react";

export const WAVEFORMS = ["sine", "triangle", "sawtooth", "square"] as const;
export type Waveform = (typeof WAVEFORMS)[number];

export type OscData = {
  frequency: number;
  waveform: Waveform;
  running: boolean;
};

export type OutData = {
  volume: number; // dB
  muted: boolean;
};

export const MIXER_CHANNELS = ["ch1", "ch2", "ch3"] as const;
export type MixerChannel = (typeof MIXER_CHANNELS)[number];

export type MixerData = Record<MixerChannel, number> & {
  master: number; // 0–1
};

export type OscFlowNode = Node<OscData, "osc">;
export type MixerFlowNode = Node<MixerData, "mixer">;
export type OutFlowNode = Node<OutData, "out">;

/** Diskriminierte Union aller Knoten der App. */
export type AppNode = OscFlowNode | MixerFlowNode | OutFlowNode;

/** Was die Audio-Engine zum Anlegen eines Knotens braucht. */
export type AudioNodeInit =
  | { id: string; type: "osc"; data: OscData }
  | { id: string; type: "mixer"; data: MixerData }
  | { id: string; type: "out"; data: OutData };

/** Partielle Parameter-Updates, wie sie von den Reglern kommen. */
export type NodePatch =
  | Partial<OscData>
  | Partial<MixerData>
  | Partial<OutData>;
