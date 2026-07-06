/**
 * Minimal, dependency-free WAV (RIFF/PCM) encoder used by the mock adapters
 * so the full generate -> save -> select -> <audio> playback pipeline is
 * exercisable end to end without any external API or npm dependency.
 *
 * Produces mono, 16-bit PCM audio: a fixed-format ~44-byte RIFF/WAVE header
 * followed by raw little-endian sample data.
 */

const SAMPLE_RATE_HZ = 44100;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const WAV_HEADER_SIZE = 44;

/**
 * Generates a short sine-wave tone, faded in/out to avoid clicks at the
 * boundaries, encoded as a valid standalone WAV file.
 */
export function generateSineWaveWav(durationSeconds: number, frequencyHz: number): Buffer {
  const clampedDuration = Math.min(Math.max(durationSeconds, 0.1), 30);
  const sampleCount = Math.max(1, Math.round(clampedDuration * SAMPLE_RATE_HZ));
  const blockAlign = CHANNEL_COUNT * BYTES_PER_SAMPLE;
  const byteRate = SAMPLE_RATE_HZ * blockAlign;
  const dataSize = sampleCount * blockAlign;

  const buffer = Buffer.alloc(WAV_HEADER_SIZE + dataSize);

  // RIFF chunk descriptor.
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");

  // "fmt " sub-chunk.
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // sub-chunk size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format: 1 = PCM
  buffer.writeUInt16LE(CHANNEL_COUNT, 22);
  buffer.writeUInt32LE(SAMPLE_RATE_HZ, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // "data" sub-chunk.
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  const amplitude = 0.2 * 32767; // quiet by design — this is a placeholder tone, not final audio
  const fadeSamples = Math.min(sampleCount, Math.round(SAMPLE_RATE_HZ * 0.01)); // ~10ms fade

  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE_HZ;
    let sample = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;

    if (fadeSamples > 0) {
      if (i < fadeSamples) sample *= i / fadeSamples;
      const samplesFromEnd = sampleCount - i;
      if (samplesFromEnd < fadeSamples) sample *= samplesFromEnd / fadeSamples;
    }

    buffer.writeInt16LE(Math.round(sample), WAV_HEADER_SIZE + i * BYTES_PER_SAMPLE);
  }

  return buffer;
}

/** Deterministically maps a string (e.g. a cue id) to a value in [0, 1). */
export function hashStringToUnitInterval(input: string): number {
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Force unsigned 32-bit, then normalize to [0, 1).
  return (hash >>> 0) / 0xffffffff;
}
