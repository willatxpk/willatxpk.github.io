// ===== Planning & war: fair battle odds, rallied armies, veterans, subjects, bulk upgrades, box moves, road links and power lines =====

// ---------- Battle odds: the stronger side usually wins, and the bigger the gap the surer it is ----------
// 1:1 → 50%, 1.5:1 → 71%, 2:1 → 82%, 3:1 → 92%, 6:1 → 98%
function winChance(P, D) { if (P <= 0) return 0; if (D <= 0) return 0.995; const a = Math.pow(P, 2.2), b = Math.pow(D, 2.2); return clamp(a / (a + b), 0.01, 0.995); }
function pctStr(p) { return Math.round(p * 100) + '%'; }
function oddsClass(p) { return p >= 0.75 ? 'pos' : p >= 0.45 ? '' : 'neg'; }
// a lopsided fight isn't worth a tactics screen
function wantTactical(P, D) { const w = winChance(P, D); return w > 0.04 && w < 0.96; }
function lossShare(win, P, D) { return win ? Math.min(0.45, 0.3 * D / Math.max(1, P)) : clamp(0.3 + 0.3 * D / (P + D), 0.3, 0.6); }

// ---------- Veterans: garrisons you capture join your army ----------
function vetPower() { return armyMult() * 0.95; }
function vets() { return Math.max(0, Math.floor(G.vets || 0)); }
function addVets(n) { n = Math.round(n); if (n <= 0) return 0; G.vets = (G.vets || 0) + n; return n; }

// ---------- Rallying troops from your cities, vassals and veterans ----------
function rallyOn(k) { if (!UI.rally) UI.rally = { cities: true, vassals: true, vets: true }; return UI.rally[k] !== false; }
function rallySources(all) {
  const out = [];
  if ((all || rallyOn('vets')) && vets() > 0) out.push({ kind: 'vet', n: vets(), pow: vetPower(), name: 'Veterans' });
  if (all || rallyOn('cities')) for (const c of cities()) { const n = c.levies - 1; if (n >= 1) out.push({ kind: 'levy', bid: c.bid, n, pow: levyPower(c) / Math.max(1, c.levies), name: c.name }); }
  if (all || rallyOn('vassals')) for (const f of G.factions) if (f.subjugated && !f.dead) { const n = Math.floor(f.troops * 0.6); if (n >= 1) out.push({ kind: 'vassal', fid: f.id, n, pow: f.quality, name: f.name }); }
  return out;
}
function extrasPower(ex) { return (ex || []).reduce((s, e) => s + e.n * e.pow, 0); }
function extrasN(ex) { return (ex || []).reduce((s, e) => s + e.n, 0); }
function armyN(a) { return a.kin.length + extrasN(a.extra); }
// everything that would march if you attacked now
function fieldForce(count) {
  const kin = garrison().sort((a, b) => soldierPower(b) - soldierPower(a)).slice(0, count == null ? 1e9 : count);
  const ex = rallySources(), kp = armyPower(kin), xp = extrasPower(ex);
  return { kin, ex, kp, xp, P: kp + xp, n: kin.length + extrasN(ex) };
}
function musterExtras(ex) {
  for (const e of ex) {
    if (e.kind === 'vet') G.vets = Math.max(0, (G.vets || 0) - e.n);
    else if (e.kind === 'levy') { const c = G.cities.find(c => c.bid === e.bid); if (c) c.levies = Math.max(0, c.levies - e.n); }
    else if (e.kind === 'vassal') { const f = fac(e.fid); if (f) { f.troops = Math.max(0, f.troops - e.n); f.unrest = (f.unrest || 0) + 3; } }
  }
  return ex.map(e => ({ ...e }));
}
function returnExtras(a) {
  for (const e of a.extra || []) {
    if (e.n <= 0) continue;
    if (e.kind === 'levy') { const c = cities().find(c => c.bid === e.bid); if (c) { c.levies += e.n; continue; } }
    if (e.kind === 'vassal') { const f = fac(e.fid); if (f && !f.dead && f.subjugated) { f.troops += e.n; continue; } }
    G.vets = (G.vets || 0) + e.n; // their city or realm is gone: they stay with your army
  }
  a.extra = [];
}
function loseExtras(a, frac) {
  let lost = 0;
  for (const e of a.extra || []) { let l = Math.floor(e.n * frac); if (Math.random() < e.n * frac - l) l++; l = Math.min(e.n, l); e.n -= l; lost += l; }
  return lost;
}
function fieldForceHtml() {
  const ff = fieldForce(), all = rallySources(true);
  const cnt = k => extrasN(all.filter(e => e.kind === k)), pw = k => extrasPower(all.filter(e => e.kind === k));
  const lab = { vet: 'veterans', levy: 'city levies', vassal: 'vassal troops' };
  let h = `<div class="sec">Field army <small>— what actually marches when you attack</small></div>`;
  h += `<div class="kv">Power <b>${ff.P.toFixed(0)}</b> = ${ff.kin.length} soldiers (${ff.kp.toFixed(0)})${ff.ex.length ? ' + ' + Object.entries(ff.ex.reduce((o, e) => { o[e.kind] = (o[e.kind] || 0) + e.n; return o; }, {})).map(([k, n]) => `${n} ${lab[k]}`).join(' + ') + ` (${ff.xp.toFixed(0)})` : ''}</div>`;
  const tg = (k, icon, name, tip) => `<button class="btn sm ${rallyOn(k) ? 'on' : ''}" data-act="rally" data-arg="${k}" data-tip="${tip}">${icon} ${name} ${cnt(k === 'cities' ? 'levy' : k === 'vassals' ? 'vassal' : 'vet')} <small>(+${pw(k === 'cities' ? 'levy' : k === 'vassals' ? 'vassal' : 'vet').toFixed(0)})</small></button>`;
  h += `<div class="btnrow">${tg('vets', '🎖️', 'Veterans', 'Garrisons you captured from conquered realms. They march with your soldiers.')}${tg('cities', '🏰', 'City levies', 'Each of your cities sends all but one of its levies.')}${tg('vassals', '👑', 'Vassal troops', 'Your vassal realms send 60% of their troops (it makes them a little restless).')}</div>`;
  h += `<div class="dim">Walls, towers and militia only defend at home — only the troops above march. Your chance to win grows with how much stronger you are: 1.5× their strength ≈ 71%, 2× ≈ 82%, 3× ≈ 92%, 6× ≈ 98%.</div>`;
  if (vets()) h += `<div class="kv">🎖️ ${vets()} veterans · upkeep ${(vets() * 0.25).toFixed(1)} 🪙/day <button class="btn xs" data-act="vetsdismiss" data-tip="Send half of them home to save upkeep (they become subjects).">Dismiss half</button></div>`;
  return h;
}

