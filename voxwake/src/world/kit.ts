import * as THREE from 'three';
import { Builder, G } from './builder';
import { PAL } from './materials';

type R = () => number;

const wedgeCache = new Map<number, THREE.BufferGeometry>();
function wedge(i: number, n: number): THREE.BufferGeometry {
  const key = i * 100 + n;
  let g = wedgeCache.get(key);
  if (!g) {
    g = new THREE.ConeGeometry(1, 1, 2, 1, true, (i / n) * Math.PI * 2, (Math.PI * 2) / n);
    wedgeCache.set(key, g);
  }
  return g;
}

export function palm(b: Builder, r: R, h = 8 + r() * 4, leanDir = r() * Math.PI * 2) {
  const segs = 7;
  const lean = 1.2 + r() * 2.2;
  let px = 0, pz = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const nx = Math.cos(leanDir) * lean * t * t, nz = Math.sin(leanDir) * lean * t * t;
    const y = (h / segs) * (i + 0.5);
    const rad = 0.34 - 0.13 * t;
    b.add(G.cyl8, i % 2 ? PAL.trunk : 0x8f6440, (px + nx) / 2, y, (pz + nz) / 2, 0, 0, 0, rad, h / segs + 0.05, rad);
    px = nx; pz = nz;
  }
  const topX = px, topZ = pz;
  const n = 8 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const col = i % 2 ? PAL.leaf : 0x2fb868;
    b.add(G.frond, col, topX, h, topZ, -0.35 + r() * 0.25, a, 0, 1, 1, 1 + r() * 0.2, 0.6 + r() * 0.4);
  }
  for (let i = 0; i < 4; i++) b.sphere(PAL.coconut, 0.24, topX + Math.cos(i * 1.7) * 0.35, h - 0.35, topZ + Math.sin(i * 1.7) * 0.35);
}

export function villa(b: Builder, r: R, body: number, shutter: number, w = 9 + r() * 4, d = 7 + r() * 2, h = 4.2 + r() * 1.5, storeys = 1) {
  const H = h * storeys;
  b.box(0xf3eadb, w + 0.6, 0.8, d + 0.6, 0, 0.4, 0); // plinth
  b.box(body, w, H, d, 0, 0.8 + H / 2, 0);
  b.box(PAL.white, w + 0.2, 0.25, d + 0.2, 0, 0.8 + H, 0); // cornice
  // hip roof
  b.add(G.cone4, PAL.terracotta, 0, 0.8 + H + 1.4, 0, 0, Math.PI / 4, 0, w * 0.78, 2.8, d * 0.78);
  b.add(G.cone4, 0xc8532c, 0, 0.8 + H + 1.0, 0, 0, Math.PI / 4, 0, w * 0.8, 2.0, d * 0.8);
  // windows with shutters on the front (+z)
  const nWin = Math.max(2, Math.floor(w / 3));
  for (let s = 0; s < storeys; s++) {
    for (let i = 0; i < nWin; i++) {
      const x = -w / 2 + (w / (nWin + 1)) * (i + 1);
      const y = 0.8 + h * s + h * 0.55;
      const isDoor = s === 0 && i === Math.floor(nWin / 2) && nWin % 2 === 1;
      if (isDoor) {
        b.box(PAL.orange, 1.2, 2.4, 0.15, x, 0.8 + 1.2, d / 2 + 0.05);
        b.box(PAL.white, 1.5, 0.2, 0.2, x, 0.8 + 2.5, d / 2 + 0.06);
      } else {
        b.box(0x1d5e46, 0.9, 1.5, 0.12, x, y, d / 2 + 0.04);
        b.box(shutter, 0.45, 1.6, 0.1, x - 0.7, y, d / 2 + 0.08);
        b.box(shutter, 0.45, 1.6, 0.1, x + 0.7, y, d / 2 + 0.08);
        b.box(PAL.white, 1.3, 0.18, 0.25, x, y + 0.9, d / 2 + 0.06);
      }
    }
  }
  // balcão porch with railing
  b.box(0xf3eadb, w * 0.6, 0.3, 1.8, 0, 0.95, d / 2 + 0.9);
  for (let i = 0; i <= 8; i++) b.box(PAL.white, 0.12, 0.8, 0.12, -w * 0.3 + (w * 0.6 * i) / 8, 1.5, d / 2 + 1.75);
  b.box(PAL.white, w * 0.6, 0.12, 0.18, 0, 1.92, d / 2 + 1.75);
  if (storeys > 1) {
    // projecting upper balcony
    b.box(PAL.white, w * 0.5, 0.2, 1.2, 0, 0.8 + h + 0.1, d / 2 + 0.6);
    for (let i = 0; i <= 6; i++) b.box(shutter, 0.1, 0.8, 0.1, -w * 0.25 + (w * 0.5 * i) / 6, 0.8 + h + 0.6, d / 2 + 1.15);
  }
}

