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
  renameSamplerRecording,
} from "../persist/supabase";
import {
  prepareAudioFileForUpload,
  AudioFileImportError,
} from "../audio/fileImport";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Info from "../components/Info";
import { Pencil, Upload } from "lucide-react";

const SLOT_COUNT = 10;

function emptySlot(): SamplerSlot {
  return { hasSample: false, sampleUrl: null };
}

function filenameFromUrl(url: string): string {
  const withoutQuery = url.split("?")[0];
  return withoutQuery.substring(withoutQuery.lastIndexOf("/") + 1);
}

function slotLabel(url: string): string {
  const filename = filenameFromUrl(url);
  const match = filename.match(/(\d{12,})\.[a-zA-Z0-9]+$/);
  const dateStr = match
    ? new Date(Number(match[1])).toLocaleString()
    : filename;

  // Eigenes Label mit anzeigen, falls vorhanden -- sonst wäre eine
  // erfolgreiche Umbenennung in der Liste NIE sichtbar, da hier bisher
  // ausschließlich das aus dem Dateinamen geparste Datum gezeigt wurde,
  // nie das Label selbst.
  const label = currentFileLabel(url);
  if (label && label !== "autosave") {
    return `${label} (${dateStr})`;
  }
  return dateStr;
}

/**
 * Extrahiert das aktuelle Label aus dem Namensschema
 * "sampler-<n>-<label>-<ts>.<ext>" (Label ist z.B. "autosave" bei einer
 * frischen Aufnahme, oder ein bereits vergebenes eigenes Label). Für das
 * Vorbefüllen des Umbenennen-Eingabefelds -- null, falls das Schema nicht
 * passt (z.B. älteres Namensformat ohne diesen mittleren Teil).
 */
