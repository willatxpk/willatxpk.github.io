// The 3D world: your office, the lab behind the glass, and the people in it.
import * as THREE from 'three';
import { setupRenderer, resizeGfx, renderFrame, shadowAll, tuneEnv, mats, buildHuman, QUALITY } from './gfx.js';

export const W = {
  scene: null, camera: null, renderer: null, chars: new Map(), clickables: [],
  yaw: 0, pitch: -0.06, tYaw: 0, tPitch: -0.06, fov: 54, tFov: 54, drawMonitor: null, drawWhiteboard: null,
  doorOpen: 1, doorTarget: 1, phoneRing: 0, equipGroups: {}, framesKey: '', t: 0,
};

const CAM = new THREE.Vector3(0, 1.25, 2.95);
export const CHAIR_MAIN = { x: -0.2, z: 0.55, yaw: 0.08 };
export const CHAIR_TWO = { x: -1.25, z: 0.7, yaw: 0.45 };
const AISLE = -9.4, CORR = -5.4, DOORZ = -1.0;
const COLS = [-2.6, -0.4, 1.8, 4.0, 6.2];
export const STATIONS = [];
for (let i = 0; i < 5; i++) { STATIONS.push({ x: COLS[i], z: -7.75, yaw: 0, pose: 'work' }); STATIONS.push({ x: COLS[i], z: -11.9, yaw: 0, pose: 'type' }); }
// order: first 6 = base lab, next 4 = expansion
const ST = [STATIONS[0], STATIONS[2], STATIONS[4], STATIONS[1], STATIONS[3], STATIONS[5], STATIONS[6], STATIONS[8], STATIONS[7], STATIONS[9]];

const matCache = new Map();
function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }));
  return matCache.get(k);
}
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function clickable(obj, action, tip, data) { obj.userData.action = action; obj.userData.tip = tip; obj.userData.data = data; W.clickables.push(obj); return obj; }

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------------- init ----------------
export function initWorld(canvas) {
  const r = W.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  const s = W.scene = new THREE.Scene();
  s.background = new THREE.Color('#1a1d24');
  W.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 80);
  W.camera.position.copy(CAM); W.camera.rotation.order = 'YXZ';
  setupRenderer(r, s, W.camera);

  // the room environment map already supplies soft ambient light, so direct lights stay modest
  s.add(new THREE.HemisphereLight('#dfe8ff', '#4a3f35', 0.08));
  // shadow-casting key lights: one over the desk, one over the lab
  const key = new THREE.SpotLight('#ffe9cf', 7, 10, 0.95, 0.75, 1.6); key.position.set(0.6, 2.95, 1.2); key.target.position.set(-0.3, 0.4, 0.2); s.add(key, key.target);
  const labKey = new THREE.SpotLight('#eef5ff', 16, 20, 1.15, 0.8, 1.4); labKey.position.set(1.4, 3.15, -8.6); labKey.target.position.set(1.4, 0, -9); s.add(labKey, labKey.target);
  for (const L of [key, labKey]) { L.castShadow = QUALITY !== 'low'; L.shadow.mapSize.set(QUALITY === 'high' ? 2048 : 1024, QUALITY === 'high' ? 2048 : 1024); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.025; L.shadow.radius = 4; }
  const lamp = new THREE.PointLight('#ffc98a', 3.5, 6, 1.8); lamp.position.set(-0.9, 2.2, 1.9); s.add(lamp);
  const officeFill = new THREE.PointLight('#ffe6c8', 1.5, 8, 1.6); officeFill.position.set(0.5, 2.8, -1.5); s.add(officeFill);
  const labL1 = new THREE.PointLight('#d8ecff', 4, 12, 1.5); labL1.position.set(-1, 3.1, -8); s.add(labL1);
  const labL2 = new THREE.PointLight('#d8ecff', 4, 12, 1.5); labL2.position.set(3, 3.1, -11); s.add(labL2);
  const labL3 = new THREE.PointLight('#d8ecff', 3, 12, 1.5); labL3.position.set(6, 3.1, -8); s.add(labL3);
  const corr = new THREE.PointLight('#fff2dd', 2, 8, 1.6); corr.position.set(-5.5, 2.8, -2); s.add(corr);

  buildOffice(s);
  buildLab(s);
  shadowAll(s);
  tuneEnv(s);
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  W.renderer.setSize(w, h, false); resizeGfx(w, h);
  W.camera.aspect = w / h; W.camera.updateProjectionMatrix();
}

