// DOM user interface: HUD, dialogue panel, brainstorm board and the computer.
import { WPY, TRAITS, CARDS, JOURNALS, GRANTS, EQUIP, ROLES, FIELDS, TITLES, HOBBIES, HOME, RESEARCH_EQUIP, PLATS, EQUIP_CATS, SUPPLIES, HIRE_COST } from './data.js';
import {
  G, clamp, shuffle, fmt$, fmtK, dateStr, wk, year, term, team, person, proj, card, roleName, has, relOf,
  scoreIdea, ideaTitle, joinProject, stageLabel, weeklyIncome, weeklyCosts, capacity, tenureScore, TENURE_BAR, costBreakdown, COST_LABELS, personCost, cardNeeds, supplyCost, boosts,
  grantChance, chanceWord, submitProposal, queueVisit, busy, title, acceptOfferChance, addPerson, log, salary, equipFactor, save, projNeeds, borrowing, mismatch, unlockCards, refreshUnlocks, expertiseIn, addRep, makePerson,
} from './sim.js';
import { MAIL_ACTIONS, EXT } from './events.js';
import { QUALITY, setQuality } from './gfx.js';
import { sayTo, judgeRemark, AI, aiStatus, aiDownMsg } from './say.js';
import { interestText, fitScore } from './career.js';
import { renderCalendar, bindCalendar, calendarBadge } from './calendar.js';
const fitTag = (p, pr) => { const f = fitScore(p, pr); return f >= 1.5 ? '💚 dream fit' : f >= 1 ? '✓ in their area' : '✗ not their interest'; };
const interestBlock = p => { const t = interestText(p); return `<div style="font-size:12px;margin-top:8px">🧭 <b>Wants to work on</b> ${esc(t.plats)}${t.goal ? `, toward <b>${esc(t.goal)}</b>` : ''} · prefers ${esc(t.style)}. Dream: ${esc(t.dream)}.</div>`; };
import { fin, netWorth, salaryWeekly, livingWeekly, equityValue, healthWord, STAGES, foundWithStudent } from './money.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const UI = { app: 'mail', mailSel: null, propFor: null, onSpeak: () => { }, onDialogueEnd: () => { }, onCloseComputer: () => { }, onNewGame: () => { }, dialog: false, computer: false, sync: () => { } };

// ---------------- HUD ----------------
export function hud() {
  if (!G) return;
  const d = G.lastDelta;
  $('#hDate').textContent = dateStr();
  const hrLeft = G.hr && G.hr.left > 0 ? ` · 🧑‍⚖️ HR: ${G.hr.left} meeting${G.hr.left > 1 ? 's' : ''} left` : '';
  const prob = G.flags.probation && !G.tenured ? ` · ⚠️ Probation: ${Math.max(0, G.flags.probation.until - G.week)} wk` : '';
  $('#hLab').textContent = `${G.labName} · ${title()}${hrLeft}${prob}`;
  $('#hMoney').textContent = fmtK(G.money);
  $('#hMoney').className = G.money < 0 ? 'neg' : '';
  $('#hDelta').textContent = (d >= 0 ? '+' : '') + fmt$(d) + '/wk';
  $('#hDelta').className = 'sub ' + (d >= 0 ? 'pos' : 'neg');
  const run = d < 0 && G.money > 0 ? Math.floor(G.money / -d) : null;
  $('#hRunway').textContent = run !== null ? `runway ${run} wk` : '';
  $('#hRunway').className = 'sub ' + (run !== null && run < 20 ? 'neg' : '');
  $('#hRep').textContent = Math.round(G.rep);
  $('#hEnergy').style.width = G.energy + '%';
  $('#hEnergy').style.background = G.energy < 25 ? '#e05a4a' : G.energy < 50 ? '#e0a83a' : '#5ac06a';
  $('#hEnergyN').textContent = Math.round(G.energy);
  $('#hCulture').textContent = Math.round(G.culture);
  $('#hCultureW').title = `Lab culture ${Math.round(G.culture)}/100: how safe people feel admitting mistakes. High culture = higher morale, fewer hidden accidents and fewer bad results.`;
  $('#hGoodwill').textContent = Math.round(G.goodwill);
  if (G.life) {
    const L = G.life;
    $('#hHome').textContent = Math.round(L.home);
    $('#hHomeL').textContent = L.partner ? (L.kids.length ? 'family' : 'relationship') : 'social life';
    $('#hHomeW').title = `${L.partner ? 'How things are at home' : 'Your social life'}: ${Math.round(L.home)}/100. Long work weeks and missed events lower it.`;
    $('#hHome').parentElement.style.color = L.home < 30 ? '#e05a4a' : '';
    $('#hSelf').textContent = Math.round(L.self);
    $('#hSelfW').title = `Your own wellbeing: ${Math.round(L.self)}/100. Below 30 your energy suffers. Below 12 your body forces the issue.`;
    $('#hSelf').parentElement.style.color = L.self < 30 ? '#e05a4a' : '';
  }
  $("#hWorth").textContent = fmtK(netWorth());
  const q = G.queue.length;
  $('#hQueue').textContent = q ? `🚪 ${q} waiting` : '';
  $('#hDnd').classList.toggle('on', !!G.dnd);
  $('#hDnd').innerHTML = G.dnd ? '🚫<span class="lbl"> Door closed</span>' : '🚪<span class="lbl"> Door open</span>';
  $('#hDnd').title = G.dnd ? 'Door closed' : 'Door open';
  const unread = G.inbox.filter(m => !m.read).length;
  $('#hMail').textContent = unread ? `✉️ ${unread}` : '';
  document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', (+b.dataset.s === 0 && G.paused) || (!G.paused && +b.dataset.s === G.speed)));
}
export function weekBar(f) { $('#weekbar').style.width = (f * 100) + '%'; }

export function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4800);
}
export function tip(text, x, y) {
  const t = $('#tip');
  if (!text) { t.style.display = 'none'; return; }
  t.style.display = 'block'; t.textContent = text; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px';
}

// ---------------- dialogue ----------------
let typeTimer = null;
const whoName = w => !w ? '' : (w.title ? w.title + ' ' : '') + (w.first && w.last ? `${w.first} ${w.last}` : w.name || w.first || '');
const whoSub = w => !w ? '' : w.role && ROLES[w.role] ? roleName(w) : w.role || '';

export function showDialogue(node, lastWho) {
  UI.dialog = true;
  const box = $('#dialog'); box.classList.add('show');
  if (!node) return endDialogue();
  if (typeof node === 'string') node = { who: lastWho, text: node, choices: [{ t: 'Continue', do: () => null }] };
  if (node.type === 'brainstorm') return showBrainstorm(node);
  $('#brain').classList.remove('show');
  const who = node.who || lastWho;
  UI.onSpeak(who);
  $('#dName').textContent = whoName(who);
  $('#dRole').textContent = whoSub(who);
  const txt = $('#dText'); const full = node.text; let i = 0;
  clearInterval(typeTimer); txt.textContent = '';
  const ch = $('#dChoices'); ch.innerHTML = ''; ch.classList.remove('show');
  const finish = () => { clearInterval(typeTimer); txt.textContent = full; ch.classList.add('show'); };
  typeTimer = setInterval(() => { i += 3; txt.textContent = full.slice(0, i); if (i >= full.length) finish(); }, 16);
  txt.onclick = finish;
  node.choices.forEach((c, k) => {
    const b = document.createElement('button'); b.className = 'choice';
    const cost = c.cost || {};
    const lacks = (cost.energy && G.energy < cost.energy) ? 'Not enough energy' : (cost.money && G.money < cost.money) ? 'Not enough money' : c.dis ? 'Not enough personal savings' : '';
    b.innerHTML = `<span class="ck">${k + 1}</span><span class="ct">${esc(c.t)}</span>${c.hint ? `<span class="ch">${esc(c.hint)}</span>` : ''}${lacks ? `<span class="cl">${lacks}</span>` : ''}`;
    if (lacks) b.disabled = true;
    b.onclick = () => {
      if (!ch.classList.contains('show')) { finish(); return; }
      if (cost.energy) G.energy = clamp(G.energy - cost.energy, 0, 100);
      let r;
      try { r = c.do(); } catch (e) { console.error(e); r = null; }
      hud(); UI.sync();
      showDialogue(r, who);
    };
    ch.appendChild(b);
  });
  // free-text remark to a lab member
  const isStudent = who && who.traits && who.id && !who.gone;
  if (isStudent && !UI.said) {
    const sb = document.createElement('button'); sb.className = 'choice saybtn';
    sb.innerHTML = `<span class="ck">💬</span><span class="ct">Say something of your own…</span><span class="ch">Type anything. The game rates it. Consequences may follow.</span>`;
    sb.onclick = () => { if (!ch.classList.contains('show')) { finish(); return; } openSay(node, who); };
    ch.appendChild(sb);
  }
}
function openSay(node, who) {
  const ch = $('#dChoices');
  ch.innerHTML = `<div class="saybox"><textarea id="sayIn" maxlength="240" placeholder="Say something to ${esc(who.first)}…"></textarea>
    <div class="prow"><button id="sayGo" class="primary">Say it</button><button id="sayCancel">Never mind</button><span class="muted" style="font-size:12px">Kind, funny, weird or terrible: the game judges it.</span></div></div>`;
  const ta = $('#sayIn'); ta.focus();
  $('#sayCancel').onclick = () => showDialogue(node, who);
  let busyJudging = false;
  const go = async () => {
    const text = ta.value.trim(); if (!text || busyJudging) return;
    busyJudging = true;
    $('#sayGo').disabled = true; $('#sayCancel').disabled = true; ta.disabled = true;
    if (AI.on) $('#dText').innerHTML = `<div class="sayq">You: "${esc(text)}"</div><div class="sayv">🤔 ${esc(who.first)} is processing what you just said… <span class="muted" style="font-size:12px">(local AI is judging)</span></div>`;
    const judged = await judgeRemark(who, text);
    UI.said = true;
    const r = sayTo(who, text, judged);
    const meter = (lbl, v, col) => `<div class="smeter"><span>${lbl}</span><div class="mbar"><div style="width:${v}%;background:${col}"></div></div><b>${v}</b></div>`;
    $('#dText').innerHTML = `<div class="sayq">You: "${esc(text)}"</div><div class="sayv">${r.emoji} ${esc(r.verdict)}</div>
      ${meter('Problematic', r.problem, '#e05a4a')}${meter('Wholesome', r.wholesome, '#5ac06a')}${meter('Unhinged', r.unhinged, '#a070e0')}
      ${r.lines.map(l => `<div class="sayl">${esc(l)}</div>`).join('')}
      <div class="muted" style="font-size:11px;margin-top:6px">${r.ai ? `Judged by local AI (${esc(r.ai)})` : r.aiError ? `Judged by word list: ${esc(r.aiError)}` : 'Judged by word list'}</div>`;
    $('#dText').onclick = null;
    UI.onSpeak(who);
    hud(); UI.sync();
    const severe = r.problem >= 70 || r.flags.creepy || r.flags.protected;
    ch.innerHTML = '';
    const b = document.createElement('button'); b.className = 'choice';
    b.innerHTML = `<span class="ck">1</span><span class="ct">${severe ? 'They leave. The conversation is over.' : 'Continue the conversation'}</span>`;
    b.onclick = () => severe ? endDialogue() : showDialogue(node, who);
    ch.appendChild(b);
  };
  $('#sayGo').onclick = go;
  ta.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
}
export function endDialogue() {
  clearInterval(typeTimer); UI.said = false;
  UI.dialog = false; $('#dialog').classList.remove('show'); $('#brain').classList.remove('show');
  UI.onDialogueEnd();
}
document.addEventListener('keydown', e => {
  if (!UI.dialog || /TEXTAREA|INPUT/.test(e.target.tagName)) return;
  const n = parseInt(e.key); if (n >= 1 && n <= 9) { const b = document.querySelectorAll('#dChoices .choice')[n - 1]; if (b && !b.disabled) b.click(); }
  if (e.key === ' ' || e.key === 'Enter') { const t = $('#dText'); if (t.onclick && !$('#dChoices').classList.contains('show')) t.onclick(); }
});

