import { SCHOOL_IDS } from "@pithos/sim";
import type { Perk, RunFlowActor, SchoolId } from "@pithos/sim";
import type { MetaSaveData, SaveAdapter } from "@pithos/save";
import {
  EndingScreen,
  ExpeditionRewardScreen,
  GameHud,
  HubScreen,
  MainMenuScreen,
  MidpointRevelationScreen,
  PerkPickOverlay,
  RunFailedScreen,
  useRunFlow,
} from "@pithos/ui";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ExpeditionRuntime, type HudSnapshot, type WingId } from "./combat/ExpeditionRuntime";

type TransientOverlay =
  | { type: "reward"; wingId: WingId; ichorEarned: number }
  | { type: "failed" }
  | { type: "midpoint" };

interface GameShellProps {
  runFlowActor: RunFlowActor;
  saveAdapter: SaveAdapter;
  initialMeta: MetaSaveData;
}

/**
 * The screen router tying RunFlowMachine (packages/sim) to the Wave 3 UI
 * screens (packages/ui) and the 3D combat loop (ExpeditionRuntime).
 *
 * Important wrinkle this is built around: `expeditionReward`/`runFailed`/
 * `midpointRevelation` are eventless (`always`) states in RunFlowMachine —
 * they resolve to `hub` synchronously before any subscriber observes them
 * (confirmed by RunFlowMachine.test.ts's own findings). So this component
 * does NOT try to render a screen for `state.value === "expeditionReward"`
 * (that state is never actually observable) — instead it tracks a local
 * `transientOverlay` set at the exact call site that sends the triggering
 * event, using data already in hand there (ichorReward, etc.), and detects
 * the midpoint-revelation beat by diffing `context.midpointRevelationSeen`
 * across renders.
 */
