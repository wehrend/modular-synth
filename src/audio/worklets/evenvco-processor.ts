// audio/worklets/evenvco-processor.ts
// Even VCO mit eingebautem Hard Sync: Master- und Slave-Oszillator laufen
// als eigene Phasenakkumulatoren (0..1) im Audio-Thread. Bei jedem
// Nulldurchgang des Masters wird die Slave-Phase hart auf 0 gezwungen --
// das ist sample-genauer Hard Sync, im Haupt-Thread nicht nachbaubar.
//
// CV-Eingänge laufen wie bei wasp-processor.ts über Input-Busse mit
// manueller Tiefen-Skalierung, nicht über native AudioParam-Summierung.
//
// Ein dritter Eingang ("sync") erlaubt zusätzlich EXTERNEN Hard Sync:
// ein steigender Nulldurchgang am ankommenden Signal (z.B. ein zweiter
// VCO) resettet den MASTER von außen, dessen Reset pflanzt sich wie
// gewohnt zum Slave fort -- der klassische "Sync In"-Jack, wie ihn
// Hardware-Oszillatoren zusätzlich zum internen Master/Slave anbieten.
//
// Fünf Mono-Ausgänge: die vier klassischen Wellenformen aus der Slave-
// Phase, plus "even" -- Vollweg-Gleichrichtung derselben Phase (|sin(x)|
// enthält mathematisch ausschließlich geradzahlige Harmonische). Weil der
// Even-Ausgang aus der SLAVE-Phase kommt, trägt er die Sync-Zerhackung
// mit -- ein eigenständiges, drittes Timbre zwischen reinem Even-Klang
// und reinem Sync-Sweep.

import "./worklet-types"; // nur für die Ambient-Deklarationen, kein Wert-Import nötig
import { clamp } from "./worklet-utils";
/* eslint-disable no-restricted-globals */

function wrap01(x: number): number {
  return x - Math.floor(x);
}

// Klassische, nicht bandlimitierte Formeln -- etwas Aliasing bei hohen
// Sync-Verhältnissen ist Teil des rauen Sync-Charakters, kein Makel.
function sineWave(phase: number): number {
  return Math.sin(2 * Math.PI * phase);
}
function triangleWave(phase: number): number {
  return 4 * Math.abs(phase - 0.5) - 1;
}
function sawtoothWave(phase: number): number {
  return 2 * phase - 1;
}
function squareWave(phase: number): number {
  return phase < 0.5 ? 1 : -1;
}
// |sin(x)| ist gerad-symmetrisch (f(-x) = f(x)) -> ausschließlich
// geradzahlige Harmonische. *2-1 zentriert das Ergebnis wieder um 0.
function evenWave(phase: number): number {
  return Math.abs(sineWave(phase)) * 2 - 1;
}

class EvenVcoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: "masterFreq",
        defaultValue: 220,
        minValue: 0.01,
        maxValue: 20000,
        automationRate: "k-rate",
      },
      {
        name: "slaveFreq",
        defaultValue: 220,
        minValue: 0.01,
        maxValue: 20000,
        automationRate: "k-rate",
      },
      {
        name: "masterCvAmount",
        defaultValue: 0,
        minValue: 0,
        maxValue: 5000,
        automationRate: "k-rate",
      },
      {
        name: "fmAmount",
        defaultValue: 0,
        minValue: 0,
        maxValue: 5000,
        automationRate: "k-rate",
      },
    ];
  }

  private masterPhase = 0;
  private slavePhase = 0;
  private prevSyncSample = 0; // für Nulldurchgangs-Erkennung am externen Sync-Eingang

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const masterCvIn = inputs[0]?.[0];
    const slaveFmIn = inputs[1]?.[0];
    const syncIn = inputs[2]?.[0]; // neuer, dritter Eingangsbus

    const outSine = outputs[0]?.[0];
    const outTri = outputs[1]?.[0];
    const outSaw = outputs[2]?.[0];
    const outSqr = outputs[3]?.[0];
    const outEven = outputs[4]?.[0];
    if (!outSine) return true;

    const masterFreqBase = parameters.masterFreq[0];
    const slaveFreqBase = parameters.slaveFreq[0];
    const masterCvAmount = parameters.masterCvAmount[0];
    const fmAmount = parameters.fmAmount[0];
    const t = 1 / sampleRate;

    for (let i = 0; i < outSine.length; i++) {
      const masterCv = masterCvIn ? masterCvIn[i] : 0;
      const slaveFm = slaveFmIn ? slaveFmIn[i] : 0;

      const mFreq = clamp(
        masterFreqBase + masterCvAmount * masterCv,
        0.01,
        20000,
      );
      const sFreq = clamp(slaveFreqBase + fmAmount * slaveFm, 0.01, 20000);

      // Externer Sync-Eingang: steigender Nulldurchgang resettet den
      // Master von außen.
      let masterReset = false;
      if (syncIn) {
        const s = syncIn[i];
        if (this.prevSyncSample <= 0 && s > 0) {
          masterReset = true;
        }
        this.prevSyncSample = s;
      }

      const prevMasterPhase = this.masterPhase;
      this.masterPhase = masterReset ? 0 : wrap01(this.masterPhase + mFreq * t);

      // Nulldurchgang erkannt (regulär ODER durch externen Sync erzwungen)
      // -> Slave hart zurücksetzen.
      if (masterReset || this.masterPhase < prevMasterPhase) {
        this.slavePhase = 0;
      } else {
        this.slavePhase = wrap01(this.slavePhase + sFreq * t);
      }

      outSine[i] = sineWave(this.slavePhase);
      if (outTri) outTri[i] = triangleWave(this.slavePhase);
      if (outSaw) outSaw[i] = sawtoothWave(this.slavePhase);
      if (outSqr) outSqr[i] = squareWave(this.slavePhase);
      if (outEven) outEven[i] = evenWave(this.slavePhase);
    }

    return true;
  }
}

registerProcessor("evenvco-processor", EvenVcoProcessor);
