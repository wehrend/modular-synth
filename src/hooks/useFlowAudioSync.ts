// hooks/useFlowAudioSync.ts
// Reine Bridge zwischen React-Flow-Events (Kante gezogen/gelöscht, Knoten
// gelöscht) und dem Tone.js-Audiographen in audio.ts. Hat mit Presets oder
// UI-Layout nichts zu tun -- deshalb eigener Hook.

import { useCallback } from "react";
import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { connectAudio, disconnectAudio, removeAudioNode } from "../audio";
import type { AppNode } from "../types";

export function useFlowAudioSync(
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void,
) {
  const onConnect = useCallback(
    (connection: Connection) => {
      // connection.targetHandle sagt, welcher benannte Eingang gemeint ist
      // (z. B. "ch2" am Mixer); addEdge speichert ihn in der Kante mit.
      connectAudio(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
      );
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach((edge) =>
      disconnectAudio(
        edge.source,
        edge.target,
        edge.sourceHandle,
        edge.targetHandle,
      ),
    );
  }, []);

  // Bugfix (v3): Doppelklick auf ein Kabel zieht es raus.
  // Achtung: setEdges löst onEdgesDelete NICHT aus, deshalb muss das
  // Audio-Trennen hier explizit passieren.
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      disconnectAudio(
        edge.source,
        edge.target,
        edge.sourceHandle,
        edge.targetHandle,
      );
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  const onNodesDelete = useCallback((deleted: AppNode[]) => {
    deleted.forEach((node) => {
      if (node.type === "out") return; // OUT ist unlöschbar, egal wie die Löschung ausgelöst wurde
      removeAudioNode(node.id);
    });
  }, []);

  return { onConnect, onEdgesDelete, onEdgeDoubleClick, onNodesDelete };
}
