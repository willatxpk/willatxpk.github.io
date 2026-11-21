// Home life (partner, kids, hobby, your own wellbeing) and the other professors in the department.
import { WPY, HOBBIES, EQUIP, CARDS } from './data.js';
import { G, hooks, int, pick, chance, clamp, wk, year, team, person, mod, rel, addPerson, makePerson, log, mail, queueVisit, proj, projNeeds, randomLook, personName, addRep, tenureScore, TENURE_BAR, borrowing, unlockCards, card, shuffle } from './sim.js';
import { N, C, T, note, lastNote, countNotes, trust, vary, memOf, gw, cul, all } from './talk.js';

const L = () => G.life;
const home = d => { const l = L(); l.home = clamp(l.home + d, 0, 100); };
const self = d => { const l = L(); l.self = clamp(l.self + d, 0, 100); };
const partner = () => L().partner;
const kid = i => L().kids[i || 0];
const hasKids = () => L().kids.length > 0;
const coupled = () => !!partner();
const hob = () => HOBBIES[L().hobby] || HOBBIES.running;
const prof = id => (G.profs || []).find(f => f.id === id);
const profRel = (f, d) => { f.rel = clamp(f.rel + d, 0, 100); };

// who is visiting or calling
export function lifeExtInfo(v) {
  const l = L(); if (!l) return null;
  if (v.ext === 'partner' && l.partner) return { name: l.partner.first, first: l.partner.first, role: 'Your partner', look: l.partner.look };
  if (v.ext === 'kid' && l.kids[v.kid || 0]) { const k = l.kids[v.kid || 0]; return { name: k.first, first: k.first, role: `Your kid, age ${k.age}`, look: k.look }; }
  if (v.ext === 'prof') { const f = prof(v.prof); return f ? { name: `Prof. ${f.first} ${f.last}`, first: f.first, role: `${f.field} · colleague`, look: f.look } : null; }
  if (v.ext === 'phone' && v.caller) {
    const names = { partner: l.partner ? l.partner.first : 'Home', school: 'School nurse', sibling: 'Your sister', doctor: 'Your doctor', friend: l.friend || 'Your best friend' };
    return { name: `${names[v.caller]} (phone)`, first: names[v.caller], role: 'On the phone', phone: true };
  }
  return null;
}
// the speaker object for family members, so memory sticks to them
const P = () => partner() ? Object.assign(partner(), { role: 'Your partner' }) : { name: 'Home' };
const K = i => { const k = kid(i); return k ? Object.assign(k, { role: `Your kid, age ${k.age}` }) : null; };
const F = f => Object.assign(f, { title: 'Prof.', role: `${f.field} · colleague` });

// ===================================================================
// FAMILY, HOBBIES, YOU
// ===================================================================
export const LIFE_EV = {};

const CLASH = () => {
  const s = team().filter(p => p.role === 'grad' || p.role === 'postdoc');
  const st = s.length ? pick(s) : null;
  return pick([
    { what: 'a call with the program officer you\'ve been chasing for months', cost: () => { G.flags.poBoost = null; gw(-1); return 'The program officer moves on to the next PI on their list.'; } },
    st ? { what: `${st.first}'s thesis-defense practice talk`, cost: () => { mod(st, { morale: -8, loyalty: -4 }); note(st, 'missedPractice', 'dismiss'); return `${st.first} practices without you. They notice.`; } } : null,
    { what: 'the grant deadline (submission closes at 5pm)', cost: () => { G.energy = clamp(G.energy - 15, 0, 100); return 'You finish the proposal at 2am instead. Exhausting.'; } },
    { what: 'a seminar by a speaker you personally invited', cost: () => { gw(-2); addRep(-1); return 'Your speaker eats lunch with the chair instead. Awkward.'; } },
    { what: 'a committee meeting the chair specifically asked you to attend', cost: () => { gw(-5); return 'The chair notices the empty chair.'; } },
  ].filter(Boolean));
};

LIFE_EV.fam_clash = {
  kind: 'life', cd: 5, w: () => coupled() || G.life.friend ? 1.6 : 0.5,
  run(c, say) {
    const l = L(); const st = c.v.st || (c.v.st = {});
    if (!st.occ) {
      const k = kid(); const p = partner();
      const occs = hasKids() ? [`${k.first}'s school play (${k.first} has a solo)`, `${k.first}'s soccer final`, `the parent-teacher conference`, `${k.first}'s science fair (they did their project on lasers, for you)`, ...(p ? [`${p.first}'s birthday dinner`] : [])] : coupled() ? [`${p.first}'s birthday dinner`, `your anniversary dinner`, `${p.first}'s award ceremony at work`, `dinner with ${p.first}'s parents`] : [`your best friend's wedding rehearsal`, `your friend's 40th birthday`, `the first gig of your friend's band`];
      st.kidAsk = hasKids() && c.v.ext === 'kid';
      st.occ = pick(st.kidAsk ? occs.filter(o => /play|soccer|science fair/.test(o)) : occs); st.clash = CLASH();
      if (!coupled() && !l.friend) l.friend = personName().first;
    }
    const speaker = st.kidAsk ? K(0) : coupled() ? P() : { name: l.friend, first: l.friend };
    const missed = l.missed || 0;
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', speaker, 'How much does this matter?', 'Understand the stakes', () => {
      st.asked = 1;
      const t = st.kidAsk ? `"I practiced every day. I asked ${partner() ? partner().first : 'everyone'} three times if you're coming."` : missed >= 2 ? `A pause. "You've missed ${missed} things this year. I've stopped expecting you. That's what it means."` : coupled() ? `"It matters to me. I'd like you there. I'm not going to beg."` : `"You've cancelled on me the last two times. Just saying."`;
      return LIFE_EV.fam_clash.run(c, t);
    }));
    const bonus = missed >= 2 ? 1.4 : 1;
    ch.push(T(c, 'warm', speaker, `I'll be there. Fully.`, `Home ↑↑ · you miss ${st.clash.what}`, () => { home(Math.round(10 * bonus)); self(3); l.kept = (l.kept || 0) + 1; const cost = st.clash.cost(); return `${st.kidAsk ? `${speaker.first} beams.` : 'You go. You put your phone in the glovebox.'} ${vary('went', ['It\'s one of the best evenings in months.', 'You\'re glad. You won\'t remember the meeting. You\'ll remember this.', 'Afterwards, in the car, everyone is laughing.'])} ${cost}`; }));
    ch.push(T(c, 'firm', speaker, 'I\'ll come, but I\'ll have to take the call from the parking lot.', 'Home ↑ a little · half the work cost', () => { home(3); if (chance(0.5)) st.clash.cost(); const twice = countNotes(speaker, 'fam_clash', 30) >= 2 && lastNote(speaker, 'fam_clash') && memOf(speaker).tones[1] === 'firm'; if (twice) home(-6); return twice ? `"You were on your phone again." It stings because it's true.` : `You make it for most of it. ${st.kidAsk ? speaker.first + ' saw you in the back, on your phone.' : 'Mostly present.'}`; }));
    ch.push(T(c, 'dismiss', speaker, 'I can\'t this time. Work.', `Home ↓↓ · your wellbeing ↓`, () => { home(-10 - 3 * missed); self(-3); l.missed = missed + 1; return missed >= 2 ? `Silence on the line. Then: "Okay." Just "okay". That's worse than shouting.` : st.kidAsk ? `${speaker.first}'s face falls. "...Okay." They try very hard not to cry in your office.` : `"Sure. Of course." You can hear the disappointment.`; }));
    const opening = st.kidAsk ? `${speaker.first} is standing in your doorway with a backpack. "Are you coming to ${st.occ.replace(`${speaker.first}'s`, 'my').replace(`(${speaker.first} has a solo)`, '(I have a solo!)')} on Thursday?"` : `${coupled() ? partner().first : l.friend} calls. "Don't forget: ${st.occ} is Thursday at six." Thursday at six is also ${st.clash.what}.`;
    return N(speaker, say || opening, ch);
  },
};

