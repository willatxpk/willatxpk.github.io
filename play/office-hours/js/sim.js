// Core simulation: game state, people, projects, weekly tick, helpers.
import { WPY, FIRST, LAST, ROLES, TRAITS, CARDS, SYNERGY, JOURNALS, GRANTS, EQUIP, FIELDS, TITLES, ARXIV_JOKES, PLATS, HOBBIES, HOME, COLLEAGUES, SUPPLIES, HIRE_COST } from './data.js';

export let G = null;
export const hooks = { toast() {}, worldSync() {}, gameOver() {}, mail() {} };

// ---------- random helpers ----------
export const rnd = Math.random;
export const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
export const pick = a => a[Math.floor(rnd() * a.length)];
export const chance = p => rnd() < p;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const fmt$ = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString();
export const fmtK = n => (n < 0 ? '−$' : '$') + (Math.abs(n) >= 1e6 ? (Math.abs(n) / 1e6).toFixed(2) + 'M' : Math.round(Math.abs(n) / 1000) + 'k');

// ---------- calendar ----------
export const year = () => Math.floor((G.week - 1) / WPY) + 1;
export const wk = () => ((G.week - 1) % WPY) + 1;
export function term() {
  const w = wk();
  if (w <= 15) return 'Fall';
  if (w <= 19) return 'Winter Break';
  if (w <= 36) return 'Spring';
  return 'Summer';
}
const MONTHS = ['September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'];
export const month = () => Math.ceil(wk() / 4);
export const dateStr = () => G.timeStep === 'week' ? `Year ${year()} · Week ${wk()} · ${term()}` : `Year ${year()} · ${MONTHS[month() - 1]} · ${term()}`;

// ---------- people ----------
const SKIN = ['#f3d2b5', '#e8b996', '#d49a6a', '#b57a4e', '#8d5a3a', '#6b4128', '#4a2c1c', '#f5dcc4'];
const HAIR = ['#1b1410', '#3a2418', '#6b4423', '#a8743c', '#d8b26a', '#e8e0d0', '#7a1f1f', '#2e2e3a', '#c45b9c', '#3a7ab8', '#8a8a8a'];
const SHIRT = ['#3a6ea5', '#c0392b', '#2a8a6a', '#8e44ad', '#d68910', '#34495e', '#16a085', '#e67e22', '#7f8c8d', '#c0587a', '#556b2f', '#2c3e50', '#b8860b', '#4a90a4'];
const PANTS = ['#2c3e50', '#3b3b3b', '#4a3b2a', '#1f2f4a', '#5a5a5a', '#6b5a3a', '#203040'];
const STYLES = ['short', 'short', 'long', 'bun', 'curly', 'bald', 'spiky', 'bob', 'ponytail', 'afro'];

export function randomLook(role) {
  return {
    skin: pick(SKIN), hair: pick(HAIR), style: pick(STYLES), shirt: pick(SHIRT), pants: pick(PANTS),
    coat: (role === 'staff' || role === 'postdoc') ? chance(0.6) : chance(0.3),
    glasses: chance(0.4), height: 0.92 + rnd() * 0.14, beard: chance(0.2),
  };
}

export function personName() {
  const used = new Set(G ? G.people.map(p => p.first) : []);
  let f; let n = 0;
  do { f = pick(FIRST); n++; } while (used.has(f) && n < 40);
  return { first: f, last: pick(LAST) };
}

export function makePerson(role, opt = {}) {
  const r = ROLES[role];
  const nm = personName();
  const traitKeys = Object.keys(TRAITS);
  const traits = [];
  const nT = role === 'undergrad' ? 1 : int(2, 3);
  while (traits.length < nT) {
    const t = pick(traitKeys);
    if (traits.includes(t)) continue;
    if (traits.some(x => TRAITS[x].clash.includes(t))) continue;
    traits.push(t);
  }
  const sk = () => clamp(int(r.skill[0], r.skill[1]), 1, 10);
  const skill = { exp: sk(), theory: sk(), code: sk() };
  if (traits.includes('theorist')) { skill.theory += 2; skill.exp -= 1; }
  if (traits.includes('handson')) { skill.exp += 2; skill.theory -= 1; }
  if (traits.includes('coder')) skill.code += 2;
  for (const k in skill) skill[k] = clamp(skill[k], 1, 10);
  return {
    id: 'p' + (G.nextId++), ...nm, role, yearIn: role === 'grad' ? 1 : 0, weeks: 0,
    skill, traits, morale: int(55, 75), stress: int(10, 30), loyalty: int(40, 60), expertise: pickExpertise(role),
    project: null, look: randomLook(role), rel: {}, papers: 0, station: -1, away: 0,
    quals: role === 'grad' ? 'pending' : null, fellowship: 0, flags: {}, ...opt,
  };
}

export const has = (p, t) => p && p.traits.includes(t);
export const person = id => G.people.find(p => p.id === id);
export const roleName = p => p.role === 'grad' ? `${ROLES.grad.name}, yr ${p.yearIn}` : ROLES[p.role].name;
export function personCost(p) {
  const r = ROLES[p.role]; const ci = (G && G.costIndex) || 1;
  if (p.fellowship > 0) return { pay: 0, tuition: 0, benefits: 0 };
  const yr = p.role === 'grad' ? 1 + 0.02 * Math.max(0, (p.yearIn || 1) - 1) : 1;
  return { pay: r.pay * ci * yr, tuition: (r.tuition || 0) * ci, benefits: (r.benefits || 0) * ci };
}
export const salary = p => { const c = personCost(p); return Math.round(c.pay + c.tuition + c.benefits); };
export const relOf = (a, b) => (a.rel[b.id] || 0);
export function rel(a, b, d) {
  if (!a || !b || a === b) return;
  a.rel[b.id] = clamp((a.rel[b.id] || 0) + d, -100, 100);
  b.rel[a.id] = clamp((b.rel[a.id] || 0) + d, -100, 100);
}
export function mod(p, o) {
  if (!p) return;
  for (const k in o) {
    if (k === 'skill') { for (const s in o.skill) p.skill[s] = clamp(p.skill[s] + o.skill[s], 1, 10); continue; }
    p[k] = clamp((p[k] || 0) + o[k], 0, 100);
  }
}
export function team() { return G.people.filter(p => !p.gone); }
export function capacity() { return 6 + (G.equip.expansion ? 4 : 0); }

