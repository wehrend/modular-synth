import { useRef, useCallback } from "react";
import gsap from "gsap";
import styles from "./RotarySwitch.module.scss";

type Props = {
  value: number; // 0 bis positions-1
  positions: number; // z. B. 12
  labels?: string[]; // optionale Beschriftung pro Rastpunkt
  onChange: (index: number) => void;
};

const ARC_DEGREES = 270; // gleicher 270°-Sweep wie dein Knob
const START_ANGLE = -135;

export default function RotarySwitch({
  value,
  positions,
  labels,
  onChange,
}: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startAngle: number;
    lastAngle: number;
    lastTime: number;
    velocity: number; // Grad/ms, für den Momentum-Ausklang
  } | null>(null);

  const angleForIndex = (i: number) =>
    START_ANGLE + (i / (positions - 1)) * ARC_DEGREES;

  const indexForAngle = (angle: number) => {
    const clamped = Math.min(
      START_ANGLE + ARC_DEGREES,
      Math.max(START_ANGLE, angle),
    );
    const t = (clamped - START_ANGLE) / ARC_DEGREES;
    return Math.round(t * (positions - 1));
  };

  const getPointerAngle = (e: PointerEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
  };

  const snapTo = useCallback(
    (index: number, _currentAngle: number) => {
      const target = angleForIndex(index);
      gsap.to(knobRef.current, {
        rotation: target,
        duration: 0.45,
        ease: "elastic.out(0.9, 0.5)", // weiches "Einrasten" statt hartem Stopp
        onUpdate: function () {
          // rein visuell -- der eigentliche Wert wird sofort committed
        },
      });
      onChange(index);
    },
    [onChange, positions],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const el = knobRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const angle = getPointerAngle(e.nativeEvent, el);
    dragState.current = {
      startAngle: angle,
      lastAngle: angle,
      lastTime: performance.now(),
      velocity: 0,
    };
    gsap.killTweensOf(el); // laufende Snap-Animation abbrechen, falls man mitten reingreift

    const onMove = (ev: PointerEvent) => {
      if (!dragState.current || !el) return;
      const now = performance.now();
      const a = getPointerAngle(ev, el);
      const dt = Math.max(1, now - dragState.current.lastTime);

      // Geschwindigkeit glätten (einfacher Tiefpass), sonst zittert das
      // Momentum bei ungleichmäßigen Pointer-Events.
      const rawVelocity = (a - dragState.current.lastAngle) / dt;
      dragState.current.velocity =
        dragState.current.velocity * 0.7 + rawVelocity * 0.3;
      dragState.current.lastAngle = a;
      dragState.current.lastTime = now;

      gsap.set(el, { rotation: a });
    };

    const onUp = () => {
      if (!dragState.current || !el) return;
      // Momentum-Projektion: aus der letzten Geschwindigkeit einen
      // "Auslauf"-Winkel schätzen, dann auf den nächstgelegenen der
      // 12 Rastpunkte einrasten -- das erzeugt das Trägheitsgefühl,
      // ohne das kostenpflichtige InertiaPlugin zu brauchen.
      const projected =
        dragState.current.lastAngle + dragState.current.velocity * 120;
      const index = indexForAngle(projected);
      snapTo(index, dragState.current.lastAngle);
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={knobRef}
        className={styles.switch}
        onPointerDown={onPointerDown}
        style={{ transform: `rotate(${angleForIndex(value)}deg)` }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.label}>{labels?.[value] ?? value}</span>
    </div>
  );
}
