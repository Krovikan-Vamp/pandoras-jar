import { FORM_IDS } from "@pithos/sim";
import { describe, expect, it } from "vitest";
import { ALL_FORMS } from "./forms.js";

describe("ALL_FORMS", () => {
  it("has exactly one entry per FormId, keyed correctly", () => {
    for (const formId of FORM_IDS) {
      expect(ALL_FORMS[formId]).toBeDefined();
      expect(ALL_FORMS[formId].id).toBe(formId);
    }
    expect(Object.keys(ALL_FORMS)).toHaveLength(FORM_IDS.length);
  });

  it("every Form has internally consistent, positive numeric tuning", () => {
    for (const formId of FORM_IDS) {
      const form = ALL_FORMS[formId];

      expect(form.primaryAttack.baseDamage).toBeGreaterThan(0);
      expect(form.primaryAttack.windupSeconds).toBeGreaterThanOrEqual(0);
      expect(form.primaryAttack.activeSeconds).toBeGreaterThan(0);
      expect(form.primaryAttack.recoverySeconds).toBeGreaterThan(0);

      expect(form.secondaryAbility.cooldownSeconds).toBeGreaterThan(0);
      expect(form.secondaryAbility.timeline.baseDamage).toBeGreaterThan(0);

      expect(form.moveSpeedMultiplier).toBeGreaterThan(0);
      expect(form.fluxCostToSwapIn).toBeGreaterThan(0);

      expect(form.chargeParams.buildRatePerSecond).toBeGreaterThan(0);
      expect(form.chargeParams.maxCharge).toBeGreaterThan(0);
      expect(form.chargeParams.releaseThreshold).toBeGreaterThan(0);
      expect(form.chargeParams.releaseThreshold).toBeLessThanOrEqual(1);

      expect(form.burstOnSwapOut.timeline.baseDamage).toBeGreaterThan(0);
      expect(form.burstOnSwapOut.radius).toBeGreaterThan(0);
    }
  });

  it("Plasma is the highest-risk Form: costliest to swap into, highest primary damage", () => {
    const damages = FORM_IDS.map((id) => ALL_FORMS[id].primaryAttack.baseDamage);
    const swapCosts = FORM_IDS.map((id) => ALL_FORMS[id].fluxCostToSwapIn);

    expect(ALL_FORMS.plasma.primaryAttack.baseDamage).toBe(Math.max(...damages));
    expect(ALL_FORMS.plasma.fluxCostToSwapIn).toBe(Math.max(...swapCosts));
  });

  it("Gas is the fastest Form", () => {
    const speeds = FORM_IDS.map((id) => ALL_FORMS[id].moveSpeedMultiplier);
    expect(ALL_FORMS.gas.moveSpeedMultiplier).toBe(Math.max(...speeds));
  });
});
