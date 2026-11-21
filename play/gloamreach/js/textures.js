// Procedural 64px material textures: albedo (sRGB) + tangent-space normal maps.
// Normal-map alpha packs gloss (0..127) or an emissive flag (>=128).
export const TS = 64;
const S = TS;

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const wrap = (a, P) => ((a % P) + P) % P;
function vnoise(u, v, Px, Py, s) {
  const x = u * Px, y = v * Py, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = wrap(xi, Px), x1 = wrap(xi + 1, Px), y0 = wrap(yi, Py), y1 = wrap(yi + 1, Py);
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u, v, Px, Py, oct, s) {
  let t = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) { t += amp * vnoise(u, v, Px << o, Py << o, s + o * 17); norm += amp; amp *= 0.5; }
  return t / norm;
}
function voronoi(u, v, P, s) {
  const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, mx = wrap(cx, P), my = wrap(cy, P);
    const px = cx + hash2(mx, my, s), py = cy + hash2(mx, my, s + 7);
    const d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; id = hash2(mx, my, s + 13); } else if (d < d2) d2 = d;
  }
  return { d1, d2, id };
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// small raster canvas for sprites
class Spr {
  constructor() { this.p = new Array(S * S).fill(null); }
  px(x, y, c, h = 0.5, e = 0, g = 0.1) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < S && y < S) this.p[y * S + x] = { c, a: 1, h, e, g }; }
  rect(x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = fn(x, y); if (r) this.px(x, y, r.c, r.h, r.e, r.g); } }
  ellipse(cx, cy, rx, ry, fn) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy; if (d <= 1) { const r = fn(x, y, d); if (r) this.px(x, y, r.c, r.h, r.e, r.g); } } }
  line(x0, y0, x1, y1, w, fn) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; this.ellipse(cx, cy, w / 2, w / 2, (x, y) => fn(x, y, t)); }
  }
  get(x, y) { return this.p[y * S + x] || { c: [0, 0, 0], a: 0, h: 0 }; }
}

