// components/Switch.tsx
// Generischer Ein/Aus-Schiebeschalter, nach demselben Muster wie Knob/
// RotarySwitch: reiner Darstellungs-/Interaktions-Baustein, kennt nichts
// von Audio oder Tone.js -- der Aufrufer entscheidet, was checked/onChange
// bedeuten.

import styles from "./Switch.module.scss";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export default function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`nodrag ${styles.track} ${checked ? styles.trackOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}