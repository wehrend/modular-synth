// OutputNode.tsx
// Senke: Tone.Volume → Lautsprecher (Destination).

import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import Knob from '../Knob';
import { updateAudioNode } from '../audio';
import type { OutData, OutFlowNode } from '../types';

export default function OutputNode({ id, data }: NodeProps<OutFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<OutData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className="module module--out">
      <header className="module__head">
        <span className="module__title">OUT</span>
        <button
          className={`power ${data.muted ? '' : 'power--on'}`}
          onClick={() => patch({ muted: !data.muted })}
          aria-label={data.muted ? 'Ton einschalten' : 'Stummschalten'}
        >
          {data.muted ? 'stumm' : 'laut'}
        </button>
      </header>

      <Knob
        label="Pegel"
        value={data.volume}
        min={-48}
        max={0}
        step={1}
        format={(v) => `${v} dB`}
        onChange={(volume) => patch({ volume })}
      />

      <Handle type="target" position={Position.Left} />
    </div>
  );
}