// ---------------- brainstorm ----------------
function showBrainstorm(node) {
  const A = node.who;
  UI.onSpeak(A);
  $('#dName').textContent = whoName(A); $('#dRole').textContent = 'Brainstorm';
  $('#dText').textContent = `${A.first} hands you a marker. Pick one system, one technique and one goal.`;
  $('#dChoices').innerHTML = ''; $('#dChoices').classList.remove('show');
  const per = 6 + (G.equip.whiteboards ? 2 : 0);
  const deal = () => {
    node.hand = {};
    for (const k of ['sys', 'tech', 'goal']) {
      let pool = shuffle(CARDS.filter(c => c.k === k && G.unlocked.includes(c.id)));
      const seed = node.seed && card(node.seed).k === k ? card(node.seed) : null;
      if (seed) pool = [seed, ...pool.filter(c => c !== seed)];
      node.hand[k] = pool.slice(0, per).map(c => c.id);
    }
    node.pick = { sys: null, tech: null, goal: null };
    if (node.seed) node.pick[card(node.seed).k] = node.seed;
  };
  if (!node.hand) deal();
  const B = $('#brain'); B.classList.add('show');
  const render = () => {
    const sysC = node.pick.sys ? card(node.pick.sys) : null;
    const fitsSys = c => !sysC || c.k === 'sys' || !c.fits || c.fits === 'any' || c.fits.includes(sysC.plat);
    const exStar = id => { const e = (G.expertise || {})[id] || 0; return e ? `<span class="bx" title="Your lab has published with this ${e} time${e > 1 ? 's' : ''}">${'★'.repeat(Math.min(3, e))}</span>` : ''; };
    const handFor = k => { let ids = node.all ? CARDS.filter(c => c.k === k && G.unlocked.includes(c.id)).map(c => c.id) : [...node.hand[k]]; if (node.pick[k] && !ids.includes(node.pick[k])) ids.unshift(node.pick[k]); if (sysC && k !== 'sys') ids.sort((a, b) => (fitsSys(card(b)) ? 1 : 0) - (fitsSys(card(a)) ? 1 : 0)); return ids; };
    const total = CARDS.filter(c => G.unlocked.includes(c.id)).length;
    const rows = [['sys', 'System'], ['tech', 'Technique'], ['goal', 'Goal']].map(([k, lbl]) => `<div class="brow"><div class="blbl">${lbl}</div>${handFor(k).map(id => { const c = card(id); const needs = cardNeeds(c, sysC); const miss = needs.filter(n => !G.equip[n] && !borrowing(n)); const fit = fitsSys(c); return `<button class="bcard ${node.pick[k] === id ? 'sel' : ''} ${fit ? '' : 'nofit'}" data-k="${k}" data-id="${id}" title="${fit ? '' : `Doesn't work with ${esc(PLATS[sysC.plat])}`}${c.k === 'sys' ? `Platform: ${esc(PLATS[c.plat])}. Needs: ${(c.needs || []).map(n => EQUIP[n].name).join(', ') || 'nothing special'}` : ''}"><span class="bi">${c.icon}</span><span class="bn">${esc(c.name)}</span>${exStar(id)}${c.k === 'sys' ? `<span class="bp">${esc(PLATS[c.plat])}</span>` : ''}${miss.length ? `<span class="bm" title="Needs ${miss.map(m => EQUIP[m].name).join(', ')}">needs ${miss.map(m => EQUIP[m].icon).join('')}</span>` : ''}${fit ? '' : '<span class="bm">✗ mismatch</span>'}</button>`; }).join('')}</div>`).join('');
    const ids = [node.pick.sys, node.pick.tech, node.pick.goal];
    let prev = `<div class="bprev empty">Pick a card from each row to see the idea take shape.</div>`;
    if (ids.every(Boolean)) {
      const sc = scoreIdea(ids);
      const bar = (lbl, v, col) => `<div class="bbar"><span>${lbl}</span><div class="bt"><div style="width:${v * 10}%;background:${col}"></div><div class="unc" style="left:${Math.max(0, v - 1.5) * 10}%;width:30%"></div></div><b>${v}</b></div>`;
      let react = 0;
      if (has(A, 'ambitious') || has(A, 'dreamer')) react += sc.nov - 5;
      if (has(A, 'anxious') || has(A, 'perfectionist')) react += sc.feas - 5;
      if (has(A, 'skeptic') && sc.hype) react -= 4;
      if (sc.bad.length) react -= 4;
      const face = react > 2 ? '🤩' : react > 0 ? '🙂' : react < -1 ? '😬' : '😐';
      prev = `<div class="bprev"><div class="btitle">"${esc(ideaTitle(ids))}"</div>
        ${bar('Feasibility', sc.feas, '#5ac06a')}${bar('Novelty', sc.nov, '#a070e0')}${bar('Fundability', sc.fund, '#e0a83a')}
        ${sc.notes.map(n => `<div class="bnote">💬 ${esc(n)}</div>`).join('')}
        ${sc.bad.map(b => `<div class="bnote warn">⚠️ ${esc(b)} Feasibility and funding take a big hit.</div>`).join('')}
        ${sc.hype ? `<div class="bnote warn">🔥 Hype risk: huge if real, but results like this are often wrong.</div>` : ''}
        ${sc.missing.length ? `<div class="bnote warn">🧰 Needs ${sc.missing.map(m => EQUIP[m].name + (borrowing(m) ? ' (borrowing)' : '')).join(', ')}. Without it, progress crawls. Buy it, or borrow from a colleague.</div>` : sc.needs.length ? `<div class="bnote">🧰 Uses: ${sc.needs.map(m => EQUIP[m].name).join(', ')}. You have it.</div>` : ''}
        <div class="breact">${A.first}'s reaction: <span>${face}</span></div></div>`;
    }
    B.innerHTML = `<div class="bwrap"><div class="bcards">${rows}</div>${prev}</div>
      <div class="bbtns"><button id="bGo" class="primary" ${ids.every(Boolean) ? '' : 'disabled'}>Commit to this idea</button><button id="bAll">${node.all ? 'Show a smaller hand' : `Show all ${total} ideas you know`}</button><button id="bShuf" ${G.energy < 4 || node.all ? 'disabled' : ''}>🔄 New cards (−4 energy)</button><button id="bNo">Nothing's clicking</button></div>`;
    B.querySelectorAll('.bcard').forEach(b => b.onclick = () => { node.pick[b.dataset.k] = node.pick[b.dataset.k] === b.dataset.id ? null : b.dataset.id; render(); });
    $('#bGo').onclick = () => { B.classList.remove('show'); const r = node.done(ids); hud(); UI.sync(); showDialogue(r, A); };
    $('#bShuf').onclick = () => { G.energy -= 4; node.seed = null; deal(); render(); hud(); };
    $('#bAll').onclick = () => { node.all = !node.all; render(); };
    $('#bNo').onclick = () => { B.classList.remove('show'); showDialogue(node.done(null), A); };
  };
  render();
}

// ---------------- computer ----------------
const APPS = [['mail', '✉️', 'Mail'], ['calendar', '📅', 'Calendar'], ['team', '👥', 'Team'], ['projects', '🧪', 'Projects'], ['grants', '💰', 'Grants'], ['hiring', '🤝', 'Hiring'], ['store', '🛒', 'Lab Store'], ['dept', '🏛️', 'Department'], ['faculty', '🎓', 'Faculty'], ['ventures', '💼', 'Ventures'], ['life', '🏠', 'Life'], ['cv', '📜', 'CV'], ['arxiv', '📰', 'arXiv'], ['settings', '⚙️', 'Settings']];
export function openComputer(app) {
  UI.computer = true; if (app) UI.app = app;
  $('#computer').classList.add('show');
  renderComputer();
}
export function closeComputer() { UI.computer = false; $('#computer').classList.remove('show'); UI.onCloseComputer(); }
export function renderComputer() {
  if (!UI.computer) return;
  const unread = G.inbox.filter(m => !m.read).length;
  const calBadge = calendarBadge();
  $('#osSide').innerHTML = APPS.map(([k, i, n]) => `<button class="osapp ${UI.app === k ? 'on' : ''}" data-app="${k}"><span>${i}</span>${n}${k === 'mail' && unread ? `<em>${unread}</em>` : ''}${k === 'hiring' && G.applicants.length ? `<em>${G.applicants.length}</em>` : ''}${k === 'calendar' && calBadge ? `<em class="star">★${calBadge}</em>` : ''}</button>`).join('') + `<div class="osfoot">${esc(dateStr())}<br>${fmtK(G.money)} · ⚡${Math.round(G.energy)}</div>`;
  $('#osSide').querySelectorAll('.osapp').forEach(b => b.onclick = () => { UI.app = b.dataset.app; renderComputer(); });
  { const on = $('#osSide .osapp.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } // phones: the app bar scrolls sideways
  const body = $('#osBody');
  const scroll = body.scrollTop;
  body.innerHTML = (APP_RENDER[UI.app] || (() => ''))();
  body.scrollTop = scroll;
  (APP_BIND[UI.app] || (() => { }))(body);
}
$('#osClose').onclick = () => closeComputer();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.computer) closeComputer(); });

const footLabel = v => v <= 0 ? 'off' : v >= 100 ? '100% (every single week)' : v >= 50 ? `${v}% (chaos)` : `${v}%`;
const priceOf = k => Math.round(EQUIP[k].cost * (k === 'expansion' && G.flags.expansionDiscount ? 0.6 : 1));
const bar = (v, col, max = 100) => `<div class="mbar"><div style="width:${clamp(v / max * 100, 0, 100)}%;background:${col}"></div></div>`;
const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;

