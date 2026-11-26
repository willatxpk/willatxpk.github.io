'use strict';
// ───────────────────────── Core: state, map, turns, events, modals, screens ─────────────────────────
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const TEST = /[?&]test/.test(location.search);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const d6 = () => ri(1, 6);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
let SET = Object.assign({ speed: 1, sfx: true, music: true }, load('gravehex_settings') || {});
const sleep = ms => new Promise(r => setTimeout(r, TEST ? 0 : ms / SET.speed));
let META = Object.assign({ echoes: 0, unlocked: {}, up: {}, descentMax: 0, runs: 0, wins: 0, bestAct: 0 }, load('gravehex_meta') || {});
const saveMeta = () => store('gravehex_meta', META);

// ── audio: tiny chiptune synth ──
let AC = null, MASTER = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = 0.35; MASTER.connect(AC.destination); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type = 'square', vol = 0.15, when = 0, slide = 0) {
  const a = audio(); if (!a) return; const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(MASTER); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, when = 0, freq = 1200) {
  const a = audio(); if (!a) return; const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = buf; const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(MASTER); s.start(t);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  click() { tone(660, 0.04, 'square', 0.05); },
  card() { tone(990, 0.03, 'square', 0.04); },
  chip(i) { tone(midi(64 + Math.min(i, 24)), 0.07, 'square', 0.06); },
  mult(i) { tone(midi(57 + Math.min(i, 24)), 0.09, 'sawtooth', 0.06); },
  xmult() { tone(midi(76), 0.12, 'square', 0.08); tone(midi(83), 0.16, 'square', 0.07, 0.07); },
  hit() { noise(0.25, 0.35, 0, 900); tone(140, 0.3, 'sawtooth', 0.18, 0, 0.3); },
  big() { noise(0.5, 0.4, 0, 600); tone(90, 0.6, 'sawtooth', 0.22, 0, 0.25); tone(midi(45), 0.6, 'square', 0.1); },
  hurt() { tone(180, 0.3, 'square', 0.16, 0, 0.4); noise(0.15, 0.2, 0, 2000); },
  dice() { for (let i = 0; i < 7; i++) noise(0.03, 0.18, i * 0.06, 3000); },
  coin() { tone(1320, 0.05, 'square', 0.07); tone(1760, 0.09, 'square', 0.07, 0.05); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'square', 0.09, i * 0.1)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.16, i * 0.25)); },
  omen() { tone(55, 1.4, 'sawtooth', 0.18, 0, 0.5); tone(58.5, 1.4, 'sawtooth', 0.12); noise(1, 0.1, 0, 300); },
  build() { tone(220, 0.08, 'square', 0.1); tone(330, 0.08, 'square', 0.1, 0.08); tone(440, 0.12, 'square', 0.1, 0.16); },
  bell() { tone(392, 1.8, 'triangle', 0.18); tone(784, 1.3, 'sine', 0.06); tone(1175, 0.9, 'sine', 0.03); },
  invoke() { [0, 4, 7, 12].forEach((s, i) => tone(midi(69 + s), 0.12, 'triangle', 0.1, i * 0.05)); },
  fail() { tone(220, 0.25, 'square', 0.1, 0, 0.6); },
};
function sfx(n, ...a) { if (SET.sfx && SFX[n] && !TEST) try { SFX[n](...a); } catch (e) { } }
let musicTimer = null, musicStep = 0, musicNext = 0;
const BASS = [45, 45, 48, 43, 45, 41, 40, 40], ARP = [0, 3, 7, 12, 15, 12, 7, 3];
function startMusic() {
  if (musicTimer || !SET.music || TEST) return; const a = audio(); if (!a) return; musicNext = a.currentTime + 0.1;
  musicTimer = setInterval(() => {
    const step = 0.24;
    while (musicNext < a.currentTime + 0.6) {
      const bar = Math.floor(musicStep / 16) % 8, s = musicStep % 16, root = BASS[bar], w = musicNext - a.currentTime;
      const tense = G && G.doom > (G.doomMax || 36) * 0.66;
      if (s % 4 === 0) tone(midi(root - 12), step * 3.6, 'triangle', 0.09, w);
      if (s % 2 === 0 && (tense || bar % 2 === 1 || s < 8)) tone(midi(root + 12 + ARP[(s / 2) % 8]), step * 0.8, 'square', 0.018, w);
      if (s === 0 && bar % 4 === 0) tone(midi(root + 24), 2.5, 'sine', 0.025, w);
      if (tense && s % 8 === 4) noise(0.06, 0.05, w, 400);
      musicNext += step; musicStep++;
    }
  }, 150);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

// ── state ──
let G = null, F = null, BUSY = false, Q = [];
const hero = id => HEROES.find(h => h.id === id);
const relic = id => RELICS.find(r => r.id === id);
const scroll = id => SCROLLS.find(s => s.id === id);
const party = () => G.heroes.map(hero);
const relicsD = () => G.relics.map(relic);
const hasRelic = id => G && G.relics.includes(id);
const hasHero = id => G && G.heroes.includes(id);
const isUnlocked = x => !x.unlock || META.unlocked[x.id];
function maxHP() { return G.baseHp + party().reduce((s, h) => s + h.hp, 0) + relicsD().reduce((s, r) => s + (r.maxHp || 0), 0); }
function scrollSlots() { return 2 + (META.up.scroll ? 1 : 0); }
function mkCard(suit, rank, ench = null) { return { id: G.cid++, suit, rank, ench }; }
function log(s) { G.log.unshift(s); G.log.length = Math.min(G.log.length, 60); renderLog(); }
const resStr = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${v} ${icon('r_' + k, 2, 'inl')}`).join(' ');
const costStr = o => Object.entries(o).map(([k, v]) => `<span class="cost" style="color:${RES[k].col}">${v}${icon('r_' + k, 2, 'inl')}</span>`).join('');
function costOf(key) { const c = Object.assign({}, COSTS[key]); if (key === 'outpost' && G.descent >= 3) c.soul = (c.soul || 0) + 1; return c; }
const canPay = o => Object.entries(o).every(([k, v]) => G.res[k] >= v);
function pay(o) { for (const [k, v] of Object.entries(o)) G.res[k] -= v; }

// ── helpers used by data (events, heroes, relics) ──
function gain(o) { const parts = []; for (const [k, v] of Object.entries(o)) { if (!v) continue; G.res[k] = Math.max(0, G.res[k] + v); parts.push(`${v > 0 ? '+' : ''}${v} ${RES[k].name}`); } sfx('coin'); renderSide(); return parts.join(', ') + (parts.length ? '.' : ''); }
function randRes(n) { const o = {}; for (let i = 0; i < n; i++) { const k = pick(RES_KEYS); o[k] = (o[k] || 0) + 1; } return o; }
function hurt(n) { n = Math.max(0, Math.round(n)); G.hp = Math.max(F ? 0 : 1, G.hp - n); sfx('hurt'); flashScreen('hurt'); renderSide(); return `−${n} HP.`; }
function healHP(n) { const before = G.hp; G.hp = Math.min(maxHP(), G.hp + n); renderSide(); if (F) renderFightHP(); const d = G.hp - before; return d > 0 ? `+${d} HP.` : ''; }
function maxHpAdd(n) { G.baseHp += n; if (n > 0) G.hp += n; G.hp = Math.min(G.hp, maxHP()); G.hp = Math.max(1, G.hp); renderSide(); return `${n > 0 ? '+' : ''}${n} max HP.`; }
function addFate(n) { G.fate += n; renderSide(); return `+${n} Fate.`; }
function doomAdd(n) { G.doom = Math.max(0, G.doom + n); renderSide(); return n > 0 ? `Doom +${n}.` : `Doom ${n}.`; }
function addCurse(n) { for (let i = 0; i < n; i++) G.deck.push(mkCard(pick(SUIT_KEYS), ri(1, 3), 'cursed')); return n > 1 ? `${n} Cursed cards join your deck.` : 'A Cursed card joins your deck.'; }
function removeCurses() { let n = 0; G.deck.forEach(c => { if (c.ench === 'cursed') { c.ench = null; n++; } }); return n ? `${n} curse${n > 1 ? 's' : ''} lifted.` : ''; }
function levelRite(key) {
  if (!key) key = pick(RITE_ORDER.slice(1, 8));
  G.riteLv[key] = (G.riteLv[key] || 1) + 1; return `${RITES[key].name} (Lv ${G.riteLv[key]})`;
}
function rankUpRandom(n, by) { const pool = shuffle(G.deck.filter(c => c.rank < 10 && c.ench !== 'cursed')).slice(0, n); pool.forEach(c => c.rank = Math.min(10, c.rank + by)); return `${pool.length} cards rise in rank.`; }
function dupRandom(n) { const pool = shuffle(G.deck.filter(c => c.ench !== 'cursed')).slice(0, n); pool.forEach(c => G.deck.push(mkCard(c.suit, c.rank, c.ench))); return `${pool.length} cards are doubled: ${pool.map(cardName).join(', ')}.`; }
function enchantRandom(e, n) { const pool = shuffle(G.deck.filter(c => !c.ench)).slice(0, n); pool.forEach(c => c.ench = e); return `${pool.length} cards become ${ENCH[e].name}: ${pool.map(cardName).join(', ')}.`; }
function revealAll() { G.revealed = true; drawMapBase(); return 'Every hex\'s secret is inked onto your map.'; }
function addSigil() { G.sigils++; renderSide(); drawMapBase(); return `A Sigil burns into your palm (${G.sigils}/2).` + (G.sigils >= 2 ? ' The Throne is unsealed!' : ''); }
function loseHero() { const i = ri(0, G.heroes.length - 1); const h = hero(G.heroes[i]); G.heroes.splice(i, 1); G.hp = Math.min(G.hp, maxHP()); renderSide(); return `${h.name} walks into the dark with it. `; }
function giveRelic(n = 3) { Q.push(() => chooseRelic(n)); return ' ✦ A relic awaits you.'; }
function giveScroll(id) {
  const s = id ? scroll(id) : pick(SCROLLS);
  if (G.scrolls.length >= scrollSlots()) { Q.push(() => replaceScroll(s.id)); return `${s.name} found (your satchel is full).`; }
  G.scrolls.push(s.id); renderSide(); return `${s.name} added to your satchel.`;
}
function giveHero(cls) { Q.push(() => chooseHero(cls ? 2 : 3, cls)); return ' ✦ A hero offers to join you.'; }
function queuePurge(n) { Q.push(async () => { for (let i = 0; i < n; i++) await purgeModal('Choose a card to destroy'); }); }
function queueFight() { Q.push(() => runFight(pick(MONSTERS[G.act]), { res: pick(RES_KEYS) })); return 'It attacks!'; }
function destroyCard(c) {
  const i = G.deck.indexOf(c); if (i >= 0) G.deck.splice(i, 1);
  if (F) for (const pile of [F.hand, F.draw, F.disc]) { const j = pile.indexOf(c); if (j >= 0) pile.splice(j, 1); }
  if (hasHero('ossian')) G.res.soul++;
  if (hasRelic('ledger')) G.ledger = (G.ledger || 0) + 2;
}
function copyCard(c) { const n = mkCard(c.suit, c.rank, c.ench); G.deck.push(n); if (F) F.hand.push(n); return n; }
async function runQueue() { while (Q.length) { const fn = Q.shift(); await fn(); if (!G || G.over) { Q = []; return; } } }

const rankLabel = r => String(r);
const cardName = c => `${rankLabel(c.rank)} of ${SUITS[c.suit].name}${c.ench ? ' (' + ENCH[c.ench].name + ')' : ''}`;
function cardTip(c) { return `<b>${cardName(c)}</b><br>${c.rank} Chips when scored${c.ench ? '<br><span style="color:' + ENCH[c.ench].col + '">' + ENCH[c.ench].desc + '</span>' : ''}`; }
function cardHTML(c, cls = '') {
  return `<div class="card s-${c.suit} ${c.ench ? 'e-' + c.ench : ''} ${cls}" data-cid="${c.id}" data-tip="${esc(cardTip(c))}">
    <div class="rk tl">${rankLabel(c.rank)}</div><div class="si">${icon(c.suit, 4)}</div><div class="rk br">${rankLabel(c.rank)}</div>
    ${c.ench ? `<div class="en">${ENCH[c.ench].name}</div>` : ''}</div>`;
}
function relicHTML(r, cls = '') { return `<div class="relic ${cls}" data-src="${r.id}" data-tip="${esc(`<b>${r.name}</b><br>${r.desc}${r.id === 'ledger' && G ? '<br>Currently +' + (G.ledger || 0) + ' Mult' : ''}`)}">${relicIcon(r.ic, r.col, 3)}</div>`; }
function heroTip(h) { const C = CLASSES[h.cls]; return `<b>${h.name}</b> <span style="color:${C.col}">${C.name}</span><br>+${h.hp} max HP<br><i>Passive:</i> ${h.passive}<br><i>Invoke (roll ${h.need}+):</i> ${h.inv}`; }
function heroCardHTML(h, cls = '', extra = '') {
  const C = CLASSES[h.cls];
  return `<div class="herocard ${cls}" data-src="${h.id}" ${extra}><div class="hc-art">${heroImg(h, 4)}</div><div class="hc-body">
    <div class="hc-name">${h.name}</div><div class="hc-cls" style="color:${C.col}">${C.name} · +${h.hp} HP</div>
    <div class="hc-p">${h.passive}</div><div class="hc-i"><span class="need">${h.need}+</span> ${h.inv}</div></div></div>`;
}

// ── map generation ──
const HS = 24, OX = 114, OY = 108, MW = 228, MH = 216;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const pips = n => n ? 6 - Math.abs(7 - n) : 0;
function genMap() {
  const coords = []; for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) coords.push([q, r]);
  const hexes = coords.map(([q, r]) => ({ q, r, x: OX + HS * Math.sqrt(3) * (q + r / 2), y: OY + HS * 1.5 * r, t: null, num: 0, enc: null, exp: false, clr: false }));
  const ci = hexes.findIndex(h => h.q === 0 && h.r === 0);
  const idx = new Map(hexes.map((h, i) => [h.q + ',' + h.r, i]));
  hexes.forEach(h => h.nb = DIRS.map(([dq, dr]) => idx.get((h.q + dq) + ',' + (h.r + dr))).filter(v => v !== undefined));
  const others = hexes.map((h, i) => i).filter(i => i !== ci);
  const terr = shuffle(['bone', 'bone', 'bone', 'bone', 'ichor', 'ichor', 'ichor', 'ichor', 'gold', 'gold', 'gold', 'gold', 'iron', 'iron', 'iron', 'soul', 'soul', 'soul']);
  others.forEach((i, k) => hexes[i].t = terr[k]);
  hexes[ci].t = 'throne'; hexes[ci].enc = 'throne';
  for (let tries = 0; tries < 400; tries++) {
    const nums = shuffle([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
    others.forEach((i, k) => hexes[i].num = nums[k]);
    const hot = n => n === 6 || n === 8;
    if (!others.some(i => hot(hexes[i].num) && hexes[i].nb.some(j => hot(hexes[j].num)))) break;
  }
  // encounters: two lairs not adjacent to each other
  let lairA, lairB;
  do { lairA = pick(others); lairB = pick(others); } while (lairA === lairB || hexes[lairA].nb.includes(lairB));
  const lp = shuffle(LAIRS[G.act].slice());
  hexes[lairA].enc = 'lair'; hexes[lairA].mon = lp[0].name;
  hexes[lairB].enc = 'lair'; hexes[lairB].mon = lp[1].name;
  const rest = shuffle(others.filter(i => i !== lairA && i !== lairB));
  const encs = ['tavern', 'market', 'shrine', 'treasure', 'event', 'event', 'event', 'event', 'event', 'monster', 'monster', 'monster', 'monster', 'monster', 'monster', 'monster'];
  rest.forEach((i, k) => hexes[i].enc = encs[k]);
  // docks on two rim hexes
  const rim = others.filter(i => Math.max(Math.abs(hexes[i].q), Math.abs(hexes[i].r), Math.abs(hexes[i].q + hexes[i].r)) === 2);
  const docks = shuffle(rim.slice()).slice(0, 2);
  hexes[docks[0]].dock = 'any'; hexes[docks[1]].dock = pick(RES_KEYS);
  // vertices
  const vmap = new Map(), verts = [];
  hexes.forEach((h, i) => {
    h.vs = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 180 * (60 * k - 30), x = h.x + HS * Math.cos(a), y = h.y + HS * Math.sin(a);
      const key = Math.round(x * 2) + ',' + Math.round(y * 2);
      if (!vmap.has(key)) { vmap.set(key, verts.length); verts.push({ x: Math.round(x), y: Math.round(y), hs: [], adj: [], b: 0 }); }
      const vi = vmap.get(key); verts[vi].hs.push(i); h.vs.push(vi);
    }
  });
  hexes.forEach(h => { for (let k = 0; k < 6; k++) { const a = h.vs[k], b = h.vs[(k + 1) % 6]; if (!verts[a].adj.includes(b)) verts[a].adj.push(b); if (!verts[b].adj.includes(a)) verts[b].adj.push(a); } });
  return { hexes, verts, ci, blight: -1 };
}
const isRim = h => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 2;
function frontier() { const M = G.map; return M.hexes.map((h, i) => i).filter(i => !M.hexes[i].exp && M.hexes[i].nb.some(j => M.hexes[j].exp)); }
function canDelve(i) { const h = G.map.hexes[i]; if (h.exp || !h.nb.some(j => G.map.hexes[j].exp)) return false; if (h.enc === 'throne' && G.sigils < 2) return false; return true; }
function startVerts() { const M = G.map; return M.verts.map((v, i) => i).filter(i => { const v = M.verts[i]; return v.hs.length === 2 && v.hs.every(h => isRim(M.hexes[h]) && M.hexes[h].enc !== 'lair'); }); }
function buildableVerts() {
  const M = G.map;
  return M.verts.map((v, i) => i).filter(i => { const v = M.verts[i]; return !v.b && v.hs.every(h => M.hexes[h].exp) && v.adj.every(a => !M.verts[a].b) && v.hs.some(h => M.hexes[h].t !== 'throne'); });
}
function tradeRate(give) {
  let r = META.up.broker ? 3 : 4; const M = G.map;
  const docks = M.hexes.filter(h => h.dock && h.vs.some(v => M.verts[v].b));
  if (docks.some(h => h.dock === 'any')) r = Math.min(r, 3);
  if (hasRelic('smuggler')) r = Math.min(r, docks.some(h => h.dock === 'any') ? 2 : 3);
  if (docks.some(h => h.dock === give)) r = Math.min(r, 2);
  return r;
}

// ── map rendering (internal low-res canvas, scaled up pixelated) ──
let GEO = null, mapBase = null, hoverHex = -1, hoverVert = -1, selHex = -1, buildMode = null, mapAnim = 0;
function computeGeo() {
  const M = G.map, own = new Int16Array(MW * MH).fill(-1), idx = new Map(M.hexes.map((h, i) => [h.q + ',' + h.r, i]));
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const dx = x + 0.5 - OX, dy = y + 0.5 - OY;
    const q = (Math.sqrt(3) / 3 * dx - dy / 3) / HS, r = (2 / 3 * dy) / HS, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    const i = idx.get(rq + ',' + rr); if (i !== undefined) own[y * MW + x] = i;
  }
  const outline = M.hexes.map(() => []);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const o = own[y * MW + x]; if (o < 0) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const xx = x + a, yy = y + b; return xx < 0 || yy < 0 || xx >= MW || yy >= MH || own[yy * MW + xx] !== o; });
    if (nb) outline[o].push(x, y);
  }
  GEO = { own, outline, mapId: M };
}
function drawMapBase() {
  if (!G || !G.map) return;
  if (!GEO || GEO.mapId !== G.map) computeGeo();
  const M = G.map; if (!mapBase) mapBase = mkCanvas(MW, MH);
  const x = mapBase.getContext('2d'); x.clearRect(0, 0, MW, MH);
  const im = x.createImageData(MW, MH), d = im.data;
  const rgbC = {}; const rgb = h => rgbC[h] || (rgbC[h] = hexToRgb(h));
  for (let py = 0; py < MH; py++) for (let px = 0; px < MW; px++) {
    const o = GEO.own[py * MW + px]; if (o < 0) continue;
    const h = M.hexes[o]; let col = terrainPixel(h.t, px, py, G.act);
    let [r, g, b] = rgb(col);
    if (!h.exp) { const k = ((px + py) & 1) ? 0.32 : 0.5; r *= k; g *= k; b *= k; }
    if (o === M.blight) { r = r * 0.6 + 60; g *= 0.5; b = b * 0.6 + 70; }
    const p = (py * MW + px) * 4; d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  // outlines
  x.fillStyle = '#0a0610';
  GEO.outline.forEach(arr => { for (let i = 0; i < arr.length; i += 2) x.fillRect(arr[i], arr[i + 1], 1, 1); });
  // per-hex content
  M.hexes.forEach((h, i) => {
    const cx = Math.round(h.x), cy = Math.round(h.y);
    if (h.t === 'throne') {
      drawRows(x, ICONS.crown, cx - 3, cy - 8);
      if (G.sigils < 2) drawRows(x, ICONS.chain, cx - 3, cy - 1);
      else { x.fillStyle = '#d0213a'; x.fillRect(cx - 1, cy, 3, 1); }
      return;
    }
    const dim = !h.exp;
    // resource icon
    const ic = ICONS['r_' + h.t];
    if (dim) { x.globalAlpha = 0.55; }
    drawRows(x, ic, cx - 4, cy - 10);
    x.globalAlpha = 1;
    // number token
    const tc = h.num === 6 || h.num === 8 ? '#d0213a' : '#2e2238';
    x.fillStyle = '#0a0610'; x.fillRect(cx - 5, cy + 1, 11, 9); x.fillRect(cx - 4, cy, 9, 11);
    x.fillStyle = dim ? '#8a7e64' : '#e8dcc0'; x.fillRect(cx - 4, cy + 1, 9, 9); x.fillRect(cx - 3, cy, 7, 11);
    const s = String(h.num); text3(x, s, cx - (s.length * 4 - 1) / 2 | 0, cy + 2, tc);
    const p = pips(h.num); x.fillStyle = tc; for (let k = 0; k < p; k++) x.fillRect(cx - p + 1 + k * 2 - 1, cy + 8, 1, 1);
    // encounter marker
    let mk = null;
    if (h.enc === 'lair' && !h.clr) mk = 'skull';
    else if (!h.exp && (G.revealed || hasRelic('pilgrim'))) mk = h.enc;
    else if (!h.exp) mk = 'q';
    if (mk === 'skull') drawRows(x, ICONS.skull, cx - 3, cy - 19);
    else if (mk === 'q') drawRows(x, ICONS.q, cx - 2, cy - 18);
    else if (mk) { const m = { monster: '#d0213a', event: '#a65cf0', tavern: '#e0a82e', market: '#40e0b0', shrine: '#5ad0ff', treasure: '#ffd44a' }[mk]; if (m) { x.fillStyle = '#0a0610'; x.fillRect(cx - 3, cy - 18, 6, 5); x.fillStyle = m; x.fillRect(cx - 2, cy - 17, 4, 3); } }
    if (h.dock) { x.fillStyle = '#0a0610'; x.fillRect(cx + 7, cy - 14, 7, 7); x.fillStyle = h.dock === 'any' ? '#ffd44a' : RES[h.dock].col; x.fillRect(cx + 8, cy - 13, 5, 5); x.fillStyle = '#0a0610'; x.fillRect(cx + 10, cy - 12, 1, 3); }
  });
  // buildings
  M.verts.forEach(v => {
    if (v.b === 1) drawRows(x, ICONS.tower, v.x - 3, v.y - 5);
    else if (v.b === 2) drawRows(x, ICONS.castle, v.x - 4, v.y - 6);
  });
  const tint = ACTS[G.act].tint; x.fillStyle = tint; x.globalCompositeOperation = 'source-atop'; x.fillRect(0, 0, MW, MH); x.globalCompositeOperation = 'source-over';
}
function mapFrame() {
  const c = $('#mapc'); if (!c || !G || !G.map || $('#scr-map').classList.contains('hide')) { mapAnim = requestAnimationFrame(mapFrame); return; }
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, MW, MH); if (mapBase) x.drawImage(mapBase, 0, 0);
  const t = performance.now() / 1000, pulse = (Math.sin(t * 4) + 1) / 2;
  const M = G.map;
  const outlineHex = (i, col) => { x.fillStyle = col; const a = GEO.outline[i]; for (let k = 0; k < a.length; k += 2) x.fillRect(a[k], a[k + 1], 1, 1); };
  if (G.phase === 'act' && !buildMode) frontier().forEach(i => { if (canDelve(i)) outlineHex(i, `rgba(255,212,74,${0.25 + pulse * 0.5})`); });
  if (M.blight >= 0) { const h = M.hexes[M.blight]; outlineHex(M.blight, `rgba(166,92,240,${0.4 + pulse * 0.6})`); drawRows(x, ICONS.doom, Math.round(h.x) + 6 - 9, Math.round(h.y) - 19 + Math.round(Math.sin(t * 3))); }
  if (selHex >= 0) outlineHex(selHex, '#ffffff');
  if (hoverHex >= 0 && hoverHex !== selHex && !buildMode) outlineHex(hoverHex, '#ffd44a');
  let vlist = null;
  if (G.phase === 'start') vlist = startVerts();
  else if (buildMode === 'outpost') vlist = buildableVerts();
  else if (buildMode === 'citadel') vlist = M.verts.map((v, i) => i).filter(i => M.verts[i].b === 1);
  if (vlist) vlist.forEach(i => { const v = M.verts[i]; const on = i === hoverVert; x.fillStyle = on ? '#ffffff' : `rgba(255,212,74,${0.5 + pulse * 0.5})`; x.fillRect(v.x - 2, v.y - 1, 5, 3); x.fillRect(v.x - 1, v.y - 2, 3, 5); x.fillStyle = '#0a0610'; x.fillRect(v.x, v.y, 1, 1); });
  // embers drifting over the board
  for (let k = 0; k < 14; k++) { const ex = (k * 53 + t * (6 + k % 5)) % MW, ey = MH - ((t * (8 + k % 7) * 2 + k * 37) % MH); x.fillStyle = k % 3 ? 'rgba(255,122,42,0.7)' : 'rgba(166,92,240,0.7)'; x.fillRect(ex | 0, ey | 0, 1, 1); }
  mapAnim = requestAnimationFrame(mapFrame);
}
function mapPos(ev) { const c = $('#mapc'), r = c.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * MW, (ev.clientY - r.top) / r.height * MH]; }
const COARSE = matchMedia('(pointer: coarse)').matches;
function nearestVert(px, py, list) { let best = -1, bd = COARSE ? 11 : 7; list.forEach(i => { const v = G.map.verts[i]; const d = Math.hypot(v.x - px, v.y - py); if (d < bd) { bd = d; best = i; } }); return best; }
function vertList() { if (G.phase === 'start') return startVerts(); if (buildMode === 'outpost') return buildableVerts(); if (buildMode === 'citadel') return G.map.verts.map((v, i) => i).filter(i => G.map.verts[i].b === 1); return null; }
function onMapMove(ev) {
  if (!G || !G.map || !GEO) return; const [px, py] = mapPos(ev);
  const vl = vertList(); hoverVert = vl ? nearestVert(px, py, vl) : -1;
  const xi = Math.floor(px), yi = Math.floor(py); hoverHex = xi >= 0 && yi >= 0 && xi < MW && yi < MH ? GEO.own[yi * MW + xi] : -1;
  const tip = $('#tip');
  if (hoverVert >= 0) showTip(vertTip(hoverVert), ev);
  else if (hoverHex >= 0) showTip(hexTip(hoverHex), ev);
  else tip.style.display = 'none';
  $('#mapc').style.cursor = (hoverVert >= 0 || (hoverHex >= 0 && !vl)) ? 'pointer' : 'default';
}
function vertTip(i) { const v = G.map.verts[i]; return '<b>Corner</b><br>' + v.hs.map(h => { const H = G.map.hexes[h]; return H.t === 'throne' ? 'The Throne (nothing)' : `${RES[H.t].terrain} · ${H.num} (${pips(H.num)} pips)`; }).join('<br>') + (G.phase === 'start' ? '<br><i>Click to make camp here.</i>' : ''); }
function hexTip(i) {
  const h = G.map.hexes[i];
  if (h.t === 'throne') return `<b>The Throne</b><br>${G.sigils < 2 ? 'Sealed. Slay both Lairs to break the seals.' : 'Unsealed. The master of this Act waits.'}`;
  let s = `<b>${RES[h.t].terrain}</b> · ${h.num}<br>Yields ${RES[h.t].name} when ${h.num} is rolled`;
  s += '<br>' + encLabel(h); if (h.dock) s += `<br>Dock: ${h.dock === 'any' ? '3:1 any' : '2:1 ' + RES[h.dock].name}`;
  if (i === G.map.blight) s += '<br><span style="color:#c890ff">Blighted — yields nothing</span>';
  return s;
}
function encLabel(h) {
  if (h.clr) return h.enc === 'camp' ? 'Your camp' : 'Cleared';
  if (h.enc === 'lair') { const L = LAIRS[G.act].find(l => l.name === h.mon); return `<span style="color:#ff5068">Lair: ${L.name}</span><br>Requires ${reqText(L.req)} ${reqMet(L.req) ? '✔' : '✘ (unprepared: +35% HP, +30% damage)'}`; }
  if (G.revealed || hasRelic('pilgrim')) return { monster: 'Monster', event: 'Strange happenings', tavern: 'Tavern', market: 'Black Market', shrine: 'Shrine', treasure: 'Treasure', camp: 'Camp' }[h.enc] || '?';
  return 'Unexplored';
}
function reqText(req) { if (req.cls) return 'a ' + req.cls.map(c => CLASSES[c].name).join(' or '); return `${req.count} heroes`; }
function reqMet(req) { if (req.cls) return G.heroes.some(id => req.cls.includes(hero(id).cls)); return G.heroes.length >= req.count; }
async function onMapClick(ev) {
  if (!G || BUSY || !GEO) return; const [px, py] = mapPos(ev);
  if (G.phase === 'start') { const v = nearestVert(px, py, startVerts()); if (v >= 0) makeCamp(v); return; }
  if (G.phase !== 'act') return;
  if (buildMode) {
    const vl = vertList(), v = nearestVert(px, py, vl);
    if (v >= 0) {
      const key = buildMode; if (!canPay(costOf(key))) { toast('Not enough resources.'); return; }
      pay(costOf(key)); G.map.verts[v].b = key === 'outpost' ? 1 : 2; sfx('build');
      log(key === 'outpost' ? 'An outpost rises from the mud.' : 'Your outpost becomes a Citadel.');
      buildMode = null; drawMapBase(); renderSide(); renderRight(); saveRun();
    } else { buildMode = null; renderRight(); }
    return;
  }
  const xi = Math.floor(px), yi = Math.floor(py); const i = xi >= 0 && yi >= 0 && xi < MW && yi < MH ? GEO.own[yi * MW + xi] : -1;
  if (i >= 0) { selHex = i; sfx('click'); renderRight(); }
}
function makeCamp(v) {
  const M = G.map; M.verts[v].b = 1;
  M.verts[v].hs.forEach(h => { M.hexes[h].exp = true; M.hexes[h].clr = true; M.hexes[h].enc = 'camp'; });
  log('You make camp at the edge of ' + ACTS[G.act].name + '.'); sfx('build');
  drawMapBase(); beginTurn();
}

// ── turns ──
async function beginTurn() {
  G.turn++; G.stats.turns++; if (G.turn > 1) G.doom++;
  G.phase = 'harvest'; buildMode = null; renderAll();
  if (G.doom >= G.doomMax && !G.bossDone) {
    await showModal({ title: 'THE THRONE AWAKENS', art: monImg(G.bossPick, 5), text: `Doom has reached ${G.doomMax}. ${G.bossPick.name} will wait no longer. It rises from the Throne and comes for you, swollen with the gathered dark (+25% HP).`, buttons: [{ t: 'Face it' }] });
    await bossFight(true); if (G) G.advanced = false; return;
  }
  await harvest();
  if (!G || G.over) return;
  G.phase = 'act'; renderAll(); saveRun();
}
async function harvest() {
  const a = d6(), b = d6(), roll = a + b, M = G.map, gainO = {};
  const wide = hasHero('wren') && [2, 3, 11, 12].includes(roll);
  M.hexes.forEach((h, i) => {
    if (h.t === 'throne' || i === M.blight || !h.exp) return;
    if (h.num !== roll && !wide) return;
    h.vs.forEach(v => { const bld = M.verts[v].b; if (bld) gainO[h.t] = (gainO[h.t] || 0) + (bld === 2 ? 4 : 2); });
  });
  relicsD().forEach(r => { if (r.harvest) { const o = r.harvest(); for (const k in o) gainO[k] = (gainO[k] || 0) + o[k]; } });
  for (const k in gainO) G.res[k] += gainO[k];
  const box = $('#harvest');
  box.innerHTML = `<div class="hv-t">HARVEST</div><div class="hv-dice">${dieHTML(a)}${dieHTML(b)}</div><div class="hv-n">${roll}</div><div class="hv-g">${roll === 7 ? '<span class="omen">OMEN</span>' : (Object.keys(gainO).length ? resStr(gainO) : '<span class="dim">nothing</span>')}${wide ? '<br><small>Wren\'s lanterns!</small>' : ''}</div>`;
  box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  sfx('dice');
  log(`Harvest: rolled ${roll}. ${Object.keys(gainO).length ? 'Gained ' + Object.entries(gainO).map(([k, v]) => v + ' ' + RES[k].name).join(', ') + '.' : roll === 7 ? '' : 'Nothing.'}`);
  renderSide();
  if (roll === 7) await omen();
  await sleep(250);
}
async function omen() {
  sfx('omen'); flashScreen('omen');
  const M = G.map, msgs = [pick(OMENS)];
  if (hasRelic('loaded')) { G.fate++; msgs.push('Your loaded die grins: +1 Fate.'); }
  const total = RES_KEYS.reduce((s, k) => s + G.res[k], 0);
  if (total > 9 && !hasRelic('wraithlamp')) {
    let lose = Math.floor(total / 2); const lost = {};
    while (lose > 0) { const k = pick(RES_KEYS.filter(k => G.res[k] > 0)); G.res[k]--; lost[k] = (lost[k] || 0) + 1; lose--; }
    msgs.push('Holding too much, you lose half: ' + Object.entries(lost).map(([k, v]) => v + ' ' + RES[k].name).join(', ') + '.');
  }
  // the Blight moves to the hex that would hurt you most
  let best = -1, bv = -1;
  M.hexes.forEach((h, i) => { if (h.t === 'throne' || i === M.blight || !h.exp) return; const val = h.vs.reduce((s, v) => s + M.verts[v].b, 0) * pips(h.num) + Math.random() * 0.5; if (val > bv) { bv = val; best = i; } });
  if (best >= 0) { M.blight = best; msgs.push(`The Blight settles on ${RES[M.hexes[best].t].terrain} ${M.hexes[best].num}. It yields nothing until cleansed.`); }
  G.doom++; msgs.push('Doom +1.');
  log('OMEN: ' + msgs.join(' '));
  drawMapBase(); renderSide();
  await showModal({ title: 'OMEN', art: icon('doom', 10), text: msgs.join('<br><br>'), buttons: [{ t: 'Endure' }] });
}
async function endTurn() { await runQueue(); if (!G || G.over) return; saveRun(); await beginTurn(); }
async function delve(i) {
  if (BUSY || G.phase !== 'act' || !canDelve(i)) return;
  BUSY = true; G.phase = 'enc'; selHex = -1; const h = G.map.hexes[i]; h.exp = true; drawMapBase(); renderAll();
  try {
    await resolveEncounter(h, i);
    if (!G || G.over) return;
    h.clr = true; drawMapBase();
    await runQueue();
  } finally { BUSY = false; }
  if (!G || G.over) return;
  if (G.advanced) { G.advanced = false; return; }
  await endTurn();
}
async function rest() {
  if (BUSY || G.phase !== 'act') return;
  const n = Math.ceil(maxHP() * 0.25); log('You rest by a guttering fire. ' + healHP(n)); sfx('bell');
  await endTurn();
}
async function resolveEncounter(h, i) {
  switch (h.enc) {
    case 'monster': { const mon = pick(MONSTERS[G.act]); await introCard(mon, 'A monster bars the way!'); await runFight(mon, { res: h.t }); break; }
    case 'lair': {
      const L = LAIRS[G.act].find(l => l.name === h.mon), met = reqMet(L.req);
      await introCard(L, met ? `Lair! Your party meets its demand (${reqText(L.req)}).` : `Lair! It demands ${reqText(L.req)} — you face it unprepared (+35% HP, +30% damage).`);
      await runFight(L, { res: h.t, lair: true, unprepared: !met }); break;
    }
    case 'throne': await bossFight(false); break;
    case 'event': {
      const pool = EVENTS.filter(e => !(G.seen || []).includes(e.id)); const ev = pick(pool.length ? pool : EVENTS);
      G.seen = (G.seen || []).concat(ev.id); await runEvent(ev); break;
    }
    case 'tavern': await tavern(); break;
    case 'market': await market(); break;
    case 'shrine': await shrine(); break;
    case 'treasure': await treasure(h); break;
  }
}
async function introCard(mon, line) {
  const abl = mon.ab.map(a => `<b>${ABIL[a].name}:</b> ${ABIL[a].desc}`).join('<br>');
  await showModal({ title: mon.name, art: monImg(mon, mon.boss ? 6 : 7, 'bob'), text: `<i>${line}</i><br><br>${abl}`, buttons: [{ t: 'Fight' }] });
}
async function bossFight(enraged) {
  const B = G.bossPick;
  if (!enraged) await showModal({ title: B.name, art: monImg(B, 6, 'bob'), text: `<i>${B.title}</i><br><br>${B.ab.map(a => `<b>${ABIL[a].name}:</b> ${ABIL[a].desc}`).join('<br>')}`, buttons: [{ t: 'Begin the final Rite' }] });
  const won = await runFight(B, { boss: true, enraged });
  if (!won) return;
  G.bossDone = true; G.stats.bosses++; G.echoes += 12;
  await actComplete();
}
async function actComplete() {
  sfx('win');
  if (G.act >= 3) { await victory(); return; }
  const heal = healHP(Math.ceil(maxHP() * 0.5));
  await showModal({ title: `ACT ${G.act} CONQUERED`, art: icon('crown', 12), text: `${G.bossPick.name} falls, and the land exhales.<br><br>${heal} Choose a relic from its hoard.`, buttons: [{ t: 'Claim the hoard' }] });
  await chooseRelic(3);
  G.act++; G.bossDone = false; G.revealed = false; G.seen = G.seen || [];
  newAct(); G.advanced = true; renderAll(); drawMapBase();
  await showModal({ title: `ACT ${G.act}: ${ACTS[G.act].name.toUpperCase()}`, art: monImg(G.bossPick, 4, 'bob dark'), text: ACTS[G.act].flavor + '<br><br><i>Choose a glowing corner on the rim to make camp.</i>', buttons: [{ t: 'Descend' }] });
  saveRun();
}
function newAct() {
  G.doom = G.descent >= 1 ? 4 : 0; G.turn = 0; G.sigils = 0; G.doomMax = G.descent >= 5 ? 30 : 36;
  G.bossPick = pick(BOSSES[G.act]); G.map = genMap(); G.phase = 'start'; GEO = null;
  if (hasRelic('moth')) G.fate += 2;
}

// ── encounters: tavern, market, shrine, treasure ──
async function tavern() {
  await showModal({ title: 'The Tavern at World\'s End', art: sceneImg('tavern', 6), text: 'Warm light, sour ale, and a handful of hard-eyed wanderers who have outlived their companions. Any of them would follow you — for a price, or for nothing at all.', buttons: [{ t: 'Look them over' }] });
  const v = await chooseHero(3, null, true);
  if (v === 'drink') log('You drink and sing with the dead. ' + healHP(15));
}
async function chooseHero(n, cls, tavernMode) {
  let pool = HEROES.filter(h => isUnlocked(h) && !G.heroes.includes(h.id) && (!cls || h.cls === cls));
  if (!pool.length) pool = HEROES.filter(h => isUnlocked(h) && !G.heroes.includes(h.id));
  if (!pool.length) { toast('No one else answers your call.'); return; }
  const opts = shuffle(pool).slice(0, n);
  const full = G.heroes.length >= 4;
  const html = `<div class="row wrap">${opts.map((h, i) => heroCardHTML(h, 'pickable', `data-i="${i}"`)).join('')}</div>${full ? '<p class="warn">Your party is full (4). Recruiting means dismissing someone.</p>' : ''}`;
  const btns = [{ t: tavernMode ? 'Just drink (+15 HP)' : 'Decline', v: tavernMode ? 'drink' : -1, cls: 'ghost' }];
  const v = await showModal({ title: 'Recruit a Hero', html, buttons: btns, pickSel: '.pickable' });
  if (v === 'drink' || v === -1 || v === undefined) return v;
  const h = opts[v];
  if (full) {
    const html2 = `<div class="row wrap">${party().map((p, i) => heroCardHTML(p, 'pickable', `data-i="${i}"`)).join('')}</div>`;
    const d = await showModal({ title: `Dismiss whom for ${h.name}?`, html: html2, buttons: [{ t: 'Keep my party', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
    if (d === -1 || d === undefined) return -1;
    G.heroes.splice(d, 1);
  }
  G.heroes.push(h.id); G.hp = Math.min(maxHP(), G.hp + h.hp); sfx('invoke');
  log(`${h.name} joins your party.`); renderSide(); return v;
}
async function chooseRelic(n) {
  const pool = RELICS.filter(r => isUnlocked(r) && !G.relics.includes(r.id));
  if (!pool.length) { log('The hoard is empty. ' + gain({ gold: 3 })); return; }
  const opts = shuffle(pool).slice(0, n);
  const html = `<div class="row wrap">${opts.map((r, i) => `<div class="pickable relicpick" data-i="${i}">${relicIcon(r.ic, r.col, 6)}<div class="rp-n">${r.name}</div><div class="rp-d">${r.desc}</div></div>`).join('')}</div>${G.relics.length >= 6 ? '<p class="warn">Your reliquary holds 6. Taking another means casting one away.</p>' : ''}`;
  const v = await showModal({ title: 'Choose a Relic', html, buttons: [{ t: 'Take none (+2 Gold)', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
  if (v === -1 || v === undefined) { gain({ gold: 2 }); return; }
  if (G.relics.length >= 6) {
    const html2 = `<div class="row wrap">${relicsD().map((r, i) => `<div class="pickable relicpick" data-i="${i}">${relicIcon(r.ic, r.col, 5)}<div class="rp-n">${r.name}</div><div class="rp-d">${r.desc}</div></div>`).join('')}</div>`;
    const d = await showModal({ title: 'Cast away which relic?', html: html2, buttons: [{ t: 'Keep mine', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
    if (d === -1 || d === undefined) return; G.relics.splice(d, 1);
  }
  G.relics.push(opts[v].id); sfx('invoke'); log(`Relic claimed: ${opts[v].name}.`);
  G.hp = Math.min(G.hp + (opts[v].maxHp || 0), maxHP()); renderSide();
}
async function replaceScroll(id) {
  const s = scroll(id);
  const html = `<p>Your satchel is full. Discard one to keep <b>${s.name}</b>?</p><div class="row wrap">${G.scrolls.map((sid, i) => { const o = scroll(sid); return `<div class="pickable relicpick" data-i="${i}">${relicIcon(o.ic, o.col, 5)}<div class="rp-n">${o.name}</div><div class="rp-d">${o.desc}</div></div>`; }).join('')}</div>`;
  const v = await showModal({ title: 'Satchel full', html, buttons: [{ t: 'Leave the new scroll', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
  if (v === -1 || v === undefined) return; G.scrolls[v] = id; renderSide();
}
function randCard(act, enchBoost = 0) {
  const lo = [0, 2, 4, 6][act], hi = [0, 8, 10, 10][act];
  const c = mkCard(pick(SUIT_KEYS), ri(lo, hi));
  if (Math.random() < 0.1 + 0.08 * act + enchBoost) c.ench = pick(['gilded', 'bloodied', 'glass', 'holy']);
  return c;
}
async function chooseCard(cards, title = 'Add a card to your deck') {
  const html = `<div class="row wrap cardrow">${cards.map((c, i) => `<div class="pickable" data-i="${i}">${cardHTML(c)}</div>`).join('')}</div>`;
  const v = await showModal({ title, html, buttons: [{ t: 'Skip (+1 Gold)', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
  if (v === -1 || v === undefined) { gain({ gold: 1 }); return null; }
  G.deck.push(cards[v]); sfx('card'); log(`Added ${cardName(cards[v])} to your deck.`); return cards[v];
}
async function purgeModal(title = 'Destroy a card forever', optional = true) {
  const deck = sortedDeck();
  const html = `<div class="row wrap cardrow small">${deck.map((c, i) => `<div class="pickable" data-i="${i}">${cardHTML(c)}</div>`).join('')}</div>`;
  const v = await showModal({ title, html, buttons: optional ? [{ t: 'Cancel', v: -1, cls: 'ghost' }] : [], pickSel: '.pickable', wide: true });
  if (v === -1 || v === undefined) return false;
  const c = deck[v]; destroyCard(c); log(`Destroyed ${cardName(c)}.`); sfx('hit'); renderSide(); return true;
}
const sortedDeck = () => G.deck.slice().sort((a, b) => SUIT_KEYS.indexOf(a.suit) - SUIT_KEYS.indexOf(b.suit) || a.rank - b.rank);
async function market() {
  const stock = [];
  for (let i = 0; i < 3; i++) { const c = randCard(G.act, 0.15); stock.push({ kind: 'card', c, cost: c.ench ? { gold: 2, iron: 1 } : { gold: 1, iron: 1 } }); }
  shuffle(RELICS.filter(r => isUnlocked(r) && !G.relics.includes(r.id))).slice(0, 2).forEach(r => stock.push({ kind: 'relic', r, cost: { gold: 3, soul: 1 } }));
  shuffle(SCROLLS.slice()).slice(0, 2).forEach(s => stock.push({ kind: 'scroll', s, cost: { gold: 1, ichor: 1 } }));
  stock.push({ kind: 'purge', cost: { soul: 1, bone: 1 } });
  stock.push({ kind: 'tome', cost: { soul: 1, gold: 2 } });
  while (true) {
    const html = `<p class="flav">"Everything is for sale," hisses the hooded thing behind the counter. "Even you. Especially you."</p>
      <div class="shop">${stock.map((it, i) => {
        if (it.sold) return `<div class="shopit sold">SOLD</div>`;
        let inner = '';
        if (it.kind === 'card') inner = cardHTML(it.c);
        else if (it.kind === 'relic') inner = `<div class="relicpick" data-tip="${esc(it.r.desc)}">${relicIcon(it.r.ic, it.r.col, 5)}<div class="rp-n">${it.r.name}</div><div class="rp-d">${it.r.desc}</div></div>`;
        else if (it.kind === 'scroll') inner = `<div class="relicpick">${relicIcon(it.s.ic, it.s.col, 5)}<div class="rp-n">${it.s.name}</div><div class="rp-d">${it.s.desc}</div></div>`;
        else if (it.kind === 'purge') inner = `<div class="relicpick">${icon('skull', 6)}<div class="rp-n">Purge a card</div><div class="rp-d">Destroy one card from your deck.</div></div>`;
        else inner = `<div class="relicpick">${relicIcon('book', '#a65cf0', 5)}<div class="rp-n">Forbidden Tome</div><div class="rp-d">Level up a Rite of your choice.</div></div>`;
        const room = it.kind === 'relic' ? G.relics.length < 6 : it.kind === 'scroll' ? G.scrolls.length < scrollSlots() : true;
        return `<div class="shopit ${canPay(it.cost) && room ? 'pickable' : 'poor'}" data-i="${i}">${inner}<div class="price">${room ? costStr(it.cost) : '<span class="dim small">no room</span>'}</div></div>`;
      }).join('')}</div>`;
    const v = await showModal({ title: 'The Black Market', art: sceneImg('market', 5), html, wide: true, pickSel: '.shopit.pickable', buttons: [{ t: 'Trade resources', v: 'trade', cls: 'ghost' }, { t: 'Leave', v: -1 }] });
    if (v === -1 || v === undefined) return;
    if (v === 'trade') { await tradeModal(); continue; }
    const it = stock[v]; if (!canPay(it.cost)) continue;
    if (it.kind === 'card') { pay(it.cost); G.deck.push(it.c); it.sold = true; log(`Bought ${cardName(it.c)}.`); sfx('coin'); }
    else if (it.kind === 'relic') { if (G.relics.length >= 6) { toast('Your reliquary is full.'); continue; } pay(it.cost); G.relics.push(it.r.id); it.sold = true; log(`Bought ${it.r.name}.`); sfx('invoke'); }
    else if (it.kind === 'scroll') { if (G.scrolls.length >= scrollSlots()) { toast('Your satchel is full.'); continue; } pay(it.cost); G.scrolls.push(it.s.id); it.sold = true; sfx('coin'); }
    else if (it.kind === 'purge') { if (await purgeModal()) { pay(it.cost); it.sold = true; } }
    else if (it.kind === 'tome') { if (await tomeModal()) { pay(it.cost); it.sold = true; } }
    renderSide();
  }
}
async function tomeModal(n = 3) {
  const opts = shuffle(RITE_ORDER.slice(1, 9)).slice(0, n);
  const html = `<div class="row wrap">${opts.map((k, i) => { const R = RITES[k], lv = G.riteLv[k] || 1; return `<div class="pickable relicpick" data-i="${i}">${relicIcon('book', '#a65cf0', 5)}<div class="rp-n">${R.name}</div><div class="rp-d">${R.desc}<br>Lv ${lv} → ${lv + 1}<br><span class="chips">+${R.lc} Chips</span> <span class="mult">+${R.lm} Mult</span></div></div>`; }).join('')}</div>`;
  const v = await showModal({ title: 'Study a Rite', html, buttons: [{ t: 'Cancel', v: -1, cls: 'ghost' }], pickSel: '.pickable' });
  if (v === -1 || v === undefined) return false;
  log('Studied: ' + levelRite(opts[v])); sfx('invoke'); return true;
}
async function shrine() {
  const v = await showModal({ title: 'A Forgotten Shrine', art: sceneImg('shrine', 6), text: 'A blue flame burns on a cairn of skulls, fed by nothing. Saints have prayed here, and worse things than saints. It will grant you one boon.',
    buttons: [{ t: 'Pray (+2 Fate, +10 HP)', v: 0 }, { t: 'Offer blood (−8 HP: level a Rite)', v: 1 }, { t: 'Lay down a burden (destroy a card)', v: 2 }] });
  if (v === 0) log('You pray. ' + addFate(2) + ' ' + healHP(10));
  else if (v === 1) { hurt(8); await tomeModal(3); }
  else if (v === 2) await purgeModal('Lay down which card?', false);
}
async function treasure(h) {
  const v = await showModal({ title: 'A Sealed Reliquary', art: sceneImg('chest', 6), text: 'An iron-bound chest, chained to the corpse of whoever was guarding it. The corpse is still holding the key.', buttons: [{ t: 'Open it (choose a relic)', v: 0 }, { t: 'Break it for scrap', v: 1 }] });
  if (v === 0) await chooseRelic(2);
  else log('You smash it apart. ' + gain({ gold: 3, iron: 2, soul: 1 }));
}

// ── events (choose your own adventure) ──
function classBonus(check) { let b = 0; party().forEach(h => { b += check.cls[h.cls] || 0; }); if (hasRelic('gambler')) b += 1; return b; }
async function runEvent(ev) {
  G.stats.events++;
  const btns = ev.choices.map((c, i) => {
    let label = c.t, dis = false, sub = '';
    if (c.cost) { sub += costStr(c.cost); if (!canPay(c.cost)) dis = true; }
    if (c.req && !c.req()) { dis = true; sub += ` <span class="warn">${c.reqText}</span>`; }
    if (c.check) { const b = classBonus(c.check); sub += ` <span class="chk">Roll ${c.check.n}+ · ${Object.entries(c.check.cls).map(([k, v]) => `${CLASSES[k].name} +${v}`).join(', ')} · <b>you +${b}</b></span>`; }
    return { t: label, sub, v: i, disabled: dis };
  });
  const v = await showModal({ title: ev.title, art: sceneImg(ev.art, 6), text: ev.text, buttons: btns, vertical: true });
  const c = ev.choices[v]; if (!c) return;
  if (c.cost) pay(c.cost);
  if (c.hpCost) { G.hp = Math.max(1, G.hp - c.hpCost); sfx('hurt'); renderSide(); }
  let res;
  if (c.check) {
    const b = classBonus(c.check); const ok = await diceCheck(c.check.n, b, ev.title);
    res = ok ? c.win() : c.lose();
  } else res = c.go();
  renderSide();
  await showModal({ title: ev.title, art: sceneImg(ev.art, 4), text: `<i>${c.t}</i><br><br>${res}`, buttons: [{ t: 'Continue' }] });
}
function dieHTML(n) { const P = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n]; return `<div class="die">${[...Array(9)].map((_, i) => `<i class="${P.includes(i) ? 'on' : ''}"></i>`).join('')}</div>`; }
async function rollDice(title, need, bonus) {
  const ov = $('#diceov'); ov.classList.remove('hide');
  const a = d6(), b = d6();
  sfx('dice');
  for (let k = 0; k < (TEST ? 1 : 10); k++) { ov.innerHTML = `<div class="dv-t">${title}</div><div class="dv-d tumble">${dieHTML(d6())}${dieHTML(d6())}</div><div class="dv-n">need ${need}+</div>`; await sleep(55); }
  const total = a + b + bonus, ok = total >= need;
  ov.innerHTML = `<div class="dv-t">${title}</div><div class="dv-d">${dieHTML(a)}${dieHTML(b)}</div><div class="dv-n">${a} + ${b}${bonus ? ' + ' + bonus : ''} = <b class="${ok ? 'ok' : 'bad'}">${total}</b> <small>(need ${need}+)</small></div>`;
  return { a, b, total, ok };
}
async function diceCheck(need, bonus, title) {
  let { total, ok } = await rollDice(title, need, bonus);
  const ov = $('#diceov');
  if (!ok && G.fate >= need - total) {
    const cost = need - total;
    const yes = await new Promise(res => {
      ov.insertAdjacentHTML('beforeend', `<div class="dv-fate">Spend <b>${cost}</b> Fate to bend the dice? (you have ${G.fate})<br><button class="btn" id="fy">Spend ${cost} Fate</button> <button class="btn ghost" id="fn">Accept fate</button></div>`);
      $('#fy').onclick = () => res(true); $('#fn').onclick = () => res(false);
      if (TEST) res(true);
    });
    if (yes) { G.fate -= cost; ok = true; renderSide(); }
  } else await sleep(ok ? 650 : 900);
  sfx(ok ? 'invoke' : 'fail');
  ov.querySelector('.dv-n').insertAdjacentHTML('beforeend', `<div class="${ok ? 'ok' : 'bad'} big">${ok ? 'SUCCESS' : 'FAILURE'}</div>`);
  await sleep(700);
  ov.classList.add('hide');
  return ok;
}

// ── trading ──
async function tradeModal() {
  let give = 'bone', get = 'gold';
  while (true) {
    const rate = tradeRate(give);
    const html = `<p>Give <b>${rate}</b> of one resource for <b>1</b> of another. Docks you've built on improve the rate.</p>
      <div class="trade"><div><div class="lbl">GIVE ${rate}</div>${RES_KEYS.map(k => `<button class="resbtn ${k === give ? 'on' : ''}" data-give="${k}">${icon('r_' + k, 3)}<span>${G.res[k]}</span><small>${tradeRate(k)}:1</small></button>`).join('')}</div>
      <div class="arrow">➜</div><div><div class="lbl">GET 1</div>${RES_KEYS.map(k => `<button class="resbtn ${k === get ? 'on' : ''}" data-get="${k}">${icon('r_' + k, 3)}<span>${G.res[k]}</span></button>`).join('')}</div></div>`;
    const v = await showModal({ title: 'Black Market Trade', html, buttons: [{ t: `Trade ${rate} ${RES[give].name} → 1 ${RES[get].name}`, v: 'go', disabled: G.res[give] < rate || give === get }, { t: 'Done', v: -1, cls: 'ghost' }], onOpen: (m, res) => {
      m.querySelectorAll('[data-give]').forEach(b => b.onclick = () => { give = b.dataset.give; res('re'); });
      m.querySelectorAll('[data-get]').forEach(b => b.onclick = () => { get = b.dataset.get; res('re'); });
    } });
    if (v === 'go') { G.res[give] -= rate; G.res[get]++; sfx('coin'); log(`Traded ${rate} ${RES[give].name} for 1 ${RES[get].name}.`); renderSide(); }
    else if (v !== 're') return;
  }
}

// ── generic modal ──
let modalResolve = null;
function showModal({ title, art, text, html, buttons = [], pickSel, wide, vertical, onOpen }) {
  return new Promise(res => {
    const m = $('#modal'); m.classList.remove('hide');
    m.innerHTML = `<div class="mbox ${wide ? 'wide' : ''}"><div class="mtitle">${title || ''}</div>${art ? `<div class="mart">${art}</div>` : ''}${text ? `<div class="mtext">${text}</div>` : ''}${html || ''}
      <div class="mbtns ${vertical ? 'vert' : ''}">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-b="${i}" ${b.disabled ? 'disabled' : ''}>${b.t}${b.sub ? `<div class="bsub">${b.sub}</div>` : ''}</button>`).join('')}</div></div>`;
    const done = v => { m.classList.add('hide'); m.innerHTML = ''; modalResolve = null; res(v); };
    modalResolve = done;
    m.querySelectorAll('[data-b]').forEach(el => el.onclick = () => { sfx('click'); const b = buttons[+el.dataset.b]; done(b.v !== undefined ? b.v : +el.dataset.b); });
    if (pickSel) m.querySelectorAll(pickSel).forEach(el => el.onclick = () => { sfx('click'); done(+el.dataset.i); });
    if (onOpen) onOpen(m, done);
  });
}
function toast(s) { const t = $('#toast'); t.innerHTML = s; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function flashScreen(kind) { const f = $('#flash'); f.className = ''; void f.offsetWidth; f.className = 'f-' + kind; }
function showTip(html, ev) { const t = $('#tip'); t.innerHTML = html; t.style.display = 'block'; const w = t.offsetWidth, h = t.offsetHeight; let x = ev.clientX + 16, y = ev.clientY + 16; if (x + w > innerWidth - 8) x = ev.clientX - w - 12; if (y + h > innerHeight - 8) y = ev.clientY - h - 12; t.style.left = x + 'px'; t.style.top = y + 'px'; }
document.addEventListener('mousemove', ev => {
  if (ev.target.closest && ev.target.closest('#mapc')) return;
  const el = ev.target.closest && ev.target.closest('[data-tip]');
  if (el) showTip(el.dataset.tip, ev); else $('#tip').style.display = 'none';
});

// ── map screen UI ──
function renderAll() { if (!G) return; renderTop(); renderSide(); renderRight(); renderLog(); }
function renderTop() {
  if (!G) return;
  const dm = G.doom / G.doomMax;
  $('#topbar').innerHTML = `<div class="tb-act">ACT ${G.act} · ${ACTS[G.act].name}</div>
    <div class="tb-turn">Turn ${G.turn}</div>
    <div class="tb-doom" data-tip="${esc('<b>Doom</b><br>+1 each turn, +1 on every Omen. Monsters grow stronger as it rises (+8% HP per 6 Doom, +1 damage per 12). At ' + G.doomMax + ' the Throne\'s master comes for you, empowered.')}">${icon('doom', 2)}<div class="bar"><i style="width:${Math.min(100, dm * 100)}%"></i></div><span>${G.doom}/${G.doomMax}</span></div>
    <div class="tb-sig" data-tip="${esc('<b>Sigils</b><br>Slay both Lairs to unseal the Throne.')}">${icon('sigil', 2)} ${G.sigils}/2</div>
    <div class="tb-btns"><button class="btn sm" id="b-deck">Deck (${G.deck.length})</button><button class="btn sm" id="b-rites">Rites</button><button class="btn sm ghost" id="b-menu">☰</button></div>`;
  $('#b-deck').onclick = deckModal; $('#b-rites').onclick = ritesModal; $('#b-menu').onclick = pauseMenu;
}
function renderSide() {
  if (!G || !$('#left')) return;
  renderTop();
  const mh = maxHP();
  $('#left').innerHTML = `
    <div class="panel"><div class="ptitle">Vitality</div>
      <div class="hpbar"><i style="width:${G.hp / mh * 100}%"></i><span>${icon('heart', 2, 'inl')} ${G.hp} / ${mh}</span></div>
      <div class="fate" data-tip="${esc('<b>Fate</b><br>Spend after a failed roll (hero invocations, event checks) to add +1 per Fate.')}">${icon('fate', 2, 'inl')} Fate: <b>${G.fate}</b></div></div>
    <div class="panel"><div class="ptitle">Resources</div><div class="resgrid">${RES_KEYS.map(k => `<div class="res" data-tip="${esc(`<b>${RES[k].name}</b><br>From ${RES[k].terrain} hexes`)}">${icon('r_' + k, 3)}<b style="color:${RES[k].col}">${G.res[k]}</b></div>`).join('')}</div></div>
    <div class="panel"><div class="ptitle">Party (${G.heroes.length}/4)</div><div class="partylist">${party().map(h => `<div class="pmini" data-tip="${esc(heroTip(h))}">${heroImg(h, 2)}<div><div class="pm-n">${h.name}</div><div class="pm-c" style="color:${CLASSES[h.cls].col}">${CLASSES[h.cls].name}</div></div></div>`).join('')}</div></div>
    <div class="panel"><div class="ptitle">Reliquary (${G.relics.length}/6)</div><div class="reliclist">${relicsD().map(r => relicHTML(r)).join('') || '<span class="dim">empty</span>'}</div></div>
    <div class="panel"><div class="ptitle">Satchel (${G.scrolls.length}/${scrollSlots()})</div><div class="reliclist">${G.scrolls.map((id, i) => { const s = scroll(id); return `<div class="relic scrollbtn ${s.anywhere ? 'usable' : ''}" data-si="${i}" data-tip="${esc(`<b>${s.name}</b><br>${s.desc}${s.anywhere ? '<br><i>Click to use.</i>' : '<br><i>Use during a fight.</i>'}`)}">${relicIcon(s.ic, s.col, 3)}</div>`; }).join('') || '<span class="dim">empty</span>'}</div></div>`;
  $$('#left .scrollbtn.usable').forEach(el => el.onclick = () => { const i = +el.dataset.si, s = scroll(G.scrolls[i]); G.scrolls.splice(i, 1); s.use([]); toast(s.name + ' used.'); sfx('invoke'); renderSide(); });
}
function actionBtn(label, cost, fn, opts = {}) {
  const ok = (!cost || canPay(cost)) && !opts.disabled;
  return { html: `<button class="btn act ${ok ? '' : 'off'}" ${ok ? '' : 'disabled'} data-act="${opts.id}" data-tip="${esc(opts.tip || '')}"><span>${label}</span><span class="costs">${cost ? costStr(cost) : ''}</span></button>`, id: opts.id, fn };
}
function renderRight() {
  if (!G || !$('#right')) return;
  const acts = [];
  let info = '';
  if (G.phase === 'start') info = `<div class="panel glow"><div class="ptitle">Make Camp</div><p>Click a glowing corner on the rim of the map. The two hexes it touches become your camp, and you get a free Outpost there.</p></div>`;
  else if (G.phase !== 'act') info = `<div class="panel"><div class="ptitle">…</div></div>`;
  else {
    if (selHex >= 0) {
      const h = G.map.hexes[selHex];
      info = `<div class="panel"><div class="ptitle">${h.t === 'throne' ? 'The Throne' : RES[h.t].terrain + ' · ' + h.num}</div><div class="hexinfo">${hexTip(selHex)}</div></div>`;
      if (canDelve(selHex)) acts.push(actionBtn(h.enc === 'throne' ? '⚔ Storm the Throne' : '⚔ Delve here', null, () => delve(selHex), { id: 'delve', tip: 'Enter this hex and face what waits. Ends your turn.' }));
      else if (h.enc === 'throne' && !h.exp && G.sigils < 2) info += '<p class="dim small">The Throne is sealed: slay both Lairs first.</p>';
      else if (!h.exp) info += '<p class="dim small">Too far — delve into a neighbouring hex first.</p>';
      if (selHex === G.map.blight) {
        acts.push(actionBtn('Cleanse the Blight', COSTS.cleanse, () => { pay(COSTS.cleanse); G.map.blight = -1; log('You burn the Blight away.'); sfx('bell'); drawMapBase(); renderAll(); }, { id: 'cleanse' }));
        acts.push(actionBtn('⚔ Hunt the Blight', null, () => huntBlight(), { id: 'hunt', tip: 'Fight a Blightspawn. Win: the Blight lifts and you gain 2 Soul. Ends your turn.' }));
      }
    } else info = `<div class="panel"><div class="ptitle">Your Turn</div><p class="small">Click a hex for details. Glowing hexes can be delved — each delve ends your turn. Build and craft as much as you can afford first.</p></div>`;
  }
  const B = [];
  if (G.phase === 'act') {
    B.push(actionBtn(buildMode === 'outpost' ? '✕ Cancel building' : '⌂ Build Outpost', buildMode === 'outpost' ? null : costOf('outpost'), () => { buildMode = buildMode === 'outpost' ? null : 'outpost'; if (buildMode && !buildableVerts().length) { toast('No valid corner: all touching hexes must be explored, and no building may stand next door.'); buildMode = null; } renderRight(); }, { id: 'outpost', tip: 'Place on a corner where every touching hex is explored, not adjacent to another building. Yields 2 per touching hex when its number is rolled.' }));
    B.push(actionBtn(buildMode === 'citadel' ? '✕ Cancel' : '♜ Raise Citadel', buildMode === 'citadel' ? null : costOf('citadel'), () => { buildMode = buildMode === 'citadel' ? null : 'citadel'; renderRight(); }, { id: 'citadel', tip: 'Upgrade an outpost: yields 4 instead of 2.' }));
    B.push(actionBtn('✚ Tend Wounds (+15 HP)', costOf('tend'), () => { pay(costOf('tend')); log('Poultice and prayer. ' + healHP(15)); renderAll(); }, { id: 'tend', disabled: G.hp >= maxHP() }));
    B.push(actionBtn('⚒ Forge a Card', costOf('forge'), async () => { pay(costOf('forge')); renderSide(); const n = META.up.eye ? 4 : 3; await chooseCard([...Array(n)].map(() => randCard(G.act, 0.1)), 'Forge a card'); renderAll(); }, { id: 'forge' }));
    B.push(actionBtn('☥ Summon a Hero', costOf('summon'), async () => { pay(costOf('summon')); renderSide(); const v = await chooseHero(2); if (v === -1 || v === undefined) { gain(costOf('summon')); } renderAll(); }, { id: 'summon' }));
    B.push(actionBtn('✎ Study a Tome', costOf('tome'), async () => { if (await tomeModal()) pay(costOf('tome')); renderAll(); }, { id: 'tome' }));
    B.push(actionBtn('✖ Purge a Card', costOf('purge'), async () => { if (await purgeModal()) pay(costOf('purge')); renderAll(); }, { id: 'purge' }));
    B.push(actionBtn('✧ Buy Fate', costOf('fate'), () => { pay(costOf('fate')); addFate(1); sfx('coin'); renderAll(); }, { id: 'fate' }));
    B.push(actionBtn('⇄ Black Market Trade', null, async () => { await tradeModal(); renderAll(); }, { id: 'trade', tip: 'Trade 4:1 (better with docks).' }));
    B.push(actionBtn('☾ Rest (+25% HP, ends turn)', null, () => rest(), { id: 'rest' }));
  }
  const all = acts.concat(B);
  $('#right').innerHTML = info + (acts.length ? `<div class="panel actions">${acts.map(a => a.html).join('')}</div>` : '') + (B.length ? `<div class="panel actions"><div class="ptitle">Build & Craft</div>${B.map(a => a.html).join('')}</div>` : '');
  all.forEach(a => { const el = $(`#right [data-act="${a.id}"]`); if (el) el.onclick = () => { if (BUSY) return; sfx('click'); a.fn(); }; });
}
function renderLog() { const l = $('#log'); if (!l || !G) return; l.innerHTML = G.log.slice(0, 14).map((s, i) => `<div style="opacity:${1 - i * 0.055}">${s}</div>`).join(''); }
async function huntBlight() {
  if (BUSY) return; BUSY = true; G.phase = 'enc'; renderAll();
  const base = pick(MONSTERS[G.act]); const mon = Object.assign({}, base, { name: 'Blightspawn', c: ['#4e2486', '#24103e', '#a65cf0', '#40e0b0'], hp: Math.round(base.hp * 0.9) });
  try {
    await introCard(mon, 'The Blight takes a shape, and the shape is hungry.');
    const won = await runFight(mon, { res: 'soul', blight: true });
    if (won) { G.map.blight = -1; drawMapBase(); }
    await runQueue();
  } finally { BUSY = false; }
  if (!G || G.over) return; await endTurn();
}
async function deckModal() {
  const d = sortedDeck(), counts = {}; SUIT_KEYS.forEach(s => counts[s] = d.filter(c => c.suit === s).length);
  await showModal({ title: `Your Deck (${d.length})`, html: `<p class="small">${SUIT_KEYS.map(s => `<span style="color:${SUITS[s].col}">${SUITS[s].name}: ${counts[s]}</span>`).join(' · ')}</p><div class="row wrap cardrow small">${d.map(c => cardHTML(c)).join('')}</div>`, wide: true, buttons: [{ t: 'Close' }] });
}
async function ritesModal() {
  await showModal({ title: 'The Rites', html: `<table class="rites">${RITE_ORDER.map(k => { const R = RITES[k], lv = G.riteLv[k] || 1; return `<tr><td class="rn">${R.name}</td><td class="lv">Lv ${lv}</td><td><span class="chips">${R.chips + R.lc * (lv - 1)}</span> × <span class="mult">${R.mult + R.lm * (lv - 1)}</span></td><td class="dim">${R.desc}</td></tr>`; }).join('')}</table><p class="small dim">Damage = Chips × Mult. Only the cards that form the Rite add their rank to Chips. Play up to 5 cards.</p>`, wide: true, buttons: [{ t: 'Close' }] });
}
async function pauseMenu() {
  const v = await showModal({ title: 'Paused', html: settingsHTML(), buttons: [{ t: 'Resume', v: 0 }, { t: 'How to play', v: 2, cls: 'ghost' }, { t: 'Save & quit to title', v: 1, cls: 'ghost' }, { t: 'Abandon run', v: 3, cls: 'danger' }], onOpen: bindSettings });
  if (v === 1) { saveRun(); showScreen('title'); renderTitle(); }
  else if (v === 2) { await howTo(); }
  else if (v === 3) { const s = await showModal({ title: 'Abandon this run?', text: 'Your echoes from this run will still be counted.', buttons: [{ t: 'Abandon', v: 1, cls: 'danger' }, { t: 'Keep going', v: 0 }] }); if (s === 1) { await gameOver(false, true); } }
}
function settingsHTML() {
  return `<div class="settings"><div class="lbl">Animation speed</div><div class="row">${[0.5, 1, 2, 4].map(s => `<button class="btn sm ${SET.speed === s ? 'on' : 'ghost'}" data-speed="${s}">${s}×</button>`).join('')}</div>
    <div class="row"><label><input type="checkbox" id="s-sfx" ${SET.sfx ? 'checked' : ''}> Sound effects</label> <label><input type="checkbox" id="s-mus" ${SET.music ? 'checked' : ''}> Music</label></div></div>`;
}
function bindSettings(m) {
  m.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { SET.speed = +b.dataset.speed; store('gravehex_settings', SET); m.querySelectorAll('[data-speed]').forEach(x => x.className = 'btn sm ' + (+x.dataset.speed === SET.speed ? 'on' : 'ghost')); });
  const sf = m.querySelector('#s-sfx'), mu = m.querySelector('#s-mus');
  if (sf) sf.onchange = () => { SET.sfx = sf.checked; store('gravehex_settings', SET); };
  if (mu) mu.onchange = () => { SET.music = mu.checked; store('gravehex_settings', SET); if (SET.music) startMusic(); else stopMusic(); };
}
async function howTo() {
  await showModal({ title: 'How to Play', wide: true, html: `<div class="howto">
    <p><b>Goal.</b> Survive three Acts. In each, break the two Lair seals and slay the master of the Throne at the centre of the map.</p>
    <p><b>Each turn</b> the harvest dice are rolled. Every explored hex showing that number pays <b>2</b> of its resource to each Outpost on its corners (<b>4</b> for a Citadel). A <b>7</b> is an <span class="omen">Omen</span>: if you hold more than 9 resources you lose half, and the Blight smothers your best hex.</p>
    <p>Then spend resources freely — build Outposts on corners, raise Citadels, forge cards, summon heroes, study Rites — and finally <b>delve</b> one glowing hex next to explored land. Delving ends the turn. Doom rises every turn; at the limit the Throne's master comes for you.</p>
    <p><b>Combat.</b> Select up to 5 cards and perform a <b>Rite</b> (pairs, threes, Processions of 5 ranks in a row, Bloodlines of 5 in one suit…). Damage = <span class="chips">Chips</span> × <span class="mult">Mult</span>. Only the cards that form the Rite score their rank. Heroes and relics add Chips, Mult and ×Mult. After each Rite the monster strikes back. Discard to dig for better hands.</p>
    <p><b>Heroes</b> give passives, and once per fight can be <b>invoked</b>: roll 2d6 and meet their number. If you fall short, spend Fate to make up the difference.</p>
    <p><b>Lairs</b> demand certain heroes in your party; without them the Lair is far stronger.</p>
    <p><b>Between runs</b>, Echoes buy permanent unlocks in the Ossuary. Win to unlock deeper Descents.</p></div>`, buttons: [{ t: 'Got it' }] });
}

