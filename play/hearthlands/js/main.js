// ===== Main loop =====
let _last = performance.now(), _uiTimer = 0, _lastFrame = 0;
function frame(now) {
  _lastFrame = performance.now();
  const dt = Math.min(0.1, (now - _last) / 1000); _last = now;
  if (window.GAME_RUNNING && G) {
    panKeys(dt);
    const blocked = (UI.eventShowing && G.settings.pauseOnEvent) || UI.battle;
    if (G.speed > 0 && !blocked) {
      let hours = dt * G.speed * 24 / G.settings.dayLength;
      while (hours > 0 && !UI.battle) { const h = Math.min(0.2, hours); stepSim(h); hours -= h; }
    }
    showNextEvent();
    render(dt);
    _uiTimer -= dt;
    if (_uiTimer <= 0) {
      _uiTimer = 0.25;
      // each panel refreshes independently so one failing panel can never freeze the others
      const safe = f => { try { f(); } catch (e) { console.error(e); } };
      safe(updateTop); safe(renderInspector);
      if (UI.win && !['trade', 'menu', 'help'].includes(UI.win)) safe(() => renderWin(false));
      if (UI.tipEl && document.body.contains(UI.tipEl)) safe(() => UI.tipEl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: UI.tipX || 0, clientY: UI.tipY || 0 })));
      if (UI.tool.kind === 'build') { const cards = document.querySelectorAll('#buildmenu .card[data-arg]'); cards.forEach(c => { const d = B[c.dataset.arg]; if (d) c.classList.toggle('poor', !c.classList.contains('locked') && !canAfford(d.cost || {})); }); }
    }
  }
  requestAnimationFrame(frame);
}
// Fallback ticker: some embedded browsers never fire requestAnimationFrame,
// which would freeze the game. If no frame ran recently, drive it ourselves.
setInterval(() => { if (performance.now() - _lastFrame > 120) frameTick(performance.now()); }, 50);
function frameTick(now) { const raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; try { frame(now); } finally { window.requestAnimationFrame = raf; } }
window.addEventListener('load', () => {
  initRender(); buildUI(); bindUI(); bindMap();
  window.addEventListener('beforeunload', () => { if (window.GAME_RUNNING && G) saveGame(true); });
  showStart();
  requestAnimationFrame(frame);
});
