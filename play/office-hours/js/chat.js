// Small talk and personal lives. Every lab member has an ongoing storyline outside the lab that moves
// forward over the weeks, remembers what you told them, and comes back to it. On top of that there is a
// large pool of drop-in topics: physics questions, small requests, advice, gossip and reactions to what
// is happening in the lab. Nothing repeats for the same person, and their answers depend on personality.
import { G, pick, chance, clamp, has, mod, team, person, rel, relOf, int, log, hooks, addRep } from './sim.js';
import { N, C, T, note, memOf, trust, vary, opener, react, withReact, cul, gw, all, worstRel, bestRel } from './talk.js';

// ---------- helpers ----------
function fx(A, o = {}) {
  const { money, culture, away, self, skill, goodwill, team: tm, ...rest } = o;
  if (skill) { const k = skill === 'any' ? pick(['exp', 'theory', 'code']) : skill; A.skill[k] = clamp(A.skill[k] + 1, 1, 10); }
  mod(A, rest);
  if (money) G.money -= money;
  if (culture) cul(culture);
  if (goodwill) gw(goodwill);
  if (tm) all(tm, [A]);
  if (away) A.away = Math.max(A.away || 0, away);
  if (self && G.life) G.life.self = clamp(G.life.self + self, 0, 100);
}
const hintOf = o => {
  if (!o) return '';
  const h = [];
  const arrow = (v, name) => h.push(`${name} ${v > 0 ? '↑' : '↓'}`);
  if (o.money) h.push(`−$${o.money.toLocaleString()}`);
  if (o.morale) arrow(o.morale, 'morale');
  if (o.stress) arrow(o.stress, 'stress');
  if (o.loyalty) arrow(o.loyalty, 'trust');
  if (o.skill) h.push('skill may grow');
  if (o.culture) arrow(o.culture, 'lab culture');
  if (o.team) h.push('whole lab ' + (Object.values(o.team)[0] > 0 ? '↑' : '↓'));
  if (o.away) h.push(`away ${o.away} wk`);
  if (o.self) arrow(o.self, 'your wellbeing');
  if (o.goodwill) arrow(o.goodwill, 'goodwill');
  return h.join(' · ');
};
const other = A => { const t = team().filter(p => p !== A && !p.away); return t.length ? pick(t) : null; };
const PETNAMES = ['Planck', 'Boltzmann', 'Noether', 'Bose', 'Fermi', 'Higgs', 'Curie', 'Dirac', 'Meitner', 'Feynman'];
const BANDS = ['Destructive Interference', 'The Spin Waves', 'Zero-Point Energy', 'Dark Counts', 'The Lock-In Amplifiers', 'Shot Noise'];
const GYMS = ['the climbing gym on 5th', 'the bouldering place by the river', 'the old warehouse gym'];

// Each person carries: story (current storyline), done (finished storylines), seen (topics used), cb (callbacks)
export function lifeOf(A) {
  if (!A.chat) A.chat = { story: null, done: [], seen: [], cb: [], intl: chance(0.35) };
  const L = A.chat;
  if (!L.story || (L.story.stage >= STORIES[L.story.id].stages.length)) {
    if (L.story) L.done.push(L.story.id);
    const pool = Object.values(STORIES).filter(s => !L.done.includes(s.id) && (!s.cond || s.cond(A, L)));
    const s = pool.length ? pick(pool) : null;
    L.story = s ? { id: s.id, stage: 0, next: G.week + int(0, 6), said: [], v: {} } : null;
  }
  return L;
}
export const storyDue = A => { const L = lifeOf(A); return L.story && G.week >= L.story.next; };
export const storyTopic = A => { const L = lifeOf(A); return L.story && L.story.stage > 0 ? STORIES[L.story.id].topic(A, L.story) : null; };

// ---------- storylines ----------
// stage(A, s, ctx) → { text, ch: [[label, tone, effects, reply, key], ...] }
const STORIES = {};
const story = (id, topic, stages, cond) => { STORIES[id] = { id, topic, stages, cond }; };

story('race', () => 'How\'s the half-marathon training?', [
  A => ({ text: `"So, random thing. I signed up for a half marathon. It's twelve weeks away. I have never run more than 5k in my life."`, ch: [
    ['Love it. Shift your hours so you can train in daylight.', 'warm', { morale: 6, stress: -4, loyalty: 3 }, `"Really? I was going to train at 5am so nobody noticed." They look relieved.`, 'support'],
    ['I ran one in grad school. Buy real shoes and go slower than feels right.', 'curious', { morale: 4, loyalty: 4 }, `They write "SHOES. SLOW." on the back of a lab notebook page.`, 'tips'],
    ['Just don\'t let it eat into lab time.', 'firm', { morale: -3 }, `"No, of course not."`, 'lab'],
  ] }),
  (A, s) => ({ text: s.said[0] === 'lab' ? `"Week eight of training. I've been running at 10pm so I don't miss lab hours, and my knee is making a noise like a dying turbo pump."` : `"Week eight. I ran 15k on Sunday! But my knee is making a noise like a dying turbo pump."`, ch: [
    ['See a physiotherapist. Take a few easy days.', 'warm', { stress: -6, loyalty: 3 }, `"Okay. Yeah. That's probably smart."`, 'rest'],
    ['Ice it and keep going. You\'re so close.', 'firm', { morale: 3, stress: 3 }, `"Right. Push through." They do not look sure.`, 'push'],
    ['Have you tried fitting a model to the noise?', 'curious', { morale: 4 }, `They laugh. "It's a damped oscillator. A sad one."`, 'joke'],
  ] }),
  (A, s) => {
    const r = s.said[1] === 'push' ? 'hurt' : s.said[1] === 'rest' || s.said[0] === 'tips' ? 'great' : 'ok';
    s.v.r = r;
    const text = r === 'hurt' ? `${A.first} limps in. "I made it to mile nine. Then the knee filed for divorce. I walked the rest. I still finished, technically."` : r === 'great' ? `${A.first} drops a finisher's medal on your desk. "One hour fifty-eight. Under two hours! I took your advice the whole way."` : `"I finished! Two hours and twenty minutes. Last place in my age group, but I finished."`;
    return { text, ch: [
      ['Hang that medal next to the lab\'s papers.', 'warm', { morale: 8, culture: 2 }, `It goes on the wall between two PRL covers. Visitors ask about it more than the papers.`, 'wall'],
      [r === 'hurt' ? 'Are you okay? Take the week easy.' : 'So... a full marathon next?', r === 'hurt' ? 'warm' : 'curious', r === 'hurt' ? { stress: -8, loyalty: 4 } : { morale: 4 }, r === 'hurt' ? `"The doctor said six weeks without running. I'll survive."` : `"Absolutely not." They are already looking at marathons.`, 'next'],
      ['Nice. Now, about that data...', 'dismiss', { morale: -4 }, `"Right. The data." The medal goes back in the bag.`, 'data'],
    ] };
  },
]);

story('apartment', () => 'How\'s the apartment situation?', [
  A => ({ text: `"My lease ends next month and every apartment within an hour of campus costs more than my ${A.role === 'postdoc' ? 'salary' : 'stipend'}. I looked at a 'studio' that was a closet with a sink in it."`, ch: [
    ['Let me email the housing office for you today.', 'warm', { loyalty: 6, stress: -4 }, `"You'd do that? Thank you."`, 'help'],
    ['Have you thought about sharing a place with someone from the lab?', 'curious', { morale: 2 }, `"Huh. I hadn't. That could work."`, 'mates'],
    ['Housing is rough everywhere. Good luck.', 'dismiss', { morale: -2, stress: 3 }, `"Thanks." They go back to refreshing listings.`, 'luck'],
  ] }),
  (A, s) => {
    const m = s.said[0] === 'mates' ? other(A) : null;
    if (m) { s.v.mate = m.id; rel(A, m, 10); }
    const text = s.said[0] === 'help' ? `"The housing office called me back! Apparently a faculty email moves you up the list. I got a one-bedroom in grad housing. The radiator is either off or the surface of the sun."` : m ? `"Update: ${m.first} and I are roommates now. They label their yogurt. With dates. In ISO format."` : `"Found a place. It's forty minutes by bus and my roommate owns a python. The snake. Not the language. Although also the language."`;
    return { text, ch: [
      ['Want to borrow the lab\'s spare space heater? Kidding. Mostly.', 'warm', { morale: 4 }, `"Ha. Don't tempt me."`, 'joke'],
      [m ? `How are you two getting along, really?` : 'Is the commute killing you?', 'curious', { stress: -3, loyalty: 3 }, m ? `"Honestly? Great. We do dinner on Sundays. It's like having a sibling who also understands Fourier transforms."` : `"I read papers on the bus. It's the most productive part of my day, actually."`, 'ask'],
      ['As long as you\'re here by ten.', 'firm', { morale: -2 }, `"Sure."`, 'ten'],
    ] };
  },
  (A, s) => ({ text: `"I'm having a housewarming on Saturday. It's very small. ${s.said[0] === 'help' ? 'You helped me get the place, so... you have to come.' : 'You could come, if you want? No pressure.'}"`, ch: [
    ['I\'ll be there. I\'ll bring something.', 'warm', { loyalty: 8, morale: 6, self: 3 }, `You bring a bottle of wine and a lava lamp. ${A.first} puts the lava lamp in the place of honor. Half the lab is there. You stay an hour and leave before it gets weird.`, 'went'],
    ['I can\'t, but have fun. Here, get pizza on me.', 'warm', { money: 60, morale: 4, loyalty: 3 }, `"You didn't have to do that!" They seem genuinely touched.`, 'pizza'],
    ['Weekends are for writing grants, sadly.', 'dismiss', { morale: -3 }, `"Oh. Yeah, no worries."`, 'no'],
  ] }),
]);

