/* ===========================================================
   春满里挑战赛 · 结果卡片生成器（参考随附卡片风格）
   暖粉渐变背景 + 顶部大图 + 圆角白卡 + 胶囊标签 + 按钮质感
   全部文案使用内嵌涂鸦手写字体；资源内联，file:// 可直接导出
   =========================================================== */
(function () {
  'use strict';

  var W = 750, H = 1504, SCALE = 2;
  var CX = W / 2;
  var CARD_X = 42, CARD_W = 666, CARD_Y = 388, CARD_H = 1030;

  var BLUE_900 = '#0B3E6F', BLUE_800 = '#0E5A9C', BLUE_600 = '#1B7BC4';
  var BLUE_400 = '#58B4E8', BLUE_50 = '#EAF7FD';
  var YELLOW_700 = '#E89A12', YELLOW_500 = '#FFC93C';
  var CREAM = '#FFF9E9', INK = '#123A57', MUTED = '#7C8AA6';
  var PURPLE = '#5B4A8A';
  // 统一粉色系（呼应参考的粉色手帐风）：底色柔和粉，模块统一淡粉描边 + 白底，蓝黄数字作视觉焦点
  var PINK_BG_TOP = '#FFF3F9', PINK_BG_MID = '#FDE8F3', PINK_BG_BOT = '#FBE2EF';
  var PINK_FILL = '#FFF4F9', PINK_LINE = '#F6BCD7', PINK_LINE_SOFT = 'rgba(240,150,196,.34)';
  var PINK_SHADOW = 'rgba(224,110,168,.20)';
  // 涂鸦手写字体（子集化站酷快乐体内嵌）；UI 数据用系统字体更清晰
  var HAND = '"HandFont","HanziPen SC",sans-serif';
  var SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  var FONT_READY = false;

  var IDENTITIES = [
    '快乐小猫', '可爱小狗', '幸福居民', '绝美向日葵', '无忧无虑的路人',
    '社区主任', '街道办职员', '喜欢吃瓜的路人', '明棠同事', '周尽野亲友团'
  ];
  var RANKS = [
    { min: 1200, name: '把春天接住的人' },
    { min: 800, name: '向日葵守护者' },
    { min: 480, name: '春满里小太阳' },
    { min: 220, name: '躲雨小能手' },
    { min: 0, name: '刚刚出发的人' }
  ];

  function getRank(score) {
    for (var i = 0; i < RANKS.length; i++) if (score >= RANKS[i].min) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }
  function pickIdentity() {
    return '你是「春满里社区的」' + IDENTITIES[Math.floor(Math.random() * IDENTITIES.length)];
  }
  function pickQuote() {
    var q = window.QUOTES || [];
    if (!q.length) return { text: '风会停，雨会晴，你已经把今天接住了。', src: '——春满里' };
    return q[Math.floor(Math.random() * q.length)];
  }
  function splitQuote(raw) {
    var text = (raw && raw.text) || raw || '';
    var src = (raw && raw.src) || '';
    var m = text.match(/(——.*)$/);
    if (m) { if (!src) src = m[1]; text = text.slice(0, m.index).trim(); }
    return { text: text, src: src };
  }
  function modeLabel(mode) {
    if (mode === 'duo') return '明棠 × 周尽野 · 并肩作战';
    if (mode === 'jinye') return '和周尽野一起';
    return '和明棠一起';
  }

  /* ---------- 绘图工具 ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function softBlob(ctx, x, y, r, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawStar(ctx, cx, cy, r, fill, stroke) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.46;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function drawSunflower(ctx, cx, cy, r, rot, alpha) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var petals = 10;
    for (var i = 0; i < petals; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / petals);
      var g = ctx.createLinearGradient(0, -r, 0, 0);
      g.addColorStop(0, '#FFEBA6'); g.addColorStop(.55, '#FFC93C'); g.addColorStop(1, '#F09A12');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * .32, -r * .34, -r * .24, -r * .90, 0, -r);
      ctx.bezierCurveTo(r * .24, -r * .90, r * .32, -r * .34, 0, 0);
      ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = '#8A5A22'; ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#A9702B'; ctx.beginPath(); ctx.arc(0, 0, r * .28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ---------- 手绘装饰元素（参考粉色手帐风：胶带/波浪线/涂鸦星/爱心/手写标注） ---------- */
  // 斜贴和纸胶带（半透明、带毛边、条纹）
  function washiTape(ctx, cx, cy, w, h, angle, color) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.globalAlpha = .62;
    // 毛边底
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, -h/2);
    for (var x=-w/2; x<=w/2; x+=9) ctx.lineTo(x, -h/2 + (Math.random()-.5)*3);
    for (var y=-h/2; y<=h/2; y+=6) ctx.lineTo(w/2 + (Math.random()-.5)*3, y);
    for (var x2=w/2; x2>=-w/2; x2-=9) ctx.lineTo(x2, h/2 + (Math.random()-.5)*3);
    for (var y2=h/2; y2>=-h/2; y2-=6) ctx.lineTo(-w/2 + (Math.random()-.5)*3, y2);
    ctx.closePath(); ctx.fill();
    // 手绘斜纹
    ctx.globalAlpha = .3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (var d=-h; d<w; d+=14){ ctx.moveTo(d, -h/2); ctx.lineTo(d+h, h/2); }
    ctx.stroke();
    ctx.restore();
  }
  // 手绘波浪线（分隔装饰）
  function waveLine(ctx, x, y, w, amp, color, lw) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i=0;i<=w;i+=4){
      var py = y + Math.sin(i/14*Math.PI)*amp;
      if(i===0) ctx.moveTo(x+i,py); else ctx.lineTo(x+i,py);
    }
    ctx.stroke(); ctx.restore();
  }
  // 涂鸦四角星/闪光
  function doodleSpark(ctx, cx, cy, r, color, rot) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot||0);
    ctx.fillStyle = color; ctx.beginPath();
    for (var i=0;i<8;i++){
      var a=i*Math.PI/4, rr = i%2===0?r:r*0.34;
      var px=Math.cos(a)*rr, py=Math.sin(a)*rr;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 涂鸦爱心
  function doodleHeart(ctx, cx, cy, s, color, rot) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot||0); ctx.scale(s,s);
    ctx.fillStyle=color; ctx.beginPath();
    ctx.moveTo(0,10);
    ctx.bezierCurveTo(-22,-8,-13,-26,0,-14);
    ctx.bezierCurveTo(13,-26,22,-8,0,10);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 手写圈注椭圆（ Doubly-drawn 手绘圈）
  function scribbleEllipse(ctx, cx, cy, rx, ry, color) {
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=2.6; ctx.lineCap='round';
    for(var k=0;k<2;k++){
      ctx.beginPath();
      var rr = k===0?1:1.04;
      for(var a=0;a<=Math.PI*2+0.1;a+=0.18){
        var px=cx+Math.cos(a)*rx*rr+(Math.random()-.5)*1.4;
        var py=cy+Math.sin(a)*ry*rr+(Math.random()-.5)*1.4;
        if(a===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Q版手绘涂鸦风（参考可爱.jpg：粗黑描边 + 粉青黄配色） ---------- */
  // 手绘锯齿/毛边矩形路径
  function sketchRect(ctx, x, y, w, h, rough) {
    var r = rough || 5, step = 13;
    ctx.beginPath();
    ctx.moveTo(x + r, y + (Math.random() - .5) * r);
    for (var px = x + step; px < x + w; px += step) ctx.lineTo(px, y + (Math.random() - .5) * r);
    ctx.lineTo(x + w, y + r);
    for (var py = y + step; py < y + h; py += step) ctx.lineTo(x + w + (Math.random() - .5) * r, py);
    ctx.lineTo(x + w - r, y + h);
    for (var px2 = x + w - step; px2 > x; px2 -= step) ctx.lineTo(px2, y + h + (Math.random() - .5) * r);
    ctx.lineTo(x, y + h - r);
    for (var py2 = y + h - step; py2 > y; py2 -= step) ctx.lineTo(x + (Math.random() - .5) * r, py2);
    ctx.closePath();
  }
  // 身份 → Q版小人配色/装饰（按身份关键字切换，10色涂鸦板）
  function identityStyle(identity) {
    var s = String(identity || '');
    if (/小猫|猫/.test(s)) return { body: '#FF7FB0', accent: '#FF4E8E', ear: 'cat', prop: 'star' };
    if (/小狗|狗/.test(s)) return { body: '#7FD8A0', accent: '#42B978', ear: 'dog', prop: 'bone' };
    if (/向日葵|太阳/.test(s)) return { body: '#FFC93C', accent: '#F19A12', ear: 'none', prop: 'sun' };
    if (/主任|职员|街道/.test(s)) return { body: '#7FC8F5', accent: '#3E9BE0', ear: 'none', prop: 'tie' };
    if (/同事|亲友/.test(s)) return { body: '#B79BF0', accent: '#8A67D8', ear: 'none', prop: 'heart' };
    if (/快乐|幸福/.test(s)) return { body: '#FF9EC4', accent: '#F56BA4', ear: 'cat', prop: 'heart' };
    if (/路人|吃瓜/.test(s)) return { body: '#FFD97A', accent: '#F0AE2E', ear: 'none', prop: 'star' };
    return { body: '#8FD9E8', accent: '#4FB8CE', ear: 'dog', prop: 'star' };
  }
  // 涂鸦Q版小人：圆脑袋+大眼+腮红+小手小脚+装饰，粗黑描边
  function drawQMascot(ctx, cx, cy, scale, style) {
    var st = style || identityStyle('');
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var INK2 = '#241F2E', LW = 5.5;
    // 光晕底
    ctx.globalAlpha = .28; ctx.fillStyle = st.accent;
    ctx.beginPath(); ctx.arc(0, 6, 78, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 脚
    ctx.fillStyle = st.accent; ctx.strokeStyle = INK2; ctx.lineWidth = LW;
    [-30, 30].forEach(function (dx) {
      ctx.beginPath(); ctx.ellipse(dx, 74, 20, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // 身体（圆润梯形）
    ctx.fillStyle = st.body;
    ctx.beginPath();
    ctx.moveTo(-40, -4); ctx.quadraticCurveTo(-52, 62, -30, 70);
    ctx.lineTo(30, 70); ctx.quadraticCurveTo(52, 62, 40, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 小手
    [-1, 1].forEach(function (sg) {
      ctx.save(); ctx.translate(sg * 46, 22); ctx.rotate(sg * .55);
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = st.body; ctx.fill(); ctx.stroke(); ctx.restore();
    });
    // 耳朵
    if (st.ear === 'cat') {
      ctx.fillStyle = st.body;
      [-1, 1].forEach(function (sg) {
        ctx.beginPath(); ctx.moveTo(sg * 30, -58); ctx.lineTo(sg * 46, -96); ctx.lineTo(sg * 8, -74); ctx.closePath();
        ctx.fill(); ctx.stroke();
      });
    } else if (st.ear === 'dog') {
      ctx.fillStyle = st.accent;
      [-1, 1].forEach(function (sg) {
        ctx.beginPath(); ctx.ellipse(sg * 46, -44, 15, 28, sg * .3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }
    // 脑袋
    ctx.fillStyle = st.body;
    ctx.beginPath(); ctx.ellipse(0, -40, 56, 52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 眼睛（大黑点+高光）
    ctx.fillStyle = INK2;
    [-20, 20].forEach(function (dx) {
      ctx.beginPath(); ctx.ellipse(dx, -46, 6.5, 9, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#fff';
    [-20, 20].forEach(function (dx) { ctx.beginPath(); ctx.arc(dx + 2, -49, 2.2, 0, Math.PI * 2); ctx.fill(); });
    // 腮红
    ctx.globalAlpha = .55; ctx.fillStyle = '#FF5E8A';
    [-36, 36].forEach(function (dx) { ctx.beginPath(); ctx.ellipse(dx, -30, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    // 嘴（小w）
    ctx.strokeStyle = INK2; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-7, -30); ctx.quadraticCurveTo(0, -22, 7, -30); ctx.stroke();
    // 头顶装饰
    if (st.prop === 'sun') {
      ctx.save(); ctx.translate(0, -92);
      for (var i = 0; i < 8; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 4);
        ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.ellipse(0, -16, 6, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#8A5A22'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (st.prop === 'heart' || st.prop === 'star' || st.prop === 'tie') {
      ctx.fillStyle = st.accent; ctx.strokeStyle = INK2; ctx.lineWidth = 3.5;
      if (st.prop === 'heart') {
        ctx.beginPath();
        ctx.moveTo(0, -118); ctx.bezierCurveTo(-18, -134, -26, -110, 0, -98); ctx.bezierCurveTo(26, -110, 18, -134, 0, -118); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        drawStar(ctx, 0, -112, 15, st.accent, INK2);
      }
    }
    ctx.restore();
  }
  // 绘制结果动物（7种随机）：优先用 game.js 传入的 mascotIndex，否则随机；未加载回退程序化Q版
  var MASCOT_COUNT = 7;
  var lastDrawnMascot = -1;
  function chooseMascotIndex(hint) {
    var idx;
    if (typeof hint === 'number' && hint >= 0 && hint < MASCOT_COUNT) idx = hint;
    else {
      idx = Math.floor(Math.random() * MASCOT_COUNT);
      if (idx === lastDrawnMascot) idx = (idx + 1 + Math.floor(Math.random() * (MASCOT_COUNT - 1))) % MASCOT_COUNT;
    }
    lastDrawnMascot = idx;
    return idx;
  }
  function drawIdentityMascot(ctx, cx, cy, box, style, hint) {
    var p = window.PORTRAITS || {};
    var arr = p.identityMascots || [];
    var idx = chooseMascotIndex(hint);
    var src = arr.length ? arr[idx] : (p.identityMascot || null);
    var img = src ? imgCache[src] : null;
    if (img && img.complete && img.naturalWidth) {
      var s = Math.min(box / img.naturalWidth, box / img.naturalHeight);
      var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      // 轻微落影，让抠图在浅色卡上更立体
      ctx.save();
      ctx.shadowColor = 'rgba(36,31,46,.18)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } else {
      drawQMascot(ctx, cx, cy, box / 210, style);
    }
  }
  function wrapText(ctx, text, maxWidth) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }
  function pill(ctx, text, cx, cy, opts) {
    var o = opts || {};
    ctx.font = '900 ' + (o.size || 20) + 'px ' + (o.hand === false ? SANS : HAND);
    var w = ctx.measureText(text).width + (o.pad || 32) * 2;
    var h = o.h || 42;
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = o.bg || YELLOW_500; ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = o.color || '#7A4D00';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    return w;
  }

  /* ---------- 资源 ---------- */
  var imgCache = {};
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      if (imgCache[src]) { resolve(imgCache[src]); return; }
      var img = new Image();
      img.onload = function () { imgCache[src] = img; resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  function preload() {
    var p = window.PORTRAITS || {};
    var jobs = [loadImage(p.mingtang), loadImage(p.jinye), loadImage(p.duo), loadImage(p.cardBg), loadImage(p.sceneDay), loadImage(p.sceneNight)];
    var mascots = p.identityMascots || [];
    for (var mi = 0; mi < mascots.length; mi++) jobs.push(loadImage(mascots[mi]));
    // 加载涂鸦字体，确保 Canvas 首绘即用正确字形
    try {
      if (document.fonts && document.fonts.load) {
        jobs.push(document.fonts.load('40px HandFont').then(function () {
          return document.fonts.ready;
        }).then(function () { FONT_READY = true; }).catch(function () { FONT_READY = true; }));
      } else { FONT_READY = true; }
    } catch (e) { FONT_READY = true; }
    return Promise.all(jobs);
  }
  function drawAvatar(ctx, img, cx, cy, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(11,62,111,.28)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 9;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    if (img) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = Math.min(img.height - s, img.height * .04);
      ctx.drawImage(img, sx, sy, s, s, cx - r, cy - r, r * 2, r * 2);
      ctx.restore(); ctx.save();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,201,60,.9)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  function drawCoverImage(ctx, img, x, y, w, h) {
    if (!img) return false;
    var iw = img.width, ih = img.height, scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale, dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }
  // 昼夜封面：白天场景为底 + 夜色渐隐 + 太阳东升西落弧线轨迹（静态呈现一帧「破晓」）
  function drawCover(ctx, dayImg, nightImg) {
    var x = CARD_X, y = 52, w = CARD_W, h = 316, r = 34;
    ctx.save();
    ctx.shadowColor = PINK_SHADOW; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
    roundRect(ctx, x, y, w, h, r); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    roundRect(ctx, x + 8, y + 8, w - 16, h - 16, r - 8); ctx.clip();

    var cy = y + 8, ch = h - 16;
    // 白天场景图打底
    var got = drawCoverImage(ctx, dayImg, x + 8, cy, w - 16, ch);
    if (!got) {
      var g = ctx.createLinearGradient(0, cy, 0, cy + ch);
      g.addColorStop(0, '#243C74'); g.addColorStop(.55, '#B98BC0'); g.addColorStop(1, '#F4C98A');
      ctx.fillStyle = g; ctx.fillRect(x + 8, cy, w - 16, ch);
    }
    // 夜色蒙层：顶部深蓝 → 中部透明 → 底部暖（呈现黑夜转白天）
    var ng = ctx.createLinearGradient(0, cy, 0, cy + ch);
    ng.addColorStop(0, 'rgba(10,18,54,.72)'); ng.addColorStop(.42, 'rgba(24,32,74,.30)');
    ng.addColorStop(.72, 'rgba(255,190,120,.10)'); ng.addColorStop(1, 'rgba(255,214,150,.28)');
    ctx.fillStyle = ng; ctx.fillRect(x + 8, cy, w - 16, ch);

    // 星星（夜空侧）
    var starSeed = [ [70,60,2.4],[140,44,1.6],[205,74,2],[300,52,1.8],[380,80,1.5],
                     [455,48,2.2],[520,70,1.6],[585,54,2],[150,110,1.4],[355,118,1.7],[500,116,1.5] ];
    starSeed.forEach(function (p) {
      ctx.globalAlpha = .55 + (p[2] / 3);
      ctx.fillStyle = '#FFF6D8'; ctx.beginPath(); ctx.arc(x + 8 + p[0], cy + p[1], p[2], 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 太阳东升西落轨迹（从左到右的弧线，太阳停在中段偏右，呈现向西落下走势）
    var arcY0 = cy + 150, spanX = x + 70, spanW = w - 140, apex = cy + 22;
    ctx.save();
    ctx.setLineDash([7, 9]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,236,180,.55)';
    ctx.beginPath();
    for (var t = 0; t <= 1.001; t += .02) {
      var px = spanX + spanW * t;
      var py = arcY0 - (arcY0 - apex) * Math.sin(Math.PI * t);
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);
    // 太阳（t≈0.62，西行下落中）
    var st = .62, sx = spanX + spanW * st, sy = arcY0 - (arcY0 - apex) * Math.sin(Math.PI * st);
    var halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
    halo.addColorStop(0, 'rgba(255,240,170,.95)'); halo.addColorStop(.4, 'rgba(255,201,60,.45)'); halo.addColorStop(1, 'rgba(255,201,60,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF3B0'; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    // 文字可读性蒙层
    var vg = ctx.createLinearGradient(0, y, 0, y + h);
    vg.addColorStop(0, 'rgba(8,26,48,.18)'); vg.addColorStop(.62, 'rgba(8,26,48,.05)'); vg.addColorStop(1, 'rgba(8,26,48,.32)');
    ctx.fillStyle = vg; ctx.fillRect(x + 8, cy, w - 16, ch);
    ctx.restore();

    // 图上文字
    ctx.textAlign = 'center';
    ctx.font = '900 22px ' + HAND; ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText('春 满 里 · 春 日 限定', CX, y + 52);
    ctx.font = '900 44px ' + HAND; ctx.fillStyle = '#FFF8E6';
    ctx.shadowColor = 'rgba(8,26,48,.65)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillText('接住整个春天', CX, y + 128);
    ctx.shadowColor = 'transparent';
    ctx.font = '900 20px ' + HAND; ctx.fillStyle = 'rgba(255,246,218,.95)';
    ctx.fillText('从黑夜走到天亮 · 接住整个春天', CX, y + 176);
    ctx.textAlign = 'left';

    // 四角斜贴和纸胶带（手帐拼贴感）
    washiTape(ctx, x + 52, y + 30, 96, 30, -0.62, '#FFD3E6');
    washiTape(ctx, x + w - 46, y + 26, 78, 28, 0.58, '#FFE7A8');
    washiTape(ctx, x + 44, y + h - 26, 84, 28, 0.55, '#C7E9FF');
    washiTape(ctx, x + w - 52, y + h - 30, 92, 28, -0.5, '#FFD3E6');
  }

  function drawBackground(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PINK_BG_TOP); g.addColorStop(.42, PINK_BG_MID); g.addColorStop(1, PINK_BG_BOT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    softBlob(ctx, 90, 120, 180, '#FFC9DF', .5);
    softBlob(ctx, 680, 250, 200, '#FFD9C4', .5);
    softBlob(ctx, 120, 1080, 210, '#FFC2D9', .55);
    softBlob(ctx, 660, 1080, 190, '#F3CDF0', .5);
    drawStar(ctx, 96, 300, 16, 'rgba(255,255,255,.9)', null);
    drawStar(ctx, 690, 430, 12, 'rgba(255,255,255,.85)', null);
    drawStar(ctx, 640, 130, 10, 'rgba(255,201,60,.75)', null);
    drawSunflower(ctx, 706, 1108, 40, .2, .55);
    drawSunflower(ctx, 44, 760, 30, -.4, .4);
    // 手绘涂鸦散点：星星 / 爱心 / 波浪，营造手帐氛围
    doodleSpark(ctx, 66, 470, 13, 'rgba(255,170,205,.62)', .3);
    doodleSpark(ctx, 700, 700, 10, 'rgba(255,205,110,.7)', -.2);
    doodleSpark(ctx, 88, 960, 9, 'rgba(160,205,245,.7)', .5);
    doodleHeart(ctx, 690, 930, .52, 'rgba(255,150,190,.5)', .25);
    doodleHeart(ctx, 70, 620, .4, 'rgba(255,180,210,.45)', -.3);
    waveLine(ctx, 636, 560, 46, 4, 'rgba(255,170,205,.5)', 3);
    waveLine(ctx, 56, 1180, 40, 3.5, 'rgba(255,205,110,.55)', 3);
    // 圆点虚线点缀
    ctx.fillStyle = 'rgba(255,160,200,.4)';
    [[710,80,4],[40,400,3],[720,1240,3.5],[100,1300,3]].forEach(function(p){
      ctx.beginPath(); ctx.arc(p[0],p[1],p[2],0,Math.PI*2); ctx.fill();
    });
  }

  function drawCardBody(ctx) {
    ctx.save();
    ctx.shadowColor = PINK_SHADOW; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
    roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 40); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    roundRect(ctx, CARD_X + 6, CARD_Y + 6, CARD_W - 12, CARD_H - 12, 34);
    ctx.strokeStyle = 'rgba(246,188,215,.7)'; ctx.lineWidth = 2; ctx.stroke();
  }

  function splitIdentity(raw) {
    var s = String(raw || '你是「春满里社区的」幸福居民');
    var m = s.match(/「春满里社区的」\s*(.+)$/);
    if (m) return { prefix: '你是「春满里社区的」', name: m[1].trim() };
    return { prefix: '你是「春满里社区的」', name: s };
  }
  // 身份英雄大图卡：黄底涂鸦 + 锯齿白卡 + Q版小人 + 分数标签 + 身份文案
  function drawIdentityHero(ctx, identity, score, mode, mascotIndex) {
    var info = splitIdentity(identity);
    var st = identityStyle(info.name);
    var x = CARD_X + 22, y = CARD_Y + 24, w = CARD_W - 44, h = 274;

    // 黄色涂鸦外底：粗黑描边 + 柔和阴影
    ctx.save();
    ctx.shadowColor = PINK_SHADOW; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, 30);
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#FFE27A'); g.addColorStop(1, '#FFC42E');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#241F2E'; ctx.lineWidth = 5;
    roundRect(ctx, x, y, w, h, 30); ctx.stroke();

    // 手绘锯齿白色内卡
    sketchRect(ctx, x + 15, y + 15, w - 30, h - 30, 5);
    ctx.fillStyle = '#FFFDF6'; ctx.fill();
    ctx.strokeStyle = '#241F2E'; ctx.lineWidth = 3.5; ctx.stroke();

    // 左上倾斜黑色分数标签（参考 可爱.jpg 的分数贴纸）
    ctx.save();
    ctx.translate(x + 46, y + 50); ctx.rotate(-.13);
    var tag = '★ 星光 ' + score;
    ctx.font = '900 22px ' + HAND;
    var tw = ctx.measureText(tag).width + 40;
    roundRect(ctx, -tw / 2, -20, tw, 40, 20); ctx.fillStyle = '#241F2E'; ctx.fill();
    ctx.fillStyle = '#FFD85E'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tag, 0, 2);
    ctx.restore();

    // 左侧结果动物（7种随机选中的抠图素材）
    drawIdentityMascot(ctx, x + 150, y + 154, 214, st, mascotIndex);

    // 右侧文案
    var tx = x + 292, right = x + w - 26;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 18px ' + HAND; ctx.fillStyle = '#8A7FA8';
    ctx.fillText(info.prefix, tx, y + 96);
    // 身份名：按字数自适应字号，粗黑描边 + 主题色填充
    var name = info.name, fs = name.length >= 7 ? 34 : (name.length >= 5 ? 40 : 46);
    ctx.font = '900 ' + fs + 'px ' + HAND;
    while (ctx.measureText(name).width > (right - tx) && fs > 26) {
      fs -= 2; ctx.font = '900 ' + fs + 'px ' + HAND;
    }
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = '#241F2E';
    ctx.strokeText(name, tx, y + 162);
    ctx.fillStyle = st.accent; ctx.fillText(name, tx, y + 162);
    // 副标题胶囊
    pill(ctx, modeLabel(mode), tx + ctx.measureText(name).width / 2, y + 210,
      { size: 15, h: 32, bg: '#FFF7DF', color: BLUE_800, border: 'rgba(36,31,46,.55)' });
    // 手绘装饰：动物头像旁闪光 + 身份文案区涂鸦星/爱心
    doodleSpark(ctx, x + 62, y + 78, 11, 'rgba(255,170,60,.85)', .2);
    doodleSpark(ctx, x + 250, y + 226, 8, 'rgba(120,190,240,.85)', -.3);
    doodleHeart(ctx, x + 268, y + 92, .42, 'rgba(255,130,175,.8)', .25);
    waveLine(ctx, tx + 12, y + 190, Math.min(120, right - tx - 20), 3, 'rgba(255,180,80,.7)', 2.6);
    ctx.textBaseline = 'middle';
  }

  function drawStatPill(ctx, x, y, w, emoji, label, value, unit) {
    roundRect(ctx, x, y, w, 118, 24); ctx.fillStyle = PINK_FILL; ctx.fill();
    ctx.strokeStyle = PINK_LINE_SOFT; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '30px ' + HAND; ctx.fillStyle = YELLOW_700; ctx.fillText(emoji, x + w / 2, y + 40);
    ctx.font = '900 18px ' + HAND; ctx.fillStyle = MUTED; ctx.fillText(label, x + w / 2, y + 70);
    ctx.font = '900 34px ' + SANS; ctx.fillStyle = BLUE_800;
    var vtxt = String(value) + (unit || '');
    ctx.fillText(vtxt, x + w / 2, y + 104);
    // 数值下方手绘波浪线（手帐强调）
    var vw = ctx.measureText(vtxt).width;
    waveLine(ctx, x + w / 2 - vw / 2, y + 112, vw, 2.5, 'rgba(255,170,60,.55)', 2.4);
    ctx.textAlign = 'left';
  }

  /* ---------- 本局好友（跟随玩家所选角色） ---------- */
  function friendInfo(mode) {
    if (mode === 'duo') return { names: '明棠 & 周尽野', keys: ['mingtang', 'jinye'], duo: true };
    if (mode === 'jinye') return { names: '周尽野', keys: ['jinye'], duo: false };
    return { names: '明棠', keys: ['mingtang'], duo: false };
  }
  function drawFriendFigures(ctx, keys, x, y, w, h) {
    var p = window.PORTRAITS || {};
    var imgs = [];
    for (var i = 0; i < keys.length; i++) {
      var img = imgCache[p[keys[i]]];
      if (img) imgs.push(img);
    }
    if (!imgs.length) return;
    var n = imgs.length, slot = w / n;
    for (var j = 0; j < n; j++) {
      var im = imgs[j];
      var scale = Math.min(slot / im.width, h / im.height);
      var dw = im.width * scale, dh = im.height * scale;
      var dx = x + j * slot + (slot - dw) / 2;
      var dy = y + (h - dh); // 底部对齐，站成一排
      ctx.drawImage(im, dx, dy, dw, dh);
    }
  }
  function drawFriendCard(ctx, mode) {
    var info = friendInfo(mode);
    var x = CARD_X + 40, w = CARD_W - 80;
    var y = CARD_Y + 780, h = 176;

    // 背景：与整体卡片统一的白色半透明渐变 + 圆角 + 粉色细边框 + 柔阴影
    ctx.save();
    ctx.shadowColor = PINK_SHADOW; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, w, h, 22);
    var bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, 'rgba(255,255,255,.97)'); bg.addColorStop(1, 'rgba(255,240,248,.97)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PINK_LINE_SOFT; ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 22); ctx.stroke();

    // 左上小标签
    pill(ctx, '本局搭档', x + 66, y + 30, { size: 14, h: 28, bg: '#FFF7DF', color: BLUE_800, border: 'rgba(255,201,60,.85)' });

    // 左侧抠图立绘区
    drawFriendFigures(ctx, info.keys, x + 14, y + 34, 196, h - 46);

    // 右侧文字
    var tx = x + 226;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 19px ' + HAND; ctx.fillStyle = MUTED;
    ctx.fillText('你的「春满里」好友是', tx, y + 80);
    ctx.font = '900 ' + (info.duo ? 34 : 42) + 'px ' + HAND; ctx.fillStyle = BLUE_800;
    ctx.fillText(info.names, tx, y + 134);
    // 手绘装饰：好友名下方波浪 + 涂鸦星
    var nw = ctx.measureText(info.names).width;
    waveLine(ctx, tx + 4, y + 148, Math.min(nw, w - tx - 30), 3, 'rgba(255,180,80,.6)', 2.6);
    doodleSpark(ctx, x + w - 30, y + 34, 9, 'rgba(255,150,190,.7)', .3);
    ctx.textBaseline = 'middle';
  }

  function generate(canvas, result) {
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    var r = result || {};
    var score = Math.max(0, Math.round(r.score || 0));
    var rank = getRank(score);
    var p = window.PORTRAITS || {};
    var identity = r.identity || pickIdentity();
    var quote = splitQuote(r.quote || pickQuote());

    drawBackground(ctx);
    drawCover(ctx, imgCache[p.sceneDay] || imgCache[p.cardBg], imgCache[p.sceneNight]);
    drawCardBody(ctx);

    // 身份英雄大图卡（Q版手绘 + 身份文案 + 分数贴纸 + 随机结果动物）
    drawIdentityHero(ctx, identity, score, r.mode, r.mascotIndex);

    // 手绘虚线分隔（身份卡与数据区之间）
    ctx.save();
    ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(246,160,200,.5)';
    ctx.beginPath(); ctx.moveTo(CARD_X + 120, CARD_Y + 316); ctx.lineTo(CARD_X + CARD_W - 120, CARD_Y + 316); ctx.stroke();
    ctx.restore();

    // 星光值区域（视觉焦点）：手绘小标签 + 柔光 + 大数字，垂直间距均匀、层次不重叠
    pill(ctx, '星 光 值', CX, CARD_Y + 336, { size: 16, h: 30, pad: 22, bg: '#FFF3D8', color: BLUE_800, border: PINK_LINE });
    softBlob(ctx, CX, CARD_Y + 424, 118, 'rgba(255,226,150,.5)');
    ctx.textAlign = 'center';
    ctx.font = '900 90px ' + SANS; ctx.fillStyle = BLUE_800;
    ctx.fillText(String(score), CX, CARD_Y + 442);
    ctx.textAlign = 'left';

    // 三个数据胶囊（与数字之间留出均匀间距）
    var gap = 12, pw = (CARD_W - 80 - gap * 2) / 3, px = CARD_X + 40, py = CARD_Y + 480;
    drawStatPill(ctx, px, py, pw, '★', '星光值', score, '');
    drawStatPill(ctx, px + pw + gap, py, pw, '⚡', '最高连击', r.maxCombo || 0, '');
    drawStatPill(ctx, px + (pw + gap) * 2, py, pw, '◷', '坚持时间', (r.time || 0).toFixed(0), 's');

    // 随机文案卡（暖米底 + 统一粉色描边）
    var qy = CARD_Y + 630;
    roundRect(ctx, CARD_X + 40, qy, CARD_W - 80, 132, 22); ctx.fillStyle = CREAM; ctx.fill();
    ctx.strokeStyle = PINK_LINE_SOFT; ctx.lineWidth = 2;
    roundRect(ctx, CARD_X + 40, qy, CARD_W - 80, 132, 22); ctx.stroke();
    ctx.font = '900 34px ' + HAND; ctx.fillStyle = 'rgba(255,201,60,.7)'; ctx.textAlign = 'left';
    ctx.fillText('“', CARD_X + 56, qy + 42);
    ctx.textAlign = 'center'; ctx.font = '900 20px ' + HAND; ctx.fillStyle = INK;
    var lines = wrapText(ctx, quote.text, CARD_W - 150);
    var startY = qy + (lines.length >= 3 ? 44 : 56);
    for (var i = 0; i < lines.length && i < 3; i++) ctx.fillText(lines[i], CX, startY + i * 30);
    if (quote.src) {
      ctx.font = '900 15px ' + HAND; ctx.fillStyle = MUTED; ctx.textAlign = 'right';
      ctx.fillText(quote.src, CARD_X + CARD_W - 62, qy + 116);
    }
    // 手绘装饰：右下角涂鸦星 + 手写英文标注贴纸
    doodleSpark(ctx, CARD_X + 74, qy + 108, 8, 'rgba(255,175,70,.75)', .3);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(CARD_X + 76, qy + 20); ctx.rotate(-.08);
    ctx.font = '900 11px ' + HAND; ctx.fillStyle = 'rgba(230,150,90,.72)';
    ctx.fillText('words for you', 0, 0);
    ctx.restore();

    // 本局好友卡（跟随玩家所选角色，背景与整体统一）
    drawFriendCard(ctx, r.mode);

    // 底部日期 + 品牌
    var d = r.date || new Date();
    var dateStr = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    ctx.font = '900 15px ' + HAND; ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText('春满里挑战赛  ·  ' + dateStr + '  ·  历史最佳 ' + (r.best || 0) + ' 分', CX, CARD_Y + CARD_H - 26);
    ctx.textAlign = 'left';

    // 卡片外页脚
    ctx.font = '900 15px ' + HAND; ctx.fillStyle = 'rgba(123,106,160,.75)'; ctx.textAlign = 'center';
    ctx.fillText('截图保存，分享你的春天 ☀', CX, H - 26);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  }

  window.CardKit = {
    preload: preload, generate: generate,
    getRank: getRank, pickQuote: pickQuote, pickIdentity: pickIdentity, modeLabel: modeLabel
  };
})();
