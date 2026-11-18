// ===== Kin lives: skills and careers, life dreams, rivals and romance, pets, life stories =====
const SKILLS = {
  farming: { name: 'Farming', icon: '🌾', title: 'Farmer' },
  crafting: { name: 'Crafting', icon: '🔨', title: 'Craftsman' },
  learning: { name: 'Learning', icon: '📚', title: 'Scholar' },
  charisma: { name: 'Charisma', icon: '🗣️', title: 'Host' },
  fighting: { name: 'Fighting', icon: '⚔️', title: 'Warrior' },
  artistry: { name: 'Artistry', icon: '🎨', title: 'Artist' },
};
const SKILL_RANKS = ['Novice', 'Novice', 'Novice', 'Apprentice', 'Apprentice', 'Journeyman', 'Journeyman', 'Expert', 'Expert', 'Master', 'Grandmaster'];
const SKILL_OF = { healer: 'learning', hospital: 'learning', library: 'learning', university: 'learning', researchlab: 'learning', datacenter: 'learning', amphitheater: 'artistry',
  temple: 'charisma', tavern: 'charisma', market: 'charisma', bank: 'charisma', guildhall: 'charisma', office: 'charisma', stadium: 'charisma', barracks: 'fighting' };
function skillOf(type) {
  if (SKILL_OF[type]) return SKILL_OF[type]; const d = B[type]; if (!d) return 'crafting';
  if (d.cat === 'food') return 'farming'; if (d.cat === 'military') return 'fighting'; if (d.prod && d.prod.knowledge) return 'learning'; if (d.cat === 'civic') return 'charisma'; return 'crafting';
}
function skillXp(k, s) { return (k.skills && k.skills[s]) || 0; }
function skillLv(k, s) { return Math.min(10, Math.floor(Math.sqrt(skillXp(k, s) / 1.6))); }
function skillProg(k, s) { const L = skillLv(k, s); if (L >= 10) return 1; const a = 1.6 * L * L, b = 1.6 * (L + 1) * (L + 1); return (skillXp(k, s) - a) / (b - a); }
function bestSkill(k) { let best = 'farming', lv = -1; for (const s in SKILLS) { const l = skillLv(k, s); if (l > lv || (l === lv && skillXp(k, s) > skillXp(k, best))) { lv = l; best = s; } } return { s: best, lv: Math.max(0, lv) }; }
function aAn(w) { return /^[AEIOU]/.test(w) ? 'an' : 'a'; }
function skillTitle(k, s) { const L = skillLv(k, s); return `${SKILL_RANKS[L]} ${SKILLS[s].title}`; }
// e.g. "Expert Farmer" for a kin's current job
const OCCUPATION = { farm: 'Farmer', fishery: 'Fisher', hunter: 'Hunter', lumber: 'Woodcutter', quarry: 'Stonecutter', mine: 'Miner', coalmine: 'Coal Miner', workshop: 'Smith', factory: 'Factory Hand',
  library: 'Librarian', temple: 'Priest', tavern: 'Innkeeper', market: 'Trader', healer: 'Healer', hospital: 'Doctor', university: 'Professor', researchlab: 'Scientist', bank: 'Banker', guildhall: 'Guildsman',
  amphitheater: 'Performer', harbor: 'Docker', powerplant: 'Engineer', office: 'Clerk', datacenter: 'Programmer', stadium: 'Athlete', hydrofarm: 'Grower', granary: 'Miller', warehouse: 'Porter', windmill: 'Miller' };
function jobTitle(k) {
  if (k.soldier) return `${SKILL_RANKS[skillLv(k, 'fighting')]} Soldier`;
  const b = k.job && G.buildings[k.job]; if (!b) return '';
  return `${SKILL_RANKS[skillLv(k, skillOf(b.type))]} ${OCCUPATION[b.type] || B[b.type].name + ' Worker'}`;
}
function skillMult(k, b) { return 1 + 0.05 * skillLv(k, skillOf(b.type)); }
function learnRate(k, s) {
  let r = 1; const t = k.traits;
  if (t.includes('curious')) r *= s === 'learning' ? 1.6 : 1.15;
  if (t.includes('hardworking')) r *= 1.25; if (t.includes('lazy')) r *= 0.7;
  if (s === 'artistry' && t.includes('artistic')) r *= 1.8;
  if (s === 'charisma' && t.includes('social')) r *= 1.5;
  if (s === 'fighting' && t.includes('brave')) r *= 1.4;
  if (s === 'farming' && t.includes('greenthumb')) r *= 1.4;
  if (k.age < 25) r *= 1.2; if (isElder(k)) r *= 0.7;
  return r;
}
function addSkill(k, s, xp) {
  k.skills = k.skills || {};
  const before = skillLv(k, s);
  k.skills[s] = (k.skills[s] || 0) + xp;
  const after = skillLv(k, s);
  if (after > before) onSkillUp(k, s, after);
}
function onSkillUp(k, s, lv) {
  const S = SKILLS[s];
  bubble(k, '⭐');
  if (lv === 5 || lv === 7 || lv >= 9) {
    const t = `${SKILL_RANKS[lv]} ${S.title}`;
    remember(k, `Became ${aAn(t)} ${t}`, S.icon);
    addMod(lv >= 9 ? 'Mastered a craft' : 'Getting really good at this', lv >= 9 ? 12 : 6, 5, k.id);
    if (lv >= 9) { addLog(`🏅 ${kinName(k)} is now ${aAn(t)} ${t}! (+3 👑)`, 'good'); gain('influence', 3); }
    else addLog(`${S.icon} ${kinName(k)} became ${aAn(t)} ${t}.`, 'info');
  }
}

// ---------- Life stages ----------
function lifeStage(k) { return k.age < 3 ? 'Baby' : k.age < 13 ? 'Child' : k.age < 16 ? 'Teen' : k.age < 62 ? 'Adult' : 'Elder'; }
const STAGE_ICON = { Baby: '👶', Child: '🧒', Teen: '🧑', Adult: '🧑', Elder: '🧓' };

