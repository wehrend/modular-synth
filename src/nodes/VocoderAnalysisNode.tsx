// VocoderAnalysisNode.tsx
// Analyse-Hälfte des Vocoders (vgl. Doepfer A-129/1): zerlegt den Modulator
// (z.B. Stimme) in Frequenzbänder und liefert pro Band eine CV, die der
// Hüllkurve in diesem Band entspricht. Kein eigener Audioausgang -- nur
// Steuersignale, die man frei patchen kann.

import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import { vocoderBandFrequencies, VOCODER_BAND_Q } from "./VocoderBands";
import type { VocoderAnalysisData, VocoderAnalysisFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

type Band = {
  filter: Tone.Filter;
  follower: Tone.Follower;
};

export type VocoderAnalysisEntry = {
  type: "vocoderAnalysis";
  bands: Band[];
  ins: { modulator: Tone.Gain };
  outs: Record<string, Tone.ToneAudioNode>; // band0..band9
};

export function createVocoderAnalysisNode(
  _id: string,
  data: VocoderAnalysisData,
): VocoderAnalysisEntry {
  const modulatorIn = new Tone.Gain(1);

  const bands: Band[] = vocoderBandFrequencies().map((freq) => {
    const filter = new Tone.Filter({
      frequency: freq,
      Q: VOCODER_BAND_Q,
      type: "bandpass",
    });
    const follower = new Tone.Follower(data.sensitivity);
    modulatorIn.connect(filter);
    filter.connect(follower);
    return { filter, follower };
  });

  const outs: Record<string, Tone.ToneAudioNode> = {};
  bands.forEach((band, i) => {
    outs[`band${i}`] = band.follower;
  });

  return {
    type: "vocoderAnalysis",
    bands,
    ins: { modulator: modulatorIn },
    outs,
  };
}

export function updateVocoderAnalysisNode(
  entry: VocoderAnalysisEntry,
  patch: Partial<VocoderAnalysisData>,
): void {
  if (patch.sensitivity !== undefined) {
    entry.bands.forEach((band) => {
      band.follower.smoothing = patch.sensitivity!;
    });
  }
}

export function disposeVocoderAnalysisNode(entry: VocoderAnalysisEntry): void {
  entry.ins.modulator.dispose();
  entry.bands.forEach((band) => {
    band.filter.dispose();
    band.follower.dispose();
  });
}

/* ---------- UI-Seite ---------- */

export default function VocoderAnalysisNode({
  id,
  data,
}: NodeProps<VocoderAnalysisFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VocoderAnalysisData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const bandCount = vocoderBandFrequencies().length;

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>
          {t("modules.vocoderAnalysis.title")}
        </span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="modulator" />
        <span className={styles.ioLabel}>
          {t("modules.vocoderAnalysis.modulatorLabel")}
        </span>
      </div>

      <Knob
        label={t("modules.vocoderAnalysis.followerLabel")}
        value={data.sensitivity}
        min={0.005}
        max={0.2}
        step={0.005}
        log
        format={(v) => `${Math.round(v * 1000)} ms`}
        onChange={(sensitivity) => patch({ sensitivity })}
      />

      {Array.from({ length: bandCount }, (_, i) => (
        <div className={styles.ioRowOut} key={i}>
          <span className={styles.ioLabel}>
            {t("common.bandLabel", { n: i })}
          </span>
          <Handle type="source" position={Position.Right} id={`band${i}`} />
        </div>
      ))}
    </div>
  );
}
