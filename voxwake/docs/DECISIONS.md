# Decisions, deviations from the research package, and known limits

## Deliberate simplifications (to ship a polished, playable build)

| Research package said | Built | Why |
|---|---|---|
| npm-workspaces monorepo, Preact UI, zod | Single Vite app + `server/`; plain DOM UI via a tiny `h()` helper | Fewer moving parts; the HUD already updates by direct DOM refs as the spec asked |
| 12 levels | 6 hand-built levels + Endless Tide (seeded, cycles all looks incl. monsoon rain) | The spec's P0 is L1–L6 + Endless |
| Authoritative server sim for Duel | Server is authoritative for **rooms, start time, results, winner, rematch and plausibility flags**; each client simulates its own boat and relays position at 10 Hz | Much simpler netcode. Honest limit: a modified client could fake its finish time. The lobby says so ("play-fair") |
| Stroke windows (2–6 words) | Each burst aligns against the **whole remaining sentence** (DP, in order) | Works naturally with Wispr Flow's one-phrase-per-hold bursts and hands-free mode |
| Vitest + Playwright | `node:test` (bundled with rolldown) + manual browser checks | No extra toolchain; tests cover the engine, fairness and the duel server |

## Balance

Tuned with `npm run sim` (24 seeded races per profile per level, players use Nitro when it's ready):

| Level | Average Flow user (85 WPM) win / podium | Skilled (115 WPM) win |
|---|---|---|
| L1 Baga | 75% / 100% | 96% |
| L6 Zuari | 13% / 63% | 83% |

Casual typists still reach the L1 podium about 67% of the time, so the first race always feels good.

## Reference images

Used as **structure only**: the title follows the hero layout (giant Didone wordmark, Devanagari sticker, mono meta line, stitched CTA, rising sun). The loading screen uses rope-hung signs, the map uses the arrow-signpost composition, and menus/results use paper cards with hard shadows, kickers, ✦ bullets and alert boxes. No logos, illustrations, statistics or event copy were copied. The sticker reads **गोंय** ("Goem", Goa in Konkani). The title meta line says "Built for Hacker House Goa ’26" in plain text; remove it in `src/ui/screens/title.ts` if you'd rather not credit the event.

## Known limits

* Real Wispr Flow behaviour (insertion method, latency) is untested here; see `FLOW_VALIDATION.md`.
* The typed-vs-dictated split is a heuristic: one-key-at-a-time input counts as typed; a whole phrase arriving at once counts as Flow.
* Browser speech requires Chrome/Edge and a network connection (the speech is processed on the vendor's servers).
* Webcam QR scanning needs HTTPS or localhost.
