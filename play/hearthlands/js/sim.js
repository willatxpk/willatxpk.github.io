// ===== Core simulation: state, economy, kin =====
let G = null;

function newGame(opts) {
  const seed = opts.seed || Math.floor(Math.random() * 1e9);
  const nF = opts.factions || 5;
  const { tiles, caps, villages } = genWorld(seed, nF, opts.mapType); pathsDirty(); _landTiles = 0;
  const templates = FACTION_TEMPLATES.slice().sort(() => Math.random() - 0.5);
  G = {
    version: 3, seed, mapType: opts.mapType || 'continents', gov: 'chiefdom', econ: 'barter', history: [], nextFid: 100, nextVid: 1000,
    realm: { name: opts.name || 'Hearthvale', color: opts.color || PLAYER_COLORS[0], difficulty: opts.difficulty || 1 },
    time: { day: 1, hour: 6 }, speed: 1, settings: { dayLength: opts.dayLength || 24, pauseOnEvent: true, decide: 'major', autoKeys: {}, battles: 'play', autoResearch: true },
    res: { food: 140, wood: 70, stone: 30, iron: 0, tools: 10, coal: 0, gold: 60, influence: 15, knowledge: 0 },
    today: {}, rates: {},
    tiles, buildings: {}, nextB: 1, kin: [], nextK: 1, armies: [], nextA: 1,
    cap: { x: caps[0].x, y: caps[0].y },
    factions: [], villages: [], cities: [], spies: [], techs: {}, research: { queue: [], progress: {} }, policies: { tax: 'normal', rations: 'normal', army: 'guard' }, priorities: [], recruits: [], recruitDay: 0,
    festival: 0, festivalCd: 0, drought: 0, plague: 0, quarantine: 0, mods: [],
    stats: { claimed: 0, wishes: 0, trades: 0, battlesWon: 0, trained: 0, tiles: 0, born: 0, died: 0 },
    goalsDone: [], log: [], eventQueue: [], nextEventDay: 3, flags: {}, marketVol: 0, victory: {},
  };
  for (let i = 1; i < caps.length; i++) {
    const t = templates[(i - 1) % templates.length];
    makeFaction({ id: i, name: t.name, color: t.color, leader: t.leader, personality: t.personality, base: t.base, x: caps[i].x, y: caps[i].y, troops: 10 + randi(0, 6), sci: randi(0, 90), gov: 'chiefdom' });
  }
  for (let i = 1; i <= G.factions.length; i++) decorateAI(i);
  G.expeditions = []; G.borderPts = 0;
  const vnames = VILLAGE_NAMES.slice().sort(() => Math.random() - 0.5);
  villages.forEach((v, k) => {
    const d = dist(v.x, v.y, caps[0].x, caps[0].y);
    const vg = { id: 50 + k, name: vnames[k % vnames.length], minor: true, color: '#a08a64', leader: 'Elder ' + pick(FIRST_NAMES), cap: { x: v.x, y: v.y },
      troops: Math.round(2 + d / 7 + Math.random() * 2), quality: 1, war: false, pop: randi(3, 5), tiles: 0, relation: 0, dead: false };
    G.villages.push(vg); decorateVillage(vg);
  });
  for (const f of G.factions) aiBuildRoads(f);
  for (const v of G.villages) aiBuildRoads(v);
  // starting buildings
  placeBuilding('townhall', G.cap.x, G.cap.y, true);
  const spots = [[2, 1], [-2, 1], [1, 2]];
  let built = 0;
  for (const [dx, dy] of spots.concat([[2, -1], [-2, -1], [-1, 2], [0, -2], [2, 2]])) {
    if (built >= 3) break;
    const x = G.cap.x + dx, y = G.cap.y + dy;
    if (canBuildBasic(x, y)) { placeBuilding('hut', x, y, true); built++; }
  }
  // a little lane in front of the town hall
  for (const [dx, dy] of [[0, 1], [1, 1], [-1, 1]]) {
    const i = idx(G.cap.x + dx, G.cap.y + dy);
    if (!G.tiles.bld[i] && TERRAIN[G.tiles.terrain[i]].pass) G.tiles.road[i] = 1;
  }
  // starting kin: two couples + two singles + two children
  const fam1 = pick(SURNAMES), fam2 = pick(SURNAMES.filter(s => s !== fam1));
  const a = makeKin({ age: 28, surname: fam1 }), b = makeKin({ age: 26, surname: fam1 });
  const c = makeKin({ age: 34, surname: fam2 }), d = makeKin({ age: 31, surname: fam2 });
  a.partner = b.id; b.partner = a.id; c.partner = d.id; d.partner = c.id;
  makeKin({ age: 8, surname: fam1 }); makeKin({ age: 5, surname: fam2 });
  makeKin({ age: 22 }); makeKin({ age: 19 });
  for (const k of G.kin) { k.x = G.cap.x + rand(-1, 1); k.y = G.cap.y + rand(-1, 1) + 1; }
  // kids live with their family
  assignHousing(); autoAssignJobs();
  recountTiles(); recomputeAppeal(); refreshMults();
  refreshRecruits(true);
  addLog(`The people of ${G.realm.name} gather around their new Town Hall.`, 'good');
  return G;
}

function canBuildBasic(x, y) {
  if (!inB(x, y)) return false;
  const i = idx(x, y);
  return G.tiles.owner[i] === 0 && TERRAIN[G.tiles.terrain[i]].build && !G.tiles.bld[i];
}

// ---------- Helpers ----------
function countB(type) { let c = 0; for (const b of Object.values(G.buildings)) if (b.type === type) c++; return c; }
function bAt(x, y) { if (!inB(x, y)) return null; const id = G.tiles.bld[idx(x, y)]; return id ? G.buildings[id] : null; }
function townhall() { return Object.values(G.buildings).find(b => b.type === 'townhall'); }
function thLevel() { const t = townhall(); return t ? t.level : 1; }
function countRoads() { let c = 0; for (let i = 0; i < G.tiles.road.length; i++) if (G.tiles.road[i] && G.tiles.owner[i] === 0) c++; return c; }
function hasTech(t) { return !!G.techs[t]; }
function branchLevel(br) { let n = 0; for (const id in G.techs) if (TECHS[id] && TECHS[id].branch === br) n++; return n; }
function blCached(br) { return (FXC.bl && FXC.bl[br]) || 0; }
function branchOfRes(r) { for (const k in BRANCHES) if (BRANCHES[k].res.includes(r)) return k; return null; }
// ---------- Research: knowledge flows into the queued discovery each day ----------
function techAvail(id) { const t = TECHS[id]; return !hasTech(id) && t.era <= curEra() && t.req.every(hasTech); }
function queueTech(id) {
  const Q = G.research; if (hasTech(id)) return;
  if (TECHS[id].era > curEra() && !Q.queue.includes(id)) { toast(`Reach the ${ERAS[TECHS[id].era].name} first.`); return; }
  if (Q.queue.includes(id)) { // unqueue it and anything that depends on it
    const drop = new Set([id]); let grew = true;
    while (grew) { grew = false; for (const q of Q.queue) if (!drop.has(q) && TECHS[q].req.some(r => drop.has(r))) { drop.add(q); grew = true; } }
    Q.queue = Q.queue.filter(q => !drop.has(q)); return;
  }
  const add = t => { if (hasTech(t) || Q.queue.includes(t)) return; for (const r of TECHS[t].req) add(r); Q.queue.push(t); };
  add(id); researchTick();
}
function researchTick() {
  const Q = G.research;
  Q.queue = Q.queue.filter(id => TECHS[id] && !hasTech(id));
  if (!Q.queue.length && G.settings.autoResearch) {
    const av = Object.keys(TECHS).filter(techAvail).sort((a, b) => TECHS[a].cost - TECHS[b].cost);
    if (av.length) Q.queue.push(av[0]);
  }
  let guard = 0;
  while (Q.queue.length && G.res.knowledge > 0.001 && guard++ < 20) {
    const id = Q.queue[0], t = TECHS[id];
    if (!t.req.every(hasTech)) { Q.queue.push(Q.queue.shift()); continue; }
    const have = Q.progress[id] || 0, put = Math.min(G.res.knowledge, t.cost - have);
    G.res.knowledge -= put; Q.progress[id] = have + put;
    if (Q.progress[id] >= t.cost - 0.001) {
      completeTech(id); Q.queue.shift();
      if (!Q.queue.length && G.settings.autoResearch) { const av = Object.keys(TECHS).filter(techAvail).sort((a, b) => TECHS[a].cost - TECHS[b].cost); if (av.length) Q.queue.push(av[0]); }
    } else break;
  }
}
function completeTech(id) {
  const t = TECHS[id]; G.techs[id] = G.time.day; delete G.research.progress[id];
  const br = BRANCHES[t.branch];
  addLog(`📜 Discovered ${t.name}: ${t.desc} (${br.icon} ${br.name} is now level ${branchLevel(t.branch)})`, 'good');
  toast(`📜 ${t.name} discovered! ${br.icon} ${br.name} Lv ${branchLevel(t.branch)}`);
  refreshMults();
}
function avgMood() { if (!G.kin.length) return 0; let s = 0; for (const k of G.kin) s += k.mood; return s / G.kin.length; }
let _kmap = null, _kmapOf = null;
function kinById(id) { if (!_kmap || _kmapOf !== G.kin) { _kmap = new Map(); for (const k of G.kin) _kmap.set(k.id, k); _kmapOf = G.kin; } return _kmap.get(id); }
function isAdult(k) { return k.age >= 16; }
function isElder(k) { return k.age >= 62; }
function canWork(k) { return isAdult(k) && !isElder(k) && !k.soldier; }
function season() { return 0; } // seasons were removed
function year() { return Math.floor((G.time.day - 1) / YEAR_DAYS) + 1; }
function yearDay() { return ((G.time.day - 1) % YEAR_DAYS) + 1; }
function anyWar() { return G.factions.some(f => f.war); }
function maxLevelFor(type) {
  const d = B[type];
  if (type === 'townhall') return MAX_ERA;
  return Math.min(d.maxLevel || 1, thLevel());
}
let _capCache = {};
function storageCap(res) {
  if (_capCache[res] !== undefined) return _capCache[res];
  let cap = 200 + (thLevel() - 1) * 150;
  for (const b of Object.values(G.buildings)) {
    const d = B[b.type];
    if (d.storage) cap += d.storage * b.level;
    if (res === 'food' && d.foodStorage) cap += d.foodStorage * b.level;
    if (d.prod && d.prod[res]) cap += 30 * b.level; // workplaces keep a stockpile of what they make
  }
  if (res === 'food') cap += fx('foodStorage');
  cap = Math.round(cap * (1 + fx('storageMult')));
  _capCache[res] = cap;
  return cap;
}
function canAfford(cost) { for (const r in cost) if ((G.res[r] || 0) < cost[r] - 1e-6) return false; return true; }
function pay(cost) { for (const r in cost) { G.res[r] -= cost[r]; track(r, -cost[r]); } }
function gain(r, amt) {
  if (CAPPED.includes(r)) { const cap = storageCap(r); const before = G.res[r]; G.res[r] = Math.min(cap, G.res[r] + amt); if (G.res[r] < before) G.res[r] = before; track(r, G.res[r] - before); }
  else { G.res[r] += amt; track(r, amt); }
}
function gainAll(o) { for (const r in o) gain(r, o[r]); }
function track(r, v) { G.today[r] = (G.today[r] || 0) + v; ROLL.cur[r] = (ROLL.cur[r] || 0) + v; }
// rolling 24-hour flow so the top bar shows live rates instead of waiting for a new day
const ROLL = { buckets: [], cur: {} };
function rollHour() { ROLL.buckets.push(ROLL.cur); ROLL.cur = {}; if (ROLL.buckets.length > 24) ROLL.buckets.shift(); }
function liveRate(r) { const n = ROLL.buckets.length; if (n < 12) return G.rates[r] || 0; let s = 0; for (const b of ROLL.buckets) s += b[r] || 0; return s * 24 / n; }
function costStr(c) { return Object.entries(c).filter(([, v]) => v > 0).map(([r, v]) => `${RES_INFO[r].icon}${Math.ceil(v)}`).join(' ') || 'Free'; }
function scaleCost(c, m) { const o = {}; for (const r in c) o[r] = Math.ceil(c[r] * m); return o; }
function addMod(name, mood, days, kinId) { G.mods.push({ name, mood, until: G.time.day + days, kin: kinId || null }); }
function upgradeCost(b) {
  if (b.type === 'townhall') return ERAS[b.level + 1] ? ERAS[b.level + 1].cost : null;
  const base = B[b.type].cost || {}, L = b.level;
  const c = scaleCost(base, 1.6 * L);
  if (L >= 2) c.tools = (c.tools || 0) + 5 * L;
  if (L >= 3) c.stone = (c.stone || 0) + 12 * L;
  if (L >= 4) c.gold = (c.gold || 0) + 25 * L;
  if (L >= 5) c.iron = (c.iron || 0) + 12 * L;
  return scaleCost(c, Math.max(0.4, 1 - fx('upCost')));
}

