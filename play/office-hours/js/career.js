// Career pressure and people's research direction:
//  - HR programs: a serious incident means mandatory meetings with HR every two weeks until you finish them.
//  - Job security: without tenure, terrible goodwill or an HR record can get you put on probation, then fired.
//    With tenure you are safe; the worst you get is a formal reprimand.
//  - Research interests: every lab member wants to work on certain platforms and questions, in a certain style.
import { CARDS, PLATS } from './data.js';
import { G, hooks, int, pick, chance, clamp, has, mod, team, person, proj, card, log, mail, queueVisit, addRep } from './sim.js';
import { N, C, note, cul, gw } from './talk.js';

// ---------- research interests ----------
const STYLES = { experiment: 'building and running experiments', theory: 'theory and calculations', computation: 'simulation and data analysis', applications: 'things with real-world applications' };
const DREAMS = [
  'see something nobody has ever seen', 'build the most precise instrument in the world', 'find the dark matter, honestly', 'write a paper that ends up in textbooks',
  'start a company someday', 'run their own lab', 'make a quantum computer actually useful', 'explain something that confuses everyone', 'work at a national lab', 'teach, eventually',
];
export function interestsOf(p) {
  if (p.interests) return p.interests;
  const bg = (p.expertise || []).map(id => CARDS.find(c => c.id === id)).filter(Boolean);
  const bgPlats = bg.map(c => c.plat || (Array.isArray(c.fits) && c.fits[0])).filter(x => x && x !== 'any' && PLATS[x]);
  const plats = [...new Set([...bgPlats, ...Object.keys(PLATS).sort(() => Math.random() - 0.5)])].slice(0, 2);
  const goals = CARDS.filter(c => c.k === 'goal' && (!c.fits || c.fits === 'any' || [].concat(c.fits).some(f => f === 'any' || plats.includes(f))));
  const style = has(p, 'theorist') ? 'theory' : has(p, 'handson') ? 'experiment' : has(p, 'coder') ? 'computation' : has(p, 'industry') ? 'applications' : pick(Object.keys(STYLES));
  p.interests = { plats, goal: goals.length ? pick(goals).id : null, style, dream: pick(DREAMS) };
  return p.interests;
}
// how well a project fits what they want: -1 (not at all) .. 2 (dream project)
export function fitScore(p, pr) {
  if (!pr) return 0;
  const I = interestsOf(p); const [sys, tech, goal] = pr.cards.map(card);
  let s = 0;
  if (sys && I.plats.includes(sys.plat)) s += 1;
  if (I.goal && pr.cards.includes(I.goal)) s += 1;
  const mode = sys ? sys.mode : null;
  if ((I.style === 'theory' && mode === 'theory') || (I.style === 'experiment' && mode === 'exp') || (I.style === 'computation' && (mode === 'theory' || (tech && /simulat|machine|neural|tensor/i.test(tech.name))))) s += 0.5;
  return s === 0 ? -1 : s;
}
export function interestText(p) {
  const I = interestsOf(p);
  const g = I.goal ? CARDS.find(c => c.id === I.goal) : null;
  return { plats: I.plats.map(k => PLATS[k]).join(' and '), goal: g ? g.name : null, style: STYLES[I.style], dream: I.dream };
}
// weekly: working on something you care about matters
export function interestTick() {
  for (const p of team()) {
    if (p.away || !p.project) continue;
    const f = fitScore(p, proj(p.project));
    mod(p, { morale: f >= 1.5 ? 0.9 : f >= 1 ? 0.5 : f < 0 ? -0.6 : 0 });
  }
}

