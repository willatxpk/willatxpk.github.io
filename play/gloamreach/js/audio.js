// Procedural Web Audio: ambience, footsteps, combat, and the things in the dark.
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.6; }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    if (c.state !== 'running') c.resume().catch(() => {});
    // everything is mixed hot and then held under a limiter, so it's audible on laptop speakers without clipping
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -14; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.2;
    const makeup = c.createGain(); makeup.gain.value = 4;
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(makeup).connect(lim).connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind
    const wn = c.createBufferSource(); wn.buffer = buf; wn.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    this.windG = c.createGain(); this.windK = 2.2; this.windG.gain.value = 0;
    wn.connect(wf).connect(this.windG).connect(this.master); wn.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.11;
    const lg = c.createGain(); lg.gain.value = 200; lfo.connect(lg).connect(wf.frequency); lfo.start();
    // low night drone
    this.droneG = c.createGain(); this.droneG.gain.value = 0;
    const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 200;
    df.connect(this.droneG).connect(this.master);
    for (const f of [41.2, 43.65, 61.7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0.3; o.connect(g).connect(df); o.start();
    }
    // the chase: a throbbing low pulse under grinding, close-tuned strings — silent until something hunts you
    this.chaseG = c.createGain(); this.chaseG.gain.value = 0; this.chaseG.connect(this.master);
    const pulse = c.createGain(); pulse.gain.value = 0.5; pulse.connect(this.chaseG);
    const pdepth = c.createGain(); pdepth.gain.value = 0.5; pdepth.connect(pulse.gain);
    const lowF = c.createBiquadFilter(); lowF.type = 'lowpass'; lowF.frequency.value = 160; lowF.connect(pulse);
    const hiF = c.createBiquadFilter(); hiF.type = 'bandpass'; hiF.frequency.value = 1400; hiF.Q.value = 3; hiF.connect(this.chaseG);
    const hiG = c.createGain(); hiG.gain.value = 0.05; hiG.connect(hiF);
    // layers cost nothing until they're heard: their oscillators start then, and stop after a few quiet seconds
    this.layers = {};
    const osc = (f, type = 'sine') => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    this.layers.chase = { build: () => {
      const plfo = osc(2.3, 'square'); plfo.connect(pdepth); this.chaseLfo = plfo;
      const n = [plfo];
      for (const f of [36.7, 38.9]) { const o = osc(f, 'sawtooth'); o.connect(lowF); n.push(o); }
      for (const f of [587, 659.3]) { const o = osc(f, 'sawtooth'), v = osc(5 + Math.random() * 2), vg = c.createGain(); vg.gain.value = 6; v.connect(vg).connect(o.frequency); o.connect(hiG); n.push(o, v); }
      return n;
    } };
    // ---- music: a soft hall for everything played, then one bus per mood
    this.musG = c.createGain(); this.musG.gain.value = 1; this.musG.connect(this.master);
    const rev = c.createConvolver(); rev.buffer = this._impulse(2.2);
    const revG = c.createGain(); revG.gain.value = 0.6; this.musG.connect(rev).connect(revG).connect(this.master);
    const bus = () => { const g = c.createGain(); g.gain.value = 0; g.connect(this.musG); return g; };
    this.dayG = bus(); this.nightG = bus(); this.fightG = bus(); this.tenseG = bus();
    // the day tunes echo a little, like a voice across a valley
    const dl = c.createDelay(1); dl.delayTime.value = 0.43; const fb = c.createGain(); fb.gain.value = 0.32; const dlf = c.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 1800;
    this.dayG.connect(dl); dl.connect(dlf).connect(fb).connect(dl); dlf.connect(this.musG);
    // being stalked: a thin, trembling cluster high up, barely there
    const tg = c.createGain(); tg.gain.value = 0.5;
    const tAmp = c.createGain(); tAmp.gain.value = 0.5; tg.connect(tAmp.gain); tAmp.connect(this.tenseG);
    const tlf = c.createBiquadFilter(); tlf.type = 'lowpass'; tlf.frequency.value = 120; const tlg = c.createGain(); tlg.gain.value = 1.4; tlf.connect(tlg).connect(this.tenseG);
    this.layers.tense = { build: () => {
      const n = [osc(7.5)]; n[0].connect(tg);
      for (const f of [1046.5, 1108.7, 1174.7]) { const o = osc(f * (1 + (Math.random() - 0.5) * 0.004), 'triangle'); o.connect(tAmp); n.push(o); }
      const lo = osc(49, 'sawtooth'); lo.connect(tlf); n.push(lo);
      return n;
    } };
    // the fight's bed: string tremolo, a minor second apart, scraping away under everything
    const ftg = c.createGain(); ftg.gain.value = 0.5;
    const fAmp = c.createGain(); fAmp.gain.value = 0.5; ftg.connect(fAmp.gain);
    const fBp = c.createBiquadFilter(); fBp.type = 'bandpass'; fBp.frequency.value = 900; fBp.Q.value = 0.8; fAmp.connect(fBp).connect(this.fightG);
    const fG = c.createGain(); fG.gain.value = 0.055; fG.connect(fAmp);
    this.layers.fight = { build: () => {
      const n = [osc(13)]; n[0].connect(ftg);
      for (const f of [311.1, 329.6, 466.2]) { const o = osc(f * (1 + (Math.random() - 0.5) * 0.006), 'sawtooth'); o.connect(fG); n.push(o); }
      return n;
    } };
    this.voices = 0;
    this.piece = null; this._mt = 3; this._nt = 5; this._dt = 0;
  }
  _layer(name, level) {
    const L = this.layers?.[name]; if (!L) return;
    if (level > 0.002) { L.quiet = null; if (!L.nodes) L.nodes = L.build(); return; }
    if (!L.nodes) return;
    L.quiet ??= this.t;
    if (this.t - L.quiet > 6) { for (const n of L.nodes) { try { n.stop(); } catch (e) { /* stopped */ } try { n.disconnect(); } catch (e) { /* gone */ } } L.nodes = null; L.quiet = null; if (name === 'chase') this.chaseLfo = null; }
  }
  _impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  // ---- the score: peaceful by day, the dark breathing at night, drums when something comes for you
  update(dt, st) {
    if (!this.ok() || !this.dayG) return;
    const t = this.t, fight = st.chase || 0, tense = st.tense || 0;
    const day = !st.under && st.sun > 0.55, calm = fight < 0.15 && tense < 0.25;
    this.dayG.gain.setTargetAtTime(day && calm ? 1.7 : 0, t, calm ? 3 : 0.5);
    this.nightG.gain.setTargetAtTime(day ? 0 : (0.75 + Math.min(0.35, (st.dread || 0) / 200)) * (1 - fight * 0.5), t, 3);
    this.tenseG.gain.setTargetAtTime(Math.min(1, tense + fight * 0.5) * 0.05, t, tense > (this._tk || 0) ? 0.8 : 2.5);
    this.fightG.gain.setTargetAtTime(fight > 0.2 ? 0.55 + fight * 0.45 : 0, t, fight > 0.2 ? 0.3 : 2);
    this._tk = tense;
    this._layer('tense', Math.min(1, tense + fight * 0.5));
    this._layer('fight', fight > 0.2 ? 1 : 0);
    this._mt -= dt;
    if (this._mt <= 0) this._mt = day && calm ? this._dayStep() : (this.piece = null, 2);
    this._nt -= dt;
    if (!day && this._nt <= 0) { this._nt = (7 + Math.random() * 13) * (1 - Math.min(0.5, (st.dread || 0) / 160)); this._nightEvent(); }
    this._dt -= dt;
    if (fight > 0.2 && this._dt <= 0) this._dt = this._drumBar(fight);
  }
  _pluck(f, when, dur, g, dest) {
    this._tone(f, dur, { g, a: 0.008, when, dest });
    this._tone(f * 2, dur * 0.5, { type: 'triangle', g: g * 0.22, a: 0.005, when, dest });
    this._tone(f * 3.01, dur * 0.22, { g: g * 0.07, a: 0.004, when, dest });
  }
  _dayStep() {
    let P = this.piece;
    if (!P) {
      const roots = [261.63, 293.66, 329.63, 349.23, 392.0, 220.0, 246.94];
      const progs = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 0, 4], [3, 4, 0, 0], [0, 2, 3, 4]];
      P = this.piece = { root: roots[(Math.random() * roots.length) | 0], prog: progs[(Math.random() * progs.length) | 0], bar: 0, bars: 12 + ((Math.random() * 12) | 0), bl: 2.6 + Math.random() * 1.2, mel: 3 + ((Math.random() * 4) | 0) };
    }
    const major = [0, 2, 4, 5, 7, 9, 11], pent = [0, 2, 4, 7, 9], D = this.dayG, bl = P.bl;
    const fr = sm => P.root * Math.pow(2, sm / 12);
    const deg = P.prog[P.bar % P.prog.length];
    const triad = [0, 2, 4].map(i => { const d = deg + i; return major[d % 7] + 12 * Math.floor(d / 7); });
    this._tone(fr(triad[0] - 24), bl * 1.7, { type: 'triangle', g: 0.06, a: 0.05, lp: 700, dest: D });
    if (P.bar % 2 === 0) for (const sm of triad) this._tone(fr(sm - 12), bl * 1.5, { g: 0.016, a: 0.8, dest: D });
    const n = Math.random() < 0.18 ? 0 : 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      P.mel = Math.max(0, Math.min(10, P.mel + ((Math.random() * 5) | 0) - 2));
      const sm = pent[P.mel % 5] + 12 * Math.floor(P.mel / 5);
      this._pluck(fr(sm), (i / n) * bl + (Math.random() < 0.3 ? bl / (2 * n) : 0), 2.8, 0.05, D);
    }
    P.bar++;
    if (P.bar >= P.bars) { this.piece = null; return bl + 20 + Math.random() * 35; } // long silences between pieces
    return bl;
  }
  _nightEvent() {
    const pan = Math.random() * 2 - 1, D = this.nightG, r = Math.random();
    if (r < 0.2) { const f = 52 + Math.random() * 36; this._tone(f, 4, { type: 'sawtooth', g: 0.07, a: 1.4, fEnd: f * 0.68, lp: 260, pan, dest: D }); this._tone(f * 1.06, 3.6, { type: 'sawtooth', g: 0.045, a: 1.6, fEnd: f * 0.7, lp: 300, pan, dest: D }); }
    else if (r < 0.36) { const f = 480 + Math.random() * 380; this._tone(f, 2.4, { g: 0.03, a: 0.35, fEnd: f * 0.58, vib: 6, pan, dest: D }); }
    else if (r < 0.52) this._noise(2.6, { type: 'bandpass', f: 600 + Math.random() * 900, q: 22, g: 0.12, a: 0.9, fEnd: 280 + Math.random() * 300, pan, dest: D });
    else if (r < 0.64) { const n = 2 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) this._tone(78, 0.28, { g: 0.12, fEnd: 42, lp: 380, when: i * (0.45 + Math.random() * 0.2), pan, dest: D }); }
    else if (r < 0.82) { const b = 98 * Math.pow(2, ((Math.random() * 12) | 0) / 12); for (const k of [1, 1.0595, 1.4142]) this._tone(b * k, 7, { type: 'triangle', g: 0.026, a: 3.5, lp: 1300, pan: pan * 0.5, dest: D }); }
    else if (r < 0.92) { for (let i = 0; i < 5; i++) this._tone(1900 + Math.random() * 900, 0.5, { g: 0.012, a: 0.01, when: i * 0.31 + Math.random() * 0.05, pan, dest: D }); } // a music box, somewhere, missing notes
    else this.whisper(pan, 0.45);
  }
  // the terror score: no steady beat to settle into. Strings that screech and slide, piano hammered in the cellar of
  // the keyboard, hits that land when you don't expect them, and swells that rush up and stop dead
  _drumBar(k) {
    const F = this.fightG, bar = 2.2 - k * 0.7, R = Math.random;
    // screeching violins: a close cluster sliding up or down, bowed hard, with a wide nervous vibrato
    if (R() < 0.45 + k * 0.3) {
      const f = 900 + R() * 900, glide = Math.pow(2, (R() < 0.5 ? -1 : 1) * (2 + R() * 5) / 12), w = R() * bar * 0.6, d = 0.8 + R() * 1.4;
      for (const c of [1, 1.03]) this._tone(f * c, d, { type: 'sawtooth', g: 0.035 + 0.02 * k, a: 0.06 + R() * 0.25, fEnd: f * c * glide, vib: 7 + R() * 5, lp: 4200, when: w, dest: F });
      this._noise(d, { type: 'bandpass', f: f * 1.5, q: 6, g: 0.02 * k, a: 0.1, when: w, dest: F }); // bow hair on the string
    }
    // the low piano cluster, struck with a fist
    if (R() < 0.3 + k * 0.35) {
      const w = (R() * 4 | 0) * bar / 4, root = 32.7 * Math.pow(2, (R() * 6 | 0) / 12);
      for (const st of [0, 1, 6, 7]) { const f = root * Math.pow(2, st / 12) * 2; this._tone(f, 2.2, { type: 'triangle', g: 0.11, a: 0.003, when: w, dest: F }); }
      this._noise(0.25, { f: 300, g: 0.18, a: 0.002, when: w, dest: F });
    }
    // hits out of time: one, two, a gap, three close together
    const n = 1 + (R() * (2 + k * 3) | 0);
    for (let i = 0; i < n; i++) { const w = R() * bar; this._tone(58 + R() * 20, 0.5, { g: 0.22 + 0.1 * k, fEnd: 30, a: 0.002, when: w, dest: F }); this._noise(0.12, { f: 900, g: 0.08, a: 0.002, when: w, dest: F }); }
    // a reversed swell that rushes up and is cut off, then the stab of every string at once
    if (R() < 0.18 + 0.22 * k) {
      const w = R() * bar * 0.5, d = 1.1 + R() * 0.8;
      this._noise(d, { type: 'bandpass', f: 400, fEnd: 5000, q: 1.2, g: 0.14, a: d * 0.97, when: w, dest: F });
      for (const f of [233, 247, 370, 554, 784]) this._tone(f * (1 + (R() - 0.5) * 0.01), 1.6, { type: 'sawtooth', g: 0.03, a: 0.01, lp: 3800, when: w + d, dest: F });
    }
    // and now and then, a thin high whistle like someone breathing through their teeth
    if (R() < 0.15) this._tone(2600 + R() * 900, 1.8, { g: 0.012, a: 0.6, vib: 4, fEnd: 2300, when: R() * bar, dest: F });
    return bar * (0.8 + R() * 0.5);
  }
  get t() { return this.ctx.currentTime; }
  ok() { return this.ctx && this.ctx.state === 'running'; }
  get state() { return this.ctx ? this.ctx.state : 'none'; }
  chase(k) {
    if (!this.ok()) return;
    const t = this.t;
    this._layer('chase', k);
    this.chaseG.gain.setTargetAtTime(0.16 * k, t, k > (this._ck || 0) ? 0.25 : 1.5);
    if (this.chaseLfo) this.chaseLfo.frequency.setTargetAtTime(1.6 + k * 2.4, t, 0.5);
    this._ck = k;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  ambient(sun, dread, under) {
    if (!this.ok()) return;
    const t = this.t;
    this.windG.gain.setTargetAtTime((under ? 0.012 : 0.07) * (0.35 + 0.65 * sun) * this.windK, t, 1);
    this.droneG.gain.setTargetAtTime(0.015 + (1 - sun) * 0.05 + dread * 0.0008 + (under ? 0.03 : 0), t, 2);
  }
  _noise(dur, o = {}) {
    if (!this.ok() || this.voices > (o.dest ? 60 : 100)) return;
    const c = this.ctx, t = this.t + (o.when || 0);
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(o.f || 800, t);
    if (o.fEnd) fl.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
    fl.Q.value = o.q || 1;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime((o.g || 0.2) * 3, t + (o.a || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = gn;
    if (o.pan) { const p = c.createStereoPanner(); p.pan.value = Number.isFinite(o.pan) ? Math.max(-1, Math.min(1, o.pan)) : 0; gn.connect(p); out = p; }
    s.connect(fl).connect(gn); out.connect(o.dest || this.master);
    this.voices++; s.onended = () => { this.voices--; s.disconnect(); out.disconnect(); };
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  _tone(f, dur, o = {}) {
    if (!this.ok() || !Number.isFinite(f) || f <= 0 || this.voices > (o.dest ? 60 : 100)) return;
    const c = this.ctx, t = this.t + (o.when || 0);
    const osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(o.g || 0.2, t + (o.a || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; osc.connect(lp); node = lp; }
    if (o.vib) { const v = c.createOscillator(); v.frequency.value = o.vib; const vg = c.createGain(); vg.gain.value = f * 0.025; v.connect(vg).connect(osc.frequency); v.start(t); v.stop(t + dur + 0.05); }
    let out = gn;
    if (o.pan) { const p = c.createStereoPanner(); p.pan.value = Number.isFinite(o.pan) ? Math.max(-1, Math.min(1, o.pan)) : 0; gn.connect(p); out = p; }
    node.connect(gn); out.connect(o.dest || this.master);
    this.voices++; osc.onended = () => { this.voices--; osc.disconnect(); out.disconnect(); };
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  step(under) { this._noise(0.09, { f: under ? 1200 : 650 + Math.random() * 250, g: under ? 0.16 : 0.13 }); this._tone(70 + Math.random() * 20, 0.07, { g: 0.12, fEnd: 45 }); }
  thud() { this._noise(0.16, { f: 320, g: 0.25 }); this._tone(95, 0.12, { g: 0.18, fEnd: 50 }); }
  place() { this._noise(0.08, { f: 900, g: 0.14 }); this._tone(160, 0.08, { g: 0.1, fEnd: 90 }); }
  dice() { for (let i = 0; i < 4; i++) this._noise(0.035, { type: 'bandpass', f: 2400 + Math.random() * 1800, q: 5, g: 0.13, when: i * 0.055 + Math.random() * 0.02 }); }
  hit() { this._noise(0.14, { f: 1500, g: 0.32, fEnd: 260 }); this._tone(150, 0.16, { type: 'square', g: 0.07, fEnd: 60 }); }
  crit() { this.hit(); this._tone(880, 0.3, { type: 'triangle', g: 0.1, fEnd: 1320, when: 0.05 }); }
  miss() { this._noise(0.2, { type: 'bandpass', f: 1800, q: 1.4, g: 0.12, fEnd: 450 }); }
  hurt() { this._tone(210, 0.28, { type: 'sawtooth', g: 0.12, fEnd: 70, lp: 900 }); this._noise(0.2, { f: 500, g: 0.2 }); }
  pickup() { this._tone(740, 0.08, { type: 'triangle', g: 0.08 }); this._tone(1110, 0.1, { type: 'triangle', g: 0.07, when: 0.06 }); }
  craft() { this._noise(0.1, { f: 2000, g: 0.1 }); this._tone(520, 0.14, { type: 'triangle', g: 0.09, when: 0.05 }); }
  drink() { for (let i = 0; i < 5; i++) this._tone(300 + Math.random() * 300, 0.07, { g: 0.07, fEnd: 700, when: i * 0.07 }); }
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.35, { type: 'triangle', g: 0.12, when: i * 0.09 })); }
  chest() { this._tone(110, 0.4, { type: 'sawtooth', g: 0.06, fEnd: 70, lp: 500 }); this._noise(0.3, { type: 'bandpass', f: 900, q: 8, g: 0.08 }); }
  lantern(on) { this._noise(0.06, { type: 'bandpass', f: on ? 2600 : 1200, q: 3, g: 0.08 }); }
  burn() { this._noise(0.5, { type: 'highpass', f: 2000, g: 0.09 }); }
  death() { this._tone(160, 1.2, { type: 'sawtooth', g: 0.12, fEnd: 40, lp: 600 }); }
  growl(pan = 0, vol = 1) {
    if (!this.ok()) return;
    const f = 60 + Math.random() * 25;
    this._tone(f, 1.0, { type: 'sawtooth', g: 0.16 * vol, fEnd: f * 0.7, a: 0.15, pan, lp: 380 });
    this._tone(f * 1.06, 1.0, { type: 'sawtooth', g: 0.12 * vol, fEnd: f * 0.72, a: 0.18, pan, lp: 380 });
    this._noise(0.9, { f: 420, g: 0.1 * vol, a: 0.2, pan });
  }
  skitter(pan = 0, vol = 1) { for (let i = 0; i < 7; i++) this._noise(0.03, { type: 'bandpass', f: 3500 + Math.random() * 2000, q: 6, g: 0.07 * vol, when: i * 0.045, pan }); }
  caw(pan = 0) { for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { this._noise(0.16, { type: 'bandpass', f: 1100 + Math.random() * 300, q: 3, g: 0.12, when: i * 0.24, pan, fEnd: 700 }); this._tone(520, 0.14, { type: 'sawtooth', g: 0.03, when: i * 0.24, pan, fEnd: 380, lp: 1500 }); } }
  windup(pan = 0, big = false) { this._noise(big ? 0.7 : 0.45, { type: 'bandpass', f: 300, fEnd: big ? 1400 : 1900, q: 2.5, g: big ? 0.16 : 0.09, a: 0.3, pan }); if (big) this._tone(70, 0.8, { type: 'sawtooth', g: 0.08, fEnd: 50, lp: 300, pan }); }
  parry() { this._tone(1250, 0.5, { type: 'triangle', g: 0.14, fEnd: 1180 }); this._tone(1870, 0.35, { type: 'triangle', g: 0.07 }); this._noise(0.12, { type: 'highpass', f: 3000, g: 0.2 }); }
  block() { this._noise(0.12, { f: 700, g: 0.3 }); this._tone(220, 0.14, { type: 'square', g: 0.06, fEnd: 120, lp: 1200 }); }
  whoosh() { this._noise(0.25, { type: 'bandpass', f: 600, fEnd: 2200, q: 1.2, g: 0.12, a: 0.04 }); }
  bossTheme() { [55, 58.3, 82.4].forEach((f, i) => this._tone(f, 3.5, { type: 'sawtooth', g: 0.09, a: 0.4, lp: 420, when: i * 0.15 })); this._noise(3, { f: 200, g: 0.12, a: 1 }); }
  // a wet, ragged breath close by in the dark
  breath(pan = 0, vol = 1) {
    if (!this.ok()) return;
    this._noise(0.9, { type: 'bandpass', f: 520, fEnd: 300, q: 2.2, g: 0.09 * vol, a: 0.35, pan });
    this._noise(0.7, { type: 'bandpass', f: 380, fEnd: 650, q: 3, g: 0.07 * vol, a: 0.25, pan, when: 1.05 });
    this._tone(95, 0.8, { type: 'sawtooth', g: 0.025 * vol, fEnd: 80, lp: 260, a: 0.3, pan });
  }
  // the shriek when one of them sees you
  screech(pan = 0, vol = 1) {
    if (!this.ok()) return;
    this._noise(0.9, { type: 'bandpass', f: 1100, fEnd: 2600, q: 4, g: 0.22 * vol, a: 0.04, pan });
    this._tone(420, 0.85, { type: 'sawtooth', g: 0.07 * vol, fEnd: 880, lp: 2400, pan });
    this._tone(455, 0.85, { type: 'sawtooth', g: 0.05 * vol, fEnd: 830, lp: 2400, pan });
  }
  // the jolt: a struck chord and a slam
  jolt() {
    if (!this.ok()) return;
    for (const f of [92, 98, 139, 185, 196, 277]) this._tone(f, 1.4, { type: 'sawtooth', g: 0.06, a: 0.005, lp: 2600 });
    this._noise(0.35, { f: 2600, g: 0.4, a: 0.002 }); this._tone(45, 1.0, { g: 0.5, fEnd: 28 });
  }
  spell(id) {
    if (id === 'mend') { [523, 659, 784].forEach((f, i) => this._tone(f, 0.5, { type: 'sine', g: 0.08, when: i * 0.06 })); return; }
    if (id === 'hex') { this._tone(110, 0.8, { type: 'sawtooth', g: 0.07, fEnd: 70, lp: 600 }); this._tone(116, 0.8, { type: 'sawtooth', g: 0.05, fEnd: 74, lp: 600 }); return; }
    if (id === 'ward') { [392, 494, 587, 740].forEach((f, i) => this._tone(f, 1.2, { type: 'triangle', g: 0.06, a: 0.2, when: i * 0.05 })); return; }
    this._noise(0.4, { type: 'bandpass', f: 400, fEnd: 1800, q: 1.4, g: 0.16, a: 0.02 }); this._tone(180, 0.3, { type: 'sawtooth', g: 0.05, fEnd: 90, lp: 900 });
  }
  boom() { this._noise(0.9, { f: 600, fEnd: 120, g: 0.4, a: 0.003 }); this._tone(60, 0.7, { g: 0.4, fEnd: 30 }); }
  spit(pan = 0, kind) { if (kind === 'fire') this._noise(0.35, { type: 'bandpass', f: 900, fEnd: 300, q: 1, g: 0.14, pan }); else { this._noise(0.2, { type: 'bandpass', f: 500, q: 4, g: 0.14, pan }); this._tone(240, 0.12, { g: 0.05, fEnd: 120, pan }); } }
  bowDraw() { this._noise(0.5, { type: 'bandpass', f: 380, fEnd: 900, q: 6, g: 0.05, a: 0.3 }); }
  bowShot(p = 1) { this._tone(170 + p * 60, 0.18, { type: 'triangle', g: 0.12, fEnd: 90 }); this._noise(0.25, { type: 'bandpass', f: 1400, fEnd: 500, q: 1.5, g: 0.12 * (0.5 + p * 0.5), a: 0.005 }); }
  thunk(pan = 0) { this._noise(0.09, { f: 700, g: 0.16, pan }); this._tone(130, 0.08, { type: 'square', g: 0.04, fEnd: 70, lp: 800, pan }); }
  rustle(vol = 1) { this._noise(0.3, { type: 'bandpass', f: 2200, fEnd: 1400, q: 0.8, g: 0.09 * vol, a: 0.05 }); }
  creak() { this._tone(180, 0.5, { type: 'sawtooth', g: 0.04, fEnd: 120, lp: 700 }); this._noise(0.4, { type: 'bandpass', f: 600, q: 6, g: 0.05 }); }
  sniff(pan = 0, vol = 1) { for (let i = 0; i < 3; i++) this._noise(0.12, { type: 'bandpass', f: 1400, q: 2, g: 0.1 * vol, when: i * 0.18, pan, a: 0.03 }); }
  rite() { [392, 494, 587, 784].forEach((f, i) => this._tone(f, 1.2, { type: 'sine', g: 0.07, when: i * 0.14 })); this._noise(1.4, { type: 'highpass', f: 3000, g: 0.05, a: 0.4 }); }
  twig(pan = 0, vol = 1) { this._noise(0.05, { type: 'highpass', f: 2600, g: 0.2 * vol, pan }); this._noise(0.04, { type: 'bandpass', f: 1500, q: 3, g: 0.14 * vol, when: 0.06, pan }); }
  crack(pan = 0, vol = 1) { this._noise(0.03, { type: 'highpass', f: 3000, g: 0.16 * vol, pan }); this._tone(240, 0.05, { type: 'square', g: 0.04 * vol, fEnd: 90, pan }); }
  footfall(pan = 0, vol = 1) { for (let i = 0; i < 2; i++) this._noise(0.1, { f: 520 + Math.random() * 200, g: 0.09 * vol, when: i * (0.32 + Math.random() * 0.05), pan }); }
  heartbeat(k) { this._tone(62, 0.13, { g: 0.32 * k, fEnd: 36 }); this._tone(56, 0.15, { g: 0.24 * k, fEnd: 32, when: 0.22 }); }
  whisper(pan = Math.random() * 2 - 1, vol = 1) {
    if (!this.ok()) return;
    const c = this.ctx, t = this.t;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7;
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    let tt = t; const end = t + 1.2 + Math.random() * 1.3;
    while (tt < end) {
      const syl = 0.07 + Math.random() * 0.13;
      bp.frequency.setValueAtTime(700 + Math.random() * 2000, tt);
      g.gain.linearRampToValueAtTime((0.05 + Math.random() * 0.06) * vol, tt + syl * 0.3);
      g.gain.linearRampToValueAtTime(0.003, tt + syl);
      tt += syl + Math.random() * 0.06;
    }
    g.gain.linearRampToValueAtTime(0, tt + 0.05);
    const p = c.createStereoPanner(); p.pan.value = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
    s.connect(bp).connect(g).connect(p).connect(this.master);
    s.start(t); s.stop(tt + 0.1);
  }
  stinger() {
    if (!this.ok()) return;
    for (const f of [233, 247, 262, 370, 392, 740, 784]) this._tone(f * (1 + (Math.random() - 0.5) * 0.01), 2.6, { type: 'sawtooth', g: 0.035, a: 0.06, lp: 3200 });
    this._tone(52, 1.8, { g: 0.45, fEnd: 30 });
  }
  scream() { this._noise(0.9, { type: 'bandpass', f: 1400, q: 3, g: 0.2, fEnd: 3000, a: 0.05 }); this._tone(620, 0.8, { type: 'sawtooth', g: 0.06, fEnd: 1400, lp: 2500 }); }
}
