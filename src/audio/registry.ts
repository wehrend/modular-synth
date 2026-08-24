// audio/registry.ts
// Kern der Audio-Registry: hält für jeden React-Flow-Node die zugehörigen
// Tone.js-Objekte ("Entry") und bietet die generische create/update/dispose-
// Anbindung (MODULE_HANDLERS) darüber. Andere audio/*-Module importieren
// `registry` von hier, um auf einzelne Einträge zuzugreifen.

import * as Tone from "tone";
import { AudioNodeInit, NodePatch, type MixerChannel } from "../types";
import {
  createOscNode,
  disposeOscNode,
  updateOscNode,
} from "../nodes/OscillatorNode";
import {
  createMixerNode,
  disposeMixerNode,
  updateMixerNode,
} from "../nodes/MixerNode";
import {
  createFilterNode,
  disposeFilterNode,
  updateFilterNode,
} from "../nodes/FilterNode";
import {
  createEnvelopeNode,
  disposeEnvelopeNode,
  updateEnvelopeNode,
} from "../nodes/EnvelopeNode";
import {
  createOutputNode,
  disposeOutputNode,
  updateOutputNode,
} from "../nodes/OutputNode";
import { createLfoNode, disposeLfoNode, updateLfoNode } from "../nodes/LfoNode";
import {
  createRingModNode,
  disposeRingModNode,
  updateRingModNode,
} from "../nodes/RingModNode";
import {
  WaspEntry,
  createWaspNode,
  disposeWaspNode,
  updateWaspNode,
} from "../nodes/WaspNode";
import {
  createNoiseNode,
  disposeNoiseNode,
  updateNoiseNode,
} from "../nodes/NoiseNode";
import {
  createVcaNode,
  disposeVcaNode,
  updateVcaNode,
  VcaEntry,
} from "../nodes/VcaNode";
import {
  createSequencerNode,
  disposeSequencerNode,
  SequencerEntry,
  updateSequencerNode,
} from "../nodes/SequencerNode";
import {
  createSamplerNode,
  disposeSamplerNode,
  updateSamplerNode,
} from "../nodes/SamplerNode";
import {
  createVocoderAnalysisNode,
  disposeVocoderAnalysisNode,
  updateVocoderAnalysisNode,
  VocoderAnalysisEntry,
} from "../nodes/VocoderAnalysisNode";
import {
  createVocoderSynthNode,
  disposeVocoderSynthNode,
  updateVocoderSynthNode,
  VocoderSynthEntry,
} from "../nodes/VocoderSynthNode";
import { gateRoutes } from "./gateRouting";

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

export type NoiseEntry = {
  type: "noise";
  white: Tone.Noise;
  pink: Tone.Noise;
  brown: Tone.Noise;
  outs: {
    white: Tone.ToneAudioNode;
    pink: Tone.ToneAudioNode;
    brown: Tone.ToneAudioNode;
  };
};

export type SamplerEntry = {
  type: "sampler";
  mic: Tone.UserMedia;
  recorder: Tone.Recorder;
  player: Tone.Player;
  out: Tone.ToneAudioNode;
  gainNode: Tone.Gain;
  pendingLoad: Promise<void>;
};

export type RegistryEntry =
  | OscEntry
  | MixerEntry
  | VcfEntry
  | EnvelopeEntry
  | RingModEntry
  | LfoEntry
  | WaspEntry
  | NoiseEntry
  | VcaEntry
  | SequencerEntry
  | SamplerEntry
  | VocoderAnalysisEntry
  | VocoderSynthEntry
  | OutEntry;

export const registry = new Map<string, RegistryEntry>();

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
export const MODULE_HANDLERS: Record<string, ModuleHandler<any, any>> = {
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
  noise: {
    create: createNoiseNode,
    update: updateNoiseNode,
    dispose: disposeNoiseNode,
  },
  vca: {
    create: createVcaNode,
    update: updateVcaNode,
    dispose: disposeVcaNode,
  },
  sequencer: {
    create: createSequencerNode,
    update: updateSequencerNode,
    dispose: disposeSequencerNode,
  },
  sampler: {
    create: createSamplerNode,
    update: updateSamplerNode,
    dispose: disposeSamplerNode,
  },
  vocoderAnalysis: {
    create: createVocoderAnalysisNode,
    update: updateVocoderAnalysisNode,
    dispose: disposeVocoderAnalysisNode,
  },
  vocoderSynth: {
    create: createVocoderSynthNode,
    update: updateVocoderSynthNode,
    dispose: disposeVocoderSynthNode,
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

  // Alle Gate-Routen entfernen, in denen dieser Knoten Quelle ODER Ziel war
  for (const [key, targets] of gateRoutes) {
    if (key.startsWith(`${id}::`)) gateRoutes.delete(key);
    else targets.delete(id);
  }
}

export type ResourceStats = {
  byType: Record<string, { instances: number; toneObjects: number }>;
  totalInstances: number;
  totalToneObjects: number;
};

/**
 * Duck-Typing-Check: Tone.js exportiert seine interne Basisklasse nicht
 * öffentlich, ein sauberer `instanceof`-Check über alle Objekttypen
 * (Oszillator, Gain, Player, Signal, Loop, Buffer, Recorder, UserMedia...)
 * ist deshalb nicht möglich. Alle Tone.js-Objekte haben aber .dispose() --
 * das genügt als generisches Erkennungsmerkmal.
 */
function isToneLike(value: unknown): value is { dispose: () => unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { dispose?: unknown }).dispose === "function"
  );
}

/**
 * Zählt die eindeutigen Tone.js-Objekte eines Registry-Eintrags, auch
 * eine Ebene tief verschachtelt (z.B. ins.cutoff, bands[].filter). Ein
 * Set verhindert Doppelzählung, falls ein Feld wie `out` nur ein Alias
 * auf ein bereits anderweitig referenziertes Objekt ist (z.B. `out ===
 * filter` bei VCF) -- sonst würde dieselbe Web-Audio-Node zweimal gezählt.
 */
function countToneResources(entry: RegistryEntry): number {
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (isToneLike(value)) {
      seen.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  for (const [key, value] of Object.entries(entry)) {
    if (key === "type") continue; // reiner String-Diskriminator, kein Tone-Objekt
    visit(value);
  }
  return seen.size;
}

/** Aktueller Ressourcenverbrauch des offenen Patches, aufgeschlüsselt nach Modultyp. */
export function getResourceStats(): ResourceStats {
  const byType: ResourceStats["byType"] = {};

  registry.forEach((entry) => {
    const t = entry.type;
    if (!byType[t]) byType[t] = { instances: 0, toneObjects: 0 };
    byType[t].instances += 1;
    byType[t].toneObjects += countToneResources(entry);
  });

  const totals = Object.values(byType).reduce(
    (acc, v) => ({
      totalInstances: acc.totalInstances + v.instances,
      totalToneObjects: acc.totalToneObjects + v.toneObjects,
    }),
    { totalInstances: 0, totalToneObjects: 0 },
  );

  return { byType, ...totals };
}