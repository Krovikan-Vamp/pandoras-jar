import { describe, expect, it } from "vitest";
import type { FormDefinition } from "../combat/types.js";
import { FormFluxMachine } from "./FormFluxMachine.js";

/** Minimal, self-consistent FormDefinition fixture — only the fields this class reads matter for these tests. */
function makeForm(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return {
    id: "solid",
    displayName: "Test Form",
    primaryAttack: {
      windupSeconds: 0.1,
      activeSeconds: 0.1,
      recoverySeconds: 0.1,
      hitbox: { kind: "melee", range: 1.5, arcDegrees: 120 },
      baseDamage: 10,
    },
    secondaryAbility: {
      id: "test_secondary",
      cooldownSeconds: 5,
      timeline: {
        windupSeconds: 0.1,
        activeSeconds: 0.1,
        recoverySeconds: 0.1,
        hitbox: { kind: "melee", range: 2, arcDegrees: 360 },
        baseDamage: 5,
      },
    },
    moveSpeedMultiplier: 1,
    fluxCostToSwapIn: 20,
    chargeParams: {
      buildRatePerSecond: 10,
      maxCharge: 100,
      releaseThreshold: 0.5,
    },
    burstOnSwapOut: {
      id: "test_burst",
      timeline: {
        windupSeconds: 0.1,
        activeSeconds: 0.1,
        recoverySeconds: 0.2,
        hitbox: { kind: "melee", range: 5, arcDegrees: 360 },
        baseDamage: 30,
      },
      radius: 5,
    },
    ...overrides,
  };
}

describe("FormFluxMachine", () => {
  describe("Flux regen and spend", () => {
    it("initializes at maxFlux with zero charge for every FormId", () => {
      const machine = new FormFluxMachine(100, 10);

      expect(machine.state.currentFlux).toBe(100);
      expect(machine.state.maxFlux).toBe(100);
      expect(machine.state.regenPerSecond).toBe(10);
      expect(machine.state.charge).toEqual({ solid: 0, liquid: 0, gas: 0, plasma: 0 });
    });

    it("regenerates Flux over time, clamped to maxFlux", () => {
      const machine = new FormFluxMachine(100, 10);
      machine.spend(makeForm({ fluxCostToSwapIn: 80 }));
      expect(machine.state.currentFlux).toBe(20);

      machine.regenerate(1);
      expect(machine.state.currentFlux).toBe(30);

      machine.regenerate(100);
      expect(machine.state.currentFlux).toBe(100);
    });

    it("can afford and spend a Form's swap-in cost when Flux is sufficient", () => {
      const machine = new FormFluxMachine(50, 0);
      const form = makeForm({ fluxCostToSwapIn: 30 });

      expect(machine.canAfford(form)).toBe(true);
      expect(machine.spend(form)).toBe(true);
      expect(machine.state.currentFlux).toBe(20);
    });

    it("refuses to spend and deducts nothing when Flux is insufficient", () => {
      const machine = new FormFluxMachine(50, 0);
      const form = makeForm({ fluxCostToSwapIn: 60 });

      expect(machine.canAfford(form)).toBe(false);
      expect(machine.spend(form)).toBe(false);
      expect(machine.state.currentFlux).toBe(50);
    });

    it("treats an exact-balance swap as affordable (boundary case)", () => {
      const machine = new FormFluxMachine(30, 0);
      const form = makeForm({ fluxCostToSwapIn: 30 });

      expect(machine.canAfford(form)).toBe(true);
      expect(machine.spend(form)).toBe(true);
      expect(machine.state.currentFlux).toBe(0);
    });

    it("refundOnKill adds Flux immediately, clamped to maxFlux", () => {
      const machine = new FormFluxMachine(100, 0);
      machine.spend(makeForm({ fluxCostToSwapIn: 90 }));
      expect(machine.state.currentFlux).toBe(10);

      machine.refundOnKill(15);
      expect(machine.state.currentFlux).toBe(25);

      machine.refundOnKill(1000);
      expect(machine.state.currentFlux).toBe(100);
    });
  });

  describe("Charge accumulation", () => {
    it("accumulates charge per-Form at buildRatePerSecond", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 20, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("solid", form, 1);
      expect(machine.getCharge("solid")).toBe(20);

      machine.accumulateCharge("solid", form, 2);
      expect(machine.getCharge("solid")).toBe(60);

      // Other Forms are untouched.
      expect(machine.getCharge("liquid")).toBe(0);
    });

    it("clamps accumulated charge at maxCharge and stays there (diminishing returns via clamp)", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 50, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("plasma", form, 10); // way past max in one step
      expect(machine.getCharge("plasma")).toBe(100);

      machine.accumulateCharge("plasma", form, 5); // camping further produces no extra charge
      expect(machine.getCharge("plasma")).toBe(100);
    });
  });

  describe("Swap-out charge release", () => {
    it("does not report released when charge is below the release threshold", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 10, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("gas", form, 3); // 30 / 100, below the 50-threshold
      const result = machine.consumeChargeOnSwapOut("gas", form);

      expect(result.released).toBe(false);
      expect(machine.getCharge("gas")).toBe(0); // reset regardless of outcome
    });

    it("reports released when charge is at or above the release threshold", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 10, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("gas", form, 6); // 60 / 100, above the 50-threshold
      const result = machine.consumeChargeOnSwapOut("gas", form);

      expect(result.released).toBe(true);
      expect(machine.getCharge("gas")).toBe(0);
    });

    it("treats exactly hitting the threshold as released (boundary case)", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 10, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("liquid", form, 5); // exactly 50 / 100
      const result = machine.consumeChargeOnSwapOut("liquid", form);

      expect(result.released).toBe(true);
    });

    it("resets charge to 0 after consuming, so a subsequent swap-out starts fresh", () => {
      const machine = new FormFluxMachine(100, 0);
      const form = makeForm({
        chargeParams: { buildRatePerSecond: 10, maxCharge: 100, releaseThreshold: 0.5 },
      });

      machine.accumulateCharge("solid", form, 10); // maxed out, well above threshold
      machine.consumeChargeOnSwapOut("solid", form);

      const secondResult = machine.consumeChargeOnSwapOut("solid", form);
      expect(secondResult.released).toBe(false);
    });
  });
});
