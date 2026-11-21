import * as THREE from 'three';
import { makeNoise, mulberry32 } from './noise.js';
import { buildRuins } from './castle.js';
import { notePlaces } from './lore.js';

export const W = 768, D = 256, H = 80, CS = 16, NCX = W / CS, NCZ = D / CS;
// the old lands end at the Cinder Wall (x 448): everything west of it generates exactly as it always has, so saves keep their world
const OLDW = 448;
// the lands: the colony vale and Vharrow's ruins in the west, the Fungal Mire, the Ashen Barrens; past the Cinder Wall, the far lands
export const REGIONS = [
  { id: 'moor', name: 'The Western Moors', x0: 0, x1: 64 },
  { id: 'vale', name: 'Vharrow & the Ember Vale', x0: 64, x1: 236 },
  { id: 'mire', name: 'The Fungal Mire', x0: 236, x1: 342 },
  { id: 'barrens', name: 'The Ashen Barrens', x0: 342, x1: 452 },
  { id: 'wood', name: 'The Weeping Wood', x0: 452, x1: 557 },
  { id: 'salt', name: 'The Saltgrave', x0: 557, x1: 663 },
  { id: 'frost', name: 'The Rimewatch', x0: 663, x1: 768 },
];
export const regionAt = x => REGIONS.find(r => x >= r.x0 && x < r.x1) || REGIONS[1];
export const GROUND = 36; // castle plateau surface
const WD = W * D, N = W * D * H;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, ASH: 4, LOG: 5, LEAVES: 6, PLANKS: 7, COAL: 8, IRON: 9, COBBLE: 10, BRICK: 11,
  TORCH: 12, GLOWCAP: 13, BEDROCK: 14, CHEST: 15, MOSSY: 16, TALLGRASS: 17, CAMPFIRE: 18, CRACKED: 19, GRAVEL: 20,
  MUD: 21, DEADWOOD: 22, BONES: 23, COBWEB: 24, BARS: 25, CANDLES: 26, BANNER: 27, SLATE: 28, TOMBSTONE: 29,
  MIRECAP: 30, BASALT: 31, EMBERVENT: 32, NOTE: 33, STALK: 34, WARDROBE: 35, THICKET: 36, SAND: 37, SALT: 38, SNOW: 39, ICE: 40, BLACKBARK: 41, MOSS: 42, GLOOMLEAF: 43, HOLLOWLOG: 44,
};

export const BLOCKS = [];
function def(id, o) { BLOCKS[id] = Object.assign({ solid: true, opaque: true, light: 0, render: 'cube', hard: 1, drop: 'b' + id, name: '' }, o); }
def(0, { name: 'Air', solid: false, opaque: false, hard: 0, drop: null, tex: ['dirt', 'dirt', 'dirt'] });
def(1, { name: 'Moor Grass', tex: ['grass_top', 'grass_side', 'dirt'], hard: 0.6, drop: 'b2' });
def(2, { name: 'Dirt', tex: ['dirt', 'dirt', 'dirt'], hard: 0.5 });
def(3, { name: 'Stone', tex: ['stone', 'stone', 'stone'], hard: 1.5, drop: 'b10' });
def(4, { name: 'Ashen Earth', tex: ['ash', 'ash', 'ash'], hard: 0.5 });
def(5, { name: 'Pine Log', tex: ['log_top', 'log_side', 'log_top'], hard: 1.2 });
def(6, { name: 'Pine Needles', tex: ['leaves', 'leaves', 'leaves'], hard: 0.2, opaque: false, render: 'cutout', drop: null });
def(7, { name: 'Old Planks', tex: ['planks', 'planks', 'planks'], hard: 1.0 });
def(8, { name: 'Coal Seam', tex: ['coal', 'coal', 'coal'], hard: 1.9, drop: 'coal' });
def(9, { name: 'Iron Vein', tex: ['iron', 'iron', 'iron'], hard: 2.4, drop: 'iron' });
def(10, { name: 'Rubblestone', tex: ['cobble', 'cobble', 'cobble'], hard: 1.7 });
def(11, { name: 'Weathered Ashlar', tex: ['ashlar', 'ashlar', 'ashlar'], hard: 2.8 });
def(12, { name: 'Torch', tex: ['torch', 'torch', 'torch'], solid: false, opaque: false, light: 14, render: 'cross', hard: 0.05 });
def(13, { name: 'Glowcap', tex: ['glowcap', 'glowcap', 'glowcap'], solid: false, opaque: false, light: 7, render: 'cross', hard: 0.05 });
def(14, { name: 'Bedrock', tex: ['bedrock', 'bedrock', 'bedrock'], hard: Infinity, drop: null });
def(15, { name: 'Old Chest', tex: ['chest_top', 'chest_side', 'chest_top'], hard: 2.5, drop: 'b7' });
def(16, { name: 'Mossy Ashlar', tex: ['mossy', 'mossy', 'mossy'], hard: 2.8, drop: 'b11' });
def(17, { name: 'Dry Grass', tex: ['tallgrass', 'tallgrass', 'tallgrass'], solid: false, opaque: false, render: 'cross', hard: 0, drop: null });
def(18, { name: 'Campfire', tex: ['campfire', 'campfire', 'campfire'], solid: false, opaque: false, light: 15, render: 'cross', hard: 0.4 });
def(19, { name: 'Cracked Ashlar', tex: ['cracked', 'cracked', 'cracked'], hard: 2.2, drop: 'b10' });
def(20, { name: 'Gravel', tex: ['gravel', 'gravel', 'gravel'], hard: 0.6 });
def(21, { name: 'Mud', tex: ['mud', 'mud', 'mud'], hard: 0.5 });
def(22, { name: 'Dead Wood', tex: ['deadwood_top', 'deadwood_side', 'deadwood_top'], hard: 1.1 });
def(23, { name: 'Bones', tex: ['bones', 'bones', 'bones'], solid: false, opaque: false, render: 'cross', hard: 0.1, drop: null });
def(24, { name: 'Cobweb', tex: ['cobweb', 'cobweb', 'cobweb'], solid: false, opaque: false, render: 'cross', hard: 0.3, drop: null });
def(25, { name: 'Iron Bars', tex: ['bars', 'bars', 'bars'], opaque: false, render: 'cutout', hard: 3, drop: 'iron' });
def(26, { name: 'Candles', tex: ['candles', 'candles', 'candles'], solid: false, opaque: false, light: 10, render: 'cross', hard: 0.1 });
def(27, { name: 'Tattered Banner', tex: ['banner', 'banner', 'banner'], solid: false, opaque: false, render: 'plane', hard: 0.2, drop: null });
def(28, { name: 'Slate', tex: ['slate', 'slate', 'slate'], hard: 1.6 });
def(29, { name: 'Gravestone', tex: ['tombstone', 'tombstone', 'tombstone'], solid: false, opaque: false, render: 'plane', hard: 2, drop: 'b10' });
def(30, { name: 'Mirecap Flesh', tex: ['mirecap', 'mirecap', 'mirecap'], light: 6, hard: 0.6 });
def(31, { name: 'Basalt', tex: ['basalt', 'basalt', 'basalt'], hard: 2.0, drop: 'b10' });
def(32, { name: 'Ember Vent', tex: ['embervent', 'embervent', 'embervent'], light: 11, hard: 2.2, drop: 'emberresin' });
def(33, { name: 'Weathered Note', tex: ['note', 'note', 'note'], solid: false, opaque: false, render: 'plane', hard: Infinity, drop: null });
def(34, { name: 'Fungal Stalk', tex: ['stalk', 'stalk', 'stalk'], hard: 0.9, drop: 'b7' });
// places to hide: step into a wardrobe [right mouse], or crouch [Ctrl] in a thicket and keep still
def(35, { name: 'Old Wardrobe', tex: ['planks', 'wardrobe', 'planks'], hard: 1.2 });
def(36, { name: 'Bramble Thicket', tex: ['thicket', 'thicket', 'thicket'], solid: false, opaque: false, render: 'cutout', hard: 0.3, drop: null });
// the far lands
def(37, { name: 'Grey Sand', tex: ['sand', 'sand', 'sand'], hard: 0.5 });
def(38, { name: 'Salt Crust', tex: ['salt', 'salt', 'salt'], hard: 0.7 });
def(39, { name: 'Snow', tex: ['snow', 'snow', 'snow'], hard: 0.4, drop: null });
def(40, { name: 'Black Ice', tex: ['ice', 'ice', 'ice'], hard: 1.0, drop: null });
def(41, { name: 'Blackbark', tex: ['blackbark_top', 'blackbark_side', 'blackbark_top'], hard: 1.6, drop: 'b7' });
def(42, { name: 'Weeping Moss', tex: ['moss', 'moss', 'moss'], solid: false, opaque: false, render: 'cross', hard: 0.05, drop: null });
def(44, { name: 'Hollow Log', tex: ['hollowlog_top', 'hollowlog_side', 'hollowlog_top'], hard: 1.3, drop: 'b44' });
def(43, { name: 'Gloomleaf', tex: ['gloomleaf', 'gloomleaf', 'gloomleaf'], hard: 0.2, opaque: false, render: 'cutout', drop: null });

