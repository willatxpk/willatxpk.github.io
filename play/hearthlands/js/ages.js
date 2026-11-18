// ===== Ages, governments, technology effects, the power grid, era disasters, and the rise and fall of rival realms =====

// ---------- Ages ----------
function curEra() { return thLevel(); }
function eraInfo(e) { return ERAS[clamp(e || 1, 1, MAX_ERA)]; }
function techsOfEra(e) { return Object.keys(TECHS).filter(id => TECHS[id].era === e); }
function eraProgress() { const e = curEra(); return { have: techsOfEra(e).filter(hasTech).length, need: e < MAX_ERA ? ERAS[e + 1].need : 0 }; }
function advanceBlock() {
  const e = curEra(); if (e >= MAX_ERA) return 'This is the final age.';
  const p = eraProgress();
  if (p.have < p.need) return `Discover ${p.need - p.have} more ${ERAS[e].name} technolog${p.need - p.have === 1 ? 'y' : 'ies'} (${p.have}/${p.need})`;
  return null;
}
function advanceEra() {
  const th = townhall(); if (!th) return false;
  const bl = advanceBlock(); if (bl) { toast(bl); return false; }
  const nx = ERAS[th.level + 1];
  if (!canAfford(nx.cost)) { toast(`Rebuilding as a ${nx.hall} costs ${costStr(nx.cost)}`); return false; }
  pay(nx.cost); th.level++;
  addLog(`${nx.icon} ${G.realm.name} enters the ${nx.name}! The Town Hall is rebuilt as a ${nx.hall}. ${nx.desc}`, 'good');
  toast(`${nx.icon} Welcome to the ${nx.name}!`);
  history(`${G.realm.name} entered the ${nx.name}.`, nx.icon);
  addMod('A new age dawns', 8, 6);
  rebuildFx(); refreshMults(); recomputeAppeal(); assignHousing(); autoAssignJobs();
  if (typeof UI !== 'undefined' && UI.tool && UI.tool.kind === 'build') renderBuildMenu();
  return true;
}
function history(text, icon) { if (!G.history) G.history = []; G.history.unshift({ d: G.time.day, text, icon: icon || '📜' }); if (G.history.length > 200) G.history.length = 200; }

// ---------- Technology, government and economy effects ----------
let FXC = { prod: {}, res: {} };
function rebuildFx() {
  const o = { prod: {}, res: {} };
  const add = s => { if (!s) return; for (const k in s) { if (k === 'prod' || k === 'res') { for (const t in s[k]) o[k][t] = (o[k][t] || 0) + s[k][t]; } else o[k] = (o[k] || 0) + s[k]; } };
  for (const id in G.techs) if (TECHS[id]) add(TECHS[id].fx);
  if (GOVS[G.gov]) add(GOVS[G.gov].fx);
  if (ECONS[G.econ]) add(ECONS[G.econ].fx);
  o.bl = {}; for (const id in G.techs) if (TECHS[id]) o.bl[TECHS[id].branch] = (o.bl[TECHS[id].branch] || 0) + 1;
  FXC = o;
}
function fx(k) { return FXC[k] || 0; }
function fxProd(t) { return FXC.prod[t] || 0; }
function fxRes(r) { return FXC.res[r] || 0; }

function reformCost() { return { influence: 25 + 25 * curEra() }; }
function reformBlock(kind, id) {
  const L = kind === 'gov' ? GOVS : ECONS, g = L[id];
  if (!g) return 'Unknown';
  if (G[kind] === id) return 'Already adopted';
  if (g.tech && !hasTech(g.tech)) return `Research ${TECHS[g.tech].name}`;
  if (G.time.day < (G.reformCd || 0)) return `Your people need time — next reform in ${G.reformCd - G.time.day} days`;
  if (!canAfford(reformCost())) return `Costs ${costStr(reformCost())}`;
  return null;
}
function adoptReform(kind, id) {
  const bl = reformBlock(kind, id); if (bl) { toast(bl); return false; }
  const L = kind === 'gov' ? GOVS : ECONS, g = L[id];
  pay(reformCost()); G[kind] = id; G.upheaval = 4; G.reformCd = G.time.day + 20;
  addLog(`${g.icon} ${G.realm.name} adopts ${g.name}. Four days of upheaval follow while the new order settles in.`, 'good');
  toast(`${g.icon} ${g.name} adopted!`);
  history(kind === 'gov' ? `${G.realm.name} became a ${g.name}.` : `${G.realm.name} adopted ${g.name}.`, g.icon);
  for (const f of G.factions) if (!f.dead && f.gov === G.gov && kind === 'gov') f.relation += 6;
  rebuildFx(); refreshMults();
  return true;
}

// ---------- Power grid (Industrial Age onward) ----------
function powerGrid() {
  let sup = 0, dem = 0;
  const shut = (G.smogShut || 0) > 0;
  for (const b of Object.values(G.buildings)) {
    const d = B[b.type];
    if (d.power > 0) {
      if (b.paused || b.burning || b.ruined) continue;
      if (d.workers) { if (shut || b.starved) continue; const staffed = Math.min(1, b.workers.length / Math.max(1, d.workers) ); sup += d.power * b.level * staffed; }
      else sup += d.power * (1 + fx('power'));
    } else if (d.power < 0 && !b.paused) dem += -d.power * (b.workers.length ? 1 : 0.3);
    if (d.powerLv && b.level >= d.powerLv) dem += (b.level - d.powerLv + 1) * 1.5;
  }
  if (G.blackout > 0) sup *= 0.25;
  if (G.heat > 0) dem *= 1.4;
  G.power = { sup, dem, ratio: dem > 0.01 ? Math.min(1, sup / dem) : 1 };
}
function powerRatio() { return G.power ? G.power.ratio : 1; }

