// ===== The ages to come: climate change, world wars, the nuclear clock, and the art of the future =====

// ---------- Rivals keep advancing into the new ages ----------
AI_ERA_COST.push(760, 860, 960);
ERA_MIL.push(7, 8.8, 11);
Object.assign(GOV_ERA, { algocracy: 9, federation: 10 });
GOV_TASTE.mercantile.unshift('algocracy'); GOV_TASTE.proud.push('algocracy'); GOV_TASTE.peaceful.unshift('federation');
Object.assign(REALM_FORMS, { algocracy: ['{N} Nexus', 'Algorithm of {N}'], federation: ['United Worlds of {N}', '{N} Concord'] });
Object.assign(ROAD_BONUS, { 6: 0.45 }); Object.assign(ROAD_NAMES, { 6: 'maglev' });
ROAD_LOOK[6] = { edge: '#90a4ae', fill: '#e3edf2', w: 12 };
GOALS.push(
  { text: 'Advance to the Planetary Age', check: () => thLevel() >= 8, reward: { gold: 800 } },
  { text: 'Keep warming under +1.5°C while in the Planetary Age', check: () => thLevel() >= 8 && warming() < 1.5 && G.time.day > 30, reward: { influence: 300 } },
  { text: 'Build a Fusion Reactor', check: () => countB('fusionreactor') > 0, reward: { tools: 500 } },
  { text: 'Reach the Stellar Age', check: () => thLevel() >= 10, reward: { gold: 3000 } },
);

// ---------- Climate ----------
// Coal-burning industry (yours and your rivals') adds carbon; forests and carbon capture take it back.
// Warming follows the carbon in the air, slowly. Climate stations cool the planet directly.
const CO2_PER_DEGREE = 2000;
const EMIT = { coalmine: 0.5, factory: 0.6, powerplant: 1.2 };
function climate() { if (!G.climate) G.climate = { co2: 0, temp: 0, geo: 0, peak: 0, emit: 0, rivals: 0, absorb: 0, seaT: 0, winter: 0, flooded: 0, marks: {} }; return G.climate; }
function warming() { return G && G.climate ? G.climate.temp : 0; }
function staffed(b) { const d = B[b.type]; return b.paused || b.ruined || !b.workers.length ? 0 : Math.min(1, b.workers.length / Math.max(1, d.workers || 1)); }
function playerEmissions() {
  let e = 0;
  for (const b of Object.values(G.buildings)) { const k = EMIT[b.type]; if (k) e += k * b.level * staffed(b); }
  e *= (fx('green') ? 0.7 : 1) * Math.max(0, 1 - fx('emit'));
  if (G.smogShut > 0) e *= 0.2;
  return e;
}
const RIVAL_EMIT = [0, 0, 0, 0, 0, 0.5, 1, 1.25, 1, 0.5, 0.2];
function rivalEmissions() { let e = 0; for (const f of livingRealms()) e += (RIVAL_EMIT[f.era || 1] || 0) * (f.tiles / 35) * (f.accord ? 0.5 : 1); return e; }
function captureRate() { let c = 0; for (const b of Object.values(G.buildings)) if (b.type === 'carboncapture') c += 5 * b.level * staffed(b) * powerRatio(b) * (1 + fx('capture')); return c; }
function geoRate() { let g = 0; for (const b of Object.values(G.buildings)) if (b.type === 'climatestation') g += 0.004 * b.level * staffed(b) * powerRatio(b) * (1 + fx('geo')); return g; }
let _forestN = 0, _forestAt = -1;
function forestSink() { if (_forestAt !== G.time.day) { _forestAt = G.time.day; let n = 0; for (let i = 0; i < G.tiles.terrain.length; i++) if (G.tiles.terrain[i] === T.FOREST) n++; _forestN = n; } return 0.5 + _forestN * 0.0015; }
function climateFarmMult() {
  const c = G.climate; if (!c) return 1;
  let loss = clamp((c.temp - 0.8) * 0.12, 0, 0.5) * Math.max(0, 1 - fx('climateFarm')) * (countB('seedvault') ? 0.7 : 1);
  let m = 1 - loss; if (c.winter > 0) m *= 0.6;
  return m;
}
function dailyClimate() {
  const c = climate();
  const pe = playerEmissions(), re = rivalEmissions(), cap = captureRate(), sink = forestSink();
  c.emit = pe; c.rivals = re; c.absorb = cap + sink;
  c.co2 = Math.max(0, c.co2 + pe + re - cap - sink);
  c.geo = c.geo * 0.99 + geoRate();
  const target = c.co2 / CO2_PER_DEGREE - c.geo - (c.winter > 0 ? 1.5 : 0);
  c.temp += (target - c.temp) * 0.03;
  if (c.winter > 0) c.winter--;
  c.peak = Math.max(c.peak, c.temp);
  for (const [k, t] of [['warn', 0.5], ['seas', 1.5], ['tip', 2.5]]) if (!c.marks[k] && c.temp >= t) { c.marks[k] = true; queueEvent('climate_' + k, {}); }
  if (c.temp >= 1.5) addMod('Climate anxiety', -Math.min(6, Math.round((c.temp - 1.2) * 2)), 1);
  seaRise(c);
  if (G.accord) {
    if (pe > G.accord.cap) { G.accord.breach = (G.accord.breach || 0) + 1; for (const f of livingRealms()) if (f.accord) f.relation -= 0.4; if (G.accord.breach % 10 === 1) addLog(`🌍 Accord members are angry: you emit ${pe.toFixed(1)} a day, over the ${G.accord.cap} you promised. Burn less coal or build carbon capture.`, 'bad'); }
    else G.accord.breach = 0;
  }
  if (!G.victory.gaia && c.peak >= 2 && c.temp < 0.5) { G.victory.gaia = true; queueEvent('victoryGaia', {}); history(`${G.realm.name} led the world back from the brink of climate collapse.`, '🌏'); }
}
// rising seas swallow low coasts next to the ocean, a tile at a time
function seawallCovers(x, y) { for (const b of Object.values(G.buildings)) if (b.type === 'seawall' && dist(b.x, b.y, x, y) <= 4) return true; return false; }
function seaRise(c) {
  if (c.temp < 1.5) return;
  c.seaT = (c.seaT || 0) + (c.temp - 1.3) * 0.12;
  while (c.seaT >= 1) { c.seaT -= 1; floodOneCoast(); }
}
function floodOneCoast() {
  const cands = [];
  for (let i = 0; i < G.tiles.terrain.length; i++) {
    const t = G.tiles.terrain[i]; if (t !== T.SAND && t !== T.GRASS && t !== T.MEADOW && t !== T.FOREST) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (!N4.some(([dx, dy]) => inB(x + dx, y + dy) && G.tiles.terrain[idx(x + dx, y + dy)] === T.DEEP)) continue;
    const dv = G.tiles.deco[i]; if (dv === 3 || dv === 4 || dv === 5) continue;
    const id = G.tiles.bld[i]; if (id && G.buildings[id] && ['townhall', 'cityhall'].includes(G.buildings[id].type)) continue;
    if (G.tiles.owner[i] === 0 && seawallCovers(x, y)) continue;
    cands.push(i);
  }
  if (!cands.length) return;
  const sand = cands.filter(i => G.tiles.terrain[i] === T.SAND);
  const i = sand.length && Math.random() < 0.7 ? pick(sand) : pick(cands), x = i % MAP_W, y = (i / MAP_W) | 0;
  const id = G.tiles.bld[i], b = id && G.buildings[id];
  if (b) { addLog(`🌊 The rising sea swallowed your ${B[b.type].name}. Sea Walls protect the coast.`, 'bad'); demolish(b, true); }
  G.tiles.terrain[i] = T.WATER; G.tiles.deco[i] = 0; G.tiles.road[i] = 0; if (G.tiles.wire) G.tiles.wire[i] = 0;
  climate().flooded++; R.terrainDirty = true; pathsDirty(); _landTiles = 0;
  if (G.tiles.owner[i] === 0) floatText(x, y, '🌊 Lost to the sea', '#4fc3f7');
}
// the World Climate Accord
function accordCost() { return { influence: 150, gold: 600 }; }
function proposeAccord() {
  if (!hasTech('climateaccord')) return toast('Research Climate Diplomacy first');
  if (G.accord) return toast('The Accord already stands');
  const c = accordCost(); if (!canAfford(c)) return toast(`Hosting the summit costs ${costStr(c)}`);
  pay(c);
  const joined = [];
  for (const f of livingRealms()) {
    if (f.minor) continue;
    let p = f.relation > 20 ? 0.9 : f.relation > -20 ? 0.6 : 0.25; if (f.personality === 'aggressive') p *= 0.6; if (f.gov === 'federation') p = 1;
    if (Math.random() < p) { f.accord = true; f.relation += 6; joined.push(f.name); }
  }
  G.accord = { day: G.time.day, cap: Math.max(6, Math.round(playerEmissions() * 0.6)) };
  addLog(`🌍 The World Climate Accord is signed${joined.length ? ` by ${joined.join(', ')}` : ''}. Members halve their emissions; you promised to keep yours under ${G.accord.cap} a day.`, 'good');
  history(`${G.realm.name} brought the world together in a Climate Accord.`, '🌍');
  addMod('We are saving the world', 4, 10);
  return true;
}