export function assignStation(p) {
  const taken = new Set(team().filter(x => x !== p).map(x => x.station));
  for (let i = 0; i < capacity(); i++) if (!taken.has(i)) { p.station = i; return; }
  p.station = -1;
}

function pickExpertise(role) {
  const n = role === 'undergrad' ? 1 : role === 'grad' ? 2 : 3;
  const pool = shuffle(CARDS.filter(c => !G || !G.unlocked || !G.unlocked.includes(c.id))); const pool2 = pool.length >= n ? pool : shuffle([...CARDS]);
  return pool2.slice(0, n).map(c => c.id);
}
// unlock idea cards; returns the ones that were new
export function unlockCards(ids, source, quiet) {
  const fresh = ids.filter(id => id && !G.unlocked.includes(id) && CARDS.some(c => c.id === id));
  if (!fresh.length) return [];
  G.unlocked.push(...fresh);
  const names = fresh.map(id => CARDS.find(c => c.id === id).name).join(', ');
  if (!quiet) { log(`New research ideas${source ? ' from ' + source : ''}: ${names}.`); hooks.toast(`💡 New ideas${source ? ' from ' + source : ''}: ${names}`, 'good'); }
  return fresh;
}
// owning the right hardware opens up the systems and techniques it enables
export function refreshUnlocks(quiet) {
  const ok = c => (c.needs || []).length && c.needs.every(n => G.equip[n]);
  return unlockCards(CARDS.filter(c => (c.k === 'sys' || c.k === 'tech') && ok(c)).map(c => c.id), 'your new equipment', quiet);
}
export function addPerson(p) {
  if (p.expertise && p.expertise.length) unlockCards(p.expertise, G.week > 1 ? `${p.first}'s background` : null, G.week <= 1);
  if (G.week > 1 && p.role !== 'undergrad' && !p.free) { const c = Math.round(HIRE_COST * (G.costIndex || 1)); G.money -= c; log(`Recruiting and relocation for ${p.first} ${p.last}: ${fmt$(c)}.`); }
  G.people.push(p);
  assignStation(p);
  for (const q of team()) if (q !== p) {
    let r = int(-5, 15);
    for (const t of p.traits) if (q.traits.some(u => TRAITS[t].clash.includes(u))) r -= 20;
    if (has(p, 'diplomat') || has(q, 'diplomat')) r += 10;
    p.rel[q.id] = r; q.rel[p.id] = r;
  }
  hooks.worldSync();
}

export function removePerson(p, why) {
  p.gone = why || 'left';
  if (p.project) { const pr = proj(p.project); if (pr) pr.members = pr.members.filter(id => id !== p.id); }
  p.project = null;
  G.alumni.push({ name: p.first + ' ' + p.last, role: p.role, why, week: G.week });
  hooks.worldSync();
}

// ---------- state ----------
export function newGame({ name, labName, field, home = 'partner', hobby = 'climbing' }) {
  const F = FIELDS[field];
  G = {
    v: 1, week: 1, pi: name || 'Prof. You', labName: labName || 'Your Lab', field,
    money: 950000 + (F.moneyAdj || 0), lastDelta: 0, rep: 8, energy: 80, culture: 55, goodwill: 50,
    titleIdx: 0, tenured: false, papers: [], landmarks: 0, grantsWon: 0, graduated: 0,
    people: [], projects: [], nextId: 1, equip: {}, broken: {}, grants: [], pending: [], calls: [],
    inbox: [], queue: [], log: [], alumni: [], applicants: [], unlocked: [...F.cards],
    committees: 0, teaching: false, flags: {}, cooldowns: {}, negWeeks: 0, coffeeWeek: 0,
    rival: { name: 'Prof. Renata Voss', inst: 'the Institute across the river', focus: null, heat: 0, rel: 0 },
    arxiv: [], dnd: false, speed: 12, over: false, won: false, stats: { visits: 0, conflicts: 0 },
    borrowed: {}, followups: [],
  };
  // home life
  const L = G.life = { status: home, hobby, hours: 55, hobbyTime: true, home: 65, self: 70, missed: 0, kept: 0, kids: [], partner: null, promise: null, lastCall: 0, mem: { log: [], tones: [] } };
  if (home !== 'single') { const n = personName(); L.partner = { first: n.first, look: randomLook('grad') }; }
  if (home === 'family') { for (const age of [9, 5]) { const n = personName(); const look = randomLook('grad'); look.height = age > 7 ? 0.62 : 0.5; look.coat = false; look.beard = false; look.glasses = chance(0.2); L.kids.push({ first: n.first, age, look }); } }
  // other professors
  G.profs = COLLEAGUES.map((c, i) => ({ id: 'f' + i, ...c, look: { ...c.look }, rel: c.persona === 'oldguard' ? 40 : c.persona === 'neighbor' ? 45 : 55, mem: { log: [], tones: [] } }));
  for (const e of F.equip) G.equip[e] = true;
  // add a few base cards from other fields so brainstorming has variety
  G.expertise = {}; G.shared = {};
  const extra = shuffle(CARDS.filter(c => !G.unlocked.includes(c.id))).slice(0, 10).map(c => c.id);
  G.unlocked.push(...extra);
  refreshUnlocks(true);

  addPerson(makePerson('postdoc'));
  addPerson(makePerson('grad', { yearIn: 2 }));
  addPerson(makePerson('grad'));
  addPerson(makePerson('undergrad'));

  // starter project
  // pick the best combination the lab can actually do with its starting equipment
  let best = null, bv = -99;
  for (const sy of CARDS.filter(c => c.k === 'sys' && F.cards.includes(c.id)))
    for (const te of CARDS.filter(c => c.k === 'tech' && G.unlocked.includes(c.id)))
      for (const go of CARDS.filter(c => c.k === 'goal' && G.unlocked.includes(c.id))) {
        const ids = [sy.id, te.id, go.id]; const sc = scoreIdea(ids);
        if (sc.bad.length || sc.missing.length) continue;
        const v = sc.feas + sc.nov + (F.cards.includes(te.id) ? 2 : 0) + (F.cards.includes(go.id) ? 2 : 0);
        if (v > bv) { bv = v; best = ids; }
      }
  const pr = makeProject(best || [F.cards[0], 'ml', 'arrow']);
  pr.stage = 'running';
  pr.progress = 25;
  G.projects.push(pr);
  const [pd, g2] = G.people;
  joinProject(pd, pr); joinProject(g2, pr);

  newCalls(true);
  mail('Dean of Physical Sciences', 'Welcome to the department!', `Dear ${G.pi},\n\nWelcome! Your startup package of ${fmtK(G.money)} has been deposited. It needs to last until your grants come in. Spend it wisely. Tenure review is in your 6th year.\n\nYour office door is always open, which means people will walk in. That is the job.\n\nWarmly,\nThe Dean`);
  if (L.partner) mail(L.partner.first, 'Proud of you', `First day as a professor! Don't forget to come home at some point.${L.kids.length ? ` The kids made you a card. ${L.kids[0].first} drew you as a scientist with lightning coming out of your hands.` : ''}\n\nLove,\n${L.partner.first}`);
  mail('IT Services', 'Your new computer', `Click the monitor to use your computer: email, team, projects, grants, hiring, lab equipment, your faculty colleagues, your home life and your CV.\n\nDrag to look around the office. Click people in the lab to call them in for a 1:1. Click your coffee mug if you get tired.`);
  return G;
}

