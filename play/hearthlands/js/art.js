// ===== Art for the ages: town halls, homes, modern buildings, blocks, railways, rival towns =====
function flag(c, x, y, h, col, k) {
  c.fillStyle = '#5d4037'; c.fillRect(x, y, 1.4, h);
  c.fillStyle = col; c.beginPath(); c.moveTo(x + 1.4, y); c.lineTo(x + 9, y + 2.5 + Math.sin(R.t * 4 + (k || 0))); c.lineTo(x + 1.4, y + 5); c.fill();
}
function glassWin(c, x, y, w, h, rows, cols, base) {
  c.fillStyle = base || '#8fb8d4'; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * 0.45, y); c.lineTo(x + w * 0.6, y); c.lineTo(x + w * 0.15, y + h); c.fill();
  c.strokeStyle = 'rgba(30,50,70,0.45)'; c.lineWidth = 0.6; c.beginPath();
  for (let i = 1; i < rows; i++) { c.moveTo(x, y + h * i / rows); c.lineTo(x + w, y + h * i / rows); }
  for (let j = 1; j < cols; j++) { c.moveTo(x + w * j / cols, y); c.lineTo(x + w * j / cols, y + h); }
  c.stroke();
}
function winGrid(c, x, y, w, h, rows, cols, col) {
  c.fillStyle = col || '#7d97a8';
  const ww = w / cols, hh = h / rows;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) c.fillRect(x + j * ww + ww * 0.22, y + i * hh + hh * 0.22, ww * 0.56, hh * 0.56);
}
function dome(c, cx, by, r, col, hi) {
  c.fillStyle = col; c.beginPath(); c.arc(cx, by, r, Math.PI, 0); c.fill();
  c.fillStyle = hi || 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(cx - r * 0.3, by - r * 0.15, r * 0.45, Math.PI * 1.1, Math.PI * 1.6); c.lineTo(cx - r * 0.3, by); c.fill();
}
function columns(c, x, y, w, h, n, col) { c.fillStyle = col || '#fafafa'; for (let i = 0; i < n; i++) c.fillRect(x + i * (w - 2) / (n - 1), y, 2, h); }

// ---------- The Town Hall through the ages (also used for rival capitals) ----------
function drawHall(c, px, py, L, roof, fcol) {
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px - 2, py + 27, 36, 4);
  switch (L) {
    case 1: { // chieftain's longhouse with palisade gate
      c.fillStyle = '#8d6e63'; for (let i = 0; i < 9; i++) { c.fillRect(px - 2 + i * 4.3, py + 21, 3, 9); }
      c.fillStyle = '#a1785a'; c.fillRect(px + 4, py + 12, 24, 12);
      c.fillStyle = '#c9a26b'; c.beginPath(); c.moveTo(px + 1, py + 14); c.lineTo(px + 16, py + 1); c.lineTo(px + 31, py + 14); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(px + 16, py + 2); c.lineTo(px + 4 + i * 6, py + 14); } c.stroke();
      c.fillStyle = '#4e342e'; c.fillRect(px + 14, py + 18, 4, 6);
      c.fillStyle = '#6d4c41'; c.fillRect(px + 2, py + 6, 2, 16); c.fillStyle = '#e65100'; c.beginPath(); c.arc(px + 3, py + 5, 1.6 + Math.sin(R.t * 9) * 0.4, 0, 7); c.fill();
      flag(c, px + 26, py - 6, 14, fcol, 1);
      break;
    }
    case 2: { // town hall
      const w = 26, h = 26;
      c.fillStyle = '#d7ccc8'; c.fillRect(px + 3, py + 30 - h * 0.6, w, h * 0.6);
      c.fillStyle = '#bcaaa4'; for (let i = 0; i < 4; i++) c.fillRect(px + 5 + i * (w - 6) / 3, py + 30 - h * 0.6, 2, h * 0.6);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 1, py + 30 - h * 0.58); c.lineTo(px + 16, py + 30 - h); c.lineTo(px + 31, py + 30 - h * 0.58); c.fill();
      c.fillStyle = '#5d4037'; c.fillRect(px + 13, py + 22, 6, 8);
      win(c, px + 7, py + 21, 3, 4); win(c, px + 22, py + 21, 3, 4);
      c.fillStyle = '#bcaaa4'; c.fillRect(px + 14, py - 2, 4, 8); c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(px + 16, py + 9.7, 2, 0, 7); c.fill();
      flag(c, px + 17, py - 14, 12, fcol);
      break;
    }
    case 3: { // stone keep
      c.fillStyle = '#9e9e9e'; c.fillRect(px - 1, py + 18, 34, 12);
      for (let i = 0; i < 8; i++) c.fillRect(px - 1 + i * 4.6, py + 15, 2.6, 3);
      c.fillStyle = '#b0aaa2'; c.fillRect(px + 7, py - 2, 18, 30);
      c.fillStyle = '#c4beb6'; for (let i = 0; i < 5; i++) c.fillRect(px + 7 + i * 3.9, py - 6, 2.6, 4);
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 9; i++) { c.moveTo(px + 7, py + 1 + i * 3.2); c.lineTo(px + 25, py + 1 + i * 3.2); } c.stroke();
      c.fillStyle = '#263238'; c.fillRect(px + 12, py + 4, 2, 4); c.fillRect(px + 18, py + 4, 2, 4); c.fillRect(px + 15, py + 12, 2, 4);
      c.fillStyle = '#4e342e'; c.beginPath(); c.arc(px + 16, py + 24, 3.5, Math.PI, 0); c.fillRect(px + 12.5, py + 24, 7, 6); c.fill();
      flag(c, px + 16, py - 18, 12, fcol);
      break;
    }
    case 4: { // royal castle: curtain wall, round towers, tall keep
      c.fillStyle = '#a7a199'; c.fillRect(px + 7, py - 6, 18, 28);
      c.fillStyle = '#bdb7ae'; for (let i = 0; i < 5; i++) c.fillRect(px + 7 + i * 3.9, py - 10, 2.6, 4);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 11, py - 10); c.lineTo(px + 16, py - 22); c.lineTo(px + 21, py - 10); c.fill();
      c.fillStyle = '#9e978e'; c.fillRect(px - 4, py + 12, 40, 17);
      for (let i = 0; i < 10; i++) c.fillRect(px - 4 + i * 4.3, py + 9, 2.6, 3);
      for (const tx of [-5, 29]) {
        c.fillStyle = '#b0aaa2'; c.fillRect(px + tx, py + 2, 8, 27);
        c.fillStyle = roof; c.beginPath(); c.moveTo(px + tx - 1, py + 3); c.lineTo(px + tx + 4, py - 8); c.lineTo(px + tx + 9, py + 3); c.fill();
        c.fillStyle = '#263238'; c.fillRect(px + tx + 3, py + 10, 2, 4);
      }
      c.fillStyle = '#3e2723'; c.beginPath(); c.arc(px + 16, py + 23, 4.5, Math.PI, 0); c.fillRect(px + 11.5, py + 23, 9, 6); c.fill();
      c.fillStyle = '#263238'; c.fillRect(px + 12, py + 1, 2, 4); c.fillRect(px + 18, py + 1, 2, 4);
      flag(c, px + 16, py - 32, 11, fcol);
      break;
    }
    case 5: { // grand palace
      c.fillStyle = '#efe6d3'; c.fillRect(px - 6, py + 10, 44, 19);
      c.fillStyle = shade(roof, -10); c.fillRect(px - 7, py + 7, 46, 4);
      winGrid(c, px - 5, py + 12, 42, 12, 2, 10, '#5b7a99');
      c.fillStyle = '#f7f0e0'; c.fillRect(px + 8, py + 2, 16, 27);
      dome(c, px + 16, py + 3, 8, '#7cb342');
      c.fillStyle = '#ffd54f'; c.fillRect(px + 15.3, py - 8, 1.4, 4);
      columns(c, px + 9, py + 13, 14, 12, 4, '#ffffff');
      c.fillStyle = '#5d4037'; c.fillRect(px + 14, py + 23, 4, 6);
      c.fillStyle = '#d7ccc8'; c.fillRect(px - 6, py + 28, 44, 2);
      flag(c, px + 16, py - 18, 10, fcol);
      break;
    }
    case 6: { // capitol: steps, columns, great white dome
      c.fillStyle = '#f5f5f5'; c.fillRect(px - 6, py + 12, 44, 17);
      c.fillStyle = '#e0e0e0'; c.fillRect(px - 8, py + 27, 48, 3); c.fillRect(px - 4, py + 25, 40, 2);
      winGrid(c, px - 5, py + 14, 11, 10, 2, 3, '#90a4ae'); winGrid(c, px + 26, py + 14, 11, 10, 2, 3, '#90a4ae');
      c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(px + 6, py + 12); c.lineTo(px + 16, py + 5); c.lineTo(px + 26, py + 12); c.fill();
      columns(c, px + 7, py + 12, 18, 13, 5, '#ffffff');
      c.fillStyle = '#eeeeee'; c.fillRect(px + 8, py - 4, 16, 9);
      columns(c, px + 8, py - 4, 16, 9, 6, '#d6d6d6');
      dome(c, px + 16, py - 4, 9, '#ffffff', 'rgba(180,200,220,0.5)');
      c.fillStyle = '#fafafa'; c.fillRect(px + 15, py - 18, 2, 6);
      flag(c, px + 16, py - 26, 9, fcol);
      break;
    }
    default: { // grand capitol: glass tower behind a domed hall
      glassWin(c, px + 8, py - 40, 16, 50, 10, 3, '#6fa3c7');
      c.fillStyle = '#cfd8dc'; c.fillRect(px + 8, py - 42, 16, 3);
      c.fillStyle = '#90a4ae'; c.fillRect(px + 15.3, py - 54, 1.4, 12);
      c.fillStyle = Math.sin(R.t * 3) > 0 ? '#ff1744' : '#7f0000'; c.beginPath(); c.arc(px + 16, py - 55, 1.4, 0, 7); c.fill();
      c.fillStyle = '#f5f5f5'; c.fillRect(px - 6, py + 14, 44, 15);
      c.fillStyle = '#e0e0e0'; c.fillRect(px - 8, py + 27, 48, 3);
      columns(c, px - 4, py + 15, 10, 11, 3, '#ffffff'); columns(c, px + 26, py + 15, 10, 11, 3, '#ffffff');
      dome(c, px + 16, py + 14, 10, '#eceff1', 'rgba(120,180,230,0.5)');
      c.fillStyle = '#4e342e'; c.fillRect(px + 14, py + 22, 4, 7);
      flag(c, px + 33, py - 4, 10, fcol);
    }
  }
}

