(function () {
  'use strict';

  const JUMPS = [
    { name: 'Basic Grab', emoji: '🤙', difficulty: 1, successRate: 0.80, reward: 10, damage: 10, desc: 'A clean grab — low risk, low reward.' },
    { name: '360 Spin', emoji: '🔄', difficulty: 2, successRate: 0.55, reward: 25, damage: 20, desc: 'A full rotation — style points!' },
    { name: 'Backflip', emoji: '🤸', difficulty: 3, successRate: 0.30, reward: 50, damage: 35, desc: 'Go big or go home!' }
  ];

  const SHOP = [
    { name: 'Cheese Curds', emoji: '🧀', health: 25, cost: 15, desc: 'Squeaky and restorative.' },
    { name: 'Hot Chocolate', emoji: '☕', health: 40, cost: 25, desc: 'Warms the soul, heals the body.' }
  ];

  const COLORS = [
    { name: 'Arctic Blue', primary: '#3498db', dark: '#2471a3' },
    { name: 'Fire Red', primary: '#e74c3c', dark: '#c0392b' },
    { name: 'Neon Green', primary: '#2ecc71', dark: '#1e8449' },
    { name: 'Sunset Orange', primary: '#f39c12', dark: '#d68910' }
  ];

  let state = {
    player: { name: '', colorIndex: 0, health: 100, coins: 0, totalCoins: 0, jumps: 0, successes: 0 },
    selectedJump: null,
    lastResult: null
  };

  let animCanvas, animCtx, animStart, animSuccess, animJumpIdx;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ==================== SCREENS ====================

  function showScreen(id) {
    const c = $('#game-container');
    c.classList.add('transitioning');
    setTimeout(() => {
      $$('.screen').forEach(s => s.classList.remove('active'));
      $('#screen-' + id).classList.add('active');
      c.classList.remove('transitioning');
    }, 300);
  }

  // ==================== HUD ====================

  function updateHUD() {
    $$('.hud-name-val').forEach(el => { el.textContent = state.player.name; });
    $$('.health-fill').forEach(el => {
      el.style.width = state.player.health + '%';
      if (state.player.health > 60) el.style.background = '#2ecc71';
      else if (state.player.health > 30) el.style.background = '#f39c12';
      else el.style.background = '#e74c3c';
    });
    $$('.health-text').forEach(el => { el.textContent = state.player.health; });
    $$('.coins-text').forEach(el => { el.textContent = state.player.coins; });
  }

  // ==================== SNOWFLAKES ====================

  function createSnowflakes() {
    const box = $('#snowflakes');
    for (let i = 0; i < 35; i++) {
      const f = document.createElement('div');
      f.className = 'snowflake';
      f.textContent = '❄';
      f.style.left = Math.random() * 100 + '%';
      f.style.fontSize = (Math.random() * 10 + 5) + 'px';
      f.style.opacity = Math.random() * 0.5 + 0.15;
      f.style.animationDuration = (Math.random() * 8 + 6) + 's';
      f.style.animationDelay = (Math.random() * 12) + 's';
      box.appendChild(f);
    }
  }

  // ==================== INTRO ====================

  function initIntro() {
    const opts = $('#color-options');
    opts.innerHTML = '';
    COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'color-btn' + (i === 0 ? ' selected' : '');
      b.style.background = c.primary;
      b.title = c.name;
      b.addEventListener('click', () => pickColor(i));
      opts.appendChild(b);
    });
    state.player.colorIndex = 0;
    updatePreview();

    const inp = $('#player-name');
    const btn = $('#btn-start');
    inp.value = '';
    btn.disabled = true;
    inp.addEventListener('input', () => { btn.disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !btn.disabled) startGame(); });
    btn.addEventListener('click', startGame);
    setTimeout(() => inp.focus(), 400);
  }

  function pickColor(i) {
    state.player.colorIndex = i;
    $$('.color-btn').forEach((b, idx) => b.classList.toggle('selected', idx === i));
    updatePreview();
  }

  function updatePreview() {
    $('#preview-boarder').style.color = COLORS[state.player.colorIndex].primary;
  }

  function startGame() {
    const name = $('#player-name').value.trim();
    if (!name) return;
    state.player.name = name;
    state.player.health = 100;
    state.player.coins = 0;
    state.player.totalCoins = 0;
    state.player.jumps = 0;
    state.player.successes = 0;
    state.selectedJump = null;
    state.lastResult = null;
    updateHUD();
    showScreen('hill');
    setTimeout(initHill, 350);
  }

  // ==================== HILL ====================

  function initHill() {
    state.selectedJump = null;
    updateHUD();

    const box = $('#jump-options');
    box.innerHTML = '';
    JUMPS.forEach((j, i) => {
      const card = document.createElement('div');
      card.className = 'jump-card';
      card.innerHTML =
        '<div class="jump-emoji">' + j.emoji + '</div>' +
        '<h3>' + j.name + '</h3>' +
        '<div class="jump-stats">' +
          '<span class="stat">🎯 ' + Math.round(j.successRate * 100) + '%</span>' +
          '<span class="stat">🪙 ' + j.reward + '</span>' +
          '<span class="stat">💔 -' + j.damage + '</span>' +
        '</div>' +
        '<p class="jump-desc">' + j.desc + '</p>' +
        '<div class="difficulty">' + '⭐'.repeat(j.difficulty) + '☆'.repeat(3 - j.difficulty) + '</div>';
      card.addEventListener('click', () => selectJump(i));
      box.appendChild(card);
    });

    const btn = $('#btn-jump');
    btn.disabled = true;
    btn.onclick = attemptJump;
  }

  function selectJump(i) {
    state.selectedJump = i;
    $$('.jump-card').forEach((c, idx) => c.classList.toggle('selected', idx === i));
    $('#btn-jump').disabled = false;
  }

  function attemptJump() {
    if (state.selectedJump === null) return;
    $('#btn-jump').disabled = true;

    const jump = JUMPS[state.selectedJump];
    const success = Math.random() < jump.successRate;

    state.lastResult = { jump, jumpIndex: state.selectedJump, success };
    state.player.jumps++;

    if (success) {
      state.player.successes++;
      state.player.coins += jump.reward;
      state.player.totalCoins += jump.reward;
    } else {
      state.player.health = Math.max(0, state.player.health - jump.damage);
    }

    showScreen('jump');
    setTimeout(beginJumpAnim, 400);
  }

  // ==================== JUMP ANIMATION ====================

  function beginJumpAnim() {
    animCanvas = $('#jump-canvas');
    animCtx = animCanvas.getContext('2d');

    const wrap = animCanvas.parentElement;
    const w = Math.min(wrap.clientWidth, 800);
    const h = Math.round(w * 0.5625);
    animCanvas.width = w;
    animCanvas.height = h;
    animCanvas.style.width = w + 'px';
    animCanvas.style.height = h + 'px';

    animSuccess = state.lastResult.success;
    animJumpIdx = state.lastResult.jumpIndex;
    animStart = null;

    $('#jump-title').textContent = 'Attempting: ' + state.lastResult.jump.name + ' ' + state.lastResult.jump.emoji;
    $('#jump-result').classList.add('hidden');

    requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (!animStart) animStart = ts;
    const t = Math.min((ts - animStart) / 3200, 1);
    drawScene(animCtx, t);
    if (t < 1) requestAnimationFrame(tick);
    else showJumpResult();
  }

  function slopeY(x, W, H) {
    return H * 0.33 + (x / W) * H * 0.37;
  }

  function drawScene(ctx, t) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#0b1a3b');
    sky.addColorStop(0.45, '#1a3d6d');
    sky.addColorStop(1, '#5b9bd5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(W * 0.86, H * 0.11, H * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,220,0.25)';
    ctx.beginPath(); ctx.arc(W * 0.86, H * 0.11, H * 0.1, 0, Math.PI * 2); ctx.fill();

    // mountains
    drawMtn(ctx, W * 0.0, H * 0.23, W * 0.36, '#1e3458');
    drawMtn(ctx, W * 0.26, H * 0.17, W * 0.42, '#1a2d4d');
    drawMtn(ctx, W * 0.6, H * 0.21, W * 0.44, '#162642');

    drawCap(ctx, W * 0.0, H * 0.23, W * 0.36, H * 0.035);
    drawCap(ctx, W * 0.26, H * 0.17, W * 0.42, H * 0.04);
    drawCap(ctx, W * 0.6, H * 0.21, W * 0.44, H * 0.035);

    // slope fill
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath();
    ctx.moveTo(0, slopeY(0, W, H));
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, slopeY(x, W, H));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // slope lines
    ctx.strokeStyle = '#d0dbe8';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const off = H * 0.055 * i;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const fn = x === 0 ? 'moveTo' : 'lineTo';
        ctx[fn](x, slopeY(x, W, H) + off);
      }
      ctx.stroke();
    }

    // kicker
    const kx = W * 0.33, ktx = W * 0.37;
    const kby = slopeY(kx, W, H), kh = H * 0.13;
    ctx.fillStyle = '#d5dfe9';
    ctx.beginPath();
    ctx.moveTo(kx, kby);
    ctx.quadraticCurveTo(kx + (ktx - kx) * 0.3, kby, ktx, kby - kh);
    ctx.lineTo(ktx, kby);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a0b0c0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(kx, kby);
    ctx.quadraticCurveTo(kx + (ktx - kx) * 0.3, kby, ktx, kby - kh);
    ctx.stroke();

    // trees
    [[0.07, 0.55], [0.14, 0.75], [0.83, 0.65], [0.91, 0.85], [0.96, 0.5]].forEach(([px, sc]) => {
      drawTree(ctx, W * px, slopeY(W * px, W, H), sc, W, H);
    });

    // snow particles
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 25; i++) {
      const sp = 0.3 + (i % 5) * 0.14;
      const sx = (i * 137.5 + t * 30 * (1 + i % 3)) % W;
      const sy = (i * 73.7 + t * 80 * sp) % H;
      ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }

    // trail while airborne
    if (t > 0.35 && t < 0.78) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let st = 0.35; st <= t; st += 0.008) {
        const p = boarderPos(st, W, H);
        st === 0.35 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // snowboarder
    const pos = boarderPos(t, W, H);
    const rot = boarderRot(t);
    const col = COLORS[state.player.colorIndex];
    const grab = animJumpIdx === 0 && t > 0.35 && t < 0.75;
    drawBoarder(ctx, pos.x, pos.y, rot, col.primary, col.dark, grab);

    // crash particles
    if (!animSuccess && t > 0.75) {
      const pt = (t - 0.75) / 0.25;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 / 8) * i;
        const dist = pt * 40;
        const px = pos.x + Math.cos(ang) * dist;
        const py = pos.y + Math.sin(ang) * dist * 0.6;
        const sz = 3 * (1 - pt);
        if (sz > 0) { ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }

  function drawMtn(ctx, x, peak, w, color) {
    const H = animCanvas.height;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, H); ctx.lineTo(x + w * 0.5, peak); ctx.lineTo(x + w, H);
    ctx.closePath(); ctx.fill();
  }

  function drawCap(ctx, x, peak, w, ch) {
    ctx.fillStyle = '#d4e6f1';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.36, peak + ch);
    ctx.lineTo(x + w * 0.5, peak);
    ctx.lineTo(x + w * 0.64, peak + ch);
    ctx.closePath(); ctx.fill();
  }

  function drawTree(ctx, x, by, sc) {
    const s = sc * 18;
    ctx.fillStyle = '#1a5c2e';
    for (let i = 0; i < 3; i++) {
      const ly = by - s * (i + 1) * 0.7;
      const lw = s * (1.2 - i * 0.18);
      ctx.beginPath();
      ctx.moveTo(x, ly); ctx.lineTo(x - lw, by - s * i * 0.5); ctx.lineTo(x + lw, by - s * i * 0.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#dde8f0';
    ctx.beginPath();
    ctx.moveTo(x, by - s * 2.1);
    ctx.lineTo(x - s * 0.35, by - s * 1.6);
    ctx.lineTo(x + s * 0.35, by - s * 1.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(x - s * 0.1, by, s * 0.2, s * 0.35);
  }

  function boarderPos(t, W, H) {
    const kx = W * 0.33, ktx = W * 0.37;
    const kby = slopeY(kx, W, H);
    const kty = kby - H * 0.13;
    const lx = W * 0.72, ly = slopeY(lx, W, H);
    const peakY = H * 0.06;
    const off = -14;

    if (t < 0.25) {
      const p = t / 0.25;
      const x = lerp(W * 0.04, kx, p);
      return { x, y: slopeY(x, W, H) + off };
    }
    if (t < 0.35) {
      const p = (t - 0.25) / 0.10;
      const x = lerp(kx, ktx, p);
      const y = lerp(kby, kty, p * p);
      return { x, y: y + off };
    }
    if (t < 0.75) {
      const p = (t - 0.35) / 0.40;
      const x = lerp(ktx, lx, p);
      const y = (1 - p) * (1 - p) * kty + 2 * (1 - p) * p * peakY + p * p * ly;
      return { x, y: y + off };
    }
    const p = (t - 0.75) / 0.25;
    if (animSuccess) {
      const x = lerp(lx, W * 0.89, p);
      return { x, y: slopeY(x, W, H) + off };
    }
    const x = lerp(lx, W * 0.81, p);
    const base = slopeY(x, W, H) + off;
    const bounce = Math.sin(p * Math.PI * 3) * 22 * (1 - p);
    return { x, y: base - Math.abs(bounce) };
  }

  function boarderRot(t) {
    const slope = 0.22;
    if (t < 0.25) return slope;
    if (t < 0.35) return lerp(slope, -0.3, (t - 0.25) / 0.10);
    if (t < 0.75) {
      const p = (t - 0.35) / 0.40;
      if (animJumpIdx === 0) return Math.sin(p * Math.PI) * -0.2;
      if (animJumpIdx === 1) return p * Math.PI * 2;
      return -p * Math.PI * 2;
    }
    const p = (t - 0.75) / 0.25;
    if (animSuccess) return lerp(0, slope, Math.min(p * 3, 1));
    return p * Math.PI * 5;
  }

  function drawBoarder(ctx, x, y, rot, color, dark, grab) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(2, 16, 16, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // board
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.ellipse(0, 12, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 12, 17, 3, 0, 0, Math.PI * 2); ctx.fill();

    // legs
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(-4, 0); ctx.moveTo(4, 10); ctx.lineTo(4, 0); ctx.stroke();

    // body
    ctx.fillStyle = color;
    ctx.fillRect(-7, -16, 14, 18);

    // arms
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    if (grab) {
      ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(-12, 6); ctx.moveTo(7, -8); ctx.lineTo(12, 6); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(-15, -4); ctx.moveTo(7, -10); ctx.lineTo(15, -4); ctx.stroke();
    }

    // head
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(0, -22, 7, 0, Math.PI * 2); ctx.fill();

    // helmet
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, -23, 7, Math.PI * 1.15, -Math.PI * 0.15); ctx.fill();

    // goggles
    ctx.fillStyle = '#f1c40f'; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -22, 5.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function showJumpResult() {
    updateHUD();
    const r = state.lastResult;
    const el = $('#jump-result');
    el.classList.remove('hidden');

    if (r.success) {
      $('#result-text').textContent = '🎉 Nailed it!';
      $('#result-text').className = 'result-success';
      $('#result-detail').textContent = '+' + r.jump.reward + ' coins for the ' + r.jump.name + '!';
    } else {
      $('#result-text').textContent = '💥 Wipeout!';
      $('#result-text').className = 'result-fail';
      $('#result-detail').textContent = '-' + r.jump.damage + ' health. That\'s gonna leave a mark!';
    }

    const btn = $('#btn-to-chalet');
    if (state.player.health <= 0) {
      btn.textContent = 'Game Over...';
      btn.onclick = () => { showScreen('gameover'); setTimeout(initGameOver, 350); };
    } else {
      btn.textContent = 'Head to the Chalet 🏔️';
      btn.onclick = () => { showScreen('chalet'); setTimeout(initChalet, 350); };
    }
  }

  // ==================== CHALET ====================

  function initChalet() {
    updateHUD();

    const msg = $('#chalet-message');
    if (state.lastResult.success) {
      msg.innerHTML = '<span class="msg-success">Great ' + state.lastResult.jump.name + '! 🎉</span> You earned <strong>' + state.lastResult.jump.reward + ' coins</strong>.';
    } else {
      msg.innerHTML = '<span class="msg-fail">Tough break on the ' + state.lastResult.jump.name + '.</span> You lost <strong>' + state.lastResult.jump.damage + ' health</strong>. Time to refuel!';
    }

    renderShop();

    $('#stat-jumps').textContent = state.player.jumps;
    $('#stat-successes').textContent = state.player.successes;
    $('#btn-to-hill').onclick = () => { showScreen('hill'); setTimeout(initHill, 350); };
  }

  function renderShop() {
    const box = $('#shop-items');
    box.innerHTML = '';
    SHOP.forEach((item, i) => {
      const canBuy = state.player.coins >= item.cost && state.player.health < 100;
      const card = document.createElement('div');
      card.className = 'shop-card' + (canBuy ? '' : ' disabled');
      card.innerHTML =
        '<div class="shop-emoji">' + item.emoji + '</div>' +
        '<h4>' + item.name + '</h4>' +
        '<p class="shop-desc">' + item.desc + '</p>' +
        '<div class="shop-stats"><span>❤️ +' + item.health + '</span><span>🪙 ' + item.cost + '</span></div>' +
        '<button class="btn btn-shop"' + (canBuy ? '' : ' disabled') + '>Buy</button>';
      card.querySelector('.btn-shop').addEventListener('click', () => buyItem(i));
      box.appendChild(card);
    });
  }

  function buyItem(i) {
    const item = SHOP[i];
    if (state.player.coins >= item.cost && state.player.health < 100) {
      state.player.coins -= item.cost;
      state.player.health = Math.min(100, state.player.health + item.health);
      updateHUD();
      renderShop();
    }
  }

  // ==================== GAME OVER ====================

  function initGameOver() {
    $('#final-name').textContent = state.player.name;
    $('#final-jumps').textContent = state.player.jumps;
    $('#final-successes').textContent = state.player.successes;
    $('#final-coins').textContent = state.player.totalCoins;
    $('#btn-restart').onclick = () => {
      showScreen('intro');
      setTimeout(() => $('#player-name').focus(), 400);
    };
  }

  // ==================== INIT ====================

  function init() {
    createSnowflakes();
    initIntro();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