// ---------- Site evaluation ----------
function siteInfo(type, x, y, opt) {
  const d = B[type];
  const res = { ok: true, reason: '', mult: 1, notes: [] };
  if (!inB(x, y)) return { ok: false, reason: 'Off the map' };
  const i = idx(x, y), t = G.tiles.terrain[i];
  if (G.tiles.owner[i] !== 0) return { ok: false, reason: 'Not your territory' };
  if (!TERRAIN[t].build) return { ok: false, reason: `Can't build on ${TERRAIN[t].name}` };
  if (G.tiles.bld[i]) return { ok: false, reason: 'Occupied' };
  if (!(opt && opt.moving)) {
    if (d.tech && !hasTech(d.tech)) return { ok: false, reason: `Needs ${TECHS[d.tech].name}` };
    if (d.th && thLevel() < d.th) return { ok: false, reason: `Needs the ${ERAS[d.th].name}` };
    if (d.unique && countB(type) > 0) return { ok: false, reason: 'Only one allowed' };
  }
  if (type === 'cityhall') { const bl = citySiteBlock(x, y); if (bl) return { ok: false, reason: bl }; }
  const c8 = tt => countAround(x, y, 1, (nx, ny) => tt.includes(terr(nx, ny)));
  switch (d.rule) {
    case 'farm':
      if (t === T.MEADOW) { res.mult = 1.5; res.notes.push('Fertile meadow ×1.5'); }
      else if (t === T.GRASS) res.mult = 1;
      else if (t === T.SAND) { res.mult = 0.5; res.notes.push('Poor sandy soil ×0.5'); }
      else if (t === T.FOREST) { res.mult = 0.9; res.notes.push('Cleared forest ×0.9'); }
      else return { ok: false, reason: 'Farms need open ground' };
      break;
    case 'water': { const w = c8([T.WATER, T.DEEP]); if (!w) return { ok: false, reason: 'Must touch water' }; res.mult = Math.min(1.5, 0.6 + 0.15 * w); res.notes.push(`${w} water tiles`); break; }
    case 'forestAdj': { const f = c8([T.FOREST]); if (!f) return { ok: false, reason: 'Needs forest next to it' }; res.mult = Math.min(1.5, 0.6 + 0.12 * f); res.notes.push(`${f} forest tiles`); break; }
    case 'lumber': { const f = c8([T.FOREST]); if (!f) return { ok: false, reason: 'Needs forest next to it' }; res.mult = Math.min(1.6, 0.4 + 0.15 * f); res.notes.push(`${f} forest tiles`); break; }
    case 'hills': {
      if (t === T.HILLS) { res.mult = 1.2; res.notes.push('On hills ×1.2'); }
      else { const h = c8([T.HILLS, T.MOUNTAIN]); if (!h) return { ok: false, reason: 'Must be on or beside hills' }; res.mult = Math.min(1.3, 0.6 + 0.15 * h); res.notes.push(`${h} hill/mountain tiles`); }
      break;
    }
    case 'coal': {
      const sp = G.tiles.special[i], h = c8([T.HILLS, T.MOUNTAIN]);
      if (sp !== 3 && !h && t !== T.HILLS) return { ok: false, reason: 'Needs a coal seam, or hills or mountains beside it' };
      res.mult = sp === 3 ? 1.8 : Math.min(1.1, 0.5 + 0.1 * h + (t === T.HILLS ? 0.2 : 0));
      res.notes.push(sp === 3 ? 'Coal seam ×1.8' : `${h} hill/mountain tiles (prospect for a coal seam!)`);
      break;
    }
    case 'mountain': {
      const m = c8([T.MOUNTAIN]), sp = G.tiles.special[i];
      if (!m && !sp) return { ok: false, reason: 'Needs a mountain beside it or an ore vein' };
      res.mult = 0.7 + 0.12 * Math.min(m, 5) + (sp === 1 ? 0.6 : 0);
      if (sp === 1) res.notes.push('Iron vein +0.6'); if (sp === 2) res.notes.push('Gold vein: also mines gold'); if (sp === 4) res.notes.push('Gem pocket: also mines gold and influence');
      if (m) res.notes.push(`${m} mountain tiles`);
      break;
    }
  }
  if (t === T.FOREST && type !== 'tree') res.notes.push('Clears forest (+8 wood)');
  if (!(opt && opt.quick) && d.workers && (d.prod || d.consume) && type !== 'barracks') { const rf = roadFactor({ type, x, y }); if (rf.note) res.notes.push(rf.note.replace(/^[^ ]+ /, '')); }
  if (!(opt && opt.quick)) { if (type === 'farm' && Object.values(G.buildings).some(o => o.type === 'windmill' && dist(o.x, o.y, x, y) <= 3)) res.notes.push('Windmill +25%'); if (d.power < 0) res.notes.push(`Needs ${-d.power} power`); }
  return res;
}

function placeBuilding(type, x, y, free) {
  const d = B[type];
  if (!free) {
    const si = siteInfo(type, x, y); if (!si.ok) return { ok: false, reason: si.reason };
    if (!canAfford(d.cost || {})) return { ok: false, reason: 'Not enough resources' };
    pay(d.cost || {});
  }
  const i = idx(x, y);
  if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; if (!free) gain('wood', 8); R.terrainDirty = true; }
  if (G.tiles.road[i]) pathsDirty();
  G.tiles.road[i] = 0;
  const b = { id: G.nextB++, type, x, y, level: 1, roof: d.roof || pick(ROOF_COLORS), workers: [], paused: false, burning: 0, built: G.time.day };
  G.buildings[b.id] = b;
  G.tiles.bld[i] = b.id;
  if (type === 'outpost') {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || Math.hypot(dx, dy) > 2.3) continue;
      if (G.tiles.owner[idx(nx, ny)] === -1) { G.tiles.owner[idx(nx, ny)] = 0; n++; }
    }
    G.stats.claimed += n; recountTiles(); R.territoryDirty = true;
    if (!free) addLog(`An outpost claims ${n} new tiles.`, 'good');
  }
  if (d.appeal) recomputeAppeal();
  if (!free) { autoAssignJobs(); if (d.housing) assignHousing(); if (type === 'barracks') autoArmy(); }
  if (type === 'cityhall' && !free) foundCity(b);
  if (type === 'ark' && !free && !G.victory.ark) { G.victory.ark = true; queueEvent('victoryArk'); history(`${G.realm.name} launched the Starship Ark.`, '🚀'); }
  if (B[type].unique && !free) history(`${G.realm.name} completed the ${B[type].name}.`, B[type].icon);
  _capCache = {}; powerGrid(); netDirty();
  return { ok: true, b };
}