// ── screens ──
function showScreen(id) { $$('.screen').forEach(s => s.classList.add('hide')); $('#scr-' + id).classList.remove('hide'); $('#tip').style.display = 'none'; }
function renderTitle() {
  const saved = load('gravehex_run');
  $('#scr-title').innerHTML = `<div class="title-wrap">
    <div class="candles l">${candle()}${candle()}</div><div class="candles r">${candle()}${candle()}</div>
    <div class="title-art">${monImg(BOSSES[3][0], 6, 'bob dark')}</div>
    <h1 class="logo">GRAVEHEX</h1><div class="sub">A deck-building descent through cursed lands</div>
    <div class="menu">
      ${saved && !saved.over ? `<button class="btn big" id="t-cont">Continue · Act ${saved.act}, Turn ${saved.turn}</button>` : ''}
      <button class="btn big" id="t-new">New Descent</button>
      <button class="btn" id="t-oss">The Ossuary · ${META.echoes} Echoes</button>
      <button class="btn ghost" id="t-how">How to Play</button>
      <button class="btn ghost" id="t-set">Settings</button>
    </div>
    <div class="stats dim">Runs ${META.runs} · Victories ${META.wins} · Deepest Descent unlocked ${META.descentMax}</div></div>`;
  if ($('#t-cont')) $('#t-cont').onclick = () => { audio(); startMusic(); G = saved; GEO = null; mapBase = null; enterMap(); if (G.phase === 'harvest' || G.phase === 'enc') { G.phase = 'act'; renderAll(); } };
  $('#t-new').onclick = () => { audio(); startMusic(); if (saved && !saved.over) { showModal({ title: 'Begin anew?', text: 'Your current run will be lost.', buttons: [{ t: 'Begin anew', v: 1, cls: 'danger' }, { t: 'Cancel', v: 0 }] }).then(v => { if (v) pickScreen(); }); } else pickScreen(); };
  $('#t-oss').onclick = () => { audio(); ossuary(); };
  $('#t-how').onclick = howTo;
  $('#t-set').onclick = () => showModal({ title: 'Settings', html: settingsHTML(), buttons: [{ t: 'Close' }], onOpen: bindSettings });
}
function candle() { return `<div class="candle"><div class="flame"></div><div class="wax"></div></div>`; }
function pickScreen() {
  showScreen('pick');
  const pool = shuffle(HEROES.filter(isUnlocked)).slice(0, META.up.heroes4 ? 4 : 3);
  let descent = Math.min(META.lastDescent || 0, META.descentMax), chosen = null;
  const draw = () => {
    $('#scr-pick').innerHTML = `<div class="pick-wrap"><h2 class="h2">Choose Your First Companion</h2>
      <div class="row wrap center">${pool.map((h, i) => heroCardHTML(h, 'pickable big ' + (chosen === i ? 'chosen' : ''), `data-i="${i}"`)).join('')}</div>
      <div class="panel descent"><div class="ptitle">Descent ${descent}</div><div class="row center">${[...Array(META.descentMax + 1)].map((_, d) => `<button class="btn sm ${d === descent ? 'on' : 'ghost'}" data-d="${d}">${d}</button>`).join('')}</div>
      <div class="small">${DESCENTS.slice(1, descent + 1).map((s, i) => `<div>${i + 1}. ${s}</div>`).join('') || DESCENTS[0]}</div></div>
      <div class="row center"><button class="btn ghost" id="p-back">Back</button><button class="btn big" id="p-go" ${chosen === null ? 'disabled' : ''}>Descend</button></div></div>`;
    $$('#scr-pick .pickable').forEach(el => el.onclick = () => { chosen = +el.dataset.i; sfx('click'); draw(); });
    $$('#scr-pick [data-d]').forEach(el => el.onclick = () => { descent = +el.dataset.d; draw(); });
    $('#p-back').onclick = () => { showScreen('title'); renderTitle(); };
    $('#p-go').onclick = () => { if (chosen === null) return; META.lastDescent = descent; META.runs++; saveMeta(); newRun(pool[chosen].id, descent); };
  };
  draw();
}
function newRun(heroId, descent) {
  G = { v: 1, act: 1, turn: 0, doom: 0, descent, baseHp: 50 + (META.up.hp1 ? 8 : 0) + (META.up.hp2 ? 8 : 0), hp: 0,
    res: { bone: 1, ichor: 1, iron: 1, gold: 1, soul: 1 }, fate: 1 + (META.up.fate1 ? 1 : 0), deck: [], cid: 1, heroes: [heroId], relics: [], scrolls: [], riteLv: {}, ledger: 0,
    stats: { kills: 0, lairs: 0, bosses: 0, events: 0, turns: 0 }, echoes: 0, log: [], phase: 'start', sigils: 0, seen: [] };
  if (META.up.hoard) RES_KEYS.forEach(k => G.res[k]++);
  for (const s of SUIT_KEYS) for (let r = 1; r <= 6; r++) G.deck.push(mkCard(s, r));
  if (descent >= 7) addCurse(2);
  if (META.up.relic) G.relics.push(pick(RELICS.filter(isUnlocked)).id);
  if (META.up.scroll) G.scrolls.push(pick(SCROLLS).id);
  if (META.up.tome) levelRite(pick(['pair', 'two', 'three', 'straight', 'flush']));
  G.hp = maxHP();
  newAct(); GEO = null; mapBase = null;
  enterMap();
  showModal({ title: `ACT 1: ${ACTS[1].name.toUpperCase()}`, art: monImg(G.bossPick, 4, 'bob dark'), text: ACTS[1].flavor + '<br><br><i>Choose a glowing corner on the rim of the map to make camp.</i>', buttons: [{ t: 'Descend' }] });
}
function enterMap() {
  showScreen('map'); drawMapBase(); renderAll(); fitMap();
  if (!mapAnim) mapAnim = requestAnimationFrame(mapFrame);
}
function fitMap() {
  const c = $('#mapc'), w = $('#mapwrap'); if (!c || !w) return;
  const s = Math.max(1, Math.min((w.clientWidth - 8) / MW, (w.clientHeight - 8) / MH));
  const si = s >= 2 ? Math.floor(s * 2) / 2 : s;
  c.style.width = MW * si + 'px'; c.style.height = MH * si + 'px';
}
window.addEventListener('resize', fitMap);
function saveRun() { if (G && !G.over) store('gravehex_run', G); }
async function gameOver(won, abandoned) {
  if (!G || G.over) return;
  G.over = true; F = null; BUSY = false; Q = [];
  const ech = G.echoes + (G.act - 1) * 3 + (won ? 20 + G.descent * 5 : 0);
  META.echoes += ech; META.bestAct = Math.max(META.bestAct, G.act);
  if (won) { META.wins++; if (G.descent >= META.descentMax && G.descent < DESCENTS.length - 1) META.descentMax = G.descent + 1; }
  saveMeta(); localStorage.removeItem('gravehex_run');
  sfx(won ? 'win' : 'lose');
  showScreen('over');
  $('#scr-over').innerHTML = `<div class="over-wrap"><h1 class="logo ${won ? '' : 'red'}">${won ? 'THE BLACK SUN SETS' : abandoned ? 'YOU TURN BACK' : 'YOU HAVE FALLEN'}</h1>
    <div class="sub">${won ? `Descent ${G.descent} conquered. The firmament closes its wound.` + (META.descentMax > G.descent ? ` Descent ${META.descentMax} is now open to you.` : '') : `Act ${G.act} · ${ACTS[G.act].name}, turn ${G.turn}.`}</div>
    <div class="panel"><table class="stat">
      <tr><td>Monsters slain</td><td>${G.stats.kills}</td></tr><tr><td>Lairs broken</td><td>${G.stats.lairs}</td></tr>
      <tr><td>Thrones toppled</td><td>${G.stats.bosses}</td></tr><tr><td>Strange happenings</td><td>${G.stats.events}</td></tr>
      <tr><td>Best Rite</td><td>${G.best ? G.best.toLocaleString() : 0}</td></tr>
      <tr><td><b>Echoes earned</b></td><td><b class="gold">${ech}</b></td></tr></table></div>
    <div class="row center"><button class="btn big" id="o-oss">The Ossuary (${META.echoes})</button><button class="btn" id="o-new">New Descent</button><button class="btn ghost" id="o-title">Title</button></div></div>`;
  $('#o-oss').onclick = ossuary; $('#o-new').onclick = pickScreen; $('#o-title').onclick = () => { showScreen('title'); renderTitle(); };
}
async function victory() { await gameOver(true); }
function ossuary() {
  showScreen('oss');
  const draw = () => {
    const sec = (title, items) => `<div class="panel"><div class="ptitle">${title}</div><div class="osslist">${items}</div></div>`;
    const heroes = HEROES.filter(h => h.unlock).map(h => `<div class="ossit ${META.unlocked[h.id] ? 'owned' : ''}">${heroImg(h, 3)}<div><b>${h.name}</b> <span style="color:${CLASSES[h.cls].col}">${CLASSES[h.cls].name}</span><div class="small">${h.passive}<br>Invoke ${h.need}+: ${h.inv}</div></div>${META.unlocked[h.id] ? '<span class="gold">✔</span>' : `<button class="btn sm" data-un="${h.id}" data-c="${h.unlock}" ${META.echoes < h.unlock ? 'disabled' : ''}>${h.unlock} ✦</button>`}</div>`).join('');
    const rel = RELICS.filter(r => r.unlock).map(r => `<div class="ossit ${META.unlocked[r.id] ? 'owned' : ''}">${relicIcon(r.ic, r.col, 4)}<div><b>${r.name}</b><div class="small">${r.desc}</div></div>${META.unlocked[r.id] ? '<span class="gold">✔</span>' : `<button class="btn sm" data-un="${r.id}" data-c="${r.unlock}" ${META.echoes < r.unlock ? 'disabled' : ''}>${r.unlock} ✦</button>`}</div>`).join('');
    const ups = UPGRADES.map(u => { const own = META.up[u.id], locked = u.need && !META.up[u.need]; return `<div class="ossit ${own ? 'owned' : ''}">${icon('sigil', 3)}<div><b>${u.name}</b><div class="small">${u.desc}${locked ? ' <i>(requires ' + UPGRADES.find(x => x.id === u.need).name + ')</i>' : ''}</div></div>${own ? '<span class="gold">✔</span>' : `<button class="btn sm" data-up="${u.id}" data-c="${u.cost}" ${META.echoes < u.cost || locked ? 'disabled' : ''}>${u.cost} ✦</button>`}</div>`; }).join('');
    $('#scr-oss').innerHTML = `<div class="oss-wrap"><h2 class="h2">The Ossuary</h2><div class="sub">Every death leaves an echo. Spend them on what comes after. · <b class="gold">${META.echoes} Echoes</b></div>
      <div class="oss-cols">${sec('Heroes', heroes)}${sec('Relics', rel)}${sec('Boons', ups)}</div>
      <div class="row center"><button class="btn" id="oss-back">Back</button></div></div>`;
    $$('#scr-oss [data-un]').forEach(b => b.onclick = () => { const c = +b.dataset.c; if (META.echoes < c) return; META.echoes -= c; META.unlocked[b.dataset.un] = true; saveMeta(); sfx('invoke'); draw(); });
    $$('#scr-oss [data-up]').forEach(b => b.onclick = () => { const c = +b.dataset.c; if (META.echoes < c) return; META.echoes -= c; META.up[b.dataset.up] = true; saveMeta(); sfx('invoke'); draw(); });
    $('#oss-back').onclick = () => { showScreen('title'); renderTitle(); };
  };
  draw();
}

