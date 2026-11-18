// ===== Occupation: conquered cities resent you until you invest in them; rivals plan real streets; area terraforming =====

// ---------- Resentment of the conquest ----------
// Every conquered city starts with a grievance (0-100). It pushes unrest up every day, makes rebels stronger
// and turns the city's own levies against you. Building, upgrading and hiring in the city's district wins
// the people over; cracking down makes it worse.
const PROJECT_W = { civic: 3, wonder: 6, housing: 1.5, food: 2, industry: 2, military: 1, decor: 0.3 };
function projectValue(b) { const d = B[b.type]; if (!d || b.type === 'cityhall' || b.type === 'townhall') return 0; return (b.level || 1) * (PROJECT_W[d.cat] ?? 1); }
let _distr = null, _distrKey = '';
// which city each building belongs to (nearest city hall within 9 tiles, unless the capital is closer)
function cityDistricts() {
  const key = G.time.day + ':' + G.nextB + ':' + Object.keys(G.buildings).length + ':' + (G.cities || []).length;
  if (_distr && _distrKey === key) return _distr;
  const cs = cities().map(c => ({ c, b: G.buildings[c.bid] })), th = townhall(), m = new Map();
  if (cs.length) for (const o of Object.values(G.buildings)) {
    if (o.type === 'cityhall') { const c = cityOf(o); if (c) m.set(o.id, c); continue; }
    let best = null, bd = 9.5;
    for (const { c, b } of cs) { const d = dist(b.x, b.y, o.x, o.y); if (d < bd) { bd = d; best = c; } }
    if (best && th && dist(th.x, th.y, o.x, o.y) < bd) best = null;
    if (best) m.set(o.id, best);
  }
  _distr = m; _distrKey = key; return m;
}
function districtOf(b) { return cityDistricts().get(b.id) || null; }
function grievanceStart(c) { return c.origin === 'taken' ? Math.max(0, Math.round(70 - (G.time.day - (c.founded || 0)) * 0.8)) : 0; }
function cityGrievance(c) { if (c.grievance === undefined) c.grievance = grievanceStart(c); return c.grievance; }
function cityLoyalLevies(c) { return cityGrievance(c) < 40; }
function cityStrike(c) { const u = c.unrest || 0; return u >= 50 ? 1 - (u - 50) / 100 : 1; }
function soothe(c, n, why) {
  if (!c || !(c.grievance > 0) || n <= 0) return;
  const before = c.grievance; c.grievance = Math.max(0, c.grievance - n); c.goodwill = (c.goodwill || 0) + (before - c.grievance);
  const b = G.buildings[c.bid];
  if (b && before - c.grievance >= 1) floatText(b.x, b.y, `🤝 −${Math.round(before - c.grievance)} resentment${why ? ' · ' + why : ''}`, '#a5d6a7');
  if (before > 50 && c.grievance <= 50) addLog(`🤝 ${c.name} is warming to your rule (resentment ${Math.round(c.grievance)}/100). Its levies will soon fight for you.`, 'good');
  if (before >= 40 && c.grievance < 40) addLog(`🛡️ ${c.name}'s levies now stand with you rather than with any rebels.`, 'good');
  if (before > 0 && c.grievance <= 0 && c.origin === 'taken') { c.unrest = Math.max(0, (c.unrest || 0) - 15); addLog(`🎉 The people of ${c.name} no longer think of themselves as conquered — they are part of ${G.realm.name} now.`, 'good'); history(`${c.name} came to accept the rule of ${G.realm.name}.`, '🤝'); }
}
function aggrieve(c, n) { if (!c) return; c.grievance = clamp(cityGrievance(c) + n, 0, 100); }
// once a day: count each district's works and jobs; anything above its best so far is a new project
function dailyOccupation() {
  const cs = cities(); if (!cs.length) return;
  const D = cityDistricts(), inv = new Map(), jobs = new Map();
  for (const o of Object.values(G.buildings)) { const c = D.get(o.id); if (!c) continue; inv.set(c, (inv.get(c) || 0) + projectValue(o)); if (o.workers) jobs.set(c, (jobs.get(c) || 0) + o.workers.length); }
  for (const c of cs) {
    cityGrievance(c);
    const I = inv.get(c) || 0, J = jobs.get(c) || 0;
    if (c.investBest === undefined) { c.investBest = I; c.jobsBest = J; continue; }
    let won = 0; const why = [];
    if (I > c.investBest + 0.01) { won += (I - c.investBest) * 4; why.push('new works'); c.investBest = I; }
    if (J > c.jobsBest) { won += (J - c.jobsBest) * 1.5; why.push('new jobs'); c.jobsBest = J; }
    if (c._conn && !c.roadWon) { c.roadWon = true; won += 8; why.push('a road to the capital'); }
    if (c.grievance > 0) soothe(c, won + 0.08, won >= 1 ? why.join(', ') : '');
  }
}
function occupationHtml(c) {
  const g = Math.round(cityGrievance(c)), st = cityStrike(c);
  let h = '';
  if (g > 0) {
    h += `<div class="kv">😠 Resentment of the conquest <b>${g}</b>/100 <small class="dim">adds ${(0.6 + g * 0.02).toFixed(1)} unrest/day</small></div>${bar(g, g >= 60 ? '#e53935' : g >= 40 ? '#ffa726' : '#ffee58')}`;
    h += `<div class="dim">Win them over with projects in this city's district (within 9 tiles of its hall): every new building or upgrade (temples, schools and other civic works count most), every new job filled here, and a road to your capital. Crackdowns make it worse.${g >= 40 ? ' <span class="neg">While resentment is 40 or more, the city\'s levies would join a rising against you.</span>' : ''}</div>`;
  } else if (c.goodwill) h += `<div class="kv pos">🤝 Loyal — your projects here won them over.</div>`;
  if (st < 1) h += `<div class="kv neg">✊ Restless workers: buildings in this district produce ${Math.round(st * 100)}%.</div>`;
  return h;
}
function publicWorksCost(c) { const e = curEra(); return { gold: 30 + 25 * e, stone: 20 + 10 * e, wood: 20 + 5 * e }; }