export function load(g) { G = g; if (!G.flags.grants2) { G.flags.grants2 = true; newCalls(); } return G; } // older saves pick up the new grant programs

// ---------- log / mail ----------
export function log(t) { G.log.unshift({ w: G.week, t }); if (G.log.length > 80) G.log.pop(); }
export function mail(from, subject, body, actions = null, extra = {}) {
  G.inbox.unshift({ id: 'm' + (G.nextId++), from, subject, body, week: G.week, read: false, actions, ...extra });
  if (G.inbox.length > 60) G.inbox.length = 60;
  hooks.mail();
}

// ---------- visits ----------
export function queueVisit(v, front = false) {
  v.id = 'v' + (G.nextId++);
  v.week = G.week;
  // avoid duplicates of the same event for the same person
  if (G.queue.some(q => q.ev === v.ev && q.A === v.A && q.B === v.B && q.proj === v.proj)) return;
  if (front) G.queue.unshift(v); else G.queue.push(v);
}
export const busy = id => G.queue.some(q => q.A === id || q.B === id);

// ---------- projects ----------
export const card = id => CARDS.find(c => c.id === id);
export const proj = id => G.projects.find(p => p.id === id);

const fitsPlat = (c, plat) => !c.fits || c.fits === 'any' || c.fits.includes(plat);
export function techNeeds(tech, sys) {
  if (!tech || !sys || sys.mode !== 'exp') return [];
  if (tech.needsBy && tech.needsBy[sys.plat]) return tech.needsBy[sys.plat];
  return tech.needs || [];
}
// hardware a technique or goal card needs, given the system it's paired with (theory/data systems need none)
export function cardNeeds(c, sys) {
  if (!c) return [];
  if (c.k === 'sys') return c.needs || [];
  if (!sys || sys.mode !== 'exp') return [];
  if (c.needsBy && c.needsBy[sys.plat]) return c.needsBy[sys.plat];
  return c.needs || [];
}
export function projNeeds(ids) {
  const [sys, tech, goal] = ids.map(card);
  return [...new Set([...(sys.needs || []), ...techNeeds(tech, sys), ...cardNeeds(goal, sys)])];
}
// owned upgrades that apply to a project: {speed, q}
export function boosts(pr) {
  const sys = card(pr.cards[0]); let speed = 1, q = 0;
  for (const k in G.equip) {
    const b = G.equip[k] && EQUIP[k] && EQUIP[k].boost; if (!b || G.broken[k]) continue;
    const ok = (b.plats && b.plats.includes(sys.plat)) || (b.modes && b.modes.includes(sys.mode)) || (b.needs && projNeeds(pr.cards).includes(b.needs));
    if (ok) { speed *= b.speed || 1; q += b.q || 0; }
  }
  return { speed, q };
}
// what doesn't make physical sense in a combination
export function mismatch(ids) {
  const [sys, tech, goal] = ids.map(card); const bad = [];
  if (tech && !fitsPlat(tech, sys.plat)) bad.push(`${tech.name} doesn't really apply to ${PLATS[sys.plat]}.`);
  if (goal && !fitsPlat(goal, sys.plat)) bad.push(`${sys.name} can't credibly get you ${goal.name.toLowerCase()}.`);
  return bad;
}
export const expertiseIn = ids => { const e = G.expertise || {}; return (e[ids[0]] || 0) + (e[ids[1]] || 0) * 0.5 + (e[ids[2]] || 0) * 0.3; };
export function scoreIdea(ids) {
  const cs = ids.map(card);
  let feas = 0, nov = 0, fund = 0; const notes = [];
  const bad = mismatch(ids);
  if (bad.length) { feas -= 4 * bad.length; fund -= 3 * bad.length; }
  for (const c of cs) { feas += c.feas; nov += c.nov; fund += c.fund; }
  for (const [a, b, f, n, u, note] of SYNERGY) {
    if (ids.includes(a) && ids.includes(b)) { feas += f; nov += n; fund += u; if (note) notes.push(note); }
  }
  // a stale idea: already done by the lab
  const ex = expertiseIn(ids);
  if (ex > 0) { feas += Math.min(3, Math.floor(ex)); fund += Math.min(2, Math.floor(ex / 2)); notes.push(`Your lab knows this area well (expertise ${'★'.repeat(Math.min(5, Math.ceil(ex)))}).`); }
  else if (G.papers.length >= 3) { nov += 1; notes.push('A brand-new direction for your lab: fresh eyes, steeper learning curve.'); feas -= 1; }
  const done = G.projects.filter(p => p.cards.join() === ids.join()).length;
  if (done) { nov -= 3 * done; notes.push('You have already worked on this exact combination.'); }
  if (G.rival.focus && ids.every(i => G.rival.focus.includes(i))) { notes.push(`${G.rival.name} is working on something very similar.`); }
  const hype = cs.some(c => c.hype);
  const needs = projNeeds(ids);
  const missing = needs.filter(n => !G.equip[n]);
  return { feas: clamp(feas, 1, 10), nov: clamp(Math.round(nov * 0.85), 1, 10), fund: clamp(Math.round(fund * 0.75), 1, 10), notes, hype, needs, missing, bad };
}

