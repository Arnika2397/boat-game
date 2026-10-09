import type { BoatKind } from './game/bots';

export interface Save {
  version: 1;
  name: string;
  xp: number;
  levels: Record<string, { stars: number; bestScore: number; bestTime: number }>;
  unlocked: number; // highest unlocked level
  boat: BoatKind;
  paint: string;
  paints: string[];
  wakes: string[];
  wake: string;
  crates: number;
  cratesOpened: number;
  pity: number;
  endless: { best: number; tide: number };
  rivals: Record<string, { w: number; l: number }>;
  flowLifetime: { words: number; bursts: number; typed: number };
  flowSetupDone: boolean;
  judgePass: boolean;
  settings: { reducedMotion: boolean; music: number; sfx: number; heat: 'chill' | 'standard' | 'hot'; lang: string; os: 'win' | 'mac'; chromeLive: boolean; flowKey: string; flowCheck: boolean };
  races: number;
}

export const PAINTS: Record<string, { name: string; color: number; accent: number; rarity: 'common' | 'rare' | 'epic' }> = {
  mango: { name: 'Mango Yellow', color: 0xffc21a, accent: 0xff0ccf, rarity: 'common' },
  lagoon: { name: 'Lagoon Green', color: 0x10ac63, accent: 0xffe600, rarity: 'common' },
  magenta: { name: 'Hot Magenta', color: 0xff0ccf, accent: 0xffe600, rarity: 'common' },
  azure: { name: 'Azulejo Blue', color: 0x2f7fd8, accent: 0xfffbe7, rarity: 'rare' },
  laterite: { name: 'Laterite Red', color: 0xb9643c, accent: 0xffe600, rarity: 'rare' },
  feni: { name: 'Feni Gold', color: 0xe9c46a, accent: 0x076b38, rarity: 'rare' },
  monsoon: { name: 'Monsoon Slate', color: 0x4d5f78, accent: 0x19d3c5, rarity: 'rare' },
  bebinca: { name: 'Bebinca Layers', color: 0x8a4b20, accent: 0xffd27a, rarity: 'epic' },
  regatta: { name: 'Night Regatta', color: 0x1b1f4f, accent: 0xff0ccf, rarity: 'epic' },
  susegad: { name: 'Susegad Sunset', color: 0xff7a3d, accent: 0xfff2c4, rarity: 'epic' },
};

export const WAKES: Record<string, { name: string; rarity: 'common' | 'rare' | 'epic' }> = {
  foam: { name: 'Classic Foam', rarity: 'common' },
  mango: { name: 'Mango Trail', rarity: 'rare' },
  magenta: { name: 'Magenta Foam', rarity: 'epic' },
};

export const BOATS: { kind: BoatKind; name: string; blurb: string; rank: number }[] = [
  { kind: 'canoe', name: 'Fisher’s Canoe', blurb: 'Slim dugout with painted bow eyes. Nimble.', rank: 1 },
  { kind: 'shack', name: 'Shack Runner', blurb: 'Speedboat with a thatched roof. Cheeky.', rank: 2 },
  { kind: 'ferry', name: 'Mandovi Ferry Mini', blurb: 'Chunky Ro-Ro tribute. Unbothered.', rank: 3 },
  { kind: 'dhow', name: 'Spice Dhow', blurb: 'Lateen sail, high stern. Elegant.', rank: 4 },
  { kind: 'cat', name: 'Casino Catamaran', blurb: 'Twin hulls, string lights. Extra.', rank: 5 },
];

const KEY = 'voxwake.save.v1';

function fresh(): Save {
  return {
    version: 1, name: 'Captain', xp: 0, levels: {}, unlocked: 1, boat: 'canoe', paint: 'mango', paints: ['mango', 'lagoon', 'magenta'],
    wakes: ['foam'], wake: 'foam', crates: 0, cratesOpened: 0, pity: 0, endless: { best: 0, tide: 0 },
    rivals: { caju: { w: 0, l: 0 }, bebinca: { w: 0, l: 0 }, vasco: { w: 0, l: 0 }, susegad: { w: 0, l: 0 } },
    flowLifetime: { words: 0, bursts: 0, typed: 0 }, flowSetupDone: false, judgePass: false,
    settings: { reducedMotion: false, music: 0.55, sfx: 0.9, heat: 'standard', lang: 'en-IN', os: navigator.userAgent.includes('Mac') ? 'mac' : 'win', chromeLive: false, flowKey: '', flowCheck: true },
    races: 0,
  };
}

export let save: Save = load();

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    return { ...fresh(), ...s, settings: { ...fresh().settings, ...(s.settings ?? {}) } };
  } catch {
    try { localStorage.setItem(KEY + '.corrupt.' + Date.now(), localStorage.getItem(KEY) ?? ''); } catch { /* ignore */ }
    return fresh();
  }
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode: keep in memory */ }
}

export function resetSave() {
  save = fresh();
  persist();
}

export const cumXP = (rank: number) => Math.round(250 * Math.pow(rank, 1.35));
export function rankOf(xp: number): { rank: number; into: number; need: number; pct: number } {
  let r = 1;
  while (xp >= cumXP(r)) r++;
  const prev = r === 1 ? 0 : cumXP(r - 1);
  const next = cumXP(r);
  return { rank: r, into: xp - prev, need: next - prev, pct: (xp - prev) / (next - prev) };
}

export const RANK_TITLES = ['Deckhand', 'Ferry Rookie', 'Canal Cruiser', 'Shack Skipper', 'River Runner', 'Fort Racer', 'Tide Talker',
  'Monsoon Master', 'Regatta Ace', 'Captain of the Coast', 'Legend of Goa'];
export const rankTitle = (r: number) => RANK_TITLES[Math.min(RANK_TITLES.length - 1, r - 1)];

/** The player's own Wispr Flow shortcut (everyone sets a different one). */
export function flowKey(): string {
  return save.settings.flowKey || 'your Wispr Flow key';
}
/** true once the player has picked/recorded their exact shortcut */
export const hasCustomKey = () => !!save.settings.flowKey;
