// hooks/usePatchFromUrl.ts
// Lädt einen öffentlichen Patch, wenn die URL einen ?patch=<id>-Parameter
// trägt (z.B. über einen geteilten Link aus DiscoverPage). Läuft bewusst
// nur beim Mount -- ein Patch-Link soll nur beim initialen Öffnen greifen,
// nicht bei jeder späteren Änderung von searchParams.

import { useEffect } from "react";
import type { Edge } from "@xyflow/react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loadPublicPatch } from "../persist/supabase";
import { loadPatchIntoFlow } from "../lib/loadPatchIntoFlow";
import type { AppNode } from "../types";

export function usePatchFromUrl(
  nodes: AppNode[],
  setNodes: (nodes: AppNode[]) => void,
  setEdges: (edges: Edge[]) => void,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const patchId = searchParams.get("patch");
    if (!patchId) return;

    loadPublicPatch(patchId)
      .then((doc) => {
        const { nodes: newNodes, edges: newEdges } = loadPatchIntoFlow(
          doc,
          nodes,
        );
        setNodes(newNodes);
        setEdges(newEdges);
        setSearchParams({}, { replace: true });
      })
      .catch((err) =>
        window.alert(
          err instanceof Error ? err.message : t("app.errors.loadFailed"),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // bewusst nur beim Mount
}
