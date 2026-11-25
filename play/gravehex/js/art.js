'use strict';
// ───────────────────────── 8-bit art: palettes, hand-drawn sprites, procedural monsters ─────────────────────────
const PAL = {
  '.': null, k: '#0a0610', K: '#1c1424', d: '#2e2238', D: '#463650',
  w: '#f2e8d0', W: '#bfb39a', r: '#d0213a', R: '#7a0f24', o: '#ff7a2a',
  y: '#ffd44a', g: '#e0a82e', G: '#8a5a14', p: '#a65cf0', P: '#4e2486',
  b: '#5ad0ff', B: '#2a5aa8', s: '#a8b4c4', S: '#5a6478', n: '#e0a888', N: '#9a5a48',
  m: '#6ab04a', M: '#2e5a2a', c: '#40e0b0', C: '#14705a', e: '#fff6a0', v: '#ff4a8a'
};

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function drawRows(x, rows, ox, oy, swap) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]; const col = (swap && swap[ch]) || PAL[ch];
    if (col) { x.fillStyle = col; x.fillRect(ox + i, oy + j, 1, 1); }
  }
}
function spr(rows, swap) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = mkCanvas(w, h); drawRows(c.getContext('2d'), rows, 0, 0, swap); return c;
}
const SPRC = new Map();
function cached(key, make) { if (!SPRC.has(key)) { const c = make(); SPRC.set(key, { c, url: c.toDataURL(), w: c.width, h: c.height }); } return SPRC.get(key); }
function img(key, make, scale, cls = '', extra = '') {
  const s = cached(key, make);
  return `<img class="px ${cls}" src="${s.url}" width="${s.w * scale}" height="${s.h * scale}" ${extra} alt="">`;
}

// colour helpers
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const [r, g, b] = hexToRgb(h); return f >= 0 ? rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f)); }

// deterministic rng
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── 8×8 icons ──
const ICONS = {
  steel: ['.....kwk', '....kwsk', '...kwsk.', 'k.kwsk..', 'kgksk...', '.kgk....', 'kgkgk...', 'gk.k....'],
  blood: ['...kk...', '..krrk..', '..krrk..', '.krrrrk.', 'krwrrrrk', 'krwrrrrk', 'kRrrrrRk', '.kRRRRk.'],
  bone: ['.kwwwwk.', 'kwwwwwwk', 'wkkwwkkw', 'wkkwwkkw', 'wwwkkwww', '.wwwwww.', '.wkwkwk.', '..wwww..'],
  hex: ['..kppk..', '.kppk...', 'kppk..p.', 'kppk.pep', 'kppk..p.', 'kppk....', '.kppk...', '..kppk..'],
  r_bone: ['w.....w.', 'Ww...wW.', '.ww.ww..', '..www...', '..www...', '.ww.ww..', 'Ww...wW.', 'w.....w.'],
  r_ichor: ['...kk...', '...ss...', '...ss...', '..kcck..', '.kcccck.', '.kcwcCk.', '.kccCCk.', '..kkkk..'],
  r_iron: ['........', '........', '..kkkkk.', '.kswwsk.', 'kssssSk.', 'kSSSSSk.', '.kkkkk..', '........'],
  r_gold: ['..kkk...', '.kyyyk..', '.kygyk..', '..kkkkk.', '.kyyyyk.', 'kyygyyk.', '.kyyyk..', '..kkk...'],
  r_soul: ['...b....', '..bb....', '..bbb.b.', '.bbebbb.', '.bbeebb.', 'bbeeeebb', '.beeeeb.', '..bbbb..'],
  fate: ['..kkkk..', '.kwwwwk.', 'kwkwwkwk', 'kwwwwwwk', 'kwwkwwwk', 'kwwwwkwk', '.kwwwwk.', '..kkkk..'],
  heart: ['.kk..kk.', 'krrkkrrk', 'krwrrrrk', 'krrrrrrk', '.krrrrk.', '..krrk..', '...kk...', '........'],
  doom: ['.kkkkk..', 'kpppppk.', 'pkkpkkp.', 'pkkpkkp.', 'ppppppp.', '.pkpkp..', '.ppppp..', '........'],
  sigil: ['...kk...', '..kyyk..', '.kyrryk.', 'kyrkkryk', 'kyrkkryk', '.kyrryk.', '..kyyk..', '...kk...'],
  tower: ['.k.k.k.', '.kkkkk.', '.kwWwk.', '.kWWWk.', '.kWkWk.', '.kWkWk.', 'kkkkkkk'],
  castle: ['k.k...k.k', 'kkk.k.kkk', 'kWk.kykWk', 'kWkkkkkWk', 'kWWWWWWWk', 'kWWkkkWWk', 'kWWkykWWk', 'kkkkkkkkk'],
  skull: ['.kkkkk.', 'kwwwwwk', 'wkrwkrw', 'wwwkwww', '.wkwkw.', '.kwwwk.'],
  crown: ['k..k..k', 'yk.y.ky', 'yykyky.', 'yyyyyyy', 'yryyyry', 'kkkkkkk'],
  q: ['.kkk.', 'kwwwk', 'k.kwk', '..kwk', '..k..', '..w..'],
  chain: ['kSk.kSk', 'S.SkS.S', 'kSk.kSk'],
};
function icon(name, scale = 2, cls = '') { return img('ic_' + name, () => spr(ICONS[name]), scale, cls); }

