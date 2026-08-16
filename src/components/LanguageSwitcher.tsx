import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import styles from "../App.module.scss";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  // resolvedLanguage kann z.B. "de-DE" sein -- auf unterstützte Codes normalisieren.
  const current = SUPPORTED_LANGUAGES.includes(
    i18n.resolvedLanguage as (typeof SUPPORTED_LANGUAGES)[number],
  )
    ? i18n.resolvedLanguage!
    : "en";

  return (
    <select
      className={styles.btn}
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t("toolbar.language")}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {t(`language.${code}`)}
        </option>
      ))}
    </select>
  );
}
