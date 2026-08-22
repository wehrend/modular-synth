import { Edge } from "@xyflow/react";
import { AppNode } from "./types";

export const initialNodes: AppNode[] = [
  {
    id: "osc-1",
    type: "osc",
    position: { x: 40, y: 60 },
    // defaultPatch.tsx
    data: { frequency: 220, waveform: "sawtooth", running: true, cvAmount: 1 },
  },
  {
    id: "lfo-1",
    type: "lfo",
    position: { x: 40, y: 477 },
    data: { rate: 3, waveform: "sine" },
  },
  {
    id: "vcf-1",
    type: "vcf",
    position: { x: 340, y: 160 },
    data: {
      cutoff: 1500,
      resonance: 3,
      filterType: "lowpass",
      cutoffAmount: 1200,
      resonanceAmount: 1,
    },
  },
  {
    id: "envelope-1",
    type: "envelope",
    position: { x: 660, y: 200 },
    data: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
  },
  {
    id: "out-1",
    type: "out",
    position: { x: 960, y: 220 },
    data: { volume: -12, muted: false },
    deletable: false,
  },
];

export const initialEdges: Edge[] = [
  {
    id: "e-osc-vcf",
    source: "osc-1",
    target: "vcf-1",
    targetHandle: "in",
    animated: true,
  },
  {
    id: "e-lfo-vcf",
    source: "lfo-1",
    target: "vcf-1",
    targetHandle: "cutoff",
    animated: true,
  },
  {
    id: "e-vcf-env",
    source: "vcf-1",
    sourceHandle: "out",
    target: "envelope-1",
    targetHandle: "in",
    animated: true,
  },
  {
    id: "e-env-outL",
    source: "envelope-1",
    sourceHandle: "out",
    target: "out-1",
    targetHandle: "inL",
    animated: true,
  },
  {
    id: "e-env-outR",
    source: "envelope-1",
    sourceHandle: "out",
    target: "out-1",
    targetHandle: "inR",
    animated: true,
  },
];
