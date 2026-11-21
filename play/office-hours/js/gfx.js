// Realistic rendering: post-processing, procedural PBR textures (with normal maps), and detailed human models.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- graphics quality ----------
// default: High on dedicated GPUs, Medium on integrated/mobile graphics (post-processing is too heavy there)
function detectQuality() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (/swiftshader|llvmpipe|software/i.test(name)) return 'low';
    if (/intel|uhd|iris|mali|adreno|powervr|apple m1/i.test(name)) return 'medium';
    return 'high';
  } catch (e) { return 'medium'; }
}
export const QUALITY = (() => { try { return localStorage.getItem('oh_gfx') || detectQuality(); } catch (e) { return 'medium'; } })();
export function setQuality(q) { try { localStorage.setItem('oh_gfx', q); } catch (e) { } location.reload(); }

let composer = null, gtao = null;
export function setupRenderer(renderer, scene, camera) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY === 'low' ? 1 : QUALITY === 'medium' ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  if (QUALITY !== 'low') { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  // image-based lighting: soft, realistic reflections on every surface
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  if (QUALITY === 'high') {
    const w = window.innerWidth, h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, w, h);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 8 });
    composer.addPass(gtao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.4, 0.97));
    composer.addPass(new OutputPass());
  }
}
export function resizeGfx(w, h) { if (composer) composer.setSize(w, h); }
export function renderFrame(renderer, scene, camera) { if (composer) composer.render(); else renderer.render(scene, camera); }
// how strongly surfaces pick up the room's ambient reflections (metals more, matte surfaces less)
export function tuneEnv(obj) {
  obj.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && 'envMapIntensity' in m && !m.userData.envTuned) { m.envMapIntensity = m.metalness > 0.5 ? 0.9 : 0.32; m.userData.envTuned = true; } });
}
// every mesh casts and receives soft shadows
export function shadowAll(obj, cast = true) {
  if (QUALITY === 'low') return;
  obj.traverse(o => { if (o.isMesh && !o.material.transparent && !(o.material.isMeshBasicMaterial)) { o.castShadow = cast; o.receiveShadow = true; } });
}

