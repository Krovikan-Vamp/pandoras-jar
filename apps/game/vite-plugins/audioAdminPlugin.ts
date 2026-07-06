/**
 * Dev-server-only Vite plugin exposing the AI voice/SFX generation pipeline
 * (@pithos/audio) over HTTP so a browser-based admin panel can drive it.
 *
 * IMPORTANT: this must never run during `vite build` — it shells out to
 * ElevenLabs, reads/writes files under assets/audio/, and imports a
 * Node-only package. `apply: "serve"` restricts it to `vite dev`.
 *
 * @pithos/audio is declared as a workspace dependency of the `game` package
 * even though it's only consumed here, server-side, by this dev-only
 * plugin. Run `pnpm --filter @pithos/audio build` before `vite dev` picks
 * this file up (its `dist/` output is what the package.json "main"/"types"
 * fields resolve to).
 */

import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";

import type { Connect, Plugin } from "vite";
import { loadEnv } from "vite";

import type {
  AudioManifestEntry,
  AudioTake,
  GeneratedAudio,
  SfxCue,
  SfxGenerationAdapter,
  VoiceCharacterProfile,
  VoiceGenerationAdapter,
  VoiceLineCue,
} from "@pithos/audio";
import {
  ElevenLabsSfxAdapter,
  ElevenLabsVoiceAdapter,
  loadManifest,
  MockSfxAdapter,
  MockVoiceAdapter,
  saveManifest,
  SEED_SFX_CUES,
  SEED_VOICE_LINES,
  VOICE_CHARACTER_PROFILES,
} from "@pithos/audio";

const ADMIN_API_PREFIX = "/__audio_admin/";
const STATIC_FILES_PREFIX = "/audio-admin-files/";

type CueKind = "voice" | "sfx";

/** A well-known 4xx/5xx error with a message safe to send to the client as JSON. */
class AdminApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

interface ProviderContext {
  providerId: "elevenlabs" | "mock";
  voiceAdapter: VoiceGenerationAdapter;
  sfxAdapter: SfxGenerationAdapter;
  reason?: string;
}

function resolveProvider(repoRoot: string, mode: string): ProviderContext {
  // Empty prefix ("") intentionally, so this isn't restricted to
  // VITE_-prefixed vars — safe because this code only ever runs server-side.
  const env = loadEnv(mode, repoRoot, "");
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (apiKey) {
    return {
      providerId: "elevenlabs",
      voiceAdapter: new ElevenLabsVoiceAdapter(apiKey),
      sfxAdapter: new ElevenLabsSfxAdapter(apiKey),
    };
  }
  return {
    providerId: "mock",
    voiceAdapter: new MockVoiceAdapter(),
    sfxAdapter: new MockSfxAdapter(),
    reason: "ELEVENLABS_API_KEY is not set (checked the repo root .env) — using local placeholder audio instead.",
  };
}

function generatedAudioDir(repoRoot: string): string {
  return join(repoRoot, "assets", "audio", "generated");
}

function findVoiceLineCue(cueId: string): VoiceLineCue {
  const cue = SEED_VOICE_LINES.find((line) => line.id === cueId);
  if (!cue) throw new AdminApiError(404, `Unknown voice line cue id "${cueId}"`);
  return cue;
}

function findSfxCue(cueId: string): SfxCue {
  const cue = SEED_SFX_CUES.find((sfx) => sfx.id === cueId);
  if (!cue) throw new AdminApiError(404, `Unknown SFX cue id "${cueId}"`);
  return cue;
}

function findCharacterProfile(characterId: string): VoiceCharacterProfile {
  const profile = VOICE_CHARACTER_PROFILES.find((candidate) => candidate.id === characterId);
  if (!profile) {
    throw new AdminApiError(500, `No voice profile registered for character "${characterId}"`);
  }
  return profile;
}

