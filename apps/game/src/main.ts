import { createRunFlowActor } from "@pithos/sim";
import { IndexedDbSaveAdapter } from "@pithos/save";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { mountAdminRouteIfRequested } from "./admin/mountAdminRoute";
import { GameShell } from "./GameShell";

async function main(): Promise<void> {
  if (mountAdminRouteIfRequested()) return;

  const appRoot = document.querySelector<HTMLDivElement>("#app");
  if (!appRoot) throw new Error("#app root element not found");

  const saveAdapter = new IndexedDbSaveAdapter();
  const initialMeta = await saveAdapter.loadMeta();
  const runFlowActor = createRunFlowActor();

  const reactRoot = createRoot(appRoot);
  reactRoot.render(createElement(GameShell, { runFlowActor, saveAdapter, initialMeta }));
}

main().catch((error: unknown) => {
  console.error("Failed to start PITHOS:", error);
});
