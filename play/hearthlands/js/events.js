// ===== Events & decisions =====
const EV_VICTORY_SPIRE = 'victorySpire';
function queueEvent(key, data) { G.eventQueue.push({ key, data: data || {} }); }
const adultsFree = () => G.kin.filter(k => isAdult(k) && !k.away);
const randomAdult = (ex) => pick(adultsFree().filter(k => !ex || !ex.includes(k)));
function ownedFreeTileNear(x, y) {
  for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (canBuildBasic(x + dx, y + dy) && !G.tiles.road[idx(x + dx, y + dy)]) return { x: x + dx, y: y + dy };
  }
  return null;
}

const EVENTS = {
  // ---------- Catastrophes ----------
  fire: {
    random: false,
    make: d => { const b = G.buildings[d.bid]; if (!b) return null; return {
      title: '🔥 Fire!', icon: '🔥',
      text: `Flames have broken out at the ${B[b.type].name}! No well is close enough to put it out quickly.<br><i>Tip: wells protect buildings within 4 tiles.</i>`,
      choices: [
        { label: 'Form a bucket line', tip: '75% chance to save it. A volunteer may be burned.', fn: () => {
          b.burning = 2;
          if (Math.random() < 0.75) { addLog(`The bucket line saved the ${B[b.type].name}.`, 'good'); }
          else { b.doomed = true; addLog(`Despite everyone's efforts, the ${B[b.type].name} is lost.`, 'bad'); }
          const k = randomAdult(); if (k && Math.random() < 0.4) { k.health -= 35; addLog(`${kinName(k)} was burned fighting the fire.`, 'bad'); }
        } },
        { label: 'Pay for a fire brigade', tip: `Costs ${15 + 10 * thLevel()} gold. Building saved.`, disabled: G.res.gold < 15 + 10 * thLevel(), fn: () => { G.res.gold -= 15 + 10 * thLevel(); b.burning = 1.5; addLog(`Hired hands doused the fire at the ${B[b.type].name}.`, 'good'); } },
        { label: 'Let it burn', tip: 'The building is destroyed. No one is hurt.', fn: () => { b.burning = 3; b.doomed = true; } },
      ] }; },
  },
  drought: {
    random: true, weight: () => thLevel() <= 6 && countB('farm') ? 1 : 0,
    make: () => ({
      title: '☀️ Drought', icon: '☀️',
      text: `The rains have failed and the fields are cracking. Farms will yield far less until it passes.${countB('granary') ? '<br><i>Your granary softens the blow.</i>' : '<br><i>A granary would soften droughts.</i>'}`,
      choices: [
        { label: 'Dig deep wells', tip: '30 stone: drought lasts only 3 days.', disabled: G.res.stone < 30, fn: () => { G.res.stone -= 30; G.drought = 3; } },
        { label: 'Pray for rain', tip: '15 influence: 60% chance it ends at once, otherwise 8 days.', disabled: G.res.influence < 15, fn: () => { G.res.influence -= 15; if (Math.random() < 0.6) { addLog('🌧️ The heavens opened — the drought is over!', 'good'); } else G.drought = 8; } },
        { label: 'Endure it', tip: 'Drought lasts 9 days.', fn: () => { G.drought = 9; } },
      ] }),
  },
  plague: {
    random: true, weight: () => G.kin.length > 14 ? (countB('healer') ? 0.6 : 1.5) * (hasTech('medicine') ? 0.4 : 1) : 0,
    make: () => {
      const n = Math.max(1, Math.round(G.kin.length * (countB('healer') ? 0.12 : 0.22)));
      return {
        title: '🤒 Sickness Spreads', icon: '🤒',
        text: `A fever is going around. ${n} kin have fallen ill, and more may follow.${countB('healer') ? ' Your healer is already at work.' : ''}`,
        choices: [
          { label: 'Quarantine', tip: 'Output −30% for 5 days. Only the first cases fall ill.', fn: () => { infect(n, 6); G.quarantine = 5; } },
          { label: 'Buy remedies', tip: '45 gold: the sick recover quickly.', disabled: G.res.gold < 45, fn: () => { G.res.gold -= 45; infect(n, 2); } },
          { label: 'Let it run its course', tip: 'It will spread to more kin.', fn: () => { infect(Math.round(n * 1.8), 7); } },
        ] };
    },
  },
  bandits: {
    random: true, weight: () => G.time.day > 10 ? 1.2 : 0,
    make: () => {
      const guarded = countB('watchtower') > 0 || garrison().length >= 2;
      if (guarded) return { title: '🗡️ Bandits Repelled', icon: '🗡️', text: 'A band of brigands probed your borders, saw your guards, and fled — dropping some loot.', choices: [{ label: 'Excellent', tip: '+25 gold', fn: () => gain('gold', 25) }] };
      return {
        title: '🗡️ Bandit Raid', icon: '🗡️', text: 'Bandits have come out of the woods and demand your stores. You have no watchtower or soldiers to stop them.',
        choices: [
          { label: 'Pay them off', tip: 'Lose 35 gold.', disabled: G.res.gold < 35, fn: () => { G.res.gold -= 35; } },
          { label: 'Fight with pitchforks', tip: '55% win (+30 gold loot). On loss, kin may die.', fn: () => {
            if (Math.random() < 0.55) { gain('gold', 30); addLog('Your kin drove off the bandits!', 'good'); addMod('Drove off bandits', 8, 4); }
            else { const k = randomAdult(); if (k) killKin(k, 'a bandit\'s blade'); G.res.food *= 0.8; addLog('The bandits won the brawl and looted food.', 'bad'); }
          } },
          { label: 'Hide the stores', tip: 'Lose 25% of food and wood.', fn: () => { G.res.food *= 0.75; G.res.wood *= 0.75; } },
        ] };
    },
  },
  wolves: {
    random: true, weight: () => thLevel() <= 3 && countB('lumber') + countB('hunter') ? 0.8 : 0,
    make: () => ({
      title: '🐺 Wolves in the Woods', icon: '🐺', text: 'Hungry wolves prowl near your woodcutters and hunters. Workers are afraid to go out.',
      choices: [
        { label: 'Organise a hunt', tip: '+25 food. Someone might get bitten.', fn: () => { gain('food', 25); const k = randomAdult(); if (k && Math.random() < 0.35) { k.health -= 40; addLog(`${kinName(k)} was mauled by a wolf.`, 'bad'); } } },
        { label: 'Build fences', tip: '25 wood. Safe.', disabled: G.res.wood < 25, fn: () => { G.res.wood -= 25; } },
        { label: 'Ignore them', tip: 'Woodcutters and hunters lose heart (−mood).', fn: () => { for (const b of Object.values(G.buildings)) if (b.type === 'lumber' || b.type === 'hunter') for (const id of b.workers) addMod('Scared of wolves', -15, 5, id); } },
      ] }),
  },
  taxrevolt: {
    random: true, weight: () => G.policies.tax === 'high' && avgMood() < 50 ? 4 : 0,
    make: () => ({
      title: '📢 Tax Protest', icon: '📢', text: 'Angry kin gather outside the Town Hall, shouting about high taxes.',
      choices: [
        { label: 'Lower taxes', tip: 'Tax policy set to Normal. +5 mood.', fn: () => { G.policies.tax = 'normal'; addMod('Listened to us', 5, 5); } },
        { label: 'Bribe the ringleaders', tip: '30 gold.', disabled: G.res.gold < 30, fn: () => { G.res.gold -= 30; } },
        { label: 'Hold firm', tip: '−10 mood for 6 days.', fn: () => addMod('Tax resentment', -10, 6) },
      ] }),
  },
  // ---------- Opportunities ----------
  merchant: {
    random: true, weight: () => 2,
    make: () => {
      const offers = [
        { give: { gold: 70 }, get: { tools: 25 } }, { give: { gold: 50 }, get: { iron: 40 } }, { give: { food: 60 }, get: { gold: 45 } },
        { give: { wood: 60 }, get: { stone: 45 } }, { give: { gold: 40 }, get: { knowledge: 20 } }, { give: { stone: 40 }, get: { gold: 40 } },
      ];
      const o = pick(offers), s = 1 + 0.6 * (thLevel() - 1); o.give = scaleCost(o.give, s); o.get = scaleCost(o.get, s);
      return {
        title: '🐫 Wandering Merchant', icon: '🐫', text: `A merchant's caravan stops in town. "Fine goods, friend! I'll give you <b>${costStr(o.get)}</b> for <b>${costStr(o.give)}</b>."`,
        choices: [
          { label: 'Deal', tip: `Pay ${costStr(o.give)}`, disabled: !canAfford(o.give), fn: () => { pay(o.give); gainAll(o.get); } },
          { label: 'Haggle', tip: '50%: same goods for 30% less. Otherwise the merchant leaves offended.', disabled: !canAfford(o.give), fn: () => { if (Math.random() < 0.5) { pay(scaleCost(o.give, 0.7)); gainAll(o.get); addLog('You haggled the merchant down!', 'good'); } else addLog('The merchant left in a huff.', 'info'); } },
          { label: 'No thanks', fn: () => { } },
        ] };
    },
  },
  refugees: {
    random: true, weight: () => G.time.day > 12 ? 1.2 : 0,
    make: () => {
      const n = randi(3, 5); const from = pick(G.factions.filter(f => !f.dead)); if (!from) return null;
      return {
        title: '🧳 Refugees', icon: '🧳', text: `${n} weary travellers fleeing hardship in ${from.name} ask to settle in ${G.realm.name}. You have ${freeHousing()} free beds.`,
        choices: [
          { label: 'Welcome them all', tip: `+${n} kin. ${from.name} is a little offended.`, fn: () => { addRefugees(n); from.relation -= 4; addMod('Generous town', 4, 4); } },
          { label: 'Only able workers', tip: `+${Math.ceil(n / 2)} kin.`, fn: () => addRefugees(Math.ceil(n / 2)) },
          { label: 'Turn them away', tip: 'Devout kin are upset.', fn: () => { for (const k of G.kin) if (k.traits.includes('devout')) addMod('Turned away the needy', -10, 5, k.id); } },
        ] };
    },
  },
  harvest: {
    random: true, weight: () => countB('farm') ? 1.2 : 0,
    make: () => ({
      title: '🌾 Bountiful Harvest', icon: '🌾', text: 'The fields are heavy with grain this year!',
      choices: [
        { label: 'Harvest feast!', tip: '+20 food, 3-day festival.', fn: () => { gain('food', 20); G.festival = Math.max(G.festival, 3); } },
        { label: 'Store everything', tip: '+80 food (up to storage).', fn: () => gain('food', 80) },
        { label: 'Sell the surplus', tip: '+50 gold.', fn: () => gain('gold', 50) },
      ] }),
  },
  scholar: {
    random: true, weight: () => G.time.day > 6 ? 1.2 : 0,
    make: () => ({
      title: '🧙 Travelling Scholar', icon: '🧙', text: 'A learned traveller offers to share their knowledge — for a price, or for a home.',
      choices: [
        { label: 'Pay for lessons', tip: '40 gold → +25 knowledge.', disabled: G.res.gold < 40, fn: () => { G.res.gold -= 40; gain('knowledge', 25); } },
        { label: 'Invite them to stay', tip: 'A curious new kin joins (needs a bed).', disabled: freeHousing() < 1, fn: () => { const k = makeKin({ age: randi(30, 50), traits: ['curious', pick(['cheerful', 'loner', 'artistic'])] }); k.x = G.cap.x; k.y = G.cap.y; assignHousing(); addLog(`${kinName(k)}, a scholar, settles in.`, 'good'); } },
        { label: 'Send them on', fn: () => { } },
      ] }),
  },
  feud: {
    random: true, weight: () => adultsFree().length >= 6 ? 1.3 : 0,
    make: () => {
      const a = randomAdult(), b = randomAdult([a]);
      if (!a || !b) return null;
      return {
        title: '😠 A Neighbourly Feud', icon: '😠', text: `${kinName(a)} and ${kinName(b)} are arguing loudly about ${pick(['a stolen goat', 'whose turn it is at the well', 'a fence line', 'an insulting song', 'a borrowed axe'])}. Both want you to settle it.`,
        choices: [
          { label: `Side with ${a.name}`, tip: `${a.name} +15 mood, ${b.name} −15.`, fn: () => { addMod('Won the feud', 15, 5, a.id); addMod('Lost the feud', -15, 5, b.id); a.friends[b.id] = 0; b.friends[a.id] = 0; } },
          { label: `Side with ${b.name}`, tip: `${b.name} +15 mood, ${a.name} −15.`, fn: () => { addMod('Won the feud', 15, 5, b.id); addMod('Lost the feud', -15, 5, a.id); a.friends[b.id] = 0; b.friends[a.id] = 0; } },
          { label: 'Reconciliation dinner', tip: '15 food: both are happier and become friends.', disabled: G.res.food < 15, fn: () => { G.res.food -= 15; addMod('Made up', 8, 4, a.id); addMod('Made up', 8, 4, b.id); a.friends[b.id] = 40; b.friends[a.id] = 40; } },
        ] };
    },
  },
  orefind: {
    random: true, weight: () => { for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === 0 && G.tiles.terrain[i] === T.HILLS && !G.tiles.special[i]) return 1; return 0; },
    make: () => {
      const c = []; for (let i = 0; i < G.tiles.owner.length; i++) if (G.tiles.owner[i] === 0 && G.tiles.terrain[i] === T.HILLS && !G.tiles.special[i]) c.push(i);
      const i = pick(c); const gold = Math.random() < 0.35;
      return {
        title: gold ? '✨ Gold Vein!' : '⛏️ Iron Vein!', icon: gold ? '✨' : '⛏️',
        text: `Prospectors found ${gold ? 'a glittering gold' : 'a rich iron'} vein in the hills (marked on the map). A mine built there will be very productive${gold ? ' and yield gold' : ''}.`,
        choices: [{ label: 'Wonderful!', fn: () => { G.tiles.special[i] = gold ? 2 : 1; R.terrainDirty = true; R.flyTo(i % MAP_W, (i / MAP_W) | 0); } }],
      };
    },
  },
  comet: {
    random: true, weight: () => 0.5,
    make: () => ({
      title: '☄️ A Comet', icon: '☄️', text: 'A blazing comet streaks across the night sky. The kin are restless — is it an omen?',
      choices: [
        { label: 'Declare it a blessing', tip: '+8 mood for 5 days.', fn: () => addMod('Blessed omen', 8, 5) },
        { label: 'Study it', tip: '+20 knowledge (needs a Library).', disabled: !countB('library'), fn: () => gain('knowledge', 20) },
        { label: 'Hold a vigil', tip: '10 food → +15 influence.', disabled: G.res.food < 10, fn: () => { G.res.food -= 10; gain('influence', 15); } },
      ] }),
  },
  artist: {
    random: true, weight: () => G.kin.some(k => k.traits.includes('artistic') && homeOf(k)) ? 1.2 : 0,
    make: () => {
      const k = pick(G.kin.filter(k => k.traits.includes('artistic') && homeOf(k)));
      if (!k) return null;
      const h = homeOf(k);
      return {
        title: '🎨 An Artist\'s Dream', icon: '🎨', text: `${kinName(k)} has designed a fountain for the neighbourhood and asks for funding.`,
        choices: [
          { label: 'Fund it', tip: '30 gold: a free fountain appears near their home.', disabled: G.res.gold < 30, fn: () => { const t = ownedFreeTileNear(h.x, h.y); if (!t) { toast('No room near their home!'); return; } G.res.gold -= 30; placeBuilding('fountain', t.x, t.y, true); recomputeAppeal(); addMod('My fountain was built!', 20, 8, k.id); addSkill(k, 'artistry', 10); k.counts.art = (k.counts.art || 0) + 1; remember(k, 'Designed a fountain for the neighbourhood', '⛲'); addLog(`⛲ ${kinName(k)}'s fountain was built.`, 'good'); } },
          { label: 'Not now', tip: `${k.name} is disappointed.`, fn: () => addMod('Dream rejected', -12, 5, k.id) },
        ] };
    },
  },
  wedding: {
    random: true, weight: () => G.kin.some(k => k.partner && isAdult(k)) ? 1 : 0,
    make: () => {
      const a = pick(G.kin.filter(k => k.partner && isAdult(k))), b = kinById(a.partner);
      if (!b) return null;
      return {
        title: '💒 A Wedding', icon: '💒', text: `${kinName(a)} and ${kinName(b)} are getting married! The whole town is talking.`,
        choices: [
          { label: 'A lavish wedding', tip: '20 gold + 15 food: everyone +8 mood for 3 days.', disabled: G.res.gold < 20 || G.res.food < 15, fn: () => { G.res.gold -= 20; G.res.food -= 15; addMod('Wonderful wedding', 8, 3); addMod('Our wedding!', 20, 8, a.id); addMod('Our wedding!', 20, 8, b.id); } },
          { label: 'A simple ceremony', tip: 'The couple is happy.', fn: () => { addMod('Our wedding', 10, 5, a.id); addMod('Our wedding', 10, 5, b.id); } },
        ] };
    },
  },
  performers: {
    random: true, weight: () => G.kin.length > 10 ? 1 : 0,
    make: () => ({
      title: '🎭 Travelling Performers', icon: '🎭', text: 'A troupe of jugglers and musicians offers to put on a show.',
      choices: [
        { label: 'Hire them', tip: '25 gold: 2-day festival.', disabled: G.res.gold < 25, fn: () => { G.res.gold -= 25; G.festival = Math.max(G.festival, 2); } },
        { label: 'Pass', fn: () => { } },
      ] }),
  },
  winterwarn: {
    random: false, weight: () => 0,
    make: () => ({
      title: '🌨️ Harsh Winter Ahead', icon: '🌨️', text: 'The elders read the signs: geese flying early, thick onion skins. A hard winter is coming. Farms will nearly stop and homes will burn wood.',
      choices: [
        { label: 'Send out foragers', tip: '+40 food, +20 wood; workers tired (−mood 2 days).', fn: () => { G.flags['ww' + year()] = 1; gain('food', 40); gain('wood', 20); addMod('Long foraging trips', -5, 2); } },
        { label: 'Buy stores', tip: '40 gold → +70 food.', disabled: G.res.gold < 40, fn: () => { G.flags['ww' + year()] = 1; G.res.gold -= 40; gain('food', 70); } },
        { label: 'We are ready', fn: () => { G.flags['ww' + year()] = 1; } },
      ] }),
  },
  // ---------- Diplomacy ----------
  aiTrade: {
    make: d => { const f = fac(d.fid); return {
      title: `📦 Trade Offer — ${f.name}`, icon: '📦', faction: f,
      text: `${f.leader} proposes: they give <b>${costStr(d.give)}</b> in exchange for your <b>${costStr(d.get)}</b>.`,
      choices: [
        { label: 'Accept', disabled: !canAfford(d.get), tip: canAfford(d.get) ? 'Relation +4' : 'You cannot afford it', fn: () => { pay(d.get); gainAll(d.give); f.relation += 4; G.stats.trades++; addLog(`🤝 Trade with ${f.name} done.`, 'good'); } },
        { label: 'Decline', tip: 'Relation −1', fn: () => { f.relation -= 1; } },
      ] }; },
  },
  aiLand: {
    make: d => { const f = fac(d.fid); return {
      title: `📜 Land for Sale — ${f.name}`, icon: '📜', faction: f, tiles: d.tiles,
      text: `${f.leader} offers to sell you <b>${d.tiles.length} border tiles</b> (highlighted) for <b>${d.price} gold</b>.`,
      choices: [
        { label: `Buy (${d.price} 🪙)`, disabled: G.res.gold < d.price, fn: () => { const ok = d.tiles.filter(t => ownerAt(t.x, t.y) === f.id); buyLand(f, ok, d.price); f.relation += 3; } },
        { label: 'Haggle', tip: '50%: 30% cheaper. Otherwise they withdraw (relation −3).', disabled: G.res.gold < d.price * 0.7, fn: () => { if (Math.random() < 0.5 + f.relation / 300) { buyLand(f, d.tiles.filter(t => ownerAt(t.x, t.y) === f.id), Math.round(d.price * 0.7)); } else { f.relation -= 3; addLog(`${f.name} withdrew their land offer.`, 'info'); } } },
        { label: 'Decline', fn: () => { } },
      ] }; },
  },
  aiNonAgg: {
    make: d => { const f = fac(d.fid); return {
      title: `🕊️ Pact Proposal — ${f.name}`, icon: '🕊️', faction: f, text: `${f.leader} proposes a 40-day non-aggression pact.`,
      choices: [
        { label: 'Sign it', tip: 'No war with them for 40 days. Relation +5.', fn: () => { f.pact = 'nonaggression'; f.pactDays = 40; f.relation += 5; } },
        { label: 'Decline', tip: 'Relation −4', fn: () => { f.relation -= 4; } },
      ] }; },
  },
  aiAlliance: {
    make: d => { const f = fac(d.fid); return {
      title: `🤝 Alliance Proposal — ${f.name}`, icon: '🤝', faction: f, text: `${f.leader} wishes to bind your realms in alliance. Allies give influence, trade more generously, and weaken your enemies in war.`,
      choices: [
        { label: 'Accept', fn: () => { f.pact = 'alliance'; f.relation += 10; addLog(`🤝 Allied with ${f.name}.`, 'good'); } },
        { label: 'Decline', tip: 'Relation −6', fn: () => { f.relation -= 6; } },
      ] }; },
  },
  aiMarriage: {
    make: d => { const f = fac(d.fid); const k = pick(G.kin.filter(k => isAdult(k) && !k.partner && !k.soldier && !k.away)); if (!k) return null; return {
      title: `💍 Marriage Alliance — ${f.name}`, icon: '💍', faction: f, text: `${f.leader} proposes that ${kinName(k)} marry into their court. ${k.name} would leave ${G.realm.name} forever, but the bond would be strong.`,
      choices: [
        { label: 'Agree', tip: `Lose ${k.name}. Relation +30, +60 gold dowry.`, fn: () => { removeKin(k); f.relation += 30; gain('gold', 60); addLog(`💍 ${kinName(k)} married into ${f.name}.`, 'good'); } },
        { label: `Let ${k.name} decide`, tip: '50/50. If they refuse, relation −5.', fn: () => { if (Math.random() < 0.5) { removeKin(k); f.relation += 30; gain('gold', 60); addLog(`💍 ${kinName(k)} agreed and married into ${f.name}.`, 'good'); } else { f.relation -= 5; addMod('Free to choose', 10, 5, k.id); addLog(`${k.name} politely declined.`, 'info'); } } },
        { label: 'Refuse', tip: 'Relation −8', fn: () => { f.relation -= 8; } },
      ] }; },
  },
  aiHelp: {
    make: d => { const f = fac(d.fid), e = fac(d.eid); if (!e || e.dead) return null; return {
      title: `🛡️ Call to Arms — ${f.name}`, icon: '🛡️', faction: f, text: `${f.leader} is feuding with ${e.name} and asks for your support.`,
      choices: [
        { label: `Declare war on ${e.name}`, tip: `${f.name} relation +25.`, disabled: e.pact === 'alliance' || e.subjugated, fn: () => { declareWar(e); f.relation += 25; e.troops = Math.max(0, e.troops - 4); } },
        { label: 'Send supplies', tip: '40 gold: relation +10.', disabled: G.res.gold < 40, fn: () => { G.res.gold -= 40; f.relation += 10; } },
        { label: 'Stay out of it', tip: 'Relation −6', fn: () => { f.relation -= 6; } },
      ] }; },
  },
  aiDemand: {
    make: d => { const f = fac(d.fid); return {
      title: `⚔️ Demand — ${f.name}`, icon: '⚔️', faction: f,
      text: `An envoy of ${f.leader} arrives: "Pay <b>${d.gold} gold</b> as tribute, or face our wrath." <br>Their strength: <b>${facStrength(f).toFixed(0)}</b> vs your defense <b>${playerStrength().toFixed(0)}</b>.`,
      choices: [
        { label: 'Pay', tip: 'Relation +10.', disabled: G.res.gold < d.gold, fn: () => { G.res.gold -= d.gold; f.relation += 10; } },
        { label: 'Offer half', tip: '50%: they accept. Otherwise relation −10.', disabled: G.res.gold < d.gold / 2, fn: () => { if (Math.random() < 0.5) { G.res.gold -= Math.round(d.gold / 2); f.relation += 3; addLog(`${f.name} accepted a smaller tribute.`, 'info'); } else { f.relation -= 10; addLog(`${f.name} is insulted by your offer.`, 'bad'); } } },
        { label: 'Refuse', tip: 'Relation −15, war is likely.', fn: () => { f.relation -= 15; if (Math.random() < 0.5) aiDeclareWar(f); else addMod('Stood up to bullies', 5, 4); } },
      ] }; },
  },
  aiWar: {
    make: d => { const f = fac(d.fid); const t = peaceTerms(f); return {
      title: `⚔️ War! — ${f.name}`, icon: '⚔️', faction: f,
      text: `${f.leader} has declared war on ${G.realm.name}! Their armies will march on your borders.<br>Their strength: <b>${facStrength(f).toFixed(0)}</b> · Your defense: <b>${playerStrength().toFixed(0)}</b><br><i>Soldiers, watchtowers and walls defend your land. Train soldiers at a Barracks.</i>`,
      choices: [
        { label: 'To arms!', fn: () => addMod('At war', -3, 4) },
        { label: `Sue for peace (${t.gold} 🪙)`, disabled: G.res.gold < t.gold, fn: () => { G.res.gold -= t.gold; endWar(f, `You bought peace from ${f.name}.`); } },
      ] }; },
  },
  aiPeace: {
    make: d => { const f = fac(d.fid); if (!f.war) return null; const g = Math.round(20 + f.tiles * 1.2 + (f.weariness > 60 ? 40 : 0)); return {
      title: `🕊️ Peace Offer — ${f.name}`, icon: '🕊️', faction: f, text: `Exhausted by war, ${f.leader} offers peace and <b>${g} gold</b> in reparations.`,
      choices: [
        { label: 'Accept peace', tip: `+${g} gold. 30-day pact.`, fn: () => { gain('gold', g); endWar(f, `${f.name} paid ${g} gold for peace.`); } },
        { label: 'Fight on', tip: 'Keep the war going.', fn: () => { f.peaceOffered = false; f.weariness -= 10; } },
      ] }; },
  },
  spyCaught: {
    make: d => { const f = fac(d.fid); if (!f || f.dead) return null; return {
      title: `🕵️ A Spy Unmasked — ${f.name}`, icon: '🕵️', faction: f, text: `Your guards caught an agent of ${f.leader} copying maps of your storehouses.`,
      choices: [
        { label: 'Turn them into a double agent', tip: 'Learn everything about their realm for 30 days. Relation unchanged.', fn: () => { f.intel = G.time.day + 30; addLog(`🕵️ The captured spy now reports to you on ${f.name}.`, 'good'); } },
        { label: 'Send them home with a warning', tip: 'Relation +8.', fn: () => { f.relation += 8; } },
        { label: 'Make an example of them', tip: 'Kin feel safer (+4 mood). Relation −12.', fn: () => { f.relation -= 12; addMod('Spy punished', 4, 4); } },
      ] }; },
  },
  victorySpire: {
    make: () => ({ title: '🗼 Prosperity Victory!', icon: '🗼', text: `The Grand Spire rises above ${G.realm.name}, visible for leagues. Bards will sing of this age for centuries.<br><br><b>You have achieved a Prosperity Victory!</b> You may keep playing.`, choices: [{ label: 'Continue the legacy', fn: () => { } }] }),
  },
  victoryUnite: {
    make: () => ({ title: '👑 Unification Victory!', icon: '👑', text: `Every realm in the land is now your ally or vassal. Under the banner of ${G.realm.name}, the age of war is over.<br><br><b>You have achieved a Unification Victory!</b> You may keep playing.`, choices: [{ label: 'Long live the realm', fn: () => { } }] }),
  },
};