const APP_RENDER = {
  calendar: () => renderCalendar(),
  mail() {
    const sel = G.inbox.find(m => m.id === UI.mailSel) || G.inbox[0];
    if (sel && !sel.read) { sel.read = true; setTimeout(hud, 0); }
    return `<div class="mail"><div class="mlist">${G.inbox.map(m => `<div class="mitem ${m === sel ? 'on' : ''} ${m.read ? '' : 'unread'}" data-id="${m.id}"><b>${esc(m.from)}</b><span>${esc(m.subject)}</span><i>wk ${((m.week - 1) % WPY) + 1}</i></div>`).join('') || '<p class="muted">Inbox zero. Enjoy it.</p>'}</div>
      <div class="mbody">${sel ? `<h3>${esc(sel.subject)}</h3><div class="mfrom">From: ${esc(sel.from)} · Year ${Math.floor((sel.week - 1) / WPY) + 1}, week ${((sel.week - 1) % WPY) + 1}</div><pre>${esc(sel.body)}</pre>
      ${sel.actions ? `<div class="mact">${sel.actions.map((a, i) => `<button data-i="${i}" class="${i === 0 ? 'primary' : ''}">${esc(a.t)}</button>`).join('')}</div>` : ''}${sel.result ? `<div class="mres">${esc(sel.result)}</div>` : ''}` : ''}</div></div>`;
  },
  team() {
    const T = team();
    const projs = G.projects.filter(p => ['running', 'idea', 'results'].includes(p.stage));
    return `<h2>Your team <span class="muted">${T.length}/${capacity()} benches · payroll ${fmt$(T.reduce((s, p) => s + salary(p), 0))}/wk</span></h2>
    <div class="cards">${T.map(p => {
      const rs = T.filter(q => q !== p).map(q => [q, relOf(p, q)]).sort((a, b) => b[1] - a[1]);
      const best = rs[0] && rs[0][1] > 25 ? rs[0][0].first : null; const worst = rs.length && rs[rs.length - 1][1] < -25 ? rs[rs.length - 1][0].first : null;
      if (UI.renaming === p.id) return `<div class="pcard"><div class="prow"><input type="text" id="rnF" value="${esc(p.first)}" maxlength="20" style="width:120px"> <input type="text" id="rnL" value="${esc(p.last)}" maxlength="24" style="width:140px"> <button data-rnsave="${p.id}" class="primary">Save</button> <button data-rncancel>Cancel</button></div></div>`;
      return `<div class="pcard"><div class="ph"><b>${esc(p.first)} ${esc(p.last)} <a class="rn" data-rename="${p.id}" title="Rename">✏️</a></b><span class="muted">${roleName(p)}${p.fellowship > 0 ? ' · 🏆 fellowship' : ''}${p.away ? ' · away' : ''}</span></div>
      <div class="chips">${p.traits.map(t => `<span class="chip" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('')}</div>
      ${(p.expertise || []).length ? `<div class="prow muted" style="font-size:12px">🎓 Background: ${p.expertise.map(id => card(id) ? card(id).name : id).join(', ')}</div>` : ''}
      ${interestBlock(p)}${p.project && proj(p.project) ? `<div class="prow muted" style="font-size:12px">Current project: ${fitTag(p, proj(p.project))}${fitScore(p, proj(p.project)) < 0 ? ' (their morale slowly drops)' : ' (their morale slowly rises)'}</div>` : ''}
      <div class="grid3"><div>Exp ${bar(p.skill.exp, '#4a90d9', 10)}</div><div>Theory ${bar(p.skill.theory, '#a070e0', 10)}</div><div>Code ${bar(p.skill.code, '#40b0a0', 10)}</div></div>
      <div class="grid3"><div>Morale ${bar(p.morale, p.morale < 30 ? '#e05a4a' : '#5ac06a')}</div><div>Stress ${bar(p.stress, p.stress > 70 ? '#e05a4a' : '#e0a83a')}</div><div>Loyalty ${bar(p.loyalty, '#d08ac0')}</div></div>
      <div class="prow">Project: <select data-p="${p.id}"><option value="">(none)</option>${projs.map(j => `<option value="${j.id}" ${p.project === j.id ? 'selected' : ''}>${fitScore(p, j) >= 1 ? '★ ' : ''}${esc(j.title.slice(0, 60))}</option>`).join('')}</select></div>
      <div class="prow muted">${best ? `🤝 Close with ${esc(best)}. ` : ''}${worst ? `⚡ Tension with ${esc(worst)}. ` : ''}Papers: ${p.papers}${p.role === 'grad' ? ` · quals: ${p.quals}` : ''}</div>
      <div class="prow muted">💵 ${(() => { const c = personCost(p); return p.fellowship > 0 ? 'Paid by their fellowship' : `${fmt$(salary(p))}/wk: ${p.role === 'grad' || p.role === 'undergrad' ? 'stipend' : 'salary'} ${fmt$(c.pay)}${c.tuition ? ` + tuition ${fmt$(c.tuition)}` : ''}${c.benefits ? ` + benefits ${fmt$(c.benefits)}` : ''}`; })()}</div>
      <div class="prow"><button data-call="${p.id}" ${busy(p.id) ? 'disabled' : ''}>${busy(p.id) ? 'Already coming by' : 'Call in for a 1:1'}</button> <button data-bs="${p.id}" ${busy(p.id) ? 'disabled' : ''}>Brainstorm together</button></div></div>`;
    }).join('')}</div>`;
  },
  projects() {
    const groups = [['Running', p => p.stage === 'running' || p.stage === 'results'], ['Ideas waiting for a team', p => p.stage === 'idea'], ['Under review', p => p.stage === 'review'], ['Done', p => ['published', 'scooped', 'dead'].includes(p.stage)]];
    const free = team().filter(p => !p.project);
    return `<h2>Projects</h2><p class="muted">Assign people to projects. Progress depends on their skills, morale, stress and whether you own the right equipment. When a project hits 100%, its lead brings you the results.</p>
    ${groups.map(([lbl, f]) => { const ps = G.projects.filter(f); if (!ps.length) return ''; return `<h3>${lbl}</h3>${ps.map(pr => {
      const ef = equipFactor(pr); const ms = pr.members.map(person).filter(Boolean);
      const eqLine = projNeeds(pr.cards).map(k => G.equip[k] ? (G.broken[k] ? `${EQUIP[k].icon} broken` : `${EQUIP[k].icon} ✓`) : borrowing(k) ? `${EQUIP[k].icon} borrowed` : `${EQUIP[k].icon} missing`).join(' ') || 'no special equipment';
      const mm = mismatch(pr.cards);
      const j = pr.journal ? JOURNALS.find(x => x.id === pr.journal) : null;
      return `<div class="jcard ${pr.stage}"><div class="jt">${esc(pr.title)}</div>${pr.parent ? `<div class="jstats">🧬 Research line, step ${(pr.line || 0) + 1}: follows "${esc(pr.parent.slice(0, 70))}"</div>` : ''}
      <div class="chips">${pr.cards.map(id => chip(card(id).icon + ' ' + card(id).name)).join('')}${pr.hype ? chip('🔥 hype', 'warn') : ''}${pr.rivalCollab ? chip('🤝 with Voss', '') : ''}</div>
      <div class="jstats">Feasibility <b>${pr.feas}</b> · Novelty <b>${pr.nov}</b> · Fundability <b>${pr.fund}</b> · <span class="${ef < 1 ? 'neg' : ''}">${eqLine}${ef < 1 ? ` (${Math.round(ef * 100)}% speed)` : ''}</span></div>${mm.length ? `<div class="jstats neg">⚠️ ${esc(mm.join(' '))}</div>` : ''}
      ${pr.stage === 'running' || pr.stage === 'idea' ? `<div class="jprog">${bar(pr.progress, '#4a90d9')}<span>${Math.round(pr.progress)}%</span></div>` : ''}
      <div class="jstats">${stageLabel(pr)}${pr.stage === 'review' && j ? ` at ${j.name}` : ''}${pr.stage === 'published' ? ` · quality ${Math.round(pr.q)}` : ''}</div>
      ${['running', 'idea'].includes(pr.stage) ? `<div class="prow">Team: ${ms.map(m => `<span class="chip mem">${esc(m.first)} <a data-rm="${m.id}" title="remove">×</a></span>`).join('') || '<span class="muted">nobody</span>'}
        <select data-add="${pr.id}"><option value="">+ add person</option>${team().filter(p => p.project !== pr.id).map(p => `<option value="${p.id}">${esc(p.first)} (${roleName(p)}${p.project ? ', busy' : ''})</option>`).join('')}</select>
        <button data-shelve="${pr.id}" class="small">Shelve</button></div>` : ''}</div>`;
    }).join('')}`; }).join('')}
    <h3>Find new directions</h3><div class="prow">📚 Read the literature on
      <select id="litKind"><option value="sys">a new system</option><option value="tech">a new technique</option><option value="goal">a new goal</option></select>
      <button id="litGo" ${G.energy < 10 || G.flags.litWeek === G.week ? 'disabled' : ''}>${G.flags.litWeek === G.week ? 'Done this week' : 'Spend an evening reading (−10 energy)'}</button>
      <span class="muted">You know ${CARDS.filter(c => G.unlocked.includes(c.id)).length} of ${CARDS.length} research ideas. Hiring, conferences, colleagues, new equipment and papers all teach you more.</span></div>
    <h3>New idea</h3><div class="prow">Brainstorm with: <select id="bsWho">${team().map(p => `<option value="${p.id}">${esc(p.first)} ${esc(p.last)}</option>`).join('')}</select> <button id="bsGo">Ask them to come by</button></div>
    ${free.length ? `<p class="muted">Not on any project: ${free.map(p => esc(p.first)).join(', ')}. Idle people get bored and lose morale.</p>` : ''}`;
  },
  grants() {
    const inc = weeklyIncome(), cost = weeklyCosts();
    const pickable = G.projects.filter(p => !['dead', 'scooped'].includes(p.stage));
    return `<h2>Funding</h2><div class="kv"><div>Balance <b class="${G.money < 0 ? 'neg' : ''}">${fmt$(G.money)}</b></div><div>Income <b class="pos">${fmt$(inc)}/wk</b></div><div>Costs <b class="neg">${fmt$(cost)}/wk</b></div><div>Runway <b>${inc - cost >= 0 ? '∞' : Math.max(0, Math.floor(G.money / (cost - inc))) + ' weeks'}</b></div></div>
    <h3>Weekly operating costs</h3><div class="ledger">${(() => { const b = costBreakdown(); return Object.keys(b).filter(k => b[k]).map(k => `<div class="lrow"><span>${COST_LABELS[k]}</span><b>${fmt$(b[k])}</b></div>`).join('') + `<div class="lrow tot"><span>Total</span><b>${fmt$(cost)}/wk</b></div>`; })()}</div>
    <div class="muted" style="font-size:12px">Each running experiment uses supplies (${G.projects.filter(p => p.stage === 'running' && p.members.length).map(p => `${esc(p.title.slice(0, 28))}… ${fmt$(supplyCost(p))}`).join(', ') || 'none running'}). Costs rise 3% every academic year. One-time costs: hiring (${fmt$(HIRE_COST)} relocation), publication fees, travel, repairs.</div>
    <h3>Active grants</h3>${G.grants.map(g => `<div class="row"><b>${esc(g.name)}</b> ${fmt$(g.weekly)}/wk · ends in ${g.ends - G.week} weeks${g.reports ? ' · 📋 reports drain energy' : ''}${g.strings ? ' · 🔗 strings attached' : ''}</div>`).join('') || '<p class="muted">None. You are living on startup money.</p>'}
    <h3>Pending decisions</h3>${G.pending.map(p => `<div class="row"><b>${esc(GRANTS.find(g => g.id === p.type).name)}</b>: "${esc(p.title)}" · decision around week ${((p.decide - 1) % WPY) + 1}</div>`).join('') || '<p class="muted">Nothing pending.</p>'}
    <h3>Open calls</h3>${G.calls.length ? G.calls.map(c => { const gt = GRANTS.find(g => g.id === c.id); const open = UI.propFor === c.id; return `<div class="gcard"><div><b>${gt.name}</b> · ${gt.lump ? `${fmtK(gt.amount)} paid at once` : `${fmtK(gt.amount)} over ${gt.years} year${gt.years > 1 ? 's' : ''}`} · ${gt.rolling ? '<span class="pos">rolling, always open</span>' : `deadline in ${c.deadline - G.week} weeks`}${gt.fast ? ' · ⚡ decision in about a month' : ''}${gt.asstOnly ? ' · 🌱 early-career only' : ''}${gt.minRep ? ` · needs reputation ${gt.minRep}+${G.rep < gt.minRep ? ' <span class="neg">(you are below it)</span>' : ''}` : ''}</div><div class="muted">${gt.desc}</div>
      ${open ? (pickable.length ? `<div class="pform"><label>Project to pitch <select id="pProj">${pickable.map(p => `<option value="${p.id}">${esc(p.title.slice(0, 70))} (F${p.feas}/N${p.nov}/U${p.fund})</option>`).join('')}</select></label>
      <label>Framing <select id="pFrame"><option value="honest">Honest and careful</option><option value="bold">Bold and visionary</option><option value="buzz">Buzzword soup (AI! Quantum! Scalable!)</option></select></label>
      <label>Effort <select id="pEff"><option value="0">Rushed (−15 energy)</option><option value="1" selected>Solid (−30 energy)</option><option value="2">Heroic (−50 energy)</option></select></label>
      <div id="pOdds" class="odds"></div><button id="pSubmit" class="primary">Submit proposal</button> <button id="pCancel">Cancel</button></div>` : '<p class="muted">You need at least one project or idea to pitch. Brainstorm first.</p>') : `<button data-prop="${c.id}">Write a proposal</button>`}</div>`; }).join('') : '<p class="muted">No open calls right now. New calls appear every few weeks.</p>'}`;
  },
  hiring() {
    const T = team();
    const season = wk() >= 22 && wk() < 35;
    return `<h2>Hiring <span class="muted">${T.length}/${capacity()} benches</span></h2>
    <p class="muted">${season ? 'Hiring season is open until week 35.' : 'The main hiring season opens in spring (week 22). Undergrads apply year-round by email.'} Interview candidates to learn their skills and hidden traits. A good lab culture and reputation make people more likely to say yes.</p>
    ${G.applicants.length ? `<div class="cards">${G.applicants.map(a => `<div class="pcard"><div class="ph"><b>${esc(a.first)} ${esc(a.last)}</b><span class="muted">${ROLES[a.role].name} · ${fmt$(ROLES[a.role].salary)}/wk</span></div>
      ${a.revealed ? interestBlock(a) : ''}
      ${(a.expertise || []).length ? `<div class="prow" style="font-size:12px">🎓 Brings expertise: ${a.expertise.map(id => card(id) ? `${G.unlocked.includes(id) ? '' : '<b class="pos">new: </b>'}${card(id).name}` : id).join(', ')}</div>` : ''}
      <div class="chips">${a.traits.map((t, i) => i < a.revealed ? `<span class="chip" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>` : '<span class="chip unk">???</span>').join('')}</div>
      <div class="grid3">${['exp', 'theory', 'code'].map(k => `<div>${k === 'exp' ? 'Exp' : k === 'theory' ? 'Theory' : 'Code'} <b>${a.skillsKnown ? a.skill[k] : Math.max(1, a.skill[k] - 2) + '–' + Math.min(10, a.skill[k] + 2)}</b></div>`).join('')}</div>
      <div class="prow"><button data-int="${a.id}" class="primary" ${G.queue.some(v => v.app === a.id) ? 'disabled' : ''}>${G.queue.some(v => v.app === a.id) ? 'Interview scheduled' : 'Invite to interview'}</button> <button data-offer="${a.id}">Offer without interview (${chanceWord(acceptOfferChance(a))})</button><span class="muted" style="font-size:12px">${a.role !== 'undergrad' ? `+${fmt$(HIRE_COST)} relocation` : ''}</span> <button data-rej="${a.id}" class="small">Pass</button></div></div>`).join('')}</div>` : '<p class="muted">No applicants right now.</p>'}`;
  },
  store() {
    const needed = new Set(G.projects.filter(p => ['running', 'idea', 'results'].includes(p.stage)).flatMap(p => projNeeds(p.cards)));
    const usedBy = k => CARDS.filter(c => (c.needs || []).includes(k) || Object.values(c.needsBy || {}).some(a => a.includes(k))).map(c => c.k === 'sys' ? c.name : c.k === 'tech' ? `${c.name} (technique)` : `${c.name} (goal)`);
    const boostText = e => { const b = e.boost; if (!b) return ''; const who = b.plats ? b.plats.map(x => PLATS[x]).join(', ') : b.modes ? b.modes.map(m => ({ exp: 'all experiments', code: 'data projects', theory: 'theory projects' })[m]).join(', ') : 'STM projects'; return `Boosts ${who}: ${b.speed ? `${Math.round((b.speed - 1) * 100)}% faster` : ''}${b.speed && b.q ? ', ' : ''}${b.q ? `+${b.q} quality` : ''}`; };
    const card1 = ([k, e]) => {
      const own = G.equip[k]; const gwNeed = e.goodwill ? (G.flags.spaceIOU ? e.goodwill - 15 : e.goodwill) : 0;
      const blocked = (e.req && !G.equip[e.req]) ? `Needs ${EQUIP[e.req].name}` : (gwNeed && G.goodwill < gwNeed) ? `Needs department goodwill ${gwNeed}+ (you have ${Math.round(G.goodwill)})` : '';
      const ub = e.cat === 'research' || e.cat === 'addon' ? usedBy(k) : [];
      const need = needed.has(k) && !own;
      return `<div class="scard ${own ? 'own' : ''} ${need ? 'need' : ''}"><div class="si">${e.icon}</div><b>${e.name}</b><div class="muted">${e.desc}</div>${ub.length ? `<div class="sused">${e.cat === 'addon' ? 'Required for' : 'Used for'}: ${ub.join(', ')}</div>` : ''}${e.boost ? `<div class="sused">${boostText(e)}</div>` : ''}${need ? '<div class="sneed">⚠️ One of your projects needs this</div>' : ''}${borrowing(k) && !own ? `<div class="sused">🔑 Borrowing a colleague's for ${G.borrowed[k] - G.week} more weeks</div>` : ''}<div class="sp">${fmtK(priceOf(k))}${priceOf(k) < e.cost ? ' (renovation discount)' : ''}${e.upkeep ? ` · ${e.upkeep > 0 ? '+' : ''}${fmt$(e.upkeep)}/wk` : ''}</div>
      ${own ? (G.broken[k] ? `<button data-fix="${k}">Express repair (${fmtK(G.equip.service ? 6000 : 20000)}) · down ${G.broken[k]} wk</button>` : '<span class="pos">✓ Owned</span>') : blocked ? `<span class="muted">${blocked}</span>` : `<button data-buy="${k}" ${G.money < priceOf(k) ? 'disabled' : ''}>Buy</button>`}</div>`;
    };
    const ent = Object.entries(EQUIP);
    return `<h2>Lab store</h2><p class="muted">Each research platform needs specific equipment: atoms and ions need lasers and vacuum, superconducting qubits need a dilution fridge and a fab, liquid-helium and magnet experiments need a cryostat. Buy only what your research uses. Colleagues may lend you theirs (Faculty app).</p>
      ${EQUIP_CATS.map(([cat, lbl]) => `<h3>${lbl}</h3><div class="cards store">${ent.filter(([k, e]) => e.cat === cat).map(card1).join('')}</div>`).join('')}`;
  },
  ventures() {
    const F = fin(); const nw = netWorth();
    const pct = Math.min(100, Math.max(0, Math.log10(Math.max(nw, 1e4)) - 4) / 5 * 100);
    const spark = h => { if (h.length < 2) return ''; const mx = Math.max(...h), mn = Math.min(...h); const pts = h.map((v, i) => `${(i / (h.length - 1) * 160).toFixed(1)},${(30 - (v - mn) / ((mx - mn) || 1) * 28).toFixed(1)}`).join(' '); return `<svg width="160" height="32" style="display:block"><polyline points="${pts}" fill="none" stroke="${h[h.length - 1] >= h[0] ? '#5ac06a' : '#e05a4a'}" stroke-width="1.6"/></svg>`; };
    const cos = F.companies.map(co => {
      const alive = co.status !== 'dead' && co.status !== 'acquired';
      const stage = co.status === 'public' ? 'Public company' : co.status === 'acquired' ? `Acquired for ${fmtK(co.exitPrice || 0)}` : co.status === 'dead' ? 'Shut down' : STAGES[co.stage].name;
      return `<div class="pcard"><div class="ph"><b>${esc(co.name)}</b><span class="muted">${stage}</span></div>
      <div class="muted" style="font-size:12px">${esc(co.product)} · CEO ${esc(co.ceo.first)} ${esc(co.ceo.last)} · you: ${co.role}${co.board ? ', board seat' : ''}</div>
      ${alive ? `<div class="kv"><div>Valuation <b>${fmtK(co.val)}</b></div><div>Your stake <b>${(co.stake * 100).toFixed(1)}%</b></div><div>Worth <b class="pos">${fmtK(equityValue(co))}</b></div><div>${healthWord(co.health)}</div></div>${spark(co.hist)}
      <div class="prow">${co.role === 'founder' || co.role === 'cofounder' ? `<button data-board="${co.id}">${co.board ? 'Step off the board (no more energy drain, company grows a bit slower)' : 'Rejoin the board (−3 energy a week, steadier growth)'}</button>` : ''}
      <button data-sell="${co.id}">${co.status === 'public' ? `Sell all shares (+${fmtK(equityValue(co))})` : `Sell to a secondary buyer at 60% (+${fmtK(equityValue(co) * 0.6)})`}</button>
      <button data-bridge="${co.id}" ${F.cash < 25000 ? 'disabled' : ''}>Invest $25,000 more</button></div>` : ''}</div>`;
    }).join('');
    const papers = G.papers.filter(p => !p.retracted && p.proj && !F.companies.some(c => c.product === p.title));
    const ceos = team().filter(p => p.role === 'postdoc' || p.role === 'scientist' || p.role === 'staff' || (p.role === 'grad' && p.yearIn >= 3));
    return `<h2>Ventures <span class="muted">your own money</span></h2>
    <div class="kv"><div>Salary <b class="pos">${fmt$(salaryWeekly())}/wk</b></div><div>Living costs <b class="neg">${fmt$(livingWeekly())}/wk</b></div><div>Savings <b>${fmtK(F.cash)}</b></div><div>Startup equity <b>${fmtK(nw - F.cash)}</b></div><div>Net worth <b class="pos">${fmtK(nw)}</b></div></div>
    <div class="tenure"><b>Road to a billion</b>${bar(pct, '#e0a83a')}<span>${F.billionaire ? '🏆 You did it. You are a billionaire physicist.' : `Net worth ${fmtK(nw)} of $1,000M. Salaries won't get you there. Startups might.`}</span></div>
    <p class="muted">Your salary rises with promotions; living costs depend on your household. Savings earn a little interest. These are your personal finances, separate from the lab's grant money.</p>
    <h3>Your companies</h3>${cos || '<p class="muted">None yet. Found one below, or watch for colleagues starting companies.</p>'}
    <h3>Start a company</h3>${papers.length && ceos.length ? `<div class="pform"><label>Product, based on a paper <select id="vPaper">${papers.map((p, i) => `<option value="${i}">${esc(p.title.slice(0, 80))}</option>`).join('')}</select></label>
      <label>CEO (they leave the lab to run it) <select id="vCeo">${ceos.map(p => `<option value="${p.id}">${esc(p.first)} ${esc(p.last)} (${roleName(p)}${p.traits.length ? ', ' + p.traits.map(t => TRAITS[t].name).join(', ') : ''})</option>`).join('')}</select></label>
      <label>Your own money in it <select id="vInv"><option value="0">$0</option><option value="25000">$25,000</option><option value="100000">$100,000</option></select></label>
      <div class="muted" style="font-size:12px">You get 32% and a board seat (−3 energy a week). Ambitious, industry-curious, hard-working CEOs do best. The department frowns a little (goodwill −3).</div>
      <button id="vGo" class="primary">Found the company</button></div>` : '<p class="muted">You need a published paper to build a product on, and a postdoc, staff member, scientist or senior grad student (year 3+) to be CEO.</p>'}`;
  },
  dept() {
    const cd = G.dept || (G.dept = {});
    const ready = id => !cd[id] || G.week >= cd[id];
    const svc = SERVICE.filter(x => !x.avail || x.avail()).map(x => { const ok = ready(x.id); const lack = x.energy && G.energy < x.energy ? 'Not enough energy' : x.money && G.money < x.money ? 'Not enough money' : '';
      return `<div class="scard"><div class="si">${x.icon}</div><b>${x.name}</b><div class="muted">${x.desc}</div><div class="sp">${[x.energy ? `−${x.energy} energy` : '', x.money ? `−${fmt$(x.money)}` : ''].filter(Boolean).join(' · ') || 'No upfront cost'}</div><div class="sused">${x.gain}</div>
      ${ok ? `<button data-svc="${x.id}" ${lack ? 'disabled' : ''}>${lack || 'Do it'}</button>` : `<span class="muted">Available again in ${cd[x.id] - G.week} weeks</span>`}</div>`; }).join('');
    const fav = FAVORS.filter(x => !x.avail || x.avail()).map(x => { const ok = ready(x.id) && G.goodwill >= x.gw;
      return `<div class="scard"><div class="si">${x.icon}</div><b>${x.name}</b><div class="muted">${x.desc}</div><div class="sp">Costs ${x.gw} goodwill</div>${ready(x.id) ? `<button data-fav="${x.id}" ${ok ? '' : 'disabled'}>${G.goodwill >= x.gw ? 'Ask the chair' : `Need ${x.gw} goodwill`}</button>` : `<span class="muted">Available again in ${cd[x.id] - G.week} weeks</span>`}</div>`; }).join('');
    const shareable = ['optics', 'vacuum', 'fridge', 'cryostat', 'fab', 'stm', 'confocal', 'femtolaser', 'cluster'].filter(k => G.equip[k]);
    return `<h2>Department <span class="muted">goodwill ${Math.round(G.goodwill)}/100</span></h2>
    <p class="muted">Goodwill is how the chair and your colleagues see your citizenship. It counts toward tenure, unlocks lab expansion (55+), helps with spousal hires and pays for favors below. You also gain it by winning grants (the department gets overhead), publishing in top journals, keeping a healthy lab culture, serving on committees and teaching.</p>
    <h3>Service</h3><div class="cards store">${svc}</div>
    ${shareable.length ? `<h3>Share your equipment with other groups</h3><p class="muted">Each shared instrument earns about +0.5 goodwill a week, but your own projects on it run 12% slower.</p><div class="prow">${shareable.map(k => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-share="${k}" ${G.shared && G.shared[k] ? 'checked' : ''}> ${EQUIP[k].icon} ${EQUIP[k].name}</label>`).join(' ')}</div>` : ''}
    <h3>Ask the chair for a favor</h3><div class="cards store">${fav}</div>`;
  },
  life() {
    const L = G.life; if (!L) return '<p>No home life data in this save.</p>';
    const h = HOBBIES[L.hobby];
    const regen = Math.round(12 + (L.hours - 40) * 0.45 - (L.hobbyTime ? 3 : 0));
    const fam = L.partner ? `${esc(L.partner.first)}${L.kids.length ? ` and the kids (${L.kids.map(k => `${esc(k.first)}, ${k.age}`).join('; ')})` : ''}` : 'just you';
    return `<h2>Life <span class="muted">${fam}</span></h2>
    <div class="kv"><div>${L.partner ? 'Home' : 'Social life'} <b>${Math.round(L.home)}</b></div><div>Your wellbeing <b>${Math.round(L.self)}</b></div><div>Events missed this career <b>${L.missed || 0}</b></div><div>Times you showed up <b>${L.kept || 0}</b></div></div>
    <div class="gcard"><b>Work hours per week: <span id="lhv">${L.hours}</span></b>
      <input type="range" id="lHours" min="40" max="80" step="1" value="${L.hours}" style="width:100%">
      <div class="muted" id="lhExplain"></div>
      ${L.promise ? `<div class="${L.hours > L.promise.hours + 3 ? 'neg' : 'pos'}">You promised ${L.partner ? esc(L.partner.first) : 'yourself'} ${L.promise.hours} hours until week ${((L.promise.until - 1) % WPY) + 1}.</div>` : ''}</div>
    ${L.footUntil > G.week ? `<div class="gcard neg">🦶 Your foot is sprained for ${L.footUntil - G.week} more week${L.footUntil - G.week > 1 ? 's' : ''}. Social and athletic events are cancelled.</div>` : ''}
    <div class="gcard"><label class="set"><input type="checkbox" id="lHobby" ${L.hobbyTime ? 'checked' : ''}> Protect time for ${h.icon} ${h.name.toLowerCase()} every week</label><div class="muted">Costs 3 energy a week. Keeps your wellbeing up.</div></div>
    <div class="gcard"><b>This week</b><div class="prow">
      <button id="lCall" ${L.partner ? '' : 'disabled'} ${L.lastCall === G.week ? 'disabled' : ''}>📞 Call ${L.partner ? esc(L.partner.first) : 'home'} at lunch (−2 energy)</button>
      <button id="lEarly" ${L.earlyWeek === G.week ? 'disabled' : ''}>🌇 Leave early on Friday (−8 energy)</button>
      <button id="lWeekend" ${L.weekendWeek === G.week ? 'disabled' : ''}>🏕️ Take the whole weekend off (−15 energy)</button></div></div>
    <p class="muted">Energy is your capacity at work. More hours give more energy for the lab, but ${L.partner ? 'your family' : 'your social life'} and your own wellbeing pay for it. Low wellbeing cuts your energy. If ${L.partner ? 'home' : 'wellbeing'} gets very low, things get serious.</p>`;
  },
  faculty() {
    const need = new Set(G.projects.filter(p => p.stage === 'running').flatMap(p => projNeeds(p.cards)).filter(k => !G.equip[k] && !borrowing(k)));
    return `<h2>Faculty colleagues</h2><p class="muted">Colleagues share equipment, collaborate, give advice and write letters for your tenure case. Their opinion of you counts.</p>
    <div class="cards">${(G.profs || []).map(f => `<div class="pcard"><div class="ph"><b>Prof. ${esc(f.first)} ${esc(f.last)}</b><span class="muted">${esc(f.field)}</span></div>
      <div class="muted">${esc(f.blurb)}</div>
      <div class="grid3"><div>Relationship ${bar(f.rel, f.rel < 40 ? '#e05a4a' : f.rel > 65 ? '#5ac06a' : '#e0a83a')}</div><div style="grid-column: span 2">Owns: ${f.equip.map(k => `${EQUIP[k].icon} ${EQUIP[k].name}${need.has(k) ? ' <b class="pos">(you need this)</b>' : ''}`).join(', ')}</div></div>
      <div class="prow"><button data-coffee="${f.id}" ${G.queue.some(v => v.prof === f.id) ? 'disabled' : ''}>☕ Invite for coffee</button>${f.equip.filter(k => need.has(k)).map(k => `<button data-borrow="${f.id}" data-k="${k}" ${G.queue.some(v => v.prof === f.id) ? 'disabled' : ''}>🔑 Ask to borrow the ${EQUIP[k].name}</button>`).join('')}</div></div>`).join('')}</div>
    ${Object.keys(G.borrowed || {}).filter(k => borrowing(k)).length ? `<h3>Borrowed equipment</h3>${Object.keys(G.borrowed).filter(k => borrowing(k)).map(k => `<div class="row">${EQUIP[k].icon} ${EQUIP[k].name}: ${G.borrowed[k] - G.week} weeks left (65% speed)</div>`).join('')}` : ''}`;
  },
  cv() {
    const s = tenureScore();
    return `<h2>${esc(G.pi)} <span class="muted">${title()}, ${esc(G.labName)}</span></h2>
    ${G.titleIdx === 0 ? `<div class="tenure"><b>Tenure file</b> (review in year 6, week 44; now ${dateStr()})${bar(s, s >= TENURE_BAR ? '#5ac06a' : '#e0a83a', TENURE_BAR)}<span>${s} / ${TENURE_BAR}. Papers, reputation, grants won, students graduated and department goodwill all count.</span></div>` : ''}
    <div class="kv"><div>Reputation <b>${Math.round(G.rep)}</b></div><div>Papers <b>${G.papers.length}</b></div><div>Landmark results <b>${G.landmarks}</b></div><div>Grants won <b>${G.grantsWon}</b></div><div>PhDs & faculty alumni <b>${G.graduated}</b></div><div>Goodwill <b>${Math.round(G.goodwill)}</b></div></div>
    ${G.titleIdx >= 1 && !G.won ? `<p class="muted">The road to Stockholm: 3 landmark results (Nature or Science papers of very high quality and novelty) and a towering reputation (200+).</p>` : ''}
    <h3>Lab expertise</h3><div class="chips">${Object.entries(G.expertise || {}).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([id, n]) => card(id) ? chip(`${card(id).icon} ${card(id).name} ${'★'.repeat(Math.min(5, n))}`) : '').join('') || '<span class="muted">Publish to build expertise. Ideas in areas you know become more feasible and fundable.</span>'}</div>
    <h3>Publications</h3>${[...G.papers].reverse().map(p => `<div class="row ${p.retracted ? 'retr' : ''}">${p.landmark ? '⭐ ' : ''}<b>${esc(p.journal)}</b> "${esc(p.title)}" <span class="muted">· yr ${Math.floor((p.week - 1) / WPY) + 1}${p.first ? ' · first author ' + esc(p.first) : ''}${p.retracted ? ' · RETRACTED' : ''}</span></div>`).join('') || '<p class="muted">No papers yet.</p>'}
    <h3>Alumni</h3>${G.alumni.map(a => `<div class="row">${esc(a.name)} <span class="muted">(${ROLES[a.role] ? ROLES[a.role].name : a.role}) ${esc(a.why)}</span></div>`).join('') || '<p class="muted">None yet.</p>'}
    <h3>Lab diary</h3>${G.log.slice(0, 25).map(l => `<div class="row muted">wk ${((l.w - 1) % WPY) + 1}, yr ${Math.floor((l.w - 1) / WPY) + 1}: ${esc(l.t)}</div>`).join('')}`;
  },
  arxiv() {
    const R = G.rival;
    const known = R.focus ? R.focus.map((id, i) => (i === 0 || R.rel >= 10) ? card(id).icon + ' ' + card(id).name : '???') : null;
    return `<h2>arXiv · new submissions</h2>
    <div class="gcard"><b>🕵️ Rival watch: ${esc(R.name)}</b><div class="muted">${esc(R.inst)}. ${known ? `Rumored to be working on: ${known.join(' + ')}. ${R.rel < 10 ? 'Get friendlier with Voss to learn more.' : ''}` : 'Nobody knows what Voss is working on right now.'}</div>${R.focus ? `<div class="muted">How close they are to publishing:</div>${bar(R.heat, '#e05a4a', 30)}` : ''}<div class="muted">If they publish first on something you're working on (2 of 3 matching cards), you get scooped.</div></div>
    ${G.arxiv.map(a => `<div class="row ${a.rival ? 'rival' : ''}"><b>${esc(a.t)}</b> <span class="muted">${esc(a.a)} · wk ${((a.w - 1) % WPY) + 1}</span></div>`).join('')}`;
  },
  settings() {
    return `<h2>Settings</h2>
    <label class="set">Time step <select id="sStep"><option value="month" ${G.timeStep !== 'week' ? 'selected' : ''}>Monthly (faster: four weeks per step)</option><option value="week" ${G.timeStep === 'week' ? 'selected' : ''}>Weekly (slower, more detail)</option></select></label>
    <label class="set">Real seconds per step <select id="sSpeed">${[4, 8, 12, 20, 30, 60].map(s => `<option value="${s}" ${G.speed === s ? 'selected' : ''}>${s} s</option>`).join('')}</select></label>
    <p class="muted">Time stops while someone is in your office and while you're on the computer.</p>
    <label class="set"><input type="checkbox" id="sDnd" ${G.dnd ? 'checked' : ''}> Do Not Disturb (door closed). People queue up outside and get a little annoyed.</label>
    <div class="set" style="flex-wrap:wrap">🦶 Chance of sitting on your foot each week: <b id="sFootV">${footLabel(G.footChance ?? (G.footMode ? 1 : 0))}</b>
      <input type="range" id="sFoot" min="0" max="100" step="1" value="${G.footChance ?? (G.footMode ? 1 : 0)}" style="flex:1;min-width:200px"></div>
    <p class="muted">If it happens, you're on crutches for a month and every social and athletic event is cancelled. 0% turns it off.</p>
    <label class="set"><input type="checkbox" id="sAi" ${AI.on ? 'checked' : ''}> 🤖 Use the local AI (Ollama) to judge things you type to people</label>
    <div class="set">Model <input type="text" id="sAiModel" value="${esc(AI.model)}" style="width:160px"> <button id="sAiTest">Test connection</button> <span id="sAiStat" class="muted"></span></div>
    <label class="set"><input type="checkbox" id="sAiGpu" ${AI.gpu ? 'checked' : ''}> Run the AI on the graphics card (about 10× faster; turn off if Ollama freezes)</label>
    <p class="muted">Runs entirely on this computer. The model loads when you say something and unloads 90 seconds later. If Ollama isn't running, the game falls back to its built-in word list.</p>
    <label class="set">Graphics quality <select id="sGfx">${[['high', 'High: soft shadows, ambient occlusion, glow, 4× antialiasing'], ['medium', 'Medium: soft shadows, no post-processing'], ['low', 'Low: fastest, no shadows']].map(([k, l]) => `<option value="${k}" ${QUALITY === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="muted">Changing graphics quality reloads the game (your progress is saved).</p>
    <h3>How to play</h3><ul class="help">
    <li><b>People walk in.</b> Students bring ideas, results, problems and fights. Every choice moves morale, stress, loyalty, relationships, lab culture or your budget.</li>
    <li><b>Brainstorm</b> new projects by combining a system, a technique and a goal. Some combos have synergies. Missing equipment makes projects crawl. You learn new ideas from hires, conferences, colleagues, new equipment, the literature (Projects app) and your own papers. After each paper, the lead suggests follow-up research lines, and expertise (★) makes familiar areas easier.</li>
    <li><b>Department goodwill</b> 🏛️: earn it through service (Department app), committees, teaching, grants and good papers. Spend it on favors from the chair.</li>
    <li><b>Assign people</b> to projects in the Projects or Team app. Results come when progress hits 100%. Double-check them, or risk a retraction later.</li>
    <li><b>Money</b>: stipends, tuition, salaries, benefits, research supplies, software and equipment upkeep burn cash every week (see the cost breakdown in Grants). Hiring, publishing and repairs cost extra. Win grants before your startup money runs out.</li>
    <li><b>Energy</b> (⚡) is yours. Careful choices cost energy. It recovers each week, minus committees and teaching. Your coffee mug helps once a week.</li>
    <li><b>Culture</b> 🤝 is how safe people feel admitting mistakes. Low culture means hidden accidents and buggy results.</li>
    <li><b>Tenure</b> is reviewed in year 6. After that: Full Professor, an endowed chair and, maybe, a phone call from Stockholm.</li>
    <li>Drag to look around. Click people in the lab to call them in. Click the door to close it. Number keys pick dialogue choices.</li></ul>
    <div class="prow"><button id="sSave">Save now</button> <button id="sNew" class="danger">Start a new career</button></div>`;
  },
};

const APP_BIND = {
  calendar: b => bindCalendar(b, renderComputer, app => { hud(); if (app) { UI.app = app; renderComputer(); } }),
  ventures(b) {
    const F = fin(); const co = id => F.companies.find(c => c.id === id);
    b.querySelectorAll('[data-board]').forEach(x => x.onclick = () => { const c = co(x.dataset.board); c.board = !c.board; renderComputer(); });
    b.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => { const c = co(x.dataset.sell); const v = equityValue(c) * (c.status === 'public' ? 1 : 0.6); if (!confirm(`Sell your whole ${(c.stake * 100).toFixed(1)}% of ${c.name} for ${fmtK(v)}?`)) return; F.cash += v; c.stake = 0; c.board = false; log(`Sold shares of ${c.name} for ${fmtK(v)}.`); toast(`💰 +${fmtK(v)}`, 'good'); hud(); renderComputer(); });
    b.querySelectorAll('[data-bridge]').forEach(x => x.onclick = () => { const c = co(x.dataset.bridge); if (F.cash < 25000) return; F.cash -= 25000; c.stake = Math.min(0.6, c.stake + 25000 / (c.val + 25000) * 0.8); c.health = Math.min(0.95, c.health + 0.03); toast(`Invested $25,000 in ${c.name}.`); hud(); renderComputer(); });
    const go = b.querySelector('#vGo');
    if (go) go.onclick = () => {
      const papers = G.papers.filter(p => !p.retracted && p.proj && !F.companies.some(c => c.product === p.title));
      const paper = papers[+b.querySelector('#vPaper').value]; const p = person(b.querySelector('#vCeo').value); const inv = +b.querySelector('#vInv').value;
      if (!paper || !p) return; if (F.cash < inv) { toast('Not enough personal savings.', 'bad'); return; }
      if (!confirm(`${p.first} will leave the lab to become CEO. Found the company?`)) return;
      foundWithStudent(p, paper, inv); UI.sync(); hud(); renderComputer();
    };
  },
  dept(b) {
    const cd = G.dept || (G.dept = {});
    b.querySelectorAll('[data-svc]').forEach(x => x.onclick = () => { const a = SERVICE.find(y => y.id === x.dataset.svc); if (a.energy && G.energy < a.energy) return; if (a.money && G.money < a.money) return; if (a.energy) G.energy -= a.energy; if (a.money) G.money -= a.money; const msg = a.do(); cd[a.id] = G.week + a.cd; log(a.name + '.'); toast(`🏛️ ${msg}`, 'good'); UI.sync(); hud(); renderComputer(); });
    b.querySelectorAll('[data-fav]').forEach(x => x.onclick = () => { const a = FAVORS.find(y => y.id === x.dataset.fav); if (G.goodwill < a.gw) return; G.goodwill -= a.gw; const msg = a.do(); cd[a.id] = G.week + (a.cd || 16); log(`Favor from the chair: ${a.name}.`); toast(`🏛️ ${msg}`, 'good'); UI.sync(); hud(); renderComputer(); });
    b.querySelectorAll('[data-share]').forEach(x => x.onchange = () => { G.shared = G.shared || {}; G.shared[x.dataset.share] = x.checked; renderComputer(); });
  },
  life(b) {
    const L = G.life; if (!L) return;
    const ex = () => { const v = +b.querySelector('#lHours').value; const regen = Math.round(12 + (v - 40) * 0.45 - (L.hobbyTime ? 3 : 0)); b.querySelector('#lhv').textContent = v; b.querySelector('#lhExplain').textContent = `About +${regen} energy per week. ${v <= 48 ? 'Sustainable. Home and wellbeing improve.' : v <= 56 ? 'Busy but manageable.' : v <= 65 ? 'Long weeks. Home and wellbeing slowly drop.' : 'Brutal. This will break something.'}`; };
    b.querySelector('#lHours').oninput = ex; b.querySelector('#lHours').onchange = e => { L.hours = +e.target.value; hud(); }; ex();
    b.querySelector('#lHobby').onchange = e => { L.hobbyTime = e.target.checked; renderComputer(); };
    b.querySelector('#lCall').onclick = () => { if (G.energy < 2) return; G.energy -= 2; L.lastCall = G.week; L.home = clamp(L.home + 3, 0, 100); toast(`📞 Ten minutes with ${L.partner.first}. It helps.`); hud(); renderComputer(); };
    b.querySelector('#lEarly').onclick = () => { if (G.energy < 8) { toast('Not enough energy left this week.', 'bad'); return; } G.energy -= 8; L.earlyWeek = G.week; L.home = clamp(L.home + 4, 0, 100); L.self = clamp(L.self + 4, 0, 100); toast('🌇 Out by four on Friday.'); hud(); renderComputer(); };
    b.querySelector('#lWeekend').onclick = () => { if (G.energy < 15) { toast('Not enough energy left this week.', 'bad'); return; } G.energy -= 15; L.weekendWeek = G.week; L.home = clamp(L.home + 8, 0, 100); L.self = clamp(L.self + 9, 0, 100); toast('🏕️ A whole weekend with no email.'); hud(); renderComputer(); };
  },
  faculty(b) {
    b.querySelectorAll('[data-coffee]').forEach(x => x.onclick = () => { queueVisit({ ev: 'prof_coffee', ext: 'prof', prof: x.dataset.coffee, pri: 3 }, true); toast('☕ They\'ll drop by.'); renderComputer(); hud(); });
    b.querySelectorAll('[data-borrow]').forEach(x => x.onclick = () => { queueVisit({ ev: 'prof_borrow', ext: 'prof', prof: x.dataset.borrow, k: x.dataset.k, pri: 3 }, true); toast('They\'ll drop by to talk about it.'); renderComputer(); hud(); });
  },
  mail(b) {
    b.querySelectorAll('.mitem').forEach(el => el.onclick = () => { UI.mailSel = el.dataset.id; renderComputer(); });
    const sel = G.inbox.find(m => m.id === UI.mailSel) || G.inbox[0];
    b.querySelectorAll('.mact button').forEach(el => el.onclick = () => { const a = sel.actions[+el.dataset.i]; sel.result = (MAIL_ACTIONS[a.k] || (() => ''))(sel, a); sel.actions = null; hud(); UI.sync(); renderComputer(); });
  },
  team(b) {
    b.querySelectorAll('[data-rename]').forEach(x => x.onclick = () => { UI.renaming = x.dataset.rename; renderComputer(); const f = b.querySelector('#rnF'); if (f) { f.focus(); f.select(); } });
    b.querySelectorAll('[data-rncancel]').forEach(x => x.onclick = () => { UI.renaming = null; renderComputer(); });
    b.querySelectorAll('[data-rnsave]').forEach(x => {
      const save = () => { const p = person(x.dataset.rnsave); const f = b.querySelector('#rnF').value.trim(), l = b.querySelector('#rnL').value.trim(); if (p && f) { const old = `${p.first} ${p.last}`; p.first = f; if (l) p.last = l; log(`${old} now goes by ${p.first} ${p.last}.`); toast(`✏️ Renamed to ${p.first} ${p.last}`); } UI.renaming = null; UI.sync(); renderComputer(); };
      x.onclick = save;
      for (const i of [b.querySelector('#rnF'), b.querySelector('#rnL')]) i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') save(); if (e.key === 'Escape') { UI.renaming = null; renderComputer(); } };
    });
    b.querySelectorAll('select[data-p]').forEach(s => s.onchange = () => { const p = person(s.dataset.p); const pr = s.value ? proj(s.value) : null; joinProject(p, pr); if (pr && pr.stage === 'idea') pr.stage = 'running'; UI.sync(); renderComputer(); });
    b.querySelectorAll('[data-call]').forEach(x => x.onclick = () => { queueVisit({ ev: 'checkin', A: x.dataset.call, pri: 3 }, true); toast(`${person(x.dataset.call).first} will come by.`); renderComputer(); hud(); });
    b.querySelectorAll('[data-bs]').forEach(x => x.onclick = () => { queueVisit({ ev: 'brainstorm', A: x.dataset.bs, pri: 3 }, true); toast(`${person(x.dataset.bs).first} is grabbing a marker.`); renderComputer(); hud(); });
  },
  projects(b) {
    b.querySelectorAll('select[data-add]').forEach(s => s.onchange = () => { if (!s.value) return; const pr = proj(s.dataset.add); joinProject(person(s.value), pr); if (pr.stage === 'idea') pr.stage = 'running'; UI.sync(); renderComputer(); });
    b.querySelectorAll('[data-rm]').forEach(a => a.onclick = () => { joinProject(person(a.dataset.rm), null); UI.sync(); renderComputer(); });
    b.querySelectorAll('[data-shelve]').forEach(x => x.onclick = () => { const pr = proj(x.dataset.shelve); for (const id of [...pr.members]) { const p = person(id); if (p) { joinProject(p, null); p.morale = clamp(p.morale - 5, 0, 100); } } pr.stage = 'dead'; log(`Shelved "${pr.title}".`); UI.sync(); renderComputer(); });
    const lg = b.querySelector('#litGo'); if (lg) lg.onclick = () => {
      const k = b.querySelector('#litKind').value; if (G.energy < 10) return;
      // favour ideas that fit what your lab can already do
      const plats = new Set(CARDS.filter(c => c.k === 'sys' && G.unlocked.includes(c.id)).map(c => c.plat));
      const pool = CARDS.filter(c => c.k === k && !G.unlocked.includes(c.id));
      if (!pool.length) { toast('You already know every idea of that kind.'); return; }
      const good = pool.filter(c => k === 'sys' ? (c.needs || []).every(n => G.equip[n]) || plats.has(c.plat) : (!c.fits || c.fits === 'any' || c.fits.some(x => plats.has(x))));
      const pickC = (good.length ? good : pool)[Math.floor(Math.random() * (good.length ? good : pool).length)];
      G.energy -= 10; G.flags.litWeek = G.week; unlockCards([pickC.id], 'the literature'); hud(); renderComputer();
    };
    const go = b.querySelector('#bsGo'); if (go) go.onclick = () => { const id = b.querySelector('#bsWho').value; if (!id) return; queueVisit({ ev: 'brainstorm', A: id, pri: 3 }, true); toast(`${person(id).first} is on their way.`); closeComputer(); };
  },
  grants(b) {
    b.querySelectorAll('[data-prop]').forEach(x => x.onclick = () => { UI.propFor = x.dataset.prop; renderComputer(); });
    const sub = b.querySelector('#pSubmit');
    if (sub) {
      const upd = () => { const pr = proj(b.querySelector('#pProj').value); const p = grantChance(UI.propFor, pr, b.querySelector('#pFrame').value, +b.querySelector('#pEff').value); b.querySelector('#pOdds').textContent = `Your gut feeling about the odds: ${chanceWord(p)}`; };
      ['#pProj', '#pFrame', '#pEff'].forEach(s => b.querySelector(s).onchange = upd); upd();
      sub.onclick = () => { const eff = +b.querySelector('#pEff').value; const cost = [15, 30, 50][eff]; if (G.energy < cost) { toast('Not enough energy. Sleep on it, or try a lighter effort.', 'bad'); return; } G.energy -= cost; submitProposal(UI.propFor, proj(b.querySelector('#pProj').value), b.querySelector('#pFrame').value, eff); UI.propFor = null; toast('📨 Proposal submitted.'); hud(); renderComputer(); };
      b.querySelector('#pCancel').onclick = () => { UI.propFor = null; renderComputer(); };
    }
  },
  hiring(b) {
    b.querySelectorAll('[data-int]').forEach(x => x.onclick = () => { if (team().length >= capacity()) { toast('The lab is full. Buy a lab expansion first.', 'bad'); return; } queueVisit({ ev: 'interview', ext: 'applicant', app: x.dataset.int, pri: 3 }); toast('Interview scheduled. They\'ll come by your office.'); renderComputer(); hud(); });
    b.querySelectorAll('[data-offer]').forEach(x => x.onclick = () => {
      const a = G.applicants.find(y => y.id === x.dataset.offer); if (!a) return;
      if (team().length >= capacity()) { toast('The lab is full. Buy a lab expansion first.', 'bad'); return; }
      G.applicants = G.applicants.filter(y => y !== a);
      if (Math.random() < acceptOfferChance(a)) { delete a.revealed; addPerson(a); log(`Hired ${a.first} ${a.last}.`); toast(`🤝 ${a.first} accepted!`, 'good'); } else toast(`${a.first} declined your offer.`, 'bad');
      UI.sync(); renderComputer();
    });
    b.querySelectorAll('[data-rej]').forEach(x => x.onclick = () => { G.applicants = G.applicants.filter(y => y.id !== x.dataset.rej); renderComputer(); });
  },
  store(b) {
    b.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => { const k = x.dataset.buy, e = EQUIP[k], pc = priceOf(k); if (G.money < pc) return; G.money -= pc; G.equip[k] = true; refreshUnlocks(); log(`Bought ${e.name}.`); toast(`${e.icon} ${e.name} installed.`, 'good'); if (k === 'cat') toast('🐈 Schrödinger has entered the lab. Or has not. Until observed.'); UI.sync(); hud(); renderComputer(); });
    b.querySelectorAll('[data-fix]').forEach(x => x.onclick = () => { const fc = G.equip.service ? 6000 : 20000; if (G.money < fc) return; G.money -= fc; delete G.broken[x.dataset.fix]; UI.sync(); hud(); renderComputer(); });
  },
  settings(b) {
    b.querySelector('#sSpeed').onchange = e => { G.speed = +e.target.value; G.paused = false; hud(); };
    b.querySelector('#sStep').onchange = e => { G.timeStep = e.target.value; hud(); toast(G.timeStep === 'week' ? 'One week per step.' : 'One month per step.'); };
    b.querySelector('#sDnd').onchange = e => { G.dnd = e.target.checked; UI.sync(); hud(); };
    b.querySelector('#sSave').onclick = () => { save(); toast('Saved.'); };
    b.querySelector('#sFoot').oninput = e => { G.footChance = +e.target.value; G.footMode = G.footChance > 0; b.querySelector('#sFootV').textContent = footLabel(G.footChance); };
    b.querySelector('#sGfx').onchange = e => { save(); setQuality(e.target.value); };
    b.querySelector('#sAi').onchange = e => { AI.on = e.target.checked; toast(AI.on ? '🤖 Local AI judge on.' : 'Using the word list.'); };
    b.querySelector('#sAiModel').onchange = e => { AI.model = e.target.value.trim() || 'qwen2.5:3b'; };
    b.querySelector('#sAiModel').onkeydown = e => e.stopPropagation();
    b.querySelector('#sAiGpu').onchange = e => { AI.gpu = e.target.checked; };
    b.querySelector('#sAiTest').onclick = async () => { const s = b.querySelector('#sAiStat'); s.textContent = 'Checking…'; const r = await aiStatus(); s.textContent = !r.ok ? '❌ ' + aiDownMsg() : r.models.includes(AI.model) ? `✅ Connected, ${AI.model} is installed` : `⚠️ Connected, but ${AI.model} isn't installed. Installed: ${r.models.join(', ') || 'none'}`; };
    b.querySelector('#sNew').onclick = () => { if (confirm('Abandon this career and start over? Your save will be deleted.')) UI.onNewGame(); };
  },
};

