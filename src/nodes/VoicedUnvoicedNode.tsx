// VoicedUnvoicedNode.tsx
// Voiced/Unvoiced-Detektor (vgl. Doepfer A-129/5): erkennt, ob das
// Sprachsignal gerade stimmhaft (Vokale, tieftonig/periodisch) oder
// stimmlos ist (S, F, T, SH -- hochfrequent, rauschartig), und schaltet
// den Carrier für den Vocoder entsprechend zwischen zwei Quellen um
// (klassisch: Oszillator für "voiced", Noise für "unvoiced").
//
// Die Erkennung läuft komplett audio-rate im Web-Audio-Graphen:
//   Hochpass(1.5kHz)-Pegel minus Tiefpass(1.5kHz)-Pegel, per Tone.Subtract
//   -> Tone.GreaterThan(0) liefert ein hartes 0/1-Signal ("unvoiced?").
// Für den Crossfade wird das leicht geglättet (Klick-Vermeidung), für die
// LED nochmal separat und langsamer geglättet (bessere Ablesbarkeit).

import { useEffect, useState } from "react";
import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode, getVoicedUnvoicedLevel } from "../audio";
import type {
  VoicedUnvoicedData,
  VoicedUnvoicedFlowNode,
} from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

const SWITCH_FREQUENCY = 1500; // Hz -- fix, entspricht der Schaltfrequenz des Originals
const DETECTOR_SMOOTHING = 0.015; // Follower-Zeit für High-/Lowpass-Pegel
const SWITCH_SMOOTHING = 0.01; // schnell, nur zur Klick-Vermeidung im Crossfade
const LED_SMOOTHING = 0.08; // langsamer, besser ablesbar

export type VoicedUnvoicedEntry = {
  type: "voicedUnvoiced";
  gainNode: Tone.Gain;
  trebleFilter: Tone.Filter;
  ledMeter: Tone.Meter;
  ins: { speech: Tone.Gain; voicedIn: Tone.Gain; unvoicedIn: Tone.Gain };
  outs: { speech: Tone.ToneAudioNode; carrier: Tone.ToneAudioNode; gate: Tone.ToneAudioNode };
};

export function createVoicedUnvoicedNode(
  _id: string,
  data: VoicedUnvoicedData,
): VoicedUnvoicedEntry {
  const speechIn = new Tone.Gain(1);
  const gainNode = new Tone.Gain(data.gain);
  const trebleFilter = new Tone.Filter({
    type: "highshelf",
    frequency: 2000,
    gain: data.trebleBoost,
  });
  speechIn.connect(gainNode);
  gainNode.connect(trebleFilter);
  // trebleFilter ist zugleich der Speech-Output UND die Quelle für die Erkennung.

  const highpass = new Tone.Filter({ frequency: SWITCH_FREQUENCY, type: "highpass" });
  const lowpass = new Tone.Filter({ frequency: SWITCH_FREQUENCY, type: "lowpass" });
  const highFollower = new Tone.Follower(DETECTOR_SMOOTHING);
  const lowFollower = new Tone.Follower(DETECTOR_SMOOTHING);
  trebleFilter.connect(highpass);
  trebleFilter.connect(lowpass);
  highpass.connect(highFollower);
  lowpass.connect(lowFollower);

  // diff = highPegel - lowPegel; diff > 0 -> mehr Hochton- als Tiefton-Energie -> unvoiced
  const diff = new Tone.Subtract();
  highFollower.connect(diff);
  lowFollower.connect(diff.subtrahend);
  const unvoicedGate = new Tone.GreaterThan(0); // hartes 0/1-Signal, exponiert als "gate"-Ausgang
  diff.connect(unvoicedGate);

  const switchSmooth = new Tone.Follower(SWITCH_SMOOTHING);
  unvoicedGate.connect(switchSmooth);

  const ledFollower = new Tone.Follower(LED_SMOOTHING);
  const ledMeter = new Tone.Meter({ normalRange: true });
  unvoicedGate.connect(ledFollower);
  ledFollower.connect(ledMeter);

  const voicedIn = new Tone.Gain(1);
  const unvoicedIn = new Tone.Gain(1);
  const crossFade = new Tone.CrossFade();
  voicedIn.connect(crossFade.a);
  unvoicedIn.connect(crossFade.b);
  switchSmooth.connect(crossFade.fade); // fade=0 -> voicedIn, fade=1 -> unvoicedIn

  return {
    type: "voicedUnvoiced",
    gainNode,
    trebleFilter,
    ledMeter,
    ins: { speech: speechIn, voicedIn, unvoicedIn },
    outs: { speech: trebleFilter, carrier: crossFade, gate: unvoicedGate },
  };
}

export function updateVoicedUnvoicedNode(
  entry: VoicedUnvoicedEntry,
  patch: Partial<VoicedUnvoicedData>,
): void {
  if (patch.gain !== undefined) {
    entry.gainNode.gain.rampTo(patch.gain, 0.04);
  }
  if (patch.trebleBoost !== undefined) {
    entry.trebleFilter.gain.rampTo(patch.trebleBoost, 0.04);
  }
}

export function disposeVoicedUnvoicedNode(entry: VoicedUnvoicedEntry): void {
  entry.ins.speech.dispose();
  entry.ins.voicedIn.dispose();
  entry.ins.unvoicedIn.dispose();
  entry.gainNode.dispose();
  entry.trebleFilter.dispose();
  entry.ledMeter.dispose();
  // outs.carrier (CrossFade) und die internen Filter/Follower/Signal-Knoten
  // hängen alle an bereits disposeten Quellen -- Tone.js räumt verbundene
  // Knoten nicht automatisch mit auf, daher hier vollständig referenzieren:
  entry.outs.carrier.dispose();
  entry.outs.gate.dispose();
}

/* ---------- UI-Seite ---------- */

export default function VoicedUnvoicedNode({
  id,
  data,
}: NodeProps<VoicedUnvoicedFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VoicedUnvoicedData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const [level, setLevel] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = getVoicedUnvoicedLevel(id);
      if (next !== null) setLevel(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id]);

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.voicedUnvoiced.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="speech" />
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.speechLabel")}
        </span>
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="voicedIn" />
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.voicedInLabel")}
        </span>
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="unvoicedIn" />
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.unvoicedInLabel")}
        </span>
      </div>

      <Knob
        label={t("common.gainLabel")}
        value={data.gain}
        min={0.1}
        max={4}
        step={0.05}
        log
        format={(v) => `×${v.toFixed(1)}`}
        onChange={(gain) => patch({ gain })}
      />

      <Knob
        label={t("modules.voicedUnvoiced.trebleBoostLabel")}
        value={data.trebleBoost}
        min={0}
        max={18}
        step={0.5}
        format={(v) => `+${v.toFixed(1)} dB`}
        onChange={(trebleBoost) => patch({ trebleBoost })}
      />

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.unvoicedLedLabel")}
        </span>
        <span
          className={styles.led}
          style={{ opacity: 0.15 + Math.min(level, 1) * 0.85 }}
        />
        <Handle type="source" position={Position.Right} id="gate" />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.speechOutLabel")}
        </span>
        <Handle type="source" position={Position.Right} id="speech" />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>
          {t("modules.voicedUnvoiced.carrierOutLabel")}
        </span>
        <Handle type="source" position={Position.Right} id="carrier" />
      </div>
    </div>
  );
}