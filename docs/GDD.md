# PITHOS: Embers of Elpis
### Full Game Design Spec — Working Draft

**Genre:** Top-down isometric action-roguelike (Hades II combat feel, Supervive movement feel)
**Pitch:** *You are an alchemist descending into Pandora's jar to rescue the last spirit of Hope from the evils that escaped without her.*

---

## 1. The Myth (World Premise)

Long ago, Pandora unsealed the great *pithos* — the jar mistranslated by history as a "box" — and every evil the gods had bottled away came pouring out into the world: Disease, Toil, Old Age, Envy, Pain. Only one spirit chose to stay behind, hiding in the dark as the lid slammed shut: **Elpis**, the spirit of Hope.

Centuries later, the world above has gone hollow. People move through their lives grey and listless, a condition folk healers call **the Grey Hush** — not despair exactly, just the *absence* of anything to hope for. The jar itself has resurfaced, half-buried, humming faintly with residual power. You are an alchemist drawn to it, and inside, you hear her voice for the first time: faint, tired, and unmistakably alive.

The escaped evils never truly left the jar behind, either — they carved out territories in its depths, and over the centuries the jar's insides have become a labyrinth that reshapes itself, each wing ruled by one of the escaped Spites. Elpis is fractured, her essence scattered into Hope Fragments hoarded by these Spites like trophies. She can't leave. But she can send *you* in, again and again, to take back what's hers.

---

## 2. Story Beats: Main Menu to Ending

**Main Menu.** Cold, ash-toned art direction. A cracked jar sits at the center of a dead, grey courtyard. A single hairline of golden light escapes the crack. A quiet, tired voice-over line plays on loop: *"...someone's there. Please — still be there."* This is Elpis, and this is the first time you hear her.

**Act 1 — The Threshold.** You approach the jar and are pulled inside. You meet Elpis properly: barely more than a flicker of golden light and a voice, anchored to a small sanctuary just inside the jar's rim. She explains what she is, what happened, and asks you to descend. This section doubles as the tutorial — one wing (we'd recommend Earth, as the most grounded/readable kit) is available immediately to teach core movement, Form-shifting, and the perk-pick loop.

**Act 2 — The Five Wings.** Over repeated expeditions, you unlock and clear all five elemental wings, each ruled by a Spite who holds one Hope Fragment. The Spites aren't cartoonish villains — each is a tragic, sympathetic personification just doing what they were freed to do (Ponos, Toil, is exhausted by his own endless labor; Phthonos, Envy, is achingly lonely). Defeating one doesn't destroy them, it *frees* them from the compulsion that's been driving them, and each gives up their Hope Fragment willingly once beaten. As fragments return, Elpis's sanctuary literally brightens and grows, and she becomes more herself — more color, more memory, more personality — over the course of the game.

**Midpoint Revelation.** Once several Fragments are recovered, Elpis realizes something is wrong: she should be whole by now, but something at the very bottom of the jar has been actively holding her fragments apart, feeding on the Grey Hush above. This is **Kenoma** ("the Emptiness") — not one of Hesiod's named evils, but something older, something the jar was *also* built to contain. The Spites, it turns out, aren't hoarding Fragments out of malice — Kenoma has been using them, and each other's isolation, to keep hope permanently divided.

**Act 3 — The Confluence.** With all five Fragments recovered, a sixth, final wing opens: the true bottom of the jar, where all five elements bleed together — this is your existing "mixed-biome" endgame concept, now paid off narratively as **the Confluence**, Kenoma's domain. Enemies and hazards here mix all five Schools freely.

**Ending — Saving Hope.** Defeating Kenoma releases Elpis fully. The epilogue cuts to the world above: color returns to the sky first, then to people's faces, small and unremarkable — someone laughs at a joke, someone plants something they intend to see grow. The jar doesn't disappear; it stays, cracked open, sunlight pouring through permanently. A higher completion ending (all Fragments + optional side content) shows Elpis stepping fully into the world above for the first time; a baseline ending keeps her at the threshold, whole but still tethered — a hook for sequels/DLC rather than a "bad" ending.

