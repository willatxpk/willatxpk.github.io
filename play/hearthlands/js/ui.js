// ===== User interface =====
const UI = { tool: { kind: 'select' }, cat: 'housing', roofPick: null, win: null, lastInspect: '', tradeState: null, armyCount: 0, logOpen: false };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.floor(v).toString();
const fmt1 = v => (v >= 0 ? '+' : '') + (Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1));
function bar(v, col) { return `<div class="bar"><div style="width:${clamp(v, 0, 100)}%;background:${col || moodCol(v)}"></div></div>`; }
function moodCol(v) { return v > 66 ? '#66bb6a' : v > 40 ? '#ffca28' : v > 20 ? '#ff7043' : '#e53935'; }
function moodFace(v) { return v > 75 ? '😄' : v > 55 ? '🙂' : v > 35 ? '😐' : v > 18 ? '🙁' : '😠'; }

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
}
function addLog(msg, kind) {
  G.log.unshift({ d: G.time.day, msg, kind: kind || 'info' });
  if (G.log.length > 120) G.log.length = 120;
  UI.logDirty = true;
}

// ---------- Build ----------
function buildUI() {
  // resource bar
  $('#resbar').innerHTML = RES.map(r => `<div class="res click" id="res-${r}" data-act="prires" data-arg="${r}" data-tipfn="res:${r}"><span class="ico">${RES_INFO[r].icon}</span><b id="r-${r}">0</b><small id="d-${r}"></small><i class="pmark" id="pm-${r}"></i></div>`).join('') +
    `<div class="res click" data-act="win" data-arg="kin" data-tipfn="pop"><span class="ico">👥</span><b id="r-pop">0</b><small id="d-pop"></small></div>` +
    `<div class="res click" data-act="win" data-arg="kin" data-tipfn="beds"><span class="ico">🛏️</span><b id="r-beds">0</b></div>`;
  $('#tools').innerHTML = [
    ['select', '👆', 'Select / inspect (Esc)'], ['build', '🔨', 'Build (B)'], ['road', '🛤️', 'Roads & bridges (R)'], ['terra', '⛏️', 'Terraform: reshape your land (T)'], ['claim', '🚩', 'Claim land with influence (C) — single tiles or big blocks'], ['colony', '🏕️', 'Expedition (F) — send pioneers to found a colony somewhere strategic'],
    ['move', '↔️', 'Move a building (M) — click it, then click its new spot'], ['upgrade', '⬆️', 'Upgrade (U) — click buildings to upgrade them'], ['star', '⭐', 'Star (Q) — click workplaces to staff them first'],
    ['pausework', '⏯️', 'Pause / resume work (Z) — click workplaces to free or restore their workers'], ['paint', '🎨', 'Paint roofs (P)'], ['demolish', '💥', 'Demolish (X)'],
  ].map(([k, i, t]) => `<button class="tool" data-act="tool" data-arg="${k}" data-tip="${t}" id="tool-${k}">${i}</button>`).join('') +
    `<div class="tsep"></div>` + [['home', '🏠', 'Jump to your capital (H)'], ['nextcity', '🏰', 'Jump to your next vassal city (G)'], ['nextidle', '🧑‍🌾', 'Find an unemployed kin (I)'], ['threat', '⚠️', 'Jump to the nearest enemy army (E)']]
      .map(([k, i, t]) => `<button class="tool" data-act="${k}" data-tip="${t}">${i}</button>`).join('');
  $('#bottombar').innerHTML = [
    ['kin', '👥', 'Kin'], ['realm', '🏛️', 'Realm'], ['ages', '⏳', 'Ages'], ['research', '📜', 'Research'], ['diplo', '🌍', 'Diplomacy'], ['army', '⚔️', 'Army'], ['menu', '⚙️', 'Menu'],
  ].map(([k, i, t]) => `<button class="bb" data-act="win" data-arg="${k}" id="bb-${k}"><span>${i}</span>${t}<i class="badge" id="badge-${k}"></i></button>`).join('');
  $('#speed').innerHTML = [[0, '⏸'], [1, '▶'], [2, '▶▶'], [4, '▶▶▶'], [8, '⏩']].map(([s, l]) => `<button data-act="speed" data-arg="${s}" id="sp-${s}" data-tip="${s ? s + '× speed (' + (s === 1 ? 'Space toggles pause' : 'keys 1-5') + ')' : 'Pause (Space)'}">${l}</button>`).join('');
  setTool('select');
}

function hideTip() { UI.mapTip = ''; $('#tip').classList.add('hidden'); }
function setTool(kind, type) {
  UI.tool = { kind, type }; hideTip();
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.id === 'tool-' + kind));
  const menu = kind === 'build' || kind === 'road' || kind === 'paint' || kind === 'terra' || kind === 'claim' || kind === 'colony';
  $('#buildmenu').classList.toggle('hidden', !menu);
  if (menu) renderBuildMenu();
  R.canvas.style.cursor = kind === 'select' ? 'default' : kind === 'move' ? (type ? 'grabbing' : 'grab') : 'crosshair';
  if (kind !== 'army') R.highlight = null;
}

function lockReason(type) {
  const d = B[type];
  if (d.tech && !hasTech(d.tech)) return `Research ${TECHS[d.tech].name}`;
  if (d.th && thLevel() < d.th) return `${ERAS[d.th].icon} ${ERAS[d.th].name}`;
  if (d.unique && countB(type)) return 'Built';
  return null;
}
function renderBuildMenu() {
  const kind = UI.tool.kind;
  let h = '';
  if (kind === 'claim' || kind === 'colony') { $('#buildmenu').innerHTML = expandMenu(); return; }
  if (kind === 'paint') {
    h += `<div class="bm-title">🎨 Paint roofs — pick a colour, then click buildings</div><div class="swatches">` +
      ROOF_COLORS.map(c => `<div class="sw ${UI.roofPick === c ? 'on' : ''}" style="background:${c}" data-act="roof" data-arg="${c}"></div>`).join('') + `</div>`;
    $('#buildmenu').innerHTML = h; return;
  }
  if (kind === 'terra') {
    h += `<div class="bm-title">⛏️ Terraform — reshape your own land: ${terraMode() === 'area' ? 'click a tile or drag a box over a whole area' : 'click or drag to paint'}. Right-click to stop. ${terraModes()}</div><div class="cards">`;
    for (const [id, t] of Object.entries(TERRAFORM)) {
      const lock = t.tech && !hasTech(t.tech) ? `Research ${TECHS[t.tech].name}` : null;
      h += `<div class="card ${UI.tool.type === id ? 'on' : ''} ${lock ? 'locked' : ''} ${!lock && !canAfford(terraCost(id)) ? 'poor' : ''}" data-act="${lock ? '' : 'pickterra'}" data-arg="${id}" data-tip="${esc(t.desc)}"><div class="ci">${t.icon}</div><div class="cn">${t.name}</div><div class="cc">${lock ? '🔒 ' + lock : costStr(terraCost(id))}${t.gain ? ` <span class="pos">+${costStr(t.gain)}</span>` : ''}</div></div>`;
    }
    $('#buildmenu').innerHTML = h + `</div>`; return;
  }
  if (kind === 'road') {
    h += `<div class="bm-title">🛤️ Roads — click or drag to lay; right-click to stop</div><div class="cards">`;
    for (const [id, r] of Object.entries(ROADS)) {
      const lock = r.tech && !hasTech(r.tech) ? `Research ${TECHS[r.tech].name}` : null;
      h += `<div class="card ${UI.tool.type === id ? 'on' : ''} ${lock ? 'locked' : ''}" data-act="${lock ? '' : 'pickroad'}" data-arg="${id}" data-tip="${esc(r.desc)}"><div class="ci">${r.icon}</div><div class="cn">${r.name}</div><div class="cc">${lock || costStr(roadCost(id))}</div></div>`;
    }
    h += `<div class="card ${UI.tool.type === 'erase' ? 'on' : ''}" data-act="pickroad" data-arg="erase" data-tip="Remove roads"><div class="ci">🧽</div><div class="cn">Remove road</div><div class="cc">Free</div></div></div>`;
    $('#buildmenu').innerHTML = h; return;
  }
  h += `<div class="tabs">` + CATS.filter(c => c.id !== 'roads').map(c => `<button class="tab ${UI.cat === c.id ? 'on' : ''}" data-act="cat" data-arg="${c.id}">${c.icon} ${c.name}</button>`).join('') + `</div><div class="cards">`;
  for (const [id, d] of Object.entries(B)) {
    if (d.cat !== UI.cat) continue;
    const lock = lockReason(id);
    const aff = canAfford(d.cost || {});
    h += `<div class="card ${UI.tool.type === id ? 'on' : ''} ${lock ? 'locked' : ''} ${!aff && !lock ? 'poor' : ''}" data-act="${lock ? '' : 'pickb'}" data-arg="${id}" data-tipfn="b:${id}">
      <div class="ci">${d.icon}</div><div class="cn">${d.name}</div><div class="cc">${lock ? '🔒 ' + lock : costStr(d.cost || {})}</div></div>`;
  }
  h += `</div>`;
  $('#buildmenu').innerHTML = h;
}
function buildTip(id) {
  const d = B[id];
  let h = `<b>${d.icon} ${d.name}</b><br>${d.desc}<br>`;
  if (d.prod) h += `<br>Output per worker/day: ${Object.entries(d.prod).map(([r, v]) => `${RES_INFO[r].icon}${v}`).join(' ')}`;
  if (d.consume) h += `<br>Uses: ${Object.entries(d.consume).map(([r, v]) => `${RES_INFO[r].icon}${v}`).join(' ')}`;
  if (d.workers) h += `<br>Workers: ${d.workers} (+1 per level)`;
  if (d.power > 0) h += `<br>⚡ Supplies ${d.power} power${d.workers ? ' per level' : ''}`;
  if (d.power < 0) h += `<br>⚡ Needs ${-d.power} power`;
  if (d.maxLevel > 1 && d.levelNames) h += `<br>Upgrades: ${d.levelNames.join(' → ')} <small>(one more level per age)</small>`;
  if (d.radius && !d.defense) h += `<br>Radius: ${d.radius} tiles`;
  if (d.housing) h += `<br>Houses: ${d.housing.join(' / ')} kin by level`;
  if (d.appeal) h += `<br>Beauty: ${d.appeal > 0 ? '+' : ''}${d.appeal} (radius ${d.appealR})`;
  h += `<br>Cost: ${costStr(d.cost || {})}`;
  return h;
}

// ---------- Top bar ----------
function updateTop() {
  for (const r of RES) {
    const v = G.res[r]; const el = $('#r-' + r);
    if (r === 'coal') { const show = thLevel() >= 5 || v > 0 || hasTech('steampower'); $('#res-coal').style.display = show ? '' : 'none'; if (!show) continue; }
    el.textContent = fmt(v);
    el.classList.toggle('full', CAPPED.includes(r) && v >= storageCap(r) - 0.5);
    el.classList.toggle('neg', v < 1 && (r === 'food' || r === 'gold'));
    const rate = liveRate(r);
    const d = $('#d-' + r); d.textContent = Math.abs(rate) < 0.05 ? '' : fmt1(rate); d.className = rate < 0 ? 'neg' : 'pos';
  }
  { const S = subjects(); $('#r-pop').textContent = S ? `${G.kin.length}+${fmt(S)}` : G.kin.length; }
  const beds = totalBeds(), homeless = G.kin.filter(k => !k.home && !k.away).length;
  $('#r-beds').textContent = `${G.kin.length}/${beds}`; $('#r-beds').classList.toggle('neg', homeless > 0 || G.kin.length > beds); $('#r-beds').classList.toggle('full', !homeless && beds - G.kin.length === 0);
  for (const r of RES) { const pi = (G.priorities || []).indexOf(r); $('#pm-' + r).textContent = pi >= 0 ? pi + 1 : ''; $('#res-' + r).classList.toggle('prio', pi >= 0); }
  $('#d-pop').textContent = moodFace(avgMood()); $('#d-pop').className = '';
  const h = Math.floor(G.time.hour), m = Math.floor((G.time.hour % 1) * 60 / 15) * 15;
  const E = ERAS[thLevel()];
  $('#clock').innerHTML = `<span class="link" data-act="win" data-arg="ages" data-tip="${E.name}: ${E.desc}">${E.icon} ${E.name} · Year ${year()}, day ${yearDay()}</span><span class="time">🕐 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${G.power && G.power.dem > 0 ? ` <span class="${G.power.ratio < 1 ? 'neg' : 'pos'}" data-tip="Power grids: ${Math.round(G.power.sup)} supplied / ${Math.round(G.power.dem)} needed${G.power.cut ? ` · ${G.power.cut} buildings aren't wired to any power plant (Roads → ⚡ Power line)` : ''}">⚡${Math.round(G.power.sup)}/${Math.round(G.power.dem)}${G.power.cut ? ` ⚠${G.power.cut}` : ''}</span>` : ''}</span>`;
  $('#realmName').innerHTML = `<span class="banner" style="background:${G.realm.color}"></span>${esc(G.realm.name)}`;
  for (const s of [0, 1, 2, 4, 8]) $('#sp-' + s).classList.toggle('on', G.speed === s);
  // badges
  $('#badge-research').textContent = !G.research.queue.length && Object.keys(TECHS).some(techAvail) ? '!' : '';
  const war = anyWar(); $('#badge-army').textContent = war ? '⚔' : '';
  $('#badge-ages').textContent = thLevel() < MAX_ERA && !advanceBlock() && canAfford(ERAS[thLevel() + 1].cost) ? '!' : '';
  $('#badge-diplo').textContent = war ? '!' : '';
  const wishes = G.kin.filter(k => k.wish).length; $('#badge-kin').textContent = wishes ? wishes : '';
  // goals
  const gs = activeGoals().map(i => GOALS[i]);
  const pr = G.priorities || [];
  const starred = Object.values(G.buildings).filter(b => b.priority);
  let ph = `<div class="gh">⭐ Priorities</div>`;
  if (pr.length) ph += pr.map((r, i) => { const n = Object.values(G.buildings).filter(b => producesRes(b, r)); const w = n.reduce((s, b) => s + b.workers.length, 0), sl = n.reduce((s, b) => s + workerSlots(b), 0); return `<div class="g prow">${i + 1}. ${RES_INFO[r].icon} ${RES_INFO[r].name} <small>${n.length ? `${w}/${sl} workers` : '<span class="neg">nothing makes this yet</span>'}</small> <span class="link x2" data-act="prires" data-arg="${r}" data-tip="Remove priority">✕</span></div>`; }).join('');
  else ph += `<div class="g dim">None — click a resource in the top bar to prioritise it.</div>`;
  if (starred.length) ph += `<div class="g">★ Starred: ${starred.map(b => `<span class="link" data-act="selb" data-arg="${b.id}">${B[b.type].icon}</span>`).join(' ')}</div>`;
  const gh = ph + `<div class="gh" style="margin-top:5px">🎯 Goals ${G.goalsDone.length}/${GOALS.length}</div>` + (gs.length ? gs.map(g => `<div class="g">• ${g.text} <small>(${costStr(g.reward)})</small></div>`).join('') : '<div class="g">All goals complete!</div>');
  if (gh !== UI.lastGoals) { UI.lastGoals = gh; $('#goals').innerHTML = gh; }
  if (UI.logDirty) renderLog();
}
function renderLog() {
  UI.logDirty = false;
  const n = UI.logOpen ? 40 : 5;
  $('#log').innerHTML = `<div class="loghead" data-act="logtoggle">📜 Chronicle ${UI.logOpen ? '▾' : '▴'}</div>` + G.log.slice(0, n).map(l => `<div class="le ${l.kind}"><small>D${l.d}</small> ${l.msg}</div>`).join('');
  $('#log').classList.toggle('open', UI.logOpen);
}

