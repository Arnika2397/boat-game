# 03 — VOICE INPUT AND DICTATION ENGINE (Wispr Flow-first)

> **Canonical owner of:** everything about speech → text → score: Wispr Flow feasibility, provider strategy, FlowDeck, alignment, ASR-mercy, **scoring formulas (CD-05)**, voice commands (CD-12), latency accounting, Flow Setup wizard, Flow Stats, content lint.
> Obeys `02 §0`. Throttle/speed mapping is in `06 §3`. Multiplayer validation is in `04 §2.5`.
> Verification date for every **[VERIFIED]** below: **2026-10-07**.

---

## 1. Wispr Flow feasibility research

### 1.1 Sources consulted

| # | Source | URL | What it established |
|---|---|---|---|
| S1 | Wispr Flow **Voice Interface API** intro | https://api-docs.wisprflow.ai/introduction | A Flow API exists: WebSocket `/ws` (recommended) and REST `/api` (slower); 100+ languages; auto-edits, filler removal. Two auth modes: API key (backend) or **client-side access tokens** (recommended, lower latency). |
| S2 | WebSocket API spec | https://api-docs.wisprflow.ai/websocket_api | URLs, message types `auth` / `append` / `commit`, audio = base64 **16 kHz mono int16 PCM WAV**, response `status:"text"` with `body.text`, `final`. |
| S3 | WebSocket quickstart | https://api-docs.wisprflow.ai/websocket_quickstart | AudioWorklet capture at 48 kHz → resample to 16 kHz; mic needs **HTTPS or localhost**. |
| S4 | Quickstart | https://api-docs.wisprflow.ai/quickstart | **"Flow API is only available by exclusive access. Your organization must be approved by the Flow team"** (dashboard https://platform.wisprflow.ai; contact enterprise@wisprflow.ai). |
| S5 | Generate access token | https://api-docs.wisprflow.ai/generate_access_token | `POST https://platform-api.wisprflow.ai/api/v1/dash/generate_access_token`, `Authorization: Bearer fl-…`, body `{client_id, duration_secs, metadata?}` → `{access_token, expires_in}`. |
| S6 | Client-side auth basics | https://api-docs.wisprflow.ai/client_side_auth_basics | Browser uses JWT as `?client_key=Bearer%20<JWT>` on WS; 401 `Token has expired` on expiry. |
| S7 | Usage & billing | https://api-docs.wisprflow.ai/usage_billing | Token-usage billing; **no free-tier info published**; no user-set rate limits. |
| S8 | Hotkeys / shortcuts | https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts | **Windows:** push-to-talk **Ctrl+Win**, hands-free **Ctrl+Win+Space**, Command Mode **Ctrl+Win+Alt**, paste last transcript **Shift+Alt+Z**, copy last **Shift+Alt+X**, cancel **Escape**. **Mac:** PTT **Fn**, hands-free **Fn+Space**, Command **Fn+Ctrl**, paste last **Cmd+Ctrl+V**, copy last **Cmd+Ctrl+C**, cancel **Escape**. Custom combos must include a modifier or valid mouse button, ≤ 3 keys; Windows blocks standalone Ctrl and several Win combos. |
| S9 | Product guide (secondary, third-party) | https://sidsaladi.substack.com/p/wispr-flow-101-the-complete-guide | Hold-key dictation; self-correction cleanup ("Tuesday, wait no, Friday" → "Friday"); filler removal; auto-punctuation/caps; **Snippets** (trigger ≤ 60 chars, expansion ≤ 4,000 chars); **Personal Dictionary** (auto-learns corrections); Command Mode (Pro); Whisper Mode; Hands-free (double-tap); 100+ languages incl. a Hinglish model. *Secondary source → treat details as [VERIFIED-secondary].* |
| S10 | Flow for Developers | https://wisprflow.ai/developers | Desktop (Mac/Windows) + mobile; Pro $12/user/mo (as published); **no API/SDK/hackathon-programme info on this page.** |
| S11 | MDN SpeechRecognition | https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition | **Limited availability (not Baseline)**; `continuous`, `interimResults`, `maxAlternatives`; experimental `phrases`, `processLocally`; Chrome-type engines are **server-based** (audio leaves the device; no offline). |

### 1.2 Distinctions the master prompt demands (explicit answers)

| Question | Answer | Status |
|---|---|---|
| **Can Wispr Flow insert dictated text into an active application?** | Yes — that is the core product: hold hotkey, speak, text appears at the cursor of the focused app. A focused browser `<textarea>` is an ordinary target. | [VERIFIED product behaviour: S8/S9/S10]; exact insertion mechanism (clipboard paste vs simulated typing) **[UNVERIFIED]** |
| **Can the game capture microphone audio directly?** | Yes via `getUserMedia` (HTTPS/localhost). Used only for optional cosmetic voice-activity and the Web Speech fallback. Does not give the game Wispr's text. | [VERIFIED web standard; S3 notes secure-context rule] |
| **Does the desktop Flow app provide the game with *partial* transcripts?** | **No.** Text arrives after the hold is released (one burst). No streaming hook exists for third-party apps. | Behaviour [UNVERIFIED in detail]; **design assumes final-only bursts — the safest assumption.** |
| **Does it provide *finalized* transcripts?** | Yes — the inserted text *is* the finalized, cleaned transcript (fillers removed, punctuation added). | [VERIFIED-secondary S9] |
| **Can we detect command phrases?** | Yes, two ways: (a) **Flow snippets** that expand a spoken trigger into a sentinel token `[[nitro]]`; (b) a strict whole-burst grammar `vox <cmd>`. | Snippets [VERIFIED-secondary S9]; grammar [PROPOSED] |
| **Can we measure speaking time?** | **Not with Flow Desktop** (no speech-start/end signal). Only `tStrokeShown → tArrive` ("burst time"). With Web Speech (`speechstart/speechend`) or Flow API (we record the audio) we *can*. | [VERIFIED limitation by absence; MDN lists `speechstart/speechend`] |
| **Can we measure recognition latency?** | Flow Desktop: **not separable** from speaking time. Flow API: `tCommit → tText` is measurable. Web Speech: `speechend → final` is measurable. | [PROPOSED accounting; §10] |
| **Is there a public API for the *desktop app's* output?** | **No documented one.** The **Flow Voice Interface API** is a *separate* cloud API that needs us to stream audio ourselves and requires **Wispr approval**. | [VERIFIED S4] |

