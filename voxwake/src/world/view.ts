import * as THREE from 'three';
import { Water, Sky, waveHeight } from './water';
import { buildScenery } from './scenery';
import { buildBoat, type BoatView } from './boats';
import { Particles, Wake, glowPoints, Rain, Gulls } from './vfx';
import { toon, addOutlines, PAL, sharedUniforms, setOutlineFog } from './materials';
import type { RaceDirector } from '../game/race';
import type { Hazard } from '../game/course';
import type { BoatKind } from '../game/bots';

function textTexture(text: string, w = 512, h = 128, bg = '#FFFBE7', fg = '#0B3B2A', font = 'bold 54px "Share Tech Mono", monospace') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#0B3B2A';
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2, w - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class WorldView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2000);
  private water = new Water();
  private sky = new Sky();
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x2bbe8a, 1.2);
  private course = new THREE.Group();
  boats: BoatView[] = [];
  private wakes: Wake[] = [];
  spray = new Particles(1400, false);
  sparks = new Particles(1600, true);
  private hazardObjs = new Map<number, THREE.Object3D>();
  private pickups: THREE.InstancedMesh | null = null;
  private gateObjs: { g: THREE.Group; ring: THREE.Mesh; id: number }[] = [];
  private glows: THREE.Points | null = null;
  private rain: Rain | null = null;
  private gulls = new Gulls(7);
  race: RaceDirector | null = null;
  private time = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private fovKick = 0;
  private shake = 0;
  private fireworkAt = 0;
  reducedMotion = false;
  cinematic = 0; // seconds of intro fly-by remaining
  attract = false;
  orbitFinish = 0;
  private tmp = new THREE.Vector3();
  private quality = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.quality = Math.min(window.devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(this.quality);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.sky.mesh, this.water.mesh, this.sun, this.sun.target, this.hemi, this.course, this.spray.points, this.sparks.points, this.gulls.group);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.course.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !m.userData.shared) m.geometry.dispose();
    });
    this.course.clear();
    this.boats = [];
    this.wakes = [];
    this.hazardObjs.clear();
    this.gateObjs = [];
    this.pickups = null;
    this.glows = null;
    if (this.rain) { this.scene.remove(this.rain.lines); this.rain = null; }
  }

  load(race: RaceDirector) {
    this.clear();
    this.race = race;
    const lv = race.opts.level;
    const th = lv.theme;
    const fog = new THREE.Color(th.fog);
    this.scene.fog = new THREE.Fog(fog, th.fogNear, th.fogFar);
    setOutlineFog(fog, th.fogNear, th.fogFar);
    this.sky.setTheme(th);
    this.water.setTheme(th, fog);
    this.sun.color.setHex(th.sunColor);
    this.sun.intensity = th.sunIntensity;
    this.hemi.color.setHex(th.hemiSky);
    this.hemi.groundColor.setHex(th.hemiGround);
    this.hemi.intensity = th.night ? 0.9 : 1.3;
    sharedUniforms.uWind.value = th.rain ? 2.5 : 1;
    const sc = buildScenery(race.course, lv);
    this.course.add(sc.group);
    if (sc.glows.length) {
      this.glows = glowPoints(sc.glows, sc.glowColors, th.night ? 4.5 : 3);
      this.course.add(this.glows);
    }
    if (th.rain) { this.rain = new Rain(); this.scene.add(this.rain.lines); }
    race.racers.forEach((r) => {
      const bv = buildBoat(r.boat, r.color, r.accent);
      this.course.add(bv.root);
      this.boats.push(bv);
      const wk = new Wake(th.night ? 0xbfe9ff : 0xffffff);
      this.course.add(wk.mesh);
      this.wakes.push(wk);
      if (r.remote) bv.body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m.material as THREE.Material).transparent) {
          const mat = (m.material as THREE.Material).clone();
          mat.transparent = true; mat.opacity = 0.75;
          m.material = mat;
        }
      });
    });
    for (const h of race.course.hazards) {
      const o = this.hazardMesh(h);
      this.hazardObjs.set(h.id, o);
      this.course.add(o);
    }
    this.buildPickups(race);
    for (const g of race.course.gates) this.buildGate(g.id, g.s, g.lat, g.phrase);
    // initial camera
    const p = race.course.world(-14, 0);
    this.camPos.set(p.x, 6, p.z);
    this.camLook.copy(race.course.world(10, 0));
    this.cinematic = this.attract ? 0 : 3.2;
    this.orbitFinish = 0;
  }

  private hazardMesh(h: Hazard): THREE.Object3D {
    const g = new THREE.Group();
    switch (h.type) {
      case 'buoy': {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.0, 10), toon(PAL.magenta)));
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 0.6, 10), toon(PAL.cream));
        top.position.y = 0.8;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 10), toon(PAL.magenta));
        cap.position.y = 1.4;
        g.add(top, cap);
        break;
      }
      case 'log': {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 3.6, 8), toon(0x8a5a2b));
        log.rotation.z = Math.PI / 2;
        log.position.y = 0.2;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 6), toon(0x6e4224));
        br.position.set(0.6, 0.6, 0);
        br.rotation.z = -0.6;
        g.add(log, br);
        break;
      }
      case 'rock': {
        const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), toon(0x6f6a62));
        r.scale.set(1.1, 0.8, 1);
        r.position.y = 0.2;
        const foam = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.4, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
        foam.rotation.x = -Math.PI / 2;
        foam.position.y = 0.35;
        foam.userData.noOutline = true;
        g.add(r, foam);
        break;
      }
      case 'basket': {
        const cols = [0xff9f1c, 0xe2382f, 0xffe600];
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.7, 8), toon(0xc79a5a));
          b.position.set((i - 1) * 1.1, 0.25, (i % 2) * 0.6);
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), toon(cols[i]));
          f.position.set((i - 1) * 1.1, 0.6, (i % 2) * 0.6);
          g.add(b, f);
        }
        break;
      }
      case 'orb': {
        const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: 0x9cfff0 }));
        o.position.y = 0.9;
        o.userData.noOutline = true;
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0x19d3c5, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.y = 0.9;
        halo.userData.noOutline = true;
        g.add(o, halo);
        break;
      }
    }
    addOutlines(g, 0.05);
    return g;
  }

  private buildPickups(race: RaceDirector) {
    const geo = new THREE.TorusGeometry(0.42, 0.2, 6, 10, Math.PI * 1.25);
    const m = new THREE.InstancedMesh(geo, toon(0xf6dc9a, { emissive: 0x4a3200 }), race.course.pickups.length);
    m.frustumCulled = false;
    this.pickups = m;
    this.course.add(m);
  }

  private buildGate(id: number, s: number, lat: number, phrase: string) {
    const course = this.race!.course;
    const g = new THREE.Group();
    const p = course.world(s, lat);
    g.position.copy(p);
    g.rotation.y = course.heading(s);
    for (const x of [-4.6, 4.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 8, 8), toon(0x9a6236));
      post.position.set(x, 4, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 0.5), toon(0x6e4224));
    beam.position.y = 7.9;
    g.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), new THREE.MeshBasicMaterial({ map: textTexture(phrase.toUpperCase(), 1024, 256, '#FF0CCF', '#FFFBE7', 'bold 92px "Share Tech Mono", monospace'), side: THREE.DoubleSide }));
    sign.position.set(0, 6.4, 0);
    sign.rotation.y = Math.PI;
    sign.userData.noOutline = true;
    g.add(sign);
    const kicker = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('BONUS GATE', 512, 104, '#FFE600', '#0B3B2A', 'bold 60px "Share Tech Mono", monospace'), side: THREE.DoubleSide }));
    kicker.position.set(0, 8.6, 0);
    kicker.rotation.y = Math.PI;
    kicker.userData.noOutline = true;
    g.add(kicker);
    addOutlines(g, 0.06);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.18, 8, 40, Math.PI), new THREE.MeshBasicMaterial({ color: PAL.magenta, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.2;
    ring.userData.noOutline = true;
    g.add(ring);
    this.course.add(g);
    this.gateObjs.push({ g, ring, id });
  }

  boatWorld(i: number, out = new THREE.Vector3()) {
    return this.boats[i]?.root.getWorldPosition(out) ?? out;
  }

  kick(amount = 4) { if (!this.reducedMotion) this.fovKick = Math.max(this.fovKick, amount); }
  hitShake() { if (!this.reducedMotion) this.shake = 0.35; }

  burst(x: number, y: number, z: number, colors: number[], n = 60, speed = 9, size = 1.2, grav = -6) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.sparks.emit(x, y, z, Math.cos(th) * Math.cos(ph) * sp, Math.abs(Math.sin(ph)) * sp + 2, Math.sin(th) * Math.cos(ph) * sp,
        colors[i % colors.length], size, 1.2 + Math.random() * 0.8, grav, 1.0);
    }
  }

  splash(x: number, z: number, n = 30, color = 0xffffff) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.spray.emit(x, 0.5, z, Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp, color, 1.0 + Math.random() * 0.8, 0.9);
    }
  }

  confetti() {
    const p = this.camera.position;
    const dir = this.tmp.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const cx = p.x + dir.x * 10, cz = p.z + dir.z * 10;
    const cols = [PAL.magenta, PAL.sun, PAL.mint, 0xffffff, PAL.azure];
    for (let i = 0; i < 260; i++) {
      this.sparks.emit(cx + (Math.random() - 0.5) * 16, p.y + 4 + Math.random() * 4, cz + (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, cols[i % cols.length], 0.7, 3 + Math.random() * 2, -2.2, 1.6);
    }
  }

  update(dt: number) {
    this.time += dt;
    sharedUniforms.uTime.value = this.time;
    const race = this.race;
    if (!race) return;
    const course = race.course;
    const t = race.renderTime;
    const swell = race.opts.level.theme.swell;
    race.boats.forEach((b, i) => {
      const bv = this.boats[i];
      if (!bv) return;
      const ps = race.pose(i);
      const p = course.world(ps.s, ps.lat, this.tmp);
      const h = course.heading(ps.s);
      bv.root.position.set(p.x, 0, p.z);
      bv.root.rotation.y = h - ps.yaw;
      const air = race.isAir(i);
      let y = waveHeight(p.x, p.z, this.time, swell) + 0.05;
      if (air) {
        const k = Math.max(0, Math.min(1, (t - b.airStart) / (b.airUntil - b.airStart)));
        y += Math.sin(k * Math.PI) * 3.2;
      }
      bv.body.position.y = y;
      bv.body.rotation.z = -b.latV * 0.025 + Math.sin(this.time * 1.7 + i) * 0.03 * swell;
      bv.body.rotation.x = -Math.min(0.12, b.v * 0.004) + Math.sin(this.time * 1.3 + i * 2) * 0.02 * swell + (air ? -0.15 : 0);
      const nitro = race.isNitro(i);
      bv.flame.visible = nitro;
      if (nitro) bv.flame.scale.setScalar(0.85 + Math.random() * 0.35);
      bv.shield.visible = b.shield;
      if (b.shield) bv.shield.rotation.y += dt * 1.2;
      const arm = bv.body.getObjectByName('arm');
      if (arm) arm.rotation.x = 0.9 + Math.sin(this.time * 6 + i) * 0.25;
      // wake + spray
      const sternX = p.x - Math.sin(h) * bv.length * 0.5, sternZ = p.z - Math.cos(h) * bv.length * 0.5;
      const wake = this.wakes[i];
      wake.update(dt, sternX, sternZ, h, air ? 0 : 0.5 + b.v * 0.07 * (nitro ? 1.4 : 1));
      if (i === 0 && race.isFlow(0)) wake.setColor(Math.floor(this.time * 4) % 2 ? PAL.magenta : PAL.sun);
      else if (i === 0 && nitro) wake.setColor(PAL.sun);
      else wake.setColor(race.opts.level.theme.night ? 0xbfe9ff : 0xffffff);
      if (!air && b.v > 4 && Math.random() < b.v / 22) {
        const bx = p.x + Math.sin(h) * bv.length * 0.45, bz = p.z + Math.cos(h) * bv.length * 0.45;
        const side = Math.random() < 0.5 ? -1 : 1;
        const rx = -Math.cos(h) * side, rz = Math.sin(h) * side;
        this.spray.emit(bx + rx * 0.8, 0.6, bz + rz * 0.8, rx * (2 + Math.random() * 2) + Math.sin(h) * b.v * 0.3, 2.5 + Math.random() * 2.5,
          rz * (2 + Math.random() * 2) + Math.cos(h) * b.v * 0.3, 0xffffff, 0.7 + b.v * 0.03, 0.6);
      }
      if (nitro && i === 0) this.sparks.emit(sternX, 1, sternZ, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, Math.random() < 0.5 ? PAL.sun : PAL.magenta, 1.1, 0.5, 0, 2);
      if (race.isFlow(i) && i === 0 && Math.random() < 0.7) this.sparks.emit(sternX, 1.2, sternZ, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, [PAL.magenta, PAL.sun, PAL.mint][Math.floor(Math.random() * 3)], 0.9, 0.9, 0.5, 1);
    });
    // hazards
    for (const h of course.hazards) {
      const o = this.hazardObjs.get(h.id);
      if (!o) continue;
      const lat = course.hazardLat(h, t);
      const p = course.world(h.s, lat, this.tmp);
      o.position.set(p.x, waveHeight(p.x, p.z, this.time, swell) * 0.8, p.z);
      o.rotation.y = course.heading(h.s) + (h.type === 'log' ? 0.4 + Math.sin(t * 0.8 + h.phase) * 0.3 : 0);
      if (h.type === 'buoy') o.rotation.z = Math.sin(this.time * 2 + h.phase) * 0.12;
      if (h.type === 'orb') o.position.y = 0.3 + Math.sin(this.time * 2 + h.phase) * 0.3;
    }
    // pickups
    if (this.pickups) {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const sc = new THREE.Vector3();
      const ps = race.boats[0].s;
      course.pickups.forEach((pk, k) => {
        const taken = pk.taken[0];
        const near = Math.abs(pk.s - ps) < 260;
        const p = course.world(pk.s, pk.lat, this.tmp);
        p.y = 1.0 + Math.sin(this.time * 3 + k) * 0.2;
        sc.setScalar(taken || !near ? 0 : 1);
        q.setFromEuler(e.set(0.3, this.time * 2.5 + k, 0));
        m4.compose(p, q, sc);
        this.pickups!.setMatrixAt(k, m4);
      });
      this.pickups.instanceMatrix.needsUpdate = true;
    }
    for (const go of this.gateObjs) {
      const active = race.activeGate?.id === go.id;
      (go.ring.material as THREE.MeshBasicMaterial).opacity = active ? 0.6 + Math.sin(this.time * 8) * 0.4 : 0.35;
      go.ring.scale.setScalar(active ? 1 + Math.sin(this.time * 8) * 0.04 : 1);
    }
    if (this.glows) (this.glows.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    // fireworks over night/finish
    const th = race.opts.level.theme;
    if ((th.fireworks || race.state === 'finished') && this.time > this.fireworkAt) {
      this.fireworkAt = this.time + (race.state === 'finished' ? 0.35 : 1.4 + Math.random() * 1.5);
      const ahead = course.world(Math.min(course.total - 5, race.boats[0].s + 60 + Math.random() * 80), (Math.random() - 0.5) * 50);
      this.burst(ahead.x, 30 + Math.random() * 15, ahead.z, [[PAL.magenta, PAL.sun], [PAL.mint, 0xffffff], [PAL.sun, PAL.orange], [PAL.azure, PAL.magenta]][Math.floor(Math.random() * 4)], 90, 14, 2.2, -4);
    }
    this.spray.update(dt);
    this.sparks.update(dt);
    this.updateCamera(dt);
    this.water.update(this.time, this.camera.position);
    this.sky.update(this.time, this.camera.position);
    this.gulls.update(this.time, dt, this.camera.position);
    if (this.rain) this.rain.update(dt, this.camera.position);
    const lp = this.camera.position;
    this.sun.position.set(lp.x - 40, 80, lp.z - 60);
    this.sun.target.position.set(lp.x, 0, lp.z);
  }

  private updateCamera(dt: number) {
    const race = this.race!;
    const course = race.course;
    const b = race.boats[0];
    const T = b.T;
    let wantPos: THREE.Vector3, wantLook: THREE.Vector3;
    if (this.cinematic > 0) {
      // intro fly-by: sweep from high ahead down behind the start line
      this.cinematic -= dt;
      const k = 1 - Math.max(0, this.cinematic) / 3.2;
      const e = k * k * (3 - 2 * k);
      const from = course.world(120, 18);
      from.y = 26;
      const to = course.world(-9, b.lat * 0.5);
      to.y = 4.2;
      wantPos = from.lerp(to, e);
      wantLook = course.world(10 + (1 - e) * 30, 0);
      this.camPos.copy(wantPos);
      this.camLook.copy(wantLook);
    } else if (this.orbitFinish > 0 || race.state === 'finished') {
      this.orbitFinish += dt;
      const p = this.boatWorld(0, new THREE.Vector3());
      const a = this.orbitFinish * 0.35 + course.heading(b.s) + Math.PI * 0.8;
      wantPos = new THREE.Vector3(p.x + Math.sin(a) * 11, 4.5, p.z + Math.cos(a) * 11);
      wantLook = p.clone().setY(1.2);
      this.camPos.lerp(wantPos, 1 - Math.exp(-3 * dt));
      this.camLook.lerp(wantLook, 1 - Math.exp(-5 * dt));
    } else if (this.attract) {
      const s = race.boats.reduce((a2, bb) => a2 + bb.s, 0) / race.boats.length;
      const a = this.time * 0.1;
      wantPos = course.world(s - 30 + Math.sin(a * 0.7) * 8, Math.sin(a) * Math.min(18, course.halfWidth + 4));
      wantPos.y = 11 + Math.sin(a * 1.3) * 3;
      wantLook = course.world(s + 18, 0);
      wantLook.y = 1;
      this.camPos.lerp(wantPos, 1 - Math.exp(-2 * dt));
      this.camLook.lerp(wantLook, 1 - Math.exp(-3 * dt));
    } else {
      const back = 9 + 1.5 * T + (race.finalSprint ? 1.5 : 0);
      const ps = race.pose(0);
      const h = course.heading(Math.max(0, ps.s));
      const p = this.boatWorld(0, new THREE.Vector3());
      const lead = Math.max(-2.5, Math.min(2.5, b.latV * 0.35));
      const rx = -Math.cos(h), rz = Math.sin(h);
      wantPos = new THREE.Vector3(p.x - Math.sin(h) * back + rx * lead * 0.5, 4.2 + T * 0.6, p.z - Math.cos(h) * back + rz * lead * 0.5);
      wantLook = course.world(ps.s + 12, ps.lat * 0.7 + lead);
      wantLook.y = 1.4;
      this.camPos.lerp(wantPos, 1 - Math.exp(-6 * dt));
      this.camLook.lerp(wantLook, 1 - Math.exp(-8 * dt));
    }
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      const a = this.shake * 0.8;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.camLook);
    if (!this.reducedMotion && this.cinematic <= 0 && race.state === 'racing') this.camera.rotateZ(Math.max(-0.1, Math.min(0.1, -b.latV * 0.006)));
    this.fovKick = Math.max(0, this.fovKick - dt * 16);
    const fov = this.reducedMotion ? 68 : 62 + 16 * T + (race.isNitro(0) ? 7 : 0) + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }
  }

  project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, visible: p.z < 1 && p.z > -1 };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Renders a boat portrait (for the Garage / pre-race cards). */
  boatThumb(kind: BoatKind, color: number, accent: number, w = 320, h = 220): string {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2bbe8a, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(5, 8, 6);
    scene.add(d);
    const bv = buildBoat(kind, color, accent);
    bv.root.rotation.y = -0.7;
    scene.add(bv.root);
    const cam = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    cam.position.set(0, 4.5, 12);
    cam.lookAt(0, 1.2, 0);
    const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, cam);
    const buf = new Uint8Array(w * 2 * h * 2 * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, w * 2, h * 2, buf);
    this.renderer.setRenderTarget(null);
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d')!;
    const img = g.createImageData(w * 2, h * 2);
    for (let y = 0; y < h * 2; y++) img.data.set(buf.subarray((h * 2 - 1 - y) * w * 2 * 4, (h * 2 - y) * w * 2 * 4), y * w * 2 * 4);
    g.putImageData(img, 0, 0);
    rt.dispose();
    return c.toDataURL('image/png');
  }
}
