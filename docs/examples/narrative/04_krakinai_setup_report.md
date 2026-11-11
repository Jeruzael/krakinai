# KRAKINAI Scene Setup & Storyboard Import Report (Phase 4)

**Project:** Wool and Fang: The Snare in the Timberline  
**Episode / Sequence:** Episode 1: The Snare in the Timberline  
**Proposal ID:** `129a62f1-07c2-43d1-8fbf-2151fc18da11`  
**Change-Set ID:** `cs-wool-and-fang-phase4-staging-v1`  
**Package Digest:** `d1f8bd55aa93ea30cdede09b593d53bd2af0a1dfe159e3b62d6b75a81787bae6`  
**Contract Schema:** `krakinai.change-set.v6` (Keyframe Plans & Canonical Image Frames enabled)  
**Status:** `review_required` (Awaiting Human Approval in KrakinAI UI)  

---

## 1. Executive Summary & Staging Metrics

All 30 shots and supporting assets from Phase 3 (`03_director_storyboard.md` and `03_storyboard_prompts.json`) have been deterministically staged into the KRAKINAI production library using authenticated MCP batch operations.

- **Total Operations Staged:** 86
- **Project Containers Created:** 1 (`proj-wool-and-fang`)
- **Asset Candidates Proposed:** 25
  - Characters (Base Physiology): 6
  - Wardrobe States: 5
  - Environments: 2
  - Visual Style: 1
  - Kinematic Action Presets: 7
  - Atmospheric Lighting Presets: 4
- **Shots Created:** 30 (`SHOT_01A` through `SHOT_10D`)
- **Scene Recipes Configured:** 30 (`scene-shot-01a` through `scene-shot-10d`)
- **Total Storyboard Runtime:** 195 seconds (Average: 6.5s per shot, 100% compliant with the 5–10s Google Flow Omni window)
- **3-Plane Crowd Permanence:** 100% of shots (`FG` / `MG` / `BG` verified in `sceneInstructions`)
- **4-Slot Modular Coverage:** 100% (`environment`, `action`, `lighting`, `style` bound on all 30 scenes)
- **Hard Gate Blockers (`SLOT_REQUIRED_MISSING`):** 0
- **Duplicate Asset Conflicts (`DUPLICATE_ASSET`):** 0
- **Assembly Compilation Status (`krakinai_preview_scene_assembly`):** Passed with `valid: true` across all tested scenes.

---

## 2. Asset Candidate Manifest & Wardrobe State Matrix

In strict adherence to Iron Law #2, immutable physiological traits are decoupled from beat-specific garments, armor, and wound states:

