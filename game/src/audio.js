// Every sound is synthesized with WebAudio — no audio files, no network. The
// engine is a low oscillator whose pitch follows driving speed, the siren is two
// alternating tones, and the rest are short envelopes. All of it is guarded: if
// the browser blocks audio until a gesture, sounds simply start after the first
// key press, and nothing here can ever break the game.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  return {
    /** Call on any user gesture so the context is allowed to start. */
    unlock() {
      resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.35;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 2400);
      tone(180, 0.08, 'square', 0.2, 60);
    },
    punch() {
      noise(0.08, 0.35, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      tone(990, 0.12, 'sine', 0.25);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.3);
      tone(1174, 0.08, 'triangle', 0.3);
      tone(1568, 0.16, 'triangle', 0.3);
    },
    mission() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.18, 'triangle', 0.3), i * 110);
      });
    },
    busted() {
      tone(392, 0.3, 'sawtooth', 0.25, 196);
      setTimeout(() => tone(311, 0.5, 'sawtooth', 0.25, 155), 300);
    },
    wasted() {
      tone(220, 0.4, 'sawtooth', 0.3, 110);
      setTimeout(() => tone(165, 0.7, 'sawtooth', 0.3, 82), 380);
    },
    hit() {
      tone(140, 0.1, 'square', 0.3, 90);
    },
    /** Called every frame with the driving state: keeps the engine hum and siren going. */
    update(dt, driving, speedRatio, wanted) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (driving) {
        if (!engineOsc) {
          try {
            engineOsc = context.createOscillator();
            engineOsc.type = 'sawtooth';
            engineGain = context.createGain();
            engineGain.gain.value = 0;
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            engineOsc.connect(filter);
            filter.connect(engineGain);
            engineGain.connect(master);
            engineOsc.start();
          } catch {
            engineOsc = null;
          }
        }
        if (engineOsc) {
          engineOsc.frequency.setValueAtTime(55 + speedRatio * 130, context.currentTime);
          engineGain.gain.setValueAtTime(0.05 + speedRatio * 0.06, context.currentTime);
        }
      } else if (engineGain) {
        engineGain.gain.value = 0;
      }
      if (wanted > 0) {
        sirenTimer -= dt;
        if (sirenTimer <= 0) {
          sirenTimer = 0.42;
          sirenHigh = !sirenHigh;
          tone(sirenHigh ? 880 : 660, 0.4, 'sine', 0.07);
        }
      }
    },
  };
}