LIFE_EV.fam_dinner = {
  kind: 'life', cd: 4, w: () => coupled() ? (L().hours > 58 ? 2 : 0.8) : 0,
  run(c) {
    if (!coupled()) return null;
    const l = L(); const p = P();
    const prevLate = countNotes(p, 'fam_dinner', 20);
    const tone = l.home < 35 ? `"Are you coming home tonight? At all?"` : prevLate >= 2 && memOf(p).tones.slice(0, 2).every(t => t !== 'warm') ? `"Let me guess. One more hour?"` : vary('dinner', [`"Dinner's almost ready. Are you on your way?"`, `"I made the thing you like. Coming home?"`, `"${hasKids() ? `${kid().first} wants you to read the bedtime story tonight.` : 'Movie night tonight?'} When are you leaving?"`]);
    const lingering = team().find(x => x.stress > 60);
    const ch = [
      T(c, 'warm', p, 'On my way. Leaving now.', `Home ↑${lingering ? ` · ${lingering.first} was hoping to catch you` : ''}`, () => { home(5); self(2); if (lingering) mod(lingering, { morale: -2 }); return vary('home', ['You get home before the food is cold. Small victory.', `${hasKids() ? 'Bedtime story: done. Three voices, one of them a dragon.' : 'You actually watch the whole movie.'}`, 'Traffic is terrible. You don\'t care.']); }),
      T(c, 'firm', p, 'One more hour, I promise.', prevLate >= 2 ? 'They\'ve heard this before' : 'Home ↓ a little', () => { home(prevLate >= 2 ? -6 : -2); G.energy = clamp(G.energy + 3, 0, 100); return prevLate >= 2 ? `"It's never one hour." Click.` : `"Okay. One hour." It's two.`; }),
      T(c, 'dismiss', p, 'Don\'t wait up.', 'Home ↓', () => { home(-7); G.energy = clamp(G.energy + 5, 0, 100); return `"I never do anymore."`; }),
    ];
    if (hasKids()) ch.splice(1, 0, T(c, 'warm', p, 'Bring everyone here. Let\'s have a picnic in the office.', 'Home ↑ · the lab meets your family', () => { home(4); all({ morale: 2 }); return `${kid().first} spins in your chair. Your students teach ${kid().first} to say "decoherence". It's chaos. It's great.`; }));
    return N(p, `The phone on your desk rings. It's ${p.first}. ${tone}`, ch);
  },
};

LIFE_EV.fam_talk = {
  kind: 'life', cd: 10,
  run(c, say) {
    if (!coupled()) return null;
    const l = L(); const p = P(); const st = c.v.st || (c.v.st = {});
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', p, 'Tell me what\'s going on. I\'m listening.', 'Hear them out', () => { st.asked = 1; home(3); const t = l.hours > 60 ? `"You're working ${l.hours} hours a week. I counted. ${hasKids() ? `${kid().first} asked me if you live at the lab.` : 'I feel like I live alone.'}"` : (l.missed || 0) >= 2 ? `"You've missed ${l.missed} things that mattered this year. I keep making excuses for you."` : `"You're here, but you're not here. You're always thinking about the lab."`; return LIFE_EV.fam_talk.run(c, t); }));
    ch.push(T(c, 'warm', p, 'I\'ll cut back to 48 hours a week. Hold me to it for three months.', 'Home ↑ · work hours drop · a promise', () => { l.hours = Math.min(l.hours, 48); l.promise = { hours: 48, until: G.week + 12 }; home(10); return `"Okay. Three months." They want to believe you. (Your hours are set in the Life app. Keep them at 51 or below.)`; }));
    ch.push(T(c, 'warm', p, 'Let\'s get away this weekend. Just us.', '−$1,500 · home ↑ · your wellbeing ↑', () => { G.money -= 1500; home(12); self(8); G.energy = clamp(G.energy - 8, 0, 100); return `A cabin with no wifi. You talk about things that aren't physics.`; }, { cost: { money: 1500 } }));
    ch.push(T(c, 'warm', p, 'Would you see a counselor with me?', '−$600 · steady improvement for a while', () => { G.money -= 600; home(5); l.counsel = G.week + 10; return `"Yes. I'd like that."`; }));
    if (G.titleIdx === 0) ch.push(T(c, 'firm', p, `It's temporary. Tenure is in ${Math.max(1, 6 - year() + 1)} years.`, l.missed >= 2 ? 'They won\'t buy it' : 'Maybe', () => { if ((l.missed || 0) < 2 && l.home > 25) { home(2); return `"Okay. But I'm holding you to 'temporary'."`; } home(-6); return `"You said that last year."`; }));
    ch.push(T(c, 'dismiss', p, 'This is what the job is. You knew that.', 'Home ↓↓', () => { home(-10); self(-4); return `They leave without saying goodbye.`; }));
    return N(p, say || `${p.first} is standing in your office doorway. They've never come to your office before. "Can we talk? ...Here is fine."`, ch);
  },
};

LIFE_EV.fam_broken = {
  kind: 'life',
  run(c) {
    if (!coupled()) return null;
    const l = L(); const p = P();
    return N(p, `${p.first} calls. "You promised 48 hours. You're at ${l.hours} again. I'm not even angry. I'm just tired."`, [
      T(c, 'warm', p, 'You\'re right. I\'m fixing it tonight.', 'Hours back down · home ↓ a little', () => { l.hours = Math.min(l.hours, 48); l.promise.broken = false; home(-3); return `"Okay." A long breath. "Okay."`; }),
      T(c, 'firm', p, 'There\'s a deadline. After that, I promise.', 'Home ↓', () => { home(-9); l.promise = null; return `"There's always a deadline."`; }),
    ]);
  },
};

LIFE_EV.fam_ultimatum = {
  kind: 'life', cd: 8,
  run(c) {
    if (!coupled()) return null;
    const l = L(); const p = P();
    return N(p, `${p.first} sits down across from you, in the visitor's chair, like one of your students. "I can't keep doing this alone. Something has to change, or I don't think we make it."`, [
      T(c, 'warm', p, 'You\'re right. Two weeks of family leave, starting now.', 'Away 2 weeks · home ↑↑↑ · lab runs without you', () => { l.away = 2; home(30); self(10); l.hours = Math.min(l.hours, 50); return `You set an out-of-office reply for the first time in your career. ${p.first} cries a little. So do you.`; }),
      T(c, 'warm', p, 'I\'ll cut to 45 hours. For real this time.', 'Home ↑↑ · a promise for four months', () => { l.hours = 45; l.promise = { hours: 45, until: G.week + 16 }; home(16); return `"For real?" "For real." (Keep your hours at 48 or below.)`; }),
      T(c, 'dismiss', p, 'I need you to understand what my career demands.', 'You may lose them', () => {
        if (l.home > 10 && chance(0.4)) { home(-5); return `"I do understand. That's the problem." They leave. They come back that night, but something has changed.`; }
        l.status = 'single'; l.exPartner = p.first; l.partner = null; self(-30); l.home = 40;
        log(`${p.first} and you separated.`);
        return `They nod slowly. "Then I think we're done." ${hasKids() ? 'You see the kids every other weekend now.' : 'The apartment is very quiet that night.'}`;
      }),
    ]);
  },
};

