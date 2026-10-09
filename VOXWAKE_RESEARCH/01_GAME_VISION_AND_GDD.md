# 01 — GAME VISION AND GDD (VOXWAKE, provisional title)

> **Package:** `VOXWAKE_RESEARCH/` file 1 of 8. Written 2026-10-07 for hand-off to Claude Opus 5.5.
> **Canonical owner of:** game identity, pillars, engagement design, mode flows, level roster, feature priorities (P0/P1/P2), acceptance checklist.
> **Defers to:** `02` for the canonical decision table (CD-xx) and code structure · `03` for speech + scoring · `04` for netcode + AI · `05` art · `06` physics numbers · `07` UI/audio · `08` build/test plan.
> **Label key used in all 8 files:** **[VERIFIED]** = confirmed in official docs/registries on 2026-10-07 (URL given) · **[PROPOSED]** = research-backed recommendation · **[CREATIVE]** = original design proposal · **[UNVERIFIED]** = could not be confirmed; validation test given · **[ASSUMPTION]** = needs the user's confirmation.

---

## 0. What the user asked for (restated so Opus never loses it)

1. A **3D** boat-racing game that is **interesting**, hits **dopamine**, and makes the player think *"this is level 1 — I must play level 2"*, so they keep playing "forever".
2. **Exactly two modes:**
   - **Championship** — 1 human + **4 AI bots** racing.
   - **Voice Duel** — a friend joins from **their own laptop** via **QR code** *or* **short room code** (link also provided) and races competitively.
3. **Wispr Flow must be the star.** Judges will look at *how efficiently and creatively Wispr Flow is used*. The user says a first version of this idea already exists; this package **enhances** it.
4. Visual reference: four screenshots of the Hacker House Goa site (stored in `reference_images/`, analysed in `05`).

Everything below serves those four points. **[ASSUMPTION A1]** The user's statement that "judges evaluate Wispr Flow usage" is taken as given; none of the screenshots establish judging criteria (see `05 §2`).

---

## 1. Executive summary

**VOXWAKE** is a stylised 3D arcade boat race through a love-letter version of Goa — beach shacks, Portuguese-era balconies, market canals, ferries, monsoon rivers, fort coastlines. The boat has **no throttle pedal. Your voice is the engine.** Sentences appear on a hanging Goan sign above the water; you **hold your Wispr Flow key, say a phrase, release** — and the text Wispr Flow produces lands in the game, is matched against the sentence, and *throws your boat forward*. Accurate, rhythmic speech builds a **Flow State**; sloppy speech lets your wake die.

Wispr Flow is not a bolt-on speech API here. The game is **designed around how Wispr Flow actually behaves** (hold-to-talk bursts, auto-cleanup of fillers and self-corrections, auto-punctuation, snippets, personal dictionary, paste-last-transcript, hands-free mode, Command Mode): every one of those features becomes a visible mechanic or a visible setup step (§6). A built-in **Flow Stats** panel shows judges, live, how many words were dictated vs typed and how much time Flow saved.

Two modes only: **Championship** (12 hand-built Goa levels → unlimited *Endless Tide*) and **Voice Duel** (1-v-1 over the internet, QR/code join).

---

## 2. Identity and naming

| Option | Notes |
|---|---|
| **VOXWAKE** (working title) | "Voice" + "boat wake". Short, brandable. Keep as provisional. |
| Konkan Flow Regatta | Strong Goa sense; long. |
| Susegad Sprint | "Susegad" = relaxed Goan contentment — nice irony for a frantic race. |
| Tide Talkers | Friendly, explains the idea. |
| Wake & Say | Playful, verb-led. |

**Rules:** do **not** put "Wispr" in the title or logo (trademark / implied endorsement). Credit it in the Flow Setup screen as "Works best with Wispr Flow" **[ASSUMPTION A2: user decides whether to display Hacker House / 2:47 PM Studio credit; do not use their logos without permission]**.

Tagline candidates: *"Speak. Surge. Win."* · *"Your voice is the engine."* · *"Say it like you mean it."*

---

## 3. Design pillars

