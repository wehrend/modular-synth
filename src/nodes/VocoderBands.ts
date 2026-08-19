// vocoderBands.ts
// Gemeinsame Bandaufteilung für Analyse- und Synthese-Modul des Vocoders.
// WICHTIG: beide Module MÜSSEN exakt dieselben Frequenzen/Q benutzen --
// sonst passt CV-Band N der Analyse nicht mehr zum Audio-Band N der
// Synthese (unterschiedliche Filterkurven → falsche Formanten).

export const VOCODER_BAND_COUNT = 10;
const FREQ_MIN = 90; // Hz -- unterhalb wird Sprache kaum noch verständlicher
const FREQ_MAX = 6000; // Hz -- darüber stecken v.a. Zischlaute
export const VOCODER_BAND_Q = 5; // höher = trennschärfer, aber löchriger/metallischer

/** Zentrumsfrequenzen logarithmisch verteilt -- musikalisch gleichmäßig über Oktaven. */
export function vocoderBandFrequencies(): number[] {
  const bands: number[] = [];
  for (let i = 0; i < VOCODER_BAND_COUNT; i++) {
    const t = i / (VOCODER_BAND_COUNT - 1);
    bands.push(FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t));
  }
  return bands;
}
