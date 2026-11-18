// ===== Vassal cities, spies, royal marriages, allied war and army interception =====
const CITY_NAMES = ['Northwatch', 'Riverhold', 'Highmoor', 'Eastmarch', 'Greywater', 'Fallowfield', 'Kingsrest', 'Westbrook', 'Ironford', 'Larkhaven', 'Southgate', 'Copperhill', 'Mistvale', 'Redcliff'];
function levyCost() { return { gold: Math.round(15 * (1 + 0.3 * (thLevel() - 1)) * Math.max(0.3, 1 - fx('levy'))) }; }

// ---------- Vassal cities ----------
function cities() { return (G.cities || []).filter(c => G.buildings[c.bid]); }
function cityOf(b) { return (G.cities || []).find(c => c.bid === b.id); }
function levyCap(c) { const b = G.buildings[c.bid]; return 3 + 3 * (b ? b.level : 1) + Math.floor((c.pop || 0) / 15); }
function levyPower(c) { const b = G.buildings[c.bid]; return c.levies * armyMult() * (1 + 0.25 * ((b ? b.level : 1) - 1)) * 0.9; }
function citySiteBlock(x, y) {
  const halls = Object.values(G.buildings).filter(b => b.type === 'townhall' || b.type === 'cityhall');
  const near = halls.find(b => dist(b.x, b.y, x, y) < 10);
  return near ? `Too close to ${near.type === 'townhall' ? 'your capital' : 'another city'} (needs 10 tiles)` : null;
}
function foundCity(b, name, quiet) {
  if (!G.cities) G.cities = [];
  const used = new Set(G.cities.map(c => c.name));
  const nm = name || CITY_NAMES.find(n => !used.has(n)) || `New ${pick(CITY_NAMES)}`;
  let n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = b.x + dx, y = b.y + dy; if (!inB(x, y) || Math.hypot(dx, dy) > 3.2) continue;
    if (G.tiles.owner[idx(x, y)] === -1) { G.tiles.owner[idx(x, y)] = 0; n++; }
  }
  const c = { bid: b.id, name: nm, levies: 2, founded: G.time.day, autoIntercept: true };
  G.cities.push(c);
  G.stats.claimed += n; recountTiles(); R.territoryDirty = true;
  if (!quiet) { addLog(`🏰 Founded the vassal city of ${nm}! It claims ${n} tiles, pays tribute and keeps its own garrison.`, 'good'); toast(`🏰 ${nm} founded!`); }
  return c;
}
// After taking a region, set up a city at its old centre if possible.
function cityAtConquest(x, y, name) {
  if (citySiteBlock(x, y)) return null;
  const i = idx(x, y);
  if (G.tiles.owner[i] !== 0 || !TERRAIN[G.tiles.terrain[i]].build) return null;
  if (G.tiles.bld[i]) return null;
  G.tiles.deco[i] = 0;
  const r = placeBuilding('cityhall', x, y, true);
  if (!r.ok) return null;
  const c = foundCity(r.b, name); c.origin = 'taken'; c.unrest = 25; return c;
}
function raiseLevy(c, quiet) {
  if (c.levies >= levyCap(c)) { if (!quiet) toast(`${c.name}'s garrison is full — upgrade its hall.`); return false; }
  const lc = levyCost(); if (!canAfford(lc)) { if (!quiet) toast(`A levy costs ${costStr(lc)}`); return false; }
  why('Raising levies', pay, lc); c.levies++; if (!quiet) c.manual = Math.min(levyCap(c), (c.manual || 0) + 1); return true;
}
function dailyCities() {
  const sm = 1 + fx('tribute');
  for (const c of cities()) {
    const b = G.buildings[c.bid], L = b.level;
    const cm = c.concession > G.time.day ? 0.5 : 1;
    _why = 'City tribute'; gain('gold', 1.5 * L * sm * cm); gain('influence', 0.5 * L * sm); gain('food', 2 * L * sm);
    _why = 'Levy upkeep'; if (c.levies) { G.res.gold -= c.levies * 0.3; track('gold', -c.levies * 0.3); }
    // cities keep a small watch in peacetime and arm fully only in war (and only from a healthy treasury)
    const want = anyWar() ? levyCap(c) : Math.min(levyCap(c), 2);
    if (c.levies < want && G.res.gold > 150 && G.time.day % (anyWar() ? 2 : 6) === 0) raiseLevy(c, true);
    // after a war, levies the city raised on its own go home a few at a time (ones you raised yourself stay)
    if (!anyWar() && c.levies > Math.max(2, c.manual || 0) && G.time.day % 3 === 0) c.levies--;
  }
}
function cityDefenseAt(x, y) { let d = 0; for (const c of cities()) { const b = G.buildings[c.bid]; if (dist(b.x, b.y, x, y) <= 8) d += levyPower(c); } return d; }
function cityLosses(x, y, frac) { for (const c of cities()) { const b = G.buildings[c.bid]; if (dist(b.x, b.y, x, y) <= 8) c.levies = Math.max(0, Math.round(c.levies * (1 - frac))); } }