// ---------- Homes, hut → tower block (also used for rival houses) ----------
function drawHome(c, px, py, L, roof, id) {
  switch (L) {
    case 1: // round thatched hut
      shadowAt(c, px + 17, py + 28, 10);
      c.fillStyle = '#c9a26b'; c.beginPath(); c.ellipse(px + 16, py + 23, 9, 6, 0, 0, 7); c.fill(); c.fillRect(px + 7, py + 17, 18, 6);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 4, py + 19); c.quadraticCurveTo(px + 16, py + 23, px + 28, py + 19); c.lineTo(px + 16, py + 4); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(px + 16, py + 5); c.lineTo(px + 8 + i * 5.3, py + 20); } c.stroke();
      c.fillStyle = '#4e342e'; c.beginPath(); c.ellipse(px + 16, py + 26, 2.6, 3.5, 0, Math.PI, 0); c.fillRect(px + 13.4, py + 26, 5.2, 3); c.fill();
      break;
    case 2: // timber cottage
      shadowAt(c, px + 17, py + 29, 12);
      c.fillStyle = '#efe4cc'; c.fillRect(px + 5, py + 16, 22, 13); timber(c, px + 5, py + 16, 22, 13);
      c.fillStyle = '#795548'; c.fillRect(px + 21, py + 6, 3.5, 8); smoke(c, px + 22.5, py + 5, id * 0.37);
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 3, py + 17); c.lineTo(px + 10, py + 7); c.lineTo(px + 22, py + 7); c.lineTo(px + 29, py + 17); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(px + 3, py + 15.5, 26, 1.5);
      c.fillStyle = '#5d4037'; c.fillRect(px + 14, py + 22, 4.5, 7); win(c, px + 8, py + 21, 3.5, 3.5); win(c, px + 21, py + 21, 3.5, 3.5);
      break;
    case 3: // manor
      shadowAt(c, px + 17, py + 30, 14);
      c.fillStyle = '#f5f0e6'; c.fillRect(px + 3, py + 18, 9, 11); c.fillStyle = shade(roof, -15); c.beginPath(); c.moveTo(px + 1.5, py + 19); c.lineTo(px + 7.5, py + 13); c.lineTo(px + 13, py + 19); c.fill();
      c.fillStyle = '#faf6ee'; c.fillRect(px + 10, py + 10, 19, 19);
      c.strokeStyle = '#a1887f'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 10, py + 19.5); c.lineTo(px + 29, py + 19.5); c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 8, py + 11); c.lineTo(px + 19.5, py + 1); c.lineTo(px + 31, py + 11); c.fill();
      c.fillStyle = '#795548'; c.fillRect(px + 25, py + 1, 3, 7); smoke(c, px + 26.5, py, id * 0.29);
      for (const wx of [12.5, 24]) { win(c, px + wx, py + 12.5, 3, 4); win(c, px + wx, py + 22, 3, 4); }
      win(c, px + 5.5, py + 22, 3, 3);
      c.fillStyle = '#5d4037'; c.fillRect(px + 17.5, py + 23, 4, 6);
      break;
    case 4: // brick townhouse
      shadowAt(c, px + 17, py + 30, 12);
      c.fillStyle = '#b5653e'; c.fillRect(px + 7, py + 3, 18, 26);
      c.strokeStyle = 'rgba(0,0,0,0.1)'; c.lineWidth = 0.6; c.beginPath(); for (let i = 0; i < 9; i++) { c.moveTo(px + 7, py + 5 + i * 3); c.lineTo(px + 25, py + 5 + i * 3); } c.stroke();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 5, py + 4); c.lineTo(px + 16, py - 7); c.lineTo(px + 27, py + 4); c.fill();
      c.fillStyle = '#6d4c41'; c.fillRect(px + 21, py - 6, 3, 7); smoke(c, px + 22.5, py - 7, id * 0.31);
      for (const wy of [6, 14]) { win(c, px + 9.5, py + wy, 3.5, 5); win(c, px + 19, py + wy, 3.5, 5); }
      c.fillStyle = '#efe4cc'; c.fillRect(px + 7, py + 21, 18, 1.2);
      c.fillStyle = '#3e2723'; c.fillRect(px + 13.5, py + 22, 5, 7); win(c, px + 8.5, py + 23, 3, 4); win(c, px + 20.5, py + 23, 3, 4);
      break;
    case 5: // three-door brick rowhouse
      shadowAt(c, px + 17, py + 30, 15);
      for (let k = 0; k < 3; k++) {
        const x = px + 1 + k * 10;
        c.fillStyle = k === 1 ? '#a24f35' : '#b8603f'; c.fillRect(x, py + 6, 10, 23);
        c.fillStyle = k === 1 ? shade(roof, -20) : roof; c.beginPath(); c.moveTo(x - 0.5, py + 7); c.lineTo(x + 5, py + 1); c.lineTo(x + 10.5, py + 7); c.fill();
        win(c, x + 2, py + 9, 2.5, 4); win(c, x + 5.8, py + 9, 2.5, 4); win(c, x + 2, py + 16, 2.5, 4); win(c, x + 5.8, py + 16, 2.5, 4);
        c.fillStyle = ['#2e7d32', '#1565c0', '#4e342e'][k]; c.fillRect(x + 3.5, py + 23, 3, 6);
      }
      c.fillStyle = '#6d4c41'; c.fillRect(px + 24, py - 1, 2.5, 6); smoke(c, px + 25, py - 2, id * 0.27);
      break;
    case 6: // concrete apartment block
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 4, py + 27, 28, 4);
      c.fillStyle = '#d6cfc4'; c.fillRect(px + 3, py - 10, 26, 39);
      c.fillStyle = '#bfb6a8'; c.fillRect(px + 3, py - 12, 26, 3); c.fillStyle = '#90a4ae'; c.fillRect(px + 20, py - 18, 6, 6);
      winGrid(c, px + 4, py - 8, 24, 30, 5, 4, '#7895a8');
      c.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 5; i++) c.fillRect(px + 3, py - 3 + i * 6, 26, 0.8);
      c.fillStyle = '#455a64'; c.fillRect(px + 13, py + 23, 6, 6);
      c.fillStyle = roof; c.fillRect(px + 12, py + 22, 8, 1.5);
      break;
    default: // glass tower block
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 6, py + 27, 24, 4);
      glassWin(c, px + 6, py - 34, 20, 58, 12, 4, '#7fa7c4');
      c.fillStyle = shade(roof, 10); c.fillRect(px + 6, py - 36, 20, 3);
      c.fillStyle = '#90a4ae'; c.fillRect(px + 20, py - 44, 1.2, 8);
      c.fillStyle = Math.sin(R.t * 2 + id) > 0 ? '#ff5252' : '#8a1c1c'; c.beginPath(); c.arc(px + 20.6, py - 44.5, 1.1, 0, 7); c.fill();
      c.fillStyle = '#37474f'; c.fillRect(px + 5, py + 22, 22, 7); c.fillStyle = '#b3e5fc'; c.fillRect(px + 13, py + 23, 6, 6);
  }
}