LIFE_EV.fam_sick = {
  kind: 'life', cd: 10, w: () => hasKids() ? 0.7 : 0,
  run(c) {
    if (!hasKids()) return null;
    const k = kid(int(0, L().kids.length - 1)); const p = partner();
    return N({ name: 'School nurse' }, `The desk phone rings. "This is the school nurse. ${k.first} has a fever of 39. ${p ? `We couldn't reach ${p.first}.` : ''} Can someone pick them up?"`, [
      T(c, 'warm', P(), 'I\'m on my way.', '−12 energy · home ↑ · you work from the couch', () => { G.energy = clamp(G.energy - 12, 0, 100); home(6); return `Soup, cartoons and a feverish ${k.first} asleep on your lap while you answer email one-handed.`; }),
      ...(p ? [T(c, 'firm', P(), `Call ${p.first} again. I have a meeting.`, 'Home ↓', () => { home(-6); return `${p.first} leaves an important meeting to get ${k.first}. They don't say anything about it. They don't have to.`; })] : []),
      T(c, 'firm', P(), 'Ask the neighbor. I\'ll be home by four.', 'Home ↓ a little · guilt', () => { home(-2); self(-3); return `The neighbor is lovely about it. You still feel bad all afternoon.`; }),
    ]);
  },
};

LIFE_EV.fam_vacation = {
  kind: 'life', w: () => coupled() && wk() >= 38 && wk() <= 46 && G.life.vacYear !== year() ? 3 : 0,
  run(c) {
    if (!coupled()) return null;
    const l = L(); const p = P(); l.vacYear = year();
    return N(p, `${p.first} calls. "I found a cabin by a lake. Two weeks. ${hasKids() ? 'The kids are already packing.' : 'Just us.'} Can you actually come this year? And I mean actually."`, [
      T(c, 'warm', p, 'Yes. Fully offline. I\'ll leave the laptop at home.', 'Away 2 weeks · home ↑↑ · wellbeing ↑↑ · lab runs without you', () => { l.away = 2; home(18); self(22); G.flags.backFromVacation = G.week + 2; return `Two weeks of swimming, bad board games and sleep. You forget your own email password.`; }),
      T(c, 'firm', p, 'Yes, but I\'ll check email in the mornings.', 'Home ↑ · wellbeing ↑ · −8 energy', () => { home(6); self(6); G.energy = clamp(G.energy - 8, 0, 100); return `Every morning you sneak off with your phone. ${p.first} pretends not to notice.`; }),
      T(c, 'dismiss', p, 'Not this summer. Too much going on.', 'Home ↓↓ · wellbeing ↓', () => { home(-14); self(-6); l.missed = (l.missed || 0) + 1; return `${hasKids() ? 'They go without you. You get a photo of the lake every day.' : '"Fine. I\'ll go with my sister."'}`; }),
    ]);
  },
};

LIFE_EV.kid_visit = {
  kind: 'life', cd: 20, w: () => hasKids() ? 0.6 : 0,
  run(c) {
    const i = c.v.kid || 0; const k = K(i); if (!k) return null;
    const sight = G.equip.optics ? 'the lasers' : G.equip.fridge ? 'the giant golden fridge' : G.equip.cluster ? 'the blinking computers' : 'the lab';
    return N(k, `${k.first} bursts in${partner() ? `, and ${partner().first} waves from the hallway` : ''}. "Is this where you live now?" Then, before you can answer: "Can I see ${sight}?"`, [
      T(c, 'warm', k, `Come on. I'll show you ${sight}.`, '−5 energy · home ↑ · the team loves it', () => { G.energy = clamp(G.energy - 5, 0, 100); home(7); all({ morale: 2 }); L().kidPhysicist = (L().kidPhysicist || 0) + 1; return `Your students give ${k.first} safety goggles and a tour. ${k.first} announces they will be "a physicist and also a dragon".`; }),
      T(c, 'warm', k, 'Want to draw on my whiteboard?', 'Home ↑ · a new drawing on your whiteboard', () => { home(4); G.flags.kidDrawing = k.first; hooks.worldSync(); return `${k.first} draws you, the lab, and what is either an atom or a spider. It stays on the board.`; }),
      T(c, 'dismiss', k, 'I\'m really busy right now, sweetie.', 'Home ↓', () => { home(-5); return `${k.first} nods and goes very quiet.`; }),
    ]);
  },
};

LIFE_EV.partner_lunch = {
  kind: 'life', cd: 14, w: () => coupled() ? 0.5 : 0,
  run(c) {
    if (!coupled()) return null;
    const p = P();
    return N(p, `${p.first} appears in your doorway holding two takeout boxes. "Surprise. You forgot to eat again, didn't you."`, [
      T(c, 'warm', p, 'Close the door. Thirty minutes, no work talk.', 'Home ↑ · energy ↑ · wellbeing ↑', () => { home(6); self(4); G.energy = clamp(G.energy + 6, 0, 100); return `Thirty minutes. You laugh more than you have all week.`; }),
      T(c, 'warm', p, 'Come meet the lab!', 'Home ↑ · team ↑', () => { home(3); all({ morale: 2 }); return `${p.first} charms everyone. Your postdoc later says "your partner is way cooler than you".`; }),
      T(c, 'dismiss', p, 'I only have five minutes, sorry.', 'Home ↓ a little', () => { home(-3); return `"Five minutes. Okay." They eat their lunch in the car.`; }),
    ]);
  },
};

LIFE_EV.partner_career = {
  kind: 'life', w: () => coupled() && year() >= 3 && !G.flags.partnerJob ? 0.25 : 0,
  run(c, say) {
    if (!coupled()) return null;
    const p = P(); G.flags.partnerJob = true; const st = c.v.st || (c.v.st = {});
    const city = st.city || (st.city = pick(['Seattle', 'Boston', 'Zurich', 'Toronto', 'Denver']));
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', p, 'Do you want it? Honestly?', 'Ask', () => { st.asked = 1; return LIFE_EV.partner_career.run(c, `"Yes. It's the job I've wanted for ten years. But I won't take it if it ends us."`); }));
    ch.push(T(c, 'warm', p, 'Take it. We\'ll make long distance work.', 'Home stays steady · you both travel · wellbeing ↓', () => { L().longDistance = true; home(4); self(-6); return `Airport goodbyes every Sunday. It's hard. You're proud of them.`; }));
    ch.push(T(c, 'warm', p, 'Let me ask the chair about a spousal hire here.', `−10 energy · ${G.goodwill >= 55 ? 'good' : 'low'} odds (goodwill ${Math.round(G.goodwill)})`, () => { G.energy = clamp(G.energy - 10, 0, 100); if (G.goodwill >= 55 && chance(0.6)) { gw(-5); home(25); return `The chair pulls strings. A job opens up across campus. ${p.first} takes it. It's the best outcome you could have hoped for.`; } home(-4); return `The chair "can't promise anything". ${p.first} turns down ${city}. They don't complain. You notice them looking at the offer letter sometimes.`; }));
    ch.push(T(c, 'dismiss', p, 'Please don\'t take it. My career is here.', 'Home ↓↓', () => { home(-15); return `They turn it down. It sits between you for a long time.`; }));
    return N(p, say || `${p.first} calls, voice tight with excitement and something else. "I got an offer. In ${city}. A big one."`, ch);
  },
};