function demolish(b, silent) {
  for (const kid of b.workers) { const k = kinById(kid); if (k) { k.job = null; if (k.soldier) { k.soldier = false; } } }
  for (const k of G.kin) { if (k.home === b.id) k.home = null; if (k.job === b.id) k.job = null; }
  G.tiles.bld[idx(b.x, b.y)] = 0;
  delete G.buildings[b.id];
  if (b.type === 'cityhall' && G.cities) { const c = G.cities.find(c => c.bid === b.id); if (c) addLog(`🏚️ The city of ${c.name} was abandoned.`, 'bad'); G.cities = G.cities.filter(c => c.bid !== b.id); }
  if (!silent && b.type !== 'townhall') { const c = B[b.type].cost || {}; for (const r in c) if (CAPPED.includes(r)) gain(r, Math.floor(c[r] * 0.3)); }
  if (B[b.type].appeal) recomputeAppeal();
  _capCache = {}; powerGrid(); netDirty();
  if (R.selected && R.selected.kind === 'b' && R.selected.id === b.id) R.selected = null;
  assignHousing(); autoAssignJobs();
}

function moveBuilding(b, x, y) {
  if (b.type === 'townhall' || b.type === 'outpost' || b.type === 'cityhall') return { ok: false, reason: `The ${B[b.type].name} can't be moved` };
  if (x === b.x && y === b.y) return { ok: false, reason: 'Pick a different spot' };
  const si = siteInfo(b.type, x, y, { moving: true }); if (!si.ok) return { ok: false, reason: si.reason };
  G.tiles.bld[idx(b.x, b.y)] = 0;
  const i = idx(x, y);
  if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; gain('wood', 8); R.terrainDirty = true; }
  G.tiles.road[i] = 0;
  b.x = x; b.y = y; G.tiles.bld[i] = b.id;
  for (const k of G.kin) if (k.dest === b.id || k.job === b.id || k.home === b.id) { k.dest = null; k.path = null; k.plan = null; }
  netDirty(); recomputeAppeal(); refreshMults();
  return { ok: true };
}

function roadCost(id) { const r = ROADS[id]; return id === 'bridge' && fx('bridge') ? scaleCost(r.cost, 0.5) : r.cost; }
function tryUpgrade(b) {
  const d = B[b.type];
  if (b.type === 'townhall') { const bl = advanceBlock(); if (bl) return bl; return advanceEra() ? null : 'Not enough resources'; }
  if (!d.maxLevel || b.level >= d.maxLevel) return 'Already at its highest level';
  if (b.level >= maxLevelFor(b.type)) return `Needs the ${ERAS[b.level + 1].name}`;
  return ACT.upgrade(String(b.id)) === false ? 'Not enough resources' : null;
}
function terraCost(kind) { const f = Math.min(0.6, fx('terra')); return f ? scaleCost(TERRAFORM[kind].cost, 1 - f) : TERRAFORM[kind].cost; }
function terraformInfo(kind, x, y) {
  const tf = TERRAFORM[kind]; if (!tf || !inB(x, y)) return { ok: false, reason: '' };
  const i = idx(x, y), t = G.tiles.terrain[i];
  if (G.tiles.owner[i] !== 0) return { ok: false, reason: 'Not your territory' };
  if (G.tiles.bld[i]) return { ok: false, reason: 'A building is in the way' };
  if (tf.tech && !hasTech(tf.tech)) return { ok: false, reason: `Needs ${TECHS[tf.tech].name}` };
  if (!tf.from.includes(t)) return { ok: false, reason: `Can't ${tf.name.toLowerCase()} on ${TERRAIN[t].name}` };
  if (kind === 'dig' && G.tiles.road[i] === 3) return { ok: false, reason: 'There is a bridge here' };
  return { ok: true, to: kind === 'fill' && t === T.DEEP ? T.WATER : tf.to };
}
function terraform(kind, x, y, quiet) {
  const tf = TERRAFORM[kind], info = terraformInfo(kind, x, y);
  if (!info.ok) { if (!quiet && info.reason) toast(info.reason); return false; }
  if (kind === 'prospect') return prospect(x, y, quiet);
  const tcost = terraCost(kind);
  if (!canAfford(tcost)) { if (!quiet) toast(`Needs ${costStr(tcost)}`); return false; }
  pay(tcost); if (tf.gain) gainAll(tf.gain);
  const i = idx(x, y);
  G.tiles.terrain[i] = info.to;
  if (!TERRAIN[info.to].pass) G.tiles.road[i] = 0; // roads drown
  else if (G.tiles.road[i] === 3) G.tiles.road[i] = 1; // filled under a bridge: becomes a path
  if (info.to !== T.HILLS) G.tiles.special[i] = 0;
  else if (kind === 'carve' && Math.random() < 0.3) { G.tiles.special[i] = rollVein(); toast(`${VEINS[G.tiles.special[i]].icon} The tunnel exposed a ${VEINS[G.tiles.special[i]].name.toLowerCase()}!`); }
  if (tf.loot) digLoot(kind, x, y);
  for (const k of G.kin) if (k.path && k.path.includes(i)) k.path = null;
  R.dirtyTiles.push(i); refreshMults(); pathsDirty();
  return true;
}

function recountTiles() { let c = 0; const fc = {}; for (let i = 0; i < G.tiles.owner.length; i++) { const o = G.tiles.owner[i]; if (o === 0) c++; else if (o > 0) fc[o] = (fc[o] || 0) + 1; } G.stats.tiles = c; for (const f of G.factions) f.tiles = fc[f.id] || 0; for (const v of G.villages || []) { v.tiles = fc[v.id] || 0; if (!v.tiles && !v.dead) v.dead = true; } }

function claimCost(x, y) {
  let c = 8 + G.stats.tiles * 0.12;
  c *= TERRAIN_CLAIM[G.tiles.terrain[idx(x, y)]] || 1;
  const sd = settleDist(x, y); if (sd > 5) c *= 1 + (sd - 5) * 0.07; // far from any settlement: hard to hold
  const foreign = countAround(x, y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] > 0);
  if (foreign) c *= 1.5;
  c *= Math.max(0.3, 1 - fx('claim'));
  return Math.ceil(c);
}
function canClaim(x, y) {
  if (!inB(x, y)) return false;
  if (G.tiles.owner[idx(x, y)] !== -1) return false;
  return N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) === 0);
}
function claimTile(x, y) {
  if (!canClaim(x, y)) return false;
  const c = claimCost(x, y);
  if (G.res.influence < c) { toast('Not enough influence 👑'); return false; }
  G.res.influence -= c; track('influence', -c);
  G.tiles.owner[idx(x, y)] = 0; G.stats.claimed++; recountTiles(); R.territoryDirty = true;
  for (const f of G.factions) if (countAround(x, y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === f.id)) f.relation -= f.personality === 'expansionist' ? 2 : 0.5;
  return true;
}

// ---------- Kin ----------
function rollTraits(parents) {
  const keys = Object.keys(TRAITS); const out = [];
  const pool = parents ? parents.flatMap(p => p.traits) : [];
  const n = Math.random() < 0.6 ? 2 : 1;
  let guard = 0;
  while (out.length < n && guard++ < 30) {
    const t = pool.length && Math.random() < 0.5 ? pick(pool) : pick(keys);
    if (out.includes(t)) continue;
    if (TRAIT_PAIRS_EXCLUSIVE.some(p => p.includes(t) && p.some(o => o !== t && out.includes(o)))) continue;
    out.push(t);
  }
  return out;
}
const SKIN = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#f6d7b0', '#a86b3c'];
const HAIR = ['#2c1b10', '#5a3825', '#a0522d', '#d6b370', '#1a1a1a', '#b03a2e', '#888'];
function makeKin(o = {}) {
  const k = {
    id: G.nextK++, name: o.name || pick(FIRST_NAMES), surname: o.surname || pick(SURNAMES), age: o.age ?? randi(18, 40),
    traits: o.traits || rollTraits(o.parents), needs: { food: 80, rest: 80, fun: 70, social: 70 }, health: 100, mood: 60,
    home: null, job: null, partner: null, friends: {}, soldier: false, state: 'idle', act: null, dest: null, path: null, pi: 0,
    x: o.x ?? G.cap.x, y: o.y ?? G.cap.y, wish: null, wishCd: randi(2, 6), lowMoodDays: 0, sick: 0, skin: pick(SKIN), hair: pick(HAIR),
    shirt: pick(['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#7f8c8d', '#f39c12']), parents: o.parents ? o.parents.map(p => p.id) : [],
    born: G.time.day, away: false, thought: '',
  };
  initLife(k, o);
  G.kin.push(k); _kmap = null;
  return k;
}
function kinName(k) { return `${k.name} ${k.surname}`; }
function homeOf(k) { return k.home ? G.buildings[k.home] : null; }
function houseCap(b) { const d = B[b.type]; return d.housing ? d.housing[b.level - 1] : 0; }
function residents(b) { return G.kin.filter(k => k.home === b.id); }