// ---------- Building blocks: Minecraft-style tiles that merge with their neighbours ----------
function drawBlock(c, b, px, py, d) {
  const same = (dx, dy) => { const o = bAt(b.x + dx, b.y + dy); return o && o.type === b.type; };
  c.fillStyle = d.block; c.fillRect(px, py, 32, 32);
  if (d.brick) { c.fillStyle = 'rgba(255,255,255,0.18)'; for (let r = 0; r < 4; r++) { c.fillRect(px, py + r * 8 + 7, 32, 1); for (let k = 0; k < 4; k++) c.fillRect(px + ((k * 8 + (r % 2) * 4) % 32), py + r * 8, 1, 7); } }
  else if (b.type === 'blk_wood') { c.fillStyle = 'rgba(0,0,0,0.16)'; for (let r = 0; r < 4; r++) { c.fillRect(px, py + r * 8 + 7, 32, 1); c.fillRect(px + ((r * 13) % 28) + 2, py + r * 8, 1, 7); } }
  else if (d.glass) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(px + 4, py + 28); c.lineTo(px + 18, py + 4); c.lineTo(px + 23, py + 4); c.lineTo(px + 9, py + 28); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.strokeRect(px + 1.5, py + 1.5, 29, 29); }
  else if (d.neon) { const g = 0.55 + Math.sin(R.t * 3 + b.x + b.y) * 0.3; c.fillStyle = '#2a0f35'; c.fillRect(px + 3, py + 3, 26, 26); c.strokeStyle = `rgba(234,128,252,${g})`; c.lineWidth = 3; c.strokeRect(px + 5, py + 5, 22, 22); }
  else if (b.type === 'blk_gold') { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(px + 5, py + 5, 8, 3); c.fillRect(px + 5, py + 5, 3, 8); c.fillStyle = 'rgba(160,110,0,0.35)'; c.fillRect(px + 20, py + 24, 8, 3); }
  else { for (let k = 0; k < 7; k++) { c.fillStyle = hashf(b.x, b.y, k) > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; c.fillRect(px + hashf(b.x, b.y, k + 9) * 26 + 2, py + hashf(b.x, b.y, k + 19) * 26 + 2, 4, 3); } }
  if (!same(0, -1)) { c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(px, py, 32, 3); }
  if (!same(-1, 0)) { c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(px, py, 3, 32); }
  if (!same(0, 1)) { c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(px, py + 29, 32, 3); }
  if (!same(1, 0)) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 29, py, 3, 32); }
}