| # | Pillar | What it forces |
|---|---|---|
| P1 | **Voice is the engine** | Dictation drives speed. No quiz gameplay, no multiple choice. |
| P2 | **One more race** | Races are 45–120 s; restart is one click or one spoken phrase; every result screen ends with a hook into the next race (§5). |
| P3 | **Flow-native, not Flow-adjacent** | Every Wispr Flow feature we can verify is turned into a mechanic, a setup step, or a recovery path (§6). |
| P4 | **Goa, specifically** | Real places, architecture, foods, words (§8, `05`). |
| P5 | **Fair and honest** | AI never cheats; speech-recognition errors are never punished like player errors; Duel is deterministic and server-checked (`03`, `04`). |
| P6 | **Always playable** | Core game runs with zero external assets, zero API keys, zero backend (Championship). Every fancy dependency has a fallback (`08`). |

---

## 4. Target audience

- **Primary:** hackathon judges and attendees (Goa, 28–31 Oct 2026 per the event hero screenshot) — 3-minute demo attention span; laptops, Windows + Mac, Chrome/Edge, noisy venue.
- **Secondary:** students/professionals who want fun English-fluency practice; Wispr Flow users; casual racing fans.
- **Constraint:** players need a desktop browser and (ideally) Wispr Flow installed. A **Browser-speech fallback** and a **keyboard-assist** mode make the game playable without it (`03 §3`).

---

## 5. Engagement architecture ("the dopamine engine") — **canonical owner**

This is the section Opus must treat as a requirement, not decoration.

### 5.1 The compulsion loop (nested loops)

```
MICRO  (0.5–3 s)   say stroke → word-by-word pops + rising note → boat surges
STAGE  (3–9 s)     finish sentence → streak/chunk bonus → power-up charge earned
RACE   (45–120 s)  overtake rivals → Final Sprint → photo-finish → results
META   (minutes)   XP + stars + unlocks + new Goa place teased  → "next level" auto-queued
LONG   (days)      Captain Rank, boat/cosmetic collection, Word Log, Rival grudges, Daily Regatta, Endless Tide
```

### 5.2 Concrete mechanisms **[CREATIVE, P-levels in §20]**

| Mechanism | Design | Why it keeps people playing |
|---|---|---|
| **Instant reward (P0)** | First race starts ≤ 60 s from page load; first word-pop within ≤ 10 s of race start. | Time-to-first-reward is the #1 retention lever. |
| **Per-word juice (P0)** | Every credited word: sign-text flashes magenta→yellow, scale pop (1.0→1.18→1.0 in 120 ms), pentatonic note one step higher than the previous word in the stroke, a spray puff at the stern. | Rising pitch ladder = audible progress. |
| **Stroke surge (P0)** | A finished stroke visibly kicks the boat (FOV +4°, speed lines, wake widens). | Voice → physical consequence, instantly. |
| **Flow State meter (P0)** | Clean strokes fill a magenta/yellow ring; full ring = 8 s **FLOW STATE** (×1.5 score, +10 % speed, screen-edge glow, boat trail). | A visible "zone" players chase; ties to the product name legitimately (generic phrase, no endorsement claim). |
| **Streak multiplier ladder (P0)** | ×1.0 → ×2.0 over 10 clean strokes with callouts: *SMOOTH → ON FIRE → UNSTOPPABLE*. | Loss-aversion on the streak keeps focus high. |
| **Variable rewards (P0)** | Bonus Phrase Gates and **Tiffin Crates** (cosmetic drops) use weighted RNG **plus a pity counter** (guaranteed rare after N crates). | Variable-ratio rewards sustain play; pity prevents frustration. |
| **Goal gradient (P0)** | Every screen shows "next unlock in N XP" and a 3-star pip row per level. | People accelerate when close to a goal. |
| **Cliff-hanger (P0)** | Results screen shows a 3-s teaser of the *next* course (sunset, storm, ferry) and the new mechanic it adds, auto-queued with a 5-s "Next race" timer (Enter / `vox again`). | Makes "play level 2" the default action. |
| **Near-miss + photo finish (P0)** | If a rival finishes within 0.6 s: slow-mo photo finish, "SO CLOSE!" and a one-tap **Rematch (R / `vox again`)**. | Near-misses are the strongest "again" trigger. |
| **Rival nemesis system (P1)** | Each of 4 rivals remembers W/L vs you; commentary references it; beating your nemesis grants a "Grudge Settled" crate. | Narrative + stakes without extra content. |
| **Ghost of your best run (P1)** | Translucent ghost boat for your PB on that level (store stroke timeline, replay deterministically). | Self-competition = infinite replay. |
| **Rival Heat (P0)** | Player picks *Chill / Standard / Hot* per race (AI skill −0.08 / 0 / +0.08; XP ×0.8 / ×1 / ×1.3). | Keeps challenge in the "flow channel"; the AI never cheats mid-race. |
| **Endless Tide (P0, inside Championship)** | After L12 (and unlocked early at L3), seed-generated levels 13+ with escalating modifiers, a *Tide Score* leaderboard (local). | Literally "play forever". |
| **Daily Regatta (P1, inside Championship)** | One seeded race per UTC day, same sentences for everyone; local streak calendar. | Daily return habit. |
| **Word Log / Fluency Rating (P1)** | Collection of words you mastered; trend line of accuracy and pace. | Mastery fantasy; also real practice value. |
| **Commentary (P0 text, P2 audio)** | Event-driven lines with cooldowns, Goan flavour ("Susegad? Not today!"). | Personality, humour, replay variety. |

