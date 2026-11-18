// ===== Turn-based battles =====
// When your army reaches its target, you fight round by round, picking a tactic each turn.
// Charge beats Volley, Volley beats Shield wall, Shield wall beats Charge. Scouts hint at the enemy's plan.
const TACTICS = {
  charge: { name: 'Charge', icon: '⚔️', deal: 1.5, take: 1.25, beats: 'volley', desc: 'Hit hard but take hits. Beats Volley.' },
  hold: { name: 'Shield wall', icon: '🛡️', deal: 0.7, take: 0.55, beats: 'charge', desc: 'Brace and take little damage. Beats Charge.' },
  volley: { name: 'Volley', icon: '🏹', deal: 1.0, take: 0.65, beats: 'hold', uses: 3, desc: 'Arrows from range. Beats Shield wall. 3 per battle.' },
  rally: { name: 'Rally', icon: '🎺', deal: 0.3, take: 1.0, desc: '+25 morale and patch up wounds (+2 HP each).' },
};
const MAX_ROUNDS = 8;

function startBattle(a, f, troops, defenders, dmult, isCap) {
  const units = troops.map(k => ({ id: k.id, name: k.name, max: 10, hp: Math.max(4, 10 * k.health / 100), pow: soldierPower(k), brave: k.traits.includes('brave') }));
  (a.extra || []).forEach((e, s) => { for (let j = 0; j < e.n; j++) units.push({ id: null, src: s, name: e.kind === 'vet' ? 'Veteran' : e.kind === 'levy' ? `${e.name} levy` : `${e.name} trooper`, max: 10, hp: 10, pow: e.pow }); });
  const n = Math.max(1, Math.round(defenders));
  const foes = Array.from({ length: n }, (_, i) => ({ name: f.minor ? 'Militia' : 'Soldier', max: 10, hp: 10, pow: dmult * rand(0.85, 1.15) }));
  UI.battle = { a, f, isCap, units, foes, round: 1, morale: { me: 100, them: 100 }, volleys: 3, log: [], done: false, startFoes: n };
  UI.battle.enemyPlan = enemyTactic(UI.battle);
  hideTip(); renderBattle();
  R.flyTo(a.target.x, a.target.y);
}
function alive(list) { return list.filter(u => u.hp > 0); }
function sidePow(list) { return alive(list).reduce((s, u) => s + u.pow, 0); }
function enemyTactic(bt) {
  const w = { charge: 3, hold: 3, volley: 2.5, rally: 0.6 };
  if (bt.morale.them < 45) { w.hold += 2; w.rally += 2; }
  if (sidePow(bt.foes) > sidePow(bt.units) * 1.4) w.charge += 3;
  if (bt.lastMine) for (const [k, t] of Object.entries(TACTICS)) if (t.beats === bt.lastMine) w[k] += 1.5; // counter your last move
  let tot = 0; for (const k in w) tot += w[k];
  let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'hold';
}
function scoutHint(bt) {
  if (bt.hint && bt.hint.round === bt.round) return bt.hint;
  const sure = Math.random() < ((bt.f.intel || 0) > G.time.day ? 0.9 : hasTech('archery') ? 0.8 : 0.65);
  const guess = sure ? bt.enemyPlan : pick(Object.keys(TACTICS).filter(k => k !== bt.enemyPlan && k !== 'rally'));
  bt.hint = { round: bt.round, guess, sure: (Math.random() < 0.7) === sure ? 'likely' : 'maybe' };
  return bt.hint;
}
function matchup(a, b) { return TACTICS[a].beats === b ? 1.5 : TACTICS[b].beats === a ? 0.6 : 1; }
function spread(list, dmg) {
  let left = dmg;
  while (left > 0.05) { const al = alive(list); if (!al.length) break; const u = pick(al); const hit = Math.min(left, rand(1.5, 3.5), u.hp); u.hp -= hit; left -= hit; }
}
function battleRound(mine) {
  const bt = UI.battle; if (!bt || bt.done) return;
  if (mine === 'volley' && bt.volleys <= 0) return;
  if (mine === 'volley') bt.volleys--;
  const theirs = bt.enemyPlan, T1 = TACTICS[mine], T2 = TACTICS[theirs];
  const myP = sidePow(bt.units), thP = sidePow(bt.foes);
  const toThem = myP * T1.deal * T2.take * matchup(mine, theirs) * 2.6 * rand(0.85, 1.15);
  const toMe = thP * T2.deal * T1.take * matchup(theirs, mine) * 2.6 * rand(0.85, 1.15);
  const hpBefore = [bt.units.reduce((s, u) => s + Math.max(0, u.hp), 0), bt.foes.reduce((s, u) => s + Math.max(0, u.hp), 0)];
  spread(bt.foes, toThem); spread(bt.units, toMe);
  if (mine === 'rally') { bt.morale.me = Math.min(100, bt.morale.me + 25); for (const u of alive(bt.units)) u.hp = Math.min(u.max, u.hp + 2); }
  if (theirs === 'rally') { bt.morale.them = Math.min(100, bt.morale.them + 25); for (const u of alive(bt.foes)) u.hp = Math.min(u.max, u.hp + 2); }
  const lostMe = hpBefore[0] - bt.units.reduce((s, u) => s + Math.max(0, u.hp), 0), lostThem = hpBefore[1] - bt.foes.reduce((s, u) => s + Math.max(0, u.hp), 0);
  bt.morale.me -= lostMe / (bt.units.length * 10) * 110 * (bt.units.some(u => u.brave && u.hp > 0) ? 0.85 : 1);
  bt.morale.them -= lostThem / (bt.foes.length * 10) * 110;
  const m = matchup(mine, theirs);
  bt.log.unshift(`Round ${bt.round}: ${T1.icon} ${T1.name} vs their ${T2.icon} ${T2.name}${m > 1 ? ' — <span class="pos">outplayed them!</span>' : m < 1 ? ' — <span class="neg">they countered you</span>' : ''} (dealt ${lostThem.toFixed(0)}, took ${lostMe.toFixed(0)})`);
  bt.lastMine = mine; bt.round++;
  const winNow = !alive(bt.foes).length || bt.morale.them <= 0, loseNow = !alive(bt.units).length || bt.morale.me <= 0;
  if (winNow && !loseNow) return endBattle(true, !alive(bt.foes).length ? 'Every defender has fallen.' : 'The defenders break and flee!');
  if (loseNow) return endBattle(false, !alive(bt.units).length ? 'Your army has been cut down.' : 'Your soldiers lose heart and fall back.');
  if (bt.round > MAX_ROUNDS) { const win = Math.random() < winChance(sidePow(bt.units) * (0.6 + bt.morale.me / 250), sidePow(bt.foes) * (0.6 + bt.morale.them / 250)); return endBattle(win, win ? 'Exhausted, the defenders yield the field.' : 'Night falls on a stalemate; your army withdraws.'); }
  bt.enemyPlan = enemyTactic(bt);
  renderBattle();
}
function autoBattle() {
  const bt = UI.battle; if (!bt) return;
  let guard = 0;
  while (UI.battle && !UI.battle.done && guard++ < 20) {
    const h = scoutHint(bt), counter = Object.keys(TACTICS).find(k => TACTICS[k].beats === h.guess);
    let t = counter && (counter !== 'volley' || bt.volleys > 0) ? counter : 'hold';
    if (bt.morale.me < 35 && Math.random() < 0.5) t = 'rally';
    battleRound(t);
  }
}
function retreatBattle() { const bt = UI.battle; if (!bt || bt.done) return; endBattle(false, 'You sounded the retreat.', true); }
function endBattle(win, why, retreat) {
  const bt = UI.battle; bt.done = true; bt.win = win; bt.why = why;
  const fallen = [], xl = [];
  for (const u of bt.units) {
    if (u.src != null) { if (u.hp <= 0 && Math.random() < (retreat ? 0.4 : 0.6)) xl[u.src] = (xl[u.src] || 0) + 1; continue; }
    const k = kinById(u.id); if (!k) continue;
    if (u.hp <= 0 && Math.random() < (retreat ? 0.4 : 0.6)) fallen.push(u.id);
    else k.health = clamp(Math.round(Math.max(u.hp, 1.5) / u.max * 100), 15, 100);
  }
  const killed = bt.foes.filter(u => u.hp <= 0).length;
  bt.fallen = fallen.map(id => kinById(id)).filter(Boolean).map(kinName);
  bt.killed = killed;
  (bt.a.extra || []).forEach((e, s) => { e.n = Math.max(0, e.n - (xl[s] || 0)); });
  bt.fallen.push(...xl.map((n, s) => n ? `${n} ${bt.a.extra[s].kind === 'vet' ? 'veterans' : bt.a.extra[s].kind === 'levy' ? bt.a.extra[s].name + ' levies' : bt.a.extra[s].name + ' troops'}` : '').filter(Boolean));
  resolveBattle(bt.a, bt.f, win, fallen, killed + (win ? 1 : 0), bt.isCap);
  renderBattle();
}
function closeBattle() { UI.battle = null; $('#battle').classList.add('hidden'); $('#shade').classList.add('hidden'); UI.lastInspect = ''; }