// ---------- Upgrades: every level visibly changes a building ----------
// Each level makes the building a little bigger, paves a better yard around it, and adds a new
// piece: a haystack, a shed, a silo, a smokestack, a crane, a glass annex...
const LEVEL_PROPS = {
  farm: ['hay', 'pen', 'silo', 'tractor'], fishery: ['barrels', 'boat', 'stack', 'crane'], hunter: ['pen', 'shed', 'annex', 'truck'],
  granary: ['cart', 'annex', 'elevator', 'glass'], harbor: ['crates', 'crane', 'containers'], hydrofarm: ['glass', 'solar'],
  lumber: ['logs', 'wheel', 'stack', 'crane'], quarry: ['blocks', 'cart', 'stack', 'truck'], mine: ['cart', 'headframe', 'stack', 'truck'],
  coalmine: ['headframe', 'truck'], workshop: ['barrels', 'annex', 'stack', 'glass'], factory: ['stack', 'containers'], warehouse: ['crates', 'cart', 'crane', 'containers'],
  powerplant: ['stack', 'pylon'], tavern: ['barrels', 'umbrellas', 'lamps', 'glass'], temple: ['tree', 'bell', 'dome'], library: ['tree', 'annex', 'dome', 'dish'],
  amphitheater: ['banners', 'lamps'], market: ['cart', 'banners', 'lamps', 'glass'], guildhall: ['banners', 'annex'], university: ['tree', 'dome'], bank: ['lamps', 'banners'],
  healer: ['herbs', 'annex'], barracks: ['banners', 'tower', 'annex', 'dish'], watchtower: ['banners', 'lamps', 'annex', 'dish'], researchlab: ['dish', 'pylon'],
  hospital: ['lamps', 'glass'], stadium: ['lamps', 'banners'], office: ['solar', 'dish'], datacenter: ['solar', 'dish'],
};
const PROPS_BY_CAT = { food: ['hay', 'cart', 'silo', 'truck'], industry: ['crates', 'annex', 'stack', 'truck'], civic: ['tree', 'annex', 'banners', 'glass'], military: ['banners', 'tower', 'annex', 'dish'] };
function levelScale(b) { const d = B[b.type]; return d.maxLevel > 1 && !d.housing && !d.block && b.type !== 'townhall' && b.type !== 'cityhall' ? 1 + 0.07 * (b.level - 1) : 1; }
// the yard: trampled earth, then cobbles, brick paving, and finally a concrete plaza
function levelGround(c, b, px, py, L) {
  if (L < 2 || B[b.type].housing || b.type === 'townhall' || B[b.type].block) return;
  const col = ['', '#a1866a', '#a39e95', '#b5735a', '#c4c2bd'][Math.min(4, L - 1)];
  c.fillStyle = col; rrect(c, px - 1.5, py + 0.5, 35, 32.5, 4); c.fill();
  if (L === 3) { c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 9; i++) c.fillRect(px - 1 + i * 4, py + 30 + (i % 2), 2.5, 1.6); }
  if (L === 4) { c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.6; c.beginPath(); for (let i = 0; i < 9; i++) { c.moveTo(px - 1 + i * 4, py + 29); c.lineTo(px - 1 + i * 4, py + 33); } c.moveTo(px - 1.5, py + 31); c.lineTo(px + 33.5, py + 31); c.stroke(); }
  if (L >= 5) { c.strokeStyle = 'rgba(0,0,0,0.1)'; c.lineWidth = 0.6; c.strokeRect(px - 1, py + 1, 34, 31.5); }
}
const PROP_SLOTS = [[-5, 33], [-5, 15], [24, 10], [11, 0]]; // left-bottom, left-top, right-top, top-centre (prop's base point)
function levelArt(c, b, px, py, L) {
  if (L < 2 || b.type === 'townhall' || b.type === 'cityhall' || B[b.type].housing) return;
  const d = B[b.type], list = LEVEL_PROPS[b.type] || PROPS_BY_CAT[d.cat] || PROPS_BY_CAT.civic;
  const roof = b.roof || d.roof || '#8e3b2e';
  for (let l = 2; l <= L; l++) { const p = list[l - 2]; if (!p) continue; const [sx, sy] = PROP_SLOTS[l - 2]; c.save(); c.translate(px + sx, py + sy); c.scale(1.35, 1.35); drawProp(c, p, 0, 0, roof, b); c.restore(); }
}
function drawProp(c, p, x, y, roof, b) {
  const id = b.id || 0;
  switch (p) {
    case 'hay': c.fillStyle = '#e0b84a'; c.beginPath(); c.arc(x + 5, y - 3, 4.5, Math.PI, 0); c.fill(); c.fillStyle = '#c99a2e'; c.fillRect(x + 0.5, y - 3, 9, 3); c.strokeStyle = 'rgba(120,80,20,0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 2, y - 4); c.lineTo(x + 8, y - 4); c.stroke(); break;
    case 'pen': c.strokeStyle = '#8d6e63'; c.lineWidth = 0.8; c.strokeRect(x - 1, y - 9, 10, 8); c.fillStyle = '#fafafa'; c.beginPath(); c.ellipse(x + 3, y - 5, 2.4, 1.6, 0, 0, 7); c.fill(); c.fillStyle = '#5d4037'; c.beginPath(); c.ellipse(x + 6.5, y - 3.5, 2.4, 1.6, 0, 0, 7); c.fill(); c.fillStyle = '#212121'; c.fillRect(x + 4.6, y - 6, 1.2, 1.2); c.fillRect(x + 8.4, y - 4.5, 1.2, 1.2); break;
    case 'silo': c.fillStyle = '#cfd8dc'; c.fillRect(x, y - 18, 7, 22); c.beginPath(); c.arc(x + 3.5, y - 18, 3.5, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(x + 4.5, y - 18, 2.5, 22); c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.5; c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(x, y - 18 + i * 4.4); c.lineTo(x + 7, y - 18 + i * 4.4); } c.stroke(); break;
    case 'tractor': c.fillStyle = '#2e7d32'; c.fillRect(x + 2, y - 7, 7, 4); c.fillRect(x + 6, y - 11, 3.5, 4); c.fillStyle = '#b3e5fc'; c.fillRect(x + 6.6, y - 10.4, 2.3, 2); c.fillStyle = '#212121'; c.beginPath(); c.arc(x + 3.5, y - 2.5, 2.4, 0, 7); c.arc(x + 9, y - 2.5, 1.6, 0, 7); c.fill(); c.fillStyle = '#9e9e9e'; c.fillRect(x + 3, y - 11, 0.9, 4); break;
    case 'barrels': for (let i = 0; i < 3; i++) { const bx = x + 1 + (i % 2) * 4.5 + (i > 1 ? 2.2 : 0), by = y - 3 - (i > 1 ? 4.5 : 0); c.fillStyle = '#8d6e63'; c.beginPath(); c.ellipse(bx + 2, by, 2.2, 2.8, 0, 0, 7); c.fill(); c.fillStyle = '#4e342e'; c.fillRect(bx, by - 0.4, 4.2, 0.8); } break;
    case 'boat': { const t = Math.sin(R.t * 1.4 + id) * 0.7; c.fillStyle = '#795548'; c.beginPath(); c.ellipse(x + 5, y - 3 + t, 6, 2.2, 0, 0, Math.PI); c.fill(); c.fillRect(x - 1, y - 4.5 + t, 12, 1.5); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x + 5, y - 13 + t); c.lineTo(x + 10, y - 5 + t); c.lineTo(x + 5, y - 5 + t); c.fill(); c.fillStyle = '#5d4037'; c.fillRect(x + 4.5, y - 13 + t, 0.9, 9); break; }
    case 'stack': c.fillStyle = '#8d4f3a'; c.fillRect(x + 1, y - 20, 4.5, 24); c.fillStyle = '#5d3426'; c.fillRect(x + 0.4, y - 21, 5.7, 2); c.fillStyle = '#e0e0e0'; c.fillRect(x + 1, y - 14, 4.5, 1.2); smoke(c, x + 3.2, y - 22, id * 0.21); smoke(c, x + 3.2, y - 22, id * 0.21 + 0.5); break;
    case 'crane': c.strokeStyle = '#f9a825'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x + 3, y + 2); c.lineTo(x + 3, y - 20); c.lineTo(x - 9, y - 17); c.moveTo(x + 3, y - 20); c.lineTo(x + 7, y - 18); c.stroke(); c.strokeStyle = '#424242'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x - 8, y - 17); c.lineTo(x - 8, y - 9 + Math.sin(R.t + id) * 2); c.stroke(); c.fillStyle = '#ff7043'; c.fillRect(x - 10, y - 9 + Math.sin(R.t + id) * 2, 4, 3); break;
    case 'shed': c.fillStyle = '#a1887f'; c.fillRect(x, y - 8, 9, 8); c.fillStyle = shade(roof, -15); c.beginPath(); c.moveTo(x - 1, y - 7.5); c.lineTo(x + 4.5, y - 12); c.lineTo(x + 10, y - 7.5); c.fill(); c.fillStyle = '#4e342e'; c.fillRect(x + 3, y - 4.5, 3, 4.5); break;
    case 'annex': c.fillStyle = '#e8dcc8'; c.fillRect(x, y - 10, 10, 10); c.fillStyle = roof; c.beginPath(); c.moveTo(x - 1, y - 9.5); c.lineTo(x + 5, y - 15); c.lineTo(x + 11, y - 9.5); c.fill(); win(c, x + 2, y - 7, 2.4, 2.6); win(c, x + 6, y - 7, 2.4, 2.6); break;
    case 'truck': c.fillStyle = '#f57c00'; c.fillRect(x, y - 8, 8, 5); c.fillStyle = '#455a64'; c.fillRect(x + 8, y - 7, 4, 4); c.fillStyle = '#b3e5fc'; c.fillRect(x + 9.6, y - 6.4, 2, 1.8); c.fillStyle = '#212121'; c.beginPath(); c.arc(x + 2.5, y - 2.5, 1.5, 0, 7); c.arc(x + 9.5, y - 2.5, 1.5, 0, 7); c.fill(); break;
    case 'elevator': c.fillStyle = '#bdbdbd'; c.fillRect(x + 1, y - 26, 7, 30); c.fillStyle = '#9e9e9e'; c.fillRect(x - 1, y - 29, 11, 4); c.fillStyle = shade(roof, -10); c.fillRect(x - 1, y - 30, 11, 1.5); winGrid(c, x + 1, y - 22, 7, 20, 4, 1, '#78909c'); break;
    case 'glass': glassWin(c, x, y - 12, 10, 12, 3, 2); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(x, y - 12.5, 10, 0.8); break;
    case 'solar': c.fillStyle = '#90a4ae'; c.fillRect(x + 3, y - 4, 1, 4); c.save(); c.translate(x + 4, y - 6); c.rotate(-0.3); c.fillStyle = '#1a237e'; c.fillRect(-5, -3, 10, 5); c.strokeStyle = 'rgba(144,202,249,0.7)'; c.lineWidth = 0.4; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(-5 + i * 2.5, -3); c.lineTo(-5 + i * 2.5, 2); } c.moveTo(-5, -0.5); c.lineTo(5, -0.5); c.stroke(); c.restore(); break;
    case 'crates': for (const [cx, cy] of [[0, -5], [5, -5], [2.5, -10]]) { c.fillStyle = '#c8a165'; c.fillRect(x + cx, y + cy, 5, 5); c.strokeStyle = '#7b5a33'; c.lineWidth = 0.6; c.strokeRect(x + cx + 0.3, y + cy + 0.3, 4.4, 4.4); c.beginPath(); c.moveTo(x + cx, y + cy); c.lineTo(x + cx + 5, y + cy + 5); c.stroke(); } break;
    case 'containers': for (const [cx, cy, col] of [[0, -5, '#1e88e5'], [0, -10, '#e53935'], [6, -5, '#43a047']]) { c.fillStyle = col; c.fillRect(x + cx - 2, y + cy, 8, 5); c.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 4; i++) c.fillRect(x + cx - 1.4 + i * 2, y + cy + 0.5, 0.5, 4); } break;
    case 'logs': for (let i = 0; i < 6; i++) { const lx = x + 1.5 + (i % 3) * 3.4 + (i > 2 ? 1.7 : 0), ly = y - 2 - (i > 2 ? 3 : 0); c.fillStyle = '#8d6e63'; c.beginPath(); c.arc(lx, ly, 1.9, 0, 7); c.fill(); c.fillStyle = '#e0c9a6'; c.beginPath(); c.arc(lx, ly, 0.9, 0, 7); c.fill(); } break;
    case 'wheel': { c.fillStyle = '#795548'; c.fillRect(x, y - 9, 3, 9); c.save(); c.translate(x + 6, y - 6); c.rotate(R.t * 1.5 + id); c.strokeStyle = '#6d4c41'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 5, 0, 7); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(-Math.cos(a) * 5, -Math.sin(a) * 5); } c.stroke(); c.restore(); c.fillStyle = 'rgba(79,195,247,0.6)'; c.fillRect(x + 1, y - 1, 11, 1.5); break; }
    case 'blocks': for (const [cx, cy] of [[0, -4], [4.5, -4], [2, -8]]) { c.fillStyle = '#e0ddd5'; c.fillRect(x + cx, y + cy, 4.5, 4); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + cx, y + cy + 3, 4.5, 1); } break;
    case 'cart': c.fillStyle = '#8d6e63'; c.fillRect(x, y - 7, 9, 4); c.fillStyle = '#6d4c41'; c.fillRect(x + 9, y - 6, 3, 0.8); c.fillStyle = b.type === 'mine' || b.type === 'coalmine' ? '#424242' : '#c0ca33'; c.beginPath(); c.arc(x + 3, y - 7, 1.8, Math.PI, 0); c.arc(x + 6.5, y - 7, 1.8, Math.PI, 0); c.fill(); c.fillStyle = '#4e342e'; c.beginPath(); c.arc(x + 2.5, y - 2.5, 1.7, 0, 7); c.arc(x + 7, y - 2.5, 1.7, 0, 7); c.fill(); break;
    case 'headframe': c.strokeStyle = '#5d4037'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + 4, y - 18); c.lineTo(x + 8, y + 2); c.moveTo(x + 1.5, y - 6); c.lineTo(x + 6.5, y - 6); c.stroke(); c.save(); c.translate(x + 4, y - 18); c.rotate(R.t * 2 + id); c.strokeStyle = '#424242'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.moveTo(-3, 0); c.lineTo(3, 0); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke(); c.restore(); break;
    case 'pylon': c.strokeStyle = '#78909c'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + 4, y - 20); c.lineTo(x + 8, y + 2); c.moveTo(x - 1, y - 14); c.lineTo(x + 9, y - 14); c.moveTo(x + 0.5, y - 9); c.lineTo(x + 7.5, y - 9); c.moveTo(x + 1.5, y - 4); c.lineTo(x + 6.5, y + 2); c.moveTo(x + 6.5, y - 4); c.lineTo(x + 1.5, y + 2); c.stroke(); break;
    case 'umbrellas': for (const [cx, col] of [[0, '#e53935'], [6, '#1e88e5']]) { c.fillStyle = '#5d4037'; c.fillRect(x + cx + 2.5, y - 6, 0.8, 6); c.fillStyle = col; c.beginPath(); c.arc(x + cx + 3, y - 6, 3.6, Math.PI, 0); c.fill(); c.fillStyle = '#d7ccc8'; c.fillRect(x + cx + 1, y - 2, 4, 1); } break;
    case 'lamps': for (const cx of [0, 8]) { c.fillStyle = '#37474f'; c.fillRect(x + cx + 1, y - 12, 1, 12); c.fillRect(x + cx, y - 13, 3, 1.2); c.fillStyle = '#ffe082'; c.beginPath(); c.arc(x + cx + 1.5, y - 11.5, 1.2, 0, 7); c.fill(); } break;
    case 'tree': c.fillStyle = '#6d4c41'; c.fillRect(x + 3.5, y - 5, 1.6, 5); c.fillStyle = '#43a047'; c.beginPath(); c.arc(x + 4.3, y - 8, 4.5, 0, 7); c.fill(); c.fillStyle = '#66bb6a'; c.beginPath(); c.arc(x + 3, y - 9.5, 2, 0, 7); c.fill(); break;
    case 'herbs': c.fillStyle = '#6d4c41'; c.fillRect(x, y - 5, 10, 5); for (let i = 0; i < 6; i++) { c.fillStyle = ['#66bb6a', '#ab47bc', '#9ccc65'][i % 3]; c.beginPath(); c.arc(x + 1.6 + (i % 3) * 3.3, y - 3.6 + (i > 2 ? 2 : 0), 1.2, 0, 7); c.fill(); } break;
    case 'bell': c.fillStyle = '#e0d6c8'; c.fillRect(x + 1, y - 18, 7, 20); c.fillStyle = shade(roof, -10); c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 4.5, y - 25); c.lineTo(x + 9, y - 18); c.fill(); c.fillStyle = '#ffb300'; c.beginPath(); c.arc(x + 4.5, y - 13, 2, Math.PI, 0); c.fill(); c.fillRect(x + 2.5, y - 13, 4, 1); break;
    case 'dome': dome(c, x + 2, y - 2, 6, '#90a4ae', '#cfd8dc'); c.fillStyle = '#ffd54f'; c.fillRect(x + 1.5, y - 11, 1, 3); break;
    case 'dish': c.fillStyle = '#90a4ae'; c.fillRect(x + 3.5, y - 6, 1.2, 6); c.fillStyle = '#eceff1'; c.beginPath(); c.ellipse(x + 4, y - 8, 4.5, 2.6, -0.5, 0, 7); c.fill(); c.strokeStyle = '#90a4ae'; c.lineWidth = 0.6; c.stroke(); c.fillStyle = '#e53935'; c.fillRect(x + 3.6, y - 10, 1, 1); break;
    case 'tower': c.fillStyle = '#9e9890'; c.fillRect(x, y - 18, 8, 20); c.fillStyle = '#b5afa6'; for (let i = 0; i < 3; i++) c.fillRect(x - 0.5 + i * 3.2, y - 21, 2.2, 3); c.fillStyle = '#3e2723'; c.fillRect(x + 3, y - 12, 2, 3); break;
    case 'banners': for (const cx of [0, 7]) { c.fillStyle = '#5d4037'; c.fillRect(x + cx, y - 14, 1, 14); c.fillStyle = cx ? roof : G.realm.color; c.fillRect(x + cx + 1, y - 13.5, 4, 6); c.beginPath(); c.moveTo(x + cx + 1, y - 7.5); c.lineTo(x + cx + 3, y - 6); c.lineTo(x + cx + 5, y - 7.5); c.fill(); } break;
  }
}