story('parent', () => 'How\'s your dad doing?', [
  A => ({ text: `${A.first} is quieter than usual. "Can I tell you something? My dad is having heart surgery next month. They say it's routine. It doesn't feel routine."`, ch: [
    ['Go home for it. Two weeks. Don\'t even think about the lab.', 'warm', { loyalty: 12, stress: -8, away: 2 }, `${A.first} has to blink a few times. "Thank you. I didn't know how to ask."`, 'home'],
    ['Do you want to talk about it?', 'curious', { loyalty: 6, stress: -5 }, `They talk for a while: about their dad teaching them to fix bikes, about how scared they are. You mostly listen. It helps.`, 'talk'],
    ['Let\'s plan around it so the project doesn\'t slip.', 'firm', { loyalty: -4, stress: 4 }, `"Yeah. Okay. I'll make a plan." They write it down without looking up.`, 'plan'],
  ] }),
  (A, s) => ({ text: s.said[0] === 'plan' ? `"The surgery went fine. I was on a Zoom call with the lab while he was in recovery. He thinks that's normal. I don't feel great about it."` : `"Dad's out of the hospital! He's already complaining about the food and trying to mow the lawn, which he is not allowed to do."`, ch: [
    s.said[0] === 'plan' ? ['That\'s on me. I should have told you to just go. I\'m sorry.', 'warm', { loyalty: 10, morale: 5 }, `"...Thanks. That actually means a lot."`, 'sorry'] : ['That\'s the best news I\'ve heard all week.', 'warm', { morale: 6, loyalty: 3 }, `They grin. "Mine too."`, 'glad'],
    ['How are YOU doing, though?', 'curious', { stress: -6, loyalty: 4 }, `"Tired. Relieved. I think I've been holding my breath for a month."`, 'you'],
    ['Good. So we\'re back on schedule?', 'dismiss', { loyalty: -3 }, `"Yeah. Back on schedule."`, 'sched'],
  ] }),
  (A, s) => ({ text: s.said[0] === 'home' ? `${A.first} puts a jar on your desk. "My dad made this. Peach jam. He said, and I quote, 'give this to the professor who sent you home'."` : `"My dad wants to visit the lab when he's better. He thinks I build lasers for the government. I haven't corrected him."`, ch: [
    ['Tell him thank you. And yes, bring him by anytime.', 'warm', { loyalty: 5, morale: 5, culture: 1 }, s.said[0] === 'home' ? `The jam is excellent. It lasts exactly one group meeting.` : `Three weeks later a man in a fishing hat gets the full tour and asks very good questions about the vacuum chamber.`, 'visit'],
    ['Do you build lasers for the government?', 'curious', { morale: 5 }, `"Only on Tuesdays." Good, they're joking again.`, 'joke'],
  ] }),
], A => A.role !== 'undergrad');

story('visa', () => 'Any news on the visa?', [
  A => ({ text: `"I need to renew my visa, and the earliest consulate appointment is in five months. If I travel to the conference I might not get back in."`, ch: [
    ['I\'ll write to the international office today. You\'re not handling this alone.', 'warm', { loyalty: 8, stress: -6 }, `You write the email while they're still sitting there. They watch you hit send like it's a magic trick.`, 'letter'],
    ['Skip the conference this year. It\'s not worth the risk.', 'firm', { morale: -4, stress: -2 }, `"I know. I just really wanted to give that talk."`, 'skip'],
    ['Is there an expedited option? What does it cost?', 'curious', { stress: -2 }, `"There's an emergency appointment track. Two thousand dollars in lawyer fees, maybe."`, 'expedite'],
  ] }),
  (A, s) => ({ text: `"They put my case in 'administrative processing'. Nobody can tell me what that means or how long it takes. My mom keeps asking when I'm coming home for the holidays."`, ch: [
    ['Let\'s get the university\'s immigration lawyer on it. Grant money can cover it.', 'warm', { money: 1800, loyalty: 8, stress: -8 }, `"Thank you. Seriously." The lawyer's first email is twelve paragraphs long and very reassuring.`, 'lawyer'],
    ['Video-call your family a lot. Want to set up a lab holiday dinner?', 'warm', { morale: 4, culture: 2 }, `"A lab holiday dinner... actually, yes. Lots of people can't go home."`, 'dinner'],
    ['Nothing to do but wait, unfortunately.', 'dismiss', { stress: 4 }, `"Yeah. Waiting. My favorite."`, 'wait'],
  ] }),
  (A, s) => {
    const ok = s.said.includes('letter') || s.said.includes('lawyer') ? chance(0.9) : chance(0.55);
    s.v.ok = ok;
    if (!ok) fx(A, { stress: 10, morale: -6 });
    return { text: ok ? `${A.first} waves a passport at you from the door. "APPROVED. Four more years! I'm booking a flight home right now."` : `"Still processing. They say maybe two more months. I'll be working remotely for a while if I go home. I'm sorry."`, ch: [
      ok ? ['Go home. See your family. You earned it.', 'warm', { morale: 10, loyalty: 5, away: 1 }, `They leave for a week and come back with snacks from home for the whole lab.`, 'go'] : ['Don\'t apologize. We\'ll make remote work work.', 'warm', { loyalty: 10, stress: -6 }, `"Okay." Their voice cracks a little. "Okay. Thank you."`, 'remote'],
      ['Let\'s celebrate. Group lunch, my treat.', 'warm', { money: 300, team: { morale: 3 }, culture: 1 }, `The whole lab goes. ${A.first} picks the restaurant: their favorite place from home.`, 'lunch'],
    ] };
  },
], (A, L) => L.intl && A.role !== 'undergrad');

story('longdist', () => 'How are things with your partner?', [
  A => ({ text: `"My partner just got a job in another city. Across the country. We're going to try long distance. Everyone says it never works."`, ch: [
    ['It can work. Take a week here and there to work from there.', 'warm', { morale: 6, loyalty: 6 }, `"You'd be okay with that?" You would. They look lighter.`, 'flex'],
    ['Want my honest take, from someone who did it?', 'curious', { loyalty: 4, stress: -3 }, `You tell them about the two years you spent on red-eye flights. It's not all advice; some of it is warnings. They listen to every word.`, 'honest'],
    ['Make sure it doesn\'t affect your work.', 'firm', { morale: -4, stress: 4 }, `"It won't." They say it like they're trying to convince themselves.`, 'work'],
  ] }),
  (A, s) => ({ text: `"I'm flying out this weekend. Our first visit since the move. I'm nervous it'll feel different."`, ch: [
    ['Leave Thursday. Make it a long weekend.', 'warm', { morale: 6, stress: -5, away: 1 }, `"Really? Thank you!"`, 'long'],
    ['Bring them a lab mug. Nothing says romance like vacuum-pump merch.', 'warm', { morale: 4 }, `They laugh. They also take a mug.`, 'mug'],
    ['Be back Monday morning. We have the group meeting.', 'firm', { stress: 3 }, `"Monday. Got it."`, 'monday'],
  ] }),
  (A, s) => {
    const good = chance(s.said.includes('flex') || s.said.includes('long') ? 0.7 : 0.45);
    s.v.good = good;
    if (good) fx(A, { morale: 10 }); else fx(A, { morale: -12, stress: 8 });
    return { text: good ? `"Big news. My partner found a job HERE. They're moving back next month. I may have screamed in the airport."` : `${A.first} sits down slowly. "We broke up. It was mutual. It's fine. It's not fine."`, ch: good ? [
      ['That\'s wonderful! Bring them to the next lab outing.', 'warm', { morale: 5, loyalty: 4, culture: 1 }, `They do. Their partner beats everyone at the pub quiz.`, 'outing'],
      ['Congratulations. Now you can stop flying red-eyes.', 'warm', { stress: -6 }, `"I'm going to sleep for a month."`, 'sleep'],
    ] : [
      ['Take the rest of the week off. I mean it.', 'warm', { stress: -10, loyalty: 8, away: 1 }, `They nod and don't argue, which tells you how bad it is.`, 'off'],
      ['I\'m really sorry. Do you want to talk, or do you want a distraction?', 'curious', { stress: -6, loyalty: 6 }, `"Distraction. Please. Give me the hardest calibration you've got."`, 'distract'],
      ['Work can be a good distraction.', 'dismiss', { stress: 5, loyalty: -3 }, `"Yeah. Sure." They leave without the usual goodbye.`, 'cold'],
    ] };
  },
], A => A.role !== 'undergrad');

