// src/pages/LoginPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import styles from "./AuthPages.module.scss";

export default function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(error);
    else navigate("/");
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>{t("auth.login.title")}</h1>
        <input
          className={styles.field}
          type="email"
          placeholder={t("auth.login.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.field}
          type="password"
          placeholder={t("auth.login.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "…" : t("auth.login.submit")}
        </button>
        <p className={styles.hint}>
          {t("auth.login.noAccount")}{" "}
          <Link to="/register">{t("auth.login.register")}</Link>
        </p>
      </form>
    </div>
  );
}
