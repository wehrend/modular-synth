import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Lädt…</p>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
