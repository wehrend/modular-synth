// PresetSidebar.tsx
import { useEffect, useState, useCallback } from "react";
import { listPresets, type PresetMeta } from "../persist/localStore";
import styles from "./PresetSidebar.module.scss";

type Props = {
  onLoad: (name: string) => void;
  refreshKey: number;
  activeName: string | null;
};

export default function PresetSidebar({
  onLoad,
  refreshKey,
  activeName,
}: Props) {
  const [presets, setPresets] = useState<PresetMeta[]>([]);

  const refresh = useCallback(() => setPresets(listPresets()), []);

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
            key={p.name}
            className={`${styles.item} ${p.name === activeName ? styles.active : ""}`}
          >
            <button className={styles.loadBtn} onClick={() => onLoad(p.name)}>
              {p.name}
            </button>
            <span className={styles.date}>
              {new Date(p.savedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