function assignHousing() {
  const houses = Object.values(G.buildings).filter(b => B[b.type].housing);
  const occ = {}; for (const h of houses) occ[h.id] = 0;
  for (const k of G.kin) { if (k.home && occ[k.home] === undefined) k.home = null; if (k.soldier && k.home) { /* soldiers keep homes if they have families */ } if (k.home) occ[k.home]++; }
  // evict overflow
  for (const h of houses) { const rs = residents(h); while (rs.length > houseCap(h)) { const k = rs.pop(); k.home = null; occ[h.id]--; } }
  const free = h => houseCap(h) - occ[h.id];
  const homeless = G.kin.filter(k => !k.home && !k.away);
  // children with parents first
  for (const k of homeless) {
    if (k.home) continue;
    const fam = [k];
    if (k.partner) { const p = kinById(k.partner); if (p && !p.home) fam.push(p); else if (p && p.home && free(G.buildings[p.home]) > 0) { k.home = p.home; occ[p.home]++; continue; } }
    if (!isAdult(k)) { const par = k.parents.map(kinById).find(p => p && p.home && free(G.buildings[p.home]) > 0); if (par) { k.home = par.home; occ[par.home]++; continue; } }
    const h = houses.filter(h => free(h) >= fam.length).sort((a, b) => dist(a.x, a.y, k.x, k.y) - dist(b.x, b.y, k.x, k.y))[0]
      || houses.filter(h => free(h) >= 1).sort((a, b) => dist(a.x, a.y, k.x, k.y) - dist(b.x, b.y, k.x, k.y))[0];
    if (!h) continue;
    for (const m of fam) { if (free(h) > 0 && !m.home) { m.home = h.id; occ[h.id]++; } }
  }
}
function totalBeds() { let f = 0; for (const b of Object.values(G.buildings)) if (B[b.type].housing) f += houseCap(b); return f; }
function freeHousing() { let f = 0; for (const b of Object.values(G.buildings)) if (B[b.type].housing) f += houseCap(b) - residents(b).length; return f; }

// Food is "low" when stores cover less than ~5 days of eating.
function dailyFoodUse() { return G.kin.filter(k => !k.away).reduce((s, k) => s + (isAdult(k) ? 1 : 0.5), 0) * ({ meager: 0.7, normal: 1, generous: 1.35 }[G.policies.rations] || 1) * foodUseMult() + (typeof subjectsFood === 'function' ? subjectsFood() : 0); }
function foodUseMult() { return Math.max(0.5, 1 - fx('foodUse')); }
function foodDays() { const u = dailyFoodUse(); return u > 0 ? G.res.food / u : 99; }
let _lfAt = -1, _lf = false;
function isLowFood() { const t = Math.floor(G.time.day * 24 + G.time.hour); if (t !== _lfAt) { _lfAt = t; _lf = foodDays() < 5; } return _lf; }
// Prioritised buildings (and food buildings during a shortage) take one extra worker on overtime.
function overtime(b) { const d = B[b.type]; if (!d.workers || b.type === 'barracks') return 0; return (G.priorities || []).some(r => producesRes(b, r)) || (isLowFood() && producesRes(b, 'food')) ? 1 : 0; }
function workerSlots(b) { const d = B[b.type]; return d.workers ? d.workers + (b.level - 1) + overtime(b) : 0; }
function autoAssignJobs() {
  for (const b of Object.values(G.buildings)) b.workers = b.workers.filter(id => { const k = kinById(id); return k && k.job === b.id && (k.soldier ? b.type === 'barracks' : canWork(k)); });
  for (const k of G.kin) if (k.job && (!G.buildings[k.job] || !G.buildings[k.job].workers.includes(k.id))) k.job = null;
  for (const b of Object.values(G.buildings)) {
    if (b.paused && b.type !== 'barracks') { for (const id of b.workers) { const k = kinById(id); if (k) k.job = null; } b.workers = []; }
    else if (b.type !== 'barracks') while (b.workers.length > workerSlots(b)) { const k = kinById(b.workers.pop()); if (k) k.job = null; }
  }
  const lowFood = isLowFood();
  const open = Object.values(G.buildings).filter(b => !b.paused && b.type !== 'barracks' && workerSlots(b) > b.workers.length);
  // Fill in priority tiers; within a tier hand out one worker per building per round so jobs spread evenly.
  const tiers = {};
  for (const b of open) (tiers[jobPrio(b, lowFood)] = tiers[jobPrio(b, lowFood)] || []).push(b);
  for (const p of Object.keys(tiers).map(Number).sort((a, c) => c - a)) {
    let list = tiers[p];
    while (list.length) {
      list.sort((a, c) => a.workers.length - c.workers.length);
      for (const b of list) {
        const idle = G.kin.filter(k => canWork(k) && !k.job && !k.away);
        if (!idle.length) return;
        idle.sort((a, c) => jobScore(c, b) - jobScore(a, b));
        const k = idle[0]; k.job = b.id; b.workers.push(k.id);
      }
      list = list.filter(b => b.workers.length < workerSlots(b));
    }
  }
}
function producesRes(b, r) { const d = B[b.type]; return !!(d.prod && d.prod[r]) || (r === 'gold' && b.type === 'mine' && G.tiles.special[idx(b.x, b.y)] === 2); }
function jobPrio(b, lowFood) {
  const d = B[b.type]; let p = b.priority ? 50 : 0;
  const pr = G.priorities || [];
  for (let i = 0; i < pr.length; i++) if (producesRes(b, pr[i])) p += 30 - i * 10;
  if (d.prod && d.prod.food) p += lowFood ? 60 : 1;
  if (d.power > 0 && G.power && G.power.ratio < 1) p += 45; // keep the lights on
  return p;
}
// Move workers from low-priority jobs into higher-priority buildings with open slots.
function rebalanceJobs() {
  const lowFood = isLowFood();
  const bs = Object.values(G.buildings).filter(b => !b.paused && b.type !== 'barracks' && workerSlots(b) > 0);
  const want = bs.filter(b => jobPrio(b, lowFood) > 1 && b.workers.length < workerSlots(b)).sort((a, c) => jobPrio(c, lowFood) - jobPrio(a, lowFood));
  let moved = 0;
  for (const b of want) {
    const pb = jobPrio(b, lowFood);
    while (b.workers.length < workerSlots(b)) {
      let donor = null, dp = pb, dn = 0;
      for (const o of bs) {
        if (o === b || !o.workers.length) continue;
        const op = jobPrio(o, lowFood);
        // take from the lowest-priority building, and among equals the most crowded one
        if (op < dp || (op === dp && donor && o.workers.length > dn)) { dp = op; donor = o; dn = o.workers.length; }
      }
      if (!donor) break;
      const k = kinById(donor.workers.pop()); if (!k) continue;
      k.job = b.id; b.workers.push(k.id); k.dest = null; k.path = null; k.plan = null; moved++;
    }
  }
  return moved;
}
// Unemployed adults forage so extra mouths are never pure loss.
function forageRate() { return fx('forage') ? 1.4 : 0.7; }
function dailyForage() {
  const idle = G.kin.filter(k => canWork(k) && !k.job && !k.away).length;
  if (idle) gain('food', idle * forageRate());
}
function foodWarning() {
  const days = foodDays(), rate = G.rates.food || 0;
  if (rate >= 0 || days > 4) { G.flags.foodWarn = -99; return; }
  if (G.time.day - (G.flags.foodWarn || -99) < 3) return;
  G.flags.foodWarn = G.time.day;
  if (rate > -0.5 && G.res.food > 2) return;
  const left = Math.max(0, Math.floor(G.res.food / Math.max(0.5, -rate)));
  const head = G.res.food < 2 ? '🍞 The stores are empty — kin are going hungry and only foragers bring in food.' : `🍞 Food is running low — about ${left} day${left === 1 ? '' : 's'} left.`;
  const msg = `${head} Food buildings take extra workers automatically; build more Farms, Fisheries or Hunters, or buy food at the Market.`;
  addLog(msg, 'bad'); toast(msg);
}
function togglePriority(r) {
  const pr = G.priorities || (G.priorities = []);
  const i = pr.indexOf(r);
  if (i >= 0) pr.splice(i, 1); else { pr.push(r); if (pr.length > 3) pr.shift(); }
  autoAssignJobs(); return rebalanceJobs();
}

// ---------- Recruiting settlers ----------
function makeRecruit() {
  const mk = () => ({ name: pick(FIRST_NAMES), age: randi(18, 40), traits: rollTraits() });
  const people = [mk()]; if (Math.random() < 0.35) people.push(mk());
  G.nextR = (G.nextR || 0) + 1;
  return { id: G.nextR, surname: pick(SURNAMES), people };
}
function recruitCost(r) { const n = r.people.length; return { gold: Math.round((14 + G.kin.length * 0.8) * n), food: 10 * n }; }
function refreshRecruits(force) {
  if (!G.recruits) G.recruits = [];
  if (force || G.time.day >= (G.recruitDay || 0)) { G.recruits = [makeRecruit(), makeRecruit(), makeRecruit()]; G.recruitDay = G.time.day + 6; }
}
function inviteRecruit(id) {
  const r = (G.recruits || []).find(o => o.id === id); if (!r) return false;
  if (freeHousing() < r.people.length) { toast('Not enough free beds — build or upgrade housing first.'); return false; }
  const c = recruitCost(r); if (!canAfford(c)) { toast(`Inviting them costs ${costStr(c)}`); return false; }
  pay(c);
  const edge = territoryEdgeTile();
  const ks = r.people.map(p => makeKin({ name: p.name, surname: r.surname, age: p.age, traits: p.traits, x: edge.x, y: edge.y }));
  if (ks.length === 2) { ks[0].partner = ks[1].id; ks[1].partner = ks[0].id; }
  G.recruits = G.recruits.filter(o => o !== r);
  addLog(`📯 ${ks.map(kinName).join(' and ')} accepted your invitation and moved in.`, 'good');
  assignHousing(); autoAssignJobs();
  return true;
}

function jobScore(k, b) { const hm = homeOf(k); let s = -dist(k.x, k.y, b.x, b.y) * 0.1 - (hm ? dist(hm.x, hm.y, b.x, b.y) * 0.15 : 0) + skillLv(k, skillOf(b.type)) * 1.2 + (k.pref && skillOf(b.type) === k.pref ? 8 : 0) - (k.avoid === b.id ? 20 : 0); if (b.type === 'farm' && k.traits.includes('greenthumb')) s += 5; if (b.type === 'library' && k.traits.includes('curious')) s += 5; if (b.type === 'temple' && k.traits.includes('devout')) s += 5; return s; }
function setJob(k, b) {
  if (k.job) { const ob = G.buildings[k.job]; if (ob) ob.workers = ob.workers.filter(i => i !== k.id); }
  k.job = null;
  if (b) { if (b.workers.length >= workerSlots(b)) { const bump = kinById(b.workers.pop()); if (bump) bump.job = null; } k.job = b.id; b.workers.push(k.id); }
  autoAssignJobs();
}

