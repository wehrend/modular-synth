import { Handle, NodeProps, Position, useReactFlow } from "@xyflow/react";
import { EnvelopeData, EnvelopeFlowNode } from "../types";
import { gateOff, gateOn, updateAudioNode } from "../audio";
import Knob from "../Knob";
import { useEffect, useRef, useState } from "react";

const GATE_KEY = " "; // Leertaste; e.key für Space ist ein Leerzeichen

export default function EnvelopeNode({
  id,
  data,
}: NodeProps<EnvelopeFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const gateHeld = useRef(false); // Wächter gegen Key-Repeat
  const [gateActive, setGateActive] = useState(false); // nur fürs UI

  const patch = (changes: Partial<EnvelopeData>) => {
    updateNodeData(id, changes);
    updateAudioNode(id, changes);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== GATE_KEY || gateHeld.current) return;
      gateHeld.current = true;
      setGateActive(true);
      gateOn(id);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== GATE_KEY) return;
      gateHeld.current = false;
      setGateActive(false);
      gateOff(id);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (gateHeld.current) {
        gateOff(id);
        gateHeld.current = false;
      }
    };
  }, [id]);

  return (
    <div className="module module--adsr">
      <header className="module__head">
        <span className="module__title">ADSR</span>
        <span className={`power ${gateActive ? "power--on" : ""}`}>
          {GATE_KEY === " " ? "Leertaste" : GATE_KEY}
        </span>
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
