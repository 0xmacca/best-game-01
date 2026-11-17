// The game itself: one fixed-step simulation. The world owns the player,
// the enemies, the bullets, the pickups, the waves and the score, and it
// knows nothing about the canvas or the keyboard: the loop hands it a
// control ({mx, my, aimX, aimY, shoot, dash, nova}) each step and reads back
// an events bitmask for sounds and screen changes. That split is what makes
// the screenshot scenes real: the autopilot feeds the same control shape.
import { BOSSES, COMBO_MAX, COMBO_WINDOW, ELITE_CHANCE, ELITE_HP_MUL, ELITE_MIN_WAVE, ELITE_SCORE_MUL, EMBER_SCORE, ENEMIES, FIELD, FINAL_WAVE, ORBIT_DAMAGE, ORBIT_HIT_GAP, ORBIT_RADIUS, ORBIT_SPEED, PLAYER, SPAWN_INTERVAL, SPAWN_MARGIN, STEP, UPGRADES, WAVES } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_PICKUP = 32;
export const EVENT_KILL = 64;
export const EVENT_SHOOT = 128;
export const EVENT_DASH = 256;
export const EVENT_NOVA = 512;

let nextId = 1;

function baseUpgrades() {
  return {
    fireRate: 0, damage: 0, multishot: 0, speed: 0, dashCd: 1,
    maxHp: 0, novaMax: 0, magnet: 0, pierce: 0, scoreMul: 1, orbit: 0, taken: {},
  };
}