// ---------- procedural texture generation ----------
function hash(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 144665; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) { let t = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 17); f *= 2; a *= 0.5; } return t; }
// tileable version: blends noise across the edges
function tfbm(x, y, size, freq, s, oct) {
  const fx = x / size, fy = y / size;
  const n = (a, b) => fbm(a * freq, b * freq, s, oct);
  const a = n(fx, fy), b = n(fx - 1, fy), c = n(fx, fy - 1), d = n(fx - 1, fy - 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// builds color + normal (+ roughness) maps from a per-pixel function returning [r,g,b,height,rough]
function makeMaps(size, fn, repeat = [1, 1], normalStrength = 2) {
  const col = document.createElement('canvas'); col.width = col.height = size;
  const nor = document.createElement('canvas'); nor.width = nor.height = size;
  const rou = document.createElement('canvas'); rou.width = rou.height = size;
  const ci = col.getContext('2d').createImageData(size, size), ni = nor.getContext('2d').createImageData(size, size), ri = rou.getContext('2d').createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b, h, ro] = fn(x, y);
    const i = (y * size + x) * 4;
    ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
    const rv = Math.max(0, Math.min(255, (ro ?? 0.7) * 255)); ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rv; ri.data[i + 3] = 255;
    H[y * size + x] = h;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (a, b) => H[((b + size) % size) * size + ((a + size) % size)];
    const dx = (at(x + 1, y) - at(x - 1, y)) * normalStrength, dy = (at(x, y + 1) - at(x, y - 1)) * normalStrength;
    const len = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
    ni.data[i] = (-dx / len * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
  }
  col.getContext('2d').putImageData(ci, 0, 0); nor.getContext('2d').putImageData(ni, 0, 0); rou.getContext('2d').putImageData(ri, 0, 0);
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8; return t; };
  return { map: mk(col, true), normalMap: mk(nor, false), roughnessMap: mk(rou, false) };
}
const hex = c => { const v = new THREE.Color(c); return [v.r * 255, v.g * 255, v.b * 255]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const TEX = {};
const SZ = QUALITY === 'low' ? 256 : 512;
// oak plank floor
export function woodFloor() {
  if (TEX.floor) return TEX.floor;
  const size = QUALITY === 'low' ? 512 : 1024, planks = 12, light = hex('#9a6a3e'), dark = hex('#5a3a1e');
  TEX.floor = makeMaps(size, (x, y) => {
    const pw = size / planks, pi = Math.floor(x / pw), px = (x % pw) / pw;
    const off = hash(pi, 0, 3) * size, yy = (y + off) % size;
    const seam = Math.floor(yy / (size / 2)); const py = (yy % (size / 2)) / (size / 2);
    const tint = hash(pi, seam, 9) * 0.35;
    const grain = fbm(px * 3 + pi * 7, yy / size * 40 + seam * 3, 5, 4);
    const rings = 0.5 + 0.5 * Math.sin((px * 6 + grain * 4) * Math.PI * 2 + pi);
    let c = lerp3(light, dark, Math.min(1, tint + grain * 0.5 + rings * 0.18));
    let h = 0.5 + grain * 0.15;
    const edge = Math.min(px, 1 - px) * pw, edgeY = Math.min(py, 1 - py) * size / 2;
    if (edge < 1.5 || edgeY < 1.5) { c = lerp3(c, [25, 15, 8], 0.75); h = 0; }
    return [c[0], c[1], c[2], h, 0.45 + grain * 0.3];
  }, [3, 3], 3);
  return TEX.floor;
}
// dark walnut desktop
export function walnut() {
  if (TEX.walnut) return TEX.walnut;
  const a = hex('#6a4026'), b = hex('#2e1a0e');
  TEX.walnut = makeMaps(SZ, (x, y) => {
    const g = fbm(x / SZ * 4, y / SZ * 60, 21, 4); const r = 0.5 + 0.5 * Math.sin((x / SZ * 9 + g * 5) * Math.PI * 2);
    const c = lerp3(a, b, Math.min(1, g * 0.7 + r * 0.25));
    return [c[0], c[1], c[2], g * 0.6, 0.35];
  }, [1, 1], 1.5);
  return TEX.walnut;
}
// painted plaster
export function plaster(color) {
  const k = 'pl' + color; if (TEX[k]) return TEX[k];
  const base = hex(color);
  TEX[k] = makeMaps(SZ, (x, y) => {
    const n = tfbm(x, y, SZ, 16, 31, 5), f = hash(x, y, 7);
    const v = 0.94 + n * 0.08 + (f - 0.5) * 0.02;
    return [base[0] * v, base[1] * v, base[2] * v, n * 0.8 + f * 0.05, 0.85];
  }, [3, 2], 2.2);
  return TEX[k];
}
// acoustic ceiling tiles
export function ceilingTiles() {
  if (TEX.ceil) return TEX.ceil;
  const base = hex('#ecebe6');
  TEX.ceil = makeMaps(SZ, (x, y) => {
    const t = SZ / 2; const ex = Math.min(x % t, t - x % t), ey = Math.min(y % t, t - y % t);
    const seam = ex < 2 || ey < 2; const pore = hash(x, y, 77) > 0.985;
    const v = seam ? 0.75 : pore ? 0.82 : 0.97 + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.03;
    return [base[0] * v, base[1] * v, base[2] * v, seam ? 0 : pore ? 0.3 : 0.6, 0.95];
  }, [4, 4], 3);
  return TEX.ceil;
}
// speckled lab vinyl with tile seams
export function labVinyl() {
  if (TEX.vinyl) return TEX.vinyl;
  const base = hex('#c9cbc8');
  TEX.vinyl = makeMaps(SZ, (x, y) => {
    const t = SZ / 2; const ex = Math.min(x % t, t - x % t), ey = Math.min(y % t, t - y % t);
    const fleck = hash(x, y, 51); let c = base.slice();
    if (fleck > 0.97) c = hex('#6f7378'); else if (fleck > 0.94) c = hex('#e6e6e0'); else if (fleck < 0.02) c = hex('#8a8f7a');
    const n = tfbm(x, y, SZ, 6, 61, 3); c = c.map(v => v * (0.95 + n * 0.08));
    const seam = ex < 1.2 || ey < 1.2; if (seam) c = c.map(v => v * 0.8);
    return [c[0], c[1], c[2], seam ? 0 : 0.5, 0.35 + n * 0.2];
  }, [8, 6], 2);
  return TEX.vinyl;
}
// woven fabric (shirts, chairs) — tinted by material color
export function fabric() {
  if (TEX.fabric) return TEX.fabric;
  TEX.fabric = makeMaps(256, (x, y) => {
    const w = Math.sin(x * 0.9) * 0.5 + 0.5, v = Math.sin(y * 0.9) * 0.5 + 0.5; const over = ((x >> 2) + (y >> 2)) % 2;
    const h = over ? w : v; const n = hash(x, y, 4) * 0.15;
    const c = 225 + h * 30 - n * 40;
    return [c, c, c, h * 0.6 + n, 0.9];
  }, [6, 6], 1.2);
  return TEX.fabric;
}
// denim twill for trousers
export function twill() {
  if (TEX.twill) return TEX.twill;
  TEX.twill = makeMaps(256, (x, y) => {
    const d = Math.sin((x + y) * 0.8) * 0.5 + 0.5; const n = hash(x, y, 8);
    const c = 215 + d * 35 - n * 30;
    return [c, c, c, d * 0.7 + n * 0.1, 0.92];
  }, [5, 5], 1.4);
  return TEX.twill;
}
// skin: fine pores, a tiny bit of variation
export function skinMaps() {
  if (TEX.skin) return TEX.skin;
  TEX.skin = makeMaps(256, (x, y) => {
    const n = tfbm(x, y, 256, 24, 91, 3); const p = hash(x, y, 13) > 0.93 ? 0.35 : 0.6;
    const c = 238 + n * 17;
    return [c, c * 0.985, c * 0.975, p + n * 0.2, 0.5 + n * 0.15];
  }, [3, 3], 1.4);
  return TEX.skin;
}
// hair strands
export function hairMaps() {
  if (TEX.hair) return TEX.hair;
  TEX.hair = makeMaps(256, (x, y) => {
    const s = fbm(x * 0.9, y * 0.02, 41, 3); const c = 200 + s * 55;
    return [c, c, c, s, 0.45 + s * 0.2];
  }, [2, 2], 3);
  return TEX.hair;
}
// brushed metal
export function brushed() {
  if (TEX.brushed) return TEX.brushed;
  TEX.brushed = makeMaps(256, (x, y) => {
    const s = fbm(x * 0.03, y * 1.2, 71, 3); const c = 230 + s * 25;
    return [c, c, c, s * 0.5, 0.25 + s * 0.2];
  }, [2, 2], 1);
  return TEX.brushed;
}

// ---------- material library ----------
const MC = new Map();
const cached = (k, mk) => { if (!MC.has(k)) MC.set(k, mk()); return MC.get(k); };
export const mats = {
  floorWood: () => cached('fw', () => { const t = woodFloor(); return new THREE.MeshPhysicalMaterial({ ...t, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.25, normalScale: new THREE.Vector2(0.6, 0.6) }); }),
  wall: c => cached('w' + c, () => { const t = plaster(c); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.92 }); }),
  ceiling: () => cached('ce', () => { const t = ceilingTiles(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95 }); }),
  desk: () => cached('dk', () => { const t = walnut(); return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.18 }); }),
  vinyl: () => cached('vn', () => { const t = labVinyl(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1 }); }),
  fabric: c => cached('fa' + c, () => { const t = fabric(); return new THREE.MeshStandardMaterial({ color: c, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95 }); }),
  twill: c => cached('tw' + c, () => { const t = twill(); return new THREE.MeshStandardMaterial({ color: c, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 }); }),
  steel: () => cached('st', () => { const t = brushed(); return new THREE.MeshStandardMaterial({ color: '#d0d4da', metalness: 1, roughness: 0.3, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.15, 0.15) }); }),
  skin: c => cached('sk' + c, () => { const t = skinMaps(); return new THREE.MeshPhysicalMaterial({ color: c, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.12, 0.12), roughness: 0.52, sheen: 0.5, sheenColor: new THREE.Color('#ff8a70'), sheenRoughness: 0.7, clearcoat: 0.06, clearcoatRoughness: 0.5 }); }),
  skinV: () => cached('skv', () => { const t = skinMaps(); return new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.1, 0.1), roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#ff8a70'), sheenRoughness: 0.7, clearcoat: 0.06, clearcoatRoughness: 0.5 }); }),
  lips: c => cached('lp' + c, () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c).lerp(new THREE.Color('#a84a4a'), 0.35), roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.3 })),
  hair: c => cached('hr' + c, () => { const t = hairMaps(); const col = new THREE.Color(c); return new THREE.MeshPhysicalMaterial({ color: col, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.5, sheen: 1, sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.35), sheenRoughness: 0.35 }); }),
  sclera: () => cached('sc', () => new THREE.MeshPhysicalMaterial({ color: '#f4f1ec', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })),
  iris: c => cached('ir' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 })),
  pupil: () => cached('pu', () => new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.1, clearcoat: 1 })),
  leather: c => cached('le' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35 })),
  glass: () => cached('gl', () => new THREE.MeshPhysicalMaterial({ color: '#dff2ff', transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, clearcoat: 1, depthWrite: false })),
};

