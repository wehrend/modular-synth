// WaspNode.tsx
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import type { WaspData, WaspFlowNode } from "../types";
import styles from "./Module.module.scss";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type WaspEntry = {
  type: "wasp";
  stage1: Tone.Filter;
  stage2: Tone.Filter;
  shaper: Tone.WaveShaper;
  feedback: Tone.Gain;
  feedbackDelay: Tone.Delay;
  cutoffAmt: Tone.Gain;
  instability: Tone.LFO;
  inputSum: Tone.Gain;
  ins: { in: Tone.Gain; cutoff: Tone.Gain };
  out: Tone.ToneAudioNode;
};

// Soft-Clip-Kurve mit leichter Asymmetrie -- angelehnt an den charakteristischen
// "dreckigen" Klang der CMOS-Inverter-Stufen im echten EDP Wasp.
function waspCurve(drive: number): Float32Array {
  const amount = 1 + drive * 14;
  const samples = 2048; // feiner aufgelöst, damit das Falten nicht körnig klingt
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    let driven = x * amount;

    // Wavefolding: statt zu kappen, wird das Signal an ±1 gespiegelt.
    // Mehrfaches Falten bei hohem "drive" erzeugt die metallisch-
    // quäkende, instabile Obertonstruktur des echten Wasp-Verhaltens.
    let folded = driven;
    for (let f = 0; f < 3; f++) {
      if (folded > 1) folded = 2 - folded;
      else if (folded < -1) folded = -2 - folded;
    }

    // Leichte Asymmetrie -- reale Schaltungen sind nie perfekt symmetrisch
    curve[i] = folded * (1 - 0.06 * x);
  }
  return curve;
}

export function createWaspNode(_id: string, data: WaspData): WaspEntry {
  const inputSum = new Tone.Gain(1);
  const input = new Tone.Gain(1);
  input.connect(inputSum);

  const stage1 = new Tone.Filter({
    frequency: data.cutoff,
    type: "lowpass",
    Q: 3,
  });
  const shaper = new Tone.WaveShaper(waspCurve(data.drive));
  const stage2 = new Tone.Filter({
    frequency: data.cutoff,
    type: "lowpass",
    Q: 3,
  });

  inputSum.connect(stage1);
  stage1.connect(shaper);
  shaper.connect(stage2);

  const feedback = new Tone.Gain(data.resonance * 5.5);
  const feedbackDelay = new Tone.Delay(0.001);
  stage2.connect(feedback);
  feedback.connect(feedbackDelay);
  feedbackDelay.connect(inputSum);

  // Interne Instabilität: eine schnelle, winzige Modulation auf den Cutoff,
  // simuliert Bauteil-Drift der CMOS-Chips -- macht den Klang "lebendig"
  // statt statisch/sauber, besonders hörbar bei hoher Resonanz.
  const instability = new Tone.LFO({
    frequency: 37,
    min: -15,
    max: 15,
  }).start();
  instability.connect(stage1.frequency);
  instability.connect(stage2.frequency);

  const cutoffAmt = new Tone.Gain(data.cutoffAmount);
  cutoffAmt.connect(stage1.frequency);
  cutoffAmt.connect(stage2.frequency);

  return {
    type: "wasp",
    stage1,
    stage2,
    shaper,
    feedback,
    feedbackDelay,
    inputSum,
    cutoffAmt,
    instability,
    ins: { in: input, cutoff: cutoffAmt },
    out: stage2,
  };
}

export function updateWaspNode(
  entry: WaspEntry,
  patch: Partial<WaspData>,
): void {
  if (patch.cutoff !== undefined) {
    entry.stage1.frequency.rampTo(patch.cutoff, RAMP);
    entry.stage2.frequency.rampTo(patch.cutoff, RAMP);
  }
  if (patch.resonance !== undefined) {
    entry.feedback.gain.rampTo(patch.resonance * 0.95, RAMP);
  }
  if (patch.drive !== undefined) {
    entry.shaper.curve = waspCurve(patch.drive);
  }
  if (patch.cutoffAmount !== undefined) {
    entry.cutoffAmt.gain.rampTo(patch.cutoffAmount, RAMP);
  }
}

export function disposeWaspNode(entry: WaspEntry): void {
  entry.ins.in.dispose();
  entry.stage1.dispose();
  entry.stage2.dispose();
  entry.shaper.dispose();
  entry.feedback.dispose();
  entry.instability.dispose();
  entry.feedbackDelay.dispose();
  entry.cutoffAmt.dispose();
}

/* ---------- UI-Seite ---------- */

export default function WaspNode({ id, data }: NodeProps<WaspFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<WaspData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.wasp.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="in" />
        <span className={styles.ioLabel}>{t("common.in")}</span>
      </div>

      <div className={styles.row}>
        <Knob
          label={t("modules.vcf.cutoffLabel")}
          value={data.cutoff}
          min={40}
          max={12000}
          step={1}
          log
          format={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v} Hz`
          }
          onChange={(cutoff) => patch({ cutoff })}
        />
        <Knob
          label={t("modules.wasp.resonanceLabel")}
          value={data.resonance}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(resonance) => patch({ resonance })}
        />
        <Knob
          label={t("modules.wasp.driveLabel")}
          value={data.drive}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(drive) => patch({ drive })}
        />
      </div>
      <div className={styles.row}>
        <Knob
          label={t("modules.wasp.cvAmountLabel")}
          value={data.cutoffAmount}
          min={0}
          max={5000}
          step={10}
          format={(v) => `±${v}`}
          onChange={(cutoffAmount) => patch({ cutoffAmount })}
        />
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="cutoff" />
        <span className={styles.ioLabel}>
          {t("modules.wasp.cutoffCvLabel")}
        </span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