story('dog', (A, s) => `How's ${s.v.pet || 'the dog'}?`, [
  (A, s) => { s.v.pet = s.v.pet || pick(PETNAMES); return { text: `${A.first} holds up a phone with a picture of a deeply confused-looking dog. "I adopted her on Saturday. Her name is ${s.v.pet}."`, ch: [
    [`Bring ${s.v.pet} to the lab on Fridays!`, 'warm', { morale: 8, culture: 2 }, `"Are you SERIOUS?" They are already texting the group chat.`, 'lab'],
    ['Photos. All of them. Now.', 'warm', { morale: 6, loyalty: 3 }, `You scroll through forty-one photos. All of them are good.`, 'photos'],
    ['No animals near the lasers.', 'firm', { morale: -2 }, `"Obviously! She'd stay home." ${A.first} looks a little sad anyway.`, 'nolab'],
  ] }; },
  (A, s) => ({ text: s.said[0] === 'lab' ? `"So... ${s.v.pet} ate a BNC cable. Under the electronics bench. She's fine. The cable is not."` : `"${s.v.pet} has separation anxiety. I came home to shredded paper everywhere. It was a printout of my ${A.role === 'undergrad' ? 'homework' : 'thesis outline'}."`, ch: [
    ['Cables are cheap. Dogs are priceless. Put a gate on the bench.', 'warm', { morale: 5, culture: 1 }, `A baby gate goes up in front of the electronics. It somehow becomes the lab's most-photographed piece of equipment.`, 'gate'],
    ['Have you considered that she\'s a reviewer?', 'curious', { morale: 6 }, `"Reviewer 3," they say. "Rejects everything, gives no reasons."`, 'joke'],
    [s.said[0] === 'lab' ? 'Maybe Fridays aren\'t working out.' : 'Maybe work from home a bit until she settles.', s.said[0] === 'lab' ? 'firm' : 'warm', s.said[0] === 'lab' ? { morale: -5 } : { stress: -5, loyalty: 4 }, s.said[0] === 'lab' ? `"Yeah. Understood."` : `"Really? That would help so much."`, 'adjust'],
  ] }),
  (A, s) => ({ text: `"${s.v.pet} passed her obedience class! She was top of the class. Unlike me in quantum mechanics."`, ch: [
    [`Bring the certificate. It goes on the lab wall.`, 'warm', { morale: 6, culture: 2 }, `It goes up right next to the safety poster. ${s.v.pet} is now officially overqualified.`, 'wall'],
    ['Is she accepting grad students?', 'curious', { morale: 5 }, `"She's very selective. Mostly she wants people who carry treats."`, 'joke'],
  ] }),
]);

story('band', (A, s) => `How's ${s.v.band || 'the band'}?`, [
  (A, s) => { s.v.band = s.v.band || pick(BANDS); return { text: `"I joined a band. We're called ${s.v.band}. I play bass. Badly, but loudly."`, ch: [
    ['That\'s amazing. Tell me when your first gig is. I\'m coming.', 'warm', { morale: 7, loyalty: 4 }, `"You're going to regret saying that." They're beaming.`, 'promise'],
    ['What kind of music?', 'curious', { morale: 4 }, `"We describe it as 'math rock about thermodynamics'. Every song is in 7/8."`, 'ask'],
    ['As long as you don\'t go on tour.', 'firm', { morale: -2 }, `"Ha. We have eleven followers. No tour."`, 'tour'],
  ] }; },
  (A, s) => ({ text: `"Our first gig is Friday night, at the bar with the sticky floors. ${s.said[0] === 'promise' ? 'You said you\'d come. You don\'t have to. But you said.' : 'Half the lab is coming. You could come too?'}"`, ch: [
    ['I\'ll be there in the front row.', 'warm', { loyalty: s.said[0] === 'promise' ? 10 : 7, morale: 8, self: 4 }, `It's loud. It's in 7/8. ${A.first} spots you in the crowd and messes up a note grinning. Best Friday night you've had in months.`, 'went'],
    ['I can\'t make it. I have a proposal due.', 'dismiss', { loyalty: s.said[0] === 'promise' ? -8 : -2, morale: -3 }, s.said[0] === 'promise' ? `"Oh. Right. No, that's fine." It's not fine. You promised.` : `"No worries! I'll send you a video."`, 'skip'],
  ] }),
  (A, s) => {
    const big = chance(0.4); s.v.big = big;
    return { text: big ? `"A local radio station played our song! It's called 'Second Law (You Can't Go Back)'. People keep asking if it's about a breakup. It's about entropy."` : `"${s.v.band} broke up. Creative differences. The drummer wanted to play in 4/4. Unforgivable."`, ch: [
      [big ? 'Play it at the next group meeting.' : 'Start a lab band. I\'ll play tambourine.', 'warm', { morale: 7, culture: 2, team: { morale: 1 } }, big ? `It becomes the unofficial lab anthem. Someone puts it on the lab's hold music.` : `Within a week there is a lab band. You are, in fact, on tambourine.`, 'fun'],
      ['Music and physics. Two careers with terrible job markets.', 'curious', { morale: 3 }, `"Don't remind me." But they laugh.`, 'joke'],
    ] };
  },
]);

story('novel', () => 'How\'s the novel coming along?', [
  A => ({ text: `"Promise you won't laugh. I'm writing a science fiction novel. The main character is a physics professor who accidentally opens a portal. Can I... base them on you a little?"`, ch: [
    ['Only if I\'m the hero.', 'warm', { morale: 6, loyalty: 3 }, `"Hero is a strong word. Protagonist." That's fair.`, 'hero'],
    ['Make me taller and better at grant writing.', 'warm', { morale: 7 }, `"Taller, yes. Grant writing would break the reader's suspension of disbelief."`, 'taller'],
    ['Please don\'t.', 'firm', { morale: -3 }, `"Okay! Okay. Totally fictional professor. No resemblance."`, 'no'],
  ] }),
  (A, s) => ({ text: `"Chapter twelve. The ${s.said[0] === 'no' ? 'totally fictional' : 'not-at-all-you'} professor opens the portal by misaligning a laser at 3am. Is that too realistic?"`, ch: [
    ['Have them do it at 4am. Nothing good happens at 3am.', 'curious', { morale: 5 }, `"That's... a weirdly specific note." They change it.`, 'note'],
    ['Can I read a draft?', 'warm', { morale: 8, loyalty: 5 }, `They email it within the minute. It is honestly pretty good. The grant committee villain is cartoonishly evil and you love it.`, 'read'],
    ['Is this happening during work hours?', 'firm', { morale: -5, stress: 3 }, `"Weekends. Only weekends."`, 'hours'],
  ] }),
  (A, s) => {
    const agent = chance(s.said.includes('read') ? 0.55 : 0.3); s.v.agent = agent;
    return { text: agent ? `"I GOT A LITERARY AGENT. They want to pitch it to publishers. They said the professor character is 'the heart of the book'."` : `"I sent the novel to forty agents. Thirty-nine form rejections. One said 'too much physics'. Is there such a thing?"`, ch: [
      [agent ? 'I expect a signed first edition.' : 'Rejection is part of the job. Ask me about my last Nature submission.', 'warm', { morale: agent ? 6 : 8, loyalty: 4 }, agent ? `"Signed, dedicated, and with a typo in your name, for authenticity."` : `"Wait, Nature rejected you?" You tell the story. They feel much better.`, 'warm'],
      ['There is absolutely such a thing.', 'curious', { morale: 3 }, `"Traitor," they say, smiling.`, 'joke'],
    ] };
  },
]);

story('wedding', () => 'How are the wedding plans?', [
  A => ({ text: `"My sister's getting married. The date is the same week as the big conference. I'm supposed to give a talk there."`, ch: [
    ['Go to the wedding. Obviously.', 'warm', { morale: 8, loyalty: 8 }, `"Oh thank god. I was so scared you'd say the talk."`, 'wed'],
    ['Can you pre-record the talk? Lots of sessions allow it now.', 'curious', { morale: 6, stress: -3 }, `"I didn't even think of that! I'll email the organizers."`, 'record'],
    ['That talk matters for your career. Think hard.', 'firm', { stress: 6, morale: -4 }, `"I know." They look miserable.`, 'talk'],
  ] }),
  (A, s) => ({ text: s.said[0] === 'talk' ? `"I'm giving the talk. My sister is not speaking to me. My mom says she'll 'get over it', which means she won't."` : `"I have to give a speech at the reception. I'd rather defend my thesis twice. Could I practice it on you?"`, ch: s.said[0] === 'talk' ? [
    ['Go to the wedding. I\'ll give the talk for you.', 'warm', { loyalty: 12, morale: 10 }, `"You'd... do that?" You would. You do. Your slides are worse than theirs, and the room still enjoys it.`, 'swap'],
    ['Call her. Today. Conferences happen every year.', 'curious', { loyalty: 4, stress: -3 }, `They step into the hallway to call. It's a long call. It ends with laughing.`, 'call'],
  ] : [
    ['Go ahead. I\'m listening.', 'warm', { loyalty: 6, morale: 5 }, `The speech has a joke about entropy that lands, a story about a broken bike that makes you tear up, and one physics pun too many. You tell them to keep all of it.`, 'heard'],
    ['Cut every physics joke.', 'firm', { morale: -2 }, `"All of them? Even the one about the harmonic oscillator?" Especially that one.`, 'cut'],
  ] }),
  (A, s) => ({ text: `${A.first} shows you a wedding photo: the whole family, all of them grinning. "${s.said.includes('swap') ? 'This happened because of you. My sister wants to send you cake.' : 'It was perfect. My speech made my grandpa cry. In a good way.'}"`, ch: [
    ['That\'s a great photo. Congratulations to your sister.', 'warm', { morale: 5, loyalty: 3 }, `"I'll tell her."${s.said.includes('swap') ? ' A box of wedding cake arrives in the department mail the next week, labeled "FOR THE PROFESSOR".' : ''}`, 'nice'],
    ['Who\'s the person in the corner doing the robot?', 'curious', { morale: 6 }, `"My uncle. Physics runs in the family, but so does that."`, 'joke'],
  ] }),
], A => A.role !== 'undergrad');

