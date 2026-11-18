// ===== Roads: a network that links workplaces and homes to the heart of town =====
// Hubs are where goods are gathered. A building touching a road that leads to a hub (or standing right
// beside a hub) is "linked": workplaces produce more, homes are happier. Workplaces far from any hub with
// no road link lose output, because everything they make is carried by hand.
const ROAD_HUBS = new Set(['townhall', 'cityhall', 'warehouse', 'granary', 'market', 'harbor']);
const ROAD_BONUS = { 1: 0.12, 2: 0.22, 3: 0.12, 4: 0.32, 5: 0.35 };
const ROAD_NAMES = { 1: 'dirt path', 2: 'stone road', 3: 'bridge', 4: 'railway', 5: 'avenue' };
let _roadNet = null, _roadNetVer = '', _hubs = null, _netVer = 0;
function netDirty() { _netVer++; }
function noDrive(b) { const d = B[b.type]; return !b || !!(d.decor || d.block || d.park) || b.type === 'wall' || b.type === 'tree'; }
function isWorkplace(b) { const d = B[b.type]; return !!(d.workers && b.type !== 'barracks' && (d.prod || d.consume || d.power > 0)); }

function roadNet() {
  const ver = _pathVer + ':' + _netVer;
  if (_roadNet && _roadNetVer === ver && _roadNet.length === G.tiles.road.length) return _roadNet;
  const rd = G.tiles.road, N = rd.length, net = new Uint8Array(N), q = [];
  _hubs = [];
  for (const b of Object.values(G.buildings)) {
    if (!ROAD_HUBS.has(b.type)) continue;
    _hubs.push(b);
    for (const [dx, dy] of N4) { const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue; const j = idx(x, y); if (rd[j] && !net[j]) { net[j] = 1; q.push(j); } }
  }
  while (q.length) {
    const i = q.pop(), x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (rd[j] && !net[j]) { net[j] = 1; q.push(j); } }
  }
  _roadNet = net; _roadNetVer = ver;
  return net;
}
function hubDist(b) { roadNet(); let d = 99; for (const h of _hubs) d = Math.min(d, Math.max(Math.abs(h.x - b.x), Math.abs(h.y - b.y))); return d; }
// how a building connects: linked to a hub by road, which road, and whether any road touches it at all
function roadLink(b) {
  const net = roadNet(), rd = G.tiles.road; let lv = 0, adj = 0, hubAdj = false;
  for (const [dx, dy] of N4) {
    const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue; const j = idx(x, y);
    if (rd[j]) { adj = Math.max(adj, rd[j]); if (net[j]) lv = Math.max(lv, rd[j] === 3 ? 1 : rd[j]); }
    const o = G.tiles.bld[j]; if (o && G.buildings[o] && ROAD_HUBS.has(G.buildings[o].type)) hubAdj = true;
  }
  if (ROAD_HUBS.has(b.type)) return { linked: true, level: Math.max(lv, 1), hub: true, adj };
  if (!lv && hubAdj) return { linked: true, level: 1, beside: true, adj };
  return { linked: lv > 0, level: lv, adj };
}
// output multiplier for workplaces, plus the line the inspector shows
function roadFactor(b) {
  const L = roadLink(b);
  if (L.linked) {
    const lvl = L.beside ? 1 : L.level, bon = ROAD_BONUS[lvl];
    return { m: 1 + bon, ok: true, note: L.hub ? `🛣️ Hub: roads that reach here link other buildings to town` : L.beside ? `🛣️ Right beside a hub +${Math.round(bon * 100)}%` : `🛣️ Linked to town by ${ROAD_NAMES[lvl]} +${Math.round(bon * 100)}%` };
  }
  const d = hubDist(b), pen = Math.min(0.35, Math.max(0, d - 6) * 0.025);
  if (pen > 0) return { m: (1 - pen) * (L.adj ? 1.05 : 1), ok: false, bad: true, note: `⚠️ No road link: goods carried ${d} tiles by hand −${Math.round(pen * 100)}%. Connect a road to the Town Hall, a Warehouse, Granary or Market.` };
  return { m: L.adj ? 1.05 : 1, ok: false, note: L.adj ? '🛣️ Road here, but it does not reach a hub yet (+5%)' : '🛣️ Close to town — a road link would add +12–35%' };
}
function linkedWorkplaces() { let n = 0; for (const b of Object.values(G.buildings)) if (isWorkplace(b) && roadLink(b).linked) n++; return n; }

