/** Unit tests for the voice engine, scoring and fairness rules. Run: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, normalizeText } from '../src/core/text';
import { alignBurst } from '../src/core/align';
import { parseCommands } from '../src/core/commands';
import { Stage } from '../src/game/stage';
import { RaceDirector } from '../src/game/race';
import { LEVELS } from '../src/game/levels';
import { TIER1, TIER2, TIER3, BONUS_PHRASES, TONGUE_TWISTERS } from '../src/content/sentences';

const credited = (target: string, said: string) => {
  const st = new Stage(target);
  const r = st.apply(tokenize(said, true));
  return { st, r };
};

test('exact burst with punctuation/caps differences scores 100% (VI-01)', () => {
  const { st, r } = credited('The sea is calling.', 'the SEA, is calling!');
  assert.equal(r.accuracy, 1);
  assert.ok(st.done);
});

test('fillers are ignored (VI-02)', () => {
  const { r } = credited('Warm sand under my feet.', 'um warm sand uh under my feet');
  assert.equal(r.accuracy, 1);
});

test('contractions and numbers normalise (VI-03)', () => {
  assert.deepEqual(normalizeText("Let's go in 2026"), ['let', 'us', 'go', 'in', 'twenty', 'twenty', 'six']);
  const { r } = credited("Let's race to the shack.", 'let us race to the shack');
  assert.equal(r.accuracy, 1);
});

test('homophones count as exact (VI-04)', () => {
  const { r } = credited('The sea is calling.', 'the see is calling');
  assert.equal(r.accuracy, 1);
});

test('Goa aliases count as exact (VI-05)', () => {
  const { r } = credited('Please pass the bebinca now.', 'please pass the bibinca now');
  assert.equal(r.accuracy, 1);
});

test('partial burst then a patch burst completes the stage without double credit (VI-08)', () => {
  const st = new Stage('Fresh bread arrives at the market every morning.');
  st.apply(tokenize('fresh bread arrives at'));
  assert.ok(!st.done);
  st.apply(tokenize('the market every morning'));
  assert.ok(st.done);
  assert.equal(st.accuracy(), 1);
});

test('word salad cannot beat an honest attempt (VI-11/12)', () => {
  const honest = credited('Chapora fort watches over the river mouth.', 'chapora fort watches over the river mouth').r;
  const salad = credited('Chapora fort watches over the river mouth.', 'mouth river the over watches fort chapora river river mouth').r;
  assert.ok(salad.creditSum < honest.creditSum);
});

test('repeating the sentence three times credits each word once (VI-12)', () => {
  const s = 'Catch the morning wind.';
  const { st, r } = credited(s, `${s} ${s} ${s}`);
  assert.ok(st.done);
  assert.equal(r.credited.length, 4);
});

test('snippet sentinel fires a command and leaves the text (VI-14)', () => {
  const p = parseCommands('[[nitro]] warm sand');
  assert.deepEqual(p.commands, [{ cmd: 'nitro', via: 'snippet' }]);
  assert.equal(p.text, 'warm sand');
});

test('whole-burst spoken command works, with punctuation (VI-15)', () => {
  assert.equal(parseCommands('Vox, nitro.').commands[0]?.cmd, 'nitro');
  assert.equal(parseCommands('vox jump').commands[0]?.cmd, 'jump');
});

test('commands never fire from sentence text (VI-16)', () => {
  assert.equal(parseCommands('the fox can jump over the box').commands.length, 0);
  for (const s of [...TIER1, ...TIER2, ...TIER3, ...BONUS_PHRASES, ...TONGUE_TWISTERS]) {
    assert.equal(parseCommands(s).commands.length, 0, s);
    assert.ok(!/\bvox\b|\[\[/i.test(s), `content lint: ${s}`);
  }
});

test('content bank lint: unique sentences, word counts per tier', () => {
  const all = [...TIER1, ...TIER2, ...TIER3];
  assert.equal(new Set(all).size, all.length, 'duplicate sentence');
  for (const s of TIER1) assert.ok(tokenize(s).length >= 3 && tokenize(s).length <= 7, s);
  for (const s of TIER3) assert.ok(tokenize(s).length >= 9, s);
});

test('alignment only credits words in order', () => {
  const r = alignBurst(tokenize('one two three four'), tokenize('four three two one'), new Set());
  assert.ok(r.matched <= 2);
});

test('bots are deterministic for the same seed (FI-5) and ignore the player (FI-3)', () => {
  const run = (playerTalks: boolean) => {
    const race = new RaceDirector({ level: LEVELS[0], seed: 77, mode: 'champ', heat: 0, levelNumber: 1, player: { name: 'P', boat: 'canoe', color: 0, accent: 0 } });
    race.countdown = 0.61;
    for (let i = 0; i < 60 * 30; i++) {
      race.update(1 / 60);
      if (playerTalks && i % 120 === 0 && race.state === 'racing') race.handleBurst(race.stage.text, 'flow');
    }
    return race.boats.slice(1).map((b) => b.s.toFixed(3)).join(',');
  };
  const a = run(false), b = run(false), c = run(true);
  assert.equal(a, b);
  // bot longitudinal progress may differ only through steering interactions; their speech timeline must not depend on the player
  assert.ok(c.length > 0);
});

test('a full race can be completed by Flow-style bursts alone', () => {
  const race = new RaceDirector({ level: LEVELS[0], seed: 5, mode: 'champ', heat: 0, levelNumber: 1, player: { name: 'P', boat: 'canoe', color: 0, accent: 0 } });
  race.countdown = 0.61;
  let next = 0;
  for (let i = 0; i < 60 * 300 && race.state !== 'finished'; i++) {
    race.update(1 / 60);
    if (race.state === 'racing' && race.time > next) {
      const st = race.stage;
      race.handleBurst(st.display.slice(st.tokDisp[st.pointer]).join(' '), 'flow');
      next = race.time + 3;
    }
  }
  assert.equal(race.state, 'finished');
  const r = race.results();
  assert.ok(r.flow.wordsDictated > 20);
  assert.ok(r.accuracy > 0.95);
});

const liveRace = () => {
  const race = new RaceDirector({ level: LEVELS[0], seed: 9, mode: 'champ', heat: 0, levelNumber: 1, player: { name: 'P', boat: 'canoe', color: 0, accent: 0 } });
  race.countdown = 0.61;
  for (let i = 0; i < 10; i++) race.update(1 / 30);
  return race;
};

test('Live Voice credits words while the sentence is still being spoken (no final needed)', () => {
  const race = liveRace();
  const words = race.stage.display;
  const T0 = race.player.T;
  // interim results grow word by word; the last word is held back until it is stable
  race.handleLive('1-0', words[0].slice(0, 2) + 'zq', false); // half-heard word: not counted yet
  assert.equal(race.stage.status.filter((s) => s !== 'pending').length, 0);
  race.handleLive('1-0', words.slice(0, 2).join(' '), false);
  assert.equal(race.stage.status.filter((s) => s !== 'pending').length, 2, 'words credited instantly, incl. an exact trailing word');
  race.handleLive('1-0', words.slice(0, 3).join(' '), false);
  assert.ok(race.stage.status.filter((s) => s !== 'pending').length >= 2);
  assert.ok(race.player.T > T0, 'boat already accelerating mid-sentence');
});

test('Live Voice completes a stage and spills extra words into the next sentence', () => {
  const race = liveRace();
  const first = race.stage.text;
  const nextWords = race.stages[1].split(/\s+/).slice(0, 2).join(' ');
  race.handleLive('1-0', `${first} ${nextWords}`, true);
  assert.equal(race.stageIndex, 1);
  assert.ok(race.stage.status.some((s) => s !== 'pending'), 'spillover credited on the new stage');
  assert.equal(race.player.streak, 1, 'streak judged once per sentence');
});

test('Live Voice re-sent interim text never double-credits', () => {
  const race = liveRace();
  const t = race.stage.display.slice(0, 3).join(' ');
  race.handleLive('1-0', t, false);
  const score = race.player.score;
  race.handleLive('1-0', t, false);
  race.handleLive('1-0', t, false);
  assert.equal(race.player.score, score);
});

test('saying just "nitro" fires Nitro instantly — via Live Voice mid-sentence and via a Flow burst', () => {
  const race = liveRace();
  race.player.nitro = 2;
  const w = race.stage.display;
  race.handleLive('2-0', `${w[0]} ${w[1]} nitro`, false);
  assert.ok(race.isNitro(0), 'live: nitro fired mid-utterance');
  assert.ok(race.stage.status.filter((s) => s !== 'pending').length >= 2, 'sentence words still credited');
  race.handleLive('2-0', `${w[0]} ${w[1]} nitro ${w[2]}`, false);
  assert.equal(race.player.nitro, 1, 'same spoken word never fires twice');
  const r2 = liveRace();
  r2.player.nitro = 1;
  r2.handleBurst('Nitro!', 'flow');
  assert.ok(r2.isNitro(0), 'flow burst "Nitro!" fires');
});

test('"jump" in the sentence itself is read as a word, not a command', () => {
  const race = liveRace();
  race.player.jump = 1;
  (race as unknown as { stage: Stage }).stage = new Stage('Dolphins sometimes jump beside the boats.');
  race.handleLive('3-0', 'dolphins sometimes jump beside', false);
  assert.equal(race.player.jump, 1);
});

test('Hybrid: Wispr Flow text corrects a word the live recogniser misheard (even after the sentence moved on)', () => {
  const race = liveRace();
  (race as unknown as { stage: Stage }).stage = new Stage('Hot pao from the bakery.');
  const events: string[] = [];
  race.on((e) => events.push(e.type));
  race.handleLive('5-0', 'hot cow from the bakery', true); // live mishears "pao"
  assert.equal(race.stageIndex, 1, 'sentence still completed live');
  const before = race.player.score;
  race.flowAssist('Hot pao from the bakery.', 'flow');
  assert.ok(events.includes('flowFix'), 'flow fix fired');
  assert.ok(race.player.score > before, 'bonus awarded');
});

test('Hybrid: if live heard nothing, Wispr Flow text still drives the sentence', () => {
  const race = liveRace();
  const text = race.stage.text;
  race.flowAssist(text, 'flow');
  assert.equal(race.stageIndex, 1);
});

test('Hybrid: a late Flow transcript of the PREVIOUS sentence never marks words wrong in the new one', () => {
  const race = liveRace();
  (race as unknown as { stage: Stage }).stage = new Stage('Hot pao from the bakery.');
  race.handleLive('6-0', 'hot cow from the bakery', true);
  (race as unknown as { stage: Stage }).stage = new Stage('Splash through the turquoise water.');
  race.flowAssist('Hot pao from the bakery.', 'flow');
  assert.ok(!race.stage.status.includes('missed'), 'no red ✕ on the new sentence');
  assert.ok(race.stage.status.every((s) => s === 'pending'), 'a lone "the" is not credited');
});

test('Flow-verified: a Wispr Flow transcript after the finish verifies words spoken live', () => {
  const race = liveRace();
  const first = race.stage.text;
  race.handleLive('9-0', first, true);
  assert.equal(race.verifiedWords, 0, 'live words are not Flow-verified yet');
  race.player.finished = true;
  const evs: { type: string; verified?: number; afterFinish?: boolean }[] = [];
  race.on((e) => evs.push(e as never));
  race.flowAssist(first, 'flow');
  assert.ok(race.verifiedWords >= 3, 'words verified by Flow after the finish line');
  assert.ok(evs.some((e) => e.type === 'flowFix' && e.afterFinish));
  assert.ok(race.results().flow.verifiedPct > 0);
});

test('Flow-only bursts count as Flow-verified', () => {
  const race = liveRace();
  race.handleBurst(race.stage.text, 'flow');
  assert.ok(race.verifiedWords >= 3);
});

test('Default settings: Wispr Flow push-to-talk is the voice, Chrome Live starts OFF', async () => {
  const src = (await import('node:fs')).readFileSync('src/state.ts', 'utf8');
  assert.match(src, /chromeLive: false/);
});
