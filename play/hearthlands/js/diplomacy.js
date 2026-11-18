// ===== Factions, diplomacy, war =====
function fac(id) { return G.factions.find(f => f.id === id) || (G.villages || []).find(v => v.id === id); }
function diff() { return G.realm.difficulty; }

function armyMult() { return 1 + 0.03 * blCached('war') + fx('army'); }
function soldierPower(k) {
  let p = armyMult() * (0.5 + k.health / 200);
  if (k.traits.includes('brave')) p *= 1.4; if (k.traits.includes('timid')) p *= 0.7;
  p *= 1 + 0.04 * skillLv(k, 'fighting');
  if (G.res.tools > 0) p *= 1.1;
  return p;
}
function soldiers() { return G.kin.filter(k => k.soldier); }
function garrison() { return G.kin.filter(k => k.soldier && !k.away); }
function defenseAt(x, y) {
  let d = 0;
  for (const k of garrison()) d += soldierPower(k);
  let walls = 0;
  for (const b of Object.values(G.buildings)) {
    if (b.type === 'watchtower' && !b.ruined && dist(b.x, b.y, x, y) <= 5) d += 6 * b.level * (1 + fx('defense'));
    if (b.type === 'wall' && dist(b.x, b.y, x, y) <= 2.5) walls += 2;
  }
  const E = thLevel();
  d += Math.min(10 + 4 * E, walls) * (1 + fx('defense') * 0.5) * (1 + 0.2 * (E - 1));
  d += Math.min(12, G.kin.filter(k => isAdult(k) && !k.soldier && !k.away).length * 0.25) * (1 + fx('militia')) * (1 + 0.3 * (E - 1)); // militia
  d += vets() * vetPower(); // veterans from conquered garrisons
  if (x === G.cap.x && y === G.cap.y) d *= 1.3;
  d += cityDefenseAt(x, y) + allyDefense();
  return d;
}
function playerStrength() { return defenseAt(G.cap.x, G.cap.y); }
function facStrength(f) { return f.troops * f.quality; }

function sharesBorder(f) {
  for (let i = 0; i < G.tiles.owner.length; i++) {
    if (G.tiles.owner[i] !== f.id) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) === 0)) return true;
  }
  return false;
}
function borderTilesWith(fid, other) {
  const out = [];
  for (let i = 0; i < G.tiles.owner.length; i++) {
    if (G.tiles.owner[i] !== fid) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) === other)) out.push({ x, y });
  }
  return out;
}

function aiExpand(f) {
  let best = null, bs = -1e9;
  for (let i = 0; i < G.tiles.owner.length; i++) {
    if (G.tiles.owner[i] !== -1) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (!N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) === f.id)) continue;
    const t = G.tiles.terrain[i];
    let s = -dist(x, y, f.cap.x, f.cap.y) + Math.random() * 4;
    if (t === T.DEEP) s -= 6; if (t === T.WATER) s -= 3; if (t === T.MEADOW || t === T.HILLS) s += 1.5; if (t === T.MOUNTAIN) s -= 2;
    { const sp = G.tiles.special[i]; if (sp >= 1 && sp <= 4) s += 4; }
    if (s > bs) { bs = s; best = i; }
  }
  if (best !== null) {
    G.tiles.owner[best] = f.id;
    const x = best % MAP_W, y = (best / MAP_W) | 0;
    if (TERRAIN[G.tiles.terrain[best]].build && Math.random() < 0.18) G.tiles.deco[best] = Math.random() < 0.5 ? 2 : 1;
    if (countAround(x, y, 1, (nx, ny) => G.tiles.owner[idx(nx, ny)] === 0)) f.relation -= f.personality === 'expansionist' ? 0.4 : 0.15;
    R.territoryDirty = true;
    return true;
  }
  return false;
}

