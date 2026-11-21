// Iron Banners — menus, scenario flow, armory
'use strict';

const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
}
function modal(html, wide) {
  $('mBox').innerHTML = html;
  $('mBox').style.width = wide ? 'min(1100px, 96vw)' : '';
  $('modal').classList.add('show');
}
function closeModal() { $('modal').classList.remove('show'); }
function confirmBox(title, text, yes) {
  modal(`<h2>${title}</h2><p>${text}</p><div class="acts"><button id="cbNo">Cancel</button><button class="primary" id="cbYes">Confirm</button></div>`);
  $('cbNo').onclick = closeModal; $('cbYes').onclick = () => { closeModal(); yes(); };
}
function toast(t) { const el = $('cToast'); if (!el) return; el.textContent = t; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2500); }

// ---------- persistence of medals and settings
function medals() { try { return JSON.parse(localStorage.getItem('ib_medals') || '{}'); } catch (e) { return {}; } }
function setMedal(id, side, kind) { const m = medals(); m[id] = m[id] || {}; const rank = { bronze: 1, silver: 2, gold: 3 }; if (!m[id][side] || rank[kind] > rank[m[id][side]]) m[id][side] = kind; try { localStorage.setItem('ib_medals', JSON.stringify(m)); } catch (e) { /* ignore */ } }
try { const sp = localStorage.getItem('ib_speed'); if (sp) SETTINGS.speed = +sp; } catch (e) { /* ignore */ }

function updateTitle() {
  $('sSpeed').value = String(SETTINGS.speed);
  const has = Camp.hasSave();
  $('mContinue').disabled = !has;
  if (has) { try { const s = JSON.parse(localStorage.getItem('ironbanners_campaign_v1')); const N = s.G.nations[0]; $('mContSub').textContent = `${N.name}, turn ${s.G.turn}, ${ERAS[N.era].name} era.`; } catch (e) { $('mContSub').textContent = 'Saved campaign.'; } }
  else $('mContSub').textContent = 'No saved campaign.';
}

$('sSpeed').onchange = e => { SETTINGS.speed = +e.target.value; try { localStorage.setItem('ib_speed', e.target.value); } catch (er) { /* ignore */ } };
function pickConqueror() {
  const cards = CONQUESTS.map(c => `<button data-cq="${c.id}" style="text-align:left;border-left:6px solid ${c.color}"><b>${c.name}</b> <span class="muted">— ${c.subtitle}</span><div class="tip">${c.nodes.filter(n => n.battle && !n.alt).length} battles and sieges · against ${c.enemyName}</div></button>`).join('');
  modal(`<h2>Choose a Conqueror</h2><div class="acts" style="flex-direction:column;align-items:stretch">${cards}</div><div class="acts"><button onclick="closeModal()">Back</button></div>`);
  document.querySelectorAll('[data-cq]').forEach(b => b.onclick = () => { closeModal(); Conquest.start(false, b.dataset.cq); });
}
$('mConquest').onclick = () => {
  if (Conquest.hasSave()) {
    let who = 'a conquest'; try { const q = JSON.parse(localStorage.getItem('ironbanners_conquest_v1')).Q; const c = CONQUESTS.find(x => x.id === q.cid); if (c) who = `${c.name}'s march (${q.year})`; } catch (e) { /* ignore */ }
    modal(`<h2>Conquests</h2><p>You have ${who} in progress.</p><div class="acts"><button id="cqNew">New conquest</button><button class="primary" id="cqCont">Continue the march</button></div>`);
    $('cqNew').onclick = () => { closeModal(); pickConqueror(); };
    $('cqCont').onclick = () => { closeModal(); if (Conquest.load()) Conquest.start(true); else pickConqueror(); };
  } else pickConqueror();
};
$('mBattles').onclick =() => { renderPicker(); showScreen('picker'); };
$('pBack').onclick = () => showScreen('title');
$('mArmory').onclick = () => { renderArmory(); showScreen('armory'); };
$('mCampaign').onclick = newCampaignDialog;
$('mContinue').onclick = () => { if (Camp.load()) CampUI.start(false); };
$('modal').onclick = e => { if (e.target.id === 'modal' && !$('mBox').querySelector('[data-lock]')) { /* click outside does nothing: decisions must be explicit */ } };