story('climbing', () => 'How\'s the climbing going?', [
  A => ({ text: `"I started bouldering at ${pick(GYMS)}. I'm terrible at it. I love it. It's just friction and torque and fear."`, ch: [
    ['Recruit the lab. Make it a weekly thing.', 'warm', { morale: 5, culture: 2 }, `They post in the lab channel before they've even left your office.`, 'recruit'],
    ['Friction and torque. You could write the free-body diagram for every route.', 'curious', { morale: 5, skill: 'theory' }, `"I already did. It doesn't help at all."`, 'physics'],
    ['Don\'t break a wrist before your deadline.', 'firm', { morale: -2 }, `"I'll fall carefully."`, 'careful'],
  ] }),
  (A, s) => {
    const m = other(A); if (m) { rel(A, m, 15); s.v.m = m.id; }
    return { text: m ? `"Climbing update: ${m.first} started coming, and they're unreasonably good. Like, it's insulting. We go every Tuesday now."` : `"I finished my first V3! It took nineteen tries."`, ch: [
      ['I want to come one Tuesday.', 'warm', { morale: 6, loyalty: 5, self: 3 }, `You go. You fall off the easiest route twice. The students are delighted, and they all come to work happier on Wednesday.`, 'came'],
      ['Climbing as team building. I love it.', 'warm', { morale: 3, culture: 1 }, `"It's mostly people yelling 'you got this' at each other. It's nice."`, 'nice'],
    ] };
  },
  (A, s) => ({ text: `"I signed up for a local bouldering competition. Beginner category. I'll probably come last."`, ch: [
    ['The lab is coming to cheer. I\'ll make a sign.', 'warm', { morale: 8, loyalty: 4, team: { morale: 2 } }, `The sign says "${A.first.toUpperCase()}: OVERCOMING POTENTIAL BARRIERS". They come fourth. The sign gets more attention than the winner.`, 'sign'],
    ['Have fun. Tell me how it goes.', 'curious', { morale: 3 }, `They come fourth out of thirty. They tell you about every single route.`, 'ok'],
  ] }),
]);

story('ta', () => 'How\'s TA-ing going?', [
  A => ({ text: `"I'm TA-ing intro mechanics this term. Ninety students. I graded until 2am last night and I'm a third of the way through."`, ch: [
    ['I\'ll talk to the instructor. That load is too much.', 'warm', { stress: -8, loyalty: 6, goodwill: -1 }, `You send a polite email. A second TA appears by Friday.`, 'talk'],
    ['Grade one problem at a time across everyone, not one student at a time. Twice as fast.', 'curious', { stress: -4, skill: 'any' }, `They try it that afternoon. "Why did nobody tell me this before?"`, 'trick'],
    ['Teaching is part of the job.', 'firm', { stress: 5, morale: -3 }, `"I know." They yawn so hard their jaw clicks.`, 'job'],
  ] }),
  A => ({ text: `"One of my students copied the solutions manual word for word. Including the typo in problem 4. What do I do?"`, ch: [
    ['Talk to the student first. Then the instructor.', 'curious', { loyalty: 4, morale: 3 }, `They do. The student admits it and turns out to be completely overwhelmed. ${A.first} ends up running an extra study session.`, 'talk'],
    ['Report it straight to the honor code office. Rules are rules.', 'firm', { stress: 3 }, `It goes through the process. It is very slow and very official.`, 'report'],
    ['Honestly, kind of impressive that they copied the typo.', 'warm', { morale: 4 }, `"That's what I said!" They still forward it to the instructor.`, 'joke'],
  ] }),
  A => ({ text: `"Course evaluations are back. Someone wrote 'best TA I've had' and someone else wrote 'talks too fast about springs'. They nominated me for the TA award."`, ch: [
    ['I\'ll write you a support letter for the award.', 'warm', { morale: 8, loyalty: 6 }, `You write it that evening. Two weeks later they win. ${A.first} brings the certificate to group meeting. Everyone claps.`, 'letter'],
    ['You DO talk too fast about springs.', 'curious', { morale: 4 }, `"Springs are exciting!"`, 'joke'],
  ] }),
], A => A.role === 'grad');

story('bread', () => `How's Schrödinger's Yeast?`, [
  A => ({ text: `"I started a sourdough starter. I named it Schrödinger's Yeast, because I genuinely can't tell if it's alive."`, ch: [
    ['Bring bread to group meeting and you\'ll be a legend.', 'warm', { morale: 5 }, `"Challenge accepted."`, 'bring'],
    ['That\'s just microbiology. Keep it away from our chemicals.', 'firm', { morale: -2 }, `"Of course. It lives at home."`, 'away'],
    ['What\'s the doubling time? Have you plotted it?', 'curious', { morale: 6, skill: 'code' }, `They have, in fact, plotted it. With error bars. And a fit.`, 'plot'],
  ] }),
  (A, s) => ({ text: s.said[0] === 'away' ? `"So. Confession. My apartment fridge broke, so for three days the starter lived in the lab fridge. Next to the photoresist. It's labeled. It's fine. Is it fine?"` : `${A.first} sets a loaf on your desk. It has a laser-etched pattern on top. "I may have used the lab's laser cutter. For science."`, ch: s.said[0] === 'away' ? [
    ['Take it home today. And we don\'t mention this to Safety.', 'firm', { stress: 3 }, `The starter goes home in a cooler. Nobody mentions it to Safety.`, 'home'],
    ['As long as nobody eats the photoresist.', 'warm', { morale: 4 }, `"Nobody is eating the photoresist." Good.`, 'joke'],
  ] : [
    ['That\'s beautiful. Slice it up for everyone.', 'warm', { team: { morale: 2 }, culture: 2 }, `It's gone in four minutes. Somebody asks if they can bring soup next week.`, 'share'],
    ['Was the laser cutter really for bread?', 'curious', { morale: 3 }, `"I calibrated it first! It's very well calibrated now."`, 'ask'],
  ] }),
  A => ({ text: `"The bakery downtown wants to buy my bread on weekends. It's like fifty dollars a week. Is that weird for a physicist?"`, ch: [
    ['Not weird at all. Physics doesn\'t have to be everything.', 'warm', { morale: 7, loyalty: 4 }, `"Thank you. I think I needed to hear that."`, 'yes'],
    ['Fifty dollars and free bread? Do it.', 'warm', { morale: 5 }, `They do. The lab gets the rejects. The rejects are excellent.`, 'rejects'],
  ] }),
]);

story('sideapp', () => 'How\'s the microwave app?', [
  A => ({ text: `"I'm building an app on weekends. It tells you which microwave on campus has the shortest line. Don't laugh. Three hundred people use it."`, ch: [
    ['That\'s genuinely useful. Ship more features.', 'warm', { morale: 6, skill: 'code' }, `"Next feature: predicting the line from the weather."`, 'ship'],
    ['Are you running it on the lab cluster?', 'curious', { stress: 2 }, `"...A small part of it. A tiny part. I'll move it."`, 'cluster'],
    ['Weekends only, right?', 'firm', { morale: -2 }, `"Weekends only."`, 'weekend'],
  ] }),
  A => ({ text: `"So the microwave app has two thousand users. A guy from the business school wants to turn it into a company. He used the word 'synergy' unironically."`, ch: [
    ['Think hard about it. Whatever you choose, I\'ll support you.', 'warm', { loyalty: 8, morale: 5 }, `"That's... not what I expected you to say. Thank you."`, 'support'],
    ['You\'re close to finishing here. Don\'t throw that away for microwaves.', 'firm', { morale: -3, loyalty: -2 }, `"I know. It's just tempting."`, 'stay'],
    ['Could you do both? A small company, part time?', 'curious', { morale: 4 }, `"Maybe. If the synergy guy does the business part."`, 'both'],
  ] }),
  (A, s) => {
    const leaving = s.said[1] === 'support' && has(A, 'industry') && chance(0.35);
    if (leaving) A.flags.wantsOut = true;
    return { text: leaving ? `"I've been thinking about what you said. I think I want to try the startup. Not today. But soon. I wanted you to hear it from me first."` : `"I handed the app over to the business-school guy for a tiny bit of equity. I'm keeping my weekends. And my PhD."`, ch: [
      [leaving ? 'Thank you for telling me. Let\'s plan a good handoff.' : 'Good call. And congrats on the equity.', 'warm', { loyalty: 6, morale: 4 }, leaving ? `"You're taking this way better than I expected."` : `"It's worth about one sandwich. But it's MY sandwich."`, 'ok'],
      ['Let\'s talk about what you want long-term.', 'curious', { loyalty: 4, stress: -3 }, `You talk for an hour. It's the most honest conversation you've had with them.`, 'long'],
    ] };
  },
], A => has(A, 'coder') || has(A, 'industry'));

story('kyoto', () => 'How\'s the Japanese going?', [
  A => ({ text: `"I'm learning Japanese. There's a group in Kyoto I'd love to join someday. I'm on lesson twelve. I can order tea and apologize."`, ch: [
    ['I know someone in that group. Want an introduction when the time comes?', 'warm', { loyalty: 8, morale: 6 }, `"WAIT. You'd do that?" They practice "thank you" in Japanese at you. You think.`, 'intro'],
    ['Ordering tea and apologizing covers most of academia.', 'curious', { morale: 5 }, `They laugh so hard someone in the hallway looks in.`, 'joke'],
    ['Finish here first, then dream about Kyoto.', 'firm', { morale: -3 }, `"Of course."`, 'first'],
  ] }),
  A => ({ text: `"I gave a two-minute self-introduction in Japanese at a conversation meetup. I said I study 'cold atoms' and they thought I meant frozen food."`, ch: [
    ['Honestly, that\'s also accurate.', 'warm', { morale: 6 }, `"That's what I told them!"`, 'joke'],
    ['Want to present a short summary in Japanese at group meeting? Just for fun.', 'curious', { morale: 5, culture: 1 }, `They do. It's two minutes long. The lab gives a standing ovation, mostly ironically, partly not.`, 'present'],
  ] }),
  (A, s) => ({ text: `"The Kyoto group is having a summer workshop. ${s.said[0] === 'intro' ? 'Your friend there invited me personally.' : 'I applied on my own.'} Can I go? It's two weeks."`, ch: [
    ['Go. The lab will survive.', 'warm', { morale: 10, loyalty: 6, skill: 'theory', away: 2 }, `They come back with new ideas, a lot of green tea and a collaborator.`, 'go'],
    ['Next year. We\'re in the middle of a push.', 'firm', { morale: -8 }, `"Okay." Lesson thirteen sits unopened for a while.`, 'no'],
  ] }),
], A => A.role !== 'undergrad');