// ---------- The nuclear clock ----------
function falloutArr() { const N = MAP_W * MAP_H; if (!G.tiles.fallout || G.tiles.fallout.length !== N) G.tiles.fallout = new Uint8Array(N); return G.tiles.fallout; }
function addFallout(x, y, r, s) { const F = falloutArr(); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (!inB(x + dx, y + dy) || Math.hypot(dx, dy) > r + 0.3) continue; const i = idx(x + dx, y + dy); F[i] = Math.max(F[i], Math.round(s * (1 - Math.hypot(dx, dy) / (r + 1) * 0.5))); } }
function siloCap() { let n = 0; for (const b of Object.values(G.buildings)) if (b.type === 'silo' && !b.ruined) n += b.level; return n; }
function nukesReady() { return Math.max(0, siloCap() - (G.nukeSpent || 0)); }
function worldWarheads() { let n = siloCap(); for (const f of livingRealms()) n += f.nukes || 0; return n; }
function nukeShield(x, y) {
  for (const b of Object.values(G.buildings)) if (b.type === 'shielddome' && !b.ruined && powerRatio(b) > 0.5 && dist(b.x, b.y, x, y) <= 14) return 1;
  return Math.min(1, fx('nukeShield'));
}
function minutesToMidnight() { return Math.max(0, (100 - (G.doom || 0)) / 100 * 15); }
function midnightStr() { const m = minutesToMidnight(); return m < 2 ? `${Math.round(m * 60)} s` : `${m.toFixed(m < 5 ? 1 : 0)} min`; }
function dailyDoom() {
  // rivals in later ages build bombs
  for (const f of livingRealms()) {
    if (f.minor || (f.era || 1) < 7 || f.subjugated) continue;
    const cap = ((f.era || 1) - 6) * 2, p = 0.008 * (f.personality === 'aggressive' || f.gov === 'autocracy' ? 2 : 1) * (G.treaty > G.time.day ? 0.2 : 1);
    if ((f.nukes || 0) < cap && Math.random() < p) { f.nukes = (f.nukes || 0) + 1; G.doom = (G.doom || 0) + 4; addLog(`☢️ ${f.name} has tested a nuclear weapon (${f.nukes} warhead${f.nukes > 1 ? 's' : ''}).`, 'bad'); if (f.nukes === 1) history(`${f.name} became a nuclear power.`, '☢️'); }
  }
  const W = worldWarheads();
  let d = 0.03 * W + (G.ww ? 0.35 : 0) - 0.2;
  for (const f of livingRealms()) if (f.nukes && (f.war || f.aiWar)) d += 0.15;
  if (nukesReady() && anyWar()) d += 0.15;
  if (G.treaty > G.time.day) d -= 0.3;
  if (fx('diplo')) d -= 0.2;
  G.doom = clamp((G.doom || 0) + (W || G.ww ? d : -0.3), 0, 100);
  if (G.nukeSpent > 0 && G.time.day % 30 === 0) G.nukeSpent--;
  if (G.doom >= 100) return nuclearExchange();
  if (W && G.doom > 35 && Math.random() < 0.012 + G.doom / 2500) queueEvent('nukeCrisis', {});
  if (W >= 3 && G.doom > 55 && G.time.day > (G.treatyOffer || 0) && Math.random() < 0.02) { G.treatyOffer = G.time.day + 60; queueEvent('armsTreaty', {}); }
  // a rival losing a war against you may reach for the bomb
  for (const f of livingRealms()) if (f.war && f.nukes > 0 && G.doom > 80 && (f.weariness > 40 || (f.warScore || 0) < -4) && Math.random() < 0.02) { queueEvent('nukeIncoming', { fid: f.id }); break; }
  // falling fallout
  if (G.time.day % 2 === 0 && G.tiles.fallout) { const F = G.tiles.fallout; for (let i = 0; i < F.length; i++) if (F[i]) F[i]--; }
  if (G.tiles.fallout) for (const k of G.kin) { const h = homeOf(k); if (h && G.tiles.fallout[idx(h.x, h.y)]) k.health = Math.max(5, k.health - 3); }
}
// a strike on a rival's capital
function strikeRival(f) {
  const x = f.cap.x, y = f.cap.y;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (!inB(x + dx, y + dy) || Math.hypot(dx, dy) > 2.3) continue; const i = idx(x + dx, y + dy); if (G.tiles.owner[i] === f.id && !(dx === 0 && dy === 0)) G.tiles.deco[i] = 0; }
  addFallout(x, y, 3, 220);
  f.troops *= 0.4; for (const r in f.stock || {}) f.stock[r] *= 0.5;
  floatText(x, y, '☢️', '#ffeb3b');
}
// a strike on you
function strikePlayer(x, y, from) {
  const sh = nukeShield(x, y);
  if (Math.random() < sh) { addLog(`🛡️ A missile from ${from.name} was shot down before it reached ${G.realm.name}.`, 'good'); floatText(x, y, 'Intercepted!', '#4dd0e1'); return false; }
  const dead = []; let lost = 0;
  for (const b of Object.values(G.buildings)) {
    const d = dist(b.x, b.y, x, y); if (d > 3) continue;
    if (d <= 1.5 && !['townhall', 'cityhall'].includes(b.type)) { demolish(b, true); lost++; } else b.ruined = Math.max(b.ruined || 0, 20);
  }
  const cap = Math.ceil(G.kin.length * 0.2);
  for (const k of G.kin.slice()) { if (dead.length >= cap) break; const h = homeOf(k); if ((h && dist(h.x, h.y, x, y) <= 2) || dist(k.x, k.y, x, y) <= 2) dead.push(k); }
  for (const k of dead) killKin(k, `the bomb that fell on ${G.realm.name}`);
  addFallout(x, y, 3, 220); cityLosses(x, y, 0.7);
  addMod('The bomb fell on us', -15, 15);
  addLog(`☢️ A nuclear missile from ${from.name} struck ${G.realm.name}: ${lost} buildings destroyed, ${dead.length} kin killed. The land around it is poisoned for a year.`, 'bad');
  history(`${from.name} dropped a nuclear bomb on ${G.realm.name}.`, '☢️');
  floatText(x, y, '☢️ Nuclear strike', '#ffeb3b'); R.terrainDirty = true;
  return true;
}
function playerTargets() { const t = [{ x: G.cap.x, y: G.cap.y }]; for (const c of cities()) { const b = G.buildings[c.bid]; if (b) t.push({ x: b.x, y: b.y }); } return t; }
function launchNuke(f) {
  if (!f || f.dead || !f.war) return toast('You can only strike a realm you are at war with');
  if (!nukesReady()) return toast('No warhead is ready');
  G.nukeSpent = (G.nukeSpent || 0) + 1;
  strikeRival(f);
  f.relation = -100; f.weariness = (f.weariness || 0) + 70; f.warScore = (f.warScore || 0) - 10;
  for (const o of livingRealms()) if (o !== f) o.relation -= 35;
  G.doom = Math.min(99, (G.doom || 0) + 30);
  addMod('We used the bomb', -12, 25);
  addLog(`☢️ ${G.realm.name} launched a nuclear strike on the capital of ${f.name}. Their army is shattered — and the whole world is horrified.`, 'bad');
  history(`${G.realm.name} dropped a nuclear bomb on ${f.name}.`, '☢️');
  if (f.nukes > 0) { f.nukes--; const t = pick(playerTargets()); strikePlayer(t.x, t.y, f); }
  return true;
}
function nuclearExchange() {
  G.doom = 60;
  const pairs = [];
  for (const f of livingRealms()) {
    if (!f.nukes) continue;
    if (f.war) pairs.push([f, null]);
    const e = f.aiWar && fac(f.aiWar); if (e && !e.dead) pairs.push([f, e]);
    if (G.ww && f.ww) for (const o of livingRealms()) if (o.ww && o.ww !== f.ww && borderTilesWith(f.id, o.id).length) { pairs.push([f, o]); break; }
  }
  if (!pairs.length) { addLog('☢️ Early-warning radars showed missiles in flight — a false alarm, caught with seconds to spare. The world steps back from the edge.', 'bad'); G.doom = 70; return; }
  const hit = new Set();
  for (const [a, b] of pairs.slice(0, 4)) {
    if (!a.nukes) continue; a.nukes--;
    if (b) { if (!hit.has(b.id)) { strikeRival(b); hit.add(b.id); addLog(`☢️ ${a.name} launched a nuclear strike on ${b.name}!`, 'bad'); } }
    else { const t = pick(playerTargets()); strikePlayer(t.x, t.y, a); }
  }
  climate().winter = 45;
  addMod('Nuclear winter', -8, 30);
  addLog('🌫️ Ash blots out the sun: a nuclear winter. Crops fail and the world grows cold for weeks.', 'bad');
  history('Nuclear war broke out. The skies went dark.', '☢️');
  toast('☢️ Nuclear war!');
}

