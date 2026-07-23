// persist/serialize.ts
import type { Edge } from "@xyflow/react";
import type { AppNode } from "../types";

export const SCHEMA_VERSION = 1;

export type SerializedNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type SerializedEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type PatchDocument = {
  schemaVersion: number;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
};

// Passe diese Defaults an deine tatsächlichen initialNodes-Werte an —
// sie sind das Sicherheitsnetz beim Laden (siehe unten, toFlow).
export const MODULE_DEFAULTS: Record<string, Record<string, unknown>> = {
  osc: { frequency: 220, waveform: "sawtooth", running: true },
  lfo: { rate: 3, waveform: "sine" },
  vcf: {
    cutoff: 1500,
    resonance: 3,
    filterType: "lowpass",
    cutoffAmount: 1200,
    resonanceAmount: 0,
  },
  mixer: { ch1: 0.8, ch2: 0.8, ch3: 0.8, master: 0.8 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
  out: { volume: -12, muted: false },
};

/** Aktuellen Graph in ein speicherbares Dokument überführen. */
export function serializePatch(nodes: AppNode[], edges: Edge[]): PatchDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "unknown",
      position: { x: n.position.x, y: n.position.y },
      // Laufzeit-Zustand neutralisieren: ein geladenes Preset startet
      // nicht mitten im laufenden Ton
      data: neutralize(n.data as Record<string, unknown>),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

function neutralize(data: Record<string, unknown>): Record<string, unknown> {
  return "running" in data ? { ...data, running: false } : data;
}

/**
 * Unbekannte Daten (aus localStorage, später aus Supabase) prüfen.
 * Wirft eine verständliche Fehlermeldung, statt später tief in der
 * Engine mit einem "Cannot read properties of undefined" zu krachen —
 * genau das Muster, das dir schon mal live passiert ist.
 */
export function parsePatchDocument(raw: unknown): PatchDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Preset ist kein gültiges Objekt.");
  }
  const doc = raw as Partial<PatchDocument>;

  if (doc.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Preset hat Schema-Version ${String(doc.schemaVersion)}, erwartet wird ${SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new Error("Preset enthält keine gültigen Knoten/Kanten.");
  }
  for (const n of doc.nodes) {
    if (!n || typeof n.id !== "string" || typeof n.type !== "string") {
      throw new Error("Preset enthält einen ungültigen Knoten.");
    }
    if (!MODULE_DEFAULTS[n.type]) {
      throw new Error(`Preset verwendet unbekanntes Modul "${n.type}".`);
    }
  }
  return doc as PatchDocument;
}

/** Dokument zurück in React-Flow-Strukturen wandeln. */
export function toFlow(doc: PatchDocument): {
  nodes: AppNode[];
  edges: Edge[];
} {
  return {
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      // Defaults unterlegen: ein Preset ohne ein neu hinzugekommenes
      // Feld crasht dadurch nicht mehr beim Rendern
      data: { ...(MODULE_DEFAULTS[n.type] ?? {}), ...n.data },
      deletable: n.type !== "out",
    })) as AppNode[],
    edges: doc.edges.map((e) => ({ ...e, animated: true })),
  };
}
