// Touch controls for phones and tablets: a joystick under the left thumb, drag anywhere on the right to look,
// and buttons for everything the keyboard and mouse do. Buttons send the same key and mouse events the desktop
// game already listens for, so every action behaves exactly as it does there.
const CSS = `
#touchUI { position:fixed; inset:0; z-index:8; pointer-events:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; touch-action:none; font-family:'Cinzel', serif; }
#touchUI.off { display:none; }
#touchUI .zone { position:absolute; top:0; bottom:0; pointer-events:auto; touch-action:none; }
#tzMove { left:0; width:42%; }
#tzLook { left:42%; right:0; }
#tJoy { position:absolute; width:128px; height:128px; margin:-64px 0 0 -64px; border-radius:50%; border:2px solid rgba(230,210,170,.35); background:rgba(20,16,12,.25); display:none; pointer-events:none; }
#tJoy.run { border-color:rgba(255,190,110,.85); box-shadow:0 0 18px rgba(255,160,80,.35); }
#tKnob { position:absolute; left:50%; top:50%; width:56px; height:56px; margin:-28px 0 0 -28px; border-radius:50%; background:rgba(230,210,170,.45); }
#tJoyHint { position:absolute; left:calc(14px + env(safe-area-inset-left)); bottom:calc(16px + env(safe-area-inset-bottom)); color:rgba(230,210,170,.45); font-size:11px; pointer-events:none; }
.tb { position:absolute; pointer-events:auto; touch-action:none; border-radius:50%; border:2px solid rgba(230,210,170,.4); background:rgba(14,11,8,.55); color:#e8dcc4;
  display:flex; align-items:center; justify-content:center; flex-direction:column; font-size:20px; line-height:1; text-shadow:0 1px 2px #000; }
.tb small { font-size:9px; margin-top:3px; letter-spacing:.04em; opacity:.85; }
.tb.down { background:rgba(120,90,50,.7); border-color:rgba(255,220,160,.8); }
.tb.on { border-color:#d6a84a; box-shadow:0 0 10px rgba(214,168,74,.5); }
.tb.big { width:84px; height:84px; font-size:30px; }
.tb.mid { width:62px; height:62px; }
.tb.sm { width:46px; height:46px; font-size:17px; }
#tTop { position:absolute; top:calc(8px + env(safe-area-inset-top)); right:calc(10px + env(safe-area-inset-right)); display:flex; gap:8px; pointer-events:none; }
#tRotate { position:fixed; inset:0; z-index:30; display:none; align-items:center; justify-content:center; flex-direction:column; gap:12px; background:#0b0907; color:#e8dcc4; font-size:20px; text-align:center; padding:24px; pointer-events:auto; }
#tRotate div { font-size:56px; }
#tTop .tb { position:relative; width:44px; height:44px; border-radius:10px; font-size:18px; }
`;

