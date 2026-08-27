import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import {
  WAVEFORMS,
  type EvenVcoData,
  type EvenVcoFlowNode,
  type Waveform,
} from "../types";
import styles from "./Module.module.scss";
import RotarySwitch from "../components/RotarySwitch";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type EvenVcoEntry = {
  type: "evenvco";
  osc: Tone.Oscillator; // normaler, wählbarer Ausgang
  sineCore: Tone.Oscillator; // interner, fester Sinus -- Basis für den Even-Trick
  evenShaper: Tone.WaveShaper;
  dcBlocker: Tone.Filter;
  cvAmt: Tone.Gain;
  ins: { cv: Tone.Gain };
  outs: { main: Tone.ToneAudioNode; even: Tone.ToneAudioNode };
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

export function createEvenVcoNode(
  _id: string,
  data: EvenVcoData,
): EvenVcoEntry {
  const osc = new Tone.Oscillator(data.frequency, data.waveform);
  if (data.running) osc.start();

  // Fester Sinuskern für den Even-Ausgang, unabhängig von der gewählten
  // Wellenform des Hauptausgangs -- läuft synchron zur selben Frequenz.
  const sineCore = new Tone.Oscillator(data.frequency, "sine");
  if (data.running) sineCore.start();

  const evenShaper = new Tone.WaveShaper(evenHarmonicsCurve());
  // Gleichrichtung erzeugt einen DC-Offset (der Mittelwert von |sin| ist
  // nicht 0) -- ein Hochpass mit sehr niedrigem Cutoff entfernt ihn wieder,
  // ohne den hörbaren Klanganteil zu beeinflussen.
  const dcBlocker = new Tone.Filter({ frequency: 20, type: "highpass", Q: 0 });

  sineCore.connect(evenShaper);
  evenShaper.connect(dcBlocker);

  const cvAmt = new Tone.Gain(data.cvAmount);
  cvAmt.connect(osc.frequency);
  cvAmt.connect(sineCore.frequency); // beide Kerne folgen derselben CV

  return {
    type: "evenvco",
    osc,
    sineCore,
    evenShaper,
    dcBlocker,
    cvAmt,
    ins: { cv: cvAmt },
    outs: { main: osc, even: dcBlocker },
  };
}

export function updateEvenVcoNode(
  entry: EvenVcoEntry,
  patch: Partial<EvenVcoData>,
): void {
  if (patch.frequency !== undefined) {
    entry.osc.frequency.rampTo(patch.frequency, RAMP);
    entry.sineCore.frequency.rampTo(patch.frequency, RAMP);
  }
  if (patch.waveform !== undefined) {
    entry.osc.type = patch.waveform;
  }
  if (patch.cvAmount !== undefined) {
    entry.cvAmt.gain.rampTo(patch.cvAmount, RAMP);
  }
  if (patch.running !== undefined) {
    if (patch.running) {
      entry.osc.start();
      entry.sineCore.start();
    } else {
      entry.osc.stop();
      entry.sineCore.stop();
    }
  }
}

export function disposeEvenVcoNode(entry: EvenVcoEntry): void {
  entry.osc.dispose();
  entry.sineCore.dispose();
  entry.evenShaper.dispose();
  entry.dcBlocker.dispose();
  entry.cvAmt.dispose();
}

/* ---------- UI-Seite ---------- */

const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: "Sin",
  triangle: "Tri",
  sawtooth: "Saw",
  square: "Sqr",
};

export default function EvenVcoNode({ id, data }: NodeProps<EvenVcoFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<EvenVcoData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const BASE_FREQUENCY = 440; // A4 als Referenz bei Oktave-Index 5 (Mitte von 0-11)

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
        onChange={(octave) =>
          patch({ octave, frequency: BASE_FREQUENCY * Math.pow(2, octave - 5) })
        }
      />
      <Knob
        label="Frequenz"
        value={data.frequency}
        min={40}
        max={1600}
        step={1}
        log
        format={(v) => `${v} Hz`}
        onChange={(frequency) => patch({ frequency })}
      />
      <div className={`${styles.row} ${styles.rowGap}`}>
        {WAVEFORMS.map((w) => (
          <button
            key={w}
            className={`${styles.chip} ${data.waveform === w ? styles.chipActive : ""}`}
            onClick={() => patch({ waveform: w })}
          >
            {WAVEFORM_LABELS[w]}
          </button>
        ))}
      </div>
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
        <span className={styles.ioLabel}>Main</span>
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          style={{ top: "70%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Even</span>
        <Handle
          type="source"
          position={Position.Right}
          id="even"
          style={{ top: "85%" }}
        />
      </div>
    </div>
  );
}
