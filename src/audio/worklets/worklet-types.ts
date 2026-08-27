// audio/worklets/worklet-types.ts
export {}; // macht diese Datei explizit zu einem Modul, kein globales Leaken

declare global {
  const sampleRate: number;

  interface AudioParamDescriptor {
    name: string;
    defaultValue?: number;
    minValue?: number;
    maxValue?: number;
    automationRate?: "a-rate" | "k-rate";
  }

  class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor(options?: unknown);
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ): boolean;
  }

  function registerProcessor(
    name: string,
    processorCtor: (new (options?: unknown) => AudioWorkletProcessor) & {
      parameterDescriptors?: AudioParamDescriptor[];
    },
  ): void;
}
