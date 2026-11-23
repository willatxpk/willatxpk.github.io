// Touch controls for phones and tablets, kept deliberately small:
//   · left side: a joystick under your thumb (push far to run). Tap = crouch, double-tap = dodge.
//   · the screen itself does all the interacting: tap = strike / talk / open / place, hold = dig / break / draw,
//     drag = look, a second finger = the right mouse button (guard with a shield, cast with the Sigil).
//   · a few buttons: jump, weapon swap, quick item (tap to use, swipe to change), attack/build mode, lamp, glow sight.
//   · a bar at the top: pack, map, quests, skills, menu (saving and settings), full screen.
// Everything goes through the same keys and functions the desktop game uses, so both play the same.
const CSS = `
#touchUI { position:fixed; inset:0; z-index:8; pointer-events:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; font-family:'Cinzel', serif; }
#touchUI.off { display:none; }
#touchUI .zone { position:absolute; top:0; bottom:0; pointer-events:auto; touch-action:none; }
#tzMove { left:0; width:42%; }
#tzLook { left:42%; right:0; }
#tJoy { position:absolute; width:128px; height:128px; margin:-64px 0 0 -64px; border-radius:50%; border:2px solid rgba(230,210,170,.35); background:rgba(20,16,12,.25); display:none; pointer-events:none; }
#tJoy.run { border-color:rgba(255,190,110,.85); box-shadow:0 0 18px rgba(255,160,80,.35); }
#tKnob { position:absolute; left:50%; top:50%; width:56px; height:56px; margin:-28px 0 0 -28px; border-radius:50%; background:rgba(230,210,170,.45); }
#tJoyHint { position:absolute; left:calc(14px + env(safe-area-inset-left)); bottom:calc(12px + env(safe-area-inset-bottom)); color:rgba(230,210,170,.5); font-size:11px; pointer-events:none; line-height:1.5; }
#tJoyHint b { color:#f0c878; font-weight:normal; }
.tb { position:absolute; pointer-events:auto; touch-action:none; border-radius:50%; border:2px solid rgba(230,210,170,.4); background:rgba(14,11,8,.55); color:#e8dcc4;
  display:flex; align-items:center; justify-content:center; flex-direction:column; font-size:22px; line-height:1; text-shadow:0 1px 2px #000; }
.tb small { font-size:9px; margin-top:3px; letter-spacing:.04em; opacity:.85; white-space:nowrap; }
.tb .ic img { width:26px; height:26px; image-rendering:pixelated; }
.tb .cnt { position:absolute; right:6px; bottom:4px; font-size:11px; color:#f0e0c0; }
.tb.down { background:rgba(120,90,50,.7); border-color:rgba(255,220,160,.8); }
.tb.on { border-color:#d6a84a; box-shadow:0 0 10px rgba(214,168,74,.55); }
.tb.big { width:84px; height:84px; font-size:30px; }
.tb.mid { width:64px; height:64px; }
.tb.sm { width:46px; height:46px; font-size:19px; }
#tTop { position:absolute; top:calc(6px + env(safe-area-inset-top)); right:calc(8px + env(safe-area-inset-right)); display:flex; gap:6px; pointer-events:none; }
#tTop .tb { position:relative; width:52px; height:42px; border-radius:9px; font-size:17px; }
#tTop .tb small { font-size:8px; margin-top:2px; }
#tSkills { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:none; pointer-events:auto; padding:12px; background:rgba(16,12,8,.94); border:1px solid #6a5534; border-radius:10px; width:min(420px, 92vw); }
#tSkills h4 { margin:0 0 8px; font-size:14px; color:#f0c878; font-weight:normal; text-align:center; }
#tSkills .g { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
#tSkills .sk { padding:10px 4px; text-align:center; border:1px solid #5a4a32; border-radius:8px; background:rgba(40,30,18,.9); color:#e8dcc4; font-size:12px; }
#tSkills .sk span { display:block; font-size:22px; margin-bottom:4px; }
#tSkills .sk.off { opacity:.4; }
#tSkills .x { margin-top:10px; text-align:center; font-size:12px; color:#cdbf9f; }
#tRotate { position:fixed; inset:0; z-index:30; display:none; align-items:center; justify-content:center; flex-direction:column; gap:12px; background:#0b0907; color:#e8dcc4; font-size:20px; text-align:center; padding:24px; pointer-events:auto; }
#tRotate div { font-size:56px; }
#tFullHelp { position:fixed; inset:0; z-index:31; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.8); pointer-events:auto; }
#tFullHelp .box { max-width:420px; margin:16px; padding:18px 20px; background:#15110c; border:1px solid #6a5534; border-radius:8px; color:#e8dcc4; font:15px/1.45 serif; }
#tFullHelp b { color:#f0c878; } #tFullHelp .ok { margin-top:12px; text-align:right; } #tFullHelp button { font:inherit; padding:6px 16px; background:#3a2c18; color:#e8dcc4; border:1px solid #8a6a3a; border-radius:4px; }
`;

