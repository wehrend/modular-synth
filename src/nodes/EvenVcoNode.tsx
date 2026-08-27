// EvenVcoNode.tsx
import * as Tone from "tone";
import { connect as toneConnect } from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import RotarySwitch from "../components/RotarySwitch";
import { updateAudioNode } from "../audio";
import type { EvenVcoData, EvenVcoFlowNode } from "../types";
import styles from "./Module.module.scss";

const RAMP = 0.04;
const WORKLET_NAME = "evenvco-processor";
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

type EvenVcoParam = "masterFreq" | "slaveFreq" | "masterCvAmount" | "fmAmount";

function computeMasterFrequency(data: EvenVcoData): number {
  const octave = data.octave ?? 5;
  const fineTune = data.fineTune ?? 0;
  return BASE_FREQUENCY * Math.pow(2, octave - 5) + fineTune;
}

/* ---------- Audio-Seite ---------- */

export type EvenVcoEntry = {
  type: "evenvco";
  masterCvIn: Tone.Gain;
  slaveFmIn: Tone.Gain;
  sineOut: Tone.Gain;
  triangleOut: Tone.Gain;
  sawtoothOut: Tone.Gain;
  squareOut: Tone.Gain;
  evenOut: Tone.Gain;
  workletNode: AudioWorkletNode | null;
  // Patches, die eintreffen bevor das Worklet-Modul geladen ist, werden
  // hier zwischengespeichert und beim Verbinden nachgeholt -- sonst gehen
  // schnelle Knob-Drehungen im Ladefenster (typ. < 50ms) verloren.
  pendingPatch: Partial<EvenVcoData>;
  currentData: EvenVcoData;
  ins: { masterCv: Tone.Gain; slaveFm: Tone.Gain };
  outs: {
    sine: Tone.ToneAudioNode;
    triangle: Tone.ToneAudioNode;
    sawtooth: Tone.ToneAudioNode;
    square: Tone.ToneAudioNode;
    even: Tone.ToneAudioNode;
  };
};

let workletModulePromise: Promise<void> | null = null;

/** Lädt das Worklet-Modul genau einmal pro AudioContext. */
function loadEvenVcoWorklet(): Promise<void> {
  if (!workletModulePromise) {
    const url = new URL(
      "../audio/worklets/evenvco-processor.ts",
      import.meta.url,
    );
    const context = Tone.getContext().rawContext as unknown as AudioContext;
    workletModulePromise = context.audioWorklet.addModule(url.href);
  }
  return workletModulePromise;
}

function setParam(
  node: AudioWorkletNode,
  name: EvenVcoParam,
  value: number,
): void {
  const param = node.parameters.get(name);
  if (!param) return;
  param.linearRampToValueAtTime(value, Tone.getContext().currentTime + RAMP);
}

export function createEvenVcoNode(
  _id: string,
  data: EvenVcoData,
): EvenVcoEntry {
  // Sofort echte Tone-Gains zurückgeben -- createAudioNode() in der Registry
  // läuft synchron beim App-Start, vor jeder Nutzergeste. Das Worklet-Modul
  // lädt async im Hintergrund und wird nachträglich dazwischengehängt;
  // bis dahin bleibt der Pfad stumm statt zu blockieren oder zu werfen.
  const masterCvIn = new Tone.Gain(1);
  const slaveFmIn = new Tone.Gain(1);
  const sineOut = new Tone.Gain(1);
  const triangleOut = new Tone.Gain(1);
  const sawtoothOut = new Tone.Gain(1);
  const squareOut = new Tone.Gain(1);
  const evenOut = new Tone.Gain(1);

  const entry: EvenVcoEntry = {
    type: "evenvco",
    masterCvIn,
    slaveFmIn,
    sineOut,
    triangleOut,
    sawtoothOut,
    squareOut,
    evenOut,
    workletNode: null,
    pendingPatch: {},
    currentData: data,
    ins: { masterCv: masterCvIn, slaveFm: slaveFmIn },
    outs: {
      sine: sineOut,
      triangle: triangleOut,
      sawtooth: sawtoothOut,
      square: squareOut,
      even: evenOut,
    },
  };

  loadEvenVcoWorklet()
    .then(() => {
      const context = Tone.getContext().rawContext as unknown as AudioContext;
      const node = new AudioWorkletNode(context, WORKLET_NAME, {
        numberOfInputs: 2,
        numberOfOutputs: 5,
        outputChannelCount: [1, 1, 1, 1, 1],
        channelCount: 1,
        channelCountMode: "explicit",
      });

      const initial: EvenVcoData = { ...data, ...entry.pendingPatch };
      setParam(node, "masterFreq", computeMasterFrequency(initial));
      setParam(node, "slaveFreq", initial.slaveFreq);
      setParam(node, "masterCvAmount", initial.masterCvAmount);
      setParam(node, "fmAmount", initial.fmAmount);

      toneConnect(masterCvIn, node, 0, 0);
      toneConnect(slaveFmIn, node, 0, 1);
      toneConnect(node, sineOut, 0, 0);
      toneConnect(node, triangleOut, 1, 0);
      toneConnect(node, sawtoothOut, 2, 0);
      toneConnect(node, squareOut, 3, 0);
      toneConnect(node, evenOut, 4, 0);

      entry.workletNode = node;
      entry.pendingPatch = {};
    })
    .catch((err) => {
      console.error("EvenVco-Worklet konnte nicht geladen werden:", err);
    });

  return entry;
}

