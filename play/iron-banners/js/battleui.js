// Iron Banners — battle screen
'use strict';

const SETTINGS = { speed: 1 };

const BattleUI = (() => {
  const $ = id => document.getElementById(id);
  let B = null, me = 0, opts = {}, phase = 'plan', pending = null, sel = null;
  let cv, ctx, W = 0, H = 0, dpr = 1, bg = null, geo = null;
  const disp = new Map(); // uid -> {x,y}
  let floaters = [], fxShow = [], fxUntil = 0, lastOrders = null, raf = 0, animating = false;
  let parts = [], sched = [], shakeUntil = 0, shakeAmp = 0, lunge = null, banners = [], titleAt = 0, cardSel = null;

  function start(cfg, o) {
    opts = o || {};
    me = opts.playerSide ?? 0;
    B = Battle.create(cfg);
    B.sides.forEach(s => s.isAI = s.i !== me);
    phase = opts.skipDeploy ? 'plan' : 'deploy';
    pending = Battle.emptyOrders();
    sel = null; disp.clear(); floaters = []; fxShow = []; lastOrders = null;
    cv = $('bCanvas'); ctx = cv.getContext('2d');
    showScreen('battle');
    $('bName').textContent = opts.title || cfg.name || 'Battle';
    $('bSidesLbl').innerHTML = B.sides.map(s => `<span style="color:${Draw.lum(s.color) < 0.25 ? Draw.shade(s.color, 0.5) : s.color};font-weight:600">${s.i === me ? '★ ' : ''}${s.name}</span>`).join(' <span class="muted">vs</span> ');
    $('bGo').onclick = go;
    $('bRetreat').onclick = () => confirmBox('Sound the retreat?', 'Your army leaves the field. Units withdraw in good order and are not cut down, but the battle is lost.', () => { Battle.retreat(B, me); finish(); });
    $('bQuit').onclick = () => confirmBox('Leave this battle?', opts.campaign ? 'Leaving now counts as a retreat.' : 'Progress in this battle will be lost.', () => { if (opts.campaign) { Battle.retreat(B, me); finish(); } else { stop(); opts.onQuit?.(); } });
    $('bHelp').onclick = help;
    cv.onclick = click;
    window.addEventListener('resize', resize);
    resize();
    if (phase === 'plan') { Battle.beginRound(B); defaults(); }
    renderPanel(); renderLog(); info();
    parts = []; sched = []; banners = []; lunge = null; cardSel = null; titleAt = performance.now();
    $('bMute').textContent = Sfx.muted ? '🔇' : '🔊';
    $('bMute').onclick = () => { $('bMute').textContent = Sfx.toggle() ? '🔇' : '🔊'; };
    Sfx.horn(); Sfx.startDrums();
    cancelAnimationFrame(raf); loop();
    renderHand();
    if (opts.histNote) toastLog(opts.histNote);
  }
  function stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); Sfx.stopDrums(); $('bHand').innerHTML = ''; }

  function resize() {
    const r = $('bField').getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(400, r.width); H = Math.max(300, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geo = null; bg = null;
  }

  // ---------- geometry
  function G() {
    if (geo) return geo;
    const narrow = W < 620;
    const resW = narrow ? 40 : Math.min(110, W * 0.12), top = 26;
    const fx0 = resW, fx1 = W - resW, rowH = (H - top) / 3;
    const cw = narrow ? Math.max(30, Math.min(44, (fx1 - fx0) / 8.5)) : Math.max(44, Math.min(74, (fx1 - fx0) / 12)), ch = cw * 0.88;
    geo = { resW, top, fx0, fx1, rowH, cw, ch, mid: (fx0 + fx1) / 2, step: (fx1 - fx0) / 14 };
    return geo;
  }
  function lineX(s) { const g = G(); return g.mid + B.sectors[s].line * g.step; }

  function layout() {
    const g = G(); const pos = new Map();
    for (let side = 0; side < 2; side++) {
      for (let s = 0; s < 3; s++) {
        const list = B.units.filter(u => u.side === side && u.sector === s && (u.status === 'ok' || u.routedAt === B.round));
        const front = list.filter(u => !Battle.isRanged(u) && Battle.cls(u) !== 'air').concat(list.filter(u => Battle.isRanged(u) && Battle.cls(u) !== 'air'));
        const air = list.filter(u => Battle.cls(u) === 'air');
        const rows = Math.max(1, Math.floor((g.rowH - 24) / (g.ch + 16)));
        const lx = lineX(s), dir = side === 0 ? -1 : 1;
        front.forEach((u, i) => {
          const col = Math.floor(i / rows), row = i % rows;
          const nInCol = Math.min(rows, front.length - col * rows);
          const y0 = g.top + s * g.rowH + (g.rowH - nInCol * (g.ch + 16)) / 2 + 2;
          const x = lx + dir * (14 + col * (g.cw + 8)) - (side === 0 ? g.cw : 0);
          pos.set(u.uid, { x, y: y0 + row * (g.ch + 16) });
        });
        air.forEach((u, i) => {
          const x = lx + dir * (14 + (Math.ceil(front.length / rows) + i * 0.6) * (g.cw + 8)) - (side === 0 ? g.cw : 0);
          pos.set(u.uid, { x, y: g.top + s * g.rowH + 6 });
        });
      }
      // reserve column
      const res = B.units.filter(u => u.side === side && u.sector === 'R' && u.status === 'ok');
      res.forEach((u, i) => {
        const x = side === 0 ? (g.resW - g.cw) / 2 : W - g.resW + (g.resW - g.cw) / 2;
        pos.set(u.uid, { x, y: g.top + 24 + i * (g.ch + 16) });
      });
    }
    return pos;
  }

  // ---------- background
  function groundColor() { return B.cfg.ground || ({ 1: '#a9a25e', 2: '#7f9a4c', 3: '#8ea05a', 4: '#93a35c', 5: '#8f9a58' })[B.cfg.era || 1] || '#8a9a55'; }
  function buildBg() {
    const g = G();
    bg = document.createElement('canvas'); bg.width = W * dpr; bg.height = H * dpr;
    const c = bg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = Draw.srng(7 + (B.id || '').length * 13);
    // table
    c.fillStyle = '#2a1d14'; c.fillRect(0, 0, W, H);
    // reserve areas
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? 0 : W - g.resW;
      c.fillStyle = 'rgba(240,225,190,.08)'; c.fillRect(x + 4, g.top, g.resW - 8, H - g.top - 4);
      c.fillStyle = '#d8c49a'; c.font = '600 11px Cinzel, serif'; c.textAlign = 'center';
      c.fillText('RESERVE', x + g.resW / 2, g.top + 14);
    }
    const base = groundColor();
    for (let s = 0; s < 3; s++) {
      const y = g.top + s * g.rowH, sec = B.sectors[s];
      const T = sec.terrain;
      c.fillStyle = base; c.fillRect(g.fx0, y, g.fx1 - g.fx0, g.rowH);
      // mottling
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,220'},${0.03 + rand() * 0.04})`; const r = 6 + rand() * 30; c.beginPath(); c.ellipse(g.fx0 + rand() * (g.fx1 - g.fx0), y + rand() * g.rowH, r * 1.6, r, 0, 0, 7); c.fill(); }
      const ownSide = (B.cfg.sectors[s].owner);
      if (T.includes('mud')) { c.strokeStyle = 'rgba(70,45,20,.45)'; c.lineWidth = 3; for (let yy = y + 6; yy < y + g.rowH; yy += 9) { c.beginPath(); c.moveTo(g.fx0, yy); for (let xx = g.fx0; xx < g.fx1; xx += 20) c.lineTo(xx, yy + (rand() - 0.5) * 2); c.stroke(); } c.fillStyle = 'rgba(90,60,30,.35)'; c.fillRect(g.fx0, y, g.fx1 - g.fx0, g.rowH); }
      if (T.includes('hill')) {
        const cx = ownSide === 1 ? g.mid + (g.fx1 - g.mid) * 0.55 : ownSide === 0 ? g.fx0 + (g.mid - g.fx0) * 0.45 : g.mid;
        for (let k = 4; k >= 1; k--) { c.fillStyle = `rgba(110,90,50,${0.07 + 0.03 * (4 - k)})`; c.beginPath(); c.ellipse(cx, y + g.rowH / 2, (g.fx1 - g.fx0) * 0.055 * k, g.rowH * 0.1 * k, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(70,50,25,.35)'; c.lineWidth = 1; c.stroke(); }
      }
      if (T.includes('river')) {
        const rx = g.mid + (ownSide === 1 ? 1 : ownSide === 0 ? -1 : 0) * g.step * 0.6;
        c.strokeStyle = '#4c7fa8'; c.lineWidth = 16; c.beginPath(); c.moveTo(rx, y); for (let yy = y; yy <= y + g.rowH; yy += 10) c.lineTo(rx + Math.sin(yy / 23) * 7, yy); c.stroke();
        c.strokeStyle = 'rgba(200,230,255,.45)'; c.lineWidth = 2; c.stroke();
      }
      if (T.includes('fort')) {
        const fx = g.mid + (ownSide === 1 ? 1 : -1) * g.step * 0.45;
        c.strokeStyle = '#6d6252'; c.lineWidth = 5; c.beginPath();
        for (let yy = y + 8; yy < y + g.rowH - 4; yy += 12) { c.moveTo(fx, yy); c.lineTo(fx + (ownSide === 1 ? -5 : 5), yy + 6); c.lineTo(fx, yy + 12); }
        c.stroke();
      }
      if (T.includes('woods') || T.includes('narrow')) {
        for (let i = 0; i < 70; i++) {
          const edge = rand() < 0.5; const yy = edge ? y + rand() * g.rowH * 0.16 : y + g.rowH - rand() * g.rowH * 0.16;
          if (!T.includes('woods') && !(s === 0 && edge) && !(s === 2 && !edge)) continue;
          const xx = g.fx0 + rand() * (g.fx1 - g.fx0);
          c.fillStyle = `rgb(${40 + rand() * 20},${70 + rand() * 25},${35})`; c.beginPath(); c.arc(xx, yy, 6 + rand() * 6, 0, 7); c.fill();
        }
      }
      // sector divider & label
      c.strokeStyle = 'rgba(30,20,10,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.fx0, y); c.lineTo(g.fx1, y); c.stroke();
      c.fillStyle = 'rgba(25,15,5,.6)'; c.font = '600 12px Cinzel, serif'; c.textAlign = 'center';
      const lbl = sec.name; const tw = c.measureText(lbl).width;
      c.fillRect(g.mid - tw / 2 - 8, y + 3, tw + 16, 17);
      c.fillStyle = '#f4e4bf'; c.fillText(lbl, g.mid, y + 15);
    }
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.strokeRect(g.fx0, g.top, g.fx1 - g.fx0, H - g.top - 1);
    // compass / sides
    c.font = '600 12px Inter'; c.textAlign = 'left'; c.fillStyle = '#e8d6ae';
    c.fillText('◀ ' + B.sides[0].name, g.fx0 + 4, 16);
    c.textAlign = 'right'; c.fillText(B.sides[1].name + ' ▶', g.fx1 - 4, 16);
  }

  // ---------- render loop
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!bg) buildBg();
    const now = performance.now();
    for (let i = sched.length - 1; i >= 0; i--) if (now >= sched[i].at) { const f = sched[i].fn; sched.splice(i, 1); f(); }
    ctx.save();
    if (now < shakeUntil) { const a = shakeAmp * (shakeUntil - now) / 400; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    ctx.drawImage(bg, 0, 0, W, H);
    const g = G();
    // front lines
    for (let s = 0; s < 3; s++) {
      const y = g.top + s * g.rowH, x = lineX(s);
      ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 22); ctx.lineTo(x, y + g.rowH - 4); ctx.stroke(); ctx.restore();
      const sec = B.sectors[s];
      if (sec.line) { ctx.fillStyle = sec.line > 0 ? B.sides[0].color : B.sides[1].color; ctx.font = '700 11px Inter'; ctx.textAlign = 'center'; ctx.fillText(sec.line > 0 ? '▶'.repeat(sec.line) : '◀'.repeat(-sec.line), x, y + g.rowH - 8); }
    }
    // units
    const pos = layout();
    const k = Math.min(1, 0.12 / Math.max(0.15, SETTINGS.speed));
    for (const u of B.units) {
      const p = pos.get(u.uid);
      if (!p) continue;
      let d = disp.get(u.uid);
      if (!d) { d = { x: p.x, y: p.y }; disp.set(u.uid, d); }
      d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k;
    }
    const lo = new Map(); // melee lunge offsets
    if (lunge && now < lunge.t1) {
      const q = Math.max(0, (now - lunge.t0) / (lunge.t1 - lunge.t0)), amp = Math.sin(Math.PI * Math.min(1, q * 1.4)) * 18;
      for (const u of B.units) if (u.status === 'ok' && lunge.sectors.includes(u.sector) && !Battle.isRanged(u)) lo.set(u.uid, (u.side === 0 ? 1 : -1) * amp * (lunge.charge[u.side][u.sector] ? 1.6 : 1));
    }
    // pending moves (ghost arrows)
    if (phase === 'plan') for (const m of pending.moves) {
      const u = B.units.find(x => x.uid === m.uid); const d = disp.get(m.uid); if (!u || !d) continue;
      const tx = m.to === 'R' ? (me === 0 ? g.resW / 2 : W - g.resW / 2) : lineX(m.to) + (me === 0 ? -60 : 60);
      const ty = m.to === 'R' ? g.top + 40 : g.top + m.to * g.rowH + g.rowH / 2;
      ctx.save(); ctx.setLineDash([5, 5]); Draw.arrow(ctx, d.x + g.cw / 2, d.y + g.ch / 2, tx, ty, 'rgba(255,230,140,.85)', 3); ctx.restore();
    }
    if (phase === 'plan' && pending.commit != null) {
      const tx = lineX(pending.commit) + (me === 0 ? -60 : 60), ty = g.top + pending.commit * g.rowH + g.rowH / 2;
      Draw.arrow(ctx, me === 0 ? g.resW / 2 : W - g.resW / 2, g.top + 60, tx, ty, 'rgba(255,215,90,.8)', 5, me === 0 ? 0.3 : -0.3);
    }
    for (const u of B.units) {
      const d = disp.get(u.uid); if (!d || !pos.get(u.uid)) continue;
      const hidden = u.side !== me && u.sector === 'R' && !B.over;
      if (hidden) { ctx.save(); Draw.rr(ctx, d.x, d.y, g.cw, g.ch, 4); ctx.fillStyle = '#5a4a36'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.fillStyle = '#d8c49a'; ctx.font = '700 16px Cinzel'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', d.x + g.cw / 2, d.y + g.ch / 2); ctx.restore(); continue; }
      Draw.counter(ctx, d.x + (lo.get(u.uid) || 0), d.y, g.cw, g.ch, u, B.sides[u.side].color, { sel: sel === u.uid, label: true });
      if (u.drawn && u.status === 'ok') { ctx.fillStyle = '#ff9a2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x - 2, d.y - 2); ctx.lineTo(d.x + 9, d.y - 2); ctx.lineTo(d.x - 2, d.y + 9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    // generals
    for (const S of B.sides) {
      if (!S.general) continue;
      const s = S.general.sector; let x, y;
      if (s === 'R') { x = S.i === 0 ? g.resW / 2 : W - g.resW / 2; y = H - 22; }
      else { x = lineX(s) + (S.i === 0 ? -1 : 1) * Math.min(g.step * 4.8, (g.fx1 - g.fx0) / 2 - 20); y = g.top + s * g.rowH + 30; }
      ctx.save(); ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = S.general.alive ? 1 : 0.4;
      ctx.fillStyle = S.color; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillText(S.general.alive ? '⚑' : S.general.wounded ? '✚' : '✝', x, y + 1);
      ctx.font = '600 10px Inter'; ctx.fillStyle = '#fff2d0'; ctx.fillText(S.general.name, x, y + 21);
      ctx.restore();
    }
    // fx: orders arrows and clashes
    if (now < fxUntil) {
      const a = Math.min(1, (fxUntil - now) / 400);
      ctx.save(); ctx.globalAlpha = a;
      for (const f of fxShow) drawFx(f, now);
      ctx.restore();
    }
    // floaters
    floaters = floaters.filter(f => now < f.t1);
    for (const f of floaters) {
      const p = (now - f.t0) / (f.t1 - f.t0);
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.font = '700 14px Inter'; ctx.textAlign = 'center';
      ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y - p * 26); ctx.fillText(f.text, f.x, f.y - p * 26); ctx.restore();
    }
    drawParts(now);
    // card targeting: highlight valid sectors
    if (cardSel && cardSel.target) {
      for (let s2 = 0; s2 < 3; s2++) {
        const okT = Battle.cardOK(B, me, B.sides[me].hand[cardSel.idx], s2);
        ctx.fillStyle = okT ? 'rgba(255,215,90,' + (0.12 + 0.08 * Math.sin(now / 200)) + ')' : 'rgba(0,0,0,.25)';
        ctx.fillRect(g.fx0, g.top + s2 * g.rowH, g.fx1 - g.fx0, g.rowH);
        if (okT) { ctx.save(); ctx.font = '700 16px Cinzel'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff1c0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; const t = 'Click to target'; ctx.strokeText(t, g.mid, g.top + s2 * g.rowH + g.rowH / 2); ctx.fillText(t, g.mid, g.top + s2 * g.rowH + g.rowH / 2); ctx.restore(); }
      }
    }
    ctx.restore();
    drawBanners(now);
    // phase banner
    if (phase === 'deploy') banner('DEPLOYMENT — click a unit, then move it. Press “Begin Battle” when ready.');
  }

  // ---------- particles & banners
  function puff(x, y, kind, n = 1) {
    for (let i = 0; i < n; i++) {
      const p = { x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, t0: performance.now(), life: 900 + Math.random() * 700, kind, r: 4 + Math.random() * 5 };
      if (kind === 'spark') { p.vx = (Math.random() - 0.5) * 220; p.vy = (Math.random() - 0.5) * 220; p.life = 260 + Math.random() * 200; }
      if (kind === 'dust') { p.vx = (Math.random() - 0.5) * 60; p.vy = -5 - Math.random() * 15; p.r = 6 + Math.random() * 8; }
      if (kind === 'flash') { p.life = 180; p.r = 14 + Math.random() * 10; p.vx = p.vy = 0; }
      parts.push(p);
    }
  }
  function shoot(x0, y0, x1, y1, kind, delay) {
    const t0 = performance.now() + delay, dur = kind === 'ball' ? 650 : kind === 'arrow' ? 800 : 260;
    parts.push({ kind: 'proj', pk: kind, x0, y0, x1, y1, t0, life: dur, arc: kind === 'arrow' ? 70 + Math.random() * 40 : kind === 'ball' ? 40 : 0 });
    sched.push({ at: t0 + dur, fn: () => { puff(x1, y1, kind === 'ball' ? 'flash' : 'dust', kind === 'ball' ? 1 : 1); if (kind === 'ball') puff(x1, y1, 'smoke', 3); } });
  }
  function drawParts(now) {
    parts = parts.filter(p => now < p.t0 + p.life);
    for (const p of parts) {
      const q = (now - p.t0) / p.life; if (q < 0) continue;
      ctx.save();
      if (p.kind === 'proj') {
        const x = p.x0 + (p.x1 - p.x0) * q, y = p.y0 + (p.y1 - p.y0) * q - Math.sin(Math.PI * q) * p.arc;
        if (p.pk === 'arrow') { const q2 = Math.max(0, q - 0.04), x2 = p.x0 + (p.x1 - p.x0) * q2, y2 = p.y0 + (p.y1 - p.y0) * q2 - Math.sin(Math.PI * q2) * p.arc; ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke(); }
        else if (p.pk === 'ball') { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(255,230,120,.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - (p.x1 - p.x0) * 0.06, y); ctx.lineTo(x, y); ctx.stroke(); }
      } else {
        const x = p.x + p.vx * (now - p.t0) / 1000, y = p.y + p.vy * (now - p.t0) / 1000;
        if (p.kind === 'smoke') { ctx.globalAlpha = 0.55 * (1 - q); ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.arc(x, y, p.r * (1 + q * 2.2), 0, 7); ctx.fill(); }
        else if (p.kind === 'dust') { ctx.globalAlpha = 0.45 * (1 - q); ctx.fillStyle = '#b39a6a'; ctx.beginPath(); ctx.arc(x, y, p.r * (1 + q * 1.6), 0, 7); ctx.fill(); }
        else if (p.kind === 'spark') { ctx.globalAlpha = 1 - q; ctx.strokeStyle = q < 0.5 ? '#fff6c0' : '#ffb23a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); ctx.stroke(); }
        else if (p.kind === 'flash') { ctx.globalAlpha = 1 - q; const gr = ctx.createRadialGradient(x, y, 0, x, y, p.r * 2); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.4, 'rgba(255,140,40,.8)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, p.r * 2, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    }
  }
  function addBanner(text, sub, color, icon, dur = 1500, big = false) { const t0 = performance.now(); banners.push({ text, sub, color, icon, t0, t1: t0 + dur * Math.max(0.6, SETTINGS.speed), big }); }
  function drawBanners(now) {
    const g = G();
    // opening title card
    if (titleAt && now - titleAt < 3200) {
      const q = (now - titleAt) / 3200, a = q < 0.15 ? q / 0.15 : q > 0.75 ? (1 - q) / 0.25 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(14,8,2,.78)'; ctx.fillRect(0, H * 0.36, W, H * 0.24);
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H * 0.36); ctx.lineTo(W, H * 0.36); ctx.moveTo(0, H * 0.6); ctx.lineTo(W, H * 0.6); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4dc9a';
      ctx.font = `700 ${Math.min(44, W / 18)}px Cinzel, serif`; ctx.fillText((opts.title || B.cfg.name || 'Battle').toUpperCase(), W / 2 + (1 - a) * 40, H * 0.455);
      ctx.font = '600 15px Inter'; ctx.fillStyle = '#e8d8b0';
      ctx.fillText(B.sides.map(S2 => S2.name).join('   ⚔   '), W / 2, H * 0.535);
      ctx.restore();
    } else titleAt = 0;
    banners = banners.filter(b => now < b.t1);
    banners.forEach((b, i) => {
      const q = (now - b.t0) / (b.t1 - b.t0), a = q < 0.12 ? q / 0.12 : q > 0.8 ? (1 - q) / 0.2 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = g.top + 60 + i * 64, slide = (1 - Math.min(1, q / 0.12)) * 60;
      if (b.big) {
        const w = 300, h = 54; Draw.rr(ctx, W / 2 - w / 2 + slide, y - h / 2, w, h, 10); ctx.fillStyle = 'rgba(30,18,6,.88)'; ctx.fill(); ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = '26px serif'; ctx.fillText(b.icon || '', W / 2 - w / 2 + 30 + slide, y);
        ctx.font = '700 17px Cinzel, serif'; ctx.fillStyle = '#fff1c8'; ctx.fillText(b.text, W / 2 + 18 + slide, y - (b.sub ? 8 : 0));
        if (b.sub) { ctx.font = '600 11px Inter'; ctx.fillStyle = '#e0cc9c'; ctx.fillText(b.sub, W / 2 + 18 + slide, y + 13); }
      } else {
        ctx.font = '800 30px Cinzel, serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = b.color || '#ffe6a8';
        ctx.strokeText(b.text, W / 2 + slide, y); ctx.fillText(b.text, W / 2 + slide, y);
      }
      ctx.restore();
    });
  }
  function shake(amp, ms = 400) { shakeAmp = Math.max(amp, performance.now() < shakeUntil ? shakeAmp : 0); shakeUntil = performance.now() + ms; }

  // the round plays out: volleys, then the lines crash together
  function playRound(prevSec) {
    const g = G(), now = performance.now(), sp = Math.max(0.5, SETTINGS.speed), era = B.cfg.era || 1;
    const center = u => { const d = disp.get(u.uid); return d ? { x: d.x + g.cw / 2, y: d.y + g.ch * 0.45 } : null; };
    let anyRanged = false, anyArt = false, anyMelee = false, anyCharge = false, anyMG = false, anyArmor = false;
    const charge = [[false, false, false], [false, false, false]];
    for (let s2 = 0; s2 < 3; s2++) {
      const melee = B.fx.some(f => f.type === 'melee' && f.sector === s2), fire = B.fx.some(f => f.type === 'fire' && f.sector === s2);
      if (!melee && !fire) continue;
      for (let side = 0; side < 2; side++) {
        const mine = B.units.filter(u => u.side === side && u.sector === s2 && prevSec.get(u.uid) === s2);
        const foes = B.units.filter(u => u.side !== side && u.sector === s2 && u.status !== 'destroyed');
        if (!foes.length) continue;
        for (const u of mine.filter(Battle.isRanged)) {
          const c = Battle.cls(u), a = center(u); if (!a) continue;
          const kind = c === 'art' ? (era <= 2 ? 'ball' : 'ball') : era <= 2 ? 'arrow' : 'bullet';
          if (c === 'art') anyArt = true; else anyRanged = true;
          if (U[u.t].tags.includes('mg')) anyMG = true;
          const n = c === 'art' ? 2 : kind === 'arrow' ? 6 : 5;
          for (let k = 0; k < n; k++) { const tg = center(foes[Math.floor(Math.random() * foes.length)]); if (tg) shoot(a.x, a.y - 6, tg.x + (Math.random() - 0.5) * 20, tg.y + (Math.random() - 0.5) * 14, kind, (k * 90 + Math.random() * 200) * sp); }
          if (kind !== 'arrow') sched.push({ at: now + Math.random() * 300 * sp, fn: () => puff(a.x + (side === 0 ? 14 : -14), a.y - 6, 'smoke', c === 'art' ? 4 : 2) });
        }
        if (melee) {
          const o = B.orders[side]?.sec?.[s2];
          if (o === 'CHARGE' && mine.some(u => ['hcav', 'lcav', 'armor'].includes(Battle.cls(u)) || U[u.t].tags.includes('shock'))) { charge[side][s2] = true; anyCharge = true; }
          if (mine.some(u => Battle.cls(u) === 'armor')) anyArmor = true;
        }
      }
      if (melee) {
        anyMelee = true;
        const x = lineX(s2), y0 = g.top + s2 * g.rowH;
        sched.push({ at: now + 380 * sp, fn: () => { for (let k = 0; k < 7; k++) { const y = y0 + 30 + Math.random() * (g.rowH - 50); puff(x, y, 'dust', 2); puff(x, y, 'spark', 3); } } });
      }
    }
    lunge = anyMelee ? { t0: now + 250 * sp, t1: now + 1100 * sp, sectors: [0, 1, 2].filter(k => B.fx.some(f => f.type === 'melee' && f.sector === k)), charge } : null;
    if (anyCharge) sched.push({ at: now + 380 * sp, fn: () => shake(10) });
    else if (anyMelee) sched.push({ at: now + 400 * sp, fn: () => shake(4, 300) });
    // sound
    if (anyRanged) { if (era <= 2) Sfx.arrows(6); else if (anyMG) Sfx.mg(); else Sfx.volley(12); }
    if (anyArt) setTimeout(() => Sfx.cannon(2), 100);
    if (anyArmor) Sfx.engine();
    if (anyCharge) { Sfx.hooves(); Sfx.shout(); }
    if (anyMelee) setTimeout(() => Sfx.clash(8), 380 * sp);
    // barrages, broken lines, fallen generals, enemy cards
    for (const f of B.fx) {
      if (f.type === 'barrage') {
        const foes = B.units.filter(u => u.side !== f.side && u.sector === f.sector);
        const guns = B.units.filter(u => u.side === f.side && Battle.cls(u) === 'art');
        for (const gu of guns) { const a = center(gu); if (!a) continue; for (let k = 0; k < 4; k++) { const tg = foes.length ? center(foes[k % foes.length]) : null; if (tg) shoot(a.x, a.y - 6, tg.x, tg.y, 'ball', k * 120 * sp); } }
        setTimeout(() => Sfx.cannon(4), 50); sched.push({ at: now + 700 * sp, fn: () => shake(8) });
      }
      if (f.type === 'break') sched.push({ at: now + 900 * sp, fn: () => { shake(12, 500); Sfx.shout(); } });
      if (f.type === 'general') sched.push({ at: now + 900 * sp, fn: () => { shake(8); Sfx.dirge(); } });
      if (f.type === 'card' && f.side !== me) { const c = Battle.CARDS[f.card]; addBanner(c.name, `Enemy stratagem${f.sector != null ? ' · ' + B.sectors[f.sector].name : ''}`, B.sides[f.side].color, c.icon, 1700, true); Sfx.card(); }
    }
  }
  function banner(t) {
    ctx.save(); ctx.font = '600 13px Inter'; const tw = ctx.measureText(t).width;
    ctx.fillStyle = 'rgba(20,12,4,.8)'; ctx.fillRect(W / 2 - tw / 2 - 12, H - 30, tw + 24, 24);
    ctx.fillStyle = '#ffe6a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, W / 2, H - 18); ctx.restore();
  }

  function drawFx(f, now) {
    const g = G();
    if (f.type === 'order') {
      const y = g.top + f.sector * g.rowH + g.rowH * (f.side === 0 ? 0.62 : 0.38);
      const x = lineX(f.sector), dir = f.side === 0 ? 1 : -1, col = B.sides[f.side].color;
      const ink = Draw.lum(col) < 0.25 ? Draw.shade(col, 0.4) : col;
      const o = f.order;
      if (o === 'ADVANCE') Draw.arrow(ctx, x - dir * 90, y, x - dir * 8, y, ink, 7);
      else if (o === 'CHARGE') { Draw.arrow(ctx, x - dir * 130, y - 8, x + dir * 10, y - 8, ink, 8); Draw.arrow(ctx, x - dir * 130, y + 8, x + dir * 10, y + 8, ink, 8); }
      else if (o === 'FALLBACK') Draw.arrow(ctx, x - dir * 20, y, x - dir * 110, y, ink, 6);
      else if (o === 'FEINT') { Draw.arrow(ctx, x - dir * 20, y, x - dir * 120, y, ink, 6, 0.8); }
      else if (o === 'HOLD') { ctx.fillStyle = ink; ctx.fillRect(x - dir * 30 - 4, y - 18, 8, 36); }
      else if (o === 'BOMBARD') { for (let i = 0; i < 4; i++) Draw.arrow(ctx, x - dir * 110, y - 18 + i * 12, x + dir * 50, y - 22 + i * 12, ink, 2, 0.4 * dir); }
      ctx.save(); ctx.font = '700 12px Inter'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.textAlign = 'center';
      const lbl = ORDERS[o]?.name.toUpperCase() || ''; ctx.strokeText(lbl, x - dir * 70, y - 14); ctx.fillText(lbl, x - dir * 70, y - 14); ctx.restore();
    } else if (f.type === 'envelop') {
      const x = lineX(f.from), y1 = g.top + f.from * g.rowH + g.rowH / 2, y2 = g.top + f.to * g.rowH + g.rowH / 2;
      const col = B.sides[f.side].color, dir = f.side === 0 ? 1 : -1;
      Draw.arrow(ctx, x - dir * 40, y1, lineX(f.to) + dir * 70, y2, Draw.lum(col) < 0.25 ? Draw.shade(col, 0.4) : col, 9, dir * (f.to > f.from ? -1 : 1) * 0.8);
    } else if (f.type === 'melee') {
      const x = lineX(f.sector), y = g.top + f.sector * g.rowH + g.rowH / 2;
      for (let i = 0; i < 9; i++) { const a = (now / 90 + i * 0.7) % 6.28; ctx.strokeStyle = i % 2 ? '#ffd24a' : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6 + (i - 4) * 9); ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16 + (i - 4) * 9); ctx.stroke(); }
    } else if (f.type === 'break') {
      const x = lineX(f.sector), y = g.top + f.sector * g.rowH + g.rowH / 2;
      ctx.save(); ctx.font = '800 22px Cinzel'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffde7a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText('LINE BROKEN', x, y); ctx.fillText('LINE BROKEN', x, y); ctx.restore();
    } else if (f.type === 'general') {
      ctx.save(); ctx.font = '800 20px Cinzel'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb0b0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      const t = `${B.sides[f.side].general.name} has fallen!`; ctx.strokeText(t, W / 2, g.top + 40); ctx.fillText(t, W / 2, g.top + 40); ctx.restore();
    }
  }

  // ---------- interaction
  function hit(x, y) {
    const g = G();
    for (const u of B.units) {
      const d = disp.get(u.uid); if (!d || u.status !== 'ok') continue;
      if (x >= d.x && x <= d.x + g.cw && y >= d.y && y <= d.y + g.ch) return u;
    }
    return null;
  }
  function sectorAt(x, y) { const g = G(); if (x < g.fx0) return me === 0 ? 'R' : null; if (x > g.fx1) return me === 1 ? 'R' : null; const s = Math.floor((y - g.top) / g.rowH); return s >= 0 && s < 3 ? s : null; }

  function click(e) {
    if (animating) return;
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (cardSel && cardSel.target) { const s2 = sectorAt(x, y); if (typeof s2 === 'number' && Battle.cardOK(B, me, B.sides[me].hand[cardSel.idx], s2)) playMyCard(cardSel.idx, s2); else { cardSel = null; renderHand(); } return; }
    const u = hit(x, y);
    if (u) { if (u.side !== me && u.sector === 'R' && !B.over) { sel = null; info(); return; } sel = u.uid; info(); return; }
    // clicked empty sector with own unit selected → move it there
    const s = sectorAt(x, y);
    const su = B.units.find(q => q.uid === sel);
    if (su && su.side === me && s != null && s !== su.sector) { moveUnit(su, s); return; }
    sel = null; info();
  }

  function canMove(u, to) {
    if (B.over || u.side !== me || u.status !== 'ok') return false;
    if (phase === 'deploy') return true;
    if (u.sector === 'R') return to !== 'R';
    if (to === 'R') return true;
    return Math.abs(to - u.sector) === 1;
  }
  function moveUnit(u, to) {
    if (!canMove(u, to)) { toast('Units can only shift to an adjacent sector or back to the reserve.'); return; }
    if (phase === 'deploy') { u.sector = to; if (B.sides[me].general && to !== 'R' && !Battle.unitsIn(B, me, B.sides[me].general.sector).length && B.sides[me].general.sector !== 'R') B.sides[me].general.sector = to; info(); renderPanel(); return; }
    pending.moves = pending.moves.filter(m => m.uid !== u.uid);
    if (to !== u.sector) pending.moves.push({ uid: u.uid, to });
    info(); renderPanel();
  }

  function defaults() {
    pending = Battle.emptyOrders();
    for (let s = 0; s < 3; s++) {
      const v = Battle.validOrders(B, me, s);
      const prev = lastOrders?.sec[s];
      pending.sec[s] = v.length ? (prev && v.includes(prev) && prev !== 'ENVELOP' && prev !== 'FEINT' ? prev : 'HOLD') : null;
    }
  }

  function powerTxt(s) {
    const mp = Battle.sectorPower(B, me, s, true), ep = Battle.sectorPower(B, 1 - me, s, true);
    if (!ep && !mp) return '';
    const r = (mp + 0.01) / (ep + 0.01);
    const cl = r > 1.25 ? 'good' : r < 0.8 ? 'bad' : '';
    return `<span class="${cl}">${mp.toFixed(0)} vs ${ep.toFixed(0)}</span>`;
  }
  function terrainChips(s) {
    const sec = B.sectors[s];
    const names = { hill: 'hill', fort: 'fortified', river: 'river', mud: 'mud', woods: 'woods', narrow: 'narrow' };
    return sec.terrain.map(t => `<span class="chip" title="${sec.note}">${names[t]}${['hill', 'fort', 'river'].includes(t) ? (sec.owner == null ? ' (taken)' : sec.owner === me ? ' (yours)' : ' (enemy)') : ''}</span>`).join('');
  }

  function renderPanel() {
    const el = $('bOrders');
    if (B.over) { el.innerHTML = `<h3>Battle over</h3><div>${B.endReason}</div>`; $('bGo').textContent = 'Debrief'; $('bGo').disabled = false; $('bRetreat').disabled = true; return; }
    $('bRetreat').disabled = phase === 'deploy';
    $('bRound').textContent = phase === 'deploy' ? 'Deployment' : `Round ${B.round} of ${B.maxRounds}${B.defender != null ? ` · ${B.sides[B.defender].name} wins if it holds until the end` : ''}`;
    if (phase === 'deploy') {
      const D = B.sides[me].doctrine;
      el.innerHTML = `<h3>Deploy your army</h3>
        <div class="tip">Click one of your counters, then click a sector (or the reserve strip) to move it. Units held in reserve can be committed to any sector later and strike fresh.</div>
        <div class="plan" style="margin-top:8px"><b>Doctrine: ${DOCTRINES[D].name}</b><div class="tip">${DOCTRINES[D].desc}</div></div>
        ${opts.plan ? `<div class="hist"><b>Historical plan.</b> <span class="tip">${opts.plan}</span></div>` : ''}`;
      $('bGo').textContent = 'Begin Battle ⚔';
      return;
    }
    $('bGo').textContent = 'Resolve Round ⚔';
    let h = `<h3>Orders — round ${B.round}</h3>`;
    for (let s = 0; s < 3; s++) {
      const v = Battle.validOrders(B, me, s);
      const moving = pending.moves.filter(m => { const u = B.units.find(x => x.uid === m.uid); return u && u.sector === s; }).length;
      h += `<div class="secRow"><div class="hd"><b>${B.sectors[s].name}${terrainChips(s)}</b><span class="pw" title="Estimated combat power, yours vs theirs, including troop matchups">${powerTxt(s)}</span></div>`;
      if (!v.length) h += `<div class="tip">No troops here.${Battle.unitsIn(B, 1 - me, s).length ? ' <span class="bad">Enemy holds this sector.</span>' : ''}</div>`;
      else {
        h += `<div class="ords">${v.map(o => `<button class="${pending.sec[s] === o ? 'on' : ''}" data-s="${s}" data-o="${o}" title="${ORDERS[o].desc}">${ORDERS[o].icon} ${ORDERS[o].name}</button>`).join('')}</div>`;
        if (pending.sec[s] === 'ENVELOP') {
          const tg = Battle.adj(s).filter(t => Battle.unitsIn(B, 1 - me, t).length);
          if (pending.env[s] == null || !tg.includes(pending.env[s])) pending.env[s] = tg[0];
          if (tg.length > 1) h += `<div class="ords">Flank into: ${tg.map(t => `<button class="small ${pending.env[s] === t ? 'on' : ''}" data-env="${s}" data-t="${t}">${B.sectors[t].name}</button>`).join('')}</div>`;
          else h += `<div class="tip">Swinging into ${B.sectors[tg[0]].name}.</div>`;
        }
        if (moving) h += `<div class="tip">${moving} unit(s) shifting out this round (they will not fight).</div>`;
      }
      if (B.spied?.[me] && B.orders[1 - me]?.sec?.[s]) h += `<div class="en" style="color:#7a2a10">👁 Spies report the enemy will: <b>${ORDERS[B.orders[1 - me].sec[s]].name}</b></div>`;
      else if (lastOrders && B.round > 1 && B.lastEnemy?.[s]) h += `<div class="en muted">Enemy last round: <b>${ORDERS[B.lastEnemy[s]].name}</b></div>`;
      h += `</div>`;
    }
    const res = Battle.unitsIn(B, me, 'R');
    if (res.length) {
      h += `<div class="secRow"><div class="hd"><b>Reserve (${res.length})</b><span class="pw">${res.map(u => u.name).slice(0, 3).join(', ')}${res.length > 3 ? '…' : ''}</span></div>
        <div class="ords"><button class="${pending.commit == null ? 'on' : ''}" data-commit="none">Keep back</button>${[0, 1, 2].map(s => `<button class="${pending.commit === s ? 'on' : ''}" data-commit="${s}">→ ${B.sectors[s].name.split(':')[0].split('(')[0].trim()}</button>`).join('')}</div>
        <div class="tip">Committed reserves fight this round${B.sides[me].doctrine === 'central' ? ' with +40% (Central Position)' : B.sides[me].doctrine === 'triplex' ? ' and restore 20 morale to the sector (Triplex Acies)' : ''}.</div></div>`;
    }
    const er = B.units.filter(u => u.side !== me && u.sector === 'R' && u.status === 'ok').length;
    if (er) h += `<div class="tip" style="margin-top:4px">The enemy has ${er} unit(s) in reserve.</div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { pending.sec[+b.dataset.s] = b.dataset.o; renderPanel(); });
    el.querySelectorAll('[data-env]').forEach(b => b.onclick = () => { pending.env[+b.dataset.env] = +b.dataset.t; renderPanel(); });
    el.querySelectorAll('[data-commit]').forEach(b => b.onclick = () => { pending.commit = b.dataset.commit === 'none' ? null : +b.dataset.commit; renderPanel(); });
    el.querySelectorAll('button[data-o]').forEach(b => b.addEventListener('mouseenter', () => infoOrder(b.dataset.o)));
  }

  // ---------- command cards
  function renderHand() {
    const el = $('bHand'); if (!el) return;
    const S = B.sides[me];
    if (!S.cards || phase !== 'plan' || B.over || animating) { el.innerHTML = ''; return; }
    const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < S.cp ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `<div class="cp" title="Command points: +1 each round (and an extra one every third round while your general lives). Up to 2 cards per round.">${pips}<span>Command</span></div>` +
      S.hand.map((id, i) => { const c = Battle.CARDS[id]; const can = S.cp >= c.cost && B.cardFx[me].played < 2 && (c.target || Battle.cardOK(B, me, id, null));
        return `<button class="card ${cardSel?.idx === i ? 'sel' : ''}" data-card="${i}" ${can ? '' : 'disabled'} title="${c.desc}"><span class="cost">${c.cost}</span><span class="ic">${c.icon}</span><b>${c.name}</b><span class="d">${c.desc}</span></button>`; }).join('');
    el.querySelectorAll('[data-card]').forEach(b => b.addEventListener('mouseenter', () => { if (cardSel || sel) return; const c = Battle.CARDS[S.hand[+b.dataset.card]]; $('bInfo').innerHTML = `<b>${c.icon} ${c.name}</b> <span class="muted">— ${c.cost} command point${c.cost > 1 ? 's' : ''}</span><div class="tip">${c.desc}</div>`; }));
    el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => {
      const i = +b.dataset.card, c = Battle.CARDS[S.hand[i]];
      Sfx.flip();
      if (c.target) { cardSel = cardSel?.idx === i ? null : { idx: i, target: c.target }; renderHand(); if (cardSel) $('bInfo').innerHTML = `<b>${c.icon} ${c.name}</b><div class="tip">${c.desc}</div><div class="plan">Click a highlighted ${c.target === 'own' ? 'sector where you have troops' : 'sector held by the enemy'} on the battlefield.</div>`; }
      else playMyCard(i, null);
    });
  }
  function playMyCard(i, target) {
    const S = B.sides[me], id = S.hand[i], c = Battle.CARDS[id];
    if (!Battle.playCard(B, me, i, target)) return;
    cardSel = null; Sfx.card();
    addBanner(c.name, target != null ? B.sectors[target].name : id === 'charge' ? `${S.general.name} leads from the front` : '', S.color, c.icon, 1500, true);
    const g = G();
    if (typeof target === 'number') for (let k = 0; k < 6; k++) puff(g.mid + (Math.random() - 0.5) * 200, g.top + target * g.rowH + 40 + Math.random() * (g.rowH - 60), 'spark', 2);
    if (id === 'speech' || id === 'rally') Sfx.shout();
    if (id === 'reserves') Sfx.march();
    renderHand(); renderPanel(); renderLog(); info();
  }

  function infoOrder(o) {
    if (sel) return;
    $('bInfo').innerHTML = `<b>${ORDERS[o].icon} ${ORDERS[o].name}</b><div class="tip">${ORDERS[o].desc}</div>`;
  }

  function info() {
    const el = $('bInfo');
    const u = B.units.find(x => x.uid === sel);
    if (!u) {
      const D = B.sides[me].doctrine;
      el.innerHTML = `<b>${B.sides[me].commander || B.sides[me].name}</b> <span class="muted">— doctrine:</span> <b>${DOCTRINES[D].name}</b><div class="tip">${DOCTRINES[D].desc}</div><div class="tip" style="margin-top:4px">Click a counter for details. Green bar = strength, blue bar = morale. “!” = disordered. Orange corner = drawn in (open to flank attacks).</div>`;
      return;
    }
    const d = U[u.t];
    const mine = u.side === me;
    let h = `<div style="display:flex;justify-content:space-between"><b>${u.name}</b><span class="muted">${B.sides[u.side].name}</span></div>
      <div class="tip">${d.name} · ${CLASSES[d.cls].name} · Era ${['', 'I', 'II', 'III', 'IV', 'V'][d.era]} · BR ${d.br.toFixed(1)}</div>
      <div class="statgrid"><div>Attack<b>${d.atk}</b></div><div>Defense<b>${d.def}</b></div><div>Strength<b>${Math.round(u.str)}%</b></div><div>Morale<b>${Math.round(u.mor)}</b></div>
      ${d.arm || d.pen ? `<div>Armor<b>${d.arm} mm</b></div><div>Pen.<b>${d.pen} mm</b></div>` : ''}</div>
      ${d.tags.length ? `<div class="tip">Traits: ${d.tags.join(', ')}</div>` : ''}
      <div class="tip" style="margin-top:4px"><i>${d.note}</i></div>`;
    if (u.disorder) h += `<div class="bad">Disordered for ${u.disorder} more round(s): weaker in attack and defense.</div>`;
    if (u.drawn) h += `<div class="bad">Drawn in: vulnerable to flank attacks.</div>`;
    if (mine && !B.over && u.status === 'ok') {
      const dests = (phase === 'deploy' ? [0, 1, 2, 'R'] : u.sector === 'R' ? [0, 1, 2] : [...Battle.adj(u.sector), 'R']).filter(t => t !== u.sector);
      const pm = pending.moves.find(m => m.uid === u.uid);
      h += `<div class="btnrow">${dests.map(t => `<button class="small ${pm && pm.to === t ? 'on' : ''}" data-mv="${t}">${t === 'R' ? 'To reserve' : (u.sector === 'R' && phase !== 'deploy' ? 'Commit → ' : 'Move → ') + B.sectors[t].name.split(':')[0].split('(')[0].trim()}</button>`).join('')}${pm ? '<button class="small" data-mv="cancel">Cancel move</button>' : ''}</div>`;
      if (phase === 'plan' && u.sector !== 'R') h += `<div class="tip">Shifting sectors takes the round: the unit will not fight while it moves.</div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
      const v = b.dataset.mv;
      if (v === 'cancel') { pending.moves = pending.moves.filter(m => m.uid !== u.uid); info(); renderPanel(); return; }
      moveUnit(u, v === 'R' ? 'R' : +v);
    });
  }

  function renderLog() {
    const el = $('bLog');
    let h = '', r = -1;
    for (const e of B.log.slice(-80)) {
      if (e.round !== r) { r = e.round; h += `<div class="rh">${r === 0 ? 'Deployment' : 'Round ' + r}</div>`; }
      h += `<div class="e ${e.kind === 'good' ? (e.side === me ? 'good' : 'bad') : e.kind === 'rout' || e.kind === 'bad' ? (e.side === me ? 'bad' : 'good') : e.kind}">${e.text}</div>`;
    }
    el.innerHTML = h || '<div class="tip">The armies face each other. Issue your orders.</div>';
    el.scrollTop = el.scrollHeight;
  }

  // ---------- turn flow
  function go() {
    if (animating) return;
    if (B.over) { finish(); return; }
    if (phase === 'deploy') {
      phase = 'plan'; Battle.beginRound(B); defaults(); sel = null;
      Sfx.march(); addBanner('Battle is joined', '', '#ffe6a8', '', 1300);
      renderPanel(); renderLog(); info(); renderHand(); return;
    }
    const before = new Map(B.units.map(u => [u.uid, u.str]));
    const prevSec = new Map(B.units.map(u => [u.uid, u.sector]));
    cardSel = null;
    B.orders[me] = JSON.parse(JSON.stringify(pending));
    lastOrders = B.orders[me];
    Battle.resolve(B);
    B.lastEnemy = B.orders[1 - me].sec.slice();
    // fx
    fxShow = [];
    for (let side = 0; side < 2; side++) for (let s = 0; s < 3; s++) { const o = B.orders[side].sec[s]; if (o && o !== 'ENVELOP') fxShow.push({ type: 'order', side, sector: s, order: o }); }
    fxShow.push(...B.fx);
    fxUntil = performance.now() + 2200 * SETTINGS.speed;
    addBanner(`Round ${B.round}`, '', '#ffe6a8', '', 1000);
    playRound(prevSec);
    const g = G(), now = performance.now();
    for (const u of B.units) {
      const d = disp.get(u.uid); if (!d) continue;
      const lost = (before.get(u.uid) ?? 100) - u.str;
      if (lost > 0.5) floaters.push({ x: d.x + g.cw / 2, y: d.y, text: '-' + Math.round(lost), color: u.side === me ? '#ff9a8a' : '#ffe08a', t0: now, t1: now + 1600 * Math.max(0.4, SETTINGS.speed) });
      if (u.status !== 'ok' && u.routedAt == null) u.routedAt = B.round;
    }
    animating = true; $('bGo').disabled = true; renderHand();
    renderLog();
    setTimeout(() => {
      animating = false; $('bGo').disabled = false;
      if (!B.over) { Battle.beginRound(B); defaults(); renderLog(); }
      if (sel && B.units.find(u => u.uid === sel)?.status !== 'ok') sel = null;
      renderPanel(); info(); renderHand();
      if (B.over) { Sfx.stopDrums(); if (B.winner === me) Sfx.fanfare(); else Sfx.dirge(); addBanner(B.winner === me ? 'VICTORY' : B.winner == null ? 'STALEMATE' : 'DEFEAT', '', B.winner === me ? '#ffe08a' : '#ff9a8a', '', 2400); setTimeout(finish, 1400 * SETTINGS.speed); }
    }, 1400 * SETTINGS.speed);
  }

  function finish() {
    if (B._finished) return; B._finished = true;
    renderPanel();
    const sum = Battle.summary(B);
    if (opts.onEnd) opts.onEnd(B, sum, () => stop());
  }

  function help() {
    modal(`<h2>How battles work</h2>
      <p>The field has three sectors and a reserve. Every round both commanders secretly give each sector one order, then everything happens at once.</p>
      <table class="cas">${Object.entries(ORDERS).map(([k, o]) => `<tr><td><b>${o.icon} ${o.name}</b></td><td class="tip">${o.desc}</td></tr>`).join('')}</table>
      <p><b>Morale</b> (blue bar) matters as much as strength (green): a unit breaks when either runs out. Flank attacks, terror weapons, a broken neighbouring sector, or the death of your general all drain morale.</p>
      <p><b>Ground</b>: hills, fortifications and rivers favour their holder until the line is pushed past them. Mud ruins charges and slows advances. A narrow front lets only 3 units per side fight; the rest crowd behind — easy targets for missiles.</p>
      <p><b>Armor</b>: from the Industrial era, tanks have armor (mm) and guns have penetration (mm). A weapon that cannot penetrate does almost nothing. Bring anti-tank guns or better tanks.</p>
      <p><b>Victory</b>: break the enemy army (strength or morale collapse), or hold the field at nightfall if you are the defender.</p>
      <div class="acts"><button class="primary" onclick="closeModal()">Got it</button></div>`);
  }

  function toastLog(t) { B.log.push({ round: 0, text: t, kind: 'note' }); renderLog(); }

  return { start, stop, get B() { return B; }, get me() { return me; }, go, setPending: (o) => { Object.assign(pending, o); renderPanel(); }, get pending() { return pending; } };
})();