// ---------- Intercepting marching armies ----------
function enemyArmies() { return G.armies.filter(a => a.owner > 0 && !a.dead && a.mode === 'attack'); }
function interceptArmy(eid, count) {
  const e = G.armies.find(a => a.id === eid); if (!e || e.dead) return toast('That army is gone.');
  const f = fac(e.owner);
  const avail = garrison().sort((a, b) => soldierPower(b) - soldierPower(a)).slice(0, count || garrison().length);
  if (!avail.length) return toast('No soldiers at home to intercept with.');
  const home = barracksList()[0] || townhall();
  const path = findPath(home.x, home.y, Math.round(e.x), Math.round(e.y), true);
  if (!path) return toast('Your soldiers cannot reach that army.');
  for (const k of avail) { k.away = true; k.path = null; k.state = 'away'; }
  const a = { id: G.nextA++, owner: 0, fid: f.id, kin: avail.map(k => k.id), n: avail.length, x: home.x, y: home.y, path, pi: 0, target: { x: Math.round(e.x), y: Math.round(e.y) }, home: { x: home.x, y: home.y }, mode: 'intercept', enemy: e.id };
  G.armies.push(a);
  addLog(`🏇 ${avail.length} soldiers ride out to intercept ${f.name}'s army.`, 'info');
  toast(`🏇 Intercepting ${f.name}'s army of ${e.n}`);
  return a;
}
// called each sim step for armies in 'intercept' mode
function chaseArmy(a) {
  const e = G.armies.find(o => o.id === a.enemy && !o.dead);
  if (!e) { a.mode = 'return'; routeArmyHome(a); addLog('The enemy army is gone; your soldiers head home.', 'info'); return; }
  if (Math.hypot(e.x - a.x, e.y - a.y) < 1.3) return fieldBattle(a, e);
  const ex = Math.round(e.x), ey = Math.round(e.y);
  if (!a.path || a.pi >= a.path.length || Math.hypot(ex - a.target.x, ey - a.target.y) > 1.5) {
    const p = findPath(Math.round(a.x), Math.round(a.y), ex, ey, true);
    a.target = { x: ex, y: ey }; a.path = p || []; a.pi = 0;
    if (!p) { a.mode = 'return'; routeArmyHome(a); }
  }
}
function fieldBattle(a, e) {
  const f = fac(e.owner);
  const troops = a.kin.map(kinById).filter(Boolean);
  if (!troops.length) { a.dead = true; return; }
  a.fieldEnemy = e.id;
  const dmult = f.quality * (terr(Math.round(e.x), Math.round(e.y)) === T.HILLS ? 1.15 : 1);
  const A = troops.reduce((s, k) => s + soldierPower(k), 0) * 1.1; // ambush bonus
  const D = Math.max(1, e.n) * dmult;
  if (G.settings.battles !== 'auto' && !window.BOT_ACTIVE && typeof startBattle === 'function' && !UI.battle && wantTactical(A, D)) { a.mode = 'battle'; startBattle(a, f, troops, e.n, dmult, false); return; }
  const win = Math.random() < winChance(A, D), lossP = lossShare(win, A, D) * 0.85;
  const fallen = troops.filter(k => Math.random() < lossP).map(k => k.id);
  resolveBattle(a, f, win, fallen, win ? e.n : e.n * 0.3 * Math.min(1, A / D), false);
}
// resolveBattle hands interception outcomes here
function resolveField(a, f, win, fallenIds, defLoss) {
  const e = G.armies.find(o => o.id === a.fieldEnemy);
  if (win) {
    if (e) { f.troops += Math.max(0, e.n - defLoss) * 0.3; e.dead = true; }
    f.weariness = (f.weariness || 0) + 15; f.warScore = (f.warScore || 0) - 2; G.stats.battlesWon++;
    gain('gold', 10 + (e ? e.n * 3 : 0));
    addLog(`🏇 Your soldiers caught ${f.name}'s army on the march and routed it! (lost ${fallenIds.length})`, 'good');
    floatText(Math.round(a.x), Math.round(a.y), 'Ambushed!', '#ffd54f');
    addMod('Enemy routed', 6, 4);
  } else {
    if (e) e.n = Math.max(1, Math.round(e.n - defLoss));
    f.warScore = (f.warScore || 0) + 1;
    addLog(`💀 The interception failed. ${fallenIds.length} soldiers fell; ${f.name}'s army marches on.`, 'bad');
    floatText(Math.round(a.x), Math.round(a.y), 'Repulsed', '#ef5350');
  }
}
// City garrisons ride out against armies that pass close by.
function cityIntercepts() {
  for (const c of cities()) {
    if (!c.autoIntercept || c.levies < 2) continue;
    const b = G.buildings[c.bid];
    for (const e of enemyArmies()) {
      if (dist(Math.round(e.x), Math.round(e.y), b.x, b.y) > 6) continue;
      const f = fac(e.owner), P = levyPower(c), D = e.n * f.quality;
      if (P < D * 0.9) continue; // too risky — they stay behind their walls
      leviesFight(c, e);
    }
  }
}
function leviesFight(c, e) {
  const f = fac(e.owner), b = G.buildings[c.bid];
  const P = levyPower(c), D = e.n * f.quality, win = Math.random() < winChance(P, D);
  if (win) {
    e.dead = true; c.levies = Math.max(0, Math.round(c.levies * (1 - 0.25 * D / P)));
    f.weariness = (f.weariness || 0) + 10; f.troops += e.n * 0.2; G.stats.battlesWon++;
    addLog(`🏰 The garrison of ${c.name} intercepted ${f.name}'s army of ${e.n} and scattered it!`, 'good');
    floatText(b.x, b.y, 'Intercepted!', '#81c784');
  } else {
    e.n = Math.max(1, Math.round(e.n * (1 - 0.35 * P / D))); c.levies = Math.max(0, Math.round(c.levies * 0.4));
    addLog(`🏰 ${c.name}'s garrison tried to stop ${f.name}'s army but was beaten back.`, 'bad');
  }
  return win;
}