// ---------- Inspector ----------
function inspect(sel) { R.selected = sel; UI.lastInspect = ''; renderInspector(); }
function renderInspector() {
  const el = $('#inspector'), s = R.selected;
  if (!s) { el.classList.add('hidden'); return; }
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  let h = '';
  if (s.kind === 'b') { const b = G.buildings[s.id]; if (!b) { R.selected = null; el.classList.add('hidden'); return; } h = inspectBuilding(b); }
  else if (s.kind === 'k') { const k = kinById(s.id); if (!k) { R.selected = null; el.classList.add('hidden'); return; } h = inspectKin(k); }
  else if (s.kind === 't') h = inspectTile(s.x, s.y);
  if (h === UI.lastInspect) return;
  UI.lastInspect = h;
  el.innerHTML = `<button class="x" data-act="closeinspect">✕</button>` + h;
  el.classList.remove('hidden');
}
function workerRow(k) { return `<div class="row link" data-act="selk" data-arg="${k.id}">${moodFace(k.mood)} ${esc(kinName(k))} <small>${k.job || k.soldier ? jobTitle(k) + ' · ' : ''}${k.state === 'work' ? 'working' : k.state}</small></div>`; }
function inspectBuilding(b) {
  const d = B[b.type];
  const name = b.type === 'townhall' ? ERAS[b.level].hall : d.levelNames ? d.levelNames[b.level - 1] : d.name;
  let h = `<h3>${d.icon} ${name} ${d.maxLevel > 1 ? `<small>Lv ${b.level}</small>` : ''}</h3><p class="desc">${d.desc}</p>`;
  if (b.ruined) h += `<div class="warn">🚧 Damaged — out of action for ${b.ruined} more day${b.ruined > 1 ? 's' : ''}.</div>`;
  h += gridLine(b);
  if (b.type === 'townhall') {
    h += `<div class="kv">Kin: <b>${G.kin.length}</b> · Free beds: <b>${freeHousing()}</b></div><button class="btn sm" data-act="win" data-arg="kin">📯 Recruit settlers</button>`;
    h += `<div class="kv">${ERAS[b.level].icon} <b>${ERAS[b.level].name}</b> · ${GOVS[G.gov].icon} ${GOVS[G.gov].name} · ${ECONS[G.econ].icon} ${ECONS[G.econ].name}</div>`;
    h += `<div class="kv">Influence/day: ${(1 + b.level * 0.8).toFixed(1)} · Knowledge/day: ${(1 + b.level * 0.8).toFixed(1)} · Storage cap: ${storageCap('wood')}</div>`;
    if (b.level < MAX_ERA) { const nx = ERAS[b.level + 1], bl = advanceBlock();
      h += `<div class="sec">Next age: ${nx.icon} ${nx.name}</div><div class="dim">${nx.desc} The hall becomes a ${nx.hall}.</div>`;
      h += `<button class="btn" data-act="advance" ${!bl && canAfford(nx.cost) ? '' : 'disabled'}>${nx.icon} Advance — ${costStr(nx.cost)}</button>${bl ? `<div class="dim">${bl}</div>` : ''}`;
    } else h += `<div class="sec">The final age — your Grand Capitol stands.</div>`;
    h += `<button class="btn sm" data-act="win" data-arg="ages">⏳ Ages, government &amp; world powers</button>`;
  }
  if (d.housing) {
    const rs = residents(b);
    const rl = roadLink(b);
    h += `<div class="sec">Residents ${rs.length}/${houseCap(b)} · Comfort +${d.comfort[b.level - 1]} · Beauty ${appealAt(b.x, b.y).toFixed(0)}</div>` + householdHtml(b);
    h += `<div class="kv ${rl.linked ? 'pos' : hubDist(b) > 9 ? 'neg' : 'dim'}">${rl.linked ? '🛣️ Linked to town by road: residents +3 mood' : hubDist(b) > 9 ? '🛣️ Cut off from town: residents −3 mood until a road links this home' : '🛣️ A road linking this home to town would give residents +3 mood'}</div>`;
  }
  if (d.workers && b.type !== 'barracks') {
    h += `<div class="sec">Workers ${b.workers.length}/${workerSlots(b)} · Site ×${buildingMult(b).toFixed(2)}</div>`;
    if (isWorkplace(b)) { const rf = roadFactor(b); if (rf.note) h += `<div class="kv ${rf.bad ? 'neg' : rf.ok ? 'pos' : 'dim'}">${rf.note}</div>`; }
    h += b.workers.map(kinById).filter(Boolean).map(workerRow).join('') || '<div class="row dim">No workers — need idle adults.</div>';
    if (d.prod && d.prod.gold) h += `<div class="kv">🧺 ${G.kin.length} kin to sell to: ×${customersMult().toFixed(2)} gold (grows with your population)</div>`;
    const est = estimateOutput(b); if (est) h += `<div class="kv">Est. output/day: ${Object.entries(est).map(([r, v]) => `${RES_INFO[r].icon}${v.toFixed(1)}`).join(' ')}${d.consume ? ` · uses ${Object.entries(d.consume).map(([r, v]) => `${RES_INFO[r].icon}${(v * buildingMult(b) * b.workers.length).toFixed(1)}`).join(' ')}` : ''}</div>`;
    if (b.starved) h += `<div class="warn">⚠️ Missing input materials!</div>`;
    h += `<div class="btnrow"><button class="btn sm" data-act="pause" data-arg="${b.id}">${b.paused ? '▶ Resume' : '⏸ Pause'}</button>
      <button class="btn sm ${b.priority ? 'on' : ''}" data-act="prio" data-arg="${b.id}" data-tip="Staff this building first">⭐ Priority</button></div>`;
  }
  if (d.leisure) { const vis = G.kin.filter(k => k.dest === b.id && k.state === 'leisure').length; h += `<div class="kv">Visitors now: ${vis}</div>`; }
  if (b.type === 'barracks') {
    const sol = G.kin.filter(k => k.soldier && k.job === b.id);
    h += `<div class="sec">Soldiers ${sol.length}/${B.barracks.soldiers[b.level - 1]} (realm total ${soldiers().length}/${barracksCap()})</div>` + sol.map(k => `<div class="row"><span class="link" data-act="selk" data-arg="${k.id}">${k.away ? '🚩' : '🛡️'} ${esc(kinName(k))}</span> <small>pow ${soldierPower(k).toFixed(1)}</small> ${k.away ? '' : `<button class="btn xs" data-act="disband" data-arg="${k.id}">Discharge</button>`}</div>`).join('');
    h += `<div class="sec">Army stance <small>(recruits automatically each day)</small></div><div class="btnrow">${stanceButtons()}</div>`;
    h += `<div class="dim">Target ${armyTarget()} soldiers · each costs ${costStr(trainCost())} to train.</div><button class="btn" data-act="win" data-arg="army">⚔️ Army &amp; attacks</button>`;
  }
  if (b.type === 'market') h += `<button class="btn" data-act="win" data-arg="realm">⚖️ Open market (Realm)</button>`;
  if (b.type === 'colony') { const c = settleCenters().find(o => o.b === b), pop = G.kin.filter(k => { const hm = homeOf(k); return hm && dist(hm.x, hm.y, b.x, b.y) <= 4; }).length;
    h += `<div class="sec">🏕️ ${esc(b.colonyName || 'Colony')} <small>founded day ${b.founded || '?'}</small></div><div class="kv">${pop} kin live here · borders grow up to ${c ? c.r.toFixed(1) : '?'} tiles around it · it is a road hub and stores ${B.colony.storage * b.level} of each good</div>`;
    const feat = []; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inB(b.x + dx, b.y + dy)) feat.push(...tileFeatures(b.x + dx, b.y + dy).filter(s => /ford|chokepoint/.test(s))); if (feat.length) h += `<div class="kv pos">Controls: ${[...new Set(feat.map(s => s.split(' — ')[0]))].join(', ')}</div>`; }
  if (b.type === 'cityhall') { const c = cityOf(b); if (c) {
    const sm = 1 + fx('tribute');
    h += `<div class="sec">🏰 City of ${esc(c.name)} <small>founded day ${c.founded}</small></div><div class="kv">Tribute/day: ${costStr({ gold: 1.5 * b.level * sm, influence: 0.5 * b.level * sm, food: 2 * b.level * sm })}</div>`;
    h += cityUnrestHtml(c);
    if (c.pop >= 1) h += `<div class="kv">👥 <b>${Math.floor(c.pop)}</b> subjects live here — they eat ${(c.pop * 0.5).toFixed(0)} 🍞/day from your stores, pay ${(c.pop * 0.12).toFixed(0)} 🪙/day and add ${Math.floor(c.pop / 15)} to the garrison's size</div>`;
    h += `<div class="kv">Garrison: <b>${c.levies}/${levyCap(c)}</b> levies · power ${levyPower(c).toFixed(0)} · defends land within 8 tiles · upkeep ${(c.levies * 0.3).toFixed(1)} 🪙/day</div>`;
    h += `<div class="btnrow"><button class="btn sm" data-act="levy" data-arg="${b.id}" ${c.levies < levyCap(c) && canAfford(levyCost()) ? '' : 'disabled'}>🛡️ Raise levy — ${costStr(levyCost())}</button><button class="btn sm ${c.autoIntercept ? 'on' : ''}" data-act="cityauto" data-arg="${b.id}" data-tip="The garrison rides out against enemy armies passing within 6 tiles when it is strong enough.">🏇 Auto-intercept</button></div>`;
    for (const e of enemyArmies()) if (dist(b.x, b.y, Math.round(e.x), Math.round(e.y)) <= 10) h += `<button class="btn sm" data-act="cityfight" data-arg="${b.id}|${e.id}">⚔️ Attack ${fac(e.owner).name}'s army (${e.n}) now</button>`;
    h += `<div class="dim">In peacetime the city keeps 2 levies on its own; in war it arms fully when your treasury has 150+ gold. Each levy costs 0.3 🪙/day.</div>`;
  } }
  if (d.maxLevel > 1 && b.type !== 'townhall') {
    const ml = maxLevelFor(b.type);
    if (b.level < d.maxLevel) {
      const c = upgradeCost(b);
      if (b.level < ml) h += `<button class="btn" data-act="upgrade" data-arg="${b.id}" ${canAfford(c) ? '' : 'disabled'}>⬆️ Upgrade to ${d.levelNames ? d.levelNames[b.level] : 'Lv ' + (b.level + 1)} — ${costStr(c)}</button>`;
      else h += `<div class="dim">Next level (${d.levelNames ? d.levelNames[b.level] : 'Lv ' + (b.level + 1)}) needs the ${ERAS[b.level + 1].icon} ${ERAS[b.level + 1].name}.</div>`;
      { const same = Object.values(G.buildings).filter(o => o.type === b.type), p = planUpgrades(same); if (p.cands.length > 1) h += `<button class="btn sm" data-act="upalltype" data-arg="${b.id}" ${p.pick.length ? '' : 'disabled'} data-tip="Lowest levels first, as many as you can afford">⏫ Upgrade all ${pluralName(d.name)} — ${p.pick.length}/${p.cands.length} now for ${costStr(p.cost)}</button>`; }
    }
  }
  if (!d.decor && b.type !== 'wall') {
    h += `<div class="sec">Roof colour</div><div class="swatches">` + ROOF_COLORS.map(c => `<div class="sw ${b.roof === c ? 'on' : ''}" style="background:${c}" data-act="setroof" data-arg="${b.id}|${c}"></div>`).join('') + `</div>`;
  }
  if (!['townhall', 'outpost', 'cityhall'].includes(b.type)) h += `<button class="btn" data-act="movestart" data-arg="${b.id}">↔️ Move (free)</button>`;
  if (b.type !== 'townhall') h += `<button class="btn danger" data-act="demolish" data-arg="${b.id}">💥 Demolish (refund 30%)</button>`;
  return h;
}
function inspectKin(k) {
  ensureLife(k);
  const job = k.job ? G.buildings[k.job] : null, home = homeOf(k);
  const stage = lifeStage(k), tab = UI.kinTab || 'life';
  let h = `<h3><span class="kdot" style="background:${k.shirt}"></span> <input class="name" data-kin="${k.id}" value="${esc(k.name)}" maxlength="14" size="${Math.max(3, k.name.length)}"> ${esc(k.surname)}</h3>`;
  const role = k.soldier ? `🛡️ ${jobTitle(k)}` : job ? `${B[job.type].icon} ${jobTitle(k)}` : canWork(k) ? 'Unemployed' : stage === 'Baby' ? 'Baby' : stage === 'Child' || stage === 'Teen' ? (k.state === 'study' ? 'Studying' : 'Playing') : 'Retired';
  h += `<div class="kv">${STAGE_ICON[stage]} ${stage}, age ${Math.floor(k.age)} · ${role}${k.sabbatical > G.time.day ? ' · 🏖️ on sabbatical' : ''}</div>`;
  h += `<div class="traits">${k.traits.map(t => `<span class="trait" data-tip="${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('')}</div>`;
  h += `<div class="kintabs">${[['life', '💭 Life'], ['skills', '⭐ Skills'], ['people', '💞 People'], ['story', '📖 Story']].map(([id, t]) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="kintab" data-arg="${id}">${t}</button>`).join('')}</div>`;
  if (tab === 'life') {
    h += `<div class="thought">💭 “${esc(k.thought || '...')}”</div>`;
    h += `<div class="needs"><div>Mood ${moodFace(k.mood)}</div>${bar(k.mood)}<div>Health</div>${bar(k.health, k.health > 50 ? '#66bb6a' : '#e53935')}<div>Hunger</div>${bar(k.needs.food)}<div>Energy</div>${bar(k.needs.rest)}<div>Fun</div>${bar(k.needs.fun)}<div>Social</div>${bar(k.needs.social)}</div>`;
    if (k.sick) h += `<div class="warn">🤒 Sick (${k.sick} more days)</div>`;
    if (k.asp) { const A = ASPIRATIONS[k.asp], [p, n] = aspProgress(k); h += `<div class="dream">${A.icon} Life dream: <b>${A.name}</b> <small>— ${A.desc}</small>${bar(p / n * 100, '#ba68c8')}<small>${Math.floor(p)}/${n} · fulfilling it gives +10 👑 and lasting happiness</small></div>`; }
    else if (k.age < 13) h += `<div class="dim">Too young for life dreams yet.</div>`;
    if (k.dreams) h += `<div class="kv">🌟 Dreams fulfilled: <b>${k.dreams}</b> <small>(+${Math.min(15, k.dreams * 5)} mood for life)</small></div>`;
    if (k.wish) h += `<div class="wish">✨ Wish: <b>${WISHES[k.wish.id].text(k)}</b><br><small>Grant within ${k.wish.until - G.time.day} days for +mood and +4 👑</small></div>`;
    const lm = [];
    if (k.married && k.partner) lm.push(['Happily married', 4]); if (k.pet) lm.push([`${k.pet.name} the ${k.pet.kind}`, 4]); if (rivalOf(k)) lm.push([`Rivalry with ${rivalOf(k).name}`, -4]);
    if (home) { const L = roadLink(home); if (L.linked) lm.push(['Home linked to town by road', 3]); else if (hubDist(home) > 9) lm.push(['Home cut off from town', -3]); }
    if (k.commute > 0) lm.push(['Easy commute by road', k.commute]); if (k.commute < 0) lm.push(['Long walk to work', k.commute]);
    const mods = G.mods.filter(m => m.kin === k.id || !m.kin).map(m => [m.name, m.mood]).concat(lm);
    if (mods.length) h += `<div class="mods">${mods.map(([n, v]) => `<span class="${v > 0 ? 'pos' : 'neg'}">${esc(n)} ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>`;
    h += `<div class="kv">🏠 ${home ? `<span class="link" data-act="selb" data-arg="${home.id}">${B[home.type].levelNames[home.level - 1]}</span>` : '<span class="neg">Homeless</span>'}${k.pet ? ` · ${{ dog: '🐕', cat: '🐈', goat: '🐐' }[k.pet.kind]} ${esc(k.pet.name)}` : ''}</div>`;
    if (canWork(k)) {
      const opts = Object.values(G.buildings).filter(b => B[b.type].workers && b.type !== 'barracks' && !b.paused);
      h += `<div class="sec">Assign job</div><select data-kinjob="${k.id}"><option value="">— none —</option>${opts.map(b => `<option value="${b.id}" ${k.job === b.id ? 'selected' : ''}>${B[b.type].icon} ${B[b.type].name} (${b.workers.length}/${workerSlots(b)}) · ${SKILLS[skillOf(b.type)].icon}${skillLv(k, skillOf(b.type))} @${b.x},${b.y}</option>`).join('')}</select>`;
    }
  } else if (tab === 'skills') {
    h += `<div class="dim">Kin learn by doing: working, studying, worship, the tavern and the arts. Each level makes them 5% better at matching work, and working beside a master teaches faster.</div>`;
    for (const s in SKILLS) {
      const L = skillLv(k, s), S = SKILLS[s]; if (!L && !skillXp(k, s)) continue;
      h += `<div class="skrow"><span>${S.icon} ${S.name}</span><b>${L}</b><small>${SKILL_RANKS[L]}</small>${bar(skillProg(k, s) * 100, '#ffd54f')}</div>`;
    }
    if (!Object.keys(SKILLS).some(s => skillXp(k, s) > 0)) h += `<div class="dim">No skills yet.</div>`;
    if (k.pref) h += `<div class="kv">🎯 Wants to work as ${aAn(SKILLS[k.pref].title)} ${SKILLS[k.pref].title} <button class="btn xs" data-act="clearpref" data-arg="${k.id}">Forget it</button></div>`;
    if (job) h += `<div class="kv">At work: ${SKILLS[skillOf(job.type)].icon} ×${skillMult(k, job).toFixed(2)} output from skill</div>`;
  } else if (tab === 'people') {
    const link = o => `<span class="link" data-act="selk" data-arg="${o.id}">${esc(o.name)}</span>`;
    if (k.partner) { const p = kinById(k.partner); if (p) h += `<div class="kv">${k.married ? '💍 Married to' : '💕 Partner:'} ${link(p)} <small>${k.married ? `since day ${k.married}` : ''} · bond ${Math.round(k.friends[p.id] || 0)}</small></div>`; }
    const par = k.parents.map(kinById).filter(Boolean); if (par.length) h += `<div class="kv">👪 Parents: ${par.map(link).join(', ')}</div>`;
    const kids = childrenOf(k); if (kids.length) h += `<div class="kv">👶 Children: ${kids.map(c => `${link(c)} <small>${Math.floor(c.age)}</small>`).join(', ')}</div>`;
    const sib = G.kin.filter(o => o !== k && o.parents.length && o.parents.some(p => k.parents.includes(p))); if (sib.length) h += `<div class="kv">🧑‍🤝‍🧑 Siblings: ${sib.map(link).join(', ')}</div>`;
    const gk = grandkids(k); if (gk) h += `<div class="kv">🌳 Grandchildren: ${gk}</div>`;
    const fr = Object.entries(k.friends).filter(([id]) => +id !== k.partner).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => [kinById(+id), v]).filter(([f, v]) => f && v >= 5);
    h += `<div class="sec">Friends</div>` + (fr.map(([f, v]) => `<div class="row">${link(f)} <small>${bondLabel(v)} (${Math.round(v)})</small></div>`).join('') || '<div class="dim">No close friends yet.</div>');
    const rv = Object.entries(k.rivals || {}).filter(([, v]) => v >= 20).map(([id, v]) => [kinById(+id), v]).filter(([f]) => f);
    if (rv.length) h += `<div class="sec">Rivals</div>` + rv.map(([f, v]) => `<div class="row">😠 ${link(f)} <small>${v >= 60 ? 'Enemy' : v >= 40 ? 'Rival' : 'Tension'} (${Math.round(v)})</small></div>`).join('');
    if (k.pet) h += `<div class="sec">Pet</div><div class="kv">${{ dog: '🐕', cat: '🐈', goat: '🐐' }[k.pet.kind]} ${esc(k.pet.name)} the ${k.pet.kind}</div>`;
  } else {
    h += `<div class="story">` + (k.story || []).slice().reverse().map(e => `<div class="le"><small>D${e.d}</small> ${e.i} ${esc(e.t)}</div>`).join('') + `</div>`;
  }
  if (k.soldier && !k.away) h += `<button class="btn sm" data-act="disband" data-arg="${k.id}">Discharge from army</button>`;
  h += `<button class="btn sm" data-act="follow" data-arg="${k.id}">📍 Find</button>`;
  return h;
}
// a home's household: who lives there and how they are related
function householdHtml(b) {
  const rs = residents(b); if (!rs.length) return '<div class="dim">Nobody lives here yet.</div>';
  const fams = {}; for (const k of rs) (fams[k.surname] = fams[k.surname] || []).push(k);
  return Object.entries(fams).map(([sur, ks]) => {
    ks.sort((a, c) => c.age - a.age);
    const am = ks.reduce((s, k) => s + k.mood, 0) / ks.length;
    return `<div class="household"><div class="hhead">🏠 The ${esc(sur)} household <small>${moodFace(am)} ${am.toFixed(0)}</small></div>` + ks.map(k => {
      const p = k.partner && rs.find(o => o.id === k.partner);
      return `<div class="row link" data-act="selk" data-arg="${k.id}">${STAGE_ICON[lifeStage(k)]} ${esc(k.name)} <small>${Math.floor(k.age)}${p ? (k.married ? ' · 💍 ' : ' · 💕 ') + esc(p.name) : ''}${k.job || k.soldier ? ' · ' + jobTitle(k) : ''}${k.pet ? ' · ' + { dog: '🐕', cat: '🐈', goat: '🐐' }[k.pet.kind] : ''}${k.asp ? ' · ' + ASPIRATIONS[k.asp].icon : ''}</small></div>`;
    }).join('') + `</div>`;
  }).join('');
}
function inspectTile(x, y) {
  const i = idx(x, y), t = G.tiles.terrain[i], o = G.tiles.owner[i];
  let h = `<h3>${G.tiles.special[i] === 5 ? 'River Ford' : TERRAIN[t].name}</h3>`;
  const feat = tileFeatures(x, y); if (feat.length) h += `<div class="kv">${feat.join('<br>')}</div>`;
  h += decoInfo(i);
  if (o === -1) { const si = siteScout(x, y); if (si.ok) h += `<div class="kv">🏕️ Colony site ${'★'.repeat(si.stars)} <button class="btn xs" data-act="tool" data-arg="colony">Plan an expedition</button></div>`; }
  const sp = G.tiles.special[i]; if (sp && VEINS[sp]) h += `<div class="kv">${VEINS[sp].icon} ${VEINS[sp].name} — ${sp === 3 ? 'build a Coal Mine here (Industrial Age)' : 'build a Mine here'}</div>`;
  h += `<div class="kv">Beauty here: ${appealAt(x, y).toFixed(1)}</div>`;
  if (o === 0) h += `<div class="kv">Your territory</div>`;
  else if (o === -1) {
    h += `<div class="kv">Unclaimed wilderness</div>`;
    if (canClaim(x, y)) { const c = claimCost(x, y); h += `<button class="btn" data-act="claim" data-arg="${x},${y}" ${G.res.influence >= c ? '' : 'disabled'}>🚩 Claim for ${c} 👑</button>`; }
    else h += `<div class="dim">Only tiles bordering your land can be claimed.</div>`;
  } else if (fac(o) && fac(o).minor) {
    h += villageCard(fac(o));
  } else {
    const f = fac(o);
    h += `<div class="kv"><span class="banner" style="background:${f.color}"></span> <span class="link" data-act="win" data-arg="diplo">${f.name}</span> ${f.war ? '<span class="neg">AT WAR</span>' : ''}</div><div class="kv">${ERAS[f.era || 1].icon} ${ERAS[f.era || 1].name} · ${GOVS[f.gov || 'chiefdom'].icon} ${GOVS[f.gov || 'chiefdom'].name}</div>`;
    if (f.war) {
      h += `<div class="kv">Defenders here ≈ ${(Math.min(f.troops, (x === f.cap.x && y === f.cap.y) ? 6 + f.troops * 0.6 : 3 + f.troops * 0.3) * f.quality * ((x === f.cap.x && y === f.cap.y) ? 1.6 : 1)).toFixed(0)}</div>`;
      h += `<button class="btn" data-act="attackhere" data-arg="${x},${y}" ${garrison().length ? '' : 'disabled'}>⚔️ Attack with all ${garrison().length} soldiers</button>`;
    } else {
      const blk = landSaleBlock(f, x, y);
      if (blk) h += `<div class="dim">Purchase: ${blk}</div>`;
      else {
        const p1 = landPrice(f, x, y); const area = areaTiles(f, x, y); const pa = Math.round(area.reduce((s, t) => s + landPrice(f, t.x, t.y), 0) * 0.9);
        h += `<button class="btn" data-act="buyland" data-arg="${x},${y},1" ${G.res.gold >= p1 ? '' : 'disabled'}>📜 Buy this tile — ${p1} 🪙</button>`;
        if (area.length > 1) h += `<button class="btn" data-act="buyland" data-arg="${x},${y},${area.length}" ${G.res.gold >= pa ? '' : 'disabled'}>📜 Buy area (${area.length} tiles) — ${pa} 🪙</button>`;
      }
    }
  }
  return h;
}