// ---------------- department service and favors ----------------
const gwUp = d => { G.goodwill = clamp(G.goodwill + d, 0, 100); };
const termEnd = () => wk() <= 15 ? G.week + (15 - wk()) : wk() <= 36 ? G.week + (36 - wk()) : G.week + (48 - wk()) + 15;
const SERVICE = [
  { id: 'colloq', icon: '🎤', name: 'Give a department colloquium', desc: 'An hour-long talk to the whole department about your lab\'s work.', energy: 10, gain: 'Goodwill +5 · reputation +1', cd: 48, do: () => { gwUp(5); addRep(1); return 'Packed room, good questions. The chair sends a thank-you note.'; } },
  { id: 'speakers', icon: '🗓️', name: 'Run the visiting-speaker series this term', desc: 'Invite speakers, book rooms, host dinners.', energy: 6, money: 2000, gain: 'Goodwill +4 · every colleague likes you a bit more', cd: 16, do: () => { gwUp(4); for (const f of G.profs || []) f.rel = Math.min(100, f.rel + 3); return 'Great speakers all term. Colleagues keep thanking you in the hallway.'; } },
  { id: 'openlab', icon: '🏫', name: 'Host a public open-lab day', desc: 'Families, school kids and local press tour your lab.', energy: 8, money: 800, gain: 'Goodwill +4 · team morale ↑', cd: 16, do: () => { gwUp(4); for (const p of team()) p.morale = Math.min(100, p.morale + 3); return 'Your students give demos all day. A local paper runs a photo.'; } },
  { id: 'reu', icon: '☀️', name: 'Host summer undergraduate researchers', desc: 'A summer program for undergrads from other colleges. Summer only.', money: 6000, gain: 'Goodwill +5 · a strong undergrad applies to your lab', cd: 48, avail: () => wk() >= 30, do: () => { gwUp(5); const a = makePerson('undergrad'); G.nextId++; a.revealed = 1; a.interviewed = false; a.wants = 0; a.skill.exp = Math.min(10, a.skill.exp + 2); a.skill.code = Math.min(10, a.skill.code + 2); G.applicants.push(a); return `Eight undergrads, eight posters. ${a.first} wants to join your lab (check Hiring).`; } },
  { id: 'extra', icon: '📚', name: 'Volunteer to teach an extra course this term', desc: 'The department is short a lecturer.', gain: 'Goodwill +12 · −5 energy every week until the term ends', cd: 16, avail: () => !G.extraTeach || G.week >= G.extraTeach, do: () => { gwUp(12); G.teachLoad = (G.teachLoad || 0) + 5; G.teachUntil = Math.max(G.teachUntil || 0, termEnd()); G.extraTeach = termEnd(); return 'The chair visibly relaxes. You have a lot of grading in your future.'; } },
  { id: 'dgs', icon: '🎓', name: 'Serve as Director of Graduate Studies (1 year)', desc: 'Admissions, exams, student problems. A big job everyone respects.', gain: 'Goodwill +18 · colleagues ↑ · −5 energy every week for a year', cd: 144, do: () => { gwUp(18); G.commits = G.commits || []; G.commits.push(G.week + 48); for (const f of G.profs || []) f.rel = Math.min(100, f.rel + 5); return 'You are now the person every grad student emails at midnight.'; } },
  { id: 'nominate', icon: '🏅', name: 'Nominate a colleague for an award', desc: 'Write the nomination package for the colleague who likes you least.', energy: 6, gain: 'Goodwill +3 · that colleague likes you much more', cd: 48, do: () => { gwUp(3); const f = [...(G.profs || [])].sort((a, b) => a.rel - b.rel)[0]; if (f) f.rel = Math.min(100, f.rel + 14); return f ? `Prof. ${f.last} finds out you nominated them. They stop by to say thank you, a little awkwardly.` : 'Nomination sent.'; } },
  { id: 'recruit', icon: '🧳', name: 'Help with grad recruitment weekend', desc: 'Show prospective students around and pitch the department. Late winter only.', energy: 6, gain: 'Goodwill +3 · better applicants next hiring season', cd: 48, avail: () => wk() >= 10 && wk() <= 22, do: () => { gwUp(3); G.flags.betterApplicants = true; return 'Several strong prospectives mention your lab by name.'; } },
  { id: 'newsletter', icon: '📰', name: 'Write a feature for the department newsletter', desc: 'Two pages about your lab, with photos.', energy: 4, gain: 'Goodwill +2 · reputation +1', cd: 16, do: () => { gwUp(2); addRep(1); return 'The alumni office loves it. So does your mom.'; } },
];
const FAVORS = [
  { id: 'release', icon: '🪶', name: 'Teaching release this term', desc: 'Drop your current teaching load.', gw: 15, avail: () => (G.teachLoad || 0) > 0, do: () => { G.teachLoad = 0; G.teachUntil = 0; return 'Someone else will teach your course. Your evenings are yours again.'; } },
  { id: 'bridge', icon: '🌉', name: 'Bridge funding', desc: 'A one-time $75,000 from department funds to keep your lab afloat. Only when you\'re low on money.', gw: 20, cd: 48, avail: () => G.money < 400000, do: () => { G.money += 75000; return '+$75,000 bridge funding. "Don\'t make me regret this."'; } },
  { id: 'ta', icon: '🧑‍🏫', name: 'A TA line for one of your grad students', desc: 'The department pays one grad student\'s stipend and tuition for a term while they TA.', gw: 12, avail: () => team().some(p => p.role === 'grad' && !(p.fellowship > 0)), do: () => { const p = team().find(q => q.role === 'grad' && !(q.fellowship > 0)); p.fellowship = 16; p.stress = Math.min(100, p.stress + 8); return `${p.first} will TA this term. Their salary is covered, and they're a bit busier.`; } },
  { id: 'committee', icon: '🚪', name: 'Get off a committee', desc: 'Hand one of your committee seats to someone else.', gw: 8, avail: () => (G.commits || []).length > 0, do: () => { G.commits.shift(); return 'One fewer Tuesday 8am meeting.'; } },
  { id: 'space', icon: '🏗️', name: 'Priority for a lab renovation', desc: 'The lab expansion becomes available at 40% off.', gw: 25, avail: () => !G.equip.expansion && !G.flags.expansionDiscount, do: () => { G.flags.expansionDiscount = true; return 'The renovation is on the schedule. Check the Lab Store.'; } },
  { id: 'letter', icon: '✉️', name: 'A strong letter from the chair for your tenure file', desc: 'Only in the years before your tenure review.', gw: 15, avail: () => G.titleIdx === 0 && G.week > 4 * 48 && !G.flags.chairLetter, do: () => { G.flags.chairLetter = true; return 'The chair writes a glowing letter. It will count at your review.'; } },
];

