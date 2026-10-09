import { tokenize } from '../core/text';
import { parseCommands, type Command } from '../core/commands';
import { alignBurst } from '../core/align';
import { forkRng } from '../core/rng';
import type { WordStatus } from '../core/align';
import { TIER1, TIER2, TIER3, TONGUE_TWISTERS } from '../content/sentences';
import { Course, HAZARD_SPEC, type Gate, type Hazard, type Pickup } from './course';
import type { LevelDef } from './levels';
import { BotBrain, RIVALS, type BoatKind, type Rival } from './bots';
import { Stage } from './stage';
import {
  SIM_DT, BOAT_R, newBoat, levelPhysics, stepLongitudinal, stepLateral, applyStrokeOutcome, activateNitro,
  activateJump, isAir, isFlow, isNitro, streakMult, type BoatState, type LevelPhysics,
} from './sim';

const VOICE_CMDS: Record<string, Command> = { nitro: 'nitro', nitros: 'nitro', boost: 'nitro', turbo: 'nitro', jump: 'jump', hop: 'jump' };

export type Source = 'flow' | 'web-speech' | 'keyboard' | 'autopilot';

export type RaceEvent =
  | { type: 'words'; stage: Stage; credited: number[]; missed: number[] }
  | { type: 'burst'; text: string; source: Source; accuracy: number; clean: boolean; gain: number; score: number; credited: number; target: 'main' | 'gate' | 'none' | 'live' }
  | { type: 'stageDone'; acc: number; flawless: boolean; bonus: number }
  | { type: 'newStage'; stage: Stage; index: number }
  | { type: 'callout'; text: string; kind: 'good' | 'great' | 'epic' | 'info' | 'warn' }
  | { type: 'powerup'; kind: 'nitro' | 'shield' | 'jump'; action: 'earn' | 'use' | 'deny' | 'absorb'; boat: number; via?: string }
  | { type: 'hazard'; boat: number; hazard: Hazard; shielded: boolean }
  | { type: 'pickup'; boat: number; pickup: Pickup; chain: number }
  | { type: 'flow'; boat: number; on: boolean }
  | { type: 'overtake'; passed: string; place: number }
  | { type: 'overtaken'; by: string; place: number }
  | { type: 'finalSprint' }
  | { type: 'gateOpen'; gate: Gate }
  | { type: 'gateResult'; gate: Gate; success: boolean; reward?: string }
  | { type: 'finish'; boat: number; place: number; time: number }
  | { type: 'raceEnd' }
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'commentary'; text: string; who: string; color: number }
  | { type: 'command'; cmd: Command; via: string; ok: boolean }
  | { type: 'streak'; streak: number }
  | { type: 'flowFix'; words: string[]; score: number; currentStage: boolean; verified: number; afterFinish: boolean };

export interface Racer { name: string; short: string; color: number; accent: number; boat: BoatKind; rival?: Rival; isPlayer: boolean; remote?: boolean }

export interface LensEntry { t: number; text: string; source: Source; credited: number; accuracy: number; gain: number; score: number; routed: string }

export interface RaceOptions {
  level: LevelDef; seed: number; mode: 'champ' | 'duel'; heat: number;
  player: { name: string; boat: BoatKind; color: number; accent: number };
  opponent?: { name: string; boat: BoatKind; color: number; accent: number };
  levelNumber: number;
}

export function composeStages(level: LevelDef, seed: number, count: number): string[] {
  const rng = forkRng(seed, 'stages');
  const pool = level.tier === 1 ? [...TIER1] : level.tier === 2 ? [...TIER2, ...TIER1.slice(0, 8)] : [...TIER3, ...TIER2.slice(0, 10)];
  const list = rng.shuffle(pool).slice(0, count);
  if (level.tier >= 2 && level.id >= 4) list.splice(Math.floor(count * 0.6), 0, rng.pick(TONGUE_TWISTERS));
  return list;
}

export class RaceDirector {
  readonly opts: RaceOptions;
  readonly course: Course;
  readonly boats: BoatState[] = [];
  readonly racers: Racer[] = [];
  readonly bots: (BotBrain | null)[] = [];
  readonly phys: LevelPhysics;
  readonly stages: string[];
  stage: Stage;
  stageIndex = 0;
  state: 'countdown' | 'racing' | 'finished' = 'countdown';
  countdown = 3.6;
  time = 0;
  paused = false;
  /** true while the pre-race Wispr Flow check-in is open */
  gate = false;
  private acc = 0;
  /** previous-tick snapshot per boat, for smooth render interpolation between 30 Hz sim ticks */
  private prev: { s: number; lat: number; yaw: number }[] = [];
  private listeners: ((e: RaceEvent) => void)[] = [];
  private lastBurstAt = 0;
  private earlyBird: { text: string; source: Source }[] = [];
  finalSprint = false;
  activeGate: Gate | null = null;
  private gatesDone = new Set<number>();
  private pickupChain = 0;
  private lastPickupAt = -10;
  private lastPlace = 5;
  private firstFinishAt = -1;
  stageStalledAt = 0;
  // stats
  wordsDictated = 0; wordsTyped = 0; verifiedWords = 0; bursts = 0; burstSeconds = 0; snippets = 0; spokenCmds = 0;
  creditTotal = 0; resolvedTotal = 0; cleanBursts = 0;
  misheard: { word: string; heard: string }[] = [];
  lens: LensEntry[] = [];
  stageTimes: { text: string; sec: number; acc: number }[] = [];
  remoteFinished = false;

