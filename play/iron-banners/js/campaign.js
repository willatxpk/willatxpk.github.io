// Iron Banners — grand campaign model and AI
'use strict';

const Camp = (() => {
  let G = null;
  let UNIT_ID = 1;
  const SAVE_KEY = 'ironbanners_campaign_v1';
  const rand = () => Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MAX_STACK = 10;

  // ---------- hex math (odd-r offset, pointy top)
  function nbrs(c, r) {
    const odd = r & 1;
    const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
    return d.map(([dc, dr]) => [c + dc, r + dr]).filter(([x, y]) => x >= 0 && y >= 0 && x < G.map.cols && y < G.map.rows);
  }
  const idx = (c, r) => r * G.map.cols + c;
  const hexAt = (c, r) => G.map.hexes[idx(c, r)];
  const adjHexes = h => nbrs(h.c, h.r).map(([c, r]) => hexAt(c, r));
  function toCube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, r, -x - r]; }
  function dist(a, b) { const [x1, y1, z1] = toCube(a.c, a.r), [x2, y2, z2] = toCube(b.c, b.r); return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2)); }
  const isLand = h => h && h.terr !== 'sea';
  const passable = h => h && TERRAIN[h.terr].pass !== false;

  // ---------- new game
  function newGame(o) {
    const cols = o.size === 'large' ? 19 : 16, rows = o.size === 'large' ? 14 : 12;
    const landTarget = o.size === 'large' ? 150 : 100;
    G = { v: 1, turn: 1, cur: 0, map: { cols, rows, hexes: [] }, nations: [], log: [], dice: [3, 4], diff: o.diff || 'normal', turnLimit: o.turnLimit || 0, over: false, winner: null, pendingEvent: null, phase: 'roll' };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) G.map.hexes.push({ i: idx(c, r), c, r, terr: 'sea', num: 0, owner: null, b: null, fort: false, market: false, academy: false, bandit: false, army: [] });
    // grow a continent
    const start = hexAt(Math.floor(cols / 2), Math.floor(rows / 2));
    start.terr = 'land';
    const land = [start];
    let guard = 0;
    while (land.length < landTarget && guard++ < 20000) {
      const h = pick(land);
      const cand = nbrs(h.c, h.r).map(([c, r]) => hexAt(c, r)).filter(x => x.terr === 'sea' && x.c > 0 && x.r > 0 && x.c < cols - 1 && x.r < rows - 1);
      if (!cand.length) continue;
      const x = pick(cand);
      const dx = (x.c - cols / 2) / cols, dy = (x.r - rows / 2) / rows;
      if (rand() < 0.35 + Math.sqrt(dx * dx + dy * dy) * 1.2) continue; // bias to compact shape
      x.terr = 'land'; land.push(x);
    }
    // terrains
    const bag = [];
    const mix = { plains: 24, forest: 20, hills: 17, pasture: 17, gold: 9, desert: 8, mountain: 5 };
    for (const [t, n] of Object.entries(mix)) for (let i = 0; i < n; i++) bag.push(t);
    land.forEach(h => { h.terr = pick(bag); });
    // numbers
    const tokens = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
    let tk = shuffle(tokens.slice());
    land.forEach(h => { if (h.terr === 'mountain') return; if (!tk.length) tk = shuffle(tokens.slice()); h.num = tk.pop(); });
    // nations
    const human = NATIONS.find(n => n.id === o.nation) || NATIONS[0];
    const others = shuffle(NATIONS.filter(n => n !== human)).slice(0, (o.rivals || 3));
    const roster = [human, ...others];
    // capitals: farthest-point sampling on good land
    const good = land.filter(h => h.terr !== 'mountain' && adjHexes(h).filter(isLand).length >= 4);
    const caps = [pick(good)];
    while (caps.length < roster.length) {
      let best = null, bd = -1;
      for (const h of good) { const d = Math.min(...caps.map(c => dist(c, h))); if (d > bd) { bd = d; best = h; } }
      caps.push(best);
    }
    roster.forEach((n, i) => {
      const cap = caps[i];
      const N = { i, id: n.id, name: n.name, color: n.color, human: i === 0, res: { F: 3, T: 3, I: 2, H: 2, G: 1, O: 0 }, sci: 0, techs: [], era: 1, research: null, alive: true, capital: cap.i, doctrine: n.doctrine,
        rel: {}, won: 0, lost: 0, personality: i === 0 ? null : pick(['aggressive', 'balanced', 'builder']), intel: {} };
      if (n.id === 'macedon') N.techs.push('riding');
      G.nations.push(N);
      cap.terr = 'plains'; cap.num = pick([6, 8, 5, 9]);
      cap.owner = i; cap.b = 'city';
      const fix = ['forest', 'hills', 'pasture', 'plains', 'gold'];
      adjHexes(cap).filter(h => isLand(h) && h.owner == null).slice(0, 5).forEach((h, k) => {
        if (k < fix.length) { h.terr = fix[k]; if (!h.num) h.num = pick([4, 5, 6, 8, 9, 10]); }
        if (k < 3) h.owner = i;
      });
      cap.army = [mkUnit('levy'), mkUnit('warband'), mkUnit('slinger')];
    });
    G.nations.forEach(a => G.nations.forEach(b => { if (a !== b) a.rel[b.i] = { state: 'war', until: 0 }; }));
    log(`The age of empires begins. You lead ${G.nations[0].name}.`, 0);
    save();
    return G;
  }

  function mkUnit(t, o = {}) { return { id: UNIT_ID++, t, str: o.str ?? 100, exp: o.exp || 0, moved: !!o.moved }; }
  function log(text, who = null, kind = '') { G.log.push({ turn: G.turn, text, who, kind }); if (G.log.length > 300) G.log.shift(); }

  // ---------- queries
  const nation = i => G.nations[i];
  const human = () => G.nations[0];
  const owned = i => G.map.hexes.filter(h => h.owner === i);
  const cities = i => G.map.hexes.filter(h => h.owner === i && h.b === 'city');
  function unitsUnlocked(N) {
    const set = new Set(START_UNITS);
    N.techs.forEach(t => TECHS.find(x => x.id === t).units.forEach(u => set.add(u)));
    return [...set].filter(id => U[id] && !U[id].hidden).sort((a, b) => U[a].era - U[b].era || U[a].br - U[b].br);
  }
  function doctrinesUnlocked(N) {
    const set = new Set(['none', N.doctrine]);
    N.techs.forEach(t => TECHS.find(x => x.id === t).doctrines.forEach(d => set.add(d)));
    return [...set];
  }
  function unitCost(N, t) {
    const c = Object.assign({}, U[t].cost);
    if (N.id === 'rome' && c.I) c.I = Math.max(1, c.I - 1);
    if (N.id === 'russia' && c.F) c.F = Math.max(1, c.F - 1);
    return c;
  }
  const canPay = (N, cost) => Object.entries(cost).every(([k, v]) => (N.res[k] || 0) >= v);
  const pay = (N, cost) => Object.entries(cost).forEach(([k, v]) => N.res[k] -= v);
  const gain = (N, g) => Object.entries(g).forEach(([k, v]) => N.res[k] = (N.res[k] || 0) + v);
  const costTxt = c => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${v}${RES[k].icon}`).join(' ');
  function hasTech(N, id) { return N.techs.includes(id); }
  function supplied(h) {
    if (h.owner == null) return 0;
    if (h.b === 'city') return 2;
    let lvl = h.b === 'settlement' ? 1 : 0;
    for (const n of adjHexes(h)) if (n.owner === h.owner && n.b) lvl = Math.max(lvl, n.b === 'city' ? 2 : 1);
    return lvl;
  }
  function yieldOf(h) {
    if (h.bandit || !h.num) return null;
    const res = TERRAIN[h.terr].res; if (!res) return null;
    const N = nation(h.owner); if (!N) return null;
    if (res === 'O' && !hasTech(N, 'combustion')) return null;
    let amt = supplied(h); if (!amt) return null;
    if (N.id === 'mongols' && res === 'H') amt += 1;
    if (N.id === 'england' && res === 'T') amt += 1;
    if (N.id === 'germany' && res === 'I') amt += 1;
    return { res, amt };
  }
  function scienceOf(i) {
    const N = nation(i); let s = 0;
    for (const h of owned(i)) { if (h.b === 'city') s += 1 + (N.id === 'france' ? 1 : 0) + (N.capital === h.i ? 1 : 0); if (h.academy) s += 2; }
    return s;
  }
  function armyCount(i) { return G.map.hexes.reduce((a, h) => a + (h.owner === i ? h.army.length : 0), 0); }
  function upkeep(i) { return Math.floor(armyCount(i) / 3); }
  function strength(i) { return G.map.hexes.reduce((a, h) => a + (h.owner === i ? h.army.reduce((s, u) => s + (U[u.t].atk + U[u.t].def) * u.str / 100 * (1 + 0.06 * u.exp), 0) : 0), 0); }
  function score(i) { const N = nation(i); return owned(i).length + cities(i).length * 3 + N.techs.length * 2 + N.won * 2 + N.era * 5; }

  function natMods(N) {
    const m = { atk: {}, def: {} };
    if (N.id === 'rome') { m.def.inf = 1.1; m.def.pike = 1.1; }
    if (N.id === 'macedon') m.atk.hcav = 1.15;
    if (N.id === 'england') m.atk.missile = 1.15;
    if (N.id === 'france') m.atk.art = 1.2;
    if (N.id === 'germany') m.atk.armor = 1.1;
    if (G.diff === 'hard' && !N.human) m.atk.all = 1.08;
    return m;
  }

  // ---------- dice & production
  function rollDice() {
    const a = 1 + Math.floor(rand() * 6), b = 1 + Math.floor(rand() * 6);
    G.dice = [a, b];
    const n = a + b;
    const got = G.nations.map(() => ({}));
    if (n !== 7) {
      for (const h of G.map.hexes) if (h.num === n && h.owner != null) {
        const y = yieldOf(h); if (!y) continue;
        got[h.owner][y.res] = (got[h.owner][y.res] || 0) + y.amt;
      }
      G.nations.forEach((N, i) => gain(N, got[i]));
      // difficulty: AI bonus
      if (G.diff !== 'easy') G.nations.forEach(N => { if (!N.human && N.alive && rand() < (G.diff === 'hard' ? 0.55 : 0.2)) { const r = pick(['F', 'T', 'I', 'H', 'G']); N.res[r]++; } });
    }
    return { n, got };
  }

  // spoilage (anti-hoarding, like the robber rule): over 20 resources, lose a quarter of the largest pile
  function spoil(N) {
    const tot = RES_KEYS.reduce((a, k) => a + (N.res[k] || 0), 0);
    if (tot <= 20) return null;
    const k = RES_KEYS.slice().sort((a, b) => N.res[b] - N.res[a])[0];
    const lose = Math.ceil(N.res[k] / 4); N.res[k] -= lose;
    return { k, lose };
  }

  // per-turn upkeep for the nation whose turn begins
  function turnStart(i) {
    const N = nation(i);
    N.sci += scienceOf(i);
    const goldInc = cities(i).length;
    N.res.G += goldInc;
    // research completes automatically
    checkResearch(N);
    // upkeep
    const need = upkeep(i);
    if (need) {
      if (N.res.F >= need) N.res.F -= need;
      else {
        const short = need - N.res.F; N.res.F = 0;
        G.map.hexes.filter(h => h.owner === i).forEach(h => h.army.forEach(u => u.str = Math.max(20, u.str - 4 * short)));
        if (N.human) log(`Not enough food to feed the army: all units lose strength. (Upkeep: 1 Food per 3 units)`, i, 'bad');
      }
    }
    // healing & reset movement
    for (const h of G.map.hexes) if (h.owner === i) for (const u of h.army) {
      u.moved = false;
      const heal = (h.b === 'city' ? 25 : 10) * (N.id === 'russia' ? 2 : 1);
      u.str = Math.min(100, u.str + heal);
    }
    // treaties expire
    for (const k in N.rel) { const r = N.rel[k]; if (r.state === 'peace' && G.turn >= r.until) { r.state = 'war'; nation(k).rel[i].state = 'war'; if (N.human || nation(k).human) log(`The treaty between ${N.name} and ${nation(k).name} has expired. You are at war again.`, i, 'bad'); } }
  }

  function checkResearch(N) {
    if (!N.research) return;
    const t = TECHS.find(x => x.id === N.research);
    const cost = techCost(N, t);
    if (N.sci >= cost) {
      N.sci -= cost; N.techs.push(t.id); N.research = null;
      log(`${N.name} masters ${t.name}${t.units.length ? ': ' + t.units.map(u => U[u].name).join(', ') : ''}.`, N.i, N.human ? 'good' : '');
      const done = N.techs.filter(x => TECHS.find(y => y.id === x).era === N.era).length;
      if (done >= 3 && N.era < 5) { N.era++; log(`${N.name} enters the ${ERAS[N.era].name} era!`, N.i, 'era'); }
    }
  }
  // bigger empires pay more per tech (as in Civ), so conquest alone does not race you through the ages
  function techCost(N, t) { return Math.round(TECH_COST[t.era] * (1 + 0.05 * Math.max(0, cities(N.i).length - 2)) * (G.diff === 'hard' && !N.human ? 0.85 : 1)); }
  function availableTechs(N) { return TECHS.filter(t => t.era <= N.era && !N.techs.includes(t.id)); }
  function setResearch(N, id) { N.research = id; checkResearch(N); }

  // ---------- building
  function canSettle(N, h) {
    if (h.owner !== N.i || h.b || !passable(h)) return false;
    return !adjHexes(h).some(n => n.b); // distance rule
  }
  function build(N, h, what) {
    const def = BUILD[what];
    if (!canPay(N, def.cost)) return 'Not enough resources.';
    if (what === 'settlement' && !canSettle(N, h)) return 'Settlements need an owned hex with no settlement or city next to it.';
    if (what === 'city' && (h.owner !== N.i || h.b !== 'settlement')) return 'Upgrade one of your settlements.';
    if (what === 'fort' && (h.owner !== N.i || h.fort)) return 'Already fortified.';
    if ((what === 'market' || what === 'academy') && (h.owner !== N.i || h.b !== 'city' || h[what])) return 'Needs one of your cities.';
    pay(N, def.cost);
    if (what === 'settlement' || what === 'city') h.b = what; else h[what] = true;
    log(`${N.name} builds a ${def.name.toLowerCase()}${N.human ? '' : ' at ' + hexName(h)}.`, N.i, N.human ? 'good' : '');
    return null;
  }
  function recruit(N, h, t) {
    if (h.owner !== N.i || h.b !== 'city') return 'Recruit in your cities.';
    if (h.army.length >= MAX_STACK) return `A hex holds at most ${MAX_STACK} units.`;
    if (!unitsUnlocked(N).includes(t)) return 'Not researched.';
    const c = unitCost(N, t);
    if (!canPay(N, c)) return 'Not enough resources.';
    pay(N, c);
    h.army.push(mkUnit(t, { moved: true }));
    return null;
  }
  function tradeRate(N, k) {
    let r = N.id === 'carthage' ? 3 : 4;
    for (const h of cities(N.i)) if (h.market) { r = Math.min(r, 3); if (TERRAIN[h.terr].res === k) r = 2; }
    return r;
  }
  function bankTrade(N, give, get) {
    const r = tradeRate(N, give);
    if (N.res[give] < r) return 'Not enough to trade.';
    N.res[give] -= r; N.res[get]++;
    return null;
  }
  function aiAcceptsTrade(A, give, giveN, get, getN) { // player gives `give`, wants `get` from AI A
    if (A.res[get] < getN + 1) return false;
    if (A.rel[0]?.state === 'war' && strength(0) > strength(A.i) * 1.3) return false;
    const value = giveN * (A.res[give] < 2 ? 1.6 : 1) - getN * (A.res[get] > 4 ? 0.7 : 1.1);
    return value >= 0.4 || (value > -0.3 && rand() < 0.3);
  }

  // ---------- moves & battles
  function movesFor(h) { // all-mounted Mongol stacks move 2
    const N = nation(h.owner);
    const fast = N.id === 'mongols' && h.army.length && h.army.every(u => ['lcav', 'hcav'].includes(U[u.t].cls));
    return fast ? 2 : 1;
  }
  function reachable(h) {
    const out = new Set();
    const range = movesFor(h);
    let frontier = [h]; const seen = new Set([h.i]);
    for (let step = 0; step < range; step++) {
      const next = [];
      for (const f of frontier) for (const n of adjHexes(f)) {
        if (seen.has(n.i) || !passable(n)) continue;
        seen.add(n.i); out.add(n);
        if (n.owner === h.owner || n.owner == null) next.push(n); // can pass through own/neutral
      }
      frontier = next.filter(x => x.owner === h.owner || (x.owner == null && !x.army.length));
    }
    return [...out];
  }
  function atWar(a, b) { return a !== b && nation(a).rel[b]?.state === 'war'; }

  // move units (array of unit ids) from hex a to hex b. Returns {battle} if a fight is needed.
  function move(a, b, ids) {
    const N = nation(a.owner);
    const units = a.army.filter(u => ids.includes(u.id) && !u.moved);
    if (!units.length) return { err: 'Those units have already moved this turn.' };
    if (!reachable(a).includes(b)) return { err: 'Out of reach.' };
    if (b.owner === N.i) {
      if (b.army.length + units.length > MAX_STACK) return { err: `Stack limit is ${MAX_STACK}.` };
      a.army = a.army.filter(u => !units.includes(u)); units.forEach(u => u.moved = true); b.army.push(...units);
      if (b.bandit) { b.bandit = false; log(`Your troops clear the raiders from ${hexName(b)}.`, N.i, 'good'); }
      return { ok: true };
    }
    if (b.owner != null && !atWar(N.i, b.owner)) return { err: `You are at peace with ${nation(b.owner).name}.` };
    if (b.owner == null || !b.army.length) {
      const prev = b.owner;
      a.army = a.army.filter(u => !units.includes(u)); units.forEach(u => u.moved = true); b.army.push(...units);
      capture(N.i, b, prev);
      return { ok: true, captured: true };
    }
    return { battle: { att: N.i, def: b.owner, from: a, to: b, units } };
  }

  function capture(i, h, prev) {
    const N = nation(i);
    h.owner = i; h.bandit = false;
    if (prev != null) {
      const P = nation(prev);
      log(`${N.name} captures ${hexName(h)}${h.b ? ` and its ${h.b}` : ''} from ${P.name}.`, i, N.human ? 'good' : P.human ? 'bad' : '');
      if (P.capital === h.i) {
        log(`${P.name}'s capital has fallen!`, i, 'era');
        const other = cities(prev)[0];
        P.capital = other ? other.i : null;
        // plunder
        const loot = {}; RES_KEYS.forEach(k => { const l = Math.floor((P.res[k] || 0) / 2); loot[k] = l; P.res[k] -= l; }); gain(N, loot);
      }
      checkElim(prev);
    }
  }
  function checkElim(i) {
    const P = nation(i);
    if (!P.alive) return;
    if (!cities(i).length && !G.map.hexes.some(h => h.owner === i && h.b === 'settlement')) {
      P.alive = false;
      log(`${P.name} has been destroyed.`, i, 'era');
      G.map.hexes.forEach(h => { if (h.owner === i) { h.owner = null; h.army = []; } });
      checkVictory();
    }
  }
  function checkVictory() {
    const alive = G.nations.filter(n => n.alive);
    if (!human().alive) { G.over = true; G.winner = null; G.endText = `${human().name} has fallen. Rivals divide your lands.`; }
    else if (alive.length === 1) { G.over = true; G.winner = 0; G.endText = `Every rival has fallen. ${human().name} rules the known world.`; }
    else if (G.turnLimit && G.turn > G.turnLimit) {
      const best = alive.slice().sort((a, b) => score(b.i) - score(a.i))[0];
      G.over = true; G.winner = best.i; G.endText = best.human ? `The age ends with ${best.name} the greatest power on earth (score ${score(best.i)}).` : `The age ends. ${best.name} is the greatest power (score ${score(best.i)}).`;
    }
  }

  // build a Battle config for a campaign fight. Side 0 = attacker, side 1 = defender.
  function battleCfg(bt, opt = {}) {
    const A = nation(bt.att), D = nation(bt.def), h = bt.to;
    const tf = TERRAIN[h.terr].battle || [];
    const sectors = [0, 1, 2].map(s => {
      const terrain = tf.slice();
      if (h.fort || (h.b === 'city' && s === 1)) terrain.push('fort');
      const own = terrain.some(t => ['hill', 'fort', 'river'].includes(t)) ? 1 : null;
      return { name: ['North approach', h.b === 'city' ? 'The city' : 'Center', 'South approach'][s], terrain, owner: own, note: TERRAIN[h.terr].name };
    });
    const dep = (units, side) => autoDeploy(units).map(([u, sec]) => [u.t, sec, { str: u.str, exp: u.exp, ref: u.id, name: U[u.t].name }]);
    const era = Math.max(A.era, D.era);
    return {
      id: 'camp', name: `Battle of ${hexName(h)}`, era, sectors, maxRounds: 8, defender: 1, histAI: false,
      sides: [
        { name: A.name, commander: A.name, color: A.color, doctrine: opt.attDoctrine || A.doctrine, units: dep(bt.units, 0), mods: natMods(A), men: bt.units.length * 5000, startDisorder: 0 },
        { name: D.name, commander: D.name, color: D.color, doctrine: opt.defDoctrine || D.doctrine, units: dep(h.army, 1), mods: natMods(D), men: h.army.length * 5000, startDisorder: A.intel[D.i] ? 1 : 0 },
      ],
    };
  }
  function autoDeploy(units) {
    const sorted = units.slice().sort((a, b) => (U[b.t].atk + U[b.t].def) * b.str - (U[a.t].atk + U[a.t].def) * a.str);
    const out = []; const order = [1, 0, 2];
    const reserveN = units.length >= 5 ? Math.floor(units.length / 4) : 0;
    const mobile = sorted.filter(u => ['hcav', 'lcav', 'armor'].includes(U[u.t].cls));
    const res = new Set(mobile.slice(0, reserveN));
    let k = 0;
    for (const u of sorted) {
      if (res.has(u)) { out.push([u, 'R']); continue; }
      out.push([u, order[k++ % 3]]);
    }
    if (res.size < reserveN) { // not enough mobile units: hold back the weakest melee too
      for (const e of out.slice().reverse()) { if (res.size >= reserveN) break; if (e[1] !== 'R' && !['missile', 'art'].includes(U[e[0].t].cls)) { e[1] = 'R'; res.add(e[0]); } }
    }
    return out;
  }

  // apply battle results back to the map
  function applyBattle(bt, B) {
    const A = nation(bt.att), D = nation(bt.def);
    const byRef = new Map(B.units.map(u => [u.ref, u]));
    const win = B.winner === 0;
    const survivors = (units, won) => units.filter(u => {
      const bu = byRef.get(u.id); if (!bu) return true;
      if (bu.status === 'destroyed') return false;
      let s = bu.str;
      if (bu.status === 'routed') s *= bu.retreated ? 0.95 : 0.7;
      u.str = Math.round(Math.max(0, s));
      if (won && bu.status === 'ok' && bu.dealt > 20 && rand() < 0.5) u.exp = Math.min(3, (u.exp || 0) + 1);
      return u.str >= 12;
    });
    const attSurv = survivors(bt.units, win);
    const defSurv = survivors(bt.to.army, !win);
    const killedA = bt.units.length - attSurv.length, killedD = bt.to.army.length - defSurv.length;
    bt.from.army = bt.from.army.filter(u => !bt.units.includes(u));
    if (win) {
      A.won++; D.lost++;
      // defenders retreat to an adjacent friendly hex if possible
      const fall = adjHexes(bt.to).find(n => n.owner === D.i && n.army.length + defSurv.length <= MAX_STACK);
      if (fall) { defSurv.forEach(u => u.moved = true); fall.army.push(...defSurv); }
      bt.to.army = attSurv; attSurv.forEach(u => u.moved = true);
      const prev = bt.to.owner;
      capture(A.i, bt.to, prev);
      if (A.intel[D.i]) delete A.intel[D.i];
    } else {
      D.won++; A.lost++;
      bt.to.army = defSurv;
      attSurv.forEach(u => u.moved = true);
      const back = bt.from.owner === A.i ? bt.from : null;
      if (back) back.army.push(...attSurv.slice(0, MAX_STACK - back.army.length));
    }
    log(`Battle of ${hexName(bt.to)}: ${win ? A.name : D.name} wins. ${A.name} loses ${killedA} unit${killedA === 1 ? '' : 's'}, ${D.name} loses ${killedD}.`, A.human || D.human ? 0 : null, (win && A.human) || (!win && D.human) ? 'good' : (A.human || D.human) ? 'bad' : '');
    return { win, killedA, killedD };
  }

  function hexName(h) {
    const N = h.owner != null ? nation(h.owner) : null;
    const base = TERRAIN[h.terr].name;
    if (h.b === 'city' && N && N.capital === h.i) return `${N.name} (capital)`;
    return `${h.b === 'city' ? 'the city in the ' : h.b === 'settlement' ? 'the settlement in the ' : 'the '}${base} (${h.c},${h.r})`;
  }

  // ---------- diplomacy
  function proposePeace(i, j) {
    const A = nation(i), Bn = nation(j);
    const sa = strength(i), sb = strength(j);
    const atWarElse = G.nations.some(n => n.alive && n.i !== i && n.i !== j && atWar(j, n.i) && strength(n.i) > sb * 0.6);
    const accept = sb < sa * 0.85 || (atWarElse && rand() < 0.6) || (Bn.personality === 'builder' && rand() < 0.5);
    if (accept) setPeace(i, j, 12);
    return accept;
  }
  function setPeace(i, j, turns) { nation(i).rel[j] = { state: 'peace', until: G.turn + turns }; nation(j).rel[i] = { state: 'peace', until: G.turn + turns }; log(`${nation(i).name} and ${nation(j).name} sign a peace treaty for ${turns} turns.`, i, 'note'); }

  // ---------- AI
  function aiPower(units) { return units.reduce((a, u) => a + (U[u.t].atk + U[u.t].def) * u.str / 100 * (1 + 0.06 * u.exp), 0); }

  async function aiTurn(i, hooks) {
    const N = nation(i);
    if (!N.alive) return;
    const wait = ms => new Promise(r => setTimeout(r, ms * SETTINGS.speed));
    // balance of power: when one nation dominates, the others settle their own quarrels and turn on it
    const ranked = G.nations.filter(n => n.alive).sort((a, b) => score(b.i) - score(a.i));
    const leader = ranked[0];
    const dominant = ranked.length > 2 && score(leader.i) > score(ranked[1].i) * 1.5;
    if (dominant && leader.i !== i) {
      for (const o of ranked) if (o.i !== i && o.i !== leader.i && !o.human && atWar(i, o.i)) { setPeace(i, o.i, 10); }
    }
    // research
    if (!N.research) {
      const av = availableTechs(N);
      if (av.length) {
        const want = av.slice().sort((a, b) => (b.era - a.era) * 2 + b.units.length - a.units.length + rand() - 0.5);
        N.research = want[0].id; checkResearch(N);
      }
    }
    // build: city > settlement > academy > fort
    for (let k = 0; k < 4; k++) {
      const sets = owned(i).filter(h => h.b === 'settlement');
      if (sets.length && canPay(N, BUILD.city.cost)) { build(N, best(sets, h => valueHex(h)), 'city'); continue; }
      const spots = owned(i).filter(h => canSettle(N, h));
      if (spots.length && canPay(N, BUILD.settlement.cost)) { build(N, best(spots, h => valueHex(h)), 'settlement'); continue; }
      const cs = cities(i).filter(h => !h.academy);
      if (cs.length && N.personality !== 'aggressive' && canPay(N, BUILD.academy.cost) && N.res.G > 3) { build(N, cs[0], 'academy'); continue; }
      const cap = G.map.hexes[N.capital];
      if (cap && cap.owner === i && !cap.fort && canPay(N, BUILD.fort.cost) && adjHexes(cap).some(n => n.owner != null && n.owner !== i)) { build(N, cap, 'fort'); continue; }
      break;
    }
    // trade surplus 4:1 for what's missing for a city or settlement
    for (let k = 0; k < 3; k++) {
      const surplus = RES_KEYS.filter(r => r !== 'O' && N.res[r] >= tradeRate(N, r) + 2).sort((a, b) => N.res[b] - N.res[a])[0];
      const need = ['I', 'F', 'T', 'H', 'G'].find(r => N.res[r] < 2);
      if (surplus && need && surplus !== need) bankTrade(N, surplus, need); else break;
    }
    // recruit
    const unl = unitsUnlocked(N);
    const targetArmy = 4 + Math.floor(G.turn / 3) + (N.personality === 'aggressive' ? 3 : 0) + Math.floor(RES_KEYS.reduce((a, k) => a + N.res[k], 0) / 12);
    let guard = 0;
    while (armyCount(i) < targetArmy && guard++ < 6) {
      const cs = cities(i).filter(h => h.army.length < MAX_STACK);
      if (!cs.length) break;
      const threat = best(cs, h => adjHexes(h).filter(n => n.owner != null && n.owner !== i).length * 3 - h.army.length);
      const opts = unl.filter(t => canPay(N, unitCost(N, t))).sort((a, b) => U[b].br - U[a].br + (rand() - 0.5) * 0.6);
      if (!opts.length) break;
      recruit(N, threat, opts[0]);
    }
    // military moves
    const stacks = owned(i).filter(h => h.army.some(u => !u.moved));
    for (const h of shuffle(stacks)) {
      if (!N.alive || G.over) break;
      if (h.owner !== i) continue;
      const free = h.army.filter(u => !u.moved);
      if (!free.length) continue;
      const garrison = h.b === 'city' ? 1 : 0;
      const targets = reachable(h).filter(n => n.owner !== i);
      // attack enemies
      let bestT = null, bestScore = 0;
      for (const t of targets) {
        if (t.owner != null && !atWar(i, t.owner)) continue;
        const myP = aiPower(free.slice(garrison ? 1 : 0)) || aiPower(free);
        const theirP = aiPower(t.army) * (1 + TERRAIN[t.terr].def + (t.fort ? 0.5 : 0) + (t.b === 'city' ? 0.25 : 0));
        let val = (t.b === 'city' ? 6 : t.b ? 3 : 1) + (t.owner != null && nation(t.owner).capital === t.i ? 6 : 0) + (t.owner == null ? 1.5 : 0) + (t.owner === 0 ? 0.5 : 0);
        const ratio = myP / (theirP + 0.1);
        if (dominant && t.owner === leader.i && leader.i !== i) val *= 1.6;
        const need = N.personality === 'aggressive' ? 1.3 : N.personality === 'builder' ? 2 : 1.6;
        if (!t.army.length) { const sc = val * 2; if (sc > bestScore) { bestScore = sc; bestT = t; } continue; }
        if (ratio > need) { const sc = val * Math.min(3, ratio); if (sc > bestScore) { bestScore = sc; bestT = t; } }
      }
      if (bestT) {
        let send = free;
        if (!bestT.army.length && free.length > 1) send = free.slice(0, Math.max(1, free.length - garrison - (free.length > 3 ? 1 : 0))).slice(0, bestT.owner == null ? 1 : 3);
        else if (garrison && free.length > 1 && h.army.length === free.length) send = free.slice(1);
        if (!send.length) continue;
        hooks?.focus?.(bestT);
        const r = move(h, bestT, send.map(u => u.id));
        if (r.battle) {
          if (r.battle.def === 0 && hooks?.defend) await hooks.defend(r.battle);
          else { const cfg = battleCfg(r.battle); const B = Battle.autoResolve(Battle.create(cfg)); applyBattle(r.battle, B); }
          await wait(350);
        } else if (r.ok) await wait(120);
        hooks?.redraw?.();
        continue;
      }
      // otherwise drift toward the frontier: move surplus units to own hex nearest an enemy
      if (free.length > 2 + garrison) {
        const front = targets.length ? null : reachable(h).filter(n => n.owner === i && n.army.length < MAX_STACK - 2)
          .sort((a, b) => frontierDist(a, i) - frontierDist(b, i))[0];
        if (front && frontierDist(front, i) < frontierDist(h, i)) move(h, front, free.slice(garrison + 1).map(u => u.id));
      }
    }
    // peace with the player when losing badly
    if (atWar(i, 0) && strength(i) < strength(0) * 0.5 && rand() < 0.25 && hooks?.offerPeace) await hooks.offerPeace(i);
    const sp = spoil(N);
  }
  function best(list, f) { let b = null, bv = -Infinity; for (const x of list) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; }
  function valueHex(h) { const p = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }; let v = p[h.num] || 0; for (const n of adjHexes(h)) if (n.owner === h.owner) v += (p[n.num] || 0) * 0.5; return v; }
  function frontierDist(h, i) { let d = 99; for (const x of G.map.hexes) if (x.owner != null && x.owner !== i && x.army.length >= 0 && isLand(x)) d = Math.min(d, dist(h, x)); return d; }

  // ---------- events (player rolled a 7)
  function makeEvent() {
    const N = human();
    const ev = pick(EVENTS);
    const myCities = cities(0); const myHexes = owned(0).filter(h => h.num);
    const rivals = G.nations.filter(n => n.alive && !n.human);
    const ctx = { city: myCities.length ? pick(myCities) : null, hex: myHexes.length ? pick(myHexes) : null, rival: pick(rivals) };
    if (!ctx.city || !ctx.hex || !ctx.rival) return null;
    const fill = s => s.replace(/\{city\}/g, hexName(ctx.city)).replace(/\{hex\}/g, hexName(ctx.hex)).replace(/\{rival\}/g, ctx.rival.name);
    return { ev, ctx, title: fill(ev.title), text: fill(ev.text), choices: ev.choices.map(c => Object.assign({}, c, { label: fill(c.label), out: fill(c.out) })), fill };
  }
  function resolveEvent(E, k) {
    const N = human(); const c = E.choices[k]; const { ctx } = E;
    if (c.cost) { if (!canPay(N, c.cost)) return 'You cannot afford that.'; pay(N, c.cost); }
    switch (c.effect) {
      case 'clear': ctx.hex.bandit = false; break;
      case 'bandit': ctx.hex.bandit = true; break;
      case 'fight': {
        const near = [ctx.hex, ...adjHexes(ctx.hex)].find(h => h.owner === 0 && h.army.length);
        if (near) { near.army.forEach(u => u.str = Math.max(30, u.str - 15)); ctx.hex.bandit = false; }
        else { ctx.hex.bandit = true; c.out = 'No army is close enough. The raiders dig in: ' + hexName(ctx.hex) + ' produces nothing until you march troops there.'; }
        break;
      }
      case 'plague': ctx.city.army.forEach(u => u.str = Math.max(20, u.str - 35)); break;
      case 'merc': { const unl = unitsUnlocked(N); const t = unl.filter(x => U[x].era === N.era).sort((a, b) => U[b].br - U[a].br)[0] || unl[unl.length - 1]; if (ctx.city.army.length < MAX_STACK) ctx.city.army.push(mkUnit(t, { exp: 2, moved: true })); break; }
      case 'mercRival': { const hs = owned(ctx.rival.i).filter(h => h.army.length); if (hs.length) { const h = pick(hs); h.army.forEach(u => u.str = Math.max(20, u.str - 30)); } break; }
      case 'science': N.sci += c.amt; checkResearch(N); break;
      case 'fortFree': ctx.city.fort = true; break;
      case 'gain': gain(N, c.gain); break;
      case 'morale': owned(0).forEach(h => h.army.forEach(u => u.str = 100)); break;
      case 'intel': N.intel[ctx.rival.i] = true; break;
      case 'revolt': ctx.city.army.forEach(u => u.str = Math.max(25, u.str - 20)); break;
      case 'lose': { const k2 = RES_KEYS.slice().sort((a, b) => N.res[b] - N.res[a])[0]; N.res[k2] = Math.floor(N.res[k2] / 2); break; }
    }
    log(c.out, 0, 'note');
    return null;
  }
  // AI rolled a 7: raiders hit the leader
  function aiSeven(i) {
    const leader = G.nations.filter(n => n.alive && n.i !== i).sort((a, b) => score(b.i) - score(a.i))[0];
    if (!leader) return;
    G.map.hexes.forEach(h => { if (h.bandit && h.banditBy === i) h.bandit = false; });
    const hs = owned(leader.i).filter(h => h.num && !h.army.length);
    if (hs.length) { const h = best(hs, x => valueHex(x)); h.bandit = true; h.banditBy = i; if (leader.human) log(`${nation(i).name} pays raiders to plunder ${hexName(h)}. It produces nothing until you march an army there.`, i, 'bad'); }
    const k = RES_KEYS.filter(r => leader.res[r] > 0); if (k.length) { const r = pick(k); leader.res[r]--; nation(i).res[r]++; }
  }

  // ---------- persistence
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ G, UNIT_ID })); } catch (e) { /* storage may be unavailable */ } }
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s || !s.G) return null; G = s.G; UNIT_ID = s.UNIT_ID || 1e5; return G; } catch (e) { return null; } }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  return {
    get G() { return G; }, newGame, load, save, hasSave, clearSave, log, nation, human, owned, cities, unitsUnlocked, doctrinesUnlocked, unitCost, canPay, pay, gain, costTxt,
    adjHexes, nbrs, hexAt, dist, isLand, passable, supplied, yieldOf, scienceOf, armyCount, upkeep, strength, score, rollDice, spoil, turnStart,
    techCost, availableTechs, setResearch, canSettle, build, recruit, tradeRate, bankTrade, aiAcceptsTrade, reachable, move, atWar, battleCfg, applyBattle,
    hexName, proposePeace, setPeace, aiTurn, makeEvent, resolveEvent, aiSeven, checkVictory, mkUnit, natMods, MAX_STACK, capture,
  };
})();