// ---------- Life story ----------
function remember(k, text, icon) {
  k.story = k.story || [];
  k.story.push({ d: G.time.day, t: text, i: icon || '•' });
  if (k.story.length > 18) k.story.splice(2, 1); // keep where they came from, forget the oldest middle chapters
}
function initLife(k, o) {
  k.skills = {}; k.rivals = {}; k.counts = {}; k.story = []; k.asp = null; k.aspCd = randi(1, 4); k.dreams = 0; k.pet = null;
  if (o.parents && o.parents.length) {
    for (const s in SKILLS) { const avg = o.parents.reduce((a, p) => a + skillXp(p, s), 0) / o.parents.length; if (avg > 0) k.skills[s] = Math.min(12, avg * 0.15); }
    remember(k, `Born to ${o.parents.map(p => p.name).join(' and ')}`, '👶');
  } else if (G.time.day <= 1) remember(k, `One of the founders of ${G.realm.name}`, '🏛️');
  else { remember(k, `Arrived in ${G.realm.name}`, '🧳'); k.counts.arrived = G.time.day; }
  // grown-ups arrive with some experience
  if (!o.parents && k.age > 18) { const yrs = Math.min(30, k.age - 16); const s = pick(Object.keys(SKILLS).filter(x => x !== 'fighting' || k.traits.includes('brave'))); k.skills[s] = 1.6 * Math.min(25, yrs * 0.6); }
}
function ensureLife(k) { if (!k.skills) initLife(k, {}); k.rivals = k.rivals || {}; k.counts = k.counts || {}; k.story = k.story || []; }

// ---------- Speech bubbles (visual only, not saved) ----------
const BUBBLES = new Map();
function bubble(k, e, secs) { BUBBLES.set(k.id, { e, until: R.t + (secs || 3.2) }); }
function socialMoment(a, b, leisure) {
  const fr = a.friends[b.id] || 0;
  const clash = TRAIT_CLASH.some(([x, y]) => (a.traits.includes(x) && b.traits.includes(y)) || (a.traits.includes(y) && b.traits.includes(x)));
  if (fr < 55 && Math.random() < (clash ? 0.045 : 0.006) * (leisure ? 1 : 0.6)) { argue(a, b); return; }
  if (Math.random() < 0.03) {
    if (a.partner === b.id) { bubble(a, '❤️'); bubble(b, '😊'); }
    else if (!isAdult(a) && !isAdult(b)) bubble(a, pick(['⚽', '😆', '🪁']));
    else if (fr > 60) { bubble(a, pick(['😂', '🍻', '🎵'])); bubble(b, pick(['😄', '👍'])); }
    else bubble(a, pick(['👋', '🙂', '☕']));
  }
}
const TRAIT_CLASH = [['hardworking', 'lazy'], ['cheerful', 'gloomy'], ['brave', 'timid'], ['social', 'loner'], ['devout', 'curious'], ['artistic', 'hardworking']];
function argue(a, b) {
  const before = a.rivals[b.id] || 0;
  a.rivals[b.id] = Math.min(100, before + 12); b.rivals[a.id] = Math.min(100, (b.rivals[a.id] || 0) + 12);
  a.friends[b.id] = Math.max(0, (a.friends[b.id] || 0) - 10); b.friends[a.id] = Math.max(0, (b.friends[a.id] || 0) - 10);
  bubble(a, '😠'); bubble(b, '💢');
  if (before < 40 && a.rivals[b.id] >= 40) {
    addLog(`😠 ${kinName(a)} and ${kinName(b)} can't stand each other — they are now rivals.`, 'info');
    remember(a, `Fell out with ${b.name}`, '😠'); remember(b, `Fell out with ${a.name}`, '😠');
  }
}
function rivalOf(k) { let best = null, v = 39; for (const id in k.rivals || {}) if (k.rivals[id] > v) { const o = kinById(+id); if (o) { v = k.rivals[id]; best = o; } } return best; }
function bondLabel(v) { return v >= 75 ? 'Best friend' : v >= 45 ? 'Good friend' : v >= 20 ? 'Friend' : 'Acquaintance'; }
function goodFriends(k) { let n = 0; for (const id in k.friends) if (k.friends[id] >= 45 && +id !== k.partner) n++; return n; }
function childrenOf(k) { return G.kin.filter(c => c.parents.includes(k.id)); }
function grandkids(k) { const kids = childrenOf(k).map(c => c.id); return G.kin.filter(g => g.parents.some(p => kids.includes(p))).length; }

// ---------- Life dreams (aspirations) ----------
const ASPIRATIONS = {
  family: { name: 'Big Family', icon: '👪', desc: 'Raise three children', need: 3, prog: k => childrenOf(k).length, w: k => k.partner ? 3 : 1.2 },
  master: { name: 'Master of a Craft', icon: '🏅', desc: 'Become a Master (level 9) at any skill', need: 9, prog: k => bestSkill(k).lv, w: k => k.traits.includes('hardworking') ? 4 : 1.5 },
  love: { name: 'True Love', icon: '💞', desc: 'Marry and share 20 days of married life', need: 20, prog: k => k.married && k.partner ? G.time.day - k.married : 0, w: k => k.age < 45 ? (k.traits.includes('social') ? 2.5 : 1.5) : 0.3 },
  popular: { name: 'Life of the Party', icon: '🎉', desc: 'Have five good friends', need: 5, prog: k => goodFriends(k), w: k => k.traits.includes('social') ? 4 : k.traits.includes('loner') ? 0.2 : 1.2 },
  scholar: { name: 'Seeker of Knowledge', icon: '📖', desc: 'Reach Learning 6', need: 6, prog: k => skillLv(k, 'learning'), w: k => k.traits.includes('curious') ? 4 : 0.7 },
  home: { name: 'Fine Living', icon: '🏡', desc: 'Live in a Townhouse or finer home', need: 4, prog: k => homeOf(k) ? homeOf(k).level : 0, w: () => 1.4 },
  faith: { name: 'Devotion', icon: '🙏', desc: 'Spend 40 hours in worship', need: 40, prog: k => k.counts.worship || 0, w: k => k.traits.includes('devout') ? 5 : countB('temple') ? 0.6 : 0.15 },
  hero: { name: 'Defender of the Realm', icon: '🛡️', desc: 'Serve 25 days as a soldier', need: 25, prog: k => k.counts.soldier || 0, w: k => k.traits.includes('brave') ? 4 : k.traits.includes('timid') ? 0 : 0.5 },
  artist: { name: 'Great Artist', icon: '🎨', desc: 'Create three works of art', need: 3, prog: k => k.counts.art || 0, w: k => k.traits.includes('artistic') ? 5 : 0.4 },
  dynasty: { name: 'Dynasty', icon: '🌳', desc: 'Live to see a grandchild', need: 1, prog: k => Math.min(1, grandkids(k)), w: k => k.age > 30 && childrenOf(k).length ? 2 : 0.2 },
  goodlife: { name: 'The Good Life', icon: '🍰', desc: 'Spend 12 days in high spirits (mood 75+)', need: 12, prog: k => k.counts.goodDays || 0, w: k => k.traits.includes('glutton') || k.traits.includes('cheerful') ? 3 : 1 },
};
function pickAspiration(k) {
  const done = k.aspDone || [];
  const opts = Object.entries(ASPIRATIONS).filter(([id]) => !done.includes(id)).map(([id, A]) => [id, A.w(k)]).filter(([, w]) => w > 0);
  if (!opts.length) return;
  let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot;
  for (const [id, w] of opts) { r -= w; if (r <= 0) { k.asp = id; break; } }
  if (!k.asp) k.asp = opts[0][0];
  k.aspStart = G.time.day;
  // progress counters start fresh for a new dream
  if (k.asp === 'faith') k.counts.worship = 0; if (k.asp === 'hero') k.counts.soldier = 0; if (k.asp === 'goodlife') k.counts.goodDays = 0; if (k.asp === 'artist') k.counts.art = 0;
}
function aspProgress(k) { const A = ASPIRATIONS[k.asp]; if (!A) return [0, 1]; return [Math.min(A.need, A.prog(k)), A.need]; }
function fulfilDream(k) {
  const A = ASPIRATIONS[k.asp];
  k.dreams = (k.dreams || 0) + 1; k.aspDone = (k.aspDone || []).concat(k.asp);
  remember(k, `Fulfilled a life dream: ${A.name}`, '🌟');
  addLog(`🌟 ${kinName(k)} fulfilled a life dream: ${A.icon} ${A.name}! (+10 👑)`, 'good');
  gain('influence', 10); addMod('My dream came true!', 20, 6, k.id); bubble(k, '🌟', 6);
  G.stats.dreams = (G.stats.dreams || 0) + 1;
  k.asp = null; k.aspCd = 5;
}
// lasting mood from how life is going
function lifeMood(k) {
  let m = Math.min(15, (k.dreams || 0) * 5);
  if (k.married && k.partner) m += 4;
  if (k.pet) m += 4;
  if (rivalOf(k)) m -= 4;
  const h = homeOf(k);
  if (h) m += homeRoadMood(h);
  m += k.commute || 0;
  return m;
}

