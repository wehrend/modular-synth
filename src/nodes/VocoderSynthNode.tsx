// VocoderSynthNode.tsx
// Synthese-Hälfte des Vocoders (vgl. Doepfer A-129/2): zerlegt den Carrier
// in dieselben Frequenzbänder wie das Analyse-Modul und moduliert pro Band
// einen VCA mit der ankommenden CV. Der Level-Gain vor Kompressor/Makeup
// ist fest auf ×10 verdrahtet (kein Knob mehr) -- passt zusammen mit dem
// festen ×100-Boost der Analyse zu einer stabilen Gesamtverstärkung.

import { useEffect } from "react";
import * as Tone from "tone";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { getVocoderSynthDebugInfo } from "../audio";
import { vocoderBandFrequencies, VOCODER_BAND_Q } from "./VocoderBands";
import type { VocoderSynthData, VocoderSynthFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

const SYNTH_FIXED_LEVEL = 10; // fest -- s. Kommentar oben

type Band = {
  filter: Tone.Filter;
  vca: Tone.Gain;
  cvIn: Tone.Gain;
  cvMeter: Tone.Meter;
};

export type VocoderSynthEntry = {
  type: "vocoderSynth";
  bands: Band[];
  sum: Tone.Gain;
  level: Tone.Gain;
  compressor: Tone.Compressor;
  makeup: Tone.Gain;
  carrierMeter: Tone.Meter;
  outputMeter: Tone.Meter;
  ins: Record<string, Tone.ToneAudioNode>;
  out: Tone.ToneAudioNode;
};

export function createVocoderSynthNode(
  id: string,
  _data: VocoderSynthData,
): VocoderSynthEntry {
  const carrierIn = new Tone.Gain(1);
  const carrierMeter = new Tone.Meter({ normalRange: true });
  carrierIn.connect(carrierMeter);

  const sum = new Tone.Gain(1);
  const level = new Tone.Gain(SYNTH_FIXED_LEVEL);

  const compressor = new Tone.Compressor({
    threshold: -35,
    ratio: 8,
    attack: 0.005,
    release: 0.15,
  });
  const makeup = new Tone.Gain(6);
  const outputMeter = new Tone.Meter({ normalRange: true });

  sum.connect(level);
  level.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(outputMeter);

  const ins: Record<string, Tone.ToneAudioNode> = { carrier: carrierIn };

  const frequencies = vocoderBandFrequencies();
  console.log(
    `[VocoderSynth:${id}] erzeugt -- ${frequencies.length} Bänder, level=${SYNTH_FIXED_LEVEL} (fest)`,
    frequencies.map((f) => Math.round(f)),
  );

  const bands: Band[] = frequencies.map((freq, i) => {
    const filter = new Tone.Filter({
      frequency: freq,
      Q: VOCODER_BAND_Q,
      type: "bandpass",
    });
    const vca = new Tone.Gain(0);
    const cvIn = new Tone.Gain(1);
    const cvMeter = new Tone.Meter({ normalRange: true });
    cvIn.connect(vca.gain);
    cvIn.connect(cvMeter);

    carrierIn.connect(filter);
    filter.connect(vca);
    vca.connect(sum);

    ins[`band${i}`] = cvIn;
    console.log(
      `[VocoderSynth:${id}] Band ${i} verdrahtet: ${Math.round(freq)} Hz -- ins.band${i} = cvIn`,
    );

    return { filter, vca, cvIn, cvMeter };
  });

  return {
    type: "vocoderSynth",
    bands,
    sum,
    level,
    compressor,
    makeup,
    carrierMeter,
    outputMeter,
    ins,
    out: makeup,
  };
}

export function updateVocoderSynthNode(
  _entry: VocoderSynthEntry,
  _patch: Partial<VocoderSynthData>,
): void {
  // Keine einstellbaren Parameter mehr -- Level ist fest auf SYNTH_FIXED_LEVEL verdrahtet.
}

export function disposeVocoderSynthNode(entry: VocoderSynthEntry): void {
  entry.ins.carrier.dispose();
  entry.carrierMeter.dispose();
  entry.outputMeter.dispose();
  entry.sum.dispose();
  entry.level.dispose();
  entry.compressor.dispose();
  entry.makeup.dispose();
  entry.bands.forEach((band) => {
    band.filter.dispose();
    band.vca.dispose();
    band.cvIn.dispose();
    band.cvMeter.dispose();
  });
}

/* ---------- UI-Seite ---------- */

export default function VocoderSynthNode({
  id,
}: NodeProps<VocoderSynthFlowNode>) {
  const { t } = useTranslation();

  const bandCount = vocoderBandFrequencies().length;

  useEffect(() => {
    let raf = 0;
    let lastLog = 0;
    const tick = (time: number) => {
      if (time - lastLog > 1000) {
        const info = getVocoderSynthDebugInfo(id);
        if (info) {
          console.log(
            `[VocoderSynth:${id}] Carrier=${info.carrier.toFixed(3)}  CVs=`,
            info.bands.map((v) => v.toFixed(2)),
            `Output(nach Kompressor+Makeup)=${info.output.toFixed(3)}`,
          );
        }
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

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
