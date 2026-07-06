import type { CSSProperties, JSX } from "react";
import type { Perk, PerkTier } from "@pithos/sim";

/**
 * Post-room perk pick — GDD.md §6: "chosen after clearing a room — pick 1
 * of 3, Hades-boon style." A full-screen overlay over the 3D canvas; the
 * darkened, blurred backdrop reads as "gameplay is paused/held" behind the
 * choice. Exactly 3 `Perk`s in, exactly one click out via `onSelect`.
 */
export interface PerkPickOverlayProps {
  perks: [Perk, Perk, Perk];
  onSelect: (perk: Perk) => void;
}

const TIER_STYLE: Record<PerkTier, { label: string; color: string; badgeBg: string }> = {
  universal: { label: "Universal", color: "#9aa0ad", badgeBg: "rgba(154, 160, 173, 0.16)" },
  form: { label: "Form", color: "#4fb389", badgeBg: "rgba(79, 179, 137, 0.16)" },
  school: { label: "School", color: "#d99a3f", badgeBg: "rgba(217, 154, 63, 0.16)" },
  rare: { label: "Rare", color: "#f4c96b", badgeBg: "rgba(244, 201, 107, 0.22)" },
};

export function PerkPickOverlay({ perks, onSelect }: PerkPickOverlayProps): JSX.Element {
  return (
    <div style={styles.backdrop}>
      <style>{PERK_OVERLAY_STYLE}</style>

      <div style={styles.header}>
        <div style={styles.eyebrow}>Choose a Boon</div>
        <div style={styles.headline}>The room falls quiet — pick one to carry forward.</div>
      </div>

      <div style={styles.cardRow}>
        {perks.map((perk) => (
          <PerkCard key={perk.id} perk={perk} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function PerkCard({ perk, onSelect }: { perk: Perk; onSelect: (perk: Perk) => void }): JSX.Element {
  // `noUncheckedIndexedAccess` means the lookup is `| undefined` even though
  // `TIER_STYLE` covers every `PerkTier` — fall back to "universal" rather
  // than risk a runtime crash on an unexpected tier value.
  const tier = TIER_STYLE[perk.tier] ?? TIER_STYLE.universal;
  const isRare = perk.tier === "rare";

  return (
    <button
      type="button"
      className={isRare ? "pithos-perk-card pithos-perk-card--rare" : "pithos-perk-card"}
      style={{
        ...styles.card,
        ...(isRare ? styles.cardRare : null),
      }}
      onClick={() => onSelect(perk)}
    >
      {isRare ? <div style={styles.rareGlowRing} aria-hidden="true" /> : null}

      <span
        style={{
          ...styles.tierBadge,
          color: tier.color,
          background: tier.badgeBg,
          borderColor: `${tier.color}66`,
        }}
      >
        {tier.label}
      </span>

      <span style={{ ...styles.cardTitle, color: isRare ? "#fff3d6" : "#e7e2ec" }}>{perk.displayName}</span>

      <span style={styles.cardDescription}>{perk.description}</span>
    </button>
  );
}

const PERK_OVERLAY_STYLE = `
.pithos-perk-card {
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}
.pithos-perk-card:hover, .pithos-perk-card:focus-visible {
  transform: translateY(-6px);
  border-color: rgba(244, 201, 107, 0.55);
}
.pithos-perk-card--rare:hover, .pithos-perk-card--rare:focus-visible {
  transform: translateY(-6px) scale(1.02);
}
@keyframes pithos-perk-rare-glow {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
`;

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    background: "radial-gradient(ellipse at 50% 45%, rgba(35,33,40,0.92) 0%, rgba(10,9,12,0.97) 75%)",
    backdropFilter: "blur(6px)",
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    color: "#e7e2ec",
  },
  header: {
    textAlign: "center",
    maxWidth: 640,
    padding: "0 24px",
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#f4c96b",
    marginBottom: 10,
  },
  headline: {
    fontSize: 22,
    fontStyle: "italic",
    color: "#cbc7d1",
    lineHeight: 1.5,
  },
  cardRow: {
    display: "flex",
    gap: 28,
    padding: "0 24px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 14,
    width: 240,
    minHeight: 220,
    padding: "22px 20px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(46,43,52,0.9) 0%, rgba(23,22,26,0.95) 100%)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
  },
  cardRare: {
    border: "2px solid #f4c96b",
    background: "linear-gradient(180deg, rgba(64,50,26,0.92) 0%, rgba(23,20,14,0.96) 100%)",
    boxShadow: "0 0 32px rgba(244, 201, 107, 0.45), 0 16px 40px rgba(0,0,0,0.55)",
  },
  rareGlowRing: {
    position: "absolute",
    inset: -2,
    borderRadius: 12,
    border: "1px solid rgba(244, 201, 107, 0.6)",
    boxShadow: "0 0 24px rgba(244, 201, 107, 0.5)",
    pointerEvents: "none",
    animation: "pithos-perk-rare-glow 2.2s ease-in-out infinite",
  },
  tierBadge: {
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "#a29db0",
  },
};