// ---------- New buildings of the later ages ----------
function drawNewBuilding(c, b, px, py, L, roof) {
  const d = B[b.type];
  if (b.type === 'colony') { drawColony(c, b, px, py, L, roof); return true; }
  switch (b.type) {
    case 'windmill': {
      shadowAt(c, px + 17, py + 29, 9);
      c.fillStyle = '#e0d6c8'; c.beginPath(); c.moveTo(px + 10, py + 29); c.lineTo(px + 12, py + 10); c.lineTo(px + 20, py + 10); c.lineTo(px + 22, py + 29); c.fill();
      c.fillStyle = roof; c.beginPath(); c.moveTo(px + 10, py + 11); c.lineTo(px + 16, py + 3); c.lineTo(px + 22, py + 11); c.fill();
      c.fillStyle = '#5d4037'; c.fillRect(px + 14.5, py + 23, 3, 6); win(c, px + 15, py + 15, 2, 3);
      c.save(); c.translate(px + 16, py + 9); c.rotate(R.t * 1.2 + b.id); c.fillStyle = '#f5f0e6'; c.strokeStyle = '#6d4c41'; c.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillRect(-1.6, -15, 3.2, 12); c.strokeRect(-1.6, -15, 3.2, 12); }
      c.restore(); c.fillStyle = '#6d4c41'; c.beginPath(); c.arc(px + 16, py + 9, 1.5, 0, 7); c.fill();
      return true;
    }
    case 'harbor': {
      const [wx, wy] = waterSide(b);
      c.fillStyle = '#a8a29a'; c.fillRect(px + 1, py + 3, 30, 27);
      c.fillStyle = '#8d8378'; c.fillRect(px + 1 + (wx > 0 ? 26 : 0), py + 3, wx ? 4 : 30, wx ? 27 : 0);
      c.fillStyle = '#a1887f'; c.fillRect(px + 3, py + 14, 14, 14); c.fillStyle = roof; c.fillRect(px + 2, py + 12, 16, 3);
      for (const [cx, cy, col] of [[4, 6, '#e53935'], [10, 6, '#1e88e5'], [4, 9.5, '#43a047']]) { c.fillStyle = col; c.fillRect(px + cx, py + cy, 5.5, 3.2); }
      c.strokeStyle = '#f9a825'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px + 24, py + 28); c.lineTo(px + 24, py + 2); c.lineTo(px + 24 + wx * 10 + (wx ? 0 : 8), py + 4 + wy * 4); c.stroke();
      const bx = px + 16 + wx * 26, by = py + 16 + wy * 24 + Math.sin(R.t * 1.2 + b.id) * 0.8;
      c.fillStyle = '#5d4037'; c.beginPath(); c.moveTo(bx - 9, by); c.lineTo(bx + 9, by); c.lineTo(bx + 6, by + 5); c.lineTo(bx - 6, by + 5); c.fill();
      if (L >= 3) { c.fillStyle = '#eceff1'; c.fillRect(bx - 4, by - 5, 8, 5); c.fillStyle = '#e53935'; c.fillRect(bx + 1, by - 9, 2, 4); }
      else { c.fillStyle = '#4e342e'; c.fillRect(bx - 0.6, by - 13, 1.2, 13); c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(bx + 0.6, by - 13); c.lineTo(bx + 7, by - 1); c.lineTo(bx + 0.6, by - 1); c.fill(); }
      return true;
    }
    case 'hydrofarm':
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 5, py + 27, 26, 4);
      c.fillStyle = '#eceff1'; c.fillRect(px + 4, py - 8, 24, 37);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#66bb6a' : '#81c784'; c.fillRect(px + 5, py - 6 + i * 5.6, 22, 3.4); c.fillStyle = `rgba(186,104,200,${0.35 + 0.15 * Math.sin(R.t * 2 + i)})`; c.fillRect(px + 5, py - 6.8 + i * 5.6, 22, 0.8); }
      c.fillStyle = roof; c.fillRect(px + 4, py - 10, 24, 2.5); c.fillStyle = '#37474f'; c.fillRect(px + 13, py + 24, 6, 5);
      return true;
    case 'coalmine': {
      c.fillStyle = '#4e4a46'; c.beginPath(); c.moveTo(px, py + 30); c.quadraticCurveTo(px + 6, py + 10, px + 14, py + 9); c.lineTo(px + 18, py + 30); c.fill();
      c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(px + 9, py + 23, 4, Math.PI, 0); c.fillRect(px + 5, py + 23, 8, 6); c.fill();
      c.strokeStyle = '#5d4037'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 18, py + 29); c.lineTo(px + 23, py + 3); c.lineTo(px + 28, py + 29); c.moveTo(px + 20, py + 18); c.lineTo(px + 26, py + 18); c.stroke();
      c.strokeStyle = '#37474f'; c.lineWidth = 1.2; c.beginPath(); c.arc(px + 23, py + 4, 3, 0, 7); c.stroke();
      c.save(); c.translate(px + 23, py + 4); c.rotate(R.t * (b.workers.length ? 3 : 0)); c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke(); c.restore();
      c.fillStyle = '#111'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(px + 22 + (i % 3) * 3, py + 28 - (i > 2 ? 2.5 : 0), 2, 0, 7); c.fill(); }
      return true;
    }
    case 'factory': {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 2, py + 27, 30, 4);
      c.fillStyle = '#a5503a'; c.fillRect(px + 1, py + 12, 30, 17);
      c.fillStyle = roof; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px + 1 + i * 7.5, py + 12); c.lineTo(px + 1 + i * 7.5, py + 6); c.lineTo(px + 8.5 + i * 7.5, py + 12); c.fill(); }
      c.fillStyle = '#b3e5fc'; for (let i = 0; i < 4; i++) c.fillRect(px + 1.5 + i * 7.5, py + 7, 1.5, 4.5);
      winGrid(c, px + 2, py + 15, 28, 6, 1, 6, '#ffcc80');
      c.fillStyle = '#3e2723'; c.fillRect(px + 12, py + 22, 8, 7);
      for (const sx of [4, 25]) { c.fillStyle = '#7b3f2e'; c.fillRect(px + sx, py - 10, 3.5, 22); c.fillStyle = '#eee'; c.fillRect(px + sx, py - 6, 3.5, 1.2); if (b.workers.length) { smoke(c, px + sx + 1.7, py - 11, b.id * 0.3 + sx); smoke(c, px + sx + 1.7, py - 11, b.id * 0.3 + sx + 0.5); } }
      return true;
    }
    case 'powerplant': {
      c.fillStyle = '#90a4ae'; c.fillRect(px + 1, py + 15, 15, 14); c.fillStyle = roof; c.fillRect(px, py + 13, 17, 3);
      c.fillStyle = '#ffeb3b'; c.beginPath(); c.moveTo(px + 9, py + 17); c.lineTo(px + 6, py + 23); c.lineTo(px + 9, py + 23); c.lineTo(px + 7, py + 28); c.lineTo(px + 12, py + 21); c.lineTo(px + 9, py + 21); c.fill();
      const tw = (x, h) => { c.fillStyle = '#cfd8dc'; c.beginPath(); c.moveTo(x - 6, py + 29); c.quadraticCurveTo(x - 2.5, py + 29 - h * 0.55, x - 4, py + 29 - h); c.lineTo(x + 4, py + 29 - h); c.quadraticCurveTo(x + 2.5, py + 29 - h * 0.55, x + 6, py + 29); c.fill(); c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(x + 1, py + 29 - h, 3, h); };
      tw(px + 24, 24 + L * 2);
      if (!b.starved && b.workers.length) for (let k = 0; k < 3; k++) { const t = (R.t * 0.4 + k / 3) % 1; c.fillStyle = `rgba(245,245,245,${0.7 - t * 0.6})`; c.beginPath(); c.arc(px + 24 + t * 4, py + 5 - L * 2 - t * 14, 3 + t * 4, 0, 7); c.fill(); }
      return true;
    }
    case 'windturbine': {
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(px + 17, py + 28, 5, 2, 0, 0, 7); c.fill();
      c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 15, py + 28); c.lineTo(px + 15.8, py - 12); c.lineTo(px + 16.8, py - 12); c.lineTo(px + 17.6, py + 28); c.fill();
      c.fillStyle = '#cfd8dc'; c.fillRect(px + 14, py - 14, 5, 3);
      c.save(); c.translate(px + 16.5, py - 12.5); c.rotate(R.t * 2.4 + b.id); c.fillStyle = '#fafafa';
      for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.moveTo(-1, 0); c.lineTo(0, -17); c.lineTo(1.4, 0); c.fill(); }
      c.restore();
      return true;
    }
    case 'solarfarm':
      c.fillStyle = 'rgba(120,140,90,0.4)'; c.fillRect(px + 1, py + 1, 30, 30);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { const x = px + 2 + k * 15, y = py + 3 + r * 9.5; c.fillStyle = '#1a237e'; c.beginPath(); c.moveTo(x, y + 7); c.lineTo(x + 2, y); c.lineTo(x + 14, y); c.lineTo(x + 12, y + 7); c.fill(); c.strokeStyle = 'rgba(144,202,249,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 5, y + 7); c.lineTo(x + 6.5, y); c.moveTo(x + 9, y + 7); c.lineTo(x + 10.5, y); c.moveTo(x + 1, y + 3.5); c.lineTo(x + 13, y + 3.5); c.stroke(); }
      return true;
    case 'aqueduct': {
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(px, py + 27, 32, 3);
      c.fillStyle = '#d7ccc8'; c.fillRect(px, py + 8, 32, 20);
      c.fillStyle = 'rgba(80,110,60,0.6)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(px + 5.5 + k * 10.5, py + 28, 4, Math.PI, 0); c.fillRect(px + 1.5 + k * 10.5, py + 28, 8, 1); c.fill(); }
      c.fillStyle = '#bcaaa4'; c.fillRect(px, py + 6, 32, 3); c.fillStyle = '#4fc3f7'; c.fillRect(px, py + 7, 32, 1.3);
      return true;
    }
    case 'amphitheater':
      for (let k = 0; k < 4; k++) { c.strokeStyle = k % 2 ? '#d7ccc8' : '#bcaaa4'; c.lineWidth = 3; c.beginPath(); c.arc(px + 16, py + 26, 14 - k * 3.2, Math.PI, 0); c.stroke(); }
      c.fillStyle = shade(roof, 10); c.fillRect(px + 9, py + 24, 14, 5); c.fillStyle = '#5d4037'; c.fillRect(px + 9, py + 23, 14, 1.2);
      c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(px + 13 + Math.sin(R.t * 2) * 2, py + 22, 1.2, 0, 7); c.fill(); c.fillStyle = '#e91e63'; c.beginPath(); c.arc(px + 19, py + 22, 1.2, 0, 7); c.fill();
      return true;
    case 'guildhall':
      shadowAt(c, px + 17, py + 30, 13);
      c.fillStyle = '#efe4cc'; c.fillRect(px + 5, py + 6, 22, 23); timber(c, px + 5, py + 6, 22, 11); timber(c, px + 5, py + 17, 22, 12);
      c.fillStyle = roof; for (let i = 0; i < 4; i++) c.fillRect(px + 7 + i * 2.5, py - 1 + i * 0, 18 - i * 5, 2.4); c.beginPath(); c.moveTo(px + 4, py + 7); c.lineTo(px + 16, py - 5); c.lineTo(px + 28, py + 7); c.fill();
      win(c, px + 9, py + 9, 3, 4); win(c, px + 20, py + 9, 3, 4); c.fillStyle = '#4e342e'; c.fillRect(px + 13.5, py + 21, 5, 8);
      c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(px + 29, py + 15, 2.2, 0, 7); c.fill(); c.fillStyle = '#5d4037'; c.fillRect(px + 27, py + 12, 4, 0.9);
      return true;
    case 'university':
      c.fillStyle = 'rgba(102,187,106,0.45)'; c.fillRect(px, py + 22, 32, 8);
      c.fillStyle = '#b5653e'; c.fillRect(px + 1, py + 10, 30, 14);
      winGrid(c, px + 2, py + 12, 28, 8, 2, 6, '#cfd8dc');
      c.fillStyle = roof; c.fillRect(px, py + 8, 32, 3);
      c.fillStyle = '#a24f35'; c.fillRect(px + 12, py - 6, 8, 16); c.fillStyle = roof; c.beginPath(); c.moveTo(px + 11, py - 6); c.lineTo(px + 16, py - 13); c.lineTo(px + 21, py - 6); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px + 16, py - 1, 2.3, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(px + 16, py - 1); c.lineTo(px + 16, py - 2.8); c.moveTo(px + 16, py - 1); c.lineTo(px + 17.3, py - 1); c.stroke();
      c.fillStyle = '#3e2723'; c.fillRect(px + 14, py + 18, 4, 6);
      return true;
    case 'bank':
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(px + 2, py + 28, 30, 3);
      c.fillStyle = '#eeeae2'; c.fillRect(px + 3, py + 12, 26, 17); c.fillStyle = '#d6d1c7'; c.fillRect(px + 1, py + 27, 30, 2);
      c.fillStyle = '#f5f2ea'; c.beginPath(); c.moveTo(px + 1, py + 12); c.lineTo(px + 16, py + 3); c.lineTo(px + 31, py + 12); c.fill(); c.strokeStyle = '#bdb6aa'; c.lineWidth = 0.8; c.stroke();
      columns(c, px + 4, py + 13, 24, 13, 6, '#ffffff');
      c.fillStyle = '#ffc107'; c.beginPath(); c.arc(px + 16, py + 8.5, 2.2, 0, 7); c.fill();
      c.fillStyle = '#4e342e'; c.fillRect(px + 14, py + 20, 4, 7);
      return true;
    case 'firestation':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 2, py + 27, 30, 4);
      c.fillStyle = '#c0392b'; c.fillRect(px + 1, py + 10, 22, 19); c.fillStyle = '#922b21'; c.fillRect(px, py + 8, 24, 3);
      c.fillStyle = '#eceff1'; c.fillRect(px + 3, py + 17, 8, 12); c.fillRect(px + 13, py + 17, 8, 12);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.5; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(px + 3, py + 17 + i * 3); c.lineTo(px + 11, py + 17 + i * 3); c.moveTo(px + 13, py + 17 + i * 3); c.lineTo(px + 21, py + 17 + i * 3); } c.stroke();
      c.fillStyle = '#a93226'; c.fillRect(px + 24, py, 6, 29); c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(px + 27, py + 4, 1.5, 0, 7); c.fill();
      win(c, px + 5, py + 12, 3, 3); win(c, px + 15, py + 12, 3, 3);
      return true;
    case 'hospital':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 2, py + 27, 30, 4);
      c.fillStyle = '#fafafa'; c.fillRect(px + 2, py + 2, 28, 27);
      winGrid(c, px + 3, py + 4, 26, 14, 3, 5, '#90caf9');
      c.fillStyle = '#e53935'; c.fillRect(px + 14, py + 19, 4, 9); c.fillRect(px + 11.5, py + 21.5, 9, 4);
      c.fillStyle = '#b0bec5'; c.fillRect(px + 2, py, 28, 2.5);
      return true;
    case 'stadium': {
      c.fillStyle = '#9e9e9e'; c.beginPath(); c.ellipse(px + 16, py + 17, 16, 13, 0, 0, 7); c.fill();
      c.fillStyle = '#bdbdbd'; c.beginPath(); c.ellipse(px + 16, py + 17, 13, 10, 0, 0, 7); c.fill();
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; c.fillStyle = ['#e53935', '#1e88e5', '#fdd835'][i % 3]; c.fillRect(px + 16 + Math.cos(a) * 11.5, py + 17 + Math.sin(a) * 8.7, 1.4, 1.4); }
      c.fillStyle = '#43a047'; c.beginPath(); c.ellipse(px + 16, py + 17, 9, 6, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px + 16, py + 11); c.lineTo(px + 16, py + 23); c.stroke(); c.beginPath(); c.arc(px + 16, py + 17, 2, 0, 7); c.stroke();
      for (const [lx, ly] of [[2, 4], [30, 4]]) { c.fillStyle = '#607d8b'; c.fillRect(px + lx, py + ly, 1, 10); c.fillStyle = '#fff59d'; c.fillRect(px + lx - 1.5, py + ly - 2, 4, 2); }
      return true;
    }
    case 'researchlab':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 2, py + 27, 30, 4);
      c.fillStyle = '#eceff1'; c.fillRect(px + 2, py + 12, 28, 17);
      glassWin(c, px + 3, py + 14, 16, 10, 2, 4);
      dome(c, px + 24, py + 12, 6, '#cfd8dc', 'rgba(255,255,255,0.6)'); c.fillStyle = '#37474f'; c.save(); c.translate(px + 24, py + 9); c.rotate(-0.6); c.fillRect(-1, -6, 2, 6); c.restore();
      c.fillStyle = '#26c6da'; c.fillRect(px + 2, py + 11, 28, 1.4);
      c.fillStyle = '#37474f'; c.fillRect(px + 22, py + 22, 5, 7);
      return true;
    case 'datacenter':
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px + 2, py + 27, 30, 4);
      c.fillStyle = '#37474f'; c.fillRect(px + 1, py + 6, 30, 23); c.fillStyle = '#263238'; c.fillRect(px + 1, py + 4, 30, 3);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) { const on = Math.sin(R.t * 5 + r * 3 + k * 1.7 + b.id) > 0.2; c.fillStyle = on ? (k % 3 ? '#69f0ae' : '#40c4ff') : '#1b5e20'; c.fillRect(px + 3 + k * 3.5, py + 9 + r * 4.5, 1.6, 1.4); }
      for (const fx2 of [6, 16, 26]) { c.fillStyle = '#546e7a'; c.beginPath(); c.arc(px + fx2, py + 4, 2.6, Math.PI, 0); c.fill(); }
      return true;
    case 'office':
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 6, py + 27, 26, 4);
      glassWin(c, px + 7, py - 38, 18, 67, 14, 3, '#5c9bd1');
      c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 7, py - 38); c.lineTo(px + 25, py - 44); c.lineTo(px + 25, py - 38); c.fill();
      c.fillStyle = '#90a4ae'; c.fillRect(px + 22, py - 52, 1.2, 9);
      c.fillStyle = '#263238'; c.fillRect(px + 12, py + 23, 8, 6);
      return true;
    case 'exposition':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px - 4, py + 27, 40, 4);
      c.fillStyle = 'rgba(178,235,242,0.85)'; c.beginPath(); c.moveTo(px - 5, py + 29); c.lineTo(px - 5, py + 14); c.quadraticCurveTo(px + 16, py - 10, px + 37, py + 14); c.lineTo(px + 37, py + 29); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 9; i++) { const x = px - 5 + i * 5.25; c.moveTo(x, py + 29); c.lineTo(x, py + 14 - Math.sin(i / 8 * Math.PI) * 11); } c.moveTo(px - 5, py + 21); c.lineTo(px + 37, py + 21); c.stroke();
      c.fillStyle = 'rgba(178,235,242,0.95)'; c.beginPath(); c.moveTo(px + 8, py + 6); c.quadraticCurveTo(px + 16, py - 12, px + 24, py + 6); c.fill(); c.stroke();
      flag(c, px + 16, py - 15, 9, G.realm.color);
      return true;
    case 'skytower':
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(px + 16, py + 28, 10, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#eceff1'; c.beginPath(); c.moveTo(px + 9, py + 29); c.lineTo(px + 14.5, py - 40); c.lineTo(px + 17.5, py - 40); c.lineTo(px + 23, py + 29); c.fill();
      c.fillStyle = '#e53935'; for (let i = 0; i < 5; i++) c.fillRect(px + 10.5 + i * 0.9, py + 20 - i * 14, 11 - i * 1.8, 3);
      c.fillStyle = '#b0bec5'; c.beginPath(); c.ellipse(px + 16, py - 30, 7, 3.5, 0, 0, 7); c.fill(); glassWin(c, px + 10, py - 33, 12, 3, 1, 4, '#4fc3f7');
      c.fillStyle = '#90a4ae'; c.fillRect(px + 15.4, py - 58, 1.2, 18);
      c.fillStyle = Math.sin(R.t * 3) > 0 ? '#ff1744' : '#7f0000'; c.beginPath(); c.arc(px + 16, py - 59, 1.5, 0, 7); c.fill();
      return true;
    case 'ark': {
      c.fillStyle = '#78909c'; c.fillRect(px - 2, py + 25, 36, 5);
      c.strokeStyle = '#ff7043'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 27, py + 25); c.lineTo(px + 27, py - 40); for (let i = 0; i < 8; i++) { c.moveTo(px + 27, py + 22 - i * 8); c.lineTo(px + 31, py + 18 - i * 8); c.moveTo(px + 31, py + 22 - i * 8); c.lineTo(px + 27, py + 18 - i * 8); } c.moveTo(px + 31, py + 25); c.lineTo(px + 31, py - 40); c.stroke();
      c.fillStyle = '#fafafa'; c.beginPath(); c.moveTo(px + 11, py + 24); c.lineTo(px + 11, py - 30); c.quadraticCurveTo(px + 16, py - 52, px + 21, py - 30); c.lineTo(px + 21, py + 24); c.fill();
      c.fillStyle = '#263238'; c.fillRect(px + 11, py - 12, 10, 2); c.fillRect(px + 11, py + 6, 10, 2);
      c.fillStyle = G.realm.color; c.fillRect(px + 13, py - 24, 6, 8);
      c.fillStyle = '#b0bec5'; c.beginPath(); c.moveTo(px + 11, py + 12); c.lineTo(px + 5, py + 25); c.lineTo(px + 11, py + 22); c.fill(); c.beginPath(); c.moveTo(px + 21, py + 12); c.lineTo(px + 27, py + 25); c.lineTo(px + 21, py + 22); c.fill();
      c.fillStyle = `rgba(255,${150 + Math.sin(R.t * 20) * 60 | 0},50,0.8)`; c.beginPath(); c.moveTo(px + 13, py + 25); c.lineTo(px + 16, py + 31 + Math.sin(R.t * 25) * 1.5); c.lineTo(px + 19, py + 25); c.fill();
      return true;
    }
  }
  return false;
}

