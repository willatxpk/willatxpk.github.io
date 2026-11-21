import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// softened boxes: bodies read as flesh and cloth rather than blocks
const rbox = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.42);
import { makeMobMaterial, moveBody, SOLID } from './world.js';
import { buildHuman, poseHuman, poseCrawl } from './body.js';

// the walking dead and the living who prey on travellers, as jointed bodies
const HUMANS = {
  // the Hollowed: starved to the bone, jaw unhinged, neck broken and never set
  ghoul: { skin: 0x56564a, gore: 0.9, grime: 1, tunic: 0x3a3830, sunken: true, lank: 0x14110e, rags: 0x2e2a22, pants: 0x2e2620, boots: 0x231c16, bald: true, thin: 0.72, hunch: 0.42, armBase: -0.6, item: 'rusty', eyes: 0xfff0c0, eyeK: 3, sleeves: false,
    gaunt: true, bone: 0x625c4c, jawOpen: 0.9, teeth: true, headTilt: 0.55, longArms: 1.18, twitch: true, limp: true, belt: false },
  // the Skulker: something that was a person, on all fours, head wrenched up at you
  crawler: { gore: 1, grime: 1, skin: 0x4e4640, tunic: 0x4a423c, pants: 0x443c36, boots: 0x443c36, gloves: 0x4a423c, sunken: true, lank: 0x100d0b, belt: false, thin: 0.62, longArms: 1.5, tall: 1.1,
    gaunt: true, bone: 0x5e564a, jawOpen: 1.0, teeth: true, headTilt: -0.9, eyes: 0xff2a1a, eyeK: 2.2, twitch: true, crawl: true },
  bandit: { gore: 0.25, grime: 0.7, skin: 0x9a7a62, tunic: 0x4a3a2a, pants: 0x2e2a26, hood: 0x2e2620, beard: 0x3a2a1c, item: 'sword', belt: 0x1e140c },
  knight: { gore: 0.45, grime: 0.8, skin: 0x5c5e56, tunic: 0x3a3a40, pants: 0x3a3a40, armor: 0x5e5a56, helm: 0x5e5a56, gloves: 0x4a4744, visor: true, cloak: 0x3a1614, wide: 1.08, item: 'blade', eyes: 0xff7a30, eyeK: 2.4, scale: 1.08 },
  king: { gore: 0.5, grime: 0.7, skin: 0x4a4c46, tunic: 0x2a2228, pants: 0x2a2228, armor: 0x4e4a44, helm: 0x4e4a44, gloves: 0x3a3634, visor: true, crown: 0x8a6a2a, cloak: 0x2a0c0c, wide: 1.12, item: 'greatsword', eyes: 0xff3a20, scale: 1.42 },
  wendigo: { skin: 0x3e3832, tunic: 0x3a332c, pants: 0x332c26, boots: 0x2a2420, gloves: 0x2a2420, bald: true, belt: false, thin: 0.6, tall: 1.42, longArms: 1.75, hunch: 0.55, armBase: -0.35,
    sockets: true, jawOpen: 0.7, teeth: true, gaunt: true, bone: 0x8a8070, antlers: 0x9a8e74, skullFace: 0xb8ae98, grime: 1, gore: 0.6, twitch: true, eyes: 0xe8f0ff, eyeK: 2.5, sunken: true },
  mirekin: { skin: 0x4a5640, tunic: 0x3a4232, pants: 0x3a4232, boots: 0x4a5640, gloves: 0x4a5640, bald: true, belt: false, wide: 1.15, hunch: 0.62, armBase: -0.25, frog: true,
    jawOpen: 0.5, teeth: true, eyes: 0xe8d040, eyeK: 1.8, grime: 1, gore: 0.4, rags: 0x2e3428, twitch: true },
  barkkin: { skin: 0x3a3028, tunic: 0x2e2a22, pants: 0x2a241e, boots: 0x2a241e, gloves: 0x3a3028, bald: true, belt: false, thin: 0.7, tall: 1.25, longArms: 1.4, hunch: 0.3, armBase: -0.5,
    antlers: 0x3a3228, sockets: true, gaunt: true, bone: 0x4a4034, jawOpen: 0.6, teeth: true, grime: 1, gore: 0.3, rags: 0x2a3a24, twitch: true, eyes: 0x9aff9a, eyeK: 1.6 },
  drowned: { skin: 0x8a9090, tunic: 0x4a4e52, pants: 0x3a3e42, boots: 0x2a2c2e, lank: 0x1a1c1c, sunken: true, gaunt: true, bone: 0xc8c4b8, wide: 1.1, hunch: 0.35, armBase: -0.4, hat: 0x2a2a30,
    jawOpen: 0.8, teeth: true, grime: 1, gore: 0.5, rags: 0x6a6e70, eyes: 0x9ad8ff, eyeK: 2, twitch: true, limp: true },
  rimed: { skin: 0xb8c4cc, tunic: 0x8890a0, pants: 0x8a929a, boots: 0x6a7078, robe: true, hood: 0x9aa2ac, bald: true, thin: 0.72, tall: 1.1, hunch: 0.2, sockets: true, jawOpen: 0.7, gaunt: true, bone: 0xd8dce0,
    grime: 0.5, gore: 0.2, eyes: 0xbfe8ff, eyeK: 3, twitch: true },
  cinder: { skin: 0x2a2220, tunic: 0x221a18, pants: 0x221a18, boots: 0x1a1412, gloves: 0x2a2220, bald: true, belt: false, thin: 0.8, hunch: 0.15, sockets: true, jawOpen: 0.6, gaunt: true, bone: 0x5a3a2a,
    flames: true, eyes: 0xff8a30, eyeK: 4, grime: 1, gore: 0, rags: 0x1a1210 },
  // the Lantern-Taker: twice a man's height, starved long, carrying the lanterns of the hunters it has kept
  taker: { skin: 0x8c877c, tunic: 0x7a7468, pants: 0x3e3a34, boots: 0x6a665c, gloves: 0x7e796e, bald: true, belt: false, wide: 1.5, thin: 1.0, tall: 1.12, longArms: 1.95, hunch: 0.6, armBase: -0.05,
    gaunt: true, bone: 0xb4ac98, jawOpen: 1.1, teeth: true, cloak: 0x161210, rags: 0x26221c, grime: 1, gore: 0.8, twitch: true, eyes: 0xdfe8ff, eyeK: 3.4, sleeves: false,
    taker: true, scale: 2.5, stride: 0.42, giant: true },
  watcher: { skin: 0xd9d5cc, tunic: 0xd9d5cc, pants: 0xd9d5cc, boots: 0xd9d5cc, gloves: 0xd9d5cc, bald: true, belt: false, sockets: true, thin: 0.66, tall: 1.45, longArms: 1.55, hunch: 0.08, armBase: 0.05, jawOpen: 1.4, gaunt: true, bone: 0xc8c4ba, grime: 0.25, gore: 0.15 },
};

