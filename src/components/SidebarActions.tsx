// components/SidebarActions.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import styles from "./SidebarActions.module.scss";
import LanguageSwitcher from "./LanguageSwitcher";

type Props = {
  user: User | null;
  displayName: string | null;
  onLogout: () => void;
  activePresetName: string | null;
  onSave: () => void;
  onSaveAs: () => void;
};

export default function SidebarActions({
  user,
  displayName,
  onLogout,
  activePresetName,
  onSave,
  onSaveAs,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper}>
      {user && (
        <div className={styles.group}>
          <Link className={styles.btn} to={`/user/${user.id}`}>
            {displayName ?? user.email}
          </Link>
          <button className={styles.btn} onClick={onLogout}>
            {t("toolbar.logout")}
          </button>
        </div>
      )}

      <div className={styles.group}>
        <button className={styles.btn} onClick={onSave}>
          {activePresetName
            ? t("toolbar.saveNamed", { name: activePresetName })
            : t("toolbar.save")}
        </button>
        <button className={styles.btn} onClick={onSaveAs}>
          {t("toolbar.saveAs")}
        </button>
      </div>

      <div className={styles.group}>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
