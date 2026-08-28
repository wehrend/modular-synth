// audio/connections.ts
// Übersetzt React-Flow-Kanten in echte Tone.js .connect()/.disconnect()-
// Aufrufe. Gate-Kabel (targetHandle === "gate") werden abgezweigt und laufen
// stattdessen über gateRouting.ts, da sie kein Audiosignal übertragen.

import * as Tone from "tone";
import { registry, type RegistryEntry } from "./registry";
import { gateKey, gateRoutes } from "./gateRouting";

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
  if (targetHandle === "gate" && sourceHandle) {
    const key = gateKey(sourceId, sourceHandle);
    if (!gateRoutes.has(key)) gateRoutes.set(key, new Set());
    gateRoutes.get(key)!.add(targetId);
    return;
  }

  const output = resolveOutput(registry.get(sourceId), sourceHandle);
  const input = resolveInput(registry.get(targetId), targetHandle);
  if (output && input) {
    // Panner: Tone.Split hat zwei Kanäle (0 = links, 1 = rechts) an
    // EINEM Node -- der Kanalindex muss explizit mitgegeben werden,
    // sonst landet jede Verbindung auf Kanal 0.
    if (sourceHandle === "l") {
      output.connect(input, 0, 0);
    } else if (sourceHandle === "r") {
      output.connect(input, 1, 0);
    } else {
      output.connect(input);
    }
  } else {
    // Das Kabel existiert im Flow-Graph, aber im Audiographen fehlt ein
    // Ende -- meistens ein Handle-ID-Tippfehler oder das Zielmodul war
    // beim Verbinden noch nicht in der registry.
    console.warn(
      "connectAudio: Verbindung nicht auflösbar -- kein echtes connect() ausgeführt.",
      {
        sourceId,
        targetId,
        sourceHandle,
        targetHandle,
        outputResolved: !!output,
        inputResolved: !!input,
      },
    );
  }
}

/** Kante gelöscht → Audiosignal trennen. */
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
      // Panner: Tone.Split hat zwei Kanäle (0 = links, 1 = rechts) an
      // EINEM Node -- der Kanalindex muss beim Trennen genauso explizit
      // mitgegeben werden wie beim Verbinden in connectAudio, sonst
      // trifft der Aufruf die falsche (oder keine) Verbindung.
      if (sourceHandle === "l") {
        output.disconnect(input, 0, 0);
      } else if (sourceHandle === "r") {
        output.disconnect(input, 1, 0);
      } else {
        output.disconnect(input);
      }
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