### 5.3 Pacing targets (testable)

| Metric | Target |
|---|---|
| Page load → Level 1 countdown (returning player) | ≤ 20 s; first-time incl. Flow Setup ≤ 60 s (skippable) |
| Race length | L1–3: 45–65 s · L4–8: 70–100 s · L9–12: 90–130 s · Endless: ≤ 150 s |
| Result → next race start | ≤ 8 s with defaults |
| Reward event density | ≥ 1 notable positive event (word pop, callout, overtake, pickup, power-up) every ≤ 2.5 s |
| New thing per level | Every level introduces exactly one new mechanic, hazard, rival trick or place (table §11) |

### 5.4 Healthy-engagement guardrails **[PROPOSED]**
No real-money purchases, no loot-box spending, no countdown pressure tied to loss of owned items, no dark-pattern "streak guilt" screens. Add an **optional** "Take a breath" prompt after 45 min of play (default ON, dismissible, one line) — also protects voices.

---

## 6. Wispr Flow as the star — feature-to-mechanic map **(summary; canonical detail in `03 §2`)**

Everything marked **[VERIFIED]** below was read on 2026-10-07 from the sources listed in `03 §1`.

| Wispr Flow capability | Verified? | VOXWAKE mechanic | Pri |
|---|---|---|---|
| Hold-to-talk hotkey, text arrives **after release** as one burst (Win default **Ctrl+Win**, Mac **Fn**) | [VERIFIED hotkeys] / [UNVERIFIED timing & insertion method] | **Stroke rhythm**: sentence split into 2–4 strokes; each hold-speak-release = one stroke; **Cadence** meter rewards steady rhythm | P0 |
| Auto-removes fillers, handles self-correction ("Tuesday, wait no, Friday" → "Friday"), auto-punctuation | [VERIFIED by secondary source] | **Tolerant matcher** + UI copy "Stumble freely — Flow cleans your wake"; no penalty for fillers | P0 |
| **Snippets** (trigger ≤ 60 chars → expansion ≤ 4000 chars) | [VERIFIED by secondary source] | **Voice Shortcuts**: saying "vox nitro" expands to a sentinel token `[[nitro]]` → fires Nitro, collision-proof vs sentence text | P0 (fallback: mouse / spoken words) |
| **Personal Dictionary** | [VERIFIED by secondary source] | **Goa Dictionary Pack** (Mapusa, Panjim, Bebinca, Xacuti, Susegad…) copy-list in setup; **Pit Stop** screen lists words the recogniser fumbled with a one-click copy | P1 (list screen P0-lite) |
| **Paste last transcript** (Win **Shift+Alt+Z**, Mac **Cmd+Ctrl+V**) | [VERIFIED] | **Lost-Wake Recovery**: if the game window lost focus when text arrived, show the key combo to re-insert; never lose a stroke | P0 |
| **Cancel = Escape** | [VERIFIED] | Game **never binds Esc** (pause = F1); documented in setup | P0 |
| **Hands-free** (Win **Ctrl+Win+Space**, Mac **Fn+Space**) | [VERIFIED hotkey] | **Long Haul** stages (long sentences) recommend hands-free; matcher accepts multi-stroke bursts | P1 |
| **Whisper Mode** | [VERIFIED by secondary source] | **Quiet-room Duel** guidance; venue noise strategy in `08` demo checklist | P1 |
| **Command Mode** (Win **Ctrl+Win+Alt**; select text, speak an edit instruction) — Pro feature per secondary source | [VERIFIED by secondary source] | **Rewrite Gate**: a messy sentence is selected; player says "fix the grammar" and Flow rewrites it; game validates structurally | P2 |
| Hinglish model, 100+ languages | [VERIFIED by secondary source] | Optional **Hinglish Pack** of Goa-flavoured sentences | P2 |
| **Flow Voice Interface API** (WebSocket, 16 kHz PCM, client tokens) — **exclusive access, org approval required** | [VERIFIED] | Optional `FlowApiProvider` behind env flag; **never required** | P2 |
| *(game-side)* **Flow Stats** panel: words dictated vs typed, bursts, avg WPM, "time saved vs typing at 40 WPM" | [CREATIVE] | Shown on results + `?judge=1` overlay so judges *see* Flow's contribution | **P0** |
| *(game-side)* **Flow Lens** timeline: hold → speak → text arrives → aligned words → surge | [CREATIVE] | Debug/judge overlay explaining the pipeline live | P1 |

