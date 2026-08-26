// PresetSidebar.tsx
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listPresets, type PresetRow } from "../persist/supabase";
import styles from "./PresetSidebar.module.scss";
import { GlobeIcon, LockIcon, TrashIcon } from "lucide-react";

type Props = {
  onLoad: (id: string, name: string) => void;
  onTogglePublic: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
  refreshKey: number;
  userId: string | null;
};

export default function PresetSidebar({
  onLoad,
  onTogglePublic,
  onDelete,
  activeId,
  refreshKey,
  userId,
}: Props) {
  const { t } = useTranslation();
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
      <h2 className={styles.title}>{t("components.presetSidebar.title")}</h2>
      {presets.length === 0 && (
        <p className={styles.empty}>{t("components.presetSidebar.empty")}</p>
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
              aria-label={
                p.is_public
                  ? t("components.presetSidebar.makePrivate")
                  : t("components.presetSidebar.makePublic")
              }
              title={
                p.is_public
                  ? t("components.presetSidebar.public")
                  : t("components.presetSidebar.private")
              }
            >
              {p.is_public ? <GlobeIcon /> : <LockIcon />}
            </button>
            <button
              className={styles.loadBtn}
              onClick={() => onLoad(p.id, p.name)}
            >
              {p.name}
            </button>
            {p.description && (
              <p className={styles.presetDescription}>{p.description}</p>
            )}
            <span className={styles.date}>
              {new Date(p.updated_at).toLocaleDateString()}
            </span>

            <button
              className={styles.deleteBtn}
              onClick={() => {
                if (
                  window.confirm(
                    t("components.presetSidebar.deleteConfirm", {
                      name: p.name,
                    }),
                  )
                ) {
                  onDelete(p.id);
                }
              }}
              aria-label={t("components.presetSidebar.deleteAriaLabel", {
                name: p.name,
              })}
              title={t("components.presetSidebar.deleteTitle")}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