// ---------- Digging, prospecting, caverns ----------
function rollVein() {
  const opts = [[1, 45], [2, 18], [4, 10]]; if (curEra() >= 5 || hasTech('steampower')) opts.push([3, 30]);
  let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot;
  for (const [v, w] of opts) { r -= w; if (r <= 0) return v; }
  return 1;
}
function prospect(x, y, quiet) {
  const i = idx(x, y);
  if (G.tiles.special[i]) { if (!quiet) toast(`There is already a ${VEINS[G.tiles.special[i]].name.toLowerCase()} here.`); return false; }
  const c = terraCost('prospect'); if (!canAfford(c)) { if (!quiet) toast(`Needs ${costStr(c)}`); return false; }
  pay(c);
  if (Math.random() < 0.35) {
    const v = rollVein(); G.tiles.special[i] = v; R.dirtyTiles.push(i);
    floatText(x, y, `${VEINS[v].icon} ${VEINS[v].name}!`, '#ffd54f');
    addLog(`🔍 Prospectors found a ${VEINS[v].name.toLowerCase()} in the hills!`, 'good');
  } else floatText(x, y, 'Nothing here', '#cfd8dc');
  return true;
}
function digLoot(kind, x, y) {
  const r = Math.random(), e = curEra(), relic = fx('relics') ? 2 : 1;
  if ((kind === 'carve' || kind === 'blast') && r < 0.05) { queueEvent('cavern', { x, y }); return; }
  let msg = null;
  if (r < 0.12) { gain('iron', 3 + e); msg = `⛏️ +${3 + e} iron`; }
  else if (r < 0.18) { const g = 8 + 4 * e; gain('gold', g); msg = `🪙 +${g} gold nugget`; }
  else if (r < 0.2) { const g = 30 + 10 * e; gain('gold', g); gain('influence', 4); msg = `💎 Gems! +${g} gold`; }
  else if (r < 0.2 + 0.025 * relic) { const k = 12 + 8 * e; gain('knowledge', k); msg = `🏺 Ancient relic! +${k} knowledge`; }
  else if (e >= 5 && r < 0.36) { gain('coal', 6); msg = '⚫ +6 coal'; }
  if (msg) floatText(x, y, msg, '#ffd54f');
}
function nearWater(b) { return N8.some(([dx, dy]) => inB(b.x + dx, b.y + dy) && [T.WATER, T.DEEP].includes(terr(b.x + dx, b.y + dy))); }
function damageBuildings(n, days, filter) {
  const bs = Object.values(G.buildings).filter(b => !B[b.type].decor && !['townhall', 'wall'].includes(b.type) && !b.ruined && (!filter || filter(b)));
  bs.sort(() => Math.random() - 0.5);
  const hit = [];
  for (const b of bs) {
    if (hit.length >= n) break;
    if (emergencyCover(b) && Math.random() < 0.5) continue; // fire stations and hospitals soften the blow
    b.ruined = days; hit.push(b);
  }
  if (hit.length) addLog(`🚧 Damaged: ${hit.map(b => B[b.type].name).join(', ')} — out of action for ${days} days.`, 'bad');
  return hit;
}
function emergencyCover(b) { return Object.values(G.buildings).some(o => (o.type === 'firestation' && dist(o.x, o.y, b.x, b.y) <= 9) || (o.type === 'hospital' && dist(o.x, o.y, b.x, b.y) <= 12)); }

