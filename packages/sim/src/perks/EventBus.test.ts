import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "./EventBus.js";

describe("createEventBus", () => {
  it("dispatches typed payloads to subscribers", () => {
    const bus = createEventBus();
    const onHit = vi.fn();
    bus.on("onHit", onHit);

    bus.emit("onHit", { attackerId: "player-1", targetId: "enemy-1", damage: 12, damageType: "fire" });

    expect(onHit).toHaveBeenCalledOnce();
    expect(onHit).toHaveBeenCalledWith({
      attackerId: "player-1",
      targetId: "enemy-1",
      damage: 12,
      damageType: "fire",
    });
  });

  it("stops delivering events to a handler once it is unsubscribed via off()", () => {
    const bus = createEventBus();
    const onKill = vi.fn();
    bus.on("onKill", onKill);
    bus.off("onKill", onKill);

    bus.emit("onKill", { killerId: "player-1", victimId: "enemy-1" });

    expect(onKill).not.toHaveBeenCalled();
  });

  it("keeps independently-created buses isolated from each other", () => {
    const busA = createEventBus();
    const busB = createEventBus();
    const onDashA = vi.fn();
    const onDashB = vi.fn();
    busA.on("onDash", onDashA);
    busB.on("onDash", onDashB);

    busA.emit("onDash", { actorId: "player-1" });

    expect(onDashA).toHaveBeenCalledOnce();
    expect(onDashB).not.toHaveBeenCalled();
  });
});
