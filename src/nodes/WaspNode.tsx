// WaspNode.tsx
import * as Tone from "tone";
import { connect as toneConnect } from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import type { WaspData, WaspFlowNode } from "../types";
import styles from "./Module.module.scss";
import * as SAC from "standardized-audio-context";

const RAMP = 0.04;
const WORKLET_NAME = "wasp-circuit-processor";

type WaspParam = "cutoff" | "resonance" | "drive" | "cutoffAmount";

/* ---------- Audio-Seite ---------- */

export type WaspEntry = {
  type: "wasp";
  inputGain: Tone.Gain;
  cvGain: Tone.Gain;
  outputGain: Tone.Gain;
  workletNode: AudioWorkletNode | null;
  // Patches, die eintreffen bevor das Worklet-Modul geladen ist, werden
  // hier zwischengespeichert und beim Verbinden nachgeholt -- sonst gehen
  // schnelle Knob-Drehungen im Ladefenster (typ. < 50ms) verloren.
  pendingPatch: Partial<WaspData>;
  ins: { in: Tone.Gain; cutoff: Tone.Gain };
  out: Tone.ToneAudioNode;
};

let workletModulePromise: Promise<void> | null = null;

/** Lädt das Worklet-Modul genau einmal pro AudioContext. */
function loadWaspWorklet(): Promise<void> {
  if (!workletModulePromise) {
    const url = new URL("../audio/worklets/wasp-processor.ts", import.meta.url);
    const context = Tone.getContext().rawContext as unknown as AudioContext;
    workletModulePromise = context.audioWorklet.addModule(url.href);
  }
  return workletModulePromise;
}

function setParam(
  node: AudioWorkletNode,
  name: WaspParam,
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

export function createWaspNode(_id: string, data: WaspData): WaspEntry {
  // Sofort echte Tone-Gains zurückgeben -- createAudioNode() in der Registry
  // läuft synchron beim App-Start, vor jeder Nutzergeste. Das Worklet-Modul
  // lädt async im Hintergrund und wird nachträglich dazwischengehängt;
  // bis dahin bleibt der Pfad stumm statt zu blockieren oder zu werfen.
  const inputGain = new Tone.Gain(1);
  const cvGain = new Tone.Gain(1);
  const outputGain = new Tone.Gain(1);

  const entry: WaspEntry = {
    type: "wasp",
    inputGain,
    cvGain,
    outputGain,
    workletNode: null,
    pendingPatch: {},
    ins: { in: inputGain, cutoff: cvGain },
    out: outputGain,
  };

  loadWaspWorklet()
    .then(() => {
      const context = Tone.getContext().rawContext as unknown as AudioContext;
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

      const initial: WaspData = { ...data, ...entry.pendingPatch };
      setParam(node, "cutoff", initial.cutoff);
      setParam(node, "resonance", initial.resonance);
      setParam(node, "drive", initial.drive);
      setParam(node, "cutoffAmount", initial.cutoffAmount);

      toneConnect(inputGain, node, 0, 0);
      toneConnect(cvGain, node, 0, 1);
      toneConnect(node, outputGain);

      entry.workletNode = node;
      entry.pendingPatch = {};
    })
    .catch((err) => {
      console.error("Wasp-Worklet konnte nicht geladen werden:", err);
    });

  return entry;
}

export function updateWaspNode(
  entry: WaspEntry,
  patch: Partial<WaspData>,
): void {
  if (!entry.workletNode) {
    entry.pendingPatch = { ...entry.pendingPatch, ...patch };
    return;
  }
  if (patch.cutoff !== undefined)
    setParam(entry.workletNode, "cutoff", patch.cutoff);
  if (patch.resonance !== undefined)
    setParam(entry.workletNode, "resonance", patch.resonance);
  if (patch.drive !== undefined)
    setParam(entry.workletNode, "drive", patch.drive);
  if (patch.cutoffAmount !== undefined)
    setParam(entry.workletNode, "cutoffAmount", patch.cutoffAmount);
}

export function disposeWaspNode(entry: WaspEntry): void {
  entry.inputGain.dispose();
  entry.cvGain.dispose();
  entry.outputGain.dispose();
  entry.workletNode?.disconnect();
  entry.workletNode?.port.close();
}

/* ---------- UI-Seite ---------- */

export default function WaspNode({ id, data }: NodeProps<WaspFlowNode>) {
  const { t } = useTranslation();
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<WaspData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>{t("modules.wasp.title")}</span>
      </header>

      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="in" />
        <span className={styles.ioLabel}>{t("common.in")}</span>
      </div>

      <div className={styles.row}>
        <Knob
          label={t("modules.vcf.cutoffLabel")}
          value={data.cutoff}
          min={40}
          max={12000}
          step={1}
          log
          format={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v} Hz`
          }
          onChange={(cutoff) => patch({ cutoff })}
        />
        <Knob
          label={t("modules.wasp.resonanceLabel")}
          value={data.resonance}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(resonance) => patch({ resonance })}
        />
        <Knob
          label={t("modules.wasp.driveLabel")}
          value={data.drive}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(drive) => patch({ drive })}
        />
      </div>
      <div className={styles.row}>
        <Knob
          label={t("modules.wasp.cvAmountLabel")}
          value={data.cutoffAmount}
          min={0}
          max={5000}
          step={10}
          format={(v) => `±${v}`}
          onChange={(cutoffAmount) => patch({ cutoffAmount })}
        />
      </div>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="cutoff" />
        <span className={styles.ioLabel}>
          {t("modules.wasp.cutoffCvLabel")}
        </span>
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
