// pages/DiscoverPage.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  listDiscoverableProfiles,
  listPublicPatchesForUser,
  type DiscoverProfile,
  type DiscoverPatch,
} from "../persist/supabase";
import styles from "./DiscoverPage.module.scss";

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [patches, setPatches] = useState<DiscoverPatch[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listDiscoverableProfiles()
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  const current = profiles[index];

  useEffect(() => {
    if (!current) return;
    listPublicPatchesForUser(current.id).then(setPatches);
  }, [current]);

  const next = () => setIndex((i) => Math.min(i + 1, profiles.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  // Minimaler Swipe: horizontale Zugstrecke auswerten, kein Momentum,
  // keine Animation -- bewusst einfach, kann später durch eine
  // Gestenbibliothek ersetzt werden.
  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (dx < -60) next();
    if (dx > 60) prev();
    dragStartX.current = null;
  };

  const openInSynth = (patchId: string) => {
    navigate(`/?patch=${patchId}`);
  };

  if (loading) return <p className={styles.status}>Lädt…</p>;
  if (profiles.length === 0) {
    return (
      <p className={styles.status}>
        Noch keine öffentlichen Patches vorhanden.
      </p>
    );
  }

  return (
    <div
      className={styles.page}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className={styles.card}>
        {current.avatar_url && (
          <img className={styles.avatar} src={current.avatar_url} alt="" />
        )}
        <h2 className={styles.name}>{current.display_name ?? "Unbenannt"}</h2>
        <Link className={styles.profileLink} to={`/user/${current.id}`}>
          Profil ansehen
        </Link>
        <ul className={styles.patchList}>
          {patches.map((p) => (
            <li key={p.id}>
              <button
                className={styles.patchBtn}
                onClick={() => openInSynth(p.id)}
              >
                {p.thumbnail_url ? (
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    className={styles.patchThumb}
                  />
                ) : (
                  <div className={styles.patchThumbPlaceholder} aria-hidden />
                )}
                <span className={styles.patchName}>{p.name}</span>
                <span className={styles.patchDescription}>{p.description}</span>
              </button>
            </li>
          ))}
          {patches.length === 0 && (
            <li className={styles.status}>Keine Patches.</li>
          )}
        </ul>
      </div>

      <div className={styles.nav}>
        <button onClick={prev} disabled={index === 0}>
          ‹ Zurück
        </button>
        <span className={styles.counter}>
          {index + 1} / {profiles.length}
        </span>
        <button onClick={next} disabled={index === profiles.length - 1}>
          Weiter ›
        </button>
      </div>
    </div>
  );
}