// ---------------- office ----------------
function buildOffice(s) {
  const wood = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a5434'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const y = i * 64; g.fillStyle = `hsl(${25 + Math.random() * 6},${38 + Math.random() * 10}%,${28 + Math.random() * 8}%)`; g.fillRect(0, y, w, 62);
      g.strokeStyle = 'rgba(0,0,0,.08)'; for (let k = 0; k < 14; k++) { g.beginPath(); const yy = y + Math.random() * 62; g.moveTo(0, yy); g.bezierCurveTo(w / 3, yy + 4, w * 2 / 3, yy - 4, w, yy); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 62, w, 2); g.fillRect((i * 173) % w, y, 2, 62);
    }
  }, [3, 3]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mats.floorWood());
  floor.rotation.x = -Math.PI / 2; s.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 176, (g, w, h) => { g.fillStyle = '#6b2f3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b26a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44); g.fillStyle = '#2f4a6b'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w / 2, h / 2, 60 - i * 11, 0, 7); g.globalAlpha = 0.25; g.fill(); } g.globalAlpha = 1; }), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-0.4, 0.005, 0.6); s.add(rug);

  const wallM = mats.wall('#d9d2c3');
  // back wall (with window into the lab)
  box(0.8, 3, 0.12, wallM, -3.6, 1.5, -4, s); box(0.8, 3, 0.12, wallM, 3.6, 1.5, -4, s);
  box(6.4, 0.75, 0.12, wallM, 0, 0.375, -4, s); box(6.4, 0.22, 0.12, wallM, 0, 2.89, -4, s);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.03), mats.glass());
  glass.position.set(0, 1.765, -4); s.add(glass);
  const frameM = M('#3b3f47', { roughness: 0.4, metalness: 0.5 });
  box(6.5, 0.06, 0.16, frameM, 0, 0.77, -4, s); box(6.5, 0.06, 0.16, frameM, 0, 2.77, -4, s);
  for (const x of [-3.2, -1.07, 1.07, 3.2]) box(0.06, 2.0, 0.16, frameM, x, 1.77, -4, s);
  // window sill plant
  const pot = cyl(0.12, 0.09, 0.2, '#b5652e', 2.6, 0.9, -3.85, s); sph(0.18, M('#3e7a3a'), 2.6, 1.13, -3.85, s, 10);
  // left wall with door
  box(0.12, 3, 2.4, wallM, -4, 1.5, -2.8, s); // z from -4 to -1.6
  box(0.12, 3, 4.4, wallM, -4, 1.5, 1.8, s); // z from -0.4 to 4
  box(0.12, 0.8, 1.2, wallM, -4, 2.6, -1.0, s);
  const doorG = new THREE.Group(); doorG.position.set(-4, 0, -1.6); s.add(doorG);
  const door = box(0.06, 2.18, 1.18, M('#8a5a34', { roughness: 0.55 }), 0, 1.1, 0.6, doorG);
  sph(0.04, M('#c9a24a', { metalness: 0.8, roughness: 0.3 }), 0.06, 1.05, 1.05, doorG, 10);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ map: W.plateTex = canvasTex(256, 76, () => { }) }));
  plate.position.set(0.035, 1.55, 0.6); plate.rotation.y = Math.PI / 2; doorG.add(plate);
  W.door = doorG; clickable(door, 'door', 'Door: open or close (Do Not Disturb)');
  // right wall, front wall, ceiling
  box(0.12, 3, 8, wallM, 4, 1.5, 0, s);
  box(8, 3, 0.12, wallM, 0, 1.5, 4, s);
  const ceil = box(8, 0.1, 8, mats.ceiling(), 0, 3.02, 0, s);
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [0, 1.6]]) box(1.1, 0.03, 0.55, new THREE.MeshBasicMaterial({ color: '#fff6e6' }), x, 2.96, z, s);
  // baseboards
  for (const [w, x, z, ry] of [[8, 0, 3.93, 0], [8, 3.93, 0, Math.PI / 2]]) { const b = box(w, 0.1, 0.03, '#5a4232', x, 0.05, z, s); b.rotation.y = ry; }

  // desk
  const deskM = mats.desk();
  box(2.3, 0.06, 0.95, deskM, 0, 0.76, 1.85, s);
  box(2.3, 0.62, 0.04, M('#4a2f1f'), 0, 0.43, 1.4, s);
  box(0.5, 0.7, 0.85, M('#4a2f1f'), 0.85, 0.37, 1.85, s);
  for (const x of [-1.1]) for (const z of [1.42, 2.28]) box(0.05, 0.73, 0.05, deskM, x, 0.365, z, s);
  // monitor
  const mon = new THREE.Group(); mon.position.set(0.85, 0.79, 2.05); mon.rotation.y = Math.atan2(-0.85, 0.9); s.add(mon);
  box(0.16, 0.02, 0.12, '#222', 0, 0.01, 0, mon); box(0.04, 0.2, 0.03, '#222', 0, 0.11, -0.02, mon);
  box(0.62, 0.38, 0.03, '#15171b', 0, 0.38, 0, mon);
  W.monCanvas = document.createElement('canvas'); W.monCanvas.width = 640; W.monCanvas.height = 384;
  W.monTex = new THREE.CanvasTexture(W.monCanvas); W.monTex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.345), new THREE.MeshBasicMaterial({ map: W.monTex }));
  scr.position.set(0, 0.38, 0.017); mon.add(scr);
  clickable(scr, 'computer', 'Your computer'); clickable(mon.children[2], 'computer', 'Your computer');
  W.monitor = mon;
  // keyboard, mouse, mug, papers, lamp, phone, nameplate
  const kb = box(0.42, 0.02, 0.14, '#2a2c30', 0.45, 0.8, 2.35, s); kb.rotation.y = Math.atan2(-0.85, 0.9) * 0.6;
  box(0.06, 0.02, 0.09, '#2a2c30', 0.78, 0.8, 2.5, s);
  const mug = new THREE.Group(); mug.position.set(-0.55, 0.79, 2.35); s.add(mug);
  cyl(0.045, 0.04, 0.11, M('#e8e2d6'), 0, 0.055, 0, mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), M('#e8e2d6')); handle.position.set(0.05, 0.06, 0); mug.add(handle);
  W.coffee = cyl(0.04, 0.04, 0.005, M('#3a2414'), 0, 0.1, 0, mug);
  clickable(mug.children[0], 'coffee', 'Coffee: restores some energy (once per week)'); clickable(handle, 'coffee', 'Coffee');
  W.mug = mug;
  for (let i = 0; i < 6; i++) { const p = box(0.22, 0.004, 0.3, M(i % 2 ? '#f2efe6' : '#e8e4d8'), -0.25 + Math.random() * 0.03, 0.79 + i * 0.006, 2.0 + Math.random() * 0.03, s); p.rotation.y = (Math.random() - 0.5) * 0.3; }
  const lampG = new THREE.Group(); lampG.position.set(-0.95, 0.79, 2.05); s.add(lampG);
  cyl(0.08, 0.09, 0.02, '#222', 0, 0.01, 0, lampG); const arm = cyl(0.01, 0.01, 0.5, '#333', 0, 0.26, 0, lampG); arm.rotation.z = 0.2;
  const shade = cyl(0.04, 0.1, 0.12, M('#2f5f3a', { roughness: 0.4 }), 0.08, 0.5, 0.0, lampG); shade.rotation.z = -0.6;
  sph(0.03, new THREE.MeshBasicMaterial({ color: '#fff2c8' }), 0.1, 0.46, 0, lampG, 8);
  const phone = new THREE.Group(); phone.position.set(-0.75, 0.79, 1.7); s.add(phone);
  box(0.2, 0.05, 0.16, '#202225', 0, 0.025, 0, phone); const rec = box(0.2, 0.035, 0.05, '#2a2c30', 0, 0.07, -0.04, phone);
  W.phoneLight = sph(0.012, new THREE.MeshBasicMaterial({ color: '#330000' }), 0.08, 0.055, 0.06, phone, 8);
  clickable(phone.children[0], 'phone', 'Desk phone'); clickable(rec, 'phone', 'Desk phone'); W.phone = phone;
  const np = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.08), new THREE.MeshBasicMaterial({ map: W.nameTex = canvasTex(340, 80, () => { }) }));
  np.position.set(-0.05, 0.835, 1.47); np.rotation.x = -0.35; s.add(np);
  box(0.36, 0.09, 0.03, '#2a1c12', -0.05, 0.83, 1.455, s).rotation.x = -0.35;
  W.medal = new THREE.Group(); W.medal.position.set(-0.3, 0.8, 2.55); s.add(W.medal); W.medal.visible = false;
  const md = cyl(0.06, 0.06, 0.012, M('#e8c050', { metalness: 0.9, roughness: 0.25 }), 0, 0.006, 0, W.medal, 24); md.rotation.x = 0;
  clickable(md, 'cv', 'Your Nobel medal');
  // desk plant + photo frame
  cyl(0.06, 0.05, 0.1, '#d8d0c0', 1.0, 0.84, 1.55, s); sph(0.09, M('#4e8a40'), 1.0, 0.95, 1.55, s, 8);
  const pf = box(0.16, 0.12, 0.015, '#2a2a2a', -0.95, 0.85, 2.45, s); pf.rotation.set(-0.2, 0.5, 0);

  // visitor chairs
  for (const ch of [CHAIR_MAIN, CHAIR_TWO]) {
    const g = new THREE.Group(); g.position.set(ch.x, 0, ch.z - 0.05); g.rotation.y = ch.yaw; s.add(g);
    const cm = mats.fabric('#3d4a5c');
    box(0.5, 0.08, 0.48, cm, 0, 0.45, 0, g); box(0.5, 0.55, 0.07, cm, 0, 0.75, -0.24, g);
    for (const x of [-0.21, 0.21]) for (const z of [-0.2, 0.2]) cyl(0.015, 0.015, 0.45, '#222', x, 0.22, z, g, 6);
    for (const x of [-0.27, 0.27]) box(0.04, 0.03, 0.4, '#222', x, 0.65, 0, g);
  }
  // couch (upgrade)
  const couch = new THREE.Group(); couch.position.set(3.3, 0, -1.2); couch.rotation.y = -Math.PI / 2; s.add(couch);
  const cm2 = M('#7a3b2e', { roughness: 0.9 });
  box(2, 0.4, 0.8, cm2, 0, 0.3, 0, couch); box(2, 0.5, 0.2, cm2, 0, 0.7, -0.35, couch); box(0.18, 0.55, 0.8, cm2, -1, 0.45, 0, couch); box(0.18, 0.55, 0.8, cm2, 1, 0.45, 0, couch);
  W.equipGroups.couch = couch;

  // bookshelf on the right wall
  const shelf = new THREE.Group(); shelf.position.set(3.75, 0, 2.2); shelf.rotation.y = -Math.PI / 2; s.add(shelf);
  const sm = M('#4a3020');
  box(1.6, 2.2, 0.04, sm, 0, 1.1, -0.18, shelf); box(0.04, 2.2, 0.38, sm, -0.8, 1.1, 0, shelf); box(0.04, 2.2, 0.38, sm, 0.8, 1.1, 0, shelf);
  const bookCols = ['#7a2a2a', '#2a4a7a', '#2a6a4a', '#7a6a2a', '#4a2a6a', '#8a4a2a', '#333', '#5a5a5a', '#1f3f6a', '#a0522d'];
  for (let k = 0; k < 5; k++) {
    const y = 0.1 + k * 0.45; box(1.56, 0.03, 0.36, sm, 0, y, 0, shelf);
    let x = -0.74;
    while (x < 0.7) { const bw = 0.04 + Math.random() * 0.05, bh = 0.25 + Math.random() * 0.13; if (Math.random() < 0.1) { x += 0.1; continue; } const b = box(bw, bh, 0.24, M(bookCols[(Math.random() * bookCols.length) | 0]), x + bw / 2, y + 0.015 + bh / 2, 0.02, shelf); if (Math.random() < 0.08) b.rotation.z = 0.25; x += bw + 0.005; }
  }
  box(1.6, 0.03, 0.38, sm, 0, 2.2, 0, shelf);
  clickable(shelf.children[0], 'cv', 'Your CV and achievements');
  W.trophies = new THREE.Group(); W.trophies.position.set(3.72, 2.215, 2.2); s.add(W.trophies);

  // whiteboard on the right wall
  W.wbCanvas = document.createElement('canvas'); W.wbCanvas.width = 1024; W.wbCanvas.height = 560;
  W.wbTex = new THREE.CanvasTexture(W.wbCanvas); W.wbTex.colorSpace = THREE.SRGBColorSpace;
  const wb = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.42), new THREE.MeshStandardMaterial({ map: W.wbTex, roughness: 0.35 }));
  // sits just in front of the frame (x 3.93) so the two surfaces don't fight and flicker
  wb.position.set(3.915, 1.6, -1.6); wb.rotation.y = -Math.PI / 2; s.add(wb);
  box(0.04, 1.5, 2.7, '#9aa0a8', 3.95, 1.6, -1.6, s);
  box(0.1, 0.03, 2.4, '#9aa0a8', 3.88, 0.88, -1.6, s);
  clickable(wb, 'whiteboard', 'Project whiteboard');

  // paper frames on the left wall
  W.frames = new THREE.Group(); s.add(W.frames);
  // diploma
  const dip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshBasicMaterial({ map: canvasTex(250, 190, (g, w, h) => { g.fillStyle = '#5a3a20'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4ecd8'; g.fillRect(12, 12, w - 24, h - 24); g.fillStyle = '#3a2a1a'; g.font = 'italic 18px Georgia'; g.textAlign = 'center'; g.fillText('Doctor of Philosophy', w / 2, 60); g.font = '13px Georgia'; g.fillText('in Physics', w / 2, 84); g.fillStyle = '#a02020'; g.beginPath(); g.arc(w / 2, 135, 18, 0, 7); g.fill(); }) }));
  dip.position.set(-3.93, 2.1, 3.2); dip.rotation.y = Math.PI / 2; s.add(dip);

  // corridor
  const cf = new THREE.Mesh(new THREE.PlaneGeometry(3, 22), M('#8c8a86', { roughness: 0.9 })); cf.rotation.x = -Math.PI / 2; cf.position.set(-5.5, 0.001, -3); s.add(cf);
  box(0.12, 3, 22, M('#cfc8b8'), -7, 1.5, -3, s);
  box(3, 0.1, 22, M('#e8e6e0'), -5.5, 3.02, -3, s);
  for (const z of [-11, -6, -1, 4]) box(0.8, 0.03, 0.5, new THREE.MeshBasicMaterial({ color: '#fff' }), -5.5, 2.96, z, s);
  // a poster in the corridor
  const post = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), new THREE.MeshBasicMaterial({ map: canvasTex(140, 200, (g, w, h) => { g.fillStyle = '#1f3a5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd36a'; g.font = 'bold 18px sans-serif'; g.fillText('PHYSICS', 14, 40); g.fillText('COLLOQUIUM', 14, 62); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('Thursday 4pm', 14, 90); g.fillText('Free cookies', 14, 108); g.strokeStyle = '#ffd36a'; g.beginPath(); for (let x = 0; x < w; x++) g.lineTo(x, 160 + Math.sin(x / 8) * 18 * Math.exp(-x / 90)); g.stroke(); }) }));
  post.position.set(-6.93, 1.6, -1); post.rotation.y = Math.PI / 2; s.add(post);
}

// ---------------- lab ----------------
function buildLab(s) {
  const tiles = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b9bcbf'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `hsl(210,4%,${70 + Math.random() * 6}%)`; g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } }, [6, 4]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(13, 9.5), mats.vinyl());
  fl.rotation.x = -Math.PI / 2; fl.position.set(2.5, 0.001, -8.75); s.add(fl);
  const lw = mats.wall('#e6eaee');
  box(13, 3.2, 0.12, lw, 2.5, 1.6, -13.5, s); // back wall
  box(0.12, 3.2, 4.8, lw, -4, 1.6, -6.4, s); box(0.12, 3.2, 3.5, lw, -4, 1.6, -11.75, s); box(0.12, 1, 1.2, lw, -4, 2.7, -9.4, s);
  box(0.12, 3.2, 9.5, lw, 9, 1.6, -8.75, s);
  box(5, 3.2, 0.12, lw, 6.5, 1.6, -4, s); // lab front wall right of the office
  box(13, 0.1, 9.5, mats.ceiling(), 2.5, 3.25, -8.75, s);
  for (const x of [-2, 1, 4, 7]) for (const z of [-6, -9.4, -12.5]) box(1.2, 0.03, 0.5, new THREE.MeshBasicMaterial({ color: '#f4fbff' }), x, 3.19, z, s);
  // safety stripe and lab door
  const yellow = M('#e8c020'); box(0.04, 0.02, 1.2, yellow, -3.93, 0.01, -9.4, s);
  box(0.08, 2.2, 0.06, '#666', -4, 1.1, -10.0, s); box(0.08, 2.2, 0.06, '#666', -4, 1.1, -8.8, s);
  // lab sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: W.labSignTex = canvasTex(400, 100, () => { }) }));
  sign.position.set(-4.07, 2.5, -9.4); sign.rotation.y = -Math.PI / 2; s.add(sign);

  // benches (front row) and desks (back row)
  W.benches = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(); g.position.set(COLS[i], 0, -7.0); s.add(g);
    const top = box(1.8, 0.06, 0.85, M('#2b2e33', { roughness: 0.5 }), 0, 0.92, 0, g);
    box(1.8, 0.85, 0.05, M('#dfe3e8'), 0, 0.45, 0.4, g);
    box(0.05, 0.89, 0.8, M('#dfe3e8'), -0.88, 0.45, 0, g); box(0.05, 0.89, 0.8, M('#dfe3e8'), 0.88, 0.45, 0, g);
    // clutter (benches 0 and 1 hold the optics table and vacuum chamber)
    if (i >= 3) for (let k = 0; k < 3; k++) { const hh = 0.08 + Math.random() * 0.15; box(0.15 + Math.random() * 0.2, hh, 0.15, M(['#c8ccd2', '#3a6ea5', '#e0a030', '#555'][k % 4]), -0.6 + k * 0.5, 0.95 + hh / 2, 0.15, g); }
    W.benches.push(g);
    const d = new THREE.Group(); d.position.set(COLS[i], 0, -11.2); s.add(d);
    box(1.6, 0.05, 0.75, M('#c9b48a', { roughness: 0.6 }), 0, 0.74, 0, d);
    for (const x of [-0.75, 0.75]) box(0.05, 0.72, 0.7, '#888', x, 0.37, 0, d);
    const lap = new THREE.Group(); lap.position.set(0, 0.77, -0.05); d.add(lap);
    box(0.36, 0.02, 0.25, '#bbb', 0, 0, 0.08, lap); const scr = box(0.36, 0.24, 0.015, '#222', 0, 0.12, -0.05, lap); scr.rotation.x = -0.15;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.2), new THREE.MeshBasicMaterial({ color: ['#2a6aa5', '#1e8a5a', '#6a3aa5', '#a5602a'][i % 4] })); glow.position.set(0, 0.12, -0.04); glow.rotation.x = -0.15; lap.add(glow);
    // laptop faces the worker (who faces +z)... flip so the screen faces the worker
    lap.rotation.y = Math.PI; lap.position.z = 0.05;
    // chair
    const ch = new THREE.Group(); ch.position.set(0, 0, -0.75); d.add(ch);
    box(0.45, 0.06, 0.45, M('#555'), 0, 0.47, 0, ch); cyl(0.03, 0.03, 0.44, '#333', 0, 0.23, 0, ch, 6); cyl(0.25, 0.25, 0.03, '#333', 0, 0.02, 0, ch, 10);
    const back = box(0.45, 0.5, 0.05, M('#555'), 0, 0.78, -0.22, ch);
    d.userData.chair = ch; d.userData.back = back;
    W.benches.push(d);
    if (i >= 3) { g.userData.expansion = true; d.userData.expansion = true; }
  }
  // crates where the expansion will go
  W.crates = new THREE.Group(); s.add(W.crates);
  for (let i = 0; i < 7; i++) box(0.6, 0.5, 0.6, M('#a8804a'), 4 + Math.random() * 3, 0.25 + (i > 4 ? 0.5 : 0), -6.8 - Math.random() * 5, W.crates).rotation.y = Math.random();
  box(0.05, 1, 9, M('#e8c020'), 3.0, 0.5, -8.75, W.crates).material = new THREE.MeshBasicMaterial({ color: '#e8c020', transparent: true, opacity: 0.5 });

  const E = W.equipGroups;
  // optical table on bench 0
  {
    const g = new THREE.Group(); g.position.set(COLS[0], 0, -7.0); s.add(g); E.optics = g;
    const holes = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#3a3d42'; c.fillRect(0, 0, w, h); c.fillStyle = '#25272b'; for (let x = 4; x < w; x += 10) for (let y = 4; y < h; y += 10) { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); } });
    box(1.86, 0.1, 0.92, new THREE.MeshStandardMaterial({ map: holes, roughness: 0.4, metalness: 0.4 }), 0, 0.98, 0, g);
    const mm = M('#b8bcc4', { metalness: 0.8, roughness: 0.3 });
    const pts = [[-0.75, 0.25], [-0.75, -0.3], [-0.2, -0.3], [-0.2, 0.2], [0.35, 0.2], [0.35, -0.25], [0.75, -0.25]];
    box(0.3, 0.1, 0.12, M('#2a4a8a'), -0.75, 1.09, 0.35, g);
    for (const [x, z] of pts) { cyl(0.012, 0.012, 0.12, mm, x, 1.09, z, g, 6); const m = cyl(0.03, 0.03, 0.01, mm, x, 1.15, z, g, 12); m.rotation.x = Math.PI / 2; m.rotation.z = Math.random(); }
    const beamM = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const beamM2 = new THREE.MeshBasicMaterial({ color: '#30ff60', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const all = [[-0.75, 0.35], ...pts];
    for (let i = 0; i < all.length - 1; i++) {
      const [x1, z1] = all[i], [x2, z2] = all[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), i > 3 ? beamM2 : beamM);
      b.position.set((x1 + x2) / 2, 1.15, (z1 + z2) / 2); b.rotation.x = Math.PI / 2; b.rotation.z = -Math.atan2(x2 - x1, z2 - z1); g.add(b);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 4), new THREE.MeshBasicMaterial({ color: i > 3 ? '#30ff60' : '#ff2a2a', transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(b.position); glow.rotation.copy(b.rotation); g.add(glow);
    }
    const bl = new THREE.PointLight('#ff4040', 1.2, 2.5); bl.position.set(0, 1.3, 0); g.add(bl);
    // curtain frame
    for (const x of [-0.95, 0.95]) cyl(0.015, 0.015, 1.3, '#888', x, 1.6, 0.45, g, 6);
    box(1.9, 0.03, 0.03, '#888', 0, 2.25, 0.45, g);
  }
  // vacuum chamber on bench 1
  {
    const g = new THREE.Group(); g.position.set(COLS[1] + 0.55, 0, -7.0); s.add(g); E.vacuum = g;
    const st = M('#c4c8cf', { metalness: 0.85, roughness: 0.25 });
    sph(0.26, st, 0, 1.25, 0, g, 20);
    for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) { const p = cyl(0.07, 0.07, 0.7, st, 0, 1.25, 0, g, 12); p.rotation.set(rx, 0, rz); }
    for (const [x, y, z] of [[0, 1.6, 0], [0.35, 1.25, 0], [-0.35, 1.25, 0], [0, 1.25, 0.35]]) { const f = cyl(0.1, 0.1, 0.03, st, x, y, z, g, 14); if (x) f.rotation.z = Math.PI / 2; if (z) f.rotation.x = Math.PI / 2; }
    const win = sph(0.08, new THREE.MeshBasicMaterial({ color: '#b060ff' }), 0, 1.25, 0.36, g, 10); win.scale.z = 0.3; W.plasmaGlow = win;
    cyl(0.06, 0.06, 0.25, M('#3a6ea5'), 0.45, 1.05, -0.1, g, 10);
  }
  // electronics on bench 2
  {
    const g = new THREE.Group(); g.position.set(COLS[2], 0, -7.0); s.add(g);
    box(0.5, 0.3, 0.35, '#d6d6d0', -0.4, 1.1, -0.1, g);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), new THREE.MeshBasicMaterial({ map: W.scopeTex = canvasTex(128, 90, () => { }) }));
    sc.position.set(-0.47, 1.12, 0.08); g.add(sc);
    box(0.4, 0.15, 0.3, '#333', 0.35, 1.03, -0.1, g); box(0.4, 0.15, 0.3, '#444', 0.35, 1.18, -0.1, g);
    for (let k = 0; k < 6; k++) sph(0.012, new THREE.MeshBasicMaterial({ color: k % 2 ? '#30ff60' : '#ffb020' }), 0.2 + k * 0.05, 1.18, 0.06, g, 6);
  }
  // dilution refrigerator
  {
    const g = new THREE.Group(); g.position.set(3.3, 0, -5.4); s.add(g); E.fridge = g;
    const fm = M('#5a6270', { metalness: 0.6, roughness: 0.4 });
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(0.06, 3.1, 0.06, fm, x, 1.55, z, g);
    box(1.3, 0.08, 1.3, fm, 0, 3.0, 0, g);
    cyl(0.32, 0.32, 0.1, M('#c0c4cc', { metalness: 0.8, roughness: 0.3 }), 0, 2.85, 0, g, 24);
    const gold = M('#d4a640', { metalness: 1, roughness: 0.22 });
    let y = 2.75, r = 0.3;
    for (let k = 0; k < 5; k++) { cyl(r, r, 0.04, gold, 0, y, 0, g, 24); for (let a = 0; a < 3; a++) { const ang = a * 2.1 + k; cyl(0.012, 0.012, 0.34, gold, Math.cos(ang) * r * 0.7, y - 0.18, Math.sin(ang) * r * 0.7, g, 6); } y -= 0.36; r -= 0.04; }
    for (let a = 0; a < 8; a++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), M('#c06a30', { metalness: 1, roughness: 0.3 })); coil.position.set(Math.cos(a) * 0.15, 2.5 - a * 0.18, Math.sin(a) * 0.15); coil.rotation.x = Math.PI / 2; g.add(coil); }
    cyl(0.1, 0.06, 0.25, gold, 0, y + 0.05, 0, g, 16);
    W.fridgeGlow = new THREE.PointLight('#ffcf70', 1.4, 2.5); W.fridgeGlow.position.set(0, 1.8, 0.5); g.add(W.fridgeGlow);
    box(0.5, 0.9, 0.5, '#6a7280', 0.9, 0.45, 0, g);
  }
  // wet helium cryostat with magnet (blue dewar on a stand, with a helium transfer line)
  {
    const g = new THREE.Group(); g.position.set(5.6, 0, -5.6); s.add(g); E.cryostat = g;
    const dew = M('#3a6ea5', { metalness: 0.5, roughness: 0.35 });
    cyl(0.38, 0.38, 1.7, dew, 0, 0.95, 0, g, 24); cyl(0.4, 0.4, 0.08, M('#c0c4cc', { metalness: 0.8, roughness: 0.3 }), 0, 1.84, 0, g, 24);
    for (let a = 0; a < 3; a++) cyl(0.025, 0.025, 0.25, '#888', Math.cos(a * 2.1) * 0.15, 1.98, Math.sin(a * 2.1) * 0.15, g, 6);
    cyl(0.03, 0.03, 0.6, '#aaa', 0.18, 2.3, 0, g, 8);
    const line = cyl(0.02, 0.02, 1.0, '#ccc', 0.6, 2.25, 0, g, 6); line.rotation.z = Math.PI / 2.3;
    cyl(0.25, 0.25, 1.1, M('#c8ccd2', { metalness: 0.8, roughness: 0.25 }), 1.1, 0.55, 0.1, g, 16); // helium storage dewar
    box(0.35, 0.5, 0.3, '#2c2e33', -0.7, 0.25, 0.2, g); // magnet power supply
    W.cryoFog = sph(0.12, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }), 0.18, 2.62, 0, g, 8);
  }
  // scanning tunneling microscope on a vibration-isolation table
  {
    const g = new THREE.Group(); g.position.set(1.1, 0, -5.3); s.add(g); E.stm = g;
    box(0.7, 0.06, 0.6, M('#2a2d33', { roughness: 0.4 }), 0, 0.98, 0, g);
    for (const [x, z] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) cyl(0.035, 0.05, 0.95, '#555', x, 0.475, z, g, 8);
    for (const [x, z] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.22], [0.28, 0.22]]) cyl(0.04, 0.05, 0.06, '#111', x, 1.04, z, g, 8);
    const st = M('#c4c8cf', { metalness: 0.85, roughness: 0.25 });
    sph(0.18, st, 0, 1.3, 0, g, 18); cyl(0.07, 0.07, 0.35, st, 0, 1.55, 0, g, 12);
    for (const a of [0, 1.6, 3.2]) { const p = cyl(0.04, 0.04, 0.25, st, Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2, g, 10); p.rotation.z = Math.PI / 2; p.rotation.y = a; }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ map: canvasTex(64, 48, (c, w, h) => { for (let x = 0; x < w; x += 4) for (let y = 0; y < h; y += 4) { const v = 0.5 + 0.5 * Math.sin(x * 0.6) * Math.sin(y * 0.6 + x * 0.3); c.fillStyle = `rgb(${200 * v + 40},${140 * v + 30},${40 * v})`; c.fillRect(x, y, 4, 4); } }) }));
    scr.position.set(-0.25, 1.15, 0.31); g.add(scr);
  }
  // helium recovery
  { const g = new THREE.Group(); g.position.set(6.9, 0, -4.9); s.add(g); E.herecovery = g; for (let k = 0; k < 3; k++) { cyl(0.16, 0.16, 1.4, M('#4a7a5a', { metalness: 0.4, roughness: 0.4 }), k * 0.38, 0.7, 0, g, 14); sph(0.16, M('#4a7a5a', { metalness: 0.4 }), k * 0.38, 1.4, 0, g, 12); } }
  // espresso counter
  {
    const g = new THREE.Group(); g.position.set(-3.55, 0, -5.0); s.add(g);
    box(0.6, 0.9, 1.4, '#7a7f87', 0, 0.45, 0, g); box(0.62, 0.04, 1.42, '#2b2e33', 0, 0.92, 0, g);
    W.labCoffeeSpot = new THREE.Vector3(-2.9, 0, -5.0);
    const em = new THREE.Group(); em.position.set(0, 0.94, 0.2); g.add(em); E.espresso = em;
    box(0.3, 0.38, 0.3, M('#b0b4ba', { metalness: 0.9, roughness: 0.2 }), 0, 0.19, 0, em); box(0.32, 0.06, 0.32, '#222', 0, 0.4, 0, em);
    cyl(0.03, 0.03, 0.08, '#222', 0.12, 0.17, 0.12, em, 8);
    box(0.25, 0.3, 0.2, '#e8e8e8', 0, 0.15, -0.45, g).position.y = 1.09;
  }
  // fab bay
  {
    const g = new THREE.Group(); g.position.set(-2.4, 0, -12.95); s.add(g); E.fab = g;
    const gl = new THREE.MeshStandardMaterial({ color: '#ffe680', transparent: true, opacity: 0.35, emissive: '#ffcc33', emissiveIntensity: 0.4, roughness: 0.1 });
    box(2.6, 2.4, 0.04, gl, 0, 1.2, 0.5, g); box(0.04, 2.4, 1, gl, -1.3, 1.2, 0, g); box(0.04, 2.4, 1, gl, 1.3, 1.2, 0, g);
    box(2.6, 0.1, 1.0, '#ddd', 0, 2.45, 0, g);
    const yl = new THREE.PointLight('#ffc030', 3, 3); yl.position.set(0, 2, 0); g.add(yl);
    box(0.8, 0.9, 0.5, '#e8e8e8', -0.6, 0.45, -0.1, g); box(0.5, 1.4, 0.5, '#d0d0d0', 0.6, 0.7, -0.1, g);
  }
  // cluster
  {
    const g = new THREE.Group(); g.position.set(0.3, 0, -13.1); s.add(g); E.cluster = g; W.leds = [];
    for (let r = 0; r < 2; r++) {
      box(0.6, 2.0, 0.7, '#1a1c20', r * 0.7, 1.0, 0, g);
      for (let k = 0; k < 12; k++) { box(0.54, 0.1, 0.02, '#2a2d33', r * 0.7, 0.3 + k * 0.13, 0.36, g); const led = sph(0.012, new THREE.MeshBasicMaterial({ color: '#30a0ff' }), r * 0.7 + 0.2, 0.3 + k * 0.13, 0.37, g, 4); W.leds.push(led); }
    }
  }
  // whiteboard wall in the lab
  {
    const g = new THREE.Group(); g.position.set(4.2, 1.6, -13.42); s.add(g); E.whiteboards = g;
    const t = canvasTex(1024, 300, (c, w, h) => { c.fillStyle = '#f8f8f4'; c.fillRect(0, 0, w, h); c.font = '28px Caveat, cursive'; const eqs = ['H = -J Σ σᶻᵢσᶻⱼ - h Σ σˣᵢ', 'ψ(x,t) = Σ cₙ e^(-iEₙt/ħ)', '∇·E = ρ/ε₀', 'F = 1 - ε', 'T₂* ≈ 4 µs ??', 'DO NOT ERASE', 'S = k ln Ω', '⟨ψ|H|ψ⟩ ≥ E₀', 'g⁽²⁾(0) < 1 !!']; for (let i = 0; i < 16; i++) { c.fillStyle = ['#1a3a8a', '#8a1a1a', '#1a6a2a', '#222'][i % 4]; c.fillText(eqs[i % eqs.length], 20 + (i % 4) * 250, 50 + Math.floor(i / 4) * 66); } });
    box(4.4, 1.3, 0.04, new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }), 0, 0, 0, g);
  }
  // plants
  { const g = new THREE.Group(); s.add(g); E.plants = g; for (const [x, z] of [[-3.5, -6.6], [-3.5, -13], [8.5, -5], [8.5, -13], [2.8, -3.6]]) { cyl(0.18, 0.14, 0.35, '#b5652e', x, 0.18, z, g, 10); for (let k = 0; k < 5; k++) { const l = sph(0.16, M('#3e7a3a'), x + (Math.random() - 0.5) * 0.3, 0.45 + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.3, g, 8); l.scale.set(1, 1.6, 0.4); l.rotation.y = Math.random() * 3; } } }
  // interlock beacons
  { const g = new THREE.Group(); s.add(g); E.interlock = g; W.beacon = sph(0.07, new THREE.MeshBasicMaterial({ color: '#ff3030' }), -3.6, 2.7, -4.12, g, 10); box(0.3, 0.2, 0.1, '#333', -2.6, 2.6, -4.12, g); box(0.25, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: '#ff3030' }), -2.6, 2.62, -4.18, g); }
  // ---- add-ons, upgrades and infrastructure (shown only when bought) ----
  const grp = (k, x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); s.add(g); E[k] = g; return g; };
  const steel = M('#c4c8cf', { metalness: 0.85, roughness: 0.25 });
  { const g = grp('slm', COLS[0], -7.0); box(0.18, 0.1, 0.14, '#111', 0.55, 1.09, -0.25, g); box(0.12, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: '#4060ff' }), 0.55, 1.1, -0.17, g); }
  { const g = grp('narrowlaser', COLS[0], -7.0); box(0.34, 0.12, 0.14, M('#d07020'), -0.25, 1.09, 0.33, g); }
  { const g = grp('cavity', COLS[1] - 0.45, -7.0); box(0.38, 0.26, 0.28, M('#d8d8d0'), 0, 1.08, 0, g); const cy = cyl(0.05, 0.05, 0.3, M('#a0d8ff', { transparent: true, opacity: 0.6 }), 0, 1.08, 0.15, g, 12); cy.rotation.z = Math.PI / 2; }
  { const g = grp('awg', 2.05, -5.2); box(0.5, 1.3, 0.5, '#1d1f24', 0, 0.65, 0, g); for (let i = 0; i < 6; i++) sph(0.012, new THREE.MeshBasicMaterial({ color: i % 2 ? '#30ff60' : '#30a0ff' }), -0.15 + i * 0.06, 1.1, 0.26, g, 4); box(0.4, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: '#103020' }), 0, 0.8, 0.26, g); }
  { const g = grp('jpa', 4.4, -6.0); cyl(0.03, 0.03, 1.0, '#666', 0, 0.5, 0, g, 6); box(0.25, 0.12, 0.18, M('#d4a640', { metalness: 1, roughness: 0.25 }), 0, 1.05, 0, g); }
  { const g = grp('snspd', -3.55, -8.3); cyl(0.18, 0.2, 0.9, steel, 0, 0.45, 0, g, 16); cyl(0.12, 0.12, 0.25, '#444', 0, 1.02, 0, g, 12); }
  { const g = grp('glovebox', -1.5, -5.3); box(1.0, 0.85, 0.6, '#555', 0, 0.42, 0, g); box(1.0, 0.6, 0.6, new THREE.MeshStandardMaterial({ color: '#b8d8ff', transparent: true, opacity: 0.35, roughness: 0.1 }), 0, 1.15, 0, g); for (const x of [-0.22, 0.22]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 16), M('#111')); r.position.set(x, 1.1, 0.31); g.add(r); } }
  { const g = grp('storage', 8.4, -12.3); box(0.6, 1.9, 0.7, '#202328', 0, 0.95, 0, g); for (let i = 0; i < 10; i++) box(0.5, 0.06, 0.02, '#3a3f48', 0, 0.3 + i * 0.15, -0.36, g); }
  { const g = grp('ups', 8.4, -10.4); for (const z of [-0.35, 0.35]) box(0.6, 1.5, 0.6, M('#9aa0a8'), 0, 0.75, z, g); box(0.15, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: '#30ff60' }), -0.31, 1.2, 0.35, g); }
  { const g = grp('fumehood', 8.45, -8.4); box(0.8, 2.2, 1.1, M('#e8e8e2'), 0, 1.1, 0, g); box(0.02, 0.8, 0.95, new THREE.MeshStandardMaterial({ color: '#c8e0f0', transparent: true, opacity: 0.4 }), -0.41, 1.3, 0, g); box(0.4, 0.6, 1.0, M('#d0a020'), 0.15, 0.3, 0, g); }
  { const g = grp('vibration', 1.1, -5.3); const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), M('#6a6e75', { roughness: 0.95 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.004; g.add(pad); }
  { const g = grp('printer', -3.55, -5.0); box(0.3, 0.32, 0.3, '#2a2c30', 0, 1.1, 0.5, g); box(0.24, 0.02, 0.24, new THREE.MeshBasicMaterial({ color: '#ff7020' }), 0, 1.0, 0.5, g); }
  { const g = grp('kitchen', 8.4, -5.6); box(0.6, 0.9, 1.2, M('#a07850'), 0, 0.45, 0, g); box(0.62, 0.04, 1.22, '#2b2e33', 0, 0.92, 0, g); box(0.4, 0.25, 0.3, '#ddd', 0, 1.07, -0.3, g); box(0.5, 1.5, 0.5, M('#e8e8e8'), 0, 0.75, 0.9, g); }
  { const g = grp('nappod', 8.2, -7.0); const sh = sph(0.45, M('#f0f0f0', { roughness: 0.3 }), 0, 0.75, 0, g, 18); sh.scale.set(1, 0.9, 1.3); const v = sph(0.3, M('#1a1a1a'), -0.2, 0.85, 0, g, 12); v.scale.set(0.6, 0.8, 1.1); }
  { const g = grp('confocal', -0.3, -5.35); box(0.6, 0.06, 0.5, M('#2a2d33'), 0, 0.9, 0, g); for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) cyl(0.02, 0.02, 0.87, '#555', x, 0.435, z, g, 6); box(0.12, 0.45, 0.12, M('#e8e8e8'), 0, 1.15, -0.1, g); const ob = cyl(0.03, 0.02, 0.12, M('#222'), 0, 1.0, 0.0, g, 10); box(0.25, 0.1, 0.2, '#1d1f24', 0.18, 0.98, 0.1, g); sph(0.012, new THREE.MeshBasicMaterial({ color: '#30ff60' }), 0.08, 0.99, 0.2, g, 6); }
  { const g = grp('femtolaser', -2.65, -5.3); box(0.9, 0.06, 0.55, M('#2a2d33'), 0, 0.85, 0, g); for (const [x, z] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]]) cyl(0.025, 0.025, 0.82, '#555', x, 0.41, z, g, 6); box(0.8, 0.22, 0.4, M('#e8e8ea', { metalness: 0.3, roughness: 0.4 }), 0, 0.99, 0, g); box(0.5, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: '#ff3020' }), 0, 1.1, 0.205, g); box(0.2, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: '#40a0ff' }), -0.25, 1.06, 0.205, g); }
  { const g = grp('library', 3.75, 0.2); g.rotation.y = -Math.PI / 2; for (let k = 0; k < 4; k++) { box(1.0, 0.03, 0.3, M('#4a3020'), 0, 0.5 + k * 0.45, 0, g); let x = -0.46; while (x < 0.45) { const bw = 0.05 + Math.random() * 0.04, bh = 0.25 + Math.random() * 0.12; box(bw, bh, 0.22, M(['#1f3f6a', '#7a2a2a', '#2a6a4a', '#a0522d', '#333'][(Math.random() * 5) | 0]), x + bw / 2, 0.515 + k * 0.45 + bh / 2, 0, g); x += bw + 0.005; } } }

  // the cat
  {
    const g = new THREE.Group(); s.add(g); E.cat = g; const cm = M('#e08a3a');
    const body = sph(0.1, cm, 0, 0.13, 0, g, 10); body.scale.set(0.8, 0.8, 1.6);
    sph(0.07, cm, 0, 0.2, 0.15, g, 10);
    for (const x of [-0.03, 0.03]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), cm); e.position.set(x, 0.27, 0.15); g.add(e); }
    const tail = cyl(0.015, 0.012, 0.25, cm, 0, 0.2, -0.2, g, 6); tail.rotation.x = -0.7; W.catTail = tail;
    for (const [x, z] of [[-0.05, 0.08], [0.05, 0.08], [-0.05, -0.08], [0.05, -0.08]]) cyl(0.018, 0.018, 0.1, cm, x, 0.05, z, g, 6);
    g.position.set(-1, 0, -9); W.cat = { g, target: new THREE.Vector3(-1, 0, -9), wait: 0 };
  }
}

