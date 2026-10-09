import * as THREE from 'three';

function radialTexture(soft = true): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.7, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Generic pooled CPU particle system (spray, confetti, fireworks, sparkles). */
export class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private baseSize: Float32Array;
  private drag: Float32Array;
  private next = 0;
  constructor(private cap: number, additive: boolean, soft = true) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.baseSize = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: radialTexture(soft) }, uScale: { value: 300 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0);
          gl_PointSize = size * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); if (t.a*vA < 0.02) discard; gl_FragColor = vec4(vC, t.a*vA); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, life: number, grav = -9.8, drag = 0.4) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = _c.setHex(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life; this.baseSize[i] = size; this.grav[i] = grav; this.drag[i] = drag;
  }

  update(dt: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < -0.2 && this.grav[i] < -3) this.life[i] = 0;
      this.alpha[i] = Math.min(1, k * 2.2);
      this.size[i] = this.baseSize[i] * (0.6 + 0.4 * k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
  }
}
const _c = new THREE.Color();

/** Foam wake ribbon trailing a boat (05 §7). */
export class Wake {
  mesh: THREE.Mesh;
  private pts: { x: number; z: number; rx: number; rz: number; age: number; w: number }[] = [];
  private pos: Float32Array;
  private alpha: Float32Array;
  private readonly N = 40;
  private acc = 0;
  constructor(color = 0xffffff) {
    this.pos = new Float32Array(this.N * 2 * 3);
    this.alpha = new Float32Array(this.N * 2);
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }
  setColor(c: number) { (this.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value.setHex(c); }

  update(dt: number, x: number, z: number, heading: number, width: number) {
    this.acc += dt;
    for (const p of this.pts) p.age += dt;
    if (this.acc > 0.06) {
      this.acc = 0;
      this.pts.unshift({ x, z, rx: -Math.cos(heading), rz: Math.sin(heading), age: 0, w: width });
      if (this.pts.length > this.N) this.pts.pop();
    } else if (this.pts.length) {
      const p0 = this.pts[0];
      p0.x = x; p0.z = z; p0.w = width;
    }
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)];
      if (!p) break;
      const spread = p.w * (0.55 + p.age * 0.85);
      const a = i < this.pts.length ? Math.max(0, 0.6 - p.age * 0.42) * Math.min(1, p.w / 1.4) : 0;
      this.pos.set([p.x + p.rx * spread, 0.32, p.z + p.rz * spread], i * 6);
      this.pos.set([p.x - p.rx * spread, 0.32, p.z - p.rz * spread], i * 6 + 3);
      this.alpha[i * 2] = a;
      this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
  reset() { this.pts = []; this.alpha.fill(0); }
}

export function glowPoints(positions: THREE.Vector3[], colors: number[], size = 3.5): THREE.Points {
  const p = new Float32Array(positions.length * 3);
  const c = new Float32Array(positions.length * 3);
  const s = new Float32Array(positions.length);
  const a = new Float32Array(positions.length);
  positions.forEach((v, i) => {
    p.set([v.x, v.y, v.z], i * 3);
    _c.setHex(colors[i]);
    c.set([_c.r, _c.g, _c.b], i * 3);
    s[i] = size;
    a[i] = 0.9;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(a, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: radialTexture(true) }, uScale: { value: 300 }, uTime: { value: 0 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; uniform float uTime;
      void main(){ vC = color; vA = alpha * (0.8 + 0.2*sin(uTime*3.0 + position.x)); vec4 mv = modelViewMatrix*vec4(position,1.0);
        gl_PointSize = size * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

export class Rain {
  lines: THREE.LineSegments;
  private pos: Float32Array;
  private readonly N = 1400;
  constructor() {
    this.pos = new Float32Array(this.N * 6);
    for (let i = 0; i < this.N; i++) this.seed(i, Math.random() * 30);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.45 }));
    this.lines.frustumCulled = false;
  }
  private seed(i: number, y: number) {
    const x = (Math.random() - 0.5) * 80, z = (Math.random() - 0.5) * 80;
    this.pos.set([x, y, z, x + 0.15, y + 1.1, z + 0.2], i * 6);
  }
  update(dt: number, cam: THREE.Vector3) {
    this.lines.position.set(cam.x, 0, cam.z);
    for (let i = 0; i < this.N; i++) {
      this.pos[i * 6 + 1] -= 32 * dt;
      this.pos[i * 6 + 4] -= 32 * dt;
      if (this.pos[i * 6 + 1] < 0) this.seed(i, 25 + Math.random() * 5);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export class Gulls {
  group = new THREE.Group();
  private birds: { m: THREE.Group; r: number; a: number; sp: number; h: number; l: THREE.Mesh; rr: THREE.Mesh }[] = [];
  constructor(n = 7) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const wing = new THREE.PlaneGeometry(1.4, 0.35);
    wing.translate(0.7, 0, 0);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Group();
      const l = new THREE.Mesh(wing, mat);
      const rr = new THREE.Mesh(wing, mat);
      rr.scale.x = -1;
      m.add(l, rr);
      this.group.add(m);
      this.birds.push({ m, r: 18 + Math.random() * 30, a: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.25, h: 14 + Math.random() * 10, l, rr });
    }
  }
  update(t: number, dt: number, center: THREE.Vector3) {
    for (const b of this.birds) {
      b.a += b.sp * dt;
      b.m.position.set(center.x + Math.cos(b.a) * b.r, b.h + Math.sin(t + b.r) * 1.5, center.z + 60 + Math.sin(b.a) * b.r);
      b.m.rotation.y = -b.a;
      const flap = Math.sin(t * 7 + b.r) * 0.5;
      b.l.rotation.z = flap;
      b.rr.rotation.z = -flap;
    }
  }
}
