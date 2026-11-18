// ===== Expansion: terrain-aware borders, block claims, growing borders and colonies founded by expeditions =====

// ---------- Terrain shapes expansion ----------
// claiming rough or distant land costs more; open lowland near your settlements is cheap
const TERRAIN_CLAIM = [1.7, 1.3, 0.9, 1, 1.1, 1.2, 1.3, 2.2];
let _centers = null, _centersKey = '';
// your settlements: the capital, vassal cities and colonies. Borders grow around them and land near them is cheaper.
function settleCenters() {
  const key = G.nextB + ':' + Object.keys(G.buildings).length + ':' + G.time.day;
  if (_centers && _centersKey === key) return _centers;
  _centers = [];
  for (const b of Object.values(G.buildings)) {
    if (b.type === 'townhall') _centers.push({ x: b.x, y: b.y, r: 5 + 0.6 * b.level, b });
    else if (b.type === 'cityhall') _centers.push({ x: b.x, y: b.y, r: 4 + 0.7 * b.level, b });
    else if (b.type === 'colony') _centers.push({ x: b.x, y: b.y, r: 3 + 1.2 * b.level, b });
  }
  _centersKey = key; return _centers;
}
function settleDist(x, y) { let d = 99; for (const c of settleCenters()) d = Math.min(d, dist(c.x, c.y, x, y)); return d; }
const blocked = (x, y) => !inB(x, y) || !TERRAIN[G.tiles.terrain[idx(x, y)]].pass;
// what makes a spot strategically interesting
function tileFeatures(x, y) {
  const out = [], i = idx(x, y), t = G.tiles.terrain[i];
  if (G.tiles.special[i] === 5) out.push('🏞️ River ford — the only dry crossing for miles');
  else if (TERRAIN[t].pass && ((blocked(x - 1, y) && blocked(x + 1, y)) || (blocked(x, y - 1) && blocked(x, y + 1)))) {
    const mtn = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inB(x + dx, y + dy) && G.tiles.terrain[idx(x + dx, y + dy)] === T.MOUNTAIN);
    out.push(mtn ? '⛰️ Mountain pass — a chokepoint' : '🌉 Narrow crossing — a chokepoint');
  }
  if (t === T.HILLS) out.push('🛡️ High ground (+20% defence)');
  if (TERRAIN[t].pass && N4.some(([dx, dy]) => inB(x + dx, y + dy) && [T.WATER, T.DEEP].includes(G.tiles.terrain[idx(x + dx, y + dy)]))) out.push('🌊 Waterside');
  return out;
}

// ---------- Claiming land in blocks ----------
function blockInfo(x, y, s) {
  const h = (s - 1) >> 1, tiles = []; let any = false, sum = 0;
  for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) {
    const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || G.tiles.owner[idx(nx, ny)] !== -1) continue;
    tiles.push({ x: nx, y: ny }); sum += claimCost(nx, ny); if (canClaim(nx, ny)) any = true;
  }
  const disc = s >= 5 ? 0.7 : s >= 3 ? 0.85 : 1;
  return { ok: any && tiles.length > 0, tiles, cost: Math.ceil(sum * disc), disc };
}
function claimBlock(x, y, s) {
  const bi = blockInfo(x, y, s);
  if (!bi.ok) { toast(bi.tiles.length ? 'The block must touch your land' : 'Nothing left to claim here'); return false; }
  if (G.res.influence < bi.cost) { toast(`Claiming these ${bi.tiles.length} tiles costs ${bi.cost} 👑`); return false; }
  G.res.influence -= bi.cost; track('influence', -bi.cost);
  for (const t of bi.tiles) G.tiles.owner[idx(t.x, t.y)] = 0;
  G.stats.claimed += bi.tiles.length; recountTiles(); R.territoryDirty = true;
  for (const f of G.factions) if (bi.tiles.some(t => countAround(t.x, t.y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === f.id))) f.relation -= f.personality === 'expansionist' ? 4 : 1.5;
  return true;
}

// ---------- Borders that grow on their own ----------
function borderRate() {
  const cs = settleCenters();
  return 0.5 + 0.25 * curEra() + 0.35 * (cs.length - 1) + 0.25 * countB('temple') + 0.15 * countB('amphitheater') + 0.4 * Object.values(G.buildings).filter(b => B[b.type].cat === 'wonder').length + fx('claim') * 1.5;
}
function borderStep() { return 1.6 + G.stats.tiles / 110; }
function borderScore(x, y, c) {
  const t = G.tiles.terrain[idx(x, y)];
  // land follows the lie of the land: valleys and plains first, never over peaks or open sea
  if (t === T.MOUNTAIN || t === T.DEEP) return -1e9;
  let s = { 1: 0.2, 2: 0.5, 3: 1, 4: 1.25, 5: 0.8, 6: 0.85 }[t] || 0.5;
  if (G.tiles.special[idx(x, y)] && G.tiles.special[idx(x, y)] < 5) s += 1.5;
  s += countAround(x, y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === 0) * 0.35; // fill gaps, keep borders tidy
  s -= dist(x, y, c.x, c.y) / c.r * 1.6;
  if (countAround(x, y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] > 0)) s -= 0.8; // reluctant to press on neighbours
  return s + Math.random() * 0.3;
}
function dailyBorders() {
  if (G.settings.autoBorders === false) return;
  G.borderPts = (G.borderPts || 0) + borderRate();
  let n = 0;
  while (G.borderPts >= borderStep() && n < 4) {
    let best = null, bs = -1e8;
    for (const c of settleCenters()) {
      const R0 = Math.ceil(c.r);
      for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
        const x = c.x + dx, y = c.y + dy;
        if (Math.hypot(dx, dy) > c.r || !canClaim(x, y)) continue;
        const s = borderScore(x, y, c); if (s > bs) { bs = s; best = { x, y }; }
      }
    }
    if (!best || bs < -1e7) { G.borderPts = Math.min(G.borderPts, borderStep()); break; }
    G.borderPts -= borderStep();
    G.tiles.owner[idx(best.x, best.y)] = 0; n++;
    for (const f of G.factions) if (countAround(best.x, best.y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === f.id)) f.relation -= 0.3;
  }
  if (n) { recountTiles(); R.territoryDirty = true; G.borderWeek = (G.borderWeek || 0) + n; }
  if (G.time.day % 7 === 0 && G.borderWeek) { addLog(`🗺️ Your borders grew by ${G.borderWeek} tile${G.borderWeek > 1 ? 's' : ''} this week.`, 'info'); G.borderWeek = 0; }
}

