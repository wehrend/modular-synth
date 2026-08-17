// App.tsx
// Der Flow-Graph ist die "Wahrheit" für die Patch-Struktur.
// Jede Änderung an Kanten/Knoten wird 1:1 in den Audiographen gespiegelt.
//
// Diese Datei orchestriert nur noch: Node-Typen-Registry, initialen
// Audiographen-Aufbau, und das Zusammenstecken der ausgelagerten Hooks
// (usePresetActions, usePatchFromUrl, useFlowAudioSync) mit dem Layout.
// Die eigentliche Logik lebt in src/hooks/ und src/lib/.

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import OscillatorNode from "./nodes/OscillatorNode";
import MixerNode from "./nodes/MixerNode";
import OutputNode from "./nodes/OutputNode";
import FilterNode from "./nodes/FilterNode";
import EnvelopeNode from "./nodes/EnvelopeNode";
import LfoNode from "./nodes/LfoNode";
import RingModNode from "./nodes/RingModNode";
import WaspNode from "./nodes/WaspNode";
import NoiseNode from "./nodes/NoiseNode";
import VcaNode from "./nodes/VcaNode";
import SequencerNode from "./nodes/SequencerNode";
import SamplerNode from "./nodes/SamplerNode";

import { createAudioNode, connectAudio, resumeAudio } from "./audio";
import type { AppNode } from "./types";
import styles from "./App.module.scss";

import PresetSidebar from "./components/PresetSidebar";
import SavePresetDialog from "./components/SavePresetDialog";
import Toolbar from "./components/Toolbar";
import SidebarActions from "./components/SidebarActions";
import { useAuth } from "./auth/AuthContext";
import { initialNodes, initialEdges } from "./defaultPatch";
import { createAddModuleHandler } from "./lib/addModule";
import { MODULE_CATALOG } from "./moduleCatalog";
import { usePresetActions } from "./hooks/usePresetActions";
import { usePatchFromUrl } from "./hooks/usePatchFromUrl";
import { useFlowAudioSync } from "./hooks/useFlowAudioSync";

const nodeTypes = {
  osc: OscillatorNode,
  mixer: MixerNode,
  vcf: FilterNode,
  envelope: EnvelopeNode,
  ringmod: RingModNode,
  lfo: LfoNode,
  wasp: WaspNode,
  noise: NoiseNode,
  vca: VcaNode,
  sequencer: SequencerNode,
  sampler: SamplerNode,
  out: OutputNode,
};

// Tone.js-Gegenstücke für den Startzustand anlegen (Modul-Scope statt
// useEffect: läuft garantiert genau einmal, auch unter React StrictMode).
initialNodes.forEach((n) =>
  createAudioNode({ id: n.id, type: n.type as any, data: n.data as any }),
);
initialEdges.forEach((e) =>
  connectAudio(e.source, e.target, e.sourceHandle, e.targetHandle),
);

export default function App() {
  const { t, i18n } = useTranslation();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  const { user, displayName, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const {
    activePresetId,
    activePresetName,
    presetRefresh,
    saveDialogOpen,
    setSaveDialogOpen,
    handleSave,
    handleSaveAs,
    handleConfirmSave,
    loadPresetByIdHandler,
    handleDeletePreset,
    handleTogglePublic,
  } = usePresetActions(nodes, edges, setNodes, setEdges);

  usePatchFromUrl(nodes, setNodes, setEdges);

  const { onConnect, onEdgesDelete, onEdgeDoubleClick, onNodesDelete } =
    useFlowAudioSync(setEdges);

  // ersetzt alle neun addXxx-Konstanten und useAddModule:
  const moduleButtons = useMemo(
    () =>
      MODULE_CATALOG.map((entry) => ({
        type: entry.type,
        label: t(entry.labelKey),
        onClick: createAddModuleHandler(entry, setNodes),
      })),
    // i18n.language explizit in den Deps, damit die Labels beim
    // Sprachwechsel neu berechnet werden -- t() selbst ist keine reaktive
    // Abhängigkeit, useMemo würde den Sprachwechsel sonst nicht bemerken.
    [setNodes, t, i18n.language],
  );

  return (
    // Erster Klick irgendwo im Canvas weckt den AudioContext auf
    <div className={styles.app} onPointerDown={() => void resumeAudio()}>
      <SavePresetDialog
        open={saveDialogOpen}
        onCancel={() => setSaveDialogOpen(false)}
        onConfirm={handleConfirmSave}
      />
      <Toolbar
        user={user}
        displayName={displayName}
        onLogout={handleLogout}
        moduleButtons={moduleButtons}
      />
      <div className={styles.layout}>
        <div className={styles.sidebarColumn}>
          <SidebarActions
            activePresetName={activePresetName}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
          />
          <PresetSidebar
            onLoad={loadPresetByIdHandler}
            onTogglePublic={handleTogglePublic}
            onDelete={handleDeletePreset}
            activeId={activePresetId}
            refreshKey={presetRefresh}
            userId={user?.id ?? null}
          />
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
          defaultEdgeOptions={{ style: { stroke: "#333", strokeWidth: 2 } }}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}