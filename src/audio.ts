// audio.ts
// Brücke zwischen dem React-Flow-Graphen (UI) und dem Tone.js-Audiographen.
// Eine Kante im Flow-Graph entspricht genau einem connect() im Audiograph.

import * as Tone from 'tone';
import type { AudioNodeInit, NodePatch, OscData, OutData } from './types';

type OscEntry = { type: 'osc'; osc: Tone.Oscillator; out: Tone.ToneAudioNode };
type OutEntry = { type: 'out'; vol: Tone.Volume; in: Tone.ToneAudioNode };

const registry = new Map<string, OscEntry | OutEntry>();

/** Web Audio darf erst nach einer Nutzergeste starten. */
export async function resumeAudio(): Promise<void> {
  if (Tone.getContext().state !== 'running') {
    await Tone.start();
  }
}

/** Legt für einen Flow-Knoten das passende Tone.js-Gegenstück an. */
export function createAudioNode(init: AudioNodeInit): void {
  if (registry.has(init.id)) return;

  switch (init.type) {
    case 'osc': {
      const osc = new Tone.Oscillator(init.data.frequency, init.data.waveform);
      registry.set(init.id, { type: 'osc', osc, out: osc });
      break;
    }
    case 'out': {
      const vol = new Tone.Volume(init.data.volume).toDestination();
      vol.mute = init.data.muted;
      registry.set(init.id, { type: 'out', vol, in: vol });
      break;
    }
  }
}

/** Knoten gelöscht → Tone.js-Ressourcen freigeben. */
export function removeAudioNode(id: string): void {
  const node = registry.get(id);
  if (!node) return;
  if (node.type === 'osc') node.osc.dispose();
  else node.vol.dispose();
  registry.delete(id);
}

/** Überträgt Parameteränderungen aus der UI auf den Audio-Knoten. */
export function updateAudioNode(id: string, patch: NodePatch): void {
  const node = registry.get(id);
  if (!node) return;

  if (node.type === 'osc') {
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

  if (node.type === 'out') {
    const p = patch as Partial<OutData>;
    if (p.volume !== undefined) node.vol.volume.rampTo(p.volume, 0.04);
    if (p.muted !== undefined) node.vol.mute = p.muted;
  }
}

/** Kante verbunden → Audiosignal verbinden. */
export function connectAudio(sourceId: string, targetId: string): void {
  const source = registry.get(sourceId);
  const target = registry.get(targetId);
  if (source && 'out' in source && target && 'in' in target) {
    source.out.connect(target.in);
  }
}

/** Kante gelöscht → Audiosignal trennen. */
export function disconnectAudio(sourceId: string, targetId: string): void {
  const source = registry.get(sourceId);
  const target = registry.get(targetId);
  if (source && 'out' in source && target && 'in' in target) {
    source.out.disconnect(target.in);
  }
}