**Design stance:** if Flow is absent, the game still works (Browser speech → Keyboard assist), but **the experience is tuned for Flow bursts**, and the Setup screen shows what the player is missing.

---

## 7. Core gameplay loop

```
SEE THE SENTENCE → SPEAK IT (hold Flow key, say a stroke, release)
 → TEXT ARRIVES → ALIGNED & SCORED → THROTTLE UP → BOAT SURGES
 → STEER (mouse) THROUGH CASHEW TRAILS / AROUND HAZARDS
 → OVERTAKE RIVALS → EARN POWER-UPS (Nitro/Shield/Wave Jump) → FINAL SPRINT → FINISH
```

The player's time split target: **~65 % dictating, ~25 % steering/dodging, ~10 % power-up decisions.** Bonus Phrase Gates are optional and occur ≤ 3 per race.

### 7.1 Sentence → Stroke model (terminology used everywhere)

- **Stage** = one target sentence on the sign.
- **Stroke** = a 2–6-word *chunk* of the sentence; the sign highlights the *current stroke*.
- **Burst** = one text delivery from the speech provider (Flow = one burst per hold/release).
- A burst may cover part of a stroke, exactly one, or spill into the next stroke(s) (hands-free). Matching rules: `03 §5`.
- A **race** = an ordered list of **stages**; the finish line is the course end; stage count per level §11.

---

## 8. Mode A — Championship (1 human + 4 AI)

### 8.1 Structure
- **12 authored levels** along an imaginary north→south Goa coast tour (§11) + **Endless Tide** (13+) + **Daily Regatta** — all inside this one mode.
- **5 boats per race**: human + the 4 permanent rivals (§9).
- Progress map = the **coast signpost** (reference image 02 composition): arrow signs for levels, 3-star pips, locked signs rattle.
- **Unlock rules** (numbers in `06 §12`): top-3 finish unlocks the next level; Endless Tide unlocks after **L3**; Daily Regatta after **L3**.
- **Losing still pays**: XP is awarded for every race; the results screen shows *what cost you time* (slowest stroke, missed words, hazards hit) and a one-key retry.

### 8.2 Race flow
1. **Pre-race card** (≤ 5 s): course name, rival line-up, Heat selector, best time/ghost.
2. **Start sequence**: 3-2-1 with "GO" word that the player can *say* (Flow-friendly) — no gate, purely theatrical.
3. **Stages** progress (sentence changes with a stamp-slam animation).
4. **Checkpoints/Bonus Gates** at ≈ 25 / 55 / 80 % (`06 §10`).
5. **Final Sprint** (last 20 % of course): a "Final Sprint" banner, score ×1.25, music modulates, rival closers (Susegad) get their kick.
6. **Finish**: photo-finish slow-mo if margin < 0.6 s; podium; results (§17).

### 8.3 Championship AI summary (full spec `04 §1.1–1.9`)
Four personalities with deterministic seeded behaviour, same dynamics as the player, **no rubber-banding, no knowledge of player state**.

---

## 9. The four rivals **[CREATIVE]**

| Rival | Boat | Style | Behaviour sketch | Voice line sample |
|---|---|---|---|---|
| **Captain Caju** | Red shack-speedboat | **Sprinter** | +25 % pace first 40 %, −15 % last 40 %, −0.04 accuracy | "Cashew crunch, baby!" |
| **Maria Bebinca** | Cream spice dhow | **Metronome** | Very low variance, +0.04 accuracy, −8 % pace, saves Nitro | "Slow and layered wins." |
| **Vindaloo Vasco** | Orange twin-hull | **Aggressor** | Uses Nitro immediately, hunts pickups, hits hazards 1.5× | "Too hot for you!" |
| **Shack Sensei Susegad** | Teal canoe | **Closer** | −15 % pace first 50 %, +20 % last 25 %, hoards Shield | "No hurry… yet." |

