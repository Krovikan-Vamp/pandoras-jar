/**
 * Zero-dependency, zero-API-key adapters that synthesize placeholder audio
 * locally. These exist so the full pipeline (generate -> save file ->
 * select -> play back in a browser <audio> tag) is genuinely exercisable
 * end to end without ElevenLabs credentials — used automatically whenever
 * ELEVENLABS_API_KEY isn't configured.
 */

import type {
  GeneratedAudio,
  SfxCue,
  SfxGenerationAdapter,
  VoiceCharacterProfile,
  VoiceGenerationAdapter,
  VoiceLineCue,
} from "../types.js";
import { generateSineWaveWav, hashStringToUnitInterval } from "./wav.js";

const VOICE_BASE_FREQUENCY_HZ = 220;
const VOICE_FREQUENCY_RANGE_HZ = 220;
const SFX_BASE_FREQUENCY_HZ = 280;
const SFX_FREQUENCY_RANGE_HZ = 520;
const DEFAULT_SFX_DURATION_SECONDS = 1;

export class MockVoiceAdapter implements VoiceGenerationAdapter {
  readonly providerId = "mock" as const;

  /** Stable, deterministic placeholder id — no network call, no real voice creation. */
  async ensureCharacterVoice(profile: VoiceCharacterProfile): Promise<string> {
    return `mock-voice-${profile.id}`;
  }

  async generateVoiceTake(cue: VoiceLineCue, _providerVoiceId: string): Promise<GeneratedAudio> {
    // Pitch varies deterministically per-cue (so different lines are
    // audibly distinguishable) and duration scales roughly with line length.
    const unit = hashStringToUnitInterval(cue.id);
    const frequencyHz = VOICE_BASE_FREQUENCY_HZ + unit * VOICE_FREQUENCY_RANGE_HZ;
    const durationSeconds = Math.min(Math.max(cue.text.length / 15, 1), 6);
    return { audio: generateSineWaveWav(durationSeconds, frequencyHz), extension: "wav" };
  }
}

export class MockSfxAdapter implements SfxGenerationAdapter {
  readonly providerId = "mock" as const;

  async generateSfxTake(cue: SfxCue): Promise<GeneratedAudio> {
    const unit = hashStringToUnitInterval(cue.id);
    const frequencyHz = SFX_BASE_FREQUENCY_HZ + unit * SFX_FREQUENCY_RANGE_HZ;
    const durationSeconds = cue.durationSecondsHint ?? DEFAULT_SFX_DURATION_SECONDS;
    return { audio: generateSineWaveWav(durationSeconds, frequencyHz), extension: "wav" };
  }
}
