// Iron Banners — shared canvas drawing: unit counters, symbols, helpers
'use strict';

const Draw = (() => {
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // NATO-ish symbol inside box (x,y,w,h)
  function symbol(ctx, c, x, y, w, h, ink) {
    ctx.save();
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1.2, w / 22);
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    const cx = x + w / 2, cy = y + h / 2;
    switch (c) {
      case 'inf': ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); break;
      case 'pike': ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, y - h * 0.35); ctx.lineTo(cx, y); ctx.moveTo(cx - 3, y - h * 0.2); ctx.lineTo(cx, y - h * 0.38); ctx.lineTo(cx + 3, y - h * 0.2); break;
      case 'missile': ctx.arc(cx - w * 0.35, cy, h * 0.45, -1.1, 1.1); ctx.moveTo(cx - w * 0.2, cy - h * 0.4); ctx.lineTo(cx - w * 0.2, cy + h * 0.4); ctx.moveTo(cx - w * 0.3, cy); ctx.lineTo(cx + w * 0.3, cy); break;
      case 'lcav': ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); break;
      case 'hcav': ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); ctx.moveTo(x + 4, y + h); ctx.lineTo(x + w, y + 4); break;
      case 'art': ctx.arc(cx, cy, Math.min(w, h) * 0.2, 0, 7); ctx.fill(); break;
      case 'armor': { const rw = w * 0.36, rh = h * 0.24; ctx.moveTo(cx - rw + rh, cy - rh); ctx.lineTo(cx + rw - rh, cy - rh); ctx.arc(cx + rw - rh, cy, rh, -Math.PI / 2, Math.PI / 2); ctx.lineTo(cx - rw + rh, cy + rh); ctx.arc(cx - rw + rh, cy, rh, Math.PI / 2, Math.PI * 1.5); break; }
      case 'at': ctx.moveTo(x, y + h); ctx.lineTo(cx, y + 2); ctx.lineTo(x + w, y + h); break;
      case 'air': ctx.moveTo(x + w * 0.15, cy - 2); ctx.quadraticCurveTo(x + w * 0.32, cy - h * 0.35, cx, cy); ctx.quadraticCurveTo(x + w * 0.68, cy - h * 0.35, x + w * 0.85, cy - 2); ctx.moveTo(x + w * 0.15, cy + 2); ctx.quadraticCurveTo(x + w * 0.32, cy + h * 0.35, cx, cy); ctx.quadraticCurveTo(x + w * 0.68, cy + h * 0.35, x + w * 0.85, cy + 2); break;
    }
    ctx.stroke();
    ctx.restore();
  }

  // counter: game piece for a unit
  function counter(ctx, x, y, w, h, u, color, o = {}) {
    if (h >= 26 && !o.flat && typeof Minis !== 'undefined') return miniature(ctx, x, y, w, h, u, color, o);
    const d = U[u.t];
    const dead = u.status && u.status !== 'ok';
    ctx.save();
    ctx.globalAlpha = dead ? 0.35 : 1;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x + 2, y + 3, w, h, 4); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(color, 0.18)); g.addColorStop(1, shade(color, -0.18));
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = o.sel ? '#ffd24a' : 'rgba(0,0,0,.55)'; ctx.lineWidth = o.sel ? 3 : 1; rr(ctx, x, y, w, h, 4); ctx.stroke();
    const ink = lum(color) > 0.6 ? '#1a140c' : '#fff5e0';
    // symbol box
    const sw = Math.min(w * 0.42, 26), sh = sw * 0.66;
    symbol(ctx, d.cls, x + 5, y + 5 + (d.cls === 'pike' ? 3 : 0), sw, sh, ink);
    // era pips
    ctx.fillStyle = ink; ctx.font = `600 ${Math.max(8, h * 0.2)}px Inter`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('IVX'.length && ['', 'I', 'II', 'III', 'IV', 'V'][d.era], x + w - 4, y + 3);
    if (u.exp) { ctx.fillStyle = '#ffd24a'; ctx.fillText('★'.repeat(Math.min(3, u.exp)), x + w - 4, y + 3 + h * 0.22); }
    // strength bar & morale bar
    const bw = w - 10, by = y + h - 11;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 5, by, bw, 3); ctx.fillRect(x + 5, by + 5, bw, 3);
    const s = Math.max(0, (u.str ?? 100) / 100), m = Math.max(0, Math.min(1, (u.mor ?? d.mor) / 100));
    ctx.fillStyle = s > 0.5 ? '#6fd36a' : s > 0.25 ? '#e8c64a' : '#e8574a'; ctx.fillRect(x + 5, by, bw * s, 3);
    ctx.fillStyle = '#7fb8ff'; ctx.fillRect(x + 5, by + 5, bw * m, 3);
    if (u.disorder) { ctx.fillStyle = '#ffdf6a'; ctx.font = `700 ${h * 0.32}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x + w - 9, y + h * 0.55); }
    if (dead) { ctx.strokeStyle = '#2a0a06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke(); }
    ctx.restore();
    if (o.label) {
      ctx.save(); ctx.font = '600 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const t = fit(ctx, u.name, w + 14);
      ctx.fillStyle = 'rgba(20,12,4,.65)'; const tw = ctx.measureText(t).width; ctx.fillRect(x + w / 2 - tw / 2 - 3, y + h + 2, tw + 6, 13);
      ctx.fillStyle = '#f5e8c8'; ctx.fillText(t, x + w / 2, y + h + 3); ctx.restore();
    }
  }
  // the same unit as painted miniatures on a base in the side's colour
  function miniature(ctx, x, y, w, h, u, color, o) {
    const d = U[u.t];
    const gone = u.status === 'destroyed', routed = u.status === 'routed';
    const face = o.face ?? (u.side === 1 ? -1 : 1);
    const bx = x + w / 2, by = y + h - 13, rx = w * 0.5, ry = Math.max(4, h * 0.11);
    ctx.save();
    ctx.globalAlpha = gone ? 0.3 : routed ? 0.6 : 1;
    // base
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(bx + 2, by + 3, rx, ry, 0, 0, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, by - ry, 0, by + ry); g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = o.sel ? '#ffd24a' : 'rgba(0,0,0,.6)'; ctx.lineWidth = o.sel ? 3 : 1; ctx.stroke();
    if (o.sel) { ctx.strokeStyle = 'rgba(255,210,74,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(bx, by, rx + 3, ry + 3, 0, 0, 7); ctx.stroke(); }
    if (!gone) Minis.draw(ctx, u, x, y, w, h, color, face);
    // veteran stars and disorder
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    if (u.exp) { ctx.font = `700 ${Math.max(8, h * 0.2)}px Inter`; ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; const s = '★'.repeat(Math.min(3, u.exp)); ctx.strokeText(s, x + w + 2, y - 2); ctx.fillText(s, x + w + 2, y - 2); }
    if (u.disorder) { ctx.fillStyle = '#ffdf6a'; ctx.beginPath(); ctx.arc(x + 6, y + 6, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#000'; ctx.font = '800 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x + 6, y + 6.5); }
    // strength & morale bars under the base
    const bw = w - 10, yb = y + h - 6;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x + 5, yb, bw, 3); ctx.fillRect(x + 5, yb + 4, bw, 3);
    const s = Math.max(0, (u.str ?? 100) / 100), m = Math.max(0, Math.min(1, (u.mor ?? d.mor) / 100));
    ctx.fillStyle = s > 0.5 ? '#6fd36a' : s > 0.25 ? '#e8c64a' : '#e8574a'; ctx.fillRect(x + 5, yb, bw * s, 3);
    ctx.fillStyle = '#7fb8ff'; ctx.fillRect(x + 5, yb + 4, bw * m, 3);
    if (gone) { ctx.strokeStyle = '#7a1a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + w - 6, y + h - 10); ctx.moveTo(x + w - 6, y + 4); ctx.lineTo(x + 6, y + h - 10); ctx.stroke(); }
    ctx.restore();
    if (o.label) {
      ctx.save(); ctx.font = '600 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const t = fit(ctx, u.name, w + 14);
      ctx.fillStyle = 'rgba(20,12,4,.65)'; const tw = ctx.measureText(t).width; ctx.fillRect(x + w / 2 - tw / 2 - 3, y + h + 2, tw + 6, 13);
      ctx.fillStyle = '#f5e8c8'; ctx.fillText(t, x + w / 2, y + h + 3); ctx.restore();
    }
  }
  function fit(ctx, t, w) { if (ctx.measureText(t).width <= w) return t; while (t.length > 3 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }

  function arrow(ctx, x1, y1, x2, y2, color, width = 6, curve = 0) {
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    const mx = (x1 + x2) / 2 + curve * (y2 - y1) * 0.3, my = (y1 + y2) / 2 - curve * (x2 - x1) * 0.3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - my, x2 - mx), L = width * 2.6;
    ctx.beginPath(); ctx.moveTo(x2 + Math.cos(a) * L * 0.6, y2 + Math.sin(a) * L * 0.6); ctx.lineTo(x2 + Math.cos(a + 2.5) * L, y2 + Math.sin(a + 2.5) * L); ctx.lineTo(x2 + Math.cos(a - 2.5) * L, y2 + Math.sin(a - 2.5) * L); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // seeded rng for stable textures
  function srng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return { shade, lum, rr, symbol, counter, arrow, srng, fit, DICE };
})();
