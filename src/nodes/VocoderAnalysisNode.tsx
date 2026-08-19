// VocoderAnalysisNode.tsx
// Analyse-Hälfte des Vocoders (vgl. Doepfer A-129/1): zerlegt den Modulator
// (z.B. Stimme) in Frequenzbänder und liefert pro Band eine CV, die der
// Hüllkurve in diesem Band entspricht. Der Gain-Boost sitzt bewusst direkt
// hinter dem Follower -- VOR dem Meter-Abzweig -- damit die Kontroll-LEDs
// exakt den Pegel zeigen, der auch als CV rausgeht (nicht den Rohwert).

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

type Band = {
  filter: Tone.Filter;
  follower: Tone.Follower;
  boost: Tone.Gain; // verstärkt die CV -- Ausgang UND Meter hängen dahinter
  meter: Tone.Meter; // nur für die LED-Anzeige, nicht Teil des Signalpfads
};

export type VocoderAnalysisEntry = {
  type: "vocoderAnalysis";
  bands: Band[];
  inputMeter: Tone.Meter; // Pegel VOR der Filterbank -- zeigt, ob überhaupt Signal ankommt
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

  const bands: Band[] = frequencies.map((freq, i) => {
    const filter = new Tone.Filter({
      frequency: freq,
      Q: VOCODER_BAND_Q,
      type: "bandpass",
    });
    const follower = new Tone.Follower(data.sensitivity);
    const boost = new Tone.Gain(data.gainBoost);
    const meter = new Tone.Meter({ normalRange: true });

    modulatorIn.connect(filter);
    filter.connect(follower);
    follower.connect(boost);
    boost.connect(meter); // Meter UND Ausgang hängen beide hinter dem Boost

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
  if (patch.gainBoost !== undefined) {
    entry.bands.forEach((band) => {
      band.boost.gain.rampTo(patch.gainBoost!, 0.04);
    });
  }
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

      <Knob
        label={t("common.gainLabel")}
        value={data.gainBoost}
        min={1}
        max={30}
        step={0.5}
        log
        format={(v) => `×${v.toFixed(1)}`}
        onChange={(gainBoost) => patch({ gainBoost })}
      />

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
