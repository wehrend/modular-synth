// EvenVcoNode.tsx
import * as Tone from "tone";
import { connect as toneConnect } from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import RotarySwitch from "../components/RotarySwitch";
import { updateAudioNode } from "../audio";
import type { EvenVcoData, EvenVcoFlowNode } from "../types";
import baseStyles from "./Module.module.scss";
import styles from "./EvenVcoNode.module.scss";
import * as SAC from "standardized-audio-context";
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
  syncIn: Tone.Gain; // ← NEU (1)
  sineOut: Tone.Gain;
  triangleOut: Tone.Gain;
  sawtoothOut: Tone.Gain;
  squareOut: Tone.Gain;
  evenOut: Tone.Gain;
  workletNode: AudioWorkletNode | null;
  pendingPatch: Partial<EvenVcoData>;
  currentData: EvenVcoData;
  ins: { masterCv: Tone.Gain; slaveFm: Tone.Gain; sync: Tone.Gain }; // ← ERWEITERT (2)
  outs: {
    sine: Tone.ToneAudioNode;
    triangle: Tone.ToneAudioNode;
    sawtooth: Tone.ToneAudioNode;
    square: Tone.ToneAudioNode;
    even: Tone.ToneAudioNode;
  };
};

let workletModulePromise: Promise<void> | null = null;

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
  const safeValue = Number.isFinite(value) ? value : param.defaultValue;
  param.linearRampToValueAtTime(
    safeValue,
    Tone.getContext().currentTime + RAMP,
  );
}

export function createEvenVcoNode(
  _id: string,
  data: EvenVcoData,
): EvenVcoEntry {
  const masterCvIn = new Tone.Gain(1);
  const slaveFmIn = new Tone.Gain(1);
  const syncIn = new Tone.Gain(1); // ← NEU (3)
  const sineOut = new Tone.Gain(1);
  const triangleOut = new Tone.Gain(1);
  const sawtoothOut = new Tone.Gain(1);
  const squareOut = new Tone.Gain(1);
  const evenOut = new Tone.Gain(1);

  const entry: EvenVcoEntry = {
    type: "evenvco",
    masterCvIn,
    slaveFmIn,
    syncIn, // ← NEU (4)
    sineOut,
    triangleOut,
    sawtoothOut,
    squareOut,
    evenOut,
    workletNode: null,
    pendingPatch: {},
    currentData: data,
    ins: { masterCv: masterCvIn, slaveFm: slaveFmIn, sync: syncIn }, // ← ERWEITERT
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
      if (!SAC.AudioWorkletNode) {
        throw new Error(
          "AudioWorkletNode wird von diesem Browser nicht unterstützt.",
        );
      }
      const AudioWorkletNodeCtor = SAC.AudioWorkletNode;
      if (!AudioWorkletNodeCtor) {
        throw new Error(
          "AudioWorkletNode wird von diesem Browser nicht unterstützt.",
        );
      }

      const node = new AudioWorkletNodeCtor(
        context as unknown as SAC.IAudioContext,
        WORKLET_NAME,
        {
          numberOfInputs: 3,
          numberOfOutputs: 5,
          outputChannelCount: [1, 1, 1, 1, 1],
          channelCount: 1,
          channelCountMode: "explicit",
        },
      ) as unknown as AudioWorkletNode;
      const initial: EvenVcoData = { ...data, ...entry.pendingPatch };
      setParam(node, "masterFreq", computeMasterFrequency(initial));
      setParam(node, "slaveFreq", initial.slaveFreq);
      setParam(node, "masterCvAmount", initial.masterCvAmount);
      setParam(node, "fmAmount", initial.fmAmount);

      toneConnect(masterCvIn, node, 0, 0);
      toneConnect(slaveFmIn, node, 0, 1);
      toneConnect(syncIn, node, 0, 2); // ← NEU (6)
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
  // kein eigener patch-Fall für "sync" nötig -- es ist ein reiner Audio-
  // Eingang ohne zugehörigen Regler/Parameter, wie ins.cv bei anderen
  // Modulen auch keinen "amount" braucht, wenn nur das rohe Signal zählt.
}

export function disposeEvenVcoNode(entry: EvenVcoEntry): void {
  entry.masterCvIn.dispose();
  entry.slaveFmIn.dispose();
  entry.syncIn.dispose(); // ← NEU
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
    <div className={`${baseStyles.module} ${styles.evenVcoModule}`}>
      <header className={baseStyles.head}>
        <span className={baseStyles.title}>{t("modules.evenvco.title")}</span>
      </header>

      <div className={styles.bodyGrid}>
        {/* Zeile 1: CV (Ganz links) | Octave & Fine (Mitte) | Sin (Ganz rechts) */}
        <div className={styles.leftIn}>
          <Handle type="target" position={Position.Left} id="masterCv" />
          <span className={baseStyles.ioLabel}>
            {t("modules.evenvco.cvLabel")}
          </span>
        </div>

        <div className={styles.centerControls}>
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

        <div className={styles.rightOut}>
          <span className={baseStyles.ioLabel}>Sin</span>
          <Handle type="source" position={Position.Right} id="sine" />
        </div>

        {/* Zeile 2: FM (Ganz links) | CV-Amount & Slave (Mitte) | Tri (Ganz rechts) */}
        <div className={styles.leftIn}>
          <Handle type="target" position={Position.Left} id="slaveFm" />
          <span className={baseStyles.ioLabel}>
            {t("modules.evenvco.fmLabel")}
          </span>
        </div>

        <div className={styles.centerControls}>
          <Knob
            label={t("modules.evenvco.cvAmountLabel")}
            value={data.masterCvAmount}
            min={0}
            max={5000}
            step={10}
            format={(v) => `±${v}`}
            onChange={(masterCvAmount) => patch({ masterCvAmount })}
          />
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
        </div>

        <div className={styles.rightOut}>
          <span className={baseStyles.ioLabel}>Tri</span>
          <Handle type="source" position={Position.Right} id="triangle" />
        </div>

        {/* Zeile 3: Sync (Ganz links) | FM-Amount (Mitte) | Saw (Ganz rechts) */}
        <div className={styles.leftIn}>
          <Handle type="target" position={Position.Left} id="sync" />
          <span className={baseStyles.ioLabel}>
            {t("modules.evenvco.syncLabel")}
          </span>
        </div>

        <div className={styles.centerControls}>
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

        <div className={styles.rightOut}>
          <span className={baseStyles.ioLabel}>Saw</span>
          <Handle type="source" position={Position.Right} id="sawtooth" />
        </div>

        {/* Zeile 4: Leer (Links) | Leer (Mitte) | Sqr (Ganz rechts) */}
        <div />
        <div />
        <div className={styles.rightOut}>
          <span className={baseStyles.ioLabel}>Sqr</span>
          <Handle type="source" position={Position.Right} id="square" />
        </div>

        {/* Zeile 5: Leer (Links) | Leer (Mitte) | Even (Ganz rechts) */}
        <div />
        <div />
        <div className={styles.rightOut}>
          <span className={baseStyles.ioLabel}>Even</span>
          <Handle type="source" position={Position.Right} id="even" />
        </div>
      </div>
    </div>
  );
}
