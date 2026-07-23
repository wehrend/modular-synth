// audio.ts
// Brücke zwischen dem React-Flow-Graphen (UI) und dem Tone.js-Audiographen.
// Eine Kante im Flow-Graph entspricht genau einem connect() im Audiograph.

import * as Tone from "tone";
import {
  EnvelopeData,
  LfoData,
  VcfData,
  Waveform,
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

type VcfEntry = {
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

type OutEntry = {
  type: "out";
  vol: Tone.Volume;
  merge: Tone.Merge;
  ins: { inL: Tone.Gain; inR: Tone.Gain };
};

type RegistryEntry =
  | OscEntry
  | MixerEntry
  | VcfEntry
  | EnvelopeEntry
  | LfoEntry
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
    case "vcf": {
      const filter = new Tone.Filter({
        frequency: init.data.cutoff,
        Q: init.data.resonance,
        type: init.data.filterType,
      });
      // CV-Eingänge: Attenuator-Gain → Parameter-Signal
      const cutoffAmt = new Tone.Gain(init.data.cutoffAmount);
      cutoffAmt.connect(filter.frequency);
      const resAmt = new Tone.Gain(init.data.resonanceAmount);
      resAmt.connect(filter.Q);

      registry.set(init.id, {
        type: "vcf",
        filter,
        ins: {
          in: filter, // Audio-Eingang
          cutoff: cutoffAmt, // CV-Eingang 1  ← DAS sind die beiden
          resonance: resAmt, // CV-Eingang 2  ← Eingänge
        },
        out: filter,
      });
      break;
    }
    case "envelope": {
      const env = new Tone.AmplitudeEnvelope({
        attack: init.data.attack,
        decay: init.data.decay,
        sustain: init.data.sustain,
        release: init.data.release,
      });
      registry.set(init.id, { type: "envelope", env, in: env, out: env });
      break;
    }
    case "lfo": {
      const osc = makeOscillator(init.data.rate, init.data.waveform);
      osc.start(); // free-running ab Geburt
      registry.set(init.id, { type: "lfo", osc, out: osc });
      break;
    }
    case "out": {
      const vol = new Tone.Volume(init.data.volume).toDestination();
      vol.mute = init.data.muted;

      const merge = new Tone.Merge();
      merge.connect(vol);

      const inL = new Tone.Gain(1);
      const inR = new Tone.Gain(1);
      inL.connect(merge, 0, 0); // Kanal 0 = links
      inR.connect(merge, 0, 1); // Kanal 1 = rechts

      registry.set(init.id, { type: "out", vol, merge, ins: { inL, inR } });
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
      node.osc.dispose();
      break;
    case "mixer":
      Object.values(node.ins).forEach((g) => g.dispose());
      node.sum.dispose();
      break;
    case "vcf":
      node.ins.cutoff.dispose();
      node.ins.resonance.dispose();
      node.filter.dispose(); // ins.in ist der Filter selbst — nicht doppelt disposen
      break;
    case "envelope":
      node.env.dispose();
      break;
    case "lfo":
      node.osc.dispose();
      break;
    case "out":
      node.vol.dispose();
      node.merge.dispose();
      node.ins.inL.dispose();
      node.ins.inR.dispose();
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

const RAMP = 0.04; // Sekunden — knackfreie Parameterwechsel

export function updateAudioNode(id: string, patch: NodePatch): void {
  const node = registry.get(id);
  if (!node) return;

  switch (node.type) {
    case "osc": {
      const p = patch as Partial<OscData>;
      if (p.frequency !== undefined) {
        // rampTo statt hartem Setzen vermeidet Knackser beim Schieben
        node.osc.frequency.rampTo(p.frequency, RAMP);
      }
      if (p.waveform !== undefined) {
        node.osc.type = p.waveform;
      }
      if (p.running !== undefined) {
        if (p.running) node.osc.start();
        else node.osc.stop();
      }
      break;
    }
    case "vcf": {
      const p = patch as Partial<VcfData>;
      if (p.cutoff !== undefined) {
        node.filter.frequency.rampTo(p.cutoff, RAMP);
      }
      if (p.resonance !== undefined) {
        node.filter.Q.rampTo(p.resonance, RAMP);
      }
      if (p.filterType !== undefined) {
        node.filter.type = p.filterType;
      }
      // Mod-Hub der CV-Eingänge (Attenuator-Gains in `ins`)
      if (p.cutoffAmount !== undefined) {
        node.ins.cutoff.gain.rampTo(p.cutoffAmount, RAMP);
      }
      if (p.resonanceAmount !== undefined) {
        node.ins.resonance.gain.rampTo(p.resonanceAmount, RAMP);
      }
      break;
    }

    case "envelope": {
      const p = patch as Partial<EnvelopeData>;
      // Kein rampTo: A/D/S/R sind gewöhnliche Zahlen-Properties (Form
      // künftiger Verläufe), keine laufenden Audio-Signale
      if (p.attack !== undefined) node.env.attack = p.attack;
      if (p.decay !== undefined) node.env.decay = p.decay;
      if (p.sustain !== undefined) node.env.sustain = p.sustain;
      if (p.release !== undefined) node.env.release = p.release;
      break;
    }

    case "mixer": {
      const p = patch as Partial<MixerData>;
      (Object.keys(node.ins) as MixerChannel[]).forEach((ch) => {
        const value = p[ch];
        if (value !== undefined) {
          node.ins[ch].gain.rampTo(value, RAMP);
        }
      });
      if (p.master !== undefined) {
        node.sum.gain.rampTo(p.master, RAMP);
      }
      break;
    }
    case "lfo": {
      const p = patch as Partial<LfoData>;
      if (p.rate !== undefined) {
        // rampTo statt hartem Setzen vermeidet Knackser beim Schieben
        node.osc.frequency.rampTo(p.rate, RAMP);
      }
      if (p.waveform !== undefined) {
        node.osc.type = p.waveform;
      }
      break;
    }
    case "out": {
      const p = patch as Partial<OutData>;
      if (p.volume !== undefined) {
        node.vol.volume.rampTo(p.volume, RAMP);
      }
      if (p.muted !== undefined) {
        node.vol.mute = p.muted;
      }
      break;
    }
  }
}

/** Gemeinsamer Kern von VCO und LFO — die "Vererbung" als Funktion. */
function makeOscillator(
  frequency: number,
  waveform: Waveform,
): Tone.Oscillator {
  return new Tone.Oscillator(frequency, waveform);
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