// conquered cities start angry; joined ones only grumble
{ const _cac = cityAtConquest; cityAtConquest = function (x, y, name) { const c = _cac(x, y, name); if (c) { c.grievance = 100; c.unrest = 40; c.investBest = undefined; } return c; }; }
{ const _ar = annexRealm; annexRealm = function (f, how) {
  aiPlanStreets(f, 0, 0); // their surveyors finish the street plan before the keys change hands
  const r = _ar(f, how);
  if (r && how !== 'conquer') for (const c of cities()) if (r.cities.includes(c.name)) { c.grievance = 20; c.unrest = 8; }
  return r;
}; }
{ const _mv = makeVassal; makeVassal = function (f) { aiPlanStreets(f, 0, 0); return _mv(f); }; }
{ const _av = absorbVillage; absorbVillage = function (v, how) {
  aiPlanStreets(v, 0, 0);
  _av(v, how);
  if (how !== 'conquer') { const c = cities().find(o => o.name === v.name); if (c) { c.grievance = 10; c.unrest = 5; } }
}; }
{ const _td = takeDistrict; takeDistrict = function (f, tiles) {
  const r = _td(f, tiles);
  if (tiles.length) { const x = tiles[0] % MAP_W, y = (tiles[0] / MAP_W) | 0; let best = null, bd = 13; for (const c of cities()) { const b = G.buildings[c.bid], d = dist(b.x, b.y, x, y); if (d < bd) { bd = d; best = c; } } if (best) aggrieve(best, 12); }
  return r;
}; }
{ const _dr = dailyRealm; dailyRealm = function () { _dr(); dailyOccupation(); }; }
{ const _bm = buildingMult; buildingMult = function (b) { let m = _bm(b); if (b.type !== 'cityhall' && (G.cities || []).length) { const c = districtOf(b); if (c) m *= cityStrike(c); } return m; }; }
{ const _cu = cityUnrestHtml; cityUnrestHtml = function (c) { return _cu(c) + occupationHtml(c); }; }
// the unrest event gains a public-works answer, and crackdowns and gifts touch the grievance
{ const ev = EVENTS.cityUnrest, _mk = ev.make; ev.make = d => {
  const o = _mk(d); if (!o) return o;
  const b = G.buildings[d.bid], c = b && cityOf(b); if (!c) return o;
  for (const ch of o.choices) {
    const fn = ch.fn;
    if (/^Crack down/.test(ch.label)) { ch.tip += ' Resentment +15.'; ch.fn = () => { fn(); aggrieve(c, 15); }; }
    if (/^Send gifts/.test(ch.label)) { ch.tip += ' Resentment −8.'; ch.fn = () => { fn(); soothe(c, 8); }; }
  }
  if (cityGrievance(c) > 0) {
    const pw = publicWorksCost(c);
    o.choices.splice(o.choices.length - 1, 0, { label: 'Fund public works', tip: `${costStr(pw)}: new wells, granaries and roads for their streets. Unrest −15 and resentment −25.`, disabled: !canAfford(pw), fn: () => { pay(pw); c.unrest -= 15; soothe(c, 25, 'public works'); } });
  }
  return o;
}; }
{ const ev = EVENTS.rebellion, _mk = ev.make; ev.make = d => {
  const o = _mk(d); if (!o) return o;
  const b = G.buildings[d.bid], c = b && cityOf(b); if (!c || cityLoyalLevies(c)) return o;
  o.text += ` <b>${c.name}'s own levies have gone over to the rebels</b> — they still resent the conquest.`;
  const ch = o.choices[0], fn = ch.fn; ch.fn = () => { fn(); if (G.cities.includes(c)) aggrieve(c, 10); };
  ch.tip += ' Even a win leaves them more bitter (resentment +10).';
  return o;
}; }

