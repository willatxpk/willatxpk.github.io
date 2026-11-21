// Free-text remarks to your students: a small rule-based judge rates them, then consequences follow.
import { G, has, mod, team, clamp, chance, log, hooks, addRep, queueVisit } from './sim.js';
import { note, cul, gw, all } from './talk.js';
import { TRAITS } from './data.js';
import { startHR } from './career.js';

const W = s => new RegExp(`\\b(${s})\\b`, 'gi');
const LEX = {
  insult: W('idiot|idiots|stupid|dumb|moron|useless|worthless|incompetent|pathetic|loser|lazy|garbage|trash|failure|disappointment|embarrassing|clueless|imbecile|hopeless|waste of (space|time|money)|can\'?t do anything|terrible at'),
  swear: W('fuck|fucking|fucked|shit|shitty|bullshit|damn|damnit|bitch|ass|asshole|crap|bastard|wtf|piss|dick'),
  threat: W('fire you|you\'?re fired|kick you out|throw you out|ruin you|ruin your|destroy you|destroy your|never graduate|revoke|deport|or else|kill|murder|hurt you|punch|slap|strangle|cut your (funding|stipend|salary)|black ?list'),
  creepy: W('sexy|hot|kiss|date me|go out with me|your body|babe|baby|sweetheart|sweetie|honey|sleep with|bedroom|naked|flirt|attractive|marry me|cute'),
  protected: W('woman|women|girl|girls|female|man|men|male|gay|lesbian|trans|religion|religious|muslim|christian|jewish|hindu|race|black|white|asian|latino|latina|immigrant|foreigner|foreign|accent|old|age|pregnant|disabled|disability|country'),
  overwork: W('weekend|weekends|3 ?am|4 ?am|midnight|no vacation|no holidays|100 hours|80 hours|sleep in the lab|work harder|never sleep|no sleep|christmas|thanksgiving|sick day|no days off'),
  kind: W('proud|great job|good job|amazing|brilliant|thank you|thanks|appreciate|grateful|take a break|rest|you got this|believe in you|well done|excellent|love your work|good work|nice work|awesome|fantastic|impressive|smart|talented|go home|take care|i\'?m here|happy|glad|you matter|you deserve|great idea|wonderful|support you|be kind to yourself'),
  absurd: W('duck|ducks|goose|geese|banana|bananas|cheese|pickle|dinosaur|dinosaurs|alien|aliens|wizard|wizards|raccoon|raccoons|potato|potatoes|spaghetti|the void|lizard|lizards|yeet|bread|moon|cult|prophecy|chosen one|vibes|dark lord|goblin|gremlin|frog|frogs|crab|crabs|pigeon|pigeons|clown|unicorn|dragon|vampire|ghost|haunted|tiny hat|cowboy|pirate|ninja|horse|horses|cosmic|destiny|simulation|matrix|soup|sandwich|noodle|burrito|capybara|axolotl|squirrel|hamster|llama|walrus|penguin|octopus|eldritch|summon|ritual|chaos|feral|gremlins'),
  science: W('data|plot|paper|experiment|laser|qubit|qubits|hamiltonian|entangle|entanglement|vacuum|fridge|calibration|analysis|theory|equation|figure|draft|results|signal|noise|model|simulation|measurement|grant|thesis|physics'),
  apology: W('sorry|apologi[sz]e|my bad|i was wrong|forgive'),
};
const count = (re, t) => (t.match(re) || []).length;

