// lib/loadPatchIntoFlow.ts
// Gemeinsame Logik für alle drei Stellen, an denen ein kompletter Patch neu
// in React Flow UND den Tone.js-Audiographen geladen wird (Preset laden,
// öffentlichen Patch per URL laden). Vorher an drei fast identischen,
// aber leicht unterschiedlich formulierten Stellen dupliziert -- genau das
// hat den connectAudio()-Handle-Swap-Bug so schwer auffindbar gemacht,
// weil der Fix an jeder Stelle einzeln nachgezogen werden musste.

import type { Edge } from "@xyflow/react";
import type { PatchDocument } from "../persist/serialize";
import { toFlow } from "../persist/serialize";
import { createAudioNode, connectAudio, removeAudioNode } from "../audio";
import { seedIds } from "../persist/ids";
import type { AppNode } from "../types";

export function loadPatchIntoFlow(
  doc: PatchDocument,
  existingNodes: AppNode[],
): { nodes: AppNode[]; edges: Edge[] } {
  const { nodes: newNodes, edges: newEdges } = toFlow(doc);

  // Alten Audiographen komplett abbauen, bevor der neue aufgebaut wird --
  // sonst blieben Tone.js-Nodes des vorherigen Patches (Oszillatoren,
  // Recorder, offene Mikrofon-Streams etc.) unsauber im Speicher hängen.
  existingNodes.forEach((n) => removeAudioNode(n.id));

  newNodes.forEach((n) =>
    createAudioNode({ id: n.id, type: n.type as any, data: n.data as any }),
  );
  newEdges.forEach((e) =>
    connectAudio(e.source, e.target, e.sourceHandle, e.targetHandle),
  );
  seedIds(newNodes.map((n) => n.id));

  return { nodes: newNodes, edges: newEdges };
}
