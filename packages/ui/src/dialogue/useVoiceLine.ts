import { useCallback, useEffect, useState } from "react";

interface VoiceLineResult {
  /** True once a selected take's audio URL has resolved (may stay false forever if nothing's been generated/selected yet, or in a production build — see caveat below). */
  isReady: boolean;
  /** The line's text — always available immediately so UI can render it even before/without audio. */
  text: string | null;
  /** Plays the selected take's audio, if one exists. No-ops silently otherwise. */
  play: () => void;
}

interface CuesResponse {
  voiceLines: Array<{
    cue: { id: string; text: string };
    manifestEntry: {
      selectedTakeId: string | null;
      takes: Array<{ id: string; filePath: string }>;
    };
  }>;
}

/**
 * Resolves a `VoiceLineCue` id to its selected AI-generated take (from the
 * admin panel's assets/audio/manifest.json) and exposes a `play()` call.
 *
 * CAVEAT: this currently reads through the dev-only `/__audio_admin/cues`
 * endpoint (apps/game/vite-plugins/audioAdminPlugin.ts, `apply: "serve"`),
 * since that's the only thing that exists today that can resolve a cue id
 * to a file. This means voice playback works in `vite dev` but silently
 * no-ops in a production build — there is no asset-shipping pipeline yet
 * that copies selected takes into a static, production-servable location.
 * That's a real, documented gap for whoever does a production-build pass
 * later, not a bug in this hook.
 */
export function useVoiceLine(cueId: string): VoiceLineResult {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/__audio_admin/cues")
      .then((response) => (response.ok ? (response.json() as Promise<CuesResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const entry = data.voiceLines.find((line) => line.cue.id === cueId);
        if (!entry) return;

        setText(entry.cue.text);

        const selectedTake = entry.manifestEntry.takes.find(
          (take) => take.id === entry.manifestEntry.selectedTakeId,
        );
        if (selectedTake) {
          setAudioUrl(`/audio-admin-files/${selectedTake.filePath}`);
        }
      })
      .catch(() => {
        // Dev-only endpoint unavailable (production build, or the plugin
        // simply isn't running) — text/audio stay null, callers should
        // render their own fallback copy rather than block on this.
      });

    return () => {
      cancelled = true;
    };
  }, [cueId]);

  const play = useCallback(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play().catch(() => {
      // Autoplay/permission failures are expected in some browser contexts — non-fatal.
    });
  }, [audioUrl]);

  return { isReady: audioUrl !== null, text, play };
}