export function ideaTitle(ids) {
  const [s, t, g] = ids.map(card);
  return `${g.noun} with ${t.adj} ${s.name}`;
}

export function makeProject(ids) {
  const sc = scoreIdea(ids);
  return {
    id: 'j' + (G.nextId++), cards: ids, title: ideaTitle(ids), feas: sc.feas, nov: sc.nov, fund: sc.fund,
    hidden: (rnd() - 0.5) * 3, hype: sc.hype, progress: 0, members: [], stage: 'running', q: 0, digs: 0,
    bug: null, started: G.week, journal: null, decideWeek: 0, preprint: false, attempts: 0, rivalCollab: false,
    mode: card(ids[0]).mode,
  };
}

export function joinProject(p, pr) {
  if (p.project) { const old = proj(p.project); if (old) old.members = old.members.filter(id => id !== p.id); }
  p.project = pr ? pr.id : null;
  if (pr && !pr.members.includes(p.id)) pr.members.push(p.id);
}

export const borrowing = k => (G.borrowed[k] || 0) > G.week;
export function equipFactor(pr) {
  let f = 1;
  for (const n of projNeeds(pr.cards)) {
    if (G.equip[n] && !G.broken[n]) { if (G.shared && G.shared[n]) f *= 0.88; continue; }
    if (borrowing(n)) f *= 0.65; else if (G.equip[n]) f *= 0.15; else f *= 0.3;
  }
  if (mismatch(pr.cards).length) f *= 0.6;
  // building-wide dead time (construction, outages)
  const sys = card(pr.cards[0]); const dt = G.flags.deadTime;
  if (dt && G.week < dt.until && sys.mode === 'exp') f *= dt.factor;
  if (G.flags.netDown > G.week && sys.mode !== 'exp') f *= 0.4;
  return f;
}

export function weeklyOutput(p) {
  if (p.away > 0 || !p.project) return 0;
  const pr = proj(p.project); if (!pr) return 0;
  const sys = card(pr.cards[0]), tech = card(pr.cards[1]);
  const skill = (p.skill[sys.mode] * 2 + p.skill[tech.mode || sys.mode]) / 3;
  let f = (0.45 + p.morale / 110) * (1 - Math.max(0, p.stress - 60) / 70);
  if (has(p, 'workaholic')) f *= 1.25;
  if (has(p, 'slacker')) f *= 0.75;
  if (has(p, 'perfectionist')) f *= 0.85;
  if (has(p, 'loner') && pr.members.length > 2) f *= 0.8;
  if (has(p, 'chaotic') && chance(0.08)) f *= 4;
  if (G.equip.cluster && (sys.mode === 'code' || sys.mode === 'theory')) f *= 1.2;
  // conflicts with teammates slow the work
  for (const id of pr.members) { const q = person(id); if (q && q !== p && relOf(p, q) < -40) f *= 0.85; }
  return Math.max(0, skill * 0.62 * f * equipFactor(pr) * boosts(pr).speed * Math.sqrt(pr.feas / 6));
}

export function stageLabel(pr) {
  return { idea: 'Idea', running: 'In progress', results: 'Results in', writing: 'Writing', review: 'Under review', published: 'Published', dead: 'Shelved', scooped: 'Scooped' }[pr.stage] || pr.stage;
}

// ---------- reputation and career ----------
export const title = () => TITLES[G.titleIdx];
export function addRep(n) { G.rep = Math.max(0, G.rep + n); }
export function tenureScore() {
  const pub = G.papers.reduce((s, p) => s + p.rep, 0);
  const colleagues = (G.profs || []).reduce((s, f) => s + (f.rel - 50), 0) * 0.25;
  return Math.round(pub * 1.2 + G.rep * 0.6 + G.grantsWon * 14 + G.goodwill * 0.35 + G.graduated * 12 + colleagues + (G.flags.chairLetter ? 25 : 0));
}
export const TENURE_BAR = 400;

// ---------- weekly economics ----------
export function weeklyIncome() { return G.grants.reduce((s, g) => s + g.weekly, 0); }
export function supplyCost(pr) {
  const sys = card(pr.cards[0]); let c = (SUPPLIES[sys.plat] || { cost: 100 }).cost;
  const h = G.flags.priceHike; if (h && h.plat === sys.plat && G.week < h.until) c *= 1.4;
  if (pr.premium) c *= 1.3; if (pr.budget) c *= 0.6;
  return c * (G.costIndex || 1);
}
export const COST_LABELS = { stipends: 'Grad and undergrad stipends', tuition: 'Grad tuition remission', salaries: 'Postdoc, staff and scientist salaries', benefits: 'Benefits and health insurance', supplies: 'Research supplies', software: 'Software licenses', upkeep: 'Equipment upkeep and services', helium: 'Emergency helium' };
export function costBreakdown() {
  const b = { stipends: 0, tuition: 0, salaries: 0, benefits: 0, supplies: 0, software: 0, upkeep: 0, helium: 0 };
  const T = team();
  for (const p of T) { const c = personCost(p); if (p.role === 'grad' || p.role === 'undergrad') b.stipends += c.pay; else b.salaries += c.pay; b.tuition += c.tuition; b.benefits += c.benefits; }
  for (const pr of G.projects) if (pr.stage === 'running' && pr.members.length) b.supplies += supplyCost(pr);
  b.software = T.filter(p => p.role !== 'undergrad').length * 30 * (G.costIndex || 1);
  for (const k in G.equip) if (G.equip[k] && EQUIP[k]) b.upkeep += EQUIP[k].upkeep || 0;
  if (G.equip.cryostat && G.flags.heliumCrisis > 0 && !G.equip.herecovery) b.helium = 1500;
  for (const k in b) b[k] = Math.round(b[k]);
  return b;
}
export function weeklyCosts() { const b = costBreakdown(); let t = 0; for (const k in b) t += b[k]; return t; }