### 1.3 Recommendation (with the six elements the master prompt requires)

1. **Recommendation.** **Primary = Wispr Flow Desktop dictating into the game's always-focused `FlowDeck` textarea.** Fallback chain: Browser Web Speech → Keyboard assist. Optional upgrade: `FlowApiProvider` if the hackathon/user obtains API access.
2. **Why appropriate.** Works today with no credentials or approval; no audio plumbing; players already use Flow; showcases Flow's real strengths (clean punctuated bursts, snippets, dictionary).
3. **Evidence.** S4 (API gated), S8 (hotkeys), S9 (snippets, cleanup), S11 (Web Speech limits).
4. **Implementation implications.** Final-only bursts → *stroke* design (`01 §7.1`); tolerant alignment; focus management; no printable-key interception; mouse-first controls.
5. **Risks/limitations.** Insertion timing/latency unknown; can't prove speech vs typing; hotkey conflicts (§2.4); Command Mode/Snippets need Pro/config on the player's machine; Flow may be unavailable on a judge's laptop.
6. **Fallback.** `WebSpeechProvider` (interim + final) → `KeyboardProvider` (typed assist) → `MockProvider` (scripted demo). A **"Demo Autopilot"** (`?provider=mock&script=demo1`) lets the team show a perfect run if the venue's mic/network fails.

**Validation tests to run on the real demo laptop before 28 Oct (feeds `08 §9`):**
- **V1** Dictate 10 phrases into the FlowDeck on Chrome and Edge; record `inputType`, chars, and arrival spans (does it paste or type?).
- **V2** Measure end-of-hold → text latency (screen-record, frame-count) over 20 bursts; set `flowLatencyBudgetMs` = median + 1 σ.
- **V3** Confirm snippet expansion `vox nitro` → `[[nitro]]` lands intact in a textarea.
- **V4** Confirm focus is retained after Flow inserts text (no blur).
- **V5** Check whether holding Ctrl+Win and pressing arrow keys triggers OS window snapping (expected: yes → mouse steering).
- **V6** Check Whisper Mode accuracy in venue noise.

---

## 2. Flow-native mechanics catalogue **[CREATIVE unless noted]**

Each row: *what Flow does → what the game does with it → priority → fallback*.

