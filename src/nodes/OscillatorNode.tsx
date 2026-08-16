// OscillatorNode.tsx
// Quelle: ein Tone.Oscillator mit Frequenz, Wellenform und An/Aus.

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import styles from "./Module.module.scss";
import { updateAudioNode } from "../audio";
import {
  WAVEFORMS,
  type OscData,
  type OscFlowNode,
  type Waveform,
} from "../types";
import * as Tone from "tone";

const RAMP = 0.04; // Sekunden — knackfreie Parameterwechsel

// OscillatorNode.tsx, ganz oben ergänzen
export type OscEntry = {
  type: "osc";
  osc: Tone.Oscillator;
  cvAmt: Tone.Gain;
  ins: { cv: Tone.Gain };
  out: Tone.ToneAudioNode;
};

export function createOscNode(_id: string, data: OscData): OscEntry {
  const osc = new Tone.Oscillator(data.frequency, data.waveform);
  if (data.running) osc.start();

  const cvAmt = new Tone.Gain(data.cvAmount);
  cvAmt.connect(osc.frequency); // addiert sich auf den Grundwert, wie bei deinem VCF
  
  return { type: "osc", osc, cvAmt, ins: { cv: cvAmt }, out: osc };
}

export function updateOscNode(node: OscEntry, patch: Partial<OscData>) {
  const p = patch as Partial<OscData>;
  if (p.frequency !== undefined) {
    // rampTo statt hartem Setzen vermeidet Knackser beim Schieben
    node.osc.frequency.rampTo(p.frequency, RAMP);
  }
  if (p.waveform !== undefined) {
    node.osc.type = p.waveform;
  }
  if (patch.cvAmount !== undefined)
    node.cvAmt.gain.rampTo(patch.cvAmount, RAMP);
  if (p.running !== undefined) {
    if (p.running) node.osc.start();
    else node.osc.stop();
  }
}

export function disposeOscNode(node: OscEntry) {
  node.osc.stop();
  node.osc.dispose();
}

const WAVEFORM_KEYS: Record<Waveform, string> = {
  sine: "common.waveforms.sine",
  triangle: "common.waveforms.triangle",
  sawtooth: "common.waveforms.sawtooth",
  square: "common.waveforms.square",
};

export default function OscillatorNode({ id, data }: NodeProps<OscFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  // UI-State und Audiograph immer gemeinsam aktualisieren
  const patch = (changes: Partial<OscData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={`${styles.module} ${data.running ? styles.isRunning : ""}`}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.vco.title")}</span>
        <button
          className={`${styles.power} ${data.running ? styles.powerOn : ""}`}
          onClick={() => patch({ running: !data.running })}
          aria-label={
            data.running ? t("modules.vco.ariaStop") : t("modules.vco.ariaStart")
          }
        >
          {data.running ? t("modules.vco.on") : t("modules.vco.off")}
        </button>
      </header>
      <Knob
        label={t("common.frequencyLabel")}
        value={data.frequency}
        min={40}
        max={1600}
        step={1}
        log
        format={(v) => `${v} Hz`}
        onChange={(frequency) => patch({ frequency })}
      />
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="cv" />
        <span className={styles.ioLabel}>{t("common.cv")}</span>
      </div>
      <Knob
        label={t("common.amountLabel")}
        value={data.cvAmount}
        min={1}
        max={1000}
        step={10}
        format={(v) => `±${v}`}
        onChange={(cvAmount) => patch({ cvAmount })}
      />
      <span className={styles.ioLabel}>{t("modules.vco.cvHint")}</span>
      <div className={`${styles.row} ${styles.rowGap}`}>
        {WAVEFORMS.map((w) => (
          <button
            key={w}
            className={`${styles.chip} ${data.waveform === w ? styles.chipActive : ""}`}
            onClick={() => patch({ waveform: w })}
          >
            {t(WAVEFORM_KEYS[w])}
          </button>
        ))}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}