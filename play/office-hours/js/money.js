// Your personal money: salary, living costs, net worth, and startups (yours and your colleagues').
import { G, hooks, int, pick, chance, clamp, fmt$, fmtK, team, person, mod, removePerson, log, mail, queueVisit, card, proj, addRep, randomLook, personName, year, has } from './sim.js';
import { N, C, T, note, gw, all, opener } from './talk.js';

export const SALARY = [2150, 2650, 3350, 4400]; // weekly take-home by title
const LIVING = { single: 950, partner: 1250, family: 1850 };
export const STAGES = [
  { name: 'Seed', lo: 4e6, hi: 12e6 }, { name: 'Series A', lo: 25e6, hi: 70e6 }, { name: 'Series B', lo: 120e6, hi: 350e6 },
  { name: 'Series C', lo: 500e6, hi: 1.5e9 }, { name: 'Late stage', lo: 2e9, hi: 6e9 },
];
const PRE = ['Qu', 'Lumi', 'Hilbert', 'Photon', 'Coher', 'Spin', 'Flux', 'Entangl', 'Nano', 'Axion', 'Boson', 'Planck', 'Tensor', 'Vortex', 'Quark', 'Kelvin', 'Fermi', 'Qubit'];
const SUF = ['ly', 'ix', 'ion', ' Labs', ' Dynamics', ' Works', ' Systems', ' Logic', ' Sense', ' Devices', 'ify'];

export function fin() { if (!G.fin) G.fin = { cash: 45000, companies: [], billionaire: false }; return G.fin; }
export const salaryWeekly = () => Math.round(SALARY[G.titleIdx] * (G.costIndex || 1) * (G.flags && G.flags.raiseFrozen > G.week ? 0.95 : 1)); // a reprimand freezes your raises
export const livingWeekly = () => Math.round((LIVING[G.life ? G.life.status : 'single'] || 1000) * (G.costIndex || 1));
export const equityValue = co => co.status === 'dead' ? 0 : co.status === 'acquired' ? 0 : co.stake * co.val;
export const netWorth = () => fin().cash + fin().companies.reduce((s, c) => s + equityValue(c), 0);
export const healthWord = h => h > 0.7 ? 'Thriving' : h > 0.55 ? 'Growing' : h > 0.4 ? 'Steady' : h > 0.25 ? 'Struggling' : 'In trouble';
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const coById = id => fin().companies.find(c => c.id === id);

// CEO quality decides how a company tends to do
function ceoHealth(p) {
  let h = 0.35 + ((p.skill ? p.skill.exp + p.skill.code : 10) / 20) * 0.2;
  const t = p.traits || [];
  if (t.includes('ambitious')) h += 0.1; if (t.includes('industry')) h += 0.08; if (t.includes('workaholic')) h += 0.05; if (t.includes('diplomat')) h += 0.05; if (t.includes('social')) h += 0.04;
  if (t.includes('anxious')) h -= 0.08; if (t.includes('slacker')) h -= 0.1; if (t.includes('loner')) h -= 0.04;
  return clamp(h, 0.15, 0.85);
}

export function createCompany({ product, plat, fundScore = 5, ceo, role, stake, invest = 0, board = false }) {
  const F = fin();
  const name = pick(PRE) + pick(SUF);
  let health = clamp(ceoHealth(ceo) + (fundScore - 5) * 0.03 + Math.min(G.rep, 150) / 1500 + (invest > 0 ? 0.04 : 0) + (ceo.traits && ceo.traits.includes('chaotic') ? (Math.random() - 0.5) * 0.3 : 0), 0.1, 0.9);
  const st = STAGES[0];
  const co = {
    id: 'co' + (G.nextId++), name, product, plat, role, stake, board, invest, health, base: health,
    ceo: { first: ceo.first, last: ceo.last, look: ceo.look || randomLook('postdoc'), traits: ceo.traits || [] },
    stage: 0, val: (st.lo + (st.hi - st.lo) * Math.random()) * (0.7 + health * 0.6), status: 'private', founded: G.week, nextRound: G.week + int(26, 44), hist: [],
  };
  F.cash -= invest;
  F.companies.push(co);
  log(`${role === 'founder' ? 'Founded' : role === 'cofounder' ? 'Co-founded' : role === 'advisor' ? 'Became an advisor to' : 'Invested in'} ${name} (${(stake * 100).toFixed(1)}%).`);
  return co;
}