// ---------- Subjects: the people of conquered lands who aren't individual kin ----------
// They count toward your population, eat from your granaries, pay taxes and slowly move into town.
function subjects() { let s = G.rural || 0; for (const c of cities()) s += c.pop || 0; return Math.floor(s); }
let _subjAt = -1, _subjN = 0;
function subjectsCached() { const t = G.time.day * 24 + Math.floor(G.time.hour); if (t !== _subjAt) { _subjAt = t; _subjN = subjects(); } return _subjN; }
function rationMult() { return { meager: 0.7, normal: 1, generous: 1.35 }[G.policies.rations] || 1; }
function subjectsFood() { return subjects() * 0.5 * rationMult() * foodUseMult(); }
function spreadSubjects(n, near) {
  n = Math.round(n); if (n <= 0) return 0;
  let list = Array.isArray(near) ? near.filter(Boolean) : [];
  if (!Array.isArray(near) && near) { const c = cities().map(c => ({ c, d: dist(G.buildings[c.bid].x, G.buildings[c.bid].y, near.x, near.y) })).sort((a, b) => a.d - b.d)[0]; if (c && c.d <= 14) list = [c.c]; }
  if (!list.length) { G.rural = (G.rural || 0) + n; return n; }
  const each = n / list.length; for (const c of list) { c.pop = (c.pop || 0) + each; c.pop0 = Math.max(c.pop0 || 0, c.pop); }
  return n;
}
function cityPopCap(c) { const b = G.buildings[c.bid]; return 30 + 25 * (b ? b.level : 1) + (c.pop0 || 0) * 1.3; }
function dailySubjects() {
  const S = subjects(); if (S < 1) return;
  const eat = subjectsFood();
  _why = 'Subjects eat'; const had = G.res.food; G.res.food = Math.max(0, G.res.food - eat); track('food', -(had - G.res.food));
  const short = had < eat;
  _why = 'Subject taxes'; gain('gold', S * 0.12 * ({ low: 0.6, normal: 1, high: 1.5 }[G.policies.tax] || 1)); gain('influence', S * 0.01);
  const g = short ? -0.03 : foodDays() > 6 ? 0.004 : 0;
  for (const c of cities()) { if (!c.pop) continue; c.pop = Math.max(0, Math.min(cityPopCap(c), c.pop * (1 + g) + (g > 0 ? 0.05 : 0))); if (short) c.unrest = Math.min(100, (c.unrest || 0) + 2); }
  if (G.rural) G.rural = Math.max(0, G.rural * (1 + Math.min(0, g)));
  if (short && G.time.day % 3 === 0) addLog(`🍞 Your granaries can't feed the ${S} subjects of your cities — they are leaving and the cities grow restless.`, 'bad');
  // with spare beds, a few families move into town and become kin
  let moved = 0;
  while (moved < 2 && freeHousing() > 2 && subjects() >= 1) {
    const pools = cities().filter(c => (c.pop || 0) >= 1).sort((a, b) => b.pop - a.pop);
    const c = pools[0]; let at = G.cap;
    if (c) { c.pop -= 1; at = G.buildings[c.bid]; } else if ((G.rural || 0) >= 1) G.rural -= 1; else break;
    makeKin({ age: randi(18, 45), x: at.x, y: at.y }); moved++;
  }
  if (moved) { assignHousing(); autoAssignJobs(); }
}
function subjectsHtml() {
  const S = subjects(); if (!S) return '';
  return `<div class="kv">👥 <b>${S}</b> subjects live in your cities and countryside: they eat ${subjectsFood().toFixed(0)} 🍞/day and pay ${(S * 0.12).toFixed(0)} 🪙/day in taxes. When you have spare beds, a couple of families move into town each day.</div>`;
}

// ---------- Roads: link many buildings at once ----------
function linkBuilding(b, lv, cost) {
  if (roadLink(b).linked) return 0;
  const net = roadNet(), N = MAP_W * MAP_H, prev = new Int32Array(N).fill(-2), q = [];
  const ok = i => G.tiles.owner[i] === 0 && !G.tiles.bld[i] && TERRAIN[G.tiles.terrain[i]].pass;
  const hubNext = i => { const x = i % MAP_W, y = (i / MAP_W) | 0; return N4.some(([dx, dy]) => { if (!inB(x + dx, y + dy)) return false; const o = G.tiles.bld[idx(x + dx, y + dy)]; return o && G.buildings[o] && ROAD_HUBS.has(G.buildings[o].type) && o !== b.id; }); };
  for (const [dx, dy] of N4) { const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (ok(i)) { prev[i] = -1; q.push(i); } }
  let end = -1;
  for (let h = 0; h < q.length && h < 2500; h++) {
    const i = q[h]; if (net[i] || hubNext(i)) { end = i; break; }
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (prev[j] !== -2 || !ok(j)) continue; prev[j] = i; q.push(j); }
  }
  if (end < 0) return -1;
  const path = []; for (let i = end; i >= 0; i = prev[i]) if (!G.tiles.road[i] || (G.tiles.road[i] < lv && G.tiles.road[i] !== 3 && !net[i])) path.push(i);
  if (cost && Object.keys(cost).length) { const c = scaleCost(cost, path.length); if (!canAfford(c)) return -2; pay(c); }
  for (const i of path) { if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; gain('wood', 4); R.terrainDirty = true; } G.tiles.road[i] = lv; }
  pathsDirty();
  return path.length || 0.5;
}
function unlinkedBuildings() { return Object.values(G.buildings).filter(b => (isWorkplace(b) || B[b.type].housing) && !noDrive(b) && !roadLink(b).linked); }
function linkAll(list, free, lv) {
  lv = lv || (hasTech('masonry') ? 2 : 1);
  const type = Object.keys(ROADS).find(k => ROADS[k].level === lv) || 'path';
  const todo = (list || unlinkedBuildings()).filter(b => b && G.buildings[b.id] && (isWorkplace(b) || B[b.type].housing) && !noDrive(b)).sort((a, b) => hubDist(a) - hubDist(b));
  let linked = 0, tiles = 0, failed = 0, poor = 0;
  for (const b of todo) {
    const r = linkBuilding(b, lv, free ? null : roadCost(type));
    if (r > 0) { linked++; tiles += Math.floor(r); } else if (r === -1) failed++; else if (r === -2) { poor++; break; }
  }
  if (tiles) { R.terrainDirty = true; netDirty(); }
  return { linked, tiles, failed, poor, type };
}