// ---------- Era disasters and opportunities ----------
Object.assign(EVENTS, {
  cavern: {
    make: () => ({
      title: '🕳️ A Hidden Cavern', icon: '🕳️', text: 'Your diggers broke into a vast cavern glittering with crystals. Strange echoes come from the dark.',
      choices: [
        { label: 'Explore it', tip: '65%: treasure (gold and knowledge). 35%: a cave-in hurts a digger.', fn: () => { if (Math.random() < 0.65) { const e = curEra(); gain('gold', 40 + 15 * e); gain('knowledge', 15 + 8 * e); addLog('💎 The explorers returned with crystals and strange carvings!', 'good'); } else { const k = randomAdult(); if (k) { k.health -= 45; addLog(`🪨 A cave-in! ${kinName(k)} was badly hurt.`, 'bad'); } } } },
        { label: 'Grow mushrooms in it', tip: '+60 food.', fn: () => gain('food', 60) },
        { label: 'Seal it up', tip: 'Safe. The kin tell ghost stories about it (+3 mood).', fn: () => addMod('Cave legends', 3, 4) },
      ] }),
  },
  flood: {
    random: true, weight: () => curEra() <= 5 && Object.values(G.buildings).some(nearWater) ? 0.7 : 0,
    make: () => { const c = { stone: 25 + 10 * curEra() }; return {
      title: '🌊 Flood', icon: '🌊', text: 'Heavy rains upstream — the rivers are rising fast and waterside buildings are in danger.',
      choices: [
        { label: 'Raise levees', tip: `${costStr(c)}: no damage.`, disabled: !canAfford(c), fn: () => { pay(c); addLog('🌊 The levees held!', 'good'); } },
        { label: 'Move stores to high ground', tip: 'Lose 10% food; up to 2 waterside buildings flooded for 3 days.', fn: () => { G.res.food *= 0.9; damageBuildings(2, 3, nearWater); } },
        { label: 'Ride it out', tip: 'Stores spoil (−20% food); waterside buildings flooded for 6 days.', fn: () => { G.res.food *= 0.8; damageBuildings(3, 6, nearWater); } },
      ] }; },
  },
  earthquake: {
    random: true, weight: () => G.time.day > 30 && Object.keys(G.buildings).length > 12 ? 0.3 : 0,
    make: () => { const c = { tools: 8 + 6 * curEra(), stone: 20 + 10 * curEra() }; return {
      title: '🫨 Earthquake!', icon: '🫨', text: 'The ground heaves and cracks. Walls are down and dust hangs over the town.',
      choices: [
        { label: 'Send every builder', tip: `${costStr(c)}: 2 buildings out for just 2 days.`, disabled: !canAfford(c), fn: () => { pay(c); damageBuildings(2, 2); } },
        { label: 'Search the rubble first', tip: '3 buildings out for 5 days, but kin are grateful (+4 mood).', fn: () => { damageBuildings(3, 5); addMod('We stood together', 4, 5); } },
        { label: 'Seek omens', tip: '20 influence: 50% the damage is light (1 building).', disabled: G.res.influence < 20, fn: () => { G.res.influence -= 20; damageBuildings(Math.random() < 0.5 ? 1 : 3, 5); } },
      ] }; },
  },
  smog: {
    random: true, weight: () => curEra() >= 5 ? (countB('factory') + countB('coalmine') + countB('powerplant')) * 0.35 * (fx('green') ? 0.2 : 1) : 0,
    make: () => { const c = { gold: Math.round(10 + G.kin.length * 0.8) }; return {
      title: '🌫️ Choking Smog', icon: '🌫️', text: 'Soot from smokestacks hangs over the town. Kin are coughing and the washing comes in grey.',
      choices: [
        { label: 'Shut the smokestacks', tip: 'Factories, coal mines and power plants stop for 2 days.', fn: () => { G.smogShut = 2; } },
        { label: 'Hand out masks', tip: `${costStr(c)}: kin are fine.`, disabled: !canAfford(c), fn: () => pay(c) },
        { label: 'Ignore it', tip: 'Some kin fall ill; −6 mood for 5 days.', fn: () => { infect(Math.max(1, Math.round(G.kin.length * 0.08)), 4); addMod('Smog', -6, 5); } },
      ] }; },
  },
  strike: {
    random: true, weight: () => curEra() >= 5 && G.kin.length > 30 ? (avgMood() < 55 ? 1.1 : 0.35) * (G.econ === 'welfare' ? 0.3 : 1) : 0,
    make: () => { const c = { gold: Math.round(G.kin.length * 1.6) }, c2 = { influence: 30 }; return {
      title: "✊ Workers' Strike", icon: '✊', text: 'Workers have downed tools across the realm, demanding better pay and shorter hours.',
      choices: [
        { label: 'Raise wages', tip: `${costStr(c)}: work resumes, +5 mood.`, disabled: !canAfford(c), fn: () => { pay(c); addMod('Better wages', 5, 6); } },
        { label: 'Negotiate', tip: `${costStr(c2)}: a one-day strike.`, disabled: !canAfford(c2), fn: () => { pay(c2); G.strike = 1; } },
        { label: 'Wait them out', tip: 'Production −50% for 4 days and −6 mood.', fn: () => { G.strike = 4; addMod('The strike', -6, 4); } },
      ] }; },
  },
  blackout: {
    random: true, weight: () => curEra() >= 5 && G.power && G.power.dem > 0 ? 0.8 + (G.power.ratio < 1 ? 0.8 : 0) : 0,
    make: () => { const c = { tools: 20 + 10 * (curEra() - 4), gold: 40 + 20 * (curEra() - 4) }; return {
      title: '⚡ Blackout!', icon: '⚡', text: 'A fault cascades through the grid and the lights go out across the realm. Apartments, labs and hospitals sit dark.',
      choices: [
        { label: 'Emergency repairs', tip: `${costStr(c)}: power back after 1 day.`, disabled: !canAfford(c), fn: () => { pay(c); G.blackout = 1; } },
        { label: 'Rolling blackouts', tip: '3 days of weak power, −4 mood.', fn: () => { G.blackout = 3; addMod('Rolling blackouts', -4, 3); } },
        { label: 'Wait for the engineers', tip: '5 days of weak power.', fn: () => { G.blackout = 5; } },
      ] }; },
  },
  hurricane: {
    random: true, weight: () => curEra() >= 4 ? 0.35 + 0.15 * (curEra() - 4) : 0,
    make: () => { const modern = curEra() >= 6, n = randi(2, 4), c = { gold: 30 + 25 * curEra(), wood: 30 }, rep = { tools: 10 + 8 * curEra(), stone: 30 + 15 * curEra() }; return {
      title: modern ? '🌀 Hurricane!' : '🌪️ A Great Storm', icon: '🌀', text: `${modern ? 'A hurricane' : 'A howling storm'} is bearing down on ${G.realm.name}. Roofs will fly. ${countB('firestation') + countB('hospital') ? 'Your emergency services stand ready.' : '<i>Fire stations and hospitals soften disasters.</i>'}`,
      choices: [
        { label: 'Board up and evacuate', tip: `${costStr(c)}: only 1 building is damaged; no one is hurt.`, disabled: !canAfford(c), fn: () => { pay(c); damageBuildings(1, 4); } },
        { label: 'Rebuild fast afterwards', tip: `${costStr(rep)}: about ${n} buildings damaged but repaired in 2 days.`, disabled: !canAfford(rep), fn: () => { pay(rep); damageBuildings(n, 2); } },
        { label: 'Shelter in place', tip: `About ${n} buildings damaged for 6 days; someone may be hurt.`, fn: () => { damageBuildings(n, 6); const k = randomAdult(); if (k && Math.random() < 0.4) { k.health -= 35; addLog(`${kinName(k)} was hurt by flying debris.`, 'bad'); } } },
      ] }; },
  },
  crash: {
    random: true, weight: () => curEra() >= 5 && G.res.gold > 400 ? 0.45 : 0,
    make: () => { const lose = Math.round(G.res.gold * 0.3); return {
      title: '📉 Market Crash', icon: '📉', text: `Panic on the exchange! Prices are collapsing and the treasury stands to lose about ${lose} gold.`,
      choices: [
        { label: 'Bail out the banks', tip: '40 influence: lose only a third as much.', disabled: G.res.influence < 40, fn: () => { G.res.influence -= 40; G.res.gold -= Math.round(lose / 3); } },
        { label: 'Print money', tip: 'Keep the gold; inflation angers kin (−6 mood for 6 days).', fn: () => addMod('Inflation', -6, 6) },
        { label: 'Let it crash', tip: `Lose ${lose} gold.`, fn: () => { G.res.gold -= lose; } },
      ] }; },
  },
  cyberattack: {
    random: true, weight: () => curEra() >= 7 ? 0.6 : 0,
    make: () => { const c = { gold: 150 + G.time.day }; return {
      title: '💻 Cyberattack', icon: '💻', text: 'Hackers have broken into the realm\'s networks. Research data and bank records are at risk.',
      choices: [
        { label: 'Hire a security firm', tip: `${costStr(c)}: nothing is lost.`, disabled: !canAfford(c), fn: () => pay(c) },
        { label: 'Pull the plug for a day', tip: 'Labs and data centers stop for 1 day.', fn: () => { G.blackout = Math.max(G.blackout || 0, 1); } },
        { label: 'Shrug it off', tip: 'Lose 25% of knowledge and 10% of gold.', fn: () => { G.res.knowledge *= 0.75; G.res.gold *= 0.9; } },
      ] }; },
  },
  heatwave: {
    random: true, weight: () => curEra() >= 6 ? 0.45 : 0,
    make: () => { const c = { gold: 60 + G.kin.length }; return {
      title: '🥵 Heatwave', icon: '🥵', text: 'A scorching heatwave: air conditioners strain the grid and the old suffer.',
      choices: [
        { label: 'Open cooling centers', tip: `${costStr(c)}: no harm; power demand +40% for 3 days.`, disabled: !canAfford(c), fn: () => { pay(c); G.heat = 3; } },
        { label: 'Ration power', tip: '−5 mood for 4 days.', fn: () => addMod('Sweltering', -5, 4) },
        { label: 'Endure', tip: 'Power demand +40% for 4 days; some kin fall ill.', fn: () => { G.heat = 4; infect(Math.max(1, Math.round(G.kin.length * 0.05)), 3); } },
      ] }; },
  },
  inventor: {
    random: true, weight: () => curEra() >= 3 ? 0.7 : 0,
    make: () => { const e = curEra(), c = { gold: 30 * e }; return {
      title: "⚙️ An Inventor's Contraption", icon: '⚙️', text: 'A wild-haired inventor arrives with plans for a marvellous machine — if only someone would fund it.',
      choices: [
        { label: 'Fund it', tip: `${costStr(c)}: 60% a breakthrough (+${40 * e} knowledge); 40% it explodes.`, disabled: !canAfford(c), fn: () => { pay(c); if (Math.random() < 0.6) { gain('knowledge', 40 * e); addLog('⚙️ The contraption works! A breakthrough for your scholars.', 'good'); } else addLog('💥 The contraption exploded in a cloud of soot.', 'info'); } },
        { label: 'Buy the patent', tip: `20 influence: +${15 * e} knowledge, no risk.`, disabled: G.res.influence < 20, fn: () => { G.res.influence -= 20; gain('knowledge', 15 * e); } },
        { label: 'Laugh them out of town', fn: () => { } },
      ] }; },
  },
});
Object.assign(EVENT_AUTO, { cavern: [1], flood: [0, 1, 2], earthquake: [0, 1, 2], smog: [1, 0], strike: [1, 0, 2], blackout: [0, 1, 2], hurricane: [0, 1, 2], crash: [0, 2], cyberattack: [0, 1, 2], heatwave: [0, 1, 2], inventor: [1, 0, 2] });
EVENT_MAJOR.delete('fire');
for (const k of ['hurricane', 'strike', 'blackout', 'cavern']) EVENT_MAJOR.add(k);