// your own company, with someone from your lab as CEO
export function foundWithStudent(p, paper, invest) {
  const pr = proj(paper.proj); const sysC = pr ? card(pr.cards[0]) : null;
  const co = createCompany({ product: paper.title, plat: sysC ? sysC.plat : 'theory', fundScore: pr ? pr.fund : 5, ceo: p, role: 'founder', stake: 0.32, invest, board: true });
  removePerson(p, `left to be CEO of ${co.name}`);
  gw(-3);
  mail(`${p.first} ${p.last}`, `${co.name} is official`, `We incorporated this morning! I'm CEO, you're co-founder and chair of the board. ${invest ? `Your ${fmt$(invest)} is in the bank account.` : ''}\n\nFirst milestone: a prototype in six months. Thank you for believing in me.\n\n${p.first}`);
  hooks.toast(`🚀 ${co.name} founded. ${p.first} is CEO.`, 'good');
  return co;
}

export function finExtInfo(v) {
  if (v.ext !== 'ceo') return null;
  const co = coById(v.co); if (!co) return null;
  return { name: `${co.ceo.first} ${co.ceo.last}`, first: co.ceo.first, role: `CEO of ${co.name}`, look: co.ceo.look, phone: v.phone };
}

// ---------------- weekly money tick ----------------
export function finDirector() {
  const F = fin();
  F.cash += salaryWeekly() - livingWeekly() + (F.cash > 0 ? F.cash * 0.0008 : 0);
  for (const co of F.companies) {
    if (co.status === 'dead' || co.status === 'acquired') continue;
    if (co.board) G.energy = clamp(G.energy - 3, 0, 100);
    const pub = co.status === 'public';
    // health drifts back toward what this CEO (plus your board help) can sustain
    const target = (co.base || co.health) + (co.board ? 0.04 : 0);
    co.health = clamp(co.health + (target - co.health) * 0.02 + (Math.random() - 0.5) * 0.02, 0.05, 0.95);
    let mu = (co.health - 0.56) * (pub ? 0.005 : 0.012); const sig = pub ? 0.045 : 0.035;
    if (!pub && co.val > STAGES[co.stage].hi * 1.3) mu -= 0.008; // private marks don't run far ahead of the next round
    co.val *= Math.exp(mu + sig * gauss());
    co.hist.push(Math.round(co.val)); if (co.hist.length > 260) co.hist.shift();
    // most startups die: background risk, higher early and for weak companies
    if (!pub && chance([0.0045, 0.003, 0.002, 0.0012, 0.0008][co.stage] * (1.6 - co.health))) { co.status = 'dead'; co.val = 0; log(`${co.name} shut down.`); mail(`${co.ceo.first} ${co.ceo.last}`, `${co.name} is shutting down`, `We couldn't make it work. ${pick(['The market was not ready.', 'We ran out of money before the product was ready.', 'A bigger company beat us to it.', 'Our key customer walked away.'])} Thank you for believing in us.

${co.ceo.first}`); hooks.toast(`📉 ${co.name} shut down.`, 'bad'); continue; }
    if (!pub && G.week >= co.nextRound && !G.queue.some(q => q.co === co.id)) { co.nextRound = G.week + 999; queueVisit({ ev: co.stage >= 4 && co.health > 0.5 ? 'venture_ipo' : 'venture_round', ext: 'ceo', co: co.id, phone: co.role !== 'founder', pri: 2 }); }
    if (co.health < 0.22 && chance(0.04) && !G.queue.some(q => q.co === co.id)) queueVisit({ ev: 'venture_crisis', ext: 'ceo', co: co.id, phone: true, pri: 2 });
    if (co.stage >= 2 && chance(0.008) && !G.queue.some(q => q.co === co.id)) queueVisit({ ev: 'venture_exit', ext: 'ceo', co: co.id, phone: true, pri: 2 });
  }
  if (!F.billionaire && netWorth() >= 1e9) { F.billionaire = true; mail('Your financial advisor', 'You are a billionaire', `Your net worth just crossed $1,000,000,000. Your advisor would like to schedule a call. Your students would like a raise.`); hooks.toast('💰 BILLIONAIRE', 'good'); if (hooks.billionaire) hooks.billionaire(); }
  // colleagues starting companies
  if (chance(0.006 + Math.min(G.rep, 150) / 30000) && !G.queue.some(q => q.ev === 'colleague_startup') && (G.profs || []).length) {
    const f = pick(G.profs); queueVisit({ ev: 'colleague_startup', ext: 'prof', prof: f.id, pri: 2 });
  }
}

