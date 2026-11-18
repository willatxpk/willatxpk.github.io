// ===== Rendering =====
const R = {
  canvas: null, ctx: null, cam: { x: 0, y: 0, z: 1.4 }, terrainDirty: true, territoryDirty: true,
  terrainCanvas: null, terrCanvas: null, dirtyTiles: [], selected: null, hover: null, floats: [], t: 0,
  flyTo(x, y) { this.camTarget = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; },
};
function floatText(x, y, text, color) { if (R.floats.length > 20) R.floats.shift(); R.floats.push({ x: x * TILE + 16, y: y * TILE, text, color, t: 0 }); }

function initRender() {
  R.canvas = document.getElementById('game');
  R.ctx = R.canvas.getContext('2d');
  R.terrainCanvas = document.createElement('canvas');
  R.terrainCanvas.width = MAP_W * TILE; R.terrainCanvas.height = MAP_H * TILE;
  R.terrCanvas = document.createElement('canvas');
  R.terrCanvas.width = MAP_W * TILE; R.terrCanvas.height = MAP_H * TILE;
  resize();
  window.addEventListener('resize', resize);
}
function resize() { R.canvas.width = window.innerWidth * devicePixelRatio; R.canvas.height = window.innerHeight * devicePixelRatio; R.canvas.style.width = window.innerWidth + 'px'; R.canvas.style.height = window.innerHeight + 'px'; }
function centerCam(x, y) { R.cam.x = x * TILE + TILE / 2; R.cam.y = y * TILE + TILE / 2; }
function screenToWorld(sx, sy) {
  const z = R.cam.z;
  return { x: (sx - window.innerWidth / 2) / z + R.cam.x, y: (sy - window.innerHeight / 2) / z + R.cam.y };
}
function screenToTile(sx, sy) { const w = screenToWorld(sx, sy); return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) }; }

function hashf(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function shade(hex, amt) {
  let c = parseInt(hex.slice(1), 16), r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  r = clamp(Math.round(r + amt), 0, 255); g = clamp(Math.round(g + amt), 0, 255); b = clamp(Math.round(b + amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawTerrainCache() {
  const c = R.terrainCanvas.getContext('2d'), s = 0;
  if (!R.tnoise || R.tnoiseSeed !== G.seed) { R.tnoise = makeNoise(G.seed + 5); R.tnoiseSeed = G.seed; }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) drawTerrainTile(c, x, y, s);
  R.terrainDirty = false; R.dirtyTiles = []; R.roadSnap = null; syncRoadLayer();
}
// redraw just the tiles that changed (terraforming) plus neighbours (shore foam depends on them)
function redrawDirtyTiles() {
  const c = R.terrainCanvas.getContext('2d'), s = 0, done = new Set();
  for (const i of R.dirtyTiles) { const x = i % MAP_W, y = (i / MAP_W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || done.has(idx(nx, ny))) continue; done.add(idx(nx, ny)); drawTerrainTile(c, nx, ny, s); } }
  R.dirtyTiles = [];
}
function drawTerrainTile(c, x, y, s) {
  {
    const t = G.tiles.terrain[idx(x, y)], px = x * TILE, py = y * TILE;
    const base = TERRAIN[t].c;
    c.save(); c.beginPath(); c.rect(px, py, TILE, TILE); c.clip();
    c.fillStyle = shade(base, (R.tnoise(x / 6, y / 6) - 0.5) * 22 + (hashf(x, y, 1) - 0.5) * 5);
    c.fillRect(px, py, TILE, TILE);
    // blend edges with lighter specks
    if (t === T.GRASS || t === T.MEADOW) {
      for (let k = 0; k < 5; k++) { c.fillStyle = shade(base, hashf(x, y, k + 3) > 0.5 ? 12 : -12); c.fillRect(px + hashf(x, y, k + 10) * 30, py + hashf(x, y, k + 20) * 30, 2, 3); }
      if (t === T.MEADOW) for (let k = 0; k < 3; k++) { c.fillStyle = ['#fff59d', '#f8bbd0', '#ffffff'][k]; c.fillRect(px + hashf(x, y, k + 40) * 28 + 2, py + hashf(x, y, k + 50) * 28 + 2, 2, 2); }
    }
    if (t === T.WATER || t === T.DEEP) {
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1;
      for (let k = 0; k < 2; k++) { const yy = py + 8 + k * 14 + hashf(x, y, k) * 4, xx = px + hashf(x, y, k + 5) * 14; c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + 4, yy - 3, xx + 8, yy); c.stroke(); }
      // shore foam
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && TERRAIN[G.tiles.terrain[idx(nx, ny)]].pass) { c.fillStyle = 'rgba(255,255,255,0.18)'; if (dx === 1) c.fillRect(px + TILE - 3, py, 3, TILE); if (dx === -1) c.fillRect(px, py, 3, TILE); if (dy === 1) c.fillRect(px, py + TILE - 3, TILE, 3); if (dy === -1) c.fillRect(px, py, TILE, 3); } }
    }
    if (t === T.SAND) for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(120,90,40,0.18)'; c.fillRect(px + hashf(x, y, k) * 30, py + hashf(x, y, k + 9) * 30, 1.5, 1.5); }
    if (t === T.HILLS) {
      for (let k = 0; k < 2; k++) {
        const hx = px + 6 + hashf(x, y, k) * 16, hy = py + 14 + k * 9;
        c.fillStyle = shade(base, -18); c.beginPath(); c.ellipse(hx + 1, hy + 1, 9, 5, 0, Math.PI, 0); c.fill();
        c.fillStyle = shade(base, 10); c.beginPath(); c.ellipse(hx, hy, 9, 5, 0, Math.PI, 0); c.fill();
      }
    }
    if (t === T.MOUNTAIN) {
      const mx = px + 16 + (hashf(x, y, 2) - 0.5) * 6;
      c.fillStyle = shade(base, -25); c.beginPath(); c.moveTo(px + 1, py + 30); c.lineTo(mx, py + 2); c.lineTo(px + 31, py + 30); c.fill();
      c.fillStyle = shade(base, 8); c.beginPath(); c.moveTo(px + 1, py + 30); c.lineTo(mx, py + 2); c.lineTo(mx + 3, py + 30); c.fill();
      c.fillStyle = '#f4f6f7'; c.beginPath(); c.moveTo(mx - 5, py + 11); c.lineTo(mx, py + 2); c.lineTo(mx + 5, py + 11); c.lineTo(mx + 1, py + 9); c.fill();
    }
    if (t === T.FOREST) {
      const n = 3;
      for (let k = 0; k < n; k++) {
        const tx = px + 6 + hashf(x, y, k + 60) * 20, ty = py + 8 + hashf(x, y, k + 70) * 18;
        c.fillStyle = '#5d4037'; c.fillRect(tx - 1, ty + 2, 2, 5);
        c.fillStyle = ['#2e6b2a', '#3a7d32', '#28602a'][k]; c.beginPath(); c.moveTo(tx - 7, ty + 3); c.lineTo(tx, ty - 9); c.lineTo(tx + 7, ty + 3); c.fill();
      }
    }
    const sp = G.tiles.special[idx(x, y)];
    if (sp === 5) { // river ford: shallow water with stepping stones
      c.fillStyle = 'rgba(61,127,177,0.6)'; c.fillRect(px, py, TILE, TILE);
      c.fillStyle = '#c9c2b2'; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(px + 5 + k * 5.5, py + 14 + (k % 2) * 4, 2.6, 1.9, 0, 0, 7); c.fill(); }
    }
    const rdv = G.tiles.road[idx(x, y)]; if (rdv) drawRoadTile(c, x, y, px, py, rdv);
    if (sp && VEINS[sp]) { const V = VEINS[sp]; c.fillStyle = V.col; for (let k = 0; k < 4; k++) { c.beginPath(); if (sp === 4) { const gx = px + 8 + hashf(x, y, k + 80) * 16, gy = py + 8 + hashf(x, y, k + 90) * 16; c.moveTo(gx, gy - 3); c.lineTo(gx + 2.2, gy); c.lineTo(gx, gy + 3); c.lineTo(gx - 2.2, gy); } else c.arc(px + 8 + hashf(x, y, k + 80) * 16, py + 8 + hashf(x, y, k + 90) * 16, sp === 3 ? 2.6 : 2, 0, 7); c.fill(); } c.strokeStyle = V.ring; c.lineWidth = 1; c.strokeRect(px + 3.5, py + 3.5, 25, 25); }
    c.restore();
  }
}

