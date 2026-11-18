// ===== World generation, map helpers, pathfinding =====
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const r = mulberry32(seed), P = 256, vals = new Float32Array(P * P);
  for (let i = 0; i < vals.length; i++) vals[i] = r();
  const v = (x, y) => vals[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
function fbm(n, x, y, oct) {
  let s = 0, a = 1, f = 1, t = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; }
  return s / t;
}

const idx = (x, y) => y * MAP_W + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function terr(x, y) { return G.tiles.terrain[idx(x, y)]; }
function ownerAt(x, y) { return inB(x, y) ? G.tiles.owner[idx(x, y)] : -2; }
function countAround(x, y, r, fn) {
  let c = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (inB(nx, ny) && fn(nx, ny)) c++;
  }
  return c;
}

function genWorld(seed, nFactions, mapType) {
  const MT = MAP_TYPES[mapType] || MAP_TYPES.continents;
  const n1 = makeNoise(seed), n2 = makeNoise(seed * 7 + 13), n3 = makeNoise(seed * 3 + 101), n4 = makeNoise(seed * 11 + 5), n5 = makeNoise(seed * 5 + 77);
  const r = mulberry32(seed + 999);
  const N = MAP_W * MAP_H;
  const tiles = {
    terrain: new Uint8Array(N), owner: new Int16Array(N).fill(-1), bld: new Int32Array(N).fill(0),
    road: new Uint8Array(N), special: new Uint8Array(N), deco: new Uint8Array(N), appeal: new Float32Array(N),
  };
  const elev = new Float32Array(N);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let e = fbm(n1, x / MT.scale, y / MT.scale, 4);
    const dx = (x / MAP_W - 0.5) * 2, dy = (y / MAP_H - 0.5) * 2;
    if (MT.radial) e -= Math.pow(Math.hypot(dx, dy * 1.1), 2.2) * MT.radial;
    else e -= Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 5) * 0.3;
    e += MT.lift;
    e += (fbm(n3, x / 5, y / 5, 2) - 0.5) * 0.08;
    // mountain ranges: long ridges of peaks, broken by the occasional pass
    const rv = Math.abs(fbm(n4, x / 19, y / 19, 3) - 0.5);
    if (e > 0.42 && rv < MT.ridge) {
      const pass = fbm(n5, x / 4, y / 4, 2) > 0.63;
      e = Math.max(e, pass ? 0.66 : 0.72 + (MT.ridge - rv) * 3);
    }
    elev[idx(x, y)] = e;
    const m = fbm(n2, x / 9, y / 9, 3);
    let t;
    if (e < 0.30) t = T.DEEP; else if (e < 0.345) t = T.WATER; else if (e < 0.37) t = T.SAND;
    else if (e > 0.71) t = T.MOUNTAIN; else if (e > 0.63) t = T.HILLS;
    else if (m > 0.59) t = T.FOREST; else if (m < 0.41 && e < 0.55) t = T.MEADOW; else t = T.GRASS;
    tiles.terrain[idx(x, y)] = t;
  }
  // rivers run downhill from the high ground to the sea; fords let people wade across every so often
  { const srcs = [];
    for (let i = 0; i < N; i++) { const t = tiles.terrain[i]; if ((t === T.HILLS || t === T.MOUNTAIN) && elev[i] > 0.62) srcs.push(i); }
    srcs.sort(() => r() - 0.5);
    let made = 0;
    for (const s of srcs) {
      if (made >= MT.rivers) break;
      const sx = s % MAP_W, sy = (s / MAP_W) | 0;
      if (countAround(sx, sy, 6, (x, y) => tiles.special[idx(x, y)] === 9)) continue; // keep rivers apart
      const path = [], seen = new Set([s]); let cur = s, ok = false;
      for (let step = 0; step < 160; step++) {
        const x = cur % MAP_W, y = (cur / MAP_W) | 0;
        let best = -1, be = 1e9;
        for (const [ox, oy] of N4) { const nx = x + ox, ny = y + oy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (seen.has(j)) continue; const v = elev[j] + r() * 0.035; if (v < be) { be = v; best = j; } }
        if (best < 0) break;
        seen.add(best); cur = best;
        const t = tiles.terrain[cur];
        if (t === T.WATER || t === T.DEEP) { ok = true; break; }
        if (t !== T.MOUNTAIN) path.push(cur);
        elev[cur] = Math.min(elev[cur], be); // carve
      }
      if (!ok || path.length < 10) continue;
      made++;
      let nextFord = 4 + Math.floor(r() * 5);
      path.forEach((i, k) => {
        if (k === nextFord) { tiles.terrain[i] = T.SAND; tiles.special[i] = 5; nextFord += 7 + Math.floor(r() * 5); }
        else { tiles.terrain[i] = T.WATER; tiles.special[i] = 9; }
        // river banks are fertile
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        for (const [ox, oy] of N4) { const nx = x + ox, ny = y + oy; if (inB(nx, ny) && tiles.terrain[idx(nx, ny)] === T.GRASS && r() < 0.45) tiles.terrain[idx(nx, ny)] = T.MEADOW; }
      });
    }
    for (let i = 0; i < N; i++) if (tiles.special[i] === 9) tiles.special[i] = 0;
  }
  // ore and gold veins
  for (let i = 0; i < N; i++) {
    if (tiles.terrain[i] === T.HILLS) { const q = r(); if (q < 0.07) tiles.special[i] = 1; else if (q < 0.10) tiles.special[i] = 2; else if (q < 0.15) tiles.special[i] = 3; else if (q < 0.165) tiles.special[i] = 4; }
  }
  // choose capitals
  const land = i => { const t = tiles.terrain[i]; return t === T.GRASS || t === T.MEADOW; };
  const scoreSite = (x, y) => {
    let s = 0, landc = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) { s -= 2; continue; }
      const t = tiles.terrain[idx(nx, ny)];
      if (TERRAIN[t].build) landc++;
      if (t === T.FOREST) s += 0.25; if (t === T.HILLS) s += 0.3; if (t === T.MEADOW) s += 0.4; if (t === T.GRASS) s += 0.45; if (t === T.WATER) s += 0.3;
    }
    return landc < 45 ? -999 : s + landc * 0.1;
  };
  const cands = [];
  for (let k = 0; k < 7000; k++) {
    const x = 6 + Math.floor(r() * (MAP_W - 12)), y = 5 + Math.floor(r() * (MAP_H - 10));
    if (!land(idx(x, y))) continue;
    const sc = scoreSite(x, y); if (sc > -100) cands.push({ x, y, sc });
  }
  // player: good site near centre
  let best = null, bs = -1e9;
  for (const c of cands) {
    const s = c.sc - dist(c.x, c.y, MAP_W / 2, MAP_H / 2) * 0.35;
    if (s > bs) { bs = s; best = c; }
  }
  if (!best) best = { x: MAP_W >> 1, y: MAP_H >> 1 };
  const caps = [best];
  for (let f = 0; f < nFactions; f++) {
    let bc = null, bd = -1;
    for (const c of cands) {
      let md = 1e9; for (const p of caps) md = Math.min(md, dist(c.x, c.y, p.x, p.y));
      const d = md + c.sc * 0.3;
      if (md > 18 && d > bd) { bd = d; bc = c; }
    }
    if (!bc) break;
    caps.push(bc);
  }
  // every realm can be reached overland from yours unless the sea is in the way: carve a pass through any range that walls it off
  { const passable = i => { const t = tiles.terrain[i]; return t !== T.DEEP && t !== T.WATER && t !== T.MOUNTAIN; };
    const route = (s, g, throughMtn) => { const prev = new Int32Array(N).fill(-2), q = [s]; prev[s] = -1;
      for (let h = 0; h < q.length; h++) { const i = q[h]; if (i === g) break; const x = i % MAP_W, y = (i / MAP_W) | 0;
        for (const [ox, oy] of N4) { const nx = x + ox, ny = y + oy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (prev[j] !== -2) continue; const t = tiles.terrain[j];
          if (passable(j) || (throughMtn && t === T.MOUNTAIN)) { prev[j] = i; q.push(j); } } }
      if (prev[g] === -2) return null; const p = []; for (let i = g; i >= 0; i = prev[i]) p.push(i); return p; };
    for (let k = 1; k < caps.length; k++) {
      const s = idx(caps[0].x, caps[0].y), g = idx(caps[k].x, caps[k].y);
      if (route(s, g, false)) continue;
      const p = route(s, g, true); if (!p) continue; // across the sea: bridges and harbours needed
      for (const i of p) if (tiles.terrain[i] === T.MOUNTAIN) tiles.terrain[i] = T.HILLS;
    } }
  // guarantee player basics
  const P = caps[0];
  const ensure = (type, need, rmin, rmax) => {
    let have = 0;
    for (let dy = -rmax; dy <= rmax; dy++) for (let dx = -rmax; dx <= rmax; dx++) {
      if (inB(P.x + dx, P.y + dy) && tiles.terrain[idx(P.x + dx, P.y + dy)] === type) have++;
    }
    let guard = 0;
    while (have < need && guard++ < 200) {
      const a = r() * Math.PI * 2, d = rmin + r() * (rmax - rmin);
      const x = Math.round(P.x + Math.cos(a) * d), y = Math.round(P.y + Math.sin(a) * d);
      if (!inB(x, y)) continue;
      const i = idx(x, y);
      if ((tiles.terrain[i] === T.GRASS || tiles.terrain[i] === T.MEADOW || tiles.terrain[i] === T.SAND) && tiles.special[i] !== 5) {
        tiles.terrain[i] = type; have++;
        if (type === T.FOREST) for (const [ox, oy] of N4) { const j = idx(clamp(x + ox, 0, MAP_W - 1), clamp(y + oy, 0, MAP_H - 1)); if (r() < 0.6 && tiles.terrain[j] === T.GRASS) { tiles.terrain[j] = T.FOREST; have++; } }
      }
    }
  };
  // guarantee open farmland near the capital
  { let open = 0; const conv = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = P.x + dx, y = P.y + dy; if (!inB(x, y) || Math.hypot(dx, dy) > 4.3) continue; const t = tiles.terrain[idx(x, y)]; if (t === T.GRASS || t === T.MEADOW) open++; else if ((t === T.FOREST || t === T.HILLS) && Math.hypot(dx, dy) <= 3) conv.push(idx(x, y)); }
    conv.sort(() => r() - 0.5);
    while (open < 20 && conv.length) { tiles.terrain[conv.pop()] = r() < 0.4 ? T.MEADOW : T.GRASS; open++; } }
  ensure(T.FOREST, 8, 2, 4);
  ensure(T.HILLS, 3, 3, 4);
  ensure(T.MEADOW, 4, 1, 3);
  ensure(T.MOUNTAIN, 2, 5, 7);
  // capital tiles are grass
  for (const c of caps) { tiles.terrain[idx(c.x, c.y)] = T.GRASS; }
  // territories
  caps.forEach((c, i) => {
    const rad = i === 0 ? 4.3 : 4.0;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (inB(x, y) && Math.hypot(dx, dy) <= rad && tiles.owner[idx(x, y)] === -1) tiles.owner[idx(x, y)] = i;
    }
  });
  // independent villages: small neutral settlements away from every capital
  const villages = [];
  const vc = cands.slice().sort(() => r() - 0.5);
  for (const c of vc) {
    if (villages.length >= 14) break;
    if (tiles.owner[idx(c.x, c.y)] !== -1) continue;
    if (caps.some(p => dist(c.x, c.y, p.x, p.y) < 9) || villages.some(v => dist(c.x, c.y, v.x, v.y) < 8)) continue;
    villages.push({ x: c.x, y: c.y });
  }
  villages.forEach((v, k) => {
    const id = 50 + k, rad = 1.5 + r() * 0.9;
    tiles.terrain[idx(v.x, v.y)] = T.GRASS;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = v.x + dx, y = v.y + dy;
      if (inB(x, y) && Math.hypot(dx, dy) <= rad && tiles.owner[idx(x, y)] === -1) tiles.owner[idx(x, y)] = id;
    }
  });
  return { tiles, caps, villages };
}