// ---------- Spies ----------
const SPY_MISSIONS = {
  scout: { name: 'Scout', icon: '🔍', cost: { gold: 10 }, days: 2, chance: 0.9, desc: 'Learn their troops, plans and stores for 30 days. Your battle scouts become far more reliable against them.' },
  steal: { name: 'Steal gold', icon: '💰', cost: { gold: 15 }, days: 3, chance: 0.55, desc: 'Lift gold from their treasury.' },
  sabotage: { name: 'Sabotage', icon: '🔥', cost: { gold: 25 }, days: 4, chance: 0.5, desc: 'Burn their armouries: −30% troops and their next army is delayed.' },
  incite: { name: 'Incite unrest', icon: '🗣️', cost: { influence: 20 }, days: 4, chance: 0.45, desc: 'Border villages defect to you (up to 3 tiles touching your land).' },
};
function spySlots() { return 2 + fx('spySlots'); }
function sendSpy(fid, kind) {
  if (!hasTech('espionage')) return toast('Research Espionage first.');
  const f = fac(fid), m = SPY_MISSIONS[kind];
  if (!G.spies) G.spies = [];
  if (G.spies.length >= spySlots()) return toast(`All ${spySlots()} of your spies are already in the field.`);
  if (!canAfford(m.cost)) return toast(`Costs ${costStr(m.cost)}`);
  pay(m.cost);
  G.spies.push({ fid, kind, day: G.time.day + m.days });
  addLog(`🕵️ A spy slips across the border into ${f.name} (${m.name}, ${m.days} days).`, 'info');
  return true;
}
function dailySpies() {
  if (!G.spies) G.spies = [];
  const done = G.spies.filter(s => G.time.day >= s.day);
  G.spies = G.spies.filter(s => G.time.day < s.day);
  for (const s of done) {
    const f = fac(s.fid), m = SPY_MISSIONS[s.kind]; if (!f || f.dead) continue;
    const intel = (f.intel || 0) > G.time.day ? 0.15 : 0;
    if (Math.random() > m.chance + intel + fx('spy')) {
      f.relation -= s.kind === 'scout' ? 6 : 18;
      addLog(`🕵️ Your spy was caught in ${f.name}! (${m.name} failed, relation ${s.kind === 'scout' ? '−6' : '−18'})`, 'bad');
      toast(`🕵️ Spy caught by ${f.name}!`);
      if (!f.war && f.relation < -45 && ['aggressive', 'proud'].includes(f.personality) && Math.random() < 0.25) aiDeclareWar(f);
      continue;
    }
    if (s.kind === 'scout') { f.intel = G.time.day + 30; addLog(`🔍 Spy report from ${f.name}: ${Math.round(f.troops)} troops, quality ×${f.quality.toFixed(2)}${f.war ? `, next army in ~${Math.max(0, f.armyTimer)} days` : ''}.`, 'good'); }
    else if (s.kind === 'steal') { const g = Math.round(Math.min(f.stock.gold * 0.3, 40 + G.time.day / 2)); f.stock.gold -= g; gain('gold', g); addLog(`💰 Your spy made off with ${g} gold from ${f.name}.`, 'good'); }
    else if (s.kind === 'sabotage') { f.troops *= 0.7; if (f.war) f.armyTimer += 5; addLog(`🔥 Sabotage! ${f.name}'s armouries burned — their troops are down 30%.`, 'good'); }
    else if (s.kind === 'incite') {
      const bt = borderTilesWith(f.id, 0).filter(t => dist(t.x, t.y, f.cap.x, f.cap.y) > 2.5).slice(0, 3);
      for (const t of bt) G.tiles.owner[idx(t.x, t.y)] = 0;
      recountTiles(); R.territoryDirty = true;
      addLog(bt.length ? `🗣️ Unrest in ${f.name}: ${bt.length} border tiles defected to you!` : `🗣️ Your agitators stirred ${f.name}, but no border land was close enough to defect.`, bt.length ? 'good' : 'info');
    }
  }
  // rival spies sometimes get caught in your realm
  for (const f of G.factions) {
    if (f.dead || f.subjugated || f.pact === 'alliance') continue;
    if (Math.random() < (f.relation < 0 ? 0.012 : 0.004)) queueEvent('spyCaught', { fid: f.id });
  }
}

