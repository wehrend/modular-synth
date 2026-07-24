import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../auth/AuthContext";
import styles from "./AuthPages.module.scss";

type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setProfile(data);
        setLoading(false);
      });
  }, [id]);

  const isOwnProfile = user?.id === id;

  if (loading)
    return (
      <div className={styles.page}>
        <p>Lädt…</p>
      </div>
    );

  if (notFound || !profile) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Profil nicht gefunden</h1>
          <p className={styles.hint}>
            <Link to="/">Zurück zum Synth</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{profile.display_name ?? "Unbenannt"}</h1>

        <dl className={styles.detailList}>
          <dt>Mitglied seit</dt>
          <dd>{new Date(profile.created_at).toLocaleDateString()}</dd>
        </dl>

        {isOwnProfile && (
          <p className={styles.hint}>Das ist dein eigenes Profil.</p>
        )}

        <p className={styles.hint}>
          <Link to="/">Zurück zum Synth</Link>
        </p>
      </div>
    </div>
  );
}
