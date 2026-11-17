// Every sound is synthesised with WebAudio: no audio files, no network,
// nothing to load. The context starts on the first user gesture; until then
// every call is a silent no-op, so the screenshot scenes stay quiet and the
// game never throws for a missing gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A minor-pentatonic walk over a low drone: calm under the title, driving
  // enough under play. One quiet note every beat, never a melody to learn.
  const MELODY = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, -2];
  const BASE = 220;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted || ctx.state !== 'running') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // A sound failing never fails the game.
    }
  }

  function noise(dur, vol, low) {
    if (!ctx || muted || ctx.state !== 'running') return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // As above.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!musicTimer) {
        musicTimer = setInterval(() => {
          if (!ctx || muted || ctx.state !== 'running') return;
          const note = MELODY[musicStep % MELODY.length];
          musicStep += 1;
          const freq = BASE * Math.pow(2, note / 12);
          tone(freq, 0.5, 'sine', 0.045);
          if (musicStep % 4 === 0) tone(BASE / 2, 1.2, 'triangle', 0.05);
        }, 300);
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() { tone(720 + Math.random() * 120, 0.09, 'square', 0.05, 240); },
    hit() { noise(0.06, 0.08, 2400); },
    enemyDie() { tone(320, 0.18, 'sawtooth', 0.07, 60); noise(0.12, 0.06, 900); },
    pickup() { tone(880, 0.12, 'sine', 0.08, 1320); },
    hurt() { tone(140, 0.3, 'sawtooth', 0.12, 50); noise(0.2, 0.1, 500); },
    dash() { noise(0.16, 0.07, 3000); },
    nova() { tone(180, 0.5, 'sine', 0.14, 900); noise(0.4, 0.1, 800); },
    waveHorn() { tone(196, 0.5, 'triangle', 0.1); tone(294, 0.5, 'triangle', 0.08); },
    bossRoar() { tone(90, 0.8, 'sawtooth', 0.14, 40); noise(0.6, 0.1, 400); },
    draft() { tone(523, 0.15, 'sine', 0.08); tone(784, 0.2, 'sine', 0.08); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.1), i * 140)); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.09), i * 160)); },
  };
}
