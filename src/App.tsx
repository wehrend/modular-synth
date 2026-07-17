// App.tsx
// Der Flow-Graph ist die "Wahrheit" für die Patch-Struktur.
// Jede Änderung an Kanten/Knoten wird 1:1 in den Audiographen gespiegelt.

import { useCallback, useRef } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import OscillatorNode from './nodes/OscillatorNode';
import OutputNode from './nodes/OutputNode';
import {
  createAudioNode,
  connectAudio,
  disconnectAudio,
  removeAudioNode,
  resumeAudio,
} from './audio';
import type { AppNode, OscFlowNode } from './types';
import styles from './App.module.scss';

const nodeTypes = {
  osc: OscillatorNode,
  out: OutputNode,
};

const initialNodes: AppNode[] = [
  {
    id: 'osc-1',
    type: 'osc',
    position: { x: 60, y: 140 },
    data: { frequency: 220, waveform: 'sawtooth', running: false },
  },
  {
    id: 'out-1',
    type: 'out',
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

  const onConnect = useCallback(
    (connection: Connection) => {
      connectAudio(connection.source, connection.target);
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges]
  );

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach((edge) => disconnectAudio(edge.source, edge.target));
  }, []);

  // Bugfix (v3): Doppelklick auf ein Kabel zieht es raus.
  // Achtung: setEdges löst onEdgesDelete NICHT aus, deshalb muss das
  // Audio-Trennen hier explizit passieren.
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      disconnectAudio(edge.source, edge.target);
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  const onNodesDelete = useCallback((deleted: AppNode[]) => {
    deleted.forEach((node) => removeAudioNode(node.id));
  }, []);

  const addOscillator = useCallback(() => {
    oscCount.current += 1;
    const node: OscFlowNode = {
      id: `osc-${oscCount.current}`,
      type: 'osc',
      position: { x: 60 + Math.random() * 40, y: 320 + Math.random() * 60 },
      data: { frequency: 440, waveform: 'sine', running: false },
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
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
