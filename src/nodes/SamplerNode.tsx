import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import Switch from "../components/Switch";
import {
  updateAudioNode,
  startSamplerRecording,
  stopSamplerRecording,
  triggerSamplerPlayback,
  waitForSamplerReady,
  isSamplerReady,
  loadSamplerUrl,
  resumeAudio,
  SamplerEntry,
} from "../audio";
import type { SamplerData, SamplerFlowNode, SamplerSlot } from "../types";
import styles from "./Module.module.scss";
import {
  uploadSamplerRecording,
  listSamplerRecordings,
} from "../persist/supabase";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useEffect, useState } from "react";
import Info from "../components/Info";

const SLOT_COUNT = 10;

function emptySlot(): SamplerSlot {
  return { hasSample: false, sampleUrl: null };
}

/**
 * Extrahiert den reinen Dateinamen aus einer Supabase-Storage-URL (letztes
 * Pfadsegment, Query-String wie "?t=..." abgeschnitten).
 */
function filenameFromUrl(url: string): string {
  const withoutQuery = url.split("?")[0];
  return withoutQuery.substring(withoutQuery.lastIndexOf("/") + 1);
}

/**
 * Liest einen Unix-Timestamp aus dem Dateinamen heraus und zeigt ihn als
 * lesbares Datum + Uhrzeit -- aussagekräftiger als ein generisches "Slot 3"
 * oder der rohe Dateiname. Bewusst nicht auf das aktuelle Namensschema
 * "sampler-<n>-autosave-<ts>.<ext>" festgelegt, sondern erkennt JEDEN
 * ausreichend langen Zahlenblock direkt vorm Dateisuffix (z.B. auch das
 * ältere Schema "sampler-<n>-<ts>.<ext>" ohne "-autosave-") -- Unix-
 * Timestamps in Millisekunden sind immer 12+ Stellen lang, das genügt zur
 * eindeutigen Erkennung. Fällt auf den rohen Dateinamen zurück, falls gar
 * kein solcher Zahlenblock gefunden wird.
 */
function slotLabel(url: string): string {
  const filename = filenameFromUrl(url);
  const match = filename.match(/(\d{12,})\.[a-zA-Z0-9]+$/);
  if (!match) return filename;
  return new Date(Number(match[1])).toLocaleString();
}

/**
 * Liefert garantiert eine vollständige, UNABHÄNGIGE Slot-Struktur zurück --
 * nie eine Referenz auf ein evtl. geteiltes Array (z.B. aus MODULE_DEFAULTS
 * in serialize.ts, das nur einmalig beim Modul-Load erzeugt wird und
 * potenziell von mehreren Sampler-Nodes gleichzeitig als Fallback
 * referenziert werden könnte -- ohne diese Kopie würden sich zwei Sampler
 * ohne eigene Slots-Daten sonst dasselbe Array teilen und sich gegenseitig
 * überschreiben). playbackRate/gain sind globale Top-Level-Felder (gelten
 * für alle 10 Slots dieser einen Sampler-Instanz gemeinsam).
 *
 * Migriert außerdem das alte, flache Format (vor der Slot-Einführung, nur
 * ein einzelnes sampleUrl-Feld statt slots[]) -- eine bereits bestehende
 * Aufnahme landet in Slot 1, statt beim nächsten Laden unsichtbar zu
 * werden (die Datei selbst bleibt ja in Supabase liegen, nur die
 * Verknüpfung im Preset würde sonst verloren gehen).
 */
function normalizeSamplerData(
  raw: Partial<SamplerData> & {
    hasSample?: boolean;
    sampleUrl?: string | null;
  },
): SamplerData {
  const slots: SamplerSlot[] =
    Array.isArray(raw.slots) && raw.slots.length === SLOT_COUNT
      ? raw.slots.map((s) => ({ ...s })) // Kopie jedes einzelnen Slot-Objekts
      : Array.from({ length: SLOT_COUNT }, emptySlot);

  if (!slots[0].hasSample && raw.sampleUrl) {
    slots[0] = { hasSample: !!raw.hasSample, sampleUrl: raw.sampleUrl };
  }

  return {
    recording: false,
    recordSource: raw.recordSource ?? "mic",
    playbackRate: raw.playbackRate ?? 1,
    gain: raw.gain ?? 1,
    selectedSlot: raw.selectedSlot ?? 0,
    slots,
  };
}

