// Emberward tuning: every number the game plays by lives here, so a balance
// change is one edit in this file and nothing else. The world reads these
// values; it never hard-codes a speed, a health pool or a wave size.
export const STEP = 1 / 60;
export const FIELD = { width: 960, height: 540 };
export const BEST_KEY = 'emberward-best';

export const PLAYER = {
  radius: 14,
  speed: 250,
  maxHp: 5,
  fireInterval: 0.21,
  bulletSpeed: 560,
  bulletDamage: 1,
  bulletRadius: 5,
  dashSpeed: 640,
  dashTime: 0.16,
  dashCooldown: 1.5,
  novaMax: 2,
  novaRadius: 190,
  novaDamage: 6,
  invulnTime: 1.0,
  pickupRadius: 26,
  magnetRadius: 90,
};

export const COMBO_WINDOW = 3.5;
export const COMBO_MAX = 8;
export const EMBER_SCORE = 25;

// Enemy kinds. Each one moves, attacks and looks different, so the player
// reads the threat at a glance instead of memorising hit points.
export const ENEMIES = {
  mote:     { hp: 1, speed: 98,  radius: 12, score: 50,  touch: 1, color: '#b388ff' },
  spitter:  { hp: 3, speed: 72,  radius: 14, score: 120, touch: 1, color: '#7dff6a', shotInterval: 2.3, bulletSpeed: 175 },
  brute:    { hp: 9, speed: 46,  radius: 22, score: 200, touch: 2, color: '#ff5d5d' },
  splitter: { hp: 2, speed: 84,  radius: 15, score: 150, touch: 1, color: '#ffa94d' },
  wisp:     { hp: 1, speed: 132, radius: 10, score: 100, touch: 1, color: '#6ae8ff', dashInterval: 2.6 },
  bloom:    { hp: 4, speed: 0,   radius: 16, score: 180, touch: 1, color: '#ff9de2', spawnInterval: 4 },
};

export const BOSSES = {
  herald: { hp: 118, speed: 52, radius: 34, score: 2500, touch: 2, color: '#c77dff', name: 'GLOOM HERALD' },
  king:   { hp: 230, speed: 58, radius: 38, score: 6000, touch: 2, color: '#ff2e88', name: 'THE HOLLOW KING' },
};

// Wave plans: [motes, spitters, brutes, splitters, wisps]. Waves 5 and 10
// are boss waves: the boss arrives first, then a slow trickle of minions.
export const WAVES = [
  { mote: 8,  spitter: 0, brute: 0, splitter: 0, wisp: 0 },
  { mote: 10, spitter: 3, brute: 0, splitter: 0, wisp: 0 },
  { mote: 12, spitter: 4, brute: 1, splitter: 2, wisp: 0 },
  { mote: 12, spitter: 5, brute: 2, splitter: 3, wisp: 4 },
  { mote: 5,  spitter: 2, brute: 1, splitter: 2, wisp: 2, boss: 'herald' },
  { mote: 14, spitter: 6, brute: 2, splitter: 4, wisp: 6, bloom: 1 },
  { mote: 14, spitter: 7, brute: 3, splitter: 5, wisp: 8, bloom: 1 },
  { mote: 16, spitter: 8, brute: 4, splitter: 6, wisp: 10, bloom: 2 },
  { mote: 16, spitter: 9, brute: 5, splitter: 6, wisp: 12, bloom: 2 },
  { mote: 8,  spitter: 4, brute: 2, splitter: 3, wisp: 6, bloom: 1, boss: 'king' },
];
export const FINAL_WAVE = 10;
export const SPAWN_INTERVAL = 0.55;
export const SPAWN_MARGIN = 46;

// From wave 6 on, a few spawns come back gilded: tougher, faster, worth
// triple. The gold ring tells the player at a glance.
export const ELITE_MIN_WAVE = 6;
export const ELITE_CHANCE = 0.12;
export const ELITE_HP_MUL = 2;
export const ELITE_SCORE_MUL = 3;

// Orbiting embers: each stack adds one burning orb circling the warden.
export const ORBIT_RADIUS = 76;
export const ORBIT_SPEED = 2.4;
export const ORBIT_DAMAGE = 2;
export const ORBIT_HIT_GAP = 0.4;

// Between-wave draft: pick one of three. Each upgrade stacks to its cap.
export const UPGRADES = [
  { id: 'rapid',   name: 'Quick Wick',    desc: 'Shoot 18% faster.',            max: 4, apply: (u) => { u.fireRate += 0.18; } },
  { id: 'heavy',   name: 'Heavy Ember',   desc: '+1 damage per bolt.',           max: 3, apply: (u) => { u.damage += 1; } },
  { id: 'split',   name: 'Twin Flame',    desc: '+1 bolt per shot.',             max: 2, apply: (u) => { u.multishot += 1; } },
  { id: 'swift',   name: 'Swift Step',    desc: 'Move 10% faster.',              max: 3, apply: (u) => { u.speed += 0.10; } },
  { id: 'dash',    name: 'Slipstream',    desc: 'Dash recharges 25% faster.',    max: 3, apply: (u) => { u.dashCd *= 0.75; } },
  { id: 'plating', name: 'Lantern Plate', desc: '+1 max heart, heal 1 now.',    max: 3, apply: (u) => { u.maxHp += 1; } },
  { id: 'nova',    name: 'Nova Charge',   desc: '+1 nova charge, refill now.',   max: 2, apply: (u) => { u.novaMax += 1; } },
  { id: 'magnet',  name: 'Ember Magnet',  desc: 'Pickups fly to you farther.',   max: 3, apply: (u) => { u.magnet += 45; } },
  { id: 'pierce',  name: 'Piercing Light', desc: 'Bolts pierce +1 enemy.',       max: 2, apply: (u) => { u.pierce += 1; } },
  { id: 'greed',   name: 'Gilded Flame',  desc: '+25% score from everything.',   max: 3, apply: (u) => { u.scoreMul += 0.25; } },
  { id: 'orbit',   name: 'Ember Orbit',   desc: 'A burning orb circles you.',    max: 2, apply: (u) => { u.orbit += 1; } },
];
export const DRAFT_CHOICES = 3;

// The arena's look: a night field lit by the warden's own lantern.
export const PALETTE = {
  bgTop: '#12173a',
  bgBottom: '#0a0c22',
  grid: 'rgba(120, 140, 255, 0.08)',
  player: '#5ef2e0',
  playerCore: '#eafffb',
  bullet: '#ffc46b',
  ember: '#ffb347',
  heart: '#ff6b81',
  nova: '#c77dff',
  text: '#f2f4ff',
  dim: '#9aa3c7',
  gold: '#ffd166',
};
