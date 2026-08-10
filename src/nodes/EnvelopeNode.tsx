import { Handle, NodeProps, Position, useReactFlow } from "@xyflow/react";
import { EnvelopeData, EnvelopeFlowNode } from "../types";
import { gateOff, gateOn, updateAudioNode } from "../audio";
import Knob from "../components/Knob";
import { useEffect, useRef, useState } from "react";
import styles from "./Module.module.scss";
import * as Tone from "tone";

const GATE_KEY = " "; // Leertaste; e.key für Space ist ein Leerzeichen

type EnvelopeEntry = {
  type: "envelope";
  env: Tone.AmplitudeEnvelope;
  in: Tone.ToneAudioNode;
  out: Tone.ToneAudioNode;
};

export function createEnvelopeNode(
  _id: string,
  data: EnvelopeData,
): EnvelopeEntry {
  const env = new Tone.AmplitudeEnvelope({
    attack: data.attack,
    decay: data.decay,
    sustain: data.sustain,
    release: data.release,
  });
  return { type: "envelope", env, in: env, out: env };
}

export function updateEnvelopeNode(
  node: EnvelopeEntry,
  patch: Partial<EnvelopeData>,
): void {
  const p = patch as Partial<EnvelopeData>;
  // Kein rampTo: A/D/S/R sind gewöhnliche Zahlen-Properties (Form
  // künftiger Verläufe), keine laufenden Audio-Signale
  if (p.attack !== undefined) node.env.attack = p.attack;
  if (p.decay !== undefined) node.env.decay = p.decay;
  if (p.sustain !== undefined) node.env.sustain = p.sustain;
  if (p.release !== undefined) node.env.release = p.release;
}

export function disposeEnvelopeNode(node: EnvelopeEntry) {
  node.env.dispose();
}

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
        <span className={styles.title}>ADSR</span>
        <span className={`power ${gateActive ? "power--on" : ""}`}>
          {GATE_KEY === " " ? "Leertaste" : GATE_KEY}
        </span>
      </header>
      <div className={styles.ioRow}>
        <Handle type="target" position={Position.Left} id="gate" />
        <span className={styles.ioLabel}>Gate</span>
      </div>
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
