import * as THREE from 'three';
import { toon, addOutlines, PAL } from './materials';
import type { BoatKind } from '../game/bots';

function hullGeo(L: number, W: number, H: number, bow = 0.42): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -L / 2);
  s.lineTo(W / 2, -L / 2);
  s.lineTo(W / 2, L * (0.5 - bow));
  s.quadraticCurveTo(W / 2, L * 0.42, 0, L / 2);
  s.quadraticCurveTo(-W / 2, L * 0.42, -W / 2, L * (0.5 - bow));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(Math.PI / 2);
  g.translate(0, H * 0.75, 0);
  // taper the bottom a little for a V-hull feel
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < H * 0.2) p.setX(i, p.getX(i) * 0.72);
  }
  g.computeVertexNormals();
  return g;
}

function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1: number, r2: number, h: number, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);

function driver(shirt: number, cap: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.28, 0.34, 0.8, 8), shirt, 0, 0.4, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.26, 1), 0x8d5a3b, 0, 1.02, 0));
  g.add(mesh(cyl(0.27, 0.29, 0.14, 10), cap, 0, 1.2, 0));
  g.add(mesh(box(0.34, 0.05, 0.25), cap, 0, 1.15, 0.22));
  const arm = mesh(cyl(0.08, 0.08, 0.6, 6), shirt, 0.32, 0.55, 0.15, 0.9, 0, -0.3);
  arm.name = 'arm';
  g.add(arm);
  g.add(mesh(cyl(0.08, 0.08, 0.6, 6), shirt, -0.32, 0.55, 0.15, 0.9, 0, 0.3));
  return g;
}

export interface BoatView {
  root: THREE.Group; // positioned on course
  body: THREE.Group; // heave/pitch/roll
  flame: THREE.Mesh;
  shield: THREE.Mesh;
  length: number;
}