| Asset Ref | Kind | Title / State | Role & story placement | Prompt Text Summary |
| :--- | :--- | :--- | :--- | :--- |
| `char-kael` | Character | Kael Silver-Furred Raider | Lead protagonist (all 30 shots) | Lean, agile humanoid silver wolf in 20s, amber eyes, grey muzzle scar, famine-hollowed frame. |
| `char-elowen` | Character | Elowen Meadowbrook Healer | Lead deuteragonist (Shots 02C, 07A–10D) | Gentle humanoid sheep healer in 20s, cream fleece, spiral horn nubs, luminous hazel-amber eyes. |
| `char-vane` | Character | Vane Jagged-Ear Alpha | Pack leader (Shots 01A–05A) | Massive battle-scarred alpha wolf in 40s, notched left ear, predatory yellow eyes, coarse dark fur. |
| `char-garrick` | Character | Garrick Vanguard Captain | Vanguard captain (Shots 03A–05A, 08A, 10D) | Towering humanoid English Mastiff Captain, cropped ears, wrinkled jowls, dark brindle coat. |
| `char-brutus` | Character | Brutus Enforcer Hound | Vanguard enforcer (Shots 03A–04C) | Hulking humanoid Mastiff enforcer, fawn coat, blunt snout, massive muscular shoulders. |
| `char-rex` | Character | Rex Scout Hound | Vanguard scout (Shots 03A–04C) | Heavily muscled humanoid Mastiff enforcer, fawn coat, dark muzzle, relentless combat build. |
| `ward-kael-brigandine` | Wardrobe | Kael Leather Brigandine | Kael's raider gear (Shots 01A–10D) | Scarred boiled leather brigandine, iron rivets, hide trousers, frayed leather wrist wraps. |
| `ward-elowen-healer` | Wardrobe | Elowen Healer Garb | Elowen's healer attire (Shots 02C, 07A–10D) | Ecru linen apron over moss-green wool dress, stitched leather herb satchel, sickle loop. |
| `ward-vane-alpha` | Wardrobe | Vane Boiled-Leather Harness | Vane's battle harness (Shots 01A–05A) | Studded boiled-leather harness, forged iron gorget, predator fang talismans. |
| `ward-garrick-vanguard`| Wardrobe | Garrick Spiked Iron Armor | Vanguard plate (Shots 03A–05A, 08A, 10D) | Spiked forged iron collar, articulated blackened steel gauntlets, chainmail hauberk. |
| `ward-mastiff-enforcer`| Wardrobe | Mastiff Enforcer Armor | Vanguard hound armor (Shots 03A–04C) | Heavy spiked iron collar, steel forearm bracers, reinforced leather combat harness. |
| `env-meadowbrook-valley`| Environment| Meadowbrook Village Outskirts | Beats 1–4 (Shots 01A–04C) | Pastoral foothills, cobblestone square, half-timbered cottages, orchards, watchtower. |
| `env-whispering-pines` | Environment| Whispering Pine Woods | Beats 5–10 (Shots 05A–10D) | Dense pine woods, mossy hemlocks, bracken ferns, ancient oak with hidden tension snare. |
| `style-fantasy-cinematic`| Style | Grounded Cinematic Fantasy (35mm)| Master visual style across all 30 shots | 35mm anamorphic aesthetic, Alexa Mini LF grain, 2.39:1 aspect, desaturated dawn blues. |
| `act-ridge-stalk` | Action | Silent Ridge Stalking | Shots 01A, 01B, 01C | Crouched low in thorny brush, coiled shoulder blades, amber eyes tracking valley below. |
| `act-village-charge` | Action | Village Wall Vault & Charge | Shots 02A, 02B, 02C | Leaping low stone boundary wall, sprinting with bared fangs, terrorizing livestock. |
| `act-mastiff-impact` | Action | Mastiff Vanguard Impact & Rout | Shots 03A, 03B, 03C, 04A, 04B, 04C, 08A | Heavy shield slam, iron-clad gauntlet blow, shattering market carts, pack rout. |
| `act-snare-whip` | Action | Hidden Snare Tension Spring | Shots 05A, 05B, 05C, 06A | Noose snaps around ankle, mid-air vertical inversion, violent crash into oak roots. |
| `act-cornered-predator`| Action | Cornered Defensive Threat | Shots 06B, 07C, 10A, 10C | Wounded predator crouching against oak, baring fangs, defiant feral pride. |
| `act-healer-mercy` | Action | Healer Sickle Severing Stroke | Shots 07A, 07B, 08B, 08C, 09A, 09B, 09C, 10B | Dropping into moss, trembling hands sawing taut rope with curved iron sickle. |
| `act-shadow-leap` | Action | Acrobatic Vanishing Leap | Shot 10D | Powerful acrobatic leap over mossy log into deep forest fog, vanishing into mist. |
| `light-dawn-timberline`| Lighting | Cool Timberline Overcast Dawn | Shots 01A, 01B, 01C | Cool 5600K diffused morning sky, heavy volumetric mist, pale silver rim on fur. |
| `light-village-raid` | Lighting | Early Morning Cobblestone Sun | Shots 02A, 02B, 02C, 03A, 03B, 03C, 04A, 04B, 04C | Sharp 4000K morning sun shafts between roofs, deep alley shadows, dust motes. |
| `light-deep-pine-fog` | Lighting | Deep Pine Canopy Fog Shadows | Shots 05A, 05B, 05C, 06A, 06B, 08A, 10D | Low-key 4500K canopy ambient, soft white sun shafts through pines, emerald moss bounce. |
| `light-snare-clearing`| Lighting | Ethereal Chiaroscuro Beam | Shots 07A, 07B, 07C, 08B, 08C, 09A, 09B, 09C, 10A, 10B, 10C | 4200K warm directional sunbeam on fleece vs. 6500K cool forest fill on silver wolf fur. |

---

## 3. Shot-by-Shot Recipe Staging Matrix (All 30 Shots)

Every shot features 3-plane crowd permanence (`FG` / `MG` / `BG`), v6 Start/End Keyframe Plans, Performance Studio vocal parameters, and strict Google Flow Omni word count constraints:

