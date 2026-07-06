/**
 * Initial, real (not placeholder) content for the admin panel to operate on:
 * one voice profile per character, a first pass of story-critical dialogue
 * lines adapted from docs/GDD.md §2, and SFX cues covering the interactions
 * already implemented in apps/game (movement, Form-swapping, UI, ambience).
 */

import type { SfxCue, VoiceCharacterProfile, VoiceLineCue } from "./types.js";

export const VOICE_CHARACTER_PROFILES: VoiceCharacterProfile[] = [
  {
    id: "elpis",
    displayName: "Elpis, the Spirit of Hope",
    voiceDescription:
      "A voice barely more than a flicker — faint, tired, and unmistakably alive, like someone speaking after a very long silence in the dark. Young-adult feminine timbre, hushed and slightly hoarse, wary but quietly warm underneath, never melodramatic.",
  },
  {
    id: "ponos",
    displayName: "Ponos, Spite of Toil",
    voiceDescription:
      "Ponos, Toil personified — a rough, deep, breathless masculine voice, permanently exhausted like someone who has carried something heavy for centuries and long since stopped noticing the weight. Tired but never cruel.",
  },
  {
    id: "loimos",
    displayName: "Loimos, Spite of Plague",
    voiceDescription:
      "Loimos, Plague and Fever personified — a congested, feverish, rasping voice with an unsteady quaver, as though every sentence costs real effort through a permanent sickness. Apologetic and sympathetic rather than menacing.",
  },
  {
    id: "algea",
    displayName: "Algea, Spite of Pain",
    voiceDescription:
      "Algea, Pain personified — a strained, aching feminine voice that catches and tightens mid-sentence like it's biting back a wince. Quiet and brittle, worn down rather than aggressive.",
  },
  {
    id: "geras",
    displayName: "Geras, Spite of Old Age",
    voiceDescription:
      "Geras, Old Age personified — an elderly, unhurried masculine voice, papery and slow, speaking with the calm patience of someone who stopped being afraid of endings long ago. Weary but gentle.",
  },
  {
    id: "phthonos",
    displayName: "Phthonos, Spite of Envy",
    voiceDescription:
      "Phthonos, Envy personified — a thin, wistful voice hovering between bitterness and longing, quiet and a little too eager the moment someone actually pays attention, betraying a deep loneliness under its guarded surface.",
  },
  {
    id: "kenoma",
    displayName: "Kenoma, the Emptiness",
    voiceDescription:
      "Kenoma, the Emptiness — a hollow, echoing, ancient voice that sounds like it is speaking from the bottom of a very deep well: layered, reverberant, and utterly without warmth. Patient rather than furious, older than the other Spites.",
  },
  {
    id: "narrator",
    displayName: "Narrator",
    voiceDescription:
      "A calm, literary, unhurried narrator voice for non-character narration — the measured tone of someone reading a myth aloud, warm but not theatrical, clear but not clinical.",
  },
];

export const SEED_VOICE_LINES: VoiceLineCue[] = [
  {
    id: "narrator_myth_prologue",
    characterId: "narrator",
    text: "Long ago, Pandora unsealed the great pithos — the jar mistranslated by history as a box — and every evil the gods had bottled away came pouring out into the world: Disease, Toil, Old Age, Envy, Pain. Only one spirit chose to stay behind, hiding in the dark as the lid slammed shut: Elpis, the spirit of Hope.",
    context: "Opening cinematic / prologue narration, adapted directly from the myth premise in GDD.md §1.",
  },
  {
    id: "elpis_main_menu_intro",
    characterId: "elpis",
    text: "...someone's there. Please — still be there.",
    context: "Main Menu looping VO over the cracked jar; the player's first time hearing Elpis.",
  },
  {
    id: "elpis_threshold_intro",
    characterId: "elpis",
    text: "I'm Elpis. I know — I don't look like much. I've been here so long I'd almost forgotten what more would feel like. There are pieces of me scattered through this place, and I can't go get them myself. Will you?",
    context: "Act 1 - The Threshold: Elpis's first proper conversation with the player after being pulled inside the jar.",
  },
  {
    id: "elpis_midpoint_revelation",
    characterId: "elpis",
    text: "Something's wrong. I should be whole by now — I can feel more of myself than I could before, but something is still holding the rest of me apart. Something at the very bottom of this jar. Older than the Spites. It's been feeding on the Grey Hush this whole time.",
    context: "Midpoint Revelation, after several Hope Fragments have been recovered; first hint of Kenoma.",
  },
  {
    id: "ponos_release",
    characterId: "ponos",
    text: "...finally. I don't have to carry it anymore, do I? Just tell me I don't have to carry it anymore.",
    context: "Ponos's Hollow (Earth wing) — Ponos's defeat/release moment, giving up Hope Fragment I.",
  },
  {
    id: "loimos_release",
    characterId: "loimos",
    text: "The fever breaks... at last. I never wanted to hurt anyone, I swear it. I just couldn't stop burning.",
    context: "Loimos's Forge (Fire wing) — Loimos's defeat/release moment, giving up Hope Fragment II.",
  },
  {
    id: "algea_release",
    characterId: "algea",
    text: "It stops. It actually stops. I'd almost forgotten what that felt like.",
    context: "Algea's Deep (Water wing) — Algea's defeat/release moment, giving up Hope Fragment III.",
  },
  {
    id: "geras_release",
    characterId: "geras",
    text: "Take it, then. I've held this fragment so long I hardly remember why I was told to. Go gently, alchemist — one day, you'll understand the waiting.",
    context: "Geras's Spire (Air wing) — Geras's defeat/release moment, giving up Hope Fragment IV.",
  },
  {
    id: "phthonos_release",
    characterId: "phthonos",
    text: "You could have wanted anything, and you still came back for me. I didn't think anyone would.",
    context: "Phthonos's Reach (Aether wing) — Phthonos's defeat/release moment, giving up Hope Fragment V.",
  },
  {
    id: "kenoma_defeat",
    characterId: "kenoma",
    text: "You cannot fill what I have emptied... and yet, here you stand. Still full of it. Hope.",
    context: "The Confluence — Kenoma's final defeat, releasing Elpis fully.",
  },
  {
    id: "elpis_ending_baseline",
    characterId: "elpis",
    text: "Go on up, if you want to. Tell me what it looks like — the sky, when it isn't grey. I'll be right here.",
    context: "Baseline ending: Elpis is whole but stays tethered at the threshold, a hook for future content.",
  },
  {
    id: "elpis_ending_full",
    characterId: "elpis",
    text: "I remember warmth. I think... I think I remember it now. Walk with me?",
    context: "Higher-completion ending: Elpis steps fully into the world above for the first time.",
  },
];