function drawTerritoryCache() {
  const c = R.terrCanvas.getContext('2d');
  c.clearRect(0, 0, R.terrCanvas.width, R.terrCanvas.height);
  const colorOf = o => o === 0 ? G.realm.color : (fac(o) || {}).color;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const o = G.tiles.owner[idx(x, y)]; if (o < 0) continue;
    const col = colorOf(o); const px = x * TILE, py = y * TILE;
    const bold = o === 0 && G.settings.boldBorder !== false;
    c.globalAlpha = o === 0 ? (bold ? 0.15 : 0.10) : 0.16; c.fillStyle = col; c.fillRect(px, py, TILE, TILE);
    const L = ownerAt(x - 1, y) !== o, Rt = ownerAt(x + 1, y) !== o, U = ownerAt(x, y - 1) !== o, D = ownerAt(x, y + 1) !== o;
    const edge = (bw, style, a) => {
      c.globalAlpha = a; c.fillStyle = style;
      if (L) c.fillRect(px, py, bw, TILE); if (Rt) c.fillRect(px + TILE - bw, py, bw, TILE);
      if (U) c.fillRect(px, py, TILE, bw); if (D) c.fillRect(px, py + TILE - bw, TILE, bw);
    };
    if (bold) { edge(6, '#111', 0.75); edge(4.5, col, 1); } // your border: thicker, with a dark line inside so it shows on any ground
    else edge(3, col, 0.9);
  }
  c.globalAlpha = 1;
  R.territoryDirty = false;
}

// ---------- Building art ----------
function house(c, px, py, w, h, wall, roof, opts = {}) {
  const x = px + (32 - w) / 2, y = py + 30 - h;
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 2, y + h - 2, w, 3);
  c.fillStyle = wall; c.fillRect(x, y + h * 0.42, w, h * 0.58);
  c.fillStyle = roof; c.beginPath(); c.moveTo(x - 2, y + h * 0.45); c.lineTo(x + w / 2, y); c.lineTo(x + w + 2, y + h * 0.45); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w + 2, y + h * 0.45); c.lineTo(x + w / 2, y + h * 0.45); c.fill();
  if (!opts.nodoor) { c.fillStyle = '#5d4037'; c.fillRect(x + w / 2 - 2.5, y + h - 8, 5, 8); }
  const night = isNight();
  if (!opts.nowin) {
    c.fillStyle = night && opts.lit !== false ? '#ffe082' : '#90a4ae';
    c.fillRect(x + 3, y + h * 0.6, 4, 4); c.fillRect(x + w - 7, y + h * 0.6, 4, 4);
  }
}
function isNight() { return false; } // day and night were removed

function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function yard(c, px, py, col) { c.fillStyle = col; rrect(c, px + 1.5, py + 2.5, 29, 28, 4); c.fill(); }
function shadowAt(c, x, y, w) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y, w, 3, 0, 0, 7); c.fill(); }
function timber(c, x, y, w, h) {
  c.strokeStyle = '#5d4037'; c.lineWidth = 1.1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.beginPath(); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5);
  for (const f of [0.33, 0.66]) { c.moveTo(x + w * f, y); c.lineTo(x + w * f, y + h); }
  c.moveTo(x, y); c.lineTo(x + w * 0.33, y + h * 0.5); c.moveTo(x + w, y); c.lineTo(x + w * 0.66, y + h * 0.5); c.stroke();
}
function win(c, x, y, w, h, lit) { c.fillStyle = lit ? '#ffcc66' : '#7d97a8'; c.fillRect(x, y, w, h); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + w / 2 - 0.4, y, 0.8, h); }
function smoke(c, x, y, k) { if (isNight()) return; const t = (R.t * 0.8 + k) % 1; c.fillStyle = `rgba(210,210,210,${0.55 - t * 0.5})`; c.beginPath(); c.arc(x + t * 3, y - t * 9, 1.6 + t * 2.5, 0, 7); c.fill(); }
function sign(c, px, py, icon) {
  if (R.cam.z < 0.85) return;
  c.fillStyle = 'rgba(30,22,16,0.85)'; c.beginPath(); c.arc(px + 27, py + 27, 5, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,213,79,0.85)'; c.lineWidth = 1; c.stroke();
  c.font = '6.5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(icon, px + 27, py + 27.4); c.textBaseline = 'alphabetic';
}
function waterSide(b) { for (const [dx, dy] of N4) { const t = inB(b.x + dx, b.y + dy) ? terr(b.x + dx, b.y + dy) : -1; if (t === T.WATER || t === T.DEEP) return [dx, dy]; } return [0, 1]; }

