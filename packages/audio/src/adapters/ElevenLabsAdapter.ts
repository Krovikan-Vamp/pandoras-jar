/**
 * Real ElevenLabs-backed adapters. Implemented against plain REST calls
 * (fetch) — no ElevenLabs SDK dependency.
 *
 * Confirmed current (as of 2026-07-06) request/response shapes by
 * downloading and reading the source of the actively-maintained
 * `@elevenlabs/elevenlabs-js` npm package (v2.56.0, published 2026-07-01 —
 * the ElevenLabs docs site itself returned 403s to automated fetches during
 * research, so the published SDK source was used as the authoritative
 * cross-check instead; see packages/audio/README hand-off notes / PR
 * description for the full research trail):
 *
 * - Text to Speech:      POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 * - Voice Design preview: POST https://api.elevenlabs.io/v1/text-to-voice/design
 * - Voice Design create:  POST https://api.elevenlabs.io/v1/text-to-voice
 * - Sound generation:     POST https://api.elevenlabs.io/v1/sound-generation
 *
 * All four take the API key in an `xi-api-key` header and a JSON body;
 * text-to-speech and sound-generation return raw binary audio bytes
 * (`audio/mpeg` for the default `mp3_44100_128` output format), while the
 * two text-to-voice endpoints return JSON.
 *
 * The voice-design flow is still (as of this writing) a two-step
 * preview-then-create flow, not a single call: `design` returns several
 * short preview samples (each with a `generated_voice_id`) generated from a
 * text description, and a *separate* `create` call turns one chosen preview
 * into a permanent voice with its own durable `voice_id`. The older
 * `/v1/text-to-voice/create-previews` + `/v1/text-to-voice/create-voice-from-preview`
 * endpoint pair still exists but is the legacy alias for this same flow;
 * `design` / plain `POST /v1/text-to-voice` are the current, preferred
 * names.
 */

import type {
  GeneratedAudio,
  SfxCue,
  SfxGenerationAdapter,
  VoiceCharacterProfile,
  VoiceGenerationAdapter,
  VoiceLineCue,
} from "../types.js";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

/** Default output format for generated audio: mp3, 44.1kHz, 128kbps. */
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_TTS_MODEL_ID = "eleven_multilingual_v2";
/** Voice Design's dedicated text-to-voice model (falls back gracefully if unavailable for the account). */
const DEFAULT_VOICE_DESIGN_MODEL_ID = "eleven_ttv_v3";
const DEFAULT_SFX_PROMPT_INFLUENCE = 0.3;

interface VoicePreviewResponseModel {
  audio_base_64: string;
  generated_voice_id: string;
  media_type: string;
  duration_secs: number;
  language?: string;
}

interface VoiceDesignPreviewResponse {
  previews: VoicePreviewResponseModel[];
  text: string;
}

interface CreatedVoiceResponse {
  voice_id: string;
  name?: string;
}

/** Thrown for any non-2xx ElevenLabs response; message includes the response body for debuggability. */
export class ElevenLabsApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    bodyText: string,
  ) {
    super(`ElevenLabs request to ${endpoint} failed with ${status}: ${bodyText || "<empty body>"}`);
    this.name = "ElevenLabsApiError";
  }
}

async function postJson(apiKey: string, path: string, body: Record<string, unknown>): Promise<Response> {
  const response = await fetch(`${ELEVENLABS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new ElevenLabsApiError(path, response.status, bodyText);
  }
  return response;
}

async function postJsonForAudio(apiKey: string, path: string, body: Record<string, unknown>): Promise<Buffer> {
  const response = await fetch(`${ELEVENLABS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new ElevenLabsApiError(path, response.status, bodyText);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Creates one bespoke, permanent voice per character via the Voice Design flow (preview -> create). */
export class ElevenLabsVoiceAdapter implements VoiceGenerationAdapter {
  readonly providerId = "elevenlabs" as const;

  constructor(private readonly apiKey: string) {}

  async ensureCharacterVoice(profile: VoiceCharacterProfile): Promise<string> {
    const designResponse = await postJson(this.apiKey, "/v1/text-to-voice/design", {
      voice_description: profile.voiceDescription,
      auto_generate_text: true,
      model_id: DEFAULT_VOICE_DESIGN_MODEL_ID,
    });
    const design = (await designResponse.json()) as VoiceDesignPreviewResponse;
    const chosenPreview = design.previews[0];
    if (!chosenPreview) {
      throw new Error(
        `ElevenLabs Voice Design returned no previews for character "${profile.id}" (description: "${profile.voiceDescription}")`,
      );
    }

    const createResponse = await postJson(this.apiKey, "/v1/text-to-voice", {
      voice_name: `pithos-${profile.id}`,
      voice_description: profile.voiceDescription,
      generated_voice_id: chosenPreview.generated_voice_id,
    });
    const createdVoice = (await createResponse.json()) as CreatedVoiceResponse;
    return createdVoice.voice_id;
  }

  async generateVoiceTake(cue: VoiceLineCue, providerVoiceId: string): Promise<GeneratedAudio> {
    const path = `/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=${DEFAULT_OUTPUT_FORMAT}`;
    const audio = await postJsonForAudio(this.apiKey, path, {
      text: cue.text,
      model_id: DEFAULT_TTS_MODEL_ID,
    });
    return { audio, extension: "mp3" };
  }
}

export class ElevenLabsSfxAdapter implements SfxGenerationAdapter {
  readonly providerId = "elevenlabs" as const;

  constructor(private readonly apiKey: string) {}

  async generateSfxTake(cue: SfxCue): Promise<GeneratedAudio> {
    const path = `/v1/sound-generation?output_format=${DEFAULT_OUTPUT_FORMAT}`;
    const body: Record<string, unknown> = {
      text: cue.description,
      prompt_influence: DEFAULT_SFX_PROMPT_INFLUENCE,
    };
    if (cue.durationSecondsHint !== undefined) {
      body.duration_seconds = cue.durationSecondsHint;
    }
    const audio = await postJsonForAudio(this.apiKey, path, body);
    return { audio, extension: "mp3" };
  }
}
