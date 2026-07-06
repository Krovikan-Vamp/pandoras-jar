import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AdminAudioPanel } from "@pithos/ui";

const ADMIN_AUDIO_HASH = "#/admin/audio";

/**
 * Dev-only escape hatch: if the URL hash requests the audio admin panel,
 * mount it in place of the game and tell the caller to skip booting the
 * real game loop. No router library — this is the only "route" that
 * exists outside the game itself.
 */
export function mountAdminRouteIfRequested(): boolean {
  if (window.location.hash !== ADMIN_AUDIO_HASH) {
    return false;
  }

  const container = document.createElement("div");
  container.id = "admin-audio-root";
  // apps/game's index.html sets `html, body { overflow: hidden; background:
  // #1a1a1c }` for the game canvas. Take this layer fully out of that flow
  // (fixed + its own scroll + opaque background) so the panel isn't clipped
  // or rendered as dark text on a near-black page.
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.overflow = "auto";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(createElement(AdminAudioPanel));

  return true;
}
