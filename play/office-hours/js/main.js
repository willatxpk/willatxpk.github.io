// Boot, main loop, visits choreography.
import { FIELDS, EQUIP, HOBBIES, HOME } from './data.js';
import * as S from './sim.js';
import { G, hooks, team, person, mod, clamp, queueVisit, busy, tickWeek, save, loadSave, clearSave, newGame, load } from './sim.js';
import { director, runVisit, extInfo, visitorName } from './events.js';
import { trust, vary } from './talk.js';
import { interestText, fitScore } from './career.js';
import { W, startLap, skipLap, resumeLap, initWorld, updateWorld, render, addChar, removeChar, syncDecor, stationOf, pathToOffice, pathFromOffice, ENTRANCE, CHAIR_MAIN, CHAIR_TWO, pickAt, lookAt, lookMonitor, lookHome } from './world.js';
import { UI, hud, toast, tip, showDialogue, openComputer, closeComputer, renderComputer, drawMonitor, drawWhiteboard, weekBar } from './ui.js';

const $ = s => document.querySelector(s);
const st = { mode: 'title', phase: 'idle', visit: null, actors: [], weekT: 0, cool: 1, labelT: 0, monT: 0, wanderT: 6, pendingSync: false };

// ---------- world <-> sim sync ----------
function syncPeople() {
  if (!G) return;
  const T = team();
  for (const p of T) {
    let c = W.chars.get(p.id);
    if (!c) { c = addChar(p.id, p.look, p.first); placeAtStation(c, p); }
    c.name = p.first;
    if (!c.inVisit && !c.walking) {
      const s = stationOf(p.station);
      const d = Math.hypot(c.g.position.x - s.x, c.g.position.z - s.z);
      if (d > 0.3) placeAtStation(c, p);
    }
    c.g.visible = !(p.away > 0) || c.inVisit;
  }
  for (const [key, c] of W.chars) {
    if (key.startsWith('ext:')) continue;
    const p = person(key);
    if ((!p || p.gone) && !c.inVisit && !c.leaving) {
      c.leaving = true; c.walking = true;
      c.walk(pathFromOffice({ x: c.g.position.x, z: c.g.position.z }, ENTRANCE).slice(1).concat([[ENTRANCE.x, ENTRANCE.z]]), () => removeChar(key));
      if (c.g.position.z < -5) c.walk([[c.g.position.x, -9.4], [-3.3, -9.4], [-5.4, -9.4], [ENTRANCE.x, ENTRANCE.z]], () => removeChar(key));
    }
  }
}
function placeAtStation(c, p) {
  const s = stationOf(p.station);
  c.place(s.x, s.z, s.yaw, s.pose);
}
function syncAll() {
  syncPeople(); syncDecor(G);
  drawWhiteboard(W.wbCanvas.getContext('2d'), W.wbCanvas.width, W.wbCanvas.height); W.wbTex.needsUpdate = true;
  W.doorTarget = G.dnd ? 0 : 1;
}
hooks.worldSync = () => { st.pendingSync = true; };
hooks.toast = toast;
hooks.mail = () => { };
hooks.gameOver = reason => setTimeout(() => showGameOver(reason), 800);
hooks.billionaire = () => setTimeout(() => { $('#goT').textContent = '💰 Billionaire'; $('#goB').textContent = `Your net worth just passed one billion dollars. You still have a lab, a desk and students who need you. Do you keep doing physics? (Of course you do.)`; $('#goStats').innerHTML = `Companies: ${G.fin.companies.length} · Papers: ${G.papers.length} · Years: ${Math.ceil(G.week / 48)}`; $('#goNew').textContent = 'Keep going'; $('#gameover').classList.add('show', 'win'); $('#goNew').onclick = () => $('#gameover').classList.remove('show'); }, 1500);
UI.sync = () => { syncAll(); hud(); };