// ---------- HR programs ----------
export const hrOf = () => G.hr || (G.hr = { left: 0, next: 0, done: 0, programs: 0, noncomp: 0, record: 0 });
// called from say.js when something you said goes to HR
export function startHR(severity) {
  const H = hrOf();
  H.record += severity;
  H.programs++;
  const n = H.programs === 1 ? 3 : H.programs === 2 ? 5 : 8;
  H.left += n; if (!H.next || H.next < G.week) H.next = G.week + 1;
  mail('Human Resources', 'Mandatory meetings', `Following the incident reported this week, you are required to attend ${n} meetings with HR, one every two weeks, starting next week.\n\nAttendance and engagement are recorded.${G.tenured ? '' : ' Faculty without tenure should be aware that their file is reviewed.'}`);
  return n;
}
export function hrDirector() {
  const H = hrOf();
  if (H.left > 0 && G.week >= H.next && !G.queue.some(q => q.ev === 'hr_session')) {
    queueVisit({ ev: 'hr_session', ext: 'hr', pri: 3 });
    H.next = G.week + 2;
  }
  if (H.left > 0) G.energy = clamp(G.energy - 2, 0, 100); // prep, paperwork, the walk across campus
}
const MODULES = [
  'a video module called "Respect in the Research Environment", narrated by an actor in a lab coat who is holding a beaker wrong',
  'a role-play where you are the student and Dana plays you. Dana is unsettlingly accurate',
  'a reflective writing exercise: "Describe a time your words had an impact you did not intend"',
  'a workshop on power dynamics in advising, with a worksheet that has a diagram of a pyramid',
  'a one-on-one review of the incident, line by line, with the original wording on a slide',
  'a session on giving feedback that is honest without being cruel. There are breakout rooms. You are in a breakout room alone with Dana',
  'a quiz. You get one question wrong and have to explain why',
  'an exit interview about what you will do differently',
];
export const CAREER_EV = {};
CAREER_EV.hr_session = {
  kind: 'ext', ext: 'hr',
  run(c) {
    const H = hrOf();
    if (H.left <= 0) return null;
    const mod_ = MODULES[(H.done + H.programs) % MODULES.length];
    const prog = `${H.left} meeting${H.left > 1 ? 's' : ''} left`;
    const finish = extra => {
      H.left--; H.done++;
      if (H.left <= 0) {
        H.record = Math.max(0, H.record - 1);
        mail('Human Resources', 'Program completed', 'You have completed your mandatory meetings. A note has been added to your file that you completed the program.' + (H.noncomp ? ' Your attendance record is also noted.' : ''));
        hooks.toast('🧑‍⚖️ HR program complete.', 'good');
        return `${extra} Dana closes the folder. "That's the last one. Thank you for engaging. I mean that."`;
      }
      return `${extra} "${H.left} to go," Dana says, and books the next one.`;
    };
    return N(c.X, `Dana from HR sits down with a laptop and a very thick folder. (${prog}.) Today is ${mod_}.`, [
      C('Engage honestly. Take it seriously.', '−8 energy · counts toward finishing', () => { G.energy = clamp(G.energy - 8, 0, 100); return finish('It is uncomfortable. You learn something anyway.'); }, { tone: 'warm' }),
      C('Ask what you could do to make it right with the student.', '−10 energy · counts · lab culture ↑ a little', () => { G.energy = clamp(G.energy - 10, 0, 100); cul(1); return finish('Dana suggests a sincere, short apology and then leaving the student space. "Don\'t make them comfort you."'); }),
      C('Answer emails under the table.', 'Doesn\'t count · adds a meeting · noted in your file', () => { H.left++; H.noncomp++; return `Dana stops mid-sentence and waits until you look up. "We'll add a session." It goes in the file.`; }),
      C('Argue that it was obviously a joke.', 'Adds two meetings · noted in your file', () => { H.left += 2; H.noncomp++; H.record += 0.5; return `"Impact matters more than intent," Dana says, in a voice that has said it a thousand times. Two more sessions.`; }),
      C('Reschedule. You have a grant deadline.', 'Pushed one week · noted if you keep doing it', () => { H.next = G.week + 1; H.resched = (H.resched || 0) + 1; if (H.resched >= 2) { H.noncomp++; H.resched = 0; return `"This is the second reschedule." Dana writes something down.`; } return '"Fine. Next week, then. Same time."'; }),
    ]);
  },
};