// ---------- Rival realms: growth, ages, governments, towns ----------
const AI_ERA_COST = [0, 280, 360, 440, 520, 600, 680];
const ERA_MIL = [0, 1, 1.35, 1.8, 2.4, 3.2, 4.2, 5.5];
const GOV_ERA = { chiefdom: 1, monarchy: 2, republic: 2, theocracy: 3, feudalism: 3, constitutional: 4, democracy: 5, autocracy: 5, commonwealth: 6, technocracy: 7 };
const GOV_TASTE = {
  aggressive: ['autocracy', 'feudalism', 'monarchy', 'chiefdom'], mercantile: ['republic', 'constitutional', 'democracy', 'technocracy'],
  peaceful: ['theocracy', 'democracy', 'commonwealth', 'republic'], expansionist: ['feudalism', 'autocracy', 'commonwealth', 'monarchy'],
  proud: ['monarchy', 'constitutional', 'theocracy', 'technocracy'],
};
const REALM_FORMS = {
  chiefdom: ['{N} Tribes', '{N} Clans', 'Horde of {N}'], monarchy: ['Kingdom of {N}', '{N} Crown'], republic: ['{N} Republic', 'Free Cities of {N}'],
  theocracy: ['Holy {N}', 'Order of {N}'], feudalism: ['Duchy of {N}', '{N} Dominion'], constitutional: ['United {N}', 'Realm of {N}'],
  democracy: ['Republic of {N}', '{N} Federation'], autocracy: ['{N} Empire', '{N} Imperium'], commonwealth: ["People's Union of {N}", '{N} Collective'], technocracy: ['{N} Directorate', '{N} Consortium'],
};
function aiPickGov(f) {
  const e = f.era || 1, opts = Object.keys(GOV_ERA).filter(g => GOV_ERA[g] <= e);
  const liked = (GOV_TASTE[f.personality] || []).filter(g => opts.includes(g));
  const pool = (liked.length ? liked : opts).slice().sort((a, b) => GOV_ERA[b] - GOV_ERA[a]);
  return Math.random() < 0.7 ? pool[0] : pick(pool);
}
function placeName() { const n = pick(NAME_A) + pick(NAME_B) + pick(NAME_C); return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); }
function realmName(gov) { return pick(REALM_FORMS[gov] || REALM_FORMS.chiefdom).replace('{N}', placeName()); }
function leaderName(gov) { return `${GOVS[gov] ? GOVS[gov].title : 'Chief'} ${pick(FIRST_NAMES)}`; }
function hslHex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
function colDist(a, b) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
function freshColor() {
  const used = [G.realm.color, '#a08a64', ...G.factions.filter(f => !f.dead).map(f => f.color)];
  let best = '#888888', bd = -1;
  for (let i = 0; i < 30; i++) { const c = hslHex(Math.random() * 360, 50 + Math.random() * 30, 34 + Math.random() * 16); const d = Math.min(...used.map(u => colDist(u, c))); if (d > bd) { bd = d; best = c; } }
  return best;
}
function makeFaction(o) {
  const pers = o.personality || pick(Object.keys(PERSONALITY_TEXT)), e = o.era || 1;
  const gov = o.gov || aiPickGov({ era: e, personality: pers });
  if (!G.nextFid) G.nextFid = 100;
  const base = o.base ?? PERSONALITY_BASE[pers];
  const f = {
    id: o.id || G.nextFid++, name: o.name || realmName(gov), color: o.color || freshColor(), leader: o.leader || leaderName(gov), personality: pers, base,
    cap: { x: o.x, y: o.y }, relation: o.relation ?? base, troops: o.troops ?? 8, war: false, warDays: 0, weariness: 0, pact: null, pactDays: 0, subjugated: false, dead: false, tiles: 0, armyTimer: 0,
    surplus: pick(['food', 'wood', 'stone']), need: pick(['iron', 'tools', 'food', 'gold', 'stone']), stock: { food: 120, wood: 120, stone: 80, iron: 40, tools: 20, gold: 150 },
    quality: ERA_MIL[e], lastDemand: -99, met: true, era: e, gov, sci: o.sci || 0, born: G.time.day, towns: [], nextLeader: G.time.day + randi(60, 120),
  };
  if (f.need === f.surplus) f.need = 'tools';
  G.factions.push(f);
  return f;
}
function claimAround(fid, x, y, r) {
  let n = 0;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
    const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || Math.hypot(dx, dy) > r) continue;
    if (G.tiles.owner[idx(nx, ny)] === -1) { G.tiles.owner[idx(nx, ny)] = fid; n++; }
  }
  return n;
}
function livingRealms() { return G.factions.filter(f => !f.dead); }
function topEra() { let e = curEra(); for (const f of livingRealms()) e = Math.max(e, f.era || 1); return e; }

