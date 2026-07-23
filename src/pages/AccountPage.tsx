// src/pages/AccountPage.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styles from "./AuthPages.module.scss";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Mein Konto</h1>
        <p>
          Angemeldet als: <strong>{user?.email}</strong>
        </p>
        <p className={styles.hint}>
          Konto seit:{" "}
          {user?.created_at
            ? new Date(user.created_at).toLocaleDateString()
            : "—"}
        </p>
        <button className={styles.submit} onClick={onLogout}>
          Abmelden
        </button>
        <p className={styles.hint}>
          <a href="/">Zurück zum Synth</a>
        </p>
      </div>
    </div>
  );
}
