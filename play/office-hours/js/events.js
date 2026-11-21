// Visits: people walk into your office and you talk. Conversations branch, people remember
// how you treated them, and promises come back to you. Also: the weekly event director and email actions.
import { WPY, TRAITS, CARDS, JOURNALS, GRANTS, EQUIP, ROLES, RESEARCH_EQUIP, SUPPLIES, HIRE_COST, PLATS } from './data.js';
import {
  G, hooks, rnd, int, pick, chance, clamp, shuffle, fmt$, fmtK, wk, year, term,
  makePerson, has, person, team, mod, rel, relOf, addPerson, removePerson, capacity, unlockCards, refreshUnlocks, mismatch,
  mail, log, queueVisit, busy, card, proj, makeProject, joinProject, scoreIdea, ideaTitle, projNeeds, borrowing,
  publish, acceptChance, chanceWord, addRep, supplyCost, weeklyCosts, tenureScore, TENURE_BAR, roleName, randomLook, genApplicants, acceptOfferChance,
} from './sim.js';
import { N, C, T, note, lastNote, countNotes, lastTone, trust, vary, opener, react, withReact, promise, cul, gw, all, worstRel, bestRel, memOf } from './talk.js';
import { LIFE_EV, lifeDirector, lifeExtInfo } from './life.js';
import { FIN_EV, finDirector, finExtInfo, createCompany, fin } from './money.js';
import { CHAT_EV, lifeChoices } from './chat.js';
import { CAREER_EV, hrDirector, jobDirector, interestTick, interestsOf, fitScore } from './career.js';

// ---------- external visitors ----------
export const EXT = {
  chair: { name: 'Prof. Harold Lindqvist', role: 'Department Chair', look: { skin: '#e8c4a6', hair: '#d8d8d8', style: 'bald', shirt: '#2a2f3a', pants: '#2a2f3a', coat: false, glasses: true, height: 1.04, beard: true, suit: true } },
  po: { name: 'Dr. Marisol Ortega', role: 'Program Officer', look: { skin: '#c8946a', hair: '#1b1410', style: 'bun', shirt: '#6a2a4a', pants: '#222', coat: false, glasses: false, height: 0.98, suit: true } },
  journalist: { name: 'Sam Achterberg', role: 'Science Journalist', look: { skin: '#f0d0b4', hair: '#a8743c', style: 'curly', shirt: '#c2a878', pants: '#3a3a3a', coat: false, glasses: true, height: 1.0 } },
  rival: { name: 'Prof. Renata Voss', role: 'Your rival', look: { skin: '#f3d8c2', hair: '#111', style: 'bob', shirt: '#111', pants: '#111', coat: false, glasses: false, height: 1.03, turtleneck: true } },
  vc: { name: 'Chad Whitlock', role: 'Venture Capitalist', look: { skin: '#f0caa8', hair: '#c9a060', style: 'spiky', shirt: '#dfe6ee', pants: '#2a3a5a', coat: false, glasses: false, height: 1.05, vest: true } },
  safety: { name: 'Officer Dee Pruitt', role: 'Environmental Health & Safety', look: { skin: '#8d5a3a', hair: '#2a1a10', style: 'short', shirt: '#ffd400', pants: '#2c3e50', coat: false, glasses: true, height: 1.0, hivis: true } },
  facilities: { name: 'Gus from Facilities', role: 'Building Facilities', look: { skin: '#d49a6a', hair: '#555', style: 'short', shirt: '#3a5a8a', pants: '#3a5a8a', coat: false, glasses: false, height: 1.0, beard: true, cap: true } },
  stranger: { name: 'A Stranger in Foil', role: '???', look: { skin: '#e8d8ff', hair: '#e0e0ff', style: 'spiky', shirt: '#c0c8d8', pants: '#c0c8d8', coat: true, glasses: true, height: 1.0, glow: true } },
  donor: { name: 'Beverly Kostas-Moon', role: 'Wealthy Alumna', look: { skin: '#f3d2b5', hair: '#e8e0d0', style: 'bob', shirt: '#7a2a5a', pants: '#2a2a2a', coat: false, glasses: true, height: 0.97, suit: true } },
  auditor: { name: 'Pat Okonkwo', role: 'Sponsored Research Compliance', look: { skin: '#8d5a3a', hair: '#2a1a10', style: 'bun', shirt: '#4a4a5a', pants: '#2a2a2a', coat: false, glasses: true, height: 0.99, suit: true } },
  fairkid: { name: 'Maya (age 9)', role: 'Local Science Fair Champion', look: { skin: '#b57a4e', hair: '#1b1410', style: 'ponytail', shirt: '#e67e22', pants: '#3a5a8a', coat: false, glasses: true, height: 0.62 } },
  quanta: { name: 'Brent Hollis', role: 'QuantaCorp Liaison', look: { skin: '#e8b996', hair: '#3a2418', style: 'short', shirt: '#1abc9c', pants: '#2c3e50', coat: false, glasses: false, height: 1.02, vest: true } },
  phone: { name: 'Unknown caller (+46)', role: 'Stockholm, Sweden', phone: true },
  hr: { name: 'Dana Whitfield', role: 'Human Resources', look: { skin: '#c98e62', hair: '#3a2a20', style: 'bun', shirt: '#5a6a7a', pants: '#2a2a2a', coat: false, glasses: true, height: 0.98, suit: true } },
};

// name, role and 3D look of whoever is visiting (used by the 3D world)
export function extInfo(v) {
  if (v.ext === 'applicant') { const a = G.applicants.find(x => x.id === v.app); return a ? { name: `${a.first} ${a.last}`, first: a.first, look: a.look, role: ROLES[a.role].name + ' applicant' } : null; }
  if (v.ext === 'alum') return { name: v.alumName || 'A former student', first: (v.alumName || 'Alum').split(' ')[0], look: v.alumLook || (v.alumLook = randomLook('postdoc')), role: 'Former lab member' };
  const li = lifeExtInfo(v); if (li) return li;
  const fi = finExtInfo(v); if (fi) return fi;
  const e = EXT[v.ext]; return e ? { ...e, first: e.name.replace(/^(Prof\.|Dr\.|Officer)\s/, '').split(' ')[0] } : null;
}
export function visitorName(v) {
  if (v.ext) { const e = extInfo(v); return e ? e.name : 'Someone'; }
  const A = person(v.A); return A ? A.first + ' ' + A.last : '?';
}

const projOf = p => p && p.project ? proj(p.project) : null;
const qWord = q => q >= 85 ? 'stunning' : q >= 70 ? 'really striking' : q >= 55 ? 'solid' : q >= 40 ? 'decent' : 'kind of messy';
const TOOL = { optics: 'the laser table', vacuum: 'the vacuum chamber', fridge: 'cooldown slots on the dilution fridge', cryostat: 'magnet time on the cryostat', fab: 'the e-beam lithography tool', stm: 'the STM', cluster: 'the GPU queue' };
const usedEquip = A => { const pr = projOf(A); return pr ? projNeeds(pr.cards).filter(k => G.equip[k]) : []; };

// ---------- journals ----------
function journalNode(c, pr, who, maxBar = 999, prefix = '') {
  const js = JOURNALS.filter(j => j.bar < maxBar);
  return N(who, prefix + `Where should "${pr.title}" go?`, js.map(j => C(j.name, j.id === 'arxiv' ? `Instant · +${j.rep} rep · no journal credit` : `${chanceWord(acceptChance(pr, j))} · +${j.rep} rep · ~${j.weeks} weeks${j.apc ? ` · ${fmt$(j.apc * (G.costIndex || 1))} fee if accepted` : ''}`, () => {
    pr.preprint = true;
    if (j.id === 'arxiv') { publish(pr, j); hooks.toast(`📄 Posted to arXiv: ${pr.title}`); return `It's on arXiv. Tomorrow's listing will have your names on it.`; }
    pr.stage = 'review'; pr.journal = j.id; pr.decideWeek = G.week + j.weeks + int(-1, 2); pr.attempts++;
    log(`Submitted "${pr.title}" to ${j.name}.`);
    if (j.bar > 110 && has(who, 'anxious')) return `Submitted to ${j.name}. ${who.first} refreshes the submission portal eleven times in the next hour.`;
    if (j.bar > 110 && has(who, 'ambitious')) return `Submitted to ${j.name}. ${who.first} is already drafting the press release.`;
    return `Submitted to ${j.name}, with the preprint on arXiv so nobody can scoop it. Now we wait for the referees.`;
  })));
}

function celebrate(c, pr, paper, who) {
  const j = JOURNALS.find(x => x.id === paper.jid);
  return N(who, `ACCEPTED in ${j.name}! ${paper.landmark ? 'People are already calling it a landmark result. Your phone has not stopped buzzing.' : vary('accept', ['The whole lab heard the shriek.', `${who.first} is doing a dance that should never be seen again.`, 'Someone rings the old fire bell in the hallway. Facilities will have words.'])}`, [
    T(c, 'warm', who, 'Lab dinner tonight, on me.', '−$1,500 · everyone\'s morale ↑ · culture ↑', () => { G.money -= 1500; all({ morale: 7, stress: -6 }); cul(3); for (const a of team()) for (const b of team()) if (a.id < b.id) rel(a, b, 3); return vary('dinner', ['Dumplings, a terrible karaoke bar and a toast to Reviewer 2.', 'Pizza on the lab roof. Someone brings a telescope. Nobody goes home before midnight.', 'The good Thai place. The postdoc gives a speech that makes two people cry.']); }),
    T(c, 'warm', who, `Tell ${who.first} it was their work that made it.`, `${who.first} ↑↑`, () => { mod(who, { morale: 12, loyalty: 8 }); return withReact(who, 'warm', `You say it in front of the whole lab.`); }),
    T(c, 'dismiss', who, 'Well done. What\'s next?', 'No cost', () => { mod(who, { morale: -4 }); return `${who.first} had hoped you'd be a bit more excited.`; }),
  ]);
}

// ===================================================================
// LAB VISITS
// ===================================================================
export const EV = {};

// --- Ideas ---
EV.idea = {
  kind: 'solo', cd: 6,
  w: c => (has(c.A, 'dreamer') ? 3 : 1) * (c.A.role === 'undergrad' ? 0.5 : 1) * (G.projects.filter(p => p.stage === 'running').length < 2 ? 2.5 : 1) * (countNotes(c.A, 'idea', 30) >= 2 && lastTone(c.A) === 'dismiss' ? 0.2 : 1),
  run(c, say) {
    const { A } = c; const st = c.v.st || (c.v.st = {});
    if (!c.v.seed) { const I = interestsOf(A); const mine = CARDS.filter(x => G.unlocked.includes(x.id) && ((x.plat && I.plats.includes(x.plat)) || x.id === I.goal)); c.v.seed = (mine.length && chance(0.7) ? pick(mine) : pick(CARDS.filter(x => G.unlocked.includes(x.id)))).id; }
    const seed = card(c.v.seed);
    const prev = lastNote(A, 'idea');
    let text = say;
    if (!text) {
      const hook = prev && prev.tone === 'dismiss' ? `"I know last time you said to focus. But hear me out."` : vary('idea', [`"Okay. What if we used ${seed.name}?"`, `"I was in the shower and it hit me: ${seed.name}."`, `"I can't stop thinking about ${seed.name}. I think there's a paper in it."`, `"Did you see that arXiv paper on ${seed.name}? I think they missed something huge."`]);
      text = `${opener(A)} ${hook}`;
    }
    const ch = [];
    if (!st.why) ch.push(T(c, 'curious', A, 'Why do you think it would work?', 'Hear the pitch', () => { st.why = 1; const conv = has(A, 'ambitious') || has(A, 'dreamer') ? 'Their eyes are shining. They talk for four straight minutes.' : has(A, 'anxious') ? '"I mean, it probably won\'t. But maybe?" They have clearly thought about it a lot.' : 'They walk you through it on the back of an envelope. It hangs together.'; return EV.idea.run(c, `${conv} ${react(A, 'curious')}`); }));
    if (!st.need && seed.k === 'sys') ch.push(T(c, 'curious', A, 'What would we need to pull it off?', 'Check equipment', () => { st.need = 1; const miss = (seed.needs || []).filter(k => !G.equip[k]); return EV.idea.run(c, miss.length ? `"Honestly? We'd need a ${miss.map(k => EQUIP[k].name).join(' and a ')}. We don't have that."` : `"We have everything already. That's the beautiful part."`); }));
    ch.push(T(c, 'warm', A, 'Grab a marker. Let\'s brainstorm.', 'Opens the brainstorm board · −8 energy', () => brainstormNode(c, A, c.v.seed), { cost: { energy: 8 } }));
    ch.push(T(c, 'warm', A, 'Write it in the idea notebook for later.', `${A.first}'s morale ↑ a little`, () => { mod(A, { morale: 3 }); cul(1); return `${A.first} writes it down with three underlines and a doodle of an atom.`; }));
    if (!st.push) ch.push(T(c, 'dismiss', A, 'Focus on your current project.', `${A.first} may push back`, () => {
      st.push = 1;
      if (prev && prev.tone === 'dismiss') { mod(A, { morale: has(A, 'dreamer') ? -12 : -6, loyalty: -3 }); return withReact(A, 'dismiss', `"Right. Like last time." They won't bring you the next one.`); }
      const pushy = has(A, 'ambitious') || has(A, 'hothead') || has(A, 'dreamer') || (trust(A) > 0.3 && !has(A, 'anxious'));
      if (!pushy) { mod(A, { morale: -5, loyalty: -1 }); return withReact(A, 'dismiss', vary('idea_no', [`"Right. Yeah. Of course."`, `"Okay. Sorry." They close the notebook.`, `"No, you're right. Bad timing."`])); }
      const arg = has(A, 'hothead') ? `"With respect, that's what you said about the last idea that worked somewhere else." Their voice is a little too loud.` : has(A, 'ambitious') ? `"If we don't do it, someone else will. ${G.rivalName || 'Voss'}'s group would do it in a heartbeat."` : has(A, 'dreamer') ? `"Can I have ten percent of my time? Fridays. Just to see if it's crazy."` : `"Can I just show you one calculation? Five minutes."`;
      return N(A, `${A.first} doesn't let it go. ${arg}`, [
        T(c, 'warm', A, 'Fine. Fridays are yours. Show me in a month.', `${A.first}'s morale ↑ · their project slows a little`, () => { mod(A, { morale: 8, loyalty: 4 }); const p0 = projOf(A); if (p0) p0.progress = Math.max(0, p0.progress - 3); log(`${A.first} gets Fridays for ${seed.name}.`); return `"Thank you. You won't regret it." ${react(A, 'warm')}`; }),
        T(c, 'curious', A, 'Okay. Five minutes. Convince me.', 'Hear them out · may open the brainstorm', () => { const good = chance(0.35 + A.skill.theory * 0.04); if (good) return N(A, `The calculation is short and annoyingly convincing. ${A.first} watches your face. "See?"`, [T(c, 'warm', A, 'Okay, I see it. Grab a marker.', 'Opens the brainstorm board · −8 energy', () => brainstormNode(c, A, c.v.seed), { cost: { energy: 8 } }), T(c, 'firm', A, 'Good. Write it up as a one-pager and we\'ll revisit in the spring.', 'Morale ↑', () => { mod(A, { morale: 5 }); return `"A one-pager. I can do a one-pager."`; })]); mod(A, { morale: -2 }); return `Halfway through, ${A.first} finds a factor of two that kills it. "Oh. Oh no." They laugh at themselves. "Okay. Current project."`; }),
        T(c, 'firm', A, 'No means no. Current project.', `${A.first}'s morale ↓ · trust ↓`, () => { mod(A, { morale: has(A, 'dreamer') ? -12 : -7, loyalty: -4 }); return withReact(A, 'harsh', `"Understood."`); }),
      ]);
    }));
    return N(A, text, ch);
  },
};

export function brainstormNode(c, A, seed) {
  return {
    type: 'brainstorm', who: A, seed,
    done: ids => {
      if (!ids) { mod(A, { morale: -2 }); return `You both stare at the board. Nothing clicks today. ${A.first} erases it with a sigh.`; }
      const sc = scoreIdea(ids);
      const pr = makeProject(ids);
      let react2 = 0;
      if (has(A, 'ambitious') || has(A, 'dreamer')) react2 += (sc.nov - 5);
      if (has(A, 'anxious') || has(A, 'perfectionist')) react2 += (sc.feas - 5);
      if (has(A, 'skeptic') && sc.hype) react2 -= 4;
      if (sc.bad.length) react2 -= 4;
      if (ids.includes(c.v.seed)) react2 += 2;
      const fitNow = fitScore(A, { cards: ids }); react2 += fitNow >= 1.5 ? 3 : fitNow >= 1 ? 1.5 : fitNow < 0 ? -2 : 0;
      mod(A, { morale: clamp(react2 * 2, -8, 10) });
      if (G.equip.whiteboards) pr.hidden += 0.5;
      G.projects.push(pr);
      pr.stage = 'idea';
      const face = sc.bad.length ? `${A.first} hesitates. "${sc.bad[0]} Are you sure?"` : react2 > 2 ? `${A.first} is practically vibrating.` : react2 < -1 ? `${A.first} looks unconvinced.` : `${A.first} nods slowly.`;
      const miss = sc.missing.length ? ` We'd need: ${sc.missing.map(k => EQUIP[k].name).join(', ')}.` : '';
      return N(A, `"${pr.title}." ${face}${miss} Who should run it?`, [
        C(`You run it, ${A.first}.`, A.project ? `${A.first} leaves their current project` : 'Starts right away', () => { joinProject(A, pr); pr.stage = 'running'; mod(A, { morale: 5, loyalty: 3 }); note(A, 'ownsProject', 'warm'); log(`New project: ${pr.title}`); return `${A.first} is already sketching the setup on a napkin.`; }),
        C('Park it on the whiteboard. I\'ll staff it later.', 'Assign people in the Projects app', () => { log(`New idea parked: ${pr.title}`); return 'It goes up on the whiteboard under "SOMEDAY".'; }),
      ]);
    },
  };
}
EV.brainstorm = { kind: 'solo', run: c => brainstormNode(c, c.A, null) };

// --- Results ---
EV.results = {
  kind: 'solo',
  run(c, say) {
    const { A } = c; const pr = c.pr;
    if (!pr || pr.stage !== 'results') return null;
    const st = c.v.st || (c.v.st = {});
    const skept = pr.members.map(person).find(p => p && has(p, 'skeptic') && p !== A);
    let text = say;
    if (!text) {
      text = `${opener(A)} ` + vary('res', [`"${pr.title}. The data's in. It looks ${qWord(pr.q + int(-6, 6))}."`, `${A.first} drops a printout on your desk. "It worked. I think it worked. It looks ${qWord(pr.q + int(-6, 6))}."`, `"Can I show you something?" A plot fills their laptop screen. "It's ${qWord(pr.q + int(-6, 6))}."`]);
      if (pr.hype) text += ` "If this is real, it changes everything."`;
    }
    const ch = [];
    if (!st.walk) ch.push(T(c, 'curious', A, 'Walk me through the analysis.', 'Look for problems', () => {
      st.walk = 1;
      let t;
      if (pr.bug && (chance(0.55) || skept)) t = vary('bughint', ['"So I subtracted the background by eye, then fit it with... six free parameters." That is a lot of free parameters.', '"The calibration is from March. Things drifted a bit, but it should be fine." Should it?', '"One run looked weird so I left it out." Just one?']) + (skept ? ` ${skept.first} has been saying the same thing all week.` : '');
      else t = vary('cleanhint', ['Blind analysis, cross-checks, three calibrations. It looks careful.', 'They walk you through every step. You can\'t find a hole.', 'The residuals are flat. The error bars are honest. It holds up.']);
      return EV.results.run(c, t);
    }));
    if (!st.conf) ch.push(T(c, 'curious', A, 'How confident are you, honestly?', 'Their read depends on personality', () => {
      st.conf = 1;
      const t = has(A, 'anxious') ? `"Maybe... forty percent? I keep thinking I did something wrong."` : has(A, 'ambitious') ? `"A hundred percent. This is a Nature paper."` : has(A, 'perfectionist') ? `"I'd want one more control run before I'd bet on it."` : `"Pretty confident. ${pr.bug ? 'Mostly.' : 'It\'s held up to everything I\'ve thrown at it.'}"`;
      return EV.results.run(c, t);
    }));
    ch.push(T(c, 'warm', A, 'Let\'s write it up.', 'Pick a journal', () => journalNode(c, pr, A)));
    ch.push(T(c, 'firm', A, 'Dig deeper first. Make it bulletproof.', 'Quality ↑ · a few more weeks · scoop risk', () => { pr.stage = 'running'; pr.progress = 72; pr.qBonus = (pr.qBonus || 0) + int(6, 11); pr.digs++; if (pr.bug && chance(0.5)) pr.bug = false; mod(A, { stress: 6 }); return withReact(A, 'firm', has(A, 'ambitious') ? `"We'll get scooped while we dig!" But they go.` : `"More data, more plots. On it."`); }));
    ch.push(T(c, 'firm', A, 'Double-check everything. Every cable.', '−8 energy · catches mistakes', () => {
      if (pr.bug) { pr.bug = false; pr.stage = 'running'; pr.progress = 60; cul(2); mod(A, { morale: -4 }); return `Two days later: ${pick(['a loose BNC cable was injecting noise that looked like signal', 'the timestamps were off by one sample', 'the "signal" was the building\'s air conditioning'])}. The effect vanishes. Painful, but you just dodged a retraction.`; }
      pr.stage = 'running'; pr.progress = 94; mod(A, { morale: 3 }); return `You go through it line by line together. It holds up. It's real.`;
    }, { cost: { energy: 8 } }));
    return N(A, text, ch);
  },
};

const DEMANDS = ['a control experiment at a different temperature', 'a comparison with a theory nobody has heard of (the reviewer\'s own)', 'error bars on the error bars', 'a completely different experiment', 'that you cite fourteen papers by "a leading group in the field"', 'a 40-page supplement', 'that you explain why this is not "just engineering"'];
EV.review = {
  kind: 'solo',
  run(c) {
    const { A } = c; const pr = c.pr;
    if (!pr || pr.stage !== 'review') return null;
    const j = JOURNALS.find(x => x.id === pr.journal);
    const p = pr.revised ? Math.min(0.92, acceptChance(pr, j) + 0.35) : acceptChance(pr, j);
    const r = c.v.roll ?? (c.v.roll = rnd());
    if (r < p * 0.55 || (pr.revised && r < p)) { const paper = publish(pr, j); hooks.toast(`🎉 Accepted in ${j.short}!`, 'good'); return celebrate(c, pr, paper, A); }
    if (r < p) {
      const d = c.v.demand || (c.v.demand = pick(DEMANDS));
      return N(A, `${A.first} reads from the screen, deadpan: "${j.name}: major revisions. Reviewers 1 and 3 love it. Reviewer 2 wants ${d}."`, [
        T(c, 'curious', A, 'Read me Reviewer 2\'s exact words.', 'Gauge how hostile they are', () => N(A, `"'${pick(['While the authors are clearly enthusiastic', 'I fail to see the novelty', 'The authors should consider whether this is physics'])}...' and then two pages. But the last line says 'could be suitable after revision'."`, [
          T(c, 'firm', A, 'Then we give them what they want.', 'Likely acceptance', () => { pr.revised = true; pr.decideWeek = G.week + int(4, 6); pr.qBonus = (pr.qBonus || 0) + 3; mod(A, { stress: 8 }); return `"Fine. FINE." ${A.first} opens a folder called "reviewer2_final_FINAL".`; }),
          T(c, 'firm', A, 'We push back. Politely.', '−12 energy · ~60% accepted now', () => { if (chance(0.6)) { const paper = publish(pr, j); return celebrate(c, pr, paper, A); } pr.stage = 'results'; mod(A, { morale: -10 }); return journalNode(c, pr, A, j.bar, 'Reviewer 2 was not persuaded. Rejected. '); }, { cost: { energy: 12 } }),
        ])),
        T(c, 'firm', A, 'Do the extra work. Give Reviewer 2 everything.', 'Few weeks · likely acceptance', () => { pr.revised = true; pr.decideWeek = G.week + int(4, 6); pr.qBonus = (pr.qBonus || 0) + 3; mod(A, { stress: 8 }); return `"Fine. FINE." ${A.first} opens a folder called "reviewer2_final_FINAL".`; }),
        T(c, 'firm', A, 'Withdraw and send it somewhere else.', 'Pick a less selective journal', () => { pr.stage = 'results'; return journalNode(c, pr, A, j.bar); }),
      ]);
    }
    mod(A, { morale: has(A, 'anxious') ? -12 : -7 });
    const feel = has(A, 'hothead') ? `"They didn't even READ it."` : has(A, 'anxious') ? `${A.first}'s voice is small. "I'm sorry. I should have done more."` : `"The editor says it's 'not of sufficiently broad interest'."`;
    return N(A, `${A.first} closes the laptop. ${j.name} rejected it. ${feel}`, [
      T(c, 'warm', A, 'Rejection is normal. Every great paper has a pile of them.', 'Morale back up · then pick a journal', () => { mod(A, { morale: 6, stress: -4 }); return journalNode(c, pr, A, j.bar, `${react(A, 'warm')} `); }),
      T(c, 'firm', A, 'Improve it and try the same journal again.', 'More work · quality ↑', () => { pr.stage = 'running'; pr.progress = 78; pr.qBonus = (pr.qBonus || 0) + 6; return `"Okay. We go again." That's the spirit.`; }),
      T(c, 'dismiss', A, 'Post it on arXiv and move on.', '+2 rep', () => { publish(pr, JOURNALS[0]); return 'Out it goes. The citations will come (maybe).'; }),
    ]);
  },
};

