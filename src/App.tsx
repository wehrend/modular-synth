// App.tsx
// Der Flow-Graph ist die "Wahrheit" für die Patch-Struktur.
// Jede Änderung an Kanten/Knoten wird 1:1 in den Audiographen gespiegelt.

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import OscillatorNode from "./nodes/OscillatorNode";
import MixerNode from "./nodes/MixerNode";
import OutputNode from "./nodes/OutputNode";
import {
  createAudioNode,
  connectAudio,
  disconnectAudio,
  removeAudioNode,
  resumeAudio,
} from "./audio";
import type {
  AppNode,
  VcfFlowNode,
  MixerFlowNode,
  OscFlowNode,
  EnvelopeFlowNode,
} from "./types";
import styles from "./App.module.scss";
import FilterNode from "./nodes/FilterNode";
import { Envelope } from "tone";
import EnvelopeNode from "./nodes/EnvelopeNode";

const nodeTypes = {
  osc: OscillatorNode,
  mixer: MixerNode,
  vcf: FilterNode,
  envelope: EnvelopeNode,
  out: OutputNode,
};

const initialNodes: AppNode[] = [
  {
    id: "osc-1",
    type: "osc",
    position: { x: 60, y: 140 },
    data: { frequency: 220, waveform: "sawtooth", running: false },
  },
  {
    id: "out-1",
    type: "out",
    position: { x: 480, y: 170 },
    data: { volume: -12, muted: false },
  },
];

// Tone.js-Gegenstücke für den Startzustand anlegen (Modul-Scope statt
// useEffect: läuft garantiert genau einmal, auch unter React StrictMode).
initialNodes.forEach((n) => createAudioNode(n));

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const oscCount = useRef(1);
  const mixerCount = useRef(0);
  const filterCount = useRef(0);
  const envelopeCount = useRef(0);

  const onConnect = useCallback(
    (connection: Connection) => {
      // connection.targetHandle sagt, welcher benannte Eingang gemeint ist
      // (z. B. "ch2" am Mixer); addEdge speichert ihn in der Kante mit.
      connectAudio(
        connection.source,
        connection.target,
        connection.targetHandle,
      );
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach((edge) =>
      disconnectAudio(edge.source, edge.target, edge.targetHandle),
    );
  }, []);

  // Bugfix (v3): Doppelklick auf ein Kabel zieht es raus.
  // Achtung: setEdges löst onEdgesDelete NICHT aus, deshalb muss das
  // Audio-Trennen hier explizit passieren.
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      disconnectAudio(edge.source, edge.target);
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  const onNodesDelete = useCallback((deleted: AppNode[]) => {
    deleted.forEach((node) => removeAudioNode(node.id));
  }, []);

  const addOscillator = useCallback(() => {
    oscCount.current += 1;
    const node: OscFlowNode = {
      id: `osc-${oscCount.current}`,
      type: "osc",
      position: { x: 60 + Math.random() * 40, y: 320 + Math.random() * 60 },
      data: { frequency: 440, waveform: "sine", running: false },
    };
    createAudioNode(node);
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  const addMixer = useCallback(() => {
    mixerCount.current += 1;
    const node: MixerFlowNode = {
      id: `mixer-${mixerCount.current}`,
      type: "mixer",
      position: { x: 300 + Math.random() * 40, y: 320 + Math.random() * 60 },
      data: { ch1: 0.8, ch2: 0.8, ch3: 0.8, master: 0.8 },
    };
    createAudioNode(node);
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  const addFilter = useCallback(() => {
    filterCount.current += 1;
    const node: VcfFlowNode = {
      id: `filter-${filterCount.current}`,
      type: "vcf",
      position: { x: 440 + Math.random() * 40, y: 460 + Math.random() * 60 },
      data: {
        cutoff: 1200,
        resonance: 2,
        filterType: "lowpass",
        cutoffAmount: 2000,
        resonanceAmount: 0,
      },
    };
    createAudioNode(node);
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  const addEnvelope = useCallback(() => {
    envelopeCount.current += 1;
    const node: EnvelopeFlowNode = {
      id: `envelope-${envelopeCount.current}`,
      type: "envelope",
      position: { x: 440 + Math.random() * 40, y: 460 + Math.random() * 60 },
      data: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 },
    };
    createAudioNode(node);
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  return (
    // Erster Klick irgendwo im Canvas weckt den AudioContext auf
    <div className={styles.app} onPointerDown={() => void resumeAudio()}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Modular Synth</h1>
        <button className={styles.btn} onClick={addOscillator}>
          + Oszillator
        </button>
        <button className={styles.btn} onClick={addMixer}>
          + Mixer
        </button>
        <button className={styles.btn} onClick={addFilter}>
          + Filter
        </button>
        <button className={styles.btn} onClick={addEnvelope}>
          + ADSR / Envelope
        </button>
        <p className={styles.hint}>
          Ausgang → Eingang ziehen, um zu patchen. Kabel per Doppelklick
          entfernen — oder auswählen und Entf/Backspace.
        </p>
      </div>

      <ReactFlow<AppNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodesDelete={onNodesDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
