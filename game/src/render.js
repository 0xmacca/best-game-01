// Everything the eye sees: the night field, the warden, the five enemy
// kinds, the two bosses, the shots, the pickups and the particles, then the
// HUD and the five screens. The renderer never changes the world; it reads
// the state and paints it. Logical field 960x540, scaled to the window.
import { COMBO_WINDOW, ENEMIES, BOSSES, FIELD, ORBIT_RADIUS, ORBIT_SPEED, PALETTE, PLAYER } from './config.js';

export function draftLayout() {
  const w = 230;
  const h = 150;
  const gap = 24;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 210;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let ox = 0;
  let oy = 0;

  // A fixed starfield, drawn from the same seed every run.
  const stars = [];
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: rnd() * 1.4 + 0.4, p: rnd() * 6.28 });
  }
  // Fixed arena dressing, drawn from the same seed every run: four
  // corner braziers and a few faint rune rings on the floor, so the
  // field never reads as an empty void.
  const runes = [];
  for (let i = 0; i < 6; i += 1) {
    runes.push({ x: 120 + rnd() * (FIELD.width - 240), y: 110 + rnd() * (FIELD.height - 220), r: 24 + rnd() * 16, p: rnd() * 6.28 });
  }
  const braziers = [
    { x: 72, y: 130 }, { x: FIELD.width - 72, y: 130 },
    { x: 72, y: FIELD.height - 72 }, { x: FIELD.width - 72, y: FIELD.height - 72 },
  ];
  // Slow ember motes drifting up through the field, so the air itself
  // reads as alive even where no enemy stands.
  const embers = [];
  for (let i = 0; i < 16; i += 1) {
    embers.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: rnd() * 2 + 1, s: rnd() * 9 + 4, p: rnd() * 6.28, c: ['#ffb347', '#5ef2e0', '#b388ff'][i % 3] });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ox = (canvas.width - FIELD.width * scale) / 2;
    oy = (canvas.height - FIELD.height * scale) / 2;
  }

  function toLogical(px, py) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { x: (px * dpr - ox) / scale, y: (py * dpr - oy) / scale };
  }

  function circle(x, y, r, color, glow) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const st of stars) {
      const tw = 0.35 + 0.3 * Math.sin(state.time * 1.5 + st.p);
      ctx.globalAlpha = tw;
      circle(st.x, st.y, st.r, '#cdd6ff', 0);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 60; x < FIELD.width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
    }
    for (let y = 60; y < FIELD.height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
    }
    const v = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Drifting ember motes.
    for (const e of embers) {
      const y = ((e.y - state.time * e.s) % FIELD.height + FIELD.height) % FIELD.height;
      ctx.globalAlpha = 0.2 + 0.18 * Math.sin(state.time * 1.2 + e.p);
      circle(e.x, y, e.r, e.c, 6);
    }
    ctx.globalAlpha = 1;
    // Faint rune rings on the floor.
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.14)';
    ctx.lineWidth = 1.5;
    for (const ru of runes) {
      ctx.beginPath();
      ctx.arc(ru.x, ru.y, ru.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ru.x, ru.y, ru.r * 0.55, ru.p, ru.p + 4.2);
      ctx.stroke();
    }
    // Corner braziers: stone cup, flickering flame, warm glow.
    for (const b of braziers) {
      const fl = 1 + Math.sin(state.time * 7 + b.x) * 0.18;
      const glow = ctx.createRadialGradient(b.x, b.y - 6, 2, b.x, b.y - 6, 46);
      glow.addColorStop(0, 'rgba(255, 179, 71, 0.28)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(b.x - 46, b.y - 52, 92, 92);
      ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(b.x - 10, b.y + 2, 20, 10);
      ctx.fillStyle = '#3d4364';
      ctx.fillRect(b.x - 13, b.y - 2, 26, 6);
      ctx.beginPath();
      ctx.moveTo(b.x - 6 * fl, b.y - 2);
      ctx.quadraticCurveTo(b.x - 3, b.y - 18 * fl, b.x, b.y - 22 * fl);
      ctx.quadraticCurveTo(b.x + 3, b.y - 18 * fl, b.x + 6 * fl, b.y - 2);
      ctx.closePath();
      ctx.fillStyle = '#ffb347';
      ctx.shadowColor = '#ff7a1a';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // The night deepens as the waves climb: a faint tint past wave 4,
    // ember-warm past wave 7, so later waves read as a different place.
    if (state.wave >= 7) {
      ctx.fillStyle = 'rgba(255, 122, 26, 0.05)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    } else if (state.wave >= 4) {
      ctx.fillStyle = 'rgba(94, 242, 224, 0.03)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return;
    const flick = 1 + Math.sin(state.time * 9) * 0.08;
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 52);
    glow.addColorStop(0, 'rgba(94, 242, 224, 0.35)');
    glow.addColorStop(1, 'rgba(94, 242, 224, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 52, p.y - 52, 104, 104);
    circle(p.x, p.y, PLAYER.radius * flick, PALETTE.player, 18);
    circle(p.x, p.y, 7, PALETTE.playerCore, 10);
    // The flame on top of the lantern, leaning toward the aim.
    const fx = p.x + Math.cos(p.angle) * 20;
    const fy = p.y + Math.sin(p.angle) * 20;
    ctx.beginPath();
    ctx.moveTo(fx + Math.cos(p.angle + 2.4) * 7, fy + Math.sin(p.angle + 2.4) * 7);
    ctx.lineTo(fx + Math.cos(p.angle) * 14, fy + Math.sin(p.angle) * 14);
    ctx.lineTo(fx + Math.cos(p.angle - 2.4) * 7, fy + Math.sin(p.angle - 2.4) * 7);
    ctx.closePath();
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    // Dash readiness as a ring under the warden.
    if (p.dashCd > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 7, -Math.PI / 2, -Math.PI / 2 + (1 - p.dashCd / 1.5) * Math.PI * 2);
      ctx.strokeStyle = 'rgba(94, 242, 224, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawEnemy(state, e) {
    const def = e.boss ? BOSSES[e.kind] : ENEMIES[e.kind];
    const t = state.time;
    if (e.boss) {
      const pulse = 1 + Math.sin(t * 4) * 0.04;
      const glow = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, e.radius * 2.4);
      glow.addColorStop(0, def.color + '55');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(e.x - e.radius * 2.4, e.y - e.radius * 2.4, e.radius * 4.8, e.radius * 4.8);
      circle(e.x, e.y, e.radius * pulse, def.color, 24);
      // Crown of horns.
      ctx.fillStyle = '#2a0a2e';
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + t * 0.3;
        const hx = e.x + Math.cos(a) * (e.radius + 8);
        const hy = e.y + Math.sin(a) * (e.radius + 8);
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a - 0.18) * e.radius * 0.8, e.y + Math.sin(a - 0.18) * e.radius * 0.8);
        ctx.lineTo(hx, hy);
        ctx.lineTo(e.x + Math.cos(a + 0.18) * e.radius * 0.8, e.y + Math.sin(a + 0.18) * e.radius * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      circle(e.x - e.radius * 0.35, e.y - 4, 5, '#fff', 8);
      circle(e.x + e.radius * 0.35, e.y - 4, 5, '#fff', 8);
      circle(e.x - e.radius * 0.35, e.y - 4, 2.4, '#111', 0);
      circle(e.x + e.radius * 0.35, e.y - 4, 2.4, '#111', 0);
    } else if (e.kind === 'mote') {
      const spikes = 8;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i += 1) {
        const a = (i / (spikes * 2)) * Math.PI * 2 + t * 1.5;
        const r = i % 2 === 0 ? e.radius : e.radius * 0.55;
        const x = e.x + Math.cos(a) * r;
        const y = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      circle(e.x, e.y, e.radius * 0.45, '#2a0a2e', 0);
    } else if (e.kind === 'spitter') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 4 + Math.sin(t * 2) * 0.15);
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 12;
      ctx.fillRect(-e.radius * 0.75, -e.radius * 0.75, e.radius * 1.5, e.radius * 1.5);
      ctx.restore();
      ctx.shadowBlur = 0;
      circle(e.x, e.y, 4, '#0d2b12', 0);
    } else if (e.kind === 'brute') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const x = e.x + Math.cos(a) * e.radius;
        const y = e.y + Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      circle(e.x, e.y, e.radius * 0.45, '#3d0a0a', 0);
    } else if (e.kind === 'splitter') {
      circle(e.x - 6, e.y, e.radius * 0.7, def.color, 10);
      circle(e.x + 6, e.y, e.radius * 0.7, def.color, 10);
      circle(e.x, e.y, 3, '#fff', 0);
    } else if (e.kind === 'wisp') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * 1.7, e.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    } else if (e.kind === 'bloom') {
      // A rooted pink flower, pulsing as it breeds.
      const pulse = 1 + Math.sin(t * 3 + e.wobble) * 0.12;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + t * 0.5;
        circle(e.x + Math.cos(a) * e.radius * 0.75 * pulse, e.y + Math.sin(a) * e.radius * 0.75 * pulse, e.radius * 0.42, def.color, 10);
      }
      circle(e.x, e.y, e.radius * 0.5, '#ffd6f2', 8);
      circle(e.x, e.y, e.radius * 0.22, '#7a1e4d', 0);
    }
    // Gilded elites wear a gold ring, so the player spots them instantly.
    if (e.elite && !e.boss) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash * 8);
      circle(e.x, e.y, e.radius, '#ffffff', 0);
      ctx.globalAlpha = 1;
    }
    // A thin health bar over anything tougher than a mote.
    if (e.maxHp > 1) {
      const w = e.radius * 2;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
      ctx.fillStyle = ratio > 0.5 ? '#7dff6a' : ratio > 0.25 ? '#ffd166' : '#ff5d5d';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * ratio, 4);
    }
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const blink = pk.life < 2 ? (Math.floor(state.time * 8) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.globalAlpha = blink;
      if (pk.kind === 'ember') {
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.rotate(pk.t);
        ctx.fillStyle = PALETTE.ember;
        ctx.shadowColor = PALETTE.ember;
        ctx.shadowBlur = 10;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
        ctx.shadowBlur = 0;
      } else if (pk.kind === 'heart') {
        circle(pk.x - 4, pk.y - 2, 5, PALETTE.heart, 8);
        circle(pk.x + 4, pk.y - 2, 5, PALETTE.heart, 8);
        ctx.beginPath();
        ctx.moveTo(pk.x - 8, pk.y);
        ctx.lineTo(pk.x + 8, pk.y);
        ctx.lineTo(pk.x, pk.y + 9);
        ctx.closePath();
        ctx.fillStyle = PALETTE.heart;
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.rotate(pk.t * 1.5);
        ctx.fillStyle = PALETTE.nova;
        ctx.shadowColor = PALETTE.nova;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2;
          const r = i % 2 === 0 ? 10 : 4;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(state) {
    for (const b of state.bullets) circle(b.x, b.y, b.radius, PALETTE.bullet, 10);
    for (const b of state.ebullets) circle(b.x, b.y, b.radius, '#ff4d9d', 10);
    drawPickups(state);
    for (const e of state.enemies) drawEnemy(state, e);
    // Orbiting embers circle the warden on their fixed ring.
    if (state.player.upgrades.orbit > 0) {
      const n = state.player.upgrades.orbit;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, ORBIT_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 179, 71, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < n; i += 1) {
        const a = state.time * ORBIT_SPEED + (i * Math.PI * 2) / n;
        const ox = state.player.x + Math.cos(a) * ORBIT_RADIUS;
        const oy = state.player.y + Math.sin(a) * ORBIT_RADIUS;
        circle(ox, oy, 10, '#ffb347', 16);
        circle(ox, oy, 4.5, '#fff3d6', 8);
      }
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      circle(pt.x, pt.y, pt.size, pt.color, 0);
    }
    ctx.globalAlpha = 1;
    drawPlayer(state);
    ctx.textAlign = 'center';
    for (const f of state.floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function heart(x, y, filled, size) {
    ctx.fillStyle = filled ? PALETTE.heart : 'rgba(255,107,129,0.22)';
    circle(x - size * 0.35, y - size * 0.15, size * 0.42, ctx.fillStyle, 0);
    circle(x + size * 0.35, y - size * 0.15, size * 0.42, ctx.fillStyle, 0);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.72, y - size * 0.05);
    ctx.lineTo(x + size * 0.72, y - size * 0.05);
    ctx.lineTo(x, y + size * 0.75);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud(state, ui) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(state.score).padStart(6, '0'), 18, 36);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`BEST ${Math.max(ui.best, state.score)}`, 18, 56);
    if (state.combo > 1) {
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`x${Math.min(state.combo, 8)} COMBO`, 18, 84);
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      ctx.fillRect(18, 92, 110, 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(18, 92, 110 * Math.max(0, state.comboTimer / COMBO_WINDOW), 5);
    }
    ctx.textAlign = 'center';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`WAVE ${Math.min(state.wave, 10)} / 10`, FIELD.width / 2, 32);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(state.waveState === 'banner' ? 'GET READY' : `${state.enemies.length + state.spawnQueue.length} FOES LEFT`, FIELD.width / 2, 50);
    // Hearts, nova charges, dash.
    for (let i = 0; i < p.maxHp; i += 1) heart(FIELD.width - 24 - i * 30, 30, i < p.hp, 11);
    for (let i = 0; i < p.novaMax; i += 1) {
      ctx.fillStyle = i < p.nova ? PALETTE.nova : 'rgba(199,125,255,0.22)';
      ctx.save();
      ctx.translate(FIELD.width - 24 - i * 26, 58);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
    // Dash readiness, under the score on the left: label + recharge bar,
    // clear of the top-right hearts and the brazier glow.
    ctx.textAlign = 'left';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = p.dashCd <= 0 ? '#5ef2e0' : PALETTE.dim;
    ctx.fillText('DASH', 18, 116);
    ctx.fillStyle = 'rgba(94, 242, 224, 0.25)';
    ctx.fillRect(62, 108, 52, 5);
    ctx.fillStyle = '#5ef2e0';
    ctx.fillRect(62, 108, 52 * Math.max(0, 1 - p.dashCd / 1.5), 5);
    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      const def = BOSSES[b.kind];
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const y = FIELD.height - 46;
      ctx.textAlign = 'center';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffb3d9';
      ctx.fillText(def.name, FIELD.width / 2, y - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = def.color;
      ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 10);
    }
    if (state.waveState === 'banner' && state.wave > 0) {
      ctx.textAlign = 'center';
      ctx.font = '800 54px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(242,244,255,0.92)';
      ctx.fillText(state.boss && state.waveState === 'banner' ? BOSSES[state.boss.kind].name : `WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 40);
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(state.wave === 10 ? 'The Hollow King wakes. End this.' : state.boss ? 'Something huge stirs in the dark.' : 'Hold the light.', FIELD.width / 2, FIELD.height / 2 - 12);
    }
    // A dark strip keeps the footer readable when a pickup drifts low.
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    ctx.fillRect(0, FIELD.height - 28, FIELD.width, 28);
    ctx.textAlign = 'left';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(154,163,199,0.75)';
    ctx.fillText('WASD move · Mouse aim · Hold click shoot · Shift dash · E nova · P pause · M mute', 18, FIELD.height - 14);
  }

  function dimOverlay(alpha) {
    ctx.fillStyle = `rgba(4, 5, 14, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, ui) {
    drawWorld(state);
    dimOverlay(0.45);
    ctx.textAlign = 'center';
    const glow = ctx.createRadialGradient(FIELD.width / 2, 150, 10, FIELD.width / 2, 150, 260);
    glow.addColorStop(0, 'rgba(255,179,71,0.22)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(FIELD.width / 2 - 260, 0, 520, 300);
    ctx.font = '800 72px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 26;
    ctx.fillText('EMBERWARD', FIELD.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Keep the last lantern lit. Ten waves. Two bosses. One dawn.', FIELD.width / 2, 204);
    if (ui.best > 0) {
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`BEST SCORE  ${ui.best}`, FIELD.width / 2, 238);
    }
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillStyle = '#5ef2e0';
    ctx.fillText('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 300);
    ctx.globalAlpha = 1;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click — shoot', FIELD.width / 2, 348);
    ctx.fillText('Shift — dash through danger      E — nova burst      P — pause      M — mute', FIELD.width / 2, 372);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('WIN — Beat wave 10 and unmake the Hollow King.', FIELD.width / 2, 398);
    ctx.fillStyle = '#ff8ba0';
    ctx.fillText('LOSE — If your lantern goes out, the dark takes the dawn.', FIELD.width / 2, 422);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('Between waves, pick one upgrade. Six foes: motes chase, spitters shoot, brutes endure, splitters split, wisps dash, blooms breed motes.', FIELD.width / 2, 446);
  }

  function drawPause() {
    dimOverlay(0.6);
    ctx.textAlign = 'center';
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('P or Esc to resume  ·  M to mute', FIELD.width / 2, FIELD.height / 2 + 28);
  }

  function drawDraft(state) {
    dimOverlay(0.62);
    ctx.textAlign = 'center';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('CHOOSE AN UPGRADE', FIELD.width / 2, 168);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`Wave ${state.wave} cleared — press 1, 2 or 3, or click a card.`, FIELD.width / 2, 194);
    const rects = draftLayout();
    state.draft.forEach((card, i) => {
      const r = rects[i];
      const hover = state.hoverCard === i;
      ctx.fillStyle = hover ? 'rgba(94, 242, 224, 0.16)' : 'rgba(13, 16, 48, 0.9)';
      ctx.strokeStyle = hover ? '#5ef2e0' : 'rgba(154,163,199,0.45)';
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5ef2e0';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 30);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillText(card.name, r.x + r.w / 2, r.y + 62);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '600 14px system-ui, sans-serif';
      const words = card.desc.split(' ');
      let line = '';
      let ly = r.y + 92;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          ctx.fillText(line.trim(), r.x + r.w / 2, ly);
          line = word;
          ly += 19;
        } else {
          line += ' ' + word;
        }
      }
      ctx.fillText(line.trim(), r.x + r.w / 2, ly);
    });
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawStar(x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ff7a1a';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(154,163,199,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawStats(state, ui, rows, y0) {
    ctx.textAlign = 'center';
    ctx.font = '600 17px system-ui, sans-serif';
    let y = y0;
    for (const [label, value] of rows) {
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(label, FIELD.width / 2 - 110, y);
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'left';
      ctx.fillText(String(value), FIELD.width / 2 - 40, y);
      ctx.textAlign = 'center';
      y += 28;
    }
    void ui;
  }

  function drawOver(state, ui) {
    drawWorld(state);
    dimOverlay(0.62);
    ctx.textAlign = 'center';
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.fillStyle = '#ff6b81';
    ctx.fillText('THE LIGHT GOES OUT', FIELD.width / 2, 150);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`The dark took the lantern on wave ${state.wave}.`, FIELD.width / 2, 182);
    const acc = state.shotsFired > 0 ? Math.round((state.hits / state.shotsFired) * 100) : 0;
    drawStats(state, ui, [
      ['SCORE', state.score],
      ['BEST', Math.max(ui.best, state.score)],
      ['WAVE', `${state.wave} / 10`],
      ['FOES FELLED', state.kills],
      ['MAX COMBO', `x${Math.max(1, state.maxCombo || 0)}`],
      ['TIME', fmtTime(state.time)],
      ['ACCURACY', `${acc}%`],
    ], 232);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = '#5ef2e0';
    ctx.fillText('PRESS SPACE OR CLICK TO TRY AGAIN', FIELD.width / 2, 436);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, ui) {
    drawWorld(state);
    dimOverlay(0.5);
    ctx.textAlign = 'center';
    const glow = ctx.createRadialGradient(FIELD.width / 2, 150, 10, FIELD.width / 2, 150, 280);
    glow.addColorStop(0, 'rgba(255,209,102,0.25)');
    glow.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(FIELD.width / 2 - 280, 0, 560, 320);
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 24;
    ctx.fillText('THE DAWN RETURNS', FIELD.width / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('The Hollow King is unmade. The lantern burns on.', FIELD.width / 2, 182);
    const acc = state.shotsFired > 0 ? Math.round((state.hits / state.shotsFired) * 100) : 0;
    // Stars for the run: one for the win, more for accuracy.
    const stars = acc >= 50 ? 3 : acc >= 35 ? 2 : 1;
    for (let i = 0; i < 3; i += 1) drawStar(FIELD.width / 2 + (i - 1) * 46, 208, 12, i < stars);
    drawStats(state, ui, [
      ['SCORE', state.score],
      ['BEST', Math.max(ui.best, state.score)],
      ['FOES FELLED', state.kills],
      ['MAX COMBO', `x${Math.max(1, state.maxCombo || 0)}`],
      ['TIME', fmtTime(state.time)],
      ['ACCURACY', `${acc}%`],
    ], 244);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = '#5ef2e0';
    ctx.fillText('SPACE — PLAY AGAIN      E — ENDLESS MODE', FIELD.width / 2, 412);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, ui) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 0.5 : 0;
    const sy = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 0.5 : 0;
    ctx.setTransform(scale, 0, 0, scale, ox + sx * scale, oy + sy * scale);
    ctx.textBaseline = 'alphabetic';
    if (screen === 'title') {
      drawBackground(state);
      drawTitle(state, ui);
    } else if (screen === 'pause') {
      drawBackground(state);
      drawWorld(state);
      drawHud(state, ui);
      drawPause();
    } else if (screen === 'draft') {
      drawBackground(state);
      drawWorld(state);
      drawHud(state, ui);
      drawDraft(state);
    } else if (screen === 'over') {
      drawBackground(state);
      drawOver(state, ui);
    } else if (screen === 'win') {
      drawBackground(state);
      drawWin(state, ui);
    } else {
      drawBackground(state);
      drawWorld(state);
      drawHud(state, ui);
    }
  }

  return { draw, resize, toLogical };
}
