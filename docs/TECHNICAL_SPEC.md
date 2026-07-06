# PITHOS: Embers of Elpis — Technical Build Spec

## Context

The game design doc for PITHOS: Embers of Elpis (a Hades-style isometric 3D
action-roguelike) already exists in full — see [`GDD.md`](./GDD.md). What
doesn't exist yet is any code, tooling, or technical architecture.

The developer is fluent in Go, TypeScript, and Python, explicitly does not
know C++, and intends to build this primarily by directing an AI coding agent
(Claude Code) through text-based edits rather than hands-on engine-editor
work themselves — "vibe coding the whole thing." The stack below (custom
TypeScript + Three.js) is chosen specifically because every line of the game
lives in a plain-text file an AI agent can read, edit, and diff directly —
no engine GUI, no visual editors, no proprietary scene/prefab formats. 3D
models will not be hand-authored; they'll be sourced from asset marketplaces
or AI-generated, which this spec accounts for with an explicit sourcing
pipeline and a dedicated subagent workflow.

Goal of this spec: get to a playable vertical slice (1 School × 2 Forms, 1
wing, 1 boss, full hub/save loop) as fast as possible, on an architecture
that scales cleanly to the full 5 Schools × 4 Forms × 6 bosses without
requiring a rewrite.

---

## 1. Tech Stack Decision

**TypeScript + Three.js + Rapier (WASM physics) + Tauri v2**, browser-first
with native desktop packaging.

| Piece | Choice | Why |
|---|---|---|
| Language | TypeScript (strict mode) | The developer's strongest language; zero ramp-up; every file is agent-diffable text |
| Renderer | Three.js | Largest LLM training corpus of any WebGL/WebGPU lib; most direct low-level shader control, which this stylized/VFX-heavy game needs |
| Shading | TSL (Three.js Shading Language) | Author once, compiles to both WGSL (WebGPU) and GLSL (WebGL2) — solves "author once, run everywhere" for the uber-shader reskin approach (§4) |
| ECS | `miniplex` | Entities are plain typed JS objects; queries read like ordinary OO code — the shape of code LLMs are most reliable writing. Not `bitecs` — its SoA/typed-array style is faster but more error-prone for an AI agent, and this game's scale (dozens of enemies/room, not thousands) doesn't need bitecs's ceiling |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Modern, actively maintained, Three.js ships an official integration example. Provides kinematic character controller + shape-cast queries, which is exactly what movement/dash/hitboxes need — no full rigid-body simulation required |
| Macro state | XState | For the low-frequency, guard-heavy run flow (hub → expedition → wing → floor → room → boss → reward) — not for combat, which is hand-rolled (see §3) |
| Event bus | `mitt` | Tiny, huge LLM familiarity, backbone of the perk/modifier hook system |
| Boss AI | `mistreevous` | Lightweight TS-native behavior trees with a visualizer, for attack-pattern selection layered under an explicit phase FSM |
| VFX | `three.quarks` | GPU-instanced particles, ships its own visual particle editor (offsets the "no built-in VFX editor" gap) |
| Save (web) | IndexedDB via `idb` | Async, larger quota, structured-clone support — not localStorage |
| Save (desktop) | Tauri `plugin-fs` | Config-only, zero Rust authored |
| Desktop packaging | Tauri v2 | ~2–10MB installers, ~50MB idle RAM, ~4x faster startup than Electron; config/capabilities-only, no Rust code required for this project's needs |
| Build | Vite | Instant web preview (`vite dev`), static output deployable to itch.io/Cloudflare Pages for playtesting with zero packaging step |

### Explicitly out of scope

- **Custom C++/native engine work.** Never touch Rust inside Tauri beyond
  config; never hand-roll a renderer below Three.js.
- **Co-op/multiplayer.** Not architected for in v1. Keep game state
  reasonably centralized (single source of truth per run) as a matter of
  general good practice, but spend zero engineering effort on netcode,
  determinism, or client/server split until/unless it's greenlit later.
- **Console porting.** Not a v1 target. Revisit only if the game ships and
  there's a reason to invest in certification.
- **Steam Deck as a hard requirement.** Best-effort only. Windows/Mac/Linux
  desktop via Tauri is the tested target; Steam Deck compatibility is
  validated via the **Windows Tauri build running under Proton**, not a
  native-Linux build — Tauri's Linux path depends on WebKitGTK, which has a
  documented history of instability, so don't rely on it as the primary
  Deck path.

---

## 2. Monorepo Structure

pnpm workspaces, separating pure game logic from rendering/platform code —
this is what makes `packages/sim` unit-testable in isolation and keeps the
AI agent's edits scoped to one concern at a time.