// ---------------- monitor + whiteboard textures ----------------
export function drawMonitor(c, w, h, t) {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1e3a5f'); g.addColorStop(1, '#3a1e5f');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, w, 34);
  c.fillStyle = '#fff'; c.font = '600 20px Inter, sans-serif'; c.textBaseline = 'middle';
  c.fillText('LabOS', 14, 17); c.textAlign = 'right'; c.fillText(`Y${year()} W${wk()}`, w - 14, 17); c.textAlign = 'left';
  const unread = G.inbox.filter(m => !m.read).length;
  const tiles = [['✉️', unread ? `${unread} new` : 'Mail'], ['👥', `${team().length} people`], ['🧪', `${G.projects.filter(p => p.stage === 'running').length} running`], ['💰', fmtK(G.money)]];
  tiles.forEach(([i, l], k) => { const x = 30 + (k % 2) * 300, y = 60 + Math.floor(k / 2) * 130; c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.roundRect(x, y, 280, 110, 14); c.fill(); c.font = '44px "Segoe UI Emoji", sans-serif'; c.fillText(i, x + 20, y + 56); c.fillStyle = k === 0 && unread ? '#ffd36a' : '#fff'; c.font = '600 30px Inter, sans-serif'; c.fillText(l, x + 90, y + 56); c.fillStyle = '#fff'; });
  c.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(t * 3) * 0.3) + ')'; c.font = '20px Inter, sans-serif'; c.textAlign = 'center'; c.fillText('click to use', w / 2, h - 24); c.textAlign = 'left';
}

