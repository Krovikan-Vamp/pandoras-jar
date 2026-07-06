import type { ModifierRegistry } from "../perks/types.js";
import { FORM_IDS, type FormDefinition, type ResolvedAttack, type SchoolDefinition } from "./types.js";

/**
 * The load-bearing function of the whole School×Form system: merges a
 * Form's shared behavior with the active School's flavor and the actor's
 * current perk modifiers into one executable attack. Fire+Solid and
 * Water+Solid resolve through this exact same code path — they differ only
 * in which `FormFlavor` `school.flavor[form.id]` looks up.
 */
export function resolveAttack(
  form: FormDefinition,
  school: SchoolDefinition,
  slot: "primary" | "secondary",
  modifiers: ModifierRegistry,
): ResolvedAttack {
  const flavor = school.flavor[form.id];
  const baseTimeline = slot === "primary" ? form.primaryAttack : form.secondaryAbility.timeline;

  const damage = baseTimeline.baseDamage * flavor.damageMultiplier * modifiers.get("damageMultiplier");

  return {
    timeline: baseTimeline,
    damageType: flavor.damageType,
    damage,
    vfxProfileId: flavor.vfxProfileId,
    materialThemeId: flavor.materialThemeId,
    // exactOptionalPropertyTypes: only include onHitStatus when actually present.
    ...(flavor.onHitStatus ? { onHitStatus: flavor.onHitStatus } : {}),
  };
}

/**
 * Runtime guard against an incomplete `SchoolDefinition.flavor` map (e.g. one
 * assembled via object spread that silently dropped a Form). `Record<FormId,
 * FormFlavor>` guarantees this at the type level for object literals, but
 * this is cheap insurance content-authoring tests should call for every
 * School as it's added — a missing Fire+Plasma entry should fail a test, not
 * surface as a runtime crash mid-combat.
 */
export function assertCompleteFlavorMap(school: SchoolDefinition): void {
  for (const formId of FORM_IDS) {
    if (!school.flavor[formId]) {
      throw new Error(`School "${school.id}" is missing a FormFlavor for Form "${formId}"`);
    }
  }
}
