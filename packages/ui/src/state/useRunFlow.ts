import { useEffect, useState } from "react";
import type { RunFlowActor, RunFlowContext, RunFlowSnapshot } from "@pithos/sim";

/**
 * Bridges an XState `RunFlowActor` (packages/sim) into React. One actor
 * instance is created once (in apps/game/src/main.ts) and shared between
 * the 2D UI tree (this hook) and the 3D game loop, which reads the same
 * actor's snapshot directly to decide whether to run/render the Three.js
 * world (see GameShell.tsx's module doc for the screen-routing model).
 */
export function useRunFlow(actor: RunFlowActor): {
  state: RunFlowSnapshot["value"];
  context: RunFlowContext;
  send: RunFlowActor["send"];
} {
  const [snapshot, setSnapshot] = useState<RunFlowSnapshot>(() => actor.getSnapshot());

  useEffect(() => {
    const subscription = actor.subscribe(setSnapshot);
    return () => subscription.unsubscribe();
  }, [actor]);

  return { state: snapshot.value, context: snapshot.context, send: actor.send };
}