// ---------- historical battles
function renderPicker() {
  const m = medals();
  const icon = k => k === 'gold' ? '🥇' : k === 'silver' ? '🥈' : k === 'bronze' ? '🥉' : '';
  $('pCards').innerHTML = SCENARIOS.map(sc => {
    const md = m[sc.id] || {};
    return `<div class="card paper" data-sc="${sc.id}"><span class="medal">${icon(md[0]) || ''}${icon(md[1]) || ''}</span>
      <div class="yr">${sc.year}<span class="eraBadge">${ERAS[sc.era].name}</span></div><h3>${sc.name}</h3><div class="w">${sc.war} · ${sc.place}</div>
      <div class="vs"><b style="color:${sc.sides[0].color}">■</b> ${sc.sides[0].name} vs <b style="color:${sc.sides[1].color}">■</b> ${sc.sides[1].name}</div>
      <div class="tip" style="margin-top:6px">${sc.lesson}</div></div>`;
  }).join('');
  document.querySelectorAll('[data-sc]').forEach(c => c.onclick = () => briefing(SCENARIOS.find(s => s.id === c.dataset.sc)));
}

function briefing(sc) {
  let side = sc.histWinner, hist = true, doc = sc.sides[side].doctrine;
  const render = () => {
    const S = sc.sides[side];
    if (!S.doctrines.includes(doc)) doc = S.doctrine;
    modal(`<div class="yr" style="font-family:Cinzel;color:var(--accent)">${sc.date} · ${sc.place}</div><h2>${sc.name}</h2>
      ${sc.briefing.map(p => `<p>${p}</p>`).join('')}
      <b>Command</b>
      <div class="sidepick">${sc.sides.map((s, i) => `<button class="${i === side ? 'on' : ''}" data-side="${i}"><b>${s.name}</b> — ${s.commander}<div class="muted" style="font-size:12px">≈${s.men.toLocaleString()} men · ${s.units.length} units${i === sc.histWinner ? ' · won historically' : ' · lost historically'}</div></button>`).join('')}</div>
      <div class="row">Battle plan: <select id="bDoc">${S.doctrines.map(d => `<option value="${d}" ${d === doc ? 'selected' : ''}>${DOCTRINES[d].name}</option>`).join('')}</select>
      <span class="tip">${DOCTRINES[doc].hist ? DOCTRINES[doc].hist + ' — ' : ''}${DOCTRINES[doc].desc}</span></div>
      <div class="row">Enemy commander: <select id="bAI"><option value="hist" ${hist ? 'selected' : ''}>Historical — repeats what really happened, then adapts</option><option value="smart" ${!hist ? 'selected' : ''}>Free — reacts to you from the first round</option></select></div>
      <div class="plan"><b>The historical plan.</b> ${sc.plan}</div>
      <div class="acts"><button onclick="closeModal()">Back</button><button class="primary" id="bStart">Take command ⚔</button></div>`, false);
    document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { side = +b.dataset.side; doc = sc.sides[side].doctrine; render(); });
    $('bDoc').onchange = e => { doc = e.target.value; render(); };
    $('bAI').onchange = e => { hist = e.target.value === 'hist'; };
    $('bStart').onclick = () => { closeModal(); startScenario(sc, side, doc, hist); };
  };
  render();
}

function startScenario(sc, side, doc, hist) {
  const cfg = JSON.parse(JSON.stringify({ id: sc.id, name: sc.name, era: sc.era, sectors: sc.sectors, maxRounds: sc.maxRounds, defender: sc.defender, histAI: hist, sides: sc.sides, ground: sc.ground }));
  cfg.sides[side].doctrine = doc;
  cfg.sides[side].script = []; // the player's own side never follows a script
  BattleUI.start(cfg, {
    playerSide: side, title: `${sc.name}, ${sc.year}`, plan: sc.plan,
    onQuit: () => { renderPicker(); showScreen('picker'); },
    onEnd: (B, sum, stop) => debrief(sc, side, B, sum, stop),
  });
}

