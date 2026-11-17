#!/usr/bin/env python3
"""Builds quick-battles.html from index.html so the queue page always uses the exact chrome dock, nav, footer, forms and
action module from the homepage. Run it again after changing any of those in index.html:

    python3 tools/build-queue-page.py
"""
import os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
s = open('index.html', encoding='utf-8').read()

def between(start, end, include_end=True):
    i = s.index(start); j = s.index(end, i)
    return s[i:j + (len(end) if include_end else 0)]
def script(sid):
    return between('<script id="%s">' % sid, '</script>')
def local(html):
    """In-page anchors on the homepage become links back to it."""
    return re.sub(r'href="#([a-z0-9-]+)"', lambda m: 'href="index.html#%s"' % m.group(1), html)

head = s[:s.index('<body')]
head = re.sub(r'<title>.*?</title>', '<title>Quick BattleZ queue | WaveWarZ</title>', head, count=1, flags=re.S)
head = re.sub(r'(<meta name="description" content=")[^"]*(")', r'\1Every Quick BattleZ waiting to play on WaveWarZ. Launch the next battle, skip to the front, or open a finished battle.\2', head, count=1)
head = re.sub(r'\s*<meta property="og:[^>]*>', '', head)
head = re.sub(r'\s*<meta name="twitter:[^>]*>', '', head)
head = re.sub(r'\s*<link rel="canonical"[^>]*>', '', head)
head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
head = re.sub(r'\s*<script type="module" src="[^"]*model-viewer[^"]*"></script>', '', head)

PAGE_CSS = '''
<style id="queue-page-css">
/* Queue page only. Everything else comes from the homepage styles above. */
body[data-page="queue"] .qp { padding-top: 132px; }
body[data-page="queue"] .qp-all { display: none; }
.ql { padding-top: 24px; }
.ql .hl-ph .ql-h { margin: 0; font: 700 var(--fs-h3, 1.15rem)/1.2 'Space Grotesk', sans-serif; letter-spacing: -.005em; color: #fff; text-transform: none; }
.ql .hl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.ql .hl-row { grid-template-columns: 30px 70px minmax(0, 1fr) auto; }
.ql .hl-rk { font-size: .95rem; }
.ql-btn { height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; white-space: nowrap; font: 700 .72rem 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-ice); background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.28); transition: border-color .2s ease, color .2s ease, background-color .2s ease; text-decoration: none; display: inline-flex; align-items: center; }
.ql-btn:hover { border-color: var(--brand-green); color: var(--brand-green); }
.ql-btn.go { color: #06090f; background: var(--brand-green); border-color: rgba(255,255,255,.4); }
.ql-btn.go:hover { background: #b6ffa4; color: #06090f; }
.ql-now { color: var(--brand-green); }
.ql-foot { margin: 14px 4px 6px; font: 400 .72rem/1.6 'JetBrains Mono', monospace; letter-spacing: .04em; color: var(--text-muted); }
@media (max-width: 1100px) { .ql .hl-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .ql .hl-row { grid-template-columns: 22px minmax(0, 1fr) auto; } .ql .hl-art { display: none; } .ql-btn { padding: 0 12px; } }
</style>
'''

nav = local(between('  <div class="nav-wrapper">', '    </nav>\n  </div>'))
nav = nav.replace('href="index.html#top"', 'href="index.html"')
dock = between('  <section id="quick-queue"', '  </section>')
dock = dock.replace('<section id="quick-queue" class="qp"', '<section id="quick-queue" class="qp is-flow"')
dock = dock.replace('<h2 class="section-title" id="qbTitle">', '<h1 class="section-title" id="qbTitle">').replace('SONG VS SONG.</span></h2>', 'SONG VS SONG.</span></h1>')
assert 'id="qbTitle">' in dock and '</h1>' in dock
dialogs = between('  <!-- FORMS: one chrome module', '  <!-- FOOTER -->\n  <footer class="cp-foot">', include_end=False)
footer = local(between('  <footer class="cp-foot">', '  </footer>'))

LISTS = '''
  <!-- THE WHOLE QUEUE and RECENTLY FINISHED: leaderboard rows from the homepage Top 5 panels -->
  <section id="queue-lists" class="cp-sec hl ql" aria-label="The whole queue and finished battles">
    <div class="hl-in">
      <div class="hl-grid">
        <article class="hl-panel">
          <header class="hl-ph"><div><h2 class="ql-h">Up next</h2><p id="qlCount">Every battle waiting to play</p></div></header>
          <ol class="hl-list" id="qlQueue"><li class="hl-empty">Loading the queue.</li></ol>
          <p class="ql-foot" id="qlNote"></p>
        </article>
        <article class="hl-panel" id="recent">
          <header class="hl-ph"><div><h2 class="ql-h">Recently finished</h2><p>Open a battle to see the result and Withdraw</p></div></header>
          <ol class="hl-list" id="qlRecent"><li class="hl-empty">Loading finished battles.</li></ol>
        </article>
      </div>
    </div>
  </section>
'''