  constructor(opts: RaceOptions) {
    this.opts = opts;
    const n = opts.mode === 'champ' ? 5 : 2;
    this.course = new Course(opts.level, opts.seed, n);
    this.phys = levelPhysics(opts.levelNumber);
    this.stages = composeStages(opts.level, opts.seed, 22);
    const lanes = n === 5 ? [0, -7, 7, -3.5, 3.5] : [-3, 3];
    const hw = opts.level.halfWidth;
    for (let i = 0; i < n; i++) this.boats.push(newBoat(i, Math.max(-hw + 2, Math.min(hw - 2, lanes[i]))));
    this.racers.push({ name: opts.player.name, short: 'YOU', color: opts.player.color, accent: opts.player.accent, boat: opts.player.boat, isPlayer: true });
    this.bots.push(null);
    if (opts.mode === 'champ') {
      RIVALS.forEach((r) => {
        this.racers.push({ name: r.name, short: r.short, color: r.color, accent: r.accent, boat: r.boat, rival: r, isPlayer: false });
        this.bots.push(new BotBrain(r, opts.seed, opts.level.rivalSkill, opts.heat, this.stages));
      });
    } else if (opts.opponent) {
      const o = opts.opponent;
      this.racers.push({ name: o.name, short: o.name.slice(0, 8).toUpperCase(), color: o.color, accent: o.accent, boat: o.boat, isPlayer: false, remote: true });
      this.bots.push(null);
    }
    this.stage = new Stage(this.stages[0]);
  }

  on(cb: (e: RaceEvent) => void) { this.listeners.push(cb); }
  private emit(e: RaceEvent) { for (const l of this.listeners) l(e); }
  get player() { return this.boats[0]; }
  get progress() { return Math.min(1, this.player.s / this.course.length); }

  setSteer(norm: number) {
    this.player.latTarget = norm * (this.course.halfWidth - 1.4);
  }