**New Game+ — The Second Kindling.** Post-story, Confluence expeditions become the permanent endgame loop, with escalating optional modifiers (à la Hades' Pact of Punishment) for replayability and leaderboard-style runs.

---

## 3. Core Movement (universal, regardless of build)

Top-down isometric, WASD. Every alchemist shares this base kit:

- **Move speed vs. vision range trade-off** — sprinting narrows what you can see; slowing down widens it.
- **Crouch** — further-reduced vision range in exchange for a wider *hearing* range and near-silent footsteps (avoid pulling packs, sneak past patrols).
- **Dash** — short burst of speed + brief hazard-immunity window.
- **Glide** — crosses gaps, chasms, and certain hazards; limited duration, refills on landing.

---

## 4. Character Build: School × Form

You pick a **School** (identity) and dynamically shift between **Forms** (stance) mid-combat. 5 × 4 = 20 distinct combat flavors from one shared system.

### The Five Schools

| School | Wing/Domain | Tool | Passive | Ultimate |
|---|---|---|---|---|
| **Earth** | Ponos's Hollow (Toil) | Living stone gauntlets | **Stoneskin** — damage reduction stacks the longer you hold ground or the more hits you take | **Tectonic Shift** — delayed eruption of stone spikes in a wide radius |
| **Fire** | Loimos's Forge (Plague/Fever) | Flame censer | **Kindling** — stacking DoT that detonates at max stacks | **Prometheus's Gift** — a falling comet leaves a lingering firestorm |
| **Water** | Algea's Deep (Pain) | Ritual flask | **Undertow** — hits apply "Soaked," amplifying your next elemental proc | **Maelstrom** — a whirlpool that pulls enemies in and grinds them down |
| **Air** | Geras's Spire (Old Age) | Twin wind-fans | **Tailwind** — landing a hit grants brief, stacking move/attack speed | **Aeolus's Wrath** — a cyclone that launches and disorients |
| **Aether** | Phthonos's Reach (Envy) | Astrolabe/prism | **Starlight Attunement** — abilities have a chance to echo (fire twice) | **Empyrean Collapse** — a gravity well that pulls, then detonates |

*Aether is a nice two-for-one: it's both the classical 5th alchemical element and an actual Greek primordial god (bright upper sky), so it bridges the alchemy and myth framing without any retconning.*

### The Four Forms

| Form | Primary (attack) | Secondary (attack/ability) | Identity |
|---|---|---|---|
| **Solid** | Heavy melee cleave, short range | Ground-slam knockback | Tanky, high HP/armor, area denial |
| **Liquid** | Flowing arc-strike, mid-range wave | Lingering corrosive/healing pool | Sustain, lifesteal, repositioning |
| **Gas** | Spread shot / DoT cloud | Blink or smoke-cover | Speed, evasion, ranged damage-over-time |
| **Plasma** | Precise bolt/beam, single-target | Chain-overload burst | Glass cannon, high-risk/high-reward |

Each Form is **reskinned by your School** — Fire+Solid throws obsidian plate, Water+Solid throws ice; Earth+Gas is a choking dust cloud, Air+Gas is a true windstorm. Same mechanics, different face.

### The Flux System (Form-shifting)

- Swapping Forms costs **Flux** (regenerates over time / on kill).
- Staying in a Form builds **Charge**.
- Swapping *out* of a charged Form releases an **empowered burst** flavored to the Form you're leaving (high-Charge Solid → shockwave nova; high-Charge Plasma → chain-lightning burst; etc.).
- Camping one Form too long has diminishing returns — the system wants you rotating.
- Biome hazards nudge the odds: a flooded room charges Liquid faster; a volcanic room favors Solid/Plasma.

---

## 5. Loadout & Controls

Every build — no exceptions — has exactly 5 slots:

| Slot | Source |
|---|---|
| **Passive** | School |
| **Primary** (attack) | Form |
| **Secondary** (attack/ability) | Form |
| **Tertiary** (ability) | Reaction (see below) |
| **Ultimate** | School |

- **Ctrl+Q / Ctrl+E / Ctrl+R / Ctrl+Right-click** upgrades the corresponding slot (Passive / Primary / Secondary... you get the idea — exact keybind-to-slot mapping is a UX detail to nail down later).
- Slot levels are capped at **20 total per run**, distributed however you choose.
- The hub Marketplace sells **starting-level boosts** (permanent, Ichor-bought) so a fresh run doesn't always start from zero.

### Tertiary Slot — The Reaction Power Curve

- **Early game:** reacts with hazards already in the room (ignite a gas cloud, flash-freeze a water pool).
- **Mid game:** consumes collected **Reagents** for one-off combo effects.
- **Late game (rare):** a second-School pickup lets you dual-wield for the rest of that run — the run's biggest build-defining spike.

---

## 6. Perks (chosen after clearing a room — pick 1 of 3, Hades-boon style)

### Universal Perks (available to everyone)

| Perk | Effect |
|---|---|
| Second Wind | Survive one killing blow at 1 HP (once per expedition) |
| Momentum | Move speed grants stacking attack speed |
| Vigilant Eye | Increases base vision range; softens the crouch vision penalty |
| Quick Fingers | Reduces Flux cost on Form-swap |
| Overcharge | Charge builds 25% faster |
| Scavenger's Luck | Increased Reagent and Mote drop rate |
| Iron Will | Reduces incoming crowd-control duration |
| Adrenaline | Kills refund a portion of dash cooldown |

### Form Perks

**Solid**
- *Bulwark* — brief shield after standing still for a few seconds
- *Aftershock* — Solid hits leave a damaging crater
- *Unmovable* — immune to knockback while in Solid
- *Landslide* — Solid Charge-release also roots enemies hit

**Liquid**
- *Osmosis* — increased lifesteal while in Liquid
- *Riptide* — Liquid pools pull enemies toward their center
- *Viscosity* — Liquid hits apply increasingly severe slow
- *Reservoir* — bonus max Flux while in Liquid

**Gas**
- *Vapor Trail* — sprinting in Gas leaves a damaging cloud behind you
- *Diffusion* — larger Gas cloud radius
- *Featherweight* — increased dash distance while in Gas
- *Toxic Bloom* — Gas DoT can stack higher

**Plasma**
- *Overload* — Plasma Charge-release chains to 2 extra enemies
- *Volatile Core* — chance for Plasma hits to critically double
- *Unstable Form* — +damage in Plasma, but you take more damage while in it
- *Arc Reactor* — kills in Plasma refund Flux

### School Perks

**Earth**
- *Petrify* — chance on hit to briefly stun
- *Fortify* — raises the cap on Stoneskin's damage-reduction stacks
- *Quake Step* — dash leaves cracks that slow enemies
- *Golem's Heart* — flat max HP increase

**Fire**
- *Ember Cascade* — killing a burning enemy spreads fire to nearby foes
- *Slow Burn* — longer DoT duration
- *Backdraft* — larger Kindling detonations
- *Phoenix Ash* — once per run, death instead leaves a fire nova and you keep going

**Water**
- *Tidecaller* — Soaked enemies take increased damage from all sources
- *Undertow Current* — slows also reduce enemy attack speed
- *Healing Spring* — standing in your own Liquid pool restores HP over time
- *Pressure* — hits on Soaked enemies have a chance to stun

**Air**
- *Downburst* — dash knocks back enemies in your path
- *Static Gust* — Air/Gas clouds also apply a minor shock
- *Updraft* — significantly longer glide duration
- *Zephyr's Focus* — Tailwind's bonus is stronger and lasts longer

**Aether**
- *Echo* — increased chance for abilities to fire twice
- *Starbound* — reduced Ultimate cooldown
- *Fractal Insight* — reveals nearby Reagents/secrets on the minimap
- *Event Horizon* — Aether hits pull enemies slightly before damaging

### Rare / Legendary Perks

| Perk | Effect |
|---|---|
| Twin Casting | Tertiary reactions trigger twice |
| Dual Nature | Unlocks the second-School dual-wield reaction early |
| Hopeful Ember | Killing a Spite's lieutenant grants a small permanent (this-run) stat boost |
| Glass Cannon | +50% damage, −30% max HP |
| Momentum Engine | Move speed also increases Charge build rate |
| Undertow's Favor | Your current Form's empowered burst (on swap) also applies to allies, if co-op exists |

---

## 7. In-Run Upgrades (bought with **Motes** at Rest Shrines — lost at run's end)

These are simple, stackable numeric boosts, separate from Perks:

| Upgrade | Effect |
|---|---|
| HP Up | +Max HP |
| Haste | +Move speed |
| Fleet Step | −Dash cooldown |
| Quickdraw | +Attack speed |
| Volley | +1 projectile count (for projectile-type attacks) |
| Ricochet Rounds | Adds a bounce to your attack — **see contextual rule below** |

**Contextual Rule — one upgrade, four expressions:** every attack has a "delivery type" set by your current Form. Ricochet Rounds reads differently depending on it:

| Delivery type | Form example | Ricochet Rounds becomes... |
|---|---|---|
| Melee | Solid | **Cleave** — hits an extra adjacent enemy |
| Wave | Liquid | **Echo** — a second, smaller wave follows the first |
| Projectile | Gas | **Ricochet** — bounces to a new nearby target, with damage falloff |
| Beam/Bolt | Plasma | **Pierce** — passes through every enemy in a line |

This mirrors the School × Form flavor system: one upgrade, reinterpreted consistently by whatever you're currently playing.

---

## 8. The Hub — Elpis's Threshold

| Room | Purpose |
|---|---|
| **Elpis's Sanctuary** | Narrative anchor, save point, dialogue with Elpis as she slowly becomes more herself |
| **The Threshold Gate** | Choose which wing (or, later, the Confluence) to descend into |
| **The Reliquary** | Shop — spend **Ichor** on permanent unlocks: new Schools, Form upgrades, Reagent recipes, starting-level boosts |
| **Hephaestus's Anvil** | **Practice Range** — enchanted training dummies with adjustable HP/armor; freely test any unlocked School/Form/perk loadout, zero stakes, respawns instantly |
| **The Danaids' Cistern** | **Endless farming room** — named for the Danaids' punishment of forever hauling water in leaking jars; an easier, endless wave arena for grinding Motes/Ichor, difficulty creeps the longer you stay, leave anytime with no penalty |
| **The Reagent Garden** | Passively grows/collects Reagents between runs |
| **School Shrines** | Five shrines, one per School, where new Schools are permanently unlocked with Ichor |

---

## 9. Run Structure

Hub-and-expedition. From the Threshold Gate, choose a wing (biome = School). Each wing has several escalating floors, ending in that wing's Spite. Once all five Fragments are recovered, **the Confluence** unlocks — mixed-biome, harder end-game content, later repurposed as the permanent New Game+ loop.

---

## 10. Enemy Roster (grouped by biome)

- **Homunculi & constructs** — failed alchemical creations; appear as "lab" variants across every wing
- **Undead / cursed dead** — concentrated in Geras's Spire (Old Age) and Loimos's Forge (Plague)
- **Rival alchemists** — human enemies running their own School/Form kits; strong mid-tier variety
- **Elemental wildlife** — biome-native creatures (stone golems in Earth, magma worms in Fire, drowned wraiths in Water, wind wisps in Air, void-touched horrors in the Confluence)

## 11. Bosses — The Spites

| Spite | Domain | Guards |
|---|---|---|
| Ponos (Toil) | Earth | Hope Fragment I |
| Loimos (Plague) | Fire | Hope Fragment II |
| Algea (Pain) | Water | Hope Fragment III |
| Geras (Old Age) | Air | Hope Fragment IV |
| Phthonos (Envy) | Aether | Hope Fragment V |
| **Kenoma (the Emptiness)** | The Confluence | Final boss — the true source of the Grey Hush |

---

## 12. Meta-Progression

Single currency, **Ichor**, earned per expedition and spent at the Reliquary and School Shrines for permanent unlocks (new Schools, Form upgrades, Reagent recipes) and capped QoL perks. Deliberately kept small/capped rather than a full power-creep curve, so runs stay meaningfully challenging even late into the game.

---

## 13. Tone & Art Direction (brief — for the visual pass)

Grey, ash-toned world above; the jar's interior blooms with saturated, stained-glass color per School (molten ochres for Fire, deep teals for Water, etc.). Spites should read as tragic rather than monstrous — beautiful-but-worn character design over grotesque. Elpis visually brightens and gains detail/color as Fragments return, giving a constant visual through-line for progress.

---

*This is a working draft — names, numbers, and exact keybinds are all placeholders meant to be tuned once we move into visuals and prototyping.*
