// audio/worklets/wasp-processor.ts
// Zustandsbehaftete Schaltungssimulation der Wasp-Filterstufe: 3 self-biased
// CMOS-Inverter (Summierer + 2 Integratoren), jeder als eigener KCL-Knoten
// mit MOSFET-Square-Law-Strömen und Kondensator-Zustand (Backward-Euler-
// Companion-Modell), pro Sample per 1D-Newton-Raphson gelöst. Die
// Resonanz-Rückkopplung ist ein geschlossener Regelkreis, der über
// Gauss-Seidel-Relaxation (3 Durchläufe/Sample) angenähert wird -- kein
// echtes analytisches Zero-Delay-Feedback über alle 3 Knoten gleichzeitig,
// aber ein deutlich näherer Ansatz als ein Feedback-Delay im Audiographen.
//
// Bauteilwerte sind Startwerte zum Tuning, keine Schaltplan-Übernahme.
//
// Diese Datei läuft NIE im normalen DOM-Scope -- sie wird separat über
// context.audioWorklet.addModule() geladen (s. loadWaspWorklet() in
// WaspNode.tsx). TypeScripts lib.dom kennt den AudioWorkletGlobalScope
// nicht, deshalb die folgenden lokalen Ambient-Deklarationen, rein damit
// `tsc --noEmit` diese Datei mitprüfen kann.

declare const sampleRate: number;

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: "a-rate" | "k-rate";
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: unknown) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  },
): void;

/* eslint-disable no-restricted-globals -- sampleRate ist im AudioWorkletGlobalScope korrekt global */

const VDD = 5; // unipolare Versorgung wie im Original
const VBIAS = VDD / 2; // Arbeitspunkt, um den herum sich self-biased Inverter einpendeln

// MOSFET-Square-Law-Parameter. PMOS bewusst schwächer als NMOS (Grund-
// asymmetrie realer CMOS-Prozesse) -- das ist die eigentliche Ursache der
// charakteristischen Schieflage, nicht ein manuell aufgeprägter "drive"-Knob.
const VTN = 1.4;
const VTP = -1.4;
const BETA_N = 0.0026;
const BETA_P = 0.0017;

// Feste Integrationskapazitäten der 3 Stufen (Summierer hat kleinere Zeit-
// konstante als die beiden Cutoff-Integratoren).
const C_STAGE_A = 220e-12;
const C_STAGE_BC = 1e-9;

// Fester Gegenkopplungswiderstand der Summierstufe (kein Cutoff-Einfluss).
const R_STAGE_A = 220e3;

// Self-Bias-Widerstand der beiden Integratorstufen -- bewusst groß, damit
// seine Leitfähigkeit (1/R) klein gegen die Kondensator-Ersatzleitfähigkeit
// (C/T, s. solveStage) bleibt. Er zentriert den Arbeitspunkt nur schwach,
// beeinflusst den Filterpol praktisch nicht. Der Cutoff wirkt stattdessen
// über gmScale direkt auf den Inverter-/OTA-Strom, s. FC_REF unten -- das
// entspricht dem echten Wasp, der den Cutoff per OTA-Transkonduktanz statt
// per variablem Widerstand steuert.
const R_STAGE_BC = 2.2e6;

// Referenzfrequenz für die Transkonduktanz-Skalierung der Integratorstufen:
// bei cutoff === FC_REF ist gmScale === 1 (unveränderter Inverterstrom).
const FC_REF = 1000;
const GM_SCALE_MIN = 0.02;
const GM_SCALE_MAX = 20;

const INPUT_SCALE = 1.4; // Volt pro normalisierter Audio-Einheit (±1 -> ±1.4V um VBIAS)
const RES_GAIN_MAX = 3.2; // Rückkopplungsverstärkung bei resonance = 1
const DRIVE_RANGE = 0.9; // max. Arbeitspunkt-Verschiebung durch "drive" in Volt

const NR_ITERATIONS = 8;
const NR_EPS = 1e-4;
const RELAX_PASSES = 3;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Netto-Strom (PMOS minus NMOS), der in den Ausgangsknoten fließt, skaliert
 * um `gain` -- das ist der OTA-Transkonduktanz-Hebel, über den der Cutoff
 * die Integratorstufen steuert (s. FC_REF/gmScale in process()).
 */
