import type { CSSProperties, JSX } from "react";
import { useEffect } from "react";

import { useVoiceLine } from "../dialogue/useVoiceLine";
import { bodyTextStyle, colors, fonts, primaryButtonStyle, screenBase, titleStyle } from "./theme";

export interface MidpointRevelationScreenProps {
  onContinue: () => void;
}

/**
 * Midpoint Revelation — GDD.md §2: once several Hope Fragments are back,
 * Elpis realizes something is holding the rest of her apart. First mention
 * of Kenoma ("the Emptiness"). This is the game's tonal pivot — "oh no,
 * it's not over" — so the palette drops the Main Menu's warm ash/gold for
 * something colder and hollower, and pacing is implied through generous
 * whitespace/line-height rather than the tighter menu layout.
 */
export function MidpointRevelationScreen({ onContinue }: MidpointRevelationScreenProps): JSX.Element {
  const { text, play } = useVoiceLine("elpis_midpoint_revelation");

  useEffect(() => {
    play();
  }, [play]);

  const fallback =
    "Something's wrong. I should be whole by now — I can feel more of myself than I could before, but " +
    "something is still holding the rest of me apart. Something at the very bottom of this jar. Older " +
    "than the Spites. It's been feeding on the Grey Hush this whole time.";

  return (
    <div style={styles.root}>
      <div style={styles.vignette} />

      <div style={styles.hollow} />

      <p style={styles.eyebrow}>Elpis's Sanctuary</p>
      <p style={styles.voiceLine}>{`"${text ?? fallback}"`}</p>

      <p style={styles.kenoma}>Kenoma.</p>
      <p style={styles.subtext}>The Emptiness. Older than the Spites. Still hungry.</p>

      <button type="button" style={primaryButtonStyle(colors.voidAccent)} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    ...screenBase,
    background: `radial-gradient(ellipse at 50% 40%, ${colors.voidMid} 0%, ${colors.voidDeep} 65%, #000 100%)`,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    boxShadow: "inset 0 0 220px 80px rgba(0,0,0,0.85)",
    pointerEvents: "none",
  },
  hollow: {
    position: "absolute",
    top: "18%",
    left: "50%",
    width: 220,
    height: 220,
    transform: "translateX(-50%)",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${colors.voidAccent}22 0%, transparent 72%)`,
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  eyebrow: {
    fontFamily: fonts.display,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontSize: 12,
    color: colors.ashTextDim,
    marginBottom: 18,
  },
  voiceLine: {
    ...bodyTextStyle,
    fontSize: 19,
    color: colors.ashText,
    maxWidth: 620,
    marginBottom: 36,
  },
  kenoma: {
    ...titleStyle,
    fontSize: 38,
    letterSpacing: "0.3em",
    color: colors.voidAccent,
    margin: "0 0 8px",
    textShadow: `0 0 24px ${colors.voidAccent}88`,
  },
  subtext: {
    fontFamily: fonts.body,
    fontStyle: "italic",
    fontSize: 14,
    color: colors.ashTextDim,
    marginBottom: 44,
  },
};