function dailyFactions() {
  const pStr = playerStrength();
  const d = diff();
  let changed = false;
  for (const f of G.factions) {
    if (f.dead) continue;
    const fe = f.era || 1;
    f.quality = ERA_MIL[fe] * (1 + G.time.day / 1600 * d);
    const cap = (10 + f.tiles * 0.26 * d) * (1 + 0.18 * (fe - 1));
    f.troops = Math.min(cap, f.troops + (0.2 + f.tiles * 0.009) * d * (f.war || f.aiWar ? 1.3 : 1) * (1 + 0.1 * (fe - 1)));
    const pExp = { expansionist: 0.5, aggressive: 0.32, proud: 0.28, mercantile: 0.22, peaceful: 0.16 }[f.personality] * (f.subjugated ? 0.25 : 1) * (0.7 + d * 0.3) * (1 + 0.12 * (fe - 1));
    if (Math.random() < pExp) changed = aiExpand(f) || changed;
    if (!f.war) f.relation += (f.base + (f.gov && f.gov === G.gov ? 10 : 0) - f.relation) * 0.015;
    if (f.personality === 'expansionist' && G.time.day % 3 === 0 && sharesBorder(f)) f.relation -= 0.4;
    if (f.pact === 'nonaggression' && --f.pactDays <= 0) { f.pact = null; addLog(`The non-aggression pact with ${f.name} has expired.`, 'info'); }
    if (f.pact === 'alliance' && f.relation < 20) { f.pact = null; addLog(`💔 ${f.name} has broken off your alliance.`, 'bad'); }
    if (f.subjugated) { f.relation = Math.max(f.relation, 10); continue; }
    if (f.war) {
      f.warDays++; f.weariness += G.time.day < 80 ? 1.5 : 0.6;
      f.armyTimer--;
      if (f.armyTimer <= 0 && f.troops > 6) aiSendArmy(f);
      for (const a of G.factions) if (a.pact === 'alliance' && a !== f) f.troops = Math.max(0, f.troops - 0.4);
      if ((f.weariness > 45 || f.troops < 5 || (G.time.day < 80 && (f.warScore || 0) >= 4)) && !f.peaceOffered && Math.random() < 0.15) { f.peaceOffered = true; queueEvent('aiPeace', { fid: f.id }); }
    } else if (f.pact !== 'alliance' && f.pact !== 'nonaggression') {
      const early = G.time.day < 70;
      const hostileP = { aggressive: 0.06, expansionist: 0.045, proud: 0.04, mercantile: 0.012, peaceful: 0.006 }[f.personality] * d * (early ? 2 : 1);
      if (!bonded(f) && f.relation < (early ? -12 : -40) && facStrength(f) > pStr * (early ? 0.75 : 1.1) && Math.random() < hostileP && G.time.day > 12 && !anyWar()) aiDeclareWar(f);
      else if (f.relation < -10 && ['aggressive', 'proud', 'expansionist'].includes(f.personality) && G.time.day - f.lastDemand > 30 && facStrength(f) > pStr && Math.random() < 0.04 && G.time.day > 15) {
        f.lastDemand = G.time.day; queueEvent('aiDemand', { fid: f.id, gold: Math.round((30 + G.time.day * 0.6) * (1 + 0.3 * ((f.era || 1) - 1))) });
      }
    }
    f.relation = clamp(f.relation, -100, 100);
  }
  warTension();
  dailyVillages();
  // offers
  if (!G.nextOfferDay) G.nextOfferDay = 10;
  if (G.time.day >= G.nextOfferDay) { G.nextOfferDay = G.time.day + randi(10, 16); makeOffer(); }
  if (changed) recountTiles();
}

// Guarantees a first war early on, then keeps border tension alive between wars.
function warTension() {
  if (anyWar()) return;
  const d = diff();
  if (!G.flags.firstWarDay) G.flags.firstWarDay = randi(24, 32) + (d < 1 ? 10 : 0);
  const hostile = G.factions.filter(f => !f.dead && !f.subjugated && !f.pact && !f.war && !bonded(f));
  if (!hostile.length) return;
  const score = f => f.relation - (sharesBorder(f) ? 30 : 0) - (['aggressive', 'expansionist', 'proud'].includes(f.personality) ? 20 : 0);
  hostile.sort((a, b) => score(a) - score(b));
  const f = hostile[0];
  if (!G.flags.hadWar) {
    if (G.time.day >= G.flags.firstWarDay) { f.relation = Math.min(f.relation, -30); addLog(`😠 ${f.leader} of ${f.name} claims your borderlands belong to them!`, 'bad'); aiDeclareWar(f); }
    return;
  }
  const quiet = G.time.day - (G.flags.lastWarEnd || 0);
  if (quiet > 28 && f.relation < 20 && Math.random() < 0.03 * d) { f.relation = Math.min(f.relation, -30); addLog(`😠 Border tensions with ${f.name} boil over.`, 'bad'); aiDeclareWar(f); }
}

function makeOffer() {
  const fs = G.factions.filter(f => !f.dead && !f.war && !f.subjugated);
  if (!fs.length) return;
  const f = pick(fs);
  const opts = [];
  opts.push(['trade', 4]);
  if (borderTilesWith(f.id, 0).length && f.relation > -10 && f.tiles > 18) opts.push(['land', f.personality === 'mercantile' ? 4 : 2]);
  if (f.relation > 15 && !f.pact) opts.push(['nonagg', 2]);
  if (f.relation > 55 && f.pact !== 'alliance' && hasTech('diplomacy')) opts.push(['alliance', 3]);
  if (f.relation > 25 && G.kin.some(k => isAdult(k) && !k.partner && !k.soldier)) opts.push(['marriage', 1]);
  const enemies = G.factions.filter(o => o !== f && !o.dead && !o.subjugated);
  if (f.relation > 10 && enemies.length) opts.push(['help', 1.5]);
  let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, ch = opts[0][0];
  for (const [id, w] of opts) { r -= w; if (r <= 0) { ch = id; break; } }
  if (ch === 'trade') {
    const giveR = f.surplus, getR = f.need === 'gold' ? 'gold' : f.need;
    const amtGive = randi(25, 50);
    const amtGet = Math.max(5, Math.round(amtGive * TRADE_VALUE[giveR] * 0.6 / TRADE_VALUE[getR] * (1 + f.relation / 200)));
    queueEvent('aiTrade', { fid: f.id, give: { [giveR]: amtGive }, get: { [getR]: amtGet } });
  } else if (ch === 'land') {
    const bt = borderTilesWith(f.id, 0).filter(t => dist(t.x, t.y, f.cap.x, f.cap.y) >= 3);
    if (!bt.length) return;
    const t0 = pick(bt); const tiles = [t0];
    for (const t of bt) { if (tiles.length >= 4) break; if (t !== t0 && dist(t.x, t.y, t0.x, t0.y) <= 2) tiles.push(t); }
    const price = Math.round(tiles.reduce((s, t) => s + landPrice(f, t.x, t.y), 0) * 0.85);
    queueEvent('aiLand', { fid: f.id, tiles, price });
  } else if (ch === 'nonagg') queueEvent('aiNonAgg', { fid: f.id });
  else if (ch === 'alliance') queueEvent('aiAlliance', { fid: f.id });
  else if (ch === 'marriage') queueEvent('aiMarriage', { fid: f.id });
  else if (ch === 'help') queueEvent('aiHelp', { fid: f.id, eid: pick(enemies).id });
}