function kinProductivity(k) {
  let p = 0.5 + k.mood / 100;
  if (k.traits.includes('hardworking')) p *= 1.2; if (k.traits.includes('lazy')) p *= 0.85;
  p *= 0.5 + k.health / 200;
  return p;
}
// shops and banks earn more the more people there are to buy from
function customersMult() { return 0.8 + Math.min(1.4, (G.kin.length + (typeof subjectsCached === 'function' ? subjectsCached() * 0.5 : 0)) / 70); }
function buildingMult(b) {
  const d = B[b.type];
  let m = 1;
  if (d.rule) { const save = G.tiles.bld[idx(b.x, b.y)]; G.tiles.bld[idx(b.x, b.y)] = 0; const own = G.tiles.owner[idx(b.x, b.y)]; G.tiles.owner[idx(b.x, b.y)] = 0; const si = siteInfo(b.type, b.x, b.y, { quick: true, moving: true }); G.tiles.bld[idx(b.x, b.y)] = save; G.tiles.owner[idx(b.x, b.y)] = own; m = si.ok ? si.mult : (si.mult || 0.5); }
  m *= 1 + 0.35 * (b.level - 1);
  if (isWorkplace(b)) m *= roadFactor(b).m;
  if (d.prod && d.prod.gold) m *= customersMult();
  m *= Math.max(0.2, 1 + fxProd(b.type) + fx('work'));
  if (b.type === 'farm') {
    if (G.drought > 0) m *= countB('granary') ? 0.75 : 0.5;
    if (_mills.some(o => dist(o.x, o.y, b.x, b.y) <= 3)) m *= 1.25;
  }
  if (d.power < 0) m *= powerRatio(b);
  if (G.quarantine > 0) m *= 0.7;
  if (G.upheaval > 0) m *= 0.75;
  if (G.strike > 0) m *= 0.5;
  if ((G.smogShut || 0) > 0 && ['factory', 'coalmine', 'powerplant'].includes(b.type)) m = 0;
  return m;
}
// cache multipliers each hour
const _bm = {};

function techMultRes(r) {
  const br = branchOfRes(r);
  const m = br ? 1 + 0.03 * blCached(br) : 1;
  return Math.max(0.2, m + fxRes(r));
}