function aiDevelop(f) {
  const e = f.era || 1, d = diff();
  // science: bigger, richer realms learn faster; laggards learn from their neighbours
  const pers = { mercantile: 1.2, peaceful: 1.25, proud: 1.05, expansionist: 0.95, aggressive: 0.9 }[f.personality] || 1;
  // ideas spread: realms behind the player (or far behind the leader) catch up; realms ahead of the player slow down a little
  // realms behind you catch up; realms ahead of you slow right down, so the race stays close
  const me = curEra();
  const pace = e < me ? 1 + 0.6 * (me - e) : e === me ? 0.85 : e === me + 1 ? 0.35 : 0.12;
  const rate = (1.3 + Math.min(70, f.tiles) * 0.045) * pers * (0.75 + 0.25 * d) * pace * (f.subjugated ? 0.8 : 1);
  f.sci = (f.sci || 0) + rate;
  if (e < MAX_ERA && f.sci >= AI_ERA_COST[e]) {
    f.sci = 0; f.era = e + 1; aiBuildRoads(f);
    const ng = aiPickGov(f), oldGov = f.gov;
    if (ng !== f.gov && Math.random() < 0.6) { f.gov = ng; f.leader = leaderName(ng); }
    history(`${f.name} entered the ${ERAS[f.era].name}${f.gov !== oldGov ? ` and became a ${GOVS[f.gov].name}` : ''}.`, ERAS[f.era].icon);
    addLog(`${ERAS[f.era].icon} ${f.name} has entered the ${ERAS[f.era].name}${f.gov !== oldGov ? ` as a ${GOVS[f.gov].name}` : ''}.`, 'info');
    f.troops += 3;
  }
  // stores grow with age and land
  aiStockDay(f);
  // leaders come and go
  if (G.time.day >= (f.nextLeader || 0)) {
    f.nextLeader = G.time.day + randi(70, 140);
    const old = f.leader; f.leader = leaderName(f.gov || 'chiefdom');
    if (!f.subjugated) addLog(`👑 In ${f.name}, ${old} is succeeded by ${f.leader}.`, 'info');
    f.relation += rand(-8, 8);
  }
  aiGrowTowns(f);
}
// AI towns fill in with homes and fields, dwellings grow grander, and new towns are founded across their land.
function aiGrowTowns(f) {
  if (!f.towns) f.towns = [];
  f.towns = f.towns.filter(t => G.tiles.owner[idx(t.x, t.y)] === f.id);
  const centers = [f.cap, ...f.towns], e = f.era || 1;
  const free = (x, y) => inB(x, y) && G.tiles.owner[idx(x, y)] === f.id && TERRAIN[G.tiles.terrain[idx(x, y)]].build && !G.tiles.deco[idx(x, y)] && !G.tiles.road[idx(x, y)];
  if (Math.random() < 0.3 + 0.05 * e) {
    const c = pick(centers), r = 2 + Math.min(4, e * 0.6);
    for (let t = 0; t < 8; t++) { const x = c.x + randi(-r, r), y = c.y + randi(-r, r); if (free(x, y) && streetLane(f.id, x, y)) { G.tiles.deco[idx(x, y)] = Math.random() < 0.62 ? 1 : 2; break; } }
  }
  if (Math.random() < 0.22 + 0.04 * e) aiBuildSites(f); // mines, camps, quarries, fisheries, stores
  if (e >= 3 && Math.random() < 0.15 + 0.04 * e) { // big houses / towers near the centres
    const c = pick(centers);
    for (let t = 0; t < 8; t++) { const x = c.x + randi(-2, 2), y = c.y + randi(-2, 2); if (inB(x, y) && G.tiles.owner[idx(x, y)] === f.id && G.tiles.deco[idx(x, y)] === 1) { G.tiles.deco[idx(x, y)] = 6; break; } }
  }
  if (f.tiles > 32 * (f.towns.length + 1) && f.towns.length < 4 && Math.random() < 0.06) {
    for (let t = 0; t < 40; t++) {
      const i = randi(0, G.tiles.owner.length - 1); const x = i % MAP_W, y = (i / MAP_W) | 0;
      if (!free(x, y) || centers.some(c => dist(c.x, c.y, x, y) < 6)) continue;
      G.tiles.deco[i] = 5; f.towns.push({ x, y }); aiBuildRoads(f);
      addLog(`🏘️ ${f.name} founded a new town.`, 'info');
      break;
    }
  }
}

