import type { SchoolId } from "@pithos/sim";

/**
 * Three hex colors every VFX factory in this directory pulls from to stay
 * on-theme for a School, per the GDD's "stained glass on ash" direction
 * (docs/GDD.md §13): each School's jar-interior color should read as
 * saturated and distinct against the grey ash world.
 *
 * - `primary` — the School's dominant, most saturated color; used for the
 *   bulk of a particle field.
 * - `secondary` — a darker/desaturated shade of the same family; used for
 *   shadowed faces, embers cooling, depth in a cloud, etc.
 * - `emissive` — a bright, near-white-hot highlight; used for hot cores,
 *   sparkle highlights, and additive-blended glow accents.
 */
export interface SchoolColors {
  readonly primary: number;
  readonly secondary: number;
  readonly emissive: number;
}

export const SCHOOL_PALETTE: Record<SchoolId, SchoolColors> = {
  // Earth — Ponos's Hollow (Toil): jagged earthen tones, living stone.
  earth: { primary: 0x8a6d3f, secondary: 0x4a3a24, emissive: 0xc9a35c },

  // Fire — Loimos's Forge (Plague/Fever): molten ochres and ember reds.
  fire: { primary: 0xd9660b, secondary: 0x7a1f0a, emissive: 0xffc266 },

  // Water — Algea's Deep (Pain): deep teals with pale foam highlights.
  water: { primary: 0x0e6e6a, secondary: 0x073539, emissive: 0x8fe9de },

  // Air — Geras's Spire (Old Age): wispy, pale, almost-static tones.
  air: { primary: 0xcfe3e6, secondary: 0x8fa6ab, emissive: 0xf4fbff },

  // Aether — Phthonos's Reach (Envy): prismatic/starlit violet and gold.
  aether: { primary: 0x7c3fb0, secondary: 0x2a1a4a, emissive: 0xf6d97a },
};