// ---------- Kin behaviour ----------
function planKin(k) {
  const h = G.time.hour;
  const home = homeOf(k);
  const th = townhall();
  const restSpot = home || th;
  let act = 'home', target = restSpot;
  if (k.age < 3) return { act: h >= 21 || h < 7 ? 'sleep' : 'home', target: restSpot }; // babies stay at home
  if (h >= 22 || h < 6) { act = 'sleep'; target = restSpot; }
  else if (h >= 7 && h < 17 && k.job && canWork(k) && G.buildings[k.job] && !(k.sabbatical > G.time.day)) { act = 'work'; target = G.buildings[k.job]; }
  else if (h >= 7 && h < 17 && k.soldier && k.job && G.buildings[k.job]) { act = 'work'; target = G.buildings[k.job]; }
  else if (h >= 8 && h < 15 && !isAdult(k)) {
    const lib = nearestOf(k, 'library');
    if (lib && k.age >= 6) { act = 'study'; target = lib; }
    else { const park = nearestOf(k, 'park'); act = 'play'; target = park || restSpot; }
  } else if (h >= 6 && h < 22) {
    // leisure: pick by needs
    const n = k.needs;
    if (k.plan && k.plan.until > G.time.hour && k.plan.day === G.time.day) return k.plan;
    const opts = [];
    const tav = nearestOf(k, 'tavern', 18); if (tav) opts.push({ act: 'leisure', target: tav, w: (100 - n.fun) + (100 - n.social) });
    const tem = nearestOf(k, 'temple', 18); if (tem) opts.push({ act: 'leisure', target: tem, w: (100 - n.fun) * 0.7 + (k.traits.includes('devout') ? 60 : 0) });
    const park = nearestOf(k, 'park', 14); if (park) opts.push({ act: 'park', target: park, w: (100 - n.fun) * 0.8 + appealAt(park.x, park.y) * 2 });
    const fr = bestFriend(k); if (fr && homeOf(fr) && homeOf(fr) !== home) opts.push({ act: 'visit', target: homeOf(fr), w: (100 - n.social) * 0.9 });
    opts.push({ act: 'home', target: restSpot, w: (100 - n.rest) * 0.8 + 10 });
    const st = strollSpot(k, restSpot); if (st) opts.push({ act: 'stroll', target: st, w: 30 + (100 - n.fun) * 0.3 });
    let tot = 0; for (const o of opts) { o.w = Math.max(1, o.w); tot += o.w; }
    let r = Math.random() * tot; let ch = opts[opts.length - 1];
    for (const o of opts) { r -= o.w; if (r <= 0) { ch = o; break; } }
    k.plan = { act: ch.act, target: ch.target, until: G.time.hour + randi(2, 3), day: G.time.day };
    return k.plan;
  }
  return { act, target };
}
function strollSpot(k, base) {
  for (let t = 0; t < 8; t++) {
    const x = base.x + randi(-5, 5), y = base.y + randi(-5, 5);
    if (!inB(x, y)) continue; const i = idx(x, y);
    if (G.tiles.owner[i] !== 0 || !TERRAIN[G.tiles.terrain[i]].pass || G.tiles.bld[i]) continue;
    if (t < 5 && !G.tiles.road[i] && appealAt(x, y) < 3 && Math.random() < 0.5) continue;
    return { id: 't' + i, x, y };
  }
  return null;
}
// buildings kin look for during their day, grouped by kind and rebuilt only when buildings change
let _byKind = null, _byKindKey = '';
function nearestOf(k, kind, maxD) {
  const key = G.nextB + ':' + Object.keys(G.buildings).length;
  if (!_byKind || _byKindKey !== key) { _byKind = { library: [], park: [], tavern: [], temple: [] }; for (const b of Object.values(G.buildings)) { if (b.type === 'library' || b.type === 'tavern' || b.type === 'temple') _byKind[b.type].push(b); if (B[b.type].park) _byKind.park.push(b); } _byKindKey = key; }
  let best = null, bd = maxD || 1e9;
  for (const b of _byKind[kind]) { const d = dist(b.x, b.y, k.x, k.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function nearestB(k, fn, maxD) {
  let best = null, bd = maxD || 1e9;
  for (const b of Object.values(G.buildings)) { if (!fn(b)) continue; const d = dist(b.x, b.y, k.x, k.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function bestFriend(k) {
  let best = null, bv = 15;
  if (k.partner) { const p = kinById(k.partner); if (p && !p.away) return p; }
  for (const id in k.friends) { if (k.friends[id] > bv) { const f = kinById(+id); if (f && !f.away) { bv = k.friends[id]; best = f; } } }
  return best;
}

function updateKin(k, dtH) {
  if (k.away) return;
  // movement
  if (k.path && k.pi < k.path.length) {
    const ti = k.path[k.pi]; const tx = ti % MAP_W, ty = (ti / MAP_W) | 0;
    const ci = idx(clamp(Math.round(k.x), 0, MAP_W - 1), clamp(Math.round(k.y), 0, MAP_H - 1));
    const rd = G.tiles.road[ci];
    let sp = (rd === 4 ? 10.2 : rd === 5 ? 9 : rd === 2 ? 7.2 : rd ? 4.8 : 3) * (isAdult(k) ? 1 : 0.85) * (k.health < 40 ? 0.7 : 1);
    if (rd && rd !== 3) sp *= 1 + fx('speed');
    let step = sp * dtH;
    while (step > 0 && k.pi < k.path.length) {
      const ti2 = k.path[k.pi]; const gx = ti2 % MAP_W, gy = (ti2 / MAP_W) | 0;
      const dx = gx - k.x, dy = gy - k.y, d = Math.hypot(dx, dy);
      if (d <= step) { k.x = gx; k.y = gy; step -= d; k.pi++; }
      else { k.x += dx / d * step; k.y += dy / d * step; step = 0; }
    }
    k.state = 'walking';
    if (k.pi >= k.path.length) { k.path = null; k.state = k.act; }
  }
  // needs
  const n = k.needs;
  const s = k.state;
  n.food = Math.max(0, n.food - 2.6 * dtH);
  if (s === 'sleep') {
    const h = homeOf(k); const comfort = h ? 0.75 + 0.15 * h.level : 0.45;
    n.rest = Math.min(100, n.rest + 9.5 * comfort * dtH);
  } else n.rest = Math.max(0, n.rest - (k.traits.includes('lazy') ? 3.4 : 3) * dtH);
  const socialDrain = k.traits.includes('social') ? 1.6 : k.traits.includes('loner') ? 0.5 : 1.1;
  n.fun = Math.max(0, n.fun - 1.5 * dtH);
  n.social = Math.max(0, n.social - socialDrain * dtH);
  if (s === 'leisure' && k.dest) { const b = G.buildings[k.dest]; if (b && B[b.type].leisure) { const L = B[b.type].leisure; n.fun = Math.min(100, n.fun + L.fun * dtH * (b.type === 'temple' && k.traits.includes('devout') ? 1.6 : 1)); n.social = Math.min(100, n.social + L.social * dtH * 0.8); } }
  if (s === 'park') { n.fun = Math.min(100, n.fun + (5 + Math.min(8, appealAt(k.x | 0, k.y | 0) / 3)) * dtH); n.social = Math.min(100, n.social + 2 * dtH); }
  if (s === 'stroll') { n.fun = Math.min(100, n.fun + (3 + Math.min(6, appealAt(Math.round(k.x), Math.round(k.y)) / 3)) * dtH); n.social = Math.min(100, n.social + 1 * dtH); }
  if (s === 'play') { n.fun = Math.min(100, n.fun + 8 * dtH); n.social = Math.min(100, n.social + 4 * dtH); }
  if (s === 'visit') { n.social = Math.min(100, n.social + 13 * dtH); n.fun = Math.min(100, n.fun + 3 * dtH); }
  if (s === 'home' || s === 'sleep') { if (k.partner) { const p = kinById(k.partner); if (p && p.home === k.home && (p.state === 'home' || p.state === 'sleep')) n.social = Math.min(100, n.social + 3 * dtH); } }
  if (s === 'home') n.rest = Math.min(100, n.rest + 3 * dtH);
  if (s === 'study') { n.fun = Math.min(100, n.fun + 2 * dtH); n.social = Math.min(100, n.social + 4 * dtH); }
  // health
  if (n.food < 5) k.health -= 0.22 * dtH; // ~2 weeks of total famine before anyone dies
  if (k.sick > 0) { k.health -= 0.38 * Math.max(0.2, 1 - fx('plague') * 0.6) * dtH * (healerNear(k) ? 0.6 : 1); } // a healthy adult survives a normal fever
  if (n.food > 30 && !k.sick) {
    let heal = 0.5 * (1 + fx('heal')); if (healerNear(k)) heal += 1 + fx('heal');
    k.health = Math.min(100, k.health + heal * dtH);
  }
}
let _healers = [], _mills = [];
function healerNear(k) { for (const b of _healers) if (dist(b.x, b.y, k.x, k.y) <= b.r) return true; return false; }

function routeKin(k) {
  if (k.away) return;
  const p = planKin(k);
  if (!p.target) return;
  const tgt = p.target;
  const sameDest = k.dest === tgt.id && k.act === p.act;
  if (sameDest && (k.path || Math.hypot(k.x - tgt.x, k.y - tgt.y) < 0.6)) return;
  k.act = p.act; k.dest = tgt.id;
  if (!isAvatar(k)) { k.x = tgt.x; k.y = tgt.y; k.path = null; k.state = p.act; return; }
  const sx = clamp(Math.round(k.x), 0, MAP_W - 1), sy = clamp(Math.round(k.y), 0, MAP_H - 1);
  if (sx === tgt.x && sy === tgt.y) { k.path = [idx(tgt.x, tgt.y)]; k.pi = 0; return; }
  const path = findPath(sx, sy, tgt.x, tgt.y);
  if (path) { k.path = path; k.pi = 0; }
  else { k.x = tgt.x; k.y = tgt.y; k.path = null; k.state = p.act; }
}

function hourlyKin() {
  const h = Math.floor(G.time.hour);
  const rm = { meager: 0.7, normal: 1, generous: 1.35 }[G.policies.rations];
  const rq = { meager: 0.75, normal: 1, generous: 1.15 }[G.policies.rations];
  if (h === 7 || h === 12 || h === 19) {
    // everyone shares what there is: a shortage means smaller meals for all, not nothing for some
    const eaters = G.kin.filter(k => !k.away);
    const portionOf = k => (isAdult(k) ? 1 : 0.5) / 3 * rm * (k.traits.includes('glutton') ? 1.5 : 1) * foodUseMult();
    const need = eaters.reduce((s, k) => s + portionOf(k), 0);
    const share = need > 0 ? Math.min(1, Math.max(0, G.res.food) / need) : 1;
    for (const k of eaters) {
      const portion = portionOf(k) * share;
      G.res.food -= portion; track('food', -portion);
      k.needs.food = Math.min(100, k.needs.food + 38 * rq * (0.25 + 0.75 * share));
    }
  }
  // socialising: kin in same place gain friendship
  const at = {};
  for (const k of G.kin) { if (k.away || k.state === 'walking' || !k.dest) continue; (at[k.dest] = at[k.dest] || []).push(k); }
  for (const id in at) {
    const g = at[id]; if (g.length < 2) continue;
    const leisure = ['leisure', 'park', 'visit', 'play', 'study'].includes(g[0].state);
    for (const a of g) {
      a.needs.social = Math.min(100, a.needs.social + Math.min(6, g.length * 1.5));
      for (const b of g) if (a !== b) {
        const inc = (leisure ? 3 : 1) * (a.traits.includes('social') ? 1.5 : 1) * ((a.rivals && a.rivals[b.id] > 30) ? 0.2 : 1);
        a.friends[b.id] = Math.min(100, (a.friends[b.id] || 0) + inc);
        if (a.id < b.id && g.length <= 12) socialMoment(a, b, leisure);
      }
    }
  }
  // mood
  const mods = moodModifiers();
  for (const k of G.kin) {
    const n = k.needs;
    let target = (n.food + n.rest + n.fun + n.social) / 4 * 0.7 + 12;
    const home = homeOf(k);
    if (home) { const hd = B[home.type]; target += hd.comfort[home.level - 1] * 0.6 * (home.level >= (hd.powerLv || 99) ? powerRatio(home) : 1); target += Math.min(14, appealAt(home.x, home.y) * (k.traits.includes('artistic') ? 1.4 : 0.7)); }
    else target -= 15;
    if (k.traits.includes('cheerful')) target += 8; if (k.traits.includes('gloomy')) target -= 8;
    if (k.traits.includes('timid') && anyWar()) target -= 6;
    if (k.health < 50) target -= (50 - k.health) * 0.3;
    if (!k.job && canWork(k)) target -= 4;
    target += mods.all + lifeMood(k);
    for (const m of G.mods) if (m.kin === k.id) target += m.mood;
    k.moodTarget = clamp(target, 0, 100);
    k.mood += (k.moodTarget - k.mood) * 0.18;
    if ((h + k.id) % 4 === 0 || !k.thought || (R.selected && R.selected.id === k.id)) k.thought = thoughtFor(k);
  }
  hourlyLife();
  if (h % 6 === 0) { autoAssignJobs(); rebalanceJobs(); }
  // routing
  for (const k of G.kin) routeKin(k);
}
function moodModifiers() {
  let all = 0;
  all += { low: 4, normal: 0, high: -10 }[G.policies.tax];
  all += { meager: -10, normal: 0, generous: 7 }[G.policies.rations];
  if (G.festival > 0) all += 18;
  all += fx('mood') + Math.floor(blCached('society') / 3);
  if (anyWar()) all += fx('warMood');
  if (G.upheaval > 0) all -= 6;
  for (const b of Object.values(G.buildings)) if (B[b.type].moodAll) all += B[b.type].moodAll;
  for (const m of G.mods) if (!m.kin) all += m.mood;
  return { all };
}
function thoughtFor(k) {
  const n = k.needs;
  if (k.health < 30) return 'I feel terribly unwell...';
  if (n.food < 15) return G.res.food < 1 ? 'There is nothing to eat!' : 'So hungry...';
  if (!k.home) return 'I have nowhere to live.';
  if (n.rest < 15) return 'Exhausted.';
  if (k.wish) return `I wish ${WISHES[k.wish.id].text(k)}.`;
  const rv = rivalOf(k); if (rv && Math.random() < 0.5) return `I can't stand ${rv.name}.`;
  if (k.sabbatical > G.time.day) return 'Taking some time for myself.';
  if (k.asp && Math.random() < 0.35) { const A = ASPIRATIONS[k.asp], [p, n] = aspProgress(k); return `One day I want to ${A.desc.toLowerCase()} (${Math.floor(p)}/${n}).`; }
  if (k.pet && Math.random() < 0.2) return `${k.pet.name} is the best ${k.pet.kind} in the world.`;
  if (k.married && k.partner && Math.random() < 0.15) { const p = kinById(k.partner); if (p) return `I'm lucky to have ${p.name}.`; }
  if ((k.commute || 0) < 0 && Math.random() < 0.3) return 'Such a long walk to work...';
  if (n.fun < 20) return 'Bored out of my mind.';
  if (n.social < 20) return 'Lonely...';
  if (k.mood > 80) return pick(['Life is good!', 'What a lovely town.', 'I love it here.']);
  if (k.mood > 55) return pick(['Not bad.', 'Busy day.', 'Things are fine.']);
  return 'Things could be better.';
}

// ---------- Wishes ----------
const WISHES = {
  tavern: { text: () => 'there was a tavern in town', check: () => countB('tavern') > 0, w: () => countB('tavern') ? 0 : 3 },
  beauty: { text: () => 'there was something beautiful near my home', check: k => homeOf(k) && appealAt(homeOf(k).x, homeOf(k).y) >= 8, w: k => homeOf(k) && appealAt(homeOf(k).x, homeOf(k).y) < 8 ? 3 : 0 },
  biggerhome: { text: () => 'we had a bigger home', check: k => homeOf(k) && homeOf(k).level >= 2, w: k => homeOf(k) && homeOf(k).level < 2 && thLevel() >= 2 ? 2 : 0 },
  manor: { text: () => 'I could live in a manor', check: k => homeOf(k) && homeOf(k).level >= 3, w: k => homeOf(k) && homeOf(k).level === 2 && maxLevelFor('hut') >= 3 ? 2 : 0 },
  festival: { text: () => 'we could have a festival', check: () => G.festival > 0, w: () => G.festivalCd <= 0 ? 2 : 0 },
  partner: { text: () => 'I could find someone special', check: k => !!k.partner, w: k => !k.partner && isAdult(k) && k.age < 50 ? 2 : 0 },
  library: { text: () => 'I could learn to read', check: () => countB('library') > 0, w: () => hasTech('writing') && !countB('library') ? 2 : 0 },
  temple: { text: () => 'there was a temple to pray at', check: () => countB('temple') > 0, w: k => hasTech('mysticism') && !countB('temple') ? (k.traits.includes('devout') ? 6 : 1) : 0 },
  job: { text: () => 'I had work to do', check: k => !!k.job, w: k => canWork(k) && !k.job ? 4 : 0 },
  peace: { text: () => 'the war would end', check: () => !anyWar(), w: () => anyWar() ? 4 : 0 },
  road: { text: () => 'a road linked my home to town', check: k => { const h = homeOf(k); return h && roadLink(h).linked; }, w: k => homeOf(k) && !roadLink(homeOf(k)).linked ? 2 : 0 },
  fountain: { text: () => 'the town had a fountain', check: () => countB('fountain') > 0, w: () => countB('fountain') ? 0 : 1 },
  grow: { text: k => `the realm reached ${k.wish ? k.wish.n : 0} tiles`, check: k => G.stats.tiles >= k.wish.n, w: () => 1, n: () => Math.ceil((G.stats.tiles + 10) / 5) * 5 },
  feast: { text: () => 'we ate like kings for a while', check: () => G.policies.rations === 'generous', w: () => G.policies.rations !== 'generous' ? 1 : 0 },
  soldier: { text: () => 'I could serve as a soldier', check: k => k.soldier, w: k => k.traits.includes('brave') && countB('barracks') && !k.soldier ? 3 : 0 },
};
function dailyWishes() {
  for (const k of G.kin) {
    if (!isAdult(k) || k.away) continue;
    if (k.wish) {
      const W = WISHES[k.wish.id];
      if (W.check(k)) {
        k.wish = null; k.wishCd = randi(4, 9); G.stats.wishes++;
        addMod('Wish fulfilled', 15, 6, k.id); gain('influence', 4);
        addLog(`${kinName(k)}'s wish came true! (+4 👑)`, 'good');
      } else if (G.time.day > k.wish.until) {
        k.wish = null; k.wishCd = randi(3, 7); addMod('Wish forgotten', -6, 4, k.id);
      }
      continue;
    }
    if (--k.wishCd > 0) continue;
    const opts = Object.entries(WISHES).map(([id, W]) => [id, W.w(k)]).filter(([, w]) => w > 0);
    if (!opts.length) { k.wishCd = 3; continue; }
    let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, ch = opts[0][0];
    for (const [id, w] of opts) { r -= w; if (r <= 0) { ch = id; break; } }
    k.wish = { id: ch, until: G.time.day + 12 };
    if (WISHES[ch].n) k.wish.n = WISHES[ch].n();
    if (WISHES[ch].check(k)) { k.wish = null; k.wishCd = 2; }
  }
}

// ---------- Daily kin life cycle ----------
function dailyKin() {
  const dead = [], unhappy = [];
  for (const k of G.kin) {
    k.age += 0.25;
    if (k.health <= 0) dead.push([k, k.sick ? 'illness' : k.needs.food < 10 ? 'starvation' : 'poor health']);
    else if (k.age > 66 && Math.random() < (k.age - 66) * 0.006) dead.push([k, 'old age']);
    if (k.mood < 15 && isAdult(k)) k.lowMoodDays++; else k.lowMoodDays = Math.max(0, k.lowMoodDays - 2);
    if (k.lowMoodDays === 5) unhappy.push(k);
    // friendships fade a little
    for (const id in k.friends) { k.friends[id] *= 0.97; if (k.friends[id] < 1) delete k.friends[id]; }
    if (k.sick > 0) { k.sick--; }
  }
  for (const [k, why] of dead) killKin(k, why);
  if (unhappy.length) addLog(`😠 ${unhappy.length === 1 ? kinName(unhappy[0]) + ' is' : unhappy.length + ' kin are'} miserable and may leave in a few days${unhappy.length === 1 ? ` (“${unhappy[0].thought}”)` : ''}. Check the Kin window (sort by Unhappiest).`, 'bad');
  // leavers
  for (const k of G.kin.slice().sort((a, b) => b.lowMoodDays - a.lowMoodDays).slice(0, 1)) {
    if (k.lowMoodDays >= 9 && !k.away) {
      const fam = [k]; if (k.partner) { const p = kinById(k.partner); if (p && !p.away) fam.push(p); }
      for (const c of G.kin) if (!isAdult(c) && c.parents.includes(k.id)) fam.push(c);
      for (const m of fam) removeKin(m);
      addLog(`${kinName(k)}${fam.length > 1 ? ` and family (${fam.length})` : ''} left ${G.realm.name}, unhappy.`, 'bad');
    }
  }
  // partners
  const singles = G.kin.filter(k => isAdult(k) && !k.partner && !k.away && k.age < 55);
  for (const a of singles) {
    if (a.partner) continue;
    for (const id in a.friends) {
      const b = kinById(+id);
      if (!b || b.partner || !isAdult(b) || b.away || b.age >= 55 || a.parents.includes(b.id) || b.parents.includes(a.id) || a.parents.some(p => b.parents.includes(p))) continue;
      if (a.friends[id] > 45 && (b.friends[a.id] || 0) > 35 && Math.random() < 0.25) {
        a.partner = b.id; b.partner = a.id;
        addMod('In love', 14, 8, a.id); addMod('In love', 14, 8, b.id);
        addLog(`💕 ${kinName(a)} and ${kinName(b)} are now partners!`, 'good'); lifeOnPartner(a, b);
        // move in together
        if (a.home !== b.home) { const ha = homeOf(a); if (ha && houseCap(ha) > residents(ha).length) b.home = a.home; else { const hb = homeOf(b); if (hb && houseCap(hb) > residents(hb).length) a.home = b.home; } }
        break;
      }
    }
  }
  // births
  const food = G.res.food;
  for (const a of G.kin) {
    if (!a.partner || a.id > a.partner) continue;
    const b = kinById(a.partner); if (!b) continue;
    if (a.age > 44 || b.age > 44 || a.away || b.away || !a.home || a.home !== b.home) continue;
    const h = homeOf(a); if (residents(h).length >= houseCap(h)) continue;
    if (food < G.kin.length * 3 || (a.mood + b.mood) / 2 < 50) continue;
    if (Math.random() < 0.035 + (G.festival > 0 ? 0.03 : 0)) {
      const baby = makeKin({ age: 0, surname: a.surname, parents: [a, b], x: h.x, y: h.y });
      baby.home = h.id; G.stats.born++;
      addMod('New baby', 12, 6, a.id); addMod('New baby', 12, 6, b.id);
      addLog(`👶 ${kinName(a)} and ${b.name} welcomed baby ${baby.name}!`, 'good'); lifeOnBirth(baby, a, b);
    }
  }
  // grow up
  for (const k of G.kin) if (k.age >= 16 && k.age < 16.25) { addLog(`${kinName(k)} has come of age and is ready to work.`, 'info'); }
  for (const k of G.kin) if (k.age >= 62 && k.age < 62.25 && k.job) { addLog(`${kinName(k)} has retired.`, 'info'); setJob(k, null); }
  // immigration
  const fh = freeHousing(), am = avgMood();
  if (fh > 0 && am > 48 && G.kin.length > 0) {
    let ch = Math.min(0.5, (0.08 + (am - 48) / 140 + Math.min(0.1, appealAt(G.cap.x, G.cap.y) / 80)) * (1 + fx('immig')));
    if (Math.random() < ch) {
      const n = fh >= 2 && Math.random() < 0.35 ? 2 : 1;
      const edge = territoryEdgeTile();
      const sur = pick(SURNAMES);
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(makeKin({ surname: sur, age: randi(18, 38), x: edge.x, y: edge.y }));
      if (n === 2) { arr[0].partner = arr[1].id; arr[1].partner = arr[0].id; }
      addLog(`🧳 ${arr.map(kinName).join(' and ')} moved to ${G.realm.name}.`, 'good');
      assignHousing();
    }
  }
  assignHousing(); autoAssignJobs(); rebalanceJobs();
  refreshRecruits(false);
}
function territoryEdgeTile() {
  const c = []; for (let i = 0; i < G.tiles.owner.length; i++) { if (G.tiles.owner[i] !== 0) continue; const x = i % MAP_W, y = (i / MAP_W) | 0; if (!TERRAIN[G.tiles.terrain[i]].pass) continue; if (N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) !== 0)) c.push({ x, y }); }
  return c.length ? pick(c) : { x: G.cap.x, y: G.cap.y };
}
// grief does not stack: a second loss deepens and lengthens it a little instead
function grieve(o, mood, days) {
  const m = G.mods.find(m => m.kin === o.id && m.name === 'Grieving');
  if (m) { m.mood = Math.max(-30, Math.min(m.mood, mood) - 3); m.until = Math.max(m.until, G.time.day + days); }
  else addMod('Grieving', mood, days, o.id);
}
function killKin(k, why) {
  addLog(`🕯️ ${kinName(k)} died of ${why} at age ${Math.floor(k.age)}.`, 'bad'); lifeOnDeath(k);
  G.stats.died++;
  if (k.partner) { const p = kinById(k.partner); if (p) { p.partner = null; grieve(p, -25, 8); } }
  for (const o of G.kin) if (o !== k && ((o.friends[k.id] || 0) > 25 || o.parents.includes(k.id) || k.parents.includes(o.id))) grieve(o, -12, 5);
  removeKin(k);
}
function removeKin(k) {
  if (k.job) { const b = G.buildings[k.job]; if (b) b.workers = b.workers.filter(i => i !== k.id); }
  if (k.partner) { const p = kinById(k.partner); if (p) p.partner = null; }
  G.kin = G.kin.filter(o => o !== k); _kmap = null;
  for (const a of G.armies) if (a.kin) a.kin = a.kin.filter(i => i !== k.id);
  if (R.selected && R.selected.kind === 'k' && R.selected.id === k.id) R.selected = null;
}

// ---------- Production ----------
function produce(dtH) {
  const workHours = 10, pw = _why;
  for (const b of Object.values(G.buildings)) {
    const d = B[b.type];
    if (d.passive) for (const r in d.passive) gain(r, d.passive[r] * techMultRes(r) * dtH / 24);
    if ((!d.prod && !d.consume) || b.paused || b.burning || b.ruined) continue;
    _why = d.name + 's';
    let work = 0;
    for (const id of b.workers) { const k = kinById(id); if (k && k.state === 'work' && k.dest === b.id) work += kinProductivity(k) * skillMult(k, b) * (k.path ? 1 : k.cf || 1) * (b.type === 'farm' && k.traits.includes('greenthumb') ? 1.4 : 1); }
    if (!work) continue;
    const m = (_bm[b.id] ?? 1) * work * dtH / workHours;
    if (d.consume) {
      let f = 1; for (const r in d.consume) f = Math.min(f, G.res[r] / (d.consume[r] * m + 1e-9));
      f = Math.min(1, f); if (f <= 0) { b.starved = true; continue; } b.starved = false;
      for (const r in d.consume) { G.res[r] -= d.consume[r] * m * f; track(r, -d.consume[r] * m * f); }
      for (const r in d.prod || {}) gain(r, d.prod[r] * m * f * techMultRes(r));
    } else for (const r in d.prod) gain(r, d.prod[r] * m * techMultRes(r));
    if (b.type === 'mine') { _why = 'Gold & gem mines'; const sp = G.tiles.special[idx(b.x, b.y)]; if (sp === 2) gain('gold', 1.5 * m * techMultRes('gold')); else if (sp === 4) { gain('gold', 1 * m * techMultRes('gold')); gain('influence', 0.3 * m); } }
  }
  _why = pw;
}
function refreshMults() {
  _capCache = {}; rebuildFx(); powerGrid();
  _healers = []; _mills = [];
  for (const b of Object.values(G.buildings)) {
    if (b.type === 'windmill') _mills.push(b);
    if (b.type === 'healer' && b.workers.length) _healers.push({ x: b.x, y: b.y, r: 7 });
    else if (b.type === 'hospital' && b.workers.length) _healers.push({ x: b.x, y: b.y, r: 12 });
    else if (b.type === 'aqueduct') _healers.push({ x: b.x, y: b.y, r: 6 });
  }
  for (const b of Object.values(G.buildings)) _bm[b.id] = buildingMult(b);
}
function estimateOutput(b) {
  const d = B[b.type]; if (!d.prod) return null;
  let w = 0; for (const id of b.workers) { const k = kinById(id); if (k) w += kinProductivity(k) * skillMult(k, b); }
  const m = buildingMult(b) * w; const o = {};
  for (const r in d.prod) o[r] = d.prod[r] * m * techMultRes(r);
  return o;
}

function dailyEconomy() {
  // taxes
  _why = 'Taxes';
  const adults = G.kin.filter(k => isAdult(k) && !k.away).length;
  let tax = { low: 0.2, normal: 0.4, high: 0.65 }[G.policies.tax] * adults;
  tax *= 1 + fx('tax');
  gain('gold', tax * techMultRes('gold'));
  // town hall: market fees and tolls
  const th = thLevel();
  _why = 'Town Hall fees'; gain('gold', 1 + th);
  gain('influence', (1 + th * 0.8) * techMultRes('influence'));
  gain('knowledge', (1 + th * 0.8) * techMultRes('knowledge'));
  for (const k of G.kin) { if (k.traits.includes('curious') && isAdult(k)) gain('knowledge', 0.3); if (k.traits.includes('devout')) gain('influence', 0.2); }
  // soldier upkeep
  _why = 'Army upkeep';
  const sol = G.kin.filter(k => k.soldier).length;
  if (sol) { const up = sol * 0.5 * (1 + 0.25 * (th - 1)); G.res.gold -= up; track('gold', -up); }
  // spoilage of food over cap handled by cap. Gold debt
  if (G.res.gold < 0) { addMod('Unpaid soldiers & debts', -8, 1); }
  // allies & vassals
  _why = 'Vassal tribute';
  for (const f of G.factions) {
    if (f.subjugated && !f.dead) gain('gold', (2 + f.tiles * 0.06) * (1 + 0.3 * ((f.era || 1) - 1)) * (1 + fx('tribute')));
    if (f.pact === 'alliance') gain('influence', 1);
  }
  if (G.festival > 0) G.festival--; if (G.festivalCd > 0) G.festivalCd--;
  if (G.drought > 0) G.drought--; if (G.quarantine > 0) G.quarantine--;
  G.mods = G.mods.filter(m => m.until > G.time.day);
  G.marketVol = 0;
}

// ---------- Time ----------
let _lastHour = -1;
function stepSim(dtH) {
  installLedger();
  G.time.hour += dtH;
  for (const k of G.kin) updateKin(k, dtH);
  produce(dtH);
  why('War & raids', updateArmies, dtH);
  moveExpeditions(dtH);
  updateFires(dtH);
  if (G.time.hour >= 24) {
    G.time.hour -= 24; G.time.day++;
    onNewDay();
  }
  const h = Math.floor(G.time.hour);
  if (h !== _lastHour) { _lastHour = h; rollHour(); refreshMults(); hourlyKin(); cityIntercepts(); }
}
function onNewDay() {
  G.rates = G.today; G.today = {};
  rollLedger();
  why('Taxes', dailyEconomy);
  dailyForage();
  dailyKin();
  dailyLife();
  foodWarning();
  dailyWishes();
  why('Rival realms', dailyFactions);
  why('Your realm', dailyRealm);
  dailyBorders();
  dailyCityUnrest();
  dailyWorldRoads();
  why('Disasters & world', dailyAges);
  why('Training soldiers', autoArmy);
  why('Events & decisions', dailyEvents);
  researchTick();
  checkGoals();
  if (yearDay() === 1 && G.time.day > 1) addLog(`📅 Year ${year()} of ${G.realm.name} begins.`, 'info');
  if (G.time.day % 2 === 0 && !window.BOT_ACTIVE) saveGame(true);
}

function activeGoals() { const out = []; for (let i = 0; i < GOALS.length && out.length < 3; i++) if (!G.goalsDone.includes(i)) out.push(i); return out; }
function checkGoals() {
  if (!G.goalsDone) G.goalsDone = [];
  for (const i of activeGoals()) {
    const g = GOALS[i];
    if (!g.check()) continue;
    G.goalsDone.push(i); gainAll(g.reward);
    addLog(`🎯 Goal complete: ${g.text}! Reward: ${costStr(g.reward)}`, 'good');
    toast(`🎯 Goal complete: ${g.text}`);
  }
}

// ---------- Fires ----------
function updateFires(dtH) {
  for (const b of Object.values(G.buildings)) {
    if (!b.burning) continue;
    b.burning -= dtH;
    if (b.burning <= 0) {
      b.burning = 0;
      if (b.doomed) { addLog(`🔥 The ${B[b.type].name} burned to the ground.`, 'bad'); b.doomed = false; demolish(b, true); }
    }
  }
}
function protectedFromFire(b) { return Object.values(G.buildings).some(o => (o.type === 'well' && dist(o.x, o.y, b.x, b.y) <= 4) || (o.type === 'fountain' && dist(o.x, o.y, b.x, b.y) <= 2) || (o.type === 'aqueduct' && dist(o.x, o.y, b.x, b.y) <= 6) || (o.type === 'firestation' && dist(o.x, o.y, b.x, b.y) <= 9)); }

// ---------- Persistence ----------
function serialize() {
  const t = G.tiles;
  const enc = a => Array.from(a);
  const kin = G.kin.map(k => ({ ...k, path: null, plan: null }));
  return JSON.stringify({ ...G, kin, tiles: { terrain: enc(t.terrain), owner: enc(t.owner), bld: enc(t.bld), road: enc(t.road), special: enc(t.special), deco: enc(t.deco), wire: enc(t.wire || []), fallout: enc(t.fallout || []) } });
}
function saveGame(auto) {
  try { localStorage.setItem('hearthlands_save', serialize()); if (!auto) toast('💾 Game saved'); } catch (e) { if (!auto) toast('Save failed: ' + e.message); }
}
function loadGame() {
  const s = localStorage.getItem('hearthlands_save'); if (!s) return false;
  const o = JSON.parse(s);
  const N = MAP_W * MAP_H;
  if (o.tiles.terrain.length !== N || (o.version || 1) < 3) { toast('That save is from an older version of Hearthlands and cannot be loaded. Please start a new game.'); return false; }
  o.tiles = { terrain: Uint8Array.from(o.tiles.terrain), owner: Int16Array.from(o.tiles.owner), bld: Int32Array.from(o.tiles.bld), road: Uint8Array.from(o.tiles.road), special: Uint8Array.from(o.tiles.special), deco: Uint8Array.from(o.tiles.deco), wire: o.tiles.wire && o.tiles.wire.length === N ? Uint8Array.from(o.tiles.wire) : new Uint8Array(N), fallout: o.tiles.fallout && o.tiles.fallout.length === N ? Uint8Array.from(o.tiles.fallout) : new Uint8Array(N), appeal: new Float32Array(N) };
  G = o;
  G.eventQueue = G.eventQueue || []; G.goalsDone = G.goalsDone || [];
  G.cities = G.cities || []; G.spies = G.spies || []; G.history = G.history || []; G.gov = G.gov || 'chiefdom'; G.econ = G.econ || 'barter'; G.res.coal = G.res.coal || 0;
  G.priorities = G.priorities || []; G.research = G.research || { queue: [], progress: {} }; if (G.settings.autoResearch === undefined) G.settings.autoResearch = true; for (const id in G.techs) if (!TECHS[id]) delete G.techs[id]; G.policies.army = G.policies.army || 'guard';
  for (const k of G.kin) ensureLife(k);
  G.expeditions = G.expeditions || [];
  G.settings.decide = G.settings.decide || 'major'; G.settings.battles = G.settings.battles || 'play'; G.villages = G.villages || []; for (const ar of G.armies || []) if (ar.mode === 'battle') ar.mode = 'attack'; G.settings.autoKeys = G.settings.autoKeys || {};
  if (!G.recruits) refreshRecruits(true);
  recomputeAppeal(); recountTiles(); refreshMults(); pathsDirty(); _landTiles = 0;
  return true;
}
