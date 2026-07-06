import { FORM_IDS, type FluxState, type FormDefinition, type FormId } from "../combat/types.js";

/**
 * Hand-rolled Flux/Charge state machine (TECHNICAL_SPEC.md §3 "Flux/Form-shift
 * state machine"). Deliberately a plain class, not a statechart library —
 * this runs every combat frame and needs to be maximally transparent to
 * trace. It owns the numeric rules only:
 *
 *  - Flux regenerates over time and on kill, and gates Form swaps.
 *  - Charge accumulates per-Form while you stay in it, capped at
 *    `chargeParams.maxCharge`.
 *  - Swapping out of a Form reports whether its charge crossed
 *    `chargeParams.releaseThreshold`, so the caller can spawn the actual
 *    `BurstEffect` hitbox through the same effect pipeline perks use
 *    (TECHNICAL_SPEC.md §3 "Perk/modifier hook system"). This class never
 *    spawns effects or listens for events itself — it is pure state.
 *
 * "Diminishing returns" on camping a Form (GDD §4): modeled as a hard clamp
 * at `maxCharge` rather than a decay curve. Once a Form is fully charged,
 * more time spent in it produces zero additional charge or benefit — the
 * only way to convert that charge into value is to actually swap out and
 * trigger the burst. That clamp alone is what "pushes" rotation: there is
 * strictly no upside to sitting at full charge, so a fancier decay isn't
 * needed to produce the desired player behavior.
 */
export class FormFluxMachine {
  /**
   * The wrapped `FluxState` — same shape stored on `Entity.combat.flux`.
   * Exposed directly (not cloned) so callers can hand this object straight
   * to the ECS entity and see it update in place as methods below mutate
   * it; that's what "maximally transparent to trace" buys you here.
   */
  public readonly state: FluxState;

  constructor(maxFlux: number, regenPerSecond: number) {
    const charge = {} as Record<FormId, number>;
    for (const formId of FORM_IDS) {
      charge[formId] = 0;
    }

    this.state = {
      currentFlux: maxFlux,
      maxFlux,
      regenPerSecond,
      charge,
    };
  }

  /** Passive time-based Flux regen. Called once per combat frame with that frame's dt. */
  regenerate(dt: number): void {
    this.state.currentFlux = Math.min(
      this.state.maxFlux,
      this.state.currentFlux + this.state.regenPerSecond * dt,
    );
  }

  /** Instant Flux refund, e.g. invoked by the caller from an `onKill` event. Pure addition, clamped to max. */
  refundOnKill(amount: number): void {
    this.state.currentFlux = Math.min(this.state.maxFlux, this.state.currentFlux + amount);
  }

  /** Whether there's enough current Flux to swap into `form`, without spending anything. */
  canAfford(form: FormDefinition): boolean {
    return this.state.currentFlux >= form.fluxCostToSwapIn;
  }

  /**
   * Attempts to spend the Flux required to swap into `form`. Deducts and
   * returns `true` on success; leaves `currentFlux` untouched and returns
   * `false` if unaffordable.
   */
  spend(form: FormDefinition): boolean {
    if (!this.canAfford(form)) {
      return false;
    }
    this.state.currentFlux -= form.fluxCostToSwapIn;
    return true;
  }

  /**
   * Builds Charge for `formId` while the actor stays in it, at
   * `form.chargeParams.buildRatePerSecond`, clamped to
   * `form.chargeParams.maxCharge`. No-op past the cap (see class docs on
   * diminishing returns).
   */
  accumulateCharge(formId: FormId, form: FormDefinition, dt: number): void {
    const current = this.state.charge[formId];
    const next = current + form.chargeParams.buildRatePerSecond * dt;
    this.state.charge[formId] = Math.min(form.chargeParams.maxCharge, next);
  }

  /** Read-only lookup of a Form's currently accumulated Charge, without consuming it. */
  getCharge(formId: FormId): number {
    return this.state.charge[formId];
  }

  /**
   * Called when swapping OUT of `formId`. Reads its accumulated Charge,
   * resets it to 0 (Charge doesn't carry over between stays in a Form —
   * you either release it now or lose it), and reports whether it crossed
   * `chargeParams.releaseThreshold` (a fraction 0..1 of maxCharge). The
   * caller is responsible for actually spawning `form.burstOnSwapOut` when
   * `released` is true — this class only makes the yes/no call.
   */
  consumeChargeOnSwapOut(formId: FormId, form: FormDefinition): { released: boolean } {
    const accumulated = this.state.charge[formId];
    this.state.charge[formId] = 0;

    const releaseAt = form.chargeParams.releaseThreshold * form.chargeParams.maxCharge;
    return { released: accumulated >= releaseAt };
  }
}
