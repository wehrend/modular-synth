import { Handle, NodeProps, Position, useReactFlow } from "@xyflow/react";
import { EnvelopeData, EnvelopeFlowNode } from "../types";
import { gateOff, gateOn, updateAudioNode } from "../audio";
import Knob from "../Knob";

export default function EnvelopeNode({
  id,
  data,
}: NodeProps<EnvelopeFlowNode>) {
  const { updateNodeData } = useReactFlow();

  const patch = (changes: Partial<EnvelopeData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  return (
    <div className="module module--adsr">
      <header className="module__head">
        <span className="module__title">ADSR</span>
        <button
          className="power nodrag"
          onPointerDown={() => gateOn(id)}
          onPointerUp={() => gateOff(id)}
          onPointerLeave={() => gateOff(id)}
        >
          gate
        </button>
      </header>

      <div className="module__row module__row--gap">
        <Knob
          label="A"
          value={data.attack}
          min={0.001}
          max={2}
          step={0.001}
          log
          format={(v) => `${(v * 1000).toFixed(0)} ms`}
          onChange={(attack) => patch({ attack })}
        />
        <Knob
          label="D"
          value={data.decay}
          min={0.001}
          max={2}
          step={0.001}
          log
          format={(v) => `${(v * 1000).toFixed(0)} ms`}
          onChange={(decay) => patch({ decay })}
        />
      </div>
      <div className="module__row module__row--gap">
        <Knob
          label="S"
          value={data.sustain}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)} %`}
          onChange={(sustain) => patch({ sustain })}
        />
        <Knob
          label="R"
          value={data.release}
          min={0.001}
          max={5}
          step={0.001}
          log
          format={(v) => `${(v * 1000).toFixed(0)} ms`}
          onChange={(release) => patch({ release })}
        />
      </div>

      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