// ---------- Windows ----------
function openWin(w) {
  hideTip();
  if (UI.win === w) { closeWin(); return; }
  UI.win = w; renderWin(true);
}
function closeWin() { UI.win = null; $('#window').classList.add('hidden'); R.highlight = null; }
function renderWin(force) {
  const el = $('#window');
  if (!UI.win) return;
  if (!force && el.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
  const f = { kin: winKin, realm: winRealm, ages: winAges, research: winResearch, diplo: winDiplo, army: winArmy, menu: winMenu, trade: winTrade, help: winHelp }[UI.win];
  const scroll = el.querySelector('.wbody') ? el.querySelector('.wbody').scrollTop : 0;
  const [title, body] = f();
  const html = `<div class="whead"><h2>${title}</h2><button class="x" data-act="closewin">✕</button></div><div class="wbody">${body}</div>`;
  if (!force && html === UI.lastWin) return;
  UI.lastWin = html;
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.querySelector('.wbody').scrollTop = scroll;
}
function winKin() {
  const ks = G.kin.slice().sort((a, b) => (UI.kinSort === 'mood' ? a.mood - b.mood : UI.kinSort === 'age' ? b.age - a.age : a.surname.localeCompare(b.surname)));
  const am = avgMood();
  let h = `<div class="kv">Population <b>${G.kin.length}</b> · Adults ${G.kin.filter(isAdult).length} · Children ${G.kin.filter(k => !isAdult(k)).length} · Unemployed ${G.kin.filter(k => canWork(k) && !k.job).length} · Homeless ${G.kin.filter(k => !k.home).length} · Avg mood ${moodFace(am)} ${am.toFixed(0)}</div>`;
  h += `<div class="kv">Births ${G.stats.born} · Deaths ${G.stats.died} · Wishes granted ${G.stats.wishes} · Dreams fulfilled ${G.stats.dreams || 0} · Couples ${G.kin.filter(k => k.partner && k.id < k.partner).length} (${G.kin.filter(k => k.married && k.id < (k.partner || 0)).length} married) · Housing ${G.kin.length}/${totalBeds()} beds</div>`;
  { const masters = G.kin.map(k => ({ k, b: bestSkill(k) })).filter(o => o.b.lv >= 5).sort((a, c) => c.b.lv - a.b.lv).slice(0, 6);
    if (masters.length) h += `<div class="kv">⭐ Finest talents: ${masters.map(o => `<span class="link" data-act="selk" data-arg="${o.k.id}">${esc(o.k.name)}</span> <small>${SKILLS[o.b.s].icon} ${skillTitle(o.k, o.b.s)}</small>`).join(', ')}</div>`; }
  h += `<div class="sec">📯 Recruit settlers <small>— new faces every 6 days (next in ${Math.max(0, (G.recruitDay || 0) - G.time.day)})</small></div><div class="recruits">`;
  const fb = freeHousing();
  h += (G.recruits || []).map(r => { const c = recruitCost(r), n = r.people.length, ok = fb >= n && canAfford(c);
    return `<div class="rcard"><b>${n === 2 ? 'The ' + esc(r.surname) + ' couple' : esc(r.people[0].name + ' ' + r.surname)}</b>${r.people.map(p => `<div class="rp">${esc(p.name)}, ${p.age} ${p.traits.map(t => `<span class="trait" data-tip="${TRAITS[t].desc}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join('')}</div>`).join('')}
      <button class="btn sm" data-act="invite" data-arg="${r.id}" ${ok ? '' : 'disabled'}>Invite — ${costStr(c)}</button>${fb < n ? `<div class="neg"><small>Needs ${n} free bed${n > 1 ? 's' : ''}</small></div>` : ''}</div>`; }).join('') || '<div class="dim">No one is waiting right now.</div>';
  h += `</div><button class="btn xs" data-act="reroll" ${G.res.influence >= 8 ? '' : 'disabled'}>🔄 Send word for others — 8 👑</button>`;
  h += `<div class="btnrow">Sort: <button class="btn xs" data-act="kinsort" data-arg="name">Family</button><button class="btn xs" data-act="kinsort" data-arg="mood">Unhappiest</button><button class="btn xs" data-act="kinsort" data-arg="age">Oldest</button></div>`;
  h += `<table class="ktable"><tr><th></th><th>Name</th><th>Age</th><th>Mood</th><th>Work</th><th>Dream</th><th>Wish</th></tr>`;
  for (const k of ks) {
    const job = k.soldier ? '🛡️ ' + jobTitle(k) : k.job && G.buildings[k.job] ? B[G.buildings[k.job].type].icon + ' ' + jobTitle(k) : canWork(k) ? '<span class="neg">none</span>' : '—';
    const dr = k.asp ? (() => { const [p, n] = aspProgress(k); return `${ASPIRATIONS[k.asp].icon} <small>${Math.round(p / n * 100)}%</small>`; })() : '';
    h += `<tr class="link" data-act="selk" data-arg="${k.id}"><td>${moodFace(k.mood)}</td><td>${esc(kinName(k))}${k.married ? ' 💍' : k.partner ? ' 💕' : ''}${k.pet ? ' 🐾' : ''}${k.sick ? ' 🤒' : ''}${!k.home ? ' 🏚️' : ''}${k.dreams ? ' 🌟'.repeat(Math.min(3, k.dreams)) : ''}</td><td>${Math.floor(k.age)}</td><td>${bar(k.mood)}</td><td><small>${job}</small></td><td>${dr}</td><td><small>${k.wish ? WISHES[k.wish.id].text(k) : ''}</small></td></tr>`;
  }
  h += `</table>`;
  return ['👥 Your Kin', h];
}
const MARKET_PRICE = { food: 0.5, wood: 0.6, stone: 0.8, iron: 1.5, tools: 3, coal: 1 };
function winRealm() {
  const mk = countB('market');
  let h = `<div class="sec">Realm</div><div class="kv">Name <input id="realmname" value="${esc(G.realm.name)}" maxlength="24"> <button class="btn xs" data-act="rename">Rename</button></div>`;
  h += borderColorHtml();
  h += `<div class="kv">Territory <b>${G.stats.tiles}</b> tiles · Defense ${playerStrength().toFixed(0)} · Storage ${storageCap('wood')} (food ${storageCap('food')})</div>`;
  h += `<div class="kv">${ERAS[thLevel()].icon} ${ERAS[thLevel()].name} · ${GOVS[G.gov].icon} ${GOVS[G.gov].name} · ${ECONS[G.econ].icon} ${ECONS[G.econ].name} <button class="btn xs" data-act="win" data-arg="ages">⏳ Change</button></div>`;
  h += subjectsHtml();
  if (G.power && G.power.dem > 0) h += `<div class="kv">⚡ Power: ${Math.round(G.power.sup)} supplied / ${Math.round(G.power.dem)} needed ${G.power.ratio < 1 ? `<span class="neg">— shortage! Modern buildings run at ${Math.round(G.power.ratio * 100)}%. Build Power Plants (they burn coal) or renewables, and wire them up with ⚡ power lines (Roads menu).</span>` : '<span class="pos">✓</span>'}</div>`;
  h += `<div class="sec">💰 Treasury <small>— ${Math.floor(G.res.gold)} 🪙</small></div>` + ledgerHtml();
  h += `<details class="tips"><summary>How to earn more gold</summary><ul>${goldTips().map(t => `<li>${t}</li>`).join('')}</ul></details>`;
  h += `<div class="sec">Taxes</div><div class="btnrow">` + [['low', 'Low: 0.2🪙/adult, +4 mood'], ['normal', 'Normal: 0.4🪙/adult'], ['high', 'High: 0.65🪙/adult, −10 mood']].map(([k, t]) => `<button class="btn sm ${G.policies.tax === k ? 'on' : ''}" data-act="tax" data-arg="${k}" data-tip="${t}">${k}</button>`).join('') + `</div>`;
  h += `<div class="sec">Rations</div><div class="btnrow">` + [['meager', 'Meager: 70% food, −10 mood'], ['normal', 'Normal'], ['generous', 'Generous: 135% food, +7 mood']].map(([k, t]) => `<button class="btn sm ${G.policies.rations === k ? 'on' : ''}" data-act="rations" data-arg="${k}" data-tip="${t}">${k}</button>`).join('') + `</div>`;
  const fc = { food: Math.ceil(G.kin.length * 2), gold: Math.ceil(G.kin.length * 1.5) };
  h += `<div class="sec">Festival</div>`;
  if (G.festival > 0) h += `<div class="kv">🎉 Festival in progress (${G.festival} days left): +18 mood, more babies.</div>`;
  else if (G.festivalCd > 0) h += `<div class="dim">Next festival possible in ${G.festivalCd} days.</div>`;
  else h += `<button class="btn" data-act="festival" ${canAfford(fc) ? '' : 'disabled'}>🎉 Hold a 3-day festival — ${costStr(fc)}</button>`;
  h += `<div class="sec">Market ${mk ? '' : '(build a Market to trade goods for gold)'}</div>`;
  if (mk) {
    const vol = 40 * mk;
    h += `<div class="dim">Trade volume today: ${Math.floor(G.marketVol)}/${vol}</div><table class="mtable">`;
    for (const r in MARKET_PRICE) h += `<tr><td>${RES_INFO[r].icon} ${RES_INFO[r].name}</td><td>${fmt(G.res[r])}</td><td><button class="btn xs" data-act="mkt" data-arg="sell|${r}|10">Sell 10 (+${(MARKET_PRICE[r] * 10).toFixed(0)}🪙)</button></td><td><button class="btn xs" data-act="mkt" data-arg="buy|${r}|10">Buy 10 (−${(MARKET_PRICE[r] * 20).toFixed(0)}🪙)</button></td></tr>`;
    h += `</table>`;
  }
  const cs = cities();
  h += `<div class="sec">🏰 Vassal cities</div>` + (cs.length ? cs.map(c => { const b = G.buildings[c.bid]; return `<div class="row link" data-act="selb" data-arg="${b.id}">🏰 <b>${esc(c.name)}</b> Lv ${b.level} · <span class="${(c.unrest || 0) >= 75 ? 'neg' : ''}">unrest ${Math.round(c.unrest || 0)}</span> · garrison ${c.levies}/${levyCap(c)} · tribute ${costStr({ gold: 1.5 * b.level, influence: 0.5 * b.level, food: 2 * b.level })}/day</div>`; }).join('') : '<div class="dim">None yet. Conquer or annex a village, take a rival capital, or build a 🏰 Vassal Hall (Build → Civic) 10+ tiles from your capital.</div>');
  h += `<div class="sec">Yesterday's flow</div><div class="kv">${RES.map(r => `${RES_INFO[r].icon} <span class="${(G.rates[r] || 0) < 0 ? 'neg' : 'pos'}">${fmt1(G.rates[r] || 0)}</span>`).join(' · ')}</div>`;
  return ['🏛️ Realm', h];
}
function winResearch() {
  const Q = G.research, cur = Q.queue[0];
  let h = `<div class="kv">📜 Knowledge flows into your current discovery each day — from the Town Hall, Libraries and curious kin. Banked: <b>${fmt(G.res.knowledge)}</b>`;
  if (cur) { const t = TECHS[cur], p = Q.progress[cur] || 0; const perDay = Math.max(0.1, (G.rates.knowledge || 0) > 0 ? G.rates.knowledge : 1 + thLevel() * 0.8); h += ` · Researching <b>${t.name}</b> ${Math.floor(p)}/${t.cost} (~${Math.ceil((t.cost - p) / perDay)} days)`; }
  const E = curEra(), tab = clamp(UI.resEra || E, 1, MAX_ERA), ep = eraProgress();
  if (E < MAX_ERA) h += `<div class="kv">${ERAS[E].icon} <b>${ERAS[E].name}</b>: ${ep.have}/${ep.need} discoveries needed to advance to the ${ERAS[E + 1].icon} ${ERAS[E + 1].name} ${ep.have >= ep.need ? '<span class="pos">— ready! Advance from the Town Hall or ⏳ Ages.</span>' : ''}</div>`;
  h += `</div><div class="btnrow"><label class="dim"><input type="checkbox" id="autores" ${G.settings.autoResearch ? 'checked' : ''}> When the queue is empty, start the cheapest discovery automatically</label></div>`;
  h += `<div class="dim">Click a discovery to queue it (its prerequisites are queued for you). Click a queued one to remove it.</div>`;
  if (Q.queue.length) h += `<div class="kv">Queue: ${Q.queue.map((id, i) => `<span class="qchip" data-act="research" data-arg="${id}" data-tip="Click to remove">${i + 1}. ${BRANCHES[TECHS[id].branch].icon} ${TECHS[id].name}</span>`).join(' ')}</div>`;
  h += `<div class="eratabs">` + ERAS.map((_, i) => i).slice(1).map(e => { const ids = techsOfEra(e), k = ids.filter(hasTech).length; return `<button class="btn xs ${tab === e ? 'on' : ''} ${e > E ? 'future' : ''}" data-act="resera" data-arg="${e}">${ERAS[e].icon} ${ERAS[e].name} <small>${k}/${ids.length}</small></button>`; }).join('') + `</div>`;
  if (tab > E) h += `<div class="dim">🔒 These discoveries open up once you reach the ${ERAS[tab].name}.</div>`;
  h += `<div class="branches">`;
  for (const [bk, br] of Object.entries(BRANCHES)) {
    const lv = branchLevel(bk), all = Object.keys(TECHS).filter(id => TECHS[id].branch === bk), ids = all.filter(id => TECHS[id].era === tab).sort((x, y) => TECHS[x].cost - TECHS[y].cost);
    h += `<div class="branch" style="--bc:${br.color}"><div class="bhd"><span class="bico">${br.icon}</span><b>${br.name}</b><div class="blv">Level ${lv}/${all.length}</div>${bar(lv / all.length * 100, br.color)}<small>${br.bonus}</small></div>`;
    for (const id of ids) {
      const t = TECHS[id], done = hasTech(id), qi = Q.queue.indexOf(id), avail = techAvail(id), p = Q.progress[id] || 0, future = t.era > E;
      const cls = done ? 'done' : qi === 0 ? 'cur' : qi > 0 ? 'queued' : avail ? 'avail' : 'locked';
      h += `<div class="tech ${cls}" data-act="${done || future ? '' : 'research'}" data-arg="${id}"><b>${qi >= 0 ? `<span class="qn">${qi + 1}</span>` : ''}${t.name}</b><small>${t.desc}</small>`;
      h += done ? `<div class="pos">✓ Known</div>` : `<div>📜 ${t.cost}${future ? ' · <small>🔒 later age</small>' : !avail && t.req.length ? ` · <small>needs ${t.req.filter(r => !hasTech(r)).map(r => TECHS[r].name).join(', ')}</small>` : ''}</div>`;
      if (!done && p > 0) h += `<div class="bar"><div style="width:${p / t.cost * 100}%;background:${br.color}"></div></div>`;
      h += `</div>`;
    }
    h += `</div>`;
  }
  return ['📜 Research — Schools of Knowledge', h + `</div>`];
}
function govCard(kind, id, g) {
  const cur = G[kind] === id, lock = g.tech && !hasTech(g.tech);
  return `<div class="gcard ${cur ? 'on' : ''} ${lock ? 'locked' : ''}" data-act="${cur || lock ? '' : 'adopt'}" data-arg="${kind}|${id}"><div class="gi">${g.icon}</div><b>${g.name}</b><small>${g.desc}</small>${cur ? '<div class="pos">✓ Current</div>' : lock ? `<div class="dim">🔒 ${TECHS[g.tech].name} <small>(${ERAS[TECHS[g.tech].era].name})</small></div>` : '<div class="dim">Click to adopt</div>'}</div>`;
}
function winAges() {
  const E = curEra();
  let h = `<div class="agetl">` + ERAS.map((_, i) => i).slice(1).map(e => `<div class="age ${e < E ? 'done' : e === E ? 'cur' : ''}" data-tip="${esc(ERAS[e].desc)}"><div class="ai">${ERAS[e].icon}</div><b>${ERAS[e].name}</b><small>${ERAS[e].hall}</small></div>`).join('<div class="arr">›</div>') + `</div>`;
  if (E < MAX_ERA) {
    const nx = ERAS[E + 1], bl = advanceBlock(), p = eraProgress();
    h += `<div class="sec">Next: ${nx.icon} ${nx.name}</div><div class="kv">${nx.desc} Your Town Hall is rebuilt as a <b>${nx.hall}</b>, buildings can be upgraded one level further, and new buildings and discoveries open up.</div>`;
    h += `<div class="kv">Discoveries of the ${ERAS[E].name}: <b>${p.have}/${p.need}</b></div>${bar(Math.min(100, p.have / p.need * 100), '#4fc3f7')}`;
    h += `<div class="btnrow"><button class="btn" data-act="advance" ${!bl && canAfford(nx.cost) ? '' : 'disabled'}>${nx.icon} Advance to the ${nx.name} — ${costStr(nx.cost)}</button></div>${bl ? `<div class="dim">${bl}</div>` : !canAfford(nx.cost) ? '<div class="dim">Gather the resources for the rebuild.</div>' : ''}`;
  } else h += `<div class="sec">💻 The Information Age — the final age. Build the 🚀 Starship Ark for a Science Victory.</div>`;
  const cd = (G.reformCd || 0) > G.time.day ? ` · next reform in ${G.reformCd - G.time.day} days` : '';
  h += `<div class="sec">🏛️ Government <small>— a reform costs ${costStr(reformCost())} and brings 4 days of upheaval (−25% output, −6 mood)${cd}</small></div><div class="govs">` + Object.entries(GOVS).map(([id, g]) => govCard('gov', id, g)).join('') + `</div>`;
  h += `<div class="sec">💰 Economy</div><div class="govs">` + Object.entries(ECONS).map(([id, g]) => govCard('econ', id, g)).join('') + `</div>`;
  // world powers
  const rows = [{ me: true, name: G.realm.name, color: G.realm.color, era: E, gov: G.gov, tiles: G.stats.tiles, str: playerStrength() }]
    .concat(G.factions.filter(f => !f.dead).map(f => ({ f, name: f.name, color: f.color, era: f.era || 1, gov: f.gov || 'chiefdom', tiles: f.tiles, str: facStrength(f) })))
    .sort((a, b) => b.tiles - a.tiles);
  h += `<div class="sec">🌍 World powers <small>— new realms rise from villages, wandering peoples and civil wars; old ones fall</small></div><table class="ktable"><tr><th>Realm</th><th>Age</th><th>Next age</th><th>Government</th><th>Land</th><th>Strength</th><th></th></tr>`;
  for (const r of rows) {
    const f = r.f, st = r.me ? '<b>You</b>' : f.subjugated ? '<span class="pos">Your vassal</span>' : f.war ? '<span class="neg">At war with you</span>' : f.pact === 'alliance' ? '<span class="pos">Ally</span>' : f.aiWar && fac(f.aiWar) ? `<span class="dim">fighting ${esc(fac(f.aiWar).name)}</span>` : '';
    h += `<tr${f ? ` class="link" data-act="flyfac" data-arg="${f.id}"` : ''}><td><span class="banner" style="background:${r.color}"></span> ${esc(r.name)}</td><td>${ERAS[r.era].icon} ${ERAS[r.era].name}</td><td>${r.era >= MAX_ERA ? '—' : r.me ? (() => { const p = eraProgress(); return `${p.have}/${p.need} discoveries`; })() : `${Math.min(99, Math.round((f.sci || 0) / AI_ERA_COST[r.era] * 100))}%`}</td><td>${GOVS[r.gov].icon} ${GOVS[r.gov].name}</td><td>${r.tiles}</td><td>${r.str.toFixed(0)}</td><td>${st}</td></tr>`;
  }
  h += `</table><div class="dim">Domination victory: you and your vassals hold ${(dominationShare() * 100).toFixed(0)}% of the land (45% wins).</div>`;
  h += `<div class="sec">📜 Chronicle of the realms</div>` + ((G.history || []).length ? (G.history || []).slice(0, 40).map(e => `<div class="le"><small>D${e.d}</small> ${e.icon} ${esc(e.text)}</div>`).join('') : '<div class="dim">History has yet to be written.</div>');
  return ['⏳ Ages, Government &amp; World Powers', h];
}
function relLabel(r) { return r > 60 ? 'Friendly' : r > 20 ? 'Cordial' : r > -20 ? 'Neutral' : r > -50 ? 'Wary' : 'Hostile'; }
function winDiplo() {
  let h = `<div class="dim">Grow through deals or war. Click a foreign tile on the map bordering your land to buy it. Your defense: <b>${playerStrength().toFixed(0)}</b></div>`;
  const fs = G.factions.filter(f => !f.dead).sort((a, b) => (b.war - a.war) || (b.tiles - a.tiles));
  for (const f of fs) {
    const st = f.subjugated ? '<span class="pos">Vassal</span>' : f.war ? '<span class="neg">⚔️ AT WAR</span>' : f.pact === 'alliance' ? '<span class="pos">🤝 Ally</span>' : f.pact === 'nonaggression' ? `🕊️ Pact (${f.pactDays}d)` : '';
    const rc = f.relation > 20 ? '#66bb6a' : f.relation > -20 ? '#ffca28' : '#e53935';
    h += `<div class="fcard" style="border-left-color:${f.color}">
      <div class="fh"><span class="banner" style="background:${f.color}"></span><b>${f.name}</b> ${st} <button class="btn xs" data-act="flyfac" data-arg="${f.id}">📍</button></div>
      <div class="kv">${f.leader} · <i>${PERSONALITY_TEXT[f.personality]}</i></div>
      <div class="kv">${ERAS[f.era || 1].icon} ${ERAS[f.era || 1].name} · ${GOVS[f.gov || 'chiefdom'].icon} ${GOVS[f.gov || 'chiefdom'].name}${f.gov === G.gov ? ' <small class="pos">(same as yours: +relations)</small>' : ''}${f.aiWar && fac(f.aiWar) ? ` · <span class="neg">at war with ${fac(f.aiWar).name}</span>` : ''}</div>
      <div class="kv">Relation: <b style="color:${rc}">${relLabel(f.relation)} (${Math.round(f.relation)})</b> <div class="bar rel"><div style="width:${(f.relation + 100) / 2}%;background:${rc}"></div></div></div>
      <div class="kv">Land ${f.tiles} · Strength ${facStrength(f).toFixed(0)} ${facStrength(f) > playerStrength() * 1.2 ? '<span class="neg">(stronger)</span>' : facStrength(f) < playerStrength() * 0.8 ? '<span class="pos">(weaker)</span>' : ''} · Has plenty of ${RES_INFO[f.surplus].icon} · Wants ${RES_INFO[f.need].icon}</div>
      <div class="btnrow">`;
    if (f.subjugated) h += `<span class="dim">Pays you ${((2 + f.tiles * 0.06) * (1 + 0.3 * ((f.era || 1) - 1)) * (1 + fx('tribute'))).toFixed(1)} 🪙/day in tribute. Unrest <b class="${(f.unrest || 0) > 60 ? 'neg' : ''}">${Math.round(f.unrest || 0)}/100</b> — at 100 they revolt.</span> <button class="btn sm" data-act="absorb" data-arg="${f.id}" data-tip="Fold them into your realm without a war: all their land, buildings, stores and people become yours. Needs unrest 50 or less.">👑 Absorb — ${costStr(absorbCost(f))}</button> <button class="btn sm" data-act="placate" data-arg="${f.id}" data-tip="Titles and gifts for their nobles: unrest −40, relation +8.">🎁 Placate — ${costStr({ influence: 20 + 5 * curEra(), gold: 20 * curEra() })}</button>`;
    else if (f.war) {
      const t = peaceTerms(f);
      h += t.accept ? `<button class="btn sm" data-act="peace" data-arg="${f.id}">🕊️ Propose peace (they'd accept)</button>` : `<button class="btn sm" data-act="buypeace" data-arg="${f.id}" ${G.res.gold >= t.gold ? '' : 'disabled'}>🕊️ Buy peace — ${t.gold}🪙</button>`;
      h += attackButtons(f) + `<button class="btn sm" data-act="gift" data-arg="${f.id}|50">🎁 50🪙</button>`;
    } else {
      h += `<button class="btn sm" data-act="trade" data-arg="${f.id}">📦 Trade</button>
        <button class="btn sm" data-act="gift" data-arg="${f.id}|25" ${G.res.gold >= 25 ? '' : 'disabled'}>🎁 25🪙</button>
        <button class="btn sm" data-act="gift" data-arg="${f.id}|80" ${G.res.gold >= 80 ? '' : 'disabled'}>🎁 80🪙</button>`;
      if (f.pact !== 'alliance' && f.pact !== 'nonaggression') h += `<button class="btn sm" data-act="pact" data-arg="${f.id}|nonaggression" data-tip="Needs relation 15. Costs 20 👑. 40 days of guaranteed peace.">🕊️ Pact</button>`;
      if (f.pact !== 'alliance') h += `<button class="btn sm" data-act="pact" data-arg="${f.id}|alliance" data-tip="Needs Diplomacy tech and relation 55. Costs 50 👑.">🤝 Alliance</button>`;
      h += `<button class="btn sm" data-act="landview" data-arg="${f.id}" data-tip="Highlight their tiles you could buy">📜 Land</button>`;
      h += `<button class="btn sm" data-act="tribute" data-arg="${f.id}" data-tip="Works if you are much stronger. Hurts relations.">💰 Demand tribute</button>`;
      if (f.pact !== 'alliance') h += `<button class="btn sm danger" data-act="declare" data-arg="${f.id}">⚔️ Declare war</button>`;
      if (f.pact === 'alliance' && anyWar()) h += `<button class="btn sm" data-act="callarms" data-arg="${f.id}" data-tip="15 👑. Your ally attacks your enemy every day and helps defend your land. Needs relation 50.">📯 Call to arms${f.joinWar ? ' ✓' : ''}</button>`;
    }
    h += `</div>`;
    if (!f.subjugated) {
      const mr = marriageReady(f);
      h += `<div class="btnrow"><span class="dim">💍 Marriage${bonded(f) ? ` <span class="pos">(bound ${f.bond - G.time.day}d — they won't attack)</span>` : ''}:</span>
        <button class="btn xs" data-act="wedout" data-arg="${f.id}" ${mr && marriageCandidates().length ? '' : 'disabled'} data-tip="Your happiest unmarried adult weds into their court and leaves. Relation +25, +40 gold dowry, no war from them for 60 days.">Offer a bride/groom</button>
        <button class="btn xs" data-act="wedin" data-arg="${f.id}" ${mr ? '' : 'disabled'} data-tip="A noble of theirs moves in and marries one of your singles. Relation +15, 40 days of peace. Costs ${40 + Math.round(G.time.day / 4)} gold and a free bed.">Invite a noble</button></div>`;
      if (hasTech('espionage')) {
        h += `<div class="btnrow"><span class="dim">🕵️ Spies ${(G.spies || []).length}/${spySlots()}:</span>` + Object.entries(SPY_MISSIONS).map(([k, m]) => `<button class="btn xs" data-act="spy" data-arg="${f.id}|${k}" ${canAfford(m.cost) && (G.spies || []).length < spySlots() ? '' : 'disabled'} data-tip="${m.desc} ${Math.round(m.chance * 100)}% success, ${m.days} days. ${costStr(m.cost)}">${m.icon} ${m.name}</button>`).join('') + `</div>`;
        const out = (G.spies || []).filter(s => s.fid === f.id); if (out.length) h += `<div class="dim">In the field: ${out.map(s => `${SPY_MISSIONS[s.kind].icon} ${SPY_MISSIONS[s.kind].name} (${s.day - G.time.day}d)`).join(', ')}</div>`;
      } else h += `<div class="dim">🕵️ Research Espionage (Exploration & Statecraft) to send spies.</div>`;
      if ((f.intel || 0) > G.time.day) h += `<div class="kv">🔍 <b>Intel</b>: ${Math.round(f.troops)} troops · quality ×${f.quality.toFixed(2)} · gold ${Math.round(f.stock.gold)}${f.war ? ` · next army in ~${Math.max(0, f.armyTimer)}d` : ''}</div>`;
    }
    h += `</div>`;
  }
  const gone = G.factions.filter(f => f.dead); if (gone.length) h += `<div class="dim">Fallen realms: ${gone.map(f => esc(f.name)).join(', ')}</div>`;
  const vs = (G.villages || []).filter(v => !v.dead);
  h += `<div class="sec">🏘️ Independent villages <small>— annex them peacefully once you are strong, or take them by force</small></div>`;
  h += vs.length ? vs.map(v => `<div class="fcard" style="border-left-color:${v.color}">${villageCard(v)}</div>`).join('') : '<div class="dim">No independent villages remain.</div>';
  return ['🌍 Diplomacy', h];
}
function villageCard(v) {
  const c = annexCost(v), ready = annexReady(v), P = armyPower(garrison()), D = estDefense(v, v.cap.x, v.cap.y);
  let h = `<div class="fh"><b>🏘️ ${esc(v.name)}</b> <small>${v.leader} · ${Math.floor(v.pop)} villagers · ${v.tiles} tiles · defenders ≈ ${D.toFixed(0)}</small> <button class="btn xs" data-act="flyto" data-arg="${v.cap.x},${v.cap.y}">📍</button></div><div class="btnrow">`;
  h += `<button class="btn sm" data-act="annex" data-arg="${v.id}" ${ready && canAfford(c) ? '' : 'disabled'} data-tip="${ready ? 'They will join you willingly.' : `They want a protector: your defense must reach ${Math.ceil(villageStrength(v) * 2.2)} (now ${playerStrength().toFixed(0)}).`}">🤝 Annex — ${costStr(c)}</button>`;
  h += `<button class="btn sm" data-act="vattack" data-arg="${v.id}" ${garrison().length ? '' : 'disabled'} data-tip="March your soldiers on the village. You fight a turn-based battle when they arrive.">⚔️ Attack <span class="${P > D * 1.25 ? 'pos' : P > D * 0.9 ? '' : 'neg'}">(${P.toFixed(0)} vs ~${D.toFixed(0)})</span></button>`;
  if (G.armies.some(a => a.owner === 0 && a.fid === v.id)) h += `<span class="dim">Your army is marching here.</span>`;
  return h + `</div>`;
}
function winTrade() {
  const s = UI.tradeState, f = fac(s.fid);
  const give = { [s.gr]: s.ga }, get = { [s.tr]: s.ta };
  const ev = evaluateTrade(f, give, get);
  const opts = (sel, key) => ['food', 'wood', 'stone', 'iron', 'tools', 'gold'].map(r => `<option value="${r}" ${sel === r ? 'selected' : ''}>${RES_INFO[r].icon} ${RES_INFO[r].name}</option>`).join('');
  let h = `<div class="kv">${f.leader} of <b>${f.name}</b> — has plenty of ${RES_INFO[f.surplus].icon} ${RES_INFO[f.surplus].name}, wants ${RES_INFO[f.need].icon} ${RES_INFO[f.need].name}.</div>`;
  h += `<div class="trade"><div><div class="sec">You give</div><select id="tr-gr">${opts(s.gr)}</select><input type="range" id="tr-ga" min="5" max="200" step="5" value="${s.ga}"><b>${s.ga}</b> <small>(have ${fmt(G.res[s.gr])})</small></div>
    <div class="arrow">⇄</div>
    <div><div class="sec">You get</div><select id="tr-tr">${opts(s.tr)}</select><input type="range" id="tr-ta" min="5" max="200" step="5" value="${s.ta}"><b>${s.ta}</b> <small>(they have ${fmt(f.stock[s.tr] || 0)})</small></div></div>`;
  const pct = clamp(ev.ratio * 50, 0, 100);
  h += `<div class="kv">Their interest: <div class="bar"><div style="width:${pct}%;background:${ev.ok ? '#66bb6a' : '#ff7043'}"></div></div> <i>${ev.why}</i></div>`;
  h += `<div class="btnrow"><button class="btn" data-act="dotrade" ${ev.ok && canAfford(give) ? '' : 'disabled'}>🤝 Propose trade</button><button class="btn" data-act="win" data-arg="diplo">← Back</button></div>`;
  return [`📦 Trade with ${f.name}`, h];
}
function winArmy() {
  const sol = soldiers(), gar = garrison();
  let h = `<div class="kv">Soldiers <b>${sol.length}</b> / ${barracksCap()} barracks capacity · At home ${gar.length} · Strength multiplier ×${armyMult().toFixed(1)}</div>`;
  h += `<div class="kv">Defense at capital: <b>${playerStrength().toFixed(0)}</b> <small>(soldiers, veterans, towers, walls, militia, nearby city levies and allies — for defending only)</small></div>`;
  h += fieldForceHtml();
  if (!countB('barracks')) h += `<div class="warn">Build a Barracks (Military tab) — kin are then recruited automatically.</div>`;
  h += `<div class="sec">Stance <small>— kin are recruited and discharged automatically</small></div><div class="btnrow">${stanceButtons()}</div><div class="dim">Target ${armyTarget()} soldiers · training costs ${costStr(trainCost())} each.</div>`;
  const wars = G.factions.filter(f => f.war);
  h += `<div class="sec">Wars</div>` + (wars.length ? wars.map(f => `<div class="fcard" style="border-left-color:${f.color}"><div><span class="banner" style="background:${f.color}"></span> <b>${f.name}</b> — their strength ${facStrength(f).toFixed(0)}, ${f.warDays} days, weariness ${Math.round(f.weariness)}</div><div class="btnrow">${attackButtons(f)}</div></div>`).join('') : '<div class="dim">At peace.</div>');
  if (wars.length && gar.length) {
    h += `<div class="sec">Send an army</div><div class="kv">Soldiers: <input type="range" id="armyn" min="1" max="${gar.length}" value="${clamp(UI.armyCount || gar.length, 1, gar.length)}"> <b id="armynv">${clamp(UI.armyCount || gar.length, 1, gar.length)}</b> power ≈ ${gar.sort((a, b) => soldierPower(b) - soldierPower(a)).slice(0, clamp(UI.armyCount || gar.length, 1, gar.length)).reduce((s, k) => s + soldierPower(k), extrasPower(rallySources())).toFixed(0)}${rallySources().length ? ' with rallied troops' : ''}</div>
      <button class="btn" data-act="armytool">🎯 Pick a target tile on the map instead</button><div class="dim">Capture a capital to make that realm your vassal. Soldiers sent away no longer defend home.</div>`;
  }
  const es = enemyArmies();
  h += `<div class="sec">⚠️ Enemy armies on the march <small>— catch them before they reach your land</small></div>`;
  h += es.length ? es.map(e => { const f = fac(e.owner), D = e.n * f.quality, P = armyPower(gar), eta = Math.max(0, Math.round(((e.path ? e.path.length - e.pi : 0) / 1.5) / 24 * 10) / 10);
    let r = `<div class="fcard" style="border-left-color:${f.color}"><div><b>${f.name}</b> — ${e.n} troops (power ≈ ${D.toFixed(0)}), arrives in ~${eta} days <button class="btn xs" data-act="flyarmy" data-arg="${e.id}">📍</button></div><div class="btnrow">`;
    r += `<button class="btn sm" data-act="intercept" data-arg="${e.id}" ${gar.length ? '' : 'disabled'} data-tip="Your soldiers ride out and fight them in the open field (+10% ambush bonus).">🏇 Intercept with ${gar.length} soldiers <span class="${P > D * 1.2 ? 'pos' : P > D * 0.9 ? '' : 'neg'}">(${P.toFixed(0)} vs ${D.toFixed(0)})</span></button>`;
    for (const c of cities()) { const b = G.buildings[c.bid]; if (dist(b.x, b.y, Math.round(e.x), Math.round(e.y)) <= 10 && c.levies) r += `<button class="btn sm" data-act="cityfight" data-arg="${c.bid}|${e.id}">🏰 ${esc(c.name)} levies (${levyPower(c).toFixed(0)})</button>`; }
    return r + `</div></div>`; }).join('') : '<div class="dim">None right now.</div>';
  const cs = cities();
  if (cs.length) h += `<div class="sec">🏰 City garrisons</div>` + cs.map(c => `<div class="row">${esc(c.name)} — ${c.levies}/${levyCap(c)} levies (power ${levyPower(c).toFixed(0)}) ${c.autoIntercept ? '· auto-intercepts' : ''} <button class="btn xs" data-act="levy" data-arg="${c.bid}" ${c.levies < levyCap(c) && canAfford(levyCost()) ? '' : 'disabled'}>+ Levy ${costStr(levyCost())}</button></div>`).join('');
  h += `<div class="sec">Armies in the field</div>` + (G.armies.some(a => !a.dead) ? G.armies.filter(a => !a.dead).map(a => `<div class="row link" data-act="flyarmy" data-arg="${a.id}">${a.owner === 0 ? '🚩 Your army' : `⚠️ ${fac(a.owner).name}`} — ${a.n} troops, ${{ attack: 'advancing', intercept: 'hunting an enemy army', battle: 'in battle', return: 'returning' }[a.mode] || a.mode}</div>`).join('') : '<div class="dim">None.</div>');
  return ['⚔️ Army', h];
}
function stanceButtons() { return Object.entries(ARMY_STANCES).map(([k, t]) => `<button class="btn sm ${G.policies.army === k ? 'on' : ''}" data-act="stance" data-arg="${k}" data-tip="${t}">${{ none: '🕊️ None', guard: '🛡️ Guard', full: '⚔️ Full' }[k]}</button>`).join(''); }
function attackButtons(f) {
  const ff = fieldForce(); if (!ff.n) return `<span class="dim">No soldiers at home and nobody to rally.</span>`;
  const P = ff.P;
  const bt = attackTarget(f, 'border');
  let h = '';
  if (bt) { const d = estDefense(f, bt.x, bt.y), w = winChance(P, d); h += `<button class="btn sm" data-act="qattack" data-arg="${f.id}|border" data-tip="Send your field army (${ff.n} troops) to their nearest border tile. Win to take the land, the buildings on it and some of their stores.">⚔️ Raid border <span class="${oddsClass(w)}">(${P.toFixed(0)} vs ~${d.toFixed(0)} · ${pctStr(w)} win)</span></button>`; }
  const dc = estDefense(f, f.cap.x, f.cap.y), wc = winChance(P, dc);
  h += `<button class="btn sm" data-act="qattack" data-arg="${f.id}|capital" data-tip="Take their capital to annex the whole realm or make it your vassal.">👑 Storm capital <span class="${oddsClass(wc)}">(${P.toFixed(0)} vs ~${dc.toFixed(0)} · ${pctStr(wc)} win)</span></button>`;
  return h;
}
function winMenu() {
  let h = `<div class="btnrow"><button class="btn" data-act="save">💾 Save</button><button class="btn" data-act="load">📂 Load last save</button><button class="btn" data-act="win" data-arg="help">❓ How to play</button><button class="btn danger" data-act="newgame">🆕 New game</button></div>`;
  h += `<div class="sec">Game speed</div><div class="kv">Length of one day at 1× speed:</div><div class="btnrow">` + [12, 24, 48, 90].map(s => `<button class="btn sm ${G.settings.dayLength === s ? 'on' : ''}" data-act="daylen" data-arg="${s}">${s} sec</button>`).join('') + `</div>`;
  h += `<div class="sec">Decisions</div><div class="kv">Which events should stop and ask you? Others are decided for you and noted in the Chronicle (🤖).</div><div class="btnrow">` +
    [['all', 'Ask me everything'], ['major', 'Only important ones'], ['none', 'Decide everything']].map(([k, t]) => `<button class="btn sm ${G.settings.decide === k ? 'on' : ''}" data-act="decide" data-arg="${k}">${t}</button>`).join('') + `</div>`;
  const ak = Object.values(G.settings.autoKeys || {});
  if (ak.length) h += `<div class="dim">Always auto-decided: ${ak.map(t => typeof t === 'string' ? t : '').join(', ')} <button class="btn xs" data-act="clearauto">Reset</button></div>`;
  h += `<div class="sec">Your border</div>` + borderColorHtml();
  h += `<div class="sec">People on the map <small>— fewer walkers runs faster in big towns</small></div><div class="btnrow">` + [['all', '🚶 Everyone'], ['some', '👥 One per ten people'], ['none', '🏠 Nobody']].map(([k, t]) => `<button class="btn sm ${(G.settings.crowd || 'some') === k ? 'on' : ''}" data-act="crowd" data-arg="${k}">${t}</button>`).join('') + `</div>`;
  h += `<div class="sec">Battles</div><div class="btnrow">` + [['play', '⚔️ Fight them turn by turn'], ['auto', '⏩ Auto-resolve']].map(([k, t]) => `<button class="btn sm ${G.settings.battles === k ? 'on' : ''}" data-act="battleset" data-arg="${k}">${t}</button>`).join('') + `</div>`;
  h += `<div class="kv"><label><input type="checkbox" id="pauseev" ${G.settings.pauseOnEvent ? 'checked' : ''}> Pause when a decision appears</label></div>`;
  h += `<div class="dim">The game autosaves every 2 days. Seed ${G.seed}.</div>`;
  return ['⚙️ Menu', h];
}
function winHelp() {
  return ['❓ How to play', `<div class="help">
  <p><b>Your kin</b> live real lives: they work, relax, sleep, make friends, fall in love and raise children. Keep them fed, housed, entertained and social. Happy kin work harder and attract newcomers; miserable kin leave.</p>
  <p><b>Seven ages</b> ⏳ — from the Ancient Age to the Information Age. Discover enough technologies of your current age, gather the materials and rebuild your Town Hall to advance: lodge → town hall → keep → castle → palace → capitol → grand capitol. Each age unlocks new buildings, new discoveries and one more upgrade level for every building.</p>
  <p><b>Research</b> 📜 — five schools of knowledge with about a hundred discoveries, grouped by age. Knowledge flows into your queue automatically.</p>
  <p><b>Government &amp; economy</b> 🏛️ — adopt Monarchy, Republic, Theocracy, Feudalism, Democracy, Autocracy, Technocracy and more, plus an economic system (Mercantilism, Guilds, Free Market, Planned, Welfare, Green). Each has strengths and weaknesses; reforms cause a few days of upheaval.</p>
  <p><b>Upgrades</b> ⬆️ — farms, mines, lumber camps and nearly everything else grow through up to five levels: more workers, more output, and they store more of what they make. Homes grow from huts to tower blocks.</p>
  <p><b>Power</b> ⚡ — from the Industrial Age, Power Plants burn coal (or wind and solar later) to run apartments, labs, hospitals, stadiums and data centers. Watch the ⚡ supply/demand in the top bar.</p>
  <p><b>Building</b> — placement matters: farms love meadows, lumber camps want forest, quarries need hills, mines want mountains or veins, fisheries and harbors water. Roads, railways and avenues speed walking and boost workplaces. ⛏️ Terraform reshapes land: clear or plant forest, enrich soil, raise hills or mountains, dig out hills for loot, prospect for veins (iron, gold, gems, coal), carve or dynamite mountains, dig, deepen, fill or reclaim water. Steam Power gives a 3×3 brush. 🧱 Blocks let you build anything.</p>
  <p><b>Lives</b> 💞 — every kin has skills that grow as they work, study, pray and play (Novice → Grandmaster; skilled workers produce up to +50%), a life dream to chase (a big family, mastering a craft, true love, fine living, devotion...), friends and rivals, romances that lead to weddings, and sometimes a pet. Their Story tab remembers their life. Personal moments ask for your judgement: weddings, gifted children, career dreams, feuds, crushes, homesick newcomers.</p>
  <p><b>Roads</b> 🛣️ — the Town Hall, Warehouses, Granaries, Markets and Harbors are hubs. A workplace touching a road that reaches a hub is linked and produces more (+12% path, +22% stone, +32% rail, +35% avenue); one far from any hub with no road loses output carrying goods by hand. Linked homes are happier. The road tool shows ✓ linked and ! cut-off buildings.</p>
  <p><b>Land</b> 🗺️ — every map is generated fresh (pick Continents, Pangaea, Riverlands, Highlands or Archipelago). Rivers can only be crossed at fords or by bridges, and mountain ranges only through their passes, so terrain decides where you can go. Your borders grow on their own around your capital, cities and colonies, following valleys and stopping at mountains and the sea. Claim single tiles, 3×3 or 5×5 blocks, or drag out any area to buy it in bulk (up to 35% cheaper per tile); rough land and land far from a settlement costs more.</p>
  <p><b>Conquest</b> 👑 — rival realms work their land with farms, lumber camps, quarries, mines, fisheries, granaries, warehouses and markets. Take a border district and whatever stands on it becomes yours, with some of their stores. Their garrison surrenders and joins your army as veterans; the people you can't house stay on as subjects. Take their capital and you choose: annex the whole realm (all its land, every building, its people, its towns as your cities and most of its stores) or leave it as a tribute-paying vassal that you can absorb peacefully later.</p>
  <p><b>The ages to come</b> 🌍 — after the Information Age come the Planetary, Fusion and Stellar Ages. Coal mines, factories and coal power plants (yours and your rivals') warm the planet: past +0.8°C farms suffer and storms, floods and heatwaves grow; past +1.5°C the seas swallow low coasts beside the ocean (Sea Walls protect yours). Forests, Carbon Capture, Climate Engineering Stations and a World Climate Accord bring it back down; restoring the climate after it passed +2°C is a Gaia Victory. From the Information Age, Missile Silos hold nuclear warheads: they deter attackers, but every warhead in the world moves the doomsday clock toward midnight, and at midnight the powers at war fire on each other. Great powers may start world wars between two blocs — join a side, sell arms, or broker peace. The Space Elevator wins a Stellar Victory.</p>
  <p><b>War odds</b> ⚔️ — only your field army marches: soldiers from your barracks, plus any veterans, city levies and vassal troops you rally (Army window). Walls, towers and militia defend but never march. The stronger side usually wins and the bigger the gap the surer it is: 2× their strength wins about 82% of the time, 3× about 92%, 6× about 98%.</p>
  <p><b>Planning</b> 🗺️ — with the ⬆️ tool, drag a box to upgrade everything in it, or upgrade a whole building type from the panel. With the ↔️ tool, drag a box to pick up a whole block (buildings, roads and power lines) and drop it elsewhere. In the Roads menu, "Link all" lays the shortest roads from every unlinked building to your network. From the Industrial Age, power only reaches buildings wired to a plant: power flows along ⚡ power lines and through buildings that touch, and every separate network is its own grid.</p>
  <p><b>Your cities</b> 🏰 — conquered and distant cities grow restless as they grow, especially far from the capital, without a road to it, under heavy taxes or after a war. Garrisons, temples, theatres, festivals and concessions calm them. Conquered cities also <b>resent the conquest</b> 😠: until you win them over with projects in their district — new buildings, upgrades, new jobs, a road to the capital, public works — unrest climbs fast, their workers slow down, and their own levies side with any rising. At 100 unrest a city rises up: crush the rebellion, let it rule itself as your vassal, or let it go. Rebels who break away must be beaten by taking back their hall.</p>
  <p><b>Expeditions</b> 🏕️ — send three pioneers to found a colony anywhere you can walk to (7+ tiles from your settlements). Scout sites for farmland, ore, river fords and mountain passes. Colonies are road hubs and grow their own borders; upgrade them to widen their reach.</p>
  <p><b>Priorities</b> ⭐ — click a resource in the top bar to prioritise it (up to 3).</p>
  <p><b>Rival realms</b> 🌍 — rivals advance through the ages too, their towns grow and modernise, they fight each other, split in civil wars and fall. New realms keep rising from villages and wandering peoples, so the world never runs out of challengers. Trade, gift, marry, spy, ally or conquer. Vassals may revolt if you grow weak.</p>
  <p><b>Disasters</b> change with the age: fires and floods early, storms and smog later, then blackouts, hurricanes, market crashes and cyberattacks. Wells, aqueducts, fire stations and hospitals help.</p>
  <p><b>War</b> — build Barracks and pick a stance; kin are recruited automatically. Attack from the Army or Diplomacy window, intercept enemy armies, raise city garrisons.</p>
  <p><b>Win</b> by launching the 🚀 Starship Ark (Science) or holding 45% of the land with your vassals (Domination) — or just keep playing.</p>
  <p><b>Controls</b> — drag to pan (or WASD/arrows), scroll to zoom. Right-click cancels a tool. Space pauses, 1-5 set speed. F expedition. B build, R roads, T terraform, C claim, M move, U upgrade, Q star, Z pause work, H home, G next city, I idle kin, E enemy army, P paint, X demolish.</p></div>`];
}

// ---------- Event modal ----------
UI.eventShowing = null;
function showNextEvent() {
  if (UI.eventShowing || !G.eventQueue.length) return;
  while (G.eventQueue.length) {
    const ev = G.eventQueue[0];
    const def = EVENTS[ev.key];
    const e = def ? def.make(ev.data) : null;
    if (!e) { G.eventQueue.shift(); continue; }
    if (shouldAutoDecide(ev.key, e)) { G.eventQueue.shift(); autoResolve(ev.key, e, ev.data); UI.lastInspect = ''; continue; }
    UI.eventShowing = e; UI.eventKey = ev.key; UI.eventData = ev.data; hideTip();
    let h = `<div class="evicon">${e.icon || '❗'}</div><h2>${e.title}</h2><p>${e.text}</p><div class="evchoices">`;
    e.choices.forEach((c, i) => { h += `<button class="btn evc" data-act="evchoice" data-arg="${i}" ${c.disabled ? 'disabled' : ''}>${c.label}${c.tip ? `<small>${c.tip}</small>` : ''}</button>`; });
    h += `</div>`;
    if (e.faction) h += `<div class="dim">Relation with ${e.faction.name}: ${relLabel(e.faction.relation)} (${Math.round(e.faction.relation)})</div>`;
    if (!ev.key.startsWith('victory') && ev.key !== 'expedition' && ev.key !== 'landDeal' && ev.key !== 'conquest') { const ac = e.choices[autoChoice(ev.key, e, ev.data)]; h += `<div class="evauto"><button class="btn xs" data-act="evauto" data-tip="From now on, events like this are decided for you (it would pick &quot;${esc(ac ? ac.label : '')}&quot; now). Change in Menu, Decisions.">🤖 Always decide these for me</button></div>`; }
    $('#event').innerHTML = h; $('#event').classList.remove('hidden'); $('#shade').classList.remove('hidden');
    if (e.tiles) { R.highlight = e.tiles; R.flyTo(e.tiles[0].x, e.tiles[0].y); }
    return;
  }
}
function chooseEvent(i) {
  const e = UI.eventShowing; if (!e) return;
  const c = e.choices[i]; if (!c || c.disabled) return;
  G.eventQueue.shift();
  UI.eventShowing = null;
  $('#event').classList.add('hidden'); $('#shade').classList.add('hidden');
  if (e.tiles) R.highlight = null;
  why('Events & decisions', c.fn);
  recountTiles(); R.territoryDirty = true;
  UI.lastInspect = '';
}

// ---------- Actions ----------
const ACT = {
  tool: a => { if (a === 'build') setTool('build', UI.tool.kind === 'build' ? UI.tool.type : null); else if (a === 'road') setTool('road', 'path'); else if (a === 'paint') { UI.roofPick = UI.roofPick || ROOF_COLORS[0]; setTool('paint'); } else setTool(a); },
  cat: a => { UI.cat = a; renderBuildMenu(); },
  pickb: a => { setTool('build', a); },
  pickroad: a => { setTool('road', a); },
  kintab: a => { UI.kinTab = a; UI.lastInspect = ''; },
  clearpref: a => { const k = kinById(+a); if (k) k.pref = null; UI.lastInspect = ''; },
  roof: a => { UI.roofPick = a; renderBuildMenu(); },
  speed: a => { G.speed = +a; },
  win: a => openWin(a),
  closewin: () => closeWin(),
  closeinspect: () => { R.selected = null; renderInspector(); },
  selk: a => { const k = kinById(+a); if (k) { inspect({ kind: 'k', id: k.id }); if (!k.away) R.flyTo(k.x, k.y); } },
  selb: a => { const b = G.buildings[+a]; if (b) { inspect({ kind: 'b', id: b.id }); R.flyTo(b.x, b.y); } },
  follow: a => { const k = kinById(+a); if (k && !k.away) R.flyTo(k.x, k.y); },
  upgrade: a => {
    const b = G.buildings[+a]; if (b.type === 'townhall') return advanceEra() ? undefined : false;
    const c = upgradeCost(b); if (!c || !canAfford(c) || b.level >= maxLevelFor(b.type)) return false;
    pay(c); b.level++; _capCache = {}; refreshMults();
    if (b.type === 'townhall') { addLog(`🏛️ The Town Hall is now level ${b.level}! New buildings unlocked.`, 'good'); toast(`Town Hall level ${b.level}!`); if (UI.tool.kind === 'build') renderBuildMenu(); }
    else addLog(`⬆️ Upgraded a ${B[b.type].name}.`, 'info');
    if (B[b.type].appeal) recomputeAppeal();
    autoAssignJobs(); assignHousing(); UI.lastInspect = '';
  },
  pause: a => { const b = G.buildings[+a]; b.paused = !b.paused; autoAssignJobs(); UI.lastInspect = ''; },
  prio: a => { const b = G.buildings[+a]; b.priority = b.priority ? 0 : 1; if (b.priority) { // pull workers from non-priority buildings
      while (b.workers.length < workerSlots(b)) { const cand = G.kin.filter(k => canWork(k) && !k.away && (!k.job || !G.buildings[k.job].priority)).sort((x, y) => (!!x.job) - (!!y.job))[0]; if (!cand) break; setJob(cand, b); } }
    autoAssignJobs(); UI.lastInspect = ''; },
  setroof: a => { const [id, c] = a.split('|'); G.buildings[+id].roof = c; UI.lastInspect = ''; },
  demolish: a => { const b = G.buildings[+a]; if (b && confirm(`Demolish this ${B[b.type].name}?`)) demolish(b); renderInspector(); },
  train: a => { trainSoldier(G.buildings[+a]); UI.lastInspect = ''; },
  disband: a => { const k = kinById(+a); if (k) disbandSoldier(k); UI.lastInspect = ''; },
  claim: a => { const [x, y] = a.split(',').map(Number); claimTile(x, y); UI.lastInspect = ''; },
  buyland: a => {
    const [x, y, n] = a.split(',').map(Number); const f = fac(G.tiles.owner[idx(x, y)]);
    const tiles = n > 1 ? areaTiles(f, x, y) : [{ x, y }];
    const p = n > 1 ? Math.round(tiles.reduce((s, t) => s + landPrice(f, t.x, t.y), 0) * 0.9) : landPrice(f, x, y);
    buyLand(f, tiles, p); UI.lastInspect = '';
  },
  attackhere: a => { const [x, y] = a.split(',').map(Number); sendArmy(x, y, garrison().length); UI.lastInspect = ''; },
  logtoggle: () => { UI.logOpen = !UI.logOpen; renderLog(); },
  kinsort: a => { UI.kinSort = a; renderWin(true); },
  rename: () => { const v = $('#realmname').value.trim(); if (v) { G.realm.name = v.slice(0, 24); } renderWin(true); },
  banner: a => { G.realm.color = a; R.territoryDirty = true; renderWin(true); updateTop(); },
  boldborder: () => { G.settings.boldBorder = G.settings.boldBorder === false; R.territoryDirty = true; renderWin(true); },
  absorb: a => { const f = fac(+a); if (f) absorbVassal(f); renderWin(true); },
  tax: a => { G.policies.tax = a; renderWin(true); },
  rations: a => { G.policies.rations = a; renderWin(true); },
  festival: () => { const fc = { food: Math.ceil(G.kin.length * 2), gold: Math.ceil(G.kin.length * 1.5) }; if (!canAfford(fc)) return; pay(fc); G.festival = 3; G.festivalCd = 20; addLog('🎉 A festival begins! Music fills the streets.', 'good'); renderWin(true); },
  mkt: a => {
    const [m, r, n] = a.split('|'); const amt = +n; const vol = 40 * countB('market');
    if (G.marketVol + amt > vol) return toast('Market volume exhausted for today');
    if (m === 'sell') { if (G.res[r] < amt) return toast('Not enough'); G.res[r] -= amt; gain('gold', MARKET_PRICE[r] * amt); }
    else { const c = MARKET_PRICE[r] * amt * 2; if (G.res.gold < c) return toast('Not enough gold'); G.res.gold -= c; gain(r, amt); }
    G.marketVol += amt; renderWin(true);
  },
  research: a => { queueTech(a); renderWin(true); },
  home: () => R.flyTo(G.cap.x, G.cap.y),
  nextcity: () => { const cs = cities(); if (!cs.length) return toast('No vassal cities yet — build a 🏰 Vassal Hall (Build → Civic) or conquer a village.'); UI.cityI = ((UI.cityI || 0) + 1) % cs.length; const b = G.buildings[cs[UI.cityI].bid]; R.flyTo(b.x, b.y); inspect({ kind: 'b', id: b.id }); },
  nextidle: () => { const ks = G.kin.filter(k => canWork(k) && !k.job && !k.away); if (!ks.length) return toast('Everyone able to work has a job.'); UI.idleI = ((UI.idleI || 0) + 1) % ks.length; const k = ks[UI.idleI]; R.flyTo(Math.round(k.x), Math.round(k.y)); inspect({ kind: 'k', id: k.id }); },
  threat: () => { const es = enemyArmies(); if (!es.length) return toast('No enemy armies are marching.'); es.sort((a, b) => dist(a.x, a.y, G.cap.x, G.cap.y) - dist(b.x, b.y, G.cap.x, G.cap.y)); R.flyTo(Math.round(es[0].x), Math.round(es[0].y)); },
  intercept: a => { if (interceptArmy(+a)) closeWin(); UI.lastInspect = ''; },
  levy: a => { const c = (G.cities || []).find(c => c.bid === +a); if (c && raiseLevy(c)) toast(`🛡️ ${c.name} raised a levy (${c.levies}/${levyCap(c)})`); UI.lastInspect = ''; renderWin(true); },
  cityauto: a => { const c = (G.cities || []).find(c => c.bid === +a); if (c) c.autoIntercept = !c.autoIntercept; UI.lastInspect = ''; },
  cityfight: a => { const [bid, eid] = a.split('|').map(Number); const c = G.cities.find(c => c.bid === bid), e = G.armies.find(o => o.id === eid); if (c && e) leviesFight(c, e); UI.lastInspect = ''; renderWin(true); },
  spy: a => { const [id, k] = a.split('|'); sendSpy(+id, k); renderWin(true); },
  wedout: a => { const f = fac(+a); if (f && confirm(`Send your happiest unmarried adult to marry into ${f.name}? They leave your realm for good.`)) marryOut(f); renderWin(true); },
  wedin: a => { marryIn(fac(+a)); renderWin(true); },
  callarms: a => { callToArms(fac(+a)); renderWin(true); },
  flyfac: a => { const f = fac(+a); R.flyTo(f.cap.x, f.cap.y); },
  trade: a => { const f = fac(+a); UI.tradeState = { fid: f.id, gr: f.need === 'gold' ? 'gold' : f.need, ga: 20, tr: f.surplus, ta: 20 }; openWin('trade'); },
  dotrade: () => { const s = UI.tradeState; if (doTrade(fac(s.fid), { [s.gr]: s.ga }, { [s.tr]: s.ta })) toast('🤝 Trade accepted!'); renderWin(true); },
  gift: a => { const [id, g] = a.split('|'); giftGold(fac(+id), +g); renderWin(true); },
  pact: a => { const [id, t] = a.split('|'); proposePact(fac(+id), t); renderWin(true); },
  tribute: a => { demandTribute(fac(+a)); renderWin(true); },
  declare: a => { const f = fac(+a); if (confirm(`Declare war on ${f.name}? Their armies will attack your borders.`)) { declareWar(f); renderWin(true); } },
  peace: a => { const f = fac(+a); endWar(f, `Peace agreed with ${f.name}.`); renderWin(true); },
  buypeace: a => { const f = fac(+a); const t = peaceTerms(f); if (G.res.gold < t.gold) return; G.res.gold -= t.gold; endWar(f, `You paid ${t.gold} gold for peace with ${f.name}.`); renderWin(true); },
  landview: a => { const f = fac(+a); const tiles = borderTilesWith(f.id, 0).filter(t => !landSaleBlock(f, t.x, t.y)); R.highlight = tiles; if (tiles.length) { R.flyTo(tiles[0].x, tiles[0].y); toast(`${tiles.length} tiles available — click one to buy`); closeWin(); R.keepHighlight = true; } else toast(`${f.name} won't sell any land right now.`); },
  armyto: a => { openWin('army'); },
  armytool: () => { UI.armyCount = +($('#armyn') ? $('#armyn').value : garrison().length); closeWin(); setTool('army'); toast('Click an enemy tile to attack (right-click to cancel)'); },
  flyarmy: a => { const ar = G.armies.find(x => x.id === +a); if (ar) R.flyTo(ar.x, ar.y); },
  save: () => saveGame(false),
  load: () => { if (loadGame()) { R.terrainDirty = R.territoryDirty = true; closeWin(); toast('Loaded'); } else toast('No save found'); },
  newgame: () => { if (confirm('Start a new game? Unsaved progress will be lost.')) { closeWin(); showStart(); } },
  daylen: a => { G.settings.dayLength = +a; renderWin(true); },
  evchoice: a => chooseEvent(+a),
  pickterra: a => setTool('terra', a),
  annex: a => { if (annexVillage(fac(+a))) renderWin(true); UI.lastInspect = ''; },
  vattack: a => { if (attackVillage(fac(+a))) closeWin(); UI.lastInspect = ''; },
  flyto: a => { const [x, y] = a.split(',').map(Number); R.flyTo(x, y); },
  btactic: a => battleRound(a),
  bauto: () => autoBattle(),
  bretreat: () => retreatBattle(),
  bclose: () => closeBattle(),
  balways: () => { G.settings.battles = 'auto'; autoBattle(); toast('🤖 Future battles will be resolved automatically (Menu → Battles to change)'); },
  battleset: a => { G.settings.battles = a; renderWin(true); },
  advance: () => { if (advanceEra()) { UI.lastInspect = ''; renderWin(true); } },
  adopt: a => { const [kind, id] = a.split('|'); const g = (kind === 'gov' ? GOVS : ECONS)[id]; if (confirm(`Adopt ${g.name}?\n\n${g.desc}\n\nCosts ${Object.entries(reformCost()).map(([r, v]) => v + ' ' + RES_INFO[r].name).join(', ')} and brings 4 days of upheaval.`)) adoptReform(kind, id); renderWin(true); },
  resera: a => { UI.resEra = +a; renderWin(true); },
  placate: a => { const f = fac(+a); if (f) placateVassal(f); renderWin(true); },
  brush: () => { UI.brush3 = !UI.brush3; renderBuildMenu(); },
  claimsize: a => { UI.claimSize = +a; renderBuildMenu(); },
  crowd: a => { G.settings.crowd = a; for (const k of G.kin) { k.path = null; k.dest = null; } renderWin(true); },
  autoborders: () => { G.settings.autoBorders = G.settings.autoBorders === false; renderBuildMenu(); toast(G.settings.autoBorders ? '🗺️ Your borders will grow on their own' : 'Borders will only grow when you claim land'); },
  evauto: () => { const e = UI.eventShowing; if (!e) return; G.settings.autoKeys[UI.eventKey] = e.title.replace(/ — .*/, ''); chooseEvent(autoChoice(UI.eventKey, e, UI.eventData)); toast('🤖 Events like this will be decided for you'); },
  decide: a => { G.settings.decide = a; renderWin(true); },
  clearauto: () => { G.settings.autoKeys = {}; renderWin(true); },
  prires: a => { const moved = togglePriority(a); const on = G.priorities.includes(a); toast(on ? `⭐ ${RES_INFO[a].icon} ${RES_INFO[a].name} is priority #${G.priorities.indexOf(a) + 1}${moved ? ` — ${moved} worker${moved > 1 ? 's' : ''} reassigned` : ''}` : `${RES_INFO[a].icon} ${RES_INFO[a].name} is no longer a priority`); UI.lastGoals = ''; UI.lastInspect = ''; },
  movestart: a => { const b = G.buildings[+a]; if (!b) return; setTool('move', b.id); R.selected = { kind: 'b', id: b.id }; toast(`Click the new spot for the ${B[b.type].name} (right-click to cancel)`); },
  invite: a => { if (inviteRecruit(+a)) renderWin(true); },
  reroll: () => { if (G.res.influence < 8) return; G.res.influence -= 8; refreshRecruits(true); renderWin(true); },
  stance: a => { G.policies.army = a; const d = autoArmy(true); if (d > 0) toast(`🛡️ ${d} kin joined the army`); UI.lastInspect = ''; renderWin(true); },
  qattack: a => { const [id, m] = a.split('|'); if (quickAttack(+id, m)) closeWin(); UI.lastInspect = ''; },
};

function bindUI() {
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !t.dataset.act || t.disabled) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const f = ACT[t.dataset.act]; if (f) why(actWhy(t.dataset.act), f, t.dataset.arg, t);
  });
  document.addEventListener('change', e => {
    if (e.target.dataset.kinjob) { const k = kinById(+e.target.dataset.kinjob); const v = e.target.value; setJob(k, v ? G.buildings[+v] : null); UI.lastInspect = ''; e.target.blur(); }
    if (e.target.id === 'pauseev') G.settings.pauseOnEvent = e.target.checked;
    if (e.target.id === 'autores') { G.settings.autoResearch = e.target.checked; researchTick(); renderWin(true); }
    if (e.target.id === 'tr-gr') { UI.tradeState.gr = e.target.value; renderWin(true); }
    if (e.target.id === 'tr-tr') { UI.tradeState.tr = e.target.value; renderWin(true); }
    if (e.target.classList.contains('name')) { const k = kinById(+e.target.dataset.kin); if (k && e.target.value.trim()) k.name = e.target.value.trim().slice(0, 14); e.target.blur(); UI.lastInspect = ''; }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'tr-ga') { UI.tradeState.ga = +e.target.value; renderWin(true); }
    if (e.target.id === 'tr-ta') { UI.tradeState.ta = +e.target.value; renderWin(true); }
    if (e.target.id === 'armyn') { UI.armyCount = +e.target.value; $('#armynv').textContent = e.target.value; }
  });
  // tooltips
  const tip = $('#tip');
  document.addEventListener('mousemove', e => {
    if (e.isTrusted) { UI.tipX = e.clientX; UI.tipY = e.clientY; }
    const t = e.target.closest('[data-tip],[data-tipfn]');
    if (t) {
      let h = t.dataset.tip || '';
      const fn = t.dataset.tipfn;
      if (fn) {
        if (fn.startsWith('b:')) h = buildTip(fn.slice(2));
        else if (fn.startsWith('res:')) { const r = fn.slice(4); h = `<b>${RES_INFO[r].icon} ${RES_INFO[r].name}</b>: ${Math.floor(G.res[r])}${CAPPED.includes(r) ? ` / ${storageCap(r)}` : ''}<br>Per day (last 24h): ${fmt1(liveRate(r))}${r === 'gold' ? `<br><small>See Realm → Treasury for where it comes from and goes.</small>` : ''}${r === 'food' ? `<br>Eaten per day: ${dailyFoodUse().toFixed(1)} · stores last ~${Math.floor(foodDays())} days` : ''}<br><small>${(G.priorities || []).includes(r) ? 'Click to stop prioritising' : 'Click to prioritise: workers move to buildings that make it'}</small>`; }
        else if (fn === 'pop') h = `<b>👥 Kin</b>: ${G.kin.length} · free beds ${freeHousing()}<br>${subjects() ? `<b>Subjects</b>: ${subjects()} in your cities and countryside — eat ${subjectsFood().toFixed(0)} 🍞/day, pay ${(subjects() * 0.12).toFixed(0)} 🪙/day<br>` : ''}Average mood ${avgMood().toFixed(0)} ${moodFace(avgMood())}<br><small>Click to see your kin and recruit settlers</small>`;
        else if (fn === 'beds') { const hl = G.kin.filter(k => !k.home && !k.away).length; h = `<b>🛏️ Housing</b>: ${G.kin.length} kin / ${totalBeds()} beds<br>${hl ? `<span class="neg">${hl} homeless</span>` : `${freeHousing()} free beds`}<br><small>Newcomers only arrive if there are free beds.</small>`; }
      }
      if (h) { UI.tipEl = fn ? t : null; tip.innerHTML = h; tip.classList.remove('hidden'); placeTip(e); return; }
    }
    if (e.target === R.canvas && UI.mapTip) { tip.innerHTML = UI.mapTip; tip.classList.remove('hidden'); placeTip(e); return; }
    UI.tipEl = null; tip.classList.add('hidden');
  });
}
function placeTip(e) { const tip = $('#tip'); const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 16, y = e.clientY + 16; if (x + w > innerWidth - 8) x = e.clientX - w - 12; if (y + h > innerHeight - 8) y = e.clientY - h - 12; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }

// ---------- Map input ----------
function bindMap() {
  const cv = R.canvas;
  let down = null, dragging = false, painting = false, lastPaint = -1;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) { setTool('select'); R.keepHighlight = false; R.highlight = null; return; }
    down = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y }; dragging = false;
    if (e.button === 0 && UI.tool.kind === 'claim' && UI.claimSize === 0) { const t = screenToTile(e.clientX, e.clientY); UI.claimRect = { x0: t.x, y0: t.y, x1: t.x, y1: t.y }; }
    else if (e.button === 0 && (UI.tool.kind === 'road' || UI.tool.kind === 'claim' || UI.tool.kind === 'terra')) { painting = true; lastPaint = -1; applyAt(e, true); }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    const t = screenToTile(e.clientX, e.clientY);
    R.hover = t; UI.mapTip = mapTip(t);
    if (!down) return;
    if (UI.claimRect) { UI.claimRect.x1 = t.x; UI.claimRect.y1 = t.y; const ai = areaInfo(UI.claimRect); UI.mapTip = ai.ok ? `🚩 ${ai.tiles.length} tiles · ${ai.cost} 👑${ai.disc ? ` <small>(−${Math.round(ai.disc * 100)}% bulk)</small>` : ''}` : '<small>The area must touch your land</small>'; return; }
    if (painting) { const i = inB(t.x, t.y) ? idx(t.x, t.y) : -1; if (i !== lastPaint) { lastPaint = i; applyAt(e, true); } return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 5) dragging = true;
    if (dragging) { R.cam.x = down.cx - dx / R.cam.z; R.cam.y = down.cy - dy / R.cam.z; R.camTarget = null; }
  });
  cv.addEventListener('pointerup', e => {
    if (UI.claimRect) { const r = UI.claimRect; UI.claimRect = null; down = null; painting = false; areaDeal(r); return; }
    if (down && !dragging && !painting && e.button === 0) applyAt(e, false);
    down = null; painting = false;
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    R.cam.z = clamp(R.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 3.5);
    const after = screenToWorld(e.clientX, e.clientY);
    R.cam.x += before.x - after.x; R.cam.y += before.y - after.y;
  }, { passive: false });
  const keys = {};
  window.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    keys[e.key.toLowerCase()] = true;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); G.speed = G.speed ? 0 : (UI.lastSpeed || 1); if (G.speed) UI.lastSpeed = G.speed; }
    if ('12345'.includes(k) && k.length === 1) { G.speed = [1, 2, 4, 8, 0][+k - 1]; if (G.speed) UI.lastSpeed = G.speed; }
    if (k === 'escape') { if (UI.win) closeWin(); else if (UI.tool.kind !== 'select') setTool('select'); else { R.selected = null; renderInspector(); } }
    if (k === 'b') ACT.tool('build'); if (k === 'r') ACT.tool('road'); if (k === 'c') ACT.tool('claim'); if (k === 'f') ACT.tool('colony'); if (k === 'p') ACT.tool('paint'); if (k === 'x') ACT.tool('demolish'); if (k === 'm') ACT.tool('move'); if (k === 't') ACT.tool('terra'); if (k === 'u') ACT.tool('upgrade'); if (k === 'q') ACT.tool('star'); if (k === 'z') ACT.tool('pausework');
    if (k === 'h') ACT.home(); if (k === 'g') ACT.nextcity(); if (k === 'i') ACT.nextidle(); if (k === 'e') ACT.threat();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  UI.keys = keys;
}
function panKeys(dt) {
  const k = UI.keys || {}, s = 500 * dt / R.cam.z;
  if (k['w'] || k['arrowup']) R.cam.y -= s; if (k['s'] || k['arrowdown']) R.cam.y += s;
  if (k['a'] || k['arrowleft']) R.cam.x -= s; if (k['d'] || k['arrowright']) R.cam.x += s;
  R.cam.x = clamp(R.cam.x, 0, MAP_W * TILE); R.cam.y = clamp(R.cam.y, 0, MAP_H * TILE);
}
function mapTip(t) {
  if (!inB(t.x, t.y)) return '';
  const tool = UI.tool;
  if (tool.kind === 'build' && tool.type) {
    const si = siteInfo(tool.type, t.x, t.y), d = B[tool.type];
    let h = `<b>${d.icon} ${d.name}</b> ${costStr(d.cost || {})}<br>`;
    if (!si.ok) return h + `<span class="neg">✗ ${si.reason}</span>`;
    if (!canAfford(d.cost || {})) h += `<span class="neg">Not enough resources</span><br>`;
    if (d.prod) h += `Site bonus ×${si.mult.toFixed(2)}<br>`;
    if (si.notes.length) h += `<small>${si.notes.join(' · ')}</small>`;
    if (d.housing || d.decor) h += `<small>Beauty here: ${appealAt(t.x, t.y).toFixed(0)}</small>`;
    return h;
  }
  if (tool.kind === 'terra' && tool.type) {
    const tf = TERRAFORM[tool.type], info = terraformInfo(tool.type, t.x, t.y);
    if (!info.ok) return `<span class="neg">✗ ${info.reason}</span>`;
    if (tool.type === 'prospect') return `🔍 Prospect these hills: ${costStr(terraCost('prospect'))}<br><small>35% chance of a vein</small>`;
    return `${tf.icon} ${TERRAIN[terr(t.x, t.y)].name} → <b>${TERRAIN[info.to].name}</b><br>${costStr(terraCost(tool.type))}${tf.gain ? ` · <span class="pos">+${costStr(tf.gain)}</span>` : ''}${canAfford(terraCost(tool.type)) ? '' : '<br><span class="neg">Not enough resources</span>'}`;
  }
  if (tool.kind === 'terra') return '<small>Pick a terraform action in the panel below</small>';
  if (tool.kind === 'move') {
    if (!tool.type) { const b = bAt(t.x, t.y); return b ? `↔️ Pick up ${B[b.type].icon} ${B[b.type].name}` : '<small>Click a building to move it</small>'; }
    const b = G.buildings[tool.type]; if (!b) return '';
    const si = siteInfo(b.type, t.x, t.y, { moving: true });
    if (!si.ok) return `<span class="neg">✗ ${si.reason}</span>`;
    return `↔️ Move ${B[b.type].icon} ${B[b.type].name} here${B[b.type].prod ? `<br>Site bonus here ×${si.mult.toFixed(2)}` : ''}${si.notes.length ? `<br><small>${si.notes.join(' · ')}</small>` : ''}`;
  }
  if (tool.kind === 'road' && tool.type === 'bridge') { const tt = G.tiles.terrain[idx(t.x, t.y)]; return tt === T.WATER || tt === T.DEEP ? (G.tiles.owner[idx(t.x, t.y)] === 0 ? `🌉 Bridge ${costStr(roadCost('bridge'))}` : '<span class="neg">Claim this water tile first</span>') : '<small>Bridges go over water</small>'; }
  if (tool.kind === 'upgrade') { const b = bAt(t.x, t.y); if (!b) return '<small>Click a building to upgrade it</small>'; const d = B[b.type]; if (b.type === 'townhall') { const bl = advanceBlock(); return bl ? `<span class="neg">${bl}</span>` : `⏳ Advance to the ${ERAS[b.level + 1].name}: ${costStr(upgradeCost(b))}`; } const c = upgradeCost(b); if (!c || !d.maxLevel || b.level >= d.maxLevel) return '<small>Fully upgraded</small>'; if (b.level >= maxLevelFor(b.type)) return `<span class="neg">Next level needs the ${ERAS[b.level + 1].name}</span>`; return `⬆️ ${d.levelNames ? d.levelNames[b.level - 1] + ' → ' + d.levelNames[b.level] : d.name + ' → Lv ' + (b.level + 1)}: ${costStr(c)}${canAfford(c) ? '' : '<br><span class="neg">Not enough resources</span>'}`; }
  if (tool.kind === 'star' || tool.kind === 'pausework') { const b = bAt(t.x, t.y); return b && B[b.type].workers ? `${B[b.type].icon} ${B[b.type].name} · ${b.workers.length}/${workerSlots(b)} workers${b.priority ? ' · ★' : ''}${b.paused ? ' · paused' : ''}` : '<small>Click a workplace</small>'; }
  if (tool.kind === 'claim' || tool.kind === 'colony') return expandHover(t);
  if (tool.kind === 'army') { const o = G.tiles.owner[idx(t.x, t.y)]; const f = o > 0 ? fac(o) : null; return f && f.war ? `⚔️ Attack ${f.name} here with ${UI.armyCount} soldiers` : '<small>Pick a tile of an enemy you are at war with</small>'; }
  const b = bAt(t.x, t.y);
  if (tool.kind === 'select') {
    if (b) return `${B[b.type].icon} ${b.type === 'townhall' ? ERAS[b.level].hall : B[b.type].levelNames ? B[b.type].levelNames[b.level - 1] : B[b.type].name}${b.ruined ? ' 🚧' : ''}`;
    const o = G.tiles.owner[idx(t.x, t.y)];
    if (o > 0 && fac(o)) { const f = fac(o); return `<span class="banner" style="background:${f.color}"></span> ${f.name}${f.minor ? '' : ` · ${ERAS[f.era || 1].icon} ${ERAS[f.era || 1].name}`} · ${TERRAIN[terr(t.x, t.y)].name}`; }
    return '';
  }
  return '';
}
function kinAt(wx, wy) {
  let best = null, bd = 10;
  for (const k of G.kin) { if (k.away || k.state === 'sleep' || k.state === 'home') continue; let ox = 0, oy = 0; if (k.state !== 'walking') { ox = (hashf(k.id, 1, 7) - 0.5) * 18; oy = (hashf(k.id, 2, 7) - 0.5) * 8; } const d = Math.hypot(k.x * TILE + 16 + ox - wx, k.y * TILE + 16 + oy - wy); if (d < bd) { bd = d; best = k; } }
  return best;
}
let lastBlock = '';
function applyAt(e, drag) {
  const t = screenToTile(e.clientX, e.clientY); if (!inB(t.x, t.y)) return;
  const tool = UI.tool, i = idx(t.x, t.y);
  switch (tool.kind) {
    case 'select': {
      const w = screenToWorld(e.clientX, e.clientY);
      const k = kinAt(w.x, w.y);
      if (k) return inspect({ kind: 'k', id: k.id });
      const ar = G.armies.find(a => Math.hypot(a.x - t.x, a.y - t.y) < 1); if (ar) { toast(`${ar.owner === 0 ? 'Your army' : fac(ar.owner).name + ' army'}: ${ar.n} troops`); }
      const b = bAt(t.x, t.y);
      if (b) return inspect({ kind: 'b', id: b.id });
      if (R.keepHighlight && R.highlight && !R.highlight.some(h => h.x === t.x && h.y === t.y)) { R.highlight = null; R.keepHighlight = false; }
      return inspect({ kind: 't', x: t.x, y: t.y });
    }
    case 'build': {
      if (!tool.type) return;
      const r = placeBuilding(tool.type, t.x, t.y);
      if (!r.ok) toast(r.reason);
      else { if (UI.roofPick && !B[tool.type].decor) r.b.roof = UI.roofPick; addLog(`Built a ${B[tool.type].name}.`, 'info'); if (!e.shiftKey && B[tool.type].unique) setTool('select'); renderBuildMenu(); }
      return;
    }
    case 'road': {
      if (tool.type === 'erase') { if (G.tiles.road[i]) { G.tiles.road[i] = 0; pathsDirty(); } return; }
      const rd = ROADS[tool.type];
      if (G.tiles.owner[i] !== 0) { if (!drag) toast('Not your territory — claim the tile first'); return; }
      const wet = !TERRAIN[G.tiles.terrain[i]].pass;
      if (rd.water && !wet) { if (!drag) toast('Bridges go over water'); return; }
      if (!rd.water && wet) { if (!drag) toast('Use a Bridge to cross water'); return; }
      if (G.tiles.bld[i]) return;
      if (G.tiles.road[i] >= rd.level) return;
      const rc = roadCost(tool.type);
      if (!canAfford(rc)) { if (!drag) toast(`Needs ${costStr(rc)}`); return; }
      pay(rc); G.tiles.road[i] = rd.level; pathsDirty();
      if (G.tiles.terrain[i] === T.FOREST) { G.tiles.terrain[i] = T.GRASS; gain('wood', 4); R.terrainDirty = true; }
      return;
    }
    case 'claim': if ((UI.claimSize || 1) > 1) { if (!drag || lastBlock !== t.x + ',' + t.y) { lastBlock = t.x + ',' + t.y; claimBlock(t.x, t.y, UI.claimSize); } } else if (canClaim(t.x, t.y)) claimTile(t.x, t.y); renderBuildMenu(); return;
    case 'colony': if (drag) return; { const si = siteScout(t.x, t.y); if (!si.ok) return toast(si.reason); queueEvent('expedition', { x: t.x, y: t.y }); showNextEvent(); } return;
    case 'terra': if (tool.type) { let any = false; if (UI.brush3 && fx('brush')) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(t.x + dx, t.y + dy) && terraform(tool.type, t.x + dx, t.y + dy, drag || dx || dy)) any = true; } else any = terraform(tool.type, t.x, t.y, drag); if (any) renderBuildMenu(); } return;
    case 'move': {
      if (!tool.type) { const b = bAt(t.x, t.y); if (!b) return; if (b.type === 'townhall' || b.type === 'outpost') return toast(`The ${B[b.type].name} cannot be moved`); setTool('move', b.id); R.selected = { kind: 'b', id: b.id }; renderInspector(); return; }
      const b = G.buildings[tool.type]; if (!b) return setTool('move');
      const r = moveBuilding(b, t.x, t.y);
      if (!r.ok) return toast(r.reason);
      addLog(`↔️ Moved the ${B[b.type].name}.`, 'info'); UI.lastInspect = '';
      if (e.shiftKey) setTool('move'); else setTool('select');
      return;
    }
    case 'paint': { const b = bAt(t.x, t.y); if (b && UI.roofPick) b.roof = UI.roofPick; return; }
    case 'upgrade': { const b = bAt(t.x, t.y); if (!b) return; const r = tryUpgrade(b); if (r) toast(r); UI.lastInspect = ''; return; }
    case 'star': { const b = bAt(t.x, t.y); if (!b || !B[b.type].workers || b.type === 'barracks') return toast('Click a workplace'); b.priority = !b.priority; autoAssignJobs(); rebalanceJobs(); floatText(b.x, b.y, b.priority ? '★ Staff first' : '☆ Normal', '#ffd54f'); UI.lastInspect = ''; return; }
    case 'pausework': { const b = bAt(t.x, t.y); if (!b || !B[b.type].workers || b.type === 'barracks') return toast('Click a workplace'); b.paused = !b.paused; autoAssignJobs(); rebalanceJobs(); floatText(b.x, b.y, b.paused ? '⏸ Paused' : '▶ Working', '#fff'); UI.lastInspect = ''; return; }
    case 'demolish': { const b = bAt(t.x, t.y); if (b && b.type !== 'townhall') demolish(b); else if (G.tiles.road[i] && G.tiles.owner[i] === 0) { G.tiles.road[i] = 0; pathsDirty(); } return; }
    case 'army': {
      const o = G.tiles.owner[i]; const f = o > 0 ? fac(o) : null;
      if (!f || !f.war) return toast('Pick a tile of a realm you are at war with');
      if (sendArmy(t.x, t.y, UI.armyCount || garrison().length)) setTool('select');
      return;
    }
  }
}

