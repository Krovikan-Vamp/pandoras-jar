import type { CSSProperties, JSX } from "react";
import { useState } from "react";

import type { RunFlowContext, SchoolId } from "@pithos/sim";
import { SCHOOL_IDS, TOTAL_FRAGMENT_COUNT, isConfluenceUnlocked } from "@pithos/sim";
import { ALL_SCHOOLS, WING_BOSSES } from "@pithos/data";

import { useVoiceLine } from "../dialogue/useVoiceLine";

/**
 * The Hub — "Elpis's Threshold" (docs/GDD.md §8). Hub-and-expedition run
 * structure (GDD §9): the player lands here between every expedition, picks
 * a wing (or, once unlocked, the Confluence) from the Threshold Gate, and
 * otherwise idles in six other rooms that exist narratively/thematically in
 * the GDD today but have no backing systems yet (no shop/economy, no
 * practice-dummy combat, no Reagent economy). Only the Threshold Gate is
 * wired to real callbacks; everything else is an honest "coming soon" panel
 * rather than a broken or hidden feature, per the GDD §8 room table.
 *
 * UI pattern: a persistent header (title + the one hub-wide resource that
 * already exists, Ichor) over a sidebar-of-rooms + single content panel
 * layout, rather than 7 simultaneous panels — easier to read at a glance
 * and leaves room for each panel to breathe.
 */

export interface HubScreenProps {
  context: RunFlowContext;
  ichor: number;
  unlockedSchools: SchoolId[];
  onSelectWing: (schoolId: SchoolId) => void;
  onSelectConfluence: () => void;
  /** Which room panel to open on mount — e.g. the room a player just walked
   * up to in the 3D hub (`HubRuntime`'s `onZoneInteract`). Defaults to "sanctuary". */
  initialRoomId?: HubRoomId;
  /** When set, renders an exit affordance in the header (used when this screen is
   * shown as an interaction overlay on top of the walkable 3D hub, rather than
   * as the only hub view). */
  onExit?: () => void;
}

export type HubRoomId = "sanctuary" | "threshold" | "reliquary" | "anvil" | "cistern" | "garden" | "shrines";
type RoomId = HubRoomId;

const ROOMS: ReadonlyArray<{ id: RoomId; label: string; blurb: string }> = [
  { id: "sanctuary", label: "Elpis's Sanctuary", blurb: "Narrative anchor & save point" },
  { id: "threshold", label: "The Threshold Gate", blurb: "Choose your expedition" },
  { id: "reliquary", label: "The Reliquary", blurb: "Shop" },
  { id: "anvil", label: "Hephaestus's Anvil", blurb: "Practice Range" },
  { id: "cistern", label: "The Danaids' Cistern", blurb: "Endless farming" },
  { id: "garden", label: "The Reagent Garden", blurb: "Passive Reagent growth" },
  { id: "shrines", label: "School Shrines", blurb: "Unlock new Schools" },
];

/** Stained-glass per-School accent colors (GDD §13: "the jar's interior blooms with saturated,
 * stained-glass color per School — molten ochres for Fire, deep teals for Water, etc."). */
const SCHOOL_ACCENTS: Record<SchoolId, string> = {
  earth: "#7c8a52",
  fire: "#c9662a",
  water: "#22838a",
  air: "#aab3d6",
  aether: "#9068cf",
};