export const OPAQUE = new Uint8Array(64), SOLID = new Uint8Array(64), LIGHT = new Uint8Array(64), TL = [];
BLOCKS.forEach((b, i) => { OPAQUE[i] = b.opaque ? 1 : 0; SOLID[i] = b.solid ? 1 : 0; LIGHT[i] = b.light; });
// Natural matter is drawn as rounded, flowing ground instead of cubes. 1 = rounded + world-projected texture, 2 = rounded only
const NAT = new Uint8Array(64);
for (const b of [B.GRASS, B.DIRT, B.STONE, B.ASH, B.COAL, B.IRON, B.GRAVEL, B.MUD, B.BASALT, B.SAND, B.SALT, B.SNOW, B.ICE]) NAT[b] = 1;
for (const b of [B.LEAVES, B.LOG, B.DEADWOOD, B.MIRECAP, B.STALK, B.BLACKBARK, B.GLOOMLEAF, B.HOLLOWLOG]) NAT[b] = 2;
export function resolveTextures(index) {
  BLOCKS.forEach((b, i) => { TL[i] = b.tex.map(n => index[n] ?? 0); });
  U.uGrassL.value = index.grass_top ?? 0; U.uDirtL.value = index.dirt ?? 0;
}

// ---------------------------------------------------------------- shared shader uniforms
export const U = {
  uAlb: { value: null }, uNrm: { value: null },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunCol: { value: new THREE.Vector3(1, 1, 1) },
  uSkyCol: { value: new THREE.Vector3(0.4, 0.45, 0.5) },
  uGroundCol: { value: new THREE.Vector3(0.1, 0.09, 0.08) },
  uCam: { value: new THREE.Vector3() },
  uLampPos: { value: new THREE.Vector3() },
  uLantern: { value: 0 }, uLanternR: { value: 10 }, uFlicker: { value: 1 },
  uNV: { value: 0 }, uDV: { value: 0 }, uDVR: { value: 10 },
  uFog: { value: new THREE.Vector3(0.3, 0.32, 0.35) }, uFogD: { value: 0.012 }, uMist: { value: 0.5 },
  uShadow: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 },
  uGrassL: { value: 0 }, uDirtL: { value: 0 }, uCheap: { value: 0 },
};

const LIGHT_GLSL = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGroundCol;
uniform vec3 uCam; uniform vec3 uLampPos; uniform float uLantern; uniform float uLanternR; uniform float uFlicker;
uniform float uNV; uniform float uDV; uniform float uDVR; uniform vec3 uFog; uniform float uFogD; uniform float uMist;
uniform sampler2D uShadow; uniform mat4 uShadowMat; uniform float uShadowOn; uniform float uShadowTexel;

float shadowAt(vec3 wp, vec3 Ng) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMat * vec4(wp + Ng * 0.07, 1.0);
  vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float z = p.z - 0.0006, o = uShadowTexel * 0.75;
  float s = (z > texture2D(uShadow, p.xy + vec2(-o, -o)).r ? 0.0 : 1.0) + (z > texture2D(uShadow, p.xy + vec2(o, -o)).r ? 0.0 : 1.0)
          + (z > texture2D(uShadow, p.xy + vec2(-o, o)).r ? 0.0 : 1.0) + (z > texture2D(uShadow, p.xy + vec2(o, o)).r ? 0.0 : 1.0);
  s *= 0.25;
  vec2 e = smoothstep(0.0, 0.1, p.xy) * smoothstep(1.0, 0.9, p.xy);
  return mix(1.0, s, e.x * e.y);
}

vec3 lightIt(vec3 alb, vec3 n, vec3 Ng, vec3 wp, vec2 lt, float ao, float gloss) {
  float dc = distance(wp, uCam);
  vec3 V = (uCam - wp) / max(dc, 1e-3);
  float skyV = lt.x * lt.x;
  vec3 amb = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5) * skyV * ao;
  float direct = max(dot(n, uSunDir), 0.0) * step(0.0, dot(Ng, uSunDir) + 0.05) * smoothstep(0.6, 1.0, lt.x);
  vec3 sun = vec3(0.0);
  if (direct > 0.0) sun = uSunCol * direct * shadowAt(wp, Ng);
  vec3 Hs = normalize(uSunDir + V);
  vec3 sunSpec = sun * pow(max(dot(n, Hs), 0.0), 8.0 + gloss * 56.0) * gloss * 0.6;
  vec3 blk = vec3(1.0, 0.48, 0.2) * pow(lt.y, 2.2) * 2.6 * uFlicker * (0.55 + 0.45 * ao);
  vec3 Lv = uLampPos - wp; float dl = length(Lv); vec3 Ld = Lv / max(dl, 1e-3);
  float att = uLantern * pow(clamp(1.0 - dl / uLanternR, 0.0, 1.0), 2.0) * 3.2 / (1.0 + 0.05 * dl * dl);
  float nl = max(dot(n, Ld), 0.0) * 0.85 + 0.15;
  vec3 Hl = normalize(Ld + V);
  float lsp = pow(max(dot(n, Hl), 0.0), 8.0 + gloss * 56.0) * gloss * 1.4;
  vec3 lampC = vec3(1.0, 0.6, 0.28);
  vec3 col = alb * (amb + sun + blk + lampC * att * nl) + lampC * att * lsp + sunSpec;
  if (uNV > 0.0) {
    float nvA = 0.12 + 0.55 * clamp(1.0 - dc / 48.0, 0.0, 1.0);
    col += alb * nvA * uNV * (0.55 + 0.45 * max(dot(n, V), 0.0));
  }
  if (uDV > 0.5 && uNV < 0.5) {
    float k = clamp(1.0 - dc / uDVR, 0.0, 1.0);
    float g = dot(alb, vec3(0.3, 0.59, 0.11)) * 0.32 * k * (0.5 + 0.5 * max(dot(n, V), 0.0));
    col = max(col, vec3(g * 0.92, g * 0.95, g));
  }
  float f = 1.0 - exp(-pow(dc * uFogD, 1.5));
  float mist = (1.0 - exp(-dc * 0.03)) * clamp((31.0 - wp.y) / 10.0, 0.0, 1.0) * uMist;
  return mix(col, uFog, clamp(max(f, mist), 0.0, 1.0));
}`;

export function makeTerrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      attribute float layer; attribute vec2 light; attribute float ao; attribute float face; attribute vec3 snrm; attribute float gw;
      varying vec2 vUv; varying float vLayer; varying vec2 vL; varying float vAo; varying float vFace; varying vec3 vW; varying vec3 vN; varying float vG;
      void main() {
        vUv = uv; vLayer = layer; vL = light; vAo = ao; vFace = face; vN = snrm; vG = gw;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision highp sampler2DArray;
      uniform sampler2DArray uAlb; uniform sampler2DArray uNrm;
      ${LIGHT_GLSL}
      uniform float uGrassL; uniform float uDirtL; uniform float uCheap;
      varying vec2 vUv; varying float vLayer; varying vec2 vL; varying float vAo; varying float vFace; varying vec3 vW; varying vec3 vN; varying float vG;
      void main() {
        int fi = int(vFace + 0.5);
        int mode = fi / 10, f = fi - mode * 10;
        vec3 Ns = dot(vN, vN) > 0.25 ? normalize(vN) : vec3(0.0);
        if (mode == 1) {
          // natural ground: textures projected from the world (no per-block grid), grass on the level, earth on the steeps
          if (dot(Ns, Ns) < 0.5) Ns = f == 0 ? vec3(1, 0, 0) : f == 1 ? vec3(-1, 0, 0) : f == 2 ? vec3(0, 1, 0) : f == 3 ? vec3(0, -1, 0) : f == 4 ? vec3(0, 0, 1) : vec3(0, 0, -1);
          vec3 w3 = pow(abs(Ns), vec3(4.0)); w3 /= max(w3.x + w3.y + w3.z, 1e-4);
          if (uCheap > 0.5) w3 = w3.y >= max(w3.x, w3.z) ? vec3(0, 1, 0) : w3.x >= w3.z ? vec3(1, 0, 0) : vec3(0, 0, 1); // one projection: cheaper GPUs
          bool grass = abs(vLayer - uGrassL) < 0.5 || abs(vLayer - (uGrassL + 1.0)) < 0.5;
          float side = grass ? uDirtL : vLayer, top = side;
          vec3 p = vW * 0.6;
          vec4 a = vec4(0.0), nm = vec4(0.0); vec3 off = vec3(0.0);
          if (w3.x > 0.02) { vec4 t = texture(uAlb, vec3(p.zy, side)); vec4 q = texture(uNrm, vec3(p.zy, side)); a += t * w3.x; nm += q * w3.x; vec2 d = q.xy * 2.0 - 1.0; off += vec3(0.0, d.y, d.x) * w3.x; }
          if (w3.y > 0.02) {
            vec4 t = texture(uAlb, vec3(p.xz, top)); vec4 q = texture(uNrm, vec3(p.xz, top));
            // grass creeps across whatever lies beneath it, fading out by the corner instead of the block
            float gk = Ns.y > 0.0 ? smoothstep(0.15, 0.85, vG + (t.r - 0.35) * 0.6) : 0.0;
            if (gk > 0.01) { t = mix(t, texture(uAlb, vec3(p.xz, uGrassL)), gk); q = mix(q, texture(uNrm, vec3(p.xz, uGrassL)), gk); }
            a += t * w3.y; nm += q * w3.y; vec2 d = q.xy * 2.0 - 1.0; off += vec3(d.x, 0.0, -d.y) * w3.y;
          }
          if (w3.z > 0.02) { vec4 t = texture(uAlb, vec3(p.xy, side)); vec4 q = texture(uNrm, vec3(p.xy, side)); a += t * w3.z; nm += q * w3.z; vec2 d = q.xy * 2.0 - 1.0; off += vec3(d.x, d.y, 0.0) * w3.z; }
          vec3 nn = Ns + off * 0.8;
          vec3 n = dot(nn, nn) > 1e-4 ? normalize(nn) : Ns;
          vec3 alb = pow(max(a.rgb, vec3(0.0)), vec3(2.2));
          vec3 cg = lightIt(alb, n, Ns, vW, vL, vAo, min(nm.a, 0.49) * 2.0);
          gl_FragColor = vec4(all(equal(cg, cg)) ? max(cg, vec3(0.0)) : vec3(0.0), 1.0);
          return;
        }
        vec4 a = texture(uAlb, vec3(vUv, vLayer));
        if (a.a < 0.5) discard;
        vec4 nm = texture(uNrm, vec3(vUv, vLayer));
        vec3 N, T, Bt;
        if (f == 0) { N = vec3(1,0,0); T = vec3(0,0,-1); Bt = vec3(0,1,0); }
        else if (f == 1) { N = vec3(-1,0,0); T = vec3(0,0,1); Bt = vec3(0,1,0); }
        else if (f == 2) { N = vec3(0,1,0); T = vec3(1,0,0); Bt = vec3(0,0,-1); }
        else if (f == 3) { N = vec3(0,-1,0); T = vec3(1,0,0); Bt = vec3(0,0,1); }
        else if (f == 4) { N = vec3(0,0,1); T = vec3(1,0,0); Bt = vec3(0,1,0); }
        else if (f == 5) { N = vec3(0,0,-1); T = vec3(-1,0,0); Bt = vec3(0,1,0); }
        else { N = normalize(vec3(uCam.x - vW.x, 0.0, uCam.z - vW.z) + vec3(0.0, 0.7, 0.0)); T = vec3(1,0,0); Bt = vec3(0,1,0); }
        if (mode == 2 && dot(Ns, Ns) > 0.5) {
          N = Ns;
          vec3 t2 = T - N * dot(T, N), b2 = Bt - N * dot(Bt, N);
          T = dot(t2, t2) > 1e-4 ? normalize(t2) : normalize(cross(N, abs(N.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
          Bt = dot(b2, b2) > 1e-4 ? normalize(b2) : cross(N, T);
        }
        vec3 tn = nm.xyz * 2.0 - 1.0;
        vec3 n = f < 6 ? normalize(T * tn.x + Bt * tn.y + N * tn.z) : N;
        vec3 alb = pow(a.rgb, vec3(2.2));
        vec3 col;
        if (nm.a > 0.75) col = mix(alb * 5.0, uFog, 1.0 - exp(-pow(distance(vW, uCam) * uFogD, 1.5)));
        else col = lightIt(alb, n, N, vW, vL, vAo, nm.a * 2.0);
        gl_FragColor = vec4(all(equal(col, col)) ? max(col, vec3(0.0)) : vec3(0.0), 1.0); // never let a NaN reach the bloom
      }`,
  });
}

