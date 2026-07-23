// OutputNode.tsx
// Senke: Tone.Volume → Lautsprecher (Destination).

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../Knob";
import styles from "./Module.module.scss";
import { updateAudioNode } from "../audio";
import type { OutData, OutFlowNode } from "../types";

export default function OutputNode({ id, data }: NodeProps<OutFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<OutData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>OUT</span>
        <button
          className={`${styles.power} ${data.muted ? "" : styles.powerOn}`}
          onClick={() => patch({ muted: !data.muted })}
        >
          {data.muted ? "stumm" : "laut"}
        </button>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="inL" />
        <span className={styles.ioLabel}>L</span>
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="inR" />
        <span className={styles.ioLabel}>R</span>
      </div>

      <Knob
        label="Pegel"
        value={data.volume}
        min={-48}
        max={0}
        step={1}
        format={(v) => `${v} dB`}
        onChange={(volume) => patch({ volume })}
      />
    </div>
  );
}