LIFE_EV.parent_health = {
  kind: 'life', cd: 150, w: () => year() >= 2 ? 0.12 : 0,
  run(c) {
    return N({ name: 'Your sister' }, `Your sister calls. "Don't panic. Dad fell. He's in the hospital. They think he'll be okay, but... can you come?"`, [
      T(c, 'warm', P(), 'I\'m booking a flight tonight.', 'Away 1 week · wellbeing ↑ later · lab runs without you', () => { L().away = 1; self(4); home(4); return `A week of hospital coffee and old family stories. Dad makes a full recovery and complains about the food the whole time.`; }),
      T(c, 'firm', P(), 'I\'ll call every day and come next month.', '−6 energy · wellbeing ↓', () => { G.energy = clamp(G.energy - 6, 0, 100); self(-6); return `You call every evening from the office. It isn't the same.`; }),
      T(c, 'dismiss', P(), 'Can you handle it? I\'m buried right now.', 'Wellbeing ↓↓ · your sister remembers', () => { self(-12); G.flags.sisterCold = true; return `A long pause. "Sure. I always do."`; }),
    ]);
  },
};

LIFE_EV.hobby_event = {
  kind: 'life', cd: 8, w: () => 1,
  run(c) {
    const l = L(); const h = hob();
    const evt = { climbing: 'a bouldering competition', running: 'a half marathon', piano: 'a small recital', band: 'a gig at the bar downtown', painting: 'a gallery night where one of your paintings is hanging', cooking: 'a dinner party you promised to cook for', hiking: 'a weekend hike to the ridge' }[l.hobby] || 'an event';
    const rusty = !l.hobbyTime;
    return N({ name: 'This weekend' }, `This weekend: ${evt}. ${rusty ? `You haven't touched ${h.line} in months.` : `You've been looking forward to it.`} There's also a stack of papers to review.`, [
      T(c, 'warm', P(), 'Go, and don\'t think about work.', `Wellbeing ↑↑ · −4 energy${coupled() ? ' · bring them along' : ''}`, () => { self(rusty ? 8 : 14); G.energy = clamp(G.energy - 4, 0, 100); if (coupled()) home(3); return vary('hobby', [`${h.icon} You come back Monday feeling like a person again.`, `${h.icon} Nobody there knows or cares what a Hamiltonian is. It's wonderful.`, `${h.icon} ${rusty ? 'You\'re rusty. You don\'t care.' : 'Best weekend in ages.'}`]); }),
      T(c, 'firm', P(), 'Go for a bit, then work.', 'Wellbeing ↑', () => { self(5); return `You leave early. Still worth it.`; }),
      T(c, 'dismiss', P(), 'Skip it. Papers.', 'Energy ↑ · wellbeing ↓', () => { self(-5); G.energy = clamp(G.energy + 6, 0, 100); return `The papers get reviewed. You don't remember any of them.`; }),
    ]);
  },
};

LIFE_EV.friends = {
  kind: 'life', cd: 10, w: () => coupled() ? 0.3 : 1.2,
  run(c) {
    const l = L(); if (!l.friend) l.friend = personName().first;
    const date = !coupled() && chance(0.5) && !l.exPartnerRecent;
    if (date) {
      l.dating = l.dating || 0;
      return N({ name: l.friend, first: l.friend }, l.dating ? `${l.friend} texts: "So?? Are you seeing them again Friday or what?"` : `${l.friend} calls. "I'm setting you up. They're smart, funny, and they think physics is 'kind of hot'. Friday at eight. Don't you dare cancel."`, [
        T(c, 'warm', { name: l.friend }, 'Fine. Friday at eight.', 'Wellbeing ↑ · who knows?', () => {
          self(6); l.dating++;
          if (l.dating >= 3 && chance(0.6)) { const n = personName(); l.partner = { first: n.first, look: randomLook('grad') }; l.status = 'partner'; l.dating = 0; home(15); mail(n.first, 'Dinner?', `Are we still on for tonight? I'll pick the restaurant this time. No talking about decoherence over dessert. 😄\n\n${n.first}`); return `Third date. Then a fourth. ${n.first} laughs at your terrible physics jokes. You're seeing someone.`; }
          return vary('date', ['It goes surprisingly well. You talk until the restaurant closes.', 'Awkward at first, then great. They want to see you again.', 'They ask what you do and actually listen to the answer.']);
        }),
        T(c, 'dismiss', { name: l.friend }, 'I really don\'t have time for this.', 'Wellbeing ↓ a little', () => { self(-2); l.dating = 0; return `"You never have time. That's the problem."`; }),
      ]);
    }
    return N({ name: l.friend, first: l.friend }, `${l.friend} texts: "${vary('friend', ['Trivia night tonight. Our team needs a physicist.', 'Game night at mine. Bring snacks.', 'I haven\'t seen you in a month. Are you alive?'])}"`, [
      T(c, 'warm', { name: l.friend }, 'I\'m in.', 'Wellbeing ↑ · −3 energy', () => { self(7); G.energy = clamp(G.energy - 3, 0, 100); return `You win trivia on a question about neutrinos. Your friends make you a crown.`; }),
      T(c, 'dismiss', { name: l.friend }, 'Can\'t, sorry. Next time.', 'Wellbeing ↓ a little', () => { self(-3); return `"Sure. Next time." You've said that a lot.`; }),
    ]);
  },
};

LIFE_EV.pi_burnout = {
  kind: 'life', cd: 12,
  run(c) {
    const l = L(); const worse = G.flags.piIgnored;
    return N({ name: 'Your doctor' }, worse ? `The phone on your desk. Your doctor, sounding very serious. "Your blood pressure is worse. You told me last time you'd slow down. I'm not asking anymore."` : `Your doctor calls with your checkup results. "Your blood pressure is up, you're not sleeping, and you told me you've had chest tightness. This is stress. It has to change."`, [
      T(c, 'warm', P(), 'Two weeks of medical leave. Starting Monday.', 'Away 2 weeks · wellbeing ↑↑↑', () => { l.away = 2; self(40); home(8); G.flags.piIgnored = false; return `Two weeks of sleep, walks and ${hob().line}. You'd forgotten what rested feels like.`; }),
      T(c, 'warm', P(), 'I\'ll cut my hours and protect my weekends.', 'Hours → 45 · hobby time on · wellbeing ↑', () => { l.hours = 45; l.hobbyTime = true; self(15); G.flags.piIgnored = false; return `You block out your weekends in the calendar. In red.`; }),
      T(c, 'dismiss', P(), 'I\'ll be fine. It\'s just a busy term.', worse ? 'Very bad idea' : 'Wellbeing ↓', () => { if (worse) { l.away = 4; self(30); G.flags.piIgnored = false; return `Two days later you collapse in the hallway outside the lab. Your students call the ambulance. Four weeks of forced leave. Nobody is impressed.`; } self(-5); G.flags.piIgnored = true; return `"I've heard that before," says your doctor.`; }),
    ]);
  },
};

