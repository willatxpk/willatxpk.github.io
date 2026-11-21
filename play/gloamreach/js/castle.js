// The ruined castle of the Gloamreach: curtain walls, towers, gatehouse and broken bridge over a chasm,
// inner bailey, a great keep, a chapel and graveyard, barracks, catacombs beneath the keep,
// a dead village on the road south, scattered ruins and buried crypts.

export function buildRuins(world, rnd, nz, B) {
  const C = world.castle, G = C.G;
  const W = 256, D = 256, H = 80;
  const rubble = [];
  const posts = world.posts = [];
  const post = (type, x, y, z) => posts.push({ type, x, y, z });
  const SOLIDISH = b => b !== B.AIR && b !== B.TALLGRASS && b !== B.BONES && b !== B.COBWEB;
  world.questChest = {};
  const put = (x, y, z, b) => world.raw(x, y, z, b);
  const get = (x, y, z) => world.get(x, y, z);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const decayAt = (x, y, z, base, top, k = 1) => {
    const h = (y - base) / Math.max(1, top - base);
    return nz.n3(x / 12, y / 8, z / 12) * 0.85 + h * 0.6 * k + rnd() * 0.2 > 1.0;
  };
  const stoneAt = (x, y, z, base) => {
    const m = nz.n3(x / 7 + 31, y / 5, z / 7 - 11) * 0.5 + 0.5 + (y - base < 3 ? 0.22 : 0);
    const r = rnd();
    if (m > 0.68 && r < 0.9) return B.MOSSY;
    if (r < 0.13) return B.CRACKED;
    if (r < 0.17) return B.COBBLE;
    return B.BRICK;
  };
  const ruin = (x, y, z, base, top, b = null, k = 1) => {
    if (decayAt(x, y, z, base, top, k)) { if (y > base + 3 && rnd() < 0.12) rubble.push([x, z]); return false; }
    put(x, y, z, b ?? stoneAt(x, y, z, base)); return true;
  };
  const fill = (x0, y0, z0, x1, y1, z1, b) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, y, z, typeof b === 'function' ? b(x, y, z) : b); };
  const air = (x0, y0, z0, x1, y1, z1) => fill(x0, y0, z0, x1, y1, z1, B.AIR);
  const isAirish = (x, y, z) => { const b = get(x, y, z); return b === B.AIR || b === B.TALLGRASS; };
  const deco = (x, y, z, b) => { if (isAirish(x, y, z) && world.get(x, y - 1, z) !== B.AIR) put(x, y, z, b); };

  // ---------------------------------------------------------------- moat chasm
  const ring = (x, z, a, b) => {
    const dx = Math.max(C.x0 - x, 0, x - C.x1), dz = Math.max(C.z0 - z, 0, z - C.z1);
    const d = Math.max(dx, dz);
    return d >= a && d <= b && (dx > 0 || dz > 0);
  };
  const MB = G - 11;
  for (let z = C.z0 - 14; z <= C.z1 + 14; z++) for (let x = C.x0 - 14; x <= C.x1 + 14; x++) {
    if (!ring(x, z, 5, 11)) continue;
    air(x, MB + 1, z, x, G + 3, z);
    put(x, MB, z, rnd() < 0.6 ? B.MUD : B.GRAVEL);
    if (rnd() < 0.02) put(x, MB + 1, z, B.BONES);
    else if (rnd() < 0.04) put(x, MB + 1, z, B.TALLGRASS);
  }
  // rubble ramps out of the chasm
  for (const [x, z, dx, dz] of [[C.x1 + 10, 112, 0, 1], [C.x0 - 10, 132, 0, -1], [140, C.z0 - 10, 1, 0], [96, C.z1 + 10, -1, 0]]) {
    for (let k = 0; k < 12; k++) { const px = x + dx * k, pz = z + dz * k; for (let y = MB; y <= MB + k; y++) for (const o of [0, 1]) put(px + (dz ? o : 0), y, pz + (dx ? o : 0), rnd() < 0.5 ? B.COBBLE : B.CRACKED); }
  }

  // ---------------------------------------------------------------- courtyard ground
  for (let z = C.z0; z <= C.z1; z++) for (let x = C.x0; x <= C.x1; x++) {
    air(x, G + 1, z, x, G + 30, z);
    const n = nz.n2(x / 9, z / 9), r = rnd();
    put(x, G, z, n > 0.45 ? B.MUD : n < -0.4 ? B.GRAVEL : (r < 0.3 ? B.DIRT : B.GRASS));
    for (let y = G - 4; y < G; y++) if (get(x, y, z) === B.AIR) put(x, y, z, B.STONE);
    if (get(x, G, z) === B.GRASS && rnd() < 0.12) put(x, G + 1, z, B.TALLGRASS);
  }
  // main road through the castle
  for (let z = C.z0; z <= C.z1 + 56; z++) for (let x = 126; x <= 130; x++) {
    const ty = z <= C.z1 ? G : world.topSolid(x, z);
    if (z > C.z1 + 4 && z < C.z1 + 12) continue; // the bridge spans this
    put(x, ty, z, rnd() < 0.7 ? B.COBBLE : B.GRAVEL);
    if (get(x, ty + 1, z) === B.TALLGRASS) put(x, ty + 1, z, B.AIR);
  }

  // ---------------------------------------------------------------- walls & towers
  const crenel = (x, y, z, base, top) => { if ((x + z) % 2 === 0) ruin(x, y, z, base, top + 1, null, 1.3); };
  function wallRect(x0, z0, x1, z1, th, top, foundation = 4) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      if (e >= th) continue;
      for (let y = G - foundation; y <= G; y++) put(x, y, z, B.BRICK);
      for (let y = G + 1; y <= top; y++) ruin(x, y, z, G, top);
      if (e === 0) crenel(x, top + 1, z, G, top);
    }
  }
  function roundTower(cx, cz, r, top, doorDir = null) {
    const stairs = [];
    const R = r - 2.2;
    for (let k = 1; k <= top - G - 1; k++) {
      const a = k * 0.52;
      stairs.push([Math.round(cx + Math.cos(a) * R), G + k, Math.round(cz + Math.sin(a) * R)]);
    }
    for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > r + 0.5) continue;
      for (let y = G - 6; y <= G; y++) put(x, y, z, B.BRICK);
      if (d > r - 1.6) {
        for (let y = G + 1; y <= top; y++) ruin(x, y, z, G, top, null, 0.8);
        if (d > r - 0.6) crenel(x, top + 1, z, G, top);
      } else {
        air(x, G + 1, z, x, top + 3, z);
        put(x, G, z, B.COBBLE);
      }
    }
    for (const [x, y, z] of stairs) if (!decayAt(x, y, z, G, top, 0.4)) put(x, y, z, B.BRICK);
    // a cap of rotten boards at the top, open above the last steps
    for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (Math.hypot(x - cx, z - cz) > r - 1.6) continue;
      if (stairs.slice(-6).some(([sx, , sz]) => Math.abs(sx - x) + Math.abs(sz - z) <= 1)) continue;
      if (rnd() < 0.75) put(x, top, z, B.PLANKS);
    }
    if (doorDir) { const [dx, dz] = doorDir; for (let s = 0; s <= 2; s++) for (const o of [0, 1]) air(Math.round(cx + dx * (r - s)) + (dz ? o : 0), G + 1, Math.round(cz + dz * (r - s)) + (dx ? o : 0), Math.round(cx + dx * (r - s)) + (dz ? o : 0), G + 3, Math.round(cz + dz * (r - s)) + (dx ? o : 0)); }
    if (rnd() < 0.5) deco(cx, G + 1, cz, B.BONES);
    for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; const x = Math.round(cx + Math.cos(a) * (r - 2)), z = Math.round(cz + Math.sin(a) * (r - 2)), y = G + 4 + ri(0, top - G - 6); if (get(x, y, z) === B.AIR) put(x, y, z, B.COBWEB); }
  }
  // walkway doors between wall tops and towers
  function towerWallDoors(cx, cz, r, wallTop, dirs) {
    for (const [dx, dz] of dirs) for (let s = -1; s <= 1; s++) {
      const x = Math.round(cx + dx * (r - 0.5)) + (dz ? s : 0), z = Math.round(cz + dz * (r - 0.5)) + (dx ? s : 0);
      air(x, wallTop + 1, z, x, wallTop + 3, z);
    }
  }

  // outer curtain wall
  const OT = G + 12;
  wallRect(C.x0, C.z0, C.x1, C.z1, 3, OT);
  const outerTowers = [];
  for (const x of [C.x0 + 1, 99, 128, 157, C.x1 - 1]) { outerTowers.push([x, C.z0 + 1]); if (x !== 128) outerTowers.push([x, C.z1 - 1]); }
  for (const z of [93, 120, 147]) { outerTowers.push([C.x0 + 1, z]); outerTowers.push([C.x1 - 1, z]); }
  for (const [x, z] of outerTowers) {
    const inward = [Math.sign(128 - x) * (Math.abs(128 - x) > 40 ? 1 : 0), Math.sign(120 - z) * (Math.abs(120 - z) > 40 ? 1 : 0)];
    const dir = Math.abs(inward[0]) > 0 && Math.abs(inward[1]) > 0 ? [inward[0], 0] : inward;
    roundTower(x, z, 5, G + 21, dir);
    towerWallDoors(x, z, 5, OT, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  }
  // stairs up onto the outer wall walk, against the inside of the south wall
  for (const sx of [104, 150]) for (let k = 0; k < 12; k++) for (const o of [0, 1]) fill(sx + k, G + 1, C.z1 - 4 - o, sx + k, G + 1 + k, C.z1 - 4 - o, B.BRICK);

  // gatehouse + portcullis
  for (const gx of [119, 133]) {
    for (let z = C.z1 - 5; z <= C.z1 + 3; z++) for (let x = gx; x <= gx + 5; x++) {
      const edge = x === gx || x === gx + 5 || z === C.z1 - 5 || z === C.z1 + 3;
      for (let y = G - 6; y <= G; y++) put(x, y, z, B.BRICK);
      for (let y = G + 1; y <= G + 18; y++) { if (edge) ruin(x, y, z, G, G + 18, null, 0.7); else put(x, y, z, y % 6 === 0 ? B.PLANKS : B.AIR); }
      if (edge && (x + z) % 2 === 0) ruin(x, G + 19, z, G, G + 19, null, 1.2);
    }
    air(gx === 119 ? gx + 5 : gx, G + 1, C.z1 - 2, gx === 119 ? gx + 5 : gx, G + 3, C.z1 - 1);
  }
  fill(125, G + 1, C.z1 - 5, 131, G + 14, C.z1 + 3, (x, y, z) => decayAt(x, y, z, G, G + 14, 0.7) ? B.AIR : stoneAt(x, y, z, G));
  air(125, G + 1, C.z1 - 6, 131, G + 6, C.z1 + 4);
  air(126, G + 7, C.z1 - 6, 130, G + 7, C.z1 + 4);
  for (let x = 125; x <= 131; x++) for (let y = G + 5; y <= G + 7; y++) if (x !== 125 && x !== 131 || y > G + 5) put(x, y, C.z1 - 1, B.BARS);
  put(124, G + 4, C.z1 - 6, B.BANNER); put(132, G + 4, C.z1 - 6, B.BANNER);
  put(124, G + 3, C.z1 - 6, B.BANNER); put(132, G + 3, C.z1 - 6, B.BANNER);

  // the broken bridge over the chasm
  for (let z = C.z1 + 4; z <= C.z1 + 12; z++) for (let x = 125; x <= 131; x++) {
    const gap = z >= C.z1 + 7 && z <= C.z1 + 8 && x < 131;
    if (gap) continue;
    put(x, G, z, rnd() < 0.3 ? B.CRACKED : B.BRICK); put(x, G - 1, z, B.BRICK);
    if ((x === 125 || x === 131) && rnd() < 0.7) put(x, G + 1, z, stoneAt(x, G + 1, z, G));
    if (x === 128 && (z === C.z1 + 5 || z === C.z1 + 11)) for (let y = MB; y < G - 1; y++) for (let o = -2; o <= 2; o++) put(x + o, y, z, stoneAt(x, y, z, MB));
  }

  // inner bailey
  const IX0 = 96, IZ0 = 80, IX1 = 160, IZ1 = 146, IT = G + 14;
  wallRect(IX0, IZ0, IX1, IZ1, 2, IT, 3);
  for (const [x, z] of [[IX0, IZ0], [IX1, IZ0], [IX0, IZ1], [IX1, IZ1]]) { roundTower(x, z, 4, G + 23, [Math.sign(128 - x), 0]); towerWallDoors(x, z, 4, IT, [[1, 0], [-1, 0], [0, 1], [0, -1]]); }
  air(125, G + 1, IZ1 - 2, 131, G + 6, IZ1 + 1);
  air(126, G + 7, IZ1 - 2, 130, G + 7, IZ1 + 1);
  for (let k = 0; k < 14; k++) for (const o of [0, 1]) fill(IX0 + 3 + k, G + 1, IZ1 - 2 - o, IX0 + 3 + k, G + 1 + k, IZ1 - 2 - o, B.BRICK);

  // ---------------------------------------------------------------- the keep
  const KX0 = 106, KZ0 = 84, KX1 = 150, KZ1 = 118, KT = G + 27;
  const floors = [G, G + 7, G + 14, G + 21];
  const stairSpans = [
    { x0: 145, x1: 146, z0: 105, z1: 112, base: G, dir: -1 },
    { x0: 110, x1: 111, z0: 98, z1: 105, base: G + 7, dir: 1 },
    { x0: 145, x1: 146, z0: 92, z1: 99, base: G + 14, dir: -1 },
  ];
  const inStair = (x, z, base) => stairSpans.some(s => s.base + 7 === base && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1);
  for (let z = KZ0; z <= KZ1; z++) for (let x = KX0; x <= KX1; x++) {
    const e = Math.min(x - KX0, KX1 - x, z - KZ0, KZ1 - z);
    for (let y = G - 4; y <= G; y++) put(x, y, z, B.BRICK);
    if (e < 2) {
      for (let y = G + 1; y <= KT; y++) ruin(x, y, z, G, KT, null, 0.85);
      if (e === 0) crenel(x, KT + 1, z, G, KT);
    } else {
      put(x, G, z, rnd() < 0.15 ? B.CRACKED : B.BRICK);
      for (const fy of floors.slice(1)) {
        if (inStair(x, z, fy)) continue;
        if (nz.n3(x / 8, fy / 3, z / 8) > 0.38) { if (rnd() < 0.3) rubble.push([x, z]); continue; }
        put(x, fy, z, B.PLANKS);
      }
      if (nz.n3(x / 10, 99, z / 10) < -0.15 && rnd() < 0.85) put(x, KT, z, B.SLATE);
    }
  }
  // windows
  for (const fy of floors) {
    const wy = fy + (fy === G ? 3 : 2);
    for (let x = KX0 + 4; x <= KX1 - 4; x += 6) for (const z of [KZ0, KZ0 + 1, KZ1 - 1, KZ1]) { air(x, wy, z, x + 1, wy + 2, z); air(x, wy + 3, z, x, wy + 3, z); }
    for (let z = KZ0 + 4; z <= KZ1 - 4; z += 6) for (const x of [KX0, KX0 + 1, KX1 - 1, KX1]) { air(x, wy, z, x, wy + 2, z + 1); }
  }
  // stairs between floors
  for (const s of stairSpans) for (let k = 1; k <= 7; k++) {
    const z = s.dir < 0 ? s.z1 - (k - 1) : s.z0 + (k - 1);
    for (let x = s.x0; x <= s.x1; x++) { fill(x, s.base + 1, z, x, s.base + k, z, B.BRICK); air(x, s.base + k + 1, z, x, s.base + k + 3, z); }
  }
  // great hall: doorway, pillars, dais, throne
  air(125, G + 1, KZ1 - 1, 131, G + 5, KZ1); air(126, G + 6, KZ1 - 1, 130, G + 6, KZ1);
  for (const px of [114, 122, 134, 142]) for (const pz of [92, 100, 108]) fill(px, G + 1, pz, px + 1, G + 6, pz + 1, (x, y, z) => stoneAt(x, y, z, G));
  fill(120, G + 1, KZ0 + 2, 136, G + 1, KZ0 + 5, B.BRICK);
  fill(122, G + 2, KZ0 + 2, 134, G + 2, KZ0 + 4, B.BRICK);
  fill(127, G + 3, KZ0 + 2, 129, G + 5, KZ0 + 2, B.BRICK); put(128, G + 6, KZ0 + 2, B.BRICK);
  put(127, G + 3, KZ0 + 3, B.BRICK); put(129, G + 3, KZ0 + 3, B.BRICK);
  world.placeChest(128, G + 3, KZ0 + 3, 'castle');
  put(123, G + 3, KZ0 + 3, B.CANDLES); put(133, G + 3, KZ0 + 3, B.CANDLES);
  for (const bx of [114, 120, 136, 142]) { put(bx, G + 5, KZ0 + 2, B.BANNER); put(bx, G + 4, KZ0 + 2, B.BANNER); }
  for (let i = 0; i < 18; i++) { const x = ri(KX0 + 3, KX1 - 3), z = ri(KZ0 + 3, KZ1 - 3); const fy = floors[ri(0, 3)]; deco(x, fy + 1, z, rnd() < 0.6 ? B.BONES : B.COBWEB); }
  for (let i = 0; i < 14; i++) { const x = ri(KX0 + 2, KX1 - 2), z = ri(KZ0 + 2, KZ1 - 2), fy = floors[ri(0, 3)] + 6; if (get(x, fy, z) === B.AIR && get(x, fy + 1, z) !== B.AIR) put(x, fy, z, B.COBWEB); }
  world.placeChest(112, G + 22, 88, 'castle');
  deco(113, G + 22, 88, B.CANDLES);
  world.placeChest(144, G + 8, 114, 'ruin');

  // ---------------------------------------------------------------- catacombs beneath the keep
  const CF = G - 12, CX0 = 98, CZ0 = 88, CX1 = 158, CZ1 = 142;
  C.cat = { x0: CX0, z0: CZ0, x1: CX1, z1: CZ1, y: CF };
  fill(CX0, CF, CZ0, CX1, CF + 6, CZ1, (x, y, z) => stoneAt(x, y, z, CF));
  const nodesX = [104, 114, 124, 134, 144, 154], nodesZ = [94, 104, 114, 124, 134];
  const corridor = (x0, z0, x1, z1) => {
    for (let z = Math.min(z0, z1) - 1; z <= Math.max(z0, z1) + 1; z++) for (let x = Math.min(x0, x1) - 1; x <= Math.max(x0, x1) + 1; x++) {
      air(x, CF + 1, z, x, CF + 3, z);
      const center = x0 === x1 ? x === x0 : z === z0;
      if (center) put(x, CF + 4, z, B.AIR);
    }
    // burial niches
    const horiz = z0 === z1;
    for (let t = 0; t <= Math.abs(horiz ? x1 - x0 : z1 - z0); t += 3) for (const side of [-2, 2]) {
      if (rnd() < 0.35) continue;
      const x = horiz ? Math.min(x0, x1) + t : x0 + side, z = horiz ? z0 + side : Math.min(z0, z1) + t;
      air(x, CF + 2, z, x, CF + 2, z);
      if (rnd() < 0.7) put(x, CF + 2, z, B.BONES);
    }
  };
  for (let j = 0; j < nodesZ.length; j++) for (let i = 0; i < nodesX.length; i++) {
    if (i < nodesX.length - 1 && rnd() < 0.8) corridor(nodesX[i], nodesZ[j], nodesX[i + 1], nodesZ[j]);
    if (j < nodesZ.length - 1 && rnd() < 0.7) corridor(nodesX[i], nodesZ[j], nodesX[i], nodesZ[j + 1]);
  }
  corridor(134, 114, 144, 114); corridor(124, 114, 134, 114); corridor(124, 104, 124, 114);
  // stairway down from the great hall
  for (let k = 0; k < 12; k++) {
    const z = 103 + k;
    for (const x of [138, 139]) { air(x, G - k, z, x, G + 3 - Math.min(k, 3) + 0, z); put(x, G - k - 1, z, B.BRICK); }
  }
  air(137, CF + 1, 114, 140, CF + 3, 116);
  // tomb chambers
  const chambers = [[104, 94], [154, 134], [114, 134], [154, 94]];
  chambers.forEach(([cx, cz], ci) => {
    air(cx - 3, CF + 1, cz - 3, cx + 3, CF + 4, cz + 3);
    for (const [px, pz] of [[cx - 2, cz - 2], [cx + 2, cz - 2], [cx - 2, cz + 2], [cx + 2, cz + 2]]) fill(px, CF + 1, pz, px, CF + 4, pz, B.BRICK);
    fill(cx - 1, CF + 1, cz, cx + 1, CF + 1, cz, B.BRICK);
    world.placeChest(cx, CF + 2, cz, 'catacomb');
    if (ci === 0) world.questChest.signet = world.idx(cx, CF + 2, cz);
    if (ci === 0) { put(cx - 1, CF + 2, cz, B.CANDLES); put(cx + 1, CF + 2, cz, B.CANDLES); }
    for (let x = cx - 3; x <= cx + 3; x++) if (rnd() < 0.8) put(x, CF + 1, cz + 3, B.BARS), put(x, CF + 2, cz + 3, B.BARS);
    for (let i = 0; i < 4; i++) deco(ri(cx - 3, cx + 3), CF + 1, ri(cz - 3, cz + 2), B.BONES);
  });
  for (let i = 0; i < 60; i++) { const x = ri(CX0, CX1), z = ri(CZ0, CZ1); if (get(x, CF + 3, z) === B.AIR && get(x, CF + 4, z) !== B.AIR) put(x, CF + 3, z, B.COBWEB); }

  // ---------------------------------------------------------------- chapel & graveyard (east bailey)
  const HX0 = 166, HX1 = 180, HZ0 = 86, HZ1 = 128, HT = G + 12;
  for (let z = HZ0; z <= HZ1; z++) for (let x = HX0; x <= HX1; x++) {
    const e = Math.min(x - HX0, HX1 - x, z - HZ0, HZ1 - z);
    put(x, G, z, B.BRICK);
    if (e < 1) for (let y = G + 1; y <= HT; y++) ruin(x, y, z, G, HT, null, 0.7);
    const roofY = HT + 6 - Math.abs(x - 173);
    if (Math.abs(x - 173) <= 7 && !decayAt(x, roofY, z, G, HT + 6, 1.5)) put(x, roofY, z, B.SLATE);
  }
  for (let z = HZ0 + 3; z <= HZ1 - 3; z += 6) { for (const x of [HX0, HX1]) air(x, G + 4, z, x, G + 10, z + 1); fill(169, G + 1, z, 169, HT, z, (x, y, zz) => stoneAt(x, y, zz, G)); fill(177, G + 1, z, 177, HT, z, (x, y, zz) => stoneAt(x, y, zz, G)); }
  for (let x = HX0 + 1; x < HX1; x++) for (const z of [HZ0, HZ1]) for (let y = HT + 1; y <= HT + 6 - Math.abs(x - 173); y++) ruin(x, y, z, G, HT + 6, null, 0.9);
  air(171, G + 1, HZ1, 175, G + 6, HZ1); air(172, G + 7, HZ1, 174, G + 7, HZ1);
  air(173, HT - 4, HZ0, 173, HT + 1, HZ0);
  fill(171, G + 1, HZ0 + 2, 175, G + 2, HZ0 + 3, B.BRICK);
  put(171, G + 3, HZ0 + 2, B.CANDLES); put(175, G + 3, HZ0 + 2, B.CANDLES); put(173, G + 3, HZ0 + 3, B.CANDLES);
  world.placeChest(173, G + 3, HZ0 + 2, 'castle');
  world.questChest.reliquary = world.idx(173, G + 3, HZ0 + 2);
  put(173, G + 4, HZ0 + 1, B.BANNER); put(173, G + 5, HZ0 + 1, B.BANNER);
  for (let i = 0; i < 10; i++) deco(ri(HX0 + 2, HX1 - 2), G + 1, ri(HZ0 + 5, HZ1 - 2), rnd() < 0.5 ? B.BONES : B.COBWEB);
  for (let z = 134; z <= 170; z += 3) for (let x = 166; x <= 181; x += 3) if (rnd() < 0.8) { deco(x + ri(0, 1), G + 1, z, B.TOMBSTONE); }
  for (let i = 0; i < 4; i++) world.deadTree(ri(164, 182), G + 1, ri(134, 170), rnd);

  // ---------------------------------------------------------------- barracks & halls (west bailey)
  function house(x0, z0, w, d, base, floors2 = true, kind = 'ruin') {
    const x1 = x0 + w - 1, z1 = z0 + d - 1, top = base + (floors2 ? 9 : 5);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      for (let y = base - 3; y <= base; y++) if (y === base || get(x, y, z) === B.AIR || get(x, y, z) === B.TALLGRASS) put(x, y, z, B.COBBLE);
      air(x, base + 1, z, x, top + 6, z);
      if (e === 0) for (let y = base + 1; y <= top; y++) ruin(x, y, z, base, top, y <= base + 1 ? B.COBBLE : null, 0.9);
      else {
        if (floors2 && nz.n3(x / 5, base, z / 5) < 0.3) put(x, base + 5, z, B.PLANKS);
        const ry = top + Math.min(x - x0, x1 - x);
        if (Math.min(x - x0, x1 - x) <= Math.floor(w / 2) && !decayAt(x, ry, z, base, top + 4, 1.6)) put(x, ry, z, B.SLATE);
      }
    }
    const dx = x0 + Math.floor(w / 2);
    air(dx, base + 1, z1, dx, base + 3, z1); air(dx, base + 1, z0, dx, base + 3, z0);
    for (let z = z0 + 2; z < z1 - 1; z += 3) { air(x0, base + 2, z, x0, base + 3, z); air(x1, base + 2, z, x1, base + 3, z); }
    // a wardrobe to hide in, against the back wall (and sometimes a second)
    for (const [wx, wz] of [[x0 + 1, z1 - 1], [x1 - 1, z0 + 1]].slice(0, (x0 * 7 + z0 * 13) % 20 < 9 ? 2 : 1)) {
      if (get(wx, base + 1, wz) === B.AIR && get(wx, base + 2, wz) === B.AIR) { put(wx, base + 1, wz, B.WARDROBE); put(wx, base + 2, wz, B.WARDROBE); }
    }
    for (let i = 0; i < 3; i++) deco(ri(x0 + 2, x1 - 2), base + 1, ri(z0 + 2, z1 - 2), [B.BONES, B.COBWEB, B.BONES][i]);
    if (rnd() < 0.5) world.placeChest(ri(x0 + 2, x1 - 2), base + 1, z0 + 1, kind);
  }
  house(75, 72, 13, 10, G, true, 'castle');
  house(75, 98, 13, 12, G);
  house(75, 124, 13, 10, G);
  house(75, 150, 13, 12, G, false);
  // courtyard: well, broken statues, dead trees, rubble
  for (let z = 156; z <= 160; z++) for (let x = 100; x <= 104; x++) { const d = Math.hypot(x - 102, z - 158); if (d > 1.6 && d < 2.6) { put(x, G + 1, z, B.COBBLE); } else if (d <= 1.6) air(x, G - 12, z, x, G, z); }
  for (const [sx, sz] of [[112, 160], [144, 160], [112, 132], [144, 132]]) {
    fill(sx, G + 1, sz, sx + 1, G + 2, sz + 1, B.BRICK);
    const h = ri(1, 4); fill(sx, G + 3, sz, sx + 1, G + 2 + h, sz + 1, (x, y, z) => stoneAt(x, y, z, G));
  }
  for (let i = 0; i < 10; i++) { const tx = ri(100, 156); if (Math.abs(tx - 128) > 4) world.deadTree(tx, G + 1, ri(150, 168), rnd); }
  for (let i = 0; i < 8; i++) world.deadTree(ri(C.x0 + 6, C.x1 - 6), G + 1, ri(C.z0 + 6, C.z0 + 14), rnd);

  // ---------------------------------------------------------------- the dead village on the south road
  const village = [[108, 192], [142, 192], [106, 206], [144, 208], [94, 224], [160, 222], [155, 199]];
  for (const [vx, vz] of village) {
    let base = 999; for (let z = vz; z < vz + 8; z++) for (let x = vx; x < vx + 9; x++) base = Math.min(base, world.topSolid(x, z));
    if (base < 10 || base > H - 20) continue;
    house(vx, vz, 9, 8, base + 1, rnd() < 0.4);
  }
  for (let z = 196; z <= 216; z += 3) for (let x = 88; x <= 100; x += 3) {
    if (rnd() < 0.25) continue;
    const ty = world.topSolid(x, z); deco(x, ty + 1, z, B.TOMBSTONE);
  }
  for (let i = 0; i < 5; i++) { const x = ri(84, 102), z = ri(194, 218); world.deadTree(x, world.topSolid(x, z) + 1, z, rnd); }

  // ---------------------------------------------------------------- Emberfall: the survivors' camp where you wake
  {
    const CX = 128, CZ = 229, h0 = world.topSolid(CX, CZ);
    for (let z = CZ - 15; z <= CZ + 15; z++) for (let x = CX - 15; x <= CX + 15; x++) {
      const d = Math.hypot(x - CX, z - CZ); if (d > 14.5) continue;
      for (let y = h0 - 5; y < h0; y++) if (!SOLIDISH(get(x, y, z))) put(x, y, z, B.DIRT);
      air(x, h0 + 1, z, x, h0 + 16, z);
      put(x, h0, z, Math.abs(x - CX) <= 1 || d < 3.2 ? B.GRAVEL : (rnd() < 0.55 ? B.DIRT : B.GRASS));
      if (d > 4 && d < 12 && rnd() < 0.05 && Math.abs(x - CX) > 2) put(x, h0 + 1, z, B.TALLGRASS);
    }
    put(CX, h0 + 1, CZ, B.CAMPFIRE);
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) / 8 * Math.PI * 2, x = Math.round(CX + Math.cos(a) * 10.5), z = Math.round(CZ + Math.sin(a) * 10.5);
      put(x, h0 + 1, z, B.COBBLE); put(x, h0 + 2, z, B.COBBLE); put(x, h0 + 3, z, B.TORCH);
    }
    for (let z = CZ - 14; z <= CZ + 14; z++) for (let x = CX - 14; x <= CX + 14; x++) {
      const d = Math.hypot(x - CX, z - CZ);
      if (d < 12.6 || d > 13.5 || Math.abs(x - CX) <= 2) continue;
      for (let y = h0 + 1; y <= h0 + 3 + (rnd() < 0.4 ? 1 : 0); y++) put(x, y, z, B.LOG);
    }
    const hut = (x0, z0, x1, z1, door) => {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        for (let y = h0 + 1; y <= h0 + 3; y++) put(x, y, z, edge ? ((x === x0 || x === x1) && (z === z0 || z === z1) ? B.LOG : B.PLANKS) : B.AIR);
      }
      for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) put(x, h0 + 4, z, B.SLATE);
      const [dx, dz] = door; air(dx, h0 + 1, dz, dx, h0 + 2, dz);
      put(Math.round((x0 + x1) / 2), h0 + 1, Math.round((z0 + z1) / 2), B.CANDLES);
    };
    hut(115, 231, 119, 235, [119, 233]);
    hut(137, 231, 141, 235, [137, 233]);
    hut(125, 237, 131, 240, [128, 237]);
    // merchant's stall
    for (let z = 223; z <= 225; z++) put(122, h0 + 1, z, B.PLANKS);
    for (const z of [223, 225]) for (let y = h0 + 1; y <= h0 + 3; y++) put(119, y, z, B.LOG);
    for (let z = 222; z <= 226; z++) for (let x = 119; x <= 122; x++) put(x, h0 + 4, z, B.SLATE);
    put(119, h0 + 3, 224, B.BANNER);
    // smithy: forge, coals, anvil
    put(135, h0 + 1, 223, B.COBBLE); put(136, h0 + 1, 223, B.COBBLE); put(135, h0 + 2, 223, B.COBBLE); put(136, h0 + 1, 222, B.COBBLE);
    put(137, h0 + 1, 223, B.CAMPFIRE);
    put(134, h0 + 1, 226, B.BARS);
    // wayside shrine
    put(117, h0 + 1, 227, B.COBBLE); put(117, h0 + 2, 227, B.CANDLES);
    // notice board
    put(131, h0 + 1, 219, B.LOG); put(132, h0 + 1, 219, B.LOG); put(131, h0 + 2, 219, B.PLANKS); put(132, h0 + 2, 219, B.PLANKS);
    put(131, h0 + 2, 220, B.BANNER);
    world.camp = {
      x: CX, y: h0 + 1, z: CZ,
      spots: {
        maren: [129.5, 231.5], oswin: [121.5, 224.5], tamsin: [134.5, 224.5], aldric: [118.5, 227.5], brannoc: [130.5, 221.5],
        hobb: [127.5, 235.5], edda: [136.5, 229.5], wen: [124.5, 230.5], rudd: [132.5, 232.5],
      },
    };
    world.spawn = { x: CX + 0.5, y: h0 + 1, z: CZ - 4.5 };
  }

  // ---------------------------------------------------------------- scattered ruins, watchtowers & brigand camps
  world.banditCamps = [];
  for (let n = 0; n < 14; n++) {
    const x = 20 + ri(0, W - 40), z = 20 + ri(0, D - 40);
    if (x > C.x0 - 20 && x < C.x1 + 20 && z > C.z0 - 20) continue;
    if (Math.hypot(x - 128, z - 229) < 40) continue;
    const base = world.topSolid(x, z);
    if (base > H - 30) continue;
    if (world.banditCamps.length < 2 || rnd() < 0.5) {
      const r = 3 + ri(0, 1), top = base + 10 + ri(0, 8);
      for (let zz = z - r - 1; zz <= z + r + 1; zz++) for (let xx = x - r - 1; xx <= x + r + 1; xx++) {
        const d = Math.hypot(xx - x, zz - z); if (d > r + 0.5) continue;
        for (let y = base - 3; y <= base; y++) put(xx, y, zz, B.BRICK);
        if (d > r - 1.5) for (let y = base + 1; y <= top; y++) ruin(xx, y, zz, base, top, null, 1.1); else air(xx, base + 1, zz, xx, top, zz);
      }
      air(x + r, base + 1, z, x + r, base + 3, z); air(x + r - 1, base + 1, z, x + r - 1, base + 3, z);
      if (world.banditCamps.length < 2) {
        world.placeChest(x, base + 1, z, 'dungeon');
        const fx = x + r + 3, fy = world.topSolid(fx, z + 1);
        air(fx - 1, fy + 1, z - 1, fx + 1, fy + 3, z + 2); put(fx, fy + 1, z + 1, B.CAMPFIRE);
        post('bandit', x + 0.5, base + 1, z - 1.5); post('bandit', fx + 1.5, fy + 1, z - 1.5); post('bandit', fx - 0.5, fy + 1, z + 3.5); post('bandit', fx + 2.5, fy + 1, z + 2.5);
        world.banditCamps.push({ x, z });
      } else world.placeChest(x, base + 1, z, 'ruin');
    } else {
      const len = 10 + ri(0, 10), horiz = rnd() < 0.5, top = base + 5 + ri(0, 5);
      for (let t = 0; t < len; t++) {
        const xx = horiz ? x + t : x, zz = horiz ? z : z + t, b0 = world.topSolid(xx, zz);
        for (let y = b0 - 2; y <= b0; y++) put(xx, y, zz, B.BRICK);
        for (let y = b0 + 1; y <= b0 + (top - base); y++) ruin(xx, y, zz, b0, b0 + (top - base), null, 1.2);
        if (t % 5 === 2) for (let y = b0 + 1; y <= b0 + 3; y++) put(xx, y, zz, B.AIR);
      }
      if (rnd() < 0.6) world.placeChest(horiz ? x + 2 : x + 1, world.topSolid(horiz ? x + 2 : x + 1, horiz ? z + 1 : z + 2) + 1, horiz ? z + 1 : z + 2, 'ruin');
    }
  }

  // ---------------------------------------------------------------- buried crypts
  for (let n = 0; n < 7; n++) {
    const cx = 16 + ri(0, W - 32), cz = 16 + ri(0, D - 32);
    if (cx > C.x0 - 16 && cx < C.x1 + 16 && cz > C.z0 - 16 && cz < C.z1 + 16) continue;
    const surf = world.topSolid(cx, cz), maxY = Math.min(surf - 13, 22);
    if (maxY < 6) continue;
    const cy = 5 + ri(0, maxY - 5), rx = 4 + ri(0, 1), rz = 4 + ri(0, 1), ry = 4;
    for (let dz = -rz; dz <= rz; dz++) for (let dx = -rx; dx <= rx; dx++) for (let dy = 0; dy <= ry + 1; dy++) {
      const edge = Math.abs(dx) === rx || Math.abs(dz) === rz || dy === 0 || dy === ry + 1;
      const pillar = Math.abs(dx) === rx - 1 && Math.abs(dz) === rz - 1;
      put(cx + dx, cy + dy, cz + dz, edge || pillar ? stoneAt(cx + dx, cy + dy, cz + dz, cy) : B.AIR);
    }
    world.placeChest(cx, cy + 1, cz, 'dungeon');
    for (let i = 0; i < 3; i++) deco(cx + ri(-2, 2), cy + 1, cz + ri(-2, 2), B.BONES);
    const [ddx, ddz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(0, 3)];
    let px = cx, pz = cz, py = cy + 1;
    const len = (ddx ? rx : rz) + 8 + ri(0, 9);
    for (let s = 0; s < len; s++) { px += ddx; pz += ddz; air(px, py, pz, px, py + 1, pz); }
    if (rnd() < 0.75) for (let s = 0; s < 40; s++) {
      px += ddx; pz += ddz; py += 1;
      if (px < 2 || pz < 2 || px >= W - 2 || pz >= D - 2) break;
      air(px, py, pz, px, py + 2, pz);
      if (py > world.topSolid(px, pz) - 1) {
        for (const [ox, oz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const tx = px + ox * 2, tz = pz + oz * 2; if (tx > 0 && tz > 0 && tx < W && tz < D) { const ty = world.topSolid(tx, tz) + 1; put(tx, ty, tz, B.MOSSY); if (rnd() < 0.6) put(tx, ty + 1, tz, B.MOSSY); } }
        break;
      }
    }
    world.dungeons.push({ x: cx, y: cy + 1, z: cz });
  }

  // ---------------------------------------------------------------- the castle's undying garrison (respawns when you rest)
  for (const [t, x, y, z] of [
    ['knight', 124.5, G + 1, 91.5], ['knight', 132.5, G + 1, 91.5], ['ghoul', 118.5, G + 1, 100.5], ['ghoul', 138.5, G + 1, 104.5], ['ghoul', 128.5, G + 1, 110.5],
    ['ghoul', 116.5, G + 8, 96.5], ['ghoul', 140.5, G + 15, 110.5], ['knight', 120.5, G + 22, 100.5],
    ['ghoul', 126.5, G + 1, 166.5], ['ghoul', 130.5, G + 1, 168.5],
    ['ghoul', 110.5, G + 1, 160.5], ['ghoul', 146.5, G + 1, 158.5], ['ghoul', 118.5, G + 1, 170.5],
    ['ghoul', 112.5, G + 1, 132.5], ['ghoul', 144.5, G + 1, 136.5], ['knight', 128.5, G + 1, 139.5],
    ['knight', 173.5, G + 1, 95.5], ['ghoul', 171.5, G + 1, 110.5], ['ghoul', 175.5, G + 1, 120.5],
    ['ghoul', 81.5, G + 1, 77.5], ['ghoul', 81.5, G + 1, 104.5], ['ghoul', 81.5, G + 1, 129.5], ['ghoul', 95.5, G + 1, 150.5], ['ghoul', 92.5, G + 1, 90.5],
    ['ghoul', 170.5, G + 1, 150.5], ['ghoul', 178.5, G + 1, 162.5],
    ['crawler', 114.5, CF + 1, 94.5], ['crawler', 144.5, CF + 1, 124.5], ['crawler', 104.5, CF + 1, 124.5], ['crawler', 134.5, CF + 1, 134.5],
    ['ghoul', 124.5, CF + 1, 104.5], ['ghoul', 154.5, CF + 1, 114.5], ['ghoul', 134.5, CF + 1, 94.5], ['knight', 154.5, CF + 1, 129.5],
  ]) post(t, x, y, z);
  // the dead village's Hollowed: Emberfall's first trouble, a short walk north of the camp
  for (const [x, z] of [[121.5, 195.5], [134.5, 199.5], [127.5, 190.5]]) post('ghoul', x, world.topSolid(Math.floor(x), Math.floor(z)) + 1, z);
  world.village = { x: 127.5, z: 196 };
  C.throne = { x: 128.5, y: G + 1, z: 94.5 };
  C.gate = { x: 128.5, y: G + 1, z: C.z1 - 2 };
  C.catStair = { x: 138.5, y: G, z: 103.5 };

  // ---------------------------------------------------------------- fallen stone
  for (const [x, z] of rubble) {
    const rx = x + ri(-2, 2), rz = z + ri(-2, 2);
    if (rx < 1 || rz < 1 || rx >= W - 1 || rz >= D - 1) continue;
    const t = world.topSolid(rx, rz);
    if (t < G - 1 || t > G + 25) continue;
    if (isAirish(rx, t + 1, rz)) put(rx, t + 1, rz, [B.COBBLE, B.CRACKED, B.GRAVEL, B.MOSSY][ri(0, 3)]);
  }
}