function decorateVillage(v) {
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    if (G.tiles.owner[i] !== v.id) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0, t = G.tiles.terrain[i];
    if (x === v.cap.x && y === v.cap.y) { G.tiles.deco[i] = 4; continue; }
    if (TERRAIN[t].build && Math.random() < 0.45) G.tiles.deco[i] = (t === T.GRASS || t === T.MEADOW) && Math.random() < 0.4 ? 2 : 1;
  }
  for (let k = 0; k < 2; k++) aiBuildSites(v, true);
}

function decorateAI(fi) {
  // scatter ai village decorations in faction territory
  const f = fac(fi); if (!f) return;
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    if (G.tiles.owner[i] !== fi || G.tiles.deco[i]) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0, t = G.tiles.terrain[i];
    if (!TERRAIN[t].build) continue;
    const d = dist(x, y, f.cap.x, f.cap.y);
    if (d < 0.5) { G.tiles.deco[i] = 3; continue; }
    const p = d < 3 ? 0.35 : 0.12;
    if (Math.random() < p) G.tiles.deco[i] = (t === T.GRASS || t === T.MEADOW) && Math.random() < 0.45 ? 2 : 1;
  }
  for (let k = 0; k < 7; k++) aiBuildSites(f, true);
}

// ---------- Pathfinding (Dijkstra/A* with road cost) ----------
class Heap {
  constructor() { this.a = []; }
  push(n, p) { const a = this.a; a.push([p, n]); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break;[a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[1];
  }
  get size() { return this.a.length; }
}
const _pg = new Float32Array(MAP_W * MAP_H), _pp = new Int32Array(MAP_W * MAP_H), _pv = new Int32Array(MAP_W * MAP_H);
let _pstamp = 1;
function tileCost(i, army) {
  const t = G.tiles.terrain[i];
  const rd = G.tiles.road[i];
  if (rd === 3) return 0.62; // bridge
  if (!TERRAIN[t].pass) return Infinity;
  if (rd === 6) return 0.22; if (rd === 4) return 0.3; if (rd === 5) return 0.34; if (rd === 2) return 0.42; if (rd === 1) return 0.62;
  if (t === T.FOREST || t === T.HILLS) return army ? 1.6 : 1.25;
  return 1;
}
// Paths are cached until roads or terrain change (kin walk the same commutes every day).
const _pathCache = new Map(); let _pathVer = 0, _comp = null;
function pathsDirty() { _pathVer++; _pathCache.clear(); _comp = null; }
// connected walkable regions, so impossible trips fail instantly instead of searching the whole map
function walkable(i) { return G.tiles.road[i] === 3 || TERRAIN[G.tiles.terrain[i]].pass; }
function buildComps() {
  const N = MAP_W * MAP_H; _comp = new Int32Array(N).fill(-1); const q = new Int32Array(N); let c = 0;
  for (let i = 0; i < N; i++) {
    if (_comp[i] !== -1 || !walkable(i)) continue;
    let h = 0, t = 0; q[t++] = i; _comp[i] = c;
    while (h < t) { const cur = q[h++], x = cur % MAP_W, y = (cur / MAP_W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue; const ni = ny * MAP_W + nx; if (_comp[ni] === -1 && walkable(ni)) { _comp[ni] = c; q[t++] = ni; } } }
    c++;
  }
}
function reachable(s, goal) {
  if (!_comp) buildComps();
  const cs = _comp[s]; if (cs === -1) return true; // standing somewhere odd: let the search decide
  if (_comp[goal] === cs) return true;
  const gx = goal % MAP_W, gy = (goal / MAP_W) | 0;
  if (_comp[goal] === -1) for (const [dx, dy] of N4) { const nx = gx + dx, ny = gy + dy; if (inB(nx, ny) && _comp[idx(nx, ny)] === cs) return true; }
  return false;
}
function findPath(sx, sy, tx, ty, army) {
  if (!inB(sx, sy) || !inB(tx, ty)) return null;
  const s = idx(sx, sy), goal = idx(tx, ty);
  if (s === goal) return [];
  const key = s * 16384 + goal + (army ? 0.5 : 0);
  if (_pathCache.has(key)) return _pathCache.get(key);
  if (_pathCache.size > 6000) _pathCache.clear();
  if (!reachable(s, goal)) { _pathCache.set(key, null); return null; }
  const p = findPathRaw(s, goal, tx, ty, army, Math.min(16000, 1500 + Math.hypot(tx - sx, ty - sy) * 320));
  _pathCache.set(key, p);
  return p;
}
// A* with a typed-array binary heap and a closed set (fast enough for big maps and big towns)
const _hk = new Float64Array(MAP_W * MAP_H * 4), _hv = new Int32Array(MAP_W * MAP_H * 4), _pc = new Int32Array(MAP_W * MAP_H), _tc = new Float32Array(MAP_W * MAP_H), _cl = new Int32Array(MAP_W * MAP_H);
let _hn = 0;
function hpush(v, k) { let i = _hn++; while (i > 0) { const p = (i - 1) >> 1; if (_hk[p] <= k) break; _hk[i] = _hk[p]; _hv[i] = _hv[p]; i = p; } _hk[i] = k; _hv[i] = v; }
function hpop() {
  const top = _hv[0], lk = _hk[--_hn], lv = _hv[_hn]; let i = 0;
  for (; ;) { let c = 2 * i + 1; if (c >= _hn) break; if (c + 1 < _hn && _hk[c + 1] < _hk[c]) c++; if (_hk[c] >= lk) break; _hk[i] = _hk[c]; _hv[i] = _hv[c]; i = c; }
  _hk[i] = lk; _hv[i] = lv; return top;
}
function findPathRaw(s, goal, tx, ty, army, maxIter) {
  const stamp = ++_pstamp, W = MAP_W, H = MAP_H, cap = _hk.length - 16;
  // per-search tile cost cache (stamp-tagged via _pc high bits would be overkill: costs are cheap to fill lazily)
  const cost = i => { if (_pc[i] === -stamp) return _tc[i]; const c = tileCost(i, army); _tc[i] = c; _pc[i] = -stamp; return c; };
  _hn = 0; _pv[s] = stamp; _pg[s] = 0; _pp[s] = -1; hpush(s, 0);
  let iter = 0;
  while (_hn && iter++ < maxIter) {
    const cur = hpop();
    if (cur === goal) break;
    if (_cl[cur] === stamp) continue;
    _cl[cur] = stamp;
    const cx = cur % W, cy = (cur / W) | 0, gc = _pg[cur];
    for (let k = 0; k < 8; k++) {
      const dx = N8[k][0], dy = N8[k][1], nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      let c = ni === goal ? 1 : cost(ni);
      if (c === Infinity) continue;
      if (dx && dy) { if (cost(cy * W + nx) === Infinity || cost(ny * W + cx) === Infinity) continue; c *= 1.414; }
      const g = gc + c;
      if (_pv[ni] !== stamp || g < _pg[ni]) {
        _pv[ni] = stamp; _pg[ni] = g; _pp[ni] = cur;
        const ax = Math.abs(tx - nx), ay = Math.abs(ty - ny);
        if (_hn < cap) hpush(ni, g + (ax + ay - 0.586 * Math.min(ax, ay)) * 0.9);
      }
    }
  }
  if (_pv[goal] !== stamp) return null;
  const path = []; let c = goal, guard = 0;
  while (c !== s && c >= 0 && guard++ < W * H) { path.push(c); c = _pp[c]; }
  path.reverse();
  return path;
}

// ---------- Appeal map ----------
function recomputeAppeal() {
  const ap = G.tiles.appeal; ap.fill(0);
  for (const b of Object.values(G.buildings)) {
    const d = B[b.type]; if (!d.appeal) continue;
    const r = d.appealR || 1, a = d.appeal * (1 + 0.3 * (b.level - 1));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue;
      const dd = Math.hypot(dx, dy); if (dd > r + 0.5) continue;
      ap[idx(x, y)] += a * (1 - dd / (r + 1));
    }
  }
  // natural beauty: forest, water and meadow nearby add a bit
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = G.tiles.terrain[idx(x, y)];
    if (t === T.WATER || t === T.FOREST) {
      for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (inB(nx, ny)) ap[idx(nx, ny)] += 0.4; }
    }
  }
}
function appealAt(x, y) { return G.tiles.appeal[idx(x, y)]; }