// ---------- World wars ----------
function majorRealms() { return livingRealms().filter(f => !f.minor && !f.subjugated && !f.rebel); }
function blocName(lead, k) { return `${realmPlace(lead)} ${k === 'a' ? 'Pact' : 'Coalition'}`; }
function blocMembers(k) { return majorRealms().filter(f => f.ww === k); }
function maybeWorldWar() {
  if (G.ww || topEra() < 6 || G.time.day < (G.wwCd || 60)) return;
  const ms = majorRealms(); if (ms.length < 4) return;
  const wars = livingRealms().filter(f => f.aiWar).length / 2;
  if (Math.random() < 0.003 + wars * 0.003 + (G.doom || 0) / 25000) startWorldWar();
}
function startWorldWar() {
  const ms = majorRealms().sort((a, b) => facStrength(b) - facStrength(a)); if (ms.length < 4) return;
  const A = ms[0], Bq = ms[1];
  A.ww = 'a'; Bq.ww = 'b';
  for (const f of ms.slice(2)) {
    if (Math.random() < 0.2) continue; // neutral
    const lean = (f.gov === A.gov ? 3 : 0) - (f.gov === Bq.gov ? 3 : 0) + (f.aiWar === Bq.id ? 4 : 0) - (f.aiWar === A.id ? 4 : 0) + rand(-2, 2) + (dist(f.cap.x, f.cap.y, Bq.cap.x, Bq.cap.y) - dist(f.cap.x, f.cap.y, A.cap.x, A.cap.y)) * 0.05;
    f.ww = lean >= 0 ? 'a' : 'b';
  }
  for (const f of ms) if (f.ww && f.aiWar) { const e = fac(f.aiWar); if (e && e.ww === f.ww) aiWarEnd(f, e, null); }
  G.ww = { a: A.id, b: Bq.id, names: { a: blocName(A, 'a'), b: blocName(Bq, 'b') }, start: G.time.day, len: randi(50, 90), side: null };
  history(`World war: ${G.ww.names.a} against ${G.ww.names.b}.`, '🌐');
  addLog(`🌐 <b>World war!</b> ${G.ww.names.a} (${blocMembers('a').map(f => f.name).join(', ')}) against ${G.ww.names.b} (${blocMembers('b').map(f => f.name).join(', ')}).`, 'bad');
  queueEvent('worldWar', {});
}
function wwEnterWar(f) {
  if (f.war) return;
  f.pact = null; f.war = true; f.warDays = 0; f.weariness = 0; f.armyTimer = randi(4, 8); f.peaceOffered = false; f.warScore = 0;
  f.relation = Math.min(f.relation, -50); G.flags.hadWar = true;
}
function wwJoin(k) {
  G.ww.side = k;
  for (const f of majorRealms()) { if (!f.ww) continue; if (f.ww === k) { f.relation += 25; f.wwAlly = true; } else wwEnterWar(f); }
  addMod('Rallying to the cause', 3, 6);
  addLog(`🌐 ${G.realm.name} joins ${G.ww.names[k]} and goes to war with ${blocMembers(k === 'a' ? 'b' : 'a').map(f => f.name).join(', ')}.`, 'info');
}
function wwSkirmish(a, b) {
  const sa = facStrength(a) * rand(0.6, 1.4), sb = facStrength(b) * rand(0.6, 1.4);
  const w = sa > sb ? a : b, l = w === a ? b : a;
  const bt = borderTilesWith(l.id, w.id).filter(t => !(t.x === l.cap.x && t.y === l.cap.y));
  for (let k = 0; k < Math.min(bt.length, randi(1, 2)); k++) { const t = bt.splice(randi(0, bt.length - 1), 1)[0]; G.tiles.owner[idx(t.x, t.y)] = w.id; }
  l.troops = Math.max(0, l.troops - 0.5); w.troops = Math.max(0, w.troops - 0.2);
  recountTiles(); R.territoryDirty = true;
  if (l.tiles <= 6 && !l.dead) aiTakeCapital(w, l);
}
function dailyWorldWar() {
  maybeWorldWar();
  const ww = G.ww; if (!ww) return;
  for (const k of ['a', 'b']) for (const f of blocMembers(k)) {
    const foes = blocMembers(k === 'a' ? 'b' : 'a').filter(o => borderTilesWith(f.id, o.id).length);
    if (foes.length && Math.random() < 0.6) wwSkirmish(f, pick(foes));
  }
  if (ww.side === 'a' || ww.side === 'b') {
    addMod('World at war', -2, 1);
    const foes = blocMembers(ww.side === 'a' ? 'b' : 'a').filter(f => f.war);
    for (const al of blocMembers(ww.side)) if (foes.length) { const e = pick(foes); e.troops = Math.max(0, e.troops - (0.5 + al.troops * 0.03)); e.weariness = (e.weariness || 0) + 1; }
  } else if (ww.side === 'trade') {
    _why = 'War profits'; gain('gold', 3 * curEra());
    if (Math.random() < 0.004) { const f = pick(majorRealms().filter(f => f.ww && !f.war)); if (f) { addLog(`🌐 ${f.name} accuses you of arming its enemies!`, 'bad'); aiDeclareWar(f); } }
  }
  const sa = blocMembers('a').reduce((s, f) => s + facStrength(f), 0), sb = blocMembers('b').reduce((s, f) => s + facStrength(f), 0);
  if (G.time.day - ww.start > ww.len || sa < sb * 0.35 || sb < sa * 0.35 || !blocMembers('a').length || !blocMembers('b').length) endWorldWar(sa >= sb ? 'a' : 'b');
}
function endWorldWar(win) {
  const ww = G.ww; if (!ww) return;
  const lose = win === 'a' ? 'b' : 'a', losers = blocMembers(lose).map(f => f.id);
  history(`The world war ended in victory for ${ww.names[win]}.`, '🕊️');
  addLog(`🕊️ The world war is over. ${ww.names[win]} has won.`, 'info');
  if (ww.side === 'a' || ww.side === 'b') queueEvent('wwPeace', { won: ww.side === win, losers, win, winners: blocMembers(win).map(f => f.id) });
  for (const f of G.factions) { f.ww = null; f.wwAlly = null; }
  for (const f of majorRealms()) if (f.war && (ww.side === 'a' || ww.side === 'b')) endWar(f, `The world war ends: peace with ${f.name}.`);
  G.ww = null; G.wwCd = G.time.day + randi(120, 200);
}
{ const _ad = allyDefense; allyDefense = function () { let d = _ad(); if (G.ww && (G.ww.side === 'a' || G.ww.side === 'b')) for (const f of blocMembers(G.ww.side)) d += Math.min(10, f.troops * 0.2); return d; }; }