story('ugfuture', () => 'Made up your mind about grad school?', [
  A => ({ text: `"Can I ask you something? Everyone in my year is applying to consulting jobs. I like research but I don't know if I'm good enough for grad school."`, ch: [
    ['You are. Your work here shows it. I\'d write you a strong letter.', 'warm', { morale: 10, loyalty: 8 }, `${A.first} stares at you. "Nobody's ever said that to me."`, 'letter'],
    ['What do you actually enjoy about research?', 'curious', { morale: 5, loyalty: 4 }, `They think for a long time. "The moment right before something works." Good answer.`, 'why'],
    ['Consulting pays better. Just being honest.', 'firm', { morale: -4 }, `"Yeah. That's what my parents say too."`, 'honest'],
  ] }),
  (A, s) => ({ text: `"I'm applying to grad programs! ${s.said[0] === 'letter' ? 'Could you still write that letter?' : 'Would you write me a letter?'} Applications are due in three weeks."`, ch: [
    ['Of course. Send me your statement too and I\'ll read it.', 'warm', { morale: 8, loyalty: 6 }, `Their statement opens with a story about your lab. You fix the commas and leave the story.`, 'yes'],
    ['I\'ll write it, but I\'m swamped. It might be short.', 'firm', { morale: -2 }, `"Short is fine! Anything!"`, 'short'],
  ] }),
  (A, s) => ({ text: s.said[1] === 'yes' ? `${A.first} runs in. "I GOT IN. Three programs! One of them said my letter was 'exceptional'. That's your letter!"` : `"I got into one program. Not my first choice, but it has a great cold-atoms group."`, ch: [
    ['I\'m so proud of you.', 'warm', { morale: 10, loyalty: 6, culture: 1 }, `There's cake at group meeting. ${A.first} gives a two-minute speech and thanks you by name.`, 'proud'],
    ['Pick the place with the best mentor, not the best name.', 'curious', { loyalty: 4 }, `They write that down, underline it twice, and circle it.`, 'advice'],
  ] }),
], A => A.role === 'undergrad');

story('midterms', () => 'How did midterms go?', [
  A => ({ text: `"I have three midterms next week and a lab report. Is it okay if I'm not in the lab much?"`, ch: [
    ['Classes come first. See you after.', 'warm', { stress: -8, loyalty: 4, away: 1 }, `"Thank you!" They sprint off to the library.`, 'go'],
    ['Want to do a practice problem with me? I miss teaching.', 'curious', { stress: -4, skill: 'theory' }, `You spend half an hour on a Lagrangian problem. They get it. You remember why you like teaching.`, 'teach'],
    ['Try to keep your lab hours, at least a few.', 'firm', { stress: 6 }, `"I'll try."`, 'keep'],
  ] }),
  (A, s) => ({ text: `"Midterm results! ${s.said[0] === 'teach' ? 'I got the Lagrangian question right. The exact same kind we did together!' : 'I did okay. Better than I expected.'}"`, ch: [
    ['Nice work. Celebrate a little.', 'warm', { morale: 6 }, `"I'm going to sleep for twelve hours. That's how I celebrate."`, 'nice'],
    ['Back to the lab, then?', 'curious', { morale: 2 }, `"Yes! I missed it, honestly."`, 'back'],
  ] }),
], A => A.role === 'undergrad');

export function storyNode(c, A, prefix = '') {
  const L = lifeOf(A); const s = L.story; if (!s) return null;
  const st = STORIES[s.id];
  const stage = st.stages[s.stage](A, s);
  const back = s.stage > 0 && s.said[s.stage - 1] ? callbackLine(A, s) : '';
  const text = `${prefix}${back}${stage.text}`;
  const idx = s.stage;
  const ch = stage.ch.map(([label, tone, o, reply, key]) => {
    const { energy, ...eff } = o;
    return T(c, tone, A, label, hintOf(eff), () => {
      fx(A, eff); s.said[idx] = key; s.stage++; s.next = G.week + int(4, 9);
      const r = react(A, tone);
      return `${reply}${r && tone !== 'curious' ? ' ' + r : ''}`;
    }, energy ? { cost: { energy } } : {});
  });
  return N(A, text, ch);
}
// a short reference to how you reacted last time, so it feels remembered
function callbackLine(A, s) {
  const lt = memOf(A).log.find(l => l.what === 'chat');
  if (!lt) return '';
  if (lt.tone === 'warm') return vary('cb_w', ['', `"You were really nice about this last time, so..." `, '']);
  if (lt.tone === 'dismiss' || lt.tone === 'harsh') return vary('cb_d', [`${A.first} hesitates, then decides to tell you anyway. `, '', `"I know you're busy, but quick update." `]);
  return '';
}

// ---------- drop-in topics ----------
// Physics questions: [id, question, real answer, joke answer]
const PHYS = [
  ['sky', `"My nephew asked why the sky is blue and sunsets are red, and I panicked. I have a physics degree."`, `Rayleigh scattering goes as one over wavelength to the fourth, so blue scatters everywhere. At sunset the light crosses so much air that the blue is gone by the time it reaches you.`, `Tell him the sky is blue because it's sad, and red at sunset because it's angry about it.`],
  ['bh', `"Hypothetically, if I fell into a black hole, would my thesis deadline get extended? From the committee's point of view I'd never cross the horizon."`, `From outside you'd freeze and redshift at the horizon, so technically they'd wait forever. From your side, you'd cross just fine and get spaghettified on schedule.`, `The committee would still ask for a progress report.`],
  ['wf', `"Do you think the wavefunction is real, or is it just our knowledge about the system?"`, `You walk through the PBR theorem, QBism and many-worlds on the whiteboard. You conclude, as everyone does, that you need more coffee.`, `It's real on weekdays and epistemic on weekends.`],
  ['ice', `"Why is ice slippery? I read that the 'pressure melting' explanation is wrong."`, `It mostly is wrong: the pressure from a skate barely shifts the melting point. The surface has a thin, disordered premelted layer, plus friction heating. It's still debated, honestly.`, `Ice is slippery because it doesn't want to be friends with you.`],
  ['jello', `"Is it true someone made a laser out of Jell-O?"`, `Yes. In the early 1970s, people at Stanford dyed gelatin dessert with a laser dye and pumped it. It lased. Physics is wonderful.`, `Yes. Lime flavor. It was a dark time for food safety.`],
  ['coffee', `"Why does spilled coffee dry into a ring instead of a blob?"`, `The edge of the drop is pinned, evaporation is fastest at the edge, so a flow carries particles outward. Change the particle shape and you can kill the effect. There's a famous Nature paper on it.`, `The coffee is trying to escape. You can see the outline of its prison.`],
  ['alpha', `"Why is the fine-structure constant about 1/137? Does it bother you?"`, `Nobody knows. It's a measured number. It runs with energy, too. Feynman called it one of the greatest mysteries in physics.`, `137 is the universe's favorite number. Don't ask it why.`],
  ['entropy', `"If entropy always increases, why isn't my desk already maximally messy?"`, `Because you're an open system pumping in energy to tidy it, dumping entropy into the room as heat. Your desk is a tiny refrigerator for order.`, `Have you seen your desk? It's working on it.`],
  ['qc', `"Do you think quantum computers will actually be useful in our lifetime?"`, `For simulating chemistry and materials, probably. Breaking RSA, maybe, with error correction at scale. Most of the hype is ahead of the hardware.`, `They'll be useful for getting grants, which they already are.`],
  ['fork', `"Why does a fork spark in the microwave but the metal walls of the microwave don't?"`, `Sharp points concentrate the electric field until the air breaks down. The walls are smooth and act as part of the cavity. It's all about the field at the tips.`, `The fork is jealous of the walls.`],
  ['stats', `"Is it bad that I don't really understand what a p-value is?"`, `You take twenty minutes to work through it with a coin-flip example. They leave understanding it better than most of the field.`, `Nobody understands p-values. That's why there are so many of them.`],
  ['papers', `"Is it normal that I understand maybe a third of the papers I read?"`, `Completely normal. Read the abstract, figures and conclusion first. Then decide if it's worth the methods section. Most papers aren't written to be understood quickly.`, `A third? Show-off.`],
  ['why', `"How did you know you wanted to be a physicist?"`, `You tell them the real story: a teacher, a broken radio you took apart, and a night watching a meteor shower. It's more personal than you expected.`, `I lost a bet.`],
  ['mistake', `"What's the dumbest mistake you ever made in the lab?"`, `You tell them about the time you left a vacuum valve open overnight and spent three weeks baking the chamber. They look delighted that you're human.`, `I've never made a mistake. Except that one time. And the other time.`],
  ['tea', `"Why do tea leaves gather in the middle of the cup when you stir, instead of flying outward?"`, `Einstein's tea leaf paradox. Friction at the bottom slows the flow, which sets up a secondary circulation inward along the bottom. Same physics shapes river bends.`, `They're scared and huddling together.`],
  ['bigprob', `"If you could solve one open problem in physics, which would it be?"`, `You pick high-temperature superconductivity and argue for it for ten minutes. They argue for quantum gravity. Neither of you wins. It's great.`, `Why the department printer jams only when I'm in a hurry.`],
  ['speed', `"Can anything really go faster than light? Like the dot of a laser pointer swept across the Moon?"`, `The dot can, because nothing physical travels from one spot to the next. Information can't. Good question, actually.`, `Rumors. Rumors travel faster than light.`],
  ['loose', `"Why does every cable in this lab seem to come loose exactly when the data looks good?"`, `Survivorship bias: you only notice loose cables when you're paying attention, and you only pay attention when the data looks good. Also: tape.`, `The cables are on Reviewer 2's payroll.`],
];