// ---------- AI wars between rival realms ----------
function aiWarStart(a, b) {
  a.aiWar = b.id; b.aiWar = a.id; a.aiWarDays = 0; b.aiWarDays = 0;
  history(`War broke out between ${a.name} and ${b.name}.`, '⚔️');
  addLog(`⚔️ War has broken out between ${a.name} and ${b.name}!`, 'info');
}
function aiWarEnd(a, b, why) {
  a.aiWar = null; b.aiWar = null;
  if (why) { history(why, '🕊️'); addLog(`🕊️ ${why}`, 'info'); }
}
function dailyAIWars() {
  const live = livingRealms().filter(f => !f.subjugated);
  for (const f of live) {
    if (f.aiWar) {
      const e = fac(f.aiWar);
      if (!e || e.dead || e.subjugated || e.aiWar !== f.id) { f.aiWar = null; continue; }
      if (f.id < e.id) aiWarDay(f, e);
      continue;
    }
    const aggr = { aggressive: 0.02, expansionist: 0.018, proud: 0.01, mercantile: 0.004, peaceful: 0.002 }[f.personality] || 0.01;
    if (Math.random() < aggr && G.time.day > 25) {
      const ns = live.filter(o => o !== f && !o.aiWar && borderTilesWith(f.id, o.id).length > 0);
      if (ns.length) aiWarStart(f, ns.sort((x, y) => facStrength(x) - facStrength(y))[0]);
    }
  }
}
function aiWarDay(a, b) {
  a.aiWarDays = (a.aiWarDays || 0) + 1;
  const sa = facStrength(a) * rand(0.7, 1.3), sb = facStrength(b) * rand(0.7, 1.3);
  const w = sa > sb ? a : b, l = w === a ? b : a;
  const bt = borderTilesWith(l.id, w.id).filter(t => !(t.x === l.cap.x && t.y === l.cap.y));
  for (let k = 0; k < Math.min(bt.length, randi(1, 3)); k++) { const t = bt.splice(randi(0, bt.length - 1), 1)[0]; G.tiles.owner[idx(t.x, t.y)] = w.id; }
  if (bt.length) R.territoryDirty = true;
  l.troops = Math.max(0, l.troops - 0.6); w.troops = Math.max(0, w.troops - 0.25);
  recountTiles();
  const ratio = facStrength(w) / Math.max(0.5, facStrength(l));
  if (l.tiles <= 6 || (ratio > 2.4 && Math.random() < 0.06)) return aiTakeCapital(w, l);
  if (a.aiWarDays > 45 || (a.aiWarDays > 12 && Math.random() < 0.025)) aiWarEnd(a, b, `${a.name} and ${b.name} made peace.`);
}
function aiTakeCapital(w, l) {
  const cx = l.cap.x, cy = l.cap.y;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy; if (ownerAt(x, y) === l.id && Math.hypot(dx, dy) <= 3.2) G.tiles.owner[idx(x, y)] = w.id; }
  G.tiles.deco[idx(cx, cy)] = 5; w.towns = w.towns || []; w.towns.push({ x: cx, y: cy });
  recountTiles(); R.territoryDirty = true;
  aiWarEnd(w, l, null);
  const rest = []; for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === l.id) rest.push(i);
  if (rest.length >= 6) {
    let best = rest[0], bd = 1e9; for (const i of rest) { const x = i % MAP_W, y = (i / MAP_W) | 0, d = dist(x, y, cx, cy); if (d < bd && TERRAIN[G.tiles.terrain[i]].build) { bd = d; best = i; } }
    l.cap = { x: best % MAP_W, y: (best / MAP_W) | 0 }; G.tiles.deco[best] = 3; l.troops = Math.max(2, l.troops * 0.5);
    history(`${w.name} sacked the capital of ${l.name}, who fled to a new seat.`, '🔥');
    addLog(`🔥 ${w.name} captured the capital of ${l.name}! ${l.name} fights on from a new capital.`, 'info');
  } else {
    for (const i of rest) G.tiles.owner[i] = w.id;
    killFaction(l, `${l.name} fell to ${w.name}.`);
  }
  recountTiles(); R.territoryDirty = true;
}
function killFaction(f, why) {
  if (f.dead) return;
  f.dead = true; f.war = false; f.aiWar = null; f.pact = null; f.subjugated = false;
  for (const a of G.armies) if (a.owner === f.id) a.dead = true;
  for (const o of G.factions) if (o.aiWar === f.id) o.aiWar = null;
  history(why || `${f.name} has vanished from history.`, '💀');
  addLog(`💀 ${why || `${f.name} has vanished from history.`}`, 'bad');
  toast(`💀 ${why || f.name + ' has fallen.'}`);
}