function drawBuilding(c, b) {
  const d = B[b.type], px = b.x * TILE, py = b.y * TILE, L = b.level, roof = b.roof || d.roof || '#8e3b2e';
  const night = false;
  if (d.block) { drawBlock(c, b, px, py, d); return; }
  levelGround(c, b, px, py, L);
  const sc = levelScale(b); if (sc !== 1) { c.save(); c.translate(px + 16, py + 31); c.scale(sc, sc); c.translate(-px - 16, -py - 31); }
  switch (b.type) {
    case 'townhall': drawHall(c, px, py, L, roof, G.realm.color); break;
    case 'hut': drawHome(c, px, py, L, roof, b.id); break;
    case 'farm': {
      const s = 1, crop = L >= 4 ? '#aed581' : '#c0ca33';
      yard(c, px, py, '#8d6e63');
      for (let i = 0; i < 6; i++) { c.fillStyle = crop; c.fillRect(px + 3, py + 5 + i * 4.3, 17, 2.2); if (s === 2) { c.fillStyle = '#e6a100'; for (let j = 0; j < 4; j++) c.fillRect(px + 4 + j * 4.5, py + 4 + i * 4.3, 1.2, 1.2); } }
      // red barn
      c.fillStyle = roof; c.fillRect(px + 21, py + 12, 9, 12);
      c.fillStyle = shade(roof, -25); c.beginPath(); c.moveTo(px + 20, py + 13); c.lineTo(px + 25.5, py + 6); c.lineTo(px + 31, py + 13); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 0.9; c.strokeRect(px + 23, py + 17, 5, 7); c.beginPath(); c.moveTo(px + 23, py + 17); c.lineTo(px + 28, py + 24); c.moveTo(px + 28, py + 17); c.lineTo(px + 23, py + 24); c.stroke();
      // fence
      c.fillStyle = '#d7ccc8'; c.fillRect(px + 2, py + 29, 28, 1); for (let i = 0; i < 6; i++) c.fillRect(px + 2.5 + i * 5.4, py + 27, 1, 3);
      break;
    }
    case 'fishery': {
      const [wx, wy] = waterSide(b);
      // pier reaching toward the water
      c.fillStyle = '#a1785a';
      if (wx) { const x0 = wx > 0 ? px + 14 : px - 10; c.fillRect(x0, py + 18, 28, 6); c.fillStyle = '#6d4c41'; for (let i = 0; i < 6; i++) c.fillRect(x0 + i * 5, py + 18, 0.8, 6); }
      else { const y0 = wy > 0 ? py + 16 : py - 10; c.fillRect(px + 13, y0, 6, 26); c.fillStyle = '#6d4c41'; for (let i = 0; i < 6; i++) c.fillRect(px + 13, y0 + i * 5, 6, 0.8); }
      // boat at the pier end
      const bx = px + 16 + wx * 24, by = py + 18 + wy * 22 + Math.sin(R.t * 1.5 + b.id) * 0.8;
      c.fillStyle = '#6d4c41'; c.beginPath(); c.ellipse(bx, by + 3, 6, 2.6, 0, 0, Math.PI); c.fill(); c.fillRect(bx - 6, by + 1.5, 12, 1.6);
      c.fillStyle = '#5d4037'; c.fillRect(bx - 0.5, by - 8, 1, 10); c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(bx + 0.5, by - 8); c.lineTo(bx + 5, by); c.lineTo(bx + 0.5, by); c.fill();
      // shack + net rack
      c.fillStyle = '#d7b98e'; c.fillRect(px + 4 - wx * 2, py + 9, 13, 10); c.fillStyle = roof; c.beginPath(); c.moveTo(px + 2 - wx * 2, py + 10); c.lineTo(px + 10.5 - wx * 2, py + 3); c.lineTo(px + 19 - wx * 2, py + 10); c.fill();
      c.fillStyle = '#5d4037'; c.fillRect(px + 9 - wx * 2, py + 14, 3, 5);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.6; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(px + 4 + i * 2, py + 22); c.lineTo(px + 4 + i * 2, py + 28); c.moveTo(px + 3, py + 23 + i * 1.6); c.lineTo(px + 11, py + 23 + i * 1.6); } c.stroke();
      break;
    }
    case 'hunter':
      yard(c, px, py, 'rgba(93,64,55,0.35)');
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 3, py + 26); c.lineTo(px + 13, py + 6); c.lineTo(px + 23, py + 26); c.fill();
      c.fillStyle = shade(roof, -25); c.beginPath(); c.moveTo(px + 13, py + 6); c.lineTo(px + 23, py + 26); c.lineTo(px + 13, py + 26); c.fill();
      c.fillStyle = '#3e2723'; c.beginPath(); c.moveTo(px + 10.5, py + 26); c.lineTo(px + 13, py + 17); c.lineTo(px + 15.5, py + 26); c.fill();
      c.strokeStyle = '#efebe9'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px + 13, py + 6); c.lineTo(px + 9, py + 1); c.lineTo(px + 7, py + 2); c.moveTo(px + 10.5, py + 3); c.lineTo(px + 10, py + 0); c.moveTo(px + 13, py + 6); c.lineTo(px + 17, py + 1); c.lineTo(px + 19, py + 2); c.moveTo(px + 15.5, py + 3); c.lineTo(px + 16, py + 0); c.stroke();
      // hide rack
      c.fillStyle = '#5d4037'; c.fillRect(px + 23, py + 10, 1, 12); c.fillRect(px + 29, py + 10, 1, 12); c.fillRect(px + 23, py + 10, 7, 1);
      c.fillStyle = '#a1887f'; c.beginPath(); c.ellipse(px + 26.5, py + 15, 2.8, 4, 0, 0, 7); c.fill();
      break;
    case 'lumber':
      yard(c, px, py, 'rgba(121,85,72,0.35)');
      // log cabin
      c.fillStyle = '#8d6e63'; c.fillRect(px + 3, py + 11, 16, 12);
      c.strokeStyle = '#5d4037'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(px + 3, py + 13 + i * 3); c.lineTo(px + 19, py + 13 + i * 3); } c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 1, py + 12); c.lineTo(px + 11, py + 4); c.lineTo(px + 21, py + 12); c.fill();
      c.fillStyle = '#3e2723'; c.fillRect(px + 9, py + 17, 4, 6);
      // log pile
      for (let i = 0; i < 6; i++) { const lx = px + 21 + (i % 3) * 3.4 + (i > 2 ? 1.7 : 0), ly = py + 27 - (i > 2 ? 3 : 0); c.fillStyle = '#8d6e63'; c.beginPath(); c.arc(lx, ly, 1.9, 0, 7); c.fill(); c.fillStyle = '#e0c9a6'; c.beginPath(); c.arc(lx, ly, 0.9, 0, 7); c.fill(); }
      // stump + axe
      c.fillStyle = '#795548'; c.fillRect(px + 5, py + 25, 5, 3); c.fillStyle = '#d7ccc8'; c.fillRect(px + 5, py + 24.5, 5, 1);
      c.fillStyle = '#5d4037'; c.save(); c.translate(px + 8, py + 24); c.rotate(-0.6); c.fillRect(0, -6, 1, 6); c.fillStyle = '#b0bec5'; c.fillRect(-1, -6.5, 3, 2); c.restore();
      break;
    case 'quarry':
      c.fillStyle = '#a7a39b'; rrect(c, px + 1.5, py + 3, 29, 27, 5); c.fill();
      c.fillStyle = '#8e8a83'; rrect(c, px + 5, py + 7, 22, 20, 4); c.fill();
      c.fillStyle = '#757069'; rrect(c, px + 9, py + 11, 14, 13, 3); c.fill();
      c.fillStyle = '#5d5953'; rrect(c, px + 12, py + 14, 8, 7, 2); c.fill();
      c.fillStyle = '#eceae6'; c.fillRect(px + 3, py + 25, 5, 4); c.fillRect(px + 8, py + 26, 4, 3); c.fillRect(px + 4.5, py + 21.5, 4, 3.5);
      // little crane
      c.strokeStyle = '#6d4c41'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px + 27, py + 28); c.lineTo(px + 27, py + 4); c.lineTo(px + 17, py + 8); c.stroke();
      c.strokeStyle = '#424242'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px + 18, py + 8); c.lineTo(px + 18, py + 14 + Math.sin(R.t + b.id) * 2); c.stroke();
      break;
    case 'mine':
      c.fillStyle = '#6f6a65'; c.beginPath(); c.moveTo(px + 0, py + 30); c.quadraticCurveTo(px + 6, py + 4, px + 16, py + 3); c.quadraticCurveTo(px + 26, py + 4, px + 32, py + 30); c.fill();
      c.fillStyle = '#8a857f'; c.beginPath(); c.moveTo(px + 6, py + 14); c.quadraticCurveTo(px + 12, py + 5, px + 16, py + 4); c.lineTo(px + 14, py + 14); c.fill();
      c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(px + 16, py + 19, 6, Math.PI, 0); c.fillRect(px + 10, py + 19, 12, 9); c.fill();
      c.fillStyle = '#8d6e63'; c.fillRect(px + 8.5, py + 14, 2.2, 14); c.fillRect(px + 21.3, py + 14, 2.2, 14); c.fillRect(px + 8, py + 12.5, 16, 2.4);
      if (night) { c.fillStyle = '#ffb74d'; c.beginPath(); c.arc(px + 9.5, py + 11, 1.4, 0, 7); c.fill(); }
      // rails + cart
      c.strokeStyle = '#9e9e9e'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px + 13, py + 28); c.lineTo(px + 13, py + 32); c.moveTo(px + 19, py + 28); c.lineTo(px + 19, py + 32); c.stroke();
      c.fillStyle = '#546e7a'; c.fillRect(px + 12, py + 24, 8, 5); c.fillStyle = G.tiles.special[idx(b.x, b.y)] === 2 ? '#ffd54f' : '#b0794a'; c.beginPath(); c.arc(px + 14.5, py + 24, 1.6, 0, 7); c.arc(px + 17.5, py + 23.6, 1.6, 0, 7); c.fill();
      break;
    case 'workshop': {
      yard(c, px, py, 'rgba(120,110,100,0.4)');
      c.fillStyle = '#9e9890'; c.fillRect(px + 3, py + 12, 20, 17);
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(px + 3, py + 15 + i * 3); c.lineTo(px + 23, py + 15 + i * 3); } c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 1, py + 13); c.lineTo(px + 13, py + 6); c.lineTo(px + 25, py + 13); c.fill();
      // big brick chimney
      c.fillStyle = '#8d4f3a'; c.fillRect(px + 23, py + 2, 5, 20); c.fillStyle = '#6d3a2a'; c.fillRect(px + 22.5, py + 1, 6, 2);
      if (b.workers.length) { smoke(c, px + 25.5, py, b.id * 0.4); smoke(c, px + 25.5, py, b.id * 0.4 + 0.5); }
      // forge opening glowing
      const glow = b.workers.length ? 0.75 + Math.sin(R.t * 6 + b.id) * 0.2 : 0.25;
      c.fillStyle = `rgba(255,${120 + glow * 60 | 0},40,${glow})`; c.beginPath(); c.arc(px + 13, py + 24, 4.5, Math.PI, 0); c.fillRect(px + 8.5, py + 24, 9, 5); c.fill();
      // anvil
      c.fillStyle = '#37474f'; c.fillRect(px + 25, py + 25, 5, 2); c.fillRect(px + 26.5, py + 27, 2, 2); c.fillRect(px + 25.5, py + 29, 4, 1);
      break;
    }
    case 'warehouse':
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(px + 2, py + 28, 30, 3);
      c.fillStyle = '#a1887f'; c.fillRect(px + 2, py + 11, 28, 18);
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 7; i++) { c.moveTo(px + 2 + i * 4.3, py + 11); c.lineTo(px + 2 + i * 4.3, py + 29); } c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 0, py + 12); c.lineTo(px + 5, py + 4); c.lineTo(px + 27, py + 4); c.lineTo(px + 32, py + 12); c.fill();
      c.fillStyle = '#5d4037'; c.fillRect(px + 9, py + 17, 14, 12); c.strokeStyle = '#d7ccc8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px + 16, py + 17); c.lineTo(px + 16, py + 29); c.moveTo(px + 9, py + 17); c.lineTo(px + 16, py + 29); c.moveTo(px + 23, py + 17); c.lineTo(px + 16, py + 29); c.stroke();
      // crates
      for (const [cx, cy] of [[0, 23], [3, 19.5]]) { c.fillStyle = '#c8a165'; c.fillRect(px + cx, py + cy, 5, 5); c.strokeStyle = '#7b5a33'; c.strokeRect(px + cx + 0.5, py + cy + 0.5, 4, 4); }
      break;
    case 'granary':
      yard(c, px, py, 'rgba(215,190,140,0.35)');
      for (const [sx, h2] of [[10, 18], [22, 14]]) {
        c.fillStyle = '#e0d6c8'; c.fillRect(px + sx - 5, py + 29 - h2, 10, h2); c.beginPath(); c.ellipse(px + sx, py + 29, 5, 1.6, 0, 0, Math.PI); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(px + sx - 5, py + 29 - h2 + i * h2 / 4); c.lineTo(px + sx + 5, py + 29 - h2 + i * h2 / 4); } c.stroke();
        c.fillStyle = roof; c.beginPath(); c.moveTo(px + sx - 6.5, py + 30 - h2); c.lineTo(px + sx, py + 22 - h2); c.lineTo(px + sx + 6.5, py + 30 - h2); c.fill();
      }
      c.fillStyle = '#d7b98e'; c.beginPath(); c.ellipse(px + 28, py + 27, 2.5, 3, 0, 0, 7); c.fill();
      break;
    case 'tavern':
      shadowAt(c, px + 17, py + 30, 14);
      c.fillStyle = '#f3e5c8'; c.fillRect(px + 3, py + 13, 26, 16); timber(c, px + 3, py + 13, 26, 16);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 1, py + 14); c.lineTo(px + 6, py + 4); c.lineTo(px + 26, py + 4); c.lineTo(px + 31, py + 14); c.fill();
      c.fillStyle = shade(roof, 15); c.fillRect(px + 12, py + 6, 8, 5); win(c, px + 14, py + 7, 4, 3, true);
      win(c, px + 5.5, py + 21.5, 4, 4, true); win(c, px + 22.5, py + 21.5, 4, 4, true);
      c.fillStyle = '#4e342e'; c.fillRect(px + 13.5, py + 21, 5, 8);
      // hanging mug sign
      c.fillStyle = '#5d4037'; c.fillRect(px + 28, py + 14, 4, 1.2); c.fillStyle = '#ffb300'; c.fillRect(px + 29, py + 15.5, 3, 3.5); c.fillStyle = '#fff'; c.fillRect(px + 29, py + 15.5, 3, 1);
      // barrel
      c.fillStyle = '#8d6e63'; c.beginPath(); c.ellipse(px + 2.5, py + 27, 2.3, 3, 0, 0, 7); c.fill(); c.fillStyle = '#5d4037'; c.fillRect(px + 0.3, py + 26.2, 4.4, 0.7);
      break;
    case 'temple':
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(px + 3, py + 28, 28, 3);
      c.fillStyle = '#d8d4cc'; c.fillRect(px + 2, py + 27, 28, 3); c.fillStyle = '#e8e4dc'; c.fillRect(px + 4, py + 25, 24, 2.5);
      for (let i = 0; i < 5; i++) { c.fillStyle = '#fafafa'; c.fillRect(px + 5.5 + i * 4.8, py + 13, 2.6, 12); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(px + 7.1 + i * 4.8, py + 13, 1, 12); }
      c.fillStyle = '#f0ece4'; c.fillRect(px + 3.5, py + 11, 25, 2.5);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 2, py + 11.5); c.lineTo(px + 16, py + 2); c.lineTo(px + 30, py + 11.5); c.fill();
      c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(px + 16, py + 7.5, 1.8, 0, 7); c.fill(); c.fillRect(px + 15.4, py - 1, 1.2, 3.5);
      if (night) { c.fillStyle = 'rgba(255,204,102,0.7)'; c.fillRect(px + 13, py + 18, 6, 7); }
      break;
    case 'library':
      shadowAt(c, px + 17, py + 30, 14);
      c.fillStyle = '#cfc6b8'; c.fillRect(px + 3, py + 12, 26, 17);
      c.fillStyle = '#b8ad9c'; for (let i = 0; i < 4; i++) c.fillRect(px + 4 + i * 7.8, py + 12, 2, 17);
      c.fillStyle = shade(roof, 10); c.beginPath(); c.arc(px + 16, py + 12, 8, Math.PI, 0); c.fill();
      c.fillStyle = roof; c.fillRect(px + 2, py + 10.5, 28, 2.5); c.fillStyle = '#ffd54f'; c.fillRect(px + 15.4, py + 1.5, 1.2, 3);
      c.fillStyle = night ? '#ffcc66' : '#90a4ae'; c.beginPath(); c.arc(px + 16, py + 17, 2.6, 0, 7); c.fill();
      win(c, px + 7.5, py + 19, 3, 5, night); win(c, px + 21.5, py + 19, 3, 5, night);
      c.fillStyle = '#4e342e'; c.beginPath(); c.arc(px + 16, py + 24.5, 2.5, Math.PI, 0); c.fillRect(px + 13.5, py + 24.5, 5, 4.5); c.fill();
      // book stack
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#c62828', '#1565c0', '#2e7d32'][i]; c.fillRect(px + 0.5 + i * 0.6, py + 27 - i * 1.6, 4.5, 1.5); }
      break;
    case 'market': {
      c.fillStyle = 'rgba(205,195,180,0.6)'; rrect(c, px + 1.5, py + 3, 29, 27, 3); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 0.6; c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(px + 1.5 + i * 6, py + 3); c.lineTo(px + 1.5 + i * 6, py + 30); c.moveTo(px + 1.5, py + 3 + i * 6); c.lineTo(px + 30.5, py + 3 + i * 6); } c.stroke();
      const cols = [roof, '#fff'];
      for (let s = 0; s < 2; s++) {
        const ox = px + 2 + s * 15, oy = py + 6 + s * 9;
        c.fillStyle = '#8d6e63'; c.fillRect(ox + 1, oy + 6, 12, 7);
        for (let i = 0; i < 4; i++) { c.fillStyle = cols[i % 2]; c.fillRect(ox + i * 3.5, oy, 3.5, 5); c.beginPath(); c.arc(ox + i * 3.5 + 1.75, oy + 5, 1.75, 0, Math.PI); c.fill(); }
        const goods = s ? ['#e53935', '#fdd835', '#43a047'] : ['#ff9800', '#8d6e63', '#7cb342'];
        for (let g = 0; g < 3; g++) { c.fillStyle = goods[g]; c.beginPath(); c.arc(ox + 3.5 + g * 3.5, oy + 8, 1.5, 0, 7); c.fill(); }
      }
      c.fillStyle = '#c8a165'; c.fillRect(px + 4, py + 23, 4, 4); c.fillStyle = '#d7b98e'; c.beginPath(); c.ellipse(px + 11, py + 26, 2.3, 2.8, 0, 0, 7); c.fill();
      break;
    }
    case 'healer':
      // herb garden beds
      c.fillStyle = '#6d4c41'; c.fillRect(px + 2, py + 22, 12, 7); c.fillRect(px + 2, py + 3, 8, 7);
      for (let i = 0; i < 8; i++) { c.fillStyle = ['#66bb6a', '#9ccc65', '#ab47bc', '#43a047'][i % 4]; c.beginPath(); c.arc(px + 3.5 + (i % 4) * 3, py + 24 + (i > 3 ? 3 : 0), 1.3, 0, 7); c.fill(); }
      for (let i = 0; i < 4; i++) { c.fillStyle = '#81c784'; c.beginPath(); c.arc(px + 3.5 + (i % 2) * 4, py + 5 + (i > 1 ? 3 : 0), 1.4, 0, 7); c.fill(); }
      c.fillStyle = '#f1f8e9'; c.fillRect(px + 12, py + 11, 17, 12);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 10, py + 12); c.lineTo(px + 20.5, py + 3); c.lineTo(px + 31, py + 12); c.fill();
      c.fillStyle = '#e53935'; c.fillRect(px + 19.3, py + 13.5, 2.4, 7); c.fillRect(px + 17, py + 15.8, 7, 2.4);
      c.fillStyle = '#5d4037'; c.fillRect(px + 25, py + 17, 3, 6); win(c, px + 13.5, py + 15, 2.5, 3, night);
      break;
    case 'well':
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(px + 17, py + 25, 9, 4, 0, 0, 7); c.fill();
      c.fillStyle = '#9e9e9e'; c.beginPath(); c.ellipse(px + 16, py + 22, 8, 5, 0, 0, 7); c.fill();
      c.fillStyle = '#1e88e5'; c.beginPath(); c.ellipse(px + 16, py + 21, 5, 3, 0, 0, 7); c.fill();
      c.strokeStyle = '#6d4c41'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 9, py + 22); c.lineTo(px + 9, py + 9); c.moveTo(px + 23, py + 22); c.lineTo(px + 23, py + 9); c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 6, py + 10); c.lineTo(px + 16, py + 4); c.lineTo(px + 26, py + 10); c.fill();
      c.fillStyle = '#8d6e63'; c.fillRect(px + 14.5, py + 10, 3, 4);
      break;
    case 'barracks': {
      yard(c, px, py, 'rgba(110,90,70,0.45)');
      c.fillStyle = '#8f8a84'; c.fillRect(px + 3, py + 10, 20, 19);
      c.fillStyle = '#a6a19a'; for (let i = 0; i < 5; i++) c.fillRect(px + 3 + i * 4.2, py + 7, 2.8, 3.5);
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(px + 3, py + 13 + i * 3); c.lineTo(px + 23, py + 13 + i * 3); } c.stroke();
      c.fillStyle = '#3e2723'; c.beginPath(); c.arc(px + 13, py + 23, 4, Math.PI, 0); c.fillRect(px + 9, py + 23, 8, 6); c.fill();
      c.fillStyle = roof; c.fillRect(px + 9, py + 14, 8, 3);
      c.fillStyle = '#5d4037'; c.fillRect(px + 4, py - 3, 1.3, 11); c.fillStyle = G.realm.color; c.beginPath(); c.moveTo(px + 5.3, py - 3); c.lineTo(px + 12, py - 1 + Math.sin(R.t * 4 + b.id)); c.lineTo(px + 5.3, py + 2); c.fill();
      // training dummy + spears
      c.fillStyle = '#6d4c41'; c.fillRect(px + 27, py + 16, 1.4, 13); c.fillRect(px + 24, py + 19, 7.5, 1.4);
      c.fillStyle = '#e6c27a'; c.beginPath(); c.arc(px + 27.7, py + 15, 2.2, 0, 7); c.fill(); c.fillRect(px + 25.7, py + 20.4, 4, 4);
      c.strokeStyle = '#b0bec5'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(px + 24.5, py + 29); c.lineTo(px + 24.5, py + 10); c.stroke();
      break;
    }
    case 'watchtower':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 11, py + 27, 14, 3);
      c.fillStyle = '#a1887f'; c.fillRect(px + 11, py + 8, 10, 21);
      c.strokeStyle = '#6d4c41'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(px + 11, py + 12); c.lineTo(px + 21, py + 28); c.moveTo(px + 21, py + 12); c.lineTo(px + 11, py + 28); c.stroke();
      c.fillStyle = '#8d6e63'; c.fillRect(px + 9, py + 5, 14, 4);
      for (let i = 0; i < 4; i++) { c.fillRect(px + 9 + i * 4, py + 2, 2, 3); }
      c.fillStyle = night ? '#ffcc80' : '#37474f'; c.fillRect(px + 14, py + 12, 4, 4);
      if (night) { c.fillStyle = 'rgba(255,183,77,0.8)'; c.beginPath(); c.arc(px + 16, py + 1, 1.5 + Math.sin(R.t * 9) * 0.4, 0, 7); c.fill(); }
      break;
    case 'wall': {
      c.fillStyle = '#9e9e9e';
      const conn = N4.map(([dx, dy]) => { const o = bAt(b.x + dx, b.y + dy); return o && o.type === 'wall'; });
      c.fillRect(px + 10, py + 10, 12, 14);
      if (conn[0]) c.fillRect(px + 16, py + 12, 16, 10); if (conn[1]) c.fillRect(px, py + 12, 16, 10);
      if (conn[2]) c.fillRect(px + 11, py + 16, 10, 16); if (conn[3]) c.fillRect(px + 11, py, 10, 16);
      c.fillStyle = '#bdbdbd'; c.fillRect(px + 10, py + 8, 12, 4);
      break;
    }
    case 'outpost':
      c.fillStyle = '#8d6e63'; for (let i = 0; i < 5; i++) { c.fillRect(px + 5 + i * 5, py + 16, 3, 13); c.beginPath(); c.moveTo(px + 5 + i * 5, py + 16); c.lineTo(px + 6.5 + i * 5, py + 13); c.lineTo(px + 8 + i * 5, py + 16); c.fill(); }
      c.fillStyle = '#5d4037'; c.fillRect(px + 15, py + 1, 2, 18);
      c.fillStyle = G.realm.color; c.beginPath(); c.moveTo(px + 17, py + 1); c.lineTo(px + 27, py + 4 + Math.sin(R.t * 4 + b.id)); c.lineTo(px + 17, py + 8); c.fill();
      break;
    case 'cityhall': {
      yard(c, px, py, 'rgba(190,180,200,0.55)');
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 3, py + 27, 28, 4);
      // keep with two towers and a gate
      c.fillStyle = '#b0a8b9'; c.fillRect(px + 7, py + 12, 18, 17);
      c.fillStyle = '#9e95a8'; c.fillRect(px + 3, py + 8, 7, 21); c.fillRect(px + 22, py + 8, 7, 21);
      c.fillStyle = '#8a8194'; for (let i = 0; i < 3; i++) { c.fillRect(px + 3 + i * 2.5, py + 6, 1.6, 2.5); c.fillRect(px + 22 + i * 2.5, py + 6, 1.6, 2.5); }
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 6, py + 13); c.lineTo(px + 16, py + 5 - L); c.lineTo(px + 26, py + 13); c.fill();
      c.fillStyle = '#4e342e'; c.beginPath(); c.moveTo(px + 13, py + 29); c.lineTo(px + 13, py + 22); c.arc(px + 16, py + 22, 3, Math.PI, 0); c.lineTo(px + 19, py + 29); c.fill();
      win(c, px + 5, py + 15, 2.5, 3, night); win(c, px + 24.5, py + 15, 2.5, 3, night);
      c.fillStyle = '#5d4037'; c.fillRect(px + 15.3, py - 6 - L, 1.4, 11);
      c.fillStyle = G.realm.color; c.beginPath(); c.moveTo(px + 16.7, py - 6 - L); c.lineTo(px + 24, py - 3.5 - L + Math.sin(R.t * 4 + 1)); c.lineTo(px + 16.7, py - 1 - L); c.fill();
      break;
    }
    case 'monument':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 8, py + 27, 20, 3);
      c.fillStyle = '#bdbdbd'; c.fillRect(px + 7, py + 24, 18, 5);
      c.fillStyle = '#eeeeee'; c.beginPath(); c.moveTo(px + 11, py + 24); c.lineTo(px + 14, py + 0); c.lineTo(px + 18, py + 0); c.lineTo(px + 21, py + 24); c.fill();
      c.fillStyle = '#ffd54f'; c.beginPath(); c.moveTo(px + 14, py + 0); c.lineTo(px + 16, py - 4); c.lineTo(px + 18, py + 0); c.fill();
      break;
    case 'spire': {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px + 4, py + 27, 28, 4);
      c.fillStyle = '#eceff1'; c.fillRect(px + 4, py + 18, 24, 11);
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(px + 8, py + 18); c.lineTo(px + 16, py - 26); c.lineTo(px + 24, py + 18); c.fill();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 13, py - 10); c.lineTo(px + 16, py - 26); c.lineTo(px + 19, py - 10); c.fill();
      c.fillStyle = `rgba(255,236,150,${0.5 + Math.sin(R.t * 2) * 0.3})`; c.beginPath(); c.arc(px + 16, py - 27, 3, 0, 7); c.fill();
      break;
    }
    // decor
    case 'tree': {
      const s = 1; c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(px + 17, py + 27, 8, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#6d4c41'; c.fillRect(px + 14.5, py + 16, 3, 11);
      c.fillStyle = s === 2 ? '#e67e22' : s === 3 ? '#cfd8dc' : '#43a047'; c.beginPath(); c.arc(px + 16, py + 12, 9, 0, 7); c.fill();
      c.fillStyle = s === 2 ? '#f39c12' : s === 3 ? '#eceff1' : '#66bb6a'; c.beginPath(); c.arc(px + 13, py + 9, 4, 0, 7); c.fill();
      break;
    }
    case 'flowers':
      c.fillStyle = '#6d4c41'; c.fillRect(px + 5, py + 10, 22, 14);
      for (let i = 0; i < 12; i++) { c.fillStyle = ['#e91e63', '#ffeb3b', '#9c27b0', '#ff5722', '#fff'][i % 5]; c.beginPath(); c.arc(px + 8 + (i % 4) * 5.5, py + 13 + Math.floor(i / 4) * 4.5, 1.8, 0, 7); c.fill(); }
      break;
    case 'hedge': {
      c.fillStyle = '#2e7d32';
      const conn = N4.map(([dx, dy]) => { const o = bAt(b.x + dx, b.y + dy); return o && o.type === 'hedge'; });
      c.fillRect(px + 9, py + 9, 14, 14);
      if (conn[0]) c.fillRect(px + 16, py + 10, 16, 12); if (conn[1]) c.fillRect(px, py + 10, 16, 12);
      if (conn[2]) c.fillRect(px + 10, py + 16, 12, 16); if (conn[3]) c.fillRect(px + 10, py, 12, 16);
      break;
    }
    case 'bench':
      c.fillStyle = '#8d6e63'; c.fillRect(px + 6, py + 14, 20, 4); c.fillRect(px + 6, py + 10, 20, 2); c.fillStyle = '#4e342e'; c.fillRect(px + 7, py + 18, 2, 5); c.fillRect(px + 23, py + 18, 2, 5);
      break;
    case 'lamp':
      c.fillStyle = '#37474f'; c.fillRect(px + 15, py + 8, 2, 20);
      c.fillStyle = '#ffe082'; c.fillRect(px + 12.5, py + 4, 7, 6); c.fillStyle = '#37474f'; c.fillRect(px + 12, py + 3, 8, 1.2);
      break;
    case 'garden':
      c.fillStyle = '#558b2f'; c.fillRect(px + 2, py + 2, 28, 28);
      c.fillStyle = '#d7ccc8'; c.fillRect(px + 14, py + 2, 4, 28); c.fillRect(px + 2, py + 14, 28, 4);
      for (let i = 0; i < 8; i++) { c.fillStyle = ['#ec407a', '#ffee58', '#ab47bc', '#fff'][i % 4]; c.beginPath(); c.arc(px + 6 + (i % 2) * 18 + (i % 3), py + 6 + Math.floor(i / 2) * 6.5, 1.8, 0, 7); c.fill(); }
      break;
    case 'pond':
      c.fillStyle = '#8bc34a'; c.beginPath(); c.ellipse(px + 16, py + 17, 14, 11, 0, 0, 7); c.fill();
      c.fillStyle = '#42a5f5'; c.beginPath(); c.ellipse(px + 16, py + 17, 11, 8, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px + 12 + Math.sin(R.t * 0.7 + b.id) * 4, py + 16, 2, 0, 7); c.fill(); c.fillStyle = '#ff9800'; c.fillRect(px + 13.5 + Math.sin(R.t * 0.7 + b.id) * 4, py + 15.5, 1.5, 1);
      break;
    case 'fountain':
      c.fillStyle = '#bdbdbd'; c.beginPath(); c.arc(px + 16, py + 18, 12, 0, 7); c.fill();
      c.fillStyle = '#4fc3f7'; c.beginPath(); c.arc(px + 16, py + 18, 9, 0, 7); c.fill();
      c.fillStyle = '#9e9e9e'; c.fillRect(px + 14, py + 8, 4, 10);
      c.fillStyle = 'rgba(225,245,254,0.9)'; for (let i = 0; i < 4; i++) { const a = R.t * 3 + i * 1.57; c.beginPath(); c.arc(px + 16 + Math.cos(a) * 5, py + 12 + Math.abs(Math.sin(a * 1.3)) * 4, 1.2, 0, 7); c.fill(); }
      break;
    case 'statue':
      c.fillStyle = '#9e9e9e'; c.fillRect(px + 9, py + 20, 14, 9);
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.arc(px + 16, py + 6, 3, 0, 7); c.fill(); c.fillRect(px + 13, py + 9, 6, 11); c.fillRect(px + 19, py + 6, 2, 6);
      break;
    default:
      if (!drawNewBuilding(c, b, px, py, L, roof)) { c.font = '20px serif'; c.textAlign = 'center'; c.fillText(d.icon, px + 16, py + 24); }
  }
  if (sc !== 1) c.restore();
  levelArt(c, b, px, py, L);
  if (!d.decor && d.cat !== 'wonder' && !['hut', 'townhall', 'cityhall', 'wall', 'well', 'outpost', 'windturbine', 'solarfarm', 'aqueduct'].includes(b.type) && b.id) sign(c, px, py, d.icon);
  if (b.ruined) ruinMark(c, b, px, py);
  if (b.id) powerMark(c, b, px, py);
  if (b.burning) {
    for (let i = 0; i < 5; i++) {
      const fx = px + 6 + i * 5, fy = py + 14 + Math.sin(R.t * 10 + i) * 3;
      c.fillStyle = i % 2 ? 'rgba(255,152,0,0.85)' : 'rgba(244,67,54,0.85)';
      c.beginPath(); c.moveTo(fx - 3, fy + 8); c.quadraticCurveTo(fx, fy - 8 - Math.sin(R.t * 12 + i) * 4, fx + 3, fy + 8); c.fill();
    }
  }
  if (b.paused && B[b.type].workers) { c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('⏸️', px + 27, py + 9); }
  if (b.starved) { c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('⚠️', px + 27, py + 9); }
  if (b.priority && R.cam.z > 0.85) { c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('⭐', px + 5, py + 27); }

}

