// i18n/index.ts
// Zentrale i18next-Konfiguration. Weitere Sprache hinzufügen = neue
// locales/<code>.json anlegen + hier in `resources` und `SUPPORTED_LANGUAGES`
// eintragen -- keine Änderungen an den Komponenten nötig.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import de from "./locales/de.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["de", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LOCAL_STORAGE_KEY = "modular-synth:lang";

const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false }, // React escaped bereits selbst
    detection: {
      // Reihenfolge: manuell gewählte Sprache (localStorage) schlägt
      // Browser-Einstellung -- sonst würde jeder Reload die manuelle
      // Auswahl wieder verwerfen.
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LOCAL_STORAGE_KEY,
    },
  });

export default i18n;
