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
  resumeAudio,
  SamplerEntry,
} from "../audio";
import type { SamplerData, SamplerFlowNode } from "../types";
import styles from "./Module.module.scss";
import { uploadSamplerRecording } from "../persist/supabase";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useEffect, useState } from "react";
import Info from "../components/Info";

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
  data: SamplerData,
): SamplerEntry {
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

  const player = new Tone.Player();
  player.playbackRate = data.playbackRate;
  // Kurze Fades gegen Klick-Artefakte beim (Re-)Triggern.
  player.fadeIn = 0.005;
  player.fadeOut = 0.02;

  const pendingLoad: Promise<void> = loadIfPresent(player, data.sampleUrl);

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

  if (patch.playbackRate !== undefined) {
    entry.player.playbackRate = patch.playbackRate;
  }
  if (patch.gain !== undefined) {
    entry.gainNode.gain.rampTo(patch.gain, 0.04);
  }
  if (patch.recordSource !== undefined) {
    const micOn = patch.recordSource === "mic" ? 1 : 0;
    const lineOn = patch.recordSource === "line" ? 1 : 0;
    entry.micEnable.gain.rampTo(micOn, 0.01);
    entry.lineEnable.gain.rampTo(lineOn, 0.01);
  }
  // "recording" wird bewusst NICHT hier behandelt -- Start/Stop läuft über
  // die eigenständigen async-Funktionen startSamplerRecording/stopSamplerRecording,
  // weil das Ergebnis (der Buffer) asynchron eintrifft, nicht synchron wie
  // ein normaler Parameter-Patch.
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

export default function SamplerNode({ id, data }: NodeProps<SamplerFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();
  const { user } = useAuth();

  // Getrennt von data.hasSample: hasSample sagt nur, dass laut Patch
  // IRGENDWANN eine Aufnahme existierte -- sampleReady sagt, ob der
  // Tone.Player den (evtl. von Supabase geladenen) Buffer JETZT wirklich
  // im Speicher hat. Play erst freigeben, wenn beides stimmt, sonst
  // klickt man bei frisch geladenen Presets ins Leere (stumm, kein Fehler).
  const [sampleReady, setSampleReady] = useState(() => isSamplerReady(id));

  useEffect(() => {
    if (sampleReady) return;
    let cancelled = false;
    waitForSamplerReady(id).then(() => {
      if (!cancelled) setSampleReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = (changes: Partial<SamplerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const handleRecordToggle = async () => {
    await resumeAudio(); // s. Kommentar beim Play-Button weiter unten

    if (data.recording) {
      patch({ recording: false });
      const blob = await stopSamplerRecording(id);

      if (!blob) {
        console.warn(t("modules.sampler.log.noBlobToUpload"));
        return; // hasSample NICHT faelschlich auf true setzen
      }
      updateNodeData(id, { hasSample: true });

      if (user) {
        try {
          const url = await uploadSamplerRecording(user.id, id, blob);
          patch({ sampleUrl: url });
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

      <span className={styles.hint}>
        {data.hasSample && !sampleReady
          ? t("modules.sampler.hintLoading")
          : data.hasSample
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
        disabled={!data.hasSample || !sampleReady}
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