function currentFileLabel(url: string): string | null {
  const filename = filenameFromUrl(url);
  const match = filename.match(/^sampler-\d+-(.+)-\d{12,}\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

function normalizeSamplerData(
  raw: Partial<SamplerData> & {
    hasSample?: boolean;
    sampleUrl?: string | null;
  },
): SamplerData {
  const slots: SamplerSlot[] =
    Array.isArray(raw.slots) && raw.slots.length === SLOT_COUNT
      ? raw.slots.map((s) => ({ ...s }))
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

async function loadIfPresent(
  player: Tone.Player,
  url: string | null,
): Promise<void> {
  if (!url) return;
  try {
    await player.load(url);
  } catch (err) {
    console.error(i18n.t("modules.sampler.log.loadFailed"), err);
  }
}

export function createSamplerNode(
  _id: string,
  rawData: SamplerData,
): SamplerEntry {
  const data = normalizeSamplerData(rawData);
  const mic = new Tone.UserMedia();
  const lineIn = new Tone.Gain(1);

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
  player.fadeIn = 0.005;
  player.fadeOut = 0.02;

  const pendingLoad: Promise<void> = loadIfPresent(
    player,
    activeSlot.sampleUrl,
  );

  const gainNode = new Tone.Gain(data.gain);
  player.connect(gainNode);

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

  if (patch.playbackRate !== undefined) {
    entry.player.playbackRate = patch.playbackRate;
  }
  if (patch.gain !== undefined) {
    entry.gainNode.gain.rampTo(patch.gain, 0.04);
  }

  if (patch.selectedSlot !== undefined) {
    const activeSlot = entry.currentData.slots[entry.currentData.selectedSlot];
    entry.pendingLoad = loadIfPresent(entry.player, activeSlot.sampleUrl);
    return;
  }
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

  const [sampleReady, setSampleReady] = useState(() => isSamplerReady(id));

  useEffect(() => {
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
    const currentNode = getNodes().find((n) => n.id === id) as
      | SamplerFlowNode
      | undefined;
    const currentData = currentNode?.data ?? data;

    const nextSlots = currentData.slots.map((slot, i) =>
      i === currentData.selectedSlot ? { ...slot, ...changes } : slot,
    );
    patch({ slots: nextSlots });
  };

  const [_storageLoading, setStorageLoading] = useState(false);

  const autoAssignFromStorage = async () => {
    if (!user) {
      console.warn(t("modules.sampler.log.notLoggedIn"));
      return;
    }
    setStorageLoading(true);
    try {
      const instanceNumber = computeInstanceNumber(getNodes(), id);
      const ownPrefix = new RegExp(`^sampler-${instanceNumber}-`);
      const allFiles = await listSamplerRecordings(user.id);
      const ownFiles = allFiles.filter((f) => ownPrefix.test(f.name));

      if (ownFiles.length === 0) {
        console.warn(t("modules.sampler.storageEmpty"));
        return;
      }

      ownFiles.sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      );

      const previousSlotUrl = data.slots[data.selectedSlot]?.sampleUrl;

      let fileIndex = 0;
      const nextSlots = data.slots.map((slot) => {
        if (slot.hasSample) return slot;
        if (fileIndex >= ownFiles.length) return slot;
        const file = ownFiles[fileIndex];
        fileIndex += 1;
        return { hasSample: true, sampleUrl: file.url };
      });
      patch({ slots: nextSlots });

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    autoAssignFromStorage();
  }, []);

  // Umbenennen: ersetzt "-autosave-" (oder ein bereits vergebenes Label)
  // im Dateinamen durch einen frei gewählten String. null = Editier-Feld
  // geschlossen, sonst der aktuelle Eingabe-Wert.
  const [renameInput, setRenameInput] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const startRename = () => {
    if (!activeSlot.sampleUrl) return;
    setRenameInput(currentFileLabel(activeSlot.sampleUrl) ?? "");
  };

  const confirmRename = async () => {
    if (!user || !activeSlot.sampleUrl || !renameInput) {
      setRenameInput(null);
      return;
    }
    setRenaming(true);
    try {
      const newUrl = await renameSamplerRecording(
        user.id,
        activeSlot.sampleUrl,
        renameInput,
      );
      updateActiveSlot({ sampleUrl: newUrl });
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : t("modules.sampler.log.renameFailed"),
      );
    } finally {
      setRenaming(false);
      setRenameInput(null);
    }
  };

  // Datei-Upload: Alternative zur Mikro-/Line-Aufnahme -- lädt eine vom
  // User ausgewählte Audiodatei (wav/mp3/ogg/webm, max. 10 MB) in den
  // aktuell gewählten Slot. WAV wird dabei vorher zu Opus/WebM komprimiert
  // (siehe fileImport.ts), die anderen Formate unverändert übernommen.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Zurücksetzen, damit dieselbe Datei danach erneut ausgewählt werden
    // kann -- sonst feuert onChange beim zweiten Mal mit derselben Datei
    // nicht, da sich der input-Wert nicht geändert hat.
    e.target.value = "";
    if (!file) return;

    if (!user) {
      window.alert(t("modules.sampler.log.notLoggedIn"));
      return;
    }

    setUploading(true);
    try {
      const { blob, extension, contentType } =
        await prepareAudioFileForUpload(file);
      const instanceNumber = computeInstanceNumber(getNodes(), id);
      // Original-Dateiname (ohne Endung) als mittleres Namenssegment --
      // die Bereinigung/Fallback-Logik übernimmt uploadSamplerRecording
      // selbst (sanitizeStorageLabel), damit hier keine zweite,
      // potenziell abweichende Sanitize-Implementierung entsteht.
      const label = file.name.replace(/\.[a-zA-Z0-9]+$/, "");
      const url = await uploadSamplerRecording(
        user.id,
        instanceNumber,
        blob,
        extension,
        contentType,
        label,
      );
      updateActiveSlot({ hasSample: true, sampleUrl: url });
      setSampleReady(false);
      await loadSamplerUrl(id, url);
      setSampleReady(true);
    } catch (err) {
      if (err instanceof AudioFileImportError) {
        window.alert(
          err.reason === "fileTooLarge"
            ? t("modules.sampler.errors.fileTooLarge")
            : t("modules.sampler.errors.unsupportedFormat"),
        );
      } else {
        window.alert(
          err instanceof Error
            ? err.message
            : t("modules.sampler.log.uploadFailed"),
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRecordToggle = async () => {
    await resumeAudio();

    if (data.recording) {
      patch({ recording: false });
      const blob = await stopSamplerRecording(id);

      if (!blob) {
        console.warn(t("modules.sampler.log.noBlobToUpload"));
        return;
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
        <button
          className={`nodrag ${styles.power}`}
          onClick={startRename}
          disabled={!activeSlot.sampleUrl}
          aria-label={t("modules.sampler.renameLabel")}
        >
          <Pencil size={12} />
        </button>
        <button
          className={`nodrag ${styles.power}`}
          onClick={handleFileButtonClick}
          disabled={uploading}
          aria-label={t("modules.sampler.uploadLabel")}
          title={t("modules.sampler.uploadLabel")}
        >
          <Upload size={12} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.ogg,.webm,audio/wav,audio/x-wav,audio/mpeg,audio/ogg,audio/webm"
          onChange={handleFileSelected}
          style={{ display: "none" }}
        />
      </div>

      {renameInput !== null && (
        <div className={styles.rowCenter}>
          <input
            className={`nodrag ${styles.slotSelect}`}
            type="text"
            value={renameInput}
            placeholder={t("modules.sampler.renamePlaceholder")}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") setRenameInput(null);
            }}
            autoFocus
          />
          <button
            className={`nodrag ${styles.power}`}
            onClick={confirmRename}
            disabled={renaming || !renameInput.trim()}
          >
            {renaming ? "…" : "✓"}
          </button>
        </div>
      )}

      <span className={styles.hint}>
        {uploading
          ? t("modules.sampler.uploadCompressing")
          : activeSlot.hasSample && !sampleReady
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
