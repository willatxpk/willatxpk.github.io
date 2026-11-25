// The living: survivors of Emberfall camp, their routines, words, wares and errands — and the crows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// softened boxes: bodies read as flesh and cloth rather than blocks
const rbox = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.42);
import { makeMobMaterial, moveBody } from './world.js';
import { buildHuman, poseHuman } from './body.js';

function colorize(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ------------------------------------------------------------------ who lives here
export const NPC_DEFS = {
  maren: {
    name: 'Maren', title: "Warden of the Landing", home: 'maren', roam: 1.5,
    look: { skin: 0xb08a70, tunic: 0x4a3a40, pants: 0x2e2626, hood: 0x5a5048, cloak: 0x3a3236, item: 'staff', hunch: 0.15 },
    greet: ["The fire's still lit. That's the whole of my job, and most of yours.", "Back in one piece. The Company counts its hunters every night, you know.", "Mind the light. Out there it's all you have."],
    rumors: ["We sailed because the old country's lamps are failing — winters longer every year. The Company bought a legend: a land where light comes up out of the ground. Looks like the legend was true, once.", "Those roads aren't ours. Nor the towers, nor that castle. Somebody built a kingdom here and something unbuilt them.", "Rest by a fire and the things in the castle stand up again at their posts. Don't ask me how I know. I watched.", "There's no moon here. Forty-one nights and not once. The sailors won't speak of it.", "No lamps past the fence after dark. That's my one law. The first week, every lamp we lit brought them out of the trees.", "Some of the ones you've brought back made it to the fence. We fed them. They don't sleep much. They sit by the fire and stare at it like it's the most beautiful thing they've ever seen."],
    barks: ["Keep to the light, hunter.", "The fire needs feeding.", "Another night. We'll see another morning."],
    quests: ['embers', 'watcher'],
  },
  oswin: {
    name: 'Oswin', title: "Quartermaster of the Company", home: 'oswin', roam: 0.6,
    look: { skin: 0xc49a7a, tunic: 0x3e5232, pants: 0x3a2e22, hat: 0x2e2418, beard: 0x6a5038, wide: 1.15 },
    greet: ["Company stores, Company prices. Mostly fair.", "Ah, our hunter! Buying, selling, or bleeding on my crates?", "Oil, draughts, arrows — everything you need to come back."],
    rumors: ["Deserters took two of our boats' worth of stores and ran for the old watchtowers. They'd sooner rob us than face the dark.", "Those black splinters the creatures drop — umbral shards. I pay well for them. The scholar wants them, mostly.", "Wolves came down off the moor the second week. Bigger than home wolves. Everything here is bigger."],
    barks: ["Fine wares! Fair prices! Mostly fair.", "Oil for your lantern, hunter?", "Shards. I buy shards."],
    shop: 'oswin',
  },
  tamsin: {
    name: 'Tamsin', title: "the Company Smith", home: 'tamsin', roam: 1,
    look: { skin: 0x8a6650, tunic: 0x5a4a3a, pants: 0x2a2420, hair: 0x2a1e16, apron: 0x3a2a1c, item: 'hammer', wide: 1.1 },
    greet: ["Bring me iron and I'll give you an edge.", "If it's dull, I can fix it. If it's you, I can't.", "Forge is hot. Talk quick."],
    rumors: ["The steel those knights wear in the castle — better than anything we brought. Whoever these people were, they knew a forge.", "Iron runs deep in the stone here, below the coal. And something in the east keeps the ground warm. I'd like to see their furnaces."],
    barks: ["*clang* *clang*", "Need that blade seen to?", "Mind the sparks."],
    shop: 'tamsin', quests: ['forge'], service: 'hone',
  },
  aldric: {
    name: 'Brother Aldric', title: "Chaplain & Scholar", home: 'aldric', roam: 1.2,
    look: { skin: 0xbf9a80, tunic: 0x5a4632, pants: 0x5a4632, bald: true, beard: 0x8a8070, robe: true, item: 'book' },
    greet: ["Peace on you. Or what passes for it here.", "Every ruin is a book, if you can stand to read it.", "Wounded? Sit. Let me look."],
    rumors: ["Traders back home sold fragments of an old hymnal — 'light that rises, light that stays'. I came to find who sang it. I think I'm standing in their country.", "The creatures aren't animals. Look at their gear, their bones. They were people. Something changed them, and slowly.", "When they die, something bright leaves them. Like breath on a cold morning. It's their own light, I'm sure of it now: the Lumen they lived by.", "The Rite takes the light of the slain to return the living. I pray over that arithmetic every night, and I have no answer for it.", "They hunt our lamps because they're starving for what they lost. Imagine two hundred years of that hunger."],
    barks: ["Light keep you.", "Read anything they left behind. Anything.", "Rest. You look half-dead."],
    shop: 'aldric', quests: ['reliquary'], service: 'heal',
  },
  brannoc: {
    name: 'Captain Brannoc', title: "Captain of the Company Guard", home: 'brannoc', roam: 1.5,
    look: { skin: 0xa88068, tunic: 0x6a6a70, pants: 0x3a3a40, beard: 0x3a2a20, hair: 0x3a2a20, cloak: 0x5a1e1a, item: 'sword', wide: 1.1 },
    greet: ["Hunter. I pay for corpses — the walking kind.", "Bounties on the board. Coin on delivery.", "You look like you can still hold a blade. Good."],
    rumors: ["Hollow Knights hold the castle's great hall. Real armour, real swords, nothing inside. Don't fight two at once.", "The catacombs run under the whole inner bailey. Wyll went in the first week to map them. Hobb still waits by the gate for him.", "My scouts say the moor to the west has things in the trees that walk on two legs and wear antlers. I've stopped sending scouts.", "Aldric says they're people. Fine. So were the men who mutinied on the crossing, and I hanged them. A thing that comes at my fence at night is a thing I put down.", "Your rite costs light you could spend keeping yourself alive. I've buried hunters who were kinder than you. Remember that when one of them gets back up."],
    barks: ["Bounties on the board!", "Keep your blade wet.", "Seen any wolves on the road?"],
    quests: ['hollow', 'wolves', 'brigands', 'knights'],
  },
  hobb: {
    name: 'Old Hobb', title: "the Gravedigger", home: 'hobb', roam: 0.8,
    look: { skin: 0xa88a74, tunic: 0x3e3a30, pants: 0x2a2620, hair: 0x9a948a, beard: 0x9a948a, item: 'spade', hunch: 0.25 },
    greet: ["Dug a lot of graves since we landed. Never enough.", "Eh? Speak up. The dead are quieter than you.", "You smell of the catacombs. Or I do."],
    rumors: ["My little brother Wyll was the Company's best scout. First week, he went down under the castle to map the tunnels. He wore our father's signet. He never came up.", "I dig a grave for everyone we lose. I dug one for Wyll. It's still empty. I'd like it not to be."],
    barks: ["Graves don't dig themselves.", "Wyll... where are you, Wyll.", "Mind your step. Soft earth."],
  },
  edda: {
    name: 'Edda', title: "Company Guard", home: 'edda', guard: true,
    look: { skin: 0xc0957a, tunic: 0x5a5a60, pants: 0x3a3a3e, hair: 0x8a5a2a, helm: 0x5e5e64, item: 'spear' },
    patrol: true,
    greet: ["Inside the torches you're safe. Mostly.", "I'll hold the line. Go do something useful.", "Move along. I'm watching the dark."],
    rumors: ["Things test the palisade every few nights, in numbers now, and always where a lamp is burning."],
    barks: ["All quiet. For now.", "Stay in the light.", "Hmph."],
  },
  wen: {
    name: 'Wen', title: "the Company Surveyor", home: 'wen', path: [[128.5, 221.5], [128.5, 208.5], [128.5, 196.5], [127.5, 191.5], [128.5, 208.5]],
    look: { skin: 0xc8a48a, tunic: 0x7a6e5a, pants: 0x4a4236, hood: 0x6a6252, item: 'staff' },
    greet: ["Every day I walk to the bridge and draw a little more of the map.", "Morning, hunter. Or evening. The light here is hard to read.", "The road's safer by day. Not safe. Safer."],
    rumors: ["The bridge over the chasm is broken in the middle. You'll need a running jump.", "East of the castle the land drops into a wet lowland full of mushrooms the size of houses. Past that, the ground smokes. I haven't gone further. Nobody has.", "Past the smoking ground there's a wall of black rock the old maps call the Cinder Wall. Three old roads cut through it. What's on the other side isn't on any chart the Company gave us, and I've started to wonder why."],
    barks: ["Light keep you on the road.", "Still mapping.", "Lovely grey day."],
  },
  rudd: {
    name: 'Rudd', title: "the Road Guard", home: 'rudd', guard: true, path: [[128.5, 219.5], [129.5, 204.5], [127.5, 193.5], [129.5, 204.5]],
    look: { skin: 0x9a7058, tunic: 0x4a3a2a, pants: 0x2e2a26, hair: 0x1e1612, beard: 0x1e1612, helm: 0x4a4a50, item: 'sword' },
    greet: ["Brannoc pays me to walk this road. So I walk it.", "If you see wolves, shout.", "Nice day for it. Whatever 'it' is."],
    rumors: ["The deserters took the watchtowers out on the moor edge. Shot at me with Company arrows. Company arrows!"],
    barks: ["Road's clear.", "Oi.", "Back before dark, eh?"],
  },
};

// ------------------------------------------------------------------ errands
export const SIDE_QUESTS = {
  embers: { giver: 'maren', name: 'Embers for the Fire', summary: 'Bring Maren 6 coal for the camp fires.', need: { coal: 6 }, reward: { gold: 30, oil: 2 }, xp: 80,
    offer: 'The fires eat more than we can feed them. Bring me six lumps of coal from the stone and I will see you paid.', progress: 'Six lumps, no fewer. The dark is patient; we are not.', done: 'Good black coal. We\'ll see the morning, then. Take this — and some oil for that lantern.' },
  watcher: { giver: 'maren', requires: S => S.day >= 2, name: 'What Walks Unseen', summary: 'Slay the Pale Watcher, which stalks the late night.', flag: 'watcher', reward: { gold: 100, elixir: 2 }, xp: 200,
    offer: 'There is a pale thing that walks after midnight. It moves only when no one looks. Kill it, and every soul here owes you.', progress: 'Look at it. Never stop looking at it.', done: 'You... truly? Then perhaps the night can be beaten after all. Take these, and my thanks.' },
  brother: { giver: 'hobb', name: 'The Restless Brother', summary: 'Find Wyll\'s signet in the candle-lit tomb of the catacombs beneath the keep.', needItem: 'signet', reward: { gold: 50, healing: 2 }, xp: 150,
    offer: 'My brother Wyll went into the catacombs and never came back. He wore our father\'s signet. Find the tomb where the candles burn. Bring it to me, so I can stop waiting.', progress: 'The tomb with the candles. Under the keep. Please.', done: 'That\'s his. That\'s Wyll\'s. ...Thank you. I can dig him a proper grave now, even if it\'s empty.' },
  reliquary: { giver: 'aldric', name: 'The Chapel Reliquary', summary: 'Recover the reliquary from the altar of the ruined chapel in the castle\'s east bailey.', needItem: 'reliquary', reward: { charm: 1 }, xp: 150,
    offer: 'The hymnal fragments mention ash reliquaries kept on chapel altars. If one still sits in the castle chapel, in the east bailey, bring it to me. If I understand it, I may make something that steadies the heart.', progress: 'The chapel. East, inside the outer walls. The altar is at the far end.', done: 'Ash... still warm, after however many years. They kept the Lumen\'s remains in these. Here — I\'ve bound a little of it into a charm. The dark will grip you less tightly.' },
  forge: { giver: 'tamsin', name: 'Iron for the Forge', summary: 'Bring Tamsin 5 iron ore.', need: { iron: 5 }, reward: { gold: 20, upgrade: 1 }, xp: 80,
    offer: 'I\'m out of iron. Bring me five lumps of ore and I\'ll hone whatever you\'re swinging. Free.', progress: 'Five iron. Deep stone. Go.', done: 'Good ore. Give that here — *scrape* — there. Sharper than it\'s ever been.' },
  hollow: { giver: 'brannoc', name: 'Bounty: The Hollowed', summary: 'Slay 6 Hollowed.', kill: { ghoul: 6 }, reward: { gold: 40 }, xp: 100, repeat: true,
    offer: 'Six Hollowed. Forty gold. Keep count; I will.', progress: 'Still counting.', done: 'Six it is. Here\'s your coin. Board\'s never empty, if you want more.' },
  wolves: { giver: 'brannoc', name: 'Bounty: Wolves on the Road', summary: 'Slay 4 grey wolves.', kill: { wolf: 4 }, reward: { gold: 25, healing: 1 }, xp: 60, repeat: true,
    offer: 'Wolves are taking our surveyors on the road. Four of them dead and I\'ll pay twenty-five.', progress: 'They hunt the woods off the road. In packs.', done: 'Fewer teeth on the road. Good work.' },
  brigands: { giver: 'brannoc', name: 'The Deserters\' Tower', summary: 'Slay 4 deserters at their ruined watchtower ({DIR} of camp).', kill: { bandit: 4 }, reward: { gold: 70, oil: 2 }, xp: 180,
    offer: 'The deserters who stole our stores hold a ruined watchtower {DIR} of here. They\'ve started shooting at our people. I won\'t have it. Clear them out.', progress: 'The tower, {DIR}. Four of them at least.', done: 'That\'s one less thing to fear on the road. Here, you earned this.' },
  knights: { giver: 'brannoc', requires: S => S.level >= 3, name: 'Bounty: Hollow Knights', summary: 'Slay 2 Hollow Knights in the castle.', kill: { knight: 2 }, reward: { gold: 90, shard: 1 }, xp: 220, repeat: true,
    offer: 'You\'ve got some steel in you now. The Hollow Knights — two of them. Ninety gold.', progress: 'They guard the great hall and the chapel. Go careful.', done: 'Two knights. I\'d not have believed it. Here.' },
};

export const SHOPS = {
  oswin: { sell: [['bow', 30], ['arrows', 6, 10], ['oil', 6], ['b12', 2], ['healing', 15], ['elixir', 25], ['lumendraught', 30], ['b13', 4], ['herb', 3], ['b18', 12], ['coal', 2]], buys: { shard: 12, iron: 4, coal: 1, herb: 2, b13: 3, pelt: 8, b5: 1 } },
  tamsin: { sell: [['pick', 20], ['club', 8], ['hatchet', 15], ['spear', 45], ['sword', 60], ['estoc', 80], ['greataxe', 85], ['warhammer', 95], ['shield', 30], ['leather', 20], ['armor', 90], ['helm', 35], ['gauntlets', 30], ['greaves', 35]], buys: { iron: 5, coal: 1, pelt: 6, plate: 60, knighthelm: 25, towershield: 35 } },
  aldric: { sell: [['healing', 14], ['elixir', 24], ['lumendraught', 28], ['tome_lance', 60]], buys: { shard: 14, herb: 3 } },
};

export class NPC {
  constructor(id, def, x, y, z) {
    this.id = id; this.def = def;
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3();
    this.half = 0.3; this.h = 1.8; this.yaw = Math.random() * 6.28; this.walk = 0;
    this.mat = makeMobMaterial();
    this.group = new THREE.Group();
    this.rig = buildHuman(this.mat, def.look); this.group.add(this.rig.root);
    this.goal = null; this.thinkT = Math.random() * 3; this.pathI = 0; this.barkT = 10 + Math.random() * 20; this.cd = 0; this.stuckT = 0;
    this.dist = 99;
  }
  update(dt, C) {
    const p = C.ppos, def = this.def;
    this.dist = Math.hypot(p.x - this.pos.x, p.y - this.pos.y, p.z - this.pos.z);
    const [s, b] = C.world.lightAt(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.6), Math.floor(this.pos.z));
    this.mat.uniforms.uLight.value.set(s / 15, b / 15);
    const night = C.sun < 0.35;
    let gx = null, gz = null, speed = 1.6;
    this.cd -= dt; this.barkT -= dt;
    const talking = C.talkingTo === this;
    if (!talking && def.guard) {
      let foe = null, fd = 15;
      for (const m of C.mobs) {
        if (m.dead || m.type === 'watcher') continue;
        const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
        if (d < fd && Math.hypot(m.pos.x - C.camp.x, m.pos.z - C.camp.z) < 30) { fd = d; foe = m; }
      }
      if (foe) {
        gx = foe.pos.x; gz = foe.pos.z; speed = 3.8;
        if (fd < 2 && this.cd <= 0) { this.cd = 1.2; this.swing = 0.3; C.strike(this, foe); }
      }
    }
    if (talking) { gx = null; }
    else if (gx === null) {
      this.thinkT -= dt;
      const atGoal = this.goal && Math.hypot(this.goal[0] - this.pos.x, this.goal[1] - this.pos.z) < 0.6;
      if (atGoal && this.followingPath && this.thinkT > 6) this.thinkT = 2 + Math.random() * 3; // pause at waypoints
      if (this.thinkT <= 0) {
        if (night && !def.patrol) {
          const a = this.homeAngle ?? (this.homeAngle = Math.random() * 6.28), r = 3.2 + (this.id.length % 3) * 0.5;
          this.goal = [C.camp.x + 0.5 + Math.cos(a) * r, C.camp.z + 0.5 + Math.sin(a) * r];
          this.thinkT = 8 + Math.random() * 6; this.followingPath = false;
        } else if (def.path && !night) {
          this.pathI = (this.pathI + 1) % def.path.length; this.goal = def.path[this.pathI].slice();
          this.thinkT = 60; this.followingPath = true;
        } else if (def.patrol) {
          const a = Math.random() * 6.28; this.goal = [C.camp.x + 0.5 + Math.cos(a) * 8.5, C.camp.z + 0.5 + Math.sin(a) * 8.5];
          this.thinkT = 6 + Math.random() * 6; this.followingPath = false;
        } else {
          const h = C.spots[def.home], r = def.roam ?? 1.5;
          this.goal = Math.random() < 0.35 ? [this.pos.x, this.pos.z] : [h[0] + (Math.random() - 0.5) * 2 * r, h[1] + (Math.random() - 0.5) * 2 * r];
          this.thinkT = 3 + Math.random() * 6; this.followingPath = false;
        }
      }
      if (this.goal) { gx = this.goal[0]; gz = this.goal[1]; }
    }
    let mvx = 0, mvz = 0;
    if (gx !== null) {
      const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.45) { mvx = dx / d; mvz = dz / d; }
    }
    if (this.detourT > 0 && (mvx || mvz)) {
      this.detourT -= dt;
      const sx = mvx * 0.35 - mvz * this.detourSide, sz = mvz * 0.35 + mvx * this.detourSide, sl = Math.hypot(sx, sz) || 1;
      mvx = sx / sl; mvz = sz / sl;
    }
    this.vel.x = mvx * speed; this.vel.z = mvz * speed;
    this.vel.y = Math.max(-30, this.vel.y - 26 * dt);
    const bx = this.pos.x, bz = this.pos.z;
    const blocked = moveBody(C.world, this, dt);
    if (blocked && this.onGround && (mvx || mvz)) this.vel.y = 8;
    if (mvx || mvz) {
      const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      this.stuckT = moved < speed * dt * 0.3 ? this.stuckT + dt : Math.max(0, this.stuckT - dt);
      if (this.stuckT > 0.8) { this.stuckT = 0; this.detourT = 0.8 + Math.random(); this.detourSide = Math.random() < 0.5 ? 1 : -1; }
      if (this.stuckT === 0 && this.detourT <= 0 && Math.random() < 0.002) this.thinkT = 0;
    }
    if (this.pos.y < -5) { const h = C.spots[def.home]; this.pos.set(h[0], C.camp.y + 1, h[1]); this.vel.set(0, 0, 0); }
    // facing: walk direction, else look at the player when near
    let ty = null;
    if (mvx || mvz) ty = Math.atan2(mvx, mvz);
    else if (this.dist < 5 || talking) ty = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    if (ty !== null) { let da = ty - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += da * Math.min(1, dt * 6); }
    // animation
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.2;
    this.walk += dt * (moving ? speed * 2.6 : 0);
    this.mv = (this.mv || 0) + ((moving ? 1 : 0) - (this.mv || 0)) * Math.min(1, dt * 6);
    this.swing = Math.max(0, (this.swing || 0) - dt);
    this.t = (this.t || Math.random() * 9) + dt;
    poseHuman(this.rig, this.walk, this.mv, { time: this.t, talk: talking, attack: this.swing > 0 ? (this.swing > 0.15 ? 1 : -1) : 0 });
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    // passing remarks
    if (!talking && this.barkT <= 0 && this.dist < 6.5) { this.barkT = 30 + Math.random() * 30; C.bark(this, def.barks[Math.floor(Math.random() * def.barks.length)]); }
  }
  dispose(scene) { scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.mat.dispose(); }
}