(Names are fictional; the food puns are affectionate. No real persons. **[ASSUMPTION A3]** user is comfortable with the puns.)

---

## 10. Mode B — Voice Duel (two real players)

### 10.1 Flow of play
```
HOST: [Voice Duel] → Create Room → shows QR + 5-char code + link + Copy
FRIEND (own laptop): opens link  ─OR─  [Join] → tab "Scan QR" (webcam) / tab "Enter code"
BOTH: Lobby → pick boat → Flow check (mic test) → Ready
SERVER: synchronised 3-2-1 → Race (same course, same sentences, same hazards)
END:   Results → Rematch (same room, new seed) / Best-of-3 / Leave
```

### 10.2 Rules
- Same course, same sentence sequence (seeded), same gate positions; each player progresses at **their own pace** (no lock-step), boats race side by side **without collision** (ghost-pass) to avoid netcode pain.
- Same scoring/throttle rules as Championship; **server revalidates every stroke** (`04 §2.5`).
- **Duel-only extras:** live opponent progress bar + position badge; "Photo-finish reveal" cutscene for both screens; **Rematch Reveal**: loser's boat gets a *"REVENGE?"* sign; both press Ready within 20 s.
- Course/level choice: host picks one of **6 Duel courses** (re-skins of L1, L3, L5, L8, L10, L12 themes) a **Sentence Tier** (Easy/Medium/Hard) and a **Length** (Sprint = 65 % course length / Classic = 100 %) — *not* a new mode.
- **Fairness:** equal content; no AI; no rubber-banding; power-ups identical; Disruptive power-ups are **P2** and off by default.
- **Honest limitation:** Flow inserts text into the browser; the game cannot prove the text was *spoken* rather than typed. Mitigations in `03 §12` and `04 §2.12` (plausibility checks + optional mic-presence witness). Duel is honour-based with anomaly flags — documented, never hidden.

### 10.3 Join UX requirements (both options mandatory)
| Option | Behaviour |
|---|---|
| **QR** | Host screen renders a QR encoding `PUBLIC_BASE_URL/?join=CODE`. Friend's **laptop** opens *Join → Scan QR* and uses its webcam (BarcodeDetector if available, `jsqr` fallback). A phone scan simply opens the same link (works too). |
| **Code** | 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L); big mono display; paste or type. |
| **Link** | Copy button; the same URL as in the QR. |

---

## 11. Level roster and course progression **[CREATIVE + PROPOSED]**

| L | Place (stylised) | Time/weather | New thing introduced | Expected stages† | Words/stage | Rival base skill* |
|---|---|---|---|---|---|---|
| 1 | **Baga Shack Sprint** — beach shacks, turquoise sea | Morning, clear | Core loop, Caju (cashew) trails, steering | 12 | 4–6 | 0.25 |
| 2 | **Chapora Fort Run** — river mouth, hill fort ruin | Late morning | Buoys, **Shield** earned | 12 | 5–7 | 0.31 |
| 3 | **Mapusa Market Canal** — stalls, bunting, baskets | Midday | **Bonus Phrase Gate**; unlocks Endless/Daily | 13 | 6–8 | 0.37 |
| 4 | **Anjuna Golden Hour** — piers, flea-market lights | Golden hour | Drifting logs, **Wave Jump ramps** | 13 | 7–9 | 0.43 |
| 5 | **Fontainhas Colour Lanes** — azulejo, balconies | Afternoon | **Fork shortcut** (needs Wave Jump) | 14 | 8–10 | 0.49 |
| 6 | **Divar Ferry Crossing** — Ro-Ro ferries | Overcast | **Moving hazards** (ferries) | 14 | 8–11 | 0.55 |
| 7 | **Old Goa Mist** — white churches, river mist | Dawn mist | Reduced visibility, bigger vocab | 15 | 9–12 | 0.61 |
| 8 | **Monsoon Mandovi** — rain, swell | Storm | **Wind gusts** push boat laterally | 15 | 10–13 | 0.67 |
| 9 | **Dudhsagar Gorge** — jungle, waterfalls | Bright, spray | Narrow corridor, **Long Haul** stage | 16 | 10–14 | 0.73 |
| 10 | **Zuari Night Regatta** — bridge lights | Night | Glow hazards, fireworks | 16 | 11–15 | 0.79 |
| 11 | **Palolem Festival** — bunting, crowds, fireworks | Dusk | **Tongue Tangle** stage | 17 | 12–16 | 0.85 |
| 12 | **Cabo de Rama Finale** — cliffs, fort, swell | Sunset after storm | Everything combined; 3-leg final | 18 | 12–18 | 0.90 |
| 13+ | **Endless Tide** | cycles through the 12 looks | seeded modifiers (+1 per 3 levels): gusts, fog, double-ferry, shorter timers on bonus gates | 14–20 | up to 22 | min(0.98, 0.90 + 0.01·k) |