// Small requests: [id, ask, [label, tone, effects, reply] x2-3]
const ASKS = [
  ['playlist', `"Could we have a lab playlist? Democratic. Everyone adds songs. You get one veto."`, [
    ['Yes. And I\'m adding something embarrassing.', 'warm', { team: { morale: 2 }, culture: 2 }, `The playlist is chaos: sea shanties, lo-fi beats and one 40-minute ambient track someone insists helps with alignment.`],
    ['Headphones only, please.', 'firm', { morale: -2 }, `"Fair enough."`],
  ]],
  ['plant', `"Can I put a plant in the lab? Not ON the optical table. Near it. A small one."`, [
    ['A plant would be great. Name it after a physicist.', 'warm', { morale: 4, culture: 1 }, `The plant is named Ferns Bohr. It thrives under the fluorescent lights.`],
    ['Soil means dust. Keep it in the office.', 'firm', { morale: -1 }, `"Makes sense." The plant moves to the student office.`],
  ]],
  ['wfh', `"Could I work from home on Fridays? I write much better without the pumps humming."`, [
    ['Sure. Just stay reachable.', 'warm', { morale: 6, stress: -5, loyalty: 3 }, `Their writing output doubles. The Friday emails get longer and more thoughtful.`],
    ['Let\'s try it for a month and see.', 'curious', { morale: 3, stress: -2 }, `"That's fair." A month later you both agree it's working.`],
    ['I need people in the lab.', 'firm', { morale: -5 }, `"Right. Okay."`],
  ]],
  ['name', `"Can I name the new laser? I'm thinking 'Photon McPhotonface'."`, [
    ['Absolutely. It needs a label maker sticker.', 'warm', { morale: 5, culture: 2 }, `It gets a label. It gets a second label. By next month every instrument in the lab has a name.`],
    ['Only if it\'s a respectable name.', 'firm', { morale: 1 }, `They name it "Gerald". You can't argue with Gerald.`],
  ]],
  ['journal', `"Could we start a weekly journal club? Someone presents a paper over lunch."`, [
    ['Yes. I\'ll present the first one.', 'warm', { team: { morale: 1 }, skill: 'theory', culture: 2 }, `You present a classic paper. Someone finds a typo in Equation 3 that's been there for forty years.`],
    ['Good idea. Organize it, and I\'ll come when I can.', 'curious', { morale: 4, skill: 'theory' }, `It starts small. By week three the pizza budget doubles.`],
    ['We have enough meetings.', 'dismiss', { morale: -4 }, `"Yeah. Okay."`],
  ]],
  ['essay', `"Could you read my fellowship essay? It's due Friday. It's two pages. Ish."`, [
    ['Send it now. I\'ll read it tonight.', 'warm', { morale: 6, loyalty: 6, stress: -5 }, `You send back comments at 11pm. Mostly "cut this" and "this is great, put it first".`],
    ['I can skim it for typos.', 'curious', { morale: 2 }, `You find two typos and one sentence that's 90 words long.`],
    ['Ask a labmate. I\'m buried.', 'dismiss', { morale: -4, loyalty: -3 }, `"Sure, no problem."`],
  ]],
  ['school', `"There's a summer school in ${pick(['Les Houches', 'Boulder', 'Varenna', 'Cargèse'])}. Two weeks of lectures. Could I go?"`, [
    ['Go. Come back full of ideas.', 'warm', { morale: 8, skill: 'theory', away: 2, money: 1500 }, `They come back with a notebook full of ideas, a sunburn and three new friends from other labs.`],
    ['Not this year. Next summer.', 'firm', { morale: -5 }, `"Okay. Next summer."`],
  ]],
  ['brother', `"Could I bring my little brother to see the lab? He's twelve. He thinks I'm a mad scientist."`, [
    ['Yes! Give him the full tour. Safety glasses on.', 'warm', { morale: 5, culture: 2 }, `He asks seventeen questions about the laser and one about whether you have a secret lair. You do not. Officially.`],
    ['Visitors are a liability. Sorry.', 'firm', { morale: -3 }, `"I get it."`],
  ]],
  ['vacation', `"Could I take a week off? I haven't taken one since I started. My mom keeps asking."`, [
    ['Take two. You\'ve earned it.', 'warm', { stress: -20, morale: 8, loyalty: 6, away: 2 }, `They come back tanned, calm and suspiciously productive.`],
    ['Take the week. Have fun.', 'warm', { stress: -14, morale: 5, away: 1 }, `"Thank you!"`],
    ['After the next milestone?', 'firm', { stress: 5, morale: -4 }, `"Sure." The milestone keeps moving.`],
  ]],
  ['memes', `"Can I make a lab chat channel just for memes? To keep the main one clean."`, [
    ['Yes. I\'m joining it.', 'warm', { team: { morale: 1 }, culture: 2 }, `Your first meme is a graph with the y-axis labeled "hope". It does well.`],
    ['Sure, but I\'m staying out of it.', 'curious', { morale: 3 }, `Wise. It gets weird by day two.`],
  ]],
  ['desk', `"Could I get a standing desk? My back is starting to sound like the pulse tube."`, [
    ['Order one. Put it on the lab account.', 'warm', { money: 450, morale: 5, stress: -3 }, `It arrives in three boxes. Assembling it becomes a group project.`],
    ['Stack some textbooks. Jackson is perfect for it.', 'curious', { morale: 3 }, `Jackson's Classical Electrodynamics finally finds its true purpose.`],
  ]],
  ['outreach', `"A local high school asked if someone could give a talk on lasers. Can I do it?"`, [
    ['Do it. Take the green laser pointer for the demo.', 'warm', { morale: 7, goodwill: 2, skill: 'any' }, `The talk goes great. One kid emails them afterward asking how to become a physicist.`],
    ['Only if it doesn\'t take more than an afternoon.', 'firm', { morale: 3, goodwill: 1 }, `It takes an afternoon and a half. Worth it.`],
  ]],
];