// ---------- Colonies ----------
B.colony = { name: 'Colony', cat: null, icon: '🏕️', cost: { wood: 40, food: 30 }, maxLevel: 3, levelNames: ['Frontier Camp', 'Settlement', 'Colony Town'], storage: 60, roof: '#8d6e63', appeal: 1, appealR: 1,
  desc: 'A settlement founded by your pioneers. It is a road hub, stores goods, and your borders grow around it. Upgrade it to widen its reach.' };
ROAD_HUBS.add('colony');
function expCost() { const n = countB('colony') + (G.expeditions || []).length; return { food: 40 + 20 * n, wood: 50 + 15 * n, gold: 25 + 25 * n }; }
function pickSettlers() {
  const pool = G.kin.filter(k => canWork(k) && !k.soldier && !k.away && k.age < 55);
  if (pool.length < 7) return [];
  const score = k => (k.traits.includes('brave') ? 3 : 0) + (k.traits.includes('curious') ? 2 : 0) + (k.traits.includes('hardworking') ? 1 : 0) - (k.traits.includes('timid') ? 3 : 0) + (k.asp === 'hero' ? 2 : 0) - childrenOf(k).filter(c => !isAdult(c)).length * 3;
  pool.sort((a, b) => score(b) - score(a));
  const out = [pool[0]];
  const p = pool[0].partner && kinById(pool[0].partner); if (p && pool.includes(p)) out.push(p);
  for (const k of pool) { if (out.length >= 3) break; if (!out.includes(k) && !(k.partner && !pool.includes(kinById(k.partner)))) out.push(k); }
  return out.slice(0, 3);
}
// scout a site: what's around it, and whether it can be reached
function siteScout(x, y) {
  if (!inB(x, y)) return { ok: false, reason: 'Off the map' };
  const i = idx(x, y), t = G.tiles.terrain[i], o = G.tiles.owner[i];
  if (o === 0) return { ok: false, reason: 'Already your land — build here or claim land around it' };
  if (o > 0) return { ok: false, reason: 'Someone already lives here' };
  if (!TERRAIN[t].build || G.tiles.special[i] === 5) return { ok: false, reason: `Can't settle on ${G.tiles.special[i] === 5 ? 'a ford' : TERRAIN[t].name}` };
  const dHome = Math.round(settleDist(x, y));
  if (dHome < 7) return { ok: false, reason: 'Too close to your settlements — claim land here instead (colonies need 7+ tiles of distance)' };
  if (!reachable(idx(G.cap.x, G.cap.y), i)) return { ok: false, reason: 'No land route — bridge the water or find a ford first' };
  const c = { farm: 0, forest: 0, hills: 0, mtn: 0, water: 0, foreign: 0, ford: 0, pass: 0 }, veins = {};
  let near = null, nd = 99;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || Math.hypot(dx, dy) > 3.2) continue;
    const j = idx(nx, ny), tt = G.tiles.terrain[j], ow = G.tiles.owner[j];
    if (tt === T.GRASS || tt === T.MEADOW) c.farm++; else if (tt === T.FOREST) c.forest++; else if (tt === T.HILLS) c.hills++; else if (tt === T.MOUNTAIN) c.mtn++; else if (tt === T.WATER || tt === T.DEEP) c.water++;
    const sp = G.tiles.special[j]; if (sp && VEINS[sp]) veins[sp] = (veins[sp] || 0) + 1;
    if (sp === 5) c.ford++;
    if (ow > 0) { c.foreign++; const d = Math.hypot(dx, dy); if (d < nd) { nd = d; near = ow; } }
    if (Math.hypot(dx, dy) <= 2 && tileFeatures(nx, ny).some(s => s.includes('chokepoint'))) c.pass++;
  }
  const notes = [];
  let score = c.farm * 0.5 + c.forest * 0.35 + c.hills * 0.45 + Math.min(4, c.mtn) * 0.3;
  if (c.farm) notes.push(`🌾 ${c.farm} tiles of farmland`); if (c.forest) notes.push(`🌲 ${c.forest} forest`); if (c.hills) notes.push(`⛰️ ${c.hills} hills`); if (c.mtn) notes.push(`🏔️ mountains nearby (mines)`);
  for (const sp in veins) { notes.push(`${VEINS[sp].icon} ${VEINS[sp].name}`); score += 4; }
  if (c.water) { notes.push('🌊 Waterside: fisheries and harbours'); score += 2; }
  if (c.ford) { notes.push('🏞️ Commands a river ford'); score += 4; }
  if (c.pass) { notes.push('🚧 Guards a chokepoint (pass or narrow crossing)'); score += 4; }
  if (t === T.HILLS) { notes.push('🛡️ Built on high ground'); score += 2; }
  if (near) { const f = fac(near); if (f) { notes.push(`⚠️ Next to ${esc(f.name)} — they will not be pleased`); score -= 3; } }
  const days = Math.max(1, Math.round(dHome / 1.4 / 24 * 10) / 10);
  const hrs = Math.round(dist(G.cap.x, G.cap.y, x, y) * 1.3 / 1.3), trip = hrs < 24 ? `${Math.max(2, hrs)} hours` : `${Math.round(hrs / 24 * 10) / 10} days`;
  notes.push(`🚶 ${dHome} tiles from your nearest settlement · the trip from your capital takes about ${trip}`);
  const stars = score >= 14 ? 3 : score >= 8 ? 2 : 1;
  return { ok: true, notes, score, stars, dHome, days };
}
function colonyName() { const used = new Set(Object.values(G.buildings).filter(b => b.colonyName).map(b => b.colonyName).concat((G.villages || []).map(v => v.name))); const n = VILLAGE_NAMES.filter(v => !used.has(v)); return n.length ? pick(n) : pick(['New ', 'Fort ', 'Port ', 'Upper ']) + pick(VILLAGE_NAMES); }
function startExpedition(x, y) {
  const si = siteScout(x, y); if (!si.ok) { toast(si.reason); return false; }
  const cost = expCost(); if (!canAfford(cost)) { toast(`An expedition needs ${costStr(cost)}`); return false; }
  const party = pickSettlers(); if (!party.length) { toast('You need at least 7 able adults to spare three pioneers'); return false; }
  const path = findPath(G.cap.x, G.cap.y, x, y, true); if (!path) { toast('No route there'); return false; }
  why('Expeditions', pay, cost);
  const e = { id: G.nextA++, kin: party.map(k => k.id), x: G.cap.x, y: G.cap.y, path, pi: 0, tx: x, ty: y, name: colonyName(), wait: 0 };
  for (const k of party) { setJob(k, null); k.away = true; k.expedition = e.id; k.dest = null; k.path = null; }
  (G.expeditions = G.expeditions || []).push(e);
  addLog(`🏕️ ${party.map(k => k.name).join(', ')} set out to found ${e.name}.`, 'good');
  autoAssignJobs(); return true;
}
function moveExpeditions(dtH) {
  if (!G.expeditions || !G.expeditions.length) return;
  for (const e of G.expeditions) {
    if (e.wait > 0) { e.wait -= dtH; continue; }
    const ci = idx(clamp(Math.round(e.x), 0, MAP_W - 1), clamp(Math.round(e.y), 0, MAP_H - 1));
    let step = 1.3 * dtH * (G.tiles.road[ci] && G.tiles.road[ci] !== 3 ? 1.8 : 1);
    while (step > 0 && e.pi < e.path.length) {
      const ti = e.path[e.pi], gx = ti % MAP_W, gy = (ti / MAP_W) | 0, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
      if (d <= step) { e.x = gx; e.y = gy; step -= d; e.pi++; } else { e.x += dx / d * step; e.y += dy / d * step; step = 0; }
    }
    if (!e.peril && e.pi > e.path.length / 2 && e.path.length > 12) { e.peril = true; if (Math.random() < 0.3) queueEvent('expeditionPeril', { id: e.id }); }
    if (e.pi >= e.path.length) foundColony(e);
  }
  G.expeditions = G.expeditions.filter(e => !e.done);
}
function foundColony(e) {
  e.done = true;
  const party = e.kin.map(kinById).filter(Boolean);
  let tx = e.tx, ty = e.ty;
  const free = (x, y) => inB(x, y) && G.tiles.owner[idx(x, y)] === -1 && TERRAIN[G.tiles.terrain[idx(x, y)]].build && G.tiles.special[idx(x, y)] !== 5;
  if (!free(tx, ty)) { let f = null; for (let r = 1; r <= 4 && !f; r++) for (let dy = -r; dy <= r && !f; dy++) for (let dx = -r; dx <= r && !f; dx++) if (free(tx + dx, ty + dy)) f = { x: tx + dx, y: ty + dy }; if (f) { tx = f.x; ty = f.y; } else tx = -1; }
  if (tx < 0 || !party.length) {
    for (const k of party) { k.away = false; k.expedition = null; k.x = G.cap.x; k.y = G.cap.y; }
    addLog(`🏕️ The pioneers found the land around ${e.name} already taken and came home.`, 'bad'); assignHousing(); autoAssignJobs(); return;
  }
  claimAround(0, tx, ty, 2.6);
  const col = placeBuilding('colony', tx, ty, true).b; col.colonyName = e.name; col.founded = G.time.day;
  let hut = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1]]) { const x = tx + dx, y = ty + dy; if (inB(x, y) && G.tiles.owner[idx(x, y)] === 0 && TERRAIN[G.tiles.terrain[idx(x, y)]].build && !G.tiles.bld[idx(x, y)]) { hut = placeBuilding('hut', x, y, true).b; break; } }
  for (const k of party) { k.away = false; k.expedition = null; k.x = tx; k.y = ty; k.state = 'idle'; k.dest = null; if (hut) k.home = hut.id; remember(k, `Founded the colony of ${e.name}`, '🏕️'); addMod('Pioneers of a new land', 12, 6, k.id); }
  for (const f of G.factions) if (!f.dead && f.tiles && countAround(tx, ty, 6, (x, y) => G.tiles.owner[idx(x, y)] === f.id) > 3) { f.relation -= 6; addLog(`😒 ${f.name} is wary of your new colony on their doorstep.`, 'bad'); }
  history(`${G.realm.name} founded the colony of ${e.name}.`, '🏕️');
  addLog(`🏕️ ${party.map(k => k.name).join(', ')} founded the colony of ${e.name}!`, 'good');
  recountTiles(); R.territoryDirty = true; pathsDirty(); netDirty(); assignHousing(); autoAssignJobs();
  if (!window.BOT_ACTIVE) R.flyTo(tx, ty);
}
Object.assign(EVENTS, {
  expedition: {
    random: false,
    make: d => {
      const si = siteScout(d.x, d.y); if (!si.ok) { toast(si.reason); return null; }
      const party = pickSettlers(), cost = expCost();
      if (!party.length) { toast('You need at least 7 able adults to spare three pioneers'); return null; }
      return { title: `🏕️ Found a Colony ${'★'.repeat(si.stars)}`, icon: '🏕️', tiles: [{ x: d.x, y: d.y }],
        text: `Your scouts report on the site:<ul class="scout">${si.notes.map(n => `<li>${n}</li>`).join('')}</ul>Volunteers: ${party.map(kinChip).join(' ')}<br><small>They will walk there and found a Frontier Camp that claims the land around it. Your borders then grow around the colony too.</small>`,
        choices: [
          { label: `Send the pioneers — ${costStr(cost)}`, tip: 'They leave their jobs and set out now.', disabled: !canAfford(cost), fn: () => startExpedition(d.x, d.y) },
          { label: 'Not now', fn: () => {} },
        ] };
    },
  },
  expeditionPeril: {
    random: false,
    make: d => {
      const e = (G.expeditions || []).find(o => o.id === d.id); if (!e) return null;
      const what = pick(['A pack of wolves is stalking the wagon', 'Bandits are watching the road ahead', 'A storm has washed out the trail', 'The pioneers have lost their way in the wilds']);
      return { title: '🏕️ Trouble on the Road', icon: '🐺', tiles: [{ x: Math.round(e.x), y: Math.round(e.y) }], text: `${what}. The expedition to ${e.name} needs your call.`,
        choices: [
          { label: 'Press on', tip: '60%: no harm done. Otherwise a pioneer is hurt.', fn: () => { if (Math.random() < 0.4) { const k = kinById(pick(e.kin)); if (k) { k.health -= 35; remember(k, 'Was hurt on the road to ' + e.name, '🩹'); addLog(`🩹 ${k.name} was hurt on the way to ${e.name}.`, 'bad'); } } } },
          { label: 'Hire a local guide', tip: '15 gold: safe passage.', disabled: G.res.gold < 15, fn: () => { G.res.gold -= 15; } },
          { label: 'Wait it out', tip: 'Safe, but the trip takes a day longer.', fn: () => { e.wait = 24; } },
        ] };
    },
  },
});
EVENT_MAJOR.add('expeditionPeril');
Object.assign(EVENT_AUTO, { expeditionPeril: [1, 2], expedition: [1] });

