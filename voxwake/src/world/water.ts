import * as THREE from 'three';
import type { Theme } from '../game/levels';

const NOISE = `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
`;

export function waveHeight(x: number, z: number, t: number, swell: number): number {
  return swell * (0.16 * Math.sin(x * 0.11 + t * 1.1) + 0.12 * Math.sin(z * 0.17 - t * 1.4) + 0.08 * Math.sin((x + z) * 0.27 + t * 1.9));
}

export class Water {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  constructor() {
    const geo = new THREE.PlaneGeometry(1400, 1400, 140, 140);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uSwell: { value: 1 },
        uShallow: { value: new THREE.Color(0x2fe6d2) }, uDeep: { value: new THREE.Color(0x0a8fa3) },
        uFoam: { value: new THREE.Color(0xf4fffb) }, uSunDir: { value: new THREE.Vector3(0.3, 0.5, 0.8).normalize() },
        uFogColor: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 500 },
        uSky: { value: new THREE.Color(0xd8fbff) }, uNight: { value: 0 },
      },
      vertexShader: `
        uniform float uTime; uniform float uSwell;
        varying vec3 vW; varying float vH; varying float vDepth;
        void main(){
          vec4 w = modelMatrix * vec4(position,1.0);
          float h = uSwell*(0.16*sin(w.x*0.11+uTime*1.1)+0.12*sin(w.z*0.17-uTime*1.4)+0.08*sin((w.x+w.z)*0.27+uTime*1.9));
          w.y += h; vH = h; vW = w.xyz;
          vec4 mv = viewMatrix * w; vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uSunDir;
        uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform vec3 uSky; uniform float uNight;
        varying vec3 vW; varying float vH; varying float vDepth;
        ${NOISE}
        void main(){
          vec2 p = vW.xz;
          float n1 = vnoise(p*0.045 + vec2(uTime*0.05, uTime*0.03));
          float n2 = vnoise(p*0.11 - vec2(uTime*0.09, -uTime*0.04));
          vec3 col = mix(uDeep, uShallow, smoothstep(0.25, 0.75, n1*0.7+n2*0.3));
          // toon bands on wave crests
          col = mix(col, col*1.12, step(0.12, vH));
          // crisp foam blobs (toon)
          float f = vnoise(p*0.32 + vec2(uTime*0.25, uTime*0.11)) * vnoise(p*0.07 - uTime*0.05);
          float foam = step(0.47, f + vH*0.35);
          col = mix(col, uFoam, foam*(0.85 - uNight*0.6));
          // foam lines like the white wave strokes of the poster
          float lines = step(0.965, sin(p.y*0.22 + vnoise(p*0.05)*7.0 + uTime*0.6)) * step(0.55, vnoise(p*0.03+3.1));
          col = mix(col, uFoam, lines*(0.8 - uNight*0.5));
          // sun glints (quantised)
          vec3 V = normalize(cameraPosition - vW);
          vec3 H = normalize(V + uSunDir);
          float g = pow(max(0.0, H.y), 220.0) * step(0.7, vnoise(p*1.7+uTime*0.6));
          col += step(0.25, g) * vec3(1.0, 0.97, 0.85) * (1.0 - uNight*0.5);
          // fresnel toward sky
          float fr = pow(1.0 - max(0.0, V.y), 4.0);
          col = mix(col, uSky, fr*0.45);
          float fog = smoothstep(uFogNear, uFogFar, vDepth);
          gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
  }

  setTheme(t: Theme, fog: THREE.Color) {
    const u = this.mat.uniforms;
    u.uShallow.value.setHex(t.waterShallow);
    u.uDeep.value.setHex(t.waterDeep);
    u.uFoam.value.setHex(t.foam);
    u.uSwell.value = t.swell;
    u.uFogColor.value.copy(fog);
    u.uFogNear.value = t.fogNear;
    u.uFogFar.value = t.fogFar;
    u.uSky.value.setHex(t.skyHorizon);
    u.uNight.value = t.night ? 1 : 0;
    const el = (t.sunElev * Math.PI) / 180;
    u.uSunDir.value.set(0.25, Math.sin(el), Math.cos(el)).normalize();
  }

  update(t: number, cam: THREE.Vector3) {
    this.mat.uniforms.uTime.value = t;
    this.mesh.position.set(Math.round(cam.x / 10) * 10, 0, Math.round(cam.z / 10) * 10);
  }
}

export class Sky {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.2, 1) },
        uDisc: { value: new THREE.Color() }, uDiscSize: { value: 0 }, uStars: { value: 0 }, uTime: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uDisc; uniform float uDiscSize; uniform float uStars; uniform float uTime;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          float y = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHor, uTop, pow(y, 0.55));
          // banded toon sky
          col = mix(col, col*1.04, step(0.5, fract(y*6.0)));
          float d = acos(clamp(dot(normalize(vDir), normalize(uSunDir)), -1.0, 1.0));
          float disc = 0.05 + 0.16*uDiscSize;
          col = mix(col, uDisc, step(d, disc));
          col = mix(col, mix(uDisc, uHor, 0.5), step(d, disc*1.35)*step(disc, d)*0.35);
          if (uStars > 0.5) {
            vec3 q = floor(vDir*180.0);
            float s = step(0.996, hash(q)) * step(0.05, vDir.y);
            col += s * (0.6 + 0.4*sin(uTime*3.0 + hash(q)*30.0));
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  setTheme(t: Theme) {
    const u = this.mat.uniforms;
    u.uTop.value.setHex(t.skyTop);
    u.uHor.value.setHex(t.skyHorizon);
    u.uDisc.value.setHex(t.sunDiscSize > 0 ? t.sunDisc : 0xfff6c8);
    u.uDiscSize.value = t.sunDiscSize;
    u.uStars.value = t.stars ? 1 : 0;
    const el = Math.max(2, t.sunElev) * Math.PI / 180;
    // the sun sits ahead of the racers (+Z) so the giant disc is visible on the horizon
    u.uSunDir.value.set(0.15, t.sunDiscSize > 0 ? Math.sin(el) * 0.6 : Math.sin(el), Math.cos(el)).normalize();
  }

  update(t: number, cam: THREE.Vector3) {
    this.mat.uniforms.uTime.value = t;
    this.mesh.position.copy(cam);
  }
}