// ---------- grants ----------
export function newCalls(initial = false) {
  const open = new Set(G.calls.map(c => c.id));
  for (const gt of GRANTS) {
    if (open.has(gt.id)) continue;
    if (gt.asstOnly && G.titleIdx > 0) continue;
    if (gt.once && G.flags['won_' + gt.id]) continue;
    if (G.pending.some(p => p.type === gt.id)) continue;
    if (G.grants.some(g => g.type === gt.id)) continue;
    if (gt.req && !G.grants.some(g => gt.req.includes(g.type))) continue;
    if (gt.rolling && G.week - (G.flags['last_' + gt.id] || -999) < 24) continue; // rolling programs: one try every six months
    if (gt.rolling) { G.calls.push({ id: gt.id, deadline: G.week + 999 }); continue; } // always open
    if (!initial && !chance(gt.minRep && G.rep < gt.minRep ? 0.08 : 0.22)) continue;
    if (initial && !['nsf', 'industry', 'onr', 'eager', 'nist'].includes(gt.id)) continue;
    G.calls.push({ id: gt.id, deadline: G.week + int(6, 14) });
  }
}

export function grantChance(type, pr, framing, effort) {
  const gt = GRANTS.find(g => g.id === type);
  let p = gt.base + Math.min(G.rep, 120) * 0.0005;
  const v = gt.likes === 'nov' ? pr.nov : gt.likes === 'fund' ? pr.fund : pr.feas;
  p += (v - 5) * 0.02 + (pr.fund - 5) * 0.01;
  if (framing === 'bold') p += gt.likes === 'nov' ? 0.08 : -0.04;
  if (framing === 'buzz') p += (gt.id === 'darpa' || gt.id === 'industry' || gt.id === 'onr') ? 0.07 : -0.06;
  if (framing === 'honest') p += gt.likes === 'feas' ? 0.04 : 0;
  p += [0, 0.04, 0.08][effort];
  if (G.flags.poBoost === type) p += 0.1;
  if (G.flags.jointGrant) p += 0.08;
  if (gt.minRep && G.rep < gt.minRep) p *= 0.3;
  if (pr.stage === 'published') p += 0.05;
  return clamp(p, 0.02, 0.85);
}
export function chanceWord(p) {
  if (p < 0.08) return 'Long shot';
  if (p < 0.18) return 'Unlikely';
  if (p < 0.32) return 'Competitive';
  if (p < 0.5) return 'Decent';
  if (p < 0.7) return 'Good';
  return 'Very likely';
}

export function submitProposal(type, pr, framing, effort) {
  const gt = GRANTS.find(g => g.id === type);
  const p = grantChance(type, pr, framing, effort);
  G.pending.push({ type, proj: pr.id, title: pr.title, p, framing, decide: G.week + (gt.fast ? int(3, 5) : int(8, 13)) });
  G.calls = G.calls.filter(c => c.id !== type);
  if (G.flags.poBoost === type) G.flags.poBoost = null;
  G.flags.jointGrant = false;
  log(`Submitted a proposal to the ${gt.name}.`);
}

// ---------- journals ----------
export function acceptChance(pr, j) {
  if (j.id === 'arxiv') return 1;
  const qual = pr.q + pr.nov * 3 + Math.min(G.rep, 120) * 0.12;
  return clamp(1 / (1 + Math.exp(-(qual - j.bar) / 14)), 0.02, 0.95);
}

export function publish(pr, j) {
  pr.stage = 'published';
  const first = person(pr.members[0]);
  const fee = Math.round((j.apc || 0) * (G.costIndex || 1));
  if (fee) { G.money -= fee; log(`Publication fee for ${j.short}: ${fmt$(fee)}.`); }
  const paper = { fee, title: pr.title, journal: j.short, jid: j.id, rep: j.rep, q: Math.round(pr.q), week: G.week, landmark: false, first: first ? first.first + ' ' + first.last : '', firstId: first ? first.id : null, authors: [...pr.members], bug: pr.bug, proj: pr.id };
  if ((j.id === 'nature' || j.id === 'science') && pr.q >= 82 && pr.nov >= 7 && !pr.bug) { paper.landmark = true; G.landmarks++; }
  if (pr.rivalCollab) paper.rep = Math.round(paper.rep * 0.6);
  G.papers.push(paper);
  addRep(paper.rep * (pr.hype ? 1.3 : 1));
  for (const id of pr.members) { const p = person(id); if (p) { p.papers++; mod(p, { morale: 15, stress: -15, loyalty: 6 }); } }
  // expertise grows in what you published; neighboring ideas open up
  G.expertise = G.expertise || {};
  for (const id of pr.cards) G.expertise[id] = (G.expertise[id] || 0) + 1;
  const sysC = card(pr.cards[0]);
  const near = shuffle(CARDS.filter(c => !G.unlocked.includes(c.id) && (c.k === 'sys' ? c.plat === sysC.plat : (!c.fits || c.fits === 'any' || c.fits.includes(sysC.plat)))));
  unlockCards(near.slice(0, 2).map(c => c.id), 'this result', true);
  if (j.rep >= 14) G.goodwill = clamp(G.goodwill + 2, 0, 100);
  if (j.id !== 'arxiv' && first) { G.flags.followIdeas = G.flags.followIdeas || []; G.flags.followIdeas.push({ proj: pr.id, lead: first.id, week: G.week + int(2, 5) }); }
  log(`Published "${pr.title}" in ${j.name}.`);
  if (pr.bug) G.flags.timeBomb = G.flags.timeBomb || [], G.flags.timeBomb.push({ week: G.week + int(10, 30), title: pr.title, rep: paper.rep });
  for (const id of pr.members) { const p = person(id); if (p) p.project = null; }
  pr.members = [];
  return paper;
}

