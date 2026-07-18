import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/modular-synth/",
  plugins: [react()],
});

//test