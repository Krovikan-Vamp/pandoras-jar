import type { Perk } from "@pithos/sim";
import { UNIVERSAL_PERKS } from "./universal.js";
import { RARE_PERKS } from "./rare.js";
import { FORM_PERKS } from "./forms.js";
import { SCHOOL_PERKS } from "./schools.js";

export { UNIVERSAL_PERKS } from "./universal.js";
export { RARE_PERKS } from "./rare.js";
export { FORM_PERKS, FORM_PERKS_BY_FORM } from "./forms.js";
export { SCHOOL_PERKS, SCHOOL_PERKS_BY_SCHOOL } from "./schools.js";

/**
 * Every perk in the game (50 total: 8 universal + 6 rare + 16 form + 20
 * school), for the perk-pick pool.
 *
 * Caveat for whoever wires the actual per-run perk-pick pool: a few perks
 * (`PERK_SECOND_WIND`, `PERK_FIRE_PHOENIX_ASH`) are "once per expedition"
 * and hold that state in a closure created once at module load — reusing
 * the same object across multiple runs means the flag never resets. Use
 * their exported factories (`createPerkSecondWind()`,
 * `createPerkFirePhoenixAsh()`) to mint a fresh instance at the start of
 * each expedition instead of picking the singleton out of this array.
 */
export const ALL_PERKS: Perk[] = [...UNIVERSAL_PERKS, ...RARE_PERKS, ...FORM_PERKS, ...SCHOOL_PERKS];