// ── relic shapes: x=main h=highlight d=dark k=outline ──
const RSHAPES = {
  tooth: ['.kkkkkk.', 'kxhhxxxk', 'kxhxxxxk', 'kxxxxxdk', '.kxxxdk.', '.kxdkxk.', '.kxk.kk.', '..k.....'],
  cup: ['kkkkkkkk', 'khxxxxdk', 'kxhxxxdk', '.kxxxdk.', '..kxdk..', '...kk...', '..kxxk..', '.kkkkkk.'],
  gauntlet: ['.k.k.k..', 'kxkxkxk.', 'kxkxkxkk', 'khxxxxxk', 'khxxxxdk', '.kxxxxdk', '.kdddddk', '..kkkkk.'],
  lantern: ['...kk...', '..k..k..', '.kkkkkk.', '.kxeexk.', '.kxeexk.', '.kxeexk.', '.kkkkkk.', '..kddk..'],
  eye: ['........', '..kkkk..', '.kxhhxk.', 'kxhkkxxk', 'kxkekxxk', '.kxxxxk.', '..kkkk..', '........'],
  candle: ['...e....', '...o....', '..kxk...', '..khk...', '..kxk...', '..kxk...', '.kkdkk..', 'kddddk..'],
  hourglass: ['kkkkkkk.', '.kxhxk..', '..kxk...', '...k....', '..kdk...', '.kxxxk..', 'kkkkkkk.', '........'],
  ring: ['...ee...', '..kxxk..', '.kkhhkk.', 'kxk..kxk', 'kxk..kdk', 'kxk..kdk', '.kxxxdk.', '..kkkk..'],
  gem: ['..kkkk..', '.khhxxk.', 'khhxxxdk', 'kxxxxxdk', '.kxxxdk.', '..kxdk..', '...kk...', '........'],
  crown: ['k..k..k.', 'xk.x.kx.', 'xxkxkxx.', 'xhxxxxd.', 'xexxxed.', 'kkkkkkk.', '........', '........'],
  book: ['.kkkkkk.', 'kxxxxxxk', 'kxhexxdk', 'kxeeexdk', 'kxxexxdk', 'kxxxxxdk', 'kwwwwwwk', '.kkkkkk.'],
  mask: ['.kkkkkk.', 'kxhhxxxk', 'xkkxxkkx', 'xkkxxkkx', 'xxxxxxdx', '.xxkkxd.', '..xxxd..', '...kk...'],
  die: ['.kkkkkk.', 'kwwwwwwk', 'kwkwwwwk', 'kwwwwwwk', 'kwwkkwwk', 'kwwwwwkk', 'kxwwwwxk', '.kkkkkk.'],
  key: ['.kkk....', 'kxhxk...', 'kx.xk...', 'kxhxkkkk', '.kkkxxxk', '....kxkx', '.....k.k', '........'],
  bell: ['...kk...', '..kxxk..', '.kxhxxk.', '.kxhxxk.', '.kxxxdk.', 'kxxxxxdk', 'kkkkkkkk', '...kk...'],
  dagger: ['......kk', '.....khk', '....khxk', '.k.khxk.', '.kkhxk..', '..kdk...', '.kdkk...', 'kdk.....'],
  heart: ['.kk.kk..', 'kxhkxxk.', 'kxhxxdk.', 'kxxxxdk.', '.kxxdk..', '..kxk...', '...k....', '........'],
  skull: ['.kkkkk..', 'kxhxxxk.', 'xkkxkkx.', 'xkkxkkx.', 'xxxkxxx.', '.xdxdx..', '.kxxxk..', '........'],
  moth: ['k......k', 'xk.kk.kx', 'xhkxxkhx', 'xxkeekxx', 'xdkxxkdx', 'xk.kk.kx', 'k..kk..k', '........'],
  scroll: ['.kkkkkk.', 'kwhhwwWk', '.kwwwwk.', '.kwxxwk.', '.kwwwwk.', '.kwxxwk.', 'kwwwwwWk', '.kkkkkk.'],
  vial: ['..kkk...', '...k....', '..kxk...', '.kxhxk..', 'kxhxxxk.', 'kxxxxdk.', 'kxxxddk.', '.kkkkk..'],
};
function relicIcon(shape, col, scale = 3, cls = '') {
  return img('rl_' + shape + col, () => {
    const sw = { x: col, h: shade(col, 0.45), d: shade(col, -0.45) };
    return spr(RSHAPES[shape] || RSHAPES.gem, sw);
  }, scale, cls);
}

