import { Rng, forkRng } from '../core/rng';
import { tokenize } from '../core/text';
import type { BoatState } from './sim';
import type { Course } from './course';

export type BoatKind = 'canoe' | 'shack' | 'dhow' | 'cat' | 'ferry';

export interface Rival {
  id: string;
  name: string;
  short: string;
  boat: BoatKind;
  color: number;
  accent: number;
  style: string;
  line: string;
  taunt: string;
  concede: string;
  pace: (p: number) => number;
  accDelta: number;
  variance: number;
  nitroPolicy: 'immediate' | 'sprint' | 'hoard';
  skillOffset: number;
  hazardMiss: number;
  greed: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

export const RIVALS: Rival[] = [
  { id: 'caju', name: 'Captain Caju', short: 'CAJU', boat: 'shack', color: 0xe2382f, accent: 0xffe600, style: 'SPRINTER',
    line: 'Cashew crunch, baby!', taunt: 'Too slow, captain! See you at the shack!', concede: 'Aiyo… my cashews!',
    pace: (p) => (p < 0.4 ? 1.28 : lerp(1.28, 0.84, (p - 0.4) / 0.12)), accDelta: -0.04, variance: 1.2,
    nitroPolicy: 'immediate', skillOffset: 0, hazardMiss: 0.18, greed: 0.5 },
  { id: 'bebinca', name: 'Maria Bebinca', short: 'BEBINCA', boat: 'dhow', color: 0xfff1cc, accent: 0xe4673a, style: 'METRONOME',
    line: 'Slow and layered wins.', taunt: 'Layer by layer, darling.', concede: 'Hmm. Sixteen layers of respect.',
    pace: () => 0.97, accDelta: 0.04, variance: 0.3, nitroPolicy: 'sprint', skillOffset: 0.06, hazardMiss: 0.08, greed: 0.6 },
  { id: 'vasco', name: 'Vindaloo Vasco', short: 'VASCO', boat: 'cat', color: 0xff7a1a, accent: 0xff0ccf, style: 'AGGRESSOR',
    line: 'Too hot for you!', taunt: 'Spicy finish, no?', concede: 'Okay okay, that was hotter than me.',
    pace: () => 1.03, accDelta: -0.03, variance: 1.0, nitroPolicy: 'immediate', skillOffset: -0.02, hazardMiss: 0.35, greed: 0.9 },
  { id: 'susegad', name: 'Shack Sensei Susegad', short: 'SUSEGAD', boat: 'canoe', color: 0x12b5a6, accent: 0xffe600, style: 'CLOSER',
    line: 'No hurry… yet.', taunt: 'Susegad wins in the end, always.', concede: 'You were not susegad at all. Well done.',
    pace: (p) => (p < 0.5 ? 0.9 : p < 0.75 ? 1.05 : 1.35), accDelta: 0.02, variance: 0.8, nitroPolicy: 'hoard', skillOffset: 0.1,
    hazardMiss: 0.15, greed: 0.4 },
];

/** Virtual speaker: generates stroke results under the same rules as the player (04 §1.5). */
export class BotBrain {
  readonly rival: Rival;
  private rng: Rng;
  private skill: number;
  private wpm: number;
  private pAcc: number;
  nextStrokeAt = 0;
  private wordPtr = 0;
  private stageCredits: number[] = [];
  private noise = 0;
  private avoidRoll = new Map<number, boolean>();
  gateTried = new Set<number>();

  constructor(rival: Rival, seed: number, levelSkill: number, heat: number, private stages: string[]) {
    this.rival = rival;
    this.rng = forkRng(seed, 'bot-' + rival.id);
    this.skill = Math.max(0, Math.min(1, levelSkill + rival.skillOffset + heat));
    this.wpm = 38 + 105 * this.skill;
    this.pAcc = Math.max(0.5, Math.min(0.995, 0.82 + 0.15 * this.skill + rival.accDelta));
    this.nextStrokeAt = 0.5 + this.rng.range(0.2, 1.3);
  }

  private stageWords(b: BoatState): number {
    return tokenize(this.stages[b.stageIdx % this.stages.length]).length;
  }

