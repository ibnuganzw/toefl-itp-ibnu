import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ArcaneLiveRegionProvider, ArcaneSkipLink } from "./components/a11y/ArcaneA11y";
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
    <ArcaneLiveRegionProvider>
      <ArcaneSkipLink />
      <App />
    </ArcaneLiveRegionProvider>
  </React.StrictMode>,
);