// ---------- The rise of new realms ----------
function migrantSite() {
  let best = null, bs = 0;
  const centres = [G.cap, ...livingRealms().map(f => f.cap), ...G.villages.filter(v => !v.dead).map(v => v.cap)];
  for (let t = 0; t < 500; t++) {
    const x = randi(4, MAP_W - 5), y = randi(4, MAP_H - 5), i = idx(x, y);
    if (G.tiles.owner[i] !== -1 || ![T.GRASS, T.MEADOW].includes(G.tiles.terrain[i])) continue;
    if (centres.some(c => dist(c.x, c.y, x, y) < 9)) continue;
    let free = 0, mine = false;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const o = G.tiles.owner[idx(nx, ny)]; if (o === 0) mine = true; if (o === -1 && TERRAIN[G.tiles.terrain[idx(nx, ny)]].build) free++; }
    if (mine || free < 26) continue;
    if (free > bs) { bs = free; best = { x, y }; }
  }
  return best;
}
function riseMigrants() {
  const s = migrantSite(); if (!s) return false;
  const pers = pick(['aggressive', 'expansionist', 'proud', 'mercantile', 'peaceful']);
  const f = makeFaction({ x: s.x, y: s.y, personality: pers, era: Math.max(1, topEra() - 1), troops: 8 + curEra() * 2 });
  G.tiles.terrain[idx(s.x, s.y)] = T.GRASS; R.dirtyTiles.push(idx(s.x, s.y));
  claimAround(f.id, s.x, s.y, 3.2); G.tiles.deco[idx(s.x, s.y)] = 3; decorateAI(f.id);
  recountTiles(); R.territoryDirty = true;
  const how = pers === 'aggressive' ? 'A warlike horde' : pers === 'mercantile' ? 'A band of merchant-settlers' : 'A wandering people';
  history(`${how} settled the wilds and founded ${f.name}.`, '🧭');
  addLog(`🧭 ${how} has settled the wilds and founded <b>${f.name}</b> (${GOVS[f.gov].name}).`, 'info');
  toast(`🧭 A new realm rises: ${f.name}`);
  return true;
}
function riseVillage() {
  const vs = G.villages.filter(v => !v.dead && v.pop >= 6 && v.tiles >= 5);
  if (!vs.length) return false;
  const v = pick(vs);
  const f = makeFaction({ id: v.id, x: v.cap.x, y: v.cap.y, era: Math.max(1, topEra() - 1), troops: Math.round(v.troops + 4), personality: pick(['peaceful', 'mercantile', 'proud', 'expansionist']) });
  f.name = `${pick(['Kingdom', 'Free City', 'Republic', 'Duchy', 'League'])} of ${v.name}`;
  v.dead = true; G.tiles.deco[idx(v.cap.x, v.cap.y)] = 3; decorateAI(f.id);
  recountTiles(); R.territoryDirty = true;
  history(`The village of ${v.name} grew into ${f.name}.`, '🌱');
  addLog(`🌱 The village of ${v.name} has grown into a realm: <b>${f.name}</b>.`, 'info');
  toast(`🌱 ${v.name} rises as ${f.name}`);
  return true;
}
function secede(parent) {
  // the province farthest from the capital breaks away
  const own = []; for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === parent.id) own.push(i);
  let seed = null, sd = 0;
  for (const i of own) { if (!TERRAIN[G.tiles.terrain[i]].build) continue; const x = i % MAP_W, y = (i / MAP_W) | 0, d = dist(x, y, parent.cap.x, parent.cap.y); if (d > sd) { sd = d; seed = { x, y }; } }
  if (!seed || sd < 7) return false;
  const part = own.filter(i => { const x = i % MAP_W, y = (i / MAP_W) | 0; return dist(x, y, seed.x, seed.y) < dist(x, y, parent.cap.x, parent.cap.y) * 0.85; });
  if (part.length < 10) return false;
  let cx = 0, cy = 0; for (const i of part) { cx += i % MAP_W; cy += (i / MAP_W) | 0; } cx /= part.length; cy /= part.length;
  let cap = part[0], bd = 1e9; for (const i of part) { if (!TERRAIN[G.tiles.terrain[i]].build) continue; const d = dist(i % MAP_W, (i / MAP_W) | 0, cx, cy); if (d < bd) { bd = d; cap = i; } }
  const share = part.length / own.length;
  const f = makeFaction({ x: cap % MAP_W, y: (cap / MAP_W) | 0, era: parent.era || 1, troops: Math.round(parent.troops * share * 0.9 + 3), personality: pick(['aggressive', 'proud', 'expansionist', 'mercantile']) });
  parent.troops *= 1 - share * 0.7;
  for (const i of part) G.tiles.owner[i] = f.id;
  G.tiles.deco[cap] = 3;
  const wasVassal = parent.subjugated;
  recountTiles(); R.territoryDirty = true;
  if (!wasVassal) aiWarStart(f, parent);
  history(`Civil war! ${f.name} broke away from ${parent.name}.`, '🔥');
  addLog(`🔥 Civil war in ${parent.name}: its far provinces declare independence as <b>${f.name}</b>!`, 'info');
  toast(`🔥 ${f.name} breaks away from ${parent.name}`);
  return true;
}
function foundNewVillage() {
  const s = migrantSite(); if (!s) return false;
  if (!G.nextVid) G.nextVid = 1000;
  const used = new Set(G.villages.map(v => v.name));
  const name = VILLAGE_NAMES.find(n => !used.has(n)) || placeName();
  const v = { id: G.nextVid++, name, minor: true, color: '#a08a64', leader: 'Elder ' + pick(FIRST_NAMES), cap: { x: s.x, y: s.y }, troops: 3 + G.time.day / 40, quality: 1, war: false, pop: randi(3, 5), tiles: 0, relation: 0, dead: false };
  G.tiles.terrain[idx(s.x, s.y)] = T.GRASS; R.dirtyTiles.push(idx(s.x, s.y));
  claimAround(v.id, s.x, s.y, 1.9);
  G.villages.push(v); decorateVillage(v); recountTiles(); R.territoryDirty = true;
  addLog(`🏘️ Settlers founded the village of ${v.name} in the wilds.`, 'info');
  return true;
}
function dailyRise() {
  if (!G.nextRise) G.nextRise = 40;
  if (G.time.day >= G.nextRise) {
    G.nextRise = G.time.day + randi(26, 46);
    const free = livingRealms().filter(f => !f.subjugated).length;
    if (free < 10) {
      const opts = [];
      if (G.villages.some(v => !v.dead && v.pop >= 6 && v.tiles >= 5)) opts.push([riseVillage, 3]);
      opts.push([riseMigrants, free < 4 ? 6 : 3]);
      const big = G.factions.filter(f => !f.dead && f.tiles >= 55 && !f.aiWar);
      if (big.length) opts.push([() => secede(pick(big)), 1.5 + big.length]);
      // try options in weighted random order until one works
      while (opts.length) {
        let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, k = 0;
        for (; k < opts.length; k++) { r -= opts[k][1]; if (r <= 0) break; }
        const [fn] = opts.splice(Math.min(k, opts.length - 1), 1)[0];
        if (fn()) break;
      }
    }
  }
  if (!G.nextVillage) G.nextVillage = 30;
  if (G.time.day >= G.nextVillage) { G.nextVillage = G.time.day + randi(18, 32); if (G.villages.filter(v => !v.dead).length < 9) foundNewVillage(); }
}