// ---------- visits ----------
function startVisit(v) {
  const A = v.A ? person(v.A) : null, B = v.B ? person(v.B) : null;
  if ((v.A && (!A || A.gone)) || (v.B && (!B || B.gone))) return false;
  if (A && A.away) { G.queue.push(v); return false; }
  // build the conversation now (time is frozen while they walk in); skip visits that no longer make sense
  let node = null;
  try { node = runVisit(v); } catch (e) { console.error(e); }
  if (!node) return false;
  st.node = node;
  st.visit = v; st.phase = 'walking'; st.actors = [];
  S.G.stats.visits++;
  if (v.ext === 'phone' || (extInfo(v) || {}).phone) {
    W.phoneRing = 2.5;
    lookAt(-0.75, 0.85, 1.7, 50);
    setTimeout(() => beginTalk(), 2300);
    return true;
  }
  const arrive = () => { if (st.actors.every(a => a.arrived)) beginTalk(); };
  const send = (key, chair) => {
    const c = W.chars.get(key);
    const a = { key, c, chair, arrived: false };
    st.actors.push(a);
    c.inVisit = true; c.walking = true; c.g.visible = true; c.label.visible = false;
    const small = (c.look.height || 1) < 0.75; // kids stand by the desk so you can see them
    c.walk(pathToOffice({ x: c.g.position.x, z: c.g.position.z }, small ? { x: chair.x + 0.25, z: chair.z + 0.45 } : chair), () => { a.arrived = true; c.walking = false; arrive(); }, chair.yaw, small ? 'stand' : 'sit');
  };
  if (A) send(A.id, CHAIR_MAIN);
  if (B) send(B.id, CHAIR_TWO);
  if (v.ext) {
    const info = extInfo(v);
    if (!info || !info.look) { st.visit = null; st.phase = 'idle'; return false; }
    const key = 'ext:' + v.id;
    const c = addChar(key, info.look, info.first || info.name);
    c.place(ENTRANCE.x, ENTRANCE.z, Math.PI, 'stand');
    send(key, A ? CHAIR_TWO : CHAIR_MAIN);
  }
  if (G.dnd && (v.pri || 0) >= 5) W.doorTarget = 1;
  return true;
}

function skipWalk() {
  for (const a of st.actors) {
    const c = a.c; if (!c.path.length) continue;
    const end = c.path[c.path.length - 1]; c.g.position.copy(end); c.path = [end];
  }
}

function beginTalk() {
  if (st.phase !== 'walking') return;
  st.phase = 'talking';
  const main = st.actors[0];
  if (main) lookAt(main.chair.x, 1.2, main.chair.z, 55);
  const node = st.node; st.node = null;
  if (!node) { endVisit(); return; }
  showDialogue(node);
}

UI.onSpeak = who => {
  for (const a of st.actors) a.c.talk = 0;
  let a = null;
  if (who && who.id) a = st.actors.find(x => x.key === who.id);
  if (!a) a = st.actors.find(x => x.key.startsWith('ext:')) || st.actors[0];
  if (a) { a.c.talk = 2.4; lookAt(a.chair.x, 1.2, a.chair.z, 55); }
  // mood on faces
  for (const x of st.actors) { const p = person(x.key); if (p) x.c.mood = p.morale < 35 || p.stress > 70 ? -0.6 : p.morale > 70 ? 0.5 : 0; }
};
UI.onDialogueEnd = () => { if (st.phase === 'lap') { resumeLap(); return; } endVisit(); };

function endVisit() {
  st.phase = 'leaving';
  lookHome();
  for (const a of st.actors) {
    const c = a.c; c.talk = 0; c.walking = true;
    const p = person(a.key);
    if (a.key.startsWith('ext:') || !p || p.gone) {
      c.leaving = true;
      c.walk(pathFromOffice(a.chair, ENTRANCE), () => removeChar(a.key), 0, 'stand');
    } else {
      const s = stationOf(p.station);
      c.walk(pathFromOffice(a.chair, s), () => { c.inVisit = false; c.walking = false; c.label.visible = true; c.g.visible = !(p.away > 0); }, s.yaw, s.pose);
    }
  }
  st.visit = null; st.actors = [];
  st.cool = 2.5; st.phase = 'idle';
  if (G.dnd) W.doorTarget = 0;
  if (G.won && !G.flags.winShown) { G.flags.winShown = true; setTimeout(showWin, 2500); }
  save(); hud(); syncAll();
}

