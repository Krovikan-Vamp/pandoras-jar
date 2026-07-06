# Asset Sources & Licenses

This file is the legal record for every 3D model file under `assets/models/`.
For each file: exact source URL, verbatim license, and whether attribution is
required. Do not paraphrase or loosen any of the license text below.

All files were downloaded 2026-07-06. Where a repo is referenced at a specific
commit, that commit is pinned below so the exact source content can be
re-verified even if the upstream `main` branch later changes.

---

## assets/models/characters/humanoid_base.glb

- **What it is**: A plain, two-material ("Mannequin") rigged humanoid figure
  with 46 named animations (`Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`,
  `Sprint_Loop`, `Sword_Attack`, `Punch_Jab`/`Punch_Cross`, `Spell_Simple_*`,
  `Death01`, `Roll`, `Sitting_*`, etc). Two flat PBR materials, no textures/UV
  bakes (`M_Main` = solid color body, `M_Joints` = solid color joints) — chosen
  specifically because it recolors cleanly via `material.color` at runtime.
- **Original asset**: Quaternius's "Universal Animation Library" (free/standard
  edition), as distributed on itch.io: https://quaternius.itch.io/universal-animation-library
- **Original author**: Tomás Laulhé / Quaternius (https://quaternius.com,
  https://www.patreon.com/quaternius)
- **Downloaded via (GitHub mirror)**: https://github.com/J-Ponzo/gltf-universal-animation-library
  (commit `e24c23cf2a1323488a3faa226ea7ea21f644b73e`), file
  `glTF/AnimationLibrary_Godot_Standard.gltf` + `.bin`. The mirror maintainer
  (J-Ponzo) explicitly states they are not the asset's author and republishes
  it "with gltf files only to keep the repository as small as possible."
- **License**: **CC0 1.0 Universal** (Creative Commons Public Domain
  Dedication), per the mirror repo's `LICENSE` file (full CC0 1.0 legal code)
  and its README: "This pack is licensed under CC0 1.0."
- **Attribution required?**: No (CC0). Stated here for the record only.
- **Modification made by us**: The source shipped as separate `.gltf` (JSON)
  + `.bin` (binary buffer) files, no `.glb`. We losslessly repackaged these
  into a single self-contained `.glb` using `@gltf-transform/cli` (`copy`
  command — a container repackaging, not a geometry/format conversion). No
  mesh, material, or animation data was altered. Verified post-conversion with
  `gltf-transform inspect`: glTF 2.0, 1 mesh, 2 materials, 46 animations,
  bounding box ~1.83m tall, all intact.

## assets/models/creatures/fox_creature.glb

- **What it is**: Low-poly textured fox with 3 animations: `Survey`, `Walk`,
  `Run`. Candidate for "elemental wildlife" creature slot.
- **Source**: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
  (commit `2bac6f8c57bf471df0d2a1e8a8ec023c7801dddf`), file
  `Models/Fox/glTF-Binary/Fox.glb`
- **License** (per the model's own `LICENSE.md`, mixed/layered — all
  conditions apply together):
  - **CC0 1.0 Universal** — model geometry, © 2014, PixelMannen.
  - **CC BY 4.0 International** — rigging & animation, © 2014, tomkranis.
  - **CC BY 4.0 International** — glTF conversion, © 2017, @AsoboStudio and
    @scurest.
- **Attribution required?**: **Yes**, for the CC-BY-covered portions (rigging/
  animation and glTF conversion). Suggested credit line: "Fox model by
  PixelMannen (CC0), rigging/animation by tomkranis (CC BY 4.0), glTF
  conversion by AsoboStudio and scurest (CC BY 4.0)."

## assets/models/creatures/robot_construct.glb

- **What it is**: Small robot/mech character with a large animation set
  (`Idle`, `Walking`/`Running`, `Jump`, `Punch`, `Death`, `Dance`, `Yes`, `No`,
  `Wave`, `ThumbsUp`, `Sitting`, etc). Candidate for the "homunculus/construct"
  creature slot — mechanical, slightly unnatural silhouette.
- **Source**: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
  (commit `51d0454a351413e85c0697a5d15a7fc3461dc92a`), file
  `examples/models/gltf/RobotExpressive/RobotExpressive.glb`. Bundled directly
  in the three.js repository as an example asset (three.js's own code license,
  MIT, does not apply to this model — see the model's own README below).
- **License**, per `examples/models/gltf/RobotExpressive/README.md`: "Model by
  Tomás Laulhé (https://www.patreon.com/quaternius) ... CC0 1.0." with
  "Modifications by Don McCurdy (https://donmccurdy.com/): Added three facial
  expression morph targets; Converted with FBX2GLTF; Removed duplicate
  materials and reduced material metalness."
- **License summary**: **CC0 1.0 Universal**.
- **Attribution required?**: No (CC0). Original creator Tomás Laulhé / Quaternius
  noted here for the record; modifications by Don McCurdy also noted.

## assets/models/creatures/large_humanoid_figure.glb

- **What it is**: A plain, untextured grey rigged humanoid ("Rigged Figure"),
  single unnamed animation, 22-node skeleton. **Caveat (see report): this is
  a generic humanoid rig, not a unique monster/creature silhouette.** It is
  included as a scale-up/reskin stand-in for a "tragic, imposing, larger-scale"
  boss slot, since no suitably-licensed distinct monster model of that kind
  was found via reachable sources (see gaps below). Treat as a placeholder to
  be swapped for a real boss silhouette later.
- **Source**: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedFigure
  (commit `2bac6f8c57bf471df0d2a1e8a8ec023c7801dddf`), file
  `Models/RiggedFigure/glTF-Binary/RiggedFigure.glb`
- **License**, per the model's own `LICENSE.md`: **CC BY 4.0 International**,
  © 2017, Cesium ("Cesium for Everything").
- **Attribution required?**: **Yes**. Suggested credit line: "Rigged Figure
  model by Cesium (CC BY 4.0)."

## assets/models/props/rock.glb

- **Source model**: `rock_02` from thebasemesh.com, converted to glTF binary.
- **Source**: https://github.com/M3-org/base-meshes/tree/main/models/rock_02
  (commit `2b944200d24c8a7caf698257a3047619d3ab9268`), file
  `models/rock_02/rock_02.glb`
- **License**: **CC0 1.0 Universal** — repo `LICENSE` file is the full CC0 1.0
  legal code; the original thebasemesh.com asset also ships its own notice
  ("This asset is under CC0 license") reproduced in `models/TheBaseMesh.txt`
  in the source repo.
- **Attribution required?**: No (CC0).

## assets/models/props/crystal.glb

- **Source model**: `crystal` from thebasemesh.com.
- **Source**: https://github.com/M3-org/base-meshes/tree/main/models/crystal
  (commit `2b944200d24c8a7caf698257a3047619d3ab9268`), file
  `models/crystal/crystal.glb`
- **License**: **CC0 1.0 Universal** (same repo/source basis as `rock.glb` above).
- **Attribution required?**: No (CC0).

## assets/models/props/brazier.glb

- **Source model**: `iron_brazier_01` from thebasemesh.com.
- **Source**: https://github.com/M3-org/base-meshes/tree/main/models/iron_brazier_01
  (commit `2b944200d24c8a7caf698257a3047619d3ab9268`), file
  `models/iron_brazier_01/iron_brazier_01.glb`
- **License**: **CC0 1.0 Universal** (same repo/source basis as `rock.glb` above).
- **Attribution required?**: No (CC0).

## assets/models/props/pillar.glb

- **Source model**: `spiral_pillar` from thebasemesh.com.
- **Source**: https://github.com/M3-org/base-meshes/tree/main/models/spiral_pillar
  (commit `2b944200d24c8a7caf698257a3047619d3ab9268`), file
  `models/spiral_pillar/spiral_pillar.glb`
- **License**: **CC0 1.0 Universal** (same repo/source basis as `rock.glb` above).
- **Attribution required?**: No (CC0).

## assets/models/props/obelisk.glb

- **Source model**: `obelisk_01` from thebasemesh.com.
- **Source**: https://github.com/M3-org/base-meshes/tree/main/models/obelisk_01
  (commit `2b944200d24c8a7caf698257a3047619d3ab9268`), file
  `models/obelisk_01/obelisk_01.glb`
- **License**: **CC0 1.0 Universal** (same repo/source basis as `rock.glb` above).
- **Attribution required?**: No (CC0).

---

## Sources that did not pan out (reported, not fabricated)

- **kenney.nl, quaternius.com, itch.io, sketchfab.com, poly.pizza,
  opengameart.org, cdn.jsdelivr.net, unpkg.com, huggingface.co** — all
  blocked by this environment's egress proxy policy (`CONNECT tunnel failed,
  response 403` — an organizational policy denial, not a target-site error).
  Per the environment's own guidance these are policy denials to report, not
  retry/route around. `github.com`, `raw.githubusercontent.com`,
  `codeload.github.com`, and `registry.npmjs.org` were reachable and used
  instead.
- **WebFetch tool** — returned "unable to verify if domain is safe" for
  nearly every external domain tried (including `docs.anthropic.com`), and an
  actual HTTP 403 for `kenney.nl` specifically (Kenney's own bot protection).
  Not usable for this task regardless of the egress policy above, and
  wouldn't have helped download binaries even if it worked (it fetches/
  summarizes text, not files).
- **Mixamo-sourced three.js example models** (`Soldier.glb`, `Xbot.glb`,
  `Xbot.blend`) — confirmed via the three.js example page
  (`webgl_animation_skinning_blending.html` / `webgl_animation_multiple.html`)
  to be sourced from mixamo.com. Skipped: Adobe's Mixamo content terms are a
  proprietary EULA, not CC0/CC-BY, and are ambiguous about redistributing the
  raw model file standalone (as opposed to embedding it in a shipped game) —
  didn't meet the "precise, not loosened" licensing bar.
  `Michelle.glb`/`readyplayer.me.glb` were skipped for the same
  undocumented-license reason.
- **`Flamingo.glb` / `Parrot.glb` / `Stork.glb` / `Horse.glb`** (bundled in
  three.js) — attributed only to "Flamingo by mirada from rome" in the example
  page (`webgl_gpgpu_birds_gltf.html`), a 2011 Chrome Experiment; no explicit
  license grant found. Skipped as license-ambiguous.
- **`BrainStem.glb`** (Khronos glTF-Sample-Assets) — a plausible
  "construct/robot" creature, but its `LICENSE.md` cites a **Poser EULA**
  (Smith Micro Software / Content Paradise), a commercial-software license,
  not CC0/CC-BY. Skipped as too restrictive/ambiguous for redistribution.
- **`DragonAttenuation.glb` / `DragonDispersion.glb`** (Khronos
  glTF-Sample-Assets) — the classic Stanford dragon scan; `LICENSE.md` cites
  the **Stanford Graphics Library** license (its own bespoke terms, not
  CC0/CC-BY), plus the material is a realistic glass/PBR showcase, not the
  stylized low-poly look. Skipped on both license and art-direction grounds.
- **`CesiumMan.glb`** (Khronos glTF-Sample-Assets) — license is "CC BY 4.0
  International **with Trademark Limitations**" (a non-standard CC-BY
  variant with an embedded Cesium logo/trademark carve-out), and the model
  has a baked photoreal-looking suit/skin texture that conflicts with the
  "plain material, not photoreal" requirement for the humanoid base. Skipped.
- **`KhronosGroup/glTF-Sample-Models` legacy repo, `1.0/Monster`** — found via
  search as a plausible "monster" asset, but it is a **glTF 1.0** asset (not
  2.0); modern three.js `GLTFLoader` (three@0.185.1) does not support glTF
  1.0 and would fail to parse it. Its README also just says "Model from:
  http://www.3drt.com/downloads.htm" with no explicit license text. Skipped
  on both format and license grounds.
- **`M3-org/retro3d-assets`** (PSX-style low-poly pack, includes a
  `Characters/Creature` folder) and **`PolygonalMind/initiative-opensource-release`**
  (CC0-licensed Decentraland asset packs, including Egyptian-god-statue models
  in a "TombChaser" pack that would have made excellent tragic/imposing boss
  candidates) — both are real, CC0-licensed, GitHub-reachable repos, but every
  model in both ships only as **FBX / OBJ / Blend / Unity-VRM**, no glTF/GLB
  variant anywhere in either repo. Per instructions, not converted ourselves;
  flagged here as a "needs conversion" gap rather than a missing source. If
  FBX→glTF conversion becomes acceptable later, these are good places to
  revisit for a true distinct boss silhouette (esp. the TombChaser god statues).
- **Net result on the "1-2 tragic/imposing boss (larger scale)" creature
  slot**: not filled with a genuine distinct monster silhouette under a
  clearly CC0/CC-BY license from a reachable source. `large_humanoid_figure.glb`
  (CC BY 4.0, Cesium) is included as an honest stand-in (a second, visually
  distinct humanoid rig that can be scaled up and reskinned), not a
  substitute for real boss geometry.
