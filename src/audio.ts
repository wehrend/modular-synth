// audio.ts
// Brücke zwischen dem React-Flow-Graphen (UI) und dem Tone.js-Audiographen.
// Eine Kante im Flow-Graph entspricht genau einem connect() im Audiograph.

import * as Tone from "tone";
import { AudioNodeInit, NodePatch, type MixerChannel } from "./types";
import {
  createOscNode,
  disposeOscNode,
  updateOscNode,
} from "./nodes/OscillatorNode";
import {
  createMixerNode,
  disposeMixerNode,
  updateMixerNode,
} from "./nodes/MixerNode";
import {
  createFilterNode,
  disposeFilterNode,
  updateFilterNode,
} from "./nodes/FilterNode";
import {
  createEnvelopeNode,
  disposeEnvelopeNode,
  updateEnvelopeNode,
} from "./nodes/EnvelopeNode";
import {
  createOutputNode,
  disposeOutputNode,
  updateOutputNode,
} from "./nodes/OutputNode";
import { createLfoNode, disposeLfoNode, updateLfoNode } from "./nodes/LfoNode";
import {
  createRingModNode,
  disposeRingModNode,
  updateRingModNode,
} from "./nodes/RingModNode";
import {
  WaspEntry,
  createWaspNode,
  disposeWaspNode,
  updateWaspNode,
} from "./nodes/WaspNode";

type OscEntry = { type: "osc"; osc: Tone.Oscillator; out: Tone.ToneAudioNode };
type MixerEntry = {
  type: "mixer";
  ins: Record<MixerChannel, Tone.Gain>;
  sum: Tone.Gain;
  out: Tone.ToneAudioNode;
};

export type VcfEntry = {
  type: "vcf";
  filter: Tone.Filter;
  ins: {
    in: Tone.ToneAudioNode; // Audio-Eingang: der Filter selbst
    cutoff: Tone.Gain; // CV-Eingang mit Attenuator
    resonance: Tone.Gain; // CV-Eingang mit Attenuator
  };
  out: Tone.ToneAudioNode;
};

type EnvelopeEntry = {
  type: "envelope";
  env: Tone.AmplitudeEnvelope;
  in: Tone.ToneAudioNode;
  out: Tone.ToneAudioNode;
};
type LfoEntry = { type: "lfo"; osc: Tone.Oscillator; out: Tone.ToneAudioNode };

export type OutEntry = {
  type: "out";
  vol: Tone.Volume;
  merge: Tone.Merge;
  ins: { inL: Tone.Gain; inR: Tone.Gain };
};

type RingModEntry = {
  type: "ringmod";
  multiply: Tone.Multiply;
  ins: { carrier: Tone.Gain; modulator: Tone.Gain };
  out: Tone.ToneAudioNode;
};
type RegistryEntry =
  | OscEntry
  | MixerEntry
  | VcfEntry
  | EnvelopeEntry
  | RingModEntry
  | LfoEntry
  | WaspEntry
  | OutEntry;

const registry = new Map<string, RegistryEntry>();

/** Web Audio darf erst nach einer Nutzergeste starten. */
export async function resumeAudio(): Promise<void> {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
}

type ModuleHandler<TData, TEntry> = {
  create: (id: string, data: TData) => TEntry;
  update: (entry: TEntry, patch: Partial<TData>) => void;
  dispose: (entry: TEntry) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- s. Erklärung unten
const MODULE_HANDLERS: Record<string, ModuleHandler<any, any>> = {
  osc: {
    create: createOscNode,
    update: updateOscNode,
    dispose: disposeOscNode,
  },
  mixer: {
    create: createMixerNode,
    update: updateMixerNode,
    dispose: disposeMixerNode,
  },
  vcf: {
    create: createFilterNode,
    update: updateFilterNode,
    dispose: disposeFilterNode,
  },
  envelope: {
    create: createEnvelopeNode,
    update: updateEnvelopeNode,
    dispose: disposeEnvelopeNode,
  },
  ringmod: {
    create: createRingModNode,
    update: updateRingModNode,
    dispose: disposeRingModNode,
  },
  lfo: {
    create: createLfoNode,
    update: updateLfoNode,
    dispose: disposeLfoNode,
  },
  wasp: {
    create: createWaspNode,
    update: updateWaspNode,
    dispose: disposeWaspNode,
  },
  out: {
    create: createOutputNode,
    update: updateOutputNode,
    dispose: disposeOutputNode,
  },
};

export function createAudioNode(init: AudioNodeInit): void {
  if (registry.has(init.id)) return;
  const handler = MODULE_HANDLERS[init.type];
  if (!handler) {
    console.warn(`Unbekannter Modultyp: ${init.type}`);
    return;
  }
  registry.set(init.id, handler.create(init.id, init.data));
}

export function updateAudioNode(id: string, patch: NodePatch): void {
  const node = registry.get(id);
  if (!node) return;
  MODULE_HANDLERS[node.type]?.update(node, patch);
}

export function removeAudioNode(id: string): void {
  const node = registry.get(id);
  if (!node) return;
  MODULE_HANDLERS[node.type]?.dispose(node);
  registry.delete(id);
}

/** Gate an: Attack-Phase starten (Taste gedrückt). */
export function gateOn(id: string): void {
  const node = registry.get(id);
  if (node?.type === "envelope") node.env.triggerAttack();
}

/** Gate aus: Release-Phase starten (Taste losgelassen). */
export function gateOff(id: string): void {
  const node = registry.get(id);
  if (node?.type === "envelope") node.env.triggerRelease();
}

/**
 * Ermittelt den Audio-Eingang eines Ziels.
 * Hat das Modul benannte Eingänge (`ins`), entscheidet die Handle-ID
 * der Kante, welcher Kanal gemeint ist. Sonst gilt der Standard-Eingang.
 */
function resolveInput(
  target: RegistryEntry | undefined,
  targetHandle?: string | null,
): Tone.ToneAudioNode | null {
  if (targetHandle && target && "ins" in target) {
    const ins = target.ins as Record<string, Tone.ToneAudioNode>;
    const input = ins[targetHandle] ?? null;
    if (input) return input;
  }
  return target && "in" in target ? target.in : null;
}

/** Kante verbunden → Audiosignal verbinden. */
export function connectAudio(
  sourceId: string,
  targetId: string,
  targetHandle?: string | null,
): void {
  const source = registry.get(sourceId);
  const input = resolveInput(registry.get(targetId), targetHandle);
  if (source && "out" in source && input) {
    source.out.connect(input);
  }
}

/** Kante gelöscht → Audiosignal trennen. */
export function disconnectAudio(
  sourceId: string,
  targetId: string,
  targetHandle?: string | null,
): void {
  const source = registry.get(sourceId);
  const input = resolveInput(registry.get(targetId), targetHandle);
  if (source && "out" in source && input) {
    source.out.disconnect(input);
  }
}