// ---------- the weekly tick ----------
export function tickWeek() {
  if (G.over) return;
  G.week++;
  const w = wk();

  // slow drifts: reputation fades without new work, culture and goodwill relax toward neutral
  G.rep *= 0.993;
  G.culture += (50 - G.culture) * 0.03;
  G.goodwill += (50 - G.goodwill) * 0.01;
  if (G.culture > 65) G.goodwill += (G.culture - 65) * 0.006;
  for (const k in G.shared || {}) if (G.shared[k] && G.equip[k]) G.goodwill += 0.5;
  G.goodwill = clamp(G.goodwill, 0, 100);
  if (G.week % 4 === 0) refreshUnlocks();
  for (const f of G.profs || []) f.rel += (50 - f.rel) * 0.012;

  // money
  const inc = weeklyIncome(), cost = weeklyCosts();
  G.money += inc - cost;
  G.lastDelta = inc - cost;

  // PI energy
  const drain = G.committees * 5 + (G.teachLoad || 0) +G.grants.filter(g => g.reports).length * 4;
  const L = G.life;
  if (L) {
    const W = L.hours;
    const regen = 12 + (W - 40) * 0.45 + (L.self > 65 ? 4 : L.self < 30 ? -6 : 0) - (L.hobbyTime ? 3 : 0);
    G.energy = clamp(G.energy + regen - drain, 0, 100);
    const fam = L.status === 'family' ? 1.3 : L.status === 'partner' ? 1 : 0.6;
    L.home += ((50 - W) * 0.15 + (L.hobbyTime ? 0.2 : 0)) * fam + (60 - L.home) * 0.03;
    const hurt = L.footUntil > G.week, athletic = ['climbing', 'running', 'hiking'].includes(L.hobby);
    L.self += (46 - W) * 0.15 + (L.hobbyTime && !hurt ? 1.2 : -0.6) - (hurt && athletic ? 0.5 : 0) + (58 - L.self) * 0.03 + (L.home > 70 ? 0.5 : L.home < 30 ? -1.5 : 0) + (G.energy < 10 ? -1.5 : 0);
    L.home = clamp(L.home, 0, 100); L.self = clamp(L.self, 0, 100);
    if (L.away > 0) { L.away--; G.energy = Math.min(G.energy, 20); }
  } else G.energy = clamp(G.energy + 22 - drain, 0, 100);

  // grants ending
  for (const g of G.grants) if (G.week >= g.ends) { mail('Sponsored Research Office', `Grant ended: ${g.name}`, `Your ${g.name} award has reached its end date. Time to write the renewal (or something new).`); log(`${g.name} ended.`); }
  G.grants = G.grants.filter(g => G.week < g.ends);

  // grant decisions
  for (const pd of [...G.pending]) {
    if (G.week < pd.decide) continue;
    G.pending = G.pending.filter(x => x !== pd);
    const gt = GRANTS.find(g => g.id === pd.type);
    G.flags['last_' + gt.id] = G.week;
    if (chance(pd.p)) {
      const weekly = gt.lump ? 0 : Math.round(gt.amount * 0.65 / (gt.years * WPY)); // the university keeps 35% overhead
      if (gt.lump) G.money += gt.amount; // gifts and equipment grants arrive at once, overhead-free
      else G.grants.push({ name: gt.name, type: gt.id, weekly, ends: G.week + gt.years * WPY, reports: !!gt.reports, strings: !!gt.strings, total: gt.amount });
      G.grantsWon++; G.flags['won_' + gt.id] = true;
      addRep(gt.amount > 1e6 ? 4 : 2);
      G.goodwill = clamp(G.goodwill + (gt.amount > 1e6 ? 6 : 4), 0, 100);
      G.culture = clamp(G.culture + 2, 0, 100);
      mail(gt.name, `AWARDED: "${pd.title}"`, `Congratulations! Your proposal has been funded: ${gt.lump ? `${fmtK(gt.amount)}, deposited today in one payment` : `${fmtK(gt.amount)} over ${gt.years} years (${fmt$(weekly)}/week after the university's 35% overhead)`}.${gt.strings ? '\n\nOur product team will be in touch about priorities.' : ''}${gt.reports ? '\n\nQuarterly reports are mandatory.' : ''}`);
      hooks.toast(`💰 Grant awarded: ${gt.name}!`, 'good');
      log(`WON ${gt.name} (${fmtK(gt.amount)}).`);
      if (gt.strings) G.flags.industryAsk = G.week + int(4, 10);
    } else {
      const rev = pick(['"Ambitious but under-specified."', '"The PI is clearly talented; the plan is not."', '"Excellent. Not funded due to budget constraints."', '"Reviewer 3 did not read the proposal."', '"Too risky." / "Not risky enough." (two different reviewers)', '"Would be fundable with preliminary data."']);
      mail(gt.name, `Decision: "${pd.title}"`, `We regret to inform you that your proposal was not selected for funding.\n\nSummary of reviews: ${rev}\n\nWe encourage you to resubmit.`);
      hooks.toast(`📭 Proposal declined: ${gt.name}`, 'bad');
      log(`${gt.name} proposal declined.`);
    }
  }
  // grant calls
  G.calls = G.calls.filter(c => c.deadline >= G.week);
  if (w % 2 === 0) newCalls();

  // people
  const T = team();
  const baseMorale = 42 + G.culture * 0.3 + (G.equip.espresso ? 5 : 0) + (G.equip.plants ? 2 : 0) + (G.equip.cat ? 4 : 0) + (G.equip.kitchen ? 3 : 0) + (G.money < 0 ? -15 : 0);
  const socials = T.filter(p => has(p, 'social')).length;
  for (const p of T) {
    p.weeks++;
    if (p.away > 0) { p.away--; mod(p, { stress: -12, morale: 3 }); continue; }
    let target = baseMorale + socials * 2 + (p.fellowship > 0 ? 6 : 0);
    if (has(p, 'caffeine')) target += G.equip.espresso ? 8 : -8;
    if (!p.project) target -= 10;
    p.morale += (target - p.morale) * 0.08 + (rnd() - 0.5) * 3;
    let st = p.project ? 2.2 : -4;
    if (has(p, 'perfectionist')) st += 1.5;
    if (has(p, 'workaholic')) st += 2;
    if (has(p, 'anxious')) st *= 1.5;
    if (has(p, 'slacker')) st -= 3;
    if (G.equip.chairs) st -= 1;
    if (G.equip.nappod) st -= 1;
    if (p.project) { const pr = proj(p.project); if (pr && pr.members.length >= 2) st -= 0.5; }
    st -= (p.stress > 50 ? 1.5 : 0) + 1.5; // natural recovery
    p.stress += st + (rnd() - 0.5) * 3;
    p.morale = clamp(p.morale, 0, 100); p.stress = clamp(p.stress, 0, 100);
    if (p.fellowship > 0) p.fellowship--;
    // skill growth
    if (p.project && chance(G.equip.library ? 0.08 : 0.06)) {
      const pr = proj(p.project);
      const m = pr ? card(pr.cards[0]).mode : pick(['exp', 'theory', 'code']);
      let gain = 1;
      if (pr && pr.members.some(id => id !== p.id && has(person(id), 'mentor'))) gain = chance(0.5) ? 2 : 1;
      p.skill[m] = clamp(p.skill[m] + gain, 1, p.role === 'undergrad' ? 7 : 10);
    }
  }

  // relationships drift for people sharing projects
  for (const pr of G.projects) {
    const ms = pr.members.map(person).filter(Boolean);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j];
      let d = 0.6;
      for (const t of a.traits) if (b.traits.some(u => TRAITS[t].clash.includes(u))) d -= 2;
      if (has(a, 'diplomat') || has(b, 'diplomat')) d += 1;
      if (has(a, 'hothead') || has(b, 'hothead')) d -= 0.7;
      rel(a, b, d + (rnd() - 0.5));
    }
  }

  // project progress
  for (const pr of G.projects) {
    if (pr.stage !== 'running') continue;
    const out = pr.members.map(person).filter(Boolean).reduce((s, p) => s + weeklyOutput(p), 0);
    pr.progress = Math.min(100, pr.progress + out);
    if (pr.progress >= 100) {
      pr.stage = 'results';
      const ms = pr.members.map(person).filter(Boolean);
      const avg = ms.length ? ms.reduce((s, p) => s + Math.max(p.skill.exp, p.skill.theory, p.skill.code), 0) / ms.length : 4;
      pr.q = clamp(pr.nov * 3.6 + avg * 3 + pr.hidden * 4 + (pr.qBonus || 0) + boosts(pr).q + (pr.premium ? 3 : 0) +ms.filter(p => has(p, 'perfectionist')).length * 5 + int(-8, 8), 5, 100);
      let bug = 0.14 + ms.filter(p => has(p, 'chaotic')).length * 0.08 + (G.culture < 40 ? 0.1 : 0) - ms.filter(p => has(p, 'skeptic')).length * 0.09 - (team().some(p => p.role === 'staff') ? 0.03 : 0) + (pr.hype ? 0.25 : 0) + (pr.bugAdj || 0);
      pr.bug = chance(clamp(bug, 0.02, 0.7));
      const lead = ms[0];
      if (lead) queueVisit({ ev: 'results', A: lead.id, proj: pr.id, pri: 2 });
      else pr.stage = 'running';
    }
  }

  // papers under review
  for (const pr of G.projects) {
    if (pr.stage === 'review' && G.week >= pr.decideWeek) {
      const lead = pr.members.map(person).find(Boolean) || team()[0];
      if (lead) queueVisit({ ev: 'review', A: lead.id, proj: pr.id, pri: 2 });
      pr.decideWeek = G.week + 99; // wait for visit
    }
  }

  // retractions from buggy papers
  if (G.flags.timeBomb) {
    for (const tb of [...G.flags.timeBomb]) if (G.week >= tb.week) {
      G.flags.timeBomb = G.flags.timeBomb.filter(x => x !== tb);
      queueVisit({ ev: 'retraction', ext: 'rival', title: tb.title, rep: tb.rep, pri: 3 });
    }
  }

  // rival
  const R = G.rival;
  if (!R.focus || chance(0.03)) {
    const pool = G.projects.filter(p => p.stage === 'running');
    if (pool.length && chance(0.5)) R.focus = [...pick(pool).cards];
    else R.focus = [pick(CARDS.filter(c => c.k === 'sys')).id, pick(CARDS.filter(c => c.k === 'tech')).id, pick(CARDS.filter(c => c.k === 'goal')).id];
    R.heat = 0;
  }
  R.heat += rnd() * 2.2;
  if (R.heat > 30) {
    // rival publishes; scoop any matching running project
    const t = ideaTitle(R.focus);
    G.arxiv.unshift({ w: G.week, t, a: 'Voss et al.', rival: true });
    for (const pr of G.projects) {
      if (pr.stage === 'running' && pr.cards.filter(c => R.focus.includes(c)).length >= 2 && !pr.rivalCollab) {
        const lead = pr.members.map(person).find(Boolean);
        if (lead) queueVisit({ ev: 'scooped', A: lead.id, proj: pr.id, pri: 2 });
      }
    }
    R.focus = null;
  }
  if (chance(0.5)) G.arxiv.unshift({ w: G.week, t: chance(0.25) ? pick(ARXIV_JOKES) : randomPaperTitle(), a: pick(LAST) + ' et al.' });
  if (G.arxiv.length > 30) G.arxiv.length = 30;

  // careers
  if (w === 1 && G.week > 1) {
    for (const p of team()) if (p.role === 'grad') p.yearIn++;
    G.costIndex = (G.costIndex || 1) * 1.03;
    const b = costBreakdown(); const lines = Object.keys(b).filter(k => b[k]).map(k => `  ${COST_LABELS[k]}: ${fmt$(b[k])}/wk`).join('\n');
    mail('Sponsored Research Office', `Annual budget update, year ${year()}`, `New academic year. Salaries, stipends, tuition and supply prices went up 3%.\n\nYour weekly operating costs are now:\n${lines}\n\nTotal: ${fmt$(weeklyCosts())}/wk. Income from grants: ${fmt$(weeklyIncome())}/wk.`);
  }
  for (const p of team()) {
    if (p.role === 'undergrad' && p.weeks >= ROLES.undergrad.term && !busy(p.id)) queueVisit({ ev: 'ug_graduate', A: p.id });
    if (p.role === 'postdoc' && p.weeks >= ROLES.postdoc.term - 10 && !p.flags.jobAsked) { p.flags.jobAsked = true; queueVisit({ ev: 'postdoc_job', A: p.id }); }
    if (p.role === 'grad' && p.yearIn >= 5 && p.papers >= 2 && !p.flags.defenseAsked && w > 30) { p.flags.defenseAsked = true; queueVisit({ ev: 'defense', A: p.id }); }
    if (p.role === 'grad' && p.yearIn >= 7 && !p.flags.forced) { p.flags.forced = true; queueVisit({ ev: 'defense', A: p.id, forced: true }); }
  }

  // hiring season (spring): applicants
  if (w === 22) { G.applicants = genApplicants(); mail('Graduate Admissions', 'Hiring season is open', `Applications for grad students, postdocs and staff are in. Check the Hiring app. Applicants will accept offers elsewhere by week 34.`); }
  if (w === 35) G.applicants = [];
  if (w === 10 && chance(0.6)) G.applicants.push(...genApplicants(1, 'undergrad'));

  // helium crisis decay
  if (G.flags.heliumCrisis > 0) G.flags.heliumCrisis--;
  for (const k in G.broken) { G.broken[k] -= G.equip.service ? 2 : 1; if (G.broken[k] <= 0) { delete G.broken[k]; hooks.toast(`🔧 ${EQUIP[k].name} is working again.`); } }

  // money trouble
  if (G.money < 0) {
    G.negWeeks++;
    if (G.negWeeks === 1) mail('Department Finance Office', 'URGENT: Your accounts are overdrawn', `Your lab accounts are negative (${fmtK(G.money)}). If this continues for 8 weeks the university will freeze your lab and reassign your students.`);
    if (G.negWeeks >= 8) { G.over = true; hooks.gameOver('broke'); return; }
  } else G.negWeeks = 0;

  // tenure
  if (G.titleIdx === 0 && G.week === 6 * WPY - 4) queueVisit({ ev: 'tenure', ext: 'chair', pri: 5 });
  if (G.titleIdx === 1 && G.rep >= 90 && G.week > 8 * WPY && !G.flags.fullAsked) { G.flags.fullAsked = true; queueVisit({ ev: 'promote_full', ext: 'chair', pri: 3 }); }
  if (G.titleIdx === 2 && G.rep >= 190 && !G.flags.chairAsked) { G.flags.chairAsked = true; queueVisit({ ev: 'endowed', ext: 'donor', pri: 3 }); }
  if (G.landmarks >= 3 && G.rep >= 200 && !G.won && w >= 6 && w <= 10 && !G.flags.nobelThisYear) { G.flags.nobelThisYear = year(); if (chance(0.5)) queueVisit({ ev: 'nobel', ext: 'phone', pri: 9 }, true); }

  // dnd cost: people waiting
  if (G.dnd && G.queue.length) for (const v of G.queue) { const p = v.A && person(v.A); if (p) mod(p, { morale: -2 }); }

  // expire very old low-priority visits
  G.queue = G.queue.filter(v => (v.pri || 0) >= 2 || G.week - v.week < 6);

  hooks.worldSync();
}

