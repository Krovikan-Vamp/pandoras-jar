import { assign, createActor, setup, type ActorRefFrom, type SnapshotFrom } from "xstate";
import type { SchoolId } from "../combat/types.js";

/**
 * Narrative/run-structure statechart for a full PITHOS session: main menu ->
 * hub ("Elpis's Threshold") -> repeated wing expeditions -> the Confluence ->
 * ending -> New Game+. See docs/GDD.md §2 ("Story Beats") and §9 ("Run
 * Structure") for the narrative source of truth this machine encodes.
 *
 * Scope note: this machine owns *macro* run flow only (XState is the
 * project's chosen tool for exactly this — see docs/TECHNICAL_SPEC.md §1/§3,
 * "low-frequency, guard-heavy run flow"). It knows nothing about combat,
 * room/floor *content* generation (that's `packages/sim/src/procgen`), or
 * persistence (that's `packages/save`) — it only tracks the minimal context
 * needed to drive transitions and to hand a consumer (e.g. `apps/game`)
 * enough state to render the right screen and call into those other systems.
 *
 * Design choices worth flagging for reviewers:
 *
 * - Floor/room progress within a wing is plain context (`currentFloorIndex`,
 *   `currentRoomIndex`) advanced by `ROOM_CLEARED`/`FLOOR_CLEARED` events,
 *   not one XState state per room — an explosion of states for no benefit.
 *   The boss room *does* get its own top-level state (`bossFight`) because
 *   it's a meaningfully distinct mode (no perk-pick after it, and it's the
 *   only place `BOSS_DEFEATED`/`PLAYER_DIED` produce their special outcomes).
 * - This machine doesn't know how many floors a wing has — that's owned by
 *   `procgen/WingGenerator`. The caller reports whether a cleared floor was
 *   the wing's last one via `FLOOR_CLEARED`'s `isFinalFloor` flag; the
 *   machine only reacts to that flag, keeping the two subsystems decoupled.
 * - "Confluence available" (GDD §2/§9: unlocks once all 5 Hope Fragments are
 *   recovered) is deliberately *not* its own XState state — it's a guard
 *   (`confluenceUnlocked`, see `isConfluenceUnlocked` below) that gates a
 *   `hub` -> `inExpedition` transition into the same `inExpedition`/
 *   `bossFight` states used for ordinary wings, with `currentWingId:
 *   "confluence"`. This mirrors the GDD/tech-spec's explicit call to reuse
 *   the wing generator rather than build a parallel system for it.
 * - `midpointRevelation` (GDD: "once several Fragments are recovered, Elpis
 *   realizes... Kenoma") and Confluence-unlock are two *different*
 *   thresholds and must not be conflated: the GDD's "several" is vague, so
 *   this machine treats 3-of-5 as a concrete (placeholder, tunable)
 *   threshold for the narrative beat, while the Confluence itself still
 *   requires all 5, per §9 ("Once all five Fragments are recovered, the
 *   Confluence unlocks").
 * - Ichor bookkeeping models the GDD's "losing a run forfeits unbanked Ichor
 *   but doesn't erase what's already banked": `pendingIchor` accrues during
 *   `inExpedition`/`bossFight` and is only folded into `ichorBankedThisRun`
 *   on reaching `expeditionReward`/`ending`. `runFailed` discards
 *   `pendingIchor` without ever touching `ichorBankedThisRun`.
 * - The ending's two variants (GDD §2: baseline vs. "higher completion" with
 *   side content) aren't modeled as two states — that's over-designing a
 *   narrative flag. `sideContentCompleted` is a plain boolean a future event
 *   can flip; the `ending` state's rendering is a consumer/UI concern.
 */

/** A wing is one of the five Schools, or the endgame "Confluence" (Kenoma's domain, GDD §2/§11). */
export type WingId = SchoolId | "confluence";

/** Once several Fragments are recovered, Elpis realizes something is wrong (GDD §2). "Several" is
 * unspecified in the GDD; 3-of-5 is a concrete placeholder threshold, tunable without touching the
 * transition logic that reads it. */
export const MIDPOINT_REVELATION_FRAGMENT_THRESHOLD = 3;

/** Total Hope Fragments / wings — the Confluence unlock threshold (GDD §9: "Once all five Fragments
 * are recovered, the Confluence unlocks"). */
export const TOTAL_FRAGMENT_COUNT = 5;

