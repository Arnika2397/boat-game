export type BankStyle = 'beach' | 'fort' | 'market' | 'golden' | 'villas' | 'night' | 'monsoon';

export interface Theme {
  id: string;
  skyTop: number;
  skyHorizon: number;
  sunColor: number;
  sunIntensity: number;
  sunElev: number; // degrees
  sunDisc: number; // colour of the giant sun disc on the horizon
  sunDiscSize: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  waterShallow: number;
  waterDeep: number;
  foam: number;
  land: number;
  sand: number;
  bank: BankStyle;
  openSea: boolean; // right side is open sea (beach levels)
  night?: boolean;
  rain?: boolean;
  fireworks?: boolean;
  stars?: boolean;
  swell: number;
}

export interface LevelDef {
  id: number;
  name: string;
  place: string;
  kicker: string; // "new thing"
  tagline: string;
  length: number;
  halfWidth: number;
  tier: 1 | 2 | 3;
  hazardEvery: number;
  gates: number;
  rivalSkill: number;
  wpmTarget: number;
  theme: Theme;
  hazards: ('buoy' | 'log' | 'rock' | 'basket' | 'orb')[];
  postcard: string;
}

const MORNING: Theme = {
  id: 'morning', skyTop: 0x3cc8ff, skyHorizon: 0xd8fbff, sunColor: 0xfff3d6, sunIntensity: 2.4, sunElev: 35,
  sunDisc: 0xffe600, sunDiscSize: 0.0, fog: 0xcff8ff, fogNear: 120, fogFar: 520, hemiSky: 0x9fe8ff, hemiGround: 0x2bbe8a,
  waterShallow: 0x2fe6d2, waterDeep: 0x0a8fa3, foam: 0xf4fffb, land: 0x21a85e, sand: 0xfff1b8, bank: 'beach', openSea: true, swell: 1.0,
};

export const THEMES: Record<string, Theme> = {
  morning: MORNING,
  fort: { ...MORNING, id: 'fort', skyTop: 0x47c4f5, skyHorizon: 0xe9fdff, sunElev: 50, fog: 0xdaf6ff, waterShallow: 0x23d6c4,
    waterDeep: 0x0b7f93, land: 0x1f9a56, sand: 0xf2df9a, bank: 'fort', openSea: false },
  market: { ...MORNING, id: 'market', skyTop: 0x5fd0ff, skyHorizon: 0xf3ffe8, sunColor: 0xffffff, sunElev: 70, fog: 0xe4ffff,
    waterShallow: 0x19d3c5, waterDeep: 0x0a8fa3, land: 0x23b066, sand: 0xf0d58a, bank: 'market', openSea: false },
  golden: { ...MORNING, id: 'golden', skyTop: 0xff7a3d, skyHorizon: 0xffe08a, sunColor: 0xffb347, sunIntensity: 2.6, sunElev: 9,
    sunDisc: 0xffe600, sunDiscSize: 1, fog: 0xffcf9a, fogNear: 100, fogFar: 460, hemiSky: 0xffc889, hemiGround: 0x8a5a3c,
    waterShallow: 0x2cc7b8, waterDeep: 0x0d6f86, foam: 0xfff6dd, land: 0x2f8f50, sand: 0xffd27a, bank: 'golden', openSea: true },
  villas: { ...MORNING, id: 'villas', skyTop: 0x6fd6ff, skyHorizon: 0xfff4dd, sunColor: 0xfff0c2, sunElev: 45, fog: 0xeafbff,
    waterShallow: 0x1fd0c6, waterDeep: 0x0a8399, land: 0x2a9d5c, sand: 0xe9d9b0, bank: 'villas', openSea: false },
  night: { ...MORNING, id: 'night', skyTop: 0x07123a, skyHorizon: 0x3a1f7b, sunColor: 0x9fb8ff, sunIntensity: 1.3, sunElev: 25,
    sunDisc: 0xfff2c4, sunDiscSize: 0.35, fog: 0x1b1f4f, fogNear: 80, fogFar: 380, hemiSky: 0x5a4bab, hemiGround: 0x0b2a3a,
    waterShallow: 0x1f7fa8, waterDeep: 0x0b3a66, foam: 0x7fc8e8, land: 0x0f4a3a, sand: 0x6b6a8a, bank: 'night', openSea: false,
    night: true, fireworks: true, stars: true },
  monsoon: { ...MORNING, id: 'monsoon', skyTop: 0x4d5f78, skyHorizon: 0x9fb3c8, sunColor: 0xbfd0e0, sunIntensity: 1.4, sunElev: 30,
    fog: 0x7e93a4, fogNear: 60, fogFar: 300, hemiSky: 0x8c9fb5, hemiGround: 0x2e6e63, waterShallow: 0x2a9e9a, waterDeep: 0x16506a,
    foam: 0xe6f4f4, land: 0x1d6e48, sand: 0xa8a080, bank: 'monsoon', openSea: false, rain: true, swell: 2.2 },
};

