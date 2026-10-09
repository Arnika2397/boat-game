/**
 * Headless balance simulator: scripted "Wispr Flow players" vs the 4 rival bots on every level.
 * Usage: npm run sim   (bundles with rolldown, runs in Node — no browser needed)
 */
import { RaceDirector } from '../src/game/race';
import { LEVELS } from '../src/game/levels';
import { BotBrain, RIVALS } from '../src/game/bots';

interface Profile { name: string; wpm: number; acc: number; latency: number }
const PROFILES: Profile[] = [
  { name: 'casual (typing-ish)', wpm: 55, acc: 0.85, latency: 1.4 },
  { name: 'average Flow user', wpm: 85, acc: 0.92, latency: 1.1 },
  { name: 'skilled Flow user', wpm: 115, acc: 0.96, latency: 0.9 },
];

function mutate(word: string, acc: number, r: () => number) {
  return r() > acc ? word.slice(0, Math.max(1, word.length - 3)) + 'zq' : word;
}

function runRace(levelIdx: number, p: Profile, seed: number) {
  const lv = LEVELS[levelIdx];
  const race = new RaceDirector({ level: lv, seed, mode: 'champ', heat: 0, levelNumber: lv.id, player: { name: 'P', boat: 'canoe', color: 0, accent: 0 } });
  race.countdown = 0.61;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const steer = new BotBrain(RIVALS[1], seed, 0.6, 0, race.stages);
  let nextBurst = 0.4;
  const dt = 1 / 60;
  let t = 0;
  for (let i = 0; i < 60 * 400 && race.state !== 'finished'; i++) {
    t += dt;
    race.update(dt);
    if (race.state !== 'racing') continue;
    steer.steer(race.player, race.course, race.boats, race.time, null);
    if (race.player.nitro > 0 && r() < 0.02) race.command('nitro', 'mouse');
    if (race.time >= nextBurst && !race.player.finished) {
      const st = race.stage;
      const di = st.tokDisp[Math.min(st.pointer, st.tokens.length - 1)];
      const rest = st.display.slice(di);
      const chunk = rest.length > 8 ? Math.ceil(rest.length / 2) : rest.length;
      const said = rest.slice(0, chunk).map((w) => mutate(w, p.acc, r)).join(' ');
      race.handleBurst(said, 'flow');
      nextBurst = race.time + (chunk * 60) / p.wpm + p.latency * (0.8 + r() * 0.4);
    }
  }
  const res = race.results();
  return { place: res.place, time: res.time, times: race.boats.map((b) => b.finishTime) };
}

const levels = process.argv[2] ? [Number(process.argv[2]) - 1] : LEVELS.map((_, i) => i);
for (const li of levels) {
  console.log(`\n=== L${li + 1} ${LEVELS[li].name} (rival skill ${LEVELS[li].rivalSkill}) ===`);
  for (const p of PROFILES) {
    const places: number[] = [];
    let tSum = 0;
    const botT = [0, 0, 0, 0];
    const N = 24;
    for (let k = 0; k < N; k++) {
      const out = runRace(li, p, 1000 + k * 7919);
      places.push(out.place);
      tSum += out.time;
      out.times.slice(1).forEach((x, j) => (botT[j] += x / N));
    }
    const win = places.filter((x) => x === 1).length / N;
    const pod = places.filter((x) => x <= 3).length / N;
    console.log(`${p.name.padEnd(22)} win ${(win * 100).toFixed(0).padStart(3)}%  podium ${(pod * 100).toFixed(0).padStart(3)}%  avg time ${(tSum / N).toFixed(1)}s  | bots ${botT.map((x) => x.toFixed(1)).join(' / ')}`);
  }
}
