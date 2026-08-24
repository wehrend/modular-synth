// components/ResourceStatsOverlay.tsx
// Eigenständiges Overlay unten rechts -- bewusst NICHT an SidebarActions
// gekoppelt, damit es unabhängig von Sidebar-Layout-Änderungen an fester
// Bildschirmposition bleibt.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getResourceStats, type ResourceStats } from "../audio";
import styles from "./ResourceStatsOverlay.module.scss";

// Bildet jeden Registry-"type" auf seinen bestehenden i18n-Titel-Schlüssel
// ab -- so entsteht keine zweite Quelle für Modulnamen, die aus dem Ruder
// laufen könnte, sobald mal ein Modul umbenannt wird.
const TYPE_LABEL_KEYS: Record<string, string> = {
  osc: "modules.vco.title",
  mixer: "modules.mixer.title",
  vcf: "modules.vcf.title",
  envelope: "modules.envelope.title",
  ringmod: "modules.ringmod.title",
  lfo: "modules.lfo.title",
  wasp: "modules.wasp.title",
  noise: "modules.noise.title",
  vca: "modules.vca.title",
  sequencer: "modules.sequencer.title",
  sampler: "modules.sampler.title",
  vocoderAnalysis: "modules.vocoderAnalysis.title",
  vocoderSynth: "modules.vocoderSynth.title",
  out: "modules.output.title",
};

const POLL_INTERVAL_MS = 1000;

export default function ResourceStatsOverlay() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<ResourceStats | null>(null);

  // Live-Polling statt Event-Kopplung an jede einzelne Node-Änderung --
  // die Registry in audio/registry.ts ist reiner Modul-Scope-State, kein
  // React-State, löst also von sich aus keine Re-Renders aus. Ein
  // Sekunden-Intervall reicht für ein Debug-/Info-Panel völlig aus.
  useEffect(() => {
    if (!open) return;
    setStats(getResourceStats());
    const interval = setInterval(() => setStats(getResourceStats()), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open]);

  const rows = stats
    ? Object.entries(stats.byType).sort(([, a], [, b]) => b.toneObjects - a.toneObjects)
    : [];

  return (
    <div className={styles.corner}>
      {open && stats && (
        <div className={styles.panel}>
          <header className={styles.head}>
            <span className={styles.title}>{t("components.resourceStats.title")}</span>
          </header>

          {rows.length === 0 ? (
            <p className={styles.empty}>{t("components.resourceStats.empty")}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("components.resourceStats.module")}</th>
                  <th>{t("components.resourceStats.instances")}</th>
                  <th>{t("components.resourceStats.nodes")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([type, v]) => (
                  <tr key={type}>
                    <td>{t(TYPE_LABEL_KEYS[type] ?? type)}</td>
                    <td>{v.instances}</td>
                    <td>{v.toneObjects}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t("components.resourceStats.total")}</td>
                  <td>{stats.totalInstances}</td>
                  <td>{stats.totalToneObjects}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      <button
        className={styles.toggleBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("components.resourceStats.toggle")}
        aria-expanded={open}
      >
        📊
      </button>
    </div>
  );
}