// ===================================================================
// OTHER PROFESSORS
// ===================================================================
const pickProf = persona => { const fs = (G.profs || []).filter(f => !persona || [].concat(persona).includes(f.persona)); return fs.length ? pick(fs) : null; };
const relWord = f => f.rel >= 70 ? 'a friend' : f.rel >= 55 ? 'friendly' : f.rel >= 40 ? 'neutral' : 'frosty';

LIFE_EV.prof_collab = {
  kind: 'prof', persona: ['theorist', 'mentor', 'junior'], cd: 14,
  w: () => G.projects.some(p => p.stage === 'running') ? 1 : 0,
  run(c, say) {
    const f = F(prof(c.v.prof)); const st = c.v.st || (c.v.st = {});
    const pr = proj(st.pr || (st.pr = (pick(G.projects.filter(p => p.stage === 'running')) || {}).id)); if (!pr) return null;
    const ch = [];
    if (!st.asked) ch.push(T(c, 'curious', f, 'What exactly would you bring?', 'Hear the pitch', () => { st.asked = 1; return LIFE_EV.prof_collab.run(c, f.persona === 'theorist' ? `"A calculation. I think your signal should have a second peak nobody's predicted. If you see it, it's a much bigger paper."` : f.persona === 'junior' ? `"Honestly? A fresh pair of hands and a technique from my field. And I'd learn a lot from you."` : `"Forty years of knowing where the bodies are buried in this kind of experiment."`); }));
    ch.push(T(c, 'warm', f, 'Let\'s do it. You\'re on the paper.', `Quality ↑ · progress ↑ · ${f.first} ↑ · credit shared · new ideas`, () => { pr.qBonus = (pr.qBonus || 0) + (f.persona === 'theorist' ? 8 : 5); pr.progress = Math.min(99, pr.progress + 10); profRel(f, 12); pr.collab = f.id; unlockCards(shuffle((f.cards || []).filter(id => !G.unlocked.includes(id))).slice(0, 1), `Prof. ${f.last}`); return `${f.first} is in your group meeting the next week, filling a whiteboard.`; }));
    ch.push(T(c, 'firm', f, 'Yes, but my student leads the paper.', f.persona === 'oldguard' ? 'They will bristle' : `${f.first} ↑ a little`, () => { pr.qBonus = (pr.qBonus || 0) + 4; profRel(f, f.persona === 'junior' ? 8 : 3); return `"Of course. That's how it should be."`; }));
    ch.push(T(c, 'dismiss', f, 'We\'re good on our own, thanks.', `${f.first} ↓`, () => { profRel(f, -6); return `"Okay. Offer stands." It probably doesn't.`; }));
    return N(f, say || `${vary('pcollab', [`${f.first} knocks on your open door.`, `${f.first} leans in.`])} "I read your group's preprint on ${pr.title.split(' with ')[0].toLowerCase()}. I have an idea. Want to collaborate?"`, ch);
  },
};

LIFE_EV.prof_advice = {
  kind: 'prof', persona: 'mentor', cd: 16, w: () => 0.8,
  run(c, say) {
    const f = F(prof(c.v.prof)); const asked = c.v.asked = c.v.asked || {};
    const again = t => LIFE_EV.prof_advice.run(c, t);
    const ch = [];
    if (!asked.ten && G.titleIdx === 0) ch.push(T(c, 'curious', f, 'How does my tenure case look, honestly?', 'Frank assessment', () => { asked.ten = 1; profRel(f, 3); const s = tenureScore(); const pubs = G.papers.reduce((a, p) => a + p.rep, 0); const weak = pubs < 80 ? 'papers in good journals' : G.grantsWon < 3 ? 'grants' : G.graduated < 1 ? 'a graduated student' : 'colleague support'; return again(s >= TENURE_BAR ? `"You're fine. Stop worrying and do good science."` : `"Honestly? You're at about ${Math.round(s / TENURE_BAR * 100)}% of where you need to be. Your weakest area is ${weak}."`); }));
    if (!asked.grant) ch.push(T(c, 'curious', f, 'Any advice on my next grant?', 'Next proposal odds ↑', () => { asked.grant = 1; G.flags.jointGrant = true; profRel(f, 3); return again(`"Send me your draft. I'll mark it up." She does, in red ink, and it's twice as good afterward.`); }));
    if (!asked.life) ch.push(T(c, 'curious', f, 'How did you balance all this with a life?', 'Your wellbeing ↑', () => { asked.life = 1; self(8); profRel(f, 4); return again(L().hours > 60 ? `She looks at you over her glasses. "I didn't, for a while. It cost me a marriage. Go home at six. The lab will still be there."` : `"Protect one thing that has nothing to do with physics. For me it was the garden. What's yours?" You tell her about ${hob().line}.`); }));
    const hidden = team().find(p => p.traits.some(t => !p.flags['known_' + t]));
    if (!asked.stud && hidden) ch.push(T(c, 'curious', f, `I can't read ${hidden.first}. Any advice?`, 'Insight into a student', () => { asked.stud = 1; for (const t of hidden.traits) hidden.flags['known_' + t] = true; return again(`"I had ${hidden.first} in my class. ${hidden.traits.map(t => ({ anxious: 'Very anxious. Needs reassurance more than deadlines.', hothead: 'Hot-tempered, but loyal if you\'re fair.', ambitious: 'Ambitious. Give them ownership.', slacker: 'Talented, a little lazy. Needs structure.', perfectionist: 'A perfectionist. Watch for burnout.', industry: 'They\'ll leave for industry if you\'re not careful.' }[t])).filter(Boolean)[0] || 'Solid. Just talk to them more.'}"`); }));
    ch.push(C('Thank you, Ruth. Really.', '', () => { profRel(f, 2); return null; }));
    return N(f, say || `${f.first} ${f.last} stops by with two coffees. "I was walking past. You looked like you could use one. How are you holding up?"`, ch);
  },
};

LIFE_EV.prof_junior = {
  kind: 'prof', persona: 'junior', cd: 16, w: () => 0.8,
  run(c) {
    const f = F(prof(c.v.prof));
    const q = c.v.q || (c.v.q = pick(['I have to hire my first student and I\'m terrified of picking wrong.', 'My first grant got rejected. Reviewer 2 called it "naive". I haven\'t slept.', 'My teaching evaluations came back. One just says "no".', 'I think I\'m in over my head.']));
    return N(f, `${f.first} hovers at your door. "Sorry, do you have a minute? ${q}"`, [
      T(c, 'warm', f, 'Sit down. Tell me everything.', `−8 energy · ${f.first} ↑↑ · goodwill ↑ · your wellbeing ↑`, () => { G.energy = clamp(G.energy - 8, 0, 100); profRel(f, 14); gw(2); self(3); if (chance(0.3)) { const a = makePerson('grad'); G.nextId++; a.revealed = 2; a.interviewed = false; a.wants = 20; G.applicants.push(a); return `An hour later ${f.first} leaves with a plan. Next week, they send you a great student who's a better fit for your lab than theirs. (Check Hiring.)`; } return `An hour later ${f.first} leaves with a plan and a lot less panic. You remember being exactly where they are.`; }, { cost: { energy: 8 } }),
      T(c, 'firm', f, 'Quick version: it happens to everyone. Keep going.', `${f.first} ↑ a little`, () => { profRel(f, 4); return `"Thanks. Yeah." It helped a bit.`; }),
      T(c, 'dismiss', f, 'Sorry, I\'m slammed today.', `${f.first} ↓`, () => { profRel(f, -8); return `"Of course! Sorry to bother you." They won't ask again.`; }),
    ]);
  },
};

