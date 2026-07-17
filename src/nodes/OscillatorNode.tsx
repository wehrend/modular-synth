// OscillatorNode.tsx
// Quelle: ein Tone.Oscillator mit Frequenz, Wellenform und An/Aus.

import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import Knob from '../Knob';
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
    <div className={`module module--osc ${data.running ? 'is-running' : ''}`}>
      <header className="module__head">
        <span className="module__title">VCO</span>
        <button
          className={`power ${data.running ? 'power--on' : ''}`}
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

      <div className="module__row module__row--gap">
        {WAVEFORMS.map((w) => (
          <button
            key={w}
            className={`chip ${data.waveform === w ? 'chip--active' : ''}`}
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