```
pithos/
  apps/
    game/              # Vite entry point — the playable client (web target)
    desktop/           # Tauri v2 wrapper: tauri.conf.json, capabilities/*.json — no .rs authored
  packages/
    sim/               # Pure TS: ECS world, Form/School resolver, Flux/Charge FSM,
                        #   perk/modifier engine, room-graph generator, save schema.
                        #   Zero DOM/Three.js deps — fully unit-testable headless.
    data/              # Data tables: schools.ts, forms.ts, perks.ts, rooms/*.ts, bosses/*.ts
    render/            # Three.js adapters: ECS→scene-graph sync, TSL materials,
                        #   three.quarks VFX profiles, asset loader
    ui/                # React + zustand: HUD, perk-pick screen, hub dialogue, menus
    save/              # SaveAdapter interface + IndexedDbSaveAdapter + TauriFsSaveAdapter
  tools/
    pipeline/          # gltf-transform/gltfpack CLI wrappers, skeleton retargeting script
    room-editor/       # in-game "dev mode" overlay for authoring room/spawn/hazard data
  assets/
    models/            # sourced/generated glTF/GLB, organized by School/enemy/boss
    docs/
      GDD.md           # the existing game design doc — commit it here first
      asset-sourcing/  # per-asset sourcing reports from the Asset Scout workflow (§6)
```

---

## 3. Core Systems Architecture

### School × Form data model (the load-bearing decision)

Never hardcode 20 School×Form classes. Split shared **behavior** (per Form)
from **flavor** (per School):

```ts
interface FormDefinition {
  id: FormId;                     // Solid | Liquid | Gas | Plasma
  primaryAttack: AttackTimeline;  // windup/active/recovery frames, hitbox archetype, base damage
  secondaryAbility: AbilityScript;
  movement: MovementModifiers;
  chargeCurve: ChargeParams;
  burstOnSwapOut: BurstEffect;
}

interface SchoolDefinition {
  id: SchoolId;                   // Earth | Fire | Water | Air | Aether
  passive: PassiveEffect;
  ultimate: UltimateBehavior;
  flavor: Record<FormId, FormFlavor>;   // per-Form override: damageType, vfxProfile, sfx, minor stat mods, materialTheme
}

function resolveAttack(form: FormDefinition, school: SchoolDefinition, perks: ModifierRegistry): ResolvedAttack
```

Fire+Solid and Water+Solid are the *same* `primaryAttack` timeline/hitbox
logic, differing only in the resolved `FormFlavor`. Use a discriminated
union over `FormId`/`SchoolId` with `noUncheckedIndexedAccess` and
exhaustive `switch` lint rules so a missing School×Form combo is a
**compile-time error**, not a runtime surprise. This is the concrete
mechanism that keeps an AI agent's edits honest — build a small script or
Vitest test that asserts a `FormFlavor` resolves for all 20 permutations.

Critical file: `packages/sim/src/combat/resolveAttack.ts`
Critical files: `packages/data/src/schools.ts`, `packages/data/src/forms.ts`

### Flux/Form-shift state machine

Hand-rolled plain TS class (not a statechart library) — 4 states, runs every
combat frame, needs to be maximally transparent to trace. Tracks
`currentFlux`/`maxFlux`/regen (time + on-kill) and per-Form `charge`. Swap-out
of a charged Form fires that Form's `burstOnSwapOut` through the same effect
pipeline perks use (see below), so charge releases and perk-triggered
effects share one code path.

Critical file: `packages/sim/src/state/FormFluxMachine.ts`

### Perk/modifier hook system

Event-driven, not if/else. `mitt` event bus emits `onHit`, `onKill`,
`onFormSwap`, `onDash`, `onCrit`, `onTakeDamage`, `onRoomClear`. A
`StatBlock` is computed by folding registered `Modifier { statKey, op,
value, condition? }` entries. `Perk = { id, tier, apply(character) }` where
`apply` just registers modifiers/hooks — adding perk #51 never touches
combat code. Recompute stats on a dirty-flag basis (perk picked / buff
expired / Form swapped), not every frame.

Critical file: `packages/sim/src/perks/ModifierRegistry.ts`

### Procedural room/wing generation

Rooms are authored data (bounds, spawn markers with enemy/wave timing,
hazard volumes, door connections) — not hand-typed coordinates. Build the
**in-game dev-mode room editor early** (Three.js `TransformControls` +
a React debug panel, exporting JSON) — there is no Tiled-equivalent here,
and this is necessary bootstrapping infrastructure, not a nice-to-have.
Generation is a seeded room-graph walk per floor (start → N combat rooms
from a per-biome pool → reward/shop → boss), matching Hades/Gungeon-style
floor generation. The Confluence wing reuses the identical generator,
sampling from the union of all 5 biomes' tagged pools — no new system, only
new data tags.