// ---------- Events of the new ages ----------
const _wrapW = (k, fn) => { const ev = EVENTS[k]; if (!ev || typeof ev.weight !== 'function') return; const w0 = ev.weight; ev.weight = () => fn(w0()); };
_wrapW('drought', w => w * (1 + Math.max(0, warming()) * 0.6) * (1 - Math.min(0.8, fx('disaster'))));
_wrapW('hurricane', w => (w + (warming() >= 1 ? 0.15 : 0)) * (1 + Math.max(0, warming()) * 0.4) * (1 - Math.min(0.8, fx('disaster'))));
_wrapW('heatwave', w => (w + (warming() >= 1 ? 0.25 : 0)) * (1 + Math.max(0, warming()) * 0.5) * (1 - Math.min(0.8, fx('disaster'))));
_wrapW('flood', w => (w + (warming() >= 1 && Object.values(G.buildings).some(nearWater) ? 0.3 : 0)) * (1 + Math.max(0, warming()) * 0.4) * (1 - Math.min(0.8, fx('disaster') + fx('flood'))));
{ const _nw = nearWater; nearWater = b => _nw(b) && !(G.buildings && countB('seawall') && seawallCovers(b.x, b.y)); }
const climateText = () => { const c = climate(); return `Warming is now <b>+${c.temp.toFixed(1)}°C</b>. You emit ${c.emit.toFixed(1)} a day and your rivals ${c.rivals.toFixed(1)}; forests and carbon capture take back ${c.absorb.toFixed(1)}.`; };
Object.assign(EVENTS, {
  climate_warn: { make: () => { const c1 = { gold: 120 }, c2 = { wood: 80 }; return {
    title: '🌡️ The World Is Warming', icon: '🌡️', text: `Your scholars have measured it: the smoke of a hundred factories is trapping heat. ${climateText()} If it keeps rising, crops will wither, storms will grow and the seas will climb.`,
    choices: [
      { label: 'Fund climate research', tip: `${costStr(c1)}: +${60 * curEra()} knowledge.`, disabled: !canAfford(c1), fn: () => { pay(c1); gain('knowledge', 60 * curEra()); } },
      { label: 'Plant forests', tip: `${costStr(c2)}: up to 20 grass tiles on your land become forest (forests soak up carbon).`, disabled: !canAfford(c2), fn: () => { pay(c2); let n = 0; for (let i = 0; i < G.tiles.owner.length && n < 20; i++) if (G.tiles.owner[i] === 0 && G.tiles.terrain[i] === T.GRASS && !G.tiles.bld[i] && !G.tiles.road[i] && Math.random() < 0.3) { G.tiles.terrain[i] = T.FOREST; n++; } R.terrainDirty = true; addLog(`🌳 ${n} tiles of new forest were planted.`, 'good'); } },
      { label: 'Industry comes first', tip: 'Nothing changes. +3 mood among your workers for now.', fn: () => addMod('Jobs, jobs, jobs', 3, 4) },
    ] }; } },
  climate_seas: { make: () => { const c = { stone: 200, tools: 40 }; return {
    title: '🌊 The Seas Are Rising', icon: '🌊', text: `The ice is melting. Low coasts beside the ocean will slowly vanish under the water — and anything built on them. ${climateText()}`,
    choices: [
      { label: 'Emergency coastal defenses', tip: `${costStr(c)}: no coastal tile of yours floods for 40 days.${hasTech('seawalls') ? '' : ' (Coastal Engineering unlocks permanent Sea Walls.)'}`, disabled: !canAfford(c), fn: () => { pay(c); climate().seaT = -0.12 * 40 * Math.max(0.5, warming() - 1.3); } },
      { label: 'Managed retreat', tip: 'Accept the loss. +20 influence for honesty.', fn: () => gain('influence', 20) },
      { label: 'Deny it', tip: '+4 mood for now.', fn: () => addMod('Nothing to worry about', 4, 5) },
    ] }; } },
  climate_tip: { make: () => ({
    title: '🔥 Climate Tipping Point', icon: '🔥', text: `Forests burn, crops fail and storms grow monstrous. ${climateText()} Every degree now costs your farms dearly.`,
    choices: [
      { label: 'Declare a climate emergency', tip: 'Every factory, coal mine and coal power plant stops for 5 days. −5 mood, but the world notices (+25 relations with everyone).', fn: () => { G.smogShut = 5; addMod('Climate emergency', -5, 5); for (const f of livingRealms()) f.relation += 25; } },
      { label: 'Ration food', tip: 'Meager rations for now.', fn: () => { G.policies.rations = 'meager'; } },
      { label: 'Adapt and endure', fn: () => { } },
    ] }) },
  refugees: {
    random: true, weight: () => warming() >= 2 ? 0.25 + (warming() - 2) * 0.2 : 0,
    make: () => { const n = randi(6, 14) + Math.round(warming() * 4); return {
      title: '🧳 Climate Refugees', icon: '🧳', text: `${n} families have fled drowned coasts and burnt fields. They ask to settle in ${G.realm.name}.`,
      choices: [
        { label: 'Welcome them all', tip: 'Those you can house become kin; the rest become subjects (they eat, but they pay taxes). +20 relations with everyone.', fn: () => { let k = 0; while (k < n * 2 && freeHousing() > 1) { makeKin({ age: randi(16, 50) }); k++; } spreadSubjects(n * 3 - k); for (const f of livingRealms()) f.relation += 20; assignHousing(); autoAssignJobs(); addLog(`🧳 ${k} refugees moved into town and ${Math.max(0, n * 3 - k)} more settled in the countryside.`, 'good'); } },
        { label: 'Take only the skilled', tip: 'Up to 4 new kin.', fn: () => { for (let k = 0; k < 4 && freeHousing() > 0; k++) makeKin({ age: randi(20, 40) }); assignHousing(); autoAssignJobs(); } },
        { label: 'Close the border', tip: '−10 relations with everyone. −3 mood.', fn: () => { for (const f of livingRealms()) f.relation -= 10; addMod('We turned them away', -3, 6); } },
      ] }; },
  },
  meltdown: {
    random: true, weight: () => countB('nuclearplant') * 0.12 * (hasTech('longevity') ? 0.6 : 1),
    make: () => { const b = pick(Object.values(G.buildings).filter(o => o.type === 'nuclearplant')); if (!b) return null; const c1 = { gold: 300 + 50 * curEra() }, c2 = { stone: 400, tools: 150 }; return {
      title: '☢️ Reactor Emergency!', icon: '☢️', tiles: [{ x: b.x, y: b.y }], text: 'Alarms are screaming at the nuclear plant. The core is overheating and the cooling pumps have failed.',
      choices: [
        { label: 'Evacuate and vent', tip: `${costStr(c1)}: the plant is out for 15 days and a little fallout settles right around it.`, disabled: !canAfford(c1), fn: () => { pay(c1); b.ruined = 15; addFallout(b.x, b.y, 1, 120); } },
        { label: 'Entomb the reactor', tip: `${costStr(c2)}: the plant is lost, but nothing escapes.`, disabled: !canAfford(c2), fn: () => { pay(c2); demolish(b, true); addLog('☢️ The reactor was sealed under concrete forever.', 'info'); } },
        { label: 'Downplay it', tip: 'Half the time it settles down. Otherwise: a meltdown — fallout for 3 tiles, sick kin, −8 mood.', fn: () => { if (Math.random() < 0.5) { b.ruined = 5; addLog('☢️ The engineers got lucky — the core cooled.', 'good'); } else { b.ruined = 40; addFallout(b.x, b.y, 3, 200); infect(Math.max(2, Math.round(G.kin.length * 0.1)), 6); addMod('Meltdown', -8, 12); addLog('☢️ Meltdown! Radioactive fallout spreads around the plant.', 'bad'); history(`A nuclear meltdown poisoned the land of ${G.realm.name}.`, '☢️'); R.terrainDirty = true; } } },
      ] }; },
  },
  geoside: {
    random: true, weight: () => countB('climatestation') * 0.1,
    make: () => ({
      title: '🌦️ The Sky Answers Back', icon: '🌦️', text: 'Your climate engineers dimmed the sun a little too well: the monsoon has stalled and the rains are failing.',
      choices: [
        { label: 'Ease off', tip: 'Climate stations pause for 5 days.', fn: () => { for (const b of Object.values(G.buildings)) if (b.type === 'climatestation') b.ruined = Math.max(b.ruined || 0, 5); } },
        { label: 'Keep going', tip: 'A 6-day drought.', fn: () => { G.drought = Math.max(G.drought || 0, 6); } },
      ] }),
  },
  nukeCrisis: {
    make: () => { const ps = livingRealms().filter(f => f.nukes > 0 && !f.minor); const f = pick(ps); if (!f) return null; const tgt = f.war ? 'you' : (f.aiWar && fac(f.aiWar) ? fac(f.aiWar).name : 'its neighbours'); return {
      title: '☢️ Nuclear Standoff', icon: '☢️', text: `${f.name} has put its missiles on high alert and is threatening ${tgt}. The doomsday clock stands at <b>${midnightStr()} to midnight</b>.`,
      choices: [
        { label: 'Open a hotline', tip: '60 influence: the clock moves back 20 points.', disabled: G.res.influence < 60, fn: () => { G.res.influence -= 60; G.doom = Math.max(0, G.doom - 20); f.relation += 10; } },
        { label: 'Stand firm', tip: `${nukesReady() ? 'Your own arsenal backs you: ' : ''}60% they back down (+40 influence, clock −10); otherwise the clock jumps 15 points.`, fn: () => { if (Math.random() < (nukesReady() ? 0.75 : 0.6)) { gain('influence', 40); G.doom = Math.max(0, G.doom - 10); addLog(`☢️ ${f.name} blinked first and stood down.`, 'good'); } else { G.doom += 15; addLog(`☢️ ${f.name} refuses to back down. The world holds its breath.`, 'bad'); } } },
        { label: 'Stay out of it', tip: 'The clock moves 5 points closer.', fn: () => { G.doom += 5; } },
      ] }; },
  },
  armsTreaty: {
    make: () => ({
      title: '🕊️ Arms Reduction Treaty', icon: '🕊️', text: `Diplomats propose that every nuclear power destroys half its warheads. The world holds ${worldWarheads()} warheads; the clock stands at ${midnightStr()} to midnight.`,
      choices: [
        { label: 'Sign the treaty', tip: `Everyone, you included, scraps half their warheads. Clock −30, no new bombs for 120 days, +15 relations with everyone.`, fn: () => { for (const f of livingRealms()) f.nukes = Math.floor((f.nukes || 0) / 2); G.nukeSpent = (G.nukeSpent || 0) + Math.ceil(nukesReady() / 2); G.doom = Math.max(0, G.doom - 30); G.treaty = G.time.day + 120; for (const f of livingRealms()) f.relation += 15; history('The great powers signed an arms reduction treaty.', '🕊️'); } },
        { label: 'Refuse', tip: 'Keep your arsenal. Clock +5, −10 relations with everyone.', fn: () => { G.doom += 5; for (const f of livingRealms()) f.relation -= 10; } },
      ] }),
  },
  nukeConfirm: {
    make: d => { const f = fac(d.fid); if (!f || f.dead || !f.war) return null; return {
      title: '☢️ Launch Authorization', icon: '☢️', tiles: [{ x: f.cap.x, y: f.cap.y }], text: `The launch codes are ready. A warhead will strike the capital of <b>${f.name}</b>: their army is shattered, their capital poisoned for a year and half their stores burned.<br><br>Every realm will turn against you, your own people will be horrified (−12 mood for 25 days) and the doomsday clock jumps 30 points.${f.nukes ? ` <b>${f.name} has ${f.nukes} warhead${f.nukes > 1 ? 's' : ''} of its own and will strike back</b>${fx('nukeShield') ? ` (your defenses stop ${Math.round(Math.min(1, fx('nukeShield')) * 100)}% of missiles)` : ''}.` : ''}`,
      choices: [
        { label: 'Launch', fn: () => launchNuke(f) },
        { label: 'Stand down', fn: () => { } },
      ] }; },
  },
  nukeIncoming: {
    make: d => { const f = fac(d.fid); if (!f || f.dead || !f.nukes) return null; const t = pick(playerTargets()); return {
      title: '🚨 Missiles Inbound!', icon: '🚨', tiles: [t], text: `Radar has picked up a nuclear missile launched by ${f.name}, minutes from impact.${nukeShield(t.x, t.y) ? ` Your defenses should stop it ${Math.round(nukeShield(t.x, t.y) * 100)}% of the time.` : ''}`,
      choices: [
        { label: 'Launch on warning', tip: nukesReady() ? 'Strike their capital before the missile lands.' : 'No warhead ready.', disabled: !nukesReady(), fn: () => { f.nukes--; strikePlayer(t.x, t.y, f); launchNuke(f); } },
        { label: 'Take shelter', tip: 'Brace for impact. The world sides with you (+20 relations with everyone except them).', fn: () => { f.nukes--; G.doom = Math.min(99, G.doom + 10); strikePlayer(t.x, t.y, f); for (const o of livingRealms()) if (o !== f) o.relation += 20; } },
      ] }; },
  },
  worldWar: {
    make: () => { const ww = G.ww; if (!ww) return null; const sa = blocMembers('a').reduce((s, f) => s + facStrength(f), 0), sb = blocMembers('b').reduce((s, f) => s + facStrength(f), 0); const mine = fieldForce().P; return {
      title: '🌐 World War!', icon: '🌐', text: `The great powers have gone to war.<br><b>${ww.names.a}</b>: ${blocMembers('a').map(f => f.name).join(', ')} — strength ${sa.toFixed(0)}<br><b>${ww.names.b}</b>: ${blocMembers('b').map(f => f.name).join(', ')} — strength ${sb.toFixed(0)}<br>Your field army: ${mine.toFixed(0)}. Both sides want you.`,
      choices: [
        { label: `Join ${ww.names.a}`, tip: `War with ${blocMembers('b').map(f => f.name).join(', ')}. Your allies fight beside you; the winners carve up the losers.`, fn: () => wwJoin('a') },
        { label: `Join ${ww.names.b}`, tip: `War with ${blocMembers('a').map(f => f.name).join(', ')}.`, fn: () => wwJoin('b') },
        { label: 'Stay neutral and sell arms', tip: `+${3 * curEra()} gold a day while it lasts, but either side may turn on you.`, fn: () => { ww.side = 'trade'; } },
        { label: 'Broker peace', tip: '200 influence: 35% the war ends at once (+15 relations with everyone); otherwise you stay neutral.', disabled: G.res.influence < 200, fn: () => { G.res.influence -= 200; if (Math.random() < 0.35) { for (const f of livingRealms()) f.relation += 15; history(`${G.realm.name} brokered peace and ended a world war.`, '🕊️'); const w = sa >= sb ? 'a' : 'b'; ww.side = null; endWorldWar(w); addLog('🕊️ Your diplomats brought both sides to the table. The world war is over!', 'good'); } else ww.side = 'neutral'; } },
      ] }; },
  },
  wwPeace: {
    make: d => { const losers = d.losers.map(fac).filter(f => f && !f.dead); const e = curEra(); return d.won ? {
      title: '🕊️ Victory in the World War', icon: '🕊️', text: `Your side has won. At the peace conference, ${G.realm.name} may name its price from ${losers.map(f => f.name).join(', ') || 'the defeated'}.`,
      choices: [
        { label: 'Reparations', tip: `${250 * e} gold, 120 influence, and 30% of the losers' stores.`, fn: () => { gain('gold', 250 * e); gain('influence', 120); for (const f of losers) takeStores(f, 0.3); } },
        { label: 'Redraw the borders', tip: 'Every tile of theirs within 4 of your land becomes yours, with the buildings on it.', disabled: !losers.length, fn: () => { let n = 0; for (const f of losers) { const took = []; for (let i = 0; i < G.tiles.owner.length; i++) { if (G.tiles.owner[i] !== f.id) continue; const x = i % MAP_W, y = (i / MAP_W) | 0; if (x === f.cap.x && y === f.cap.y) continue; let near = false; for (let dy = -4; dy <= 4 && !near; dy++) for (let dx = -4; dx <= 4; dx++) if (ownerAt(x + dx, y + dy) === 0) { near = true; break; } if (near) took.push(i); } for (const i of took) G.tiles.owner[i] = 0; n += took.length; takeDistrict(f, took); } recountTiles(); R.territoryDirty = true; addLog(`🗺️ The peace treaty hands ${G.realm.name} ${n} tiles.`, 'good'); } },
        { label: 'Make the strongest a vassal', tip: losers.length ? `${losers.sort((a, b) => facStrength(b) - facStrength(a))[0].name} becomes your vassal.` : 'Nobody left.', disabled: !losers.length, fn: () => makeVassal(losers.sort((a, b) => facStrength(b) - facStrength(a))[0]) },
      ] } : {
      title: '🏳️ Defeat in the World War', icon: '🏳️', text: 'Your side has lost. The victors set the terms.',
      choices: [
        { label: 'Pay reparations', tip: 'Lose 30% of your gold and 20% of your stores.', fn: () => { G.res.gold *= 0.7; for (const r of CAPPED) G.res[r] *= 0.8; } },
        { label: 'Cede border land', tip: 'Up to 25 empty tiles on your borders with the victors go to them.', fn: () => { let n = 0; for (let i = 0; i < G.tiles.owner.length && n < 25; i++) { if (G.tiles.owner[i] !== 0 || G.tiles.bld[i]) continue; const x = i % MAP_W, y = (i / MAP_W) | 0; const o = N4.map(([dx, dy]) => ownerAt(x + dx, y + dy)).find(o => (d.winners || []).includes(o) && fac(o) && !fac(o).dead); if (o && dist(x, y, G.cap.x, G.cap.y) > 6) { G.tiles.owner[i] = o; n++; } } recountTiles(); R.territoryDirty = true; addLog(`🏳️ ${n} border tiles were handed to the victors.`, 'bad'); } },
      ] }; },
  },
  victoryStellar: { make: () => ({ title: '🛰️ Stellar Victory!', icon: '🛰️', text: `The Space Elevator rises from ${G.realm.name} into orbit. Cargo and colonists climb toward the stars every day.<br><br><b>You have achieved a Stellar Victory!</b> You may keep playing.`, choices: [{ label: 'Onward', fn: () => { } }] }) },
  victoryGaia: { make: () => ({ title: '🌏 Gaia Victory!', icon: '🌏', text: `Warming once passed +${climate().peak.toFixed(1)}°C. Now it is back under +0.5°C — the forests are returning and the seas have stopped rising.<br><br><b>You have achieved a Gaia Victory!</b> You may keep playing.`, choices: [{ label: 'For the planet', fn: () => { } }] }) },
});
for (const k of ['climate_warn', 'climate_seas', 'climate_tip', 'meltdown', 'nukeCrisis', 'armsTreaty', 'nukeConfirm', 'nukeIncoming', 'worldWar', 'wwPeace', 'victoryStellar', 'victoryGaia', 'refugees']) EVENT_MAJOR.add(k);
Object.assign(EVENT_AUTO, { geoside: [0, 1], refugees: [0, 1, 2], meltdown: [0, 1, 2] });