export function updateEvenVcoNode(
  entry: EvenVcoEntry,
  patch: Partial<EvenVcoData>,
): void {
  entry.currentData = { ...entry.currentData, ...patch };

  if (!entry.workletNode) {
    entry.pendingPatch = { ...entry.pendingPatch, ...patch };
    return;
  }
  if (patch.octave !== undefined || patch.fineTune !== undefined) {
    setParam(
      entry.workletNode,
      "masterFreq",
      computeMasterFrequency(entry.currentData),
    );
  }
  if (patch.slaveFreq !== undefined) {
    setParam(entry.workletNode, "slaveFreq", patch.slaveFreq);
  }
  if (patch.masterCvAmount !== undefined) {
    setParam(entry.workletNode, "masterCvAmount", patch.masterCvAmount);
  }
  if (patch.fmAmount !== undefined) {
    setParam(entry.workletNode, "fmAmount", patch.fmAmount);
  }
}

export function disposeEvenVcoNode(entry: EvenVcoEntry): void {
  entry.masterCvIn.dispose();
  entry.slaveFmIn.dispose();
  entry.sineOut.dispose();
  entry.triangleOut.dispose();
  entry.sawtoothOut.dispose();
  entry.squareOut.dispose();
  entry.evenOut.dispose();
  entry.workletNode?.disconnect();
  entry.workletNode?.port.close();
}

/* ---------- UI-Seite ---------- */

export default function EvenVcoNode({ id, data }: NodeProps<EvenVcoFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<EvenVcoData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.evenvco.title")}</span>
      </header>

      <div className={styles.row}>
        <RotarySwitch
          positions={12}
          value={data.octave}
          labels={OCTAVE_LABELS}
          onChange={(octave) => patch({ octave })}
        />
        <Knob
          label={t("modules.evenvco.fineLabel")}
          value={data.fineTune}
          min={-20}
          max={20}
          step={0.1}
          format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} Hz`}
          onChange={(fineTune) => patch({ fineTune })}
        />
      </div>

      <Knob
        label={t("modules.evenvco.slaveLabel")}
        value={data.slaveFreq}
        min={20}
        max={2000}
        step={1}
        log
        format={(v) => `${v} Hz`}
        onChange={(slaveFreq) => patch({ slaveFreq })}
      />

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="masterCv" />
        <span className={styles.ioLabel}>{t("modules.evenvco.cvLabel")}</span>
        <Knob
          label={t("modules.evenvco.cvAmountLabel")}
          value={data.masterCvAmount}
          min={0}
          max={5000}
          step={10}
          format={(v) => `±${v}`}
          onChange={(masterCvAmount) => patch({ masterCvAmount })}
        />
      </div>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="slaveFm" />
        <span className={styles.ioLabel}>{t("modules.evenvco.fmLabel")}</span>
        <Knob
          label={t("modules.evenvco.fmAmountLabel")}
          value={data.fmAmount}
          min={0}
          max={5000}
          step={10}
          format={(v) => `±${v}`}
          onChange={(fmAmount) => patch({ fmAmount })}
        />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Sin</span>
        <Handle
          type="source"
          position={Position.Right}
          id="sine"
          style={{ top: "55%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Tri</span>
        <Handle
          type="source"
          position={Position.Right}
          id="triangle"
          style={{ top: "65%" }}
        />
      </div>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Saw</span>
        <Handle
          type="source"
          position={Position.Right}
          id="sawtooth"
          style={{ top: "75%" }}
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
          style={{ top: "95%" }}
        />
      </div>
    </div>
  );
}