export function initTouch({ canvas, getState, lookBy, joy, crouched }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'touchUI';
  const R = 'calc(%spx + env(safe-area-inset-right))', B = 'calc(%spx + env(safe-area-inset-bottom))';
  const pos = (r, b) => `right:${R.replace('%s', r)};bottom:${B.replace('%s', b)}`;
  ui.innerHTML = `
    <div class="zone" id="tzMove"></div><div class="zone" id="tzLook"></div>
    <div id="tJoy"><div id="tKnob"></div></div>
    <div id="tJoyHint">move · push far to run</div>
    <div class="tb big" id="tAtk" style="${pos(20, 26)}">⚔<small>ATTACK</small></div>
    <div class="tb mid" id="tUse" style="${pos(118, 18)}">✋<small>USE·GUARD</small></div>
    <div class="tb mid" id="tJump" style="${pos(34, 124)}">⤒<small>JUMP</small></div>
    <div class="tb mid" id="tDodge" style="${pos(112, 96)}">↯<small>DODGE</small></div>
    <div class="tb mid" id="tCrouch" style="${pos(190, 30)}">⇩<small>CROUCH</small></div>
    <div class="tb sm" data-key="KeyQ" style="${pos(186, 108)}">🧪<small>BELT</small></div>
    <div class="tb sm" data-key="KeyX" style="${pos(240, 92)}">⟳<small>NEXT</small></div>
    <div class="tb sm" data-key="KeyV" style="${pos(108, 172)}">⇄<small>WEAPON</small></div>
    <div class="tb sm" data-key="KeyF" style="${pos(160, 160)}">🏮<small>LAMP</small></div>
    <div class="tb sm" data-key="KeyH" style="${pos(260, 26)}">✦<small>RITE</small></div>
    <div id="tTop">
      <div class="tb" data-key="KeyR" title="Class ability">⚡</div>
      <div class="tb" data-key="KeyZ" title="Next spell">✧</div>
      <div class="tb" data-key="Tab" title="Shield / Sigil">🛡</div>
      <div class="tb" data-key="KeyJ" title="Journal">📜</div>
      <div class="tb" data-key="KeyM" title="Map">🗺</div>
      <div class="tb" data-key="KeyE" title="Pack">🎒</div>
      <div class="tb" data-key="Escape" title="Pause">☰</div>
    </div>`;
  document.body.appendChild(ui);
  const rot = document.createElement('div'); rot.id = 'tRotate'; rot.innerHTML = '<div>⟲</div>Turn your phone sideways to play.';
  document.body.appendChild(rot);
  const $ = id => ui.querySelector('#' + id);

  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }));
  const tap = code => { key(code, true); key(code, false); };
  const mouse = (button, down) => (down ? canvas : window).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));

  // ---- the joystick: appears wherever the left thumb lands
  const J = $('tJoy'), K = $('tKnob'), RAD = 56;
  let jt = null, jx = 0, jy = 0;
  const moveZone = $('tzMove');
  moveZone.addEventListener('touchstart', e => {
    e.preventDefault(); if (jt != null) return;
    const t = e.changedTouches[0]; jt = t.identifier; jx = t.clientX; jy = t.clientY;
    J.style.left = jx + 'px'; J.style.top = jy + 'px'; J.style.display = 'block'; $('tJoyHint').style.display = 'none';
  }, { passive: false });
  const joyMove = e => {
    for (const t of e.changedTouches) if (t.identifier === jt) {
      e.preventDefault();
      let dx = t.clientX - jx, dy = t.clientY - jy; const d = Math.hypot(dx, dy);
      if (d > RAD) { dx *= RAD / d; dy *= RAD / d; }
      K.style.transform = `translate(${dx}px,${dy}px)`;
      joy.s = dx / RAD; joy.f = -dy / RAD;
      if (Math.hypot(joy.s, joy.f) < 0.18) { joy.s = 0; joy.f = 0; }
      joy.run = d > RAD * 1.15 && joy.f > 0.55; J.classList.toggle('run', joy.run);
    }
  };
  const joyEnd = e => {
    for (const t of e.changedTouches) if (t.identifier === jt) { jt = null; joy.f = joy.s = 0; joy.run = false; J.style.display = 'none'; K.style.transform = ''; J.classList.remove('run'); }
  };
  moveZone.addEventListener('touchmove', joyMove, { passive: false });
  moveZone.addEventListener('touchend', joyEnd); moveZone.addEventListener('touchcancel', joyEnd);

  // ---- look: drag on the right half (several fingers can rest there; each one steers while it moves)
  const lookZone = $('tzLook'), last = new Map();
  lookZone.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) last.set(t.identifier, [t.clientX, t.clientY]); }, { passive: false });
  lookZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = last.get(t.identifier); if (!p) continue;
      lookBy(t.clientX - p[0], t.clientY - p[1]); last.set(t.identifier, [t.clientX, t.clientY]);
    }
  }, { passive: false });
  const lookEnd = e => { for (const t of e.changedTouches) last.delete(t.identifier); };
  lookZone.addEventListener('touchend', lookEnd); lookZone.addEventListener('touchcancel', lookEnd);

  // ---- buttons. Attack and guard are held; a finger on a button can also slide to look around
  const hold = (el, down, up) => {
    let id = null, lx = 0, ly = 0;
    el.addEventListener('touchstart', e => { e.preventDefault(); if (id != null) return; const t = e.changedTouches[0]; id = t.identifier; lx = t.clientX; ly = t.clientY; el.classList.add('down'); down(); }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) { lookBy(t.clientX - lx, t.clientY - ly); lx = t.clientX; ly = t.clientY; } }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; el.classList.remove('down'); up?.(); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  };
  hold($('tAtk'), () => mouse(0, true), () => mouse(0, false));
  hold($('tUse'), () => mouse(2, true), () => mouse(2, false));
  hold($('tJump'), () => key('Space', true), () => key('Space', false));
  hold($('tDodge'), () => tap('KeyC'));
  hold($('tCrouch'), () => key('ControlLeft', true), () => key('ControlLeft', false));
  for (const el of ui.querySelectorAll('[data-key]')) hold(el, () => tap(el.dataset.key));

  // only while you are actually walking about; menus, maps and talk use plain taps
  let shown = null;
  (function tick() {
    const s = getState(), on = s.state === 'play' && s.ui === 'none';
    if (on !== shown) {
      shown = on; ui.classList.toggle('off', !on);
      if (!on) { jt = null; joy.f = joy.s = 0; joy.run = false; J.style.display = 'none'; last.clear(); mouse(0, false); mouse(2, false); key('Space', false); for (const b of ui.querySelectorAll('.down')) b.classList.remove('down'); }
    }
    if (on) $('tCrouch').classList.toggle('on', crouched());
    const portrait = s.state === 'play' && innerHeight > innerWidth * 1.1;
    if (portrait !== rot._on) { rot._on = portrait; rot.style.display = portrait ? 'flex' : 'none'; }
    requestAnimationFrame(tick);
  })();
}
