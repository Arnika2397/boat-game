# VOXWAKE — your voice is the engine

A stylised 3D boat race through Goa where **there is no throttle pedal**. A sentence hangs over the water on a rope sign; you hold your **Wispr Flow** key, say it, release, and every word Flow types into the game throws your boat forward. Clean phrases build a streak, fill the Flow ring and trigger **FLOW STATE**. Four rival captains who also "speak" their sentences race you down the coast.

Built with TypeScript + Three.js + Vite (client) and Node + `ws` (Voice Duel room server). All art and audio are generated in code: no downloaded models, textures or music.

## Run it

```bash
npm install
npm run build
npm start            # → http://localhost:8080  (game + Voice Duel rooms on one port)
```

For development with hot reload, run `npm run dev:server` and `npm run dev` together, then open http://localhost:5173. Championship works without the server; Voice Duel needs it.

| Command | What it does |
|---|---|
| `npm test` | 19 tests: voice engine, scoring, anti-exploit, content lint, bot determinism, full race by Flow bursts, duel server |
| `npm run sim` | Headless balance simulator: casual, average and skilled Flow players vs the bots on every level |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | typecheck + tests + build |

Useful URL flags: `?level=3` (jump straight into a level), `?autopilot=1` (Demo autopilot plays like a Wispr Flow user, for demos with no mic), `?join=CODE` (join a duel), `?test=1` (exposes `window.__VOXWAKE__`).

## Wispr Flow first (for judges)

* **Your own shortcut:** everyone's Wispr Flow key is different. Set yours in Flow Setup or Settings (pick a preset or click **Record my key**). Every instruction in the game then shows *your* key.
* **Flow check-in:** the first race of each session doesn't start until Wispr Flow is proven on. Double-tap your key, say "Goa is calling", double-tap again (Flow types it in), then double-tap once more and keep Flow on for the race. You can turn this off in Settings.
* **✦ Flow-verified:** words Flow's transcript confirms are marked verified, with bonus points. At the finish, double-tap your key to stop Flow and it verifies the whole race. Results show the **% Wispr Flow-verified** badge.

## How to play

| | |
|---|---|
| **Hold** | your Wispr Flow key (Windows **Ctrl + Win**, Mac **Fn**) |
| **Speak** | the sentence on the hanging sign, then release. Flow types it into the Flow Deck and the boat surges |
| **Steer** | with the **mouse** |
| **Left-click** | Nitro (earned by finishing a sentence at 90%+ accuracy) |
| **Right-click** | Wave Jump (won at bonus gates) |
| **Shield** | automatic (4 clean phrases in a row) |
| **F1 / F8** | Pause / Flow Lens (live Flow stats overlay) |

The game never binds **Esc** (that's Flow's cancel), Space, or any letter key. If Flow isn't installed, turn on **🎙 LIVE VOICE** in the race, or just type and press Enter.

### Live Voice + Wispr Flow fix (real-time, on by default)

In Chrome/Edge the race starts listening live automatically. Keep using Wispr Flow (double-tap for hands-free): the boat moves on every word as you say it, and when you stop Flow, its clean transcript **corrects** any word the live mic misheard in the current or last three sentences (✦ FLOW FIX bonus). If the live mic heard nothing, Flow's text drives the sentence as before.

#### Details

Wispr Flow's desktop app types its text into the game only when a dictation **ends**, even in locked hands-free mode, so no app can see the words before then. For word-by-word capture, click **🎙 LIVE VOICE** in the race HUD (or turn it on in Settings or Flow Setup). The game then listens through Chrome/Edge's speech recognition and credits each word **the moment you say it**: the boat surges mid-sentence, and a sentence completes as soon as its last word is heard. The choice is remembered and starts automatically each race. Words already credited live are never counted twice; Flow's text only repairs misheard words or fills in ones live missed.