// ---------- Rival towns grow and modernise with their age ----------
function aiHomeLevel(e, x, y, big) {
  const h = hashf(x, y, 31);
  if (big) return clamp(e, 3, 7);
  if (e <= 2) return 1; if (e === 3) return h < 0.5 ? 1 : 2; if (e === 4) return h < 0.5 ? 2 : 3;
  if (e === 5) return h < 0.4 ? 3 : 4; if (e === 6) return h < 0.4 ? 4 : 5; return h < 0.5 ? 5 : 6;
}
function drawAIDeco(c, x, y, v, owner) {
  const px = x * TILE, py = y * TILE, f = owner > 0 ? fac(owner) : null;
  const col = owner === 0 ? G.realm.color : f ? f.color : '#999';
  const e = f && !f.minor ? (f.era || 1) : 1;
  if (v === 1 || v === 6) {
    const L = aiHomeLevel(e, x, y, v === 6);
    if (L <= 1 && v === 1) { house(c, px + (hashf(x, y, 5) - 0.5) * 6, py + (hashf(x, y, 6) - 0.5) * 4, 15, 15, '#cdb89a', shade(col, -30)); return; }
    drawHome(c, px, py, L, shade(col, -25), x * 7 + y);
  }
  else if (v === 2) { c.fillStyle = 'rgba(141,110,99,0.7)'; c.fillRect(px + 4, py + 6, 24, 20); c.fillStyle = e >= 6 ? '#9ccc65' : '#c0ca33'; for (let i = 0; i < 4; i++) c.fillRect(px + 5, py + 8 + i * 5, 22, 2); if (e >= 6) { c.fillStyle = 'rgba(224,247,250,0.55)'; c.fillRect(px + 4, py + 6, 24, 9); } }
  else if (v === 4) { // independent village: longhouse inside a palisade
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px - 3, py + 27, 38, 4);
    c.fillStyle = '#8d6e63'; for (let i = 0; i < 9; i++) { c.fillRect(px - 3 + i * 4.3, py + 18, 3, 11); c.beginPath(); c.moveTo(px - 3 + i * 4.3, py + 18); c.lineTo(px - 1.5 + i * 4.3, py + 15); c.lineTo(px + i * 4.3, py + 18); c.fill(); }
    c.fillStyle = '#d7b98e'; c.fillRect(px + 5, py + 6, 22, 12);
    c.fillStyle = f && f.minor ? '#8e6b3a' : shade(col, -30); c.beginPath(); c.moveTo(px + 2, py + 8); c.lineTo(px + 16, py - 4); c.lineTo(px + 30, py + 8); c.fill();
    c.fillStyle = '#4e342e'; c.fillRect(px + 14, py + 21, 4, 8);
    flag(c, px + 25, py - 8, 10, col, x);
  }
  else if (v === 3) drawHall(c, px, py, e, shade(col, -20), col);
  else if (v >= 7) drawSiteDeco(c, x, y, v, f);
  else if (v === 5) { // a rival's secondary town
    if (e <= 2) { c.fillStyle = '#d7b98e'; c.fillRect(px + 5, py + 12, 22, 16); c.fillStyle = shade(col, -30); c.beginPath(); c.moveTo(px + 2, py + 14); c.lineTo(px + 16, py + 2); c.lineTo(px + 30, py + 14); c.fill(); c.fillStyle = '#4e342e'; c.fillRect(px + 14, py + 21, 4, 7); flag(c, px + 26, py - 2, 10, col, x); }
    else drawHall(c, px, py, Math.max(2, e - 1), shade(col, -20), col);
  }
}

