// First-person arms: modelled weapons (shaped blades, wrapped grips, crescent axe heads, a recurve bow)
// and how each one moves when you swing, chop, thrust or draw.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function tint(g, hex) {
  if (g.index) g = g.toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };

// a blade: tapered, pointed, with bevelled edges so light runs along them
function bladeGeo(len, w, thick, tipLen) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w * 0.42, len - tipLen); s.quadraticCurveTo(-w * 0.2, len - tipLen * 0.35, 0, len);
  s.quadraticCurveTo(w * 0.2, len - tipLen * 0.35, w * 0.42, len - tipLen); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick * 0.2, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: w * 0.16, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -thick * 0.1); return g;
}
function grip(len, r, col, parts) {
  parts.push([new THREE.CylinderGeometry(r, r * 1.05, len, 10), col]);
  for (let i = 0; i < 5; i++) parts.push([at(new THREE.TorusGeometry(r * 1.02, r * 0.18, 4, 12), 0, -len / 2 + (i + 0.5) * len / 5, 0, Math.PI / 2), 0x1e140c]);
}

/** builds the weapon held in the right hand; returns { group, kind, string? } */
export function buildWeapon(key, metal, wood) {
  const M = [], W = []; // [geometry, colour] for metal and for wood/leather
  let kind = 'slash';
  const steel = 0x80848c, dark = 0x5a5650, brass = 0x9a7a3a, leather = 0x3a2416, oak = 0x5a3c22;
  // an axe head: a crescent with a bearded lower edge, at any size
  const crescent = k => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.0); s.lineTo(0.06 * k, 0.02 * k); s.quadraticCurveTo(0.12 * k, 0.0, 0.2 * k, -0.1 * k);
    s.quadraticCurveTo(0.27 * k, 0.06 * k, 0.24 * k, 0.24 * k); s.quadraticCurveTo(0.14 * k, 0.18 * k, 0.06 * k, 0.18 * k); s.lineTo(0, 0.17 * k); s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 });
  };
  const shaft = (len, r, col, y) => W.push([at(new THREE.CylinderGeometry(r, r * 1.15, len, 10), 0, y, 0), col]);
  const BLADES = {
    estoc: { L: 0.95, w: 0.024, col: 0x9aa0a8, gw: 0.16, gc: brass, pom: brass, kind: 'stab' },
    vanesabre: { L: 0.8, w: 0.042, col: 0x8a8e94, gw: 0.14, gc: brass, pom: brass, kind: 'slash' },
    gloamfang: { L: 0.74, w: 0.06, col: 0x1a171e, ful: 0x3a0c10, gw: 0.18, gc: 0x1a1416, pom: 0x8a1010, kind: 'slash' },
    moonblade: { L: 0.95, w: 0.055, col: 0xdfe6f2, ful: 0xb8c8e0, gw: 0.22, gc: 0xc8d0dc, pom: 0xe8eef8, kind: 'slash' },
  };
  if (BLADES[key]) {
    const b = BLADES[key];
    M.push([at(bladeGeo(b.L, b.w, 0.008, b.w * 2.2), 0, 0.1, 0), b.col]);
    if (b.ful) M.push([at(new THREE.BoxGeometry(b.w * 0.22, b.L * 0.7, 0.0125), 0, 0.1 + b.L * 0.38, 0), b.ful]);
    M.push([at(new THREE.CylinderGeometry(0.011, 0.014, b.gw, 8), 0, 0.09, 0, 0, 0, Math.PI / 2), b.gc]);
    if (key === 'estoc') M.push([at(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.07, 0), b.gc]); // cup hilt
    grip(0.16, 0.015, leather, W);
    M.push([at(new THREE.SphereGeometry(0.026, 10, 8), 0, -0.1, 0), b.pom]);
    kind = b.kind;
  } else if (key === 'cleaver') {
    M.push([at(new THREE.BoxGeometry(0.1, 0.5, 0.01), 0.02, 0.36, 0), steel]);
    for (let i = 0; i < 7; i++) M.push([at(new THREE.ConeGeometry(0.01, 0.025, 4), -0.035, 0.16 + i * 0.06, 0, 0, 0, Math.PI / 2), dark]); // the saw
    M.push([at(new THREE.BoxGeometry(0.12, 0.02, 0.02), 0.02, 0.1, 0), dark]);
    grip(0.16, 0.017, leather, W);
    kind = 'slash';
  } else if (key === 'hatchet' || key === 'wardenaxe') {
    const big = key === 'wardenaxe';
    shaft(big ? 0.95 : 0.5, big ? 0.019 : 0.015, big ? 0x2a2420 : oak, big ? 0.3 : 0.15);
    grip(0.12, big ? 0.022 : 0.018, leather, W);
    M.push([at(crescent(big ? 1.05 : 0.55), 0.01, big ? 0.6 : 0.33, -0.004), big ? 0x4e6a5a : 0x6e7076]);
    kind = 'chop';
  } else if (key === 'halberd') {
    shaft(1.5, 0.016, oak, 0.45);
    M.push([at(crescent(0.85), 0.012, 0.92, -0.004), 0x6e7076]);
    M.push([at(bladeGeo(0.22, 0.035, 0.008, 0.08), 0, 1.16, 0), steel]);
    M.push([at(new THREE.ConeGeometry(0.018, 0.12, 6), -0.07, 1.02, 0, 0, 0, Math.PI / 2 - 0.4), dark]);
    kind = 'chop';
  } else if (key === 'spear') {
    shaft(1.45, 0.015, oak, 0.42);
    M.push([at(bladeGeo(0.24, 0.055, 0.008, 0.1), 0, 1.13, 0), steel]);
    M.push([at(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), 0, 1.1, 0, 0, 0, Math.PI / 2), dark]);
    kind = 'stab';
  } else if (key === 'rimeglaive') {
    shaft(1.3, 0.016, 0x6a7078, 0.38);
    M.push([at(bladeGeo(0.5, 0.075, 0.009, 0.16), 0, 1.02, 0), 0xbfd4e4]);
    M.push([at(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), 0, 1.02, 0), 0x9aa8b8]);
    kind = 'slash';
  } else if (key === 'scythe') {
    shaft(1.3, 0.015, oak, 0.4);
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.25, 0.09, 0.52, -0.06); s.lineTo(0.5, -0.09); s.quadraticCurveTo(0.25, 0.03, 0, -0.05); s.lineTo(0, 0);
    M.push([at(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 10 }), 0, 1.04, -0.003), 0x6a7a62]);
    W.push([at(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), 0.05, 0.62, 0, 0, 0, Math.PI / 2), oak]); // the hand-grip on the snath
    kind = 'slash';
  } else if (key === 'warhammer' || key === 'maul') {
    const big = key === 'maul';
    shaft(big ? 0.85 : 0.75, big ? 0.021 : 0.017, oak, big ? 0.25 : 0.22);
    grip(0.14, big ? 0.024 : 0.02, leather, W);
    const y = big ? 0.66 : 0.58;
    M.push([at(new THREE.BoxGeometry(big ? 0.24 : 0.15, big ? 0.14 : 0.075, big ? 0.14 : 0.075), big ? 0 : 0.02, y, 0), big ? 0x3a3634 : dark]);
    if (big) for (const x of [-0.08, 0.08]) M.push([at(new THREE.BoxGeometry(0.02, 0.15, 0.15), x, y, 0), 0x2a2624]);
    else M.push([at(new THREE.ConeGeometry(0.022, 0.11, 6), -0.1, y, 0, 0, 0, Math.PI / 2), dark]);
    kind = 'chop';
  } else if (key === 'flail') {
    shaft(0.32, 0.018, oak, 0.05);
    grip(0.12, 0.021, leather, W);
    for (let i = 0; i < 4; i++) M.push([at(new THREE.TorusGeometry(0.014, 0.004, 4, 8), 0, 0.24 + i * 0.045, 0, 0, i % 2 ? Math.PI / 2 : 0, 0), dark]);
    M.push([at(new THREE.SphereGeometry(0.05, 10, 8), 0, 0.46, 0), 0x4a4640]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.push([at(new THREE.ConeGeometry(0.012, 0.05, 4), Math.cos(a) * 0.055, 0.46 + (i % 2 ? 0.02 : -0.02), Math.sin(a) * 0.055, 0, -a, -Math.PI / 2), dark]); }
    kind = 'chop';
  } else if (key === 'sword' || key === 'kingblade' || key === 'dagger' || key === 'greatsword') {
    const L = key === 'kingblade' ? 1.0 : key === 'greatsword' ? 1.15 : key === 'dagger' ? 0.27 : 0.78, w = key === 'kingblade' ? 0.068 : key === 'greatsword' ? 0.078 : key === 'dagger' ? 0.036 : 0.05;
    const bc = key === 'kingblade' ? 0x4e4a52 : steel;
    M.push([at(bladeGeo(L, w, 0.008, w * 2.2), 0, 0.1, 0), bc]);
    M.push([at(new THREE.BoxGeometry(w * 0.22, L * 0.7, 0.0125), 0, 0.1 + L * 0.38, 0), key === 'kingblade' ? 0x2a2630 : 0x7a7e86]); // fuller
    const gw = key === 'dagger' ? 0.09 : key === 'kingblade' ? 0.26 : 0.2;
    M.push([at(new THREE.CylinderGeometry(0.011, 0.014, gw, 8), 0, 0.09, 0, 0, 0, Math.PI / 2), key === 'kingblade' ? 0x2a2420 : dark]);
    for (const s of [-1, 1]) M.push([at(new THREE.SphereGeometry(0.016, 8, 6), s * gw / 2, 0.09, 0), key === 'kingblade' ? brass : dark]);
    grip(key === 'dagger' ? 0.1 : 0.16, 0.015, leather, W);
    M.push([at(new THREE.SphereGeometry(0.026, 10, 8), 0, -0.1, 0), key === 'kingblade' ? 0x8a1010 : dark]);
    kind = key === 'dagger' ? 'stab' : 'slash';
  } else if (key === 'greataxe') {
    W.push([at(new THREE.CylinderGeometry(0.017, 0.021, 1.0, 10), 0, 0.32, 0), oak]);
    for (const y of [-0.12, 0.62, 0.74]) M.push([at(new THREE.CylinderGeometry(0.023, 0.023, 0.03, 10), 0, y, 0), dark]);
    const s = new THREE.Shape();           // crescent head with a bearded lower edge
    s.moveTo(0, 0.0); s.lineTo(0.06, 0.02); s.quadraticCurveTo(0.12, 0.0, 0.2, -0.1);
    s.quadraticCurveTo(0.27, 0.06, 0.24, 0.24); s.quadraticCurveTo(0.14, 0.18, 0.06, 0.18); s.lineTo(0, 0.17); s.lineTo(0, 0);
    const hg = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 });
    M.push([at(hg, 0.01, 0.6, -0.004, 0, 0, 0), 0x6e7076]);
    M.push([at(new THREE.ConeGeometry(0.02, 0.09, 6), -0.06, 0.69, 0, 0, 0, Math.PI / 2), dark]); // back spike
    kind = 'chop';
  } else if (key === 'mace') {
    W.push([at(new THREE.CylinderGeometry(0.016, 0.02, 0.5, 10), 0, 0.12, 0), oak]);
    grip(0.14, 0.02, leather, W);
    M.push([at(new THREE.SphereGeometry(0.045, 12, 10), 0, 0.42, 0), dark]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.push([at(new THREE.BoxGeometry(0.008, 0.11, 0.05), Math.cos(a) * 0.04, 0.42, Math.sin(a) * 0.04, 0, -a, 0), 0x6a665e]); }
    M.push([at(new THREE.ConeGeometry(0.02, 0.05, 6), 0, 0.49, 0), dark]);
    kind = 'chop';
  } else if (key === 'club') {
    W.push([at(new THREE.CylinderGeometry(0.046, 0.018, 0.58, 10), 0, 0.22, 0), oak]);
    for (const [x, y, z] of [[0.04, 0.38, 0.01], [-0.035, 0.3, 0.02], [0.02, 0.45, -0.035], [-0.01, 0.2, 0.03]]) W.push([at(new THREE.SphereGeometry(0.016, 6, 5), x, y, z), 0x4a3018]);
    grip(0.12, 0.02, leather, W);
    kind = 'chop';
  } else if (key === 'pick' || key === 'mattock') {
    // a miner's pick: ash haft, iron collar, a curved spike (and on the mattock a broad adze blade)
    W.push([at(new THREE.CylinderGeometry(0.016, 0.02, 0.64, 10), 0, 0.22, 0), oak]);
    grip(0.13, 0.021, leather, W);
    M.push([at(new THREE.CylinderGeometry(0.026, 0.026, 0.08, 8), 0, 0.5, 0, 0, 0, Math.PI / 2), dark]);
    const ht = key === 'mattock' ? 0x3e3c42 : 0x6e7076;
    M.push([at(new THREE.ConeGeometry(0.022, 0.22, 6), 0.13, 0.475, 0, 0, 0, -Math.PI / 2 - 0.28), ht]);
    if (key === 'mattock') M.push([at(new THREE.BoxGeometry(0.17, 0.014, 0.075), -0.1, 0.48, 0, 0, 0, 0.3), ht]);
    else M.push([at(new THREE.ConeGeometry(0.018, 0.16, 6), -0.1, 0.48, 0, 0, 0, Math.PI / 2 + 0.28), ht]);
    kind = 'chop';
  } else if (key === 'bow' || key === 'warbow') {
    // recurve: two limbs curving away from you, a wrapped grip, horn tips
    const R = key === 'warbow' ? 0.62 : 0.55;
    for (const s of [-1, 1]) {
      const limb = new THREE.TorusGeometry(R, 0.011, 6, 18, 0.62);
      limb.rotateZ(s > 0 ? 0.0 : -0.62); limb.rotateY(-Math.PI / 2); limb.translate(0, 0, -R);
      W.push([limb, key === 'warbow' ? 0x3a2a1c : 0x6a4a2a]);
      const tipY = Math.sin(0.62) * R * s, tipZ = Math.cos(0.62) * R - R;
      M.push([at(new THREE.SphereGeometry(0.014, 6, 5), 0, tipY, tipZ), 0xd8cca8]);
    }
    grip(0.12, 0.016, leather, W);
    kind = 'bow';
  } else {
    // bare fist
    W.push([at(new THREE.SphereGeometry(0.045, 10, 8), 0, 0, 0), 0xb08a70]);
    kind = 'punch';
  }
  const group = new THREE.Group(); group.scale.setScalar(0.82);
  const mg = M.length ? mergeGeometries(M.map(([g, c]) => tint(g, c))) : null;
  const wg = W.length ? mergeGeometries(W.map(([g, c]) => tint(g, c))) : null;
  if (mg) group.add(new THREE.Mesh(mg, metal));
  if (wg) group.add(new THREE.Mesh(wg, wood));
  const out = { group, kind };
  if (kind === 'bow') {
    const R = key === 'warbow' ? 0.62 : 0.55, ty = Math.sin(0.62) * R, tz = Math.cos(0.62) * R - R;
    out.tips = [new THREE.Vector3(0, ty, tz), new THREE.Vector3(0, -ty, tz)];
    const sg = new THREE.BufferGeometry().setFromPoints([out.tips[0], new THREE.Vector3(0, 0, tz), out.tips[1]]);
    out.string = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0x8a8070 }));
    group.add(out.string);
    out.arrow = arrowMesh(metal, wood); out.arrow.rotation.x = -Math.PI / 2; group.add(out.arrow);
    out.restZ = tz;
  }
  return out;
}