// a home's road link changes rarely; work it out once per hour per home, not once per resident
const _hrm = new Map(); let _hrmAt = -1;
function homeRoadMood(h) {
  const t = Math.floor(G.time.day * 24 + G.time.hour); if (t !== _hrmAt) { _hrm.clear(); _hrmAt = t; }
  let v = _hrm.get(h.id); if (v === undefined) { v = roadLink(h).linked ? 3 : hubDist(h) > 9 ? -3 : 0; _hrm.set(h.id, v); }
  return v;
}
// ---------- Hourly: learning by doing ----------
function hourlyLife() {
  const best = {};
  for (const k of G.kin) if (k.state === 'work' && k.job && k.dest === k.job) { const b = G.buildings[k.job]; if (b) { const s = k.soldier ? 'fighting' : skillOf(b.type); best[b.id] = Math.max(best[b.id] || 0, skillLv(k, s)); } }
  for (const k of G.kin) {
    if (k.away) continue;
    ensureLife(k);
    const st = k.state;
    if (st === 'work' && k.job && k.dest === k.job) {
      const b = G.buildings[k.job]; if (!b) continue;
      const s = k.soldier ? 'fighting' : skillOf(b.type);
      const mentor = (best[b.id] || 0) >= skillLv(k, s) + 3 ? 1.5 : 1; // working beside a master teaches you faster
      addSkill(k, s, 0.09 * learnRate(k, s) * mentor);
    } else if (st === 'study') addSkill(k, 'learning', 0.12 * learnRate(k, 'learning'));
    else if (st === 'leisure' && k.dest && G.buildings[k.dest]) {
      const t = G.buildings[k.dest].type;
      if (t === 'temple') { k.counts.worship = (k.counts.worship || 0) + 1; addSkill(k, 'charisma', 0.02); }
      else if (t === 'amphitheater' || t === 'stadium') addSkill(k, 'artistry', 0.05 * learnRate(k, 'artistry'));
      else addSkill(k, 'charisma', 0.04 * learnRate(k, 'charisma'));
    } else if (st === 'park' || st === 'stroll' || st === 'play') addSkill(k, 'artistry', 0.025 * learnRate(k, 'artistry'));
  }
}