// ---------- Royal marriages ----------
function marriageCandidates() { return G.kin.filter(k => isAdult(k) && k.age < 45 && !k.partner && !k.soldier && !k.away); }
function marriageReady(f) { return !f.war && !f.minor && f.relation >= 10 && G.time.day - (f.lastWed || -99) >= 40; }
function marryOut(f) {
  if (!marriageReady(f)) return toast(`${f.name} is not ready for a marriage (relation 10+, no war, once per 40 days).`);
  const k = marriageCandidates().sort((a, b) => b.mood - a.mood)[0];
  if (!k) return toast('No unmarried adults to offer.');
  const m = hasTech('statecraft') ? 2 : 1;
  removeKin(k);
  f.relation += 25 * m; f.lastWed = G.time.day; f.bond = G.time.day + 60 * m; gain('influence', 10); gain('gold', 40);
  addLog(`💍 ${kinName(k)} married into the court of ${f.name}. Your houses are bound for ${60 * m} days (relation +${25 * m}, +40 gold dowry).`, 'good');
  toast(`💍 Royal wedding with ${f.name}!`);
  return true;
}
function marryIn(f) {
  if (!marriageReady(f)) return toast(`${f.name} is not ready for a marriage (relation 10+, no war, once per 40 days).`);
  const cost = { gold: 40 + Math.round(G.time.day / 4) };
  if (!canAfford(cost)) return toast(`The bride-price is ${costStr(cost)}`);
  if (freeHousing() < 1) return toast('You need a free bed for the noble spouse.');
  pay(cost);
  const m = hasTech('statecraft') ? 2 : 1;
  const spouse = makeKin({ surname: f.leader.split(' ').pop(), age: randi(20, 32), x: G.cap.x, y: G.cap.y });
  const mate = marriageCandidates().filter(k => k !== spouse).sort((a, b) => b.mood - a.mood)[0];
  if (mate) { spouse.partner = mate.id; mate.partner = spouse.id; addMod('Royal wedding', 18, 8, mate.id); addMod('Royal wedding', 18, 8, spouse.id); }
  f.relation += 15 * m; f.lastWed = G.time.day; f.bond = G.time.day + 40 * m;
  addMod('A royal wedding', 6, 4);
  addLog(`💍 ${kinName(spouse)} of ${f.name} came to wed${mate ? ` ${kinName(mate)}` : ''}. Relation +${15 * m}.`, 'good');
  toast(`💍 A noble of ${f.name} joins your realm!`);
  assignHousing(); autoAssignJobs();
  return true;
}
function bonded(f) { return (f.bond || 0) > G.time.day; }