| Shot Code | Scene Title | Dur. | Lens & Movement | Primary Cast & Presence | Dialogue Line (Verbatim Tagalog/Taglish) | Words | Start/End Keyframes Staged |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SHOT_01A` | Timberline Dawn Overview | 6s | 24mm Crane EWS | Vane, Kael (on_camera) | *None (Atmospheric Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_01B` | Vane Whispers Ambush Order | 7s | 50mm OTS MCU | Vane, Kael (on_camera) | Vane: *"Walang bantay sa silangang bakod..."* | 18 | `frame-start` / `frame-end` |
| `SHOT_01C` | Kael Claws Damp Dirt | 6s | 85mm Macro ECU | Kael (on_camera) | *None (Famine Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_02A` | Vane's Howl Signals Attack | 6s | 35mm Low-Angle MLS | Vane, Pack (on_camera) | *None (Howl Audio)* | 0 | `frame-start` / `frame-end` |
| `SHOT_02B` | Wolf Raiders Vault Wall | 7s | 28mm Tracking WS | Wolves, Sheep (on_camera) | *None (Panic Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_02C` | Elowen Rescues Lamb in Alley | 7s | 50mm Tracking MS | Elowen, Kael (on_camera) | *None (Stampede Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_03A` | Barracks Gates Crash Open | 6s | 24mm Low Dutch EWS | Dogs, Villagers (on_camera) | *None (Gate Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_03B` | Garrick's Challenge | 7s | 40mm Low-Angle MCU | Garrick, Dogs (on_camera) | Garrick: *"Akala n'yo ba puro tupa lang..."* | 13 | `frame-start` / `frame-end` |
| `SHOT_03C` | Vane Freezes in Disbelief | 6s | 65mm Push-In MCU | Vane (on_camera) | Vane: *"Mga Aso?! Paanong nagkaroon..."* | 7 | `frame-start` / `frame-end` |
| `SHOT_04A` | Mastiffs Smash Market Carts | 7s | 35mm Handheld WS | Brutus, Rex, Wolves | *None (Combat Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_04B` | Garrick Strikes Kael Down | 6s | 50mm High-Speed MS | Garrick, Kael (on_camera) | *None (Impact Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_04C` | Vane Calls Pack Retreat | 7s | 35mm Tracking MCU | Vane, Wolves (on_camera) | Vane: *"Umatras na tayo! Masyado silang malakas! Takbo!"* | 8 | `frame-start` / `frame-end` |
| `SHOT_05A` | Wolves Bolt into Pine Woods | 6s | 35mm Tracking MLS | Kael, Pack (on_camera) | *None (Retreat Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_05B` | Snare Springs on Kael | 7s | 35mm Profile WS | Kael (on_camera) | Kael: *"Agh! Vane! Tulong!"* | 3 | `frame-start` / `frame-end` |
| `SHOT_05C` | Vane Abandons Kael | 7s | 50mm OTS MCU | Vane, Kael (on_camera) | *None (Abandonment Foley)*| 0 | `frame-start` / `frame-end` |
| `SHOT_06A` | Kael Claws at Snare Knot | 6s | 85mm Macro ECU | Kael (on_camera) | *None (Straining Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_06B` | Cornered Wolf Defiant Snarl | 7s | 40mm Low-Angle MCU | Kael (on_camera) | Kael: *"Lumapit ka na... tapusin mo na 'to!"*| 7 | `frame-start` / `frame-end` |
| `SHOT_07A` | Elowen Steps Through Ferns | 6s | 35mm Dolly MLS | Elowen, Kael (on_camera) | *None (Discovery Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_07B` | Elowen Speaks Realization | 6s | 50mm OTS MCU | Elowen, Kael (on_camera) | Elowen: *"Isa ka sa mga... umatake kanina."* | 7 | `frame-start` / `frame-end` |
| `SHOT_07C` | Kael's Bitter Challenge | 7s | 85mm Profile CU | Kael, Elowen (on_camera) | Kael: *"Ano pang hinihintay mo? Tawagin mo..."* | 12 | `frame-start` / `frame-end` |
| `SHOT_08A` | Garrick's Shout from Ridge | 6s | 35mm Low Dutch MLS | Elowen, Kael (on_camera) | Garrick (O.S.): *"Suyurin ang gubat!..."* | 7 | `frame-start` / `frame-end` |
| `SHOT_08B` | Elowen Draws Sickle | 7s | 50mm Profile MCU | Elowen, Kael (on_camera) | *None (Blade Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_08C` | Elowen Saws Taut Rope | 7s | 65mm Top-Down CU | Elowen, Kael (on_camera) | *None (Friction Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_09A` | Kael Stunned by Mercy | 6s | 50mm High-Angle CU | Kael, Elowen (on_camera) | Kael: *"A-anong ginagawa mo? Nababaliw ka na ba?..."*| 9 | `frame-start` / `frame-end` |
| `SHOT_09B` | Elowen's Moral Conviction | 7s | 40mm Low-Angle MCU | Elowen, Kael (on_camera) | Elowen: *"Alam ko! Pero kapag naabutan ka nila..."*| 12 | `frame-start` / `frame-end` |
| `SHOT_09C` | Hemp Rope Snaps Free | 6s | 85mm High-Speed CU | Elowen, Kael (on_camera) | *None (Severance Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_10A` | Kael Recovers Footing | 6s | 35mm Lateral MLS | Kael, Elowen (on_camera) | *None (Recovery Foley)* | 0 | `frame-start` / `frame-end` |
| `SHOT_10B` | Elowen Urges Him to Flee | 6s | 50mm Low-Angle MCU | Elowen, Kael (on_camera) | Elowen: *"Umalis ka na! Bilis, bago pa sila..."*| 9 | `frame-start` / `frame-end` |
| `SHOT_10C` | Kael's Raw Gratitude Vow | 7s | 85mm Static CU | Kael, Elowen (on_camera) | Kael: *"Hindi ko kakalimutan 'to."* | 4 | `frame-start` / `frame-end` |
| `SHOT_10D` | Wolf Leaps into Mist | 7s | 24mm Crane WLS | Kael, Elowen, Dogs | *None (Vanish Foley)* | 0 | `frame-start` / `frame-end` |

---

## 4. Continuity & Assembly Verification Results

### 4.1 Recipe Assembly Preview (`krakinai_preview_scene_assembly`)
Preview compilation was executed across landmark scenes across all story phases:
- **`scene-shot-01a` (Establishing Wide):** Synthesizes pastoral environment, 5-wolf ridge silhouette FG, sheep villagers in apple orchards BG, 24mm crane movement, and cool 5600K mist lighting. Result: `valid: true`, 0 errors.
- **`scene-shot-05b` (Snare Trigger):** Synthesizes ancient pine environment, fallen log FG, vertical whip action, oak trunk roots BG, and Kael's agony line with valid timing clamping. Result: `valid: true`, 0 errors.
- **`scene-shot-08c` (Sickle Sawing):** Decoupled macro view synthesizing fraying hemp cord, lavender sprig satchel FG, trembling hands, and rhythmic sawing Foley. Result: `valid: true`, 0 errors.
- **`scene-shot-10c` (Kael's Vow):** Isolates luminous amber eye micro-expressions in 85mm portrait CU with golden canopy shaft illumination and intimate murmuring delivery. Result: `valid: true`, 0 errors.

### 4.2 Performance Studio & Schema Conformance
- **Dialogue Delivery Modes:** On-screen dialogue lines use `mode: "on_camera"` with participant ID linking. Off-screen commands (such as Garrick's O.S. shout in `scene-shot-08a`) use `mode: "off_screen"` without participant linking, eliminating schema validation and domain rule conflicts.
- **Timing Windows:** Every dialogue cue satisfies $0 \le \text{startSeconds} < \text{endSeconds} \le \text{durationSeconds}$.
- **Speaking Paces & Techniques:** All performance attributes use validated catalog preset IDs (`natural`, `slow`, `fast` speaking paces; `commanding`, `warning`, `whispered`, `trembling`, `understated`, `mocking`, `shouted`, `stammering`, `breathless`, `pleading`, `murmured`, `intimate` techniques).

---

## 5. Next Steps for the Human Director

The proposal is staged cleanly and awaiting human review in the KRAKINAI browser application:

1. **Open KRAKINAI in your browser** at [`http://localhost:5173`](http://localhost:5173).
2. Navigate to the **Review Inbox** panel (top right header icon).
3. Select proposal **`129a62f1-07c2-43d1-8fbf-2151fc18da11`**:
   - Title: *"Wool and Fang: The Snare in the Timberline — Complete Storyboard Setup"*
   - Package Digest: `d1f8bd55aa93ea30cdede09b593d53bd2af0a1dfe159e3b62d6b75a81787bae6`
4. Inspect the staged package:
   - **Assets Tab:** 25 proposed candidate records with distinct titles, descriptions, and tags.
   - **Shots Tab:** 30 storyboard shots in order.
   - **Scenes Tab:** 30 modular 4-slot recipes with 3-plane crowd staging and Performance Studio dialogue.
   - **Keyframes Tab:** 60 Start/End keyframes ready for image frame prompting.
5. Click **"Apply Proposal"** to commit this entire storyboard into your active library.
6. Once committed, you can immediately export scene prompt packages or initiate generation takes directly from the Shot Matrix!
