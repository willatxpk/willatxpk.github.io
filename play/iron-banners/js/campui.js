// Iron Banners — campaign screen
'use strict';

const CampUI = (() => {
  const $ = id => document.getElementById(id);
  let cv, ctx, W, H, dpr = 1;
  const cam = { x: 0, y: 0, z: 1 };
  let selHex = null, selUnits = new Set(), busy = false, raf = 0, floaters = [], focusHex = null, focusUntil = 0;
  const SIZE = 40;
  const SQ3 = Math.sqrt(3);
  let G = null;

  function hexXY(h) { return { x: SIZE * SQ3 * (h.c + 0.5 * (h.r & 1)), y: SIZE * 1.5 * h.r }; }
  function toScreen(x, y) { return { x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 }; }
  function toWorld(x, y) { return { x: (x - W / 2) / cam.z + cam.x, y: (y - H / 2) / cam.z + cam.y }; }
  function hexAtPoint(wx, wy) {
    let best = null, bd = 1e9;
    for (const h of G.map.hexes) { const p = hexXY(h); const d = (p.x - wx) ** 2 + (p.y - wy) ** 2; if (d < bd) { bd = d; best = h; } }
    return bd < SIZE * SIZE ? best : null;
  }

  function start(fresh) {
    G = Camp.G;
    cv = $('cCanvas'); ctx = cv.getContext('2d');
    showScreen('camp');
    resize(); window.addEventListener('resize', resize);
    const cap = G.map.hexes[Camp.human().capital] || G.map.hexes[0];
    const p = hexXY(cap); cam.x = p.x; cam.y = p.y; cam.z = Math.min(1.3, Math.max(0.7, Math.min(W / (G.map.cols * SIZE * SQ3 + 80), H / (G.map.rows * SIZE * 1.5 + 80)) * 1.6));
    bindInput();
    $('cEnd').onclick = endTurn;
    $('cTech').onclick = techDialog;
    $('cTrade').onclick = tradeDialog;
    $('cNations').onclick = nationsDialog;
    $('cMenu').onclick = menuDialog;
    selHex = cap; selUnits = new Set();
    cancelAnimationFrame(raf); loop();
    refresh();
    if (fresh) { beginPlayerTurn(true); }
    else if (G.phase === 'roll') beginPlayerTurn(false);
  }

  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  // ---------- input
  let drag = null;
  function bindInput() {
    cv.onmousedown = e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; };
    window.onmousemove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; };
    window.onmouseup = e => { if (drag && !drag.moved && e.target === cv) click(e.clientX, e.clientY); drag = null; };
    cv.onwheel = e => { e.preventDefault(); const before = toWorld(e.clientX, e.clientY); cam.z = Math.max(0.45, Math.min(2.4, cam.z * (e.deltaY < 0 ? 1.12 : 0.89))); const after = toWorld(e.clientX, e.clientY); cam.x += before.x - after.x; cam.y += before.y - after.y; };
    cv.ontouchstart = e => { const t = e.touches[0]; drag = { x: t.clientX, y: t.clientY, cx: cam.x, cy: cam.y, moved: false }; };
    cv.ontouchmove = e => { if (!drag) return; const t = e.touches[0]; const dx = t.clientX - drag.x, dy = t.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true; cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; e.preventDefault(); };
    cv.ontouchend = e => { if (drag && !drag.moved) click(drag.x, drag.y); drag = null; };
  }

  function click(sx, sy) {
    if (busy || G.over) return;
    const w = toWorld(sx, sy);
    const h = hexAtPoint(w.x, w.y);
    if (!h) return;
    // move order?
    if (selHex && selHex.owner === 0 && selUnits.size && h !== selHex && Camp.reachable(selHex).includes(h)) { doMove(selHex, h); return; }
    selHex = h;
    selUnits = new Set(h.owner === 0 ? h.army.filter(u => !u.moved).map(u => u.id) : []);
    refresh();
  }

  function doMove(a, b) {
    const ids = [...selUnits];
    const r = Camp.move(a, b, ids);
    if (r.err) { toast(r.err); return; }
    if (r.battle) { attackDialog(r.battle); return; }
    selHex = b; selUnits = new Set(); refresh(); Camp.save();
  }

  // ---------- render
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!document.getElementById('camp').classList.contains('show')) return;
    draw();
  }

  function hexPath(x, y, s) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 30); const px = x + s * Math.cos(a), py = y + s * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }

  function draw() {
    const now = performance.now();
    ctx.fillStyle = '#25506d'; ctx.fillRect(0, 0, W, H);
    // waves
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (let y = ((-cam.y * cam.z) % 26 + 26) % 26; y < H; y += 26) { ctx.beginPath(); for (let x = 0; x < W; x += 12) ctx.lineTo(x, y + Math.sin((x + cam.x * cam.z) / 30 + now / 1500) * 3); ctx.stroke(); }
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const reach = selHex && selHex.owner === 0 && selUnits.size ? new Set(Camp.reachable(selHex).map(h => h.i)) : new Set();
    const s = SIZE - 1;
    for (const h of G.map.hexes) {
      if (h.terr === 'sea') continue;
      const { x, y } = hexXY(h);
      const T = TERRAIN[h.terr];
      hexPath(x, y, s); ctx.fillStyle = T.color; ctx.fill();
      terrainArt(h, x, y);
      if (h.owner != null) { hexPath(x, y, s); ctx.fillStyle = hexA(Camp.nation(h.owner).color, 0.22); ctx.fill(); }
      if (h.bandit) { ctx.fillStyle = 'rgba(0,0,0,.35)'; hexPath(x, y, s); ctx.fill(); ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('☠', x + 16, y - 16); }
    }
    // borders
    for (const h of G.map.hexes) {
      if (h.owner == null) continue;
      const { x, y } = hexXY(h);
      const col = Camp.nation(h.owner).color;
      const nb = Camp.nbrs(h.c, h.r);
      // check each edge
      for (let k = 0; k < 6; k++) {
        const a1 = Math.PI / 180 * (60 * k - 30), a2 = Math.PI / 180 * (60 * (k + 1) - 30);
        const mx = x + SIZE * SQ3 * Math.cos((a1 + a2) / 2), my = y + SIZE * SQ3 * Math.sin((a1 + a2) / 2); // centre of the hex across this edge
        const other = nb.map(([c, r]) => Camp.hexAt(c, r)).find(n => { const p = hexXY(n); return (p.x - mx) ** 2 + (p.y - my) ** 2 < (SIZE * 0.5) ** 2; });
        if (other && other.owner === h.owner) continue;
        ctx.strokeStyle = col; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + (s - 2) * Math.cos(a1), y + (s - 2) * Math.sin(a1)); ctx.lineTo(x + (s - 2) * Math.cos(a2), y + (s - 2) * Math.sin(a2)); ctx.stroke();
      }
    }
    // reach highlights
    for (const h of G.map.hexes) {
      if (!reach.has(h.i)) continue;
      const { x, y } = hexXY(h);
      const enemy = h.owner != null && h.owner !== 0;
      hexPath(x, y, s - 4); ctx.strokeStyle = enemy ? (h.army.length ? '#ff5040' : '#ff9a40') : h.owner == null ? '#ffe070' : '#9fe0ff';
      ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    // tokens, buildings, armies
    for (const h of G.map.hexes) {
      if (h.terr === 'sea') continue;
      const { x, y } = hexXY(h);
      if (h.num) token(x, y + 2, h.num, h);
      if (h.b) building(h, x, y);
      if (h.army.length) army(h, x, y);
    }
    // selection
    if (selHex) { const { x, y } = hexXY(selHex); hexPath(x, y, s - 1); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3.5; ctx.stroke(); }
    if (focusHex && now < focusUntil) { const { x, y } = hexXY(focusHex); hexPath(x, y, s + 3 + Math.sin(now / 80) * 2); ctx.strokeStyle = '#ff4030'; ctx.lineWidth = 4; ctx.stroke(); }
    // floaters
    floaters = floaters.filter(f => now < f.t1);
    for (const f of floaters) {
      const p = (now - f.t0) / (f.t1 - f.t0);
      ctx.globalAlpha = 1 - p * p; ctx.font = '700 15px Inter'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y - p * 30); ctx.fillText(f.text, f.x, f.y - p * 30); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function terrainArt(h, x, y) {
    const r = Draw.srng(h.i * 7919 + 13);
    ctx.save();
    switch (h.terr) {
      case 'plains': ctx.strokeStyle = 'rgba(150,110,30,.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const px = x - 22 + r() * 44, py = y - 22 + r() * 40; ctx.beginPath(); ctx.moveTo(px, py + 6); ctx.lineTo(px, py - 4); ctx.moveTo(px - 3, py - 1); ctx.lineTo(px, py - 5); ctx.lineTo(px + 3, py - 1); ctx.stroke(); } break;
      case 'forest': for (let i = 0; i < 6; i++) { const px = x - 22 + r() * 44, py = y - 22 + r() * 34; ctx.fillStyle = `rgb(${30 + r() * 20},${70 + r() * 30},35)`; ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px - 7, py + 5); ctx.lineTo(px + 7, py + 5); ctx.fill(); ctx.fillStyle = '#4a3020'; ctx.fillRect(px - 1, py + 5, 2, 3); } break;
      case 'hills': ctx.fillStyle = 'rgba(110,80,50,.6)'; for (let i = 0; i < 3; i++) { const px = x - 18 + i * 16 + r() * 6, py = y - 8 + r() * 14; ctx.beginPath(); ctx.ellipse(px, py, 11, 7, 0, Math.PI, 0); ctx.fill(); } ctx.fillStyle = 'rgba(200,200,210,.6)'; ctx.fillRect(x - 3, y - 22, 6, 3); break;
      case 'pasture': ctx.strokeStyle = 'rgba(60,110,40,.6)'; ctx.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const px = x - 24 + r() * 48, py = y - 22 + r() * 40; ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px, py - 6); ctx.lineTo(px + 3, py); ctx.stroke(); } break;
      case 'gold': ctx.strokeStyle = '#4c86b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 30, y - 10); ctx.quadraticCurveTo(x - 8, y - 22, x + 4, y - 6); ctx.quadraticCurveTo(x + 14, y + 8, x + 32, y - 2); ctx.stroke(); ctx.fillStyle = '#e8c040'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 16 + r() * 32, y - 18 + r() * 12, 2, 0, 7); ctx.fill(); } break;
      case 'desert': ctx.strokeStyle = 'rgba(160,120,60,.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 14 + i * 14, y - 4 + r() * 10, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        if (Camp.G.nations[0].techs.includes('combustion')) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 14, y - 4); ctx.lineTo(x + 18, y - 24); ctx.lineTo(x + 22, y - 4); ctx.moveTo(x + 15, y - 12); ctx.lineTo(x + 21, y - 12); ctx.stroke(); } break;
      case 'mountain': for (let i = 0; i < 3; i++) { const px = x - 16 + i * 16, py = y + 8 - (i === 1 ? 8 : 0); ctx.fillStyle = '#6a6460'; ctx.beginPath(); ctx.moveTo(px, py - 22); ctx.lineTo(px - 14, py + 6); ctx.lineTo(px + 14, py + 6); ctx.fill(); ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.moveTo(px, py - 22); ctx.lineTo(px - 5, py - 12); ctx.lineTo(px + 5, py - 12); ctx.fill(); } break;
    }
    ctx.restore();
  }

  function token(x, y, n, h) {
    const hot = n === 6 || n === 8;
    const yy = y + 14;
    ctx.beginPath(); ctx.arc(x, yy, 10.5, 0, 7); ctx.fillStyle = '#f4e8c8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = hot ? '#b02818' : '#2a1c10'; ctx.font = `700 ${hot ? 12 : 11}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, x, yy - 1.5);
    const pips = 6 - Math.abs(7 - n);
    for (let k = 0; k < pips; k++) { ctx.beginPath(); ctx.arc(x - (pips - 1) * 1.6 + k * 3.2, yy + 6, 0.9, 0, 7); ctx.fill(); }
    // supply indicator
    if (h.owner != null && !Camp.supplied(h) && TERRAIN[h.terr].res) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x, yy, 10.5, 0, 7); ctx.fill(); }
  }

  function building(h, x, y) {
    const col = Camp.nation(h.owner).color;
    const bx = x - 16, by = y - 10;
    ctx.save();
    ctx.fillStyle = col; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.5;
    if (h.b === 'settlement') {
      ctx.beginPath(); ctx.moveTo(bx - 7, by + 4); ctx.lineTo(bx - 7, by - 4); ctx.lineTo(bx, by - 11); ctx.lineTo(bx + 7, by - 4); ctx.lineTo(bx + 7, by + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.rect(bx - 11, by - 6, 22, 12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(bx - 13, by - 14, 7, 20); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(bx + 6, by - 14, 7, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a120a'; ctx.fillRect(bx - 2, by - 1, 4, 7);
      if (Camp.nation(h.owner).capital === h.i) { ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd24a'; ctx.fillText('★', bx, by - 16); }
    }
    if (h.fort) { ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, SIZE - 8, 0, 7); ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.font = '11px serif'; ctx.textAlign = 'center';
    if (h.market) ctx.fillText('🪙', bx - 4, by + 18);
    if (h.academy) ctx.fillText('📜', bx + 8, by + 18);
    ctx.restore();
  }

  function army(h, x, y) {
    const col = Camp.nation(h.owner).color;
    const top = h.army.slice().sort((a, b) => U[b.t].br - U[a.t].br)[0];
    const w = 30, hh = 21, ax = x + 2, ay = y - 18;
    const allMoved = h.owner === 0 && h.army.every(u => u.moved);
    ctx.save(); if (allMoved) ctx.globalAlpha = 0.6;
    for (let k = Math.min(3, h.army.length) - 1; k > 0; k--) { ctx.fillStyle = Draw.shade(col, -0.35); Draw.rr(ctx, ax + k * 2.5, ay - k * 2.5, w, hh, 3); ctx.fill(); }
    Draw.counter(ctx, ax, ay, w, hh, { t: top.t, str: avgStr(h), mor: U[top.t].mor }, col, {});
    ctx.font = '700 10px Inter'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'center';
    ctx.strokeText(h.army.length, ax + w + 6, ay + 5); ctx.fillText(h.army.length, ax + w + 6, ay + 5);
    ctx.restore();
  }
  const avgStr = h => h.army.reduce((a, u) => a + u.str, 0) / h.army.length;

  // ---------- HUD + panel
  function refresh() {
    const N = Camp.human();
    $('cTurnLbl').textContent = `Turn ${G.turn}${G.turnLimit ? ' / ' + G.turnLimit : ''}`;
    const res = N.research ? TECHS.find(t => t.id === N.research) : null;
    $('cEra').innerHTML = `${ERAS[N.era].name} era · 🔬 ${N.sci}${res ? `/${Camp.techCost(N, res)} → ${res.name}` : ' <span class="bad">(no research set)</span>'}`;
    $('cDice').textContent = Draw.DICE[G.dice[0]] + Draw.DICE[G.dice[1]];
    $('cRes').innerHTML = RES_KEYS.filter(k => k !== 'O' || N.techs.includes('combustion')).map(k => `<div class="r" title="${RES[k].name}">${RES[k].icon}<b>${N.res[k] || 0}</b><span>${RES[k].name}</span></div>`).join('')
      + `<div class="r" title="Food eaten per turn (1 per 3 units)">🍖<b>${Camp.upkeep(0)}</b><span>Upkeep</span></div>`;
    panel(); logPanel();
  }

  function panel() {
    const el = $('cPanel'); const N = Camp.human(); const h = selHex;
    if (!h || h.terr === 'sea') { el.innerHTML = `<h3>${N.name}</h3><div class="tip">Click a hex to inspect it. Select one of your armies, then click a highlighted hex to move or attack.</div>`; return; }
    const T = TERRAIN[h.terr], owner = h.owner != null ? Camp.nation(h.owner) : null, mine = h.owner === 0;
    let x = `<h3>${T.name} <span class="muted" style="font-size:12px">(${h.c},${h.r})</span></h3>`;
    x += `<div>${owner ? `<b style="color:${owner.color}">${owner.name}</b>${owner.capital === h.i ? ' — capital' : ''}` : '<span class="muted">Unclaimed</span>'}${h.b ? ` · ${BUILD[h.b].name}` : ''}${h.fort ? ' · Fortress' : ''}${h.market ? ' · Market' : ''}${h.academy ? ' · Academy' : ''}</div>`;
    if (T.res) {
      const sup = Camp.supplied(h);
      const oilLocked = T.res === 'O' && !(owner || N).techs.includes('combustion');
      x += `<div class="tip">${RES[T.res].icon} ${RES[T.res].name} on a roll of <b>${h.num}</b> (${'•'.repeat(6 - Math.abs(7 - h.num))})${oilLocked ? ' — needs Combustion' : ''}. ${owner ? (sup ? `Produces <b>${sup}</b> per roll.` : '<span class="bad">Unsupplied: build a settlement here or next door.</span>') : ''}</div>`;
    } else x += `<div class="tip">${h.terr === 'mountain' ? 'Impassable mountains.' : ''}</div>`;
    if (T.def) x += `<div class="tip">Defensive ground in battle (${(T.battle || []).join(', ') || 'cover'}).</div>`;
    if (h.bandit) x += `<div class="bad">Raiders occupy this hex: it produces nothing. March an army here to clear them.</div>`;
    if (mine) {
      x += `<div class="sec"><b>Build</b><div class="btnrow">`;
      const opts = [];
      if (!h.b) opts.push(['settlement', Camp.canSettle(N, h)]);
      if (h.b === 'settlement') opts.push(['city', true]);
      if (!h.fort) opts.push(['fort', true]);
      if (h.b === 'city' && !h.market) opts.push(['market', true]);
      if (h.b === 'city' && !h.academy) opts.push(['academy', true]);
      x += opts.map(([k, ok]) => `<button class="small" data-build="${k}" ${ok && Camp.canPay(N, BUILD[k].cost) ? '' : 'disabled'} title="${BUILD[k].desc}">${BUILD[k].name} <span class="cost">${Camp.costTxt(BUILD[k].cost)}</span></button>`).join('');
      x += `</div>${!h.b && !Camp.canSettle(N, h) ? '<div class="tip">Settlements cannot be next to another settlement or city.</div>' : ''}</div>`;
    }
    if (h.army.length) {
      x += `<div class="sec"><b>Army (${h.army.length}/${Camp.MAX_STACK})</b>`;
      if (mine) x += ` <button class="small" data-sel="all">All</button> <button class="small" data-sel="none">None</button>`;
      x += `<div class="unitList" style="margin-top:4px">` + h.army.map(u => {
        const d = U[u.t];
        return `<div class="unitLine ${selUnits.has(u.id) ? 'sel' : ''}" data-u="${u.id}" style="cursor:${mine ? 'pointer' : 'default'}">${mine ? `<input type="checkbox" ${selUnits.has(u.id) ? 'checked' : ''} ${u.moved ? 'disabled' : ''}>` : ''}<span class="nm">${d.name}${u.exp ? ' <span style="color:#b08a10">' + '★'.repeat(u.exp) + '</span>' : ''} <span class="muted">${CLASSES[d.cls].name}${d.arm ? ` · ${d.arm}mm` : ''}</span></span><span class="bar"><i style="width:${u.str}%"></i></span>${u.moved && mine ? '<span class="muted">moved</span>' : ''}${mine ? `<button class="small" data-dis="${u.id}" title="Disband">✕</button>` : ''}</div>`;
      }).join('') + `</div>`;
      if (mine) x += `<div class="tip">${selUnits.size ? `Click a highlighted hex to move ${selUnits.size} unit(s). <span style="color:#c03020">Red</span> = attack, orange = capture, yellow = claim.` : 'Select units to move.'}</div>`;
      x += `</div>`;
    }
    if (mine && h.b === 'city') {
      x += `<div class="sec"><b>Recruit</b> <span class="tip">(new units can move next turn)</span><div class="recruit" style="margin-top:4px">`;
      for (const t of Camp.unitsUnlocked(N).slice().reverse()) {
        const d = U[t], c = Camp.unitCost(N, t);
        x += `<div class="nm" title="${d.note}"><b>${d.name}</b> <span class="muted">${CLASSES[d.cls].name} · ⚔${d.atk} 🛡${d.def}${d.arm ? ` · ${d.arm}/${d.pen}mm` : d.pen >= 20 ? ` · pen ${d.pen}` : ''}</span><div class="cost">${Camp.costTxt(c)}</div></div>
          <button class="small" data-rec="${t}" ${Camp.canPay(N, c) && h.army.length < Camp.MAX_STACK ? '' : 'disabled'}>Recruit</button>`;
      }
      x += `</div></div>`;
    }
    el.innerHTML = x;
    el.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { const e = Camp.build(N, h, b.dataset.build); if (e) toast(e); refresh(); Camp.save(); });
    el.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const e = Camp.recruit(N, h, b.dataset.rec); if (e) toast(e); refresh(); Camp.save(); });
    el.querySelectorAll('[data-u]').forEach(r => r.onclick = (ev) => { if (!mine || ev.target.dataset.dis) return; const id = +r.dataset.u; const u = h.army.find(q => q.id === id); if (u.moved) return; selUnits.has(id) ? selUnits.delete(id) : selUnits.add(id); refresh(); });
    el.querySelectorAll('[data-dis]').forEach(b => b.onclick = () => confirmBox('Disband this unit?', 'It will be removed permanently and stop costing upkeep.', () => { h.army = h.army.filter(u => u.id !== +b.dataset.dis); selUnits.delete(+b.dataset.dis); refresh(); Camp.save(); }));
    el.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { selUnits = new Set(b.dataset.sel === 'all' ? h.army.filter(u => !u.moved).map(u => u.id) : []); refresh(); });
  }

  function logPanel() {
    const el = $('cLog');
    el.innerHTML = G.log.slice(-40).map(e => `<div class="e ${e.kind === 'good' ? 'good' : e.kind === 'bad' ? 'bad' : ''}" ${e.kind === 'era' ? 'style="font-weight:600;color:#7a2a8a"' : ''}><span class="muted">T${e.turn}</span> ${e.text}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  function toast(t) { const el = $('cToast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => el.style.display = 'none', 2600); }

  function showGains(got, who) {
    const now = performance.now();
    for (const h of G.map.hexes) {
      if (h.num !== G.dice[0] + G.dice[1] || h.owner !== 0) continue;
      const y = Camp.yieldOf(h); if (!y) continue;
      const p = hexXY(h); floaters.push({ x: p.x, y: p.y - 10, text: `+${y.amt}${RES[y.res].icon}`, t0: now, t1: now + 1800 * Math.max(0.5, SETTINGS.speed) });
    }
  }

  // ---------- turn flow
  async function beginPlayerTurn(first) {
    if (G.over) { endGame(); return; }
    Camp.turnStart(0);
    const { n, got } = Camp.rollDice();
    G.phase = 'act';
    showGains(got, 0);
    const N = Camp.human();
    const mine = got[0]; const txt = Object.entries(mine).map(([k, v]) => `+${v}${RES[k].icon}`).join(' ');
    Camp.log(`You roll ${n}. ${n === 7 ? 'Seven — trouble!' : txt ? 'Your lands produce ' + txt + '.' : 'Your lands produce nothing.'}`, 0);
    const sp = Camp.spoil(N); if (sp) Camp.log(`Spoilage: your stockpiles are too large — ${sp.lose} ${RES[sp.k].name} rots in the warehouses. (Keep 20 or fewer.)`, 0, 'bad');
    if (!N.research && Camp.availableTechs(N).length) Camp.log('Choose something to research (Research button).', 0, 'note');
    refresh(); Camp.save();
    if (n === 7) { const E = Camp.makeEvent(); if (E) await eventDialog(E); }
    if (first) setTimeout(() => introDialog(), 300);
  }

  async function endTurn() {
    if (busy || G.over) return;
    busy = true; $('cEnd').disabled = true;
    selUnits = new Set();
    for (let i = 1; i < G.nations.length; i++) {
      const N = Camp.nation(i);
      if (!N.alive) continue;
      G.cur = i;
      Camp.turnStart(i);
      const { n, got } = Camp.rollDice();
      const mine = got[0]; const txt = Object.entries(mine).map(([k, v]) => `+${v}${RES[k].icon}`).join(' ');
      if (n === 7) Camp.aiSeven(i);
      else if (txt) { Camp.log(`${N.name} rolls ${n}: you collect ${txt}.`, 0); showGains(got, i); }
      refresh();
      await new Promise(r => setTimeout(r, 300 * SETTINGS.speed));
      await Camp.aiTurn(i, { focus: h => { focusHex = h; focusUntil = performance.now() + 900 * SETTINGS.speed; }, redraw: refresh, defend, offerPeace });
      Camp.checkVictory();
      if (G.over) break;
    }
    G.cur = 0; G.turn++;
    Camp.checkVictory();
    busy = false; $('cEnd').disabled = false;
    if (G.over) { refresh(); endGame(); return; }
    beginPlayerTurn(false);
  }

  // ---------- battles
  function attackDialog(bt) {
    const A = Camp.human(), D = Camp.nation(bt.def);
    const docs = Camp.doctrinesUnlocked(A);
    let doc = docs.includes(A.doctrine) ? A.doctrine : 'none';
    const est = () => Math.round(Battle.estimate(() => Camp.battleCfg(bt, { attDoctrine: doc }), 30) * 100);
    const render = () => {
      const p = est();
      modal(`<h2>Attack ${Camp.hexName(bt.to)}</h2>
        <div class="tip">${TERRAIN[bt.to.terr].name}${bt.to.fort ? ' · fortified' : ''}${bt.to.b === 'city' ? ' · city walls' : ''} — the defender wins if they still hold after 8 rounds.</div>
        <table class="cas"><tr><th>${A.name} (you)</th><th>${D.name}</th></tr>
        <tr><td>${bt.units.map(u => U[u.t].name + (u.str < 95 ? ` (${u.str}%)` : '')).join('<br>')}</td><td>${bt.to.army.map(u => U[u.t].name + (u.str < 95 ? ` (${u.str}%)` : '')).join('<br>')}</td></tr></table>
        <div class="row">Doctrine: <select id="adoc">${docs.map(d => `<option value="${d}" ${d === doc ? 'selected' : ''}>${DOCTRINES[d].name}</option>`).join('')}</select><span class="tip" id="adocd">${DOCTRINES[doc].desc}</span></div>
        <div class="plan">Estimated chance of victory: <b class="${p >= 60 ? 'good' : p < 40 ? 'bad' : ''}">${p}%</b> <span class="tip">(simulated with both sides on autopilot — your own command may do better or worse)</span></div>
        <div class="acts"><button id="aCancel">Call off</button><button id="aAuto">Auto-resolve</button><button class="primary" id="aCmd">Command the battle ⚔</button></div>`);
      $('adoc').onchange = e => { doc = e.target.value; render(); };
      $('aCancel').onclick = () => { closeModal(); refresh(); };
      $('aAuto').onclick = () => { closeModal(); const B = Battle.autoResolve(Battle.create(Camp.battleCfg(bt, { attDoctrine: doc }))); afterBattle(bt, B, 0); };
      $('aCmd').onclick = () => { closeModal(); fight(bt, 0, doc); };
    };
    render();
  }

  function fight(bt, side, doc) {
    const cfg = Camp.battleCfg(bt, side === 0 ? { attDoctrine: doc } : { defDoctrine: doc });
    return new Promise(res => {
      BattleUI.start(cfg, { playerSide: side, campaign: true, title: cfg.name, onEnd: (B, sum, stop) => { stop(); showScreen('camp'); afterBattle(bt, B, side).then(res); } });
    });
  }

  function afterBattle(bt, B, side) {
    const r = Camp.applyBattle(bt, B);
    const won = (B.winner === side);
    if (won && side === 0 && bt.to.owner === 0) selHex = bt.to;
    refresh(); Camp.save();
    return new Promise(res => {
      modal(`<h2>${won ? 'Victory' : 'Defeat'} at ${Camp.hexName(bt.to)}</h2>
        <div>${B.endReason}</div>
        <table class="cas"><tr><th></th><th>Units lost</th></tr><tr><td>${Camp.nation(bt.att).name}</td><td>${r.killedA}</td></tr><tr><td>${Camp.nation(bt.def).name}</td><td>${r.killedD}</td></tr></table>
        ${won && side === 0 ? '<div class="tip">Your army occupies the hex. Survivors may have gained experience (★).</div>' : ''}
        <div class="acts"><button class="primary" id="abOk">Continue</button></div>`);
      $('abOk').onclick = () => { closeModal(); Camp.checkVictory(); if (G.over) endGame(); res(); };
    });
  }

  function defend(bt) {
    const D = Camp.human(), A = Camp.nation(bt.att);
    focusHex = bt.to; focusUntil = performance.now() + 4000;
    const docs = Camp.doctrinesUnlocked(D);
    let doc = docs.includes(D.doctrine) ? D.doctrine : 'none';
    return new Promise(res => {
      const p = Math.round((1 - Battle.estimate(() => Camp.battleCfg(bt, { defDoctrine: doc }), 30)) * 100);
      modal(`<h2>${A.name} attacks ${Camp.hexName(bt.to)}!</h2>
        <table class="cas"><tr><th>${A.name}</th><th>${D.name} (you)</th></tr>
        <tr><td>${bt.units.map(u => U[u.t].name).join('<br>')}</td><td>${bt.to.army.map(u => U[u.t].name + (u.str < 95 ? ` (${u.str}%)` : '')).join('<br>')}</td></tr></table>
        <div class="row">Doctrine: <select id="ddoc">${docs.map(d => `<option value="${d}" ${d === doc ? 'selected' : ''}>${DOCTRINES[d].name}</option>`).join('')}</select></div>
        <div class="plan">Estimated chance to hold: <b class="${p >= 60 ? 'good' : p < 40 ? 'bad' : ''}">${p}%</b></div>
        <div class="acts"><button id="dAuto">Auto-resolve</button><button class="primary" id="dCmd">Command the defense ⚔</button></div>`);
      $('ddoc').onchange = e => { doc = e.target.value; };
      $('dAuto').onclick = () => { closeModal(); const B = Battle.autoResolve(Battle.create(Camp.battleCfg(bt, { defDoctrine: doc }))); afterBattle(bt, B, 1).then(res); };
      $('dCmd').onclick = () => { closeModal(); fight(bt, 1, doc).then(res); };
    });
  }

  function offerPeace(i) {
    const N = Camp.nation(i);
    return new Promise(res => {
      modal(`<h2>${N.name} sues for peace</h2><div>Their envoys offer a treaty for 12 turns, and ${N.res.G >= 2 ? '2 Gold as tribute' : 'their goodwill'}.</div>
        <div class="acts"><button id="pNo">Refuse — the war goes on</button><button class="primary" id="pYes">Accept</button></div>`);
      $('pYes').onclick = () => { closeModal(); Camp.setPeace(0, i, 12); if (N.res.G >= 2) { N.res.G -= 2; Camp.human().res.G += 2; } refresh(); res(); };
      $('pNo').onclick = () => { closeModal(); res(); };
    });
  }

  // ---------- dialogs
  function eventDialog(E) {
    const N = Camp.human();
    return new Promise(res => {
      modal(`<h2>🎲 ${E.title}</h2><p>${E.text}</p><div class="acts" style="justify-content:flex-start;flex-direction:column;align-items:stretch">${E.choices.map((c, k) => `<button data-ch="${k}" ${c.cost && !Camp.canPay(N, c.cost) ? 'disabled' : ''} style="text-align:left">${c.label}${c.cost ? ` <span class="cost">(${Camp.costTxt(c.cost)})</span>` : ''}</button>`).join('')}</div>`);
      document.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
        const err = Camp.resolveEvent(E, +b.dataset.ch); if (err) { toast(err); return; }
        const c = E.choices[+b.dataset.ch];
        modal(`<h2>${E.title}</h2><p>${c.out}</p><div class="acts"><button class="primary" id="evOk">Continue</button></div>`);
        $('evOk').onclick = () => { closeModal(); refresh(); Camp.save(); res(); };
      });
    });
  }

  function techDialog() {
    const N = Camp.human();
    const render = () => {
      let x = `<h2>Research</h2><div class="tip">Science comes from cities (+1, capital +2) and academies (+2) each turn. Bigger empires pay more per tech. Research 3 techs in your era to advance to the next. You have <b>${N.sci}</b> 🔬 (+${Camp.scienceOf(0)}/turn).</div>
      <div class="tree" style="margin-top:10px"><div></div>${[1, 2, 3, 4, 5].map(e => `<div class="h">${ERAS[e].name}<div class="tip">${e < N.era ? 'complete' : e === N.era ? 'current' : 'locked'}</div></div>`).join('')}`;
      for (let row = 0; row < 5; row++) {
        x += `<div class="h" style="text-align:left"></div>`;
        for (let e = 1; e <= 5; e++) {
          const t = TECHS.filter(q => q.era === e)[row];
          if (!t) { x += '<div></div>'; continue; }
          const done = N.techs.includes(t.id), avail = !done && e <= N.era;
          x += `<div class="t ${done ? 'done' : avail ? 'avail' : 'locked'}" ${avail ? `data-t="${t.id}"` : ''} ${N.research === t.id ? 'style="outline:3px solid #a8461f"' : ''}><b>${t.name}</b> <span class="muted">${Camp.techCost(N, t)}🔬</span><div class="u">${t.units.map(u => U[u].name).join(', ')}${t.doctrines.length ? '<br>Doctrine: ' + t.doctrines.map(d => DOCTRINES[d].name).join(', ') : ''}${t.oil ? '<br>Deserts yield Oil' : ''}</div></div>`;
        }
      }
      x += `</div><div class="acts"><button class="primary" onclick="closeModal()">Close</button></div>`;
      modal(x, true);
      document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { Camp.setResearch(N, b.dataset.t); refresh(); Camp.save(); render(); });
    };
    render();
  }

  function tradeDialog() {
    const N = Camp.human();
    let give = 'F', get = 'I', partner = null;
    const ks = RES_KEYS.filter(k => k !== 'O' || N.techs.includes('combustion'));
    const render = () => {
      const r = Camp.tradeRate(N, give);
      const rivals = Camp.G.nations.filter(n => n.alive && !n.human);
      modal(`<h2>Trade</h2>
        <div class="row">Give <select id="tg">${ks.map(k => `<option value="${k}" ${k === give ? 'selected' : ''}>${RES[k].icon} ${RES[k].name} (${N.res[k]})</option>`).join('')}</select>
        Get <select id="tt">${ks.map(k => `<option value="${k}" ${k === get ? 'selected' : ''}>${RES[k].icon} ${RES[k].name}</option>`).join('')}</select></div>
        <div class="sec" style="margin-top:12px"><b>Bank</b> — ${r} ${RES[give].name} for 1 ${RES[get].name}. <span class="tip">(Markets improve the rate.)</span>
          <div class="btnrow"><button id="tBank" ${N.res[give] >= r && give !== get ? '' : 'disabled'}>Trade ${r}:1</button></div></div>
        <div class="sec" style="margin-top:10px"><b>Rival nations</b> — offer 2 ${RES[give].name} for 1 ${RES[get].name}, or 1 for 1.
          <div class="btnrow">${rivals.map(n => `<button class="small" data-p="${n.i}" data-n="2" ${N.res[give] >= 2 && give !== get ? '' : 'disabled'}>${n.name} 2:1</button><button class="small" data-p="${n.i}" data-n="1" ${N.res[give] >= 1 && give !== get ? '' : 'disabled'}>1:1</button>`).join('')}</div>
          <div class="tip" id="tMsg"></div></div>
        <div class="acts"><button class="primary" onclick="closeModal()">Done</button></div>`);
      $('tg').onchange = e => { give = e.target.value; render(); };
      $('tt').onchange = e => { get = e.target.value; render(); };
      $('tBank').onclick = () => { const e = Camp.bankTrade(N, give, get); if (e) toast(e); refresh(); Camp.save(); render(); };
      document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
        const A = Camp.nation(+b.dataset.p), n = +b.dataset.n;
        if (Camp.aiAcceptsTrade(A, give, n, get, 1)) { N.res[give] -= n; A.res[give] += n; A.res[get] -= 1; N.res[get] += 1; refresh(); Camp.save(); render(); $('tMsg').innerHTML = `<span class="good">${A.name} accepts.</span>`; }
        else $('tMsg').innerHTML = `<span class="bad">${A.name} declines${A.res[get] < 2 ? ` — they have little ${RES[get].name} to spare` : ''}.</span>`;
      });
    };
    render();
  }

  function nationsDialog() {
    const render = () => {
      const list = Camp.G.nations;
      modal(`<h2>Nations</h2><table class="cas"><tr><th>Nation</th><th>Era</th><th>Hexes</th><th>Cities</th><th>Army</th><th>Score</th><th>Relations</th></tr>
        ${list.map(n => `<tr style="${n.alive ? '' : 'opacity:.4'}"><td><b style="color:${n.color};text-shadow:0 0 2px #000">■</b> ${n.name}${n.human ? ' (you)' : ''}<div class="tip">${DOCTRINES[n.doctrine].name}${n.personality ? ' · ' + n.personality : ''}</div></td><td>${ERAS[n.era].name}</td><td>${Camp.owned(n.i).length}</td><td>${Camp.cities(n.i).length}</td><td>${Camp.armyCount(n.i)} <span class="tip">(${Math.round(Camp.strength(n.i))})</span></td><td>${Camp.score(n.i)}</td>
        <td>${n.human || !n.alive ? '' : Camp.atWar(0, n.i) ? `<span class="bad">War</span> <button class="small" data-peace="${n.i}">Offer peace</button>` : `<span class="good">Peace</span> until turn ${n.rel[0].until}`}</td></tr>`).join('')}</table>
        <div class="tip" style="margin-top:6px">${NATIONS.find(n => n.id === Camp.human().id).perk}</div>
        <div class="tip" id="nMsg"></div>
        <div class="acts"><button class="primary" onclick="closeModal()">Close</button></div>`);
      document.querySelectorAll('[data-peace]').forEach(b => b.onclick = () => { const ok = Camp.proposePeace(0, +b.dataset.peace); render(); $('nMsg').innerHTML = ok ? '<span class="good">They accept a 12-turn treaty.</span>' : '<span class="bad">They refuse. They think they can win.</span>'; Camp.save(); refresh(); });
    };
    render();
  }

  function menuDialog() {
    modal(`<h2>Campaign</h2><div class="tip">The game saves automatically after every action.</div>
      <div class="row"><label>Animation speed <select id="cmSpeed">${[['2', 'Slow'], ['1', 'Normal'], ['0.5', 'Fast'], ['0.15', 'Instant']].map(([v, l]) => `<option value="${v}" ${+v === SETTINGS.speed ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="acts"><button id="cmQuit">Save & return to menu</button><button class="primary" onclick="closeModal()">Resume</button></div>`);
    $('cmSpeed').onchange = e => { SETTINGS.speed = +e.target.value; try { localStorage.setItem('ib_speed', e.target.value); } catch (er) { /* ignore */ } };
    $('cmQuit').onclick = () => { Camp.save(); closeModal(); cancelAnimationFrame(raf); showScreen('title'); updateTitle(); };
  }

  function introDialog() {
    const N = Camp.human(); const nat = NATIONS.find(n => n.id === N.id);
    modal(`<h2>${N.name} rises</h2>
      <p>You begin with one city, three hexes and a small army. Each turn, two dice are rolled: every hex whose number comes up produces its resource for whoever owns it — <b>if</b> it has a settlement or city on or next to it.</p>
      <ul>
        <li><b>Expand</b>: march armies into unclaimed hexes to claim them; build <b>settlements</b> so they produce, and upgrade to <b>cities</b> to double output and recruit.</li>
        <li><b>Research</b> three techs per era to advance from the Ancient world to the age of tanks and dive bombers.</li>
        <li><b>Conquer</b>: attack rival hexes. Command the battle yourself or auto-resolve. Take every rival capital to win.</li>
        <li>A roll of <b>7</b> brings an event for you to decide; rivals who roll it send raiders against the leader.</li>
      </ul>
      <div class="plan"><b>${nat.name}</b>: ${nat.perk}<br>Signature doctrine: <b>${DOCTRINES[nat.doctrine].name}</b> — ${DOCTRINES[nat.doctrine].desc}</div>
      <div class="acts"><button class="primary" id="introOk">To war</button></div>`);
    $('introOk').onclick = () => { closeModal(); techDialog(); };
  }

  function endGame() {
    const won = G.winner === 0;
    modal(`<h2>${won ? 'Triumph' : 'The End of an Age'}</h2><p>${G.endText}</p>
      <table class="cas"><tr><th>Nation</th><th>Score</th><th>Battles won</th></tr>${G.nations.map(n => `<tr><td>${n.name}</td><td>${Camp.score(n.i)}</td><td>${n.won}</td></tr>`).join('')}</table>
      <div class="acts"><button class="primary" id="egOk">Main menu</button></div>`);
    $('egOk').onclick = () => { closeModal(); Camp.clearSave(); cancelAnimationFrame(raf); showScreen('title'); updateTitle(); };
  }

  return { start, refresh, get sel() { return selHex; }, select: h => { selHex = h; selUnits = new Set(h.owner === 0 ? h.army.filter(u => !u.moved).map(u => u.id) : []); refresh(); }, doMove, endTurn, get busy() { return busy; } };
})();