// ---------------- characters ----------------
function hairMesh(look) {
  const g = new THREE.Group(); const hm = M(look.hair, { roughness: 0.9 });
  const top = (r, th, tilt = -0.25) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, th), hm); m.rotation.x = tilt; g.add(m); return m; };
  const back = (r, gap, th) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12, Math.PI / 2 + gap, Math.PI * 2 - gap * 2, 0, th), hm); g.add(m); return m; };
  switch (look.style) {
    case 'bald': { const f = new THREE.Mesh(new THREE.SphereGeometry(0.153, 18, 6, Math.PI / 2 + 1.5, Math.PI * 2 - 3, Math.PI * 0.42, Math.PI * 0.16), hm); g.add(f); } break;
    case 'short': top(0.158, Math.PI * 0.36); back(0.157, 1.25, Math.PI * 0.55); break;
    case 'long': top(0.16, Math.PI * 0.38); back(0.162, 1.0, Math.PI * 0.78); box(0.28, 0.32, 0.07, hm, 0, -0.18, -0.1, g); break;
    case 'bob': top(0.165, Math.PI * 0.38); back(0.17, 0.95, Math.PI * 0.68); break;
    case 'bun': top(0.158, Math.PI * 0.38); back(0.157, 1.2, Math.PI * 0.58); sph(0.07, hm, 0, 0.12, -0.12, g, 10); break;
    case 'ponytail': top(0.158, Math.PI * 0.38); back(0.157, 1.2, Math.PI * 0.58); { const t = cyl(0.04, 0.02, 0.28, hm, 0, -0.05, -0.19, g, 8); t.rotation.x = 0.3; } break;
    case 'curly': top(0.16, Math.PI * 0.4); back(0.16, 1.2, Math.PI * 0.6); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (Math.sin(a) > 0.7) continue; sph(0.045, hm, Math.cos(a) * 0.14, 0.08 + Math.random() * 0.04, Math.sin(a) * 0.13, g, 6); } break;
    case 'afro': top(0.215, Math.PI * 0.42, -0.35).position.y = 0.03; back(0.21, 1.0, Math.PI * 0.62).position.y = 0.02; break;
    case 'spiky': top(0.158, Math.PI * 0.36); back(0.157, 1.25, Math.PI * 0.5); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), hm); const a = i * 0.7, rr = 0.1; c.position.set(Math.cos(a) * rr * (i % 3) * 0.5, 0.15, Math.sin(a) * rr * 0.6 - 0.02); c.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); g.add(c); } break;
  }
  if (look.beard) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.153, 16, 8, Math.PI / 2 - 1.1 + Math.PI, 2.2, Math.PI * 0.55, Math.PI * 0.35), hm); b.rotation.y = Math.PI; g.add(b); }
  return g;
}

