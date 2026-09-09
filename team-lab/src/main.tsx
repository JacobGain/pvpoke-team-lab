import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import "@/styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("TeamLab could not find its root element.");
}

const root = createRoot(rootElement);

async function startTeamLab() {
  if (typeof navigator.storage?.estimate === "function") {
    await navigator.storage.estimate();
  }
  await teamLabDatabase.open();

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startTeamLab().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Browser storage is unavailable.";
  root.render(
    <main className="fatal-error" role="alert">
      <h1>TeamLab could not start</h1>
      <p>{message}</p>
      <p>Reload the page or check that browser storage is available.</p>
    </main>,
  );
});
