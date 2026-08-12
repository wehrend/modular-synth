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

/* ---------- Audio-Seite ---------- */

export function createSamplerNode(
  _id: string,
  data: SamplerData,
): SamplerEntry {
  const mic = new Tone.UserMedia();
  const recorder = new Tone.Recorder();
  mic.connect(recorder); // NUR zum Aufnehmen -- bewusst NICHT an out/Destination,
  // damit kein Live-Monitoring-Feedback entstehen kann

  const player = new Tone.Player();
  player.playbackRate = data.playbackRate;

  return { type: "sampler", mic, recorder, player, out: player };
}

export function updateSamplerNode(
  entry: SamplerEntry,
  patch: Partial<SamplerData>,
): void {
  if (patch.playbackRate !== undefined) {
    entry.player.playbackRate = patch.playbackRate;
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
}

/* ---------- UI-Seite ---------- */

export default function SamplerNode({ id, data }: NodeProps<SamplerFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<SamplerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const handleRecordToggle = async () => {
    if (data.recording) {
      patch({ recording: false });
      await stopSamplerRecording(id);
      updateNodeData(id, { hasSample: true }); // erst nach erfolgreichem Laden bekannt
    } else {
      patch({ recording: true });
      await startSamplerRecording(id);
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
