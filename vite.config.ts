import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        "**/.generated/**",
        "**/.qa-*",
        "**/.qa-*/**",
        "**/coverage/**",
        "**/dist/**",
        "**/qa-artifacts/**",
        "**/v0-home-redesign-upload/**",
      ],
    },
  },
});