EV.scooped = {
  kind: 'solo',
  run(c, say) {
    const { A } = c; const pr = c.pr;
    if (!pr || pr.stage !== 'running') return null;
    const st = c.v.st || (c.v.st = {});
    if (st.overlap === undefined) { st.overlap = rnd(); mod(A, { morale: -10, stress: 8 }); }
    const ch = [];
    if (!st.read) ch.push(T(c, 'curious', A, 'Calm down. How much did they actually do?', 'Read their paper together', () => { st.read = 1; return EV.scooped.run(c, st.overlap < 0.45 ? `You read it together. It's... not that close. They used a different regime, and they missed the effect ${A.first} saw in March. "Wait. We're fine?"` : `You read it together. It's close. Uncomfortably close. Their figure 3 is basically our figure 3.`); }));
    ch.push(T(c, 'firm', A, 'Rush what we have onto arXiv tonight.', 'Small paper now · project ends', () => { pr.q = 25 + pr.progress * 0.35; publish(pr, JOURNALS[0]); return 'Posted at 1:58pm, two minutes before the cutoff. At least you are on the record.'; }));
    ch.push(T(c, 'warm', A, 'Pivot. Find the angle they missed.', st.read && st.overlap < 0.45 ? 'Easy pivot: keeps nearly everything' : '−10 energy · keeps most progress · novelty ↓', () => { const easy = st.read && st.overlap < 0.45; pr.nov = Math.max(1, pr.nov - (easy ? 0 : 2)); pr.progress *= easy ? 0.95 : 0.6; mod(A, { morale: easy ? 12 : 6 }); return easy ? `${A.first} grins. "They did the boring half."` : `An hour of picking their paper apart. They missed something. ${A.first} starts to smile.`; }, { cost: { energy: 10 } }));
    ch.push(T(c, 'firm', A, 'Email Voss and propose a collaboration.', 'Progress ↑ · shared credit', () => { pr.rivalCollab = true; pr.progress = Math.min(99, pr.progress + 20); G.rival.rel += 10; if (has(A, 'ambitious')) mod(A, { morale: -8 }); return `Voss replies within the hour: "Delighted. Let's talk." It feels like losing a chess game politely.${has(A, 'ambitious') ? ` ${A.first} looks betrayed.` : ''}`; }));
    ch.push(T(c, 'dismiss', A, 'Shelve it.', 'Frees the team', () => { pr.stage = 'scooped'; for (const id of pr.members) { const p = person(id); if (p) { p.project = null; mod(p, { morale: -8 }); } } pr.members = []; return 'It goes into the "what could have been" folder.'; }));
    return N(A, say || `${opener(A)} "Voss's group just posted to arXiv. It's basically our project. ${pr.title}. We got scooped."`, ch);
  },
};

// --- Wellbeing ---
EV.burnout = {
  kind: 'solo', cd: 8, w: c => c.A.stress > 72 ? 12 : 0,
  run(c, say) {
    const { A } = c; const st = c.v.st || (c.v.st = {});
    const prev = lastNote(A, 'burnout');
    if (!st.cause) {
      const foe = worstRel(A); const pr = projOf(A);
      const harshYou = memOf(A).tones.slice(0, 4).filter(t => t === 'harsh' || t === 'firm').length >= 2;
      st.cause = harshYou ? 'you' : foe && chance(0.6) ? 'person' : pr && (pr.feas < 5 || pr.members.length === 1) ? 'project' : chance(0.5) ? 'home' : 'project';
      st.foe = foe ? foe.id : null;
    }
    const foe = st.foe && person(st.foe); const pr = projOf(A);
    let text = say;
    if (!text) {
      text = opener(A) + ' ';
      text += prev && prev.tone === 'harsh' ? `"This is the second time I've been here like this. Last time you told me to push through. I did. It didn't work."` : prev ? `"I thought I was better after last time. I'm not."` : vary('burn', [`"I haven't slept properly in weeks. I keep staring at the same plot. I think I'm... not okay."`, `"I cried in the cold room yesterday. Twice."`, `"I can't remember the last weekend I took off."`]);
    }
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', A, 'What\'s really going on?', 'Find the cause', () => {
      st.asked = 1;
      const why = st.cause === 'you' ? `A long pause. "Honestly? Every time I come in here, I leave feeling like I'm failing. The way you talk to me."` : st.cause === 'person' && foe ? `"It's ${foe.first}. Every day is a fight. I dread coming in."` : st.cause === 'home' ? `"Things at home are hard. Family stuff. And then the lab on top of it."` : `"${pr ? `"${pr.title}"` : 'The project'} is just... too much for one person. I'm drowning."`;
      return EV.burnout.run(c, why);
    }));
    if (st.asked && st.cause === 'you') ch.push(T(c, 'warm', A, 'I\'m sorry. I\'ve been too hard on you. That changes now.', '✦ The real fix · trust ↑↑', () => { mod(A, { stress: -25, loyalty: 15, morale: 10 }); cul(4); memOf(A).tones.splice(0, 4); return `${A.first} wasn't expecting that. "...Thank you. That actually means a lot."`; }));
    if (st.asked && st.cause === 'person' && foe) ch.push(T(c, 'warm', A, `I'll talk to ${foe.first}. Give me two weeks.`, '✦ A promise: they will check', () => { mod(A, { stress: -12, loyalty: 6 }); promise(A, 'talkTo', 3, { B: foe.id }); return `"You'd do that?" Hope, and a little doubt. (Call ${foe.first} in for a 1:1 before ${A.first} checks back.)`; }));
    if (st.asked && st.cause === 'project' && pr) ch.push(T(c, 'warm', A, 'Let\'s get you help on the project.', '✦ Add a teammate in the Projects app', () => { mod(A, { stress: -15, loyalty: 5 }); promise(A, 'help', 4, { proj: pr.id, size: pr.members.length }); return `"Really? Yes. Please." (Add someone to "${pr.title}" before they check back.)`; }));
    if (st.asked && st.cause === 'home') ch.push(T(c, 'warm', A, 'Family comes first. Take what you need, flexibly.', '✦ Flexible hours · stress ↓↓', () => { mod(A, { stress: -28, loyalty: 12 }); A.away = 1; cul(3); return `${A.first} nods, eyes wet. "I'll be back on Monday."`; }));
    ch.push(T(c, 'warm', A, 'Take two weeks off. Seriously. The project will wait.', 'Stress ↓↓ · away 2 weeks · culture ↑', () => { A.away = 2; mod(A, { stress: -40, morale: 10, loyalty: 8 }); cul(3); return withReact(A, 'warm', `They look like they might cry from relief.`); }));
    ch.push(T(c, 'warm', A, 'Let\'s cut your load in half for a while.', 'Stress ↓ · progress ↓ · they\'ll report back', () => { mod(A, { stress: -18, morale: 4, loyalty: 4 }); if (pr) pr.progress = Math.max(0, pr.progress - 5); promise(A, 'loadcut', 4); return 'You move two of their tasks onto your own list.'; }));
    ch.push(T(c, 'harsh', A, 'Push through. This deadline matters.', 'Progress ↑ · stress ↑↑ · culture ↓', () => { mod(A, { stress: 12, morale: -10, loyalty: -10 }); cul(-5); if (pr && pr.stage === 'running') pr.progress = Math.min(99, pr.progress + 8); if (A.stress > 85 || prev) A.flags.wantsOut = true; return withReact(A, 'harsh', `"...Okay." The door closes very quietly.`); }));
    return N(A, text, ch);
  },
};

const COMPANIES = ['a hedge fund', 'a quantum computing startup', 'Big Search Engine Inc.', 'a self-driving car company', 'a defense contractor', 'a chip manufacturer', 'a climate-tech startup'];
EV.quit = {
  kind: 'solo', cd: 10, w: c => (c.A.morale < 28 ? 8 : 0) + (has(c.A, 'industry') && c.A.weeks > 30 ? 0.6 : 0) + (c.A.flags.wantsOut ? 6 : 0),
  run(c, say) {
    const { A } = c; const st = c.v.st || (c.v.st = {});
    if (!st.co) {
      st.co = pick(COMPANIES); st.sal = int(14, 38) * 10000;
      const foe = worstRel(A);
      st.why = A.stress > 65 ? 'burnout' : foe && relOf(A, foe) < -40 ? 'person' : !A.project || A.morale < 30 && chance(0.4) ? 'bored' : has(A, 'industry') || chance(0.4) ? 'money' : 'career';
      st.foe = foe ? foe.id : null;
    }
    const leave = why => { removePerson(A, `left for ${st.co}`); return why; };
    const match = (k, p) => st.why === k ? 0.9 : p;
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', A, 'What\'s really behind this?', 'Find their reason', () => {
      st.asked = 1;
      const foe = st.foe && person(st.foe);
      const t = { burnout: `"I'm exhausted. I don't think I can do five more years of this pace."`, person: `"Honestly? It's ${foe ? foe.first : 'someone here'}. I can't work with them anymore."`, bored: `"I'm bored. I don't feel like I'm doing anything that matters."`, money: `"My student loans. My parents need help. It's a lot of money."`, career: `"I'm not sure academia wants me. At least they do."` }[st.why];
      return EV.quit.run(c, t);
    }));
    ch.push(T(c, 'warm', A, 'I understand. I\'ll write you a glowing letter.', `${A.first} leaves · culture ↑`, () => { cul(3); addRep(1); return leave('A hug, a promise to stay in touch, and a desk that will feel empty for a while.'); }));
    ch.push(T(c, 'warm', A, 'Let\'s give you your own project. Something that matters.', st.asked ? (st.why === 'bored' ? '✦ Matches their reason' : 'Doesn\'t address their reason') : 'Might work', () => { if (chance(match('bored', 0.35))) { mod(A, { morale: 22, loyalty: 12 }); A.flags.wantsOut = false; promise(A, 'counter', 6); return `"...Okay. Let's try." Back to the whiteboard.`; } return leave(`"I appreciate it. But it's not about the project." They leave at the end of the month.`); }));
    ch.push(T(c, 'warm', A, 'I can find a $15k retention bonus in the grant.', st.asked ? (st.why === 'money' ? '✦ Matches their reason · −$15,000' : 'Doesn\'t address their reason · −$15,000') : '−$15,000', () => { G.money -= 15000; if (chance(match('money', 0.4))) { mod(A, { morale: 15, loyalty: 8 }); A.flags.wantsOut = false; promise(A, 'counter', 6); return `They stay. The grant's travel budget does not.`; } return leave(`They take the money seriously, think about it overnight, and still go.`); }, { cost: { money: 15000 } }));
    if (st.asked && st.why === 'burnout') ch.push(T(c, 'warm', A, 'Take a month. Then we redesign your workload together.', '✦ Matches their reason', () => { A.away = 3; mod(A, { stress: -45, loyalty: 14, morale: 10 }); A.flags.wantsOut = false; promise(A, 'counter', 8); return `"A month?" They exhale. "I didn't think I was allowed to ask for that."`; }));
    if (st.asked && st.why === 'person' && st.foe) { const foe = person(st.foe); if (foe) ch.push(T(c, 'warm', A, `I'll move you off ${foe.first}'s project and talk to them.`, '✦ Matches their reason', () => { if (foe.project && foe.project === A.project) joinProject(A, null); mod(A, { morale: 14, loyalty: 10 }); A.flags.wantsOut = false; promise(A, 'talkTo', 3, { B: foe.id }); return `"That would change everything." (Have a 1:1 with ${foe.first} soon.)`; })); }
    if (st.asked && st.why === 'career') ch.push(T(c, 'warm', A, 'Academia wants you. Let me prove it: you give the next invited talk.', '✦ Matches their reason · rep ↑', () => { mod(A, { morale: 18, loyalty: 10 }); A.flags.wantsOut = false; addRep(2); promise(A, 'counter', 8); return `${A.first} sits up straighter. "Okay. Okay!"`; }));
    ch.push(T(c, 'harsh', A, 'Leaving now throws away years of work.', 'Guilt trip · culture ↓', () => { cul(-5); if (chance(0.4)) { mod(A, { loyalty: -15, morale: -5 }); A.flags.wantsOut = false; return withReact(A, 'harsh', `They stay. They are not happy about it.`); } return leave(`"That's exactly why I need to go." Ouch.`); }));
    return N(A, say || `${opener(A)} "I got an offer from ${st.co}. ${fmt$(st.sal)} a year. I... I'm thinking of leaving."`, ch);
  },
};

EV.imposter = {
  kind: 'solo', cd: 14, w: c => (has(c.A, 'anxious') ? 2 : 0.4) * (c.A.stress > 40 ? 1.5 : 0.5),
  run(c) {
    const { A } = c;
    const followUp = (t) => N(A, t, [
      T(c, 'warm', A, 'Present your work at group meeting next week. I\'ll be in the front row.', 'Confidence ↑ · a little scary', () => { mod(A, { morale: 8, stress: has(A, 'anxious') ? 4 : -2 }); A.skill.theory = clamp(A.skill.theory + (chance(0.5) ? 1 : 0), 1, 10); return `They gulp, then nod. The talk goes better than they expect.`; }),
      T(c, 'warm', A, 'Want to meet weekly for a while? Just us.', '−4 energy each week for a while · loyalty ↑↑', () => { mod(A, { loyalty: 12, stress: -8 }); promise(A, 'loadcut', 5); return `"I'd really like that."`; }),
      C('That\'s all for now.', '', () => `They leave a little lighter.`),
    ]);
    return N(A, `${opener(A)} "Can I be honest? Everyone in group meeting seems so much smarter than me. I think admissions made a mistake."`, [
      T(c, 'warm', A, 'Tell them about the time you failed your qualifying exam.', '−5 energy · stress ↓↓ · opens up', () => { mod(A, { stress: -16, loyalty: 8, morale: 6 }); cul(2); return followUp(`"Wait. YOU failed your quals?" They laugh, properly, for the first time in weeks. Then, quietly: "So what helped?"`); }, { cost: { energy: 5 } }),
      T(c, 'curious', A, 'Who specifically makes you feel that way?', 'Find out more', () => { const b = bestRel(A) || pick(team().filter(p => p !== A)); return followUp(b ? `"${b.first}, mostly. They make everything look easy." You happen to know ${b.first} said the same thing about ${A.first} last month. You tell them.` : `"Everyone. No one. I don't know."`); }),
      T(c, 'warm', A, 'Let\'s look at what you\'ve actually done.', 'Better if they have results', () => { const d = A.papers > 0 || A.skill.exp + A.skill.theory + A.skill.code > 16 ? -14 : -4; mod(A, { stress: d, morale: -d / 2 }); return d < -5 ? followUp(`You pull up their plots. Seeing it laid out, they sit up a bit straighter.`) : `There isn't much on the list yet. "...Right." It didn't quite land.`; }),
      T(c, 'dismiss', A, 'Everyone feels that way. Back to work.', 'Quick · slightly worse', () => { mod(A, { stress: 3, morale: -3 }); return withReact(A, 'dismiss', `"Yeah. Sure."`); }),
    ]);
  },
};

EV.switch = {
  kind: 'solo', cd: 16, w: c => c.A.project && c.A.morale < 55 && G.projects.filter(p => (p.stage === 'running' || p.stage === 'idea') && p.id !== c.A.project).length ? 1 : 0,
  run(c, say) {
    const { A } = c; const cur = projOf(A); const st = c.v.st || (c.v.st = {});
    if (!st.other) { const o = pick(G.projects.filter(p => (p.stage === 'running' || p.stage === 'idea') && p.id !== A.project)); if (!o) return null; st.other = o.id; const foe = cur && cur.members.map(person).find(p => p && p !== A && relOf(A, p) < -25); st.why = foe ? 'person' : cur && equipFactorLow(cur) ? 'stuck' : 'bored'; st.foe = foe ? foe.id : null; }
    const other = proj(st.other); if (!other) return null;
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', A, 'What\'s wrong with your current project?', 'Find out', () => { st.asked = 1; const foe = st.foe && person(st.foe); return EV.switch.run(c, st.why === 'person' && foe ? `"Working with ${foe.first} is... hard. We disagree about everything."` : st.why === 'stuck' ? `"We don't have the equipment. I spend my days waiting for borrowed time."` : `"It's fine. It's just not exciting anymore."`); }));
    ch.push(T(c, 'warm', A, 'Sure, go for it.', `${A.first} moves projects · morale ↑`, () => { joinProject(A, other); if (other.stage === 'idea') other.stage = 'running'; mod(A, { morale: 12 }); return `They practically skip out of the office.`; }));
    ch.push(T(c, 'firm', A, 'Finish this one first. Then you can switch. I promise.', 'Morale ↓ now · they will remember', () => { mod(A, { morale: -6 }); A.flags.promisedSwitch = G.week; return withReact(A, 'firm', `"Fine. Deal." They shake on it.`); }));
    if (st.asked && st.why === 'stuck' && cur) { const miss = projNeeds(cur.cards).find(k => !G.equip[k]); if (miss) ch.push(T(c, 'warm', A, `What if I get us a ${EQUIP[miss].name}?`, `✦ ${fmtK(EQUIP[miss].cost)} · fixes the real problem`, () => { G.money -= EQUIP[miss].cost; G.equip[miss] = true; hooks.worldSync(); mod(A, { morale: 18 }); return `"Wait, really?" They stay. Happily.`; }, { cost: { money: EQUIP[miss].cost } })); }
    ch.push(T(c, 'warm', A, 'Let\'s come up with something new, just for you.', 'Brainstorm · −8 energy', () => brainstormNode(c, A, pick(G.unlocked)), { cost: { energy: 8 } }));
    return N(A, say || `${opener(A)} "I've been on ${cur ? `"${cur.title}"` : 'this'} for months. Could I switch to "${other.title}"?"`, ch);
  },
};
const equipFactorLow = pr => projNeeds(pr.cards).some(k => !G.equip[k]);

// --- Accidents & equipment ---
const ACC = {
  optics: 'I was swapping a mirror mount and bumped the fiber coupler. Coupling went from 70% to 3%. The whole beam path needs realigning.',
  vacuum: 'I opened the gate valve before the turbo pump spun down. The pressure went to atmosphere. We\'ll have to bake the chamber for a week.',
  fridge: 'The fridge warmed up overnight. The pulse-tube compressor tripped and I didn\'t see the alarm. Cooling back down takes days.',
  cryostat: 'The magnet quenched while I was ramping the field. Half the liquid helium boiled off in a minute. The room fogged up.',
  fab: 'I contaminated the e-beam resist. Every chip from this week is ruined, and the bay needs a full clean.',
  stm: 'I crashed the STM tip into the sample. The tip is destroyed and the sample has a crater.',
  cluster: 'I ran `rm -rf` in the wrong folder on the cluster. Some of the shared data is gone.',
};
EV.accident = {
  kind: 'solo', cd: 10,
  w: c => { const ks = usedEquip(c.A).filter(k => ACC[k] && !G.broken[k]); return ks.length ? (has(c.A, 'chaotic') ? 2 : 0.5) * (c.A.role === 'undergrad' ? 1.6 : 1) * (G.flags.clean > G.week ? 0.6 : 1) : 0; },
  run(c, say) {
    const { A } = c; const st = c.v.st || (c.v.st = {});
    if (!st.k) { const ks = usedEquip(A).filter(k => ACC[k] && !G.broken[k]); if (!ks.length) return null; st.k = pick(ks); const mates = (projOf(A) || { members: [] }).members.map(person).filter(p => p && p !== A); st.cause = chance(0.25) ? 'old' : mates.length && chance(0.2) ? 'other' : 'mistake'; st.other = mates.length ? pick(mates).id : null; if (st.cause === 'other' && !st.other) st.cause = 'mistake'; }
    const k = st.k, eq = EQUIP[k];
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', A, 'Okay. Walk me through exactly what happened.', 'Calm questions', () => {
      st.asked = 1; const o = st.other && person(st.other);
      return EV.accident.run(c, st.cause === 'old' ? `"The log shows warning alarms for three weeks before. The ${k === 'fridge' ? 'compressor' : k === 'vacuum' ? 'valve controller' : k === 'cryostat' ? 'level meter' : 'part'} was already failing. I just happened to be there when it went."` : st.cause === 'other' && o ? `"I came in and ${o.first} had left it in a weird state. Nothing was in the logbook. I didn't check before starting."` : `"I was rushing. I skipped a step on the checklist. It's my fault."`);
    }));
    if (st.asked && st.cause === 'old') ch.push(T(c, 'warm', A, 'That\'s not on you. We\'ll set up a maintenance plan.', '✦ −$12,000 · down 2 weeks · fewer failures later', () => { G.money -= 12000; G.broken[k] = 2; G.flags.clean = G.week + 30; mod(A, { loyalty: 10, stress: -10 }); cul(4); return `${A.first} exhales. A maintenance spreadsheet appears that afternoon.`; }));
    if (st.asked && st.cause === 'other' && st.other) { const o = person(st.other); if (o) ch.push(T(c, 'firm', [A, o], `New rule: everything goes in the logbook. I'll talk to ${o.first}.`, `✦ Down 3 weeks · fairer · ${o.first} ↓ a little`, () => { G.broken[k] = 3; mod(o, { morale: -4 }); mod(A, { loyalty: 8 }); cul(3); G.flags.clean = G.week + 20; return `A fresh logbook appears on every bench. ${o.first} is embarrassed but agrees.`; })); }
    ch.push(T(c, 'warm', A, 'Thank you for telling me right away. We\'ll fix it together.', `${eq.name} down 3 weeks · −$5,000 · culture ↑↑`, () => { G.broken[k] = 3; G.money -= 5000; cul(6); mod(A, { loyalty: 10, stress: -5 }); return withReact(A, 'warm', `Word will get around that it's safe to own up to mistakes here.`); }));
    ch.push(T(c, 'firm', A, 'Pay for express repair.', `−${G.equip.service ? '$6,000 (service contract)' : '$20,000'} · no downtime`, () => { G.money -= G.equip.service ? 6000 : 20000; cul(2); mod(A, { stress: -4 }); return `A technician arrives the next morning. Expensive, but nothing stops.`; }, { cost: { money: G.equip.service ? 6000 : 20000 } }));
    ch.push(T(c, 'harsh', A, 'How could you be so careless?!', `Down 4 weeks · ${A.first} crushed · culture ↓↓`, () => { G.broken[k] = 4; cul(-9); mod(A, { morale: -16, stress: 14, loyalty: -8 }); return withReact(A, 'harsh', st.cause === 'old' ? `${A.first} leaves without a word. Later you find the alarm log. It wasn't their fault.` : `${A.first} leaves without a word. Next time something breaks, people might not tell you.`); }));
    return N(A, say || `${opener(A)} "${ACC[k]} I'm so sorry."`, ch);
  },
};