// depth-only material for the sun's shadow map (alpha-tested so foliage casts lacy shadows)
export function makeShadowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uAlb: U.uAlb },
    vertexShader: /* glsl */`
      attribute float layer; varying vec2 vUv; varying float vLayer;
      void main() { vUv = uv; vLayer = layer; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp sampler2DArray; uniform sampler2DArray uAlb; varying vec2 vUv; varying float vLayer;
      void main() { if (texture(uAlb, vec3(vUv, vLayer)).a < 0.5) discard; gl_FragColor = vec4(1.0); }`,
  });
}

export function makeMobMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uLight: { value: new THREE.Vector2(0, 0) }, uHurt: { value: 0 }, uGore: { value: 0 }, uGrime: { value: 0.6 }, uShine: { value: 0 }, uSeed: { value: Math.random() * 50 } },
    vertexShader: /* glsl */`
      attribute vec3 color;
      varying vec3 vC; varying vec3 vW; varying vec3 vN; varying vec3 vP;
      void main() {
        vC = color; vP = position;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec2 uLight; uniform float uHurt; uniform float uGore; uniform float uGrime; uniform float uSeed; uniform float uShine;
      ${LIGHT_GLSL}
      varying vec3 vC; varying vec3 vW; varying vec3 vN; varying vec3 vP;
      float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 q = vP + uSeed;
        // grime and mottling: nothing here is clean
        float m = vn(q * 9.0) * 0.55 + vn(q * 23.0) * 0.3 + vn(q * 61.0) * 0.15;
        vec3 alb = pow(vC, vec3(2.2)) * mix(1.0, 0.25 + 1.2 * m * m, uGrime);
        // bruising and veins in dead flesh
        float vein = smoothstep(0.47, 0.5, vn(q * 14.0)) * smoothstep(0.53, 0.5, vn(q * 14.0));
        alb *= 1.0 - vein * 0.5 * uGrime;
        alb = mix(alb, alb * vec3(0.7, 0.75, 1.05), smoothstep(0.55, 0.8, vn(q * 4.0 + 9.0)) * uGrime * 0.6);
        // old blood and fresh: dark crusted smears with a wet edge
        float g = vn(q * 5.0 + 3.0) * 0.7 + vn(q * 17.0) * 0.3;
        float blood = smoothstep(0.58, 0.66, g) * uGore;
        float fresh = smoothstep(0.66, 0.74, g) * uGore;
        alb = mix(alb, mix(vec3(0.035, 0.006, 0.004), vec3(0.09, 0.004, 0.002), fresh), blood);
        vec3 c = lightIt(alb, n, n, vW, uLight, 0.7 + 0.3 * m, max(0.06 + fresh * 0.8, uShine * (0.6 + 0.4 * m)));
        c = mix(c, vec3(0.6, 0.03, 0.02), uHurt * 0.65);
        gl_FragColor = vec4(all(equal(c, c)) ? max(c, vec3(0.0)) : vec3(0.0), 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- physics helpers
export function collides(world, x, y, z, half, h) {
  const x0 = Math.floor(x - half), x1 = Math.floor(x + half - 1e-4);
  const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-4);
  const z0 = Math.floor(z - half), z1 = Math.floor(z + half - 1e-4);
  for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++)
    if (SOLID[world.get(xx, yy, zz)]) return true;
  return false;
}
export function moveBody(world, b, dt) {
  const p = b.pos, v = b.vel;
  b.onGround = false;
  let hitH = false;
  const dy = v.y * dt;
  if (dy) {
    p.y += dy;
    if (collides(world, p.x, p.y, p.z, b.half, b.h)) {
      if (dy < 0) { p.y = Math.floor(p.y) + 1; b.onGround = true; } else p.y = Math.floor(p.y + b.h) - b.h - 1e-3;
      v.y = 0;
    }
  }
  const dx = v.x * dt;
  if (dx) {
    p.x += dx;
    if (collides(world, p.x, p.y, p.z, b.half, b.h)) { p.x = dx > 0 ? Math.floor(p.x + b.half) - b.half - 1e-3 : Math.floor(p.x - b.half) + 1 + b.half + 1e-3; v.x = 0; hitH = true; }
  }
  const dz = v.z * dt;
  if (dz) {
    p.z += dz;
    if (collides(world, p.x, p.y, p.z, b.half, b.h)) { p.z = dz > 0 ? Math.floor(p.z + b.half) - b.half - 1e-3 : Math.floor(p.z - b.half) + 1 + b.half + 1e-3; v.z = 0; hitH = true; }
  }
  return hitH;
}

// ---------------------------------------------------------------- meshing tables
const FACES = [
  { n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0], t: 1 },
  { n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0], t: 1 },
  { n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1], t: 0 },
  { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], t: 2 },
  { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], t: 1 },
  { n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0], t: 1 },
];
const SXS = [-1, 1, 1, -1], SYS = [-1, -1, 1, 1];
const AOC = [0.35, 0.58, 0.8, 1.0];
const hashI = (x, y, z) => { let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- world
export class World {
  constructor(seed) {
    this.seed = seed;
    this.blocks = new Uint8Array(N);
    this.sky = new Uint8Array(N);
    this.blk = new Uint8Array(N);
    this.q = new Int32Array(1 << 23);
    this.changes = new Map();
    this.chestSet = new Set();
    this.chestKind = new Map();
    this.opened = new Set();
    this.dungeons = [];
    this.cap = 1 << 17;
    this.alloc(this.cap);
  }
  alloc(cap) {
    this.P = new Float32Array(cap * 3); this.UV = new Float32Array(cap * 2); this.LY = new Float32Array(cap);
    this.LA = new Float32Array(cap * 2); this.AO = new Float32Array(cap); this.FC = new Float32Array(cap);
    this.IX = new Uint32Array(cap * 3); this.NR = new Float32Array(cap * 3); this.GW = new Float32Array(cap);
    if (!this.CC) { this.CC = new Float32Array(17 * 17 * (H + 1) * 8); this.CK = new Int32Array(17 * 17 * (H + 1)); this.stamp = 0; }
  }
  idx(x, y, z) { return x + z * W + y * WD; }
  inBounds(x, y, z) { return x >= 0 && z >= 0 && x < W && z < D && y >= 0 && y < H; }
  get(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= H) return B.AIR;
    if (x < 0 || z < 0 || x >= W || z >= D) return B.BEDROCK;
    return this.blocks[x + z * W + y * WD];
  }
  lightAt(x, y, z) {
    if (y >= H) return [15, 0];
    if (!this.inBounds(x, y, z)) return [0, 0];
    const i = x + z * W + y * WD; return [this.sky[i], this.blk[i]];
  }
  topSolid(x, z) {
    for (let y = H - 1; y > 0; y--) { const b = this.blocks[x + z * W + y * WD]; if (SOLID[b] && b !== B.LEAVES && b !== B.GLOOMLEAF) return y; }
    return 0;
  }
  raw(x, y, z, b) { if (x >= 0 && z >= 0 && x < W && z < D && y >= 1 && y < H) this.blocks[x + z * W + y * WD] = b; }

  // ------------------------------------------------------------ generation
  generate() {
    const nz = makeNoise(this.seed), rnd = mulberry32((this.seed * 7 + 13) | 0);
    this.rnd = rnd;
    const bl = this.blocks, G = GROUND;
    const C = this.castle = { G, x0: 70, z0: 64, x1: 186, z1: 176 };
    const hm = this.hm = new Int16Array(WD);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const e = nz.n2(x / 90, z / 90) * 0.6 + nz.n2(x / 38, z / 38) * 0.28 + nz.n2(x / 14, z / 14) * 0.1;
      const m = Math.max(0, nz.n2(x / 70 + 200, z / 70 + 200));
      let h = 29 + e * 7 + m * m * 16;
      // the Fungal Mire: a drowned lowland; the Ashen Barrens: terraced basalt mesas
      const farK = sm(448, 470, x), mireK = sm(222, 250, x) * (1 - sm(328, 352, x)), barK = sm(330, 358, x) * (1 - farK);
      const woodK = farK * (1 - sm(548, 566, x)), saltK = sm(548, 566, x) * (1 - sm(655, 672, x)), frostK = sm(655, 672, x);
      const hMire = 25 + e * 2.4 + Math.max(0, nz.n2(x / 18 + 40, z / 18)) * 3;
      const ridge = 1 - Math.abs(nz.n2(x / 46 - 70, z / 46 + 30));
      let hBar = 35 + e * 5 + (ridge > 0.6 ? Math.floor((ridge - 0.6) * 60 / 4) * 4 : 0);
      const hWood = 31 + e * 6 + m * m * 9;
      const dune = Math.max(0, nz.n2(x / 15 + 300, z / 34 - 60)), hSalt = 26.5 + e * 1.6 + dune * dune * 7;
      const peak = Math.max(0, nz.n2(x / 38 + 90, z / 38 - 40)), hFrost = 38 + e * 7 + Math.pow(peak, 1.4) * 32;
      h = h * (1 - mireK - barK - woodK - saltK - frostK) + hMire * mireK + hBar * barK + hWood * woodK + hSalt * saltK + hFrost * frostK;
      // the old world's rim (unchanged west of the Cinder Wall); past it the wall falls away again, and the far lands have their own rim
      const rx = x < OLDW ? Math.abs(x - OLDW / 2) / (OLDW / 2) : Math.max(1 - (x - (OLDW - 1)) / (OLDW / 2), (x - (W - OLDW / 2)) / (OLDW / 2));
      const r = Math.max(rx, Math.abs(z - 128) / 128);
      h += sm(0.9, 0.995, r) * 34 * (0.75 + 0.25 * nz.n2(x / 20, z / 20));
      const ddx = Math.max(C.x0 - x, 0, x - C.x1), ddz = Math.max(C.z0 - z, 0, z - C.z1), dr = Math.hypot(ddx, ddz);
      if (dr < 40) h = G + (h - G) * sm(16, 40, dr);
      h = Math.max(8, Math.min(H - 6, Math.floor(h)));
      hm[x + z * W] = h;
      let top = h <= 25 ? B.MUD : h >= 52 ? B.ASH : B.GRASS;
      if (mireK > 0.5) top = nz.n2(x / 9 + 11, z / 9) > 0.25 ? B.GRASS : B.MUD;
      if (barK > 0.5) top = ridge > 0.6 && nz.n2(x / 7, z / 7 + 5) > -0.2 ? B.BASALT : B.ASH;
      if (woodK > 0.5) top = h <= 29 || nz.n2(x / 8 - 30, z / 8) > 0.45 ? B.MUD : B.GRASS;
      if (saltK > 0.5) top = h <= 28 && nz.n2(x / 11 + 70, z / 11) > -0.25 ? B.SALT : B.SAND;
      if (frostK > 0.5) top = h <= 37 && nz.n2(x / 9 - 120, z / 9) > 0.1 ? B.ICE : (h >= 62 && nz.n2(x / 6, z / 6 + 40) > 0.35 ? B.STONE : B.SNOW);
      const deep = barK > 0.5 ? B.BASALT : B.STONE;
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === 0) b = B.BEDROCK; else if (y < h - 3) b = deep; else if (y < h) b = top === B.ASH || top === B.BASALT || top === B.SNOW || top === B.ICE ? deep : top === B.SAND || top === B.SALT ? B.SAND : B.DIRT; else b = top;
        bl[x + z * W + y * WD] = b;
      }
    }
    // caves: coarse 3D noise grid, trilinear sampled
    const S = 4, gx = W / S + 1, gy = H / S + 1, gz = D / S + 1;
    const A = new Float32Array(gx * gy * gz), Bn = new Float32Array(gx * gy * gz), Cv = new Float32Array(gx * gy * gz);
    for (let k = 0; k < gz; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const X = i * S, Y = j * S, Z = k * S, gi = i + k * gx + j * gx * gz;
      A[gi] = nz.n3(X / 30, Y / 20, Z / 30);
      Bn[gi] = nz.n3(X / 30 + 71.3, Y / 20 + 33.1, Z / 30 - 19.7);
      Cv[gi] = nz.n3(X / 52 - 40, Y / 26, Z / 52 + 90);
    }
    const tri = (arr, x, y, z) => {
      const fx = x / S, fy = y / S, fz = z / S;
      const i = Math.min(gx - 2, fx | 0), j = Math.min(gy - 2, fy | 0), k = Math.min(gz - 2, fz | 0);
      const tx = fx - i, ty = fy - j, tz = fz - k;
      const at = (a, b, c) => arr[(i + a) + (k + c) * gx + (j + b) * gx * gz];
      const c00 = at(0, 0, 0) * (1 - tx) + at(1, 0, 0) * tx, c10 = at(0, 1, 0) * (1 - tx) + at(1, 1, 0) * tx;
      const c01 = at(0, 0, 1) * (1 - tx) + at(1, 0, 1) * tx, c11 = at(0, 1, 1) * (1 - tx) + at(1, 1, 1) * tx;
      return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
    };
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = hm[x + z * W];
      const inCastle = x > C.x0 - 14 && x < C.x1 + 14 && z > C.z0 - 14 && z < C.z1 + 14;
      const top = inCastle ? G - 17 : (nz.n2(x / 34 + 500, z / 34 - 300) > 0.5 ? h : h - 5);
      for (let y = 1; y <= Math.min(top, H - 2); y++) {
        const a = tri(A, x, y, z), b = tri(Bn, x, y, z);
        if (a * a + b * b < 0.017 || (y < 26 && tri(Cv, x, y, z) > 0.6)) bl[x + z * W + y * WD] = B.AIR;
      }
    }
    // ores
    const rnd2 = mulberry32((this.seed * 31 + 7) | 0);
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H; y++) for (let z = 0; z < D; z++) for (let x = pass ? OLDW : 0; x < (pass ? W : OLDW); x++) {
      const i = x + z * W + y * WD;
      if (bl[i] !== B.STONE) continue;
      const rr = pass ? rnd2 : rnd, r = rr();
      let ore = 0;
      if (r < 0.009) ore = B.COAL; else if (y < 32 && r < 0.0145) ore = B.IRON;
      if (!ore) continue;
      bl[i] = ore;
      if (!pass) {
        // spread exactly as the old 448-wide world did, wrap-arounds and all, so it draws the same numbers
        const OWD = OLDW * D, oi = x + z * OLDW + y * OWD;
        for (const o of [1, OLDW, OWD, -1]) {
          const oj = oi + o; if (oj <= OWD || oj >= OWD * H) continue;
          const oy = Math.floor(oj / OWD), orr = oj - oy * OWD, oz = Math.floor(orr / OLDW), j = orr - oz * OLDW + oz * W + oy * WD;
          if (bl[j] === B.STONE && rr() < 0.5) bl[j] = ore;
        }
      } else for (const o of [1, W, WD, -1]) { const j = i + o; if (j > WD && j < N && (j % W) >= OLDW && bl[j] === B.STONE && rr() < 0.5) bl[j] = ore; }
    }
    // the castle, catacombs, village, scattered ruins and buried crypts
    buildRuins(this, rnd, nz, B);
    // vegetation outside the walls
    const skip = (x, z) => (x > C.x0 - 16 && x < C.x1 + 16 && z > C.z0 - 16 && z < C.z1 + 16) || (Math.abs(x - 128) < 5 && z > C.z1);
    for (let z = 4; z < D - 4; z++) for (let x = 4; x < OLDW - 4; x++) {
      if (skip(x, z)) continue;
      const top = this.topSolid(x, z), tb = bl[x + z * W + top * WD];
      if ((tb !== B.GRASS && tb !== B.MUD && tb !== B.ASH && tb !== B.BASALT) || this.get(x, top + 1, z) !== B.AIR) continue;
      const r = rnd(), dens = 0.6 + 0.6 * nz.n2(x / 40 + 9, z / 40);
      const reg = regionAt(x).id;
      if (reg === 'mire') {
        if (r < 0.0055 * dens) this.mushroom(x, top + 1, z, rnd);
        else if (r < 0.008) this.deadTree(x, top + 1, z, rnd);
        else if (r < 0.0095) this.thicket(x, top + 1, z);
        else if (r < 0.013) this.raw(x, top + 1, z, B.GLOWCAP);
        else if (r < 0.16) this.raw(x, top + 1, z, B.TALLGRASS);
        continue;
      }
      if (reg === 'barrens') {
        if (r < 0.0035) this.raw(x, top, z, B.EMBERVENT);
        else if (r < 0.009 * dens) this.deadTree(x, top + 1, z, rnd);
        else if (r < 0.014) this.raw(x, top + 1, z, B.BONES);
        continue;
      }
      if (r < 0.006 * dens) this.deadTree(x, top + 1, z, rnd);
      else if (r < 0.016 * dens && tb === B.GRASS) this.pine(x, top + 1, z, rnd);
      else if (r < 0.0195 * dens && tb === B.GRASS) this.thicket(x, top + 1, z);
      else if (r < 0.1 && tb !== B.ASH) this.raw(x, top + 1, z, B.TALLGRASS);
      else if (r < 0.1015) this.raw(x, top + 1, z, B.BONES);
    }
    this.hidePass(skip);
    // glowcaps in caves (the old lands first, as before)
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { this.cutPasses(); this.farLands(rnd2, nz); }
      for (let z = 0; z < D; z++) for (let x = pass ? OLDW : 0; x < (pass ? W : OLDW); x++) {
        const top = hm[x + z * W];
        for (let y = 2; y < top - 5; y++) {
          const i = x + z * W + y * WD;
          if (bl[i] !== B.AIR) continue;
          const below = bl[i - WD];
          if ((below === B.STONE || below === B.DIRT || below === B.COAL) && (pass ? rnd2 : rnd)() < 0.03) bl[i] = B.GLOWCAP;
        }
      }
    }
    // the written remains of the Concord, each set down where its writer would have been
    this.notes = new Map();
    for (const [id, x, z, yh] of notePlaces(this)) {
      let done = false;
      for (let r = 0; r <= 9 && !done; r++) for (let dz = -r; dz <= r && !done; dz++) for (let dx = -r; dx <= r && !done; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const xx = x + dx, zz = z + dz;
        const ys = yh != null ? [yh, yh + 1, yh - 1, yh + 2, yh - 2] : [this.topSolid(xx, zz) + 1];
        for (const y of ys) {
          const below = this.get(xx, y - 1, zz);
          if (this.get(xx, y, zz) === B.AIR && this.get(xx, y + 1, zz) === B.AIR && SOLID[below] && below !== B.LEAVES && below !== B.MIRECAP) {
            this.raw(xx, y, zz, B.NOTE); this.notes.set(this.idx(xx, y, zz), id); done = true;
            // the workings the Concord wrote down lie near the notes of those who used them
            const tome = id === 'mire2' ? 'tome_hex' : id === 'barrens1' ? 'tome_blast' : null;
            if (tome) for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const ty = this.topSolid(xx + ox, zz + oz) + 1; if (this.get(xx + ox, ty, zz + oz) === B.AIR) { this.placeChest(xx + ox, ty, zz + oz, tome); break; } }
            break;
          }
        }
      }
    }
  }
  // a giant fungus of the drowned gardens: pale stalk, glowing domed cap
  // a knot of brambles, chest-high: crouch inside and keep still and nothing will find you
  // three passes cut through the Cinder Wall, where the old ash-roads ran east
  cutPasses() {
    const bl = this.blocks, hm = this.hm;
    for (const pz of [62, 130, 198]) {
      const xa = OLDW - 46, xb = OLDW + 44, ha = hm[xa + pz * W], hb = hm[xb + pz * W];
      for (let x = xa; x <= xb; x++) for (let dz = -6; dz <= 6; dz++) {
        const z = pz + dz + Math.round(Math.sin(x / 9) * 2); if (z < 1 || z >= D - 1) continue;
        const t = (x - xa) / (xb - xa), floor = Math.round(ha + (hb - ha) * t), w = Math.abs(dz) <= 3 ? 0 : (Math.abs(dz) - 3) * 2.2;
        const cur = hm[x + z * W], target = Math.min(cur, Math.round(floor + w));
        if (target >= cur) continue;
        for (let y = target + 1; y <= cur + 1 && y < H; y++) bl[x + z * W + y * WD] = B.AIR;
        bl[x + z * W + target * WD] = x < OLDW ? B.ASH : B.GRAVEL;
        hm[x + z * W] = target;
      }
    }
  }
  farLands(rnd, nz) {
    const bl = this.blocks;
    for (let z = 4; z < D - 4; z++) for (let x = OLDW - 4; x < W - 4; x++) {
      const top = this.topSolid(x, z), tb = bl[x + z * W + top * WD];
      if (this.get(x, top + 1, z) !== B.AIR) continue;
      const r = rnd(), reg = regionAt(x).id, dens = 0.6 + 0.6 * nz.n2(x / 40 + 9, z / 40);
      if (reg === 'wood' && (tb === B.GRASS || tb === B.MUD)) {
        if (r < 0.016 * dens) this.weepTree(x, top + 1, z, rnd);
        else if (r < 0.03) this.deadTree(x, top + 1, z, rnd);
        else if (r < 0.04) this.thicket(x, top + 1, z);
        else if (r < 0.044) this.hollowLog(x, top + 1, z, rnd);
        else if (r < 0.05) this.raw(x, top + 1, z, B.GLOWCAP);
        else if (r < 0.3) this.raw(x, top + 1, z, B.TALLGRASS);
      } else if (reg === 'salt' && (tb === B.SAND || tb === B.SALT)) {
        if (r < 0.006) this.raw(x, top + 1, z, B.BONES);
        else if (r < 0.009) this.deadTree(x, top + 1, z, rnd);
        else if (r < 0.011) { const hh = 2 + Math.floor(rnd() * 4); for (let k = 1; k <= hh; k++) this.raw(x, top + k, z, B.SALT); } // salt pillars
        else if (r < 0.04 && tb === B.SAND) this.raw(x, top + 1, z, B.TALLGRASS);
      } else if (reg === 'frost' && (tb === B.SNOW || tb === B.STONE)) {
        if (r < 0.009 * dens) this.pine(x, top + 1, z, rnd);
        else if (r < 0.013) this.deadTree(x, top + 1, z, rnd);
        else if (r < 0.0145) this.raw(x, top + 1, z, B.BONES);
      }
    }
    // the First Landing: the wrecks of the ships that came before yours
    this.wrecks = [];
    for (const [wx, wz] of [[580, 70], [612, 150], [598, 214], [640, 104], [570, 186]]) {
      const x = wx + Math.floor(rnd() * 10) - 5, z = wz + Math.floor(rnd() * 10) - 5;
      this.wreck(x, this.topSolid(x, z), z, rnd); this.wrecks.push({ x, z });
    }
    // the Rimewatch: the star-monks' house, high in the snow
    this.monastery = this.abbey(712, 120, rnd);
    this.greatTree = { x: 500, z: 128 }; this.weepTree(500, this.topSolid(500, 128) + 1, 128, rnd, 1.7);
  }
  // a black-barked giant of the Weeping Wood: thick trunk, a roof of dark leaves, moss hanging in curtains
  weepTree(x, y, z, rnd, k = 1) {
    const th = Math.round((11 + rnd() * 9) * k), R = Math.round((4 + rnd() * 3) * k), tw = k > 1 ? 2 : (rnd() < 0.4 ? 2 : 1);
    if (y + th + 4 >= H) return;
    for (let dz = 0; dz < tw; dz++) for (let dx = 0; dx < tw; dx++) for (let dy = -1; dy < th; dy++) this.raw(x + dx, y + dy, z + dz, B.BLACKBARK);
    for (const [ox, oz] of [[-1, 0], [tw, 0], [0, -1], [0, tw]]) if (rnd() < 0.7) { this.raw(x + ox, y, z + oz, B.BLACKBARK); if (rnd() < 0.5) this.raw(x + ox, y + 1, z + oz, B.BLACKBARK); }
    const top = y + th;
    for (let dy = -3; dy <= 2; dy++) {
      const rr = R * (dy < 0 ? 1 - (-dy) * 0.12 : 1 - dy * 0.3);
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dz); if (d > rr) continue;
        const X = x + dx, Y = top + dy, Z = z + dz;
        if (this.get(X, Y, Z) === B.AIR) this.raw(X, Y, Z, B.GLOOMLEAF);
        if (dy === -3 && d > rr * 0.5 && rnd() < 0.18) for (let m = 1; m <= 2 + Math.floor(rnd() * 5); m++) { if (this.get(X, Y - m, Z) !== B.AIR) break; this.raw(X, Y - m, Z, B.MOSS); }
      }
    }
  }
  // a ship of the First Landing, run aground on what used to be the sea
  wreck(x, gy, z, rnd) {
    const L = 16 + Math.floor(rnd() * 6), Wd = 3, sink = 2, tilt = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < L; i++) {
      const t = i / (L - 1), half = Math.round(Wd * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08))), xx = x - (L >> 1) + i;
      const deck = gy + 3 - sink;
      for (let dz = -half; dz <= half; dz++) {
        const zz = z + dz, edge = Math.abs(dz) === half, bottom = deck - 3 + Math.round(Math.abs(dz) * 0.6);
        for (let y = bottom; y <= deck; y++) {
          const shell = edge || y === bottom;
          if (shell && rnd() < 0.86) this.raw(xx, y, zz, y === bottom && dz === 0 ? B.LOG : B.PLANKS);
          else if (!shell) this.raw(xx, y, zz, B.AIR);
        }
        if (edge && rnd() < 0.5) this.raw(xx, deck + 1, zz, B.PLANKS);
        if (!edge && rnd() < 0.25 && i > 2 && i < L - 3) this.raw(xx, deck, zz, B.PLANKS);
      }
    }
    // the mast, snapped and leaning
    let mx = x, mz = z;
    for (let k = 0; k < 9 + Math.floor(rnd() * 5); k++) { if (k > 4 && rnd() < 0.4) mz += tilt; this.raw(mx, gy + k - 2, mz, B.LOG); }
    for (let k = 0; k < 6; k++) this.raw(mx - 3 + k, gy + 6, mz, B.BANNER);
    this.placeChest(x + 2, gy + 3 - sink - 2, z, 'dungeon');
    this.raw(x - 3, gy + 3 - sink - 2, z, B.BONES);
  }
  // the house of the star-monks: a cloister, a tower, a little dome for the telescope, all half under snow
  abbey(cx, cz, rnd) {
    let base = 999; for (let z = cz - 9; z <= cz + 9; z++) for (let x = cx - 12; x <= cx + 12; x++) base = Math.min(base, this.topSolid(x, z));
    base = Math.max(base, 30);
    for (let z = cz - 9; z <= cz + 9; z++) for (let x = cx - 12; x <= cx + 12; x++) {
      const e = Math.min(x - (cx - 12), cx + 12 - x, z - (cz - 9), cz + 9 - z);
      for (let y = base - 4; y <= base; y++) this.raw(x, y, z, B.BRICK);
      for (let y = base + 1; y < base + 16; y++) this.raw(x, y, z, B.AIR);
      if (e === 0) { const hgt = 4 + Math.floor(rnd() * 3); for (let y = base + 1; y <= base + hgt; y++) this.raw(x, y, z, rnd() < 0.15 ? B.CRACKED : B.BRICK); }
      else if (e === 4 && (x + z) % 3 === 0) for (let y = base + 1; y <= base + 4; y++) this.raw(x, y, z, B.BRICK); // cloister pillars
      else if (rnd() < 0.35) this.raw(x, base + 1, z, B.SNOW);
    }
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = base + 1; y <= base + 3; y++) this.raw(x, y, cz + 9, B.AIR); // the door
    // the tower, with the dome on top
    const tx = cx + 8, tz = cz - 5;
    for (let y = base + 1; y <= base + 18; y++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
      this.raw(tx + dx, y, tz + dz, ring ? (rnd() < 0.1 ? B.CRACKED : B.BRICK) : (y % 5 === 0 ? B.PLANKS : B.AIR));
    }
    for (let dy = 0; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy * 1.2, dz) < 3.3 && Math.hypot(dx, dy * 1.2, dz) > 2.3) this.raw(tx + dx, base + 19 + dy, tz + dz, B.SLATE);
    this.raw(tx, base + 1, tz + 2, B.AIR); this.raw(tx, base + 2, tz + 2, B.AIR);
    for (const [dx, dz] of [[-6, -4], [6, 4], [-8, 3], [0, -6]]) this.raw(cx + dx, base + 1, cz + dz, B.CANDLES);
    this.placeChest(cx, base + 1, cz - 7, 'dungeon'); this.placeChest(tx, base + 16, tz, 'dungeon');
    return { x: cx, y: base + 1, z: cz };
  }
  // somewhere to go to ground in every stretch of open country: thorn brakes, and here and there a ruined shed with its cupboard still standing
  hidePass(skip) {
    let h = 0;
    const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    const ok = [B.GRASS, B.MUD, B.DIRT, B.ASH, B.SAND, B.SNOW];
    for (let cz = 6; cz < D - 28; cz += 24) for (let cx = 6; cx < W - 28; cx += 24) {
      h = (Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ 0x2545f491) | 0;
      for (let a = 0; a < 8; a++) {
        const x = cx + Math.floor(r() * 22), z = cz + Math.floor(r() * 22);
        if (skip(x, z) || Math.hypot(x - 128, z - 229) < 26) continue;
        const top = this.topSolid(x, z), above = this.get(x, top + 1, z);
        if (!ok.includes(this.get(x, top, z)) || (above !== B.AIR && above !== B.TALLGRASS)) continue;
        const q = r();
        if (q < 0.22) { if (this.shed(x, top + 1, z, r)) break; continue; }
        if (q < 0.45) { if (this.hollowLog(x, top + 1, z, r)) break; continue; }
        this.raw(x, top + 1, z, B.AIR);
        this.thicket(x, top + 1, z); this.thicket(x + 1, top + 1, z + 1); this.thicket(x - 1, top + 1, z + 1);
        break;
      }
    }
  }
  // a fallen trunk, rotted hollow: crawl inside and lie still
  hollowLog(x, y, z, r) {
    const ax = r() < 0.5, len = 3;
    for (let k = 0; k < len; k++) {
      const X = ax ? x + k : x, Z = ax ? z : z + k;
      if (X < 2 || Z < 2 || X >= W - 2 || Z >= D - 2 || this.topSolid(X, Z) + 1 !== y) return false;
      const a = this.get(X, y, Z), b = this.get(X, y + 1, Z);
      if ((a !== B.AIR && a !== B.TALLGRASS) || b !== B.AIR) return false;
    }
    for (let k = 0; k < len; k++) this.raw(ax ? x + k : x, y, ax ? z : z + k, B.HOLLOWLOG);
    if (r() < 0.5) this.raw(ax ? x + 1 : x, y + 1, ax ? z : z + 1, B.TALLGRASS);
    return true;
  }
  shed(x, y, z, r) {
    if (x < 3 || z < 3 || x >= W - 3 || z >= D - 3) return false;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(this.topSolid(x + dx, z + dz) + 1 - y) > 1) return false;
    const door = r() < 0.5 ? [0, 2] : [2, 0], ds = r() < 0.5 ? 1 : -1;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const wx = x + dx, wz = z + dz, wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      for (let yy = this.topSolid(wx, wz) + 1; yy < y; yy++) this.raw(wx, yy, wz, B.COBBLE);
      for (let yy = y; yy <= y + 3; yy++) this.raw(wx, yy, wz, B.AIR);
      this.raw(wx, y - 1, wz, wall ? B.COBBLE : B.PLANKS);
      if (!wall) continue;
      if (dx === door[0] * ds && dz === door[1] * ds) continue;
      const hgt = 1 + (r() < 0.7 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
      for (let k = 0; k < hgt; k++) this.raw(wx, y + k, wz, r() < 0.3 ? B.PLANKS : B.COBBLE);
    }
    // the cupboard, against the wall opposite the door
    const bx = x - door[0] * ds, bz = z - door[1] * ds;
    this.raw(bx, y, bz, B.WARDROBE); this.raw(bx, y + 1, bz, B.WARDROBE);
    if (r() < 0.6) this.raw(x + (door[1] ? 1 : 0), y, z + (door[0] ? 1 : 0), B.COBWEB);
    return true;
  }
  thicket(x, y, z) {
    // its own coordinate hash, so adding thickets leaves the rest of the world's generation untouched
    let h = (x * 374761393 + z * 668265263) ^ 0x5bd1e995;
    const rnd = () => { h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const n = 4 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const tx = x + Math.floor(rnd() * 3) - 1, tz = z + Math.floor(rnd() * 3) - 1;
      if (tx < 1 || tz < 1 || tx >= W - 1 || tz >= D - 1) continue;
      const ty = this.topSolid(tx, tz) + 1;
      if (Math.abs(ty - y) > 1 || this.get(tx, ty, tz) !== B.AIR) continue;
      this.raw(tx, ty, tz, B.THICKET);
      if (rnd() < 0.75 && this.get(tx, ty + 1, tz) === B.AIR) this.raw(tx, ty + 1, tz, B.THICKET);
    }
  }
  mushroom(x, y, z, rnd) {
    const th = 5 + ((rnd() * 7) | 0), R = 2 + ((rnd() * 3) | 0);
    for (let dy = 0; dy < th + 2; dy++) if (this.get(x, y + dy, z) !== B.AIR) return;
    const lean = rnd() < 0.5 ? [1, 0] : [0, 1], ls = rnd() < 0.5 ? 1 : -1;
    let cx = x, cz = z;
    for (let dy = 0; dy < th; dy++) { if (dy > th * 0.6 && rnd() < 0.3) { cx += lean[0] * ls; cz += lean[1] * ls; } this.raw(cx, y + dy, cz, B.STALK); }
    const top = y + th;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dz); if (d > R + 0.3) continue;
      const hh = Math.round((1 - d / (R + 0.5)) * 2);
      for (let k = 0; k <= hh; k++) if (this.get(cx + dx, top + k, cz + dz) === B.AIR) this.raw(cx + dx, top + k, cz + dz, B.MIRECAP);
      if (d > R - 0.8 && rnd() < 0.5 && this.get(cx + dx, top - 1, cz + dz) === B.AIR) this.raw(cx + dx, top - 1, cz + dz, B.MIRECAP);
    }
  }
  deadTree(x, y, z, rnd) {
    const th = 5 + ((rnd() * 5) | 0);
    for (let dy = 0; dy < th; dy++) if (this.get(x, y + dy, z) !== B.AIR) return;
    for (let dy = 0; dy < th; dy++) this.raw(x, y + dy, z, B.DEADWOOD);
    const nb = 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < nb; i++) {
      const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][(rnd() * 4) | 0];
      let bx = x, by = y + 2 + ((rnd() * (th - 2)) | 0), bz = z;
      for (let s = 0; s < 2 + ((rnd() * 2) | 0); s++) { bx += dx; bz += dz; if (rnd() < 0.5) by++; if (this.get(bx, by, bz) === B.AIR) this.raw(bx, by, bz, B.DEADWOOD); }
    }
  }
  pine(x, y, z, rnd) {
    const th = 7 + ((rnd() * 5) | 0);
    for (let dy = 0; dy < th + 1; dy++) if (this.get(x, y + dy, z) !== B.AIR) return;
    for (let dy = 2; dy <= th; dy++) {
      const rr = Math.max(0, Math.round((th - dy) / 2.6));
      for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > rr + (rnd() < 0.3 ? 1 : 0)) continue;
        if (this.get(x + dx, y + dy, z + dz) === B.AIR) this.raw(x + dx, y + dy, z + dz, B.LEAVES);
      }
    }
    this.raw(x, y + th + 1, z, B.LEAVES);
    for (let dy = 0; dy < th; dy++) this.raw(x, y + dy, z, B.LOG);
  }
  placeChest(x, y, z, kind) {
    this.raw(x, y, z, B.CHEST);
    const i = this.idx(x, y, z);
    this.chestSet.add(i); this.chestKind.set(i, kind);
  }
  applyChanges(list) { for (const [i, b] of list) { this.blocks[i] = b; this.changes.set(i, b); } }

  // ------------------------------------------------------------ lighting (sky + block, BFS flood)
  relight(x0, z0, x1, z1) {
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(W - 1, x1); z1 = Math.min(D - 1, z1);
    const bl = this.blocks, sky = this.sky, blk = this.blk, q = this.q, QM = q.length - 1;
    let qh = 0, qt = 0;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      let lvl = 15;
      for (let y = H - 1; y >= 0; y--) {
        const i = x + z * W + y * WD, b = bl[i];
        if (OPAQUE[b]) lvl = 0; else if ((b === B.LEAVES || b === B.COBWEB) && lvl > 0) lvl = Math.max(0, lvl - 2);
        sky[i] = lvl;
        const e = LIGHT[b]; blk[i] = e;
        if (e > 1) { q[qt] = i; qt = (qt + 1) & QM; }
      }
    }
    // only sky cells that can still spread light (a darker open neighbour) need to seed the flood
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (let y = H - 1; y >= 1; y--) {
      const i = x + z * W + y * WD, s0 = sky[i];
      if (s0 <= 1) continue;
      const t = s0 - 1;
      if ((y > 0 && !OPAQUE[bl[i - WD]] && sky[i - WD] < t) ||
          (x > x0 && !OPAQUE[bl[i - 1]] && sky[i - 1] < t) || (x < x1 && !OPAQUE[bl[i + 1]] && sky[i + 1] < t) ||
          (z > z0 && !OPAQUE[bl[i - W]] && sky[i - W] < t) || (z < z1 && !OPAQUE[bl[i + W]] && sky[i + W] < t)) { q[qt] = i; qt = (qt + 1) & QM; }
    }
    const seedBorder = (x, z) => {
      if (x < 0 || z < 0 || x >= W || z >= D) return;
      for (let y = 0; y < H; y++) { const i = x + z * W + y * WD; if (sky[i] > 1 || blk[i] > 1) { q[qt] = i; qt = (qt + 1) & QM; } }
    };
    for (let x = x0; x <= x1; x++) { seedBorder(x, z0 - 1); seedBorder(x, z1 + 1); }
    for (let z = z0; z <= z1; z++) { seedBorder(x0 - 1, z); seedBorder(x1 + 1, z); }
    let s = 0, k = 0;
    const visit = (nx, ny, nz) => {
      if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || ny < 0 || ny >= H) return;
      const j = nx + nz * W + ny * WD;
      if (OPAQUE[bl[j]]) return;
      let push = false;
      if (sky[j] < s) { sky[j] = s; push = true; }
      if (blk[j] < k) { blk[j] = k; push = true; }
      if (push) { q[qt] = j; qt = (qt + 1) & QM; }
    };
    while (qh !== qt) {
      const i = q[qh]; qh = (qh + 1) & QM;
      s = sky[i] - 1; k = blk[i] - 1;
      if (s <= 0 && k <= 0) continue;
      const y = (i / WD) | 0, rem = i - y * WD, z = (rem / W) | 0, x = rem - z * W;
      visit(x + 1, y, z); visit(x - 1, y, z); visit(x, y + 1, z); visit(x, y - 1, z); visit(x, y, z + 1); visit(x, y, z - 1);
    }
  }

  setBlock(x, y, z, b) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 1 || y >= H) return null;
    const i = this.idx(x, y, z);
    this.blocks[i] = b; this.changes.set(i, b);
    this.relight(x - 15, z - 15, x + 15, z + 15);
    const out = [];
    for (let cz = Math.max(0, Math.floor((z - 16) / CS)); cz <= Math.min(NCZ - 1, Math.floor((z + 16) / CS)); cz++)
      for (let cx = Math.max(0, Math.floor((x - 16) / CS)); cx <= Math.min(NCX - 1, Math.floor((x + 16) / CS)); cx++) out.push(cx + cz * NCX);
    return out;
  }

  // ------------------------------------------------------------ meshing
  buildChunk(cx, cz) {
    const bl = this.blocks, sky = this.sky, blk = this.blk;
    let v = 0, ii = 0;
    const x0 = cx * CS, z0 = cz * CS;
    const getM = (x, y, z) => (y < 0 ? B.BEDROCK : y >= H ? B.AIR : (x < 0 || z < 0 || x >= W || z >= D) ? B.BEDROCK : bl[x + z * W + y * WD]);
    const skyM = (x, y, z) => (y >= H ? 15 : (y < 0 || x < 0 || z < 0 || x >= W || z >= D) ? 0 : sky[x + z * W + y * WD]);
    const blkM = (x, y, z) => ((y >= H || y < 0 || x < 0 || z < 0 || x >= W || z >= D) ? 0 : blk[x + z * W + y * WD]);
    const bright = [0, 0, 0, 0];
    // Each lattice corner of natural ground slides toward the smoothed surface of the solid around it, and takes that
    // surface's normal: steps become slopes, cubes become mounds. Pure function of the world, so chunks stay seamless.
    const CC = this.CC, CK = this.CK, stamp = ++this.stamp;
    const corner = (px, py, pz) => {
      const key = (px - x0) + (pz - z0) * 17 + py * 289, ci = key * 8;
      if (CK[key] === stamp) return ci;
      CK[key] = stamp;
      let n = 0, gx = 0, gy = 0, gz = 0, fixed = false, any = false, grass = 0;
      for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const c = getM(px + dx, py + dy, pz + dz);
        if (NAT[c]) { n++; any = true; gx += dx + 0.5; gy += dy + 0.5; gz += dz + 0.5; if (c === B.GRASS) grass++; }
        else if (SOLID[c] || OPAQUE[c]) fixed = true;
      }
      CC[ci] = CC[ci + 1] = CC[ci + 2] = 0; CC[ci + 6] = 0; CC[ci + 7] = n ? grass / n : 0;
      if (fixed || !any) {
        // built stone: a few centimetres of settling and wear, so walls are hand-laid rather than ruled
        if (fixed) { const h = hashI(px, py, pz), h2 = hashI(pz + 7, px - 3, py + 11), h3 = hashI(py - 5, pz + 13, px); CC[ci] = (h - 0.5) * 0.1; CC[ci + 1] = (h2 - 0.5) * 0.06; CC[ci + 2] = (h3 - 0.5) * 0.1; }
        return ci;
      }
      const gl = Math.hypot(gx, gy, gz);
      if (gl > 1e-4) {
        const k = (0.5 - n / 8) * 1.5 / gl;
        CC[ci] = gx * k; CC[ci + 1] = gy * k; CC[ci + 2] = gz * k;
        CC[ci + 3] = -gx / gl; CC[ci + 4] = -gy / gl; CC[ci + 5] = -gz / gl; CC[ci + 6] = 1;
      } else return ci;
      // a little irregularity so nothing lines up on the grid
      const h = hashI(px, py, pz), h2 = hashI(pz + 7, px - 3, py + 11), h3 = hashI(py - 5, pz + 13, px);
      CC[ci] += (h - 0.5) * 0.3; CC[ci + 1] += (h2 - 0.5) * 0.14; CC[ci + 2] += (h3 - 0.5) * 0.3;
      return ci;
    };
    const quad = (pts, layer, ls, lb, face, both) => {
      const b0 = v;
      const us = [0, 1, 1, 0], vs = [0, 0, 1, 1];
      for (let k = 0; k < 4; k++) {
        this.P[v * 3] = pts[k][0]; this.P[v * 3 + 1] = pts[k][1]; this.P[v * 3 + 2] = pts[k][2];
        this.NR[v * 3] = 0; this.NR[v * 3 + 1] = 0; this.NR[v * 3 + 2] = 0; this.GW[v] = 0;
        this.UV[v * 2] = us[k]; this.UV[v * 2 + 1] = vs[k]; this.LY[v] = layer;
        this.LA[v * 2] = ls; this.LA[v * 2 + 1] = lb; this.AO[v] = 1; this.FC[v] = face; v++;
      }
      const IX = this.IX;
      IX[ii++] = b0; IX[ii++] = b0 + 1; IX[ii++] = b0 + 2; IX[ii++] = b0; IX[ii++] = b0 + 2; IX[ii++] = b0 + 3;
      if (both) { IX[ii++] = b0; IX[ii++] = b0 + 2; IX[ii++] = b0 + 1; IX[ii++] = b0; IX[ii++] = b0 + 3; IX[ii++] = b0 + 2; }
    };
    for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
      const i = x + z * W + y * WD, b = bl[i];
      if (!b) continue;
      if (v + 24 > this.cap) {
        const old = { P: this.P, UV: this.UV, LY: this.LY, LA: this.LA, AO: this.AO, FC: this.FC, IX: this.IX, NR: this.NR, GW: this.GW };
        this.cap *= 2; this.alloc(this.cap);
        for (const k in old) this[k].set(old[k]);
      }
      const d = BLOCKS[b], tl = TL[b];
      if (d.render === 'cross') {
        const ls = sky[i] / 15, lb = blk[i] / 15, j = (hashI(x, y, z) - 0.5) * 0.2;
        const a = 0.12 + j, c = 0.88 + j;
        quad([[x + a, y, z + a], [x + c, y, z + c], [x + c, y + 1, z + c], [x + a, y + 1, z + a]], tl[0], ls, lb, 6, true);
        quad([[x + a, y, z + c], [x + c, y, z + a], [x + c, y + 1, z + a], [x + a, y + 1, z + c]], tl[0], ls, lb, 6, true);
        continue;
      }
      if (d.render === 'plane') {
        const ls = sky[i] / 15, lb = blk[i] / 15;
        let pts, face;
        if (OPAQUE[getM(x, y, z - 1)]) { const zz = z + 0.06; pts = [[x, y, zz], [x + 1, y, zz], [x + 1, y + 1, zz], [x, y + 1, zz]]; face = 4; }
        else if (OPAQUE[getM(x, y, z + 1)]) { const zz = z + 0.94; pts = [[x + 1, y, zz], [x, y, zz], [x, y + 1, zz], [x + 1, y + 1, zz]]; face = 5; }
        else if (OPAQUE[getM(x - 1, y, z)]) { const xx = x + 0.06; pts = [[xx, y, z + 1], [xx, y, z], [xx, y + 1, z], [xx, y + 1, z + 1]]; face = 0; }
        else if (OPAQUE[getM(x + 1, y, z)]) { const xx = x + 0.94; pts = [[xx, y, z], [xx, y, z + 1], [xx, y + 1, z + 1], [xx, y + 1, z]]; face = 1; }
        else if (hashI(x, y, z) < 0.5) { const zz = z + 0.5; pts = [[x, y, zz], [x + 1, y, zz], [x + 1, y + 1, zz], [x, y + 1, zz]]; face = 6; }
        else { const xx = x + 0.5; pts = [[xx, y, z + 1], [xx, y, z], [xx, y + 1, z], [xx, y + 1, z + 1]]; face = 6; }
        quad(pts, tl[0], ls, lb, face, true);
        continue;
      }
      const cutout = d.render === 'cutout', nat = NAT[b];
      for (let f = 0; f < 6; f++) {
        let smoothFace = false;
        const F = FACES[f], n = F.n, r = F.r, u = F.u;
        const ax = x + n[0], ay = y + n[1], az = z + n[2];
        const nb = getM(ax, ay, az);
        if (OPAQUE[nb]) continue;
        if (cutout && nb === b && b !== B.LEAVES) continue;
        const layer = tl[F.t];
        const b0 = v;
        for (let k = 0; k < 4; k++) {
          const sx = SXS[k], sy = SYS[k];
          const px = Math.round(x + 0.5 + n[0] * 0.5 + r[0] * sx * 0.5 + u[0] * sy * 0.5);
          const py = Math.round(y + 0.5 + n[1] * 0.5 + r[1] * sx * 0.5 + u[1] * sy * 0.5);
          const pz = Math.round(z + 0.5 + n[2] * 0.5 + r[2] * sx * 0.5 + u[2] * sy * 0.5);
          const ci = corner(px, py, pz), CC = this.CC;
          this.P[v * 3] = px + CC[ci]; this.P[v * 3 + 1] = py + CC[ci + 1]; this.P[v * 3 + 2] = pz + CC[ci + 2];
          this.GW[v] = CC[ci + 7];
          if (nat && CC[ci + 6]) { this.NR[v * 3] = CC[ci + 3]; this.NR[v * 3 + 1] = CC[ci + 4]; this.NR[v * 3 + 2] = CC[ci + 5]; }
          else { this.NR[v * 3] = n[0]; this.NR[v * 3 + 1] = n[1]; this.NR[v * 3 + 2] = n[2]; }
          if (nat && CC[ci + 6]) smoothFace = true;
          const s1x = ax + r[0] * sx, s1y = ay + r[1] * sx, s1z = az + r[2] * sx;
          const s2x = ax + u[0] * sy, s2y = ay + u[1] * sy, s2z = az + u[2] * sy;
          const cxx = s1x + u[0] * sy, cyy = s1y + u[1] * sy, czz = s1z + u[2] * sy;
          const o1 = OPAQUE[getM(s1x, s1y, s1z)], o2 = OPAQUE[getM(s2x, s2y, s2z)], oc = OPAQUE[getM(cxx, cyy, czz)];
          const ao = (o1 && o2) ? 0 : 3 - o1 - o2 - oc;
          let ls = skyM(ax, ay, az), lb = blkM(ax, ay, az), cnt = 1;
          if (!o1) { ls += skyM(s1x, s1y, s1z); lb += blkM(s1x, s1y, s1z); cnt++; }
          if (!o2) { ls += skyM(s2x, s2y, s2z); lb += blkM(s2x, s2y, s2z); cnt++; }
          if (!oc && !(o1 && o2)) { ls += skyM(cxx, cyy, czz); lb += blkM(cxx, cyy, czz); cnt++; }
          ls /= cnt * 15; lb /= cnt * 15;
          this.UV[v * 2] = (sx + 1) / 2; this.UV[v * 2 + 1] = (sy + 1) / 2; this.LY[v] = layer;
          this.LA[v * 2] = ls; this.LA[v * 2 + 1] = lb; this.AO[v] = AOC[ao]; this.FC[v] = f;
          bright[k] = AOC[ao] * (0.15 + ls + lb);
          v++;
        }
        if (smoothFace) for (let k = v - 4; k < v; k++) this.FC[k] = f + nat * 10;
        const IX = this.IX;
        if (bright[0] + bright[2] > bright[1] + bright[3]) { IX[ii++] = b0 + 1; IX[ii++] = b0 + 2; IX[ii++] = b0 + 3; IX[ii++] = b0 + 1; IX[ii++] = b0 + 3; IX[ii++] = b0; }
        else { IX[ii++] = b0; IX[ii++] = b0 + 1; IX[ii++] = b0 + 2; IX[ii++] = b0; IX[ii++] = b0 + 2; IX[ii++] = b0 + 3; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, v * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.UV.slice(0, v * 2), 2));
    g.setAttribute('layer', new THREE.BufferAttribute(this.LY.slice(0, v), 1));
    g.setAttribute('light', new THREE.BufferAttribute(this.LA.slice(0, v * 2), 2));
    g.setAttribute('ao', new THREE.BufferAttribute(this.AO.slice(0, v), 1));
    g.setAttribute('face', new THREE.BufferAttribute(this.FC.slice(0, v), 1));
    g.setAttribute('snrm', new THREE.BufferAttribute(this.NR.slice(0, v * 3), 3));
    g.setAttribute('gw', new THREE.BufferAttribute(this.GW.slice(0, v), 1));
    g.setIndex(new THREE.BufferAttribute(this.IX.slice(0, ii), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + CS / 2, H / 2, z0 + CS / 2), Math.hypot(CS / 2, H / 2, CS / 2) + 1);
    return g;
  }

  // ------------------------------------------------------------ ray casting (Amanatides & Woo)
  raycast(o, d, maxD) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const tdx = d.x ? Math.abs(1 / d.x) : Infinity, tdy = d.y ? Math.abs(1 / d.y) : Infinity, tdz = d.z ? Math.abs(1 / d.z) : Infinity;
    let tmx = d.x ? (d.x > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity;
    let tmy = d.y ? (d.y > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity;
    let tmz = d.z ? (d.z > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxD) {
      const b = this.get(x, y, z);
      if (b !== B.AIR && this.inBounds(x, y, z)) return { x, y, z, nx, ny, nz, t, b };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    const steps = Math.ceil(L / 0.4);
    for (let s = 1; s < steps; s++) {
      const f = s / steps;
      if (OPAQUE[this.get(Math.floor(a.x + dx * f), Math.floor(a.y + dy * f), Math.floor(a.z + dz * f))]) return false;
    }
    return true;
  }
}
function sm(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
