'use strict';
// ───────────────────────── Combat: Rites (poker-style hands) × relics × heroes ─────────────────────────
let SORT = 'rank';
function handSize() {
  let n = 8 + party().reduce((s, h) => s + (h.handSize || 0), 0) + relicsD().reduce((s, r) => s + (r.handSize || 0), 0);
  if (F && F.ab.includes('fog')) n--; if (G.descent >= 8) n--;
  return Math.max(4, n);
}
function scaleMonster(base, opts) {
  let hp = base.hp * ACTS[G.act].hpMul * (1 + 0.08 * Math.floor(G.doom / 6)) * (base.boss ? 2.6 : [0, 1.7, 2.2, 2.4][G.act]);
  if (G.descent >= 2) hp *= 1.2; if (opts.unprepared) hp *= 1.35; if (opts.enraged) hp *= 1.25;
  let dmg = Math.round(base.dmg * [1, 1, 0.8, 0.65][G.act]) + Math.floor(G.doom / 12) + (G.descent >= 6 ? 2 : 0); if (opts.unprepared) dmg = Math.ceil(dmg * 1.3);
  return { hp: Math.max(10, Math.round(hp / 10) * 10), dmg };
}
async function runFight(base, opts = {}) {
  const sc = scaleMonster(base, opts);
  F = { mon: base, opts, hp: sc.hp, maxHp: sc.hp, dmg: sc.dmg, ab: base.ab.slice(), draw: shuffle(G.deck.slice()), hand: [], disc: [], sel: new Set(),
    discards: 0, bonus: { chips: 0, mult: 0, x: 1 }, invoked: {}, rites: 0, stun: 0, shield: 0, martyr: 0, lastKey: null, busy: false };
  F.discards = Math.max(0, 3 + relicsD().reduce((s, r) => s + (r.discards || 0), 0) - (G.descent >= 4 ? 1 : 0) - (F.ab.includes('hex') ? 1 : 0));
  showScreen('fight'); $('#f-played').innerHTML = ''; $('#f-dmg').innerHTML = '';
  renderFight(); drawCards(handSize() - F.hand.length, true);
  const won = await new Promise(r => F.done = r);
  party().forEach(h => h.fightEnd && h.fightEnd.call(h, won));
  const fs = F; F = null;
  if (!won) { await sleep(500); await gameOver(false); return false; }
  await fightRewards(base, opts, fs);
  if (!G || G.over) return true;
  showScreen('map'); renderAll(); fitMap();
  return true;
}
async function fightRewards(base, opts, fs) {
  G.stats.kills++; G.echoes += 1;
  let loot = {};
  if (opts.boss) loot = { gold: 2, soul: 2 };
  else { if (opts.res) loot[opts.res] = 2; const r = pick(RES_KEYS); loot[r] = (loot[r] || 0) + 1; }
  if (opts.lair) { loot[opts.res] = (loot[opts.res] || 0) + 1; G.stats.lairs++; G.echoes += 4; }
  if (opts.blight) loot.soul = (loot.soul || 0) + 2;
  if (hasRelic('axe') && fs.rites === 1) { loot.gold = (loot.gold || 0) + 2; loot.soul = (loot.soul || 0) + 1; }
  gain(loot);
  let extra = opts.lair ? '<br>' + addSigil() : '';
  sfx('win');
  await showModal({ title: 'VICTORY', art: monImg(base, base.boss ? 4 : 5, 'slain'), text: `${base.name} is destroyed in ${fs.rites} Rite${fs.rites === 1 ? '' : 's'}.<br><br>Spoils: ${resStr(loot)}${extra}`, buttons: [{ t: 'Collect' }] });
  log(`Slew ${base.name}. Spoils: ${Object.entries(loot).map(([k, v]) => v + ' ' + RES[k].name).join(', ')}.`);
  if (!opts.boss) await chooseCard([...Array(META.up.eye ? 4 : 3)].map(() => randCard(G.act, opts.lair ? 0.3 : 0)), 'Spoils: add a card to your deck');
  if (!opts.boss && Math.random() < 0.22) { const s = giveScroll(); log(s); toast(s); await runQueue(); }
  if (opts.lair) await chooseRelic(3);
}

