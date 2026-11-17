// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (start, pause, enter a car, punch, shoot, mute, continue) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and never
// counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_CONTINUE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['Space']);
const MUTE = new Set(['KeyM']);
const CONTINUE = new Set(['KeyC']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  function press(event, flag) {
    if (!event.repeat) actions |= flag;
    event.preventDefault();
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) press(event, ACTION_CONFIRM);
    else if (PAUSE.has(event.code)) press(event, ACTION_PAUSE);
    else if (ENTER.has(event.code)) press(event, ACTION_ENTER);
    else if (PUNCH.has(event.code)) press(event, ACTION_PUNCH);
    else if (SHOOT.has(event.code)) press(event, ACTION_SHOOT);
    else if (MUTE.has(event.code)) press(event, ACTION_MUTE);
    else if (CONTINUE.has(event.code)) press(event, ACTION_CONTINUE);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, components in [-1, 1] (x right, y down). */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      if (x !== 0 && y !== 0) return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 };
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
