// RingModNode.tsx
// Ringmodulator: multipliziert zwei Audiosignale (Träger × Modulator)
// statt sie zu addieren wie ein Mixer. Erzeugt metallische, unharmonische
// Klänge -- klassischer Sci-Fi-/Roboterstimmen-Sound.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { RingModFlowNode } from "../types";
import styles from "./Module.module.scss";
import * as Tone from "tone";

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

type RingModEntry = {
  type: "ringmod";
  multiply: Tone.Multiply;
  ins: { carrier: Tone.Gain; modulator: Tone.Gain };
  out: Tone.ToneAudioNode;
};

export function createRingModNode(_id: string): RingModEntry {
  const multiply = new Tone.Multiply();

  const carrierIn = new Tone.Gain(1);
  carrierIn.connect(multiply); // normaler Audioeingang, Index 0

  const modulatorIn = new Tone.Gain(1);
  modulatorIn.connect(multiply.factor); // auf den Faktor-Parameter, nicht auf Input-Index 1

  return {
    type: "ringmod",
    multiply,
    ins: { carrier: carrierIn, modulator: modulatorIn },
    out: multiply,
  };
}
export function updateRingModNode(
  _node: RingModEntry,
  _p: Partial<RingModFlowNode["data"]>,
) {
  // pass;
}

export function disposeRingModNode(node: RingModEntry) {
  node.multiply.dispose();
  node.ins.carrier.dispose();
  node.ins.modulator.dispose();
}