function debrief(sc, side, B, sum, stop) {
  const won = B.winner === side, draw = B.winner == null;
  const mine = sum[side], theirs = sum[1 - side];
  let medal = null;
  if (won) medal = mine.lostFrac < 0.3 && theirs.lostFrac > 0.5 ? 'gold' : mine.lostFrac < theirs.lostFrac ? 'silver' : 'bronze';
  if (medal) setMedal(sc.id, side, medal);
  const matchedHistory = (B.winner === sc.histWinner);
  const rewrote = won && side !== sc.histWinner;
  modal(`<h2>${won ? 'Victory' : draw ? 'Stalemate' : 'Defeat'} at ${sc.name}</h2>
    <div>${B.endReason}</div>
    ${medal ? `<div class="plan">${medal === 'gold' ? '🥇 Gold — a crushing, lopsided victory.' : medal === 'silver' ? '🥈 Silver — a clear victory.' : '🥉 Bronze — a costly victory.'}${rewrote ? ' <b>You have rewritten history.</b>' : ''}</div>` : ''}
    <table class="cas"><tr><th></th><th>Est. men lost</th><th>Units destroyed</th><th>Units routed</th><th>Commander</th></tr>
    ${sum.map(s => `<tr><td><b>${s.name}</b>${s.side === side ? ' (you)' : ''}</td><td>${s.lostMen.toLocaleString()} <span class="tip">(${Math.round(s.lostFrac * 100)}%)</span></td><td>${s.destroyed}</td><td>${s.routed}</td><td>${s.generalName ? (s.generalAlive ? s.generalName + ' survived' : '<span class="bad">' + s.generalName + ' fell</span>') : '—'}</td></tr>`).join('')}</table>
    <div class="hist"><b>What really happened.</b> ${sc.history}</div>
    <div class="tip" style="margin-top:8px">${matchedHistory ? 'Your battle ended as the real one did.' : 'Your battle ended differently from the real one.'} Lesson: ${sc.lesson}</div>
    <div class="acts"><button id="dbBattles">All battles</button><button class="primary" id="dbAgain">Fight again</button></div>`);
  $('dbBattles').onclick = () => { closeModal(); stop(); renderPicker(); showScreen('picker'); };
  $('dbAgain').onclick = () => { closeModal(); stop(); briefing(sc); };
}

// ---------- campaign setup
function newCampaignDialog() {
  let nat = 'rome', diff = 'normal', size = 'normal', limit = 0, rivals = 3;
  const render = () => {
    const n = NATIONS.find(x => x.id === nat);
    modal(`<h2>New Grand Campaign</h2>
      ${Camp.hasSave() ? '<div class="bad tip">Starting a new campaign replaces your saved one.</div>' : ''}
      <b>Choose your nation</b>
      <div class="sidepick" style="grid-template-columns:repeat(4,1fr)">${NATIONS.map(x => `<button class="${x.id === nat ? 'on' : ''}" data-n="${x.id}"><b style="color:${x.color};text-shadow:0 0 2px #000">■</b> <b>${x.name}</b><div class="muted" style="font-size:11px">${DOCTRINES[x.doctrine].name}</div></button>`).join('')}</div>
      <div class="plan"><b>${n.name}</b>: ${n.perk}<br><b>${DOCTRINES[n.doctrine].name}</b> <span class="tip">(${DOCTRINES[n.doctrine].hist})</span> — ${DOCTRINES[n.doctrine].desc}</div>
      <div class="row">Difficulty <select id="nd"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard (rival bonuses)</option></select>
      Map <select id="ns"><option value="normal">Standard (4 nations)</option><option value="large">Large (5 nations)</option></select>
      Turn limit <select id="nl"><option value="0">None — conquest only</option><option value="80">80 turns (score)</option><option value="150">150 turns (score)</option></select></div>
      <div class="acts"><button onclick="closeModal()">Back</button><button class="primary" id="nGo">Found the empire</button></div>`);
    $('nd').value = diff; $('ns').value = size; $('nl').value = String(limit);
    document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { nat = b.dataset.n; render(); });
    $('nd').onchange = e => diff = e.target.value; $('ns').onchange = e => size = e.target.value; $('nl').onchange = e => limit = +e.target.value;
    $('nGo').onclick = () => { closeModal(); Camp.newGame({ nation: nat, diff, size, turnLimit: limit, rivals: size === 'large' ? 4 : 3 }); CampUI.start(true); };
  };
  render();
}