export function drawWhiteboard(c, w, h) {
  c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.04)'; for (let i = 0; i < 6; i++) { const r = k => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1; c.beginPath(); c.ellipse(r(1) * w, r(2) * h, 120, 40, r(3), 0, 7); c.fill(); } // fixed smudges, same every redraw
  c.fillStyle = '#1a3a8a'; c.font = 'bold 54px Caveat, cursive'; c.fillText(`${G.labName.toUpperCase()}: PROJECTS`, 30, 60);
  const ps = G.projects.filter(p => ['running', 'results', 'review', 'idea'].includes(p.stage)).slice(0, 7);
  let y = 115;
  if (!ps.length) { c.fillStyle = '#8a1a1a'; c.font = '40px Caveat, cursive'; c.fillText('(nothing! brainstorm something!)', 40, y); }
  for (const p of ps) {
    c.fillStyle = p.stage === 'idea' ? '#888' : '#222'; c.font = '34px Caveat, cursive';
    let t = p.title; if (t.length > 52) t = t.slice(0, 50) + '…';
    c.fillText((p.stage === 'idea' ? 'someday: ' : '• ') + t, 30, y);
    c.strokeStyle = '#1a6a2a'; c.lineWidth = 3; c.strokeRect(w - 250, y - 24, 200, 26);
    c.fillStyle = p.stage === 'review' ? '#d08a1a' : p.stage === 'results' ? '#1a6a2a' : '#4a90d9';
    c.fillRect(w - 248, y - 22, 196 * (p.stage === 'review' || p.stage === 'results' ? 1 : p.progress / 100), 22);
    c.fillStyle = '#222'; c.font = '24px Caveat, cursive'; c.fillText(p.stage === 'review' ? 'review' : p.stage === 'results' ? 'DATA!' : Math.round(p.progress) + '%', w - 40, y);
    y += 58;
  }
  if (G.flags.quote) { c.save(); c.translate(w - 470, h - 105); c.rotate(-0.03); c.fillStyle = '#6a1a8a'; c.font = '26px Caveat, cursive'; let q = `"${G.flags.quote}"`; if (q.length > 44) q = q.slice(0, 43) + '…"'; c.fillText(q, 0, 0); c.font = '20px Caveat, cursive'; c.fillText(`  — ${G.pi}, ${year() > 1 ? 'yr ' + year() : 'this year'}`, 40, 24); c.restore(); }
  if (G.flags.kidDrawing) { c.save(); c.translate(w - 170, 90); c.strokeStyle = '#d0308a'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 28, 0, 7); c.stroke(); for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, 60, 16, i * 1.05, 0, 7); c.stroke(); } c.fillStyle = '#d0308a'; c.font = '26px Caveat, cursive'; c.fillText(`by ${G.flags.kidDrawing} ♥`, -40, 60); c.restore(); }
  c.fillStyle = '#8a1a1a'; c.font = '30px Caveat, cursive'; c.save(); c.translate(w - 230, h - 40); c.rotate(-0.06); c.fillText('DO NOT ERASE!!', 0, 0); c.restore();
  c.fillStyle = '#1a6a2a'; c.font = '28px Caveat, cursive'; c.fillText(`tenure: ${G.titleIdx ? 'YES ✓' : `yr ${year()}/6`}   ·   papers: ${G.papers.length}`, 30, h - 30);
}
