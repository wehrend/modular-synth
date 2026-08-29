// components/Info.tsx
// Wiederverwendbarer "(i)"-Marker: Klick zeigt einen Hilfe-Popover, egal wo
// im Projekt eingesetzt (Module, Toolbar, Dialoge, ...).
//
// WICHTIG -- Portal statt normaler Positionierung: Module leben als
// React-Flow-Nodes, die beim Zoomen/Pannen per CSS transform: scale(...)
// skaliert werden. Ein normal (absolute/relative) positioniertes Popover
// würde mit reinskalieren -- bei rausgezoomtem Canvas unlesbar klein, bei
// reingezoomtem unnötig riesig. Über createPortal rendern wir stattdessen
// direkt in document.body, mit Position aus der echten Bildschirm-
// koordinate des Markers (getBoundingClientRect) -- das Popover bleibt so
// immer in normaler, lesbarer Größe, unabhängig vom Canvas-Zoom.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Info as InfoIcon } from "lucide-react";
import styles from "./Info.module.scss";

type Props = {
  children: React.ReactNode;
  /** Optional: eigenes aria-label statt des generischen Standardtexts. */
  label?: string;
  /** Optional: Farbvariante des Markers (z.B. "danger" für Warnhinweise). */
  variant?: "default" | "danger";
};

const POPOVER_MAX_WIDTH = 260;
const VIEWPORT_MARGIN = 8;

export default function Info({ children, label, variant = "default" }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    alignRight: boolean;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Rechts anschlagen statt links, wenn's sonst über den Viewport-Rand
      // hinausragen würde -- ohne dafür erst die tatsächliche gerenderte
      // Breite abwarten zu müssen (kein Flackern beim Öffnen).
      const wouldOverflowRight =
        rect.left + POPOVER_MAX_WIDTH + VIEWPORT_MARGIN > window.innerWidth;
      setPosition({
        top: rect.bottom + 6,
        left: wouldOverflowRight ? rect.right : rect.left,
        alignRight: wouldOverflowRight,
      });
    }
    setOpen((v) => !v);
  };

  // Schließen bei Klick außerhalb, Escape, oder wenn der Canvas
  // gepannt/gezoomt wird (sonst "schwebt" das Popover an der alten
  // Bildschirmposition, während der Marker selbst sich unter ihm
  // wegbewegt hat).
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleViewportChange = () => setOpen(false);

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  // Nach dem ersten Render mit der tatsächlichen Breite ggf. nochmal
  // fein nachjustieren (z.B. bei sehr kurzem Text schmaler als
  // POPOVER_MAX_WIDTH -- die Overflow-Heuristik oben rechnet konservativ
  // mit der maximalen Breite).
  useLayoutEffect(() => {
    if (!open || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - VIEWPORT_MARGIN) {
      popoverRef.current.style.left = `${window.innerWidth - rect.width - VIEWPORT_MARGIN}px`;
    }
    if (rect.left < VIEWPORT_MARGIN) {
      popoverRef.current.style.left = `${VIEWPORT_MARGIN}px`;
    }
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`nodrag ${styles.marker} ${variant === "danger" ? styles.markerDanger : ""}`}
        onClick={toggle}
        aria-label={label ?? t("common.moreInfo")}
        aria-expanded={open}
      >
        <InfoIcon size={12} strokeWidth={2.5} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            className={styles.popover}
            style={{
              top: position.top,
              left: position.alignRight
                ? position.left - POPOVER_MAX_WIDTH
                : position.left,
              maxWidth: POPOVER_MAX_WIDTH,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
