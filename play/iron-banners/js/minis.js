// Iron Banners — miniature figures: units drawn as little painted soldiers on a base instead of flat counters.
'use strict';

const Minis = (() => {
  const SKIN = '#e0b089', OUT = 'rgba(18,10,4,.8)', WOOD = '#6b4a2a', STEEL = '#c9ccd1', DARK = '#2a221a';
  let ctx, f = 1; // f = facing: 1 looks right, -1 looks left

  const line = (x1, y1, x2, y2, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const disc = (x, y, r, fill, stroke = OUT, lw = 1) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  const ell = (x, y, rx, ry, fill, stroke = OUT, lw = 1, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  const polyF = (pts, fill, stroke = OUT, lw = 1) => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };

  function headgear(x, hy, r, era, col, t) {
    if (era <= 1) { // bronze helmet with a crest
      ctx.beginPath(); ctx.arc(x, hy, r * 1.08, Math.PI, 0); ctx.fillStyle = '#b8862e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
      if (t !== 'slinger' && t !== 'archer' && t !== 'indianbow') line(x - r, hy - r * 1.15, x + r, hy - r * 1.15, r * 0.55, '#a3261d');
    } else if (era === 2) { // conical steel helm
      polyF([[x - r * 1.1, hy], [x, hy - r * 1.9], [x + r * 1.1, hy]], '#8d939b', OUT, 0.8);
    } else if (era === 3) { // shako with plume
      ctx.fillStyle = DARK; ctx.fillRect(x - r * 0.95, hy - r * 2.0, r * 1.9, r * 1.55); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.strokeRect(x - r * 0.95, hy - r * 2.0, r * 1.9, r * 1.55);
      line(x, hy - r * 2.0, x, hy - r * 2.6, r * 0.45, '#d33');
    } else if (era === 4) { // kepi / peaked cap
      ctx.fillStyle = Draw.shade(col, -0.35); ctx.fillRect(x - r * 0.9, hy - r * 1.55, r * 1.8, r * 0.95); line(x, hy - r * 0.55, x + f * r * 1.4, hy - r * 0.5, r * 0.35, DARK);
    } else { // steel helmet
      ctx.beginPath(); ctx.ellipse(x, hy - r * 0.2, r * 1.3, r * 1.05, 0, Math.PI, 0); ctx.fillStyle = '#4b5638'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }

  // one foot soldier, feet at (x, foot), height H
  function soldier(x, foot, H, col, era, arms, t, mounted = false) {
    const hip = foot - H * 0.42, sh = foot - H * 0.76, hr = H * 0.1, hy = foot - H * 0.87;
    const coat = col, trousers = era >= 3 ? (era === 3 ? '#e9e3d4' : Draw.shade(col, -0.4)) : '#5a3d24';
    if (!mounted) {
      if (arms === 'kneel') { line(x, hip, x + f * H * 0.16, hip + H * 0.02, H * 0.1, trousers); line(x + f * H * 0.16, hip + H * 0.02, x + f * H * 0.18, foot, H * 0.09, trousers); line(x, hip, x - f * H * 0.12, foot, H * 0.09, trousers); }
      else { line(x, hip, x - H * 0.07, foot, H * 0.09, trousers); line(x, hip, x + H * 0.07, foot, H * 0.09, trousers); }
      if (era >= 3) { line(x - H * 0.07, foot - 0.5, x - H * 0.07 + f * H * 0.05, foot - 0.5, H * 0.07, DARK); line(x + H * 0.07, foot - 0.5, x + H * 0.07 + f * H * 0.05, foot - 0.5, H * 0.07, DARK); }
    }
    // weapon behind the body
    if (arms === 'pike') line(x - f * H * 0.25, foot - H * 0.25, x + f * H * 0.9, foot - H * 1.2, Math.max(1, H * 0.035), WOOD);
    if (arms === 'spear' || arms === 'spearshield') { line(x + f * H * 0.18, foot - H * 0.15, x + f * H * 0.22, foot - H * 1.2, Math.max(1, H * 0.035), WOOD); polyF([[x + f * H * 0.2, foot - H * 1.32], [x + f * H * 0.17, foot - H * 1.18], [x + f * H * 0.26, foot - H * 1.18]], STEEL, null); }
    if (arms === 'musket') { line(x + f * H * 0.02, foot - H * 0.32, x + f * H * 0.2, foot - H * 1.05, Math.max(1.2, H * 0.045), WOOD); line(x + f * H * 0.2, foot - H * 1.05, x + f * H * 0.23, foot - H * 1.22, Math.max(0.8, H * 0.02), STEEL); }
    // torso and head
    Draw.rr(ctx, x - H * 0.13, sh - H * 0.02, H * 0.26, hip - sh + H * 0.06, H * 0.05); ctx.fillStyle = coat; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.9; ctx.stroke();
    if (era === 3) line(x - H * 0.1, sh + H * 0.06, x + H * 0.1, hip - H * 0.04, H * 0.04, '#f1ead8'); // crossbelt
    disc(x, hy, hr, SKIN, OUT, 0.8);
    headgear(x, hy, hr, era, col, t);
    // arms and front weapons
    const handF = [x + f * H * 0.2, sh + H * 0.16];
    if (arms === 'sword' || arms === 'swordshield' || arms === 'spearshield') {
      const shieldCol = Draw.shade(col, 0.3);
      if (era <= 1 && t !== 'legion') disc(x + f * H * 0.12, sh + H * 0.17, H * 0.19, shieldCol, OUT, 1);
      else { Draw.rr(ctx, x + f * H * 0.02 - (f < 0 ? H * 0.22 : 0), sh - H * 0.02, H * 0.22, H * 0.4, H * 0.05); ctx.fillStyle = shieldCol; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); }
      if (arms !== 'spearshield') { line(x - f * H * 0.05, sh + H * 0.08, x - f * H * 0.18, sh - H * 0.12, H * 0.06, coat); line(x - f * H * 0.18, sh - H * 0.12, x - f * H * 0.1, sh - H * 0.42, Math.max(1, H * 0.04), STEEL); }
    } else if (arms === 'bow') {
      line(x, sh + H * 0.06, handF[0] + f * H * 0.06, sh + H * 0.1, H * 0.06, coat);
      ctx.strokeStyle = WOOD; ctx.lineWidth = Math.max(1, H * 0.04); ctx.beginPath(); ctx.arc(x + f * H * 0.08, sh + H * 0.1, H * 0.26, f > 0 ? -1.2 : Math.PI - 1.2, f > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
      const bx = x + f * H * 0.08 + Math.cos(1.2) * H * 0.26 * f; line(bx, sh + H * 0.1 - Math.sin(1.2) * H * 0.26, bx, sh + H * 0.1 + Math.sin(1.2) * H * 0.26, 0.6, '#eee');
    } else if (arms === 'aim' || arms === 'kneel') {
      const ay = sh + H * 0.06; line(x - f * H * 0.08, ay + H * 0.03, x + f * H * 0.55, ay - H * 0.02, Math.max(1.2, H * 0.045), WOOD);
      line(x, ay + H * 0.04, x + f * H * 0.22, ay + H * 0.02, H * 0.06, coat);
    } else if (arms === 'pike' || arms === 'musket' || arms === 'spear') {
      line(x, sh + H * 0.06, x + f * H * 0.12, sh + H * 0.2, H * 0.06, coat);
    } else if (arms === 'lance') {
      line(x - f * H * 0.3, sh + H * 0.25, x + f * H * 1.0, sh - H * 0.25, Math.max(1, H * 0.04), WOOD);
      if (era <= 2) polyF([[x + f * H * 0.55, sh - H * 0.08], [x + f * H * 0.8, sh - H * 0.18], [x + f * H * 0.6, sh - H * 0.2]], Draw.shade(col, 0.35), null);
    } else if (arms === 'saber') {
      line(x, sh + H * 0.06, x + f * H * 0.18, sh - H * 0.08, H * 0.06, coat); line(x + f * H * 0.18, sh - H * 0.08, x + f * H * 0.32, sh - H * 0.45, Math.max(1, H * 0.04), STEEL);
    }
  }

  function horse(x, foot, H, col, heavy, era) {
    const body = heavy ? '#4a3322' : '#8a5e38', by = foot - H * 0.42;
    const legW = Math.max(1.2, H * 0.06);
    for (const dx of [-0.24, -0.16, 0.16, 0.24]) line(x + f * dx * H, by + H * 0.05, x + f * (dx + (dx > 0 ? 0.04 : -0.03)) * H, foot, legW, Draw.shade(body, -0.25));
    line(x - f * H * 0.32, by - H * 0.04, x - f * H * 0.42, by + H * 0.16, H * 0.06, '#2b1d12'); // tail
    ell(x, by, H * 0.34, H * 0.15, (heavy && era === 2) ? col : body, OUT, 1);
    if (heavy && era === 2) ell(x, by + H * 0.08, H * 0.32, H * 0.08, Draw.shade(col, -0.2), null); // caparison
    polyF([[x + f * H * 0.2, by - H * 0.06], [x + f * H * 0.3, by - H * 0.3], [x + f * H * 0.38, by - H * 0.3], [x + f * H * 0.34, by + H * 0.02]], body, OUT, 1);
    ell(x + f * H * 0.42, by - H * 0.27, H * 0.1, H * 0.055, body, OUT, 1, f * 0.5);
  }

  function elephant(x, foot, H, col) {
    const g = '#8b8680', by = foot - H * 0.5;
    for (const dx of [-0.26, -0.12, 0.12, 0.26]) line(x + f * dx * H, by, x + f * dx * H, foot, H * 0.13, Draw.shade(g, -0.15));
    ell(x, by, H * 0.42, H * 0.26, g, OUT, 1);
    disc(x + f * H * 0.38, by - H * 0.12, H * 0.17, g, OUT, 1);
    ctx.strokeStyle = g; ctx.lineWidth = H * 0.08; ctx.beginPath(); ctx.moveTo(x + f * H * 0.5, by - H * 0.05); ctx.quadraticCurveTo(x + f * H * 0.62, by + H * 0.25, x + f * H * 0.55, foot - H * 0.05); ctx.stroke();
    line(x + f * H * 0.46, by + H * 0.02, x + f * H * 0.62, by + H * 0.06, H * 0.035, '#f4efe2');
    ctx.fillStyle = col; ctx.fillRect(x - H * 0.18, by - H * 0.42, H * 0.3, H * 0.18); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(x - H * 0.18, by - H * 0.42, H * 0.3, H * 0.18);
    disc(x - H * 0.03, by - H * 0.5, H * 0.06, SKIN, OUT, 0.7);
  }

  function gun(x, foot, H, col, era) {
    if (era <= 2) { // catapult / trebuchet
      polyF([[x - H * 0.35, foot], [x, foot - H * 0.75], [x + H * 0.35, foot]], 'rgba(0,0,0,0)', WOOD, Math.max(1.5, H * 0.06));
      line(x - f * H * 0.45, foot - H * 0.35, x + f * H * 0.35, foot - H * 0.95, Math.max(1.5, H * 0.05), WOOD);
      disc(x + f * H * 0.38, foot - H * 0.98, H * 0.07, '#7a7064');
      Draw.rr(ctx, x - f * H * 0.55 - H * 0.1, foot - H * 0.38, H * 0.2, H * 0.2, 2); ctx.fillStyle = '#5e5248'; ctx.fill();
      line(x - H * 0.42, foot - 1, x + H * 0.42, foot - 1, Math.max(2, H * 0.07), WOOD);
      return;
    }
    const barrel = era === 3 ? '#9a7430' : era === 4 ? '#3a3a3a' : '#4b5638';
    const len = era === 5 ? 0.85 : 0.65;
    line(x - f * H * 0.35, foot - H * 0.05, x, foot - H * 0.25, Math.max(2, H * 0.08), era === 5 ? '#4b5638' : WOOD); // trail
    ctx.save(); ctx.translate(x, foot - H * 0.32); ctx.rotate(-f * 0.18);
    ctx.fillStyle = barrel; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    Draw.rr(ctx, f > 0 ? -H * 0.15 : -H * len, -H * 0.07, H * (len + 0.15), H * 0.14, H * 0.05); ctx.fill(); ctx.stroke();
    ctx.restore();
    disc(x, foot - H * 0.17, H * 0.17, 'rgba(0,0,0,0)', WOOD, Math.max(1.5, H * 0.05));
    line(x - H * 0.17, foot - H * 0.17, x + H * 0.17, foot - H * 0.17, 1, WOOD); line(x, foot - H * 0.34, x, foot, 1, WOOD);
    if (era === 5) { polyF([[x + f * H * 0.05, foot - H * 0.5], [x + f * H * 0.12, foot - H * 0.5], [x + f * H * 0.12, foot - H * 0.15], [x + f * H * 0.05, foot - H * 0.15]], '#4b5638'); }
  }

  function tank(x, foot, H, col, era, ww1) {
    const hull = Draw.shade(col, -0.15);
    if (ww1) { // rhomboid Mark IV
      polyF([[x - H * 0.6, foot - H * 0.25], [x - H * 0.35, foot - H * 0.62], [x + H * 0.35, foot - H * 0.62], [x + H * 0.6, foot - H * 0.25], [x + H * 0.4, foot], [x - H * 0.4, foot]], hull, OUT, 1.2);
      Draw.rr(ctx, x - H * 0.12, foot - H * 0.55, H * 0.24, H * 0.2, 2); ctx.fillStyle = Draw.shade(col, -0.35); ctx.fill();
      line(x + f * H * 0.1, foot - H * 0.45, x + f * H * 0.45, foot - H * 0.45, H * 0.05, DARK);
      return;
    }
    Draw.rr(ctx, x - H * 0.55, foot - H * 0.24, H * 1.1, H * 0.24, H * 0.12); ctx.fillStyle = DARK; ctx.fill();
    for (let k = -2; k <= 2; k++) disc(x + k * H * 0.2, foot - H * 0.12, H * 0.07, '#555', null);
    polyF([[x - H * 0.5, foot - H * 0.24], [x - H * 0.45, foot - H * 0.44], [x + H * 0.45, foot - H * 0.44], [x + H * 0.55, foot - H * 0.24]], hull, OUT, 1);
    Draw.rr(ctx, x - H * 0.22 - f * H * 0.04, foot - H * 0.64, H * 0.42, H * 0.22, H * 0.06); ctx.fillStyle = Draw.shade(col, 0.05); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
    line(x + f * H * 0.15, foot - H * 0.53, x + f * H * 0.8, foot - H * 0.56, Math.max(1.5, H * 0.055), DARK);
  }

  function atgun(x, foot, H, col) {
    polyF([[x - f * H * 0.05, foot - H * 0.2], [x - f * H * 0.05, foot - H * 0.55], [x + f * H * 0.08, foot - H * 0.6], [x + f * H * 0.08, foot - H * 0.2]], '#4b5638');
    line(x, foot - H * 0.38, x + f * H * 0.85, foot - H * 0.42, Math.max(1.4, H * 0.045), DARK);
    disc(x, foot - H * 0.13, H * 0.13, '#333', OUT, 1);
    line(x - f * H * 0.1, foot - H * 0.1, x - f * H * 0.55, foot - 1, H * 0.05, '#4b5638');
  }

  function plane(x, foot, H, col) {
    ell(x, foot - 1, H * 0.45, H * 0.07, 'rgba(0,0,0,.25)', null); // shadow on the base
    const y = foot - H * 0.75;
    ell(x, y, H * 0.5, H * 0.09, Draw.shade(col, -0.05), OUT, 1);
    polyF([[x - f * H * 0.05, y], [x + f * H * 0.05, y - H * 0.08], [x + f * H * 0.12, y + H * 0.2], [x - f * H * 0.12, y + H * 0.2]], Draw.shade(col, 0.15));
    polyF([[x - f * H * 0.42, y], [x - f * H * 0.5, y - H * 0.18], [x - f * H * 0.38, y - H * 0.02]], Draw.shade(col, 0.1));
    line(x + f * H * 0.52, y - H * 0.14, x + f * H * 0.52, y + H * 0.14, 1.2, '#ddd');
    disc(x + f * H * 0.12, y - H * 0.06, H * 0.05, '#9cd0ff', null);
  }

  // which figure and weapon for a unit type
  function kit(t, d) {
    const era = d.era, c = d.cls;
    if (t === 'elephant') return { kind: 'elephant', n: 1 };
    if (c === 'air') return { kind: 'plane', n: 1 };
    if (c === 'armor') return { kind: 'tank', n: 1, ww1: era === 4 };
    if (c === 'at') return { kind: 'at', n: 1 };
    if (c === 'art') return { kind: 'gun', n: 1, crew: true };
    if (c === 'hcav') return { kind: 'horse', heavy: true, arms: (t === 'scythed') ? 'saber' : era <= 2 ? 'lance' : 'saber', n: 2 };
    if (c === 'lcav') return { kind: 'horse', heavy: false, arms: (t === 'horsearch' || t === 'mongolha' || t === 'scythian') ? 'bow' : era >= 4 ? 'musket' : (t === 'lancer') ? 'lance' : 'saber', n: 2 };
    if (c === 'pike') return { kind: 'foot', arms: (t === 'spartan' || t === 'fyrd') ? 'spearshield' : 'pike', n: 3 };
    if (c === 'missile') return { kind: 'foot', arms: era <= 2 ? (t === 'crossbow' ? 'aim' : 'bow') : 'kneel', n: 3 };
    // infantry
    if (era <= 2) return { kind: 'foot', arms: ['levy', 'immortal', 'immortals', 'indianinf', 'jininf'].includes(t) ? 'spearshield' : 'swordshield', n: 3 };
    if (t === 'mg') return { kind: 'foot', arms: 'kneel', n: 3 };
    return { kind: 'foot', arms: 'musket', n: 3 };
  }

  // draw the unit's miniatures inside the box (x, y, w, h); feet stand on a base at the bottom
  function draw(c, u, x, y, w, h, color, face) {
    ctx = c; f = face;
    const d = U[u.t], k = kit(u.t, d), str = u.str ?? 100;
    const baseY = y + h - 13, H = Math.max(10, (h - 13) * 1.02);
    const routed = u.status === 'routed';
    let n = k.n; if (k.kind === 'foot') n = str > 66 ? 3 : str > 33 ? 2 : 1; else if (k.kind === 'horse') n = str > 50 ? 2 : 1;
    const cx = x + w / 2;
    ctx.save();
    if (routed) { ctx.translate(cx, baseY); ctx.rotate(-f * 0.18); ctx.translate(-cx, -baseY); }
    if (k.kind === 'foot') {
      const span = w * 0.62, sc = H * 0.95;
      const order = n === 3 ? [[-1, -2.5, 0.9], [1, -2.5, 0.9], [0, 0, 1]] : n === 2 ? [[-0.6, 0, 1], [0.6, 0, 1]] : [[0, 0, 1]];
      for (const [dx, dy, s] of order) soldier(cx + dx * span / 2 - f * 2, baseY + dy, sc * s, color, d.era, k.arms, u.t);
    } else if (k.kind === 'horse') {
      const order = n === 2 ? [[-0.45, -2.5, 0.85], [0.35, 0, 1]] : [[0, 0, 1]];
      for (const [dx, dy, s] of order) {
        const hx = cx + f * dx * w * 0.42, hh = H * 0.98 * s;
        horse(hx, baseY + dy, hh, color, k.heavy, d.era);
        soldier(hx - f * hh * 0.04, baseY + dy - hh * 0.36, hh * 0.62, color, d.era, k.arms, u.t, true);
      }
    } else if (k.kind === 'elephant') elephant(cx, baseY, H * 1.05, color);
    else if (k.kind === 'gun') { gun(cx + f * w * 0.08, baseY, H * 0.9, color, d.era); if (str > 30) soldier(cx - f * w * 0.3, baseY, H * 0.72, color, d.era, 'none', u.t); }
    else if (k.kind === 'tank') tank(cx, baseY, H * 0.95, color, d.era, k.ww1);
    else if (k.kind === 'at') { atgun(cx + f * w * 0.05, baseY, H * 0.9, color); if (str > 30) soldier(cx - f * w * 0.3, baseY, H * 0.7, color, 5, 'none', u.t); }
    else if (k.kind === 'plane') plane(cx, baseY, H * 1.1, color);
    ctx.restore();
  }
  return { draw, kit };
})();
