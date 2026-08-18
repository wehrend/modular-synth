// VocoderAnalysisNode.tsx
// Analyse-Hälfte des Vocoders (vgl. Doepfer A-129/1): zerlegt den Modulator
// (z.B. Stimme) in Frequenzbänder und liefert pro Band eine CV, die der
// Hüllkurve in diesem Band entspricht. Jedes Band hat -- wie beim A-129/1 --
// eine Kontroll-LED, die die aktuelle Bandlautstärke zeigt (nur fürs Auge,
// tapped parallel zum eigentlichen CV-Signal, beeinflusst den Audiographen
// nicht).

import { useEffect, useState } from "react";
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode, getVocoderAnalysisLevels } from "../audio";
import { vocoderBandFrequencies, VOCODER_BAND_Q } from "./VocoderBands";
import type { VocoderAnalysisData, VocoderAnalysisFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

type Band = {
  filter: Tone.Filter;
  follower: Tone.Follower;
  meter: Tone.Meter; // nur für die LED-Anzeige, nicht Teil des Signalpfads
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
    const meter = new Tone.Meter({ normalRange: true });

    modulatorIn.connect(filter);
    filter.connect(follower);
    follower.connect(meter); // Abzweig nur zur Anzeige, follower bleibt der echte CV-Ausgang

    return { filter, follower, meter };
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

  // Poll statt Event-getrieben, weil Meter-Werte kontinuierlich sind --
  // ~30fps reicht für eine LED-Anzeige und spart gegenüber 60fps Renders.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last > 33) {
        const next = getVocoderAnalysisLevels(id);
        if (next) setLevels(next);
        last = time;
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
