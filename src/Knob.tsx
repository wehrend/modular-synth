// Knob.tsx
// Drehregler im Hardware-Stil. Bedienung wie in Audio-Software üblich:
// vertikal ziehen (nicht kreisen), Shift = Feinmodus, Pfeiltasten für
// Tastaturbedienung. Die Klasse "nodrag" verhindert, dass React Flow
// die Geste als Modul-Verschieben interpretiert.
//
// Mit `log` bekommt der Regler eine logarithmische Kennlinie — für
// Frequenzen musikalisch korrekt: jede Oktave belegt gleich viel Drehweg.
// Intern rechnet der Knob deshalb in der Reglerposition t (0–1), nicht im
// Wert; die Kennlinie ist nur das Mapping t ↔ Wert.

import { useRef } from 'react';
import styles from './Knob.module.scss';

type KnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Logarithmische Kennlinie (erfordert min > 0). */
  log?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

const SIZE = 56;
const C = SIZE / 2; // Zentrum
const R = 22; // Radius der Wertespur
const SWEEP_START = -135; // Grad; 0° zeigt nach oben
const SWEEP_END = 135;
const DRAG_RANGE_PX = 160; // Pixel vertikalen Zugs für den vollen Drehweg

/** Winkel (0° = oben) → Punkt auf dem Kreis. */
function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number, radius: number) {
  const from = polar(fromDeg, radius);
  const to = polar(toDeg, radius);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y}`;
}

export default function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  log = false,
  format,
  onChange,
}: KnobProps) {
  // Drag-Zustand im Ref: Startposition bleibt fix, während `value` sich ändert
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  /* Kennlinie: Reglerposition t (0–1) ↔ Wert */
  const toT = (v: number) =>
    log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  const fromT = (t: number) =>
    log ? min * Math.pow(max / min, t) : min + t * (max - min);

  const commit = (t: number) => {
    const bounded = Math.min(1, Math.max(0, t));
    const snapped = Math.round(fromT(bounded) / step) * step;
    onChange(Math.min(max, Math.max(min, snapped)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startY: e.clientY, startT: toT(value) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY; // nach oben = Wert rauf
    const fine = e.shiftKey ? 0.1 : 1;
    commit(drag.current.startT + (dy / DRAG_RANGE_PX) * fine);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Linear: in Wert-Schritten. Log: in Drehweg-Prozent, damit sich die
    // Pfeiltasten über den ganzen Bereich gleich "schnell" anfühlen.
    let next: number | null = null;
    const dir =
      e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1
      : 0;
    if (dir !== 0) {
      next = log
        ? fromT(Math.min(1, Math.max(0, toT(value) + dir * (e.shiftKey ? 0.1 : 0.01))))
        : value + dir * (e.shiftKey ? step * 10 : step);
    }
    if (e.key === 'Home') next = min;
    if (e.key === 'End') next = max;
    if (next !== null) {
      e.preventDefault();
      const snapped = Math.round(next / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    }
  };

  const angle = SWEEP_START + toT(value) * (SWEEP_END - SWEEP_START);
  const tip = polar(angle, R - 7);
  const base = polar(angle, 6);

  return (
    <div className={styles.knob}>
      <span className={styles.label}>{label}</span>
      <div
        className={`nodrag ${styles.dial}`}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Gehäuse */}
          <circle cx={C} cy={C} r={R - 4} className={styles.body} />
          {/* Spur (voller Weg) und Wert-Bogen */}
          <path d={arcPath(SWEEP_START, SWEEP_END, R)} className={styles.track} />
          <path d={arcPath(SWEEP_START, angle, R)} className={styles.arc} />
          {/* Zeiger */}
          <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} className={styles.pointer} />
        </svg>
      </div>
      <span className={styles.value}>{format ? format(value) : value}</span>
    </div>
  );
}
