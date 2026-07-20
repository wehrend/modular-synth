// OscillatorNode.tsx
// Quelle: ein Tone.Oscillator mit Frequenz, Wellenform und An/Aus.

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../Knob";
import styles from "./Module.module.scss";
import { updateAudioNode } from "../audio";
import {
  LfoData,
  LfoFlowNode,
  WAVEFORMS,
  type Waveform,
} from "../types";

const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: "Sin",
  triangle: "Tri",
  sawtooth: "Saw",
  square: "Sqr",
};

export default function LfoNode({ id, data }: NodeProps<LfoFlowNode>) {
  const { updateNodeData } = useReactFlow();

  // UI-State und Audiograph immer gemeinsam aktualisieren
  const patch = (changes: Partial<LfoData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={`${styles.module} ${styles.isRunning}`}>
      <header className={styles.head}>
        <span className={styles.title}>LFO</span>
      </header>

      <Knob
        label="Frequenz"
        value={data.rate}
        min={0.2}
        max={40}
        step={1}
        log
        format={(v) => `${v} Hz`}
        onChange={(rate) => patch({ rate })}
      />

      <div className={`${styles.row} ${styles.rowGap}`}>
        {WAVEFORMS.map((w) => (
          <button
            key={w}
            className={`${styles.chip} ${data.waveform === w ? styles.chipActive : ""}`}
            onClick={() => patch({ waveform: w })}
          >
            {WAVEFORM_LABELS[w]}
          </button>
        ))}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