// ── deck handling ──
function drawCards(n, initial) {
  const added = [];
  for (let i = 0; i < n; i++) {
    if (!F.draw.length) { if (!F.disc.length) break; F.draw = shuffle(F.disc); F.disc = []; }
    const c = F.draw.pop(); F.hand.push(c); added.push(c.id);
  }
  renderHand(added); renderFightSide();
}
function sortHand() {
  if (SORT === 'rank') F.hand.sort((a, b) => b.rank - a.rank || SUIT_KEYS.indexOf(a.suit) - SUIT_KEYS.indexOf(b.suit));
  else F.hand.sort((a, b) => SUIT_KEYS.indexOf(a.suit) - SUIT_KEYS.indexOf(b.suit) || b.rank - a.rank);
}

// ── rite evaluation & scoring ──
function evalRite(cards) {
  if (!cards.length) return null;
  const by = {}; cards.forEach(c => (by[c.rank] = by[c.rank] || []).push(c));
  const groups = Object.values(by).sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const n = cards.length, flush = n === 5 && cards.every(c => c.suit === cards[0].suit);
  const ranks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);
  const straight = n === 5 && ranks.length === 5 && ranks[4] - ranks[0] === 4;
  const g0 = groups[0].length, g1 = groups[1] ? groups[1].length : 0;
  if (g0 === 5) return { key: 'five', scoring: cards };
  if (straight && flush) return { key: 'sflush', scoring: cards };
  if (g0 === 4) return { key: 'four', scoring: groups[0] };
  if (g0 === 3 && g1 >= 2) return { key: 'full', scoring: cards };
  if (flush) return { key: 'flush', scoring: cards };
  if (straight) return { key: 'straight', scoring: cards };
  if (g0 === 3) return { key: 'three', scoring: groups[0] };
  if (g0 === 2 && g1 === 2) return { key: 'two', scoring: groups[0].concat(groups[1]) };
  if (g0 === 2) return { key: 'pair', scoring: groups[0] };
  return { key: 'high', scoring: [cards.slice().sort((a, b) => b.rank - a.rank)[0]] };
}
const isDead = c => c.ench === 'cursed' || (F && F.ab.includes('d_' + c.suit));
function computeRite(cards, preview) {
  const e = evalRite(cards); if (!e) return null;
  const R = RITES[e.key], lv = G.riteLv[e.key] || 1;
  const ctx = { key: e.key, lv, cards, scoring: e.scoring, f: F, preview, chips: R.chips + R.lc * (lv - 1), mult: R.mult + R.lm * (lv - 1), ev: [], heal: 0, shatter: [], cur: null };
  ctx.ev.push({ type: 'base', chips: ctx.chips, mult: ctx.mult });
  const push = (type, n, src) => ctx.ev.push({ type, n, src: src ? (src.id || src.name) : null, card: ctx.cur, chips: ctx.chips, mult: ctx.mult });
  ctx.chip = (n, src) => { ctx.chips += n; push('chip', n, src); };
  ctx.mul = (n, src) => { ctx.mult += n; push('mult', n, src); };
  ctx.xm = (n, src) => { ctx.mult *= n; push('x', n, src); };
  if (F.bonus.chips) ctx.chip(F.bonus.chips, { id: 'invoke' });
  if (F.bonus.mult) ctx.mul(F.bonus.mult, { id: 'invoke' });
  const P = party(), Rl = relicsD();
  e.scoring.forEach((c, i) => {
    const times = i === 0 && hasRelic('mirror') ? 2 : 1;
    for (let t = 0; t < times; t++) {
      ctx.cur = c;
      if (isDead(c)) { ctx.ev.push({ type: 'dead', card: c, chips: ctx.chips, mult: ctx.mult }); continue; }
      ctx.chip(c.rank, null);
      if (c.ench === 'gilded') ctx.mul(4, null);
      if (c.ench === 'bloodied') ctx.chip(20, null);
      if (c.ench === 'glass') { ctx.xm(2, null); if (!preview && Math.random() < 0.25 && !ctx.shatter.includes(c)) ctx.shatter.push(c); }
      if (c.ench === 'holy') ctx.heal += hasHero('morrow') ? 4 : 2;
      P.forEach(h => h.card && h.card.call(h, ctx, c));
      Rl.forEach(r => r.card && r.card.call(r, ctx, c));
    }
  });
  ctx.cur = null;
  P.forEach(h => h.rite && h.rite.call(h, ctx));
  Rl.forEach(r => r.rite && r.rite.call(r, ctx));
  if (F.bonus.x !== 1) ctx.xm(F.bonus.x, { id: 'invoke' });
  let factor = 1, why = [];
  if (F.ab.includes('armor') && F.rites === 0) { factor *= 0.5; why.push('Armored'); }
  if (F.ab.includes('shy') && cards.length < 3) { factor *= 0.5; why.push('Elusive'); }
  if (F.ab.includes('monotony') && F.lastKey === e.key) { factor *= 0.5; why.push('Ennui'); }
  ctx.factor = factor; ctx.why = why;
  ctx.mult = Math.round(ctx.mult * 100) / 100;
  ctx.dmg = Math.floor(ctx.chips * ctx.mult * factor);
  return ctx;
}