function drawKin(c, k) {
  if (k.away) return;
  const px = k.x * TILE + 16, py = k.y * TILE + 22;
  const child = !isAdult(k), s = k.age < 3 ? 0.5 : k.age < 13 ? 0.7 : child ? 0.85 : isElder(k) ? 0.95 : 1;
  const walking = k.state === 'walking';
  const bob = walking ? Math.abs(Math.sin(R.t * 12 + k.id)) * 1.5 : 0;
  // offset people at the same building so they don't overlap
  let ox = 0, oy = 0;
  if (!walking) { ox = (hashf(k.id, 1, 7) - 0.5) * 18; oy = (hashf(k.id, 2, 7) - 0.5) * 8; if (k.state === 'sleep' || k.state === 'home') return; }
  const X = px + ox, Y = py + oy - bob;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(X, py + oy + 3, 3.5 * s, 1.5 * s, 0, 0, 7); c.fill();
  c.fillStyle = k.soldier ? '#78909c' : k.shirt; c.beginPath(); c.ellipse(X, Y - 2 * s, 3 * s, 4 * s, 0, 0, 7); c.fill();
  c.fillStyle = k.skin; c.beginPath(); c.arc(X, Y - 8 * s, 2.7 * s, 0, 7); c.fill();
  c.fillStyle = k.hair; c.beginPath(); c.arc(X, Y - 9 * s, 2.7 * s, Math.PI, 0); c.fill();
  if (k.soldier) { c.fillStyle = '#b0bec5'; c.fillRect(X - 3 * s, Y - 11.5 * s, 6 * s, 2 * s); }
  else if (isElder(k)) { c.fillStyle = '#e0e0e0'; c.beginPath(); c.arc(X, Y - 9 * s, 2.7 * s, Math.PI, 0); c.fill(); }
  drawPet(c, k, X, py + oy, walking);
  drawBubble(c, k, X, Y);
  if (k.sick) { c.fillStyle = '#8bc34a'; c.beginPath(); c.arc(X + 4, Y - 11, 1.5, 0, 7); c.fill(); }
  const sel = R.selected && R.selected.kind === 'k' && R.selected.id === k.id;
  if (sel) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y - 5, 9, 0, 7); c.stroke(); }
  if (R.cam.z >= 1.6 && (k.wish || sel)) {
    c.font = '9px sans-serif'; c.textAlign = 'center';
    if (k.wish) c.fillText('💭', X + 5, Y - 13);
  }
  if (R.cam.z >= 2 && k.state === 'work' && !walking) { /* working sparkle */ }
}

