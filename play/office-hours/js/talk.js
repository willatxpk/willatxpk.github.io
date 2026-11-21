// Conversation toolkit: memory, tone, trust, varied lines, personality reactions and promises.
import { G, pick, chance, clamp, has, mod, team, person } from './sim.js';

export const N = (who, text, choices) => ({ who, text, choices });
export const C = (t, hint, d, extra = {}) => ({ t, hint, do: d, ...extra });

// ---------- memory ----------
// Every person (students, colleagues, your partner) keeps a short log of how you treated them.
export function memOf(p) { if (!p.mem) p.mem = { log: [], tones: [] }; return p.mem; }
export function note(p, what, tone) {
  if (!p) return;
  const m = memOf(p);
  m.log.unshift({ w: G.week, what, tone });
  if (m.log.length > 16) m.log.length = 16;
  if (tone) { m.tones.unshift(tone); if (m.tones.length > 10) m.tones.length = 10; }
}
export const lastNote = (p, what, within = 9999) => p ? memOf(p).log.find(l => l.what === what && G.week - l.w <= within) : null;
export const countNotes = (p, what, within = 9999) => p ? memOf(p).log.filter(l => l.what === what && G.week - l.w <= within).length : 0;
export const lastTone = p => p ? memOf(p).tones[0] : null;

// how much they trust you, -1..1
export function trust(p) {
  if (!p) return 0;
  let s = p.loyalty !== undefined ? (p.loyalty - 50) / 50 : p.rel !== undefined ? (p.rel - 50) / 50 : 0;
  memOf(p).tones.forEach((t, i) => { const w = 1 - i * 0.08; s += w * (t === 'warm' ? 0.07 : t === 'curious' ? 0.04 : t === 'harsh' ? -0.14 : t === 'dismiss' ? -0.08 : 0); });
  return clamp(s, -1, 1);
}

// ---------- tone-tagged choices ----------
// T(c, tone, who, label, hint, fn): records the tone on everyone listed, then runs fn.
export function T(c, tone, who, label, hint, fn, extra = {}) {
  return C(label, hint, () => { for (const w of [].concat(who)) if (w) note(w, c.v.ev, tone); return fn(); }, { tone, ...extra });
}

// ---------- line variety ----------
// Picks a variant, avoiding the one used last time for this key.
export function vary(key, arr) {
  const used = G.flags.vary || (G.flags.vary = {});
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && i === used[key]) i = (i + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length;
  used[key] = i;
  return arr[i];
}

// ---------- body language before they speak ----------
export function opener(A) {
  const tr = trust(A), n = A.first;
  if (A.stress > 78) return vary('op_stress', [`${n} looks wrecked. Dark circles, cold coffee.`, `${n} sits down like their bones hurt.`, `${n}'s hands are shaking slightly.`]);
  if (tr < -0.45) return vary('op_cold', [`${n} hovers at the door before sitting, not quite meeting your eyes.`, `${n} sits on the edge of the chair, arms folded.`, `${n} knocks very quietly, as if hoping you won't hear.`]);
  if (has(A, 'hothead') && A.morale < 40) return `${n} shuts the door a little too hard.`;
  if (tr > 0.5) return vary('op_warm', [`${n} drops into the chair like it's theirs.`, `${n} pokes their head in with a grin.`, `${n} wanders in, already mid-thought.`]);
  if (has(A, 'anxious')) return vary('op_anx', [`${n} hovers. "Sorry, is this a bad time?"`, `${n} clutches a notebook like a shield.`]);
  return vary('op_def', [`${n} knocks on the open door.`, `${n} sits down across from you.`, `${n} leans in the doorway. "Got a minute?"`, `${n} comes in with a laptop under one arm.`]);
}

// ---------- personality reactions to your tone ----------
export function react(A, tone) {
  if (!A || !A.traits) return '';
  const n = A.first;
  if (tone === 'warm') {
    if (has(A, 'anxious')) { mod(A, { stress: -4 }); return `${n}'s shoulders drop an inch.`; }
    if (has(A, 'skeptic')) return `${n} studies your face, checking whether you mean it. You do.`;
    if (has(A, 'hothead')) { mod(A, { morale: 3 }); return `Some of the fight goes out of ${n}.`; }
    return pick([`${n} smiles.`, `${n} nods, relieved.`, `"Thank you. Really."`]);
  }
  if (tone === 'harsh') {
    if (has(A, 'anxious')) { mod(A, { stress: 8 }); return `${n} goes pale.`; }
    if (has(A, 'hothead')) { mod(A, { morale: -5, loyalty: -4 }); return `"Wow. Okay." ${n} is furious and not hiding it.`; }
    if (has(A, 'workaholic')) return `${n} nods tightly. They'll be in the lab until midnight.`;
    if (has(A, 'slacker')) return `${n} shrugs. It slides right off.`;
    return pick([`${n} flinches.`, `${n}'s jaw tightens.`, `"...Understood."`]);
  }
  if (tone === 'firm') {
    if (has(A, 'perfectionist') || has(A, 'diplomat')) { mod(A, { loyalty: 2 }); return `${n} respects the clarity.`; }
    if (has(A, 'hothead')) return `${n} opens their mouth to argue, then thinks better of it.`;
    return '';
  }
  if (tone === 'dismiss') {
    if (has(A, 'dreamer') || has(A, 'ambitious')) { mod(A, { morale: -4 }); return `${n} deflates.`; }
    return pick([`${n} lets it go. For now.`, '']);
  }
  if (tone === 'curious') {
    if (has(A, 'skeptic') || has(A, 'theorist')) { mod(A, { morale: 2 }); return `${n} lights up at the question.`; }
    return '';
  }
  return '';
}
export const withReact = (A, tone, text) => { const r = react(A, tone); return r ? `${text} ${r}` : text; };

// ---------- promises ----------
// A promise schedules a follow-up visit where the person checks whether you kept it.
export function promise(A, kind, weeks, data = {}) {
  G.followups = G.followups || [];
  G.followups.push({ A: A.id, kind, week: G.week + weeks, made: G.week, data });
}

// a few small helpers used everywhere
export const cul = d => { G.culture = clamp(G.culture + d, 0, 100); };
export const gw = d => { G.goodwill = clamp(G.goodwill + d, 0, 100); };
export const all = (o, except = []) => { for (const p of team()) if (!except.includes(p)) mod(p, o); };
export const worstRel = A => { let w = null, v = 999; for (const p of team()) if (p !== A) { const r = A.rel[p.id] || 0; if (r < v) { v = r; w = p; } } return v < -15 ? w : null; };
export const bestRel = A => { let w = null, v = -999; for (const p of team()) if (p !== A) { const r = A.rel[p.id] || 0; if (r > v) { v = r; w = p; } } return v > 20 ? w : null; };
export { person };
