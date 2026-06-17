import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ArcaneLiveRegionProvider, ArcaneSkipLink } from "./components/a11y/ArcaneA11y";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";
import "./styles/tokens.css";
import "./styles/theme.css";
import "./styles/primitives.css";
import "./styles/navigation.css";
import "./styles/home-dashboard.css";
import "./styles/destination-pages.css";
import "./styles/progress-illustration.css";
import "./styles/session-workspace.css";
import "./styles/arcane.css";
import "./styles/session-redesign.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ArcaneLiveRegionProvider>
        <ArcaneSkipLink />
        <App />
      </ArcaneLiveRegionProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* Service worker is a progressive enhancement; ignore failures. */
    });
  });
}
