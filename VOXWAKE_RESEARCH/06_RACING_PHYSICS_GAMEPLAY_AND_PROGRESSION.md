# 06 — RACING PHYSICS, GAMEPLAY AND PROGRESSION

> **Canonical owner of:** movement model (CD-04), **throttle/speed mapping**, steering, hazards & collisions, **power-up rules**, bonus gates, **level table (stages, lengths, par times)**, difficulty scaling, rewards/XP/stars/unlocks, results, tuning index.
> Obeys `02 §0`. Scoring formulas: `03 §7`. Bot behaviour: `04 §1.1–1.9`. Art/VFX: `05`. UI: `07`.
> All numbers are **initial tunables** in `packages/shared/config/*.json` **[PROPOSED]**; the headless sim in `08 §9` must confirm the pacing claims (par times, win rates) and Opus re-tunes if they miss. Labels as in other files.

---

## 1. Movement-model decision (CD-04)

| Option | Verdict | Why |
|---|---|---|
| Lane-based runner (3–5 fixed lanes) | **Rejected** | Feels like a runner skin; hides the water; the master prompt warns against lanes "merely because another runner game uses it". |
| Full rigid-body boat physics | **Rejected** | Wobbly, hard to tune, non-deterministic across clients, expensive for 5 boats + netcode. |
| **Spline-rail + free lateral steering** | **CHOSEN** | Forward progress `s` (a scalar) is driven by throttle ⇒ **deterministic, trivially replicated, cheap for AI**, and *voice = speed* is unmistakable. The player keeps one hand for the Flow key and one for the mouse to steer freely across a corridor, dodge hazards and line up pickups. |

**State model:** `BoatState { s, v, T (throttle), lat, latV, yaw, flags… }`. The **longitudinal part** (`s, v, T`, power-ups, hazard effects) is the shared deterministic sim (`SIM_HZ = 30`). **Lateral** (`lat`, `yaw`) is player input (client) or bot steering, bounded by the corridor and a max lateral speed.

---

## 2. Course representation

- **Centre-line:** Catmull-Rom spline through authored control points (per level in `levels.json`), pre-sampled every **1 m** into `CourseSample{ s, pos, tangent, normal, halfWidth, curvature, bankL, bankR }`. Max curvature 0.02 rad/m (radius ≥ 50 m).
- **Corridor:** playable lateral range `lat ∈ [−(halfWidth − 1.2), +(halfWidth − 1.2)]` (boat half-width 1.1 m + 0.1 margin). Half-widths: L1 **16 m** → L9 **7 m** (gorge) → L12 **11 m**.
- **World position:** `P(s) + N(s) · lat`.
- **Placement data** (deterministic from `(levelId, seed)`): hazards `{type, s, lat, r}`, pickups (arcs), ramps, **gates**, forks/shortcuts, squall/gust zones, ferry crossing timers, scenery chunk list.
- **Placement rules (validated by `CourseBuilder` tests):**
  - No hazards in the first **90 m** or the last **40 m**.
  - Hazard density (average): L1 1 per **120 m** → L12 1 per **45 m**; min gap between any two hazards along `s`: 18 m (L1) → 9 m (L12).
  - A free passage of **≥ 5.5 m** must exist at every `s` (boat width 2.2 m + margin); ferries leave a **timed** gap of ≥ 3 s.
  - Pickup arcs follow an "ideal line" that avoids hazards; 5–9 cashews each; arc every ~60 m.
  - Ramps only from L4; every ramp is followed by a **Jump Section** (§6.3).
  - Gates never overlap hazards within ±30 m.
- **Streaming:** build all data up-front; render chunks within `s ± 220 m`.

---

## 3. THROTTLE AND SPEED MODEL (canonical)

### 3.1 Variables
`T ∈ [0,1]` throttle · `v` speed (m/s) · `L` level number · `k` decay · `g` gain.