function drawArmy(c, a) {
  const px = a.x * TILE + 16, py = a.y * TILE + 16;
  const fo = a.owner === 0 ? null : fac(a.owner);
  const col = a.owner === 0 ? G.realm.color : fo ? fo.color : '#999';
  const ae = a.owner === 0 ? thLevel() : fo ? (fo.era || 1) : 1;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(px, py + 9, 12, 4, 0, 0, 7); c.fill();
  if (ae >= 6) { // tanks
    for (let i = 0; i < Math.min(2, Math.ceil(a.n / 6)); i++) {
      const ox = (i - 0.5) * 12 * (a.n > 6 ? 1 : 0), oy = Math.sin(R.t * 8 + i) * 0.5;
      c.fillStyle = '#556b2f'; rrect(c, px + ox - 7, py + oy - 1, 14, 7, 2); c.fill();
      c.fillStyle = '#33401c'; c.fillRect(px + ox - 7, py + oy + 4, 14, 2.5);
      c.fillStyle = '#6b8e23'; c.beginPath(); c.arc(px + ox, py + oy - 1, 4, Math.PI, 0); c.fill();
      c.strokeStyle = '#33401c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px + ox + 2, py + oy - 2.5); c.lineTo(px + ox + 9, py + oy - 4); c.stroke();
    }
  } else for (let i = 0; i < Math.min(5, a.n); i++) {
    const ox = (i - 2) * 4.5, oy = (i % 2) * 3 + Math.abs(Math.sin(R.t * 10 + i)) * 1.5;
    c.fillStyle = ae >= 4 ? (a.owner === 0 ? '#1565c0' : '#b71c1c') : '#546e7a'; c.fillRect(px + ox - 2, py + oy - 2, 4, 7);
    c.fillStyle = '#ffccbc'; c.beginPath(); c.arc(px + ox, py + oy - 4, 2, 0, 7); c.fill();
    if (ae >= 4) { c.fillStyle = '#212121'; c.fillRect(px + ox - 2, py + oy - 7, 4, 1.6); }
    c.strokeStyle = ae >= 4 ? '#5d4037' : '#cfd8dc'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + ox + 2.5, py + oy + 3); c.lineTo(px + ox + 2.5, py + oy - 9); c.stroke();
  }
  c.fillStyle = '#4e342e'; c.fillRect(px - 1, py - 22, 2, 18);
  c.fillStyle = col; c.beginPath(); c.moveTo(px + 1, py - 22); c.lineTo(px + 13, py - 19 + Math.sin(R.t * 5)); c.lineTo(px + 1, py - 15); c.fill();
  c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(a.n, px + 1, py + 21); c.fillStyle = '#fff'; c.fillText(a.n, px, py + 20);
  // path line
  if (a.path && a.pi < a.path.length) {
    c.strokeStyle = a.owner === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(239,83,80,0.7)'; c.setLineDash([4, 4]); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(px, py);
    for (let i = a.pi; i < a.path.length; i++) { const t = a.path[i]; c.lineTo((t % MAP_W) * TILE + 16, ((t / MAP_W) | 0) * TILE + 16); }
    c.stroke(); c.setLineDash([]);
  }
}

