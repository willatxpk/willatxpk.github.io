// The Calendar app: every day of a professor's life, absolutely packed, colour-coded by kind.
// Events are generated from the real game state (team, projects, grant calls, committees, teaching, HR,
// home life) plus a seeded sprinkle of academic chaos, so a day always looks the same when you come back to it.
// Starred events (★) are decisions: pick how you handle them and it changes the game right away.
import { WPY, GRANTS, EQUIP, HOBBIES, FIRST, LAST } from './data.js';
import { G, clamp, team, person, proj, mod, addRep, log } from './sim.js';

export const CATS = {
  teach:    { n: 'Teaching',          c: '#f39c3c', i: '🍎' },
  lab:      { n: 'Lab & students',    c: '#4a90e2', i: '🧪' },
  research: { n: 'Research & papers', c: '#26c6b0', i: '📄' },
  grants:   { n: 'Grants & money',    c: '#6cc04a', i: '💰' },
  dept:     { n: 'Department',        c: '#9b6ff0', i: '🏛️' },
  admin:    { n: 'Admin & HR',        c: '#e5534b', i: '📋' },
  travel:   { n: 'Travel & talks',    c: '#f2d04a', i: '✈️' },
  home:     { n: 'Home & family',     c: '#ff79b0', i: '🏠' },
  self:     { n: 'You',               c: '#8fa3bf', i: '🧘' },
};
const MONTHS = ['September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- seeded randomness, so a given day never changes ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedBase = () => { if (!G.calSeed) G.calSeed = Math.floor(Math.random() * 1e9); return G.calSeed; };

const termOf = w => w <= 15 ? 'Fall' : w <= 19 ? 'Winter Break' : w <= 36 ? 'Spring' : 'Summer';
const woy = aw => ((aw - 1) % WPY) + 1;
const yearOf = aw => Math.floor((aw - 1) / WPY) + 1;
const fmtH = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const ap = hh >= 12 ? 'pm' : 'am'; const h12 = ((hh + 11) % 12) + 1; return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${ap}`; };

// ---------- flavour ----------
const INSTS = ['MIT', 'Stanford', 'Harvard', 'Berkeley', 'Princeton', 'ETH Zürich', 'Oxford', 'Cambridge', 'the Max Planck Institute', 'Caltech', 'Chicago', 'JILA', 'NIST Boulder', 'Tokyo', 'Delft', 'Waterloo', 'Weizmann', 'the Perimeter Institute', 'Copenhagen', 'Sydney'];
const TALKS = ['Quantum Simulation of Lattice Gauge Theories', 'Dark Matter Searches with Atomic Clocks', 'Twisted Bilayers: The Story So Far', 'Error Correction That Actually Works', 'Gravitational Waves from the Early Universe', 'What Neural Networks Know About Phase Transitions', 'Strange Metals Are Still Strange', 'Optical Tweezer Arrays at Scale', 'Measuring Nothing Very Precisely', 'Topology for Experimentalists', 'Why My Fridge Hates Me', 'Entanglement in Many-Body Systems', 'Physics with 10,000 Ions', 'The Muon g−2 Saga', 'Quantum Sensing in the Wild', 'Black Hole Information, Revisited'];
const COMMITTEES = ['Graduate Admissions', 'Colloquium', 'Space Allocation', 'Undergraduate Curriculum', 'Diversity & Climate', 'Safety', 'Computing', 'Faculty Search', 'Awards', 'Library'];
const TRAININGS = ['Cybersecurity awareness', 'Laser safety refresher', 'Responsible Conduct of Research', 'Export control basics', 'Title IX training', 'Chemical hygiene', 'Cryogen handling', 'Mentoring workshop', 'Procurement card training', 'Data management plans'];
const ADMINS = ['Expense report from the last trip', 'Approve purchase orders', 'Effort certification', 'Update your faculty profile', 'Sign 14 forms in triplicate', 'Renew the lab\'s chemical inventory', 'Reply to the Dean\'s office', 'Mandatory IT restart', 'Fix the shared drive permissions', 'Room booking fight', 'Badge access for new students', 'Lab key inventory'];
const RESEARCH = ['Read arXiv over coffee', 'Referee report due', 'Revise figures', 'Respond to Reviewer 2', 'Write the methods section', 'Proofread a student\'s draft', 'Check a calculation that "can\'t be right"', 'Literature deep-dive', 'Update the group wiki', 'Draft an abstract', 'Look at new data', 'Rerun the fit'];
const HOMES = ['Groceries', 'Laundry', 'Dentist', 'Pay bills', 'Call your parents', 'Fix the leaky faucet', 'Pick up dry cleaning', 'Car inspection', 'Take out the recycling', 'Meal prep'];
const KIDS = ['soccer practice', 'piano lesson', 'science fair', 'school play', 'parent-teacher conference', 'swim meet', 'birthday party', 'field trip permission slip', 'art class', 'dentist'];
const SELFS = ['Gym', 'Sleep in', 'Therapy', 'Doctor\'s appointment', 'Haircut', 'Long walk', 'Read a novel', 'Nap'];

const CHAOS = {
  lab: ['Order more liquid nitrogen', 'Approve undergrad timesheets', 'Fix the printer (again)', 'Poster rehearsal', 'Bake-out check', 'Lab Slack fire', 'Inventory the optics drawer', 'Sign a travel form', 'Someone broke the good oscilloscope', 'New student onboarding', 'Order replacement fiber', 'Laser interlock test', 'Rearrange the bench (political)'],
  research: ['Review a paper for PRL', 'Edit the arXiv preprint', 'Talk to the theorist down the hall', 'Simulation run finishes', 'Code review', 'Figure 3 is still wrong', 'Find a 1987 paper nobody can find', 'Reply to a co-author', 'Error bars meeting', 'Supplementary material (47 pages)', 'Check a reference', 'Rewrite the abstract again'],
  grants: ['Update biosketch', 'Current & pending form', 'Letter of collaboration', 'Cost-share signature', 'Call with a program officer', 'Subaward invoice', 'Budget justification', 'Data management plan', 'Postdoc mentoring plan', 'Facilities statement', 'Check the grant portal (down for maintenance)'],
  dept: ['A hallway chat becomes a meeting', 'Sign a petition', 'Department newsletter interview', 'Search committee Zoom', 'Speaker dinner', 'Teaching evaluations arrive', 'Annual review form', 'Mentor a junior colleague', 'Vote on a curriculum change'],
  admin: ['Password expired', 'Travel reimbursement rejected', 'Parking permit renewal', 'Room booking conflict', 'Fire drill', 'Building closure notice', 'Compliance survey', 'Two-factor login (phone is dead)', 'Purchase order bounced', 'Conflict-of-interest disclosure'],
  travel: ['Book flights for the next conference', 'Visa letter for a student', 'Submit a conference abstract', 'Make slides', 'Hotel block closes today', 'Register for the workshop'],
  teach: ['Answer forum questions', 'Write a problem set', 'Recommendation letter due', 'A student wants an extension', 'Update the course website', 'Regrade request', 'Exam question brainstorm'],
  home: ['Text from home', 'Package delivery window', 'Plumber window (8–12)', 'Vet appointment', 'Return library books', 'Plan the weekend', 'Pay the babysitter'],
  self: ['Drink water', 'Stretch', 'Lunch at your desk', 'Coffee #3', 'Eat something that isn\'t a granola bar', 'Five-minute meditation (attempted)', 'Walk around the block'],
};
const CHAOS_KEYS = Object.keys(CHAOS);
// ---------- event generation ----------
// one day's events: {id, cat, h, dur, t (title), sub, key (decision kind), pid}
const cache = new Map();
export function dayEvents(aw, d) {
  const ck = `${aw}:${d}:${G.week}:${team().length}:${G.calls.length}:${(G.commits || []).length}:${G.hr ? G.hr.left : 0}`;
  if (cache.has(ck)) return cache.get(ck);
  const r = rng(hashStr(`${seedBase()}|${aw}|${d}`));
  const ch = p => r() < p, pk = a => a[Math.floor(r() * a.length)];
  const nm = () => `${pk(FIRST)} ${pk(LAST)}`;
  const w = woy(aw), T = termOf(w), wkInMonth = (w - 1) % 4, weekend = d >= 5;
  const L = G.life || {};
  const E = []; let n = 0;
  const add = (cat, h, dur, t, extra = {}) => E.push({ id: `${aw}-${d}-${n++}`, aw, d, cat, h, dur, t, ...extra });
  const T_ = team();
  const hashId = s => hashStr(s + seedBase());

  if (!weekend) {
    // mornings
    add('admin', 7.5, 0.5, 'Inbox triage', { sub: `${40 + Math.floor(r() * 120)} unread` });
    if (L.kids && L.kids.length) add('home', 8, 0.5, 'School drop-off');
    // teaching
    const teaching = (G.teachLoad || 0) > 0 && (T === 'Fall' || T === 'Spring');
    if (teaching && G.teachLoad >= 5) {
      if (d === 0 || d === 2 || d === 4) add('teach', 10, 1, 'Physics 1 lecture', { sub: '400 students, one working microphone' });
      if (d === 1) add('teach', 15, 1.5, 'Office hours (Physics 1)', { sub: 'Will this be on the exam?' });
      if (d === 3) add('teach', 9, 1, 'TA meeting');
      if (d === 4) add('teach', 13, 2, 'Grading');
      if ((w === 8 || w === 28) && d === 2) add('teach', 19, 2, 'MIDTERM EXAM', { key: 'exam' });
      if ((w === 14 || w === 35) && d === 1) add('teach', 9, 3, 'FINAL EXAM', { key: 'exam' });
    } else if (teaching) {
      if (d === 1 || d === 3) add('teach', 13, 1.5, 'Graduate seminar', { sub: 'Eight brilliant students' });
      if (d === 2) add('teach', 16, 1, 'Grade seminar write-ups');
    } else if (T !== 'Summer' && ch(0.3)) add('teach', 11, 1, pk(['Undergrad advising drop-in', 'Guest lecture for a colleague', 'Write a recommendation letter', 'Meet a prospective major', 'Independent study check-in']));
    // the lab
    if (d === 0 && T_.length) add('lab', 15, 1.5, 'Group meeting', { key: 'group', sub: `${T_.length} people, ${G.projects.filter(p => p.stage === 'running').length} projects` });
    for (const p of T_) {
      if (p.away) continue;
      if (hashId(p.id) % 5 === d) add('lab', 9 + (hashId(p.id + 'h') % 8), 0.5, `1:1 with ${p.first}`, { key: 'oneonone', pid: p.id });
      const bw = hashId(p.id + 'bday') % WPY + 1, bd = hashId(p.id + 'bd') % 5;
      if (bw === w && bd === d) add('lab', 15.5, 0.5, `🎂 ${p.first}'s birthday`, { key: 'bday', pid: p.id });
    }
    for (const pr of G.projects.filter(p => p.stage === 'running')) if (hashId(pr.id) % 5 === d) add('lab', 11 + (hashId(pr.id + 'h') % 5), 1, `Subgroup: ${pr.title.slice(0, 38)}${pr.title.length > 38 ? '…' : ''}`);
    if (d === 3) add('lab', 12, 1, 'Journal club', { sub: 'There is pizza. The pizza is why people come.' });
    if (d === 4 && wkInMonth === 3) add('lab', 16, 1, 'Lab cleanup');
    if (d === 1 && wkInMonth === 0) add('lab', 8.5, 0.5, 'Safety walkthrough');
    const owned = Object.keys(G.equip || {}).filter(k => G.equip[k] && EQUIP[k] && EQUIP[k].cat === 'research');
    if (owned.length && ch(0.35)) { const k = pk(owned); add('lab', 14, 1, `Maintenance: ${EQUIP[k].name}`, { sub: pk(['Vendor visit', 'Swap the pump', 'Realign everything', 'Recalibrate', 'Leak check', 'Firmware update that breaks everything'] ) }); }
    if (T_.length && ch(0.25)) add('lab', 17, 1, pk(['Help debug the experiment', 'Look at a weird signal', 'Approve an order', 'Student wants to talk', 'Undergrad presentation practice', 'Lab lunch']));
    // research
    const run = G.projects.filter(p => p.stage === 'running' || p.stage === 'results');
    add('research', ch(0.5) ? 8 : 19.5, 1.5, run.length ? `Writing block: ${pk(run).title.slice(0, 34)}…` : 'Writing block', { sub: 'Door closed. Phone off. (It won\'t be.)' });
    if (ch(0.6)) add('research', 13 + Math.floor(r() * 4), 1, pk(RESEARCH));
    if (ch(0.35)) add('research', 17, 1, `Zoom with ${nm()} (${pk(INSTS)})`, { sub: 'Collaboration call. Someone is on mute.' });
    // grants
    for (const c of G.calls || []) {
      const gt = GRANTS.find(g => g.id === c.id); if (!gt || c.deadline > G.week + 400) continue;
      if (c.deadline === aw && d === 4) add('grants', 17, 0.5, `DEADLINE: ${gt.name}`, { key: 'deadline', sub: 'Submit in the Grants app' });
      if (c.deadline - 1 === aw && d === 2) add('grants', 12, 0.5, `Internal routing: ${gt.name}`, { sub: 'The grants office wants it a week early' });
      if (c.deadline - 1 === aw && d === 0) add('grants', 19, 3, `Write: ${gt.name}`, { sub: 'Specific aims. Again.' });
    }
    for (const p of G.pending || []) if (p.decide === aw && d === 0) add('grants', 9, 0.25, `Decision expected: ${(GRANTS.find(g => g.id === p.type) || {}).name || 'proposal'}`, { sub: 'Refresh your email every 4 minutes' });
    for (const g of G.grants || []) if (g.reports && hashStr(g.type) % 12 === (w - 1) % 12 && d === 3) add('grants', 10, 2, `Progress report: ${g.name}`);
    if (ch(0.2)) add('grants', 14, 0.5, pk(['Budget meeting with the grants office', 'Reconcile the lab credit card', 'Spending forecast', 'Cost-share paperwork']));
    // department
    if (d === 2 && wkInMonth === 0) add('dept', 12, 1.5, 'Faculty meeting', { key: 'faculty' });
    if (d === 3 && T !== 'Summer' && T !== 'Winter Break') add('dept', 16, 1, `Colloquium: ${pk(TALKS)}`, { key: 'colloq', sub: `${nm()}, ${pk(INSTS)}` });
    if (d === 1 && T !== 'Summer') add('dept', 12, 1, pk(['AMO seminar', 'Condensed matter seminar', 'Theory lunch', 'Astro seminar', 'Student seminar']), { sub: pk(TALKS) });
    (G.commits || []).forEach((u, i) => { if ((d === 1 || d === 2) && (i + d + wkInMonth) % 2 === 0) add('dept', 8, 1, `${COMMITTEES[(hashStr(String(u)) + i) % COMMITTEES.length]} Committee`, { key: 'committee' }); });
    if (w >= 20 && w <= 24 && d < 3) add('dept', 18, 2, 'Read admissions files', { sub: `${20 + Math.floor(r() * 30)} files tonight` });
    for (const p of T_) {
      if (p.role !== 'grad') continue;
      if (p.yearIn === 2 && w === 30 + (hashId(p.id) % 4) && d === 2) add('dept', 10, 2, `${p.first}'s qualifying exam`, { key: 'quals', pid: p.id });
      if (p.yearIn >= 5 && w === 34 + (hashId(p.id) % 8) && d === 4) add('dept', 14, 2, `${p.first}'s thesis defense`, { key: 'defense', pid: p.id });
    }
    if (ch(0.2) && G.profs && G.profs.length) { const f = pk(G.profs); add('dept', 10.5, 0.5, `Coffee with ${f.first} ${f.last}`, { sub: f.field }); }
    if (ch(0.15)) add('dept', 12, 1, pk(['Faculty candidate lunch', 'Department photo', 'Retirement party', 'Town hall with the Dean', 'Alumni visit', 'Prospective grad student visit']));
    // admin and HR
    const H = G.hr;
    if (H && H.left > 0) for (let k = 0; k < H.left; k++) if (H.next + 2 * k === aw && d === 1) add('admin', 14, 1, '🧑‍⚖️ Mandatory HR meeting', { sub: 'Dana from HR. Attendance is recorded.', key: 'hr' });
    if (G.flags && G.flags.probation && G.flags.probation.until === aw && d === 0) add('admin', 9, 1, '⚠️ Probation review', { sub: 'The committee decides this week' });
    if (wkInMonth === 2 && d === 3) add('admin', 15, 1, `Training: ${TRAININGS[(w + yearOf(aw)) % TRAININGS.length]}`, { sub: 'Mandatory. There is a quiz.' });
    if (ch(0.55)) add('admin', 16.5, 0.5, pk(ADMINS));
    // travel
    if (w === 26 && d < 5) add('travel', 8, 9, 'APS March Meeting', { key: d === 1 ? 'talk' : null, sub: '12,000 physicists, one convention center' });
    if (w === 37 && d < 4) add('travel', 8, 9, 'DAMOP', { key: d === 1 ? 'talk' : null });
    if (w === 42 && d < 5) add('travel', 8, 9, 'Gordon Research Conference', { sub: 'New Hampshire. No slides allowed in the photos.', key: d === 2 ? 'talk' : null });
    if (G.rep > 20 && ch(Math.min(0.06, G.rep / 3000))) add('travel', 11, 1, `Invited talk at ${pk(INSTS)}`, { key: 'talk' });
    if (ch(0.05)) add('travel', 9, 8, pk(['Review panel (Virginia)', 'Site visit', 'Program review in DC', 'Workshop in Santa Barbara']));
    // home and you (evenings)
    if (L.partner) {
      if (d === 4 && wkInMonth % 2 === 1) add('home', 19.5, 2, `Date night with ${L.partner.first}`, { key: 'date' });
      else if (ch(0.4)) add('home', 18.5, 1, `Dinner with ${L.partner.first}`);
      const pbw = hashStr(L.partner.first + seedBase()) % WPY + 1;
      if (pbw === w && d === 2) add('home', 19, 2, `🎂 ${L.partner.first}'s birthday`, { key: 'pbday' });
    }
    for (const k of L.kids || []) if (ch(0.3)) add('home', 16.5, 1.5, `${k.first}'s ${pk(KIDS)}`, { key: 'kid', kid: k.first });
    if (L.hobbyTime && (d === 1 || d === 3)) { const h = HOBBIES[L.hobby]; if (h && !(L.footUntil > G.week)) add('self', 18, 1.5, `${h.icon} ${h.name}`, { key: 'hobby' }); }
    if (L.footUntil > aw && d === 2) add('self', 12.5, 0.5, '🦶 Physical therapy');
    if (ch(0.25)) add('self', 12, 0.5, pk(SELFS));
    if (ch(0.3)) add('home', 20.5, 0.5, pk(HOMES));
    add('research', 22, 1, pk(['Answer the emails you ignored', 'Late-night arXiv', 'One more plot', 'Stare at the ceiling thinking about the fit']));
  } else {
    // weekends: officially off
    if (ch(0.6)) add('research', 9, 2, pk(['Catch up on reviews', 'Weekend grant writing', 'Finish the paper draft', 'Read three theses']));
    if (ch(0.3)) add('lab', 14, 1, pk(['Lab emergency: the chiller alarm', 'Student texts you a plot', 'Check the overnight run', 'Fridge warmed up. Of course.']));
    if (L.partner) add('home', d === 5 ? 10 : 18, 2, d === 5 ? `Brunch with ${L.partner.first}` : 'Family dinner', { key: d === 6 ? 'family' : null });
    for (const k of L.kids || []) add('home', 11, 2, `${k.first}'s ${pk(['soccer game', 'swim meet', 'birthday party', 'museum trip', 'play date'])}`, { key: ch(0.5) ? 'kid' : null, kid: k.first });
    if (L.hobbyTime) { const h = HOBBIES[L.hobby]; if (h && !(L.footUntil > G.week)) add('self', 15, 2, `${h.icon} ${h.name}`, { key: 'hobby' }); }
    add('home', 13, 1, pk(HOMES));
    add('self', 8, 1, pk(SELFS));
    if (ch(0.3)) add('dept', 19, 2, pk(['Colleague\'s dinner party', 'Department BBQ', 'Lab game night', 'Faculty book club']));
    if (G.calls && G.calls.some(c => c.deadline === aw || c.deadline === aw + 1)) add('grants', 10, 6, 'Grant writing (deadline is close)');
  }
  // and the everyday chaos that fills every gap
  const extra = weekend ? 2 + Math.floor(r() * 3) : 5 + Math.floor(r() * 4);
  for (let i = 0; i < extra; i++) {
    let cat = pk(CHAOS_KEYS);
    if (cat === 'teach' && (T === 'Summer' || T === 'Winter Break')) cat = 'research';
    if (weekend && ['dept', 'admin', 'teach'].includes(cat)) cat = pk(['home', 'self', 'research']);
    if (cat === 'home' && !L.partner && !(L.kids && L.kids.length) && ch(0.5)) cat = 'self';
    add(cat, (weekend ? 9 : 7.5) + Math.floor(r() * 26) / 2, pk([0.25, 0.25, 0.5, 0.5, 1]), pk(CHAOS[cat]));
  }
  E.sort((a, b) => a.h - b.h || a.dur - b.dur);
  // flag double-bookings
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if (E[j].h < E[i].h + E[i].dur - 0.01) { E[i].clash = true; E[j].clash = true; }
  if (cache.size > 2000) cache.clear();
  cache.set(ck, E);
  return E;
}

