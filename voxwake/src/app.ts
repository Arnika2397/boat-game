import type { WorldView } from './world/view';
import type { RaceDirector, RaceResults } from './game/race';
import type { LevelDef } from './game/levels';

export interface RaceContext {
  level: LevelDef;
  levelNumber: number;
  mode: 'champ' | 'duel' | 'endless';
  endlessDepth?: number;
  anchors?: number;
  seed: number;
}

export type Screen = 'loading' | 'title' | 'modes' | 'setup' | 'map' | 'garage' | 'postcard' | 'race' | 'results' | 'duel' | 'settings' | 'howto';

/** Shared app context; navigation functions are wired in main.ts (screens never import each other directly). */
export const app = {
  view: null as unknown as WorldView,
  race: null as RaceDirector | null,
  ctx: null as RaceContext | null,
  lastResults: null as RaceResults | null,
  thumbs: new Map<string, string>(),
  flags: new URLSearchParams(location.search),
  go: (_s: Screen, _arg?: unknown) => {},
  startRace: (_ctx: RaceContext) => {},
  attract: () => {},
  selectedLevel: 1,
  timeScale: 1,
};

export const isJudge = () => app.flags.has('judge');