// Advice dilemmas: answers plant a callback that comes back weeks later.
const ADVICE = [
  ['intern', A => A.role === 'grad', `"A big tech company offered me a summer internship. Twelve weeks, good money. Should I take it?"`, [
    ['Take it. You\'ll learn a lot and come back sharper.', 'warm', { morale: 8, loyalty: 6, away: 3 }, `"Really? Okay. Yes!"`, { text: `"The internship was great. They offered me a return position. I said no, I want to finish here. But it was nice to be asked."`, o: { morale: 6, skill: 'code' } }],
    ['Do it next year. This year is a big one for your project.', 'firm', { morale: -3 }, `"That's fair."`, { text: `"I keep thinking about that internship. No regrets. Mostly."`, o: { morale: -2 } }],
    ['What do you want to get out of it?', 'curious', { loyalty: 3 }, `They think. "Honestly? To see if I'd like industry." Good to know.`, { text: `"I've been thinking about our conversation. I don't think I need the internship to know what I want. I want this."`, o: { loyalty: 6, morale: 4 } }],
  ]],
  ['fellow', A => A.role === 'grad' && !A.fellowship, `"There's a fellowship deadline next week. I don't think I'm good enough to get it. Should I even apply?"`, [
    ['Apply. I\'ll write you a strong letter.', 'warm', { morale: 6, loyalty: 5 }, `"Okay. Okay! I'll apply."`, null, A => { G.flags.fellows = G.flags.fellows || []; G.flags.fellows.push({ id: A.id, p: 0.18 + A.skill.theory * 0.02, week: G.week + int(10, 14), f: 'Graduate Research Fellowship' }); }],
    ['Applying is good practice even if you don\'t get it.', 'curious', { morale: 3 }, `"I guess. Yeah."`, null, A => { G.flags.fellows = G.flags.fellows || []; G.flags.fellows.push({ id: A.id, p: 0.12 + A.skill.theory * 0.02, week: G.week + int(10, 14), f: 'Graduate Research Fellowship' }); }],
    ['Focus on your research this year instead.', 'dismiss', { morale: -4 }, `"Right."`, null],
  ]],
  ['lang', () => true, `"Should I rewrite our analysis code in Julia? Or Rust? Or just leave the Python alone?"`, [
    ['Leave the Python alone. Working code is sacred.', 'firm', { morale: -1 }, `"Fine. But I'm adding type hints."`, { text: `"You were right about the Python. A labmate tried Rust and spent three weeks fighting the borrow checker."`, o: { morale: 3 } }],
    ['Rewrite the slowest part only, and measure first.', 'curious', { morale: 4, skill: 'code' }, `"Profile first. Got it."`, { text: `"I profiled the analysis like you said. 90% of the time was one loop. I fixed it. Everything runs 40 times faster."`, o: { morale: 8, skill: 'code' } }],
    ['Go wild. Learning is the point.', 'warm', { morale: 6 }, `Their eyes light up dangerously.`, { text: `"Update: the analysis is in Julia now. It's very fast. Nobody else can read it."`, o: { morale: 5 } }],
  ]],
  ['help', A => A.role !== 'undergrad', `"A professor in another department asked me to help with their project on the side. Is that okay?"`, [
    ['If it\'s interesting and doesn\'t eat your project, yes.', 'warm', { morale: 5, stress: 4, skill: 'any' }, `"It's really interesting. I'll keep it to a few hours."`, { text: `"That side project I helped with? They put me on the paper. Middle author, but still!"`, o: { morale: 8 }, rep: 1 }],
    ['Ask them to write us into a grant if they want our people.', 'curious', { morale: 2 }, `"Ha. I'll mention it." They actually do.`, { text: `"Remember that professor? They're putting a line in their next grant for collaboration with our lab."`, o: { morale: 4 }, gw: 2 }],
    ['No. Your time is spoken for.', 'firm', { morale: -4 }, `"Okay. I'll let them know."`, null],
  ]],
  ['no', () => true, `"How do you say no to people without feeling guilty? Everyone asks me to fix their code."`, [
    ['Say "I can\'t this week, but here\'s how to start." You still help, just less.', 'curious', { stress: -6, morale: 3 }, `They write it on a sticky note on their monitor.`, { text: `"The sticky note works! I said no three times this week. Nobody died."`, o: { stress: -6, morale: 4 } }],
    ['Tell them I said you\'re busy. Blame me.', 'warm', { stress: -8, loyalty: 5 }, `"I can blame you? That's the best gift you've ever given me."`, { text: `"I've been blaming you all month. It's amazing. Everyone thinks you're very strict."`, o: { stress: -4 } }],
    ['Helping people is part of being in a lab.', 'firm', { stress: 4 }, `"Yeah. I guess."`, null],
  ]],
  ['cto', A => A.role !== 'undergrad' && has(A, 'industry'), `"A friend from undergrad is starting a company and wants me as CTO. I said I'd think about it. I'm thinking about it."`, [
    ['Finish your degree first. The friend will still be there.', 'firm', { loyalty: 2 }, `"That's what I figured you'd say. You're probably right."`, { text: `"My friend's company folded. I'm so glad I stayed."`, o: { loyalty: 6, morale: 4 } }],
    ['Talk to me about what\'s pulling you there.', 'curious', { loyalty: 6, stress: -3 }, `It's money, partly. But mostly it's wanting something that feels finished. That's useful to know.`, { text: `"I've thought about what we talked about. I want more 'finished' things. Could I lead the next paper?"`, o: { morale: 6 } }],
    ['If it\'s what you want, I won\'t stand in the way.', 'warm', { loyalty: 4 }, `"Wow. Okay. Thank you."`, { text: `"I turned down the CTO thing. Knowing I could leave made it easier to stay. Weird, right?"`, o: { loyalty: 8, morale: 4 } }],
  ]],
  ['conf', A => A.role !== 'undergrad', `"Should I go to the huge conference with 10,000 people, or the small workshop with 60 people in the mountains?"`, [
    ['The small one. You\'ll actually meet people.', 'curious', { morale: 4 }, `"Mountains it is."`, { text: `"The workshop was the best week of my PhD. I had dinner with two people whose papers I cite constantly."`, o: { morale: 8, skill: 'theory' } }],
    ['The big one. Visibility matters.', 'firm', { morale: 2 }, `"Okay. Big one."`, { text: `"The big conference was overwhelming, but a postdoc recruiter stopped at my poster!"`, o: { morale: 5 }, rep: 1 }],
  ]],
  ['parents', A => A.morale < 50, `"Can I ask something personal? My parents think I should quit and get a 'real job'. Sometimes I think they're right."`, [
    ['You\'re doing real work. Want me to talk to them at the next lab open day?', 'warm', { morale: 10, loyalty: 8 }, `"You'd do that?" You would.`, { text: `"My parents came to the open day. My mom asked you about the vacuum chamber for twenty minutes. She's telling everyone I'm a 'quantum engineer' now."`, o: { morale: 10 } }],
    ['What do YOU think?', 'curious', { loyalty: 6, stress: -4 }, `A long pause. "I think I love this, and I'm scared it won't work out." That's honest.`, { text: `"I told my parents I'm staying. They said fine, as long as I call more. I'm calling more."`, o: { morale: 6 } }],
    ['That\'s a family conversation. I can\'t really help.', 'dismiss', { morale: -6 }, `"Yeah. Sorry for bringing it up."`, null],
  ]],
  ['teach', A => A.role === 'postdoc', `"I'm thinking about faculty applications this fall. Is my record good enough, honestly?"`, [
    ['Let\'s go through your CV together and find the gaps.', 'curious', { loyalty: 8, stress: -4 }, `You spend an hour on it. There are two gaps, and both are fixable in six months.`, { text: `"I fixed the two gaps we found. I sent out twenty applications. I have two interviews!"`, o: { morale: 10 } }],
    ['Yes. Apply broadly. You\'re ready.', 'warm', { morale: 8 }, `They let out a breath they'd been holding for a year.`, { text: `"I have an interview. A real one. They asked about the work we did together."`, o: { morale: 8 } }],
    ['One more year and a big paper first.', 'firm', { morale: -5, stress: 4 }, `"One more year." They don't say it happily.`, null],
  ]],
];

// ---------- lab context: what's going on right now ----------
function contextTopic(A) {
  const o = [];
  const foot = G.life && G.life.footUntil > G.week;
  if (foot) o.push(['foot', `${A.first} glances at your foot. "How's the, um, injury? The undergrads have a betting pool on how it happened."`, [
    ['I sat on it. That\'s the whole story.', 'warm', { morale: 5, team: { morale: 1 } }, `"That's... worse than any of the theories." The pool pays out to nobody.`],
    ['Classified. Tell them it was a lab accident involving a rogue magnet.', 'curious', { morale: 6, culture: 1 }, `By lunch, the story involves a magnet, a ladder and a heroic rescue of a vacuum gauge.`],
  ]]);
  const recent = G.papers.length && G.week - G.papers[G.papers.length - 1].week <= 4 ? G.papers[G.papers.length - 1] : null;
  if (recent) o.push(['paper', `"I still can't believe the paper's out. ${pick(['My mom printed it and put it on the fridge.', 'Someone I don\'t know tweeted about it.', 'I keep re-reading it to check it\'s real.'])}"`, [
    ['Enjoy it. Moments like this are rare.', 'warm', { morale: 6 }, `"I'm going to frame the first page."`],
    ['What should we do better next time?', 'curious', { skill: 'any', morale: 2 }, `They have three thoughtful answers. One of them is "start writing earlier", which is always the answer.`],
  ]]);
  if (G.flags.deadTime && G.flags.deadTime.until > G.week) o.push(['construction', `"The jackhammers start at 7am. I've started wearing earplugs to group meeting. And to sleep. And in the shower."`, [
    ['Want to work from the library for a while?', 'warm', { stress: -6, morale: 3 }, `"Yes. Please. Anywhere quiet."`],
    ['Use it. Write the paper while the experiments are down.', 'firm', { skill: 'theory', stress: 2 }, `"Fine. But I'm writing it with noise-cancelling headphones."`],
  ]]);
  const broken = Object.keys(G.broken || {}).filter(k => G.broken[k] > 0);
  if (broken.length) o.push(['broken', `"Any update on the repair? I've rewatched every alignment video on the internet. Twice."`, [
    ['Soon. Use the time to read and plan.', 'warm', { stress: -3, skill: 'theory' }, `"I made a reading list. It's forty papers. I've read one."`],
    ['Want to help fix it? You\'ll learn a lot.', 'curious', { skill: 'exp', morale: 4 }, `They spend the afternoon with the repair tech and come back covered in vacuum grease and joy.`],
  ]]);
  if (G.culture < 40) o.push(['tense', `"Can I say something? The lab feels tense lately. People stopped eating lunch together."`, [
    ['Thank you for telling me. Any ideas?', 'curious', { loyalty: 5, culture: 2 }, `"Maybe... a lab lunch? Just one?" You make it happen. It helps.`],
    ['I\'ve noticed too. I\'ll fix it.', 'warm', { loyalty: 4, culture: 1 }, `"Okay. Thanks."`],
    ['People are here to work.', 'dismiss', { morale: -5, culture: -2 }, `"Right." That conversation will go around the lab by tonight.`],
  ]]);
  if (G.culture > 75) o.push(['good', `"I don't know if anyone tells you this, but the lab feels really good right now. Like, I like coming in."`, [
    ['That\'s all of you, not me. But thank you.', 'warm', { morale: 6, loyalty: 4 }, `"It's a bit you." They leave before you can argue.`],
    ['What makes it feel good? I want to keep it that way.', 'curious', { loyalty: 4, culture: 1 }, `"People help each other. Nobody's scared to ask dumb questions." You write that down.`],
  ]]);
  const left = G.alumni && G.alumni.length && G.week - G.alumni[G.alumni.length - 1].week <= 6 ? G.alumni[G.alumni.length - 1] : null;
  if (left) o.push(['left', `"It's weird without ${left.name.split(' ')[0]} around. Their mug is still in the sink. Nobody wants to wash it. It feels like a memorial."`, [
    ['Let\'s invite them back for a visit sometime.', 'warm', { morale: 4, culture: 1 }, `"They'd love that." You send the email.`],
    ['Wash the mug.', 'firm', { morale: 1 }, `"...Fair." The mug is washed. The era ends.`],
  ]]);
  const newbie = team().find(p => p !== A && p.weeks < 5 && (A.weeks || 0) > p.weeks + 4);
  if (newbie) o.push(['newbie', `"The new person, ${newbie.first}, is great. They asked me where we 'keep the quantum'. I said the fridge. They believed me."`, [
    ['Show them around properly. You\'d be a good guide.', 'warm', { morale: 3 }, `They do. ${newbie.first} learns where everything is, including the actual quantum.`, newbie],
    ['Leave the poor newcomer alone.', 'curious', { morale: 2 }, `"Okay, okay. Maybe one more prank."`],
  ]]);
  return o;
}