// ---------- Diplomacy actions ----------
function aiValue(f, r) { let v = TRADE_VALUE[r]; if (r === f.surplus) v *= 0.6; if (r === f.need) v *= 1.7; return v; }
function evaluateTrade(f, give, get) {
  let recv = 0, cost = 0;
  for (const r in give) recv += aiValue(f, r) * give[r];
  for (const r in get) cost += aiValue(f, r) * get[r];
  let greed = 1.25 - f.relation / 250 - (f.personality === 'mercantile' ? 0.12 : 0) - (f.pact === 'alliance' ? 0.1 : 0);
  if (f.war) return { ok: false, ratio: 0, why: 'At war' };
  for (const r in get) if ((f.stock[r] || 0) < get[r]) return { ok: false, ratio: recv / (cost * greed || 1), why: `They only have ${Math.floor(f.stock[r] || 0)} ${RES_INFO[r].name}` };
  const ratio = recv / (cost * greed || 1);
  return { ok: ratio >= 1, ratio, why: ratio >= 1 ? 'They would accept' : 'Not enough for them' };
}
function doTrade(f, give, get) {
  if (!canAfford(give)) { toast('You cannot afford that'); return false; }
  const ev = evaluateTrade(f, give, get);
  if (!ev.ok) { toast(`${f.name} declines: ${ev.why}`); f.relation -= 1; return false; }
  pay(give); gainAll(get);
  for (const r in give) f.stock[r] = (f.stock[r] || 0) + give[r];
  for (const r in get) f.stock[r] -= get[r];
  f.relation += 2 + (give[f.need] ? 3 : 0);
  G.stats.trades++;
  addLog(`🤝 Trade with ${f.name}: gave ${costStr(give)}, got ${costStr(get)}.`, 'good');
  return true;
}
function giftGold(f, amt) {
  if (G.res.gold < amt) return toast('Not enough gold');
  G.res.gold -= amt; track('gold', -amt);
  const k = { peaceful: 3.5, mercantile: 5, expansionist: 6, aggressive: 7, proud: 8 }[f.personality];
  f.relation += amt / k * (f.war ? 0.5 : 1);
  f.weariness += f.war ? amt / 10 : 0;
  addLog(`🎁 You sent ${amt} gold to ${f.name}.`, 'info');
}
function landPrice(f, x, y) {
  const i = idx(x, y), t = G.tiles.terrain[i];
  let p = 16 + ({ [T.MEADOW]: 8, [T.FOREST]: 6, [T.HILLS]: 8, [T.MOUNTAIN]: 4, [T.WATER]: -6, [T.DEEP]: -8 }[t] || 0) + (G.tiles.special[i] ? 14 : 0);
  p *= 1.6 - f.relation / 160;
  if (f.personality === 'mercantile') p *= 0.8;
  if (f.personality === 'proud') p *= 1.25;
  p *= Math.max(0.4, 1 - fx('land'));
  p *= (1 + G.stats.tiles / 300) * (1 + 0.25 * ((f.era || 1) - 1));
  return Math.max(6, Math.round(p));
}
function landSaleBlock(f, x, y) {
  if (f.war) return 'At war';
  if (f.subjugated) return null;
  if (f.relation < -15) return 'Relations too poor';
  if (dist(x, y, f.cap.x, f.cap.y) < 3) return 'Too close to their capital';
  if (f.tiles <= 14) return 'They will not give up more land';
  if (!N4.some(([dx, dy]) => ownerAt(x + dx, y + dy) === 0)) return 'Must border your land';
  return null;
}
function buyLand(f, tiles, price) {
  if (G.res.gold < price) { toast('Not enough gold'); return false; }
  G.res.gold -= price; track('gold', -price);
  for (const t of tiles) { const i = idx(t.x, t.y); if (G.tiles.owner[i] === f.id) { G.tiles.owner[i] = 0; G.tiles.deco[i] = 0; } }
  f.stock.gold += price; G.stats.trades++;
  recountTiles(); R.territoryDirty = true;
  addLog(`📜 Bought ${tiles.length} tile${tiles.length > 1 ? 's' : ''} from ${f.name} for ${price} gold.`, 'good');
  return true;
}
function areaTiles(f, x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (ownerAt(nx, ny) === f.id && dist(nx, ny, f.cap.x, f.cap.y) >= 3) out.push({ x: nx, y: ny });
  }
  return out;
}
function proposePact(f, type) {
  if (type === 'nonaggression') {
    if (f.relation < 15) return toast(`${f.name} doesn't trust you enough (needs relation 15).`);
    if (G.res.influence < 20) return toast('Needs 20 influence');
    G.res.influence -= 20; f.pact = 'nonaggression'; f.pactDays = 40; f.relation += 5;
    addLog(`🕊️ Non-aggression pact signed with ${f.name} (40 days).`, 'good');
  } else {
    if (!hasTech('diplomacy')) return toast('Requires Diplomacy');
    if (f.relation < 55) return toast(`${f.name} needs relation 55 for an alliance.`);
    if (G.res.influence < 50) return toast('Needs 50 influence');
    G.res.influence -= 50; f.pact = 'alliance'; f.relation += 10;
    addLog(`🤝 ${f.name} is now your ally!`, 'good'); toast(`Alliance formed with ${f.name}`);
  }
}
function demandTribute(f) {
  if (G.time.day - (f.lastTributeAsk || -99) < 20) return toast('You demanded tribute recently.');
  f.lastTributeAsk = G.time.day;
  const ratio = playerStrength() / Math.max(1, facStrength(f));
  if (ratio > 1.4) {
    const g = Math.round(30 + f.tiles);
    gain('gold', g); f.relation -= 25;
    addLog(`${f.name} grudgingly paid ${g} gold in tribute.`, 'info');
    if (f.personality === 'proud' && Math.random() < 0.35) aiDeclareWar(f);
  } else {
    f.relation -= 15;
    toast(`${f.name} laughs at your demand.`);
    addLog(`${f.name} refused your demand for tribute.`, 'bad');
    if (['aggressive', 'proud'].includes(f.personality) && Math.random() < 0.3) aiDeclareWar(f);
  }
}
function declareWar(f) {
  if (f.pact === 'alliance') return toast('You cannot attack an ally.');
  const broke = f.pact === 'nonaggression';
  f.pact = null; f.war = true; f.warDays = 0; f.weariness = 0; f.armyTimer = randi(3, 6); f.peaceOffered = false; f.warScore = 0;
  f.relation = Math.min(f.relation - 40, -50); G.flags.hadWar = true;
  for (const o of G.factions) if (o !== f && !o.dead) o.relation -= broke ? 15 : 4;
  addLog(`⚔️ You declared war on ${f.name}!${broke ? ' (Breaking your pact angers everyone.)' : ''}`, 'bad');
}
function aiDeclareWar(f) {
  if (f.war) return;
  f.war = true; f.warDays = 0; f.weariness = 0; f.armyTimer = G.time.day < 60 ? randi(4, 6) : randi(2, 4); f.peaceOffered = false; f.warScore = 0; f.pact = null;
  f.relation = Math.min(f.relation, -50); G.flags.hadWar = true;
  queueEvent('aiWar', { fid: f.id });
  autoArmy();
}
function endWar(f, msg) {
  G.flags.lastWarEnd = G.time.day;
  f.war = false; f.warDays = 0; f.weariness = 0; f.peaceOffered = false; f.pact = 'nonaggression'; f.pactDays = 30;
  f.relation = Math.max(f.relation, -20);
  for (const a of G.armies.filter(a => a.owner === f.id)) { f.troops += a.n; a.dead = true; }
  for (const a of G.armies.filter(a => a.owner === 0 && a.fid === f.id && a.mode === 'attack')) { a.mode = 'return'; routeArmyHome(a); }
  G.armies = G.armies.filter(a => !a.dead);
  addLog(`🕊️ ${msg || `Peace with ${f.name}.`}`, 'good');
}
function peaceTerms(f) {
  const score = f.weariness + (playerStrength() - facStrength(f)) * 1.5 + f.relation / 3 + (f.warScore || 0) * -6;
  if (score > 25) return { accept: true, gold: 0 };
  return { accept: false, gold: Math.round(40 + facStrength(f) * 4 + G.time.day * 0.4) };
}