export interface RunFlowContext {
  /** Hope Fragments recovered so far, one per wing's Spite defeated. Kenoma (the Confluence boss)
   * yields no Fragment — it's the source of the Grey Hush, not a Spite hoarding one. */
  fragmentsRecovered: SchoolId[];
  /** The wing currently being descended into, or `null` while in the hub/menu/narrative states. */
  currentWingId: WingId | null;
  currentFloorIndex: number;
  currentRoomIndex: number;
  /** Ichor accrued so far in the *current* expedition, not yet committed. Cleared without banking on
   * `PLAYER_DIED`; folded into `ichorBankedThisRun` on reaching `expeditionReward`/`ending`. */
  pendingIchor: number;
  /** Ichor banked so far this play session. Persisting this across sessions is `packages/save`'s job —
   * out of scope here. */
  ichorBankedThisRun: number;
  /** Whether the one-time `midpointRevelation` narrative beat has already fired. */
  midpointRevelationSeen: boolean;
  /** Set once `newGamePlus` is entered; Confluence becomes the repeatable endgame loop (GDD §2,
   * "The Second Kindling") rather than a one-time story climax. */
  isNewGamePlus: boolean;
  /** Placeholder for the GDD §2 "higher completion" ending variant (all Fragments + optional side
   * content). Deliberately just a flag — a future event can set it; no dedicated state needed. */
  sideContentCompleted: boolean;
}

export function createInitialRunFlowContext(): RunFlowContext {
  return {
    fragmentsRecovered: [],
    currentWingId: null,
    currentFloorIndex: 0,
    currentRoomIndex: 0,
    pendingIchor: 0,
    ichorBankedThisRun: 0,
    midpointRevelationSeen: false,
    isNewGamePlus: false,
    sideContentCompleted: false,
  };
}

/** True once all five Hope Fragments are recovered — the Confluence-unlock condition (GDD §9). Shared
 * by the `confluenceUnlocked` guard and available directly to consumers (e.g. a hub UI badge) so
 * neither has to re-derive the threshold independently. */
export function isConfluenceUnlocked(context: RunFlowContext): boolean {
  return context.fragmentsRecovered.length >= TOTAL_FRAGMENT_COUNT;
}

export type RunFlowEvent =
  | { type: "START_GAME" }
  | { type: "SELECT_WING"; wingId: SchoolId }
  | { type: "SELECT_CONFLUENCE" }
  | { type: "ROOM_CLEARED"; ichorReward?: number }
  | { type: "FLOOR_CLEARED"; isFinalFloor: boolean; ichorReward?: number }
  | { type: "BOSS_DEFEATED"; ichorReward?: number }
  | { type: "PLAYER_DIED" }
  | { type: "COMPLETE_SIDE_CONTENT" }
  | { type: "START_NEW_GAME_PLUS" };

/** The machine's top-level state names, exported so a consumer can pattern-match on
 * `snapshot.value` without importing anything from `xstate` itself. */
export type RunFlowStateValue =
  | "mainMenu"
  | "hub"
  | "inExpedition"
  | "bossFight"
  | "expeditionReward"
  | "runFailed"
  | "midpointRevelation"
  | "ending"
  | "newGamePlus";

// --- Event-payload-dependent actions/guards -------------------------------
//
// These read fields that only exist on one specific event variant. They're
// kept as standalone, explicitly-typed values (rather than named entries in
// `setup({ actions/guards })`) because XState v5 types named actions/guards
// against the *full* event union — narrowing to a single event's payload
// only happens automatically for functions written inline at their specific
// `on.<EVENT_TYPE>` call site, which is exactly what these are used as.

const startWingExpedition = assign(
  ({ event }: { event: Extract<RunFlowEvent, { type: "SELECT_WING" }> }) => ({
    currentWingId: event.wingId as WingId,
    currentFloorIndex: 0,
    currentRoomIndex: 0,
    pendingIchor: 0,
  }),
);

const advanceRoomCleared = assign(
  ({
    context,
    event,
  }: {
    context: RunFlowContext;
    event: Extract<RunFlowEvent, { type: "ROOM_CLEARED" }>;
  }) => ({
    currentRoomIndex: context.currentRoomIndex + 1,
    pendingIchor: context.pendingIchor + (event.ichorReward ?? 0),
  }),
);

const advanceFloorCleared = assign(
  ({
    context,
    event,
  }: {
    context: RunFlowContext;
    event: Extract<RunFlowEvent, { type: "FLOOR_CLEARED" }>;
  }) => ({
    currentFloorIndex: context.currentFloorIndex + 1,
    currentRoomIndex: 0,
    pendingIchor: context.pendingIchor + (event.ichorReward ?? 0),
  }),
);

function isFinalFloorEvent({
  event,
}: {
  event: Extract<RunFlowEvent, { type: "FLOOR_CLEARED" }>;
}): boolean {
  return event.isFinalFloor;
}

const recordBossIchorReward = assign(
  ({
    context,
    event,
  }: {
    context: RunFlowContext;
    event: Extract<RunFlowEvent, { type: "BOSS_DEFEATED" }>;
  }) => ({
    pendingIchor: context.pendingIchor + (event.ichorReward ?? 0),
  }),
);

// --- Machine ---------------------------------------------------------------