// ------------------------------------------------------------------ crows on the battlements
export class Crow {
  constructor(perches) {
    this.perches = perches; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.mat = makeMobMaterial(); this.group = new THREE.Group();
    const P = (w, h, d, x, y, z, parent = this.group) => { const m = new THREE.Mesh(colorize(new THREE.BoxGeometry(w, h, d), 0x141416), this.mat); m.position.set(x, y, z); parent.add(m); return m; };
    P(0.16, 0.14, 0.32, 0, 0.14, 0); this.head = P(0.12, 0.12, 0.12, 0, 0.24, 0.17); P(0.04, 0.04, 0.1, 0, 0.23, 0.27); P(0.1, 0.03, 0.16, 0, 0.12, -0.22);
    P(0.03, 0.08, 0.03, -0.04, 0.04, 0); P(0.03, 0.08, 0.03, 0.04, 0.04, 0);
    this.wings = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * 0.08, 0.17, 0); this.group.add(g); P(0.32, 0.02, 0.2, sx * 0.16, 0, 0, g); return g; });
    this.group.scale.setScalar(1.3);
    this.perch();
  }
  perch() {
    const p = this.perches[Math.floor(Math.random() * this.perches.length)];
    this.pos.set(p[0] + 0.3 + Math.random() * 0.4, p[1], p[2] + 0.3 + Math.random() * 0.4);
    this.state = 'perch'; this.yaw = Math.random() * 6.28; this.peckT = Math.random() * 3; this.group.visible = true;
  }
  update(dt, C) {
    const [s, b] = C.world.lightAt(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z));
    this.mat.uniforms.uLight.value.set(s / 15, b / 15);
    const d = Math.hypot(C.ppos.x - this.pos.x, C.ppos.y - this.pos.y, C.ppos.z - this.pos.z);
    if (this.state === 'perch') {
      if (C.sun < 0.3) { this.group.visible = false; this.state = 'gone'; return; }
      this.peckT -= dt;
      this.head.rotation.x = this.peckT < 0.25 && this.peckT > 0 ? 0.8 : 0;
      if (this.peckT < 0) { this.peckT = 1 + Math.random() * 4; if (Math.random() < 0.3) this.yaw += (Math.random() - 0.5) * 2; }
      this.wings.forEach((w, i) => { w.rotation.z = 0; });
      if (d < 7) {
        const ax = this.pos.x - C.ppos.x, az = this.pos.z - C.ppos.z, l = Math.hypot(ax, az) || 1;
        this.vel.set(ax / l * 5 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, az / l * 5 + (Math.random() - 0.5) * 2);
        this.state = 'fly'; this.flyT = 0; if (d < 12) C.caw(this);
      }
    } else if (this.state === 'fly') {
      this.flyT += dt;
      this.pos.addScaledVector(this.vel, dt); this.vel.y += dt * 0.6;
      this.yaw = Math.atan2(this.vel.x, this.vel.z);
      const f = Math.sin(this.flyT * 22) * 0.9; this.wings[0].rotation.z = f; this.wings[1].rotation.z = -f;
      if (this.flyT > 9 || this.pos.y > 78) { if (C.sun >= 0.3) this.perch(); else { this.group.visible = false; this.state = 'gone'; } }
    } else if (C.sun >= 0.35 && d > 30) this.perch();
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
  }
}
