// PresetSidebar.tsx
import { useEffect, useState, useCallback } from "react";
import { listPresets, type PresetRow } from "../persist/supabase";
import styles from "./PresetSidebar.module.scss";

type Props = {
  onLoad: (id: string) => void;
  onTogglePublic: (id: string, next: boolean) => void;
  activeId: string | null;
  refreshKey: number;
  userId: string | null;
};

export default function PresetSidebar({
  onLoad,
  onTogglePublic,
  activeId,
  refreshKey,
  userId,
}: Props) {
  const [presets, setPresets] = useState<PresetRow[]>([]);

  const refresh = useCallback(() => {
    if (!userId) {
      setPresets([]);
      return;
    }
    listPresets(userId)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return (
    <aside className={styles.sidebar}>
      <h2 className={styles.title}>Presets</h2>
      {presets.length === 0 && (
        <p className={styles.empty}>Noch keine gespeichert.</p>
      )}

      <ul className={styles.list}>
        {presets.map((p) => (
          <li
            key={p.id}
            className={`${styles.item} ${p.id === activeId ? styles.active : ""}`}
          >
            <button
              className={styles.publicBtn}
              onClick={() => onTogglePublic(p.id, !p.is_public)}
              aria-label={p.is_public ? "Privat machen" : "Öffentlich machen"}
              title={p.is_public ? "Öffentlich" : "Privat"}
            >
              {p.is_public ? "🌐" : "🔒"}
            </button>
            <button className={styles.loadBtn} onClick={() => onLoad(p.id)}>
              {p.name}
            </button>
            <span className={styles.date}>
              {new Date(p.updated_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