// ---------------- events ----------------
export const FIN_EV = {};
const who = co => ({ name: `${co.ceo.first} ${co.ceo.last}`, first: co.ceo.first, role: `CEO of ${co.name}` });

FIN_EV.venture_round = {
  kind: 'fin',
  run(c) {
    const co = coById(c.v.co); if (!co || co.status !== 'private') return null;
    const F = fin(); const next = STAGES[Math.min(co.stage + 1, STAGES.length - 1)];
    const pre = Math.max(co.val * (1.3 + Math.random() * 0.9), next.lo * (0.6 + co.health * 0.6));
    const raise = pre * 0.25, post = pre + raise;
    const pSucc = clamp(0.05 + co.health * 0.8 + Math.min(G.rep, 150) / 1500, 0.05, 0.85);
    const proRata = Math.round(co.stake * raise);
    const finish = (ok, extra) => { co.nextRound = G.week + int(30, 52); if (ok) { co.stage = Math.min(co.stage + 1, STAGES.length - 1); co.val = post; co.health = clamp(co.health + 0.03, 0, 0.95); return extra; } co.val *= 0.6; co.health = clamp(co.health - 0.1, 0.05, 0.95); return `The round falls apart. Investors pass. ${co.name} is now worth ${fmtK(co.val)} on paper.`; };
    const ch = [];
    ch.push(C(`Raise it, and I'll put in my share to avoid dilution.`, `−${fmt$(proRata)} of your own money · ${Math.round(pSucc * 100)}% likely to close`, () => { if (F.cash < proRata) return 'You don\'t have that much cash.'; F.cash -= proRata; return finish(chance(pSucc), `${next.name} closed at ${fmtK(post)}. You kept your full ${(co.stake * 100).toFixed(1)}%.`); }, { dis: F.cash < proRata }));
    ch.push(C('Raise it. I\'ll accept some dilution.', `Your stake shrinks to ${(co.stake * 80).toFixed(1)}% · ${Math.round(pSucc * 100)}% likely to close`, () => { const ok = chance(pSucc); if (ok) co.stake *= 0.8; return finish(ok, `${next.name} closed at ${fmtK(post)}. Your stake is now ${(co.stake * 100).toFixed(1)}%.`); }));
    ch.push(C('Push for a much higher valuation.', `Riskier (${Math.round(pSucc * 70)}%) · if it works, worth 40% more`, () => { const ok = chance(pSucc * 0.7); if (ok) { co.stake *= 0.85; co.val = post * 1.4; co.stage = Math.min(co.stage + 1, STAGES.length - 1); co.nextRound = G.week + int(30, 52); return `Bold. It works. ${next.name} closed at ${fmtK(co.val)}.`; } return finish(false); }));
    ch.push(C('Don\'t raise. Stay lean and profitable.', 'Slower growth, safer company', () => { co.health = clamp(co.health + 0.05, 0, 0.95); co.val *= 0.95; co.nextRound = G.week + int(30, 50); return `${co.ceo.first} agrees. The team stays small and focused.`; }));
    return N(who(co), `${co.ceo.first} ${c.v.phone ? 'calls' : 'drops by'}. "${co.name} is ready to raise a ${next.name}. Investors are talking about a ${fmtK(pre)} valuation before the money comes in. We'd raise ${fmtK(raise)}."`, ch);
  },
};

FIN_EV.venture_crisis = {
  kind: 'fin',
  run(c) {
    const co = coById(c.v.co); if (!co || co.status === 'dead' || co.status === 'acquired') return null;
    const F = fin(); const problem = pick(['We have three months of runway left.', 'Our lead engineer just quit for a competitor.', 'A giant tech company launched the same product. For free.', 'The prototype failed its big customer demo.']);
    const bridge = Math.round(Math.max(50000, co.val * 0.04));
    return N(who(co), `${co.ceo.first} sounds exhausted. "${problem} I don't know if ${co.name} survives this."`, [
      C(`I'll write a personal bridge check.`, `−${fmt$(bridge)} of your own money · health ↑↑`, () => { if (F.cash < bridge) return 'You don\'t have that much cash.'; F.cash -= bridge; co.health = clamp(co.health + 0.2, 0, 0.95); co.stake = Math.min(0.6, co.stake + bridge / (co.val + bridge) * 0.5); return 'The money buys time. The team rallies.'; }, { dis: F.cash < bridge }),
      C('Pivot to something more practical.', 'Value halves · health ↑', () => { co.val *= 0.5; co.health = clamp(co.health + 0.15, 0, 0.95); co.product += ' (pivoted)'; return `${co.name} pivots. It's less exciting, and it might actually work.`; }),
      C('Let it go. Wind it down gracefully.', 'Company closes', () => { co.status = 'dead'; co.val = 0; log(`${co.name} shut down.`); return `${co.name} closes. ${co.ceo.first} sends a long, sad, gracious email to everyone who helped.`; }),
    ]);
  },
};

