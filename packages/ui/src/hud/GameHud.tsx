import type { CSSProperties, JSX } from "react";
import type { FluxState, FormDefinition, MovementState, SchoolDefinition, SchoolId } from "@pithos/sim";

/**
 * The in-combat HUD, overlaid on the Three.js canvas during actual
 * gameplay — the "real" successor to `apps/game/src/debug/DebugHud.ts`'s
 * Phase-0 diagnostic text dump. Same live numbers (speed/vision/dash/glide
 * all flow every frame from `MovementController`; Flux/Charge from
 * `FormFluxMachine`, GDD.md §4), but laid out and styled as something a
 * player actually wants to look at mid-fight rather than a debug printout.
 *
 * Kept fixed at the very top/bottom edges of the viewport, deliberately
 * clear of the center of the screen where the isometric play area and the
 * player character live.
 */
export interface GameHudProps {
  health: { current: number; max: number };
  movement: MovementState;
  flux: FluxState;
  currentSchool: SchoolDefinition;
  currentForm: FormDefinition;
}

/** Stained-glass-per-School accent (GDD.md §13) — used sparingly here to tint the Flux/Charge bar and combo label per the active School. */
const SCHOOL_ACCENTS: Record<SchoolId, string> = {
  fire: "#d97a3a",
  water: "#2f9aa0",
  earth: "#8a9a5a",
  air: "#c7c9d9",
  aether: "#a679e0",
};

const ASH_PANEL = "rgba(20, 19, 24, 0.86)";
const ASH_PANEL_EDGE = "rgba(58, 55, 66, 0.9)";
const TRACK_BG = "rgba(0, 0, 0, 0.45)";
const TEXT = "#e7e2ec";
const TEXT_DIM = "#a29db0";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Ash-toned game, but health should still read as unmistakably urgent — shifts from a warm ember gold toward a saturated, more alarming red as HP drops. */
function healthColor(ratio: number): string {
  if (ratio > 0.55) return "#d9b25a";
  if (ratio > 0.25) return "#d9793a";
  return "#e2453f";
}

export function GameHud({ health, movement, flux, currentSchool, currentForm }: GameHudProps): JSX.Element {
  const healthMax = Math.max(1, health.max);
  const healthRatio = clamp01(health.current / healthMax);
  const isCriticalHealth = healthRatio <= 0.25;

  const fluxMax = Math.max(1, flux.maxFlux);
  const fluxRatio = clamp01(flux.currentFlux / fluxMax);

  const chargeValue = flux.charge[currentForm.id] ?? 0;
  const chargeMax = Math.max(1, currentForm.chargeParams.maxCharge);
  const chargeRatio = clamp01(chargeValue / chargeMax);
  const thresholdRatio = clamp01(currentForm.chargeParams.releaseThreshold);
  const chargeReady = chargeRatio >= thresholdRatio;

  const accent = SCHOOL_ACCENTS[currentSchool.id];

  const dashState: { label: string; active: boolean } =
    movement.isDashing
      ? { label: "DASHING", active: true }
      : movement.dashCooldownRemaining > 0
        ? { label: `DASH ${movement.dashCooldownRemaining.toFixed(1)}s`, active: false }
        : { label: "DASH READY", active: true };

  return (
    <div style={styles.root} aria-hidden={false}>
      <style>{HUD_KEYFRAMES}</style>

      <div style={styles.badgeRow}>
        <StatusBadge label={dashState.label} active={dashState.active} />
        <StatusBadge label="CROUCH" active={movement.isCrouching} />
        <StatusBadge
          label={movement.isGliding ? `GLIDE ${movement.glideRemaining.toFixed(1)}s` : "GLIDE"}
          active={movement.isGliding}
        />
        {movement.isInvulnerable ? <StatusBadge label="INVULNERABLE" active glow /> : null}
      </div>

      <div style={styles.bottomCluster}>
        {/* Health */}
        <div style={styles.barBlock}>
          <div style={styles.barLabelRow}>
            <span style={styles.barLabel}>HEALTH</span>
            <span style={styles.barValue}>
              {Math.ceil(health.current)} / {healthMax}
            </span>
          </div>
          <div
            style={{
              ...styles.track,
              ...(isCriticalHealth ? { animation: "pithos-hud-pulse 1.1s ease-in-out infinite" } : null),
            }}
          >
            <div
              style={{
                ...styles.trackFill,
                width: `${healthRatio * 100}%`,
                background: `linear-gradient(180deg, ${healthColor(healthRatio)} 0%, ${healthColor(healthRatio)}cc 100%)`,
                boxShadow: `0 0 10px ${healthColor(healthRatio)}88`,
              }}
            />
          </div>
        </div>

        {/* School x Form combo */}
        <div style={styles.comboBlock}>
          <div style={{ ...styles.comboTitle, color: accent, textShadow: `0 0 12px ${accent}66` }}>
            {currentSchool.displayName} — {currentForm.displayName}
          </div>
          <div style={styles.comboSub}>{Math.round(chargeRatio * 100)}% Charge</div>
        </div>

        {/* Flux + Charge */}
        <div style={styles.barBlock}>
          <div style={styles.barLabelRow}>
            <span style={styles.barLabel}>FLUX</span>
            <span style={styles.barValue}>
              {Math.ceil(flux.currentFlux)} / {fluxMax}
            </span>
          </div>
          <div style={styles.track}>
            <div
              style={{
                ...styles.trackFill,
                width: `${fluxRatio * 100}%`,
                background: `linear-gradient(180deg, ${accent} 0%, ${accent}99 100%)`,
                boxShadow: `0 0 10px ${accent}77`,
              }}
            />
          </div>

          <div style={styles.chargeTrackWrap}>
            <div style={styles.chargeTrack}>
              <div
                style={{
                  ...styles.chargeTrackFill,
                  width: `${chargeRatio * 100}%`,
                  background: chargeReady
                    ? `linear-gradient(90deg, ${accent}cc 0%, #f4d98a 100%)`
                    : `${accent}77`,
                  ...(chargeReady ? { animation: "pithos-hud-charge-glow 1.4s ease-in-out infinite" } : null),
                }}
              />
              {/* releaseThreshold marker */}
              <div
                style={{
                  ...styles.chargeThresholdTick,
                  left: `${thresholdRatio * 100}%`,
                }}
              />
            </div>
            <span style={styles.chargeCaption}>Release at {Math.round(thresholdRatio * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  active,
  glow = false,
}: {
  label: string;
  active: boolean;
  glow?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        ...styles.badge,
        ...(active ? styles.badgeActive : styles.badgeInactive),
        ...(active && glow ? { boxShadow: "0 0 14px #f4c96baa", borderColor: "#f4c96b" } : null),
      }}
    >
      {label}
    </div>
  );
}