**Live Voice needs Google Chrome or Microsoft Edge** (open `http://localhost:8080`, allow the microphone). Embedded preview windows block the mic; the game detects this and tells you. Say **"nitro"** (or "boost"/"turbo") any time for Nitro, and **"jump"**/**"hop"** for Wave Jump. These fire instantly, even mid-sentence, unless the word is on the sign itself.

## How Wispr Flow is used (what judges should look for)

1. **Bursts as engine strokes.** Flow delivers one clean, punctuated phrase per hold-and-release. Each burst is fuzzy-aligned to the sign, word by word, and turned into throttle. You can say the whole sentence in one breath, or split it.
2. **Cleanup-tolerant matching.** Fillers, stumbles, punctuation, capitals, homophones, numbers ("2026" = "twenty twenty six") and Goan spellings ("bibinca" → bebinca) never cost you. Recogniser slips get "ASR mercy" credit instead of a penalty.
3. **Snippets as voice controls.** Map `vox nitro` → `[[nitro]]` in Flow → Snippets. The game reads the sentinel token, so commands can never collide with sentence text. A plain spoken "vox nitro" works too, as do `vox jump`, `vox skip`, `vox again`, `vox play`, `vox ready`.
4. **Personal Dictionary.** Flow Setup gives you a one-click Goa dictionary pack. After each race, the Pit Stop tab lists words Flow misheard so you can add them.
5. **Paste-last-transcript recovery.** If the game loses focus mid-race it pauses and tells you to press Shift + Alt + Z (or ⌘ + Ctrl + V) to re-insert your last phrase.
6. **Hands-free for long sentences.** Later levels include long sentences and tongue-twisters; the aligner accepts multi-phrase bursts.
7. **Flow Stats + Flow Lens.** Every result shows words dictated vs typed, voice bursts, voice WPM and estimated time saved vs typing. F8 shows a live timeline of each burst: text → routing → credited words → throttle gain.

## Modes

* **Championship** (1 human + 4 AI): six hand-built Goa courses (Baga, Chapora, Mapusa, Anjuna golden hour, Fontainhas, Zuari night regatta), then **Endless Tide**, a seeded roguelike with 3 anchors. Top-3 unlocks the next course. The **🎟 Judge's pass** toggle on the map unlocks every course.
* **Voice Duel** (1 v 1): create a room, and your friend joins from their own laptop by **scanning the QR with their webcam**, typing the **5-letter code**, or opening the **link**. Synced 3-2-1 start, photo-finish result, best-of rematch.

The rivals are Captain Caju (sprinter), Maria Bebinca (metronome), Vindaloo Vasco (aggressor, hits hazards) and Shack Sensei Susegad (closer). They play by exactly the player's rules: same throttle physics, same scoring, earned power-ups, no rubber-banding, and they are deterministic per seed.

## The "one more race" loop

Word pops with rising pentatonic notes · streak ladder ×1.0→×2.0 with callouts · Flow State · overtakes with rival trash-talk · cashew combos · photo-finish slow-mo · 3-star stamps · XP bar and rank-ups that unlock boats · **Tiffin Crates** (cosmetic paints and wakes, with a pity timer) · a teaser of the next course · a 12 s auto-queue that says "vox again".

## Hosting a Voice Duel across two laptops

Both laptops must reach the server. Options:
* **Same Wi-Fi:** run `npm start` and have your friend open `http://<your-LAN-IP>:8080`. The webcam QR scan needs HTTPS or localhost, so on plain LAN use the code or link instead.
* **HTTPS tunnel** (e.g. `cloudflared tunnel --url http://localhost:8080`): set `PUBLIC_BASE_URL=https://<tunnel-host>` before `npm start` so the QR and link point at the tunnel.
* Any Node 22+ host with WebSockets works: start with `npm start` and health-check `/api/health`.

Environment variables: `PORT` (8080), `PUBLIC_BASE_URL`, `ROOM_TTL_MIN` (15), `RECONNECT_GRACE_MS` (30000).

## Privacy

The game never records or stores audio. Wispr Flow processes your voice under its own policy. Browser speech (optional) is processed by your browser vendor. Championship runs entirely on your device. Voice Duel sends only boat positions and race stats to the room server, which keeps them in memory only.

## Project layout

```
src/core      text normaliser, DP word aligner, voice-command parser, seeded RNG
src/game      course generation, race director, boat physics, bots, stages, rewards, levels
src/speech    FlowDeck (Wispr Flow input), browser-speech fallback, demo autopilot
src/world     Three.js renderer: toon materials + ink outlines, water/sky shaders, procedural Goa kit, boats, VFX
src/ui        screens (loading, title, setup, modes, map, postcard, HUD, results, duel, settings) + SVG art
src/audio     procedural WebAudio music stems and SFX
src/net       Voice Duel client
server/       room server (static hosting + WebSocket rooms)
tests/        unit + duel server tests        tools/sim.ts  balance simulator
```

See `docs/DEMO_SCRIPT.md` for a 3-minute judge demo, `docs/FLOW_VALIDATION.md` for the real-device checklist, and `docs/DECISIONS.md` for design decisions and known limits.