// ── rendering ──
function renderFight() { if (!F) return; renderFightParty(); renderFightMon(); renderFightSide(); renderHand(); renderFightHP(); updatePreview(); }
function renderFightMon() {
  const m = F.mon, pct = F.hp / F.maxHp * 100, hits = F.ab.includes('double') ? 2 : 1;
  const intent = F.stun ? '<span class="dim">Stunned — will not attack</span>' : `⚔ Strikes for <b>${Math.max(0, F.dmg - (hasRelic('thornveil') ? 1 : 0))}</b>${hits > 1 ? ' ×2' : ''}${F.shield ? ' <span class="ward">(warded)</span>' : ''}`;
  const tag = F.opts.boss ? 'THRONE' : F.opts.lair ? 'LAIR' : F.opts.blight ? 'BLIGHT' : '';
  let wrap = $('#f-mon');
  if (!wrap.dataset.mon || wrap.dataset.mon !== m.name) {
    wrap.dataset.mon = m.name;
    wrap.innerHTML = `<div class="mon-head">${tag ? `<span class="tag">${tag}</span>` : ''}<span class="mon-name">${m.name}</span>${F.opts.unprepared ? '<span class="tag red">UNPREPARED</span>' : ''}${F.opts.enraged ? '<span class="tag red">EMPOWERED</span>' : ''}</div>
      <div class="monspr">${monImg(m, m.boss ? 6 : m.lair ? 6 : 7, 'bob')}</div>
      <div class="mon-hp"><i></i><span></span></div><div class="mon-ab"></div><div class="mon-int"></div>`;
  }
  wrap.querySelector('.mon-hp i').style.width = pct + '%';
  wrap.querySelector('.mon-hp span').textContent = `${Math.max(0, Math.ceil(F.hp)).toLocaleString()} / ${F.maxHp.toLocaleString()}`;
  wrap.querySelector('.mon-ab').innerHTML = F.ab.map(a => `<span class="abil" data-tip="${esc(ABIL[a].desc)}">${ABIL[a].name}</span>`).join('');
  wrap.querySelector('.mon-int').innerHTML = intent;
}
function renderFightParty() {
  $('#f-party').innerHTML = `<div class="ptitle">Party</div>` + party().map(h => {
    const used = F.invoked[h.id], need = Math.max(2, h.need - (hasRelic('moth') ? 1 : 0)), bonus = hasRelic('gambler') ? 1 : 0;
    return `<div class="fhero ${used ? 'used' : ''}" data-src="${h.id}" data-tip="${esc(heroTip(h))}">${heroImg(h, 3)}<div class="fh-b"><div class="fh-n">${h.name}</div>
      <div class="fh-p">${h.passive}</div>
      <button class="btn sm inv" data-inv="${h.id}" ${used ? 'disabled' : ''}>${used ? 'Spent' : `Invoke ${need}+${bonus ? ' (+1)' : ''}`}</button><div class="fh-i">${h.inv}</div></div></div>`;
  }).join('') + `<div class="small dim" style="margin-top:6px">Each hero may be invoked once per fight: roll 2d6, meet the number.</div>`;
  $$('#f-party [data-inv]').forEach(b => b.onclick = () => invokeHero(b.dataset.inv));
}
function renderFightSide() {
  if (!F) return;
  $('#f-side').innerHTML = `<div class="ptitle">Reliquary</div><div class="reliclist">${relicsD().map(r => relicHTML(r)).join('') || '<span class="dim small">none</span>'}</div>
    <div class="ptitle">Satchel</div><div class="reliclist">${G.scrolls.map((id, i) => { const s = scroll(id); return `<div class="relic scrollbtn usable" data-si="${i}" data-tip="${esc(`<b>${s.name}</b><br>${s.desc}<br><i>Click to use${s.sel ? ' on selected cards' : ''}.</i>`)}">${relicIcon(s.ic, s.col, 3)}</div>`; }).join('') || '<span class="dim small">empty</span>'}</div>
    <div class="ptitle">Deck</div><div class="pile">Draw <b>${F.draw.length}</b> · Discard <b>${F.disc.length}</b></div>
    <div class="pile">Rites performed: <b>${F.rites}</b></div>
    <button class="btn sm ghost" id="f-rites">Rite table</button>`;
  $$('#f-side .scrollbtn').forEach(el => el.onclick = () => useScroll(+el.dataset.si));
  $('#f-rites').onclick = ritesModal;
}
function renderFightHP() {
  if (!F) return; const mh = maxHP();
  $('#f-hpw').innerHTML = `<div class="hpbar"><i style="width:${G.hp / mh * 100}%"></i><span>${icon('heart', 2, 'inl')} ${G.hp} / ${mh}</span></div><div class="fate">${icon('fate', 2, 'inl')} Fate <b>${G.fate}</b></div>`;
}
function renderHand(newIds = []) {
  if (!F) return; sortHand();
  const h = $('#f-hand'); const n = F.hand.length;
  h.innerHTML = F.hand.map((c, i) => {
    const rot = (i - (n - 1) / 2) * 2.2, lift = Math.abs(i - (n - 1) / 2) * 3;
    return `<div class="hslot" style="--rot:${rot}deg;--lift:${lift}px">${cardHTML(c, (F.sel.has(c.id) ? 'sel ' : '') + (newIds.includes(c.id) ? 'deal' : ''))}</div>`;
  }).join('');
  h.querySelectorAll('.card').forEach((el, i) => { el.style.animationDelay = (i * 0.03) + 's'; el.onclick = () => toggleSel(+el.dataset.cid); });
  $('#f-disc').textContent = `Discard (${F.discards})`;
  $('#f-disc').disabled = !F.sel.size || F.discards <= 0;
  $('#f-play').disabled = !F.sel.size;
  $$('#f-sort button').forEach(b => b.classList.toggle('on', b.dataset.sort === SORT));
}
function toggleSel(id) {
  if (!F || F.busy) return;
  if (F.sel.has(id)) F.sel.delete(id); else { if (F.sel.size >= 5) { toast('A Rite holds at most 5 cards.'); return; } F.sel.add(id); }
  sfx('card');
  $$('#f-hand .card').forEach(el => el.classList.toggle('sel', F.sel.has(+el.dataset.cid)));
  $('#f-disc').disabled = !F.sel.size || F.discards <= 0; $('#f-play').disabled = !F.sel.size;
  updatePreview();
}
function selCards() { return F.hand.filter(c => F.sel.has(c.id)); }
function updatePreview() {
  if (!F) return; const cards = selCards();
  if (!cards.length) { $('#f-rite').innerHTML = '<span class="dim">Select up to 5 cards</span>'; setScore(0, 0); $('#f-est').innerHTML = ''; return; }
  const ctx = computeRite(cards, true); const R = RITES[ctx.key];
  $('#f-rite').innerHTML = `${R.name} <small>Lv ${ctx.lv}</small>`;
  setScore(R.chips + R.lc * (ctx.lv - 1), R.mult + R.lm * (ctx.lv - 1));
  const kill = ctx.dmg >= F.hp;
  $('#f-est').innerHTML = `≈ <b class="${kill ? 'gold' : ''}">${ctx.dmg.toLocaleString()}</b> damage${ctx.why.length ? ` <span class="red">(halved: ${ctx.why.join(', ')})</span>` : ''}${kill ? ' <span class="gold">— lethal</span>' : ''}`;
}
function fmtN(n) { n = Math.round(n * 100) / 100; return n >= 10000 ? Math.round(n).toLocaleString() : String(n); }
function setScore(c, m) { $('#f-chips').textContent = fmtN(c); $('#f-mult').textContent = fmtN(m); }
function bubble(el, text, cls) {
  if (!el) return; const r = el.getBoundingClientRect(); const b = document.createElement('div');
  b.className = 'bub ' + cls; b.textContent = text; b.style.left = (r.left + r.width / 2) + 'px'; b.style.top = (r.top + 6) + 'px';
  document.body.appendChild(b); setTimeout(() => b.remove(), 1100);
}
function pulse(el, cls = 'trig') { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ── playing ──
async function playRite() {
  if (!F || F.busy || !F.sel.size) return;
  F.busy = true;
  const cards = selCards();
  F.hand = F.hand.filter(c => !F.sel.has(c.id)); F.sel.clear(); renderHand();
  $('#f-played').innerHTML = cards.map(c => cardHTML(c, 'played')).join('');
  const ctx = computeRite(cards, false);
  await animateRite(ctx);
  G.best = Math.max(G.best || 0, ctx.dmg);
  if (ctx.heal) healHP(ctx.heal);
  if (hasRelic('leech')) healHP(2);
  damageMonster(ctx.dmg, true);
  F.lastKey = ctx.key; F.rites++; F.bonus = { chips: 0, mult: 0, x: 1 };
  cards.forEach(c => { if (ctx.shatter.includes(c)) { destroyCard(c); bubble($(`#f-played [data-cid="${c.id}"]`), 'SHATTERED', 'x'); } else F.disc.push(c); });
  if (F.ab.includes('thorns')) { hurt(cards.length); bubble($('#f-hpw'), `−${cards.length} thorns`, 'hurt'); renderFightHP(); }
  await sleep(450);
  $('#f-played').innerHTML = ''; $('#f-dmg').innerHTML = ''; setScore(0, 0); $('#f-rite').innerHTML = '';
  if (F.hp <= 0) { await monsterDies(); return; }
  if (G.hp <= 0) { F.done(false); return; }
  await monsterTurn();
  if (!F) return;
  if (G.hp <= 0) { F.done(false); return; }
  drawCards(handSize() - F.hand.length);
  F.busy = false; renderFight();
}
async function animateRite(ctx) {
  const R = RITES[ctx.key]; let i = 0;
  $('#f-rite').innerHTML = `<span class="ritename">${R.name}</span> <small>Lv ${ctx.lv}</small>`; pulse($('#f-rite'), 'pop');
  const base = 160;
  for (const e of ctx.ev) {
    const cardEl = e.card ? $(`#f-played [data-cid="${e.card.id}"]`) : null;
    const srcEl = e.src ? (e.src === 'invoke' ? $('#f-party') : $(`#scr-fight [data-src="${e.src}"]`)) : null;
    const at = cardEl || srcEl;
    if (e.type === 'base') { setScore(e.chips, e.mult); sfx('click'); await sleep(base * 1.4); continue; }
    if (e.type === 'dead') { pulse(cardEl, 'deadc'); bubble(cardEl, 'NOTHING', 'dead'); sfx('fail'); await sleep(base); continue; }
    if (cardEl) pulse(cardEl, 'pop'); if (srcEl) pulse(srcEl, 'trig');
    if (e.type === 'chip') { bubble(at, `+${e.n}`, 'chips'); pulse($('#f-chips'), 'bump'); sfx('chip', i); }
    else if (e.type === 'mult') { bubble(at, `+${e.n} Mult`, 'mult'); pulse($('#f-mult'), 'bump'); sfx('mult', i); }
    else if (e.type === 'x') { bubble(at, `×${e.n} Mult`, 'x'); pulse($('#f-mult'), 'bump'); sfx('xmult'); }
    setScore(e.chips, e.mult); i++;
    await sleep(base * (e.type === 'x' ? 1.6 : 1));
  }
  setScore(ctx.chips, ctx.mult);
  const big = ctx.dmg >= F.hp;
  $('#f-dmg').innerHTML = `<div class="dmgnum ${big ? 'blaze' : ''}">${ctx.dmg.toLocaleString()}</div>${ctx.why.length ? `<div class="red small">Halved by ${ctx.why.join(', ')}</div>` : ''}`;
  if (big) $('#f-score').classList.add('burn');
  await sleep(base * 2.6);
  $('#f-score').classList.remove('burn');
}
function damageMonster(n, fromRite) {
  if (!F) return; F.hp = Math.max(0, F.hp - n);
  const spr = $('#f-mon .monspr'); pulse(spr, 'hurt'); bubble(spr, `−${Math.round(n).toLocaleString()}`, 'dmg');
  if (!fromRite) sfx('hit'); else sfx(n >= F.maxHp * 0.5 ? 'big' : 'hit');
  const sh = $('#scr-fight'); pulse(sh, n >= F.maxHp * 0.5 ? 'shakeBig' : 'shake');
  renderFightMon();
}
async function monsterDies() {
  const spr = $('#f-mon .monspr'); spr.classList.add('dying'); sfx('big');
  await sleep(900); spr.classList.remove('dying'); $('#f-mon').dataset.mon = '';
  F.done(true);
}
async function monsterTurn() {
  const spr = $('#f-mon .monspr');
  if (F.stun) { F.stun--; bubble(spr, 'STUNNED', 'x'); await sleep(500); }
  else {
    const hits = F.ab.includes('double') ? 2 : 1;
    for (let k = 0; k < hits; k++) {
      pulse(spr, 'lunge'); await sleep(220);
      const d = Math.max(0, F.dmg - (hasRelic('thornveil') ? 1 : 0));
      if (F.shield) { F.shield--; bubble($('#f-hpw'), 'WARDED', 'chips'); sfx('bell'); }
      else {
        hurt(d); bubble($('#f-hpw'), `−${d}`, 'hurt'); pulse($('#scr-fight'), 'shake');
        if (F.ab.includes('leech')) { F.hp = Math.min(F.maxHp, F.hp + d * 3); bubble(spr, `+${d * 3}`, 'heal'); }
        if (F.ab.includes('curse') && Math.random() < 1 / 3) { addCurse(1); F.disc.push(G.deck[G.deck.length - 1]); toast('A Cursed card is forced into your deck.'); }
        if (hasRelic('martyr')) F.martyr += d;
      }
      renderFightHP(); renderFightMon();
      await sleep(260);
      if (G.hp <= 0) return;
    }
  }
  if (F.ab.includes('regen') && F.hp < F.maxHp) { const h = Math.ceil(F.maxHp * 0.08); F.hp = Math.min(F.maxHp, F.hp + h); bubble(spr, `+${h}`, 'heal'); }
  if (F.ab.includes('enrage')) { F.dmg += 2; bubble(spr, 'FRENZY +2', 'mult'); }
  renderFightMon();
}
async function discardSel() {
  if (!F || F.busy || !F.sel.size || F.discards <= 0) return;
  F.busy = true; F.discards--;
  const cards = selCards(); F.hand = F.hand.filter(c => !F.sel.has(c.id)); F.sel.clear();
  cards.forEach(c => F.disc.push(c)); sfx('card');
  drawCards(handSize() - F.hand.length);
  F.busy = false; renderFight();
}
async function invokeHero(id) {
  if (!F || F.busy || F.invoked[id]) return;
  const h = hero(id);
  const sel = selCards();
  if (h.sel && !sel.length) { toast(`Select up to ${h.sel} card${h.sel > 1 ? 's' : ''} first for ${h.name}.`); return; }
  F.busy = true;
  F.invoked[id] = true;
  const need = Math.max(2, h.need - (hasRelic('moth') ? 1 : 0)), bonus = hasRelic('gambler') ? 1 : 0;
  pulse($(`#f-party [data-src="${id}"]`), 'trig');
  const ok = await diceCheck(need, bonus, `${h.name} — Invoke`);
  if (ok) { const txt = h.invoke.call(h, F, sel.slice(0, h.sel || 5)); sfx('invoke'); toast(txt); log(`${h.name}: ${txt}`); }
  else toast(`${h.name}'s invocation fails.`);
  F.busy = false;
  if (F.hp <= 0) { F.busy = true; await monsterDies(); return; }
  renderFight();
}
async function useScroll(i) {
  if (!F || F.busy) return;
  const s = scroll(G.scrolls[i]); const sel = selCards();
  if (s.sel && !sel.length) { toast(`Select up to ${s.sel} card${s.sel > 1 ? 's' : ''} first.`); return; }
  G.scrolls.splice(i, 1);
  s.use(sel.slice(0, s.sel || 0)); sfx('invoke'); toast(`${s.name} used.`);
  F.sel = new Set([...F.sel].filter(id => F.hand.some(c => c.id === id)));
  if (F.hp <= 0) { F.busy = true; await monsterDies(); return; }
  renderFight();
}
function fightKey(e) {
  if (!F || F.busy || $('#scr-fight').classList.contains('hide')) return;
  if (e.key === 'Enter') playRite();
  else if (e.key === 'd' || e.key === 'D') discardSel();
  else if (e.key === 's' || e.key === 'S') { SORT = SORT === 'rank' ? 'suit' : 'rank'; renderHand(); }
  else if (/^[1-9]$/.test(e.key)) { const c = F.hand[+e.key - 1]; if (c) toggleSel(c.id); }
}

// ── best-play search (used by the hint button and test bot) ──
function bestPlay() {
  const H = F.hand, n = H.length; let best = null;
  const rec = (start, cur) => {
    if (cur.length) { const ctx = computeRite(cur, true); if (!best || ctx.dmg > best.dmg) best = { dmg: ctx.dmg, cards: cur.slice(), key: ctx.key }; }
    if (cur.length === 5) return;
    for (let i = start; i < n; i++) { cur.push(H[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []); return best;
}
function hint() {
  if (!F || F.busy) return; const b = bestPlay(); if (!b) return;
  F.sel = new Set(b.cards.map(c => c.id)); renderHand(); updatePreview();
}

// ── wiring ──
window.addEventListener('load', () => {
  $('#f-play').onclick = playRite; $('#f-disc').onclick = discardSel; $('#f-hint').onclick = hint;
  $$('#f-sort button').forEach(b => b.onclick = () => { SORT = b.dataset.sort; renderHand(); });
});

// ── test hooks (?test) ──
function testHooks() {
  const H = {
    G: () => G, F: () => F, META: () => META,
    modalOpen: () => !$('#modal').classList.contains('hide'),
    clickModal() {
      const m = $('#modal'); if (m.classList.contains('hide')) return false;
      const p = m.querySelector('.pickable'); if (p) { p.click(); return true; }
      const bs = [...m.querySelectorAll('[data-b]')].filter(b => !b.disabled);
      const pref = bs.find(b => !b.classList.contains('ghost') && !b.classList.contains('danger')) || bs[0];
      if (pref) { pref.click(); return true; } return false;
    },
    async bot(maxSteps = 4000, opts = {}) {
      const out = { steps: 0 };
      for (let s = 0; s < maxSteps; s++) {
        out.steps = s;
        await new Promise(r => setTimeout(r, 0));
        if (!G || G.over) break;
        if (H.modalOpen()) { H.clickModal(); continue; }
        if (!$('#diceov').classList.contains('hide')) continue;
        if (F && !F.busy && !$('#scr-fight').classList.contains('hide')) {
          const b = bestPlay();
          const weak = b && b.dmg < F.hp && ['high', 'pair'].includes(b.key) && F.discards > 0;
          for (const h of party()) if (!F.invoked[h.id] && !h.sel) { await invokeHero(h.id); break; }
          if (!F || F.busy) continue;
          if (weak) { const keep = new Set(b.cards.map(c => c.id)); const junk = F.hand.filter(c => !keep.has(c.id)).sort((a, c) => a.rank - c.rank).slice(0, 5); F.sel = new Set(junk.map(c => c.id)); await discardSel(); }
          else { F.sel = new Set(b.cards.map(c => c.id)); await playRite(); }
          continue;
        }
        if (G.phase === 'start' && !BUSY) { const v = startVerts(); makeCamp(pick(v)); continue; }
        if (G.phase === 'act' && !BUSY) {
          if (G.hp < maxHP() * 0.5 && canPay(costOf('tend'))) { pay(costOf('tend')); healHP(15); continue; }
          if (canPay(costOf('outpost')) && buildableVerts().length) { const vs = buildableVerts().sort((a, b) => vval(b) - vval(a)); pay(costOf('outpost')); G.map.verts[vs[0]].b = 1; drawMapBase(); continue; }
          if (canPay(costOf('citadel'))) { const v = G.map.verts.findIndex(v => v.b === 1); if (v >= 0) { pay(costOf('citadel')); G.map.verts[v].b = 2; continue; } }
          if (canPay(costOf('tome')) && Math.random() < 0.5) { pay(costOf('tome')); levelRite(pick(['pair', 'two', 'three', 'flush', 'straight'])); continue; }
          if (G.heroes.length < 3 && canPay(costOf('summon'))) { pay(costOf('summon')); const pool = HEROES.filter(h => isUnlocked(h) && !G.heroes.includes(h.id)); G.heroes.push(pick(pool).id); continue; }
          if (G.hp < maxHP() * 0.35 && opts.rest !== false) { rest(); continue; }
          const fr = frontier().filter(canDelve);
          const th = fr.find(i => G.map.hexes[i].enc === 'throne');
          const safe = fr.filter(i => G.map.hexes[i].enc !== 'lair' || G.turn > 6 || G.heroes.length >= 3);
          if (G.hp < maxHP() * 0.45 && opts.rest !== false) { rest(); continue; }
          const target = th !== undefined ? th : pick(safe.length ? safe : fr);
          if (target !== undefined) delve(target);
          continue;
        }
      }
      out.act = G.act; out.turn = G.turn; out.hp = G.hp; out.over = G.over; out.kills = G.stats.kills; out.best = G.best; out.deck = G.deck.length; out.relics = G.relics.slice(); out.heroes = G.heroes.slice();
      return out;
    },
  };
  const vval = i => { const v = G.map.verts[i]; return v.hs.reduce((s, h) => s + pips(G.map.hexes[h].num), 0); };
  return H;
}
