// ===== Rival economies (real resource sites) and conquest that hands over everything =====
// Rival land carries "deco" markers: 1 cottage, 2 field, 3 capital, 4 village hall, 5 town, 6 big house,
// and resource / store sites 7-14 below. When you take the land, each one becomes a real building of yours.
const DECO_B = { 7: 'lumber', 8: 'quarry', 9: 'mine', 10: 'fishery', 11: 'granary', 12: 'warehouse', 13: 'market', 14: 'workshop' };
const SITE_YIELD = { lumber: { wood: 3 }, quarry: { stone: 2.5 }, mine: { iron: 2 }, fishery: { food: 3 }, field: { food: 2 }, workshop: { tools: 1 }, market: { gold: 2 } };
function aiSiteLevel(type, e) { return clamp(Math.ceil((e || 1) * 0.7), 1, B[type].maxLevel || 1); }
function realmEra(f) { return f && !f.minor ? (f.era || 1) : 1; }

// What a rival would put on this tile, scored (null = nothing worth building)
function aiSiteFor(f, x, y) {
  if (!inB(x, y)) return null;
  const i = idx(x, y), t = G.tiles.terrain[i], sp = G.tiles.special[i];
  if (G.tiles.owner[i] !== f.id || !TERRAIN[t].build || G.tiles.deco[i] || G.tiles.road[i] || G.tiles.bld[i] || sp === 5) return null;
  // keep a lane open beside every site so a road can reach it
  if (!N4.some(([dx, dy]) => { if (!inB(x + dx, y + dy)) return false; const j = idx(x + dx, y + dy); return G.tiles.road[j] || (G.tiles.owner[j] === f.id && TERRAIN[G.tiles.terrain[j]].pass && (!G.tiles.deco[j] || G.tiles.deco[j] === 2) && !G.tiles.bld[j]); })) return null;
  const c8 = tt => countAround(x, y, 1, (nx, ny) => tt.includes(terr(nx, ny)));
  if (sp >= 1 && sp <= 4) return { v: 9, s: 10 };
  const mt = c8([T.MOUNTAIN]);
  if (t === T.HILLS) return mt ? { v: 9, s: 6 } : { v: 8, s: 5 };
  if (mt >= 2) return { v: 9, s: 4 };
  const w = c8([T.WATER, T.DEEP]), fo = c8([T.FOREST]);
  if (w >= 3 && t !== T.FOREST) return { v: 10, s: 2 + w * 0.5 };
  if (fo >= 3) return { v: 7, s: 2 + fo * 0.5 };
  if (c8([T.HILLS]) >= 2) return { v: 8, s: 3 };
  return null;
}
function decoNear(x, y, r, v) { return countAround(x, y, r, (nx, ny) => G.tiles.deco[idx(nx, ny)] === v); }
// Rivals work the land: camps by forests, quarries and mines in the hills, fisheries on the shore,
// and granaries, warehouses, markets and workshops in their towns.
function aiBuildSites(f, quick) {
  const e = realmEra(f), centres = [f.cap, ...(f.towns || [])].filter(Boolean);
  if (!centres.length) return false;
  const c = pick(centres);
  // stores and trades in the towns
  const civic = [[11, 2], [12, 2], [14, 2], [13, 3]].filter(([v, era]) => e >= era && !decoNear(c.x, c.y, 4, v));
  if (civic.length && !f.minor && (quick || Math.random() < 0.5)) {
    const [v] = civic[0];
    for (let t = 0; t < 14; t++) {
      const x = c.x + randi(-3, 3), y = c.y + randi(-3, 3);
      if (!inB(x, y) || (x === c.x && y === c.y)) continue;
      const i = idx(x, y);
      if (G.tiles.owner[i] !== f.id || !TERRAIN[G.tiles.terrain[i]].build || G.tiles.road[i] || G.tiles.bld[i] || G.tiles.special[i] === 5) continue;
      if (G.tiles.deco[i] && G.tiles.deco[i] !== 1) continue; // may replace a cottage
      G.tiles.deco[i] = v; return true;
    }
  }
  // resource sites: the best spot among a handful of tiles around a town
  const s = f.sites || {}, total = (s.lumber || 0) + (s.quarry || 0) + (s.mine || 0) + (s.fishery || 0);
  if (total > 3 + f.tiles / 7) return false;
  const r = 4 + Math.min(4, e);
  let best = null, bs = 0;
  for (let t = 0; t < 26; t++) {
    const x = c.x + randi(-r, r), y = c.y + randi(-r, r), o = aiSiteFor(f, x, y);
    if (!o) continue;
    const sc = o.s - decoNear(x, y, 2, o.v) * 3 + Math.random();
    if (sc > bs) { bs = sc; best = { x, y, v: o.v }; }
  }
  if (!best) return false;
  G.tiles.deco[idx(best.x, best.y)] = best.v; return true;
}