function gossipTopic(A) {
  const o = [];
  for (const B of team()) {
    if (B === A || B.away) continue;
    const r = relOf(A, B);
    if (r > 25) o.push(['g_hero_' + B.id, `"Did you know ${B.first} stayed until 2am last week fixing the ${pick(['laser lock', 'vacuum leak', 'analysis code', 'data pipeline', 'cryostat wiring'])}, and didn't tell anyone? Somebody should know."`, [
      [`I'll thank ${B.first} at group meeting.`, 'warm', { culture: 2 }, `At group meeting, you thank ${B.first} by name. They turn bright red. ${A.first} grins across the table.`, B, { morale: 8, loyalty: 4 }],
      ['That\'s kind of you to point out.', 'curious', { loyalty: 3 }, `"They'd never say it themselves."`, null, null],
      ['That\'s just the job.', 'dismiss', { morale: -3 }, `"Okay." ${A.first} looks like they wish they hadn't said anything.`, null, null],
    ]]);
    if (r < -20) o.push(['g_beef_' + B.id, `"I don't want to be dramatic, but ${B.first} ${pick(['presented my plot at group meeting as if it were theirs', 'keeps leaving the optics bench a disaster', 'talks over me in every meeting', 'books the instrument and then doesn\'t show up'])}."`, [
      ['Have you told them directly? I\'ll back you up if it doesn\'t work.', 'curious', { loyalty: 4, stress: -3 }, `"Not yet. I'll try." A week later, they report it went better than expected.`, B, null, 8],
      [`I'll talk to ${B.first}.`, 'firm', { loyalty: 3 }, `You have a quiet word. ${B.first} is defensive, then thoughtful.`, B, { morale: -3 }, 4],
      ['I\'m sure it\'s a misunderstanding.', 'dismiss', { morale: -4, loyalty: -3 }, `"Sure." They clearly don't think so.`, null, null, -4],
    ]]);
    if (B.stress > 65 && r > -10) o.push(['g_worry_' + B.id, `"Have you noticed ${B.first} seems really tired? They've been here every night this week."`, [
      [`I'll check on ${B.first} today.`, 'warm', { loyalty: 4 }, `You find ${B.first} at their desk at 7pm and send them home. They argue, then go.`, B, { stress: -10, loyalty: 4 }],
      ['Thanks for looking out for them.', 'curious', { loyalty: 2 }, `"We look out for each other here."`, null, null],
    ]]);
  }
  return o;
}

// ---------- the chat visit ----------
function seen(A, id) { const L = lifeOf(A); return L.seen.includes(id); }
function markSeen(A, id) { const L = lifeOf(A); L.seen.push(id); if (L.seen.length > 60) L.seen.shift(); }

function choiceList(c, A, opts) {
  return opts.map(([label, tone, o, reply, B, bfx, relD]) => {
    const { energy, ...eff } = o || {};
    return T(c, tone, A, label, hintOf(eff) + (B && bfx ? ` · ${B.first} ${Object.values(bfx)[0] > 0 ? '↑' : '↓'}` : ''), () => {
      fx(A, eff);
      if (B && bfx) mod(B, bfx);
      if (B && relD) rel(A, B, relD);
      const r = react(A, tone);
      return `${reply}${r && tone !== 'curious' ? ' ' + r : ''}`;
    }, energy ? { cost: { energy } } : {});
  });
}

function physNode(c, A, q) {
  const [, text, real, joke] = q;
  const nerd = has(A, 'theorist') || has(A, 'skeptic');
  return N(A, text, [
    T(c, 'curious', A, 'Grab a marker. Let\'s work it out on the whiteboard.', '−4 energy · theory skill may grow · morale ↑', () => { fx(A, { morale: nerd ? 8 : 5, skill: chance(0.5) ? 'theory' : null }); return `${real} ${nerd ? `${A.first} fills the rest of the board with follow-up questions.` : `${A.first} takes a photo of the board.`}`; }, { cost: { energy: 4 } }),
    T(c, 'warm', A, 'Give a quick, honest answer.', 'Morale ↑ a little', () => { fx(A, { morale: 3, loyalty: 2 }); return real.split('. ').slice(0, 2).join('. ') + (real.split('. ').length > 2 ? '.' : ''); }),
    T(c, 'warm', A, 'Give the joke answer.', 'They laugh (probably)', () => { fx(A, { morale: has(A, 'skeptic') ? 1 : 4 }); return `"${joke}" ${has(A, 'skeptic') ? `${A.first} waits for the real answer. You owe them one.` : `${A.first} laughs.`}`; }),
    T(c, 'dismiss', A, 'Look it up after lunch.', 'Morale ↓ a little', () => { fx(A, { morale: -2 }); return `"Sure." They look it up on their own. You hear them say "whoa" from the hallway.`; }),
  ]);
}

function adviceNode(c, A, a) {
  const [id, , text, opts] = a;
  return N(A, text, opts.map(([label, tone, o, reply, cb, now]) => {
    const { energy, ...eff } = o;
    return T(c, tone, A, label, hintOf(eff), () => {
      fx(A, eff); if (now) now(A);
      if (cb) lifeOf(A).cb.push({ week: G.week + int(5, 10), ...cb });
      const r = react(A, tone);
      return `${reply}${r && tone !== 'curious' ? ' ' + r : ''}`;
    });
  }));
}

// what will this person talk about?
export function chatTopics(A) {
  const L = lifeOf(A); const out = [];
  if (L.story && G.week >= L.story.next) out.push([4, 'story', null]);
  for (const q of PHYS) if (!seen(A, q[0])) out.push([has(A, 'theorist') || has(A, 'dreamer') ? 1.2 : 0.6, 'phys', q]);
  for (const q of ASKS) if (!seen(A, q[0])) out.push([0.7, 'ask', q]);
  for (const q of ADVICE) if (!seen(A, q[0]) && q[1](A)) out.push([0.9, 'advice', q]);
  for (const q of contextTopic(A)) if (!seen(A, q[0] + G.week)) out.push([1.6, 'ctx', q]);
  for (const q of gossipTopic(A)) if (!seen(A, q[0])) out.push([has(A, 'social') || has(A, 'diplomat') ? 1.4 : 0.6, 'gossip', q]);
  return out;
}

export const CHAT_EV = {};
CHAT_EV.chat = {
  kind: 'solo', cd: 2,
  w: c => (c.A.weeks > 1 ? 1.4 : 0) * (storyDue(c.A) ? 1.8 : 1) * (has(c.A, 'social') ? 1.5 : has(c.A, 'loner') ? 0.6 : 1),
  run(c) {
    const { A } = c; const L = lifeOf(A);
    if (!c.v.pick) {
      const cand = chatTopics(A);
      const tot = cand.reduce((s, x) => s + x[0], 0);
      let r = Math.random() * tot; let p = cand[0];
      for (const x of cand) { r -= x[0]; if (r <= 0) { p = x; break; } }
      c.v.pick = p ? { kind: p[1], id: p[2] ? p[2][0] : null } : { kind: 'none' };
    }
    note(A, 'chat', null);
    // a callback from earlier advice comes first
    let pre = '';
    const due = L.cb.find(x => G.week >= x.week);
    if (due && !c.v.cbDone) { c.v.cbDone = 1; L.cb = L.cb.filter(x => x !== due); fx(A, due.o || {}); if (due.rep) addRep(due.rep); if (due.gw) gw(due.gw); pre = `${due.text} `; }
    const start = `${opener(A)} ${pre}`;
    const P = c.v.pick;
    if (P.kind === 'story') return storyNode(c, A, start);
    if (P.kind === 'phys') { markSeen(A, P.id); const q = PHYS.find(x => x[0] === P.id); const n = physNode(c, A, q); n.text = start + n.text; return n; }
    if (P.kind === 'advice') { markSeen(A, P.id); const n = adviceNode(c, A, ADVICE.find(x => x[0] === P.id)); n.text = start + n.text; return n; }
    if (P.kind === 'ask') { markSeen(A, P.id); const q = ASKS.find(x => x[0] === P.id); return N(A, start + q[1], choiceList(c, A, q[2])); }
    if (P.kind === 'ctx' || P.kind === 'gossip') {
      const q = (P.kind === 'ctx' ? contextTopic(A) : gossipTopic(A)).find(x => x[0] === P.id);
      if (!q) return storyNode(c, A, start) || null;
      markSeen(A, P.kind === 'ctx' ? P.id + G.week : P.id);
      return N(A, start + q[1], choiceList(c, A, q[2]));
    }
    return pre ? N(A, start, [C('Glad to hear it.', '', () => null)]) : null;
  },
};

// options added to a 1:1 check-in: ask about their life
export function lifeChoices(c, A, again) {
  const L = lifeOf(A); const ch = [];
  const asked = c.v.asked = c.v.asked || {};
  const topic = storyTopic(A);
  if (!asked.life && L.story) {
    const due = G.week >= L.story.next;
    ch.push(T(c, 'curious', A, topic || 'Anything going on outside the lab?', due ? 'They have news' : 'Small talk', () => {
      asked.life = 1;
      if (due) return storyNode(c, A, topic ? '' : `${A.first} perks up. `);
      const quiet = topic ? vary('lifequiet', [`"Nothing new on that front. Still going."`, `"Same as last time, really. I'll keep you posted."`, `"Slowly! I'll tell you when something happens."`]) : vary('lifenone', [`"Not much. Lab, sleep, repeat."`, `"I watched an entire documentary about octopuses. That's my news."`, `"I finally fixed my bike. That's it. That's the news."`]);
      mod(A, { loyalty: 2 });
      return again(quiet);
    }));
  }
  if (!asked.phys) {
    const q = PHYS.find(x => !seen(A, x[0]));
    if (q && (has(A, 'theorist') || has(A, 'dreamer') || has(A, 'skeptic') || chance(0.4))) ch.push(T(c, 'curious', A, 'Read anything interesting lately?', 'They have a question for you', () => { asked.phys = 1; markSeen(A, q[0]); return physNode(c, A, q); }));
  }
  return ch;
}