export function initTouch({ canvas, getState, lookBy, joy, tap: screenTap, press, hud, act }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'touchUI';
  const R = 'calc(%spx + env(safe-area-inset-right))', B = 'calc(%spx + env(safe-area-inset-bottom))';
  const pos = (r, b) => `right:${R.replace('%s', r)};bottom:${B.replace('%s', b)}`;
  const top = (r, t) => `right:${R.replace('%s', r)};top:calc(${t}px + env(safe-area-inset-top))`;
  ui.innerHTML = `
    <div class="zone" id="tzMove"></div><div class="zone" id="tzLook"></div>
    <div id="tJoy"><div id="tKnob"></div></div>
    <div id="tJoyHint">move · push far to run<br>tap = <b id="tCrouchTxt">crouch</b> · double-tap = dodge</div>
    <div class="tb big" id="tJump" style="${pos(18, 22)}">⤒<small>JUMP</small></div>
    <div class="tb mid" id="tItem" style="${pos(114, 14)}"><span class="ic"></span><span class="cnt"></span><small>ITEM ⇆</small></div>
    <div class="tb mid" id="tWeapon" style="${pos(28, 120)}"><span class="ic"></span><small>SWAP</small></div>
    <div class="tb mid" id="tMode" style="${pos(118, 96)}">⚔<small>ATTACK</small></div>
    <div class="tb sm" id="tLamp" style="${top(12, 60)}">🏮</div>
    <div class="tb sm" id="tGlow" style="${top(66, 60)}">👁</div>
    <div id="tTop">
      <div class="tb" data-key="KeyE">🎒<small>PACK</small></div>
      <div class="tb" data-key="KeyM">🗺<small>MAP</small></div>
      <div class="tb" data-key="KeyJ">📜<small>QUESTS</small></div>
      <div class="tb" id="tSkillBtn">✦<small>SKILLS</small></div>
      <div class="tb" data-key="Escape">☰<small>SAVE</small></div>
      <div class="tb" id="tFull">⛶<small>FULL</small></div>
    </div>
    <div id="tSkills"><h4>Skills and actions</h4><div class="g" id="tSkillGrid"></div><div class="x">tap outside to close</div></div>`;
  document.body.appendChild(ui);
  const rot = document.createElement('div'); rot.id = 'tRotate'; rot.innerHTML = '<div>⟲</div>Turn your phone sideways to play.';
  document.body.appendChild(rot);
  const $ = id => ui.querySelector('#' + id);

  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }));
  const tap = code => { key(code, true); key(code, false); };
  const mouse = (button, down) => (down ? canvas : window).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));

  // ---- the joystick, under the left thumb. A still tap crouches, a quick double-tap dodges.
  const J = $('tJoy'), K = $('tKnob'), RAD = 56;
  let jt = null, jx = 0, jy = 0, jMoved = false, jAt = 0, lastTapAt = 0, crouchTimer = null;
  const moveZone = $('tzMove');
  moveZone.addEventListener('touchstart', e => {
    e.preventDefault(); if (jt != null) return;
    const t = e.changedTouches[0]; jt = t.identifier; jx = t.clientX; jy = t.clientY; jMoved = false; jAt = performance.now();
    J.style.left = jx + 'px'; J.style.top = jy + 'px'; J.style.display = 'block';
  }, { passive: false });
  const joyMove = e => {
    for (const t of e.changedTouches) if (t.identifier === jt) {
      e.preventDefault();
      let dx = t.clientX - jx, dy = t.clientY - jy; const d = Math.hypot(dx, dy);
      if (d > 10) jMoved = true;
      if (d > RAD) { dx *= RAD / d; dy *= RAD / d; }
      K.style.transform = `translate(${dx}px,${dy}px)`;
      joy.s = dx / RAD; joy.f = -dy / RAD;
      if (Math.hypot(joy.s, joy.f) < 0.18) { joy.s = 0; joy.f = 0; }
      joy.run = d > RAD * 1.15 && joy.f > 0.55; J.classList.toggle('run', joy.run);
    }
  };
  const joyEnd = e => {
    for (const t of e.changedTouches) if (t.identifier === jt) {
      jt = null; joy.f = joy.s = 0; joy.run = false; J.style.display = 'none'; K.style.transform = ''; J.classList.remove('run');
      const now = performance.now();
      if (!jMoved && now - jAt < 300 && e.type === 'touchend') {
        if (now - lastTapAt < 320) { clearTimeout(crouchTimer); lastTapAt = 0; act.dodge(); }
        else { lastTapAt = now; clearTimeout(crouchTimer); crouchTimer = setTimeout(() => { lastTapAt = 0; act.crouch(); }, 320); }
      }
    }
  };
  moveZone.addEventListener('touchmove', joyMove, { passive: false });
  moveZone.addEventListener('touchend', joyEnd); moveZone.addEventListener('touchcancel', joyEnd);

  // ---- the screen: tap acts, a still hold digs / breaks / draws, a drag looks, a second finger is the right mouse button
  const lookZone = $('tzLook'), last = new Map();
  const HOLD_MS = 260, SLOP = 12;
  let first = null, second = null;
  lookZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      last.set(t.identifier, [t.clientX, t.clientY]);
      if (!first) {
        const a = first = { id: t.identifier, x: t.clientX, y: t.clientY, moved: false, held: false };
        a.timer = setTimeout(() => { if (first === a && !a.moved && !second) { a.held = true; press(true); } }, HOLD_MS);
      } else if (!second) {
        // two fingers: the first one is no longer a tap; this one works like the right mouse button
        if (!first.held) { first.moved = true; clearTimeout(first.timer); }
        second = t.identifier; mouse(2, true);
      }
    }
  }, { passive: false });
  lookZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = last.get(t.identifier); if (!p) continue;
      if (first && first.id === t.identifier && !first.held && Math.hypot(t.clientX - first.x, t.clientY - first.y) > SLOP) first.moved = true;
      if (first && first.id === t.identifier && !first.moved && !first.held) continue; // small wobbles while tapping don't turn the view
      if (t.identifier === second) continue;
      lookBy(t.clientX - p[0], t.clientY - p[1]); last.set(t.identifier, [t.clientX, t.clientY]);
    }
  }, { passive: false });
  const lookEnd = e => {
    for (const t of e.changedTouches) {
      last.delete(t.identifier);
      if (t.identifier === second) { second = null; mouse(2, false); }
      if (first && first.id === t.identifier) {
        clearTimeout(first.timer);
        if (first.held) press(false); else if (!first.moved && e.type === 'touchend') screenTap();
        first = null;
      }
    }
  };
  lookZone.addEventListener('touchend', lookEnd); lookZone.addEventListener('touchcancel', lookEnd);

  // ---- buttons
  const button = (el, down, up) => {
    let id = null;
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (id != null) return; const t = e.changedTouches[0]; id = t.identifier; el.classList.add('down'); down?.(t); }, { passive: false });
    el.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; el.classList.remove('down'); up?.(t, e.type === 'touchend'); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  };
  button($('tJump'), () => key('Space', true), () => key('Space', false));
  button($('tWeapon'), () => tap('KeyV'));
  button($('tMode'), () => tap('KeyB'));
  button($('tLamp'), () => tap('KeyF'));
  button($('tGlow'), () => tap('KeyG'));
  // the quick item: tap to use it, swipe sideways (or up/down) to pick another
  let ix = 0, iy = 0;
  button($('tItem'), t => { ix = t.clientX; iy = t.clientY; }, (t, ok) => {
    if (!ok) return;
    const dx = t.clientX - ix, dy = t.clientY - iy;
    if (Math.hypot(dx, dy) > 24) act.cycleBelt((Math.abs(dx) > Math.abs(dy) ? dx : -dy) > 0 ? 1 : -1);
    else act.useBelt();
  });
  for (const el of $('tTop').querySelectorAll('[data-key]')) button(el, () => tap(el.dataset.key));

  // ---- skills: everything that doesn't need a button of its own
  const sheet = $('tSkills'), grid = $('tSkillGrid');
  const openSkills = () => {
    const h = hud();
    const items = [
      [h.abilityIcon, h.abilityName, 'KeyR', true],
      ['🕯', 'Turn Undead', 'KeyT', h.cleric],
      ['🜂', 'Next spell', 'KeyZ', h.magic],
      ['🛡', 'Change left hand', 'Tab', h.offhands > 1],
      ['✦', 'Rite of Return', 'KeyH', h.magic],
      ['⇩', h.crouch ? 'Stand up' : 'Crouch', 'crouch', true],
      ['↯', 'Dodge', 'KeyC', true],
    ].filter(x => x[3]);
    grid.innerHTML = items.map(([ic, name, k]) => `<div class="sk" data-k="${k}"><span>${ic}</span>${name}</div>`).join('');
    sheet.style.display = 'block';
  };
  button($('tSkillBtn'), () => { if (sheet.style.display === 'block') sheet.style.display = 'none'; else openSkills(); });
  sheet.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  sheet.addEventListener('touchend', e => {
    e.preventDefault(); e.stopPropagation();
    const s = e.target.closest('.sk'); sheet.style.display = 'none';
    if (!s) return;
    if (s.dataset.k === 'crouch') act.crouch(); else tap(s.dataset.k);
  });
  // a tap anywhere else closes it without acting
  ui.addEventListener('touchstart', e => { if (sheet.style.display === 'block' && !sheet.contains(e.target) && e.target.id !== 'tSkillBtn' && !e.target.closest('#tSkillBtn')) { sheet.style.display = 'none'; e.stopPropagation(); e.preventDefault(); } }, { capture: true, passive: false });

  // ---- full screen. Browsers that allow it (Android, iPad) go full screen; Safari on iPhone only does it for pages
  // opened from the Home Screen, so there the button says how.
  const standalone = () => navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const root = document.documentElement;
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const help = document.createElement('div'); help.id = 'tFullHelp';
  help.innerHTML = `<div class="box"><b>Full screen on iPhone</b><br>Safari only hides its address bar for games opened from your Home Screen:<br><br>1. Tap the <b>Share</b> button (the square with the arrow) in Safari.<br>2. Choose <b>Add to Home Screen</b>, then <b>Add</b>.<br>3. Open Gloamreach from the new icon. It fills the whole screen.<br><br><span style="opacity:.75">Your saves stay in Safari, so the first time from the icon you start fresh.</span><div class="ok"><button>Got it</button></div></div>`;
  document.body.appendChild(help);
  help.querySelector('button').addEventListener('click', () => { help.style.display = 'none'; });
  const full = $('tFull');
  if (standalone()) full.style.display = 'none';
  button(full, null, (t, ok) => {
    if (!ok) return;
    if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (canFull) {
      const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => { help.style.display = 'flex'; });
      try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (err) { /* not allowed here */ }
    } else help.style.display = 'flex';
  });

  // ---- keep the buttons showing what you actually have
  const seen = {};
  const put = (k, el, html) => { if (seen[k] !== html) { seen[k] = html; el.innerHTML = html; } };
  const cls = (el, c, on) => el.classList.toggle(c, !!on);
  let shown = null;
  (function tick() {
    const s = getState(), on = s.state === 'play' && s.ui === 'none';
    if (on !== shown) {
      shown = on; ui.classList.toggle('off', !on);
      if (!on) {
        if (first) { clearTimeout(first.timer); if (first.held) press(false); first = null; }
        if (second != null) { second = null; mouse(2, false); }
        jt = null; joy.f = joy.s = 0; joy.run = false; J.style.display = 'none'; last.clear(); key('Space', false); sheet.style.display = 'none';
        for (const b of ui.querySelectorAll('.down')) b.classList.remove('down');
      }
    }
    if (on) {
      const h = hud();
      put('w', $('tWeapon').querySelector('.ic'), h.weapon);
      put('i', $('tItem').querySelector('.ic'), h.item || '—');
      put('ic', $('tItem').querySelector('.cnt'), h.itemCount ? String(h.itemCount) : '');
      put('m', $('tMode'), h.build ? '⚒<small>BUILD</small>' : '⚔<small>ATTACK</small>');
      cls($('tMode'), 'on', h.build);
      cls($('tLamp'), 'on', h.lamp);
      cls($('tGlow'), 'on', h.glow);
      put('c', $('tCrouchTxt'), h.crouch ? 'stand' : 'crouch');
    }
    const portrait = s.state === 'play' && innerHeight > innerWidth * 1.1;
    if (portrait !== rot._on) { rot._on = portrait; rot.style.display = portrait ? 'flex' : 'none'; }
    requestAnimationFrame(tick);
  })();
}