export class Char {
  constructor(look, opts = {}) {
    this.look = look; this.id = opts.id; this.name = opts.name || '';
    const g = this.g = new THREE.Group();
    const b = this.body = new THREE.Group(); g.add(b);
    const parts = buildHuman(look, b);
    this.legs = parts.legs; this.arms = parts.arms; this.head = parts.head;
    this.lids = parts.lids; this.eyesG = parts.eyesG; this.brows = parts.brows; this.mouth = parts.mouth; this.mouthIn = parts.mouthIn;
    b.scale.setScalar(look.height || 1);
    // label
    this.labelCanvas = document.createElement('canvas'); this.labelCanvas.width = 256; this.labelCanvas.height = 64;
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas); this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTex, depthTest: false, transparent: true }));
    this.label.scale.set(1.1, 0.275, 1); this.label.position.y = 1.98 * (look.height || 1); this.label.renderOrder = 10; g.add(this.label);
    this.setLabel(this.name, '');
    // state
    this.pose = 'stand'; this.path = []; this.speed = 2.3; this.t = Math.random() * 10; this.talk = 0; this.yawT = 0; this.mood = 0;
    this.blink = 2 + Math.random() * 3;
    g.traverse(o => { if (o.isMesh) { o.userData.char = this; } });
  }
  setLabel(name, emoji) {
    const key = name + emoji; if (this._lk === key) return; this._lk = key;
    const c = this.labelCanvas.getContext('2d'); c.clearRect(0, 0, 256, 64);
    c.font = '600 26px Inter, system-ui, sans-serif'; const tw = c.measureText(name).width + (emoji ? 40 : 0);
    const x0 = 128 - tw / 2 - 12; c.fillStyle = 'rgba(15,18,24,.72)'; c.beginPath(); c.roundRect(x0, 10, tw + 24, 44, 22); c.fill();
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(name, x0 + 12, 33);
    if (emoji) { c.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; c.fillText(emoji, x0 + 12 + tw - 34, 34); }
    this.labelTex.needsUpdate = true;
  }
  place(x, z, yaw, pose) { this.g.position.set(x, 0, z); this.g.rotation.y = yaw; this.yawT = yaw; this.setPose(pose); }
  setPose(p) { this.pose = p; }
  walk(points, done, endYaw, endPose) {
    this.path = points.map(([x, z]) => new THREE.Vector3(x, 0, z)); this.done = done; this.endYaw = endYaw; this.endPose = endPose || 'stand'; this.setPose('walk');
  }
  update(dt) {
    this.t += dt;
    const g = this.g;
    if (this.path.length) {
      const tgt = this.path[0]; const d = tgt.clone().sub(g.position); d.y = 0;
      const dist = d.length();
      if (dist < 0.05) { this.path.shift(); if (!this.path.length) { this.yawT = this.endYaw ?? this.yawT; this.setPose(this.endPose); const cb = this.done; this.done = null; if (cb) cb(); } }
      else { const step = Math.min(dist, this.speed * dt); g.position.addScaledVector(d.normalize(), step); this.yawT = Math.atan2(d.x, d.z); }
    }
    // turn smoothly
    let dy = this.yawT - g.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    g.rotation.y += dy * Math.min(1, dt * 8);
    // pose
    const [L, R] = this.legs, [AL, AR] = this.arms; const t = this.t; const h = this.look.height || 1;
    let bodyY = 0, bodyZ = 0;
    const lerp = (o, k, v) => { o.rotation[k] += (v - o.rotation[k]) * Math.min(1, dt * 12); };
    if (this.pose === 'walk') {
      const s = Math.sin(t * 11);
      lerp(L.hip, 'x', s * 0.55); lerp(R.hip, 'x', -s * 0.55);
      lerp(L.knee, 'x', Math.max(0, -s) * 0.7); lerp(R.knee, 'x', Math.max(0, s) * 0.7);
      lerp(AL.sh, 'x', -s * 0.5); lerp(AR.sh, 'x', s * 0.5); lerp(AL.el, 'x', -0.3); lerp(AR.el, 'x', -0.3);
      bodyY = Math.abs(Math.cos(t * 11)) * 0.025;
    } else if (this.pose === 'sit' || this.pose === 'type') {
      for (const l of this.legs) { lerp(l.hip, 'x', -Math.PI / 2); lerp(l.knee, 'x', Math.PI / 2); }
      bodyY = 0.5 - 0.9 * h; bodyZ = -0.05;
      if (this.pose === 'type') { for (const a of this.arms) { lerp(a.sh, 'x', -0.9 + Math.sin(t * 9 + a.sx) * 0.05); lerp(a.el, 'x', -0.7); } }
      else if (this.talk > 0) { lerp(AL.sh, 'x', -0.6 + Math.sin(t * 3.1) * 0.35); lerp(AR.sh, 'x', -0.4 + Math.sin(t * 2.3 + 1) * 0.25); lerp(AL.el, 'x', -1.0 + Math.sin(t * 4) * 0.3); lerp(AR.el, 'x', -0.8); }
      else { for (const a of this.arms) { lerp(a.sh, 'x', -0.35); lerp(a.el, 'x', -0.9); } }
    } else if (this.pose === 'work') {
      for (const l of this.legs) { lerp(l.hip, 'x', 0); lerp(l.knee, 'x', 0); }
      lerp(AL.sh, 'x', -0.85 + Math.sin(t * 1.3) * 0.15); lerp(AR.sh, 'x', -0.7 + Math.sin(t * 1.7 + 2) * 0.2); lerp(AL.el, 'x', -0.6); lerp(AR.el, 'x', -0.8 + Math.sin(t * 2.1) * 0.2);
      this.head.rotation.x = 0.35 + Math.sin(t * 0.7) * 0.08;
    } else {
      for (const l of this.legs) { lerp(l.hip, 'x', 0); lerp(l.knee, 'x', 0); }
      if (this.talk > 0) { lerp(AL.sh, 'x', -0.5 + Math.sin(t * 3.1) * 0.4); lerp(AL.el, 'x', -0.9); lerp(AR.sh, 'x', 0.05); lerp(AR.el, 'x', -0.1); }
      else { for (const a of this.arms) { lerp(a.sh, 'x', Math.sin(t * 1.2 + a.sx) * 0.03); lerp(a.el, 'x', -0.12); } }
    }
    for (const a of this.arms) a.sh.rotation.z = a.sx * 0.06;
    this.body.position.y += (bodyY - this.body.position.y) * Math.min(1, dt * 10);
    this.body.position.z = bodyZ;
    if (this.pose !== 'work') this.head.rotation.x += ((this.pose === 'type' ? 0.25 : 0) + (this.talk > 0 ? Math.sin(t * 5) * 0.06 : 0) - this.head.rotation.x) * Math.min(1, dt * 6);
    this.head.rotation.y = this.talk > 0 ? Math.sin(t * 1.7) * 0.12 : Math.sin(t * 0.4) * 0.15;
    // mouth + blink + mood brows
    // lower lip drops while talking
    const open = this.talk > 0 ? Math.abs(Math.sin(t * 13)) * 0.008 : 0;
    this.mouth.position.y += ((this.mouth.userData.y0 - open) - this.mouth.position.y) * Math.min(1, dt * 20);
    if (this.mouthIn) this.mouthIn.scale.y = 0.05 + open * 40;
    // blinking eyelids
    this.blink -= dt; const closed = this.blink < 0.11; if (this.blink < 0) this.blink = 2 + Math.random() * 4;
    for (const l of this.lids) l.rotation.x += ((closed ? 1.5 : -0.6 - (this.talk > 0 ? 0.08 : 0) + (this.mood < -0.3 ? 0.2 : 0)) - l.rotation.x) * Math.min(1, dt * 30);
    // eyes drift and glance around
    if (Math.random() < dt * 0.8) { this.gx = (Math.random() - 0.5) * 0.4; this.gy = (Math.random() - 0.5) * 0.2; }
    for (const e of this.eyesG) { e.rotation.y += ((this.gx || 0) - e.rotation.y) * Math.min(1, dt * 15); e.rotation.x += ((this.gy || 0) - e.rotation.x) * Math.min(1, dt * 15); }
    // mood shows in the brows and the corners of the mouth
    const m = this.mood; this.brows[0].rotation.z = Math.PI / 2 - 0.12 - m * 0.3; this.brows[1].rotation.z = Math.PI / 2 + 0.12 + m * 0.3;
    this.brows[0].position.y = this.brows[1].position.y = 0.041 + (m < -0.3 ? 0.004 : 0);
    this.mouth.scale.y = m > 0.3 ? 1.15 : 1;
    if (this.talk > 0) this.talk -= dt;
  }
}