// wind: seconds of visible wind-up before each blow — step back, dodge [C] or parry with a well-timed guard
export const MOB_TYPES = {
  ghoul: { name: 'Hollowed', hpDice: [2, 8, 2], ac: 12, atk: 3, dmg: [1, 6, 1], speed: 2.7, sense: 13, size: [0.6, 1.85], xp: 50, cd: 1.4, reach: 1.7, wind: 0.6, charge: 2.2 },
  crawler: { name: 'Skulker', hpDice: [2, 6, 1], ac: 13, atk: 3, dmg: [1, 4, 1], speed: 4.3, sense: 11, size: [0.9, 0.75], xp: 35, cd: 1.1, reach: 1.6, wind: 0.45, charge: 1.5 },
  watcher: { name: 'Pale Watcher', hpDice: [6, 10, 8], ac: 14, atk: 6, dmg: [2, 6, 3], speed: 7.5, sense: 999, size: [0.7, 2.7], xp: 300, cd: 1.1, reach: 1.9, wind: 0.35 },
  wolf: { name: 'Grey Wolf', hpDice: [2, 6, 0], ac: 12, atk: 2, dmg: [1, 4, 0], speed: 4.7, sense: 14, size: [0.7, 0.95], xp: 35, cd: 1.6, reach: 1.7, noBurn: true, wind: 0.55, skittish: true },
  bandit: { name: 'Deserter', hpDice: [2, 8, 2], ac: 13, atk: 4, dmg: [1, 6, 2], speed: 3.7, sense: 15, size: [0.6, 1.8], xp: 60, cd: 1.3, reach: 1.8, noBurn: true, wind: 0.55 },
  knight: { name: 'Hollow Knight', hpDice: [5, 10, 5], ac: 16, atk: 5, dmg: [1, 10, 3], speed: 2.5, sense: 10, size: [0.7, 2.0], xp: 180, cd: 1.7, reach: 2.1, noBurn: true, wind: 0.8 },
  king: { name: 'The Hollow King', hpDice: [10, 10, 25], ac: 15, atk: 5, dmg: [2, 6, 2], speed: 2.9, sense: 30, size: [1.0, 2.8], xp: 700, cd: 1.9, reach: 2.7, noBurn: true, wind: 0.95, boss: true },
  // the huntsmen of the Western Lodge, grown tall and antlered between the pines
  wendigo: { name: 'Antlered Stalker', hpDice: [5, 8, 5], ac: 13, atk: 5, dmg: [1, 10, 2], speed: 5.4, sense: 20, size: [0.7, 2.6], xp: 160, cd: 1.3, reach: 2.2, wind: 0.5, charge: 1.6, noBurn: true },
  // the gardeners of the Glasswater, webbed and wide-mouthed, spitting the mire's venom
  mirekin: { name: 'Mire-Kin', hpDice: [3, 8, 3], ac: 12, atk: 4, dmg: [1, 6, 2], speed: 3.3, sense: 15, size: [0.7, 1.6], xp: 85, cd: 1.5, reach: 1.8, wind: 0.55, noBurn: true,
    ranged: { kind: 'spit', range: 14, cd: 3.4, dmg: [1, 6, 1], speed: 15, effect: 'poison', wind: 0.6 } },
  // the forge-hands of the Cinderworks, burning and never consumed
  cinder: { name: 'Cinder Wraith', hpDice: [4, 8, 4], ac: 13, atk: 5, dmg: [1, 8, 2], speed: 3.1, sense: 18, size: [0.7, 1.9], xp: 125, cd: 1.5, reach: 1.9, wind: 0.6, noBurn: true, hover: true,
    ranged: { kind: 'fire', range: 17, cd: 2.9, dmg: [2, 6, 0], speed: 19, effect: 'burn', wind: 0.75 } },
  // the charcoal-burners and woodwardens of the Weeping Wood, grown through with root and bark
  barkkin: { name: 'Bark-Kept', hpDice: [5, 8, 6], ac: 15, atk: 5, dmg: [1, 10, 3], speed: 3.0, sense: 12, size: [0.7, 2.3], xp: 150, cd: 1.5, reach: 2.3, wind: 0.7, charge: 2.0, noBurn: true },
  // the sailors of the First Landing, crusted white with the salt of a sea that went away
  drowned: { name: 'Salt-Drowned', hpDice: [4, 8, 4], ac: 13, atk: 5, dmg: [1, 8, 2], speed: 3.4, sense: 16, size: [0.65, 1.8], xp: 140, cd: 1.4, reach: 1.9, wind: 0.55, charge: 1.8, noBurn: true,
    ranged: { kind: 'spit', range: 13, cd: 3.8, dmg: [1, 8, 1], speed: 16, wind: 0.6 } },
  // the star-monks of the Rimewatch, frozen through and still keeping the vigil
  // the hunter that hunts hunters: for a long time you cannot fight it. Run, break its sight, and hide until it goes
  taker: { name: 'Lantern-Taker', hpDice: [20, 10, 120], ac: 16, atk: 8, dmg: [3, 10, 8], speed: 5.0, sense: 26, size: [0.9, 1.95], xp: 900, cd: 1.9, reach: 3.6, wind: 0.8, charge: 1.2, noBurn: true, giant: true },
  rimed: { name: 'Rime-Kept', hpDice: [4, 8, 5], ac: 14, atk: 6, dmg: [1, 8, 3], speed: 5.0, sense: 18, size: [0.6, 1.95], xp: 170, cd: 1.2, reach: 1.9, wind: 0.45, charge: 1.8, noBurn: true },
};
// the old magic, still in them: what escapes when they die
export const ACCURSED = new Set(['ghoul', 'crawler', 'watcher', 'knight', 'king', 'wendigo', 'mirekin', 'cinder', 'barkkin', 'drowned', 'rimed', 'taker']);