// ------------------------------------------------------------------ material painters
function ashlar(u, v, x, y, seed, base = [100, 96, 90]) {
  const row = Math.floor(y / 32), off = (row % 2) * 32 + ((hash2(row, 0, seed) * 10) | 0);
  const xx = (x + off) % 64, col = Math.floor(xx / 64), lx = xx % 64, ly = y % 32;
  const e = Math.min(lx + 0.5, 63.5 - lx, ly + 0.5, 31.5 - ly);
  const id = hash2(row, col, seed + 5), n = fbm(u, v, 8, 8, 4, seed + 9), fine = hash2(x, y, seed + 3);
  let c = shade(base, 0.74 + id * 0.34 + (n - 0.5) * 0.4 + (fine - 0.5) * 0.1);
  const st = fbm(u, v, 16, 2, 2, seed + 11); c = shade(c, 1 - Math.max(0, st - 0.52) * 0.9);
  c = shade(c, 1 - (ly / 31) * 0.16);
  let h = Math.min(1, e / 5) * (0.72 + n * 0.28);
  if (e < 1.6) { c = shade([46, 44, 40], 0.8 + fine * 0.3); h = 0.04; }
  if (hash2(Math.floor(x / 3), Math.floor(y / 3), seed + 21) > 0.982) { c = shade(c, 0.62); h *= 0.45; }
  return { c, h, g: 0.12, edge: e };
}
function stoneNat(u, v, x, y, seed, base = [86, 84, 82]) {
  const n = fbm(u, v, 4, 4, 5, seed), fine = hash2(x, y, seed + 1);
  const strata = Math.sin((v + n * 0.35) * Math.PI * 2 * 3) * 0.5 + 0.5;
  const r = 1 - Math.abs(fbm(u, v, 3, 3, 4, seed + 21) * 2 - 1);
  let c = shade(base, 0.68 + 0.5 * n + 0.08 * strata + (fine - 0.5) * 0.1);
  let h = n * 0.8 + strata * 0.2;
  if (r > 0.93) { c = shade(c, 0.45); h *= 0.3; }
  return { c, h, g: 0.15 };
}
function dirtP(u, v, x, y, seed) {
  const n = fbm(u, v, 4, 4, 4, seed), f = hash2(x, y, seed + 2);
  let c = shade([72, 54, 40], 0.75 + n * 0.5 + (f - 0.5) * 0.12), h = n * 0.6;
  const vo = voronoi(u, v, 9, seed + 4);
  if (vo.d1 < 0.2 && vo.id > 0.55) { c = shade([96, 88, 76], 0.75 + vo.id * 0.4); h = 0.7 + (0.2 - vo.d1) * 1.5; }
  return { c, h, g: 0.08 };
}
function bark(u, v, x, y, seed, base) {
  const w = fbm(u, v, 4, 2, 3, seed);
  const ridge = Math.abs(Math.sin((u * 7 + w * 1.6) * Math.PI));
  const f = hash2(x, y, seed + 1), streak = vnoise(u, v, 32, 4, seed + 3);
  let c = shade(base, 0.72 + ridge * 0.3 + (streak - 0.5) * 0.2 + (f - 0.5) * 0.1);
  return { c, h: ridge * 0.9 + streak * 0.1, g: 0.06 };
}
function rings(u, v, x, y, seed, base, barkC) {
  const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy), n = fbm(u, v, 4, 4, 3, seed);
  if (d > 0.44) return bark(u, v, x, y, seed + 9, barkC);
  const r = Math.sin((d * 22 + n * 2) * Math.PI) * 0.5 + 0.5;
  const crack = Math.abs(Math.atan2(dy, dx) - 0.7) < 0.04 && d > 0.1;
  return { c: shade(base, crack ? 0.4 : 0.7 + r * 0.35 + (hash2(x, y, seed) - 0.5) * 0.08), h: crack ? 0.1 : 0.5 + r * 0.2, g: 0.08 };
}
function planksP(u, v, x, y, seed, base, horiz = true) {
  const a = horiz ? v : u, b = horiz ? u : v;
  const row = Math.floor(a * 4), loc = a * 4 - row;
  const grain = horiz ? fbm((b + row * 0.37) % 1, a, 2, 16, 3, seed + row) : fbm(a, (b + row * 0.37) % 1, 16, 2, 3, seed + row);
  const tone = hash2(row, 0, seed + 4);
  let c = shade(base, 0.7 + tone * 0.3 + (grain - 0.5) * 0.5);
  let h = 0.6 + grain * 0.3;
  if (loc < 0.07 || loc > 0.96) { c = shade(c, 0.35); h = 0.05; }
  const rot = fbm(u, v, 3, 3, 3, seed + 31);
  if (rot > 0.6) { c = mix(c, [30, 28, 22], (rot - 0.6) * 2.2); h -= (rot - 0.6); }
  const endX = ((row * 23) % 64) / 64;
  if (Math.abs(b - endX) < 0.012) { c = shade(c, 0.4); h = 0.1; }
  return { c, h, g: 0.1 };
}