// ── background embers ──
function bgLoop() {
  const c = $('#bg'), x = c.getContext('2d'); const W = 240, H = 135; c.width = W; c.height = H;
  const P = [...Array(60)].map(() => ({ x: Math.random() * W, y: Math.random() * H, v: 0.1 + Math.random() * 0.4, c: Math.random() < 0.7 ? '#ff7a2a' : Math.random() < 0.5 ? '#a65cf0' : '#d0213a', p: Math.random() * 6 }));
  const step = () => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07040b'); g.addColorStop(0.6, '#140818'); g.addColorStop(1, '#2a0a14');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // distant spires
    x.fillStyle = '#0c0610';
    for (let i = 0; i < 18; i++) { const sx = (i * 37) % W, sh = 20 + (i * 53 % 40); x.fillRect(sx, H - sh, 6 + (i % 3) * 3, sh); x.fillRect(sx + 2 + (i % 3), H - sh - 6, 2, 6); }
    const t = performance.now() / 1000;
    P.forEach(p => { p.y -= p.v; p.x += Math.sin(t + p.p) * 0.15; if (p.y < 0) { p.y = H; p.x = Math.random() * W; } x.fillStyle = p.c; x.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + p.p)); x.fillRect(p.x | 0, p.y | 0, 1, 1); });
    x.globalAlpha = 1;
    requestAnimationFrame(step);
  };
  step();
}

// ── boot ──
window.addEventListener('load', () => {
  bgLoop();
  const mc = $('#mapc'); mc.width = MW; mc.height = MH;
  mc.addEventListener('mousemove', onMapMove); mc.addEventListener('click', onMapClick);
  mc.addEventListener('mouseleave', () => { hoverHex = -1; hoverVert = -1; $('#tip').style.display = 'none'; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && buildMode) { buildMode = null; renderRight(); } if (F && $('#modal').classList.contains('hide')) fightKey(e); });
  showScreen('title'); renderTitle();
  if (TEST) window.__gh = testHooks();
});