// ---------- Auto-decisions ----------
// Preferred choices (first one that is not disabled wins) when the game decides for you.
const EVENT_AUTO = {
  fire: [1, 0], drought: [0, 1, 2], plague: [1, 0], bandits: [0, 2], wolves: [1, 0], taxrevolt: [0], merchant: [2], refugees: [1],
  harvest: [1], scholar: [1, 2], feud: [2, 0], orefind: [0], comet: [0], artist: [0, 1], wedding: [1], performers: [1], winterwarn: [0],
  aiTrade: [0, 1], aiLand: [2], aiNonAgg: [0], aiAlliance: [0], aiMarriage: [2], aiHelp: [1, 2], aiDemand: [0, 2], aiWar: [0], aiPeace: [0], spyCaught: [0],
};
// These ask you by default; everything else is decided automatically (Menu → Decisions).
const EVENT_MAJOR = new Set(['fire', 'plague', 'bandits', 'refugees', 'aiLand', 'aiAlliance', 'aiMarriage', 'aiHelp', 'aiDemand', 'aiWar', 'aiPeace']);
function autoChoice(key, e, data) {
  if (key === 'aiTrade') { const keep = Object.entries(data.get || {}).every(([r, v]) => (G.res[r] || 0) - v >= 30); return keep && !e.choices[0].disabled ? 0 : 1; }
  for (const i of EVENT_AUTO[key] || []) if (e.choices[i] && !e.choices[i].disabled) return i;
  const i = e.choices.findIndex(c => !c.disabled); return i < 0 ? 0 : i;
}
function shouldAutoDecide(key, e) {
  if (key.startsWith('victory') || key === 'expedition' || key === 'landDeal' || key === 'conquest') return false;
  if (e.choices.length === 1 || e.quiet) return true;
  if (G.settings.autoKeys && G.settings.autoKeys[key]) return true;
  const m = G.settings.decide || 'major';
  if (m === 'none') return true;
  if (m === 'major') return !EVENT_MAJOR.has(key);
  return false;
}
function autoResolve(key, e, data) {
  const c = e.choices[autoChoice(key, e, data)];
  if (!c || c.disabled) return;
  why('Events & decisions', c.fn);
  addLog(`🤖 ${e.title}: ${c.label}`, 'info');
  recountTiles(); R.territoryDirty = true;
}