export function shack(b: Builder, r: R) {
  const w = 6, d = 5;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) b.cyl(0xc79a5a, 0.15, 0.15, 3.4, x, 1.7, z);
  b.box(0xb0814a, w + 0.4, 0.25, d + 0.4, 0, 0.6, 0);
  b.add(G.cone4, PAL.thatch, 0, 4.4, 0, 0, Math.PI / 4, 0, w * 0.95, 2.4, d * 0.95);
  b.add(G.cone4, 0xd6ad5e, 0, 3.8, 0, 0, Math.PI / 4, 0, w * 1.0, 1.4, d * 1.0);
  b.box(0x8a5a2b, 2.5, 1.0, 0.6, 0, 1.1, d / 2 - 0.5);
  b.box(PAL.cream, 1.6, 1.0, 0.08, -2.2, 1.6, d / 2 + 0.4, 0.15); // menu board
  for (let i = 0; i < 5; i++) b.box(i % 2 ? PAL.magenta : PAL.sun, 0.9, 0.12, 0.05, -2.2, 1.95 - i * 0.18, d / 2 + 0.46, 0.15);
  for (let i = 0; i < 9; i++) b.sphere([PAL.sun, PAL.magenta, PAL.mint][i % 3], 0.12, -w / 2 + (w * i) / 8, 3.25 - Math.sin((i / 8) * Math.PI) * 0.3, d / 2 + 0.1);
  if (r() > 0.5) umbrella(b, r, 4.5, 0, 4);
  deckChair(b, -1.5, 0, d / 2 + 2.5, 0.3);
  deckChair(b, 1.2, 0, d / 2 + 2.8, -0.2);
}

export function umbrella(b: Builder, r: R, x = 0, y = 0, z = 0) {
  b.push(x, y, z, r() * 6);
  b.cyl(PAL.white, 0.06, 0.06, 2.7, 0, 1.35, 0, 0.12, 0, 0);
  const n = 8;
  for (let i = 0; i < n; i++) b.add(wedge(i, n), i % 2 ? PAL.magenta : PAL.sun, 0.16, 2.85, 0, 0.12, 0, 0, 1.6, 0.7, 1.6);
  b.pop();
}

export function deckChair(b: Builder, x: number, y: number, z: number, ry: number) {
  b.push(x, y, z, ry);
  b.box(PAL.white, 0.08, 0.6, 0.08, -0.35, 0.3, 0.5);
  b.box(PAL.white, 0.08, 0.6, 0.08, 0.35, 0.3, 0.5);
  b.box(PAL.greenDeep, 0.7, 0.06, 1.2, 0, 0.4, 0.1, 0, -0.35);
  b.box(PAL.white, 0.08, 1.0, 0.08, -0.35, 0.5, -0.4, 0, 0.4);
  b.box(PAL.white, 0.08, 1.0, 0.08, 0.35, 0.5, -0.4, 0, 0.4);
  b.pop();
}