// ---------- Armies ----------
function barracksList() { return Object.values(G.buildings).filter(b => b.type === 'barracks'); }
function barracksCap() { let c = 0; for (const b of barracksList()) c += B.barracks.soldiers[b.level - 1]; return Math.round(c * (1 + fx('barracks'))); }
function trainCost() { return { gold: Math.round(22 * (1 + 0.35 * (thLevel() - 1)) * Math.max(0.3, 1 - fx('train'))) }; }
function trainSoldier(b, quiet) {
  const say = m => { if (!quiet) toast(m); return false; };
  if (soldiers().length >= barracksCap()) return say('Barracks are full — build or upgrade barracks.');
  const cost = trainCost();
  if (!canAfford(cost)) return say(`Training costs ${costStr(cost)}`);
  const cands = G.kin.filter(k => canWork(k) && !k.away);
  if (!cands.length || (quiet && cands.length <= 2)) return say('No able-bodied adults available.');
  cands.sort((a, c) => (c.traits.includes('brave') * 3 - c.traits.includes('timid') * 3 + (!c.job) * 2) - (a.traits.includes('brave') * 3 - a.traits.includes('timid') * 3 + (!a.job) * 2));
  const k = cands[0];
  why('Training soldiers', pay, cost);
  if (k.job) { const ob = G.buildings[k.job]; if (ob) ob.workers = ob.workers.filter(i => i !== k.id); }
  k.soldier = true; k.job = b.id; b.workers.push(k.id);
  G.stats.trained++;
  if (k.traits.includes('timid')) addMod('Drafted unwillingly', -12, 6, k.id);
  if (!quiet) addLog(`🛡️ ${kinName(k)} has joined the army.`, 'info');
  autoAssignJobs();
  return true;
}
// Army stance: how many soldiers to keep. Recruiting and discharging happen automatically.
const ARMY_STANCES = { none: 'No standing army', guard: 'Guard (half of barracks, more in war)', full: 'Full strength (every barracks slot)' };
function armyTarget() {
  const cap = barracksCap(), st = G.policies.army || 'guard';
  if (st === 'none') return 0;
  if (st === 'full') return cap;
  return Math.min(cap, Math.max(2, Math.ceil(cap * (anyWar() ? 0.8 : 0.5))));
}
function autoArmy(trim) {
  if (!G || !barracksList().length) return;
  const tgt = armyTarget(), before = soldiers().length;
  let n = 0;
  while (soldiers().length < tgt && n < 3) { if (!trainSoldier(barracksList()[0], true)) break; n++; }
  if (n) addLog(`🛡️ ${n} kin joined the army (${soldiers().length}/${tgt}).`, 'info');
  // soldiers you trained yourself are never sent home behind your back (that wasted their training gold);
  // extras are only discharged when you lower the stance or a war ends
  const war = anyWar(); if (G.wasWar && !war) trim = true; G.wasWar = war;
  let extra = soldiers().length - tgt;
  if (trim && extra > 0 && !war) { addLog(`🛡️ ${extra} soldier${extra > 1 ? 's' : ''} went home to save upkeep.`, 'info'); }
  if (trim && extra > 0 && !war) for (const k of garrison().sort((a, b) => soldierPower(a) - soldierPower(b))) { if (extra-- <= 0) break; disbandSoldier(k); }
  return soldiers().length - before;
}
function armyPower(list) { return (list || garrison()).reduce((s, k) => s + soldierPower(k), 0); }
function estDefense(f, x, y) {
  if (f.minor) return villageStrength(f) * (terr(x, y) === T.HILLS ? 1.2 : 1);
  const isCap = x === f.cap.x && y === f.cap.y;
  const def = isCap ? Math.min(f.troops, 6 + f.troops * 0.6) : Math.min(f.troops, 3 + f.troops * 0.3);
  return Math.max(1, def) * f.quality * (terr(x, y) === T.HILLS ? 1.2 : 1) * (isCap ? 1.6 : 1);
}
// Picks the closest reachable enemy tile (or their capital).
function attackTarget(f, mode) {
  if (mode === 'capital') return { x: f.cap.x, y: f.cap.y };
  const home = barracksList()[0] || townhall();
  let ts = borderTilesWith(f.id, 0);
  if (!ts.length) { ts = []; for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) ts.push({ x: i % MAP_W, y: (i / MAP_W) | 0 }); }
  ts = ts.filter(t => TERRAIN[terr(t.x, t.y)].pass && !(t.x === f.cap.x && t.y === f.cap.y));
  ts.sort((a, b) => dist(a.x, a.y, home.x, home.y) - dist(b.x, b.y, home.x, home.y));
  for (const t of ts.slice(0, 8)) if (findPath(home.x, home.y, t.x, t.y, true)) return t;
  return null;
}
function quickAttack(fid, mode, count) {
  const f = fac(fid); if (!f || !f.war) return false;
  const t = attackTarget(f, mode);
  if (!t) { toast(`No land route to ${f.name} — try building a bridge.`); return false; }
  const a = sendArmy(t.x, t.y, count || garrison().length);
  if (a) { R.flyTo(t.x, t.y); toast(`🚩 ${a.n} soldiers march on ${mode === 'capital' ? f.name + "'s capital" : f.name}`); }
  return !!a;
}
function disbandSoldier(k) {
  const b = G.buildings[k.job]; if (b) b.workers = b.workers.filter(i => i !== k.id);
  k.soldier = false; k.job = null; autoAssignJobs();
}
function armySpeed() { return 1.6 * (1 + fx('march')); }
function sendArmy(tx, ty, count) {
  const f = fac(G.tiles.owner[idx(tx, ty)]);
  if (!f || !f.war) return toast('You can only attack land of a faction you are at war with.');
  const ff = fieldForce(count), avail = ff.kin;
  if (!avail.length && !ff.ex.length) return toast('No soldiers available.');
  const home = barracksList()[0] || townhall();
  const path = findPath(home.x, home.y, tx, ty, true);
  if (!path) return toast('No land route to that tile.');
  for (const k of avail) { k.away = true; k.path = null; k.state = 'away'; }
  const extra = musterExtras(ff.ex);
  const a = { id: G.nextA++, owner: 0, fid: f.id, kin: avail.map(k => k.id), extra, n: avail.length + extrasN(extra), x: home.x, y: home.y, path, pi: 0, target: { x: tx, y: ty }, home: { x: home.x, y: home.y }, mode: 'attack' };
  G.armies.push(a);
  addLog(`🚩 ${a.n} troops march on ${f.name}${extra.length ? ` — ${avail.length} soldiers with ${Object.entries(extra.reduce((o, e) => { o[e.kind] = (o[e.kind] || 0) + e.n; return o; }, {})).map(([k, n]) => `${n} ${{ vet: 'veterans', levy: 'city levies', vassal: 'vassal troops' }[k]}`).join(', ')}` : ''} (power ${ff.P.toFixed(0)}).`, 'info');
  return a;
}
function aiSendArmy(f) {
  f.armyTimer = randi(8, 13);
  let targets = borderTilesWith(0, f.id);
  if (!targets.length) {
    // nearest player tiles
    const all = []; for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === 0) all.push({ x: i % MAP_W, y: (i / MAP_W) | 0 });
    all.sort((a, b) => dist(a.x, a.y, f.cap.x, f.cap.y) - dist(b.x, b.y, f.cap.x, f.cap.y));
    targets = all.slice(0, 8);
  }
  targets = targets.filter(t => TERRAIN[terr(t.x, t.y)].pass);
  if (!targets.length) return;
  // prefer tiles with buildings sometimes, or the capital late in war
  let t = pick(targets);
  const withB = targets.filter(t => G.tiles.bld[idx(t.x, t.y)]); if (withB.length && Math.random() < 0.5) t = pick(withB);
  if (f.warDays > 25 && Math.random() < 0.3) t = { x: G.cap.x, y: G.cap.y };
  // start from nearest own tile
  let start = f.cap, bd = 1e9;
  for (let i = 0; i < G.tiles.owner.length; i++) { if (G.tiles.owner[i] !== f.id || !TERRAIN[G.tiles.terrain[i]].pass) continue; const x = i % MAP_W, y = (i / MAP_W) | 0; const d = dist(x, y, t.x, t.y) + dist(x, y, f.cap.x, f.cap.y) * 0.5; if (d < bd) { bd = d; start = { x, y }; } }
  const path = findPath(start.x, start.y, t.x, t.y, true);
  if (!path) return;
  let n = Math.max(2, Math.round(f.troops * rand(0.3, 0.5)));
  n = Math.min(n, 3 + Math.floor(G.time.day / 12));
  f.troops -= n;
  G.armies.push({ id: G.nextA++, owner: f.id, n, x: start.x, y: start.y, path, pi: 0, target: t, mode: 'attack' });
  addLog(`⚠️ An army of ${n} from ${f.name} marches toward your land!`, 'bad');
  toast(`⚠️ ${f.name} army (${n}) is marching on you!`);
}
function routeArmyHome(a) {
  const p = findPath(Math.round(a.x), Math.round(a.y), a.home.x, a.home.y, true);
  a.path = p || []; a.pi = 0;
}
function updateArmies(dtH) {
  for (const a of G.armies) {
    if (a.dead) continue;
    if (a.mode === 'intercept') { chaseArmy(a); if (a.dead || a.mode !== 'intercept') continue; }
    if (a.mode === 'battle') continue;
    let step = armySpeed() * dtH * (a.owner ? 1.5 / 1.6 : 1);
    while (step > 0 && a.path && a.pi < a.path.length) {
      const ti = a.path[a.pi], gx = ti % MAP_W, gy = (ti / MAP_W) | 0;
      const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
      if (d <= step) { a.x = gx; a.y = gy; step -= d; a.pi++; } else { a.x += dx / d * step; a.y += dy / d * step; step = 0; }
    }
    if (!a.path || a.pi >= a.path.length) {
      if (a.mode === 'attack') { a.owner === 0 ? playerBattle(a) : aiBattle(a); }
      else if (a.mode === 'return') {
        for (const id of a.kin) { const k = kinById(id); if (k) { k.away = false; k.x = a.home.x; k.y = a.home.y; k.state = 'idle'; k.dest = null; } }
        returnExtras(a); a.dead = true;
      }
    }
  }
  G.armies = G.armies.filter(a => !a.dead);
}
function playerBattle(a) {
  const f = fac(G.tiles.owner[idx(a.target.x, a.target.y)]);
  if (!f || !f.war) { a.mode = 'return'; routeArmyHome(a); return; }
  const troops = a.kin.map(kinById).filter(Boolean);
  if (!troops.length && !extrasN(a.extra)) { a.dead = true; return; }
  const isCap = a.target.x === f.cap.x && a.target.y === f.cap.y;
  const defenders = f.minor ? f.troops : isCap ? Math.min(f.troops, 6 + f.troops * 0.6) : Math.min(f.troops, 3 + f.troops * 0.3);
  const dmult = f.quality * (terr(a.target.x, a.target.y) === T.HILLS ? 1.2 : 1) * (f.minor ? 1.15 : isCap ? 1.6 : 1);
  const A = troops.reduce((s, k) => s + soldierPower(k), 0) + extrasPower(a.extra);
  const D = Math.max(1, defenders) * dmult;
  if (G.settings.battles !== 'auto' && !window.BOT_ACTIVE && typeof startBattle === 'function' && !UI.battle && wantTactical(A, D)) { a.mode = 'battle'; startBattle(a, f, troops, defenders, dmult, isCap); return; }
  const win = Math.random() < winChance(A, D);
  const lossP = lossShare(win, A, D);
  const fallen = troops.filter(k => Math.random() < lossP * (k.traits.includes('brave') ? 0.85 : 1)).map(k => k.id);
  a.xLoss = lossP;
  resolveBattle(a, f, win, fallen, win ? defenders * 0.7 : defenders * 0.25 * Math.min(1, A / D), isCap);
}
function resolveBattle(a, f, win, fallenIds, defLoss, isCap) {
  for (const id of fallenIds) { const k = kinById(id); if (k) killKin(k, `wounds in battle against ${f.name}`); }
  a.kin = a.kin.filter(id => kinById(id));
  if (a.xLoss != null) { loseExtras(a, a.xLoss); a.xLoss = null; }
  a.n = armyN(a);
  if (a.fieldEnemy) { resolveField(a, f, win, fallenIds, defLoss); a.fieldEnemy = null; a.mode = 'return'; routeArmyHome(a); if (!armyN(a)) a.dead = true; return; }
  f.troops = Math.max(0, f.troops - defLoss);
  if (win) {
    f.weariness = (f.weariness || 0) + 12; f.warScore = (f.warScore || 0) - 2;
    G.stats.battlesWon++;
    if (f.minor) absorbVillage(f, 'conquer');
    else if (isCap) subjugate(f, a);
    else {
      let n = 0; const took = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = a.target.x + dx, y = a.target.y + dy;
        if (Math.hypot(dx, dy) <= 2.3 && ownerAt(x, y) === f.id && !(x === f.cap.x && y === f.cap.y)) { G.tiles.owner[idx(x, y)] = 0; took.push(idx(x, y)); n++; }
      }
      gain('gold', n * 8);
      const td = why('Conquest', takeDistrict, f, took);
      const pris = Math.min(6, Math.round(f.troops * 0.1)); if (pris > 0) { f.troops -= pris; addVets(pris); }
      addLog(`🏆 Victory! Your army took ${n} tiles from ${f.name}${td.got.n ? ` with ${td.got.n} building${td.got.n > 1 ? 's' : ''}` : ''}${Object.keys(td.loot.got).length ? ` and plundered ${costStr(td.loot.got)}` : ''} (lost ${fallenIds.length}).`, 'good');
      floatText(a.target.x, a.target.y, 'Victory!', '#ffd54f');
    }
    recountTiles(); R.territoryDirty = true;
  } else {
    f.warScore = (f.warScore || 0) + 1;
    addLog(`💀 Defeat at ${f.name}. ${fallenIds.length} soldiers fell.`, 'bad');
    floatText(a.target.x, a.target.y, 'Defeat', '#ef5350');
  }
  a.mode = 'return'; routeArmyHome(a);
  if (!armyN(a)) a.dead = true;
}
// ---------- Independent villages ----------
function villageStrength(v) { return Math.max(1, v.troops) * v.quality * 1.15; }
function annexCost(v) { return { influence: Math.round(20 + v.tiles * 2.5), gold: Math.round(30 + v.pop * 12) }; }
function annexReady(v) { return playerStrength() >= villageStrength(v) * 2.2; }
function absorbVillage(v, how) {
  let n = 0; const took = [];
  for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === v.id) { G.tiles.owner[i] = 0; n++; took.push(i); }
  // the village's cottages, fields and camps become real buildings of yours
  const vg = convertDeco(took, 1);
  addVets(v.troops * 0.7);
  const pop = Math.floor(how === "conquer" ? Math.max(1, v.pop - 1) : v.pop);
  const sur = pick(SURNAMES), arr = [];
  for (let k = 0; k < pop; k++) arr.push(makeKin({ surname: Math.random() < 0.5 ? sur : undefined, age: k === pop - 1 && pop > 2 ? randi(5, 13) : randi(18, 45), x: v.cap.x, y: v.cap.y }));
  for (const k of arr) if (how === 'conquer') addMod('Conquered', -15, 8, k.id);
  if (how === 'conquer') { gain('gold', 20 + n * 4); gain('food', 25); }
  v.dead = true; v.war = false;
  G.stats.villages = (G.stats.villages || 0) + 1;
  addLog(how === 'conquer' ? `🏴 Your army took ${v.name}! +${n} tiles and ${arr.length} new (unhappy) kin.` : `🤝 ${v.name} joined ${G.realm.name} peacefully! +${n} tiles and ${arr.length} new kin.`, 'good');
  toast(how === 'conquer' ? `🏴 ${v.name} conquered!` : `🤝 ${v.name} joined your realm!`);
  floatText(v.cap.x, v.cap.y, how === 'conquer' ? 'Conquered!' : 'Joined!', '#ffd54f');
  recountTiles(); R.territoryDirty = true;
  const vc = cityAtConquest(v.cap.x, v.cap.y, v.name);
  if (vc && how !== 'conquer') { vc.origin = 'joined'; vc.unrest = 5; }
  if (!vc) addLog(`${v.name} is too close to another hall to become a city; its people join your capital.`, 'info');
  linkAll(vg.list, true);
  assignHousing(); autoAssignJobs();
}
function annexVillage(v) {
  if (!annexReady(v)) return toast(`${v.name} doesn't think you're strong enough to protect them (need defense ${Math.ceil(villageStrength(v) * 2.2)}).`);
  const c = annexCost(v); if (!canAfford(c)) return toast(`Annexing costs ${costStr(c)}`);
  pay(c); absorbVillage(v, 'annex'); addMod('Our realm grows', 5, 4);
  return true;
}
function attackVillage(v) {
  if (!fieldForce().n) return toast('No soldiers at home — build a Barracks first.');
  v.war = true;
  return quickAttack(v.id, 'capital');
}
function dailyVillages() {
  for (const v of G.villages || []) {
    if (v.dead) continue;
    v.troops = Math.min(3 + v.tiles * 0.35 + G.time.day / 45, v.troops + 0.05);
    v.pop = Math.min(10, (v.pop || 3) + 0.025);
    if (Math.random() < 0.04) { // villages slowly spread into the wilds around them
      const opts = []; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = v.cap.x + dx, y = v.cap.y + dy; if (ownerAt(x, y) === -1 && N4.some(([a, b]) => ownerAt(x + a, y + b) === v.id)) opts.push(idx(x, y)); }
      if (opts.length) { G.tiles.owner[pick(opts)] = v.id; R.territoryDirty = true; }
    }
    v.quality = 1 + G.time.day / 900;
  }
}
function subjugate(f, a) {
  floatText(a.target.x, a.target.y, 'Capital taken!', '#ffd54f');
  f.war = false; f.pact = null; f.relation = 10;
  if (f.rebel) { annexRealm(f, 'conquer'); history(`${G.realm.name} crushed the rebels of ${f.name}.`, '⚔️'); return; }
  queueEvent('conquest', { fid: f.id });
}
function subjugateOld(f, a) {
  let n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = f.cap.x + dx, y = f.cap.y + dy;
    if (ownerAt(x, y) === f.id && Math.hypot(dx, dy) <= 3.2) { G.tiles.owner[idx(x, y)] = 0; n++; }
  }
  if (f.rebel) { for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) { G.tiles.owner[i] = 0; n++; } f.dead = true; history(`${G.realm.name} crushed the rebels of ${f.name}.`, '⚔️'); }
  f.war = false; f.subjugated = true; f.pact = null; f.relation = 10;
  // move their capital to their largest remaining tile cluster if any
  let best = null, bd = 1e9;
  for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === f.id) { const x = i % MAP_W, y = (i / MAP_W) | 0; const d = dist(x, y, f.cap.x, f.cap.y); if (d < bd) { bd = d; best = { x, y }; } }
  gain('gold', 100); gain('influence', 40);
  const oldCap = { x: f.cap.x, y: f.cap.y };
  recountTiles(); cityAtConquest(oldCap.x, oldCap.y, `${f.name.split(' ')[0]} March`);
  if (best) { f.cap = best; G.tiles.deco[idx(best.x, best.y)] = 3; } else f.dead = true;
  addLog(f.rebel ? `⚔️ The rebellion of ${f.name} is over: their land is yours again. (+${n} tiles)` : `👑 ${f.name}'s capital has fallen! They are now your vassal and pay tribute. (+${n} tiles)`, 'good');
  toast(`👑 ${f.name} subjugated!`);
  floatText(a.target.x, a.target.y, 'Capital taken!', '#ffd54f');
}
function aiBattle(a) {
  const f = fac(a.owner);
  a.dead = true;
  if (!f || !f.war) { if (f) f.troops += a.n; return; }
  const ti = idx(a.target.x, a.target.y);
  if (G.tiles.owner[ti] !== 0) { f.troops += a.n; return; }
  const D = defenseAt(a.target.x, a.target.y);
  const A = a.n * f.quality;
  const gar = garrison();
  if (Math.random() < winChance(A, D)) {
    const fallen = gar.filter(() => Math.random() < 0.2 * D / A);
    cityLosses(a.target.x, a.target.y, 0.35);
    for (const k of fallen) killKin(k, `defending against ${f.name}`);
    f.troops += a.n * (1 - 0.3 * D / A);
    f.warScore = (f.warScore || 0) + 2;
    if (a.target.x === G.cap.x && a.target.y === G.cap.y) {
      const fm = fx('raid') ? 0.5 : 1; const g = Math.floor(Math.min(G.res.gold * 0.12, 30 + G.time.day) * fm); G.res.gold -= g;
      const lost = {}; for (const r of CAPPED) { const v = Math.floor(G.res[r] * 0.08 * fm); G.res[r] -= v; if (v) lost[r] = v; }
      addLog(`🔥 ${f.name} raided your capital, carrying off ${g} gold and ${costStr(lost)}.`, 'bad');
      addMod('Capital raided', -10, 4);
    } else {
      // they take a few empty tiles; buildings are spared but plundered
      let n = 0; const plunder = {};
      for (let dy = -1; dy <= 1 && n < 3; dy++) for (let dx = -1; dx <= 1 && n < 3; dx++) {
        const x = a.target.x + dx, y = a.target.y + dy;
        if (ownerAt(x, y) !== 0 || dist(x, y, G.cap.x, G.cap.y) < 3) continue;
        if (bAt(x, y)) { for (const r of ['food', 'wood', 'stone']) { const v = Math.floor(G.res[r] * 0.03); G.res[r] -= v; plunder[r] = (plunder[r] || 0) + v; } continue; }
        G.tiles.owner[idx(x, y)] = f.id; if (G.tiles.road[idx(x, y)]) pathsDirty(); G.tiles.road[idx(x, y)] = 0; n++;
      }
      addLog(`💀 ${f.name} broke through and seized ${n} empty tile${n === 1 ? '' : 's'}${Object.keys(plunder).length ? `, plundering ${costStr(plunder)}` : ''}. ${fallen.length} defenders fell.`, 'bad');
      addMod('Lost land to invaders', -6, 4);
      recountTiles(); R.territoryDirty = true;
    }
    floatText(a.target.x, a.target.y, 'Overrun!', '#ef5350');
  } else {
    const fallen = gar.filter(() => Math.random() < 0.15 * A / Math.max(1, D));
    cityLosses(a.target.x, a.target.y, 0.1);
    for (const k of fallen) killKin(k, `defending against ${f.name}`);
    f.troops += a.n * rand(0.1, 0.35);
    f.weariness += 15; f.warScore = (f.warScore || 0) - 1;
    G.stats.battlesWon++;
    addLog(`🛡️ Your defenders repelled ${f.name}'s army of ${a.n}! (${fallen.length} fell)`, 'good');
    floatText(a.target.x, a.target.y, 'Repelled!', '#81c784');
    addMod('Defended our home', 6, 4);
  }
}