  update(dt: number) {
    if (this.paused) return;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown - 0.6);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown - 0.6);
      if (after !== before && after >= 1 && after <= 3) this.emit({ type: 'countdown', n: after });
      if (this.countdown <= 0.6 && before >= 1) {
        this.state = 'racing';
        this.time = 0;
        this.stage.shownAt = 0;
        this.emit({ type: 'go' });
        const r = RIVALS[Math.floor(this.opts.seed % 4)];
        if (this.opts.mode === 'champ') this.emit({ type: 'commentary', text: r.line, who: r.name, color: r.color });
        for (const eb of this.earlyBird) this.handleBurst(eb.text, eb.source);
        this.earlyBird = [];
      }
      return;
    }
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.step(SIM_DT);
    }
  }

  private step(dt: number) {
    this.prev = this.boats.map((b) => ({ s: b.s, lat: b.lat, yaw: b.yaw }));
    this.time += dt;
    const t = this.time;
    const L = this.course.length;
    this.boats.forEach((b, i) => {
      const racer = this.racers[i];
      if (racer.remote) return;
      const brain = this.bots[i];
      if (brain && !b.finished) {
        const p = Math.min(1, b.s / L);
        const st = brain.tick(b, t, p);
        if (st) {
          const out = applyStrokeOutcome(b, this.phys, t, st.creditSum, st.accuracy, st.clean, false);
          b.score += Math.round(st.creditSum * 10 * streakMult(b.streak));
          if (out.flowStarted) this.emit({ type: 'flow', boat: i, on: true });
          if (st.stageDone && st.stageAcc >= 0.9) { if (b.nitro < 2) b.nitro++; }
          if (st.stageDone) b.T = Math.min(1, b.T + 0.04);
        }
        if (brain.wantsNitro(b, p) && activateNitro(b, t)) this.emit({ type: 'powerup', kind: 'nitro', action: 'use', boat: i });
        const gate = this.course.gates.find((g) => g.s - b.s < 110 && g.s - b.s > 0);
        brain.steer(b, this.course, this.boats, t, gate ? gate.lat : null);
        for (const g of this.course.gates) {
          if (b.s >= g.s && b.s - b.v * dt < g.s) {
            const res = brain.gateAttempt(g.id);
            if (res && Math.abs(b.lat - g.lat) <= 4) {
              const rw = brain.rollReward();
              if (rw === 'nitro' && b.nitro < 2) b.nitro++;
              else if (rw === 'jump' && b.jump < 1) b.jump++;
              else if (rw === 'shield') b.shield = true;
            }
          }
        }
      }
      if (b.finished) { b.T *= Math.exp(-0.8 * dt); }
      stepLongitudinal(b, this.phys, t, dt);
      stepLateral(b, this.course.halfWidth - 1.3, dt);
      if (!b.finished && b.s >= L) {
        b.finished = true;
        b.finishTime = t - (b.s - L) / Math.max(1, b.v);
        if (this.firstFinishAt < 0) this.firstFinishAt = t;
        this.emit({ type: 'finish', boat: i, place: 0, time: b.finishTime });
      }
      this.collide(b, i, t);
    });
    this.playerTick(t);
    this.updatePlaces();
    this.checkEnd(t);
  }

  private collide(b: BoatState, i: number, t: number) {
    if (b.finished) return;
    const air = isAir(b, t);
    for (const h of this.course.hazards) {
      const ds = h.s - b.s;
      if (ds > h.r + BOAT_R || ds < -(h.r + BOAT_R)) continue;
      if (air || t < b.iframeUntil) continue;
      const dl = this.course.hazardLat(h, t) - b.lat;
      if (ds * ds + dl * dl < (h.r + BOAT_R) * (h.r + BOAT_R)) {
        b.iframeUntil = t + 1;
        if (b.shield) {
          b.shield = false;
          this.emit({ type: 'hazard', boat: i, hazard: h, shielded: true });
          if (i === 0) this.emit({ type: 'powerup', kind: 'shield', action: 'absorb', boat: 0 });
        } else {
          const spec = HAZARD_SPEC[h.type];
          b.slowMul = Math.min(b.slowMul, spec.slow);
          b.slowUntil = t + spec.dur;
          b.T = Math.max(0, b.T - spec.tLoss);
          if (!isFlow(b, t)) b.flow = Math.max(0, b.flow - 0.1);
          b.hits++;
          if (i === 0) h.hit = true;
          this.emit({ type: 'hazard', boat: i, hazard: h, shielded: false });
        }
      }
    }
    for (const p of this.course.pickups) {
      if (p.taken[i]) continue;
      const ds = p.s - b.s;
      if (ds > 3 || ds < -3) continue;
      if (Math.abs(p.lat - b.lat) < 3 || (Math.abs(p.lat - b.lat) < 4 && i === 0)) {
        p.taken[i] = true;
        b.pickups++;
        b.T = Math.min(1, b.T + 0.008);
        b.score += 15;
        if (i === 0) {
          this.pickupChain = t - this.lastPickupAt < 1.4 ? this.pickupChain + 1 : 1;
          this.lastPickupAt = t;
          b.score += 5 * this.pickupChain;
          this.emit({ type: 'pickup', boat: 0, pickup: p, chain: this.pickupChain });
        }
      }
    }
  }

  private playerTick(t: number) {
    const b = this.player;
    const L = this.course.length;
    if (!this.finalSprint && b.s >= L * 0.8 && !b.finished) {
      this.finalSprint = true;
      this.emit({ type: 'finalSprint' });
      this.emit({ type: 'callout', text: 'FINAL SPRINT!', kind: 'epic' });
    }
    if (b.flowUntil > 0 && t >= b.flowUntil && t - SIM_DT < b.flowUntil) this.emit({ type: 'flow', boat: 0, on: false });
    // gates
    if (!this.activeGate) {
      const g = this.course.gates.find((g) => !this.gatesDone.has(g.id) && g.s - b.s < 110 && g.s - b.s > 0);
      if (g) { this.activeGate = g; this.emit({ type: 'gateOpen', gate: g }); }
    } else if (b.s >= this.activeGate.s) {
      const g = this.activeGate;
      if (!(this.gateSaid.has(g.id) && this.resolveGatePass(g))) {
        this.gatesDone.add(g.id);
        this.activeGate = null;
        this.emit({ type: 'gateResult', gate: g, success: false });
      }
    }
  }

  gateSaid = new Set<number>();

  /** Reward requires the phrase to have been said AND the boat to pass through the arch (06 §10). */
  private resolveGatePass(g: Gate) {
    const b = this.player;
    if (Math.abs(b.lat - g.lat) > 4.5) return false;
    const rng = forkRng(this.opts.seed + g.id, 'gate');
    let rw: 'nitro' | 'jump' | 'shield' = rng.next() < 0.45 ? 'nitro' : rng.next() < 0.73 ? 'jump' : 'shield';
    const full = (k: string) => (k === 'nitro' ? b.nitro >= 2 : k === 'jump' ? b.jump >= 1 : b.shield);
    if (full(rw)) rw = (['nitro', 'jump', 'shield'] as const).find((k) => !full(k)) ?? rw;
    if (full(rw)) { b.score += 150; b.flow = Math.min(0.99, b.flow + 0.15); }
    else if (rw === 'nitro') b.nitro++;
    else if (rw === 'jump') b.jump++;
    else b.shield = true;
    this.gatesDone.add(g.id);
    this.activeGate = null;
    this.emit({ type: 'gateResult', gate: g, success: true, reward: rw });
    this.emit({ type: 'powerup', kind: rw, action: 'earn', boat: 0, via: 'gate' });
    return true;
  }

  private updatePlaces() {
    const order = this.boats.map((b, i) => ({ b, i })).sort((x, y) => {
      if (x.b.finished && y.b.finished) return x.b.finishTime - y.b.finishTime;
      if (x.b.finished) return -1;
      if (y.b.finished) return 1;
      return y.b.s - x.b.s;
    });
    order.forEach((o, k) => (o.b.place = k + 1));
    const p = this.player.place;
    if (this.state === 'racing' && this.time > 1.5 && !this.player.finished) {
      if (p < this.lastPlace) {
        const passed = order[p]?.i;
        const name = passed !== undefined ? this.racers[passed].short : '';
        this.emit({ type: 'overtake', passed: name, place: p });
      } else if (p > this.lastPlace) {
        const by = order[p - 2]?.i;
        this.emit({ type: 'overtaken', by: by !== undefined ? this.racers[by].short : '', place: p });
      }
    }
    this.lastPlace = p;
  }

  private checkEnd(t: number) {
    if (this.state !== 'racing') return;
    const pb = this.player;
    const others = this.boats.slice(1);
    const allOthersDone = others.every((b) => b.finished) || (this.opts.mode === 'duel' && this.remoteFinished);
    const timeout = this.firstFinishAt > 0 && t - this.firstFinishAt > 40;
    if ((pb.finished && (this.opts.mode === 'champ' || allOthersDone || t - pb.finishTime > 25)) || timeout) {
      // project unfinished boats
      for (const b of this.boats) {
        if (!b.finished && !this.racers[b.idx].remote) {
          b.finished = true;
          b.finishTime = t + (this.course.length - b.s) / Math.max(6, b.v);
        }
      }
      this.updatePlaces();
      this.state = 'finished';
      this.emit({ type: 'raceEnd' });
    }
  }

  /** Remote opponent (Voice Duel) snapshot. */
  /** 0..1 progress between the last sim tick and the next one. */
  get alpha() { return this.state === 'racing' && !this.paused ? Math.min(1, this.acc / SIM_DT) : 1; }
  /** Smooth time for rendering (sim time + fraction of the current tick). */
  get renderTime() { return this.time + (this.state === 'racing' && !this.paused ? this.acc : 0); }
  /** Interpolated boat pose for rendering — removes the 30 Hz stepping judder. */
  pose(i: number): { s: number; lat: number; yaw: number } {
    const b = this.boats[i];
    const p = this.prev[i];
    if (!p || this.racers[i].remote) return { s: b.s, lat: b.lat, yaw: b.yaw };
    const a = this.alpha;
    return { s: p.s + (b.s - p.s) * a, lat: p.lat + (b.lat - p.lat) * a, yaw: p.yaw + (b.yaw - p.yaw) * a };
  }

  setRemote(s: number, lat: number, v: number, finished: boolean, finishTime: number) {
    const b = this.boats[1];
    if (!b) return;
    b.s = s; b.lat = lat; b.v = v;
    if (finished && !b.finished) { b.finished = true; b.finishTime = finishTime; this.remoteFinished = true; }
  }

  command(cmd: Command, via: string) {
    const b = this.player;
    const t = this.time;
    if (via === 'snippet') this.snippets++;
    else if (via === 'spoken') this.spokenCmds++;
    if (this.state !== 'racing') { this.emit({ type: 'command', cmd, via, ok: false }); return; }
    let ok = false;
    if (cmd === 'nitro') {
      ok = activateNitro(b, t);
      this.emit({ type: 'powerup', kind: 'nitro', action: ok ? 'use' : 'deny', boat: 0, via });
    } else if (cmd === 'jump') {
      ok = activateJump(b, t);
      this.emit({ type: 'powerup', kind: 'jump', action: ok ? 'use' : 'deny', boat: 0, via });
    } else if (cmd === 'skip') {
      ok = true;
      this.skipStage();
    }
    this.emit({ type: 'command', cmd, via, ok });
  }

  skipStage() {
    this.stage.skipRest();
    this.player.T = Math.max(0, this.player.T - 0.05);
    this.player.streak = 0;
    this.player.flow = Math.max(0, this.player.flow - 0.15);
    this.emit({ type: 'words', stage: this.stage, credited: [], missed: [] });
    this.finishStage();
  }

  handleBurst(raw: string, source: Source) {
    if (this.state === 'finished' || this.player.finished) return;
    const parsed = parseCommands(raw);
    for (const c of parsed.commands) this.command(c.cmd, c.via);
    if (!parsed.text) return;
    if (this.state === 'countdown') {
      if (this.countdown < 1.8) this.earlyBird.push({ text: parsed.text, source });
      return;
    }
    if (this.paused) return;
    const tokens = tokenize(parsed.text, true);
    if (!tokens.length) return;
    // "Nitro." / "boost!" typed by Wispr Flow fires instantly; a burst that was only commands stops here
    const cmdHits = tokens.filter((tk) => this.voiceCommand(tk.norm)).length;
    if (cmdHits === tokens.length) return;
    const t = this.time;
    const b = this.player;
    const burstSec = Math.max(0.8, t - Math.max(this.stage.shownAt, this.lastBurstAt));
    this.lastBurstAt = t;
    this.bursts++;
    this.burstSeconds += burstSec;

    // Bonus gate routing (03 §8.4): higher A × matched wins, ties → main sentence.
    if (this.activeGate) {
      const g = this.activeGate;
      const gTok = tokenize(g.phrase);
      const ga = alignBurst(gTok, tokens, new Set());
      const gScore = ga.matched / gTok.length;
      const ma = alignBurst(this.stage.tokens.slice(this.stage.pointer), tokens, this.stage.hard);
      if (gScore >= 0.75 && ga.matched > ma.matched) {
        if (!this.gateSaid.has(g.id)) {
          this.gateSaid.add(g.id);
          this.emit({ type: 'callout', text: 'PHRASE LOCKED! STEER THROUGH THE ARCH', kind: 'great' });
        }
        this.lens.unshift({ t, text: parsed.text, source, credited: ga.matched, accuracy: gScore, gain: 0, score: 0, routed: 'gate' });
        this.emit({ type: 'burst', text: parsed.text, source, accuracy: gScore, clean: true, gain: 0, score: 0, credited: ga.matched, target: 'gate' });
        return;
      }
    }

    const res = this.stage.apply(tokens);
    if (res.matched === 0) {
      this.lens.unshift({ t, text: parsed.text, source, credited: 0, accuracy: 0, gain: 0, score: 0, routed: 'no match' });
      this.emit({ type: 'burst', text: parsed.text, source, accuracy: 0, clean: false, gain: 0, score: 0, credited: 0, target: 'none' });
      return;
    }
    const creditedWords = res.credited.length;
    if (source === 'flow') { for (const k of res.credited) this.stage.verified[k] = true; this.verifiedWords += creditedWords; }
    if (source === 'keyboard') this.wordsTyped += creditedWords;
    else this.wordsDictated += creditedWords;
    this.creditTotal += res.creditSum;
    this.resolvedTotal += res.covered;
    for (const k of res.missed) {
      const h = this.stage.heard[k];
      if (h) this.misheard.push({ word: this.stage.tokens[k].raw, heard: h });
    }
    for (const k of res.credited) if (this.stage.status[k] === 'mercy' && this.stage.heard[k]) this.misheard.push({ word: this.stage.tokens[k].raw, heard: this.stage.heard[k]! });
    const clean = res.accuracy >= 0.9 || (res.accuracy >= 0.6 && res.allMissesSuspect);
    if (clean) this.cleanBursts++;
    const prevStreak = b.streak;
    const out = applyStrokeOutcome(b, this.phys, t, res.creditSum, res.accuracy, clean, this.stage.attempts > 1 && res.accuracy < 0.75);
    // score (03 §7)
    let base = 0;
    for (const k of res.credited) {
      const w = this.stage.tokens[k].norm;
      const lenF = w.length <= 3 ? 0.8 : w.length <= 6 ? 1 : w.length <= 9 ? 1.2 : 1.4;
      base += (this.stage.status[k] === 'exact' ? 1 : this.stage.status[k] === 'near' ? 0.8 : 0.7) * 10 * lenF * (this.stage.hard.has(w) ? 1.4 : 1);
    }
    const wpm = (creditedWords * 60) / burstSec;
    const r = wpm / this.opts.level.wpmTarget;
    const P = wpm > 260 ? 1 : Math.max(0.85, Math.min(1.15, 0.85 + 0.15 * r));
    const M = Math.min(3, streakMult(b.streak) * (isFlow(b, t) ? 1.5 : 1));
    const score = Math.round(base * M * P * (res.accuracy >= 0.95 ? 1.1 : 1) * (this.finalSprint ? 1.25 : 1));
    b.score += score;
    this.lens.unshift({ t, text: parsed.text, source, credited: creditedWords, accuracy: res.accuracy, gain: out.gain, score, routed: 'sentence' });
    if (this.lens.length > 30) this.lens.pop();
    this.emit({ type: 'words', stage: this.stage, credited: res.credited, missed: res.missed });
    this.emit({ type: 'burst', text: parsed.text, source, accuracy: res.accuracy, clean, gain: out.gain, score, credited: creditedWords, target: 'main' });
    if (b.streak > prevStreak) this.emit({ type: 'streak', streak: b.streak });
    if (out.shieldEarned) this.emit({ type: 'powerup', kind: 'shield', action: 'earn', boat: 0 });
    if (out.flowStarted) {
      this.emit({ type: 'flow', boat: 0, on: true });
      this.emit({ type: 'callout', text: 'FLOW STATE!', kind: 'epic' });
    }
    if (this.stage.done) this.finishStage();
  }

  /** last few completed sentences — Wispr Flow's final text can still correct them */
  private recent: Stage[] = [];

  /**
   * Hybrid mode (Live Voice + Wispr Flow): Live Voice already moved the boat word-by-word; when Flow's
   * clean transcript lands (when you stop dictating) it CORRECTS words the live recogniser misheard
   * in the current and recent sentences, and credits anything live didn't catch at all.
   */
  flowAssist(raw: string, source: Source) {
    if (this.state === 'countdown') return;
    const afterFinish = this.state === 'finished' || this.player.finished;
    const parsed = parseCommands(raw);
    if (!afterFinish) for (const c of parsed.commands) this.command(c.cmd, c.via);
    if (!parsed.text) return;
    const tokens = tokenize(parsed.text, true);
    if (!tokens.length) return;
    const cmdHits = afterFinish ? 0 : tokens.filter((tk) => this.voiceCommand(tk.norm)).length;
    if (cmdHits === tokens.length) return;
    const b = this.player;
    const fixedWords: string[] = [];
    let fixScore = 0;
    let currentFixed: number[] = [];
    for (const st of [this.stage, ...this.recent]) {
      const fixed = st.repair(tokens);
      if (!fixed.length) continue;
      if (st === this.stage) currentFixed = fixed;
      for (const k of fixed) {
        fixedWords.push(st.display[st.tokDisp[k]].replace(/[^\p{L}\p{N}'-]/gu, ''));
        fixScore += 15;
        this.creditTotal += 1;
        this.wordsDictated += 1;
        this.misheard = this.misheard.filter((m) => m.word !== st.tokens[k].raw);
        if (st.heard[k]) this.misheard.push({ word: st.tokens[k].raw, heard: '(live) → fixed by Flow' });
      }
    }
    let verified = 0;
    for (const st of [this.stage, ...this.recent]) verified += st.verify(tokens);
    this.verifiedWords += verified;
    fixScore += verified * 5;
    if (fixedWords.length || verified) {
      b.score += fixScore;
      if (!afterFinish) b.T = Math.min(1, b.T + 0.03 * fixedWords.length);
      this.lens.unshift({ t: this.time, text: parsed.text, source, credited: fixedWords.length, accuracy: 1, gain: 0.03 * fixedWords.length, score: fixScore, routed: 'flow fix' });
      if (currentFixed.length) this.emit({ type: 'words', stage: this.stage, credited: currentFixed, missed: [] });
      this.emit({ type: 'flowFix', words: fixedWords, score: fixScore, currentStage: currentFixed.length > 0, verified, afterFinish });
    }
    if (afterFinish) return;
    // words the live recogniser never caught: Flow's text fills them in — it only ever ADDS credit
    // (never marks words wrong) and needs ≥ 2 real matches so a stray "the" can't touch a new sentence
    const recentBest = Math.max(0, ...this.recent.map((st) => alignBurst(st.tokens, tokens, st.hard, true).matched));
    const curBest = alignBurst(this.stage.tokens, tokens, this.stage.hard, true).matched;
    const filled = curBest > recentBest ? this.stage.creditPending(tokens) : [];
    if (filled.length) {
      let base = 0;
      for (const k of filled) base += 10 * (this.stage.status[k] === 'exact' ? 1 : 0.8);
      const sc = Math.round(base * Math.min(3, streakMult(b.streak) * (isFlow(b, this.time) ? 1.5 : 1)) * (this.finalSprint ? 1.25 : 1));
      b.score += sc;
      b.T = Math.min(1, b.T + this.phys.gainPerWord * filled.length);
      this.wordsDictated += filled.length;
      this.creditTotal += filled.length;
      this.resolvedTotal += filled.length;
      this.bursts++;
      this.emit({ type: 'words', stage: this.stage, credited: filled, missed: [] });
      this.emit({ type: 'burst', text: parsed.text, source, accuracy: 1, clean: true, gain: this.phys.gainPerWord * filled.length, score: sc, credited: filled.length, target: 'main' });
    }
    if (this.stage.done) this.completeSentenceLive();
  }

  /** streak / shield / Flow State are judged once per sentence in live & hybrid mode (not per word) */
  private completeSentenceLive() {
    const b = this.player;
    const acc = this.stage.accuracy();
    const clean = acc >= 0.9;
    if (clean) this.cleanBursts++;
    const prevStreak = b.streak;
    const out = applyStrokeOutcome(b, this.phys, this.time, 0, acc, clean, false);
    if (b.streak > prevStreak) this.emit({ type: 'streak', streak: b.streak });
    if (out.shieldEarned) this.emit({ type: 'powerup', kind: 'shield', action: 'earn', boat: 0 });
    if (out.flowStarted) {
      this.emit({ type: 'flow', boat: 0, on: true });
      this.emit({ type: 'callout', text: 'FLOW STATE!', kind: 'epic' });
    }
    this.finishStage();
  }

  // ---------- Live Voice: words are credited the instant the recogniser hears them ----------
  private live = { id: '', consumed: 0, startedAt: 0, isCommand: false };
  private firedCmds = new Set<string>();
  private lastCmdAt: Record<string, number> = {};

  /** A spoken power-up word that is NOT on the current sign/gate fires its command (1 s cooldown). */
  private voiceCommand(norm: string): boolean {
    const cmd = VOICE_CMDS[norm];
    if (!cmd || this.state !== 'racing') return false;
    const p = this.stage.pointer;
    if (this.stage.tokens.slice(p, p + 8).some((tk) => tk.norm === norm)) return false;
    if (this.activeGate && tokenize(this.activeGate.phrase).some((tk) => tk.norm === norm)) return false;
    if (this.time - (this.lastCmdAt[cmd] ?? -10) < 1) return true;
    this.lastCmdAt[cmd] = this.time;
    this.command(cmd, 'spoken');
    return true;
  }

  /**
   * Streaming transcript of one utterance (grows word by word). Every newly *stable* word is aligned
   * immediately, so the boat surges while you are still speaking — no key press / release needed.
   */
  handleLive(id: string, transcript: string, final: boolean) {
    if (this.state === 'finished' || this.player.finished || this.paused) return;
    if (this.live.id !== id) this.live = { id, consumed: 0, startedAt: this.time, isCommand: false };
    const all = tokenize(transcript, true);
    // instant voice commands: "nitro" / "boost" / "turbo" / "jump" / "hop" fire the moment they're heard
    for (let k = this.live.consumed; k < all.length; k++) {
      const key = `${id}#${k}`;
      if (this.firedCmds.has(key)) continue;
      if (this.voiceCommand(all[k].norm)) this.firedCmds.add(key);
    }
    if (this.state === 'countdown') return;
    const t = this.time;
    // the last word of an interim result may still be changing — wait until it's stable
    // …unless it already exactly matches one of the next words on the sign (then count it now — no end-of-sentence lag)
    let stableEnd = final ? all.length : all.length - 1;
    if (!final && all.length) {
      const last = all[all.length - 1].norm;
      const p = this.stage.pointer;
      const ahead = this.stage.tokens.slice(p, p + Math.max(2, all.length - this.live.consumed + 1));
      if (last.length >= 2 && ahead.some((tk) => tk.norm === last)) stableEnd = all.length;
    }
    let fresh = all.slice(this.live.consumed, stableEnd);
    if (fresh.length && this.activeGate && !this.gateSaid.has(this.activeGate.id)) {
      const g = this.activeGate;
      const gTok = tokenize(g.phrase);
      const ga = alignBurst(gTok, all.slice(this.live.consumed), new Set());
      if (ga.matched / gTok.length >= 0.75) {
        this.gateSaid.add(g.id);
        this.live.consumed = Math.max(this.live.consumed + ga.usedBurst, stableEnd);
        this.emit({ type: 'callout', text: 'PHRASE LOCKED! STEER THROUGH THE ARCH', kind: 'great' });
        return;
      }
    }
    const b = this.player;
    let guard = 0;
    while (fresh.length && guard++ < 4) {
      const res = this.stage.apply(fresh);
      if (res.matched === 0) {
        // unrelated chatter: drop it so it doesn't crowd out the next words
        if (fresh.length > 3) this.live.consumed += fresh.length - 3;
        break;
      }
      this.live.consumed += res.usedBurst;
      fresh = fresh.slice(res.usedBurst);
      this.wordsDictated += res.credited.length;
      this.creditTotal += res.creditSum;
      this.resolvedTotal += res.covered;
      for (const k of res.missed) {
        const h = this.stage.heard[k];
        if (h) this.misheard.push({ word: this.stage.tokens[k].raw, heard: h });
      }
      const gain = this.phys.gainPerWord * res.creditSum;
      b.T = Math.min(1, b.T + gain);
      if (!b.launchUsed && t < 3) { b.T = Math.min(1, b.T + 0.2); b.launchUsed = true; }
      let base = 0;
      for (const k of res.credited) {
        const w = this.stage.tokens[k].norm;
        const lenF = w.length <= 3 ? 0.8 : w.length <= 6 ? 1 : w.length <= 9 ? 1.2 : 1.4;
        base += (this.stage.status[k] === 'exact' ? 1 : this.stage.status[k] === 'near' ? 0.8 : 0.7) * 10 * lenF * (this.stage.hard.has(w) ? 1.4 : 1);
      }
      const M = Math.min(3, streakMult(b.streak) * (isFlow(b, t) ? 1.5 : 1));
      const score = Math.round(base * M * (this.finalSprint ? 1.25 : 1));
      b.score += score;
      this.emit({ type: 'words', stage: this.stage, credited: res.credited, missed: res.missed });
      this.emit({ type: 'burst', text: transcript, source: 'web-speech', accuracy: res.accuracy, clean: res.accuracy >= 0.9, gain, score, credited: res.credited.length, target: 'live' });
      if (this.stage.done) {
        this.lens.unshift({ t, text: this.stage.text, source: 'web-speech', credited: this.stage.tokens.length, accuracy: this.stage.accuracy(), gain, score, routed: 'live sentence' });
        if (this.lens.length > 30) this.lens.pop();
        this.completeSentenceLive();
      }
    }
    if (final) {
      this.bursts++;
      this.burstSeconds += Math.max(0.5, t - this.live.startedAt);
    }
  }

  private finishStage() {
    const b = this.player;
    const acc = this.stage.accuracy();
    const flawless = this.stage.flawless();
    const bonus = Math.round(60 * acc * acc * (flawless ? 1.25 : 1) * (this.finalSprint ? 1.25 : 1));
    b.score += bonus;
    b.T = Math.min(1, b.T + 0.04 + (flawless ? 0.06 : 0));
    this.stageTimes.push({ text: this.stage.text, sec: this.time - this.stage.shownAt, acc });
    this.emit({ type: 'stageDone', acc, flawless, bonus });
    if (acc >= 0.9) {
      if (b.nitro < 2) { b.nitro++; this.emit({ type: 'powerup', kind: 'nitro', action: 'earn', boat: 0 }); }
      else b.score += 60;
    }
    this.recent.unshift(this.stage);
    if (this.recent.length > 30) this.recent.pop();
    this.stageIndex++;
    this.stage = new Stage(this.stages[this.stageIndex % this.stages.length]);
    this.stage.shownAt = this.time;
    this.stageStalledAt = this.time;
    this.emit({ type: 'newStage', stage: this.stage, index: this.stageIndex });
  }

  isNitro(i: number) { return isNitro(this.boats[i], this.time); }
  isFlow(i: number) { return isFlow(this.boats[i], this.time); }
  isAir(i: number) { return isAir(this.boats[i], this.time); }

  results() {
    const order = this.boats.map((b, i) => ({ b, r: this.racers[i] })).sort((a, b) => a.b.place - b.b.place);
    const pb = this.player;
    const accuracy = this.resolvedTotal ? this.creditTotal / this.resolvedTotal : 0;
    const typingBaseline = 40;
    const saved = this.wordsDictated * (60 / typingBaseline) - this.burstSeconds * (this.wordsDictated / Math.max(1, this.wordsDictated + this.wordsTyped));
    const slowest = [...this.stageTimes].sort((a, b) => b.sec / b.text.split(' ').length - a.sec / a.text.split(' ').length)[0];
    return {
      order, place: pb.place, time: pb.finishTime, score: pb.score, accuracy, bestStreak: pb.bestStreak, hits: pb.hits,
      pickups: pb.pickups, nitros: pb.nitrosUsed, jumps: pb.jumpsUsed, stages: this.stageIndex,
      flow: {
        wordsDictated: this.wordsDictated, wordsTyped: this.wordsTyped, bursts: this.bursts,
        wpm: this.burstSeconds > 0 ? Math.round(((this.wordsDictated + this.wordsTyped) * 60) / this.burstSeconds) : 0,
        savedSec: Math.max(0, Math.round(saved)), snippets: this.snippets, spoken: this.spokenCmds,
        verified: this.verifiedWords,
        verifiedPct: Math.min(100, Math.round((100 * this.verifiedWords) / Math.max(1, this.wordsDictated + this.wordsTyped))),
        voicePct: this.wordsDictated + this.wordsTyped ? Math.round((100 * this.wordsDictated) / (this.wordsDictated + this.wordsTyped)) : 0,
      },
      misheard: this.misheard.slice(0, 8),
      slowest,
      margin: order.length > 1 ? Math.abs(order[0].b.finishTime - order[1].b.finishTime) : 99,
    };
  }
}

export type RaceResults = ReturnType<RaceDirector['results']>;
export type { WordStatus };
