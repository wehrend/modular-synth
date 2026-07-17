// types.ts
// Zentrale Typdefinitionen — die "Sprache", die UI und Audio-Engine teilen.
// Bewusst `type`-Aliase, keine Interfaces: React Flows Node<TData> verlangt
// `TData extends Record<string, unknown>`, und nur Typ-Aliase erfüllen das.

import type { Node } from '@xyflow/react';

export const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'] as const;
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

export type OscFlowNode = Node<OscData, 'osc'>;
export type OutFlowNode = Node<OutData, 'out'>;

/** Diskriminierte Union aller Knoten der App. */
export type AppNode = OscFlowNode | OutFlowNode;

/** Was die Audio-Engine zum Anlegen eines Knotens braucht. */
export type AudioNodeInit =
  | { id: string; type: 'osc'; data: OscData }
  | { id: string; type: 'out'; data: OutData };

/** Partielle Parameter-Updates, wie sie von den Reglern kommen. */
export type NodePatch = Partial<OscData> | Partial<OutData>;
