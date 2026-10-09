# 08 — OPUS IMPLEMENTATION AND QA PLAYBOOK

> **Audience:** Claude Opus 5.5 (the implementer). **Canonical owner of:** build order, setup commands, external-service/manual-setup list, test strategy and IDs, performance budgets & measurement, packaging, risks, definition of done, release & demo-day checklists, and the **final copy-paste execution prompt (§17)**.
> Obeys `02 §0`. If anything conflicts: **`02 §0` > the canonical-owner file for that topic > this playbook > other files.**
> Date of package: 2026-10-07. Event shown in the hero screenshot: **28–31 Oct 2026, Goa** (≈ 3 weeks away) → scope discipline matters.

---

## 1. How to use the package

**Read order (full read, no skimming):** `01` (what/why) → `02` (decisions, structure) → `03` (voice + scoring) → `06` (physics, numbers, levels) → `04` (AI + Duel) → `05` (art + assets) → `07` (UI/audio) → this file. **Open all four images in `reference_images/`** before any UI/world work (`05 §2` explains what each is and is not).

**Canonical owners (one source of truth each):**
| Topic | Owner |
|---|---|
| Decisions CD-01…16, folder layout, interfaces, sim constants | `02` |
| Wispr Flow, providers, alignment, **scoring**, commands, Flow Stats, content lint | `03` |
| Bots, Duel protocol/netcode, anti-cheat | `04` |
| Palette, assets, reference inventory | `05` |
| Throttle/speed, hazards, power-ups, gates, **level table**, XP/unlocks | `06` |
| Screens, HUD, audio cues, accessibility | `07` |
| Process, tests, perf, deploy, checklists | `08` |

