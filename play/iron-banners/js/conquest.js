// Iron Banners — Conquest mode: follow a conqueror's march across a map with one persistent army
'use strict';

const Conquest = (() => {
  const $ = id => document.getElementById(id);
  const SAVE = 'ironbanners_conquest_v1';
  let C = null, Q = null, cv, ctx, W, H, dpr = 1, raf = 0, hover = null, uid = 1;
  let walk = null, pulses = [];
  const nodeById = id => C.nodes.find(n => n.id === id);

  // ---------- map geography (rough coastlines, lon/lat)
  const ALEX_SEAS = [
    [[19, 39.8], [20.5, 38.3], [21.7, 36.8], [22.5, 36.4], [23.2, 36.4], [23.0, 37.5], [24.0, 38.0], [23.6, 38.6], [22.8, 39.2], [23.0, 40.2], [22.6, 40.5], [23.8, 40.7], [24.5, 40.9], [26.0, 40.7], [26.3, 40.0], [26.2, 39.2], [26.8, 38.4], [27.2, 37.4], [27.6, 36.7], [28.5, 36.6], [29.6, 36.2], [30.6, 36.8], [32.0, 36.5], [33.5, 36.2], [34.6, 36.8], [35.9, 36.8], [36.1, 36.0], [35.9, 35.1], [35.6, 34.3], [35.0, 33.1], [34.5, 31.6], [33.0, 31.1], [31.5, 31.5], [30.0, 31.3], [29.0, 30.9], [25.0, 31.6], [23.0, 32.5], [20.0, 31.0], [19, 30.5]],
    [[26.7, 40.4], [27.5, 40.3], [28.9, 40.4], [29.1, 41.0], [28.0, 41.0], [26.9, 40.8]],
    [[28.0, 41.2], [29.1, 41.2], [31.0, 41.1], [33.3, 42.0], [35.2, 42.0], [36.6, 41.3], [38.4, 40.9], [40.0, 41.0], [41.5, 41.5], [41.7, 43.5], [38, 44.5], [30, 45], [27.9, 42.5]],
    [[46.8, 43.6], [47.5, 42.0], [48.6, 41.0], [49.3, 40.2], [49.5, 38.0], [48.9, 37.8], [49.0, 37.4], [50.3, 37.0], [51.8, 36.6], [53.9, 36.9], [54.0, 37.5], [53.0, 39.4], [53.2, 40.6], [52.8, 41.5], [52.3, 42.0], [51.4, 43.2], [51.0, 44.5]],
    [[47.9, 30.0], [48.9, 30.3], [50.2, 29.8], [50.8, 28.8], [51.6, 27.8], [53.6, 26.8], [55.5, 26.6], [56.4, 27.1], [57.3, 25.8], [58.6, 25.6], [61.5, 25.2], [64.5, 25.3], [66.6, 25.4], [67.2, 24.8], [68.4, 23.6], [70, 21], [60, 20], [56.4, 24.0], [55.0, 25.0], [54.0, 24.1], [52.0, 24.0], [51.5, 25.4], [51.0, 26.1], [50.2, 26.3], [49.5, 27.1], [48.5, 28.5]],
    [[32.5, 29.9], [33.0, 28.5], [34.0, 27.3], [35.2, 24.5], [36.0, 22], [38.5, 22], [36.5, 25], [35.0, 28.0], [34.7, 29.4], [34.4, 28.1], [33.6, 28.0]],
  ];
  const ALEX_RIVERS = [
    [[31.0, 31.5], [31.2, 30.1], [31.0, 29.0], [30.8, 28.0], [31.3, 27.0]],
    [[38.5, 39.8], [38.3, 37.5], [38.1, 36.5], [40.2, 35.0], [43.0, 33.6], [44.4, 32.5], [46.3, 31.0], [47.6, 30.6], [48.2, 30.1]],
    [[40.0, 38.5], [42.3, 37.3], [43.1, 36.3], [43.6, 35.0], [44.4, 33.3], [45.8, 32.3], [47.2, 31.0], [47.6, 30.6]],
    [[75, 35.6], [73.5, 35.0], [72.6, 34.0], [71.5, 33.0], [70.8, 31.0], [69.5, 28.5], [68.5, 26.0], [67.6, 24.5]],
    [[74.5, 34.1], [73.6, 33.2], [73.1, 32.0], [72.1, 31.2]],
    [[76.5, 32.3], [75.5, 31.6], [74.9, 31.1], [73.5, 30.0]],
    [[78, 30.0], [77.5, 29.0], [78, 28]],
    [[73.5, 37.2], [71.5, 37.0], [68.0, 37.2], [66.0, 37.7], [64.0, 39.0], [61.0, 41.5], [60, 42.5]],
    [[73.5, 41.0], [70.5, 40.5], [69.0, 40.8], [68.0, 42.5]],
  ];
  const ALEX_MOUNTAINS = [[[30, 37.3], [36, 37.6]], [[45, 36.5], [50, 31.5]], [[66, 35.2], [71, 35.8]], [[51, 36], [58, 37.2]], [[69, 39], [72, 38.5]]];
  const ALEX_REGIONS = [['GREECE', 22.2, 39.2], ['ASIA MINOR', 32, 38.6], ['SYRIA', 37.6, 34.7], ['EGYPT', 29.4, 28.1], ['MESOPOTAMIA', 43.2, 33.4], ['PERSIS', 53.5, 29.4], ['MEDIA', 50.2, 35.2], ['PARTHIA', 57.5, 36.0], ['ARIA', 62, 34], ['BACTRIA', 66.5, 36.2], ['SOGDIANA', 66.3, 40.3], ['GEDROSIA', 63, 27.5], ['INDIA', 74.5, 30.2], ['ARABIA', 41, 29]];

  const geo = () => C.geo || { seas: ALEX_SEAS, rivers: ALEX_RIVERS, mountains: ALEX_MOUNTAINS, regions: ALEX_REGIONS, islands: [] };
  // wording that differs between conquerors
  const TERMS0 = { leader: 'Alexander', side: 'Macedon', menPer: 3500, money: 'Talents', moneyTip: 'Treasury in talents',
    loyalty: 'Loyalty', loyaltyTip: 'Loyalty of the Macedonian army. At 0 it mutinies.', legit: 'Legitimacy', legitTip: 'Legitimacy as Great King in the eyes of your Asian subjects. Prevents revolts; unlocks Persian recruits.',
    rest: 'Rest and refit', share: 'Share the plunder', revolt: 'With no garrison and little loyalty to a foreign king, {place} throws off your rule. Raise your legitimacy, or leave garrisons behind.',
    wounded: 'was wounded in the fighting', front: 'Alexander leads from the front: he may be wounded, but he will not die.', go: 'Cross into Asia', woundHist: 'historically at least 8',
    bullets: [ '<b>March</b> from place to place along the roads Alexander took. Optional detours carry risks and rewards.', '<b>🪙 Talents</b> pay for marches, mercenaries and refits. Persian treasuries will make you rich.',
      '<b>🛡 Loyalty</b> of your Macedonians falls with long marches, defeats, unpaid wages — and with going Persian. At 0 they mutiny.', '<b>👑 Legitimacy</b> with your Asian subjects prevents revolts behind you and unlocks Persian and Bactrian recruits.' ],
    endNote: "Alexander's real empire stretched from Greece and Egypt to the Indus — about 5 million km². He never lost a battle.",
    endings: {
      turnback: ['The Turn for Home', 'Like Alexander, you turn back at the Hyphasis. He led his army home through the Gedrosian desert, where thousands died, and reached Babylon, where he died in June 323 BC, not yet 33. His generals tore the empire apart within a generation.'],
      peace: ['A Negotiated Peace', "You accept Darius' terms. History will remember you as a great king of Macedon — not as the conqueror of the world."],
      ganges: ['Lord of India', 'You did what Alexander never could. Whether your empire would have outlived you is another question.'],
      mutiny: ['Mutiny', 'Your Macedonians have had enough. They refuse to march another step, and the campaign ends here.'],
      destroyed: ['Disaster', 'Your army has been destroyed. Persia endures.'] } };
  const T = () => Object.assign({}, TERMS0, C.terms || {});
  const mny = () => T().money.toLowerCase();
  function proj(lon, lat) {
    const b = C.bounds, g = geom();
    return { x: g.ox + (lon - b.lon0) / (b.lon1 - b.lon0) * g.mw, y: g.oy + (b.lat1 - lat) / (b.lat1 - b.lat0) * g.mh };
  }
  let G0 = null;
  function geom() {
    if (G0) return G0;
    const b = C.bounds;
    const aspect = ((b.lon1 - b.lon0) * Math.cos((b.midLat || 35) * Math.PI / 180)) / ((b.lat1 - b.lat0) * b.stretch);
    const pr = $('qPanel').getBoundingClientRect(), tr = $('qTop').getBoundingClientRect();
    const sidePanel = pr.top < 120; // panel docked on the right (desktop) or along the bottom (narrow screens)
    const top = tr.bottom + 10;
    const availW = (sidePanel ? pr.left : W) - 20, availH = (sidePanel ? H - 170 : pr.top - 10) - top;
    let mw = Math.max(200, availW), mh = mw / aspect;
    if (mh > availH && availH > 120) { mh = availH; mw = mh * aspect; }
    G0 = { mw, mh, ox: 10 + (availW - mw) / 2, oy: top + Math.max(0, (availH - mh) / 2) };
    return G0;
  }

  // ---------- state
  function newGame(cid) {
    C = CONQUESTS.find(c => c.id === cid);
    Q = { cid, node: C.start, path: [C.start], visited: [C.start], army: C.startArmy.map(([t, o]) => mk(t, o)), gold: C.startState.gold, loyalty: C.startState.loyalty, legit: C.startState.legit,
      flags: {}, held: { [C.start]: 'held' }, garrison: {}, won: 0, lost: 0, wounds: 0, log: [], done: {}, pending: {}, over: false, ending: null, year: nodeById(C.start).year, losses: 0 };
    say(`${C.name} sets out from ${nodeById(C.start).name}.`);
    save();
  }
  function mk(t, o = {}) { return { id: uid++, t, name: o.name || U[t].name, str: o.str ?? 100, exp: o.exp || 0 }; }
  function say(t, kind = '') { Q.log.push({ t, kind, year: Q.year }); if (Q.log.length > 200) Q.log.shift(); }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ Q, uid })); } catch (e) { /* ignore */ } }
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE)); if (!s) return false; Q = s.Q; uid = s.uid || 1000; C = CONQUESTS.find(c => c.id === Q.cid); return !!C; } catch (e) { return false; } }
  function hasSave() { try { return !!localStorage.getItem(SAVE); } catch (e) { return false; } }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function nextNodes() {
    const n = nodeById(Q.node);
    return (n.next || []).map(nodeById).filter(x => x && !Q.visited.includes(x.id) && (!x.hiddenUntil || Q.flags[x.hiddenUntil]));
  }

  function applyFx(fx = {}, ev) {
    if (fx.gold) Q.gold = Math.max(0, Q.gold + fx.gold);
    if (fx.loyalty) Q.loyalty = clamp(Q.loyalty + fx.loyalty);
    if (fx.legit) Q.legit = clamp(Q.legit + fx.legit);
    if (fx.heal) Q.army.forEach(u => u.str = Math.max(10, Math.min(100, u.str + fx.heal)));
    if (fx.flag) Q.flags[fx.flag] = true;
    if (fx.add) fx.add.forEach(([t, o]) => { if (Q.army.length < C.maxArmy) Q.army.push(mk(t, o)); });
    if (fx.removeWeak) for (let k = 0; k < fx.removeWeak && Q.army.length > 3; k++) { const w = Q.army.slice().sort((a, b) => (U[a.t].atk + U[a.t].def) * a.str - (U[b.t].atk + U[b.t].def) * b.str)[0]; Q.army = Q.army.filter(u => u !== w); }
    if (fx.remove) fx.remove.forEach(nm => { const i = Q.army.findIndex(u => u.name === nm); if (i >= 0) Q.army.splice(i, 1); });
    if (ev?.enemyDisorder) Q.pending.disorder = ev.enemyDisorder;
    if (ev?.enemyWeak) Q.pending.weak = ev.enemyWeak;
  }
  const reqOK = r => !r || ((r.gold == null || Q.gold >= r.gold) && (r.loyalty == null || Q.loyalty >= r.loyalty) && (r.legit == null || Q.legit >= r.legit));

  // ---------- screen
  function start(resume, cid = 'alexander') {
    if (!resume) newGame(cid);
    cv = $('qCanvas'); ctx = cv.getContext('2d');
    showScreen('conq');
    resize(); window.addEventListener('resize', resize);
    cv.onmousemove = e => { hover = nodeAt(e.clientX, e.clientY); cv.style.cursor = hover && nextNodes().includes(hover) ? 'pointer' : 'default'; };
    cv.onclick = e => { const n = nodeAt(e.clientX, e.clientY); if (!n) return; if (nextNodes().includes(n)) confirmMarch(n); else showNode(n); };
    cancelAnimationFrame(raf); loop();
    render();
    if (!resume) intro();
  }
  function resize() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); G0 = null; }
  function nodeAt(x, y) { let best = null, bd = 18 * 18; for (const n of C.nodes) { if (n.hiddenUntil && !Q.flags[n.hiddenUntil]) continue; const p = proj(n.lon, n.lat); const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = n; } } return best; }

  function loop() { raf = requestAnimationFrame(loop); if (!$('conq').classList.contains('show')) return; draw(); }

  function poly(pts, close = true) { ctx.beginPath(); pts.forEach(([lo, la], i) => { const p = proj(lo, la); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); if (close) ctx.closePath(); }

  function draw() {
    const g = geom(), now = performance.now();
    ctx.fillStyle = '#1c130c'; ctx.fillRect(0, 0, W, H);
    // parchment land
    ctx.save(); Draw.rr(ctx, g.ox, g.oy, g.mw, g.mh, 10); ctx.clip();
    const pg = ctx.createLinearGradient(0, g.oy, 0, g.oy + g.mh); pg.addColorStop(0, '#e9d9b0'); pg.addColorStop(1, '#d9c393'); ctx.fillStyle = pg; ctx.fillRect(g.ox, g.oy, g.mw, g.mh);
    // territory: Persian empire, then yours
    const R = g.mw * 0.055;
    for (const n of C.nodes) {
      if (n.alt || n.hiddenUntil) continue;
      const own = Q.held[n.id];
      if (own === 'held' || n.owned) continue;
      blob(n, C.enemyColor, 0.20, R);
    }
    for (const n of C.nodes) { if (Q.held[n.id] === 'revolt') blob(n, '#555555', 0.28, R); }
    for (const n of C.nodes) { if (Q.held[n.id] === 'held') blob(n, C.color, 0.42, R * 1.05); }
    // seas
    ctx.fillStyle = '#7fa3b5'; ctx.strokeStyle = '#4e7486'; ctx.lineWidth = 1.5;
    for (const s of geo().seas) { poly(s); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#e2d1a5'; for (const s of geo().islands || []) { poly(s); ctx.fill(); ctx.stroke(); }
    // rivers
    ctx.strokeStyle = '#5f8aa0'; ctx.lineWidth = 1.8;
    for (const r of geo().rivers) { poly(r, false); ctx.stroke(); }
    // mountains
    ctx.fillStyle = 'rgba(110,85,55,.55)';
    for (const [[a0, b0], [a1, b1]] of geo().mountains) for (let k = 0; k <= 8; k++) {
      const p = proj(a0 + (a1 - a0) * k / 8, b0 + (b1 - b0) * k / 8);
      ctx.beginPath(); ctx.moveTo(p.x - 6, p.y + 4); ctx.lineTo(p.x, p.y - 6); ctx.lineTo(p.x + 6, p.y + 4); ctx.fill();
    }
    // region labels
    ctx.font = `600 ${Math.max(9, g.mw / 95)}px Cinzel, serif`; ctx.fillStyle = 'rgba(80,55,30,.45)'; ctx.textAlign = 'center';
    for (const [t, lo, la] of geo().regions) { const p = proj(lo, la); ctx.fillText(t, p.x, p.y); }
    ctx.restore();
    ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 3; Draw.rr(ctx, g.ox, g.oy, g.mw, g.mh, 10); ctx.stroke();
    // possible roads
    ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(90,60,30,.45)'; ctx.lineWidth = 1.5;
    for (const n of C.nodes) for (const m of (n.next || [])) { const o = nodeById(m); if (!o || (o.hiddenUntil && !Q.flags[o.hiddenUntil])) continue; const a = proj(n.lon, n.lat), b = proj(o.lon, o.lat); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.setLineDash([]);
    // the march so far
    ctx.strokeStyle = '#8e1f10'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    const wq = walk ? Math.min(1, (now - walk.t0) / walk.dur) : 1;
    const ease = wq < 0.5 ? 2 * wq * wq : 1 - Math.pow(-2 * wq + 2, 2) / 2;
    ctx.beginPath(); Q.path.forEach((id, i) => { const n = nodeById(id); let p = proj(n.lon, n.lat);
      if (walk && i === Q.path.length - 1) { const a = proj(walk.from.lon, walk.from.lat); p = { x: a.x + (p.x - a.x) * ease, y: a.y + (p.y - a.y) * ease }; }
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
    if (walk && wq >= 1) { const r = walk.res; walk = null; r(); }
    // nodes
    const avail = nextNodes();
    for (const n of C.nodes) {
      if (n.hiddenUntil && !Q.flags[n.hiddenUntil]) continue;
      const p = proj(n.lon, n.lat);
      const visited = Q.visited.includes(n.id), cur = Q.node === n.id, can = avail.includes(n);
      const r = cur ? 9 : 7;
      if (can) { ctx.strokeStyle = '#a8461f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 + Math.sin(now / 250) * 2, 0, 7); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7);
      ctx.fillStyle = visited ? (Q.held[n.id] === 'revolt' ? '#777' : C.color) : n.alt ? '#e9dcc0' : '#f4ead2'; ctx.fill();
      ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a1a0c';
      ctx.fillText({ battle: '⚔', siege: '♜', city: '●', event: '✦', end: '⚑', start: '★' }[n.kind] || '', p.x, p.y + 0.5);
      if (Q.garrison[n.id]) { ctx.fillStyle = '#2a1a0c'; ctx.font = '700 9px Inter'; ctx.fillText('G', p.x + 10, p.y - 9); }
      const show = cur || can || hover === n || visited || W > 1100;
      if (show) {
        ctx.font = `${cur || can ? 700 : 600} 11px Inter`; ctx.textBaseline = 'alphabetic';
        const t = n.name + (n.optional && !visited ? ' (optional)' : ''); const tw = ctx.measureText(t).width;
        ctx.fillStyle = 'rgba(244,234,210,.85)'; ctx.fillRect(p.x - tw / 2 - 3, p.y - r - 17, tw + 6, 14);
        ctx.fillStyle = can ? '#8e1f10' : '#2a1a0c'; ctx.fillText(t, p.x, p.y - r - 6);
      }
    }
    drawPulses(now); armyBanner(now);
  }
  function armyBanner(now) {
    const n = nodeById(Q.node); let p = proj(n.lon, n.lat);
    if (walk) { const a = proj(walk.from.lon, walk.from.lat), q = Math.min(1, (now - walk.t0) / walk.dur), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; p = { x: a.x + (p.x - a.x) * e, y: a.y + (p.y - a.y) * e };
      if (Math.random() < 0.5) pulses.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y + 4, t0: now, dust: true }); }
    const bob = walk ? Math.abs(Math.sin(now / 90)) * 3 : 0, x = p.x + 12, y = p.y - 4 - bob;
    ctx.save();
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 22); ctx.stroke();
    ctx.fillStyle = '#c9a44a'; ctx.beginPath(); ctx.arc(x, y - 23, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 20);
    for (let k = 0; k <= 10; k++) { const fx = x + k * 2.2, fy = y - 20 + Math.sin(now / 160 + k * 0.6) * 1.8 * (k / 10); ctx.lineTo(fx, fy); }
    for (let k = 10; k >= 0; k--) { const fx = x + k * 2.2, fy = y - 8 + Math.sin(now / 160 + k * 0.6) * 1.8 * (k / 10); ctx.lineTo(fx, fy); }
    ctx.closePath(); ctx.fillStyle = C.color; ctx.fill(); ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function drawPulses(now) {
    pulses = pulses.filter(p => now - p.t0 < (p.dust ? 700 : 1600));
    for (const p of pulses) {
      const q = (now - p.t0) / (p.dust ? 700 : 1600);
      ctx.save(); ctx.globalAlpha = 1 - q;
      if (p.dust) { ctx.fillStyle = '#a08458'; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + q * 5, 0, 7); ctx.fill(); }
      else { const c = proj(p.lon, p.lat); ctx.strokeStyle = p.color; ctx.lineWidth = 4 * (1 - q) + 1; ctx.beginPath(); ctx.arc(c.x, c.y, 10 + q * 60, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
  }
  function blob(n, col, a, R) {
    const p = proj(n.lon, n.lat);
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    const c = parseInt(col.slice(1), 16), rgb = `${c >> 16},${(c >> 8) & 255},${c & 255}`;
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.7, `rgba(${rgb},${a * 0.8})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill();
  }

  // ---------- panel
  function render() {
    const n = nodeById(Q.node);
    const held = Object.values(Q.held).filter(v => v === 'held').length;
    $('qTop').innerHTML = `<button class="small" id="qMenu">☰</button><div><b class="title" style="font-size:16px">${C.name}</b><div class="tip">${Q.year} · ${n.name}</div></div>
      <div class="r" title="${T().moneyTip}">🪙<b>${Q.gold}</b><span>${T().money}</span></div>
      <div class="r" title="${T().loyaltyTip}">🛡<b class="${Q.loyalty < 30 ? 'bad' : ''}">${Q.loyalty}</b><span>${T().loyalty}</span></div>
      <div class="r" title="${T().legitTip}">👑<b>${Q.legit}</b><span>${T().legit}</span></div>
      <div class="r" title="Regions you hold">🗺<b>${held}</b><span>Regions</span></div>
      <div class="r">⚔<b>${Q.won}</b><span>Victories</span></div>`;
    $('qMenu').onclick = () => modal(`<h2>${C.name}</h2><div class="tip">Progress saves automatically.</div><div class="acts"><button id="qQuit">Save & main menu</button><button class="primary" onclick="closeModal()">Resume</button></div>`) || ($('qQuit').onclick = () => { save(); closeModal(); cancelAnimationFrame(raf); showScreen('title'); updateTitle(); });
    // panel
    const nx = nextNodes();
    const upkeep = marchCost();
    let h = `<h3>${n.name}</h3><div class="tip">${n.region} · ${n.year}</div><p style="margin:6px 0">${n.text}</p>`;
    if (Q.over) h += `<div class="plan"><b>The campaign is over.</b> <button class="small" id="qEnd">See the result</button></div>`;
    else {
      h += `<div class="sec"><b>March on</b> <span class="tip">(costs ${upkeep} ${mny()} in pay and supplies)</span><div class="btnrow" style="flex-direction:column;align-items:stretch">`;
      h += nx.map(m => `<button data-go="${m.id}" style="text-align:left"><b>${m.name}</b> <span class="muted">— ${{ battle: 'battle', siege: 'siege', city: 'city', event: 'event', end: 'the edge of the world' }[m.kind]}${m.optional ? ', optional' : ''}</span></button>`).join('') || '<span class="tip">No road onward.</span>';
      h += `</div></div>`;
      const here = nodeById(Q.node);
      const pool = recruitPool(here);
      if (pool.length && Q.held[Q.node] === 'held') {
        h += `<div class="sec"><b>Recruit</b> <span class="tip">(army ${Q.army.length}/${C.maxArmy})</span><div class="recruit" style="margin-top:4px">`;
        const hired = (Q.hired || {})[Q.node] || 0;
        h += `<div class="tip" style="grid-column:1/3">${2 - hired} of 2 recruits left here.</div>`;
        for (const r of pool) {
          const ok = hired < 2 && Q.gold >= r.gold && Q.army.length < C.maxArmy && (!r.legit || Q.legit >= r.legit);
          if (r.flag && !Q.flags[r.flag]) continue;
          h += `<div class="nm"><b>${r.name}</b> <span class="muted">${CLASSES[U[r.t].cls].name} · ⚔${U[r.t].atk} 🛡${U[r.t].def}</span><div class="cost">${r.gold} ${mny()}${r.legit ? ` · needs ${T().legit.toLowerCase()} ${r.legit}` : ''}</div></div><button class="small" data-rec="${r.t}|${r.name}|${r.gold}" ${ok ? '' : 'disabled'}>Hire</button>`;
        }
        h += `</div></div>`;
      }
      if (Q.held[Q.node] === 'held' && Q.node !== C.start) {
        h += `<div class="sec"><b>Garrison</b> <div class="tip">A unit left behind keeps this region from revolting after you march on. Unguarded regions may rise up — less often the higher your ${T().legit.toLowerCase()}.</div>`;
        h += Q.garrison[Q.node] ? `<div>Garrisoned by <b>${Q.garrison[Q.node]}</b>.</div>` : `<div class="btnrow">${Q.army.length > 3 ? '<button class="small" id="qGar">Leave your weakest unit here</button>' : '<span class="tip">Army too small to spare anyone.</span>'}</div>`;
        h += `</div>`;
      }
      h += `<div class="sec"><div class="btnrow"><button class="small" id="qRest" ${Q.gold >= 15 ? '' : 'disabled'}>${T().rest} (15 ${mny()}, +35 strength, +2 ${T().loyalty.toLowerCase()})</button>
        <button class="small" id="qShare" ${Q.gold >= 150 && !(Q.shared || {})[Q.node] ? '' : 'disabled'} title="Once per place">${T().share} (150 ${mny()}, +6 ${T().loyalty.toLowerCase()})</button></div></div>`;
    }
    h += `<div class="sec"><b>Army (${Q.army.length}/${C.maxArmy})</b><div class="unitList" style="margin-top:4px">${Q.army.map(u => `<div class="unitLine" title="${U[u.t].note}"><span class="nm">${u.name}${u.exp ? ' <span style="color:#b08a10">' + '★'.repeat(u.exp) + '</span>' : ''} <span class="muted">${CLASSES[U[u.t].cls].name}</span></span><span class="bar"><i style="width:${u.str}%"></i></span></div>`).join('')}</div></div>`;
    $('qPanel').innerHTML = h;
    $('qPanel').querySelectorAll('[data-go]').forEach(b => b.onclick = () => confirmMarch(nodeById(b.dataset.go)));
    $('qPanel').querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const [t, name, gold] = b.dataset.rec.split('|'); Q.gold -= +gold; Q.army.push(mk(t, { name })); Q.hired = Q.hired || {}; Q.hired[Q.node] = (Q.hired[Q.node] || 0) + 1; say(`${name} join the army.`, 'good'); save(); render(); });
    if ($('qGar')) $('qGar').onclick = () => { const w = Q.army.slice().sort((a, b) => (U[a.t].atk + U[a.t].def) * a.str - (U[b.t].atk + U[b.t].def) * b.str)[0]; Q.army = Q.army.filter(u => u !== w); Q.garrison[Q.node] = w.name; say(`${w.name} stay behind to garrison ${n.name}.`); save(); render(); };
    if ($('qRest')) $('qRest').onclick = () => { Q.gold -= 15; Q.army.forEach(u => u.str = Math.min(100, u.str + 35)); Q.loyalty = clamp(Q.loyalty + 2); say('The army rests and refits.'); save(); render(); };
    if ($('qShare')) $('qShare').onclick = () => { Q.gold -= 150; Q.loyalty = clamp(Q.loyalty + 6); Q.shared = Q.shared || {}; Q.shared[Q.node] = true; say('You share out the plunder. The veterans cheer your name.', 'good'); save(); render(); };
    if ($('qEnd')) $('qEnd').onclick = ending;
    G0 = null; // panel size may have changed
    $('qLog').innerHTML = Q.log.slice(-30).map(e => `<div class="e ${e.kind}">${e.t}</div>`).join('');
    $('qLog').scrollTop = 1e6;
  }
  // every held place can hire mercenaries; Macedonian reinforcements flow once the coast is secure; local specials on top
  function recruitPool(n) {
    const base = (C.recruitBase || [ { t: 'hoplite', name: 'Greek Mercenary Hoplites', gold: 45 }, { t: 'slinger', name: 'Light Infantry', gold: 20 } ]).slice();
    const extra = C.recruitFlags || [ { flag: 'issus', units: [ { t: 'hoplite', name: 'Macedonian Phalanx Reinforcements', gold: 70 }, { t: 'companion', name: 'Macedonian Cavalry Reinforcements', gold: 80 } ] } ];
    for (const e of extra) if (Q.flags[e.flag]) base.push(...e.units);
    const local = n.recruit || [];
    return local.concat(base.filter(b => !local.some(l => l.name === b.name)));
  }
  function attrition(n) { if (!n.attrition) return 0; return Math.max(0, n.attrition + (n.winter && Q.flags.late ? 12 : 0) - (Q.flags.supply ? 8 : 0)); }
  function marchCost() { return Math.max(4, Math.round(Q.army.length * 1.5)); }

  function showNode(n) {
    const visited = Q.visited.includes(n.id);
    modal(`<h2>${n.name}</h2><div class="tip">${n.region} · ${n.year}</div><p>${n.text}</p>${visited && n.battle ? `<div class="hist"><b>What really happened.</b> ${n.battle.history}</div>` : ''}<div class="acts"><button class="primary" onclick="closeModal()">Close</button></div>`);
  }

  function confirmMarch(n) {
    if (Q.over || walk) return;
    const cost = marchCost();
    modal(`<h2>March to ${n.name}?</h2><p>${n.text}</p><div class="tip">The march costs ${cost} ${mny()} in pay and supplies${Q.gold < cost ? ' — <span class="bad">you cannot pay the men in full, and loyalty will suffer</span>' : ''}. ${attrition(n) > 0 ? `<br><span class="bad">Hard country: every unit will lose about ${attrition(n)}% strength on this march${n.winter ? ' to cold and hunger' : ' to heat, sickness and straggling'}.</span>` : 'The army recovers some strength on the road.'}</div>
      <div class="acts"><button onclick="closeModal()">Not yet</button><button class="primary" id="qMarch">March ▶</button></div>`);
    $('qMarch').onclick = () => { closeModal(); march(n); };
  }

  async function march(n) {
    if (walk) return;
    const cost = marchCost();
    if (Q.gold >= cost) Q.gold -= cost; else { Q.gold = 0; Q.loyalty = clamp(Q.loyalty - 8); say('The men go unpaid. Loyalty falls.', 'bad'); }
    Q.loyalty = clamp(Q.loyalty - 1);
    const att = attrition(n);
    if (att > 0) { Q.army.forEach(u => u.str = Math.max(10, u.str - att)); Q.loyalty = clamp(Q.loyalty - Math.round(att / 8)); say(`The march costs the army dearly: about ${att}% of every unit lost to ${n.winter ? 'cold and hunger' : 'heat, sickness and straggling'}.`, 'bad'); }
    else Q.army.forEach(u => u.str = Math.min(100, u.str + 12));
    // revolts behind the lines
    for (const [id, st] of Object.entries(Q.held)) {
      if (st !== 'held' || id === C.start || Q.garrison[id] || id === Q.node) continue;
      const p = Math.max(0.005, 0.07 - Q.legit * 0.0007) * (Q.flags.terror ? 0.5 : 1);
      if (Math.random() < p) { Q.held[id] = 'revolt'; Q.loyalty = clamp(Q.loyalty - 2); say(`${nodeById(id).name} rises in revolt! The region is lost.`, 'bad'); await info(`Revolt in ${nodeById(id).region}`, T().revolt.replace('{place}', nodeById(id).name)); }
    }
    const from = nodeById(Q.node);
    Q.node = n.id; Q.path.push(n.id); Q.visited.push(n.id); Q.year = n.year;
    say(`The army marches to ${n.name}.`);
    save(); render();
    if (typeof Sfx !== 'undefined') Sfx.march();
    await new Promise(res => {
      const dur = 1100 * Math.max(0.3, SETTINGS.speed); let done = false;
      const fin = () => { if (done) return; done = true; walk = null; res(); };
      walk = { from, t0: performance.now(), dur, res: fin };
      setTimeout(fin, dur + 50); // in case the map is not being drawn (hidden window)
    });
    if (Q.loyalty <= 0) { Q.over = true; Q.ending = 'mutiny'; save(); render(); ending(); return; }
    await arrive(n);
  }

  async function arrive(n) {
    for (const id of n.events || []) { if (Q.over) return; await runEvent(id); if (Q.redirect) { const r = Q.redirect; Q.redirect = null; return redirect(r); } }
    if (Q.over) { render(); return ending(); }
    if (n.battle) { await battle(n); return; }
    conquer(n);
  }

  function redirect(r) {
    const n = nodeById(r.id);
    if (r.skip) { // jump ahead along the road
      Q.node = n.id; Q.path.push(n.id); Q.visited.push(n.id); Q.year = n.year; save(); render(); return arrive(n);
    }
    Q.node = n.id; Q.path.push(n.id); Q.visited.push(n.id); Q.year = n.year; save(); render(); return arrive(n);
  }

  async function conquer(n) {
    if (!Q.done[n.id]) {
      Q.done[n.id] = true;
      if (n.kind !== 'event' && n.kind !== 'end') { Q.held[n.id] = 'held'; pulses.push({ lon: n.lon, lat: n.lat, color: C.color, t0: performance.now() }); if (typeof Sfx !== 'undefined') Sfx.fanfare(); }
      if (n.reward) { applyFx(n.reward); const r = n.reward; const parts = []; if (r.gold) parts.push(`+${r.gold} ${mny()}`); if (r.loyalty) parts.push(`+${r.loyalty} ${T().loyalty.toLowerCase()}`); if (r.legit) parts.push(`+${r.legit} ${T().legit.toLowerCase()}`); if (r.add) parts.push(`${r.add.length} new unit(s)`); if (parts.length) say(`${n.name}: ${parts.join(', ')}.`, 'good'); }
      for (const id of n.after || []) { if (Q.over) break; await runEvent(id); if (Q.redirect) { const r = Q.redirect; Q.redirect = null; save(); return redirect(r); } }
    }
    save(); render();
    if (Q.over) ending();
  }

  function info(title, text) { return new Promise(res => { modal(`<h2>${title}</h2><p>${text}</p><div class="acts"><button class="primary" id="qOk">Continue</button></div>`); $('qOk').onclick = () => { closeModal(); res(); }; }); }

  function runEvent(id) {
    const ev = C.events[id]; if (!ev) return Promise.resolve();
    if (ev.cond?.notFlags && ev.cond.notFlags.some(f => Q.flags[f])) return Promise.resolve();
    if (ev.cond?.flags && !ev.cond.flags.every(f => Q.flags[f])) return Promise.resolve();
    return new Promise(res => {
      modal(`<h2>${ev.title}</h2><p>${ev.text}</p><div class="acts" style="flex-direction:column;align-items:stretch">${ev.choices.map((c, k) => `<button data-ch="${k}" style="text-align:left" ${reqOK(c.req) ? '' : 'disabled'}>${c.label}${fxTxt(c)}${c.req && !reqOK(c.req) ? ` <span class="bad">(needs ${c.req.gold ? c.req.gold + ' ' + mny() : c.req.loyalty ? T().loyalty.toLowerCase() + ' ' + c.req.loyalty : T().legit.toLowerCase() + ' ' + c.req.legit})</span>` : ''}</button>`).join('')}</div>`);
      document.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
        const c = ev.choices[+b.dataset.ch];
        applyFx(c.fx, c);
        say(c.out, 'note');
        if (c.fx?.end) { Q.over = true; Q.ending = c.fx.end; }
        if (c.fx?.goto) { Q.flags[c.fx.goto] = true; Q.redirect = { id: c.fx.goto }; }
        if (c.fx?.skipTo) Q.redirect = { id: c.fx.skipTo, skip: true };
        save();
        modal(`<h2>${ev.title}</h2><p>${c.out}</p><div class="acts"><button class="primary" id="qOk">Continue</button></div>`);
        $('qOk').onclick = () => { closeModal(); render(); res(); };
      });
    });
  }
  function fxTxt(c) {
    const f = c.fx || {}, p = [];
    if (f.gold) p.push(`${f.gold > 0 ? '+' : ''}${f.gold} 🪙`);
    if (f.loyalty) p.push(`${f.loyalty > 0 ? '+' : ''}${f.loyalty} 🛡`);
    if (f.legit) p.push(`${f.legit > 0 ? '+' : ''}${f.legit} 👑`);
    if (c.enemyDisorder || c.enemyWeak) p.push('enemy weakened');
    return p.length ? ` <span class="cost">(${p.join(', ')})</span>` : '';
  }

  // ---------- battles
  function deploy(isSiege) {
    if (C.id !== 'alexander') return deployBalanced(isSiege);
    const out = [];
    const sorted = Q.army.slice().sort((a, b) => (U[b.t].atk + U[b.t].def) * b.str - (U[a.t].atk + U[a.t].def) * a.str);
    let cav = 0, inf = 0, mis = 0, art = 0;
    const reserveOne = Q.army.length >= 9 ? sorted.find(u => ['pike', 'inf'].includes(U[u.t].cls)) : null;
    for (const u of sorted) {
      const c = U[u.t].cls; let s;
      if (u === reserveOne) s = 'R';
      else if (c === 'art') s = isSiege ? 1 : (C.era || 1) >= 3 ? [1, 0, 2][art++ % 3] : 'R';
      else if (c === 'hcav' || c === 'lcav') s = cav++ < 3 ? 2 : 0;
      else if (c === 'missile') s = [1, 0, 2][mis++ % 3];
      else s = [1, 1, 0, 2][inf++ % 4];
      out.push([u.t, s, { name: u.name, str: u.str, exp: u.exp, ref: u.id }]);
    }
    return out;
  }

  // spread the army evenly across the three sectors; the best foot (and best horse in a big army) wait in reserve
  function deployBalanced(isSiege) {
    const pow = u => (U[u.t].atk + U[u.t].def) * u.str;
    const sorted = Q.army.slice().sort((a, b) => pow(b) - pow(a));
    const isCav = u => ['hcav', 'lcav'].includes(U[u.t].cls);
    const res = new Set();
    const n = sorted.length;
    if (n >= 8) { const f = sorted.find(u => ['inf', 'pike'].includes(U[u.t].cls)) || sorted.find(u => U[u.t].cls === 'hcav'); if (f) res.add(f); }
    if (n >= 12) { const h = sorted.find(u => U[u.t].cls === 'hcav' && !res.has(u)); if (h) res.add(h); }
    const load = [0, 0, 0], out = [];
    for (const u of sorted) {
      let s;
      if (res.has(u)) s = 'R';
      else {
        const c = U[u.t].cls;
        const score = k => load[k] + (isCav(u) && k === 1 ? 0.6 : 0) + (c === 'art' && k !== 1 ? (isSiege ? 5 : 0.4) : 0);
        s = [0, 1, 2].reduce((best, k) => score(k) < score(best) ? k : best, 1);
        load[s]++;
      }
      out.push([u.t, s, { name: u.name, str: u.str, exp: u.exp, ref: u.id }]);
    }
    return out;
  }

  function battleCfg(n, doctrine) {
    const b = n.battle;
    let sectors = b.sectors, enemy = b.enemy, maxRounds = b.maxRounds, defender = b.defender;
    if (b.fromScenario) {
      const sc = SCENARIOS.find(s => s.id === b.fromScenario);
      sectors = sc.sectors; enemy = sc.sides[1]; maxRounds = sc.maxRounds; defender = sc.defender;
    }
    const en = JSON.parse(JSON.stringify(enemy));
    en.units = en.units.map(e => { const [t, s, o = {}] = e; const o2 = Object.assign({}, o); if (b.enemyStr) o2.str = Math.round((o2.str ?? 100) * b.enemyStr); if (Q.pending.weak && s === 2) o2.str = Math.round((o2.str ?? 100) * 0.4); return [t, s, o2]; });
    // later conquests scale the enemy to the size of your army, so a big army is not an automatic win
    const ratio = b.ratio ?? C.enemyRatio;
    if (ratio) {
      const want = Math.round(ratio * Q.army.length), base = en.units.filter(u => u[1] !== 'R');
      for (let k = 0; en.units.length < want && base.length && k < 40; k++) { const [t, s0, o] = base[k % base.length]; en.units.push([t, s0, Object.assign({}, o)]); }
      if (en.units.length > want + 2) en.units = en.units.slice(0, Math.max(want + 2, 4));
    }
    en.color = en.color || C.enemyColor; en.script = []; en.isAI = true;
    if (Q.pending.disorder) en.startDisorder = Q.pending.disorder;
    if (Q.flags.rushed && b.fromScenario) en.units = en.units.filter((u, i) => i % 4 !== 3); // Darius had less time to gather his army
    const units = deploy(n.kind === 'siege');
    const alexSector = units.find(u => U[u[0]].cls === 'hcav')?.[1] ?? 1;
    return { id: 'conq_' + n.id, name: b.name, era: C.era || 1, sectors: JSON.parse(JSON.stringify(sectors)), maxRounds, defender, histAI: false,
      sides: [
        { name: T().side, commander: T().leader, color: C.color, men: Q.army.length * T().menPer, doctrine, general: { name: T().leader, sector: alexSector, mortal: false }, units, mods: { atk: { all: 1 + Q.won * 0.01 } } },
        Object.assign(en, { color: en.color }),
      ] };
  }

  function battle(n) {
    return new Promise(res => {
      const docs = C.doctrines.concat(Object.entries(C.unlockDoctrines || { steppe: 'feigned' }).filter(([f, d]) => Q.flags[f] && !C.doctrines.includes(d)).map(([f, d]) => d));
      let doc = n.battle.doctrine || docs[0];
      const draw = () => {
        const p = Math.round(Battle.estimate(() => battleCfg(n, doc), 30) * 100);
        const cfg = battleCfg(n, doc);
        modal(`<h2>${n.battle.name}</h2><p>${n.text}</p>
          <table class="cas"><tr><th>Your army</th><th>${cfg.sides[1].name} — ${cfg.sides[1].commander || ''}</th></tr>
          <tr><td>${Q.army.map(u => u.name + (u.str < 95 ? ` (${Math.round(u.str)}%)` : '')).join('<br>')}</td><td>${cfg.sides[1].units.map(u => (u[2]?.name || U[u[0]].name) + (u[2]?.str ? ` (${u[2].str}%)` : '')).join('<br>')}</td></tr></table>
          <div class="row">Battle plan: <select id="qDoc">${docs.map(d => `<option value="${d}" ${d === doc ? 'selected' : ''}>${DOCTRINES[d].name}</option>`).join('')}</select> <span class="tip">${DOCTRINES[doc].desc}</span></div>
          <div class="plan">Estimated chance of victory: <b class="${p >= 60 ? 'good' : p < 40 ? 'bad' : ''}">${p}%</b>. Losses are permanent. ${T().front}</div>
          <div class="acts">${Q.path.length > 1 ? '<button id="qBack">Fall back</button>' : ''}<button id="qAuto">Auto-resolve</button><button class="primary" id="qCmd">Command the battle ⚔</button></div>`);
        $('qDoc').onchange = e => { doc = e.target.value; draw(); };
        if ($('qBack')) $('qBack').onclick = () => { closeModal(); retreatBack(); res(); };
        $('qAuto').onclick = () => { closeModal(); const B = Battle.autoResolve(Battle.create(battleCfg(n, doc))); after(n, B).then(res); };
        $('qCmd').onclick = () => {
          closeModal();
          const cfg2 = battleCfg(n, doc);
          BattleUI.start(cfg2, { playerSide: 0, campaign: true, title: n.battle.name, onEnd: (B, sum, stop) => { stop(); showScreen('conq'); after(n, B).then(res); } });
        };
      };
      draw();
    });
  }

  function retreatBack() {
    Q.path.push(Q.path[Q.path.length - 2]);
    const prev = Q.path[Q.path.length - 1];
    Q.visited = Q.visited.filter(id => id !== Q.node);
    Q.node = prev; Q.loyalty = clamp(Q.loyalty - 4);
    Q.army.forEach(u => u.str = Math.min(100, u.str + 20)); // stragglers return to the standards
    say('The army falls back without a fight.', 'bad'); save(); render();
  }

  async function after(n, B) {
    const won = B.winner === 0;
    const byRef = new Map(B.units.filter(u => u.side === 0).map(u => [u.ref, u]));
    const before = Q.army.length;
    Q.army = Q.army.filter(u => {
      const bu = byRef.get(u.id); if (!bu) return true;
      if (bu.status === 'destroyed') return false;
      let s = bu.str; if (bu.status === 'routed') s *= bu.retreated ? 0.95 : 0.7;
      u.str = Math.round(s);
      if (won && bu.status === 'ok' && bu.dealt > 15 && Math.random() < 0.55) u.exp = Math.min(3, (u.exp || 0) + 1);
      if (bu.status === 'routed') u.str = Math.max(u.str, 15); // survivors rally to the standards after the battle
      return u.str >= 8;
    });
    const lost = before - Q.army.length;
    Q.pending = {};
    const g = B.sides[0].general;
    if (g?.wounded) { Q.wounds++; say(`${T().leader} ${T().wounded}.`, 'bad'); }
    let hero = null;
    if (won) {
      const best = B.units.filter(u => u.side === 0 && u.status === 'ok').sort((a, b) => b.dealt - a.dealt)[0];
      hero = best && Q.army.find(u => u.id === best.ref);
      if (hero) { hero.exp = Math.min(3, (hero.exp || 0) + 1); say(`${hero.name} are honoured as the heroes of ${n.name}.`, 'good'); }
    }
    if (won) {
      Q.won++; Q.loyalty = clamp(Q.loyalty + 3 - lost * 2);
      say(`Victory at ${n.name}! ${lost ? lost + ' unit(s) lost.' : 'No units lost.'}`, 'good');
      await info(`Victory: ${n.battle.name}`, `${B.endReason}<br><br>${lost ? `You lost ${lost} unit(s) for good.` : 'Not a single unit was lost.'}${hero ? `<div class="plan" style="margin-top:8px">🎖 <b>${hero.name}</b> did the most damage and are honoured as the heroes of the day (+1 veteran star).</div>` : ''}${g?.wounded ? ` ${T().leader} was wounded but will recover.` : ''}<div class="hist" style="margin-top:10px"><b>What really happened.</b> ${n.battle.history}</div>`);
      await conquer(n);
    } else {
      Q.lost++; Q.loyalty = clamp(Q.loyalty - 12 - lost * 2);
      say(`Defeat at ${n.name}. ${lost} unit(s) lost.`, 'bad');
      if (!Q.army.length) { Q.over = true; Q.ending = 'destroyed'; save(); render(); return ending(); }
      await info(`Defeat: ${n.battle.name}`, `${B.endReason}<br><br>You lost ${lost} unit(s). The army falls back to regroup; you can rest, recruit and try again. Loyalty suffers.`);
      retreatBack();
      if (Q.loyalty <= 0) { Q.over = true; Q.ending = 'mutiny'; save(); render(); ending(); }
    }
  }

  // ---------- intro & endings
  function intro() {
    modal(`<h2>${C.name}</h2><div class="tip">${C.subtitle}</div>${C.intro.map(p => `<p>${p}</p>`).join('')}
      <ul>${T().bullets.map(b => `<li>${b}</li>`).join('')}</ul>
      <div class="acts"><button class="primary" id="qGo">${T().go}</button></div>`);
    $('qGo').onclick = async () => { closeModal(); await arrive(nodeById(C.start)); render(); };
  }

  function ending() {
    const held = Object.values(Q.held).filter(v => v === 'held').length;
    const total = C.nodes.filter(n => !n.alt && n.kind !== 'event' && n.kind !== 'end').length;
    const E = T().endings[Q.ending] || TERMS0.endings[Q.ending] || ['The End', ''];
    modal(`<h2>${E[0]}</h2><p>${E[1]}</p>
      <table class="cas"><tr><td>Regions held</td><td><b>${held}</b> of ${total}</td></tr><tr><td>Victories / defeats</td><td>${Q.won} / ${Q.lost}</td></tr>
      <tr><td>Army remaining</td><td>${Q.army.length} units</td></tr><tr><td>${T().loyalty} · ${T().legit}</td><td>${Q.loyalty} · ${Q.legit}</td></tr><tr><td>Times ${T().leader} was wounded</td><td>${Q.wounds} <span class="tip">(${T().woundHist})</span></td></tr></table>
      <div class="hist">${T().endNote}</div>
      <div class="acts"><button id="qMenu2">Main menu</button><button class="primary" id="qAgain">Start again</button></div>`);
    $('qMenu2').onclick = () => { closeModal(); cancelAnimationFrame(raf); showScreen('title'); updateTitle(); };
    $('qAgain').onclick = () => { closeModal(); start(false, C.id); };
  }

  return { _cfg: (id, doc = 'hammer') => battleCfg(nodeById(id), doc), _new: cid => { newGame(cid); }, start, load, hasSave, get Q() { return Q; }, get C() { return C; }, march: id => march(nodeById(id)), nextNodes, render };
})();