### 3.2 Per-level parameters
```
decay k(L)      = 0.20 + 0.01 × (L − 1)           (L12 = 0.31)         Endless: min(0.40, 0.31 + 0.005 × depth)
gainPerWord(L)  = 0.08 − 0.0025 × (L − 1)          (L12 = 0.0525)       Endless: max(0.045, 0.0525 − 0.001 × depth)
vMin = 6.0 m/s (coast)    vMax = 26.0 m/s    γ = 0.85
a_up = 9.0 m/s²   a_down = 5.0 m/s²
```
### 3.3 Sentence completion → acceleration mapping
On every accepted stroke (`StrokeResult` from `03 §7.7`):
```
strokeGain  = gainPerWord(L) × Σcredit_i × (A ≥ 0.90 ? 1.15 : 1.00) × (isRetry ? 0.60 : 1.00)
T          ← min(1.0, T + strokeGain)
stageDone  → T ← min(1.0, T + 0.04)          // tiny "sentence complete" kick
flawless stage → +0.04 more
launch bonus: first clean stroke within 2.5 s after GO → T += 0.20 (once)
```
Every sim tick:
```
if (nitroActive) { T ← max(T, 0.85) } else { T ← T × exp(−k × dt) }          // dt = 1/30
vTarget = ( vMin + (vMax − vMin) × T^γ ) × M
   M = (nitro ? 1.35 : 1) × (flowState ? 1.10 : 1) × hazardSlowMul × scrapeMul
v ← v + clamp(vTarget − v, −a_down×dt, +a_up×dt)
s ← s + v × dt
```
- Race start: `v = 0` at GO; boat accelerates to `vMin` (coasting) in ~0.7 s even with `T = 0` so a late speaker isn't dead in the water.
- `T` decays continuously ⇒ **silence = slowdown**, steady dictation = high plateau.

### 3.4 Error and correction penalties (never harsh; recogniser errors aren't punished — `03 §6`)
| Event | Effect on `T` | Other |
|---|---|---|
| Stroke accuracy ≥ 0.75 (pass) | gain per formula | missed words just earn 0 |
| Failed stroke (< 0.75), first attempt | **no gain, no extra loss** | stroke stays open (Second Wind); streak preserved until retry fails/skip |
| Retry attempt | gain × 0.60 | score × 0.8 |
| Skip stroke (`[[skip]]`/button/12 s stall) | **−0.05** | streak reset; Flow meter −0.15 |
| Empty/garbage burst | none | ignored |
| Hazard hit (no shield) | **−0.08 … −0.15** per hazard type (§7) | speed multiplier dip; Flow meter −0.10 |
| Bank scrape | none | `scrapeMul = 0.9` for 0.3 s |

### 3.5 Expected pacing (sanity table; verified by the sim, `08 §9` PH-03)
Steady-state peak `T_p = g / (1 − e^{−kτ})`, where `g` = stroke gain and `τ` = mean burst interval. Example (3-word clean strokes at target pace): **L1**: g = 0.276, kτ = 0.38 → **T_p ≈ 0.79**, mean `T ≈ 0.64` → mean `v ≈ 19.7 m/s` → **1000 m in ≈ 52–56 s** ✔. **L12**: g(4 words) = 0.242, kτ = 0.46 → T_p ≈ 0.65, mean T ≈ 0.52 → mean v ≈ 17.5 m/s (+ Nitro/Flow State) → **2350 m in ≈ 120–128 s** ✔. Excellent players saturate `T → 1.0` (v up to 26 m/s, 35 m/s with Nitro); casual players plateau around `T ≈ 0.3–0.45` (v ≈ 11–15 m/s).

---

## 4. Boat dynamics, inertia and water interaction (approximation)