function render(dt) {
  R.t += dt;
  const c = R.ctx, W = window.innerWidth, H = window.innerHeight;
  if (R.camTarget) { R.cam.x += (R.camTarget.x - R.cam.x) * Math.min(1, dt * 6); R.cam.y += (R.camTarget.y - R.cam.y) * Math.min(1, dt * 6); if (Math.hypot(R.camTarget.x - R.cam.x, R.camTarget.y - R.cam.y) < 2) R.camTarget = null; }
  if (R.terrainDirty) drawTerrainCache();
  else { syncRoadLayer(); if (R.dirtyTiles.length) redrawDirtyTiles(); }
  if (R.territoryDirty) drawTerritoryCache();
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  c.fillStyle = '#1d3b57'; c.fillRect(0, 0, W, H);
  const z = R.cam.z;
  c.setTransform(z * devicePixelRatio, 0, 0, z * devicePixelRatio, (W / 2 - R.cam.x * z) * devicePixelRatio, (H / 2 - R.cam.y * z) * devicePixelRatio);
  c.imageSmoothingEnabled = z < 1;
  c.drawImage(R.terrainCanvas, 0, 0);
  // visible range
  const tl = screenToTile(0, 0), br = screenToTile(W, H);
  const x0 = Math.max(0, tl.x - 1), y0 = Math.max(0, tl.y - 1), x1 = Math.min(MAP_W - 1, br.x + 1), y1 = Math.min(MAP_H - 1, br.y + 1);
  // roads are baked into the terrain layer; only moving traffic is drawn each frame
  drawRoadTraffic(c, x0, y0, x1, y1);
  c.drawImage(R.terrCanvas, 0, 0);
  drawFutureOverlay(c, x0, y0, x1, y1);
  // AI deco + buildings sorted by row (tall buildings may poke above their tile, so draw a little past the edge)
  const lod = z < 0.55, WI = wireArr();
  for (let y = y0; y <= Math.min(MAP_H - 1, y1 + 2); y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (WI[i]) drawWire(c, x, y, lod);
      if (G.tiles.deco[i] && !G.tiles.bld[i]) (lod ? drawDecoLOD : drawAIDeco)(c, x, y, G.tiles.deco[i], G.tiles.owner[i]);
      const id = G.tiles.bld[i]; if (id && G.buildings[id] && G.buildings[id].type !== 'townhall') (lod ? drawBuildingLOD(c, G.buildings[id]) : drawBuilding(c, G.buildings[id]));
    }
  }
  { const th = townhall(); if (th) (lod ? drawBuildingLOD(c, th) : drawBuilding(c, th)); } // the capital hall always stands in front
  // kin (skipped when zoomed far out)
  if (!lod) { const ks = G.kin.filter(k => isAvatar(k) && k.x >= x0 - 1 && k.x <= x1 + 1 && k.y >= y0 - 1 && k.y <= y1 + 1).sort((a, b) => a.y - b.y); for (const k of ks) drawKin(c, k); }
  for (const a of G.armies) drawArmy(c, a);
  drawExpeditions(c);
  // selection
  if (R.selected && R.selected.kind === 'b') { const b = G.buildings[R.selected.id]; if (b) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(b.x * TILE + 1, b.y * TILE + 1, TILE - 2, TILE - 2); const d = B[b.type]; if (d.radius) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(b.x * TILE + 16, b.y * TILE + 16, d.radius * TILE, 0, 7); c.stroke(); c.setLineDash([]); } } }
  if (R.selected && R.selected.kind === 't') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(R.selected.x * TILE + 1, R.selected.y * TILE + 1, TILE - 2, TILE - 2); }
  if (R.highlight) { c.fillStyle = 'rgba(255,235,59,0.35)'; for (const t of R.highlight) c.fillRect(t.x * TILE, t.y * TILE, TILE, TILE); }
  if (UI.tool.kind === 'road') drawRoadLinks(c, x0, y0, x1, y1);
  drawToolOverlay(c, x0, y0, x1, y1);
  drawExpandOverlay(c); drawAreaRect(c);
  // floats
  for (const f of R.floats) { f.t += dt; c.globalAlpha = Math.max(0, 1 - f.t / 2.5); c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(f.text, f.x + 1, f.y - f.t * 12 + 1); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - f.t * 12); c.globalAlpha = 1; }
  R.floats = R.floats.filter(f => f.t < 2.5);
}

