// Jointed human bodies built from smooth primitives: a shaped torso, two-part limbs with knees and elbows,
// a skull with jaw, nose, brow and ears, and clothing layered on top. Shared by villagers and humanoid foes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// fold every joint's pieces into one mesh: a body becomes ~20 draws instead of ~60
function bake(group, mat) {
  const parts = group.children.filter(c => c.isMesh && c.material === mat);
  if (parts.length > 1) {
    const geos = parts.map(m => { m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix); m.geometry.dispose(); return g; });
    const merged = mergeGeometries(geos, false);
    for (const m of parts) group.remove(m);
    for (const g of geos) g.dispose();
    if (merged) group.add(new THREE.Mesh(merged, mat));
  }
  for (const c of group.children) if (!c.isMesh) bake(c, mat);
}

function colorize(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const V2 = (x, y) => new THREE.Vector2(x, y);

// a limb segment hanging down from its joint
function limb(len, r0, r1) {
  const g = new THREE.CylinderGeometry(r0, r1, len, 10, 1, false);
  g.translate(0, -len / 2, 0);
  return g;
}
function ball(r, sx = 1, sy = 1, sz = 1, seg = 12) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)); g.scale(sx, sy, sz); return g;
}

/**
 * o: { skin, tunic, pants, boots, hair, beard, bald, hood, hat, helm, crown, cloak, apron, robe, belt,
 *      wide, tall, thin, hunch, armor (metal colour: plates on chest/shoulders/shins), item, eyes (glow colour), eyeMat, sockets }
 * returns rig: { root, hips, spine, chest, neck, head, arms:[{up, low, hand}], legs:[{up, low, foot}], hand (right hand mount), eyes[] }
 */
