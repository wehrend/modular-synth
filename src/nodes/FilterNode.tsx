import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import Knob from '../Knob';
import { updateAudioNode } from '../audio';
import type { FilterType, VcfData, VcfFlowNode } from '../types';

const FILTER_TYPES: ReadonlyArray<{ value: FilterType; label: string }> = [
  { value: 'lowpass', label: 'LP' },
  { value: 'highpass', label: 'HP' },
  { value: 'bandpass', label: 'BP' },
];

export default function FilterNode({ id, data }: NodeProps<VcfFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<VcfData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className="module module--vcf">
      <header className="module__head">
        <span className="module__title">VCF</span>
      </header>

      <div className="module__row module__row--gap">
        <Knob
          label="Cutoff" value={data.cutoff} min={40} max={12000} step={1} log
          format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${v} Hz`)}
          onChange={(cutoff) => patch({ cutoff })}
        />
        <Knob
          label="Resonanz" value={data.resonance} min={0} max={15} step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(resonance) => patch({ resonance })}
        />
      </div>

      <div className="module__row module__row--gap">
        {FILTER_TYPES.map((t) => (
          <button
            key={t.value}
            className={`chip ${data.filterType === t.value ? 'chip--active' : ''}`}
            onClick={() => patch({ filterType: t.value })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}