function getOrCreateEntry(bucket: Record<string, AudioManifestEntry>, cueId: string): AudioManifestEntry {
  const existing = bucket[cueId];
  if (existing) return existing;
  const created: AudioManifestEntry = { cueId, selectedTakeId: null, takes: [] };
  bucket[cueId] = created;
  return created;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

function sendErrorResponse(res: ServerResponse, error: unknown): void {
  if (error instanceof AdminApiError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }
  console.error("[audio-admin] unexpected error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  sendJson(res, 500, { error: message });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AdminApiError(400, "Request body is not valid JSON");
  }
}

interface GenerateRequestBody {
  cueId: string;
  kind: CueKind;
}

function parseGenerateBody(body: unknown): GenerateRequestBody {
  if (typeof body !== "object" || body === null) {
    throw new AdminApiError(400, 'Request body must be a JSON object with "cueId" and "kind"');
  }
  const { cueId, kind } = body as Record<string, unknown>;
  if (typeof cueId !== "string" || cueId.length === 0) {
    throw new AdminApiError(400, '"cueId" must be a non-empty string');
  }
  if (kind !== "voice" && kind !== "sfx") {
    throw new AdminApiError(400, '"kind" must be "voice" or "sfx"');
  }
  return { cueId, kind };
}

interface SelectRequestBody extends GenerateRequestBody {
  takeId: string;
}

function parseSelectBody(body: unknown): SelectRequestBody {
  const { cueId, kind } = parseGenerateBody(body);
  const { takeId } = body as Record<string, unknown>;
  if (typeof takeId !== "string" || takeId.length === 0) {
    throw new AdminApiError(400, '"takeId" must be a non-empty string');
  }
  return { cueId, kind, takeId };
}

function toPreviewUrl(filePath: string): string {
  return `${STATIC_FILES_PREFIX}${filePath}`;
}

async function handleStatus(repoRoot: string, mode: string, res: ServerResponse): Promise<void> {
  const provider = resolveProvider(repoRoot, mode);
  sendJson(
    res,
    200,
    provider.reason
      ? { providerActive: provider.providerId, reason: provider.reason }
      : { providerActive: provider.providerId },
  );
}

async function handleCues(repoRoot: string, res: ServerResponse): Promise<void> {
  const manifest = await loadManifest(repoRoot);
  const voiceLines = SEED_VOICE_LINES.map((cue) => ({
    cue,
    manifestEntry: manifest.voiceLines[cue.id] ?? { cueId: cue.id, selectedTakeId: null, takes: [] },
  }));
  const sfx = SEED_SFX_CUES.map((cue) => ({
    cue,
    manifestEntry: manifest.sfx[cue.id] ?? { cueId: cue.id, selectedTakeId: null, takes: [] },
  }));
  sendJson(res, 200, { voiceLines, sfx });
}

async function handleGenerate(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
  mode: string,
): Promise<void> {
  const { cueId, kind } = parseGenerateBody(await readJsonBody(req));
  const provider = resolveProvider(repoRoot, mode);
  const manifest = await loadManifest(repoRoot);

  let generated: GeneratedAudio;
  let prompt: string;
  let providerVoiceId: string | undefined;

  if (kind === "voice") {
    const cue = findVoiceLineCue(cueId);
    providerVoiceId = manifest.characterVoiceIds[cue.characterId];
    if (!providerVoiceId) {
      const profile = findCharacterProfile(cue.characterId);
      providerVoiceId = await provider.voiceAdapter.ensureCharacterVoice(profile);
      manifest.characterVoiceIds[cue.characterId] = providerVoiceId;
    }
    generated = await provider.voiceAdapter.generateVoiceTake(cue, providerVoiceId);
    prompt = cue.text;
  } else {
    const cue = findSfxCue(cueId);
    generated = await provider.sfxAdapter.generateSfxTake(cue);
    prompt = cue.description;
  }

  const takeId = `take-${randomUUID()}`;
  const relativeFilePath = [kind, cueId, `${takeId}.${generated.extension}`].join("/");
  const absoluteFilePath = join(generatedAudioDir(repoRoot), kind, cueId, `${takeId}.${generated.extension}`);
  await mkdir(dirname(absoluteFilePath), { recursive: true });
  await writeFile(absoluteFilePath, generated.audio);

  const take: AudioTake = {
    id: takeId,
    cueId,
    provider: provider.providerId,
    generatedAt: new Date().toISOString(),
    filePath: relativeFilePath,
    prompt,
    ...(providerVoiceId ? { providerVoiceId } : {}),
  };

  const bucket = kind === "voice" ? manifest.voiceLines : manifest.sfx;
  const entry = getOrCreateEntry(bucket, cueId);
  entry.takes.push(take);

  await saveManifest(repoRoot, manifest);

  sendJson(res, 200, { take, previewUrl: toPreviewUrl(take.filePath) });
}

async function handleSelect(req: IncomingMessage, res: ServerResponse, repoRoot: string): Promise<void> {
  const { cueId, kind, takeId } = parseSelectBody(await readJsonBody(req));
  const manifest = await loadManifest(repoRoot);
  const bucket = kind === "voice" ? manifest.voiceLines : manifest.sfx;
  const entry = bucket[cueId];
  if (!entry) {
    throw new AdminApiError(404, `No generated takes yet for cue "${cueId}"`);
  }
  const takeExists = entry.takes.some((take) => take.id === takeId);
  if (!takeExists) {
    throw new AdminApiError(404, `Take "${takeId}" does not exist for cue "${cueId}"`);
  }
  entry.selectedTakeId = takeId;
  await saveManifest(repoRoot, manifest);
  sendJson(res, 200, entry);
}

function contentTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

async function handleStaticFile(pathname: string, repoRoot: string, res: ServerResponse): Promise<void> {
  const relativePath = decodeURIComponent(pathname.slice(STATIC_FILES_PREFIX.length));
  const baseDir = generatedAudioDir(repoRoot);
  const resolvedPath = resolve(baseDir, relativePath);

  // Guard against path traversal (e.g. "../../../etc/passwd").
  if (resolvedPath !== baseDir && !resolvedPath.startsWith(baseDir + sep)) {
    throw new AdminApiError(403, "Invalid file path");
  }

  let fileStat;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    throw new AdminApiError(404, `No such generated audio file: ${relativePath}`);
  }
  if (!fileStat.isFile()) {
    throw new AdminApiError(404, `No such generated audio file: ${relativePath}`);
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypeForExtension(extname(resolvedPath)));
  res.setHeader("Content-Length", String(fileStat.size));

  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(resolvedPath);
    stream.on("error", rejectStream);
    stream.on("close", () => resolveStream());
    stream.pipe(res);
  });
}

