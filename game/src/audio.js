// Synthesized sound only — no audio files, no network. WebAudio oscillators and noise
// buffers, created lazily on the first user gesture (browsers block audio before that).
export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain || 0.12;
    let node = src;
    if (lowpass) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    shoot() { noise(0.09, 0.16, 2400); tone(180, 0.08, 'square', 0.06, 60); },
    punch() { noise(0.06, 0.12, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.09); tone(990, 0.12, 'sine', 0.09); },
    cash() { tone(880, 0.08, 'sine', 0.09); setTimeout(() => tone(1320, 0.14, 'sine', 0.09), 80); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.1), i * 110)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.07), i * 160)); },
    crash() { noise(0.18, 0.18, 500); },
    enterCar() { tone(140, 0.12, 'square', 0.06, 220); },
    /** A short two-tone siren blip while wanted; call every frame, it self-throttles. */
    siren(dt) {
      sirenTimer -= dt;
      if (sirenTimer > 0) return;
      sirenTimer = 0.9;
      tone(700, 0.28, 'sine', 0.035, 950);
      setTimeout(() => tone(950, 0.28, 'sine', 0.035, 700), 300);
    },
  };
}