export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Baga Shack Sprint', place: 'BAGA', kicker: 'THE CORE LOOP · CASHEW TRAILS',
    tagline: 'Beach shacks, turquoise sea, four rivals who think you are slow.',
    length: 950, halfWidth: 16, tier: 1, hazardEvery: 140, gates: 0, rivalSkill: 0.2, wpmTarget: 95,
    theme: THEMES.morning, hazards: ['buoy'], postcard: 'Greetings from sunny Baga! The shacks are open, the sea is warm, and Captain Caju says you can’t catch him.' },
  { id: 2, name: 'Chapora Fort Run', place: 'CHAPORA', kicker: 'NEW: BUOYS & SHIELDS',
    tagline: 'Race the river mouth under the old laterite fort.',
    length: 1050, halfWidth: 15, tier: 1, hazardEvery: 110, gates: 1, rivalSkill: 0.27, wpmTarget: 101,
    theme: THEMES.fort, hazards: ['buoy', 'rock'], postcard: 'The fort has watched a thousand boats pass. Today it watches you. Four clean phrases in a row earn a Shield.' },
  { id: 3, name: 'Mapusa Market Canal', place: 'MAPUSA', kicker: 'NEW: BONUS PHRASE GATES',
    tagline: 'Spice stalls, bunting, baskets — and gates that reward a quick tongue.',
    length: 1100, halfWidth: 13, tier: 2, hazardEvery: 100, gates: 2, rivalSkill: 0.33, wpmTarget: 107,
    theme: THEMES.market, hazards: ['buoy', 'basket'], postcard: 'Friday market day! Say the phrase on a bonus gate while you sail through it to win Nitro or a Wave Jump.' },
  { id: 4, name: 'Anjuna Golden Hour', place: 'ANJUNA', kicker: 'NEW: DRIFTING LOGS',
    tagline: 'The sun melts into the sea. Logs drift. Rivals get serious.',
    length: 1200, halfWidth: 14, tier: 2, hazardEvery: 90, gates: 2, rivalSkill: 0.38, wpmTarget: 113,
    theme: THEMES.golden, hazards: ['buoy', 'log', 'rock'], postcard: 'Golden hour at Anjuna — the most beautiful race on the coast. Use Wave Jump (right-click) to hop over logs.' },
  { id: 5, name: 'Fontainhas Colour Lanes', place: 'FONTAINHAS', kicker: 'NEW: NARROW LANES',
    tagline: 'Yellow, blue and green balcões crowd a narrow canal.',
    length: 1250, halfWidth: 11, tier: 3, hazardEvery: 80, gates: 3, rivalSkill: 0.44, wpmTarget: 119,
    theme: THEMES.villas, hazards: ['buoy', 'basket', 'log'], postcard: 'Panjim’s Latin quarter — houses painted fresh after every monsoon. The canal is narrow, so steer like a local.' },
  { id: 6, name: 'Zuari Night Regatta', place: 'ZUARI', kicker: 'NEW: NIGHT RACE · GLOW ORBS',
    tagline: 'Bridge lights, lanterns, fireworks. The grand finale.',
    length: 1350, halfWidth: 12, tier: 3, hazardEvery: 75, gates: 3, rivalSkill: 0.5, wpmTarget: 125,
    theme: THEMES.night, hazards: ['orb', 'buoy', 'log'], postcard: 'The Night Regatta! The whole river is lit up and the crowd is roaring. Win this and you are Champion of the Coast.' },
];

/** Endless Tide: seeded levels that cycle the looks with escalating difficulty. */
export function endlessLevel(depth: number): LevelDef {
  const base = LEVELS[(depth - 1) % LEVELS.length];
  const looks = ['morning', 'fort', 'market', 'golden', 'villas', 'night', 'monsoon'];
  const theme = THEMES[looks[(depth * 3 + 1) % looks.length]];
  return {
    ...base,
    id: 100 + depth,
    name: `Endless Tide · Depth ${depth}`,
    place: 'ENDLESS TIDE',
    kicker: theme.rain ? 'MODIFIER: MONSOON SWELL' : `DEPTH ${depth}`,
    tagline: 'The tide never ends. How deep can your voice take you?',
    length: Math.min(1700, 1000 + depth * 60),
    halfWidth: Math.max(9, 15 - depth * 0.5),
    tier: depth < 3 ? 2 : 3,
    hazardEvery: Math.max(55, 100 - depth * 5),
    gates: 3,
    rivalSkill: Math.min(0.85, 0.35 + depth * 0.05),
    wpmTarget: Math.min(170, 110 + depth * 5),
    theme,
    hazards: ['buoy', 'log', 'rock', 'basket'],
    postcard: 'Endless Tide — every top-3 finish takes you one depth deeper. You have three anchors. Lose them all and the tide wins.',
  };
}