async function handleRequest(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  repoRoot: string,
  mode: string,
): Promise<void> {
  const url = req.url;
  if (!url) {
    next();
    return;
  }
  const pathname = url.split("?")[0] ?? url;

  try {
    if (pathname.startsWith(STATIC_FILES_PREFIX)) {
      await handleStaticFile(pathname, repoRoot, res);
      return;
    }
    if (pathname === `${ADMIN_API_PREFIX}status`) {
      if (req.method !== "GET") throw new AdminApiError(405, "Method not allowed, expected GET");
      await handleStatus(repoRoot, mode, res);
      return;
    }
    if (pathname === `${ADMIN_API_PREFIX}cues`) {
      if (req.method !== "GET") throw new AdminApiError(405, "Method not allowed, expected GET");
      await handleCues(repoRoot, res);
      return;
    }
    if (pathname === `${ADMIN_API_PREFIX}generate`) {
      if (req.method !== "POST") throw new AdminApiError(405, "Method not allowed, expected POST");
      await handleGenerate(req, res, repoRoot, mode);
      return;
    }
    if (pathname === `${ADMIN_API_PREFIX}select`) {
      if (req.method !== "POST") throw new AdminApiError(405, "Method not allowed, expected POST");
      await handleSelect(req, res, repoRoot);
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error);
    return;
  }

  next();
}

/**
 * @param repoRoot Absolute path to the monorepo root (parent of apps/ and packages/).
 */
export function audioAdminPlugin(repoRoot: string): Plugin {
  return {
    name: "pithos-audio-admin",
    apply: "serve",
    configureServer(server) {
      const mode = server.config.mode;
      server.middlewares.use((req, res, next) => {
        handleRequest(req, res, next, repoRoot, mode).catch((error: unknown) => {
          sendErrorResponse(res, error);
        });
      });
    },
  };
}