function unitRow(u, foe) {
  const pct = clamp(u.hp / u.max * 100, 0, 100);
  return `<div class="bunit ${u.hp <= 0 ? 'down' : ''}"><span>${u.hp <= 0 ? '💀' : foe ? '🗡️' : '🛡️'} ${esc(u.name)}</span><div class="bar"><div style="width:${pct}%;background:${foe ? '#e57373' : '#81c784'}"></div></div></div>`;
}
function renderBattle() {
  const bt = UI.battle; if (!bt) return;
  const el = $('#battle');
  const place = bt.a.fieldEnemy ? `the road — ${bt.f.name}'s army caught on the march` : bt.f.minor ? `the village of ${bt.f.name}` : bt.isCap ? `${bt.f.name}'s capital` : `${bt.f.name}'s border`;
  let h = `<h2>⚔️ Battle for ${esc(place)}</h2>`;
  h += `<div class="bsides"><div class="bside"><div class="bh">Your army · power ${sidePow(bt.units).toFixed(0)}</div><div class="kv">Morale ${bar(clamp(bt.morale.me, 0, 100), '#66bb6a')}</div><div class="blist">${bt.units.slice(0, 40).map(u => unitRow(u)).join('')}${bt.units.length > 40 ? `<div class="dim">+${bt.units.length - 40} more (${alive(bt.units).length} standing)</div>` : ''}</div></div>`;
  h += `<div class="bvs">VS</div><div class="bside"><div class="bh">${esc(bt.f.name)} · power ${sidePow(bt.foes).toFixed(0)}</div><div class="kv">Morale ${bar(clamp(bt.morale.them, 0, 100), '#e57373')}</div><div class="blist">${bt.foes.slice(0, 40).map(u => unitRow(u, true)).join('')}${bt.foes.length > 40 ? `<div class="dim">+${bt.foes.length - 40} more (${alive(bt.foes).length} standing)</div>` : ''}</div></div></div>`;
  if (!bt.done) h += `<div class="dim">If your captain fought it out: about ${pctStr(winChance(sidePow(bt.units), sidePow(bt.foes)))} to win.</div>`;
  if (!bt.done) {
    const hint = scoutHint(bt);
    h += `<div class="bhint">Round ${bt.round}/${MAX_ROUNDS} · 🔭 Scouts: they will <b>${bt.hint.sure}</b> use ${TACTICS[hint.guess].icon} <b>${TACTICS[hint.guess].name}</b></div>`;
    h += `<div class="btactics">` + Object.entries(TACTICS).map(([k, t]) => { const dis = k === 'volley' && bt.volleys <= 0; return `<button class="btn btac" data-act="btactic" data-arg="${k}" ${dis ? 'disabled' : ''}><span class="bi">${t.icon}</span><b>${t.name}${k === 'volley' ? ` (${bt.volleys})` : ''}</b><small>${t.desc}</small></button>`; }).join('') + `</div>`;
    h += `<div class="btnrow bfoot"><button class="btn sm" data-act="bauto" data-tip="Let your captain fight the rest of the battle">⏩ Auto-resolve</button><button class="btn sm" data-act="balways" data-tip="Auto-resolve this battle and every future one. Change back in Menu → Battles.">🤖 Always auto-resolve</button><button class="btn sm danger" data-act="bretreat" data-tip="Pull back now. Fewer soldiers die, but you lose.">🏳️ Retreat</button></div>`;
  } else {
    h += `<div class="bresult ${bt.win ? 'pos' : 'neg'}"><b>${bt.win ? '🏆 Victory!' : '💀 Defeat'}</b> ${bt.why}</div>`;
    h += `<div class="kv">Enemies felled: ${bt.killed}. ${bt.fallen.length ? `Fallen: ${bt.fallen.map(esc).join(', ')}.` : 'None of your soldiers died.'}</div>`;
    h += `<div class="btnrow bfoot"><button class="btn" data-act="bclose">Continue</button></div>`;
  }
  h += `<div class="blog">${bt.log.slice(0, 4).map(l => `<div>${l}</div>`).join('')}</div>`;
  el.innerHTML = h; el.classList.remove('hidden'); $('#shade').classList.remove('hidden');
}
