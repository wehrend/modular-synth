// MixerNode.tsx
// Drei Eingangskanäle mit eigenem Pegel, dahinter eine Master-Summe.
// Die Eingangsbuchsen (Target-Handles) sitzen gleichmäßig verteilt am
// linken Modulrand; die Kanal-Knobs liegen als Reihe im Modul. Die
// Handle-ID (ch1–ch3) landet in der Kante als `targetHandle` und sagt
// der Audio-Engine, welcher Kanal-Gain gemeint ist.

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { updateAudioNode } from "../audio";
import Knob from "../Knob";
import { MIXER_CHANNELS, type MixerData, type MixerFlowNode } from "../types";
import styles from "./Module.module.scss";

const asPercent = (v: number) => `${Math.round(v * 100)} %`;

export default function MixerNode({ id, data }: NodeProps<MixerFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<MixerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>MIX</span>
      </header>

      {/* Buchsenleiste: Handles gleichmäßig über die Modulhöhe verteilt.
          Bei n Kanälen liegt Buchse i bei (i+1)/(n+1) der Höhe —
          für drei Kanäle also 25 %, 50 %, 75 %. */}
      {MIXER_CHANNELS.map((ch, i) => (
        <Handle
          key={ch}
          type="target"
          position={Position.Left}
          id={ch}
          style={{ top: `${((i + 1) / (MIXER_CHANNELS.length + 1)) * 100}%` }}
        />
      ))}

      {/* Kanal-Regler nebeneinander */}
      <div className={styles.mixerKnobRow}>
        {MIXER_CHANNELS.map((ch, i) => (
          <Knob
            key={ch}
            label={`In ${i + 1}`}
            value={data[ch]}
            min={0}
            max={1}
            step={0.01}
            format={asPercent}
            onChange={(v) => patch({ [ch]: v })}
          />
        ))}
      </div>

      <div className={styles.mixerMaster}>
        <Knob
          label="Master"
          value={data.master}
          min={0}
          max={1}
          step={0.01}
          format={asPercent}
          onChange={(v) => patch({ master: v })}
        />
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