// ---------- Daily: dreams, romance, rivalries, pets, life events ----------
function dailyLife() {
  for (const k of G.kin) {
    ensureLife(k);
    for (const id in k.rivals) { k.rivals[id] *= 0.97; if (k.rivals[id] < 2 || !kinById(+id)) delete k.rivals[id]; }
    if (k.soldier) k.counts.soldier = (k.counts.soldier || 0) + 1;
    if (k.mood >= 75) k.counts.goodDays = (k.counts.goodDays || 0) + 1;
    const a = Math.floor(k.age), pa = Math.floor(k.age - 0.25);
    if (a !== pa) { if (a === 3) remember(k, 'Took their first steps out of the house', '🚶'); if (a === 13) remember(k, 'Became a teenager', '🧑'); if (a === 16) remember(k, 'Came of age', '🎓'); if (a === 62) remember(k, 'Became an elder', '🧓'); }
    // dreams
    if (k.age >= 13 && !k.asp && --k.aspCd <= 0) pickAspiration(k);
    if (k.asp) { const [p, n] = aspProgress(k); if (p >= n) fulfilDream(k); }
    // commute: home → work
    k.commute = 0; k.cf = 1;
    const h = homeOf(k), j = k.job && G.buildings[k.job];
    if (h && j && !k.soldier) {
      const d = dist(h.x, h.y, j.x, j.y); const linked = roadLink(h).linked && roadLink(j).linked; k.commute = linked ? 2 : d > 14 ? -3 : 0;
      // time lost getting to work (kin who are not drawn walking skip the walk, so it is counted here instead)
      k.cf = 1 - Math.min(0.3, d / (linked ? 6 : 3.5) / 10);
    }
    // pets grow old
    if (k.pet) { k.pet.age = (k.pet.age || 0) + 1; if (k.pet.age > 80 && Math.random() < 0.04) { addLog(`🐾 ${kinName(k)}'s ${k.pet.kind} ${k.pet.name} passed away peacefully.`, 'info'); remember(k, `Said goodbye to ${k.pet.name}`, '🐾'); addMod('Missing my pet', -10, 5, k.id); k.pet = null; } }
    // artists sometimes create something remarkable
    const art = skillLv(k, 'artistry');
    if (isAdult(k) && art >= 4 && Math.random() < 0.003 * art && !G.eventQueue.some(e => e.key === 'masterpiece')) queueEvent('masterpiece', { k: k.id });
  }
  // couples: weddings and breakups
  for (const a of G.kin) {
    if (!a.partner || a.id > a.partner) continue;
    const b = kinById(a.partner); if (!b) continue;
    if (!a.since) {
      // couples who arrive together (founders, settlers, refugees) come already married
      a.since = b.since = G.time.day;
      if (a.surname === b.surname && !a.married) { a.married = b.married = G.time.day; a.friends[b.id] = Math.max(a.friends[b.id] || 0, 75); b.friends[a.id] = Math.max(b.friends[a.id] || 0, 75); remember(a, `Married to ${b.name}`, '💍'); remember(b, `Married to ${a.name}`, '💍'); continue; }
    }
    const bond = ((a.friends[b.id] || 0) + (b.friends[a.id] || 0)) / 2;
    if (!a.married && G.time.day - a.since >= 6 && bond >= 55 && (a.mood + b.mood) / 2 > 45 && Math.random() < 0.12 && !G.eventQueue.some(e => e.key === 'wedding')) { const ask = G.time.day - (G.lastWedAsk || -99) >= 14; if (ask) G.lastWedAsk = G.time.day; queueEvent('wedding', { a: a.id, b: b.id, ask }); }
    else if (!a.married && bond < 18 && Math.random() < 0.08) breakUp(a, b, false);
    else if (a.married && bond < 12 && (a.mood + b.mood) / 2 < 35 && Math.random() < 0.04 && !G.eventQueue.some(e => e.key === 'marriageTrouble')) queueEvent('marriageTrouble', { a: a.id, b: b.id });
  }
  // a personal moment that needs your judgement every week or so
  if (G.time.day >= (G.nextLifeDay || 0) && G.kin.length >= 4) {
    G.nextLifeDay = G.time.day + randi(5, 9);
    const pool = [];
    for (const [key, e] of Object.entries(EVENTS)) if (e.life && e.find) { const d = e.find(); if (d) pool.push([key, d, e.lw || 1]); }
    if (pool.length) {
      let tot = pool.reduce((s, p) => s + p[2], 0), r = Math.random() * tot;
      for (const [key, d, w] of pool) { r -= w; if (r <= 0) { if (G.lastLife !== key) { queueEvent(key, d); G.lastLife = key; } break; } }
    }
  }
}
function marry(a, b, how) {
  a.married = b.married = G.time.day;
  remember(a, `Married ${b.name}`, '💍'); remember(b, `Married ${a.name}`, '💍');
  bubble(a, '💍', 6); bubble(b, '💍', 6);
  a.friends[b.id] = Math.max(a.friends[b.id] || 0, 80); b.friends[a.id] = Math.max(b.friends[a.id] || 0, 80);
  addLog(`💍 ${kinName(a)} and ${kinName(b)} are married!${how === 'grand' ? ' The whole town celebrated.' : ''}`, 'good');
}
function breakUp(a, b, divorce) {
  a.partner = null; b.partner = null; a.married = b.married = null; a.since = b.since = null;
  remember(a, `${divorce ? 'Divorced' : 'Broke up with'} ${b.name}`, '💔'); remember(b, `${divorce ? 'Divorced' : 'Broke up with'} ${a.name}`, '💔');
  addMod('Heartbroken', -12, 6, a.id); addMod('Heartbroken', -12, 6, b.id); bubble(a, '💔', 5); bubble(b, '💔', 5);
  addLog(`💔 ${kinName(a)} and ${kinName(b)} have ${divorce ? 'divorced' : 'broken up'}.`, 'info');
  // one of them moves out if there is room elsewhere
  if (a.home && a.home === b.home) { const alt = Object.values(G.buildings).find(o => B[o.type].housing && o.id !== a.home && houseCap(o) > residents(o).length); if (alt) b.home = alt.id; }
}
// hooks from the rest of the sim
function lifeOnPartner(a, b) { a.since = b.since = G.time.day; remember(a, `Fell in love with ${b.name}`, '💕'); remember(b, `Fell in love with ${a.name}`, '💕'); bubble(a, '💕', 5); bubble(b, '💕', 5); }
function lifeOnBirth(baby, a, b) { remember(a, `Welcomed baby ${baby.name}`, '👶'); remember(b, `Welcomed baby ${baby.name}`, '👶'); bubble(a, '👶', 5); bubble(b, '👶', 5); }
function lifeOnDeath(k) {
  for (const o of G.kin) {
    if (o === k) continue;
    if (o.partner === k.id) remember(o, `Lost ${o.married ? 'their spouse' : 'their love'} ${k.name}`, '🕯️');
    else if (k.parents.includes(o.id)) remember(o, `Lost their child ${k.name}`, '🕯️');
    else if (o.parents.includes(k.id)) remember(o, `Lost their parent ${k.name}`, '🕯️');
    else if ((o.friends[k.id] || 0) >= 45) remember(o, `Lost their friend ${k.name}`, '🕯️');
    if (o.rivals) delete o.rivals[k.id];
  }
}
function kinChip(k) { const b = bestSkill(k); return `<span class="kchip">${STAGE_ICON[lifeStage(k)]} <b>${esc(kinName(k))}</b>, ${Math.floor(k.age)} ${k.traits.map(t => TRAITS[t].icon).join('')}${b.lv >= 3 ? ` · ${SKILLS[b.s].icon} ${skillTitle(k, b.s)}` : ''}</span>`; }

