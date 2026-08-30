// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { AuthProvider } from "./auth/AuthContext";
import "./styles/global.scss";
import "./i18n"; // muss vor dem ersten Render laufen, damit useTranslation() sofort Übersetzungen hat
import UserDetailPage from "./pages/UserDetailPage";
import DiscoverPage from "./pages/DiscoverPage";
import PrivacyPage from "./pages/PrivacyPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* basename wichtig für GitHub Pages: dieselbe Falle wie beim Vite-`base` */}
    <BrowserRouter basename="/modular-synth">
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/user/:id" element={<UserDetailPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/datenschutz" element={<PrivacyPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
