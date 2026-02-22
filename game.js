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

  const GEAR = [
    { id: 'boots', name: 'Pro Boots', emoji: '🥾', cost: 30, desc: '+8% success on all tricks' },
    { id: 'board', name: 'Carbon Board', emoji: '🏂', cost: 40, desc: '+5 bonus coins per trick' },
    { id: 'helmet', name: 'Safety Helmet', emoji: '⛑️', cost: 35, desc: '-8 crash damage' }
  ];

  const HILLS = [
    { name: 'Bunny Hill', emoji: '🐰', successMod: 1.15, rewardMod: 0.7, damageMod: 0.6, desc: 'Gentle slopes — lower risk, lower reward.' },
    { name: 'Black Diamond', emoji: '◆', successMod: 1.0, rewardMod: 1.0, damageMod: 1.0, desc: 'Balanced risk and reward.' },
    { name: 'Double Black', emoji: '💀', successMod: 0.75, rewardMod: 2.0, damageMod: 1.5, desc: 'Extreme terrain — huge payoff, huge pain.' }
  ];

  const WEATHER = [
    { name: 'Sunny', emoji: '☀️', successMod: 1.05, rewardMod: 1.0, desc: 'Bluebird day — great visibility!',
      sky: ['#0a2a5e', '#2a6dbf', '#87ceeb'], sun: true, snowCount: 8, fog: 0, wind: 0 },
    { name: 'Clear', emoji: '❄️', successMod: 1.0, rewardMod: 1.0, desc: 'Crisp winter air — standard conditions.',
      sky: ['#0b1a3b', '#1a3d6d', '#5b9bd5'], sun: true, snowCount: 25, fog: 0, wind: 0 },
    { name: 'Snowfall', emoji: '🌨️', successMod: 0.92, rewardMod: 1.0, desc: 'Heavy snow — watch your footing!',
      sky: ['#2c3e50', '#546e7a', '#90a4ae'], sun: false, snowCount: 60, fog: 0.12, wind: 0.3 },
    { name: 'Blizzard', emoji: '🌬️', successMod: 0.85, rewardMod: 1.5, desc: 'Whiteout! Huge risk, huge reward.',
      sky: ['#546e7a', '#78909c', '#cfd8dc'], sun: false, snowCount: 120, fog: 0.3, wind: 0.7 }
  ];

  var LB_KEY = 'mysnowboard_leaderboard';

  const COLORS = [
    { name: 'Arctic Blue', primary: '#3498db', dark: '#2471a3' },
    { name: 'Fire Red', primary: '#e74c3c', dark: '#c0392b' },
    { name: 'Neon Green', primary: '#2ecc71', dark: '#1e8449' },
    { name: 'Sunset Orange', primary: '#f39c12', dark: '#d68910' }
  ];

  let state = {
    mode: 'solo',
    players: [],
    currentPlayer: 0,
    get player() { return this.players[this.currentPlayer]; },
    _p1Color: 0,
    _p2Color: 1,
    selectedJump: null,
    selectedHill: 1,
    weather: 1,
    lastResult: null
  };

  var soundEnabled = true;
  var audioCtx;

  let animCanvas, animCtx, animStart, animSuccess, animJumpIdx, animWeather;

  var CHARGE_MAX_MS = 2500;
  var LAND_WINDOW_MS = 1200;
  var jumpPhase = 'idle';
  var chargeStartTime = 0;
  var chargeValue = 0;
  var chargeScoreVal = 0;
  var landWindowStartTime = 0;
  var landingScoreVal = 0;
  var jumpSetup = null;
  var chargeFrame = null;
  var landRingFrame = null;
  var animPeakMod = 1;
  var animPhase = 'pre-land';
  var animResumeTs = 0;
  var animPauseT = 0.62;
  var animTotalMs = 4500;
  var actionInputBlocked = false;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const lerp = (a, b, t) => a + (b - a) * t;

  function calcChargeScore(v) {
    if (v <= 0.30) return v / 0.30 * 0.30;
    if (v <= 0.70) return 0.30 + (v - 0.30) / 0.40 * 0.40;
    if (v <= 0.90) return 0.70 + (v - 0.70) / 0.20 * 0.30;
    return 1.0 - (v - 0.90) / 0.10 * 0.50;
  }

  function chargeZoneColor(v) {
    if (v <= 0.30) return '#e74c3c';
    if (v <= 0.70) return '#f39c12';
    if (v <= 0.90) return '#2ecc71';
    return '#e74c3c';
  }

  function chargeZoneLabel(v) {
    if (v <= 0.30) return 'Weak';
    if (v <= 0.70) return 'Good';
    if (v <= 0.90) return 'Perfect!';
    return 'Too much!';
  }

  function applyMods(jump, gear, hill, weather) {
    var rate = jump.successRate;
    var reward = jump.reward;
    var damage = jump.damage;
    if (gear.indexOf('boots') >= 0) rate = Math.min(0.95, rate + 0.08);
    if (gear.indexOf('board') >= 0) reward += 5;
    if (gear.indexOf('helmet') >= 0) damage = Math.max(5, damage - 8);
    rate = Math.min(0.95, rate * hill.successMod);
    reward = Math.round(reward * hill.rewardMod);
    damage = Math.max(5, Math.round(damage * hill.damageMod));
    if (weather) {
      rate = Math.min(0.95, rate * weather.successMod);
      reward = Math.round(reward * weather.rewardMod);
    }
    return { successRate: rate, reward: reward, damage: damage };
  }

  // ==================== SOUND ====================

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, dur, type, vol) {
    if (!soundEnabled) return;
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  function sfxSuccess() {
    playTone(523, 0.15, 'sine', 0.2);
    setTimeout(function () { playTone(659, 0.15, 'sine', 0.2); }, 100);
    setTimeout(function () { playTone(784, 0.2, 'sine', 0.2); }, 200);
  }

  function sfxWipeout() {
    playTone(200, 0.3, 'sawtooth', 0.12);
    setTimeout(function () { playTone(120, 0.5, 'sawtooth', 0.1); }, 150);
  }

  function sfxStreak() {
    playTone(523, 0.1, 'sine', 0.2);
    setTimeout(function () { playTone(659, 0.1, 'sine', 0.2); }, 70);
    setTimeout(function () { playTone(784, 0.1, 'sine', 0.2); }, 140);
    setTimeout(function () { playTone(1047, 0.25, 'sine', 0.25); }, 210);
  }

  function sfxBuy() {
    playTone(880, 0.1, 'sine', 0.15);
    setTimeout(function () { playTone(1100, 0.15, 'sine', 0.15); }, 80);
  }

  function sfxClick() {
    playTone(600, 0.04, 'square', 0.05);
  }

  function sfxLaunch() {
    if (!soundEnabled) return;
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function loadLeaderboard() {
    try { var d = localStorage.getItem(LB_KEY); return d ? JSON.parse(d) : []; }
    catch (e) { return []; }
  }

  function saveToLeaderboard(name, coins, jumps, successes) {
    var lb = loadLeaderboard();
    lb.push({ name: name, coins: coins, jumps: jumps, successes: successes, date: new Date().toLocaleDateString() });
    lb.sort(function (a, b) { return b.coins - a.coins; });
    lb = lb.slice(0, 10);
    try { localStorage.setItem(LB_KEY, JSON.stringify(lb)); } catch (e) {}
    return lb;
  }

  function renderLeaderboard(el) {
    var lb = loadLeaderboard();
    if (lb.length === 0) { el.innerHTML = '<p class="lb-empty">No runs yet — be the first!</p>'; return; }
    var html = '<table class="lb-table"><thead><tr><th>#</th><th>Name</th><th>🪙</th><th>Landed</th></tr></thead><tbody>';
    lb.forEach(function (e, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      html += '<tr><td>' + medal + '</td><td>' + e.name + '</td><td>' + e.coins + '</td><td>' + e.successes + '/' + e.jumps + '</td></tr>';
    });
    el.innerHTML = html + '</tbody></table>';
  }

  // ==================== MODAL ====================

  function showModal(title, message, onConfirm) {
    var overlay = $('#modal-confirm');
    $('#modal-title').textContent = title;
    $('#modal-message').textContent = message;
    overlay.classList.remove('hidden');
    $('#modal-yes').onclick = function () { overlay.classList.add('hidden'); onConfirm(); };
    $('#modal-no').onclick = function () { overlay.classList.add('hidden'); };
    overlay.onclick = function (e) { if (e.target === overlay) overlay.classList.add('hidden'); };
  }

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

  function healthColor(h) {
    return h > 60 ? '#2ecc71' : h > 30 ? '#f39c12' : '#e74c3c';
  }

  function updateHUD() {
    $$('.hud').forEach(function (hud) {
      if (state.mode === 'solo') {
        var p = state.player;
        hud.innerHTML =
          '<div class="hud-item hud-name"><span>' + p.name + '</span></div>' +
          '<div class="hud-item">❤️ <div class="health-bar"><div class="health-fill" style="width:' + p.health + '%;background:' + healthColor(p.health) + '"></div></div> <span>' + p.health + '</span></div>' +
          '<div class="hud-item">🪙 <span>' + p.coins + '</span></div>';
      } else {
        hud.innerHTML = state.players.map(function (p, i) {
          var active = i === state.currentPlayer;
          var cls = 'hud-row' + (active ? ' hud-current' : '') + (p.alive ? '' : ' hud-out');
          return '<div class="' + cls + '">' +
            '<span class="hud-rname">' + p.name + (active ? ' 🎿' : '') + '</span>' +
            '<span>❤️</span><div class="health-bar"><div class="health-fill" style="width:' + p.health + '%;background:' + healthColor(p.health) + '"></div></div><span>' + p.health + '</span>' +
            '<span>🪙 ' + p.coins + '</span>' +
            (!p.alive ? '<span class="hud-eliminated">OUT</span>' : '') +
          '</div>';
        }).join('');
      }
    });
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

  function initColorPicker(selector, defaultIdx, onChange) {
    var container = $(selector);
    container.innerHTML = '';
    COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'color-btn' + (i === defaultIdx ? ' selected' : '');
      b.style.background = c.primary;
      b.title = c.name;
      b.type = 'button';
      b.addEventListener('click', function () {
        container.querySelectorAll('.color-btn').forEach(function (btn, idx) {
          btn.classList.toggle('selected', idx === i);
        });
        onChange(i);
      });
      container.appendChild(b);
    });
  }

  function initIntro() {
    state.mode = 'solo';
    state._p1Color = 0;
    state._p2Color = 1;

    $('#mode-solo').classList.add('selected');
    $('#mode-versus').classList.remove('selected');
    $('#p2-setup').classList.add('hidden');
    $('#p1-label').classList.add('hidden');

    var p1inp = $('#p1-name');
    var p2inp = $('#p2-name');
    var btn = $('#btn-start');
    p1inp.value = '';
    p2inp.value = '';
    btn.disabled = true;

    function checkStart() {
      var p1ok = p1inp.value.trim().length > 0;
      var p2ok = state.mode === 'solo' || p2inp.value.trim().length > 0;
      btn.disabled = !(p1ok && p2ok);
    }

    $('#mode-solo').onclick = function () {
      state.mode = 'solo';
      $('#mode-solo').classList.add('selected');
      $('#mode-versus').classList.remove('selected');
      $('#p2-setup').classList.add('hidden');
      $('#p1-label').classList.add('hidden');
      checkStart();
    };

    $('#mode-versus').onclick = function () {
      state.mode = 'versus';
      $('#mode-versus').classList.add('selected');
      $('#mode-solo').classList.remove('selected');
      $('#p2-setup').classList.remove('hidden');
      $('#p1-label').classList.remove('hidden');
      checkStart();
    };

    initColorPicker('#p1-colors', 0, function (i) { state._p1Color = i; });
    initColorPicker('#p2-colors', 1, function (i) { state._p2Color = i; });

    p1inp.addEventListener('input', checkStart);
    p2inp.addEventListener('input', checkStart);
    p1inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !btn.disabled) startGame(); });
    p2inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !btn.disabled) startGame(); });
    btn.addEventListener('click', startGame);
    renderLeaderboard($('#lb-intro'));
    setTimeout(function () { p1inp.focus(); }, 400);
  }

  function newPlayer(name, colorIdx) {
    return { name: name, colorIndex: colorIdx, health: 100, coins: 0, totalCoins: 0, jumps: 0, successes: 0, alive: true, gear: [], streak: 0 };
  }

  function startGame() {
    var p1name = $('#p1-name').value.trim();
    if (!p1name) return;

    state.players = [newPlayer(p1name, state._p1Color)];

    if (state.mode === 'versus') {
      var p2name = $('#p2-name').value.trim();
      if (!p2name) return;
      state.players.push(newPlayer(p2name, state._p2Color));
    }

    state.currentPlayer = 0;
    state.selectedJump = null;
    state.lastResult = null;
    updateHUD();
    showScreen('hill');
    setTimeout(initHill, 350);
  }

  // ==================== HILL ====================

  function initHill() {
    state.selectedJump = null;
    state.selectedHill = 1;
    state.weather = Math.floor(Math.random() * WEATHER.length);
    updateHUD();

    var w = WEATHER[state.weather];
    var weatherEl = $('#weather-indicator');
    weatherEl.innerHTML = '<span class="weather-emoji">' + w.emoji + '</span> ' + w.name;
    weatherEl.title = w.desc;
    weatherEl.className = 'weather-indicator weather-' + w.name.toLowerCase().replace(/\s/g, '-');
    weatherEl.classList.remove('hidden');

    var turnEl = $('#turn-indicator');
    if (state.mode === 'versus') {
      turnEl.textContent = '🎿 ' + state.player.name + "'s Turn!";
      turnEl.classList.remove('hidden');
    } else {
      turnEl.classList.add('hidden');
    }

    var gearEl = $('#equipped-gear');
    if (state.player.gear.length > 0) {
      gearEl.innerHTML = state.player.gear.map(function (id) {
        var g = GEAR.find(function (x) { return x.id === id; });
        return g ? '<span class="gear-badge" title="' + g.name + '">' + g.emoji + '</span>' : '';
      }).join('');
      gearEl.classList.remove('hidden');
    } else {
      gearEl.classList.add('hidden');
    }

    var streakEl = $('#streak-indicator');
    if (state.player.streak >= 2) {
      var mult = state.player.streak >= 3 ? '2x' : '1.5x';
      streakEl.textContent = '🔥 ' + state.player.streak + '-streak! (' + mult + ' coins)';
      streakEl.classList.remove('hidden');
    } else {
      streakEl.classList.add('hidden');
    }

    renderHillSelector();
    renderJumpCards();

    const btn = $('#btn-jump');
    btn.disabled = true;
    btn.onclick = attemptJump;
  }

  function renderHillSelector() {
    var box = $('#hill-options');
    box.innerHTML = '';
    HILLS.forEach(function (h, i) {
      var card = document.createElement('div');
      card.className = 'hill-card' + (i === state.selectedHill ? ' selected' : '');
      card.innerHTML =
        '<span class="hill-emoji">' + h.emoji + '</span>' +
        '<span class="hill-name">' + h.name + '</span>';
      card.title = h.desc;
      card.addEventListener('click', function () { selectHill(i); sfxClick(); });
      box.appendChild(card);
    });
  }

  function selectHill(i) {
    state.selectedHill = i;
    state.selectedJump = null;
    $$('.hill-card').forEach(function (c, idx) { c.classList.toggle('selected', idx === i); });
    renderJumpCards();
    $('#btn-jump').disabled = true;
    $$('.jump-card').forEach(function (c) { c.classList.remove('selected'); });
  }

  function renderJumpCards() {
    var hill = HILLS[state.selectedHill];
    var box = $('#jump-options');
    box.innerHTML = '';
    JUMPS.forEach(function (j, i) {
      var base = { successRate: j.successRate, reward: j.reward, damage: j.damage };
      var mods = applyMods(j, state.player.gear, hill, WEATHER[state.weather]);
      var card = document.createElement('div');
      card.className = 'jump-card' + (state.selectedJump === i ? ' selected' : '');
      card.innerHTML =
        '<div class="jump-emoji">' + j.emoji + '</div>' +
        '<h3>' + j.name + '</h3>' +
        '<div class="jump-stats">' +
          '<span class="stat' + (mods.successRate !== base.successRate ? ' stat-boosted' : '') + '">🎯 ' + Math.round(mods.successRate * 100) + '%</span>' +
          '<span class="stat' + (mods.reward !== base.reward ? ' stat-boosted' : '') + '">🪙 ' + mods.reward + '</span>' +
          '<span class="stat' + (mods.damage !== base.damage ? ' stat-boosted' : '') + '">💔 -' + mods.damage + '</span>' +
        '</div>' +
        '<p class="jump-desc">' + j.desc + '</p>' +
        '<div class="difficulty">' + '⭐'.repeat(j.difficulty) + '☆'.repeat(3 - j.difficulty) + '</div>';
      card.addEventListener('click', function () { selectJump(i); sfxClick(); });
      box.appendChild(card);
    });
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
    var hill = HILLS[state.selectedHill];
    var weather = WEATHER[state.weather];
    var mods = applyMods(jump, state.player.gear, hill, weather);

    jumpSetup = {
      jump: jump, jumpIndex: state.selectedJump,
      mods: mods, hill: hill, weather: weather, weatherIdx: state.weather
    };

    showScreen('jump');
    setTimeout(beginJumpSequence, 400);
  }

  // ==================== JUMP INTERACTION ====================

  function beginJumpSequence() {
    animCanvas = $('#jump-canvas');
    animCtx = animCanvas.getContext('2d');

    const wrap = animCanvas.parentElement;
    const w = Math.min(wrap.clientWidth, 800);
    const h = Math.round(w * 0.5625);
    animCanvas.width = w;
    animCanvas.height = h;
    animCanvas.style.width = w + 'px';
    animCanvas.style.height = h + 'px';

    animJumpIdx = jumpSetup.jumpIndex;
    animWeather = WEATHER[jumpSetup.weatherIdx];
    animSuccess = false;
    animPeakMod = 1;
    chargeValue = 0;
    chargeScoreVal = 0;
    landingScoreVal = 0;
    animPhase = 'pre-land';
    actionInputBlocked = false;

    $('#jump-title').textContent = jumpSetup.jump.name + ' ' + jumpSetup.jump.emoji + '  |  ' + animWeather.emoji + ' ' + animWeather.name;
    $('#jump-result').classList.add('hidden');

    drawScene(animCtx, 0);

    var actionEl = $('#jump-action');
    actionEl.classList.remove('hidden');
    var isMobile = 'ontouchstart' in window;
    $('#action-instruction').textContent = isMobile ? 'Hold to charge your jump!' : 'Hold button or SPACE to charge!';
    $('#action-btn').textContent = 'HOLD';
    $('#action-btn').className = 'action-btn';
    $('#power-label').textContent = '';
    $('#timing-bar-wrap').classList.add('hidden');
    updatePowerRing(0);
    $('#power-ring-svg').classList.remove('hidden');

    jumpPhase = 'charge-ready';
  }

  function onActionStart(e) {
    if (e && e.cancelable) e.preventDefault();
    if (actionInputBlocked) return;

    if (jumpPhase === 'charge-ready') {
      jumpPhase = 'charging';
      chargeStartTime = performance.now();
      chargeFrame = requestAnimationFrame(updateCharge);
    } else if (jumpPhase === 'land-ready') {
      var elapsed = performance.now() - landWindowStartTime;
      var t = Math.min(elapsed / LAND_WINDOW_MS, 1);
      landingScoreVal = 1 - Math.abs(t - 0.5) * 2;
      landingScoreVal = Math.max(0, Math.min(1, landingScoreVal));

      jumpPhase = 'resolved';
      cancelAnimationFrame(landRingFrame);
      resolveJump();

      actionInputBlocked = true;
      $('#jump-action').classList.add('hidden');
    }
  }

  function onActionEnd(e) {
    if (e && e.cancelable) e.preventDefault();
    if (jumpPhase !== 'charging') return;

    var elapsed = performance.now() - chargeStartTime;
    chargeValue = Math.min(elapsed / CHARGE_MAX_MS, 1);
    chargeScoreVal = calcChargeScore(chargeValue);
    animPeakMod = chargeScoreVal;
    jumpPhase = 'launching';
    cancelAnimationFrame(chargeFrame);

    $('#power-ring-svg').classList.add('hidden');
    $('#action-instruction').textContent = '';
    $('#power-label').textContent = '';
    $('#jump-action').classList.add('hidden');

    sfxLaunch();
    animStart = null;
    animPhase = 'pre-land';
    requestAnimationFrame(tick);
  }

  function updateCharge() {
    if (jumpPhase !== 'charging') return;
    var elapsed = performance.now() - chargeStartTime;
    chargeValue = Math.min(elapsed / CHARGE_MAX_MS, 1);

    updatePowerRing(chargeValue);

    $('#power-label').textContent = chargeZoneLabel(chargeValue);
    $('#power-label').style.color = chargeZoneColor(chargeValue);

    var btnText = chargeValue < 0.30 ? 'HOLD...' : chargeValue < 0.70 ? 'ALMOST...' : chargeValue < 0.90 ? 'NOW!' : 'TOO MUCH!';
    $('#action-btn').textContent = btnText;

    drawScene(animCtx, chargeValue * 0.22);

    if (chargeValue >= 1) {
      onActionEnd(null);
      return;
    }

    chargeFrame = requestAnimationFrame(updateCharge);
  }

  function updatePowerRing(value) {
    var ring = $('#ring-fill');
    var circumference = 2 * Math.PI * 58;
    ring.style.strokeDashoffset = String(circumference * (1 - value));
    ring.style.stroke = chargeZoneColor(value);

    var sweet = $('#ring-sweet-zone');
    sweet.style.strokeDasharray = circumference * 0.20 + ' ' + circumference * 0.80;
    sweet.style.strokeDashoffset = String(-circumference * 0.70);
  }

  function showLandingUI() {
    var actionEl = $('#jump-action');
    actionEl.classList.remove('hidden');
    var isMobile = 'ontouchstart' in window;
    $('#action-instruction').textContent = isMobile ? 'TAP when the needle hits green!' : 'TAP or SPACE when the needle hits green!';
    $('#action-btn').textContent = 'TAP!';
    $('#action-btn').className = 'action-btn action-btn-land';
    $('#power-ring-svg').classList.add('hidden');
    $('#power-label').textContent = '';

    $('#timing-bar-wrap').classList.remove('hidden');
    $('#timing-needle').style.left = '0%';

    landWindowStartTime = performance.now();
    updateTimingBar();
  }

  function updateTimingBar() {
    if (jumpPhase !== 'land-ready') return;
    var elapsed = performance.now() - landWindowStartTime;
    var t = Math.min(elapsed / LAND_WINDOW_MS, 1);

    $('#timing-needle').style.left = (t * 100) + '%';

    if (t >= 1) {
      landingScoreVal = 0;
      jumpPhase = 'resolved';
      resolveJump();
      actionInputBlocked = true;
      $('#jump-action').classList.add('hidden');
      return;
    }

    landRingFrame = requestAnimationFrame(updateTimingBar);
  }

  function resolveJump() {
    var overallScore = chargeScoreVal * 0.4 + landingScoreVal * 0.6;
    var threshold = 1 - jumpSetup.mods.successRate;
    var success = overallScore >= threshold;

    animSuccess = success;
    state.player.jumps++;

    var coinsEarned = 0;
    var streakCount = 0;

    if (success) {
      state.player.streak++;
      streakCount = state.player.streak;
      var streakMult = streakCount >= 3 ? 2 : streakCount >= 2 ? 1.5 : 1;
      coinsEarned = Math.round(jumpSetup.mods.reward * streakMult);
      state.player.successes++;
      state.player.coins += coinsEarned;
      state.player.totalCoins += coinsEarned;
    } else {
      state.player.streak = 0;
      state.player.health = Math.max(0, state.player.health - jumpSetup.mods.damage);
      if (state.player.health <= 0) state.player.alive = false;
    }

    state.lastResult = {
      jump: jumpSetup.jump, jumpIndex: jumpSetup.jumpIndex, success: success,
      modReward: jumpSetup.mods.reward, modDamage: jumpSetup.mods.damage,
      coinsEarned: coinsEarned, streakCount: streakCount,
      hillName: jumpSetup.hill.name, weatherName: jumpSetup.weather.name,
      weatherIdx: jumpSetup.weatherIdx,
      chargeScore: chargeScoreVal, landingScore: landingScoreVal
    };
  }

  // ==================== JUMP ANIMATION ====================

  function tick(ts) {
    if (!animStart) animStart = ts;

    if (animPhase === 'pre-land') {
      var t = Math.min((ts - animStart) / animTotalMs, 1);

      if (t >= animPauseT) {
        animPhase = 'paused';
        jumpPhase = 'land-ready';
        showLandingUI();
        drawScene(animCtx, animPauseT);
        requestAnimationFrame(tick);
        return;
      }

      drawScene(animCtx, t);
      requestAnimationFrame(tick);

    } else if (animPhase === 'paused') {
      var landElapsed = performance.now() - landWindowStartTime;
      var wobble = Math.sin(landElapsed * 0.004) * 0.004;
      drawScene(animCtx, animPauseT + wobble);

      if (jumpPhase === 'resolved') {
        animPhase = 'post-land';
        animResumeTs = ts;
      }
      requestAnimationFrame(tick);

    } else if (animPhase === 'post-land') {
      var remainDuration = animTotalMs * (1 - animPauseT);
      var postT = (ts - animResumeTs) / remainDuration;
      var t = animPauseT + postT * (1 - animPauseT);
      t = Math.min(t, 1);

      drawScene(animCtx, t);
      if (t < 1) requestAnimationFrame(tick);
      else showJumpResult();
    }
  }

  function slopeY(x, W, H) {
    return H * 0.33 + (x / W) * H * 0.37;
  }

  function drawScene(ctx, t) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const wx = animWeather || WEATHER[1];

    // sky — driven by weather
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, wx.sky[0]);
    sky.addColorStop(0.45, wx.sky[1]);
    sky.addColorStop(1, wx.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // sun (only in sunny / clear)
    if (wx.sun) {
      var sunAlpha = wx.name === 'Sunny' ? 1.0 : 0.7;
      ctx.globalAlpha = sunAlpha;
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath(); ctx.arc(W * 0.86, H * 0.11, H * 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,220,0.25)';
      ctx.beginPath(); ctx.arc(W * 0.86, H * 0.11, H * 0.1, 0, Math.PI * 2); ctx.fill();
      if (wx.name === 'Sunny') {
        ctx.fillStyle = 'rgba(255,248,220,0.10)';
        ctx.beginPath(); ctx.arc(W * 0.86, H * 0.11, H * 0.18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // mountains — fade with fog
    var mtnAlpha = 1 - wx.fog * 1.5;
    ctx.globalAlpha = Math.max(0.3, mtnAlpha);
    drawMtn(ctx, W * 0.0, H * 0.23, W * 0.36, '#1e3458');
    drawMtn(ctx, W * 0.26, H * 0.17, W * 0.42, '#1a2d4d');
    drawMtn(ctx, W * 0.6, H * 0.21, W * 0.44, '#162642');

    drawCap(ctx, W * 0.0, H * 0.23, W * 0.36, H * 0.035);
    drawCap(ctx, W * 0.26, H * 0.17, W * 0.42, H * 0.04);
    drawCap(ctx, W * 0.6, H * 0.21, W * 0.44, H * 0.035);
    ctx.globalAlpha = 1;

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
    var ksX = W * 0.26, klX = W * 0.38;
    var ksY = slopeY(ksX, W, H), klY = ksY - H * 0.08;
    var backX = klX + W * 0.012, backY = slopeY(klX, W, H);

    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(ksX + W * 0.02, ksY + 4);
    ctx.bezierCurveTo(ksX + (klX - ksX) * 0.6, ksY + 4, klX - (klX - ksX) * 0.15, lerp(ksY, klY, 0.3) + 4, klX, klY + 4);
    ctx.lineTo(backX + 2, backY + 4);
    ctx.lineTo(ksX + W * 0.02, ksY + 4);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#d5dfe9';
    ctx.beginPath();
    ctx.moveTo(ksX, ksY);
    ctx.bezierCurveTo(ksX + (klX - ksX) * 0.6, ksY, klX - (klX - ksX) * 0.15, lerp(ksY, klY, 0.3), klX, klY);
    ctx.lineTo(backX, backY);
    ctx.lineTo(ksX, ksY);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#a0b0c0'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ksX, ksY);
    ctx.bezierCurveTo(ksX + (klX - ksX) * 0.6, ksY, klX - (klX - ksX) * 0.15, lerp(ksY, klY, 0.3), klX, klY);
    ctx.stroke();

    ctx.strokeStyle = '#8a9ab0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(klX, klY); ctx.lineTo(backX, backY); ctx.stroke();

    // trees
    [[0.07, 0.55], [0.14, 0.75], [0.83, 0.65], [0.91, 0.85], [0.96, 0.5]].forEach(([px, sc]) => {
      drawTree(ctx, W * px, slopeY(W * px, W, H), sc, W, H);
    });

    // snow particles — count & size driven by weather
    var snowCount = wx.snowCount;
    var windDrift = wx.wind;
    ctx.fillStyle = 'rgba(255,255,255,' + (wx.fog > 0 ? '0.8' : '0.65') + ')';
    for (let i = 0; i < snowCount; i++) {
      const sp = 0.3 + (i % 5) * 0.14;
      const sx = (i * 137.5 + t * (30 + windDrift * 120) * (1 + i % 3)) % W;
      const sy = (i * 73.7 + t * 80 * sp) % H;
      var r = 1 + (i % 3) * (wx.fog > 0.2 ? 1.3 : 1);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }

    // wind streaks (blizzard / snowfall)
    if (windDrift > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (windDrift * 0.35) + ')';
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.floor(windDrift * 30); i++) {
        var wy = (i * 53.3 + t * 200) % H;
        var wxStart = (i * 97.7 + t * 300 * windDrift) % W;
        var wLen = 20 + (i % 4) * 15;
        ctx.beginPath(); ctx.moveTo(wxStart, wy); ctx.lineTo(wxStart + wLen, wy - 2); ctx.stroke();
      }
    }

    // fog overlay
    if (wx.fog > 0) {
      ctx.fillStyle = 'rgba(200,210,220,' + wx.fog + ')';
      ctx.fillRect(0, 0, W, H);
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
    const ksX = W * 0.26, klX = W * 0.38;
    const ksY = slopeY(ksX, W, H);
    const klY = ksY - H * 0.08;
    const lx = W * 0.72, ly = slopeY(lx, W, H);
    const peakY = lerp(H * 0.24, H * 0.04, animPeakMod);
    const off = -14;

    if (t < 0.22) {
      const p = t / 0.22;
      const x = lerp(W * 0.04, ksX, p);
      return { x, y: slopeY(x, W, H) + off };
    }
    if (t < 0.35) {
      const p = (t - 0.22) / 0.13;
      const x = lerp(ksX, klX, p);
      const y = lerp(ksY, klY, p * p);
      return { x, y: y + off };
    }
    if (t < 0.75) {
      const p = (t - 0.35) / 0.40;
      const x = lerp(klX, lx, p);
      const y = (1 - p) * (1 - p) * klY + 2 * (1 - p) * p * peakY + p * p * ly;
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
    if (t < 0.22) return slope;
    if (t < 0.35) return lerp(slope, -0.3, (t - 0.22) / 0.13);
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

    var weatherBonus = r.weatherName === 'Blizzard' ? ' (🌬️ blizzard bonus!)' : '';

    if (r.success) {
      if (r.streakCount >= 2) {
        var mult = r.streakCount >= 3 ? '2x' : '1.5x';
        $('#result-text').textContent = '🔥 ' + r.streakCount + '-streak!';
        $('#result-text').className = 'result-success result-streak';
        $('#result-detail').textContent = '+' + r.coinsEarned + ' coins (' + mult + ' bonus) for the ' + r.jump.name + '!' + weatherBonus;
        sfxStreak();
      } else {
        $('#result-text').textContent = '🎉 Nailed it!';
        $('#result-text').className = 'result-success';
        $('#result-detail').textContent = '+' + r.coinsEarned + ' coins for the ' + r.jump.name + '!' + weatherBonus;
        sfxSuccess();
      }
    } else {
      var weatherNote = r.weatherName === 'Blizzard' ? ' Brutal in the blizzard!' :
                        r.weatherName === 'Snowfall' ? ' The snow didn\'t help!' : '';
      $('#result-text').textContent = '💥 Wipeout!';
      $('#result-text').className = 'result-fail';
      $('#result-detail').textContent = '-' + r.modDamage + ' health. That\'s gonna leave a mark!' + weatherNote;
      sfxWipeout();
    }

    var chargeLabel = r.chargeScore >= 0.7 ? 'Perfect' : r.chargeScore >= 0.3 ? 'Good' : 'Weak';
    var landLabel = r.landingScore >= 0.7 ? 'Perfect' : r.landingScore >= 0.3 ? 'Good' : 'Missed';
    $('#score-breakdown').textContent = 'Charge: ' + chargeLabel + ' (' + Math.round(r.chargeScore * 100) + '%)  •  Landing: ' + landLabel + ' (' + Math.round(r.landingScore * 100) + '%)';

    const btn = $('#btn-to-chalet');
    if (state.player.health <= 0) {
      if (state.mode === 'versus') {
        var otherIdx = 1 - state.currentPlayer;
        var other = state.players[otherIdx];
        if (other.alive) {
          btn.textContent = state.player.name + ' is eliminated! ' + other.name + ' continues...';
          btn.onclick = function () {
            state.currentPlayer = otherIdx;
            showScreen('hill');
            setTimeout(initHill, 350);
          };
        } else {
          btn.textContent = 'Game Over...';
          btn.onclick = function () { showScreen('gameover'); setTimeout(initGameOver, 350); };
        }
      } else {
        btn.textContent = 'Game Over...';
        btn.onclick = function () { showScreen('gameover'); setTimeout(initGameOver, 350); };
      }
    } else {
      btn.textContent = 'Head to the Chalet 🏔️';
      btn.onclick = function () { showScreen('chalet'); setTimeout(initChalet, 350); };
    }
  }

  // ==================== CHALET ====================

  function initChalet() {
    updateHUD();

    const msg = $('#chalet-message');
    if (state.lastResult.success) {
      var streakNote = state.lastResult.streakCount >= 2 ? ' (🔥 streak bonus!)' : '';
      msg.innerHTML = '<span class="msg-success">Great ' + state.lastResult.jump.name + '! 🎉</span> You earned <strong>' + state.lastResult.coinsEarned + ' coins</strong>' + streakNote + '.';
    } else {
      msg.innerHTML = '<span class="msg-fail">Tough break on the ' + state.lastResult.jump.name + '.</span> You lost <strong>' + state.lastResult.modDamage + ' health</strong>. Time to refuel!';
    }

    renderShop();
    renderGearShop();

    $('#stat-jumps').textContent = state.player.jumps;
    $('#stat-successes').textContent = state.player.successes;

    var hillBtn = $('#btn-to-hill');
    if (state.mode === 'versus') {
      var otherIdx = 1 - state.currentPlayer;
      var other = state.players[otherIdx];
      if (other.alive) {
        hillBtn.textContent = other.name + "'s Turn! 🔄";
        hillBtn.onclick = function () {
          state.currentPlayer = otherIdx;
          showScreen('hill');
          setTimeout(initHill, 350);
        };
      } else {
        hillBtn.textContent = 'Back to the Hill! ⛰️';
        hillBtn.onclick = function () { showScreen('hill'); setTimeout(initHill, 350); };
      }
    } else {
      hillBtn.textContent = 'Back to the Hill! ⛰️';
      hillBtn.onclick = function () { showScreen('hill'); setTimeout(initHill, 350); };
    }

    $('#btn-stop-day').onclick = function () {
      showModal('Stop for the day?', 'Your scores will be saved to the leaderboard.', function () {
        state.players.forEach(function (p) {
          saveToLeaderboard(p.name, p.totalCoins, p.jumps, p.successes);
        });
        showScreen('intro');
        setTimeout(initIntro, 350);
      });
    };
  }

  function renderShop() {
    const box = $('#shop-items');
    box.innerHTML = '';

    var fullHealthBanner = $('#shop-full-health');
    if (state.player.health >= 100) {
      fullHealthBanner.textContent = '✨ You\'re at full health — no need to refuel!';
      fullHealthBanner.classList.remove('hidden');
    } else {
      fullHealthBanner.classList.add('hidden');
    }

    SHOP.forEach((item, i) => {
      const atFull = state.player.health >= 100;
      const canAfford = state.player.coins >= item.cost;
      const canBuy = canAfford && !atFull;
      var reason = '';
      if (atFull) reason = 'Already at full health';
      else if (!canAfford) reason = 'Need ' + (item.cost - state.player.coins) + ' more coins';

      const card = document.createElement('div');
      card.className = 'shop-card' + (canBuy ? '' : ' disabled');
      card.innerHTML =
        '<div class="shop-emoji">' + item.emoji + '</div>' +
        '<h4>' + item.name + '</h4>' +
        '<p class="shop-desc">' + item.desc + '</p>' +
        '<div class="shop-stats"><span>❤️ +' + item.health + '</span><span>🪙 ' + item.cost + '</span></div>' +
        '<button class="btn btn-shop"' + (canBuy ? '' : ' disabled') + '>Buy</button>' +
        (reason ? '<p class="shop-reason">' + reason + '</p>' : '');
      card.querySelector('.btn-shop').addEventListener('click', () => buyItem(i));
      box.appendChild(card);
    });
  }

  function buyItem(i) {
    const item = SHOP[i];
    if (state.player.coins >= item.cost && state.player.health < 100) {
      state.player.coins -= item.cost;
      state.player.health = Math.min(100, state.player.health + item.health);
      sfxBuy();
      updateHUD();
      renderShop();
      renderGearShop();
    }
  }

  function renderGearShop() {
    var box = $('#gear-items');
    box.innerHTML = '';
    GEAR.forEach(function (g) {
      var owned = state.player.gear.indexOf(g.id) >= 0;
      var canAfford = state.player.coins >= g.cost;
      var canBuy = !owned && canAfford;
      var card = document.createElement('div');
      card.className = 'shop-card' + (owned ? ' owned' : (!canBuy ? ' disabled' : ''));
      var btnHtml, reasonHtml = '';
      if (owned) {
        btnHtml = '<span class="gear-equipped">Equipped</span>';
      } else {
        btnHtml = '<button class="btn btn-gear"' + (canBuy ? '' : ' disabled') + '>Buy</button>';
        if (!canAfford) reasonHtml = '<p class="shop-reason">Need ' + (g.cost - state.player.coins) + ' more coins</p>';
      }
      card.innerHTML =
        '<div class="shop-emoji">' + g.emoji + '</div>' +
        '<h4>' + g.name + '</h4>' +
        '<p class="shop-desc">' + g.desc + '</p>' +
        '<div class="shop-stats"><span>🪙 ' + g.cost + '</span></div>' +
        btnHtml + reasonHtml;
      if (!owned) {
        var buyBtn = card.querySelector('.btn-gear');
        if (buyBtn) buyBtn.addEventListener('click', function () { buyGear(g.id); });
      }
      box.appendChild(card);
    });
  }

  function buyGear(id) {
    var item = GEAR.find(function (g) { return g.id === id; });
    if (!item || state.player.gear.indexOf(id) >= 0 || state.player.coins < item.cost) return;
    state.player.coins -= item.cost;
    state.player.gear.push(id);
    sfxBuy();
    updateHUD();
    renderGearShop();
    renderShop();
  }

  // ==================== GAME OVER ====================

  function initGameOver() {
    var soloEl = $('#solo-stats');
    var versusEl = $('#versus-stats');
    var title = $('.gameover-title');
    var sub = $('.gameover-sub');

    if (state.mode === 'versus') {
      soloEl.classList.add('hidden');
      versusEl.classList.remove('hidden');

      var p1 = state.players[0], p2 = state.players[1];
      var winIdx;
      if (p1.alive && !p2.alive) winIdx = 0;
      else if (p2.alive && !p1.alive) winIdx = 1;
      else winIdx = p1.totalCoins >= p2.totalCoins ? 0 : 1;

      title.textContent = '🏆 Game Over!';
      sub.textContent = state.players[winIdx].name + ' wins!';

      versusEl.innerHTML = state.players.map(function (p, i) {
        var w = i === winIdx;
        return '<div class="versus-player' + (w ? ' winner' : '') + '">' +
          '<h4>' + (w ? '🏆 ' : '') + p.name + '</h4>' +
          '<div class="stat-row"><span>Jumps</span><strong>' + p.jumps + '</strong></div>' +
          '<div class="stat-row"><span>Landed</span><strong>' + p.successes + '</strong></div>' +
          '<div class="stat-row"><span>Coins</span><strong>' + p.totalCoins + '</strong></div>' +
        '</div>';
      }).join('');
    } else {
      soloEl.classList.remove('hidden');
      versusEl.classList.add('hidden');
      title.textContent = '💥 Wipeout!';
      sub.textContent = state.players[0].name + ' is too injured to continue.';
      $('#final-jumps').textContent = state.players[0].jumps;
      $('#final-successes').textContent = state.players[0].successes;
      $('#final-coins').textContent = state.players[0].totalCoins;
    }

    state.players.forEach(function (p) {
      saveToLeaderboard(p.name, p.totalCoins, p.jumps, p.successes);
    });
    renderLeaderboard($('#lb-gameover'));

    $('#btn-restart').onclick = function () {
      showScreen('intro');
      setTimeout(initIntro, 350);
    };
  }

  // ==================== INIT ====================

  function init() {
    createSnowflakes();
    $('#btn-sound').onclick = function () {
      soundEnabled = !soundEnabled;
      this.textContent = soundEnabled ? '🔊' : '🔇';
    };

    var actionBtn = $('#action-btn');
    var touchActive = false;

    actionBtn.addEventListener('touchstart', function (e) {
      touchActive = true;
      onActionStart(e);
    }, { passive: false });
    actionBtn.addEventListener('touchend', function (e) {
      touchActive = false;
      onActionEnd(e);
    }, { passive: false });

    actionBtn.addEventListener('mousedown', function (e) {
      if (touchActive) return;
      onActionStart(e);
    });
    actionBtn.addEventListener('mouseup', function (e) {
      if (touchActive) return;
      onActionEnd(e);
    });

    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        onActionStart(null);
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'Space') {
        e.preventDefault();
        onActionEnd(null);
      }
    });

    initIntro();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