| Aspect | Model |
|---|---|
| **Longitudinal inertia** | Speed ramps with `a_up/a_down` (§3.3): fast to build, slower to lose ⇒ boat "carries" momentum between strokes. |
| **Lateral inertia** | `latV` follows a critically-damped spring toward `latTarget` (τ = 0.25 s), limited to `maxLatSpeed = 7.0 m/s` and `latAccel = 28 m/s²`. |
| **Yaw** | `yaw = atan2(latV, v) × 0.9` + tangent heading; smoothed. |
| **Bank scrape** | If `|lat|` would exceed the limit: clamp, spawn sparks, `scrapeMul 0.9` for 0.3 s, no T loss. |
| **Water interaction (visual only)** | Sample the water shader's wave function at the boat position → heave (`y`), pitch (from acceleration), roll (from lateral accel); amplitude scales with `uSwell`. Gameplay does **not** depend on waves except **L8 swell** which applies a periodic ± lateral nudge of 0.6 m (deterministic by `s`). |
| **Wakes/spray** | `05 §7`; driven by `v` and `T`. |

**Determinism boundary:** `s, v, T` + power-ups + hazard effects are deterministic from events; lateral/yaw and heave/pitch are presentation (Duel: lateral client-reported, `04 §2.5`).

---

## 5. Steering (inputs and assists)

### 5.1 Mouse (default, CD-08)
```
mx = (pointerX − canvasCenterX) / (canvasWidth / 2)         // −1..1, deadzone 0.04
latTarget = clamp( mx × sensitivity × halfWidth , ±(halfWidth − 1.2) )     // sensitivity 0.5–1.5, default 1.0
```
Pointer position is read even though the FlowDeck textarea has focus (window-level `pointermove`). When the pointer leaves the window, hold the last value. Right-click `contextmenu` suppressed on the canvas.
### 5.2 Keyboard alternative
←/→ move `latTarget` at 9 m/s with easing; ↑ Nitro; ↓ Wave Jump. Offered only when the player confirmed a non-Win/non-Fn Flow hotkey in setup (`03 §2.4`).
### 5.3 Steering assist (Settings → Accessibility)
| Level | Behaviour | Star eligibility |
|---|---|---|
| Off | none | ★★★ allowed |
| **Light** (default for first 3 races) | gentle magnet (≤ 1.0 m) toward the ideal line; bank scrape avoided | ★★★ allowed |
| Strong | auto-avoids hazards with ≤ 1.5 m nudges; wide magnet | ★★★ disabled |

`maxLatSpeed` is **identical** for player and bots (fairness).

---

## 6. Jump mechanics, wakes and the Jump Section

### 6.1 Wave Jump (power-up `§9.3`)
- **At a ramp** (trigger zone `[s_r − 6 m, s_r + 2 m]`): with a charge, **RMB / ↓ / `vox jump`** launches: **air time 1.2 s**, apex 3.5 m, hazard-immune while airborne, then splash landing (`05 §7` slow-mo 15 % for 0.25 s).
- **Anywhere ("Hop")**: same input without a ramp → **0.7 s** air, apex 1.4 m, hazard-immune (an emergency dodge), costs the charge.
### 6.2 Landing
No penalty. Landing during a `squall` zone applies the normal lateral push.
### 6.3 Jump Section (the meaningful shortcut)
A ramp opens onto a **side channel** that bypasses a dense obstacle/log-boom section. Taking the full jump: **`s += 70 m`** skipped smoothly over the 1.2 s air time (≈ 3 s time saved at 23 m/s) and a clean line. Not jumping: the player navigates the obstacle section (extra hazards, normal rules). Skipped hazards are never evaluated for a jumper. Deterministic: `skipDistance` and section bounds are in `CourseData`.

---

## 7. Collision and obstacle handling

Boat = circle radius **1.1 m** in (s, lat) space. Hazard footprints are circles/capsules in the same space. **No boat–boat collisions in any mode.**

| Hazard | Radius / shape | Slow multiplier × duration | `T` loss | Extra |
|---|---|---|---|---|
| Buoy | r 1.0 | ×0.80 · 0.6 s | −0.04 | — |
| Fishing net | capsule 7 m × 0.6 m | ×0.60 · 1.2 s | −0.08 | floats pulse yellow |
| Drifting log | r 1.6 (drifts ±0.8 m/s lat) | ×0.65 · 1.2 s | −0.10 | debris VFX |
| Floating baskets | r 2.5 | ×0.75 · 0.9 s | −0.06 | cashew scatter (cosmetic) |
| Rock / laterite | r 2.2 | ×0.55 · 1.5 s | −0.12 | white splash |
| **Ferry** (moving) | rect 14 m × 4 m crossing | ×0.50 · 1.8 s | −0.15 | lateral knock 4 m; horn telegraph 2 s ahead |
| Glow orb (night) | r 1.2 | ×0.80 · 0.8 s | −0.05 | — |
| **Squall / gust zone** | zone | none | none | lateral push 3 m/s while inside |

