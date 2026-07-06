import type { CSSProperties, JSX } from "react";

import type { SchoolId } from "@pithos/sim";
import { ALL_SCHOOLS, BOSS_KENOMA, WING_BOSSES } from "@pithos/data";

/**
 * Expedition Reward — shown when the `runFlow` machine reaches
 * `expeditionReward` (packages/sim/src/state/RunFlowMachine.ts): a wing (or
 * the Confluence) was just cleared and its `pendingIchor` has been folded
 * into `ichorBankedThisRun`. A short, satisfying beat before returning to
 * the hub, per docs/GDD.md §9 ("hub-and-expedition" run structure).
 */

export interface ExpeditionRewardScreenProps {
  ichorEarned: number;
  wingCleared: SchoolId | "confluence";
  onContinue: () => void;
}

function wingDisplayName(wingCleared: SchoolId | "confluence"): string {
  return wingCleared === "confluence" ? "The Confluence" : ALL_SCHOOLS[wingCleared].displayName;
}

function spiteEpithet(wingCleared: SchoolId | "confluence"): string {
  return wingCleared === "confluence" ? BOSS_KENOMA.epithet : WING_BOSSES[wingCleared].epithet;
}

export function ExpeditionRewardScreen({
  ichorEarned,
  wingCleared,
  onContinue,
}: ExpeditionRewardScreenProps): JSX.Element {
  const isConfluence = wingCleared === "confluence";

  return (
    <div style={styles.root}>
      <div style={styles.glow} />
      <p style={styles.eyebrow}>{isConfluence ? "The Confluence Cleared" : "Wing Cleared"}</p>
      <h1 style={styles.title}>{wingDisplayName(wingCleared)}</h1>
      <p style={styles.spite}>{spiteEpithet(wingCleared)} has been overcome.</p>
      <p style={styles.fragmentNote}>
        {isConfluence
          ? "Kenoma's grip breaks. Every Hope Fragment is finally whole again."
          : "A Hope Fragment returns to Elpis — she is a little more herself."}
      </p>

      <div style={styles.ichorCard}>
        <span style={styles.ichorLabel}>Ichor Earned</span>
        <span style={styles.ichorValue}>{ichorEarned}</span>
      </div>

      <button type="button" style={styles.continueButton} onClick={onContinue}>
        Return to the Threshold
      </button>
    </div>
  );
}

const colors = {
  ashDark: "#151319",
  ashMid: "#211f28",
  textPrimary: "#e9e4f0",
  textDim: "#9c96a8",
  gold: "#f0c56c",
  goldDim: "#8a6a34",
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
    background: `radial-gradient(ellipse at 50% 40%, ${colors.ashMid} 0%, ${colors.ashDark} 70%, #000 100%)`,
  },
  glow: {
    position: "absolute",
    top: "30%",
    left: "50%",
    width: 320,
    height: 320,
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${colors.gold}33 0%, transparent 70%)`,
    filter: "blur(4px)",
    pointerEvents: "none",
  },
  eyebrow: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: colors.goldDim,
    margin: "0 0 10px",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 400,
    margin: "0 0 8px",
    color: colors.textPrimary,
  },
  spite: {
    fontSize: 15,
    fontStyle: "italic",
    color: colors.textDim,
    margin: "0 0 24px",
  },
  fragmentNote: {
    fontSize: 16,
    fontStyle: "italic",
    color: colors.gold,
    maxWidth: 480,
    lineHeight: 1.6,
    margin: "0 0 36px",
  },
  ichorCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "16px 40px",
    borderRadius: 8,
    border: `1px solid ${colors.goldDim}`,
    background: `${colors.gold}14`,
    marginBottom: 40,
  },
  ichorLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: colors.gold,
  },
  ichorValue: {
    fontSize: 34,
    fontFamily: fonts.display,
    color: colors.gold,
    fontWeight: 600,
  },
  continueButton: {
    fontFamily: fonts.display,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontSize: 16,
    padding: "14px 36px",
    borderRadius: 4,
    border: `1px solid ${colors.gold}`,
    background: `linear-gradient(180deg, ${colors.gold}33 0%, ${colors.gold}11 100%)`,
    color: colors.textPrimary,
    cursor: "pointer",
    boxShadow: `0 0 18px ${colors.gold}55`,
  },
};