// ---------- lab life ----------
function emojiFor(p) {
  const v = G.queue.find(q => q.A === p.id || q.B === p.id);
  if (v) return { results: '📈', review: '📬', idea: '💡', brainstorm: '💡', burnout: '😰', quit: '💼', scooped: '😱', accident: '😬', checkin: '🚪', followup: '🗣️', equipreq: '🧰', chat: '☕' }[v.ev] || (v.B ? '💢' : '🚪');
  if (p.stress > 72) return '😰';
  if (p.morale < 28) return '😞';
  if (!p.project) return '💤';
  if (p.morale > 78) return '😊';
  return '';
}
function labLife(dt) {
  st.labelT -= dt;
  if (st.labelT < 0 && st.phase !== 'lap') {
    st.labelT = 0.5;
    for (const p of team()) { const c = W.chars.get(p.id); if (c) c.setLabel(p.first, emojiFor(p)); }
  }
  // people wander to the coffee machine and back
  st.wanderT -= dt;
  if (st.wanderT < 0) {
    st.wanderT = 5 + Math.random() * 10;
    const free = team().filter(p => !p.away && W.chars.get(p.id) && !W.chars.get(p.id).inVisit && !W.chars.get(p.id).walking);
    if (free.length) {
      const p = S.pick(free); const c = W.chars.get(p.id); const s = stationOf(p.station);
      const tgt = G.equip.espresso && Math.random() < 0.6 ? [-2.9 + Math.random() * 0.2, -5.0 + Math.random() * 0.6] : [s.x + (Math.random() - 0.5) * 3, -9.4 + (Math.random() - 0.5) * 0.6];
      c.walking = true;
      const back = () => setTimeout(() => { if (c.inVisit || !W.chars.has(p.id)) return; c.walk([[s.x, -9.4], [s.x, s.z]], () => { c.walking = false; }, s.yaw, s.pose); }, 2500 + Math.random() * 3000);
      c.walk([[s.x, -9.4], tgt], () => { c.setPose('stand'); back(); }, Math.random() * 6, 'stand');
    }
  }
}