function infect(n, days) {
  const c = G.kin.filter(k => !k.sick && !k.away).sort(() => Math.random() - 0.5).slice(0, n);
  for (const k of c) k.sick = days;
  addLog(`🤒 ${c.length} kin are sick.`, 'bad');
}
function addRefugees(n) {
  const edge = territoryEdgeTile(); const sur = pick(SURNAMES);
  for (let i = 0; i < n; i++) { const k = makeKin({ surname: Math.random() < 0.6 ? sur : undefined, age: i === n - 1 && n > 2 ? randi(4, 12) : randi(17, 45), x: edge.x, y: edge.y }); k.needs.food = 40; }
  assignHousing(); autoAssignJobs();
  addLog(`🧳 ${n} refugees joined ${G.realm.name}.`, 'good');
}

function dailyEvents() {
  // fire check
  const bs = Object.values(G.buildings).filter(b => !B[b.type].decor && !['well', 'wall', 'townhall'].includes(b.type) && !b.burning);
  const fireP = 0.0006 * Math.max(0.2, 1 - fx('fire')) * (G.drought > 0 ? 2 : 1);
  for (const b of bs) {
    if (Math.random() < fireP && !protectedFromFire(b) && !b.ruined) { queueEvent('fire', { bid: b.id }); b.burning = 6; break; }
  }
  // random events
  if (G.time.day >= G.nextEventDay) {
    const pool = Object.entries(EVENTS).filter(([, e]) => e.random).map(([k, e]) => [k, e.weight()]).filter(([, w]) => w > 0);
    if (pool.length) {
      let tot = pool.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, ch = pool[0][0];
      for (const [k, w] of pool) { r -= w; if (r <= 0) { ch = k; break; } }
      if (G.lastEvent !== ch) { queueEvent(ch, {}); G.lastEvent = ch; }
    }
    G.nextEventDay = G.time.day + randi(5, 9);
  }
}