// ── 16×16 hero sprites ──
const HERO_ART = {
  knight: [
    '......rr........', '.....rrR........', '....kkkkk.......', '...ksswssk......', '...kswssSk...w..',
    '...kkkkkkk...w..', '...ksekeSk...w..', '....kSSSk....w..', '..kksssssk..kgk.', '.ksswsssSSk..k..',
    '.ksskgggkSskns..', '.kssksssk.kSnk..', '..kkSsssSk.kk...', '...kSk.kSk......', '...kSk.kSk......', '..kkkk.kkkk.....'],
  witch: [
    '.........kk.....', '........kPPk....', '.......kPPk.....', '......kPPPk.....', '.....kPPPPPk....',
    '...kkkkggkkkkk..', '..kPPPPPPPPPPPk.', '....knnnnnnk..p.', '....knkknkkn.pep', '....knnnnnnk..p.',
    '...kPPkRRkPPk.k.', '..kPPPPPPPPPPkk.', '..kPPpPPPPpPPk..', '..kPPPPPPPPPPk..', '...kPPPPPPPPk...', '....kkk..kkk....'],
  butcher: [
    '....kkkkkk......', '...kRRRRRRk.....', '..kRRkkkkRRk....', '..kRknnnnkRk....', '..kRkekkekRk....',
    '..kRknnnnkRk.sss', '...kkRRRRkk.ssss', '..kNNkWWkNNk.sk.', '.kNNkWWWWkNNkGk.', '.kNkWWrWWWkNkG..',
    '.knkWWWrrWkknk..', '..kkWrWWWWk.kk..', '...kWWWWWWk.....', '...kRRk.kRRk....', '...kRRk.kRRk....', '..kkkkk.kkkkk...'],
  gravecaller: [
    '............b...', '....kkkkk..beb..', '...kDDDDDk..b...', '..kDDkkkDDk.k...', '..kDkwwwkDk.G...',
    '..kDkbwbkDk.G...', '..kDkwkwkDk.G...', '...kDkwkDk..G...', '..kDDDDDDDk.G...', '.kDDdDDDdDDkG...',
    '.kDdDDDDDdDwk...', '.kDDDDDDDDDkG...', '..kDDdDDdDDkG...', '..kDDDDDDDDkG...', '...kDDDDDDk.G...', '....kkkkkk..k...'],
  ranger: [
    '....kkkkk.......', '...kMMMMMk...k..', '..kMMmmmMMk..kG.', '..kMknnnkMk..k.G', '..kMkekekMk..k.G',
    '..kMknnnkMk..k.G', '...kMkkkMk...k.G', '..kMMMMMMMk..k.G', '.kMNNmMMNNMk.k.G', '.kMkNNNNNkMkkkG.',
    '.knkNgNNNknk.k..', '..kkNNNNNkk..k..', '...kNNNNNk......', '...kMk.kMk......', '...kNk.kNk......', '..kkkk.kkkk.....'],
  saint: [
    '....yyyyyy......', '...y......y.....', '....yyyyyy......', '.....kkkk.......', '....knnnnk......',
    '....kekkek...y..', '....knnnnk..yyy.', '.....knnk....y..', '...kkwwwwkk..g..', '..kwwwgwwwwk.g..',
    '..kwwgggwwwkng..', '..kwwwgwwwWkk...', '..kwwwgwwwWk....', '..kwwwwwwwWk....', '...kwwwwwWk.....', '....kkkkkk......'],
};
function heroImg(h, scale = 4, cls = '') { return img('hero_' + h.id, () => spr(HERO_ART[h.cls], h.swap), scale, cls); }

