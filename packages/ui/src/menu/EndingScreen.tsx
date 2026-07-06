import type { CSSProperties, JSX } from "react";
import { useEffect } from "react";

import { useVoiceLine } from "../dialogue/useVoiceLine";
import { bodyTextStyle, colors, fonts, primaryButtonStyle, quietButtonStyle, screenBase, titleStyle } from "./theme";

export interface EndingScreenProps {
  isFullCompletion: boolean;
  onNewGamePlus: () => void;
  onReturnToMenu: () => void;
}

/**
 * Ending — GDD.md §2 "Ending — Saving Hope" + "New Game+ — The Second
 * Kindling". Two genuinely different epilogues:
 *  - Full completion (all Fragments + optional side content): Elpis steps
 *    fully into the world above for the first time (cue: elpis_ending_full).
 *  - Baseline: Elpis is whole but stays tethered at the threshold, an
 *    explicit hook for future content rather than a "bad" ending
 *    (cue: elpis_ending_baseline).
 * The shared epilogue narration ("color returns to the sky first...") has
 * no dedicated voice cue in seedCues.ts, so it's rendered directly as
 * GDD-adapted prose per the task's fallback guidance.
 */
export function EndingScreen({ isFullCompletion, onNewGamePlus, onReturnToMenu }: EndingScreenProps): JSX.Element {
  const cueId = isFullCompletion ? "elpis_ending_full" : "elpis_ending_baseline";
  const { text, play } = useVoiceLine(cueId);

  useEffect(() => {
    play();
  }, [play]);

  const fallback = isFullCompletion
    ? "I remember warmth. I think... I think I remember it now. Walk with me?"
    : "Go on up, if you want to. Tell me what it looks like — the sky, when it isn't grey. I'll be right here.";

  const accent = isFullCompletion ? colors.goldBright : colors.schoolAir;
  const background = isFullCompletion
    ? `radial-gradient(ellipse at 50% 30%, #4a3f6b 0%, ${colors.ashDark} 55%, #000 100%), linear-gradient(0deg, ${colors.goldDim}22 0%, transparent 40%)`
    : `radial-gradient(ellipse at 50% 40%, ${colors.ashMid} 0%, ${colors.ashDark} 65%, #000 100%)`;

  return (
    <div style={{ ...styles.root, background }}>
      <div style={styles.vignette} />

      <p style={styles.eyebrow}>{isFullCompletion ? "Hope, Restored" : "Hope, Held"}</p>

      <p style={styles.narration}>
        Color returns to the sky first. Then to people&rsquo;s faces — small, unremarkable: someone laughs at a joke,
        someone plants something they intend to see grow. The jar doesn&rsquo;t disappear; it stays, cracked open,
        sunlight pouring through it, permanently.
      </p>

      <p style={styles.narration}>
        {isFullCompletion
          ? "And for the first time, Elpis steps fully into the world above."
          : "Elpis is whole again — but she stays at the threshold, tethered, watching the light reach a little further than it used to."}
      </p>

      <p style={{ ...styles.voiceLine, color: accent }}>{`"${text ?? fallback}"`}</p>

      <div style={styles.buttonRow}>
        <button type="button" style={primaryButtonStyle(accent)} onClick={onNewGamePlus}>
          Begin the Second Kindling
        </button>
      </div>
      <button type="button" style={quietButtonStyle} onClick={onReturnToMenu}>
        Return to Menu
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    ...screenBase,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    boxShadow: "inset 0 0 180px 60px rgba(0,0,0,0.7)",
    pointerEvents: "none",
  },
  eyebrow: {
    fontFamily: fonts.display,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontSize: 13,
    color: colors.goldDim,
    marginBottom: 24,
  },
  narration: {
    ...bodyTextStyle,
    fontStyle: "normal",
    fontSize: 17,
    maxWidth: 620,
    marginBottom: 18,
  },
  voiceLine: {
    ...bodyTextStyle,
    fontSize: 18,
    marginTop: 12,
    marginBottom: 40,
  },
  buttonRow: {
    display: "flex",
    gap: 20,
    marginBottom: 16,
  },
};