export function buildTextures() {
  const L = [];
  const add = (name, fn, nstr = 3) => L.push({ name, fn, nstr });

  add('grass_top', (u, v, x, y) => {
    const n = fbm(u, v, 4, 4, 4, 1), d = hash2(x, y, 2), bl = vnoise(u, v, 64, 12, 5);
    let c = mix([50, 54, 32], [84, 82, 50], n);
    const dead = fbm(u, v, 3, 3, 3, 9); if (dead > 0.58) c = mix(c, [88, 74, 50], Math.min(1, (dead - 0.58) * 4));
    c = shade(c, 0.72 + 0.45 * d * bl);
    return { c, h: 0.3 + 0.7 * d * bl, g: 0.04 };
  }, 2.5);
  add('grass_side', (u, v, x, y) => {
    const fringe = 8 + fbm(u, 0.5, 8, 1, 2, 4) * 12 + hash2(x, 0, 6) * 5;
    if (y < fringe) { const d = hash2(x, y, 2); return { c: shade(mix([50, 54, 32], [84, 82, 50], fbm(u, v, 4, 4, 3, 1)), 0.7 + 0.4 * d), h: 0.8 * d, g: 0.04 }; }
    const r = dirtP(u, v, x, y, 40); if (y < fringe + 3) r.c = shade(r.c, 0.6); return r;
  });
  add('dirt', (u, v, x, y) => dirtP(u, v, x, y, 40));
  add('stone', (u, v, x, y) => stoneNat(u, v, x, y, 50), 4);
  add('ash', (u, v, x, y) => { const n = fbm(u, v, 8, 8, 3, 60), f = hash2(x, y, 61); return { c: shade(f > 0.97 ? [40, 38, 36] : [104, 100, 94], 0.78 + n * 0.35 + (f - 0.5) * 0.12), h: n * 0.5, g: 0.05 }; }, 2);
  add('log_side', (u, v, x, y) => bark(u, v, x, y, 70, [70, 54, 40]), 4);
  add('log_top', (u, v, x, y) => rings(u, v, x, y, 71, [138, 108, 74], [70, 54, 40]));
  add('leaves', (u, v, x, y) => {
    const n = fbm(u, v, 8, 8, 3, 80), f = hash2(x, y, 81);
    if (n + f * 0.28 < 0.6) return { c: [0, 0, 0], a: 0, h: 0 };
    return { c: shade([34, 48, 30], 0.6 + n * 0.6 + f * 0.3), h: n, g: 0.15 };
  });
  add('planks', (u, v, x, y) => planksP(u, v, x, y, 90, [86, 64, 44]), 3);
  // a tall slatted wardrobe door: you can see out between the slats
  add('wardrobe', (u, v, x, y) => {
    if (x < 4 || x > 59 || y < 3 || y > 60 || x === 31 || x === 32) return { c: shade([50, 34, 20], 0.7 + hash2(x, y, 5) * 0.25), h: 0.9, g: 0.12 };
    if (y > 8 && y < 44 && (y % 6) < 2 && x > 6 && x < 57 && Math.abs(x - 31.5) > 3) return { c: [8, 6, 5], h: 0.02, g: 0 };
    if ((x === 28 || x === 35) && y >= 32 && y <= 37) return { c: [118, 94, 48], h: 1, g: 0.7 };
    return planksP(u, v, x, y, 160, [62, 42, 26], false);
  }, 3);
  // ----- the far lands past the Cinder Wall
  add('sand', (u, v, x, y) => { const n = fbm(u, v, 6, 6, 3, 400), f = hash2(x, y, 401), rip = Math.sin(v * Math.PI * 14 + n * 5) * 0.5 + 0.5; return { c: shade(mix([128, 120, 104], [150, 142, 124], n), 0.8 + f * 0.18 + rip * 0.08), h: 0.3 + rip * 0.3 + n * 0.2, g: 0.04 }; }, 2);
  add('salt', (u, v, x, y) => { const vo = voronoi(u, v, 5, 402), f = hash2(x, y, 403), crack = vo.d2 - vo.d1 < 0.06; return { c: crack ? [120, 116, 108] : shade([214, 210, 200], 0.82 + f * 0.16 + vo.id * 0.06), h: crack ? 0.1 : 0.6 + f * 0.2, g: crack ? 0.05 : 0.45 }; }, 3);
  add('snow', (u, v, x, y) => { const n = fbm(u, v, 5, 5, 3, 404), f = hash2(x, y, 405); return { c: shade(f > 0.985 ? [250, 252, 255] : [206, 212, 222], 0.86 + n * 0.16), h: 0.4 + n * 0.3, g: f > 0.97 ? 0.8 : 0.3 }; }, 2);
  add('ice', (u, v, x, y) => { const n = fbm(u, v, 3, 3, 3, 406), vo = voronoi(u, v, 3, 407), crack = vo.d2 - vo.d1 < 0.03; return { c: crack ? [190, 210, 220] : shade(mix([34, 52, 66], [70, 98, 118], n), 0.85 + vo.id * 0.2), h: crack ? 0.2 : 0.5, g: 0.9 }; }, 2);
  add('blackbark_side', (u, v, x, y) => { const r = bark(u, v, x, y, 410, [36, 32, 30]); if (fbm(u, v, 4, 4, 3, 411) > 0.62) r.c = mix(r.c, [40, 58, 36], 0.6); return r; }, 4);
  add('blackbark_top', (u, v, x, y) => rings(u, v, x, y, 412, [64, 54, 44], [36, 32, 30]));
  add('gloomleaf', (u, v, x, y) => {
    const n = fbm(u, v, 8, 8, 3, 413), f = hash2(x, y, 414);
    if (n + f * 0.28 < 0.55) return { c: [0, 0, 0], a: 0, h: 0 };
    return { c: shade([22, 34, 30], 0.6 + n * 0.6 + f * 0.3), h: n, g: 0.2 };
  });
  // a hollow log: bark, with the dark mouth of the rotted core
  add('hollowlog_side', (u, v, x, y) => {
    const dx = (x - 31.5) / 22, dy = (y - 33) / 17, d = dx * dx + dy * dy;
    if (d < 1) return { c: shade([10, 7, 5], 0.6 + hash2(x, y, 420) * 0.4), h: 0.02, g: 0 };
    if (d < 1.45) return { c: shade([96, 70, 44], 0.6 + hash2(x, y, 421) * 0.35 + (1.45 - d) * 0.4), h: 0.5, g: 0.1 };
    return bark(u, v, x, y, 422, [66, 52, 40]);
  }, 4);
  add('hollowlog_top', (u, v, x, y) => { const r = bark(u, v, x, y, 423, [66, 52, 40]); if (fbm(u, v, 4, 4, 3, 424) > 0.6) r.c = mix(r.c, [52, 70, 38], 0.55); return r; }, 4);
  // hanging moss: grey-green strands
  {
    const sp = new Spr();
    for (let i = 0; i < 11; i++) { const x0 = 4 + i * 5.5 + (hash2(i, 0, 415) - 0.5) * 3, len = 30 + hash2(i, 1, 416) * 34; sp.line(x0, 0, x0 + (hash2(i, 2, 417) - 0.5) * 6, len, 1.4, (x, y) => ({ c: shade([92, 104, 80], 0.6 + hash2(x, y, 418) * 0.5), h: 0.5, g: 0.1 })); }
    add('moss', (u, v, x, y) => sp.get(x, y));
  }
  // brambles: dark leaves and thorny stems
  add('thicket', (u, v, x, y) => {
    const n = fbm(u, v, 6, 6, 3, 170), f = hash2(x, y, 171);
    const stem = Math.abs(((u * 3 + v * 1.3 + fbm(u, v, 2, 2, 2, 173) * 0.6) % 1) - 0.5) < 0.04;
    if (stem) return { c: shade([64, 46, 34], 0.7 + f * 0.3), h: 0.8, g: 0.1 };
    if (n + f * 0.3 < 0.47) return { c: [0, 0, 0], a: 0, h: 0 };
    return { c: shade(hash2(x, y, 172) > 0.94 ? [96, 30, 34] : [30, 40, 24], 0.55 + n * 0.6 + f * 0.25), h: n, g: 0.1 };
  });
  const oreTex = (seed, oc, g) => (u, v, x, y) => {
    const s = stoneNat(u, v, x, y, 50), vo = voronoi(u, v, 6, seed);
    if (vo.d1 < 0.26 && vo.id < 0.55) { const k = 1 - vo.d1 / 0.26; return { c: shade(oc, 0.6 + k * 0.5 + hash2(x, y, seed) * 0.2), h: 0.6 + k * 0.4, g }; }
    return s;
  };
  add('coal', oreTex(100, [26, 24, 24], 0.5), 4);
  add('iron', oreTex(110, [150, 92, 60], 0.35), 4);
  add('cobble', (u, v, x, y) => {
    const vo = voronoi(u, v, 5, 120), gap = vo.d2 - vo.d1, n = fbm(u, v, 8, 8, 3, 121);
    if (gap < 0.07) return { c: shade([38, 36, 34], 0.8 + n * 0.4), h: 0.02, g: 0.05 };
    const k = sm(0.07, 0.3, gap);
    return { c: shade([98, 94, 88], 0.6 + vo.id * 0.45 + (n - 0.5) * 0.35), h: 0.3 + k * 0.6 + n * 0.1, g: 0.18 };
  }, 4);
  add('ashlar', (u, v, x, y) => ashlar(u, v, x, y, 130), 4);
  // torch sprite
  {
    const sp = new Spr();
    sp.rect(29, 26, 34, 63, (x) => ({ c: shade([70, 50, 32], 0.6 + (x - 29) * 0.09), h: 0.5 }));
    sp.rect(27, 20, 36, 28, (x, y) => ({ c: shade([58, 48, 38], 0.7 + hash2(x, y, 3) * 0.4), h: 0.6 }));
    sp.ellipse(31.5, 12, 6.5, 11, (x, y, d) => ({ c: mix([255, 250, 210], [255, 120, 30], Math.min(1, d * 1.1 + hash2(x, y, 9) * 0.15)), e: 1 }));
    add('torch', (u, v, x, y) => sp.get(x, y));
  }
  // glowcap cluster
  {
    const sp = new Spr();
    for (const [cx, by, s] of [[22, 63, 1], [40, 63, 1.3], [31, 60, 0.8]]) {
      sp.rect(cx - 2 * s, by - 18 * s, cx + 2 * s, by, (x) => ({ c: shade([200, 210, 190], 0.7 + (x - cx) * 0.03), h: 0.5 }));
      sp.ellipse(cx, by - 18 * s, 10 * s, 6 * s, (x, y, d) => (y < by - 17 * s || d < 0.3) ? ({ c: hash2(x, y, 7) > 0.85 ? [200, 255, 245] : mix([90, 240, 220], [30, 120, 130], d), e: 1 }) : null);
    }
    add('glowcap', (u, v, x, y) => sp.get(x, y));
  }
  add('bedrock', (u, v, x, y) => { const vo = voronoi(u, v, 7, 140); return { c: shade([34, 32, 32], 0.6 + vo.id * 0.6), h: vo.d2 - vo.d1, g: 0.2 }; }, 5);
  add('chest_top', (u, v, x, y) => {
    const r = planksP(u, v, x, y, 150, [70, 48, 30]);
    if ((x >= 8 && x <= 13) || (x >= 50 && x <= 55)) return { c: shade([58, 58, 62], 0.7 + hash2(x, y, 1) * 0.3), h: 0.9, g: 0.55 };
    return r;
  });
  add('chest_side', (u, v, x, y) => {
    if ((y >= 9 && y <= 14) || (y >= 49 && y <= 54)) { const rivet = (x % 12 === 5) && (y === 11 || y === 51); return { c: shade([58, 58, 62], rivet ? 1.4 : 0.7 + hash2(x, y, 1) * 0.3), h: rivet ? 1 : 0.85, g: 0.55 }; }
    if (x >= 26 && x <= 37 && y >= 24 && y <= 38) { const hole = (x >= 31 && x <= 32 && y >= 29 && y <= 34); return { c: hole ? [8, 8, 8] : [120, 96, 50], h: hole ? 0 : 0.95, g: 0.7 }; }
    return planksP(u, v, x, y, 151, [70, 48, 30], false);
  });
  add('mossy', (u, v, x, y) => {
    const r = ashlar(u, v, x, y, 130), m = fbm(u, v, 4, 4, 4, 77) + (r.edge < 2 ? 0.14 : 0) + (1 - v) * 0.08;
    if (m > 0.56) { const f = hash2(x, y, 78); return { c: shade(mix([52, 66, 32], [84, 96, 48], f), 0.7 + (m - 0.56) * 1.2), h: r.h + 0.12 + f * 0.1, g: 0.04 }; }
    return r;
  }, 4);
  // dry tall grass sprite
  {
    const sp = new Spr();
    for (let i = 0; i < 26; i++) {
      const x0 = 4 + hash2(i, 0, 3) * 56, hgt = 18 + hash2(i, 1, 3) * 40, lean = (hash2(i, 2, 3) - 0.5) * 16;
      const col = mix([120, 108, 66], [76, 84, 46], hash2(i, 3, 3));
      sp.line(x0, 63, x0 + lean, 63 - hgt, 2, (x, y, t) => ({ c: shade(col, 0.6 + t * 0.5), h: t }));
    }
    add('tallgrass', (u, v, x, y) => sp.get(x, y));
  }
  // campfire
  {
    const sp = new Spr();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI; sp.ellipse(32 + Math.cos(a) * 26, 60, 4, 3, (x, y) => ({ c: shade([80, 78, 74], 0.7 + hash2(x, y, 5) * 0.4), h: 0.8 })); }
    sp.line(10, 60, 54, 50, 6, (x, y) => ({ c: shade([60, 42, 28], 0.6 + hash2(x, y, 2) * 0.4), h: 0.6 }));
    sp.line(12, 50, 52, 60, 6, (x, y) => ({ c: shade([66, 46, 30], 0.6 + hash2(x, y, 4) * 0.4), h: 0.6 }));
    sp.ellipse(32, 34, 14, 22, (x, y, d) => (fbm(x / 64, y / 64, 4, 4, 2, 9) + (1 - d) * 0.7 > 0.75) ? ({ c: mix([255, 245, 190], [230, 70, 20], Math.min(1, d * 1.2)), e: 1 }) : null);
    add('campfire', (u, v, x, y) => sp.get(x, y));
  }
  add('cracked', (u, v, x, y) => {
    const r = ashlar(u, v, x, y, 160, [92, 88, 84]), cr = 1 - Math.abs(fbm(u, v, 3, 3, 4, 91) * 2 - 1);
    if (cr > 0.94) return { c: [24, 22, 20], h: 0, g: 0 };
    if (cr > 0.9) r.c = shade(r.c, 0.7);
    return r;
  }, 4);
  add('gravel', (u, v) => { const vo = voronoi(u, v, 14, 170); const k = sm(0, 0.35, vo.d2 - vo.d1); return { c: shade(mix([96, 92, 86], [88, 74, 60], vo.id), 0.45 + k * 0.6), h: k, g: 0.12 }; }, 4);
  add('mud', (u, v, x, y) => {
    const n = fbm(u, v, 4, 4, 4, 180), wet = fbm(u, v, 3, 3, 3, 181), f = hash2(x, y, 182);
    if (wet > 0.58) return { c: shade([40, 32, 26], 0.8 + f * 0.1), h: 0.3, g: 0.95 };
    return { c: shade([60, 46, 36], 0.7 + n * 0.5 + (f - 0.5) * 0.1), h: 0.3 + n * 0.5, g: 0.3 };
  }, 2.5);
  add('deadwood_side', (u, v, x, y) => bark(u, v, x, y, 190, [86, 82, 76]), 4);
  add('deadwood_top', (u, v, x, y) => rings(u, v, x, y, 191, [110, 102, 92], [86, 82, 76]));
  // bones
  {
    const sp = new Spr(), bone = (x, y) => ({ c: shade([196, 186, 160], 0.7 + hash2(x, y, 3) * 0.35), h: 0.7 });
    sp.line(6, 58, 30, 50, 4, bone); sp.ellipse(6, 58, 3, 3, bone); sp.ellipse(30, 50, 3, 3, bone);
    sp.line(36, 61, 58, 55, 3, bone); sp.line(44, 52, 52, 62, 3, bone);
    sp.ellipse(30, 40, 11, 10, bone); sp.rect(24, 46, 36, 54, bone);
    sp.ellipse(26, 40, 3, 3.5, () => ({ c: [10, 8, 8], h: 0 })); sp.ellipse(34.5, 40, 3, 3.5, () => ({ c: [10, 8, 8], h: 0 }));
    for (let i = 0; i < 4; i++) sp.rect(25 + i * 3, 50, 26 + i * 3, 53, () => ({ c: [20, 16, 14], h: 0.1 }));
    add('bones', (u, v, x, y) => sp.get(x, y));
  }
  // cobweb
  {
    const sp = new Spr(), silk = () => ({ c: [210, 210, 214], h: 0.5, g: 0.6 });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.2; sp.line(32, 32, 32 + Math.cos(a) * 40, 32 + Math.sin(a) * 40, 1, silk); }
    for (let r = 5; r < 34; r += 5 + (r % 3)) for (let i = 0; i < 9; i++) { const a0 = i / 9 * Math.PI * 2 + 0.2, a1 = (i + 1) / 9 * Math.PI * 2 + 0.2, rr = r * 0.85; sp.line(32 + Math.cos(a0) * r, 32 + Math.sin(a0) * r, 32 + Math.cos((a0 + a1) / 2) * rr, 32 + Math.sin((a0 + a1) / 2) * rr, 1, silk); sp.line(32 + Math.cos((a0 + a1) / 2) * rr, 32 + Math.sin((a0 + a1) / 2) * rr, 32 + Math.cos(a1) * r, 32 + Math.sin(a1) * r, 1, silk); }
    add('cobweb', (u, v, x, y) => sp.get(x, y));
  }
  // iron bars
  {
    const sp = new Spr(), iron = (x, y) => ({ c: hash2(x, y, 4) > 0.8 ? [96, 54, 34] : shade([58, 54, 52], 0.6 + ((x % 16) / 16) * 0.6), h: 0.8, g: 0.6 });
    for (const bx of [4, 20, 36, 52]) sp.rect(bx, 0, bx + 6, 63, iron);
    sp.rect(0, 5, 63, 9, iron); sp.rect(0, 54, 63, 58, iron);
    add('bars', (u, v, x, y) => sp.get(x, y));
  }
  // candles
  {
    const sp = new Spr();
    for (const [cx, hgt] of [[18, 26], [31, 40], [45, 18], [38, 12]]) {
      sp.rect(cx - 3, 63 - hgt, cx + 3, 63, (x, y) => ({ c: shade([208, 196, 164], 0.65 + (x - cx + 3) * 0.06 + (hash2(x, y, 2) > 0.9 ? 0.15 : 0)), h: 0.6, g: 0.4 }));
      sp.rect(cx, 63 - hgt - 3, cx, 63 - hgt - 1, () => ({ c: [20, 16, 12], h: 0.4 }));
      sp.ellipse(cx + 0.5, 63 - hgt - 7, 2.5, 5, (x, y, d) => ({ c: mix([255, 250, 200], [255, 140, 40], d), e: 1 }));
    }
    sp.rect(8, 61, 56, 63, (x, y) => ({ c: shade([190, 180, 150], 0.6 + hash2(x, y, 1) * 0.3), h: 0.3 }));
    add('candles', (u, v, x, y) => sp.get(x, y));
  }
  // tattered banner
  add('banner', (u, v, x, y) => {
    if (y <= 4) return (x >= 2 && x <= 61) ? { c: shade([60, 44, 30], 0.7 + hash2(x, y, 3) * 0.3), h: 0.8 } : { a: 0, c: [0, 0, 0], h: 0 };
    const bottom = 50 + fbm(u, 0.5, 8, 1, 2, 5) * 14;
    if (x < 9 || x > 54 || y > bottom || fbm(u, v, 5, 5, 3, 6) > 0.7) return { a: 0, c: [0, 0, 0], h: 0 };
    const n = fbm(u, v, 4, 8, 3, 7), fold = Math.sin(u * Math.PI * 8) * 0.5 + 0.5;
    let c = shade([92, 22, 20], 0.55 + n * 0.5 + fold * 0.15);
    const d = Math.hypot(x - 32, y - 26);
    if ((d > 8 && d < 11) || (Math.abs(x - 32) < 1.6 && y > 12 && y < 42)) c = shade([168, 130, 60], 0.7 + n * 0.4);
    return { c, h: fold * 0.6 + n * 0.3, g: 0.05 };
  }, 2);
  add('slate', (u, v, x, y) => {
    const row = Math.floor(y / 10), off = (row % 2) * 6, xx = (x + off) % 64, col = Math.floor(xx / 12), lx = xx % 12, ly = y % 10;
    const id = hash2(row, col, 200), n = fbm(u, v, 8, 8, 3, 201);
    let c = shade([54, 56, 64], 0.65 + id * 0.45 + (n - 0.5) * 0.3), h = 0.3 + ly / 10 * 0.6;
    if (lx === 0 || ly === 9) { c = shade(c, 0.35); h = 0; }
    return { c, h, g: 0.45 };
  }, 4);
  // tombstone
  {
    const sp = new Spr(), stone = (x, y) => { const n = fbm(x / 64, y / 64, 4, 4, 3, 210); return { c: y > 56 && n > 0.45 ? [60, 72, 38] : shade([108, 106, 100], 0.6 + n * 0.5), h: 0.6 + n * 0.3, g: 0.15 }; };
    sp.ellipse(32, 26, 16, 14, stone); sp.rect(16, 26, 48, 63, stone);
    sp.rect(30, 18, 33, 44, () => ({ c: [44, 42, 40], h: 0.1 })); sp.rect(24, 24, 39, 27, () => ({ c: [44, 42, 40], h: 0.1 }));
    add('tombstone', (u, v, x, y) => sp.get(x, y));
  }

  // ----- the new lands: the Fungal Mire and the Ashen Barrens, and the notes of the vanished
  add('mirecap', (u, v, x, y) => {
    const n = fbm(u, v, 4, 4, 3, 300), sp = vnoise(u, v, 8, 8, 301), f = hash2(x, y, 302);
    if (sp > 0.78) return { c: mix([150, 255, 220], [60, 200, 190], (sp - 0.78) * 4), e: 1 };
    let c = mix([58, 34, 72], [104, 60, 110], n); c = shade(c, 0.7 + f * 0.25);
    return { c, h: 0.4 + n * 0.4 + (sp > 0.7 ? 0.3 : 0), g: 0.35 };
  }, 3);
  add('stalk', (u, v, x, y) => {
    const n = fbm(u, v, 2, 8, 3, 310), f = hash2(x, y, 311), fib = Math.sin(u * Math.PI * 12 + n * 4) * 0.5 + 0.5;
    return { c: shade([176, 168, 146], 0.62 + n * 0.3 + fib * 0.12 + f * 0.06), h: 0.4 + fib * 0.4, g: 0.2 };
  }, 3);
  add('basalt', (u, v, x, y) => {
    const col = Math.floor(u * 4 + fbm(u, v, 2, 2, 2, 320) * 0.6), n = fbm(u, v, 6, 6, 3, 321), f = hash2(x, y, 322);
    const lx = (u * 4 + fbm(u, v, 2, 2, 2, 320) * 0.6) % 1;
    let c = shade([46, 44, 48], 0.65 + hash2(col, 0, 323) * 0.35 + (n - 0.5) * 0.3 + f * 0.08), h = 0.5 + n * 0.3;
    if (lx < 0.06) { c = shade(c, 0.4); h = 0.05; }
    return { c, h, g: 0.25 };
  }, 4);
  add('embervent', (u, v, x, y) => {
    const n = fbm(u, v, 4, 4, 3, 330), cr = Math.abs(fbm(u, v, 3, 3, 4, 331) - 0.5);
    if (cr < 0.045) return { c: mix([255, 230, 140], [255, 90, 20], cr * 22), e: 1 };
    return { c: shade([40, 32, 30], 0.6 + n * 0.5), h: 0.3 + n * 0.5, g: 0.1 };
  }, 4);
  {
    // a parchment page nailed to a stake
    const sp = new Spr();
    sp.rect(30, 30, 33, 63, (x, y) => ({ c: shade([70, 50, 32], 0.7 + hash2(x, y, 341) * 0.3), h: 0.6 }));
    sp.rect(17, 6, 46, 40, (x, y) => {
      const n = fbm(x / 64, y / 64, 4, 4, 3, 342), edge = Math.min(x - 17, 46 - x, y - 6, 40 - y);
      if (edge < 1 && hash2(x, y, 343) > 0.6) return null;
      let c = shade([214, 196, 150], 0.7 + n * 0.35); if (edge < 2) c = shade(c, 0.7);
      if (y > 11 && y < 36 && (y % 4 === 0) && x > 20 && x < 43 && hash2(x >> 2, y, 344) > 0.25) c = shade([60, 40, 30], 0.8);
      if (n > 0.68) c = mix(c, [120, 70, 40], 0.4);
      return { c, h: 0.3, g: 0.05 };
    });
    add('note', (u, v, x, y) => sp.get(x, y));
  }

  // ----- bake
  const n = L.length, size = S * S;
  const alb = new Uint8Array(size * 4 * n), nrm = new Uint8Array(size * 4 * n);
  const index = {};
  const Hh = new Float32Array(size), meta = new Array(size);
  L.forEach((ly, li) => {
    index[ly.name] = li;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = ly.fn((x + 0.5) / S, (y + 0.5) / S, x, y) || { c: [0, 0, 0], a: 0, h: 0 };
      const o = li * size * 4 + ((S - 1 - y) * S + x) * 4;
      alb[o] = Math.max(0, Math.min(255, p.c[0])); alb[o + 1] = Math.max(0, Math.min(255, p.c[1])); alb[o + 2] = Math.max(0, Math.min(255, p.c[2]));
      alb[o + 3] = p.a === 0 ? 0 : 255;
      Hh[y * S + x] = p.h ?? 0.5; meta[y * S + x] = p;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = Hh[y * S + (x + 1) % S] - Hh[y * S + (x - 1 + S) % S];
      const dyUp = Hh[((y - 1 + S) % S) * S + x] - Hh[((y + 1) % S) * S + x];
      let nx = -dx * ly.nstr, ny = -dyUp * ly.nstr, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = li * size * 4 + ((S - 1 - y) * S + x) * 4, p = meta[y * S + x];
      nrm[o] = (nx * 0.5 + 0.5) * 255; nrm[o + 1] = (ny * 0.5 + 0.5) * 255; nrm[o + 2] = (nz * 0.5 + 0.5) * 255;
      nrm[o + 3] = p.e === 1 ? 255 : Math.round(Math.max(0, Math.min(1, p.g ?? 0.1)) * 127);
    }
  });
  return { alb, nrm, count: n, index };
}

// small 2D preview (for inventory icons)
export function layerDataURL(tex, layer) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = layer * S * S * 4 + ((S - 1 - y) * S + x) * 4, d = (y * S + x) * 4;
    im.data[d] = tex.alb[o]; im.data[d + 1] = tex.alb[o + 1]; im.data[d + 2] = tex.alb[o + 2]; im.data[d + 3] = tex.alb[o + 3];
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL();
}