// ---------- decisions ----------
const Lf = () => G.life;
const home = n => { const L = Lf(); if (L) L.home = clamp(L.home + n, 0, 100); };
const self = n => { const L = Lf(); if (L) L.self = clamp(L.self + n, 0, 100); };
const energy = n => { G.energy = clamp(G.energy + n, 0, 100); };
const goodwill = n => { G.goodwill = clamp(G.goodwill + n, 0, 100); };
const culture = n => { G.culture = clamp(G.culture + n, 0, 100); };
// energy you can claw back by skipping things is capped per step, so the calendar isn't a free energy pump
const stepKey = () => Math.floor((G.week - 1) / (G.timeStep === 'week' ? 1 : 4));
function rest(n) {
  const C = calState(); const k = stepKey();
  if (C.restStep !== k) { C.restStep = k; C.rested = 0; }
  const g = Math.max(0, Math.min(n, 8 - C.rested)); C.rested += g; energy(g);
  return g ? ` (+${g} energy)` : ' (no more energy to win back this month)';
}
const p_ = e => e.pid ? person(e.pid) : null;
const KINDS = {
  group: e => [
    { t: 'Run it properly', h: '−3 energy · lab culture ↑ · morale ↑', fx: () => { energy(-3); culture(1.5); for (const p of team()) mod(p, { morale: 1 }); return 'Everyone presents. Someone asks a good question. It runs 20 minutes over.'; } },
    { t: 'Let a senior student run it', h: '−1 energy · a postdoc or senior grad grows', fx: () => { energy(-1); const s = team().find(p => p.role === 'postdoc') || team().find(p => p.role === 'grad'); if (s) mod(s, { morale: 4, skill: { theory: 1 } }); return s ? `${s.first} runs it better than you do. Don't tell anyone.` : 'Nobody wants to. You run it anyway.'; } },
    { t: 'Cancel it', h: 'Energy back · culture ↓', fx: () => { culture(-1.5); return 'The Slack channel goes very quiet.' + rest(3); } },
  ],
  oneonone: e => { const p = p_(e); return p ? [
    { t: 'Keep it, full attention', h: `−1 energy · ${p.first}'s morale and loyalty ↑`, fx: () => { energy(-1); mod(p, { morale: 3, loyalty: 2, stress: -2 }); return `${p.first} leaves with a plan and looks relieved.`; } },
    { t: 'Make it a walking 1:1', h: `You feel better · ${p.first}'s morale ↑`, fx: () => { self(2); mod(p, { morale: 2, stress: -3 }); return 'Two laps around the quad. Better ideas than in the office.'; } },
    { t: 'Cancel ("something came up")', h: `Energy back · ${p.first}'s morale ↓`, fx: () => { mod(p, { morale: -3, loyalty: -1 }); return `${p.first} says "no worries!" in a way that has worries.` + rest(1); } },
  ] : null; },
  bday: e => { const p = p_(e); return p ? [
    { t: 'Bring a cake for the lab', h: `$60 · ${p.first}'s morale ↑↑ · culture ↑`, fx: () => { G.money -= 60; mod(p, { morale: 7, loyalty: 3 }); culture(1); return `${p.first} pretends to be embarrassed. Everyone gets frosting on the optical table.`; } },
    { t: 'Sign the card', h: `${p.first}'s morale ↑ a little`, fx: () => { mod(p, { morale: 2 }); return 'You write "Happy birthday! Great work this year." Classic.'; } },
    { t: 'Forget', h: `${p.first}'s morale ↓`, fx: () => { mod(p, { morale: -3 }); return 'You find out the next day. The card is still on your desk.'; } },
  ] : null; },
  faculty: () => [
    { t: 'Go and speak up', h: '−3 energy · goodwill ↑↑', fx: () => { energy(-3); goodwill(2.5); return 'You make one reasonable point. The chair nods at you twice.'; } },
    { t: 'Go and stay quiet', h: '−1 energy · goodwill ↑', fx: () => { energy(-1); goodwill(0.8); return 'Ninety minutes about parking. You survive.'; } },
    { t: 'Skip it', h: 'Energy back · goodwill ↓', fx: () => { goodwill(-2); return 'Your absence is noted. In the minutes.' + rest(2); } },
  ],
  colloq: () => [
    { t: 'Go and ask a question', h: '−2 energy · reputation ↑', fx: () => { energy(-2); addRep(0.6); return 'The speaker says "great question". They mean it, probably.'; } },
    { t: 'Go and answer email in the back', h: '−1 energy', fx: () => { energy(-1); return 'You clear 30 emails. You absorb one slide.'; } },
    { t: 'Skip it', h: 'Energy back · goodwill ↓ a little', fx: () => { goodwill(-0.5); return 'The host counts heads.' + rest(1); } },
  ],
  committee: () => [
    { t: 'Do the reading first', h: '−3 energy · goodwill ↑', fx: () => { energy(-3); goodwill(1.5); return 'You are the only one who read it. Everyone notices.'; } },
    { t: 'Wing it', h: 'Goodwill ↓ a little', fx: () => { goodwill(-0.5); return 'You say "I agree with what was said" four times.'; } },
  ],
  exam: () => [
    { t: 'Proctor it yourself', h: '−4 energy · goodwill ↑', fx: () => { energy(-4); goodwill(1); return 'Three hours of pencil sounds. One student asks if g is 10.'; } },
    { t: 'Leave it to the TAs', h: 'Goodwill ↓ a little', fx: () => { goodwill(-0.5); return 'The TAs handle it. One of them sends you a very long email afterwards.'; } },
  ],
  quals: e => { const p = p_(e); return p ? [
    { t: 'Prep them the week before', h: `−4 energy · ${p.first}'s stress ↓ · skill ↑`, fx: () => { energy(-4); mod(p, { stress: -8, morale: 3, skill: { theory: 1 } }); return `A mock exam on the whiteboard. ${p.first} is ready.`; } },
    { t: 'Trust them', h: `${p.first}'s stress ↑ a little`, fx: () => { mod(p, { stress: 4 }); return `"You'll be fine," you say. ${p.first} is not sure.`; } },
  ] : null; },
  defense: e => { const p = p_(e); return p ? [
    { t: 'Bring champagne for after', h: `$80 · ${p.first}'s loyalty ↑ · culture ↑`, fx: () => { G.money -= 80; mod(p, { morale: 8, loyalty: 4 }); culture(1); return 'Doctor ' + p.first + '. You get a little choked up.'; } },
    { t: 'Ask one hard question', h: 'Reputation ↑ a little', fx: () => { addRep(0.3); return `${p.first} handles it. You're proud.`; } },
  ] : null; },
  deadline: () => [
    { t: 'Block the whole day to polish', h: '−6 energy · your wellbeing ↓', fx: () => { energy(-6); self(-2); return 'Every figure is perfect. Submit it from the Grants app before the deadline.'; } },
    { t: 'It\'s fine as it is', h: '', fx: () => 'You trust the draft. Submit it from the Grants app.' },
  ],
  talk: () => [
    { t: 'Give the talk yourself', h: '−8 energy · reputation ↑↑', fx: () => { energy(-8); addRep(2); return 'Full room. Two people ask for your slides.'; } },
    { t: 'Send a student to give it', h: 'Their morale and skill ↑ · reputation ↑', fx: () => { const s = team().filter(p => p.role === 'grad' || p.role === 'postdoc').sort((a, b) => b.morale - a.morale)[0]; if (s) mod(s, { morale: 8, skill: { theory: 1 } }); addRep(0.8); return s ? `${s.first} nails it and comes back glowing.` : 'Nobody is ready. The slot goes to someone else.'; } },
    { t: 'Skip it', h: 'Energy back', fx: () => 'You watch the livestream. Nobody livestreams it.' + rest(2) },
  ],
  hr: () => null, // mandatory: Dana comes to you
  date: () => [
    { t: 'Go, phone in your pocket', h: '−2 energy · home ↑↑', fx: () => { energy(-2); home(5); const L = Lf(); if (L) L.kept = (L.kept || 0) + 1; return 'You laugh more than you have in weeks.'; } },
    { t: 'Go, but check email', h: 'Home ↑ a little', fx: () => { home(1); return '"Are you even here?" A fair question.'; } },
    { t: 'Cancel for work', h: 'Energy back · home ↓↓', fx: () => { home(-6); const L = Lf(); if (L) L.missed = (L.missed || 0) + 1; return 'A long silence on the phone.' + rest(2); } },
  ],
  pbday: () => [
    { t: 'Plan something special', h: '$150 · −3 energy · home ↑↑↑', fx: () => { G.money -= 150; energy(-3); home(9); return 'You booked the place from your first date. It still has the terrible lamp.'; } },
    { t: 'Dinner and a card', h: 'Home ↑', fx: () => { home(3); return 'Nice. Safe. Appreciated.'; } },
    { t: 'Work late', h: 'Home ↓↓↓', fx: () => { home(-10); const L = Lf(); if (L) L.missed = (L.missed || 0) + 1; return 'You will hear about this for a while.'; } },
  ],
  kid: e => [
    { t: `Be there for ${e.kid}`, h: '−2 energy · home ↑↑ · you feel better', fx: () => { energy(-2); home(4); self(2); const L = Lf(); if (L) L.kept = (L.kept || 0) + 1; return `${e.kid} spots you from across the room and waves like crazy.`; } },
    { t: 'Send a text, stay at work', h: 'Home ↓', fx: () => { home(-4); const L = Lf(); if (L) L.missed = (L.missed || 0) + 1; return `${e.kid} says it's fine. It's not quite fine.`; } },
  ],
  family: () => [
    { t: 'Phones in a basket', h: 'Home ↑ · you feel better', fx: () => { home(3); self(2); return 'Nobody mentions physics for two hours. Remarkable.'; } },
    { t: 'Eat fast, back to the laptop', h: 'Home ↓', fx: () => { home(-3); return 'The plate is cleared before dessert.'; } },
  ],
  hobby: () => [
    { t: 'Go, no excuses', h: 'You feel better · −1 energy', fx: () => { energy(-1); self(4); return 'Your brain finally goes quiet.'; } },
    { t: 'Skip it to work', h: 'Energy back · you feel worse', fx: () => { self(-3); return 'One more hour of work. It wasn\'t a good hour.' + rest(1); } },
  ],
};
export function calState() { return G.cal || (G.cal = { done: {}, restStep: -1, rested: 0 }); }
const decidable = e => e.key && KINDS[e.key] && e.aw >= G.week && e.aw < G.week + 12;
function optsFor(e) { const f = KINDS[e.key]; return f ? f(e) : null; }
function decide(e, i) {
  const C = calState(); if (C.done[e.id]) return;
  const o = (optsFor(e) || [])[i]; if (!o) return;
  const res = o.fx();
  C.done[e.id] = { i, t: o.t, res };
  // forget decisions from long ago
  for (const k in C.done) if (+k.split('-')[0] < G.week - WPY * 2) delete C.done[k];
  log(`Calendar: ${e.t} → ${o.t}.`);
}