// ---------- Hooks ----------
{ const _da = dailyAges; dailyAges = function () { _da(); why('Climate & world', () => { dailyClimate(); dailyDoom(); dailyWorldWar(); if (fx('diplo')) for (const f of livingRealms()) if (!f.war) f.relation = Math.min(100, f.relation + 0.3); }); }; }
{ const _bm = buildingMult; buildingMult = function (b) {
  let m = _bm(b); const d = B[b.type];
  if (d.prod && d.prod.food && b.type !== 'hydrofarm') m *= climateFarmMult();
  if (G.tiles.fallout && G.tiles.fallout[idx(b.x, b.y)]) m *= 0.15;
  return m;
}; }
{ const _si = siteInfo; siteInfo = function (type, x, y, opt) { if (inB(x, y) && G.tiles.fallout && G.tiles.fallout[idx(x, y)] && !(opt && opt.quick)) return { ok: false, reason: '☢️ Radioactive fallout' }; return _si(type, x, y, opt); }; }
{ const _pb = placeBuilding; placeBuilding = function (type, x, y, free) { const r = _pb(type, x, y, free); if (r.ok && type === 'spaceelevator' && !free && !G.victory.stellar) { G.victory.stellar = true; queueEvent('victoryStellar', {}); history(`${G.realm.name} raised a Space Elevator to the stars.`, '🛰️'); } return r; }; }
{ const _aw = aiDeclareWar; aiDeclareWar = function (f) {
  if (!f.war && !f.rebel && nukesReady() > (f.nukes || 0) && Math.random() < 0.6) { if (G.time.day > (G.deterLog || 0)) { G.deterLog = G.time.day + 15; addLog(`☢️ ${f.name} was ready to march on you — but your warheads made them think again.`, 'info'); } return; }
  return _aw(f);
}; }
{ const _da = defenseAt; defenseAt = function (x, y) { let d = _da(x, y); for (const b of Object.values(G.buildings)) if (b.type === 'shielddome' && powerRatio(b) > 0.5 && dist(b.x, b.y, x, y) <= 14) { d *= 2; break; } return d; }; }
{ const _ng = newGame; newGame = function (o) { const r = _ng(o); G.climate = null; climate(); G.doom = 0; falloutArr(); return r; }; }
{ const _lg = loadGame; loadGame = function () { const ok = _lg(); if (ok) { climate(); falloutArr(); for (const k of ['co2', 'temp', 'geo', 'peak', 'seaT', 'winter', 'flooded']) G.climate[k] = G.climate[k] || 0; G.climate.marks = G.climate.marks || {}; } return ok; }; }

