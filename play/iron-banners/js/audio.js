// Iron Banners — procedural sound: drums, horns, clashes, volleys and cannon, synthesized with WebAudio (no files).
'use strict';

const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null, drumTimer = 0;
  let muted = false; try { muted = localStorage.getItem('ib_mute') === '1'; } catch (e) { /* ignore */ }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { ac = null; return false; }
  }
  // browsers only allow sound after a user gesture
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => init(), { once: false, passive: true }));

  const T = () => ac.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function noise(t, dur, { type = 'lowpass', freq = 800, q = 0.7, peak = 0.5, attack = 0.005, sweep = null } = {}) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ac.createGain(); env(g, t, attack, peak, dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.1);
  }
  function tone(t, freq, dur, { type = 'sine', peak = 0.4, attack = 0.005, to = null, vib = 0 } = {}) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    const g = ac.createGain(); env(g, t, attack, peak, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  const ok = () => !muted && init() && ac;

  const S = {
    drum(t0 = 0, vol = 1) { if (!ok()) return; const t = T() + t0; tone(t, 110, 0.35, { to: 45, peak: 0.55 * vol }); noise(t, 0.12, { freq: 900, peak: 0.12 * vol }); },
    horn(chord = [196, 247, 294]) { if (!ok()) return; const t = T(); chord.forEach((f, i) => { tone(t + i * 0.05, f, 1.6, { type: 'sawtooth', peak: 0.07, attack: 0.12, vib: 3 }); tone(t + i * 0.05, f * 2, 1.4, { type: 'triangle', peak: 0.03, attack: 0.15 }); }); },
    fanfare() { if (!ok()) return; const t = T(); [[262, 0], [330, 0.18], [392, 0.36], [523, 0.6]].forEach(([f, d]) => tone(t + d, f, d === 0.6 ? 1.2 : 0.22, { type: 'sawtooth', peak: 0.08, attack: 0.02, vib: d === 0.6 ? 4 : 0 })); this.drum(0, 0.8); this.drum(0.6, 1); },
    dirge() { if (!ok()) return; const t = T(); [[220, 0], [196, 0.5], [175, 1.0]].forEach(([f, d]) => tone(t + d, f, 0.9, { type: 'triangle', peak: 0.12, attack: 0.08 })); this.drum(0, 0.6); this.drum(1.0, 0.6); },
    clash(n = 6, spread = 0.9) { if (!ok()) return; const t = T(); for (let i = 0; i < n; i++) { const d = Math.random() * spread; noise(t + d, 0.09, { type: 'bandpass', freq: 2500 + Math.random() * 2500, q: 3, peak: 0.25 }); if (Math.random() < 0.5) tone(t + d, 1800 + Math.random() * 1600, 0.18, { type: 'square', peak: 0.025 }); } noise(t, spread + 0.4, { freq: 500, peak: 0.12, attack: 0.1 }); },
    hooves() { if (!ok()) return; const t = T(); for (let i = 0; i < 14; i++) { const d = i * 0.07 + Math.random() * 0.03; tone(t + d, 90 + Math.random() * 30, 0.07, { to: 50, peak: 0.25 }); } },
    arrows(n = 5) { if (!ok()) return; const t = T(); for (let i = 0; i < n; i++) noise(t + Math.random() * 0.5, 0.35, { type: 'bandpass', freq: 3000, sweep: 900, q: 4, peak: 0.12, attack: 0.05 }); },
    volley(n = 10) { if (!ok()) return; const t = T(); for (let i = 0; i < n; i++) noise(t + Math.random() * 0.7, 0.18, { freq: 1600, peak: 0.35, attack: 0.002 }); },
    cannon(n = 2) { if (!ok()) return; const t = T(); for (let i = 0; i < n; i++) { const d = i * 0.35 + Math.random() * 0.2; tone(t + d, 70, 0.8, { to: 30, peak: 0.6 }); noise(t + d, 0.9, { freq: 350, peak: 0.5, attack: 0.003 }); } },
    mg() { if (!ok()) return; const t = T(); for (let i = 0; i < 16; i++) noise(t + i * 0.06, 0.05, { freq: 2200, peak: 0.25, attack: 0.002 }); },
    engine() { if (!ok()) return; const t = T(); tone(t, 55, 1.2, { type: 'sawtooth', peak: 0.06, attack: 0.2, vib: 4 }); noise(t, 1.2, { freq: 200, peak: 0.12, attack: 0.2 }); },
    card() { if (!ok()) return; const t = T(); tone(t, 880, 0.25, { type: 'triangle', peak: 0.12 }); tone(t + 0.08, 1320, 0.35, { type: 'triangle', peak: 0.1 }); noise(t, 0.2, { type: 'highpass', freq: 3000, peak: 0.05 }); },
    flip() { if (!ok()) return; noise(T(), 0.08, { type: 'bandpass', freq: 1800, q: 2, peak: 0.12 }); },
    shout() { if (!ok()) return; const t = T(); for (let i = 0; i < 6; i++) tone(t + Math.random() * 0.15, 160 + Math.random() * 120, 0.7, { type: 'sawtooth', peak: 0.025, attack: 0.08, vib: 8 }); noise(t, 0.8, { type: 'bandpass', freq: 700, q: 1, peak: 0.08, attack: 0.1 }); },
    march() { if (!ok()) return; this.drum(0, 0.6); this.drum(0.25, 0.4); this.drum(0.5, 0.7); },
    // a slow war-drum heartbeat while you plan
    startDrums() { this.stopDrums(); drumTimer = setInterval(() => { if (!muted && ac && document.getElementById('battle')?.classList.contains('show')) { this.drum(0, 0.35); this.drum(0.42, 0.25); } }, 2600); },
    stopDrums() { clearInterval(drumTimer); drumTimer = 0; },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('ib_mute', muted ? '1' : '0'); } catch (e) { /* ignore */ } if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
  };
  return S;
})();
