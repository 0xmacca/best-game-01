// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, draft, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|boss|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_NOVA, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_NOVA, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, draftLayout } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, muted: audio.isMuted() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(endless) {
    world.reset(false);
    world.state.endless = !!endless;
    const ev = world.beginWave(1);
    if (ev & EVENT_BOSS) audio.bossRoar();
    else audio.waveHorn();
    accumulator = 0;
    screen = 'play';
    announce('Playing. Five hearts. Ten waves.');
  }

  function endGame() {
    screen = 'over';
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.defeat();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = 'win';
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.victory();
    announce(`Victory. Score ${world.state.score}. Best ${best}.`);
  }

  function openDraft() {
    world.rollDraft();
    screen = 'draft';
    audio.draft();
    announce('Wave cleared. Choose an upgrade.');
  }

  function pickDraft(index) {
    const draft = world.state.draft;
    if (!draft || index < 0 || index >= draft.length) return;
    world.applyUpgrade(draft[index].id);
    audio.pickup();
    const s = world.state;
    if (!s.over && !s.won) {
      const ev = world.beginWave(s.wave + 1);
      if (ev & EVENT_BOSS) audio.bossRoar();
      else audio.waveHorn();
      screen = 'play';
      announce(`Wave ${s.wave}.`);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_KILL) audio.enemyDie();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_BOSS) audio.bossRoar();
    if (events & EVENT_WIN) winGame();
    else if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WAVE_CLEAR) openDraft();
  }

  function controlFromInput() {
    const dir = input.direction();
    const mouse = input.state;
    return {
      mx: dir.x, my: dir.y,
      aimX: mouse.mouseX, aimY: mouse.mouseY,
      shoot: input.shooting(),
      dash: false, dashHeld: input.dashHeld(), nova: false,
    };
  }

  function step() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === 'title') {
      world.attract(STEP);
      if (actions & ACTION_CONFIRM || input.takeClick()) startGame(false);
      return;
    }
    if (screen === 'over') {
      if (actions & ACTION_CONFIRM || input.takeClick()) startGame(false);
      return;
    }
    if (screen === 'win') {
      if (actions & ACTION_CONFIRM || input.takeClick()) startGame(false);
      else if (actions & ACTION_NOVA) startGame(true);
      return;
    }
    if (screen === 'draft') {
      const click = input.takeClick();
      if (click) {
        const rects = draftLayout();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
            pickDraft(i);
            return;
          }
        }
      }
      if (actions & ACTION_CONFIRM) pickDraft(0);
      else if (actions & ACTION_NOVA) pickDraft(1);
      return;
    }
    if (screen === 'pause') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = 'play';
        announce('Playing.');
      }
      return;
    }
    // screen === 'play'
    if (actions & ACTION_PAUSE) {
      screen = 'pause';
      announce('Paused.');
      return;
    }
    const control = controlFromInput();
    if (actions & ACTION_DASH) control.dash = true;
    if (actions & ACTION_NOVA) control.nova = true;
    handleEvents(world.step(STEP, control));
  }

  // Draft number keys live here, not in input.js: they only mean
  // something on the draft screen.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyM' && screen === 'play') audio.toggleMute();
    if (screen !== 'draft') return;
    if (event.code === 'Digit1') pickDraft(0);
    if (event.code === 'Digit2') pickDraft(1);
    if (event.code === 'Digit3') pickDraft(2);
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Hover highlight on the draft cards follows the mouse.
    if (screen === 'draft') {
      const mouse = input.state;
      const rects = draftLayout();
      world.state.hoverCard = -1;
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        if (mouse.mouseX >= r.x && mouse.mouseX <= r.x + r.w && mouse.mouseY >= r.y && mouse.mouseY <= r.y + r.h) {
          world.state.hoverCard = i;
        }
      }
    }
    if (screen === 'title' || screen === 'play') {
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        step();
        accumulator -= STEP;
      }
    } else {
      step();
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, muted: audio.isMuted() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      announce('Paused.');
    }
  });

  announce('Emberward. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