LIFE_EV.prof_space = {
  kind: 'prof', persona: 'neighbor', cd: 24, w: () => 0.6,
  run(c) {
    const f = F(prof(c.v.prof));
    const noisy = !G.equip.vibration && ['vacuum', 'cryostat', 'fridge'].find(k => G.equip[k]);
    if (noisy) {
      const src = { vacuum: 'roughing pumps', cryostat: 'helium compressor', fridge: 'pulse-tube compressor' }[noisy];
      return N(f, `${f.first} ${f.last} doesn't sit down. "Your ${src} are shaking the floor. My STM can't get atomic resolution. I've lost three nights of data."`, [
        T(c, 'warm', f, 'I\'m sorry. I\'ll put them on vibration isolation this week.', `−$5,000 · ${f.first} ↑↑`, () => { G.money -= 5000; profRel(f, 15); return `"Thank you. Seriously." Arai brings you a bottle of good sake the following week.`; }, { cost: { money: 5000 } }),
        T(c, 'firm', f, 'Let\'s agree on quiet hours: compressors on a schedule.', `${f.first} ↑ · your progress ↓ a little`, () => { profRel(f, 6); for (const p of G.projects.filter(p => p.stage === 'running' && projNeeds(p.cards).includes(noisy))) p.progress = Math.max(0, p.progress - 4); return `A compromise. Neither of you loves it.`; }),
        T(c, 'dismiss', f, 'My experiment needs them. Sorry.', `${f.first} ↓↓ · goodwill ↓`, () => { profRel(f, -14); gw(-3); return `"Then I'll take it to the space committee." He does.`; }),
      ]);
    }
    return N(f, `${f.first} ${f.last} leans in. "You've got two empty benches. My group is growing. Any chance I could borrow them for a year?"`, [
      T(c, 'warm', f, 'Sure. Take them.', `${f.first} ↑↑ · goodwill ↑`, () => { profRel(f, 15); gw(3); G.flags.lentBenches = G.week + WPY; return `"I owe you one." He means it.`; }),
      T(c, 'firm', f, 'Only if I can borrow time on your fridge and STM in return.', `Trade: borrow his equipment`, () => { profRel(f, 6); for (const k of f.equip) G.borrowed[k] = G.week + 24; return `"Deal." You shake on it. (You can use his ${f.equip.map(k => EQUIP[k].name).join(', ')} for 24 weeks.)`; }),
      T(c, 'dismiss', f, 'I\'m about to hire. I need them.', `${f.first} ↓`, () => { profRel(f, -6); return `"Okay." He doesn't believe you.`; }),
    ]);
  },
};

LIFE_EV.prof_politics = {
  kind: 'prof', persona: 'oldguard', cd: 80, w: () => year() >= 2 && !G.flags.election ? 0.5 : 0,
  run(c) {
    const f = F(prof(c.v.prof));
    const vote = side => () => { G.flags.election = { week: G.week + 6, side }; return side === 'graves' ? `"Good. I knew I could count on you." He shakes your hand a little too long.` : side === 'chair' ? `He goes very still. "I see." He'll remember this.` : `"Neutral. Hm. That's a choice too."`; };
    return N(f, `${f.first} ${f.last} closes the door behind him, which he never does. "The chair election is next month. I'm running against Lindqvist. I'd like to count on your vote. And your voice at the faculty meeting."`, [
      T(c, 'warm', f, 'You have my support.', `${f.first} ↑↑ · if he loses, goodwill ↓`, () => { profRel(f, 15); return vote('graves')(); }),
      T(c, 'firm', f, 'I\'m staying neutral.', `${f.first} ↓ a little`, () => { profRel(f, -4); return vote('neutral')(); }),
      T(c, 'dismiss', f, 'I\'m backing Lindqvist.', `${f.first} ↓↓ · if Lindqvist wins, goodwill ↑`, () => { profRel(f, -15); return vote('chair')(); }),
    ]);
  },
};

LIFE_EV.prof_poach = {
  kind: 'prof', persona: ['neighbor', 'oldguard', 'theorist'], cd: 40, w: () => require_room() ? 0.4 : 0,
  run(c) {
    const f = F(prof(c.v.prof));
    const s = c.v.s || (c.v.s = makePerson(pick(['grad', 'grad', 'postdoc'])));
    return N(f, `It's not ${f.first} at your door. It's ${s.first} ${s.last}, one of ${f.first}'s ${s.role === 'grad' ? 'students' : 'postdocs'}. "I'm really unhappy in Prof. ${f.last}'s group. Could I join yours? Please don't tell them I asked."`, [
      T(c, 'warm', f, 'Talk to your advisor first. If they agree, my door is open.', `${f.first} ↑ · they might join later`, () => { profRel(f, 8); if (chance(0.45)) { G.nextId++; s.revealed = 2; s.interviewed = true; s.wants = 0; G.applicants.push(s); return `A week later ${f.first} emails: "${s.first} told me. Take them, with my blessing." (Check Hiring.)`; } return `${s.first} stays put. ${f.first} hears how you handled it and appreciates it.`; }),
      T(c, 'firm', f, 'Okay. Welcome aboard.', `Free experienced hire · ${f.first} ↓↓ · goodwill ↓`, () => { if (team().length >= 6 + (G.equip.expansion ? 4 : 0)) return `You realize you have no bench for them.`; G.nextId++; delete s.revealed; addPerson(s); profRel(f, -22); gw(-4); return `${s.first} moves their desk that afternoon. ${f.first} walks past your office without looking in, for months.`; }),
      T(c, 'dismiss', f, 'I can\'t get involved. Sorry.', '', () => `${s.first} nods and leaves. You see them in the hallway sometimes, looking tired.`),
    ]);
  },
};
function require_room() { return team().length < 6 + (G.equip.expansion ? 4 : 0); }

LIFE_EV.prof_lunch = {
  kind: 'prof', cd: 8, w: () => 1,
  run(c) {
    const f = F(prof(c.v.prof));
    const gossip = () => {
      if (G.rival.focus && chance(0.5)) { G.rival.rel = Math.max(G.rival.rel, 10); return `Over dessert, ${f.first} mentions that Voss's group is "all in on ${G.rival.focus.map(id => CARDS.find(x => x.id === id).name).join(' + ')}". (Now visible in the arXiv app.)`; }
      if (chance(0.5)) { G.calls.push({ id: pick(['nsf', 'doe', 'onr']), deadline: G.week + 8 }); G.calls = G.calls.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i); return `${f.first} tips you off about a funding call opening next week. (Check Grants.)`; }
      return `${f.first} tells a story about a 1980s experiment involving a forklift and a liquid nitrogen dewar. You laugh until you cry.`;
    };
    return N(f, `${f.first} ${f.last} knocks. "Faculty club, lunch, twenty minutes? ${vary('plunch', ['My treat.', 'The soup is actually good today.', 'I need to complain to someone who isn\'t my students.'])}"`, [
      T(c, 'warm', f, 'Absolutely.', `−4 energy · ${f.first} ↑ · wellbeing ↑ · gossip`, () => { G.energy = clamp(G.energy - 4, 0, 100); profRel(f, 7); self(4); return gossip(); }),
      T(c, 'dismiss', f, 'Rain check? Buried today.', `${f.first} ↓ a little`, () => { profRel(f, -2); return countNotes(f, 'prof_lunch', 40) >= 2 && memOf(f).tones[1] === 'dismiss' ? `"You always say that." They stop asking.` : `"Sure, next time."`; }),
    ]);
  },
};