// ---------- armory
function renderArmory() {
  const list = Object.values(U).filter(u => !u.hidden);
  let x = `<div style="display:flex;gap:10px;align-items:center"><button id="arBack">← Back</button><h2 style="margin:0">Armory</h2></div>
    <div class="tip" style="margin:6px 0 12px">Every recruitable unit, arranged like a research tree: branches down the side, eras across. BR = battle rating. Armor and penetration are in millimetres: a gun that cannot penetrate does little.</div>
    <div class="armGrid"><div></div>${[1, 2, 3, 4, 5].map(e => `<div class="h">${ERAS[e].name}<div class="tip">${ERAS[e].span}</div></div>`).join('')}`;
  for (const br of BRANCHES) {
    x += `<div class="b">${br}</div>`;
    for (let e = 1; e <= 5; e++) {
      const us = list.filter(u => u.era === e && CLASSES[u.cls].branch === br).sort((a, b) => a.br - b.br);
      x += `<div class="armCell">${us.map(u => `<div class="armUnit" data-u="${u.id}"><span class="br">${u.br.toFixed(1)}</span><b>${u.name}</b><div class="s">${CLASSES[u.cls].name} · ⚔${u.atk} 🛡${u.def}${u.arm ? ` · ${u.arm}mm` : ''}${u.pen >= 20 ? ` · pen ${u.pen}` : ''}</div></div>`).join('')}</div>`;
    }
  }
  x += `</div><div id="arInfo" class="plan" style="margin-top:14px">Click a unit for details.</div>
    <h3 style="margin-top:18px">Battle plans (doctrines)</h3><table class="cas">${Object.entries(DOCTRINES).filter(([k]) => k !== 'none').map(([k, d]) => `<tr><td><b>${d.name}</b><div class="tip">${d.hist}</div></td><td class="tip">${d.desc}</td></tr>`).join('')}</table>`;
  $('armWrap').innerHTML = x;
  $('arBack').onclick = () => showScreen('title');
  document.querySelectorAll('.armUnit').forEach(b => b.onclick = () => {
    const u = U[b.dataset.u];
    const tech = TECHS.find(t => t.units.includes(u.id));
    $('arInfo').innerHTML = `<b>${u.name}</b> — ${CLASSES[u.cls].name}, ${ERAS[u.era].name} era · BR ${u.br.toFixed(1)}
      <div class="statgrid"><div>Attack<b>${u.atk}</b></div><div>Defense<b>${u.def}</b></div><div>Morale<b>${u.mor}</b></div><div>Cost<b style="font-size:12px">${Camp.costTxt(u.cost)}</b></div>${u.arm || u.pen ? `<div>Armor<b>${u.arm} mm</b></div><div>Penetration<b>${u.pen} mm</b></div>` : ''}</div>
      ${u.tags.length ? `<div class="tip">Traits: ${u.tags.join(', ')}</div>` : ''}<div><i>${u.note}</i></div><div class="tip">${tech ? 'Unlocked by ' + tech.name : 'Available from the start'}.</div>`;
  });
}

updateTitle();

