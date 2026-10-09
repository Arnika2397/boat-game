# Real-device Wispr Flow validation (run by a human before demo day)

These can't be automated: the Wispr Flow desktop app can't be driven headlessly. In automated tests, Flow is simulated by pasting whole phrases into the Flow Deck. Fill in the results column.

| # | Check | How | Result |
|---|---|---|---|
| V1 | Flow inserts text into the Flow Deck | Start a race, dictate 10 phrases in Chrome and Edge. The Flow Deck chip should read **WISPR FLOW ✓** (not KEYBOARD ASSIST) | |
| V2 | Burst latency | Screen-record 20 bursts: time from key release to text appearing. If median > 1.5 s, tell players to start the next phrase sooner | |
| V3 | Snippets | Add `vox nitro` → `[[nitro]]` in Flow → Snippets. In Flow Setup step 4, say "vox nitro" and expect "⚡ Snippet fired" | |
| V4 | Focus is kept | After Flow inserts text, the next phrase still lands in the Flow Deck (no clicking needed) | |
| V5 | Window-snap conflict | Holding Ctrl+Win and pressing arrows snaps windows, which is why steering is on the mouse | |
| V6 | Venue noise | Try Whisper Mode with headphones in a noisy room | |
| V7 | Webcam QR join | Second laptop: Voice Duel → Join → Scan QR (needs HTTPS or localhost) | |
| V8 | Two-laptop duel | Both laptops race over your chosen host; check the start is in sync | |
| V9 | Mic bleed | With speakers on, music must not trigger dictation (the game never outputs speech) | |
| V10 | Full rehearsal | Run `docs/DEMO_SCRIPT.md` end to end | |