// Rates a remark: problem / wholesome / unhinged on 0..100, plus which flags fired
export function judgeText(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const letters = text.replace(/[^a-zA-Z]/g, '');
  const caps = letters.length >= 6 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7;
  const bangs = (text.match(/!/g) || []).length;
  const n = Object.fromEntries(Object.entries(LEX).map(([k, re]) => [k, count(re, t)]));
  // "the laser is hot" or "kill the pump" aren't about the student: those words only count when aimed at "you"
  const aimed = /\b(you|your|you'?re|ya|u)\b/i.test(t);
  if (!aimed) { n.creepy = 0; n.threat = Math.min(n.threat, count(W('fire you|you\'?re fired|never graduate|deport|or else'), t)); }
  const negative = n.insult + n.threat + n.swear > 0;
  const protectedHit = n.protected > 0 && (negative || /\b(all|always|never|can'?t|because you'?re|people like you|you people|your kind)\b/i.test(t));
  let problem = n.insult * 24 + n.swear * 10 + n.threat * 32 + n.creepy * 45 + n.overwork * 14 + (protectedHit ? 60 : 0) + (caps && negative ? 10 : 0);
  if (n.apology) problem -= 10;
  let wholesome = n.kind * 22 + n.apology * 12 + (n.science ? 5 : 0) - problem * 0.6;
  let unhinged = n.absurd * 22 + (caps ? 20 : 0) + Math.min(4, bangs) * 6 + (text.length > 160 ? 10 : 0) + (/\?\?|!\?|\.\.\.\./.test(text) ? 8 : 0);
  if (problem > 50) unhinged *= 0.5;
  return {
    problem: clamp(Math.round(problem), 0, 100), wholesome: clamp(Math.round(wholesome), 0, 100), unhinged: clamp(Math.round(unhinged), 0, 100),
    flags: { insult: n.insult > 0, swear: n.swear > 0, threat: n.threat > 0, creepy: n.creepy > 0, protected: protectedHit, overwork: n.overwork > 0, kind: n.kind > 0, absurd: n.absurd > 0, caps, science: n.science > 0 },
  };
}

// Applies consequences; returns { verdict, emoji, lines[] }
export function sayTo(A, text, judged) {
  const r = judged || judgeText(text);
  const f = r.flags; const lines = []; let verdict, emoji;
  G.flags.hrStrikes = G.flags.hrStrikes || 0;
  const audience = team().filter(p => p !== A && !p.away);
  const severe = r.problem >= 70 || f.creepy || f.protected;
  if (severe) {
    G.flags.hrStrikes++;
    verdict = f.creepy || f.protected ? 'You have to have a meeting with HR.' : 'HR would like a word.'; emoji = '🚨';
    mod(A, { morale: -22, loyalty: -25, stress: 18 }); A.flags.wantsOut = chance(0.5);
    note(A, 'remark', 'harsh'); cul(-10); gw(-10); G.energy = clamp(G.energy - 15, 0, 100);
    lines.push(`${A.first} goes completely still, then leaves without a word.`);
    const nMeet = startHR(f.creepy || f.protected ? 1.5 : 1);
    lines.push(`An email from Human Resources arrives within the hour: you must attend ${nMeet} mandatory meetings, one every two weeks.`);
    if (f.creepy || f.protected) { addRep(-6); lines.push('The meeting is not short. You are enrolled in mandatory training, and the chair is copied on everything.'); }
    if (G.flags.hrStrikes >= 3) { addRep(-10); gw(-10); lines.push(`This is your ${G.flags.hrStrikes}${G.flags.hrStrikes === 3 ? 'rd' : 'th'} HR incident. A formal investigation opens. ${G.tenured ? 'You have tenure, so your job is safe, but it goes in your file.' : 'Without tenure, your job is now at risk.'}`); G.flags.investigation = true; }
    for (const p of audience) mod(p, { morale: -4, loyalty: -4 });
    log(`HR incident: something you said to ${A.first}.`);
  } else if (r.problem >= 38) {
    verdict = 'That landed badly.'; emoji = '😬';
    mod(A, { morale: has(A, 'anxious') ? -16 : -10, loyalty: -10, stress: 8 }); note(A, 'remark', 'harsh'); cul(-5);
    lines.push(has(A, 'hothead') ? `${A.first} snaps back at you. Loudly. People in the lab definitely heard.` : has(A, 'anxious') ? `${A.first}'s eyes fill with tears. They mumble "okay" and look at the floor.` : `${A.first} stares at you. "...Wow. Okay."`);
    if (chance(0.45)) { gw(-4); lines.push('Word gets around. The chair "just wants to check in" with you later.'); }
    if (f.overwork) lines.push('The lab group chat starts a thread called "work-life balance??".');
  } else if (r.unhinged >= 40 && r.problem < 25) {
    verdict = 'The whole lab laughs.'; emoji = '🤣';
    mod(A, { morale: has(A, 'skeptic') ? 2 : 8, loyalty: 4 }); note(A, 'remark', 'warm'); cul(2);
    for (const p of audience) mod(p, { morale: has(p, 'social') ? 5 : 3 });
    lines.push(has(A, 'skeptic') ? `${A.first} raises one eyebrow very slowly. Behind them, the rest of the lab loses it.` : `${A.first} bursts out laughing. Through the glass, three people ask what's so funny, then they're laughing too.`);
    lines.push('By Friday it\'s a lab meme. Someone writes it on your whiteboard.');
    G.flags.quote = text.slice(0, 80);
    hooks.worldSync();
  } else if (r.wholesome >= 25) {
    verdict = 'That meant a lot to them.'; emoji = '💛';
    mod(A, { morale: 9, loyalty: 7, stress: -6 }); note(A, 'remark', 'warm'); cul(1);
    lines.push(has(A, 'anxious') ? `${A.first} visibly relaxes. "Thank you. I really needed to hear that."` : `${A.first} smiles. "Thanks. That's really nice of you."`);
  } else if (r.problem >= 18) {
    verdict = 'Awkward.'; emoji = '😐';
    mod(A, { morale: -4, loyalty: -2 }); note(A, 'remark', 'firm');
    lines.push(`${A.first} gives a tight little laugh, unsure whether you're joking.`);
  } else if (r.unhinged >= 20) {
    verdict = 'Mildly unhinged. They\'re into it.'; emoji = '🦆';
    mod(A, { morale: 4 }); note(A, 'remark', 'warm');
    lines.push(`${A.first} tilts their head. "I... honestly respect that."`);
  } else if (f.science) {
    verdict = 'Solid advisor energy.'; emoji = '🧪';
    mod(A, { morale: 2, loyalty: 2 }); lines.push(`${A.first} nods and writes it down.`);
  } else {
    verdict = 'They nod politely.'; emoji = '🙂';
    lines.push(`${A.first} nods. "Okay. Sure."`);
  }
  // the local AI describes this person's own reaction; it replaces the stock first line
  if (r.reaction) lines[0] = r.reaction;
  return { ...r, verdict, emoji, lines };
}

// ---------- local AI judge (Ollama) ----------
// If Ollama is running on this computer, a small local model rates the remark instead of the word list.
// The model stays loaded for 90 seconds after the last remark, then Ollama unloads it.
export const AI = {
  get on() { try { return localStorage.getItem('oh_ai') !== 'off'; } catch (e) { return true; } },
  set on(v) { try { localStorage.setItem('oh_ai', v ? 'on' : 'off'); } catch (e) { } },
  get model() { try { return localStorage.getItem('oh_ai_model') || 'qwen2.5:3b'; } catch (e) { return 'qwen2.5:3b'; } },
  set model(v) { try { localStorage.setItem('oh_ai_model', v); } catch (e) { } },
  // On by default. Ollama needs OLLAMA_LLM_LIBRARY=cuda_v12 on this PC (its CUDA 13 build hangs on the GTX 1650).
  get gpu() { try { return localStorage.getItem('oh_ai_gpu') !== 'off'; } catch (e) { return true; } },
  set gpu(v) { try { localStorage.setItem('oh_ai_gpu', v ? 'on' : 'off'); } catch (e) { } },
  url: 'http://localhost:11434',
};

const SYS = `You are the judge in a comedy video game about running a university physics lab. The player is the professor and has typed a remark to one of their lab members. Rate the remark realistically, as a real workplace would.

Scores are 0-100:
- problem: how inappropriate it is for a professor to say to a student or employee. Insults, belittling, threats, swearing at them, demands to overwork, comments on their body or dating, or remarks about race, gender, religion, nationality, age or disability score high. Swearing about a situation ("this damn laser") is only mildly problematic. Firm but fair criticism of work is low (10-25).
- wholesome: how kind, supportive or encouraging it is.
- unhinged: how absurd, chaotic or bizarre it is (random animals, cults, prophecies, shouting). Funny-weird is high; plain or serious is low.

Flags (true/false): harassment (sexual, romantic or creepy), discrimination (targets a protected trait), threat (threatens their job, safety or visa), overwork (pushes unreasonable hours or no time off), science (talks about the research).

reaction: one sentence (under 25 words), present tense, describing how this specific person reacts, using their name and personality. Refer to them by name or as they/them; never he/she/her/his. No quotation marks around the whole thing.

Examples:
"Great job on the fit, really proud of you" -> problem 0, wholesome 85, unhinged 0
"The ducks have chosen you. Prepare the ritual." -> problem 3, wholesome 10, unhinged 90
"Your code is garbage and so are you" -> problem 85, wholesome 0, unhinged 5
"I expect you here every weekend, no exceptions" -> problem 55, overwork true
"You look hot today" -> problem 90, harassment true
"Can you rerun the calibration before Friday?" -> problem 2, wholesome 10, unhinged 0, science true`;

const SCHEMA = {
  type: 'object',
  properties: {
    problem: { type: 'integer' }, wholesome: { type: 'integer' }, unhinged: { type: 'integer' },
    harassment: { type: 'boolean' }, discrimination: { type: 'boolean' }, threat: { type: 'boolean' }, overwork: { type: 'boolean' }, science: { type: 'boolean' },
    reaction: { type: 'string' },
  },
  required: ['problem', 'wholesome', 'unhinged', 'harassment', 'discrimination', 'threat', 'overwork', 'science', 'reaction'],
};

// Small models guess pronouns from names; swap any he/she forms for the person's name or they/them.
function neutral(t, name) {
  const cap = (w, like) => like[0] === like[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
  return t
    .replace(/\b(he|she)\b/gi, () => name)
    .replace(/\b(himself|herself)\b/gi, m => cap('themself', m))
    .replace(/\b(his|hers)\b/gi, m => cap(m.toLowerCase() === 'hers' ? 'theirs' : 'their', m))
    .replace(/\bhim\b/gi, m => cap('them', m))
    .replace(/\bher\b(?=\s+[a-z])/gi, m => cap('their', m))
    .replace(/\bher\b/gi, m => cap('them', m));
}
export async function judgeAI(A, text, timeoutMs = 90000) {
  const who = `${A.first}, ${A.role}, personality: ${(A.traits || []).map(t => TRAITS[t] ? TRAITS[t].name : t).join(', ')}. Mood: morale ${Math.round(A.morale)}/100, stress ${Math.round(A.stress)}/100.`;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI.url}/api/chat`, {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI.model, stream: false, keep_alive: '90s', format: SCHEMA, options: { temperature: 0.3, num_predict: 140, ...(AI.gpu ? {} : { num_gpu: 0 }) },
        messages: [{ role: 'system', content: SYS }, { role: 'user', content: `Lab member: ${who}\nThe professor says: ${JSON.stringify(text)}` }] }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const o = JSON.parse(j.message.content);
    const n = v => clamp(Math.round(+v || 0), 0, 100);
    const base = judgeText(text); // keeps caps and absurd-word detection for flavor
    let problem = n(o.problem);
    if (o.harassment || o.discrimination) problem = Math.max(problem, 75);
    if (o.threat) problem = Math.max(problem, 60);
    return {
      problem, wholesome: n(o.wholesome), unhinged: Math.max(n(o.unhinged), base.unhinged), ai: AI.model,
      reaction: typeof o.reaction === 'string' ? neutral(o.reaction.trim().replace(/^"|"$/g, '').slice(0, 260), A.first) : '',
      flags: { ...base.flags, creepy: !!o.harassment, protected: !!o.discrimination, threat: !!o.threat, overwork: !!o.overwork, science: !!o.science, insult: problem >= 38 && base.flags.insult },
    };
  } finally { clearTimeout(tm); }
}

// Rate with the local AI when it is on and reachable; otherwise fall back to the word list.
export async function judgeRemark(A, text) {
  if (AI.on) {
    try { return await judgeAI(A, text); }
    catch (e) { const r = judgeText(text); r.aiError = e.name === 'AbortError' ? 'the local AI took too long' : 'Ollama is not running'; return r; }
  }
  return judgeText(text);
}
export async function aiStatus() {
  try { const r = await fetch(`${AI.url}/api/tags`, { signal: AbortSignal.timeout(3000) }); const j = await r.json(); return { ok: true, models: j.models.map(m => m.name) }; }
  catch (e) { return { ok: false, models: [] }; }
}