  /** Returns a stroke if one is due this tick. */
  tick(b: BoatState, t: number, progress: number): null | { creditSum: number; accuracy: number; clean: boolean; stageDone: boolean; stageAcc: number } {
    if (t < this.nextStrokeAt || b.finished) return null;
    const total = this.stageWords(b);
    const n = Math.min(total - this.wordPtr, this.rng.int(2, 4));
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const r = this.rng.next();
      const c = r < this.pAcc ? 1 : r < this.pAcc + 0.5 * (1 - this.pAcc) ? 0.8 : 0;
      sum += c;
      this.stageCredits.push(c);
    }
    const accuracy = n ? sum / n : 1;
    this.wordPtr += n;
    const jitter = Math.exp(this.rng.gaussian() * 0.18 * this.rival.variance * (1 - 0.5 * this.skill));
    const dur = (n * 60) / (this.wpm * this.rival.pace(progress)) * Math.max(0.6, Math.min(1.8, jitter));
    this.nextStrokeAt = t + dur + 0.25;
    let stageDone = false, stageAcc = 0;
    if (this.wordPtr >= total) {
      stageDone = true;
      stageAcc = this.stageCredits.reduce((a, c) => a + c, 0) / this.stageCredits.length;
      this.stageCredits = [];
      this.wordPtr = 0;
      b.stageIdx++;
      this.nextStrokeAt += 0.5;
    }
    return { creditSum: sum, accuracy, clean: accuracy >= 0.9, stageDone, stageAcc };
  }

  wantsNitro(b: BoatState, progress: number): boolean {
    if (b.nitro <= 0) return false;
    const p = this.rival.nitroPolicy;
    if (p === 'immediate') return true;
    if (p === 'sprint') return progress >= 0.7 || (b.place >= 3 && progress >= 0.45);
    return progress >= 0.75;
  }

  gateAttempt(gateId: number): null | boolean {
    if (this.gateTried.has(gateId)) return null;
    this.gateTried.add(gateId);
    const tryP = { caju: 0.5, bebinca: 0.8, vasco: 0.7, susegad: 0.6 }[this.rival.id] ?? 0.6;
    if (!this.rng.chance(tryP)) return false;
    return this.rng.chance(this.pAcc * 0.92);
  }

  rollReward(): 'nitro' | 'jump' | 'shield' {
    const r = this.rng.next();
    return r < 0.45 ? 'nitro' : r < 0.85 ? 'jump' : 'shield';
  }

  /** Cheap steering behaviour: choose the lowest-cost lateral lane looking ahead (04 §1.6). */
  steer(b: BoatState, course: Course, others: BoatState[], time: number, gateLat: number | null) {
    const lim = course.halfWidth - 1.6;
    let best = b.latTarget, bestCost = Infinity;
    for (let k = -3; k <= 3; k++) {
      const cand = (k / 3) * lim;
      let cost = Math.abs(cand - b.lat) * 0.08;
      for (const h of course.hazards) {
        const ds = h.s - b.s;
        if (ds < -2 || ds > 70) continue;
        let avoid = this.avoidRoll.get(h.id);
        if (avoid === undefined) { avoid = !this.rng.chance(this.rival.hazardMiss); this.avoidRoll.set(h.id, avoid); }
        if (!avoid) continue;
        const d = Math.abs(cand - course.hazardLat(h, time));
        if (d < h.r + 2.2) cost += (12 * (70 - ds)) / 70 + 4;
      }
      for (const p of course.pickups) {
        const ds = p.s - b.s;
        if (ds < 0 || ds > 40 || p.taken[b.idx]) continue;
        if (Math.abs(cand - p.lat) < 2) cost -= 0.6 * this.rival.greed;
      }
      for (const o of others) {
        if (o === b || Math.abs(o.s - b.s) > 8) continue;
        if (Math.abs(cand - o.lat) < 3) cost += 1.5;
      }
      if (gateLat !== null && Math.abs(cand - gateLat) < 3) cost -= 2;
      if (cost < bestCost) { bestCost = cost; best = cand; }
    }
    this.noise += (this.rng.gaussian() * 0.5 - this.noise * 0.05) * 0.3;
    b.latTarget = best + this.noise * (1 - this.skill) * 0.8;
  }
}
