// pages/PrivacyPage.tsx
import { useTranslation } from "react-i18next";
import styles from "./AuthPages.module.scss";

// Feste Reihenfolge der Abschnitte -- i18next liefert Objekte ohne
// garantierte Key-Reihenfolge über returnObjects zurück, deshalb hier
// explizit vorgeben statt Object.entries() auf den rohen Übersetzungs-
// block loszulassen.
const SECTION_ORDER = [
  "controller",
  "overview",
  "hosting",
  "account",
  "profile",
  "patches",
  "microphone",
  "retention",
  "rights",
  "storage",
  "contact",
] as const;

export default function PrivacyPage() {
  const { t } = useTranslation();
  const today = new Date().toLocaleDateString();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("pages.privacy.title")}</h1>
        <p className={styles.hint}>
          {t("pages.privacy.lastUpdated", { date: today })}
        </p>

        {SECTION_ORDER.map((key) => {
          const heading = t(`pages.privacy.sections.${key}.heading`);
          const paragraphs = t(`pages.privacy.sections.${key}.paragraphs`, {
            returnObjects: true,
          }) as string[];

          return (
            <section key={key}>
              <h2>{heading}</h2>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-line" }}>
                  {p}
                </p>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