function inverterCurrent(vin: number, vout: number, gain = 1): number {
  let iN = 0;
  if (vin > VTN) {
    const vov = vin - VTN;
    const vds = vout;
    iN =
      vds < vov
        ? BETA_N * (vov * vds - 0.5 * vds * vds) // Triode
        : 0.5 * BETA_N * vov * vov; // Sättigung
  }

  let iP = 0;
  const vsgP = VDD - vin;
  if (vsgP > -VTP) {
    const vov = vsgP + VTP;
    const vsd = VDD - vout;
    iP =
      vsd < vov
        ? BETA_P * (vov * vsd - 0.5 * vsd * vsd)
        : 0.5 * BETA_P * vov * vov;
  }

  return (iP - iN) * gain;
}

/**
 * Löst die KCL-Gleichung einer Stufe für den neuen Ausgangsknoten:
 *   I_inverter(vin, vout) - (vout - VBIAS)/R - C/T * (vout - voutPrev) = 0
 * per gedämpftem 1D-Newton-Raphson (numerische Ableitung).
 */
function solveStage(
  vin: number,
  voutPrev: number,
  r: number,
  c: number,
  t: number,
  currentGain = 1,
): number {
  const geq = c / t;
  let vout = voutPrev;

  const residual = (v: number) =>
    inverterCurrent(vin, v, currentGain) - (v - VBIAS) / r - geq * (v - voutPrev);

  for (let iter = 0; iter < NR_ITERATIONS; iter++) {
    const f = residual(vout);
    const df = (residual(vout + NR_EPS) - residual(vout - NR_EPS)) / (2 * NR_EPS);
    if (Math.abs(df) < 1e-9) break;

    let step = f / df;
    step = clamp(step, -0.5, 0.5); // Dämpfung gegen Überschwingen an steilen Flanken
    vout -= step;
    if (Math.abs(step) < 1e-6) break;
  }

  return clamp(vout, 0, VDD);
}

class WaspCircuitProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: "cutoff", defaultValue: 1200, minValue: 20, maxValue: 15000, automationRate: "k-rate" },
      { name: "resonance", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "drive", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "cutoffAmount", defaultValue: 0, minValue: 0, maxValue: 5000, automationRate: "k-rate" },
    ];
  }

  private vA = VBIAS;
  private vB = VBIAS;
  private vC = VBIAS;

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const audioIn = inputs[0]?.[0];
    const cvIn = inputs[1]?.[0];
    const out = outputs[0]?.[0];
    if (!audioIn || !out) return true;

    const cutoffParam = parameters.cutoff[0];
    const resonance = parameters.resonance[0];
    const drive = parameters.drive[0];
    const cutoffAmount = parameters.cutoffAmount[0];
    const t = 1 / sampleRate;
    const driveOffset = drive * DRIVE_RANGE;
    const resGain = resonance * RES_GAIN_MAX;

    for (let i = 0; i < audioIn.length; i++) {
      const cv = cvIn ? cvIn[i] : 0;
      const fc = clamp(cutoffParam + cutoffAmount * cv, 20, 15000);
      // OTA-Transkonduktanz-Hebel statt Widerstands-Sweep -- s. Kommentar
      // bei R_STAGE_BC weiter oben.
      const gmScale = clamp(fc / FC_REF, GM_SCALE_MIN, GM_SCALE_MAX);

      let vA = this.vA;
      let vB = this.vB;
      let vC = this.vC;

      for (let pass = 0; pass < RELAX_PASSES; pass++) {
        const vinA =
          VBIAS + audioIn[i] * INPUT_SCALE + driveOffset + resGain * (vC - VBIAS);
        vA = solveStage(vinA, this.vA, R_STAGE_A, C_STAGE_A, t);
        vB = solveStage(vA, this.vB, R_STAGE_BC, C_STAGE_BC, t, gmScale);
        vC = solveStage(vB, this.vC, R_STAGE_BC, C_STAGE_BC, t, gmScale);
      }

      this.vA = vA;
      this.vB = vB;
      this.vC = vC;

      out[i] = (vC - VBIAS) / INPUT_SCALE;
    }

    return true;
  }
}

registerProcessor("wasp-circuit-processor", WaspCircuitProcessor);