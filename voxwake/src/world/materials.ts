import * as THREE from 'three';

export const PAL = {
  greenDeep: 0x076b38, lagoon: 0x10ac63, mint: 0x1cd378, leaf: 0x219a59, ink: 0x0b3b2a,
  sun: 0xffe600, sunNeon: 0xffff35, magenta: 0xff0ccf, magentaDeep: 0xc4007f, terracotta: 0xe4673a,
  cream: 0xfffbe7, white: 0xffffff, wood: 0x9a6236, woodDark: 0x6e4224, laterite: 0xb9643c, thatch: 0xe6c27a,
  azure: 0x3aa7e8, teal: 0x12b5a6, stone: 0x9aa3a0, coconut: 0x7a4a22, trunk: 0xa77a4c, red: 0xe2382f, orange: 0xff7a1a,
};

let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export const sharedUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: number, opts: { emissive?: number; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opts.emissive ?? 0}|${opts.opacity ?? 1}|${opts.side ?? 0}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive: opts.emissive ?? 0,
      transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
    toonCache.set(key, m);
  }
  return m;
}

/** Vertex-coloured toon material with optional sway attribute (palms, bunting). */
let vcMat: THREE.MeshToonMaterial | null = null;
export function vertexToon(): THREE.MeshToonMaterial {
  if (vcMat) return vcMat;
  vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: THREE.DoubleSide });
  vcMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = sharedUniforms.uTime;
    sh.uniforms.uWind = sharedUniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = sway * uWind;
        transformed.x += sw * sin(uTime * 1.6 + position.z * 0.05 + position.x * 0.03) * 0.35;
        transformed.z += sw * cos(uTime * 1.3 + position.x * 0.05) * 0.25;
        transformed.y += sw * sin(uTime * 2.1 + position.x * 0.1) * 0.08;`);
  };
  return vcMat;
}

/** Inverted-hull ink outline (05 §6). Works on any geometry with normals. */
const outlineCache = new Map<string, THREE.ShaderMaterial>();
export function outlineMat(thickness = 0.06, color = PAL.ink, sway = false): THREE.ShaderMaterial {
  const key = `${thickness}|${color}|${sway}`;
  let m = outlineCache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uThick: { value: thickness }, uTime: sharedUniforms.uTime, uWind: sharedUniforms.uWind,
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
    vertexShader: `
      uniform float uThick; uniform float uTime; uniform float uWind;
      ${sway ? 'attribute float sway;' : ''}
      varying float vFogDepth;
      void main() {
        vec3 p = position;
        ${sway ? `float sw = sway * uWind;
        p.x += sw * sin(uTime * 1.6 + position.z * 0.05 + position.x * 0.03) * 0.35;
        p.z += sw * cos(uTime * 1.3 + position.x * 0.05) * 0.25;
        p.y += sw * sin(uTime * 2.1 + position.x * 0.1) * 0.08;` : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * uThick * (1.0 + d * 0.012);
        vFogDepth = d;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying float vFogDepth;
      void main() {
        float f = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(uColor, fogColor, f), 1.0);
      }`,
    side: THREE.BackSide,
    fog: false,
  });
  outlineCache.set(key, m);
  return m;
}

export function setOutlineFog(color: THREE.Color, near: number, far: number) {
  for (const m of outlineCache.values()) {
    m.uniforms.fogColor.value.copy(color);
    m.uniforms.fogNear.value = near;
    m.uniforms.fogFar.value = far;
  }
}

/** Adds an ink outline child to every mesh in the object. */
export function addOutlines(obj: THREE.Object3D, thickness = 0.06) {
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.noOutline) meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) {
    const ol = new THREE.Mesh(mesh.geometry, outlineMat(thickness));
    ol.userData.noOutline = true;
    ol.renderOrder = -1;
    mesh.add(ol);
  }
}