/* ---------- Audio-Seite ---------- */

async function loadIfPresent(
  player: Tone.Player,
  url: string | null,
): Promise<void> {
  if (!url) return;
  try {
    await player.load(url);
  } catch (err) {
    // Läuft außerhalb eines React-Komponenten-/Hook-Kontexts (wird direkt
    // beim Anlegen des Audio-Nodes aufgerufen) -- deshalb hier die
    // i18n-Instanz direkt statt useTranslation().
    console.error(i18n.t("modules.sampler.log.loadFailed"), err);
  }
}

export function createSamplerNode(
  _id: string,
  rawData: SamplerData,
): SamplerEntry {
  const data = normalizeSamplerData(rawData);
  const mic = new Tone.UserMedia();
  const lineIn = new Tone.Gain(1); // gepatchter Audio-Eingang

  // Statt hart zwischen zwei Quellen umzustecken: beide sind IMMER mit dem
  // Recorder verbunden, aber jeweils über einen eigenen "Enable"-Gain, der
  // je nach recordSource auf 1 oder 0 steht. Weniger fehleranfällig als
  // Web-Audio-Verbindungen zur Laufzeit zu trennen/neu herzustellen, und
  // erlaubt einen klickfreien Übergang per rampTo() beim Umschalten.
  const micEnable = new Tone.Gain(data.recordSource === "line" ? 0 : 1);
  const lineEnable = new Tone.Gain(data.recordSource === "line" ? 1 : 0);
  const recorder = new Tone.Recorder();
  mic.connect(micEnable);
  micEnable.connect(recorder);
  lineIn.connect(lineEnable);
  lineEnable.connect(recorder);

  const activeSlot = data.slots[data.selectedSlot];

  const player = new Tone.Player();
  player.playbackRate = data.playbackRate;
  // Kurze Fades gegen Klick-Artefakte beim (Re-)Triggern.
  player.fadeIn = 0.005;
  player.fadeOut = 0.02;

  const pendingLoad: Promise<void> = loadIfPresent(
    player,
    activeSlot.sampleUrl,
  );

  const gainNode = new Tone.Gain(data.gain);
  player.connect(gainNode); // Verstärkung sitzt NACH dem Player, vor dem Ausgang

  return {
    type: "sampler",
    mic,
    in: lineIn,
    micEnable,
    lineEnable,
    recorder,
    player,
    gainNode,
    out: gainNode,
    pendingLoad,
    currentData: data,
  };
}

export function updateSamplerNode(
  entry: SamplerEntry,
  patch: Partial<SamplerData>,
): void {
  entry.currentData = { ...entry.currentData, ...patch };

  if (patch.recordSource !== undefined) {
    const micOn = patch.recordSource === "mic" ? 1 : 0;
    const lineOn = patch.recordSource === "line" ? 1 : 0;
    entry.micEnable.gain.rampTo(micOn, 0.01);
    entry.lineEnable.gain.rampTo(lineOn, 0.01);
  }

  // Rate/Gain gelten global für die ganze Sampler-Instanz (alle 10 Slots),
  // unabhängig davon, welcher Slot gerade aktiv ist.
  if (patch.playbackRate !== undefined) {
    entry.player.playbackRate = patch.playbackRate;
  }
  if (patch.gain !== undefined) {
    entry.gainNode.gain.rampTo(patch.gain, 0.04);
  }

  // Echter Slot-Wechsel (Liste geändert) -- nur der Buffer wechselt,
  // Rate/Gain bleiben unverändert (gelten ja global, s.o.).
  if (patch.selectedSlot !== undefined) {
    const activeSlot = entry.currentData.slots[entry.currentData.selectedSlot];
    entry.pendingLoad = loadIfPresent(entry.player, activeSlot.sampleUrl);
    return;
  }

  // "recording"/"slots" (frische Aufnahme im aktiven Slot) werden hier
  // bewusst NICHT automatisch neu geladen: startSamplerRecording/
  // stopSamplerRecording haben den Player bereits selbst mit dem lokalen
  // Blob beladen; ein zweites, hier ausgelöstes Laden der (identischen)
  // Supabase-URL wäre reine Verschwendung von Bandbreite und ein
  // unnötiger Buffer-Tausch.
}