export function addChar(key, look, name) {
  const c = new Char(look, { id: key, name });
  shadowAll(c.g); tuneEnv(c.g); c.label.castShadow = false;
  W.scene.add(c.g); W.chars.set(key, c);
  c.g.traverse(o => { if (o.isMesh) { o.userData.action = 'person'; o.userData.data = key; o.userData.tip = name; } });
  return c;
}
export function removeChar(key) { const c = W.chars.get(key); if (c) { W.scene.remove(c.g); W.chars.delete(key); } }

// paths
export const stationOf = idx => ST[idx] || ST[0];
export function pathToOffice(from, chair) {
  const pts = [];
  if (from.z < -5) { pts.push([from.x, AISLE]); pts.push([-3.3, AISLE]); pts.push([CORR, AISLE]); }
  pts.push([CORR, DOORZ]); pts.push([-3.2, DOORZ]); pts.push([chair.x - 0.2, chair.z - 0.7]); pts.push([chair.x, chair.z]);
  return pts;
}
export function pathFromOffice(chair, to) {
  const pts = [[chair.x - 0.3, chair.z - 0.6], [-3.2, DOORZ], [CORR, DOORZ]];
  if (to.z < -5) { pts.push([CORR, AISLE]); pts.push([-3.3, AISLE]); pts.push([to.x, AISLE]); pts.push([to.x, to.z]); }
  else pts.push([to.x, to.z]);
  return pts;
}
export const ENTRANCE = { x: CORR, z: 8 };

