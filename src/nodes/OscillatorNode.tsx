// OscillatorNode.tsx
// Quelle: ein Tone.Oscillator mit Frequenz, Wellenform und An/Aus.

import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import Knob from '../Knob';
import styles from './Module.module.scss';
import { updateAudioNode } from '../audio';
import { WAVEFORMS, type OscData, type OscFlowNode, type Waveform } from '../types';

const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: 'Sin',
  triangle: 'Tri',
  sawtooth: 'Saw',
  square: 'Sqr',
};

export default function OscillatorNode({ id, data }: NodeProps<OscFlowNode>) {
  const { updateNodeData } = useReactFlow();

  // UI-State und Audiograph immer gemeinsam aktualisieren
  const patch = (changes: Partial<OscData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className={`${styles.module} ${data.running ? styles.isRunning : ''}`}>
      <header className={styles.head}>
        <span className={styles.title}>VCO</span>
        <button
          className={`${styles.power} ${data.running ? styles.powerOn : ''}`}
          onClick={() => patch({ running: !data.running })}
          aria-label={data.running ? 'Oszillator stoppen' : 'Oszillator starten'}
        >
          {data.running ? 'an' : 'aus'}
        </button>
      </header>

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
            className={`${styles.chip} ${data.waveform === w ? styles.chipActive : ''}`}
            onClick={() => patch({ waveform: w })}
          >
            {WAVEFORM_LABELS[w]}
          </button>
        ))}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
