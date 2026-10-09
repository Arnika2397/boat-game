import { save, persist, rankOf, PAINTS, WAKES } from '../state';
import { LEVELS } from './levels';
import type { RaceResults } from './race';
import type { RaceContext } from '../app';

export interface RewardSummary {
  stars: number;
  prevStars: number;
  xpGain: number;
  xpBefore: number;
  rankBefore: number;
  rankAfter: number;
  unlockedLevel: number | null;
  crates: number;
  nextStarHint: string;
  newBest: boolean;
  endless?: { depth: number; anchors: number; advanced: boolean; over: boolean; tide: number };
}

export function computeRewards(ctx: RaceContext, r: RaceResults, heat: 'chill' | 'standard' | 'hot'): RewardSummary {
  const win = r.place === 1;
  const podium = r.place <= 3;
  const stars = podium ? (win ? (r.accuracy >= 0.92 && r.hits === 0 ? 3 : 2) : 1) : 0;
  const key = ctx.mode === 'champ' ? String(ctx.level.id) : '';
  const prev = key ? save.levels[key] : undefined;
  const prevStars = prev?.stars ?? 0;
  const heatMul = { chill: 0.8, standard: 1, hot: 1.3 }[heat];
  const placeBonus = [150, 90, 50, 25, 10][r.place - 1] ?? 10;
  const xpGain = Math.round((100 + Math.floor(r.score / 20) + placeBonus + 30 * stars) * heatMul);
  const xpBefore = save.xp;
  const rankBefore = rankOf(save.xp).rank;
  save.xp += xpGain;
  const rankAfter = rankOf(save.xp).rank;
  let unlockedLevel: number | null = null;
  let newBest = false;
  if (key) {
    const best = save.levels[key] ?? { stars: 0, bestScore: 0, bestTime: 0 };
    newBest = !best.bestTime || r.time < best.bestTime;
    save.levels[key] = { stars: Math.max(best.stars, stars), bestScore: Math.max(best.bestScore, r.score), bestTime: best.bestTime ? Math.min(best.bestTime, r.time) : r.time };
    if (podium && ctx.level.id >= save.unlocked && ctx.level.id < LEVELS.length) {
      save.unlocked = ctx.level.id + 1;
      unlockedLevel = save.unlocked;
    }
  }
  const crates = 1 + (win ? 1 : 0);
  save.crates += crates;
  save.races++;
  r.order.forEach((o) => {
    const rid = o.r.rival?.id;
    if (!rid) return;
    const rec = save.rivals[rid] ?? { w: 0, l: 0 };
    if (r.place < o.b.place) rec.w++; else rec.l++;
    save.rivals[rid] = rec;
  });
  save.flowLifetime.words += r.flow.wordsDictated;
  save.flowLifetime.typed += r.flow.wordsTyped;
  save.flowLifetime.bursts += r.flow.bursts;
  let nextStarHint = '';
  if (stars < 1) nextStarHint = 'Finish top-3 for your first ★';
  else if (stars < 2) nextStarHint = 'Win the race for ★★';
  else if (stars < 3) nextStarHint = r.hits > 0 ? `Win with zero hazard hits for ★★★ (you hit ${r.hits})` : `Win with ≥ 92% accuracy for ★★★ (you had ${Math.round(r.accuracy * 100)}%)`;
  else nextStarHint = 'Perfect! Try Hot heat for ×1.3 XP';
  let endless: RewardSummary['endless'];
  if (ctx.mode === 'endless') {
    const depth = ctx.endlessDepth ?? 1;
    let anchors = ctx.anchors ?? 3;
    const advanced = podium;
    if (!advanced) anchors--;
    const tide = Math.round(r.score * (1 + 0.1 * depth));
    save.endless.tide = Math.max(save.endless.tide, tide);
    if (advanced) save.endless.best = Math.max(save.endless.best, depth);
    endless = { depth, anchors, advanced, over: anchors <= 0, tide };
  }
  persist();
  return { stars, prevStars, xpGain, xpBefore, rankBefore, rankAfter, unlockedLevel, crates, nextStarHint, newBest, endless };
}

export interface CrateItem { kind: 'paint' | 'wake' | 'xp'; id: string; name: string; rarity: 'common' | 'rare' | 'epic'; color?: number; accent?: number }

/** Tiffin Crate: cosmetics only. Common 70 / Rare 24 / Epic 6, pity guarantees an Epic within 6 crates. */
export function openCrate(): CrateItem {
  save.crates = Math.max(0, save.crates - 1);
  save.cratesOpened++;
  const roll = Math.random();
  let rarity: CrateItem['rarity'] = roll < 0.06 ? 'epic' : roll < 0.3 ? 'rare' : 'common';
  if (save.pity >= 5) rarity = 'epic';
  save.pity = rarity === 'epic' ? 0 : save.pity + 1;
  const pool: CrateItem[] = [];
  for (const [id, p] of Object.entries(PAINTS)) if (p.rarity === rarity && !save.paints.includes(id)) pool.push({ kind: 'paint', id, name: p.name, rarity, color: p.color, accent: p.accent });
  for (const [id, w] of Object.entries(WAKES)) if (w.rarity === rarity && !save.wakes.includes(id)) pool.push({ kind: 'wake', id, name: w.name, rarity });
  let item: CrateItem;
  if (!pool.length) {
    save.xp += 25;
    item = { kind: 'xp', id: 'xp', name: '+25 XP (duplicate)', rarity };
  } else {
    item = pool[Math.floor(Math.random() * pool.length)];
    if (item.kind === 'paint') save.paints.push(item.id);
    else save.wakes.push(item.id);
  }
  persist();
  return item;
}
