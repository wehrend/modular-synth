import type { AppNode } from "../types";
import { nextId } from "../persist/ids"; // dein bestehender Pfad zu nextId
import { createAudioNode } from "../audio";
import type { ModuleCatalogEntry } from "../moduleCatalog";

export function createAddModuleHandler(
  entry: ModuleCatalogEntry,
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>,
): () => void {
  return () => {
    const node = {
      id: nextId(entry.idPrefix),
      type: entry.type,
      position: {
        x: entry.basePosition.x + Math.random() * 40,
        y: entry.basePosition.y + Math.random() * 60,
      },
      data: entry.defaults(),
    } as AppNode;

    createAudioNode(node);
    setNodes((nds) => [...nds, node]);
  };
}