Critical file: `tools/room-editor/`, `packages/sim/src/procgen/WingGenerator.ts`

### Save system

Two-tier split matching hub/expedition: `MetaSaveData` (Ichor, permanent
unlocks — persists across runs) vs `RunState` (current wing/floor, active
build, Flux/Form/perks — resets each expedition). One `SaveAdapter`
interface, two implementations (`IndexedDbSaveAdapter` for web,
`TauriFsSaveAdapter` for desktop), selected at runtime via
`window.__TAURI__` feature detection. Version the schema
(`v1 → v2 → ...`) with an explicit migration chain from day one.

Critical file: `packages/save/src/SaveAdapter.ts`

### Boss AI

`mistreevous` behavior trees for attack-pattern *selection* (weighted by
phase/HP/distance/cooldown) layered under an explicit phase FSM (Phase 1 /
Phase 2 / Enrage). Boss attacks share the exact same `AttackTimeline` data
structure and executor as player attacks — a boss "move" is authored just
like a player attack (telegraph → windup → active hitbox → recovery), so
the hitbox/timing system only needs to exist once.

---

## 4. Rendering & VFX

- **WebGL2 is the guaranteed baseline; WebGPU is automatic progressive
  enhancement** via Three.js's unified `three/webgpu` renderer entry point,
  which auto-detects and falls back. Don't require WebGPU for launch —
  Linux WebGPU coverage (relevant to the Steam Deck/Proton path) still lags.
- **Form×School "reskin via material":** share Form geometry/animation/VFX
  socket attachment points across Schools; drive the *material* through one
  `ElementalSurfaceMaterial` TSL uber-shader parameterized by a `school`
  uniform (color ramp, noise/fresnel/emissive profile, texture-atlas index).
  One shader, 5 data profiles — not 5 handwritten shaders. This is the
  visual equivalent of the data-driven combat split in §3.
- **Art direction fit:** the "stained glass on ash" look (faceted normals,
  strong rim/fresnel emissive edges, cel-shaded ramps) is a natural, cheap
  fit for a custom toon TSL shader and deliberately avoids needing
  real-time GI, which this stack doesn't provide out of the box.
- **VFX:** `three.quarks` recipes per School — Fire (embers/smoke additive
  sprites), Water (refractive droplets + foam), Air (vortex ribbons + dust),
  Earth (chunky low-poly debris + crack decals), Aether (prismatic
  ribbon/glass-shard sprites).

---

## 5. 3D Asset Pipeline

- **glTF/GLB as the canonical interchange format.** Every likely source
  (Kenney, Quaternius, Sketchfab CC, Synty via export, Meshy, Tripo3D, Luma
  Genie) either exports glTF/GLB natively or is one `gltf-transform`/Blender
  hop away — this is a genuine structural advantage of this stack: no
  format-conversion step for most sourced content.
- **Compression:** Meshopt (via `gltf-transform`/`gltfpack` in
  `tools/pipeline/`) as the primary geometry/animation compressor, paired
  with KTX2/Basis texture compression.
- **Rigging:** standardize on a **Mixamo-compatible humanoid skeleton**.
  Build one `retarget.ts` script (Three.js `SkeletonUtils` + a bone-name
  remap table) that maps any incoming skeleton onto this canonical rig, so
  idle/run/dash/attack clips per Form are authored once and shared across
  every sourced character mesh. This is what makes "20 combos, 1 shared
  system" hold true visually, not just mechanically. Non-humanoid bosses
  use bespoke rigs/animation.
- **Cache everything locally the moment it's used** — don't architect
  around always being able to re-fetch from a third-party service later.

Critical file: `tools/pipeline/optimize-asset.ts`, `tools/pipeline/retarget.ts`

---

## 6. Asset Sourcing Workflow (subagent-driven)

Since 3D models will be sourced or AI-generated rather than hand-modeled,
define an explicit **Asset Scout** workflow rather than doing this ad hoc:

