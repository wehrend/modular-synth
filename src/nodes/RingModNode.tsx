// RingModNode.tsx
// Ringmodulator: multipliziert zwei Audiosignale (Träger × Modulator)
// statt sie zu addieren wie ein Mixer. Erzeugt metallische, unharmonische
// Klänge -- klassischer Sci-Fi-/Roboterstimmen-Sound.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { RingModFlowNode } from "../types";
import styles from "./Module.module.scss";

export default function RingModNode({}: NodeProps<RingModFlowNode>) {
  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>RING-MOD</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="carrier" />
        <span className={styles.ioLabel}>Träger</span>
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="modulator" />
        <span className={styles.ioLabel}>Mod</span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