export const SEED_SFX_CUES: SfxCue[] = [
  {
    id: "dash_woosh",
    category: "movement",
    description: "A sharp, airy whoosh of a fast dash through still air, with a quick doppler-like pitch drop at the tail, ~0.3 seconds.",
    durationSecondsHint: 0.3,
  },
  {
    id: "glide_whoosh",
    category: "movement",
    description: "A sustained, gliding gust of wind rushing past, airy and continuous, evoking crossing an open gap or chasm, ~1.5 seconds.",
    durationSecondsHint: 1.5,
  },
  {
    id: "footstep_crouch",
    category: "movement",
    description: "A single soft, muffled footstep on stone from a crouched, sneaking movement — low volume, minimal high-frequency content, near-silent.",
    durationSecondsHint: 0.4,
  },
  {
    id: "hit_impact_generic",
    category: "combat",
    description: "A punchy, physical melee impact — a short thud layered with a crisp crack — generic enough to reuse across every School and Form.",
    durationSecondsHint: 0.3,
  },
  {
    id: "form_swap_solid",
    category: "combat",
    description: "A heavy, grinding stone-on-stone shift, like plates of rock locking into place, communicating a tanky, armored Form change, ~0.5 seconds.",
    durationSecondsHint: 0.5,
  },
  {
    id: "form_swap_liquid",
    category: "combat",
    description: "A smooth, flowing splash-and-swirl transition, like water reshaping around a vessel, watery and continuous, ~0.5 seconds.",
    durationSecondsHint: 0.5,
  },
  {
    id: "form_swap_gas",
    category: "combat",
    description: "A light, dissipating hiss of vapor spreading outward, airy and quick, like a cloud expanding and thinning, ~0.4 seconds.",
    durationSecondsHint: 0.4,
  },
  {
    id: "form_swap_plasma",
    category: "combat",
    description: "A crackling, high-energy electrical surge with a bright zap, communicating a glass-cannon, high-risk Form change, ~0.4 seconds.",
    durationSecondsHint: 0.4,
  },
  {
    id: "charge_release_burst",
    category: "combat",
    description: "A tense buildup release — a rising charge that snaps into a sharp, powerful burst — for releasing an empowered Form-swap attack, ~0.8 seconds.",
    durationSecondsHint: 0.8,
  },
  {
    id: "ui_perk_pick_select",
    category: "ui",
    description: "A short, satisfying confirmatory chime for selecting one of three perk options after clearing a room — bright, single-note, ~0.2 seconds.",
    durationSecondsHint: 0.2,
  },
  {
    id: "ui_menu_confirm",
    category: "ui",
    description: "A clean, minimal UI confirmation blip for menu navigation and confirming choices — short and unobtrusive, ~0.15 seconds.",
    durationSecondsHint: 0.15,
  },
  {
    id: "ui_room_clear_chime",
    category: "ui",
    description: "A triumphant, resolving chime marking a combat room being fully cleared — a short ascending musical flourish, ~1 second.",
    durationSecondsHint: 1,
  },
  {
    id: "hub_ambient_drone",
    category: "ambient",
    description: "A low, sustained, looping ambient drone for Elpis's Threshold hub — a warm, faintly golden hum with soft resonant harmonics, continuous and non-intrusive, seamlessly loopable.",
    durationSecondsHint: 12,
  },
  {
    id: "boss_telegraph_warning",
    category: "boss",
    description: "A tense, rising warning stinger telegraphing an incoming Spite boss attack — a sharp rising tone with a slightly distorted edge, cueing the player to react, ~1 second.",
    durationSecondsHint: 1,
  },
];
