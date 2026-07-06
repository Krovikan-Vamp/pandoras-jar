import { describe, expect, it } from "vitest";

import type { SfxCue, VoiceCharacterProfile, VoiceLineCue } from "../types.js";
import { MockSfxAdapter, MockVoiceAdapter } from "./MockAdapter.js";

const ELPIS_PROFILE: VoiceCharacterProfile = {
  id: "elpis",
  displayName: "Elpis, the Spirit of Hope",
  voiceDescription: "A faint, tired, unmistakably alive voice.",
};

const VOICE_LINE: VoiceLineCue = {
  id: "elpis_main_menu_intro",
  characterId: "elpis",
  text: "...someone's there. Please — still be there.",
};

const SFX_CUE: SfxCue = {
  id: "dash_woosh",
  category: "movement",
  description: "A sharp, airy whoosh of a fast dash through still air, ~0.3 seconds.",
  durationSecondsHint: 0.3,
};

function readWavHeader(buffer: Buffer) {
  return {
    riff: buffer.toString("ascii", 0, 4),
    wave: buffer.toString("ascii", 8, 12),
    fmt: buffer.toString("ascii", 12, 16),
    dataTag: buffer.toString("ascii", 36, 40),
    audioFormat: buffer.readUInt16LE(20),
    channels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    bitsPerSample: buffer.readUInt16LE(34),
    dataSize: buffer.readUInt32LE(40),
  };
}

describe("MockVoiceAdapter", () => {
  it("ensureCharacterVoice is deterministic and stable per character id", async () => {
    const adapter = new MockVoiceAdapter();
    const first = await adapter.ensureCharacterVoice(ELPIS_PROFILE);
    const second = await adapter.ensureCharacterVoice(ELPIS_PROFILE);

    expect(first).toBe(second);
    expect(first).toBe("mock-voice-elpis");
  });

  it("ensureCharacterVoice differs per character id", async () => {
    const adapter = new MockVoiceAdapter();
    const elpisVoice = await adapter.ensureCharacterVoice(ELPIS_PROFILE);
    const ponosVoice = await adapter.ensureCharacterVoice({
      ...ELPIS_PROFILE,
      id: "ponos",
      displayName: "Ponos",
    });

    expect(elpisVoice).not.toBe(ponosVoice);
  });

  it("generateVoiceTake produces a non-empty, valid-looking WAV buffer", async () => {
    const adapter = new MockVoiceAdapter();
    const providerVoiceId = await adapter.ensureCharacterVoice(ELPIS_PROFILE);
    const { audio, extension } = await adapter.generateVoiceTake(VOICE_LINE, providerVoiceId);

    expect(extension).toBe("wav");
    expect(audio.length).toBeGreaterThan(44); // header + at least some sample data

    const header = readWavHeader(audio);
    expect(header.riff).toBe("RIFF");
    expect(header.wave).toBe("WAVE");
    expect(header.fmt).toBe("fmt ");
    expect(header.dataTag).toBe("data");
    expect(header.audioFormat).toBe(1); // PCM
    expect(header.channels).toBe(1);
    expect(header.sampleRate).toBeGreaterThan(0);
    expect(header.bitsPerSample).toBe(16);
    expect(header.dataSize).toBe(audio.length - 44);
  });

  it("generateVoiceTake is deterministic for the same cue", async () => {
    const adapter = new MockVoiceAdapter();
    const first = await adapter.generateVoiceTake(VOICE_LINE, "mock-voice-elpis");
    const second = await adapter.generateVoiceTake(VOICE_LINE, "mock-voice-elpis");

    expect(first.audio.equals(second.audio)).toBe(true);
  });
});

describe("MockSfxAdapter", () => {
  it("generateSfxTake produces a non-empty, valid-looking WAV buffer", async () => {
    const adapter = new MockSfxAdapter();
    const { audio, extension } = await adapter.generateSfxTake(SFX_CUE);

    expect(extension).toBe("wav");
    expect(audio.length).toBeGreaterThan(44);

    const header = readWavHeader(audio);
    expect(header.riff).toBe("RIFF");
    expect(header.wave).toBe("WAVE");
    expect(header.audioFormat).toBe(1);
    expect(header.dataSize).toBe(audio.length - 44);
  });

  it("respects durationSecondsHint (roughly) in the generated sample count", async () => {
    const adapter = new MockSfxAdapter();
    const short = await adapter.generateSfxTake({ ...SFX_CUE, durationSecondsHint: 0.5 });
    const long = await adapter.generateSfxTake({ ...SFX_CUE, durationSecondsHint: 2 });

    expect(long.audio.length).toBeGreaterThan(short.audio.length);
  });
});
