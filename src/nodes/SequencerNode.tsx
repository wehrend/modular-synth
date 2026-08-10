import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import { updateAudioNode, fireGate } from "../audio";
import type { SequencerData, SequencerFlowNode } from "../types";
import styles from "./Module.module.scss";

/* ---------- Audio-Seite ---------- */

export type SequencerEntry = {
  type: "sequencer";
  loop: Tone.Loop;
  pitchSignal: Tone.Signal<"frequency">;
  stepCount: number;
  out: Tone.ToneAudioNode; // gemeinsamer CV-Ausgang
};

export function createSequencerNode(
  id: string,
  data: SequencerData,
): SequencerEntry {
  let current = 0;

  const pitchSignal = new Tone.Signal({
    units: "frequency",
    value: data.cvValues[0] ?? 220,
  });
  // Vorherigen Ausgang abschalten, aktuellen einschalten -- Ring-Prinzip
  // des CD4017: immer nur EIN Ausgang gleichzeitig "high".
  const loop = new Tone.Loop((time) => {
    const prev = (current - 1 + data.steps) % data.steps;
    fireGate(id, `gate${prev}`, false);
    fireGate(id, `gate${current}`, true);
    const freq = data.cvValues[current] ?? 220;
    console.log("Sequencer step:", { current, freq }); // ← temporär
    pitchSignal.setValueAtTime(data.cvValues[current] ?? 220, time);
    current = (current + 1) % data.steps;
  }, "8n");

  Tone.getTransport().bpm.value = data.bpm;
  if (data.running) {
    loop.start(0);
    Tone.getTransport().start();
  }

  return {
    type: "sequencer",
    loop,
    pitchSignal,
    stepCount: data.steps,
    out: pitchSignal,
  };
}

export function updateSequencerNode(
  entry: SequencerEntry,
  patch: Partial<SequencerData>,
): void {
  if (patch.bpm !== undefined) {
    Tone.getTransport().bpm.rampTo(patch.bpm, 0.1);
  }
  if (patch.running !== undefined) {
    if (patch.running) {
      entry.loop.start(0);
      Tone.getTransport().start();
    } else {
      entry.loop.stop();
    }
  }
  // patch.steps bewusst nicht live -- der Ring-Zähler lebt im Closure,
  // wie schon beim vorherigen Sequencer-Entwurf.
}

export function disposeSequencerNode(entry: SequencerEntry): void {
  entry.loop.dispose();
}

/* ---------- UI-Seite ---------- */

export default function SequencerNode({
  id,
  data,
}: NodeProps<SequencerFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<SequencerData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  const activeOutputs = Array.from({ length: data.steps }, (_, i) => i);

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>Sequencer</span>
        <button
          className={`${styles.power} ${data.running ? styles.powerOn : ""}`}
          onClick={() => patch({ running: !data.running })}
        >
          {data.running ? "läuft" : "aus"}
        </button>
      </header>

      <Knob
        label="BPM"
        value={data.bpm}
        min={40}
        max={240}
        step={1}
        format={(v) => `${v}`}
        onChange={(bpm) => patch({ bpm })}
      />
      {activeOutputs.map((i) => (
        <div className={styles.ioRow} key={i}>
          <span className={styles.ioLabel}>Q{i}</span>
          <Knob
            label="CV"
            value={data.cvValues[i] ?? 220}
            min={40}
            max={1600}
            step={1}
            log
            format={(v) => `${v} Hz`}
            onChange={(v) => {
              const next = [...data.cvValues];
              next[i] = v;
              patch({ cvValues: next });
            }}
          />
          <Handle type="source" position={Position.Right} id={`gate${i}`} />
        </div>
      ))}

      <div className={styles.ioRow}>
        <span className={styles.ioLabel}>CV Out</span>
        <Handle type="source" position={Position.Right} id="cv" />
      </div>
    </div>
  );
}
