import { describe, expect, it } from "vitest";
import {
  createRunFlowActor,
  isConfluenceUnlocked,
  MIDPOINT_REVELATION_FRAGMENT_THRESHOLD,
  TOTAL_FRAGMENT_COUNT,
  type RunFlowActor,
} from "./RunFlowMachine.js";
import type { SchoolId } from "../combat/types.js";

/** Descends into `wingId`, clears two rooms and two floors (the second final), then defeats the
 * boss. Returns the total Ichor reward granted along the way so callers can assert the exact
 * amount banked, without hardcoding arithmetic at every call site. */
function clearWingExpedition(actor: RunFlowActor, wingId: SchoolId): number {
  actor.send({ type: "SELECT_WING", wingId });
  actor.send({ type: "ROOM_CLEARED", ichorReward: 10 });
  actor.send({ type: "ROOM_CLEARED", ichorReward: 15 });
  actor.send({ type: "FLOOR_CLEARED", isFinalFloor: false, ichorReward: 5 });
  actor.send({ type: "ROOM_CLEARED", ichorReward: 10 });
  actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true, ichorReward: 20 });
  actor.send({ type: "BOSS_DEFEATED", ichorReward: 100 });
  return 10 + 15 + 5 + 10 + 20 + 100;
}

/** Same shape as `clearWingExpedition`, but for the Confluence: no `wingId` payload, and
 * `BOSS_DEFEATED` doesn't always land in `expeditionReward` (see the machine's
 * `isFirstConfluenceClear` guard). */
function clearConfluenceExpedition(actor: RunFlowActor): number {
  actor.send({ type: "SELECT_CONFLUENCE" });
  actor.send({ type: "ROOM_CLEARED", ichorReward: 25 });
  actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true, ichorReward: 30 });
  actor.send({ type: "BOSS_DEFEATED", ichorReward: 200 });
  return 25 + 30 + 200;
}

