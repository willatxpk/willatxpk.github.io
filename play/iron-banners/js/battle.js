// Iron Banners — tactical battle engine. Three sectors + reserves, simultaneous orders, rounds.
'use strict';

const Battle = (() => {
  const K = 15;               // damage scale
  const ROUT_STR = 15;        // a unit below this strength breaks
  let UID = 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const has = (u, tag) => U[u.t].tags.includes(tag);
  const cls = u => U[u.t].cls;
  const isRanged = u => ['missile', 'art', 'air'].includes(cls(u));
  const isMounted = u => ['lcav', 'hcav'].includes(cls(u));
  const isShock = u => has(u, 'shock') || ['hcav', 'armor'].includes(cls(u));
  const contactOrders = ['ADVANCE', 'CHARGE'];

  function create(cfg) {
    const B = {
      cfg, id: cfg.id || 'custom', round: 0, maxRounds: cfg.maxRounds || 10, over: false, winner: null, endReason: '',
      defender: cfg.defender ?? null, histAI: cfg.histAI !== false,
      sectors: cfg.sectors.map(s => ({ name: s.name, note: s.note || '', terrain: (s.terrain || []).slice(), owner: s.owner ?? null, line: 0, frontage: (s.terrain || []).includes('narrow') ? 3 : 5 })),
      sides: cfg.sides.map((s, i) => ({
        i, name: s.name, commander: s.commander || '', color: s.color, men: s.men || 0, doctrine: s.doctrine || 'none',
        general: s.general ? { name: s.general.name, sector: s.general.sector, alive: true, mortal: s.general.mortal !== false, wounded: false } : null,
        ai: s.ai || {}, script: s.script || [], reinforce: (s.reinforce || []).map(r => Object.assign({ done: false }, r)),
        mods: s.mods || {}, isAI: !!s.isAI, startStr: 0, broken: false, startDisorder: s.startDisorder || 0, cp: 1, hand: [], deck: [], discard: [], cards: s.cards !== false,
      })),
      units: [], orders: [null, null], log: [], roundLog: [], fx: [],
    };
    cfg.sides.forEach((s, i) => s.units.forEach(e => addUnit(B, i, e)));
    B.sides.forEach(s => { s.startStr = sideStr(B, s.i); });
    B.sides.forEach(s => { if (s.startDisorder) B.units.filter(u => u.side === s.i).forEach(u => u.disorder = s.startDisorder); });
    B.sides.forEach(s => { s.deck = deckFor(B, s.i); });
    B.cardFx = [freshCardFx(), freshCardFx()];
    return B;
  }

  function addUnit(B, side, e) {
    const [t, sector, o = {}] = Array.isArray(e) ? e : [e.t, e.sector, e];
    if (!U[t]) throw new Error('Unknown unit ' + t);
    const u = { uid: UID++, t, name: o.name || U[t].name, side, sector, str: o.str ?? 100, mor: U[t].mor, exp: o.exp || 0,
      status: 'ok', disorder: 0, drawn: 0, moved: false, fresh: false, ref: o.ref, dealt: 0, taken: 0, lastDmg: 0, why: '' };
    u.mor = Math.min(100, u.mor + (o.exp || 0) * 5 + (B.sides?.[side]?.doctrine === 'assault' ? 10 : 0));
    if (o.mor != null) u.mor = o.mor;
    B.units.push(u);
    return u;
  }

  const alive = u => u.status === 'ok';
  const unitsIn = (B, side, sector) => B.units.filter(u => u.side === side && u.sector === sector && alive(u));
  function sideStr(B, side) { return B.units.filter(u => u.side === side && alive(u)).reduce((a, u) => a + u.str, 0); }
  function sideStrAll(B, side) { return B.units.filter(u => u.side === side).reduce((a, u) => a + (u.status === 'destroyed' ? 0 : u.str), 0); }

  // ---- effective stats
  function natMul(B, u, kind) {
    const m = B.sides[u.side].mods; if (!m) return 1;
    let v = 1;
    const c = cls(u);
    if (m[kind]?.[c]) v *= m[kind][c];
    if (m[kind]?.all) v *= m[kind].all;
    return v * (1 + 0.06 * (u.exp || 0));
  }
  function power(B, u) { // rough strength estimate used by the AI and the UI
    const d = U[u.t];
    return (d.atk + d.def) * (u.str / 100) * (0.5 + 0.5 * u.mor / 100) * natMul(B, u, 'atk');
  }
  function sectorPower(B, side, sector, vs) {
    const us = unitsIn(B, side, sector);
    const them = vs ? unitsIn(B, 1 - side, sector) : [];
    // only the frontage can fight at once; crowded troops behind count for a little (they replace losses)
    const front = typeof sector === 'number' ? B.sectors[sector].frontage : 99;
    const meleeRank = us.filter(u => !isRanged(u)).sort((a, b) => power(B, b) - power(B, a));
    const behind = new Set(meleeRank.slice(front));
    return us.reduce((a, u) => {
      let p = power(B, u) * (behind.has(u) ? 0.25 : 1);
      if (them.length) {
        const avg = them.reduce((s, t) => s + matchup(B, u, t) * penMult(u, t), 0) / them.length;
        p *= Math.max(0.15, avg);
      }
      return a + p;
    }, 0);
  }

  function penMult(u, t) {
    const arm = U[t.t].arm; if (!arm) return 1;
    const pen = U[u.t].pen || 0;
    const r = pen / arm;
    return r >= 1 ? Math.min(1.3, 1 + 0.15 * (r - 1)) : Math.max(0.03, r * r);
  }

  function matchup(B, u, t) {
    const a = cls(u), d = cls(t);
    let m = 1;
    if (a === 'pike' && d === 'hcav') m = 1.6;
    else if (a === 'pike' && d === 'lcav') m = 1.4;
    else if (a === 'hcav' && d === 'pike') m = 0.6;
    else if (a === 'lcav' && d === 'pike') m = 0.6;
    else if ((a === 'hcav' || a === 'lcav') && (d === 'missile' || d === 'art')) m = 1.45;
    else if (a === 'missile' && d === 'hcav') m = 1.2;
    else if (a === 'missile' && d === 'lcav') m = 0.8;
    else if (a === 'art' && (d === 'inf' || d === 'pike')) m = 1.3;
    else if (a === 'armor' && (d === 'inf' || d === 'pike' || d === 'missile')) m = 1.3;
    else if (a === 'armor' && d === 'at') m = 0.8;
    else if (a === 'at' && d === 'armor') m = 1.5;
    else if (a === 'at' && d !== 'armor') m = 0.5;
    if (has(u, 'mg') && ['inf', 'pike', 'lcav', 'hcav'].includes(d)) m *= 1.4;
    if (has(u, 'fear') && (d === 'hcav' || d === 'lcav')) m *= 1.4;
    if (has(t, 'nomg') && (a === 'inf' || a === 'pike')) m *= 1.6;
    // air
    if (a === 'air' && d === 'air') m = has(u, 'airsup') ? 1.6 : 0.3;
    else if (a === 'air') m *= has(u, 'airsup') ? 0.5 : 1;
    else if (d === 'air') m = a === 'at' ? 0.2 : 0.12;
    return m;
  }

  // ---- orders
  function sectorHasFeint(B, side, s) { return unitsIn(B, side, s).some(u => has(u, 'feint') || isMounted(u)); }
  function stakesIn(B, side, s) {
    const us = unitsIn(B, side, s);
    return us.some(u => has(u, 'stakes')) || (B.sides[side].doctrine === 'longbow' && us.some(u => cls(u) === 'missile'));
  }
  function obliqueSector(B, side) { let best = 0, n = -1; for (let k = 0; k < 3; k++) { const c = unitsIn(B, side, k).length; if (c > n) { n = c; best = k; } } return best; }
  function adj(s) { return [s - 1, s + 1].filter(x => x >= 0 && x <= 2); }
  function envelopOK(B, side, s) { return unitsIn(B, side, s).length > 0 && unitsIn(B, 1 - side, s).length === 0 && adj(s).some(t => unitsIn(B, 1 - side, t).length > 0); }

  function validOrders(B, side, s) {
    const mine = unitsIn(B, side, s);
    if (!mine.length) return [];
    const list = ['HOLD', 'ADVANCE', 'CHARGE', 'BOMBARD', 'FALLBACK'];
    if (sectorHasFeint(B, side, s)) list.push('FEINT');
    if (envelopOK(B, side, s)) list.push('ENVELOP');
    return list;
  }

  function emptyOrders() { return { sec: [null, null, null], env: [null, null, null], commit: null, moves: [] }; }


  // ---- command cards (stratagems): each side earns command points and holds a hand of cards
  const CARDS = {
    rally:    { name: 'Rally the Ranks', icon: '📯', cost: 1, target: 'own', desc: '+20 morale for your units in one sector.' },
    speech:   { name: 'Stirring Speech', icon: '🗣', cost: 2, target: null, desc: '+12 morale for every unit you have on the field.' },
    hold:     { name: 'Hold at All Costs', icon: '🛡', cost: 1, target: 'own', desc: 'Your units in one sector take 35% less damage this round.' },
    charge:   { name: 'Lead from the Front', icon: '⚔', cost: 2, target: null, desc: 'Your general\'s sector strikes 35% harder this round, but the general is three times as likely to be hit.' },
    spies:    { name: 'Scouts & Spies', icon: '👁', cost: 1, target: null, desc: 'Learn the enemy\'s orders for this round before you give yours.' },
    ambush:   { name: 'Ambush', icon: '🌲', cost: 2, target: 'enemy', desc: 'Enemy units in one sector are thrown into disorder (for 2 rounds if the sector has woods or hills).' },
    volley:   { name: 'Massed Volley', icon: '🎯', cost: 1, target: 'own', desc: 'Missile troops and guns in one sector strike 50% harder this round.' },
    fury:     { name: 'Battle Fury', icon: '🔥', cost: 1, target: 'own', desc: 'Melee troops in one sector strike 30% harder this round, then lose 8 morale.' },
    barrage:  { name: 'Grand Barrage', icon: '💥', cost: 2, target: 'enemy', desc: 'Every gun you have pounds one enemy sector before the fighting starts.' },
    reserves: { name: 'Forced March', icon: '🥁', cost: 3, target: null, desc: 'A tired but welcome unit of your line troops arrives in the reserve.' },
  };
  function deckFor(B, side) {
    const S = B.sides[side], mine = B.units.filter(u => u.side === side);
    const d = ['rally', 'rally', 'speech', 'hold', 'hold', 'spies', 'fury', 'fury', 'ambush', 'ambush', 'reserves'];
    if (S.general) d.push('charge', 'charge');
    if (mine.some(u => ['missile', 'art'].includes(cls(u)))) d.push('volley', 'volley');
    if (mine.some(u => cls(u) === 'art' && U[u.t].era >= 2)) d.push('barrage', 'barrage');
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  function freshCardFx() { return { atk: [1, 1, 1], rng: [1, 1, 1], melee: [1, 1, 1], guard: [1, 1, 1], fury: [false, false, false], genRisk: 1, barrage: null, played: 0 }; }
  function drawCards(B, S) {
    while (S.hand.length < 3) {
      if (!S.deck.length) { S.deck = S.discard.splice(0).sort(() => Math.random() - 0.5); if (!S.deck.length) break; }
      S.hand.push(S.deck.pop());
    }
  }
  function cardOK(B, side, id, target) {
    const S = B.sides[side], c = CARDS[id];
    if (!c || S.cp < c.cost || B.cardFx[side].played >= 2) return false;
    if (id === 'charge' && !(S.general?.alive && typeof S.general.sector === 'number')) return false;
    if (id === 'barrage' && !B.units.some(u => u.side === side && alive(u) && cls(u) === 'art')) return false;
    if (c.target === 'own' && !(typeof target === 'number' && unitsIn(B, side, target).length)) return false;
    if (c.target === 'enemy' && !(typeof target === 'number' && unitsIn(B, 1 - side, target).length)) return false;
    return true;
  }
  function playCard(B, side, idx, target) {
    const S = B.sides[side], id = S.hand[idx], c = CARDS[id];
    if (!cardOK(B, side, id, target)) return false;
    S.cp -= c.cost; S.hand.splice(idx, 1); S.discard.push(id);
    const F = B.cardFx[side]; F.played++;
    const en = 1 - side, where = typeof target === 'number' ? ` in ${B.sectors[target].name}` : '';
    switch (id) {
      case 'rally': unitsIn(B, side, target).forEach(u => u.mor = Math.min(100, u.mor + 20)); break;
      case 'speech': B.units.filter(u => u.side === side && alive(u)).forEach(u => u.mor = Math.min(100, u.mor + 12)); break;
      case 'hold': F.guard[target] = 0.65; break;
      case 'charge': F.atk[S.general.sector] *= 1.35; F.genRisk = 3; break;
      case 'spies': if (!B.orders[en]) B.orders[en] = aiOrders(B, en); B.spied = B.spied || [false, false]; B.spied[side] = true; break;
      case 'ambush': { const tr = B.sectors[target].terrain; const n = tr.includes('woods') || tr.includes('hill') ? 2 : 1; unitsIn(B, en, target).forEach(u => u.disorder = Math.max(u.disorder, n)); break; }
      case 'volley': F.rng[target] *= 1.5; break;
      case 'fury': F.melee[target] *= 1.3; F.fury[target] = true; break;
      case 'barrage': F.barrage = target; break;
      case 'reserves': {
        const line = B.units.filter(u => u.side === side && !isRanged(u) && !isMounted(u));
        const t = (line[0] || B.units.find(u => u.side === side)).t;
        addUnit(B, side, [t, 'R', { name: 'Forced-march reinforcements', str: 60 }]); S.startStr += 60; break;
      }
    }
    const general = S.general?.name || S.name;
    say(B, `${c.icon} ${S.name} plays ${c.name}${id === 'charge' ? ` — ${general} leads from the front` : where}.`, side, 'card');
    B.fx.push({ type: 'card', side, card: id, sector: id === 'charge' ? S.general.sector : target });
    return true;
  }
  // the AI plays cards by simple judgement: shore up a losing sector, rally a shaken one, press an advantage
  function aiCards(B, side) {
    const S = B.sides[side], en = 1 - side;
    for (let tries = 0; tries < 2; tries++) {
      let best = null;
      const consider = (idx, target, score) => { if (cardOK(B, side, S.hand[idx], target) && (!best || score > best.score)) best = { idx, target, score }; };
      S.hand.forEach((id, idx) => {
        for (let s = 0; s < 3; s++) {
          const mine = unitsIn(B, side, s), theirs = unitsIn(B, en, s);
          const my = sectorPower(B, side, s, true), th = sectorPower(B, en, s, true);
          const avgMor = mine.length ? mine.reduce((a, u) => a + u.mor, 0) / mine.length : 100;
          if (id === 'hold' && mine.length && th > my * 1.1) consider(idx, s, 3 + th / Math.max(1, my));
          if (id === 'rally' && mine.length && avgMor < 50) consider(idx, s, 3 + (50 - avgMor) / 10);
          if (id === 'fury' && mine.length && theirs.length && my > th) consider(idx, s, 1.8 + my / Math.max(1, th) * 0.3);
          if (id === 'volley') consider(idx, s, mine.filter(isRanged).length * 1.1);
          if (id === 'ambush' && theirs.length) consider(idx, s, 1.2 + theirs.length * 0.35 + (B.sectors[s].terrain.some(t => t === 'woods' || t === 'hill') ? 0.8 : 0));
          if (id === 'barrage' && theirs.length) consider(idx, s, 1.5 + theirs.length * 0.4);
        }
        if (id === 'speech') { const f = B.units.filter(u => u.side === side && alive(u)); const m = f.reduce((a, u) => a + u.mor, 0) / Math.max(1, f.length); if (m < 55) consider(idx, null, 2.5 + (55 - m) / 10); }
        if (id === 'charge' && S.general?.alive && typeof S.general.sector === 'number') { const g = S.general.sector; if (sectorPower(B, side, g, true) > sectorPower(B, en, g, true) * 0.9) consider(idx, null, 2.2); }
        if (id === 'reserves' && !unitsIn(B, side, 'R').length) consider(idx, null, 2.4);
      });
      if (!best) return;
      const c = CARDS[S.hand[best.idx]];
      if (best.score < 2 && Math.random() > 0.35) return; // save points for a better moment
      if (S.cp - c.cost < 1 && best.score < 2.6 && Math.random() < 0.5) return;
      playCard(B, side, best.idx, best.target);
    }
  }

  // ---- start of round: reinforcements & scripts
  function beginRound(B) {
    B.round++;
    B.roundLog = [];
    B.fx = [];
    B.units.forEach(u => { u.moved = false; u.fresh = false; u.lastDmg = 0; });
    B.cardFx = [freshCardFx(), freshCardFx()]; B.spied = [false, false];
    for (const S of B.sides) { if (!S.cards) continue; if (B.round > 1) S.cp = Math.min(5, S.cp + 1 + (S.general?.alive && B.round % 3 === 0 ? 1 : 0)); drawCards(B, S); }
    for (const s of B.sides) for (const r of s.reinforce) {
      if (!r.done && r.round <= B.round) {
        r.done = true;
        r.units.forEach(([t, o]) => addUnit(B, s.i, [t, r.sector, o]));
        B.sides[s.i].startStr += r.units.length * 100;
        say(B, `${s.name}: ${r.text || 'Reinforcements arrive.'}`, s.i, 'reinf');
      }
    }
    B.orders = [null, null];
  }

  function say(B, text, side = null, kind = '') { const e = { round: B.round, text, side, kind }; B.log.push(e); B.roundLog.push(e); }

  // ---- AI
  function aiOrders(B, side) {
    const S = B.sides[side];
    const o = emptyOrders();
    const script = B.histAI ? S.script.find(x => x.round === B.round) : null;
    const en = 1 - side;
    for (let s = 0; s < 3; s++) {
      const mine = unitsIn(B, side, s);
      if (!mine.length) continue;
      const theirs = unitsIn(B, en, s);
      const want = script?.orders?.[s];
      const valid = validOrders(B, side, s);
      if (want && valid.includes(want)) { o.sec[s] = want; if (want === 'ENVELOP') o.env[s] = pickEnvTarget(B, side, s); continue; }
      if (!theirs.length) {
        if (valid.includes('ENVELOP')) { o.sec[s] = 'ENVELOP'; o.env[s] = pickEnvTarget(B, side, s); }
        else o.sec[s] = 'HOLD';
        continue;
      }
      o.sec[s] = smartOrder(B, side, s);
    }
    // reserve
    const reserve = unitsIn(B, side, 'R');
    if (reserve.length) {
      if (script && script.commit != null) o.commit = script.commit;
      else if (!(B.histAI && S.script.length && B.round <= Math.max(...S.script.map(x => x.round)))) {
        let best = null, bestScore = 0;
        for (let s = 0; s < 3; s++) {
          const mp = sectorPower(B, side, s, true), ep = sectorPower(B, en, s, true);
          if (!ep && !mp) continue;
          const r = (mp + 1) / (ep + 1);
          const score = r < 0.7 ? (1 / r) : (r > 1.3 && ep > 0 ? r * 0.8 : 0);
          if (score > bestScore) { bestScore = score; best = s; }
        }
        const urgency = B.round >= 3 ? 0.6 : 0.25;
        if (best != null && bestScore > 1.2 && Math.random() < urgency + 0.15 * bestScore) o.commit = best;
        if (B.round >= B.maxRounds - 2 && best != null) o.commit = best;
      }
    }
    if (script && script.shift) {
      const [from, to] = script.shift;
      const cand = unitsIn(B, side, from).filter(u => cls(u) !== 'art');
      if (cand.length > 1) o.moves.push({ uid: cand[cand.length - 1].uid, to });
    }
    return o;
  }

  function pickEnvTarget(B, side, s) {
    const opts = adj(s).filter(t => unitsIn(B, 1 - side, t).length);
    if (!opts.length) return null;
    opts.sort((a, b) => {
      const da = unitsIn(B, 1 - side, a).some(u => u.drawn) ? 2 : 1, db = unitsIn(B, 1 - side, b).some(u => u.drawn) ? 2 : 1;
      return db - da || sectorPower(B, side, b) / (sectorPower(B, 1 - side, b) + 1) - sectorPower(B, side, a) / (sectorPower(B, 1 - side, a) + 1);
    });
    return opts[0];
  }

  function terrainEdge(B, side, s) {
    const sec = B.sectors[s];
    let e = 1;
    if (sec.owner === side) { if (sec.terrain.includes('hill')) e *= 1.3; if (sec.terrain.includes('fort')) e *= 1.5; if (sec.terrain.includes('river')) e *= 1.4; }
    else if (sec.owner === 1 - side) { if (sec.terrain.includes('hill')) e /= 1.3; if (sec.terrain.includes('fort')) e /= 1.5; if (sec.terrain.includes('river')) e /= 1.4; }
    return e;
  }

  function smartOrder(B, side, s) {
    const S = B.sides[side];
    const en = 1 - side;
    const mine = unitsIn(B, side, s);
    const mp = sectorPower(B, side, s, true), ep = sectorPower(B, en, s, true);
    const r = (mp / (ep + 0.01)) * terrainEdge(B, side, s);
    const rangedP = mine.filter(isRanged).reduce((a, u) => a + power(B, u), 0) / (mine.reduce((a, u) => a + power(B, u), 0) || 1);
    const shockP = mine.filter(isShock).reduce((a, u) => a + power(B, u), 0) / (mine.reduce((a, u) => a + power(B, u), 0) || 1);
    const sec = B.sectors[s];
    const badGround = sec.terrain.includes('mud') || sec.terrain.includes('woods') || (sec.owner === en && (sec.terrain.includes('hill') || sec.terrain.includes('river') || sec.terrain.includes('fort')));
    const enemyStakes = stakesIn(B, en, s) || unitsIn(B, en, s).some(u => cls(u) === 'pike' && U[u.t].def >= 8);
    const isDef = B.defender === side;
    const D = S.doctrine;
    const roll = Math.random();
    if (S.ai.prefer && roll < 0.5) return S.ai.prefer;
    if (r > 1.6 && shockP > 0.4 && !badGround && !enemyStakes) return 'CHARGE';
    if (r > 1.15) {
      if (rangedP > 0.6 || (badGround && rangedP > 0.3)) return 'BOMBARD';
      if (isDef && sec.owner === side && r < 1.8) return roll < 0.6 ? 'HOLD' : 'ADVANCE';
      return 'ADVANCE';
    }
    if (r > 0.75) {
      if (rangedP > 0.35) return 'BOMBARD';
      if (sectorHasFeint(B, side, s) && (D === 'feigned' || roll < 0.15) && !isDef) return 'FEINT';
      if (isDef || sec.owner === side) return 'HOLD';
      return roll < 0.5 ? 'HOLD' : 'ADVANCE';
    }
    if (['depth', 'envelopment', 'central'].includes(D) && roll < 0.6) return 'FALLBACK';
    if (sectorHasFeint(B, side, s) && roll < 0.3) return 'FEINT';
    if (rangedP > 0.5) return 'BOMBARD';
    return 'HOLD';
  }

  // ---- resolution
  function setOrders(B, side, o) { B.orders[side] = o; }

  function resolve(B) {
    for (let side = 0; side < 2; side++) if (B.sides[side].cards && (B.sides[side].isAI || !B.orders[side] || B.autoCards)) aiCards(B, side);
    for (let side = 0; side < 2; side++) if (!B.orders[side]) B.orders[side] = aiOrders(B, side);
    const O = B.orders;
    // sanitize: invalid orders become HOLD
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) {
      const v = validOrders(B, side, s);
      if (!v.length) { O[side].sec[s] = null; continue; }
      if (!v.includes(O[side].sec[s])) O[side].sec[s] = O[side].sec[s] === 'FEINT' ? 'FALLBACK' : 'HOLD';
      if (O[side].sec[s] === 'ENVELOP' && (O[side].env[s] == null || !adj(s).includes(O[side].env[s]) || !unitsIn(B, 1 - side, O[side].env[s]).length)) O[side].env[s] = pickEnvTarget(B, side, s);
    }
    // two enveloping forces swinging past each other collide head-on instead: the second one turns to fight at home
    for (let s = 0; s < 3; s++) {
      if (O[0].sec[s] !== 'ENVELOP') continue;
      const t = O[0].env[s];
      if (t != null && O[1].sec[t] === 'ENVELOP' && O[1].env[t] === s) O[1].sec[t] = 'ADVANCE';
    }
    // 1. redeploys
    for (let side = 0; side < 2; side++) for (const m of O[side].moves || []) {
      const u = B.units.find(x => x.uid === m.uid && x.side === side && alive(x));
      if (!u || u.sector === m.to) continue;
      if (u.sector === 'R') { u.sector = m.to; u.fresh = true; continue; }
      u.sector = m.to; u.moved = true;
      if (m.to !== 'R') say(B, `${u.name} shifts to ${B.sectors[m.to].name}.`, side, 'move');
    }
    // 2. reserve commitment
    for (let side = 0; side < 2; side++) {
      const c = O[side].commit;
      if (c == null) continue;
      const res = unitsIn(B, side, 'R');
      if (!res.length) continue;
      res.forEach(u => { u.sector = c; u.fresh = true; });
      say(B, `${B.sides[side].name} commits the reserve (${res.map(u => u.name).join(', ')}) to ${B.sectors[c].name}.`, side, 'commit');
      B.fx.push({ type: 'commit', side, sector: c });
      if (B.sides[side].doctrine === 'triplex') unitsIn(B, side, c).forEach(u => u.mor = Math.min(100, u.mor + 20));
      if (!O[side].sec[c]) O[side].sec[c] = 'ADVANCE';
    }
    // 2b. grand barrages
    for (let side = 0; side < 2; side++) {
      const t = B.cardFx[side].barrage; if (t == null) continue;
      const guns = B.units.filter(u => u.side === side && alive(u) && cls(u) === 'art');
      const pow = guns.reduce((a, u) => a + U[u.t].atk * u.str / 100, 0);
      unitsIn(B, 1 - side, t).forEach(u => { const d = Math.min(18, pow * 0.45 / Math.max(1, U[u.t].def * 0.12)) * rnd(0.8, 1.2) * (cls(u) === 'armor' ? 0.4 : 1); u.str = Math.max(1, u.str - d); u.mor -= d * 0.7; u.taken += d; });
      B.fx.push({ type: 'barrage', side, sector: t });
    }
    // 3. who is fighting where
    const flankers = [[[], [], []], [[], [], []]]; // flankers[side][targetSector]
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) {
      if (O[side].sec[s] === 'ENVELOP' && O[side].env[s] != null) {
        const t = O[side].env[s];
        unitsIn(B, side, s).filter(u => !u.moved && cls(u) !== 'art').forEach(u => flankers[side][t].push(u));
        B.fx.push({ type: 'envelop', side, from: s, to: t });
      }
    }
    const dmg = new Map(); const mdmg = new Map();
    const addD = (u, d, m) => { dmg.set(u, (dmg.get(u) || 0) + d); mdmg.set(u, (mdmg.get(u) || 0) + m); };
    const flankedBy = [[0, 0, 0], [0, 0, 0]]; // number of distinct flanking sectors hitting side X in sector s
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) {
      if (O[side].sec[s] === 'ENVELOP' && O[side].env[s] != null) flankedBy[1 - side][O[side].env[s]] |= (s < O[side].env[s] ? 1 : 2);
    }
    const sectorDealt = [[0, 0, 0], [0, 0, 0]];

    for (let s = 0; s < 3; s++) {
      const fighters = [0, 1].map(side => {
        const home = O[side].sec[s] === 'ENVELOP' ? [] : unitsIn(B, side, s).filter(u => !u.moved);
        return { home, flank: flankers[side][s] };
      });
      const ords = [0, 1].map(side => fighters[side].home.length ? O[side].sec[s] : null);
      const anyFlank = fighters[0].flank.length || fighters[1].flank.length;
      const contact = contactOrders.includes(ords[0]) || contactOrders.includes(ords[1]) || anyFlank
        || (ords[0] === 'FEINT' && ords[1] && ords[1] !== 'HOLD') || (ords[1] === 'FEINT' && ords[0] && ords[0] !== 'HOLD');
      if (!fighters[0].home.length && !fighters[0].flank.length) continue;
      if (!fighters[1].home.length && !fighters[1].flank.length) continue;
      B.fx.push({ type: contact ? 'melee' : 'fire', sector: s });

      for (let side = 0; side < 2; side++) {
        const en = 1 - side;
        const myOrd = ords[side], enOrd = ords[en];
        const all = [...fighters[side].home, ...fighters[side].flank];
        const targets = [...fighters[en].home, ...fighters[en].flank];
        if (!targets.length) continue;
        const frontage = B.sectors[s].frontage;
        // frontage: best melee units fight; extras are idle
        const melee = fighters[side].home.filter(u => !isRanged(u)).sort((a, b) => power(B, b) - power(B, a));
        const fighting = new Set(melee.slice(0, frontage));
        const S = B.sides[side];
        // blitz Schwerpunkt: sector with most armor
        let schwer = -1;
        if (S.doctrine === 'blitz') { let best = 0; for (let k = 0; k < 3; k++) { const n = unitsIn(B, side, k).filter(u => cls(u) === 'armor' || cls(u) === 'air').length; if (n > best) { best = n; schwer = k; } } }
        const heavy = S.doctrine === 'oblique' ? obliqueSector(B, side) : -1;
        for (const u of all) {
          const isFlank = fighters[side].flank.includes(u);
          const ranged = isRanged(u);
          let ordMul;
          const ord = isFlank ? 'ENVELOP' : myOrd;
          if (!isFlank && !ranged && !fighting.has(u)) continue; // idle behind the front
          if (!contact && !ranged) {
            if (has(u, 'volley') && (ord === 'HOLD' || ord === 'BOMBARD')) ordMul = 0.35; else continue;
          }
          switch (ord) {
            case 'HOLD': ordMul = ordMul ?? (ranged ? 1 : 0.8); break;
            case 'ADVANCE': ordMul = 1; break;
            case 'CHARGE': ordMul = isShock(u) ? 1.6 : 1.15; break;
            case 'BOMBARD': ordMul = ordMul ?? (ranged ? 1.25 : (contactOrders.includes(enOrd) ? 0.7 : 0)); break;
            case 'FALLBACK': ordMul = 0.4; break;
            case 'FEINT': ordMul = 0.3; break;
            case 'ENVELOP': ordMul = 1.5 + (S.doctrine === 'envelopment' ? 0.3 : 0) + (S.doctrine === 'hammer' && cls(u) === 'hcav' ? 0.3 : 0); break;
            default: ordMul = 1;
          }
          if (!ordMul) continue;
          let m = ordMul * U[u.t].atk * (u.str / 100) * (0.55 + 0.45 * u.mor / 100) * natMul(B, u, 'atk');
          if (u.disorder) m *= 0.7;
          { const CF = B.cardFx[side]; m *= CF.atk[s] * (ranged ? CF.rng[s] : CF.melee[s]); }
          if (u.fresh && S.doctrine === 'central') m *= 1.4;
          // doctrines
          const D = S.doctrine;
          if (D === 'longbow' && cls(u) === 'missile') m *= 1.35;
          if (D === 'battery' && cls(u) === 'art' && ord === 'BOMBARD') m *= 1.4;
          if (D === 'assault' && ord === 'ADVANCE' && (cls(u) === 'inf')) m *= 1.15;
          if (D === 'hammer' && cls(u) === 'hcav' && ord === 'CHARGE') m *= 1.3;
          if (D === 'blitz' && (cls(u) === 'armor' || cls(u) === 'air')) m *= (s === schwer ? 1.4 : 0.9);
          if (D === 'depth' && cls(u) === 'at') m *= 1.3;
          if (D === 'depth' && (ord === 'ADVANCE' || ord === 'CHARGE') && targets.some(t => t.drawn)) m *= 1.3;
          if (D === 'combined' && new Set(all.map(cls)).size >= 3) m *= 1.15;
          if (D === 'oblique' && s === heavy) m *= 1.35;
          if (D === 'schiltron' && cls(u) === 'pike' && (ord === 'ADVANCE' || ord === 'CHARGE')) m *= 1.3;
          // terrain
          const sec = B.sectors[s];
          const crossing = sec.owner === en;
          if (crossing && sec.terrain.includes('river') && !ranged && (ord === 'ADVANCE' || ord === 'CHARGE')) m *= 0.6;
          if ((ord === 'CHARGE') && (isMounted(u) || cls(u) === 'armor')) {
            if (sec.terrain.includes('mud')) m *= isMounted(u) ? 0.4 : 0.7;
            if (sec.terrain.includes('woods')) m *= 0.6;
            if (crossing && sec.terrain.includes('hill')) m *= 0.6;
            if (stakesIn(B, en, s) && isMounted(u)) m *= 0.45;
          }
          if ((ord === 'ADVANCE' || ord === 'CHARGE') && sec.terrain.includes('mud') && !ranged) m *= 0.8;
          if (sec.terrain.includes('woods') && ranged && cls(u) !== 'air') m *= 0.7;
          if (B.sides[side].general?.alive && B.sides[side].general.sector === s) m *= 1.1;
          // distribute across targets
          const shots = ranged ? 2 : 1;
          for (let k = 0; k < shots; k++) {
            const tgt = pickTarget(B, u, targets, isFlank);
            if (!tgt) continue;
            let d = K * m / shots * matchup(B, u, tgt) * penMult(u, tgt) * rnd(0.8, 1.2);
            d /= defOf(B, tgt, ords[en], s, flankedBy[en][s], isFlank, u);
            d *= B.cardFx[en].guard[s];
            // special interactions
            if (ord === 'CHARGE' && isMounted(u) && cls(tgt) === 'pike' && (enOrd === 'HOLD' || B.sides[en].doctrine === 'schiltron')) d *= 0.6;
            if (B.sides[en].doctrine === 'reverseslope' && enOrd === 'HOLD') { if (ranged) d *= 0.6; else if (isMounted(u) && ['inf', 'pike'].includes(cls(tgt))) d *= 0.6; }
            if (enOrd === 'CHARGE' && isMounted(tgt) && cls(u) === 'pike' && myOrd === 'HOLD') d *= 1.4;
            if (ranged && contactOrders.includes(enOrd) && sec.terrain.includes('mud')) d *= 1.25;
            if (ranged && !fighters[en].flank.includes(tgt)) { const crowd = Math.max(0, fighters[en].home.length - frontage); d *= 1 + 0.22 * crowd; }
            if (has(u, 'mg') && enOrd === 'ADVANCE') d *= 1.2;
            if (D === 'entrenched' && myOrd === 'HOLD' && (has(u, 'volley') || cls(u) === 'art') && enOrd === 'ADVANCE') d *= 1.2;
            let md = d * 0.8 * (isFlank ? 2 : 1) * (has(u, 'fear') ? 1.5 : 1);
            if (tgt.drawn && isFlank) d *= 1.3;
            addD(tgt, d, md);
            u.dealt += d; sectorDealt[side][s] += d;
          }
        }
      }
      // 4. maneuver outcomes for this sector
      const o0 = ords[0], o1 = ords[1];
      for (let side = 0; side < 2; side++) {
        const en = 1 - side;
        const mine = fighters[side].home, theirs = fighters[en].home;
        const myO = ords[side], enO = ords[en];
        if (myO === 'FEINT' && theirs.length) {
          const pursuers = [];
          if (contactOrders.includes(enO)) pursuers.push(...theirs.filter(u => !isRanged(u)));
          else if (enO === 'HOLD' || enO === 'BOMBARD') {
            const base = (B.histAI && B.sides[en].isAI ? B.sides[en].ai.pursue : null) ?? 0.25;
            const p = base * (B.sides[en].doctrine === 'shieldwall' ? 0.5 : 1);
            theirs.filter(u => !isRanged(u) && !has(u, 'discipline')).forEach(u => { if (Math.random() < p) pursuers.push(u); });
            if (pursuers.length) say(B, `${pursuers.map(u => u.name).join(', ')} break ranks to chase the fleeing enemy!`, en, 'bad');
            else { say(B, `${B.sides[side].name}'s feigned retreat in ${B.sectors[s].name} fools no one.`, side, 'note'); mine.forEach(u => u.mor -= 4); }
          }
          const dur = B.sides[side].doctrine === 'feigned' ? 2 : 1;
          pursuers.forEach(u => { if (has(u, 'discipline') && Math.random() < 0.5) return; u.disorder = Math.max(u.disorder, dur); u.drawn = 2; });
          // the fleeing horsemen wheel about and fall on the strung-out pursuers
          const turners = mine.filter(u => has(u, 'feint') || isMounted(u));
          const blow = turners.reduce((a, u) => a + U[u.t].atk * u.str / 100 * natMul(B, u, 'atk'), 0) * (B.sides[side].doctrine === 'feigned' ? 1.3 : 1);
          pursuers.forEach(p => { const d = K * 0.9 * blow / pursuers.length / Math.max(1, U[p.t].def * 0.8); addD(p, d, d * 1.2); });
          if (pursuers.length) { say(B, `Feigned retreat! ${B.sides[en].name}'s pursuers in ${B.sectors[s].name} are strung out and disordered.`, side, 'good'); B.fx.push({ type: 'feint', side, sector: s }); }
          shiftLine(B, s, side, -1);
        }
        if (myO === 'FALLBACK') {
          shiftLine(B, s, side, -1);
          if (contactOrders.includes(enO)) { theirs.forEach(u => u.drawn = 2); if (theirs.length) say(B, `${B.sides[en].name} presses forward into ${B.sectors[s].name} — and is drawn in.`, side, 'note'); }
          if (!['central', 'depth'].includes(B.sides[side].doctrine)) mine.forEach(u => u.mor -= 3);
        }
      }
      // ground effects on attackers: mud exhausts, minefields and wire bleed anyone assaulting fortifications
      for (let side = 0; side < 2; side++) {
        if (!contactOrders.includes(ords[side])) continue;
        const sec = B.sectors[s];
        const tanksCrushWire = fighters[side].home.some(u => cls(u) === 'armor' && U[u.t].era === 4); // WWI wire; WWII minefields still bite
        for (const u of fighters[side].home) {
          if (cls(u) === 'air' || isRanged(u)) continue;
          if (sec.terrain.includes('mud') && (isMounted(u) || U[u.t].def >= 11 || cls(u) === 'armor')) u.mor -= 7; // heavy armor and horses founder in mud
          if (sec.terrain.includes('fort') && sec.owner === 1 - side) { if (!tanksCrushWire || sec.terrain.includes('narrow')) addD(u, 6, 4); else if (cls(u) === 'armor') addD(u, 3, 1); }
        }
      }
      // line push from melee
      if (contact) {
        const d0 = sectorDealt[0][s], d1 = sectorDealt[1][s];
        if (d0 > d1 * 1.15 && contactOrders.includes(o0) && o1 !== 'FALLBACK' && o1 !== 'FEINT') shiftLine(B, s, 0, +1);
        else if (d1 > d0 * 1.15 && contactOrders.includes(o1) && o0 !== 'FALLBACK' && o0 !== 'FEINT') shiftLine(B, s, 1, +1);
      }
    }
    // 5. apply damage
    const encircled = [[false, false, false], [false, false, false]];
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) {
      const doubleFlank = flankedBy[side][s] === 3;
      const deepPocket = flankedBy[side][s] && unitsIn(B, side, s).some(u => u.drawn);
      encircled[side][s] = doubleFlank || (deepPocket && B.sides[1 - side].doctrine === 'envelopment');
      if (encircled[side][s]) say(B, `${B.sides[side].name}'s troops in ${B.sectors[s].name} are SURROUNDED!`, 1 - side, 'good');
    }
    for (const [u, d] of dmg) {
      u.str = Math.max(0, u.str - d); u.taken += d; u.lastDmg = d;
      const sec = typeof u.sector === 'number' ? u.sector : -1;
      u.mor -= (mdmg.get(u) || 0) * (sec >= 0 && encircled[u.side][sec] ? 1.6 : 1);
    }
    // unreliable vehicles
    B.units.filter(u => alive(u) && has(u, 'unreliable') && typeof u.sector === 'number' && !u.moved && B.orders[u.side].sec[u.sector] && B.orders[u.side].sec[u.sector] !== 'HOLD').forEach(u => {
      if (Math.random() < 0.07) { u.status = 'routed'; u.why = 'broke down'; say(B, `${u.name} breaks down and is out of the fight.`, u.side, 'bad'); }
    });
    // 6. routs
    const brokeSectors = [];
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) {
      const before = unitsIn(B, side, s);
      if (!before.length) continue;
      for (const u of before) {
        if (u.str <= ROUT_STR || u.mor <= 0) {
          u.status = 'routed'; u.why = u.str <= ROUT_STR ? 'shattered' : 'broke and fled';
          if (encircled[side][s]) { u.status = 'destroyed'; u.why = 'surrounded and cut down'; }
          say(B, `${u.name} ${u.why}.`, side, 'rout');
        }
      }
      if (!unitsIn(B, side, s).length) {
        brokeSectors.push([side, s]);
        // pursuit by mounted / armor
        const hunters = unitsIn(B, 1 - side, s).filter(u => isMounted(u) || cls(u) === 'armor');
        if (hunters.length) before.forEach(u => { if (u.status === 'routed') u.str = Math.max(0, u.str - 25); });
      }
    }
    for (const [side, s] of brokeSectors) {
      const blitz = B.sides[1 - side].doctrine === 'blitz';
      say(B, `${B.sides[side].name}'s line in ${B.sectors[s].name} has collapsed!`, 1 - side, 'good');
      B.units.filter(u => u.side === side && alive(u)).forEach(u => u.mor -= blitz ? 15 : 8);
      B.fx.push({ type: 'break', side, sector: s });
      shiftLine(B, s, 1 - side, +2);
    }
    // 7. generals
    for (const S of B.sides) {
      const g = S.general;
      if (!g || !g.alive || g.sector === 'R') continue;
      const s = g.sector;
      const here = B.units.filter(u => u.side === S.i && u.sector === s);
      const took = here.reduce((a, u) => a + u.lastDmg, 0);
      let risk = 0.01 + Math.min(0.12, took / 900);
      if (brokeSectors.some(([side, ss]) => side === S.i && ss === s)) risk = 0.35;
      risk = Math.min(0.6, risk * (B.cardFx[S.i].genRisk || 1));
      if (Math.random() < risk && !g.mortal) {
        g.alive = false; g.wounded = true;
        say(B, `${g.name} is wounded and carried from the field!`, S.i, 'general');
        B.units.filter(u => u.side === S.i && alive(u)).forEach(u => u.mor -= 10);
      } else if (Math.random() < risk) {
        g.alive = false;
        say(B, `${g.name} has fallen! The news spreads through the ranks.`, S.i, 'general');
        B.units.filter(u => u.side === S.i && alive(u)).forEach(u => u.mor -= 25);
        B.fx.push({ type: 'general', side: S.i, sector: s });
      } else if (!unitsIn(B, S.i, s).length) {
        const ok = [0, 1, 2].find(k => unitsIn(B, S.i, k).length);
        if (ok != null) { g.sector = ok; say(B, `${g.name} rides to ${B.sectors[ok].name}.`, S.i, 'move'); }
      }
    }
    // 8. recovery
    for (const u of B.units) {
      if (!alive(u)) continue;
      const S = B.sides[u.side];
      const ord = typeof u.sector === 'number' ? B.orders[u.side].sec[u.sector] : null;
      if (!dmg.has(u)) u.mor = Math.min(U[u.t].mor + 10, u.mor + 5);
      if (S.doctrine === 'shieldwall' && ord === 'HOLD' && ['inf', 'pike'].includes(cls(u))) u.mor = Math.min(100, u.mor + 6);
      if (S.general?.alive && S.general.sector === u.sector) u.mor = Math.min(100, u.mor + 3);
      if (typeof u.sector === 'number' && B.cardFx[u.side].fury[u.sector]) u.mor -= 8;
      if (u.disorder) u.disorder--;
      if (u.drawn) u.drawn--;
    }
    // 9. end check
    checkEnd(B);
    return B.roundLog;
  }

  function pickTarget(B, u, targets, viaFlank) {
    let live = targets.filter(t => t.status === 'ok' || t.status === undefined);
    if (!live.length) return null;
    // frontal melee must cut through the enemy's line troops before reaching archers and guns behind them
    if (!isRanged(u) && !viaFlank) {
      const line = live.filter(t => !isRanged(t));
      if (line.length && Math.random() > 0.12) live = line;
    }
    let tot = 0;
    const w = live.map(t => { const x = (matchup(B, u, t) * penMult(u, t) + 0.15) * (cls(t) === 'air' && cls(u) !== 'air' ? 0.3 : 1); tot += x; return x; });
    let r = Math.random() * tot;
    for (let i = 0; i < live.length; i++) { r -= w[i]; if (r <= 0) return live[i]; }
    return live[live.length - 1];
  }

  function defOf(B, t, ord, s, flanked, viaFlank, attacker) {
    const S = B.sides[t.side];
    let d = U[t.t].def * (0.6 + 0.4 * t.str / 100) * natMul(B, t, 'def');
    const sec = B.sectors[s];
    if (!viaFlank) {
      if (ord === 'HOLD') {
        d *= 1.3;
        if (S.doctrine === 'shieldwall' && ['inf', 'pike'].includes(cls(t))) d *= 1.2;
        if (S.doctrine === 'hammer' && cls(t) === 'pike') d *= 1.2;
        if (S.doctrine === 'entrenched' && has(t, 'entrench')) d *= 1.4;
        if (has(t, 'entrench')) d *= 1.1;
      }
      if (S.doctrine === 'oblique' && (ord === 'HOLD' || ord === 'FALLBACK') && s !== obliqueSector(B, t.side)) d *= 1.25;
      if (sec.owner === t.side && !t.drawn) { // troops lured out of position lose the ground's protection
        if (sec.terrain.includes('hill')) d *= 1.25;
        if (sec.terrain.includes('fort')) d *= 1.5;
      }
    } else d *= 0.75;
    if (sec.terrain.includes('woods') && cls(t) !== 'air') d *= 1.2;
    if (ord === 'CHARGE') d *= 0.85;
    if (ord === 'FALLBACK') d *= S.doctrine === 'depth' ? 3 : S.doctrine === 'envelopment' ? 2.8 : 2;
    if (ord === 'FEINT') d *= S.doctrine === 'feigned' ? 2.5 : 1.7;
    if (t.disorder) d *= 0.6;
    if (flanked) d *= 0.85;
    return Math.max(0.5, d);
  }

  function shiftLine(B, s, side, amount) {
    const sec = B.sectors[s];
    const delta = side === 0 ? amount : -amount;
    sec.line = Math.max(-3, Math.min(3, sec.line + delta));
    const favored = sec.line > 0 ? 0 : sec.line < 0 ? 1 : null;
    if (sec.owner != null && favored != null && favored !== sec.owner && Math.abs(sec.line) >= 1) {
      const what = sec.terrain.includes('river') ? 'forced a crossing' : sec.terrain.includes('hill') ? 'seized the heights' : 'broken into the defenses';
      say(B, `${B.sides[favored].name} has ${what} in ${sec.name}!`, favored, 'good');
      sec.owner = null;
    }
  }

  function checkEnd(B) {
    for (const S of B.sides) {
      const str = sideStr(B, S.i);
      const field = B.units.filter(u => u.side === S.i && alive(u));
      const avgMor = field.length ? field.reduce((a, u) => a + u.mor * u.str, 0) / Math.max(1, field.reduce((a, u) => a + u.str, 0)) : 0;
      if (!field.length || str < S.startStr * 0.22 || avgMor < 12) {
        S.broken = true;
        field.forEach(u => { u.status = 'routed'; u.why = 'swept away in the general rout'; });
      }
    }
    const [a, b] = B.sides;
    if (a.broken || b.broken) {
      B.over = true;
      B.winner = a.broken && b.broken ? null : a.broken ? 1 : 0;
      B.endReason = B.winner == null ? 'Both armies have broken.' : `${B.sides[1 - B.winner].name}'s army has broken and flees the field.`;
      return;
    }
    if (B.round >= B.maxRounds) {
      B.over = true;
      if (B.defender != null) { B.winner = B.defender; B.endReason = `Night falls. ${B.sides[B.defender].name} still holds the field.`; return; }
      const f0 = sideStr(B, 0) / a.startStr, f1 = sideStr(B, 1) / b.startStr;
      const line = B.sectors.reduce((x, s) => x + s.line, 0);
      const score = (f0 - f1) * 3 + line * 0.15;
      B.winner = Math.abs(score) < 0.15 ? null : score > 0 ? 0 : 1;
      B.endReason = B.winner == null ? 'Darkness ends an indecisive battle.' : `Darkness falls; ${B.sides[B.winner].name} holds the field.`;
    }
  }

  function retreat(B, side) {
    B.units.filter(u => u.side === side && alive(u)).forEach(u => { u.status = 'routed'; u.why = 'withdrew in good order'; u.retreated = true; });
    B.sides[side].broken = true; B.over = true; B.winner = 1 - side;
    B.endReason = `${B.sides[side].name} sounds the retreat and leaves the field.`;
    say(B, B.endReason, side, 'rout');
  }

  function summary(B) {
    return B.sides.map(S => {
      const us = B.units.filter(u => u.side === S.i);
      const startStr = S.startStr;
      // routed units lose some extra stragglers; destroyed units count as total losses
      let lost = 0;
      us.forEach(u => {
        const was = 100;
        if (u.status === 'destroyed') lost += was;
        else lost += (was - u.str) + (u.status === 'routed' && !u.retreated ? u.str * 0.25 : 0);
      });
      const frac = Math.min(1, lost / Math.max(1, us.length * 100));
      return {
        side: S.i, name: S.name, men: S.men, lostFrac: frac, lostMen: Math.round(S.men * frac / 100) * 100,
        destroyed: us.filter(u => u.status === 'destroyed').length, routed: us.filter(u => u.status === 'routed').length, intact: us.filter(alive).length,
        generalAlive: S.general ? S.general.alive : true, generalName: S.general?.name,
      };
    });
  }

  // fully automatic battle (both sides AI) — used for campaign auto-resolve
  function autoResolve(B) {
    B.histAI = false;
    let guard = 0;
    while (!B.over && guard++ < 40) { beginRound(B); resolve(B); }
    return B;
  }

  // quick estimate of win chance by simulation
  function estimate(cfgFactory, n = 40) {
    let w = 0;
    for (let i = 0; i < n; i++) { const B = create(cfgFactory()); autoResolve(B); if (B.winner === 0) w++; else if (B.winner == null) w += 0.5; }
    return w / n;
  }

  return { create, beginRound, resolve, aiOrders, setOrders, validOrders, emptyOrders, unitsIn, sideStr, sideStrAll, power, sectorPower,
    summary, autoResolve, estimate, retreat, envelopOK, adj, penMult, matchup, addUnit, alive, cls, isRanged, CARDS, playCard, cardOK };
})();