| ID | Mechanic | Flow capability used | Detail | Pri | Fallback |
|---|---|---|---|---|---|
| **F1** | **Stroke Rhythm & Cadence** | Hold-to-talk burst | Sentence = strokes; each burst = one boat "stroke". **Cadence** = steadiness of inter-burst timing (§7.5). Cadence ≥ 0.8 over 4 strokes → "Perfect Rhythm" (+0.05 Flow-meter gain per stroke, metronome ring lit). | P0 | Same with Web Speech |
| **F2** | **Voice Shortcuts via Snippets** | Snippets | `vox nitro` → `[[nitro]]` etc. Collision-proof command channel (§8, setup §14). | P0 | Spoken `vox <cmd>` whole-burst grammar; mouse buttons |
| **F3** | **Self-correction tolerance** | Backtrack/filler removal | The game *expects* clean text; UI copy: "Stumble freely — Flow cleans your wake." No penalty for "um", restarts. We do **not** try to detect self-correction (the cleaned text hides it). | P0 | n/a |
| **F4** | **Lost-Wake Recovery** | Paste last transcript (Win Shift+Alt+Z / Mac Cmd+Ctrl+V) | If the window/tab lost focus when text arrived or `FlowDeck` isn't focused at a burst-expected time, show banner "Click the game, then press *Shift+Alt+Z* to re-insert your last phrase." | P0 | Re-say phrase |
| **F5** | **Esc reserved** | Cancel = Escape | Game never binds Esc; pause = **F1**. | P0 | — |
| **F6** | **Goa Dictionary Pack + Pit Stop** | Personal Dictionary | Setup lists ~45 Goan terms to paste into Flow's dictionary; after each race **Pit Stop** shows words that were mis-heard with a **Copy** button. | P1 (static list P0) | Words still accepted via aliases |
| **F7** | **Hands-free Long Haul** | Hands-free (Win Ctrl+Win+Space / Mac Fn+Space) | Long-sentence stages recommend hands-free; aligner accepts a burst spanning several strokes; "Long Haul" bonus ×1.15 for flawless stage. | P1 | Normal PTT |
| **F8** | **Whisper Duel etiquette** | Whisper Mode | Setup/Lobby tip for same-room play; no mechanic. | P1 | — |
| **F9** | **Rewrite Gate** | Command Mode (Win Ctrl+Win+Alt) | Gate shows an **error-ridden sentence selected in a mini-textarea**; player uses Command Mode ("fix the grammar") → Flow rewrites; game validates *structurally* (required tokens present, forbidden tokens gone, similarity ≥ 0.8 to any accepted variant). Always skippable, never blocks the race. Pro-only per S9 → **P2**. | P2 | Skip button / no gate |
| **F10** | **Hinglish Pack** | Hinglish model | Optional sentence pack in mixed Hindi-English with Goa flavour. | P2 | — |
| **F11** | **Flow Stats panel** | (all) | Words dictated vs typed, bursts, avg WPM, "est. time saved vs typing" (§15). Always on results; live in `?judge=1`. | **P0** | — |
| **F12** | **Flow Lens overlay** | (all) | Timeline per burst: `shown → arrived → tokens → alignment → score → throttle`. | P1 | — |
| **F13** | **Voice-only menus** | Snippets/commands | Title/Results/Pause accept `[[play]]`, `[[again]]`, `[[menu]]`, `[[ready]]` so a player never leaves the voice loop. | P1 (`again` P0) | Mouse |
| **F14** | **Early-bird start** | Burst latency | Bursts arriving during the last 1000 ms of the countdown are buffered and applied at GO (so a player who starts talking at "1" isn't penalised by Flow latency). | P0 | — |
| **F15** | **Flow API upgrade** | Voice Interface API | `FlowApiProvider` (§4.5): game records mic, streams to Flow, receives text → also enables speaking-time and recognition-latency measurement. | P2 | Desktop path |

### 2.4 Hotkey and input conflict matrix (drives CD-08)

| Conflict | Why | Resolution |
|---|---|---|
| **Win held (Ctrl+Win PTT) + arrow keys** | Windows uses Win+Arrow for window snap/maximise/minimise → pressing arrows while holding PTT would hijack the window | **Mouse steering default**; keyboard steering offered only if player remaps PTT to a non-Win combo (e.g., Ctrl+Alt — **[UNVERIFIED valid]**, Setup tests it) |
| **Mac Fn + arrows** | Fn+Arrow = Home/End/PgUp/PgDn | Mouse steering |
| **Esc** | Flow *Cancel* | Never bound; pause = F1 |
| **Space** | Flow hands-free = Ctrl+Win+Space / Fn+Space | Game never uses Space |
| **Shift+Alt+Z / X** (Win), **Cmd+Ctrl+V/C** (Mac) | Flow paste/copy last transcript | Never bound |
| **Printable keys** | If Flow inserts by simulated keystrokes, intercepting letters/digits would corrupt dictation | **Never `preventDefault` printable keys while FlowDeck is focused** |
| **Right-click** | Browser context menu | `contextmenu` → `preventDefault` on the canvas only |

---

## 3. Provider strategy and selection

| Order | Provider | `id` | Interim? | Speaking-time? | Needs mic perm in browser? | Notes |
|---|---|---|---|---|---|---|
| 1 (primary) | `FlowDeskProvider` | `flow-desk` | No | No | **No** (Flow owns the mic) | Textarea event capture |
| 2 | `WebSpeechProvider` | `web-speech` | Yes | Yes (`speechstart/end`) | Yes | Chrome/Edge only [VERIFIED limited availability]; server-based; `lang` default `en-IN`; `maxAlternatives = 3`; `phrases` bias if supported |
| 3 | `KeyboardProvider` | `keyboard` | live typing | n/a | No | Accessibility/typed assist; flagged in Duel |
| 4 | `MockProvider` | `mock` | optional | scripted | No | Tests, CI, Demo Autopilot |
| opt. | `FlowApiProvider` | `flow-api` | No (final on commit) | Yes (we record) | Yes | Approval-gated; behind `ENABLE_FLOW_API` |

**Selection logic (`SpeechInput.selectProvider`):**
```
if settings.voice != 'auto': use it
else:
  FlowDeskProvider is ALWAYS attached (passive listener) — it costs nothing.
  WebSpeechProvider is attached only if settings.voice == 'web-speech' OR FlowDetector has not seen a flow-like burst after setup AND user clicks "Use browser mic".
  Never run Web Speech and Flow simultaneously by default (double text, mic contention).
```
Rationale: FlowDeck passively accepts *anything* inserted (Flow, paste, typing), so the primary provider is always listening; Web Speech is opt-in to avoid mic prompts that confuse a Flow-first demo.

---

## 4. FlowDeck and provider contracts

### 4.1 FlowDeck DOM and focus
```html
<div id="flowdeck-wrap" class="flowdeck">           <!-- visible strip at bottom: "FLOW DECK" -->
  <textarea id="flowdeck" rows="1" autocomplete="off" autocapitalize="off" spellcheck="false"
            aria-label="Voice input. Hold your Wispr Flow key, speak, release."></textarea>
  <span class="flowdeck-last">…last burst appears here, then slides up into the sign…</span>
</div>
```
- **Always visible** (not `display:none`, not zero-size) so it's focusable and judges can see text arrive. Styled as a small cream card with magenta dashed ring (reference image 03 mic motif).
- **Focus policy:** `focus({preventScroll:true})` on screen enter, race start, after any overlay closes. On `blur`: if `relatedTarget` is an interactive control we own (Join-code input, settings slider) → leave; otherwise refocus after 50 ms. On `window blur`/`visibilitychange:hidden` → set `focusLost`; on return show the **Lost-Wake banner** if a burst was expected (race running, last burst > 4 s ago).
- **Input pipeline (`FlowDeskProvider`):**
  1. Listen to `beforeinput` (read `inputType`, `data`), `input`, `compositionstart/end`, `paste`.
  2. On first `input` of a burst record `tFirst`; every subsequent `input` updates `tLast`, counts `events`.
  3. **Coalesce:** flush after `BURST_QUIET_MS = 220` of silence (config `speech.burstQuietMs`), or immediately on `paste` (single event).
  4. On flush: `text = textarea.value.trim()`; clear textarea; strip control chars; reject if `text.length == 0`; hard cap `MAX_BURST_CHARS = 600`.
  5. Build `TranscriptEvent{kind:'burst', source: classify(...), meta:{insertType, chars, events, spanMs}}`.
  6. **Classify source:** `typed` if `inputType=='insertText'` AND `events ≥ chars*0.8` AND median inter-event gap ≥ 40 ms; else `flow-desk`. (Typed → `source:'keyboard'`, counted as *typed* in Flow Stats and flagged in Duel.)
  7. IME composition: ignore events while `isComposing`.
- **Enter key** inside FlowDeck: `preventDefault` + treated as "flush now" (Flow may append a newline). Enter is *not* a printable char and is safe.

### 4.2 `FlowDetector` (setup + passive)
`flowLikely = true` when ≥ 1 burst has `chars ≥ 12` AND `spanMs ≤ 150` AND not typed-like. Shown as "**Looks like Wispr Flow dictation ✓**" (never "verified"). Setup also runs the **say-this test**: "Hold your Flow key and say: *Goa is calling.*" → pass when normalised text matches ≥ 0.75.

### 4.3 `ISpeechProvider` lifecycle
`start()` idempotent; `stop()` idempotent; provider errors are *events*, never thrown after start. `SpeechInput` owns provider switching and forwards **only** `TranscriptEvent`s to `TranscriptRouter`.

### 4.4 `WebSpeechProvider` rules **[PROPOSED; API shape VERIFIED via MDN]**
```
rec.continuous = true; rec.interimResults = true; rec.lang = settings.lang ('en-IN'); rec.maxAlternatives = 3
if ('phrases' in rec) rec.phrases = goaDictionary   // experimental, guarded
onresult(e): for i from e.resultIndex..e.results.length-1:
   r = e.results[i]
   if r.isFinal: emit burst(best alternative by alignment score) ; markFinal(i)
   else: emit interim(concat non-final)           // display only, never scored
onend: if wanted → restart with 250 ms backoff (cap 5/min; escalate to error)
onerror: map 'not-allowed'|'service-not-allowed' → PERMISSION_DENIED; 'no-speech' → ignore; 'audio-capture' → NO_MIC; 'network' → NETWORK
```
Reconcile partial/final: interim events update only the *ghost transcript* line; scoring uses only `final`. Maintain `lastFinalIndex` to avoid re-emitting results after a restart.

### 4.5 `FlowApiProvider` (P2) **[spec from S2–S6; practical behaviour UNVERIFIED]**
1. Client asks server `GET /api/flow/token` (only exists if `ENABLE_FLOW_API=1`); server calls S5 with `WISPR_API_KEY` and returns `{access_token, expires_in}`.
2. Hold **Shift** (non-printable; configurable) → open `wss://platform-api.wisprflow.ai/api/v1/dash/client_ws?client_key=Bearer%20<token>`, send `{type:'auth', access_token, language:['en'], context:{dictionary_context:[...goaDictionary]}}`.
3. AudioWorklet @48 kHz → resample 16 kHz mono int16 → WAV chunks, base64 → `{type:'append', position, audio_packets:{packets, volumes, packet_duration, audio_encoding:'wav', byte_encoding:'base64'}}`. **Use fixed-duration chunks** (docs warn variable durations can fail).
4. On release send `{type:'commit', total_packets:N}`; on `status:'text'` + `final:true` → emit burst; record `recognitionMs = tText − tCommit`.
5. Warm-up endpoint exists (S: `warm_up_api`) — call on lobby/pre-race to cut first-burst latency. **[UNVERIFIED details; read https://api-docs.wisprflow.ai/warm_up_api.md at implementation time.]**
6. Requires HTTPS/localhost for the mic. Explicit opt-in toggle ("Send my voice to Wispr's cloud").

---

## 5. Target-text alignment

### 5.1 Normalisation pipeline (`shared/text/normalize.ts`) — applied identically to targets and transcripts
1. Unicode **NFKC**; lowercase; straighten quotes.
2. Remove sentinel tokens `[[…]]` (commands handled earlier, §8).
3. Replace `-`, `/`, `—` with space; drop all other punctuation except in-word apostrophes.
4. **Contractions expanded** both sides: `it's→it is`, `don't→do not`, `I'm→i am`, `let's→let us`, `gonna→going to`, `wanna→want to`.
5. **Numbers → words** both sides (`numbers.ts`): digits 0–9999, years as pairs (`2026 → twenty twenty six`), ordinals, `%`. Target entries may carry an explicit `alts[]` for odd cases.
6. **Fillers dropped** from the transcript only if absent from the target: `um, uh, er, erm, ah, hmm, like(only when sentence-initial and not in target)`.
7. **Homophone classes** (`homophones.json`): `{to,too,two}`, `{their,there,they are}`, `{sea,see}`, `{whole,hole}`, `{wave,waive}`, `{sail,sale}`, `{tide,tied}`, `{rows,rose}`, `{ferry,fairy}`(near class), `{ate,eight}`, `{four,for,fore}`, `{one,won}`…
8. **Goa aliases** (`goa_dictionary.json`): `panaji|panjim|panjam`, `mandovi|mandavi|mandovy`, `bebinca|bibinca|bebinka`, `xacuti|shakuti|chacuti|zacuti`, `sorpotel|sarapatel|sorpatel`, `susegad|sossegad|suzegad`, `fontainhas|fontaines|fontainas`, `dudhsagar|doodhsagar|dudh sagar`, `chapora|chaporra`, `anjuna|anjunna`, etc.
9. Token = `{norm, phon}` where `phon = metaphoneLite(norm)` (≈ 80 LOC; simplified Metaphone: drop vowels after first letter, map `ph→f`, `ck→k`, `sh/ch→x`, etc.).

### 5.2 Match tiers for a (target t, heard u) pair
| Tier | Rule | Credit (`scoring.json`) |
|---|---|---|
| `exact` | `t.norm == u.norm` or same homophone/alias class | **1.0** |
| `near` | len(t) ≥ 4 and `1 − lev/maxLen ≥ 0.80`, **or** `t.phon == u.phon` (len ≥ 3) | **0.8** |
| `mercy` | similarity ≥ 0.60 **and** (t flagged `hardForASR` **or** in Goa dictionary **or** phonetic prefix(3) equal) **and** stage mercy budget left | **0.7** |
| `missed` | otherwise | 0 |
Words of ≤ 3 letters must be `exact` (prevents "a/the/to" false positives).

### 5.3 Alignment algorithm (`alignBurst`) — semi-global DP
Inputs: `unresolved` = target words of the current stage **not yet credited/finalised**, in order; window `W` = tokens of the **current stroke + next stroke** (or the entire remainder if burst words > strokeLen + 2, i.e. hands-free); burst tokens `U[1..m]` (truncated to `1.5·W + 4`).

```
score(i,j) = max(
  score(i-1,j-1) + gain(U[i], T[j]),          // exact +2.0, near +1.6, mercy +1.0, mismatch -1.0
  score(i-1,j)   - 0.4,                        // extra heard token (cheap: fillers/ASR ghosts)
  score(i,j-1)   - 0.8 )                       // skipped target word
free end-gap in target (burst may end before window ends); free leading extras in transcript capped at 2.
Trace back → per-target-word status. Pointer = position after last matched target word.
```
Complexity ≤ 40×40 — microseconds. Deterministic (ties → prefer earlier target match). Implemented in `shared/align` so client, bots and **server** produce identical results.

Because alignment targets *unresolved* words, a retry that re-says the whole stroke simply treats already-credited words as cheap extras — **patching comes for free**.

### 5.4 Word-level progression and highlighting
Each target word has state: `pending | active | credited(exact|near|mercy) | missed`. UI (`07 §7`): pending = ink; active (first unresolved of current stroke) = underlined magenta; credited = yellow fill + checkmark glyph (not colour-only); mercy = yellow + dotted underline; missed = red-pink outline + ✕ (colour-blind safe).

### 5.5 Stroke and stage completion
- A stroke **completes** when all its words are resolved, **or** accuracy of the best attempt ≥ `passThreshold = 0.75` (remaining words finalised `missed`), **or** the player `[[skip]]`s/clicks Skip, **or** `strokeStallSec = 12` expires (Skip offered, never forced).
- A stage completes when its last stroke completes. A burst may complete several strokes (spill) in one go.
- **Second Wind (retry):** if accuracy < 0.75, stroke stays open, shows "Say it again" with only unresolved words emphasised; retry credit scaled by `retryFactor = 0.8` on score and `0.6` on throttle gain (`06 §3`). After **2 failed attempts** a Skip chip pulses.

### 5.6 Punctuation and capitalisation
Ignored entirely in matching. The sign **displays** punctuated, capitalised text; Flow's capitalisation never matters.

### 5.7 Duplicate, stale and partial/final reconciliation (`TranscriptRouter`)
| Case | Rule |
|---|---|
| **Duplicate** | Same `normalizedText` hash within `dupWindowMs = 800` of the previous burst *and* it adds no new unresolved matches → drop (`flag:duplicate`). Covers double-paste / `Shift+Alt+Z` re-insertion. |
| **Stale after stage change** | For `staleWindowMs = 1500` after a stage transition, if a burst aligns ≥ 70 % to the **previous stage's tail** better than to the current head → drop (`flag:stale`). |
| **Epoch** | `epoch++` on countdown start, skip, race end, pause/resume. A burst whose captured `epoch` ≠ current epoch is dropped, except **early-bird** bursts (F14). |
| **Interim vs final** | Interim never scored (display only). Only finals/bursts reach the aligner. |
| **Command vs text** | Commands parsed first (§8); leftover text continues to alignment. |
| **No-input / garbage** | Empty, `<1` token, or only fillers → `ignored` (no streak break, no penalty). |
| **Provider burst > 40 words** | Truncate to 40; flag `long-burst`. |

---

## 6. Recogniser-error vs player-error (fairness)

Every non-credited target word is tagged `errorClass`:
- `asr-suspect` — phonetically near (`phon` equal, lev ≤ 2 for len ≥ 6), a Goa-dictionary / `hardForASR` word, a single dropped function word amid otherwise perfect speech, or burst arrived during `focusLost`.
- `player-miss` — heard text unrelated (or nothing) for that word.

**ASR Mercy (applied in `scoring/mercy.ts`):**
- `mercyPerStage = 1` (**2** if ≥ 25 % of the stage is Goa/hard vocabulary). A mercy word gets credit 0.7 and **never** breaks the streak.
- If an entire stroke has ≥ 60 % credited and **all** misses are `asr-suspect`, the stroke counts as **clean** (streak holds).
- `no-speech`/empty bursts are not errors.
- Pit Stop uses `asr-suspect` words to tell the player *"Flow may have misheard 'Bebinca' — add it to your Flow dictionary."* — turning recogniser flaws into a mechanic instead of a punishment.

We **do not** claim to measure pronunciation, confidence, or communication quality; scoring measures *textual agreement with the displayed sentence*, pace, and consistency only. Mic volume is **never** used for correctness.

---

## 7. SCORING (canonical — CD-05)

All constants in `packages/shared/config/scoring.json`.

### 7.1 Definitions
`n` = words in stroke; `credit_i ∈ {1, 0.8, 0.7, 0}`; `A = Σcredit_i / n`; `clean = A ≥ 0.90 (after mercy)`.

### 7.2 Word value
```
baseWord(w) = 10 × lenFactor(w) × vocabFactor(w)
lenFactor: ≤3 letters 0.8 | 4–6 1.0 | 7–9 1.2 | ≥10 1.4
vocabFactor: Goa/hardForASR word 1.4 else 1.0
strokeBase = Σ credit_i × baseWord(w_i)
```

### 7.3 Multipliers
```
Streak M = 1 + 0.10 × min(cleanStreak, 10)            → 1.0 … 2.0
FlowStateMult = 1.5 while Flow State active
M_total = min(M × FlowStateMult, 3.0)
Pace  r = wpmEff / wpmTarget(L);   P = clamp(0.85 + 0.15 × r, 0.85, 1.15)
   wpmEff = creditedWords × 60 / max(0.8, burstSeconds)
   wpmTarget(L) = 95 + 6 × (L − 1)     (L1 = 95 … L12 = 161; Endless: 161 + 2×k up to 200)
   burstSeconds = tArrive − max(strokeShownAt, previousBurstArrivedAt)   // includes read + speak + Flow latency (honest, unseparated)
AccuracyKicker K = 1.10 if A ≥ 0.95 else 1.00
FinalSprintMult = 1.25 in the last 20 % of course else 1.0
RetryFactor = 0.8 if this is a retry attempt else 1.0
```
```
strokeScore = round( strokeBase × M_total × P × K × FinalSprintMult × RetryFactor )
```
### 7.4 Stage bonus (on stage completion)
```
stageAcc = mean(A over strokes);   stageBonus = round( 60 × stageAcc² × (flawless ? 1.25 : 1) × FinalSprintMult )
flawless = every stroke clean on first attempt and zero missed words
```
Pace effects are bounded at **±15 %**; accuracy dominates (word credits + K + streak), so **speed alone cannot win** and shouting/noise yields zero (no text → no score).

### 7.5 Cadence (consistency) and Flow State
```
last 4 inter-burst intervals normalised per word: d_k = interval_k / wordsInStroke_k
CV = stddev(d)/mean(d);   cadence = clamp(1 − CV/0.5, 0, 1)         // needs ≥ 3 strokes else 0.5
PerfectRhythm = cadence ≥ 0.8 over 4 strokes
Flow meter: +0.18 per clean stroke, +0.05 extra on PerfectRhythm, hold on non-clean pass, −0.15 on failed/skipped stroke; no passive decay
meter ≥ 1.0 → FLOW STATE for 8 s (meter resets to 0)
```
### 7.6 Anti-exploit protections (all unit-tested)
| Exploit | Defence |
|---|---|
| Word-salad / shotgun (say every word, many times) | Burst truncated to `1.5·W+4` tokens; extras beyond `3 + 0.4n` each subtract 0.05 from `A` (floor 0); alignment only credits **in-order** matches; each target word credited once |
| Repeating the whole sentence in one burst | Only first alignment pass; later repeats are extras |
| Re-pasting the same text (Shift+Alt+Z, Ctrl+V) | Duplicate window + resolved-word extras give nothing |
| Pre-pasting upcoming sentence text early | Window is the **current + next stroke only** (unless hands-free long burst ≤ 40 words); text beyond window ignored |
| Implausible pace (typing-assisted/paste) | `wpmEff > 260` → `P = 1.0`, flag `implausible-pace`; **Duel:** after 3 flags → anomaly badge in results (no auto-forfeit) |
| Spam commands | Command cooldown 400 ms; power-ups need charges |
| Stale/replayed bursts | Epoch + stale windows (§5.7) |
| Duel client lying about score | **Server recomputes** `evaluateStroke` from the submitted transcript text (`04 §2.5`) |

### 7.7 Output contract
```ts
interface StrokeResult {
  stageId: string; strokeIndex: number; attempt: number; tick: number;
  words: { idx: number; status: 'exact'|'near'|'mercy'|'missed'|'pending'; credit: number; errorClass?: 'asr-suspect'|'player-miss'; heard?: string }[];
  accuracy: number; creditedWords: number; clean: boolean;
  strokeCompleted: boolean; stageCompleted: boolean; spill: number;      // extra strokes completed by the same burst
  score: number; stageBonus: number;
  pace: { wpmEff: number; P: number; implausible: boolean };
  cadence: number; flowMeterDelta: number; streakAfter: number;
  latency: LatencyBreakdown; flags: string[];
}
```

---

## 8. Voice commands (CD-12)

### 8.1 Command set
| Command | Sentinel | Spoken (after wake) | Allowed in | Effect |
|---|---|---|---|---|
| nitro | `[[nitro]]` | `vox nitro` | Race | Activate Nitro if charge |
| jump | `[[jump]]` | `vox jump`, `vox wave jump` | Race | Wave Jump (`06 §9`) |
| skip | `[[skip]]` | `vox skip` | Race | Skip current stroke |
| pause | `[[pause]]` | `vox pause` | Race | Pause |
| again | `[[again]]` | `vox again`, `vox retry` | Results | Restart/next race |
| play | `[[play]]` | `vox play`, `vox start` | Title/Map | Start |
| ready | `[[ready]]` | `vox ready` | Lobby | Ready toggle |
| menu | `[[menu]]` | `vox menu`, `vox home` | Results/Pause | Back |

Wake aliases: `vox, vocs, voks, vaux, box, fox` (only whole-burst).

### 8.2 Parsing order in `TranscriptRouter`
1. **Sentinel scan** `\[\[\s*([a-z]+)\s*\]\]` — remove tokens, queue commands; remaining text (often empty) continues.
2. **Whole-burst grammar:** normalised burst is *exactly* `wake + cmdAlias` (2–3 tokens). If so → command, no alignment.
3. Else → text → aligner.

### 8.3 Preventing accidental activation (both directions)
- **Content lint** (`shared/content/lint.ts`) **fails the build** if any stage/stroke/bonus phrase contains a sentinel, the token `vox`, or any 2–3-token window equal to `wakeAlias + cmdAlias`.
- Spoken commands require the **whole burst** to be the command → a command word *inside* a sentence never fires.
- Sentinel brackets cannot be produced by ordinary speech.
- Commands never count as sentence text (they're stripped before alignment).
- `nitro`/`jump` with no charge → toast "No Nitro yet", no penalty.

### 8.4 Gate vs sentence routing
When a Bonus Phrase Gate is active, each burst is aligned against **both** the gate phrase and the current stroke window; the higher `A × matchedWords` wins; **ties → main sentence**. If the gate wins, the burst is consumed by the gate and does not affect the sentence (and vice-versa). Gate consumption never touches streak/throttle except the reward.

### 8.5 Fallback for players without a command channel
Mouse: **LMB = Nitro, RMB = Wave Jump**; keyboard alt: ↑ / ↓. Spoken `vox <cmd>` works with no Flow setup.

---

## 9. Content authoring, lint and samples

### 9.1 Content schema (`sentences.json`)
```jsonc
{ "id": "B10-017", "band": 10, "tier": "hard", "text": "Please pass the bebinca before the monsoon washes the road away.",
  "strokes": ["Please pass the bebinca", "before the monsoon", "washes the road away."],
  "goaWords": ["bebinca"], "hardForASR": ["bebinca"], "tags": ["food","monsoon"] }
```
### 9.2 Lint rules (enforced by `npm run lint:content`)
Unique ids · every stroke 2–6 words (Long-Haul strokes ≤ 9) · strokes concatenate exactly to `text` · word count must lie inside the **`wordsRange` of its `band`** (levels 1–12 in `06 §11`: 4–6, 5–7, 6–8, 7–9, 8–10, 8–11, 9–12, 10–13, 10–14, 11–15, 12–16, 12–18; Endless bands reuse band 12 with Long sentences up to 22) · no profanity (word list) · no real-person names · no copyrighted lines (all **original**) · no `vox`/sentinels/command windows · numbers ≤ 3 per sentence · Goa-word ratio per band (bands 1–3: 0–3 %, 4–6: ≤ 8 %, 7–9: ≤ 15 %, 10–12: ≤ 25 %) · ≥ 30 sentences per band (12 bands ⇒ ≥ 360 total). A level's stage composer draws from bands `L−1, L, L+1` (≈ 90 candidates for 12–18 slots) with no repeats inside a session. **`tier`** (`easy` = bands 1–4, `medium` = 5–8, `hard` = 9–12) is derived from the band and is what the Voice Duel "Sentence Tier" selector (Easy/Medium/Hard) uses.
### 9.3 Opus must author the full bank (≥ 360 sentences) in this style. Seed samples:

| Band (≈) | Sentence (strokes `|`) |
|---|---|
| 1–2 | `The sea | is calling.` · `Warm sand | under my feet.` · `Let's race | to the shack.` · `Palm trees | wave hello.` · `Catch the | morning wind.` |
| 4–5 | `The fishing boats | glide past | the old fort.` · `Fresh bread arrives | at the market | every morning.` · `A yellow balcony | hangs above | the quiet canal.` |
| 10–11 | `Seagulls circle the ferry | as the evening bells | ring across the river.` · `Please pass the bebinca | before the monsoon | washes the road away.` |
| 12 | `At Fontainhas, colourful houses | lean over narrow lanes | while the afternoon smells | of fresh pao and frying fish.` |
| Tongue Tangle | `Six silver sailboats | skim the shining sea.` · `Cashew crunch | and coconut crush | on the Candolim coast.` |
| Bonus phrase | `Full steam ahead` · `Catch the tide` · `Susegad speed` · `Wave jump now` · `Dev borem korum` *(Konkani; **[ASSUMPTION A5] verify with a Konkani speaker**)* |

### 9.4 Goa Dictionary Pack (static list shown in Flow Setup; ~45 entries)
Panaji/Panjim · Mapusa · Margao · Vasco da Gama · Mandovi · Zuari · Chapora · Anjuna · Vagator · Calangute · Candolim · Baga · Palolem · Agonda · Aguada · Miramar · Dudhsagar · Fontainhas · Divar · Chorão · Cabo de Rama · Bebinca · Xacuti · Sorpotel · Vindaloo · Pao · Poi · Caju · Feni · Susegad · Shigmo · Konkani · Goenkar · Azulejo · Ro-Ro · Dona Paula · Old Goa · Se Cathedral · Reis Magos · Tiracol · Arambol · Morjim · Betul · Cola · Butterfly Beach. *(Real place/food names; spellings to be spot-checked by a Goan.)*

---

## 10. Latency accounting (master prompt: separate four things)

```ts
interface LatencyBreakdown {
  speakingMs: number | null;      // Web Speech (speechend − speechstart), Flow API (hold duration). Flow Desktop: null
  recognitionMs: number | null;   // Web Speech (final − speechend), Flow API (tText − tCommit). Flow Desktop: null
  burstMs: number;                // ALWAYS: tArrive − max(strokeShownAt, prevBurstArrivedAt)  (read+speak+recognise, unseparated)
  netRttMs: number | null;        // Duel: median RTT from TimeSync; Championship: null
  gameMs: number;                 // tApplied − tArrive, measured in-client (budget ≤ 1 frame + 16 ms)
}
```
- **Flow Desktop** can never split speaking vs recognition — the UI and docs say so ("Burst time").
- Scoring pace uses `burstMs` only (provider-independent, fair across providers).
- Targets **[PROPOSED, validate with V2]**: `gameMs ≤ 33`; `flowLatencyBudgetMs` set from the V2 measurement (provisional **1200 ms** median guess **[UNVERIFIED]**); Duel `netRtt` p95 ≤ 150 ms for a good experience.
- HUD: while waiting after a perceived release (hold hint or > 600 ms since last burst expected) show a subtle "Flow is thinking…" shimmer on the sign — **cosmetic**.

---

## 11. Timeouts, recovery and failure states

| Situation | Detection | Behaviour |
|---|---|---|
| **Mic permission denied** (Web Speech/Flow API only) | `not-allowed` | Toast "Microphone blocked — click 🔒 in the address bar to allow, or use Wispr Flow / keyboard assist." Auto-switch to FlowDeck-only. |
| **No mic / device lost** | `audio-capture` | Same; offer Keyboard assist |
| **Web Speech stops unexpectedly** | `end` while wanted | Auto-restart with 250 ms backoff; after 5 restarts/min → toast + fall back to FlowDeck/keyboard |
| **No burst for 12 s on a stroke** | `strokeStallSec` | Pulse Skip chip + hint "Hold your Flow key and read the highlighted words" |
| **FlowDeck lost focus** | blur/visibility | Refocus; Lost-Wake banner (F4) |
| **Flow not running** | `flowLikely` false after 20 s of race with zero bursts | Non-blocking suggestion "Flow not detected — open Wispr Flow, or switch to Browser speech" |
| **Network (Web Speech `network`)** | error | Switch to FlowDeck/keyboard, keep race going |
| **Garbage burst** | < 1 token | Ignored |
| **Burst during pause/menu** | state check | Dropped (stale) |
| **Provider emits after race end** | epoch | Dropped |
| **Everything fails** | — | Keyboard assist (non-ranked in Duel) so the demo never dead-ends |

---

## 12. Multiplayer transcript handling (details `04 §2.5`)
- Each stroke submission: `{stageId, strokeIndex, attempt, text, tArriveClient, source, meta.insertType, flags}`; **text only, ≤ 600 chars**, never audio.
- **Server** re-runs `normalize` + `alignBurst` + `evaluateStroke` with the same shared code and the **server's own** stage state; client's claimed score is advisory.
- Plausibility: `wpmEff` ceiling 260, minimum inter-burst gap 250 ms, `typed` source flagged to both players only as a small ⌨ badge on the *result screen* (not during the race) unless host enabled "Voice-only duel" (rejects `keyboard` source).
- Optional **Mic Witness** (P1, opt-in): client measures mic RMS via `AnalyserNode` and attaches `micActive:boolean` (true if energy above noise floor within ±3 s of the burst). Used **only** as an anomaly hint (never correctness; never scoring). Requires mic permission → default OFF.
- Honest statement shown in the Duel lobby: *"Voice Duel is play-fair: we check pace and text patterns, but can't prove you spoke."*

## 13. Privacy and audio retention
- The game **never records or stores audio**. Wispr Flow Desktop handles audio under Wispr's own policy **[UNVERIFIED — link the player to Wispr's privacy policy; do not paraphrase it]**.
- Web Speech: audio is processed by the browser vendor's service **[VERIFIED, MDN S11]** — Settings shows this notice before enabling.
- Flow API (P2): audio goes to Wispr's cloud; explicit opt-in.
- Duel: only stroke **text** is sent to our server, kept in memory for the room's life (TTL ≤ 60 min), not written to disk; logs store counts, never text.
- Championship: zero data leaves the device (beyond the speech provider itself).
- No analytics SDKs.

## 14. Flow Setup wizard (screen `FlowSetup`) — spec
Goal: ≤ 60 s, fully skippable, resumable.

| Step | UI | Logic |
|---|---|---|
| 1 **Is Flow running?** | Card: "Open Wispr Flow (get it at wisprflow.ai/get-started)" + OS toggle (Windows/Mac auto-detected via `navigator.userAgent`) | none |
| 2 **Say hello** | FlowDeck focused; "Hold **Ctrl+Win** (or **Fn** on Mac) and say *Goa is calling*" | pass when match ≥ 0.75 → ✓ "Looks like Wispr Flow"; show measured burst latency |
| 3 **Hotkey card** | Table of the verified hotkeys (§2.4) + "Game uses **mouse** to steer because Ctrl+Win + arrows snap windows" | choose steering: Mouse (default) / Keyboard (needs PTT remap; test button) |
| 4 **Voice Shortcuts (optional)** | Table rows with **Copy trigger** / **Copy expansion** buttons: `vox nitro → [[nitro]]`, `vox jump → [[jump]]`, `vox again → [[again]]`, `vox play → [[play]]`, `vox menu → [[menu]]`, `vox skip → [[skip]]`, `vox ready → [[ready]]`. Note: "Snippets are global — remove them from Flow → Snippets when you're done." | Test box: "Say *vox nitro*" → expects `[[nitro]]` **or** a whole-burst `vox nitro` |
| 5 **Goa Dictionary (optional)** | One-click **Copy all** of §9.4 list + "Flow → Settings → Personalization → Dictionary" *(path [VERIFIED-secondary S9])* | none |
| 6 **Calibration lap** | 20-s mini race = Level 1 stage 1 + 2 | Doubles as tutorial; records baseline latency/WPM → default `wpmTarget` offset (±10 %) |

Persist `flowSetup` in the save file; "Redo Flow Setup" lives in Settings.

## 15. Flow Stats (F11) — definition
```
wordsDictated   = Σ creditedWords from sources flow-desk | web-speech | flow-api
wordsTyped      = Σ words from source keyboard
bursts          = count of accepted bursts
avgWPM          = wordsDictated / (Σ burstSeconds / 60)
voicePct        = wordsDictated / (wordsDictated + wordsTyped)
estTimeSavedSec = wordsDictated × (60 / typingBaselineWPM) − Σ burstSeconds          (typingBaselineWPM default 40, user-editable; shown as "est.")
snippetsFired   = commands that arrived as sentinel tokens
```
Displayed on Results (card styled like reference image 03), lifetime in Profile, live in `?judge=1`. **Labelled estimates**; never claims pronunciation quality.

## 16. Mock provider and test fixtures
`MockProvider(script)` supports: scripted bursts with `delayMs`, jitter, **duplicate**, **stale replay**, **empty**, **filler-only**, **command sentinel**, **spoken-command**, **word-salad**, **typed-like**, **ASR-error substitutions** (injects phonetic neighbours), **long burst**. `Demo Autopilot` scripts (`demo1`: perfect run L1; `demo2`: realistic 92 % accuracy with 2 ASR errors; `demo3`: Duel host script).

## 17. Acceptance tests (voice) — IDs referenced by `08 §9`
| ID | Test | Pass criterion |
|---|---|---|
| VI-01 | Exact burst with punctuation/caps differences | All words `exact`, A = 1 |
| VI-02 | Filler words ("um", "uh") inserted | No penalty |
| VI-03 | Contractions & number forms ("it's" vs "it is", "2026") | Matches |
| VI-04 | Homophone substitution | `exact` |
| VI-05 | Goa word mis-heard ("bibinca") | alias → `exact`; unknown near-miss → `mercy` |
| VI-06 | One dropped function word amid perfect speech | Stroke `clean`, streak holds |
| VI-07 | Burst spans 2 strokes (hands-free) | Both complete, `spill = 1` |
| VI-08 | Partial burst then patch burst of the missed words | Missed words credited by patch; total ≤ 1 credit/word |
| VI-09 | Duplicate burst within 800 ms | Dropped |
| VI-10 | Stale burst after stage change | Dropped |
| VI-11 | Word-salad containing all target words repeatedly | A reduced; score ≤ honest attempt score |
| VI-12 | Whole sentence repeated 3× in one burst | Credited once |
| VI-13 | Burst > 40 words | Truncated; flagged |
| VI-14 | Sentinel `[[nitro]]` with text after it | Nitro fires; text aligned |
| VI-15 | `vox nitro` whole burst | Fires; `Vox, nitro.` also fires |
| VI-16 | Sentence containing "box" or "fox" adjacent to a word | **Never** fires a command (lint + whole-burst rule) |
| VI-17 | Gate active; burst matches gate phrase | Consumed by gate only; sentence untouched |
| VI-18 | Early-bird burst in last 1000 ms of countdown | Applied at GO |
| VI-19 | `wpmEff > 260` | `P = 1`, flag set |
| VI-20 | Focus loss mid-race | Banner shown; refocus works; no exception |
| VI-21 | Web Speech `end` event storm | Max 5 restarts/min then fallback |
| VI-22 | Mic permission denied | Toast + FlowDeck remains functional |
| VI-23 | Typed-like insertion classified `keyboard` | Counted as typed; Duel flag |
| VI-24 | Scoring goldens (10 hand-computed strokes) | Exact integer match |
| VI-25 | Server vs client recompute on 1,000 random bursts | 100 % identical results |
| VI-26 | Flow Stats math on a scripted session | Matches hand calc |
| VI-27 | Content lint rejects collision sample | Build fails as expected |
| VI-28 | FlowDetector on paste-like vs typed-like | Correct classification |
| VI-29 | Cadence calc on steady vs erratic bursts | ≥ 0.8 vs ≤ 0.4 |
| VI-30 | Real-device Flow checklist V1–V6 (human) | Documented results in `docs/FLOW_VALIDATION.md` |