// ---------- input ----------
let drag = null, hoverT = 0, lastMove = null;
const canvas = $('#c');
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  lastMove = e;
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
  drag.x = e.clientX; drag.y = e.clientY;
  if (UI.computer) return;
  W.tYaw = clamp(W.tYaw + dx * 0.0042, -2.1, 2.1); W.tPitch = clamp(W.tPitch + dy * 0.0035, -0.7, 0.5); W.tFov = 54;
});
canvas.addEventListener('pointerup', e => {
  const d = drag; drag = null;
  if (!d || d.moved > 6 || st.mode !== 'play' || UI.computer) return;
  if (st.phase === 'walking') { skipWalk(); return; }
  if (st.phase === 'lap') { if (!UI.dialog) skipLap(); return; }
  const h = pickAt(e.clientX, e.clientY);
  if (h) act(h);
});
window.addEventListener('keydown', e => {
  if (st.mode !== 'play' || UI.computer || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft' || e.key === 'a') W.tYaw = clamp(W.tYaw + 0.25, -2.1, 2.1);
  if (e.key === 'ArrowRight' || e.key === 'd') W.tYaw = clamp(W.tYaw - 0.25, -2.1, 2.1);
  if (e.key === 'Home' || e.key === 'h') lookHome();
  if (e.key === ' ' && !UI.dialog) { G.paused = !G.paused; hud(); e.preventDefault(); }
});

function act(h) {
  switch (h.action) {
    case 'computer': openPC(); break;
    case 'whiteboard': openPC('projects'); break;
    case 'cv': openPC('cv'); break;
    case 'coffee': {
      if (G.coffeeWeek !== G.week) { G.coffeeWeek = G.week; G.energy = clamp(G.energy + 15, 0, 100); toast('☕ Ahh. +15 energy.'); }
      else toast('☕ You already had this week\'s good coffee. The rest is just jitters.');
      W.mug.position.y = 0.86; setTimeout(() => W.mug.position.y = 0.79, 500); hud(); break;
    }
    case 'door': G.dnd = !G.dnd; W.doorTarget = G.dnd ? 0 : 1; toast(G.dnd ? '🚫 Door closed. People will queue outside (and grumble).' : '🚪 Door open. Come on in.'); hud(); break;
    case 'phone': if (W.phoneRing <= 0) toast(S.pick(['📞 Dial tone. Nobody calls anymore.', '📞 One voicemail: "This is your car\'s extended warranty..."', '📞 The department admin wants to know where the receipts are.'])); break;
    case 'person': {
      if (String(h.data).startsWith('ext:')) break;
      const p = person(h.data); if (!p) break;
      if (st.actors.some(a => a.key === p.id)) break;
      if (busy(p.id)) { toast(`${p.first} is already planning to come by.`); break; }
      queueVisit({ ev: 'checkin', A: p.id, pri: 3 }, true); toast(`📣 You wave ${p.first} over for a 1:1.`); hud();
      break;
    }
  }
}
function openPC(app) {
  if (UI.dialog) return;
  lookMonitor();
  setTimeout(() => openComputer(app), 280);
}
UI.onCloseComputer = () => { lookHome(); syncAll(); hud(); };
UI.onNewGame = () => { clearSave(); location.reload(); };

// hover tooltip
function hover(dt) {
  hoverT -= dt;
  if (hoverT > 0 || !lastMove || drag || UI.computer || st.mode !== 'play') { if (UI.computer || st.mode !== 'play') tip(null); return; }
  hoverT = 0.08;
  const h = pickAt(lastMove.clientX, lastMove.clientY);
  if (h) {
    let t = h.tip;
    if (h.action === 'person' && !String(h.data).startsWith('ext:')) { const p = person(h.data); if (p) t = `${p.first} ${p.last} · ${S.roleName(p)}${p.project ? '' : ' · no project'} · click for a 1:1`; }
    tip(t, lastMove.clientX, lastMove.clientY); canvas.style.cursor = 'pointer';
  } else { tip(null); canvas.style.cursor = 'grab'; }
}

// HUD buttons
document.querySelectorAll('.spd').forEach(b => b.onclick = () => { const s = +b.dataset.s; if (s === 0) G.paused = !G.paused; else { G.speed = s; G.paused = false; } hud(); });
$('#hDnd').onclick = () => act({ action: 'door' });
$('#hLap').onclick = () => takeLap();

// ---------- taking a lap around the lab ----------
function takeLap() {
  if (st.mode !== 'play' || st.phase !== 'idle' || UI.dialog || UI.computer || G.over) { toast('Finish what you\'re doing first.'); return; }
  if (G.life && G.life.away > 0) { toast('You\'re not in the office this week.'); return; }
  if (G.life && G.life.footUntil > G.week) { toast('🦶 You\'re on crutches. A lap around the lab is not happening.'); return; }
  if (G.flags.lapWeek === G.week) { toast('You already walked around this week. Any more and it\'s hovering.'); return; }
  G.flags.lapWeek = G.week;
  G.flags.laps = (G.flags.laps || []).filter(w => G.week - w < 6); G.flags.laps.push(G.week);
  const hovering = G.flags.laps.length >= 4;
  // everyone reacts according to how much they trust you
  const reacts = [];
  for (const p of team().filter(q => !q.away)) {
    let sc = trust(p) * 20 + (S.has(p, 'social') ? 6 : 0) - (S.has(p, 'anxious') ? 8 : 0) - (S.has(p, 'loner') ? 5 : 0) - (hovering ? 12 : 0) + (p.stress > 70 ? -6 : 0) + (Math.random() - 0.4) * 10;
    const angry = S.has(p, 'hothead') && p.morale < 40 && sc < 0;
    if (sc >= 0) { mod(p, { morale: 5, stress: -2 }); reacts.push([p, S.pick(['😊', '👋', '🙂'])]); }
    else { mod(p, { stress: 6, morale: -1 }); reacts.push([p, angry ? '😠' : S.pick(['😰', '😬', '😒'])]); }
  }
  for (const [p, e] of reacts) { const c = W.chars.get(p.id); if (c) c.setLabel(p.first, e); }
  st.phase = 'lap';
  tip(null);
  const good = reacts.filter(([, e]) => ['😊', '👋', '🙂'].includes(e)).length;
  S.G.culture = clamp(S.G.culture + (good - (reacts.length - good)) * 0.6 - (hovering ? 3 : 0), 0, 100);
  let messyUsed = !!(G.flags.clean > G.week) || Math.random() < 0.5;
  const finish = () => { st.phase = 'idle'; st.cool = 1; UI.sync(); hud(); save(); };
  // one short conversation at each person's bench
  const talkTo = (p, emoji) => () => {
    const ok = ['😊', '👋', '🙂'].includes(emoji);
    const pr = p.project ? S.proj(p.project) : null;
    const c = W.chars.get(p.id); if (c) { c.talk = 2.5; c.mood = ok ? 0.5 : -0.4; }
    const hi = ok ? vary('lap_hi', [`${p.first} looks up and smiles.`, `${p.first} waves you over.`, `"Oh, hey!" ${p.first} pulls off their headphones.`, `${p.first} grins. "Come look at this."`]) : emoji === '😠' ? `${p.first} doesn't look up. "Yes?"` : vary('lap_tense', [`${p.first} straightens up quickly when you appear.`, `${p.first} minimizes a window. "Hi. Everything okay?"`, `${p.first} freezes for a second, then smiles a little too brightly.`]);
    let what;
    if (!pr) what = `They don't have a project right now and are reading papers${S.has(p, 'dreamer') ? ', with a notebook full of doodles' : ''}.`;
    else if (pr.stage === 'results') what = `They're staring at the final plots for "${pr.title.slice(0, 50)}".`;
    else what = vary('lap_do', [`They're working on "${pr.title.slice(0, 50)}" (about ${Math.round(pr.progress)}% done).`, `Their screen shows a half-finished analysis for "${pr.title.slice(0, 50)}".`, `They're in the middle of "${pr.title.slice(0, 50)}". About ${Math.round(pr.progress)}% there.`]);
    const stuck = pr && p.stress > 55, tired = p.stress > 68;
    let extra = '';
    if (tired) extra += ` They look exhausted.`; else if (stuck) extra += ` They've clearly been stuck on something.`;
    const messy = !messyUsed && (S.has(p, 'chaotic') || Math.random() < 0.3); if (messy) { messyUsed = true; extra += ` Their bench is a disaster zone.`; }
    const ch = [];
    if (pr) ch.push({ t: 'Show me what you\'re working on.', hint: `${p.first}'s morale ↑ · their skill may grow`, tone: 'curious', do: () => { mod(p, { morale: 5, loyalty: 2 }); if (Math.random() < 0.25) { const k = S.card(pr.cards[0]).mode === 'exp' ? 'exp' : 'code'; p.skill[k] = Math.min(10, p.skill[k] + 1); } return ok ? `${p.first} walks you through it, talking fast. It's good work. You tell them so.` : `${p.first} explains it carefully, watching your face. You ask one good question and they relax.`; } });
    ch.push({ t: 'What would you most like to be working on?', hint: 'Learn their research interests', tone: 'curious', do: () => { const t = interestText(p); const f = pr ? fitScore(p, pr) : 0; mod(p, { loyalty: 2 }); return `"Honestly? ${t.plats.replace(/^./, m => m.toUpperCase())}${t.goal ? `, especially anything toward ${t.goal.toLowerCase()}` : ''}. I like ${t.style}." ${pr ? (f >= 1 ? 'They gesture at their screen. "Which is why I love this project."' : '"This project is... fine. It\'s just not really my thing."') : '"I\'d love a project like that."'} Someday they want to ${t.dream}. (Shown in the Team app now.)`; } });
    if (tired) ch.push({ t: 'Go home early today. That\'s an order.', hint: `${p.first}'s stress ↓`, tone: 'warm', do: () => { mod(p, { stress: -10, loyalty: 3 }); return `${p.first} argues for about four seconds, then grabs their bag.`; } });
    else if (stuck) ch.push({ t: 'Pull up a stool and help for an hour.', hint: '−6 energy · their stress ↓ · progress ↑', cost: { energy: 6 }, tone: 'warm', do: () => { mod(p, { stress: -10, loyalty: 4 }); if (pr.stage === 'running') pr.progress = Math.min(99, pr.progress + 6); return `It was one sign error. ${p.first} looks ten years younger.`; } });
    if (!pr) ch.push({ t: 'Want to brainstorm something new? Come by my office.', hint: 'They come in for a brainstorm', tone: 'warm', do: () => { queueVisit({ ev: 'brainstorm', A: p.id, pri: 3 }); mod(p, { morale: 4 }); return `"Yes! Give me ten minutes to find a marker that works."`; } });
    if (messy) ch.push({ t: 'Mention the bench. Nicely.', hint: 'Cleaner lab for a while · chaotic people grumble', tone: 'firm', do: () => { G.flags.clean = G.week + 10; for (const q of team()) if (S.has(q, 'chaotic')) mod(q, { morale: -3 }); return 'By the afternoon the bench is visible again.'; } });
    ch.push({ t: 'Keep walking.', hint: 'On to the next bench', do: () => null });
    UI.sync(); hud();
    showDialogue({ who: p, text: `${hi} ${what}${extra}`, choices: ch });
  };
  const stops = [];
  for (const [p, e] of reacts) { if (p.station < 0) continue; const ch = W.chars.get(p.id); const sp = ch && ch.g.position.z < -6 ? ch.g.position : stationOf(p.station); stops.push({ x: sp.x, z: sp.z, onStop: talkTo(p, e) }); }
  if (!stops.length) toast('Nobody is at their bench right now.');
  startLap(finish, stops);
}
$('#hPC').onclick = () => openPC();
$('#hMail').onclick = () => openPC('mail');

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt, now);
  render();
  requestAnimationFrame(frame);
}
function step(dt, now) {
  if (st.mode === 'play' && G) {
    if (st.pendingSync) { st.pendingSync = false; syncAll(); hud(); }
    const paused = G.paused || UI.dialog || UI.computer || G.over || st.phase === 'talking' || st.phase === 'walking' || st.phase === 'lap';
    if (!paused) {
      st.weekT += dt;
      if (st.weekT >= G.speed) {
        st.weekT = 0;
        // monthly mode: four weeks pass per step; random visits are only rolled once, so you aren't swamped
        const n = G.timeStep === 'week' ? 1 : 4;
        for (let i = 0; i < n && !G.over; i++) { G.quietWeek = i < n - 1; tickWeek(); if (!G.over) director(); }
        G.quietWeek = false;
        save(); syncAll(); hud(); if (UI.computer) renderComputer();
      }
    }
    weekBar(st.weekT / G.speed);
    const walkIn = st.phase === 'walking' && st.actors.length;
    $('#paused').style.display = (G.paused || walkIn || st.phase === 'lap') && !UI.dialog && !UI.computer ? 'block' : 'none';
    if (walkIn) { const v = st.visit, A = person(v.A), B = person(v.B); $('#paused').textContent = (A && B ? `${A.first} and ${B.first} are` : `${visitorName(v)} is`) + ' coming to see you · click to skip'; }
    else if (st.phase === 'lap') $('#paused').textContent = '🚶 Walking around the lab · click to skip';
    else $('#paused').textContent = 'PAUSED';
    st.cool -= dt;
    const awayW = G.life && G.life.away > 0;
    $('#awayBanner').style.display = awayW ? 'block' : 'none';
    const foot = G.life && G.life.footUntil > G.week;
    $('#awayBanner').style.display = awayW || (foot && !UI.dialog && !UI.computer) ? 'block' : 'none';
    if (awayW) $('#awayBanner').textContent = `🏖️ You're away for ${G.life.away} more week${G.life.away > 1 ? 's' : ''}. The lab runs without you. ${G.queue.length} people are waiting.`;
    else if (foot) $('#awayBanner').textContent = `🦶 On crutches for ${G.life.footUntil - G.week} more week${G.life.footUntil - G.week > 1 ? 's' : ''}: no social or athletic events.`;
    if (!awayW && st.phase === 'idle' && st.cool <= 0 && !UI.computer && !G.over && G.queue.length) {
      const i = G.dnd ? G.queue.findIndex(v => (v.pri || 0) >= 5) : 0;
      if (i >= 0) { const v = G.queue.splice(i, 1)[0]; if (!startVisit(v)) st.cool = 0.3; hud(); }
    }
    labLife(dt);
    hover(dt);
    st.monT -= dt;
    if (st.monT < 0) { st.monT = 0.5; drawMonitor(W.monCanvas.getContext('2d'), W.monCanvas.width, W.monCanvas.height, now / 1000); W.monTex.needsUpdate = true; }
  }
  updateWorld(dt);
}