const ALT = {
  fridge: ['Send samples to the national magnet lab for measurements', 8000],
  cryostat: ['Send samples to the national magnet lab for measurements', 8000],
  cluster: ['Buy cloud computing credits', 8000],
  fab: ['Pay for hours at the university\'s shared nanofab', 9000],
  optics: ['Rent a laser system for a few months', 9000],
  vacuum: ['Rent beamtime on a national-lab vacuum setup', 8000],
  stm: ['Book time on the national lab\'s STM', 7000],
};
EV.equipreq = {
  kind: 'solo', cd: 12,
  w: c => { const pr = projOf(c.A); if (!pr) return 0; return projNeeds(pr.cards).some(k => !G.equip[k] && !borrowing(k)) ? 4 : 0; },
  run(c) {
    const { A } = c; const pr = projOf(A); if (!pr) return null;
    const k = projNeeds(pr.cards).find(x => !G.equip[x] && !borrowing(x)); if (!k) return null;
    const e = EQUIP[k]; const alt = ALT[k];
    const owner = (G.profs || []).find(f => f.equip.includes(k));
    const ch = [
      T(c, 'warm', A, `Buy the ${e.name}.`, `−${fmtK(e.cost)} · +${fmt$(e.upkeep)}/wk upkeep`, () => { G.money -= e.cost; G.equip[k] = true; hooks.worldSync(); refreshUnlocks(); mod(A, { morale: 15 }); log(`Bought ${e.name}.`); return `Weeks later a crate arrives. ${A.first} unboxes it like it's a birthday.`; }, { cost: { money: e.cost } }),
    ];
    if (owner) ch.push(T(c, 'warm', A, `I'll ask Prof. ${owner.last} if we can borrow time on theirs.`, `Depends on your relationship with ${owner.first} (${owner.rel >= 55 ? 'good' : owner.rel >= 40 ? 'okay' : 'poor'})`, () => { queueVisit({ ev: 'prof_borrow', ext: 'prof', prof: owner.id, k, pri: 3 }, true); promise(A, 'equipAsk', 5, { k }); return `"That would be amazing." (Prof. ${owner.last} will come by.)`; }));
    if (alt) ch.push(T(c, 'warm', A, alt[0] + '.', `−${fmt$(alt[1])} · progress ↑ once`, () => { G.money -= alt[1]; pr.progress = Math.min(99, pr.progress + 12); mod(A, { morale: 4 }); return `It's slow and clunky, but data comes back.`; }, { cost: { money: alt[1] } }));
    ch.push(T(c, 'curious', A, 'What exactly would it let you do that you can\'t now?', 'Hear the case', () => N(A, vary('eqwhy', [`"Right now I take one data point a day. With the ${e.name}, maybe twenty. I made a plot." They have, in fact, made a plot.`, `"Every measurement is limited by not having it. I've been working around it for months. Here's my list of workarounds." The list is long.`, `"Honestly? It's the difference between a thesis chapter and a footnote."`]), ch.filter(x => !/^What exactly/.test(x.t)))));
    ch.push(T(c, 'dismiss', A, 'Not this year. Make do.', 'They may propose something', () => {
      if (has(A, 'handson') || has(A, 'coder') || has(A, 'chaotic')) return N(A, `"Okay. Then can I try to build a cheap version myself? I found a design online. It's held together with optimism."`, [
        T(c, 'warm', A, 'Do it. Spend up to $2,000.', '−$2,000 · progress ↑ · small accident risk', () => { G.money -= 2000; pr.progress = Math.min(99, pr.progress + 8); mod(A, { morale: 8, skill: { exp: 1 } }); if (chance(0.15)) { mod(A, { stress: 6 }); return `It works for nine days, then catches fire, very slightly. The data from those nine days is good.`; } return `It looks like a science fair project and works shockingly well.`; }, { cost: { money: 2000 } }),
        T(c, 'firm', A, 'No home-built hacks on a real experiment.', 'Morale ↓', () => { mod(A, { morale: -6 }); return withReact(A, 'firm', `"Fine."`); }),
      ]);
      mod(A, { morale: has(A, 'anxious') ? -4 : -7 });
      return withReact(A, 'dismiss', vary('eqno', [`"Okay."`, `"Okay. I'll make do." They will, slowly.`, `"Right. Back to waiting, then."`]));
    }));
    const eqOpen = has(A, 'anxious') ? `"I'm really sorry to ask, I know money is tight, but my project needs a ${e.name}."` : has(A, 'hothead') ? `"I need a ${e.name}. I've needed one for a month."` : has(A, 'perfectionist') ? `"I've written a one-page justification for a ${e.name}. Can I walk you through it?"` : vary('eqopen', [`"About my project. It needs a ${e.name} and we don't have one."`, `"Can we talk about equipment? Specifically, a ${e.name}."`, `"I did the math. Without a ${e.name}, my project takes three more years."`]);
    return N(A, `${opener(A)} ${eqOpen} ${vary('eqr', ['"It\'s crawling."', '"I spend most days waiting."', '"We\'re basically stuck."', '"Any chance?"'])}`, ch);
  },
};

const WEIRD = {
  optics: ['the building\'s air conditioning cycling', 'the 7:15 freight train'], vacuum: ['the ion pump\'s power supply', 'the elevator'],
  fridge: ['the pulse tube\'s 1.4 Hz thump', 'the cooling water temperature'], cryostat: ['the liquid helium level dropping', 'the magnet power supply'],
  fab: ['which resist batch we used'], stm: ['footsteps in the corridor', 'the lab next door\'s vacuum pumps'],
  cluster: ['a cosmic-ray bit flip in GPU memory', 'a random seed that isn\'t random'], none: ['a bug in the time-stamping code', 'the day of the week (??)'],
};
EV.weird = {
  kind: 'solo', cd: 14, w: c => { const pr = projOf(c.A); return pr && pr.stage === 'running' && pr.progress > 20 ? 1 : 0; },
  run(c) {
    const { A } = c; const pr = projOf(A); if (!pr || pr.stage !== 'running') return null;
    const eqs = usedEquip(A); const pool = eqs.flatMap(k => WEIRD[k] || []);
    const cause = c.v.cause || (c.v.cause = G.equip.cat && chance(0.25) ? 'Schrödinger the cat sitting on the bench' : pick(pool.length ? pool : WEIRD.none));
    return N(A, `${opener(A)} "Something weird. There's a periodic signal in the data. I think it correlates with ${cause}."`, [
      T(c, 'curious', A, 'Track it down. Leave no stone unturned.', 'Progress ↓ a bit · fewer errors later', () => { pr.progress = Math.max(0, pr.progress - 6); pr.bugAdj = (pr.bugAdj || 0) - 0.12; mod(A, { morale: has(A, 'skeptic') ? 8 : 2 }); const k = card(pr.cards[0]).mode; A.skill[k] = clamp(A.skill[k] + 1, 1, 10); return `Four days of detective work. They find it and fix it, and learn more about the apparatus than any course could teach.`; }),
      T(c, 'firm', A, 'Subtract it in post-processing.', 'Progress ↑ · risk of errors', () => { pr.progress = Math.min(99, pr.progress + 4); pr.bugAdj = (pr.bugAdj || 0) + 0.1; return has(A, 'skeptic') ? `"...Fine." ${A.first} clearly thinks this is a mistake.` : `A quick filter and it's gone. Probably fine. Probably.`; }),
      T(c, 'warm', A, 'What if it\'s NEW PHYSICS?', 'Novelty ↑ · big risk', () => { pr.nov = Math.min(10, pr.nov + 1); pr.hidden += chance(0.15) ? 4 : 0; pr.bugAdj = (pr.bugAdj || 0) + 0.2; mod(A, { morale: has(A, 'dreamer') ? 14 : 6 }); return has(A, 'skeptic') ? `${A.first} stares at you. "It's ${cause}. It is definitely ${cause}."` : `${A.first}'s eyes go wide. A new whiteboard gets wheeled in.`; }),
    ]);
  },
};

