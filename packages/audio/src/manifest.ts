/**
 * Reads/writes the on-disk audio manifest at <repoRoot>/assets/audio/manifest.json.
 *
 * This is the single source of truth for which generated voice/SFX takes
 * exist and which one is currently selected for each cue. It's a real,
 * git-trackable file (not browser storage) so choices ship with the game.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { type AudioManifest, createEmptyAudioManifest } from "./types.js";

export function getManifestPath(repoRoot: string): string {
  return join(repoRoot, "assets", "audio", "manifest.json");
}

/**
 * Loads the manifest from disk. Falls back to a fresh, empty manifest (never
 * throws) if the file doesn't exist yet or if it fails to parse as valid
 * JSON — both are expected/normal states for a repo that hasn't generated
 * any audio yet.
 */
export async function loadManifest(repoRoot: string): Promise<AudioManifest> {
  const path = getManifestPath(repoRoot);
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isPlausibleManifest(parsed)) {
      return createEmptyAudioManifest();
    }
    return parsed;
  } catch {
    return createEmptyAudioManifest();
  }
}

/** Pretty-prints and writes the manifest, creating assets/audio/ if needed. */
export async function saveManifest(repoRoot: string, manifest: AudioManifest): Promise<void> {
  const path = getManifestPath(repoRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function isPlausibleManifest(value: unknown): value is AudioManifest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.characterVoiceIds === "object" &&
    candidate.characterVoiceIds !== null &&
    typeof candidate.voiceLines === "object" &&
    candidate.voiceLines !== null &&
    typeof candidate.sfx === "object" &&
    candidate.sfx !== null
  );
}