// ---------- Drawing ----------
function drawColony(c, b, px, py, L, roof) {
  // palisade ring
  c.fillStyle = 'rgba(121,85,72,0.25)'; rrect(c, px + 1.5, py + 3, 29, 27, 6); c.fill();
  c.fillStyle = '#8d6e63'; for (let i = 0; i < 9; i++) { c.fillRect(px + 2 + i * 3.4, py + 27, 2, 4); c.fillRect(px + 2 + i * 3.4, py + 3, 2, 3.5); }
  if (L === 1) {
    for (const [tx, ty, col] of [[8, 18, '#efe6d0'], [20, 13, '#e0d2b4']]) { c.fillStyle = col; c.beginPath(); c.moveTo(px + tx - 6, py + ty + 6); c.lineTo(px + tx, py + ty - 5); c.lineTo(px + tx + 6, py + ty + 6); c.fill(); c.fillStyle = '#6d4c41'; c.beginPath(); c.moveTo(px + tx - 1.5, py + ty + 6); c.lineTo(px + tx, py + ty + 1); c.lineTo(px + tx + 1.5, py + ty + 6); c.fill(); }
    c.fillStyle = '#5d4037'; c.fillRect(px + 21, py + 23, 6, 1.5); c.fillStyle = `rgba(255,${150 + Math.sin(R.t * 8) * 40 | 0},40,0.9)`; c.beginPath(); c.arc(px + 24, py + 22, 1.8, 0, 7); c.fill();
  } else {
    c.fillStyle = '#a1887f'; c.fillRect(px + 5, py + 13, 18, 12); c.strokeStyle = '#6d4c41'; c.lineWidth = 0.8; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(px + 5, py + 15 + i * 3); c.lineTo(px + 23, py + 15 + i * 3); } c.stroke();
    c.fillStyle = roof; c.beginPath(); c.moveTo(px + 3, py + 14); c.lineTo(px + 14, py + 6); c.lineTo(px + 25, py + 14); c.fill();
    c.fillStyle = '#3e2723'; c.fillRect(px + 12, py + 19, 4, 6);
    if (L >= 3) { c.fillStyle = '#9e9890'; c.fillRect(px + 24, py + 5, 6, 20); c.fillStyle = '#b5afa6'; for (let i = 0; i < 2; i++) c.fillRect(px + 23.5 + i * 3.6, py + 3, 2.4, 2.6); }
  }
  flag(c, px + 27, py - 4, 13, G.realm.color, b.id);
}
function drawExpeditions(c) {
  for (const e of G.expeditions || []) {
    const px = e.x * TILE + 16, py = e.y * TILE + 18;
    if (e.pi < e.path.length) { c.strokeStyle = 'rgba(255,255,255,0.45)'; c.setLineDash([3, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(px, py); for (let i = e.pi; i < e.path.length; i += 2) { const t = e.path[i]; c.lineTo((t % MAP_W) * TILE + 16, ((t / MAP_W) | 0) * TILE + 16); } c.stroke(); c.setLineDash([]); }
    const bob = Math.sin(R.t * 6 + e.id) * 0.6;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(px, py + 6, 9, 3, 0, 0, 7); c.fill();
    c.fillStyle = '#795548'; c.fillRect(px - 8, py - 1 + bob, 16, 4);
    c.fillStyle = '#f5f0e1'; c.beginPath(); c.moveTo(px - 8, py - 1 + bob); c.quadraticCurveTo(px, py - 14 + bob, px + 8, py - 1 + bob); c.fill(); c.strokeStyle = '#bcaaa4'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = '#3e2723'; c.beginPath(); c.arc(px - 5, py + 4, 2.4, 0, 7); c.arc(px + 5, py + 4, 2.4, 0, 7); c.fill();
    flag(c, px + 7, py - 16 + bob, 8, G.realm.color, e.id);
    c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(`🏕️ ${e.name}`, px + 1, py + 17); c.fillStyle = '#fff'; c.fillText(`🏕️ ${e.name}`, px, py + 16);
  }
}
// tool overlays: claim blocks and colony sites
function drawExpandOverlay(c) {
  const tool = UI.tool, hv = R.hover; if (!hv || !inB(hv.x, hv.y)) return;
  if (tool.kind === 'claim' && (UI.claimSize || 1) > 1) {
    const bi = blockInfo(hv.x, hv.y, UI.claimSize), okc = bi.ok && G.res.influence >= bi.cost;
    c.fillStyle = okc ? 'rgba(255,255,255,0.28)' : 'rgba(255,80,80,0.22)'; for (const t of bi.tiles) c.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
    const h = (UI.claimSize - 1) >> 1; c.strokeStyle = okc ? '#fff' : '#ef9a9a'; c.lineWidth = 2; c.strokeRect((hv.x - h) * TILE, (hv.y - h) * TILE, UI.claimSize * TILE, UI.claimSize * TILE);
  }
  if (tool.kind === 'colony') {
    const si = siteScout(hv.x, hv.y);
    c.strokeStyle = si.ok ? ['', '#ffe082', '#c5e1a5', '#81c784'][si.stars] : 'rgba(239,83,80,0.8)'; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.beginPath(); c.arc(hv.x * TILE + 16, hv.y * TILE + 16, 2.6 * TILE, 0, 7); c.stroke(); c.setLineDash([]);
    c.strokeRect(hv.x * TILE + 1, hv.y * TILE + 1, TILE - 2, TILE - 2);
    // show fords and chokepoints nearby so good sites stand out
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = hv.x + dx, y = hv.y + dy; if (!inB(x, y)) continue; const f = tileFeatures(x, y).find(s => s.includes('ford') || s.includes('chokepoint')); if (f) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText(f.startsWith('🏞️') ? '🏞️' : '🚧', x * TILE + 16, y * TILE + 21); } }
  }
}
function expandHover(t) {
  const tool = UI.tool;
  if (tool.kind === 'claim') {
    const s = UI.claimSize ?? 1, feat = tileFeatures(t.x, t.y).join(' · ');
    if (s === 0) return '<small>Drag a rectangle over the land you want, then confirm. Bigger areas get a bulk discount.</small>';
    if (s === 1) return canClaim(t.x, t.y) ? `🚩 Claim for ${claimCost(t.x, t.y)} 👑 <small>(${TERRAIN[terr(t.x, t.y)].name}${settleDist(t.x, t.y) > 5 ? `, ${Math.round(settleDist(t.x, t.y))} tiles from a settlement` : ''})</small>${feat ? `<br><small>${feat}</small>` : ''}` : '<small>Click unclaimed tiles bordering your land</small>';
    const bi = blockInfo(t.x, t.y, s);
    return bi.ok ? `🚩 Claim ${bi.tiles.length} tiles for ${bi.cost} 👑 <small>(−${Math.round((1 - bi.disc) * 100)}% for a ${s}×${s} block)</small>` : '<small>The block must touch your land</small>';
  }
  if (tool.kind === 'colony') {
    const si = siteScout(t.x, t.y);
    if (!si.ok) return `<span class="neg">✗ ${si.reason}</span>`;
    return `🏕️ Colony site ${'★'.repeat(si.stars)}<br><small>${si.notes.join('<br>')}</small><br>Click to send pioneers — ${costStr(expCost())}`;
  }
  return null;
}
function expandMenu() {
  if (UI.tool.kind === 'claim') {
    const s = UI.claimSize ?? 1;
    return `<div class="bm-title">🚩 Claim land with influence — click or drag. Bigger blocks are cheaper per tile. Rough terrain and land far from your settlements costs more.</div><div class="cards">` +
      [[0, '⬚', 'Drag an area', 'up to −35%'], [1, '▪', 'Single tile', ''], [3, '▦', '3×3 block', '−15%'], [5, '⬛', '5×5 block', '−30%']].map(([n, i, nm, d]) => `<div class="card ${s === n ? 'on' : ''}" data-act="claimsize" data-arg="${n}"><div class="ci">${i}</div><div class="cn">${nm}</div><div class="cc">${d || 'per tile'}</div></div>`).join('') +
      `<div class="card ${G.settings.autoBorders !== false ? 'on' : ''}" data-act="autoborders" data-tip="Your borders spread by themselves around your capital, cities and colonies, following valleys and plains and stopping at mountains and the sea."><div class="ci">🗺️</div><div class="cn">Borders grow</div><div class="cc">${G.settings.autoBorders !== false ? `~${(borderRate() / borderStep() * 7).toFixed(1)} tiles/week` : 'off'}</div></div></div>`;
  }
  const ex = (G.expeditions || []);
  return `<div class="bm-title">🏕️ Expedition — click a spot in the wilds to scout it, then send three pioneers to found a colony there. Look for farmland, ore, river fords and mountain passes. Next expedition: ${costStr(expCost())}</div><div class="dim" style="padding:2px 8px">${ex.length ? 'On the road: ' + ex.map(e => `🏕️ ${esc(e.name)} (${Math.round(e.pi / Math.max(1, e.path.length) * 100)}%)`).join(', ') : `Colonies founded: ${countB('colony')}`}</div>`;
}