// ---------------- frames / trophies / equipment ----------------
export function syncDecor(G) {
  for (const k in W.equipGroups) W.equipGroups[k].visible = !!G.equip[k];
  for (const b of W.benches) if (b.userData.expansion) b.visible = !!G.equip.expansion;
  W.crates.visible = !G.equip.expansion;
  W.equipGroups.cat && (W.cat.g.visible = !!G.equip.cat);
  for (const b of W.benches) if (b.userData.chair) { b.userData.chair.children.forEach(m => { if (m.material && m.material.color) m.material = M(G.equip.chairs ? '#1a1a1a' : '#555'); }); b.userData.back.scale.y = G.equip.chairs ? 1.5 : 1; }
  if (W.fridgeGlow) W.fridgeGlow.intensity = G.broken.fridge ? 0 : 1.4;
  W.medal.visible = !!G.won;
  // name plate and lab sign
  drawTex(W.nameTex, (c, w, h) => { c.fillStyle = '#c9a24a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1c0a'; c.font = '600 28px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(G.pi, w / 2, h / 2); });
  drawTex(W.plateTex, (c, w, h) => { c.fillStyle = '#d8d2c0'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = '600 24px Georgia'; c.textAlign = 'center'; c.fillText(G.pi, w / 2, 32); c.font = '18px Georgia'; c.fillText(['Assistant Professor', 'Associate Professor', 'Professor', 'Endowed Chair'][G.titleIdx], w / 2, 60); });
  drawTex(W.labSignTex, (c, w, h) => { c.fillStyle = '#1f3a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '600 34px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(G.labName, w / 2, h / 2); });
  // paper frames
  const good = G.papers.filter(p => p.rep >= 10 && !p.retracted).slice(-12);
  const key = good.map(p => p.title).join('|') + G.titleIdx + G.grantsWon + G.graduated;
  if (key !== W.framesKey) {
    W.framesKey = key;
    while (W.frames.children.length) W.frames.remove(W.frames.children[0]);
    good.forEach((p, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const t = canvasTex(160, 210, (c, w, h) => {
        c.fillStyle = p.landmark ? '#d4a640' : '#2a2a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fbf8f0'; c.fillRect(10, 10, w - 20, h - 20);
        c.fillStyle = p.jid === 'nature' ? '#c0392b' : p.jid === 'science' ? '#8a1414' : '#1f3f7a'; c.fillRect(10, 10, w - 20, 38);
        c.fillStyle = '#fff'; c.font = 'bold 18px Georgia'; c.textAlign = 'center'; c.fillText(p.journal, w / 2, 36);
        c.fillStyle = '#222'; c.font = '12px Georgia'; wrap(c, p.title, w / 2, 70, w - 34, 15);
        c.fillStyle = `hsl(${(i * 67) % 360},50%,55%)`; c.fillRect(30, 150, w - 60, 40);
      });
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), new THREE.MeshBasicMaterial({ map: t }));
      fr.position.set(-3.93, 2.25 - row * 0.5, 0.3 + col * 0.42 + (row % 2) * 0.05); fr.rotation.y = Math.PI / 2; W.frames.add(fr);
      clickable(fr, 'cv', `${p.journal}: ${p.title}`);
    });
    // trophies on the shelf
    while (W.trophies.children.length) W.trophies.remove(W.trophies.children[0]);
    const n = Math.min(10, G.grantsWon + G.graduated + (G.tenured ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const tg = new THREE.Group(); tg.position.set(0, 0, -0.7 + i * 0.15); W.trophies.add(tg);
      if (i % 2) { box(0.03, 0.14, 0.1, M('#3a2a1a'), 0, 0.07, 0, tg); box(0.035, 0.08, 0.07, M('#d4a640', { metalness: 0.9, roughness: 0.3 }), 0, 0.07, 0, tg); }
      else { cyl(0.03, 0.04, 0.03, '#333', 0, 0.015, 0, tg, 10); cyl(0.04, 0.015, 0.09, M('#d4a640', { metalness: 0.9, roughness: 0.3 }), 0, 0.08, 0, tg, 12); }
    }
  }
}
function drawTex(tex, fn) { const c = tex.image; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); fn(g, c.width, c.height); tex.needsUpdate = true; }
export function wrap(c, text, x, y, maxW, lh, maxLines = 6) {
  const words = text.split(' '); let line = ''; let n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { c.fillText(line + '…', x, y); return; } } else line = t; }
  c.fillText(line, x, y);
}

