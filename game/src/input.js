// Keyboard + mouse input. Held keys steer; one-shot presses (interact, melee, shoot,
// pause, confirm) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;
export const ACTION_SHOOT = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MELEE = new Set(['KeyF']);
const SHOOT = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (MELEE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MELEE;
    } else if (SHOOT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SHOOT;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, down: true };
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  target.addEventListener('pointerup', () => { mouse.down = false; });

  const has = (set) => [...set].some((code) => held.has(code));

  return {
    move() {
      return { x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0), y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0) };
    },
    mouse() { return mouse; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