export function disposeSamplerNode(entry: SamplerEntry): void {
  entry.mic.close();
  entry.mic.dispose();
  entry.in.dispose();
  entry.micEnable.dispose();
  entry.lineEnable.dispose();
  entry.recorder.dispose();
  entry.player.dispose();
  entry.gainNode.dispose();
}

/* ---------- UI-Seite ---------- */

/**
 * Fortlaufende Nummer unter allen AKTUELL im Patch vorhandenen Sampler-
 * Modulen -- stabil sortiert nach Node-ID, damit dieselbe Nummer nicht bei
 * jedem Render neu durcheinanderwürfelt. Als eigenständige Funktion statt
 * inline dupliziert, da sowohl beim Aufnehmen als auch beim automatischen
 * Zuweisen aus dem Storage gebraucht.
 */
function computeInstanceNumber(
  nodes: { id: string; type?: string }[],
  id: string,
): number {
  const samplerNodes = nodes
    .filter((n) => n.type === "sampler")
    .sort((a, b) => a.id.localeCompare(b.id));
  return samplerNodes.findIndex((n) => n.id === id) + 1 || 1;
}

export default function SamplerNode({ id, data }: NodeProps<SamplerFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData, getNodes } = useReactFlow();
  const { user } = useAuth();

  // Getrennt von activeSlot.hasSample: sampleReady sagt, ob der Tone.Player
  // den (evtl. von Supabase geladenen) Buffer JETZT wirklich im Speicher
  // hat. Play erst freigeben, wenn beides stimmt, sonst klickt man bei
  // frisch geladenen Presets oder direkt nach einem Slot-Wechsel ins Leere.
  const [sampleReady, setSampleReady] = useState(() => isSamplerReady(id));

  useEffect(() => {
    // WICHTIG: player.loaded (isSamplerReady) prüft nur "hat der Player
    // IRGENDEINEN Buffer geladen" -- beim Wechsel von einem befüllten Slot
    // zu einem anderen bleibt der ALTE Buffer bestehen, bis der neue fertig
    // dekodiert ist (Tone.js tauscht ihn erst ganz am Ende der Ladekette
    // aus). isSamplerReady() würde deshalb während des Wechsels fälschlich
    // weiter "true" melden -- kein verlässliches Signal fürs SLOT-WECHSEL-
    // Szenario. Deshalb hier bewusst KEINE synchrone Vorab-Prüfung mehr,
    // sondern immer pessimistisch auf false setzen und nur über das
    // pendingLoad-Promise (löst zuverlässig erst nach dem echten
    // Buffer-Austausch auf) wieder auf true gehen.
    let cancelled = false;
    setSampleReady(false);
    waitForSamplerReady(id).then(() => {
      if (!cancelled) setSampleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, data.selectedSlot]);

  const patch = (changes: Partial<SamplerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const activeSlot = data.slots[data.selectedSlot];

  const updateActiveSlot = (changes: Partial<SamplerSlot>) => {
    // getNodes() statt data.slots: handleRecordToggle ist eine lang
    // laufende async-Funktion (wartet auf den Upload). Zwischen zwei
    // updateActiveSlot-Aufrufen (hasSample sofort, sampleUrl erst nach dem
    // Upload) bleibt das `data` aus den Props im Closure eingefroren --
    // obwohl React Flow den Node-State zwischenzeitlich schon geändert hat.
    // Ohne diesen Fix würde der zweite Aufruf auf Basis des VERALTETEN
    // Zustands rechnen und die Änderung des ersten Aufrufs unbemerkt wieder
    // verwerfen (genau das hat "sampleUrl gesetzt, hasSample trotzdem
    // false" verursacht).
    const currentNode = getNodes().find((n) => n.id === id) as
      | SamplerFlowNode
      | undefined;
    const currentData = currentNode?.data ?? data;

    const nextSlots = currentData.slots.map((slot, i) =>
      i === currentData.selectedSlot ? { ...slot, ...changes } : slot,
    );
    patch({ slots: nextSlots });
  };

  // "Aus Storage laden" -- Dateien, die zwar physisch in Supabase liegen,
  // aber in keinem aktuell gespeicherten Preset mehr referenziert sind
  // (z.B. weil das Preset nach der Aufnahme nie gespeichert wurde), sind
  // der App sonst komplett unbekannt. Weist die zu DIESER Sampler-Instanz
  // gehörenden Dateien chronologisch den LEEREN Slots zu (älteste zuerst)
  // -- bereits befüllte Slots (z.B. aus einem geladenen Preset) bleiben
  // dabei unangetastet, es werden nur Lücken aufgefüllt.
  const [storageLoading, setStorageLoading] = useState(false);

  const autoAssignFromStorage = async () => {
    if (!user) {
      console.warn(t("modules.sampler.log.notLoggedIn"));
      return;
    }
    setStorageLoading(true);
    try {
      const instanceNumber = computeInstanceNumber(getNodes(), id);
      // Nur Dateien DIESER Instanz -- der Storage-Ordner ist flach (kein
      // Node-ID-Unterordner mehr), mehrere Sampler-Module teilen sich also
      // denselben Ordner. Erkennt beide Namensschemata: die aktuelle
      // "sampler-<n>-autosave-<ts>.<ext>" und die ältere Variante ohne
      // "-autosave-".
      const ownPrefix = new RegExp(`^sampler-${instanceNumber}-`);
      const allFiles = await listSamplerRecordings(user.id);
      const ownFiles = allFiles.filter((f) => ownPrefix.test(f.name));

      if (ownFiles.length === 0) {
        console.warn(t("modules.sampler.storageEmpty"));
        return;
      }

      // Chronologisch aufsteigend (älteste zuerst) -- listSamplerRecordings
      // liefert absteigend (neueste zuerst), hier also umgekehrt sortieren.
      ownFiles.sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      );

      const previousSlotUrl = data.slots[data.selectedSlot]?.sampleUrl;

      // Bereits befüllte Slots bleiben unangetastet -- nur LEERE Slots
      // werden der Reihe nach mit den nächsten chronologischen Dateien
      // aufgefüllt (nicht mehr strikt Datei[i] -> Slot[i], sondern
      // "nächste freie Datei in nächsten freien Slot").
      let fileIndex = 0;
      const nextSlots = data.slots.map((slot) => {
        if (slot.hasSample) return slot;
        if (fileIndex >= ownFiles.length) return slot;
        const file = ownFiles[fileIndex];
        fileIndex += 1;
        return { hasSample: true, sampleUrl: file.url };
      });
      patch({ slots: nextSlots });

      // Hat sich die URL des GERADE ausgewählten Slots durch die
      // Zuweisung geändert, denselben Bereit-Zustand-Zyklus wie beim
      // normalen Slot-Wechsel durchlaufen -- sonst trifft ein sofortiger
      // Play-Klick auf den alten, jetzt falschen Buffer.
      const newSelectedUrl = nextSlots[data.selectedSlot]?.sampleUrl;
      if (newSelectedUrl && newSelectedUrl !== previousSlotUrl) {
        setSampleReady(false);
        await loadSamplerUrl(id, newSelectedUrl);
        setSampleReady(true);
      }
    } catch (err) {
      console.error(t("modules.sampler.log.storageListFailed"), err);
    } finally {
      setStorageLoading(false);
    }
  };

  // Beim Laden des Moduls automatisch dasselbe tun wie ein Klick auf den
  // "Aus Storage"-Button -- deckt den Fall ab, dass in Supabase Storage
  // Aufnahmen dieser Instanz liegen, die im geladenen Preset (noch) nicht
  // referenziert sind. Bewusst nur beim MOUNT (leeres Deps-Array), nicht
  // bei jeder Render -- autoAssignFromStorage wird bei jedem Render neu
  // erzeugt, als Dependency einzutragen würde die Schleife bei jedem
  // Zustands-Update erneut auslösen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    autoAssignFromStorage();
  }, []);

  const handleRecordToggle = async () => {
    await resumeAudio(); // s. Kommentar beim Play-Button weiter unten

    if (data.recording) {
      patch({ recording: false });
      const blob = await stopSamplerRecording(id);

      if (!blob) {
        console.warn(t("modules.sampler.log.noBlobToUpload"));
        return; // hasSample NICHT faelschlich auf true setzen
      }
      updateActiveSlot({ hasSample: true });

      if (user) {
        try {
          const instanceNumber = computeInstanceNumber(getNodes(), id);

          const url = await uploadSamplerRecording(
            user.id,
            instanceNumber,
            blob,
          );
          updateActiveSlot({ sampleUrl: url });
        } catch (err) {
          console.error(t("modules.sampler.log.saveFailed"), err);
        }
      } else {
        console.warn(t("modules.sampler.log.notLoggedIn"));
      }
    } else {
      patch({ recording: true });
      try {
        await startSamplerRecording(id);
      } catch (err) {
        console.error(t("modules.sampler.log.startFailed"), err);
        // Zustand zurücksetzen -- sonst denkt die UI weiter, es wird
        // aufgenommen, während der Recorder in Wirklichkeit nie lief.
        patch({ recording: false });
      }
    }
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.sampler.title")}</span>
        <button
          className={`nodrag ${styles.power} ${data.recording ? styles.powerOn : ""}`}
          onClick={handleRecordToggle}
        >
          {data.recording
            ? t("modules.sampler.recActive")
            : t("modules.sampler.rec")}
        </button>
        <Info>{t("modules.sampler.hint")}</Info>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="in" />
        <span className={styles.ioLabel}>
          {t("modules.sampler.lineInLabel")}
        </span>
      </div>

      <div className={styles.rowCenter}>
        <span className={styles.ioLabel}>{t("modules.sampler.micLabel")}</span>
        <Switch
          checked={data.recordSource === "line"}
          onChange={(checked) =>
            patch({ recordSource: checked ? "line" : "mic" })
          }
          label={t("modules.sampler.sourceSwitchLabel")}
        />
        <span className={styles.ioLabel}>{t("modules.sampler.lineLabel")}</span>
      </div>

      <div className={styles.rowCenter}>
        <select
          className={`nodrag ${styles.slotSelect}`}
          value={data.selectedSlot}
          onChange={(e) => patch({ selectedSlot: Number(e.target.value) })}
          aria-label={t("modules.sampler.slotSelectLabel")}
        >
          {data.slots.map((slot, i) => (
            <option key={i} value={i}>
              {slot.sampleUrl
                ? slotLabel(slot.sampleUrl)
                : t("modules.sampler.slotEmpty", { n: i + 1 })}
            </option>
          ))}
        </select>
      </div>

      <span className={styles.hint}>
        {activeSlot.hasSample && !sampleReady
          ? t("modules.sampler.hintLoading")
          : activeSlot.hasSample
            ? t("modules.sampler.hintReady")
            : t("modules.sampler.hintEmpty")}
      </span>
      <Knob
        label={t("common.rateLabel")}
        value={data.playbackRate}
        min={0.25}
        max={4}
        step={0.05}
        log
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(playbackRate) => patch({ playbackRate })}
      />
      <Knob
        label={t("common.gainLabel")}
        value={data.gain}
        min={0}
        max={2.5}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(gain) => patch({ gain })}
      />

      <button
        className={`nodrag ${styles.power}`}
        onClick={async () => {
          // AudioContext explizit aufwecken -- pointerdown auf Buttons
          // innerhalb eines React-Flow-Node erreicht sonst wegen des
          // Node-Drag-Handlings nie das äußere onPointerDown in App.tsx.
          await resumeAudio();
          triggerSamplerPlayback(id);
        }}
        disabled={!activeSlot.hasSample || !sampleReady}
      >
        {t("modules.sampler.play")}
      </button>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="gate" />
        <span className={styles.ioLabel}>{t("common.gate")}</span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