export function stall(b: Builder, r: R) {
  const w = 4.5, d = 3;
  b.box(0x9a6236, w, 0.15, d, 0, 1.0, 0);
  for (const [x, z] of [[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]]) b.box(0x6e4224, 0.15, 1, 0.15, x, 0.5, z);
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2]]) b.box(0x6e4224, 0.15, 3.2, 0.15, x, 1.6, z);
  const cols = [[PAL.magenta, PAL.cream], [PAL.sun, PAL.greenDeep], [PAL.mint, PAL.white], [PAL.magenta, PAL.sun]][Math.floor(r() * 4)];
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    b.box(cols[i % 2], w / stripes, 0.08, d + 0.6, -w / 2 + (w / stripes) * (i + 0.5), 2.85, 0.35, 0, -0.32);
    b.add(G.cyl8, cols[i % 2], -w / 2 + (w / stripes) * (i + 0.5), 2.62, d / 2 + 0.95, Math.PI / 2, 0, 0, w / stripes / 2, 0.06, w / stripes / 2);
  }
  const goods = [0xff9f1c, 0xe2382f, 0xffe600, 0x7cc142, 0xff6fa8, 0xc4007f];
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.6 + i * 0.68;
    b.cyl(0xc79a5a, 0.3, 0.26, 0.3, x, 1.22, 0.5, 0, 0, 0, 8);
    b.sphere(goods[Math.floor(r() * goods.length)], 0.22, x, 1.42, 0.5, 1, 0.6, 1);
  }
  for (let i = 0; i < 3; i++) b.box(0xb0814a, 0.7, 0.5, 0.5, -1.5 + i * 1.4, 0.25, d / 2 + 0.6);
}

export function bunting(b: Builder, x1: number, z1: number, x2: number, z2: number, y: number) {
  const n = Math.max(6, Math.floor(Math.hypot(x2 - x1, z2 - z1) / 1.2));
  const ry = Math.atan2(x2 - x1, z2 - z1);
  const cols = [PAL.magenta, PAL.sun, PAL.mint, PAL.white, PAL.azure];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const sag = Math.sin(t * Math.PI) * 1.4;
    b.add(G.cone4, cols[i % cols.length], x1 + (x2 - x1) * t, y - sag - 0.4, z1 + (z2 - z1) * t, Math.PI, ry, 0, 0.35, 0.8, 0.05, 0.5);
  }
}

export function fort(b: Builder, r: R, len = 40) {
  const h = 7;
  b.box(PAL.laterite, len, h, 5, 0, h / 2, 0);
  b.box(0xa55733, len + 1, 1.0, 5.6, 0, 0.5, 0);
  for (let i = 0; i < len / 2; i++) b.box(PAL.laterite, 1.1, 1.2, 5.2, -len / 2 + 1 + i * 2, h + 0.6, 0);
  for (const x of [-len / 2, len / 2]) {
    b.cyl(0xa55733, 3.2, 3.6, h + 3, x, (h + 3) / 2, 0, 0, 0, 0, 10);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(0xa55733, 1, 1.2, 1, x + Math.cos(a) * 3, h + 3.6, Math.sin(a) * 3, -a);
    }
  }
  b.box(0x3d2a1e, 3, 4, 0.3, r() * 10 - 5, 2, 2.6); // gate
  b.cyl(PAL.white, 0.1, 0.1, 5, len / 2, h + 5.5, 0);
  b.box(PAL.magenta, 2, 1.2, 0.1, len / 2 + 1, h + 7.2, 0);
}

export function church(b: Builder) {
  b.box(PAL.white, 14, 11, 10, 0, 5.5, 0);
  b.add(G.cone4, PAL.white, 0, 12.6, 4.8, 0, Math.PI / 4, 0, 7.5, 3.5, 0.6);
  for (const x of [-6.5, 6.5]) {
    b.box(PAL.white, 4, 17, 4, x, 8.5, 3);
    b.add(G.cone4, PAL.terracotta, x, 18.4, 3, 0, Math.PI / 4, 0, 3.2, 2.8, 3.2);
    b.box(0x1d5e46, 1.2, 2, 0.2, x, 13.5, 5.05);
  }
  b.box(0xf5e6c8, 3.2, 5, 0.3, 0, 2.5, 5.05);
  b.box(PAL.sun, 0.35, 2.4, 0.35, 0, 15.3, 4.8);
  b.box(PAL.sun, 1.4, 0.35, 0.35, 0, 15.8, 4.8);
  for (let i = 0; i < 3; i++) b.box(0x1d5e46, 1.2, 2.6, 0.2, -4 + i * 4, 7.8, 5.05);
}

