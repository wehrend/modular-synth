// App.tsx
// Der Flow-Graph ist die "Wahrheit" für die Patch-Struktur.
// Jede Änderung an Kanten/Knoten wird 1:1 in den Audiographen gespiegelt.

import { useCallback, useState } from "react";
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
  LfoFlowNode,
} from "./types";
import styles from "./App.module.scss";
import FilterNode from "./nodes/FilterNode";
import EnvelopeNode from "./nodes/EnvelopeNode";
import LfoNode from "./nodes/LfoNode";

import { serializePatch, toFlow } from "./persist/serialize";
import { savePreset, loadPreset, listPresets } from "./persist/localStore";
import { nextId, seedIds } from "./persist/ids";
import PresetSidebar from "./components/PresetSidebar";

const nodeTypes = {
  osc: OscillatorNode,
  mixer: MixerNode,
  vcf: FilterNode,
  envelope: EnvelopeNode,
  lfo: LfoNode,
  out: OutputNode,
};

const initialNodes: AppNode[] = [
  {
    id: "osc-1",
    type: "osc",
    position: { x: 40, y: 60 },
    data: { frequency: 220, waveform: "sawtooth", running: true },
  },
  {
    id: "lfo-1",
    type: "lfo",
    position: { x: 40, y: 260 },
    data: { rate: 3, waveform: "sine" },
  },
  {
    id: "vcf-1",
    type: "vcf",
    position: { x: 340, y: 160 },
    data: {
      cutoff: 1500,
      resonance: 3,
      filterType: "lowpass",
      cutoffAmount: 1200,
      resonanceAmount: 0,
    },
  },
  {
    id: "envelope-1",
    type: "envelope",
    position: { x: 660, y: 200 },
    data: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
  },
  {
    id: "out-1",
    type: "out",
    position: { x: 960, y: 220 },
    data: { volume: -12, muted: false },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e-osc-vcf",
    source: "osc-1",
    target: "vcf-1",
    targetHandle: "in",
    animated: true,
  },
  {
    id: "e-lfo-vcf",
    source: "lfo-1",
    target: "vcf-1",
    targetHandle: "cutoff",
    animated: true,
  },
  {
    id: "e-vcf-env",
    source: "vcf-1",
    sourceHandle: "out",
    target: "envelope-1",
    targetHandle: "in",
    animated: true,
  },
  {
    id: "e-env-outL",
    source: "envelope-1",
    sourceHandle: "out",
    target: "out-1",
    targetHandle: "inL",
    animated: true,
  },
  {
    id: "e-env-outR",
    source: "envelope-1",
    sourceHandle: "out",
    target: "out-1",
    targetHandle: "inR",
    animated: true,
  },
];