// ── 16×16 scene art for events / shops ──
const SCENE_ART = {
  altar: [
    '..e.......e.....', '..o.......o.....', '.kwk.....kwk....', '.kWk..y..kWk....', '.kWk.yyy.kWk....',
    '.kWk..y..kWk....', 'kkkkkkkkkkkkkk..', 'kGgggggggggggGk.', 'kGkkkkkkkkkkkGk.', 'kGkrrrrrrrrrkGk.',
    'kGkrRRRRRRRrkGk.', 'kGkrrrrrrrrrkGk.', 'kGkkkkkkkkkkkGk.', 'kGgggggggggggGk.', 'kkkkkkkkkkkkkkk.', '................'],
  door: [
    '....kkkkkkk.....', '..kkwkwkwkwkk...', '.kwkkkkkkkkkwk..', '.kkwkDDDDDkwkk..', 'kwkkDDDDDDDkkwk.',
    'kkwkDDdDdDDkwkk.', 'kwkDDDDDDDDDkwk.', 'kkwkDDDDDyDkwkk.', 'kwkkDDDDDDDkkwk.', 'kkwkDDDDDDDkwkk.',
    'kwkkDDdDdDDkkwk.', 'kkwkDDDDDDDkwkk.', 'kwkkDDDDDDDkkwk.', 'kkwkDDDDDDDkwkk.', 'kkkkkkkkkkkkkkk.', '................'],
  eye: [
    '................', '.....kkkkkk.....', '...kkrrrrrrkk...', '..krrRRRRRRrrk..', '.krRRwwwwwwRRrk.',
    'krRwwwbbbbwwwRrk', 'krRwwbbkkbbwwRrk', 'krRwwbkkkkbwwRrk', 'krRwwbbkkbbwwRrk', 'krRwwwbbbbwwwRrk',
    '.krRRwwwwwwRRrk.', '..krrRRRRRRrrk..', '...kkrrrrrrkk...', '.....kkkkkk.....', '................', '................'],
  chest: [
    '................', '................', '...kkkkkkkkkk...', '..kGGGGGGGGGGk..', '.kGggggggggggGk.',
    '.kGkkkkkkkkkkGk.', '.kkyyyyyyyyyykk.', '.kGGGGkyykGGGGk.', '.kGggGkyykGggGk.', '.kGggGGkkGGggGk.',
    '.kGggggggggggGk.', '.kGggggggggggGk.', '.kyyyyyyyyyyyyk.', '.kkkkkkkkkkkkkk.', '................', '................'],
  coffin: [
    '.....kkkkk......', '....kNNNNNk.....', '...kNNNNNNNk....', '..kNNNwNNNNNk...', '..kNNNwNNNNNk...',
    '..kNwwwwwNNNk...', '..kNNNwNNNNNk...', '..kNNNwNNNNNk...', '...kNNNNNNNk....', '...kNNNNNNNk....',
    '...kNNNNNNNk....', '....kNNNNNk.....', '....kNNNNNk.....', '.....kkkkk......', '................', '................'],
  well: [
    '...kkkkkkkkk....', '...kGGGGGGGk....', '....k.....k.....', '....k..k..k.....', '....k..S..k.....',
    '....k..S..k.....', '....k.kSk.k.....', '..kkkkkkkkkkk...', '.kSsSsSsSsSsSk..', '.kSkkkkkkkkkSk..',
    '.kSkcCcCcCckSk..', '.kSkCcCcCcCkSk..', '.kSsSsSsSsSsSk..', '.kSSSSSSSSSSSk..', '..kkkkkkkkkkk...', '................'],
  tavern: [
    '.......kk.......', '......kRRk......', '.....kRRRRk.....', '....kRRRRRRk....', '...kRRRRRRRRk...',
    '..kkkkkkkkkkkk..', '...kNNNNNNNNk...', '...kNkkNNkkNk...', '...kNkyNNkyNk...', '...kNkkNNkkNk...',
    '...kNNNNNNNNk...', '...kNNNkkNNNk...', '...kNNNkyNNNk...', '...kNNNkkNNNk...', '..kkkkkkkkkkkk..', '................'],
  market: [
    '................', '.kkkkkkkkkkkkkk.', '.krwrwrwrwrwrwk.', '.kkkkkkkkkkkkkk.', '..kG........Gk..',
    '..kG........Gk..', '..kG.kk..kk.Gk..', '..kG.cc.kyyk.Gk.', '..kGkcck.kyyk.Gk', '..kkkkkkkkkkkkk.',
    '..kNNNNNNNNNNNk.', '..kNkkkkkkkkkNk.', '..kNNNNNNNNNNNk.', '..kkkkkkkkkkkkk.', '................', '................'],
  shrine: [
    '.......b........', '......beb.......', '.......b........', '......kkk.......', '.....kSsSk......',
    '.....kSsSk......', '....kkSsSkk.....', '....kSSsSSk.....', '....kSsssSk.....', '...kkSSsSSkk....',
    '...kSSSsSSSk....', '..kkSSSsSSSkk...', '..kSSSSsSSSSk...', '.kkkkkkkkkkkkk..', '.kSSSSSSSSSSSk..', '.kkkkkkkkkkkkk..'],
};
function sceneImg(name, scale = 6, cls = '') { return img('sc_' + name, () => spr(SCENE_ART[name]), scale, cls); }