export function HubScreen({
  context,
  ichor,
  unlockedSchools,
  onSelectWing,
  onSelectConfluence,
  initialRoomId,
  onExit,
}: HubScreenProps): JSX.Element {
  const [activeRoom, setActiveRoom] = useState<RoomId>(initialRoomId ?? "sanctuary");

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Elpis's Threshold</h1>
          <p style={styles.subtitle}>The Hub</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.ichorBadge}>
            <span style={styles.ichorLabel}>Ichor</span>
            <span style={styles.ichorValue}>{ichor}</span>
          </div>
          {onExit ? (
            <button type="button" style={styles.exitButton} onClick={onExit}>
              Return to the Jar
            </button>
          ) : null}
        </div>
      </header>

      <div style={styles.body}>
        <nav style={styles.sidebar}>
          {ROOMS.map((room) => {
            const isActive = room.id === activeRoom;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoom(room.id)}
                style={{ ...styles.navButton, ...(isActive ? styles.navButtonActive : {}) }}
              >
                <span style={styles.navButtonLabel}>{room.label}</span>
                <span style={styles.navButtonBlurb}>{room.blurb}</span>
              </button>
            );
          })}
        </nav>

        <main style={styles.content}>
          {activeRoom === "sanctuary" ? <SanctuaryPanel context={context} /> : null}
          {activeRoom === "threshold" ? (
            <ThresholdGatePanel
              context={context}
              unlockedSchools={unlockedSchools}
              onSelectWing={onSelectWing}
              onSelectConfluence={onSelectConfluence}
            />
          ) : null}
          {activeRoom === "reliquary" ? (
            <PlaceholderPanel
              title="The Reliquary"
              description="Spend Ichor on permanent unlocks: new Schools, Form upgrades, Reagent recipes, and starting-level boosts."
              note="Not yet implemented — no shop/economy system exists yet."
            />
          ) : null}
          {activeRoom === "anvil" ? (
            <PlaceholderPanel
              title="Hephaestus's Anvil"
              description="The Practice Range: enchanted training dummies with adjustable HP and armor. Freely test any unlocked School, Form, or perk loadout — zero stakes, instant respawn."
              note="Not yet implemented — no practice-dummy combat mode exists yet."
            />
          ) : null}
          {activeRoom === "cistern" ? (
            <PlaceholderPanel
              title="The Danaids' Cistern"
              description="An endless farming arena, named for the Danaids' punishment of forever hauling water in leaking jars. Grind Motes and Ichor in a wave arena that gets harder the longer you stay — leave anytime, no penalty."
              note="Not yet implemented — no endless-wave arena exists yet."
            />
          ) : null}
          {activeRoom === "garden" ? (
            <PlaceholderPanel
              title="The Reagent Garden"
              description="Reagents grow and collect here passively between expeditions."
              note="Not yet implemented — no Reagent economy exists yet."
            />
          ) : null}
          {activeRoom === "shrines" ? <SchoolShrinesPanel unlockedSchools={unlockedSchools} /> : null}
        </main>
      </div>
    </div>
  );
}

/**
 * Elpis's Sanctuary — narrative anchor (GDD §8). Elpis "visually brightens
 * and gains detail/color as Fragments return" (GDD §13); rendered here as a
 * literal golden-glow intensity plus an explicit "X of 5" readout so the
 * brightening is a real, functional progress signal, not just flavor text.
 */