export const runFlowMachine = setup({
  types: {} as {
    context: RunFlowContext;
    events: RunFlowEvent;
  },
  guards: {
    /** Confluence-unlock guard (GDD §9) — see `isConfluenceUnlocked` for the shared threshold check. */
    confluenceUnlocked: ({ context }) => isConfluenceUnlocked(context),
    /** Fires the one-time midpoint narrative beat once, at the (placeholder) 3-of-5 threshold. */
    shouldTriggerMidpointRevelation: ({ context }) =>
      !context.midpointRevelationSeen &&
      context.fragmentsRecovered.length >= MIDPOINT_REVELATION_FRAGMENT_THRESHOLD,
    /** Distinguishes the main-story Kenoma kill (-> `ending`) from a repeat Confluence clear during
     * the New Game+ endgame loop (-> ordinary `expeditionReward`, since the story has already paid
     * off and Confluence is now just the repeatable endgame content, GDD §2). */
    isFirstConfluenceClear: ({ context }) =>
      context.currentWingId === "confluence" && !context.isNewGamePlus,
  },
  actions: {
    resetExpeditionProgress: assign({
      currentWingId: null,
      currentFloorIndex: 0,
      currentRoomIndex: 0,
    }),
    startConfluenceExpedition: assign({
      currentWingId: "confluence",
      currentFloorIndex: 0,
      currentRoomIndex: 0,
      pendingIchor: 0,
    }),
    /** Adds the just-defeated wing's Hope Fragment, if any (Kenoma/Confluence yields none, and a
     * repeat clear of an already-recorded wing is a no-op rather than a duplicate entry). */
    recordFragmentRecovered: assign({
      fragmentsRecovered: ({ context }) => {
        const wingId = context.currentWingId;
        if (wingId === null || wingId === "confluence") {
          return context.fragmentsRecovered;
        }
        if (context.fragmentsRecovered.includes(wingId)) {
          return context.fragmentsRecovered;
        }
        return [...context.fragmentsRecovered, wingId];
      },
    }),
    bankPendingIchor: assign({
      ichorBankedThisRun: ({ context }) => context.ichorBankedThisRun + context.pendingIchor,
      pendingIchor: 0,
    }),
    discardPendingIchor: assign({
      pendingIchor: 0,
    }),
    markMidpointRevelationSeen: assign({
      midpointRevelationSeen: true,
    }),
    markSideContentCompleted: assign({
      sideContentCompleted: true,
    }),
    enterNewGamePlus: assign({
      isNewGamePlus: true,
    }),
  },
}).createMachine({
  id: "runFlow",
  initial: "mainMenu",
  context: createInitialRunFlowContext,
  states: {
    mainMenu: {
      on: {
        START_GAME: { target: "hub" },
      },
    },

    hub: {
      // Clears out any leftover expedition context (currentWingId/floor/room) whenever we land back
      // in the hub, whether from a fresh game, a completed/failed expedition, or a narrative beat.
      entry: "resetExpeditionProgress",
      on: {
        SELECT_WING: { target: "inExpedition", actions: startWingExpedition },
        SELECT_CONFLUENCE: {
          target: "inExpedition",
          guard: "confluenceUnlocked",
          actions: "startConfluenceExpedition",
        },
        COMPLETE_SIDE_CONTENT: { actions: "markSideContentCompleted" },
      },
      // Guarded, automatic — fires the moment the threshold is met, without waiting on player input.
      always: {
        target: "midpointRevelation",
        guard: "shouldTriggerMidpointRevelation",
      },
    },

    inExpedition: {
      on: {
        ROOM_CLEARED: { actions: advanceRoomCleared },
        FLOOR_CLEARED: [
          { guard: isFinalFloorEvent, target: "bossFight", actions: advanceFloorCleared },
          { actions: advanceFloorCleared },
        ],
        PLAYER_DIED: { target: "runFailed" },
      },
    },

    bossFight: {
      on: {
        BOSS_DEFEATED: [
          {
            guard: "isFirstConfluenceClear",
            target: "ending",
            actions: recordBossIchorReward,
          },
          {
            target: "expeditionReward",
            actions: [recordBossIchorReward, "recordFragmentRecovered"],
          },
        ],
        PLAYER_DIED: { target: "runFailed" },
      },
    },

    expeditionReward: {
      entry: "bankPendingIchor",
      always: { target: "hub" },
    },

    runFailed: {
      entry: "discardPendingIchor",
      always: { target: "hub" },
    },

    midpointRevelation: {
      entry: "markMidpointRevelationSeen",
      always: { target: "hub" },
    },

    ending: {
      entry: "bankPendingIchor",
      on: {
        START_NEW_GAME_PLUS: { target: "newGamePlus" },
      },
    },

    newGamePlus: {
      entry: "enterNewGamePlus",
      always: { target: "hub" },
    },
  },
});

export type RunFlowActor = ActorRefFrom<typeof runFlowMachine>;
export type RunFlowSnapshot = SnapshotFrom<typeof runFlowMachine>;

/** Creates and starts a fresh run-flow actor. The thin wrapper is the intended integration point for
 * `apps/game` — callers shouldn't need to import `createActor`/`runFlowMachine` directly. */
export function createRunFlowActor(): RunFlowActor {
  return createActor(runFlowMachine).start();
}