// ---------- Drawing: smooth roads baked into the terrain layer ----------
// N4 order is E, W, S, N
function roadArms(x, y) { const rd = G.tiles.road; return N4.map(([dx, dy]) => inB(x + dx, y + dy) && rd[idx(x + dx, y + dy)] > 0); }
// each building gets one driveway, to the road on its front (south) side if it can
function driveTile(b) {
  for (const di of [2, 0, 1, 3]) { const [dx, dy] = N4[di], x = b.x + dx, y = b.y + dy; if (inB(x, y) && G.tiles.road[idx(x, y)] && G.tiles.road[idx(x, y)] !== 3) return idx(x, y); }
  return -1;
}
function driveArms(x, y) {
  const me = idx(x, y);
  return N4.map(([dx, dy]) => { if (!inB(x + dx, y + dy)) return false; const id = G.tiles.bld[idx(x + dx, y + dy)]; const b = id && G.buildings[id]; return !!b && !noDrive(b) && driveTile(b) === me; });
}
// center lines of a road tile as polylines (a corner is one smooth curve)
function roadLines(px, py, arms) {
  const cx = px + 16, cy = py + 16, E = [[px + 32, cy], [px, cy], [cx, py + 32], [cx, py]];
  const n = arms.filter(Boolean).length;
  if (n === 2 && (arms[0] || arms[1]) && (arms[2] || arms[3])) {
    const a = E[arms[0] ? 0 : 1], b = E[arms[2] ? 2 : 3], pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); }
    return { lines: [pts], curve: true, n };
  }
  if (n === 2 && arms[0] && arms[1]) return { lines: [[E[1], E[0]]], n };
  if (n === 2 && arms[2] && arms[3]) return { lines: [[E[3], E[2]]], n };
  const lines = []; for (let d = 0; d < 4; d++) if (arms[d]) lines.push([[cx, cy], E[d]]);
  return { lines, n };
}
function strokeLines(c, lines) { c.beginPath(); for (const l of lines) { c.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) c.lineTo(l[i][0], l[i][1]); } c.stroke(); }
function offsetLine(l, o) {
  const out = [];
  for (let i = 0; i < l.length; i++) {
    const a = l[Math.max(0, i - 1)], b = l[Math.min(l.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    out.push([l[i][0] - dy / m * o, l[i][1] + dx / m * o]);
  }
  return out;
}
function roadBody(c, px, py, R0, w, col) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'butt'; c.lineJoin = 'round';
  strokeLines(c, R0.lines);
  if (R0.n !== 2) { c.beginPath(); c.arc(px + 16, py + 16, w / 2, 0, 7); c.fill(); }
  // roads laid side by side merge into one wide road or square instead of looping around each other
  for (const [qx, qy] of R0.quads) c.fillRect(qx > 0 ? px + 16 : px, qy > 0 ? py + 16 : py, 16, 16);
}
function roadQuads(x, y, arms) {
  const q = [], rd = G.tiles.road;
  for (const [a, b, dx, dy] of [[0, 2, 1, 1], [0, 3, 1, -1], [1, 2, -1, 1], [1, 3, -1, -1]])
    if (arms[a] && arms[b] && inB(x + dx, y + dy) && rd[idx(x + dx, y + dy)] && rd[idx(x + dx, y + dy)] !== 3) q.push([dx, dy]);
  return q;
}
function driveBody(c, px, py, dr, w, col) {
  const cx = px + 16, cy = py + 16, E = [[px + 32, cy], [px, cy], [cx, py + 32], [cx, py]];
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt'; c.beginPath();
  for (let d = 0; d < 4; d++) if (dr[d]) { c.moveTo(cx, cy); c.lineTo(E[d][0], E[d][1]); }
  c.stroke();
}
const ROAD_LOOK = {
  1: { edge: '#8c6a42', fill: '#c7a476', w: 11 },
  2: { edge: '#6f6b64', fill: '#b5afa3', w: 13 },
  4: { edge: '#6e665c', fill: '#968d80', w: 14 },
  5: { edge: '#c9c4ba', fill: '#4a4a4d', w: 18 },
};
function drawRoadTile(c, x, y, px, py, rd) {
  if (rd === 3) { drawBridge(c, x, y, px, py); return; }
  const L = ROAD_LOOK[rd] || ROAD_LOOK[1];
  const arms = roadArms(x, y), R0 = roadLines(px, py, arms), dr = driveArms(x, y), hasDr = dr.some(Boolean);
  R0.quads = roadQuads(x, y, arms);
  const dw = Math.max(6, L.w * 0.5);
  // soft shadow edge, then the surface
  c.globalAlpha = 0.9; roadBody(c, px, py, R0, L.w + 3, L.edge); if (hasDr) driveBody(c, px, py, dr, dw + 2, L.edge); c.globalAlpha = 1;
  roadBody(c, px, py, R0, L.w, L.fill);
  if (hasDr) driveBody(c, px, py, dr, dw, rd === 5 ? '#8a8a8a' : rd === 4 ? '#b0a796' : L.fill);
  c.setLineDash([]);
  if (rd === 1) {
    // worn centre and pebbles
    c.globalAlpha = 0.35; c.lineWidth = L.w - 6; c.strokeStyle = '#dcc39b'; strokeLines(c, R0.lines); c.globalAlpha = 1;
    c.fillStyle = 'rgba(90,62,35,0.35)';
    for (const l of R0.lines) for (let k = 0; k < 2; k++) { const p = l[Math.min(l.length - 1, ((hashf(x, y, k + 3) * l.length) | 0))], o = (hashf(x, y, k + 7) - 0.5) * (L.w - 3); c.fillRect(p[0] + o * 0.5, p[1] + o * 0.5, 1.4, 1.4); }
  } else if (rd === 2) {
    // cobble rows and a kerb line
    c.strokeStyle = 'rgba(60,55,48,0.22)'; c.lineWidth = L.w - 2; c.setLineDash([1.1, 2.6]); strokeLines(c, R0.lines); c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.setLineDash([2, 3]); for (const l of R0.lines) { strokeLines(c, [offsetLine(l, 3)]); strokeLines(c, [offsetLine(l, -3)]); } c.setLineDash([]);
  } else if (rd === 4) {
    // sleepers, then two steel rails that follow curves
    c.strokeStyle = '#6d4c41'; c.lineWidth = 12; c.setLineDash([2, 3.3]); strokeLines(c, R0.lines); c.setLineDash([]);
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.3;
    for (const l of R0.lines) { strokeLines(c, [offsetLine(l, 3.3)]); strokeLines(c, [offsetLine(l, -3.3)]); }
  } else if (rd === 5) {
    // lane markings on straights and bends, zebra crossings at junctions
    if (R0.n <= 2) { c.strokeStyle = '#ffd54f'; c.lineWidth = 1; c.setLineDash([4, 4]); strokeLines(c, R0.lines); c.setLineDash([]); }
    else { c.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 4; k++) { c.fillRect(px + 9 + k * 4, py + 7.5, 2, 3); c.fillRect(px + 9 + k * 4, py + 21.5, 2, 3); } }
  }
}
// moving cars and trains, drawn each frame for visible tiles only
function drawRoadTraffic(c, x0, y0, x1, y1) {
  if (R.cam.z < 0.7) return;
  const rd = G.tiles.road;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const r = rd[idx(x, y)]; if (r < 4) continue;
    const h = hashf(x, y, 77); if (h > (r === 5 ? 0.3 : 0.12)) continue;
    const a = roadArms(x, y), horiz = a[0] && a[1] && !a[2] && !a[3], vert = a[2] && a[3] && !a[0] && !a[1];
    if (!horiz && !vert) continue;
    const px = x * TILE, py = y * TILE, t = (R.t * (r === 4 ? 0.9 : 0.55) + hashf(x, y, 3)) % 1;
    if (r === 5) {
      c.fillStyle = ['#e53935', '#1e88e5', '#fdd835', '#fafafa', '#43a047'][(hashf(x, y, 5) * 5) | 0];
      if (horiz) { c.fillRect(px + t * 28, py + 10, 6, 4); c.fillStyle = 'rgba(180,220,255,0.8)'; c.fillRect(px + t * 28 + 3.5, py + 10.5, 1.6, 3); }
      else { c.fillRect(px + 18, py + t * 28, 4, 6); c.fillStyle = 'rgba(180,220,255,0.8)'; c.fillRect(px + 18.5, py + t * 28 + 3.5, 3, 1.6); }
    } else {
      c.fillStyle = '#37474f'; if (horiz) c.fillRect(px + t * 24, py + 11, 10, 10); else c.fillRect(px + 11, py + t * 24, 10, 10);
      c.fillStyle = '#c62828'; if (horiz) c.fillRect(px + t * 24 + 1, py + 12, 8, 2); else c.fillRect(px + 12, py + t * 24 + 1, 2, 8);
    }
  }
}
// keep the baked road layer in step with the map: any road or building change redraws nearby tiles
function syncRoadLayer() {
  const rd = G.tiles.road, bd = G.tiles.bld;
  if (!R.roadSnap || R.roadSnap.length !== rd.length) { R.roadSnap = new Uint8Array(rd); R.bldSnap = new Int32Array(bd); return; }
  const rs = R.roadSnap, bs = R.bldSnap;
  for (let i = 0; i < rd.length; i++) {
    if (rd[i] === rs[i] && bd[i] === bs[i]) continue;
    rs[i] = rd[i]; bs[i] = bd[i];
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    R.dirtyTiles.push(i); for (const [dx, dy] of N4) if (inB(x + dx, y + dy)) R.dirtyTiles.push(idx(x + dx, y + dy));
  }
}
// road tool overlay: which buildings are linked
function drawRoadLinks(c, x0, y0, x1, y1) {
  for (const b of Object.values(G.buildings)) {
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
    const d = B[b.type], px = b.x * TILE, py = b.y * TILE;
    if (ROAD_HUBS.has(b.type)) { c.strokeStyle = 'rgba(79,195,247,0.9)'; c.lineWidth = 2; c.setLineDash([4, 3]); c.strokeRect(px + 1, py + 1, 30, 30); c.setLineDash([]); continue; }
    if (!isWorkplace(b) && !d.housing) continue;
    const L = roadLink(b), bad = !L.linked && isWorkplace(b) && hubDist(b) > 6;
    c.fillStyle = L.linked ? '#43a047' : bad ? '#e53935' : '#9e9e9e'; c.beginPath(); c.arc(px + 5, py + 5, 4.5, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath();
    if (L.linked) { c.moveTo(px + 3, py + 5); c.lineTo(px + 4.6, py + 6.8); c.lineTo(px + 7.2, py + 3.4); } else if (bad) { c.moveTo(px + 5, py + 2.6); c.lineTo(px + 5, py + 5.8); c.moveTo(px + 5, py + 7); c.lineTo(px + 5, py + 7.6); } else { c.moveTo(px + 3, py + 5); c.lineTo(px + 7, py + 5); }
    c.stroke();
  }
}

// ---------- Rival realms and villages build roads too ----------
// A main street around every town centre, and roads linking the capital to each of its towns.
// Their roads get better with their age: paths, then stone, then railways between towns and avenues in town.
function aiRoadLevels(e) { return { street: e <= 2 ? 1 : e <= 5 ? 2 : 5, link: e <= 2 ? 1 : e <= 4 ? 2 : e <= 6 ? 4 : 5 }; }
function setRoad(i, lv) { const r = G.tiles.road[i]; if (r === 3) return; if (!r || (lv === 5 ? r !== 4 : lv > r)) G.tiles.road[i] = lv; }
function aiLayRoad(fid, a, b, lv) {
  const N = MAP_W * MAP_H, own = i => G.tiles.owner[i] === fid;
  const ok = i => own(i) && TERRAIN[G.tiles.terrain[i]].pass && !G.tiles.deco[i] && !G.tiles.bld[i];
  const goal = i => { const x = i % MAP_W, y = (i / MAP_W) | 0; return Math.abs(x - b.x) + Math.abs(y - b.y) === 1; };
  const prev = new Map(), cost = new Map(), q = [];
  for (const [dx, dy] of N4) { const x = a.x + dx, y = a.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (ok(i)) { prev.set(i, -1); cost.set(i, 0); q.push([0, i]); } }
  let end = -1, it = 0;
  while (q.length && it++ < 2500) {
    q.sort((p, r) => r[0] - p[0]); const [cst, i] = q.pop();
    if (cst > cost.get(i)) continue;
    if (goal(i)) { end = i; break; }
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (!ok(j)) continue;
      const nc = cst + (G.tiles.road[j] ? 0.35 : 1) + (G.tiles.terrain[j] === T.FOREST || G.tiles.terrain[j] === T.HILLS ? 0.4 : 0);
      if (!cost.has(j) || nc < cost.get(j)) { cost.set(j, nc); prev.set(j, i); q.push([nc, j]); } }
  }
  if (end < 0) return 0;
  let n = 0; for (let i = end; i >= 0; i = prev.get(i)) { setRoad(i, lv); n++; }
  return n;
}
function aiBuildRoads(f) {
  if (!f || f.dead || !f.cap) return;
  const L = aiRoadLevels(f.minor ? 1 : (f.era || 1));
  const centers = [f.cap].concat(f.towns || []);
  for (const c of centers) for (const [dx, dy] of N8) {
    const x = c.x + dx, y = c.y + dy; if (!inB(x, y)) continue; const i = idx(x, y);
    if (G.tiles.owner[i] === f.id && TERRAIN[G.tiles.terrain[i]].pass && !G.tiles.deco[i] && !G.tiles.bld[i]) setRoad(i, L.street);
  }
  for (const t of f.towns || []) aiLayRoad(f.id, f.cap, t, L.link);
  // a trade road leaving town towards the nearest neighbour, as far as their own border
  let tgt = null, td = 1e9;
  const others = [G.cap].concat(G.factions.filter(o => o !== f && !o.dead).map(o => o.cap), (G.villages || []).filter(v => v !== f && !v.dead).map(v => v.cap));
  for (const o of others) { const d = dist(o.x, o.y, f.cap.x, f.cap.y); if (d < td && d > 3) { td = d; tgt = o; } }
  if (tgt) {
    let x = f.cap.x, y = f.cap.y;
    for (let s = 0; s < 30; s++) {
      const opts = N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inB(nx, ny)).sort((a, b) => dist(a[0], a[1], tgt.x, tgt.y) - dist(b[0], b[1], tgt.x, tgt.y));
      const nxt = opts.find(([nx, ny]) => { const j = idx(nx, ny); return G.tiles.owner[j] === f.id && TERRAIN[G.tiles.terrain[j]].pass && !G.tiles.deco[j] && !G.tiles.bld[j]; });
      if (!nxt) break; x = nxt[0]; y = nxt[1]; setRoad(idx(x, y), L.link);
    }
  }
  if (typeof aiLinkSites === 'function') aiLinkSites(f, L.street); // roads out to their mines, camps and stores
  pathsDirty();
}