// ---------- detailed human ----------
const EYES = ['#5a3a1e', '#3a2412', '#6a8aa8', '#4a6a3a', '#8a6a3a', '#2a1a0e'];
const dbl = m => { m.side = THREE.DoubleSide; return m; };
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
// a tapered limb segment from y=0 down to y=-len
function limb(r1, r2, len, mat, parent, y = 0) { const m = mesh(new THREE.CylinderGeometry(r1, r2, len, 18, 1), mat, 0, y - len / 2, 0, parent); return m; }
function lathe(profile, mat, parent, phiStart = 0, phiLen = Math.PI * 2, segs = 32) {
  return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs, phiStart, phiLen), mat, 0, 0, 0, parent);
}

function curls(g, hm, r, amp, gap, thetaLen) {
  const geo = new THREE.SphereGeometry(r, 64, 40, Math.PI / 2 + gap * 0.35, Math.PI * 2 - gap * 0.7, 0, thetaLen);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const d = fbm(n.x * 9 + 3, n.y * 9 + n.z * 7, 99, 3); v.addScaledVector(n, (d - 0.5) * amp * 2.2 + amp * 0.4); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, hm); m.rotation.x = -0.32; g.add(m); return m;
}
function hairFor(look, hm) {
  const g = new THREE.Group();
  const shell = (r, thetaLen, gap = 0, thetaStart = 0) => mesh(new THREE.SphereGeometry(r, 32, 20, Math.PI / 2 + gap, Math.PI * 2 - gap * 2, thetaStart, thetaLen), hm, 0, 0, 0, g);
  const top = (r, th, tilt = -0.1) => { const m = mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, th), hm, 0, 0, 0, g); m.rotation.x = tilt; return m; };
  const R = 0.106;
  switch (look.style) {
    case 'bald': shell(R * 0.99, Math.PI * 0.16, 1.45, Math.PI * 0.42); break;
    case 'short': top(R, Math.PI * 0.4); shell(R * 0.995, Math.PI * 0.56, 1.3); break;
    case 'spiky': top(R * 1.02, Math.PI * 0.4); shell(R * 0.995, Math.PI * 0.52, 1.3); for (let i = 0; i < 26; i++) { const a = i * 2.39, rr = 0.07 * Math.sqrt((i + 1) / 26); const c = mesh(new THREE.ConeGeometry(0.012, 0.045, 6), hm, Math.cos(a) * rr, 0.095, Math.sin(a) * rr - 0.01, g); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } break;
    case 'long': top(R * 1.02, Math.PI * 0.44); shell(R * 1.02, Math.PI * 0.78, 1.05); { const l = lathe([[0.0, -0.26], [0.07, -0.25], [0.1, -0.15], [0.108, -0.02], [0.0, 0.02]], hm, g, Math.PI * 0.6, Math.PI * 0.8, 24); l.position.z = -0.012; } break;
    case 'bob': top(R * 1.04, Math.PI * 0.45); shell(R * 1.07, Math.PI * 0.68, 0.95); break;
    case 'bun': top(R, Math.PI * 0.43); shell(R * 0.998, Math.PI * 0.58, 1.2); mesh(new THREE.SphereGeometry(0.042, 20, 14), hm, 0, 0.08, -0.09, g); break;
    case 'ponytail': top(R, Math.PI * 0.43); shell(R * 0.998, Math.PI * 0.58, 1.2); { const t = mesh(new THREE.CylinderGeometry(0.022, 0.008, 0.2, 12), hm, 0, -0.04, -0.125, g); t.rotation.x = 0.35; } break;
    case 'curly': top(R * 1.005, Math.PI * 0.44); curls(g, hm, R * 1.07, 0.012, 1.15, Math.PI * 0.62); break;
    case 'afro': top(R * 1.005, Math.PI * 0.44); curls(g, hm, R * 1.38, 0.016, 0.95, Math.PI * 0.66).position.set(0, 0.02, -0.015); break;
  }
  return g;
}