// Rivals run roads out to their mines, camps and storehouses, so the land you take is already connected.
// A road may cut through one of their fields if that is the only way in.
function aiLinkSites(f, lv) {
  const fid = f.id, own = i => G.tiles.owner[i] === fid;
  const ok = i => own(i) && TERRAIN[G.tiles.terrain[i]].pass && !G.tiles.bld[i] && (!G.tiles.deco[i] || G.tiles.deco[i] === 2);
  const sites = [];
  for (let i = 0; i < G.tiles.owner.length; i++) {
    if (!own(i)) continue; const v = G.tiles.deco[i]; if (!(v >= 6)) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (N4.some(([dx, dy]) => inB(x + dx, y + dy) && G.tiles.road[idx(x + dx, y + dy)])) continue;
    sites.push(i);
  }
  let done = 0;
  for (const s of sites) {
    if (done >= 14) break;
    const sx = s % MAP_W, sy = (s / MAP_W) | 0, prev = new Map(), cost = new Map(), hp = new Heap();
    for (const [dx, dy] of N4) { const x = sx + dx, y = sy + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (ok(i)) { const c = G.tiles.deco[i] ? 3 : 1; prev.set(i, -1); cost.set(i, c); hp.push(i, c); } }
    let end = -1, it = 0;
    while (hp.size && it++ < 900) {
      const i = hp.pop(); if (G.tiles.road[i]) { end = i; break; }
      const x = i % MAP_W, y = (i / MAP_W) | 0, ci = cost.get(i);
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (!ok(j)) continue;
        const nc = ci + (G.tiles.road[j] ? 0.2 : G.tiles.deco[j] ? 3 : 1); if (cost.has(j) && cost.get(j) <= nc) continue; cost.set(j, nc); prev.set(j, i); hp.push(j, nc); }
    }
    if (end < 0) continue;
    for (let i = end; i >= 0; i = prev.get(i)) { if (G.tiles.deco[i] === 2) G.tiles.deco[i] = 0; setRoad(i, lv); }
    done++;
  }
  if (done) pathsDirty();
  return done;
}
{ const _abs = aiBuildSites; aiBuildSites = function (f, quick) { const r = _abs(f, quick); if (!quick && f && !f.dead && f.cap) aiLinkSites(f, aiRoadLevels(f.minor ? 1 : (f.era || 1)).street); return r; }; }