function SanctuaryPanel({ context }: { context: RunFlowContext }): JSX.Element {
  // Two adapted GDD lines cover the Sanctuary's narrative states this hub
  // can actually be in: the initial Act 1 introduction, and post-Midpoint-
  // Revelation. Both exist as real seeded voice-line cues
  // (packages/audio/src/seedCues.ts) so `useVoiceLine` can resolve real
  // audio in dev; the inline fallback text keeps the line readable even
  // when the dev-only /__audio_admin endpoint isn't running (see
  // useVoiceLine's doc comment).
  const cueId = context.midpointRevelationSeen ? "elpis_midpoint_revelation" : "elpis_threshold_intro";
  const fallbackText = context.midpointRevelationSeen
    ? "Something's wrong. I should be whole by now — I can feel more of myself than I could before, but something is still holding the rest of me apart. Something at the very bottom of this jar. Older than the Spites. It's been feeding on the Grey Hush this whole time."
    : "I'm Elpis. I know — I don't look like much. I've been here so long I'd almost forgotten what more would feel like. There are pieces of me scattered through this place, and I can't go get them myself. Will you?";
  const { isReady, text, play } = useVoiceLine(cueId);

  const fragmentsCount = context.fragmentsRecovered.length;
  const glowStrength = Math.min(1, fragmentsCount / TOTAL_FRAGMENT_COUNT);

  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>Elpis's Sanctuary</h2>
      <div style={styles.sanctuaryLayout}>
        <div
          style={{
            ...styles.elpisGlow,
            opacity: 0.35 + glowStrength * 0.65,
            boxShadow: `0 0 ${40 + glowStrength * 80}px ${10 + glowStrength * 20}px rgba(240, 197, 108, ${
              0.25 + glowStrength * 0.45
            })`,
          }}
        />
        <div style={styles.sanctuaryText}>
          <p style={styles.voiceLine}>"{text ?? fallbackText}"</p>
          <button type="button" style={{ ...styles.quietButton, ...(isReady ? {} : styles.quietButtonDisabled) }} onClick={play} disabled={!isReady}>
            {isReady ? "Hear her voice" : "Voice unavailable"}
          </button>
          <p style={styles.fragmentReadout}>
            {fragmentsCount} of {TOTAL_FRAGMENT_COUNT} Hope Fragments recovered
          </p>
          <div style={styles.fragmentTrack}>
            {Array.from({ length: TOTAL_FRAGMENT_COUNT }, (_, index) => (
              <span
                key={index}
                style={{ ...styles.fragmentPip, ...(index < fragmentsCount ? styles.fragmentPipFilled : {}) }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The Threshold Gate — the only room with real mechanical function today
 * (GDD §8/§9): choose which unlocked wing to descend into, or the
 * Confluence once `isConfluenceUnlocked` (all 5 Hope Fragments recovered).
 */
function ThresholdGatePanel({
  context,
  unlockedSchools,
  onSelectWing,
  onSelectConfluence,
}: {
  context: RunFlowContext;
  unlockedSchools: SchoolId[];
  onSelectWing: (schoolId: SchoolId) => void;
  onSelectConfluence: () => void;
}): JSX.Element {
  const confluenceReady = isConfluenceUnlocked(context);

  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>The Threshold Gate</h2>
      <p style={styles.panelBody}>Choose which wing to descend into.</p>

      <div style={styles.wingGrid}>
        {unlockedSchools.map((schoolId) => {
          const school = ALL_SCHOOLS[schoolId];
          const boss = WING_BOSSES[schoolId];
          const cleared = context.fragmentsRecovered.includes(schoolId);
          const accent = SCHOOL_ACCENTS[schoolId];
          return (
            <div key={schoolId} style={{ ...styles.wingCard, borderColor: accent }}>
              <div style={{ ...styles.wingCardAccent, background: accent }} />
              <h3 style={styles.wingCardTitle}>{school.displayName}</h3>
              <p style={styles.wingCardSpite}>{boss.epithet}</p>
              <p style={{ ...styles.wingCardStatus, ...(cleared ? styles.wingCardStatusCleared : {}) }}>
                {cleared ? "Cleared — descend again" : "Hope Fragment awaits"}
              </p>
              <button type="button" style={accentButtonStyle(accent)} onClick={() => onSelectWing(schoolId)}>
                Descend
              </button>
            </div>
          );
        })}

        {confluenceReady ? (
          <div style={{ ...styles.wingCard, ...styles.confluenceCard }}>
            <div style={{ ...styles.wingCardAccent, background: colors.voidAccent }} />
            <h3 style={styles.wingCardTitle}>The Confluence</h3>
            <p style={styles.wingCardSpite}>Kenoma, the Emptiness</p>
            <p style={styles.wingCardStatus}>
              {context.isNewGamePlus
                ? "The Second Kindling — the endgame loop, mixed-biome and merciless."
                : "All five Fragments recovered. The truth waits at the bottom of the jar."}
            </p>
            <button type="button" style={accentButtonStyle(colors.voidAccent)} onClick={onSelectConfluence}>
              Descend into the Confluence
            </button>
          </div>
        ) : null}
      </div>

      {unlockedSchools.length < SCHOOL_IDS.length ? (
        <p style={styles.hint}>
          {SCHOOL_IDS.length - unlockedSchools.length} more wing{SCHOOL_IDS.length - unlockedSchools.length === 1 ? "" : "s"} remain
          sealed until unlocked at the School Shrines.
        </p>
      ) : null}
    </section>
  );
}

/** No shop/economy backs this yet, but the School Shrines list is real, prop-driven data
 * (`unlockedSchools`) rather than invented flavor — an honest placeholder, not a fake one. */
function SchoolShrinesPanel({ unlockedSchools }: { unlockedSchools: SchoolId[] }): JSX.Element {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>School Shrines</h2>
      <p style={styles.panelBody}>
        Five shrines, one per School, where new Schools are permanently unlocked with Ichor.
      </p>
      <ul style={styles.shrineList}>
        {SCHOOL_IDS.map((id) => {
          const unlocked = unlockedSchools.includes(id);
          return (
            <li key={id} style={styles.shrineRow}>
              <span style={{ ...styles.shrineDot, background: SCHOOL_ACCENTS[id] }} />
              <span style={styles.shrineName}>{ALL_SCHOOLS[id].displayName}</span>
              <span style={unlocked ? styles.shrineUnlocked : styles.shrineLocked}>
                {unlocked ? "Unlocked" : "Sealed"}
              </span>
            </li>
          );
        })}
      </ul>
      <ComingSoonRow note="Shrine purchases aren't wired up yet — this list is read-only." />
    </section>
  );
}

function PlaceholderPanel({ title, description, note }: { title: string; description: string; note: string }): JSX.Element {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      <p style={styles.panelBody}>{description}</p>
      <ComingSoonRow note={note} />
    </section>
  );
}

function ComingSoonRow({ note }: { note: string }): JSX.Element {
  return (
    <div style={styles.comingSoonRow}>
      <button type="button" style={styles.disabledButton} disabled>
        Coming soon
      </button>
      <span style={styles.comingSoonNote}>{note}</span>
    </div>
  );
}

/** Small, locally-scoped ash/gold palette (GDD §13). Kept self-contained to this file (and its
 * hub/ siblings) rather than imported from a shared theme module, since no such module is part
 * of this workstream's owned/contracted files. */
const colors = {
  ashDark: "#151319",
  ashMid: "#211f28",
  ashPanel: "#28252f",
  ashBorder: "#3c3946",
  textPrimary: "#e9e4f0",
  textDim: "#9c96a8",
  gold: "#f0c56c",
  goldDim: "#8a6a34",
  voidAccent: "#5a6fb0",
} as const;

const fonts = {
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  body: 'Georgia, "Iowan Old Style", serif',
} as const;

function accentButtonStyle(accent: string): CSSProperties {
  return {
    fontFamily: fonts.display,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: 14,
    padding: "10px 18px",
    borderRadius: 4,
    border: `1px solid ${accent}`,
    background: `linear-gradient(180deg, ${accent}33 0%, ${accent}11 100%)`,
    color: colors.textPrimary,
    cursor: "pointer",
    boxShadow: `0 0 14px ${accent}55`,
    alignSelf: "flex-start",
  };
}

const styles: Record<string, CSSProperties> = {
  root: {
    fontFamily: fonts.body,
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    background: `radial-gradient(ellipse at 50% 0%, ${colors.ashMid} 0%, ${colors.ashDark} 60%, #000 100%)`,
    color: colors.textPrimary,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 32px",
    borderBottom: `1px solid ${colors.ashBorder}`,
  },
  title: {
    fontFamily: fonts.display,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontWeight: 400,
    fontSize: 26,
    margin: 0,
  },
  subtitle: {
    margin: "2px 0 0",
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textDim,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  ichorBadge: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "8px 18px",
    borderRadius: 6,
    border: `1px solid ${colors.goldDim}`,
    background: `${colors.gold}14`,
  },
  exitButton: {
    fontFamily: fonts.display,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: 13,
    padding: "9px 18px",
    borderRadius: 4,
    border: `1px solid ${colors.ashBorder}`,
    background: colors.ashPanel,
    color: colors.textPrimary,
    cursor: "pointer",
  },
  ichorLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: colors.gold,
  },
  ichorValue: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.gold,
    fontWeight: 600,
  },
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 16,
    borderRight: `1px solid ${colors.ashBorder}`,
    overflowY: "auto",
  },
  navButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    textAlign: "left",
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid transparent`,
    background: "transparent",
    color: colors.textDim,
    cursor: "pointer",
    fontFamily: fonts.body,
  },
  navButtonActive: {
    border: `1px solid ${colors.goldDim}`,
    background: `${colors.gold}12`,
    color: colors.textPrimary,
  },
  navButtonLabel: {
    fontSize: 14,
  },
  navButtonBlurb: {
    fontSize: 11,
    color: colors.textDim,
    fontStyle: "italic",
  },
  content: {
    flex: 1,
    padding: "28px 36px",
    overflowY: "auto",
  },
  panel: {
    maxWidth: 880,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: "0.03em",
    margin: "0 0 12px",
    color: colors.textPrimary,
  },
  panelBody: {
    fontSize: 15,
    lineHeight: 1.6,
    color: colors.textDim,
    maxWidth: 640,
  },
  sanctuaryLayout: {
    display: "flex",
    alignItems: "center",
    gap: 36,
    flexWrap: "wrap",
  },
  elpisGlow: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    flexShrink: 0,
    background: `radial-gradient(circle, ${colors.gold} 0%, transparent 70%)`,
  },
  sanctuaryText: {
    flex: 1,
    minWidth: 280,
  },
  voiceLine: {
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 1.6,
    color: colors.gold,
    maxWidth: 560,
    margin: "0 0 12px",
  },
  quietButton: {
    fontFamily: fonts.body,
    fontSize: 13,
    padding: "8px 16px",
    borderRadius: 4,
    border: `1px solid ${colors.goldDim}`,
    background: "transparent",
    color: colors.gold,
    cursor: "pointer",
    marginBottom: 18,
  },
  quietButtonDisabled: {
    color: colors.textDim,
    borderColor: colors.ashBorder,
    cursor: "default",
  },
  fragmentReadout: {
    fontSize: 14,
    margin: "0 0 8px",
    color: colors.textPrimary,
  },
  fragmentTrack: {
    display: "flex",
    gap: 8,
  },
  fragmentPip: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: `1px solid ${colors.goldDim}`,
    background: "transparent",
  },
  fragmentPipFilled: {
    background: colors.gold,
    boxShadow: `0 0 8px 2px ${colors.gold}88`,
  },
  wingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 16,
    marginTop: 20,
  },
  wingCard: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "16px 16px 16px 20px",
    borderRadius: 8,
    border: `1px solid ${colors.ashBorder}`,
    background: colors.ashPanel,
    overflow: "hidden",
  },
  wingCardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  confluenceCard: {
    borderColor: colors.voidAccent,
    background: `linear-gradient(180deg, ${colors.voidAccent}22 0%, ${colors.ashPanel} 100%)`,
  },
  wingCardTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    margin: 0,
  },
  wingCardSpite: {
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textDim,
    margin: 0,
  },
  wingCardStatus: {
    fontSize: 12,
    color: colors.textDim,
    margin: "4px 0 10px",
  },
  wingCardStatusCleared: {
    color: colors.gold,
  },
  hint: {
    marginTop: 18,
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textDim,
  },
  shrineList: {
    listStyle: "none",
    margin: "16px 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 360,
  },
  shrineRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${colors.ashBorder}`,
    background: colors.ashPanel,
  },
  shrineDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  shrineName: {
    flex: 1,
    fontSize: 14,
  },
  shrineUnlocked: {
    fontSize: 12,
    color: colors.gold,
  },
  shrineLocked: {
    fontSize: 12,
    color: colors.textDim,
  },
  comingSoonRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
  },
  disabledButton: {
    fontFamily: fonts.display,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: 13,
    padding: "9px 18px",
    borderRadius: 4,
    border: `1px solid ${colors.ashBorder}`,
    background: colors.ashPanel,
    color: colors.textDim,
    cursor: "not-allowed",
  },
  comingSoonNote: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textDim,
  },
};