// Count every rival's sites in one pass (every few days)
function countSites() {
  const m = {}, D = G.tiles.deco, O = G.tiles.owner;
  for (let i = 0; i < D.length; i++) {
    const v = D[i]; if (v !== 2 && v < 7) continue;
    const o = O[i]; if (o <= 0) continue;
    const s = m[o] || (m[o] = {}), k = v === 2 ? 'field' : DECO_B[v];
    s[k] = (s[k] || 0) + 1;
  }
  for (const f of G.factions) f.sites = m[f.id] || {};
  for (const v of G.villages || []) v.sites = m[v.id] || {};
}
// A rival's stockpiles now come from what its land actually produces
function aiStockDay(f) {
  if (!f.sites || (G.time.day % 5 === 0 && G._sitesDay !== G.time.day)) { countSites(); G._sitesDay = G.time.day; }
  const s = f.sites || {}, e = f.era || 1, m = 0.6 + e * 0.4;
  const cap = r => (300 + 350 * e + (r === 'food' ? 250 * (s.granary || 0) : 150 * (s.warehouse || 0))) * (r === 'gold' ? 2 : 1);
  for (const r in f.stock) {
    let g = (r === f.surplus ? 5 : r === f.need ? 0.5 : 1.5) * m;
    for (const k in s) { const y = SITE_YIELD[k]; if (y && y[r]) g += y[r] * s[k] * 0.45 * m; }
    f.stock[r] = Math.min(cap(r), f.stock[r] + g);
  }
}
function siteSummary(f) {
  const s = f.sites || {}, out = [];
  const names = { field: ['🌾 field', 's'], lumber: ['🪓 lumber camp', 's'], quarry: ['🪨 quarr', 'y', 'ies'], mine: ['⛏️ mine', 's'], fishery: ['🐟 fisher', 'y', 'ies'], granary: ['🛢️ granar', 'y', 'ies'], warehouse: ['📦 warehouse', 's'], market: ['⚖️ market', 's'], workshop: ['🔨 workshop', 's'] };
  for (const k in names) if (s[k]) { const [w, a, b] = names[k]; out.push(`${s[k]} ${w}${b ? (s[k] > 1 ? b : a) : s[k] > 1 ? a : ''}`); }
  return out.join(', ');
}

