import * as Tone from "tone";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import Knob from "../components/Knob";
import { updateAudioNode } from "../audio";
import type { NoiseData, NoiseFlowNode } from "../types";
import styles from "./Module.module.scss";

const RAMP = 0.04;

/* ---------- Audio-Seite ---------- */

export type NoiseEntry = {
  type: "noise";
  white: Tone.Noise;
  pink: Tone.Noise;
  brown: Tone.Noise;
  outs: {
    white: Tone.ToneAudioNode;
    pink: Tone.ToneAudioNode;
    brown: Tone.ToneAudioNode;
  };
};

export function createNoiseNode(_id: string, data: NoiseData): NoiseEntry {
  const white = new Tone.Noise("white");
  white.volume.value = data.whiteVolume;
  white.start();

  const pink = new Tone.Noise("pink");
  pink.volume.value = data.pinkVolume;
  pink.start();

  const brown = new Tone.Noise("brown");
  brown.volume.value = data.brownVolume;
  brown.start();

  return {
    type: "noise",
    white,
    pink,
    brown,
    outs: { white, pink, brown },
  };
}

export function updateNoiseNode(
  entry: NoiseEntry,
  patch: Partial<NoiseData>,
): void {
  if (patch.whiteVolume !== undefined)
    entry.white.volume.rampTo(patch.whiteVolume, RAMP);
  if (patch.pinkVolume !== undefined)
    entry.pink.volume.rampTo(patch.pinkVolume, RAMP);
  if (patch.brownVolume !== undefined)
    entry.brown.volume.rampTo(patch.brownVolume, RAMP);
}

export function disposeNoiseNode(entry: NoiseEntry): void {
  entry.white.dispose();
  entry.pink.dispose();
  entry.brown.dispose();
}

/* ---------- UI-Seite ---------- */

export default function NoiseNode({ id, data }: NodeProps<NoiseFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<NoiseData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={styles.module}>
      <header className={styles.head}>
        <span className={styles.title}>NOISE</span>
      </header>
      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>White</span>
        <Knob
          label="Vol"
          value={data.whiteVolume}
          min={-48}
          max={0}
          step={1}
          format={(v) => `${v} dB`}
          onChange={(whiteVolume) => patch({ whiteVolume })}
        />
        <Handle type="source" position={Position.Right} id="white" />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Pink</span>
        <Knob
          label="Vol"
          value={data.pinkVolume}
          min={-48}
          max={0}
          step={1}
          format={(v) => `${v} dB`}
          onChange={(pinkVolume) => patch({ pinkVolume })}
        />
        <Handle type="source" position={Position.Right} id="pink" />
      </div>

      <div className={styles.ioRowOut}>
        <span className={styles.ioLabel}>Brown</span>
        <Knob
          label="Vol"
          value={data.brownVolume}
          min={-48}
          max={0}
          step={1}
          format={(v) => `${v} dB`}
          onChange={(brownVolume) => patch({ brownVolume })}
        />
        <Handle type="source" position={Position.Right} id="brown" />
      </div>
    </div>
  );
}
