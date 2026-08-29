// components/Toolbar.tsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import styles from "../App.module.scss";
import ModuleToolbar, { type ModuleButtonConfig } from "./ModuleToolbar";
import Info from "./Info";

type Props = {
  user: User | null;
  moduleButtons: ModuleButtonConfig[];
};

export default function Toolbar({ user, moduleButtons }: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <Link className={styles.btn} to="/discover">
        {t("toolbar.discover")}
      </Link>
      <h1 className={styles.title}>{t("toolbar.title")}</h1>
      {!user && (
        <Link className={styles.btn} to="/login">
          {t("toolbar.login")}
        </Link>
      )}
      <div className={styles.actions}>
        <ModuleToolbar modules={moduleButtons} />
        <Info>{t("toolbar.hint")}</Info>
      </div>
    </div>
  );
}
