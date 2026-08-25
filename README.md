# Modular Synth

Ein modularer Software-Synthesizer im Browser: React Flow als Patch-Oberfläche, Tone.js als Audio-Engine, vollständig in TypeScript (strict), mehrsprachig (react-i18next), mit Supabase-Backend für Accounts und gespeicherte Patches.

Enthaltene Module: VCO, LFO, Mixer, VCF, Wasp Filter (custom DSP), Envelope/ADSR, Ring-Mod, Noise, VCA, Sequencer (CD4017-Style), Sampler (Mikrofonaufnahme + Cloud-Speicher), Vocoder (Analyse + Synthese, nach Doepfer-A-129-Vorbild), Voiced/Unvoiced-Detektor und OUT.

## Starten

```bash
npm install
npm run dev
```

Dann im Browser öffnen (Vite zeigt die URL an, meist http://localhost:5173).

Wichtig: Der AudioContext startet erst nach dem ersten Klick in die Seite – das ist eine Browser-Sicherheitsregel, kein Bug.

## Bedienung

1. Vom rechten Punkt eines Quell-Moduls zum linken Punkt eines Ziel-Moduls ziehen → Signal ist gepatcht.
2. Module über die „+"-Buttons in der Toolbar anlegen.
3. Mehrere Quellen dürfen auf denselben Eingang gehen (sie werden gemischt).
4. Kante oder Modul auswählen und `Entf`/`Backspace` löschen.
5. Patches lassen sich speichern/laden (Supabase-Account nötig) oder als Preset teilen (`?patch=<id>` in der URL).

## Architektur

Das Kernprinzip: **Der Flow-Graph (UI) und der Audiograph (Tone.js) werden synchron gehalten.** Jeder Knoten im React-Flow-Canvas hat ein Gegenstück in einer Audio-Registry; jede Kante im Graph entspricht einer echten `connect()`-Verbindung zwischen Tone.js-Objekten.

```
React Flow (UI)                 Tone.js (Audio)
─────────────────               ─────────────────
Knoten "osc-1"     ←──────→     Tone.Oscillator
Knoten "out-1"     ←──────→     Tone.Volume → Destination
Kante osc-1→out-1  ←──────→     osc.connect(vol)
```

Wichtige Dateien:

- **`src/types.ts`** – Datentypen pro Modul (`XyzData`), React-Flow-Knotentyp (`XyzFlowNode`) sowie die drei zentralen Discriminated Unions `AppNode`, `AudioNodeInit`, `NodePatch`.
- **`src/audio/`** – alles, was Tone.js kennt, aufgeteilt in:
  - `registry.ts` – Map von Knoten-ID → Audio-Entry, `MODULE_HANDLERS` (pro Modultyp `create`/`update`/`dispose`)
  - `connections.ts` – `connectAudio`/`disconnectAudio`, löst Handle-IDs in echte Tone-Verbindungen auf
  - `gateRouting.ts`, `samplerControls.ts`, `hmr.ts`, `vocoderDebug.ts` – modulspezifische Zusatzlogik
  - `index.ts` – Barrel-Export (**explizit**, kein `export *` – neue Funktionen müssen hier einzeln gelistet werden)
- **`src/nodes/*.tsx`** – Custom Nodes. Jede Datei exportiert sowohl die Audio-Seite (`createXyzNode`/`updateXyzNode`/`disposeXyzNode`) als auch die UI-Komponente (Default-Export). Parameteränderungen gehen immer gleichzeitig an `updateNodeData` (UI-State) **und** `updateAudioNode` (Klang).
- **`src/moduleCatalog.ts`** – Toolbar-Einträge: Typ, ID-Präfix, Übersetzungsschlüssel fürs Label, Startposition, Default-Werte.
- **`src/App.tsx`** – React-Flow-Canvas plus `nodeTypes`-Registrierung. Die eigentliche Logik sitzt in Hooks (`usePresetActions`, `usePatchFromUrl`, `useFlowAudioSync`).
- **`src/persist/serialize.ts`** – `MODULE_DEFAULTS`, damit gespeicherte Presets auch bei fehlenden/neuen Feldern robust laden.
- **`src/i18n/locales/{de,en}.json`** – alle sichtbaren Texte, Struktur `modules.catalog.<typ>` (Toolbar-Label) und `modules.<typ>.*` (Titel, Feldbeschriftungen).

## Neues Modul hinzufügen

Ein neues Modul berührt **acht Stellen**. Das klingt nach viel, ist aber immer dasselbe Muster – am besten anhand eines bestehenden, ähnlichen Moduls kopieren (z. B. `RingModNode.tsx` für Module mit zwei Audioeingängen, `SequencerNode.tsx` für Module mit vielen gleichartigen Ports).

1. **`src/types.ts`** – `XyzData`-Typ (die Knob-/Parameterwerte) und `XyzFlowNode = Node<XyzData, "xyz">` definieren, dann in den drei Unions `AppNode`, `AudioNodeInit`, `NodePatch` ergänzen.

2. **`src/nodes/XyzNode.tsx`** (neue Datei) – enthält:
   - `createXyzNode(id, data)`: baut die Tone.js-Objekte, gibt ein `XyzEntry` mit `ins`/`outs` (bzw. `in`/`out` bei nur einem Port) zurück – das sind die Andockpunkte, über die andere Module sich verbinden.
   - `updateXyzNode(entry, patch)`: wendet Parameteränderungen live an (meist `rampTo`, um Klicks zu vermeiden).
   - `disposeXyzNode(entry)`: räumt **alle** erzeugten Tone-Objekte auf, nicht nur die offensichtlichen.
   - Default-Export: die UI-Komponente mit `useTranslation()`, `Handle`-Elementen (IDs müssen exakt zu den `ins`/`outs`-Keys passen) und `Knob`-Komponenten pro Parameter.

3. **`src/audio/registry.ts`** – die drei Funktionen aus Schritt 2 importieren (Pfad: `"../nodes/XyzNode"`, **nicht** `"./nodes/..."` – häufigster Copy-Paste-Fehler), den `XyzEntry`-Typ in die `RegistryEntry`-Union aufnehmen, Eintrag in `MODULE_HANDLERS` ergänzen.

4. **`src/moduleCatalog.ts`** – neuer Eintrag mit `type`, `idPrefix`, `labelKey: "modules.catalog.xyz"`, `basePosition`, `defaults: () => ({...})`.

5. **`src/App.tsx`** – Komponente importieren, in `nodeTypes` unter demselben `type`-Schlüssel eintragen.

6. **`src/persist/serialize.ts`** – Eintrag in `MODULE_DEFAULTS`, damit ältere gespeicherte Patches ohne das neue Modul (oder mit fehlenden neuen Feldern) nicht mit „Preset verwendet unbekanntes Modul" abgewiesen werden.

7. **`src/i18n/locales/de.json`** und **`en.json`** – `modules.catalog.xyz` (Toolbar-Label) sowie ein Block `modules.xyz` mit Titel und allen Feld-/Handle-Beschriftungen. Wiederkehrende Begriffe (Gain, Band N, In/Out) liegen zentral unter `common.*` – dort nachsehen, bevor man einen neuen Key anlegt.

8. **Falls das Modul mehrere gleichartige Ports hat** (wie beim Vocoder mit 10 Bändern): eine gemeinsame Konstanten-Datei (siehe `nodes/vocoderBands.ts`) anlegen, statt Frequenzen/Anzahl an mehreren Stellen zu duplizieren – sonst laufen zwei zusammenhängende Module (z. B. Analyse und Synthese) leicht auseinander.

**Typische Fallstricke** (alle schon mal passiert):

- Handle-`id` in der UI ≠ Key in `ins`/`outs` → Verbindung wird im Flow-Graph gezogen, aber `connectAudio` findet kein Ziel und verbindet im Audiographen still gar nichts. `connectAudio` loggt in diesem Fall eine Warnung (`Verbindung nicht auflösbar`) – das ist der erste Blick bei „Kabel liegt, aber kein Ton".
- `dispose()` vergisst einen Zwischenknoten (Filter, Meter, Follower) → Memory Leak beim Löschen/Neuladen von Modulen.
- Ein `log`-Knob mit `min={0}` → `Math.log(v/0)` ergibt `NaN`, das sich unbemerkt in den State schreibt und den kompletten Signalpfad stumm schaltet. Bei logarithmischen Knobs `min` immer > 0 setzen.
- Neue Funktion in `src/audio/*.ts` ergänzt, aber nicht im Barrel-Export `src/audio/index.ts` gelistet → `Module has no exported member`, obwohl die Funktion existiert.

## Debugging

Für Module mit mehrstufiger Signalverarbeitung (Filterbänke, Follower-Ketten) lohnt sich `Tone.Meter({ normalRange: true })` als Abzweig an relevanten Punkten im Signalpfad, kombiniert mit einer per `requestAnimationFrame` gepollten React-State-Anzeige (siehe `VocoderAnalysisNode.tsx`) – zeigt sofort, an welcher Stelle ein Signal verschwindet, statt raten zu müssen.
