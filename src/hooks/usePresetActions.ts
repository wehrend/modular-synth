// hooks/usePresetActions.ts
// Bündelt alles, was mit dem Speichern/Laden/Löschen/Veröffentlichen von
// Presets zu tun hat. Braucht Lese-/Schreibzugriff auf den React-Flow-
// Zustand aus App.tsx, deshalb als Parameter statt eigenem State.

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Edge } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { serializePatch } from "../persist/serialize";
import {
  savePreset,
  loadPresetById,
  togglePublic,
  overwritePreset,
  deletePreset,
} from "../persist/supabase";
import { captureFlowThumbnail } from "../lib/captureThumbnail";
import { loadPatchIntoFlow } from "../lib/loadPatchIntoFlow";
import type { AppNode } from "../types";

export function usePresetActions(
  nodes: AppNode[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<AppNode[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [presetRefresh, setPresetRefresh] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const handleTogglePublic = useCallback(
    async (id: string, next: boolean) => {
      try {
        await togglePublic(id, next);
        setPresetRefresh((v) => v + 1);
      } catch (err) {
        window.alert(
          err instanceof Error
            ? err.message
            : t("app.errors.visibilityChangeFailed"),
        );
      }
    },
    [t],
  );

  const handleSaveAs = useCallback(() => {
    if (!user) {
      window.alert(t("app.errors.loginRequiredToSave"));
      return;
    }
    setSaveDialogOpen(true);
  }, [user, t]);

  const handleSave = useCallback(async () => {
    if (!user) {
      window.alert(t("app.errors.loginRequiredToSave"));
      return;
    }

    // Kein Preset aktiv geladen -> wie "Speichern unter" verhalten,
    // statt eine ID zu updaten, die es gar nicht gibt.
    if (!activePresetId) {
      handleSaveAs();
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
        err instanceof Error ? err.message : t("app.errors.saveFailed"),
      );
    }
  }, [user, activePresetId, nodes, edges, handleSaveAs, t]);

  const handleConfirmSave = useCallback(
    async (name: string, description: string | null) => {
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
          err instanceof Error ? err.message : t("app.errors.saveFailed"),
        );
      }
    },
    [user, nodes, edges, t],
  );

  const loadPresetByIdHandler = useCallback(
    async (id: string, name: string) => {
      try {
        const doc = await loadPresetById(id);
        const { nodes: newNodes, edges: newEdges } = loadPatchIntoFlow(
          doc,
          nodes,
        );

        setNodes(newNodes);
        setEdges(newEdges);
        setActivePresetId(id);
        setActivePresetName(name);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : t("app.errors.loadFailed"),
        );
      }
    },
    [nodes, setNodes, setEdges, t],
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
          err instanceof Error ? err.message : t("app.errors.deleteFailed"),
        );
      }
    },
    [activePresetId, t],
  );

  return {
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
  };
}
