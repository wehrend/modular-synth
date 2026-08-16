// App.tsx
// Der Flow-Graph ist die "Wahrheit" für die Patch-Struktur.
// Jede Änderung an Kanten/Knoten wird 1:1 in den Audiographen gespiegelt.

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { AppNode } from "./types";
import styles from "./App.module.scss";
import FilterNode from "./nodes/FilterNode";
import EnvelopeNode from "./nodes/EnvelopeNode";
import LfoNode from "./nodes/LfoNode";

import { serializePatch, toFlow } from "./persist/serialize";
import {
  savePreset,
  loadPresetById,
  togglePublic,
  loadPublicPatch,
  overwritePreset,
  deletePreset,
} from "./persist/supabase";
import { seedIds } from "./persist/ids";
import PresetSidebar from "./components/PresetSidebar";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { captureFlowThumbnail } from "./lib/captureThumbnail";
import SavePresetDialog from "./components/SavePresetDialog";
import RingModNode from "./nodes/RingModNode";
import WaspNode from "./nodes/WaspNode";
// App.tsx, oben bei den anderen Imports
import { initialNodes, initialEdges } from "./defaultPatch";
import NoiseNode from "./nodes/NoiseNode";
import VcaNode from "./nodes/VcaNode";
import ModuleToolbar from "./components/ModuleToolbar";
import { createAddModuleHandler } from "./lib/addModule";
import { MODULE_CATALOG } from "./moduleCatalog";
import SequencerNode from "./nodes/SequencerNode";

import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";

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
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [presetRefresh, setPresetRefresh] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // innerhalb der Komponente:
  const { user, displayName, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // innerhalb der App-Komponente:
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const patchId = searchParams.get("patch");
    if (!patchId) return;

    loadPublicPatch(patchId)
      .then((doc) => {
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
          connectAudio(e.source, e.target, e.sourceHandle, e.targetHandle),
        );
        seedIds(newNodes.map((n) => n.id));
        setNodes(newNodes);
        setEdges(newEdges);
        setSearchParams({}, { replace: true });
      })
      .catch((err) =>
        window.alert(err instanceof Error ? err.message : "Fehler beim Laden."),
      );
  }, []); // bewusst nur beim Mount

  // App.tsx
  const handleTogglePublic = useCallback(async (id: string, next: boolean) => {
    console.log("handleTogglePublic aufgerufen:", { id, next });
    try {
      await togglePublic(id, next);
      console.log("togglePublic erfolgreich");
      setPresetRefresh((v) => v + 1);
    } catch (err) {
      console.log("togglePublic Fehler:", err);
      window.alert(
        err instanceof Error
          ? err.message
          : "Fehler beim Ändern der Sichtbarkeit.",
      );
    }
  }, []);

  const handleSave = async () => {
    if (!user) {
      window.alert("Bitte zuerst anmelden, um Presets zu speichern.");
      return;
    }

    // Kein Preset aktiv geladen -> wie "Speichern unter" verhalten,
    // statt eine ID zu updaten, die es gar nicht gibt.
    if (!activePresetId) {
      await handleSaveAs();
      return;
    }

    try {
      const thumbnail = await captureFlowThumbnail(nodes);
      await overwritePreset(
        activePresetId,
        user.id,
        serializePatch(nodes, edges),
        thumbnail,
      );
      setPresetRefresh((v) => v + 1);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Fehler beim Speichern.",
      );
    }
  };

  const handleSaveAs = () => {
    if (!user) {
      window.alert("Bitte zuerst anmelden, um Presets zu speichern.");
      return;
    }
    setSaveDialogOpen(true);
  };

  const handleConfirmSave = async (
    name: string,
    description: string | null,
  ) => {
    setSaveDialogOpen(false);
    if (!user) return;

    try {
      const thumbnail = await captureFlowThumbnail(nodes);
      const id = await savePreset(
        user.id,
        name,
        description,
        serializePatch(nodes, edges),
        thumbnail,
      );
      setActivePresetId(id);
      setActivePresetName(name);
      setPresetRefresh((v) => v + 1);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Fehler beim Speichern.",
      );
    }
  };

  const loadPresetByIdHandler = useCallback(
    async (id: string, name: string) => {
      try {
        const doc = await loadPresetById(id);
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
          connectAudio(e.source, e.target, e.sourceHandle, e.targetHandle),
        );
        seedIds(newNodes.map((n) => n.id));

        setNodes(newNodes);
        setEdges(newEdges);
        setActivePresetId(id);
        setActivePresetName(name); // ← ergänzt
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Fehler beim Laden.");
      }
    },
    [nodes, setNodes, setEdges],
  );

  const handleDeletePreset = useCallback(
    async (id: string) => {
      try {
        await deletePreset(id);
        // Falls gerade das aktive Preset gelöscht wurde, Zustand zurücksetzen —
        // sonst würde der "Speichern"-Button weiterhin auf eine ID zeigen,
        // die es in der Datenbank nicht mehr gibt.
        if (id === activePresetId) {
          setActivePresetId(null);
          setActivePresetName(null);
        }
        setPresetRefresh((v) => v + 1);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Fehler beim Löschen.",
        );
      }
    },
    [activePresetId],
  );

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
      ); // ← ergänzt
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

  // innerhalb der Komponente, ersetzt alle neun addXxx-Konstanten und useAddModule:
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
      <div className={styles.toolbar}>
        <Link className={styles.btn} to="/discover">
          {t("toolbar.discover")}
        </Link>
        <h1 className={styles.title}>{t("toolbar.title")}</h1>
        {user ? (
          <>
            <Link className={styles.btn} to={`/user/${user.id}`}>
              {displayName ?? user.email}
            </Link>
            <button className={styles.btn} onClick={handleLogout}>
              {t("toolbar.logout")}
            </button>
          </>
        ) : (
          <Link className={styles.btn} to="/login">
            {t("toolbar.login")}
          </Link>
        )}
        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleSave}>
            {activePresetName
              ? t("toolbar.saveNamed", { name: activePresetName })
              : t("toolbar.save")}
          </button>
          <button className={styles.btn} onClick={handleSaveAs}>
            {t("toolbar.saveAs")}
          </button>
          <ModuleToolbar modules={moduleButtons} />
          <LanguageSwitcher />
          <p className={styles.hint}>{t("toolbar.hint")}</p>
        </div>
      </div>
      <div className={styles.layout}>
        <PresetSidebar
          onLoad={loadPresetByIdHandler} // war: onLoad={loadPresetByName}
          onTogglePublic={handleTogglePublic}
          onDelete={handleDeletePreset}
          activeId={activePresetId} // war: activeName={activePreset}
          refreshKey={presetRefresh}
          userId={user?.id ?? null}
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