const HUD_KEYFRAMES = `
@keyframes pithos-hud-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(226, 69, 63, 0.0); }
  50% { box-shadow: inset 0 0 14px 2px rgba(226, 69, 63, 0.65); }
}
@keyframes pithos-hud-charge-glow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}
`;

const styles: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    color: TEXT,
    userSelect: "none",
    zIndex: 20,
  },
  badgeRow: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
  },
  badge: {
    padding: "5px 12px",
    borderRadius: 3,
    fontSize: 11,
    letterSpacing: "0.08em",
    fontWeight: 600,
    textTransform: "uppercase",
    border: "1px solid transparent",
    background: ASH_PANEL,
  },
  badgeActive: {
    color: "#f4e6bf",
    borderColor: "rgba(244, 201, 107, 0.55)",
    boxShadow: "0 0 8px rgba(244, 201, 107, 0.25)",
  },
  badgeInactive: {
    color: TEXT_DIM,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bottomCluster: {
    position: "absolute",
    bottom: 18,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "flex-end",
    gap: 20,
    padding: "14px 22px",
    borderRadius: 8,
    background: ASH_PANEL,
    border: `1px solid ${ASH_PANEL_EDGE}`,
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    backdropFilter: "blur(3px)",
  },
  barBlock: {
    width: 220,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  barLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  barLabel: {
    color: TEXT_DIM,
    fontWeight: 600,
  },
  barValue: {
    color: TEXT,
    fontVariantNumeric: "tabular-nums",
  },
  track: {
    position: "relative",
    height: 14,
    borderRadius: 3,
    background: TRACK_BG,
    border: "1px solid rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 2,
    transition: "width 120ms ease-out",
  },
  chargeTrackWrap: {
    marginTop: 2,
  },
  chargeTrack: {
    position: "relative",
    height: 6,
    borderRadius: 3,
    background: TRACK_BG,
    border: "1px solid rgba(255,255,255,0.06)",
    overflow: "visible",
  },
  chargeTrackFill: {
    position: "absolute",
    inset: 0,
    borderRadius: 2,
    transition: "width 120ms ease-out",
  },
  chargeThresholdTick: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    background: "#f4e6bf",
    boxShadow: "0 0 4px #f4e6bf",
    transform: "translateX(-1px)",
  },
  chargeCaption: {
    display: "block",
    marginTop: 3,
    fontSize: 9,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: TEXT_DIM,
    textAlign: "right",
  },
  comboBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 160,
    paddingBottom: 2,
  },
  comboTitle: {
    fontSize: 17,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  comboSub: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_DIM,
    letterSpacing: "0.05em",
  },
};
