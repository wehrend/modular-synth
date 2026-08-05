import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../Knob";
import { updateAudioNode, VcfEntry } from "../audio";
import type { VcfData, VcfFlowNode } from "../types";
import styles from "./Module.module.scss";
import * as Tone from "tone";

// const FILTER_TYPES: ReadonlyArray<{ value: FilterType; label: string }> = [
//   { value: "lowpass", label: "LP" },
//   { value: "highpass", label: "HP" },
//   { value: "bandpass", label: "BP" },
// ];

export default function FilterNode({ id, data }: NodeProps<VcfFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VcfData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className="module module--vcf">
      <header className="module__head">
        <span className={styles.title}>VCF</span>
      </header>

      {/* Audio-Eingang */}
      <div className="io-row">
        <Handle type="target" position={Position.Left} id="in" />
        <span className="module__label">In</span>
      </div>

      {/* Hauptregler */}
      <div className="module__row module__row--gap">
        <Knob
          label="Cutoff"
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
          label="Resonanz"
          value={data.resonance}
          min={0}
          max={15}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(resonance) => patch({ resonance })}
        />
      </div>

      {/* CV-Eingang 1: Cutoff */}
      <div className="io-row">
        <Handle type="target" position={Position.Left} id="cutoff" />
        <span className="module__label">Cutoff CV</span>
        <Knob
          label="Hub"
          value={data.cutoffAmount}
          min={0}
          max={5000}
          step={10}
          format={(v) => `±${v}`}
          onChange={(cutoffAmount) => patch({ cutoffAmount })}
        />
      </div>

      {/* CV-Eingang 2: Resonanz */}
      <div className="io-row">
        <Handle type="target" position={Position.Left} id="resonance" />
        <span className="module__label">Res CV</span>
        <Knob
          label="Hub"
          value={data.resonanceAmount}
          min={0}
          max={10}
          step={0.1}
          format={(v) => `±${v.toFixed(1)}`}
          onChange={(resonanceAmount) => patch({ resonanceAmount })}
        />
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function createFilterNode(_id: string, data: VcfData): VcfEntry {
  const filter = new Tone.Filter({
    frequency: data.cutoff,
    Q: data.resonance,
    type: data.filterType,
  });
  // CV-Eingänge: Attenuator-Gain → Parameter-Signal
  const cutoffAmt = new Tone.Gain(data.cutoffAmount);
  cutoffAmt.connect(filter.frequency);
  const resAmt = new Tone.Gain(data.resonanceAmount);
  resAmt.connect(filter.Q);

  return {
    type: "vcf",
    filter,
    ins: {
      in: filter, // Audio-Eingang
      cutoff: cutoffAmt, // CV-Eingang 1  ← DAS sind die beiden
      resonance: resAmt, // CV-Eingang 2  ← Eingänge
    },
    out: filter,
  };
}

export function updateFilterNode(
  node: VcfEntry,
  patch: Partial<VcfData>,
): void {
  if (patch.cutoff !== undefined) {
    node.filter.frequency.value = patch.cutoff;
  }
  if (patch.resonance !== undefined) {
    node.filter.Q.value = patch.resonance;
  }
  if (patch.cutoffAmount !== undefined) {
    node.ins.cutoff.gain.value = patch.cutoffAmount;
  }
  if (patch.resonanceAmount !== undefined) {
    node.ins.resonance.gain.value = patch.resonanceAmount;
  }
}

export function disposeFilterNode(node: VcfEntry) {
  node.ins.cutoff.dispose();
  node.ins.resonance.dispose();
  node.filter.dispose(); // ins.in ist der Filter selbst — nicht doppelt disposen
}
