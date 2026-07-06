import type { CSSProperties, JSX } from "react";
import { useEffect } from "react";

import { useVoiceLine } from "../dialogue/useVoiceLine";
import { bodyTextStyle, colors, fonts, primaryButtonStyle, screenBase, titleStyle } from "./theme";

export interface MainMenuScreenProps {
  onStartGame: () => void;
  onContinue: () => void;
  hasSaveData: boolean;
}

/**
 * Main Menu — GDD.md §2: "Cold, ash-toned art direction. A cracked jar sits
 * at the center of a dead, grey courtyard. A single hairline of golden
 * light escapes the crack." The quiet VO line here — "...someone's there.
 * Please — still be there." — is the player's first time hearing Elpis.
 *
 * Looping note: `play()` fires once on mount. A true seamless loop would
 * need to know the underlying `<audio>` element's real duration/`ended`
 * event, which `useVoiceLine` doesn't expose (it hands back a fire-and-
 * forget `play()`, not the `Audio` instance) — wiring that up cleanly
 * belongs in `useVoiceLine` itself, not this screen. Single play-on-mount
 * is the intentional, simpler choice for now.
 */
export function MainMenuScreen({ onStartGame, onContinue, hasSaveData }: MainMenuScreenProps): JSX.Element {
  const { text, play } = useVoiceLine("elpis_main_menu_intro");

  useEffect(() => {
    play();
  }, [play]);

  return (
    <div style={styles.root}>
      <div style={styles.vignette} />

      <div style={styles.jarWrap}>
        <div style={styles.jarBody}>
          <div style={styles.jarCrack} />
          <div style={styles.jarGlow} />
        </div>
      </div>

      <h1 style={styles.title}>Pithos: Embers of Elpis</h1>

      <p style={styles.voiceLine}>{text ? `"${text}"` : "…"}</p>

      <div style={styles.buttonRow}>
        <button
          type="button"
          style={primaryButtonStyle(colors.goldBright)}
          onClick={onStartGame}
        >
          Descend
        </button>
        {hasSaveData ? (
          <button
            type="button"
            style={{ ...primaryButtonStyle(colors.ashLight), boxShadow: "none" }}
            onClick={onContinue}
          >
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    ...screenBase,
    background: `radial-gradient(ellipse at 50% 55%, ${colors.ashMid} 0%, ${colors.ashDark} 70%, #000 100%)`,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    boxShadow: "inset 0 0 180px 60px rgba(0,0,0,0.75)",
    pointerEvents: "none",
  },
  jarWrap: {
    marginBottom: 32,
  },
  jarBody: {
    position: "relative",
    width: 140,
    height: 190,
    borderRadius: "50% 50% 45% 45% / 30% 30% 70% 70%",
    background: `linear-gradient(180deg, ${colors.ashLight} 0%, ${colors.ashMid} 60%, ${colors.ashDark} 100%)`,
    border: `1px solid ${colors.ashLight}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  jarCrack: {
    position: "absolute",
    top: "8%",
    left: "50%",
    width: 3,
    height: "84%",
    transform: "translateX(-50%) rotate(4deg)",
    background: `linear-gradient(180deg, ${colors.goldBright} 0%, ${colors.goldDim} 100%)`,
    boxShadow: `0 0 12px 2px ${colors.goldBright}`,
  },
  jarGlow: {
    position: "absolute",
    top: "45%",
    left: "50%",
    width: 60,
    height: 60,
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${colors.goldBright}aa 0%, transparent 70%)`,
    filter: "blur(6px)",
  },
  title: {
    ...titleStyle,
    fontSize: 30,
    color: colors.ashText,
    margin: "0 0 20px",
    fontFamily: fonts.display,
  },
  voiceLine: {
    ...bodyTextStyle,
    color: colors.goldDim,
    marginBottom: 40,
    minHeight: 24,
  },
  buttonRow: {
    display: "flex",
    gap: 20,
  },
};
