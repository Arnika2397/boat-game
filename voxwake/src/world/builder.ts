import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/** Accumulates coloured primitives into one merged, vertex-coloured geometry (few draw calls). */
export class Builder {
  private parts: THREE.BufferGeometry[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  jitter = 0.06;
  private seed = 1;

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  push(x: number, y: number, z: number, ry = 0, sc = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0, 'YXZ')), _s.set(sc, sc, sc));
    this.stack.push(this.top.clone().multiply(_m));
  }
  pushM(m: THREE.Matrix4) { this.stack.push(this.top.clone().multiply(m)); }
  pop() { if (this.stack.length > 1) this.stack.pop(); }
  get top() { return this.stack[this.stack.length - 1]; }

  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, sway = 0) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    g.applyMatrix4(this.top.clone().multiply(_m));
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    _c.setHex(color);
    const j = 1 + (this.rand() - 0.5) * this.jitter * 2;
    for (let i = 0; i < n; i++) {
      cols[i * 3] = Math.min(1, _c.r * j);
      cols[i * 3 + 1] = Math.min(1, _c.g * j);
      cols[i * 3 + 2] = Math.min(1, _c.b * j);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const sw = new Float32Array(n);
    if (sway) sw.fill(sway);
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
    this.parts.push(g);
  }

  box(color: number, w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    this.add(G.box, color, x, y, z, rx, ry, rz, w, h, d);
  }
  cyl(color: number, rTop: number, rBot: number, h: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 8) {
    const g = seg === 8 ? G.cyl8 : seg === 6 ? G.cyl6 : G.cyl12;
    // unit cylinder radius 1, height 1, scaled
    if (rTop === rBot) this.add(g, color, x, y, z, rx, ry, rz, rTop, h, rTop);
    else this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz);
  }
  cone(color: number, r: number, h: number, x = 0, y = 0, z = 0, seg = 4, ry = Math.PI / 4, rx = 0, rz = 0, sway = 0) {
    this.add(seg === 4 ? G.cone4 : seg === 6 ? G.cone6 : G.cone10, color, x, y, z, rx, ry, rz, r, h, r, sway);
  }
  sphere(color: number, r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    this.add(G.sphere, color, x, y, z, 0, 0, 0, r * sx, r * sy, r * sz);
  }

  get count() { return this.parts.length; }

  build(): THREE.BufferGeometry | null {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return merged;
  }
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone10: new THREE.ConeGeometry(1, 1, 10),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  frond: (() => {
    // a bent palm frond: flat tapered strip with a droop
    const g = new THREE.BufferGeometry();
    const segs = 6, len = 4.2;
    const pos: number[] = [];
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const w0 = 0.65 * Math.sin(Math.PI * Math.min(0.95, t0 + 0.08)), w1 = 0.65 * Math.sin(Math.PI * Math.min(0.95, t1 + 0.08));
      const y0 = -1.6 * t0 * t0, y1 = -1.6 * t1 * t1;
      const z0 = len * t0, z1 = len * t1;
      pos.push(-w0, y0, z0, w0, y0, z0, w1, y1, z1, -w0, y0, z0, w1, y1, z1, -w1, y1, z1);
      // slight V fold for toon shading variety
      pos.push(0, y0 + 0.12, z0, w0, y0, z0, w1, y1, z1);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  })(),
};