export function buildBoat(kind: BoatKind, color: number, accent: number): BoatView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let L = 5;
  const shirt = accent;
  switch (kind) {
    case 'canoe': {
      L = 6;
      body.add(mesh(hullGeo(6, 1.5, 0.9, 0.48), color));
      body.add(mesh(box(1.3, 0.12, 4.0), 0x8a5a2b, 0, 0.98, -0.3));
      body.add(mesh(box(1.55, 0.18, 0.5), accent, 0, 0.75, 2.2));
      // painted bow eyes
      for (const sx of [-1, 1]) {
        const eye = mesh(new THREE.CircleGeometry(0.22, 12), PAL.white, sx * 0.62, 0.62, 2.0, 0, sx * Math.PI / 2 * 0.86, 0);
        eye.userData.noOutline = true;
        body.add(eye);
        const pupil = mesh(new THREE.CircleGeometry(0.1, 10), PAL.ink, sx * 0.64, 0.62, 2.05, 0, sx * Math.PI / 2 * 0.86, 0);
        pupil.userData.noOutline = true;
        body.add(pupil);
      }
      body.add(mesh(box(0.5, 0.7, 0.6), 0x333333, 0, 0.9, -3.0));
      const d = driver(shirt, PAL.white);
      d.position.set(0, 1.0, -1.6);
      body.add(d);
      break;
    }
    case 'shack': {
      L = 6.4;
      body.add(mesh(hullGeo(6.4, 2.3, 1.0), color));
      body.add(mesh(box(2.1, 0.12, 3.2), PAL.cream, 0, 1.12, -0.9));
      body.add(mesh(box(2.4, 0.22, 0.25), accent, 0, 0.75, 0.0));
      const ws = mesh(box(1.9, 0.6, 0.1), 0xbff4ff, 0, 1.45, 0.7, -0.4);
      body.add(ws);
      for (const [x, z] of [[-0.95, -0.3], [0.95, -0.3], [-0.95, -2.3], [0.95, -2.3]]) body.add(mesh(cyl(0.06, 0.06, 1.6, 6), 0xc79a5a, x, 1.9, z));
      body.add(mesh(new THREE.ConeGeometry(1.75, 0.8, 4), PAL.thatch, 0, 3.0, -1.3, 0, Math.PI / 4, 0));
      body.add(mesh(box(0.55, 0.9, 0.55), 0x2b2b2b, 0, 1.2, -3.3));
      const d = driver(shirt, accent);
      d.position.set(0, 1.15, -0.5);
      body.add(d);
      break;
    }
    case 'dhow': {
      L = 7;
      body.add(mesh(hullGeo(7, 2.0, 1.1, 0.5), color));
      body.add(mesh(box(1.8, 0.8, 1.2), 0x9a6236, 0, 1.5, -2.6));
      body.add(mesh(box(2.1, 0.2, 0.25), accent, 0, 0.85, 0.5));
      body.add(mesh(cyl(0.09, 0.11, 5.5, 6), 0x6e4224, 0, 3.6, 0.6, 0.12));
      const sail = new THREE.BufferGeometry();
      sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 6.3, 2.0, 0, 1.6, 2.6, 0, 1.4, -2.2], 3));
      sail.computeVertexNormals();
      const sm = new THREE.Mesh(sail, toon(0xfff7e0, { side: THREE.DoubleSide }));
      sm.position.x = 0.15;
      sm.userData.noOutline = true;
      body.add(sm);
      const stripe = new THREE.BufferGeometry();
      stripe.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.3, 2.3, 0, 2.6, 2.4, 0, 2.3, -0.6], 3));
      stripe.computeVertexNormals();
      const st = new THREE.Mesh(stripe, toon(accent, { side: THREE.DoubleSide }));
      st.position.x = 0.17;
      st.userData.noOutline = true;
      body.add(st);
      const d = driver(shirt, PAL.white);
      d.position.set(0, 1.2, -1.3);
      body.add(d);
      break;
    }
    case 'cat': {
      L = 6.5;
      for (const x of [-1.2, 1.2]) body.add(mesh(hullGeo(6.5, 0.9, 0.9, 0.5), color, x, 0, 0));
      body.add(mesh(box(3.2, 0.2, 4.2), PAL.cream, 0, 1.1, -0.4));
      body.add(mesh(box(3.3, 0.18, 0.2), accent, 0, 1.25, 1.7));
      for (const x of [-0.8, 0.8]) body.add(mesh(cyl(0.22, 0.26, 1.2, 8), accent, x, 1.8, -2.1));
      const arch = mesh(new THREE.TorusGeometry(1.5, 0.07, 6, 16, Math.PI), 0x333333, 0, 1.2, -0.6);
      body.add(arch);
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI;
        const bulb = mesh(new THREE.IcosahedronGeometry(0.12, 0), [PAL.sun, PAL.magenta, PAL.mint][i % 3], Math.cos(a) * 1.5, 1.2 + Math.sin(a) * 1.5, -0.6);
        bulb.userData.noOutline = true;
        (bulb.material as THREE.MeshToonMaterial) = toon([PAL.sun, PAL.magenta, PAL.mint][i % 3], { emissive: [PAL.sun, PAL.magenta, PAL.mint][i % 3] });
        body.add(bulb);
      }
      const d = driver(shirt, PAL.white);
      d.position.set(0, 1.2, 0.3);
      body.add(d);
      break;
    }
    case 'ferry': {
      L = 6.8;
      body.add(mesh(hullGeo(6.8, 3.0, 1.0, 0.25), color));
      body.add(mesh(box(2.8, 0.15, 5.0), PAL.cream, 0, 1.1, -0.3));
      body.add(mesh(box(1.8, 1.4, 1.5), PAL.white, 0, 1.9, -2.0));
      body.add(mesh(box(2.0, 0.15, 1.7), accent, 0, 2.65, -2.0));
      body.add(mesh(box(1.4, 0.5, 0.05), 0xbff4ff, 0, 2.1, -1.24));
      for (const x of [-1.45, 1.45]) body.add(mesh(box(0.08, 0.5, 4.5), PAL.magenta, x, 1.45, 0.0));
      for (const x of [-1.6, 1.6]) for (const z of [-1.5, 0.5]) body.add(mesh(new THREE.TorusGeometry(0.28, 0.1, 6, 10), 0x222222, x, 0.8, z, 0, Math.PI / 2, 0));
      const d = driver(shirt, accent);
      d.position.set(0, 1.2, -2.0);
      body.add(d);
      break;
    }
  }
  addOutlines(body, 0.05);
  // nitro flame (additive)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.9, -L / 2 - 1.2);
  flame.visible = false;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.8, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff0ccf, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  inner.position.y = -0.3;
  flame.add(inner);
  body.add(flame);
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(L * 0.62, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0ccf, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }));
  shield.position.y = 1.0;
  shield.scale.set(0.75, 0.55, 1);
  shield.visible = false;
  body.add(shield);
  return { root, body, flame, shield, length: L };
}