**Label key reminder:** **[VERIFIED]** facts were checked on 2026-10-07; **[UNVERIFIED]** items must be validated by a test or the human; **[ASSUMPTION A#]** items are listed in §18 for the user.

**What you cannot do (be honest about it in the final report):** run the real Wispr Flow desktop app, hear audio, judge feel on the user's GPU/venue, or test real two-laptop networking. You *can* simulate all of them (MockProvider, headless Chromium, two browser contexts) and you must leave a **human validation checklist** (§9.8).

---

## 2. Project creation

Working directory = the folder that contains `VOXWAKE_RESEARCH/` (the user's `ARNIKA BOAT GAME` folder; **quote paths — they contain spaces**). Create the game in a sibling folder **`voxwake/`**.

```bash
# Cross-platform (works in PowerShell, bash, zsh)
node -v            # need 22.x
npm -v
mkdir voxwake && cd voxwake
git init
npm init -y
# then edit package.json to add workspaces + scripts (see §2.1)
```
Re-check versions first (`02` CD-14): `npm view three version`, `vite`, `typescript`, `vitest`, `@playwright/test`, `ws`, `qrcode`, `jsqr`, `zod`, `preact`, `@preact/signals`, `@preact/preset-vite`, `eslint`, `prettier`, `tsx`, `concurrently`, `dependency-cruiser`. **Pin exact versions** (no `^`) and commit `package-lock.json`. If a toolchain pair misbehaves (e.g., TS 7 + a plugin), drop to the previous major rather than debugging tooling.

### 2.1 Root `package.json` (template)
```jsonc
{
  "name": "voxwake", "private": true, "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "concurrently -k -n server,client \"npm run dev -w apps/server\" \"npm run dev -w apps/client\"",
    "build": "npm run build -w packages/shared && npm run build -w apps/client && npm run build -w apps/server",
    "start": "node apps/server/dist/index.js",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "lint:deps": "depcruise --config .dependency-cruiser.cjs apps packages",
    "lint:content": "tsx tools/content/lintContent.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "sim:bots": "tsx tools/perf/simBots.ts",
    "sim:par": "tsx tools/perf/simPar.ts",
    "check:palette": "tsx tools/perf/checkPalette.ts",
    "check:contrast": "tsx tools/perf/checkContrast.ts",
    "check:assets": "tsx tools/perf/checkAssets.ts",
    "perf": "playwright test tests/e2e/perf.spec.ts",
    "verify": "npm run typecheck && npm run lint && npm run lint:deps && npm run lint:content && npm test && npm run build"
  }
}
```
Use **Node scripts (`tsx`)** rather than shell one-liners so Windows PowerShell and bash behave the same. Vite dev server proxies `/api` and `/ws` to the Node server.

### 2.2 Engine setup (browser)
No editor/engine install. Chrome/Edge latest; `npx playwright install chromium` for tests on a machine where Chromium isn't preinstalled. `index.html` must set `<meta name="viewport">`, `lang="en"`, and load self-hosted fonts.

---

## 3. IMPLEMENTATION SEQUENCE (dependency-aware milestones)

**Workflow loop for every milestone** *(mandatory)*:
```
implement subsystem → write/extend its tests → run them → read failures → fix ROOT CAUSE (never weaken a test to pass)
→ run `npm run verify` → commit (`git commit -m "M#: …"`) → update task list → next milestone
```
**Do not stop for approval between milestones.** Stop only for: a missing credential that truly blocks, an external decision only the user can make (listed in §18), or an unrecoverable environment failure. Otherwise choose the sensible default, note it in `docs/DECISIONS.md`, and continue.

| M | Scope (priority) | Key deliverables | Exit criteria (all must pass) |
|---|---|---|---|
| **M0** | Scaffold & guard-rails (P0) | workspaces, tsconfig, eslint (no `Math.random/Date.now/DOM` in `shared`), dependency-cruiser layer rules (`02 §11`), vitest, playwright, scripts, `.env.example`, README stub | `npm run verify` green on skeleton; layer-violation sample fails as expected |
| **M1** | Shared text/align/scoring + content lint (P0) | `rng`, `normalize`, `numbers`, `homophones`, `phonetic`, `alignBurst`, `evaluateStroke`/`evaluateStrokeFromCredits`, mercy, streak, pace, anti-exploit, `parseCommand`, content schema + **seed bank ≥ 60 sentences** + lint | **VI-01…VI-13, VI-14…VI-16, VI-19, VI-24, VI-27, VI-29** green |
| **M2** | Shared sim & course (P0) | `throttleModel`, `boatDynamics`, `powerUps`, `hazards`, `CourseBuilder` + `levels.json` (L1–L12), determinism/replay harness | **PH-01, 02, 04–08, 12, 19; PU-01…PU-16** green; golden traces committed |
| **M3** | Client shell + speech (P0) | Vite app, `GameStateMachine`, `SettingsStore`, `ProgressionStore`, `FlowDeck`, `FlowDeskProvider`, `SpeechInput`, `TranscriptRouter`, `MockProvider`, `WebSpeechProvider`, `KeyboardProvider`, `FlowDetector`, Title/Mode/Setup screen skeletons | **VI-09, 10, 17, 18, 20–23, 28** (jsdom/Playwright); Setup screen detects mock "flow-like" burst; no console errors |
| **M4** | **World vertical slice (P0)** | `WorldRenderer`, camera rig, water shader, sky, procedural boat, banks for L1, mouse steering, HUD v1 (sign + transcript + ring), `RaceDirector` for a solo boat | Opens `?provider=mock&script=demo1` and **plays L1 end-to-end**; screenshots captured and *viewed* by you; `renderer.info` logged; 60 fps in headless/real GPU where available |
| **M5** | **Championship core (P0)** | 4 bots (`BotBrain`, personas, steering), positions UI, power-ups + gates + pickups, results screen, XP/stars/unlocks, map (L1–L6), Flow Stats, Flow Setup (full), Garage basic | **AI-01…08, PH-03, 09–18, VI-26**; L1–L6 playable in e2e with MockProvider; calibration report written to `tests/reports/` |
| **M6** | Server & **Voice Duel (P0)** | `apps/server` (HTTP+WS, rooms, TTLs, rate limits), `RaceSimServer`, `NetClient`, `TimeSync`, protocol zod, QR render + scan/join UI, lobby, synced start, snapshots, reconnect, results/rematch | **MP-01…MP-15**, **VI-25**, UI-09…12 green with **two Playwright browser contexts**; honest note if real-network test not possible |
| **M7** | Levels L7–L12, Endless, Daily (P1) | kits (church, fort, ferry, gorge, bridge, cliffs), weather, themes, Endless modifiers, Daily seed | PH-04 for all; screenshots of each level viewed; VQ-01 |
| **M8** | Polish: VFX, audio, commentary, cinematics (P1) | `VfxSystem`, `AudioDirector`/`Synth`/stems/commentary, fly-by, photo finish, final sprint, accessibility settings, reduced motion | UI-04…08, 15–20; audio cue tests; no console errors; VQ-03, 05, 14 |
| **M9** | Flow-native extras (P0/P1) | Lost-Wake recovery, Pit Stop, snippet test panel, Flow Lens/judge mode, Demo Autopilot scripts, Whisper tips | Judge mode shows live stats; autopilot completes a race unattended |
| **M10** | Performance & quality (P0) | adaptive quality, instancing, culling, pooling, palette/contrast/asset checks | §11 budgets met or documented; VQ-02, 09, 13 |
| **M11** | Packaging & docs (P0) | production build, server start, Dockerfile (optional), `README`, `docs/FLOW_VALIDATION.md`, `docs/DEMO_SCRIPT.md`, `docs/DECISIONS.md`, `docs/ASSET_LICENSES.md` | cold-clone → `npm ci && npm run build && npm start` works; health check OK |
| **M12** | Final QA & report (P0) | full matrix run, bug-bash, honest report | §14 Definition of Done satisfied |

**If time is short, cut in this order:** M7 (keep L1–L6), `.glb` upgrades, audio polish, Daily Regatta, ghosts, nemesis lines. **Never cut:** FlowDeck/alignment/scoring correctness, Duel join (QR + code + link), bots fairness, Flow Stats, Setup wizard, fallbacks, tests.

### 3.1 Vertical-slice rule
By the end of **M4** there must be a playable race. From then on the game must **always start and be playable** after every commit (never leave the tree broken).

### 3.2 Parallelism hint
After M2, `shared` is stable: client work (M3–M5) and server work (M6) can interleave, but integrate through `packages/shared/protocol` only.

---

## 4. Required dependencies and plugins
| Package | Where | Purpose |
|---|---|---|
| `three`, `@types/three` | client | rendering (CD-01/15) |
| `preact`, `@preact/signals`, `@preact/preset-vite` | client | UI (CD-13) |
| `qrcode` | client | QR generation |
| `jsqr` | client | QR scanning fallback |
| `zod` | shared | schemas |
| `ws` | server | WebSocket |
| `vite`, `typescript` | all | build |
| `vitest`, `@playwright/test`, `jsdom` (if needed) | dev | tests |
| `eslint`, `prettier`, `dependency-cruiser` (or `madge`), `tsx`, `concurrently` | dev | quality/tools |
| Fonts via `@fontsource/*` **[UNVERIFIED package names — confirm with `npm view`]** | client | self-hosted fonts (`05 §17`) |
| *(optional)* `@gltf-transform/cli` **[UNVERIFIED]** | dev | glb validation (P1) |
| *(optional)* Blender CLI | tools | P1 models (never required) |
No analytics, no CDNs at runtime, no CSS framework required.

---

## 5. External services, environment variables, API keys, manual setup

### 5.1 `.env.example`
```
PORT=8080
PUBLIC_BASE_URL=http://localhost:8080          # MUST equal the externally visible origin (QR/link)
ROOM_TTL_MIN=15
RECONNECT_GRACE_MS=30000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
LOG_LEVEL=info
SIM_LATENCY_MS=0                                # dev-only latency injector for MP tests
# --- optional, leave blank if you have no Wispr API access ---
ENABLE_FLOW_API=0
WISPR_API_KEY=                                  # NEVER sent to the browser; used only to mint client tokens (03 §4.5)
```
Never commit `.env`. `GET /api/config` exposes only `publicBaseUrl` and `flowApiEnabled`.

### 5.2 Human tasks (Opus cannot do these — list them in the final report)
| # | Task | Why / notes |
|---|---|---|
| H1 | **Install Wispr Flow** on every demo laptop; sign in; confirm hotkey (Windows **Ctrl+Win**, Mac **Fn**) [VERIFIED defaults] | primary voice input |
| H2 | **Run Flow Setup in the game** (hello test; optionally add **snippets** and **dictionary**) | `03 §14` |
| H3 | **Run the real-device Flow validation V1–V6** and fill `docs/FLOW_VALIDATION.md` | `03 §1.3` |
| H4 | Choose **hosting** (demo laptop + tunnel, or a PaaS), set `PUBLIC_BASE_URL`; verify HTTPS | `04 §2.15`; free-tier limits **[UNVERIFIED]** |
| H5 | **Headsets** with mics for both players; test **Whisper Mode** in the venue | mic bleed/noise |
| H6 | (Optional) request **Wispr API** access (`enterprise@wisprflow.ai`) | exclusive access [VERIFIED] — the game works without it |
| H7 | Decide on hackathon credit/branding use | **A2** |
| H8 | Konkani/Goan spot-check of Goa words, sticker text, boat/place names | **A5** |

---

## 6. Asset acquisition, placeholders, policy
- **P0 art is procedural code** (`05 §14`). Do not download third-party models. If you ever use a CC0 asset, log it in `docs/ASSET_LICENSES.md` and recolour to the palette.
- **Fonts:** self-host chosen fonts (OFL). **Audio:** procedural only.
- **Placeholder policy:** Stage 0 = coloured boxes to unblock logic (day 1) → Stage 1 = procedural kit → Stage 2 = optional `.glb` via `AssetRegistry`. Every key must always resolve to something renderable. **No missing-asset crash is acceptable**; log once and fall back.
- **Optional VFX/post-processing/audio/multiplayer/external assets must never prevent the core game from starting** (wrap in `SystemGuard`, feature-detect, default off in `low`).

---

## 7. Build and run commands
| Goal | Command |
|---|---|
| Dev (hot reload) | `npm run dev` → client `http://localhost:5173`, server `:8080` |
| Offline solo demo (no server, no Flow) | open `http://localhost:5173/?provider=mock&script=demo1&judge=1` |
| Production build | `npm run build` |
| Run production | `npm start` (serves `apps/client/dist` + API + WS on `PORT`) |
| Unit/integration tests | `npm test` |
| E2E | `npm run e2e` |
| Full gate | `npm run verify` |
| Bot calibration / par | `npm run sim:bots` / `npm run sim:par` |
| Visual/data checks | `npm run check:palette check:contrast check:assets` |
| Perf probe | `npm run perf` |
URL flags (parsed once by `RuntimeFlags`): `?provider=flow|web|keyboard|mock`, `?script=demo1|demo2|demo3`, `?judge=1`, `?debug=1`, `?test=1`, `?seed=N`, `?quality=low|med|high`, `?level=N`.

---

## 8. Module-by-module completion criteria
| Module | Done when |
|---|---|
| `shared/text` + `align` | all VI text/alignment tests green; property test: aligning a transcript equal to the target yields credit 1.0 for 1,000 random sentences; ≤ 0.2 ms per alignment (benchmark) |
| `shared/scoring` | goldens exact; exploit tests (VI-11/12/13) pass; server-parity fuzz (VI-25) 100 % |
| `shared/sim` | deterministic replay byte-equal; power-up tests PU-01…16; hazards PH-05…07 |
| `shared/course` | PH-04 across 12 levels × 50 seeds |
| `shared/bots` | AI-01…08; calibration within ±5 pts; variance 6–14 % |
| `shared/protocol` | zod round-trips + fuzz, version negotiation |
| `client/speech` | VI-09…VI-28 (provider contract tests), Flow detection heuristics, focus handling |
| `client/world` | renders every level without errors; budgets met; screenshots viewed |
| `client/game` | Championship L1–L6 (then L12) completable in e2e; results/progression correct |
| `client/net` + `server` | MP-01…15 in two browser contexts; reconnect works |
| `client/ui` | UI-01…UI-20 |
| `client/audio` | cue table complete; no speech output; ≤ 24 voices; fails silent |
| Flow extras | Setup wizard flow, Lost-Wake banner, Pit Stop, judge overlay |

---

## 9. TEST STRATEGY

### 9.1 Layers
1. **Unit (Vitest):** `shared/**` (pure, fast), goldens in `__tests__/golden/`.
2. **Property/fuzz:** text normalisation, alignment, protocol parsing, scoring parity.
3. **Simulation:** `npm run sim:bots`, `npm run sim:par` (thousands of headless races); results written to `tests/reports/*.json`.
4. **Component/integration (Vitest + jsdom or Playwright component):** FlowDeck, TranscriptRouter, SpeechInput fallbacks.
5. **E2E (Playwright, Chromium):** flows in `tests/e2e/`.
6. **Visual smoke:** Playwright screenshots of title, map, each level at t=3 s, HUD states; **you must open and inspect them** (Read tool) and fix visual defects; commit baselines only for stable screens.
7. **Perf probe:** `tests/e2e/perf.spec.ts` + `tools/perf/perfProbe.ts`.
8. **Human validation:** §9.8.

### 9.2 Test hooks
`?test=1` exposes `window.__VOXWAKE__ = { injectBurst(text,{delayMs,source}), getState(), setSeed(n), skipCountdown(), fastForward(sec), forceFlowState(), getRendererInfo() }`. Production builds must not expose it without the flag.

### 9.3 Smoke tests (run every milestone)
- **SM-01** `npm run build` succeeds, `npm start` serves `/` (200) and `/api/health` (200).
- **SM-02** Page loads with zero console errors/warnings (allow-list documented).
- **SM-03** Title → Mode Select shows exactly two mode cards.
- **SM-04** `?provider=mock&script=demo1` completes L1 unattended and reaches Results.
- **SM-05** Game starts with **no** `.glb`, **no** API keys, **no** network (Championship).

### 9.4 Voice-input tests — `VI-01…VI-30` in `03 §17` (VI-30 is human).
### 9.5 Physics/gameplay tests — `PH-01…PH-20`, `PU-01…PU-16` in `06`.
### 9.6 AI tests — `AI-01…AI-08` in `04 §2.17`; calibration report committed.
### 9.7 Multiplayer tests — `MP-01…MP-15` in `04 §2.17`; implement with **two browser contexts** against a real local server; inject latency via `SIM_LATENCY_MS`; simulate disconnect by `context.setOffline(true)` or closing the socket; QR round-trip by decoding the rendered canvas with `jsqr`. **Webcam scanning** can't be fully tested headlessly → test decode of a canvas frame and feature-detect branches; mark the live-camera path as **human-tested (H3 list)**.
### 9.8 Human validation checklist (write to `docs/FLOW_VALIDATION.md`; the user runs it)
V1 dictate 10 phrases (log `inputType`, chars, span) · V2 latency (20 bursts, median/σ) · V3 snippet `vox nitro → [[nitro]]` · V4 focus retained after Flow inserts · V5 Ctrl+Win + arrow key → window snap (confirms mouse steering) · V6 Whisper Mode in venue noise · V7 webcam QR join from the second laptop · V8 two-laptop Duel over the chosen host (RTT, skew) · V9 headset/mic-bleed check · V10 full 3-minute demo rehearsal.
### 9.9 Accessibility/quality checks
`check:contrast`, `check:palette`, reduced-motion e2e, text-scale 140 % screenshot, keyboard-only menu traversal, no-Esc grep (`UI-14`).
### 9.10 Reporting
`tests/reports/summary.md` lists: command, count passed/failed/skipped, duration, date. **Final claims must match these files.**

---

## 10. Debugging procedures
| Symptom | Procedure |
|---|---|
| Bursts not scoring | `?debug=1` → F9 log; check `speech`/`align` channels; verify epoch, stale/duplicate flags; replay with `injectBurst`. |
| Alignment surprises | Run `tools/content/explainAlign.ts "<target>" "<transcript>"` (create it) to print the DP table/statuses. |
| Desync in Duel | Enable `SIM_LATENCY_MS`; compare client vs server `StrokeResult` (VI-25 harness); dump `snap` history; check `rulesVersion`. |
| FPS drops | `renderer.info`, Chrome Performance panel, toggle systems via `?quality=low`; check instancing/culling; look for allocations in the hot path. |
| Focus loss | Log `focusin/out`, `visibilitychange`; ensure overlays don't steal focus; verify Lost-Wake banner. |
| Audio silent | AudioContext state; first-click resume; mute flags. |
| Determinism break | Run replay harness 3×; hash states every 30 ticks; bisect by tick. |
| Windows path issues | Quote paths; avoid shell-specific syntax; use `tsx` scripts. |

---

## 11. PERFORMANCE: targets, assumptions, validation

**Reference machine [ASSUMPTION A6]:** a 2022+ Windows laptop with integrated GPU (e.g., Intel Iris Xe-class) as the *floor*, and a discrete GPU laptop (RTX 3050-class) as the *target*; Chrome/Edge latest, 1080p window. If the demo laptop differs, re-run §11.3 on it.

| Metric | Target (initial, **PROPOSED**) | How to validate |
|---|---|---|
| Frame rate | **60 fps** at `high` on discrete; **≥ 30 fps** at `low` on integrated; auto-quality steps down if EMA frame time > 20 ms | `perfProbe` rAF sampler over a 60-s scripted race (p50/p95 frame time) |
| Render scale | 0.7–1.0 DPR scale, adaptive | log |
| Input→feedback latency | text-landed pulse ≤ **100 ms**; `gameMs` ≤ **33 ms** | timestamps (`03 §10`), UI-05 |
| Speech latency | Flow Desktop: measured by human (V2), unknown a priori **[UNVERIFIED]**; Web Speech final ≤ ~1.5 s typical **[UNVERIFIED]** | V2 + logs |
| Multiplayer sync | start skew ≤ 150 ms; down ≤ 4 KB/s, up ≤ 1 KB/s | MP-03, MP-12 |
| Draw calls | ≤ 250 (target 160) | `renderer.info.render.calls` |
| Triangles/frame | ≤ 400 k (target 250 k) | `renderer.info.render.triangles` |
| Textures | atlas 1024² + water noise 512²; GPU tex ≤ 24 MB | `renderer.info.memory` |
| JS heap | ≤ 600 MB steady (L12) | `performance.memory` (Chromium) |
| Particles live | ≤ 1,500 (low 600) | counters |
| Audio voices | ≤ 24 concurrent | counter |
| Load | cold load to Title ≤ 5 s on broadband; **initial JS ≤ 1.5 MB gz**; total P0 assets ≤ 15 MB | build report |
| Long tasks | none > 50 ms during race after warm-up (excluding level build) | PerformanceObserver |
| Level build time | ≤ 1.5 s (show loading sign) | timer |
**Do not trade stability for effects:** if budgets are missed, remove effects first (outlines on far props, shadows, grain), not gameplay feedback.

### 11.1 Adaptive quality
Tiers `low/med/high` (`quality.json`): DPR scale, shadow on/off, outline distance, water detail, particle caps, grain/vignette, instance counts. Auto: lower tier if p95 frame > 22 ms over 5 s; raise only on manual request.
### 11.2 Memory/leaks
Dispose geometries/materials/textures on level unload; pool VFX; heap snapshot after 10 consecutive races shows ≤ +10 % growth.
### 11.3 Procedure
`npm run perf` runs L1, L6, L12 for 60 s each with autopilot, writes `tests/reports/perf.json` (fps p50/p95, calls, tris, heap). Re-run on the demo laptop.

---

## 12. PACKAGING AND DEPLOYMENT
1. `npm ci && npm run build` → `apps/client/dist` (static) + `apps/server/dist`.
2. `npm start` serves static + `/api/*` + `/ws` on one port (same-origin → no CORS).
3. **Local demo:** run on the demo laptop; expose via an HTTPS tunnel (e.g., Cloudflare Tunnel/ngrok **[UNVERIFIED availability/limits — check]**) and set `PUBLIC_BASE_URL` to the tunnel URL **before** starting the server.
4. **PaaS:** any host that supports Node 22 + WebSockets + HTTPS; start command `npm start`; set env vars; health check `/api/health`. **[UNVERIFIED provider specifics.]** Provide an optional `Dockerfile` (multi-stage, `node:22-alpine`).
5. **Fallback if the network fails at the venue:** (a) phone hotspot; (b) LAN with `PUBLIC_BASE_URL=http://<LAN-IP>:8080` (note: webcam QR scan and browser mic need **HTTPS or localhost** [VERIFIED rule]; Flow Desktop doesn't); (c) show Championship + the **Demo Autopilot Duel script** (`?script=demo3`) clearly labelled as a recording-style demo.
6. Keep a **screen recording** of a full run as a last-resort backup.

---

## 13. KNOWN RISKS AND RECOVERY PLANS
| # | Risk | Likelihood/Impact | Mitigation / recovery |
|---|---|---|---|
| R1 | Flow's insertion timing/method differs from assumptions | M / H | Tunables (`burstQuietMs`, `dupWindowMs`); classification heuristics; V1/V2 validation; Web Speech fallback |
| R2 | Judge/partner laptop lacks Flow | M / M | Browser speech + Mock Autopilot; show your own laptop |
| R3 | Venue Wi-Fi blocks WS/QR | M / H | Phone hotspot; tunnel; LAN; Autopilot Duel |
| R4 | Mic bleed/noise (two players in one room) | H / M | Headsets, Whisper Mode, no TTS in game, Voice Focus |
| R5 | Accent/ASR errors punish players | M / M | ASR Mercy, aliases, Pit Stop; tune with logs |
| R6 | WebGL perf on weak GPU | M / M | Quality tiers, instancing, culling |
| R7 | Win+Arrow / Fn+Arrow conflicts | H / M | Mouse steering default (CD-08) |
| R8 | Esc cancels Flow | H / L | Never bind Esc |
| R9 | Toolchain major-version friction (TS 7, Vite 8, Vitest 5, ESLint 10) | M / M | Drop to previous major; pin |
| R10 | Scope creep vs 3-week window | H / H | P0-first; cut order in §3 |
| R11 | Duel desync/cheating accusations | L / M | Server-authoritative; honest play-fair note |
| R12 | Content quality (awkward sentences, culturally off Goa terms) | M / M | Lint + A5 spot-check |
| R13 | Autoplay audio blocked | H / L | First-click start screen |
| R14 | Server crash mid-demo | L / H | Auto-restart script; client reconnect; rooms are cheap to recreate |
| R15 | Judges don't "see" Flow usage | M / H | Flow Stats + Flow Lens + demo script (§16) |
| R16 | Windows path-with-spaces issues | M / L | Quote paths; `tsx` scripts |

---

## 14. DEFINITION OF DONE
All of the following, **verified by commands you actually ran** (cite them):
1. `npm run verify` passes (typecheck, lint, deps, content lint, unit/integration, build).
2. `npm run e2e` passes (or documented, justified skips only).
3. `sim:bots` calibration within bands; `sim:par` within ±10 % (or table updated).
4. Every **P0** feature in `01 §20` is implemented and has its acceptance test green.
5. Exactly two top-level modes; sentence dictation is the primary loop; power-ups only via explicit rules.
6. Game starts and is playable with no API keys, no `.glb`, no Blender, offline Championship.
7. Voice Duel works with **QR + code + link** between two browser contexts; reconnect/forfeit/rematch tested.
8. Fallback chain works (Flow-style bursts → Web Speech → Keyboard → Mock Autopilot).
9. Budgets in §11 met on the available machine or documented with measured numbers.
10. Visual acceptance `05 §19` and UI acceptance `07 §19` pass; screenshots were *viewed* and issues fixed.
11. `docs/FLOW_VALIDATION.md`, `docs/DEMO_SCRIPT.md`, `docs/DECISIONS.md`, `README.md`, `tests/reports/summary.md` exist and are accurate.
12. Final report is **honest** (see §17).

## 15. FINAL RELEASE CHECKLIST
- [ ] Versions pinned; lockfile committed; `npm ci` works from clean clone.
- [ ] `.env.example` complete; no secrets committed; `WISPR_API_KEY` never reaches the client bundle (grep the build).
- [ ] `/api/health` OK; WS origin check works; rate limits active.
- [ ] No `console.error`, no unhandled rejections in a 10-race soak.
- [ ] Palette/contrast/asset checks pass.
- [ ] Esc unbound; printable keys never intercepted (grep + e2e).
- [ ] Save migration tested; corrupt save recovers.
- [ ] All four reference images consulted (list how each influenced the build in `docs/DECISIONS.md`).
- [ ] No hackathon/studio logos or copied illustrations used.
- [ ] Audio: no speech output.
- [ ] README: run, test, deploy, controls, Flow setup, troubleshooting.

## 16. DEMO-DAY CHECKLIST (human, from Opus's `docs/DEMO_SCRIPT.md`)
**T-24 h:** both laptops: Wispr Flow installed/signed in, hotkeys confirmed, snippets + Goa dictionary added, Chrome/Edge updated, headsets paired; server deployed; `PUBLIC_BASE_URL` correct; QR join tested from the second laptop's webcam; backup video recorded.
**T-1 h:** venue Wi-Fi check → hotspot ready; run `npm run perf` on the demo laptop; set `quality`; Whisper Mode test; zoom/scale 100 %; close notification pop-ups; disable OS window-snap shortcuts if possible; volume set; Do-Not-Disturb ON.
**3-minute demo script (emphasise Flow):**
1. *(0:00)* Title → "Your voice is the engine."
2. *(0:15)* **Flow Setup**: hello test ✓; show **snippets** (`vox nitro`) and **Goa dictionary** list.
3. *(0:40)* **Championship L1**: hold Flow key → speak a stroke → word pops, boat surges; point at **Flow Stats** (words dictated vs typed, est. time saved).
4. *(1:20)* Say **"vox nitro"** (snippet fires ⚡), overtake Caju.
5. *(1:45)* **Pit Stop**: show a misheard Goan word → *Copy to Flow dictionary*.
6. *(2:00)* **Voice Duel**: friend scans the QR on their laptop (or types code); lobby; synced start; photo-finish; **Rematch**.
7. *(2:50)* Close: list the **7 ways we use Wispr Flow**: bursts as engine strokes · snippets as voice controls · dictionary as Goa pack + Pit Stop · cleanup-tolerant matching · paste-last recovery · hands-free long hauls · live Flow Stats/Lens.
**If something fails:** switch to Browser speech (Settings → Voice) → else `?provider=mock&script=demo1` → else backup video. Say what happened; honesty scores.

## 17. FINAL EXECUTION PROMPT FOR OPUS (copy–paste)

```text
You are Claude Opus 5.5, the lead engineer and QA lead for VOXWAKE: a stylised 3D Goa boat-racing game where the player's voice (via Wispr Flow dictation) is the engine.

AUTHORITATIVE DESIGN PACKAGE (read ALL of it, fully, before writing code):
  VOXWAKE_RESEARCH/01_GAME_VISION_AND_GDD.md
  VOXWAKE_RESEARCH/02_ENGINE_ARCHITECTURE_AND_CODEBASE.md   (its §0 Canonical Decision table wins every conflict)
  VOXWAKE_RESEARCH/03_VOICE_INPUT_AND_DICTATION_ENGINE.md
  VOXWAKE_RESEARCH/04_MULTIPLAYER_AND_AI_RACING.md
  VOXWAKE_RESEARCH/05_GOAN_WORLD_AND_ART_DIRECTION.md
  VOXWAKE_RESEARCH/06_RACING_PHYSICS_GAMEPLAY_AND_PROGRESSION.md
  VOXWAKE_RESEARCH/07_UI_UX_AUDIO_AND_PRESENTATION.md
  VOXWAKE_RESEARCH/08_OPUS_IMPLEMENTATION_AND_QA_PLAYBOOK.md (this process)
  VOXWAKE_RESEARCH/reference_images/REF_01…REF_04 (open and look at every image with the Read tool before building UI/world; 05 §2 explains what each shows and what NOT to copy)

MISSION
Implement the ENTIRE playable game described by the package in a new sibling folder `voxwake/` (quote paths; the parent folder name has spaces), run its tests, inspect failures, fix root causes, and validate before claiming completion.

HARD REQUIREMENTS (non-negotiable)
 1. Exactly TWO top-level modes: Championship (1 human + 4 AI bots; Endless Tide and Daily Regatta live inside it) and Voice Duel (2 players; room code + QR + link join, authoritative Node ws server).
 2. Stack per 02 §0: browser, TypeScript, Three.js, Vite, Preact, Node 22 + ws, monorepo (packages/shared, apps/client, apps/server). Re-check versions with `npm view` and pin exact versions.
 3. Sentence dictation is the core loop: sentences → strokes; Wispr Flow desktop dictation lands in the always-focused FlowDeck textarea as final-only bursts. Implement ISpeechProvider with FlowDeskProvider (primary), WebSpeechProvider, KeyboardProvider, MockProvider (+ optional FlowApiProvider behind ENABLE_FLOW_API, never required).
 4. Implement scoring, alignment, ASR-mercy, anti-exploit, commands (snippet sentinels + whole-burst "vox <cmd>"), Flow Stats, Flow Setup wizard, Lost-Wake recovery, Pit Stop exactly as specified in 03.
 5. Controls per CD-08: mouse steering, LMB Nitro, RMB Wave Jump, Shield passive, F1 pause. NEVER bind Esc, Space, printable keys, Ctrl/Win/Fn combos.
 6. Bots obey the fairness invariants FI-1…FI-8 (04 §1.2); no rubber-banding; deterministic.
 7. The game must start and be playable with NO API keys, NO .glb files, NO Blender, and (for Championship) NO network. P0 art is procedural. Optional systems (VFX, audio, post FX, multiplayer, external assets) must never block startup.
 8. Follow the Goa art direction and the palette/tokens in 05; use the four screenshots as STRUCTURAL references only (no logos, no copied illustrations, no event statistics).
 9. No third mode, no quiz gameplay, no monetisation, no pronunciation-quality claims, no TTS/speech output from the game.

PROCESS (do not stop for approval between milestones)
 - First message: one sentence on what you're about to do. Then create a task list (TaskCreate) mirroring milestones M0–M12 in 08 §3 and keep it updated.
 - Work milestone by milestone: implement → write tests → run them → read failures → fix ROOT CAUSES (never weaken or delete a test to pass) → `npm run verify` → git commit → next. The tree must build and the game must be playable after every commit from M4 onward.
 - Obey layering/dependency rules and the 400-line file limit (02 §11). No monoliths, no cycles, no `any` in public APIs, no Math.random/Date.now/DOM in packages/shared.
 - Author the full content bank (≥ 360 original Goa-flavoured sentences with strokes, 60 bonus phrases, 20 tongue-twisters) following 03 §9 and run the content linter.
 - Use Playwright screenshots to LOOK at your work (title, map, every level, HUD states, Duel hub/lobby/results) and fix visual defects before moving on.
 - Compute par times and bot calibration with the headless sims and update config if they miss the bands in 04 §1.8 / 06 §11.
 - Only stop for: a missing credential that truly blocks progress, a decision only the user can make (08 §18), or an unrecoverable environment failure. Otherwise pick the sensible default, record it in docs/DECISIONS.md, and continue.
 - Priorities: finish all P0 first (01 §20), then P1 in the cut-order of 08 §3. Never cut: FlowDeck/alignment/scoring correctness, Duel join (QR+code+link), bot fairness, Flow Stats, Flow Setup, fallbacks, tests.

HONEST REPORTING (mandatory)
 - You cannot run the real Wispr Flow desktop app, hear audio, or test two physical laptops. Do not claim you did. Simulate with MockProvider/headless Chromium/two browser contexts, say so, and write docs/FLOW_VALIDATION.md (checklist V1–V10 from 08 §9.8) for the human.
 - Write tests/reports/summary.md listing every command you actually ran, with counts of passed/failed/skipped, durations, and dates. Your final message must match those files exactly. Never state that a test passed unless you ran it and saw it pass. List skipped/unverified items explicitly.
 - Mark anything not verified as UNVERIFIED and say how to validate it.

DELIVERABLES
 voxwake/ (complete source), README.md, .env.example, docs/{DECISIONS,FLOW_VALIDATION,DEMO_SCRIPT,ASSET_LICENSES}.md, tests/ (unit, e2e, reports), working `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run e2e`, `npm run verify`.

FINAL MESSAGE FORMAT
 1) What was built (P0/P1/P2 status table). 2) Exact commands run + real results. 3) Performance numbers measured (and on what machine). 4) What the human must do (08 §5.2 H1–H8, §9.8, §16). 5) Known issues/limitations/unverified assumptions. 6) How the four reference images influenced the build.
Begin now.
```

---

## 18. Open decisions / assumptions for the user (also in the final chat message)
| ID | Question | Default Opus uses |
|---|---|---|
| A1 | "Judges evaluate Wispr Flow usage" — taken from the user, not from the screenshots | Proceed as stated |
| A2 | Show Hacker House / 2:47 PM Studio credit? | **No** logos; plain-text "Built for Hacker House Goa" only if user says yes |
| A3 | Rival names/food puns OK? | Yes |
| A4 | Timeline ≈ 3 weeks to 28 Oct 2026 | P0-first plan |
| A5 | Goa words, Konkani phrases ("Dev borem korum"), Devanagari sticker spelling need a Goan check | Use as written; flagged |
| A6 | Reference/demo laptop spec and OS | Windows laptop; Chrome/Edge |
| A7 | Hosting choice for Duel (laptop+tunnel vs PaaS) | Laptop + tunnel instructions |
| A8 | Does the user have Wispr **Pro** (Command Mode) and API access? | No; Rewrite Gate/API stay P2 |
