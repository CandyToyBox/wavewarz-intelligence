/* WaveWarZ reward moment: a short full-screen motion piece for "your battle is in the queue" and "your battle is live".
   Call WWCelebrate()            a surprise, one of the effects below
        WWCelebrate('wave')      a wave rolls up from the bottom and throws spray
        WWCelebrate('bubbles')   champagne bubbles rise and pop
   Draws on one canvas above the page, never blocks clicks, removes itself, and does nothing when the visitor has asked for
   reduced motion. No libraries. */
(function () {
  'use strict';
  var running = false;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function wave(ctx, w, h, t, st) {
    /* t runs 0..1. The swell rises to a little over half the screen, holds, then drains away. */
    var rise = t < .45 ? ease(t / .45) : t < .6 ? 1 : 1 - ease((t - .6) / .4);
    var top = h - rise * h * .58, fade = t > .7 ? 1 - (t - .7) / .3 : 1;
    var layers = [
      { amp: 26, len: 420, sp: 2.2, off: 0, a: .22, c1: '126,193,251', c2: '13,19,33' },
      { amp: 18, len: 300, sp: -3.1, off: 22, a: .28, c1: '149,254,124', c2: '13,19,33' },
      { amp: 12, len: 210, sp: 4.4, off: 44, a: .5, c1: '218,236,253', c2: '126,193,251' }
    ];
    layers.forEach(function (L, i) {
      var y0 = top + L.off, g = ctx.createLinearGradient(0, y0 - L.amp, 0, h);
      g.addColorStop(0, 'rgba(' + L.c1 + ',' + (L.a * fade) + ')'); g.addColorStop(1, 'rgba(' + L.c2 + ',' + (L.a * .55 * fade) + ')');
      ctx.beginPath(); ctx.moveTo(0, h);
      for (var x = 0; x <= w + 12; x += 12) ctx.lineTo(x, y0 + Math.sin(x / L.len * 6.283 + t * L.sp * 6.283) * L.amp + Math.sin(x / (L.len * .37) + t * 9 + i) * L.amp * .25);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      if (i === 2) { /* the lit crest line */
        ctx.beginPath();
        for (var x2 = 0; x2 <= w + 12; x2 += 12) { var y = y0 + Math.sin(x2 / L.len * 6.283 + t * L.sp * 6.283) * L.amp + Math.sin(x2 / (L.len * .37) + t * 9 + i) * L.amp * .25; if (x2) ctx.lineTo(x2, y); else ctx.moveTo(x2, y); }
        ctx.strokeStyle = 'rgba(255,255,255,' + (.75 * fade) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
    /* spray thrown off the crest while it is still rising */
    if (t < .5 && st.p.length < 160) for (var k = 0; k < 5; k++) st.p.push({ x: rand(0, w), y: top + rand(-6, 14), vx: rand(-1.2, 1.2), vy: rand(-7, -2.5), r: rand(1, 3.2), life: 1 });
    st.p.forEach(function (p) {
      p.vy += .16; p.x += p.vx; p.y += p.vy; p.life -= .018;
      if (p.life <= 0) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = 'rgba(235,246,255,' + (p.life * .8 * fade) + ')'; ctx.fill();
    });
    st.p = st.p.filter(function (p) { return p.life > 0; });
  }

  function bubbles(ctx, w, h, t, st) {
    if (!st.b) { st.b = []; for (var i = 0; i < 110; i++) st.b.push({ x: rand(0, w), y: h + rand(0, h * .9), r: rand(3, 20), sp: rand(.55, 1.5), wob: rand(0, 6.283), ws: rand(1.5, 4), tint: Math.random(), pop: rand(.08, .5) * h, popped: 0 }); }
    var fade = t > .8 ? 1 - (t - .8) / .2 : 1;
    st.b.forEach(function (b) {
      if (b.popped) {
        b.popped += .08; if (b.popped > 1) return;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + b.popped * 1.4), 0, 6.283); ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - b.popped) * .6 * fade) + ')'; ctx.lineWidth = 1; ctx.stroke(); return;
      }
      b.y -= b.sp * (3.2 + b.r * .12); b.wob += .04 * b.ws; var x = b.x + Math.sin(b.wob) * (6 + b.r * .4);
      if (b.y < b.pop) { b.popped = .01; b.x = x; return; }
      var c = b.tint < .3 ? '149,254,124' : b.tint < .55 ? '126,193,251' : '235,246,255';
      var g = ctx.createRadialGradient(x - b.r * .35, b.y - b.r * .35, b.r * .1, x, b.y, b.r);
      g.addColorStop(0, 'rgba(255,255,255,' + (.5 * fade) + ')'); g.addColorStop(.35, 'rgba(' + c + ',' + (.1 * fade) + ')'); g.addColorStop(1, 'rgba(' + c + ',' + (.28 * fade) + ')');
      ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.283); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(' + c + ',' + (.55 * fade) + ')'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, b.y, b.r * .68, 3.6, 4.6); ctx.strokeStyle = 'rgba(255,255,255,' + (.8 * fade) + ')'; ctx.lineWidth = Math.max(1, b.r * .1); ctx.stroke();
    });
  }

  window.WWCelebrate = function (kind) {
    if (running) return; if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('canvas'), ctx = c.getContext && c.getContext('2d'); if (!ctx) return;
    var fx = kind === 'wave' ? wave : kind === 'bubbles' ? bubbles : (Math.random() < .5 ? wave : bubbles), dur = fx === wave ? 2600 : 3000;
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = innerWidth, h = innerHeight, st = { p: [] }, t0 = null;
    c.width = w * dpr; c.height = h * dpr; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;pointer-events:none';
    document.body.appendChild(c); ctx.scale(dpr, dpr); running = true;
    (function frame(ts) {
      if (t0 === null) t0 = ts; var t = Math.min(1, (ts - t0) / dur);
      ctx.clearRect(0, 0, w, h); fx(ctx, w, h, t, st);
      if (t < 1) requestAnimationFrame(frame); else { c.remove(); running = false; }
    })(performance.now());
  };
})();
