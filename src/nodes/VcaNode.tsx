// VcaNode.tsx
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import type { VcaData, VcaFlowNode } from "../types";
import styles from "./Module.module.scss";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type VcaEntry = {
  type: "vca";
  multiply: Tone.Multiply;
  ins: { audio: Tone.Gain; cv: Tone.Gain };
  out: Tone.ToneAudioNode;
};

export function createVcaNode(_id: string, data: VcaData): VcaEntry {
  const multiply = new Tone.Multiply();
  multiply.factor.value = data.gain ?? 0; // Fallback, falls data unvollständig ist

  const audioIn = new Tone.Gain(1);
  audioIn.connect(multiply); // normaler Audioeingang

  // WICHTIG: cvIn moduliert additiv auf multiply.factor, nicht ersetzend --
  // "gain" bleibt als Basispegel wirksam, auch wenn CV mit reinkommt.
  const cvIn = new Tone.Gain(1);
  cvIn.connect(multiply.factor);

  return {
    type: "vca",
    multiply,
    ins: { audio: audioIn, cv: cvIn },
    out: multiply,
  };
}

export function updateVcaNode(entry: VcaEntry, patch: Partial<VcaData>): void {
  if (patch.gain !== undefined) {
    entry.multiply.factor.rampTo(patch.gain, RAMP);
  }
}

export function disposeVcaNode(entry: VcaEntry): void {
  entry.multiply.dispose();
  entry.ins.audio.dispose();
  entry.ins.cv.dispose();
}

/* ---------- UI-Seite ---------- */

export default function VcaNode({ id, data }: NodeProps<VcaFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VcaData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.vca.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="audio" />
        <span className={styles.ioLabel}>{t("common.audioLabel")}</span>
      </div>

      <Knob
        label={t("common.gainLabel")}
        value={data.gain}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(gain) => patch({ gain })}
      />

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="cv" />
        <span className={styles.ioLabel}>{t("common.cv")}</span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
