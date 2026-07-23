// src/pages/RegisterPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styles from "./AuthPages.module.scss";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signUp(email, password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    // Standard-Supabase-Verhalten: je nach Projekteinstellung ist eine
    // E-Mail-Bestätigung nötig, bevor eine Session entsteht.
    setInfo(
      "Konto angelegt. Bitte E-Mail-Postfach prüfen, falls eine Bestätigung nötig ist.",
    );
    setTimeout(() => navigate("/login"), 2000);
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Registrieren</h1>
        <input
          className={styles.field}
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.field}
          type="password"
          placeholder="Passwort (mind. 6 Zeichen)"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.info}>{info}</p>}
        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "…" : "Konto erstellen"}
        </button>
        <p className={styles.hint}>
          Schon registriert? <Link to="/login">Anmelden</Link>
        </p>
      </form>
    </div>
  );
}