// ---------- title / game over ----------
function showTitle() {
  st.mode = 'title';
  const saved = loadSave();
  $('#title').classList.add('show');
  $('#fields').innerHTML = Object.entries(FIELDS).map(([k, f], i) => `<label class="field"><input type="radio" name="field" value="${k}" ${i === 0 ? 'checked' : ''}><div><b>${f.name}</b><span>${f.desc}</span></div></label>`).join('');
  $('#homes').innerHTML = Object.entries(HOME).map(([k, h], i) => `<label class="field"><input type="radio" name="home" value="${k}" ${k === 'partner' ? 'checked' : ''}><div><b>${h.name}</b><span>${h.desc}</span></div></label>`).join('');
  $('#tHobby').innerHTML = Object.entries(HOBBIES).map(([k, h]) => `<option value="${k}">${h.icon} ${h.name}</option>`).join('');
  const ok = saved && !saved.over && saved.life;
  $('#tContinue').style.display = ok ? '' : 'none';
  if (ok) $('#tContinue').textContent = `Continue: ${saved.pi}, year ${Math.floor((saved.week - 1) / 48) + 1}`;
  $('#tStart').onclick = () => {
    const name = $('#tName').value.trim() || 'Prof. Quark';
    const lab = $('#tLab').value.trim() || 'Quark Lab';
    const field = document.querySelector('input[name=field]:checked').value;
    const home = document.querySelector('input[name=home]:checked').value;
    newGame({ name: name.startsWith('Prof') || name.startsWith('Dr') ? name : 'Prof. ' + name, labName: lab, field, home, hobby: $('#tHobby').value });
    G.speed = +$('#tSpeed').value;
    begin();
    G.queue.unshift({ ev: 'checkin', A: G.people[0].id, pri: 3, id: 'v0', week: 1 });
  };
  $('#tContinue').onclick = () => { load(saved); begin(); };
}
function begin() {
  $('#title').classList.remove('show');
  $('#hud').classList.add('show');
  st.mode = 'play'; st.cool = 2.5; lookHome();
  for (const k of [...W.chars.keys()]) removeChar(k);
  syncAll(); hud();
  toast(`Welcome to ${G.labName}. Drag to look around. Click the monitor to use your computer.`);
}
function showGameOver(reason) {
  const msg = { burnout: ['You burned out.', 'One morning you simply cannot make yourself go in. You take a long leave, then a different job. You are happier. Your old students send you postcards.'], broke: ['The money ran out.', 'The university froze your accounts. Your students were reassigned to other groups. You now teach Physics 1 full-time, and honestly the pre-meds love you.'], fired: ['You were fired.', 'The college did not renew your appointment. Your students were placed with other groups, and most of them land on their feet. You start over somewhere smaller, a little wiser about what you say and who you say it to.'], tenure: ['Tenure denied.', 'The committee was not convinced. You pack your office, take the framed papers off the wall, and accept a job at a quantum startup that pays three times as much. You miss the students.'] }[reason] || ['Game over.', ''];
  $('#goT').textContent = msg[0]; $('#goB').textContent = msg[1];
  $('#goStats').innerHTML = `Years: ${Math.ceil(G.week / 48)} · Papers: ${G.papers.length} · Grants won: ${G.grantsWon} · Alumni: ${G.alumni.length} · Reputation: ${Math.round(G.rep)}`;
  $('#gameover').classList.add('show');
  clearSave();
  $('#goNew').onclick = () => location.reload();
}
function showWin() {
  $('#goT').textContent = '🏅 The Nobel Prize in Physics';
  $('#goB').textContent = `Your lab bursts through the door with champagne and the cat. ${G.labName} will be in the textbooks. You can keep running the lab as long as you like.`;
  $('#goStats').innerHTML = `Years: ${Math.ceil(G.week / 48)} · Papers: ${G.papers.length} · Landmarks: ${G.landmarks} · Alumni: ${G.alumni.length}`;
  $('#goNew').textContent = 'Keep going';
  $('#gameover').classList.add('show', 'win');
  $('#goNew').onclick = () => $('#gameover').classList.remove('show');
}

// ---------- boot ----------
initWorld(canvas);
W.tYaw = 0.35; // a little turned toward the door on the title screen
requestAnimationFrame(frame);
document.fonts && document.fonts.ready.then(() => { if (G) syncAll(); });
showTitle();

// test hook for automated playtests
if (location.search.includes('test')) window.__OH = { S, st, W, UI, director, startVisit, act, run: (sec) => { for (let t = 0; t < sec; t += 0.05) step(0.05, performance.now()); render(); } };
