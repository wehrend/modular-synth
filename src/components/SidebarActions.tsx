// components/SidebarActions.tsx
import { useTranslation } from "react-i18next";
import styles from "./SidebarActions.module.scss";
import LanguageSwitcher from "./LanguageSwitcher";

type Props = {
  activePresetName: string | null;
  onSave: () => void;
  onSaveAs: () => void;
};

export default function SidebarActions({
  activePresetName,
  onSave,
  onSaveAs,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.actions}>
      <button className={styles.btn} onClick={onSave}>
        {activePresetName
          ? t("toolbar.saveNamed", { name: activePresetName })
          : t("toolbar.save")}
      </button>
      <button className={styles.btn} onClick={onSaveAs}>
        {t("toolbar.saveAs")}
      </button>
      <LanguageSwitcher />
    </div>
  );
}