Rules:
- **Hit resolution** per sim tick; after any hit: **1.0 s i-frames** (no chain-hits), `hazardSlowMul` stays for its duration (multiple slows don't stack — take the strongest).
- **Shield** (§9.2) absorbs the hit completely (no slow, no T loss, no Flow loss) — still plays a flash and consumes the charge.
- **Hit does not break the dictation streak** (hazards punish steering, not speech).
- **Telegraphing:** every hazard visible ≥ 40 m ahead (`05 §12`); ferries horn at 2 s.
- **Duel:** hits are computed **server-side** from the reported lateral path (`04 §2.5`).

---

## 8. Camera follow and speed scaling (numbers)

| Parameter | Value |
|---|---|
| Follow distance / height | **9.0 m** back / **4.2 m** up (+1.5 m back at T = 1) |
| Look-ahead point | **12 m** ahead along the tangent |
| FOV | **62°** at T=0 → **78°** at T=1; Nitro **+6°**; stroke surge **+4° kick** decaying over 0.25 s |
| Spring | stiffness 6.0, damping 0.9 (critically damped feel) |
| Lateral lead | camera x offset = `0.35 × latV` clamp ±2.5 m |
| Roll | `−0.0035 × latAccel` clamp ±6° |
| Hit shake | amplitude 0.25 m, 0.3 s |
| Bank clearance | camera lateral position clamped inside `halfWidth + 3 m`; min height 2.5 m |
| Countdown/finish | intro fly-by 3 s (skippable) · finish orbit 2 s |
| `reducedMotion` | no kick, no shake, no roll, FOV static 68° |

---

## 9. POWER-UP SYSTEM (canonical)

Summary: **Nitro Burst**, **Shield**, **Wave Jump**, **Flow State** (meter-based, covers the master prompt's "Perfect Streak"), plus the always-on **Streak multiplier** (`03 §7.3`). *Improvements over the starting concepts:* Shield is **passive** (no activation to forget while talking); Wave Jump gets a **dual use** (ramp shortcut / emergency hop); Perfect Streak is merged into the visible **Flow State meter** so players *chase a state*, not a hidden number.

Config: `packages/shared/config/powerups.json`.

### 9.1 Nitro Burst
| Item | Spec |
|---|---|
| **Earn** | Complete a stage with **stage accuracy ≥ 0.90** → +1 charge. Flawless stage → +1 charge **and** `T += 0.10`. |
| **Max stored** | **2** (earning at max grants +60 score instead) |
| **Activate** | **LMB** · **↑** · spoken/snippet **`vox nitro` / `[[nitro]]`** |
| **Duration / cooldown** | **3.0 s** active; **4.0 s** cooldown after it ends (charges retained; cooldown timer shown on the chip) |
| **Effect** | `M × 1.35`; `T ← max(T, 0.85)`; decay frozen; Final-Sprint score bonus still applies |
| **VFX / audio** | Flame cone + magenta-yellow trail, radial speed streaks, FOV +6°; rising synth sweep + "whoomp"; sign border pulses |
| **Obstacle interaction** | Not immune; higher speed reduces reaction time (telegraph distance already ≥ 40 m ≈ 1.1 s at 35 m/s) |
| **Multiplayer fairness** | Server tracks charges/cooldown; activation validated; identical for both |
| **AI behaviour** | Persona policies (`04 §1.7`) — earn via the same rule, use via policy |
| **Balancing parameters** | `earnAcc 0.90`, `max 2`, `dur 3.0`, `cd 4.0`, `mul 1.35`, `Tfloor 0.85` |
| **Acceptance tests** | PU-01 earn only at ≥ 0.90; PU-02 cap 2; PU-03 duration/cooldown exact in ticks (90 / 120); PU-04 no activation without charge (toast); PU-05 server rejects early re-activation |

### 9.2 Shield
| Item | Spec |
|---|---|
| **Earn** | **4 consecutive clean strokes** (streak 4, 8, 12 …) while no shield is held → +1 |
| **Max stored** | **1** |
| **Activate** | **Automatic** on the next hazard hit (no input) |
| **Duration** | Until consumed (no timer); after absorbing a hit: 1.0 s i-frames |
| **Effect** | Cancels slow, `T` loss and Flow-meter loss of **one** hazard hit (not bank scrapes) |
| **VFX / audio** | Translucent magenta hex bubble; crack-pop on absorb; chime on earn |
| **Multiplayer** | Server-side consumption |
| **AI** | Auto; Susegad hoards (never "wastes" it voluntarily) |
| **Params** | `streakStep 4`, `max 1`, `iframes 1.0 s` |
| **Tests** | PU-06 earn at streak 4/8; PU-07 consumed on hit; PU-08 not consumed by scrape; PU-09 not earned when already held |

### 9.3 Wave Jump
| Item | Spec |
|---|---|
| **Earn** | **Bonus Phrase Gate** success (reward roll `§10`) |
| **Max stored** | **1** |
| **Activate** | **RMB** · **↓** · `vox jump` / `[[jump]]`; at a ramp = **full jump** (1.2 s, `s += 70 m`); elsewhere = **hop** (0.7 s) |
| **Cooldown** | 3.0 s after landing |
| **Effect** | Airborne ⇒ hazard-immune; skip distance as §6.3 |
| **VFX / audio** | Splash ring, slow-mo landing, whoosh + "plink" |
| **Fairness** | Server validates ramp zone & charge; skip distance deterministic |
| **AI** | Uses a charge at the next ramp; hops only if a hit is otherwise unavoidable (never reads player state) |
| **Params** | `air 1.2`, `hopAir 0.7`, `skip 70`, `cd 3.0`, `rampZone [−6,+2]` |
| **Tests** | PU-10 full jump skips obstacles; PU-11 hop dodges; PU-12 no charge ⇒ ramp inactive; PU-13 determinism of skip |

### 9.4 Flow State (from the Flow meter)
| Item | Spec |
|---|---|
| **Earn** | Meter fills with clean strokes (`03 §7.5`); full ⇒ auto-activates |
| **Activate / duration** | Automatic; **8.0 s**; meter resets to 0 after activation |
| **Effect** | **Score ×1.5** (inside `M_total`, cap 3.0), **speed ×1.10**, hazards −0.10 meter ignored while active |
| **VFX / audio** | Magenta/yellow screen-edge glow, boat rainbow trail, music stem layer ↑, "FLOW STATE!" stinger |
| **Fairness / AI** | Same meter rules for bots |
| **Tests** | PU-14 fill rates; PU-15 8 s exact; PU-16 meter loss on skip/hit |

### 9.5 Streak multiplier ("Perfect Streak") — not a stored item
`M = 1 + 0.10 × min(cleanStreak, 10)` — displayed as a ladder next to the sign.

### 9.6 P2 — Foghorn (Duel, off by default)
Earn: 6 clean strokes. Effect: blurs the opponent's sentence sign for 2 s (not their results). Fair-play toggle in lobby; AI never uses it. *Not in MVP.*

### 9.7 Anti-frustration / anti-exploit
Charges never expire; earning at max is converted to score; commands have 400 ms cooldown; Nitro can't be activated during its own cooldown; **no power-up can be earned by typing** (Duel `typed` source earns nothing in *voice-only* rooms).

---

## 10. Bonus Phrase Gates and checkpoints

| Item | Spec |
|---|---|
| **Availability** | From **L3**. Count per race: L3–L4 **2**, L5+ **3**; Endless 3. Positions at **25 / 55 / 80 %** of course length, jittered ±4 % by seed, never within ±30 m of hazards. |
| **Window** | Gate **opens 110 m before the arch** (≈ 4–9 s depending on speed) and **closes when the boat passes the arch** (or after 8 s). A countdown ring on the gate sign shows remaining time. |
| **Phrase** | 3–5 words from `bonus_phrases.json`, shown on a **separate small sign** under the main sentence (never replacing it). |
| **Success condition** | Phrase aligned **A ≥ 0.75** **and** boat passes through the arch opening (**|lat − gateLat| ≤ 4 m**) → two skills at once (speech + steering). |
| **Routing** | Gate vs sentence disambiguation `03 §8.4`. |
| **Reward roll** (seeded RNG) | **Nitro 45 % · Wave Jump 40 % · Shield 15 %**; if the rolled item is already at max, re-roll once; if still full → **+150 score and +0.15 Flow meter**. |
| **Failure** | **No penalty, main race never paused.** Sign shows "Next time!" |
| **Rewind rule** | None. |
| **Checkpoints** | Flag posts at 25/50/75 % (cosmetic + split times for ghosts and "Lap" callouts). There is **no respawn** (no way to fail the race). |

---

## 11. LEVEL STRUCTURE (canonical table; `01 §11` defers here)

`expectedStages` = target number of sentences a normal player finishes; the content generator provides **`expectedStages + 3`** so content never runs out. The race ends when `s ≥ length`.

| L | Course | Length (m) | Half-width (m) | Expected stages | Words/stage | wpmTarget | Hazard 1/m | Gates | Par* (s) | New thing |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Baga Shack Sprint | 1000 | 16 | 12 | 4–6 | 95 | 120 | 0 | 56 | core loop, cashews |
| 2 | Chapora Fort Run | 1100 | 15 | 12 | 5–7 | 101 | 105 | 0 | 60 | buoys, Shield |
| 3 | Mapusa Market Canal | 1150 | 13 | 13 | 6–8 | 107 | 95 | 2 | 63 | Bonus Gate |
| 4 | Anjuna Golden Hour | 1300 | 14 | 13 | 7–9 | 113 | 85 | 2 | 72 | logs, ramps |
| 5 | Fontainhas Colour Lanes | 1400 | 11 | 14 | 8–10 | 119 | 75 | 3 | 78 | Jump Section/shortcut |
| 6 | Divar Ferry Crossing | 1550 | 14 | 14 | 8–11 | 125 | 70 | 3 | 85 | ferries |
| 7 | Old Goa Mist | 1650 | 12 | 15 | 9–12 | 131 | 65 | 3 | 90 | fog, vocab |
| 8 | Monsoon Mandovi | 1800 | 13 | 15 | 10–13 | 137 | 60 | 3 | 98 | gusts, swell |
| 9 | Dudhsagar Gorge | 1900 | 7–9 | 16 | 10–14 | 143 | 55 | 3 | 102 | narrow gorge, Long Haul stage |
| 10 | Zuari Night Regatta | 2050 | 12 | 16 | 11–15 | 149 | 50 | 3 | 110 | glow orbs, night |
| 11 | Palolem Festival | 2200 | 14 | 17 | 12–16 | 155 | 47 | 3 | 118 | Tongue Tangle stage |
| 12 | Cabo de Rama Finale | 2350 | 11 | 18 | 12–18 | 161 | 45 | 3 | 125 | everything, 3-leg |
| Endless k | cycles L1–L12 looks | 1800–2600 | 8–14 | 14–20 | up to 22 | 161+2k (cap 200) | 45→35 | 3 | computed | modifiers |

\*Par = finish time of the scripted **Average** player at Standard heat; **Opus must compute par with `tools/perf/simPar.ts`** and overwrite these initial values if they deviate > 10 %. Sentence-time check: e.g. L6 ≈ 133 words / 125 wpm ≈ 64 s + 14 × 0.8 s transitions + 4 s start ≈ 79 s ✔; L12 ≈ 270 words / 161 wpm ≈ 100 s + 14 + 4 ≈ 118 s ✔.

**Special stages**
- **Long Haul** (L9+): one stage per race with strokes up to 9 words; hands-free recommended; flawless Long Haul ⇒ ×1.15 stage bonus.
- **Tongue Tangle** (L11+): tongue-twister stage; ASR Mercy budget +1; flawless ⇒ +1 Nitro charge.
- **Final Sprint:** last 20 % of length: score ×1.25 and a "FINAL SPRINT" banner; closers' paces kick in via their persona curve.

**Difficulty scaling summary** (all pre-race, disclosed): `k↑`, `gainPerWord↓`, `wpmTarget↑`, hazard density↑, corridor narrower, rival skill↑, sentence tier↑, new mechanic per level, + Endless modifiers (every 3rd depth): `fog`, `gusts`, `double ferry`, `shorter gate window (−20 %)`, `night`, `rain`.

**Endless Tide run rules:** start with **3 Anchors**; each level requires a **top-3 finish** to advance (depth +1); otherwise lose an Anchor and replay a re-seeded level of the same depth; 0 Anchors ⇒ run ends. **Tide Score** = Σ level scores × (1 + 0.10 × depth). Every 5 depths: a **crate** and a **rival revenge** event.

---

## 12. REWARDS, PROGRESSION AND UNLOCKS

### 12.1 XP and rank
```
raceXP = 100 + floor(score / 20) + placeBonus + 30 × stars         (× heatMul: Chill 0.8 | Standard 1.0 | Hot 1.3)
placeBonus = {1:150, 2:90, 3:50, 4:25, 5:10}
cumXP(rank) = round( 250 × rank^1.35 )          // rank 1=250, 2=637, 5=2,200, 10=5,600, 20=14,200
```
### 12.2 Stars (per level; best stored)
★ **Podium** (top-3) · ★★ **Win** (1st) · ★★★ **Win + overall accuracy ≥ 92 % + zero hazard hits + steering assist ≠ Strong**.
### 12.3 Unlock schedule
| Unlock | Condition |
|---|---|
| L(n+1) | Top-3 finish on L(n) |
| **Endless Tide, Daily Regatta** | Clear L3 |
| Boats | Shack Runner rank 2 · Ferry Mini rank 4 · Spice Dhow rank 6 · Catamaran rank 9 |
| Paints | every 2 ranks + milestone stars (3★ on L1, L6, L12) |
| Decals/azulejo, horns, wake colours | Tiffin Crates and star milestones |
| Rival badges | Beat each rival 5× (nemesis system, P1) |
### 12.4 Tiffin Crates (cosmetics only)
1 crate per finished race (+1 for a win; +1 for settling a grudge). Rolls: Common 70 % / Rare 24 % / Epic 6 %. **Pity:** after 6 crates without an Epic, the next is Epic. Duplicates → **25 XP**. No purchases, ever.
### 12.5 Ranks vs the "one more race" loop
Each result screen always shows: XP bar → next rank, nearest star target ("1 more hit-free level for ★★★ on L4"), and the next level teaser (`07 §11`).

---

## 13. RACE RESULTS

Data (`RaceResult`): placement (of 5 or of 2), finish time, score, stage accuracy, longest streak, strokes (clean/pass/fail/skip), hazards hit, pickups, power-ups earned/used, Flow Stats (`03 §15`), mercy words, **"What cost you time"** (top-2 from: slowest strokes by seconds/word; hazards (slow duration × speed lost); idle gaps > 4 s; skipped strokes), misheard words for Pit Stop, XP breakdown, crates earned, rival grudge updates. **DNF** rules: after the first finisher, others have 30 s; unfinished ranked by progress and flagged DNF.
**Tie-break:** compare interpolated finish time; if equal to the tick → higher race score → lower player index (deterministic).

---

## 14. TUNING PARAMETER INDEX
| File | Keys (examples) |
|---|---|
| `throttle.json` | `vMin, vMax, gamma, aUp, aDown, decayBase, decayPerLevel, gainBase, gainPerLevel, launchBonus, skipPenalty, stageKick` |
| `powerups.json` | nitro `{earnAcc,max,dur,cd,mul,Tfloor}`, shield `{streakStep,max,iframes}`, jump `{air,hopAir,skip,cd,rampZone}`, flow `{fill,perfectBonus,fail,dur,speedMul,scoreMul}`, gate rewards weights |
| `levels.json` | per level: `length, halfWidth, stages, wordsRange, wpmTarget, hazardDensity, gates, theme, tod, weather, controlPoints` |
| `scoring.json` | see `03 §7` |
| `bots.json` | skill base, persona numbers, heat offsets |
| `economy.json` | XP formulas, place bonus, crate odds, pity, unlock table |
| `camera.json` | §8 numbers |
| `steering.json` | `maxLatSpeed, latAccel, deadzone, sensitivity, assist levels` |

---

## 15. EDGE CASES
| Case | Rule |
|---|---|
| All four bots finish before the human | Race continues until the human finishes or 30 s after the first finisher expires (then DNF with progress rank) |
| Human finishes dictation early (content exhausted) | Impossible by design (`+3` buffer stages); if reached, boat coasts and "Keep going!" stage reuse repeats a Bonus stage |
| Window blur / tab hidden | **Championship** auto-pauses with a 1 s grace; **Duel** shows overlay, sim continues; returning shows Lost-Wake banner |
| Frame hitch / low FPS | Fixed-step accumulator, max 5 catch-up steps; render interpolates |
| Pause | F1 or button or `vox pause`; Championship freezes sim/audio ducking; resume has 3-2-1 soft countdown; bursts during pause dropped |
| Hazard at spawn / gate overlap | prevented by placement rules + tests |
| Ferry timing exploit | ferry timers deterministic by `s` & seed; same for all |
| Player stands still (no speech) | `T → 0`, `v → vMin = 6 m/s`; a 20-s "Are you there?" hint; the race still ends for everyone when bots finish + 30 s |
| Bot tie with human at line | §13 tie-break |
| Resize / DPR change mid-race | renderer resize handler, no sim effect |
| Power-up earned at the finish tick | ignored |
| Duel latency spike | Prediction + reconcile `04 §2.9`; never punishes either player |
| Keyboard-assist player | allowed in Championship (flagged "assisted", reduced XP ×0.7 and ★★★ disabled); controlled in Duel |

---

## 16. ACCEPTANCE TESTS (IDs referenced by `08 §9`)

| ID | Test | Pass |
|---|---|---|
| PH-01 | Throttle gain/decay unit test (golden numbers for L1 & L12) | exact |
| PH-02 | Speed approach with `a_up/a_down` | within 1e-6 of closed form |
| PH-03 | Pacing sim: Average scripted player finish times per level | within ±10 % of par; **Skilled** ≤ par×0.9; **Casual** ≥ par×1.2 |
| PH-04 | Course placement validator on 12 levels × 50 seeds | all rules pass (free passage ≥ 5.5 m etc.) |
| PH-05 | Hazard hit effects table | exact |
| PH-06 | I-frames prevent chain hits | ✓ |
| PH-07 | Jump Section skips exactly 70 m and hazards | ✓ |
| PH-08 | Bank scrape clamp | lat never exceeds limit |
| PH-09 | Steering `maxLatSpeed` identical for bots/human | ✓ |
| PH-10 | Gate success requires phrase **and** arch lat | both needed |
| PH-11 | Gate reward re-roll rules | ✓ |
| PH-12 | Final Sprint multiplier applied only in last 20 % | ✓ |
| PH-13 | XP/rank/star formulas goldens | exact |
| PH-14 | Crate pity guarantees Epic by 6th | ✓ |
| PH-15 | Unlock progression (top-3 unlocks next) | ✓ |
| PH-16 | Endless Anchors logic | ✓ |
| PH-17 | Tie-break determinism | ✓ |
| PH-18 | Pause/blur behaviour per mode | ✓ |
| PH-19 | Deterministic replay: same events ⇒ same final state (3 runs) | byte-equal |
| PH-20 | Camera never clips banks (sweep test) | ✓ |
| PU-01…PU-16 | Power-up tests in §9 | ✓ |