// Tone.js-Gegenstücke für den Startzustand anlegen (Modul-Scope statt
// useEffect: läuft garantiert genau einmal, auch unter React StrictMode).
initialNodes.forEach((n) =>
  createAudioNode({ id: n.id, type: n.type as any, data: n.data as any }),
);
initialEdges.forEach((e) => connectAudio(e.source, e.target, e.targetHandle));

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetRefresh, setPresetRefresh] = useState(0);

  const handleSave = () => {
    if (activePreset) {
      // Ein Preset ist geladen → "Speichern" aktualisiert es direkt, ohne Nachfrage
      savePreset(activePreset, serializePatch(nodes, edges));
      setPresetRefresh((v) => v + 1);
      return;
    }
    handleSaveAs(); // noch nichts geladen → wie "Speichern unter"
  };

  const handleSaveAs = () => {
    const name = window.prompt("Preset-Name?");
    if (!name) return;

    const exists = listPresets().some((p) => p.name === name);
    if (
      exists &&
      !window.confirm(`"${name}" existiert bereits. Überschreiben?`)
    ) {
      return; // stillschweigendes Überschreiben verhindert (dein dritter Punkt)
    }

    savePreset(name, serializePatch(nodes, edges));
    setActivePreset(name);
    setPresetRefresh((v) => v + 1);
  };

  const loadPresetByName = useCallback(
    (name: string) => {
      try {
        const doc = loadPreset(name);
        const { nodes: newNodes, edges: newEdges } = toFlow(doc);

        nodes.forEach((n) => removeAudioNode(n.id));
        newNodes.forEach((n) =>
          createAudioNode({
            id: n.id,
            type: n.type as any,
            data: n.data as any,
          }),
        );
        newEdges.forEach((e) =>
          connectAudio(e.source, e.target, e.targetHandle),
        );
        seedIds(newNodes.map((n) => n.id));

        setNodes(newNodes);
        setEdges(newEdges);
        setActivePreset(name); // ← neu
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Fehler beim Laden.");
      }
    },
    [nodes, setNodes, setEdges],
  );

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
      disconnectAudio(edge.source, edge.target, edge.targetHandle); // ← ergänzt
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  const onNodesDelete = useCallback((deleted: AppNode[]) => {
    deleted.forEach((node) => removeAudioNode(node.id));
  }, []);

  function useAddModule<T extends AppNode>(
    idPrefix: string,
    nodeType: T["type"],
    basePosition: { x: number; y: number },
    makeDefaults: () => T["data"],
    setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>,
  ) {
    return useCallback(() => {
      const node = {
        id: nextId(idPrefix), // ersetzt: countRef.current += 1; `${idPrefix}-${countRef.current}`
        type: nodeType,
        position: {
          x: basePosition.x + Math.random() * 40,
          y: basePosition.y + Math.random() * 60,
        },
        data: makeDefaults(),
      } as T;
      createAudioNode(node);
      setNodes((nds) => [...nds, node]);
    }, [idPrefix, nodeType, basePosition, setNodes]);
  }
  const addOscillator = useAddModule<OscFlowNode>(
    "osc",
    "osc",
    { x: 60, y: 320 },
    () => ({ frequency: 440, waveform: "sine", running: false }),
    setNodes,
  );

  const addMixer = useAddModule<MixerFlowNode>(
    "mixer",
    "mixer",
    { x: 300, y: 320 },
    () => ({ ch1: 0.8, ch2: 0.8, ch3: 0.8, master: 0.8 }),
    setNodes,
  );

  const addFilter = useAddModule<VcfFlowNode>(
    "filter",
    "vcf",
    { x: 440, y: 460 },
    () => ({
      cutoff: 1200,
      resonance: 2,
      filterType: "lowpass",
      cutoffAmount: 2000,
      resonanceAmount: 0,
    }),
    setNodes,
  );

  const addEnvelope = useAddModule<EnvelopeFlowNode>(
    "envelope",
    "envelope",
    { x: 440, y: 460 },
    () => ({ attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.5 }),
    setNodes,
  );

  const addLfo = useAddModule<LfoFlowNode>(
    "lfo",
    "lfo",
    { x: 440, y: 460 },
    () => ({ rate: 4.4, waveform: "sawtooth" }),
    setNodes,
  );

  return (
    // Erster Klick irgendwo im Canvas weckt den AudioContext auf
    <div className={styles.app} onPointerDown={() => void resumeAudio()}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Modular Synth</h1>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleSave}>
            {activePreset ? `Speichern (${activePreset})` : "Speichern"}
          </button>
          <button className={styles.btn} onClick={handleSaveAs}>
            Speichern unter…
          </button>

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
          <button className={styles.btn} onClick={addLfo}>
            + LFO
          </button>
          <p className={styles.hint}>
            Ausgang → Eingang ziehen, um zu patchen. Kabel per Doppelklick
            entfernen — oder auswählen und Entf/Backspace.
          </p>
        </div>
      </div>
      <div className={styles.layout}>
        <PresetSidebar
          onLoad={loadPresetByName}
          refreshKey={presetRefresh}
          activeName={activePreset}
        />
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
    </div>
  );
}