// ---------- Personal decision events ----------
const pickRand = a => a.length ? a[(Math.random() * a.length) | 0] : null;
const freeKin = () => G.kin.filter(k => !k.away);
Object.assign(EVENTS, {
  wedding: {
    random: false, life: true,
    make: d => {
      const a = kinById(d.a), b = kinById(d.b);
      if (!a || !b || a.partner !== b.id || a.married) return null;
      const cost = { food: 20, gold: 15 + 10 * thLevel() };
      return { quiet: d.ask === false, title: '💒 A Wedding', icon: '💒', text: `${kinChip(a)} and ${kinChip(b)} want to marry! How should ${G.realm.name} celebrate?`,
        choices: [
          { label: 'A grand wedding feast', tip: `${costStr(cost)}: the whole town +6 mood for 3 days, the couple +20.`, disabled: !canAfford(cost), fn: () => { pay(cost); marry(a, b, 'grand'); addMod('A wonderful wedding', 6, 3); addMod('Our wedding!', 20, 8, a.id); addMod('Our wedding!', 20, 8, b.id); for (const o of freeKin()) if ((o.friends[a.id] || 0) > 30 || (o.friends[b.id] || 0) > 30) { o.friends[a.id] = (o.friends[a.id] || 0) + 8; o.friends[b.id] = (o.friends[b.id] || 0) + 8; } } },
          { label: 'A simple ceremony', tip: 'Free. The couple +12 mood.', fn: () => { marry(a, b); addMod('Our wedding', 12, 6, a.id); addMod('Our wedding', 12, 6, b.id); } },
          { label: 'Not yet — wait a while', tip: 'They stay partners; they may ask again later.', fn: () => { a.since = b.since = G.time.day; } },
        ] };
    },
  },
  marriageTrouble: {
    random: false, life: true,
    make: d => {
      const a = kinById(d.a), b = kinById(d.b); if (!a || !b || a.partner !== b.id) return null;
      return { title: '💔 A Marriage in Trouble', icon: '💔', text: `${kinChip(a)} and ${kinChip(b)} barely speak any more. The neighbours hear shouting at night.`,
        choices: [
          { label: 'Counselling at the temple', tip: '10 influence: their bond recovers (needs a Temple).', disabled: !countB('temple') || G.res.influence < 10, fn: () => { G.res.influence -= 10; a.friends[b.id] = b.friends[a.id] = 55; addMod('Rekindled', 8, 5, a.id); addMod('Rekindled', 8, 5, b.id); remember(a, `Rekindled things with ${b.name}`, '💞'); remember(b, `Rekindled things with ${a.name}`, '💞'); } },
          { label: 'A holiday together', tip: '15 food + 15 gold: their bond recovers a little, both +8 mood.', disabled: !canAfford({ food: 15, gold: 15 }), fn: () => { pay({ food: 15, gold: 15 }); a.friends[b.id] = b.friends[a.id] = 40; addMod('A lovely holiday', 8, 4, a.id); addMod('A lovely holiday', 8, 4, b.id); } },
          { label: 'Let them part ways', tip: 'They divorce. Both are heartbroken for a while.', fn: () => breakUp(a, b, true) },
        ] };
    },
  },
  masterpiece: {
    random: false, life: true,
    make: d => {
      const k = kinById(d.k); if (!k) return null;
      const lv = skillLv(k, 'artistry'), work = pick(['a towering sculpture', 'a sweeping mural', 'a haunting song', 'an epic poem', 'a tapestry of the realm\'s history', 'a portrait of the town at dawn']);
      const f = pickRand(G.factions.filter(f => !f.dead && !f.war));
      const done = () => { k.counts.art = (k.counts.art || 0) + 1; remember(k, `Created ${work}`, '🎨'); bubble(k, '🎨', 5); };
      return { title: '🎨 A Masterpiece', icon: '🎨', text: `${kinChip(k)} has created ${work}. People are coming from all over to see it.`,
        choices: [
          { label: 'Display it in the Town Hall', tip: `+${4 + lv * 2} influence; everyone +4 mood for 4 days.`, fn: () => { done(); gain('influence', 4 + lv * 2); addMod(`${k.name}'s masterpiece`, 4, 4); } },
          { label: 'Sell it to collectors', tip: `+${20 + lv * 12} gold. ${k.name} +6 mood.`, fn: () => { done(); gain('gold', 20 + lv * 12); addMod('Sold my art', 6, 4, k.id); } },
          f ? { label: `Gift it to ${f.name}`, tip: `Relations with ${f.name} +${10 + lv * 2}.`, fn: () => { done(); f.relation = Math.min(100, f.relation + 10 + lv * 2); addLog(`🎁 ${f.name} was delighted by ${k.name}'s gift.`, 'good'); } } : null,
        ].filter(Boolean) };
    },
  },
  careerDream: {
    random: false, life: true, lw: 1.3,
    find: () => {
      const c = G.kin.filter(k => canWork(k) && k.job && !k.soldier && !k.pref && G.buildings[k.job] && (() => { const b = bestSkill(k); return b.lv >= 3 && b.s !== skillOf(G.buildings[k.job].type) && b.s !== 'fighting'; })());
      const t = G.kin.filter(k => canWork(k) && k.job && !k.pref && (k.traits.includes('artistic') || k.traits.includes('curious') || k.traits.includes('greenthumb')));
      const k = pickRand(c.length ? c : t); if (!k) return null;
      const want = c.includes(k) ? bestSkill(k).s : k.traits.includes('artistic') ? 'artistry' : k.traits.includes('curious') ? 'learning' : 'farming';
      if (G.buildings[k.job] && skillOf(G.buildings[k.job].type) === want) return null;
      return { k: k.id, s: want };
    },
    make: d => {
      const k = kinById(d.k); if (!k || !k.job) return null; const S = SKILLS[d.s];
      const any = Object.values(G.buildings).some(b => B[b.type].workers && skillOf(b.type) === d.s && b.type !== 'barracks');
      return { title: `${S.icon} A Different Calling`, icon: S.icon, text: `${kinChip(k)} works as ${aAn(jobTitle(k))} ${jobTitle(k)}, but dreams of working as ${aAn(S.title)} ${S.title}.${any ? '' : `<br><i>You have no ${S.name.toLowerCase()} workplace yet.</i>`}`,
        choices: [
          { label: 'Follow your dream', tip: `${k.name} +10 mood and looks for ${S.name.toLowerCase()} work from now on.`, fn: () => { k.pref = d.s; addMod('Following my dream', 10, 6, k.id); remember(k, `Decided to become ${aAn(S.title)} ${S.title}`, S.icon); if (any) { setJob(k, null); autoAssignJobs(); } } },
          { label: 'Practise on the side', tip: `Stays put but gains ${S.name} experience. +3 mood.`, fn: () => { addSkill(k, d.s, 12); addMod('Learning something new', 3, 4, k.id); } },
          { label: 'We need you where you are', tip: `${k.name} −8 mood for a few days.`, fn: () => { addMod('Dreams put on hold', -8, 4, k.id); } },
        ] };
    },
  },
  prodigy: {
    random: false, life: true, lw: 0.9,
    find: () => { const k = pickRand(G.kin.filter(k => k.age >= 6 && k.age < 16 && (k.traits.includes('curious') || skillLv(k, 'learning') >= 1 || skillLv(k, 'artistry') >= 1))); return k ? { k: k.id } : null; },
    make: d => {
      const k = kinById(d.k); if (!k || isAdult(k)) return null;
      const s = skillLv(k, 'artistry') > skillLv(k, 'learning') ? 'artistry' : 'learning';
      const master = G.kin.filter(o => isAdult(o) && o !== k).map(o => ({ o, b: bestSkill(o) })).sort((x, y) => y.b.lv - x.b.lv)[0];
      const cost = { gold: 15 + 10 * thLevel() };
      return { title: '✨ A Gifted Child', icon: '✨', text: `Young ${kinChip(k)} shows a rare gift for ${SKILLS[s].name.toLowerCase()}. ${k.name}'s parents ask what you advise.`,
        choices: [
          { label: 'Hire a tutor', tip: `${costStr(cost)}: a big boost to ${SKILLS[s].name}.`, disabled: !canAfford(cost), fn: () => { pay(cost); addSkill(k, s, 30); remember(k, 'Was given a tutor', '📚'); addMod('My tutor is great', 6, 4, k.id); } },
          master && master.b.lv >= 4 ? { label: `Apprentice to ${master.o.name}`, tip: `Learns ${SKILLS[master.b.s].name} from ${aAn(skillTitle(master.o, master.b.s))} ${skillTitle(master.o, master.b.s)}; they become friends.`, fn: () => { addSkill(k, master.b.s, 25); k.friends[master.o.id] = (k.friends[master.o.id] || 0) + 30; master.o.friends[k.id] = (master.o.friends[k.id] || 0) + 30; remember(k, `Apprenticed to ${master.o.name}`, SKILLS[master.b.s].icon); remember(master.o, `Took ${k.name} as an apprentice`, SKILLS[master.b.s].icon); } } : null,
          { label: 'Let them just be a child', tip: `${k.name} +10 mood; a little ${SKILLS[s].name} anyway.`, fn: () => { addSkill(k, s, 6); addMod('Carefree childhood', 10, 6, k.id); } },
        ].filter(Boolean) };
    },
  },
  stray: {
    random: false, life: true, lw: 0.8,
    find: () => { const k = pickRand(G.kin.filter(k => !k.pet && k.age >= 6 && homeOf(k))); return k ? { k: k.id, kind: pick(['dog', 'dog', 'cat', 'cat', 'goat']), name: pick(['Biscuit', 'Pepper', 'Mabel', 'Turnip', 'Bramble', 'Nutmeg', 'Socks', 'Pickle', 'Hazel', 'Ziggy', 'Moss', 'Button']) } : null; },
    make: d => {
      const k = kinById(d.k); if (!k || k.pet) return null;
      const ic = { dog: '🐕', cat: '🐈', goat: '🐐' }[d.kind];
      return { title: `${ic} A Stray Follows Someone Home`, icon: ic, text: `A scruffy ${d.kind} has been following ${kinChip(k)} around for days. ${k.name} has started calling it ${d.name}.`,
        choices: [
          { label: `Adopt ${d.name}`, tip: `−8 food. ${k.name} gets a pet: +4 mood for as long as they have it.`, disabled: G.res.food < 8, fn: () => { G.res.food -= 8; k.pet = { kind: d.kind, name: d.name, age: 0, col: pick(['#8d6e63', '#d7ccc8', '#424242', '#ffb74d', '#f5f5f5']) }; remember(k, `Adopted a ${d.kind} called ${d.name}`, ic); addMod('My new pet!', 10, 5, k.id); bubble(k, ic, 5); } },
          { label: 'Find it a farm to live on', tip: `${k.name} is a little sad (−3).`, fn: () => addMod(`Missing ${d.name}`, -3, 3, k.id) },
        ] };
    },
  },
  teenTrouble: {
    random: false, life: true, lw: 0.8,
    find: () => { const k = pickRand(G.kin.filter(k => k.age >= 13 && k.age < 16)); return k ? { k: k.id, what: pick(['painting rude pictures on the granary', 'racing carts through the market', 'sneaking into the tavern', 'skipping lessons to swim in the river', 'starting a band that plays all night']) } : null; },
    make: d => {
      const k = kinById(d.k); if (!k || isAdult(k)) return null;
      const par = k.parents.map(kinById).filter(Boolean);
      const s = d.what.includes('pictures') || d.what.includes('band') ? 'artistry' : d.what.includes('racing') ? 'fighting' : 'charisma';
      return { title: '🧑 Teenage Trouble', icon: '🧑', text: `${kinChip(k)} was caught ${d.what}.${par.length ? ` ${par.map(p => p.name).join(' and ')} are mortified.` : ''}`,
        choices: [
          { label: 'Strict discipline', tip: `${k.name} −10 mood; ${par.length ? 'the parents +4' : 'the town approves'}.`, fn: () => { addMod('Grounded', -10, 4, k.id); for (const p of par) addMod('Raising them right', 4, 3, p.id); } },
          { label: 'Channel the energy', tip: `${k.name} gains ${SKILLS[s].name} experience and +4 mood.`, fn: () => { addSkill(k, s, 14); addMod('Someone believes in me', 4, 4, k.id); remember(k, `Found a passion for ${SKILLS[s].name.toLowerCase()}`, SKILLS[s].icon); } },
          { label: 'Kids will be kids', tip: `${k.name} +6 mood; −5 influence (the neighbours grumble).`, fn: () => { addMod('Got away with it', 6, 3, k.id); G.res.influence = Math.max(0, G.res.influence - 5); } },
        ] };
    },
  },
  crush: {
    random: false, life: true, lw: 1.1,
    find: () => {
      const singles = G.kin.filter(k => isAdult(k) && !k.partner && !k.away && k.age < 50);
      const pairs = [];
      for (const a of singles) for (const id in a.friends) { const b = kinById(+id); if (b && singles.includes(b) && a.friends[id] >= 20 && !a.parents.includes(b.id) && !b.parents.includes(a.id) && !a.parents.some(p => b.parents.includes(p)) && !(a.rivals[b.id] > 30)) pairs.push([a, b]); }
      const p = pickRand(pairs); return p ? { a: p[0].id, b: p[1].id } : null;
    },
    make: d => {
      const a = kinById(d.a), b = kinById(d.b); if (!a || !b || a.partner || b.partner) return null;
      return { title: '💘 A Secret Crush', icon: '💘', text: `${kinChip(a)} can't stop thinking about ${kinChip(b)}, but is far too shy to say anything.`,
        choices: [
          { label: 'Play matchmaker', tip: '5 influence: a good chance they fall for each other — or an awkward moment (−6 both).', disabled: G.res.influence < 5, fn: () => {
            G.res.influence -= 5;
            if (Math.random() < 0.7) { a.partner = b.id; b.partner = a.id; lifeOnPartner(a, b); addMod('In love', 14, 8, a.id); addMod('In love', 14, 8, b.id); addLog(`💕 Thanks to a little help, ${kinName(a)} and ${kinName(b)} are now partners!`, 'good'); if (a.home !== b.home) { const ha = homeOf(a); if (ha && houseCap(ha) > residents(ha).length) b.home = a.home; } }
            else { addMod('So awkward', -6, 3, a.id); addMod('So awkward', -6, 3, b.id); addLog(`😳 The matchmaking between ${a.name} and ${b.name} did not go well.`, 'info'); }
          } },
          { label: 'Encourage them to speak up', tip: `${a.name} and ${b.name} grow closer (+15 bond).`, fn: () => { a.friends[b.id] = (a.friends[b.id] || 0) + 15; b.friends[a.id] = (b.friends[a.id] || 0) + 15; } },
          { label: 'Stay out of it', tip: 'Love will find its own way.', fn: () => {} },
        ] };
    },
  },
  elderWisdom: {
    random: false, life: true, lw: 0.8,
    find: () => { const k = pickRand(G.kin.filter(k => isElder(k) && bestSkill(k).lv >= 4)); return k ? { k: k.id } : null; },
    make: d => {
      const k = kinById(d.k); if (!k) return null; const b = bestSkill(k), kids = G.kin.filter(c => !isAdult(c) && c.age >= 5);
      return { title: '🧓 The Wisdom of Age', icon: '🧓', text: `${kinChip(k)} has spent a lifetime as ${aAn(skillTitle(k, b.s))} ${skillTitle(k, b.s)} and wants to pass something on.`,
        choices: [
          { label: 'Write their memoirs', tip: `+${8 + b.lv * 4} knowledge.`, fn: () => { gain('knowledge', 8 + b.lv * 4); remember(k, 'Wrote their memoirs', '📜'); addMod('My story is told', 8, 5, k.id); } },
          { label: 'Teach the young', tip: `${kids.length} children gain ${SKILLS[b.s].name} experience.`, disabled: !kids.length, fn: () => { for (const c of kids) { addSkill(c, b.s, 6 + b.lv); c.friends[k.id] = (c.friends[k.id] || 0) + 10; } remember(k, 'Taught the children of the town', '🧑‍🏫'); addMod('Passing it on', 10, 5, k.id); } },
          { label: 'Enjoy a quiet retirement', tip: `${k.name} +12 mood.`, fn: () => addMod('Peaceful days', 12, 8, k.id) },
        ] };
    },
  },
  midlife: {
    random: false, life: true, lw: 0.9,
    find: () => { const k = pickRand(G.kin.filter(k => isAdult(k) && k.age >= 30 && k.age < 60 && k.mood < 50 && !k.soldier)); return k ? { k: k.id } : null; },
    make: d => {
      const k = kinById(d.k); if (!k) return null;
      return { title: '😔 Feeling Stuck', icon: '😔', text: `${kinChip(k)} says every day feels the same. “${esc(k.thought || 'Is this all there is?')}”`,
        choices: [
          { label: 'Give them a sabbatical', tip: `No work for 3 days; ${k.name} +15 mood.`, fn: () => { k.sabbatical = G.time.day + 3; addMod('On sabbatical', 15, 4, k.id); remember(k, 'Took a sabbatical', '🏖️'); } },
          { label: 'Throw them a party', tip: `12 food: ${k.name} +10 mood and makes friends.`, disabled: G.res.food < 12, fn: () => { G.res.food -= 12; addMod('What a party!', 10, 4, k.id); for (const o of freeKin().filter(o => o !== k && isAdult(o)).slice(0, 4)) { k.friends[o.id] = (k.friends[o.id] || 0) + 12; o.friends[k.id] = (o.friends[k.id] || 0) + 12; } } },
          { label: 'Tell them to cheer up', tip: `Free. ${k.name} −4 mood.`, fn: () => addMod('Nobody listens', -4, 3, k.id) },
        ] };
    },
  },
  homesick: {
    random: false, life: true, lw: 1,
    find: () => { const k = pickRand(G.kin.filter(k => isAdult(k) && k.counts && k.counts.arrived && G.time.day - k.counts.arrived <= 12 && goodFriends(k) === 0)); return k ? { k: k.id } : null; },
    make: d => {
      const k = kinById(d.k); if (!k) return null; const buddy = G.kin.filter(o => o !== k && isAdult(o) && o.traits.includes('social'))[0] || G.kin.filter(o => o !== k && isAdult(o))[0];
      return { title: '🧳 Missing Home', icon: '🧳', text: `${kinChip(k)} moved here recently and doesn't know anyone yet.`,
        choices: [
          { label: 'Welcome party', tip: `10 food: ${k.name} befriends several neighbours.`, disabled: G.res.food < 10, fn: () => { G.res.food -= 10; for (const o of freeKin().filter(o => o !== k && isAdult(o)).sort(() => Math.random() - 0.5).slice(0, 4)) { k.friends[o.id] = (k.friends[o.id] || 0) + 25; o.friends[k.id] = (o.friends[k.id] || 0) + 25; } addMod('Feeling welcome', 8, 5, k.id); remember(k, 'Was thrown a welcome party', '🎉'); } },
          buddy ? { label: `Introduce them to ${buddy.name}`, tip: `Free: they become friends.`, fn: () => { k.friends[buddy.id] = (k.friends[buddy.id] || 0) + 40; buddy.friends[k.id] = (buddy.friends[k.id] || 0) + 40; bubble(k, '👋'); bubble(buddy, '👋'); } } : null,
          { label: 'Give them time', tip: 'They will settle in eventually.', fn: () => {} },
        ].filter(Boolean) };
    },
  },
  rivalry: {
    random: false, life: true, lw: 1.2,
    find: () => { const k = pickRand(G.kin.filter(k => rivalOf(k))); return k ? { a: k.id, b: rivalOf(k).id } : null; },
    make: d => {
      const a = kinById(d.a), b = kinById(d.b); if (!a || !b) return null;
      const same = a.job && a.job === b.job;
      return { title: '😠 Bad Blood', icon: '😠', text: `${kinChip(a)} and ${kinChip(b)} have been at each other's throats${same ? ' — and they work side by side' : ''}. Everyone around them is tired of it.`,
        choices: [
          { label: 'Reconciliation dinner', tip: '15 food: the rivalry ends and they become friends.', disabled: G.res.food < 15, fn: () => { G.res.food -= 15; a.rivals[b.id] = b.rivals[a.id] = 0; delete a.rivals[b.id]; delete b.rivals[a.id]; a.friends[b.id] = b.friends[a.id] = 35; addMod('Made up', 8, 4, a.id); addMod('Made up', 8, 4, b.id); remember(a, `Made peace with ${b.name}`, '🤝'); remember(b, `Made peace with ${a.name}`, '🤝'); } },
          { label: `Side with ${a.name}`, tip: `${a.name} +12 mood, ${b.name} −12. The feud cools.`, fn: () => { addMod('Proved right', 12, 4, a.id); addMod('Humiliated', -12, 4, b.id); a.rivals[b.id] = b.rivals[a.id] = 20; } },
          same ? { label: 'Move one of them to other work', tip: `${b.name} is reassigned; the rivalry slowly fades.`, fn: () => { setJob(b, null); b.avoid = a.job; autoAssignJobs(); a.rivals[b.id] = b.rivals[a.id] = 30; } } : { label: 'Let them sort it out', tip: 'Maybe it gets worse.', fn: () => { a.rivals[b.id] = Math.min(100, (a.rivals[b.id] || 0) + 10); b.rivals[a.id] = Math.min(100, (b.rivals[a.id] || 0) + 10); } },
        ] };
    },
  },
  birthday: {
    random: false, life: true, lw: 0.7,
    find: () => { const k = pickRand(G.kin.filter(k => { const a = Math.floor(k.age); return a >= 20 && a % 10 === 0 && k.age - a < 1 && goodFriends(k) >= 2; })); return k ? { k: k.id } : null; },
    make: d => {
      const k = kinById(d.k); if (!k) return null; const a = Math.floor(k.age);
      return { title: `🎂 ${k.name} Turns ${a}`, icon: '🎂', text: `${kinChip(k)} is turning ${a}, and their friends want to celebrate.`,
        choices: [
          { label: 'A big party at the tavern', tip: '10 food + 10 gold: everyone who knows them +6, them +14.', disabled: !canAfford({ food: 10, gold: 10 }), fn: () => { pay({ food: 10, gold: 10 }); addMod('Best birthday ever', 14, 4, k.id); for (const o of freeKin()) if ((o.friends[k.id] || 0) >= 20) addMod(`${k.name}'s party`, 6, 2, o.id); remember(k, `Celebrated turning ${a} with a big party`, '🎂'); bubble(k, '🎉', 6); } },
          { label: 'A quiet family dinner', tip: `${k.name} +6 mood.`, fn: () => { addMod('Birthday dinner', 6, 3, k.id); remember(k, `Turned ${a}`, '🎂'); } },
        ] };
    },
  },
  apprentice: {
    random: false, life: true, lw: 0.8,
    find: () => { const m = pickRand(G.kin.filter(k => isAdult(k) && bestSkill(k).lv >= 7)); if (!m) return null; const young = G.kin.filter(k => k.age >= 12 && k.age < 30 && k !== m).sort(() => Math.random() - 0.5).slice(0, 2); return young.length ? { m: m.id, y: young.map(k => k.id) } : null; },
    make: d => {
      const m = kinById(d.m); if (!m) return null; const ys = d.y.map(kinById).filter(Boolean); if (!ys.length) return null; const b = bestSkill(m);
      return { title: `${SKILLS[b.s].icon} An Apprenticeship`, icon: SKILLS[b.s].icon, text: `${kinChip(m)} wants to take on an apprentice in ${SKILLS[b.s].name.toLowerCase()}. Who should it be?`,
        choices: ys.map(y => ({ label: `${y.name}, ${Math.floor(y.age)}`, tip: `${y.traits.map(t => TRAITS[t].name).join(', ') || 'no traits'} — gains a lot of ${SKILLS[b.s].name}; becomes close to ${m.name}.`, fn: () => { addSkill(y, b.s, 35 * learnRate(y, b.s)); y.friends[m.id] = (y.friends[m.id] || 0) + 30; m.friends[y.id] = (m.friends[y.id] || 0) + 30; if (!y.pref && isAdult(y)) y.pref = b.s; remember(y, `Became ${m.name}'s apprentice`, SKILLS[b.s].icon); remember(m, `Took ${y.name} as an apprentice`, SKILLS[b.s].icon); } }))
          .concat([{ label: 'Not now', tip: `${m.name} −3 mood.`, fn: () => addMod('No one to teach', -3, 3, m.id) }]) };
    },
  },
});
const LIFE_KEYS = Object.entries(EVENTS).filter(([, e]) => e.life).map(([k]) => k);
for (const k of LIFE_KEYS) EVENT_MAJOR.add(k);
Object.assign(EVENT_AUTO, { wedding: [1], marriageTrouble: [1, 2], masterpiece: [0], careerDream: [0], prodigy: [2], stray: [0, 1], teenTrouble: [1], crush: [1], elderWisdom: [0], midlife: [1, 2], homesick: [1, 2], rivalry: [0, 1], birthday: [1], apprentice: [0] });

