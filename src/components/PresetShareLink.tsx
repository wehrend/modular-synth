// components/PresetShareLink.tsx
import { useState } from "react";
import { useHref } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./SidebarActions.module.scss";

type Props = {
  presetId: string | null;
  isPublic: boolean;
};

export default function PresetShareLink({ presetId, isPublic }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // useHref löst die Ziel-Route ("/", die Synth-Hauptseite) korrekt inkl.
  // Basename auf ("/modular-synth/" auf GitHub Pages, "/" lokal) --
  // unabhängig davon, auf welcher Seite diese Komponente gerade rendert.
  // WICHTIG: window.location.pathname wäre hier falsch (Bug behoben) --
  // das lieferte auf der Discover-Seite ".../discover" statt der
  // Synth-Route, die den ?patch=-Parameter überhaupt auswertet.
  const rootHref = useHref("/");

  if (!presetId) return null;

  const shareUrl = `${window.location.origin}${rootHref.replace(/\/$/, "")}/?patch=${presetId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(t("components.presetShareLink.copyFailed"), err);
    }
  };

  return (
    <div className={styles.group}>
      <span className={styles.shareLabel}>{t("components.presetShareLink.label")}</span>
      <input
        className={styles.shareUrl}
        type="text"
        readOnly
        value={shareUrl}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button className={styles.btn} onClick={handleCopy}>
        {copied
          ? t("components.presetShareLink.copied")
          : t("components.presetShareLink.copy")}
      </button>
      {/* Serverseitig lehnt loadPublicPatch private Presets ab (siehe
          supabase.ts: "Patch nicht gefunden oder nicht öffentlich.") --
          der Link ist also technisch korrekt, funktioniert für andere
          Personen aber erst, wenn das Preset öffentlich geschaltet ist. */}
      {!isPublic && (
        <span className={styles.sharePrivateHint}>
          {t("components.presetShareLink.privateHint")}
        </span>
      )}
    </div>
  );
}