import * as THREE from 'three';
import { Builder } from './builder';
import * as K from './kit';
import { vertexToon, outlineMat, PAL } from './materials';
import { forkRng } from '../core/rng';
import type { Course } from '../game/course';
import type { LevelDef, Theme } from '../game/levels';

const CHUNK = 160;

/** World point at (s, lat) with linear extrapolation before the start line. */
function at(course: Course, s: number, lat: number, out = new THREE.Vector3()) {
  if (s >= 0) return course.world(Math.min(s, course.total - 1), lat, out);
  const p = course.sample(0);
  const tx = Math.sin(p.h), tz = Math.cos(p.h);
  course.world(0, lat, out);
  return out.set(out.x + tx * s, 0, out.z + tz * s);
}

function bankRibbon(course: Course, theme: Theme, side: 1 | -1): THREE.Mesh {
  const hw = course.halfWidth;
  // cross-section: [lat offset beyond corridor, height, colour]
  const sec: [number, number, number][] = [
    [-0.5, -0.8, theme.sand], [1.6, 0.25, 0xf7f7ea], [3, 0.55, theme.sand], [10, 0.7, theme.sand],
    [13, 1.0, theme.land], [40, 1.6, theme.land], [90, 3.5, theme.land], [180, 9, theme.land],
  ];
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const step = 4;
  const s0 = -220, s1 = course.total + 120;
  const rows: { p: THREE.Vector3; col: THREE.Color }[][] = [];
  for (let s = s0; s <= s1; s += step) {
    const row: { p: THREE.Vector3; col: THREE.Color }[] = [];
    for (const [off, h, colr] of sec) {
      at(course, s, side * (hw + off), v);
      const wob = off > 12 ? Math.sin(s * 0.03 + off) * h * 0.3 : 0;
      row.push({ p: new THREE.Vector3(v.x, h + wob, v.z), col: c.setHex(colr).clone() });
    }
    rows.push(row);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    for (let k = 0; k < sec.length - 1; k++) {
      const a = rows[i][k], b = rows[i][k + 1], d = rows[i + 1][k], e = rows[i + 1][k + 1];
      const quad = side > 0 ? [a, d, b, b, d, e] : [a, b, d, b, e, d];
      for (const q of quad) {
        pos.push(q.p.x, q.p.y, q.p.z);
        col.push(q.col.r, q.col.g, q.col.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.computeVertexNormals();
  return new THREE.Mesh(g, vertexToon());
}

export interface SceneryOut {
  group: THREE.Group;
  glows: THREE.Vector3[]; // positions of night/festive light glows
  glowColors: number[];
}

export function buildScenery(course: Course, level: LevelDef): SceneryOut {
  const theme = level.theme;
  const group = new THREE.Group();
  const glows: THREE.Vector3[] = [];
  const glowColors: number[] = [];
  const rng = forkRng(course.seed, 'scenery');
  const r = () => rng.next();
  const hw = course.halfWidth;
  group.add(bankRibbon(course, theme, -1));
  if (!theme.openSea) group.add(bankRibbon(course, theme, 1));

  const chunks = new Map<number, Builder>();
  const B = (s: number) => {
    const k = Math.floor(Math.max(-200, s) / CHUNK);
    let b = chunks.get(k);
    if (!b) { b = new Builder(); chunks.set(k, b); }
    return b;
  };
  const v = new THREE.Vector3();
  /** place a prop at (s, side*(hw+off)) facing the water */
  const place = (s: number, side: number, off: number, fn: (b: Builder) => void, scale = 1, yaw = 0) => {
    at(course, s, side * (hw + off), v);
    const h = course.heading(Math.max(0, s));
    const b = B(s);
    // local +Z faces the river: river direction from bank is -side * right
    const face = h + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + yaw;
    b.push(v.x, groundY(off), v.z, face, scale);
    fn(b);
    b.pop();
  };
  const groundY = (off: number) => (off < 3 ? 0.4 : off < 10 ? 0.65 : off < 13 ? 0.8 : 1.0 + (off - 13) * 0.02);
  const glowAt = (s: number, side: number, off: number, y: number, color: number) => {
    at(course, s, side * (hw + off), v);
    glows.push(new THREE.Vector3(v.x, y, v.z));
    glowColors.push(color);
  };

  const villaColors = [0xfff1a8, 0xbfe9c9, 0xa9dcf5, 0xffffff, 0xffd1dc, 0xf7e27a];
  const shutters = [PAL.magenta, PAL.sun, PAL.mint, PAL.azure, PAL.greenDeep];
  const sides = theme.openSea ? [-1] : [-1, 1];
  const L = course.total + 100;

  // ---------- universal dressing: palms + bushes + far hills ----------
  for (const side of sides) {
    for (let s = -200; s < L; s += 9 + r() * 10) {
      const off = 14 + r() * 40;
      place(s, side, off, (b) => (r() < 0.75 ? K.palm(b, r) : K.bush(b, r, r() < 0.5 ? PAL.leaf : 0x2fb868)));
    }
    for (let s = -200; s < L; s += 60 + r() * 60) place(s, side, 110 + r() * 60, (b) => K.hill(b, r, r() < 0.5 ? 0x1c8a4f : 0x24a05c, 30 + r() * 30, 18 + r() * 30));
  }

  switch (theme.bank) {
    case 'beach':
    case 'golden': {
      for (let s = -60; s < L; s += 38 + r() * 25) place(s, -1, 15 + r() * 5, (b) => K.shack(b, r));
      for (let s = -100; s < L; s += 12 + r() * 14) place(s, -1, 4 + r() * 5, (b) => (r() < 0.6 ? K.umbrella(b, r) : K.deckChair(b, 0, 0, 0, r())));
      for (let s = 20; s < L; s += 140 + r() * 80) place(s, -1, 8, (b) => K.scooter(b), 1.2, Math.PI / 2);
      if (theme.bank === 'golden') for (let s = 50; s < L; s += 160) place(s, -1, -0.5, (b) => K.jetty(b, 10), 1, Math.PI);
      if (theme.bank === 'golden') for (let s = 0; s < L; s += 24) glowAt(s, -1, 13, 3.3, PAL.sun);
      // open-sea lane markers + far sailboats + headland
      for (let s = -40; s < L; s += 9) {
        const b = B(s);
        at(course, s, hw + 1.5, v);
        b.push(v.x, 0, v.z);
        b.sphere(Math.floor(s / 9) % 2 ? PAL.magenta : PAL.sun, 0.45, 0, 0.15, 0);
        b.pop();
      }
      for (let s = 0; s < L; s += 90) {
        place(s, 1, 60 + r() * 120, (b) => {
          b.add(new THREE.ConeGeometry(1, 1, 3), PAL.greenDeep, 0, 4, 0, 0, Math.PI / 2, 0, 0.15, 7, 3.5);
          b.box(0x0b3b2a, 1.2, 0.8, 5, 0, 0.3, 0);
        });
      }
      break;
    }
    case 'fort': {
      place(course.length * 0.45, -1, 30, (b) => { K.hill(b, r, 0x2a8a50, 34, 16); b.push(0, 13, 4); K.fort(b, r, 46); b.pop(); });
      for (const side of sides) {
        for (let s = -100; s < L; s += 14 + r() * 12) place(s, side, 1 + r() * 2, (b) => (r() < 0.4 ? K.mooredCanoe(b, r) : K.bush(b, r, 0x1f7a45)), 1, r() < 0.4 ? Math.PI / 2 : 0);
        for (let s = 0; s < L; s += 25 + r() * 25) place(s, side, 0.5, (b) => K.rock(b, r, 0.8 + r()));
        for (let s = 0; s < L; s += 70 + r() * 60) place(s, side, 16 + r() * 10, (b) => K.villa(b, r, villaColors[Math.floor(r() * 6)], shutters[Math.floor(r() * 5)]));
      }
      break;
    }
    case 'market': {
      for (const side of sides) {
        for (let s = -60; s < L; s += 7 + r() * 3) place(s, side, 4.5, (b) => K.stall(b, r));
        for (let s = -60; s < L; s += 10 + r() * 6) place(s, side, 9, (b) => K.crowd(b, r, 4));
        for (let s = -80; s < L; s += 13) place(s, side, 15, (b) => K.villa(b, r, villaColors[Math.floor(r() * 6)], shutters[Math.floor(r() * 5)], 10, 7, 4.5, r() < 0.5 ? 2 : 1));
      }
      for (let s = 40; s < L; s += 55) {
        const a = at(course, s, -hw - 3).clone(), c = at(course, s, hw + 3).clone();
        const b = B(s);
        b.cyl(0x6e4224, 0.15, 0.15, 8, a.x, 4, a.z);
        b.cyl(0x6e4224, 0.15, 0.15, 8, c.x, 4, c.z);
        K.bunting(b, a.x, a.z, c.x, c.z, 8);
      }
      break;
    }
    case 'villas':
    case 'night':
    case 'monsoon': {
      for (const side of sides) {
        for (let s = -80; s < L; s += 11 + r() * 2) {
          const storeys = r() < 0.55 ? 2 : 1;
          place(s, side, 6.5 + r() * 1.5, (b) => K.villa(b, r, villaColors[Math.floor(r() * 6)], shutters[Math.floor(r() * 5)], 9 + r() * 2, 7, 4.2, storeys));
          if (r() < 0.35) place(s + 5, side, 5, (b) => K.bougainvillea(b, r));
        }
        for (let s = -40; s < L; s += 16) {
          place(s, side, 2.5, (b) => K.lampPost(b));
          if (theme.night) glowAt(s, side, 2.5, 4.2, 0xfff0a0);
        }
        if (theme.night) for (let s = 30; s < L; s += 24) place(s, side, 4.5, (b) => K.crowd(b, r, 5));
      }
      // lantern strings across the canal
      for (let s = 60; s < L; s += theme.night ? 45 : 90) {
        const a = at(course, s, -hw - 4).clone(), c = at(course, s, hw + 4).clone();
        const b = B(s);
        K.bunting(b, a.x, a.z, c.x, c.z, 9);
        if (theme.night) for (let i = 1; i < 10; i++) {
          const t = i / 10;
          glows.push(new THREE.Vector3(a.x + (c.x - a.x) * t, 8.4 - Math.sin(t * Math.PI) * 1.4, a.z + (c.z - a.z) * t));
          glowColors.push([PAL.magenta, PAL.sun, PAL.mint][i % 3]);
        }
      }
      if (theme.bank === 'villas') place(course.length * 0.6, -1, 18, (b) => K.church(b));
      if (theme.night) buildBridge(course, B(course.length * 0.55), course.length * 0.55, glows, glowColors);
      break;
    }
  }

  // ---------- start + finish gates ----------
  finishGate(course, B(course.length), course.length);
  startPontoons(course, B(0));

  for (const b of chunks.values()) {
    const g = b.build();
    if (!g) continue;
    const m = new THREE.Mesh(g, vertexToon());
    const ol = new THREE.Mesh(g, outlineMat(0.045, PAL.ink, true));
    ol.renderOrder = -1;
    group.add(m, ol);
  }
  return { group, glows, glowColors };
}

function buildBridge(course: Course, b: Builder, s: number, glows: THREE.Vector3[], cols: number[]) {
  const hw = course.halfWidth;
  const a = course.world(s, -hw - 8), c = course.world(s, hw + 8);
  const mid = a.clone().add(c).multiplyScalar(0.5);
  const len = a.distanceTo(c);
  const ry = Math.atan2(c.x - a.x, c.z - a.z);
  b.push(mid.x, 0, mid.z, ry);
  b.box(0xd9d4c7, 3.5, 1.2, len + 10, 0, 10, 0);
  b.box(PAL.magenta, 3.6, 0.3, len + 10, 0, 10.75, 0);
  for (const z of [-len / 2 - 2, len / 2 + 2]) {
    b.box(0xe8e2d4, 2, 24, 2, 0, 12, z);
    for (let k = 1; k <= 4; k++) {
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 1, 4), 0xf4f4f4, 0, 17 + k * 1.2 - (k * 4) / 2, z + (z > 0 ? -1 : 1) * k * 4, (z > 0 ? -1 : 1) * 0.9, 0, 0, 1, k * 9, 1);
    }
  }
  b.pop();
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    glows.push(new THREE.Vector3(a.x + (c.x - a.x) * t, 11.2, a.z + (c.z - a.z) * t));
    cols.push(i % 2 ? PAL.sun : 0xffffff);
  }
}

function finishGate(course: Course, b: Builder, s: number) {
  const hw = course.halfWidth;
  const a = course.world(s, -hw - 1), c = course.world(s, hw + 1);
  for (const p of [a, c]) {
    b.cyl(0xffffff, 0.45, 0.45, 11, p.x, 5.5, p.z);
    b.cyl(PAL.magenta, 0.5, 0.5, 1.2, p.x, 10.5, p.z);
  }
  const n = Math.ceil((hw * 2 + 2) / 1.2);
  const ry = Math.atan2(c.x - a.x, c.z - a.z);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    for (let row = 0; row < 2; row++) {
      b.box((i + row) % 2 ? 0x111111 : 0xffffff, 1.2, 0.9, 0.15, a.x + (c.x - a.x) * t, 9.2 + row * 0.9, a.z + (c.z - a.z) * t, ry + Math.PI / 2);
    }
  }
  K.bunting(b, a.x, a.z, c.x, c.z, 8.4);
}

function startPontoons(course: Course, b: Builder) {
  const hw = course.halfWidth;
  for (const side of [-1, 1]) {
    const p = course.world(2, side * (hw + 0.5));
    b.cyl(PAL.sun, 0.3, 0.3, 6, p.x, 3, p.z);
    b.box(PAL.magenta, 0.2, 1.4, 2.4, p.x, 5.4, p.z, course.heading(2));
  }
}
