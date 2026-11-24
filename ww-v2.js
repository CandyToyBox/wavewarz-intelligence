/* WaveWarZ v2 layer: the Wave ID strand background with its mouse effect, and the "wavy" easter egg.
   Shared by every page that loads ww-v2.css. Nothing here is needed for a page to work. */
(function () {
  'use strict';
  if (window.__wwV2) return; window.__wwV2 = true;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches, FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

  function start() {
    /* Background: Wave ID strands drift slowly; near the cursor they light up and bend away */
    if (window.self === window.top && !document.getElementById('v2Strands')) {   /* not inside an embedded panel */
      var c = document.createElement('canvas'); c.id = 'v2Strands'; c.setAttribute('aria-hidden', 'true');
      var v = document.createElement('div'); v.className = 'v2-vig'; v.setAttribute('aria-hidden', 'true');
      document.body.prepend(v); document.body.prepend(c);
      var x = c.getContext('2d'), W = 0, H = 0, dpr = Math.min(1.5, window.devicePixelRatio || 1), mx = -9999, my = -9999, sx = -9999, sy = -9999, t = 0, raf = 0, strands = [];
      var COLS = [[149, 254, 124], [126, 193, 251], [218, 236, 253]];
      var seed = function () { strands = []; var n = Math.round(Math.min(60, Math.max(24, W / 26))); for (var i = 0; i < n; i++) strands.push({ y: (i + .5) / n * H, a: Math.random() * 6.28, f: .0015 + Math.random() * .002, amp: 30 + Math.random() * 80, sp: .15 + Math.random() * .35, c: COLS[i % 3], w: Math.random() < .25 ? 1.3 : .8 }); };
      var draw = function () {
        x.clearRect(0, 0, W, H); sx += (mx - sx) * .18; sy += (my - sy) * .18;
        for (var i = 0; i < strands.length; i++) {
          var s = strands[i], hot = 0; x.beginPath();
          for (var px = -20; px <= W + 20; px += 16) {
            var py = s.y + Math.sin(px * s.f + s.a + t * s.sp) * s.amp + Math.sin(px * .011 + t * .3 + i) * 8;
            var dx = px - sx, dy = py - sy, d = Math.sqrt(dx * dx + dy * dy);
            if (d < 200) { var k = 1 - d / 200; py += (dy > 0 ? 1 : -1) * k * k * 34; hot = Math.max(hot, k); }
            if (px === -20) x.moveTo(px, py); else x.lineTo(px, py);
          }
          x.strokeStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + Math.min(.6, .1 + hot * .5) + ')'; x.lineWidth = s.w + hot * .7; x.stroke();
        }
      };
      var size = function () { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); seed(); draw(); };
      var loop = function () { t += .004; draw(); raf = requestAnimationFrame(loop); };
      addEventListener('resize', function () { clearTimeout(size.t); size.t = setTimeout(size, 150); });
      if (FINE && !RM) { addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; if (sx < -999) { sx = mx; sy = my; } }, { passive: true }); document.documentElement.addEventListener('pointerleave', function () { mx = my = -9999; }); }
      document.addEventListener('visibilitychange', function () { cancelAnimationFrame(raf); if (!document.hidden && !RM) loop(); });
      size(); if (!RM) loop();
    }

    /* Easter egg: type "wavy" anywhere and DJ Wavy has something to say */
    if (!document.getElementById('v2Toast')) {
      var tst = document.createElement('div'); tst.className = 'v2-toast'; tst.id = 'v2Toast'; tst.setAttribute('role', 'status'); tst.setAttribute('aria-live', 'polite');
      tst.innerHTML = '<img id="v2TImg" src="djwavy/smug.webp" alt=""><p><b>DJ Wavy</b><span id="v2TTxt"></span></p>';
      document.body.appendChild(tst);
      var tt, LINES = [["If it's not genius, don't waste my time.", "smug"], ["I've heard better. I've also heard much worse.", "thinking"], ["Trade the one you believe in. I'll be judging.", "wink"], ["You found me. Now go vote.", "laughing"]];
      window.wavySays = window.wavySays || function (line, face) { document.getElementById('v2TTxt').textContent = line; document.getElementById('v2TImg').src = 'djwavy/' + (face || 'smug') + '.webp'; tst.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { tst.classList.remove('show'); }, 4200); };
      var buf = '';
      addEventListener('keydown', function (e) {
        if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
        if (!e.key || e.key.length !== 1) return;
        buf = (buf + e.key.toLowerCase()).slice(-4);
        if (buf === 'wavy') { var l = LINES[Math.floor(Math.random() * LINES.length)]; window.wavySays(l[0], l[1]); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