// ---------- the app ----------
const S = { am: null, view: 'month', sel: null, ev: null, off: {} };
const monthWeeks = am => [0, 1, 2, 3].map(i => am * 4 + 1 + i);
const curAm = () => Math.floor((G.week - 1) / 4);
const visible = e => !S.off[e.cat];

function chipHtml(e, done) {
  const c = CATS[e.cat];
  return `<div class="cchip${e.clash ? ' clash' : ''}" style="--cc:${c.c}" data-ev="${e.id}" title="${esc(fmtH(e.h) + ' ' + e.t)}"><i>${fmtH(e.h)}</i> ${esc(e.t)}${e.key && KINDS[e.key] && optsFor(e) ? (done ? ' ✓' : ' ★') : ''}</div>`;
}
function dayCell(aw, d, compact) {
  const E = dayEvents(aw, d).filter(visible), C = calState();
  const past = aw < G.week;
  const dom = (aw - 1) % 4 * 7 + d + 1;
  const sel = S.sel && S.sel.aw === aw && S.sel.d === d;
  const stars = E.filter(e => decidable(e) && optsFor(e) && !C.done[e.id]).length;
  const max = compact ? 99 : 7;
  return `<div class="cday${past ? ' past' : ''}${aw === G.week ? ' now' : ''}${sel ? ' sel' : ''}${d >= 5 ? ' wkend' : ''}" data-day="${aw},${d}">
    <div class="cdh"><b>${dom}</b>${stars ? `<span class="cstar">★${stars}</span>` : ''}<span class="ccount">${E.length}</span></div>
    <div class="cdots">${E.map(e => `<span style="background:${CATS[e.cat].c}"></span>`).join('')}</div>
    <div class="cchips">${E.slice(0, max).map(e => chipHtml(e, !!C.done[e.id])).join('')}${E.length > max ? `<div class="cmore">+${E.length - max} more</div>` : ''}</div>
  </div>`;
}
function agenda() {
  if (!S.sel) return '';
  const { aw, d } = S.sel; const E = dayEvents(aw, d), C = calState();
  const dom = (aw - 1) % 4 * 7 + d + 1;
  const shown = E.filter(visible);
  const clashes = E.filter(e => e.clash).length;
  const hours = E.reduce((s, e) => s + e.dur, 0);
  return `<div class="cag" id="calAgenda">
    <h3>${DAYS[d]} ${MONTHS[Math.floor((aw - 1) / 4) % 12]} ${dom} <span class="muted">· ${E.length} events · ${hours.toFixed(1)} hours booked${clashes ? ` · <span class="neg">${clashes} double-booked</span>` : ''}${aw < G.week ? ' · in the past' : ''}</span></h3>
    ${shown.map(e => {
      const c = CATS[e.cat], done = C.done[e.id], opts = e.key ? optsFor(e) : null, open = S.ev === e.id;
      const can = opts && decidable(e) && !done;
      return `<div class="cevt${open ? ' open' : ''}" style="--cc:${c.c}" data-evt="${e.id}">
        <div class="cet"><span class="cetime">${fmtH(e.h)}–${fmtH(e.h + e.dur)}</span><b>${esc(e.t)}</b>${e.clash ? '<span class="cwarn" title="Overlaps another event">⚠️ clash</span>' : ''}${can ? '<span class="cstar">★ decide</span>' : ''}${done ? '<span class="pos">✓</span>' : ''}</div>
        <div class="ces">${c.i} ${c.n}${e.sub ? ' · ' + esc(e.sub) : ''}</div>
        ${open && can ? `<div class="copts">${opts.map((o, i) => `<button data-opt="${i}"><b>${esc(o.t)}</b>${o.h ? `<span>${esc(o.h)}</span>` : ''}</button>`).join('')}</div>` : ''}
        ${open && e.key === 'hr' ? '<div class="ces">This one is mandatory. Dana will come to your office.</div>' : ''}
        ${open && e.key === 'deadline' ? '<div class="copts"><button data-goto="grants"><b>Open the Grants app</b></button></div>' : ''}
        ${done ? `<div class="cres">You chose: <b>${esc(done.t)}</b>. ${esc(done.res || '')}</div>` : ''}
        ${open && opts && !can && !done ? `<div class="ces muted">${e.aw < G.week ? 'Too late to change this one.' : 'Too far ahead to plan yet.'}</div>` : ''}
      </div>`;
    }).join('') || '<p class="muted">Nothing showing. Turn some categories back on.</p>'}
  </div>`;
}
export function renderCalendar() {
  if (S.am === null) S.am = curAm();
  if (!S.sel) S.sel = { aw: G.week, d: 0 };
  const am = S.am, wks = monthWeeks(am), C = calState();
  const all = []; for (const aw of wks) for (let d = 0; d < 7; d++) all.push(...dayEvents(aw, d));
  const vis = all.filter(visible);
  const waiting = all.filter(e => decidable(e) && optsFor(e) && !C.done[e.id]).length;
  const clashes = all.filter(e => e.clash).length;
  const legend = Object.entries(CATS).map(([k, c]) => { const n = all.filter(e => e.cat === k).length; return `<button class="cleg${S.off[k] ? ' off' : ''}" data-cat="${k}" style="--cc:${c.c}"><span></span>${c.n} <i>${n}</i></button>`; }).join('');
  const nowWeek = S.view === 'week' ? (wks.includes(S.sel.aw) ? S.sel.aw : wks[0]) : null;
  let grid;
  if (S.view === 'week') {
    grid = `<div class="cgrid cweek">${DAYS.map((n, d) => `<div class="cwh">${n}</div>`).join('')}${[0, 1, 2, 3, 4, 5, 6].map(d => dayCell(nowWeek, d, true)).join('')}</div>`;
  } else {
    grid = `<div class="cgrid">${DAYS.map(n => `<div class="cwh">${n}</div>`).join('')}${wks.map(aw => [0, 1, 2, 3, 4, 5, 6].map(d => dayCell(aw, d, false)).join('')).join('')}</div>`;
  }
  return `<div class="cal">
    <div class="chead">
      <button data-nav="-1" title="Previous ${S.view}">◀</button>
      <h2>${MONTHS[am % 12]} <span class="muted">Year ${Math.floor(am / 12) + 1}${S.view === 'week' ? ` · week ${wks.indexOf(nowWeek) + 1}` : ''}</span></h2>
      <button data-nav="1" title="Next ${S.view}">▶</button>
      <button data-today="1">Today</button>
      <span class="sp"></span>
      <div class="cview"><button data-view="month" class="${S.view === 'month' ? 'on' : ''}">Month</button><button data-view="week" class="${S.view === 'week' ? 'on' : ''}">Week</button></div>
    </div>
    <div class="cstats">${all.length} events this month · ${Math.round(all.reduce((s, e) => s + e.dur, 0))} hours booked · <span class="neg">${clashes} double-bookings</span> · <span class="cstar">★ ${waiting} decision${waiting === 1 ? '' : 's'} waiting</span>${vis.length < all.length ? ` · showing ${vis.length}` : ''}</div>
    <div class="clegend">${legend}</div>
    ${grid}
    ${agenda()}
  </div>`;
}
export function bindCalendar(body, rerender, after) {
  const re = () => { rerender(); after && after(); };
  body.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { S.off[b.dataset.cat] = !S.off[b.dataset.cat]; re(); });
  body.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.view = b.dataset.view; if (S.view === 'week' && !monthWeeks(S.am).includes(S.sel.aw)) S.sel = { aw: monthWeeks(S.am)[0], d: 0 }; re(); });
  body.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const dir = +b.dataset.nav;
    if (S.view === 'week') {
      const aw = Math.max(1, S.sel.aw + dir); S.sel = { aw, d: S.sel.d }; S.am = Math.floor((aw - 1) / 4);
    } else { S.am = Math.max(0, S.am + dir); const w0 = monthWeeks(S.am)[0]; S.sel = { aw: w0, d: 0 }; }
    S.ev = null; re();
  });
  const today = body.querySelector('[data-today]'); if (today) today.onclick = () => { S.am = curAm(); S.sel = { aw: G.week, d: 0 }; S.ev = null; re(); };
  body.querySelectorAll('.cday').forEach(c => c.onclick = ev => {
    const [aw, d] = c.dataset.day.split(',').map(Number);
    const chipEl = ev.target.closest('[data-ev]');
    S.sel = { aw, d }; S.ev = chipEl ? chipEl.dataset.ev : null;
    re();
    const tgt = S.ev ? body.querySelector(`[data-evt="${S.ev}"]`) : body.querySelector('#calAgenda');
    if (tgt && tgt.scrollIntoView) tgt.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  body.querySelectorAll('.cevt').forEach(el => el.onclick = ev => {
    if (ev.target.closest('button')) return;
    S.ev = S.ev === el.dataset.evt ? null : el.dataset.evt; re();
  });
  body.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
    const id = b.closest('.cevt').dataset.evt; const { aw, d } = S.sel;
    const e = dayEvents(aw, d).find(x => x.id === id); if (e) decide(e, +b.dataset.opt);
    re();
  });
  body.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { S.goto = b.dataset.goto; after && after(b.dataset.goto); });
}
export function calendarBadge() {
  if (!G) return 0;
  const C = calState(); let n = 0;
  const wks = [G.week, G.week + 1, G.week + 2, G.week + 3].slice(0, G.timeStep === 'week' ? 1 : 4);
  for (const aw of wks) for (let d = 0; d < 7; d++) for (const e of dayEvents(aw, d)) if (decidable(e) && optsFor(e) && !C.done[e.id]) n++;
  return n;
}