describe("runFlowMachine", () => {
  it("starts in mainMenu", () => {
    const actor = createRunFlowActor();
    expect(actor.getSnapshot().value).toBe("mainMenu");
  });

  it("drives the full main-story arc: menu -> hub -> five wings -> Confluence -> ending -> New Game+", () => {
    const actor = createRunFlowActor();

    actor.send({ type: "START_GAME" });
    expect(actor.getSnapshot().value).toBe("hub");

    let expectedIchor = 0;

    // --- Wing 1 (Earth) ---
    expectedIchor += clearWingExpedition(actor, "earth");
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual(["earth"]);
      expect(snapshot.context.ichorBankedThisRun).toBe(expectedIchor);
      expect(snapshot.context.pendingIchor).toBe(0);
      expect(snapshot.context.currentWingId).toBeNull();
      expect(snapshot.context.currentFloorIndex).toBe(0);
      expect(snapshot.context.currentRoomIndex).toBe(0);
      expect(snapshot.context.midpointRevelationSeen).toBe(false);
    }

    // Confluence must stay locked with only 1/5 fragments recovered.
    actor.send({ type: "SELECT_CONFLUENCE" });
    expect(actor.getSnapshot().value).toBe("hub");
    expect(actor.getSnapshot().context.currentWingId).toBeNull();

    // --- Wing 2 (Fire) ---
    expectedIchor += clearWingExpedition(actor, "fire");
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual(["earth", "fire"]);
      expect(snapshot.context.ichorBankedThisRun).toBe(expectedIchor);
      expect(snapshot.context.midpointRevelationSeen).toBe(false);
    }

    expect(MIDPOINT_REVELATION_FRAGMENT_THRESHOLD).toBe(3);

    // --- Wing 3 (Water) — crosses the midpoint-revelation threshold ---
    expectedIchor += clearWingExpedition(actor, "water");
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual(["earth", "fire", "water"]);
      expect(snapshot.context.ichorBankedThisRun).toBe(expectedIchor);
      // `midpointRevelation` is a transient state reached via a guarded `always` transition that
      // immediately routes back to `hub` in the same macrostep — so the resting snapshot can never
      // observe *being* in it (XState only emits a snapshot once a `send()` call fully settles).
      // The one-time flag it sets on entry is the observable proof it fired.
      expect(snapshot.context.midpointRevelationSeen).toBe(true);
    }

    // --- Wing 4 (Air) — revelation must not re-fire (it's guarded on midpointRevelationSeen) ---
    expectedIchor += clearWingExpedition(actor, "air");
    expect(actor.getSnapshot().context.fragmentsRecovered).toEqual([
      "earth",
      "fire",
      "water",
      "air",
    ]);
    expect(actor.getSnapshot().context.midpointRevelationSeen).toBe(true);

    // Confluence still locked at 4/5.
    expect(isConfluenceUnlocked(actor.getSnapshot().context)).toBe(false);
    actor.send({ type: "SELECT_CONFLUENCE" });
    expect(actor.getSnapshot().value).toBe("hub");

    // --- Wing 5 (Aether) — the fifth and final Fragment ---
    expectedIchor += clearWingExpedition(actor, "aether");
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual([
        "earth",
        "fire",
        "water",
        "air",
        "aether",
      ]);
      expect(snapshot.context.fragmentsRecovered.length).toBe(TOTAL_FRAGMENT_COUNT);
      expect(isConfluenceUnlocked(snapshot.context)).toBe(true);
    }

    // --- The Confluence: Kenoma, the true final boss ---
    actor.send({ type: "SELECT_CONFLUENCE" });
    expect(actor.getSnapshot().value).toBe("inExpedition");
    expect(actor.getSnapshot().context.currentWingId).toBe("confluence");

    expectedIchor += clearConfluenceExpedition(actor);
    {
      const snapshot = actor.getSnapshot();
      // Defeating Kenoma routes to `ending`, not the ordinary `expeditionReward` -> `hub` cycle.
      expect(snapshot.value).toBe("ending");
      expect(snapshot.context.ichorBankedThisRun).toBe(expectedIchor);
      expect(snapshot.context.pendingIchor).toBe(0);
      // Kenoma isn't a Spite guarding a Fragment — no sixth entry is added.
      expect(snapshot.context.fragmentsRecovered.length).toBe(TOTAL_FRAGMENT_COUNT);
      expect(snapshot.context.isNewGamePlus).toBe(false);
    }

    // --- New Game+ ---
    actor.send({ type: "START_NEW_GAME_PLUS" });
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.isNewGamePlus).toBe(true);
    }

    // --- Confluence becomes the repeatable endgame loop: a second Kenoma clear in NG+ must NOT
    // re-trigger `ending` again — it's now just an ordinary expedition reward. ---
    const ichorBeforeSecondConfluenceClear = actor.getSnapshot().context.ichorBankedThisRun;
    expectedIchor += clearConfluenceExpedition(actor);
    {
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.ichorBankedThisRun).toBe(expectedIchor);
      expect(snapshot.context.ichorBankedThisRun).toBeGreaterThan(ichorBeforeSecondConfluenceClear);
    }
  });

  it("advances currentFloorIndex/currentRoomIndex via ROOM_CLEARED/FLOOR_CLEARED without a state change until the final floor", () => {
    const actor = createRunFlowActor();
    actor.send({ type: "START_GAME" });
    actor.send({ type: "SELECT_WING", wingId: "earth" });

    expect(actor.getSnapshot().context.currentFloorIndex).toBe(0);
    expect(actor.getSnapshot().context.currentRoomIndex).toBe(0);

    actor.send({ type: "ROOM_CLEARED" });
    actor.send({ type: "ROOM_CLEARED" });
    expect(actor.getSnapshot().value).toBe("inExpedition");
    expect(actor.getSnapshot().context.currentRoomIndex).toBe(2);

    actor.send({ type: "FLOOR_CLEARED", isFinalFloor: false });
    expect(actor.getSnapshot().value).toBe("inExpedition");
    expect(actor.getSnapshot().context.currentFloorIndex).toBe(1);
    expect(actor.getSnapshot().context.currentRoomIndex).toBe(0);

    actor.send({ type: "ROOM_CLEARED" });
    expect(actor.getSnapshot().context.currentRoomIndex).toBe(1);

    actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true });
    expect(actor.getSnapshot().value).toBe("bossFight");
    expect(actor.getSnapshot().context.currentFloorIndex).toBe(2);
  });

  it("treats ichorReward as optional on ROOM_CLEARED/FLOOR_CLEARED/BOSS_DEFEATED (defaults to 0)", () => {
    const actor = createRunFlowActor();
    actor.send({ type: "START_GAME" });
    actor.send({ type: "SELECT_WING", wingId: "earth" });
    actor.send({ type: "ROOM_CLEARED" });
    actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true });
    actor.send({ type: "BOSS_DEFEATED" });

    expect(actor.getSnapshot().value).toBe("hub");
    expect(actor.getSnapshot().context.ichorBankedThisRun).toBe(0);
  });

  it("toggles sideContentCompleted via COMPLETE_SIDE_CONTENT without changing state", () => {
    const actor = createRunFlowActor();
    actor.send({ type: "START_GAME" });

    expect(actor.getSnapshot().context.sideContentCompleted).toBe(false);
    actor.send({ type: "COMPLETE_SIDE_CONTENT" });
    expect(actor.getSnapshot().value).toBe("hub");
    expect(actor.getSnapshot().context.sideContentCompleted).toBe(true);
  });

  describe("failure path", () => {
    it("dying mid-bossFight forfeits unbanked Ichor and does not record the wing's Fragment", () => {
      const actor = createRunFlowActor();

      actor.send({ type: "START_GAME" });
      actor.send({ type: "SELECT_WING", wingId: "water" });
      actor.send({ type: "ROOM_CLEARED", ichorReward: 10 });
      actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true, ichorReward: 20 });
      expect(actor.getSnapshot().value).toBe("bossFight");
      expect(actor.getSnapshot().context.pendingIchor).toBe(30);

      actor.send({ type: "PLAYER_DIED" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual([]);
      expect(snapshot.context.ichorBankedThisRun).toBe(0);
      expect(snapshot.context.pendingIchor).toBe(0);
      expect(snapshot.context.currentWingId).toBeNull();
    });

    it("dying mid-inExpedition (before reaching the boss) also fails the run", () => {
      const actor = createRunFlowActor();
      actor.send({ type: "START_GAME" });
      actor.send({ type: "SELECT_WING", wingId: "air" });
      actor.send({ type: "ROOM_CLEARED", ichorReward: 10 });
      actor.send({ type: "PLAYER_DIED" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      expect(snapshot.context.fragmentsRecovered).toEqual([]);
      expect(snapshot.context.ichorBankedThisRun).toBe(0);
    });

    it("banked Ichor from an earlier successful expedition survives a later run failure", () => {
      const actor = createRunFlowActor();
      actor.send({ type: "START_GAME" });

      const bankedFromFirstWing = clearWingExpedition(actor, "earth");
      expect(actor.getSnapshot().context.ichorBankedThisRun).toBe(bankedFromFirstWing);

      actor.send({ type: "SELECT_WING", wingId: "fire" });
      actor.send({ type: "ROOM_CLEARED", ichorReward: 999 });
      actor.send({ type: "FLOOR_CLEARED", isFinalFloor: true, ichorReward: 999 });
      actor.send({ type: "PLAYER_DIED" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("hub");
      // Only the first wing's Fragment/Ichor stuck; the failed second expedition's 1998 pending
      // Ichor was forfeited entirely.
      expect(snapshot.context.fragmentsRecovered).toEqual(["earth"]);
      expect(snapshot.context.ichorBankedThisRun).toBe(bankedFromFirstWing);
    });
  });
});
