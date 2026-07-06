export { ALL_FORMS, FORM_GAS, FORM_LIQUID, FORM_PLASMA, FORM_SOLID } from "./forms.js";

export { SCHOOL_EARTH } from "./schools/earth.js";
export { SCHOOL_FIRE } from "./schools/fire.js";
export { SCHOOL_WATER } from "./schools/water.js";
export { SCHOOL_AIR } from "./schools/air.js";
export { SCHOOL_AETHER } from "./schools/aether.js";

export { EARTH_ROOMS } from "./rooms/earth.js";
export { FIRE_ROOMS } from "./rooms/fire.js";
export { WATER_ROOMS } from "./rooms/water.js";
export { AIR_ROOMS } from "./rooms/air.js";
export { AETHER_ROOMS } from "./rooms/aether.js";

export { BOSS_PONOS } from "./bosses/ponos.js";
export { BOSS_LOIMOS } from "./bosses/loimos.js";
export { BOSS_ALGEA } from "./bosses/algea.js";
export { BOSS_GERAS } from "./bosses/geras.js";
export { BOSS_PHTHONOS } from "./bosses/phthonos.js";
export { BOSS_KENOMA } from "./bosses/kenoma.js";

export { ALL_ENEMIES } from "./enemies.js";

export { UNIVERSAL_PERKS } from "./perks/universal.js";
export { RARE_PERKS } from "./perks/rare.js";
export { FORM_PERKS, FORM_PERKS_BY_FORM } from "./perks/forms.js";
export { SCHOOL_PERKS, SCHOOL_PERKS_BY_SCHOOL } from "./perks/schools.js";
export { ALL_PERKS } from "./perks/index.js";

import type { SchoolId } from "@pithos/sim";
import type { SchoolDefinition, BossDefinition } from "@pithos/sim";
import { SCHOOL_AETHER } from "./schools/aether.js";
import { SCHOOL_AIR } from "./schools/air.js";
import { SCHOOL_EARTH } from "./schools/earth.js";
import { SCHOOL_FIRE } from "./schools/fire.js";
import { SCHOOL_WATER } from "./schools/water.js";
import { BOSS_ALGEA } from "./bosses/algea.js";
import { BOSS_GERAS } from "./bosses/geras.js";
import { BOSS_LOIMOS } from "./bosses/loimos.js";
import { BOSS_PHTHONOS } from "./bosses/phthonos.js";
import { BOSS_PONOS } from "./bosses/ponos.js";
import { EARTH_ROOMS } from "./rooms/earth.js";
import { FIRE_ROOMS } from "./rooms/fire.js";
import { WATER_ROOMS } from "./rooms/water.js";
import { AIR_ROOMS } from "./rooms/air.js";
import { AETHER_ROOMS } from "./rooms/aether.js";
import type { RoomTemplate } from "@pithos/sim";

/** Every wing's School/rooms/Spite, keyed by SchoolId — the natural lookup table for the hub's Threshold Gate and WingGenerator wiring. */
export const ALL_SCHOOLS: Record<SchoolId, SchoolDefinition> = {
  earth: SCHOOL_EARTH,
  fire: SCHOOL_FIRE,
  water: SCHOOL_WATER,
  air: SCHOOL_AIR,
  aether: SCHOOL_AETHER,
};

export const WING_BOSSES: Record<SchoolId, BossDefinition> = {
  earth: BOSS_PONOS,
  fire: BOSS_LOIMOS,
  water: BOSS_ALGEA,
  air: BOSS_GERAS,
  aether: BOSS_PHTHONOS,
};

export const WING_ROOMS: Record<SchoolId, RoomTemplate[]> = {
  earth: EARTH_ROOMS,
  fire: FIRE_ROOMS,
  water: WATER_ROOMS,
  air: AIR_ROOMS,
  aether: AETHER_ROOMS,
};

/** Union of all 5 wings' rooms — the Confluence wing's room pool (TECHNICAL_SPEC.md §3: "sampling from the union of all 5 biomes' tagged pools"). */
export const CONFLUENCE_ROOM_POOL: RoomTemplate[] = [
  ...EARTH_ROOMS,
  ...FIRE_ROOMS,
  ...WATER_ROOMS,
  ...AIR_ROOMS,
  ...AETHER_ROOMS,
];