// Sculpts a face out of a dense sphere by pushing vertices around, then paints lips and cheeks with vertex colors.
const gauss = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HEAD_CACHE = new Map();
function sculptHead(look) {
  const wide = look.beard ? 1.03 : 1; // a touch broader jaw for bearded looks; otherwise varied by height
  const key = look.skin + '|' + wide + '|' + Math.round((look.height || 1) * 20);
  if (HEAD_CACHE.has(key)) return HEAD_CACHE.get(key);
  const geo = new THREE.SphereGeometry(1, 72, 56);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
  const base = new THREE.Color(look.skin), lip = base.clone().lerp(new THREE.Color('#b04a4a'), 0.42).multiplyScalar(0.92), blush = base.clone().lerp(new THREE.Color('#e07a6a'), 0.16);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    const front = smooth(0.2, 0.75, z);
    // jaw narrows toward the chin; back of the skull stays round
    const jaw = smooth(0.05, -0.85, y);
    x *= 1 - 0.3 * jaw * wide ** -1; z *= 1 - 0.08 * jaw * (1 - front);
    // flatter face, rounder skull
    z = z > 0 ? z * (0.9 + 0.06 * smooth(0.4, 1, y)) : z * 1.02;
    // brow ridge and forehead
    z += 0.035 * front * gauss(x, y - 0.28, 0.55, 0.09);
    // eye sockets
    for (const sx of [-1, 1]) z -= 0.075 * front * gauss(x - sx * 0.37, y - 0.12, 0.17, 0.12);
    // cheekbones
    for (const sx of [-1, 1]) { const g = gauss(x - sx * 0.5, y + 0.06, 0.2, 0.14) * front; z += 0.03 * g; x += sx * 0.03 * g; }
    // nose: ridge growing toward the tip, then nostrils
    const ridge = gauss(x, 0, 0.075, 1) * smooth(0.22, -0.12, y) * smooth(-0.32, -0.12, y);
    z += 0.2 * ridge * front;
    z += 0.08 * gauss(x, y + 0.17, 0.12, 0.06) * front;
    for (const sx of [-1, 1]) z += 0.045 * gauss(x - sx * 0.1, y + 0.2, 0.06, 0.05) * front;
    // philtrum, lips and the line between them
    z += 0.04 * gauss(x, y + 0.36, 0.22, 0.05) * front;
    z -= 0.02 * gauss(x, y + 0.42, 0.24, 0.012) * front;
    z += 0.03 * gauss(x, y + 0.47, 0.19, 0.04) * front;
    // chin
    z += 0.07 * gauss(x, y + 0.74, 0.22, 0.12) * front;
    // temples
    for (const sx of [-1, 1]) x -= sx * 0.03 * gauss(x - sx * 0.85, y - 0.25, 0.2, 0.2);
    pos.setXYZ(i, x * 0.079, y * 0.11 + 0.008, z * 0.1 - 0.006);
    // paint lips and a little warmth on the cheeks and nose
    const lipW = front * (gauss(x, y + 0.36, 0.19, 0.035) + gauss(x, y + 0.47, 0.17, 0.035));
    const bl = front * (gauss(Math.abs(x) - 0.45, y + 0.12, 0.13, 0.1) * 0.8 + gauss(x, y + 0.15, 0.08, 0.08) * 0.4);
    const c = base.clone().lerp(blush, Math.min(1, bl)).lerp(lip, Math.min(1, lipW * 1.4));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  HEAD_CACHE.set(key, geo);
  return geo;
}

