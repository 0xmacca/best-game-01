// Keyboard and mouse, read as state, not events: the world asks each step
// what is held, so a held key keeps working and a tap is never lost between
// frames. Actions are edge-triggered bits the loop consumes once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_NOVA = 8;

export function createInput(canvas, toLogical) {
  const keys = new Set();
  const state = {
    moveX: 0,
    moveY: 0,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
  };
  let actions = 0;

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toLogical(event.clientX - rect.left, event.clientY - rect.top);
    state.mouseX = point.x;
    state.mouseY = point.y;
  }

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') actions |= ACTION_DASH;
    if (event.code === 'KeyE') actions |= ACTION_NOVA;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', (event) => {
    trackMouse(event);
    state.mouseDown = true;
    if (event.button === 2) actions |= ACTION_NOVA;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.mouseDown = false;
  });
  canvas.addEventListener('click', (event) => {
    trackMouse(event);
    state.clicked = true;
    state.clickX = state.mouseX;
    state.clickY = state.mouseY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    state,
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    dashHeld() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    shooting() {
      return state.mouseDown || keys.has('KeyJ');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const was = state.clicked;
      state.clicked = false;
      return was ? { x: state.clickX, y: state.clickY } : null;
    },
  };
}
