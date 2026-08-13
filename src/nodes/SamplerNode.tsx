import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import {
  updateAudioNode,
  startSamplerRecording,
  stopSamplerRecording,
  triggerSamplerPlayback,
  SamplerEntry,
} from "../audio";
import type { SamplerData, SamplerFlowNode } from "../types";
import styles from "./Module.module.scss";
import { uploadSamplerRecording } from "../persist/supabase";
import { useAuth } from "../auth/AuthContext";

/* ---------- Audio-Seite ---------- */

async function loadIfPresent(
  player: Tone.Player,
  url: string | null,
): Promise<void> {
  if (!url) return;
  try {
    await player.load(url);
  } catch (err) {
    console.error("Sample konnte nicht geladen werden:", err);
  }
}

export function createSamplerNode(
  _id: string,
  data: SamplerData,
): SamplerEntry {
  const mic = new Tone.UserMedia();
  const recorder = new Tone.Recorder();
  mic.connect(recorder);

  const player = new Tone.Player();
  player.playbackRate = data.playbackRate;
  // Kurze Fades gegen Klick-Artefakte beim (Re-)Triggern -- ohne das
  // knackt jeder Start/Stop bei abrupter Wellenform (v.a. bei schnellem
  // Retriggern via Gate/Sequencer).
  player.fadeIn = 0.005;
  player.fadeOut = 0.02;

  const pendingLoad: Promise<void> = loadIfPresent(player, data.sampleUrl);

  const gainNode = new Tone.Gain(data.gain);
  player.connect(gainNode); // Verstärkung sitzt NACH dem Player, vor dem Ausgang

  return {
    type: "sampler",
    mic,
    recorder,
    player,
    gainNode,
    out: gainNode,
    pendingLoad,
  };
}

export function updateSamplerNode(
  entry: SamplerEntry,
  patch: Partial<SamplerData>,
): void {
  if (patch.playbackRate !== undefined) {
    entry.player.playbackRate = patch.playbackRate;
  }
  if (patch.gain !== undefined) {
    entry.gainNode.gain.rampTo(patch.gain, 0.04);
  }
  // "recording" wird bewusst NICHT hier behandelt -- Start/Stop läuft über
  // die eigenständigen async-Funktionen startSamplerRecording/stopSamplerRecording,
  // weil das Ergebnis (der Buffer) asynchron eintrifft, nicht synchron wie
  // ein normaler Parameter-Patch.
}

export function disposeSamplerNode(entry: SamplerEntry): void {
  entry.mic.close();
  entry.mic.dispose();
  entry.recorder.dispose();
  entry.player.dispose();
  entry.gainNode.dispose();
}

/* ---------- UI-Seite ---------- */

export default function SamplerNode({ id, data }: NodeProps<SamplerFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const { user } = useAuth();

  const patch = (changes: Partial<SamplerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const handleRecordToggle = async () => {
    if (data.recording) {
      patch({ recording: false });
      const blob = await stopSamplerRecording(id);

      if (!blob) {
        console.warn("Keine Aufnahme zum Hochladen vorhanden.");
        return; // hasSample NICHT faelschlich auf true setzen
      }
      updateNodeData(id, { hasSample: true });

      if (user) {
        try {
          const url = await uploadSamplerRecording(user.id, id, blob);
          patch({ sampleUrl: url });
        } catch (err) {
          console.error("Aufnahme konnte nicht gespeichert werden:", err);
        }
      } else {
        console.warn("Nicht eingeloggt -- Aufnahme wird nicht persistiert.");
      }
    } else {
      patch({ recording: true });
      try {
        await startSamplerRecording(id);
      } catch (err) {
        console.error("Aufnahme konnte nicht gestartet werden:", err);
        // Zustand zurücksetzen -- sonst denkt die UI weiter, es wird
        // aufgenommen, während der Recorder in Wirklichkeit nie lief.
        patch({ recording: false });
      }
    }
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>SAMPLER</span>
        <button
          className={`${styles.power} ${data.recording ? styles.powerOn : ""}`}
          onClick={handleRecordToggle}
        >
          {data.recording ? "● rec" : "rec"}
        </button>
      </header>

      <span className={styles.hint}>
        {data.hasSample ? "Sample bereit" : "Noch keine Aufnahme"}
      </span>
      <Knob
        label="Rate"
        value={data.playbackRate}
        min={0.25}
        max={4}
        step={0.05}
        log
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(playbackRate) => patch({ playbackRate })}
      />
      <Knob
        label="Gain"
        value={data.gain}
        min={0}
        max={2.5}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(gain) => patch({ gain })}
      />

      <button
        className={styles.power}
        onClick={() => triggerSamplerPlayback(id)}
        disabled={!data.hasSample}
      >
        ▶ Play
      </button>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="gate" />
        <span className={styles.ioLabel}>Gate</span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
