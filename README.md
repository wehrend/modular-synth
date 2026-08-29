(for german see below)

# Modular Synth

A modular software synthesizer in the browser: React Flow as the patch interface, Tone.js as the audio engine, written entirely in TypeScript (strict), multilingual (react-i18next), with a Supabase backend for accounts and saved patches.

Included modules: VCO, LFO, Mixer, VCF, Wasp Filter (custom DSP), Envelope/ADSR, Ring Modulator, Noise, VCA, Sequencer (CD4017-style), Sampler (microphone recording + cloud storage), Vocoder (analysis + synthesis, modeled after the Doepfer A-129), Voiced/Unvoiced Detector, and OUT.

## Getting Started

```bash
npm install
npm run dev
```

Then open it in your browser (Vite displays the URL, usually http://localhost:5173).

Important: The AudioContext doesn’t start until you click on the page for the first time—this is a browser security rule, not a bug.

## Usage

1. Drag from the right node of a source module to the left node of a destination module → the signal is patched.
2. Create modules using the “+” buttons in the toolbar.
3. Multiple sources can be routed to the same input (they are mixed).
4. Select an edge or module and press `Del`/`Backspace` to delete it.
5. Patches can be saved/loaded (Supabase account required) or shared as a preset (`?patch=<id>` in the URL).

## Architecture

The core principle: **The flow graph (UI) and the audiograph (Tone.js) are kept in sync.** Every node in the React Flow canvas has a counterpart in an audio registry; every edge in the graph corresponds to a real `connect()` connection between Tone.js objects.

```
React Flow (UI)                 Tone.js (Audio)
─────────────────               ─────────────────
Node “osc-1”     ←──────→     Tone.Oscillator
Node “out-1”     ←──────→     Tone.Volume → Destination
Edge osc-1→out-1  ←──────→     osc.connect(vol)
```

Important files:

- **`src/types.ts`** – Data types per module (`XyzData`), React Flow node type (`XyzFlowNode`), and the three central discriminated unions `AppNode`, `AudioNodeInit`, `NodePatch`.
- **`src/audio/`** – everything recognized by Tone.js, divided into:
  - `registry.ts` – map from node ID to audio entry, `MODULE_HANDLERS` (`create`/`update`/`dispose` per module type)
  - `connections.ts` – `connectAudio`/`disconnectAudio`, resolves handle IDs into actual Tone connections
  - `gateRouting.ts`, `samplerControls.ts`, `hmr.ts`, `vocoderDebug.ts` – module-specific additional logic
  - `index.ts` – Barrel export (**explicit**, no `export *` – new functions must be listed individually here)
- **`src/nodes/*.tsx`** – Custom Nodes. Each file exports both the audio side (`createXyzNode`/`updateXyzNode`/`disposeXyzNode`) and the UI component (default export). Parameter changes are always sent simultaneously to `updateNodeData` (UI state) **and** `updateAudioNode` (sound).
- **`src/moduleCatalog.ts`** – Toolbar entries: type, ID prefix, translation key for the label, start position, default values.
- **`src/App.tsx`** – React Flow canvas plus `nodeTypes` registration. The actual logic is contained in hooks (`usePresetActions`, `usePatchFromUrl`, `useFlowAudioSync`).
- **`src/persist/serialize.ts`** – `MODULE_DEFAULTS`, ensuring that saved presets load reliably even if fields are missing or new ones are added.
- **`src/i18n/locales/{de,en}.json`** – all visible text, structured as `modules.catalog.<typ>` (toolbar labels) and `modules.<typ>.*` (titles, field labels).

## Adding a New Module

A new module affects **eight locations**. That sounds like a lot, but it always follows the same pattern—it’s best to copy from an existing, similar module (e.g., `RingModNode.tsx` for modules with two audio inputs, `SequencerNode.tsx` for modules with many similar ports).

1. **`src/types.ts`** – Define the `XyzData` type (the knob/parameter values) and `XyzFlowNode = Node<XyzData, “xyz”>`, then add them to the three unions `AppNode`, `AudioNodeInit`, and `NodePatch`.

2. **`src/nodes/XyzNode.tsx`** (new file) – contains:
   - `createXyzNode(id, data)`: constructs the Tone.js objects and returns an `XyzEntry` with `ins`/`outs` (or `in`/`out` if there is only one port)—these are the connection points through which other modules connect.
   - `updateXyzNode(entry, patch)`: applies parameter changes in real time (usually `rampTo` to avoid clicks).
   - `disposeXyzNode(entry)`: cleans up **all** created Tone objects, not just the obvious ones.
   - Default export: the UI component with `useTranslation()`, `Handle` elements (IDs must match the `ins`/`outs` keys exactly), and `Knob` components per parameter.

3. **`src/audio/registry.ts`** – import the three functions from Step 2 (path: `".. /nodes/XyzNode“`, **not** `”./nodes/..."` – the most common copy-paste mistake), add the `XyzEntry` type to the `RegistryEntry` union, and update the entry in `MODULE_HANDLERS`.

4. **`src/moduleCatalog.ts`** – Add a new entry with `type`, `idPrefix`, `labelKey: “modules.catalog.xyz”`, `basePosition`, and `defaults: () => ({...})`.

5. **`src/App.tsx`** – Import the component and add it to `nodeTypes` under the same `type` key.

6. **`src/persist/serialize.ts`** – Add an entry to `MODULE_DEFAULTS` so that older saved patches without the new module (or with missing new fields) are not rejected with the error “Preset uses an unknown module.”

7. **`src/i18n/locales/de.json`** and **`en.json`** – `modules.catalog.xyz` (toolbar label) as well as a `modules.xyz` block containing the title and all field/handle labels. Recurring terms (Gain, Band N, In/Out) are centralized under `common.*`—check there before creating a new key.

8. **If the module has multiple ports of the same type** (as with the 10-band vocoder): create a shared constants file (see `nodes/vocoderBands.ts`) instead of duplicating frequencies/counts in multiple places—otherwise, two related modules (e.g., analysis and synthesis) can easily become out of sync.

**Common pitfalls** (all of which have happened before):

- Handle `id` in the UI ≠ key in `ins`/`outs` → A connection is drawn in the flow graph, but `connectAudio` cannot find a destination and silently connects nothing in the audio graph. In this case, `connectAudio` logs a warning (`Connection cannot be resolved`)—this is the first thing to check when you have “a cable connected but no sound.”
- `dispose()` forgets an intermediate node (filter, meter, follower) → memory leak when deleting/reloading modules.
- A `log` knob with `min={0}` → `Math.log(v/0)` returns `NaN`, which is written to the state unnoticed and mutes the entire signal path. For logarithmic knobs, always set `min` to > 0.
- A new function was added to `src/audio/*.ts` but not listed in the Barrel export `src/audio/index.ts` → `Module has no exported member`, even though the function exists.

## Debugging

For modules with multi-stage signal processing (filter banks, follower chains), it’s worth using `Tone. Meter({ normalRange: true })` as a branch at relevant points in the signal path, combined with a React state display polled via `requestAnimationFrame` (see `VocoderAnalysisNode.tsx`)—this immediately shows where a signal disappears, instead of having to guess.

## Known Issues

- The even VCO’s UI is still suboptimal and should be improved
- The sampler module should be reworked to support file uploads and multiple samples

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

## Bekannte Fehler

- Die UI des even VCO ist noch suboptimal und sollte verbessert werden
- Das Sampler-Modul sollte überarbeitet werden und File-Upload sowie mehrere Samples unterstützen