// ---------- What you see ----------
function climateBadge() {
  const c = G.climate; if (!c || (topEra() < 5 && c.temp < 0.05)) return '';
  const t = c.temp, cls = t >= 2 ? 'neg' : t >= 1 ? '' : 'pos';
  return ` <span class="${cls}" data-tip="Global warming: +${t.toFixed(2)}°C (peak +${c.peak.toFixed(1)}). You emit ${c.emit.toFixed(1)}/day, rivals ${c.rivals.toFixed(1)}/day; forests and carbon capture absorb ${c.absorb.toFixed(1)}/day.${t >= 1 ? ` Farms −${Math.round((1 - climateFarmMult()) * 100)}%.` : ''}${t >= 1.5 ? ' Seas are rising.' : ''} See the Realm window.">🌡️+${t.toFixed(1)}°</span>`;
}
function doomBadge() {
  if (!G || (!worldWarheads() && !(G.doom > 1))) return '';
  const m = minutesToMidnight();
  return ` <span class="${m < 4 ? 'neg' : ''}" data-tip="Doomsday clock: ${midnightStr()} to midnight. ${worldWarheads()} warheads in the world${nukesReady() ? ` (${nukesReady()} of them yours, ready)` : ''}. At midnight, nuclear war breaks out between the powers at war.">☢️${midnightStr()}</span>`;
}
{ const _ut = updateTop; updateTop = function () { _ut(); const el = $('#clock .time'); if (el) el.insertAdjacentHTML('beforeend', climateBadge() + doomBadge() + (G.ww ? ` <span class="neg" data-tip="World war: ${G.ww.names.a} against ${G.ww.names.b}">🌐</span>` : '')); }; }
function futureRealmHtml() {
  let h = '';
  const c = G.climate;
  if (c && (topEra() >= 5 || c.co2 > 0)) {
    h += `<div class="sec">🌍 Climate</div><div class="kv">Warming <b class="${c.temp >= 2 ? 'neg' : c.temp >= 1 ? '' : 'pos'}">+${c.temp.toFixed(2)}°C</b> (peak +${c.peak.toFixed(1)}) · carbon in the air ${Math.round(c.co2)}</div>`;
    h += `<div class="kv">Per day: you emit <b>${c.emit.toFixed(1)}</b> (coal mines, factories, coal power plants) · rivals ${c.rivals.toFixed(1)} · forests and carbon capture absorb ${c.absorb.toFixed(1)}${c.geo > 0.01 ? ` · your climate stations hold the planet ${c.geo.toFixed(2)}°C cooler` : ''}</div>`;
    const fx2 = [];
    if (c.temp >= 1) fx2.push(`farms −${Math.round((1 - climateFarmMult()) * 100)}%`);
    if (c.temp >= 0.8) fx2.push('more droughts, storms, floods and heatwaves');
    if (c.temp >= 1.5) fx2.push(`seas rising (${c.flooded} coastal tiles lost so far — Sea Walls protect yours)`);
    if (c.temp >= 1.5) fx2.push('climate anxiety lowers mood');
    if (c.temp >= 2) fx2.push('climate refugees');
    if (c.winter > 0) fx2.push(`<span class="neg">nuclear winter for ${c.winter} more days</span>`);
    h += `<div class="kv">${fx2.length ? 'Effects: ' + fx2.join(' · ') : '<span class="pos">No harm yet.</span> Effects begin around +0.8°C.'}</div>`;
    if (G.accord) h += `<div class="kv">🌍 Climate Accord since day ${G.accord.day}: members ${livingRealms().filter(f => f.accord).map(f => f.name).join(', ') || 'none left'} — you promised under ${G.accord.cap}/day ${playerEmissions() > G.accord.cap ? '<span class="neg">(breaking it!)</span>' : '<span class="pos">✓</span>'}</div>`;
    else if (hasTech('climateaccord')) h += `<button class="btn sm" data-act="accord" ${canAfford(accordCost()) ? '' : 'disabled'} data-tip="Rivals who agree halve their emissions. You must keep yours under 60% of today's.">🌍 Propose a World Climate Accord — ${costStr(accordCost())}</button>`;
    else h += `<div class="dim">Research Climate Diplomacy to propose a World Climate Accord. Carbon Capture, Geoengineering and forests all bring warming down.</div>`;
  }
  if (worldWarheads() || G.doom > 1) {
    h += `<div class="sec">☢️ Doomsday clock — ${midnightStr()} to midnight</div>${bar(clamp(G.doom || 0, 0, 100), G.doom > 75 ? '#e53935' : '#ffb300')}`;
    h += `<div class="kv">Warheads: you ${nukesReady()}/${siloCap()} ready${livingRealms().filter(f => f.nukes).map(f => ` · ${esc(f.name)} ${f.nukes}`).join('')}. Missile defense stops ${Math.round(Math.min(1, fx('nukeShield')) * 100)}% of missiles aimed at you.</div><div class="dim">Warheads, world wars and wars between nuclear powers push the clock forward; treaties, hotlines and a World Federation pull it back. At midnight the powers at war fire on each other.</div>`;
  }
  if (G.ww) h += `<div class="sec">🌐 World war</div><div class="kv"><b>${G.ww.names.a}</b>: ${blocMembers('a').map(f => esc(f.name)).join(', ')}<br><b>${G.ww.names.b}</b>: ${blocMembers('b').map(f => esc(f.name)).join(', ')}<br>You: ${G.ww.side === 'a' || G.ww.side === 'b' ? `fighting for ${G.ww.names[G.ww.side]}` : G.ww.side === 'trade' ? 'neutral, selling arms' : 'neutral'} · day ${G.time.day - G.ww.start} of the war</div>`;
  return h;
}
{ const _wr = winRealm; winRealm = function () { const r = _wr(); r[1] += futureRealmHtml(); return r; }; }
{ const _wa = winArmy; winArmy = function () {
  const r = _wa(); let h = '';
  if (siloCap()) {
    h += `<div class="sec">☢️ Nuclear arsenal — ${nukesReady()}/${siloCap()} ready <small>(a spent warhead is rebuilt every 30 days)</small></div>`;
    const ws = G.factions.filter(f => f.war && !f.dead);
    h += ws.length ? `<div class="btnrow">${ws.map(f => `<button class="btn sm danger" data-act="nuke" data-arg="${f.id}" ${nukesReady() ? '' : 'disabled'}>☢️ Strike ${esc(f.name)}</button>`).join('')}</div>` : '<div class="dim">Your warheads deter rivals with fewer of their own from attacking you.</div>';
  }
  r[1] += h; return r;
}; }
Object.assign(ACT, {
  accord: () => { proposeAccord(); renderWin(true); },
  nuke: a => { queueEvent('nukeConfirm', { fid: +a }); closeWin(); showNextEvent(); },
});