export function buildHuman(mat, o) {
  const root = new THREE.Group();
  mat.side = THREE.DoubleSide; // cloaks, hoods and skirts are open shells
  const wd = o.wide || 1, th = o.thin || 1, tall = o.tall || 1;
  const skin = o.skin ?? 0xb08a70, tunic = o.tunic ?? 0x4a3a30, pants = o.pants ?? 0x2e2626, boots = o.boots ?? 0x1e1812;
  const M = (g, c, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(colorize(g, c), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const J = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const metal = o.armor;

  // proportions (metres): roughly 1.8 tall, hips at 0.95
  const legLen = 0.46 * tall, hipY = legLen * 2 + 0.06, torsoH = 0.58 * tall;
  const body = J(root, 0, 0, 0); body.scale.set(1, 1, 1);
  const hips = J(body, 0, hipY, 0);

  // ---- legs: thigh, knee, shin, foot
  const legs = [];
  for (const s of [-1, 1]) {
    const up = J(hips, s * 0.095 * wd, -0.02, 0);
    M(limb(legLen, 0.11 * wd * th, 0.075 * th), o.robe ? tunic : pants, up);
    M(ball(0.077 * th), o.robe ? tunic : pants, up, 0, -legLen, 0);
    const low = J(up, 0, -legLen, 0);
    M(limb(legLen * 0.62, 0.078 * th, 0.058 * th), o.robe ? tunic : pants, low);
    M(limb(legLen * 0.4, 0.07 * th, 0.06), metal ?? boots, low, 0, -legLen * 0.6, 0);
    const foot = J(low, 0, -legLen, 0);
    const fg = ball(0.06, 0.95, 0.6, 1.9); fg.translate(0, -0.015, 0.06);
    M(fg, metal ?? boots, foot);
    legs.push({ up, low, foot });
  }

  // ---- torso: pelvis → waist → ribcage → shoulders, flattened front to back
  const spine = J(hips, 0, 0, 0);
  const prof = [V2(0.0, -0.08), V2(0.15, -0.06), V2(0.17, 0.02), V2(0.145, 0.16), V2(0.165, 0.3), V2(0.19, 0.42), V2(0.18, 0.5), V2(0.12, 0.56), V2(0.05, 0.585), V2(0.0, 0.59)]
    .map(p => V2(p.x * wd * th, p.y * (torsoH / 0.58)));
  const tg = new THREE.LatheGeometry(prof, 16); tg.scale(1, 1, 0.68);
  M(tg, tunic, spine);
  const chest = J(spine, 0, torsoH * 0.86, 0);
  if (metal) {
    const pl = new THREE.LatheGeometry([V2(0.0, -0.3), V2(0.16, -0.28), V2(0.2, -0.1), V2(0.205, 0.0), V2(0.17, 0.08), V2(0.0, 0.1)].map(p => V2(p.x * wd, p.y)), 14);
    pl.scale(1, 1, 0.74); M(pl, metal, chest, 0, -0.04, 0.005);
    for (const s of [-1, 1]) M(ball(0.11 * wd, 1.1, 0.7, 1), metal, chest, s * 0.2 * wd, 0.02, 0);
  }
  if (o.gaunt) for (let k = 0; k < 5; k++) {
    const rg = new THREE.TorusGeometry(0.15 * wd * th - k * 0.007, 0.014, 5, 14, Math.PI * 0.75); rg.rotateX(Math.PI / 2); rg.rotateY(Math.PI * 0.125); rg.scale(1, 1, 0.78);
    M(rg, o.bone || 0xb0a68c, spine, 0, torsoH * (0.34 + k * 0.085), 0.008);
  }
  if (o.gore != null) mat.uniforms.uGore.value = o.gore;
  if (o.grime != null) mat.uniforms.uGrime.value = o.grime;
  if (o.belt !== false) { const bg = new THREE.TorusGeometry(0.155 * wd * th, 0.025, 6, 18); bg.rotateX(Math.PI / 2); bg.scale(1, 1, 0.7); M(bg, o.belt || 0x2a2018, spine, 0, 0.02, 0); }
  if (o.robe) { const rg = new THREE.CylinderGeometry(0.17 * wd, 0.3 * wd, hipY - 0.06, 16, 1, true); rg.scale(1, 1, 0.8); M(rg, tunic, spine, 0, -(hipY - 0.06) / 2 + 0.02, 0); }
  else { const sk = new THREE.CylinderGeometry(0.165 * wd * th, 0.2 * wd * th, 0.2, 14, 1, true); sk.scale(1, 1, 0.75); M(sk, tunic, spine, 0, -0.1, 0); }
  if (o.apron) { const ag = new THREE.PlaneGeometry(0.3 * wd, 0.62); M(ag, o.apron, spine, 0, 0.0, 0.135 * wd); }
  if (o.cloak) {
    const cg = new THREE.CylinderGeometry(0.21 * wd, 0.34 * wd, 1.15 * tall, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9);
    cg.scale(1, 1, 0.75); M(cg, o.cloak, chest, 0, -0.55 * tall, -0.02);
  }

  // ---- neck & head: skull, jaw, brow, nose, ears, eyes
  const neck = J(chest, 0, 0.07, 0);
  M(limb(0.1, 0.05, 0.055).translate(0, 0.1, 0), skin, neck);
  const head = J(neck, 0, 0.1, 0.01);
  if (o.frog) {
    // a broad, flattened skull, a mouth that runs ear to ear, eyes set high and bulging
    M(ball(0.13, 1.35, 0.72, 1.2, 16), skin, head, 0, 0.1, 0.02);
    for (const s of [-1, 1]) M(ball(0.04, 1, 1, 1, 10), skin, head, s * 0.085, 0.16, 0.06);
  } else M(ball(0.112, 0.92, 1.05, 1.02, 16), skin, head, 0, 0.11, 0);
  if (o.skullFace) { M(ball(0.1, 0.85, 1.1, 0.7, 12), o.skullFace, head, 0, 0.1, 0.05); M(new THREE.ConeGeometry(0.05, 0.16, 6).rotateX(Math.PI / 2 + 0.6), o.skullFace, head, 0, 0.03, 0.1); }
  if (o.antlers) for (const s of [-1, 1]) {
    // branching antlers: a main beam sweeping up and back, tines forking off it
    const beam = new THREE.CylinderGeometry(0.012, 0.022, 0.42, 6); beam.translate(0, 0.21, 0); beam.rotateZ(-s * 0.55); beam.rotateX(-0.35);
    M(beam, o.antlers, head, s * 0.07, 0.2, -0.01);
    for (const [ty, a, l] of [[0.12, 0.9, 0.16], [0.24, 0.5, 0.2], [0.34, 1.1, 0.14], [0.4, 0.2, 0.17]]) {
      const t = new THREE.CylinderGeometry(0.007, 0.013, l, 5); t.translate(0, l / 2, 0); t.rotateZ(-s * a); t.rotateX(-0.1);
      M(t, o.antlers, head, s * (0.07 + Math.sin(0.55) * ty), 0.2 + Math.cos(0.55) * ty * 0.94, -0.01 - Math.sin(0.35) * ty);
    }
  }
  const jaw = J(head, 0, 0.085, 0.0);
  M(ball(0.082, 1.0, 0.85, 1.05), skin, jaw, 0, -0.045, 0.03);                // jaw, hinged below the ears
  jaw.rotation.x = (o.jawOpen || 0) * 0.75;
  if (o.jawOpen) {
    M(ball(0.05, 1.1, 0.9, 0.7), 0x140404, head, 0, 0.055, 0.075);            // the dark of the throat
    if (o.teeth) for (let k = -2; k <= 2; k++) {
      const up = new THREE.ConeGeometry(0.008, 0.03, 4); up.rotateX(Math.PI); M(up, 0xb8ae8c, head, k * 0.016, 0.07, 0.1 - Math.abs(k) * 0.008);
      M(new THREE.ConeGeometry(0.007, 0.026, 4), 0xa89e7c, jaw, k * 0.015, -0.03, 0.09 - Math.abs(k) * 0.008);
    }
  }
  M(ball(0.06, 1.55, 0.35, 0.6), skin, head, 0, 0.125, 0.075);                  // brow ridge
  const nose = new THREE.ConeGeometry(0.018, 0.05, 6); nose.rotateX(-Math.PI / 2 + 0.35); M(nose, skin, head, 0, 0.09, 0.115);
  for (const s of [-1, 1]) M(ball(0.025, 0.45, 1, 0.8), skin, head, s * 0.103, 0.1, 0.0); // ears
  const eyes = [];
  if (o.sunken) for (const s of [-1, 1]) M(ball(0.03, 1.2, 0.95, 0.5, 10), 0x050403, head, s * 0.041, 0.108, 0.088); // hollow sockets
  for (const s of [-1, 1]) {
    if (o.eyes && o.frog) { const e = new THREE.Mesh(ball(0.022, 1, 1, 1, 8), o.eyeMat); e.position.set(s * 0.085, 0.165, 0.095); head.add(e); eyes.push(e); }
    else if (o.eyes && o.sunken) { const e = new THREE.Mesh(ball(0.008, 1, 1, 1, 6), o.eyeMat); e.position.set(s * 0.041, 0.108, o.skullFace ? 0.12 : 0.1); head.add(e); eyes.push(e); }
    else if (o.eyes) { const e = new THREE.Mesh(ball(0.017, 1.2, 0.8, 0.6, 8), o.eyeMat); e.position.set(s * 0.04, 0.11, o.visor ? 0.142 : 0.098); head.add(e); eyes.push(e); }
    else M(ball(0.016, 1.2, 0.75, 0.6, 8), o.sockets ? 0x040404 : 0x16120e, head, s * 0.04, 0.11, 0.097);
  }
  if (o.sockets) M(ball(0.03, 1.3, 1.6, 0.5, 8), 0x040404, head, 0, 0.025, 0.1); // a mouth that is only a hole
  if (o.beard) { const bg = ball(0.085, 1.05, 1.0, 0.75); bg.translate(0, -0.03, 0); M(bg, o.beard, head, 0, 0.03, 0.05); }
  if (o.hair && !o.bald && !o.helm) {
    const hg = new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hg.scale(0.95, 1.05, 1.05);
    M(hg, o.hair, head, 0, 0.11, -0.008);
    const back = ball(0.11, 0.95, 0.9, 0.6); M(back, o.hair, head, 0, 0.06, -0.06);
  }
  if (o.lank) {
    // long, lank, wet hair hanging past the face
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2 + Math.sin(k * 7.3) * 0.2, front = Math.cos(a) > 0.55;
      const L = (front ? 0.22 : 0.3) + Math.abs(Math.sin(k * 3.1)) * 0.22;
      const st = new THREE.ConeGeometry(0.016 + Math.abs(Math.sin(k * 5.7)) * 0.012, L, 4); st.translate(0, -L / 2, 0);
      const m = M(st, o.lank, head, Math.sin(a) * 0.1, 0.2, Math.cos(a) * 0.1);
      m.rotation.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18);
    }
    M(new THREE.SphereGeometry(0.121, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), o.lank, head, 0, 0.115, -0.005);
  }
  if (o.rags) for (let k = 0; k < 14; k++) {
    // tatters hanging from the hem
    const a = (k / 14) * Math.PI * 2, L = 0.12 + Math.abs(Math.sin(k * 4.3)) * 0.28;
    const rg = new THREE.PlaneGeometry(0.06 + Math.abs(Math.sin(k * 2.9)) * 0.05, L); rg.translate(0, -L / 2, 0);
    const m = M(rg, o.rags, spine, Math.sin(a) * 0.19 * wd * th, -0.18, Math.cos(a) * 0.15 * wd * th);
    m.rotation.y = a; m.rotation.x = 0.12;
  }
  if (o.hood) {
    const hd = new THREE.SphereGeometry(0.15, 16, 10, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.75);
    hd.scale(0.95, 1.08, 1.05); M(hd, o.hood, head, 0, 0.1, -0.01);
    const cowl = new THREE.CylinderGeometry(0.13, 0.2, 0.16, 14, 1, true); M(cowl, o.hood, neck, 0, 0.02, -0.01);
  }
  if (o.hat) {
    const br = new THREE.CylinderGeometry(0.25, 0.26, 0.02, 18); M(br, o.hat, head, 0, 0.19, 0);
    const cr = new THREE.CylinderGeometry(0.1, 0.125, 0.14, 14); M(cr, o.hat, head, 0, 0.27, 0);
  }
  if (o.helm) {
    const hm = new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62); hm.scale(1, 1.1, 1.08); M(hm, o.helm, head, 0, 0.09, 0);
    const rim = new THREE.TorusGeometry(0.128, 0.014, 6, 20); rim.rotateX(Math.PI / 2); rim.scale(1, 1, 1.08); M(rim, o.helm, head, 0, 0.1, 0);
    if (o.visor) { const vg = ball(0.13, 1.0, 0.8, 1.05); M(vg, o.helm, head, 0, 0.06, 0.012); M(new THREE.BoxGeometry(0.16, 0.012, 0.02), 0x050505, head, 0, 0.11, 0.135); }
    else M(new THREE.BoxGeometry(0.022, 0.1, 0.02), o.helm, head, 0, 0.1, 0.14);
  }
  if (o.crown) for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, sp = new THREE.ConeGeometry(0.022, 0.1, 5);
    M(sp, o.crown, head, Math.sin(a) * 0.125, 0.25, Math.cos(a) * 0.13);
  }
  if (o.crown) { const band = new THREE.TorusGeometry(0.13, 0.018, 6, 20); band.rotateX(Math.PI / 2); M(band, o.crown, head, 0, 0.2, 0); }
  // a body that burns without being consumed: tongues of flame riding the shoulders, crown and back
  const flames = [];
  if (o.flames && o.flameMat) {
    const F = (parent, x, y, z, s) => { const g = new THREE.ConeGeometry(0.05 * s, 0.22 * s, 6); g.translate(0, 0.11 * s, 0); const m = new THREE.Mesh(g, o.flameMat); m.position.set(x, y, z); parent.add(m); flames.push(m); };
    F(head, 0, 0.2, 0, 1.3); F(head, -0.06, 0.17, -0.04, 0.9); F(head, 0.06, 0.17, -0.04, 0.9);
    F(chest, -0.18, 0.04, 0, 1.1); F(chest, 0.18, 0.04, 0, 1.1); F(chest, 0, 0.0, -0.1, 1.4); F(spine, 0, 0.25, -0.12, 1.2);
  }

  // ---- arms: shoulder, upper arm, elbow, forearm, hand
  const arms = [];
  for (const s of [-1, 1]) {
    const up = J(chest, s * 0.2 * wd, -0.02, 0);
    M(ball(0.08 * wd * th), metal ?? tunic, up);
    const ua = 0.29 * tall * (o.longArms || 1);
    M(limb(ua, 0.068 * th, 0.055 * th), tunic, up);
    const low = J(up, 0, -ua, 0);
    M(ball(0.054 * th), tunic, low);
    M(limb(ua * 0.92, 0.054 * th, 0.04 * th), o.gloves ?? (o.sleeves === false ? skin : tunic), low);
    const hand = J(low, 0, -ua * 0.95, 0);
    const hg = ball(0.042, 0.75, 1.25, 0.95); hg.translate(0, -0.035, 0); M(hg, o.gloves ?? skin, hand);
    up.rotation.z = s * 0.08;
    arms.push({ up, low, hand });
  }
  const mount = J(arms[1].hand, 0, -0.06, 0.02);

  // ---- held things
  const item = (g, c, x, y, z, rx = 0) => { const m = M(g, c, mount, x, y, z); m.rotation.x = rx; return m; };
  const it = o.item;
  if (it === 'staff') item(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 7), 0x4a3420, 0, 0.3, 0.0);
  if (it === 'spear') { item(new THREE.CylinderGeometry(0.02, 0.024, 2.0, 7), 0x4a3420, 0, 0.4, 0); item(new THREE.ConeGeometry(0.04, 0.24, 4), 0x9a9aa0, 0, 1.5, 0); }
  if (it === 'hammer') { item(new THREE.CylinderGeometry(0.02, 0.022, 0.42, 6), 0x4a3420, 0, 0, 0.12, 1.4); item(new THREE.BoxGeometry(0.15, 0.08, 0.09), 0x3a3a3e, 0, 0, 0.32, 1.4); }
  if (it === 'spade') { item(new THREE.CylinderGeometry(0.02, 0.022, 1.3, 6), 0x4a3420, 0, 0.15, 0); item(new THREE.BoxGeometry(0.18, 0.24, 0.02), 0x5a5a5e, 0, -0.55, 0); }
  if (it === 'book') item(new THREE.BoxGeometry(0.16, 0.22, 0.05), 0x3a1a14, 0, -0.06, 0.04);
  if (it === 'sword' || it === 'blade' || it === 'greatsword' || it === 'rusty') {
    const L = it === 'greatsword' ? 1.35 : it === 'rusty' ? 0.7 : 0.85, wdt = it === 'greatsword' ? 0.075 : 0.045;
    const bl = new THREE.BoxGeometry(wdt, 0.012, L); bl.translate(0, 0, L / 2 + 0.08);
    item(bl, it === 'rusty' ? 0x6a5444 : 0x9a9aa4, 0, 0, 0);
    item(new THREE.BoxGeometry(0.18 * (L > 1 ? 1.4 : 1), 0.03, 0.03), 0x3a3030, 0, 0, 0.07);
    item(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6).rotateX(Math.PI / 2), 0x2a1a10, 0, 0, 0.0);
  }

  if (o.hunch) { spine.rotation.x = o.hunch; neck.rotation.x = -o.hunch * 0.6; }
  bake(root, mat);
  return { flames, root, body, hips, hipY, spine, chest, neck, head, jaw, arms, legs, mount, eyes, hunch: o.hunch || 0, armBase: o.armBase || 0, tilt: o.headTilt || 0, jawBase: (o.jawOpen || 0) * 0.75, tw: { t: 0, x: 0, y: 0, z: 0 } };
}

