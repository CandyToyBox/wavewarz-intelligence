#!/usr/bin/env python3
"""Builds battle.html from index.html so the battle page uses the exact nav, footer, dialog shell, Live Battle Deck styles
and leaderboard panels from the homepage. Run it again after changing any of those in index.html:

    python3 tools/build-battle-page.py
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
    return re.sub(r'href="#([a-z0-9-]+)"', lambda m: 'href="index.html#%s"' % m.group(1), html)

head = s[:s.index('<body')]
head = re.sub(r'<title>.*?</title>', '<title>Battle | WaveWarZ</title>', head, count=1, flags=re.S)
head = re.sub(r'(<meta name="description" content=")[^"]*(")', r'\1Two songs go head to head on WaveWarZ. Listen, vote in the poll, and trade the side you believe in.\2', head, count=1)
head = re.sub(r'\s*<meta property="og:[^>]*>', '', head)
head = re.sub(r'\s*<meta name="twitter:[^>]*>', '', head)
head = re.sub(r'\s*<link rel="canonical"[^>]*>', '', head)
head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)
head = re.sub(r'\s*<script type="module" src="[^"]*model-viewer[^"]*"></script>', '', head)

PAGE_CSS = '''
<style id="battle-page-css">
/* Battle page only. The deck (.ld), panels (.hl-panel), rows and the dialog shell (.wf) come from the homepage styles above. */
.bp-top { position: relative; z-index: 5; padding: 118px 24px 0; --chrome: linear-gradient(145deg, #f6fbff 0%, #aebccb 17%, #5a6b7e 40%, #dbe6ef 57%, #6d7e91 76%, #2c3746 100%); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.bp-top .ld { display: block; }
.bp-top .ld-act { width: 100%; cursor: pointer; }
.bp-top button.ld-act { -webkit-appearance: none; appearance: none; }
.bp-back { display: flex; max-width: 1000px; margin: 0 auto 14px; align-items: center; gap: 16px; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.bp-back a { color: var(--text-muted); text-decoration: none; padding: 8px 0; } .bp-back a:hover { color: var(--brand-green); }
.bp-end { max-width: 1000px; margin: 16px auto 0; display: none; align-items: center; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; padding: 16px 22px; border-radius: 22px; border: 1px solid rgba(216,235,252,.16); background: linear-gradient(180deg, rgba(14,21,34,.92), rgba(7,10,16,.95)); }
.bp-end.on { display: flex; }
.bp-end p { margin: 0; flex: 1 1 280px; color: var(--brand-ice); font-size: .98rem; line-height: 1.5; } .bp-end p b { color: #fff; }
.bp-end .btn-primary { cursor: pointer; border: 0; }
.bp { padding-top: 28px; }
.bp .hl-grid { grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); align-items: start; }
.bp .hl-grid + .hl-grid { margin-top: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bp .hl-ph { justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
.bp .hl-ph p { text-transform: none; letter-spacing: .02em; font: 400 .85rem/1.5 'Outfit', sans-serif; max-width: 52ch; }
.bp-tag { font: 500 .68rem 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); border: 1px solid rgba(216,235,252,.18); border-radius: 999px; padding: 5px 10px; white-space: nowrap; }
/* chart */
.bc { position: relative; margin-top: 4px; }
.bc-leg { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 2px 2px 8px; font: 500 .85rem 'Outfit', sans-serif; color: var(--brand-ice); }
.bc-leg span { display: inline-flex; align-items: center; gap: 8px; min-width: 0; } .bc-leg i { width: 18px; height: 3px; border-radius: 2px; flex: none; }
.bc-leg b { font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }
.bc-leg em { font: 500 .78rem 'JetBrains Mono', monospace; font-style: normal; color: var(--text-muted); }
.bc-plot { position: relative; height: 320px; touch-action: pan-y; outline: none; border-radius: 12px; }
.bc-plot:focus-visible { box-shadow: 0 0 0 2px var(--brand-green); }
.bc-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
.bc-plot .gl { stroke: rgba(216,235,252,.08); stroke-width: 1; } .bc-plot .ax { fill: #8d9bb0; font: 400 11px 'JetBrains Mono', monospace; }
.bc-plot .la { fill: none; stroke: #95fe7c; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; } .bc-plot .lb { fill: none; stroke: #7ec1fb; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.bc-plot .ea { fill: #95fe7c; stroke: #0a0f18; stroke-width: 2; } .bc-plot .eb { fill: #7ec1fb; stroke: #0a0f18; stroke-width: 2; }
.bc-plot .el { fill: #fff; font: 600 12px 'JetBrains Mono', monospace; }
.bc-plot .ch { stroke: rgba(216,235,252,.4); stroke-width: 1; display: none; }
.bc-tip { position: absolute; z-index: 3; top: 8px; min-width: 150px; pointer-events: none; display: none; padding: 9px 11px; border-radius: 8px; background: rgba(7,14,12,.86); border: 1px solid rgba(188,241,207,.42); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); font: 400 .78rem/1.5 'JetBrains Mono', monospace; color: #d7f5e4; }
.bc-tip .tt { color: var(--text-muted); letter-spacing: .08em; text-transform: uppercase; font-size: .68rem; }
.bc-tip .tr { display: flex; align-items: center; gap: 8px; } .bc-tip .tr i { width: 12px; height: 2px; flex: none; } .bc-tip .tr b { color: #fff; font-weight: 600; } .bc-tip .tr span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 18ch; }
.bc-note { margin: 10px 2px 2px; font: 400 .72rem/1.6 'JetBrains Mono', monospace; letter-spacing: .03em; color: var(--text-muted); }
.bc-tbl { margin: 6px 2px 4px; } .bc-tbl summary { cursor: pointer; padding: 8px 0; font: 500 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); } .bc-tbl summary:hover { color: var(--brand-green); }
.bp table { width: 100%; border-collapse: collapse; font: 400 .88rem 'Outfit', sans-serif; color: var(--brand-ice); }
.bp th, .bp td { padding: 10px 6px; border-top: 1px solid rgba(216,235,252,.08); text-align: right; font-variant-numeric: tabular-nums; }
.bp th:first-child, .bp td:first-child { text-align: left; color: var(--text-muted); font-weight: 400; }
.bp thead th { border-top: 0; font: 600 .88rem 'Space Grotesk', sans-serif; color: #fff; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp thead th i, .bf-who i, .br-w i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; vertical-align: 1px; }
.ka { background: #95fe7c; } .kb { background: #7ec1fb; }
/* how it is decided */
.bf { list-style: none; margin: 0; padding: 0; }
.bf li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; padding: 14px 4px; border-top: 1px solid rgba(216,235,252,.08); }
.bf li:first-child { border-top: 0; }
.bf h4 { margin: 0; font: 700 1rem 'Space Grotesk', sans-serif; color: #fff; } .bf p { margin: 3px 0 0; font: 400 .85rem/1.45 'Outfit', sans-serif; color: var(--text-muted); }
.bf-who { font: 600 .8rem 'JetBrains Mono', monospace; color: #fff; text-align: right; max-width: 20ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bf-who.open { color: var(--text-muted); font-weight: 400; }
.bf-who small { display: block; margin-top: 2px; font: 400 .66rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }
.bf-vote { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
.bp-btn { min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; font: 700 .72rem 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-ice); background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.28); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; }
.bp-btn:hover { border-color: var(--brand-green); color: var(--brand-green); } .bp-btn:disabled { opacity: .5; cursor: default; }
.bf-rule { margin: 12px 4px 6px; padding-top: 12px; border-top: 1px solid rgba(216,235,252,.08); font: 400 .85rem/1.5 'Outfit', sans-serif; color: var(--brand-ice); } .bf-rule b { color: var(--brand-green); font-weight: 600; }
/* rounds */
.br { list-style: none; margin: 0; padding: 0; }
.br li a { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 13px 4px; border-top: 1px solid rgba(216,235,252,.08); color: inherit; text-decoration: none; }
.br li:first-child a { border-top: 0; } .br li a:hover .br-w { color: var(--brand-green); }
.br-n { font: 700 .72rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); } .br li.cur .br-n { color: var(--brand-green); }
.br-w { font: 600 .95rem 'Space Grotesk', sans-serif; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .br-w.open { color: var(--text-muted); font-weight: 400; }
.br-m { font: 400 .72rem 'JetBrains Mono', monospace; color: var(--text-muted); white-space: nowrap; }
.br-score { margin: 0 4px 6px; font: 700 1.5rem 'Outfit', sans-serif; color: #fff; } .br-score small { font: 400 .78rem 'JetBrains Mono', monospace; color: var(--text-muted); margin-left: 8px; letter-spacing: .06em; }
/* trade module, inside the shared dialog */
.bt-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 5px; border-radius: 999px; background: rgba(255,255,255,.04); border: 1px solid rgba(216,235,252,.14); margin: 16px 0 14px; }
.bt-tabs button { min-height: 44px; border: 0; border-radius: 999px; cursor: pointer; background: transparent; color: var(--brand-ice); font: 700 .78rem 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.bt-tabs button[aria-selected="true"] { background: var(--brand-green); color: #0d1321; }
.bt-amt { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.bt-amt button { min-height: 52px; border-radius: 14px; cursor: pointer; background: rgba(255,255,255,.03); border: 1px solid rgba(216,235,252,.2); color: #fff; font: 700 .95rem 'JetBrains Mono', monospace; }
.bt-amt button[aria-pressed="true"] { border-color: var(--brand-green); box-shadow: inset 0 0 0 1px var(--brand-green); color: var(--brand-green); }
.bt-bal { margin: 0 2px 8px; font: 400 .8rem 'JetBrains Mono', monospace; color: var(--text-muted); }
@media (max-width: 1000px) { .bp .hl-grid, .bp .hl-grid + .hl-grid { grid-template-columns: 1fr; } }
@media (max-width: 860px) { .bp-top { padding: 104px 16px 0; } .bc-plot { height: 260px; } }
@media (prefers-reduced-transparency: reduce) { .bc-tip { background: rgba(7,14,12,.96); -webkit-backdrop-filter: none; backdrop-filter: none; } }
</style>
'''

nav = local(between('  <div class="nav-wrapper">', '    </nav>\n  </div>'))
nav = nav.replace('href="index.html#top"', 'href="index.html"')
dialogs = between('  <!-- FORMS: one chrome module', '  <!-- FOOTER -->\n  <footer class="cp-foot">', include_end=False)
footer = local(between('  <footer class="cp-foot">', '  </footer>'))

BODY = '''
  <!-- MATCHUP: the Live Battle Deck from the homepage, with Trade buttons that open the trade module -->
  <div class="bp-top">
    <div class="bp-back"><a href="quick-battles.html">&larr; All battles</a><span id="bpKind" class="bp-tag" hidden></span></div>
    <div id="bpDeck" aria-live="polite"><section class="ld" aria-label="Battle"><div class="ld-top"><span class="ld-live ended"><i></i>Loading the battle</span></div></section></div>
    <div class="bp-end" id="bpEnd"><p id="bpEndTx"></p><button class="btn-primary" type="button" id="bpWithdraw">Withdraw</button></div>
  </div>

  <section class="cp-sec hl bp" aria-label="Battle details">
    <div class="hl-in">
      <div class="hl-grid">
        <article class="hl-panel" id="chart">
          <header class="hl-ph"><div><h3>The chart</h3><p>SOL in each side's pool over time. The side with more in its pool when time runs out takes the chart.</p></div><span class="bp-tag" id="bcTag" hidden>Sample chart</span></header>
          <div class="bc">
            <div class="bc-leg" id="bcLeg"></div>
            <div class="bc-plot" id="bcPlot" tabindex="0" role="img" aria-label="Pool size over time for both sides"></div>
            <div class="bc-tip" id="bcTip"></div>
          </div>
          <details class="bc-tbl"><summary>See the numbers as a table</summary><div id="bcTable"></div></details>
          <p class="bc-note" id="bcNote"></p>
        </article>
        <article class="hl-panel" id="decided">
          <header class="hl-ph"><div><h3 id="bfTitle">How this battle is decided</h3><p>Three things count. Two of the three wins.</p></div></header>
          <ul class="bf" id="bfList"></ul>
          <p class="bf-rule" id="bfRule"></p>
        </article>
      </div>
      <div class="hl-grid">
        <article class="hl-panel" id="rounds" hidden>
          <header class="hl-ph"><div><h3>Rounds</h3><p>Best of three rounds takes the battle.</p></div></header>
          <p class="br-score" id="brScore"></p>
          <ol class="br" id="brList"></ol>
        </article>
        <article class="hl-panel" id="sides">
          <header class="hl-ph"><div><h3>Side by side</h3><p>Artists earn 1% of every trade on their side.</p></div></header>
          <div id="bsTable"></div>
        </article>
      </div>
    </div>
  </section>
'''

PAGE_JS = r'''<script id="battle-page-js">
/* Battle page. Read-only data comes from https://wavewarz.info/api/public (battles/:id and events).
   Everything that needs a wallet goes through window.WW; each call returns a Promise. With a function missing, that control
   runs in preview and says so:
     WW.getBattleChart(battleId)        -> { points: [{ t: ms, a: poolSol, b: poolSol }, ...] }
     WW.getPosition(battle)             -> { a: { tokens, valueSol }, b: { tokens, valueSol } }
     WW.buy(battle, side, amountSol)    side is 'a' or 'b'
     WW.sell(battle, side, percent)     25, 50 or 100
     WW.withdraw(battle)
     WW.getPoll(battle)                 -> { a: votes, b: votes, locked: bool }
     WW.votePoll(battle, side)
   Pick a battle with ?id=<battleId>. With no id the page shows the live battle, or the most recent one.
   Design review: ?demo=live shows a battle in progress with sample pools. */
(function () {
  'use strict';
  var API = 'https://wavewarz.info/api/public/', W = window.WW = window.WW || {};
  var qs = new URLSearchParams(location.search), demo = qs.get('demo'), wantId = (qs.get('id') || '').replace(/[^0-9]/g, '');
  var $ = function (id) { return document.getElementById(id); };
  var B = null, EV = null, pts = [], sampleChart = false, tick = null, poll = null, lastKey = '';
  var CA = '#95fe7c', CB = '#7ec1fb';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
  function sol(n, d) { return (+n || 0).toFixed(d == null ? 2 : d) + ' SOL'; }
  function handle(a) { try { var u = new URL(a.musicLink); return /audius\.co$/.test(u.hostname) ? (u.pathname.split('/')[1] || '') : ''; } catch (e) { return ''; } }
  function httpsUrl(u) { try { var x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } }
  function kindName(t) { return t === 'main' ? 'Sunday Featured' : (t === 'community' ? 'Community BattleZ' : 'Quick BattleZ'); }
  function ended() { return !B || Date.now() >= B.end; }
  function name(k) { return (k === 'a' ? B.a : B.b).name; }
  function side(v) { return v === 'artist1' ? 'a' : v === 'artist2' ? 'b' : ''; }

  /* ---------- matchup deck (same markup as the homepage Live Battle Deck) ---------- */
  var PLAY = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>';
  function sideHTML(k, a, label, leader) {
    var c = k === 'a' ? 'l' : 'r', by = handle(a) || a.twitterHandle || '', art = httpsUrl(a.albumArtUrl || a.profilePictureUrl), link = httpsUrl(a.musicLink), over = ended();
    return '<div class="ld-col ' + c + '"><div class="ld-art"><span class="ld-pill">' + label + '</span>' +
      (link ? '<a class="ld-play" href="' + esc(link) + '" target="_blank" rel="noopener" aria-label="Listen to ' + esc(a.name) + '">' + PLAY + '</a>' : '') +
      (art ? '<img src="' + esc(art) + '" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '<div class="ld-eq" aria-hidden="true">' + '<i></i>'.repeat(9) + '</div></div>' +
      '<div class="ld-np">' + (over ? (B.winner === k ? 'Winner' : 'Final') : 'Now playing') + '</div><h3 class="ld-nm">' + esc(a.name) + '</h3><p class="ld-by">' + (by ? 'by <b>@' + esc(by) + '</b>' : '&nbsp;') + '</p>' +
      (over ? (link ? '<a class="ld-act ' + (c === 'l' ? 'out-g' : 'out-b') + '" href="' + esc(link) + '" target="_blank" rel="noopener">Listen to ' + esc(a.name) + '</a>' : '')
            : '<button type="button" class="ld-act ' + (leader ? (c === 'l' ? 'fill-g' : 'fill-b') : (c === 'l' ? 'out-g' : 'out-b')) + '" data-trade="' + k + '">Trade ' + esc(a.name) + '</button>') + '</div>';
  }
  function renderDeck() {
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0, tot = pa + pb, ga = tot ? Math.round(100 * pa / tot) : 50, over = ended();
    var lab = B.type === 'quick' ? ['Song A', 'Song B'] : ['Artist A', 'Artist B'];
    var rd = EV && B.round ? ' &middot; Round ' + B.round + ' of ' + Math.max(3, EV.rounds.length) : '';
    $('bpDeck').innerHTML = '<section class="ld" aria-label="Battle"><div class="ld-top"><span class="ld-live' + (over ? ' ended' : '') + '"><i></i>' + (over ? 'Battle ended' : 'Live') + ' &middot; ' + kindName(B.type) + rd + '</span>' + (B.sample ? '<span>Sample data</span>' : '') + '</div>' +
      '<div class="ld-stage">' + sideHTML('a', B.a, lab[0], pa >= pb) +
      '<div class="ld-mid"><div class="ld-ring" role="timer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="rgba(218,236,253,.08)" stroke-width="3"/><circle id="ldArc" cx="50" cy="50" r="46" fill="none" stroke="#95fe7c" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="289" stroke-dashoffset="' + (over ? 289 : 0) + '" style="filter:drop-shadow(0 0 6px rgba(149,254,124,.6))"/></svg><div class="ld-time"><span id="ldT">' + (over ? '0:00' : '--:--') + '</span><small>' + (over ? 'FINAL' : 'TIME LEFT') + '</small></div></div><div class="ld-vs">VS</div>' +
      '<div class="ld-split"><div class="ld-pc"><span class="a">' + ga + '%</span><span class="c">' + (100 - ga) + '%</span></div><div class="ld-bar" aria-label="Share of the two pools"><i style="width:' + ga + '%"></i></div></div></div>' +
      sideHTML('b', B.b, lab[1], pb > pa) + '</div>' +
      '<div class="ld-foot"><span>' + (over ? '<span class="hl">&#9679; ENDED:</span> ' + (B.winner ? 'Winner: <b>' + esc(name(B.winner)) + '</b>' : 'Settling the result.') : '<span class="hl">&#9679; LIVE:</span> Tap play to hear a song, then trade the one you believe in.') + '</span><span>Both pools: <b>' + tot.toFixed(2) + ' SOL</b></span></div></section>';
    var k = $('bpKind'); k.hidden = false; k.textContent = 'Battle ' + B.id;
    var e = $('bpEnd'); e.classList.toggle('on', over);
    if (over) $('bpEndTx').innerHTML = '<b>This battle has ended.</b> If you traded, your SOL stays in the battle until you withdraw it yourself.';
    document.title = B.a.name + ' vs ' + B.b.name + ' | WaveWarZ';
  }
  function runTimer() {
    clearInterval(tick);
    function go() {
      var left = Math.max(0, B.end - Date.now()), s = Math.ceil(left / 1000), t = $('ldT'); if (!t) return;
      t.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      var arc = $('ldArc'); if (arc) arc.setAttribute('stroke-dashoffset', String(289 * (1 - left / Math.max(1, B.end - B.start))));
      if (left <= 0) { clearInterval(tick); paint(); }
    }
    if (!ended()) { go(); tick = setInterval(go, 500); }
  }

  /* ---------- how it is decided: poll, judges (DJ Wavy on Quick BattleZ), chart ---------- */
  function who(k, note) { return k ? '<span class="bf-who"><i class="k' + k + '"></i>' + esc(name(k)) + (note ? '<small>' + note + '</small>' : '') + '</span>' : '<span class="bf-who open">' + (note || 'Open') + '</span>'; }
  function renderDecided() {
    var f = B.factors || {}, over = ended(), quick = B.type !== 'main';
    var pa = B.a.poolSol || 0, pb = B.b.poolSol || 0, lead = pa === pb ? '' : (pa > pb ? 'a' : 'b');
    var pollK = side(f.xPollWinner), judgeK = side(f.humanJudgeWinner || f.djWavyWinner), chartK = side(f.solVoteWinner) || (over ? lead : '');
    var pv = B.poll, pollLive = pv && (pv.a || pv.b) ? (pv.a === pv.b ? '' : pv.a > pv.b ? 'a' : 'b') : '';
    var rows = '<li><div><h4>The poll</h4><p>' + (quick ? 'Fans vote for the song they like more. Voting is free.' : 'Fans vote in the poll on X during the round.') + '</p></div>' +
      (pollK ? who(pollK, 'Took the poll') : pollLive ? who(pollLive, 'Ahead ' + pv[pollLive] + ' to ' + pv[pollLive === 'a' ? 'b' : 'a']) : who('', over ? 'Not recorded' : 'Open')) +
      (quick && !over ? '<div class="bf-vote"><button class="bp-btn" type="button" data-vote="a">Vote ' + esc(B.a.name) + '</button><button class="bp-btn" type="button" data-vote="b">Vote ' + esc(B.b.name) + '</button><span class="bc-note" id="bfMsg" role="status" style="margin:0;align-self:center"></span></div>' : '') + '</li>' +
      '<li><div><h4>' + (quick ? 'DJ Wavy' : 'The judges') + '</h4><p>' + (quick ? 'The WaveWarZ AI judge listens to both songs and picks one.' : 'The judges pick the stronger performance of the round.') + '</p></div>' + (judgeK ? who(judgeK, quick ? 'DJ Wavy pick' : 'Judges pick') : who('', over ? 'Not scored yet' : 'After the round')) + '</li>' +
      '<li><div><h4>The chart</h4><p>The side with more SOL in its pool when time runs out.</p></div>' + (chartK ? who(chartK, 'Took the chart') : lead ? who(lead, 'Ahead now') : who('', 'Even')) + '</li>';
    $('bfList').innerHTML = rows;
    $('bfTitle').textContent = quick ? 'How this battle is decided' : 'How this round is decided';
    var got = { a: 0, b: 0 }; [pollK, judgeK, chartK].forEach(function (k) { if (k) got[k]++; });
    $('bfRule').innerHTML = B.winner ? '<b>' + esc(name(B.winner)) + '</b> took ' + (quick ? 'the battle' : 'this round') + (got[B.winner] ? ', ' + got[B.winner] + ' of 3.' : '.')
      : 'Two of three takes ' + (quick ? 'the battle.' : 'the round. Best of three rounds takes the battle.');
  }

  /* ---------- rounds (Main Events) ---------- */
  function renderRounds() {
    var p = $('rounds'); if (!EV || !EV.rounds || EV.rounds.length < 2) { p.hidden = true; return; }
    p.hidden = false;
    var rw = EV.roundsWon || {};
    $('brScore').innerHTML = esc(B.a.name) + ' ' + (rw.artist1 || 0) + ' &middot; ' + (rw.artist2 || 0) + ' ' + esc(B.b.name) + '<small>' + (EV.winnerSide ? 'Final' : 'So far') + '</small>';
    $('brList').innerHTML = EV.rounds.map(function (r) {
      var k = side(r.winnerSide), cur = String(r.battleId) === String(B.id);
      return '<li' + (cur ? ' class="cur"' : '') + '><a href="battle.html?id=' + encodeURIComponent(r.battleId) + '"' + (cur ? ' aria-current="page"' : '') + '><span class="br-n">Round ' + esc(r.roundNumber) + '</span>' +
        (k ? '<span class="br-w"><i class="k' + k + '"></i>' + esc(name(k)) + '</span>' : '<span class="br-w open">' + (r.live ? 'Live now' : 'Not decided yet') + '</span>') +
        '<span class="br-m">' + sol(r.artist1PoolSol) + ' / ' + sol(r.artist2PoolSol) + '</span></a></li>';
    }).join('');
  }

  /* ---------- side by side (also the table view of the headline numbers) ---------- */
  function renderSides() {
    var e = B.earnings || {}, ea = e.artist1 || {}, eb = e.artist2 || {};
    function row(l, x, y) { return '<tr><th scope="row">' + l + '</th><td>' + x + '</td><td>' + y + '</td></tr>'; }
    $('bsTable').innerHTML = '<table><thead><tr><th scope="col"><span class="sr-only">Measure</span></th><th scope="col"><i class="ka"></i>' + esc(B.a.name) + '</th><th scope="col"><i class="kb"></i>' + esc(B.b.name) + '</th></tr></thead><tbody>' +
      row('In the pool', sol(B.a.poolSol, 4), sol(B.b.poolSol, 4)) + row('Traded', sol(B.a.volumeSol, 4), sol(B.b.volumeSol, 4)) +
      (ea.totalSol != null || eb.totalSol != null ? row('Earned by the artist', sol(ea.totalSol, 4), sol(eb.totalSol, 4)) : '') + '</tbody></table>';
  }

  /* ---------- the chart: one plot, both sides ---------- */
  function seeded(seed) { var x = seed % 2147483647 || 7; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function samplePoints() {
    /* stand-in shape that ends on the real pool sizes; replaced by WW.getBattleChart */
    var r = seeded(+B.id || 7), end = Math.min(Date.now(), B.end), n = 36, out = [], a = 0, b = 0, ta = B.a.poolSol || 0, tb = B.b.poolSol || 0, i, wa = [], wb = [], sa = 0, sb = 0;
    for (i = 0; i < n; i++) { wa.push(r() < .45 ? r() : 0); wb.push(r() < .45 ? r() : 0); sa += wa[i]; sb += wb[i]; }
    out.push({ t: B.start, a: 0, b: 0 });
    for (i = 0; i < n; i++) { a += sa ? wa[i] / sa * ta : ta / n; b += sb ? wb[i] / sb * tb : tb / n; out.push({ t: B.start + (end - B.start) * (i + 1) / n, a: a, b: b }); }
    return out;
  }
  function loadChart() {
    var fn = W.getBattleChart;
    if (typeof fn !== 'function') { sampleChart = true; pts = samplePoints(); drawChart(); return; }
    Promise.resolve(fn(B.id)).then(function (d) {
      var p = ((d && d.points) || []).filter(function (x) { return isFinite(x.t) && isFinite(x.a) && isFinite(x.b); }).sort(function (x, y) { return x.t - y.t; });
      if (p.length < 2) throw 0; sampleChart = false; pts = p; drawChart();
    }).catch(function () { sampleChart = true; pts = samplePoints(); drawChart(); });
  }
  function nice(v) { var e = Math.pow(10, Math.floor(Math.log10(v || 1))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }
  function clock(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var G = null;
  function drawChart() {
    var el = $('bcPlot'), w = el.clientWidth, h = el.clientHeight; if (!w || !pts.length) return;
    var L = 46, R = 78, T = 14, Bm = 28, pw = Math.max(40, w - L - R), ph = h - T - Bm;
    var t0 = B.start, t1 = Math.max(B.end, pts[pts.length - 1].t), max = 0; pts.forEach(function (p) { max = Math.max(max, p.a, p.b); });
    var stepV = nice((max * 1.05 || 1) / 4), top = stepV * Math.max(1, Math.ceil(max * 1.05 / stepV)), nT = Math.round(top / stepV), dec = stepV >= 1 ? 0 : stepV >= .1 ? 1 : stepV >= .01 ? 2 : 3, X = function (t) { return L + pw * (t - t0) / Math.max(1, t1 - t0); }, Y = function (v) { return T + ph * (1 - v / top); };
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">', i;
    for (i = 0; i <= nT; i++) { var v = stepV * i, y = Y(v); s += '<line class="gl" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y + '" y2="' + y + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v.toFixed(dec) + '</text>'; }
    var nX = pw < 320 ? 2 : 4; for (i = 0; i <= nX; i++) { var tt = t0 + (t1 - t0) * i / nX; s += '<text class="ax" x="' + X(tt) + '" y="' + (h - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === nX ? 'end' : 'middle') + '">' + clock(tt - t0) + '</text>'; }
    function path(k) { return pts.map(function (p, j) { return (j ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p[k]).toFixed(1); }).join(''); }
    var last = pts[pts.length - 1], ex = X(last.t), ya = Y(last.a), yb = Y(last.b), la = ya, lb = yb;
    if (Math.abs(la - lb) < 16) { var mid = (la + lb) / 2, up = ya <= yb; la = mid + (up ? -8 : 8); lb = mid + (up ? 8 : -8); }
    s += '<path class="lb" d="' + path('b') + '"/><path class="la" d="' + path('a') + '"/>' +
      '<line class="ch" id="bcCh" y1="' + T + '" y2="' + (T + ph) + '"/>' +
      '<circle class="eb" cx="' + ex + '" cy="' + yb + '" r="4.5"/><circle class="ea" cx="' + ex + '" cy="' + ya + '" r="4.5"/>' +
      '<text class="el" x="' + (ex + 10) + '" y="' + (la + 4) + '">' + last.a.toFixed(2) + ' SOL</text><text class="el" x="' + (ex + 10) + '" y="' + (lb + 4) + '">' + last.b.toFixed(2) + ' SOL</text>' +
      '<circle class="ea" id="bcDa" r="4.5" style="display:none"/><circle class="eb" id="bcDb" r="4.5" style="display:none"/></svg>';
    el.innerHTML = s; G = { L: L, pw: pw, X: X, Y: Y, t0: t0, w: w };
    var leg = $('bcLeg'); leg.textContent = '';
    [['a', CA], ['b', CB]].forEach(function (q) { var sp = document.createElement('span'), ic = document.createElement('i'), nm = document.createElement('b'), em = document.createElement('em'); ic.style.background = q[1]; nm.textContent = name(q[0]); em.textContent = sol(last[q[0]]); sp.appendChild(ic); sp.appendChild(nm); sp.appendChild(em); leg.appendChild(sp); });
    $('bcTag').hidden = !sampleChart;
    $('bcNote').textContent = sampleChart ? 'The line shape here is a sample that ends on the real pool sizes. On wavewarz.com it is drawn from every trade.' : (ended() ? 'Final.' : 'Updates as people trade.');
    el.setAttribute('aria-label', 'Pool size over time. ' + name('a') + ' ' + sol(last.a) + ', ' + name('b') + ' ' + sol(last.b) + '.');
    var step = Math.max(1, Math.floor(pts.length / 8)), rows = pts.filter(function (p, j) { return j % step === 0 || j === pts.length - 1; });
    $('bcTable').innerHTML = '<table><thead><tr><th scope="col">Time</th><th scope="col"><i class="ka"></i>' + esc(name('a')) + '</th><th scope="col"><i class="kb"></i>' + esc(name('b')) + '</th></tr></thead><tbody>' +
      rows.map(function (p) { return '<tr><th scope="row">' + clock(p.t - t0) + '</th><td>' + sol(p.a, 3) + '</td><td>' + sol(p.b, 3) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function tipAt(i) {
    if (!G || !pts[i]) return; var p = pts[i], x = G.X(p.t), tip = $('bcTip'), ch = $('bcCh'), da = $('bcDa'), db = $('bcDb');
    ch.setAttribute('x1', x); ch.setAttribute('x2', x); ch.style.display = 'block';
    da.setAttribute('cx', x); da.setAttribute('cy', G.Y(p.a)); da.style.display = 'block'; db.setAttribute('cx', x); db.setAttribute('cy', G.Y(p.b)); db.style.display = 'block';
    tip.textContent = ''; var tt = document.createElement('div'); tt.className = 'tt'; tt.textContent = clock(p.t - G.t0) + ' in'; tip.appendChild(tt);
    var order = p.a >= p.b ? ['a', 'b'] : ['b', 'a'];
    order.forEach(function (k) { var r = document.createElement('div'), ic = document.createElement('i'), v = document.createElement('b'), n = document.createElement('span'); r.className = 'tr'; ic.style.background = k === 'a' ? CA : CB; v.textContent = sol(p[k], 3); n.textContent = name(k); r.appendChild(ic); r.appendChild(v); r.appendChild(n); tip.appendChild(r); });
    tip.style.display = 'block'; var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(G.w - tw, x + (x > G.w / 2 ? -tw - 12 : 12))) + 'px';
  }
  function tipOff() { $('bcTip').style.display = 'none'; ['bcCh', 'bcDa', 'bcDb'].forEach(function (id) { var e = $(id); if (e) e.style.display = 'none'; }); }
  var kI = -1;
  function nearest(clientX) { var r = $('bcPlot').getBoundingClientRect(), x = clientX - r.left, best = 0, d = 1e9; pts.forEach(function (p, i) { var q = Math.abs(G.X(p.t) - x); if (q < d) { d = q; best = i; } }); return best; }
  $('bcPlot').addEventListener('pointermove', function (e) { if (G) { kI = nearest(e.clientX); tipAt(kI); } });
  $('bcPlot').addEventListener('pointerdown', function (e) { if (G) { kI = nearest(e.clientX); tipAt(kI); } });
  $('bcPlot').addEventListener('pointerleave', tipOff);
  $('bcPlot').addEventListener('blur', tipOff);
  $('bcPlot').addEventListener('focus', function () { if (pts.length) { kI = pts.length - 1; tipAt(kI); } });
  $('bcPlot').addEventListener('keydown', function (e) { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); kI = Math.max(0, Math.min(pts.length - 1, (kI < 0 ? pts.length - 1 : kI) + (e.key === 'ArrowLeft' ? -1 : 1))); tipAt(kI); });
  var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { tipOff(); drawChart(); }, 120); });

  /* ---------- trade module (uses the shared #wwAct dialog shell) ---------- */
  var dlg = $('wwAct'), opener = null, busy = false;
  function disc(u) { u = httpsUrl(u); return '<span class="wa-d"><b>' + (u ? '<img src="' + esc(u) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</b></span>'; }
  function done(title, text) {
    $('waBody').innerHTML = '<div class="wf-done"><span class="wf-ok" aria-hidden="true"></span><h3>' + title + '</h3><p>' + text + '</p><button class="btn-secondary" type="button" id="waDone">Close</button></div>';
    $('waDone').addEventListener('click', function () { dlg.close(); }); $('waDone').focus();
  }
  function run(btn, live, call, okTitle, okText) {
    if (busy) return; busy = true; var label = btn.textContent; btn.disabled = true; btn.textContent = 'Waiting for your wallet…'; var er = $('waErr'); if (er) er.textContent = '';
    Promise.resolve(live ? call() : new Promise(function (r) { setTimeout(r, 900); })).then(function () {
      done(live ? okTitle : 'Preview complete.', live ? okText : 'This was a preview. No wallet opened and nothing was sent.');
      if (live) { document.dispatchEvent(new CustomEvent('ww-battle-changed', { detail: { id: B.id } })); load(); }
    }).catch(function (e) { btn.disabled = false; btn.textContent = label; if (er) er.textContent = (e && e.userMessage) || 'That did not go through. Nothing was sent. Try again.'; }).then(function () { busy = false; });
  }
  function openTrade(k, from) {
    if (!dlg || !dlg.showModal || ended()) return;
    var a = k === 'a' ? B.a : B.b, mode = 'buy', amt = 0.1, pct = 50, by = handle(a) || a.twitterHandle || '';
    opener = from || null; $('waEb').textContent = kindName(B.type); $('waTitle').textContent = 'Trade ' + a.name;
    function draw() {
      var live = typeof (mode === 'buy' ? W.buy : W.sell) === 'function';
      $('waBody').innerHTML = '<div class="wa-s">' + disc(a.albumArtUrl || a.profilePictureUrl) + '<div><strong>' + esc(a.name) + '</strong><span>' + (by ? '@' + esc(by) : kindName(B.type)) + '</span></div></div>' +
        '<div class="bt-tabs" role="tablist"><button type="button" role="tab" data-m="buy" aria-selected="' + (mode === 'buy') + '">Buy</button><button type="button" role="tab" data-m="sell" aria-selected="' + (mode === 'sell') + '">Sell</button></div>' +
        (mode === 'buy'
          ? '<div class="bt-amt">' + [0.05, 0.1, 0.25].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (v === amt) + '">' + v.toFixed(2) + ' SOL</button>'; }).join('') + '</div>'
          : '<div class="bt-amt">' + [25, 50, 100].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (v === pct) + '">' + v + '%</button>'; }).join('') + '</div><p class="bt-bal" id="btBal">Connect a wallet to see your balance.</p>') +
        '<div class="wa-rows"><div><span>Goes to the artist</span><b>1% of the trade</b></div><div><span>Platform fee</span><b>0.5% of the trade</b></div></div>' +
        '<p class="wf-err" id="waErr" role="alert"></p><div class="wf-act"><button class="btn-primary" type="button" id="waGo">' + (mode === 'buy' ? 'Buy ' + amt.toFixed(2) + ' SOL' : 'Sell ' + pct + '%') + '</button>' +
        '<span class="wf-fine">' + (live ? 'Your wallet opens to approve. Token prices move as people trade, and you can get back less than you put in.' : 'Preview. Nothing is sent from this page yet.') + '</span></div>';
      if (mode === 'sell' && typeof W.getPosition === 'function') Promise.resolve(W.getPosition(B)).then(function (p) { var x = p && p[k], e = $('btBal'); if (x && e) e.textContent = 'Your balance: ' + (+x.tokens || 0).toFixed(3) + ' tokens, about ' + sol(x.valueSol, 4); }).catch(function () {});
      $('waGo').addEventListener('click', function () {
        run(this, live, function () { return mode === 'buy' ? W.buy(B, k, amt) : W.sell(B, k, pct); }, mode === 'buy' ? 'Bought.' : 'Sold.', mode === 'buy' ? 'You are in on ' + esc(a.name) + '. Withdraw after the battle ends.' : 'Your sale went through.');
      });
    }
    $('waBody').onclick = function (e) {
      var m = e.target.closest('[data-m]'), v = e.target.closest('[data-v]');
      if (m) { mode = m.dataset.m; draw(); $('waBody').querySelector('[data-m="' + mode + '"]').focus(); }
      else if (v) { if (mode === 'buy') amt = +v.dataset.v; else pct = +v.dataset.v; draw(); $('waBody').querySelector('[data-v="' + v.dataset.v + '"]').focus(); }
    };
    draw(); if (!dlg.open) dlg.showModal();
  }
  function openWithdraw(from) {
    if (!dlg || !dlg.showModal) return; var live = typeof W.withdraw === 'function';
    opener = from || null; $('waBody').onclick = null; $('waEb').textContent = kindName(B.type); $('waTitle').textContent = 'Withdraw from this battle';
    $('waBody').innerHTML = '<div class="wa-rows"><div><span>Battle</span><b>' + esc(B.a.name) + ' vs ' + esc(B.b.name) + '</b></div><div><span>Result</span><b>' + (B.winner ? esc(name(B.winner)) + ' won' : 'Settling') + '</b></div></div>' +
      '<p class="wf-err" id="waErr" role="alert"></p><div class="wf-act"><button class="btn-primary" type="button" id="waGo">Withdraw</button><span class="wf-fine">' + (live ? 'Your wallet opens to approve. Whatever is yours from this battle goes back to your wallet.' : 'Preview. Nothing is sent from this page yet.') + '</span></div>';
    $('waGo').addEventListener('click', function () { run(this, live, function () { return W.withdraw(B); }, 'Withdrawn.', 'Check your wallet for the SOL from this battle.'); });
    if (!dlg.open) dlg.showModal();
  }
  if (dlg) dlg.addEventListener('close', function () { if (opener && opener.focus && document.contains(opener)) opener.focus(); opener = null; });
  $('bpDeck').addEventListener('click', function (e) { var b = e.target.closest('[data-trade]'); if (b) openTrade(b.dataset.trade, b); });
  $('bpWithdraw').addEventListener('click', function () { openWithdraw(this); });
  $('bfList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-vote]'); if (!b) return; var msg = $('bfMsg'), live = typeof W.votePoll === 'function';
    if (!live) { if (msg) msg.textContent = 'Preview. Voting turns on at wavewarz.com.'; return; }
    b.disabled = true;
    Promise.resolve(W.votePoll(B, b.dataset.vote)).then(function () { return loadPoll(); }).then(function () { var m = $('bfMsg'); if (m) m.textContent = 'Vote counted.'; })
      .catch(function (er) { b.disabled = false; var m = $('bfMsg'); if (m) m.textContent = (er && er.userMessage) || 'Your vote did not go through. Try again.'; });
  });
  function loadPoll() {
    if (typeof W.getPoll !== 'function' || !B) return Promise.resolve();
    return Promise.resolve(W.getPoll(B)).then(function (p) { if (p) { B.poll = { a: +p.a || 0, b: +p.b || 0, locked: !!p.locked }; renderDecided(); } }).catch(function () {});
  }

  /* ---------- data ---------- */
  function normalize(x) {
    var end = Date.parse(x.endsAt), start = Date.parse(x.startedAt || x.createdAt) || (end - (x.battleDurationSeconds || 480) * 1000);
    return { id: x.battleId, type: x.type || 'quick', a: x.artist1, b: x.artist2, start: start, end: end, winner: side(x.winnerSide), factors: x.factors || null, earnings: x.artistEarnings || null, sample: !!x.sample, round: null, poll: B && B.id === x.battleId ? B.poll : null };
  }
  function paint() { renderDeck(); runTimer(); renderDecided(); renderRounds(); renderSides(); }
  function fail() { $('bpDeck').innerHTML = '<section class="ld" aria-label="Battle"><div class="ld-top"><span class="ld-live ended"><i></i>This battle did not load</span></div><div class="ld-foot"><span>Check the link, or <a href="quick-battles.html" style="color:var(--brand-green)">see all battles</a>.</span></div></section>'; }
  function pick() {
    if (wantId) return jget(API + 'battles/' + wantId);
    return jget(API + 'stats').then(function (d) { var lb = (d.liveBattles && d.liveBattles[0]) || d.liveBattle; if (lb && lb.battleId && !demo) return jget(API + 'battles/' + lb.battleId); return jget(API + 'battles?limit=1').then(function (r) { var x = (r.battles || r)[0]; return jget(API + 'battles/' + x.battleId).catch(function () { return x; }); }); });
  }
  function load() {
    return pick().then(function (x) {
      if (!x || !x.artist1 || !x.artist2) throw 0;
      if (demo === 'live') { x = JSON.parse(JSON.stringify(x)); x.sample = true; x.winnerSide = null; x.factors = null; x.endsAt = new Date(Date.now() + 169000).toISOString(); x.createdAt = new Date(Date.now() - 311000).toISOString(); x.startedAt = null; x.artist1.poolSol = 24.1; x.artist2.poolSol = 18.75; x.artist1.volumeSol = 31.4; x.artist2.volumeSol = 22.9; x.artistEarnings = null; }
      var first = !B; B = normalize(x);
      if (EV) setRound();
      paint();
      var key = B.id + ':' + B.a.poolSol + ':' + B.b.poolSol + ':' + ended();
      if (key !== lastKey) { lastKey = key; loadChart(); }
      if (first) { loadPoll(); if (B.type === 'main') jget(API + 'events?limit=60').then(function (d) { EV = (d.events || []).filter(function (e) { return (e.rounds || []).some(function (r) { return String(r.battleId) === String(B.id); }); })[0] || null; if (EV && demo === 'live') { EV = JSON.parse(JSON.stringify(EV)); EV.winnerSide = null; EV.rounds.forEach(function (r) { if (String(r.battleId) === String(B.id)) { if (r.winnerSide && EV.roundsWon[r.winnerSide]) EV.roundsWon[r.winnerSide]--; r.winnerSide = null; r.live = true; r.artist1PoolSol = B.a.poolSol; r.artist2PoolSol = B.b.poolSol; } }); } if (EV) { setRound(); paint(); } }).catch(function () {}); }
      clearTimeout(poll); if (!ended() && demo !== 'live') poll = setTimeout(load, 30000);
    }).catch(function () { if (!B) fail(); });
  }
  function setRound() { var r = (EV.rounds || []).filter(function (r) { return String(r.battleId) === String(B.id); })[0]; B.round = r ? r.roundNumber : null; }
  load();
})();
</script>
'''

out = head.replace('</head>', PAGE_CSS + '</head>') if '</head>' in head else head.rstrip() + PAGE_CSS
out += '''<body data-page="battle">
  <!-- GENERATED from index.html by tools/build-battle-page.py. Edit the homepage or the generator, not this file. -->
  <div class="ambient-canvas"></div>
  <div class="grid-overlay"></div>

''' + nav + '\n\n  <main>\n' + BODY + '  </main>\n\n' + dialogs + footer + '\n\n' + \
    script('forms-js') + '\n' + script('mainnet-callout-js') + '\n' + PAGE_JS + '</body>\n</html>\n'
open('battle.html', 'w', encoding='utf-8').write(out)
print('battle.html', len(out))