// a short path around walls, ruins and cliffs when the straight line is blocked: breadth-first over standable columns
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function findPath(world, sx, sy, sz, tx, tz, R = 22) {
  const N = R * 2 + 1, ox = Math.floor(sx) - R, oz = Math.floor(sz) - R;
  const Y = new Int16Array(N * N), prev = new Int32Array(N * N).fill(-1);
  const stand = (x, z, y0) => {
    for (const dy of [0, 1, -1, -2, -3]) {
      const y = y0 + dy;
      if (!SOLID[world.get(x, y, z)] && !SOLID[world.get(x, y + 1, z)] && SOLID[world.get(x, y - 1, z)]) return y;
    }
    return -1;
  };
  const si = R * N + R; Y[si] = Math.floor(sy + 0.01); prev[si] = si;
  const gx = Math.max(0, Math.min(N - 1, Math.floor(tx) - ox)), gz = Math.max(0, Math.min(N - 1, Math.floor(tz) - oz)), gi = gz * N + gx;
  const q = [si]; let best = si, bd = Infinity;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], cx = c % N, cz = (c / N) | 0;
    const d = Math.abs(cx - gx) + Math.abs(cz - gz);
    if (d < bd) { bd = d; best = c; }
    if (c === gi) break;
    for (const [dx, dz] of DIRS4) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const ni = nz * N + nx; if (prev[ni] !== -1) continue;
      const y = stand(ox + nx, oz + nz, Y[c]); if (y < 0) continue;
      Y[ni] = y; prev[ni] = c; q.push(ni);
    }
  }
  const pts = [];
  for (let c = best; c !== si; c = prev[c]) pts.push({ x: ox + (c % N) + 0.5, z: oz + ((c / N) | 0) + 0.5 });
  return pts.reverse();
}