// ── procedural monsters ──
function genMonster(seedName, size, cols, opts = {}) {
  const rnd = mulberry(hashStr(seedName));
  const W = size, H = size, half = Math.ceil(W / 2);
  let g = Array.from({ length: H }, () => new Array(W).fill(0));
  const mirror = () => { for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) g[y][W - 1 - x] = g[y][x]; };
  const bodyTop = 0.12 + rnd() * 0.12, bodyBot = 0.9 + rnd() * 0.08, wide = 0.75 + rnd() * 0.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) {
    const dx = (half - 1 - x) / half, fy = y / H;
    let p = 0.72 - dx * dx * 1.1 / wide - Math.abs(fy - 0.5) * 0.45;
    if (fy < bodyTop || fy > bodyBot) p -= 0.55;
    g[y][x] = rnd() < p ? 1 : 0;
  }
  mirror();
  for (let it = 0; it < 3; it++) {
    const n = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < half; x++) {
      let c = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const yy = y + j, xx = x + i; if (yy >= 0 && yy < H && xx >= 0 && xx < W && g[yy][xx]) c++; }
      n[y][x] = g[y][x] ? (c >= 3 ? 1 : 0) : (c >= 5 ? 1 : 0);
    }
    g = n; mirror();
  }
  // keep the component touching the centre
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  let sx = cx, sy = cy; if (!g[sy][sx]) { outer: for (let r = 1; r < W; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const yy = cy + j, xx = cx + i; if (yy >= 0 && yy < H && xx >= 0 && xx < W && g[yy][xx]) { sx = xx; sy = yy; break outer; } } }
  const keep = g.map(r => r.map(() => 0)); const st = [[sx, sy]];
  while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= W || y >= H || keep[y][x] || !g[y][x]) continue; keep[y][x] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  g = keep;
  // limbs / tendrils from the bottom
  const legs = Math.floor(rnd() * 3);
  for (let l = 0; l < legs; l++) {
    let x = Math.floor(rnd() * (half - 2)) + 1, y = H - 1; while (y > 0 && !g[y][x]) y--;
    const len = 2 + Math.floor(rnd() * 4); for (let k = 1; k <= len && y + k < H; k++) { g[y + k][x] = 1; g[y + k][W - 1 - x] = 1; if (rnd() < 0.3) x = Math.max(0, x - 1); }
  }
  // horns
  const horns = opts.horns || rnd() < 0.35;
  let top = 0; while (top < H && !g[top].some(v => v)) top++;
  const C = { main: cols[0], dark: cols[1], light: cols[2], eye: cols[3] || '#fff6a0', bone: '#e8dcc0', boneD: '#9a8c70' };
  const layer = Array.from({ length: H }, () => new Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x]) {
    const up = y > 0 && g[y - 1][x], dn = y < H - 1 && g[y + 1][x], lf = x > 0 && g[y][x - 1];
    let col = C.main;
    if (!up) col = C.light; else if (!dn || (y > H * 0.6 && ((x + y) & 1))) col = C.dark; else if (!lf) col = shade(C.main, 0.15);
    layer[y][x] = col;
  }
  // ribs / markings
  const ribRow = Math.floor(H * (0.5 + rnd() * 0.15)), ribs = rnd() < 0.55;
  if (ribs) for (let r = 0; r < 3; r++) { const yy = ribRow + r * 2; if (yy >= H) break; for (let x = 0; x < W; x++) if (g[yy][x] && Math.abs(x - (W - 1) / 2) > 1 && Math.abs(x - (W - 1) / 2) < W * 0.28) layer[yy][x] = C.dark; }
  if (horns) {
    const hx = Math.max(1, Math.floor(half * (0.35 + rnd() * 0.4))), hl = 3 + Math.floor(rnd() * 4), out = rnd() < 0.6;
    let x = hx, y = top + 1;
    for (let k = 0; k < hl; k++) { const yy = y - k; if (yy < 0) break; const xx = out ? x - Math.floor(k / 2) : x + Math.floor(k / 3); if (xx < 0 || xx >= half) break; layer[yy][xx] = k > hl - 2 ? C.bone : C.boneD; layer[yy][W - 1 - xx] = layer[yy][xx]; g[yy][xx] = g[yy][W - 1 - xx] = 1; }
  }
  if (opts.crown) {
    const cw = Math.floor(W * 0.22); let ty = top - 1; if (ty < 3) ty = 3;
    for (let x = Math.floor(W / 2) - cw; x <= Math.floor(W / 2) + cw - 1; x++) {
      for (let k = 0; k < 2; k++) { layer[ty - k][x] = '#e0a82e'; g[ty - k][x] = 1; }
      if ((x - (Math.floor(W / 2) - cw)) % 3 === 0) { layer[ty - 2][x] = '#ffd44a'; g[ty - 2][x] = 1; layer[ty - 3][x] = '#ffd44a'; g[ty - 3][x] = 1; }
    }
    layer[ty - 1][Math.floor(W / 2)] = '#d0213a'; layer[ty - 1][Math.floor(W / 2) - 1] = '#d0213a';
  }
  // eyes
  let eyeRow = -1;
  for (let y = Math.floor(H * 0.2); y < H * 0.55; y++) { let c = 0; for (let x = 0; x < W; x++) if (g[y][x]) c++; if (c >= 6) { eyeRow = y + 1 + Math.floor(rnd() * 2); break; } }
  if (eyeRow < 0) eyeRow = Math.floor(H * 0.4);
  const eyeKind = rnd(), mid = (W - 1) / 2;
  const putEye = (x, y) => { x = Math.round(x); if (x < 0 || x >= W || y < 0 || y >= H) return; layer[y][x] = C.eye; g[y][x] = 1; if (y + 1 < H && g[y + 1][x]) layer[y + 1][x] = '#0a0610'; };
  if (eyeKind < 0.5) { const d = 1 + Math.floor(rnd() * 3); putEye(mid - d - 0.5, eyeRow); putEye(mid + d + 0.5, eyeRow); }
  else if (eyeKind < 0.7) { putEye(mid - 0.5, eyeRow); putEye(mid + 0.5, eyeRow); putEye(mid - 2.5, eyeRow + 2); putEye(mid + 2.5, eyeRow + 2); putEye(mid - 2.5, eyeRow - 1); putEye(mid + 2.5, eyeRow - 1); }
  else if (eyeKind < 0.85) { putEye(mid - 0.5, eyeRow); putEye(mid + 0.5, eyeRow); putEye(mid - 0.5, eyeRow - 1); putEye(mid + 0.5, eyeRow - 1); }
  else { for (let k = 0; k < 3; k++) { putEye(mid - 1.5 - k, eyeRow + k); putEye(mid + 1.5 + k, eyeRow + k); } }
  // mouth with teeth
  const my = eyeRow + 3 + Math.floor(rnd() * 2), mw = 1 + Math.floor(rnd() * 3);
  if (my < H - 1) for (let x = Math.round(mid - mw); x <= Math.round(mid + mw); x++) if (g[my][x]) { layer[my][x] = '#0a0610'; if (((x + my) & 1) && my - 1 >= 0) layer[my][x] = '#f2e8d0'; if (my + 1 < H && g[my + 1][x] && ((x) & 1)) layer[my + 1][x] = '#7a0f24'; }
  // render with outline
  const c = mkCanvas(W + 2, H + 2), x2 = c.getContext('2d');
  x2.fillStyle = '#0a0610';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x]) x2.fillRect(x, y, 3, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (layer[y][x]) { x2.fillStyle = layer[y][x]; x2.fillRect(x + 1, y + 1, 1, 1); }
  return c;
}
function monImg(m, scale, cls = '') {
  const size = m.boss ? 32 : m.lair ? 28 : 24;
  return img('mon_' + m.name, () => genMonster(m.name, size, m.c, { crown: m.boss, horns: m.lair }), scale, cls);
}