const CONFS = ['the APS March Meeting', 'DAMOP', 'a Gordon Research Conference', 'a summer school in the Alps', 'a workshop in Kyoto', 'QIP'];
EV.conference = {
  kind: 'solo', cd: 20, w: c => c.A.role !== 'undergrad' && c.A.project ? 0.7 : 0.1,
  run(c) {
    const { A } = c; const conf = c.v.conf || (c.v.conf = pick(CONFS));
    const last = lastNote(A, 'conference');
    return N(A, `${opener(A)} "${conf} is coming up. Could I go? ${last && last.tone === 'dismiss' ? 'You said next year, last year.' : vary('conf', ['I\'d love to present our work.', 'Everyone in my field will be there.', 'There\'s a session that\'s basically about my project.'])}"`, [
      T(c, 'warm', A, 'Go, and give a talk.', '−$2,500 · rep ↑ · morale ↑ · new ideas', () => { G.money -= 2500; A.away = 1; addRep(2); mod(A, { morale: 10, stress: -5 }); const u = unlockCards(shuffle(CARDS.filter(x => !G.unlocked.includes(x.id))).slice(0, 2).map(x => x.id), 'the conference', true); return `${A.first} comes back with a sunburn, three new collaborators and a lot of opinions.${u.length ? ` They can't stop talking about ${u.map(id => card(id).name).join(' and ')}.` : ''}`; }, { cost: { money: 2500 } }),
      T(c, 'warm', A, 'Go and bring a poster.', '−$1,500 · morale ↑ · a new idea', () => { G.money -= 1500; A.away = 1; addRep(1); mod(A, { morale: 6 }); const u = unlockCards(shuffle(CARDS.filter(x => !G.unlocked.includes(x.id))).slice(0, 1).map(x => x.id), 'the conference', true); return `The poster session was packed.${u.length ? ` ${A.first} came back excited about ${card(u[0]).name}.` : ''}`; }, { cost: { money: 1500 } }),
      T(c, 'dismiss', A, 'Not this year, the budget is tight.', last && last.tone === 'dismiss' ? 'They will take this badly' : 'Morale ↓', () => { mod(A, { morale: last && last.tone === 'dismiss' ? -14 : -6, loyalty: last ? -6 : 0 }); return withReact(A, 'dismiss', last && last.tone === 'dismiss' ? `"Again." It's not a question.` : `"Okay. Next year, maybe."`); }),
    ]);
  },
};

const FELLOWS = ['NSF Graduate Research Fellowship', 'Hertz Fellowship', 'DOE Computational Science Fellowship', 'Marie Curie Fellowship', 'Simons Postdoctoral Fellowship'];
EV.letter = {
  kind: 'solo', cd: 30, w: c => (c.A.role === 'grad' && c.A.yearIn <= 2) || c.A.role === 'postdoc' ? (c.A.flags.letter ? 0 : 1.2) : 0,
  run(c) {
    const { A } = c; const f = c.v.f || (c.v.f = pick(FELLOWS)); A.flags.letter = true;
    const base = 0.08 + (A.skill.exp + A.skill.theory + A.skill.code) * 0.012 + A.papers * 0.05 + (c.v.extra || 0);
    const apply = (p, txt) => { G.flags.fellows = G.flags.fellows || []; G.flags.fellows.push({ id: A.id, p, week: G.week + int(8, 12), f }); return txt; };
    const ch = [];
    if (!c.v.asked) ch.push(T(c, 'curious', A, 'Tell me what makes your application stand out.', 'Better letter material', () => { c.v.asked = 1; c.v.extra = 0.05; return N(A, `${has(A, 'anxious') ? '"Um. Nothing?" You push. Eventually: ' : ''}"I built the ${pick(['laser lock', 'analysis pipeline', 'sample transfer', 'simulation code'])} that the whole lab uses now." That's going in the letter.`, EV.letter.run(c).choices); }));
    ch.push(T(c, 'warm', A, 'A glowing, detailed, two-page letter.', `−15 energy · ${chanceWord(base + 0.15)} chance`, () => apply(base + 0.15, `You spend your evening on it. ${A.first} doesn't know, but it's the best letter you've written.`), { cost: { energy: 15 } }));
    ch.push(T(c, 'firm', A, 'A solid standard letter.', `−5 energy · ${chanceWord(base)} chance`, () => apply(base, `Done in forty minutes. Fine.`), { cost: { energy: 5 } }));
    ch.push(T(c, 'dismiss', A, 'Sorry, I really don\'t have time this week.', 'Morale ↓ · loyalty ↓', () => { mod(A, { morale: -8, loyalty: -8 }); return withReact(A, 'dismiss', `"...Oh. Okay."`); }));
    return N(A, c.v.asked ? `${A.first} waits.` : `${opener(A)} "Would you write me a recommendation letter for the ${f}? The deadline is Friday. It would pay my salary for three years."`, ch);
  },
};

EV.quals = {
  kind: 'solo', cd: 20, w: c => c.A.role === 'grad' && c.A.yearIn >= 2 && (c.A.quals === 'pending' || c.A.quals === 'retake') ? 3 : 0,
  run(c) {
    const { A } = c;
    const res = (p, extra) => { if (chance(p)) { A.quals = 'passed'; mod(A, { morale: 15, stress: -20 }); return `${extra} Three weeks later: PASSED. ${A.first} is officially a PhD candidate.`; } A.quals = A.quals === 'retake' ? 'passed' : 'retake'; mod(A, { morale: -18, stress: 10 }); return `${extra} Three weeks later: they did not pass. ${A.quals === 'retake' ? 'They can retake it next term.' : 'The committee lets them through on a conditional pass.'}`; };
    const topic = pick(['the Lamb shift', 'Berry phases', 'the fluctuation-dissipation theorem', 'Fermi\'s golden rule']);
    return N(A, `${opener(A)} "My qualifying exam is in three weeks. They're going to ask me about ${topic} and I'm going to forget my own name."`, [
      T(c, 'warm', A, 'I\'ll run a mock exam with you.', '−12 energy · very likely to pass', () => res(0.9, 'You grill them for two hours. Brutal, but useful.'), { cost: { energy: 12 } }),
      T(c, 'warm', A, 'Have the senior students quiz you.', 'Likely to pass · team bonds', () => { for (const p of team()) if (p !== A && p.role !== 'undergrad') rel(A, p, 5); return res(0.75, 'The lab turns it into a pizza-fueled quiz night.'); }),
      T(c, 'dismiss', A, 'You\'ll be fine. You know this.', has(A, 'anxious') ? 'They need more than that' : 'Coin flip-ish', () => res(has(A, 'anxious') ? 0.45 : 0.6, 'They nod and go back to their desk.')),
    ]);
  },
};

EV.defense = {
  kind: 'solo',
  run(c) {
    const { A } = c;
    const grad = () => { removePerson(A, 'graduated with a PhD'); G.graduated++; addRep(5); cul(2); all({ morale: 4 }); hooks.toast(`🎓 Dr. ${A.last}!`, 'good'); return `The defense goes beautifully. Someone puts a paper crown on their head. Dr. ${A.first} ${A.last}, everyone.`; };
    if (c.v.forced) return N(A, `"It's been seven years. The graduate school says I have to defend this year."`, [C('Then let\'s get you over the finish line.', 'Graduates', grad)]);
    const delayed = A.flags.delayed || 0;
    return N(A, `${opener(A)} "I have ${A.papers} papers. ${delayed ? 'You asked for one more last year. I did it.' : 'I think I\'m ready to defend.'}"`, [
      T(c, 'warm', A, 'You\'re ready. Let\'s schedule it.', 'Graduates · rep ↑ · they leave the lab', grad),
      T(c, 'firm', A, 'One more paper first. It will make your job search.', delayed ? 'They will not take this well twice' : 'Stays a year · morale ↓', () => { mod(A, { morale: delayed ? -25 : -12, loyalty: delayed ? -20 : -8 }); A.flags.defenseAsked = false; A.flags.delayed = delayed + 1; if (delayed) A.flags.wantsOut = true; return withReact(A, 'harsh', delayed ? `A very long silence. "You said that last year."` : `A long pause. "Okay. One more."`); }),
    ]);
  },
};

const UNIS = ['a top-10 university', 'a great liberal-arts college', 'a big state school', 'a university in Zurich', 'a national lab', 'a university in Singapore'];
EV.postdoc_job = {
  kind: 'solo',
  run(c) {
    const { A } = c; const u = c.v.u || (c.v.u = pick(UNIS));
    const pSucc = clamp(0.2 + A.papers * 0.12 + G.rep * 0.003, 0.1, 0.85);
    return N(A, `${opener(A)} "I've been invited to interview for a faculty job at ${u}. My contract here ends soon."`, [
      T(c, 'warm', A, 'I\'ll write the strongest letters of my life.', `−15 energy · ${chanceWord(pSucc + 0.15)}`, () => { if (chance(pSucc + 0.15)) { removePerson(A, `became faculty at ${u}`); addRep(6); G.graduated++; return `They got it! Your academic family tree grows a branch.`; } A.weeks -= WPY; return `No offer this year. They'll stay one more year and try again.`; }, { cost: { energy: 15 } }),
      T(c, 'warm', A, 'Stay here as a Research Scientist.', 'Higher salary · stays for good', () => { A.role = 'scientist'; mod(A, { loyalty: 15, morale: 10 }); return `"Really?! Yes." A permanent senior scientist is a gift for the lab.`; }),
      T(c, 'dismiss', A, 'Good luck! You\'ll do great.', `${chanceWord(pSucc)}`, () => { if (chance(pSucc)) { removePerson(A, `became faculty at ${u}`); addRep(5); G.graduated++; return `They got the job!`; } removePerson(A, 'moved on when their contract ended'); return `No offer. When the contract ends they take a job in industry.`; }),
    ]);
  },
};

EV.ug_graduate = {
  kind: 'solo',
  run(c) {
    const { A } = c;
    return N(A, `${opener(A)} "I'm graduating! I got into grad school here, and... um, I was wondering if I could stay in your lab?"`, [
      T(c, 'warm', A, 'Yes! Welcome aboard as a grad student.', `Becomes a grad student (+${fmt$(ROLES.grad.salary - ROLES.undergrad.salary)}/wk)`, () => { A.role = 'grad'; A.yearIn = 1; A.weeks = 0; A.quals = 'pending'; mod(A, { morale: 15, loyalty: 15 }); return `They do a small, involuntary dance.`; }),
      T(c, 'firm', A, 'Congratulations. Go see another lab, it\'ll be good for you.', 'They leave · rep ↑', () => { removePerson(A, 'graduated (BS)'); addRep(1); return `A firm handshake. You'll be on their acknowledgments page someday.`; }),
    ]);
  },
};

// --- Player-initiated 1:1: topics depend on what's going on ---
export function describeFeelings(A) {
  const tr = trust(A);
  if (tr < -0.3 && A.stress > 50) return `"I'm fine." They're clearly not, but they don't trust you enough to say more.`;
  const s = A.stress > 70 ? 'They admit they are exhausted.' : A.stress > 45 ? 'They\'re a bit stretched.' : 'They seem rested.';
  const m = A.morale > 70 ? 'They love their work right now.' : A.morale > 45 ? 'Things are okay.' : 'They seem pretty down.';
  const b = bestRel(A), w = worstRel(A);
  return `${m} ${s}${b ? ` They get along great with ${b.first}.` : ''}${w ? ` Things are tense with ${w.first}.` : ''}`;
}
EV.checkin = {
  kind: 'solo',
  run(c, say) {
    const { A } = c; const asked = c.v.asked = c.v.asked || {};
    const again = t => EV.checkin.run(c, t);
    const pr = projOf(A);
    const ch = [];
    const harshRecent = memOf(A).log.find(l => (l.tone === 'harsh') && G.week - l.w < 20 && l.what !== 'checkin');
    if (harshRecent && !asked.sorry) ch.push(T(c, 'warm', A, 'About last time... I was too hard on you. I\'m sorry.', 'Repair trust', () => { asked.sorry = 1; mod(A, { loyalty: 10, morale: 6 }); memOf(A).tones = memOf(A).tones.filter(t => t !== 'harsh'); cul(2); return again(`${A.first} blinks. "Oh. Thanks. I... appreciate that."`); }));
    if (!asked.how) ch.push(T(c, 'curious', A, 'How are you really doing?', '−4 energy · learn about them', () => { asked.how = 1; mod(A, { stress: -5, loyalty: 3 }); return again(describeFeelings(A)); }, { cost: { energy: 4 } }));
    if (!asked.proj && pr) ch.push(T(c, 'curious', A, 'How\'s the project going? Any blockers?', 'Specific problems', () => {
      asked.proj = 1;
      const miss = projNeeds(pr.cards).filter(k => !G.equip[k] && !borrowing(k)); const br = projNeeds(pr.cards).filter(k => G.broken[k]);
      const mate = pr.members.map(person).find(p => p && p !== A && relOf(A, p) < -25);
      const t = br.length ? `"The ${EQUIP[br[0]].name} is still down. We're stuck until it's fixed."` : miss.length ? `"We really need a ${EQUIP[miss[0]].name}. Everything takes three times as long without it."` : mate ? `"Honestly the physics is fine. Working with ${mate.first} isn't."` : pr.progress > 70 ? `"Close! Maybe a few more weeks."` : pr.members.length === 1 && pr.feas < 6 ? `"It's a lot for one person."` : `"Steady. ${Math.round(pr.progress)}% maybe."`;
      return again(t);
    }));
    if (!asked.bother && trust(A) > -0.2) ch.push(T(c, 'curious', A, 'Is anything bothering you that I should know about?', 'They may open up', () => {
      asked.bother = 1;
      const w = worstRel(A);
      const t = A.flags.wantsOut || (has(A, 'industry') && A.morale < 50) ? `A pause. "Recruiters have been emailing. I've been... thinking about it."` : A.flags.promisedSwitch && pr ? `"You promised I could switch projects when this one's done. I'm holding you to that."` : w ? `"${w.first} and I are not okay. I don't know what to do about it."` : A.stress > 65 ? `"I'm more tired than I'm letting on."` : `"Not really. Honestly, things are good."`;
      return again(t);
    }));
    if (!asked.career) ch.push(T(c, 'warm', A, 'Let\'s talk about your career goals.', '−5 energy · loyalty ↑', () => { asked.career = 1; mod(A, { loyalty: 6, morale: 3 }); return again(A.role === 'undergrad' ? '"Grad school, I think? Maybe?"' : A.role === 'grad' ? (has(A, 'industry') ? '"Industry, probably. Is that okay to say?"' : '"Faculty, ideally. Or a national lab."') : '"I want my own group someday."'); }, { cost: { energy: 5 } }));
    if (!asked.praise) ch.push(T(c, 'warm', A, 'Great work lately. Seriously.', 'Morale ↑', () => { asked.praise = 1; const d = A.flags.praised && G.week - A.flags.praised < 6 ? 2 : 8; A.flags.praised = G.week; mod(A, { morale: d }); return again(d > 4 ? withReact(A, 'warm', '"Oh! Thank you. That means a lot."') : '"Thanks... you said that last week too."'); }));
    if (!asked.feedback) ch.push(T(c, 'harsh', A, 'Honest feedback: I need more from you.', 'Skill may ↑ · stress ↑ · morale ↓', () => { asked.feedback = 1; mod(A, { stress: 10, morale: has(A, 'slacker') ? -2 : -6 }); if (chance(0.5)) { const k = pick(['exp', 'theory', 'code']); A.skill[k] = clamp(A.skill[k] + 1, 1, 10); } return again(withReact(A, 'harsh', `"...Okay. That's fair."`)); }));
    const newbie = team().find(p => p !== A && (p.role === 'undergrad' || (p.role === 'grad' && p.yearIn <= 1)));
    if (!asked.mentor && newbie && A.role !== 'undergrad') ch.push(T(c, 'warm', A, `Could you mentor ${newbie.first}?`, `${newbie.first} grows · ${A.first}'s stress ↑`, () => { asked.mentor = 1; rel(A, newbie, 12); const k = pick(['exp', 'theory', 'code']); newbie.skill[k] = clamp(newbie.skill[k] + 1, 1, 10); mod(A, { stress: 6 }); return again(has(A, 'mentor') ? `"I'd love that." They mean it.` : `"Sure, happy to."`); }));
    ch.push(...lifeChoices(c, A, again));
    ch.push(C('That\'s all. Thanks for coming by.', '', () => null));
    const greet = trust(A) > 0.4 ? ['"Hey! What\'s up?"', '"You rang?"', '"Is this a good meeting or a bad meeting?" They\'re smiling.'] : trust(A) < -0.3 ? ['"You wanted to see me?" They sound wary.', '"Is something wrong?"', 'They sit down and wait for you to start.'] : ['"You wanted to see me?"', '"Hi! What did you want to talk about?"', '"I brought something to take notes on, just in case."'];
    return N(A, say || (c.v.opened ? vary('ck_wait', [`${A.first} waits for your next question.`, `${A.first} sips their coffee and waits.`, `"Anything else?"`]) : (c.v.opened = 1, note(A, 'checkin', null), `${opener(A)} ${vary('ck_greet' + (trust(A) > 0.4 ? 'w' : trust(A) < -0.3 ? 'c' : 'n'), greet)}`)), ch);
  },
};

EV.lunch = {
  kind: 'solo', cd: 20, w: c => (has(c.A, 'social') ? 2 : 0.3) * (team().length > 3 ? 1 : 0),
  run(c) {
    const { A } = c; const idea = c.v.idea || (c.v.idea = pick(['a lab hike', 'karaoke night', 'a board game evening', 'the dumpling place', 'a laser-tag outing (ironic)', 'a picnic by the fountain']));
    return N(A, `${opener(A)} "Morale's been weird lately. Could we do ${idea}?"`, [
      T(c, 'warm', A, 'Yes! My treat. And I\'m coming.', '−$1,200 · −5 energy · everyone ↑ · bonds ↑ · your wellbeing ↑', () => { G.money -= 1200; all({ morale: 6, stress: -6 }); for (const a of team()) for (const b of team()) if (a.id < b.id) rel(a, b, 5); cul(3); if (G.life) G.life.self = clamp(G.life.self + 4, 0, 100); return vary('outing', [`Two people who never talk turn out to share an obsession with competitive birdwatching.`, `You lose badly at everything. The students love it.`, `Someone takes a photo of the whole lab. It ends up on the lab website.`]); }, { cost: { money: 1200, energy: 5 } }),
      T(c, 'warm', A, 'Potluck in the seminar room.', 'Cheap · small boost', () => { all({ morale: 3 }); for (const a of team()) for (const b of team()) if (a.id < b.id) rel(a, b, 3); return `Seven bags of chips and one heroic lasagna.`; }),
      T(c, 'dismiss', A, 'We\'re too busy right now.', 'Morale ↓ · culture ↓', () => { mod(A, { morale: -6 }); cul(-2); return withReact(A, 'dismiss', `"Right." The group chat goes quiet.`); }),
    ]);
  },
};

EV.allnighter = {
  kind: 'solo', cd: 12, w: c => (has(c.A, 'workaholic') ? 2 : 0.3) * (projOf(c.A) && projOf(c.A).stage === 'running' ? 1 : 0),
  run(c) {
    const { A } = c; const pr = projOf(A); if (!pr || pr.stage !== 'running') return null;
    const youLate = G.life && G.life.hours > 65;
    return N(A, `${opener(A)} "The data-taking is so close. Can I sleep in the lab this week? I brought a sleeping bag."${youLate ? ` They glance at you. "You're here at midnight too, so..."` : ''}`, [
      T(c, 'warm', A, 'Go for it.', 'Progress ↑↑ · stress ↑↑', () => { pr.progress = Math.min(99, pr.progress + 15); mod(A, { stress: 25 }); return `By Thursday they look like a raccoon. A very productive raccoon.`; }),
      T(c, 'firm', A, 'Only with a buddy, and only this week.', 'Progress ↑ · stress ↑', () => { pr.progress = Math.min(99, pr.progress + 8); mod(A, { stress: 10 }); cul(1); return `Safety rule respected. Pizza consumed.`; }),
      T(c, 'firm', A, youLate ? 'No. And you\'re right, I should go home too.' : 'No. Go home and sleep.', youLate ? 'Stress ↓ · culture ↑ · set an example' : 'Stress ↓', () => { mod(A, { stress: -6, morale: has(A, 'workaholic') ? -6 : 1 }); if (youLate) { cul(4); G.life.hours = Math.max(50, G.life.hours - 8); } return youLate ? `You both leave at six. Your work hours drop a bit this week. (Check the Life app.)` : `"...fine." They go home. They probably check the data from bed.`; }),
    ]);
  },
};

EV.sideproject = {
  kind: 'solo', cd: 40, w: c => c.A.role !== 'undergrad' ? 0.25 : 0.1,
  run(c) {
    const { A } = c; const what = c.v.what || (c.v.what = pick(['physics TikTok', 'YouTube channel explaining quantum mechanics with cats', 'podcast about the history of thermodynamics', 'science comedy show']));
    return N(A, `${opener(A)} "So... my ${what} hit a million views. People keep tagging the lab. Is that okay?"`, [
      T(c, 'warm', A, 'Feature the lab! Outreach is part of the job.', 'Rep ↑ · goodwill ↑ · some distraction', () => { addRep(3); gw(4); mod(A, { morale: 10, stress: 4 }); const pr = projOf(A); if (pr) pr.progress = Math.max(0, pr.progress - 4); return `Your optical table becomes mildly internet-famous. The dean forwards it to you with three exclamation points.`; }),
      T(c, 'firm', A, 'Do both, but research comes first.', 'Morale ↑', () => { mod(A, { morale: 5 }); return `"Totally. Research first." (It will not always be research first.)`; }),
      T(c, 'dismiss', A, 'Please keep the lab out of it.', 'Morale ↓', () => { mod(A, { morale: -8 }); return withReact(A, 'dismiss', `The next video is filmed in front of a plain wall.`); }),
    ]);
  },
};

EV.cat = {
  kind: 'solo', cd: 16, w: () => G.equip.cat ? 0.8 : 0,
  run(c) {
    const { A } = c;
    const opts = ['Schrödinger walked across my keyboard and submitted a job to the cluster that is still running.', 'Schrödinger is asleep on the warm vacuum pump and hisses if we come near.', 'Schrödinger knocked a mirror off the optical table. And then sat where it used to be.', 'Schrödinger brought us a mouse. A live one. Into the lab.'].filter(t => (t.includes('optical') ? G.equip.optics : t.includes('vacuum') ? G.equip.vacuum : t.includes('cluster') ? G.equip.cluster : true));
    return N(A, `"Um. ${pick(opts)}"`, [
      T(c, 'warm', A, 'Cats are a known hazard of experimental physics.', 'Laugh it off · morale ↑', () => { all({ morale: 3 }); return `Someone makes a sign: "THE CAT IS BOTH ON AND OFF THE TABLE." Morale soars.`; }),
      T(c, 'firm', A, 'Cat-proof the lab.', '−$1,000', () => { G.money -= 1000; return `Baby gates, cable covers and a heated cat bed far away from anything expensive.`; }),
    ]);
  },
};

EV.haunted = {
  kind: 'solo', cd: 60, w: () => team().some(p => has(p, 'nightowl')) ? 0.3 : 0,
  run(c) {
    const { A } = c; const owl = team().find(p => has(p, 'nightowl') && p !== A);
    return N(A, `${A.first} whispers: "I think the lab is haunted. Equipment turns on at 3am. Mugs move. Someone left a note that just said 'great fit!!'"`, [
      T(c, 'curious', A, 'I\'ll stake it out myself tonight.', '−15 energy · your home life ↓ a little · mystery solved', () => { if (G.life) G.life.home -= 3; if (owl) { rel(A, owl, 8); mod(owl, { morale: 4 }); return `At 3:12am the door opens. It's ${owl.first}, in slippers, with a thermos. Mystery solved. Nobody can stop laughing.`; } return `At 3:12am, nothing. At 3:13am, the equipment turns on by itself. It was a timer someone forgot. Probably.`; }, { cost: { energy: 15 } }),
      T(c, 'warm', A, 'Hire an exorcist. For morale.', '−$500 · everyone laughs', () => { G.money -= 500; all({ morale: 4 }); return `The exorcist declares the lab "very troubled". Best $500 you ever spent.`; }),
    ]);
  },
};

// ===================================================================
// CONFLICTS: hear both sides to uncover the real problem
// ===================================================================
function conflict(c, spec) {
  const { A, B } = c; const s = c.v.cf || (c.v.cf = { a: false, b: false });
  let text = s.say || spec.open;
  if (s.a && s.b && spec.root && !s.rootShown) { text += ` ${spec.root}`; s.rootShown = true; }
  s.say = null;
  const ch = [];
  if (!s.a) ch.push(T(c, 'curious', A, `Let ${A.first} explain.`, 'Hear their side', () => { s.a = true; s.say = spec.sideA + (has(B, 'hothead') && !s.b ? ` ${B.first} interrupts twice.` : ''); if (has(B, 'hothead') && !s.b) rel(A, B, -3); return conflict(c, spec); }));
  if (!s.b) ch.push(T(c, 'curious', B, `And your side, ${B.first}?`, 'Hear their side', () => { s.b = true; s.say = spec.sideB + (has(A, 'hothead') && !s.a ? ` ${A.first} rolls their eyes.` : ''); if (has(A, 'hothead') && !s.a) rel(A, B, -3); return conflict(c, spec); }));
  if (s.a && s.b && spec.fix) ch.push({ ...spec.fix, t: '✦ ' + spec.fix.t });
  ch.push(...spec.res);
  return N(s.who || A, text, ch);
}
// if you side against a hothead harshly, they storm out
const sideAgainst = (X, Y) => { if (has(X, 'hothead')) { mod(X, { morale: -4 }); rel(X, Y, -4); return ` ${X.first} storms out.`; } return ''; };

EV.authorship = {
  kind: 'pair', cd: 12,
  w: c => c.A.project && c.A.project === c.B.project && proj(c.A.project).progress > 45 ? (has(c.A, 'ambitious') || has(c.B, 'ambitious') ? 3 : 1) * (relOf(c.A, c.B) < 0 ? 2 : 1) : 0,
  run(c) {
    const { A, B } = c; const root = c.v.root ?? (c.v.root = chance(0.5) ? 0 : 1);
    return conflict(c, {
      open: `${A.first} and ${B.first} come in together, both talking at once. ${A.first}: "I ran the experiment. I should be first author." ${B.first}: "And I built the entire analysis!"`,
      sideA: `${A.first}: "${root === 1 ? 'Fellowship applications are due next month. A first-author paper decides it. I need this one.' : 'I was in the lab every night for six months. Every data point is mine.'}"`,
      sideB: `${B.first}: "${root === 0 ? 'I rewrote half the analysis at 2am after ' + A.first + '\'s version gave nonsense. I never told anyone.' : 'I did the analysis. And last time I was second author too.'}"`,
      root: root === 0 ? `You realize ${A.first} has no idea how much ${B.first} actually did.` : `You realize this isn't about credit. It's about ${A.first}'s fellowship deadline.`,
      fix: root === 0
        ? T(c, 'warm', [A, B], `Show ${A.first} the commit history. Co-first, both of you.`, 'Both happy · bond ↑↑', () => { mod(A, { morale: 4 }); mod(B, { morale: 10, loyalty: 6 }); rel(A, B, 15); return `${A.first} scrolls through it, stunned. "You did all this? ...Co-first. Obviously."`; })
        : T(c, 'warm', [A, B], `${A.first} first now. ${B.first} first on the next paper, in writing.`, 'Both accept · a promise you must keep', () => { mod(A, { morale: 8 }); mod(B, { morale: 2, loyalty: 4 }); B.flags.promised = G.week; rel(A, B, 6); return `You write it on the whiteboard and both initial it. ${B.first} takes a photo of it.`; }),
      res: [
        T(c, 'warm', [A, B], 'Co-first authors, with an asterisk.', 'Both mildly happy · bond ↑', () => { mod(A, { morale: 3 }); mod(B, { morale: 3 }); rel(A, B, 6); return `Equal contribution. Everyone grumbles, then shakes hands.`; }),
        T(c, 'firm', [A, B], `${A.first} is first.`, `${A.first} ↑ · ${B.first} ↓`, () => { mod(A, { morale: 8 }); mod(B, { morale: -8, loyalty: -4 }); rel(A, B, -6); return `${B.first} goes very quiet.` + sideAgainst(B, A); }),
        T(c, 'firm', [A, B], `${B.first} is first. The analysis was the hard part.`, `${B.first} ↑ · ${A.first} ↓`, () => { mod(B, { morale: 8 }); mod(A, { morale: -8, loyalty: -4 }); rel(A, B, -6); return `${A.first} goes very quiet.` + sideAgainst(A, B); }),
        T(c, 'dismiss', [A, B], 'Work it out yourselves.', 'Relationship ↓↓ · culture ↓', () => { rel(A, B, -16); cul(-3); return `They leave still arguing. It continues on Slack until 2am.`; }),
      ],
    });
  },
};

EV.beamtime = {
  kind: 'pair', cd: 14,
  w: c => { if (!c.A.project || !c.B.project || c.A.project === c.B.project) return 0; const sh = usedEquip(c.A).filter(k => usedEquip(c.B).includes(k) && TOOL[k]); return sh.length ? ((has(c.A, 'nightowl') && has(c.B, 'earlybird')) ? 5 : 1) : 0; },
  run(c) {
    const { A, B } = c;
    const k = c.v.k || (c.v.k = pick(usedEquip(A).filter(x => usedEquip(B).includes(x) && TOOL[x])) || 'optics');
    const tool = TOOL[k]; const root = c.v.root ?? (c.v.root = chance(0.5) ? 0 : 1);
    const stabil = { optics: 'an auto-alignment and laser-lock upgrade', vacuum: 'a load-lock so nobody has to vent the main chamber', fridge: 'a faster sample-exchange probe', cryostat: 'a second sample stick', fab: 'standardized recipes taped to the tool', stm: 'a tip-conditioning routine', cluster: 'a proper job scheduler' }[k];
    return conflict(c, {
      open: `"${B.first} keeps booking ${tool} all day, every day!" ${B.first}: "${A.first} leaves it in a mess and goes to bed!"`,
      sideA: `${A.first}: "${root === 0 ? 'Every time I start, I spend two hours undoing what the last person changed.' : 'It\'s supposed to be shared. ' + B.first + ' acts like they own it.'}"`,
      sideB: `${B.first}: "${root === 0 ? 'Same for me! Nothing is ever how I left it.' : 'I built half of that setup. Nobody else maintains it.'}"`,
      root: root === 0 ? `The real problem: resetting ${tool} between users wastes hours for everyone.` : `The real problem: ${B.first} does all the maintenance and feels taken for granted.`,
      fix: root === 0
        ? T(c, 'warm', [A, B], `Invest in ${stabil}.`, '✦ −$6,000 · both ↑↑ · faster work', () => { G.money -= 6000; mod(A, { morale: 8 }); mod(B, { morale: 8 }); rel(A, B, 10); for (const p of [projOf(A), projOf(B)]) if (p) p.progress = Math.min(99, p.progress + 5); return `Two weeks later, swapping users takes ten minutes instead of two hours. Peace.`; }, { cost: { money: 6000 } })
        : T(c, 'warm', [A, B], `Make ${B.first} the official owner of ${tool}, and ${A.first} helps maintain it.`, '✦ Both ↑ · bond ↑', () => { mod(B, { morale: 10, loyalty: 5 }); mod(A, { morale: 3 }); rel(A, B, 12); return `${B.first} visibly relaxes. ${A.first} learns more about the setup than they expected.`; }),
      res: [
        T(c, 'warm', [A, B], `Split it: nights for ${A.first}, days for ${B.first}.`, has(A, 'nightowl') ? 'Perfect fit for these two' : 'Someone works odd hours', () => { const good = has(A, 'nightowl') || has(B, 'earlybird'); mod(A, { morale: good ? 6 : -3 }); mod(B, { morale: good ? 6 : 2 }); rel(A, B, good ? 8 : 2); return good ? `They're the perfect schedule match. Who knew.` : `It works, mostly. ${A.first} is now nocturnal.`; }),
        T(c, 'firm', [A, B], 'A shared calendar, strictly enforced.', '−5 energy · culture ↑', () => { rel(A, B, 4); cul(2); return `A color-coded spreadsheet appears. It's beautiful and slightly terrifying.`; }, { cost: { energy: 5 } }),
        T(c, 'dismiss', [A, B], 'First come, first served.', 'Chaos · relationship ↓', () => { rel(A, B, -10); mod(A, { stress: 5 }); mod(B, { stress: 5 }); return `${B.first} starts arriving at 5am. ${A.first} starts never leaving.`; }),
      ],
    });
  },
};

EV.mess = {
  kind: 'pair', cd: 14, w: c => usedEquip(c.A).some(k => k !== 'cluster') || usedEquip(c.B).length ? (has(c.A, 'perfectionist') ? 2.5 : 0.6) * (has(c.B, 'chaotic') ? 2 : 1) : 0.2,
  run(c) {
    const { A, B } = c; const root = c.v.root ?? (c.v.root = B.stress > 55 ? 0 : 1);
    const item = c.v.item || (c.v.item = pick(['a dozen unlabeled sample bags', 'four-week-old coffee mugs growing new life', 'optics scattered across the bench like confetti', 'a tangle of BNC cables "for later"', 'a half-eaten burrito next to the pump']));
    return conflict(c, {
      open: `${A.first} points at ${B.first}. "There's ${item} on the shared bench. Again." ${B.first}: "I'm in the middle of something!"`,
      sideA: `${A.first}: "I lost a day last week looking for a part that was under ${B.first}'s stuff."`,
      sideB: `${B.first}: "${root === 0 ? 'I\'m doing three people\'s jobs right now. Cleaning is the last thing on my list.' : 'Nobody owns that bench. Why is it my job?'}"`,
      root: root === 0 ? `${B.first} isn't careless. ${B.first} is overloaded.` : `Nobody owns the shared bench, so nobody cleans it.`,
      fix: root === 0
        ? T(c, 'warm', [A, B], `${B.first}, let's take something off your plate. ${A.first}, can you help with one task?`, '✦ B stress ↓↓ · bond ↑', () => { mod(B, { stress: -15, loyalty: 6 }); mod(A, { stress: 4 }); rel(A, B, 10); G.flags.clean = G.week + 10; return `${B.first} looks surprised that anyone noticed. The bench is clean by Friday.`; })
        : T(c, 'firm', [A, B], 'Weekly rotating bench steward. Starting with me.', '✦ Culture ↑ · fewer accidents', () => { cul(4); rel(A, B, 6); G.flags.clean = G.week + 25; return `You take the first week. Nobody can complain after that.`; }),
      res: [
        T(c, 'firm', [A, B], 'Weekly lab cleanup. Everyone.', '−4 energy · culture ↑ · fewer accidents', () => { cul(3); all({ morale: -1 }); G.flags.clean = G.week + 20; rel(A, B, 3); return `Friday 4pm, music on, gloves on.`; }, { cost: { energy: 4 } }),
        T(c, 'harsh', [B], `${B.first}, clean it up today.`, `${A.first} ↑ · ${B.first} ↓`, () => { mod(A, { morale: 4 }); mod(B, { morale: -7 }); rel(A, B, -4); G.flags.clean = G.week + 8; return withReact(B, 'harsh', `${B.first} cleans, loudly.`); }),
        T(c, 'dismiss', [A], 'It\'s a lab, not a museum.', `${A.first} ↓ · safety risk`, () => { mod(A, { morale: -6 }); rel(A, B, -6); G.flags.clean = 0; return `${A.first} silently tapes a line down the middle of the bench.`; }),
      ],
    });
  },
};

EV.stmvibe = {
  kind: 'pair', cd: 20, w: c => G.equip.stm && !G.equip.vibration && usedEquip(c.B).includes('stm') && usedEquip(c.A).some(k => k === 'vacuum' || k === 'cryostat' || k === 'fridge') && c.A.project !== c.B.project ? 2 : 0,
  run(c) {
    const { A, B } = c;
    return conflict(c, {
      open: `${B.first}: "Every time ${A.first}'s pumps start, my STM images turn to garbage. Atomic resolution needs SILENCE." ${A.first}: "I can't run my experiment without pumps!"`,
      sideA: `${A.first}: "The roughing pump is on the floor right next to the wall. It's been there for years."`,
      sideB: `${B.first}: "I lose a whole night of scans every time. I've started coming in at 4am to beat the pumps."`,
      root: `It's a physical problem: the pump sits on the same floor slab as the STM.`,
      fix: T(c, 'warm', [A, B], 'Put the pump on a vibration-isolation stand and run the line through bellows.', '✦ −$5,000 · both ↑ · solved for good', () => { G.money -= 5000; mod(A, { morale: 5 }); mod(B, { morale: 10 }); rel(A, B, 12); return `The next STM image shows individual atoms, crisp as a postcard. ${B.first} prints it and sticks it on ${A.first}'s monitor.`; }, { cost: { money: 5000 } }),
      res: [
        T(c, 'firm', [A, B], 'Pumps off between 10pm and 6am. STM runs at night.', 'Fair split · both a bit ↓', () => { mod(A, { morale: -2 }); mod(B, { morale: 2, stress: 4 }); rel(A, B, 4); return `It works, mostly. ${B.first} becomes nocturnal.`; }),
        T(c, 'dismiss', [B], 'The STM will have to cope.', `${B.first} ↓↓`, () => { mod(B, { morale: -10 }); rel(A, B, -8); const pr = projOf(B); if (pr) pr.progress = Math.max(0, pr.progress - 6); return `${B.first} stares at you like you said gravity is optional.`; }),
      ],
    });
  },
};

EV.music = {
  kind: 'pair', cd: 20, w: () => 0.5,
  run(c) {
    const { A, B } = c; const g = c.v.g || (c.v.g = pick(['Hungarian polka metal', 'eight-hour lo-fi beats', 'whale songs', 'the Interstellar soundtrack on loop', 'audiobooks about submarines', 'a single sea shanty, repeatedly']));
    return conflict(c, {
      open: `${B.first}: "${A.first} plays ${g} in the lab. All day. I can't think." ${A.first}: "It helps me focus!"`,
      sideA: `${A.first}: "The lab is silent and it makes me anxious. The music is the only thing that helps."`,
      sideB: `${B.first}: "I do alignment work that takes total concentration. And honestly? ${g}."`,
      root: `They need different environments. Nobody asked either of them.`,
      fix: T(c, 'warm', [A, B], `Noise-canceling headphones for ${B.first}, a speaker in the quiet corner for ${A.first}.`, '✦ −$400 · both ↑ · bond ↑', () => { G.money -= 400; mod(A, { morale: 5 }); mod(B, { morale: 5 }); rel(A, B, 10); return `Peace. ${B.first} even admits the polka was "not terrible".`; }),
      res: [
        T(c, 'firm', [A, B], 'Headphones-only rule.', `${B.first} ↑ · ${A.first} ↓`, () => { mod(A, { morale: -4 }); mod(B, { morale: 4 }); rel(A, B, 2); return `${A.first} hums under their breath instead.`; }),
        T(c, 'warm', [A, B], 'Alternate days as lab DJ.', 'Both ↑ · bond ↑', () => { mod(A, { morale: 2 }); mod(B, { morale: 2 }); rel(A, B, 6); return `Tuesday is whale day. Nobody talks about it.`; }),
        T(c, 'firm', [A, B], 'I pick the music from now on.', 'Both ↓ · united against you', () => { mod(A, { morale: -3 }); mod(B, { morale: -3 }); rel(A, B, 8); return `You choose smooth jazz. They have never been closer, bound by shared suffering.`; }),
      ],
    });
  },
};

EV.codecredit = {
  kind: 'pair', cd: 16, w: c => has(c.A, 'coder') ? 2 : 0.4,
  run(c) {
    const { A, B } = c; const root = c.v.root ?? (c.v.root = chance(0.5) ? 0 : 1);
    return conflict(c, {
      open: `${A.first}: "${B.first} used my analysis code in their paper draft. No credit. Not even an acknowledgment." ${B.first}: "It was in the shared folder!"`,
      sideA: `${A.first}: "${root === 0 ? 'Half the lab uses my code. I\'ve never been on a single one of those papers.' : 'I just want my name on it. That\'s all.'}"`,
      sideB: `${B.first}: "${root === 1 ? 'I honestly didn\'t know it was ' + A.first + '\'s. There\'s no name in the file.' : 'Everyone uses it! It\'s infrastructure!'}"`,
      root: root === 0 ? `The real issue: ${A.first} maintains the lab's code and gets no credit for any of it.` : `The real issue: an honest mistake. Nobody labels their code.`,
      fix: root === 0
        ? T(c, 'warm', [A, B], 'Set up a lab code repo. Anyone who uses it cites it and offers co-authorship.', '✦ −8 energy · culture ↑↑ · bond ↑', () => { cul(5); rel(A, B, 8); mod(A, { morale: 12, loyalty: 8 }); for (const p of team()) p.skill.code = clamp(p.skill.code + (chance(0.3) ? 1 : 0), 1, 10); return `A lab GitHub with a CONTRIBUTORS file. ${A.first} looks recognized for the first time in years.`; }, { cost: { energy: 8 } })
        : T(c, 'warm', [A, B], `${B.first}, apologize and add ${A.first} as a co-author. Everyone puts names in their code from now on.`, '✦ Both fine · bond ↑', () => { mod(A, { morale: 8 }); rel(A, B, 10); return `${B.first} apologizes immediately. ${A.first} accepts. Over in two minutes.`; }),
      res: [
        T(c, 'firm', [A, B], `Add ${A.first} as a co-author.`, `${A.first} ↑ · ${B.first} ↓ a bit`, () => { mod(A, { morale: 8 }); mod(B, { morale: -3 }); rel(A, B, 4); cul(2); return `Fair is fair.`; }),
        T(c, 'firm', [A], 'An acknowledgment is enough.', `${A.first} ↓`, () => { mod(A, { morale: -6 }); rel(A, B, -4); return `"Thanks to A. for helpful code." ${A.first} reads it like an insult.`; }),
        T(c, 'harsh', [A], 'Code is shared in this lab. Get over it.', `${A.first} ↓↓ · culture ↓`, () => { mod(A, { morale: -10, loyalty: -6 }); cul(-4); rel(A, B, -8); return withReact(A, 'harsh', `${A.first} makes their folder private that night.`); }),
      ],
    });
  },
};

EV.artifact = {
  kind: 'pair', cd: 16, w: c => { const pr = projOf(c.B); return pr && pr.progress > 40 && c.A.project !== c.B.project ? (has(c.A, 'skeptic') ? 3 : 0.4) : 0; },
  run(c) {
    const { A, B } = c; const pr = projOf(B); if (!pr) return null;
    const isBug = c.v.bug ?? (c.v.bug = pr.stage === 'running' ? chance(0.15 + (pr.bugAdj || 0) + (has(A, 'skeptic') ? 0.15 : 0)) : !!pr.bug);
    const sig = { optics: 'laser intensity drift', vacuum: 'pressure bursts', fridge: 'mixing-chamber temperature', cryostat: 'magnet ramp rate', fab: 'device-to-device variation', stm: 'tip changes', cluster: 'the random seed' }[projNeeds(pr.cards)[0]] || 'detector dead time';
    return conflict(c, {
      open: `${A.first}: "${B.first}'s result is an artifact. I'm sure of it." ${B.first}, arms crossed: "${A.first} is just jealous it's not their result."`,
      sideA: isBug ? `${A.first} shows a plot: the "signal" tracks the ${sig} almost perfectly.` : `${A.first}'s argument is mostly a hunch about the ${sig}. No plot.`,
      sideB: `${B.first}: "I checked the ${sig}. ${isBug ? 'Mostly.' : 'Three times. It\'s in the supplement.'}"`,
      root: isBug ? `${A.first} might be right.` : `${B.first}'s checks look solid.`,
      res: [
        T(c, 'curious', [A, B], 'Present it at group meeting. The data decides.', '−6 energy · truth comes out · culture ↑', () => {
          cul(3);
          if (isBug) { pr.bug = false; pr.bugAdj = -0.2; pr.progress = Math.max(0, pr.progress - 15); mod(A, { morale: 10 }); mod(B, { morale: -4 }); rel(A, B, 2); return `${A.first} was right. A long silence, then ${B.first} says: "Thank you. That would have been a retraction."`; }
          mod(B, { morale: 8 }); mod(A, { morale: -5 }); rel(A, B, -3); return `${B.first}'s result survives every check. ${A.first} concedes. The result is stronger for it.`;
        }, { cost: { energy: 6 } }),
        T(c, 'warm', [A, B], 'Re-analyze it together. Both of you.', 'Forced cooperation · fewer errors', () => { pr.bugAdj = (pr.bugAdj || 0) - 0.15; if (pr.stage !== 'running') pr.bug = isBug && chance(0.4); rel(A, B, 8); pr.progress = Math.max(0, pr.progress - 5); return `They are furious for two days and best friends by Friday.`; }),
        T(c, 'dismiss', [A], `I trust ${B.first}. Drop it.`, `${A.first} ↓ · culture ↓`, () => { mod(A, { morale: -8, loyalty: -5 }); mod(B, { morale: 4 }); cul(-3); rel(A, B, -8); return `${A.first} drops it. Out loud, anyway.` + sideAgainst(A, B); }),
      ],
    });
  },
};

EV.bossy = {
  kind: 'pair', cd: 20, w: c => (c.A.role === 'postdoc' || c.A.role === 'scientist') && (c.B.role === 'grad' || c.B.role === 'undergrad') && c.A.project === c.B.project && c.A.project ? (relOf(c.A, c.B) < 10 ? 2 : 0.5) : 0,
  run(c) {
    const { A, B } = c; const root = c.v.root ?? (c.v.root = A.stress > 55 ? 0 : 1);
    return conflict(c, {
      open: `${B.first} looks miserable. "${A.first} checks my work every hour. Rewrites my code. Messages me at midnight." ${A.first}: "Because the project has to work!"`,
      sideA: `${A.first}: "${root === 0 ? 'My contract ends next year. If this project fails, I have nothing for the job market.' : B.first + ' makes the same mistakes every week. I can\'t keep fixing them.'}"`,
      sideB: `${B.first}: "${root === 1 ? 'Nobody ever showed me how to do it properly. I\'m guessing.' : 'I\'m trying! But I never get to finish anything before it\'s taken away.'}"`,
      root: root === 0 ? `${A.first} is terrified about their own career, and it's landing on ${B.first}.` : `${B.first} was never trained. ${A.first} is filling the gap badly.`,
      fix: root === 0
        ? T(c, 'warm', [A, B], `${A.first}, let's talk about your job search separately. ${B.first} owns their part, start to finish.`, '✦ Both ↑ · A\'s stress ↓', () => { mod(A, { stress: -14, loyalty: 8 }); mod(B, { morale: 10, stress: -8 }); rel(A, B, 10); return `${A.first} looks relieved someone noticed. ${B.first} gets their own corner of the project.`; })
        : T(c, 'warm', [A, B], `${A.first} runs a proper two-week training for ${B.first}. Then hands off.`, '✦ −6 energy · B skill ↑ · bond ↑', () => { const k = pick(['exp', 'code']); B.skill[k] = clamp(B.skill[k] + 2, 1, 10); rel(A, B, 12); mod(B, { morale: 6 }); return `Two weeks later, ${B.first} is fixing things ${A.first} didn't know were broken.`; }, { cost: { energy: 6 } }),
      res: [
        T(c, 'firm', [A], `${A.first}, you're a mentor, not a manager.`, `${B.first} ↑ · ${A.first} ↓`, () => { mod(A, { morale: -5 }); mod(B, { morale: 8, stress: -10 }); rel(A, B, 3); return `${A.first} takes it well, after a day of sulking.` + sideAgainst(A, B); }),
        T(c, 'harsh', [B], `${A.first} has a point. Meet the standard.`, `${B.first} learns · stress ↑`, () => { mod(B, { stress: 12, morale: -5 }); const k = pick(['exp', 'theory', 'code']); B.skill[k] = clamp(B.skill[k] + 1, 1, 10); rel(A, B, -6); return withReact(B, 'harsh', `${B.first} grits their teeth.`); }),
        T(c, 'warm', [A, B], 'Weekly three-way check-ins with me.', '−10 energy · bond ↑↑ · culture ↑', () => { rel(A, B, 12); cul(3); mod(B, { stress: -6 }); return `With you in the room they finally hear each other.`; }, { cost: { energy: 10 } }),
      ],
    });
  },
};

EV.talkslot = {
  kind: 'pair', cd: 30, w: c => c.A.role !== 'undergrad' && c.B.role !== 'undergrad' && G.rep > 15 ? 0.6 : 0,
  run(c) {
    const { A, B } = c; const conf = c.v.conf || (c.v.conf = pick(CONFS));
    return conflict(c, {
      open: `"We got one invited talk at ${conf}. ${B.first} and I both want it."`,
      sideA: `${A.first}: "${A.role === 'postdoc' ? 'I\'m on the job market. An invited talk is huge for me.' : 'I\'ve never given a talk anywhere. I want to try.'}"`,
      sideB: `${B.first}: "${B.role === 'postdoc' ? 'I\'m on the job market. An invited talk is huge for me.' : 'It was my result they invited.'}"`,
      res: [
        T(c, 'firm', [A, B], `${A.first} gives it.`, `${A.first} ↑↑ · ${B.first} ↓ · rep ↑`, () => { mod(A, { morale: 10 }); mod(B, { morale: -8 }); rel(A, B, -5); addRep(2); return `${A.first} crushes it.` + sideAgainst(B, A); }),
        T(c, 'firm', [A, B], `${B.first} gives it.`, `${B.first} ↑↑ · ${A.first} ↓ · rep ↑`, () => { mod(B, { morale: 10 }); mod(A, { morale: -8 }); rel(A, B, -5); addRep(2); return `${B.first} crushes it.` + sideAgainst(A, B); }),
        T(c, 'warm', [A, B], 'Ask the organizers for a second slot.', '−5 energy · 40% chance', () => { if (chance(0.4)) { mod(A, { morale: 8 }); mod(B, { morale: 8 }); addRep(3); return `They said yes! Two talks.`; } mod(A, { morale: -3 }); mod(B, { morale: -3 }); return `"Sadly the schedule is full." You give the talk yourself.`; }, { cost: { energy: 5 } }),
        T(c, 'warm', [A, B], 'Split it: you co-present, ten minutes each.', 'Both ↑ a little · bond ↑', () => { mod(A, { morale: 4 }); mod(B, { morale: 4 }); rel(A, B, 8); addRep(1); return `They rehearse together six times. It's the smoothest handoff anyone has seen.`; }),
      ],
    });
  },
};

EV.debate = {
  kind: 'pair', cd: 30, w: c => (has(c.A, 'theorist') && has(c.B, 'handson')) ? 4 : 0.25,
  run(c) {
    const { A, B } = c;
    return N(B, `Group meeting derailed. ${B.first}: "String theory isn't science if it can't be tested!" ${A.first}: "And experimentalists just turn knobs until something wiggles!"`, [
      T(c, 'warm', [A, B], 'Host a formal debate next Friday. With snacks.', 'Culture ↑ · both ↑', () => { cul(4); mod(A, { morale: 4 }); mod(B, { morale: 4 }); rel(A, B, 4); return `Best-attended group meeting of the year. Someone brings a gavel.`; }),
      T(c, 'curious', [A, B], 'Make them design one experiment together that could test a theory.', 'Both skills ↑ · bond ↑↑', () => { A.skill.exp = clamp(A.skill.exp + 1, 1, 10); B.skill.theory = clamp(B.skill.theory + 1, 1, 10); rel(A, B, 12); return `An hour later the whiteboard is full and they're arguing about the same side.`; }),
      T(c, 'firm', [A, B], 'No more of this at group meeting.', 'Both ↓ a little', () => { mod(A, { morale: -3 }); mod(B, { morale: -3 }); return `It moves to the lunch table instead.`; }),
    ]);
  },
};

EV.coffee = {
  kind: 'pair', cd: 24, w: c => has(c.A, 'caffeine') ? 2 : 0.4,
  run(c) {
    const { A, B } = c;
    const opts = [
      T(c, 'firm', [A, B], 'Coffee rota on the fridge.', 'Culture ↑', () => { cul(2); rel(A, B, 2); return `The rota lasts four days, then works anyway, out of fear.`; }),
      T(c, 'curious', [A, B], 'Detective time. Who\'s doing it?', 'Find out...', () => { cul(3); all({ morale: 3 }); return `You review the evidence. Timestamps. Mug residue. It was you. Everyone has a good laugh at your expense.`; }),
    ];
    if (!G.equip.espresso) opts.splice(1, 0, T(c, 'warm', [A, B], 'Buy an espresso machine.', '−$3,500 · everyone ↑', () => { G.money -= 3500; G.equip.espresso = true; hooks.worldSync(); all({ morale: 4 }); return `A gleaming espresso machine arrives. Productivity up. Heart rates up.`; }, { cost: { money: 3500 } }));
    return N(A, `"Someone keeps finishing the coffee and not making more. I think it's ${B.first}." ${B.first}: "It is NOT me!"`, opts);
  },
};

EV.whiteboard = {
  kind: 'pair', cd: 30, w: c => has(c.B, 'theorist') ? 1.5 : 0.3,
  run(c) {
    const { A, B } = c;
    const opts = [
      T(c, 'warm', [A, B], `${A.first} re-derives it with ${B.first}.`, 'Bond ↑ · they learn', () => { rel(A, B, 8); A.skill.theory = clamp(A.skill.theory + 1, 1, 10); return `Three hours and a lot of marker later, the derivation is back, with a sign error fixed.`; }),
      T(c, 'firm', [A, B], 'From now on, photograph every whiteboard.', 'Small fix', () => { rel(A, B, 2); return `A Slack channel, #whiteboards, fills up with blurry photos.`; }),
    ];
    if (!G.equip.whiteboards) opts.push(T(c, 'warm', [A, B], 'Buy a whiteboard wall. Space for everyone.', '−$2,500 · better brainstorms', () => { G.money -= 2500; G.equip.whiteboards = true; hooks.worldSync(); return `${B.first} claims a corner with a moat of DO NOT ERASE.`; }, { cost: { money: 2500 } }));
    return N(B, `${B.first} is shaking. "There was a two-week derivation on that board. It said DO NOT ERASE. ${A.first} erased it." ${A.first}: "${has(A, 'hothead') ? 'It was there for a MONTH.' : 'I thought it was old! I\'m so sorry.'}"`, opts);
  },
};

EV.freezer = {
  kind: 'pair', cd: 30, w: () => G.equip.fridge || G.equip.cryostat || G.equip.fab ? 0.3 : 0,
  run(c) {
    const { A, B } = c;
    return N(B, `"${A.first} put their lunch in the sample freezer. Next to my samples. It's a curry. The samples smell like curry."`, [
      T(c, 'firm', [A, B], 'Buy a lunch fridge. Label everything.', '−$400 · problem solved', () => { G.money -= 400; rel(A, B, 3); return `A tiny fridge with a big label: FOOD ONLY. NO SAMPLES.`; }),
      T(c, 'warm', [A, B], `${A.first} buys ${B.first} lunch for a week.`, 'Fair · bond ↑', () => { rel(A, B, 6); mod(A, { morale: -2 }); return `It turns out they both love the same taco truck.`; }),
    ]);
  },
};

// ===================================================================
// FOLLOW-UPS: people come back to check whether you kept your word
// ===================================================================
EV.followup = {
  kind: 'solo',
  run(c) {
    const { A } = c; const v = c.v; const d = v.data || {};
    if (v.kind === 'talkTo') {
      const B = person(d.B); if (!B || B.gone) return null;
      const kept = memOf(B).log.some(l => l.what === 'checkin' && l.w >= v.made);
      if (kept) { mod(A, { loyalty: 8, stress: -6 }); rel(A, B, 10); return N(A, `${opener(A)} "Whatever you said to ${B.first}, it worked. Things are so much better. Thank you."`, [T(c, 'warm', A, 'I\'m glad. Tell me if it slips again.', 'Trust ↑', () => withReact(A, 'warm', `"I will."`))]); }
      mod(A, { loyalty: -10, morale: -6 });
      return N(A, `${opener(A)} "You said you'd talk to ${B.first}. Did you? Because nothing has changed."`, [
        T(c, 'warm', A, 'You\'re right. I dropped it. I\'m calling them in now.', 'Partial repair · B comes by', () => { mod(A, { loyalty: 5 }); queueVisit({ ev: 'checkin', A: B.id, pri: 3 }, true); return `"Okay. Thank you for being honest."`; }),
        T(c, 'dismiss', A, 'It\'s been a busy few weeks.', 'Trust ↓↓', () => { mod(A, { loyalty: -8 }); cul(-3); return withReact(A, 'dismiss', `"It's always a busy few weeks." They stop bringing you problems.`); }),
      ]);
    }
    if (v.kind === 'loadcut') {
      if (A.stress < 50) { mod(A, { loyalty: 5 }); return N(A, `${opener(A)} "Just wanted to say, the last few weeks have been so much better. I'm sleeping again."`, [T(c, 'warm', A, 'That\'s great to hear. Ease back in when you\'re ready.', 'Trust ↑', () => withReact(A, 'warm', `They head back to the lab, lighter.`))]); }
      return N(A, `${opener(A)} "I know we cut my load. It's... still too much."`, [
        T(c, 'warm', A, 'Then you take a full week off. No email.', 'Stress ↓↓ · away 1 week', () => { A.away = 1; mod(A, { stress: -30, loyalty: 6 }); return `"No email?" They look like they don't believe that's allowed.`; }),
        T(c, 'curious', A, 'What part is the heaviest?', 'Targeted fix', () => { mod(A, { stress: -14 }); const pr = projOf(A); return pr && pr.members.length < 2 ? `"Doing everything alone." (Add someone to their project.)` : `"Honestly, the uncertainty. Not knowing if it'll work." You map out a fallback plan together.`; }),
      ]);
    }
    if (v.kind === 'help') {
      const pr = proj(d.proj); if (!pr) return null;
      const kept = pr.members.length > d.size;
      mod(A, kept ? { loyalty: 8, stress: -8 } : { loyalty: -8, morale: -6 });
      return N(A, kept ? `${opener(A)} "Having help on the project changed everything. Thank you."` : `${opener(A)} "You said you'd get me help on the project. I'm still alone on it."`, kept ? [T(c, 'warm', A, 'Good. You earned it.', '', () => withReact(A, 'warm', ''))] : [
        T(c, 'warm', A, 'You\'re right. I\'ll fix it today.', 'Assign someone in the Projects app', () => `"Okay." They're giving you one more chance.`),
        T(c, 'dismiss', A, 'We just don\'t have the people.', 'Trust ↓', () => { mod(A, { loyalty: -5 }); return withReact(A, 'dismiss', `"Then don't promise."`); }),
      ]);
    }
    if (v.kind === 'counter') {
      if (A.morale > 45 && !A.flags.wantsOut) { mod(A, { loyalty: 6 }); return N(A, `${opener(A)} "I wanted to say: I'm really glad I stayed."`, [T(c, 'warm', A, 'So am I.', '', () => withReact(A, 'warm', ''))]); }
      return N(A, `${opener(A)} "I tried. I really did. But I'm still thinking about leaving."`, [
        T(c, 'warm', A, 'Then let\'s plan your exit properly. You\'ll leave with a great letter.', 'They leave on good terms · culture ↑', () => { cul(4); removePerson(A, 'left for industry (on good terms)'); return `A proper send-off, with cake.`; }),
        T(c, 'harsh', A, 'We had a deal.', 'They might stay, resentfully', () => { if (chance(0.4)) { mod(A, { loyalty: -15 }); return withReact(A, 'harsh', `"Fine."`); } removePerson(A, 'left for industry'); cul(-3); return `They leave the next month.`; }),
      ]);
    }
    if (v.kind === 'equipAsk') {
      const k = d.k; const ok = G.equip[k] || borrowing(k);
      mod(A, ok ? { loyalty: 6, morale: 6 } : { morale: -5 });
      return N(A, ok ? `${opener(A)} "We've been running on the ${EQUIP[k].name} for weeks now. It's going so much faster."` : `${opener(A)} "Any luck getting time on a ${EQUIP[k].name}? We're still stuck."`, ok ? [C('Great. Keep going.', '', () => null)] : [
        T(c, 'warm', A, 'Not yet. I\'ll keep trying.', '', () => `"Okay."`),
        T(c, 'firm', A, 'Let\'s redesign the project around what we have.', 'Shelve or re-plan in Projects', () => `"Okay, I'll sketch a plan B."`),
      ]);
    }
    if (v.kind === 'brokenAuthor') {
      mod(A, { morale: -15, loyalty: -18 }); A.flags.wantsOut = chance(0.5);
      return N(A, `${opener(A)} "You promised I'd be first author on the next paper. I wasn't. You wrote it on the whiteboard."`, [
        T(c, 'warm', A, 'You\'re right. I messed up. You lead the next one, no exceptions, and I\'ll say so publicly.', 'Partial repair', () => { mod(A, { loyalty: 10 }); A.flags.promised = G.week; return `"...Okay. Publicly." They're watching.`; }),
        T(c, 'dismiss', A, 'Things changed. The other student did more.', 'Trust ↓↓', () => { cul(-4); return withReact(A, 'dismiss', `They don't say anything. They don't have to.`); }),
      ]);
    }
    if (v.kind === 'keptAuthor') {
      mod(A, { loyalty: 14, morale: 10 }); cul(3);
      return N(A, `${opener(A)} "You kept your promise. First author. I... honestly didn't think you would."`, [T(c, 'warm', A, 'A promise is a promise.', 'Trust ↑↑', () => withReact(A, 'warm', 'They grin all the way back to the lab.'))]);
    }
    if (v.kind === 'switchDue') {
      const opts = G.projects.filter(p => (p.stage === 'running' || p.stage === 'idea'));
      return N(A, `${opener(A)} "The project's done. You said I could switch."`, [
        ...opts.slice(0, 3).map(p => T(c, 'warm', A, `Pick "${p.title.slice(0, 50)}".`, 'Keeps your promise', () => { joinProject(A, p); if (p.stage === 'idea') p.stage = 'running'; A.flags.promisedSwitch = 0; mod(A, { loyalty: 10, morale: 10 }); return `"Thank you."`; })),
        T(c, 'warm', A, 'Let\'s brainstorm something brand new for you.', 'Keeps your promise · −8 energy', () => { A.flags.promisedSwitch = 0; mod(A, { loyalty: 6 }); return brainstormNode(c, A, null); }, { cost: { energy: 8 } }),
      ]);
    }
    return null;
  },
};

// ===================================================================
// EXTERNAL VISITORS
// ===================================================================
EV.chair_committee = {
  kind: 'ext', ext: 'chair', cd: 30, w: () => G.committees < 2 ? 0.6 : 0.1,
  run(c) {
    const X = c.X; const com = c.v.com || (c.v.com = pick(['Graduate Admissions', 'Colloquium', 'Undergraduate Curriculum', 'Space Allocation', 'Diversity & Climate', 'Faculty Search']));
    const ch = [];
    if (!c.v.asked) ch.push(C('How much work is it, really?', 'Ask', () => { c.v.asked = 1; return N(X, `"Oh, an hour a week. Two. Three in the busy season." He doesn't meet your eyes. "Four, tops."`, EV.chair_committee.run(c).choices); }));
    ch.push(C('Of course.', 'Goodwill ↑↑ · −5 energy every week for a year', () => { G.commits = G.commits || []; G.commits.push(G.week + WPY); gw(9); return `"Wonderful! First meeting is Tuesday at 8am."`; }));
    ch.push(C('Yes, if I get extra lab space out of it.', 'Goodwill ↑ · weekly energy ↓ · cheaper expansion', () => { G.commits = G.commits || []; G.commits.push(G.week + WPY); gw(4); G.flags.spaceIOU = true; return `"I'll... see what I can do." (Lab expansion goodwill requirement lowered.)`; }));
    ch.push(C(G.titleIdx === 0 ? 'I\'m protecting my research time before tenure.' : 'I really can\'t right now.', G.titleIdx === 0 ? 'Goodwill ↓ a little' : 'Goodwill ↓', () => { gw(G.titleIdx === 0 ? -3 : -7); return G.titleIdx === 0 ? `"Fair enough. Abernathy told me to stop asking junior people." He moves on.` : `"I see." The chair's smile doesn't move, but something behind it does.`; }));
    return N(X, c.v.asked ? 'The chair waits.' : `The chair leans in the doorway. "Got a minute? We need someone on the ${com} Committee. It's very light. Mostly."`, ch);
  },
};

EV.chair_teaching = {
  kind: 'ext', ext: 'chair',
  run(c) {
    const X = c.X;
    const end = wk() <= 15 ? G.week + (15 - wk()) : G.week + (36 - wk());
    return N(X, `"Teaching assignments for ${term()}. We need someone for Physics 1 for Pre-Meds (400 students) or the graduate seminar."`, [
      C('I\'ll take Physics 1.', 'Goodwill ↑↑ · −8 energy/week this term', () => { G.teachLoad = 8; G.teachUntil = end; gw(10); return `Four hundred pre-meds. All of them want to know if it's on the exam.`; }),
      C('I\'ll take the graduate seminar.', 'Goodwill ↑ · −3 energy/week', () => { G.teachLoad = 3; G.teachUntil = end; gw(3); if (chance(0.5)) { const p = pick(team()); if (p) p.skill.theory = clamp(p.skill.theory + 1, 1, 10); } return `Eight brilliant students. One of yours sits in and picks up a lot.`; }),
      C('Buy out of teaching with grant money.', '−$25,000 · goodwill ↓', () => { G.money -= 25000; gw(-3); return `"Mm. That's allowed." It is. Barely.`; }, { cost: { money: 25000 } }),
    ]);
  },
};

EV.po = {
  kind: 'ext', ext: 'po', cd: 24, w: () => G.rep > 5 ? 0.5 : 0,
  run(c) {
    const X = c.X; const call = G.calls.length ? pick(G.calls) : null; const gt = call ? GRANTS.find(g => g.id === call.id) : GRANTS[0];
    return N(X, `"Hi! ${X.name}, program officer. I saw your talk and thought I'd drop by. I manage the ${gt.name}. What are you excited about these days?"`, [
      C('Pitch your boldest, wildest idea.', '−6 energy · boost your next proposal there', () => { G.flags.poBoost = gt.id; addRep(1); if (gt.likes !== 'nov') return `"Ha! Bold. You should definitely apply. Maybe tone it down a bit."`; return `Her eyes light up. "Apply. Seriously. Make it exactly that."`; }, { cost: { energy: 6 } }),
      C('Walk her through your solid, careful plans.', 'Boost if they like feasibility', () => { if (gt.likes === 'feas') G.flags.poBoost = gt.id; return `"Very sensible. Reviewers like sensible."`; }),
      C('Ask what reviewers are tired of seeing.', 'Insider tip', () => { G.flags.poBoost = gt.id; return `She lowers her voice. "Machine learning in the title. Promises of a quantum computer. Just tell them what you'll actually measure."`; }),
      C('Ask about a small supplemental grant.', '40% chance of $60k', () => { if (chance(0.4)) { G.money += 60000; hooks.toast('💰 +$60,000 supplement', 'good'); return `"Actually... we have some end-of-year money. Send me two pages by Friday."`; } return `"Not this cycle, sorry."`; }),
    ]);
  },
};

EV.journalist = {
  kind: 'ext', ext: 'journalist', cd: 30, w: () => G.papers.length ? 0.5 : 0,
  run(c) {
    const X = c.X; const p = G.papers[G.papers.length - 1]; if (!p) return null;
    const ch = [];
    if (!c.v.off) ch.push(C('Can we go off the record for a second?', 'Hear what they\'re really writing', () => { c.v.off = 1; return N(X, `"Sure." Sam closes the notebook. "Honestly? My editor wants 'Physicists Break Reality'. I want to write the true version. Help me make the true version exciting."`, EV.journalist.run(c).choices); }));
    ch.push(C('Yes. It\'s revolutionary.', 'Rep ↑↑ · goodwill ↑ · dangerous if it\'s wrong', () => { addRep(6); gw(3); if (p.bug && G.flags.timeBomb) for (const t of G.flags.timeBomb) if (t.title === p.title) t.rep *= 2; G.flags.hyped = true; return `"PHYSICISTS SHATTER REALITY." Your relatives send you the link four times.`; }));
    ch.push(C('It\'s an important step, but it\'s early days.', 'Rep ↑ · culture ↑', () => { addRep(c.v.off ? 4 : 2); cul(1); return c.v.off ? `The article is careful and genuinely exciting. Other physicists share it approvingly.` : `"Careful scientists make cautious progress." Not catchy, but true.`; }));
    ch.push(C('Talk to the student who did the work.', 'Student ↑ · rep ↑', () => { addRep(2); const s = team().find(q => q.id === p.firstId) || pick(team()); if (s) mod(s, { morale: 12 }); return `${s ? s.first : 'Your student'} is quoted in the article. They print it and frame it.`; }));
    return N(X, c.v.off ? 'Sam waits, pen ready.' : `"I'm writing a feature on '${p.title}'. My editor wants a headline. Would it be fair to say this could change everything?"`, ch);
  },
};

EV.rival_visit = {
  kind: 'ext', ext: 'rival', cd: 30, w: () => 0.4,
  run(c) {
    const X = c.X; const running = G.projects.filter(p => p.stage === 'running');
    const tone = G.rival.rel > 20 ? '"Hello, friend."' : G.rival.rel < -10 ? '"Don\'t worry, I won\'t stay long."' : '"I was just in the building and thought I\'d say hello."';
    return N(X, `${tone} Voss's eyes drift to your whiteboard. "Working on anything... interesting?"`, [
      C('Show her everything. Open science!', 'Rival likes you more · scoop risk', () => { G.rival.rel += 15; if (running.length && chance(0.45)) { G.rival.focus = [...pick(running).cards]; G.rival.heat = 10; } if (chance(0.3)) { G.flags.jointGrant = true; return `"Fascinating. We should write a joint proposal." (Your next proposal gets a boost.) Friend or mistake? Unclear.`; } return `She takes a lot of notes. A LOT of notes.`; }),
      C('Ask her what SHE\'s working on.', 'Turn the tables', () => { if (G.rival.focus) { G.rival.rel += 3; return `"Oh, a little ${card(G.rival.focus[0]).name} thing." That's more than she meant to say. (Check the arXiv app.)`; } return `"This and that." She smiles. You learn nothing.`; }),
      C('Talk about the weather.', 'Safe', () => `Twelve minutes on the weather. Two professionals at the top of their game.`),
      C('Bluff about a fake project.', '−5 energy · throws her off · she may find out', () => { G.rival.heat = 0; G.rival.focus = [pick(CARDS.filter(x => x.k === 'sys')).id, 'holo', 'arrow']; if (chance(0.25)) G.rival.rel -= 15; return `"We're doing holographic arrow-of-time stuff now." She nods slowly.`; }, { cost: { energy: 5 } }),
    ]);
  },
};

EV.vc = {
  kind: 'ext', ext: 'vc', cd: 50, w: () => G.papers.length >= 2 ? 0.3 : 0,
  run(c) {
    const X = c.X;
    return N(X, `"Chad Whitlock, Whitlock Ventures. Love what you're doing with the, uh... quantum. Have you thought about a startup? We'd do a seed round tomorrow."`, [
      C('Spin it out. Equity plus sponsored research.', '+$150,000 for the lab · 25% founder equity · board seat · goodwill ↓', () => { G.money += 150000; gw(-4); addRep(-1); G.flags.startup = true; all({ stress: 4 }); if (G.life) G.life.hours = Math.min(80, G.life.hours + 5); const n = { first: 'Brad', last: 'Kessington', traits: ['ambitious', 'social'], skill: { exp: 4, code: 6 } }; const p = G.papers[G.papers.length - 1]; const co = createCompany({ product: p ? p.title : 'quantum something', plat: 'theory', fundScore: 6, ceo: n, role: 'founder', stake: 0.25, board: true }); return `You are now co-founder and chief scientist of ${co.name}. Chad installs a CEO named Brad. There is a ping-pong table. (See the Ventures app.)`; }),
      C('I\'ll consult. One day a month.', '+$30,000 · −10 energy', () => { G.money += 30000; G.energy = clamp(G.energy - 10, 0, 100); return `Easy money for saying "it depends" in a conference room.`; }),
      C('No thanks. I\'m an academic.', 'Nothing changes', () => `Chad leaves a card made of metal. You use it as a heat sink.`),
    ]);
  },
};

EV.safety = {
  kind: 'ext', ext: 'safety',
  run(c) {
    const X = c.X;
    const laser = G.equip.optics; const cryo = G.equip.cryostat || G.equip.fridge;
    const score = (laser ? (G.equip.interlock ? 30 : -15) : 20) + (G.flags.clean > G.week ? 25 : 0) + G.culture * 0.5 + (G.equip.fumehood ? 15 : (G.equip.fab ? -10 : 0));
    const fail = () => { G.money -= 10000; gw(-8); all({ morale: -2 }); return `FAILED. $10,000 fine, mandatory safety training, and a note in your file the chair will read.`; };
    const pass = () => { gw(5); return `PASSED. "Cleanest lab on the floor." The chair hears about it.`; };
    const looks = [laser ? (G.equip.interlock ? 'Laser interlocks: present.' : 'She frowns at the laser table. "No interlocks?"') : '', cryo ? 'She checks the oxygen-depletion alarm by the cryogenics.' : '', G.equip.fab ? (G.equip.fumehood ? 'The fume hood and flammables cabinet get a nod of approval.' : 'She frowns at the solvent bottles on an open shelf. "Where\'s your fume hood?"') : ''].filter(Boolean).join(' ');
    return N(X, `"Annual safety inspection." ${looks}`, [
      C('Give her the full, honest tour.', '−6 energy · outcome depends on your lab', () => score + int(-10, 10) > 45 ? pass() : fail(), { cost: { energy: 6 } }),
      C('Steer the tour toward the good parts.', 'Gamble', () => score + int(-25, 25) > 40 ? pass() : (gw(-4), fail())),
    ]);
  },
};

EV.helium = {
  kind: 'ext', ext: 'facilities',
  run(c) {
    const X = c.X;
    return N(X, `"Bad news, Prof. Global helium shortage. The supplier tripled the price of liquid helium, and they can only deliver half of what your cryostat boils off."`, [
      C('Pay the premium.', '−$25,000', () => { G.money -= 25000; G.flags.heliumCrisis = 0; return `The dewar arrives. You try not to think about what it cost per liter.`; }, { cost: { money: 25000 } }),
      C('Warm the cryostat up until prices drop.', 'Cryostat offline 5 weeks', () => { G.broken.cryostat = 5; all({ morale: -2 }); return `The cryostat slowly warms to room temperature.`; }),
      C('Buy a helium recovery system.', `−${fmtK(EQUIP.herecovery.cost)} · never again`, () => { G.money -= EQUIP.herecovery.cost; G.equip.herecovery = true; G.flags.heliumCrisis = 0; hooks.worldSync(); return `Pipes, compressors and a smug sense of sustainability.`; }, { cost: { money: EQUIP.herecovery.cost } }),
      ...(G.equip.fridge ? [C('Ask if the dry dilution fridge is affected.', 'Good news', () => `"Nah, that's a closed cycle. It barely uses any." One less thing to worry about.`)] : []),
    ]);
  },
};

EV.flood = {
  kind: 'ext', ext: 'facilities', cd: 100, w: () => 0.08,
  run(c) {
    const X = c.X; const k = c.v.k || (c.v.k = pick(RESEARCH_EQUIP.filter(x => G.equip[x])) || 'none');
    return N(X, `Gus bursts in. "Pipe burst on the floor above the lab! Water's coming through the ceiling${k !== 'none' ? ` right over the ${EQUIP[k].name}` : ''}!"`, [
      C('Everyone grab tarps! I\'m coming too.', '−12 energy · minimal damage · team bonds', () => { all({ morale: 3 }); for (const a of team()) for (const b of team()) if (a.id < b.id) rel(a, b, 3); cul(3); return `Twenty minutes of chaos, tarps and buckets. Nothing important gets wet. Someone makes "LAB FLOOD SURVIVORS" t-shirts.`; }, { cost: { energy: 12 } }),
      C('Let Facilities handle it.', 'Risk of damage', () => { if (k !== 'none' && chance(0.6)) { G.broken[k] = 5; return `The ${EQUIP[k].name} takes a direct hit. Five weeks of repairs.`; } return `Facilities handles it. Mostly.`; }),
    ]);
  },
};

EV.stranger = {
  kind: 'ext', ext: 'stranger', cd: 200, w: () => G.week > 40 ? 0.05 : 0,
  run(c) {
    const X = c.X; const running = G.projects.filter(p => p.stage === 'running' || p.stage === 'results');
    return N(X, `A person in a crinkly silver jacket sits down without asking. "I can't stay long. Where I'm from, your lab is famous. But you have to listen carefully."`, [
      C('I\'m listening.', 'Something will happen...', () => { if (running.length) { const pr = pick(running); pr.hidden += 3; pr.bug = false; pr.bugAdj = -0.3; return `"${pr.title}. Check the ground loop on the second amplifier. And keep going." The hallway camera shows no one leaving. The data looks cleaner the next morning.`; } addRep(3); return `"Your next idea. Trust it." They're gone before you can ask.`; }),
      C('Can I get some lottery numbers?', 'Worth a shot', () => { G.money += 4; return `They sigh and scribble six numbers. You win four dollars.`; }),
      C('How\'s my family, in the future?', 'Ask', () => { if (G.life) G.life.self = clamp(G.life.self + 6, 0, 100); return `They smile, just slightly. "Go home on time tonight." Then they're gone.`; }),
      C('I\'m calling campus security.', '', () => `By the time security arrives, the chair is empty and still slightly warm. There's a faint smell of ozone.`),
    ]);
  },
};

EV.donor = {
  kind: 'ext', ext: 'donor', cd: 60, w: () => G.rep > 20 ? 0.25 : 0,
  run(c) {
    const X = c.X;
    return N(X, `"I made a fortune in artisanal frozen yogurt and I want to give back. To physics! Something... dramatic? Impress me."`, [
      C('The full lab tour.', `−10 energy · good odds of a big gift`, () => { const showy = G.equip.optics ? 'green laser light bouncing through the optics' : G.equip.fridge ? 'the golden dilution fridge' : G.equip.cluster ? 'thousands of blinking GPU lights' : 'your students arguing passionately at a whiteboard'; if (chance(0.35 + G.culture * 0.004 + (G.equip.optics || G.equip.fridge ? 0.1 : 0))) { G.money += 250000; addRep(2); hooks.toast('💰 +$250,000 gift', 'good'); return `She sees ${showy} and gasps. "$250,000. Unrestricted."`; } return `She loves ${showy} but "needs to think about it". She never calls.`; }, { cost: { energy: 10 } }),
      C('Explain your science honestly.', 'Smaller, steadier odds', () => { if (chance(0.45)) { G.money += 120000; return `"I didn't understand half of that, but I trust you." $120,000.`; } return `Her eyes glaze over somewhere around Hilbert space.`; }),
      ...(G.equip.cat ? [C('Introduce her to Schrödinger the cat.', 'Unusual strategy', () => { G.money += 50000; return `Love at first sight. She funds the "Schrödinger Fellowship for Feline-Adjacent Research", $50,000.`; })] : []),
    ]);
  },
};

EV.fairkid = {
  kind: 'ext', ext: 'fairkid', cd: 50, w: () => 0.2,
  run(c) {
    const X = c.X; const q = c.v.q || (c.v.q = pick(['If you fall into a black hole, do you die, or do you become spaghetti, or both?', 'Is light a wave or a particle? My teacher said both and I think that\'s cheating.', 'Can quantum computers play Minecraft?', 'Why is the sky blue but space black?']));
    return N(X, `A nine-year-old with a clipboard. "I'm doing my science fair project and my mom said you're a physicist. ${q}"`, [
      C('Give a real, careful answer. Draw diagrams.', '−8 energy · goodwill ↑ · your wellbeing ↑', () => { gw(4); if (G.life) G.life.self = clamp(G.life.self + 5, 0, 100); return `She takes notes in purple pen and leaves saying "I'm going to be a physicist." You remember why you started.`; }, { cost: { energy: 8 } }),
      C('Hand her off to your most enthusiastic student.', 'A student ↑', () => { const s = pick(team()); if (s) mod(s, { morale: 8 }); gw(2); return `${s ? s.first : 'A student'} spends an hour building a demo out of a laser pointer and a glass of milk.`; }),
    ]);
  },
};

EV.industry_ask = {
  kind: 'ext', ext: 'quanta',
  run(c) {
    const X = c.X; const g = G.grants.find(x => x.strings);
    if (!g) return null;
    return N(X, `"Hey! Love the partnership. Quick ask: our product team needs two of your students on our roadmap. Benchmarking, mostly. Forty hours a week, ideally."`, [
      C('Fine. It\'s in the contract.', 'Two students ↓ · grant safe', () => { const ss = shuffle(team().filter(p => p.role !== 'undergrad')).slice(0, 2); for (const s of ss) { mod(s, { morale: -10, stress: 6 }); const pr = projOf(s); if (pr) pr.progress = Math.max(0, pr.progress - 8); } return `${ss.map(s => s.first).join(' and ')} spend months benchmarking things nobody will read about.`; }),
      C('Negotiate: ten hours a week, max.', '−10 energy · 55% they agree', () => chance(0.55) ? `"...Fine. Ten hours." You win this one.` : (g.ends = G.week + 4, `"Then I think we need to revisit the partnership." The grant ends in four weeks.`), { cost: { energy: 10 } }),
      C('No. My students are not your interns.', 'Grant cancelled · culture ↑', () => { G.grants = G.grants.filter(x => x !== g); cul(6); all({ morale: 4 }); return `Brent blinks. The grant is cancelled. Your students heard you through the door and are quietly very proud.`; }),
    ]);
  },
};

EV.retraction = {
  kind: 'ext', ext: 'rival',
  run(c) {
    const X = c.X; const t = c.v.title, r = c.v.rep * (G.flags.hyped ? 1.4 : 1);
    const p = G.papers.find(x => x.title === t);
    return N(X, `Voss doesn't sit. "We tried to reproduce '${t}'. We couldn't. My student found a calibration error in your supplementary data. I thought you'd want to hear it from me first."`, [
      C('Investigate honestly. Retract if we must.', `Rep ↓ (−${Math.round(r * 0.5)}) · culture ↑`, () => { addRep(-Math.round(r * 0.5)); cul(5); if (p) p.retracted = true; G.rival.rel += 10; return `It was wrong. You retract it with a clear explanation. It hurts, but people respect it, including Voss.`; }),
      C('Defend it publicly.', 'Gamble', () => { if (chance(0.25)) { addRep(2); return `Turns out Voss's group made their own mistake. The paper stands.`; } addRep(-Math.round(r * 1.5)); cul(-6); if (p) p.retracted = true; return `It does not hold up. The story is now "PI doubled down". Painful.`; }),
      C('That analysis was a student\'s work.', 'Rep ↓ · culture ↓↓↓', () => { addRep(-Math.round(r * 0.7)); cul(-18); all({ morale: -10, loyalty: -10 }); for (const q of team()) note(q, 'retraction', 'harsh'); if (p) p.retracted = true; return `Your whole lab heard what you said. It'll take years to earn back that trust.`; }),
    ]);
  },
};

EV.alumni = {
  kind: 'ext', ext: 'alum', cd: 60, w: () => G.alumni.filter(a => /PhD|faculty/.test(a.why)).length ? 0.3 : 0,
  run(c) {
    const a = c.v.alum || (c.v.alum = pick(G.alumni.filter(x => /PhD|faculty/.test(x.why))));
    c.v.alumName = a.name;
    return N({ name: a.name }, `${a.name} pokes their head in, grinning. "I was in town for a seminar. I just wanted to say: everything I know about running a lab, I learned here."`, [
      C('Tell me everything! Stay for group meeting.', 'Team ↑ · rep ↑', () => { all({ morale: 5 }); addRep(2); return `They tell your students war stories from their own PhD. Everyone feels like it's possible.`; }),
      C('Any chance your group wants a collaboration?', 'Boosts a running project', () => { const pr = pick(G.projects.filter(p => p.stage === 'running')); if (pr) { pr.progress = Math.min(99, pr.progress + 12); return `A joint effort on "${pr.title}" starts that afternoon.`; } addRep(2); return `"Absolutely. Send me something."`; }),
      C('What do you wish I\'d done differently?', 'Honest feedback', () => { const harsh = team().some(p => memOf(p).tones.slice(0, 5).includes('harsh')); if (G.life) G.life.self = clamp(G.life.self + 2, 0, 100); return harsh ? `A careful pause. "Sometimes you were harder on us than you needed to be. We'd have worked just as hard."` : G.life && G.life.hours > 62 ? `"Honestly? Go home more. We noticed. We copied you."` : `"Nothing big. You were a good advisor. Maybe more lab dinners."`; }),
    ]);
  },
};

// --- Hiring interview: they ask you questions too ---
EV.interview = {
  kind: 'ext',
  run(c, say) {
    const a = G.applicants.find(x => x.id === c.v.app);
    if (!a) return null;
    const asked = c.v.asked = c.v.asked || {};
    const who = { name: `${a.first} ${a.last}`, first: a.first };
    const again = t => EV.interview.run(c, t);
    const reveal = () => { const hidden = a.traits.filter((t, i) => i >= a.revealed); if (hidden.length) { a.revealed++; return hidden[0]; } return null; };
    const ch = [];
    if (!asked.fail) ch.push(C('Tell me about an experiment that failed.', '−3 energy · reveals personality', () => { asked.fail = 1; const t = reveal(); const desc = { anxious: 'They clearly still lose sleep over it.', ambitious: 'They pivot quickly to how they\'d do it bigger next time.', perfectionist: 'They remember every detail of what went wrong.', chaotic: 'It involved a fire extinguisher.', hothead: 'They\'re still angry at the vendor.', skeptic: 'They caught the problem themselves.', slacker: 'They seem remarkably at peace with it.' }[t] || ''; return again(t ? `They tell a long, honest story. ${desc} You get the sense they're ${TRAITS[t].name.toLowerCase()}.` : `A thoughtful answer. Nothing you didn't already know.`); }, { cost: { energy: 3 } }));
    if (!asked.eq) ch.push(C('Explain your favorite equation like I\'m five.', '−3 energy · reveals exact skills', () => { asked.eq = 1; a.skillsKnown = true; return again(`"So imagine the electron is a very nervous dog..." (Exp ${a.skill.exp}, Theory ${a.skill.theory}, Code ${a.skill.code})`); }, { cost: { energy: 3 } }));
    if (!asked.why) ch.push(C('Why this lab?', 'They warm up to you', () => { asked.why = 1; a.charm = (a.charm || 0) + 0.06; return again(G.culture > 60 ? `"Honestly? Your students seemed really happy at visit day." They mean it.` : `"Your papers." They glance at the lab through the window, less sure.`); }));
    if (!asked.theyAsk && (asked.fail || asked.why)) { asked.theyAsk = 1; asked.q = pick(['What\'s your mentoring style?', 'Do your students have a life outside the lab?', 'How do you handle it when an experiment fails?']); }
    if (asked.q && !asked.answered) {
      const q = asked.q; const wantsBalance = has(a, 'anxious') || has(a, 'social') || has(a, 'slacker');
      ch.unshift(
        C(`"I give people room and check in weekly."`, 'Your answer', () => { asked.answered = 1; a.charm = (a.charm || 0) + (wantsBalance ? 0.1 : 0.04); return again(wantsBalance ? `They visibly relax. "That's exactly what I'm looking for."` : `They nod. "Okay."`); }),
        C(`"I push hard. The best people want to be pushed."`, 'Your answer', () => { asked.answered = 1; a.charm = (a.charm || 0) + (has(a, 'ambitious') || has(a, 'workaholic') ? 0.12 : wantsBalance ? -0.12 : 0); return again(has(a, 'ambitious') || has(a, 'workaholic') ? `Their eyes light up. "Good."` : wantsBalance ? `A flicker of worry crosses their face.` : `"Okay." Hard to read.`); }),
        C(`"Honestly? I'm still figuring it out."`, 'Your answer', () => { asked.answered = 1; a.charm = (a.charm || 0) + (has(a, 'skeptic') || has(a, 'diplomat') ? 0.1 : 0.02); return again(`"I appreciate the honesty." They mean it.`); }),
      );
      say = `${a.first} leans forward. "Can I ask you something? ${q}"`;
    }
    const cost = ROLES[a.role].salary;
    ch.push(C(`Make an offer (${fmt$(cost)}/wk${a.role !== 'undergrad' ? ` + ${fmt$(HIRE_COST)} relocation` : ''})`, `${chanceWord(acceptOfferChance({ ...a, interviewed: true }))} they accept`, () => {
      a.interviewed = true;
      G.applicants = G.applicants.filter(x => x !== a);
      if (team().length >= capacity()) return `You realize there's no bench for them. The lab is full. (Buy a lab expansion.)`;
      if (chance(acceptOfferChance(a))) { delete a.revealed; addPerson(a); log(`Hired ${a.first} ${a.last} (${ROLES[a.role].name}).`); hooks.toast(`🤝 ${a.first} joined the lab!`, 'good'); return `"Yes! Absolutely yes." Welcome to the lab, ${a.first}.`; }
      return `"Thank you so much... but I've accepted another offer." Ouch.`;
    }));
    ch.push(C('Thanks for coming in.', 'No offer', () => { G.applicants = G.applicants.filter(x => x !== a); return `A handshake and a "we'll be in touch".`; }));
    return N(who, say || (c.v.opened ? `${a.first} waits for your next question.` : (c.v.opened = 1, `"Hi! I'm ${a.first}, I applied for the ${ROLES[a.role].name} position. Thanks for having me."`)), ch);
  },
};

// --- Career milestones ---
EV.tenure = {
  kind: 'ext', ext: 'chair',
  run(c) {
    const X = c.X; const s = tenureScore();
    const yes = () => { G.titleIdx = 1; G.tenured = true; addRep(10); all({ morale: 10 }); hooks.toast('🏛️ TENURED!', 'good'); hooks.worldSync(); return `"The committee voted unanimously. Congratulations, Associate Professor." You have a job for life. Your students hang a banner on your door.`; };
    return N(X, `The chair is holding an envelope. "The tenure committee has made its decision. I wanted to deliver it in person."`, [
      C('Open it.', `Your file: score ${s} vs. bar ${TENURE_BAR}`, () => {
        if (s >= TENURE_BAR) return yes();
        if (s >= TENURE_BAR * 0.82) return N(X, `"It was close. The committee is split. You can appeal with extra letters from colleagues."`, [
          C('Appeal.', `${(G.profs || []).filter(f => f.rel >= 60).length} colleagues strongly support you`, () => chance(0.35 + (G.profs || []).filter(f => f.rel >= 60).length * 0.1) ? yes() : (G.over = true, hooks.gameOver('tenure'), 'The appeal fails.')),
          C('Accept the decision.', 'Game over', () => { G.over = true; hooks.gameOver('tenure'); return 'You thank them and start packing.'; }),
        ]);
        G.over = true; hooks.gameOver('tenure'); return `"I'm sorry." Tenure denied.`;
      }),
    ]);
  },
};
EV.promote_full = { kind: 'ext', ext: 'chair', run: c => N(c.X, `"Good news. The college approved your promotion to Full Professor. Also, the space committee found you more room."`, [C('Thank you!', 'Full Professor · +$100,000 discretionary fund', () => { G.titleIdx = 2; G.money += 100000; gw(5); addRep(5); hooks.toast('🏛️ Full Professor!', 'good'); return `Full Professor. Your nameplate gets a little longer.`; })]) };
EV.endowed = { kind: 'ext', ext: 'donor', run: c => N(c.X, `"The yogurt business went public. I want to endow a chair. The Kostas-Moon Chair of Physics. For you."`, [C('I\'m honored.', 'Endowed Chair · +$1,000,000', () => { G.titleIdx = 3; G.money += 1000000; addRep(10); hooks.toast('🪑 Endowed Chair!', 'good'); return `There is a dinner. There is a plaque. There is a lot of frozen yogurt.`; })]) };
EV.nobel = {
  kind: 'ext', ext: 'phone',
  run(c) {
    const lm = G.papers.filter(p => p.landmark).map(p => p.title);
    return N(c.X, `5:12 AM. The phone on your desk won't stop ringing. A calm voice with a Swedish accent: "Good morning. I'm calling from the Royal Swedish Academy of Sciences. Is this a good time?"`, [
      C('...Yes?', '', () => { G.won = true; addRep(50); all({ morale: 30 }); hooks.toast('🏅 NOBEL PRIZE IN PHYSICS', 'good'); hooks.worldSync(); return `"...for ${lm.length ? `'${lm[0]}'` : 'your discoveries'} and the work that followed." You hang up and sit in silence. Then, through the window, you see your entire lab running toward your office.`; }),
    ]);
  },
};

// --- research lines: after a paper, where do we go next? ---
const fitsP = (c, plat) => !c.fits || c.fits === 'any' || c.fits.includes(plat);
EV.next_step = {
  kind: 'solo',
  run(c) {
    const { A } = c; const pr = c.pr; if (!pr) return null;
    const [sysId, techId, goalId] = pr.cards; const sys = card(sysId);
    const goals = CARDS.filter(x => x.k === 'goal' && x.id !== goalId && fitsP(x, sys.plat));
    const techs = CARDS.filter(x => x.k === 'tech' && x.id !== techId && fitsP(x, sys.plat));
    if (!goals.length || !techs.length) return null;
    const st = c.v.st || (c.v.st = {});
    if (!st.opts) {
      const byNov = [...goals].sort((a, b) => b.nov - a.nov);
      const deeper = [sysId, techId, pick(goals.filter(g => G.unlocked.includes(g.id))) ?.id || pick(goals).id];
      const tool = [sysId, (pick(techs.filter(t => G.unlocked.includes(t.id))) || pick(techs)).id, goalId];
      const leap = [sysId, (pick(techs.filter(t => t.nov >= 1)) || pick(techs)).id, byNov[0].id];
      st.opts = [['Push further: same setup, a new question', deeper], ['A new tool on the same question', tool], ['The bold leap', leap]].filter(([, ids], i, a) => a.findIndex(x => x[1].join() === ids.join()) === i);
    }
    const level = (pr.line || 0) + 1;
    const ch = st.opts.map(([lbl, ids]) => {
      const sc = scoreIdea(ids);
      return T(c, 'warm', A, `${lbl}: "${ideaTitle(ids)}"`, `F${sc.feas} N${sc.nov} U${sc.fund}${sc.missing.length ? ` · needs ${sc.missing.map(k => EQUIP[k].name).join(', ')}` : ''}${sc.bad.length ? ' · ⚠️ physics mismatch' : ''}`, () => {
        unlockCards(ids, null, true);
        const np = makeProject(ids); np.line = level; np.parent = pr.title; np.hidden += 0.5;
        G.projects.push(np);
        if (!A.project) { joinProject(A, np); np.stage = 'running'; } else np.stage = 'idea';
        log(`New research line (step ${level + 1}): ${np.title}`);
        mod(A, { morale: 6, loyalty: 3 });
        return A.project === np.id ? `${A.first} is already ordering parts. This is step ${level + 1} of a research line that started with "${pr.title.slice(0, 60)}".` : `It goes on the whiteboard as the next step. Staff it from the Projects app.`;
      });
    });
    ch.push(T(c, 'warm', A, 'Let\'s do something completely different.', 'Brainstorm · −8 energy', () => brainstormNode(c, A, null), { cost: { energy: 8 } }));
    ch.push(T(c, 'dismiss', A, 'Let\'s enjoy this one for a bit first.', 'No new project', () => { mod(A, { morale: -2 }); return `"Fair. But I'm writing these down."`; }));
    return N(A, `${opener(A)} "That paper opened a door. ${vary('next', ['I keep thinking about what comes next.', 'Reviewer 1 asked a question I can\'t stop thinking about.', 'Three people emailed asking if we\'re doing the follow-up.'])} Where do we go from here?"`, ch);
  },
};

// --- the chair asks favors (goodwill) ---
const FAVORS = [
  { ask: 'Could you cover my lecture on Thursday? I have a dean\'s meeting.', yes: 'You teach 120 sophomores about angular momentum. Two of them applaud.', gw: 4, energy: 6 },
  { ask: 'A high-school group is touring the building next week. Could they see your lab?', yes: 'Your students demo everything with suspicious enthusiasm. One teenager asks if they can join the lab.', gw: 3, energy: 5, morale: 2 },
  { ask: 'The board of trustees wants a ten-minute talk on "exciting physics". Interested?', yes: 'You keep it to ten minutes (eleven). A trustee asks for your card.', gw: 5, energy: 8, rep: 2 },
  { ask: 'We need a judge for the undergraduate poster session.', yes: 'You hand out the prize to a sophomore who built a seismometer from a toaster.', gw: 2, energy: 4, applicant: true },
  { ask: 'Could you take our faculty candidate to dinner tonight?', yes: 'Good food, great conversation. You miss bedtime at home.', gw: 3, energy: 5, home: -3 },
  { ask: 'The department open house needs one more demo. Liquid nitrogen ice cream, maybe?', yes: 'Your ice cream station has the longest line. The chair takes three.', gw: 4, energy: 6, money: 300 },
  { ask: 'Could you review the undergraduate curriculum proposal before Friday? It\'s forty pages.', yes: 'You catch two problems nobody else saw. The chair is impressed.', gw: 4, energy: 9 },
  { ask: 'Someone has to give the welcome speech to the new grad students. Ten minutes, Monday morning.', yes: 'You tell them to ask dumb questions early and often. Three of them email you about rotations.', gw: 3, energy: 4, applicant: true },
  { ask: 'Our colloquium speaker cancelled. Could you give a talk on Wednesday?', yes: 'Standing room only. Your rival sits in the front row and asks a mean question. You answer it well.', gw: 5, energy: 9, rep: 2 },
  { ask: 'The dean wants a one-page "research highlight" from our department. You write well. Could you?', yes: 'Your one-pager ends up in the university magazine, with a photo of your laser.', gw: 4, energy: 5, rep: 1 },
  { ask: 'There\'s a student who wants to transfer into physics. Could you meet with them?', yes: 'The student is brilliant and nervous. You tell them to come by your lab sometime. They do.', gw: 2, energy: 3, applicant: true },
  { ask: 'Could you mediate between two colleagues fighting over lab space? I can\'t be in the room with them anymore.', yes: 'Two hours, one whiteboard diagram of the floor plan, and a compromise involving a shared closet. Both of them think they won.', gw: 6, energy: 10 },
  { ask: 'Alumni weekend. Could your lab host a tour?', yes: 'An alumnus from 1978 gets misty-eyed at your vacuum chamber. He leaves a donation.', gw: 3, energy: 5, money: -2000 },
  { ask: 'We need someone on the graduate admissions committee this cycle. It\'s a lot of reading.', yes: 'You read 300 applications. You find two gems and quietly flag them for your lab.', gw: 6, energy: 12, applicant: true },
  { ask: 'Could you write a quick quote for the press release about the new building?', yes: 'Your quote is used in four newspapers. It says "transformative" twice. You don\'t remember saying that.', gw: 2, energy: 2 },
];
const CHAIR_OPEN = { warm: ['The chair leans in, smiling. "My favorite colleague! Quick favor?', 'The chair knocks twice and comes in with two coffees. One is for you. "I come bearing bribes.', '"You\'re the only one who answers my emails. So naturally, I have a favor.'], cool: ['The chair pokes his head in. "Quick favor?', 'The chair stops at your door. "Got a minute? I need something.', 'The chair is holding a clipboard, which is never good. "Quick one.'], cold: ['The chair hovers in the doorway. "I know we haven\'t always agreed. But I need a favor.', 'The chair sighs before he even sits down. "Look. I need someone.', '"Everyone else said no," the chair admits. "So.'] };
function favorDo(F) {
  gw(F.gw); if (F.rep) addRep(F.rep); if (F.money) G.money -= F.money; if (F.morale) all({ morale: F.morale });
  if (F.home && G.life) G.life.home = clamp(G.life.home + F.home, 0, 100);
  if (F.applicant) { const a = makePerson('undergrad'); G.nextId++; a.revealed = 1; a.interviewed = false; a.wants = 0; a.skill.exp = Math.min(10, a.skill.exp + 2); G.applicants.push(a); }
  G.flags.favorsDone = (G.flags.favorsDone || 0) + 1;
  return F.yes + (F.applicant ? ' (They applied to your lab: check Hiring.)' : '');
}
EV.chair_favor = {
  kind: 'ext', ext: 'chair', cd: 7, w: () => 0.9,
  run(c) {
    G.flags.favorSeen = G.flags.favorSeen || [];
    if (c.v.f === undefined) { const fresh = FAVORS.map((_, i) => i).filter(i => !G.flags.favorSeen.includes(i)); c.v.f = fresh.length ? pick(fresh) : Math.floor(rnd() * FAVORS.length); G.flags.favorSeen.push(c.v.f); if (G.flags.favorSeen.length > FAVORS.length - 3) G.flags.favorSeen.shift(); }
    const F = FAVORS[c.v.f];
    const mood = G.goodwill > 60 ? 'warm' : G.goodwill < 30 ? 'cold' : 'cool';
    const lastNo = G.flags.favorNo && G.week - G.flags.favorNo < 12;
    const open = c.v.open || (c.v.open = vary('chair_' + mood, CHAIR_OPEN[mood]) + ' ' + F.ask + '"' + (lastNo ? ' He adds, a little pointedly, "You were busy last time, I remember."' : ''));
    return N(c.X, open, [
      C('Happy to.', `−${F.energy} energy${F.money > 0 ? ` · −${fmt$(F.money)}` : F.money < 0 ? ` · +${fmt$(-F.money)} donation` : ''} · goodwill +${F.gw}${F.rep ? ' · rep ↑' : ''}${F.home ? ' · home ↓' : ''}`, () => favorDo(F), { cost: { energy: F.energy } }),
      C('I\'ll do it, if you do something for me.', G.goodwill >= 45 ? 'Bargain with the chair' : 'Bargain (he may not like it)', () => N(c.X, '"Oh? What did you have in mind?"', [
        C('Get me out of the next committee.', 'Fewer committees, if he agrees', () => { const y = favorDo(F); if (G.goodwill >= 45 || chance(0.4)) { G.commits = (G.commits || []).slice(1); G.committees = G.commits.length; return y + ' And as promised, your name quietly disappears from a committee list.'; } gw(-2); return y + ' He "forgets" the committee part. Of course he does.'; }),
        C('My students need a better office. The one with windows.', 'Lab morale ↑ if he agrees', () => { const y = favorDo(F); if (G.goodwill >= 50 || chance(0.35)) { all({ morale: 6 }); cul(2); return y + ' Two weeks later your students move into the office with windows. They act like they won the lottery.'; } gw(-1); return y + ' "I\'ll see what I can do," he says, which means no.'; }),
        C('Just remember this at my next review.', 'Goodwill ↑ more', () => { gw(2); return favorDo(F) + ' "Noted," he says, and actually writes it down.'; }),
        C('Never mind. I\'ll just do it.', 'Same as saying yes', () => favorDo(F)),
      ]), { cost: { energy: F.energy } }),
      C('Sorry, I really can\'t this week.', lastNo ? 'Goodwill ↓ (you said no last time too)' : 'Goodwill ↓ a little', () => { G.flags.favorNo = G.week; gw(lastNo ? -4 : -1); return lastNo ? `"Right. Of course." He leaves a little faster than he came in. Two no's in a row get noticed.` : vary('chairno', [`"No problem, I'll ask someone else." He will remember who said yes.`, `"Understood. Next time, then." He makes a small note on the clipboard.`, `"Fair enough. I'll try Prof. ${(G.profs && G.profs[0] && G.profs[0].last) || 'Okafor'}." He'll remember.`]); }),
    ]);
  },
};

// --- disasters ---
const needsEq = (...ks) => ks.some(k => G.equip[k]);
EV.turbo_fail = {
  kind: 'solo', cd: 30, w: c => usedEquip(c.A).includes('vacuum') && !G.broken.vacuum ? 0.5 : 0,
  run(c) {
    const { A } = c; if (!G.equip.vacuum || G.broken.vacuum) return null;
    const arai = (G.profs || []).find(f => f.persona === 'neighbor');
    const ch = [];
    if (G.equip.service) ch.push(T(c, 'warm', A, 'Call the vendor. That\'s what the service contract is for.', 'Free · down 1 week', () => { G.broken.vacuum = 1; return 'A replacement turbo arrives in four days. The service contract just paid for itself.'; }));
    ch.push(T(c, 'firm', A, 'Overnight a new turbo.', '−$14,000 · down 1 week', () => { G.money -= 14000; G.broken.vacuum = 1; return 'FedEx at 8am. Pumping down by lunch. Baking out by dinner.'; }, { cost: { money: 14000 } }));
    ch.push(T(c, 'warm', A, 'Let\'s rebuild it ourselves. Teach me what you know.', `−6 energy · down 3 weeks · ${A.first} learns a lot`, () => { G.broken.vacuum = 3; A.skill.exp = clamp(A.skill.exp + 1, 1, 10); mod(A, { morale: 4 }); return `You and ${A.first} spend an afternoon with the bearings, a manual from 1998 and a lot of patience.`; }, { cost: { energy: 6 } }));
    if (arai) ch.push(T(c, 'warm', A, `Ask Prof. ${arai.last} if they have a spare.`, arai.rel >= 50 ? 'Likely yes · down 1 week' : 'They may say no', () => { if (arai.rel >= 50 || chance(0.3)) { G.broken.vacuum = 1; arai.rel = Math.max(0, arai.rel - 2); return `Arai's postdoc wheels over a spare turbo on a cart. "Return it with a bottle of something nice."`; } G.broken.vacuum = 3; return `"Sorry, ours is in use." Three weeks of downtime.`; }));
    return N(A, `${opener(A)} "The turbo pump just died. It made a sound like a jet engine, then a sound like a coffee grinder, then nothing. The chamber is coming up to air."`, ch);
  },
};
EV.ceiling_leak = {
  kind: 'ext', ext: 'facilities', cd: 40, w: () => 0.15,
  run(c) {
    const X = c.X; const k = c.v.k || (c.v.k = pick(RESEARCH_EQUIP.filter(x => G.equip[x])) || 'none');
    return N(X, `Gus looks grim. "Water's coming through the ceiling tiles in your lab. A pipe upstairs is sweating, or the roof, or both.${k !== 'none' ? ` It's dripping right next to the ${EQUIP[k].name}.` : ''}"`, [
      C('Buckets, tarps, everyone! I\'m coming too.', '−8 energy · team bonds · small risk', () => { all({ morale: 2 }); cul(2); if (k !== 'none' && chance(0.15)) { G.broken[k] = 2; return `Twelve buckets and a lot of plastic sheeting. Mostly saved; the ${EQUIP[k].name} needs two weeks to dry out.`; } return 'Twelve buckets and a lot of plastic sheeting. Nothing important gets wet. Someone names the biggest bucket "Gerald".'; }, { cost: { energy: 8 } }),
      C('Move everything sensitive out of the way.', '−$1,000 · every experiment slows for a while', () => { G.money -= 1000; for (const p of G.projects.filter(p => p.stage === 'running' && card(p.cards[0]).mode === 'exp')) p.progress = Math.max(0, p.progress - 4); return 'Half the lab is now in the hallway. Everything is safe and nothing is aligned.'; }),
      C('Call Facilities and wait.', 'Free · real risk of damage', () => { if (k !== 'none' && chance(0.45)) { G.broken[k] = int(3, 5); return `Facilities arrives the next day. Too late for the ${EQUIP[k].name}: down for ${G.broken[k]} weeks.`; } return 'Facilities patches it by the afternoon. You got lucky.'; }),
    ]);
  },
};
EV.construction = {
  kind: 'ext', ext: 'facilities', cd: 120, w: () => G.week > 20 ? 0.12 : 0,
  run(c) {
    const X = c.X;
    return N(X, `Gus hands you a flyer. "Heads up: they're renovating the wing next door. Jackhammers, 8 to 4, for the next six weeks. Dust, vibration, the works."`, [
      C('Switch the lab to night shifts until it\'s over.', 'Experiments run at 85% · stress ↑ for experimentalists', () => { G.flags.deadTime = { until: G.week + 6, factor: 0.85 }; for (const p of team()) if (usedEquip(p).length) mod(p, { stress: 10, morale: -3 }); return 'The lab becomes nocturnal. The jackhammers become your alarm clock.'; }),
      C('Pause the experiments. Use the time to write papers and analyze data.', 'Experiments at 30% · running projects gain quality', () => { G.flags.deadTime = { until: G.week + 6, factor: 0.3 }; for (const p of G.projects.filter(p => p.stage === 'running')) p.qBonus = (p.qBonus || 0) + 4; all({ stress: -5 }); return 'Writing month. The whiteboard fills with outlines. Everyone secretly enjoys sleeping normal hours.'; }),
      C('Buy vibration dampers and dust curtains.', '−$8,000 · experiments at 75%', () => { G.money -= 8000; G.flags.deadTime = { until: G.week + 6, factor: 0.75 }; return 'Rubber feet under everything, plastic curtains everywhere. It helps.'; }, { cost: { money: 8000 } }),
      C('Complain to the dean.', 'Goodwill ↓ · 50% the work is rescheduled shorter', () => { gw(-3); if (chance(0.5)) { G.flags.deadTime = { until: G.week + 3, factor: 0.5 }; return 'The dean moves the loudest work to weekends. Three weeks instead of six.'; } G.flags.deadTime = { until: G.week + 6, factor: 0.5 }; return '"The schedule is the schedule." Six weeks of jackhammers anyway.'; }),
    ]);
  },
};
EV.chiller_fail = {
  kind: 'ext', ext: 'facilities', cd: 50, w: () => needsEq('optics', 'fridge', 'cryostat', 'femtolaser', 'cluster') ? 0.12 : 0,
  run(c) {
    const X = c.X; const ks = ['femtolaser', 'fridge', 'cryostat', 'optics', 'cluster'].filter(k => G.equip[k] && !G.broken[k]); if (!ks.length) return null;
    return N(X, `"The building's cooling-water chiller just failed. Anything water-cooled is about to overheat: ${ks.map(k => EQUIP[k].name).join(', ')}."`, [
      C('Shut everything down safely, now.', '−6 energy · everything off for a week', () => { G.flags.deadTime = { until: G.week + 1, factor: 0.2 }; return 'You power down rack by rack. A quiet week. The chiller is fixed by Friday.'; }, { cost: { energy: 6 } }),
      C('Rig a temporary chiller from the lab next door.', '−$3,000 · keeps most things running', () => { G.money -= 3000; if (chance(0.75)) { G.flags.deadTime = { until: G.week + 1, factor: 0.8 }; return 'Garden hoses, zip ties and a borrowed recirculating chiller. It works. Do not tell Safety.'; } const k = pick(ks); G.broken[k] = 3; return `It works until it doesn't. The ${EQUIP[k].name} overheats: three weeks of repairs.`; }),
      C('Keep running and hope it\'s fixed quickly.', 'Gamble', () => { if (chance(0.4)) return 'Facilities fixes it in an hour. Lucky.'; const k = pick(ks); G.broken[k] = int(3, 6); return `The ${EQUIP[k].name} thermally trips, then something inside it cooks. Down ${G.broken[k]} weeks.`; }),
    ]);
  },
};
EV.fire_alarm = {
  kind: 'ext', ext: 'safety', cd: 40, w: () => 0.12,
  run(c) {
    const X = c.X;
    const culprit = pick(['burned popcorn in the 3rd-floor kitchen', 'a soldering iron left on a pile of paper', 'a steam leak in the basement', 'someone vaping in the stairwell']);
    return N(X, `The fire alarm is blaring. Officer Pruitt is directing everyone outside. "Everybody out! The cause: ${culprit}."`, [
      C('Walk everyone out calmly, and do a headcount.', 'Culture ↑ · safety record ↑', () => { cul(2); gw(1); G.flags.deadTime = { until: G.week + 1, factor: 0.85 }; return 'Forty minutes on the lawn in the sun. Someone starts a game of frisbee. Pruitt notes your group was the most organized.'; }),
      C('Run back in to shut off the lasers and pumps first.', 'Less dead time · Safety is not amused', () => { gw(-2); return '"Did you just run INTO a fire alarm?" You have a follow-up meeting with EH&S.'; }),
    ]);
  },
};
EV.network_outage = {
  kind: 'ext', ext: 'facilities', cd: 50, w: () => G.projects.some(p => p.stage === 'running' && card(p.cards[0]).mode !== 'exp') || G.equip.cluster ? 0.13 : 0,
  run(c) {
    const X = c.X;
    return N(X, `"Bad news from IT: campus network and the data center are down. Ransomware scare. Could be a week."`, [
      C('Everyone works offline: whiteboards, notebooks, pen and paper.', 'Data and theory projects run at 40% for a week · theory skills ↑', () => { G.flags.netDown = G.week + 1; for (const p of team()) if (chance(0.3)) p.skill.theory = clamp(p.skill.theory + 1, 1, 10); return 'Old-school week. Someone rediscovers how to do an integral by hand and is weirdly proud.'; }),
      C('Pay for emergency cloud computing.', '−$5,000 · computing keeps running', () => { G.money -= 5000; return 'Credit card, cloud account, done. The jobs keep running.'; }, { cost: { money: 5000 } }),
      C('Use the downtime for a lab retreat.', '−$1,500 · everyone ↑ · bonds ↑', () => { G.money -= 1500; G.flags.netDown = G.week + 1; all({ morale: 6, stress: -8 }); for (const a of team()) for (const b of team()) if (a.id < b.id) rel(a, b, 3); return 'A cabin, a whiteboard, no Wi-Fi. Two new project ideas and one very competitive game of charades.'; }),
    ]);
  },
};

// --- money: supplies, outages, audits ---
EV.supplies = {
  kind: 'solo', cd: 10,
  w: c => { const pr = projOf(c.A); return pr && pr.stage === 'running' && !pr.premium && !pr.budget && card(pr.cards[0]).mode === 'exp' ? 0.9 : 0; },
  run(c, say) {
    const { A } = c; const pr = projOf(A); if (!pr || pr.stage !== 'running') return null;
    const sup = SUPPLIES[card(pr.cards[0]).plat]; const base = Math.round(supplyCost(pr) * 6);
    const st = c.v.st || (c.v.st = {});
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', A, 'Why is the cheap one so cheap?', 'Ask', () => { st.asked = 1; return EV.supplies.run(c, has(A, 'skeptic') || has(A, 'perfectionist') ? `"Because half of them don't work. I tested a batch last year. Two were fine. Two were mislabeled."` : `"It's a new vendor. Reviews are mixed. One lab said it was fine, another lost a month to it."`); }));
    ch.push(T(c, 'warm', A, 'Get the premium stuff and set up a standing order.', `−${fmt$(base * 2)} now · supplies cost 30% more · quality ↑`, () => { G.money -= base * 2; pr.premium = true; pr.budget = false; mod(A, { morale: 5 }); return `"Oh, this is the nice stuff." ${A.first} handles the first box like it's jewelry.`; }, { cost: { money: base * 2 } }));
    ch.push(T(c, 'firm', A, 'The usual vendor is fine.', `−${fmt$(base)} now`, () => { G.money -= base; return `The order goes in. Back to work.`; }, { cost: { money: base } }));
    ch.push(T(c, 'firm', A, 'Go with the budget vendor from now on.', `−${fmt$(Math.round(base * 0.4))} now · supplies cost 40% less · risk of bad results`, () => { G.money -= Math.round(base * 0.4); pr.budget = true; pr.premium = false; pr.bugAdj = (pr.bugAdj || 0) + 0.08; if (has(A, 'perfectionist') || has(A, 'skeptic')) mod(A, { morale: -6 }); return has(A, 'perfectionist') || has(A, 'skeptic') ? `${A.first} visibly disagrees but places the order.` : `Cheap and cheerful. Probably fine.`; }));
    ch.push(T(c, 'dismiss', A, 'Make do with what we have for a couple of weeks.', 'Progress ↓', () => { pr.progress = Math.max(0, pr.progress - 6); mod(A, { morale: -4 }); return `They scavenge parts from an old setup. It slows everything down.`; }));
    return N(A, say || `${opener(A)} "We're out of ${sup.what.split(', ')[0]}. Actually, we're low on ${sup.what}. The usual order is about ${fmt$(base)}. There's a cheaper vendor, or the premium one."`, ch);
  },
};

EV.power_outage = {
  kind: 'ext', ext: 'facilities', cd: 60, w: () => RESEARCH_EQUIP.some(k => G.equip[k] && k !== 'cluster') ? 0.15 : 0,
  run(c) {
    const X = c.X;
    const vulnerable = ['fridge', 'cryostat', 'vacuum', 'optics', 'cluster', 'stm'].filter(k => G.equip[k] && !G.broken[k]);
    if (!vulnerable.length) return null;
    if (G.equip.ups) return N(X, `Gus leans in. "Campus-wide power outage! Half the building is dark. ...Huh. Your lab's still humming."`, [
      C('That\'s what the backup power is for.', 'Nothing lost', () => { const f = (G.profs || []).find(x => x.persona === 'neighbor'); if (f) f.rel = Math.min(100, f.rel + 4); return `Everything rides through on battery and generator. Next door, Arai's group loses a week of cooldown. You lend them an extension cord and a sympathetic face.`; }),
    ]);
    const hit = pick(vulnerable);
    const what = { fridge: 'the dilution fridge will warm up', cryostat: 'the magnet could quench', vacuum: 'the ion pumps will stop and the vacuum will degrade', optics: 'the lasers will lose lock and drift', cluster: 'the cluster jobs will die mid-run', stm: 'the STM tip could crash' }[hit];
    return N(X, `Gus bursts in, holding a flashlight. "Campus power's out! Could be hours. If nobody does anything, ${what}."`, [
      C('Run to the lab. Shut everything down properly, by hand.', '−12 energy · minor damage only', () => { G.broken[hit] = 1; all({ morale: 1 }); return `You and two students go through the shutdown checklist by phone light. One piece needs a week to recover. It could have been much worse.`; }, { cost: { energy: 12 } }),
      C('Let the automatic safety systems handle it.', 'Gamble', () => { if (chance(0.55)) { G.broken[hit] = int(3, 5); const second = vulnerable.find(k => k !== hit); if (second && chance(0.4)) G.broken[second] = 2; return `The safety systems mostly work. Mostly. The ${EQUIP[hit].name} is down for ${G.broken[hit]} weeks.`; } return `The interlocks do their job. Everything comes back when the power does.`; }),
      C('Order backup power right now. Never again.', `−${fmtK(EQUIP.ups.cost)} · still lose tonight`, () => { G.money -= EQUIP.ups.cost; G.equip.ups = true; G.broken[hit] = 2; hooks.worldSync(); return `Too late for tonight (the ${EQUIP[hit].name} is down for two weeks), but the UPS arrives next month.`; }, { cost: { money: EQUIP.ups.cost } }),
    ]);
  },
};

EV.audit = {
  kind: 'ext', ext: 'auditor', cd: 100, w: () => G.grants.length && ['espresso', 'nappod', 'kitchen', 'couch', 'cat'].some(k => G.equip[k]) ? 0.15 : 0,
  run(c) {
    const X = c.X; const items = ['espresso', 'nappod', 'kitchen', 'couch', 'cat'].filter(k => G.equip[k]);
    const total = items.reduce((s, k) => s + EQUIP[k].cost, 0);
    return N(X, `"Routine compliance audit of your federal grants." She slides a printout across the desk. "I see a ${items.map(k => EQUIP[k].name.toLowerCase()).join(', a ')}. Were these charged to your NSF award?"`, [
      C('Honestly, yes. I\'ll move them to my discretionary account.', `−${fmt$(total)} repaid · goodwill ↑`, () => { G.money -= total; gw(2); return `"Thank you. That's all I need." The cleanest audit she's done all month.`; }),
      C('Those are essential research infrastructure.', 'Gamble', () => { if (chance(0.35)) return `She looks at you for a long moment. "...A nap pod. For research." She writes something down and leaves. You never hear about it again.`; G.money -= total * 1.5; gw(-8); return `"No, they're not." You repay ${fmt$(total * 1.5)} including a penalty, and the chair gets a copy of the report.`; }),
      C('I bought them from my startup funds, actually.', G.week < WPY * 2 ? 'True, if you bought them early' : 'Risky', () => { if (G.week < WPY * 2 || chance(0.3)) return `The receipts back you up. "Great, thanks for your time."`; G.money -= total; gw(-4); return `The receipts say otherwise. You repay ${fmt$(total)}, and it's awkward.`; }),
    ]);
  },
};

// home life and colleagues live in life.js
Object.assign(EV, LIFE_EV, FIN_EV, CHAT_EV, CAREER_EV);

// ===================================================================
// DIRECTOR
// ===================================================================
function ctxFor(v) {
  return { v, A: v.A ? person(v.A) : null, B: v.B ? person(v.B) : null, X: v.ext ? extInfo(v) : null, pr: v.proj ? proj(v.proj) : null };
}
export function runVisit(v) {
  const e = EV[v.ev];
  if (!e) return null;
  const c = ctxFor(v);
  if ((v.A && !c.A) || (v.B && !c.B)) return null;
  if ((c.A && c.A.gone) || (c.B && c.B.gone)) return null;
  if (v.ext && !c.X) return null;
  return e.run(c);
}

function cooled(id) { const e = EV[id]; return !e.cd || !G.cooldowns[id] || G.week - G.cooldowns[id] >= e.cd; }

export function director() {
  if (G.over) return;
  const w = wk();
  G.commits = (G.commits || []).filter(u => u > G.week);
  G.committees = G.commits.length;
  if (G.teachUntil && G.week >= G.teachUntil) { G.teachLoad = 0; G.teachUntil = 0; }
  if (w === 1 || w === 20) queueVisit({ ev: 'chair_teaching', ext: 'chair', pri: 2 });

  // fellowships
  if (G.flags.fellows) for (const f of [...G.flags.fellows]) if (G.week >= f.week) {
    G.flags.fellows = G.flags.fellows.filter(x => x !== f);
    const p = person(f.id); if (!p || p.gone) continue;
    if (chance(f.p)) { p.fellowship = 3 * WPY; mod(p, { morale: 20, loyalty: 6 }); addRep(2); mail(f.f, `Award: ${p.first} ${p.last}`, `${p.first} has been awarded the ${f.f}. Their salary is covered for three years.`); hooks.toast(`🏆 ${p.first} won the ${f.f}!`, 'good'); }
    else { mod(p, { morale: -6 }); mail(f.f, `Decision: ${p.first} ${p.last}`, `We regret to inform you that ${p.first} was not selected this year.`); }
  }

  // promises coming due
  G.followups = G.followups || [];
  for (const f of [...G.followups]) if (G.week >= f.week) {
    G.followups = G.followups.filter(x => x !== f);
    const p = person(f.A); if (!p || p.gone) continue;
    queueVisit({ ev: 'followup', A: p.id, kind: f.kind, data: f.data, made: f.made, pri: 2 });
  }
  // authorship promises: check new papers
  const scan = G.flags.paperScan || 0;
  for (const paper of G.papers.slice(scan)) {
    for (const id of paper.authors || []) {
      const p = person(id); if (!p || !p.flags.promised || p.flags.promised > paper.week) continue;
      p.flags.promised = 0;
      queueVisit({ ev: 'followup', A: id, kind: paper.firstId === id ? 'keptAuthor' : 'brokenAuthor', pri: 2 });
    }
    // switch promises: their project finished
    for (const id of paper.authors || []) { const p = person(id); if (p && p.flags.promisedSwitch) { queueVisit({ ev: 'followup', A: id, kind: 'switchDue', pri: 2 }); } }
  }
  G.flags.paperScan = G.papers.length;
  if (G.flags.followIdeas) for (const f of [...G.flags.followIdeas]) if (G.week >= f.week) {
    G.flags.followIdeas = G.flags.followIdeas.filter(x => x !== f);
    const p = person(f.lead); if (p && !p.gone) queueVisit({ ev: 'next_step', A: p.id, proj: f.proj, pri: 2 });
  }

  // scheduled externals
  if (G.flags.industryAsk && G.week >= G.flags.industryAsk) { G.flags.industryAsk = 0; queueVisit({ ev: 'industry_ask', ext: 'quanta', pri: 2 }); }
  if (G.equip.cryostat && !G.equip.herecovery && !G.flags.heWarn && chance(0.012)) { G.flags.heWarn = G.week + 4; mail('Facilities Management', 'Liquid helium prices rising', 'Heads up: our supplier says liquid helium is getting tight. Wet cryostats without helium recovery should expect trouble in about a month. (Dry dilution fridges are mostly unaffected.)'); }
  if (G.flags.heWarn && G.week >= G.flags.heWarn) { G.flags.heWarn = 0; G.flags.heliumCrisis = 6; if (G.equip.cryostat && !G.equip.herecovery) queueVisit({ ev: 'helium', ext: 'facilities', pri: 2 }); }
  if (!G.flags.safetyNext) G.flags.safetyNext = G.week + int(30, 50);
  if (G.week === G.flags.safetyNext - 3) mail('Environmental Health & Safety', 'Inspection in 3 weeks', `Your lab will be inspected in three weeks.${G.equip.optics ? ' Laser labs must have interlocks.' : ''} A weekly cleanup routine helps.`);
  if (G.week >= G.flags.safetyNext) { G.flags.safetyNext = G.week + int(40, 56); queueVisit({ ev: 'safety', ext: 'safety', pri: 2 }); }
  if (G.culture < 35 && chance(G.equip.service ? 0.015 : 0.04)) { const k = pick(Object.keys(ACC).filter(x => G.equip[x] && !G.broken[x])); if (k) { G.broken[k] = 6; mail('Building Facilities', `Damaged equipment: ${EQUIP[k].name}`, `We found your ${EQUIP[k].name} damaged during a routine walkthrough. It looks like it happened a while ago, and nobody reported it. Repairs will take about 6 weeks.\n\n(A low-trust lab culture makes people hide mistakes.)`); hooks.toast(`⚠️ Hidden damage found: ${EQUIP[k].name}`, 'bad'); } }

  // urgent: burnout and quitting
  for (const p of team()) {
    if (p.away || busy(p.id)) continue;
    if (p.stress > 80 && cooled('burnout') && chance(0.5)) { queueVisit({ ev: 'burnout', A: p.id, pri: 2 }); G.cooldowns.burnout = G.week; }
    else if ((p.morale < 22 || p.flags.wantsOut) && cooled('quit') && chance(0.35)) { queueVisit({ ev: 'quit', A: p.id, pri: 2 }); G.cooldowns.quit = G.week; }
  }

  // random lab events
  let rolls = G.timeStep === 'week' ? (chance(0.5) ? 1 : 0) + (chance(0.12) ? 1 : 0) : 1 + (chance(0.45) ? 1 : 0);
  if (G.queue.length > 3 || G.quietWeek) rolls = 0;
  while (rolls-- > 0) {
    const cand = [];
    const Tm = team().filter(p => !p.away && !busy(p.id));
    for (const id in EV) {
      const e = EV[id]; if (!e.w || !cooled(id) || e.kind === 'life' || e.kind === 'prof') continue;
      if (e.kind === 'solo') for (const A of Tm) { const wt = e.w({ A }); if (wt > 0) cand.push([wt, { ev: id, A: A.id }]); }
      else if (e.kind === 'pair') for (const A of Tm) for (const B of Tm) { if (A === B) continue; const wt = e.w({ A, B }); if (wt > 0) cand.push([wt * 0.5, { ev: id, A: A.id, B: B.id }]); }
      else if (e.kind === 'ext') { const wt = e.w({}); if (wt > 0) cand.push([wt * 1.5, { ev: id, ext: e.ext }]); }
    }
    const tot = cand.reduce((s, x) => s + x[0], 0);
    if (!tot) break;
    let r = rnd() * tot;
    for (const [wt, v] of cand) { r -= wt; if (r <= 0) { queueVisit(v); G.cooldowns[v.ev] = G.week; if (EV[v.ev].kind === 'pair') G.stats.conflicts++; break; } }
  }

  // a casual drop-in on quiet weeks
  if (!G.queue.length && !G.quietWeek && chance(0.3)) { const who = pick(team().filter(p => !p.away && !busy(p.id) && p.weeks > 1)); if (who) queueVisit({ ev: 'chat', A: who.id }); }

  // HR meetings, job security, research interests
  hrDirector(); jobDirector(); interestTick();

  // family, hobbies and colleagues
  lifeDirector(cooled);
  finDirector();

  if (chance(0.012) && !G.flags.priceHike) {
    const pr = pick(G.projects.filter(p => p.stage === 'running' && card(p.cards[0]).mode === 'exp'));
    if (pr) { const plat = card(pr.cards[0]).plat; G.flags.priceHike = { plat, until: G.week + 20 }; mail('Purchasing Office', 'Supplier price increase', `Our vendors for ${SUPPLIES[plat].what} have raised prices by 40% for the next several months. Expect higher supply costs on ${PLATS[plat]} projects.`); }
  }
  if (G.flags.priceHike && G.week >= G.flags.priceHike.until) G.flags.priceHike = null;
  if (chance(0.12)) mailEvent();
}

// ---------- email events ----------
const MAILS = [
  () => mail('Physical Review Letters', 'Referee request', `Dear ${G.pi},\n\nWould you be willing to review the manuscript "${pick(G.arxiv.length ? G.arxiv : [{ t: 'Untitled' }]).t}"? We would appreciate your report within 3 weeks.`, [{ t: 'Accept (−8 energy, +rep)', k: 'referee' }, { t: 'Decline', k: 'dismiss' }]),
  () => mail('Intl. Journal of Advanced Everything', 'Dear Esteemed Professor!!!', `Greetings of the day! We have read your eminent paper with great interest and invite you to submit to our journal. Publication fee only $1,999. Acceptance guaranteed in 48 hours.`, [{ t: 'Delete', k: 'dismiss' }, { t: 'Reply with a fake paper about chickens', k: 'chicken' }]),
  () => mail(pick(['University of Edinburgh', 'Kyoto University', 'ETH Zurich', 'Perimeter Institute', 'University of Toronto']), 'Colloquium invitation', `We would be delighted if you could give a physics colloquium next term. We'll cover travel.`, [{ t: 'Accept (−12 energy, +3 rep, a night away from home)', k: 'colloq' }, { t: 'Politely decline', k: 'dismiss' }]),
  () => { if (team().length >= capacity()) return; const a = makePerson('undergrad'); G.applicants.push(a); mail(`${a.first} ${a.last}`, 'Research opportunities in your lab?', `Dear Professor,\n\nI am a sophomore and I am VERY interested in your research. I have read your website twice. I know Python (a little).\n\nBest,\n${a.first}`, [{ t: 'Take them on', k: 'ug', id: a.id }, { t: 'Decline politely', k: 'ugno', id: a.id }]); },
  () => mail('Department Admin', 'Mandatory training overdue', `Your "Preventing Workplace Harassment", "Cybersecurity Awareness" and "Lifting Heavy Boxes Correctly" trainings are overdue.`, [{ t: 'Do them now (−10 energy, goodwill +)', k: 'training' }, { t: 'Ignore', k: 'dismiss' }]),
  () => mail('Grant Review Panel', 'Will you serve on our panel?', `We are assembling a review panel next month. Three days in a windowless room in Virginia.`, [{ t: 'Serve (−20 energy, three days away, next grant odds ↑)', k: 'panel' }, { t: 'Decline', k: 'dismiss' }]),
];
function mailEvent() { pick(MAILS)(); }

export const MAIL_ACTIONS = {
  dismiss: () => 'Done.',
  referee: () => { if (G.energy < 8) return 'Too tired.'; G.energy -= 8; addRep(1); return 'You write a careful, fair report. You are not Reviewer 2. (+1 rep)'; },
  chicken: () => { all({ morale: 2 }); return 'Your paper "Do Chickens Dream of Electric Fields?" was accepted within the hour. Your students are delighted.'; },
  colloq: () => { if (G.energy < 12) return 'Too tired.'; G.energy -= 12; addRep(3); if (G.life) G.life.home -= 3; return 'Great talk, good questions. Three people ask about postdoc positions. You miss dinner at home.'; },
  ug: (m, a) => { const p = G.applicants.find(x => x.id === a.id); if (!p) return 'They already found another lab.'; if (team().length >= capacity()) return 'The lab is full.'; G.applicants = G.applicants.filter(x => x !== p); delete p.revealed; addPerson(p); return `${p.first} joins as an undergrad researcher.`; },
  ugno: (m, a) => { G.applicants = G.applicants.filter(x => x.id !== a.id); return 'Sent a kind reply.'; },
  training: () => { if (G.energy < 10) return 'Too tired.'; G.energy -= 10; gw(3); return 'You now know how to lift a box correctly.'; },
  panel: () => { if (G.energy < 20) return 'Too tired.'; G.energy -= 20; G.flags.jointGrant = true; gw(2); if (G.life) G.life.home -= 4; return 'Three days in Virginia. You learn exactly how panels think. (Next proposal boosted.)'; },
};