// builds the body into Char-compatible parts: {legs, arms, head, lids, brows, mouth, eyesG}
export function buildHuman(look, b) {
  const skin = mats.skin(look.skin);
  const shirt = look.glow ? new THREE.MeshStandardMaterial({ color: '#d8e0f0', emissive: '#8090ff', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 }) : look.hivis ? mats.fabric('#d8e020') : mats.fabric(look.shirt);
  const pants = look.glow ? shirt : mats.twill(look.pants);
  const coat = look.coat && !look.glow ? dbl(mats.fabric('#f6f7f8').clone()) : null;
  const shoeM = mats.leather(look.glow ? '#c0c8d8' : '#2a2018');
  const sleeveLong = look.coat || look.suit || look.turtleneck || look.vest || hash(look.shirt.length, look.skin.length, 3) > 0.5;
  const out = { legs: [], arms: [] };

  // legs
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.088, 0.92, 0); b.add(hip);
    limb(0.078, 0.056, 0.45, pants, hip);
    mesh(new THREE.SphereGeometry(0.056, 16, 12), pants, 0, -0.45, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    limb(0.055, 0.042, 0.42, pants, knee);
    const shoe = mesh(new RoundedBoxGeometry(0.095, 0.075, 0.265, 4, 0.03), shoeM, 0, -0.43, 0.045, knee);
    mesh(new RoundedBoxGeometry(0.1, 0.02, 0.27, 2, 0.008), mats.leather('#3a3a38'), 0, -0.465, 0.045, knee);
    out.legs.push({ hip, knee });
  }
  // torso: hips (trousers), waist, chest, shoulders — elliptical cross-section
  const torso = new THREE.Group(); torso.scale.z = 0.62; b.add(torso);
  lathe([[0, 0.8], [0.15, 0.82], [0.172, 0.9], [0.168, 0.98], [0.15, 1.04], [0, 1.04]], pants, torso);
  lathe([[0.149, 1.0], [0.146, 1.08], [0.155, 1.16], [0.172, 1.26], [0.178, 1.34], [0.17, 1.41], [0.135, 1.47], [0.08, 1.51], [0.066, 1.525], [0, 1.53]], shirt, torso);
  mesh(new THREE.TorusGeometry(0.152, 0.012, 8, 32), mats.leather('#1a1410'), 0, 1.02, 0, torso).rotation.x = Math.PI / 2; // belt
  if (coat) {
    lathe([[0.2, 0.62], [0.188, 0.8], [0.182, 0.95], [0.165, 1.06], [0.172, 1.16], [0.19, 1.26], [0.197, 1.34], [0.186, 1.41], [0.14, 1.475], [0.085, 1.51]], coat, torso, 0.32, Math.PI * 2 - 0.64);
    for (const sx of [-1, 1]) { const lap = mesh(new THREE.BoxGeometry(0.06, 0.3, 0.008), coat, sx * 0.055, 1.33, 0.165, torso); lap.rotation.z = sx * 0.35; }
  }
  if (look.suit) { const jk = dbl(mats.fabric(new THREE.Color(look.shirt).multiplyScalar(0.7).getStyle()).clone()); lathe([[0.17, 0.96], [0.158, 1.06], [0.168, 1.16], [0.188, 1.26], [0.196, 1.34], [0.186, 1.41], [0.14, 1.475], [0.08, 1.51]], jk, torso, 0.42, Math.PI * 2 - 0.84); mesh(new THREE.BoxGeometry(0.06, 0.3, 0.012), mats.fabric('#f2f2f0'), 0, 1.31, 0.18, torso); mesh(new THREE.BoxGeometry(0.03, 0.26, 0.016), mats.fabric('#8a2020'), 0, 1.29, 0.188, torso); }
  if (look.vest) lathe([[0.168, 0.98], [0.16, 1.08], [0.17, 1.16], [0.19, 1.26], [0.195, 1.34], [0.18, 1.41], [0.14, 1.46]], dbl(mats.fabric('#2a3a4a').clone()), torso, 0.3, Math.PI * 2 - 0.6);
  if (look.hivis) for (const y of [1.12, 1.28]) mesh(new THREE.TorusGeometry(0.175, 0.012, 6, 32), new THREE.MeshStandardMaterial({ color: '#e0e0e0', metalness: 0.6, roughness: 0.2, emissive: '#505050' }), 0, y, 0, torso).rotation.x = Math.PI / 2;
  // collar
  mesh(new THREE.TorusGeometry(0.066, 0.014, 8, 24), look.turtleneck ? shirt : coat || shirt, 0, 1.522, -0.008, b).rotation.x = Math.PI / 2;
  // neck
  mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.1, 24), look.turtleneck ? shirt : skin, 0, 1.55, -0.016, b);
  // shoulders
  for (const sx of [-1, 1]) { const s = mesh(new THREE.SphereGeometry(0.06, 20, 14), coat || shirt, sx * 0.168, 1.43, 0, b); s.scale.set(1, 0.85, 0.9); }

  // arms
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.182, 1.425, 0); b.add(sh);
    limb(0.052, 0.043, 0.29, coat || shirt, sh);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    mesh(new THREE.SphereGeometry(0.043, 14, 10), coat || (sleeveLong ? shirt : skin), 0, 0, 0, el);
    limb(0.041, 0.031, 0.25, coat || (sleeveLong ? shirt : skin), el);
    if (sleeveLong) mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.02, 14), coat || shirt, 0, -0.245, 0, el);
    // hand: palm, fingers, thumb
    const hand = new THREE.Group(); hand.position.y = -0.255; el.add(hand);
    mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 14), skin, 0, -0.005, 0, hand);
    const palm = mesh(new RoundedBoxGeometry(0.062, 0.075, 0.026, 3, 0.011), skin, 0, -0.05, 0.004, hand);
    const fing = mesh(new RoundedBoxGeometry(0.058, 0.06, 0.02, 3, 0.009), skin, 0, -0.112, 0.01, hand); fing.rotation.x = 0.25;
    const th = mesh(new THREE.CapsuleGeometry(0.009, 0.035, 4, 8), skin, sx * -0.03, -0.045, 0.02, hand); th.rotation.z = sx * 0.6; th.rotation.x = 0.3;
    out.arms.push({ sh, el, sx });
  }

  // head: one sculpted mesh (skull, brow, sockets, cheekbones, nose, lips, jaw, chin)
  const head = out.head = new THREE.Group(); head.position.y = 1.628; b.add(head);
  mesh(sculptHead(look), mats.skinV(), 0, 0, 0, head);
  // ears
  for (const sx of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.021, 18, 14), skin, sx * 0.077, 0.0, -0.01, head); e.scale.set(0.36, 1.05, 0.7); e.rotation.y = sx * 0.35; }
  // eyes with sclera, iris, pupil, and eyelids
  const eyeCol = look.eyes || (look.eyes = EYES[Math.floor(hash(look.skin.length * 7, look.hair.length * 3, look.shirt.charCodeAt(2)) * EYES.length)]);
  out.lids = []; out.eyesG = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 0.0295, 0.02, 0.062); head.add(eg); out.eyesG.push(eg);
    mesh(new THREE.SphereGeometry(0.0125, 24, 18), mats.sclera(), 0, 0, 0, eg);
    const ir = mesh(new THREE.CircleGeometry(0.0062, 24), mats.iris(eyeCol), 0, 0, 0.0124, eg);
    mesh(new THREE.CircleGeometry(0.0028, 16), mats.pupil(), 0, 0, 0.0127, eg);
    const lidG = new THREE.Group(); lidG.position.copy(eg.position); head.add(lidG);
    const lid = mesh(new THREE.SphereGeometry(0.0138, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0, 0, lidG);
    const low = mesh(new THREE.SphereGeometry(0.0134, 20, 8, 0, Math.PI * 2, Math.PI * 0.8, Math.PI * 0.2), skin, 0, 0, 0, lidG); low.rotation.x = -0.15;
    lid.rotation.x = 0; lidG.rotation.x = -0.6; out.lids.push(lidG);
  }
  // brows
  const browC = look.hair === '#e8e0d0' ? '#9a9590' : look.hair;
  out.brows = [];
  for (const sx of [-1, 1]) { const br = mesh(new THREE.CapsuleGeometry(0.0042, 0.024, 4, 8), mats.hair(browC), sx * 0.03, 0.041, 0.077, head); br.scale.set(0.8, 1, 0.8); br.rotation.z = Math.PI / 2 + sx * 0.12; out.brows.push(br); }
  // mouth: upper lip, lower lip (moves when talking), dark interior
  out.mouthIn = mesh(new THREE.SphereGeometry(0.014, 16, 8), new THREE.MeshBasicMaterial({ color: '#2a0c0c' }), 0, -0.04, 0.073, head); out.mouthIn.scale.set(1.1, 0.05, 0.4);
    const ll = mesh(new THREE.CapsuleGeometry(0.0046, 0.018, 4, 12), mats.lips(look.skin), 0, -0.0442, 0.0788, head); ll.rotation.z = Math.PI / 2;
  out.mouth = ll; ll.userData.y0 = ll.position.y;
  // hair
  const hm = mats.hair(look.hair);
  const hair = hairFor(look, hm); hair.position.set(0, 0.016, -0.01); hair.scale.set(0.79, 1.06, 0.99); head.add(hair);
  if (look.beard) { const bd = mesh(new THREE.SphereGeometry(0.1, 32, 18, Math.PI / 2 - 1.3, 2.6, Math.PI * 0.6, Math.PI * 0.38), hm, 0, 0.008, -0.004, head); bd.scale.set(0.81, 1.12, 1.03); }
  if (look.glasses) {
    const gm = new THREE.MeshPhysicalMaterial({ color: '#151515', roughness: 0.25, clearcoat: 1 });
    const lens = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0, clearcoat: 1, depthWrite: false });
    for (const sx of [-1, 1]) { mesh(new THREE.TorusGeometry(0.0175, 0.0021, 8, 28), gm, sx * 0.0295, 0.02, 0.083, head); mesh(new THREE.CircleGeometry(0.0168, 24), lens, sx * 0.0295, 0.02, 0.0832, head); const tmp = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.085, 6), gm, sx * 0.075, 0.022, 0.04, head); tmp.rotation.x = Math.PI / 2; }
    mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.025, 6), gm, 0, 0.024, 0.086, head).rotation.z = Math.PI / 2;
  }
  if (look.cap) { const cm = mats.fabric('#b02828'); mesh(new THREE.SphereGeometry(0.108, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), cm, 0, 0.025, -0.005, head).scale.set(0.92, 1, 1.02); const v = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.006, 24, 1, false, -Math.PI / 2, Math.PI), cm, 0, 0.045, 0.06, head); v.rotation.x = -0.15; }
  return out;
}