// ---------- Art: the new halls ----------
{ const _dh = drawHall; drawHall = function (c, px, py, L, roof, fcol) {
  if (L < 8) return _dh(c, px, py, L, roof, fcol);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px - 4, py + 27, 40, 4);
  if (L === 8) { // planetary assembly: a green-roofed ring hall under a glass globe
    c.fillStyle = '#eceff1'; c.fillRect(px - 6, py + 12, 44, 17);
    glassWin(c, px - 4, py + 15, 40, 9, 2, 8, '#80cbc4');
    c.fillStyle = '#66bb6a'; c.fillRect(px - 7, py + 10, 46, 3);
    c.fillStyle = 'rgba(129,212,250,0.75)'; c.beginPath(); c.arc(px + 16, py + 4, 11, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(px + 16, py + 4, 11, 4, 0, 0, 7); c.moveTo(px + 16, py - 7); c.lineTo(px + 16, py + 15); c.ellipse(px + 16, py + 4, 4, 11, 0, 0, 7); c.stroke();
    c.fillStyle = '#43a047'; c.beginPath(); c.arc(px + 13, py + 2, 3, 0, 7); c.arc(px + 19, py + 7, 2.4, 0, 7); c.fill();
    c.fillStyle = '#37474f'; c.fillRect(px + 13, py + 23, 6, 6);
    flag(c, px + 36, py - 2, 10, fcol);
  } else if (L === 9) { // fusion spire: a white needle with a glowing ring
    c.fillStyle = '#f5f5f5'; c.beginPath(); c.moveTo(px + 8, py + 29); c.lineTo(px + 14, py - 46); c.lineTo(px + 18, py - 46); c.lineTo(px + 24, py + 29); c.fill();
    glassWin(c, px + 12, py - 30, 8, 52, 12, 1, '#90caf9');
    const g = 0.6 + Math.sin(R.t * 3) * 0.25;
    c.strokeStyle = `rgba(255,213,79,${g})`; c.lineWidth = 2.2; c.beginPath(); c.ellipse(px + 16, py - 18, 12, 4, 0, 0, 7); c.stroke();
    c.fillStyle = `rgba(255,241,118,${g})`; c.beginPath(); c.arc(px + 16, py - 49, 3, 0, 7); c.fill();
    c.fillStyle = '#e0e0e0'; c.fillRect(px - 6, py + 18, 44, 11); glassWin(c, px - 4, py + 20, 14, 7, 1, 3, '#4fc3f7'); glassWin(c, px + 22, py + 20, 14, 7, 1, 3, '#4fc3f7');
    c.fillStyle = '#263238'; c.fillRect(px + 13, py + 23, 6, 6);
    flag(c, px + 36, py + 6, 9, fcol);
  } else { // orbital citadel: a ringed tower with a tether rising out of sight
    c.strokeStyle = 'rgba(207,216,220,0.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 16, py - 40); c.lineTo(px + 16, py - 120); c.stroke();
    const k = (R.t * 0.3) % 1; c.fillStyle = '#ffd54f'; c.fillRect(px + 14.5, py - 44 - k * 70, 3, 4);
    c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 6, py + 29); c.lineTo(px + 11, py - 36); c.lineTo(px + 21, py - 36); c.lineTo(px + 26, py + 29); c.fill();
    glassWin(c, px + 11, py - 30, 10, 54, 12, 2, '#7e57c2');
    for (const [yy, w] of [[-36, 15], [-8, 18], [14, 20]]) { c.strokeStyle = 'rgba(77,208,225,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(px + 16, py + yy, w, 3.5, 0, 0, 7); c.stroke(); }
    c.fillStyle = '#b39ddb'; c.fillRect(px - 6, py + 20, 44, 9); c.fillStyle = '#263238'; c.fillRect(px + 13, py + 23, 6, 6);
    flag(c, px + 36, py + 8, 9, fcol);
  }
}; }