// ---------------- frame update ----------------
export function updateWorld(dt) {
  W.t += dt;
  for (const c of W.chars.values()) {
    c.update(dt);
    // name tags fade out up close (e.g. standing next to someone on a lap)
    const d = c.g.position.distanceTo(W.camera.position);
    c.label.material.opacity = Math.max(0, Math.min(1, (d - 1.6) / 1.4));
  }
  // walking a lap around the lab: the camera follows a path at standing eye height
  if (W.lap) {
    const L = W.lap; const cam = W.camera.position;
    const tgt = L.pts[L.i]; const d = tgt.clone().sub(cam); const dist = d.length();
    if (L.paused) {
      // standing next to someone at their bench, facing them while you talk
      const f = L.cur ? L.cur.focus : [cam.x, 1.3, cam.z - 1], dx = f[0] - cam.x, dy2 = f[1] - cam.y, dz = f[2] - cam.z;
      W.tYaw = W.yaw + (((Math.atan2(-dx, -dz) - W.yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      W.tPitch = Math.atan2(dy2, Math.hypot(dx, dz)); W.tFov = 55;
    } else if (dist < 0.08) {
      const here = L.i; L.i++;
      if (lapArrive(L, here)) { /* talking */ }
      else if (L.i >= L.pts.length) lapEnd(L);
    }
    else {
      cam.addScaledVector(d.normalize(), Math.min(dist, dt * 3.0));
      let head = Math.atan2(-d.x, -d.z);
      // in the lab aisle, glance toward the benches on either side
      if (cam.z < -8.5 && cam.x > -3.6) head += Math.sin(W.t * 1.6) * 0.9;
      let dy = head - W.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      W.tYaw = W.yaw + dy; W.tPitch = -0.12; W.tFov = 60;
    }
  }
  // camera
  W.yaw += (W.tYaw - W.yaw) * Math.min(1, dt * 6);
  W.pitch += (W.tPitch - W.pitch) * Math.min(1, dt * 6);
  W.fov += (W.tFov - W.fov) * Math.min(1, dt * 6);
  W.camera.rotation.set(W.pitch, W.yaw, 0);
  const vf = fitFov(W.fov);
  if (Math.abs(W.camera.fov - vf) > 0.01) { W.camera.fov = vf; W.camera.updateProjectionMatrix(); }
  // tall screens: while a conversation box covers the bottom half, lift the picture so the person you're
  // talking to sits in the visible upper part instead of behind the box
  const h = window.innerHeight, w = window.innerWidth;
  const dlg = document.getElementById('dialog');
  const want = w / h < 0.8 && dlg && dlg.classList.contains('show') ? Math.min(dlg.offsetHeight * 0.4, h * 0.16) : 0;
  W.shift = (W.shift || 0) + (want - (W.shift || 0)) * Math.min(1, dt * 5);
  if (Math.abs(W.shift) > 0.5) { W.camera.setViewOffset(w, h, 0, W.shift, w, h); W.offsetOn = true; }
  else if (W.offsetOn) { W.camera.clearViewOffset(); W.offsetOn = false; }
  // door
  W.doorOpen += (W.doorTarget - W.doorOpen) * Math.min(1, dt * 4);
  W.door.rotation.y = W.doorOpen * Math.PI * 0.48;
  // phone
  if (W.phoneRing > 0) { W.phoneRing -= dt; W.phone.rotation.z = Math.sin(W.t * 60) * 0.04; W.phoneLight.material.color.set(Math.sin(W.t * 10) > 0 ? '#ff2020' : '#330000'); }
  else { W.phone.rotation.z = 0; W.phoneLight.material.color.set('#330000'); }
  // lab life
  if (W.leds) for (let i = 0; i < W.leds.length; i++) if (Math.random() < dt * 3) W.leds[i].material.color.set(Math.random() < 0.6 ? '#30a0ff' : Math.random() < 0.5 ? '#30ff60' : '#0a1a2a');
  if (W.beacon) W.beacon.material.color.set(Math.sin(W.t * 3) > 0 ? '#ff3030' : '#601010');
  if (W.plasmaGlow) W.plasmaGlow.material.color.setHSL(0.78, 0.9, 0.5 + Math.sin(W.t * 7) * 0.15);
  if (W.scopeTex && Math.random() < dt * 10) drawTex(W.scopeTex, (c, w, h) => { c.fillStyle = '#062010'; c.fillRect(0, 0, w, h); c.strokeStyle = '#30ff60'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < w; x++) c.lineTo(x, h / 2 + Math.sin(x / 7 + W.t * 6) * 20 * Math.exp(-((x - 64) ** 2) / 1500) + (Math.random() - 0.5) * 3); c.stroke(); });
  // the cat
  if (W.cat && W.cat.g.visible) {
    const ct = W.cat; const d = ct.target.clone().sub(ct.g.position); d.y = 0;
    if (d.length() < 0.05) { ct.wait -= dt; if (ct.wait < 0) { ct.target.set(-3 + Math.random() * 7, 0, -5.2 - Math.random() * 7.5); ct.wait = 2 + Math.random() * 8; } }
    else { ct.g.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * 0.6)); ct.g.rotation.y = Math.atan2(d.x, d.z); }
    W.catTail.rotation.z = Math.sin(W.t * 2) * 0.4;
  }
}

