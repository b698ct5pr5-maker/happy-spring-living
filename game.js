/* ===========================================================
   春满里求生赛 · 交互逻辑 + 核心玩法
   流程：标题 → 角色/模式选择 → 3-2-1 → 45 秒限时接光 → 结算
   节奏参考《伞伞快降》：左右操控、接好物得分、躲危险物、
   星星短暂无敌、难度递增、结算晒分。
   =========================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  var DURATION = 45;
  var BEST_KEY = 'chunmanli-survival-best';

  var MODES = {
    mingtang: { name: '明棠', img: 'assets/char-mingtang.png', port: 'mingtang', lives: 3, speed: 400, catchR: 36, players: 1 },
    jinye:    { name: '周尽野', img: 'assets/char-jinye.png', port: 'jinye', lives: 4, speed: 345, catchR: 31, players: 1 },
    duo:      { name: '双人', img: 'assets/char-duo.png', port: 'duo', lives: 3, speed: 365, catchR: 31, players: 2 }
  };

  /* 随机身份（结尾页） */
  var IDENTITIES = [
    '快乐小猫', '可爱小狗', '幸福居民', '绝美向日葵', '无忧无虑的路人',
    '社区主任', '街道办职员', '喜欢吃瓜的路人', '明棠同事', '周尽野亲友团'
  ];
  function pickIdentity() {
    return '你是「春满里社区的」' + IDENTITIES[Math.floor(Math.random() * IDENTITIES.length)];
  }

  /* 随机结果动物（7种）：洗牌袋策略，保证7种都会出现、且不会连续重复同一种 */
  var MASCOT_COUNT = 7;
  var mascotBag = [], lastMascot = -1;
  function pickMascotIndex() {
    if (!mascotBag.length) {
      mascotBag = [0, 1, 2, 3, 4, 5, 6];
      // Fisher-Yates 洗牌
      for (var i = mascotBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = mascotBag[i]; mascotBag[i] = mascotBag[j]; mascotBag[j] = t;
      }
      // 若袋首与上一次相同，则与下一个交换，避免跨袋连续重复
      if (mascotBag.length > 1 && mascotBag[0] === lastMascot) {
        var tmp = mascotBag[0]; mascotBag[0] = mascotBag[1]; mascotBag[1] = tmp;
      }
    }
    var idx = mascotBag.shift();
    lastMascot = idx;
    return idx;
  }

  /* ---------- DOM ---------- */
  var screens = {
    title: $('screen-title'), select: $('screen-select'),
    game: $('screen-game'), result: $('screen-result')
  };
  var device = $('device');
  var canvas = $('game-canvas');
  var ctx = canvas.getContext('2d');
  var resultCanvas = $('result-canvas');
  var countdown = $('countdown');
  var toast = $('game-toast');
  var pausePanel = $('pause-panel');
  var touchPad = $('touch-pad');
  var duoTip = $('duoTip') || $('duo-tip');

  /* ---------- 运行状态 ---------- */
  var mode = 'mingtang';
  var cfg = MODES[mode];
  var phase = 'title';               // title / select / countdown / playing / paused / result
  var W = 360, H = 560, dpr = 1;
  var players = [], items = [], particles = [], floaters = [], clouds = [], stars = [];
  var elapsed = 0, spawnTimer = 0, score = 0, lives = 3, combo = 0, maxCombo = 0;
  var catches = 0, synergy = 0, invincible = 0, hitShield = 0, shake = 0, flash = 0;
  var lastGoodCatch = [-99, -99];
  var best = 0;
  var lastFrame = 0, raf = 0, timers = [], lastCardUrl = '';
  var soundOn = true, audioCtx = null;
  var pressed = {}, padL = false, padR = false;
  var pointerTarget = [null, null], pointerActive = [false, false];
  var portraits = {};

  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }

  /* ---------- 通用 ---------- */
  function go(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.remove('is-active'); });
    screens[name].classList.add('is-active');
    screens[name].scrollTop = 0;
    device.dataset.screen = name;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function showToast(text, ms) {
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(function () { toast.classList.remove('on'); }, ms || 1300);
  }

  function beep(freq, dur, type, vol, delay) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = audioCtx.currentTime + (delay || 0);
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || .04, t0);
      g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + dur + .02);
    } catch (e) { /* 静音环境忽略 */ }
  }
  function sfxCatch(n) { beep(620 + Math.min(n, 12) * 26, .13, 'sine', .045); }
  function sfxStar() { [660, 880, 1100].forEach(function (f, i) { beep(f, .22, 'triangle', .05, i * .08); }); }
  function sfxHit() { beep(150, .3, 'sawtooth', .055); beep(110, .34, 'triangle', .04, .04); }

  /* ---------- 角色头像（内联 dataURL，canvas 绘制安全） ---------- */
  function loadPortraits() {
    var p = window.PORTRAITS || {};
    Object.keys(p).forEach(function (k) {
      var img = new Image();
      img.src = p[k];
      portraits[k] = img;
    });
  }

  /* ---------- 画布尺寸 ---------- */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    W = rect.width; H = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    players.forEach(function (p, i) {
      p.y = H - 74;
      p.x = clamp(p.x, boundLeft(i), boundRight(i));
    });
  }
  function isDuo() { return cfg.players === 2; }
  function boundLeft(i) { return isDuo() && i === 0 ? 34 : (isDuo() ? W / 2 + 14 : 34); }
  function boundRight(i) { return isDuo() && i === 0 ? W / 2 - 14 : W - 34; }

  /* ---------- 一局的初始化 ---------- */
  function setupPlayers() {
    players = [];
    var defs = isDuo()
      ? [{ key: 'mingtang', name: '明棠', color: '#FFC93C' }, { key: 'jinye', name: '尽野', color: '#58B4E8' }]
      : [{ key: cfg.port, name: cfg.name, color: '#FFC93C' }];
    defs.forEach(function (d, i) {
      players.push({
        x: isDuo() ? (i === 0 ? W * .27 : W * .73) : W / 2,
        y: H - 74, r: 21, catchR: cfg.catchR, speed: cfg.speed,
        key: d.key, name: d.name, color: d.color, idx: i
      });
    });
  }

  function setupClouds() {
    clouds = [];
    for (var i = 0; i < 7; i++) {
      clouds.push({
        x: rand(-60, W + 60), y: rand(30, H * .72),
        s: rand(.55, 1.35), v: rand(6, 18), a: rand(.22, .5)
      });
    }
    stars = [];
    for (var k = 0; k < 46; k++) {
      stars.push({
        x: rand(0, W), y: rand(0, H * .62),
        r: rand(.6, 1.9), ph: rand(0, 6.28), sp: rand(1.2, 3)
      });
    }
  }

  /* ---------- 昼夜光影：时间推进 + 分数越高越亮 ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mixColor(a, b, t) {
    var ca = hex2rgb(a), cb = hex2rgb(b);
    var r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    var g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    var bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  // dayFactor: 0 深夜 → 1 明亮白昼；由时间进度与分数共同决定
  function dayFactor() {
    var timePart = clamp(elapsed / DURATION, 0, 1);
    var scorePart = clamp(score / 900, 0, 1);
    return clamp(0.04 + timePart * 0.58 + scorePart * 0.38, 0, 1);
  }
  // smoothstep: 让昼夜图片交叉淡入更柔和，避免线性切换的突兀感
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  // 按 cover 方式绘制背景图（铺满画布、居中裁切）
  function drawCoverImg(img, alpha) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    var dx = (W - dw) / 2, dy = (H - dh) / 2;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }

  function startRun() {
    clearTimers();
    cfg = MODES[mode];
    elapsed = 0; spawnTimer = 0; score = 0; lives = cfg.lives;
    combo = 0; maxCombo = 0; catches = 0; synergy = 0;
    invincible = 0; hitShield = 0; shake = 0; flash = 0;
    lastGoodCatch = [-99, -99];
    items = []; particles = []; floaters = [];
    pointerTarget = [null, null]; pointerActive = [false, false];
    padL = false; padR = false;
    phase = 'countdown';

    // HUD 初值
    $('hud-avatar').src = cfg.img;
    $('hud-name').textContent = cfg.name;
    $('hud-score').textContent = '0';
    $('hud-timer').textContent = DURATION.toFixed(1) + 's';
    $('hud-combo').textContent = '连击 ×1';
    $('progress-bar').style.width = '0%';
    $('power-badge').classList.remove('on');
    $('foot-hint').textContent = isDuo() ? 'A D 控明棠 · ← → 控周尽野' : '← → / A D 移动 · 按住屏幕左右键也行';
    touchPad.style.display = isDuo() ? 'none' : 'flex';
    duoTip.classList.toggle('on', isDuo());
    pausePanel.classList.remove('on');
    countdown.classList.remove('on');
    updateHearts();

    go('game');
    requestAnimationFrame(function () {
      resize(); setupPlayers(); setupClouds();
      render();
      runCountdown();
    });
  }

  function updateHearts() {
    var s = '';
    for (var i = 0; i < cfg.lives; i++) s += i < lives ? '♥ ' : '♡ ';
    $('hud-hearts').textContent = s.trim();
  }

  function setCount(text) {
    countdown.innerHTML = '<span>' + text + '</span>';
    countdown.classList.add('on');
    if (text.length > 1) countdown.firstChild.style.fontSize = '48px';
    beep(text === '出发！' ? 880 : 520, .12, 'sine', .04);
  }

  function runCountdown() {
    var seq = ['3', '2', '1', '出发！'];
    seq.forEach(function (t, i) { later(function () { setCount(t); }, i * 700); });
    later(function () {
      countdown.classList.remove('on');
      phase = 'playing';
      lastFrame = performance.now();
      showToast('接住落下来的光吧 ☀', 1500);
    }, seq.length * 700);
  }

  /* ---------- 掉落物 ---------- */
  function pickType() {
    var r = Math.random();
    if (r < .07) return 'star';
    if (r < .40) return 'flower';
    if (r < .68) return 'drop';
    if (r < .84) return 'bomb';
    return 'bolt';
  }
  var ITEM_R = { flower: 17, drop: 13, star: 18, bomb: 15, bolt: 17 };

  function spawn() {
    var type = pickType();
    var t = clamp(elapsed / DURATION, 0, 1);
    var speed = 165 + t * 195;
    var item = {
      type: type, r: ITEM_R[type],
      x: rand(32, Math.max(34, W - 32)), y: -34,
      vy: speed * rand(.9, 1.18), vx: rand(-16, 16),
      rot: rand(0, Math.PI * 2), vr: rand(-1.6, 1.6)
    };
    items.push(item);
    // 偶尔成双落下，制造节奏起伏
    if (Math.random() < .22 && t > .18) {
      var type2 = Math.random() < .55 ? 'drop' : pickType();
      items.push({
        type: type2, r: ITEM_R[type2],
        x: clamp(item.x + rand(-90, 90), 32, W - 32), y: -74,
        vy: item.vy * .95, vx: rand(-14, 14),
        rot: rand(0, 6), vr: rand(-1.4, 1.4)
      });
    }
  }

  function burst(x, y, color, n, power) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), v = rand(30, 110) * (power || 1);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25,
        life: 0, max: rand(.45, .9), r: rand(2.5, 6), color: color
      });
    }
  }
  function floater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, color: color, life: 0, max: .9 });
  }

  function multiplier() { return Math.min(4, 1 + Math.floor(combo / 6)); }

  function collect(it, p, good) {
    var mult = multiplier();
    var base = it.type === 'flower' ? 10 : 5;
    var gain = base * mult * (invincible > 0 ? 2 : 1);
    combo++; maxCombo = Math.max(maxCombo, combo); catches++;
    score += gain;
    floater(it.x, it.y, '+' + gain + (mult > 1 ? ' ×' + mult : ''), '#0E5A9C');
    burst(it.x, it.y, it.type === 'flower' ? '#FFC93C' : '#58B4E8', 9, 1);
    sfxCatch(combo);

    // 双人默契：两人 1.2 秒内先后接住，额外加分
    if (isDuo() && elapsed - lastGoodCatch[1 - p.idx] < 1.2) {
      synergy += 20; score += 20;
      floater(W / 2, H * .55, '默契 +20', '#E89A12');
      burst(W / 2, H * .55, '#FFE58C', 16, 1.2);
      beep(1040, .18, 'sine', .04);
      lastGoodCatch[1 - p.idx] = -99;
    }
    lastGoodCatch[p.idx] = elapsed;
  }

  function hitHazard(it, p) {
    if (invincible > 0) {
      score += 5;
      floater(it.x, it.y, '+5 化雨成光', '#E89A12');
      burst(it.x, it.y, '#FFE58C', 10, 1.1);
      beep(900, .12, 'sine', .035);
      return;
    }
    if (hitShield > 0) return;
    lives--; combo = 0; hitShield = 1.2; shake = 12; flash = .32;
    updateHearts();
    floater(p.x, p.y - 46, '−1 ♥', '#D2604F');
    burst(p.x, p.y - 20, '#F0705F', 14, 1.3);
    sfxHit();
    showToast('哎呀，稳住就好 ☀', 1100);
    if (lives <= 0) endRun(false);
  }

  /* ---------- 更新 ---------- */
  function movePlayers(dt) {
    var duo = isDuo();
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var dir = 0;
      if (duo) {
        dir = i === 0
          ? (pressed.KeyD ? 1 : 0) - (pressed.KeyA ? 1 : 0)
          : (pressed.ArrowRight ? 1 : 0) - (pressed.ArrowLeft ? 1 : 0);
      } else {
        dir = (pressed.ArrowRight || pressed.KeyD ? 1 : 0) - (pressed.ArrowLeft || pressed.KeyA ? 1 : 0);
        dir += (padR ? 1 : 0) - (padL ? 1 : 0);
        dir = clamp(dir, -1, 1);
      }
      if (dir !== 0) {
        p.x += dir * p.speed * dt;
        pointerActive[i] = false;
      } else if (pointerActive[i] && pointerTarget[i] != null) {
        p.x += (pointerTarget[i] - p.x) * Math.min(1, dt * 13);
      }
      p.x = clamp(p.x, boundLeft(i), boundRight(i));
    }
  }

  function update(dt) {
    elapsed += dt;
    if (elapsed >= DURATION) { endRun(true); return; }

    invincible = Math.max(0, invincible - dt);
    hitShield = Math.max(0, hitShield - dt);
    shake = Math.max(0, shake - dt * 34);
    flash = Math.max(0, flash - dt * 1.6);

    clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > W + 80) c.x = -80; });

    var t = clamp(elapsed / DURATION, 0, 1);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = (0.64 - t * 0.30) * rand(.8, 1.25);
    }

    movePlayers(dt);

    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      it.y += it.vy * dt; it.x += it.vx * dt; it.rot += it.vr * dt;
      if (it.x < it.r || it.x > W - it.r) it.vx *= -1;
      var consumed = false;
      for (var j = 0; j < players.length && !consumed; j++) {
        var p = players[j];
        var dx = it.x - p.x, dy = it.y - (p.y - 18);
        if (dx * dx + dy * dy < (it.r + p.catchR) * (it.r + p.catchR)) {
          if (it.type === 'star') {
            invincible = 5; score += 5;
            floater(it.x, it.y, '⭐ 星光时间！', '#E89A12');
            burst(it.x, it.y, '#FFE58C', 20, 1.4);
            sfxStar(); showToast('风雨都变成光了 ✨', 1400);
          } else if (it.type === 'flower' || it.type === 'drop') collect(it, p, true);
          else hitHazard(it, p);
          consumed = true;
        }
      }
      if (consumed || it.y > H + 40) items.splice(i, 1);
      if (phase !== 'playing') return;   // 生命耗尽时立即停在这一帧
    }

    for (var k = particles.length - 1; k >= 0; k--) {
      var q = particles[k];
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * dt;
      if (q.life >= q.max) particles.splice(k, 1);
    }
    for (var m = floaters.length - 1; m >= 0; m--) {
      var f = floaters[m];
      f.life += dt; f.y -= 34 * dt;
      if (f.life >= f.max) floaters.splice(m, 1);
    }

    // HUD
    $('hud-score').textContent = Math.round(score);
    $('hud-timer').textContent = Math.max(0, DURATION - elapsed).toFixed(1) + 's';
    $('hud-combo').textContent = '连击 ×' + multiplier();
    $('progress-bar').style.width = (elapsed / DURATION * 100).toFixed(1) + '%';
    if (invincible > 0) {
      $('power-badge').classList.add('on');
      $('power-badge').textContent = '⭐ 星光时间 ' + invincible.toFixed(1) + 's';
    } else $('power-badge').classList.remove('on');
  }

  /* ---------- 绘制 ---------- */
  function starPath(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
      var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }

  function flower(cx, cy, r, rot) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
    for (var i = 0; i < 9; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / 9);
      ctx.fillStyle = i % 2 ? '#FFD85E' : '#FFB01F';
      ctx.beginPath(); ctx.ellipse(0, -r * .72, r * .30, r * .55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#8A5A22'; ctx.beginPath(); ctx.arc(0, 0, r * .42, 0, 7); ctx.fill();
    ctx.fillStyle = '#B98233'; ctx.beginPath(); ctx.arc(0, 0, r * .32, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawItem(it) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot * .35);
    if (it.type === 'flower') flower(0, 0, it.r, it.rot);
    else if (it.type === 'drop') {
      var g = ctx.createLinearGradient(0, -it.r, 0, it.r);
      g.addColorStop(0, '#BFE6F7'); g.addColorStop(1, '#1B7BC4');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -it.r * 1.35);
      ctx.bezierCurveTo(it.r * .85, -it.r * .1, it.r, it.r * .55, 0, it.r);
      ctx.bezierCurveTo(-it.r, it.r * .55, -it.r * .85, -it.r * .1, 0, -it.r * 1.35);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.ellipse(-it.r * .25, it.r * .15, it.r * .16, it.r * .3, -.4, 0, 7); ctx.fill();
    } else if (it.type === 'star') {
      ctx.shadowColor = 'rgba(255,220,110,.95)'; ctx.shadowBlur = 18;
      starPath(ctx, it.r); ctx.fillStyle = '#FFD85E'; ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#F6A21E'; ctx.lineWidth = 2.5; ctx.stroke();
    } else if (it.type === 'bomb') {
      ctx.fillStyle = '#173A5E';
      ctx.beginPath(); ctx.arc(0, 2, it.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(-it.r * .35, -it.r * .25, it.r * .22, 0, 7); ctx.fill();
      ctx.strokeStyle = '#173A5E'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(it.r * .35, -it.r * .75); ctx.quadraticCurveTo(it.r * .8, -it.r * 1.25, it.r * .45, -it.r * 1.5); ctx.stroke();
      ctx.fillStyle = '#FFC93C';
      ctx.beginPath(); ctx.arc(it.r * .45, -it.r * 1.55, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', 0, 8); ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#2A4E6E';
      ctx.beginPath();
      ctx.arc(-it.r * .45, -it.r * .2, it.r * .52, Math.PI, 0);
      ctx.arc(it.r * .45, -it.r * .2, it.r * .52, Math.PI, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFC93C';
      ctx.beginPath();
      ctx.moveTo(it.r * .1, -it.r * .05); ctx.lineTo(-it.r * .45, it.r * .5);
      ctx.lineTo(-it.r * .05, it.r * .5); ctx.lineTo(-it.r * .3, it.r * 1.1);
      ctx.lineTo(it.r * .55, it.r * .35); ctx.lineTo(it.r * .12, it.r * .35);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(p) {
    ctx.save(); ctx.translate(p.x, p.y);

    // 无敌光环
    if (invincible > 0) {
      ctx.strokeStyle = 'rgba(255,216,94,' + (.55 + .3 * Math.sin(performance.now() / 120)) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, -6, 44, 0, 7); ctx.stroke();
      for (var s = 0; s < 3; s++) {
        var a = performance.now() / 600 + s * 2.1;
        ctx.save(); ctx.translate(Math.cos(a) * 48, -6 + Math.sin(a) * 30);
        starPath(ctx, 6); ctx.fillStyle = '#FFF3C4'; ctx.fill(); ctx.restore();
      }
    }
    // 受击闪烁
    if (hitShield > 0 && Math.floor(hitShield * 12) % 2 === 0) ctx.globalAlpha = .45;

    // 伞绳
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-36, -28); ctx.lineTo(0, 2);
    ctx.moveTo(36, -28); ctx.lineTo(0, 2);
    ctx.stroke();

    // 伞面
    var g = ctx.createLinearGradient(0, -62, 0, -26);
    g.addColorStop(0, '#FFEBA6'); g.addColorStop(.55, '#FFC93C'); g.addColorStop(1, '#F09A12');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -28, 37, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(27,123,196,.55)';
    ctx.beginPath(); ctx.arc(0, -28, 37, Math.PI * 1.32, Math.PI * 1.68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFF9E6';
    for (var i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-27 + i * 18, -28, 8, 0, Math.PI); ctx.fill();
    }
    ctx.strokeStyle = '#FFF9E6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-37, -28); ctx.lineTo(37, -28); ctx.stroke();

    // 伞柄
    ctx.strokeStyle = '#8A5A22'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, -4); ctx.quadraticCurveTo(0, 6, 9, 6); ctx.stroke();

    // 头像
    ctx.shadowColor = 'rgba(11,62,111,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 6, 24, 0, 7); ctx.fill();
    ctx.shadowColor = 'transparent';
    var img = portraits[p.key];
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 6, 20, 0, 7); ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      var side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, Math.min(img.height - side, img.height * .04), side, side, -20, -14, 40, 40);
    } else {
      ctx.fillStyle = p.color; ctx.fillRect(-20, -14, 40, 40);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 6, 22, 0, 7);
    ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.stroke();

    // 双人名字
    if (isDuo()) {
      ctx.font = '900 11px "PingFang SC",sans-serif'; ctx.textAlign = 'center';
      var tw = ctx.measureText(p.name).width + 16;
      ctx.fillStyle = 'rgba(14,90,156,.8)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-tw / 2, -84, tw, 20, 10) : ctx.rect(-tw / 2, -84, tw, 20);
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(p.name, 0, -70);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawBackground() {
    var day = dayFactor();
    var now = performance.now() / 1000;

    // --- 天空：深夜 → 晨曦 → 白昼 的分段渐变 ---
    var g = ctx.createLinearGradient(0, 0, 0, H);
    var topC, midC, lowC;
    if (day < .5) {
      var k = day / .5;                       // 夜 → 晨曦
      topC = mixColor('#0A1836', '#5B5FA6', k);
      midC = mixColor('#12305E', '#E58C6A', k);
      lowC = mixColor('#1C4E7A', '#FFC98A', k);
    } else {
      var k2 = (day - .5) / .5;               // 晨曦 → 白昼
      topC = mixColor('#5B5FA6', '#3E93D6', k2);
      midC = mixColor('#E58C6A', '#7CC6F0', k2);
      lowC = mixColor('#FFC98A', '#D8F0FC', k2);
    }
    g.addColorStop(0, topC); g.addColorStop(.5, midC); g.addColorStop(1, lowC);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // --- 昼夜效果图：黑夜(星空行星) ↔ 白天(粉色山谷) 平滑交叉淡入淡出 ---
    // 渐变天空作为兜底；图片加载完成后覆盖其上，过渡用 smoothstep 保证自然流畅。
    var nightImg = portraits.sceneNight, dayImg = portraits.sceneDay;
    var t = smoothstep(day);                    // 0=纯夜图 → 1=纯昼图
    var imgDrawn = false;
    // 夜图：夜晚不透明，天亮渐隐；昼图：白天不透明，夜晚渐隐
    if (drawCoverImg(nightImg, 1)) {
      imgDrawn = true;
      if (dayImg && dayImg.complete && dayImg.naturalWidth && t > 0) {
        ctx.save(); ctx.globalAlpha = t;        // 昼图以 t 叠加于夜图之上 → 平滑交接
        var s2 = Math.max(W / dayImg.naturalWidth, H / dayImg.naturalHeight);
        var dw2 = dayImg.naturalWidth * s2, dh2 = dayImg.naturalHeight * s2;
        ctx.drawImage(dayImg, (W - dw2) / 2, (H - dh2) / 2, dw2, dh2);
        ctx.restore();
      }
    } else if (drawCoverImg(dayImg, t)) {
      imgDrawn = true;                          // 仅昼图可用的兜底
    }
    // 图片上叠一层随昼夜变化的柔和色罩，保证后续掉落物/文字对比度
    if (imgDrawn) {
      ctx.fillStyle = day < .5
        ? 'rgba(10,18,48,' + (0.30 - day * 0.34).toFixed(3) + ')'
        : 'rgba(255,244,224,' + ((day - .5) * 0.20).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // --- 星空：夜里清晰，天亮渐隐 ---
    if (day < .82) {
      var starA = (1 - day / .82);
      stars.forEach(function (s) {
        var tw = .55 + .45 * Math.sin(now * s.sp + s.ph);
        ctx.globalAlpha = starA * tw;
        ctx.fillStyle = '#FFF8DE';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // 月亮：随天亮淡出并缓缓下沉
      var moonA = clamp(1 - day * 1.4, 0, 1);
      if (moonA > 0) {
        var mx = W * .78, my = 74 + day * 40;
        var mg = ctx.createRadialGradient(mx, my, 2, mx, my, 46);
        mg.addColorStop(0, 'rgba(255,250,220,' + (.9 * moonA) + ')');
        mg.addColorStop(1, 'rgba(255,250,220,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 46, 0, 7); ctx.fill();
        ctx.globalAlpha = moonA; ctx.fillStyle = '#FFF6D8';
        ctx.beginPath(); ctx.arc(mx, my, 17, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // --- 太阳：天亮时升起，光晕随分数增强 ---
    if (day > .28) {
      var sunA = clamp((day - .28) / .5, 0, 1);
      var sx = W * .76, sy = 108 - day * 54;
      var glowR = 120 + day * 90 + (score / 900) * 60;
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      sg.addColorStop(0, 'rgba(255,240,170,' + (.85 * sunA) + ')');
      sg.addColorStop(.4, 'rgba(255,224,130,' + (.35 * sunA) + ')');
      sg.addColorStop(1, 'rgba(255,224,130,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * .75);
      ctx.globalAlpha = sunA;
      ctx.fillStyle = '#FFF3C0';
      ctx.beginPath(); ctx.arc(sx, sy, 22 + day * 8, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- 云：白天更白更明显，夜里带冷色剪影 ---
    var cloudLight = mixColor('#2A3A63', '#FFFFFF', clamp((day - .2) / .7, 0, 1));
    clouds.forEach(function (c) {
      ctx.save(); ctx.globalAlpha = c.a * (.5 + day * .5); ctx.fillStyle = cloudLight;
      ctx.translate(c.x, c.y); ctx.scale(c.s, c.s);
      ctx.beginPath();
      ctx.arc(-22, 4, 17, 0, 7); ctx.arc(0, -6, 23, 0, 7); ctx.arc(25, 5, 16, 0, 7);
      ctx.fill(); ctx.restore();
    });

    // --- 海面：颜色随昼夜过渡，分数越高波光越亮 ---
    var seaFar = mixColor('#12305E', '#3E9FD8', day);
    var seaNear = mixColor('#0C2247', '#8FD4F2', day);
    function sea(base, amp, color, hi) {
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, base);
      for (var x = 0; x <= W; x += 8) ctx.lineTo(x, base + Math.sin(x / 46 + now * 1.2) * amp);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      if (hi) {
        ctx.save(); ctx.globalAlpha = .25 + day * .5;
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6;
        for (var b = 0; b < 3; b++) {
          ctx.beginPath();
          var yy = base + 8 + b * 9;
          for (var x2 = 0; x2 <= W; x2 += 10) {
            var y2 = yy + Math.sin(x2 / 40 + now * 1.5 + b) * 2.2;
            if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    sea(H - 54, 7, seaFar, false);
    sea(H - 30, 6, seaNear, true);

    // --- 远景小山剪影（夜色里更深，白天变浅） ---
    var hillC = mixColor('#0A1C3A', '#5FA9D8', day);
    ctx.globalAlpha = .55; ctx.fillStyle = hillC;
    ctx.beginPath(); ctx.moveTo(0, H - 54);
    ctx.quadraticCurveTo(W * .2, H - 96, W * .42, H - 54);
    ctx.quadraticCurveTo(W * .66, H - 110, W, H - 52);
    ctx.lineTo(W, H - 40); ctx.lineTo(0, H - 40); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // 角落向日葵（随天亮更鲜明）
    ctx.save(); ctx.globalAlpha = .55 + day * .45;
    flower(24, H - 14, 19, .3); flower(W - 18, H - 11, 14, -.5);
    ctx.restore();

    // 双人分界线
    if (isDuo()) {
      ctx.save(); ctx.setLineDash([7, 9]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H - 36); ctx.stroke(); ctx.restore();
    }
  }

  function render() {
    if (!W || !H) return;
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * .35, rand(-shake, shake) * .35);
    drawBackground();

    items.forEach(drawItem);

    particles.forEach(function (q) {
      ctx.globalAlpha = clamp(1 - q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;

    floaters.forEach(function (f) {
      ctx.globalAlpha = clamp(1 - f.life / f.max, 0, 1);
      ctx.font = '900 17px "PingFang SC",sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;

    players.forEach(drawPlayer);

    if (flash > 0) {
      ctx.fillStyle = 'rgba(240,112,95,' + (flash * .35) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(.045, (ts - lastFrame) / 1000 || 0);
    lastFrame = ts;
    if (phase === 'playing') update(dt);
    if (phase === 'playing' || phase === 'countdown' || phase === 'paused') render();
  }

  /* ---------- 暂停 / 结束 ---------- */
  function setPause(on) {
    if (phase !== 'playing' && phase !== 'paused') return;
    if (on) { phase = 'paused'; pausePanel.classList.add('on'); }
    else { phase = 'playing'; pausePanel.classList.remove('on'); lastFrame = performance.now(); }
  }
  function togglePause() {
    if (phase === 'playing') setPause(true);
    else if (phase === 'paused') setPause(false);
  }
  function quitRun() {
    clearTimers(); clearTimeout(showToast.t);
    phase = 'select';
    countdown.classList.remove('on'); pausePanel.classList.remove('on');
    toast.classList.remove('on'); $('power-badge').classList.remove('on');
    go('select');
  }

  function endRun(cleared) {
    if (phase === 'result') return;
    phase = 'result';
    clearTimers(); clearTimeout(showToast.t);
    countdown.classList.remove('on'); pausePanel.classList.remove('on');
    toast.classList.remove('on'); $('power-badge').classList.remove('on');

    var finalScore = Math.round(score);
    if (finalScore > best) {
      best = finalScore;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    var identity = pickIdentity();
    var quote = window.CardKit.pickQuote();
    var quoteText = quote.text || quote;
    var quoteSrc = quote.src || '';
    $('card-loading').classList.add('on');

    // 结尾页只保留一张自动生成的结果卡；身份 / 星光值 / 连击 / 时间 / 文案
    // 全部绘制进卡片本体，不再单独填充页面段落。
    var result = {
      mode: mode, score: finalScore, best: best, maxCombo: maxCombo,
      catches: catches, time: Math.min(DURATION, elapsed),
      cleared: cleared, synergy: synergy, date: new Date(),
      identity: identity, quote: { text: quoteText, src: quoteSrc },
      mascotIndex: pickMascotIndex()
    };

    go('result');
    window.CardKit.preload().then(function () {
      try {
        lastCardUrl = window.CardKit.generate(resultCanvas, result);
        $('btn-save').disabled = false;
      } catch (e) {
        console.error('结果卡片生成失败', e);
        $('card-loading').textContent = '卡片生成失败，请再玩一次';
        return;
      }
      $('card-loading').classList.remove('on');
    });
  }

  function cardBlob() {
    if (!lastCardUrl) return null;
    try {
      var bin = atob(lastCardUrl.split(',')[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: 'image/png' });
    } catch (e) { return null; }
  }
  function downloadCard() {
    if (!lastCardUrl) return;
    var a = document.createElement('a');
    a.href = lastCardUrl;
    a.download = '春满里挑战赛-结果卡-' + Date.now() + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function saveCard() { downloadCard(); }
  function shareCard() {
    if (!lastCardUrl) return;
    var blob = cardBlob();
    var file = blob ? new File([blob], '春满里挑战赛-结果卡.png', { type: 'image/png' }) : null;
    var shareData = {
      title: '春满里挑战赛 · 我的结果卡',
      text: '我在春满里接住了 ' + Math.round(score) + ' 星光值，一起来玩吧 ☀',
      url: location.href
    };
    if (file) shareData.files = [file];

    // 优先：系统原生分享（移动端可分享图片到微信/朋友圈等）
    if (navigator.share && (!navigator.canShare || !file || navigator.canShare({ files: [file] }))) {
      navigator.share(shareData).catch(function (err) {
        if (err && err.name === 'AbortError') return; // 用户主动取消
        downloadCard(); // 其他异常降级为下载
      });
      return;
    }
    // 降级：复制文案 + 下载图片
    var done = function () { downloadCard(); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareData.text + ' ' + location.href).then(done).catch(done);
    } else { done(); }
  }

  /* ---------- 输入 ---------- */
  window.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    pressed[e.code] = true;
    if ((e.code === 'Space' || e.code === 'Escape') && (phase === 'playing' || phase === 'paused')) togglePause();
  });
  window.addEventListener('keyup', function (e) { pressed[e.code] = false; });
  window.addEventListener('blur', function () { pressed = {}; padL = padR = false; if (phase === 'playing') setPause(true); });

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width) };
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (phase !== 'playing') return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var pos = pointerPos(e), side = isDuo() ? (pos.x < W / 2 ? 0 : 1) : 0;
    pointerActive[side] = true; pointerTarget[side] = pos.x;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (phase !== 'playing') return;
    var pos = pointerPos(e), side = isDuo() ? (pos.x < W / 2 ? 0 : 1) : 0;
    if (!pointerActive[side] && e.buttons === 0 && !isDuo()) {
      pointerActive[0] = true; // 桌面鼠标悬停即可操控单人
    }
    if (pointerActive[side]) pointerTarget[side] = pos.x;
  });
  function releasePointer() { pointerActive[0] = pointerActive[1] = false; }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('pointerleave', function () { if (isDuo()) releasePointer(); });
  window.addEventListener('resize', resize);

  function bindPad(btn, onDown) {
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); onDown(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      btn.addEventListener(ev, function () { onDown(false); });
    });
  }
  bindPad($('pad-left'), function (v) { padL = v; });
  bindPad($('pad-right'), function (v) { padR = v; });

  /* ---------- 界面按钮 ---------- */
  $('btn-enter').addEventListener('click', function () { phase = 'select'; go('select'); });
  $('btn-select-back').addEventListener('click', function () { phase = 'title'; go('title'); });

  var castEls = document.querySelectorAll('.cast');
  castEls.forEach(function (card) {
    card.addEventListener('click', function () {
      castEls.forEach(function (c) { c.classList.remove('is-selected'); });
      card.classList.add('is-selected');
      mode = card.dataset.mode;
      beep(700, .09, 'sine', .035);
    });
    // 「就选TA」快捷入口：选中该角色并立即开局（桌面悬停 / 移动端选中后点击）
    var pick = card.querySelector('.cast-pick');
    if (pick) {
      var chooseAndStart = function (e) {
        e.preventDefault(); e.stopPropagation();
        castEls.forEach(function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        mode = card.dataset.mode;
        beep(760, .1, 'sine', .04);
        startRun();
      };
      pick.addEventListener('click', chooseAndStart);
      pick.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseAndStart(e); }
      });
    }
  });
  // 选人页底部长条按钮已移除，开局统一走各人物卡的「就选TA」入口
  $('btn-game-back').addEventListener('click', function () { if (phase === 'playing') setPause(true); else if (phase === 'countdown') quitRun(); });
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-resume').addEventListener('click', function () { setPause(false); });
  $('btn-quit').addEventListener('click', quitRun);
  $('btn-sound').addEventListener('click', function () {
    soundOn = !soundOn;
    $('btn-sound').textContent = soundOn ? '♪' : '×';
    $('btn-sound').style.color = soundOn ? '' : '#B0C4D4';
    if (soundOn) beep(760, .1, 'sine', .04);
  });
  $('btn-save').addEventListener('click', saveCard);
  $('btn-share').addEventListener('click', shareCard);
  $('btn-replay').addEventListener('click', startRun);
  $('btn-change').addEventListener('click', function () { phase = 'select'; go('select'); });

  /* ---------- 启动 ---------- */
  loadPortraits();
  window.CardKit.preload();
  go('title');
  raf = requestAnimationFrame(frame);
})();
