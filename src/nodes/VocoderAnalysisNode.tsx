// VocoderAnalysisNode.tsx
// Analyse-Hälfte des Vocoders (vgl. Doepfer A-129/1): zerlegt den Modulator
// in Frequenzbänder und liefert pro Band eine CV. Der Gain-Boost nach dem
// Follower ist fest auf ×100 verdrahtet (kein Knob) -- das normalisierte
// Follower-Signal (0..1) liegt bei Sprache nur im Prozentbereich, ×100
// bringt es in einen Bereich, der die Synth-VCAs stabil aussteuert, ohne
// dass man den Wert pro Patch manuell suchen muss.

import { useEffect, useState } from "react";
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import {
  updateAudioNode,
  getVocoderAnalysisLevels,
  getVocoderAnalysisInputLevel,
} from "../audio";
import { vocoderBandFrequencies, VOCODER_BAND_Q } from "./VocoderBands";
import type { VocoderAnalysisData, VocoderAnalysisFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

const ANALYSIS_GAIN_BOOST = 100; // fest -- s. Kommentar oben

type Band = {
  filter: Tone.Filter;
  follower: Tone.Follower;
  boost: Tone.Gain; // fest ×100 -- Ausgang UND Meter hängen dahinter
  meter: Tone.Meter;
};

export type VocoderAnalysisEntry = {
  type: "vocoderAnalysis";
  bands: Band[];
  inputMeter: Tone.Meter;
  ins: { modulator: Tone.Gain };
  outs: Record<string, Tone.ToneAudioNode>; // band0..band9
};

export function createVocoderAnalysisNode(
  id: string,
  data: VocoderAnalysisData,
): VocoderAnalysisEntry {
  const modulatorIn = new Tone.Gain(1);
  const inputMeter = new Tone.Meter({ normalRange: true });
  modulatorIn.connect(inputMeter);

  const frequencies = vocoderBandFrequencies();
  console.log(
    `[VocoderAnalysis:${id}] erzeugt -- ${frequencies.length} Bänder, sensitivity=${data.sensitivity}, gainBoost=${ANALYSIS_GAIN_BOOST} (fest)`,
    frequencies.map((f) => Math.round(f)),
  );

  const bands: Band[] = frequencies.map((freq, i) => {
    const filter = new Tone.Filter({
      frequency: freq,
      Q: VOCODER_BAND_Q,
      type: "bandpass",
    });
    const follower = new Tone.Follower(data.sensitivity);
    const boost = new Tone.Gain(ANALYSIS_GAIN_BOOST);
    const meter = new Tone.Meter({ normalRange: true });

    modulatorIn.connect(filter);
    filter.connect(follower);
    follower.connect(boost);
    boost.connect(meter);

    console.log(
      `[VocoderAnalysis:${id}] Band ${i} verdrahtet: ${Math.round(freq)} Hz -- outs.band${i} = boost (×${ANALYSIS_GAIN_BOOST})`,
    );

    return { filter, follower, boost, meter };
  });

  const outs: Record<string, Tone.ToneAudioNode> = {};
  bands.forEach((band, i) => {
    outs[`band${i}`] = band.boost;
  });

  return {
    type: "vocoderAnalysis",
    bands,
    inputMeter,
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
  // gainBoost ist fest verdrahtet (ANALYSIS_GAIN_BOOST) -- kein Patch-Pfad mehr nötig.
}

export function disposeVocoderAnalysisNode(entry: VocoderAnalysisEntry): void {
  entry.ins.modulator.dispose();
  entry.inputMeter.dispose();
  entry.bands.forEach((band) => {
    band.filter.dispose();
    band.follower.dispose();
    band.boost.dispose();
    band.meter.dispose();
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
  const [levels, setLevels] = useState<number[]>(() =>
    Array(bandCount).fill(0),
  );

  useEffect(() => {
    let raf = 0;
    let lastDraw = 0;
    let lastLog = 0;
    const tick = (time: number) => {
      if (time - lastDraw > 33) {
        const next = getVocoderAnalysisLevels(id);
        if (next) setLevels(next);
        lastDraw = time;
      }
      if (time - lastLog > 1000) {
        const inputLevel = getVocoderAnalysisInputLevel(id);
        const bandLevels = getVocoderAnalysisLevels(id);
        console.log(
          `[VocoderAnalysis:${id}] Eingangspegel=${inputLevel?.toFixed(3) ?? "n/a"}  Bänder=`,
          bandLevels?.map((v) => v.toFixed(2)),
        );
        lastLog = time;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id]);

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
      {Array.from({ length: bandCount }, (_, i) => (
        <div className={styles.ioRowOut} key={i}>
          <span className={styles.ioLabel}>
            {t("common.bandLabel", { n: i })}
          </span>
          <span
            className={styles.led}
            style={{ opacity: 0.15 + Math.min(levels[i] ?? 0, 1) * 0.85 }}
          />
          <Handle type="source" position={Position.Right} id={`band${i}`} />
        </div>
      ))}
    </div>
  );
}
