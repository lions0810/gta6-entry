// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
// Progress (money and mission) autosaves to localStorage on every mission and on
// every bust or waste, and the title screen offers to continue it.
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { CAR, SAVE_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED } from './world.js';
import {
  ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE,
  ACTION_PUNCH, ACTION_SHOOT, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

// Debug and playtest handle: the live world state, by reference.
window.__sunset = { state: world.state, world };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.snapshotSave()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do when storage is off.
  }
}

function saveInfo() {
  const save = readSave();
  if (!save) return { hasSave: false, money: 0, missionIndex: 0, storyDone: false };
  return { hasSave: true, money: save.money, missionIndex: save.missionIndex, storyDone: !!save.storyDone };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, saveInfo());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    const save = continueSave ? readSave() : null;
    world.reset();
    if (save) world.applySave(save);
    else clearSave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    const mission = world.state.missionIndex + 1;
    announce(`Playing. Mission ${Math.min(mission, 5)} of 5.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    writeSave();
    if (world.state.endKind === 'busted') {
      audio.busted();
      announce(`Busted. You keep $${world.state.player.money}.`);
    } else {
      audio.wasted();
      announce(`Wasted. You keep $${world.state.player.money}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && saveInfo().hasSave) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame(false);
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(true);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0 }, actions: 0 }, true);
      return;
    }
    const move = input.move();
    const events = world.step(STEP, { move, actions }, false);
    if (events & EVENT_MISSION) {
      audio.mission();
      writeSave();
    }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_BUSTED || events & EVENT_WASTED) endGame();
    audio.update(
      STEP,
      !!world.state.player.inCar,
      world.state.player.inCar ? Math.abs(world.state.player.inCar.speed) / CAR.maxSpeed : 0,
      world.state.wanted,
    );
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses apply to the first sub-step only, never twice in a frame.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, saveInfo());
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunset Bay. Press Enter to start, or C to continue a saved story.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
