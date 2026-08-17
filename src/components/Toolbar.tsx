// components/Toolbar.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import styles from "../App.module.scss";
import ModuleToolbar, { type ModuleButtonConfig } from "./ModuleToolbar";
import LanguageSwitcher from "./LanguageSwitcher";

type Props = {
  user: User | null;
  displayName: string | null;
  onLogout: () => void;
  activePresetName: string | null;
  onSave: () => void;
  onSaveAs: () => void;
  moduleButtons: ModuleButtonConfig[];
};

export default function Toolbar({
  user,
  displayName,
  onLogout,
  activePresetName,
  onSave,
  onSaveAs,
  moduleButtons,
}: Props) {
  const { t } = useTranslation();

  return (
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
          <button className={styles.btn} onClick={onLogout}>
            {t("toolbar.logout")}
          </button>
        </>
      ) : (
        <Link className={styles.btn} to="/login">
          {t("toolbar.login")}
        </Link>
      )}
      <div className={styles.actions}>
        <button className={styles.btn} onClick={onSave}>
          {activePresetName
            ? t("toolbar.saveNamed", { name: activePresetName })
            : t("toolbar.save")}
        </button>
        <button className={styles.btn} onClick={onSaveAs}>
          {t("toolbar.saveAs")}
        </button>
        <ModuleToolbar modules={moduleButtons} />
        <LanguageSwitcher />
        <p className={styles.hint}>{t("toolbar.hint")}</p>
      </div>
    </div>
  );
}
