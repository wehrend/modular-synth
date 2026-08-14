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
import {
  createNoiseNode,
  disposeNoiseNode,
  updateNoiseNode,
} from "./nodes/NoiseNode";
import {
  createVcaNode,
  disposeVcaNode,
  updateVcaNode,
  VcaEntry,
} from "./nodes/VcaNode";
import {
  createSequencerNode,
  disposeSequencerNode,
  SequencerEntry,
  updateSequencerNode,
} from "./nodes/SequencerNode";
import {
  createSamplerNode,
  disposeSamplerNode,
  updateSamplerNode,
} from "./nodes/SamplerNode";

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

type RegistryEntry =
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

// Gate-Routing: parallel zum Audiographen, aber ohne echte Tone.js-Verbindung.
// sourceId -> Menge der Envelope-IDs, die dieses Gate-Signal empfangen.
// Schlüssel jetzt "sourceId::sourceHandle" statt nur "sourceId" --
// ein Knoten kann mehrere unabhängige Gate-Ausgänge haben (CD4017: bis zu 10).
const gateRoutes = new Map<string, Set<string>>();

function gateKey(sourceId: string, sourceHandle: string): string {
  return `${sourceId}::${sourceHandle}`;
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

export async function startSamplerRecording(id: string): Promise<void> {
  const node = registry.get(id);
  if (node?.type !== "sampler") return;

  // Mikro nur öffnen, wenn es nicht schon offen ist -- unnötiges
  // erneutes getUserMedia() bei jeder Aufnahme vermeiden.
  if (node.mic.state !== "started") {
    await node.mic.open(); // fragt bei Bedarf nach Mikrofonberechtigung
  }

  // Falls der Recorder aus irgendeinem Grund schon läuft (z.B. State
  // durch einen vorherigen Fehler nicht sauber zurückgesetzt), nicht
  // nochmal start() aufrufen -- das würde einen Assert werfen.
  if (node.recorder.state === "started") return;

  await node.recorder.start();
}

export async function stopSamplerRecording(id: string): Promise<Blob | null> {
  const node = registry.get(id);
  if (node?.type !== "sampler") return null;

  // Wurde nie erfolgreich gestartet (z.B. weil startSamplerRecording
  // vorher geworfen hat) -- nichts zu stoppen, sonst Assert-Fehler.
  if (node.recorder.state !== "started") return null;

  await node.pendingLoad;

  const blob = await node.recorder.stop();
  const url = URL.createObjectURL(blob);
  await node.player.load(url);
  URL.revokeObjectURL(url);
  return blob;
}

export function triggerSamplerPlayback(id: string): void {
  const node = registry.get(id);
  if (node?.type !== "sampler") return;
  if (node.player.state === "started") node.player.stop();
  node.player.start();
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

function resolveOutput(
  source: RegistryEntry | undefined,
  sourceHandle?: string | null,
): Tone.ToneAudioNode | null {
  if (!source) return null;
  if (sourceHandle && "outs" in source) {
    return (
      (source.outs as Record<string, Tone.ToneAudioNode>)[sourceHandle] ?? null
    );
  }
  return "out" in source ? source.out : null;
}

/** Kante verbunden → Audiosignal verbinden. */
export function connectAudio(
  sourceId: string,
  targetId: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): void {
  console.log("connectAudio:", {
    sourceId,
    targetId,
    sourceHandle,
    targetHandle,
  });
  if (targetHandle === "gate" && sourceHandle) {
    const key = gateKey(sourceId, sourceHandle);
    if (!gateRoutes.has(key)) gateRoutes.set(key, new Set());
    gateRoutes.get(key)!.add(targetId);
    return;
  }

  const output = resolveOutput(registry.get(sourceId), sourceHandle);
  const input = resolveInput(registry.get(targetId), targetHandle);
  if (output && input) output.connect(input);
}

/** Kante gelöscht → Audiosignal trennen. */
export function disconnectAudio(
  sourceId: string,
  targetId: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): void {
  // Gate-Verbindungen laufen nicht über den Audiographen -- eigener Zweig,
  // muss VOR resolveOutput/resolveInput geprüft werden, sonst würde
  // versucht, ein nicht existierendes Tone-Objekt zu trennen.
  if (targetHandle === "gate" && sourceHandle) {
    gateRoutes.get(gateKey(sourceId, sourceHandle))?.delete(targetId);
    return;
  }

  const output = resolveOutput(registry.get(sourceId), sourceHandle);
  const input = resolveInput(registry.get(targetId), targetHandle);

  if (!output) return;

  try {
    if (input) {
      output.disconnect(input);
    } else {
      output.disconnect();
    }
  } catch (error) {
    console.warn(
      `[disconnectAudio] Konnte Signal von ${sourceId} nicht trennen:`,
      error,
    );
  }
}