// ---------- Start screen ----------
function showStart() {
  const has = !!localStorage.getItem('hearthlands_save');
  const el = $('#start');
  el.innerHTML = `<div class="startbox"><h1>🏡 Hearthlands</h1><p class="sub">Raise a village of living, breathing kin and lead them through seven ages — from thatched huts to a glass-towered capitol — while rival empires rise and fall around you.</p>
    ${has ? `<button class="btn big" id="st-cont">▶ Continue saved game</button><div class="or">— or start anew —</div>` : ''}
    <label>Realm name <input id="st-name" value="Hearthvale" maxlength="24"></label>
    <label>Banner <span id="st-col">${PLAYER_COLORS.map((c, i) => `<span class="sw inline ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}</span></label>
    <label>Starting rivals <select id="st-f"><option value="3">3</option><option value="4">4</option><option value="5" selected>5</option></select></label>
    <label>Difficulty <select id="st-d"><option value="0.7">Gentle</option><option value="1" selected>Normal</option><option value="1.35">Harsh</option></select></label>
    <label>Day length <select id="st-dl"><option value="12">12 s (fast)</option><option value="24" selected>24 s</option><option value="48">48 s</option><option value="90">90 s (relaxed)</option></select></label>
    <label>Battles <select id="st-b"><option value="play" selected>Turn-based (you pick tactics)</option><option value="auto">Automatic</option></select></label>
    <label>Map <select id="st-map">${Object.entries(MAP_TYPES).map(([id, m]) => `<option value="${id}" ${id === 'continents' ? 'selected' : ''} title="${esc(m.desc)}">${m.name}</option>`).join('')}<option value="random">🎲 Surprise me</option></select></label>
    <label>Map seed <input id="st-seed" placeholder="random"></label>
    <button class="btn big" id="st-go">🌱 Found your village</button></div>`;
  el.classList.remove('hidden');
  let col = PLAYER_COLORS[0];
  el.querySelectorAll('#st-col .sw').forEach(s => s.onclick = () => { col = s.dataset.c; el.querySelectorAll('#st-col .sw').forEach(o => o.classList.toggle('on', o === s)); });
  if (has) $('#st-cont').onclick = () => { if (loadGame()) startPlaying(false); };
  $('#st-go').onclick = () => {
    newGame({ name: $('#st-name').value.trim() || 'Hearthvale', color: col, factions: +$('#st-f').value, difficulty: +$('#st-d').value, dayLength: +$('#st-dl').value, seed: +$('#st-seed').value || 0, mapType: $('#st-map').value === 'random' ? pick(Object.keys(MAP_TYPES)) : $('#st-map').value });
    G.settings.battles = $('#st-b').value;
    startPlaying(true);
  };
}
function startPlaying(fresh) {
  $('#start').classList.add('hidden');
  R.terrainDirty = R.territoryDirty = true; R.selected = null; R.floats = []; R.highlight = null; UI.lastInspect = ''; UI.eventShowing = null;
  $('#event').classList.add('hidden'); $('#shade').classList.add('hidden');
  centerCam(G.cap.x, G.cap.y + 1); R.cam.z = 1.6;
  UI.logDirty = true; setTool('select');
  if (fresh) openWin('help');
  window.GAME_RUNNING = true;
}

// map clicks that build, upgrade or lay roads are booked as construction
{ const _applyAt0 = applyAt; applyAt = (...a) => why('Construction', _applyAt0, ...a); }