1. **Trigger:** a needed asset is identified (e.g., "Ponos, the Earth
   Spite boss" or "Earth-wing homunculus enemy, tier 1").
2. **Brief:** a short spec is written for the asset — silhouette/role,
   art-direction constraints (stylized/low-poly, "stained glass on ash"
   compatible, needs to accept the elemental uber-shader), rig requirement
   (Mixamo-compatible humanoid, or bespoke if a boss), polycount/format
   target (glTF/GLB).
3. **Sourcing agent (dispatched via the `Agent` tool, `general-purpose` type,
   with WebSearch/WebFetch):** searches free/stylized marketplaces first
   (Kenney.nl, Quaternius, itch.io, Sketchfab filtered to CC-licensed,
   Synty Studios for paid stylized packs), and AI-generation tools (Meshy,
   Tripo3D, Luma Genie) as a fallback when nothing fits. Reports back 2-3
   candidates each, with license terms, format, and rig compatibility
   explicitly noted — written to `assets/docs/asset-sourcing/<asset-name>.md`
   for a human approval step before anything is committed (licensing
   mistakes are expensive to unwind later, so this stays a human-in-the-loop
   checkpoint, not fully automated).
4. **Import:** approved asset runs through `tools/pipeline/optimize-asset.ts`
   (Meshopt/KTX2 compression) and `retarget.ts` (skeleton remap) before
   landing in `assets/models/`.

This keeps the actual model sourcing decoupled from gameplay-code work — the
Asset Scout agent runs independently and reports back, rather than blocking
combat/systems development.

---

## 7. Cross-Platform Build & Deployment

- **Web:** `vite build` → static output → deploy to itch.io/Cloudflare Pages
  for instant playtesting — no packaging step, and this becomes the
  fastest playtest loop throughout development.
- **Desktop:** Tauri v2, config-only (`tauri.conf.json` +
  `capabilities/*.json` for `plugin-fs`/`plugin-dialog`/`plugin-updater`).
  No Rust code needs to be written for this project's scope.
- **Tested targets:** Windows and macOS Tauri builds. Native Linux is
  best-effort (WebKitGTK stability caveat noted above); Steam Deck is
  validated via the Windows build under Proton.
- **Distribution:** if shipping via Steam, Steamworks' own
  update/distribution pipeline sidesteps building a custom updater.

---

## 8. Phased Roadmap

| Phase | Scope | Exit criterion |
|---|---|---|
| **0 — Bootstrap** (~2-4 wks) | Monorepo scaffold, Vite + Three.js isometric camera, WASD + speed/vision tradeoff + crouch + dash + glide, Rapier kinematic controller, miniplex wiring, minimal dev room editor | Player can move around a blockout room with correct feel |
| **1 — Vertical slice** (~6-10 wks) | 1 School (Fire) × **2 Forms** (Solid+Liquid — minimum to prove the swap actually matters), Flux/Charge FSM, ~10 Universal perks through the hook system, 1 wing (3-4 rooms), 1 full boss (2-phase BT), full hub→expedition→reward→Ichor→unlock→hub loop with working save/load | **Forcing function:** add a throwaway 3rd Form purely via data, zero combat-code changes. If that requires touching the attack executor, the architecture isn't done — fix before moving on |
| **2 — Systemic breadth** (~8-12 wks) | Remaining 2 Forms (Gas/Plasma) against the same Fire flavor data, remaining perk tiers, 2nd boss | Confirms Form/School split holds without refactor |
| **3 — Content scale-out** (~10-16 wks) | Remaining 4 Schools (should be pure data + shader-profile work by now), remaining 4 wings + bosses, Confluence wing (data-tag union, no new generator), full perk roster, all hub rooms | Adding a School requires no new systems code — the real litmus test of Phases 1-2 |
| **4 — Polish/ship** | NG+ loop, balance pass, Tauri packaging, Steam Deck/Proton validation, signing | Playable, shippable build on Win/Mac/Linux |

Flag explicitly: the dev room editor, a perk-balance console, and a boss
attack-timeline visualizer are load-bearing content-authoring tools in this
stack (a traditional engine would give you equivalents for free) —
under-investing in them will bottleneck Phase 2-3 content velocity.

---

## 9. Verification

- **Phase 0:** run `pnpm --filter game dev`, confirm movement/camera/dash/glide
  feel correct in-browser.
- **`packages/sim` (pure logic):** Vitest unit tests — the 20-permutation
  School×Form flavor-resolution test, perk modifier math, save-schema
  migrations, room-graph generation determinism (given a seed).
- **Phase 1 exit:** manual playtest checklist — full run from hub through 1
  wing to the boss and back, verifying Ichor persists across a save/reload,
  and the "3rd Form via data only" forcing function passes.
- **Cross-platform:** validate the Tauri desktop build on Windows and macOS
  each phase; spot-check the web build via the deployed itch.io/Cloudflare
  Pages link on Steam Deck (Desktop Mode, Windows build under Proton) before
  each milestone tag.