// ---------- job security ----------
function jobTrouble() {
  const H = hrOf();
  const why = [];
  if (G.goodwill < 12) why.push('the collapse of your department goodwill');
  if (H.record >= 3) why.push('your HR record');
  if (H.noncomp >= 3) why.push('repeatedly failing to cooperate with HR');
  return why;
}
export function jobDirector() {
  const why = jobTrouble();
  const P = G.flags.probation;
  if (!P && why.length) {
    G.flags.probation = { start: G.week, until: G.week + 16, why: why.join(' and '), strikes: hrOf().record };
    queueVisit({ ev: G.tenured ? 'reprimand' : 'probation', ext: 'chair', pri: 4 }, true);
    return;
  }
  if (P && G.week >= P.until) {
    G.flags.probation = null;
    if (G.tenured) return;
    const H = hrOf();
    const fixed = G.goodwill >= 25 && H.record <= P.strikes && H.noncomp < 3 && H.left === 0;
    if (fixed) { mail('Office of the Dean', 'Probation lifted', 'The review committee has met. Your probation is lifted. Please consider this a fresh start.'); hooks.toast('📄 Probation lifted.', 'good'); log('Probation lifted.'); }
    else queueVisit({ ev: 'fired', ext: 'chair', pri: 5 }, true);
  }
}
CAREER_EV.probation = {
  kind: 'ext', ext: 'chair',
  run(c) {
    const P = G.flags.probation; if (!P) return null;
    return N(c.X, `The chair closes the door, which he never does. "I'll be direct. Because of ${P.why}, the dean has put you on probation. Sixteen weeks. If things haven't turned around by then, the college will not renew your contract. Without tenure, there is nothing I can do."`, [
      C('What exactly do I need to do?', 'Learn the conditions', () => `"Get your department goodwill above 25. No new HR incidents. Finish every HR meeting you owe, and show up to them. Serve on things. Say yes to things. Be a colleague." He pauses. "I'd like you to stay."`),
      C('I understand. I\'ll fix it.', '', () => { gw(2); return '"Good. My door is open, for once."'; }),
      C('This is ridiculous.', 'Goodwill ↓', () => { gw(-5); return '"I\'ll pretend you didn\'t say that. Sixteen weeks."'; }),
    ]);
  },
};
CAREER_EV.reprimand = {
  kind: 'ext', ext: 'chair',
  run(c) {
    const P = G.flags.probation; if (!P) return null;
    return N(c.X, `The chair sighs. "Because of ${P.why}, the dean is issuing a formal letter of reprimand. You have tenure, so your job is safe. But it goes in your file, your raise is frozen, and people will talk."`, [
      C('Understood.', 'Reputation ↓ · goodwill ↓', () => { addRep(-6); gw(-3); G.flags.raiseFrozen = G.week + 48; log('Formal reprimand (tenured: job safe).'); return 'The letter arrives the next morning, on very heavy paper.'; }),
      C('Tenure exists for a reason.', 'Reputation ↓ more · goodwill ↓ more', () => { addRep(-8); gw(-8); log('Formal reprimand (tenured: job safe).'); return '"It does," he says. "This isn\'t it." He leaves the door open on his way out.'; }),
    ]);
  },
};
CAREER_EV.fired = {
  kind: 'ext', ext: 'chair',
  run(c) {
    return N(c.X, `The chair and someone from HR come in together. That is how you know. "The college has decided not to renew your appointment. Your students will be placed with other groups. I'm sorry. I really am."`, [
      C('Pack up the office.', 'Game over', () => { G.over = true; hooks.gameOver('fired'); return 'Your students help you carry the boxes. Nobody says much.'; }),
    ]);
  },
};