// ---------- Bulk upgrades ----------
function pluralName(s) { return /[^aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : /(s|sh|ch|x)$/.test(s) ? s + 'es' : s + 's'; }
function upgradable(b) { const d = B[b.type]; return b.type !== 'townhall' && d.maxLevel > 1 && b.level < d.maxLevel && b.level < maxLevelFor(b.type) && !b.ruined; }
function costTotal(c) { let s = 0; for (const r in c) s += c[r] * (TRADE_VALUE[r] || 1); return s; }
function planUpgrades(list) {
  const res = { ...G.res }, pick = [], cost = {};
  const cands = list.filter(upgradable).sort((a, b) => a.level - b.level || costTotal(upgradeCost(a)) - costTotal(upgradeCost(b)));
  for (const b of cands) {
    const c = upgradeCost(b); if (!c) continue;
    if (Object.entries(c).every(([r, v]) => (res[r] || 0) >= v)) { for (const r in c) { res[r] -= c[r]; cost[r] = (cost[r] || 0) + c[r]; } pick.push(b); }
  }
  return { pick, cost, cands };
}
function bulkUpgrade(list) {
  const p = planUpgrades(list);
  if (!p.cands.length) { toast('Nothing there can be upgraded right now'); return 0; }
  if (!p.pick.length) { toast(`Not enough resources — the cheapest upgrade costs ${costStr(upgradeCost(p.cands[0]))}`); return 0; }
  const by = {};
  why('Construction', () => { for (const b of p.pick) { pay(upgradeCost(b)); b.level++; by[b.type] = (by[b.type] || 0) + 1; } });
  _capCache = {}; refreshMults(); recomputeAppeal(); autoAssignJobs(); assignHousing(); UI.lastInspect = '';
  for (const b of p.pick.slice(0, 40)) floatText(b.x, b.y, `⬆ Lv ${b.level}`, '#ffd54f');
  const left = p.cands.length - p.pick.length;
  addLog(`⬆️ Upgraded ${p.pick.length} building${p.pick.length > 1 ? 's' : ''}: ${Object.entries(by).map(([t, n]) => `${n} ${B[t].icon} ${n > 1 ? pluralName(B[t].name) : B[t].name}`).join(', ')} — ${costStr(p.cost)}.${left ? ` ${left} more need resources.` : ''}`, 'good');
  toast(`⬆️ Upgraded ${p.pick.length}${left ? ` (${left} more need resources)` : ''}`);
  return p.pick.length;
}
function upgradeMenu() {
  const groups = {};
  for (const b of Object.values(G.buildings)) if (upgradable(b)) (groups[b.type] = groups[b.type] || []).push(b);
  let h = `<div class="bm-title">⬆️ Upgrade — click a building, <b>drag a box</b> to upgrade everything inside it, or upgrade a whole type at once (lowest levels first, as many as you can afford):</div><div class="cards">`;
  const all = Object.values(groups).flat();
  if (!all.length) return h + `</div><div class="dim">Nothing can be upgraded right now — a new age unlocks the next level.</div>`;
  const pa = planUpgrades(all);
  h += `<div class="card ${pa.pick.length ? '' : 'poor'}" data-act="upall" data-arg="*" data-tip="Upgrade every building you can afford, cheapest first. Ready: ${all.length}, affordable now: ${pa.pick.length} for ${costStr(pa.cost)}"><div class="ci">⏫</div><div class="cn">Everything</div><div class="cc">${pa.pick.length}/${all.length} now</div></div>`;
  for (const [t, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    const p = planUpgrades(list), d = B[t], lo = Math.min(...list.map(b => b.level));
    h += `<div class="card ${p.pick.length ? '' : 'poor'}" data-act="upall" data-arg="${t}" data-tip="${list.length} ${esc(list.length > 1 ? pluralName(d.name) : d.name)} can go up a level. You can afford ${p.pick.length} now: ${costStr(p.cost)}. Each costs from ${costStr(upgradeCost(p.cands[0]))}."><div class="ci">${d.icon}</div><div class="cn">${d.name} ×${list.length}</div><div class="cc">Lv ${lo}+ · ${p.pick.length} now</div></div>`;
  }
  return h + `</div>`;
}

// ---------- Box selection: drag to upgrade or move a whole block ----------
function normRect(r) { const x0 = Math.max(0, Math.min(r.x0, r.x1)), y0 = Math.max(0, Math.min(r.y0, r.y1)); return { x0, y0, x1: Math.min(MAP_W - 1, Math.max(r.x0, r.x1), x0 + 29), y1: Math.min(MAP_H - 1, Math.max(r.y0, r.y1), y0 + 29) }; }
function buildingsIn(R0) { const out = []; for (let y = R0.y0; y <= R0.y1; y++) for (let x = R0.x0; x <= R0.x1; x++) { const id = G.tiles.bld[idx(x, y)]; if (id && G.buildings[id]) out.push(G.buildings[id]); } return out; }
const UNMOVABLE = new Set(['townhall', 'outpost', 'cityhall']);
function boxDone(r) {
  const R0 = normRect(r);
  if (r.kind === 'upgrade') { const list = buildingsIn(R0); if (!list.length) return toast('No buildings in that box'); bulkUpgrade(list); if (UI.tool.kind === 'upgrade') renderBuildMenu(); return; }
  if (r.kind === 'move') {
    const bs = buildingsIn(R0).filter(b => !UNMOVABLE.has(b.type)), roads = [], wires = [], W = wireArr();
    for (let y = R0.y0; y <= R0.y1; y++) for (let x = R0.x0; x <= R0.x1; x++) {
      const i = idx(x, y); if (G.tiles.owner[i] !== 0) continue;
      if (G.tiles.road[i] && G.tiles.road[i] !== 3 && !G.tiles.bld[i]) roads.push({ x, y, lv: G.tiles.road[i] });
      if (W[i]) wires.push({ x, y });
    }
    if (!bs.length && !roads.length && !wires.length) return toast('Nothing of yours to move in that box');
    UI.tool = { kind: 'move', type: 'area', sel: { ...R0, bs: bs.map(b => b.id), roads, wires, cx: Math.floor((R0.x0 + R0.x1) / 2), cy: Math.floor((R0.y0 + R0.y1) / 2) } };
    R.canvas.style.cursor = 'grabbing'; UI.moveMemo = null; renderBuildMenu();
    toast(`↔️ Picked up ${bs.length} building${bs.length === 1 ? '' : 's'}${roads.length ? `, ${roads.length} road tiles` : ''}${wires.length ? ` and ${wires.length} power lines` : ''} — click where the middle should go`);
  }
}
function areaMoveCheck(sel, dx, dy) {
  const key = dx + ',' + dy; if (UI.moveMemo && UI.moveMemo.key === key) return UI.moveMemo.res;
  const bs = sel.bs.map(id => G.buildings[id]).filter(Boolean);
  for (const b of bs) G.tiles.bld[idx(b.x, b.y)] = 0;
  let res = { ok: true };
  for (const b of bs) {
    const x = b.x + dx, y = b.y + dy;
    const si = siteInfo(b.type, x, y, { moving: true, quick: true });
    if (!si.ok) { res = { ok: false, reason: `${B[b.type].icon} ${B[b.type].name}: ${si.reason}`, at: { x, y } }; break; }
  }
  for (const b of bs) G.tiles.bld[idx(b.x, b.y)] = b.id;
  UI.moveMemo = { key, res };
  return res;
}
function moveAreaTo(t) {
  const sel = UI.tool.sel; if (!sel) return;
  const dx = t.x - sel.cx, dy = t.y - sel.cy;
  if (!dx && !dy) return toast('Pick a different spot');
  const chk = areaMoveCheck(sel, dx, dy); if (!chk.ok) return toast(`Can't move there — ${chk.reason}`);
  const bs = sel.bs.map(id => G.buildings[id]).filter(Boolean), W = wireArr();
  for (const b of bs) G.tiles.bld[idx(b.x, b.y)] = 0;
  for (const r of sel.roads) G.tiles.road[idx(r.x, r.y)] = 0;
  for (const w of sel.wires) W[idx(w.x, w.y)] = 0;
  for (const b of bs) {
    const x = b.x + dx, y = b.y + dy, i = idx(x, y);
    if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; gain('wood', 8); }
    G.tiles.road[i] = 0; W[i] = 0; b.x = x; b.y = y; G.tiles.bld[i] = b.id;
  }
  const ids = new Set(bs.map(b => b.id));
  for (const r of sel.roads) { const x = r.x + dx, y = r.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (G.tiles.owner[i] === 0 && !G.tiles.bld[i] && TERRAIN[G.tiles.terrain[i]].pass) { if (G.tiles.terrain[i] === T.FOREST) G.tiles.terrain[i] = T.GRASS; G.tiles.road[i] = Math.max(G.tiles.road[i] === 3 ? 0 : G.tiles.road[i], r.lv); } }
  for (const w of sel.wires) { const x = w.x + dx, y = w.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (G.tiles.owner[i] === 0 && !G.tiles.bld[i] && (TERRAIN[G.tiles.terrain[i]].pass || G.tiles.road[i] === 3)) W[i] = 1; }
  for (const k of G.kin) if (ids.has(k.dest) || ids.has(k.job) || ids.has(k.home)) { k.dest = null; k.path = null; k.plan = null; }
  R.terrainDirty = true; pathsDirty(); netDirty(); gridDirty(); recomputeAppeal(); refreshMults();
  addLog(`↔️ Moved a block of ${bs.length} building${bs.length === 1 ? '' : 's'}${sel.roads.length ? ` and ${sel.roads.length} road tiles` : ''}.`, 'info');
  UI.lastInspect = ''; setTool('move');
}
function drawBoxRect(c) {
  const r = UI.boxRect; if (!r) return;
  const R0 = normRect(r);
  const list = buildingsIn(R0), up = r.kind === 'upgrade';
  c.fillStyle = up ? 'rgba(255,213,79,0.16)' : 'rgba(129,212,250,0.16)'; c.fillRect(R0.x0 * TILE, R0.y0 * TILE, (R0.x1 - R0.x0 + 1) * TILE, (R0.y1 - R0.y0 + 1) * TILE);
  c.strokeStyle = up ? '#ffd54f' : '#81d4fa'; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(R0.x0 * TILE, R0.y0 * TILE, (R0.x1 - R0.x0 + 1) * TILE, (R0.y1 - R0.y0 + 1) * TILE); c.setLineDash([]);
  let label;
  if (up) { if (!UI.boxMemo || UI.boxMemo.k !== JSON.stringify(R0)) { const p = planUpgrades(list); UI.boxMemo = { k: JSON.stringify(R0), p }; } const p = UI.boxMemo.p; label = p.cands.length ? `⬆️ ${p.pick.length}/${p.cands.length} upgrades · ${costStr(p.cost)}` : 'Nothing to upgrade here'; for (const b of p.pick) { c.strokeStyle = '#ffd54f'; c.lineWidth = 2; c.strokeRect(b.x * TILE + 2, b.y * TILE + 2, TILE - 4, TILE - 4); } }
  else label = `↔️ ${list.filter(b => !UNMOVABLE.has(b.type)).length} buildings`;
  c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; const lx = (R0.x0 + R0.x1 + 1) / 2 * TILE, ly = R0.y0 * TILE - 6, w = c.measureText(label).width;
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(lx - w / 2 - 5, ly - 13, w + 10, 17); c.fillStyle = '#fff'; c.fillText(label, lx, ly);
}
function drawMoveGhost(c) {
  const tool = UI.tool, hv = R.hover; if (tool.kind !== 'move' || tool.type !== 'area' || !tool.sel) return;
  const s = tool.sel;
  c.strokeStyle = '#ffd54f'; c.lineWidth = 2; c.setLineDash([3, 3]); c.strokeRect(s.x0 * TILE, s.y0 * TILE, (s.x1 - s.x0 + 1) * TILE, (s.y1 - s.y0 + 1) * TILE); c.setLineDash([]);
  if (!hv || !inB(hv.x, hv.y)) return;
  const dx = hv.x - s.cx, dy = hv.y - s.cy, chk = areaMoveCheck(s, dx, dy);
  c.globalAlpha = 0.35; c.fillStyle = '#8d6e63'; for (const r of s.roads) c.fillRect((r.x + dx) * TILE + 8, (r.y + dy) * TILE + 8, TILE - 16, TILE - 16);
  c.globalAlpha = 0.6; for (const id of s.bs) { const b = G.buildings[id]; if (b) drawBuilding(c, { ...b, id: 0, x: b.x + dx, y: b.y + dy, burning: 0 }); }
  c.globalAlpha = 1;
  c.strokeStyle = chk.ok ? '#a5d6a7' : '#ef9a9a'; c.lineWidth = 2; c.strokeRect((s.x0 + dx) * TILE, (s.y0 + dy) * TILE, (s.x1 - s.x0 + 1) * TILE, (s.y1 - s.y0 + 1) * TILE);
  if (!chk.ok && chk.at) { c.fillStyle = 'rgba(239,83,80,0.4)'; c.fillRect(chk.at.x * TILE, chk.at.y * TILE, TILE, TILE); }
}

// ---------- Power lines: plants only feed the buildings they are wired to ----------
// Power flows along power lines and through buildings that touch each other. Each connected network
// is its own grid with its own supply and demand.
const WIRE_COST = { gold: 2, iron: 1 };
function wireArr() { const N = MAP_W * MAP_H; if (!G.tiles.wire || G.tiles.wire.length !== N) G.tiles.wire = new Uint8Array(N); return G.tiles.wire; }
let _gridVer = 0, _gridKey = '', _gridLab = null, _bPow = null, _gridInfo = null, _gridLabUsed = null;
function gridDirty() { _gridVer++; }
function gridLabels() {
  const key = _gridVer + ':' + _netVer;
  if (_gridLab && _gridKey === key && _gridLab.length === MAP_W * MAP_H) return _gridLab;
  const N = MAP_W * MAP_H, W = wireArr(), bl = G.tiles.bld, lab = new Int32Array(N).fill(-1), q = new Int32Array(N);
  let c = 0;
  for (let s = 0; s < N; s++) {
    if (lab[s] !== -1 || !(W[s] || bl[s])) continue;
    let h = 0, t = 0; q[t++] = s; lab[s] = c;
    while (h < t) { const i = q[h++], x = i % MAP_W, y = (i / MAP_W) | 0;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue; const j = ny * MAP_W + nx; if (lab[j] === -1 && (W[j] || bl[j])) { lab[j] = c; q[t++] = j; } } }
    c++;
  }
  _gridLab = lab; _gridKey = key;
  return lab;
}
function needsPower(b) { const d = B[b.type]; return d.power < 0 || (d.powerLv && b.level >= d.powerLv); }
function powerGrid() {
  if (!G || !G.tiles) return;
  const lab = gridLabels(), comps = new Map(), shut = (G.smogShut || 0) > 0;
  const get = c => { let o = comps.get(c); if (!o) { o = { sup: 0, dem: 0, n: 0 }; comps.set(c, o); } return o; };
  for (const b of Object.values(G.buildings)) {
    const d = B[b.type]; let s = 0, m = 0;
    if (d.power > 0) {
      if (!(b.paused || b.burning || b.ruined)) {
        if (d.workers) { if (!(shut || b.starved)) s = d.power * b.level * Math.min(1, b.workers.length / Math.max(1, d.workers)) * (1 + fx('reactor')); }
        else s = d.power * (1 + fx('power'));
      }
    } else if (d.power < 0 && !b.paused) m = -d.power * (b.workers.length ? 1 : 0.3);
    if (d.powerLv && b.level >= d.powerLv) m += (b.level - d.powerLv + 1) * 1.5;
    m *= Math.max(0.3, 1 - fx('gridSave'));
    if (s || m || d.power) { const o = get(lab[idx(b.x, b.y)]); o.sup += s; o.dem += m; if (needsPower(b)) o.n++; }
  }
  let sup = 0, dem = 0, served = 0, cut = 0, grids = 0;
  for (const o of comps.values()) {
    if (G.blackout > 0) o.sup *= 0.25; if (G.heat > 0) o.dem *= 1.4;
    o.ratio = o.dem > 0.01 ? Math.min(1, o.sup / o.dem) : 1;
    sup += o.sup; dem += o.dem; served += Math.min(o.sup, o.dem);
    if (o.sup > 0) grids++; else cut += o.n;
  }
  _bPow = new Map(); _gridInfo = comps; _gridLabUsed = lab;
  for (const b of Object.values(G.buildings)) if (needsPower(b)) { const o = comps.get(lab[idx(b.x, b.y)]); _bPow.set(b.id, o ? o.ratio : 0); }
  G.power = { sup, dem, ratio: dem > 0.01 ? served / dem : 1, cut, grids };
}
function powerRatio(b) { if (b && _bPow) { const r = _bPow.get(b.id); return r == null ? 1 : r; } return G.power ? G.power.ratio : 1; }
function gridInfo(b) { if (!_gridInfo || gridLabels() !== _gridLabUsed) powerGrid(); const o = _gridInfo && _gridInfo.get(gridLabels()[idx(b.x, b.y)]); return o || { sup: 0, dem: 0, ratio: 0 }; }
function gridLine(b) {
  const g = gridInfo(b), d = B[b.type];
  if (d.power > 0) return `<div class="kv">⚡ Supplies up to ${d.power * (d.workers ? b.level : 1)} power${d.workers ? ' when staffed and fueled' : ''} · its grid ${Math.round(g.sup)}/${Math.round(g.dem)}${g.dem === 0 ? ' <span class="dim">— nothing is wired to it yet: run ⚡ power lines (Roads menu) to your buildings</span>' : ''}</div>`;
  if (!needsPower(b)) return '';
  if (g.sup <= 0) return `<div class="kv neg">⚡ Not connected to any power plant — run a ⚡ power line here (Roads menu), or build next to a powered building</div>`;
  return `<div class="kv ${g.ratio < 1 ? 'neg' : 'pos'}">⚡ On a grid with ${Math.round(g.sup)} supply / ${Math.round(g.dem)} demand${g.ratio < 1 ? ` — running at ${Math.round(g.ratio * 100)}%` : ' ✓'}</div>`;
}
function wireAt(t, drag) {
  if (!inB(t.x, t.y)) return;
  const i = idx(t.x, t.y), W = wireArr();
  if (UI.tool.type === 'unwire') { if (W[i]) { W[i] = 0; gridDirty(); powerGrid(); } return; }
  if (!hasTech('electricity')) { if (!drag) toast('Research Electricity first'); return; }
  if (G.tiles.owner[i] !== 0) { if (!drag) toast('Not your territory'); return; }
  if (G.tiles.bld[i] || W[i]) return; // buildings already carry power
  if (!TERRAIN[G.tiles.terrain[i]].pass && G.tiles.road[i] !== 3) { if (!drag) toast('Power lines need dry land or a bridge'); return; }
  if (!canAfford(WIRE_COST)) { if (!drag) toast(`A power line costs ${costStr(WIRE_COST)} per tile`); return; }
  why('Construction', pay, WIRE_COST); W[i] = 1; gridDirty(); powerGrid();
}
// lay lines from every unpowered building to the nearest powered network
function wireAll(free) {
  powerGrid();
  const lab = gridLabels(), W = wireArr(), N = MAP_W * MAP_H;
  const live = new Set(); for (const [c, o] of _gridInfo) if (o.sup > 0) live.add(c);
  if (!live.size) return { n: 0, tiles: 0, none: true };
  const on = new Uint8Array(N); for (let i = 0; i < N; i++) if (lab[i] >= 0 && live.has(lab[i])) on[i] = 1;
  const ok = i => G.tiles.owner[i] === 0 && !G.tiles.bld[i] && (TERRAIN[G.tiles.terrain[i]].pass || G.tiles.road[i] === 3);
  const todo = Object.values(G.buildings).filter(b => needsPower(b) && !on[idx(b.x, b.y)]);
  let n = 0, tiles = 0, failed = 0, poor = false;
  for (const b of todo) {
    if (on[idx(b.x, b.y)]) continue;
    const prev = new Int32Array(N).fill(-2), q = [];
    for (const [dx, dy] of N4) { const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (ok(i)) { prev[i] = -1; q.push(i); } }
    let end = -1;
    for (let h = 0; h < q.length && h < 4000; h++) {
      const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
      if (on[i] || N4.some(([dx, dy]) => inB(x + dx, y + dy) && on[idx(x + dx, y + dy)])) { end = i; break; }
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (prev[j] !== -2 || !ok(j)) continue; prev[j] = i; q.push(j); }
    }
    if (end < 0) { failed++; continue; }
    const path = []; for (let i = end; i >= 0; i = prev[i]) if (!W[i]) path.push(i);
    if (!free) { const c = scaleCost(WIRE_COST, path.length); if (!canAfford(c)) { poor = true; break; } why('Construction', pay, c); }
    for (const i of path) { W[i] = 1; on[i] = 1; }
    const myLab = lab[idx(b.x, b.y)]; for (let i = 0; i < N; i++) if (lab[i] === myLab) on[i] = 1;
    n++; tiles += path.length;
  }
  gridDirty(); powerGrid();
  return { n, tiles, failed, poor };
}
function drawWire(c, x, y, lod) {
  const W = G.tiles.wire, px = x * TILE + 16, py = y * TILE + 16;
  c.strokeStyle = 'rgba(38,50,56,0.9)'; c.lineWidth = lod ? 2.5 : 1.4; c.beginPath();
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny);
    if (W[j] && (dx > 0 || dy > 0)) { c.moveTo(px, py - 7); c.lineTo(px + dx * TILE, py + dy * TILE - 7); }
    else if (!W[j] && G.tiles.bld[j]) { c.moveTo(px, py - 7); c.lineTo(px + dx * 14, py + dy * 14 - 7); }
  }
  c.stroke();
  if (!lod) { c.fillStyle = '#5d4037'; c.fillRect(px - 1, py - 9, 2.2, 13); c.fillStyle = '#3e2723'; c.fillRect(px - 4.5, py - 9, 9, 1.6); }
}
function drawGridOverlay(c, x0, y0, x1, y1) {
  if (!_bPow) powerGrid();
  c.font = '11px sans-serif'; c.textAlign = 'center';
  for (const b of Object.values(G.buildings)) {
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
    const d = B[b.type], px = b.x * TILE, py = b.y * TILE;
    if (d.power > 0) { c.strokeStyle = '#ffeb3b'; c.lineWidth = 2; c.setLineDash([4, 3]); c.strokeRect(px + 1, py + 1, 30, 30); c.setLineDash([]); c.fillText('⚡', px + 16, py + 12); continue; }
    if (!needsPower(b)) continue;
    const r = powerRatio(b);
    c.fillStyle = r >= 0.99 ? '#43a047' : r > 0 ? '#fb8c00' : '#e53935'; c.beginPath(); c.arc(px + 5, py + 5, 4.5, 0, 7); c.fill();
  }
}
function roadExtras() {
  const lockW = !hasTech('electricity') ? `Research ${TECHS.electricity ? TECHS.electricity.name : 'Electricity'}` : null;
  let h = `<div class="cards"><div class="card ${UI.tool.type === 'wire' ? 'on' : ''} ${lockW ? 'locked' : ''}" data-act="${lockW ? '' : 'pickroad'}" data-arg="wire" data-tip="Power flows along power lines and through buildings that touch. A power plant only feeds the buildings on its own network. Click or drag to string lines (they can run along roads)."><div class="ci">⚡</div><div class="cn">Power line</div><div class="cc">${lockW ? '🔒 ' + lockW : costStr(WIRE_COST) + '/tile'}</div></div>`;
  h += `<div class="card ${UI.tool.type === 'unwire' ? 'on' : ''}" data-act="pickroad" data-arg="unwire" data-tip="Take down power lines"><div class="ci">✂️</div><div class="cn">Remove line</div><div class="cc">Free</div></div></div>`;
  const ul = unlinkedBuildings().length, rt = UI.tool.type && ROADS[UI.tool.type] && !ROADS[UI.tool.type].water ? UI.tool.type : (hasTech('masonry') ? 'stoneroad' : 'path');
  h += `<div class="btnrow"><button class="btn sm" data-act="linkall" data-arg="${rt}" ${ul ? '' : 'disabled'} data-tip="Lay the shortest ${esc(ROADS[rt].name.toLowerCase())} from every unlinked home and workplace to your road network or a hub. ${costStr(roadCost(rt))} per tile.">🛣️ Link ${ul === 1 ? 'the 1 unlinked building' : `all ${ul} unlinked buildings`} (${ROADS[rt].icon} ${ROADS[rt].name})</button>`;
  if (hasTech('electricity')) { powerGrid(); h += `<button class="btn sm" data-act="wireall" ${G.power.cut ? '' : 'disabled'} data-tip="String the shortest power lines from every unpowered building to a powered network. ${costStr(WIRE_COST)} per tile.">⚡ Wire up ${G.power.cut || 0} unpowered building${G.power.cut === 1 ? '' : 's'}</button>`; }
  return h + `</div>`;
}

