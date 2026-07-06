import type { CSSProperties, JSX } from "react";

/**
 * Run Failed — shown when the `runFlow` machine reaches `runFailed`
 * (packages/sim/src/state/RunFlowMachine.ts), reached via `PLAYER_DIED`.
 * That state's `entry` action is `discardPendingIchor`: only the *current*
 * expedition's unbanked Ichor is lost, `ichorBankedThisRun` (and anything
 * saved from prior expeditions) is left completely untouched. Somber, but
 * deliberately not punishing — the copy exists specifically to say that
 * plainly so the player isn't left guessing what they did or didn't lose.
 */

export interface RunFailedScreenProps {
  onContinue: () => void;
}

export function RunFailedScreen({ onContinue }: RunFailedScreenProps): JSX.Element {
  return (
    <div style={styles.root}>
      <div style={styles.vignette} />
      <p style={styles.eyebrow}>The Depths Claim You</p>
      <h1 style={styles.title}>Expedition Lost</h1>
      <p style={styles.body}>
        Something in the jar finally caught up with you. Only the Ichor you were carrying from
        <em style={styles.emphasis}> this </em>
        expedition is gone — everything you'd already banked at the Threshold is untouched, and
        every Hope Fragment you've recovered stays recovered.
      </p>
      <p style={styles.reassurance}>Elpis is still waiting. Rest, and try again.</p>

      <button type="button" style={styles.continueButton} onClick={onContinue}>
        Return to the Threshold
      </button>
    </div>
  );
}

const colors = {
  ashDark: "#0f0e12",
  ashMid: "#1c1a21",
  textPrimary: "#d8d3e0",
  textDim: "#8a8591",
  gold: "#c9a24f",
  goldDim: "#6d5a30",
  bloodDim: "#5a3a3a",
} as const;

const fonts = {
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  body: 'Georgia, "Iowan Old Style", serif',
} as const;

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "48px 24px",
    overflow: "hidden",
    fontFamily: fonts.body,
    color: colors.textPrimary,
    background: `radial-gradient(ellipse at 50% 45%, ${colors.ashMid} 0%, ${colors.ashDark} 75%, #000 100%)`,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    boxShadow: "inset 0 0 200px 80px rgba(0,0,0,0.85)",
    pointerEvents: "none",
  },
  eyebrow: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: colors.bloodDim,
    margin: "0 0 10px",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 400,
    margin: "0 0 24px",
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    lineHeight: 1.7,
    color: colors.textDim,
    maxWidth: 520,
    margin: "0 0 16px",
  },
  emphasis: {
    color: colors.gold,
    fontStyle: "normal",
  },
  reassurance: {
    fontSize: 15,
    fontStyle: "italic",
    color: colors.gold,
    margin: "0 0 40px",
  },
  continueButton: {
    fontFamily: fonts.display,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontSize: 16,
    padding: "14px 36px",
    borderRadius: 4,
    border: `1px solid ${colors.goldDim}`,
    background: `linear-gradient(180deg, ${colors.gold}22 0%, ${colors.gold}0a 100%)`,
    color: colors.textPrimary,
    cursor: "pointer",
    boxShadow: `0 0 14px ${colors.goldDim}55`,
  },
};