export function hill(b: Builder, r: R, color: number, rad: number, h: number) {
  b.add(G.cone10, color, 0, h / 2, 0, 0, r() * 3, 0, rad, h, rad * (0.8 + r() * 0.4));
}

export function bush(b: Builder, r: R, color: number) {
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) b.sphere(color, 0.9 + r() * 0.8, (r() - 0.5) * 2, 0.6, (r() - 0.5) * 2, 1, 0.75, 1);
}

export function bougainvillea(b: Builder, r: R) {
  for (let i = 0; i < 5; i++) b.sphere(i % 2 ? PAL.magenta : 0xff4fd8, 0.7 + r() * 0.5, (r() - 0.5) * 3, 2 + r() * 2, (r() - 0.5) * 1.5, 1, 0.8, 1);
}

export function rock(b: Builder, r: R, s = 1) {
  b.add(G.sphere, 0x7d7f78, 0, 0.3 * s, 0, r(), r() * 6, r(), 1.6 * s, 1.1 * s, 1.3 * s);
}

export function mooredCanoe(b: Builder, r: R) {
  const col = [PAL.azure, PAL.red, PAL.sun, PAL.teal][Math.floor(r() * 4)];
  b.add(G.cyl8, col, 0, 0.35, 0, Math.PI / 2, 0, 0, 0.6, 5, 0.45);
  b.add(G.cone6, col, 0, 0.45, 2.9, Math.PI / 2, 0, 0, 0.5, 1, 0.4);
  b.add(G.cone6, col, 0, 0.45, -2.9, -Math.PI / 2, 0, 0, 0.5, 1, 0.4);
  b.box(PAL.white, 0.15, 0.15, 4, 0, 0.75, 0);
  b.sphere(PAL.white, 0.12, 0.45, 0.55, 2.4);
}

export function lampPost(b: Builder) {
  b.cyl(0x2b2b2b, 0.1, 0.1, 4.5, 0, 2.25, 0);
  b.box(0x2b2b2b, 0.8, 0.1, 0.1, 0.3, 4.4, 0);
  b.sphere(0xfff3b0, 0.3, 0.6, 4.2, 0);
}

export function crowd(b: Builder, r: R, n = 8) {
  const shirt = [PAL.magenta, PAL.sun, PAL.azure, PAL.mint, PAL.white, PAL.orange, PAL.red];
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 6, z = (r() - 0.5) * 3;
    b.cyl(shirt[Math.floor(r() * shirt.length)], 0.28, 0.32, 1.1, x, 0.75, z, 0, 0, 0, 6);
    b.sphere(0x8d5a3b, 0.24, x, 1.55, z);
    if (r() > 0.6) b.box(shirt[Math.floor(r() * shirt.length)], 0.1, 0.8, 0.1, x + 0.3, 1.8, z, 0, 0, 0.5);
  }
}

export function scooter(b: Builder) {
  b.box(0xff4fb3, 0.6, 0.6, 1.5, 0, 0.6, 0);
  b.box(0xff4fb3, 0.55, 0.9, 0.35, 0, 0.9, 0.7);
  b.box(PAL.cream, 0.5, 0.15, 0.7, 0, 0.98, -0.25);
  b.cyl(0x222222, 0.28, 0.28, 0.15, 0, 0.28, 0.75, 0, 0, Math.PI / 2);
  b.cyl(0x222222, 0.28, 0.28, 0.15, 0, 0.28, -0.6, 0, 0, Math.PI / 2);
  b.box(0x333333, 0.8, 0.06, 0.06, 0, 1.4, 0.75);
}

export function jetty(b: Builder, len = 12) {
  for (let i = 0; i < len; i++) b.box(i % 2 ? 0xb0814a : 0x9a6236, 2.4, 0.15, 0.95, 0, 0.75, i);
  for (let i = 0; i < len; i += 3) {
    b.cyl(0x6e4224, 0.12, 0.12, 2, -1.1, 0.2, i);
    b.cyl(0x6e4224, 0.12, 0.12, 2, 1.1, 0.2, i);
  }
}