// ---------- Taking land: their buildings become yours ----------
function decoToBuilding(v, x, y, e) {
  const t = G.tiles.terrain[idx(x, y)];
  if (v === 1 || v === 6) return { type: 'hut', level: clamp(aiHomeLevel(e, x, y, v === 6), 1, B.hut.maxLevel) };
  if (v === 2) return t === T.MOUNTAIN || t === T.HILLS ? null : { type: 'farm', level: aiSiteLevel('farm', e) };
  const type = DECO_B[v]; if (!type) return null;
  if (type === 'mine' && G.tiles.special[idx(x, y)] === 3 && e >= 5) return { type: 'coalmine', level: aiSiteLevel('coalmine', e) };
  return { type, level: aiSiteLevel(type, e) };
}
// Converts every rival marker on these (now player-owned) tiles into a working building.
function convertDeco(tiles, e) {
  const got = { n: 0, homes: 0, beds: 0, slots: 0, by: {}, at: [], list: [] };
  // stores first, so the stockpiles that follow have somewhere to go
  const order = tiles.slice().sort((a, b) => (G.tiles.deco[b] === 11 || G.tiles.deco[b] === 12) - (G.tiles.deco[a] === 11 || G.tiles.deco[a] === 12));
  for (const i of order) {
    const v = G.tiles.deco[i]; if (!v || v === 3 || v === 4 || v === 5) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    G.tiles.deco[i] = 0;
    if (G.tiles.owner[i] !== 0 || G.tiles.bld[i] || !TERRAIN[G.tiles.terrain[i]].build) continue;
    const o = decoToBuilding(v, x, y, e); if (!o) continue;
    const r = placeBuilding(o.type, x, y, true); if (!r.ok) continue;
    const b = r.b; b.level = o.level; b.captured = G.time.day;
    got.n++; got.by[o.type] = (got.by[o.type] || 0) + 1; got.list.push(b);
    if (B[o.type].housing) { got.homes++; got.beds += houseCap(b); got.at.push(b); }
    got.slots += workerSlots(b);
  }
  if (got.n) { _capCache = {}; R.terrainDirty = true; pathsDirty(); netDirty(); recomputeAppeal(); }
  return got;
}
// Newcomers who come with the land: families to fill (most of) the homes and work the sites
function settleConquered(got, n, how, x, y) {
  const arr = [], homes = got.at.length ? got.at : null;
  while (arr.length < n) {
    const h = homes ? pick(homes) : { x, y }, sur = pick(SURNAMES), fam = randi(1, 4);
    for (let k = 0; k < fam && arr.length < n; k++) {
      const child = k >= 2 && Math.random() < 0.7;
      arr.push(makeKin({ surname: sur, age: child ? randi(3, 15) : randi(18, 58), x: h.x, y: h.y }));
    }
  }
  if (how === 'conquer') for (const k of arr) addMod('Conquered', -12, 10, k.id);
  return arr;
}
// Their stores pour into yours; whatever your storehouses can't hold is sold on
function takeStores(f, share) {
  const got = {}; let sold = 0;
  for (const r of Object.keys(f.stock || {})) {
    const amt = Math.floor((f.stock[r] || 0) * share); if (amt <= 0) continue;
    f.stock[r] -= amt;
    if (r === 'gold') { gain('gold', amt); got.gold = (got.gold || 0) + amt; continue; }
    const before = G.res[r]; gain(r, amt); const took = Math.max(0, Math.floor(G.res[r] - before));
    if (took) got[r] = took;
    sold += (amt - took) * (TRADE_VALUE[r] || 1) * 0.4;
  }
  if (sold >= 1) { gain('gold', Math.floor(sold)); got.gold = (got.gold || 0) + Math.floor(sold); }
  return { got, sold: Math.floor(sold) };
}
function realmPlace(f) {
  return f.name.replace(/^(Kingdom|Republic|Duchy|Realm|Order|Horde|Free Cities|People's Union|United Worlds|Algorithm) of /, '').replace(/^(Holy|United|Free) /, '')
    .replace(/ (Tribes|Clans|Crown|Republic|Dominion|Empire|Imperium|Federation|Collective|Directorate|Consortium|Nexus|Concord)$/, '');
}
// What you would get if this realm fell today (for the decision screen)
function spoilsPreview(f) {
  countSites();
  let homes = 0, land = 0;
  for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) { land++; const v = G.tiles.deco[i]; if (v === 1 || v === 6) homes++; }
  return { land, homes, sites: siteSummary(f), towns: 1 + (f.towns || []).length };
}

// The whole realm becomes yours: land, towns (as your cities), buildings, stores and people.
function annexRealm(f, how) {
  return why('Conquest', () => {
    const e = realmEra(f), tiles = [];
    for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) { G.tiles.owner[i] = 0; tiles.push(i); }
    let fieldT = 0; for (const a of G.armies) if (a.owner === f.id && !a.dead) { fieldT += a.n; a.dead = true; }
    if (f.aiWar) { const o = fac(f.aiWar); if (o && o.aiWar === f.id) o.aiWar = null; }
    const got = convertDeco(tiles, e);
    // towns become cities of your realm, ruled through their own halls
    const place = realmPlace(f), made = [];
    const centres = [{ x: f.cap.x, y: f.cap.y, name: place }, ...(f.towns || []).map(t => ({ x: t.x, y: t.y, name: placeName() }))];
    for (const c of centres) {
      const i = idx(c.x, c.y); G.tiles.deco[i] = 0;
      if (G.tiles.owner[i] !== 0) continue;
      const city = cityAtConquest(c.x, c.y, c.name);
      if (city) { city.origin = how === 'conquer' ? 'taken' : 'joined'; city.unrest = how === 'conquer' ? 30 : 8; city.formerly = f.name; city.levies = city.manual = levyCap(city); made.push(city.name); }
      else if (!G.tiles.bld[i] && TERRAIN[G.tiles.terrain[i]].build) { const r = placeBuilding('market', c.x, c.y, true); if (r.ok) { r.b.level = aiSiteLevel('market', e); got.n++; got.by.market = (got.by.market || 0) + 1; } }
    }
    const loot = takeStores(f, how === 'conquer' ? 0.85 : 1);
    // the royal treasury and archives
    const chest = Math.round(tiles.length * 1.5 * e + 40 * e); gain('gold', chest); loot.got.gold = (loot.got.gold || 0) + chest;
    if (how === 'conquer') { gain('influence', 30 + 10 * e); gain('knowledge', 15 * e); }
    const n = Math.round(Math.min(got.beds * 0.75, got.slots * 1.2 + 4, 28 + 12 * e));
    const people = settleConquered(got, Math.max(how === 'conquer' ? 3 : 5, n), how, f.cap.x, f.cap.y);
    // everyone else stays on as your subjects, and their garrison joins your army
    const folk = Math.round(got.beds * 1.1 + tiles.length * 0.35 * e + 14 * e * centres.length);
    const subj = spreadSubjects(Math.max(0, folk - people.length), cities().filter(c => made.includes(c.name)));
    const vt = addVets((f.troops + fieldT) * (how === 'conquer' ? 0.7 : 0.9)); f.troops = 0;
    const lk = linkAll(got.list, true, e >= 3 ? 2 : 1);
    f.dead = true; f.annexed = true; f.war = false; f.subjugated = false; f.pact = null; f.aiWar = null; f.towns = [];
    G.stats.realmsTaken = (G.stats.realmsTaken || 0) + 1;
    recountTiles(); R.territoryDirty = true; assignHousing(); autoAssignJobs(); refreshMults();
    const bl = Object.entries(got.by).sort((a, b) => b[1] - a[1]).map(([t, k]) => `${k} ${B[t].icon}`).join(' ');
    history(how === 'conquer' ? `${G.realm.name} conquered ${f.name} and took all its lands.` : `${f.name} was absorbed into ${G.realm.name}.`, how === 'conquer' ? '👑' : '🤝');
    addLog(`👑 <b>${f.name}</b> is now part of ${G.realm.name}: +${tiles.length} tiles, ${got.n} buildings (${bl}), ${people.length} new kin, ${subj} subjects, ${vt} veteran troops${lk.tiles ? `, ${lk.tiles} tiles of road linking it all up` : ''}${made.length ? `, and the cit${made.length > 1 ? 'ies' : 'y'} of ${made.join(', ')}` : ''}. Their stores: ${costStr(loot.got)}${loot.sold ? ` (${loot.sold} 🪙 of it from surplus your storehouses couldn't hold)` : ''}.`, 'good');
    toast(`👑 ${f.name} is yours!`);
    floatText(f.cap.x, f.cap.y, how === 'conquer' ? 'Realm conquered!' : 'Realm absorbed!', '#ffd54f');
    return { tiles: tiles.length, got, people: people.length, subjects: subj, vets: vt, loot, cities: made };
  });
}
// The old way: they keep the rest of their land as a tribute-paying vassal; you take the core and half the treasury
function makeVassal(f) {
  return why('Conquest', () => {
    const tiles = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = f.cap.x + dx, y = f.cap.y + dy;
      if (ownerAt(x, y) === f.id && Math.hypot(dx, dy) <= 3.2) { G.tiles.owner[idx(x, y)] = 0; tiles.push(idx(x, y)); }
    }
    f.war = false; f.subjugated = true; f.pact = null; f.relation = 10;
    const got = convertDeco(tiles, realmEra(f));
    const loot = takeStores(f, 0.5); gain('influence', 40);
    const oldCap = { x: f.cap.x, y: f.cap.y };
    recountTiles(); cityAtConquest(oldCap.x, oldCap.y, `${realmPlace(f)} March`);
    let best = null, bd = 1e9;
    for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) { const x = i % MAP_W, y = (i / MAP_W) | 0; const d = dist(x, y, oldCap.x, oldCap.y); if (d < bd && TERRAIN[G.tiles.terrain[i]].build) { bd = d; best = { x, y }; } }
    if (best) { f.cap = best; G.tiles.deco[idx(best.x, best.y)] = 3; } else f.dead = true;
    const people = got.beds ? settleConquered(got, Math.round(Math.min(got.beds * 0.6, 12)), 'conquer', oldCap.x, oldCap.y) : [];
    spreadSubjects(Math.max(0, got.beds * 1.1 + 10 - people.length), { x: oldCap.x, y: oldCap.y });
    const vt = addVets(f.troops * 0.3); f.troops -= vt;
    linkAll(got.list, true, realmEra(f) >= 3 ? 2 : 1);
    recountTiles(); R.territoryDirty = true; assignHousing(); autoAssignJobs();
    addLog(`👑 ${f.name} is now your vassal and pays tribute. You took their capital district (+${tiles.length} tiles, ${got.n} buildings, ${people.length} kin) and half their treasury: ${costStr(loot.got)}.`, 'good');
    toast(`👑 ${f.name} subjugated!`);
  });
}
// A vassal can later be folded into your realm without a war
function absorbCost(f) { return { influence: Math.round(40 + f.tiles * 1.2), gold: Math.round(60 + 25 * (f.era || 1)) }; }
function absorbVassal(f) {
  if (!f.subjugated || f.dead) return;
  if ((f.unrest || 0) > 50) return toast(`${f.name} is too restless to agree — placate them first.`);
  const c = absorbCost(f); if (!canAfford(c)) return toast(`Absorbing them costs ${costStr(c)}`);
  pay(c); annexRealm(f, 'peace');
}

