/** Shared boat dynamics (06 §3). Player and bots use exactly the same functions (fairness FI-1/FI-8). */
export const SIM_DT = 1 / 30;
export const V_MIN = 6;
export const V_MAX = 26;
export const GAMMA = 0.85;
export const A_UP = 9;
export const A_DOWN = 5;
export const MAX_LAT_SPEED = 9;
export const BOAT_R = 1.1;

export interface BoatState {
  idx: number;
  s: number; v: number; T: number;
  lat: number; latV: number; latTarget: number; yaw: number;
  nitro: number; nitroUntil: number; nitroCdUntil: number;
  shield: boolean; jump: number; airStart: number; airUntil: number;
  flow: number; flowUntil: number;
  streak: number; bestStreak: number; score: number;
  slowMul: number; slowUntil: number; iframeUntil: number;
  finished: boolean; finishTime: number; place: number;
  hits: number; pickups: number; nitrosUsed: number; jumpsUsed: number;
  stageIdx: number; launchUsed: boolean;
}

export function newBoat(idx: number, lat: number): BoatState {
  return {
    idx, s: 0, v: 0, T: 0, lat, latV: 0, latTarget: lat, yaw: 0,
    nitro: 0, nitroUntil: -1, nitroCdUntil: -1, shield: false, jump: 0, airStart: -1, airUntil: -1,
    flow: 0, flowUntil: -1, streak: 0, bestStreak: 0, score: 0,
    slowMul: 1, slowUntil: -1, iframeUntil: -1, finished: false, finishTime: 0, place: idx + 1,
    hits: 0, pickups: 0, nitrosUsed: 0, jumpsUsed: 0, stageIdx: 0, launchUsed: false,
  };
}

export interface LevelPhysics { decay: number; gainPerWord: number }

export function levelPhysics(levelNum: number): LevelPhysics {
  const L = Math.min(12, levelNum);
  return { decay: 0.2 + 0.01 * (L - 1), gainPerWord: 0.085 - 0.0025 * (L - 1) };
}

export const isNitro = (b: BoatState, t: number) => t < b.nitroUntil;
export const isFlow = (b: BoatState, t: number) => t < b.flowUntil;
export const isAir = (b: BoatState, t: number) => t < b.airUntil;

/** Throttle gain from a stroke (06 §3.3). */
export function strokeGain(phys: LevelPhysics, creditSum: number, accuracy: number, retry: boolean): number {
  return phys.gainPerWord * creditSum * (accuracy >= 0.9 ? 1.15 : 1) * (retry ? 0.6 : 1);
}

/** Streak multiplier ladder ×1.0 → ×2.0. */
export const streakMult = (streak: number) => 1 + 0.1 * Math.min(streak, 10);

export function stepLongitudinal(b: BoatState, phys: LevelPhysics, t: number, dt: number) {
  if (isNitro(b, t)) b.T = Math.max(b.T, 0.85);
  else b.T *= Math.exp(-phys.decay * dt);
  if (t > b.slowUntil) b.slowMul = 1;
  const M = (isNitro(b, t) ? 1.35 : 1) * (isFlow(b, t) ? 1.1 : 1) * b.slowMul;
  const vTarget = (V_MIN + (V_MAX - V_MIN) * Math.pow(b.T, GAMMA)) * M;
  const dv = vTarget - b.v;
  b.v += Math.max(-A_DOWN * dt, Math.min(A_UP * dt, dv));
  b.s += b.v * dt;
}

export function stepLateral(b: BoatState, limit: number, dt: number) {
  const target = Math.max(-limit, Math.min(limit, b.latTarget));
  const desired = (target - b.lat) / 0.22;
  const dvl = Math.max(-40 * dt, Math.min(40 * dt, desired - b.latV));
  b.latV = Math.max(-MAX_LAT_SPEED, Math.min(MAX_LAT_SPEED, b.latV + dvl));
  b.lat += b.latV * dt;
  if (b.lat > limit) { b.lat = limit; b.latV = 0; }
  if (b.lat < -limit) { b.lat = -limit; b.latV = 0; }
  b.yaw = Math.atan2(b.latV, Math.max(4, b.v)) * 0.9;
}

/** Shared stroke bookkeeping for player and bots: streak, shield, flow meter, throttle. */
export function applyStrokeOutcome(b: BoatState, phys: LevelPhysics, t: number, creditSum: number, accuracy: number,
  clean: boolean, retry: boolean): { shieldEarned: boolean; flowStarted: boolean; gain: number } {
  let shieldEarned = false, flowStarted = false;
  const gain = strokeGain(phys, creditSum, accuracy, retry);
  b.T = Math.min(1, b.T + gain);
  if (!b.launchUsed && clean && t < 3) { b.T = Math.min(1, b.T + 0.2); b.launchUsed = true; }
  if (clean) {
    b.streak++;
    b.bestStreak = Math.max(b.bestStreak, b.streak);
    if (b.streak % 4 === 0 && !b.shield) { b.shield = true; shieldEarned = true; }
    if (!isFlow(b, t)) {
      b.flow = Math.min(1, b.flow + 0.2);
      if (b.flow >= 1) { b.flow = 0; b.flowUntil = t + 8; flowStarted = true; }
    }
  } else if (accuracy < 0.6) {
    b.streak = 0;
    b.flow = Math.max(0, b.flow - 0.15);
  }
  return { shieldEarned, flowStarted, gain };
}

export function activateNitro(b: BoatState, t: number): boolean {
  if (b.nitro <= 0 || t < b.nitroCdUntil || isNitro(b, t)) return false;
  b.nitro--;
  b.nitroUntil = t + 3;
  b.nitroCdUntil = t + 7;
  b.nitrosUsed++;
  return true;
}

export function activateJump(b: BoatState, t: number): boolean {
  if (b.jump <= 0 || isAir(b, t)) return false;
  b.jump--;
  b.airStart = t;
  b.airUntil = t + 1.0;
  b.jumpsUsed++;
  return true;
}