\*Base skill s ∈ [0,1] feeds `04 §1.3`. †Expected stages = sentences a normal player finishes in the race (a race is ~50–125 s of near-continuous dictation); content is generated with +3 spare stages. Course lengths, par times and speed numbers: **`06 §11` (canonical)**.

---

## 12. Sentence-dictation gameplay (summary; canonical `03`)

- Sentences are **original** (no copyrighted text), Goa-themed and general English, tiered by length, lexical difficulty, numerals, Goan vocabulary ratio (0 → 25 %).
- **Content bank target:** ≥ 360 sentences (30 per level tier) + 60 bonus phrases + 20 tongue-twisters; authored as JSON, linted (`03 §9`).
- Players are never punished for recogniser errors: **ASR Mercy**, retry-without-penalty, homophone tables, number/contraction normalisation (`03 §6`).
- **Speed is not the only factor**: accuracy weighs most; pace modifies ±15 %.

---

## 13. Difficulty progression

| Axis | L1 → L12 → Endless |
|---|---|
| Sentence length | 4–6 → 12–18 → ≤ 22 words |
| Lexical difficulty | common words → Goan terms, numerals, tongue-twisters |
| Rival skill | 0.25 → 0.90 → ≤ 0.98 |
| Throttle decay rate k (momentum loss when silent) | 0.20/s → 0.31/s (exponential) |
| Hazard density | 1 per 120 m → 1 per 45 m |
| Expected stages per race | 12 → 18 |
| New mechanics | one per level (table §11) |
| Player-controlled | Rival Heat (Chill/Standard/Hot), Sentence Tier (Duel), Assist options |

---

## 14. Power-ups (summary; canonical rules `06 §9`)

| Power-up | Earn | Use | Duration/CD | Max stored |
|---|---|---|---|---|
| **Nitro Burst** | Stage accuracy ≥ 90 % | LMB / `vox nitro` | 3.0 s / 4 s | 2 |
| **Shield** | 4 clean strokes in a row | Automatic on hazard hit | until consumed | 1 |
| **Wave Jump** | Bonus Phrase Gate success | RMB / `vox jump` at a ramp or hazard | 1.2 s air / 3 s | 1 |
| **Flow State** | Meter full (from clean strokes) | Automatic | 8 s | — |
| *(P2)* Foghorn | Duel only, off by default | Blurs opponent sign 2 s | — | — |

Control for every power-up has a **non-voice fallback** and **never** relies on an unguarded common word (`03 §8`).

---

## 15. Bonus Phrase Gates **[PROPOSED]**
An arch over the water at ≈ 25/55/80 % shows a **3–5-word phrase** on a small second sign from 110 m before the arch until you pass it (≈ 4–9 s). Steer through the arch *and* say the phrase; success = power-up (weighted: Nitro 45 %, Wave Jump 40 %, Shield 15 %; full-stock re-roll rules in `06 §10`). **Failure costs nothing** and the main sentence is never paused. Routing rule when both signs could match a burst: `03 §8.4`.

---

## 16. Boats, roster, customisation

| Boat | Silhouette | Stats (±) | Unlock |
|---|---|---|---|
| **Fisher's Canoe** | slim dugout, painted bow eyes | Turn +5 %, Speed −3 % | Start |
| **Shack Runner** | speedboat with thatched roof | Speed +4 % | Rank 2 |
| **Mandovi Ferry Mini** | chunky, stable | Hazard slowdown −15 % | Rank 4 |
| **Spice Dhow** | single lateen sail | Nitro duration +10 % | Rank 6 |
| **Casino Catamaran** | twin hull, string lights | Shield recharge pity −1 stroke | Rank 9 |

