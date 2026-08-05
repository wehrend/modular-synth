// OutputNode.tsx
// Senke: Tone.Volume → Lautsprecher (Destination).

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../Knob";
import styles from "./Module.module.scss";
import { OutEntry, updateAudioNode } from "../audio";
import type { OutData, OutFlowNode } from "../types";
import * as Tone from "tone";

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
        <span className={styles.lockedHint} title="Kann nicht gelöscht werden">
          🔒
        </span>
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

const RAMP = 0.04; // Sekunden — knackfreie Parameterwechsel

export function createOutputNode(_id: string, data: OutData): OutEntry {
  const vol = new Tone.Volume(data.volume).toDestination();
  vol.mute = data.muted;

  const merge = new Tone.Merge();
  merge.connect(vol);

  const inL = new Tone.Gain(1);
  const inR = new Tone.Gain(1);
  inL.connect(merge, 0, 0); // Kanal 0 = links
  inR.connect(merge, 0, 1); // Kanal 1 = rechts

  return { type: "out", vol, merge, ins: { inL, inR } };
}

export function updateOutputNode(entry: OutEntry, patch: Partial<OutData>) {
  const p = patch as Partial<OutData>;
  if (p.volume !== undefined) {
    entry.vol.volume.rampTo(p.volume, RAMP);
  }
  if (p.muted !== undefined) {
    entry.vol.mute = p.muted;
  }
}

export function disposeOutputNode(node: OutEntry) {
  node.vol.dispose();
  node.merge.dispose();
  node.ins.inL.dispose();
  node.ins.inR.dispose();
}