// ---------- Allies at war ----------
function callToArms(f) {
  if (f.pact !== 'alliance') return toast('Only allies answer a call to arms.');
  const enemies = G.factions.filter(e => e.war && !e.dead);
  if (!enemies.length) return toast('You are not at war.');
  if (G.res.influence < 15) return toast('Needs 15 influence.');
  if (f.relation < 50) { f.relation -= 5; return toast(`${f.name} refuses — your friendship is not strong enough (needs 50).`); }
  G.res.influence -= 15;
  f.joinWar = enemies[0].id; f.relation -= 5;
  addLog(`📯 ${f.name} answers your call and marches against ${enemies[0].name}!`, 'good'); toast(`📯 ${f.name} joins the war!`);
  return true;
}
function dailyAllies() {
  for (const f of G.factions) {
    if (!f.joinWar) continue;
    const e = fac(f.joinWar);
    if (!e || !e.war || e.dead || f.pact !== 'alliance') { f.joinWar = null; continue; }
    e.troops = Math.max(0, e.troops - (0.6 + f.troops * 0.04)); e.weariness = (e.weariness || 0) + 1.5;
    if (Math.random() < 0.12) { const bt = borderTilesWith(e.id, f.id); if (bt.length) { const t = pick(bt); G.tiles.owner[idx(t.x, t.y)] = f.id; R.territoryDirty = true; recountTiles(); } addLog(`⚔️ Your ally ${f.name} raided ${e.name}'s lands.`, 'info'); }
  }
}
function allyDefense() { let d = 0; for (const f of G.factions) if (f.joinWar) d += Math.min(8, f.troops * 0.2); return d; }

function dailyRealm() { dailyCities(); dailySpies(); dailyAllies(); }
