// PannerNode.tsx
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import type { PannerData, PannerFlowNode } from "../types";
import styles from "./Module.module.scss";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type PannerEntry = {
  type: "panner";
  panner: Tone.Panner;
  split: Tone.Split;
  panAmt: Tone.Gain;
  ins: { in: Tone.Gain; pan: Tone.Gain };
  outs: { l: Tone.ToneAudioNode; r: Tone.ToneAudioNode };
};

export function createPannerNode(_id: string, data: PannerData): PannerEntry {
  const panner = new Tone.Panner(data.pan);
  const split = new Tone.Split();
  panner.connect(split);

  const input = new Tone.Gain(1);
  input.connect(panner);

  const panAmt = new Tone.Gain(data.panAmount);
  panAmt.connect(panner.pan);

  return {
    type: "panner",
    panner,
    split,
    panAmt,
    ins: { in: input, pan: panAmt },
    outs: { l: split, r: split }, // Kanalindex entscheidet in resolveOutput
  };
}

export function updatePannerNode(
  entry: PannerEntry,
  patch: Partial<PannerData>,
): void {
  if (patch.pan !== undefined) {
    entry.panner.pan.rampTo(patch.pan, RAMP);
  }
  if (patch.panAmount !== undefined) {
    entry.panAmt.gain.rampTo(patch.panAmount, RAMP);
  }
}

export function disposePannerNode(entry: PannerEntry): void {
  entry.panner.dispose();
  entry.split.dispose();
  entry.panAmt.dispose();
  entry.ins.in.dispose();
}

/* ---------- UI-Seite ---------- */

export default function PannerNode({ id, data }: NodeProps<PannerFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<PannerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.panner.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="in" />
        <span className={styles.ioLabel}>{t("common.in")}</span>
      </div>

      <Knob
        label={t("modules.panner.panLabel")}
        value={data.pan}
        min={-1}
        max={1}
        step={0.01}
        format={(v) =>
          v === 0
            ? t("modules.panner.center")
            : v < 0
              ? `${Math.round(-v * 100)}L`
              : `${Math.round(v * 100)}R`
        }
        onChange={(pan) => patch({ pan })}
      />

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="pan" />
        <span className={styles.ioLabel}>{t("modules.panner.panCvLabel")}</span>
        <Knob
          label={t("common.amountLabel")}
          value={data.panAmount}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `±${Math.round(v * 100)}%`}
          onChange={(panAmount) => patch({ panAmount })}
        />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>{t("modules.panner.left")}</span>
        <Handle type="source" position={Position.Right} id="l" />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>{t("modules.panner.right")}</span>
        <Handle type="source" position={Position.Right} id="r" />
      </div>
    </div>
  );
}
