/**
 * AI voice/SFX generation + admin-panel contracts. This package is
 * Node-only (uses node:fs/Buffer) — it's consumed exclusively by
 * apps/game's Vite dev-server plugin (server-side), never bundled into the
 * browser game client. The browser only ever loads the *selected* audio
 * files as plain static assets (via <audio src="...">); it never talks to
 * ElevenLabs or reads the manifest directly.
 *
 * "Saved to the game itself, not just my session": the manifest and every
 * generated take are written to assets/audio/ at the repo root — real,
 * git-trackable files, not browser localStorage/IndexedDB.
 */

export type VoiceCharacterId =
  | "elpis"
  | "ponos"
  | "loimos"
  | "algea"
  | "geras"
  | "phthonos"
  | "kenoma"
  | "narrator";

/** A short 1-2 sentence description of the character's voice, fed to ElevenLabs Voice Design to generate a bespoke ("personalized") voice — not picked from a stock library. */
export interface VoiceCharacterProfile {
  id: VoiceCharacterId;
  displayName: string;
  voiceDescription: string;
}

export interface VoiceLineCue {
  /** Stable id, e.g. "elpis_main_menu_intro". */
  id: string;
  characterId: VoiceCharacterId;
  /** The exact line to be spoken. */
  text: string;
  /** Where/when it plays — shown in the admin panel for context, not sent to the generator. */
  context?: string;
}

export type SfxCategory = "movement" | "combat" | "ui" | "ambient" | "boss";

export interface SfxCue {
  /** Stable id, e.g. "dash_woosh". */
  id: string;
  category: SfxCategory;
  /** A text prompt describing the sound, sent to the SFX generator. */
  description: string;
  durationSecondsHint?: number;
}

export interface AudioTake {
  id: string;
  cueId: string;
  provider: "elevenlabs" | "mock";
  generatedAt: string;
  /** Relative path under assets/audio/generated/, e.g. "voice/elpis_main_menu_intro/take-1.mp3". */
  filePath: string;
  /** Exact text/prompt sent to the generator for this take. */
  prompt: string;
  /** ElevenLabs voice_id used, for voice takes. */
  providerVoiceId?: string;
}

export interface AudioManifestEntry {
  cueId: string;
  selectedTakeId: string | null;
  takes: AudioTake[];
}

export interface AudioManifest {
  schemaVersion: number;
  /** Provider voice_id generated per character via Voice Design — created once, reused for every line of that character's dialogue. */
  characterVoiceIds: Partial<Record<VoiceCharacterId, string>>;
  voiceLines: Record<string, AudioManifestEntry>;
  sfx: Record<string, AudioManifestEntry>;
}

export const CURRENT_AUDIO_MANIFEST_SCHEMA_VERSION = 1;

export function createEmptyAudioManifest(): AudioManifest {
  return {
    schemaVersion: CURRENT_AUDIO_MANIFEST_SCHEMA_VERSION,
    characterVoiceIds: {},
    voiceLines: {},
    sfx: {},
  };
}

export interface GeneratedAudio {
  audio: Buffer;
  /** File extension without the dot, e.g. "mp3". */
  extension: string;
}

export interface VoiceGenerationAdapter {
  readonly providerId: "elevenlabs" | "mock";
  /** Returns a provider voice_id for this character, creating one via Voice Design on first call and caching it in the manifest thereafter (handled by the caller, not this method). */
  ensureCharacterVoice(profile: VoiceCharacterProfile): Promise<string>;
  generateVoiceTake(cue: VoiceLineCue, providerVoiceId: string): Promise<GeneratedAudio>;
}

export interface SfxGenerationAdapter {
  readonly providerId: "elevenlabs" | "mock";
  generateSfxTake(cue: SfxCue): Promise<GeneratedAudio>;
}