// an arrow pointing along +y: shaft, iron head, fletching
export function arrowGeometry() {
  const parts = [
    [new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 5), 0x8a6a44],
    [at(new THREE.ConeGeometry(0.011, 0.05, 4), 0, 0.385, 0), 0x6a6a70],
  ];
  for (let i = 0; i < 3; i++) parts.push([at(new THREE.BoxGeometry(0.001, 0.09, 0.022), 0, -0.3, 0.012, 0, i * Math.PI * 2 / 3, 0).rotateY(0), 0x8a1e14]);
  return mergeGeometries(parts.map(([g, c]) => tint(g, c)));
}
function arrowMesh(metal) { return new THREE.Mesh(arrowGeometry(), metal); }

/** pose the right-hand weapon: s = 0..1 through the swing (or -1 idle), d = bow draw 0..1 */
export function poseWeapon(vm, info, s, d, guard, bob) {
  const k = info ? info.kind : 'slash';
  let px = 0.3, py = -0.33, pz = -0.52, rx = -0.75, ry = 0.3, rz = -0.6;
  if (k === 'chop') { rx = -0.6; rz = -0.4; ry = 0.2; }
  if (k === 'stab') { rx = -1.2; rz = -0.1; py = -0.3; }
  if (k === 'punch') { px = 0.3; py = -0.3; rx = 0; rz = 0; }
  if (k === 'bow') { px = 0.08; py = -0.12; pz = -0.62; rx = 0; ry = 0; rz = 0.12; }
  if (s >= 0) {
    if (k === 'slash') {
      // up over the right shoulder, then a hard diagonal cut down to the left
      const a = s < 0.3 ? s / 0.3 : 1, b = s < 0.3 ? 0 : Math.min(1, (s - 0.3) / 0.35), r = s > 0.65 ? (s - 0.65) / 0.35 : 0;
      const e = b * b * (3 - 2 * b);
      px += 0.12 * a - 0.5 * e + 0.38 * r * e; py += 0.18 * a - 0.32 * e + 0.14 * r;
      rz += -0.9 * a + 2.3 * e - 1.4 * r * e; rx += 0.5 * a - 1.2 * e + 0.7 * r; ry += -0.5 * e * (1 - r);
    } else if (k === 'chop') {
      const a = s < 0.35 ? s / 0.35 : 1, b = s < 0.35 ? 0 : Math.min(1, (s - 0.35) / 0.3), r = s > 0.65 ? (s - 0.65) / 0.35 : 0;
      const e = b * b * b;
      rx += 1.3 * a - 2.6 * e + 1.3 * r; py += 0.25 * a - 0.32 * e + 0.07 * r; pz += 0.08 * a - 0.18 * e + 0.1 * r; px -= 0.12 * e * (1 - r);
    } else if (k === 'stab') {
      const a = s < 0.3 ? s / 0.3 : 1, b = s < 0.3 ? 0 : Math.min(1, (s - 0.3) / 0.2), r = s > 0.5 ? (s - 0.5) / 0.5 : 0;
      pz += 0.1 * a - 0.38 * b + 0.28 * r; px -= 0.08 * b * (1 - r);
    } else if (k === 'punch') {
      const b = Math.sin(Math.min(1, s) * Math.PI); pz -= 0.3 * b; px -= 0.12 * b;
    }
  }
  if (k === 'bow') { pz += d * 0.06; rz -= d * 0.05; }
  if (guard && k !== 'bow') { px = 0.12; py = -0.22; pz = -0.48; rx = 0.1; ry = 0.2; rz = 1.3; }
  vm.position.set(px, py + bob, pz); vm.rotation.set(rx, ry, rz);
  // bow string and nocked arrow follow the draw
  if (info?.string) {
    const nz = info.restZ + d * 0.42, p = info.string.geometry.attributes.position;
    p.setXYZ(1, 0, 0, nz); p.needsUpdate = true;
    info.arrow.position.set(0.012, 0, nz - 0.36);
  }
}