export function createWorld(random) {
  const world = {
    random,
    state: null,
    reset(seedWorld) {
      const s = {
        time: 0,
        wave: 0,
        waveState: 'idle',
        bannerTimer: 0,
        player: {
          x: FIELD.width / 2, y: FIELD.height / 2,
          vx: 0, vy: 0, angle: -Math.PI / 2,
          hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
          fireTimer: 0, dashTimer: 0, dashCd: 0,
          nova: PLAYER.novaMax, novaMax: PLAYER.novaMax,
          invuln: 0, upgrades: baseUpgrades(),
        },
        enemies: [], bullets: [], ebullets: [], pickups: [],
        particles: [], floats: [],
        spawnQueue: [], spawnTimer: 0,
        boss: null,
        score: 0, combo: 0, comboTimer: 0, maxCombo: 0, best: 0,
        kills: 0, shotsFired: 0, hits: 0, taken: 0,
        shake: 0, hitStop: 0,
        draft: null,
        over: false, won: false, overSent: false,
        endless: false,
      };
      this.state = s;
      if (seedWorld) this.beginWave(1);
      return s;
    },

    // Open a wave: build its spawn queue from the plan, announce the boss
    // at once on boss waves, and hold the banner for a beat before the
    // first spawn so the player reads what is coming.
    beginWave(n) {
      const s = this.state;
      // Past the final wave (endless mode after a victory), the plans keep
      // scaling: more of everything, a herald every fifth wave.
      const plan = n <= WAVES.length ? WAVES[n - 1] : {
        mote: 10 + (n - FINAL_WAVE) * 2,
        spitter: 5 + (n - FINAL_WAVE),
        brute: 2 + Math.floor((n - FINAL_WAVE) / 2),
        splitter: 3 + (n - FINAL_WAVE),
        wisp: 6 + (n - FINAL_WAVE),
        bloom: 1 + Math.floor((n - FINAL_WAVE) / 3),
        boss: (n - FINAL_WAVE) % 5 === 0 ? 'herald' : undefined,
      };
      s.wave = n;
      s.waveState = 'banner';
      s.bannerTimer = 1.7;
      s.spawnQueue = [];
      for (const kind of Object.keys(ENEMIES)) {
        for (let i = 0; i < (plan[kind] || 0); i += 1) s.spawnQueue.push(kind);
      }
      // Shuffle the queue so the same wave never plays the same order.
      for (let i = s.spawnQueue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random.next() * (i + 1));
        [s.spawnQueue[i], s.spawnQueue[j]] = [s.spawnQueue[j], s.spawnQueue[i]];
      }
      s.spawnTimer = 0.4;
      if (plan.boss) {
        s.boss = this.spawnBoss(plan.boss);
        return EVENT_BOSS;
      }
      return 0;
    },

    spawnBoss(kind) {
      const s = this.state;
      const def = BOSSES[kind];
      const boss = {
        id: nextId++, kind, boss: true,
        x: FIELD.width / 2, y: 110, vx: 0, vy: 0,
        hp: def.hp, maxHp: def.hp, radius: def.radius,
        angle: Math.PI / 2, attackTimer: 2.2, summonTimer: 5,
        phase: 1, t: 0, flash: 0,
      };
      s.enemies.push(boss);
      return boss;
    },

    spawnEnemy(kind) {
      const s = this.state;
      const def = ENEMIES[kind];
      const edge = Math.floor(random.next() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random.range(0, FIELD.width); y = -SPAWN_MARGIN; }
      if (edge === 1) { x = random.range(0, FIELD.width); y = FIELD.height + SPAWN_MARGIN; }
      if (edge === 2) { x = -SPAWN_MARGIN; y = random.range(0, FIELD.height); }
      if (edge === 3) { x = FIELD.width + SPAWN_MARGIN; y = random.range(0, FIELD.height); }
      const enemy = {
        id: nextId++, kind,
        x, y, vx: 0, vy: 0,
        hp: def.hp, maxHp: def.hp, radius: def.radius,
        angle: random.angle(), shotTimer: random.range(1.2, 2.4),
        dashState: 0, dashTimer: random.range(0.8, 1.8), flash: 0,
        wobble: random.range(0, Math.PI * 2), t: 0, orbitHit: -10, elite: false,
      };
      // From wave 6 on, a few spawns come back gilded: double health,
      // a wider body, triple score, a gold ring.
      if (s.wave >= ELITE_MIN_WAVE && random.next() < ELITE_CHANCE) {
        enemy.elite = true;
        enemy.hp = def.hp * ELITE_HP_MUL;
        enemy.maxHp = enemy.hp;
        enemy.radius = def.radius * 1.25;
      }
      s.enemies.push(enemy);
      return enemy;
    },

    burst(x, y, color, count, speed, life, size) {
      const s = this.state;
      for (let i = 0; i < count; i += 1) {
        const a = random.angle();
        const v = random.range(speed * 0.3, speed);
        s.particles.push({
          x, y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: random.range(life * 0.5, life), maxLife: life,
          size: random.range(size * 0.6, size * 1.4), color, drag: 0.92,
        });
      }
      if (s.particles.length > 420) s.particles.splice(0, s.particles.length - 420);
    },

    float(x, y, text, color) {
      const s = this.state;
      s.floats.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
      if (s.floats.length > 24) s.floats.shift();
    },

    // The draft: three distinct upgrades the player has not maxed, or a
    // mend / hoard fallback when everything is already taken.
    rollDraft() {
      const s = this.state;
      const taken = s.player.upgrades.taken;
      const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
      const picks = [];
      while (picks.length < 3 && pool.length > 0) {
        const index = Math.floor(random.next() * pool.length);
        picks.push(pool.splice(index, 1)[0]);
      }
      while (picks.length < 3) {
        picks.push(picks.length === 1
          ? { id: 'mend', name: 'Mend', desc: 'Heal 2 hearts now.' }
          : { id: 'hoard', name: 'Hoard', desc: '+1000 score, no questions.' });
      }
      s.draft = picks;
      return picks;
    },

    applyUpgrade(id) {
      const s = this.state;
      const p = s.player;
      const def = UPGRADES.find((u) => u.id === id);
      if (id === 'mend') {
        p.hp = Math.min(p.maxHp, p.hp + 2);
      } else if (id === 'hoard') {
        s.score += 1000;
      } else if (def) {
        def.apply(p.upgrades);
        p.upgrades.taken[id] = (p.upgrades.taken[id] || 0) + 1;
        if (id === 'plating') {
          p.maxHp += 1;
          p.hp = Math.min(p.maxHp, p.hp + 1);
        }
        if (id === 'nova') {
          p.novaMax += 1;
          p.nova = p.novaMax;
        }
      }
      s.draft = null;
    },

    // One fixed step. Returns the events bitmask for this step.
    step(dt, c) {
      const s = this.state;
      const p = s.player;
      let events = 0;
      const killsBefore = s.kills;
      const takenBefore = s.taken;
      s.time += dt;
      if (s.hitStop > 0) {
        s.hitStop -= dt;
        return 0;
      }
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 26);
      if (p.invuln > 0) p.invuln -= dt;
      if (p.dashCd > 0) p.dashCd -= dt;
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 0;
      }

      // --- wave banner and spawning -------------------------------------
      if (s.waveState === 'banner') {
        s.bannerTimer -= dt;
        if (s.bannerTimer <= 0) s.waveState = 'fight';
      } else if (s.waveState === 'fight') {
        if (s.spawnQueue.length > 0) {
          s.spawnTimer -= dt;
          if (s.spawnTimer <= 0) {
            this.spawnEnemy(s.spawnQueue.pop());
            s.spawnTimer = SPAWN_INTERVAL * random.range(0.7, 1.3);
          }
        } else if (s.enemies.length === 0) {
          s.waveState = 'clear';
          events |= EVENT_WAVE_CLEAR;
          if (s.wave === FINAL_WAVE && !s.endless) {
            s.won = true;
            events |= EVENT_WIN;
          }
        }
      }

      // --- player --------------------------------------------------------
      const up = p.upgrades;
      const speed = PLAYER.speed * (1 + up.speed);
      const aimDx = c.aimX - p.x;
      const aimDy = c.aimY - p.y;
      if (aimDx !== 0 || aimDy !== 0) p.angle = Math.atan2(aimDy, aimDx);
      if (p.dashTimer > 0) {
        p.dashTimer -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.vx = c.mx * speed;
        p.vy = c.my * speed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if ((c.dash || c.dashHeld) && p.dashCd <= 0 && (c.mx !== 0 || c.my !== 0)) {
          const len = Math.hypot(c.mx, c.my) || 1;
          p.vx = (c.mx / len) * PLAYER.dashSpeed;
          p.vy = (c.my / len) * PLAYER.dashSpeed;
          p.dashTimer = PLAYER.dashTime;
          p.dashCd = PLAYER.dashCooldown * up.dashCd;
          p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.08);
          this.burst(p.x, p.y, '#5ef2e0', 10, 160, 0.35, 3);
          events |= EVENT_DASH;
        }
      }
      p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x));
      p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y));

      // Shooting: a spread of bolts toward the aim, one trigger pull each
      // interval while the button is held.
      p.fireTimer -= dt;
      if (c.shoot && p.fireTimer <= 0 && s.waveState !== 'banner') {
        p.fireTimer = PLAYER.fireInterval / (1 + up.fireRate);
        const shots = 1 + up.multishot;
        for (let i = 0; i < shots; i += 1) {
          const spread = (i - (shots - 1) / 2) * 0.11;
          const a = p.angle + spread;
          s.bullets.push({
            id: nextId++, x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
            vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
            damage: PLAYER.bulletDamage + up.damage, pierce: up.pierce, radius: PLAYER.bulletRadius,
          });
        }
        s.shotsFired += 1;
        events |= EVENT_SHOOT;
      }

      // Nova: a ring that clears the room around the warden.
      if (c.nova && p.nova > 0 && s.waveState === 'fight') {
        p.nova -= 1;
        events |= EVENT_NOVA;
        this.burst(p.x, p.y, '#c77dff', 46, 420, 0.7, 4);
        s.shake = Math.max(s.shake, 10);
        for (const e of [...s.enemies]) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < PLAYER.novaRadius + e.radius) this.damageEnemy(e, PLAYER.novaDamage, p.angle, 260);
        }
      }

      this.updateEnemies(dt, c);
      this.updateOrbit();
      this.updateBullets(dt);
      this.updatePickups(dt);
      this.updateParticles(dt);
      if (s.kills !== killsBefore) events |= EVENT_KILL;
      if (s.taken !== takenBefore) events |= EVENT_PICKUP;

      // Contact damage: an enemy touching the warden hurts, once per
      // invulnerability window, and shoves the warden away from it.
      if (p.invuln <= 0 && !s.over) {
        for (const e of s.enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < e.radius + PLAYER.radius - 2) {
            const def = e.boss ? BOSSES[e.kind] : ENEMIES[e.kind];
            p.hp -= def.touch;
            p.invuln = PLAYER.invulnTime;
            s.shake = Math.max(s.shake, 12);
            s.hitStop = 0.07;
            this.burst(p.x, p.y, '#ff6b81', 22, 260, 0.5, 4);
            events |= EVENT_HIT;
            if (p.hp <= 0) {
              s.over = true;
              events |= EVENT_OVER;
              this.burst(p.x, p.y, '#5ef2e0', 60, 380, 1.0, 5);
              this.burst(p.x, p.y, '#ffb347', 40, 260, 0.9, 4);
            }
            break;
          }
        }
      }
      // Death by bullet sets over inside updateBullets, which returns no
      // events: report it here, once, so the loop always sees the end.
      if (s.over && !s.overSent) {
        s.overSent = true;
        events |= EVENT_OVER;
      }
      return events;
    },

    damageEnemy(e, damage, fromAngle, knock, countHit = true) {
      const s = this.state;
      e.hp -= damage;
      e.flash = 0.09;
      if (countHit) s.hits += 1;
      const kb = e.kind === 'brute' || e.boss ? knock * 0.25 : knock;
      e.x += Math.cos(fromAngle) * kb * 0.06;
      e.y += Math.sin(fromAngle) * kb * 0.06;
      this.burst(e.x, e.y, '#ffd166', 5, 140, 0.3, 3);
      if (e.hp <= 0) this.killEnemy(e);
    },

    killEnemy(e) {
      const s = this.state;
      const def = e.boss ? BOSSES[e.kind] : ENEMIES[e.kind];
      s.kills += 1;
      s.combo = Math.min(s.combo + 1, COMBO_MAX);
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.comboTimer = COMBO_WINDOW;
      const mult = Math.max(1, s.combo);
      const eliteMul = e.elite ? ELITE_SCORE_MUL : 1;
      const gained = Math.round(def.score * mult * eliteMul * s.player.upgrades.scoreMul);
      s.score += gained;
      this.float(e.x, e.y - e.radius - 6, `+${gained}`, '#ffd166');
      this.burst(e.x, e.y, def.color, e.boss ? 70 : 18, e.boss ? 420 : 240, 0.7, 4);
      if (e.boss) {
        s.shake = Math.max(s.shake, 16);
        s.hitStop = 0.12;
        s.boss = null;
        // A boss always pays for the fight: a heart, a nova cell and
        // embers, so the next wave starts on a full breath.
        this.dropPickup(e.x - 26, e.y, 'heart');
        this.dropPickup(e.x + 26, e.y, 'nova');
        for (let i = 0; i < 3; i += 1) this.dropPickup(e.x + (i - 1) * 22, e.y + 24, 'ember');
      }
      if (e.kind === 'splitter') {
        for (let i = 0; i < 2; i += 1) {
          const m = this.spawnEnemy('mote');
          m.x = e.x + (i === 0 ? -18 : 18);
          m.y = e.y;
        }
      }
      // Drops: embers often, a heart or a nova cell rarely.
      const roll = random.next();
      if (roll < 0.55) this.dropPickup(e.x, e.y, 'ember');
      else if (roll < 0.61 && s.player.hp < s.player.maxHp) this.dropPickup(e.x, e.y, 'heart');
      else if (roll < 0.65) this.dropPickup(e.x, e.y, 'nova');
      s.enemies = s.enemies.filter((other) => other.id !== e.id);
    },

    dropPickup(x, y, kind) {
      const s = this.state;
      s.pickups.push({ x, y, kind, vx: random.range(-30, 30), vy: random.range(-30, 30), life: 9, t: random.range(0, 6) });
    },

    updateEnemies(dt, c) {
      const s = this.state;
      const p = s.player;
      for (const e of [...s.enemies]) {
        const def = e.boss ? BOSSES[e.kind] : ENEMIES[e.kind];
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        if (e.flash > 0) e.flash -= dt;
        e.t += dt;
        e.angle = Math.atan2(dy, dx);
        if (e.boss) {
          this.updateBoss(e, dt, nx, ny, dist);
          continue;
        }
        if (e.kind === 'mote' || e.kind === 'splitter') {
          const wob = Math.sin(e.t * 3 + e.wobble) * 0.35;
          e.x += (nx * def.speed + -ny * wob * def.speed) * dt;
          e.y += (ny * def.speed + nx * wob * def.speed) * dt;
        } else if (e.kind === 'spitter') {
          // Keeps its distance and strafes; fires a glob on a timer.
          const want = dist > 280 ? 1 : dist < 200 ? -1 : 0;
          const strafe = Math.sin(e.t * 1.4 + e.wobble) > 0 ? 1 : -1;
          e.x += (nx * want * def.speed + -ny * strafe * def.speed * 0.6) * dt;
          e.y += (ny * want * def.speed + nx * strafe * def.speed * 0.6) * dt;
          e.shotTimer -= dt;
          if (e.shotTimer <= 0 && dist < 520) {
            e.shotTimer = def.shotInterval * random.range(0.85, 1.2);
            e.flash = 0.15;
            s.ebullets.push({
              x: e.x, y: e.y,
              vx: nx * def.bulletSpeed, vy: ny * def.bulletSpeed,
              radius: 7, life: 4,
            });
          }
        } else if (e.kind === 'brute') {
          e.x += nx * def.speed * dt;
          e.y += ny * def.speed * dt;
        } else if (e.kind === 'bloom') {
          // Rooted: it never moves, it breeds. Every few seconds it
          // births a mote beside itself, while the room still has space.
          // After five births it withers on its own: a breeding flower
          // must never be able to stall a wave while the player hunts
          // for the last foe.
          e.shotTimer -= dt;
          if (e.shotTimer <= 0) {
            e.shotTimer = def.spawnInterval * random.range(0.9, 1.1);
            e.spawned = (e.spawned || 0) + 1;
            if (e.spawned >= 5) {
              this.burst(e.x, e.y, def.color, 14, 170, 0.6, 4);
              s.enemies = s.enemies.filter((o) => o !== e);
            } else if (s.enemies.length < 45) {
              const m = this.spawnEnemy('mote');
              m.x = e.x + random.range(-30, 30);
              m.y = e.y + random.range(-30, 30);
            }
          }
        } else if (e.kind === 'wisp') {
          // Wander, telegraph, then dash straight at the warden.
          e.dashTimer -= dt;
          if (e.dashState === 0) {
            e.x += Math.cos(e.wobble + e.t * 0.8) * def.speed * 0.5 * dt;
            e.y += Math.sin(e.wobble + e.t * 0.8) * def.speed * 0.5 * dt;
            if (e.dashTimer <= 0) { e.dashState = 1; e.dashTimer = 0.45; e.flash = 0.45; }
          } else if (e.dashState === 1) {
            if (e.dashTimer <= 0) {
              e.dashState = 2;
              e.dashTimer = 0.35;
              e.vx = nx * 430;
              e.vy = ny * 430;
            }
          } else if (e.dashState === 2) {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            if (e.dashTimer <= 0) { e.dashState = 0; e.dashTimer = def.dashInterval * random.range(0.8, 1.3); }
          }
        }
        e.x = Math.max(-60, Math.min(FIELD.width + 60, e.x));
        e.y = Math.max(-60, Math.min(FIELD.height + 60, e.y));
      }
    },

    // Orbiting embers: each stack circles the warden and sears anything
    // it touches, at most once per gap per enemy. Orb hits are not
    // counted as shots, so accuracy stays the bolts' own number.
    updateOrbit() {
      const s = this.state;
      const p = s.player;
      const count = p.upgrades.orbit;
      if (count <= 0) return;
      for (let i = 0; i < count; i += 1) {
        const a = s.time * ORBIT_SPEED + (i * Math.PI * 2) / count;
        const ox = p.x + Math.cos(a) * ORBIT_RADIUS;
        const oy = p.y + Math.sin(a) * ORBIT_RADIUS;
        for (const e of [...s.enemies]) {
          const d = Math.hypot(e.x - ox, e.y - oy);
          if (d < e.radius + 10 && s.time - (e.orbitHit || -10) >= ORBIT_HIT_GAP) {
            e.orbitHit = s.time;
            this.damageEnemy(e, ORBIT_DAMAGE, Math.atan2(e.y - p.y, e.x - p.x), 60, false);
          }
        }
      }
    },

    updateBoss(e, dt, nx, ny, dist) {
      const s = this.state;
      const p = s.player;
      const def = BOSSES[e.kind];
      // Phase two below half health: faster, angrier, more summons.
      if (e.phase === 1 && e.hp < e.maxHp / 2) {
        e.phase = 2;
        e.attackTimer = 0.8;
        this.burst(e.x, e.y, def.color, 50, 380, 0.8, 5);
        this.float(e.x, e.y - e.radius - 10, e.kind === 'king' ? 'THE KING RAGES' : 'THE HERALD RAGES', '#ff6b81');
      }
      const speedMul = e.phase === 2 ? 1.35 : 1;
      e.x += nx * def.speed * speedMul * 0.5 * dt;
      e.y += ny * def.speed * speedMul * 0.5 * dt;
      e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackTimer = e.kind === 'king' ? (e.phase === 2 ? 1.5 : 2.0) : (e.phase === 2 ? 2.3 : 2.7);
        if (e.kind === 'herald') {
          // A radial burst, then a aimed three-shot.
          for (let i = 0; i < 8; i += 1) {
            const a = (i / 8) * Math.PI * 2 + e.t;
            s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, radius: 7, life: 5 });
          }
          for (let i = -1; i <= 1; i += 1) {
            const a = Math.atan2(p.y - e.y, p.x - e.x) + i * 0.18;
            s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, radius: 7, life: 5 });
          }
        } else {
          // The king walks a spiral: a rotating fan that never stops.
          const base = e.t * 1.7;
          for (let i = 0; i < 5; i += 1) {
            const a = base + (i / 5) * Math.PI * 2;
            s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, radius: 7, life: 5 });
          }
        }
        e.flash = 0.2;
      }
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = e.phase === 2 ? 6 : 8;
        for (let i = 0; i < (e.kind === 'king' ? 3 : 2); i += 1) {
          const m = this.spawnEnemy('mote');
          m.x = e.x + random.range(-70, 70);
          m.y = e.y + random.range(-70, 70);
        }
      }
    },

    updateBullets(dt) {
      const s = this.state;
      const p = s.player;
      for (const b of [...s.bullets]) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
          s.bullets = s.bullets.filter((o) => o.id !== b.id);
          continue;
        }
        for (const e of [...s.enemies]) {
          if (e.lastBulletId === b.id) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < e.radius + b.radius) {
            e.lastBulletId = b.id;
            const a = Math.atan2(b.vy, b.vx);
            this.damageEnemy(e, b.damage, a, 120);
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              s.bullets = s.bullets.filter((o) => o.id !== b.id);
            }
            break;
          }
        }
      }
      for (const b of [...s.ebullets]) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < -30 || b.x > FIELD.width + 30 || b.y < -30 || b.y > FIELD.height + 30) {
          s.ebullets = s.ebullets.filter((o) => o !== b);
          continue;
        }
        if (p.invuln <= 0 && !s.over) {
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          if (d < PLAYER.radius + b.radius - 2) {
            p.hp -= 1;
            p.invuln = PLAYER.invulnTime;
            s.shake = Math.max(s.shake, 10);
            s.hitStop = 0.06;
            this.burst(p.x, p.y, '#ff6b81', 18, 240, 0.5, 4);
            s.ebullets = s.ebullets.filter((o) => o !== b);
            if (p.hp <= 0) {
              s.over = true;
              this.burst(p.x, p.y, '#5ef2e0', 60, 380, 1.0, 5);
            }
          }
        }
      }
    },

    updatePickups(dt) {
      const s = this.state;
      const p = s.player;
      const magnet = PLAYER.magnetRadius + p.upgrades.magnet;
      for (const pk of [...s.pickups]) {
        pk.t += dt;
        pk.life -= dt;
        const d = Math.hypot(p.x - pk.x, p.y - pk.y);
        if (d < magnet) {
          pk.vx += ((p.x - pk.x) / (d || 1)) * 900 * dt;
          pk.vy += ((p.y - pk.y) / (d || 1)) * 900 * dt;
        }
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;
        pk.vx *= 0.94;
        pk.vy *= 0.94;
        if (pk.life <= 0) {
          s.pickups = s.pickups.filter((o) => o !== pk);
          continue;
        }
        if (d < PLAYER.pickupRadius + 8) {
          s.taken += 1;
          if (pk.kind === 'ember') {
            const gained = Math.round(EMBER_SCORE * Math.max(1, s.combo) * p.upgrades.scoreMul);
            s.score += gained;
            this.float(pk.x, pk.y - 8, `+${gained}`, '#ffb347');
          } else if (pk.kind === 'heart') {
            p.hp = Math.min(p.maxHp, p.hp + 1);
            this.float(pk.x, pk.y - 8, '+1', '#ff6b81');
          } else if (pk.kind === 'nova') {
            p.nova = Math.min(p.novaMax, p.nova + 1);
            this.float(pk.x, pk.y - 8, 'NOVA +1', '#c77dff');
          }
          this.burst(pk.x, pk.y, pk.kind === 'ember' ? '#ffb347' : pk.kind === 'heart' ? '#ff6b81' : '#c77dff', 8, 120, 0.4, 3);
          s.pickups = s.pickups.filter((o) => o !== pk);
        }
      }
    },

    updateParticles(dt) {
      const s = this.state;
      for (const pt of [...s.particles]) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= pt.drag;
        pt.vy *= pt.drag;
        if (pt.life <= 0) s.particles = s.particles.filter((o) => o !== pt);
      }
      for (const f of [...s.floats]) {
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) s.floats = s.floats.filter((o) => o !== f);
      }
    },

    // The title screen's living backdrop: embers drift up and fade, and a
    // few motes wander the field, harmless, so the title never sits still.
    attract(dt) {
      const s = this.state;
      if (random.next() < 0.16) {
        s.particles.push({
          x: random.range(0, FIELD.width), y: FIELD.height + 8,
          vx: random.range(-8, 8), vy: random.range(-42, -18),
          life: random.range(2, 4), maxLife: 4,
          size: random.range(1.5, 3.5), color: random.pick(['#ffb347', '#5ef2e0', '#b388ff']), drag: 1,
        });
      }
      if (s.enemies.length < 5 && random.next() < 0.01) {
        const m = this.spawnEnemy('mote');
        m.x = random.range(80, FIELD.width - 80);
        m.y = random.range(80, FIELD.height - 80);
      }
      for (const e of [...s.enemies]) {
        e.x += Math.cos(e.wobble + s.time * 0.5) * 22 * dt;
        e.y += Math.sin(e.wobble + s.time * 0.5) * 22 * dt;
      }
      this.updateParticles(dt);
      s.time += dt;
    },
  };
  world.reset(false);
  return world;
}
