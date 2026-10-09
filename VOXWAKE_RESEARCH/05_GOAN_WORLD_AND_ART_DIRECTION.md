# 05 — GOAN WORLD AND ART DIRECTION

> **Canonical owner of:** visual identity, the **reference-image inventory**, palette tokens, lighting/time-of-day, water/toon/VFX look, boat & environment designs, **asset pipeline (§14: procedural-first, Blender-optional)**, asset budgets/naming/LOD, visual acceptance criteria.
> Obeys `02 §0` (CD-01, CD-07, CD-15). Camera *numbers* live in `06 §8`; UI layout in `07`.
> Labels: **[OBS]** = observed in a supplied image · **[INTERP]** = my interpretation · **[VERIFIED]** (2026-10-07) · **[PROPOSED]** · **[UNVERIFIED]** · **[ASSUMPTION]**.

---

## 1. Art direction and mood

**One-line direction:** *"A hand-inked Goan postcard that happens to be a racing game."*
Flat, saturated, thick-outlined, screen-print-bright 3D — **toon-shaded low-poly with ink outlines**, a *limited* palette (green · sun-yellow · hot-magenta · terracotta · cream) taken directly from the hackathon site screenshots, with **turquoise water** as the single non-reference hue (it's the hero colour the user asked for).

**Mood words:** sun-drenched · cheeky · festive · susegad (unhurried) — in contrast with the frantic race.
**What it is not:** photoreal, neon-cyberpunk, generic "tropical island with random palms", or a mix of unrelated asset styles. One rulebook: *same outline thickness, same palette, same shading steps, same silhouette discipline* for everything.

**Cohesion rules (non-negotiable):**
1. **3-step toon shading** (shadow / mid / light) everywhere; no PBR realism.
2. **Ink outline** (`--ink`) on boats, hazards, hero props and near-bank buildings; none on far silhouettes.
3. **Palette discipline:** every material colour comes from the palette tokens (§4). A unit test greps materials for colours outside the allowed set (with a tolerance) — `tools/perf/checkPalette.ts`.
4. **Silhouette first:** hazards, boats and gates must read in a 160×90 px thumbnail.
5. **Flat shapes + a few hand-made details** (shutters, tile rows, bunting) beat many tiny details.
6. Everything sits on a **1 unit = 1 metre** scale.

---

## 2. REFERENCE INVENTORY (all four supplied screenshots, analysed)

> Files are copied to `VOXWAKE_RESEARCH/reference_images/`. **Opus must open each image** (Read tool) before building the matching feature. Hex values were produced by k-means quantisation of the files on 2026-10-07 (**[OBS]**, approximate); the tokens in §4 are my recommended rounded values (**[INTERP]**).
> **Important:** these screenshots are *contextual evidence about the event's look* — **not** evidence of hackathon rules, judging criteria, branding permission or technical requirements. Nothing below invents any.

### REF_01 — `REF_01_hackerhouse_banner_day_signs.png` (1639×874)
| Aspect | Detail |
|---|---|
| **Depicts** [OBS] | Flat vector illustration. A Portuguese-style Goan villa (terracotta hip roof, white walls, **pink / yellow / green shuttered windows**, orange double door, white porch railing) behind a beach with white-outlined surf. Two coconut-palm clusters left/right. In the foreground a **green laptop** showing the logo "HACKER **गोवा** HOUSE", two hands typing, a coffee cup and a yellow/magenta bottle on a **yellow plank table**. A **scalloped striped awning** runs along the top. **Four rope-hung signs**: yellow "DAY 01 – GENESIS DAY / WHERE IT ALL BEGINS", magenta "DAY 02 – DAY OF TRIANGLE / PROBLEM. SOLUTION. MARKET", magenta "DAY 03 – BUILD DAY / HEADS DOWN. SHIP OR SHIP", yellow "DAY 04 – LAUNCH DAY / THE WORLD WATCHES". |
| **Colours** [OBS] | bg mint-green `#1CD378` (21 %), leaf-green `#219A59` (18 %), yellow `#FFFF35` (17 %), magenta `#FF0CCF` (16 %), pale-yellow `#F2E97C`. |
| **Composition** | Symmetric, centre-framed hero (villa+laptop), signs in four corners on ropes, strong horizontal table plane at the bottom. |
| **Typography** | Sign text = **monospace caps** (teal-green on yellow, white on magenta); logo = **tall high-contrast serif (Didone) with a magenta Devanagari sticker** overlapping. |
| **Style** | Thick dark-green outlines, flat fills, no gradients, tiny palm-frond hatching. |
| **Influences the game** [INTERP] | (a) **Villa kit** (roof/shutter/door colours) → `GoanVilla` procedural model. (b) **Hanging rope signs** → the in-race **sentence sign** and Championship level signs. (c) **Scalloped awning** → market-stall awnings + HUD frame edge. (d) **Table POV with laptop + hands** → **main-menu 3D diorama** ("shack table", the game boots on the laptop screen). (e) Palette and flat outline look → whole game. |
| **Do NOT copy** | The "Hacker House" logo/lockup, the exact villa illustration, the laptop logo screen, the Day-sign copy. Re-draw an *original* villa; use our own title lockup. The bottle → replace with a **coconut / lime soda** prop (keeps the game all-ages). |
| **Implementation mapping** | `kit/goanVilla.ts` (colours from this image), `ui/theme.css` sign component, `scenes/MenuDiorama.ts`, `kit/market.ts` awning with scallop geometry. |

### REF_02 — `REF_02_signpost_stats_sunset_beach.png` (1696×925)
| Aspect | Detail |
|---|---|
| **Depicts** [OBS] | A **wooden signpost** with four **arrow signs** (yellow left-pointing "6800+ REGISTRATIONS 2024", magenta right-pointing "390+ HACKERS", yellow left "100 PROJECTS", magenta right "$50K+ BOUNTIES 2026"). Behind: **big yellow semicircle sun** on the horizon, a dark-green **sailboat**, white **line-art palm trees** curving inward, **seagulls**, white wave lines; foreground: **striped yellow/magenta beach umbrella**, two **deck chairs**, a **pink Vespa-style scooter**, white sand strip. |
| **Colours** [OBS] | bg `#0DA961`–`#12A961` (≈ 65 % across clusters), pale yellow `#EFF47E`, mint `#55BE86`, magenta/yellow signs. |
| **Composition** | Central vertical post with alternating arrows (left/right) — a clear *list* metaphor; symmetrical frame of palms; horizon at ~80 % height; sun centred behind. |
| **Typography** | Big numerals in condensed Didone serif; small caps labels in monospace. |
| **Influences** [INTERP] | (a) **Championship map = coast signpost**: one arrow sign per level, alternating left/right, with ★ pips; locked signs "rattle". (b) **Sun-semicircle-on-horizon** as the recurring skybox/loading motif. (c) **Sailboat silhouettes** as ambient background traffic. (d) **Beach umbrella, deck chairs, scooter** as shore props on L1/L4/L11. (e) **White line-art palms** for far-bank silhouettes in the "Golden Hour" and "Palolem" looks. (f) **Seagull flock** (boids, 6–10 sprites). |
| **Do NOT copy** | The statistics (6800+, 390+, 100, $50K+) — they are event facts, not game content; do not display them. Do not reproduce the exact scene composition as a loading screen. |
| **Mapping** | `screens/ChampionshipMap.tsx`, `world/SkySystem.ts` (sun disc), `kit/props.ts` (umbrella/chairs/scooter), `world/VfxSystem.ts` (gull flock). |

### REF_03 — `REF_03_task2_voice_rag_card.png` (1651×771)
| Aspect | Detail |
|---|---|
| **Depicts** [OBS] | A **cream card on deep green** with a **hard offset dark-green drop shadow**, from a task list page: kicker **"TASK #2"** (magenta, small caps), title **"Voice-Enabled RAG Model"** (condensed green serif), body in monospace, **✦ magenta diamond bullets**, a **pink-tinted alert box** (red text): "SUBMISSIONS CLOSED — THE AUG 22, 11:59 PM IST DEADLINE HAS PASSED", and three buttons: grey *SUBMISSIONS CLOSED*, outlined-magenta *TASK DETAILS ↗*, filled-yellow *TASK 2 RESULTS*. Left: green **microphone in a circle with a dashed magenta ring**, a yellow badge, and a tilted white card "ASK ANYTHING" with a waveform. Bullets mention "voice-to-text input", "P50/P70/P100 latency", "#RAGInGoa". |
| **Colours** [OBS] | bg `#0B6839` (42 %), cream `#FFFBE7`/`#FFFCE9`, grey-beige `#E2DFCA` (disabled), magenta + yellow accents. |
| **What it is / isn't** | It is a **different task** (a voice RAG task whose submissions are closed). It tells us the event has a **voice/AI theme**; it does **not** specify requirements or judging for our game. **[ASSUMPTION A1]** the user's "Wispr Flow is the judging focus" comes from the user, not this image. |
| **Influences** [INTERP] | **UI component system:** cream *paper cards* with hard offset shadows (menus, results, setup), magenta kicker labels ("STAGE 3", "LEVEL 5"), ✦ bullets, **alert box** style for warnings (mic blocked, Flow not detected), the **button hierarchy** (disabled grey / outline magenta / filled yellow), and the **mic-in-dashed-ring** motif → the **FlowDeck "listening" ring** and Flow Setup hero. |
| **Do NOT copy** | The task text/hashtag, deadline notice, "Task details" pattern as content. |
| **Mapping** | `ui/components/Card.tsx`, `Button.tsx` (variants), `Alert.tsx`, `FlowDeck` ring, `screens/FlowSetup.tsx`, `screens/Results.tsx`. |

### REF_04 — `REF_04_hero_title_hacker_house_goa.png` (1645×922)
| Aspect | Detail |
|---|---|
| **Depicts** [OBS] | Hero/landing view: top-left yellow hand-drawn "**2:47 PM STUDIO**" logo; top-right nav "CHECK HYPE" and a **yellow "APPLY" button with a stitched/checker border**; giant **"HACKER HOUSE"** in tall yellow Didone caps with dark drop shadow; a **pink Devanagari "गोवा" sticker** (white outline) overlapping the gap; metadata line **"GOA, INDIA · 28 – 31 OCT 2026"** (left) and **"2:47 PM STUDIO"** (right) in yellow monospace; a **yellow rising sun with radiating rays** and green palm leaves at the bottom edge. A zoom widget overlays the top. |
| **Colours** [OBS] | deep green `#036735`–`#046836` (≈ 70 %), yellow text (dark-shadowed average `#C1BF0F`; visually ≈ `#FFE600`), magenta sticker. Subtle noise/vignette on the green. |
| **Influences** [INTERP] | **Title screen**: huge yellow Didone wordmark (**VOXWAKE**) + magenta **sticker** (Devanagari "गोंय"/"गोवा" — **[ASSUMPTION A5] verify spelling with a Goan/Konkani speaker; "गोवा" is the spelling visible in the reference**), mono metadata line ("GOA · CHAMPIONSHIP · VOICE DUEL"), **stitched-border primary button** ("PLAY"), rising **sun + rays** animation as the title background, palm-leaf frames at the corners, light film-grain/vignette. |
| **Do NOT copy** | The studio logo, "HACKER HOUSE" text, dates (unless the user wants an event credit — **[ASSUMPTION A2]**), or the exact sticker lockup. Our lockup differs in wording and sticker placement. |
| **Mapping** | `screens/Title.tsx`, `ui/theme.css`, `world/SkySystem.ts` (sun rays for title scene), fonts (§17). |

### 2.5 Visual reference inventory (decision → image)
| Decision | Source image(s) |
|---|---|
| Palette & flat/outline style | REF_01, 02, 03, 04 |
| Villa/roof/shutter colours | REF_01 |
| Rope-hung sentence sign; level signs | REF_01, REF_02 |
| Coast signpost level select | REF_02 |
| Sun-semicircle skybox motif | REF_02, REF_04 |
| Paper-card UI, buttons, alerts | REF_03 |
| Mic dashed-ring listening indicator | REF_03 |
| Title lockup, stitched button, rays | REF_04 |
| Menu diorama (table POV + laptop) | REF_01 |
| Turquoise water | **User request**, not in references |

---

## 3. Goa research notes (what makes it *Goa*, not "a tropical island")

**Verified (2026-10-07):** *Fontainhas*, Panjim's oldest Latin quarter (est. 1770), has narrow winding streets with colourful villas; **projecting balconies painted in pale yellow, green or blue and red-tile roofs**; residents were required to **repaint annually after the monsoon**, a tradition that continues. Source: https://en.wikipedia.org/wiki/Fontainhas_(quarter) **[VERIFIED]**. Further architecture articles surfaced by search (not individually read): Outlook Traveller "The myriad hues of Fontainhas" (https://www.outlooktraveller.com/see/photo-features/goa-the-myriad-hues-of-fontainhas), Herald Goa "Goa's Latin Quarters still an architectural haven" (https://www.heraldgoa.in/goa/goas-latin-quarters-still-an-architectural-haven/404876) **[UNVERIFIED content]**.

**General cultural knowledge to use tastefully [UNVERIFIED — spot-check with a Goan teammate]:** whitewashed baroque churches with twin towers and volute gables · red/terracotta **Mangalore-style tile roofs** · covered porches (*balcão*) with built-in seats · oyster-shell (*carepa*) window panes · **azulejo** (blue-white tile) accents · wayside crosses · **Ro-Ro ferries** linking river islands (Divar, Chorão) · fishing **canoes** and trawlers with painted bow eyes · **beach shacks** (bamboo, thatch, string lights, hand-painted menu boards) · **cashew** and **coconut** everywhere · bakeries with *pão*, *bebinca*, spicy fish curry/vindaloo/xacuti · Friday/Saturday **flea & fresh markets** (Mapusa, Anjuna) · monsoon storms · forts (Chapora, Cabo de Rama, Reis Magos) on laterite headlands · Dudhsagar waterfall in a jungle gorge · carnival/Shigmo festive bunting.

**Avoid:** clichéd Bollywood or Rajasthani imagery; religious symbols used as decoration without context; real brands/shop names; alcohol-forward imagery (keep the game all-ages); stereotyped characters. **Respect:** places are *stylised homages*, not maps. Use real place names for flavour; invent the layouts.

---

## 4. Colour palette and tokens (`ui/tokens.css` and `world/palette.ts` share these)

| Token | Hex | Source / use |
|---|---|---|
| `--green-deep` | **#076B38** | REF_03/04 bg → page bg, HUD frames |
| `--green-lagoon` | **#10AC63** | REF_02 bg → river water edge tint, props |
| `--green-mint` | **#1CD378** | REF_01 bg → highlights, success |
| `--green-leaf` | **#219A59** | palm leaves, banks |
| `--green-ink` | **#0B3B2A** | outline/ink colour (darkened green) |
| `--sun` | **#FFE600** | hero yellow (REF_04 letters) → sign fills, active word |
| `--sun-neon` | **#FFFF35** | REF_01 → flashes, nitro |
| `--magenta` | **#FF0CCF** | REF_01 → accents, sticker, shutters |
| `--magenta-deep` | **#C4007F** | magenta text on cream (contrast ≥ 5:1 — **verify with script**) |
| `--terracotta` | **#E4673A** | roof tiles, doors (REF_01 villa; eyeballed) |
| `--cream` | **#FFFBE7** | REF_03 paper cards |
| `--paper-shadow` | **#0A5230** | hard offset card shadow |
| `--alert-bg` / `--alert-ink` | **#FFE4F1** / **#E0003C** | REF_03 alert box |
| `--disabled` | **#E2DFCA** | REF_03 disabled button |
| `--sea-turquoise` | **#19D3C5** | **hero water** (user request) |
| `--sea-deep` | **#0A8FA3** | water depth gradient |
| `--foam` | **#F4FFFB** | wake/foam |
| `--sky-day-top/hor` | #3CC8FF / #D8FBFF | clear morning |
| `--lagoon-gold-top/hor` | #FF9E3D / #FFE08A | golden hour |
| `--night-top/hor` | #07123A / #2A1B6B | night regatta |

Material colour variation: ±8 % lightness jitter per instance (vertex colour or instance colour) to avoid flatness while staying in-palette.
**Accessibility pairs (target WCAG AA 4.5:1 for text ≥ 16 px, 3:1 for large/graphics; Opus must compute with a script and fix failures):** `--sun` on `--green-deep` ≈ 5.3:1 ✓; `--magenta-deep` on `--cream` ≈ 5.6:1 ✓; `--magenta` on `--cream` ≈ 3.3:1 ✗ for small text (use deep).

---

## 5. Lighting and time of day

One **directional sun** (`DirectionalLight`), one **hemisphere** fill, **fog** tuned per level, **no real-time shadow maps by default** (blob shadows under boats/props + baked-looking gradient on buildings). `quality:high` may add a single 1024² shadow cascade near the player.

| Look | Sun colour / elevation | Hemisphere sky/ground | Fog | Sky | Levels |
|---|---|---|---|---|---|
| **Morning clear** | `#FFF3D6` / 35° | `#9FE8FF` / `#2BBE8A` | `#CFF8FF` d=500 | clear gradient, small flat clouds | 1, 2 |
| **Midday market** | `#FFFFFF` / 70° | `#B8F0FF` / `#2FC98F` | `#E4FFFF` d=600 | bright, few clouds | 3, 9 |
| **Golden hour** | `#FFB347` / 12° | `#FFC889` / `#8A5A3C` | `#FFD7A3` d=420 | orange→yellow, **sun disc semicircle** | 4, 12 |
| **Afternoon colour** | `#FFF0C2` / 45° | `#BDEBFF` / `#3AD39A` | `#EAFBFF` d=550 | pale blue | 5 |
| **Overcast ferry** | `#DDE9EE` / 50° | `#C7D6DC` / `#4A8F7B` | `#C9D8DC` d=300 | grey-white | 6 |
| **Dawn mist** | `#FFE1C2` / 8° | `#FFD9C9` / `#6FA89A` | `#F1E6E4` d=160 | pastel pink/peach, **dense low fog** | 7 |
| **Monsoon storm** | `#9FB3C8` / 30° | `#6C7F95` / `#2E6E63` | `#7E93A4` d=220 | dark slate, rain | 8 |
| **Night regatta** | `#7FA8FF` / 20° (moonlight) | `#2A1B6B` / `#0B2A3A` | `#1B1F4F` d=300 | deep blue + stars + bridge lights | 10 |
| **Festival dusk** | `#FF8EC8` / 6° | `#FFB0D8` / `#4E2B6E` | `#FFC2E2` d=340 | magenta→yellow, fireworks | 11 |

Emissive string lights/lamps (bloom-less: fake glow via additive sprites) in night/dusk looks.

---

## 6. Toon shading and outlines

- **Material:** `MeshToonMaterial` with a shared 3-pixel `gradientMap` (NearestFilter), colour from palette; vertex colours for per-face variation (roof stripes, shutter colours) — no texture needed.
- **Outline:** **inverted-hull** pass — duplicate hero meshes with `BackSide` ink material, vertices pushed along normals in `onBeforeCompile` (thickness 0.05 m near, 0.09 m far, constant-ish in screen space via `* distance`). Use for boats, hazards, gates, near-bank buildings (≤ 60 m from boat), signs. **Instanced far scenery** uses no outline (cheaper) but darker silhouette tint. Alternative: `OutlineEffect` from three examples **[UNVERIFIED availability in r186 `examples/jsm/effects/`; check]** — only if the hull approach underperforms.
- **Optional polish (P1):** subtle film grain + vignette in a single fullscreen pass (mirrors REF_04); disabled in `low`.

---

## 7. Water

**Look:** bright turquoise → deep teal gradient, **white foam lines**, sparkly sun glints, gentle swell; reads as *Arabian Sea / Goan river estuary* in stylised form (REF_02's white wave lines inspire foam shapes).

**Implementation (`WaterSystem`)** **[PROPOSED]**
- Camera-anchored plane (300×300 m, 96×96 segments, re-centred per frame) with a `ShaderMaterial`:
  - **Vertex:** sum of 3 directional sines (wavelengths 7/11/17 m, amplitudes 0.10–0.28 m; `uSwell` multiplier per theme: calm 1.0 → storm 2.6).
  - **Fragment:** base gradient by distance-to-bank (`abs(lat)/halfWidth(s)` from a 1-D `DataTexture` of corridor widths), **procedural value-noise foam** thresholded into crisp white shapes (toon look), **bank foam band**, sun glint (specular by half-vector, quantised to 2 steps), Fresnel blend to sky colour.
- Land/banks sit above the water plane so the plane's edge is never visible.
- **Reflections:** none (fake via Fresnel colour); **no refraction**.
- Quality tiers: `low` = 2 waves + no noise foam (texture foam), `high` = full.

**Wakes and spray (`VfxSystem`)**
- **Wake ribbons:** two trailing V-shaped triangle strips per boat (24 segments, alpha-faded), width ∝ speed; foam texture scrolls.
- **Bow spray:** pooled `Points`/sprites, 40–120 particles per boat, emission ∝ speed² ; **stern churn** puffs.
- **Throttle ↔ visuals:** wake width = lerp(0.6 m, 2.6 m, throttle); **Nitro** adds a magenta-yellow trail and a flame cone; **Flow State** adds rainbow-ish (magenta→yellow→mint) ribbon and screen-edge glow.
- **Wave Jump:** splash ring on takeoff/landing, slow-mo 15 % for 0.25 s on landing.

---

## 8. Boats (silhouette discipline; ≤ 6 k tris hero LOD0, ≤ 2 k LOD1)

| Boat | Silhouette & key shapes | Palette | Details (procedural kit) |
|---|---|---|---|
| **Fisher's Canoe** (starter; Susegad's boat in teal) | slim dugout, upturned bow and stern, tiny outrigger-free hull | hull = paint colour; stripe terracotta; **white painted eye** on bow | wooden bench, rope coil, small lantern |
| **Shack Runner** (Caju's boat in red) | speedboat, raised windscreen, **thatched roof canopy** mid-ship | hull paint; thatch `#E6C27A` | string lights, tiny menu board, outboard engine |
| **Mandovi Ferry Mini** | chunky flat deck, wide beam, front ramp, small wheelhouse | cream + magenta rails | tyre fenders, flag, passenger silhouettes (flat) |
| **Spice Dhow** (Bebinca's boat in cream) | long hull, **lateen sail** (triangular), high stern | sail cream with sun-yellow stripe | rope rigging lines, lantern at stern |
| **Casino Catamaran** (Vasco's twin-hull in orange) | twin hulls, flat deck, canopy | orange + magenta | **string-light arch**, flag, two small funnels |

Every boat: **driver** = flat stylised figure (low-poly torso + head + cap) with 2-frame arm sway; **name plate** floating sign above rival boats (billboard, 3D sprite, ink outline); **paint swatch** applied to the hull material slot `paint`; **decal** slot (azulejo pattern texture) on the stern board.

**Rival liveries:** Caju red `#E2382F` + yellow lightning stripe · Bebinca cream `#FFF1CC` + terracotta sail stripe · Vasco orange `#FF7A1A` + magenta funnels · Susegad teal `#12B5A6` + sun-yellow eye. If the player uses the same hull, rival gets a hue-rotated variant.

---

## 9. Architecture kit (procedural, instanced)

| Kit piece (`kit/*.ts`) | Construction | Notes |
|---|---|---|
| **GoanVilla** (variants A/B/C) | box body + **plinth**; **hip roof** with 6–8 tile-row bands (vertex colours terracotta / darker terracotta); **balcão porch** with railing balusters; 2–3 windows with **shutters** coloured from {magenta, sun, mint, azure}; orange door; contrasting trim; optional azulejo band | Pastel body colours **pale yellow / green / blue / white** (Fontainhas tradition [VERIFIED]); REF_01 shutter colours |
| **Fontainhas row** | 5–8 villas joined, varied heights, **projecting balconies**, hanging laundry flags | L5 hero set piece |
| **Church** | whitewashed facade, **twin bell towers**, volute gable, cross, steps | Old Goa Mist (L7); keep respectful and simple |
| **Fort ruin** | laterite-colour (`#B9643C`) ramparts, crenellations, gate arch, partial collapse | Chapora (L2), Cabo de Rama (L12) |
| **Beach shack** | bamboo frame, **palm-thatch roof** (layered cones/ridges), string lights, menu board, deck chairs, umbrella | L1, L4, L11 |
| **Market stall** | table + crates + baskets + **scalloped striped awning** (REF_01) in magenta/yellow/mint | L3 |
| **Pier/jetty** | wooden planks on piles; scooter/boxes | L4 |
| **Ro-Ro ferry (moving hazard)** | long flat deck, ramp, wheelhouse, cars (flat boxes) | L6 |
| **Bridge (Zuari)** | simplified **cable-stayed** pylon + deck + light strings | L10 |
| **Waterfall** | 3–5 vertical alpha-scrolled planes + mist sprites | L9 |
| **Lamp/lantern posts** | emissive heads | L10, L11 |

Instancing: villas/palms/stalls via `InstancedMesh` per variant; max ~160 instances per chunk; chunk-culling per `06 §2`.

## 10. Vegetation
- **Coconut palm** (hero): curved trunk (7 tapered segments, ring bands), 9 bent frond planes (double-sided, flat-colour with 2-tone stripe), coconut cluster; **sway** in vertex shader (`uWind`), wind × 2.5 in monsoon. 350 tris. LOD1 = 6-frond cross (80 tris). Far: **white line-art palm silhouette** billboard (REF_02) in golden/Palolem looks.
- **Casuarina** (beach spikes), **banana** (big leaves), **mangrove** (arched roots, L2/L7), **jungle** layers (L9: tall trees + hanging vines + fern planes), **cashew tree** (twisty, small fruit blobs) on hillsides, **bougainvillea** magenta blobs over walls (L5, L11).
- Grass/shrub = flat green cones in clumps (instanced).

## 11. Market props and festive decoration
Bunting (triangular flags: magenta/yellow/mint/white, catenary curve, wind flutter) · string lights · paper lanterns · baskets of fruit/cashew (flat colour blobs) · sacks · fish crates · scooter (pink Vespa-like, REF_02) · umbrella (yellow/magenta, REF_02) · deck chairs (REF_02) · hanging cloth awnings · **menu boards** with *procedural fake-text glyphs* (no real brands) · wayside crosses · temple-style lamp tower (decorative, tasteful, L11) · fireworks (particles) in L10/L11.

## 12. Obstacles, checkpoints, pickups, gates (readability spec)

| Item | Shape/colour | Behaviour | Readability rule |
|---|---|---|---|
| **Buoy** | striped sphere-cone, red/white (magenta/cream) | static | luminance contrast ≥ 3:1 vs water; ink outline |
| **Fishing net** | rope grid between two floats | slows (static line) | pulsing yellow floats |
| **Drifting log** | cylinder with branch stubs | slow lateral drift | brown `#8A5A2B` + outline |
| **Floating baskets / market crates** | box/baskets cluster | static | warm colours vs cool water |
| **Rocks / laterite blocks** | low-poly chunks | static | dark ink + white foam ring |
| **Ro-Ro ferry** | big, slow crosser | moving, timed gap | huge, striped hazard bow, horn VFX/sound telegraph 2 s ahead |
| **Wind-squall zone** (L8+) | rain streak column | lateral push | visible rain pillar |
| **Jelly/glow orbs** (night) | emissive orbs | slow | glow halos |
| **Wave Jump ramp** | wooden ramp w/ yellow chevrons | launches if charge | chevrons + arrow sign "JUMP" |
| **Cashew (Caju) pickup** | cream-yellow cashew shape on a golden ring | +score, XP | arcs of 5–9 along ideal racing line; **magnet** radius 3 m |
| **Bonus Phrase Gate** | **arched wooden sign** over water with bunting, magenta glow | opens at `s−25 m` | text card + countdown ring |
| **Checkpoint / stage markers** | slim flag posts on banks | cosmetic + stage stamp | consistent colour per stage |
| **Finish line** | big **gate with chequered bunting** + sun semicircle | | |

All hazards are **telegraphed ≥ 1.5 s ahead at top speed** (≥ 40 m).

## 13. Level environments and weather (per-level art brief)

| L | Skyline/landmarks | Bank dressing | Special FX/weather |
|---|---|---|---|
| 1 Baga | shacks row, umbrellas, scooter on sand, sailboat silhouettes | palms, casuarina | gulls, sparkle water |
| 2 Chapora | **fort ruin** on a hill, fishing canoes moored | mangroves, rocks | morning haze |
| 3 Mapusa | **market stalls** along both banks, bunting arches, baskets | awnings, crates | murmuring crowd sprites |
| 4 Anjuna | piers, flea-market string lights, **sun disc** huge | palms w/ white outline silhouettes | golden rim light |
| 5 Fontainhas | **coloured villa rows**, balconies, azulejo bands, laundry flags | bougainvillea | petals drifting |
| 6 Divar | Ro-Ro **ferries**, jetty, island trees | reeds | overcast, seabirds |
| 7 Old Goa | **white church**, towers, mist banks | old walls, banyan | dense low fog, bells |
| 8 Monsoon | dark clouds, swaying palms, rough swell | wet shine | **rain**, gust ribbons, lightning flash (once, with epilepsy-safe flash limits) |
| 9 Dudhsagar | **waterfall** cascades, steep jungle walls | ferns, vines | mist, rainbow arc |
| 10 Zuari | **bridge** with lights, port cranes silhouettes | lamps | stars, firework test pops |
| 11 Palolem | beach huts, **festival bunting**, lantern arches, crowd silhouettes | bougainvillea | **fireworks**, confetti |
| 12 Cabo de Rama | laterite **cliffs**, fort, crashing swell | cashew trees | storm clearing → golden finale; **3-leg** course with a cinematic cliff pass |
| Endless | remix of the above with modifier-driven weather (fog, rain, night) | | |

---

## 14. ASSET PIPELINE (canonical; CD-07)

### 14.1 Strategy: **procedural-first, Blender-optional**
- **P0 baseline = procedural kit in code** (`apps/client/src/world/kit/*`). It guarantees the game runs with *no files to download* and no Blender. All geometry is built from primitives/`BufferGeometry` helpers with vertex colours.
- **P1 upgrade = Blender-authored `.glb`** for boats and hero props, **loaded through `AssetRegistry`** which falls back to the procedural builder on missing/failed files.
- An AI agent cannot operate Blender's GUI → use **headless Python scripts** (`blender -b -P tools/blender/<name>.py`) that generate the model and export glb **[PROPOSED; Blender background mode not re-verified today → UNVERIFIED; check `blender --version` first]**. If Blender isn't installed: skip P1 silently.
- Never import random downloaded models: style mismatch + licence risk. If any third-party asset is used it must be **CC0**, recorded in `docs/ASSET_LICENSES.md`, and re-coloured to the palette.

### 14.2 Registry contract
```ts
AssetRegistry.register(key: 'boat.canoe' | 'prop.palm.a' | …, { procedural: () => Object3D, glb?: '/models/boat_canoe.glb' });
AssetRegistry.instantiate(key): Object3D     // returns procedural immediately; hot-swaps to glb when loaded
```
Scale: **1 unit = 1 m**; models authored facing **+Z** (glTF convention) with origin at waterline centre; `BoatView` rotates to the course tangent.

### 14.3 Naming conventions
`SM_<Cat>_<Name>_<Variant>[_LODn]` (static mesh), `M_<Name>` (material), `T_<Name>_<Map>` (texture), `PFX_<Name>` (particle config), `AUD_<Name>` (audio cue id). Files lower_snake: `boat_canoe_lod0.glb`. Registry keys dot-case: `boat.canoe`, `kit.villa.a`, `hazard.buoy`.

### 14.4 Budgets (initial; validate with `renderer.info` — `08 §11`)
| Item | Budget |
|---|---|
| Visible triangles per frame | ≤ **400 k** (target 250 k) |
| Draw calls | ≤ **250** (target 160) |
| Boats | ≤ 6 k tris LOD0, 2 k LOD1 (5 boats on screen) |
| Villa/stall/shack | ≤ 600 tris |
| Palm | ≤ 350 tris (LOD1 80) |
| Textures | **1 shared 1024² atlas** + 512² water noise + UI; total GPU tex ≤ 24 MB |
| Particles live | ≤ 1,500 (low: 600) |
| Materials | ≤ 40 unique |
| Total shipped assets (excl. JS) | ≤ 15 MB (P0 ≈ 1 MB: fonts only) |
| Lights | 1 dir + 1 hemi (+ ≤ 8 additive sprites for glows) |

### 14.5 LOD strategy
Distance bands from camera: **LOD0 < 40 m**, **LOD1 40–120 m**, **far silhouette > 120 m** (single merged mesh / billboard). Instanced chunks swap by chunk, not per instance. Boats keep LOD0 always (≤ 5).

### 14.6 Blender export workflow (P1)
1. Model low-poly, **apply all transforms**, origin at waterline centre, forward = Blender −Y → exports to glTF +Z.
2. Materials: Principled BSDF with **base colour only (flat palette hexes)** + vertex colours; no image textures except the shared atlas.
3. Export glTF 2.0 **binary (.glb)**, `+Y Up`, apply modifiers, **no** cameras/lights, include vertex colours, compress with meshopt/Draco *optional* **[UNVERIFIED decoders in r186 — check]**.
4. Validate with `tools/perf/checkAssets.ts`: tri count, material count, bounding box, naming; fail on budget exceed.
5. Drop into `apps/client/public/models/`; add registry entry; run `npm run test:visual`.

### 14.7 Asset inventory with priorities
| ID | Asset | Pri | Notes |
|---|---|---|---|
| A-001…005 | 5 boats (procedural) | **P0** | canoe, shack, ferry-mini, dhow, catamaran |
| A-006 | Driver figure | P0 | flat low-poly |
| A-010 | Water shader + wake ribbons + spray | **P0** | |
| A-011 | Sky dome + sun disc + clouds | **P0** | per ToD |
| A-020 | Coconut palm (+LOD) | **P0** | |
| A-021 | Goan villa A/B/C | **P0** | |
| A-022 | Beach shack + umbrella + chairs | **P0** | L1 |
| A-023 | Market stall + bunting | **P0** | L3 |
| A-024 | Fort ruin | **P0** | L2 |
| A-030 | Buoy, net, log, basket, rock | **P0** | |
| A-031 | Cashew pickups | **P0** | |
| A-032 | Bonus Phrase Gate | **P0** | |
| A-033 | Ramp | **P0** | |
| A-034 | Finish gate | **P0** | |
| A-035 | 3D sentence sign (hanging) *(optional; HUD is DOM)* | P1 | |
| A-040 | Fontainhas row, azulejo texture (procedural canvas) | P1 | L5 |
| A-041 | Church | P1 | L7 |
| A-042 | Ro-Ro ferry (moving) | P1 | L6 |
| A-043 | Waterfall + jungle | P1 | L9 |
| A-044 | Bridge + lamps | P1 | L10 |
| A-045 | Cliffs + fort (finale) | P1 | L12 |
| A-050 | Rain, fog, fireworks, lightning | P1 | |
| A-051 | Gull flock | P1 | |
| A-060 | Menu diorama (shack table + laptop) | P1 | REF_01 |
| A-061 | Blender `.glb` upgrades of boats | P1 | |
| A-070 | Crowd silhouette sprites | P2 | |
| A-071 | Cinematic cliff fly-by | P2 | |

### 14.8 Placeholder → final replacement
Stage 0: coloured boxes (day 1, unblocks logic) → Stage 1: procedural kit (P0 art) → Stage 2: `.glb` swaps via registry (P1). **Never block gameplay milestones on art.** Each stage must pass the same acceptance checks (§19).

---

## 15. VFX list (all pooled, all optional-failsafe)
Word-pop spark ring (HUD, DOM) · bow spray · stern churn · wake ribbons · speed lines (screen-space, ∝ speed) · Nitro flame + trail · Flow State glow/trail · Shield bubble (magenta translucent hex pattern) · Wave Jump splash · hazard hit (white flash, debris, camera shake) · pickup sparkle · overtake whoosh · confetti/fireworks (finish) · rain, fog, lightning (flash capped 1/6 s, ≤ 2 flashes/level, **no strobe**) · bunting flutter · palm sway.
`reducedMotion`: disables speed lines, camera shake, FOV kick, flashes; keeps essential feedback via colour/shape.

## 16. Camera language (numbers in `06 §8`)
- **Chase cam** behind/above the boat with a **spring arm**; looks slightly ahead of the boat along the spline (anticipation).
- **Speed = FOV + distance**: FOV widens and the camera drifts back as throttle rises; stroke surge = quick +4° kick.
- **Steering = roll + lateral lead:** gentle bank (≤ 6°), camera slides toward the steering direction.
- **Hazard hit:** short shake + brief zoom-in. **Nitro/Flow State:** radial streak, slight shake.
- **Cinematics:** 3-s course fly-by (skippable) before the countdown; start-line pan; **finish orbit** with slow-mo photo-finish (≤ 2 s). Rematch reveal uses a tilt-shift pan on the loser.
- **Composition rule:** keep the **boat low-centre**, **sentence sign never occluded** (HUD is DOM above the canvas), horizon at ~38 % height.

## 17. UI visuals and typography (layout in `07`)
- **Display:** a **tall high-contrast Didone serif** like REF_04's wordmark — candidates on Google Fonts: *Bodoni Moda*, *Playfair Display SC*, *Abril Fatface*; use a horizontal squeeze (`transform: scaleX(.78)`) to reach the condensed look. **Opus compares candidates against REF_04 and picks one.**
- **Labels/body:** **monospace caps** like REF_01/03 — *Space Mono*, *JetBrains Mono*, *IBM Plex Mono*.
- **Devanagari sticker:** a bold brush/rounded face — *Modak*, *Yatra One*, *Rozha One*, *Sarpanch* (support for Devanagari **[UNVERIFIED per font; check glyph coverage]**).
- **Self-host** the chosen fonts (e.g., `@fontsource/*` packages **[UNVERIFIED names — `npm view @fontsource/bodoni-moda version`]**) so the game never depends on a CDN at the venue; subset to Latin + Devanagari digits/letters used.
- **Components** (REF_03): paper card with **hard offset shadow**, kicker label, ✦ bullets, alert box, 3-tier buttons, stitched-border primary CTA (REF_04), rope-hung signs (REF_01), arrow signs (REF_02), dashed-ring mic (REF_03).

## 18. Audio atmosphere (details `07 §14`)
Layered ambience per level: sea wash + wind + **gull calls** (procedural FM chirps) · distant **church/temple bells** (L7, L11; synthetic bell partials) · **market murmur** (filtered noise bursts, L3) · scooter horn/beeps · ferry horn (L6) · rain/thunder (L8) · crickets/frogs (L10 night) · crowd cheer swell (L11, finish). Music: sunny **pentatonic marimba/ukulele-style plucks + shaker + dholki-like hand-percussion** synthesised in WebAudio; stems layer in with streak/Flow State. (No sampled copyrighted music.)

## 19. Visual quality acceptance criteria (checked by screenshots + script)
| ID | Criterion |
|---|---|
| VQ-01 | Every level shows ≥ 3 identifiable Goan elements from §13 within the first 10 s |
| VQ-02 | Palette adherence: ≥ 90 % of opaque material colours are within tolerance of §4 tokens (script) |
| VQ-03 | Outlines visible on boats, hazards, near buildings at 1280×720 |
| VQ-04 | Hazards/pickups/gates identifiable at 160×90 thumbnail; hazard-vs-water luminance contrast ≥ 3:1 |
| VQ-05 | Wake visible and scales with throttle (3 reference screenshots at T=0.2/0.6/1.0) |
| VQ-06 | Turquoise water reads turquoise in morning/midday/golden looks |
| VQ-07 | No z-fighting, no visible water-plane edge, no pop-in within 120 m (visual walk) |
| VQ-08 | HUD sentence sign never overlaps the boat or the next hazard at default FOV |
| VQ-09 | Text contrast ≥ 4.5:1 (script) |
| VQ-10 | Title screen matches REF_04 *structure* (wordmark + sticker + mono meta + stitched CTA + rising sun) without copying its lockup |
| VQ-11 | Level-select matches REF_02 *structure* (signpost with arrow signs) |
| VQ-12 | Paper-card UI matches REF_03 *structure* (offset shadow, kicker, ✦, alert, 3 button tiers) |
| VQ-13 | 60 fps on the reference machine in L1, L6, L12 at `high`; `low` ≥ 30 fps on integrated GPU |
| VQ-14 | With `reducedMotion`, no flash/shake/FOV kick; still readable |
