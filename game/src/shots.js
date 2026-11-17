// The screenshot scenes behind ?shot=title|play|boss|victory. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by the autopilot, so the frame is what a real game looks
// like and the same seed always gives the same frame. The renderer draws
// the returned screen over the staged world.
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { autopilotControl, autopilotDraft, boostPlayerForShot } from './autopilot.js';
import { FIELD, STEP } from './config.js';

const TITLE_SECONDS = 5;
const PLAY_SECONDS = 12;
const BOSS_SECONDS = 12;
const VICTORY_MAX_SECONDS = 260;

function runSteps(world, seconds, draft) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilotControl(world));
    if (events & EVENT_OVER) return 'over';
    if (events & EVENT_WIN) return 'win';
    if (draft && (events & EVENT_WAVE_CLEAR)) {
      world.rollDraft();
      const pick = autopilotDraft(world);
      if (pick) world.applyUpgrade(pick);
      const s = world.state;
      if (!s.won && !s.over) world.beginWave(s.wave + 1);
    }
  }
  return 'ok';
}

// Fight `waves` waves with the autopilot, auto-picking the draft after
// each clear, and stop with the draft for the next wave left OPEN
// (rollDraft called, no pick): the frame then shows the game's choice
// screen over the field the run earned.
function playToDraft(world, waves) {
  world.beginWave(1);
  for (let w = 1; w <= waves; w += 1) {
    let guard = 0;
    let cleared = false;
    while (guard < 60 * 300) {
      const events = world.step(STEP, autopilotControl(world));
      guard += 1;
      if (events & EVENT_OVER) return 'over';
      if (events & EVENT_WIN) return 'win';
      if (events & EVENT_WAVE_CLEAR) { cleared = true; break; }
    }
    if (!cleared) return 'ok';
    if (w === waves) {
      world.rollDraft();
      return 'draft';
    }
    const pick = autopilotDraft(world);
    if (pick) world.applyUpgrade(pick);
    const s = world.state;
    if (!s.won && !s.over) world.beginWave(s.wave + 1);
  }
  return 'ok';
}

export function stageShot(name, world) {
  world.reset(false);
  if (name === 'play') {
    const outcome = playToDraft(world, 4);
    if (outcome === 'draft') return { screen: 'draft', best: world.state.score };
    // Fallback if the run died early: a plain mid-wave frame.
    world.reset(false);
    world.beginWave(3);
    runSteps(world, PLAY_SECONDS, false);
    return { screen: 'play', best: world.state.score };
  }
  if (name === 'boss') {
    // The herald fight with a warden who earned four upgrades on the way:
    // more bolts, orbit orbs and adds on screen than a fresh wave-5 start.
    const outcome = playToDraft(world, 4);
    if (outcome === 'draft') {
      const pick = autopilotDraft(world);
      if (pick) world.applyUpgrade(pick);
      world.beginWave(5);
      runSteps(world, 8, false);
      return { screen: 'play', best: world.state.score };
    }
    world.reset(false);
    world.beginWave(5);
    runSteps(world, BOSS_SECONDS, false);
    return { screen: 'play', best: world.state.score };
  }
  if (name === 'victory') {
    // A boosted warden plays the whole tour for real; if it still has not
    // won inside the cap, the victory screen is staged from the wave-10
    // state directly (the game's own screen, drawn over its own world).
    boostPlayerForShot(world);
    world.beginWave(1);
    const outcome = runSteps(world, VICTORY_MAX_SECONDS, true);
    if (outcome === 'win') return { screen: 'win', best: world.state.score };
    const s = world.state;
    s.won = true;
    s.wave = 10;
    s.enemies = [];
    s.ebullets = [];
    s.score = Math.max(s.score, 12500);
    return { screen: 'win', best: s.score };
  }
  // Title (and any unknown name): the living backdrop, five seconds in.
  // The warden rests at the bottom centre, clear of the start line.
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.attract(STEP);
  world.state.player.x = FIELD.width / 2;
  world.state.player.y = FIELD.height - 35;
  return { screen: 'title', best: 0 };
}