// ---------- Vassal unrest: subjugated realms may rise against you ----------
function dailyVassals() {
  for (const f of G.factions) {
    if (f.dead || !f.subjugated) continue;
    const strong = facStrength(f) > playerStrength() * 0.8;
    f.unrest = clamp((f.unrest || 0) + 0.3 + (strong ? 1.6 : 0) + (anyWar() ? 0.6 : 0) - (f.relation > 40 ? 0.8 : 0) - (G.gov === 'feudalism' ? 0.4 : 0), 0, 100);
    if (f.unrest >= 100) {
      f.subjugated = false; f.unrest = 0; f.relation = -40;
      history(`${f.name} threw off the rule of ${G.realm.name}.`, '⛓️');
      addLog(`⛓️ ${f.name} has risen in revolt against you!`, 'bad'); toast(`⛓️ ${f.name} revolts!`);
      aiDeclareWar(f);
    }
  }
}
function placateVassal(f) {
  const c = { influence: 20 + 5 * curEra(), gold: 20 * curEra() };
  if (!canAfford(c)) return toast(`Placating them costs ${costStr(c)}`);
  pay(c); f.unrest = Math.max(0, (f.unrest || 0) - 40); f.relation += 8;
  addLog(`🎁 You showered ${f.name} with honours. Their unrest eases.`, 'good');
  return true;
}

// ---------- Domination victory ----------
let _landTiles = 0;
function landTiles() { if (!_landTiles) for (let i = 0; i < G.tiles.terrain.length; i++) if (TERRAIN[G.tiles.terrain[i]].pass) _landTiles++; return _landTiles; }
function dominationShare() {
  let n = 0; const vas = new Set(G.factions.filter(f => f.subjugated && !f.dead).map(f => f.id));
  for (let i = 0; i < G.tiles.owner.length; i++) { const o = G.tiles.owner[i]; if ((o === 0 || vas.has(o)) && TERRAIN[G.tiles.terrain[i]].pass) n++; }
  return n / Math.max(1, landTiles());
}

// ---------- Daily upkeep for all of the above ----------
function dailyAges() {
  for (const k of ['upheaval', 'blackout', 'heat', 'strike', 'smogShut']) if (G[k] > 0) G[k]--;
  for (const b of Object.values(G.buildings)) if (b.ruined > 0 && --b.ruined <= 0) { b.ruined = 0; addLog(`🔧 The ${B[b.type].name} is repaired.`, 'info'); }
  for (const f of G.factions) if (!f.dead) aiDevelop(f);
  dailyAIWars();
  for (const f of G.factions) if (!f.dead && f.tiles <= 0 && G.time.day > 2) killFaction(f, `${f.name} has vanished from the map.`);
  dailyRise();
  dailyVassals();
  if (!G.victory.domination && G.time.day % 5 === 0 && dominationShare() >= 0.45) { G.victory.domination = true; queueEvent('victoryDomination', {}); }
  if (G.power && G.power.ratio < 0.7 && G.power.dem > 2) addMod('Power cuts', -4, 1);
}
EVENTS.victoryDomination = { make: () => ({ title: '👑 Domination Victory!', icon: '👑', text: `${G.realm.name} and its vassals now hold nearly half of all the land. No realm can stand against you.<br><br><b>You have achieved a Domination Victory!</b> You may keep playing — new realms will keep rising.`, choices: [{ label: 'Long live the realm', fn: () => { } }] }) };
EVENTS.victoryArk = { make: () => ({ title: '🚀 Science Victory!', icon: '🚀', text: `The Starship Ark thunders into the sky, carrying the dreams of ${G.realm.name} to the stars.<br><br><b>You have achieved a Science Victory!</b> You may keep playing.`, choices: [{ label: 'To the stars', fn: () => { } }] }) };