// ---------- Rival street planning ----------
// Rivals now connect every home, field, camp, mine and store to a road that leads back to their capital,
// cutting through a field (or, rarely, clearing a cottage) where nothing else gets through.
const _sp = { cost: null, prev: null, stamp: null, gen: 0 };
function _spArrays() {
  const N = MAP_W * MAP_H;
  if (!_sp.cost || _sp.cost.length !== N) { _sp.cost = new Float32Array(N); _sp.prev = new Int32Array(N); _sp.stamp = new Uint32Array(N); _sp.gen = 0; }
  if (++_sp.gen > 4e9) { _sp.stamp.fill(0); _sp.gen = 1; }
  return _sp;
}
function needsStreet(v) { return v === 1 || v === 2 || v >= 6; }
// owner: a realm (f) — plans on its own land
function aiPlanStreets(f, lv, maxSites) {
  if (!f || f.dead || !f.cap) return 0;
  const fid = f.id, O = G.tiles.owner, D = G.tiles.deco, rd = G.tiles.road, TR = G.tiles.terrain, N = O.length;
  lv = lv || aiRoadLevels(f.minor ? 1 : (f.era || 1)).street;
  const own = i => O[i] === fid;
  // the network: roads reachable from the capital and towns
  const net = new Uint8Array(N), q = [];
  const centres = [f.cap, ...(f.towns || [])].filter(c => c && inB(c.x, c.y));
  const flood = () => { while (q.length) { const i = q.pop(), x = i % MAP_W, y = (i / MAP_W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny); if (rd[j] && !net[j]) { net[j] = 1; q.push(j); } } } };
  for (const c of centres) {
    for (const [dx, dy] of N8) { const x = c.x + dx, y = c.y + dy; if (!inB(x, y)) continue; const i = idx(x, y); if (!own(i) || !TERRAIN[TR[i]].pass || G.tiles.bld[i]) continue; if (!rd[i] && !D[i]) setRoad(i, lv); if (rd[i] && !net[i]) { net[i] = 1; q.push(i); } }
  }
  flood();
  if (!q.length && !net.some(Boolean)) return 0;
  // what still needs a street: towns first, then stores and sites, then homes, then fields — nearest the capital first
  const prio = v => v === 5 ? 0 : v >= 7 ? 1 : v === 6 || v === 1 ? 2 : 3;
  const todo = [];
  for (let i = 0; i < N; i++) {
    if (!own(i)) continue; const v = D[i]; if (!(needsStreet(v) || v === 5)) continue;
    if (v === 2 && TR[i] === T.HILLS) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (N4.some(([dx, dy]) => inB(x + dx, y + dy) && net[idx(x + dx, y + dy)])) continue;
    todo.push({ i, x, y, p: prio(v), d: dist(x, y, f.cap.x, f.cap.y) });
  }
  todo.sort((a, b) => a.p - b.p || a.d - b.d);
  const S = _spArrays(), cost = S.cost, prev = S.prev, stamp = S.stamp;
  const step = j => { if (!own(j) || !TERRAIN[TR[j]].pass || G.tiles.bld[j]) return -1; const v = D[j]; if (!v) return rd[j] ? 0.25 : TR[j] === T.FOREST ? 1.4 : 1; if (v === 2) return 4; if (v === 1) return 25; return -1; };
  let done = 0, laid = 0;
  for (const s of todo) {
    if (maxSites && done >= maxSites) break;
    if (N4.some(([dx, dy]) => inB(s.x + dx, s.y + dy) && net[idx(s.x + dx, s.y + dy)])) continue; // linked by an earlier street
    const gen = ++S.gen, hp = new Heap();
    for (const [dx, dy] of N4) { const x = s.x + dx, y = s.y + dy; if (!inB(x, y)) continue; const i = idx(x, y), c = step(i); if (c < 0) continue; stamp[i] = gen; cost[i] = c; prev[i] = -1; hp.push(i, c); }
    let end = -1, it = 0;
    while (hp.size && it++ < 2500) {
      const i = hp.pop(); if (net[i]) { end = i; break; }
      const x = i % MAP_W, y = (i / MAP_W) | 0, ci = cost[i];
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny), c = step(j); if (c < 0) continue; const nc = ci + c; if (stamp[j] === gen && cost[j] <= nc) continue; stamp[j] = gen; cost[j] = nc; prev[j] = i; hp.push(j, nc); }
    }
    if (end < 0) continue;
    for (let i = end; i >= 0; i = prev[i]) { if (D[i] === 1 || D[i] === 2) D[i] = 0; if (!rd[i]) laid++; setRoad(i, lv); if (!net[i]) { net[i] = 1; q.push(i); } }
    flood(); done++;
  }
  if (done) pathsDirty();
  return done;
}
// rivals keep their plan up to date whenever they build or grow (replaces the old site-only linker)
aiLinkSites = function (f, lv) { return aiPlanStreets(f, lv, 80); };
// new cottages keep a lane open too
function streetLane(fid, x, y) { return N4.some(([dx, dy]) => { if (!inB(x + dx, y + dy)) return false; const j = idx(x + dx, y + dy); return G.tiles.road[j] || (G.tiles.owner[j] === fid && TERRAIN[G.tiles.terrain[j]].pass && (!G.tiles.deco[j] || G.tiles.deco[j] === 2) && !G.tiles.bld[j]); }); }