// Battles that take a border district also take what stands on it, and some of their stores
function takeDistrict(f, tiles) {
  const got = convertDeco(tiles, realmEra(f));
  const loot = takeStores(f, 0.08);
  const at = { x: tiles.length ? tiles[0] % MAP_W : G.cap.x, y: tiles.length ? (tiles[0] / MAP_W) | 0 : G.cap.y };
  const ppl = got.beds ? settleConquered(got, Math.round(Math.min(got.beds * 0.5, 6)), 'conquer', at.x, at.y) : [];
  if (got.beds) spreadSubjects(got.beds * 1.1 - ppl.length, at);
  linkAll(got.list, true, realmEra(f) >= 3 ? 2 : 1);
  assignHousing(); autoAssignJobs();
  return { got, loot };
}

Object.assign(EVENTS, {
  conquest: {
    random: false,
    make: d => {
      const f = fac(d.fid); if (!f || f.dead) return null;
      const p = spoilsPreview(f), st = f.stock || {};
      const stores = ['food', 'wood', 'stone', 'iron', 'tools', 'gold'].filter(r => st[r] >= 1).map(r => `${Math.floor(st[r])} ${RES_INFO[r].icon}`).join(' · ');
      return {
        title: `👑 ${f.name} Has Fallen`, icon: '👑', tiles: [{ x: f.cap.x, y: f.cap.y }],
        text: `Your army holds the capital of ${f.name}. Their whole realm lies open: <b>${p.land}</b> tiles, <b>${p.towns}</b> town${p.towns > 1 ? 's' : ''}, <b>${p.homes}</b> homes${p.sites ? `, ${p.sites}` : ''}. Their storehouses hold ${stores || 'little'}.`,
        choices: [
          { label: 'Annex the whole realm', tip: 'All their land is yours. Their homes, farms, mines, camps and storehouses become your buildings, their people become your kin, their towns become your cities, and you take 85% of their stores. Newly conquered cities start restless.', fn: () => annexRealm(f, 'conquer') },
          { label: 'Make them a vassal', tip: 'Take their capital district and half their treasury; they keep the rest and pay you tribute every day. Fewer new mouths and less unrest — you can absorb them peacefully later.', fn: () => makeVassal(f) },
        ],
      };
    },
  },
});
EVENT_MAJOR.add('conquest');