/**
 * Pose a rig each frame.
 * t: walk phase; mv: 0..1 how much it is moving; s: { breathe time, attack 0..1 (raise) / -1 lunge, talk, reach (arms forward), stagger }
 */
export function poseHuman(r, t, mv, s = {}) {
  const sw = Math.sin(t), cw = Math.cos(t);
  for (let i = 0; i < 2; i++) {
    const L = r.legs[i], ph = i ? Math.PI : 0, sl = Math.sin(t + ph);
    L.up.rotation.x = -sl * 0.55 * mv;
    L.low.rotation.x = Math.max(0, Math.sin(t + ph - 1.3)) * 0.95 * mv + 0.04;
    L.foot.rotation.x = -L.low.rotation.x * 0.4 + L.up.rotation.x * -0.2;
  }
  const br = Math.sin((s.time || 0) * 1.7) * 0.012;
  r.hips.position.y = r.hipY - Math.abs(cw) * 0.035 * mv + (1 - mv) * br * 0.3;
  r.spine.rotation.y = sw * 0.12 * mv;
  r.spine.rotation.x = r.hunch + 0.06 * mv + (s.stagger ? -0.25 : 0);
  r.chest.scale.setScalar(1 + br);
  for (let i = 0; i < 2; i++) {
    const A = r.arms[i], ph = i ? 0 : Math.PI, sa = Math.sin(t + ph);
    A.up.rotation.x = sa * 0.5 * mv + r.armBase + (s.reach || 0);
    A.low.rotation.x = -(0.25 + Math.max(0, sa) * 0.45 * mv) - (s.reach ? 0.2 : 0);
    A.up.rotation.z = (i ? 1 : -1) * (0.08 + (s.talk && i ? 0.0 : 0));
  }
  const R = r.arms[1];
  if (s.attack > 0) { R.up.rotation.x = -2.7 * s.attack; R.low.rotation.x = -0.9 * s.attack; r.spine.rotation.y = -0.35 * s.attack; }
  else if (s.attack < 0) { R.up.rotation.x = -0.9; R.low.rotation.x = -0.15; r.spine.rotation.y = 0.3; r.spine.rotation.x += 0.15; }
  if (s.talk) { R.up.rotation.x = -0.45 + Math.sin((s.time || 0) * 2.3) * 0.12; R.low.rotation.x = -0.9; r.head.rotation.x = -0.05 + Math.sin((s.time || 0) * 3.1) * 0.04; }
  else r.head.rotation.x = -r.hunch * 0.3;
  r.head.rotation.y = s.look || 0;
  r.head.rotation.z = r.tilt;
  r.spine.rotation.z = 0;
  if (s.twitch) {
    // the wrongness: sudden snaps of the head, shoulders and arms, held, then dropped; a shiver that never stops
    const tw = r.tw, ag = s.agit || 0; tw.t -= s.dt || 0.016;
    if (tw.t <= 0) {
      const jerk = Math.random() < 0.42 + ag * 0.3;
      tw.t = jerk ? 0.05 + Math.random() * 0.12 : (0.25 + Math.random() * 1.2) * (1 - ag * 0.6);
      tw.x = jerk ? (Math.random() - 0.5) * 1.1 : 0; tw.y = jerk ? (Math.random() - 0.5) * 2.0 : 0; tw.z = jerk ? (Math.random() - 0.5) * 1.4 : 0;
      tw.a0 = jerk && Math.random() < 0.6 ? (Math.random() - 0.5) * 1.6 : 0; tw.a1 = jerk && Math.random() < 0.4 ? (Math.random() - 0.5) * 1.2 : 0;
      tw.sp = jerk ? (Math.random() - 0.5) * 0.4 : 0;
      if (jerk && Math.random() < 0.3) r.crack = true;
    }
    const tr = 0.025 + ag * 0.07, rn = () => (Math.random() - 0.5) * tr;
    r.head.rotation.x += tw.x + rn(); r.head.rotation.y += tw.y + rn(); r.head.rotation.z += tw.z + rn();
    r.arms[0].up.rotation.z += tw.z * 0.5 + (tw.a0 || 0); r.arms[1].up.rotation.z += tw.a1 || 0;
    r.arms[0].low.rotation.x += rn() * 2; r.arms[1].low.rotation.x += rn() * 2;
    r.spine.rotation.z = tw.z * 0.2 + rn() * 0.5; r.spine.rotation.x += tw.sp || 0;
  }
  if (s.limp) { r.legs[0].low.rotation.x *= 0.3; r.hips.position.y -= Math.max(0, Math.sin(t)) * 0.06 * mv; r.spine.rotation.z += Math.sin(t) * 0.12 * mv; }
  if (r.jaw) r.jaw.rotation.x = r.jawBase + (r.jawBase ? Math.max(0, Math.sin((s.time || 0) * 5.3) * Math.sin((s.time || 0) * 2.1)) * 0.25 : 0) + (s.attack > 0 ? 0.3 * s.attack : 0);
}