// conquered buildings that are still boxed in get a road even if a farm has to give way
function forceLink(b, lv) {
  if (roadLink(b).linked) return 0;
  const net = roadNet(), S = _spArrays(), cost = S.cost, prev = S.prev, stamp = S.stamp, gen = S.gen, hp = new Heap();
  const step = j => { if (G.tiles.owner[j] !== 0 || !TERRAIN[G.tiles.terrain[j]].pass) return -1; const o = G.tiles.bld[j]; if (!o) return 1; const ob = G.buildings[o]; if (!ob || ob === b) return -1; if (ob.type === 'farm') return 6; if (B[ob.type].decor) return 3; return -1; };
  for (const [dx, dy] of N4) { const x = b.x + dx, y = b.y + dy; if (!inB(x, y)) continue; const i = idx(x, y), c = step(i); if (c < 0) continue; stamp[i] = gen; cost[i] = c; prev[i] = -1; hp.push(i, c); }
  let end = -1, it = 0;
  while (hp.size && it++ < 3000) {
    const i = hp.pop(); if (net[i]) { end = i; break; }
    const x = i % MAP_W, y = (i / MAP_W) | 0, ci = cost[i];
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const j = idx(nx, ny), c = step(j); if (c < 0) continue; const nc = ci + c; if (stamp[j] === gen && cost[j] <= nc) continue; stamp[j] = gen; cost[j] = nc; prev[j] = i; hp.push(j, nc); }
  }
  if (end < 0) return -1;
  let n = 0, razed = 0;
  for (let i = end; i >= 0; i = prev[i]) {
    const o = G.tiles.bld[i]; if (o && G.buildings[o]) { demolish(G.buildings[o], true); razed++; }
    if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; R.terrainDirty = true; }
    if (!G.tiles.road[i] || (G.tiles.road[i] < lv && G.tiles.road[i] !== 3)) { G.tiles.road[i] = lv; n++; }
  }
  pathsDirty(); netDirty();
  return { n, razed };
}
{ const _la = linkAll; linkAll = function (list, free, lv) {
  const r = _la(list, free, lv);
  if (free && list && r.failed) {
    let fixed = 0, razed = 0; lv = lv || (hasTech('masonry') ? 2 : 1);
    for (const b of list) { if (!b || !G.buildings[b.id] || noDrive(b) || !(isWorkplace(b) || B[b.type].housing)) continue; const f = forceLink(b, lv); if (f && f !== -1) { fixed++; razed += f.razed; r.tiles += f.n; } }
    if (fixed) { r.linked += fixed; r.failed = Math.max(0, r.failed - fixed); r.razed = razed; R.terrainDirty = true; netDirty(); }
  }
  return r;
}; }

