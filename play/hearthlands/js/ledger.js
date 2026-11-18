// ===== Gold ledger: every change to the treasury is recorded with the reason for it =====
let _why = null;
function why(label, fn, ...args) { const p = _why; _why = label; try { return fn(...args); } finally { _why = p; } }
const _ledgered = new WeakSet();
function installLedger() {
  if (!G || !G.res || _ledgered.has(G.res)) return;
  let v = +G.res.gold || 0;
  Object.defineProperty(G.res, 'gold', { enumerable: true, configurable: true, get: () => v, set: nv => { const d = nv - v; v = nv; if (d && isFinite(d)) logGold(d); } });
  _ledgered.add(G.res);
}
function logGold(d) {
  const L = G.goldLedger || (G.goldLedger = { today: {}, days: [] });
  const k = _why || 'Other';
  L.today[k] = (L.today[k] || 0) + d;
}
function rollLedger() { const L = G.goldLedger || (G.goldLedger = { today: {}, days: [] }); L.days.unshift(L.today); L.days = L.days.slice(0, 10); L.today = {}; }
function ledgerSum(n) { const o = {}, L = G.goldLedger; if (!L) return o; for (const d of L.days.slice(0, n)) for (const k in d) o[k] = (o[k] || 0) + d[k]; return o; }
const ACT_WHY = { mkt: 'Market trading', dotrade: 'Trading with rivals', wedout: 'Royal marriages', wedin: 'Royal marriages', claim: 'Claiming land', vattack: 'War', declare: 'War', peace: 'Diplomacy', upgrade: 'Upgrades', advance: 'Advancing the age', adopt: 'Reforms', invite: 'Inviting settlers', reroll: 'Inviting settlers', festival: 'Festivals', buyland: 'Buying land',
  levy: 'Raising levies', train: 'Training soldiers', placate: 'Placating vassals', buypeace: 'Buying peace', annex: 'Annexing villages', spy: 'Spies', mission: 'Spies', marry: 'Diplomacy', gift: 'Diplomacy' };
function actWhy(act) { if (ACT_WHY[act]) return ACT_WHY[act]; if (/trade|buy|sell|market/.test(act)) return 'Trading'; if (/spy/.test(act)) return 'Spies'; if (/gift|pact|ally|marry|tribute|demand/.test(act)) return 'Diplomacy'; return 'Your purchases'; }
// the realm window's breakdown: where gold came from and went over the last days
function ledgerHtml() {
  const L = G.goldLedger; const n = L ? Math.min(5, L.days.length) : 0;
  if (!n) return '<div class="dim">The treasurer is still counting — check back tomorrow.</div>';
  const s = ledgerSum(n), rows = Object.entries(s).filter(([, v]) => Math.abs(v) >= 0.05);
  const inc = rows.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), out = rows.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const ti = inc.reduce((a, r) => a + r[1], 0), to = out.reduce((a, r) => a + r[1], 0);
  const row = ([k, v]) => `<div class="lrow"><span>${esc(k)}</span><b class="${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${(v / n).toFixed(1)}</b></div>`;
  return `<div class="kv">Average per day over the last ${n} day${n > 1 ? 's' : ''}: <b class="pos">+${(ti / n).toFixed(1)}</b> in, <b class="neg">${(to / n).toFixed(1)}</b> out → <b class="${ti + to >= 0 ? 'pos' : 'neg'}">${ti + to >= 0 ? '+' : ''}${((ti + to) / n).toFixed(1)} 🪙/day</b></div>
    <div class="ledger"><div><div class="dim">Income</div>${inc.map(row).join('') || '<div class="dim">none</div>'}</div><div><div class="dim">Spending</div>${out.map(row).join('') || '<div class="dim">none</div>'}</div></div>`;
}
function goldTips() {
  const t = [], adults = G.kin.filter(k => isAdult(k) && !k.away).length;
  t.push(`Taxes bring ${({ low: 0.2, normal: 0.4, high: 0.65 }[G.policies.tax] * (1 + fx('tax'))).toFixed(2)} 🪙 per adult a day (${adults} adults) — more people means more gold.`);
  if (!hasTech('currency')) t.push('Discover <b>Currency</b> to build Markets — your best early source of gold.');
  else if (!countB('market')) t.push('Build a <b>Market</b>: each worker earns gold every day, more when linked to town by road.');
  else t.push('Upgrade Markets and link them by road; each level adds a worker and +35% output.');
  if (!countB('tavern')) t.push('A <b>Tavern</b> earns a little gold and keeps kin happy.');
  if ([...Object.values(G.buildings)].some(b => b.type === 'mine' && G.tiles.special[idx(b.x, b.y)] === 2) === false) t.push('Mines on a <b>gold vein</b> (prospect hills with Terraform) dig gold.');
  t.push('Sell surplus food, wood or stone at the Market (Realm window) and trade with rivals.');
  t.push('Vassals and vassal cities pay tribute every day.');
  const sol = soldiers().length; if (sol) t.push(`Your ${sol} soldiers cost upkeep every day — lower the army stance in peacetime to save gold.`);
  return t;
}
