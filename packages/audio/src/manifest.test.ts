import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getManifestPath, loadManifest, saveManifest } from "./manifest.js";
import { createEmptyAudioManifest } from "./types.js";

describe("manifest", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "pithos-audio-manifest-test-"));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it("returns an empty manifest when no file exists yet", async () => {
    const manifest = await loadManifest(repoRoot);
    expect(manifest).toEqual(createEmptyAudioManifest());
  });

  it("returns an empty manifest when the file fails to parse", async () => {
    const path = getManifestPath(repoRoot);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "{ this is not valid json", "utf8");

    const manifest = await loadManifest(repoRoot);
    expect(manifest).toEqual(createEmptyAudioManifest());
  });

  it("round-trips a populated manifest through save then load", async () => {
    const manifest = createEmptyAudioManifest();
    manifest.characterVoiceIds.elpis = "voice-abc123";
    manifest.voiceLines.elpis_main_menu_intro = {
      cueId: "elpis_main_menu_intro",
      selectedTakeId: "take-1",
      takes: [
        {
          id: "take-1",
          cueId: "elpis_main_menu_intro",
          provider: "mock",
          generatedAt: "2026-07-06T00:00:00.000Z",
          filePath: "voice/elpis_main_menu_intro/take-1.wav",
          prompt: "...someone's there. Please — still be there.",
        },
      ],
    };

    await saveManifest(repoRoot, manifest);
    const loaded = await loadManifest(repoRoot);

    expect(loaded).toEqual(manifest);
  });

  it("creates the assets/audio directory on save if it doesn't exist", async () => {
    const manifest = createEmptyAudioManifest();
    await saveManifest(repoRoot, manifest);
    const loaded = await loadManifest(repoRoot);
    expect(loaded).toEqual(manifest);
  });
});