// ---------- Area terraforming ----------
function terraMode() { return UI.terraMode || 'area'; }
function terraModes() {
  const m = terraMode(), opts = [['area', '⬚ Drag an area'], ['tile', '▪ 1×1 brush']];
  if (fx('brush')) opts.push(['brush', '▦ 3×3 brush']);
  return opts.map(([k, l]) => `<button class="btn xs ${m === k ? 'on' : ''}" data-act="terramode" data-arg="${k}">${l}</button>`).join(' ') + (fx('brush') ? '' : ' <small class="dim">(Steam Power adds a 3×3 brush)</small>');
}
function terraPlan(kind, R0) {
  const tiles = [];
  for (let y = R0.y0; y <= R0.y1; y++) for (let x = R0.x0; x <= R0.x1; x++) if (terraformInfo(kind, x, y).ok) tiles.push({ x, y });
  const c = terraCost(kind); let k = tiles.length;
  for (const r in c) if (c[r] > 0) k = Math.min(k, Math.floor((G.res[r] || 0) / c[r]));
  return { tiles, k: Math.max(0, k), cost: scaleCost(c, Math.max(0, k)) };
}
let _terraBulk = false;
{ const _rm = refreshMults; refreshMults = function () { if (_terraBulk) return; return _rm(); }; }
function terraBox(R0) {
  const kind = UI.tool.type, tf = TERRAFORM[kind]; if (!tf) return;
  const p = terraPlan(kind, R0);
  if (!p.tiles.length) { const any = terraformInfo(kind, R0.x0, R0.y0); return toast(`Nothing in that area can be ${tf.name.toLowerCase()}ed${any.reason ? ` — e.g. ${any.reason.toLowerCase()}` : ''}`); }
  if (!p.k) return toast(`Not enough resources — each tile costs ${costStr(terraCost(kind))}`);
  let n = 0; _terraBulk = true;
  try { why('Terraforming', () => { for (const t of p.tiles) { if (n >= p.k) break; if (terraform(kind, t.x, t.y, true)) n++; else if (!canAfford(terraCost(kind))) break; } }); }
  finally { _terraBulk = false; }
  refreshMults(); pathsDirty(); R.terrainDirty = true; renderBuildMenu();
  const left = p.tiles.length - n;
  addLog(`${tf.icon} ${tf.name}: ${n} tile${n === 1 ? '' : 's'}${left ? ` (${left} more need resources)` : ''}.`, 'info');
  toast(`${tf.icon} ${n} tile${n === 1 ? '' : 's'} done${left ? ` · ${left} more need resources` : ''}`);
}
{ const _bd = boxDone; boxDone = function (r) { if (r.kind === 'terra') { if (UI.tool.kind === 'terra') terraBox(normRect(r)); return; } return _bd(r); }; }
{ const _dbr = drawBoxRect; drawBoxRect = function (c) {
  const r = UI.boxRect; if (!r || r.kind !== 'terra') return _dbr(c);
  const R0 = normRect(r), kind = UI.tool.type, tf = TERRAFORM[kind]; if (!tf) return;
  const k = JSON.stringify(R0) + kind;
  if (!UI.boxMemo || UI.boxMemo.k !== k) UI.boxMemo = { k, p: terraPlan(kind, R0) };
  const p = UI.boxMemo.p;
  c.fillStyle = 'rgba(161,136,127,0.14)'; c.fillRect(R0.x0 * TILE, R0.y0 * TILE, (R0.x1 - R0.x0 + 1) * TILE, (R0.y1 - R0.y0 + 1) * TILE);
  p.tiles.forEach((t, i) => { c.fillStyle = i < p.k ? 'rgba(165,214,167,0.35)' : 'rgba(239,154,154,0.35)'; c.fillRect(t.x * TILE + 3, t.y * TILE + 3, TILE - 6, TILE - 6); });
  c.strokeStyle = '#bcaaa4'; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(R0.x0 * TILE, R0.y0 * TILE, (R0.x1 - R0.x0 + 1) * TILE, (R0.y1 - R0.y0 + 1) * TILE); c.setLineDash([]);
  const label = p.tiles.length ? `${tf.icon} ${tf.name}: ${p.k}/${p.tiles.length} tiles · ${costStr(p.cost) || 'free'}` : `${tf.icon} Nothing here to ${tf.name.toLowerCase()}`;
  c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; const lx = (R0.x0 + R0.x1 + 1) / 2 * TILE, ly = R0.y0 * TILE - 6, w = c.measureText(label).width;
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(lx - w / 2 - 5, ly - 13, w + 10, 17); c.fillStyle = '#fff'; c.fillText(label, lx, ly);
}; }
{
  const cv = document.getElementById('game');
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || UI.tool.kind !== 'terra' || !UI.tool.type || terraMode() !== 'area') return;
    const t = screenToTile(e.clientX, e.clientY); UI.boxRect = { kind: 'terra', x0: t.x, y0: t.y, x1: t.x, y1: t.y, sx: e.clientX, sy: e.clientY }; UI.boxMemo = null;
    e.stopImmediatePropagation(); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  }, true);
}
{ const _mt = mapTip; mapTip = function (t) { const s = _mt(t); return UI.tool.kind === 'terra' && UI.tool.type && terraMode() === 'area' && s ? s + '<br><small>Drag a box to reshape a whole area</small>' : s; }; }
Object.assign(ACT, {
  terramode: a => { UI.terraMode = a; UI.brush3 = a === 'brush'; renderBuildMenu(); },
});

// ---------- Saves ----------
{ const _lg = loadGame; loadGame = function () {
  const ok = _lg(); if (!ok) return ok;
  let n = 0; for (const c of G.cities || []) if (c.grievance === undefined) { c.grievance = grievanceStart(c); if (c.grievance > 0) n++; }
  if (n) addLog(`😠 ${n} of your conquered cit${n === 1 ? 'y still resents' : 'ies still resent'} the conquest. Build, upgrade and hire there to win them over — see each city hall.`, 'bad');
  return ok;
}; }