// rivals and villages keep their road networks up to date
function dailyWorldRoads() {
  for (const f of G.factions) if (!f.dead && (G.time.day + f.id) % 15 === 0) aiBuildRoads(f);
  for (const v of G.villages || []) if (!v.dead && (G.time.day + v.id) % 25 === 0) aiBuildRoads(v);
}

// ---------- Unrest in your cities: big, distant, conquered or neglected cities may rise up ----------
function cityConnected(b) {
  // is there a road from the capital's door to this city?
  const th = townhall(); if (!th) return false;
  const rd = G.tiles.road, seen = new Uint8Array(rd.length), q = [];
  for (const [dx, dy] of N4) { const x = th.x + dx, y = th.y + dy; if (inB(x, y) && rd[idx(x, y)]) { seen[idx(x, y)] = 1; q.push(idx(x, y)); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    if (Math.abs(x - b.x) + Math.abs(y - b.y) === 1) return true;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (rd[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
  }
  return false;
}
function cityUnrestFactors(c) {
  const b = G.buildings[c.bid]; if (!b) return [];
  const f = [], th = townhall(), d = th ? dist(th.x, th.y, b.x, b.y) : 0, am = avgMood();
  f.push(['A proud, growing city', 0.15 * b.level]);
  if (d > 10) f.push(['Far from the capital', 0.025 * (d - 10)]);
  { const g = cityGrievance(c); if (g > 0) f.push(['Resents the conquest', 0.6 + g * 0.02]); }
  if (am < 55) f.push(['Your realm is unhappy', (55 - am) * 0.03]); else if (am > 70) f.push(['Your realm prospers', -0.3]);
  if (fx('tribute') > 0) f.push(['Heavy tribute', 0.25]);
  if (G.policies.tax === 'high') f.push(['High taxes', 0.3]); else if (G.policies.tax === 'low') f.push(['Low taxes', -0.2]);
  if (c.levies) f.push(['Garrison keeps order', -Math.min(cityLoyalLevies(c) ? 1 : 0.4, 0.1 * c.levies)]);
  if (G.time.day % 5 === 0 || c._conn === undefined) c._conn = cityConnected(b);
  f.push(c._conn ? ['Road to the capital', -0.35] : ['No road to the capital', 0.2]);
  const calm = Object.values(G.buildings).filter(o => (o.type === 'temple' || o.type === 'amphitheater' || o.type === 'stadium') && dist(o.x, o.y, b.x, b.y) <= 6).length;
  if (calm) f.push(['Temples and theatres nearby', -Math.min(0.75, 0.25 * calm)]);
  if (c.concession > G.time.day) f.push(['Your concessions', -0.6]);
  if (c.resent > G.time.day) f.push(['Bitter about the crackdown', 0.3]);
  if (anyWar()) f.push(['The realm is at war', 0.2]);
  if (G.festival > 0) f.push(['Festival!', -1]);
  f.push(['Settling into the realm', -0.2]);
  return f;
}
function dailyCityUnrest() {
  for (const c of cities()) {
    if (c.unrest === undefined) c.unrest = c.origin === 'taken' ? 25 : 5;
    const before = c.unrest, s = cityUnrestFactors(c).reduce((a, x) => a + x[1], 0);
    c.unrest = clamp(c.unrest + s, 0, 100);
    if (before < 50 && c.unrest >= 50) addLog(`📢 Unrest is growing in ${c.name} (${Math.round(c.unrest)}/100). Check the city to see why.`, 'bad');
    if (c.unrest >= 75 && c.unrest < 100 && G.time.day >= (c.askedDay || 0) && !G.eventQueue.some(e => e.key === 'cityUnrest')) { c.askedDay = G.time.day + 12; queueEvent('cityUnrest', { bid: c.bid }); }
    if (c.unrest >= 100 && !c.rebelling) { c.rebelling = true; queueEvent('rebellion', { bid: c.bid }); }
  }
}
function rebelStrength(c) { const b = G.buildings[c.bid]; return (4 + (b ? b.level : 1) * 3 + G.kin.length * 0.04 + (c.pop || 0) * 0.3 + cityGrievance(c) * 0.12) * ERA_MIL[curEra()] + (cityLoyalLevies(c) ? 0 : levyPower(c)); }
// the city breaks away: its land, people and buildings go with it
function citySecede(c, mode) {
  const b = G.buildings[c.bid]; if (!b) return;
  const others = settleCenters().filter(o => o.b !== b);
  const part = [];
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = b.x + dx, y = b.y + dy; if (!inB(x, y) || Math.hypot(dx, dy) > 7) continue;
    const i = idx(x, y); if (G.tiles.owner[i] !== 0) continue;
    const d = Math.hypot(dx, dy); if (others.some(o => dist(o.x, o.y, x, y) < d)) continue;
    part.push(i);
  }
  const f = makeFaction({ x: b.x, y: b.y, era: curEra(), troops: Math.round(4 + c.levies + b.level * 3), personality: 'proud' });
  f.name = `Free ${c.name}`; f.rebel = true; f.color = '#b71c1c';
  const set = new Set(part); let lost = 0, gone = 0;
  for (const o of Object.values(G.buildings)) {
    if (o === b || !set.has(idx(o.x, o.y)) || o.type === 'townhall') continue;
    const inv = { lumber: 7, quarry: 8, mine: 9, coalmine: 9, fishery: 10, granary: 11, warehouse: 12, market: 13, workshop: 14, farm: 2 };
    const dv = B[o.type].housing ? (o.level >= 3 ? 6 : 1) : inv[o.type] || (B[o.type].prod && B[o.type].prod.food ? 2 : 1);
    const i = idx(o.x, o.y);
    for (const k of G.kin.slice()) if (k.home === o.id && !k.away && !k.soldier) { removeKin(k); gone++; }
    demolish(o, true); G.tiles.deco[i] = dv; lost++;
  }
  const bi = idx(b.x, b.y); demolish(b, true); G.tiles.deco[bi] = 3;
  for (const i of part) G.tiles.owner[i] = f.id;
  G.cities = G.cities.filter(o => o !== c);
  if (mode === 'war') { f.war = true; f.warDays = 0; f.weariness = 0; f.armyTimer = randi(3, 5); f.warScore = 0; f.relation = -60; G.flags.hadWar = true; }
  else if (mode === 'vassal') { f.subjugated = true; f.relation = 20; f.unrest = 20; }
  else f.relation = -20;
  history(`${c.name} rose up against ${G.realm.name} and became ${f.name}.`, '🔥');
  addLog(`🔥 ${c.name} has broken away as <b>${f.name}</b>${mode === 'war' ? ' and is at war with you. Take their hall back to end the rebellion' : mode === 'vassal' ? ', ruling itself as your vassal' : ''}. (${part.length} tiles, ${lost} buildings, ${gone} kin)`, 'bad');
  recountTiles(); R.territoryDirty = true; pathsDirty(); netDirty(); assignHousing(); autoAssignJobs();
}
Object.assign(EVENTS, {
  cityUnrest: {
    random: false,
    make: d => {
      const b = G.buildings[d.bid], c = b && cityOf(b); if (!c || c.unrest >= 100) return null;
      const why = cityUnrestFactors(c).filter(x => x[1] > 0).sort((a, z) => z[1] - a[1]).slice(0, 3).map(x => x[0].toLowerCase());
      const gift = { gold: 20 * curEra(), food: 30 };
      return { title: `📢 Unrest in ${c.name}`, icon: '📢', tiles: [{ x: b.x, y: b.y }], text: `The people of ${c.name} are restless (${Math.round(c.unrest)}/100). They complain of ${why.join(', ') || 'everything'}. If unrest reaches 100 the city will rise up.`,
        choices: [
          { label: 'Grant concessions', tip: 'Their tribute is halved for 30 days. Unrest −20 now and falls faster.', fn: () => { c.concession = G.time.day + 30; c.unrest -= 20; } },
          { label: 'Send gifts and grain', tip: `${costStr(gift)}: unrest −30.`, disabled: !canAfford(gift), fn: () => { pay(gift); c.unrest -= 30; } },
          { label: 'Crack down', tip: 'Unrest −40, but they will resent it for a month and your realm frowns (−3 mood). Needs 2+ levies.', disabled: c.levies < 2, fn: () => { c.unrest -= 40; c.resent = G.time.day + 30; c.levies--; addMod('Harsh crackdown', -3, 5); } },
          { label: 'Ignore it', fn: () => {} },
        ] };
    },
  },
  rebellion: {
    random: false,
    make: d => {
      const b = G.buildings[d.bid], c = b && cityOf(b); if (!c) return null;
      const P = armyPower(garrison()) + (cityLoyalLevies(c) ? levyPower(c) : 0) + vets() * vetPower(), D = rebelStrength(c);
      const odds = P <= 0 ? 0 : Math.round(winChance(P, D) * 100);
      return { title: `🔥 ${c.name} Rises Up!`, icon: '🔥', tiles: [{ x: b.x, y: b.y }], text: `The people of ${c.name} have taken up arms and declared themselves free. Rebels: about ${D.toFixed(0)} strength. Your soldiers at home, veterans and the city's loyal levies: ${P.toFixed(0)}.`,
        choices: [
          { label: `Crush the rebellion (${odds}% chance)`, tip: 'Win: the city stays yours and calms down. Lose: it breaks away and fights you.', disabled: P <= 0, fn: () => {
            const win = Math.random() * 100 < odds, troops = garrison();
            const fallen = troops.filter(() => Math.random() < (win ? 0.12 : 0.3)); for (const k of fallen) killKin(k, 'the rebellion');
            c.levies = Math.max(0, Math.round(c.levies * (win ? 0.6 : 0)));
            if (win) { c.unrest = 35; c.rebelling = false; c.resent = G.time.day + 30; addMod('Rebellion crushed', -2, 4); G.stats.battlesWon++; addLog(`⚔️ The rising in ${c.name} was crushed. (${fallen.length} soldiers fell)`, 'good'); history(`${G.realm.name} crushed a rising in ${c.name}.`, '⚔️'); }
            else { addLog(`💀 Your forces were driven out of ${c.name}. (${fallen.length} soldiers fell)`, 'bad'); citySecede(c, 'war'); }
          } },
          { label: 'Grant them self-rule', tip: 'They govern themselves as your vassal: no war, a little tribute, but the land is theirs.', fn: () => citySecede(c, 'vassal') },
          { label: 'Let them go in peace', tip: 'They become an independent realm.', fn: () => citySecede(c, 'free') },
        ] };
    },
  },
});
EVENT_MAJOR.add('cityUnrest'); EVENT_MAJOR.add('rebellion');
Object.assign(EVENT_AUTO, { cityUnrest: [1, 0], rebellion: [0, 1] });
function cityUnrestHtml(c) {
  const fs = cityUnrestFactors(c), s = fs.reduce((a, x) => a + x[1], 0), u = Math.round(c.unrest || 0);
  return `<div class="kv">Unrest ${u}/100 <small class="${s > 0 ? 'neg' : 'pos'}">${s > 0 ? '▲ rising' : '▼ falling'} ${Math.abs(s).toFixed(1)}/day</small></div>${bar(u, u >= 75 ? '#e53935' : u >= 50 ? '#ffa726' : '#66bb6a')}<div class="mods">${fs.filter(x => Math.abs(x[1]) >= 0.05).map(([n, v]) => `<span class="${v > 0 ? 'neg' : 'pos'}">${n} ${v > 0 ? '+' : ''}${v.toFixed(2)}</span>`).join('')}</div>`;
}

// ---------- Buying land by dragging out an area ----------
function areaInfo(r) {
  const x0 = Math.min(r.x0, r.x1), x1 = Math.min(Math.max(r.x0, r.x1), x0 + 19), y0 = Math.min(r.y0, r.y1), y1 = Math.min(Math.max(r.y0, r.y1), y0 + 19);
  const tiles = [], kinds = {}; let any = false, sum = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inB(x, y)) continue; const i = idx(x, y);
    if (G.tiles.owner[i] !== -1 || G.tiles.terrain[i] === T.DEEP) continue;
    tiles.push({ x, y }); sum += claimCost(x, y); if (canClaim(x, y)) any = true;
    const nm = G.tiles.special[i] === 5 ? 'River Ford' : TERRAIN[G.tiles.terrain[i]].name; kinds[nm] = (kinds[nm] || 0) + 1;
  }
  const n = tiles.length, disc = n >= 60 ? 0.35 : n >= 25 ? 0.3 : n >= 9 ? 0.15 : 0;
  return { ok: any && n > 0, tiles, kinds, cost: Math.ceil(sum * (1 - disc)), disc, rect: { x0, y0, x1, y1 } };
}
function areaDeal(r) {
  const ai = areaInfo(r);
  if (!ai.ok) return toast(ai.tiles.length ? 'The area must touch your land' : 'Nothing to claim there');
  queueEvent('landDeal', r); showNextEvent();
}
EVENTS.landDeal = {
  random: false,
  make: r => {
    const ai = areaInfo(r); if (!ai.ok) return null;
    return { title: `🚩 Claim ${ai.tiles.length} Tiles`, icon: '🗺️', tiles: ai.tiles,
      text: `${Object.entries(ai.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ')}.<br>Cost: <b>${ai.cost} 👑</b>${ai.disc ? ` (−${Math.round(ai.disc * 100)}% for buying in bulk)` : ''} · you have ${Math.floor(G.res.influence)} 👑`,
      choices: [
        { label: `Claim them — ${ai.cost} 👑`, disabled: G.res.influence < ai.cost, fn: () => {
          G.res.influence -= ai.cost; track('influence', -ai.cost);
          for (const t of ai.tiles) G.tiles.owner[idx(t.x, t.y)] = 0;
          G.stats.claimed += ai.tiles.length; recountTiles(); R.territoryDirty = true;
          for (const f of G.factions) if (ai.tiles.some(t => countAround(t.x, t.y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === f.id))) f.relation -= f.personality === 'expansionist' ? 5 : 2;
          addLog(`🚩 Claimed ${ai.tiles.length} tiles.`, 'good');
        } },
        { label: 'Cancel', fn: () => {} },
      ] };
  },
};
function drawAreaRect(c) {
  const r = UI.claimRect; if (!r) return;
  const ai = areaInfo(r), ok = ai.ok && G.res.influence >= ai.cost, R0 = ai.rect;
  c.fillStyle = ok ? 'rgba(255,255,255,0.28)' : 'rgba(255,80,80,0.22)'; for (const t of ai.tiles) c.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
  c.strokeStyle = ok ? '#fff' : '#ef9a9a'; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(R0.x0 * TILE, R0.y0 * TILE, (R0.x1 - R0.x0 + 1) * TILE, (R0.y1 - R0.y0 + 1) * TILE); c.setLineDash([]);
  const label = `${ai.tiles.length} tiles · ${ai.cost} 👑`;
  c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; const lx = (R0.x0 + R0.x1 + 1) / 2 * TILE, ly = R0.y0 * TILE - 6, w = c.measureText(label).width;
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(lx - w / 2 - 5, ly - 13, w + 10, 17); c.fillStyle = ok ? '#fff' : '#ffab91'; c.fillText(label, lx, ly);
}

// ---------- Fewer walkers: one figure on the map stands for about ten people ----------
function isAvatar(k) {
  const m = (G.settings && G.settings.crowd) || 'some';
  if (R.selected && R.selected.kind === 'k' && R.selected.id === k.id) return true;
  return m === 'all' ? true : m === 'none' ? false : k.id % 10 === 0;
}