// ---------- Level-of-detail: cheap drawing when zoomed far out ----------
function drawBuildingLOD(c, b) {
  const d = B[b.type], px = b.x * TILE, py = b.y * TILE;
  if (d.block) { c.fillStyle = d.block; c.fillRect(px, py, 32, 32); return; }
  if (b.type === 'townhall' || d.cat === 'wonder' || b.type === 'cityhall') { c.fillStyle = '#eceff1'; c.fillRect(px - 3, py - 3, 38, 38); c.fillStyle = b.type === 'townhall' ? G.realm.color : (b.roof || d.roof); c.fillRect(px + 3, py + 3, 26, 26); return; }
  if (b.type === 'tree' || b.type === 'hedge' || b.type === 'garden') { c.fillStyle = '#43a047'; c.fillRect(px + 6, py + 6, 20, 20); return; }
  if (b.type === 'farm') { c.fillStyle = '#c0ca33'; c.fillRect(px + 2, py + 2, 28, 28); }
  c.fillStyle = b.roof || d.roof || '#8e3b2e'; const s = d.housing ? 12 + b.level * 2 : 18 + b.level * 2; c.fillRect(px + 16 - s / 2, py + 16 - s / 2, s, s);
  if (b.ruined || b.burning) { c.fillStyle = 'rgba(244,67,54,0.8)'; c.fillRect(px + 10, py + 10, 12, 12); }
}
function drawDecoLOD(c, x, y, v, owner) {
  const px = x * TILE, py = y * TILE, f = owner > 0 ? fac(owner) : null, col = f ? f.color : '#999';
  if (v === 2) { c.fillStyle = '#c0ca33'; c.fillRect(px + 4, py + 6, 24, 20); return; }
  if (v >= 7) { c.fillStyle = DECO_B[v] ? B[DECO_B[v]].roof : col; c.fillRect(px + 7, py + 7, 18, 18); return; }
  if (v === 3 || v === 4 || v === 5) { c.fillStyle = '#eceff1'; c.fillRect(px - 2, py - 2, 36, 36); c.fillStyle = col; c.fillRect(px + 4, py + 4, 24, 24); return; }
  c.fillStyle = shade(col, -30); const s = v === 6 ? 22 : 14; c.fillRect(px + 16 - s / 2, py + 16 - s / 2, s, s);
}

// Little marker when a modern building is short of power
function powerMark(c, b, px, py) {
  const d = B[b.type];
  const needs = d.power < 0 || (d.powerLv && b.level >= d.powerLv);
  if (!needs || powerRatio(b) >= 0.99 || R.cam.z < 0.85) return;
  if (Math.sin(R.t * 4) > -0.2) { c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('⚡', px + 6, py + 10); }
}
function ruinMark(c, b, px, py) {
  c.fillStyle = 'rgba(70,55,45,0.45)'; c.fillRect(px + 2, py + 2, 28, 28);
  c.fillStyle = '#8d8378'; for (let k = 0; k < 6; k++) c.fillRect(px + 4 + hashf(b.x, b.y, k) * 22, py + 16 + hashf(b.x, b.y, k + 7) * 11, 4, 3);
  if (R.cam.z > 0.7) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText('🚧', px + 16, py + 16); }
}