function drawBridge(c, x, y, px, py) {
  const link = (dx, dy) => { if (!inB(x + dx, y + dy)) return false; const j = idx(x + dx, y + dy); return G.tiles.road[j] || G.tiles.bld[j] || TERRAIN[G.tiles.terrain[j]].pass; };
  const horiz = (link(1, 0) || link(-1, 0)) && !((link(0, 1) || link(0, -1)) && !(link(1, 0) && link(-1, 0)));
  c.fillStyle = 'rgba(0,0,0,0.25)';
  if (horiz) c.fillRect(px, py + 21, 32, 3); else c.fillRect(px + 21, py, 3, 32);
  c.fillStyle = '#9c7a54'; if (horiz) c.fillRect(px, py + 9, 32, 13); else c.fillRect(px + 9, py, 13, 32);
  c.fillStyle = '#7a5c3c'; for (let k = 0; k < 6; k++) { if (horiz) c.fillRect(px + k * 5.4, py + 9, 0.9, 13); else c.fillRect(px + 9, py + k * 5.4, 13, 0.9); }
  c.fillStyle = '#5d4037'; if (horiz) { c.fillRect(px, py + 8, 32, 1.6); c.fillRect(px, py + 21, 32, 1.6); c.fillRect(px + 2, py + 6, 1.6, 4); c.fillRect(px + 28, py + 6, 1.6, 4); } else { c.fillRect(px + 8, py, 1.6, 32); c.fillRect(px + 21, py, 1.6, 32); }
}
function drawToolOverlay(c, x0, y0, x1, y1) {
  const tool = UI.tool, hv = R.hover;
  if (tool.kind === 'claim' || tool.kind === 'army') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tool.kind === 'claim' && canClaim(x, y)) { c.fillStyle = G.res.influence >= claimCost(x, y) ? 'rgba(255,255,255,0.18)' : 'rgba(255,80,80,0.15)'; c.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4); }
      if (tool.kind === 'army') { const o = G.tiles.owner[idx(x, y)]; const f = o > 0 ? fac(o) : null; if (f && f.war) { c.fillStyle = 'rgba(255,60,60,0.15)'; c.fillRect(x * TILE, y * TILE, TILE, TILE); } }
    }
  }
  if (!hv || !inB(hv.x, hv.y)) return;
  const px = hv.x * TILE, py = hv.y * TILE;
  if (tool.kind === 'build') {
    const si = siteInfo(tool.type, hv.x, hv.y);
    const ok = si.ok && canAfford(B[tool.type].cost || {});
    c.globalAlpha = 0.65; drawBuilding(c, { id: 0, type: tool.type, x: hv.x, y: hv.y, level: 1, roof: UI.roofPick || B[tool.type].roof, workers: [] }); c.globalAlpha = 1;
    c.strokeStyle = ok ? '#a5d6a7' : '#ef9a9a'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    const d = B[tool.type];
    if (d.radius || d.appealR > 1) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([3, 4]); c.beginPath(); c.arc(px + 16, py + 16, (d.radius || d.appealR) * TILE, 0, 7); c.stroke(); c.setLineDash([]); }
  } else if (tool.kind === 'terra' && tool.type) {
    const ok = terraformInfo(tool.type, hv.x, hv.y).ok && canAfford(TERRAFORM[tool.type].cost);
    c.strokeStyle = ok ? '#a5d6a7' : '#ef9a9a'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  } else if (tool.kind === 'move' && tool.type && G.buildings[tool.type]) {
    const b = G.buildings[tool.type], si = siteInfo(b.type, hv.x, hv.y, { moving: true });
    c.strokeStyle = '#ffd54f'; c.setLineDash([3, 3]); c.lineWidth = 2; c.strokeRect(b.x * TILE + 1, b.y * TILE + 1, TILE - 2, TILE - 2); c.setLineDash([]);
    if (hv.x !== b.x || hv.y !== b.y) { c.globalAlpha = 0.65; drawBuilding(c, { ...b, id: 0, x: hv.x, y: hv.y, burning: 0 }); c.globalAlpha = 1; }
    c.strokeStyle = si.ok ? '#a5d6a7' : '#ef9a9a'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  } else if (tool.kind === 'road' || tool.kind === 'demolish' || tool.kind === 'move' || tool.kind === 'claim' || tool.kind === 'paint' || tool.kind === 'army') {
    c.strokeStyle = tool.kind === 'demolish' ? '#ef5350' : '#fff'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  }
}