const TITLE_A = ['Observation of', 'Evidence for', 'Toward', 'Universal', 'Anomalous', 'Emergent', 'Robust', 'Scalable', 'Programmable', 'Non-Equilibrium'];
export function randomPaperTitle() {
  const s = pick(CARDS.filter(c => c.k === 'sys')), t = pick(CARDS.filter(c => c.k === 'tech')), g = pick(CARDS.filter(c => c.k === 'goal'));
  return chance(0.5) ? `${pick(TITLE_A)} ${g.name} in ${s.name}` : `${t.adj} ${s.name}: ${pick(['a Roadmap', 'First Results', 'Beyond the Standard Limit', 'A Benchmark', 'Theory and Experiment'])}`;
}

export function genApplicants(n, only) {
  const out = [];
  const N = n || int(3, 5);
  for (let i = 0; i < N; i++) {
    const role = only || pick(['grad', 'grad', 'grad', 'postdoc', 'postdoc', 'undergrad', 'staff', 'grad']);
    const p = makePerson(role);
    G.nextId++;
    p.revealed = 1 + (G.rep > 40 ? 1 : 0); // number of traits visible
    p.interviewed = false;
    if (G.flags.betterApplicants) for (const k in p.skill) p.skill[k] = clamp(p.skill[k] + 1, 1, 10);
    p.wants = role === 'undergrad' ? 0 : Math.round(30 - Math.min(25, G.rep * 0.25) + (p.skill.exp + p.skill.theory + p.skill.code) * 1.2);
    out.push(p);
  }
  G.flags.betterApplicants = false;
  return out;
}

export function acceptOfferChance(a) {
  return clamp(0.35 + G.rep * 0.006 + G.culture * 0.003 + (a.interviewed ? a.charm || 0 : 0) - a.wants * 0.006, 0.08, 0.95);
}

// ---------- save ----------
export function save() { try { localStorage.setItem('officehours_save', JSON.stringify(G)); } catch (e) { } }
export function loadSave() { try { const s = localStorage.getItem('officehours_save'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function clearSave() { try { localStorage.removeItem('officehours_save'); } catch (e) { } }