export function GameShell({ runFlowActor, saveAdapter, initialMeta }: GameShellProps): JSX.Element {
  const { state, context, send } = useRunFlow(runFlowActor);

  const [meta, setMeta] = useState<MetaSaveData>(() =>
    initialMeta.unlockedSchools.length === 0
      ? { ...initialMeta, unlockedSchools: [...SCHOOL_IDS] }
      : initialMeta,
  );
  const [transientOverlay, setTransientOverlay] = useState<TransientOverlay | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<HudSnapshot | null>(null);
  const [perkChoices, setPerkChoices] = useState<[Perk, Perk, Perk] | null>(null);

  const expeditionContainerRef = useRef<HTMLDivElement>(null);
  const expeditionRuntimeRef = useRef<ExpeditionRuntime | null>(null);
  const prevMidpointSeenRef = useRef(context.midpointRevelationSeen);

  // Persist meta (Ichor, unlocked Schools) to the game's own save data
  // (assets/audio-style: real persistence, not just this browser session)
  // every time it changes.
  useEffect(() => {
    void saveAdapter.saveMeta(meta);
  }, [meta, saveAdapter]);

  // Bank Ichor increases from RunFlowContext into meta the moment they land.
  const prevBankedRef = useRef(context.ichorBankedThisRun);
  useEffect(() => {
    const delta = context.ichorBankedThisRun - prevBankedRef.current;
    prevBankedRef.current = context.ichorBankedThisRun;
    if (delta > 0) {
      setMeta((prev) => ({ ...prev, ichor: prev.ichor + delta }));
    }
  }, [context.ichorBankedThisRun]);

  // Detect the midpoint-revelation beat (see class doc above for why this
  // can't just be `state === "midpointRevelation"`).
  useEffect(() => {
    if (context.midpointRevelationSeen && !prevMidpointSeenRef.current) {
      setTransientOverlay({ type: "midpoint" });
    }
    prevMidpointSeenRef.current = context.midpointRevelationSeen;
  }, [context.midpointRevelationSeen]);

  const isInActiveCombat = state === "inExpedition" || state === "bossFight";

  useEffect(() => {
    if (!isInActiveCombat) return;
    const container = expeditionContainerRef.current;
    if (!container || expeditionRuntimeRef.current) return;

    const wingId = context.currentWingId as WingId;
    const runtime = new ExpeditionRuntime(container, {
      onHudUpdate: setHudSnapshot,
      onPerkChoiceNeeded: setPerkChoices,
      onRoomCleared: (ichorReward) => send({ type: "ROOM_CLEARED", ichorReward }),
      onFloorCleared: (isFinalFloor, ichorReward) => send({ type: "FLOOR_CLEARED", isFinalFloor, ichorReward }),
      onBossDefeated: (ichorReward) => {
        send({ type: "BOSS_DEFEATED", ichorReward });
        setTransientOverlay({ type: "reward", wingId, ichorEarned: ichorReward });
      },
      onPlayerDied: () => {
        send({ type: "PLAYER_DIED" });
        setTransientOverlay({ type: "failed" });
      },
    });
    runtime.start(wingId);
    expeditionRuntimeRef.current = runtime;

    return () => {
      runtime.dispose();
      expeditionRuntimeRef.current = null;
      setHudSnapshot(null);
      setPerkChoices(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed only on isInActiveCombat; see class doc.
  }, [isInActiveCombat]);

  const handlePerkSelect = useCallback((perk: Perk) => {
    expeditionRuntimeRef.current?.resolvePerkChoice(perk);
    setPerkChoices(null);
  }, []);

  const handleStartGame = useCallback(() => send({ type: "START_GAME" }), [send]);
  const handleSelectWing = useCallback((schoolId: SchoolId) => send({ type: "SELECT_WING", wingId: schoolId }), [send]);
  const handleSelectConfluence = useCallback(() => send({ type: "SELECT_CONFLUENCE" }), [send]);

  if (transientOverlay?.type === "midpoint") {
    return <MidpointRevelationScreen onContinue={() => setTransientOverlay(null)} />;
  }
  if (transientOverlay?.type === "reward") {
    return (
      <ExpeditionRewardScreen
        ichorEarned={transientOverlay.ichorEarned}
        wingCleared={transientOverlay.wingId}
        onContinue={() => setTransientOverlay(null)}
      />
    );
  }
  if (transientOverlay?.type === "failed") {
    return <RunFailedScreen onContinue={() => setTransientOverlay(null)} />;
  }

  if (state === "mainMenu") {
    const hasSaveData = meta.ichor > 0 || meta.permanentUnlocks.length > 0;
    // "Continue" has no distinct mid-run resume yet (RunState persistence
    // across page loads isn't wired in this pass) — both buttons start the
    // same way; the meaningful difference is only whether prior Ichor/
    // unlocks already exist.
    return <MainMenuScreen onStartGame={handleStartGame} onContinue={handleStartGame} hasSaveData={hasSaveData} />;
  }

  if (state === "hub") {
    return (
      <HubScreen
        context={context}
        ichor={meta.ichor}
        unlockedSchools={meta.unlockedSchools}
        onSelectWing={handleSelectWing}
        onSelectConfluence={handleSelectConfluence}
      />
    );
  }

  if (isInActiveCombat) {
    return (
      <div style={{ position: "fixed", inset: 0 }}>
        <div ref={expeditionContainerRef} style={{ position: "absolute", inset: 0 }} />
        {hudSnapshot && <GameHud {...hudSnapshot} />}
        {perkChoices && <PerkPickOverlay perks={perkChoices} onSelect={handlePerkSelect} />}
      </div>
    );
  }

  if (state === "ending") {
    return (
      <EndingScreen
        isFullCompletion={context.sideContentCompleted}
        onNewGamePlus={() => send({ type: "START_NEW_GAME_PLUS" })}
        // RunFlowMachine has no "return to main menu from ending" event yet
        // (only START_NEW_GAME_PLUS) — reloading is a blunt but honest
        // placeholder until that's added.
        onReturnToMenu={() => window.location.reload()}
      />
    );
  }

  // "newGamePlus" is itself an eventless always-transition straight back to
  // hub (see class doc) — it's never actually observable here either.
  return <HubScreen context={context} ichor={meta.ichor} unlockedSchools={meta.unlockedSchools} onSelectWing={handleSelectWing} onSelectConfluence={handleSelectConfluence} />;
}
