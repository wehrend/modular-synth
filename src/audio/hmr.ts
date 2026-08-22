// audio/hmr.ts
// audio/registry.ts hält seinen Zustand (registry, alle Tone.js-Node-
// Instanzen) im Modul-Scope. Ersetzt Vite bei einer Änderung an einer der
// audio/*-Dateien nur das Modul per Hot-Reload, bleiben alte Tone-Nodes
// (Recorder, Player etc.) unsauber im Speicher/Audiographen hängen und
// vermischen sich mit dem neuen Code -- daher vor jedem HMR-Update alles
// sauber disposen, damit App.tsx beim Re-Import wieder einen frischen,
// konsistenten Zustand aufbaut.
//
// Nur importieren, keine Exporte -- reiner Seiteneffekt beim Modul-Load.

import { registry, MODULE_HANDLERS } from "./registry";
import { gateRoutes } from "./gateRouting";

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    registry.forEach((node) => {
      MODULE_HANDLERS[node.type]?.dispose(node);
    });
    registry.clear();
    gateRoutes.clear();
  });

  // registry.ts hält globalen Modul-Zustand, den ein reines HMR-Update
  // nicht zuverlässig neu aufbaut (App.tsx's
  // initialNodes.forEach(createAudioNode...) läuft nur beim vollen
  // Modul-Load, nicht bei jedem Hot-Update). Statt mit einer leeren
  // Registry weiterzulaufen, lieber sauber neu laden.
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