// ── tiny 3×5 font for canvas ──
const F3 = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], '?': ['111', '001', '011', '000', '010'], '!': ['010', '010', '010', '000', '010'],
};
function text3(x, s, ox, oy, col) {
  x.fillStyle = col; let cx = ox;
  for (const ch of s) { const g = F3[ch]; if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') x.fillRect(cx + i, oy + j, 1, 1); cx += 4; }
}

// ── terrain textures for hexes ──
const TERRAIN_COL = {
  bone: { base: '#9c8c6c', dark: '#5e5240', fleck: '#f2e8d0', fleck2: '#c8b890' },
  ichor: { base: '#1d5446', dark: '#0d2a24', fleck: '#40e0b0', fleck2: '#2a8a6a' },
  iron: { base: '#4a5262', dark: '#262a36', fleck: '#a8b4c4', fleck2: '#6a7488' },
  gold: { base: '#7c5c1c', dark: '#3e2a0c', fleck: '#ffd44a', fleck2: '#b08a2a' },
  soul: { base: '#262862', dark: '#121434', fleck: '#5ad0ff', fleck2: '#4a4aa8' },
  throne: { base: '#3c0c1e', dark: '#1a0610', fleck: '#d0213a', fleck2: '#6a1a3a' },
};
function terrainPixel(t, x, y, seed) {
  const T = TERRAIN_COL[t]; const h = hashStr(t + ':' + x + ',' + y + ':' + seed) / 4294967296;
  if (h > 0.975) return T.fleck;
  if (h > 0.93) return T.fleck2;
  // larger blotches via coarse noise
  const c = hashStr(t + Math.floor(x / 4) + ',' + Math.floor(y / 3) + seed) / 4294967296;
  if (c < 0.28 && ((x + y) & 1)) return T.dark;
  if (c < 0.12) return T.dark;
  return T.base;
}