// ---------- Hooks into the rest of the game ----------
{ const _dr = dailyRealm; dailyRealm = function () { _dr(); dailySubjects(); dailyVets(); }; }
function dailyVets() {
  const v = vets(); if (!v) return;
  _why = 'Veteran upkeep'; G.res.gold -= v * 0.25; track('gold', -v * 0.25);
  if (G.res.gold < 0 && G.time.day % 2 === 0) { const n = Math.ceil(v * 0.1); G.vets -= n; spreadSubjects(n); addLog(`🎖️ Unpaid, ${n} veterans went home.`, 'bad'); }
}
{ const _ng = newGame; newGame = function (o) { const r = _ng(o); G.gridV2 = true; G.vets = 0; G.rural = 0; wireArr(); gridDirty(); return r; }; }
{ const _lg = loadGame; loadGame = function () {
  const ok = _lg(); if (!ok) return ok;
  wireArr(); gridDirty();
  if (!G.gridV2) { G.gridV2 = true; const r = wireAll(true); if (r.tiles || r.failed) addLog(`⚡ Power now runs along power lines.${r.tiles ? ` Your engineers strung ${r.tiles} tiles of line to keep ${r.n} building${r.n === 1 ? '' : 's'} connected.` : ''}${r.failed ? ` ${r.failed} building${r.failed === 1 ? ' is' : 's are'} too far from any power plant over your land — build a plant nearby or run a line to ${r.failed === 1 ? 'it' : 'them'}.` : ''}`, r.failed ? 'bad' : 'info'); }
  return ok;
}; }
{ const _rbm = renderBuildMenu; renderBuildMenu = function () {
  const k = UI.tool.kind;
  if (k === 'upgrade') { $('#buildmenu').innerHTML = upgradeMenu(); return; }
  if (k === 'move') { $('#buildmenu').innerHTML = `<div class="bm-title">↔️ Move — ${UI.tool.type === 'area' ? `carrying ${UI.tool.sel.bs.length} buildings: click where the middle of the block should go (right-click cancels)` : UI.tool.type ? 'click the new spot (hold Shift to keep moving)' : 'click a building and then its new spot, or <b>drag a box</b> to pick up a whole block — buildings, roads and power lines — and drop it somewhere else'}. Moving is free.</div>`; return; }
  _rbm();
  if (k === 'road') $('#buildmenu').innerHTML += roadExtras();
}; }
{ const _st = setTool; setTool = function (kind, type) { _st(kind, type); UI.boxRect = null; if (kind === 'upgrade' || kind === 'move') { $('#buildmenu').classList.remove('hidden'); renderBuildMenu(); } }; }
{ const _ap = applyAt; applyAt = function (e, drag) {
  const tool = UI.tool;
  if (tool.kind === 'move' && tool.type === 'area') { if (!drag) why('Construction', moveAreaTo, screenToTile(e.clientX, e.clientY)); return; }
  if (tool.kind === 'road' && (tool.type === 'wire' || tool.type === 'unwire')) { wireAt(screenToTile(e.clientX, e.clientY), drag); return; }
  return _ap(e, drag);
}; }
{ const _mt = mapTip; mapTip = function (t) {
  const tool = UI.tool;
  if (UI.boxRect) return '';
  if (tool.kind === 'move' && tool.type === 'area' && inB(t.x, t.y)) { const chk = areaMoveCheck(tool.sel, t.x - tool.sel.cx, t.y - tool.sel.cy); return chk.ok ? `↔️ Drop the block here` : `<span class="neg">✗ ${chk.reason}</span>`; }
  if (tool.kind === 'road' && (tool.type === 'wire' || tool.type === 'unwire') && inB(t.x, t.y)) {
    const b = bAt(t.x, t.y); if (b && (needsPower(b) || B[b.type].power > 0)) { const g = gridInfo(b); return `${B[b.type].icon} ${B[b.type].name} · grid ${Math.round(g.sup)}/${Math.round(g.dem)}${needsPower(b) ? ` · ${Math.round(powerRatio(b) * 100)}% powered` : ''}`; }
    return tool.type === 'wire' ? `⚡ Power line ${costStr(WIRE_COST)}` : (G.tiles.wire && G.tiles.wire[idx(t.x, t.y)] ? '✂️ Remove this line' : '');
  }
  if (tool.kind === 'upgrade') return _mt(t) + '<br><small>Drag a box to upgrade many at once</small>';
  if (tool.kind === 'move' && !tool.type) return _mt(t) + '<br><small>Drag a box to move a whole block</small>';
  return _mt(t);
}; }
{ const _da = drawAreaRect; drawAreaRect = function (c) { _da(c); drawBoxRect(c); drawMoveGhost(c); }; }
{ const _drl = drawRoadLinks; drawRoadLinks = function (c, x0, y0, x1, y1) { if (UI.tool.type === 'wire' || UI.tool.type === 'unwire') return drawGridOverlay(c, x0, y0, x1, y1); return _drl(c, x0, y0, x1, y1); }; }
// box dragging for the upgrade and move tools
{
  const cv = document.getElementById('game');
  cv.addEventListener('pointerdown', e => {
    const k = UI.tool.kind;
    if (e.button !== 0 || !(k === 'upgrade' || (k === 'move' && !UI.tool.type))) return;
    const t = screenToTile(e.clientX, e.clientY); UI.boxRect = { kind: k, x0: t.x, y0: t.y, x1: t.x, y1: t.y, sx: e.clientX, sy: e.clientY }; UI.boxMemo = null;
    e.stopImmediatePropagation(); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  }, true);
  cv.addEventListener('pointermove', e => {
    if (!UI.boxRect) return;
    const t = screenToTile(e.clientX, e.clientY); R.hover = t; UI.boxRect.x1 = t.x; UI.boxRect.y1 = t.y; UI.mapTip = '';
    e.stopImmediatePropagation();
  }, true);
  cv.addEventListener('pointerup', e => {
    const r = UI.boxRect; if (!r) return;
    UI.boxRect = null; e.stopImmediatePropagation();
    if (r.x0 === r.x1 && r.y0 === r.y1 && Math.hypot(e.clientX - r.sx, e.clientY - r.sy) < 8) applyAt(e, false); else boxDone(r);
  }, true);
}
Object.assign(ACT, {
  upall: a => { const list = Object.values(G.buildings).filter(b => a === '*' || b.type === a); bulkUpgrade(list); renderBuildMenu(); },
  upalltype: a => { const b = G.buildings[+a]; if (b) bulkUpgrade(Object.values(G.buildings).filter(o => o.type === b.type)); UI.lastInspect = ''; },
  linkall: a => { const lv = ROADS[a] ? ROADS[a].level : 1; const r = why('Construction', linkAll, null, false, lv); toast(r.linked ? `🛣️ Linked ${r.linked} buildings with ${r.tiles} tiles of ${ROADS[r.type].name.toLowerCase()}${r.failed ? ` · ${r.failed} have no route over your land` : ''}${r.poor ? ' · ran out of materials' : ''}` : r.poor ? `Not enough materials for ${ROADS[r.type].name.toLowerCase()}` : 'No route found — claim the land between or build a hub nearby'); if (r.linked) addLog(`🛣️ Linked ${r.linked} buildings to the road network (${r.tiles} tiles).`, 'info'); renderBuildMenu(); },
  wireall: () => { const r = wireAll(false); toast(r.none ? 'Build a power plant first' : r.n ? `⚡ Connected ${r.n} buildings with ${r.tiles} tiles of power line${r.failed ? ` · ${r.failed} can't be reached over your land` : ''}${r.poor ? ' · ran out of money' : ''}` : r.poor ? `Not enough for the lines (${costStr(WIRE_COST)} per tile)` : 'No route over your land — build a power plant closer'); renderBuildMenu(); },
  rally: a => { rallyOn(a); UI.rally[a] = !UI.rally[a]; renderWin(true); },
  vetsdismiss: () => { const n = Math.ceil(vets() / 2); G.vets -= n; spreadSubjects(n); addLog(`🎖️ ${n} veterans were sent home with thanks.`, 'info'); renderWin(true); },
});