// ---------- Drawing helpers for kin ----------
function drawBubble(c, k, X, Y) {
  const b = BUBBLES.get(k.id); if (!b) return;
  if (R.t > b.until) { BUBBLES.delete(k.id); return; }
  if (R.cam.z < 1.3) return;
  const a = Math.min(1, (b.until - R.t) * 2);
  c.globalAlpha = a; c.fillStyle = '#fff8e1'; c.strokeStyle = 'rgba(93,64,55,0.6)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(X + 1.5, Y - 12); c.lineTo(X + 1, Y - 9); c.lineTo(X + 4.5, Y - 12.5); c.fill();
  c.beginPath(); c.arc(X + 6, Y - 17, 5.6, 0, 7); c.fill(); c.stroke();
  c.font = '8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(b.e, X + 6, Y - 16.6); c.textBaseline = 'alphabetic'; c.globalAlpha = 1;
}
function drawPet(c, k, X, Y, walking) {
  const p = k.pet; if (!p || R.cam.z < 0.9) return;
  const px = X + 6, py = Y + 3 - (walking ? Math.abs(Math.sin(R.t * 14 + k.id)) * 1 : 0);
  c.fillStyle = p.col || '#8d6e63';
  if (p.kind === 'cat') { c.beginPath(); c.ellipse(px, py, 2.4, 1.5, 0, 0, 7); c.fill(); c.beginPath(); c.arc(px + 2.3, py - 1.2, 1.3, 0, 7); c.fill(); c.fillRect(px + 1.6, py - 2.9, 0.7, 1); c.fillRect(px + 2.8, py - 2.9, 0.7, 1); c.strokeStyle = p.col; c.lineWidth = 0.7; c.beginPath(); c.moveTo(px - 2.3, py); c.quadraticCurveTo(px - 4, py - 1 + Math.sin(R.t * 3) , px - 3.6, py - 3); c.stroke(); }
  else if (p.kind === 'goat') { c.fillStyle = '#eeeeee'; c.beginPath(); c.ellipse(px, py, 2.6, 1.7, 0, 0, 7); c.fill(); c.beginPath(); c.arc(px + 2.6, py - 1.4, 1.2, 0, 7); c.fill(); c.fillStyle = '#9e9e9e'; c.fillRect(px + 2.2, py - 3.2, 0.6, 1.2); c.fillStyle = '#616161'; c.fillRect(px - 1.6, py + 1, 0.6, 1.6); c.fillRect(px + 1.2, py + 1, 0.6, 1.6); }
  else { c.beginPath(); c.ellipse(px, py, 2.6, 1.6, 0, 0, 7); c.fill(); c.beginPath(); c.arc(px + 2.6, py - 1.2, 1.4, 0, 7); c.fill(); c.fillStyle = shade(p.col || '#8d6e63', -30); c.fillRect(px + 2.6, py - 1.4, 1.2, 2); c.strokeStyle = p.col; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px - 2.4, py - 0.4); c.lineTo(px - 3.8, py - 2 + Math.sin(R.t * 12 + k.id) * 0.8); c.stroke(); }
}