// ---------- Drawing rival sites with the same art they will have once they are yours ----------
const _siteB = new Map();
function drawSiteDeco(c, x, y, v, f) {
  const type = DECO_B[v]; if (!type) return;
  const i = idx(x, y), L = aiSiteLevel(type, realmEra(f)), roof = f ? shade(f.color, -20) : '#8e3b2e';
  let b = _siteB.get(i);
  if (!b || b.type !== type || b.level !== L || b.roof !== roof) { b = { id: 900000 + i, type, x, y, level: L, roof, workers: [1, 1], burning: 0, paused: false, ai: true }; _siteB.set(i, b); }
  drawBuilding(c, b);
}
function decoInfo(i) {
  const v = G.tiles.deco[i], o = G.tiles.owner[i]; if (!v || o <= 0) return '';
  const f = fac(o); if (!f) return '';
  const what = v === 1 || v === 6 ? '🏠 home' : v === 2 ? '🌾 farm' : v === 3 ? '🏛️ capital' : v === 4 ? '🛖 village hall' : v === 5 ? '🏘️ town' : DECO_B[v] ? `${B[DECO_B[v]].icon} ${B[DECO_B[v]].name.toLowerCase()}` : '';
  return what ? `<div class="kv">${esc(f.name)}'s ${what}${v !== 3 && v !== 4 && v !== 5 ? ' <small>— becomes yours if you take this land</small>' : ''}</div>` : '';
}

// ---------- Your border colour ----------
const BORDER_COLORS = PLAYER_COLORS;
function borderColorHtml() {
  const cur = G.realm.color;
  return `<div class="kv">Banner & border ${BORDER_COLORS.map(c => `<span class="sw inline ${cur === c ? 'on' : ''}" style="background:${c}" data-act="banner" data-arg="${c}"></span>`).join('')}
    <label class="dim" data-tip="Pick any colour">🎨 <input type="color" value="${cur}" onchange="ACT.banner(this.value)" style="width:30px;height:20px;border:0;padding:0;background:none;vertical-align:middle"></label></div>
    <div class="kv">Border line <button class="btn xs ${G.settings.boldBorder !== false ? 'on' : ''}" data-act="boldborder">${G.settings.boldBorder !== false ? '✔ Bold, with a dark outline' : 'Thin'}</button></div>`;
}
