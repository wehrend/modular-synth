// audio.ts
// Brücke zwischen dem React-Flow-Graphen (UI) und dem Tone.js-Audiographen.
// Eine Kante im Flow-Graph entspricht genau einem connect() im Audiograph.

import * as Tone from "tone";
import {
  EnvelopeData,
  LfoData,
  MixerData,
  OutData,
  VcfData,
  WaspData,
  type AudioNodeInit,
  type MixerChannel,
  type NodePatch,
  type OscData,
} from "./types";
import {
  createOscNode,
  removeOscNode,
  updateOscNode,
} from "./nodes/OscillatorNode";
import {
  createMixerNode,
  removeMixerNode,
  updateMixerNode,
} from "./nodes/MixerNode";
import {
  createFilterNode,
  removeFilterNode,
  updateFilterNode,
} from "./nodes/FilterNode";
import {
  createEnvelopeNode,
  removeEnvelopeNode,
  updateEnvelopeNode,
} from "./nodes/EnvelopeNode";
import {
  createOutputNode,
  removeOutputNode,
  updateOutputNode,
} from "./nodes/OutputNode";
import { createLfoNode, removeLfoNode, updateLfoNode } from "./nodes/LfoNode";
import { createRingModNode, removeRingModNode } from "./nodes/RingModNode";
import { WaspEntry,
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

/** Legt für einen Flow-Knoten das passende Tone.js-Gegenstück an. */
export function createAudioNode(init: AudioNodeInit): void {
  if (registry.has(init.id)) return;

  switch (init.type) {
    case "osc": {
      registry.set(init.id, createOscNode(init.id, init.data));
      break;
    }
    case "mixer": {
      registry.set(init.id, createMixerNode(init.id, init.data));
      break;
    }
    case "vcf": {
      registry.set(init.id, createFilterNode(init.id, init.data));
      break;
    }
    case "envelope": {
      registry.set(init.id, createEnvelopeNode(init.id, init.data));
      break;
    }
    case "ringmod": {
      registry.set(init.id, createRingModNode(init.id));
      break;
    }
    case "lfo": {
      registry.set(init.id, createLfoNode(init.id, init.data));
      break;
    }
    case "wasp": {
      registry.set(init.id, createWaspNode(init.id, init.data));
      break;
    }
    case "out": {
      registry.set(init.id, createOutputNode(init.id, init.data));
      break;
    }
  }
}

/** Knoten gelöscht → Tone.js-Ressourcen freigeben. */
export function removeAudioNode(id: string): void {
  const node = registry.get(id);
  if (!node) return;

  switch (node.type) {
    case "osc":
      removeOscNode(node); // rekursiv, um den Oscillator zu stoppen
      break;
    case "mixer":
      removeMixerNode(node);
      break;
    case "vcf":
      removeFilterNode(node);
      break;
    case "envelope":
      removeEnvelopeNode(node);
      break;
    case "ringmod":
      removeRingModNode(node);
      break;
    case "lfo":
      removeLfoNode(node);
      break;
    case "wasp":
      disposeWaspNode(node);
      break;
    case "out":
      removeOutputNode(node);
      break;
  }
  registry.delete(id);
}
/**
 * Überträgt Parameteränderungen aus der UI auf den Audio-Knoten.
 * Die Casts pro Zweig sind nötig, weil die Map die Verbindung zwischen
 * Knotentyp und Patch-Typ nicht kennt — der per node.type abgesicherte
 * Zweig stellt sie wieder her.
 */

export function updateAudioNode(id: string, patch: NodePatch): void {
  const node = registry.get(id);
  if (!node) return;

  switch (node.type) {
    case "osc": {
      updateOscNode(node, patch as Partial<OscData>);
      break;
    }
    case "vcf": {
      updateFilterNode(node, patch as Partial<VcfData>);
      break;
    }

    case "envelope": {
      updateEnvelopeNode(node, patch as Partial<EnvelopeData>);
      break;
    }

    case "mixer": {
      updateMixerNode(node, patch as Partial<MixerData>);
      break;
    }
    case "lfo": {
      updateLfoNode(node, patch as Partial<LfoData>);
      break;
    }
    case "wasp": {
      updateWaspNode(node, patch as Partial<WaspData>);
      break;
    }
    case "out": {
      updateOutputNode(node, patch as Partial<OutData>);
      break;
    }
  }
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
