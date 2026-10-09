import { alignBurst, CREDIT, type WordStatus } from '../core/align';
import { tokenize, GOA_WORDS, type Token } from '../core/text';
import { HARD_WORDS } from '../content/sentences';

/** One target sentence on the hanging sign, tracked word by word. */
export class Stage {
  readonly text: string;
  readonly display: string[];
  readonly tokens: Token[];
  readonly tokDisp: number[]; // token → display word index
  readonly status: WordStatus[];
  readonly heard: (string | undefined)[];
  readonly hard: Set<string>;
  /** words confirmed by a Wispr Flow transcript */
  readonly verified: boolean[];
  mercyLeft: number;
  attempts = 0;
  shownAt = 0;

  constructor(text: string) {
    this.text = text;
    this.display = text.split(/\s+/).filter(Boolean);
    const toks: Token[] = [];
    const map: number[] = [];
    this.display.forEach((w, i) => {
      for (const t of tokenize(w)) { toks.push(t); map.push(i); }
    });
    this.tokens = toks;
    this.tokDisp = map;
    this.status = new Array(toks.length).fill('pending');
    this.heard = new Array(toks.length).fill(undefined);
    this.verified = new Array(toks.length).fill(false);
    this.hard = new Set(toks.filter((t) => HARD_WORDS.has(t.norm) || GOA_WORDS.has(t.norm)).map((t) => t.norm));
    this.mercyLeft = this.hard.size >= Math.max(1, toks.length * 0.25) ? 2 : 1;
  }

  get pointer(): number {
    const i = this.status.indexOf('pending');
    return i < 0 ? this.tokens.length : i;
  }
  get done(): boolean {
    return this.pointer >= this.tokens.length;
  }

  /** Display-word status (aggregate of its tokens). */
  displayStatus(i: number): WordStatus {
    let st: WordStatus | null = null;
    for (let k = 0; k < this.tokens.length; k++) {
      if (this.tokDisp[k] !== i) continue;
      const s = this.status[k];
      if (s === 'pending') return 'pending';
      if (s === 'missed') st = 'missed';
      else if (st !== 'missed') st = st === 'mercy' || s === 'mercy' ? 'mercy' : st === 'near' || s === 'near' ? 'near' : 'exact';
    }
    return st ?? 'pending';
  }

  activeDisplay(): number {
    const p = this.pointer;
    return p < this.tokens.length ? this.tokDisp[p] : -1;
  }

  /** Align a burst; returns per-burst stats. Already-credited words are never re-credited. */
  apply(burst: Token[]): { creditSum: number; covered: number; accuracy: number; credited: number[]; missed: number[];
    allMissesSuspect: boolean; matched: number; usedBurst: number } {
    const start = this.pointer;
    const target = this.tokens.slice(start);
    const res = alignBurst(target, burst, this.hard);
    let creditSum = 0, covered = 0;
    const credited: number[] = [], missed: number[] = [];
    let allMissesSuspect = true;
    for (let k = 0; k < res.statuses.length; k++) {
      let st = res.statuses[k];
      if (st === 'pending') continue;
      if (st === 'mercy') {
        if (this.mercyLeft > 0) this.mercyLeft--;
        else st = 'missed';
      }
      const idx = start + k;
      this.status[idx] = st;
      this.heard[idx] = res.heard[k];
      covered++;
      creditSum += CREDIT[st];
      if (st === 'missed') {
        missed.push(idx);
        const tok = this.tokens[idx];
        const suspect = this.hard.has(tok.norm) || (tok.norm.length <= 3 && missed.length === 1);
        if (!suspect) allMissesSuspect = false;
      } else credited.push(idx);
    }
    if (res.matched > 0) this.attempts++;
    const accuracy = covered ? creditSum / covered : 0;
    return { creditSum, covered, accuracy, credited, missed, allMissesSuspect, matched: res.matched, usedBurst: res.usedBurst };
  }

  /**
   * Wispr Flow correction pass: re-align a clean Flow transcript against the WHOLE sentence and
   * upgrade any word the live recogniser got wrong ('missed') to credited. Returns repaired indices.
   */
  repair(burst: Token[]): number[] {
    if (!this.status.includes('missed')) return [];
    const res = alignBurst(this.tokens, burst, this.hard, true);
    if (res.matched < Math.min(2, this.tokens.length)) return [];
    const fixed: number[] = [];
    for (let k = 0; k < this.tokens.length; k++) {
      const st = res.statuses[k];
      if (this.status[k] === 'missed' && (st === 'exact' || st === 'near' || st === 'mercy')) {
        this.status[k] = st === 'mercy' ? 'near' : st;
        this.heard[k] = res.heard[k];
        fixed.push(k);
      }
    }
    return fixed;
  }

  /** Credit still-pending words that a clean transcript clearly contains (≥ 2 matches, or all that remain). Never marks misses. */
  creditPending(burst: Token[]): number[] {
    const pend = this.status.filter((s) => s === 'pending').length;
    if (!pend) return [];
    const res = alignBurst(this.tokens, burst, this.hard, true);
    const hits: number[] = [];
    for (let k = 0; k < this.tokens.length; k++) {
      const st = res.statuses[k];
      if (this.status[k] === 'pending' && (st === 'exact' || st === 'near' || st === 'mercy')) hits.push(k);
    }
    if (hits.length < Math.min(2, pend)) return [];
    for (const k of hits) {
      const st = res.statuses[k];
      this.status[k] = st === 'mercy' ? 'near' : st;
      this.heard[k] = res.heard[k];
    }
    return hits;
  }

  /** Mark credited words that a Wispr Flow transcript also contains as ✦ Flow-verified. Returns how many are new. */
  verify(burst: Token[]): number {
    const res = alignBurst(this.tokens, burst, this.hard, true);
    if (res.matched < Math.min(2, this.tokens.length)) return 0;
    let n = 0;
    for (let k = 0; k < this.tokens.length; k++) {
      const st = res.statuses[k];
      const credited = this.status[k] !== 'pending' && this.status[k] !== 'missed';
      if (credited && !this.verified[k] && (st === 'exact' || st === 'near' || st === 'mercy')) { this.verified[k] = true; n++; }
    }
    return n;
  }

  skipRest() {
    for (let k = 0; k < this.status.length; k++) if (this.status[k] === 'pending') this.status[k] = 'missed';
  }

  accuracy(): number {
    let s = 0;
    for (const st of this.status) s += CREDIT[st];
    return this.tokens.length ? s / this.tokens.length : 1;
  }

  flawless(): boolean {
    return this.status.every((s) => s === 'exact' || s === 'near');
  }
}
