// The autopilot: the same control shape the keyboard hands the world, so
// the screenshot scenes play the real rules instead of posing. It kites:
// keep a little distance from the nearest threat, shoot the nearest enemy,
// dash when a bullet or a body gets too close, and spend the nova when the
// room closes in. It also picks the draft by a fixed priority list.
import { FIELD, PLAYER } from './config.js';

const DRAFT_PRIORITY = ['heavy', 'split', 'rapid', 'plating', 'pierce', 'dash', 'nova', 'swift', 'magnet', 'greed', 'orbit'];

export function autopilotControl(world) {
  const s = world.state;
  const p = s.player;
  const control = { mx: 0, my: 0, aimX: p.x, aimY: p.y - 100, shoot: false, dash: false, dashHeld: false, nova: false };
  if (s.over || s.won) return control;

  // Nearest threat, and the nearest enemy worth shooting. A bloom is
  // always worth shooting first: it breeds while it lives.
  let threat = null;
  let threatD = Infinity;
  let target = null;
  let targetD = Infinity;
  let bloomTarget = null;
  let bloomD = Infinity;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.kind === 'bloom' && d < bloomD) { bloomD = d; bloomTarget = e; }
    if (d < targetD) { targetD = d; target = e; }
    const danger = e.boss ? d - 120 : d;
    if (danger < threatD) { threatD = danger; threat = e; }
  }
  if (bloomTarget) target = bloomTarget;
  let bulletNear = false;
  for (const b of s.ebullets) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < 70) { bulletNear = true; break; }
  }

  // Move: away from the threat when it is close, toward the middle of the
  // room otherwise, and sideways a little so the warden never walks a
  // straight line into a spitter's glob.
  let mx = 0;
  let my = 0;
  if (threat && threatD < 150) {
    mx = (p.x - threat.x) / (threatD || 1);
    my = (p.y - threat.y) / (threatD || 1);
  } else {
    mx = (FIELD.width / 2 - p.x) / FIELD.width;
    my = (FIELD.height / 2 - p.y) / FIELD.height;
    mx += Math.sin(s.time * 0.7) * 0.4;
    my += Math.cos(s.time * 0.9) * 0.3;
  }
  // Never hug a wall: steer back inside a margin.
  if (p.x < 70) mx += 0.6;
  if (p.x > FIELD.width - 70) mx -= 0.6;
  if (p.y < 70) my += 0.6;
  if (p.y > FIELD.height - 70) my -= 0.6;
  const len = Math.hypot(mx, my) || 1;
  control.mx = mx / len;
  control.my = my / len;

  if (target) {
    control.aimX = target.x;
    control.aimY = target.y;
    control.shoot = true;
  }
  if ((bulletNear || (threat && threatD < 60)) && p.dashCd <= 0) control.dash = true;
  let closeCount = 0;
  for (const e of s.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < 170) closeCount += 1;
  }
  if (closeCount >= 5 && p.nova > 0) control.nova = true;
  return control;
}

export function autopilotDraft(world) {
  const s = world.state;
  if (!s.draft) return null;
  for (const id of DRAFT_PRIORITY) {
    const found = s.draft.find((d) => d.id === id);
    if (found) return found.id;
  }
  return s.draft[0].id;
}

// How many player pixels the pilot is allowed to waste: the victory scene
// plays with a boosted warden so the run finishes inside the step cap.
export function boostPlayerForShot(world) {
  const p = world.state.player;
  p.upgrades.fireRate = 0.6;
  p.upgrades.damage = 2;
  p.upgrades.multishot = 2;
  p.upgrades.speed = 0.2;
  p.upgrades.pierce = 1;
  p.upgrades.orbit = 1;
  p.upgrades.taken = { rapid: 3, heavy: 2, split: 2, swift: 2, pierce: 1, orbit: 1 };
}