// ---------- automated playtest hook
if (location.search.includes('test')) {
  window.__IB = { Battle, BattleUI, Camp, CampUI, Conquest, SCENARIOS, U, startScenario, SETTINGS,
    simScenario(id, hist = true, n = 100) {
      const sc = SCENARIOS.find(s => s.id === id); let w = [0, 0, 0], rounds = 0, loss = [0, 0];
      for (let i = 0; i < n; i++) {
        const cfg = JSON.parse(JSON.stringify({ id: sc.id, sectors: sc.sectors, maxRounds: sc.maxRounds, defender: sc.defender, histAI: hist, sides: sc.sides }));
        cfg.sides.forEach(s => s.isAI = true);
        const B = Battle.create(cfg); B.histAI = hist; let g = 0;
        while (!B.over && g++ < 40) { Battle.beginRound(B); Battle.resolve(B); }
        w[B.winner == null ? 2 : B.winner]++; rounds += B.round; const s = Battle.summary(B); loss[0] += s[0].lostFrac; loss[1] += s[1].lostFrac;
      }
      return { id, hist, side0: w[0] / n, side1: w[1] / n, draw: w[2] / n, rounds: rounds / n, loss0: loss[0] / n, loss1: loss[1] / n, histWinner: sc.histWinner };
    },
    // plays a whole conquest with auto-resolved battles; returns a log of win estimates per battle
    async autopilot(cid, { maxSteps = 900, skipOptional = true } = {}) {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const spd = SETTINGS.speed; SETTINGS.speed = 0.3;
      Conquest.start(false, cid); const log = []; let lastNode = null, stuck = 0;
      for (let step = 0; step < maxSteps; step++) {
        await sleep(10);
        const Q = Conquest.Q;
        if ($('modal').classList.contains('show')) {
          const box = $('mBox');
          if ($('qMenu2')) { log.push('END ' + box.querySelector('h2').textContent + ' | won ' + Q.won + ' lost ' + Q.lost + ' army ' + Q.army.length + ' gold ' + Q.gold + ' loy ' + Q.loyalty + ' leg ' + Q.legit); $('qMenu2').click(); break; }
          if ($('qAuto')) { const p = box.querySelector('.plan b')?.textContent; log.push(`${Q.node}: est ${p}, army ${Q.army.length} avg ${Math.round(Q.army.reduce((a, u) => a + u.str, 0) / Q.army.length)}`); $('qAuto').click(); continue; }
          if (/^Defeat/.test(box.querySelector('h2')?.textContent || '')) log.push('  DEFEAT');
          const ch = [...box.querySelectorAll('[data-ch]')].filter(b => !b.disabled);
          if (ch.length) { (ch.find(b => !/stop here|go home|sail home|fight no more|Make peace|Accept and end|Proclaim yourself|Dictate|settle/i.test(b.textContent)) || ch[0]).click(); continue; }
          const ok = $('qOk') || $('qGo') || $('qMarch') || box.querySelector('.primary'); if (ok) ok.click();
          continue;
        }
        if (Q.over) { $('qEnd')?.click(); continue; }
        const rec = [...document.querySelectorAll('#qPanel [data-rec]')].filter(b => !b.disabled);
        if (rec.length && Q.gold > 150) { rec[0].click(); continue; }
        const avg = Q.army.reduce((a, u) => a + u.str, 0) / Q.army.length;
        if (avg < 85 && Q.gold >= 15 && $('qRest') && !$('qRest').disabled) { $('qRest').click(); continue; }
        if (Q.gold > 500 && $('qShare') && !$('qShare').disabled) { $('qShare').click(); continue; }
        const gos = [...document.querySelectorAll('#qPanel [data-go]')]; const go = (skipOptional && gos.find(b => !/optional/.test(b.textContent))) || gos[0];
        if (go) { if (lastNode === Q.node) stuck++; else stuck = 0; lastNode = Q.node; if (stuck > 300) { log.push('STUCK at ' + Q.node); break; } go.click(); }
      }
      SETTINGS.speed = spd;
      try { localStorage.removeItem('ironbanners_conquest_v1'); } catch (e) { /* ignore */ }
      return log;
    },
  };
}
