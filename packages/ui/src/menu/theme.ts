import type { CSSProperties } from "react";

/**
 * Shared visual language for the narrative "bookend" screens (Main Menu,
 * Midpoint Revelation, Ending) per GDD.md §13: a grey, ash-toned world above
 * / at rest, punctuated by saturated, stained-glass-style color that stands
 * in for the jar's interior light. No 3D assets exist yet, so these are
 * plain CSS colors/gradients/typography choices rather than literal render
 * direction.
 */

export const colors = {
  /** Base "dead, grey courtyard" ash tones. */
  ashDark: "#17161a",
  ashMid: "#232128",
  ashLight: "#3a3742",
  ashText: "#cbc7d1",
  ashTextDim: "#8a8691",

  /** The single hairline of golden light escaping the crack. */
  goldBright: "#f4c96b",
  goldDim: "#a9823f",

  /** Kenoma / Midpoint Revelation — colder, hollower, something wrong. */
  voidDeep: "#0a0c14",
  voidMid: "#141726",
  voidAccent: "#5a6fb0",

  /** Stained-glass per-School accents (GDD §4 table + §13), used sparingly
   * as gradient dressing rather than literal biome rendering. */
  schoolFire: "#c9622a",
  schoolWater: "#1f7a80",
  schoolEarth: "#6f7d4a",
  schoolAir: "#c7c9d9",
  schoolAether: "#8a5fc9",
} as const;

export const fonts = {
  display: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  body: 'Georgia, "Iowan Old Style", serif',
} as const;

export const screenBase: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100vh",
  minHeight: "600px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  overflow: "hidden",
  fontFamily: fonts.body,
  color: colors.ashText,
  textAlign: "center",
  padding: "48px 24px",
};

export const titleStyle: CSSProperties = {
  fontFamily: fonts.display,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 400,
};

export const bodyTextStyle: CSSProperties = {
  fontFamily: fonts.body,
  fontStyle: "italic",
  lineHeight: 1.6,
  color: colors.ashText,
  maxWidth: 560,
};

export function primaryButtonStyle(accent: string): CSSProperties {
  return {
    fontFamily: fonts.display,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontSize: 16,
    padding: "14px 36px",
    borderRadius: 4,
    border: `1px solid ${accent}`,
    background: `linear-gradient(180deg, ${accent}33 0%, ${accent}11 100%)`,
    color: colors.ashText,
    cursor: "pointer",
    boxShadow: `0 0 18px ${accent}55`,
    transition: "box-shadow 150ms ease, transform 150ms ease",
  };
}

export const quietButtonStyle: CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 14,
  padding: "10px 20px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "transparent",
  color: colors.ashTextDim,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
};
