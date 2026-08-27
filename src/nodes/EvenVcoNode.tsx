import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import {
  type EvenVcoData,
  type EvenVcoFlowNode,
} from "../types";
import styles from "./Module.module.scss";
import RotarySwitch from "../components/RotarySwitch";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type EvenVcoEntry = {
  type: "evenvco";
  oscSine: Tone.Oscillator;
  oscTriangle: Tone.Oscillator;
  oscSawtooth: Tone.Oscillator;
  oscSquare: Tone.Oscillator;
  sineCore: Tone.Oscillator;
  evenShaper: Tone.WaveShaper;
  dcBlocker: Tone.Filter;
  cvAmt: Tone.Gain;
  currentData: EvenVcoData;
  ins: { cv: Tone.Gain };
  outs: {
    sine: Tone.ToneAudioNode;
    triangle: Tone.ToneAudioNode;
    sawtooth: Tone.ToneAudioNode;
    square: Tone.ToneAudioNode;
    even: Tone.ToneAudioNode;
  };
};

// Vollweg-Gleichrichtung (|x|) ist eine gerad-symmetrische Funktion
// (f(-x) = f(x)) -- genau solche Nichtlinearitäten erzeugen mathematisch
// AUSSCHLIESSLICH geradzahlige Obertöne (2f, 4f, 6f, ...), keine ungeraden.
// Leicht geglättet statt scharfem |x|, damit es nicht wie reines Clipping klingt.
function evenHarmonicsCurve(): Float32Array {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.abs(x) ** 0.85; // Exponent < 1 rundet die Spitze leicht ab
  }
  return curve;
}

function computeFrequency(data: EvenVcoData): number {
  const BASE_FREQUENCY = 440;
  const octave = data.octave ?? 5;
  const fineTune = data.fineTune ?? 0;
  return BASE_FREQUENCY * Math.pow(2, octave - 5) + fineTune;
}

export function createEvenVcoNode(
  _id: string,
  data: EvenVcoData,
): EvenVcoEntry {
  const freq = computeFrequency(data);

  const oscSine = new Tone.Oscillator(freq, "sine");
  const oscTriangle = new Tone.Oscillator(freq, "triangle");
  const oscSawtooth = new Tone.Oscillator(freq, "sawtooth");
  const oscSquare = new Tone.Oscillator(freq, "square");
  const allOscs = [oscSine, oscTriangle, oscSawtooth, oscSquare];
  if (data.running) allOscs.forEach((o) => o.start());

  const sineCore = new Tone.Oscillator(freq, "sine");
  if (data.running) sineCore.start();

  const evenShaper = new Tone.WaveShaper(evenHarmonicsCurve());
  const dcBlocker = new Tone.Filter({ frequency: 20, type: "highpass", Q: 0 });
  sineCore.connect(evenShaper);
  evenShaper.connect(dcBlocker);

  const cvAmt = new Tone.Gain(data.cvAmount);
  // ALLE fünf Kerne folgen derselben CV, damit sie zueinander stimmig bleiben
  [...allOscs, sineCore].forEach((o) => cvAmt.connect(o.frequency));

  return {
    type: "evenvco",
    oscSine,
    oscTriangle,
    oscSawtooth,
    oscSquare,
    sineCore,
    evenShaper,
    dcBlocker,
    cvAmt,
    currentData: data,
    ins: { cv: cvAmt },
    outs: {
      sine: oscSine,
      triangle: oscTriangle,
      sawtooth: oscSawtooth,
      square: oscSquare,
      even: dcBlocker,
    },
  };
}

export function updateEvenVcoNode(
  entry: EvenVcoEntry,
  patch: Partial<EvenVcoData>,
): void {
  entry.currentData = { ...entry.currentData, ...patch };

  if (patch.octave !== undefined || patch.fineTune !== undefined) {
    const freq = computeFrequency(entry.currentData);
    entry.oscSine.frequency.rampTo(freq, RAMP);
    entry.oscTriangle.frequency.rampTo(freq, RAMP);
    entry.oscSawtooth.frequency.rampTo(freq, RAMP);
    entry.oscSquare.frequency.rampTo(freq, RAMP);
    entry.sineCore.frequency.rampTo(freq, RAMP);
  }
  if (patch.cvAmount !== undefined) {
    entry.cvAmt.gain.rampTo(patch.cvAmount, RAMP);
  }
  if (patch.running !== undefined) {
    const oscs = [
      entry.oscSine,
      entry.oscTriangle,
      entry.oscSawtooth,
      entry.oscSquare,
      entry.sineCore,
    ];
    if (patch.running) oscs.forEach((o) => o.start());
    else oscs.forEach((o) => o.stop());
  }
}

export function disposeEvenVcoNode(entry: EvenVcoEntry): void {
  entry.oscSine.dispose();
  entry.oscTriangle.dispose();
  entry.oscSawtooth.dispose();
  entry.oscSquare.dispose();
  entry.sineCore.dispose();
  entry.evenShaper.dispose();
  entry.dcBlocker.dispose();
  entry.cvAmt.dispose();
}

/* ---------- UI-Seite ---------- */

const OCTAVE_LABELS = [
  "32'",
  "16'",
  "8'",
  "4'",
  "2'",
  "1'",
  "1/2'",
  "1/4'",
  "1/8'",
  "1/16'",
  "1/32'",
  "1/64'",
];

export default function EvenVcoNode({ id, data }: NodeProps<EvenVcoFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const patch = (changes: Partial<EvenVcoData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={`${styles.module} ${data.running ? styles.isRunning : ""}`}>
      <header className={styles.head}>
        <span className={styles.title}>EVEN VCO</span>
        <button
          className={`${styles.power} ${data.running ? styles.powerOn : ""}`}
          onClick={() => patch({ running: !data.running })}
        >
          {data.running ? "an" : "aus"}
        </button>
      </header>

      <RotarySwitch
        positions={12}
        value={data.octave}
        labels={OCTAVE_LABELS}
        onChange={(octave) => patch({ octave })}
      />

      <Knob
        label="Fine"
        value={data.fineTune}
        min={-20}
        max={20}
        step={0.1}
        format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} Hz`}
        onChange={(fineTune) => patch({ fineTune })}
      />

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="cv" />
        <span className={styles.ioLabel}>CV</span>
        <Knob
          label="Amount"
          value={data.cvAmount}
          min={1}
          max={2000}
          step={1}
          log
          format={(v) => `±${v}`}
          onChange={(cvAmount) => patch({ cvAmount })}
        />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Sin</span>
        <Handle
          type="source"
          position={Position.Right}
          id="sine"
          style={{ top: "58%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Tri</span>
        <Handle
          type="source"
          position={Position.Right}
          id="triangle"
          style={{ top: "67%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Saw</span>
        <Handle
          type="source"
          position={Position.Right}
          id="sawtooth"
          style={{ top: "76%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Sqr</span>
        <Handle
          type="source"
          position={Position.Right}
          id="square"
          style={{ top: "85%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Even</span>
        <Handle
          type="source"
          position={Position.Right}
          id="even"
          style={{ top: "94%" }}
        />
      </div>
    </div>
  );
}