PAGE_JS = r'''<script id="queue-page-js">
/* Queue page lists. The dock script above loads the queue and announces it with a "ww-queue" event; this draws the full list from it.
   Finished battles come from /api/quick-battles/recent (sample file when that is not reachable from this host). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, BASE = window.WW_API_BASE || 'https://www.wavewarz.com';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pair(a, b) { function d(u) { return '<i><b>' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</b></i>'; } return '<span class="hl-art pair">' + d(a) + d(b) + '</span>'; }
  function text(x) { return '<span class="hl-tx"><span class="hl-t">' + esc(x.artist1_track_title) + ' vs ' + esc(x.artist2_track_title) + '</span><span class="hl-s">@' + esc(x.artist1_handle) + ' vs @' + esc(x.artist2_handle) + '</span></span>'; }
  var last = null;
  document.addEventListener('ww-queue', function (e) {
    var d = e.detail.data, price = e.detail.price, act = d.active || [], q = d.queued || [], rows = [];
    last = e.detail;
    act.forEach(function (x) {
      rows.push('<li><div class="hl-row"><span class="hl-rk ql-now">&#9679;</span>' + pair(x.artist1_artwork_url, x.artist2_artwork_url) + text(x) + '<a class="ql-btn go" href="https://www.wavewarz.com/v2/battles/' + encodeURIComponent(x.battle_id || '') + '" target="_blank" rel="noopener">Playing now</a></div></li>');
    });
    q.forEach(function (x, i) {
      rows.push('<li><div class="hl-row"><span class="hl-rk">' + (i + 1) + '</span>' + pair(x.artist1_artwork_url, x.artist2_artwork_url) + text(x) +
        (i === 0 ? '<button class="ql-btn go" type="button" data-act="launch" data-i="0">Launch</button>' : '<button class="ql-btn" type="button" data-act="skip" data-i="' + i + '">Skip &middot; ' + esc(price) + ' SOL</button>') + '</div></li>');
    });
    $('qlQueue').innerHTML = rows.join('') || '<li class="hl-empty">Nothing in the queue. <a href="audius-search.html" style="color:var(--brand-green)">Add a battle</a> and it plays next.</li>';
    $('qlCount').textContent = (q.length === 1 ? '1 battle' : q.length + ' battles') + ' waiting to play';
    $('qlNote').textContent = e.detail.sample ? 'Sample data. The live queue shows here on wavewarz.com.' : 'Only #1 can launch. Any other battle can skip to the front.';
  });
  $('qlQueue').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !last || !window.WWAct) return;
    var i = +b.dataset.i, x = (last.data.queued || [])[i]; if (!x) return;
    WWAct.open(b.dataset.act, { x: x, pos: i + 1, price: last.price, sample: last.sample }, b);
  });
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function recent(d) {
    var L = (d && d.battles) || [];
    $('qlRecent').innerHTML = L.map(function (x) {
      return '<li><div class="hl-row"><span class="hl-rk"></span>' + pair(x.artist1_artwork_url, x.artist2_artwork_url) +
        '<span class="hl-tx"><span class="hl-t">' + esc(x.artist1_track_title) + ' vs ' + esc(x.artist2_track_title) + '</span><span class="hl-s">@' + esc(x.artist1_handle) + ' vs @' + esc(x.artist2_handle) + ' &middot; ' + esc(when(x.completed_at)) + '</span></span>' +
        '<a class="ql-btn" href="https://www.wavewarz.com/v2/battles/' + encodeURIComponent(x.battle_id) + '" target="_blank" rel="noopener">View battle</a></div></li>';
    }).join('') || '<li class="hl-empty">No finished battles yet.</li>';
  }
  fetch(BASE + '/api/quick-battles/recent').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(recent)
    .catch(function () { fetch('quick-battles-recent.sample.json?v=1').then(function (r) { return r.json(); }).then(recent).catch(function () { $('qlRecent').innerHTML = '<li class="hl-empty">Finished battles did not load.</li>'; }); });
  /* scroll reveals, as on the homepage */
  if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-inview'); io.unobserve(x.target); } }); }, { threshold: 0.08 }); document.querySelectorAll('.labs-reveal').forEach(function (el) { io.observe(el); }); }
  else document.querySelectorAll('.labs-reveal').forEach(function (el) { el.classList.add('is-inview'); });
  if (location.hash === '#recent') setTimeout(function () { $('recent').scrollIntoView({ block: 'start' }); }, 300);
})();
</script>
'''

out = (head.rstrip() + PAGE_CSS if '</head>' not in head else head.replace('<link rel="stylesheet" href="ww-base.css">', PAGE_CSS + '<link rel="stylesheet" href="ww-base.css">'))
out += '''<body data-page="queue">
  <!-- GENERATED from index.html by tools/build-queue-page.py. Edit the homepage or the generator, not this file. -->
  <div class="ambient-canvas"></div>
  <div class="grid-overlay"></div>

''' + nav + '\n\n  <main>\n' + dock + '\n' + LISTS + '  </main>\n\n' + dialogs + footer + '\n\n' + \
    script('forms-js') + '\n' + script('actions-js') + '\n' + script('mainnet-callout-js') + '\n' + script('quick-battlez-js') + '\n' + PAGE_JS + '</body>\n</html>\n'
open('quick-battles.html', 'w', encoding='utf-8').write(out)
print('quick-battles.html', len(out))