Stat deltas are deliberately tiny (±5 %): cosmetics > power. **Customisation** (all free, all earned): hull paint (palette from `05 §4`), azulejo decals, bunting flags, horn sounds, wake colours (Mango, Magenta Foam, Lagoon), name plate. Rivals keep their own boats; if the player owns the same hull, rival gets a recoloured variant.

---

## 17. Rewards and results

- **XP**, **Captain Rank**, **Stars (0–3)** per level, **Tiffin Crates** (cosmetics), **Word Log** entries, **Rival grudge** progress. Formulas: `06 §12`.
- **Results screen** (UX in `07 §11`): placement, time, score, accuracy, longest streak, **Flow Stats**, "What cost you time", Pit Stop (misheard words → copy to Flow dictionary), next-level teaser, `Race again` / `Next level` / `Menu`.

---

## 18. UI/HUD and audio requirements (summary; canonical `07`)

HUD = **hanging sign** (sentence) + stroke highlight + live burst text + streak/Flow ring + power-up chips (as arrow signs) + position badge + minimap strip + speed lines. Audio: procedural WebAudio music stems that intensify with streak/Flow State; pentatonic word ticks; wake/engine layers; stingers; text commentary (audio commentary P2). Accessibility: colour-blind-safe, reduced motion, large text, keyboard assist.

---

## 19. Replayability
Endless Tide · Daily Regatta · ghosts · 3-star mastery · Rival Heat · cosmetic collection · Word Log · Duel rematch / best-of-3 · seeded content variety (360+ sentences, per-race shuffle without repeats within a session).

---

## 20. MVP vs stretch (priority register — canonical)

| Pri | Features |
|---|---|
| **P0 (playable, demo-ready)** | Championship L1–L6 + Endless Tide basic; 4 AI rivals (`04`); **FlowDeck + stroke matching + scoring** (`03`); Browser-speech + Keyboard fallbacks; Flow Setup wizard (detect, hotkey card, snippets copy list); Voice shortcuts (snippets + spoken + mouse); Flow Stats panel; Lost-Wake Recovery; Nitro/Shield/Wave Jump + Flow State; Bonus Gates; Voice Duel (create/join via QR + code + link, lobby, synced race, results, rematch); procedural Goa kit with toon + outline look; water + wake; HUD; procedural audio; settings + accessibility basics; local save; tests + perf budget (`08`) |
| **P1 (polish/differentiation)** | L7–L12; Daily Regatta; ghosts; nemesis lines; Word Log + Fluency chart; Pit Stop copy-to-dictionary; Long Haul/hands-free stage; Flow Lens overlay; Tiffin Crates + cosmetics; Blender `.glb` replacements; photo-finish cinematic; commentary variety; best-of-3 Duel |
| **P2 (stretch)** | Rewrite Gate (Command Mode); Flow API provider; Hinglish pack; Foghorn disruptor; audio commentary; share-card PNG; gamepad steering; mobile layout |

---

## 21. Explicit non-goals
No third mode · no open world · no fluid/destruction sim · no pay-to-win/monetisation · no pronunciation scoring claims · no multiple-choice quiz gameplay · no dependence on Flow API access · no use of hackathon logos/assets without permission · no mobile-first UI in MVP.

---

## 22. Feature acceptance checklist (GDD level; test IDs live in `08 §9`)

- [ ] Exactly two top-level modes appear in the main menu.
- [ ] Championship race has 1 human + 4 AI with distinct visible behaviour.
- [ ] A full race is completable using only **FlowDeck bursts** (simulated by the mock provider) + mouse.
- [ ] Wispr Flow-style bursts (final-only, multi-word, punctuated) are matched correctly; fillers/capitalisation/punctuation never cause failure.
- [ ] Commands never trigger from sentence text; sentences never absorb commands.
- [ ] Power-ups are earned only via the specified explicit conditions.
- [ ] AI never uses information the player lacks; no rubber-banding (automated test).
- [ ] Voice Duel: QR **and** code **and** link join; lobby; synchronised start (≤ 150 ms skew in test); same sentences; rematch; disconnect/reconnect handled.
- [ ] Results screen shows Flow Stats and next-level teaser; Enter/`vox again` starts the next race ≤ 8 s.
- [ ] Game starts and is playable with no API keys and no Blender assets.
- [ ] Goa identity visible in every level (named place, architecture, palette).
- [ ] Performance budget met on the reference machine (`08 §11`).