LIFE_EV.prof_crisis = {
  kind: 'prof', persona: ['neighbor', 'junior', 'theorist'], cd: 60, w: () => 0.3,
  run(c) {
    const f = F(prof(c.v.prof));
    return N(f, `${f.first} sits down heavily. "My big grant didn't get renewed. I might have to let a student go. I don't know what to do."`, [
      T(c, 'warm', f, 'I can cover one of your students for six months.', `−$40,000 · ${f.first} ↑↑↑ · goodwill ↑`, () => { G.money -= 40000; profRel(f, 25); gw(5); return `${f.first} has to look away for a second. "I won't forget this."`; }, { cost: { money: 40000 } }),
      T(c, 'warm', f, 'Let\'s write a joint bridge proposal together.', `−10 energy · ${f.first} ↑↑ · next proposal odds ↑`, () => { G.energy = clamp(G.energy - 10, 0, 100); profRel(f, 12); G.flags.jointGrant = true; return `Two evenings at a whiteboard. It's a genuinely good proposal.`; }),
      T(c, 'firm', f, 'That\'s rough. I\'m sorry.', `${f.first} ↑ a little`, () => { profRel(f, 2); return `"Thanks." They leave the same way they came in.`; }),
    ]);
  },
};

LIFE_EV.prof_review = {
  kind: 'prof', cd: 30, w: () => 0.4,
  run(c) {
    const f = F(prof(c.v.prof));
    return N(f, `${f.first} holds out a thick printout. "Would you read my proposal draft before Friday? Be brutal."`, [
      T(c, 'warm', f, 'Of course. I\'ll do it properly.', `−10 energy · ${f.first} ↑↑ · they'll return the favor`, () => { G.energy = clamp(G.energy - 10, 0, 100); profRel(f, 12); G.flags.jointGrant = true; return `You cover it in comments. It gets funded. ${f.first} insists on reading your next one in return.`; }),
      T(c, 'firm', f, 'I can skim it.', `${f.first} ↑`, () => { profRel(f, 3); return `"Thanks, anything helps."`; }),
      T(c, 'dismiss', f, 'Sorry, no bandwidth this week.', `${f.first} ↓`, () => { profRel(f, -5); return `"No worries." There are some worries.`; }),
    ]);
  },
};

LIFE_EV.prof_borrow = {
  kind: 'prof',
  run(c) {
    const f = F(prof(c.v.prof)); const k = c.v.k; if (!k || !EQUIP[k]) return null;
    const e = EQUIP[k];
    const asked = c.v.asked || (c.v.asked = {});
    if (borrowing(k) || G.equip[k]) return null;
    const yes = (w, t) => { G.borrowed[k] = G.week + w; hooks.toast(`🔑 Borrowing ${f.first}'s ${e.name} for ${w} weeks`, 'good'); return t; };
    const ch = [];
    if (f.rel >= 55) ch.push(T(c, 'warm', f, `Could my group use your ${e.name} for a while?`, `Likely yes (${relWord(f)})`, () => { profRel(f, 2); return yes(20, `"Of course. Just log your time and don't crash anything." Twenty weeks.`); }));
    else if (f.rel >= 40) ch.push(T(c, 'warm', f, `Could my group use your ${e.name} for a while?`, `They're ${relWord(f)}: they'll want something`, () => N(f, `"Hm. What's in it for my group?"`, [
      T(c, 'warm', f, 'Co-authorship on whatever we measure.', 'Fair trade', () => { profRel(f, 6); for (const p of G.projects.filter(p => p.stage === 'running' && projNeeds(p.cards).includes(k))) p.collab = f.id; return yes(16, `"Deal." Sixteen weeks.`); }),
      T(c, 'warm', f, 'I\'ll cover the running costs. $6,000.', '−$6,000', () => { G.money -= 6000; profRel(f, 3); return yes(16, `"That works." Sixteen weeks.`); }),
      T(c, 'dismiss', f, 'Never mind.', '', () => `"Okay." Awkward.`),
    ])));
    else ch.push(T(c, 'warm', f, `Could my group use your ${e.name}?`, `They're ${relWord(f)}. Probably no.`, () => { if (chance(0.2)) return yes(8, `A long pause. "Eight weeks. That's it."`); profRel(f, -2); return `"I don't think that's going to work." Maybe build that relationship first.`; }));
    if (!asked.small) ch.push(T(c, 'curious', f, 'How\'s your group doing, anyway?', `${f.first} ↑`, () => { asked.small = 1; profRel(f, 4); return N(f, `They talk for ten minutes about their students and a fridge leak. You listen. It helps.`, LIFE_EV.prof_borrow.run(c).choices); }));
    return N(f, `${f.first} ${f.last} stops by. "You wanted to talk?"`, ch);
  },
};

LIFE_EV.prof_coffee = {
  kind: 'prof',
  run(c, say) {
    const f = F(prof(c.v.prof)); const asked = c.v.asked = c.v.asked || {};
    const again = t => LIFE_EV.prof_coffee.run(c, t);
    const ch = [];
    if (!asked.how) ch.push(T(c, 'curious', f, 'How are things with you, really?', `${f.first} ↑`, () => { asked.how = 1; profRel(f, 5); return again({ theorist: `"I proved something beautiful last week and nobody cares. Want to see?" They grab your whiteboard.`, oldguard: `"The department is changing. I'm not sure there's a place for people like me in it." A rare moment of honesty.`, neighbor: `"My fridge has a leak and my best student is leaving. So, great."`, junior: `"I think I'm finally getting the hang of it. Mostly thanks to people like you."`, mentor: `"I'm thinking about retiring. Then I think about my students and I don't."` }[f.persona]); }));
    if (!asked.sci) ch.push(T(c, 'curious', f, 'Want to talk science?', 'New research ideas from their field', () => { asked.sci = 1; profRel(f, 3); const u = unlockCards(shuffle((f.cards || []).filter(id => !G.unlocked.includes(id))).slice(0, 2), null, true); const idea = u.length ? ` They sketch out ${u.map(id => card(id).name).join(' and ')} for you. (New brainstorm cards.)` : ''; if (G.projects.some(p => p.stage === 'running') && chance(0.6)) { queueVisit({ ev: 'prof_collab', ext: 'prof', prof: f.id, pri: 3 }); return again(`An hour flies by.${idea} "I want to think about your experiment more. I'll come by." (A collaboration offer is coming.)`); } return again(`An hour of good arguments.${idea || ' You leave with a few half-formed ideas.'}`); }));
    const need = G.projects.filter(p => p.stage === 'running').flatMap(p => projNeeds(p.cards)).find(k => !G.equip[k] && !borrowing(k) && f.equip.includes(k));
    if (!asked.borrow && need) ch.push(T(c, 'warm', f, `Could my group borrow time on your ${EQUIP[need].name}?`, `They're ${relWord(f)}`, () => { asked.borrow = 1; c.v.k = need; return LIFE_EV.prof_borrow.run(c); }));
    if (!asked.adv && f.persona === 'mentor') ch.push(T(c, 'curious', f, 'Can I ask for some advice?', 'Mentor talk', () => { asked.adv = 1; return LIFE_EV.prof_advice.run(c); }));
    ch.push(C('Good talking to you.', '', () => { profRel(f, 2); return null; }));
    return N(f, say || `${f.first} ${f.last} drops in with two coffees. "You wanted to catch up?"`, ch);
  },
};

