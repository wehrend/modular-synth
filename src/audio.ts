// audio.ts
// Brücke zwischen dem React-Flow-Graphen (UI) und dem Tone.js-Audiographen.
// Eine Kante im Flow-Graph entspricht genau einem connect() im Audiograph.

import * as Tone from "tone";
import {
  MIXER_CHANNELS,
  type AudioNodeInit,
  type MixerChannel,
  type MixerData,
  type NodePatch,
  type OscData,
  type OutData,
} from "./types";

type OscEntry = { type: "osc"; osc: Tone.Oscillator; out: Tone.ToneAudioNode };
type MixerEntry = {
  type: "mixer";
  ins: Record<MixerChannel, Tone.Gain>;
  sum: Tone.Gain;
  out: Tone.ToneAudioNode;
};
type OutEntry = { type: "out"; vol: Tone.Volume; in: Tone.ToneAudioNode };

type RegistryEntry = OscEntry | MixerEntry | OutEntry;

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
      const osc = new Tone.Oscillator(init.data.frequency, init.data.waveform);
      registry.set(init.id, { type: "osc", osc, out: osc });
      break;
    }
    case "mixer": {
      // Drei Eingangskanäle mit eigenem Gain, die auf eine Summe laufen.
      // `ins` bildet Handle-IDs auf Audio-Eingänge ab (siehe connectAudio).
      const sum = new Tone.Gain(init.data.master ?? 0.8);
      const ins = {
        ch1: new Tone.Gain(init.data.ch1 ?? 0.8),
        ch2: new Tone.Gain(init.data.ch2 ?? 0.8),
        ch3: new Tone.Gain(init.data.ch3 ?? 0.8),
      };
      Object.values(ins).forEach((ch) => ch.connect(sum));
      registry.set(init.id, { type: "mixer", ins, sum, out: sum });
      break;
    }
    case "out": {
      const vol = new Tone.Volume(init.data.volume).toDestination();
      vol.mute = init.data.muted;
      registry.set(init.id, { type: "out", vol, in: vol });
      break;
    }
  }
}

/** Knoten gelöscht → Tone.js-Ressourcen freigeben. */
export function removeAudioNode(id: string): void {
  const node = registry.get(id);
  if (!node) return;

  if (node.type === "osc") {
    node.osc.dispose();
  } else if (node.type === "mixer") {
    // Alle Kanal-Gains UND die Summe freigeben — sonst leben vier
    // Tone.Gain-Objekte pro gelöschtem Mixer im Audiographen weiter.
    Object.values(node.ins).forEach((gain) => gain.dispose());
    node.sum.dispose();
  } else {
    node.vol.dispose();
  }

  registry.delete(id);
}

/** Überträgt Parameteränderungen aus der UI auf den Audio-Knoten. */
export function updateAudioNode(id: string, patch: NodePatch): void {
  const node = registry.get(id);
  if (!node) return;

  if (node.type === "osc") {
    const p = patch as Partial<OscData>;
    if (p.frequency !== undefined) {
      // rampTo statt hartem Setzen vermeidet Knackser beim Schieben
      node.osc.frequency.rampTo(p.frequency, 0.04);
    }
    if (p.waveform !== undefined) node.osc.type = p.waveform;
    if (p.running !== undefined) {
      if (p.running) node.osc.start();
      else node.osc.stop();
    }
  }
  if (node.type === "mixer") {
    const p = patch as Partial<MixerData>;
    for (const ch of MIXER_CHANNELS) {
      const value = p[ch];
      if (value !== undefined) {
        node.ins[ch].gain.rampTo(value, 0.04);
      }
    }
    if (p.master !== undefined) {
      node.sum.gain.rampTo(p.master, 0.04);
    }
  }
  if (node.type === "out") {
    const p = patch as Partial<OutData>;
    if (p.volume !== undefined) node.vol.volume.rampTo(p.volume, 0.04);
    if (p.muted !== undefined) node.vol.mute = p.muted;
  }
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
    const input = target.ins[targetHandle as MixerChannel];
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
