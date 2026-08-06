import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../persist/supabaseClient";
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
  const { user, refreshDisplayName, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // in der Komponente:
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
  // Bild-Upload: geht sofort hoch, sobald eine Datei gewählt wird.
  // Erst bei "Speichern" wird die neue URL tatsächlich im Profil übernommen.
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Grobe Client-seitige Vorabprüfung -- ersetzt keine serverseitige
    // Validierung, spart dem Nutzer aber einen fehlgeschlagenen Upload
    // bei offensichtlich falschen Dateien.
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei auswählen.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Bild ist zu groß (max. 2 MB).");
      return;
    }

    setUploading(true);
    setError(null);

    // Dateiendung aus dem Originalnamen übernehmen, sonst fixer Name pro
    // Nutzer -- so überschreibt ein erneuter Upload automatisch das alte
    // Bild, statt Dateileichen im Bucket anzusammeln.
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Cache-Buster: ohne das würde der Browser (und CDN-Caches) bei
    // gleichem Dateinamen weiterhin das alte Bild zeigen, obwohl der
    // Inhalt sich geändert hat.
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;

    setForm((prev) => ({ ...prev, avatar_url: bustedUrl }));
    setUploading(false);
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
    await refreshDisplayName();
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

          <label className={styles.field}>
            <input
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
              hidden
            />
            {uploading ? "Lädt hoch…" : "Profilbild wählen"}
          </label>

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
              disabled={saving || uploading}
            >
              {saving ? "…" : "Speichern"}
            </button>
            <button
              className={styles.submit}
              onClick={cancelEditing}
              disabled={saving || uploading}
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
