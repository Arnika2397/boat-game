import * as THREE from 'three';
import { Rng, forkRng } from '../core/rng';
import { BONUS_PHRASES } from '../content/sentences';
import type { LevelDef } from './levels';

export type HazardType = 'buoy' | 'log' | 'rock' | 'basket' | 'orb';

export interface Hazard {
  id: number;
  type: HazardType;
  s: number;
  lat: number;
  r: number;
  drift: number; // lateral drift amplitude (logs)
  phase: number;
  hit: boolean;
}

export interface Pickup { id: number; s: number; lat: number; taken: boolean[] } // taken per boat
export interface Gate { id: number; s: number; lat: number; phrase: string }

export const HAZARD_SPEC: Record<HazardType, { r: number; slow: number; dur: number; tLoss: number }> = {
  buoy: { r: 1.0, slow: 0.8, dur: 0.6, tLoss: 0.05 },
  log: { r: 1.6, slow: 0.65, dur: 1.2, tLoss: 0.1 },
  rock: { r: 2.0, slow: 0.55, dur: 1.4, tLoss: 0.12 },
  basket: { r: 2.0, slow: 0.75, dur: 0.9, tLoss: 0.06 },
  orb: { r: 1.2, slow: 0.8, dur: 0.8, tLoss: 0.05 },
};

export class Course {
  readonly length: number;
  readonly halfWidth: number;
  readonly total: number; // sampled length incl. run-out after finish
  private px: Float32Array;
  private pz: Float32Array;
  private hd: Float32Array; // heading angle
  hazards: Hazard[] = [];
  pickups: Pickup[] = [];
  gates: Gate[] = [];
  readonly seed: number;

  constructor(level: LevelDef, seed: number, boats: number) {
    this.seed = seed;
    this.length = level.length;
    this.halfWidth = level.halfWidth;
    this.total = Math.ceil(level.length + 260);
    const rng = forkRng(seed, 'course');
    const pts: THREE.Vector3[] = [];
    const a1 = rng.range(18, 34), f1 = rng.range(0.0028, 0.0042), p1 = rng.range(0, 6);
    const a2 = rng.range(6, 14), f2 = rng.range(0.008, 0.012), p2 = rng.range(0, 6);
    for (let z = -120; z <= this.total + 260; z += 40) {
      const x = a1 * Math.sin(z * f1 + p1) + a2 * Math.sin(z * f2 + p2) - (a1 * Math.sin(p1) + a2 * Math.sin(p2));
      pts.push(new THREE.Vector3(x, 0, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const curveLen = curve.getLength();
    // find the arc-length offset where z crosses 0 so that s = 0 is the start line
    let sOffset = 0;
    while (sOffset < 400 && curve.getPointAt(sOffset / curveLen).z < 0) sOffset += 1;
    const n = this.total + 1;
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.hd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, (sOffset + i) / curveLen);
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      this.px[i] = p.x;
      this.pz[i] = p.z;
      this.hd[i] = Math.atan2(t.x, t.z);
    }
    this.layout(level, rng, boats);
  }

  private layout(level: LevelDef, rng: Rng, boats: number) {
    const lim = this.halfWidth - 2.2;
    let id = 0;
    for (let s = 110; s < this.length - 50; s += level.hazardEvery * rng.range(0.7, 1.25)) {
      const type = rng.pick(level.hazards);
      const count = level.halfWidth > 13 && rng.chance(0.45) ? 2 : 1;
      const used: number[] = [];
      for (let c = 0; c < count; c++) {
        let lat = rng.range(-lim, lim);
        for (let tries = 0; tries < 6 && used.some((u) => Math.abs(u - lat) < 7); tries++) lat = rng.range(-lim, lim);
        used.push(lat);
        this.hazards.push({ id: id++, type, s: s + c * rng.range(-6, 6), lat, r: HAZARD_SPEC[type].r,
          drift: type === 'log' ? rng.range(1.5, 3) : 0, phase: rng.range(0, 6.28), hit: false });
      }
    }
    // gates
    const fr = level.gates === 1 ? [0.5] : level.gates === 2 ? [0.32, 0.7] : level.gates === 3 ? [0.25, 0.55, 0.8] : [];
    const phrases = rng.shuffle([...BONUS_PHRASES]);
    fr.forEach((f, i) => {
      const s = this.length * (f + rng.range(-0.03, 0.03));
      this.hazards = this.hazards.filter((h) => Math.abs(h.s - s) > 30);
      this.gates.push({ id: i, s, lat: rng.range(-lim + 3, lim - 3), phrase: phrases[i % phrases.length] });
    });
    // cashew trails following safe lines
    let pid = 0;
    for (let s = 70; s < this.length - 40; s += rng.range(55, 80)) {
      const baseLat = rng.range(-lim + 1, lim - 1);
      const amp = rng.range(1.5, 4);
      const count = rng.int(5, 8);
      for (let k = 0; k < count; k++) {
        const ss = s + k * 4.5;
        const lat = Math.max(-lim, Math.min(lim, baseLat + amp * Math.sin(k * 0.6)));
        if (this.hazards.some((h) => Math.abs(h.s - ss) < 5 && Math.abs(h.lat - lat) < h.r + 1.5)) continue;
        this.pickups.push({ id: pid++, s: ss, lat, taken: new Array(boats).fill(false) });
      }
    }
  }

  sample(s: number): { x: number; z: number; h: number } {
    const c = Math.max(0, Math.min(this.total - 1.001, s));
    const i = Math.floor(c);
    const f = c - i;
    let dh = this.hd[i + 1] - this.hd[i];
    if (dh > Math.PI) dh -= Math.PI * 2;
    if (dh < -Math.PI) dh += Math.PI * 2;
    return {
      x: this.px[i] + (this.px[i + 1] - this.px[i]) * f,
      z: this.pz[i] + (this.pz[i + 1] - this.pz[i]) * f,
      h: this.hd[i] + dh * f,
    };
  }

  /** World position of (s, lat). Right vector = (-cos h, sin h) for heading h = atan2(tx, tz). */
  world(s: number, lat: number, out = new THREE.Vector3()): THREE.Vector3 {
    const p = this.sample(s);
    const rx = -Math.cos(p.h), rz = Math.sin(p.h);
    return out.set(p.x + rx * lat, 0, p.z + rz * lat);
  }

  heading(s: number): number {
    return this.sample(s).h;
  }

  hazardLat(h: Hazard, time: number): number {
    if (!h.drift) return h.lat;
    const lim = this.halfWidth - 1.5;
    return Math.max(-lim, Math.min(lim, h.lat + Math.sin(time * 0.8 + h.phase) * h.drift));
  }
}
