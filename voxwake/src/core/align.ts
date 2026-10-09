import { GOA_WORDS, similarity, type Token } from './text';

export type MatchTier = 'exact' | 'near' | 'mercy' | 'none';
export type WordStatus = 'pending' | 'exact' | 'near' | 'mercy' | 'missed';

export const CREDIT: Record<WordStatus, number> = { pending: 0, exact: 1, near: 0.8, mercy: 0.7, missed: 0 };

export function matchTier(t: Token, u: Token, hard: boolean): MatchTier {
  if (t.norm === u.norm) return 'exact';
  if (t.norm.length <= 3) return 'none';
  const sim = similarity(t.norm, u.norm);
  if (sim >= 0.8 || (t.phon.length >= 3 && t.phon === u.phon)) return 'near';
  const special = hard || GOA_WORDS.has(t.norm);
  if (sim >= 0.6 && (special || t.phon.slice(0, 3) === u.phon.slice(0, 3))) return 'mercy';
  return 'none';
}

const GAIN: Record<MatchTier, number> = { exact: 2.0, near: 1.6, mercy: 1.0, none: -1.0 };
const EXTRA_HEARD = -0.4;
const SKIP_TARGET = -0.8;

export interface AlignResult {
  /** status per target index (relative to the passed target slice); 'pending' = not reached by this burst */
  statuses: WordStatus[];
  heard: (string | undefined)[];
  matched: number;
  covered: number; // target words up to and including the last matched word
  extras: number;
  usedBurst: number; // burst tokens consumed up to (and including) the last matched one
}

/** Semi-global DP alignment of burst tokens against the unresolved target remainder (03 §5.3). */
export function alignBurst(target: Token[], burst: Token[], hardSet: Set<string>, uncapped = false): AlignResult {
  const n = target.length;
  const m = uncapped ? Math.min(burst.length, 400) : Math.min(burst.length, Math.ceil(1.5 * n) + 4);
  const U = burst.slice(0, m);
  const S: Float64Array[] = [];
  const P: Uint8Array[] = []; // 1 diag, 2 up (extra heard), 3 left (skip target)
  const T: MatchTier[][] = [];
  for (let i = 0; i <= m; i++) {
    S.push(new Float64Array(n + 1));
    P.push(new Uint8Array(n + 1));
    T.push(new Array(n + 1).fill('none'));
  }
  for (let i = 1; i <= m; i++) {
    S[i][0] = i <= 2 ? 0 : (i - 2) * EXTRA_HEARD;
    P[i][0] = 2;
  }
  for (let j = 1; j <= n; j++) {
    S[0][j] = j * SKIP_TARGET;
    P[0][j] = 3;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const tier = matchTier(target[j - 1], U[i - 1], hardSet.has(target[j - 1].norm));
      T[i][j] = tier;
      const d = S[i - 1][j - 1] + GAIN[tier];
      const up = S[i - 1][j] + EXTRA_HEARD;
      const left = S[i][j - 1] + SKIP_TARGET;
      if (d >= up && d >= left) { S[i][j] = d; P[i][j] = 1; }
      else if (left >= up) { S[i][j] = left; P[i][j] = 3; }
      else { S[i][j] = up; P[i][j] = 2; }
    }
  }
  // free end-gap in target: best j on last row (prefer earlier on ties)
  let bestJ = 0;
  let best = S[m][0];
  for (let j = 1; j <= n; j++) if (S[m][j] > best + 1e-9) { best = S[m][j]; bestJ = j; }

  const statuses: WordStatus[] = new Array(n).fill('pending');
  const heard: (string | undefined)[] = new Array(n).fill(undefined);
  let i = m, j = bestJ, extras = 0, usedBurst = 0;
  while (i > 0 || j > 0) {
    const p = P[i][j];
    if (i > 0 && j > 0 && p === 1) {
      const tier = T[i][j];
      if (tier !== 'none' && usedBurst === 0) usedBurst = i;
      statuses[j - 1] = tier === 'none' ? 'missed' : tier;
      heard[j - 1] = U[i - 1].raw;
      i--; j--;
    } else if (j > 0 && (p === 3 || i === 0)) {
      statuses[j - 1] = 'missed';
      j--;
    } else {
      extras++;
      i--;
    }
  }
  let lastMatched = -1, matched = 0;
  for (let k = 0; k < n; k++) {
    if (statuses[k] === 'exact' || statuses[k] === 'near' || statuses[k] === 'mercy') { lastMatched = k; matched++; }
  }
  // words beyond the last matched word were not reached by this burst
  for (let k = lastMatched + 1; k < n; k++) { statuses[k] = 'pending'; heard[k] = undefined; }
  return { statuses, heard, matched, covered: lastMatched + 1, extras, usedBurst };
}