// ---------- Art: buildings of the future ----------
function drawFutureBuilding(c, b, px, py, L, roof) {
  const on = b.workers && b.workers.length && !b.ruined, sh = () => { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 1, py + 27, 31, 4); };
  switch (b.type) {
    case 'nuclearplant': sh();
      for (const cx of [9, 23]) { c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(px + cx - 7, py + 29); c.quadraticCurveTo(px + cx - 3, py + 12, px + cx - 5, py + 2); c.lineTo(px + cx + 5, py + 2); c.quadraticCurveTo(px + cx + 3, py + 12, px + cx + 7, py + 29); c.fill(); c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(px + cx + 1, py + 4, 4, 25); if (on) for (let k2 = 0; k2 < 2; k2++) { const t = (R.t * 0.3 + k2 / 2 + cx) % 1; c.fillStyle = `rgba(250,250,250,${0.7 - t * 0.6})`; c.beginPath(); c.arc(px + cx, py + 1 - t * 14, 4 + t * 5, 0, 7); c.fill(); } }
      c.fillStyle = '#ffeb3b'; c.beginPath(); c.arc(px + 16, py + 24, 3, 0, 7); c.fill(); c.fillStyle = '#212121'; c.font = '5px sans-serif'; c.textAlign = 'center'; c.fillText('☢', px + 16, py + 26);
      return true;
    case 'carboncapture': sh();
      c.fillStyle = '#b2dfdb'; c.fillRect(px + 2, py + 10, 28, 19);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#455a64'; c.beginPath(); c.arc(px + 8 + i * 8, py + 16, 3.4, 0, 7); c.fill(); c.save(); c.translate(px + 8 + i * 8, py + 16); c.rotate(on ? R.t * 4 + i : 0); c.fillStyle = '#90a4ae'; c.fillRect(-3, -0.6, 6, 1.2); c.fillRect(-0.6, -3, 1.2, 6); c.restore(); }
      c.fillStyle = roof; c.fillRect(px + 2, py + 8, 28, 3); c.fillStyle = '#26a69a'; c.fillRect(px + 4, py + 23, 24, 4);
      if (on) { c.fillStyle = 'rgba(165,214,167,0.6)'; c.beginPath(); c.arc(px + 16, py + 4 - (R.t * 3 % 4), 2, 0, 7); c.fill(); }
      return true;
    case 'silo': sh();
      c.fillStyle = '#78909c'; c.fillRect(px + 3, py + 18, 26, 11); c.fillStyle = '#546e7a'; c.beginPath(); c.ellipse(px + 16, py + 18, 11, 4, 0, 0, 7); c.fill();
      c.fillStyle = '#37474f'; c.beginPath(); c.ellipse(px + 16, py + 18, 7, 2.5, 0, 0, 7); c.fill();
      if (nukesReady()) { c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 13.5, py + 18); c.lineTo(px + 13.5, py + 6); c.lineTo(px + 16, py + 1); c.lineTo(px + 18.5, py + 6); c.lineTo(px + 18.5, py + 18); c.fill(); c.fillStyle = '#e53935'; c.fillRect(px + 13.5, py + 6, 5, 1.5); }
      c.fillStyle = '#ffeb3b'; for (let i = 0; i < 6; i++) c.fillRect(px + 4 + i * 4.4, py + 27, 2.2, 1.5);
      return true;
    case 'seawall':
      c.fillStyle = '#78909c'; c.fillRect(px, py + 12, 32, 14); c.fillStyle = '#b0bec5'; c.fillRect(px, py + 10, 32, 3);
      c.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 4; i++) c.fillRect(px + i * 8 + 3, py + 13, 1, 13);
      c.fillStyle = 'rgba(79,195,247,0.7)'; c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(px + i * 4, py + 27 + Math.sin(R.t * 2 + i) * 1.2); c.lineTo(px + 32, py + 31); c.lineTo(px, py + 31); c.fill();
      return true;
    case 'seedvault': sh();
      c.fillStyle = '#9e9e9e'; c.beginPath(); c.moveTo(px - 4, py + 29); c.lineTo(px + 16, py - 2); c.lineTo(px + 36, py + 29); c.fill();
      c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(px + 6, py + 14); c.lineTo(px + 16, py - 2); c.lineTo(px + 26, py + 14); c.fill();
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(px + 11, py + 29); c.lineTo(px + 16, py + 12); c.lineTo(px + 21, py + 29); c.fill();
      c.fillStyle = `rgba(129,212,250,${0.6 + Math.sin(R.t * 2) * 0.3})`; c.fillRect(px + 14, py + 16, 4, 8);
      return true;
    case 'climatestation': sh();
      c.fillStyle = '#eceff1'; c.fillRect(px + 4, py + 16, 24, 13); glassWin(c, px + 6, py + 18, 20, 6, 1, 4, '#4fc3f7');
      c.fillStyle = '#90a4ae'; c.fillRect(px + 15, py - 10, 2, 26);
      c.fillStyle = '#b0bec5'; c.beginPath(); c.ellipse(px + 16, py - 10, 9, 3, 0, 0, 7); c.fill();
      if (on) { for (let k2 = 0; k2 < 3; k2++) { const t = (R.t * 0.25 + k2 / 3) % 1; c.fillStyle = `rgba(255,255,255,${0.6 - t * 0.5})`; c.beginPath(); c.arc(px + 16 + (k2 - 1) * 6 * t, py - 14 - t * 16, 3 + t * 5, 0, 7); c.fill(); } }
      return true;
    case 'quantumlab': sh();
      c.fillStyle = '#212121'; c.fillRect(px + 3, py + 8, 26, 21); c.fillStyle = roof; c.fillRect(px + 3, py + 6, 26, 3);
      c.fillStyle = '#ffd54f'; c.fillRect(px + 13, py + 12, 6, 12); for (let i = 0; i < 4; i++) { c.fillStyle = '#ffb300'; c.fillRect(px + 11 + (i % 2) * 8, py + 13 + i * 3, 2, 1.2); }
      c.fillStyle = `rgba(179,136,255,${0.5 + Math.sin(R.t * 6 + b.id) * 0.4})`; c.beginPath(); c.arc(px + 16, py + 18, 9, 0, 7); c.fill(); c.fillStyle = '#ffd54f'; c.fillRect(px + 15, py + 12, 2, 12);
      return true;
    case 'fusionreactor': sh();
      c.fillStyle = '#eceff1'; c.beginPath(); c.ellipse(px + 16, py + 22, 15, 8, 0, 0, 7); c.fill();
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.ellipse(px + 16, py + 18, 13, 7, 0, 0, 7); c.fill();
      { const g = on ? 0.6 + Math.sin(R.t * 8) * 0.3 : 0.15; c.strokeStyle = `rgba(255,145,0,${g})`; c.lineWidth = 2.5; c.beginPath(); c.ellipse(px + 16, py + 18, 9, 4.5, 0, 0, 7); c.stroke(); c.fillStyle = `rgba(255,241,118,${g})`; c.beginPath(); c.arc(px + 16, py + 18, 2.5, 0, 7); c.fill(); }
      c.fillStyle = '#90a4ae'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.fillRect(px + 16 + Math.cos(a) * 12 - 1, py + 18 + Math.sin(a) * 6 - 1, 2, 2); }
      return true;
    case 'arcology': {
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(px + 16, py + 28, 14, 3.5, 0, 0, 7); c.fill();
      const top = py - 30 - L * 10;
      c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 1, py + 29); c.lineTo(px + 7, top); c.lineTo(px + 25, top); c.lineTo(px + 31, py + 29); c.fill();
      glassWin(c, px + 7, top + 4, 18, py + 25 - top - 4, 10, 3, '#81d4fa');
      c.fillStyle = '#43a047'; const steps = 4 + L; for (let i = 0; i < steps; i++) { const yy = top + 6 + i * (py + 22 - top) / steps; c.beginPath(); c.arc(px + 6 + (i % 2) * 20, yy, 3, 0, 7); c.fill(); c.fillRect(px + 5 + (i % 2) * 15, yy + 1, 7, 1.5); }
      c.fillStyle = '#66bb6a'; c.beginPath(); c.ellipse(px + 16, top, 9, 3, 0, 0, 7); c.fill();
      return true;
    }
    case 'asteroidport': sh();
      c.fillStyle = '#9e9e9e'; c.fillRect(px + 1, py + 24, 30, 5);
      c.strokeStyle = '#ff7043'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 25, py + 24); c.lineTo(px + 25, py - 6); c.moveTo(px + 29, py + 24); c.lineTo(px + 29, py - 6); for (let i = 0; i < 4; i++) { c.moveTo(px + 25, py + 20 - i * 7); c.lineTo(px + 29, py + 16 - i * 7); } c.stroke();
      { const lift = (R.t * 0.12 + b.id * 0.13) % 1, up = on && lift > 0.7 ? (lift - 0.7) * 120 : 0; c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(px + 15, py + 24 - up); c.lineTo(px + 15, py + 2 - up); c.quadraticCurveTo(px + 18, py - 8 - up, px + 21, py + 2 - up); c.lineTo(px + 21, py + 24 - up); c.fill(); if (up) { c.fillStyle = 'rgba(255,152,0,0.85)'; c.beginPath(); c.moveTo(px + 16, py + 24 - up); c.lineTo(px + 18, py + 32 - up); c.lineTo(px + 20, py + 24 - up); c.fill(); } }
      c.fillStyle = '#8d6e63'; for (const [ox, oy] of [[3, 20], [7, 21], [5, 17]]) { c.beginPath(); c.arc(px + ox, py + oy, 2.2, 0, 7); c.fill(); }
      return true;
    case 'shielddome':
      c.fillStyle = '#37474f'; c.fillRect(px + 6, py + 20, 20, 9); c.fillStyle = '#4dd0e1'; c.fillRect(px + 14, py + 8, 4, 13);
      c.fillStyle = `rgba(77,208,225,${0.18 + Math.sin(R.t * 2) * 0.06})`; c.beginPath(); c.arc(px + 16, py + 29, 20, Math.PI, 0); c.fill();
      c.strokeStyle = 'rgba(178,235,242,0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(px + 16, py + 29, 20, Math.PI, 0); c.stroke();
      return true;
    case 'spaceelevator':
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px - 4, py + 26, 40, 5);
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(px - 2, py + 29); c.lineTo(px + 12, py + 8); c.lineTo(px + 20, py + 8); c.lineTo(px + 34, py + 29); c.fill();
      c.strokeStyle = '#eceff1'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 16, py + 8); c.lineTo(px + 16, py - 160); c.stroke();
      for (let k2 = 0; k2 < 3; k2++) { const t = (R.t * 0.08 + k2 / 3) % 1; c.fillStyle = k2 % 2 ? '#ffd54f' : G.realm.color; c.fillRect(px + 13.5, py + 4 - t * 160, 5, 5); }
      c.fillStyle = G.realm.color; c.fillRect(px + 12, py + 14, 8, 4);
      return true;
  }
  return false;
}
{ const _dnb = drawNewBuilding; drawNewBuilding = function (c, b, px, py, L, roof) { return drawFutureBuilding(c, b, px, py, L, roof) || _dnb(c, b, px, py, L, roof); }; }
// fallout on the map, drawn over the ground
function drawFutureOverlay(c, x0, y0, x1, y1) {
  const F = G.tiles.fallout; if (!F) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = F[idx(x, y)]; if (!v) continue;
    c.fillStyle = `rgba(150,190,40,${0.12 + Math.min(0.25, v / 900)})`; c.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (R.cam.z > 0.8 && (x + y) % 3 === 0) { c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,235,59,0.75)'; c.fillText('☢', x * TILE + 16, y * TILE + 19); }
  }
}
