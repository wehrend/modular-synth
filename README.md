# Modular Synth – Prototyp

Ein minimaler modularer Software-Synthesizer: React Flow als Patch-Oberfläche, Tone.js als Audio-Engine, vollständig in TypeScript (strict). Enthalten sind zwei Modultypen: **VCO** (Oszillator, Quelle) und **OUT** (Lautsprecher, Senke).

## Starten

```bash
npm install
npm run dev
```

Dann im Browser öffnen (Vite zeigt die URL an, meist http://localhost:5173).

Wichtig: Der AudioContext startet erst nach dem ersten Klick in die Seite – das ist eine Browser-Sicherheitsregel, kein Bug.

## Bedienung

1. Vom rechten Punkt des VCO zum linken Punkt von OUT ziehen → Signal ist gepatcht.
2. VCO auf „an" schalten, Frequenz und Wellenform einstellen.
3. „+ Oszillator" fügt weitere Quellen hinzu; mehrere Oszillatoren dürfen auf denselben Ausgang gehen (sie werden gemischt).
4. Kante oder Modul auswählen und `Entf`/`Backspace` löschen.

## Architektur

Das Kernprinzip: **Der Flow-Graph und der Audiograph werden synchron gehalten.**

```
React Flow (UI)                 Tone.js (Audio)
─────────────────               ─────────────────
Knoten "osc-1"     ←──────→     Tone.Oscillator
Knoten "out-1"     ←──────→     Tone.Volume → Destination
Kante osc-1→out-1  ←──────→     osc.connect(vol)
```

- `src/audio.ts` – die einzige Stelle, die Tone.js kennt. Registry von Knoten-ID → Tone-Objekt, plus `connect`/`disconnect`/`dispose`.
- `src/App.jsx` – React-Flow-Canvas. Die Callbacks `onConnect`, `onEdgesDelete`, `onNodesDelete` spiegeln jede Graph-Änderung in den Audiographen.
- `src/nodes/*.jsx` – Custom Nodes. Jede Parameteränderung geht gleichzeitig an `updateNodeData` (UI) und `updateAudioNode` (Klang).

## Nächste Module

Das Muster ist bewusst erweiterbar – ein neues Modul braucht nur drei Dinge:

1. Einen Case in `createAudioNode` (z. B. `new Tone.Filter()` mit `in` **und** `out`).
2. Eine Node-Komponente mit passenden Handles.
3. Einen Eintrag in `nodeTypes`.

Naheliegende Kandidaten: Filter (Tone.Filter), Hüllkurve (Tone.AmplitudeEnvelope), LFO (Tone.LFO → moduliert Parameter statt Audio), Delay/Reverb.