// three.js FOV is vertical, so a tall phone screen would see only a narrow sliver. Keep the horizontal view
// at least as wide as on a 1.25:1 screen, which shows a portrait player about the same scene as a laptop.
function fitFov(f) {
  const a = W.camera.aspect, ref = 1.25;
  if (a >= ref) return f;
  const v = 2 * Math.atan(Math.tan(f * Math.PI / 360) * ref / a) * 180 / Math.PI;
  return Math.min(v, 105);
}

export function render() { renderFrame(W.renderer, W.scene, W.camera); }

// ---------------- picking ----------------
const ray = new THREE.Raycaster(); const v2 = new THREE.Vector2();
export function pickAt(x, y) {
  v2.set(x / window.innerWidth * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(v2, W.camera);
  const objs = [...W.clickables];
  for (const c of W.chars.values()) objs.push(c.g);
  const hits = ray.intersectObjects(objs, true);
  for (const h of hits) {
    let o = h.object;
    while (o) { if (o.userData && o.userData.action) { if (o.visible === false) break; return { action: o.userData.action, data: o.userData.data, tip: o.userData.tip, dist: h.distance }; } o = o.parent; }
  }
  return null;
}

export function lookAt(x, y, z, fov = 54) {
  const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  W.tYaw = Math.atan2(-dx, -dz); W.tPitch = Math.atan2(dy, Math.hypot(dx, dz)); W.tFov = fov;
}
export function lookMonitor() { const p = new THREE.Vector3(); W.monitor.children[2].getWorldPosition(p); lookAt(p.x, p.y, p.z, 30); }
export function lookHome() { W.tYaw = 0; W.tPitch = -0.06; W.tFov = 54; }
// A lap walks down the lab aisle (z = -9.4) and stops next to every lab member at their bench, facing them.
// stops: [{ x, z, onStop }] with the person's bench position. Returns the number of stops.
export const lapPaused = () => !!(W.lap && W.lap.paused);
export function startLap(done, stops) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pts = [V(0, 1.25, 2.95), V(-1.6, 1.62, 2.4), V(-3.0, 1.62, -1.0), V(-5.4, 1.62, -1.0), V(-5.4, 1.62, AISLE)];
  const at = {};
  for (const st of [...stops].sort((p, q) => p.x - q.x)) {
    const side = st.z > AISLE ? 1 : -1; // front row or back row
    pts.push(V(st.x + 0.75, 1.62, AISLE));
    pts.push(V(st.x + 0.75, 1.62, st.z + side * 0.45)); // stand beside them, a little toward the aisle
    at[pts.length - 1] = { ...st, focus: [st.x, 1.3, st.z] };
    pts.push(V(st.x + 0.75, 1.62, AISLE));
  }
  pts.push(V(-5.4, 1.62, AISLE), V(-5.4, 1.62, -1.0), V(-3.0, 1.62, -1.0), V(-1.6, 1.62, 2.4), V(0, 1.25, 2.95));
  W.lap = { pts, i: 1, done, at, cur: null };
  return Object.keys(at).length;
}
export function resumeLap() { if (W.lap) { W.lap.paused = false; W.lap.cur = null; } }
function lapArrive(L, idx) {
  const s = L.at[idx]; if (!s || s.done) return false;
  s.done = true; L.cur = s; L.paused = true; if (s.onStop) s.onStop(); return true;
}
function lapEnd(L) { W.lap = null; W.camera.position.copy(CAM); W.tYaw = W.yaw = 0; W.tPitch = W.pitch = -0.06; if (L.done) L.done(); }
// clicking while walking jumps to the next person; after the last person, straight back to the office
export function skipLap() {
  if (!W.lap) return; const L = W.lap;
  if (L.paused) return;
  const next = Object.keys(L.at).map(Number).sort((x, y) => x - y).find(i => i >= L.i && !L.at[i].done);
  if (next === undefined) { lapEnd(L); return; }
  W.camera.position.copy(L.pts[next]); L.i = next + 1; lapArrive(L, next);
}