function colorize(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export class Mob {
  constructor(type, x, y, z) {
    const T = this.T = MOB_TYPES[type];
    this.type = type;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.half = T.size[0] / 2; this.h = T.size[1];
    let hp = T.hpDice[2]; for (let i = 0; i < T.hpDice[0]; i++) hp += 1 + Math.floor(Math.random() * T.hpDice[1]);
    this.hp = this.maxHp = hp;
    this.aware = false; this.cd = 0.5; this.yaw = Math.random() * 6.28; this.walk = 0;
    this.turnedT = 0; this.burnT = 0; this.hurtT = 0; this.wanderT = 0; this.wdir = [0, 0];
    this.windT = 0; this.lungeT = 0; this.stagT = 0;
    this.blinkT = 5; this.seen = false; this.dead = false; this.dist = 99; this.obs = false; this.obsT = 0;
    this.mat = makeMobMaterial();
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    this.group = new THREE.Group(); this.group.rotation.order = 'YXZ';
    this.limbs = []; this.eyes = [];
    this.build();
  }
  part(w, h, d, color, x, y, z, pivot = false) {
    const g = rbox(w, h, d);
    if (pivot) g.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(colorize(g, color), this.mat);
    m.position.set(x, y, z); this.group.add(m); return m;
  }
  eye(x, y, z, s, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s * 0.5), this.eyeMat);
    this.eyeMat.color.set(color).multiplyScalar(4); // HDR: blooms in the dark
    m.position.set(x, y, z); this.group.add(m); this.eyes.push(m); return m;
  }
  build() {
    const H = HUMANS[this.type];
    if (H) {
      if (H.eyes) this.eyeMat.color.set(H.eyes).multiplyScalar(H.eyeK || 4); // HDR: blooms in the dark
      if (H.taker) this.lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.5, 0.45) });
      if (H.flames) { this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.1, 0.25), transparent: true, opacity: 0.85, depthWrite: false }); }
      this.rig = buildHuman(this.mat, { ...H, eyeMat: this.eyeMat, flameMat: this.flameMat, lampMat: this.lampMat, seed: Math.random() * 100 });
      this.rig.root.scale.setScalar(H.scale || 1);
      this.group.add(this.rig.root); this.eyes.push(...this.rig.eyes);
      return;
    }
    if (this.type === 'wolf') {
      const fur = 0x5a5650, dark = 0x3a3632;
      this.part(0.42, 0.42, 0.95, fur, 0, 0.72, 0);
      this.part(0.46, 0.44, 0.4, dark, 0, 0.78, 0.3);
      const head = this.part(0.3, 0.3, 0.32, fur, 0, 0.9, 0.62);
      this.part(0.16, 0.14, 0.22, dark, 0, 0.84, 0.86);
      this.part(0.07, 0.12, 0.05, dark, -0.09, 1.08, 0.58); this.part(0.07, 0.12, 0.05, dark, 0.09, 1.08, 0.58);
      const tail = this.part(0.1, 0.1, 0.45, dark, 0, 0.82, -0.66); tail.rotation.x = 0.5;
      for (const [lx, lz, ph] of [[-0.14, 0.32, 0], [0.14, 0.32, Math.PI], [-0.14, -0.34, Math.PI], [0.14, -0.34, 0]])
        this.limbs.push({ m: this.part(0.11, 0.55, 0.11, fur, lx, 0.55, lz, true), ph, amp: 0.7 });
      this.eye(-0.08, 0.95, 0.785, 0.04, 0xb0a040); this.eye(0.08, 0.95, 0.785, 0.04, 0xb0a040);
      this.eyeMat.color.multiplyScalar(0.25);
      void head;
    }
  }

  // G: game context
  update(dt, G) {
    const T = this.T, p = G.ppos;
    this.cd -= dt; this.turnedT -= dt;
    this.hurtT = Math.max(0, this.hurtT - dt * 3); this.mat.uniforms.uHurt.value = this.hurtT;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dy = p.y - this.pos.y;
    const dist = this.dist = Math.hypot(dx, dy, dz);
    const [s, b] = G.world.lightAt(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.6), Math.floor(this.pos.z));
    this.mat.uniforms.uLight.value.set(s / 15, b / 15);
    this.envLight = Math.max((s / 15) * (s / 15) * G.sun, Math.pow(b / 15, 1.6));

    // a corpse in the road is not always a corpse
    if (this.dormant || this.riseT > 0) {
      if (this.dormant && (dist < 3.3 || this.hp < this.maxHp)) { this.dormant = false; this.riseT = 0.8; this.yaw = Math.atan2(dx, dz); G.onRise?.(this); }
      if (!this.dormant) this.riseT -= dt;
      const k = this.dormant ? 1 : Math.max(0, this.riseT / 0.8);
      if (this.rig) {
        this.rig.root.rotation.x = -1.45 * k * k; this.rig.root.position.y = 0.14 * k;
        poseHuman(this.rig, 0, 0, { time: (this.age = (this.age || 0) + dt), dt, twitch: !this.dormant, attack: this.dormant ? 0 : 0.6 });
        if (this.dormant) { this.rig.jaw.rotation.x = 0.9; this.rig.head.rotation.z = 1.0; }
      }
      this.vel.x = 0; this.vel.z = 0; this.vel.y = Math.max(-30, this.vel.y - 26 * dt); moveBody(G.world, this, dt);
      this.group.position.copy(this.pos); this.group.rotation.y = this.yaw; this.group.rotation.x = 0;
      this.eyeMat.visible = !this.dormant; this.eyeMat.opacity = 1;
      if (!this.dormant && this.riseT <= 0) { this.riseT = 0; this.aware = true; this.sprintT = (T.charge || 1) + 0.5; if (this.rig) { this.rig.root.rotation.x = 0; this.rig.root.position.y = 0; } }
      return;
    }
    // broken: on its knees, the Gloam loosening its grip. Strike it down, or perform the Rite of Return [H]
    if (this.brokenT > 0) {
      this.brokenT -= dt; this.windT = 0; this.age = (this.age || 0) + dt;
      this.vel.x = 0; this.vel.z = 0; this.vel.y = Math.max(-30, this.vel.y - 26 * dt); moveBody(G.world, this, dt);
      if (this.rig) {
        (HUMANS[this.type].crawl ? poseCrawl : poseHuman)(this.rig, 0, 0, { time: this.age, dt, stagger: true, twitch: true });
        this.rig.root.position.y = HUMANS[this.type].crawl ? -0.1 : -0.42; this.rig.root.rotation.x = 0.32;
        this.rig.head.rotation.x = 0.5;
      }
      this.group.position.copy(this.pos); this.group.rotation.y = this.yaw; this.group.rotation.x = 0;
      this.mat.uniforms.uHurt.value = Math.max(this.mat.uniforms.uHurt.value, 0.08 + 0.06 * Math.sin(this.age * 6));
      if (this.eyes.length) { this.eyeMat.opacity = 0.25 + 0.15 * Math.sin(this.age * 9); this.eyeMat.visible = true; }
      if (this.brokenT <= 0) {
        this.brokenT = 0; this.aware = true; this.lostT = 0;
        if (this.rig) { this.rig.root.position.y = 0; this.rig.root.rotation.x = 0; }
        G.onRecover?.(this);
      }
      return;
    }
    let mvx = 0, mvz = 0, speed = T.speed;
    // the hunter's eyes and ears, asked a few times a second
    this.perT = (this.perT || 0) - dt;
    if (this.perT <= 0) { this.perT = 0.18 + Math.random() * 0.1; this.per = G.perceive(this); }
    // daylight slows the Gloam-kept that dare it
    if (this.sprintT > 0) { this.sprintT -= dt; speed *= T.giant ? 1.3 : 2.1; }
    if (this.slowT > 0) speed *= 0.5;
    const hd = Math.hypot(dx, dz) || 1;

    if (this.type === 'watcher') {
      if (G.sun > 0.3) { G.mobVanish(this, 'dissolves into the grey morning'); return; }
      this.obs = G.isObserved(this);
      if (this.obs) {
        this.obsT += dt;
        if (!this.seen) { this.seen = true; G.onWatcherSeen(this); }
        if (dist < 11) {
          this.blinkT -= dt;
          if (this.blinkT <= 0) { this.blinkT = 3.5 + Math.random() * 3; if (Math.random() < 0.5) G.blink(this); }
        }
      } else {
        this.obsT = 0;
        // it cannot reach you behind a shut door or inside a log: it waits outside instead
        if (dist > 1.4 && !(G.hidden && dist < 4)) { mvx = dx / hd; mvz = dz / hd; }
      }
      this.aware = true;
    } else {
      if (this.hunter && !T.noBurn && G.sun > 0.5) speed *= 0.7;
      if (!T.noBurn && !this.home && !this.hunter && G.sun > 0.5 && s >= 12) { // sunlight burns night-things
        this.burnT += dt;
        if (this.burnT > 0.7) { this.burnT = 0; G.mobBurn(this); if (this.dead) return; }
      }
      const homeD = this.home ? Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) : 0;
      if (!this.aware) {
        if (this.per && !this.stalk) { this.aware = true; this.lostT = 0; this.searchT = 0; G.onAware(this); if (T.charge) this.sprintT = T.charge; }
        else if (this.lastKnown) {
          // it heard you, smelled you, or lost you: go to where you were, and look
          const lx = this.lastKnown.x - this.pos.x, lz = this.lastKnown.z - this.pos.z, ll = Math.hypot(lx, lz);
          if (ll > 2.2 && !(this.searchT > 0) && !((this.goT = (this.goT || 0) + dt) > 25)) { mvx = lx / ll; mvz = lz / ll; speed *= this.stalk ? 0.95 : T.giant ? 1 : this.hunter ? 0.8 : 0.6; this.navTo = this.lastKnown; }
          else if (this.stalk) { mvx = 0; mvz = 0; }
          else {
            if (!(this.searchT > 0)) { this.searchT = 3.5 + Math.random() * 3.5; this.goT = 0; G.onSearch?.(this); }
            this.searchT -= dt;
            // pacing, sniffing, head turning: it is checking
            const a = (this.age || 0) * 0.9 + this.pos.x;
            mvx = Math.sin(a) * 0.5; mvz = Math.cos(a * 1.3) * 0.5; speed *= 0.3;
            if (this.searchT <= 0) { this.searchT = 0; this.lastKnown = null; this.goT = 0; G.onGiveUp?.(this); }
          }
        }
        else if (this.home && homeD > 3) {
          // guards drift back to their post
          const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hl = Math.hypot(hx, hz) || 1;
          mvx = hx / hl; mvz = hz / hl; speed *= 0.6;
        } else {
          this.wanderT -= dt;
          if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 4; const a = Math.random() * 6.28; this.wdir = Math.random() < (this.home ? 0.6 : 0.4) ? [0, 0] : [Math.cos(a), Math.sin(a)]; }
          mvx = this.wdir[0]; mvz = this.wdir[1]; speed *= 0.35;
        }
      } else if (this.per) { this.lostT = 0; this.lastKnown = { x: p.x, y: p.y, z: p.z }; }
      else if (this.turnedT <= 0) {
        // out of sight: it keeps coming to where it last saw you, then has to search
        this.lostT = (this.lostT || 0) + dt;
        if (this.lostT > (this.hunter ? 2.2 : 1.4)) { this.aware = false; this.searchT = 0; this.goT = 0; this.lastKnown ??= { x: p.x, y: p.y, z: p.z }; G.onLose?.(this); }
      }
      if (this.aware && T.skittish && this.hp < this.maxHp * 0.45 && !this.fled) { this.fled = true; this.turnedT = 8; G.mobFlee?.(this); }
      // ranged hunters keep their distance and loose at you
      const RG = T.ranged;
      if (RG && this.aware && this.turnedT <= 0) {
        this.shotCd = (this.shotCd ?? 1.5) - dt;
        if (dist > 3.2 && dist < RG.range) {
          if (dist < 7) { mvx = -dx / hd * 0.7 + dz / hd * 0.5; mvz = -dz / hd * 0.7 - dx / hd * 0.5; }
          else if (dist < RG.range * 0.75) { const s2 = Math.sin(this.age || 0) > 0 ? 1 : -1; mvx = dz / hd * 0.45 * s2; mvz = -dx / hd * 0.45 * s2; }
          if (this.shotCd <= 0 && this.windT <= 0 && this.stagT <= 0 && G.canShoot?.(this)) { this.windT = RG.wind; this.shooting = true; G.mobWindup?.(this); }
        }
      }
      // raiders march on the colony until something living gets in the way
      if (!this.aware && this.goal) {
        const gx = this.goal.x - this.pos.x, gz = this.goal.z - this.pos.z, gl = Math.hypot(gx, gz);
        if (gl > 3) { mvx = gx / gl; mvz = gz / gl; speed = T.speed * 0.8; this.navTo = this.goal; }
      }
      // mid-chase they lurch forward in sudden bursts
      if (this.aware && T.charge && !(this.sprintT > 0) && dist < 18 && Math.random() < dt * (T.giant ? 0.12 : 0.3)) this.sprintT = 0.55;
      if (this.aware) {
        const lk = !this.per && this.lastKnown;
        const tx = lk ? this.lastKnown.x - this.pos.x : dx, tz = lk ? this.lastKnown.z - this.pos.z : dz, tl = Math.hypot(tx, tz) || 1;
        if (this.turnedT > 0) { mvx = -dx / hd; mvz = -dz / hd; speed *= 1.1; }
        else if (lk ? tl > 0.8 : dist > 1.25) { mvx = tx / tl; mvz = tz / tl; this.navTo = lk ? this.lastKnown : p; }
        if (dist > 48 || (this.home && homeD > 24)) { this.aware = false; this.lastKnown = null; }
      }
    }

    if (this.stagT > 0) { this.stagT -= dt; mvx = 0; mvz = 0; this.windT = 0; }
    if (this.windT > 0 || this.holdT > 0) { mvx = 0; mvz = 0; }
    // the wrongness in how they move: stop dead, then lunge; jink side to side as they close
    if (HUMANS[this.type]?.twitch && this.aware && this.turnedT <= 0 && !(this.stagT > 0) && (mvx || mvz)) {
      if (this.frzT > 0) { this.frzT -= dt; mvx = 0; mvz = 0; if (this.frzT <= 0) this.sprintT = Math.max(this.sprintT || 0, 0.3 + Math.random() * 0.25); }
      else {
        if (dist > 4 && Math.random() < dt * 0.45) this.frzT = 0.15 + Math.random() * 0.3;
        if (dist > 3.5 && dist < 18) {
          this.jukeT = (this.jukeT || 0) - dt;
          if (this.jukeT <= 0) { this.jukeT = 0.25 + Math.random() * 0.5; this.jukeS = Math.random() < 0.35 ? 0 : Math.random() < 0.5 ? -1 : 1; }
          if (this.jukeS) { const jx = mvx - mvz * this.jukeS * 0.75, jz = mvz + mvx * this.jukeS * 0.75, jl = Math.hypot(jx, jz) || 1; mvx = jx / jl; mvz = jz / jl; }
        }
      }
    }
    // follow a path around whatever was in the way
    if (this.path && (mvx || mvz)) {
      this.pathT -= dt;
      while (this.path.length && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.6) this.path.shift();
      if (!this.path.length || this.pathT <= 0 || (this.aware && this.per && dist < 3)) this.path = null;
      else { const wx = this.path[0].x - this.pos.x, wz = this.path[0].z - this.pos.z, wl = Math.hypot(wx, wz) || 1; mvx = wx / wl; mvz = wz / wl; }
    }
    // detour around obstacles when stuck
    if (this.detourT > 0 && (mvx || mvz)) {
      this.detourT -= dt;
      const sx = mvx * 0.35 - mvz * this.detourSide, sz = mvz * 0.35 + mvx * this.detourSide, sl = Math.hypot(sx, sz) || 1;
      mvx = sx / sl; mvz = sz / sl;
    }
    if (mvx || mvz) {
      const target = Math.atan2(mvx, mvz);
      let da = target - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      this.yaw += da * Math.min(1, dt * 8);
    } else if (this.aware || this.holdT > 0) {
      this.yaw = Math.atan2(dx, dz);
    }
    this.vel.x = mvx * speed; this.vel.z = mvz * speed;
    this.vel.y = Math.max(-30, this.vel.y - 26 * dt);
    const bx = this.pos.x, bz = this.pos.z;
    const blocked = moveBody(G.world, this, dt);
    if (blocked && this.onGround && (mvx || mvz)) this.vel.y = this.type === 'crawler' ? 8.6 : 8.1;
    if ((mvx || mvz) && (this.aware || this.goal || this.lastKnown) && !(this.detourT > 0) && !this.path) {
      const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      this.stuckT = moved < speed * dt * 0.3 ? (this.stuckT || 0) + dt : Math.max(0, (this.stuckT || 0) - dt);
      if (this.stuckT > 0.7) {
        this.stuckT = 0;
        const to = this.navTo;
        const path = to && !this.path ? findPath(G.world, this.pos.x, this.pos.y, this.pos.z, to.x, to.z) : null;
        if (path && path.length > 1) { this.path = path; this.pathT = this.aware ? 4 : 10; }
        else { this.path = null; this.detourT = 0.8 + Math.random() * 0.9; this.detourSide = Math.random() < 0.5 ? 1 : -1; }
      }
    }
    if (this.pos.y < -5) { G.mobVanish(this, null); return; }

    const canAttack = (this.type === 'watcher' ? !this.obs && !G.hidden : this.turnedT <= 0) && this.stagT <= 0;
    if (this.windT > 0) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.cd = T.cd; this.lungeT = 0.2;
        if (this.shooting) { this.shooting = false; this.shotCd = T.ranged.cd * (0.8 + Math.random() * 0.4); if (canAttack) G.mobShoot?.(this); }
        else if (canAttack && dist < T.reach + 0.7 && Math.abs(dy) < 1.8) G.mobAttack(this); else G.mobWhiff?.(this);
      }
    } else if (this.aware && canAttack && dist < T.reach && Math.abs(dy) < 1.8 && this.cd <= 0) {
      this.windT = T.wind || 0.5; G.mobWindup?.(this);
    }
    this.lungeT = Math.max(0, this.lungeT - dt);

    // animation
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.2;
    this.walk += dt * (moving ? speed * 2.4 * (HUMANS[this.type]?.stride || 1) : 0);
    if (T.giant && this.rig) {
      // every footfall lands; and the lanterns it carries clink as it comes
      const ph = Math.sin(this.walk) > 0;
      if (moving && ph !== this._ph) G.onStomp?.(this);
      this._ph = ph;
      this.chT = (this.chT || 0) - dt * (moving ? 1 : 0.25);
      if (this.chT <= 0) { this.chT = 0.5 + Math.random() * 0.8; G.onChains?.(this); }
      // under a low roof it folds itself down to fit
      const fx = Math.floor(this.pos.x), fy = Math.floor(this.pos.y), fz = Math.floor(this.pos.z);
      const low = SOLID[G.world.get(fx, fy + 2, fz)] || SOLID[G.world.get(fx, fy + 3, fz)] || SOLID[G.world.get(fx, fy + 4, fz)];
      this.ceilK = (this.ceilK || 0) + ((low ? 1 : 0) - (this.ceilK || 0)) * Math.min(1, dt * 4);
      const sc = HUMANS[this.type].scale; this.rig.root.scale.set(sc, sc * (1 - 0.6 * this.ceilK), sc);
      const age = this.age || 0;
      this.rig.lamps.forEach((l, i) => { l.rotation.x = Math.sin(age * 2.1 + i * 1.7) * 0.22 + (moving ? Math.sin(this.walk * 2 + i) * 0.3 : 0); l.rotation.z = Math.sin(age * 1.6 + i * 2.3) * 0.18; });
      const k = 0.75 + Math.random() * 0.35; this.lampMat.color.setRGB(3.0 * k, 1.5 * k, 0.45 * k);
    }
    if (this.rig) {
      this.mvK = (this.mvK || 0) + ((moving ? 1 : 0) - (this.mvK || 0)) * Math.min(1, dt * 8); this.age = (this.age || 0) + dt;
      const wk0 = this.windT > 0 ? 1 - this.windT / (T.wind || 0.5) : 0;
      // the head turns to follow you, further than a neck should allow
      let rel = Math.atan2(dx, dz) - this.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const lk = (this.aware || dist < 12 || this.holdT > 0) ? Math.max(-1.6, Math.min(1.6, rel)) * (this.type === 'watcher' || this.type === 'ghoul' ? 1 : 0.6) : 0;
      this.lookK = (this.lookK || 0) + (lk - (this.lookK || 0)) * Math.min(1, dt * (this.type === 'watcher' ? 1.2 : 6));
      const H = HUMANS[this.type], st = { time: this.age, dt, look: this.lookK, attack: this.windT > 0 ? Math.min(1, wk0 * 1.6) : this.lungeT > 0 ? -1 : 0, stagger: this.stagT > 0, twitch: H.twitch, limp: H.limp && !(this.sprintT > 0), agit: this.aware ? 1 : (this.lastKnown || this.holdT > 0) ? 0.55 : 0.15 };
      (H.crawl ? poseCrawl : poseHuman)(this.rig, this.walk * (this.type === 'watcher' ? 0.5 : 1), this.mvK, st);
      if (this.rig.crack) { this.rig.crack = false; G.onTwitch?.(this); }
    }
    for (const L of this.limbs) {
      const sw = Math.sin(this.walk + L.ph) * L.amp * (moving ? 1 : 0.15);
      if (L.axis === 'x') L.m.rotation.x = sw; else L.m.rotation.x = (L.base || 0) + sw;
      if (L.atk && this.windT > 0) L.m.rotation.x = -2.6;
      else if (L.atk && this.lungeT > 0) L.m.rotation.x = -0.2;
    }
    // telegraph: rear back and glow before the blow, lunge on release, reel when parried
    const wk = this.windT > 0 ? 1 - this.windT / (T.wind || 0.5) : 0;
    let hold = false;
    if (HUMANS[this.type]?.twitch && !this.dormant && !T.hover) {
      if (this.glT > 0) { this.glT -= dt; this.glA = (this.glA || 0) + dt; if (this.glA < 0.09) hold = true; else this.glA = 0; }
      else if (Math.random() < dt * (this.aware ? 0.55 : this.holdT > 0 ? 0.8 : 0.1)) this.glT = 0.35 + Math.random() * 0.6;
    }
    if (!hold) this.group.position.copy(this.pos);
    if (HUMANS[this.type]?.twitch && (this.aware || this.holdT > 0) && !hold) { const j = this.aware ? 0.045 : 0.025; this.group.position.x += (Math.random() - 0.5) * j; this.group.position.z += (Math.random() - 0.5) * j; }
    if (T.hover) this.group.position.y += 0.3 + Math.sin((this.age || 0) * 2.2) * 0.12;
    if (this.rig?.flames) for (const f of this.rig.flames) { const k = 0.7 + Math.random() * 0.6; f.scale.set(k, 0.8 + Math.random() * 0.8, k); }
    this.group.rotation.y = this.yaw;
    this.group.rotation.x = this.stagT > 0 ? Math.sin(this.stagT * 18) * 0.12 - 0.15 : this.windT > 0 ? -0.28 * wk : this.lungeT > 0 ? 0.3 * (this.lungeT / 0.2) : 0;
    if (this.windT > 0) this.mat.uniforms.uHurt.value = Math.max(this.mat.uniforms.uHurt.value, 0.15 + 0.3 * wk);
    // glowing eyes fade with distance — sometimes they're all you see
    if (this.eyes.length) {
      const o = T.giant ? Math.max(0, Math.min(1, (60 - dist) / 20)) : Math.max(0, Math.min(1, (34 - dist) / 14));
      this.eyeMat.opacity = Math.min(1, o * (this.turnedT > 0 ? 0.3 : 1) + (this.windT > 0 ? 0.6 : 0));
      this.eyeMat.visible = o > 0.02;
    }
  }
  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.mat.dispose(); this.eyeMat.dispose(); this.flameMat?.dispose(); this.lampMat?.dispose();
  }
}
