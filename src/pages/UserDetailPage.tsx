import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../auth/AuthContext";
import styles from "./AuthPages.module.scss";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  created_at: string;
};

type FormState = {
  display_name: string;
  bio: string;
  avatar_url: string;
  website: string;
};

// Gemeinsamer Rahmen für Lade-/Fehler-/Hauptzustand, statt page/card
// an drei Stellen zu wiederholen.
function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>{children}</div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // in der Komponente:
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Formularfelder getrennt vom geladenen `profile` halten — so kann man
  // beim Abbrechen einfach den Edit-State verwerfen, ohne `profile` selbst
  // anzufassen, bis der Speichern-Klick tatsächlich bestätigt wird.
  const [form, setForm] = useState<FormState>({
    display_name: "",
    bio: "",
    avatar_url: "",
    website: "",
  });

  const isOwnProfile = user?.id === id;

  const loadProfile = () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    supabase
      .from("profiles")
      .select("id, display_name, bio, avatar_url, website, created_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setProfile(data);
          setForm({
            display_name: data.display_name ?? "",
            bio: data.bio ?? "",
            avatar_url: data.avatar_url ?? "",
            website: data.website ?? "",
          });
        }
        setLoading(false);
      });
  };

  useEffect(loadProfile, [id]);

  // Generischer Feld-Updater statt vier fast identischer onChange-Handler.
  const updateField =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const startEditing = () => {
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    // Formular auf den zuletzt geladenen Stand zurücksetzen, nicht auf leer
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url ?? "",
        website: profile.website ?? "",
      });
    }
    setEditing(false);
    setError(null);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        website: form.website.trim() || null,
      })
      .eq("id", user.id); // RLS erzwingt das ohnehin serverseitig, aber
    // explizit zu filtern macht die Absicht klar

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditing(false);
    loadProfile(); // frisch nachladen statt lokal zu raten, was gespeichert wurde
  };

  if (loading) {
    return (
      <PageCard>
        <p>Lädt…</p>
      </PageCard>
    );
  }

  if (notFound || !profile) {
    return (
      <PageCard>
        <h1 className={styles.title}>Profil nicht gefunden</h1>
        <p className={styles.hint}>
          <Link to="/">Zurück zum Synth</Link>
        </p>
      </PageCard>
    );
  }

  return (
    <PageCard>
      {editing ? (
        <>
          <h1 className={styles.title}>Profil bearbeiten</h1>

          <input
            className={styles.field}
            placeholder="Anzeigename"
            value={form.display_name}
            onChange={updateField("display_name")}
          />
          <textarea
            className={styles.field}
            placeholder="Bio"
            rows={3}
            value={form.bio}
            onChange={updateField("bio")}
          />
          <input
            className={styles.field}
            placeholder="Bild-URL"
            value={form.avatar_url}
            onChange={updateField("avatar_url")}
          />
          <input
            className={styles.field}
            placeholder="Website"
            value={form.website}
            onChange={updateField("website")}
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              className={styles.submit}
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? "…" : "Speichern"}
            </button>
            <button
              className={styles.submit}
              onClick={cancelEditing}
              disabled={saving}
            >
              Abbrechen
            </button>
          </div>
        </>
      ) : (
        <>
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt="" className={styles.avatar} />
          )}
          <h1 className={styles.title}>
            {profile.display_name ?? "Unbenannt"}
          </h1>

          {profile.bio && <p>{profile.bio}</p>}
          {profile.website && (
            <p>
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className={styles.websiteLink}
              >
                {profile.website}
              </a>
            </p>
          )}

          <dl className={styles.detailList}>
            <dt>Mitglied seit</dt>
            <dd>{new Date(profile.created_at).toLocaleDateString()}</dd>
          </dl>

          {isOwnProfile && (
            <div className={styles.actions}>
              <button className={styles.submit} onClick={startEditing}>
                Profil bearbeiten
              </button>
              <button className={styles.submit} onClick={handleLogout}>
                Abmelden
              </button>
            </div>
          )}

          <p className={styles.hint}>
            <Link to="/">Zurück zum Synth</Link>
          </p>
        </>
      )}
    </PageCard>
  );
}