// ===================================================================
// LIFE DIRECTOR
// ===================================================================
const SOCIAL = { fam_clash: 'a family event', friends: 'plans with friends', hobby_event: 'your weekend activity', fam_vacation: 'the summer trip', partner_lunch: 'lunch out' };
export const footHurt = () => G.life && G.life.footUntil > G.week;
export function lifeDirector(cooled) {
  const l = L(); if (!l) return;
  // optional chaos setting: sitting on your own foot
  const footPct = G.footChance ?? (G.footMode ? 1 : 0); // percent chance per week, set in Settings
  if (footPct > 0 && !footHurt() && chance(footPct / 100)) {
    l.footUntil = G.week + 4; self(-6);
    const h = HOBBIES[l.hobby];
    mail('Campus Health Center', 'Diagnosis: you sat on your foot', `You sat on your foot at a strange angle during a long meeting and sprained it. Crutches for four weeks.

All social and athletic events are cancelled until it heals${['climbing', 'running', 'hiking'].includes(l.hobby) ? `, including ${h.name.toLowerCase()}` : ''}.${l.partner ? `

(${l.partner.first} laughed for a full minute before helping you to the car.)` : ''}`);
    hooks.toast('🦶 You sat on your foot. Crutches for a month: no social or athletic events.', 'bad');
    log('Sat on own foot. Crutches for a month.');
  }
  const q = (v, front) => { if (!G.queue.some(x => x.ev === v.ev)) queueVisit(v, front); };
  // urgent
  if (l.self < 12 && cooled('pi_burnout')) { q({ ev: 'pi_burnout', ext: 'phone', caller: 'doctor', pri: 4 }, true); G.cooldowns.pi_burnout = G.week; }
  if (coupled()) {
    if (l.home < 15 && cooled('fam_ultimatum')) { q({ ev: 'fam_ultimatum', ext: 'partner', pri: 4 }, true); G.cooldowns.fam_ultimatum = G.week; }
    else if (l.home < 35 && cooled('fam_talk') && chance(0.3)) { q({ ev: 'fam_talk', ext: 'partner', pri: 3 }); G.cooldowns.fam_talk = G.week; }
  }
  // promises to your partner
  if (l.promise) {
    if (G.week <= l.promise.until && l.hours > l.promise.hours + 3 && !l.promise.broken) { l.promise.broken = true; if (coupled()) q({ ev: 'fam_broken', ext: 'phone', caller: 'partner', pri: 3 }); }
    else if (G.week > l.promise.until) { if (!l.promise.broken && coupled()) { home(8); l.kept = (l.kept || 0) + 1; mail(partner().first, 'Thank you', 'Three months. You actually did it. I noticed. We all did.\n\nDinner\'s at six. See you there.'); } l.promise = null; }
  }
  if (l.counsel && G.week < l.counsel) home(1.2);
  if (l.longDistance) { self(-0.3); home(-0.3); }
  if (G.flags.backFromVacation && G.week >= G.flags.backFromVacation) { G.flags.backFromVacation = 0; mail('Your lab', 'Welcome back!', `While you were away: ${team().length} people kept things running. ${G.queue.length} people want to see you. Someone labeled every cable in the lab.`); }
  if (G.flags.election && G.week >= G.flags.election.week) {
    const e = G.flags.election; G.flags.election = null; G.flags.electionDone = true;
    const gravesWins = chance(0.45);
    const win = gravesWins ? 'Walter Graves' : 'Harold Lindqvist';
    if (e.side === 'graves') gw(gravesWins ? 8 : -6); else if (e.side === 'chair') gw(gravesWins ? -8 : 6);
    if (gravesWins) { G.flags.chairName = 'Prof. Walter Graves'; }
    mail('Department of Physics', 'Chair election results', `${win} has been elected department chair.${e.side === 'graves' ? (gravesWins ? ' Graves thanks you personally.' : ' Lindqvist noticed who you backed.') : e.side === 'chair' ? (gravesWins ? ' Graves noticed who you backed.' : ' Lindqvist thanks you for your support.') : ''}`);
  }
  if (G.flags.lentBenches && G.week >= G.flags.lentBenches) { G.flags.lentBenches = 0; const f = pickProf('neighbor'); if (f) profRel(f, 4); }
  // lost a colleague's trust? It shows at tenure time.

  // random life event
  const lifeChance = l.status === 'family' ? 0.32 : l.status === 'partner' ? 0.26 : 0.2;
  if (chance(lifeChance) && G.queue.length < 5) rollFrom('life', cooled, (id, e) => {
    if (footHurt() && SOCIAL[id]) { if (l.footMail !== G.week) { l.footMail = G.week; self(-2); mail('Your calendar', `Cancelled: ${SOCIAL[id]}`, `You had to cancel ${SOCIAL[id]} because of your foot. ${l.partner ? 'Everyone understands. Mostly.' : 'Your friends send a get-well meme.'}`); } return null; }
    if (id === 'fam_clash') return { ev: id, ext: c_clashExt(), caller: coupled() ? 'partner' : 'friend' };
    if (id === 'fam_dinner' || id === 'fam_vacation' || id === 'partner_career') return { ev: id, ext: 'phone', caller: 'partner' };
    if (id === 'fam_sick') return { ev: id, ext: 'phone', caller: 'school' };
    if (id === 'parent_health') return { ev: id, ext: 'phone', caller: 'sibling' };
    if (id === 'kid_visit') return { ev: id, ext: 'kid', kid: int(0, l.kids.length - 1) };
    if (id === 'partner_lunch') return { ev: id, ext: 'partner' };
    if (id === 'friends') return { ev: id, ext: 'phone', caller: 'friend' };
    if (id === 'hobby_event') return { ev: id, ext: 'phone', caller: coupled() ? 'partner' : 'friend' };
    return null;
  });
  // random colleague visit
  if (chance(0.17) && G.queue.length < 5) rollFrom('prof', cooled, (id, e) => { const f = pickProf(e.persona); return f ? { ev: id, ext: 'prof', prof: f.id } : null; });
}
// the kid sometimes asks in person; otherwise it's a phone call
function c_clashExt() { return hasKids() && chance(0.4) ? 'kid' : 'phone'; }

function rollFrom(kind, cooled, mk) {
  const cand = [];
  for (const id in LIFE_EV) { const e = LIFE_EV[id]; if (e.kind !== kind || !e.w || !cooled(id)) continue; const w = e.w({}); if (w > 0) cand.push([w, id, e]); }
  const tot = cand.reduce((s, x) => s + x[0], 0); if (!tot) return;
  let r = Math.random() * tot;
  for (const [w, id, e] of cand) { r -= w; if (r <= 0) { const v = mk(id, e); if (v) { if (v.ext === 'kid' && v.ev === 'fam_clash') v.kid = 0; queueVisit(v); G.cooldowns[id] = G.week; } return; } }
}
