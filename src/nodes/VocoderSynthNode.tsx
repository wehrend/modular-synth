// VocoderSynthNode.tsx
// Synthese-Hälfte des Vocoders (vgl. Doepfer A-129/2): zerlegt den Carrier
// (z.B. Sägezahn/Rauschen) in dieselben Frequenzbänder wie das Analyse-Modul
// und moduliert pro Band einen VCA mit der dort ankommenden CV. Summe aller
// Bänder = der eigentliche Vocoder-Klang.

import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import { vocoderBandFrequencies, VOCODER_BAND_Q } from "./VocoderBands";
import type { VocoderSynthData, VocoderSynthFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

type Band = {
  filter: Tone.Filter;
  vca: Tone.Gain;
  cvIn: Tone.Gain; // CV-Eingang, verbindet auf vca.gain -- gleiches Muster wie cutoffAmt beim VCF
};

export type VocoderSynthEntry = {
  type: "vocoderSynth";
  bands: Band[];
  sum: Tone.Gain;
  level: Tone.Gain;
  ins: Record<string, Tone.ToneAudioNode>; // carrier, band0..band9
  out: Tone.ToneAudioNode;
};

export function createVocoderSynthNode(
  _id: string,
  data: VocoderSynthData,
): VocoderSynthEntry {
  const carrierIn = new Tone.Gain(1);
  const sum = new Tone.Gain(1); // Summierpunkt aller Bänder
  const level = new Tone.Gain(data.level);
  sum.connect(level);

  const ins: Record<string, Tone.ToneAudioNode> = { carrier: carrierIn };

  const bands: Band[] = vocoderBandFrequencies().map((freq, i) => {
    const filter = new Tone.Filter({
      frequency: freq,
      Q: VOCODER_BAND_Q,
      type: "bandpass",
    });
    // Basispegel 0: der VCA ist stumm, bis eine CV vom Analyse-Modul reinkommt
    const vca = new Tone.Gain(0);
    const cvIn = new Tone.Gain(1);
    cvIn.connect(vca.gain);

    carrierIn.connect(filter);
    filter.connect(vca);
    vca.connect(sum);

    ins[`band${i}`] = cvIn;
    return { filter, vca, cvIn };
  });

  return {
    type: "vocoderSynth",
    bands,
    sum,
    level,
    ins,
    out: level,
  };
}

export function updateVocoderSynthNode(
  entry: VocoderSynthEntry,
  patch: Partial<VocoderSynthData>,
): void {
  if (patch.level !== undefined) {
    entry.level.gain.rampTo(patch.level, 0.04);
  }
}

export function disposeVocoderSynthNode(entry: VocoderSynthEntry): void {
  entry.ins.carrier.dispose();
  entry.sum.dispose();
  entry.level.dispose();
  entry.bands.forEach((band) => {
    band.filter.dispose();
    band.vca.dispose();
    band.cvIn.dispose();
  });
}

/* ---------- UI-Seite ---------- */

export default function VocoderSynthNode({
  id,
  data,
}: NodeProps<VocoderSynthFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VocoderSynthData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const bandCount = vocoderBandFrequencies().length;

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.vocoderSynth.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="carrier" />
        <span className={styles.ioLabel}>
          {t("modules.vocoderSynth.carrierLabel")}
        </span>
      </div>

      {Array.from({ length: bandCount }, (_, i) => (
        <div className={styles.ioRow} key={i}>
          <Handle type="target" position={Position.Left} id={`band${i}`} />
          <span className={styles.ioLabel}>
            {t("common.bandLabel", { n: i })}
          </span>
        </div>
      ))}

      <Knob
        label={t("modules.vocoderSynth.levelLabel")}
        value={data.level}
        min={0}
        max={4}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(level) => patch({ level })}
      />

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