FIN_EV.venture_exit = {
  kind: 'fin',
  run(c) {
    const co = coById(c.v.co); if (!co || co.status === 'dead' || co.status === 'acquired') return null;
    const F = fin(); const price = co.val * (0.9 + Math.random() * 0.7); const yours = co.stake * price;
    const buyer = pick(['a giant chip company', 'a search-engine company', 'a defense contractor', 'a pharmaceutical company', 'a quantum computing unicorn']);
    return N(who(co), `${co.ceo.first} is breathless. "${buyer} wants to buy ${co.name}. ${fmtK(price)}, all cash. Your share would be ${fmtK(yours)}."`, [
      C('Sell.', `+${fmtK(yours)} cash`, () => { F.cash += yours; co.status = 'acquired'; co.exitPrice = price; addRep(1); log(`${co.name} acquired for ${fmtK(price)}. You made ${fmtK(yours)}.`); hooks.toast(`💰 ${co.name} acquired: +${fmtK(yours)}`, 'good'); return `Done. ${co.ceo.first} cries at the signing. You might, too.`; }),
      C('Hold out. This company can be bigger.', 'Keep going', () => { co.health = clamp(co.health + 0.02, 0, 0.95); return `"Okay. Let's build something huge." The buyer walks away.`; }),
    ]);
  },
};

FIN_EV.venture_ipo = {
  kind: 'fin',
  run(c) {
    const co = coById(c.v.co); if (!co || co.status !== 'private') return null;
    return N(who(co), `${co.ceo.first}: "The bankers say we're ready. ${co.name} can go public. We'd ring the bell next month."`, [
      C('Take it public.', 'Shares become sellable · often a first-day pop', () => { co.status = 'public'; co.val *= 1 + Math.random() * 0.5; log(`${co.name} went public at ${fmtK(co.val)}.`); hooks.toast(`🔔 ${co.name} IPO: ${fmtK(co.val)}`, 'good'); return `The stock opens up. Your shares are worth ${fmtK(co.stake * co.val)}.`; }),
      C('Stay private a while longer.', 'Another round later', () => { co.nextRound = G.week + int(30, 50); return '"Fair. More time to grow."'; }),
    ]);
  },
};

FIN_EV.colleague_startup = {
  kind: 'fin',
  run(c) {
    const f = (G.profs || []).find(x => x.id === c.v.prof); if (!f) return null;
    const F = fin(); const idea = card(pick(f.cards || ['qinfo'])) || { name: 'quantum sensors', plat: 'theory' };
    const make = (role, stake, invest, board) => createCompany({ product: idea.name, plat: idea.plat || 'theory', fundScore: 6, ceo: { first: f.first, last: f.last, look: f.look, traits: f.persona === 'neighbor' || f.persona === 'oldguard' ? ['workaholic'] : f.persona === 'junior' ? ['ambitious'] : ['diplomat'], skill: { exp: 7, code: 6 } }, role, stake, invest, board });
    return N(Object.assign(f, { title: 'Prof.' }), `Prof. ${f.last} closes your door. "Don't tell anyone yet. I'm starting a company around ${idea.name}. I'd love to have you involved."`, [
      C('Be a scientific advisor.', '1.5% equity · no cost', () => { make('advisor', 0.015, 0, false); f.rel = Math.min(100, f.rel + 4); return '"Wonderful. Mostly we\'ll want your name on the website."'; }),
      C('Invest $50,000 of my own money.', '+3% equity · −$50,000', () => { if (F.cash < 50000) return 'You don\'t have $50,000 in savings.'; make('investor', 0.03, 50000, false); f.rel = Math.min(100, f.rel + 6); return '"You believe in it. That means a lot."'; }, { dis: F.cash < 50000 }),
      C('Co-found it with them.', '8% equity · board seat (−3 energy a week) · goodwill ↓', () => { make('cofounder', 0.08, 0, true); gw(-3); f.rel = Math.min(100, f.rel + 10); return 'You shake hands. You are now a co-founder. Your calendar is now a war zone.'; }),
      C('I\'ll pass, but good luck.', '', () => '"Fair enough. Offer stands if you change your mind." (It doesn\'t.)'),
    ]);
  },
};