// Something that was a person, scuttling on hands and feet with its head wrenched up toward you.
export function poseCrawl(r, t, mv, s = {}) {
  r.root.rotation.x = 1.4; r.root.position.set(0, 0.5, -0.85);
  r.hips.position.y = r.hipY;
  const g = Math.sin(t), c = Math.cos(t);
  for (let i = 0; i < 2; i++) {
    const A = r.arms[i], ph = i ? Math.PI : 0, sa = Math.sin(t + ph);
    A.up.rotation.x = -1.25 + sa * 0.45 * mv; A.up.rotation.z = (i ? 1 : -1) * 0.5;
    A.low.rotation.x = -0.6 - Math.max(0, -sa) * 0.6 * mv;
    const L = r.legs[i], sl = Math.sin(t + ph + Math.PI / 2);
    L.up.rotation.x = -1.0 + sl * 0.4 * mv; L.up.rotation.z = (i ? -1 : 1) * 0.55;
    L.low.rotation.x = 1.7 + Math.max(0, sl) * 0.5 * mv;
  }
  r.spine.rotation.x = 0.1 + g * 0.05 * mv; r.spine.rotation.z = c * 0.08 * mv;
  r.neck.rotation.x = -1.35; r.head.rotation.x = -0.3 + (s.attack > 0 ? -0.4 * s.attack : 0);
  r.head.rotation.z = r.tilt + Math.sin((s.time || 0) * 9) * 0.05;
  r.head.rotation.y = 0;
  if (r.jaw) r.jaw.rotation.x = r.jawBase + (s.attack > 0 ? 0.4 : 0);
  if (s.twitch) {
    const tw = r.tw; tw.t -= s.dt || 0.016;
    const ag = s.agit || 0;
    if (tw.t <= 0) { const j = Math.random() < 0.45 + ag * 0.3; tw.t = j ? 0.05 + Math.random() * 0.1 : (0.25 + Math.random()) * (1 - ag * 0.6); tw.z = j ? (Math.random() - 0.5) * 2.0 : 0; tw.y = j ? (Math.random() - 0.5) * 1.6 : 0; tw.a = j ? (Math.random() - 0.5) * 1.2 : 0; if (j && Math.random() < 0.3) r.crack = true; }
    const tr = 0.03 + ag * 0.08;
    r.head.rotation.z += tw.z + (Math.random() - 0.5) * tr; r.head.rotation.y = tw.y + (Math.random() - 0.5) * tr;
    r.arms[(tw.a || 0) > 0 ? 0 : 1].up.rotation.x += tw.a || 0; r.spine.rotation.z += (Math.random() - 0.5) * tr;
  }
}
